"""Bounded, cached cutouts for published catalog media (never arbitrary URLs)."""
import hashlib
import io
import json
import logging
import threading
import tempfile
import colorsys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.core.errors import AppError
from app.infrastructure.r2.client import r2_client
from app.modules.catalog.repository import CatalogRepository
from app.modules.media.repository import MediaRepository

logger = logging.getLogger(__name__)
_processing = threading.Lock()
_session = None
_VERSION = "isnet-v1"
_RECOLOR_VERSION = "automatic-fabric-recolor-v2"
_thumbnail_processing = threading.BoundedSemaphore(2)
_THUMBNAIL_SIZES = (112, 224, 320, 640)


def get_catalog_thumbnail(item_id: str, requested_size: int = 224) -> bytes:
    # Only known public media can be read: never fetch metadata URLs supplied by
    # a caller. Check publication even when the derivative is already cached.
    _, media, source_key = _published_studio_source(item_id)
    size = next((value for value in _THUMBNAIL_SIZES if value >= requested_size), 640)
    directory = Path(settings.LOCAL_MEDIA_DIR) / "catalog-thumbnails"
    target = directory / f"{source_key}-lossless-v1-{size}.webp"
    try:
        try:
            return target.read_bytes()
        except FileNotFoundError:
            pass
        if not _thumbnail_processing.acquire(timeout=8):
            raise AppError("THUMBNAIL_BUSY", "Đang chuẩn bị ảnh thu nhỏ. Vui lòng thử lại.", 503)
        try:
            try:
                return target.read_bytes()
            except FileNotFoundError:
                pass
            data = r2_client.read_object(media["bucket"], media["object_key"], settings.MEDIA_IMAGE_MAX_BYTES)
            with Image.open(io.BytesIO(data)) as source:
                if source.width * source.height > settings.MEDIA_MAX_PIXELS:
                    raise AppError("IMAGE_TOO_LARGE", "Ảnh vượt giới hạn xử lý.", 413)
                image = ImageOps.exif_transpose(source).convert("RGBA")
            image.thumbnail((size, size), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            image.save(output, format="WEBP", lossless=True, exact=True, method=4)
            result = output.getvalue()
            directory.mkdir(parents=True, exist_ok=True)
            # Independent bounded cache: thumbnails cannot evict Studio cutouts.
            cached = sorted(directory.glob("*.webp"), key=lambda path: path.stat().st_mtime)
            for obsolete in cached[:-255]:
                try:
                    obsolete.unlink(missing_ok=True)
                except (PermissionError, FileNotFoundError):
                    pass
            with tempfile.NamedTemporaryFile(dir=directory, delete=False) as temp:
                temp.write(result)
                temporary = Path(temp.name)
            try:
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
            return result
        finally:
            _thumbnail_processing.release()
    except AppError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise AppError("INVALID_IMAGE", "Ảnh trang phục không hợp lệ.", 422) from exc
    except Exception as exc:
        logger.warning("Catalog thumbnail failed: %s", type(exc).__name__)
        raise AppError("THUMBNAIL_UNAVAILABLE", "Chưa tải được ảnh thu nhỏ.", 503) from exc


def make_cutout(data: bytes) -> bytes:
    global _session
    with Image.open(io.BytesIO(data)) as source:
        if source.width * source.height > settings.MEDIA_MAX_PIXELS:
            raise AppError("IMAGE_TOO_LARGE", "Ảnh vượt giới hạn xử lý.", 413)
        image = ImageOps.exif_transpose(source).convert("RGBA")
    image.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
    # Tiny alpha artifacts do not prove that the background was removed.
    alpha = image.getchannel("A")
    transparent_pixels = sum(alpha.histogram()[:250])
    if transparent_pixels < image.width * image.height * 0.01:
        from rembg import new_session, remove
        if _session is None:
            _session = new_session("isnet-general-use", providers=["CPUExecutionProvider"])
        image = remove(image, session=_session).convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value > 12 else 0).getbbox()
    if bounds is None:
        raise AppError("CUTOUT_EMPTY", "Không nhận diện được trang phục trong ảnh.", 422)
    image.putalpha(alpha.point(lambda value: 0 if value < 8 else value))
    cropped = image.crop(bounds)
    # A small transparent border protects soft edges from being clipped.
    result = Image.new("RGBA", (cropped.width + 8, cropped.height + 8))
    result.paste(cropped, (4, 4))
    output = io.BytesIO()
    result.save(output, format="PNG")
    return output.getvalue()


