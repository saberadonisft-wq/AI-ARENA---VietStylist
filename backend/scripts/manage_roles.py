#!/usr/bin/env python3
"""
Script quản trị vai trò người dùng (manage_roles.py).
Dành cho người vận hành cấp/thu hồi vai trò (admin, editor, stylist, user).
Hỗ trợ kiểm tra tài khoản, dry-run, audit log và transaction.
"""

import sys
import os
import argparse
import uuid
from datetime import datetime, timezone

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from app.core.database import Database, get_db_connection

ALLOWED_ROLES = {"admin", "editor", "stylist", "user"}


def get_account(identifier: str):
    """Tìm tài khoản theo id hoặc email."""
    account = Database.fetch_one(
        "SELECT id, email, display_name, is_active FROM accounts WHERE id = ? OR email = ?",
        (identifier, identifier.lower()),
    )
    return account


def get_roles(user_id: str):
    """Lấy danh sách roles của user_id."""
    rows = Database.fetch_all("SELECT role FROM user_roles WHERE user_id = ?", (user_id,))
    return [r["role"] for r in rows if "role" in r]


def cmd_list(args):
    account = get_account(args.user)
    if not account:
        print(f"LỖI: Không tìm thấy tài khoản với định danh '{args.user}'", file=sys.stderr)
        sys.exit(1)
    roles = get_roles(account["id"])
    print(f"User ID:      {account['id']}")
    print(f"Email:        {account['email']}")
    print(f"Display Name: {account['display_name']}")
    print(f"Active:       {'Có' if account['is_active'] else 'Không'}")
    print(f"Roles:        {', '.join(roles) if roles else '(none)'}")


def cmd_grant(args):
    role = args.role.lower()
    if role not in ALLOWED_ROLES:
        print(f"LỖI: Role '{role}' không hợp lệ. Cho phép: {', '.join(sorted(ALLOWED_ROLES))}", file=sys.stderr)
        sys.exit(1)

    account = get_account(args.user)
    if not account:
        print(f"LỖI: Không tìm thấy tài khoản với định danh '{args.user}'", file=sys.stderr)
        sys.exit(1)

    user_id = account["id"]
    current_roles = get_roles(user_id)
    if role in current_roles:
        print(f"THÔNG BÁO: Người dùng {account['email']} ({user_id}) đã có vai trò '{role}'.")
        return

    if args.dry_run:
        print(f"[DRY-RUN] Sẽ cấp vai trò '{role}' cho {account['email']} ({user_id}).")
        return

    with get_db_connection() as conn:
        role_id = f"ur_{uuid.uuid4().hex[:12]}"
        conn.execute(
            "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
            (role_id, user_id, role),
        )
        conn.commit()

    now_str = datetime.now(timezone.utc).isoformat()
    print(f"[{now_str}] AUDIT: Đã cấp vai trò '{role}' cho người dùng {account['email']} ({user_id}).")
    print(f"Roles hiện tại: {', '.join(get_roles(user_id))}")


def cmd_revoke(args):
    role = args.role.lower()
    if role not in ALLOWED_ROLES:
        print(f"LỖI: Role '{role}' không hợp lệ. Cho phép: {', '.join(sorted(ALLOWED_ROLES))}", file=sys.stderr)
        sys.exit(1)

    account = get_account(args.user)
    if not account:
        print(f"LỖI: Không tìm thấy tài khoản với định danh '{args.user}'", file=sys.stderr)
        sys.exit(1)

    user_id = account["id"]
    current_roles = get_roles(user_id)
    if role not in current_roles:
        print(f"THÔNG BÁO: Người dùng {account['email']} ({user_id}) không có vai trò '{role}'.")
        return

    if args.dry_run:
        print(f"[DRY-RUN] Sẽ thu hồi vai trò '{role}' từ {account['email']} ({user_id}).")
        return

    with get_db_connection() as conn:
        conn.execute(
            "DELETE FROM user_roles WHERE user_id = ? AND role = ?",
            (user_id, role),
        )
        conn.commit()

    now_str = datetime.now(timezone.utc).isoformat()
    print(f"[{now_str}] AUDIT: Đã thu hồi vai trò '{role}' từ người dùng {account['email']} ({user_id}).")
    print(f"Roles hiện tại: {', '.join(get_roles(user_id))}")


def main():
    parser = argparse.ArgumentParser(description="Quản lý vai trò (roles) người dùng VietStylist.")
    subparsers = parser.add_subparsers(dest="action", required=True)

    # list
    p_list = subparsers.add_parser("list", help="Xem danh sách vai trò của một tài khoản")
    p_list.add_argument("user", help="User ID (usr_...) hoặc Email")

    # grant
    p_grant = subparsers.add_parser("grant", help="Cấp một vai trò cho tài khoản")
    p_grant.add_argument("user", help="User ID (usr_...) hoặc Email")
    p_grant.add_argument("role", help="Tên vai trò (admin, editor, stylist, user)")
    p_grant.add_argument("--dry-run", action="store_true", help="Chạy thử không ghi vào CSDL")

    # revoke
    p_revoke = subparsers.add_parser("revoke", help="Thu hồi một vai trò từ tài khoản")
    p_revoke.add_argument("user", help="User ID (usr_...) hoặc Email")
    p_revoke.add_argument("role", help="Tên vai trò (admin, editor, stylist, user)")
    p_revoke.add_argument("--dry-run", action="store_true", help="Chạy thử không ghi vào CSDL")

    args = parser.parse_args()
    if args.action == "list":
        cmd_list(args)
    elif args.action == "grant":
        cmd_grant(args)
    elif args.action == "revoke":
        cmd_revoke(args)


if __name__ == "__main__":
    main()
