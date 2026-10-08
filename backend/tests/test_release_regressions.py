"""Regression coverage for the final production review's reproducible failures."""
from contextlib import contextmanager
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageChops, ImageOps, ImageStat

from app.core.database import Database
from app.core.errors import AppError
from app.main import app
from app.modules.lookbooks.repository import LookbookRepository
from app.modules.lookbooks.schemas import CreateLookbookRequest, UpdateLookbookRequest
from app.modules.lookbooks.service import LookbookService
from app.modules.media.repository import MediaRepository
from app.modules.media.service import MediaService
from app.modules.media.validation import validate_content
from app.modules.outfits.repository import OutfitRepository
from app.modules.outfits.schemas import CreateOutfitRequest, OutfitSnapshot, UpdateOutfitRequest
from app.modules.outfits.service import OutfitService
from app.modules.stylist import service as stylist_service
from app.modules.stylist.schemas import CreateGarmentSubmissionRequest
from app.modules.stylist.service import StylistCatalogService
from conftest import auth_header

OWNER = "dev-user-test-1"
client = TestClient(app)


@pytest.mark.parametrize("admin", [False, True])
def test_update_response_keeps_its_own_revision_when_another_save_commits(monkeypatch, admin):
    outfit = OutfitService.create_outfit(OWNER, CreateOutfitRequest(snapshot=OutfitSnapshot()))
    original = OutfitRepository.save_revision

    def save_then_compete(**kwargs):
        saved = original(**kwargs)
        if saved:
            original(outfit_id=outfit.id, expected_revision=2, version_id="competing-version",
                     snapshot_json=OutfitSnapshot(backgroundFade=42).model_dump_json(),
                     title="Writer B", owner_id=OWNER)
        return saved

    monkeypatch.setattr(OutfitRepository, "save_revision", save_then_compete)
    path = ("/api/admin/outfits/" if admin else "/api/outfits/") + outfit.id
    headers = {"Authorization": auth_header("dev-user-admin" if admin else OWNER)}
    request = {"title": "Writer A", "revision": 1, "snapshot": {"items": [], "backgroundFade": 7}}
    response = client.put(path, headers=headers, json=request)
    assert response.status_code == 200, response.text
    assert response.json()["revision"] == 2
    assert response.json()["title"] == "Writer A"
    assert response.json()["current_snapshot"]["backgroundFade"] == 7
    current = OutfitService.get_outfit(outfit.id, OWNER)
    assert current.revision == 3 and current.title == "Writer B"
    stale = client.put(path, headers=headers, json={**request, "revision": response.json()["revision"]})
    assert stale.status_code == 409
    assert OutfitService.get_outfit(outfit.id, OWNER).current_snapshot.backgroundFade == 42






def submission_request(media_id):
    Database.execute("INSERT INTO garment_types(id,name) VALUES('release-type','Release garment')")
    return CreateGarmentSubmissionRequest(name="Release garment", garment_type_id="release-type",
        slot="outerwear", description="A synthetic garment for regression checks.",
        color_name="Red", hex_color="#ff0000", media_id=media_id)
