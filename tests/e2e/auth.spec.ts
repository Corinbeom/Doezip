import { test, expect } from '@playwright/test';

// These are local UI checks. SDK boundary doubles and signed-JWT tests do not replace live Google OAuth.
test('login entry preserves public browsing and exposes the Google action', async ({ page }, testInfo) => {
  await page.goto('/tasks');
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '되짚에 오신 것을 환영해요' })).toBeVisible();
  const google = page.getByRole('button', { name: 'Google로 계속하기' });
  await expect(google).toBeVisible();
  if (await google.isDisabled()) {
    await expect(page.getByRole('status')).toContainText('로그인 서비스 설정을 준비 중');
  }
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
  await page.getByRole('link', { name: '로그인 없이 과제 둘러보기' }).click();
  await expect(page.getByRole('heading', { name: /어떤 역량을 연습할까요/ })).toBeVisible();
});

test('a callback without a code fails instead of creating a fake session', async ({ page }) => {
  await page.goto('/auth/callback');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('로그인이 취소되었거나 연결하지 못했습니다.');
  await page.getByRole('link', { name: '로그인 다시 시도' }).click();
  await expect(page.getByRole('heading', { name: '되짚에 오신 것을 환영해요' })).toBeVisible();
});

test('provider cancellation strips callback details and never renders raw errors', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=DO_NOT_DISPLAY_CALLBACK_DETAIL');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('로그인이 취소되었거나 연결하지 못했습니다.');
  await expect(page).toHaveURL(/\/auth\/callback$/);
  await expect(page.getByText('DO_NOT_DISPLAY_CALLBACK_DETAIL')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toHaveCount(0);
});

test('login remains usable at 320px and offers a keyboard skip link', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/login?returnTo=https%3A%2F%2Fexample.invalid');
  await expect(page.getByRole('button', { name: 'Google로 계속하기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문으로 바로가기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('login-mobile.png'), fullPage: true });
});
