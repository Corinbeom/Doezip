import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ChatPanel} from './chat-panel';
import {listMessages,sendMessage,cancelMessage,type Message} from './api';
vi.mock('./api',()=>({listMessages:vi.fn(),sendMessage:vi.fn(),cancelMessage:vi.fn()}));
const id='11111111-1111-4111-8111-111111111111';
const answer:Message={id,seqNo:2,role:'ASSISTANT',contentText:'<script>literal</script>',status:'COMPLETED',replyToMessageId:id,createdAt:'2026-09-14T00:00:00Z',completedAt:'2026-09-14T00:00:01Z'};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(listMessages).mockResolvedValue({items:[],nextAfterSeq:null});});
function mount(draftReady=true){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return {client,...render(<QueryClientProvider client={client}><ChatPanel sessionId="session" userId="owner" allowed draftReady={draftReady} onBusy={()=>{}}/></QueryClientProvider>)};}
it('preserves failed input and retries the same key; a completed reply restores as literal text',async()=>{
 vi.mocked(sendMessage).mockRejectedValueOnce(new Error('lost response')).mockImplementationOnce(async(_id,_body,receive)=>{receive({type:'start',id});receive({type:'delta',text:answer.contentText});vi.mocked(listMessages).mockResolvedValue({items:[answer],nextAfterSeq:null});receive({type:'done',message:answer});});
 const {container,client}=mount();await waitFor(()=>expect(screen.getByRole('button',{name:'대화 새로 불러오기'})).toBeEnabled());
 fireEvent.change(screen.getByLabelText('AI에게 질문하기'),{target:{value:'내 질문'}});fireEvent.click(screen.getByRole('button',{name:'질문 보내기'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'같은 요청 다시 확인'})).toBeEnabled());expect(screen.getByLabelText('AI에게 질문하기')).toHaveValue('내 질문');fireEvent.click(screen.getByRole('button',{name:'같은 요청 다시 확인'}));
 await waitFor(()=>expect(screen.getByText(answer.contentText)).toBeVisible());expect(screen.getByText('질문 예시').closest('details')).not.toHaveAttribute('open');expect(container.querySelector('script')).toBeNull();expect(vi.mocked(sendMessage).mock.calls[0][1].clientMessageKey).toBe(vi.mocked(sendMessage).mock.calls[1][1].clientMessageKey);expect(client.getQueryCache().getAll()[0].meta?.private).toBe(true);
});
it('looks and behaves like a conversation before the first request',async()=>{
 mount();await waitFor(()=>expect(screen.getByRole('button',{name:'대화 새로 불러오기'})).toBeEnabled());
 expect(screen.getByRole('region',{name:'AI와 분석하기'})).toBeVisible();expect(screen.getByRole('log',{name:'AI 대화 기록'})).toBeVisible();expect(screen.getByText(/어떤 판단이 필요한지 알려 주세요/)).toBeVisible();
 expect(screen.getByText('질문 예시').closest('details')).not.toHaveAttribute('open');
 fireEvent.click(screen.getByRole('button',{name:'자료에서 확인된 사실과 아직 모르는 점을 나눠 줘.'}));expect(screen.getByLabelText('AI에게 질문하기')).toHaveValue('자료에서 확인된 사실과 아직 모르는 점을 나눠 줘.');
});
it('requires a saved draft for opt-in and never includes it by default',async()=>{
 mount(false);await waitFor(()=>expect(screen.getByRole('button',{name:'대화 새로 불러오기'})).toBeEnabled());fireEvent.change(screen.getByLabelText('AI에게 질문하기'),{target:{value:'질문'}});expect(screen.getByLabelText('저장된 내 보고서 초안도 AI에게 전달')).not.toBeChecked();fireEvent.click(screen.getByLabelText('저장된 내 보고서 초안도 AI에게 전달'));expect(screen.getByRole('button',{name:'질문 보내기'})).toBeDisabled();expect(sendMessage).not.toHaveBeenCalled();
});
it('does not let Enter bypass a disabled send action after history loading fails',async()=>{
 vi.mocked(listMessages).mockRejectedValue(new Error('offline'));mount();await screen.findByText(/저장된 대화를 불러오지 못했습니다/);const input=screen.getByLabelText('AI에게 질문하기');fireEvent.change(input,{target:{value:'보내면 안 되는 질문'}});fireEvent.keyDown(input,{key:'Enter'});expect(sendMessage).not.toHaveBeenCalled();
});
it('restores a running request, can cancel it, and preserves terminal state',async()=>{
 vi.mocked(listMessages).mockResolvedValue({items:[{...answer,status:'STREAMING',completedAt:null}],nextAfterSeq:null});vi.mocked(cancelMessage).mockImplementation(async()=>{vi.mocked(listMessages).mockResolvedValue({items:[{...answer,status:'CANCELLED'}],nextAfterSeq:null});return {...answer,status:'CANCELLED'};});mount();fireEvent.click(await screen.findByRole('button',{name:'응답 생성 중지'}));expect(await screen.findByText('생성 중지')).toBeVisible();expect(cancelMessage).toHaveBeenCalledWith('session',id);expect(screen.queryByRole('button',{name:'응답 생성 중지'})).not.toBeInTheDocument();
});
it('aborts the private stream when its account or workspace unmounts',async()=>{
 vi.mocked(sendMessage).mockImplementation((_id,_body,_receive,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))));
 const {unmount}=mount();await waitFor(()=>expect(screen.getByRole('button',{name:'대화 새로 불러오기'})).toBeEnabled());fireEvent.change(screen.getByLabelText('AI에게 질문하기'),{target:{value:'질문'}});fireEvent.click(screen.getByRole('button',{name:'질문 보내기'}));await waitFor(()=>expect(sendMessage).toHaveBeenCalledOnce());const signal=vi.mocked(sendMessage).mock.calls[0][3];await act(async()=>unmount());expect(signal.aborted).toBe(true);
});

