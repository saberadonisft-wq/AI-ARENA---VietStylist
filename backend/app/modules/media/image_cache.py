"""Bounded image-byte cache. Callers must authorize every request before reading it."""
import hashlib
import io
import json
import logging
import os
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from app.core.config import settings
from app.infrastructure.r2.client import r2_client

logger = logging.getLogger(__name__)
_MAX_CACHE_BYTES = 256 * 1024 * 1024
_MAX_CACHE_FILES = 256
_MAX_AGE = 7 * 24 * 3600
_MAX_DISPLAY_PIXELS = 4_000_000
_locks = [threading.Lock() for _ in range(32)]
_prune_lock = threading.Lock()
_jobs_lock = threading.Lock()
_jobs = set()
_worker_slots = threading.BoundedSemaphore(2)
_workers = ThreadPoolExecutor(max_workers=2, thread_name_prefix="image-display")


@dataclass(frozen=True)
class CachedImage:
    data: bytes
    mime_type: str

    @property
    def etag(self):
        return '"' + hashlib.sha256(self.data).hexdigest() + '"'


def _paths(asset):
    # Ready object keys are immutable. Neither a signed URL nor a caller's path
    # is used as a cache key; replacing an asset produces a different key.
    identity = [settings.R2_ACCOUNT_ID, asset.get("cover_media_id", asset.get("id")),
                asset["bucket"], asset["object_key"], asset["mime_type"], "lossless-v1"]
    digest = hashlib.sha256(json.dumps(identity).encode()).hexdigest()
    directory = Path(settings.LOCAL_MEDIA_DIR).resolve() / "image-byte-cache"
    return directory / (digest + "-source.image"), directory / (digest + "-display.image")


def _read(path):
    try:
        stamp = path.stat().st_mtime
        if time.time() - stamp > _MAX_AGE:
            return None
        with path.open("rb") as stream:
            data = stream.read(settings.MEDIA_IMAGE_MAX_BYTES + 1)
        if len(data) > settings.MEDIA_IMAGE_MAX_BYTES:
            return None
        # Approximate LRU without writing metadata on every image request.
        if time.time() - stamp > 60:
            try:
                path.touch()
            except OSError:
                pass
        return data
    except OSError:
        return None


def _prune(directory):
    with _prune_lock:
        files = []
        for path in directory.glob("*.image"):
            try:
                stat = path.stat()
                files.append((stat.st_mtime, stat.st_size, path))
            except OSError:
                continue
        files.sort()
        total, count = sum(size for _, size, _ in files), len(files)
        for stamp, size, path in files:
            if total <= _MAX_CACHE_BYTES and count <= _MAX_CACHE_FILES and time.time() - stamp <= _MAX_AGE:
                break
            try:
                path.unlink(missing_ok=True)
            except OSError:
                continue
            total -= size
            count -= 1


def _write(path, data):
    temporary = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
        os.replace(temporary, path)
        _prune(path.parent)
    except OSError:
        # A full/read-only cache must not make an otherwise valid image fail.
        logger.debug("Image cache write unavailable")
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def lossless_display(data, mime_type, max_pixels):
    if mime_type != "image/png":
        return data
    with Image.open(io.BytesIO(data)) as source:
        if (source.format != "PNG" or source.mode not in ("RGB", "RGBA")
                or source.width * source.height > max_pixels or getattr(source, "is_animated", False)
                or set(source.info) - {"icc_profile", "exif", "xmp"}):
            return data
        output = io.BytesIO()
        metadata = {key: value for key, value in source.info.items() if key in ("icc_profile", "exif", "xmp")}
        source.save(output, format="WEBP", lossless=True, exact=True, method=4, **metadata)
        result = output.getvalue()
        return result if len(result) < len(data) else data


def _prepare_display(path, data, mime_type, max_pixels):
    try:
        result = lossless_display(data, mime_type, max_pixels)
        with _jobs_lock:
            if path in _jobs:
                _write(path, result)
    except Exception as exc:
        # Encoding is optional, and never delays or breaks the original image.
        logger.debug("Lossless image preparation skipped: %s", type(exc).__name__)
    finally:
        with _jobs_lock:
            _jobs.discard(path)
        _worker_slots.release()


def _queue_display(path, data, mime_type):
    if mime_type != "image/png" or _read(path) is not None:
        return
    with _jobs_lock:
        if path in _jobs or not _worker_slots.acquire(blocking=False):
            return
        _jobs.add(path)
    try:
        _workers.submit(_prepare_display, path, data, mime_type, min(settings.MEDIA_MAX_PIXELS, _MAX_DISPLAY_PIXELS))
    except RuntimeError:
        with _jobs_lock:
            _jobs.discard(path)
        _worker_slots.release()


def prime_image(asset, data):
    """Reuse already validated upload bytes instead of downloading them again."""
    if len(data) > settings.MEDIA_IMAGE_MAX_BYTES:
        return
    original, display = _paths(asset)
    _write(original, data)
    _queue_display(display, data, asset["mime_type"])


def evict_image(asset):
    original, display = _paths(asset)
    with _jobs_lock:
        _jobs.discard(display)
        for path in (original, display):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass


def accepts_webp(header):
    for entry in header.lower().split(','):
        media_type, *parameters = entry.split(';')
        if media_type.strip() != 'image/webp':
            continue
        quality = next((part.strip()[2:] for part in parameters if part.strip().startswith('q=')), '1')
        try:
            return 0 < float(quality) <= 1
        except ValueError:
            return False
    return False


def get_image(asset, *, webp=False):
    original, display = _paths(asset)
    if webp:
        data = _read(display)
        if data is not None:
            mime = "image/webp" if data[:4] == b"RIFF" and data[8:12] == b"WEBP" else asset["mime_type"]
            return CachedImage(data, mime)
    data = _read(original)
    if data is None:
        # Duplicate viewers share one storage download, without a global lock
        # holding up every other image.
        lock = _locks[int(original.name[:8], 16) % len(_locks)]
        with lock:
            data = _read(original)
            if data is None:
                data = r2_client.read_object(asset["bucket"], asset["object_key"], settings.MEDIA_IMAGE_MAX_BYTES)
                _write(original, data)
    _queue_display(display, data, asset["mime_type"])
    return CachedImage(data, asset["mime_type"])
