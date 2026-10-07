import { expect, test, type Page, type Route } from '@playwright/test';
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#f4eee3"/><path d="M90 50L45 100L65 150L100 125L85 350H215L200 125L235 150L255 100L210 50Z" fill="#b92e32"/></svg>');
const author = { id: 'author', display_name: 'Minh Anh', bio: 'Yêu Việt phục', avatar_url: null };
const post = { id: 'post-1', author, title: 'Áo tấc đón Tết', description: 'Bộ phối đầu xuân.', visibility: 'public', moderation_status: 'visible', moderation_reason: '', revision: 1, image_url: image, style_mode: 'traditional', occasion_id: 'tet', is_favorite: false, created_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z', published_at: '2026-10-06T00:00:00Z', outfit_id: 'outfit-1', outfit_version_id: 'version-1', cover_media_id: 'cover-1', version_number: 1, snapshot: { items: [], styleMode: 'traditional', aspectRatio: '9:16' } };
async function setup(page: Page, loggedIn = false, mine = false) {
  if (loggedIn) await page.addInitScript(({ mine }) => { localStorage.setItem('viet_stylist_auth_token','test'); localStorage.setItem('viet_stylist_user',JSON.stringify({ id: mine ? 'author' : 'reader', displayName: 'Bạn đọc', email: 'test@example.invalid', roles: ['user'] })); }, { mine });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { id: mine ? 'author' : 'reader', display_name: 'Bạn đọc', email: 'test@example.invalid', roles: ['user'] } });
    if (path === '/api/catalog/occasions') return route.fulfill({ json: [{ id:'tet', name:'Tết' }] });
    if (path === '/api/lookbook-posts' || path === '/api/lookbook-posts/mine') return route.fulfill({ json: { items: [post], next_cursor: null } });
    if (path === '/api/lookbook-posts/favorites') return route.fulfill({ json: { items: [{ post_id: post.id, saved_at: post.created_at, post: { ...post, is_favorite: true } }, { post_id: 'missing', saved_at: post.created_at, post: null }], next_cursor: null } });
    if (path === '/api/lookbook-posts/post-1') return route.fulfill({ json: post });
    if (path === '/api/lookbook-posts/post-1/favorite' || path === '/api/lookbook-posts/missing/favorite') return route.fulfill({ json: { saved: route.request().method() === 'PUT' } });
    if (path === '/api/lookbook-posts/post-1/shares') return route.fulfill({ json: [] });
    if (path === '/api/outfits/page') return route.fulfill({ json: { items: [], next_cursor: null } });
    if (path === '/api/outfits' || path.startsWith('/api/catalog/')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Không khả dụng.' } } });
  });
}

const publishingDraft = { title: 'Bộ phối chờ xử lý ảnh', description: 'Giữ nguyên bản phối và nội dung khi thử lại.', visibility: 'public', version: 'version-1', requestKey: 'cover-retry-key' };
const publishingSnapshot = { schemaVersion: 1, avatarId: 'avatar_nam_chuan', poseId: 'front_01', overlapDirection: 'right_over_left', lockedSlots: [], items: [{ slot: 'outerwear', itemId: 'shirt-1', assetVersion: 1, colorHex: '#553C9A', transform: { dx: 12, dy: 5, scale: 1.2, rotation: 15 } }], styleMode: 'traditional', aspectRatio: '9:16', backgroundTheme: 'white', neutralBackgroundTheme: 'white', backgroundFade: 0 };
type CoverUploadState = { sessions: number; transfers: number; completes: string[]; ready: boolean; publications: { key: string; payload: Record<string, unknown> }[] };

