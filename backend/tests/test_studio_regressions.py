from conftest import auth_header
import json
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from app.main import app
from app.modules.try_on.repository import TryOnRepository
from app.modules.outfits.repository import OutfitRepository
from app.worker import process_single_job

client = TestClient(app)


def test_snapshot_placement_metadata_and_conflict():
    headers = {"Authorization": auth_header("dev-user-test-1")}
    snapshot = {
        "items": [
            {
                "slot": "outerwear",
                "itemId": "item_ao_tac_do",
                "transform": {"dx": 40, "dy": -10, "scale": 1.4, "rotation": 25},
            }
        ],
        "lockedSlots": ["outerwear"],
        "backgroundTheme": "dopaper",
        "aspectRatio": "1:1",
    }
    created = client.post(
        "/api/outfits", json={"title": "Before", "snapshot": snapshot}, headers=headers
    ).json()
    assert (
        created["current_snapshot"]["items"][0]["transform"]
        == snapshot["items"][0]["transform"]
    )
    response = client.put(
        f"/api/outfits/{created['id']}",
        json={
            "revision": 1,
            "title": "After",
            "occasion_id": "tet",
            "style_mode": "remix",
            "snapshot": snapshot,
        },
        headers=headers,
    )
    assert response.status_code == 200
    saved = response.json()
    assert (
        saved["title"],
        saved["occasion_id"],
        saved["style_mode"],
        saved["revision"],
    ) == ("After", "tet", "remix", 2)
    assert saved["current_snapshot"]["styleMode"] == "remix"
    assert saved["current_snapshot"]["lockedSlots"] == ["outerwear"]
    assert saved["current_snapshot"]["backgroundTheme"] == "dopaper"
    assert (
        client.put(
            f"/api/outfits/{created['id']}",
            json={"revision": 1, "snapshot": snapshot},
            headers=headers,
        ).status_code
        == 409
    )


def test_parallel_saves_only_accept_one_revision():
    headers = {"Authorization": auth_header("dev-user-test-1")}
    created = client.post(
        "/api/outfits", json={"snapshot": {"items": []}}, headers=headers
    ).json()

    def save(number):
        return OutfitRepository.save_revision(
            created["id"],
            1,
            f"version-{number}",
            json.dumps(created["current_snapshot"]),
            f"Save {number}",
            "ky_yeu",
            "traditional",
            None,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(save, [1, 2]))
    accepted = [row for row in results if row is not None]
    assert len(accepted) == 1
    assert accepted[0]["revision"] == 2
    assert len(OutfitRepository.get_outfit_versions(created["id"])) == 2


def test_cultural_check_uses_equipped_garment_not_filter():
    results = []
    for group in [None, "ao_tac", "ngu_than"]:
        response = client.post(
            "/api/cultural-check",
            json={
                "garment_type_id": group,
                "items": [{"slot": "outerwear", "item_id": "item_ao_tac_do"}],
            },
        )
        results.append([warning["code"] for warning in response.json()["warnings"]])
    assert results[0] == results[1] == results[2]
    assert "RULE_AO_TAC_LE_NGHI" in results[0]


def test_recommendation_preserves_locked_variant():
    response = client.post(
        "/api/recommendations/ai",
        headers={"Authorization": auth_header("dev-user-test-1")},
        json={
            "prompt": "Giữ màu áo",
            "locked_items": [
                {
                    "slot": "outerwear",
                    "item_id": "item_ngu_than_nam_xanh",
                    "variant_id": "var_ngu_than_nam_xanh_reu",
                }
            ],
        },
    )
    assert response.status_code == 200
    item = next(
        item
        for item in response.json()["outfits"][0]["items"]
        if item["slot"] == "outerwear"
    )
    assert item["variant_id"] == "var_ngu_than_nam_xanh_reu"


def test_worker_claim_and_unavailable_provider_never_succeed():
    TryOnRepository.create_job("job-test", None, "try_on", "hash", "key", "image", "{}")
    claimed = TryOnRepository.claim_queued_job()
    assert claimed["status"] == "running"
    assert TryOnRepository.claim_queued_job() is None
    process_single_job(claimed)
    assert TryOnRepository.get_job_by_id("job-test")["status"] == "failed"


def test_custom_weather_coordinates_have_separate_cache_entries():
    a = client.get("/api/weather?lat=21&lon=105").json()
    b = client.get("/api/weather?lat=10&lon=106").json()
    assert a["location"]["key"] != b["location"]["key"]
    assert not a["cached"] and not b["cached"]
    assert client.get("/api/weather?lat=21&lon=105").json()["cached"]
