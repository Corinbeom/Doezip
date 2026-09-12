import {test,expect,type APIRequestContext} from '@playwright/test';
import {apiBase,createWorkspace,installTestSession,testIdentity} from '../support/e2e-auth';
async function prepared(request:APIRequestContext){
 const identity=await testIdentity(request);const workspace=await createWorkspace(request,identity.headers);const id=workspace.session.id;
 const draft=await (await request.put(`${apiBase}/sessions/${id}/draft`,{headers:identity.headers,data:{markdown:'Original unchanged report',expectedLockVersion:0}})).json();
 expect((await request.post(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers,data:{checkpoint:'INITIAL',expectedDraftLockVersion:draft.lockVersion,expectedContentHash:draft.contentHash}})).status()).toBe(201);
 const run=await (await request.post(`${apiBase}/sessions/${id}/challenge`,{headers:identity.headers,data:{noticeVersion:'challenge-notice-v1',acknowledged:true}})).json();
 return {identity,id,run};
}
test('review with original citation saves, restores, submits and becomes read-only',async({page,context,request},info)=>{
 const {identity,id,run}=await prepared(request);await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);
 const section=page.getByRole('region',{name:'S01 검토'});
 await section.getByRole('combobox',{name:'판단',exact:true}).selectOption('KEEP');await section.getByLabel('판단 이유').fill('원자료 첫 줄을 확인했습니다.');
 await section.getByRole('combobox',{name:'인용할 자료',exact:true}).selectOption({index:1});await expect(section.getByRole('button',{name:'선택한 근거 추가'})).toBeEnabled();await section.getByRole('button',{name:'선택한 근거 추가'}).click();
 await expect(page.getByRole('button',{name:'검산 제출',exact:true})).toBeDisabled();await page.getByRole('button',{name:'검토 저장',exact:true}).click();await expect(page.getByText('검토가 저장되었습니다.',{exact:true})).toBeVisible();
 const saved=await (await request.get(`${apiBase}/challenge-runs/${run.id}`,{headers:identity.headers})).json();expect(saved.reviews).toHaveLength(1);expect(saved.reviews[0].evidence[0].quotedText.length).toBeGreaterThan(0);
 await page.reload();await expect(section.getByLabel('판단 이유')).toHaveValue('원자료 첫 줄을 확인했습니다.');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'검산 제출',exact:true}).click();await expect(page.getByText('검토와 근거가 잠겼습니다. 평가 결과는 아직 제공되지 않습니다.')).toBeVisible();await expect(section.getByLabel('판단 이유')).toBeDisabled();
 await page.reload();await expect(section.getByLabel('판단 이유')).toBeDisabled();expect((await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).draft.markdown).toBe('Original unchanged report');
 await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('review-submitted-mobile.png'),fullPage:true});
});
test('stale save retains local review until explicit reload',async({page,context,request})=>{
 const {identity,id,run}=await prepared(request);await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);const section=page.getByRole('region',{name:'S01 검토'});
 await section.getByRole('combobox',{name:'판단',exact:true}).selectOption('KEEP');await section.getByLabel('판단 이유').fill('Local unsaved text');
 expect((await request.put(`${apiBase}/challenge-runs/${run.id}/reviews`,{headers:identity.headers,data:{expectedLockVersion:0,reviews:[{statementId:run.statements[0].id,decision:'KEEP',reasonText:'Server winner',replacementText:null,evidence:[]}]}})).status()).toBe(200);
 await page.getByRole('button',{name:'검토 저장',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'입력은 유지됩니다'})).toContainText('입력은 유지됩니다');await expect(section.getByLabel('판단 이유')).toHaveValue('Local unsaved text');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'서버 검토 다시 불러오기'}).click();await expect(section.getByLabel('판단 이유')).toHaveValue('Server winner');
});
test('lost submit response restores the same frozen result on retry',async({page,context,request})=>{
 const {identity,id,run}=await prepared(request);await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);
 let lost=false;await page.route(`**/challenge-runs/${run.id}/submit`,async route=>{if(!lost){lost=true;expect((await route.fetch()).status()).toBe(200);await route.abort();}else await route.continue();});
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'검산 제출',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'입력은 유지됩니다'})).toContainText('입력은 유지됩니다');
 const first=await (await request.get(`${apiBase}/challenge-runs/${run.id}`,{headers:identity.headers})).json();expect(first.status).toBe('SUBMITTED');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'검산 제출',exact:true}).click();await expect(page.getByText('검토와 근거가 잠겼습니다. 평가 결과는 아직 제공되지 않습니다.')).toBeVisible();
 expect(await (await request.get(`${apiBase}/challenge-runs/${run.id}`,{headers:identity.headers})).json()).toEqual(first);
});
