import { test,expect } from '@playwright/test';
import { apiBase,createWorkspace,installTestSession,testIdentity } from '../support/e2e-auth';

test('save then submit, lock editor, and restore the immutable submitted text',async({page,context,request},testInfo)=>{
 const browserErrors:string[]=[];page.on('pageerror',error=>browserErrors.push(error.message));
 const identity=await testIdentity(request);const workspace=await createWorkspace(request,identity.headers);const id=workspace.session.id;
 await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);
 const editor=page.getByRole('textbox',{name:'보고서 내용'});
 const body='가설: 외부 요청 지연\n근거: 자료를 확인했고 추가 관찰이 필요합니다.';
 await editor.fill(body);await expect(page.getByRole('button',{name:'최초 제출하기'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'최초 제출하기'})).toBeEnabled();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'최초 제출하기'}).click();await expect(editor).toBeEditable();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'최초 제출하기'}).click();
 await expect(page.getByText('최초 제출본이 보관되었습니다.')).toBeVisible();await expect(editor).not.toBeEditable();
 const docs=await (await request.get(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers})).json();expect(docs.items).toHaveLength(1);expect(docs.items[0].contentMarkdown).toBe(body);
 const state=await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json();expect(state.session.currentStep).toBe('CHALLENGE');expect(state.session.status).toBe('ACTIVE');expect(state.initialReportId).toBeNull();
 expect((await request.put(`${apiBase}/sessions/${id}/draft`,{headers:identity.headers,data:{markdown:'late overwrite',expectedLockVersion:state.draft.lockVersion}})).status()).toBe(409);
 await page.reload();await expect(page.getByText('최초 제출본이 보관되었습니다.')).toBeVisible();await expect(editor).not.toBeEditable();await expect(page.locator('pre')).toHaveText(body);
 await page.screenshot({path:testInfo.outputPath('submission-desktop.png'),fullPage:true});expect(browserErrors).toEqual([]);
});

test('lost POST response retries the real completed request without duplicate submission',async({page,context,request})=>{
 const identity=await testIdentity(request);const workspace=await createWorkspace(request,identity.headers);const id=workspace.session.id;
 await request.put(`${apiBase}/sessions/${id}/draft`,{headers:identity.headers,data:{markdown:'Retry this saved report',expectedLockVersion:0}});
 await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);await expect(page.getByRole('button',{name:'최초 제출하기'})).toBeEnabled();
 let dropped=false;
 await page.route(`**/sessions/${id}/document-versions`,async route=>{
   if(route.request().method()==='POST'&&!dropped){dropped=true;const real=await route.fetch();expect(real.status()).toBe(201);await route.abort();}else await route.continue();
 });
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'최초 제출하기'}).click();
 await expect(page.getByRole('button',{name:'최초 제출 재시도'})).toBeEnabled();
 const first=await (await request.get(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers})).json();expect(first.items).toHaveLength(1);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'최초 제출 재시도'}).click();await expect(page.getByText('최초 제출본이 보관되었습니다.')).toBeVisible();
 expect(await (await request.get(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers})).json()).toEqual(first);
});

test('stale submit preserves the current text and cannot seal a newer unseen draft',async({page,context,request})=>{
 const identity=await testIdentity(request);const workspace=await createWorkspace(request,identity.headers);const id=workspace.session.id;
 await request.put(`${apiBase}/sessions/${id}/draft`,{headers:identity.headers,data:{markdown:'My visible draft',expectedLockVersion:0}});
 await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);await expect(page.getByRole('button',{name:'최초 제출하기'})).toBeEnabled();
 await request.put(`${apiBase}/sessions/${id}/draft`,{headers:identity.headers,data:{markdown:'Another tab draft',expectedLockVersion:1}});
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'최초 제출하기'}).click();
 await expect(page.getByText('저장본 또는 제출 상태가 변경되었습니다. 현재 내용은 유지됩니다. 제출본을 확인한 뒤 저장 상태를 확인해 주세요.')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'보고서 내용'})).toHaveValue('My visible draft');
 expect((await (await request.get(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers})).json()).items).toHaveLength(0);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'서버 저장본 불러오기'}).click();
 await expect(page.getByRole('textbox',{name:'보고서 내용'})).toHaveValue('Another tab draft');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'최초 제출 재시도'}).click();await expect(page.getByText('최초 제출본이 보관되었습니다.')).toBeVisible();
 await expect(page.locator('pre')).toHaveText('Another tab draft');
});

test('submitted text stays private, literal and usable at 320px',async({page,context,request},testInfo)=>{
 const owner=await testIdentity(request);const other=await testIdentity(request,'bob');const workspace=await createWorkspace(request,owner.headers);const id=workspace.session.id;
 const body='<script>window.submittedCodeRan=true</script>\n[javascript](javascript:alert(1))\n'+'가'.repeat(120);
 const draft=await (await request.put(`${apiBase}/sessions/${id}/draft`,{headers:owner.headers,data:{markdown:body,expectedLockVersion:0}})).json();
 const payload={checkpoint:'INITIAL',expectedDraftLockVersion:draft.lockVersion,expectedContentHash:draft.contentHash};
 expect((await request.post(`${apiBase}/sessions/${id}/document-versions`,{headers:owner.headers,data:payload})).status()).toBe(201);
 expect((await request.get(`${apiBase}/sessions/${id}/document-versions`,{headers:other.headers})).status()).toBe(404);
 expect((await request.post(`${apiBase}/sessions/${id}/document-versions`,{headers:other.headers,data:payload})).status()).toBe(404);
 await installTestSession(context,owner.session);await page.setViewportSize({width:320,height:844});await page.goto(`/sessions/${id}`);await expect(page.locator('pre')).toHaveText(body);
 expect(await page.evaluate(()=>'submittedCodeRan' in window)).toBe(false);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('submission-mobile.png'),fullPage:true});
});