async function setupCoverPublication(page: Page, complete: (route: Route, state: CoverUploadState) => Promise<void>, options: { draft?: Record<string, unknown>; outfits?: Record<string, unknown>[]; blockPostStorageWrites?: boolean; extraStoredDrafts?: Record<string, unknown> } = {}) {
  await setup(page, true, true);
  const draft: Record<string, unknown> = options.draft || publishingDraft;
  await page.addInitScript(({ value, blockWrites, extraDrafts }) => {
    sessionStorage.setItem('viet_lookbook_post:author:new', JSON.stringify(value));
    for (const [key, stored] of Object.entries(extraDrafts || {})) sessionStorage.setItem(key, JSON.stringify(stored));
    if (blockWrites) {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, stored) {
        if (key.startsWith('viet_lookbook_post:')) throw new DOMException('Blocked receipt rewrite', 'SecurityError');
        return setItem.call(this, key, stored);
      };
    }
  }, { value: draft, blockWrites: options.blockPostStorageWrites, extraDrafts: options.extraStoredDrafts });
  await page.route('**/api/outfits/page?*', route => route.fulfill({ json: { items: options.outfits || [{ id: 'outfit-1', title: 'Bộ phối gốc', current_version_id: 'version-1', current_snapshot: publishingSnapshot }], next_cursor: null } }));
  await page.route('**/api/outfits/versions/version-1', route => route.fulfill({ json: { id: 'version-1', outfit_id: 'outfit-1', version_number: 1, snapshot: publishingSnapshot, created_at: post.created_at } }));
  await page.route('**/api/catalog/items?*', route => route.fulfill({ json: [{ id: 'shirt-1', slot: 'outerwear', name: 'Áo ngũ thân', is_published: true, metadata: {}, variants: [], default_layer: { item_id: 'shirt-1', svg_content: '<rect x="100" y="200" width="400" height="600" fill="VAR_COLOR_PRIMARY"/>' } }] }));
  const state: CoverUploadState = { sessions: 0, transfers: 0, completes: [], ready: Boolean(draft.media), publications: [] };
  await page.route('**/api/media/uploads', route => {
    state.sessions++;
    expect(route.request().postDataJSON()).toMatchObject({ filename: 'lookbook.png', mime_type: 'image/png', media_type: 'image', visibility: 'private' });
    const mediaId = state.sessions === 1 ? 'cover-pending' : `cover-pending-${state.sessions}`;
    return route.fulfill({ json: { media_id: mediaId, method: 'PUT', storage_type: 'r2', upload_url: `http://127.0.0.1:3100/api/test-upload/${mediaId}` } });
  });
  await page.route('**/api/test-upload/*', route => {
    state.transfers++;
    const png = route.request().postDataBuffer()!;
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.length).toBeGreaterThan(1000);
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/media/*/complete', async route => {
    state.completes.push(new URL(route.request().url()).pathname);
    expect(route.request().method()).toBe('POST');
    await complete(route, state);
  });
  await page.route('**/api/lookbook-posts', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(state.ready).toBe(true);
    const payload = route.request().postDataJSON();
    state.publications.push({ key: route.request().headers()['idempotency-key'], payload });
    return route.fulfill({ json: { ...post, ...payload, snapshot: publishingSnapshot } });
  });
  await page.goto('/lookbook');
  await expect(page.getByRole('button', { name: /Bạn đọc/ })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'Đăng bộ phối' });
  await expect(editor.getByLabel('Bộ phối đã lưu')).toHaveValue(publishingDraft.version);
  await expect(editor.locator('[id$="item-transform-outerwear"]')).toHaveAttribute('transform', /rotate\(15\) scale\(1\.2\)/);
  await expect(editor.locator('[id$="content-outerwear"] rect')).toHaveAttribute('fill', '#553C9A');
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  return { editor, state };
}

async function expectPublishingDraft(page: Page) {
  const editor = page.getByRole('dialog', { name: 'Đăng bộ phối' });
  await expect(editor.getByLabel('Tiêu đề', { exact: true })).toHaveValue(publishingDraft.title);
  await expect(editor.getByRole('textbox', { name: 'Mô tả', exact: true })).toHaveValue(publishingDraft.description);
  await expect(editor.getByLabel('Ai có thể xem?')).toHaveValue(publishingDraft.visibility);
  await expect(editor.getByLabel('Bộ phối đã lưu')).toHaveValue(publishingDraft.version);
  await expect(editor.locator('[id$="item-transform-outerwear"]')).toHaveAttribute('transform', /rotate\(15\) scale\(1\.2\)/);
  await expect(editor.locator('[id$="content-outerwear"] rect')).toHaveAttribute('fill', '#553C9A');
}

async function completeReadyCover(route: Route, state: CoverUploadState) {
  state.ready = true;
  await route.fulfill({ json: { id: new URL(route.request().url()).pathname.split('/')[3], status: 'ready' } });
}

async function expectNoStoredOutfit(page: Page) {
  const stored = await page.evaluate(() => [localStorage, sessionStorage].flatMap(storage =>
    Object.keys(storage).filter(key => key.startsWith('viet_lookbook_post:')).map(key => storage.getItem(key))));
  for (const value of stored) {
    expect(value).not.toMatch(/"(?:source|snapshot|items|createDocument|savedDocument|fingerprint)"\s*:/);
    expect(value).not.toContain('shirt-1');
    expect(value).not.toContain('#553C9A');
  }
}

