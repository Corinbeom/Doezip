import {test,expect} from '@playwright/test';
import {apiBase,installTestSession,testIdentity} from '../support/e2e-auth';

const legacyId='61111111-1111-4111-8111-111111111113';
const legacyTitle='개발용 예시: 결제 API 장애 원인 분석';
const reportTitle='결제 지연 대응안을 운영 리드에게 제안하기';
const codingTitle='항목의 식별 기준을 바로잡기';
const activationTitle='가입 후 활성화 하락 원인을 제품 리드에게 보고하기';
const retryTitle='결제 요청의 안전한 재시도 조건 구현하기';

test('unified catalog exposes report and coding tasks from the real API',async({page})=>{
  const listing=page.waitForResponse(response=>response.url().endsWith('/api/v1/learning-flows/catalog'));
  await page.goto('/tasks');
  expect((await listing).status()).toBe(200);
  await expect(page.getByRole('link',{name:reportTitle,exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:activationTitle,exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:codingTitle,exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:retryTitle,exact:true})).toBeVisible();
  await expect(page.getByText('JavaScript',{exact:true})).toHaveCount(2);
  await expect(page.getByRole('link',{name:'구현 연습',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'구현',exact:true}).click();
  await expect(page.getByRole('link',{name:reportTitle,exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:codingTitle,exact:true}).click();
  await expect(page).toHaveURL(/\/tasks\/item-identity-coding$/);
  await expect(page.getByRole('heading',{name:'완료 조건'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'결과보다 판단 과정을 남겨요.'})).toBeVisible();
  await expect(page.getByText('약 30분',{exact:true})).toBeVisible();
});

test('starting the same unfinished task resumes one learning record',async({page,context,request})=>{
  const who=await testIdentity(request,`flow-${crypto.randomUUID()}`);await installTestSession(context,who.session);
  await page.goto('/tasks/item-identity-coding');await page.getByRole('button',{name:'이 과제 시작하기',exact:true}).click();
  await expect(page).toHaveURL(/\/learn\/[0-9a-f-]+$/);const first=new URL(page.url()).pathname;
  await page.goto('/tasks/item-identity-coding');await expect(page.getByText('작성 중인 기록이 있습니다. 새 기록을 만들지 않고 이어갑니다.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'훈련 이어가기',exact:true}).click();await expect(page).toHaveURL(new RegExp(first+'$'));
  const flows=await (await request.get(`${apiBase}/learning-flows`,{headers:who.headers})).json();
  expect(flows.filter((flow:{catalogId:string;mode:string;stage:string})=>flow.catalogId==='item-identity-coding'&&flow.mode==='TRAINING'&&flow.stage!=='FEEDBACK')).toHaveLength(1);
});

test('legacy PostgreSQL task detail remains available for existing links',async({page},testInfo)=>{
  const detailResponse=page.waitForResponse(response=>response.url().endsWith('/api/v1/tasks/'+legacyId));
  await page.goto('/tasks/'+legacyId);
  const response=await detailResponse;
  expect(response.status()).toBe(200);
  const task=await response.json();
  expect(task.id).toBe(legacyId);
  expect(Object.keys(task).sort()).toEqual(['descriptionMarkdown','id','rubrics','status','taskCode','title','versionNo'].sort());
  await expect(page.getByRole('heading',{name:legacyTitle,exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:legacyTitle,exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('legacy-task-detail.png'),fullPage:true});
});

test('catalog network failure is visible and retry calls real API',async({page})=>{
  await page.route('**/api/v1/learning-flows/catalog',route=>route.abort('failed'),{times:1});
  await page.goto('/tasks');
  await expect(page.getByText('과제 목록을 불러오지 못했습니다.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'재시도'}).click();
  await expect(page.getByRole('link',{name:reportTitle,exact:true})).toBeVisible();
});

test('catalog loading waits for a real response',async({page})=>{
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/learning-flows/catalog',async route=>{await gate;await route.continue();});
  try{await page.goto('/tasks');await expect(page.getByText('과제를 불러오는 중…',{exact:true})).toBeVisible();}finally{release();}
  await expect(page.getByRole('link',{name:reportTitle,exact:true})).toBeVisible();
});

test('unknown catalog task shows a return path',async({page})=>{
  await page.goto('/tasks/not-a-real-task');
  await expect(page.getByText('과제를 찾을 수 없습니다.',{exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'현재 위치'}).getByRole('link',{name:'과제 목록으로',exact:true})).toBeVisible();
});

for(const width of [1440,390,320]){
  test('unified catalog and coding detail fit at '+width+'px',async({page},testInfo)=>{
    await page.setViewportSize({width,height:width>500?1000:844});
    await page.goto('/tasks');
    await expect(page.getByRole('link',{name:codingTitle,exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('task-list-'+width+'.png'),fullPage:true});
    await page.getByRole('link',{name:codingTitle,exact:true}).click();
    const title=page.getByRole('heading',{name:codingTitle,exact:true});
    await expect(title).toBeVisible();
    await expect.poll(()=>title.evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(28);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('task-detail-'+width+'.png'),fullPage:true});
  });
}

test('keyboard skip link focuses main content',async({page})=>{
  await page.goto('/tasks');
  await page.keyboard.press('Tab');
  const skip=page.getByRole('link',{name:'본문으로 바로가기'});
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('empty catalog retains the product shell without fake task cards',async({page},testInfo)=>{
  await page.route('**/api/v1/learning-flows/catalog',route=>route.fulfill({json:[]}));
  await page.goto('/tasks');
  await expect(page.getByRole('status')).toHaveText('공개된 과제가 없습니다.');
  await expect(page.getByRole('link',{name:reportTitle,exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'주 메뉴'})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('empty-catalog.png'),fullPage:true});
});
