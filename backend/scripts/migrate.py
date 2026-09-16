#!/usr/bin/env python3
"""
Script chạy migration CSDL cho VietStylist (migrate.py).
Hỗ trợ kiểm tra schema_migrations, dry-run và áp dụng các bước nâng cấp CSDL.
"""

import sys
import os
import argparse
from datetime import datetime, timezone

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from app.core.database import get_db_connection, run_migrations


def check_migrations():
    """Kiểm tra danh sách các migration đã áp dụng."""
    with get_db_connection() as conn:
        # Check if schema_migrations table exists
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
        if not cur.fetchone():
            print("Bảng 'schema_migrations' chưa tồn tại. Chưa có migration nào được áp dụng.")
            return []

        rows = conn.execute("SELECT version, description, applied_at FROM schema_migrations ORDER BY version ASC").fetchall()
        print(f"Tổng số migrations đã áp dụng: {len(rows)}")
        for r in rows:
            print(f"  [{r['applied_at']}] {r['version']}: {r['description']}")
        return rows


def apply_migrations(dry_run: bool = False):
    """Áp dụng các migration còn thiếu."""
    if dry_run:
        print("[DRY-RUN] Kiểm tra migration...")
        check_migrations()
        return

    with get_db_connection() as conn:
        run_migrations(conn)

    print("Đã hoàn tất kiểm tra và áp dụng migrations.")
    check_migrations()


def main():
    parser = argparse.ArgumentParser(description="Chạy và kiểm tra migration CSDL SQLite của VietStylist.")
    parser.add_argument("--check", action="store_true", help="Chỉ kiểm tra danh sách migration đã áp dụng")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm không áp dụng thay đổi")

    args = parser.parse_args()

    if args.check:
        check_migrations()
    else:
        apply_migrations(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
