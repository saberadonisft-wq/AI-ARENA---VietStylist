"""Bounded storage operations; credentials are never initialized on import."""

import threading
import time
import os
import tempfile
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, BotoCoreError
from functools import wraps
from app.core.config import settings
from app.core.errors import AppError
from app.modules.media.path_utils import safe_join_media_path


def storage_errors(operation):
    @wraps(operation)
    def execute(*args,**kwargs):
        try:
            return operation(*args,**kwargs)
        except (BotoCoreError,ClientError,OSError) as exc:
            raise AppError("STORAGE_UNAVAILABLE", "Không thể kết nối storage",503) from exc
    return execute


class R2StorageClient:
    def __init__(self):
        self._s3 = None
        self._credentials = None
        self._lock = threading.RLock()
        self._readiness = (0, False)

    @property
    def is_configured(self):
        return bool(
            settings.R2_ACCOUNT_ID
            and settings.R2_ACCESS_KEY_ID
            and settings.R2_SECRET_ACCESS_KEY
        )

    @property
    def local_dir(self):
        return settings.LOCAL_MEDIA_DIR

    @property
    def s3(self):
        if not self.is_configured:
            return None
        identity = (
            settings.R2_ACCOUNT_ID,
            settings.R2_ACCESS_KEY_ID,
            settings.R2_SECRET_ACCESS_KEY,
        )
        with self._lock:
            if self._s3 is None or self._credentials != identity:
                if self._s3 is not None:
                    self._s3.close()
                self._s3 = boto3.client(
                    "s3",
                    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    config=Config(
                        signature_version="s3v4",
                        connect_timeout=5,
                        read_timeout=30,
                        retries={"max_attempts": 2, "mode": "standard"},
                    ),
                    region_name="auto",
                )
                self._credentials = identity
                self._readiness = (0, False)
            return self._s3

    def require_available(self):
        supplied = (
            settings.R2_ACCOUNT_ID,
            settings.R2_ACCESS_KEY_ID,
            settings.R2_SECRET_ACCESS_KEY,
        )
        if any(supplied) and not all(supplied):
            raise AppError("STORAGE_UNAVAILABLE", "Cấu hình storage chưa đầy đủ", 503)
        if not self.is_configured and not settings.is_local_media_enabled():
            raise AppError("STORAGE_UNAVAILABLE", "Storage chưa được cấu hình", 503)

    def check_ready(self):
        self.require_available()
        if not self.is_configured:
            directory = Path(self.local_dir)
            directory.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryFile(dir=directory) as probe:
                probe.write(b"ready")
            return True
        with self._lock:
            now = time.monotonic()
            client = self.s3
            if self._readiness[0] > now:
                return self._readiness[1]
            try:
                for bucket in (settings.R2_BUCKET_PUBLIC, settings.R2_BUCKET_PRIVATE):
                    client.head_bucket(Bucket=bucket)
                ready = True
            except Exception:
                ready = False
            self._readiness = (now + 15, ready)
            return ready

    def close(self):
        with self._lock:
            if self._s3 is not None:
                self._s3.close()
            self._s3 = None
            self._readiness = (0, False)

    @storage_errors
    def generate_upload_url(self, bucket, object_key, content_type, expires_in=900):
        self.require_available()
        if not self.is_configured:
            raise ValueError("Local upload requires a media session grant")
        return {
            "upload_url": self.s3.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": bucket,
                    "Key": object_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            ),
            "method": "PUT",
            "expires_in": expires_in,
            "storage_type": "r2",
        }

    @storage_errors
    def generate_access_url(
        self, bucket, object_key, visibility="private", expires_in=300
    ):
        self.require_available()
        if not self.is_configured:
            return f"{settings.API_PUBLIC_ORIGIN.rstrip('/')}/api/media/files/{bucket}/{object_key}"
        if visibility == "public" and settings.R2_PUBLIC_DOMAIN:
            return f"{settings.R2_PUBLIC_DOMAIN.rstrip('/')}/{object_key}"
        return self.s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )

    def verify_object_exists(self, bucket, object_key):
        self.require_available()
        if self.is_configured:
            try:
                head = self.s3.head_object(Bucket=bucket, Key=object_key)
                return {
                    "size_bytes": head["ContentLength"],
                    "mime_type": head.get("ContentType"),
                }
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") in (
                    "404",
                    "NoSuchKey",
                    "NotFound",
                ):
                    return None
                raise AppError(
                    "STORAGE_UNAVAILABLE", "Không thể kiểm tra storage", 503
                ) from exc
        path = safe_join_media_path(self.local_dir, bucket, object_key)
        return {"size_bytes": os.path.getsize(path)} if os.path.isfile(path) else None

    def read_object(self, bucket, object_key, max_bytes):
        self.require_available()
        if self.is_configured:
            stream = self.s3.get_object(Bucket=bucket, Key=object_key)["Body"]
        else:
            stream = open(
                safe_join_media_path(self.local_dir, bucket, object_key), "rb"
            )
        try:
            data = stream.read(max_bytes + 1)
        finally:
            stream.close()
        if len(data) > max_bytes:
            raise AppError("PAYLOAD_TOO_LARGE", "File vượt giới hạn dung lượng", 413)
        return data

    def put_object(self, bucket, object_key, data, mime_type):
        self.require_available()
        if self.is_configured:
            self.s3.put_object(
                Bucket=bucket, Key=object_key, Body=data, ContentType=mime_type
            )
            return
        path = Path(safe_join_media_path(self.local_dir, bucket, object_key))
        path.parent.mkdir(parents=True, exist_ok=True)
        safe_join_media_path(self.local_dir, bucket, object_key)
        fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".upload-")
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def delete_object(self, bucket, object_key):
        try:
            self.require_available()
            if self.is_configured:
                self.s3.delete_object(Bucket=bucket, Key=object_key)
            else:
                Path(safe_join_media_path(self.local_dir, bucket, object_key)).unlink(
                    missing_ok=True
                )
            return True
        except Exception:
            return False


r2_client = R2StorageClient()