it('a confirmed stop is shown as cancellation rather than a network failure',async()=>{
 vi.mocked(sendMessage).mockImplementation((_id,_body,receive,signal)=>new Promise((resolve,reject)=>{receive({type:'start',id});signal.addEventListener('abort',()=>reject(new Error('aborted')));}));
 vi.mocked(cancelMessage).mockResolvedValue({...answer,status:'CANCELLED'});mount();await waitFor(()=>expect(screen.getByRole('button',{name:'대화 새로 불러오기'})).toBeEnabled());fireEvent.change(screen.getByLabelText('AI에게 질문하기'),{target:{value:'질문'}});fireEvent.click(screen.getByRole('button',{name:'질문 보내기'}));fireEvent.click(await screen.findByRole('button',{name:'응답 생성 중지'}));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('응답 생성을 중지했습니다.'));expect(screen.getByLabelText('AI에게 질문하기')).toHaveValue('질문');
});

it('shows incoming text before completion and keeps sending disabled until terminal restoration',async()=>{
 let receive!:Parameters<typeof sendMessage>[2];let finish!:()=>void;
 vi.mocked(sendMessage).mockImplementation((_id,_body,callback)=>{receive=callback;return new Promise<void>(resolve=>{finish=resolve;});});
 mount();await waitFor(()=>expect(screen.getByRole('button',{name:'대화 새로 불러오기'})).toBeEnabled());fireEvent.change(screen.getByLabelText('AI에게 질문하기'),{target:{value:'질문'}});fireEvent.click(screen.getByRole('button',{name:'질문 보내기'}));
 expect(within(screen.getByRole('log',{name:'AI 대화 기록'})).getByText('질문')).toBeVisible();expect(screen.getByText('전송됨')).toBeVisible();expect(screen.getByText('자료와 대화 맥락을 확인하고 있어요.')).toBeVisible();expect(screen.getByText('0초')).toBeVisible();
 await act(async()=>{receive({type:'start',id});receive({type:'delta',text:'아직 생성 중인 문장'});});expect(screen.getByText('아직 생성 중인 문장')).toBeVisible();expect(screen.getByRole('button',{name:'질문 보내기'})).toBeDisabled();
 vi.mocked(listMessages).mockResolvedValue({items:[answer],nextAfterSeq:null});await act(async()=>{receive({type:'done',message:answer});finish();});await waitFor(()=>expect(screen.queryByText('아직 생성 중인 문장')).not.toBeInTheDocument());expect(screen.getByText(answer.contentText)).toBeVisible();
});
