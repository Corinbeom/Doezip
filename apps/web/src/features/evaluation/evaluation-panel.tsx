 'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {getWorkspace,getDocuments} from '@/features/workspace/api';
import {ReportPanel} from '@/features/report/report-panel';
import {getEvaluation,requestEvaluation,retryEvaluation} from './api';
function Status({id,userId}:{id:string;userId:string}){
 const client=useQueryClient();const key=['evaluation',userId,id];const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);const pending=useRef<AbortController|null>(null);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 const query=useQuery({queryKey:key,queryFn:({signal})=>getEvaluation(id,signal),meta:{private:true},refetchOnMount:'always',refetchInterval:q=>q.state.data&&['QUEUED','RUNNING'].includes(q.state.data.status)?q.state.data.pollAfterMs:false});
 const retry=async()=>{if(pending.current)return;const c=new AbortController();pending.current=c;setBusy(true);setFailed(false);try{const result=await retryEvaluation(id,c.signal);if(alive.current)client.setQueryData(key,result);}catch{if(alive.current)setFailed(true);}finally{pending.current=null;if(alive.current)setBusy(false);}};
 if(!query.data)return <><p role={query.isError?'alert':'status'}>{query.isError?'평가 상태를 불러오지 못했습니다.':'평가 상태를 확인하는 중…'}</p>{query.isError&&<button onClick={()=>void query.refetch()}>평가 상태 다시 확인</button>}</>;
 const e=query.data;
 return <><p role="status">{e.status==='QUEUED'?'평가 처리 대기 중':e.status==='RUNNING'?'평가 요청 처리 중':e.status==='FAILED'?'평가 처리 실패':'평가 처리 완료'}</p>
 {e.status==='FAILED'&&<p>{({
 EVALUATOR_NOT_CONFIGURED:'평가기 연결이 아직 준비되지 않았습니다. 보고서와 검토는 보존되며 평가 결과는 생성되지 않았습니다.',
 INVALID_EVALUATION_INPUT:'평가 입력을 확인하지 못했습니다. 제출 내용은 보존됩니다.',
 INVALID_EVALUATION_RESULT:'AI 응답의 근거 또는 형식을 검증하지 못했습니다. 결과는 저장하지 않았습니다.',
 AI_AUTH_FAILED:'AI 연결 인증을 확인해야 합니다. 설정을 수정한 후 다시 시도해 주세요.',
 AI_RATE_LIMITED:'AI 제공자의 호출 한도에 도달했습니다. 잠시 후 이용 가능 여부를 확인해 주세요.',
 EVALUATION_DAILY_LIMIT:'오늘의 AI 평가 호출 한도에 도달했습니다. 제출 내용은 보존됩니다.',
 AI_TIMEOUT:'AI 응답 대기 시간이 초과되었습니다. 제출 내용은 보존됩니다.',
 AI_PROVIDER_UNAVAILABLE:'AI 제공자가 현재 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
 AI_REQUEST_REJECTED:'AI 모델 또는 요청 설정을 확인해야 합니다. 제출 내용은 보존됩니다.',
 AI_RESPONSE_INCOMPLETE:'AI가 완전한 평가 결과를 반환하지 않았습니다. 결과는 저장하지 않았습니다.',
 EVALUATION_INPUT_TOO_LARGE:'현재 평가기가 처리할 수 있는 입력 크기를 초과했습니다. 제출 내용은 보존됩니다.'
 } as Record<string,string>)[e.errorCode??'']??'평가 처리 중 일시적인 문제가 발생했습니다.'}</p>}
 {e.status==='SUCCEEDED'&&(e.reportId?<ReportPanel id={e.reportId} userId={userId}/>:<p role="alert">평가 결과 식별자를 확인하지 못했습니다.</p>)}
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
 return <section aria-labelledby="evaluation-heading"><h3 id="evaluation-heading">제출 내용 평가</h3><p>평가를 요청하면 제출 보고서·검토·공개 자료를 AI 평가기로 보냅니다. 근거 검증을 통과해 저장된 결과만 표시하며, AI 판단에는 오류가 있을 수 있습니다.</p>
 {!workspace.data?<><p role={workspace.isError?'alert':'status'}>{workspace.isError?'평가 요청 상태를 불러오지 못했습니다.':'평가 요청 상태 확인 중…'}</p><button onClick={()=>void workspace.refetch()}>요청 상태 다시 확인</button></>:workspace.data.activeEvaluationId?<Status key={workspace.data.activeEvaluationId} id={workspace.data.activeEvaluationId} userId={userId}/>:workspace.data.session.allowedActions.includes('REQUEST_INITIAL_EVALUATION')?<><button disabled={busy} onClick={()=>void start()}>{busy?'평가 요청 중…':failed?'같은 평가 요청 재전송':'평가 요청하기'}</button>{failed&&<><p role="alert">평가 요청 결과를 확인하지 못했습니다. 같은 요청으로 재전송하거나 상태를 확인하세요.</p><button disabled={busy} onClick={()=>void workspace.refetch()}>요청 상태 다시 확인</button></>}</>:<p>검산 제출 후 평가를 요청할 수 있습니다.</p>}
 </section>;
}
