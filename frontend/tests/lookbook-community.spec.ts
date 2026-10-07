import { expect, test, type Page } from '@playwright/test';
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

test('guest discovers public outfits, filters, shares and sees login only when saving', async ({ page }) => {
  await setup(page);
  await page.goto('/lookbook');
  await expect(page.getByRole('heading', { name: 'Lookbook Việt Phục' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bộ phối Áo tấc đón Tết' })).toHaveJSProperty('naturalWidth', 300);
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Chia sẻ bộ phối' });
  await expect(share.getByLabel('Liên kết chia sẻ')).toHaveValue('http://127.0.0.1:3100/lookbook/bai-dang/post-1');
  await share.getByRole('button', { name: 'Đóng', exact: true }).click();
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
