 'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ApiError} from '@/shared/api/client';
import {cancelMessage,listMessages,sendMessage,type ChatRequest,type Message} from './api';
import styles from './chat.module.css';
export function ChatPanel({sessionId,userId,allowed,draftReady,onBusy}:{sessionId:string;userId:string;allowed:boolean;draftReady:boolean;onBusy:(busy:boolean)=>void}){
 const [text,setText]=useState('');const [include,setInclude]=useState(false);const [busy,setBusy]=useState(false);const [live,setLive]=useState('');const [activeId,setActiveId]=useState<string|null>(null);const [error,setError]=useState('');const [retry,setRetry]=useState<'same'|'new'|null>(null);const [stopping,setStopping]=useState(false);
 const pending=useRef<ChatRequest|null>(null);const cancelled=useRef<Message|null>(null);const controller=useRef<AbortController|null>(null);const mounted=useRef(true);
 const query=useQuery({queryKey:['messages',userId,sessionId],queryFn:({signal})=>listMessages(sessionId,signal),meta:{private:true},retry:false,refetchOnMount:'always',refetchInterval:q=>q.state.data?.items.some(m=>m.status==='STREAMING')?1500:false});
 const running=query.data?.items.find(m=>m.status==='STREAMING');const waiting=busy||!!running;
 useEffect(()=>{onBusy(waiting);return()=>onBusy(false);},[waiting,onBusy]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 function cancellationResult():Message|null{return cancelled.current;}
 async function send(fresh=false){
  if(waiting||!allowed||!text.trim()||Array.from(text).length>4000||(include&&!draftReady))return;
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
 return <section className={styles.panel} aria-label="AI와 분석하기"><h2>AI와 분석하기</h2><p>자료를 함께 읽고 보고서에 담을 근거를 정리해 보세요. AI의 답변은 틀릴 수 있으니 원자료를 확인하세요.</p>
 {query.isPending?<p role="status">대화를 불러오는 중…</p>:query.isError?<p role="alert">저장된 대화를 불러오지 못했습니다.</p>:<ol className={styles.messages}>{query.data.items.map(m=><li key={m.id}><strong>{m.role==='USER'?'나':'AI'}</strong><p>{m.contentText||'응답을 기다리는 중…'}</p>{m.status!=='COMPLETED'&&<span>{m.status==='FAILED'?'응답 실패':m.status==='CANCELLED'?'생성 중지':'응답 생성 중…'}</span>}</li>)}</ol>}
 {busy&&<div aria-label="생성 중인 응답"><p role="status">AI가 응답하고 있습니다…</p><p className={styles.live}>{live}</p></div>}
 <button type="button" onClick={()=>void query.refetch()} disabled={query.isFetching}>대화 새로 불러오기</button>
 {error&&<p role="alert">{error}</p>}
 {!allowed?<p>현재 단계에서는 이전 대화만 확인할 수 있습니다.</p>:<form onSubmit={event=>{event.preventDefault();void send();}}><label htmlFor="chat-input">AI에게 질문하기</label><textarea id="chat-input" value={text} onChange={event=>setText(event.target.value)} disabled={waiting} placeholder="이 자료에서 확인된 사실과 아직 모르는 점을 구분해 줘."/><p>{Array.from(text).length} / 4,000자</p><label className={styles.option}><input type="checkbox" checked={include} onChange={event=>setInclude(event.target.checked)} disabled={waiting}/>저장된 내 보고서 초안도 AI에게 전달</label><p>현재 공개 자료와 완료된 대화가 전달됩니다. 답변은 내 보고서에 자동 반영되지 않습니다.</p>{include&&!draftReady&&<p>보고서 저장이 완료된 뒤 초안을 포함해 질문할 수 있습니다.</p>}<button type="submit" disabled={waiting||query.isPending||query.isError||!text.trim()||Array.from(text).length>4000||(include&&!draftReady)}>{retry==='same'?'같은 요청 다시 확인':retry?'새 응답 요청':'질문 보내기'}</button></form>}
 {waiting&&<button type="button" onClick={()=>void stop()} disabled={stopping||!(activeId??running?.id)}>응답 생성 중지</button>}
 </section>;
}
