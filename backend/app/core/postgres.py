"""PostgreSQL transport for the application's parameterized SQL repositories.

Only placeholders are adapted; SQL dialect differences live in repositories.
The schema is private and migrations are explicit. Connections never seed data.
"""
from __future__ import annotations

from datetime import date, datetime
import hashlib
import re
import threading

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.pq import TransactionStatus
from psycopg_pool import ConnectionPool

from app.core.config import settings


class Record(dict):
    """Mapping rows with positional access for existing repository aggregates."""
    def __getitem__(self, key):
        return tuple(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


def record_factory(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []
    def make(values):
        return Record(zip(names, (v.isoformat() if isinstance(v, (datetime, date)) else v for v in values)))
    return make


_TOKENS = re.compile(r"('(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|--[^\n]*(?:\n|$)|/\*[\s\S]*?\*/)")


def bind_query(query: str) -> str:
    parts = _TOKENS.split(query)
    return "".join(part.replace("%", "%%").replace("?", "%s") if i % 2 == 0 else part.replace("%", "%%") for i, part in enumerate(parts))


_pool = None
_pool_identity = None
_pool_lock = threading.Lock()


def connection_kwargs():
    values = conninfo_to_dict(settings.database_url())
    host = values.get("host", "")
    if not host:
        raise ValueError("PostgreSQL host is required")
    if host not in ("localhost", "127.0.0.1", "::1"):
        if values.get("sslmode") not in ("require", "verify-ca", "verify-full"):
            values["sslmode"] = "require"
    if host.endswith(".pooler.supabase.com") and values.get("port") == "6543":
        raise ValueError("Use the Supabase session pooler on port 5432.")
    values.update(connect_timeout=8, application_name="vietstylist", autocommit=True,
                  prepare_threshold=None, row_factory=record_factory)
    return values


def configure_connection(conn):
    conn.execute(sql.SQL("SET search_path TO {}, pg_catalog").format(sql.Identifier(settings.DATABASE_SCHEMA)))
    conn.execute("SET TIME ZONE 'UTC'")
    conn.execute("SET statement_timeout = '30s'")
    conn.execute("SET lock_timeout = '10s'")
    conn.execute("SET idle_in_transaction_session_timeout = '60s'")


def get_pool():
    global _pool, _pool_identity
    identity = (settings.database_url(), settings.DATABASE_SCHEMA, settings.DATABASE_POOL_SIZE)
    with _pool_lock:
        if _pool is None or _pool_identity != identity:
            if _pool is not None:
                _pool.close()
            _pool = ConnectionPool(kwargs=connection_kwargs(), min_size=0,
                max_size=settings.DATABASE_POOL_SIZE, timeout=12, configure=configure_connection,
                check=ConnectionPool.check_connection, open=True)
            _pool_identity = identity
        return _pool


def close_pool():
    global _pool, _pool_identity
    with _pool_lock:
        if _pool is not None:
            _pool.close()
        _pool = _pool_identity = None


class Cursor:
    def __init__(self, connection):
        self.connection = connection
        self.raw = connection.raw.cursor()

    def execute(self, query, params=()):
        self.connection.before_statement(query)
        self.raw.execute(bind_query(query) if params else query, params or None)
        return self

    def executemany(self, query, params):
        self.connection.before_statement(query)
        self.raw.executemany(bind_query(query), params)
        return self

    @property
    def rowcount(self):
        return self.raw.rowcount

    def fetchone(self):
        return self.raw.fetchone()

    def fetchall(self):
        return self.raw.fetchall()

    def __iter__(self):
        return iter(self.raw)


class Connection:
    dialect = "postgresql"

    def __init__(self, raw):
        self.raw = raw
        self._write_locked = False

    @property
    def in_transaction(self):
        return self.raw.info.transaction_status != TransactionStatus.IDLE

    def begin_write(self):
        if not self.in_transaction:
            self.raw.execute("BEGIN")
        if not self._write_locked:
            # Preserve existing multi-statement SQLite write semantics across hosts.
            # Reads remain concurrent; lock is released on commit/rollback.
            key = int.from_bytes(hashlib.sha256((settings.DATABASE_SCHEMA + ':write').encode()).digest()[:8], 'big', signed=True)
            self.raw.execute("SELECT pg_advisory_xact_lock(%s)", (key,))
            self._write_locked = True

    def before_statement(self, query):
        if re.match(r"\s*(INSERT|UPDATE|DELETE)\b", query, re.I):
            self.begin_write()

    def cursor(self):
        return Cursor(self)

    def execute(self, query, params=()):
        if query.strip().upper() == "BEGIN IMMEDIATE":
            self.begin_write()
            return self.cursor()
        return self.cursor().execute(query, params)

    def executemany(self, query, params):
        return self.cursor().executemany(query, params)

    def commit(self):
        self.raw.commit()
        self._write_locked = False

    def rollback(self):
        self.raw.rollback()
        self._write_locked = False

    def __enter__(self):
        return self

    def __exit__(self, kind, value, traceback):
        self.rollback() if kind else self.commit()
