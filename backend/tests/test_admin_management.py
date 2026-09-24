from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Database
from conftest import auth_header

client = TestClient(app)


def headers(user="dev-user-admin"):
    return {"Authorization": auth_header(user)}


def test_only_admin_can_grant_stylist_and_revoke_existing_token():
    member = headers("dev-user-test-1")
    story = {"title": "Test story", "slug": "test-story", "short_summary": "A summary", "full_content": "Content"}
    assert client.get("/api/admin/users", headers=member).status_code == 403
    assert client.patch("/api/admin/users/dev-user-test-1", headers=member, json={"is_stylist": True}).status_code == 403
    res = client.patch("/api/admin/users/dev-user-test-1", headers=headers(), json={"is_stylist": True})
    assert res.status_code == 200, res.text
    assert "stylist" in client.get("/api/auth/me", headers=member).json()["roles"]
    assert client.get("/api/admin/users", headers=member).status_code == 403
    assert client.patch("/api/admin/users/dev-user-test-1", headers=headers(), json={"is_stylist": False}).status_code == 200
    assert client.post("/api/heritage/articles", headers=member, json=story).status_code == 403
    assert client.get("/api/auth/me", headers=member).json()["roles"] == ["user"]
    assert client.patch("/api/admin/users/dev-user-test-1", headers=headers(), json={"is_active": False}).status_code == 200
    assert client.get("/api/auth/me", headers=member).status_code == 401
    assert client.patch("/api/admin/users/dev-user-test-1", headers=headers(), json={"is_active": True}).status_code == 200
    assert client.get("/api/auth/me", headers=member).status_code == 200


def test_admin_account_protection_and_no_self_registration_privileges():
    assert client.patch("/api/admin/users/dev-user-admin", headers=headers(), json={"is_active": False}).status_code == 409
    assert client.patch("/api/admin/users/dev-user-test-1", headers=headers(), json={"roles": ["admin"]}).status_code == 422
    for role in ("admin", "stylist", "editor"):
        assert client.post("/api/auth/register", json={"email": "new@example.invalid", "password": "a-secure-password", "display_name": "Student", "role": role}).status_code == 422
    page = client.get("/api/admin/users?search=dev-user-test-1&limit=1", headers=headers()).json()
    assert page["total"] == 1 and len(page["items"]) == 1
    assert not ({"password_hash", "salt", "provider_id"} & page["items"][0].keys())
    Database.execute("INSERT INTO user_roles(id,user_id,role) VALUES('editor-role','dev-user-123','editor')")
    assert client.get("/api/admin/users", headers=headers("dev-user-123")).status_code == 403


def test_admin_catalog_crud_and_historical_item_protection():
    assert client.post("/api/admin/garment-types", headers=headers(), json={"id":"new-group","name":"Nhóm mới"}).status_code == 200
    item = {"id":"new-item","name":"Áo mới","slot":"outerwear","garment_type_id":"new-group","is_published":False}
    assert client.post("/api/admin/items", headers=headers(), json=item).status_code == 200
    assert client.get("/api/catalog/items/new-item").status_code == 404
    page = client.get("/api/admin/items?search=Áo mới", headers=headers()).json()
    assert page["total"] == 1
    item.update(name="Áo đã sửa", is_published=True)
    assert client.put("/api/admin/items/new-item", headers=headers(), json=item).status_code == 200
    assert client.get("/api/catalog/items/new-item").json()["name"] == "Áo đã sửa"
    assert client.delete("/api/admin/items/new-item", headers=headers()).status_code == 200
    outfit = client.post("/api/outfits", headers=headers("dev-user-test-1"), json={"title":"Bộ phối", "snapshot":{"items":[{"slot":"outerwear","itemId":"item_ngu_than_nam_xanh"}]}})
    assert outfit.status_code == 200
    assert client.delete("/api/admin/items/item_ngu_than_nam_xanh", headers=headers()).status_code == 409


