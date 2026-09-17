"""Validate actual bytes before promoting an upload to its immutable final key."""

import io
import json
import re
import subprocess
import tempfile
import warnings
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, UnidentifiedImageError
from app.core.config import settings
from app.core.errors import AppError

TYPES = {
    ".jpg": ("image/jpeg", "image"),
    ".jpeg": ("image/jpeg", "image"),
    ".png": ("image/png", "image"),
    ".webp": ("image/webp", "image"),
    ".svg": ("image/svg+xml", "image"),
    ".mp4": ("video/mp4", "video"),
}


def byte_limit(media_type):
    return (
        settings.MEDIA_VIDEO_MAX_BYTES
        if media_type == "video"
        else settings.MEDIA_IMAGE_MAX_BYTES
    )


def validate_content(data, mime_type):
    if not data:
        raise AppError("INVALID_MEDIA_CONTENT", "File rỗng", 422)
    if len(data) > byte_limit("video" if mime_type == "video/mp4" else "image"):
        raise AppError("PAYLOAD_TOO_LARGE", "File vượt giới hạn dung lượng", 413)
    if mime_type == "image/svg+xml":
        return validate_svg(data)
    if mime_type == "video/mp4":
        return validate_video(data)
    formats = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as picture:
                if (
                    picture.format != formats.get(mime_type)
                    or getattr(picture, "n_frames", 1) != 1
                ):
                    raise ValueError("Unexpected image format or animation")
                width, height = picture.size
                if width * height > settings.MEDIA_MAX_PIXELS:
                    raise ValueError("Pixel limit exceeded")
                picture.load()
                output = io.BytesIO()
                # Decode and re-encode: discard appended bytes and untrusted metadata.
                picture.save(output, format=formats[mime_type])
                clean = output.getvalue()
                if len(clean) > settings.MEDIA_IMAGE_MAX_BYTES:
                    raise ValueError("Normalized file too large")
                return clean, width, height, None
    except (
        OSError,
        ValueError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise AppError(
            "INVALID_MEDIA_CONTENT",
            "Nội dung ảnh không hợp lệ hoặc vượt giới hạn pixel",
            422,
        ) from exc


def validate_svg(data):
    allowed_tags = {
        "svg",
        "g",
        "path",
        "rect",
        "circle",
        "ellipse",
        "line",
        "polyline",
        "polygon",
        "title",
        "desc",
    }
    allowed_attrs = {
        "width",
        "height",
        "viewBox",
        "d",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "points",
        "fill",
        "stroke",
        "stroke-width",
        "opacity",
        "fill-opacity",
        "stroke-opacity",
        "transform",
        "fill-rule",
        "stroke-linecap",
        "stroke-linejoin",
    }
    try:
        text = data.decode("utf-8")
        if "<!" in text or "<?" in text:
            raise ValueError("Active SVG is forbidden")
        root = ET.fromstring(text)
        if root.tag not in ("svg", "{http://www.w3.org/2000/svg}svg"):
            raise ValueError("Not SVG")
        for index, element in enumerate(root.iter()):
            if (
                index > 10000
                or element.tag.removeprefix("{http://www.w3.org/2000/svg}")
                not in allowed_tags
            ):
                raise ValueError("Unsupported SVG element")
            if any(
                re.search(r"url\s*\(|(?:https?|data|javascript):|\\", value, re.I)
                for value in element.attrib.values()
            ):
                raise ValueError("External SVG reference")
            if any(key not in allowed_attrs for key in element.attrib):
                raise ValueError("Unsupported SVG attribute")
        return ET.tostring(root, encoding="utf-8"), None, None, None
    except (UnicodeError, ET.ParseError, ValueError) as exc:
        raise AppError(
            "INVALID_MEDIA_CONTENT", "SVG chỉ hỗ trợ hình học tĩnh trong allowlist", 422
        ) from exc


def validate_video(data):
    if len(data) < 12 or data[4:8] != b"ftyp":
        raise AppError("INVALID_MEDIA_CONTENT", "Container MP4 không hợp lệ", 422)
    with tempfile.TemporaryDirectory(prefix="vietstylist-video-") as temporary:
        path = Path(temporary) / "upload.mp4"
        path.write_bytes(data)
        try:
            result = subprocess.run(
                [
                    settings.FFPROBE_PATH,
                    "-v",
                    "error",
                    "-protocol_whitelist",
                    "file,pipe",
                    "-count_frames",
                    "-show_entries",
                    "stream=codec_type,width,height,nb_read_frames:format=duration,format_name",
                    "-of",
                    "json",
                    str(path),
                ],
                capture_output=True,
                timeout=30,
                check=True,
            )
        except FileNotFoundError as exc:
            raise AppError(
                "VIDEO_VALIDATOR_UNAVAILABLE", "Máy chủ chưa cấu hình ffprobe", 503
            ) from exc
        except (subprocess.SubprocessError, OSError) as exc:
            raise AppError(
                "INVALID_MEDIA_CONTENT", "Không xác minh được video", 422
            ) from exc
        try:
            if result.stderr:
                raise ValueError("Video decoder reported errors")
            info = json.loads(result.stdout)
            videos = [v for v in info["streams"] if v["codec_type"] == "video"]
            duration = float(info["format"]["duration"])
            if (
                len(videos) != 1
                or int(videos[0].get("nb_read_frames", 0)) < 1
                or not 0 < duration <= 600
                or "mp4" not in info["format"]["format_name"]
            ):
                raise ValueError("Unsupported container")
            width, height = videos[0]["width"], videos[0]["height"]
            if not 0 < width * height <= settings.MEDIA_MAX_PIXELS:
                raise ValueError("Pixel limit exceeded")
            return data, width, height, int(duration * 1000)
        except (KeyError, TypeError, ValueError) as exc:
            raise AppError(
                "INVALID_MEDIA_CONTENT", "Metadata video không hợp lệ", 422
            ) from exc