def _published_studio_source(item_id: str):
    item = CatalogRepository.get_item_by_id(item_id)
    if not item:
        raise AppError("ITEM_NOT_FOUND", "Không tìm thấy trang phục công khai.", 404)
    metadata = item.get("metadata") or {}
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
    item = {**item, "metadata": metadata}
    media_id = metadata.get("catalog_media_id") if isinstance(metadata, dict) else None
    media = MediaRepository.get_media_by_id(media_id) if isinstance(media_id, str) else None
    if not media or (media["visibility"], media["status"], media["media_type"], media["bucket"]) != (
        "public", "ready", "image", settings.R2_BUCKET_PUBLIC
    ):
        raise AppError("STUDIO_IMAGE_NOT_FOUND", "Chưa có ảnh công khai để tách nền.", 404)
    key = hashlib.sha256(json.dumps([
        _VERSION, media["id"], media["bucket"], media["object_key"], str(media.get("updated_at"))
    ]).encode()).hexdigest()
    return item, media, key


def _store_cached_image(directory: Path, target: Path, data: bytes) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    cached = sorted(directory.glob("*.png"), key=lambda path: path.stat().st_mtime)
    for obsolete in cached[:-127]:
        try:
            obsolete.unlink(missing_ok=True)
        except PermissionError:
            # Windows readers can briefly prevent deletion. Leave this entry
            # for the next eviction rather than failing a different image.
            continue
    with tempfile.NamedTemporaryFile(dir=directory, suffix=".tmp", delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(data)
    try:
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def _recolor_preserving_detail(data: bytes, color_hex: str) -> bytes:
    """Conservatively recolor a dominant fabric hue while preserving edges and alpha."""
    try:
        target_rgb = tuple(int(color_hex[index:index + 2], 16) for index in (1, 3, 5))
    except (TypeError, ValueError):
        raise AppError("INVALID_COLOR", "Màu cần đổi phải ở dạng HEX #RRGGBB.", 422)
    target_h, target_s, _ = colorsys.rgb_to_hsv(*(channel / 255 for channel in target_rgb))
    with Image.open(io.BytesIO(data)) as source:
        image = source.convert("RGBA")
    alpha = image.getchannel("A")
    hue, saturation, value = image.convert("RGB").convert("HSV").split()
    hue_data = list(hue.getdata())
    saturation_data = list(saturation.getdata())
    value_data = list(value.getdata())
    alpha_data = list(alpha.getdata())

    bins = [0] * 32
    for h, s, v, a in zip(hue_data, saturation_data, value_data, alpha_data):
        if a >= 220 and s >= 46 and v >= 24:
            bins[h // 8] += 1
    dominant_bin = max(range(len(bins)), key=bins.__getitem__)
    dominant_pixels = bins[dominant_bin]
    opaque_pixels = sum(1 for value_alpha in alpha_data if value_alpha >= 220)
    if not opaque_pixels or dominant_pixels < opaque_pixels * 0.10:
        raise AppError("COLOR_CHANGE_UNSUPPORTED", "Không tìm được vùng vải đủ lớn để đổi màu mà vẫn giữ họa tiết.", 422)

    dominant_h = dominant_bin * 8 + 4
    candidate_data = bytearray(len(hue_data))
    for index, (h, s, v, a) in enumerate(zip(hue_data, saturation_data, value_data, alpha_data)):
        hue_distance = abs(h - dominant_h)
        hue_distance = min(hue_distance, 256 - hue_distance)
        if a >= 220 and s >= 46 and v >= 24 and hue_distance <= 12:
            candidate_data[index] = 255
    candidate = Image.frombytes("L", image.size, bytes(candidate_data))
    coverage = sum(1 for pixel in candidate_data if pixel) / opaque_pixels
    if coverage < 0.10 or coverage > 0.94:
        raise AppError("COLOR_CHANGE_UNSUPPORTED", "Ảnh có nhiều vùng màu hoặc hoa văn gần màu vải; giữ nguyên ảnh để tránh làm sai họa tiết.", 422)

    # Keep sharp motif lines, seams and local texture out of the recolor mask.
    rgb = image.convert("RGB")
    edge_channels = [channel.filter(ImageFilter.FIND_EDGES) for channel in rgb.split()]
    edges = ImageChops.lighter(ImageChops.lighter(edge_channels[0], edge_channels[1]), edge_channels[2])
    edges = edges.point(lambda pixel: 255 if pixel > 38 else 0)
    saturation_range = ImageChops.subtract(
        saturation.filter(ImageFilter.MaxFilter(3)), saturation.filter(ImageFilter.MinFilter(3))
    )
    value_range = ImageChops.subtract(
        value.filter(ImageFilter.MaxFilter(3)), value.filter(ImageFilter.MinFilter(3))
    )
    local_range = ImageChops.lighter(saturation_range, value_range).point(lambda pixel: 255 if pixel > 24 else 0)
    protect = ImageChops.lighter(edges, local_range)
    mask = ImageChops.subtract(candidate, protect).filter(ImageFilter.MinFilter(3))
    mask = ImageChops.multiply(mask, alpha.point(lambda pixel: 255 if pixel >= 220 else 0))
    changed_pixels = sum(1 for pixel in mask.getdata() if pixel >= 200)
    if changed_pixels < opaque_pixels * 0.06:
        raise AppError("COLOR_CHANGE_UNSUPPORTED", "Vùng vải liền mạch quá nhỏ để đổi màu an toàn; ảnh được giữ nguyên.", 422)

    target_hue = round(target_h * 255)
    hue_layer = Image.new("L", image.size, target_hue)
    recolored_hue = Image.composite(hue_layer, hue, mask)
    dominant_s = max(1, sum(saturation_data[index] for index, flag in enumerate(candidate_data) if flag) // dominant_pixels)
    target_saturation = round(target_s * 255)
    scaled_s_data = bytes(min(255, round(s * target_saturation / dominant_s)) for s in saturation_data)
    scaled_saturation = Image.frombytes("L", image.size, scaled_s_data)
    recolored_saturation = Image.composite(scaled_saturation, saturation, mask)
    recolored = Image.merge("HSV", (recolored_hue, recolored_saturation, value)).convert("RGB").convert("RGBA")
    result = Image.composite(recolored, image, mask)
    result.putalpha(alpha)
    output = io.BytesIO()
    result.save(output, format="PNG", optimize=True)
    return output.getvalue()


def preview_studio_color(item_id: str, color_hex: str) -> dict:
    if len(color_hex) != 7 or color_hex[0] != "#" or any(character not in "0123456789abcdefABCDEF" for character in color_hex[1:]):
        raise AppError("INVALID_COLOR", "Màu cần đổi phải ở dạng HEX #RRGGBB.", 422)
    _, _, source_key = _published_studio_source(item_id)
    get_studio_image(item_id, color_hex)
    return {
        "supported": True,
        "image_url": f"/api/catalog/items/{item_id}/studio-image?color={color_hex.upper()}",
        "algorithm_version": _RECOLOR_VERSION,
        "source_version": source_key,
    }


def get_studio_image(item_id: str, color_hex: str | None = None,
                     source_version: str | None = None,
                     algorithm_version: str | None = None) -> bytes:
    item, media, source_key = _published_studio_source(item_id)
    if color_hex and (item.get("metadata") or {}).get("studio_recolor_approved") is not True:
        raise AppError("COLOR_CHANGE_UNSUPPORTED", "Ảnh này chưa được duyệt kiểm tra giữ họa tiết. Màu gốc được giữ nguyên.", 422)
    if color_hex and source_version and source_version != source_key:
        raise AppError("COLOR_SOURCE_CHANGED", "Ảnh gốc đã thay đổi. Hãy xem lại màu trước khi tiếp tục.", 409)
    if color_hex and algorithm_version and algorithm_version != _RECOLOR_VERSION:
        raise AppError("COLOR_ALGORITHM_CHANGED", "Cách xử lý màu đã được cập nhật. Hãy xem lại màu trước khi tiếp tục.", 409)
    if color_hex is not None and (len(color_hex) != 7 or color_hex[0] != "#" or any(character not in "0123456789abcdefABCDEF" for character in color_hex[1:])):
        raise AppError("INVALID_COLOR", "Màu cần đổi phải ở dạng HEX #RRGGBB.", 422)
    directory = Path(settings.LOCAL_MEDIA_DIR) / "studio-cutouts"
    base_target = directory / f"{source_key}.png"
    color_hash = hashlib.sha256(f"{_RECOLOR_VERSION}:{source_key}:{color_hex.upper()}".encode()).hexdigest() if color_hex else None
    target = directory / f"{color_hash or source_key}.png"
    # Publication/version checks above also apply to cache hits. Atomic cache
    # replacement lets readers bypass unrelated inference; eviction is a miss.
    acquired = False
    try:
        try:
            return target.read_bytes()
        except FileNotFoundError:
            pass
        acquired = _processing.acquire(timeout=60)
        if not acquired:
            raise AppError("CUTOUT_BUSY", "Đang xử lý ảnh, vui lòng thử lại.", 503)
        # A previous producer may have filled the cache while we waited.
        try:
            return target.read_bytes()
        except FileNotFoundError:
            pass
        if color_hex and base_target.is_file():
            base = base_target.read_bytes()
        else:
            data = r2_client.read_object(media["bucket"], media["object_key"], settings.MEDIA_IMAGE_MAX_BYTES)
            base = make_cutout(data)
            _store_cached_image(directory, base_target, base)
        result = _recolor_preserving_detail(base, color_hex) if color_hex else base
        if color_hex:
            _store_cached_image(directory, target, result)
        return result
    except AppError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise AppError("INVALID_IMAGE", "Ảnh trang phục không hợp lệ.", 422) from exc
    except Exception as exc:
        logger.warning("Studio cutout failed: %s", type(exc).__name__)
        raise AppError("CUTOUT_UNAVAILABLE", "Chưa thể tách nền ảnh. Vui lòng thử lại.", 503) from exc
    finally:
        if acquired:
            _processing.release()
