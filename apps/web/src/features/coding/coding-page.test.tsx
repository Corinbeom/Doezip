import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import {CodingPage} from './coding-page';
import {getWorkspace,mutate,type Workspace} from './api';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>'/coding'}));
vi.mock('@/shared/auth/auth-provider',()=>({useAuth:()=>({status:'connected',user:{id:'owner'}})}));
vi.mock('@/shared/ui/learning-shell',()=>({LearningShell:({children}:{children:React.ReactNode})=>children}));
vi.mock('./execute',()=>({execute:vi.fn()}));
vi.mock('./api',()=>({getWorkspace:vi.fn(),mutate:vi.fn()}));
const original='function addItem(items,item){items.push(item);return items;}';
let workspace:Workspace;
beforeEach(()=>{workspace={id:'11111111-1111-4111-8111-111111111111',taskVersion:'duplicate-items-v1',code:original,version:0,submittedAt:null,explanation:null,lastRun:null,turns:[{id:'22222222-2222-4222-8222-222222222222',requestKey:'33333333-3333-4333-8333-333333333333',baseVersion:0,baseCode:original,instruction:'수정해 줘',status:'SUCCEEDED',explanation:'중복 여부를 확인하세요.',proposedCode:'function addItem(items,item){return items;}'}]};vi.mocked(getWorkspace).mockImplementation(async()=>workspace);});
function mount(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><CodingPage id={workspace.id}/></QueryClientProvider>);}
it('applies a reviewed proposal and allows undo without automatically saving',async()=>{mount();const editor=await screen.findByRole('textbox',{name:'solution.js'});expect(screen.getByRole('region',{name:'AI와 함께 수정하기'})).toBeVisible();expect(screen.getByRole('log',{name:'AI 대화 기록'})).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'검토한 수정안 적용'}));expect(editor).toHaveValue(workspace.turns[0].proposedCode);expect(mutate).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'AI 변경 되돌리기'}));expect(editor).toHaveValue(original);});
it('does not apply an old proposal over unsaved edits',async()=>{mount();const editor=await screen.findByRole('textbox',{name:'solution.js'});fireEvent.change(editor,{target:{value:'my unsaved code'}});expect(screen.getByRole('button',{name:'검토한 수정안 적용'})).toBeDisabled();expect(editor).toHaveValue('my unsaved code');});
it('does not let Enter submit an empty AI request',async()=>{mount();const input=await screen.findByRole('textbox',{name:'AI에게 요청'});fireEvent.keyDown(input,{key:'Enter'});expect(mutate).not.toHaveBeenCalled();});
it('preserves edits after a failed save',async()=>{vi.mocked(mutate).mockRejectedValue(new Error('연결 실패'));mount();const editor=await screen.findByRole('textbox',{name:'solution.js'});fireEvent.change(editor,{target:{value:'preserved'}});fireEvent.click(screen.getByRole('button',{name:'코드 저장'}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('연결 실패'));expect(editor).toHaveValue('preserved');});
it('disables mutation after submission and distinguishes practice results from grading',async()=>{workspace.submittedAt='2026-09-15';mount();expect(await screen.findByRole('textbox',{name:'solution.js'})).toBeDisabled();expect(screen.queryByRole('button',{name:'최종 코드 제출'})).not.toBeInTheDocument();expect(screen.getByText(/구현 과제의 AI 역량 평가는 아직/)).toBeVisible();});
