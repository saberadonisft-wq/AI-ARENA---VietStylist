"""Explicit migrations with read-only preflight, backup and opt-in duplicate reconciliation."""

import argparse
from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import SQLITE_DB_PATH
from app.core.migrations import MIGRATIONS, preflight, run_migrations, verify_schema


def connect(path, readonly=False):
    conn = (
        sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True)
        if readonly
        else sqlite3.connect(path)
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def reconcile_forms(conn, choices):
    duplicates = preflight(conn)["duplicate_solution_forms"]
    if set(choices) != {r["owner_id"] for r in duplicates}:
        raise ValueError("Provide exactly one explicit keep-id per duplicate owner")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS solution_forms_archive (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,row_json TEXT NOT NULL,archived_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    for group in duplicates:
        rows = list(
            conn.execute(
                "SELECT * FROM solution_forms WHERE owner_id=?", (group["owner_id"],)
            )
        )
        if choices[group["owner_id"]] not in {r["id"] for r in rows}:
            raise ValueError("Selected keep-id does not belong to this owner")
        for row in rows:
            if row["id"] != choices[group["owner_id"]]:
                conn.execute(
                    "INSERT INTO solution_forms_archive(id,owner_id,row_json) VALUES(?,?,?)",
                    (
                        row["id"],
                        row["owner_id"],
                        json.dumps(dict(row), ensure_ascii=False),
                    ),
                )
                conn.execute("DELETE FROM solution_forms WHERE id=?", (row["id"],))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument(
        "--resolve-forms",
        type=Path,
        help="JSON mapping owner_id to explicitly selected form id; all other copies are archived",
    )
    args = parser.parse_args()
    path = Path(SQLITE_DB_PATH)
    choices = (
        json.loads(args.resolve_forms.read_text(encoding="utf-8"))
        if args.resolve_forms
        else None
    )
    # Validate the entire upgrade on an in-memory clone, without writing source DB.
    clone = sqlite3.connect(":memory:")
    clone.row_factory = sqlite3.Row
    clone.execute("PRAGMA foreign_keys=ON")
    try:
        if path.exists():
            with closing(connect(path, True)) as source:
                source.backup(clone)
        report = preflight(clone)
        report["schema_ready"] = verify_schema(clone)
        if args.check:
            print(json.dumps(report, ensure_ascii=False))
            return 0 if report["schema_ready"] else 1
        try:
            run_migrations(
                clone,
                (
                    (lambda c: reconcile_forms(c, choices))
                    if choices is not None
                    else None
                ),
            )
            report["upgrade_valid"] = True
        except Exception as exc:
            report["upgrade_valid"] = False
            report["reason"] = str(exc)
        print(json.dumps(report, ensure_ascii=False))
        if args.dry_run or not report["upgrade_valid"]:
            return 0 if report["upgrade_valid"] else 2
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = connect(path)
        try:
            backup = path.with_name(
                path.name
                + "."
                + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
                + ".bak"
            )
            with closing(sqlite3.connect(backup)) as target:
                conn.backup(target)
            print("Backup:", backup)
            run_migrations(
                conn,
                (
                    (lambda c: reconcile_forms(c, choices))
                    if choices is not None
                    else None
                ),
            )
        finally:
            conn.close()
        return 0
    finally:
        clone.close()


if __name__ == "__main__":
    raise SystemExit(main())
