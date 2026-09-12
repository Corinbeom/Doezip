import {test,expect,type APIRequestContext} from '@playwright/test';
import {apiBase,createWorkspace,installTestSession,testIdentity} from '../support/e2e-auth';
async function prepared(request:APIRequestContext){
 const identity=await testIdentity(request);const workspace=await createWorkspace(request,identity.headers);const id=workspace.session.id;
 const draft=await (await request.put(`${apiBase}/sessions/${id}/draft`,{headers:identity.headers,data:{markdown:'Private original evaluation report',expectedLockVersion:0}})).json();
 const document=await (await request.post(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers,data:{checkpoint:'INITIAL',expectedDraftLockVersion:draft.lockVersion,expectedContentHash:draft.contentHash}})).json();
 const run=await (await request.post(`${apiBase}/sessions/${id}/challenge`,{headers:identity.headers,data:{noticeVersion:'challenge-notice-v1',acknowledged:true}})).json();
 expect((await request.post(`${apiBase}/challenge-runs/${run.id}/submit`,{headers:identity.headers,data:{expectedLockVersion:0}})).status()).toBe(200);
 return {identity,id,document};
}
test('real worker reports unavailable evaluator honestly and restores the job after reload',async({page,context,request},info)=>{
 const {identity,id}=await prepared(request);await installTestSession(context,identity.session);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/sessions/${id}`);await page.getByRole('button',{name:'평가 요청하기',exact:true}).click();
 await expect(page.getByText('평가 처리 실패',{exact:true})).toBeVisible({timeout:15000});await expect(page.getByText(/평가기 연결이 아직 준비되지 않았습니다/)).toBeVisible();await expect(page.getByRole('button',{name:'평가 다시 시도'})).toHaveCount(0);
 const first=await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json();expect(first.activeEvaluationId).toBeTruthy();expect(first.draft.markdown).toBe('Private original evaluation report');
 await page.reload();await expect(page.getByText('평가 처리 실패',{exact:true})).toBeVisible();expect((await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).activeEvaluationId).toBe(first.activeEvaluationId);
 expect(errors).toEqual([]);await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('evaluation-unavailable-mobile.png'),fullPage:true});
});
test('lost request response retries the same idempotency key and restores one job',async({page,context,request})=>{
 const {identity,id}=await prepared(request);await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);let lost=false;const keys:string[]=[];
 await page.route(`**/sessions/${id}/evaluations`,async route=>{keys.push(route.request().headers()['idempotency-key']);if(!lost){lost=true;expect((await route.fetch()).status()).toBe(202);await route.abort();}else await route.continue();});
 await page.getByRole('button',{name:'평가 요청하기',exact:true}).click();await expect(page.getByRole('button',{name:'같은 평가 요청 재전송'})).toBeVisible();const first=(await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).activeEvaluationId;
 await page.getByRole('button',{name:'같은 평가 요청 재전송'}).click();await expect(page.getByText('평가 처리 실패',{exact:true})).toBeVisible({timeout:15000});expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);expect((await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).activeEvaluationId).toBe(first);
});
test('job queries exclude frozen input and reject cross-account reads and retries',async({request})=>{
 const {identity,id,document}=await prepared(request);const bob=await testIdentity(request,'bob');const response=await request.post(`${apiBase}/sessions/${id}/evaluations`,{headers:{...identity.headers,'Idempotency-Key':crypto.randomUUID()},data:{phase:'INITIAL',documentVersionId:document.id}});expect(response.status()).toBe(202);const job=await response.json();
 for(const value of ['Private original evaluation report','inputSnapshot','leaseToken','inputFingerprint','llmConfig'])expect(JSON.stringify(job)).not.toContain(value);
 expect((await request.get(`${apiBase}/evaluations/${job.id}`,{headers:bob.headers})).status()).toBe(404);expect((await request.post(`${apiBase}/evaluations/${job.id}/retry`,{headers:bob.headers})).status()).toBe(404);
});
