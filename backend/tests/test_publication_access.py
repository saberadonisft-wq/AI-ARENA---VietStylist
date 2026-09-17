import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Database
from app.core.security import create_access_token


def test_r09_unpublished_catalog_item_is_hidden(isolated_runtime):
    """R09: Unpublished catalog items return 404 on public detail and are excluded from list"""
    client = TestClient(app, raise_server_exceptions=False)

    published_id = f"item_pub_{uuid.uuid4().hex[:6]}"
    unpublished_id = f"item_unpub_{uuid.uuid4().hex[:6]}"

    Database.execute("""
        INSERT INTO items (id, garment_type_id, name, slot, gender, era, is_published)
        VALUES (?, 'ngu_than', 'Áo đã xuất bản', 'outerwear', 'unisex', 'nguyen', 1)
    """, (published_id,))

    Database.execute("""
        INSERT INTO items (id, garment_type_id, name, slot, gender, era, is_published)
        VALUES (?, 'ngu_than', 'Áo nháp chưa duyệt', 'outerwear', 'unisex', 'nguyen', 0)
    """, (unpublished_id,))

    # Public list check
    list_res = client.get("/api/catalog/items")
    assert list_res.status_code == 200
    item_ids = [item["id"] for item in list_res.json()]
    assert published_id in item_ids
    assert unpublished_id not in item_ids

    # Published item detail check
    detail_pub = client.get(f"/api/catalog/items/{published_id}")
    assert detail_pub.status_code == 200
    assert detail_pub.json()["name"] == "Áo đã xuất bản"

    # Unpublished item detail check: MUST return 404
    detail_unpub = client.get(f"/api/catalog/items/{unpublished_id}")
    assert detail_unpub.status_code == 404
    assert detail_unpub.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_r09_draft_heritage_article_is_hidden(isolated_runtime):
    """R09: Draft heritage articles return 404 on public detail and are excluded from list"""
    client = TestClient(app, raise_server_exceptions=False)

    pub_slug = f"pub-article-{uuid.uuid4().hex[:6]}"
    draft_slug = f"draft-article-{uuid.uuid4().hex[:6]}"

    Database.execute("""
        INSERT INTO heritage_articles (
            id, title, slug, short_summary, full_content, status
        ) VALUES (?, 'Bài viết công khai', ?, 'Tóm tắt', 'Nội dung', 'published')
    """, (f"art_{pub_slug}", pub_slug))

    Database.execute("""
        INSERT INTO heritage_articles (
            id, title, slug, short_summary, full_content, status
        ) VALUES (?, 'Bài viết nháp nội bộ', ?, 'Tóm tắt', 'Nội dung', 'draft')
    """, (f"art_{draft_slug}", draft_slug))

    # Public list check
    list_res = client.get("/api/heritage/articles")
    assert list_res.status_code == 200
    slugs = [a["slug"] for a in list_res.json()]
    assert pub_slug in slugs
    assert draft_slug not in slugs

    # Published article detail
    detail_pub = client.get(f"/api/heritage/articles/{pub_slug}")
    assert detail_pub.status_code == 200

    # Draft article detail: MUST return 404
    detail_draft = client.get(f"/api/heritage/articles/{draft_slug}")
    assert detail_draft.status_code == 404
    assert detail_draft.json()["error"]["code"] == "ARTICLE_NOT_FOUND"

