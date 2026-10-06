import hashlib
from urllib.parse import urlsplit
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Database
from app.core.config import settings
from conftest import auth_header

client = TestClient(app)
OWNER = 'dev-user-test-1'
OTHER = 'dev-user-123'
ADMIN = 'dev-user-admin'


def headers(user=OWNER, key='first-publication'):
    return {'Authorization': auth_header(user), 'Idempotency-Key': key}


def source(png_bytes, user=OWNER):
    outfit = client.post('/api/outfits', headers=headers(user), json={'title': 'Áo tấc', 'snapshot': {'items': [], 'styleMode': 'traditional'}}).json()
    upload = client.post('/api/media/uploads', headers=headers(user), json={'filename': 'look.png', 'mime_type': 'image/png', 'size_bytes': len(png_bytes), 'visibility': 'private'}).json()
    assert client.post(upload['upload_url'], files={'file': ('look.png', png_bytes, 'image/png')}).status_code == 200
    assert client.post('/api/media/' + upload['media_id'] + '/complete', headers=headers(user), json={}).status_code == 200
    return outfit, upload['media_id']


def publish(png_bytes, visibility='public', key='first-publication'):
    outfit, media = source(png_bytes)
    payload = {'title': 'Áo tấc đi lễ', 'description': 'Bản phối thử nghiệm', 'visibility': visibility,
               'outfit_version_id': outfit['current_version_id'], 'cover_media_id': media}
    response = client.post('/api/lookbook-posts', headers=headers(key=key), json=payload)
    assert response.status_code == 200, response.text
    return response.json(), payload, outfit


def image(url):
    parts = urlsplit(url)
    return client.get(parts.path + '?' + parts.query)


def test_guest_feed_and_owner_private_access(png_bytes):
    public, _, _ = publish(png_bytes)
    private, _, _ = publish(png_bytes, 'private', 'private')
    unlisted, _, _ = publish(png_bytes, 'unlisted', 'unlisted')
    feed = client.get('/api/lookbook-posts').json()
    assert [p['id'] for p in feed['items']] == [public['id']]
    assert 'snapshot' not in feed['items'][0]
    assert 'email' not in feed['items'][0]['author']
    for post in [private, unlisted]:
        assert client.get('/api/lookbook-posts/' + post['id']).status_code == 404
        assert client.get('/api/lookbook-posts/' + post['id'], headers=headers(OTHER)).status_code == 404
        assert client.get('/api/lookbook-posts/' + post['id'], headers=headers()).status_code == 200
    assert image(public['image_url']).content == png_bytes
    assert image(public['image_url']).headers['cache-control'] == 'private, no-store'
    assert client.get('/api/lookbook-posts/mine').status_code == 401


def test_idempotency_and_source_ownership(png_bytes):
    post, payload, outfit = publish(png_bytes)
    retry = client.post('/api/lookbook-posts', headers=headers(), json=payload)
    assert retry.json()['id'] == post['id']
    assert len(client.get('/api/lookbook-posts/mine', headers=headers()).json()['items']) == 1
    assert client.post('/api/lookbook-posts', headers=headers(), json={**payload, 'title': 'Khác'}).status_code == 409
    assert client.post('/api/lookbook-posts', headers=headers(OTHER), json=payload).status_code == 422
    _, other_image = source(png_bytes, OTHER)
    assert client.post('/api/lookbook-posts', headers=headers(key='foreign-image'), json={**payload, 'cover_media_id': other_image}).status_code == 422
    assert client.put('/api/lookbook-posts/' + post['id'], headers=headers(OTHER), json={**payload, 'revision': 1}).status_code == 404
    assert client.delete('/api/lookbook-posts/' + post['id'], headers=headers(OTHER)).status_code == 404


