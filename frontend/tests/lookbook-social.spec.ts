import { expect, test, type Page } from '@playwright/test';

const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#f4eee3"/><path d="M90 50L45 100L65 150L100 125L85 350H215L200 125L235 150L255 100L210 50Z" fill="#b92e32"/></svg>');
const user = { id: 'member', display_name: 'Minh Anh', displayName: 'Minh Anh', email: 'lookbook@example.invalid', roles: ['admin'] };
const post = { id: 'social-post', author: { id: 'member', display_name: 'Minh Anh', bio: '', avatar_url: null }, title: 'Áo tấc đón Tết', description: 'Một bộ phối đầu xuân với sắc đỏ truyền thống.', visibility: 'public', moderation_status: 'visible', moderation_reason: '', revision: 1, image_url: image, style_mode: 'traditional', occasion_id: 'tet', is_favorite: false, created_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' };
const book = { id: 'social-book', owner_id: 'member', title: 'Bộ phối đầu xuân', description: 'Những bộ phối đã lưu cho dịp Tết.', visibility: 'private', created_at: post.created_at, updated_at: post.updated_at, cover_image_url: image, entries: [{ id: 'entry', outfit_id: 'outfit', outfit_version_id: 'version', outfit_title: post.title, version_number: 1, sort_order: 0, snapshot: { items: [] }, preview_image_url: image }] };

async function fixtures(page: Page) {
  const mineRequests: URL[] = [];
  await page.addInitScript(account => {
    localStorage.setItem('viet_stylist_auth_token', 'social-test');
    localStorage.setItem('viet_stylist_user', JSON.stringify(account));
  }, user);
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: user });
    if (path === '/api/catalog/occasions') return route.fulfill({ json: [{ id: 'tet', name: 'Tết' }] });
    if (path === '/api/lookbook-posts') return route.fulfill({ json: { items: [post, { ...post, id: 'social-post-2', title: 'Bộ phối dạo phố' }], next_cursor: null } });
    if (path === '/api/lookbook-posts/mine') {
      mineRequests.push(url);
      return route.fulfill({ json: { items: [{ ...post, visibility: 'private' }], next_cursor: null } });
    }
    if (path === '/api/lookbook-posts/social-post') return route.fulfill({ json: { ...post, outfit_id: 'outfit', outfit_version_id: 'version', cover_media_id: 'cover', version_number: 1, snapshot: { items: [], styleMode: 'traditional', aspectRatio: '9:16' } } });
    if (path === '/api/lookbook-posts/profiles/member') return route.fulfill({ json: { ...post.author, bio: 'Chia sẻ những bộ phối Việt phục mỗi ngày.' } });
    if (path === '/api/lookbook-posts/favorites') return route.fulfill({ json: { items: [], next_cursor: null } });
    if (path.endsWith('/favorite')) return route.fulfill({ json: { saved: route.request().method() === 'PUT' } });
    if (path === '/api/lookbooks') return route.fulfill({ json: [book] });
    if (path === '/api/lookbooks/social-book') return route.fulfill({ json: book });
    if (path === '/api/outfits/page') return route.fulfill({ json: { items: [], next_cursor: null } });
    if (path.startsWith('/api/lookbook-posts/moderation/')) return route.fulfill({ json: { items: [], next_cursor: null } });
    if (path.startsWith('/api/catalog/')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Nội dung không khả dụng.' } } });
  });
  return mineRequests;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await page.locator('.lookbook-feed').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test('social feed stays in one column and its main actions work on mobile and desktop', async ({ page }) => {
  await fixtures(page);
  await page.goto('/lookbook');
  const article = page.getByRole('article', { name: 'Bài đăng ' + post.title, exact: true });
  await expect(article.getByRole('img', { name: 'Bộ phối ' + post.title })).toHaveJSProperty('naturalWidth', 300);
  for (const width of [320, 375, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
    const cards = await page.locator('.lookbook-feed article').evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, width: rect.width, y: rect.y, height: rect.height }; }));
    expect(cards).toHaveLength(2);
    expect(cards[0].x).toBe(cards[1].x);
    expect(cards[0].width).toBe(cards[1].width);
    expect(cards[1].y).toBeGreaterThanOrEqual(cards[0].y + cards[0].height);
    await page.screenshot({ path: test.info().outputPath(`social-feed-${width}.png`) });
  }
  await article.getByRole('button', { name: 'Yêu thích', exact: true }).click();
  await expect(article.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute('aria-pressed', 'true');
  await article.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Chia sẻ bộ phối' });
  await expect(share.getByLabel('Liên kết chia sẻ')).toHaveValue(/bai-dang\/social-post$/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Viết bài đăng', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Đăng bộ phối', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('social-composer-empty-1440.png') });
  await page.keyboard.press('Escape');
  await article.getByRole('link', { name: 'Chi tiết bài đăng ' + post.title, exact: true }).click();
  await expect(page.getByRole('heading', { name: post.title, exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: test.info().outputPath('social-post-detail-1440.png') });
  await page.getByRole('link', { name: 'Minh Anh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minh Anh', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bộ phối công khai', exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: test.info().outputPath('social-author-1440.png') });
});

test('compact composer renders saved snapshots without a preview URL and labels unnamed outfits', async ({ page }) => {
  await fixtures(page);
  const snapshot = { schemaVersion: 1, avatarId: 'avatar_nam_chuan', poseId: 'front_01', overlapDirection: 'right_over_left', lockedSlots: [], items: [{ slot: 'outerwear', itemId: 'shirt-1', assetVersion: 1, colorHex: '#553C9A', transform: { dx: 12, dy: 5, scale: 1.2, rotation: 15 } }], styleMode: 'traditional', aspectRatio: '9:16', backgroundTheme: 'white', neutralBackgroundTheme: 'white', backgroundFade: 0 };
  const outfits = [{ id: 'unnamed', title: '', current_version_id: 'unnamed-version', current_snapshot: snapshot }, { id: 'named', title: 'Bộ phối đã lưu', current_version_id: 'named-version', current_snapshot: { ...snapshot, items: [{ ...snapshot.items[0], colorHex: '#b92e32' }] } }];
  await page.route('**/api/outfits/page?*', route => route.fulfill({ json: { items: outfits, next_cursor: null } }));
  await page.route('**/api/catalog/items?*', route => route.fulfill({ json: [{ id: 'shirt-1', slot: 'outerwear', name: 'Áo ngũ thân', is_published: true, metadata: {}, variants: [], default_layer: { item_id: 'shirt-1', svg_content: '<rect x="100" y="200" width="400" height="600" fill="VAR_COLOR_PRIMARY"/>' } }] }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/lookbook');
  await page.getByRole('button', { name: 'Viết bài đăng', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng bộ phối', exact: true });
  await expect(dialog.getByLabel('Bộ phối đã lưu')).toHaveValue('unnamed-version');
  await expect(dialog.getByLabel('Bộ phối đã lưu').locator('option[value="unnamed-version"]')).toHaveText('Bộ phối chưa đặt tên');
  for (const version of ['unnamed-version', 'named-version']) {
    await dialog.getByLabel('Bộ phối đã lưu').selectOption(version);
    const preview = dialog.getByRole('img', { name: 'Ảnh xem trước bài đăng', exact: true });
    await expect(preview).toBeVisible();
    await expect(dialog.locator('[id$="item-transform-outerwear"]')).toHaveAttribute('transform', /rotate\(15\) scale\(1\.2\)/);
    const bounds = await preview.boundingBox();
    expect(bounds!.width).toBeGreaterThan(100);
    expect(bounds!.height).toBeGreaterThan(200);
    await expect(dialog.getByRole('group', { name: 'Thu phóng bảng phối' })).toHaveCount(0);
  }
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }, { width: 320, height: 700 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const panel = dialog.locator('.lookbook-composer');
    const bounds = await panel.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(600);
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height - 24);
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Xem trước bài đăng' })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Lưu riêng tư' })).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`social-composer-selected-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByLabel('Tiêu đề', { exact: true }).fill('Bản phối vẫn còn');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Viết bài đăng', exact: true }).click();
  await expect(dialog.getByLabel('Tiêu đề', { exact: true })).toHaveValue('Bản phối vẫn còn');
  await expect(dialog.getByLabel('Bộ phối đã lưu')).toHaveValue('named-version');
});

test('personal tabs keep the same feed alignment and do not inherit hidden explore filters', async ({ page }) => {
  const mineRequests = await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/lookbook?q=áo&style=remix&occasion=tet');
  const nav = page.getByRole('navigation', { name: 'Các mục Lookbook' });
  await expect(page.getByLabel('Lọc phong cách')).toHaveValue('remix');
  const original = await page.locator('.lookbook-feed').boundingBox();
  await nav.getByRole('button', { name: 'Của tôi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bài đăng của tôi' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(1);
  expect(mineRequests.length).toBeGreaterThan(0);
  for (const request of mineRequests) for (const key of ['q', 'style', 'occasion', 'owner_id']) expect(request.searchParams.has(key)).toBe(false);
  await page.getByLabel('Quyền xem').selectOption('private');
  await expect.poll(() => mineRequests.some(request => request.searchParams.get('visibility') === 'private')).toBe(true);
  await page.screenshot({ path: test.info().outputPath('social-mine-1440.png') });
  await nav.getByRole('button', { name: 'Yêu thích', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có bộ phối yêu thích' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Yêu thích', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: test.info().outputPath('social-favorites-1440.png') });
  await nav.getByRole('button', { name: 'Bộ sưu tập', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Bộ sưu tập ' + book.title })).toBeVisible();
  const collections = await page.locator('.lookbook-feed').boundingBox();
  expect(collections!.x).toBe(original!.x);
  expect(collections!.width).toBe(original!.width);
  await expect(page.getByRole('button', { name: 'Đăng bộ phối', exact: true })).toHaveCount(0);
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await noOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`social-collections-${width}.png`) });
  }
  await page.getByRole('button', { name: 'Tạo Lookbook mới' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo bộ sưu tập Lookbook mới' });
  await expect(dialog.getByLabel('Quyền riêng tư')).toHaveValue('private');
  await page.keyboard.press('Escape');
  let failDetails = true;
  await page.route('**/api/lookbooks/social-book', route => failDetails ? route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Chưa tải được bộ sưu tập.' } } }) : route.fulfill({ json: book }));
  await page.getByRole('link', { name: 'Quản lý', exact: true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Chưa tải được bộ sưu tập.');
  failDetails = false;
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  await expect(page.getByRole('heading', { name: book.title, exact: true })).toBeVisible();
  const savedPreview = page.getByRole('figure', { name: 'Ảnh bộ phối ' + post.title });
  await savedPreview.scrollIntoViewIfNeeded();
  await expect(savedPreview.getByRole('img', { name: 'Ảnh bộ phối ' + post.title })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: test.info().outputPath('social-collection-detail-320.png') });
});

test('moderation keeps shared navigation, visible selection and a retryable error without a false empty state', async ({ page }) => {
  await fixtures(page);
  let requests = 0;
  await page.route('**/api/lookbook-posts/moderation/reports', route => ++requests === 1 ? route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Chưa tải được báo cáo.' } } }) : route.fulfill({ json: { items: [], next_cursor: null } }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/lookbook/kiem-duyet');
  const nav = page.getByRole('navigation', { name: 'Các mục Lookbook' });
  await expect(nav.getByRole('link', { name: 'Kiểm duyệt' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.site-navbar').getByRole('link', { name: 'Lookbook', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('main').getByRole('alert')).toContainText('Chưa tải được báo cáo.');
  await expect(page.getByText('Không có nội dung cần xử lý.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Không có báo cáo chờ xử lý' })).toBeVisible();
  const reports = page.getByRole('button', { name: 'Báo cáo chờ xử lý' });
  const hidden = page.getByRole('button', { name: 'Bài đang bị ẩn' });
  await hidden.click();
  await expect(hidden).toHaveAttribute('aria-pressed', 'true');
  await expect(reports).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: 'Không có bài đăng bị ẩn' })).toBeVisible();
  expect(await hidden.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(await reports.evaluate(element => getComputedStyle(element).backgroundColor));
  await page.keyboard.press('Tab');
  await reports.focus();
  expect(await reports.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  expect(await reports.evaluate(element => getComputedStyle(element).boxShadow)).toBe('none');
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await noOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`social-moderation-${width}.png`) });
  }
});
