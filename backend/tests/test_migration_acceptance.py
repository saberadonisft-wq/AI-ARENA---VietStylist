import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import pytest
from app.core.database import SQLITE_INIT_DDL
from app.core.migrations import run_migrations, verify_schema, preflight, MIGRATIONS


def connection():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def test_fresh_repeat_and_checksum_tamper():
    conn = connection()
    try:
        run_migrations(conn)
        assert verify_schema(conn)
        before = conn.total_changes
        run_migrations(conn)
        assert conn.total_changes == before
        conn.execute(
            "UPDATE schema_migrations SET checksum='tampered' WHERE version='001_initial_schema'"
        )
        conn.commit()
        with pytest.raises(RuntimeError, match="checksum mismatch"):
            run_migrations(conn)
        assert not verify_schema(conn)
    finally:
        conn.close()


def test_old_duplicate_preflight_preserves_all_data():
    conn = connection()
    try:
        conn.executescript(SQLITE_INIT_DDL)
        conn.executemany(
            "INSERT INTO solution_forms(id,owner_id,problem_statement) VALUES(?,'owner',?)",
            [("first", "A"), ("second", "B")],
        )
        conn.commit()
        before = list(conn.iterdump())
        assert preflight(conn)["duplicate_solution_forms"][0]["count"] == 2
        with pytest.raises(RuntimeError, match="preflight blocked"):
            run_migrations(conn)
        assert list(conn.iterdump()) == before
    finally:
        conn.close()


def test_explicit_duplicate_reconciliation_archives_all_fields():
    from scripts.migrate import reconcile_forms

    conn = connection()
    try:
        conn.executescript(SQLITE_INIT_DDL)
        conn.executemany(
            "INSERT INTO solution_forms(id,owner_id,problem_statement) VALUES(?,'owner',?)",
            [("first", "A"), ("second", "B")],
        )
        conn.commit()
        run_migrations(conn, lambda c: reconcile_forms(c, {"owner": "second"}))
        assert verify_schema(conn)
        assert conn.execute("SELECT id FROM solution_forms").fetchone()[0] == "second"
        archived = json.loads(
            conn.execute("SELECT row_json FROM solution_forms_archive").fetchone()[0]
        )
        assert archived["id"] == "first" and archived["problem_statement"] == "A"
    finally:
        conn.close()


def test_partial_legacy_markers_replay_missing_indexes():
    conn = connection()
    try:
        conn.executescript(SQLITE_INIT_DDL)
        conn.execute(
            "INSERT INTO schema_migrations(version,description) VALUES('004_performance_indexes','legacy')"
        )
        conn.commit()
        run_migrations(conn)
        assert verify_schema(conn)
        assert conn.execute(
            "SELECT 1 FROM sqlite_master WHERE name='idx_items_slot_pub'"
        ).fetchone()
    finally:
        conn.close()


def test_migration_failure_rolls_back_every_marker(monkeypatch):
    import app.core.migrations as migrations

    conn = connection()

    def failure(conn):
        conn.execute("CREATE TABLE should_rollback(id TEXT)")
        raise RuntimeError("injected failure")

    try:
        monkeypatch.setattr(
            migrations, "MIGRATIONS", [*MIGRATIONS, ("007_failure", failure)]
        )
        with pytest.raises(RuntimeError, match="injected failure"):
            run_migrations(conn)
        assert (
            conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            == []
        )
    finally:
        conn.close()


def test_cli_dry_run_is_read_only_and_reports_duplicates(tmp_path):
    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.executescript(SQLITE_INIT_DDL)
    conn.executemany(
        "INSERT INTO solution_forms(id,owner_id) VALUES(?,'owner')",
        [("first",), ("second",)],
    )
    conn.commit()
    conn.close()
    before = path.read_bytes()
    env = {**os.environ, "DATABASE_URL": "sqlite:///" + str(path)}
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts" / "migrate.py"), "--dry-run"],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 2, result.stderr
    assert json.loads(result.stdout)["duplicate_solution_forms"][0]["count"] == 2
    assert path.read_bytes() == before


def test_cli_upgrade_backup_and_restore(tmp_path):
    path = tmp_path / "upgrade.db"
    conn = sqlite3.connect(path)
    conn.executescript(SQLITE_INIT_DDL)
    conn.execute(
        "INSERT INTO solution_forms(id,owner_id,problem_statement) VALUES('first','owner','retained content')"
    )
    conn.commit()
    conn.close()
    env = {**os.environ, "DATABASE_URL": "sqlite:///" + str(path)}
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve().parents[1] / "scripts" / "migrate.py")],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    backups = list(tmp_path.glob("upgrade.db.*.bak"))
    assert len(backups) == 1
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    assert verify_schema(conn)
    conn.close()
    restored = sqlite3.connect(tmp_path / "restored.db")
    backup = sqlite3.connect(backups[0])
    try:
        backup.backup(restored)
        assert (
            restored.execute(
                "SELECT problem_statement FROM solution_forms WHERE id='first'"
            ).fetchone()[0]
            == "retained content"
        )
        assert (
            restored.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0]
            == 0
        )
    finally:
        backup.close()
        restored.close()


def test_seed_preserves_legacy_source_reference_without_duplicate():
    from app.core.database import Database, init_database
    row=Database.fetch_one("SELECT * FROM article_sources LIMIT 1")
    Database.execute("UPDATE article_sources SET id='legacy-source-reference' WHERE id=?",(row["id"],))
    before=Database.fetch_one("SELECT COUNT(*) AS n FROM article_sources")["n"]
    init_database()
    init_database()
    assert Database.fetch_one("SELECT COUNT(*) AS n FROM article_sources")["n"]==before
    assert Database.fetch_one("SELECT * FROM article_sources WHERE id='legacy-source-reference'")
