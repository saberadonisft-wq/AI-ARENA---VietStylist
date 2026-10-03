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
    payload.update(category="Thể loại tự viết", full_content="Toàn bộ nội dung mới đã được chỉnh sửa và lưu lại.")
    assert client.put(path, headers=author, json=payload).status_code == 200
    assert client.put(path, headers=ADMIN, json=payload).status_code == 200
    detail = client.get(path).json()
    assert detail["full_content"] == payload["full_content"]
    assert detail["category"] == "Thể loại tự viết"
    assert detail["images"][0]["media_id"] == image["id"]
    assert detail["author_id"] == "dev-user-123"
    assert detail["slug"] == created["slug"]
    Database.execute("UPDATE user_roles SET role='stylist' WHERE user_id=?", ("dev-user-media-1",))
    assert client.put(path, headers={"Authorization": auth_header("dev-user-media-1")}, json=payload).status_code == 403
