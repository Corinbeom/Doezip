import {test,expect} from '@playwright/test';
import {apiBase,createWorkspace,installTestSession,testIdentity} from '../support/e2e-auth';
test('real API refuses unconfigured chat, preserving input and the independently saved report',async({page,context,request})=>{
 const identity=await testIdentity(request);const ws=await createWorkspace(request,identity.headers);await installTestSession(context,identity.session);await page.goto(`/sessions/${ws.session.id}`);
 await page.getByLabel('보고서 내용',{exact:true}).fill('보존할 내 보고서');await expect(page.getByText('저장됨',{exact:true})).toBeVisible();await page.getByLabel('AI에게 질문하기',{exact:true}).fill('공개 자료를 분석해 줘');await page.getByRole('button',{name:'질문 보내기',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'AI 대화 연결이 설정되지 않았습니다.'})).toBeVisible();await expect(page.getByLabel('AI에게 질문하기',{exact:true})).toHaveValue('공개 자료를 분석해 줘');await expect(page.getByLabel('보고서 내용',{exact:true})).toHaveValue('보존할 내 보고서');await page.reload();await expect(page.getByLabel('보고서 내용',{exact:true})).toHaveValue('보존할 내 보고서');
 const other=await testIdentity(request,'bob');expect((await request.get(`${apiBase}/sessions/${ws.session.id}/messages`,{headers:other.headers})).status()).toBe(404);
});
test('stream UI boundary renders partial text, restores terminal history and never overwrites the report',async({page,context,request},info)=>{
 const identity=await testIdentity(request);const ws=await createWorkspace(request,identity.headers);await installTestSession(context,identity.session);
 const userId=crypto.randomUUID(),answerId=crypto.randomUUID();const now=new Date().toISOString();let complete=false;
 const question={id:userId,seqNo:1,role:'USER',contentText:'분석해 줘',status:'COMPLETED',replyToMessageId:null,createdAt:now,completedAt:now};const answer={...question,id:answerId,seqNo:2,role:'ASSISTANT',contentText:'로그에서 확인된 사실입니다. <script>window.chatLeak=true</script>',replyToMessageId:userId};
 // Only this UI boundary substitutes chat. Real SDK+PostgreSQL behavior is tested separately.
 await page.route(`**/sessions/${ws.session.id}/messages`,async route=>{
  if(route.request().method()==='GET'){await route.fulfill({json:{items:complete?[question,answer]:[],nextAfterSeq:null}});return;}
  expect(route.request().postDataJSON().includeCurrentDraft).toBe(false);complete=true;await route.fulfill({contentType:'text/event-stream',body:`event: start\ndata: ${JSON.stringify({userMessageId:userId,assistantMessageId:answerId})}\n\nevent: delta\ndata: ${JSON.stringify({assistantMessageId:answerId,delta:answer.contentText})}\n\nevent: done\ndata: ${JSON.stringify({message:answer})}\n\n`});
 });
 await page.goto(`/sessions/${ws.session.id}`);await page.getByLabel('보고서 내용',{exact:true}).fill('내가 직접 작성한 보고서');await expect(page.getByText('저장됨',{exact:true})).toBeVisible();await page.getByLabel('AI에게 질문하기',{exact:true}).fill('분석해 줘');await page.getByRole('button',{name:'질문 보내기',exact:true}).click();await expect(page.getByText(answer.contentText,{exact:true})).toBeVisible();await expect(page.getByLabel('보고서 내용',{exact:true})).toHaveValue('내가 직접 작성한 보고서');
 await page.reload();await expect(page.getByText(answer.contentText,{exact:true})).toBeVisible();expect(await page.evaluate(()=>Object.hasOwn(window,'chatLeak'))).toBe(false);
 await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('region',{name:'AI와 분석하기',exact:true}).screenshot({path:info.outputPath('chat-mobile.png'),style:'header { visibility: hidden !important; }'});
});
