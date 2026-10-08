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


def test_private_stylist_image_is_retained_until_its_last_submission_is_deleted(png_bytes):
    image = MediaService.ingest_generated_image(OWNER, png_bytes, "image/png")
    request = submission_request(image.id)
    first = StylistCatalogService.create(OWNER, request)
    second = StylistCatalogService.create(OWNER, request)
    assert MediaRepository.get_media_by_id(image.id)["public_url"] is None
    with pytest.raises(AppError) as direct_delete:
        MediaService.delete_media(image.id, OWNER)
    assert direct_delete.value.code == "MEDIA_IN_USE"
    assert StylistCatalogService.delete_own_submission(first["id"], OWNER)["status"] == "deleted"
    assert MediaRepository.get_media_by_id(image.id)["status"] == "ready"
    assert StylistCatalogService.preview_url(second["id"]).access_url
    assert StylistCatalogService.delete_own_submission(second["id"], OWNER)["media_cleanup_pending"] == 0
    assert MediaRepository.get_media_by_id(image.id)["status"] == "deleted"


def test_stylist_deletion_retains_cleanup_ledger_after_storage_failure(png_bytes, monkeypatch):
    image = MediaService.ingest_generated_image(OWNER, png_bytes, "image/png")
    submission = StylistCatalogService.create(OWNER, submission_request(image.id))
    with monkeypatch.context() as cleanup:
        cleanup.setattr(stylist_service.r2_client, "delete_object", lambda *args: False)
        result = StylistCatalogService.delete_own_submission(submission["id"], OWNER)
    assert result == {"status": "deleted", "media_cleanup_pending": 1}
    assert Database.fetch_one("SELECT id FROM items WHERE id=?", (submission["id"],)) is None
    assert MediaRepository.get_media_by_id(image.id)["status"] == "deleting"
    assert MediaRepository.objects(image.id)
    MediaService.delete_media(image.id, OWNER)
    assert MediaRepository.get_media_by_id(image.id)["status"] == "deleted"


def test_stylist_deletion_rolls_back_unlink_when_media_is_busy(png_bytes):
    image = MediaService.ingest_generated_image(OWNER, png_bytes, "image/png")
    submission = StylistCatalogService.create(OWNER, submission_request(image.id))
    Database.execute("UPDATE media_assets SET status='processing',lease_until=9999999999 WHERE id=?", (image.id,))
    with pytest.raises(AppError) as busy:
        StylistCatalogService.delete_own_submission(submission["id"], OWNER)
    assert busy.value.code == "MEDIA_BUSY"
    assert Database.fetch_one("SELECT id FROM items WHERE id=?", (submission["id"],))
    assert MediaRepository.get_media_by_id(image.id)["status"] == "processing"


def test_submission_creation_cannot_reference_media_reserved_for_deletion(png_bytes, monkeypatch):
    image = MediaService.ingest_generated_image(OWNER, png_bytes, "image/png")
    request = submission_request(image.id)
    original = stylist_service.db_transaction

    @contextmanager
    def deletion_wins_before_submission_lock():
        assert MediaRepository.mark_media_deleting_if_unused(image.id, OWNER) == "marked"
        with original() as conn:
            yield conn

    monkeypatch.setattr(stylist_service, "db_transaction", deletion_wins_before_submission_lock)
    with pytest.raises(AppError) as rejected:
        StylistCatalogService.create(OWNER, request)
    assert rejected.value.code == "SUBMISSION_IMAGE_REQUIRED"
    assert Database.fetch_one("SELECT id FROM items WHERE metadata LIKE ?", ("%" + image.id + "%",)) is None


@pytest.mark.parametrize("orientation", range(1, 9))
def test_image_normalization_applies_exif_orientation_before_stripping_metadata(orientation):
    picture = Image.new("RGB", (80, 40), "red")
    picture.paste("blue", (40, 0, 80, 40))
    picture.paste("green", (0, 20, 40, 40))
    exif = Image.Exif()
    exif[274] = orientation
    exif[271] = "Untrusted camera metadata"
    source = io.BytesIO()
    picture.save(source, format="JPEG", quality=95, exif=exif)
    expected = ImageOps.exif_transpose(Image.open(io.BytesIO(source.getvalue())))
    clean, width, height, duration = validate_content(source.getvalue(), "image/jpeg")
    normalized = Image.open(io.BytesIO(clean))
    assert normalized.size == expected.size == (width, height)
    assert not normalized.getexif()
    assert duration is None
    difference = ImageChops.difference(normalized, expected)
    assert max(ImageStat.Stat(difference).mean) < 5
