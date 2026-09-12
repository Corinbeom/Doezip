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

test('report endpoint requires auth, conceals unknown reports and denies mutation',async({request})=>{
 const identity=await testIdentity(request);const url=`${apiBase}/reports/${crypto.randomUUID()}`;
 expect((await request.get(url)).status()).toBe(401);
 const missing=await request.get(url,{headers:identity.headers});expect(missing.status()).toBe(404);expect((await missing.json()).code).toBe('REPORT_NOT_FOUND');
 expect((await request.post(url,{headers:identity.headers,data:{summary:'unauthorized publication'}})).status()).toBe(403);
});

test('report UI boundary: explicit sample result, reload, failure and retry',async({page,context,request},info)=>{
 // Only the read boundary is intercepted. This does NOT claim the live worker publishes results.
 // Publication/ownership/rollback are verified separately against Testcontainers PostgreSQL.
 const {identity,id,document}=await prepared(request);await installTestSession(context,identity.session);
 const job=await (await request.post(`${apiBase}/sessions/${id}/evaluations`,{headers:{...identity.headers,'Idempotency-Key':crypto.randomUUID()},data:{phase:'INITIAL',documentVersionId:document.id}})).json();
 const reportId=crypto.randomUUID();const report={id:reportId,sessionId:id,evaluationId:job.id,phase:'INITIAL',documentVersionId:document.id,sample:true,summary:'테스트용 결과 표시 확인',strengths:[],improvements:[],areas:['PROMPT','EVIDENCE','DOCUMENT','DEFENSE'].map(area=>({area,dimensions:[{code:`${area}.test`,title:'테스트 기준',state:'NOT_OBSERVED',rationale:'이번 입력에서 관찰되지 않았습니다.',gap:null,nextAction:null,confidenceLevel:null,evidence:[]}]})),faultSummary:{statements:[],note:'개발용 가상 데이터입니다.'},comparison:null,nextPracticeText:null,createdAt:new Date().toISOString()};
 await page.route(`**/evaluations/${job.id}`,route=>route.fulfill({json:{...job,status:'SUCCEEDED',reportId,errorCode:null,retryable:false}}));
 let unavailable=false;
 await page.route(`**/reports/${reportId}`,route=>unavailable?route.fulfill({status:503,json:{code:'UNAVAILABLE',message:'test',traceId:'test'}}):route.fulfill({json:report}));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/sessions/${id}`);
 await expect(page.getByRole('heading',{name:'최초 평가 결과'})).toBeVisible();await expect(page.getByRole('note')).toContainText('개발용 예시');
 await page.reload();await expect(page.getByText('테스트용 결과 표시 확인')).toBeVisible();
 await page.setViewportSize({width:320,height:844});await page.getByRole('heading',{name:'최초 평가 결과'}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('report-sample-mobile.png'),fullPage:true});await page.getByRole('region',{name:'평가 결과',exact:true}).screenshot({path:info.outputPath('report-panel-mobile.png'),style:'header { visibility: hidden !important; }'});
 unavailable=true;await page.reload();await expect(page.getByText('평가 결과를 불러오지 못했습니다.')).toBeVisible({timeout:15000});unavailable=false;await page.getByRole('button',{name:'결과 다시 불러오기'}).click();await expect(page.getByRole('heading',{name:'최초 평가 결과'})).toBeVisible();expect(errors).toEqual([]);
});