def test_private_transition_revokes_images_links_and_redacts_favorites(png_bytes):
    post, payload, _ = publish(png_bytes)
    for _ in range(2):
        assert client.put('/api/lookbook-posts/' + post['id'] + '/favorite', headers=headers(OTHER)).status_code == 200
    favorite = client.get('/api/lookbook-posts/favorites', headers=headers(OTHER)).json()
    assert len(favorite['items']) == 1
    assert favorite['items'][0]['post']['is_favorite']
    share = client.post('/api/lookbook-posts/' + post['id'] + '/shares', headers=headers(), json={'expires_in_days': 7}).json()
    changed = client.put('/api/lookbook-posts/' + post['id'], headers=headers(), json={**payload, 'visibility': 'private', 'revision': 1})
    assert changed.status_code == 200
    assert image(post['image_url']).status_code == 404
    assert client.get('/api/lookbook-posts/shares/' + share['share_token']).status_code == 404
    assert client.get('/api/lookbook-posts/favorites', headers=headers(OTHER)).json()['items'][0]['post'] is None
    assert client.post('/api/lookbook-posts/' + post['id'] + '/shares', headers=headers(), json={}).status_code == 409
    assert client.put('/api/lookbook-posts/' + post['id'], headers=headers(), json={**payload, 'revision': 1}).status_code == 409
    assert client.put('/api/lookbook-posts/' + post['id'], headers=headers(), json={**payload, 'visibility': 'unlisted', 'revision': 2}).status_code == 200
    assert client.get('/api/lookbook-posts/shares/' + share['share_token']).status_code == 404
    assert client.delete('/api/lookbook-posts/' + post['id'] + '/favorite', headers=headers(OTHER)).status_code == 200


def test_unlisted_links_expiration_individual_and_all_revoke(png_bytes):
    post, _, _ = publish(png_bytes, 'unlisted')
    endpoint = '/api/lookbook-posts/' + post['id'] + '/shares'
    one = client.post(endpoint, headers=headers(), json={'expires_in_days': 1}).json()
    two = client.post(endpoint, headers=headers(), json={'expires_in_days': 30}).json()
    shared = client.get('/api/lookbook-posts/shares/' + one['share_token']).json()
    assert shared['id'] == post['id']
    assert image(shared['image_url']).status_code == 200
    assert client.put('/api/lookbook-posts/' + post['id'] + '/favorite', headers=headers(OTHER)).status_code == 404
    assert client.get(endpoint, headers=headers(OTHER)).status_code == 404
    listed = client.get(endpoint, headers=headers()).json()
    assert len(listed) == 2 and all('token_hash' not in item and 'share_token' not in item for item in listed)
    assert client.delete(endpoint + '/' + one['id'], headers=headers()).status_code == 200
    assert image(shared['image_url']).status_code == 404
    assert client.get('/api/lookbook-posts/shares/' + two['share_token']).status_code == 200
    Database.execute('UPDATE lookbook_post_shares SET expires_at=? WHERE id=?', ('2000-01-01', two['id']))
    assert client.get('/api/lookbook-posts/shares/' + two['share_token']).status_code == 410
    assert client.delete(endpoint, headers=headers()).status_code == 200
    assert client.get('/api/lookbook-posts/shares/' + two['share_token']).status_code == 404


def test_public_token_image_is_revoked_independently_of_public_page(png_bytes):
    post, _, _ = publish(png_bytes)
    share = client.post('/api/lookbook-posts/' + post['id'] + '/shares', headers=headers(), json={}).json()
    shared = client.get('/api/lookbook-posts/shares/' + share['share_token']).json()
    assert image(shared['image_url']).status_code == 200
    assert client.delete('/api/lookbook-posts/' + post['id'] + '/shares/' + share['id'], headers=headers()).status_code == 200
    assert image(shared['image_url']).status_code == 404
    assert image(client.get('/api/lookbook-posts/' + post['id']).json()['image_url']).status_code == 200


def test_version_freeze_and_deleting_source(png_bytes):
    post, _, outfit = publish(png_bytes, 'unlisted')
    share = client.post('/api/lookbook-posts/' + post['id'] + '/shares', headers=headers(), json={}).json()
    assert client.put('/api/outfits/' + outfit['id'], headers=headers(), json={'revision': 1, 'snapshot': {'items': [], 'styleMode': 'remix'}}).status_code == 200
    assert client.get('/api/lookbook-posts/' + post['id'], headers=headers()).json()['snapshot']['styleMode'] == 'traditional'
    assert client.delete('/api/media/' + post['cover_media_id'], headers=headers()).status_code == 409
    assert client.delete('/api/outfits/' + outfit['id'], headers=headers()).status_code == 200
    assert client.get('/api/lookbook-posts/shares/' + share['share_token']).status_code == 404
    assert image(post['image_url']).status_code == 404
    assert Database.fetch_one('SELECT is_deleted FROM lookbook_posts WHERE id=?', (post['id'],))['is_deleted'] == 1


