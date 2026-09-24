"""Optional real PostgreSQL probe: schema and all synthetic rows roll back.

TEST_POSTGRES_URL is opt-in. This never copies the local database, commits
business data, or changes the configured application schema.
"""
from contextlib import contextmanager
import json
import os
import uuid

import psycopg
import pytest
from psycopg import sql
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import Database, init_database
from app.core import postgres
from app.core.postgres_migrations import schema_source, schema_checksum, VERSION, verify_postgres_schema
from app.main import app


def test_qmark_binding_preserves_sql_literals_and_comments():
    query = "SELECT ?, '?', '100%', \"?\" -- ? comment\n/* ? */ WHERE name LIKE ?"
    assert postgres.bind_query(query) == "SELECT %s, '?', '100%%', \"?\" -- ? comment\n/* ? */ WHERE name LIKE %s"


def test_postgres_runtime_rollback_only(monkeypatch):
    url = os.environ.get("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set TEST_POSTGRES_URL for rollback-only PostgreSQL verification")
    schema = "vs_probe_" + uuid.uuid4().hex
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    monkeypatch.setattr(settings, "DATABASE_SCHEMA", schema)
    with psycopg.connect(**postgres.connection_kwargs()) as raw:
        postgres.configure_connection(raw)
        try:
            with raw.transaction(force_rollback=True):
                raw.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
                raw.execute(schema_source(), prepare=False)
                raw.execute("INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)", (VERSION, "rollback-only probe", schema_checksum()))
                assert verify_postgres_schema(raw)

                class RollbackPool:
                    @contextmanager
                    def connection(self):
                        # Nested transactions become savepoints. Repository commits
                        # release only this savepoint; the outer transaction rolls back.
                        with raw.transaction():
                            yield raw

                monkeypatch.setattr(postgres, "get_pool", lambda: RollbackPool())
                monkeypatch.setattr(postgres.Connection, "commit", lambda self: None)
                monkeypatch.setattr(postgres.Connection, "rollback", lambda self: None)
                init_database(seed=True)
                assert Database.fetch_one("SELECT count(*) AS n FROM accounts")["n"] == 0
                assert Database.fetch_one("SELECT count(*) AS n FROM items")["n"] == 0

                client = TestClient(app)
                user = {"email": "pg-probe@example.invalid", "password": "PgProbePassword123!", "display_name": "PostgreSQL probe"}
                registered = client.post("/api/auth/register", json=user)
                assert registered.status_code == 200, registered.text
                token = registered.json()["access_token"]
                owner = registered.json()["user"]["id"]
                headers = {"Authorization": "Bearer " + token}
                assert client.get("/api/auth/me", headers=headers).status_code == 200
                assert client.post("/api/auth/register", json=user).status_code == 400
                assert client.post("/api/auth/login", json={"email": user["email"], "password": user["password"]}).status_code == 200
                assert client.get("/api/v3/entities").json() == []
                assert client.get("/api/catalog/items").status_code == 200

                Database.execute("INSERT INTO occasions(id,name) VALUES('ky_yeu','Probe occasion')")
                created = client.post("/api/outfits", headers=headers, json={"snapshot": {"items": []}})
                assert created.status_code == 200, created.text
                outfit = created.json()
                update = {"title": "Updated on PostgreSQL", "revision": 1, "snapshot": {"items": []}}
                changed = client.put('/api/outfits/' + outfit['id'], headers=headers, json=update)
                assert changed.status_code == 200, changed.text
                assert changed.json()["revision"] == 2
                assert client.put('/api/outfits/' + outfit['id'], headers=headers, json=update).status_code == 409
                lookbook = client.post('/api/lookbooks', headers=headers, json={"title": "Probe", "entries": [{"outfit_version_id": changed.json()["current_version_id"]}]})
                assert lookbook.status_code == 200, lookbook.text
                assert client.get('/api/solution-form', headers=headers).status_code == 200

                # Admin workflows use the same SQL transport on an empty schema;
                # all probe accounts and content are rolled back with this transaction.
                admin = client.post('/api/auth/register', json={**user, "email": "admin-probe@example.invalid"}).json()
                Database.execute("INSERT INTO user_roles(id,user_id,role) VALUES('admin-probe-role',?,'admin')", (admin['user']['id'],))
                admin_headers = {"Authorization": "Bearer " + admin['access_token']}
                assert client.get('/api/admin/overview', headers=admin_headers).status_code == 200
                assert client.get('/api/admin/users', headers=admin_headers).json()['total'] == 2
                assert client.patch('/api/admin/users/' + owner, headers=admin_headers, json={"is_stylist": True}).status_code == 200
                assert 'stylist' in client.get('/api/auth/me', headers=headers).json()['roles']
                assert client.get('/api/admin/outfits', headers=admin_headers).json()['total'] == 1
                assert client.get('/api/admin/lookbooks', headers=admin_headers).json()['total'] == 1
                assert client.put('/api/admin/lookbooks/' + lookbook.json()['id'], headers=admin_headers, json={"title": "Admin reviewed"}).status_code == 200
                assert client.post('/api/admin/garment-types', headers=admin_headers, json={"id":"probe_type","name":"Probe type"}).status_code == 200
                item = {"id":"probe_item","name":"Probe item","slot":"outerwear","garment_type_id":"probe_type"}
                assert client.post('/api/admin/items', headers=admin_headers, json=item).status_code == 200
                assert client.put('/api/admin/items/probe_item', headers=admin_headers, json={**item,"name":"Edited item"}).status_code == 200
                assert client.get('/api/admin/items', headers=admin_headers).json()['total'] == 1
                assert client.delete('/api/admin/items/probe_item', headers=admin_headers).status_code == 200

                for _ in range(2):
                    weather = client.get('/api/weather?city_key=hanoi')
                    assert weather.status_code == 200, weather.text
                assert weather.json()["cached"] is True

                from app.modules.media.repository import MediaRepository
                MediaRepository.create_pending_media("pg_media", "private", "probe", "image", "image/png", owner, "private", 100, upload_expires_at=9999999999)
                assert MediaRepository.get_media_by_id("pg_media")["visibility"] == "private"

                from app.modules.try_on.repository import TryOnRepository
                TryOnRepository.create_job("pg_job", owner, "try_on", "hash", "pg-key", "mock", "{}")
                assert TryOnRepository.claim_queued_job()["status"] == "running"

                from app.modules.cultural_data_v3.domain.models import Entity, AttributeDefinition
                from app.modules.cultural_data_v3.repository import CulturalDataV3Repository as Repo
                from app.modules.cultural_data_v3.services.datasets import create_dataset, dataset_resolver
                Repo.add_entity(Entity(id="probe_entity", entity_type="garment", identity={"name_vi": "Synthetic probe"}, status="published"))
                definition = AttributeDefinition(key="probe.attr", label_vi="Probe", value_type="string", applies_to=["garment"])
                Repo.add_attribute_definition(definition)
                Repo.add_attribute_definition(definition)
                dataset = create_dataset("Rollback-only probe", owner)
                with dataset_resolver(dataset["dataset_version"]) as (resolver, metadata):
                    assert resolver.resolve("probe_entity")["entity"]["identity"]["name_vi"] == "Synthetic probe"
                    assert metadata["reproducible"] is True
                with pytest.raises(psycopg.errors.CheckViolation):
                    Database.execute("DELETE FROM dataset_contents_v3")
                with pytest.raises(psycopg.errors.CheckViolation):
                    Database.execute("UPDATE media_assets SET visibility='invalid' WHERE id='pg_media'")
                assert client.get('/api/auth/me', headers=headers).status_code == 200
        finally:
            # Assert even a failing probe left no schema or user data behind.
            assert raw.execute("SELECT 1 FROM pg_namespace WHERE nspname=%s", (schema,)).fetchone() is None


