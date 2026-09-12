import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ReviewEditor} from './review-editor';
import {saveReviews,type ChallengeRun} from './api';
vi.mock('./api',()=>({saveReviews:vi.fn(),getChallenge:vi.fn(),submitChallenge:vi.fn()}));
vi.mock('@/features/workspace/api',()=>({getWorkspace:vi.fn().mockResolvedValue({materials:[]}),getMaterial:vi.fn()}));
const initial:ChallengeRun={id:'r',sessionId:'s',title:'초안',instructionsMarkdown:'안내',noticeVersion:'challenge-notice-v1',status:'IN_PROGRESS',lockVersion:0,statements:[{id:'one',statementKey:'S01',order:1,text:'문장'}],reviews:[],submittedAt:null};
beforeEach(()=>vi.clearAllMocks());
function mount(run=initial){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ReviewEditor initial={run} userId="owner"/></QueryClientProvider>);}
it('keeps review input when save fails and prevents submitting an unsaved buffer',async()=>{
 vi.mocked(saveReviews).mockRejectedValue(new Error('conflict'));mount();fireEvent.change(screen.getByLabelText('판단',{exact:true}),{target:{value:'KEEP'}});fireEvent.change(screen.getByLabelText('판단 이유'),{target:{value:'판단 근거'}});
 expect(screen.getByRole('button',{name:'검산 제출'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'검토 저장'}));await screen.findByRole('alert');expect(screen.getByLabelText('판단 이유')).toHaveValue('판단 근거');expect(saveReviews).toHaveBeenCalledWith('r',[{statementId:'one',decision:'KEEP',reasonText:'판단 근거',replacementText:null,evidence:[]}],0,expect.any(AbortSignal));
});
it('renders a submitted review as read-only without an evaluation result',()=>{
 mount({...initial,status:'SUBMITTED',submittedAt:'2026-09-12T00:00:00Z'});expect(screen.getByLabelText('판단',{exact:true})).toBeDisabled();expect(screen.queryByRole('button',{name:'검산 제출'})).not.toBeInTheDocument();expect(screen.getByText('검토와 근거가 잠겼습니다. 평가 결과는 아직 제공되지 않습니다.')).toBeVisible();
});