def test_search_cursor_profile_and_feature_flag(png_bytes, monkeypatch):
    for n in range(3):
        publish(png_bytes, key=str(n))
    page = client.get('/api/lookbook-posts?limit=2&q=đi lễ&style=traditional').json()
    assert len(page['items']) == 2 and page['next_cursor']
    second = client.get('/api/lookbook-posts', params={'limit': 2, 'q': 'đi lễ', 'style': 'traditional', 'cursor': page['next_cursor']}).json()
    assert len(second['items']) == 1
    assert {p['id'] for p in page['items']}.isdisjoint({p['id'] for p in second['items']})
    assert client.get('/api/lookbook-posts?cursor=broken').status_code == 422
    assert client.get('/api/lookbook-posts?q=%25').json()['items'] == []
    assert client.put('/api/lookbook-posts/profile', headers=headers(), json={'bio': 'Yêu Việt phục'}).status_code == 200
    profile = client.get('/api/lookbook-posts/profiles/' + OWNER).json()
    assert profile['bio'] == 'Yêu Việt phục' and 'email' not in profile
    monkeypatch.setattr(settings, 'LOOKBOOK_COMMUNITY_ENABLED', False)
    assert client.get('/api/lookbook-posts').status_code == 503
    assert client.get('/api/lookbooks', headers=headers()).status_code == 200


def test_reports_and_moderation_cannot_be_overridden_by_author(png_bytes):
    post, payload, _ = publish(png_bytes)
    assert client.post('/api/lookbook-posts/' + post['id'] + '/reports', headers=headers(OTHER), json={'reason': 'spam'}).status_code == 200
    assert client.post('/api/lookbook-posts/' + post['id'] + '/reports', headers=headers(OTHER), json={'reason': 'spam'}).status_code == 200
    assert len(client.get('/api/lookbook-posts').json()['items']) == 1
    assert client.get('/api/lookbook-posts/moderation/reports', headers=headers(OTHER)).status_code == 403
    reports = client.get('/api/lookbook-posts/moderation/reports', headers=headers(ADMIN)).json()
    assert len(reports['items']) == 1
    moderation = '/api/lookbook-posts/moderation/' + post['id']
    assert client.put(moderation, headers=headers(ADMIN), json={'hidden': True, 'reason': 'Đã xem xét báo cáo', 'revision': 1}).status_code == 200
    assert client.get('/api/lookbook-posts').json()['items'] == []
    assert image(post['image_url']).status_code == 404
    assert client.put('/api/lookbook-posts/' + post['id'], headers=headers(), json={**payload, 'revision': 2}).status_code == 200
    assert client.get('/api/lookbook-posts').json()['items'] == []
    assert client.get('/api/lookbook-posts/' + post['id'], headers=headers()).json()['moderation_reason']
    assert client.put(moderation, headers=headers(ADMIN), json={'hidden': False, 'reason': 'Đã sửa nội dung', 'revision': 3}).status_code == 200
    assert len(client.get('/api/lookbook-posts').json()['items']) == 1


def test_legacy_private_lookbook_share_is_fail_closed():
    lookbook = client.post('/api/lookbooks', headers=headers(), json={'title': 'Riêng tư', 'visibility': 'private'}).json()
    endpoint = '/api/lookbooks/' + lookbook['id']
    assert client.post(endpoint + '/share', headers=headers(), json={}).status_code == 409
    token = 'legacy-token'
    Database.execute('INSERT INTO share_links(id,lookbook_id,token_hash,token_plain_prefix,scope) VALUES(?,?,?,?,?)', ('legacy', lookbook['id'], hashlib.sha256(token.encode()).hexdigest(), 'legacy', 'view_only'))
    assert client.get('/api/shares/' + token).status_code == 404
    assert client.put(endpoint, headers=headers(), json={'visibility': 'unlisted'}).status_code == 200
    assert client.put(endpoint, headers=headers(), json={'visibility': 'private'}).status_code == 200
    assert client.put(endpoint, headers=headers(), json={'visibility': 'unlisted'}).status_code == 200
    assert client.get('/api/shares/' + token).status_code == 404
