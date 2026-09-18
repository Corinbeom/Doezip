import {fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {QueryProvider} from '@/shared/api/query-provider';
import {TaskDetailPage,TaskListPage} from './task-pages';
import type {Task} from './api';
import type {LearningTask} from '@/shared/api/learning-catalog';

vi.mock('next/navigation',async(importOriginal)=>({...await importOriginal<typeof import('next/navigation')>(),usePathname:()=>'/tasks',useRouter:()=>({push:vi.fn()})}));
vi.mock('@/shared/auth/auth-provider',()=>({useAuth:()=>({status:'disconnected',user:null})}));

const task:Task={
  id:'61111111-1111-4111-8111-111111111111',taskCode:'test-task',versionNo:1,
  title:'조회 테스트용 가상 과제',descriptionMarkdown:'공개된 과제 설명\n<script>unsafe()</script>',status:'PUBLISHED',
  rubrics:[{code:'E1',area:'EVIDENCE',title:'근거 확인',description:'공개된 자료로 설명합니다.'}],
};
const report:LearningTask={catalogId:'payment-delay-report',version:'learning-flow-v2',kind:'REPORT',difficulty:'중급',estimatedMinutes:35,tags:['운영 분석','보고서','상충 근거'],title:'결제 지연 대응안을 운영 리드에게 제안하기',situation:'서로 다른 자료를 비교해 운영 리드에게 보고합니다.',requirements:['일치하거나 충돌하는 내용을 구분합니다.'],deliverable:'근거가 연결된 보고서',questions:['왜 이렇게 판단했나요?','무엇을 바꾸겠나요?'],hints:[]};
const coding:LearningTask={catalogId:'item-identity-coding',version:'learning-flow-v2',kind:'CODING',difficulty:'중급',estimatedMinutes:30,tags:['JavaScript','디버깅','경계 조건'],title:'항목의 식별 기준을 바로잡기',situation:'잘못된 식별 기준으로 생긴 중복 버그를 수정합니다.',requirements:['id를 기준으로 판단합니다.'],deliverable:'코드와 테스트 기록',questions:['왜 이렇게 판단했나요?','무엇을 바꾸겠나요?'],hints:[]};
const activation:LearningTask={...report,catalogId:'activation-drop-report',version:'activation-drop-v1',estimatedMinutes:40,tags:['퍼널 분석','CSV·JSON','VOC'],title:'가입 후 활성화 하락 원인을 제품 리드에게 보고하기'};
const retry:LearningTask={...coding,catalogId:'retry-policy-coding',version:'retry-policy-v1',estimatedMinutes:35,tags:['JavaScript','재시도 정책','예외 처리'],title:'결제 요청의 안전한 재시도 조건 구현하기'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

it('loads the unified public catalog and exposes report and coding tags',async()=>{
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL','http://localhost:8181/api/v1/');
  const fetcher=vi.fn().mockResolvedValue(json([report,activation,coding,retry]));
  vi.stubGlobal('fetch',fetcher);
  render(<QueryProvider><TaskListPage/></QueryProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('과제를 불러오는 중');
  expect(await screen.findByRole('link',{name:report.title})).toHaveAttribute('href','/tasks/'+report.catalogId);
  expect(screen.getByRole('link',{name:coding.title})).toHaveAttribute('href','/tasks/'+coding.catalogId);
  expect(screen.getByRole('link',{name:activation.title})).toHaveAttribute('href','/tasks/'+activation.catalogId);
  expect(screen.getByRole('link',{name:retry.title})).toHaveAttribute('href','/tasks/'+retry.catalogId);
  expect(screen.getAllByText('JavaScript')).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledWith('http://localhost:8181/api/v1/learning-flows/catalog',expect.objectContaining({signal:expect.any(AbortSignal)}));
});
it('filters the unified catalog by task type',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json([report,coding])));
  render(<QueryProvider><TaskListPage/></QueryProvider>);
  await screen.findByRole('link',{name:report.title});
  fireEvent.click(screen.getByRole('button',{name:'구현'}));
  expect(screen.queryByRole('link',{name:report.title})).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:coding.title})).toBeInTheDocument();
});
it('shows an empty published task list',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json([])));
  render(<QueryProvider><TaskListPage/></QueryProvider>);
  await screen.findByText('공개된 과제가 없습니다.');
});
it('reports network failure and retries the request successfully',async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(json([report,coding]));
  vi.stubGlobal('fetch',fetcher);
  render(<QueryProvider><TaskListPage/></QueryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('과제 목록을 불러오지 못했습니다.');
  fireEvent.click(screen.getByRole('button',{name:'재시도'}));
  await screen.findByRole('link',{name:report.title});
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('renders catalog detail with requirements and a login start path',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json([report,coding])));
  render(<QueryProvider><TaskDetailPage taskId={coding.catalogId}/></QueryProvider>);
  await screen.findByRole('heading',{name:coding.title});
  expect(screen.getByRole('region',{name:'과제 상황'})).toHaveTextContent(coding.situation);
  expect(screen.getByRole('heading',{name:'완료 조건'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'결과보다 판단 과정을 남겨요.'})).toBeInTheDocument();
  expect(screen.getByText('제안과 경계 테스트를 대조합니다.')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/로그인하고 시작하기/})).toHaveAttribute('href','/login?returnTo=%2Ftasks%2Fitem-identity-coding');
});
it('renders legacy public detail and rubrics safely as text',async()=>{
  const fetcher=vi.fn().mockResolvedValue(json(task));
  vi.stubGlobal('fetch',fetcher);
  render(<QueryProvider><TaskDetailPage taskId={task.id}/></QueryProvider>);
  await screen.findByRole('heading',{name:task.title});
  expect(screen.getByRole('region',{name:'과제 설명'})).toHaveTextContent('공개된 과제 설명 <script>unsafe()</script>');
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByRole('heading',{name:'근거 확인'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'과제 목록으로'})).toHaveAttribute('href','/tasks');
  expect(fetcher.mock.calls[0][0]).toContain('/tasks/'+task.id);
});
it('shows unavailable legacy detail without a misleading retry action',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({code:'NOT_FOUND',message:'없음',requestId:'test'},404)));
  render(<QueryProvider><TaskDetailPage taskId={task.id}/></QueryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('과제를 찾을 수 없습니다.');
  expect(screen.queryByRole('button',{name:'재시도'})).not.toBeInTheDocument();
});
it('retries legacy detail after server failure',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(json({},503)).mockResolvedValueOnce(json(task));
  vi.stubGlobal('fetch',fetcher);
  render(<QueryProvider><TaskDetailPage taskId={task.id}/></QueryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('과제를 불러오지 못했습니다.');
  fireEvent.click(screen.getByRole('button',{name:'재시도'}));
  await screen.findByRole('heading',{name:task.title});
});
it('does not display legacy task data when the response violates the public contract',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...task,privateAnswer:'must never render'})));
  render(<QueryProvider><TaskDetailPage taskId={task.id}/></QueryProvider>);
  await screen.findByRole('alert');
  expect(screen.queryByText('must never render')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:task.title})).not.toBeInTheDocument();
});
it('keeps one catalog navigation path and removes the standalone coding menu',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json([report,coding])));
  render(<QueryProvider><TaskListPage/></QueryProvider>);
  await screen.findByRole('link',{name:report.title});
  expect(screen.getByRole('link',{name:'되짚 홈'})).toHaveAttribute('href','/');
  expect(screen.getByRole('link',{name:'본문으로 바로가기'})).toHaveAttribute('href','#task-main');
  expect(screen.getByRole('link',{name:'과제 살펴보기'})).toHaveAttribute('href','#task-list');
  expect(screen.getByRole('link',{name:'내 학습'})).toHaveAttribute('href','/learn');
  expect(within(screen.getByRole('navigation',{name:'주 메뉴'})).getAllByRole('link').map(link=>link.textContent)).toEqual(['과제 둘러보기','내 학습']);
  expect(screen.queryByRole('link',{name:'구현 연습'})).not.toBeInTheDocument();
});
it('renders missing legacy rubrics without inventing evaluation criteria',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...task,rubrics:[]})));
  render(<QueryProvider><TaskDetailPage taskId={task.id}/></QueryProvider>);
  await screen.findByText('등록된 평가 기준이 없습니다.');
  expect(screen.queryByRole('heading',{name:'근거 확인'})).not.toBeInTheDocument();
});
