import { test,expect,type APIRequestContext } from '@playwright/test';
import { apiBase,createWorkspace,installTestSession,testIdentity } from '../support/e2e-auth';
const notice={noticeVersion:'challenge-notice-v1',acknowledged:true};
async function prepared(request:APIRequestContext){
 const identity=await testIdentity(request);const workspace=await createWorkspace(request,identity.headers);const id=workspace.session.id;
 const draft=await (await request.put(`${apiBase}/sessions/${id}/draft`,{headers:identity.headers,data:{markdown:'My original report stays unchanged',expectedLockVersion:0}})).json();
 const response=await request.post(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers,data:{checkpoint:'INITIAL',expectedDraftLockVersion:draft.lockVersion,expectedContentHash:draft.contentHash}});expect(response.status()).toBe(201);
 return {identity,id,document:await response.json(),draft};
}
test('notice gates content, assigned statements restore, and user report remains intact',async({page,context,request},testInfo)=>{
 const {identity,id,document,draft}=await prepared(request);await installTestSession(context,identity.session);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const contentReads:string[]=[];page.on('request',r=>{if(r.url().includes('/challenge-runs/'))contentReads.push(r.url());});
 await page.goto(`/sessions/${id}`);await expect(page.getByRole('button',{name:'검산 시작하기'})).toBeDisabled();expect(contentReads).toEqual([]);
 await expect(page.getByText('10:05에는 장애 원인이 확정되었다.',{exact:true})).toHaveCount(0);
 await page.getByRole('checkbox',{name:'검산 안내를 확인했습니다.'}).check();await page.getByRole('button',{name:'검산 시작하기'}).click();
 await expect(page.getByRole('heading',{name:'개발용 검토 초안'})).toBeVisible();await expect(page.getByText('10:05에는 장애 원인이 확정되었다.',{exact:true})).toBeVisible();
 const workspace=await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json();expect(workspace.draft).toEqual(draft);expect(workspace.session.currentStep).toBe('CHALLENGE');
 const run=await (await request.get(`${apiBase}/challenge-runs/${workspace.challengeRunId}`,{headers:identity.headers})).json();expect(run.statements).toHaveLength(3);expect(run.reviews).toEqual([]);
 for(const forbidden of ['variantCode','faultTemplateId','isFault','correctAnswer','errorCount','challengeTemplateId'])expect(JSON.stringify(run)).not.toContain(forbidden);
 await page.reload();await expect(page.getByRole('heading',{name:'개발용 검토 초안'})).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(0);
 expect((await (await request.get(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers})).json()).items).toEqual([document]);
 expect((await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).challengeRunId).toBe(run.id);
 expect(errors).toEqual([]);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath('challenge-desktop.png'),fullPage:true});
});
test('lost start response replays the same assignment and failed GET recovers',async({page,context,request})=>{
 const {identity,id}=await prepared(request);await installTestSession(context,identity.session);await page.goto(`/sessions/${id}`);await page.getByRole('checkbox').check();
 let dropped=false;await page.route(`**/sessions/${id}/challenge`,async route=>{if(!dropped){dropped=true;const real=await route.fetch();expect(real.status()).toBe(200);await route.abort();}else await route.continue();});
 await page.getByRole('button',{name:'검산 시작하기'}).click();await expect(page.getByRole('button',{name:'검산 시작 재시도'})).toBeVisible();
 const assigned=(await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).challengeRunId;
 await page.getByRole('button',{name:'검산 시작 재시도'}).click();await expect(page.getByRole('heading',{name:'개발용 검토 초안'})).toBeVisible();
 expect((await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).challengeRunId).toBe(assigned);
 await page.route(`**/challenge-runs/${assigned}`,route=>route.abort());await page.reload();await expect(page.getByRole('button',{name:'초안 다시 불러오기'})).toBeVisible();
 await page.unroute(`**/challenge-runs/${assigned}`);await page.getByRole('button',{name:'초안 다시 불러오기'}).click();await expect(page.getByRole('heading',{name:'개발용 검토 초안'})).toBeVisible();
});
test('cross-account access is denied and notice/reading fit 320px',async({page,context,request},testInfo)=>{
 const {identity,id}=await prepared(request);const bob=await testIdentity(request,'bob');
 expect((await request.post(`${apiBase}/sessions/${id}/challenge`,{headers:bob.headers,data:notice})).status()).toBe(404);
 expect((await request.post(`${apiBase}/sessions/${id}/challenge`,{headers:identity.headers,data:{...notice,acknowledged:false}})).status()).toBe(400);
 await installTestSession(context,identity.session);await page.setViewportSize({width:320,height:844});await page.goto(`/sessions/${id}`);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'검산 시작하기'}).click();await expect(page.getByRole('heading',{name:'개발용 검토 초안'})).toBeVisible();
 const runId=(await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json()).challengeRunId;
 expect((await request.get(`${apiBase}/challenge-runs/${runId}`,{headers:bob.headers})).status()).toBe(404);
 expect((await request.put(`${apiBase}/challenge-runs/${runId}/reviews`,{headers:identity.headers,data:{}})).status()).toBe(400);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath('challenge-mobile.png'),fullPage:true});
});
