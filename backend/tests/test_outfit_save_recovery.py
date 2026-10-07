"""Saving an archived Studio draft must not depend on seeded occasion rows."""
import pytest
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from app.core.database import Database
from app.main import create_app
from app.modules.outfits.service import OutfitService
from app.modules.outfits.repository import OutfitRepository
from app.modules.outfits.schemas import CreateOutfitRequest
from conftest import auth_header


def test_create_and_update_preserve_snapshot_when_occasion_catalog_is_empty():
    Database.execute("DELETE FROM occasions")
    client = TestClient(create_app())
    headers = {"Authorization": auth_header("dev-user-test-1")}
    snapshot = {
        "occasionId": "ky_yeu", "styleMode": "traditional", "backgroundTheme": "dopaper",
        "items": [{"slot": "outerwear", "itemId": "historical-item", "colorHex": "#123456",
                   "transform": {"dx": 12, "dy": 3, "scale": 1.4, "rotation": 5}}],
    }
    created = client.post("/api/outfits", headers=headers, json={"title": "Nháp cũ", "occasion_id": "ky_yeu", "snapshot": snapshot})
    assert created.status_code == 200
    data = created.json()
    assert data["occasion_id"] is None
    assert data["current_snapshot"]["occasionId"] == "ky_yeu"
    assert data["current_snapshot"]["items"][0]["transform"] == snapshot["items"][0]["transform"]
    snapshot["items"][0]["colorHex"] = "#654321"
    changed = client.put(f"/api/outfits/{data['id']}", headers=headers, json={"revision": 1, "snapshot": snapshot, "occasion_id": "removed-occasion"})
    assert changed.status_code == 200
    assert changed.json()["revision"] == 2
    assert changed.json()["occasion_id"] is None
    assert changed.json()["current_snapshot"]["occasionId"] == "removed-occasion"
    assert changed.json()["current_snapshot"]["items"][0]["colorHex"] == "#654321"
    assert client.get(f"/api/outfits/{data['id']}", headers=headers).json() == changed.json()
    assert client.put(f"/api/outfits/{data['id']}", headers=headers, json={"revision": 1, "snapshot": snapshot}).status_code == 409


def test_available_occasion_is_still_linked():
    Database.execute("INSERT INTO occasions(id,name) VALUES('save-test','Save test')")
    client = TestClient(create_app())
    headers = {"Authorization": auth_header("dev-user-test-1")}
    saved = client.post("/api/outfits", headers=headers, json={"snapshot": {"occasionId": "save-test", "items": []}})
    assert saved.status_code == 200
    assert saved.json()["occasion_id"] == "save-test"
    assert saved.json()["current_snapshot"]["occasionId"] == "save-test"


def test_empty_snapshot_does_not_invent_a_default_occasion():
    client = TestClient(create_app())
    headers = {"Authorization": auth_header("dev-user-test-1")}
    saved = client.post("/api/outfits", headers=headers, json={"snapshot": {"items": []}})
    assert saved.status_code == 200
    assert saved.json()["occasion_id"] is None
    assert saved.json()["current_snapshot"]["occasionId"] is None


def test_create_idempotency_reuses_result_and_rejects_different_payload():
    client = TestClient(create_app())
    headers = {"Authorization": auth_header("dev-user-test-1"), "Idempotency-Key": "retry-after-timeout-1"}
    payload = {"title": "Bản phối thử lại", "snapshot": {"items": []}}

    first = client.post("/api/outfits", headers=headers, json=payload)
    retry = client.post("/api/outfits", headers=headers, json=payload)

    assert first.status_code == retry.status_code == 200
    assert first.json()["id"] == retry.json()["id"]
    assert len(client.get("/api/outfits", headers=headers).json()) == 1

    changed = client.post("/api/outfits", headers=headers, json={**payload, "title": "Nội dung khác"})
    assert changed.status_code == 409
    assert changed.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


def test_create_idempotency_key_is_scoped_to_account():
    client = TestClient(create_app())
    payload = {"title": "Bộ phối riêng", "snapshot": {"items": []}}
    first = client.post("/api/outfits", headers={"Authorization": auth_header("dev-user-test-1"), "Idempotency-Key": "same-local-key"}, json=payload)
    other_owner = client.post("/api/outfits", headers={"Authorization": auth_header("dev-user-123"), "Idempotency-Key": "same-local-key"}, json=payload)
    assert first.status_code == other_owner.status_code == 200
    assert first.json()["id"] != other_owner.json()["id"]


