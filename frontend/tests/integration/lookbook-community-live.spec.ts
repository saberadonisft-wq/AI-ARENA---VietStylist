import { expect, test } from '@playwright/test';

test('real publications, Studio image upload, idempotent retry, favorites and private revocation across accounts', async ({ page, request, browser }) => {
  test.setTimeout(180000);
  const origin = 'http://127.0.0.1:4100';
  const register = async (name: string) => {
    const response = await request.post(origin + '/api/auth/register', { data: { email: `look-${Date.now()}-${Math.random().toString(16).slice(2)}@example.invalid`, password: 'Browser-Only-Password123!', display_name: name } });
    expect(response.ok(), response.ok() ? '' : await response.text()).toBeTruthy(); return response.json();
  };
  const owner = await register('Tác giả'); const reader = await register('Bạn đọc');
  const ownerHeaders = { Authorization: 'Bearer ' + owner.access_token };
  const readerHeaders = { Authorization: 'Bearer ' + reader.access_token };
  const items = await (await request.get(origin + '/api/catalog/items?limit=50')).json();
  const garment = items.find((i: any) => i.default_layer?.svg_content || i.metadata?.flatlay_image_url);
  expect(garment).toBeTruthy();
  const outfit = await (await request.post(origin + '/api/outfits', { headers: ownerHeaders, data: {
    title: 'Bộ phối cộng đồng', snapshot: { schemaVersion: 1, items: [{ slot: garment.slot, itemId: garment.id }], styleMode: 'traditional', aspectRatio: '9:16', backgroundTheme: 'white' },
  } })).json();
  await page.addInitScript(account => {
    localStorage.setItem('viet_stylist_auth_token', account.access_token);
    localStorage.setItem('viet_stylist_user', JSON.stringify({ id: account.user.id, displayName: account.user.display_name, email: account.user.email, roles: ['user'] }));
  }, owner);
  await page.goto('/studio?loadOutfit=' + outfit.id);
  await expect(page.locator('input').first()).toHaveValue('Bộ phối cộng đồng');
  await page.getByRole('button', { name: 'Đăng lên Lookbook', exact: true }).click();
  const composer = page.getByRole('dialog', { name: 'Đăng bộ phối' });
  const savedSource = await (await request.get(origin + '/api/outfits/' + outfit.id, { headers: ownerHeaders })).json();
  await expect(composer.getByLabel('Bộ phối đã lưu')).toHaveValue(savedSource.current_version_id);
  await expect(composer.getByLabel('Ai có thể xem?')).toHaveValue('private');
  await composer.getByLabel('Tiêu đề', { exact: true }).fill('Áo tấc cộng đồng thử nghiệm');
  await composer.getByLabel('Mô tả', { exact: true }).fill('Bộ phối đăng từ ảnh dựng trong Studio.');
  await composer.getByLabel('Ai có thể xem?').selectOption('public');
  await composer.getByRole('button', { name: 'Xem trước bài đăng' }).click();
  let lost = false;
  await page.route('**/api/lookbook-posts', async route => {
    if (route.request().method() === 'POST' && !lost) { lost = true; await route.fetch(); await route.abort('failed'); } else await route.continue();
  });
  await composer.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(composer.getByRole('alert')).toContainText('Không thể kết nối', { timeout: 60000 });
  await expect(composer.getByLabel('Tiêu đề', { exact: true })).toHaveValue('Áo tấc cộng đồng thử nghiệm');
  await composer.getByRole('button', { name: 'Đăng công khai', exact: true }).click();
  await expect(page).toHaveURL(/\/lookbook\/bai-dang\//, { timeout: 60000 });
  await expect(page.getByRole('img', { name: 'Bộ phối Áo tấc cộng đồng thử nghiệm' })).toHaveJSProperty('naturalWidth', 1400);
  const mine = await (await request.get(origin + '/api/lookbook-posts/mine', { headers: ownerHeaders })).json();
  expect(mine.items).toHaveLength(1);
  const post = mine.items[0];
  await page.getByRole('img', { name: 'Bộ phối ' + post.title }).screenshot({ path: test.info().outputPath('published-outfit.png') });
  const publicDetail = await (await request.get(origin + '/api/lookbook-posts/' + post.id)).json();
  const publicImage = publicDetail.image_url;
  const publicHtml = await (await request.get('http://127.0.0.1:3100/lookbook/bai-dang/' + post.id, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } })).text();
  expect(publicHtml).toContain('property="og:title"');
  expect(publicHtml).toContain('Áo tấc cộng đồng thử nghiệm · Tác giả');
  const coverResponse = await request.get(publicImage); expect(coverResponse.ok()).toBeTruthy();
  expect(coverResponse.headers()['cache-control']).toBe('private, no-store');

  const readerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  await readerContext.addInitScript(account => {
    localStorage.setItem('viet_stylist_auth_token', account.access_token);
    localStorage.setItem('viet_stylist_user', JSON.stringify({ id: account.user.id, displayName: account.user.display_name, email: account.user.email, roles: ['user'] }));
  }, reader);
  const readerPage = await readerContext.newPage();
  await readerPage.goto('/lookbook/bai-dang/' + post.id);
  await expect(readerPage.getByRole('button', { name: 'Sửa bài / quyền xem' })).toHaveCount(0);
  await readerPage.getByRole('button', { name: 'Lưu yêu thích', exact: true }).click();
  await expect(readerPage.getByRole('button', { name: 'Đã lưu — bỏ yêu thích' })).toBeVisible();
  await readerPage.reload();
  await expect(readerPage.getByRole('button', { name: 'Đã lưu — bỏ yêu thích' })).toBeVisible();
  expect((await (await request.get(origin + '/api/lookbook-posts/favorites', { headers: readerHeaders })).json()).items).toHaveLength(1);

  const changeVisibility = async (visibility: string) => {
    await page.getByRole('button', { name: 'Sửa bài / quyền xem' }).click();
    const editor = page.getByRole('dialog', { name: 'Sửa bài đăng bộ phối' });
    await editor.getByLabel('Ai có thể xem?').selectOption(visibility);
    await editor.getByRole('button', { name: 'Xem trước bài đăng' }).click();
    await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(editor).toHaveCount(0);
  };
  await changeVisibility('unlisted');
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  const shareDialog = page.getByRole('dialog', { name: 'Chia sẻ bộ phối' });
  await shareDialog.getByRole('button', { name: 'Tạo liên kết có thời hạn' }).click();
  await expect(shareDialog.getByLabel('Liên kết chia sẻ')).toHaveValue(/\/lookbook\/chia-se\//);
  const shareUrl = await shareDialog.getByLabel('Liên kết chia sẻ').inputValue();
  await shareDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  const guestContext = await browser.newContext(); const guest = await guestContext.newPage();
  await guest.goto(shareUrl);
  await expect(guest.getByRole('heading', { name: post.title })).toBeVisible();
  await expect(guest.getByRole('img', { name: 'Bộ phối ' + post.title })).toHaveJSProperty('naturalWidth', 1400);
  await expect(guest.getByRole('button', { name: 'Lưu yêu thích' })).toHaveCount(0);
  await changeVisibility('private');
  expect((await request.get(publicImage)).status()).toBe(404);
  const privateHtml = await (await request.get('http://127.0.0.1:3100/lookbook/bai-dang/' + post.id, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } })).text();
  expect(privateHtml).toContain('noindex');
  expect(privateHtml).not.toContain('Áo tấc cộng đồng thử nghiệm');
  await guest.reload();
  await expect(guest.getByRole('heading', { name: 'Bộ phối chưa khả dụng' })).toBeVisible();
  await readerPage.goto('/lookbook?tab=favorites');
  await expect(readerPage.getByText('Bộ phối không còn khả dụng.')).toBeVisible();
  await expect(readerPage.getByRole('img', { name: 'Bộ phối ' + post.title })).toHaveCount(0);
  expect((await request.get(origin + '/api/lookbook-posts/' + post.id, { headers: readerHeaders })).status()).toBe(404);
  expect((await request.get(origin + '/api/outfits/' + outfit.id, { headers: ownerHeaders })).ok()).toBeTruthy();
  await readerContext.close(); await guestContext.close();
});
