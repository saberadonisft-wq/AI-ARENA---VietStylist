#!/usr/bin/env python3
"""
CLI script để xuất tài liệu OpenAPI schema canonical từ FastAPI application và kiểm tra drift (R10).
Hỗ trợ:
  python backend/scripts/export_openapi.py [--check] [--output shared/openapi.json]
"""
import argparse
import json
import os
import sys
from pathlib import Path

# Reconfigure stdout/stderr for Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Cấu hình môi trường an toàn trước khi import app, không chạm DB/storage thật hay network
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "production")
os.environ.setdefault("DEBUG", "false")
os.environ.setdefault("LOCAL_MEDIA_ENABLED", "false")
os.environ.setdefault("SUPABASE_JWT_SECRET", "super-secret-production-jwt-signing-key-minimum-32-chars-ok")
os.environ.setdefault("FRONTEND_PUBLIC_ORIGIN", "https://vietstylist.vn")
os.environ.setdefault("API_PUBLIC_ORIGIN", "https://api.vietstylist.vn")

# Đảm bảo backend root nằm trong sys.path
backend_dir = Path(__file__).resolve().parent.parent
repo_root = backend_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app


def get_canonical_openapi() -> dict:
    """Tạo canonical OpenAPI schema từ FastAPI app."""
    schema = app.openapi()
    return schema


def main():
    parser = argparse.ArgumentParser(
        description="Xuất canonical OpenAPI JSON schema hoặc kiểm tra lệch hợp đồng (OpenAPI contract drift)."
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=str(repo_root / "shared" / "openapi.json"),
        help="Đường dẫn file đích (mặc định: shared/openapi.json tại repo root).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Chế độ kiểm tra (exit 1 nếu schema bị lệch, KHÔNG ghi đè file).",
    )

    args = parser.parse_args()
    target_path = Path(args.output).resolve()

    schema = get_canonical_openapi()
    formatted_schema = json.dumps(schema, indent=2, ensure_ascii=False) + "\n"

    if args.check:
        if not target_path.exists():
            print(f"[DRIFT ERROR] File OpenAPI target không tồn tại: {target_path}", file=sys.stderr)
            sys.exit(1)

        with open(target_path, "r", encoding="utf-8") as f:
            existing_content = f.read()

        try:
            existing_json = json.loads(existing_content)
        except Exception as e:
            print(f"[DRIFT ERROR] File OpenAPI hiện tại không hợp lệ JSON: {e}", file=sys.stderr)
            sys.exit(1)

        # So sánh cấu trúc JSON
        if existing_json != schema:
            print(f"[DRIFT ERROR] OpenAPI contract bị lệch so với mã nguồn runtime!", file=sys.stderr)
            print(f"Chạy 'python backend/scripts/export_openapi.py' để cập nhật.", file=sys.stderr)
            sys.exit(1)

        print(f"[OK] OpenAPI contract đồng bộ hoàn toàn với runtime (không có drift).")
        sys.exit(0)
    else:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(formatted_schema)
        print(f"[SUCCESS] Đã xuất OpenAPI canonical schema thành công vào: {target_path}")
        sys.exit(0)


if __name__ == "__main__":
    main()
