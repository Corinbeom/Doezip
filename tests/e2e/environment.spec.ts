import { test, expect } from '@playwright/test';
test('web confirms the real API and PostgreSQL connection', async ({ page }, testInfo) => {
  const response = page.waitForResponse(r => r.url().endsWith('/actuator/health'));
  await page.goto('/environment');
  const health = await response;
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'UP' });
  await expect(page.getByRole('status')).toContainText('연결 성공');
  await expect(page.getByText(/최종 제품 UI가 아닙니다/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('environment.png'), fullPage: true });
});
test('connection failure is visible and retry recovers against the real API', async ({ page }) => {
  await page.route('**/actuator/health', route => route.abort('failed'), { times: 1 });
  await page.goto('/environment');
  await expect(page.getByRole('status')).toContainText('연결 실패');
  await page.getByRole('button', { name: '재시도' }).click();
  await expect(page.getByRole('status')).toContainText('연결 성공');
});
test('loading stays visible until the real response arrives', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/actuator/health', async route => { await gate; await route.continue(); });
  await page.goto('/environment');
  await expect(page.getByRole('status')).toContainText('연결 확인 중');
  await expect(page.getByRole('button')).toBeDisabled();
  release();
  await expect(page.getByRole('status')).toContainText('연결 성공');
});
