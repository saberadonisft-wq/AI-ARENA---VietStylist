from fastapi.testclient import TestClient
from conftest import auth_header
from app.main import app
from app.core.database import Database

client = TestClient(app)
ADMIN = {"Authorization": auth_header("dev-user-admin")}


def upload_image(png_bytes, headers=ADMIN):
    response = client.post("/api/heritage/images/uploads", headers=headers, json={
        "filename": "illustration.png", "mime_type": "image/png", "size_bytes": len(png_bytes),
    })
    assert response.status_code == 200, response.text
    session = response.json()
    assert client.post(session["upload_url"], files={"file": ("illustration.png", png_bytes, "image/png")}).status_code == 200
    complete = client.post(f"/api/media/{session['media_id']}/complete", headers=headers, json={})
    assert complete.status_code == 200, complete.text
    return complete.json()


def story(images):
    return {"title": "Câu chuyện áo ngũ thân", "short_summary": "Tư liệu về áo ngũ thân Việt Nam.",
            "full_content": "Nội dung chi tiết về trang phục và sử liệu minh họa.", "images": images}


def test_multiple_images_survive_reload_with_captions_and_cover(png_bytes):
    images = [upload_image(png_bytes), upload_image(png_bytes)]
    payload = story([{"media_id": image["id"], "caption": f"Nguồn tư liệu {i}"} for i, image in enumerate(images)])
    created = client.post("/api/heritage/articles", headers=ADMIN, json=payload)
    assert created.status_code == 201, created.text
    detail = client.get(f"/api/heritage/articles/{created.json()['id']}").json()
    assert [i["media_id"] for i in detail["images"]] == [i["id"] for i in images]
    assert detail["images"][1]["caption"] == "Nguồn tư liệu 1"
    assert detail["cover_image_url"] == images[0]["public_url"]
    assert client.get(detail["images"][0]["url"]).status_code == 200
    assert client.post("/api/heritage/articles", headers=ADMIN, json=story([])).status_code == 201


def test_stylist_can_upload_only_raster_story_images(png_bytes):
    Database.execute("UPDATE user_roles SET role='stylist' WHERE user_id=?", ("dev-user-123",))
    headers = {"Authorization": auth_header("dev-user-123")}
    upload_image(png_bytes, headers)
    request = {"filename": "x.svg", "mime_type": "image/svg+xml", "size_bytes": 100}
    assert client.post("/api/heritage/images/uploads", headers=headers, json=request).status_code == 422
    request.update(filename="x.png", mime_type="image/png")
    assert client.post("/api/heritage/images/uploads", json=request).status_code == 401
    assert client.post("/api/heritage/images/uploads", headers={"Authorization": auth_header("dev-user-media-1")}, json=request).status_code == 403
    assert client.post("/api/media/uploads", headers=headers, json={**request, "visibility": "public"}).status_code == 403


def test_rejects_foreign_private_unready_duplicate_and_excess_images(png_bytes):
    image = upload_image(png_bytes)
    item = {"media_id": image["id"]}
    for change in [{"owner_id": "dev-user-123"}, {"visibility": "private"}, {"status": "pending"}]:
        field, value = next(iter(change.items()))
        original = Database.fetch_one("SELECT * FROM media_assets WHERE id=?", (image["id"],))[field]
        Database.execute(f"UPDATE media_assets SET {field}=? WHERE id=?", (value, image["id"]))
        assert client.post("/api/heritage/articles", headers=ADMIN, json=story([item])).status_code == 422
        Database.execute(f"UPDATE media_assets SET {field}=? WHERE id=?", (original, image["id"]))
    for items in [[item, item], [item] * 13, [{"media_id": "missing"}]]:
        assert client.post("/api/heritage/articles", headers=ADMIN, json=story(items)).status_code == 422


def test_edit_permissions_content_category_and_retained_images(png_bytes):
    Database.execute("UPDATE user_roles SET role='stylist' WHERE user_id=?", ("dev-user-123",))
    author = {"Authorization": auth_header("dev-user-123")}
    image = upload_image(png_bytes, author)
    payload = story([{"media_id": image["id"], "caption": "Nguồn gốc"}])
    created = client.post("/api/heritage/articles", headers=author, json=payload).json()
    path = f"/api/heritage/articles/{created['id']}"
    payload.update(category="Thể loại tự viết", full_content="Toàn bộ nội dung mới đã được chỉnh sửa và lưu lại.", expected_version=1)
    assert client.put(path, headers=author, json=payload).status_code == 200
    payload["expected_version"] = 2
    assert client.put(path, headers=ADMIN, json=payload).status_code == 200
    detail = client.get(path).json()
    assert detail["full_content"] == payload["full_content"]
    assert detail["category"] == "Thể loại tự viết"
    assert detail["images"][0]["media_id"] == image["id"]
    assert detail["author_id"] == "dev-user-123"
    assert detail["slug"] == created["slug"]
    Database.execute("UPDATE user_roles SET role='stylist' WHERE user_id=?", ("dev-user-media-1",))
    assert client.put(path, headers={"Authorization": auth_header("dev-user-media-1")}, json=payload).status_code == 403


