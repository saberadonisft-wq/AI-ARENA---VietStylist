import json
import os
import sqlite3
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import Database
from app.main import app
from app.modules.catalog.repository import CatalogRepository
from app.modules.outfits.repository import OutfitRepository
from conftest import auth_header


def test_catalog_filters_keep_each_published_item_once():
    garment = Database.fetch_one('SELECT id FROM garment_types LIMIT 1')['id']
    occasion_ids = [row['id'] for row in Database.fetch_all('SELECT id FROM occasions LIMIT 2')]
    for identifier, published in [('query-one', 1), ('query-two', 1), ('query-hidden', 0)]:
        Database.execute('INSERT INTO items(id,garment_type_id,name,slot,is_published) VALUES(?,?,?,\'outerwear\',?)',
                         (identifier, garment, 'DB query fixture ' + identifier, published))
    for index, occasion in enumerate(occasion_ids):
        Database.execute('INSERT INTO item_occasions(id,item_id,occasion_id) VALUES(?,\'query-one\',?)', (f'query-occasion-{index}', occasion))
    assert {row['id'] for row in CatalogRepository.get_items(search='DB query fixture')} == {'query-one', 'query-two'}
    assert [row['id'] for row in CatalogRepository.get_items(search='DB query fixture', occasion_id=occasion_ids[0])] == ['query-one']


def test_outfit_and_version_cursors_keep_ties_and_owner_boundaries():
    owner = 'dev-user-test-1'
    for index in range(5):
        OutfitRepository.create_outfit_atomic(f'page-{index}', owner, 'Page', None, 'traditional', f'page-version-{index}', '{"items":[]}')
    OutfitRepository.create_outfit_atomic('page-foreign', 'dev-user-123', 'Foreign', None, 'traditional', 'page-foreign-version', '{"items":[]}')
    Database.execute('UPDATE outfits SET is_deleted=1 WHERE id=\'page-0\'')
    client = TestClient(app)
    headers = {'Authorization': auth_header(owner)}
    first = client.get('/api/outfits/page?limit=2', headers=headers).json()
    second = client.get('/api/outfits/page', params={'limit': 2, 'cursor': first['next_cursor']}, headers=headers).json()
    assert [row['id'] for row in first['items'] + second['items']] == ['page-4', 'page-3', 'page-2', 'page-1']
    assert second['next_cursor'] is None
    assert client.get('/api/outfits/count', headers=headers).json() == {'count': 4}
    assert client.get('/api/outfits/page', params={'cursor': first['next_cursor']}, headers={'Authorization': auth_header('dev-user-123')}).status_code == 422
    assert client.get('/api/outfits/page?cursor=broken', headers=headers).status_code == 422
    assert client.get('/api/outfits/page').status_code == 401
    for number in range(2, 6):
        Database.execute('INSERT INTO outfit_versions(id,outfit_id,version_number,snapshot_json) VALUES(?,\'page-4\',?,\'{"items":[]}\')', (f'history-{number}', number))
    history = client.get('/api/outfits/page-4/versions?limit=3', headers=headers).json()
    more = client.get('/api/outfits/page-4/versions', params={'limit': 3, 'cursor': history['next_cursor']}, headers=headers).json()
    assert [row['version_number'] for row in history['items'] + more['items']] == [5, 4, 3, 2, 1]
    assert more['next_cursor'] is None
    assert client.get('/api/outfits/page-foreign/versions', headers=headers).status_code == 404
    assert client.get('/api/outfits/page-0/versions', headers=headers).status_code == 404


