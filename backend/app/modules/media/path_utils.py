import os
from pathlib import Path
from app.core.config import settings
from app.core.errors import AppError


def safe_join_media_path(base_dir: str, bucket: str, key_or_path: str) -> str:
    if bucket not in {settings.R2_BUCKET_PUBLIC, settings.R2_BUCKET_PRIVATE}:
        raise AppError("INVALID_BUCKET", "Bucket không hợp lệ", 400)
    parts = key_or_path.split("/")
    reserved = {
        "CON",
        "PRN",
        "AUX",
        "NUL",
        *(f"COM{i}" for i in range(1, 10)),
        *(f"LPT{i}" for i in range(1, 10)),
    }
    for part in [bucket, *parts]:
        if (
            not part
            or part in (".", "..")
            or part.endswith((".", " "))
            or any(ord(c) < 32 or c in ':\\/<>"|?*' for c in part)
            or part.split(".")[0].upper() in reserved
        ):
            raise AppError("INVALID_PATH", "Đường dẫn không an toàn", 400)
    base = Path(os.path.abspath(base_dir))
    target = base.joinpath(bucket, *parts)
    # Resolve containment AND reject links/reparse points, including Windows junctions.
    for candidate in [target, *target.parents]:
        if candidate.is_symlink() or (
            hasattr(candidate, "is_junction") and candidate.is_junction()
        ):
            raise AppError("INVALID_PATH", "Không cho phép liên kết filesystem", 400)
    try:
        target.resolve().relative_to((base / bucket).resolve())
    except (ValueError, OSError):
        raise AppError("INVALID_PATH", "Đường dẫn vượt ngoài vùng media", 400)
    return str(target)