test('publication waits for image completion beyond ten seconds and creates exactly one post', async ({ page }) => {
  test.setTimeout(60000);
  const { editor, state } = await setupCoverPublication(page, async (route, upload) => {
    await new Promise(resolve => setTimeout(resolve, 11000));
    upload.ready = true;
    await route.fulfill({ json: { id: 'cover-pending', status: 'ready' } });
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect.poll(() => state.completes.length).toBe(1);
  expect(state.publications).toHaveLength(0);
  await expectPublishingDraft(page);
  await expect(editor.getByRole('button', { name: 'Đang lưu…', exact: true })).toBeDisabled();
  await expect(editor).toHaveCount(0, { timeout: 20000 });
  expect(state.sessions).toBe(1);
  expect(state.transfers).toBe(1);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete']);
  expect(state.publications).toEqual([{ key: publishingDraft.requestKey, payload: { title: publishingDraft.title, description: publishingDraft.description, visibility: publishingDraft.visibility, outfit_version_id: publishingDraft.version, cover_media_id: 'cover-pending' } }]);
});

test('lost image completion response survives closing and reopening without another upload or request key', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, async (route, upload) => {
    // The server committed the image before its response was lost.
    upload.ready = true;
    if (upload.completes.length === 1) await route.abort('failed');
    else await route.fulfill({ json: { id: 'cover-pending', status: 'ready' } });
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Không thể kết nối');
  expect(state.publications).toHaveLength(0);
  await expectPublishingDraft(page);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('viet_lookbook_post:author:new')!));
  expect(saved).toMatchObject({ ...publishingDraft, pendingMedia: 'cover-pending' });
  await expectNoStoredOutfit(page);
  await editor.getByRole('button', { name: 'Đóng cửa sổ đăng bài' }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
  await expectPublishingDraft(page);
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.sessions).toBe(1);
  expect(state.transfers).toBe(1);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete', '/api/media/cover-pending/complete']);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0]).toMatchObject({ key: publishingDraft.requestKey, payload: { outfit_version_id: publishingDraft.version, cover_media_id: 'cover-pending', title: publishingDraft.title, description: publishingDraft.description, visibility: publishingDraft.visibility } });
});

test('image completion conflict keeps the pending upload and does not claim a previous post succeeded', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, async (route, upload) => {
    if (upload.completes.length === 1) {
      await route.fulfill({ status: 409, json: { error: { code: 'INVALID_UPLOAD_STATE', message: 'Ảnh đang được xử lý. Hãy thử lại.' } } });
    } else {
      upload.ready = true;
      await route.fulfill({ json: { id: 'cover-pending', status: 'ready' } });
    }
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Ảnh đang được xử lý. Hãy thử lại.');
  await expect(editor.getByRole('alert')).not.toContainText('Lần đăng trước có thể đã thành công');
  await expect(editor.getByRole('link', { name: 'Kiểm tra bài của tôi' })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Dùng nội dung này cho bài mới' })).toHaveCount(0);
  expect(state.publications).toHaveLength(0);
  await expectPublishingDraft(page);
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.sessions).toBe(1);
  expect(state.transfers).toBe(1);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete', '/api/media/cover-pending/complete']);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0].key).toBe(publishingDraft.requestKey);
});

test('successful image completion response must be ready before a post is created', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, async (route, upload) => {
    if (upload.completes.length === 1) {
      await route.fulfill({ json: { id: 'cover-pending', status: 'processing' } });
    } else {
      upload.ready = true;
      await route.fulfill({ json: { id: 'cover-pending', status: 'ready' } });
    }
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Ảnh bộ phối chưa sẵn sàng');
  await expect(editor.getByRole('link', { name: 'Kiểm tra bài của tôi' })).toHaveCount(0);
  expect(state.publications).toHaveLength(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('viet_lookbook_post:author:new')!))).toMatchObject({ ...publishingDraft, pendingMedia: 'cover-pending' });
  await expectPublishingDraft(page);
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.sessions).toBe(1);
  expect(state.transfers).toBe(1);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete', '/api/media/cover-pending/complete']);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0]).toMatchObject({ key: publishingDraft.requestKey, payload: { cover_media_id: 'cover-pending', outfit_version_id: publishingDraft.version } });
});

test('invalid image content clears the rejected upload so manual retry creates a fresh image', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, async (route, upload) => {
    if (upload.completes.length === 1) {
      await route.fulfill({ status: 422, json: { error: { code: 'INVALID_MEDIA_CONTENT', message: 'Ảnh tải lên không hợp lệ. Tạo lại ảnh để thử lại.' } } });
    } else {
      upload.ready = true;
      await route.fulfill({ json: { id: 'cover-pending-2', status: 'ready' } });
    }
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Ảnh tải lên không hợp lệ');
  expect(state.publications).toHaveLength(0);
  await expectPublishingDraft(page);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('viet_lookbook_post:author:new')!));
  expect(saved).toMatchObject(publishingDraft);
  expect(saved.pendingMedia).toBeUndefined();
  expect(saved.media).toBeUndefined();
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.sessions).toBe(2);
  expect(state.transfers).toBe(2);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete', '/api/media/cover-pending-2/complete']);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0]).toMatchObject({ key: publishingDraft.requestKey, payload: { cover_media_id: 'cover-pending-2', outfit_version_id: publishingDraft.version, title: publishingDraft.title, description: publishingDraft.description, visibility: publishingDraft.visibility } });
});

