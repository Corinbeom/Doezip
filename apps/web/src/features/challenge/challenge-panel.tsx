'use client';
import { useEffect,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { getWorkspace } from '@/features/workspace/api';
import { getChallenge,startChallenge } from './api';
import styles from './challenge.module.css';

function ChallengeReader({runId,userId}:{runId:string;userId:string}){
 const query=useQuery({queryKey:['challenge',userId,runId],queryFn:({signal})=>getChallenge(runId,signal),meta:{private:true},refetchOnMount:'always'});
 if(query.isPending)return <p role="status">검산 초안을 불러오는 중…</p>;
 if(query.isError)return <><p role="alert">검산 초안을 불러오지 못했습니다.</p><button disabled={query.isFetching} onClick={()=>void query.refetch()}>초안 다시 불러오기</button></>;
 return <><h3>{query.data.title}</h3><p className={styles.instructions}>{query.data.instructionsMarkdown}</p>
 <p>사용자 보고서와 별도로 제공된 검토용 초안입니다. 문장의 내용과 근거를 원자료에 대조해 보세요.</p>
 <ol className={styles.statements}>{query.data.statements.map(statement=><li key={statement.id}><span>{statement.statementKey}</span><p>{statement.text}</p></li>)}</ol>
 <p className={styles.note}>현재는 초안 열람까지 가능합니다. 문장별 판단·근거 선택·검산 제출은 준비 중입니다.</p></>;
}
export function ChallengePanel({sessionId,userId}:{sessionId:string;userId:string}){
 const client=useQueryClient();
 const key=['challenge-workspace',userId,sessionId];
 const workspace=useQuery({queryKey:key,queryFn:({signal})=>getWorkspace(sessionId,signal),meta:{private:true},refetchOnMount:'always'});
 const [acknowledged,setAcknowledged]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(false);
 const request=useRef<AbortController|null>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 const start=async()=>{
  if(!acknowledged||request.current||!workspace.data?.session.allowedActions.includes('START_CHALLENGE'))return;
  const controller=new AbortController();request.current=controller;setBusy(true);setError(false);
  try{
   const run=await startChallenge(sessionId,controller.signal);if(!alive.current)return;
   client.setQueryData(['challenge',userId,run.id],run);
   client.setQueryData(key,{...workspace.data,challengeRunId:run.id});
  }catch{if(alive.current)setError(true);}
  finally{request.current=null;if(alive.current)setBusy(false);}
 };
 return <section className={styles.panel} aria-labelledby="challenge-heading"><h2 id="challenge-heading">자료로 검산하기</h2>
 {workspace.isPending?<p role="status">검산 상태를 확인하는 중…</p>:workspace.isError?<><p role="alert">검산 상태를 불러오지 못했습니다.</p><button disabled={workspace.isFetching} onClick={()=>void workspace.refetch()}>검산 상태 다시 확인</button></>:
 workspace.data.challengeRunId?<ChallengeReader key={workspace.data.challengeRunId} runId={workspace.data.challengeRunId} userId={userId}/>:
 workspace.data.session.allowedActions.includes('START_CHALLENGE')?<>
  <h3>시작 전 안내</h3><p>별도로 제공하는 훈련용 초안에는 사실과 다른 내용이나 근거가 부족한 표현이 포함될 수 있습니다. 모든 문장을 원자료와 대조해 확인해 주세요.</p>
  <p>내가 제출한 보고서는 변경되지 않습니다. 실제 AI가 지금 생성한 답변이 아닌, 준비된 검토용 초안입니다.</p>
  <label className={styles.acknowledgement}><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event=>setAcknowledged(event.target.checked)}/>검산 안내를 확인했습니다.</label>
  <button disabled={!acknowledged||busy} onClick={()=>void start()}>{busy?'검산 시작 중…':error?'검산 시작 재시도':'검산 시작하기'}</button>
  {error&&<><p role="alert">검산 시작 결과를 확인하지 못했습니다. 같은 세션에서 재시도하거나 상태를 다시 확인해 주세요.</p><button disabled={busy||workspace.isFetching} onClick={()=>void workspace.refetch()}>검산 상태 다시 확인</button></>}
 </>:<p>이 과제의 검산 초안은 아직 준비되지 않았거나, 현재 단계에서 시작할 수 없습니다.</p>}
 </section>;
}