def test_catalog_crud_cannot_bypass_photographic_recolor_review():
    photo_item = {
        "id": "recolor-review-gate",
        "name": "Áo cần đánh giá ảnh",
        "slot": "outerwear",
        "garment_type_id": "ngu_than",
        "is_published": True,
        "metadata": {
            "catalog_media_id": "photo-source-v1",
            "catalog_image_version": "v1",
        },
    }
    create_approved = {**photo_item, "id": "recolor-create-bypass", "metadata": {
        **photo_item["metadata"], "studio_recolor_approved": True,
    }}
    rejected_create = client.post("/api/admin/items", headers=headers(), json=create_approved)
    assert rejected_create.status_code == 409
    assert rejected_create.json()["error"]["code"] == "STUDIO_RECOLOR_APPROVAL_REQUIRES_REVIEW"

    assert client.post("/api/admin/items", headers=headers(), json=photo_item).status_code == 200
    request_approval = {**photo_item, "metadata": {
        **photo_item["metadata"], "studio_recolor_approved": True,
    }}
    rejected_update = client.put(
        "/api/admin/items/recolor-review-gate", headers=headers(), json=request_approval,
    )
    assert rejected_update.status_code == 409
    assert rejected_update.json()["error"]["code"] == "STUDIO_RECOLOR_APPROVAL_REQUIRES_REVIEW"

    Database.execute(
        "UPDATE items SET metadata=? WHERE id=?",
        ('{"catalog_media_id":"photo-source-v1","catalog_image_version":"v1","studio_recolor_approved":true}', "recolor-review-gate"),
    )
    changed_source = {**photo_item, "metadata": {
        "catalog_media_id": "photo-source-v2",
        "catalog_image_version": "v2",
        "studio_recolor_approved": True,
    }}
    stale_approval = client.put(
        "/api/admin/items/recolor-review-gate", headers=headers(), json=changed_source,
    )
    assert stale_approval.status_code == 409

    revoked = {**changed_source, "metadata": {
        "catalog_media_id": "photo-source-v2",
        "catalog_image_version": "v2",
        "studio_recolor_approved": False,
    }}
    assert client.put("/api/admin/items/recolor-review-gate", headers=headers(), json=revoked).status_code == 200
    public_item = client.get("/api/catalog/items/recolor-review-gate")
    assert public_item.status_code == 200
    assert public_item.json()["color_change_supported"] is False


def test_admin_manages_foreign_outfit_without_changing_owner_and_preserves_cas():
    member = headers("dev-user-test-1")
    outfit = client.post("/api/outfits", headers=member, json={"title":"Student look","snapshot":{}}).json()
    path = '/api/admin/outfits/' + outfit['id']
    assert client.get(path, headers=member).status_code == 403
    assert client.get('/api/outfits/' + outfit['id'], headers=headers()).status_code == 404
    assert client.get('/api/admin/outfits', headers=headers()).json()['total'] == 1
    payload = {"title":"Reviewed look", "snapshot":outfit["current_snapshot"],"revision":outfit["revision"]}
    changed = client.put(path, headers=headers(), json=payload)
    assert changed.status_code == 200, changed.text
    assert changed.json()['owner_id'] == 'dev-user-test-1'
    assert client.put(path, headers=headers(), json=payload).status_code == 409
    assert client.delete(path, headers=headers()).status_code == 200
    assert client.get('/api/outfits/' + outfit['id'], headers=member).status_code == 404


def test_admin_manages_private_lookbook_and_overview():
    book = client.post('/api/lookbooks', headers=headers('dev-user-test-1'), json={"title":"Private book", "visibility":"private"}).json()
    path = '/api/admin/lookbooks/' + book['id']
    listed = client.get('/api/admin/lookbooks', headers=headers())
    assert listed.status_code == 200, listed.text
    assert listed.json()['items'][0]['title'] == 'Private book'
    assert client.put(path, headers=headers(), json={"title":"Reviewed book"}).status_code == 200
    assert client.get('/api/admin/overview', headers=headers()).json()['lookbooks'] == 1
    assert client.delete(path, headers=headers()).status_code == 200
