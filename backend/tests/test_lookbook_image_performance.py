import io
import threading
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

from PIL import Image

from app.modules.media import image_cache
from app.modules.media.repository import MediaRepository
from test_lookbook_community import client, headers, publish, source


def request_image(url, **extra_headers):
    parts = urlsplit(url)
    return client.get(parts.path + '?' + parts.query, headers=extra_headers)


def test_cached_public_image_revalidates_access_before_304(png_bytes, monkeypatch):
    post, payload, _ = publish(png_bytes)
    feed = client.get('/api/lookbook-posts').json()['items'][0]
    assert client.get('/api/lookbook-posts').json()['items'][0]['image_url'] == feed['image_url']
    # Completion already supplied the validated bytes; no storage read is needed.
    monkeypatch.setattr(image_cache.r2_client, 'read_object', lambda *args: (_ for _ in ()).throw(AssertionError('Image downloaded twice')))
    first = request_image(feed['image_url'])
    assert first.status_code == 200 and first.content == png_bytes
    assert first.headers['cache-control'] == 'private, no-cache, must-revalidate'
    again = request_image(feed['image_url'], **{'If-None-Match': first.headers['etag']})
    assert again.status_code == 304 and again.content == b''
    owner = request_image(post['image_url'], **{'If-None-Match': first.headers['etag']})
    assert owner.status_code == 200 and owner.headers['cache-control'] == 'private, no-store'
    changed = client.put('/api/lookbook-posts/' + post['id'], headers=headers(), json={**payload, 'visibility': 'private', 'revision': 1})
    assert changed.status_code == 200
    assert request_image(feed['image_url'], **{'If-None-Match': first.headers['etag']}).status_code == 404


def test_parallel_viewers_share_one_download_and_disk_cache_is_bounded(png_bytes, monkeypatch):
    monkeypatch.setattr(image_cache, '_queue_display', lambda *args: None)
    asset = {'id': 'cold-image', 'bucket': 'private', 'object_key': 'assets/cold.png', 'mime_type': 'image/png'}
    started, release = threading.Event(), threading.Event()
    reads = []

    def read(*args):
        reads.append(args)
        started.set()
        assert release.wait(3)
        return png_bytes

    monkeypatch.setattr(image_cache.r2_client, 'read_object', read)
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(image_cache.get_image, asset) for _ in range(6)]
        assert started.wait(3)
        release.set()
        assert all(job.result(timeout=3).data == png_bytes for job in futures)
    assert len(reads) == 1
    assert image_cache.get_image(asset).data == png_bytes and len(reads) == 1
    monkeypatch.setattr(image_cache, '_MAX_CACHE_FILES', 2)
    monkeypatch.setattr(image_cache, '_MAX_CACHE_BYTES', len(png_bytes) * 2)
    for n in range(4):
        image_cache.prime_image({**asset, 'id': str(n), 'object_key': f'assets/{n}.png'}, png_bytes)
    folder = image_cache._paths(asset)[0].parent
    files = list(folder.glob('*.image'))
    assert len(files) <= 2 and sum(p.stat().st_size for p in files) <= len(png_bytes) * 2


def test_webp_keeps_every_pixel_including_transparent_rgb():
    image = Image.new('RGBA', (80, 80))
    image.putdata([(x * 3 % 256, y * 3 % 256, (x + y) % 256, 0 if x % 4 == 0 else 255) for y in range(80) for x in range(80)])
    output = io.BytesIO()
    image.save(output, 'PNG', compress_level=0)
    original = output.getvalue()
    result = image_cache.lossless_display(original, 'image/png', 4_000_000)
    assert len(result) < len(original)
    with Image.open(io.BytesIO(result)) as decoded:
        assert decoded.format == 'WEBP' and decoded.size == image.size
        assert decoded.convert('RGBA').tobytes() == image.tobytes()
    assert image_cache.lossless_display(original, 'image/png', 100) == original
    assert image_cache.accepts_webp('image/avif,image/webp,image/*;q=0.8')
    assert image_cache.accepts_webp('image/webp;q=0.5')
    assert not image_cache.accepts_webp('image/webp;q=0.0,*/*;q=1')
    assert not image_cache.accepts_webp('*/*')


def test_deleting_uploaded_image_removes_cached_copies(png_bytes):
    _, media_id = source(png_bytes)
    asset = MediaRepository.get_media_by_id(media_id)
    original, display = image_cache._paths(asset)
    assert original.exists()
    response = client.delete('/api/media/' + media_id, headers=headers())
    assert response.status_code == 200
    assert not original.exists() and not display.exists()