test('an expired pending image can be explicitly recreated without changing the publication draft or key', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, async (route, upload) => {
    if (upload.completes.length === 1) {
      await route.fulfill({ status: 409, json: { error: { code: 'INVALID_UPLOAD_STATE', message: 'Phiên tải ảnh không còn khả dụng.' } } });
    } else {
      upload.ready = true;
      await route.fulfill({ json: { id: 'cover-pending-2', status: 'ready' } });
    }
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Phiên tải ảnh không còn khả dụng.');
  expect(state.publications).toHaveLength(0);
  await editor.getByRole('button', { name: 'Tạo lại ảnh bộ phối', exact: true }).click();
  await expectPublishingDraft(page);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('viet_lookbook_post:author:new')!));
  expect(saved).toMatchObject(publishingDraft);
  expect(saved.pendingMedia).toBeUndefined();
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.sessions).toBe(2);
  expect(state.transfers).toBe(2);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete', '/api/media/cover-pending-2/complete']);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0]).toMatchObject({ key: publishingDraft.requestKey, payload: { cover_media_id: 'cover-pending-2', outfit_version_id: publishingDraft.version, title: publishingDraft.title, description: publishingDraft.description, visibility: publishingDraft.visibility } });
});

test('uncertain publication locks its content across reopening and replays one original post', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, completeReadyCover, { draft: { ...publishingDraft, media: 'cover-pending' } });
  const attempts: { key: string; payload: Record<string, unknown> }[] = [];
  const committed = new Map<string, Record<string, unknown>>();
  let updates = 0;
  await page.route('**/api/lookbook-posts', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const key = route.request().headers()['idempotency-key'];
    const payload = route.request().postDataJSON();
    attempts.push({ key, payload });
    if (!committed.has(key)) committed.set(key, { ...post, ...payload, snapshot: publishingSnapshot });
    if (attempts.length === 1) return route.abort('failed');
    return route.fulfill({ json: committed.get(key) });
  });
  await page.route('**/api/lookbook-posts/post-1', route => {
    if (route.request().method() === 'PUT') updates++;
    return route.fulfill({ json: committed.get(publishingDraft.requestKey) || post });
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'Tiêu đề', exact: true })).toBeDisabled();
  await expect(editor.getByRole('textbox', { name: 'Mô tả', exact: true })).toBeDisabled();
  await expect(editor.getByLabel('Ai có thể xem?')).toBeDisabled();
  await expect(editor.getByLabel('Bộ phối đã lưu')).toBeDisabled();
  await expectPublishingDraft(page);
  await expectNoStoredOutfit(page);
  await editor.getByRole('button', { name: 'Đóng cửa sổ đăng bài' }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
  await expectPublishingDraft(page);
  await expect(editor.getByRole('textbox', { name: 'Tiêu đề', exact: true })).toBeDisabled();
  await expect(editor.getByRole('textbox', { name: 'Mô tả', exact: true })).toBeDisabled();
  await expect(editor.getByLabel('Ai có thể xem?')).toBeDisabled();
  await expect(editor.getByLabel('Bộ phối đã lưu')).toBeDisabled();
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toBe(publishingDraft.requestKey);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(committed.size).toBe(1);
  expect(updates).toBe(0);
  expect(state.sessions).toBe(0);
  expect(state.transfers).toBe(0);
});

