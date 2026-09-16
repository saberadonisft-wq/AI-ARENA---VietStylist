import os
from app.core.config import settings
from app.core.errors import AppError


def safe_join_media_path(base_dir: str, bucket: str, key_or_path: str) -> str:
    """
    Kiểm tra và chuẩn hóa đường dẫn lưu trữ media:
    - Bucket phải thuộc allowlist (R2_BUCKET_PUBLIC, R2_BUCKET_PRIVATE)
    - Key không được chứa ký tự điều khiển, NUL, ':', '\\', hoặc đoạn '..'
    - Đường dẫn tuyệt đối đích bắt buộc phải nằm bên trong thư mục bucket/base_dir
    """
    allowed_buckets = {settings.R2_BUCKET_PUBLIC, settings.R2_BUCKET_PRIVATE}
    if bucket not in allowed_buckets:
        raise AppError(code="INVALID_BUCKET", message=f"Bucket '{bucket}' không được phép.", status_code=400)

    if not key_or_path:
        raise AppError(code="INVALID_PATH", message="Đường dẫn không được rỗng.", status_code=400)

    if "\0" in key_or_path or ":" in key_or_path or "\\" in key_or_path:
        raise AppError(code="INVALID_PATH", message="Đường dẫn chứa ký tự không hợp lệ.", status_code=400)

    parts = [p for p in key_or_path.strip("/").split("/") if p]
    if not parts or any(p in (".", "..") for p in parts):
        raise AppError(code="INVALID_PATH", message="Đường dẫn chứa thành phần không an toàn.", status_code=400)

    base_abs = os.path.abspath(base_dir)
    bucket_abs = os.path.abspath(os.path.join(base_abs, bucket))
    target_abs = os.path.abspath(os.path.join(bucket_abs, *parts))

    if not (target_abs == bucket_abs or target_abs.startswith(bucket_abs + os.sep)):
        raise AppError(code="PATH_TRAVERSAL_DETECTED", message="Phát hiện đường dẫn vượt cấp ngoài thư mục media.", status_code=403)

    return target_abs
