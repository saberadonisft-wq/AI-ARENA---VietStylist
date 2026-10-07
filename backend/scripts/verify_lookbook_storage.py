"""Opt-in R2 verification with a disposable database and synthetic private media.

Run from the repository root. Credentials are read from backend/.env, never printed.
Only synthetic objects created by this probe are deleted.
"""
import io
import os
from pathlib import Path
import secrets
import sys
import tempfile


def main():
    from dotenv import dotenv_values
    from PIL import Image
    import httpx
    values = dotenv_values(Path(__file__).resolve().parents[1] / '.env')
    required = ('R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY')
    if not all(values.get(key) for key in required):
        print('R2 probe unavailable: credentials are not configured.')
        return 2
    with tempfile.TemporaryDirectory(prefix='viet-lookbook-r2-') as directory:
        os.environ.update({key: values[key] for key in required})
        os.environ.update({key: values[key] for key in ('R2_BUCKET_PRIVATE', 'R2_BUCKET_PUBLIC') if values.get(key)})
        os.environ.update({'VIETSTYLIST_IGNORE_DOTENV': '1', 'ENVIRONMENT': 'test', 'DEBUG': 'false',
                           'DATABASE_URL': 'sqlite:///' + str(Path(directory) / 'probe.db'), 'SUPABASE_DATABASE_URL': '',
                           'LOCAL_MEDIA_DIR': str(Path(directory) / 'media'), 'LOCAL_MEDIA_ENABLED': 'false',
                           'JWT_SIGNING_SECRET': secrets.token_urlsafe(48), 'GEMINI_API_KEY': '', 'GOOGLE_CLIENT_ID': '',
                           'API_PUBLIC_ORIGIN': 'http://testserver', 'FRONTEND_PUBLIC_ORIGIN': 'http://testserver'})
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.database import Database
        from app.infrastructure.r2.client import r2_client
        objects = []
        try:
            with TestClient(app) as client:
                auth = client.post('/api/auth/register', json={'email': secrets.token_hex(8) + '@example.invalid',
                                   'password': secrets.token_urlsafe(24), 'display_name': 'Disposable Lookbook R2 probe'})
                assert auth.status_code == 200
                headers = {'Authorization': 'Bearer ' + auth.json()['access_token'], 'Idempotency-Key': secrets.token_hex(16)}
                outfit = client.post('/api/outfits', headers=headers, json={'title': 'Synthetic probe', 'snapshot': {'items': []}}).json()
                stream = io.BytesIO()
                Image.new('RGB', (32, 48), '#b92e32').save(stream, format='PNG')
                content = stream.getvalue()
                upload = client.post('/api/media/uploads', headers=headers, json={'filename': 'synthetic.png',
                                     'mime_type': 'image/png', 'visibility': 'private', 'size_bytes': len(content)})
                assert upload.status_code == 200
                session = upload.json()
                record = Database.fetch_one('SELECT staging_bucket,staging_key FROM media_assets WHERE id=?', (session['media_id'],))
                objects.append((record['staging_bucket'], record['staging_key']))
                response = httpx.put(session['upload_url'], content=content, headers={'Content-Type': 'image/png'}, timeout=30)
                assert response.is_success, 'Presigned upload failed'
                complete = client.post('/api/media/' + session['media_id'] + '/complete', headers=headers, json={})
                assert complete.status_code == 200, 'R2 completion failed'
                record = Database.fetch_one('SELECT bucket,object_key FROM media_assets WHERE id=?', (session['media_id'],))
                objects.append((record['bucket'], record['object_key']))
                payload = {'title': 'Synthetic probe', 'visibility': 'public', 'outfit_version_id': outfit['current_version_id'], 'cover_media_id': session['media_id']}
                post = client.post('/api/lookbook-posts', headers=headers, json=payload)
                assert post.status_code == 200
                public = client.get('/api/lookbook-posts/' + post.json()['id']).json()
                image = client.get(public['image_url'])
                assert image.status_code == 200 and image.content == content
                assert image.headers['cache-control'] == 'private, no-store'
                changed = client.put('/api/lookbook-posts/' + post.json()['id'], headers=headers, json={**payload, 'visibility': 'private', 'revision': 1})
                assert changed.status_code == 200
                assert client.get(public['image_url']).status_code == 404
                assert client.get(changed.json()['image_url']).content == content
                assert client.delete('/api/lookbook-posts/' + post.json()['id'], headers=headers).status_code == 200
                assert client.delete('/api/media/' + session['media_id'], headers=headers).status_code == 200
                print('R2 verified: presigned upload, completion, exact image bytes, private revocation, cleanup.')
        finally:
            failures = []
            for bucket, key in objects:
                if not r2_client.delete_object(bucket, key):
                    failures.append(True)
            if failures:
                raise RuntimeError('Synthetic R2 probe object cleanup did not complete')
        return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        # SDK/HTTP exceptions can contain signed URLs; report only the exception class.
        print('R2 probe failed:', type(exc).__name__)
        raise SystemExit(1)
