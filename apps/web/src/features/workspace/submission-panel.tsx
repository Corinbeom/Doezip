'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { getDocuments, submitInitial, type Draft, type DocumentVersion } from './api';
import styles from './workspace.module.css';
import { ChallengePanel } from '@/features/challenge/challenge-panel';

export function SubmissionPanel({sessionId,userId,draft,ready,allowed,onBusy,onSealed,onReload}: {
  sessionId:string; userId:string; draft:Draft; ready:boolean; allowed:boolean;
  onBusy:(busy:boolean)=>void; onSealed:()=>void; onReload:()=>Promise<void>;
}) {
  const client=useQueryClient();
  const key=['documents',userId,sessionId];
  const query=useQuery({queryKey:key,queryFn:({signal})=>getDocuments(sessionId,signal),meta:{private:true},refetchOnMount:'always'});
  const [result,setResult]=useState<DocumentVersion|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const active=useRef<AbortController|null>(null);
  const alive=useRef(true);
  const submitted=result??query.data?.items.find(item=>item.checkpoint==='INITIAL');
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort();};},[]);
  useEffect(()=>{if(submitted)onSealed();},[submitted,onSealed]);
  const submit=async()=>{
    if(active.current||!ready||!allowed||submitted)return;
    if(!window.confirm('현재 저장된 보고서를 최초 제출할까요? 제출본은 수정할 수 없으며, 제출 후 초안 편집도 잠깁니다.'))return;
    const controller=new AbortController();active.current=controller;
    setBusy(true);onBusy(true);setError('');
    try {
      const document=await submitInitial(sessionId,draft,controller.signal);
      if(!alive.current)return;
      setResult(document);onSealed();
      client.setQueryData(key,{items:[document]});
    } catch(cause) {
      if(!alive.current)return;
      setError(cause instanceof ApiError&&cause.status===409
        ?'저장본 또는 제출 상태가 변경되었습니다. 현재 내용은 유지됩니다. 제출본을 확인한 뒤 저장 상태를 확인해 주세요.'
        :cause instanceof ApiError&&cause.code==='EMPTY_DOCUMENT'?'내용을 작성한 뒤 제출해 주세요.'
        :'제출 결과를 확인하지 못했습니다. 제출본을 확인하거나 같은 저장본으로 재시도해 주세요.');
    } finally {
      active.current=null;
      if(alive.current){setBusy(false);onBusy(false);}
    }
  };
  return <section className={styles.submission} aria-labelledby="submission-heading">
    <h2 id="submission-heading">최초 제출</h2>
    {submitted?<>
      <p role="status">최초 제출본이 보관되었습니다.</p>
      <p>이 제출본은 수정할 수 없습니다. 검산 안내를 확인하고 별도의 초안을 읽을 수 있습니다. 평가·학습 완료 상태는 아닙니다.</p>
      <dl className={styles.metadata}><dt>제출 버전</dt><dd>{submitted.versionNo}</dd><dt>제출 시각</dt><dd>{new Date(submitted.sealedAt).toLocaleString('ko-KR')}</dd></dl>
      <details open><summary>제출본 내용 보기</summary><pre className={styles.document}>{submitted.contentMarkdown}</pre></details><ChallengePanel sessionId={sessionId} userId={userId}/>
    </>:<>
      <p>저장된 보고서를 수정할 수 없는 제출본으로 보관합니다. 자동 저장이 끝난 뒤 제출하세요.</p>
      {query.isPending?<p role="status">제출 이력을 확인하는 중…</p>:query.isError?<p role="alert">제출 이력을 불러오지 못했습니다.</p>:<p>아직 제출한 보고서가 없습니다.</p>}
      {allowed&&<button disabled={!ready||busy||query.isPending||query.isError||!draft.markdown.trim()} onClick={()=>void submit()}>{busy?'제출 중…':error?'최초 제출 재시도':'최초 제출하기'}</button>}
      {error&&<><p role="alert">{error}</p><button disabled={busy} onClick={()=>void onReload()}>서버 저장본 불러오기</button></>}
    </>}
    {(error||query.isError)&&<button disabled={busy||query.isFetching} onClick={()=>void query.refetch()}>제출본 확인</button>}
  </section>;
}
