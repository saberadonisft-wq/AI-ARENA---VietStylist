#!/usr/bin/env python3
"""
CLI script dọn dẹp các session upload media quá hạn (O06).
Hỗ trợ:
  python backend/scripts/cleanup_staged_media.py [--ttl-minutes 60] [--dry-run]
"""
import argparse
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Setup Windows console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import get_db_connection
from app.modules.media.repository import MediaRepository
from app.infrastructure.r2.client import R2StorageClient


def cleanup_staged_media(ttl_minutes: int = 60, dry_run: bool = False):
    print("=================================================================")
    print(f"      DỌN DẸP MEDIA STAGING QUÁ HẠN (TTL: {ttl_minutes} phút)      ")
    print("=================================================================")
    stale_items = MediaRepository.get_stale_pending_media(older_than_seconds=ttl_minutes * 60)

    if not stale_items:
        print("Không có media staging quá hạn nào cần dọn dẹp.")
        return 0

    print(f"Tìm thấy {len(stale_items)} session media pending quá hạn:")
    cleaned_count = 0
    storage = R2StorageClient()

    for item in stale_items:
        media_id = item["id"]
        bucket = item["bucket"]
        key = item["storage_key"]
        created = item["created_at"]
        print(f"  - [{media_id}] Bucket: {bucket} | Key: {key} | Tạo lúc: {created}")

        if not dry_run:
            # 1. Thử xóa file vật lý nếu đã có trong staging
            try:
                storage.delete_file(bucket, key)
            except Exception as e:
                print(f"    [WARN] Không thể xóa file vật lý ({bucket}/{key}): {e}")

            # 2. Xóa record pending trong DB
            with get_db_connection() as conn:
                conn.execute("DELETE FROM media_assets WHERE id = ? AND status = 'pending'", (media_id,))
                conn.commit()
            cleaned_count += 1

    if dry_run:
        print(f"\n[DRY RUN] Đã mô phỏng dọn dẹp {len(stale_items)} media items (không thay đổi DB).")
    else:
        print(f"\n[HOÀN THÀNH] Đã dọn dẹp thành công {cleaned_count} media items quá hạn.")

    return len(stale_items)


def main():
    parser = argparse.ArgumentParser(description="Dọn dẹp các session upload media pending quá hạn (O06).")
    parser.add_argument("--ttl-minutes", type=int, default=60, help="Thời gian sống tối đa của pending upload (phút). Mặc định: 60.")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm không thực sự xóa dữ liệu.")

    args = parser.parse_args()
    cleanup_staged_media(ttl_minutes=args.ttl_minutes, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
