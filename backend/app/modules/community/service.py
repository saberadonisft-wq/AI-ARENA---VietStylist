"""Version-bound publications. Authorization is also checked when serving image bytes."""
import base64
import hashlib
import json
import secrets
import uuid
import time
from functools import lru_cache
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from app.core.config import settings
from app.core.database import Database, db_transaction
from app.core.errors import AppError
from app.modules.community.schemas import Author, PostCard, PostDetail
from app.modules.media.grant_utils import create_media_grant, verify_media_grant

IMAGE_JOIN = """ FROM lookbook_posts p
JOIN outfit_versions v ON v.id=p.outfit_version_id
JOIN outfits o ON o.id=v.outfit_id AND o.owner_id=p.owner_id
JOIN accounts a ON a.id=p.owner_id
JOIN media_assets m ON m.id=p.cover_media_id """
JOIN = IMAGE_JOIN + "LEFT JOIN lookbook_public_profiles pr ON pr.owner_id=p.owner_id "
SELECT = """SELECT p.*, v.snapshot_json,v.version_number,o.id AS outfit_id,
 a.display_name,a.avatar_url,a.is_active,pr.bio,m.status AS media_status,
 m.bucket,m.object_key,m.mime_type,o.is_deleted AS outfit_deleted """
AVAILABLE = "p.is_deleted=0 AND o.is_deleted=0 AND a.is_active=1 AND m.status='ready'"
PUBLIC = AVAILABLE + " AND p.visibility='public' AND p.moderation_status='visible'"


def now():
    return datetime.now(timezone.utc).isoformat()


def missing():
    raise AppError('POST_NOT_FOUND', 'Bộ phối không còn khả dụng.', 404)


def encode_cursor(stamp, identity):
    return base64.urlsafe_b64encode(json.dumps([stamp, identity]).encode()).decode()


def decode_cursor(value):
    if not value:
        return None
    try:
        pair = json.loads(base64.urlsafe_b64decode(value))
        if not isinstance(pair, list) or len(pair) != 2 or not all(isinstance(s, str) and len(s) <= 100 for s in pair):
            raise ValueError()
        return pair
    except (ValueError, TypeError):
        raise AppError('INVALID_CURSOR', 'Vị trí danh sách không hợp lệ.', 422)


def page_where(where, args, cursor, column, id_column='p.id'):
    pair = decode_cursor(cursor)
    if pair:
        where += f' AND ({column}<? OR ({column}=? AND {id_column}<?))'
        args.extend([pair[0], pair[0], pair[1]])
    return where


def row(post_id, conn=None):
    return Database.fetch_one(SELECT + JOIN + ' WHERE p.id=?', (post_id,), conn)


def owned(post_id, user_id, conn=None):
    r = row(post_id, conn)
    if not r or r['owner_id'] != user_id or r['is_deleted'] or r['outfit_deleted']:
        missing()
    return r


def readable(r, user_id=None, share_hash=None, conn=None):
    if not r or r['is_deleted'] or r['outfit_deleted'] or not r['is_active'] or r['media_status'] != 'ready':
        missing()
    if user_id == r['owner_id']:
        return 'owner'
    if r['moderation_status'] != 'visible':
        missing()
    if r['visibility'] == 'public':
        return 'public'
    if r['visibility'] == 'unlisted' and share_hash:
        share = Database.fetch_one('SELECT * FROM lookbook_post_shares WHERE token_hash=? AND post_id=? AND revoked_at IS NULL', (share_hash, r['id']), conn)
        if share and share['expires_at'] > now():
            return 'share:' + share_hash
    missing()


def author(r):
    return Author(id=r['owner_id'], display_name=r['display_name'], avatar_url=r.get('avatar_url'), bio=r.get('bio') or '')


@lru_cache(maxsize=2048)
def image_grant(media_id, purpose, window, secret_version):
    # Stable URL for four minutes; the grant still lives at most five minutes,
    # and has at least one minute left when issued near a window boundary.
    return create_media_grant(media_id, purpose, window * 240 + 300 - int(time.time()))


