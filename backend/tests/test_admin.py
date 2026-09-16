import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_admin_endpoints_require_permission():
    # 1. Khách hoặc user thông thường gọi endpoint admin -> Bị từ chối 401 hoặc 403
    res = client.post("/api/admin/items", json={
        "id": f"item_test_admin_{uuid.uuid4().hex[:6]}",
        "garment_type_id": "ngu_than",
        "slot": "outerwear",
        "name": "Áo test admin",
    })
    assert res.status_code in (401, 403)

    # 2. Gọi với token có quyền admin
    test_id = f"item_admin_{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": "Bearer dev-user-admin"}
    admin_res = client.post("/api/admin/items", json={
        "id": test_id,
        "garment_type_id": "ngu_than",
        "slot": "outerwear",
        "name": "Áo test admin thành công",
        "gender": "unisex",
        "era": "Nguyễn",
        "is_published": True,
        "metadata": {}
    }, headers=headers)
    assert admin_res.status_code == 200
    assert admin_res.json()["status"] == "created"
