import { expect, test, type Page } from '@playwright/test';

async function pagedOutfits(page: Page) {
  const user = { id: 'pagination-user', email: 'pagination@example.invalid', display_name: 'Pagination User', displayName: 'Pagination User', roles: ['user'] };
  await page.addInitScript(user => {
    localStorage.setItem('viet_stylist_auth_token', 'pagination-token');
    localStorage.setItem('viet_stylist_user', JSON.stringify(user));
  }, user);
  const outfit = (index: number) => ({ id: `paged-${index}`, owner_id: user.id, title: `Bộ phối ${index}`,
    current_version_id: `version-${index}`, revision: 1, style_mode: 'traditional',
    current_snapshot: { items: [], styleMode: 'traditional', aspectRatio: '9:16' },
    created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T00:00:00Z' });
  const requests: Array<string | null> = [];
  let failNext = true;
  await page.route('**/ready', route => route.fulfill({ json: { schema_ready: true } }));
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const send = (json: unknown, status = 200) => route.fulfill({ json, status });
    if (url.pathname === '/api/auth/me') return send(user);
    if (url.pathname === '/api/outfits/page') {
      const cursor = url.searchParams.get('cursor');
      requests.push(cursor);
      if (cursor && failNext) {
        failNext = false;
        return send({ error: { code: 'UNAVAILABLE', message: 'Thử tải trang tiếp theo.' } }, 503);
      }
      return send(cursor ? { items: [outfit(31)], next_cursor: null }
        : { items: Array.from({ length: 30 }, (_, index) => outfit(index + 1)), next_cursor: 'next-page' });
    }
    if (url.pathname === '/api/outfits/paged-31') return send(outfit(31));
    if (url.pathname.startsWith('/api/lookbook-posts')) return send({ items: [], next_cursor: null });
    return send([]);
  });
  return { requests, allowNextPage: () => { failNext = false; } };
}

test('account appends outfit pages, retains the first page on failure, and retries its cursor', async ({ page }) => {
  const { requests } = await pagedOutfits(page);
  await page.goto('/tai-khoan');
  await expect(page.getByRole('heading', { name: 'Bộ phối 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tải thêm bộ phối', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Thử tải trang tiếp theo.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bộ phối 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Thử tải thêm bộ phối', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bộ phối 31', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Bộ phối \d+$/ })).toHaveCount(31);
  await expect(page.getByRole('button', { name: /Tải thêm bộ phối|Thử tải thêm bộ phối/ })).toHaveCount(0);
  expect(requests).toEqual([null, 'next-page', 'next-page']);
});

test('publisher can select outfits from the next page and open an initial outfit outside the first page', async ({ page }) => {
  const { allowNextPage } = await pagedOutfits(page);
  allowNextPage();
  await page.goto('/lookbook');
  await page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Tải thêm bộ phối', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Bộ phối đã lưu' }).selectOption('version-31');
  await expect(dialog.getByRole('combobox', { name: 'Bộ phối đã lưu' })).toHaveValue('version-31');
  await page.goto('/lookbook?outfit=paged-31');
  const publish = page.getByRole('button', { name: 'Đăng bộ phối', exact: true }).first();
  if (!(await page.getByRole('dialog').count())) await publish.click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Bộ phối đã lưu' })).toHaveValue('version-31');
});
