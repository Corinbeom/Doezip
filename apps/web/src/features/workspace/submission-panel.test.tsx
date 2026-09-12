import { act,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { SubmissionPanel } from './submission-panel';
import { getDocuments,submitInitial,type DocumentVersion } from './api';
vi.mock('@/features/challenge/challenge-panel',()=>({ChallengePanel:()=>null}));
vi.mock('./api',()=>({getDocuments:vi.fn(),submitInitial:vi.fn()}));
const draft={markdown:'saved content',lockVersion:3,contentHash:'a'.repeat(64)};
const document:DocumentVersion={id:'doc',sessionId:'session',versionNo:1,checkpoint:'INITIAL',contentMarkdown:'<script>bad()</script>',contentHash:draft.contentHash,sourceDraftLockVersion:3,sealedAt:'2026-09-11T00:00:00Z',createdAt:'2026-09-11T00:00:00Z'};
const onBusy=vi.fn(),onSealed=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.mocked(getDocuments).mockResolvedValue({items:[]});vi.spyOn(window,'confirm').mockReturnValue(true);});
afterEach(()=>vi.restoreAllMocks());
function mount(ready=true){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><SubmissionPanel sessionId="session" userId="owner" draft={draft} ready={ready} allowed onBusy={onBusy} onSealed={onSealed} onReload={vi.fn()}/></QueryClientProvider>);}
it('blocks submission until autosave confirms the current buffer',async()=>{
 mount(false);await screen.findByText('아직 제출한 보고서가 없습니다.');expect(screen.getByRole('button',{name:'최초 제출하기'})).toBeDisabled();expect(submitInitial).not.toHaveBeenCalled();
});
it('requires explicit confirmation and serializes clicks using the server snapshot',async()=>{
 let finish!:(value:DocumentVersion)=>void;vi.mocked(submitInitial).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));mount();await screen.findByText('아직 제출한 보고서가 없습니다.');
 vi.mocked(window.confirm).mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:'최초 제출하기'}));expect(submitInitial).not.toHaveBeenCalled();
 vi.mocked(window.confirm).mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'최초 제출하기'}));expect(screen.getByRole('button',{name:'제출 중…'})).toBeDisabled();expect(submitInitial).toHaveBeenCalledExactlyOnceWith('session',draft,expect.any(AbortSignal));
 await act(async()=>finish(document));await screen.findByText('최초 제출본이 보관되었습니다.');expect(onSealed).toHaveBeenCalled();expect(screen.getByText('<script>bad()</script>')).toBeInTheDocument();expect(window.document.querySelector('script')).toBeNull();
});
it('preserves the snapshot on response failure and can discover the already stored submission',async()=>{
 vi.mocked(submitInitial).mockRejectedValue(new Error('response lost'));mount();await screen.findByText('아직 제출한 보고서가 없습니다.');fireEvent.click(screen.getByRole('button',{name:'최초 제출하기'}));await screen.findByRole('button',{name:'최초 제출 재시도'});
 vi.mocked(getDocuments).mockResolvedValue({items:[document]});fireEvent.click(screen.getByRole('button',{name:'제출본 확인'}));await screen.findByText('최초 제출본이 보관되었습니다.');expect(submitInitial).toHaveBeenCalledTimes(1);
});
it('cancels the private request on account editor unmount',async()=>{
 vi.mocked(submitInitial).mockImplementation(()=>new Promise(()=>{}));const {unmount}=mount();await screen.findByText('아직 제출한 보고서가 없습니다.');fireEvent.click(screen.getByRole('button',{name:'최초 제출하기'}));const signal=vi.mocked(submitInitial).mock.calls[0][2];unmount();expect(signal?.aborted).toBe(true);
});