def test_postgres_pool_commit_rollback_and_savepoints(monkeypatch):
    url = os.environ.get("TEST_POSTGRES_URL")
    if not url:
        pytest.skip("Set TEST_POSTGRES_URL for temporary-table PostgreSQL verification")
    from app.core.database import db_transaction
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    monkeypatch.setattr(settings, "DATABASE_SCHEMA", "vs_probe_" + uuid.uuid4().hex)
    monkeypatch.setattr(settings, "DATABASE_POOL_SIZE", 1)
    postgres.close_pool()
    try:
        # A PostgreSQL TEMP table is connection-local and disappears on close.
        Database.execute("CREATE TEMP TABLE pg_runtime_probe(id TEXT PRIMARY KEY, value BIGINT) ON COMMIT PRESERVE ROWS")
        Database.execute("INSERT INTO pg_runtime_probe VALUES(?,?)", ("committed", 3))
        assert Database.fetch_one("SELECT value FROM pg_runtime_probe WHERE id=?", ("committed",))["value"] == 3
        with pytest.raises(psycopg.errors.UniqueViolation):
            Database.execute("INSERT INTO pg_runtime_probe VALUES(?,?)", ("committed", 4))
        with pytest.raises(ValueError):
            with db_transaction() as conn:
                Database.execute("INSERT INTO pg_runtime_probe VALUES(?,?)", ("rollback", 4), conn)
                raise ValueError("rollback probe")
        assert Database.fetch_one("SELECT value FROM pg_runtime_probe WHERE id='rollback'") is None
        with db_transaction() as conn:
            with pytest.raises(ValueError):
                with db_transaction(conn):
                    Database.execute("INSERT INTO pg_runtime_probe VALUES('nested',5)", conn=conn)
                    raise ValueError("savepoint rollback")
            Database.execute("INSERT INTO pg_runtime_probe VALUES('outer',6)", conn=conn)
        assert Database.fetch_one("SELECT value FROM pg_runtime_probe WHERE id='nested'") is None
        assert Database.fetch_one("SELECT value FROM pg_runtime_probe WHERE id='outer'")["value"] == 6
    finally:
        postgres.close_pool()
