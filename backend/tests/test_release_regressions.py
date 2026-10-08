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


@pytest.mark.parametrize("key", [None, "create-response-race"])
def test_create_response_does_not_adopt_a_competing_revision(monkeypatch, key):
    original = OutfitRepository.create_outfit_atomic

    def create_then_compete(**kwargs):
        saved = original(**kwargs)
        OutfitRepository.save_revision(outfit_id=kwargs["outfit_id"], expected_revision=1,
            version_id="after-create", snapshot_json=OutfitSnapshot(backgroundFade=42).model_dump_json(),
            title="Writer B", owner_id=OWNER)
        return saved

    monkeypatch.setattr(OutfitRepository, "create_outfit_atomic", create_then_compete)
    request = CreateOutfitRequest(title="Writer A", snapshot=OutfitSnapshot(backgroundFade=7))
    response = OutfitService.create_outfit(OWNER, request, key)
    assert response.revision == 1 and response.title == "Writer A"
    assert response.current_snapshot.backgroundFade == 7
    with pytest.raises(AppError) as conflict:
        OutfitService.update_outfit(response.id, OWNER, UpdateOutfitRequest(
            revision=response.revision, snapshot=response.current_snapshot))
    assert conflict.value.code == "REVISION_CONFLICT"
    if key:
        with pytest.raises(AppError) as replay:
            OutfitService.create_outfit(OWNER, request, key)
        assert replay.value.code == "REVISION_CONFLICT"
    assert OutfitService.get_outfit(response.id, OWNER).title == "Writer B"


def test_title_only_edit_preserves_concurrent_private_setting_and_share_revocation(monkeypatch):
    lookbook = LookbookService.create_lookbook(OWNER, CreateLookbookRequest(title="Original", visibility="public"))
    share = LookbookService.generate_share_link(lookbook.id, OWNER)
    original = LookbookRepository.update_with_entries

    def update_after_privacy_change(**kwargs):
        original(lookbook.id, OWNER, None, "New description", "https://example.invalid/new.png", "private", None)
        return original(**kwargs)

    monkeypatch.setattr(LookbookRepository, "update_with_entries", update_after_privacy_change)
    result = LookbookService.update_lookbook(lookbook.id, OWNER, UpdateLookbookRequest(title="Renamed"))
    assert result.title == "Renamed" and result.visibility == "private"
    assert result.description == "New description"
    assert result.cover_image_url == "https://example.invalid/new.png"
    with pytest.raises(AppError) as anonymous:
        LookbookService.get_lookbook(lookbook.id, None)
    assert anonymous.value.status_code == 401
    with pytest.raises(AppError) as revoked:
        LookbookService.resolve_shared_token(share.share_token)
    assert revoked.value.code == "SHARE_NOT_FOUND"
    # An explicit publication remains supported; revoked links stay revoked.
    public = LookbookService.update_lookbook(lookbook.id, OWNER, UpdateLookbookRequest(visibility="public"))
    assert public.visibility == "public"


def submission_request(media_id):
    Database.execute("INSERT INTO garment_types(id,name) VALUES('release-type','Release garment')")
    return CreateGarmentSubmissionRequest(name="Release garment", garment_type_id="release-type",
        slot="outerwear", description="A synthetic garment for regression checks.",
        color_name="Red", hex_color="#ff0000", media_id=media_id)