def card(r, user_id=None, access='public', detail=False, favorite=False):
    snap = r['snapshot_json']
    if isinstance(snap, str):
        snap = json.loads(snap)
    purpose = f"post:{r['id']}:{r['revision']}:{access}"
    secret_version = hashlib.sha256(settings.get_jwt_secret().encode()).hexdigest()
    grant = image_grant(r['cover_media_id'], purpose, int(time.time()) // 240, secret_version)
    image = settings.API_PUBLIC_ORIGIN.rstrip('/') + f"/api/lookbook-posts/{r['id']}/image?" + urlencode({'purpose': purpose, 'grant': grant})
    values = dict(id=r['id'], author=author(r), title=r['title'], description=r['description'],
                  visibility=r['visibility'], moderation_status=r['moderation_status'],
                  moderation_reason=r['moderation_reason'] if user_id == r['owner_id'] else '',
                  revision=r['revision'], image_url=image, style_mode=snap.get('styleMode', 'traditional'),
                  occasion_id=snap.get('occasionId'), is_favorite=favorite,
                  created_at=r['created_at'], updated_at=r['updated_at'], published_at=r['published_at'])
    if detail:
        return PostDetail(**values, outfit_id=r['outfit_id'], outfit_version_id=r['outfit_version_id'],
                          cover_media_id=r['cover_media_id'], version_number=r['version_number'], snapshot=snap)
    return PostCard(**values)


def is_favorite(post_id, user_id):
    return bool(user_id and Database.fetch_one('SELECT 1 FROM lookbook_favorites WHERE user_id=? AND post_id=?', (user_id, post_id)))


def get_post(post_id, user_id=None, share_hash=None):
    r = row(post_id)
    access = readable(r, user_id, share_hash)
    if share_hash and user_id != r['owner_id']:
        access = 'share:' + share_hash
    return card(r, user_id, access, detail=True, favorite=is_favorite(post_id, user_id))


def list_posts(user_id=None, *, mine=False, owner_id=None, visibility=None, q='', style=None, occasion=None, cursor=None, limit=18):
    where = AVAILABLE if mine else PUBLIC
    args = []
    if mine or owner_id:
        where += ' AND p.owner_id=?'
        args.append(user_id if mine else owner_id)
    if mine and visibility:
        where += ' AND p.visibility=?'
        args.append(visibility)
    if q:
        # Literal search, including percent and underscore characters.
        term = '%' + q.casefold().replace('!', '!!').replace('%', '!%').replace('_', '!_') + '%'
        where += " AND p.search_title LIKE ? ESCAPE '!'"
        args.append(term)
    # Snapshot settings are stored on the immutable version; use SQL JSON only for filters.
    json_get = (lambda key: f"v.snapshot_json::jsonb->>'{key}'") if settings.is_postgres() else (lambda key: f"json_extract(v.snapshot_json,'$.{key}')")
    for key, value in [('styleMode', style), ('occasionId', occasion)]:
        if value:
            where += f' AND {json_get(key)}=?'
            args.append(value)
    stamp = 'p.created_at' if mine else 'p.published_at'
    where = page_where(where, args, cursor, stamp)
    rows = Database.fetch_all(SELECT + JOIN + f' WHERE {where} ORDER BY {stamp} DESC,p.id DESC LIMIT ?', tuple(args + [limit + 1]))
    selected = rows[:limit]
    favorites = set()
    if user_id and selected:
        ids = [r['id'] for r in selected]
        favorites = {r['post_id'] for r in Database.fetch_all('SELECT post_id FROM lookbook_favorites WHERE user_id=? AND post_id IN (' + ','.join('?' for _ in ids) + ')', tuple([user_id] + ids))}
    return dict(items=[card(r, user_id, 'owner' if mine else 'public', favorite=r['id'] in favorites) for r in selected],
                next_cursor=encode_cursor(selected[-1]['created_at' if mine else 'published_at'], selected[-1]['id']) if len(rows) > limit else None)


def validate_source(req, user_id, conn):
    version = Database.fetch_one('SELECT v.id FROM outfit_versions v JOIN outfits o ON o.id=v.outfit_id WHERE v.id=? AND o.owner_id=? AND o.is_deleted=0', (req.outfit_version_id, user_id), conn)
    media = Database.fetch_one("SELECT id FROM media_assets WHERE id=? AND owner_id=? AND status='ready' AND media_type='image' AND visibility='private'", (req.cover_media_id, user_id), conn)
    if not version:
        raise AppError('INVALID_OUTFIT_VERSION', 'Chọn phiên bản bộ phối thuộc tài khoản của bạn.', 422)
    if not media:
        raise AppError('INVALID_POST_IMAGE', 'Ảnh bài đăng phải được tải hoàn tất vào kho riêng tư của bạn.', 422)


def create_post(req, user_id, request_key):
    digest = hashlib.sha256(req.model_dump_json().encode()).hexdigest()
    with db_transaction() as conn:
        previous = Database.fetch_one('SELECT id,request_hash,is_deleted FROM lookbook_posts WHERE owner_id=? AND request_key=?', (user_id, request_key), conn)
        if previous:
            if previous['request_hash'] != digest:
                raise AppError('IDEMPOTENCY_CONFLICT', 'Lần đăng này đã được dùng cho nội dung khác.', 409)
            if previous['is_deleted']:
                raise AppError('POST_DELETED', 'Bài của lần đăng này đã bị xóa.', 409)
            post_id = previous['id']
        else:
            validate_source(req, user_id, conn)
            post_id, stamp = str(uuid.uuid4()), now()
            conn.execute('INSERT INTO lookbook_posts(id,owner_id,outfit_version_id,cover_media_id,title,search_title,description,visibility,request_key,request_hash,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                         (post_id, user_id, req.outfit_version_id, req.cover_media_id, req.title, req.title.casefold(), req.description, req.visibility, request_key, digest, stamp, stamp, stamp if req.visibility == 'public' else None))
    return get_post(post_id, user_id)


def update_post(post_id, req, user_id):
    with db_transaction() as conn:
        r = owned(post_id, user_id, conn)
        if r['revision'] != req.revision:
            raise AppError('REVISION_CONFLICT', 'Bài đăng đã thay đổi ở một phiên khác. Nội dung đang sửa vẫn được giữ.', 409)
        validate_source(req, user_id, conn)
        stamp = now()
        published = (r['published_at'] or stamp) if req.visibility == 'public' else None
        conn.execute('UPDATE lookbook_posts SET outfit_version_id=?,cover_media_id=?,title=?,search_title=?,description=?,visibility=?,revision=revision+1,updated_at=?,published_at=? WHERE id=?',
                     (req.outfit_version_id, req.cover_media_id, req.title, req.title.casefold(), req.description, req.visibility, stamp, published, post_id))
        if req.visibility == 'private' or (r['visibility'] != req.visibility):
            conn.execute('UPDATE lookbook_post_shares SET revoked_at=? WHERE post_id=? AND revoked_at IS NULL', (stamp, post_id))
    return get_post(post_id, user_id)


def delete_post(post_id, user_id):
    with db_transaction() as conn:
        owned(post_id, user_id, conn)
        conn.execute('UPDATE lookbook_posts SET is_deleted=1,revision=revision+1,updated_at=? WHERE id=?', (now(), post_id))
        conn.execute('UPDATE lookbook_post_shares SET revoked_at=? WHERE post_id=? AND revoked_at IS NULL', (now(), post_id))


def favorite(post_id, user_id, save):
    with db_transaction() as conn:
        if save:
            r = row(post_id, conn)
            readable(r, None, conn=conn)
            if r['visibility'] != 'public':
                missing()
            conn.execute('INSERT INTO lookbook_favorites(user_id,post_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,post_id) DO NOTHING', (user_id, post_id, now()))
        else:
            conn.execute('DELETE FROM lookbook_favorites WHERE user_id=? AND post_id=?', (user_id, post_id))
    return {'saved': save}


def favorites(user_id, cursor=None, limit=18):
    args = [user_id]
    where = page_where('f.user_id=?', args, cursor, 'f.created_at', 'f.post_id')
    rows = Database.fetch_all(SELECT + ',f.post_id,f.created_at AS saved_at' + JOIN + f' JOIN lookbook_favorites f ON f.post_id=p.id WHERE {where} ORDER BY f.created_at DESC,f.post_id DESC LIMIT ?', tuple(args + [limit + 1]))
    entries = []
    for saved in rows[:limit]:
        r = saved
        try:
            readable(r)
            post = card(r, user_id, favorite=True)
        except AppError:
            post = None
        entries.append(dict(post_id=saved['post_id'], saved_at=saved['saved_at'], post=post))
    return dict(items=entries, next_cursor=encode_cursor(rows[limit - 1]['saved_at'], rows[limit - 1]['post_id']) if len(rows) > limit else None)


def create_share(post_id, user_id, days):
    token = secrets.token_urlsafe(32)
    stamp = now()
    expires = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    share_id = str(uuid.uuid4())
    with db_transaction() as conn:
        r = owned(post_id, user_id, conn)
        if r['visibility'] == 'private' or r['moderation_status'] != 'visible':
            raise AppError('SHARE_NOT_ALLOWED', 'Chọn Công khai hoặc Người có liên kết trước khi chia sẻ.', 409)
        conn.execute('INSERT INTO lookbook_post_shares(id,post_id,token_hash,token_prefix,expires_at,created_at) VALUES(?,?,?,?,?,?)',
                     (share_id, post_id, hashlib.sha256(token.encode()).hexdigest(), token[:8], expires, stamp))
    return dict(id=share_id, token_prefix=token[:8], created_at=stamp, expires_at=expires, revoked_at=None,
                share_token=token, share_url=settings.FRONTEND_PUBLIC_ORIGIN.rstrip('/') + '/lookbook/chia-se/' + token)


def shares(post_id, user_id):
    owned(post_id, user_id)
    return Database.fetch_all('SELECT id,token_prefix,created_at,expires_at,revoked_at FROM lookbook_post_shares WHERE post_id=? ORDER BY created_at DESC', (post_id,))


def revoke_shares(post_id, user_id, share_id=None):
    with db_transaction() as conn:
        owned(post_id, user_id, conn)
        conn.execute('UPDATE lookbook_post_shares SET revoked_at=? WHERE post_id=? AND revoked_at IS NULL' + (' AND id=?' if share_id else ''), tuple([now(), post_id] + ([share_id] if share_id else [])))


def resolve_share(token, user_id=None):
    hashed = hashlib.sha256(token.encode()).hexdigest()
    share = Database.fetch_one('SELECT * FROM lookbook_post_shares WHERE token_hash=? AND revoked_at IS NULL', (hashed,))
    if not share:
        raise AppError('SHARE_NOT_FOUND', 'Liên kết không tồn tại hoặc đã bị thu hồi.', 404)
    if share['expires_at'] <= now():
        raise AppError('SHARE_EXPIRED', 'Liên kết chia sẻ đã hết hạn.', 410)
    return get_post(share['post_id'], user_id, hashed)


def image_asset(post_id, purpose, grant):
    # Image access needs current permission/storage fields, not the complete
    # outfit snapshot, description or author's public profile.
    r = Database.fetch_one("""SELECT p.id,p.owner_id,p.revision,p.visibility,p.moderation_status,p.is_deleted,
        p.cover_media_id,a.is_active,o.is_deleted AS outfit_deleted,m.status AS media_status,
        m.bucket,m.object_key,m.mime_type""" + IMAGE_JOIN + ' WHERE p.id=?', (post_id,))
    if not r or len(purpose) > 300 or not verify_media_grant(grant, r['cover_media_id'], purpose):
        missing()
    prefix = f"post:{r['id']}:{r['revision']}:"
    if not purpose.startswith(prefix):
        missing()
    access = purpose[len(prefix):]
    if access == 'owner':
        readable(r, r['owner_id'])
    elif access == 'public':
        if readable(r) != 'public':
            missing()
    elif access.startswith('share:'):
        readable(r, share_hash=access[6:])
        # Revocation is checked even when the publication remains public.
        share = Database.fetch_one('SELECT expires_at FROM lookbook_post_shares WHERE post_id=? AND token_hash=? AND revoked_at IS NULL', (post_id, access[6:]))
        if not share or share['expires_at'] <= now():
            missing()
    else:
        missing()
    return r


def profile(owner_id):
    r = Database.fetch_one('SELECT a.id AS owner_id,a.display_name,a.avatar_url,pr.bio FROM accounts a LEFT JOIN lookbook_public_profiles pr ON pr.owner_id=a.id WHERE a.id=? AND a.is_active=1', (owner_id,))
    if not r:
        missing()
    return author(r)


def update_profile(user_id, bio):
    Database.execute('INSERT INTO lookbook_public_profiles(owner_id,bio) VALUES(?,?) ON CONFLICT(owner_id) DO UPDATE SET bio=excluded.bio', (user_id, bio))
    return profile(user_id)


def report(post_id, user_id, req):
    with db_transaction() as conn:
        readable(row(post_id, conn))
        conn.execute('INSERT INTO lookbook_reports(id,post_id,reporter_id,reason,details,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(post_id,reporter_id) DO NOTHING', (str(uuid.uuid4()), post_id, user_id, req.reason, req.details, now()))


def reports(cursor=None, limit=18):
    args = []
    where = page_where("r.status='open'", args, cursor, 'r.created_at', 'r.id')
    rows = Database.fetch_all(f'SELECT r.* FROM lookbook_reports r WHERE {where} ORDER BY r.created_at DESC,r.id DESC LIMIT ?', tuple(args + [limit + 1]))
    result = []
    for report_row in rows[:limit]:
        r = row(report_row['post_id'])
        result.append(dict(**{k: report_row[k] for k in ['id', 'post_id', 'reason', 'details', 'status', 'created_at']},
                           post=card(r, access='owner', detail=True) if r and not r['is_deleted'] and not r['outfit_deleted'] else None))
    return dict(items=result, next_cursor=encode_cursor(rows[limit - 1]['created_at'], rows[limit - 1]['id']) if len(rows) > limit else None)


def hidden_posts(cursor=None, limit=18):
    args = []
    where = page_where(AVAILABLE + " AND p.moderation_status='hidden'", args, cursor, 'p.created_at')
    rows = Database.fetch_all(SELECT + JOIN + f' WHERE {where} ORDER BY p.created_at DESC,p.id DESC LIMIT ?', tuple(args + [limit + 1]))
    return dict(items=[card(r, r['owner_id'], 'owner', detail=True) for r in rows[:limit]],
                next_cursor=encode_cursor(rows[limit - 1]['created_at'], rows[limit - 1]['id']) if len(rows) > limit else None)


def resolve_report(report_id):
    Database.execute("UPDATE lookbook_reports SET status='resolved',resolved_at=? WHERE id=? AND status='open'", (now(), report_id))


def moderate(post_id, req):
    with db_transaction() as conn:
        r = row(post_id, conn)
        if not r or r['is_deleted']:
            missing()
        if r['revision'] != req.revision:
            raise AppError('REVISION_CONFLICT', 'Bài đã thay đổi. Tải lại trước khi duyệt.', 409)
        conn.execute('UPDATE lookbook_posts SET moderation_status=?,moderation_reason=?,revision=revision+1,updated_at=? WHERE id=?', ('hidden' if req.hidden else 'visible', req.reason.strip(), now(), post_id))
        if req.hidden:
            conn.execute('UPDATE lookbook_post_shares SET revoked_at=? WHERE post_id=? AND revoked_at IS NULL', (now(), post_id))
        conn.execute("UPDATE lookbook_reports SET status='resolved',resolved_at=? WHERE post_id=? AND status='open'", (now(), post_id))
