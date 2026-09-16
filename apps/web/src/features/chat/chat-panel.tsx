'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ApiError} from '@/shared/api/client';
import {AiConversationPanel,AiMessage,MessageContent} from '@/shared/ui/ai-conversation';
import {cancelMessage,listMessages,sendMessage,type ChatRequest,type Message} from './api';
import styles from './chat.module.css';

const quickPrompts=[
 '자료에서 확인된 사실과 아직 모르는 점을 나눠 줘.',
 '내 주장과 원자료가 맞는지 확인할 질문을 만들어 줘.',
 '보고서에서 빠뜨리기 쉬운 근거를 알려 줘.',
];

export function ChatPanel({sessionId,userId,allowed,draftReady,onBusy}:{sessionId:string;userId:string;allowed:boolean;draftReady:boolean;onBusy:(busy:boolean)=>void}){
 const [text,setText]=useState('');const [include,setInclude]=useState(false);const [busy,setBusy]=useState(false);const [live,setLive]=useState('');const [activeId,setActiveId]=useState<string|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState<'same'|'new'|null>(null);const [stopping,setStopping]=useState(false);
 const pending=useRef<ChatRequest|null>(null);const cancelled=useRef<Message|null>(null);const controller=useRef<AbortController|null>(null);const mounted=useRef(true);const end=useRef<HTMLLIElement|null>(null);
 const query=useQuery({queryKey:['messages',userId,sessionId],queryFn:({signal})=>listMessages(sessionId,signal),meta:{private:true},retry:false,refetchOnMount:'always',refetchInterval:q=>q.state.data?.items.some(m=>m.status==='STREAMING')?1500:false});
 const messages=query.data?.items??[];const running=messages.find(m=>m.status==='STREAMING');const waiting=busy||!!running;
 useEffect(()=>{onBusy(waiting);return()=>onBusy(false);},[waiting,onBusy]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{end.current?.scrollIntoView?.({block:'end'});},[messages.length,live,waiting]);
 function cancellationResult():Message|null{return cancelled.current;}
 async function send(fresh=false){
  if(waiting||query.isPending||query.isError||!allowed||!text.trim()||Array.from(text).length>4000||(include&&!draftReady))return;
  const body=!fresh&&pending.current&&pending.current.contentText===text&&pending.current.includeCurrentDraft===include?pending.current:{clientMessageKey:crypto.randomUUID(),contentText:text,includeCurrentDraft:include};pending.current=body;cancelled.current=null;
  const abort=new AbortController();controller.current=abort;setBusy(true);setLive('');setActiveId(null);setError('');setRetry(null);
  try{await sendMessage(sessionId,body,event=>{
   if(!mounted.current)return;
   if(event.type==='start')setActiveId(event.id);
   if(event.type==='delta')setLive(value=>value+event.text);
   if(event.type==='error')setError(event.message);
   if(event.type==='done'){
    pending.current=null;setRetry(event.message.status==='COMPLETED'?null:'new');
    if(event.message.status==='COMPLETED')setText('');
    else setError(event.message.status==='CANCELLED'?'응답 생성을 중지했습니다.':'응답을 완료하지 못했습니다. 새 응답을 요청할 수 있습니다.');
   }
  },abort.signal);}catch(failure){if(mounted.current){const stopped=cancellationResult();if(stopped){pending.current=null;const done=stopped.status==='COMPLETED';setError(done?'':'응답 생성을 중지했습니다.');setRetry(done?null:'new');if(done)setText('');}else{setError(failure instanceof ApiError?failure.message:'연결이 끊겼습니다. 대화를 새로 불러오거나 같은 요청을 다시 확인하세요.');setRetry('same');}}}
  finally{if(mounted.current){await query.refetch();if(mounted.current){setBusy(false);setLive('');setActiveId(null);}}}
 }
 async function stop(){const id=activeId??running?.id;if(!id)return;setStopping(true);setError('');try{const result=await cancelMessage(sessionId,id);cancelled.current=result;if(mounted.current){controller.current?.abort();await query.refetch();}}catch{if(mounted.current)setError('중지 결과를 확인하지 못했습니다. 대화를 새로 불러와 확인하세요.');}finally{if(mounted.current)setStopping(false);}}
 const composer=!allowed?<p className={styles.readonly}>제출이 끝나 이전 대화만 확인할 수 있습니다.</p>:<form onSubmit={event=>{event.preventDefault();void send();}}>
  {query.isSuccess&&messages.length===0&&!waiting&&<div className={styles.quickPrompts} aria-label="질문 예시"><span>이렇게 시작해 보세요</span>{quickPrompts.map(prompt=><button key={prompt} type="button" onClick={()=>setText(prompt)}>{prompt}</button>)}</div>}
  <label className={styles.srOnly} htmlFor="chat-input">AI에게 질문하기</label>
  <div className={styles.inputRow}><textarea id="chat-input" value={text} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} disabled={waiting} placeholder="AI 코치에게 질문하세요. Shift+Enter로 줄바꿈"/><button type="submit" disabled={waiting||query.isPending||query.isError||!text.trim()||Array.from(text).length>4000||(include&&!draftReady)}>{retry==='same'?'같은 요청 다시 확인':retry?'새 응답 요청':'질문 보내기'}</button></div>
  <div className={styles.composerMeta}><span>{Array.from(text).length.toLocaleString()} / 4,000자</span>{waiting&&<button type="button" className={styles.stop} onClick={()=>void stop()} disabled={stopping||!(activeId??running?.id)}>응답 생성 중지</button>}</div>
  <details className={styles.context}><summary>AI에게 전달할 정보</summary><label className={styles.option}><input type="checkbox" checked={include} onChange={event=>setInclude(event.target.checked)} disabled={waiting}/>저장된 내 보고서 초안도 AI에게 전달</label><p>공개 자료와 완료된 대화는 항상 전달됩니다. AI 답변은 보고서에 자동으로 반영되지 않습니다.</p>{include&&!draftReady&&<p role="alert">보고서 저장이 끝난 뒤 초안을 포함할 수 있습니다.</p>}</details>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
 </form>;
 return <AiConversationPanel ariaLabel="AI와 분석하기" title="보고서 분석 대화" description="AI의 제안을 참고하되, 원자료와 대조한 뒤 내 보고서에 직접 작성하세요." toolbar={<button type="button" onClick={()=>void query.refetch()} disabled={query.isFetching}>대화 새로 불러오기</button>} composer={composer}>
  {query.isPending&&<AiMessage role="assistant" label="AI 코치" status="대화를 불러오는 중…"><MessageContent text="저장된 대화를 확인하고 있어요."/></AiMessage>}
  {query.isError&&<AiMessage role="assistant" label="AI 코치" status="불러오기 실패"><MessageContent text="저장된 대화를 불러오지 못했습니다. 위 버튼으로 다시 시도해 주세요."/></AiMessage>}
  {query.isSuccess&&messages.length===0&&!busy&&<AiMessage role="assistant" label="AI 코치"><MessageContent text="어떤 판단이 필요한지 알려 주세요. 자료에서 확인된 사실과 아직 모르는 점을 함께 나눠 볼게요."/></AiMessage>}
  {messages.map(message=><AiMessage key={message.id} role={message.role==='USER'?'user':'assistant'} label={message.role==='USER'?'나':'AI 코치'} status={message.status==='FAILED'?'응답 실패':message.status==='CANCELLED'?'생성 중지':message.status==='STREAMING'?'응답 생성 중…':undefined}><MessageContent text={message.contentText||'응답을 기다리는 중…'}/></AiMessage>)}
  {busy&&<AiMessage role="assistant" label="AI 코치" status="응답 생성 중…"><MessageContent text={live||'자료와 대화를 살펴보고 있어요.'}/></AiMessage>}
  <li ref={end} aria-hidden="true" className={styles.end}/>
 </AiConversationPanel>;
}
