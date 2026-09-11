import { test, expect } from '@playwright/test';
import { apiBase, createWorkspace, installTestSession, sampleTaskId, testIdentity } from '../support/e2e-auth';

test('start, read a real material, autosave and restore the report', async ({ page, context, request }, testInfo) => {
  const identity = await testIdentity(request);
  await installTestSession(context, identity.session);
  await page.goto(`/tasks/${sampleTaskId}`);
  await page.getByRole('button', { name: '과제 시작하기', exact: true }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
  const id = new URL(page.url()).pathname.split('/').at(-1);
  const workspace = await (await request.get(`${apiBase}/sessions/${id}/workspace`, { headers: identity.headers })).json();
  expect(workspace.materials.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: workspace.materials[0].title, exact: true }).click();
  const material = await (await request.get(`${apiBase}/sessions/${id}/materials/${workspace.materials[0].id}`, { headers: identity.headers })).json();
  await expect(page.getByText(material.lines.find((line: { text: string }) => line.text.trim()).text, { exact: true })).toBeVisible();
  const editor = page.getByRole('textbox', { name: '보고서 내용' });
  const text = '# 원인 가설\n자료를 확인하고 추가 증거를 수집합니다.';
  await editor.fill(text);
  await expect.poll(async () => (await (await request.get(`${apiBase}/sessions/${id}/workspace`, { headers: identity.headers })).json()).draft.markdown).toBe(text);
  await expect(page.getByText('저장됨', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '과제 소개로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${sampleTaskId}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/sessions/${id}$`));
  await expect(editor).toHaveValue(text);
  await page.reload();
  await expect(editor).toHaveValue(text);
  await page.screenshot({ path: testInfo.outputPath('workspace-desktop.png'), fullPage: true });
});

test('stale tab retains local edits and cannot overwrite another saved draft', async ({ page, context, request }) => {
  const identity = await testIdentity(request);
  const workspace = await createWorkspace(request, identity.headers);
  await installTestSession(context, identity.session);
  const id = workspace.session.id;
  await page.goto(`/sessions/${id}`);
  await expect(page.getByRole('textbox', { name: '보고서 내용' })).toBeVisible();
  const newer = await request.put(`${apiBase}/sessions/${id}/draft`, { headers: identity.headers, data: { markdown: '다른 창의 저장본', expectedLockVersion: 0 } });
  expect(newer.status()).toBe(200);
  await page.getByRole('textbox', { name: '보고서 내용' }).fill('이 창의 보존할 초안');
  await expect(page.getByText('다른 창에서 수정한 저장본이 있습니다. 현재 작성 내용은 유지됩니다.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '보고서 내용' })).toHaveValue('이 창의 보존할 초안');
  const saved = await (await request.get(`${apiBase}/sessions/${id}/workspace`, { headers: identity.headers })).json();
  expect(saved.draft.markdown).toBe('다른 창의 저장본');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '서버 저장본 불러오기', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '보고서 내용' })).toHaveValue('다른 창의 저장본');
});

test('save network failure keeps the buffer and explicit retry reaches the real DB', async ({ page, context, request }) => {
  const identity = await testIdentity(request);
  const workspace = await createWorkspace(request, identity.headers);
  await installTestSession(context, identity.session);
  const id = workspace.session.id;
  await page.goto(`/sessions/${id}`);
  await page.route(`**/sessions/${id}/draft`, route => route.abort());
  await page.getByRole('textbox', { name: '보고서 내용' }).fill('네트워크 실패에도 보존할 내용');
  await expect(page.getByRole('button', { name: '저장 재시도' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '보고서 내용' })).toHaveValue('네트워크 실패에도 보존할 내용');
  await page.unroute(`**/sessions/${id}/draft`);
  await page.getByRole('button', { name: '저장 재시도' }).click();
  await expect.poll(async () => (await (await request.get(`${apiBase}/sessions/${id}/workspace`, { headers: identity.headers })).json()).draft.markdown).toBe('네트워크 실패에도 보존할 내용');
});

test('another signed identity cannot read materials or overwrite the owner report', async ({ page, context, request }) => {
  const alice = await testIdentity(request, 'alice');
  const bob = await testIdentity(request, 'bob');
  const workspace = await createWorkspace(request, alice.headers);
  const id = workspace.session.id;
  expect((await request.put(`${apiBase}/sessions/${id}/draft`, { headers: alice.headers, data: { markdown: 'OWNER_ONLY_REPORT', expectedLockVersion: 0 } })).status()).toBe(200);
  expect((await request.get(`${apiBase}/sessions/${id}/workspace`, { headers: bob.headers })).status()).toBe(404);
  expect((await request.get(`${apiBase}/sessions/${id}/materials/${workspace.materials[0].id}`, { headers: bob.headers })).status()).toBe(404);
  expect((await request.put(`${apiBase}/sessions/${id}/draft`, { headers: bob.headers, data: { markdown: 'overwrite', expectedLockVersion: 1 } })).status()).toBe(404);
  await installTestSession(context, bob.session);
  await page.goto(`/sessions/${id}`);
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '보고서 내용' })).toHaveCount(0);
  await expect(page.getByText('OWNER_ONLY_REPORT')).toHaveCount(0);
  const owner = await (await request.get(`${apiBase}/sessions/${id}/workspace`, { headers: alice.headers })).json();
  expect(owner.draft.markdown).toBe('OWNER_ONLY_REPORT');
});

test('workspace fits a narrow viewport and restores literal text without running HTML', async ({ page, context, request }, testInfo) => {
  const identity = await testIdentity(request);
  const workspace = await createWorkspace(request, identity.headers);
  const id = workspace.session.id;
  const literal = '<script>window.reportExecuted=true</script>\n[외부 링크](javascript:alert(1))';
  expect((await request.put(`${apiBase}/sessions/${id}/draft`, { headers: identity.headers, data: { markdown: literal, expectedLockVersion: 0 } })).status()).toBe(200);
  await installTestSession(context, identity.session);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/sessions/${id}`);
  await expect(page.getByRole('textbox', { name: '보고서 내용' })).toHaveValue(literal);
  expect(await page.evaluate(() => 'reportExecuted' in window)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('workspace-mobile.png'), fullPage: true });
});
