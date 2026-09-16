import os
import uuid
import boto3
from botocore.config import Config
from typing import Optional, Dict, Any
from app.core.config import settings

class R2StorageClient:
    def __init__(self):
        self.is_configured = bool(
            settings.R2_ACCOUNT_ID and settings.R2_ACCESS_KEY_ID and settings.R2_SECRET_ACCESS_KEY
        )
        self.local_dir = os.path.abspath(settings.LOCAL_MEDIA_DIR)
        os.makedirs(self.local_dir, exist_ok=True)

        if self.is_configured:
            endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            self.s3 = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
                region_name="auto",
            )
        else:
            self.s3 = None

    def generate_upload_url(
        self,
        bucket: str,
        object_key: str,
        content_type: str,
        expires_in: int = 3600
    ) -> Dict[str, Any]:
        """Tạo URL để client upload trực tiếp lên R2 hoặc endpoint local dev."""
        if self.is_configured and self.s3:
            url = self.s3.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": bucket,
                    "Key": object_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return {
                "upload_url": url,
                "method": "PUT",
                "object_key": object_key,
                "bucket": bucket,
                "expires_in": expires_in,
                "storage_type": "r2"
            }
        else:
            # Fallback endpoint local của FastAPI
            local_url = f"http://localhost:{settings.PORT}/api/media/local-upload?key={object_key}&bucket={bucket}"
            return {
                "upload_url": local_url,
                "method": "POST",
                "object_key": object_key,
                "bucket": bucket,
                "expires_in": expires_in,
                "storage_type": "local"
            }

    def generate_access_url(
        self,
        bucket: str,
        object_key: str,
        visibility: str = "public",
        expires_in: int = 3600
    ) -> str:
        """Tạo URL đọc file (public domain hoặc presigned URL cho file riêng tư)."""
        if not self.is_configured:
            return f"http://localhost:{settings.PORT}/api/media/files/{bucket}/{object_key}"
        if visibility == "public" and settings.R2_PUBLIC_DOMAIN:
            return f"{settings.R2_PUBLIC_DOMAIN}/{object_key}"

        if self.is_configured and self.s3:
            return self.s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": bucket, "Key": object_key},
                ExpiresIn=expires_in,
            )
        else:
            return f"http://localhost:{settings.PORT}/api/media/files/{bucket}/{object_key}"

    def verify_object_exists(self, bucket: str, object_key: str) -> Optional[Dict[str, Any]]:
        """Kiểm tra xem file đã được upload lên thành công chưa."""
        if self.is_configured and self.s3:
            try:
                head = self.s3.head_object(Bucket=bucket, Key=object_key)
                return {
                    "size_bytes": head.get("ContentLength", 0),
                    "mime_type": head.get("ContentType", "application/octet-stream"),
                }
            except Exception:
                return None
        else:
            file_path = os.path.join(self.local_dir, bucket, object_key)
            if os.path.exists(file_path):
                return {
                    "size_bytes": os.path.getsize(file_path),
                    "mime_type": "image/jpeg" if file_path.endswith((".jpg", ".jpeg")) else "image/png",
                }
            return None

    def delete_object(self, bucket: str, object_key: str) -> bool:
        if self.is_configured and self.s3:
            try:
                self.s3.delete_object(Bucket=bucket, Key=object_key)
                return True
            except Exception:
                return False
        else:
            file_path = os.path.join(self.local_dir, bucket, object_key)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    return True
                except Exception:
                    return False
            return True


r2_client = R2StorageClient()
