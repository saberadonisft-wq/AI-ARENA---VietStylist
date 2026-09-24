import sqlite3

from app.core.database import SQLITE_INIT_DDL
from app.modules.catalog.schemas import OccasionResponse
from scripts.seed_occasions import seed_occasions
import json


def test_occasion_seed_is_additive_and_does_not_seed_other_tables():
    with sqlite3.connect(":memory:") as conn:
        conn.row_factory = sqlite3.Row
        conn.executescript(SQLITE_INIT_DDL)
        conn.execute("INSERT INTO occasions(id,name,is_active) VALUES('ky_yeu','Tên đã chỉnh sửa',0)")
        assert seed_occasions(conn) == {"inserted": 7, "total": 8}
        assert seed_occasions(conn) == {"inserted": 0, "total": 8}
        existing = conn.execute("SELECT name,is_active FROM occasions WHERE id='ky_yeu'").fetchone()
        assert tuple(existing) == ("Tên đã chỉnh sửa", 0)
        for row in conn.execute("SELECT * FROM occasions"):
            data = dict(row)
            data["criteria"] = json.loads(data["criteria"])
            OccasionResponse.model_validate(data)
        for table in ("items", "outfits", "profiles"):
            assert conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
