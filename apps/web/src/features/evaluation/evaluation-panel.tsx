 'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {getWorkspace,getDocuments} from '@/features/workspace/api';
import {getEvaluation,requestEvaluation,retryEvaluation} from './api';
function Status({id,userId}:{id:string;userId:string}){
 const client=useQueryClient();const key=['evaluation',userId,id];const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);const pending=useRef<AbortController|null>(null);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 const query=useQuery({queryKey:key,queryFn:({signal})=>getEvaluation(id,signal),meta:{private:true},refetchOnMount:'always',refetchInterval:q=>q.state.data&&['QUEUED','RUNNING'].includes(q.state.data.status)?q.state.data.pollAfterMs:false});
 const retry=async()=>{if(pending.current)return;const c=new AbortController();pending.current=c;setBusy(true);setFailed(false);try{const result=await retryEvaluation(id,c.signal);if(alive.current)client.setQueryData(key,result);}catch{if(alive.current)setFailed(true);}finally{pending.current=null;if(alive.current)setBusy(false);}};
 if(!query.data)return <><p role={query.isError?'alert':'status'}>{query.isError?'평가 상태를 불러오지 못했습니다.':'평가 상태를 확인하는 중…'}</p>{query.isError&&<button onClick={()=>void query.refetch()}>평가 상태 다시 확인</button>}</>;
 const e=query.data;
 return <><p role="status">{e.status==='QUEUED'?'평가 처리 대기 중':e.status==='RUNNING'?'평가 요청 처리 중':e.status==='FAILED'?'평가 처리 실패':'평가 처리 완료'}</p>
 {e.status==='FAILED'&&<p>{e.errorCode==='EVALUATOR_NOT_CONFIGURED'?'평가기 연결이 아직 준비되지 않았습니다. 보고서와 검토는 보존되며 점수나 평가 결과는 생성되지 않았습니다.':e.errorCode==='INVALID_EVALUATION_INPUT'?'평가 입력을 확인하지 못했습니다. 제출 내용은 보존됩니다.':'평가 처리 중 일시적인 문제가 발생했습니다.'}</p>}
 {e.status==='SUCCEEDED'&&<p>결과 화면 연결은 후속 작업입니다.</p>}
 {e.status==='FAILED'&&e.retryable&&<button disabled={busy} onClick={()=>void retry()}>평가 다시 시도</button>}
 {(failed||query.isError)&&<p role="alert">요청 결과를 확인하지 못했습니다. 상태를 다시 확인하세요.</p>}
 <button disabled={query.isFetching||busy} onClick={()=>void query.refetch()}>평가 상태 다시 확인</button></>;
}
export function EvaluationPanel({sessionId,userId}:{sessionId:string;userId:string}){
 const client=useQueryClient();const key=['evaluation-workspace',userId,sessionId];
 const workspace=useQuery({queryKey:key,queryFn:({signal})=>getWorkspace(sessionId,signal),meta:{private:true},refetchOnMount:'always'});
 const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);const requestKey=useRef<string|null>(null);const pending=useRef<AbortController|null>(null);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 const start=async()=>{if(pending.current||!workspace.data)return;const c=new AbortController();pending.current=c;setBusy(true);setFailed(false);requestKey.current??=crypto.randomUUID();
  try{const documents=await getDocuments(sessionId,c.signal);const initial=documents.items.find(d=>d.checkpoint==='INITIAL');if(!initial)throw new Error('Missing submission');const evaluation=await requestEvaluation(sessionId,initial.id,requestKey.current,c.signal);if(!alive.current)return;client.setQueryData(['evaluation',userId,evaluation.id],evaluation);client.setQueryData(key,{...workspace.data,activeEvaluationId:evaluation.id});}
  catch{if(alive.current)setFailed(true);}finally{pending.current=null;if(alive.current)setBusy(false);}
 };
 return <section aria-labelledby="evaluation-heading"><h3 id="evaluation-heading">제출 내용 평가</h3><p>현재는 평가 요청과 상태 확인을 제공하며, 실제 평가기·AI·결과 리포트는 연결 전입니다.</p>
 {!workspace.data?<><p role={workspace.isError?'alert':'status'}>{workspace.isError?'평가 요청 상태를 불러오지 못했습니다.':'평가 요청 상태 확인 중…'}</p><button onClick={()=>void workspace.refetch()}>요청 상태 다시 확인</button></>:workspace.data.activeEvaluationId?<Status key={workspace.data.activeEvaluationId} id={workspace.data.activeEvaluationId} userId={userId}/>:workspace.data.session.allowedActions.includes('REQUEST_INITIAL_EVALUATION')?<><button disabled={busy} onClick={()=>void start()}>{busy?'평가 요청 중…':failed?'같은 평가 요청 재전송':'평가 요청하기'}</button>{failed&&<><p role="alert">평가 요청 결과를 확인하지 못했습니다. 같은 요청으로 재전송하거나 상태를 확인하세요.</p><button disabled={busy} onClick={()=>void workspace.refetch()}>요청 상태 다시 확인</button></>}</>:<p>검산 제출 후 평가를 요청할 수 있습니다.</p>}
 </section>;
}