def test_create_retry_cannot_overwrite_a_later_revision():
    client = TestClient(create_app())
    headers = {"Authorization": auth_header("dev-user-test-1"), "Idempotency-Key": "lost-create-before-other-edit"}
    original = {"title": "Lần tạo bị mất phản hồi", "snapshot": {"items": []}}
    created = client.post("/api/outfits", headers=headers, json=original).json()
    path = f"/api/outfits/{created['id']}"
    competing = client.put(path, headers=headers, json={"title": "Phiên khác đã lưu", "revision": 1, "snapshot": {"items": []}})
    assert competing.status_code == 200

    retry = client.post("/api/outfits", headers=headers, json=original)
    assert retry.status_code == 409
    assert retry.json()["error"]["code"] == "REVISION_CONFLICT"
    assert retry.json()["error"]["details"] == {"outfit_id": created["id"], "revision": 1}
    assert client.get(path, headers=headers).json() == competing.json()
    assert len(OutfitRepository.get_outfit_versions(created["id"])) == 2


def test_deleted_create_retry_is_a_conflict_and_a_fresh_key_can_save_separately():
    client = TestClient(create_app(), raise_server_exceptions=False)
    headers = {"Authorization": auth_header("dev-user-test-1"), "Idempotency-Key": "lost-create-before-delete"}
    payload = {"title": "Bản nháp giữ lại", "snapshot": {"items": []}}
    created = client.post("/api/outfits", headers=headers, json=payload).json()
    assert client.delete(f"/api/outfits/{created['id']}", headers=headers).status_code == 200

    for _ in range(2):
        retry = client.post("/api/outfits", headers=headers, json=payload)
        assert retry.status_code == 409
        assert retry.json()["error"]["code"] == "OUTFIT_DELETED"
        assert retry.json()["error"]["details"] == {"outfit_id": created["id"], "revision": 1}
    assert client.get("/api/outfits", headers=headers).json() == []
    fresh = client.post("/api/outfits", headers={**headers, "Idempotency-Key": "explicit-new-copy"}, json=payload)
    assert fresh.status_code == 200
    assert fresh.json()["id"] != created["id"]
    assert len(client.get("/api/outfits", headers=headers).json()) == 1


def test_parallel_create_retries_only_create_one_outfit_and_version():
    request = CreateOutfitRequest(title="Lưu đồng thời", snapshot={"items": []})
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(lambda _: OutfitService.create_outfit("dev-user-test-1", request, "parallel-create"), range(4)))
    assert len({result.id for result in results}) == 1
    assert {result.revision for result in results} == {1}
    assert len(OutfitService.list_user_outfits("dev-user-test-1")) == 1
    assert len(OutfitRepository.get_outfit_versions(results[0].id)) == 1


def test_concurrent_create_and_delete_maps_the_unique_race_to_a_deleted_conflict(monkeypatch):
    create_atomic = OutfitRepository.create_outfit_atomic

    def competing_create_then_delete(**kwargs):
        create_atomic(**kwargs)
        OutfitRepository.soft_delete_outfit(kwargs["outfit_id"], kwargs["owner_id"])
        create_atomic(**kwargs)

    monkeypatch.setattr(OutfitRepository, "create_outfit_atomic", competing_create_then_delete)
    client = TestClient(create_app(), raise_server_exceptions=False)
    response = client.post("/api/outfits", headers={"Authorization": auth_header("dev-user-test-1"), "Idempotency-Key": "create-delete-race"}, json={"snapshot": {"items": []}})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "OUTFIT_DELETED"
    assert OutfitService.list_user_outfits("dev-user-test-1") == []


@pytest.mark.parametrize("origin,allowed", [("http://localhost:3000", True), ("https://untrusted.example", False)])
def test_unhandled_save_error_has_cors_only_for_allowed_origins(monkeypatch, origin, allowed):
    def fail(*args):
        raise RuntimeError("private internal diagnostic")
    monkeypatch.setattr(OutfitService, "create_outfit", fail)
    client = TestClient(create_app(), raise_server_exceptions=False)
    response = client.post("/api/outfits", headers={"Origin": origin, "Authorization": auth_header("dev-user-test-1")}, json={"snapshot": {"items": []}})
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert "private internal diagnostic" not in response.text
    assert response.headers.get("access-control-allow-origin") == (origin if allowed else None)
    if allowed:
        assert response.headers["access-control-allow-credentials"] == "true"
        assert "Origin" in response.headers["vary"]