def test_upgrade_backfills_gallery_and_tracks_receipt_changes(monkeypatch):
    from app.core import migrations
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        with monkeypatch.context() as patch:
            patch.setattr(migrations, 'MIGRATIONS', migrations.MIGRATIONS[:14])
            migrations.run_migrations(conn)
        for identifier, owner in [('backfill-image', 'owner'), ('foreign-image', 'foreign')]:
            conn.execute("INSERT INTO media_assets(id,owner_id,bucket,object_key,media_type,mime_type,status) VALUES(?,?,'private',?,'image','image/png','ready')", (identifier, owner, identifier))
        for identifier, inputs, result in [('valid', {'outfit_image_id': 'backfill-image'}, None),
                                           ('foreign', {'user_image_id': 'foreign-image'}, None),
                                           ('malformed', {'user_image_id': 'backfill-image'}, 'invalid-json')]:
            conn.execute("INSERT INTO ai_jobs(id,owner_id,task_type,input_hash,model_name,input_params,result_data) VALUES(?,'owner','v3_generation','hash','fake',?,?)", (identifier, json.dumps(inputs), result))
        conn.commit()
        before = [tuple(row) for row in conn.execute('SELECT * FROM ai_jobs ORDER BY id')]
        migrations.run_migrations(conn)
        assert migrations.verify_schema(conn)
        assert [tuple(row) for row in conn.execute('SELECT * FROM ai_jobs ORDER BY id')] == before
        assert [tuple(row) for row in conn.execute('SELECT job_id,media_id,purpose FROM ai_job_media')] == [('valid', 'backfill-image', 'outfit')]
        conn.execute('UPDATE ai_jobs SET result_data=? WHERE id=\'valid\'', (json.dumps({'result_media_id': 'backfill-image'}),))
        assert {row['purpose'] for row in conn.execute('SELECT purpose FROM ai_job_media')} == {'outfit', 'result'}
        assert conn.execute('SELECT count(*) FROM ai_media_library').fetchone()[0] == 1
        conn.execute("DELETE FROM ai_jobs WHERE id='valid'")
        assert conn.execute('SELECT count(*) FROM ai_media_library').fetchone()[0] == 0
        assert not conn.execute("SELECT 1 FROM sqlite_master WHERE name='idx_outfit_versions_outfit'").fetchone()
    finally:
        conn.close()


def test_postgres_upgrade_preserves_receipts_and_backfills_library(monkeypatch):
    url = os.environ.get('TEST_POSTGRES_URL')
    if not url:
        pytest.skip('Set TEST_POSTGRES_URL to verify the PostgreSQL upgrade')
    import psycopg
    from psycopg import sql
    from app.core import postgres
    from app.core.config import settings
    from app.core.postgres_migrations import (schema_source, schema_checksum, VERSION, STORY_IMAGES_SQL,
        STORY_IMAGES_VERSION, install_community, install_query_indexes, install_ai_media, verify_postgres_schema)
    import hashlib
    schema = 'vs_query_' + uuid.uuid4().hex
    monkeypatch.setattr(settings, 'DATABASE_URL', url)
    monkeypatch.setattr(settings, 'DATABASE_SCHEMA', schema)
    with psycopg.connect(**postgres.connection_kwargs()) as conn:
        postgres.configure_connection(conn)
        with conn.transaction(force_rollback=True):
            conn.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
            conn.execute(schema_source(), prepare=False)
            conn.execute('INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)', (VERSION, 'old schema', schema_checksum()))
            conn.execute(STORY_IMAGES_SQL)
            conn.execute('INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)', (STORY_IMAGES_VERSION, 'images', hashlib.sha256(STORY_IMAGES_SQL.encode()).hexdigest()))
            install_community(conn)
            conn.execute("INSERT INTO media_assets(id,owner_id,bucket,object_key,media_type,mime_type,status) VALUES('upgrade-image','owner','private','upgrade-image','image','image/png','ready')")
            conn.execute("INSERT INTO ai_jobs(id,owner_id,task_type,input_hash,model_name,input_params) VALUES('upgrade-job','owner','v3_generation','hash','fake',%s)", (json.dumps({'outfit_image_id': 'upgrade-image'}),))
            before = dict(conn.execute("SELECT * FROM ai_jobs WHERE id='upgrade-job'").fetchone())
            assert verify_postgres_schema(conn, with_query_indexes=False, with_ai_media=False)
            install_query_indexes(conn)
            install_ai_media(conn)
            assert verify_postgres_schema(conn)
            assert dict(conn.execute("SELECT * FROM ai_jobs WHERE id='upgrade-job'").fetchone()) == before
            assert conn.execute('SELECT owner_id,media_id FROM ai_media_library').fetchone() == {'owner_id': 'owner', 'media_id': 'upgrade-image'}
            conn.execute("UPDATE ai_jobs SET result_data=%s WHERE id='upgrade-job'", (json.dumps({'result_media_id': 'upgrade-image'}),))
            assert {row['purpose'] for row in conn.execute('SELECT purpose FROM ai_job_media')} == {'outfit', 'result'}
            conn.execute("DELETE FROM ai_jobs WHERE id='upgrade-job'")
            assert conn.execute('SELECT COUNT(*) AS n FROM ai_media_library').fetchone()['n'] == 0