def test_concurrent_edit_rejects_stale_write():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    payload = story([])
    created = client.post("/api/heritage/articles", headers=ADMIN, json=payload).json()
    path = f"/api/heritage/articles/{created['id']}"
    barrier = Barrier(2)
    def save(title):
        barrier.wait()
        return client.put(path, headers=ADMIN, json={**payload, "title": title, "expected_version": 1})
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(save, ["First editor title", "Second editor title"]))
    assert sorted(r.status_code for r in responses) == [200, 409]
    conflict = next(r for r in responses if r.status_code == 409)
    assert conflict.json()["error"]["code"] == "ARTICLE_VERSION_CONFLICT"
    current = client.get(path).json()
    assert current["version"] == 2
    assert current["title"] == next(r for r in responses if r.status_code == 200).json()["title"]
    assert client.put(path, headers=ADMIN, json=payload).status_code == 422


def test_shared_gallery_and_cover_protect_media_until_last_reference_removed(png_bytes):
    image = upload_image(png_bytes)
    first = client.post("/api/heritage/articles", headers=ADMIN, json=story([{"media_id": image["id"]}])).json()
    second = client.post("/api/heritage/articles", headers=ADMIN, json={**story([]), "cover_image_url": image["public_url"]}).json()
    assert client.delete(f"/api/media/{image['id']}", headers=ADMIN).status_code == 409
    assert client.delete(f"/api/heritage/articles/{first['id']}", headers=ADMIN).status_code == 200
    assert client.get(image["public_url"]).status_code == 200
    assert client.delete(f"/api/heritage/articles/{second['id']}", headers=ADMIN).status_code == 200
    assert client.get(image["public_url"]).status_code != 200
    assert Database.fetch_one("SELECT status FROM media_assets WHERE id=?", (image["id"],))["status"] == "deleted"


def test_removed_image_cleanup_survives_storage_failure_and_retries(png_bytes, monkeypatch):
    from app.infrastructure.r2.client import r2_client
    from app.modules.media.service import MediaService
    image = upload_image(png_bytes)
    created = client.post("/api/heritage/articles", headers=ADMIN, json=story([{"media_id": image["id"]}])).json()
    original = r2_client.delete_object
    monkeypatch.setattr(r2_client, "delete_object", lambda *args: False)
    response = client.put(f"/api/heritage/articles/{created['id']}", headers=ADMIN,
                          json={**story([]), "expected_version": 1})
    assert response.status_code == 200
    assert response.json()["media_cleanup_pending"] == 1
    assert Database.fetch_one("SELECT status FROM media_assets WHERE id=?", (image["id"],))["status"] == "deleting"
    assert client.post("/api/heritage/articles", headers=ADMIN, json=story([{"media_id": image["id"]}])).status_code == 422
    monkeypatch.setattr(r2_client, "delete_object", original)
    Database.execute("UPDATE media_assets SET next_reconcile_at=0 WHERE id=?", (image["id"],))
    assert MediaService.cleanup()["failed"] == 0
    assert Database.fetch_one("SELECT status FROM media_assets WHERE id=?", (image["id"],))["status"] == "deleted"


def test_library_reference_is_not_deleted_with_story(png_bytes):
    image = upload_image(png_bytes)
    Database.execute("UPDATE accounts SET avatar_url=? WHERE id=?", (image["public_url"], "dev-user-admin"))
    created = client.post("/api/heritage/articles", headers=ADMIN, json=story([{"media_id": image["id"]}])).json()
    assert client.delete(f"/api/heritage/articles/{created['id']}", headers=ADMIN).status_code == 200
    assert client.get(image["public_url"]).status_code == 200


def test_whitespace_is_validated_before_story_creation():
    assert client.post("/api/heritage/articles", headers=ADMIN, json={**story([]), "title": "   "}).status_code == 422
