import { test, expect } from '@playwright/test';
import { apiBase,installTestSession, testIdentity } from '../support/e2e-auth';

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

test('an authenticated user must acknowledge the current policies before continuing', async ({ page, context, request }) => {
  const identity = await testIdentity(request, `flow-${crypto.randomUUID()}`, { acceptPolicies: false });
  await installTestSession(context, identity.session);
  await page.goto('/login?returnTo=%2Flearn');

  const continueButton = page.getByRole('button', { name: '동의하고 계속하기' });
  await expect(continueButton).toBeDisabled();
  await expect(page.getByRole('link', { name: '이용약관', exact: true }).first()).toHaveAttribute('target', '_blank');
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('checkbox').nth(2).check();
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page).toHaveURL(/\/learn$/);
});

test('legal documents are public, linked, and fit a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const [path, heading] of [
    ['/terms', '되짚 이용약관'],
    ['/privacy', '개인정보 처리방침'],
    ['/ai-policy', 'AI 이용 및 데이터 안내'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByText(/Gemini/).first()).toBeVisible();
});

test('account deletion requires explicit confirmation and removes the product identity',async({page,context,request})=>{
  const identity=await testIdentity(request,`flow-${crypto.randomUUID()}`);await installTestSession(context,identity.session);
  await page.goto('/learn');await expect(page.getByRole('heading',{name:/지난 판단을 돌아보고/})).toBeVisible();
  await page.getByRole('button',{name:'회원 탈퇴 및 데이터 삭제'}).click();
  const remove=page.getByRole('button',{name:'계정과 데이터 영구 삭제'});await expect(remove).toBeDisabled();
  await page.getByRole('checkbox',{name:/삭제 범위/}).check();await page.getByLabel(/확인을 위해/).fill('탈퇴');await expect(remove).toBeEnabled();
  await remove.click();await expect(page).toHaveURL(/\/$/);await expect(page.getByRole('link',{name:'로그인',exact:true})).toBeVisible();
  expect((await request.get(`${apiBase}/me`,{headers:identity.headers})).status()).toBe(404);
  const recreated=await request.post(`${apiBase}/me/bootstrap`,{headers:identity.headers,data:{}});expect(recreated.status()).toBe(410);
});
