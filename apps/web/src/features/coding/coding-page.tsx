'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/shared/auth/auth-provider';
import {LearningShell} from '@/shared/ui/learning-shell';
import {ApiError} from '@/shared/api/client';
import {getWorkspace,listWorkspaces,mutate,type Workspace,type Turn} from './api';
import {execute} from './execute';
import {formatTestResultDetail} from './test-result-copy';
import styles from './coding.module.css';
import {WorkPanels} from '@/shared/ui/work-panels';
import {CodingAssistant} from './coding-assistant';
function message(e:unknown){
 const messages:Record<string,string>={CODING_VERSION_CONFLICT:'다른 창에서 저장한 변경이 있습니다. 입력은 유지됩니다. 서버 저장본을 확인하세요.',CODING_AI_NOT_CONFIGURED:'AI 연결이 설정되지 않았습니다. 직접 편집과 테스트는 사용할 수 있습니다.',CODING_AI_FAILED:'AI 응답을 받지 못했습니다. 요청 상태를 확인한 뒤 다시 시도하세요.',CODING_AI_RUNNING:'AI가 응답 중입니다. 완료 후 다시 시도하세요.',CODING_TEST_REQUIRED:'현재 코드를 저장하고 테스트한 뒤 제출하세요.',CODING_AI_LIMIT:'오늘 또는 이 과제의 AI 요청 한도에 도달했습니다.',CODING_SUBMITTED:'이미 제출한 작업입니다. 제출본을 다시 확인하세요.'};
 return e instanceof ApiError?(messages[e.code]??e.message):e instanceof Error?e.message:'요청 처리에 실패했습니다.';
}
function Task(){return <section className={`${styles.panel} ${styles.task}`}><p className={styles.note}>구현 과제 · JavaScript · 학습용 첫 과제</p><h1>중복으로 추가되는 항목을 고쳐 주세요</h1><p>목록 기능을 맡은 개발자입니다. 같은 항목을 두 번 추가하면 중복되고, 원래 배열도 변경되는 문제가 있습니다. AI와 함께 원인을 찾고 <code>solution.js</code>를 수정하세요.</p><ul><li><code>addItem(items, item)</code>은 항목 배열을 반환해야 합니다.</li><li>같은 id가 있으면 기존 항목과 순서를 유지합니다.</li><li>새로운 id만 뒤에 추가하고, 입력 배열과 기존 항목은 변경하지 않습니다.</li><li>입력은 id와 title이 문자열인 유효한 항목입니다.</li></ul><p className={styles.note}>먼저 시작 코드를 테스트해 실패를 확인하세요. 수정 → 테스트 → 실패 원인 질문을 반복하고, 검증한 내용과 남은 한계를 설명해 제출합니다. 단일 함수만 지원하며 DOM·네트워크·패키지는 사용할 수 없습니다.</p></section>;}
export function CodingPage({id}:{id?:string}){
 const auth=useAuth();return <LearningShell><div className={styles.page}><Task/>{auth.status==='loading'?<p>로그인 확인 중…</p>:auth.status!=='connected'||!auth.user?<p><Link href={`/login?returnTo=${encodeURIComponent(id?`/coding/${id}`:'/coding')}`}>로그인하고 시작하기</Link></p>:id?<LoadWorkspace key={`${auth.user.id}:${id}`} id={id} userId={auth.user.id}/>:<Lobby key={auth.user.id} userId={auth.user.id}/>}</div></LearningShell>;
}
function Lobby({userId}:{userId:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const list=useQuery({queryKey:['coding-list',userId],queryFn:({signal})=>listWorkspaces(signal),meta:{private:true},retry:false});
 async function start(){setBusy(true);setError('');const c=new AbortController();controller.current=c;try{const w=await mutate('','POST',{},c.signal);if(!c.signal.aborted)router.push(`/coding/${w.id}`);}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setBusy(false);}}
 return <section className={styles.panel}><div className={styles.buttons}><button disabled={busy} onClick={()=>void start()}>{busy?'준비 중…':'새 구현 과제 시작'}</button></div>{error&&<p role="alert" className={styles.error}>{error}</p>}<h2>내 작업 이어하기</h2>{list.isPending?<p>불러오는 중…</p>:list.isError?<button onClick={()=>void list.refetch()}>목록 다시 불러오기</button>:list.data.length===0?<p>아직 시작한 작업이 없습니다.</p>:<ul>{list.data.map((id,i)=><li key={id}><Link href={`/coding/${id}`}>작업 {list.data.length-i} 열기</Link></li>)}</ul>}</section>;
}
export function LoadWorkspace({id,userId,flow=false,onReady}:{id:string;userId:string;flow?:boolean;onReady?:(ready:boolean,version:number,value:string)=>void}){
 const query=useQuery({queryKey:['coding',userId,id],queryFn:({signal})=>getWorkspace(id,signal),meta:{private:true},retry:false});
 return query.isPending?<p>코드를 불러오는 중…</p>:query.isError?<div role="alert"><p>{message(query.error)}</p><button onClick={()=>void query.refetch()}>다시 불러오기</button></div>:<Editor initial={query.data} userId={userId} flow={flow} onReady={onReady}/>;
}
function Editor({initial,userId,flow=false,onReady}:{initial:Workspace;userId:string;flow?:boolean;onReady?:(ready:boolean,version:number,value:string)=>void}){
 const cache=useQueryClient();const [saved,setSaved]=useState(initial);const [code,setCode]=useState(initial.code);const [undo,setUndo]=useState<string|null>(null);
 const [instruction,setInstruction]=useState('');const [explanation,setExplanation]=useState(initial.explanation??'');const [busy,setBusy]=useState('');const [error,setError]=useState('');const [expanded,setExpanded]=useState(false);
 const active=useRef<AbortController|null>(null);const retryAsk=useRef<{requestKey:string;expectedVersion:number;instruction:string}|null>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 const query=useQuery({queryKey:['coding',userId,initial.id],queryFn:({signal})=>getWorkspace(initial.id,signal),initialData:initial,meta:{private:true},refetchInterval:q=>q.state.data?.turns.some(t=>t.status==='RUNNING')?1500:false});
 const view=query.data;const dirty=code!==saved.code;const locked=!!view.submittedAt;const waiting=view.turns.some(t=>t.status==='RUNNING');
 useEffect(()=>{if(!expanded)return;const previous=document.body.style.overflow;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);};document.body.style.overflow='hidden';window.addEventListener('keydown',close);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close);};},[expanded]);
 useEffect(()=>{onReady?.(!dirty&&!busy&&!waiting&&!!view.lastRun&&view.lastRun.version===saved.version,saved.version,saved.code);},[dirty,busy,waiting,view.lastRun,saved.version,saved.code,onReady]);
 function update(w:Workspace){setSaved(w);cache.setQueryData(['coding',userId,w.id],w);}
 async function work(label:string,fn:(signal:AbortSignal)=>Promise<Workspace>){
  if(busy)return;const c=new AbortController();active.current=c;setBusy(label);setError('');
  try{const w=await fn(c.signal);if(!c.signal.aborted)update(w);}catch(e){if(!c.signal.aborted){setError(message(e));void query.refetch();}}
  finally{if(!c.signal.aborted)setBusy('');}
 }
 async function save(signal:AbortSignal){if(!dirty)return saved;return mutate(`/${initial.id}`,'PUT',{code,expectedVersion:saved.version},signal);}
 function apply(turn:Turn){if(dirty||saved.version!==turn.baseVersion){setError('수정안 생성 후 코드가 변경되었습니다. 현재 코드를 저장한 뒤 새 수정안을 요청하세요.');return;}setUndo(code);setCode(turn.proposedCode!);setError('');}
 async function run(signal:AbortSignal){const w=await save(signal);if(!signal.aborted)update(w);const results=await execute(w.code,w.taskVersion,signal);return mutate(`/${w.id}/runs`,'POST',{version:w.version,suite:w.taskVersion,results},signal);}
 async function ask(signal:AbortSignal){
  const w=await save(signal);if(!signal.aborted)update(w);
  const previous=retryAsk.current;const body=previous&&previous.expectedVersion===w.version&&previous.instruction===instruction?previous:{requestKey:crypto.randomUUID(),expectedVersion:w.version,instruction};retryAsk.current=body;
  const result=await mutate(`/${w.id}/turns`,'POST',body,signal);if(!signal.aborted){retryAsk.current=null;setInstruction('');}return result;
 }
 const artifact=<section className={styles.panel}><div className={`${styles.codeWorkspace} ${expanded?styles.codeWorkspaceExpanded:''}`}><div className={styles.codeHeading}><h2>코드 작성과 검증</h2><button type="button" className={styles.expandButton} aria-pressed={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'편집기 닫기':'편집기 크게 보기'}</button></div><label htmlFor="code">solution.js</label><textarea id="code" className={styles.code} spellCheck={false} maxLength={20000} value={code} disabled={locked||!!busy||waiting} onChange={e=>setCode(e.target.value)}/>
 <div className={styles.buttons}><button disabled={locked||!!busy||waiting||!dirty} onClick={()=>void work('저장 중',save)}>코드 저장</button><button disabled={locked||!!busy||waiting} onClick={()=>void work('테스트 실행 중',run)}>저장하고 테스트</button><button disabled={locked||!!busy||waiting||undo===null} onClick={()=>{if(undo!==null){const previous=code;setCode(undo);setUndo(previous);}}}>AI 변경 되돌리기</button></div></div>
 <h2>공개 테스트 결과</h2><p className={styles.note}>브라우저에서 실제 코드를 실행한 연습 결과입니다. 서버에서 검증한 채점 결과는 아닙니다.</p>{dirty&&view.lastRun&&<p>코드가 변경되었습니다. 다시 테스트하세요.</p>}{view.lastRun?view.lastRun.results.map((r,i)=><div key={i} className={styles.result}><strong>{r.passed?'통과':'실패'} · {r.name}</strong><p>{formatTestResultDetail(r.detail)}</p></div>):<p>아직 실행하지 않았습니다.</p>}
 {!flow&&<><label htmlFor="reason">구현과 검증 설명</label><textarea id="reason" value={explanation} maxLength={4000} disabled={locked||!!busy||waiting} onChange={e=>setExplanation(e.target.value)} placeholder="원인, 수정한 이유, 확인한 테스트와 남은 한계를 설명하세요."/>
 {!locked&&<div className={styles.buttons}><button disabled={!!busy||waiting||dirty||!view.lastRun||!explanation.trim()} onClick={()=>{if(window.confirm('현재 코드와 테스트 기록, 설명을 제출할까요? 제출 후에는 수정할 수 없습니다.'))void work('제출 중',signal=>mutate(`/${initial.id}/submit`,'POST',{expectedVersion:saved.version,explanation},signal));}}>최종 코드 제출</button></div>}
 {locked&&<section><h2>제출 확인</h2><p>코드, 대화, 마지막 테스트 기록과 설명이 저장되었습니다.</p><p>제출된 실행 기록: {view.lastRun?.results.filter(r=>r.passed).length} / {view.lastRun?.results.length}개 통과</p><p className={styles.note}>구현 과제의 AI 역량 평가는 아직 연결되지 않았습니다. 테스트 통과 수를 역량 점수로 사용하지 않습니다.</p></section>}
 </>}
 </section>;
 const assistant=<CodingAssistant turns={view.turns} instruction={instruction} locked={locked} waiting={waiting} busy={!!busy} onInstruction={setInstruction} onAsk={()=>void work('AI 수정안 생성 중',ask)} onApply={apply} canApply={turn=>!locked&&!busy&&!waiting&&!dirty&&saved.version===turn.baseVersion}/>;
 return <>{!flow&&<p><Link href="/coding">내 구현 과제 목록</Link></p>}<p role="status">{locked?'제출 완료 · 읽기 전용':busy||waiting?'처리 중…':dirty?'저장하지 않은 변경이 있습니다.':'저장됨'}</p>{error&&<div role="alert" className={styles.error}>{error}<div className={styles.buttons}><button disabled={!!busy} onClick={()=>{if(window.confirm('저장하지 않은 변경을 버리고 서버 저장본을 불러올까요?'))window.location.reload();}}>서버 저장본 불러오기</button></div></div>}
{flow?<WorkPanels artifact={artifact} assistant={assistant}/>:<div className={styles.grid}>{artifact}{assistant}</div>}</>;
}
