import {test,expect} from '@playwright/test';
import {apiBase,sampleTaskId,testIdentity,installTestSession} from '../support/e2e-auth';

test('one checkout: write, submit, review, real AI report and reload',async({page,context,request},info)=>{
 const identity=await testIdentity(request);await installTestSession(context,identity.session);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/tasks/${sampleTaskId}`);await page.getByRole('button',{name:'과제 시작하기',exact:true}).click();
 await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/);const id=page.url().split('/').pop()!;
 const body='가상 로그에서 10:00 결제 API 응답 지연 알림이 발생했다. 10:05 시점에는 원인이 확정되지 않았다. 추가 로그와 지표를 대조해야 한다.';
 await page.getByRole('textbox',{name:'보고서 내용'}).fill(body);
 await expect(page.getByRole('button',{name:'최초 제출하기'})).toBeEnabled();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'최초 제출하기'}).click();
 await expect(page.getByText('최초 제출본이 보관되었습니다.')).toBeVisible();
 await page.getByRole('checkbox',{name:'검산 안내를 확인했습니다.'}).check();await page.getByRole('button',{name:'검산 시작하기',exact:true}).click();
 const section=page.getByRole('region',{name:'S01 검토'});
 await section.getByRole('combobox',{name:'판단',exact:true}).selectOption('KEEP');
 await section.getByLabel('판단 이유').fill('가상 공개 로그 첫 기록의 응답 지연 알림을 확인했다. 원인 확정과 구분해야 한다.');
 await section.getByRole('combobox',{name:'인용할 자료',exact:true}).selectOption({index:1});
 await expect(section.getByRole('button',{name:'선택한 근거 추가'})).toBeEnabled();await section.getByRole('button',{name:'선택한 근거 추가'}).click();
 await page.getByRole('button',{name:'검토 저장',exact:true}).click();await expect(page.getByText('검토가 저장되었습니다.',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'검산 제출',exact:true}).click();
 await page.getByRole('button',{name:'평가 요청하기',exact:true}).click();
 await expect.poll(async()=>{
  const w=await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json();
  if(!w.activeEvaluationId)return 'WAITING';
  const job=await (await request.get(`${apiBase}/evaluations/${w.activeEvaluationId}`,{headers:identity.headers})).json();
  if(job.status==='FAILED')throw new Error(`Live evaluation failed: ${job.errorCode}`);
  return job.status;
 },{timeout:180000,intervals:[2000]}).toBe('SUCCEEDED');
 const workspace=await (await request.get(`${apiBase}/sessions/${id}/workspace`,{headers:identity.headers})).json();
 expect(workspace.initialReportId).toBeTruthy();
 const result=await request.get(`${apiBase}/reports/${workspace.initialReportId}`,{headers:identity.headers});expect(result.ok()).toBe(true);
 const report=await result.json();expect(report.sample).toBe(false);expect(report.areas).toHaveLength(4);
 await expect(page.getByRole('heading',{name:'최초 평가 결과'})).toBeVisible();
 await page.reload();await expect(page.getByRole('region',{name:'평가 결과',exact:true})).toContainText(report.summary);
 const restored=await (await request.get(`${apiBase}/reports/${workspace.initialReportId}`,{headers:identity.headers})).json();expect(restored).toEqual(report);
 expect((await (await request.get(`${apiBase}/sessions/${id}/document-versions`,{headers:identity.headers})).json()).items[0].contentMarkdown).toBe(body);
 expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('initial-flow-complete.png'),fullPage:true});
});