test('clean pending publication survives blocked storage writes while legacy outfit payloads are removed', async ({ page }) => {
  const payload = { title: publishingDraft.title, description: publishingDraft.description, visibility: publishingDraft.visibility,
    outfit_version_id: publishingDraft.version, cover_media_id: 'cover-pending' };
  const receipt = { ...publishingDraft, media: 'cover-pending', publication: { requestKey: publishingDraft.requestKey, payload } };
  const dirtySourceKey = 'viet_lookbook_post:author:dirty-source';
  const dirtyPayloadKey = 'viet_lookbook_post:author:dirty-payload';
  const { editor, state } = await setupCoverPublication(page, completeReadyCover, {
    draft: receipt, blockPostStorageWrites: true,
    extraStoredDrafts: {
      [dirtySourceKey]: { ...receipt, source: { snapshot: publishingSnapshot } },
      [dirtyPayloadKey]: { ...receipt, publication: { ...receipt.publication, payload: { ...payload, snapshot: publishingSnapshot } } },
    },
  });
  const stored = await page.evaluate(({ dirtySourceKey, dirtyPayloadKey }) => ({
    receipt: JSON.parse(sessionStorage.getItem('viet_lookbook_post:author:new') || 'null'),
    dirtySource: sessionStorage.getItem(dirtySourceKey), dirtyPayload: sessionStorage.getItem(dirtyPayloadKey),
  }), { dirtySourceKey, dirtyPayloadKey });
  expect(stored).toEqual({ receipt, dirtySource: null, dirtyPayload: null });
  await expectNoStoredOutfit(page);
  await expect(editor.getByRole('textbox', { name: 'Tiêu đề', exact: true })).toBeDisabled();
  await editor.getByRole('button', { name: 'Đóng cửa sổ đăng bài' }).click();
  await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
  await expectPublishingDraft(page);
  await expect(editor.getByRole('textbox', { name: 'Tiêu đề', exact: true })).toBeDisabled();
  // Model a post already committed before its response was lost. The retry
  // must recover that key and payload without creating a second post.
  const committed = new Map([[publishingDraft.requestKey, { ...post, ...payload, snapshot: publishingSnapshot }]]);
  const attempts: Array<{ key: string; payload: Record<string, unknown> }> = [];
  let created = 0;
  await page.route('**/api/lookbook-posts', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const key = route.request().headers()['idempotency-key'];
    const received = route.request().postDataJSON();
    attempts.push({ key, payload: received });
    if (!committed.has(key)) { created++; committed.set(key, { ...post, ...received, snapshot: publishingSnapshot }); }
    return route.fulfill({ json: committed.get(key) });
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(attempts).toEqual([{ key: publishingDraft.requestKey, payload }]);
  expect(created).toBe(0); expect(committed.size).toBe(1);
  expect(state.sessions).toBe(0); expect(state.transfers).toBe(0); expect(state.completes).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.getItem('viet_lookbook_post:author:new'))).toBeNull();
});

test('pending cover reloads its owned snapshot after the outfit gains a newer version without storing it', async ({ page }) => {
  let historicalLoads = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/outfits/versions/version-1') historicalLoads++;
  });
  const { editor, state } = await setupCoverPublication(page, async (route, upload) => {
    if (upload.completes.length === 1) return route.abort('failed');
    return completeReadyCover(route, upload);
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Không thể kết nối');
  await expectNoStoredOutfit(page);
  await editor.getByRole('button', { name: 'Đóng cửa sổ đăng bài' }).click();
  await expect(editor).toHaveCount(0);
  await page.route('**/api/outfits/page?*', route => route.fulfill({ json: { items: [{ id: 'outfit-1', title: 'Bộ phối đã thay đổi', current_version_id: 'version-2', current_snapshot: { ...publishingSnapshot, items: [{ ...publishingSnapshot.items[0], colorHex: '#FFFFFF', transform: { dx: 0, dy: 0, scale: 0.7, rotation: -10 } }] } }], next_cursor: null } }));
  await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
  await expectPublishingDraft(page);
  expect(historicalLoads).toBeGreaterThan(0);
  await expectNoStoredOutfit(page);
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.sessions).toBe(1);
  expect(state.transfers).toBe(1);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete', '/api/media/cover-pending/complete']);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0]).toMatchObject({ key: publishingDraft.requestKey, payload: { outfit_version_id: 'version-1', cover_media_id: 'cover-pending' } });
});

test('a legacy pending draft loads its owned historical version instead of replacing its image', async ({ page }) => {
  let historicalLoads = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/outfits/versions/version-1') historicalLoads++;
  });
  const { editor, state } = await setupCoverPublication(page, completeReadyCover, {
    draft: { ...publishingDraft, pendingMedia: 'cover-pending' },
    outfits: [{ id: 'outfit-1', title: 'Bộ phối mới hơn', current_version_id: 'version-2', current_snapshot: { ...publishingSnapshot, items: [] } }],
  });
  // This request proves the old snapshot was recovered through the owned version API.
  expect(historicalLoads).toBeGreaterThan(0);
  await expectPublishingDraft(page);
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.sessions).toBe(0);
  expect(state.transfers).toBe(0);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete']);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0].payload.outfit_version_id).toBe('version-1');
});

