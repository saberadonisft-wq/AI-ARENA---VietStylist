"""Add only occasion reference data; preserve existing rows and all other tables."""
import json
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def seed_occasions(conn):
    # Use the same records as fresh SQLite installs, without importing demo
    # users, garments, or cultural assertions from the rest of the seed file.
    source = (Path(__file__).resolve().parents[1] / "app/data/seed.sql").read_text(encoding="utf-8")
    statements = re.findall(r"INSERT INTO occasions\s+\(.*?ON CONFLICT \(id\) DO NOTHING;", source, re.DOTALL)
    if len(statements) != 1:
        raise ValueError("Expected exactly one idempotent occasions seed statement")
    before = conn.execute("SELECT COUNT(*) AS total FROM occasions").fetchone()["total"]
    conn.execute(statements[0])
    after = conn.execute("SELECT COUNT(*) AS total FROM occasions").fetchone()["total"]
    return {"inserted": after - before, "total": after}


def main():
    from app.core.config import settings
    from app.core.database import db_transaction

    try:
        with db_transaction() as conn:
            report = seed_occasions(conn)
        print(json.dumps(report))
        return 0
    except Exception as exc:
        # Do not print a database URL or credentials if connecting fails.
        print(json.dumps({"error_type": type(exc).__name__, "message": "Could not add occasions; transaction rolled back."}))
        return 1
    finally:
        if settings.is_postgres():
            from app.core.postgres import close_pool
            close_pool()


if __name__ == "__main__":
    raise SystemExit(main())
