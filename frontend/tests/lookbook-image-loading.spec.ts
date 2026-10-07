import { test, expect } from '@playwright/test';

test('Lookbook prioritizes its first image and keeps loaded cards during focus refresh', async ({ page }) => {
  const post = {
    id: 'speed-post', author: { id: 'author', display_name: 'Người phối đồ', bio: '' },
    title: 'Bộ phối đã lưu', description: '', visibility: 'public', moderation_status: 'visible',
    revision: 1, image_url: '/lookbook-speed-image.svg', style_mode: 'traditional',
    is_favorite: false, created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T00:00:00Z',
    published_at: '2026-10-07T00:00:00Z',
  };
  let requests = 0;
  let resume!: () => void;
  const refreshed = new Promise<void>(resolve => { resume = resolve; });
  await page.route('**/lookbook-speed-image.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#b83232"/></svg>' }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/lookbook-posts') {
      requests++;
      if (requests > 1) await refreshed;
      return route.fulfill({ json: { items: [{ ...post, description: requests > 1 ? 'Đã cập nhật từ máy chủ' : '' }, { ...post, id: 'second-post', title: 'Bộ phối tiếp theo' }], next_cursor: null } });
    }
    if (path.startsWith('/api/catalog/')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Không có dữ liệu.' } } });
  });
  await page.goto('/lookbook');
  const first = page.getByRole('img', { name: 'Bộ phối ' + post.title, exact: true });
  await expect(first).toHaveJSProperty('naturalWidth', 300);
  await expect(first).toHaveAttribute('loading', 'eager');
  await expect(first).toHaveAttribute('fetchpriority', 'high');
  await expect(page.getByRole('img', { name: 'Bộ phối Bộ phối tiếp theo', exact: true })).toHaveAttribute('loading', 'lazy');
  await first.evaluate(element => { element.setAttribute('data-kept', 'yes'); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => requests).toBe(2);
  await expect(first).toBeVisible();
  await expect(first).toHaveAttribute('data-kept', 'yes');
  resume();
  await expect(page.getByText('Đã cập nhật từ máy chủ', { exact: true })).toBeVisible();
  await expect(first).toHaveAttribute('data-kept', 'yes');
});