test('composer ignores and removes a legacy stored outfit snapshot while keeping post metadata', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, completeReadyCover, {
    draft: {
      ...publishingDraft, media: 'cover-pending',
      source: { outfitId: 'outfit-1', version: 'version-1', title: 'Legacy local source', snapshot: { ...publishingSnapshot, items: [{ ...publishingSnapshot.items[0], colorHex: '#FFFFFF' }] } },
      snapshot: publishingSnapshot, savedDocument: { snapshot: publishingSnapshot }, createDocument: { snapshot: publishingSnapshot },
    },
  });
  await expectPublishingDraft(page);
  await expectNoStoredOutfit(page);
  await editor.getByRole('textbox', { name: 'Tiêu đề', exact: true }).fill('Chỉ lưu thông tin bài đăng');
  await expectNoStoredOutfit(page);
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.publications).toHaveLength(1);
  expect(state.publications[0].payload.title).toBe('Chỉ lưu thông tin bài đăng');
  expect(state.sessions).toBe(0);
});

test('an old private publication result cannot navigate or close the next account composer', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, completeReadyCover, { draft: { ...publishingDraft, visibility: 'private', media: 'cover-pending' } });
  let releasePost!: () => void;
  let postStarted!: () => void;
  let postSettled!: () => void;
  const started = new Promise<void>(resolve => { postStarted = resolve; });
  const released = new Promise<void>(resolve => { releasePost = resolve; });
  const settled = new Promise<void>(resolve => { postSettled = resolve; });
  await page.route('**/api/lookbook-posts', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    postStarted();
    await released;
    try {
      await route.fulfill({ json: { ...post, ...route.request().postDataJSON(), id: 'private-post-old-account', visibility: 'private', snapshot: publishingSnapshot } });
    } catch { /* The editor aborts its request when the old account unmounts. */ }
    finally { postSettled(); }
  });
  try {
    await editor.getByRole('button', { name: 'Lưu riêng tư', exact: true }).click();
    await started;
    const nextAccount = { id: 'other-account', display_name: 'Tài khoản khác', displayName: 'Tài khoản khác', email: 'other@example.invalid', roles: ['user'] };
    await page.route('**/api/auth/me', route => route.fulfill({ json: nextAccount }));
    await page.route('**/api/outfits/page?*', route => route.fulfill({ json: { items: [], next_cursor: null } }));
    await page.evaluate(account => {
      localStorage.setItem('viet_stylist_auth_token', 'other-account-token');
      localStorage.setItem('viet_stylist_user', JSON.stringify(account));
      window.dispatchEvent(new StorageEvent('storage', { key: 'viet_stylist_auth_token', newValue: 'other-account-token' }));
    }, nextAccount);
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Tài khoản khác/ })).toBeVisible();
    await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
    await expect(editor).toBeVisible();
    releasePost();
    await settled;
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('http://127.0.0.1:3100/lookbook');
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Tiêu đề', exact: true })).toHaveValue('');
    await expect(editor.getByRole('textbox', { name: 'Mô tả', exact: true })).toHaveValue('');
    await expect(editor.getByLabel('Bộ phối đã lưu')).toHaveValue('');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('viet_stylist_user')!).id)).toBe(nextAccount.id);
    expect(state.sessions).toBe(0);
  } finally { releasePost(); }
});

test('a rejected ready cover is regenerated before another publication attempt', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, completeReadyCover, { draft: { ...publishingDraft, media: 'cover-rejected' } });
  const attemptedCovers: string[] = [];
  let created = 0;
  await page.route('**/api/lookbook-posts', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const payload = route.request().postDataJSON();
    attemptedCovers.push(payload.cover_media_id);
    if (attemptedCovers.length === 1) return route.fulfill({ status: 422, json: { error: { code: 'INVALID_POST_IMAGE', message: 'Ảnh bài đăng không còn khả dụng. Tạo lại ảnh để thử lại.' } } });
    created++;
    return route.fulfill({ json: { ...post, ...payload, snapshot: publishingSnapshot } });
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Ảnh bài đăng không còn khả dụng');
  await expectPublishingDraft(page);
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(attemptedCovers).toEqual(['cover-rejected', 'cover-pending']);
  expect(state.sessions).toBe(1);
  expect(state.transfers).toBe(1);
  expect(state.completes).toEqual(['/api/media/cover-pending/complete']);
  expect(created).toBe(1);
});

for (const invalidKey of [{ name: 'missing', value: undefined }, { name: 'malformed', value: 'invalid\nkey' }]) {
  test(`a restored draft with a ${invalidKey.name} request key receives a usable publication key`, async ({ page }) => {
    const { editor, state } = await setupCoverPublication(page, completeReadyCover, { draft: { ...publishingDraft, media: 'cover-pending', requestKey: invalidKey.value } });
    await expect(editor.getByRole('button', { name: 'Đăng công khai', exact: true })).toBeEnabled();
    await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
    await expect(editor).toHaveCount(0);
    expect(state.publications).toHaveLength(1);
    expect(state.publications[0].key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state.publications[0].key).not.toBe(invalidKey.value);
    expect(state.sessions).toBe(0);
  });
}

