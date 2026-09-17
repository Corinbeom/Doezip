import {act,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {EvaluationPanel} from './evaluation-panel';
import {getEvaluation,requestEvaluation,retryEvaluation,type Evaluation} from './api';
import {getWorkspace,getDocuments,type Workspace} from '@/features/workspace/api';
vi.mock('./api',()=>({getEvaluation:vi.fn(),requestEvaluation:vi.fn(),retryEvaluation:vi.fn()}));
vi.mock('@/features/workspace/api',()=>({getWorkspace:vi.fn(),getDocuments:vi.fn()}));
const workspace={session:{allowedActions:['REQUEST_INITIAL_EVALUATION']},activeEvaluationId:null} as unknown as Workspace;
const evaluation:Evaluation={id:'eval',sessionId:'session',phase:'INITIAL',status:'FAILED',reportId:null,errorCode:'EVALUATOR_NOT_CONFIGURED',retryable:false,pollAfterMs:2000,createdAt:'2026-09-12T00:00:00Z'};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getWorkspace).mockResolvedValue(workspace);vi.mocked(getEvaluation).mockResolvedValue(evaluation);vi.mocked(getDocuments).mockResolvedValue({items:[{id:'doc',checkpoint:'INITIAL'}]} as Awaited<ReturnType<typeof getDocuments>>);});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,...render(<QueryClientProvider client={client}><EvaluationPanel sessionId="session" userId="owner"/></QueryClientProvider>)};}
it('uses the same idempotency key after an ambiguous request failure',async()=>{
 vi.mocked(requestEvaluation).mockRejectedValueOnce(new Error('lost')).mockResolvedValue(evaluation);mount();fireEvent.click(await screen.findByRole('button',{name:'평가 요청하기'}));fireEvent.click(await screen.findByRole('button',{name:'같은 평가 요청 재전송'}));await screen.findByText('평가 처리 실패');
 expect(vi.mocked(requestEvaluation).mock.calls[0][2]).toBe(vi.mocked(requestEvaluation).mock.calls[1][2]);expect(screen.queryByRole('button',{name:'평가 다시 시도'})).not.toBeInTheDocument();
});
it('restores an existing failed job without creating another request',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,activeEvaluationId:'eval'});mount();await screen.findByText('평가 처리 실패');expect(requestEvaluation).not.toHaveBeenCalled();expect(screen.getByText(/평가기 연결이 아직 준비되지 않았습니다/)).toBeVisible();
});
it('retries only retryable failure on the same job',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,activeEvaluationId:'eval'});vi.mocked(getEvaluation).mockResolvedValue({...evaluation,errorCode:'WORKER_LEASE_EXPIRED',retryable:true});vi.mocked(retryEvaluation).mockResolvedValue({...evaluation,status:'QUEUED',errorCode:null,retryable:false});mount();fireEvent.click(await screen.findByRole('button',{name:'평가 다시 시도'}));await screen.findByText('평가 처리 대기 중');expect(retryEvaluation).toHaveBeenCalledWith('eval',expect.any(AbortSignal));
});
it('aborts an in-flight request on unmount',async()=>{
 vi.mocked(requestEvaluation).mockImplementation(()=>new Promise(()=>{}));const {unmount}=mount();fireEvent.click(await screen.findByRole('button',{name:'평가 요청하기'}));await act(async()=>{});unmount();expect(vi.mocked(requestEvaluation).mock.calls[0][3]?.aborted).toBe(true);
});

it('explains invalid AI evidence without showing a successful report',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,activeEvaluationId:'eval'});vi.mocked(getEvaluation).mockResolvedValue({...evaluation,errorCode:'INVALID_EVALUATION_RESULT',retryable:true});mount();await screen.findByText(/AI 응답의 근거 또는 형식을 검증하지 못했습니다/);expect(screen.getByRole('button',{name:'평가 다시 시도'})).toBeVisible();expect(screen.queryByRole('heading',{name:'최초 평가 결과'})).not.toBeInTheDocument();
});
it('explains quota exhaustion without offering an unlimited retry',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,activeEvaluationId:'eval'});vi.mocked(getEvaluation).mockResolvedValue({...evaluation,errorCode:'EVALUATION_DAILY_LIMIT'});mount();await screen.findByText(/오늘의 AI 평가 호출 한도/);expect(screen.queryByRole('button',{name:'평가 다시 시도'})).not.toBeInTheDocument();
});
