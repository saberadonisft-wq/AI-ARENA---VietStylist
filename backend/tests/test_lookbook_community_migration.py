import sqlite3
from app.core import migrations


def test_upgrade_keeps_collections_private_and_revokes_legacy_links(monkeypatch):
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    current = migrations.MIGRATIONS
    try:
        with monkeypatch.context() as patch:
            patch.setattr(migrations, 'MIGRATIONS', current[:-1])
            migrations.run_migrations(conn)
        conn.execute("INSERT INTO accounts(id,email,display_name) VALUES('owner','owner@example.invalid','Owner')")
        conn.execute("INSERT INTO lookbooks(id,owner_id,title,visibility) VALUES('private','owner','Personal','private')")
        conn.execute("INSERT INTO lookbooks(id,owner_id,title,visibility) VALUES('unlisted','owner','Shared','unlisted')")
        for book in ['private', 'unlisted']:
            conn.execute('INSERT INTO share_links(id,lookbook_id,token_hash,token_plain_prefix) VALUES(?,?,?,?)', (book,book,'hash-'+book,book))
        conn.commit()
        migrations.run_migrations(conn)
        assert migrations.verify_schema(conn)
        assert conn.execute('SELECT count(*) FROM lookbook_posts').fetchone()[0] == 0
        assert conn.execute("SELECT title,visibility FROM lookbooks WHERE id='private'").fetchone()[:] == ('Personal','private')
        assert conn.execute("SELECT is_revoked FROM share_links WHERE id='private'").fetchone()[0] == 1
        assert conn.execute("SELECT is_revoked FROM share_links WHERE id='unlisted'").fetchone()[0] == 0
        before = conn.total_changes
        migrations.run_migrations(conn)
        assert conn.total_changes == before
        conn.execute('DROP TABLE lookbook_public_profiles')
        assert not migrations.verify_schema(conn)
    finally:
        conn.close()
