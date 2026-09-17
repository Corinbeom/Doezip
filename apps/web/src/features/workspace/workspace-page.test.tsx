import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WorkspacePage} from './workspace-page';
import {getMaterial,getWorkspace,type Workspace} from './api';
import {useAuth} from '@/shared/auth/auth-provider';
vi.mock('@/features/chat/chat-panel',()=>({ChatPanel:()=>null}));
vi.mock('./api',()=>({getMaterial:vi.fn(),getWorkspace:vi.fn(),saveDraft:vi.fn(),getDocuments:vi.fn().mockResolvedValue({items:[]}),submitInitial:vi.fn()}));
vi.mock('@/shared/auth/auth-provider',()=>({useAuth:vi.fn()}));
vi.mock('@/features/auth/auth-control',()=>({AuthControl:()=>null}));
const workspace:Workspace={session:{id:'session',taskId:'task',status:'ACTIVE',currentStep:'WRITING',mode:'PRACTICE',conditionReleasedAt:null,allowedActions:['READ_MATERIALS','WRITE_DRAFT']},task:{id:'task',taskCode:'task',versionNo:1,title:'자료로 판단하기',descriptionMarkdown:'설명',status:'PUBLISHED',rubrics:[]},materials:[],draft:{markdown:'saved report',lockVersion:1,contentHash:'hash'},challengeRunId:null,initialReportId:null,finalReportId:null,activeEvaluationId:null};
const connected={status:'connected' as const,user:{id:'user1',displayName:'학습자',email:null},logout:vi.fn(),reconnect:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(useAuth).mockReturnValue(connected);});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,...render(<QueryClientProvider client={client}><WorkspacePage sessionId="session"/></QueryClientProvider>)};}
it('loads private workspace, restores draft, and handles no materials honestly',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue(workspace);const {client}=mount();expect(screen.getByRole('status')).toHaveTextContent('작업 공간을 불러오는 중');
 expect(await screen.findByLabelText('보고서 내용')).toHaveValue('saved report');expect(screen.getByText('공개된 자료가 없습니다.')).toBeInTheDocument();expect(client.getQueryCache().getAll()[0].meta).toEqual({private:true});
});
it('requires login and clears the editor immediately after account logout',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue(workspace);const {rerender,client}=mount();await screen.findByLabelText('보고서 내용');
 vi.mocked(useAuth).mockReturnValue({...connected,status:'anonymous',user:null});rerender(<QueryClientProvider client={client}><WorkspacePage sessionId="session"/></QueryClientProvider>);
 expect(screen.queryByLabelText('보고서 내용')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'로그인하고 이어서 작성하기'})).toBeInTheDocument();
});
it('retries failed material and renders line contents as plain text',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,materials:[{id:'material',title:'장애 로그',type:'LOG',sortOrder:1}]});
 vi.mocked(getMaterial).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({id:'material',title:'장애 로그',type:'LOG',sortOrder:1,contentMarkdown:'<script>private()</script>',contentHash:'hash',lines:[{number:1,text:'<script>private()</script>'}]});
 mount();await screen.findByRole('button',{name:'자료 재시도'});fireEvent.click(screen.getByRole('button',{name:'자료 재시도'}));await screen.findByText('<script>private()</script>');expect(document.querySelector('script')).toBeNull();
});
it('respects allowed actions for read-only stages',async()=>{
 vi.mocked(getWorkspace).mockResolvedValue({...workspace,session:{...workspace.session,allowedActions:[]}});mount();expect(await screen.findByLabelText('보고서 내용')).toHaveAttribute('readonly');expect(screen.queryByRole('button',{name:'지금 저장'})).not.toBeInTheDocument();expect(getMaterial).not.toHaveBeenCalled();
});
it('waits for a fresh workspace when navigation returns to a cached session',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['workspace','user1','session'],workspace);
 let finish!:(value:Workspace)=>void;vi.mocked(getWorkspace).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 render(<QueryClientProvider client={client}><WorkspacePage sessionId="session"/></QueryClientProvider>);
 expect(screen.queryByLabelText('보고서 내용')).not.toBeInTheDocument();
 finish({...workspace,draft:{...workspace.draft,markdown:'newest saved report',lockVersion:8}});
 expect(await screen.findByLabelText('보고서 내용')).toHaveValue('newest saved report');
});
