#!/usr/bin/env python3
"""Score recolor outputs against reviewer-created masks; never changes catalog approval."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
os.environ.setdefault("VIETSTYLIST_IGNORE_DOTENV", "1")

from app.modules.catalog.recolor_evaluation import evaluate_manifest  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="JSON manifest with source images and independent masks")
    parser.add_argument("--report", type=Path, help="Optional path for the JSON report")
    args = parser.parse_args()
    try:
        report = evaluate_manifest(args.manifest)
    except (OSError, ValueError) as error:
        print(f"Không thể đánh giá bộ ảnh đổi màu: {error}", file=sys.stderr)
        return 2
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    if not report["qualifies_for_review"]:
        print("Recolor chưa đủ bằng chứng ảnh thật; không được bật đổi màu ảnh chụp.", file=sys.stderr)
        return 2
    print("Đạt ngưỡng kỹ thuật để stylist xem xét riêng; script không tự duyệt catalog.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
