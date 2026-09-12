 'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {getWorkspace,getMaterial} from '@/features/workspace/api';
import {getChallenge,saveReviews,submitChallenge,type ChallengeRun,type ReviewInput} from './api';
import styles from './challenge.module.css';
import {EvaluationPanel} from '@/features/evaluation/evaluation-panel';
const toInput=(run:ChallengeRun):ReviewInput[]=>run.reviews.map(r=>({statementId:r.statementId,decision:r.decision,reasonText:r.reasonText,replacementText:r.replacementText,evidence:r.evidence.map(e=>({materialId:e.materialId,lineStart:e.lineStart,lineEnd:e.lineEnd,relation:e.relation,...(e.userNote===null?{}:{userNote:e.userNote})}))}));
function EvidencePicker({sessionId,userId,onAdd}:{sessionId:string;userId:string;onAdd:(e:ReviewInput['evidence'][number])=>void}){
 const workspace=useQuery({queryKey:['evidence-workspace',userId,sessionId],queryFn:({signal})=>getWorkspace(sessionId,signal),meta:{private:true}});
 const [materialId,setMaterialId]=useState('');const [start,setStart]=useState(1);const [end,setEnd]=useState(1);
 const [relation,setRelation]=useState<'SUPPORTS'|'CONTRADICTS'|'CONTEXT'>('SUPPORTS');
 const material=useQuery({queryKey:['evidence-material',userId,sessionId,materialId],queryFn:({signal})=>getMaterial(sessionId,materialId,signal),enabled:!!materialId,meta:{private:true}});
 const valid=!!material.data&&Number.isInteger(start)&&Number.isInteger(end)&&start>=1&&end>=start&&end<=material.data.lines.length;
 return <div className={styles.evidence}>
 {workspace.isError?<><p role="alert">자료 목록을 불러오지 못했습니다.</p><button onClick={()=>void workspace.refetch()}>자료 목록 재시도</button></>:workspace.isPending?<p role="status">자료 목록을 불러오는 중…</p>:<label>인용할 자료<select value={materialId} onChange={e=>{setMaterialId(e.target.value);setStart(1);setEnd(1);}}><option value="">자료 선택</option>{workspace.data.materials.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>}
 {materialId&&(material.isError?<><p role="alert">원자료를 불러오지 못했습니다.</p><button onClick={()=>void material.refetch()}>원자료 재시도</button></>:material.isPending?<p role="status">원자료를 불러오는 중…</p>:<>
 <ol className={styles.source}>{material.data.lines.map(l=><li key={l.number} value={l.number}>{l.text||' '}</li>)}</ol>
 <label>시작 줄<input type="number" min="1" max={material.data.lines.length} value={start} onChange={e=>setStart(Number(e.target.value))}/></label>
 <label>끝 줄<input type="number" min={start} max={material.data.lines.length} value={end} onChange={e=>setEnd(Number(e.target.value))}/></label>
 <label>근거 관계<select value={relation} onChange={e=>setRelation(e.target.value as typeof relation)}><option value="SUPPORTS">뒷받침</option><option value="CONTRADICTS">반박</option><option value="CONTEXT">맥락</option></select></label>
 {valid?<blockquote>{material.data.lines.slice(start-1,end).map(l=>l.text).join('\n')}</blockquote>:<p>원자료 안의 올바른 줄 범위를 선택하세요.</p>}
 <button disabled={!valid} onClick={()=>{if(valid)onAdd({materialId,lineStart:start,lineEnd:end,relation});}}>선택한 근거 추가</button>
 </>)}
 </div>;
}
export function ReviewEditor({initial,userId}:{initial:ChallengeRun;userId:string}){
 const client=useQueryClient();const [run,setRun]=useState(initial);const [buffer,setBuffer]=useState(()=>toInput(initial));
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState(false);
 const pending=useRef<AbortController|null>(null);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[]);
 const dirty=JSON.stringify(buffer)!==JSON.stringify(toInput(run));const locked=run.status==='SUBMITTED';
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const update=(id:string,patch:Partial<ReviewInput>)=>setBuffer(old=>old.map(r=>r.statementId===id?{...r,...patch}:r));
 const perform=async(kind:'save'|'submit'|'reload')=>{
  if(pending.current)return;
  if(kind==='submit'&&(dirty||!window.confirm(`미검토 문장 ${run.statements.length-buffer.length}개입니다. 제출하면 수정할 수 없습니다. 제출할까요?`)))return;
  if(kind==='reload'&&dirty&&!window.confirm('저장하지 않은 검토를 버리고 서버 내용을 불러올까요?'))return;
  const controller=new AbortController();pending.current=controller;setBusy(true);setMessage('');setError(false);
  try{
   const next=kind==='save'?await saveReviews(run.id,buffer,run.lockVersion,controller.signal):kind==='submit'?await submitChallenge(run.id,run.lockVersion,controller.signal):await getChallenge(run.id,controller.signal);
   if(!alive.current)return;setRun(next);setBuffer(toInput(next));client.setQueryData(['challenge',userId,run.id],next);
   void client.invalidateQueries({queryKey:['challenge-workspace',userId,run.sessionId]});
   setMessage(kind==='save'?'검토가 저장되었습니다.':next.status==='SUBMITTED'?'검산 제출이 완료되었습니다.':'서버 내용을 불러왔습니다.');
  }catch{if(alive.current){setError(true);setMessage('처리 결과를 확인하지 못했습니다. 입력은 유지됩니다. 입력·연결 상태를 확인해 재시도하거나 서버 내용을 불러오세요. 다른 탭에서 변경됐다면 내용을 비교해야 합니다.');}}
  finally{pending.current=null;if(alive.current)setBusy(false);}
 };
 return <div className={styles.editor}><h3>{run.title}</h3><p>{run.instructionsMarkdown}</p><p>사용자 보고서와 별도의 검토입니다. 모든 문장을 검토할 필요는 없지만 미검토와 유지 판단은 다르게 기록됩니다.</p>
 <p role="status">{locked?'검산 제출 완료 · 읽기 전용':dirty?'저장하지 않은 검토가 있습니다.':'현재 검토가 저장되어 있습니다.'} · 미검토 {run.statements.length-buffer.length}개</p>
 {locked&&<p>검토와 근거가 잠겼습니다. 평가 결과는 아직 제공되지 않습니다.</p>}
 {message&&<p role={error?'alert':'status'}>{message}</p>}
 <fieldset disabled={busy||locked} className={styles.reviewFields}><legend>문장별 검토</legend>{run.statements.map(statement=>{
  const review=buffer.find(r=>r.statementId===statement.id);const saved=run.reviews.find(r=>r.statementId===statement.id);
  return <section className={styles.review} key={statement.id} aria-label={`${statement.statementKey} 검토`}><h4>{statement.statementKey}</h4><p>{statement.text}</p>
  <label>판단<select value={review?.decision??''} onChange={e=>{const decision=e.target.value as ReviewInput['decision'];if(!decision){setBuffer(b=>b.filter(r=>r.statementId!==statement.id));return;}if(review)update(statement.id,{decision,replacementText:decision==='KEEP'?null:review.replacementText??''});else setBuffer(b=>[...b,{statementId:statement.id,decision,reasonText:'',replacementText:decision==='KEEP'?null:'',evidence:[]}]);}}><option value="">미검토</option><option value="KEEP">유지</option><option value="CORRECT">수정</option><option value="INSUFFICIENT_EVIDENCE">근거 부족</option></select></label>
  {review&&<><label>판단 이유<textarea value={review.reasonText} onChange={e=>update(statement.id,{reasonText:e.target.value})}/></label>
  {review.decision!=='KEEP'&&<label>수정 문장<textarea value={review.replacementText??''} onChange={e=>update(statement.id,{replacementText:e.target.value})}/></label>}
  <ul>{review.evidence.map((e,i)=><li key={`${e.materialId}:${e.lineStart}:${e.lineEnd}`}><p>원자료 {e.lineStart}–{e.lineEnd}줄 · {e.relation==='SUPPORTS'?'뒷받침':e.relation==='CONTRADICTS'?'반박':'맥락'}</p>{saved?.evidence.filter(v=>v.materialId===e.materialId&&v.lineStart===e.lineStart&&v.lineEnd===e.lineEnd).map(v=><blockquote key={v.id}>{v.quotedText}</blockquote>)}{!locked&&<button onClick={()=>update(statement.id,{evidence:review.evidence.filter((_,n)=>n!==i)})}>근거 삭제</button>}</li>)}</ul>
  {!locked&&review.evidence.length<6&&<EvidencePicker sessionId={run.sessionId} userId={userId} onAdd={e=>{if(!review.evidence.some(v=>v.materialId===e.materialId&&v.lineStart===e.lineStart&&v.lineEnd===e.lineEnd))update(statement.id,{evidence:[...review.evidence,e]});}}/>}
  </>}
  </section>;
 })}</fieldset>
 {!locked&&<><button disabled={busy||!dirty} onClick={()=>void perform('save')}>검토 저장</button><button disabled={busy||dirty} onClick={()=>void perform('submit')}>검산 제출</button></>}
 <button disabled={busy} onClick={()=>void perform('reload')}>서버 검토 다시 불러오기</button>
 {locked&&<EvaluationPanel sessionId={run.sessionId} userId={userId}/>}
 </div>;
}
