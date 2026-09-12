import { act,fireEvent,render,screen } from '@testing-library/react';
import { beforeEach,expect,it,vi } from 'vitest';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { ChallengePanel } from './challenge-panel';
import { getChallenge,startChallenge,type ChallengeRun } from './api';
import { getWorkspace,type Workspace } from '@/features/workspace/api';
vi.mock('./api',()=>({getChallenge:vi.fn(),startChallenge:vi.fn()}));
vi.mock('@/features/workspace/api',()=>({getWorkspace:vi.fn()}));
const workspace={session:{allowedActions:['START_CHALLENGE']},challengeRunId:null,materials:[]} as unknown as Workspace;
const run:ChallengeRun={id:'run',sessionId:'session',title:'검토 초안',instructionsMarkdown:'원자료와 비교하세요.',noticeVersion:'challenge-notice-v1',status:'IN_PROGRESS',lockVersion:0,statements:[{id:'statement',statementKey:'S01',order:1,text:'<script>hidden()</script>'}],reviews:[],submittedAt:null};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getWorkspace).mockResolvedValue(workspace);vi.mocked(getChallenge).mockResolvedValue(run);});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,...render(<QueryClientProvider client={client}><ChallengePanel userId="owner" sessionId="session"/></QueryClientProvider>)};}
it('does not fetch or reveal assigned content before explicit notice acknowledgement',async()=>{
 mount();await screen.findByRole('button',{name:'검산 시작하기'});expect(getChallenge).not.toHaveBeenCalled();expect(startChallenge).not.toHaveBeenCalled();expect(screen.queryByText('<script>hidden()</script>')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'검산 시작하기'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByRole('button',{name:'검산 시작하기'})).toBeEnabled();
});
it('assigns once, renders literal statements, and scopes private query data by user',async()=>{
 let finish!:(value:ChallengeRun)=>void;vi.mocked(startChallenge).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const {client}=mount();await screen.findByRole('checkbox');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'검산 시작하기'}));
 expect(screen.getByRole('button',{name:'검산 시작 중…'})).toBeDisabled();expect(startChallenge).toHaveBeenCalledExactlyOnceWith('session',expect.any(AbortSignal));
 await act(async()=>finish(run));await screen.findByText('<script>hidden()</script>');expect(document.querySelector('script')).toBeNull();
 expect(client.getQueryCache().find({queryKey:['challenge','owner','run']})?.meta).toEqual({private:true});
});
it('restores an assigned run without recording acknowledgement again',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,challengeRunId:'run'});mount();await screen.findByText('<script>hidden()</script>');expect(startChallenge).not.toHaveBeenCalled();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
it('recovers a lost start response through server workspace lookup',async()=>{
 vi.mocked(startChallenge).mockRejectedValue(new Error('lost response'));mount();await screen.findByRole('checkbox');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'검산 시작하기'}));await screen.findByRole('button',{name:'검산 시작 재시도'});
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,challengeRunId:'run'});fireEvent.click(screen.getByRole('button',{name:'검산 상태 다시 확인'}));await screen.findByText('<script>hidden()</script>');expect(startChallenge).toHaveBeenCalledTimes(1);
});
it('retries a failed read and does not turn unavailable content into a fake run',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,challengeRunId:'run'});vi.mocked(getChallenge).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(run);mount();await screen.findByRole('button',{name:'초안 다시 불러오기'});fireEvent.click(screen.getByRole('button',{name:'초안 다시 불러오기'}));await screen.findByText('<script>hidden()</script>');expect(startChallenge).not.toHaveBeenCalled();
});
it('aborts assignment when the authenticated editor unmounts',async()=>{
 vi.mocked(startChallenge).mockImplementation(()=>new Promise(()=>{}));const {unmount}=mount();await screen.findByRole('checkbox');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'검산 시작하기'}));const signal=vi.mocked(startChallenge).mock.calls[0][1];unmount();expect(signal?.aborted).toBe(true);
});
it('offers no start action when the server denies this phase',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,session:{...workspace.session,allowedActions:[]}});mount();await screen.findByText('이 과제의 검산 초안은 아직 준비되지 않았거나, 현재 단계에서 시작할 수 없습니다.');expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(startChallenge).not.toHaveBeenCalled();
});

it('retains unsaved review when a background read fails',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,challengeRunId:'run'});const {client}=mount();await screen.findByText('<script>hidden()</script>');
 fireEvent.change(screen.getByLabelText('판단',{exact:true}),{target:{value:'KEEP'}});fireEvent.change(screen.getByLabelText('판단 이유'),{target:{value:'keep local edits'}});
 vi.mocked(getChallenge).mockRejectedValue(new Error('background offline'));await act(async()=>{await client.invalidateQueries({queryKey:['challenge','owner','run']});});
 expect(screen.getByLabelText('판단 이유')).toHaveValue('keep local edits');
});
