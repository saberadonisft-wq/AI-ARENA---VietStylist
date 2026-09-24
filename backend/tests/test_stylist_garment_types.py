from fastapi.testclient import TestClient
import io
from PIL import Image

from app.core.database import Database
from app.main import app
from conftest import auth_header


client = TestClient(app)


def headers(user_id: str):
    return {"Authorization": auth_header(user_id)}


def test_stylist_can_create_shared_garment_type_but_student_cannot():
    payload = {
        "id": "stylist_group_giao_linh_test",
        "name": "Nhóm áo giao lĩnh do stylist đề xuất",
    }

    denied = client.post("/api/stylist/garment-types", headers=headers("dev-user-test-1"), json=payload)
    assert denied.status_code == 403

    Database.execute(
        "INSERT INTO user_roles(id,user_id,role) VALUES(?,?,?)",
        ("stylist-role-test", "dev-user-test-1", "stylist"),
    )
    created = client.post("/api/stylist/garment-types", headers=headers("dev-user-test-1"), json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["id"] == payload["id"]
    assert created.json()["name"] == payload["name"]

    catalog = client.get("/api/catalog/garment-types")
    assert any(item["id"] == payload["id"] for item in catalog.json())

    duplicate_name = client.post(
        "/api/stylist/garment-types",
        headers=headers("dev-user-test-1"),
        json={"id": "stylist_group_giao_linh_duplicate", "name": payload["name"]},
    )
    assert duplicate_name.status_code == 409


def test_admin_can_create_garment_type_from_stylist_endpoint():
    created = client.post(
        "/api/stylist/garment-types",
        headers=headers("dev-user-admin"),
        json={"id": "admin_group_stylist_endpoint", "name": "Nhóm mới từ admin"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["is_active"] is True


def test_stylist_upload_stores_cutout_png_before_submission():
    from app.modules.media.service import MediaService

    Database.execute("INSERT INTO user_roles(id,user_id,role) VALUES(?,?,?)",
                     ("stylist-upload-role", "dev-user-test-1", "stylist"))
    picture = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    for x in range(12, 28):
        for y in range(5, 35):
            picture.putpixel((x, y), (252, 250, 245, 255))
    data = io.BytesIO()
    picture.save(data, format="PNG")

    uploaded = client.post("/api/stylist/garment-image", headers=headers("dev-user-test-1"),
                           files={"file": ("white-garment.png", data.getvalue(), "image/png")})
    assert uploaded.status_code == 201, uploaded.text
    media = uploaded.json()
    assert media["mime_type"] == "image/png"
    assert media["visibility"] == "private"
    assert media["status"] == "ready"
    stored, mime_type = MediaService.read_owned_image(media["id"], "dev-user-test-1")
    assert mime_type == "image/png"
    with Image.open(io.BytesIO(stored)) as result:
        assert result.mode == "RGBA"
        assert result.size == (24, 38)
        assert result.getpixel((0, 0))[3] == 0
        assert result.getpixel((12, 20))[:3] == (252, 250, 245)


def test_invalid_stylist_upload_creates_no_media_record():
    Database.execute("INSERT INTO user_roles(id,user_id,role) VALUES(?,?,?)",
                     ("stylist-invalid-role", "dev-user-test-1", "stylist"))
    before = Database.fetch_one("SELECT count(*) AS total FROM media_assets")["total"]
    response = client.post("/api/stylist/garment-image", headers=headers("dev-user-test-1"),
                           files={"file": ("fake.png", b"not an image", "image/png")})
    assert response.status_code == 422
    assert Database.fetch_one("SELECT count(*) AS total FROM media_assets")["total"] == before