test('blocked session storage cleanup does not turn a successful publication into an error', async ({ page }) => {
  const { editor, state } = await setupCoverPublication(page, completeReadyCover, { draft: { ...publishingDraft, media: 'cover-pending' } });
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key: string) {
      if (key === 'viet_lookbook_post:author:new') throw new DOMException('Blocked session storage', 'SecurityError');
      return original.call(this, key);
    };
  });
  await editor.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page).toHaveURL(/\/lookbook\/bai-dang\/post-1$/);
  expect(state.publications).toHaveLength(1);
  expect(state.sessions).toBe(0);
});

test('guest discovers public outfits, filters, shares and sees login only when saving', async ({ page }) => {
  await setup(page);
  await page.goto('/lookbook');
  await expect(page.getByRole('heading', { name: 'Lookbook Việt Phục' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bộ phối Áo tấc đón Tết' })).toHaveJSProperty('naturalWidth', 300);
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Chia sẻ bộ phối' });
  await expect(share.getByLabel('Liên kết chia sẻ')).toHaveValue('http://127.0.0.1:3100/lookbook/bai-dang/post-1');
  await share.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
  await page.getByLabel('Lọc phong cách').selectOption('remix');
  await expect(page).toHaveURL(/style=remix/);
  await page.reload();
  await expect(page.getByLabel('Lọc phong cách')).toHaveValue('remix');
  await page.locator('article').getByRole('button', { name: 'Yêu thích', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Đăng nhập hoặc tạo tài khoản' })).toBeVisible();
});

test('favorite is persisted after reload and unavailable entries can be removed', async ({ page }) => {
  await setup(page, true);
  let saved = false;
  await page.route('**/api/lookbook-posts/post-1/favorite', route => { saved = route.request().method() === 'PUT'; return route.fulfill({ json: { saved } }); });
  await page.route('**/api/lookbook-posts', route => route.fulfill({ json: { items: [{ ...post, is_favorite: saved }], next_cursor: null } }));
  await page.goto('/lookbook');
  await page.locator('article').getByRole('button', { name: 'Yêu thích', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đã lưu', exact: true })).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đã lưu', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Các mục Lookbook' }).getByRole('button', { name: 'Yêu thích' }).click();
  await expect(page.getByText('Bộ phối không còn khả dụng.')).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ khỏi Yêu thích' }).click();
  await expect(page.getByText('Bộ phối không còn khả dụng.')).toHaveCount(0);
});

test('editing keeps form on failure, defaults private and protects keyboard modal behavior', async ({ page }) => {
  await setup(page, true, true);
  await page.goto('/lookbook/bai-dang/post-1');
  await page.getByRole('button', { name: 'Sửa bài / quyền xem' }).click();
  const editor = page.getByRole('dialog', { name: 'Sửa bài đăng bộ phối' });
  await editor.getByLabel('Tiêu đề', { exact: true }).fill('Bản phối riêng tư');
  await editor.getByLabel('Ai có thể xem?').selectOption('private');
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  await page.route('**/api/lookbook-posts/post-1', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, json: { error: { code:'UNAVAILABLE', message:'Chưa lưu được bài.' } } }) : route.fallback());
  await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(editor.getByRole('alert')).toContainText('Chưa lưu được bài.');
  await expect(editor.getByLabel('Tiêu đề', { exact: true })).toHaveValue('Bản phối riêng tư');
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sửa bài / quyền xem' })).toBeFocused();
  await page.getByRole('button', { name: 'Sửa bài / quyền xem' }).click();
  await expect(editor.getByLabel('Tiêu đề', { exact: true })).toHaveValue('Bản phối riêng tư');
});

test('public visitor cannot edit or reopen somebody else outfit in Studio', async ({ page }) => {
  await setup(page, true);
  await page.goto('/lookbook/bai-dang/post-1');
  await expect(page.getByRole('heading', { name: post.title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sửa bài / quyền xem' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mở bộ phối của tôi trong Studio' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu yêu thích' })).toBeVisible();
});

test('community has no horizontal overflow on 320px and large screens', async ({ page }) => {
  await setup(page);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lookbook');
    await expect(page.getByRole('img', { name: 'Bộ phối Áo tấc đón Tết' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('lookbook-' + width + '.png'), fullPage: true });
  }
});


test('saving as a guest resumes after password login', async ({ page }) => {
  await setup(page);
  let saved = false;
  await page.route('**/api/lookbook-posts/post-1/favorite', route => { saved = true; return route.fulfill({ json: { saved: true } }); });
  await page.route('**/api/lookbook-posts', route => route.fulfill({ json: { items: [{ ...post, is_favorite: saved }], next_cursor: null } }));
  await page.route('**/api/auth/login', route => route.fulfill({ json: { access_token: 'fresh', token_type: 'bearer', user: { id: 'reader', display_name: 'Bạn đọc', email: 'reader@example.invalid', roles: ['user'] } } }));
  await page.goto('/lookbook');
  await page.locator('article').getByRole('button', { name: 'Yêu thích', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng nhập hoặc tạo tài khoản' });
  await dialog.getByLabel('Địa chỉ Email').fill('reader@example.invalid');
  await dialog.getByPlaceholder('••••••••').fill('Browser-Only-Password123!');
  await dialog.getByRole('button', { name: 'Đăng nhập vào VietStylist' }).click();
  await expect.poll(() => saved).toBe(true);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('article').getByRole('button', { name: 'Đã lưu', exact: true })).toBeVisible();
});

test('admin reviews reported posts and restores hidden posts with a reason', async ({ page }) => {
  await setup(page, true);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'admin', display_name: 'Admin', email: 'admin@example.invalid', roles: ['admin'] } }));
  let hidden = false;
  await page.route('**/api/lookbook-posts/moderation/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/reports')) return route.fulfill({ json: { items: hidden ? [] : [{ id: 'report-1', post: { ...post, revision: 1 }, reason: 'spam', details: '', created_at: post.created_at }], next_cursor: null } });
    if (path.endsWith('/posts')) return route.fulfill({ json: { items: hidden ? [{ ...post, moderation_status: 'hidden', moderation_reason: 'Nội dung cần chỉnh sửa', revision: 2 }] : [], next_cursor: null } });
    hidden = route.request().postDataJSON().hidden;
    return route.fulfill({ json: { ...post, moderation_status: hidden ? 'hidden' : 'visible' } });
  });
  await page.goto('/lookbook/kiem-duyet');
  await expect(page.getByText(post.title, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ẩn bài và thu hồi link' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Nhập lý do xử lý');
  await page.getByLabel('Lý do xử lý').fill('Nội dung cần chỉnh sửa');
  await page.getByRole('button', { name: 'Ẩn bài và thu hồi link' }).click();
  await expect.poll(() => hidden).toBe(true);
  await page.getByRole('button', { name: 'Bài đang bị ẩn' }).click();
  await expect(page.getByText(post.title, { exact: true })).toBeVisible();
  await page.getByLabel('Lý do xử lý').fill('Đã kiểm tra bản sửa');
  await page.getByRole('button', { name: 'Khôi phục hiển thị' }).click();
  await expect.poll(() => hidden).toBe(false);
});


test('uncertain publication can be checked or explicitly retried as a new post without losing its form', async ({ page }) => {
  await setup(page, true, true);
  await page.addInitScript(() => { sessionStorage.setItem('viet_lookbook_post:author:new', JSON.stringify({ title: 'Nháp cần kiểm tra', description: 'Nội dung được giữ', visibility: 'private', version: 'version-1', media: 'cover-1', requestKey: 'uncertain-key' })); });
  await page.route('**/api/outfits/page?*', route => route.fulfill({ json: { items: [{ id: 'outfit-1', title: 'Bộ phối', current_version_id: 'version-1', current_snapshot: post.snapshot }], next_cursor: null } }));
  const keys: string[] = [];
  await page.route('**/api/lookbook-posts', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    keys.push(route.request().headers()['idempotency-key']);
    return keys.length === 1 ? route.fulfill({ status: 409, json: { error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Lần đăng đã có.' } } }) : route.fulfill({ json: { ...post, visibility: 'private' } });
  });
  await page.goto('/lookbook');
  await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'Đăng bộ phối' });
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  await editor.getByRole('button', { name: 'Lưu riêng tư' }).click();
  await expect(editor.getByRole('alert')).toContainText('Lần đăng trước có thể đã thành công');
  await expect(editor.getByRole('link', { name: 'Kiểm tra bài của tôi' })).toHaveAttribute('href', '/lookbook?tab=mine');
  await editor.getByRole('button', { name: 'Dùng nội dung này cho bài mới' }).click();
  await expect(editor.getByLabel('Tiêu đề', { exact: true })).toHaveValue('Nháp cần kiểm tra');
  expect(keys).toEqual(['uncertain-key']);
  await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  await editor.getByRole('button', { name: 'Lưu riêng tư' }).click();
  await expect(editor).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});
