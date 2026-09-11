import { test, expect } from '@playwright/test';

const sampleId = '61111111-1111-4111-8111-111111111113';
const sampleTitle = '개발용 예시: 결제 API 장애 원인 분석';

test('real PostgreSQL task list opens detail and survives reload', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const listing = page.waitForResponse(response => response.url().endsWith('/api/v1/tasks'));
  await page.goto('/tasks');
  expect((await listing).status()).toBe(200);
  const detailResponse = page.waitForResponse(response => response.url().endsWith(`/api/v1/tasks/${sampleId}`));
  await page.getByRole('link', { name: sampleTitle, exact: true }).click();
  const response = await detailResponse;
  expect(response.status()).toBe(200);
  const task = await response.json();
  expect(task.id).toBe(sampleId);
  expect(Object.keys(task).sort()).toEqual(['descriptionMarkdown', 'id', 'rubrics', 'status', 'taskCode', 'title', 'versionNo'].sort());
  for (const rubric of task.rubrics) {
    expect(Object.keys(rubric).sort()).toEqual(['area', 'code', 'description', 'title'].sort());
  }
  await expect(page.getByRole('heading', { name: sampleTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '평가 기준' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: sampleTitle, exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('task-detail.png'), fullPage: true });
  await page.getByRole('link', { name: '과제 목록으로' }).click();
  await expect(page.getByRole('heading', { name: '과제 목록', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('task list network failure is visible and retry calls real API', async ({ page }) => {
  await page.route('**/api/v1/tasks', route => route.abort('failed'), { times: 1 });
  await page.goto('/tasks');
  await expect(page.getByText('과제 목록을 불러오지 못했습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '재시도' }).click();
  await expect(page.getByRole('link', { name: sampleTitle, exact: true })).toBeVisible();
});

test('task loading waits for a real response', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/tasks', async route => { await gate; await route.continue(); });
  try {
    await page.goto('/tasks');
    await expect(page.getByText('과제를 불러오는 중…', { exact: true })).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('link', { name: sampleTitle, exact: true })).toBeVisible();
});

test('unknown task shows real API 404 and a return path', async ({ page }) => {
  const missingId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const responsePromise = page.waitForResponse(response => response.url().endsWith(`/api/v1/tasks/${missingId}`));
  await page.goto(`/tasks/${missingId}`);
  expect((await responsePromise).status()).toBe(404);
  await expect(page.getByText('과제를 찾을 수 없습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '과제 목록으로' })).toBeVisible();
});

test('task detail fits a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tasks/${sampleId}`);
  await expect(page.getByRole('heading', { name: sampleTitle, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const width of [1440, 390, 320]) {
  test(`approved design renders styled task list and detail at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    await page.goto('/tasks');
    await expect(page.getByRole('link', { name: sampleTitle, exact: true })).toBeVisible();
    await expect(page.getByText(/최종 디자인.*미승인/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`task-list-${width}.png`), fullPage: true });
    await page.getByRole('link', { name: sampleTitle, exact: true }).click();
    const title = page.getByRole('heading', { name: sampleTitle, exact: true });
    await expect(title).toBeVisible();
    // A missing stylesheet previously made all headings indistinguishable from body text.
    await expect.poll(() => title.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(28);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: /이 문제 시작하기|학습 시작/ })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`task-detail-${width}.png`), fullPage: true });
  });
}


test('keyboard skip link focuses main content', async ({ page }) => {
  await page.goto('/tasks');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '본문으로 바로가기' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('empty catalog retains the approved shell without fake task cards', async ({ page }, testInfo) => {
  // UI state coverage only: real default-profile empty DB behavior is tested by JUnit.
  await page.route('**/api/v1/tasks', route => route.fulfill({ json: { items: [] } }));
  await page.goto('/tasks');
  await expect(page.getByRole('status')).toHaveText('공개된 과제가 없습니다.');
  await expect(page.getByRole('link', { name: sampleTitle, exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('empty-catalog.png'), fullPage: true });
});
