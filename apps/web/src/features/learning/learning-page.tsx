 'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/shared/auth/auth-provider';
import {LearningShell} from '@/shared/ui/learning-shell';
import {ApiError} from '@/shared/api/client';
import {WorkspaceEditor} from '@/features/workspace/workspace-page';
import {LoadWorkspace} from '@/features/coding/coding-page';
import {getWorkspace as reportWorkspace} from '@/features/workspace/api';
import {listFlows,getFlow,changeFlow,type Flow,type Notes} from './api';
import {getLearningCatalog,type LearningTask} from '@/shared/api/learning-catalog';
import styles from '@/features/coding/coding.module.css';
import local from './learning.module.css';
import {WorkStages} from './work-stages';
import {HintPanel} from './hint-panel';
import {EvidencePicker} from './evidence-picker';
import {FeedbackReview} from './feedback-review';
import {useLearningStep} from './learning-step';
const errors:Record<string,string>={FLOW_STATE_CONFLICT:'다른 화면에서 단계나 저장본이 바뀌었습니다. 입력은 유지됩니다. 서버 저장본을 확인하세요.',FLOW_NOTES_REQUIRED:'제출 설명과 검증 기록을 작성하세요. 확인하지 못했다면 그 사실을 적어도 됩니다.',FLOW_AI_NOT_CONFIGURED:'평가 AI가 설정되지 않았습니다. 제출과 직접 설명은 저장되었습니다.',FLOW_EVALUATION_LIMIT:'이 과제의 평가 재시도 한도에 도달했습니다.',FLOW_EVALUATING:'평가 중입니다. 저장된 상태를 확인하고 있습니다.',FLOW_CONTEXT_LIMIT:'작업 기록이 현재 평가 입력 한도를 초과했습니다. 제출되지 않았으며 작성 내용은 보존됩니다.'};
function message(e:unknown){return e instanceof ApiError?errors[e.code]??e.message:'요청을 처리하지 못했습니다. 입력은 유지됩니다.';}
const workStepLabels=['과제 이해','작업','검증·제출'] as const;
function HistoryCard({flow}:{flow:Flow}){
 const step=useLearningStep(flow.stage==='WORKING'?flow.id:undefined);
 const stage=flow.stage==='WORKING'?workStepLabels[step]:flow.stage==='EXPLAIN'?'직접 설명':'피드백 확인';
 const action=flow.stage==='WORKING'?(step===0?'과제 이해부터 이어가기':step===1?'작업 이어가기':'검증·제출 이어가기'):flow.stage==='EXPLAIN'?'직접 설명 이어가기':'피드백 다시 보기';
 return <article><div><span>{flow.mode==='TRAINING'?'훈련':'모의 전형'}</span><span data-stage={flow.stage}>{stage}</span></div><h3>{flow.task.title}</h3><p>{flow.kind==='REPORT'?'보고서 작성 과제':'구현 과제'} · {flow.parentId?'재연습':'첫 수행'}</p><Link href={`/learn/${flow.id}`}>{action}<span aria-hidden="true"> →</span></Link></article>;
}
export function LearningPage({id}:{id?:string}){const auth=useAuth();return <LearningShell><div className={`${styles.page} ${local.page} ${id?local.detailPage:local.dashboardPage}`}>
 {auth.status==='loading'?<section className={local.authState}><p role="status">내 학습을 불러오는 중…</p></section>:auth.status!=='connected'||!auth.user?<section className={local.loginGate}><p>내 학습</p><h1>로그인하고 학습 기록을 이어가세요.</h1><p>진행 중인 과제와 피드백은 계정에 안전하게 보관됩니다.</p><Link href={`/login?returnTo=${encodeURIComponent(id?`/learn/${id}`:'/learn')}`}>Google로 시작하기 <span aria-hidden="true">→</span></Link><Link href="/tasks">로그인 전에 과제 둘러보기</Link></section>:id?<Detail key={`${auth.user.id}:${id}`} id={id} userId={auth.user.id}/>:<><section className={local.dashboardHero}><div><p>내 학습</p><h1>{auth.user.displayName}님, 오늘은 어떤 판단을 연습할까요?</h1><span>진행 중인 과제를 이어가거나 새로운 보고서·구현 과제를 시작할 수 있습니다.</span></div><ol aria-label="학습 과정"><li>과제 이해</li><li>AI와 작업</li><li>직접 검증</li><li>판단 설명</li><li>피드백</li></ol></section><Lobby key={auth.user.id} userId={auth.user.id}/></>}
 </div></LearningShell>;}
function Lobby({userId}:{userId:string}){
 const router=useRouter();const [mode,setMode]=useState<'TRAINING'|'SIMULATION'>('TRAINING');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const pending=useRef<{catalogId:string;version:string;mode:string;requestKey:string}|null>(null);const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 const tasks=useQuery({queryKey:['learning-catalog'],queryFn:({signal})=>getLearningCatalog(signal)});
 const list=useQuery({queryKey:['learning-list',userId],queryFn:({signal})=>listFlows(signal),meta:{private:true}});
 async function start(task:LearningTask){setBusy(true);setError('');const c=new AbortController();active.current=c;const body=pending.current?.catalogId===task.catalogId&&pending.current.version===task.version&&pending.current.mode===mode?pending.current:{catalogId:task.catalogId,version:task.version,mode,requestKey:crypto.randomUUID()};pending.current=body;try{const f=await changeFlow('',body,'POST',c.signal);if(!c.signal.aborted)router.push(`/learn/${f.id}`);}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setBusy(false);}}
 const activeFlows=list.data?.filter(flow=>flow.stage!=='FEEDBACK')??[];
 const completedFlows=list.data?.filter(flow=>flow.stage==='FEEDBACK')??[];
 const visibleActiveFlows=activeFlows.slice(0,4);
 const remainingActiveFlows=activeFlows.slice(4);
 return <>
  <section className={local.continueSection} aria-labelledby="continue-title"><div className={local.sectionTitle}><div><p>이어서 하기</p><h2 id="continue-title">진행 중인 학습</h2></div>{list.isSuccess&&<span>{activeFlows.length}개</span>}</div>
   {list.isPending?<p role="status" className={local.stateText}>학습 기록을 불러오는 중…</p>:list.isError?<div className={local.stateText}><p role="alert">학습 기록을 불러오지 못했습니다.</p><button onClick={()=>void list.refetch()}>목록 다시 불러오기</button></div>:activeFlows.length===0?<div className={local.emptyState}><p>진행 중인 과제가 없습니다.</p><span>아래에서 새 과제를 시작해 보세요.</span></div>:<><div className={local.historyList}>{visibleActiveFlows.map(flow=><HistoryCard key={flow.id} flow={flow}/>)}</div>{remainingActiveFlows.length>0&&<details className={local.moreActive}><summary>진행 중 기록 {remainingActiveFlows.length}개 더 보기</summary><div className={local.historyList}>{remainingActiveFlows.map(flow=><HistoryCard key={flow.id} flow={flow}/>)}</div></details>}</>}
  </section>

  <section className={local.startSection} aria-labelledby="start-title"><div className={local.sectionTitle}><div><p>새 과제</p><h2 id="start-title">연습 방식과 과제를 선택하세요.</h2></div></div>
   <div className={local.modeChoice}><label htmlFor="mode">연습 방식</label><select id="mode" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="TRAINING">훈련 · 단계별 안내와 힌트 제공</option><option value="SIMULATION">모의 전형 · 안내 없이 스스로 수행</option></select><p>{mode==='TRAINING'?'막히는 지점에서 힌트를 확인하며 연습합니다. 힌트 사용은 평가 점수로 계산하지 않습니다.':'힌트 없이 수행한 뒤, 제출한 기록을 바탕으로 피드백을 확인합니다.'}</p></div>
   {error&&<p role="alert" className={local.error}>{error}</p>}
   {tasks.isPending?<p role="status" className={local.stateText}>과제를 불러오는 중…</p>:tasks.isError?<div className={local.stateText}><p role="alert">과제를 불러오지 못했습니다.</p><button onClick={()=>void tasks.refetch()}>과제 다시 불러오기</button></div>:<div className={local.cards}>{tasks.data.map(t=><article className={local.taskCard} key={t.catalogId+':'+t.version}><div><span>{t.kind==='REPORT'?'REPORT':'CODING'}</span><strong>{t.kind==='REPORT'?'보고서 작성':'구현 연습'}</strong></div><h3>{t.title}</h3><p>{t.situation}</p><ul>{t.requirements.slice(0,3).map(r=><li key={r}>{r}</li>)}</ul><p className={local.deliverable}><strong>제출물</strong> {t.deliverable}</p><button aria-label={`${t.title} 시작하기`} disabled={busy} onClick={()=>void start(t)}>{busy?'과제를 준비하는 중…':t.kind==='REPORT'?'보고서 과제 시작하기':'구현 과제 시작하기'}</button></article>)}</div>}
  </section>

  <section className={local.completedSection} aria-labelledby="completed-title"><details><summary><div><p>지난 기록</p><h2 id="completed-title">완료한 과제</h2></div><span>{list.isSuccess?`${completedFlows.length}개 · 펼쳐 보기`:'불러오는 중'}</span></summary>{list.isSuccess&&(completedFlows.length===0?<p className={local.stateText}>완료한 과제가 없습니다.</p>:<div className={local.historyList}>{completedFlows.map(flow=><HistoryCard key={flow.id} flow={flow}/>)}</div>)}</details></section>
 </>;
}
function Detail({id,userId}:{id:string;userId:string}){
 const query=useQuery({queryKey:['learning',userId,id],queryFn:({signal})=>getFlow(id,signal),meta:{private:true},retry:false,refetchInterval:q=>q.state.data?.feedbackStatus==='RUNNING'?1500:false});
 if(query.isPending)return <p>과제를 불러오는 중…</p>;
 if(query.isError)return <><p role="alert">{message(query.error)}</p><button onClick={()=>void query.refetch()}>다시 불러오기</button></>;
 return <FlowBody key={id} flow={query.data} userId={userId}/>;
}
function FlowBody({flow,userId}:{flow:Flow;userId:string}){
 const cache=useQueryClient();const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>active.current?.abort(),[]);
 async function act(fn:(signal:AbortSignal)=>Promise<Flow>,navigate=false){if(busy)return;const c=new AbortController();active.current=c;setBusy(true);setError('');try{const f=await fn(c.signal);if(!c.signal.aborted){if(navigate)router.push(`/learn/${f.id}`);else cache.setQueryData(['learning',userId,flow.id],f);}}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setBusy(false);}}
 return <><Link href="/learn">과제 목록</Link>{flow.parentId&&<p><Link href={`/learn/${flow.parentId}`}>이전 제출과 피드백 보기</Link></p>}<section className={local.flowHeader}><p>{flow.mode==='TRAINING'?'훈련':'모의 전형'} · {flow.parentId?'재연습':'첫 수행'}</p><h1>{flow.task.title}</h1><details><summary>과제 목표와 제출 조건</summary><p>{flow.task.situation}</p><ul>{flow.task.requirements.map(r=><li key={r}>{r}</li>)}</ul><p>제출물: {flow.task.deliverable}</p><p>관찰 기준: 문제와 요청 구체화 · 제안 검증 · 결과물 개선 · 판단 설명</p></details>{flow.stage!=='WORKING'&&<strong>현재 단계: {flow.stage==='EXPLAIN'?'제출 완료 · 직접 설명':'피드백 확인'}</strong>}</section>{error&&<div role="alert" className={styles.error}><p>{error}</p><button onClick={()=>{if(window.confirm("입력 중인 설명을 버리고 서버 저장본을 불러올까요?"))window.location.reload();}}>서버 저장본 불러오기</button></div>}
 {flow.stage==='WORKING'?<Working flow={flow} userId={userId} busy={busy} act={act}/>:flow.stage==='EXPLAIN'?<Explain flow={flow} busy={busy} act={act}/>:<><section className={`${styles.panel} ${local.record}`}><div className={local.recordHeading}><div><p>제출 당시 그대로 보관된 기록</p><h2>결과물과 검증 기록</h2></div><span>읽기 전용</span></div>{flow.kind==='CODING'&&<p className={local.recordNotice}>공개 테스트 기록은 브라우저에서 실행한 연습 결과이며 독립적인 서버 채점이나 역량 점수가 아닙니다.</p>}<div className={local.recordGrid}><details><summary>제출한 결과물 보기</summary><pre>{flow.snapshot?.artifact}</pre></details><section><h3>내가 남긴 검증 설명</h3><p>{flow.snapshot?.notes.verification}</p></section><details><summary>나의 직접 설명 보기</summary><div><p>{flow.answers?.decision}</p><p>{flow.answers?.change}</p></div></details></div>{flow.hints.length>0&&<p className={local.hintNote}>선택형 힌트를 참고한 수행입니다. 힌트 사용을 감점하지 않습니다.</p>}</section><section className={flow.feedbackStatus==='SUCCEEDED'?local.feedbackStage:styles.panel}><h2 className={flow.feedbackStatus==='SUCCEEDED'?local.feedbackTitle:undefined}>근거 중심 피드백</h2>{flow.feedbackStatus==='RUNNING'?<p role="status">고정된 기록으로 피드백을 작성하고 있습니다. 새로고침해도 상태를 확인할 수 있습니다.</p>:flow.feedbackStatus!=='SUCCEEDED'?<><p>{flow.feedbackStatus==='FAILED'?'평가를 완료하지 못했습니다. 제출 기록은 보존되어 있습니다.':'아직 평가를 요청하지 않았습니다.'}</p><button disabled={busy} onClick={()=>void act(s=>changeFlow(`/${flow.id}/feedback`,{},'POST',s))}>{flow.feedbackStatus==='FAILED'?'피드백 다시 요청':'근거 중심 피드백 받기'}</button></>:flow.feedback&&<FeedbackReview feedback={flow.feedback} busy={busy} onPractice={()=>void act(s=>changeFlow(`/${flow.id}/practice`,{},'POST',s),true)}/>}</section>{flow.comparison.map(c=><section className={styles.panel} key={c.label}><h2>이전 제출과 비교</h2><p>{c.changed?'제출 결과물이 변경되었습니다. 아래 내용과 새 검증 기록을 비교하세요.':'제출 결과물은 이전과 같습니다. 능력이 개선됐다고 자동 판정하지 않습니다.'}</p><details><summary>이전 결과물과 검증 설명</summary><pre>{c.previousArtifact}</pre><p>{c.previousVerification.verification}</p></details><details><summary>이번 결과물과 검증 설명</summary><pre>{c.currentArtifact}</pre><p>{c.currentVerification.verification}</p></details></section>)}</>}
 </>;
}
type Act=(fn:(signal:AbortSignal)=>Promise<Flow>,navigate?:boolean)=>Promise<void>;
function Working({flow,userId,busy,act}:{flow:Flow;userId:string;busy:boolean;act:Act}){
 const [ready,setReady]=useState(false);const cache=useQueryClient();const [artifact,setArtifact]=useState({version:0,value:''});const readyState=useCallback((ready:boolean,version:number,value:string)=>{setReady(ready);setArtifact(old=>old.version===version&&old.value===value?old:{version,value});},[]);
 const [notes,setNotes]=useState<Notes>(flow.notes);
 const report=useQuery({queryKey:['flow-workspace',userId,flow.sessionId],queryFn:({signal})=>reportWorkspace(flow.sessionId!,signal),enabled:!!flow.sessionId,meta:{private:true},refetchOnWindowFocus:false});
 async function submit(signal:AbortSignal){const saved=await changeFlow(`/${flow.id}/notes`,{version:flow.version,notes},'PUT',signal);cache.setQueryData(['learning',userId,flow.id],saved);const artifactVersion=artifact.version;
  const artifactHash=flow.sessionId?artifact.value:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(artifact.value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  return changeFlow(`/${flow.id}/submit`,{version:saved.version,artifactVersion,artifactHash},'POST',signal);
 }
 return <WorkStages busy={busy} training={flow.mode==='TRAINING'} kind={flow.kind} storageKey={flow.id} brief={<section className={styles.panel}><h3>{flow.task.title}</h3><p>{flow.task.situation}</p><ul>{flow.task.requirements.map(r=><li key={r}>{r}</li>)}</ul><p><strong>제출물:</strong> {flow.task.deliverable}</p><p>제출 전에는 단계 사이를 자유롭게 오갈 수 있습니다. 단계 이동은 제출이 아닙니다.</p></section>} work={<>{flow.mode==='TRAINING'&&<HintPanel kind={flow.kind} hints={flow.hints} busy={busy} onReveal={index=>void act(s=>changeFlow(`/${flow.id}/hints`,{index},'POST',s))}/>}<fieldset disabled={busy}>{flow.sessionId?(report.isPending?<p>작업 공간을 불러오는 중…</p>:report.isError?<button onClick={()=>void report.refetch()}>작업 공간 재시도</button>:<WorkspaceEditor workspace={report.data} userId={userId} flow onReady={readyState}/>):<LoadWorkspace id={flow.codingId!} userId={userId} flow onReady={readyState}/>}</fieldset></>} verification={<section className={styles.panel}><h2>내 결과물 검증과 제출</h2><p>AI 답변을 얼마나 길게 받았는지보다, 무엇을 채택하거나 보류했고 어떤 근거로 확인했는지를 남겨 주세요.</p><label htmlFor="flow-explanation">{flow.kind==='REPORT'?'AI 제안 중 채택·보류한 판단과 이유':'AI 제안 중 채택·거절한 변경과 이유'}</label><textarea id="flow-explanation" maxLength={4000} value={notes.explanation} disabled={busy} onChange={e=>setNotes({...notes,explanation:e.target.value})} placeholder="AI를 사용하지 않았다면 직접 선택한 방법, 다른 대안, 남은 한계를 적으세요."/><label htmlFor="flow-verification">무엇을 어떻게 확인했나요?</label><textarea id="flow-verification" maxLength={4000} value={notes.verification} disabled={busy} onChange={e=>setNotes({...notes,verification:e.target.value})} placeholder="주장과 원자료 또는 요구사항과 테스트 결과를 비교하세요. 반례와 확인하지 못한 범위, 다음 확인 방법도 적으세요."/>
 {flow.sessionId&&report.data&&<EvidencePicker sessionId={flow.sessionId} userId={userId} materials={report.data.materials} notes={notes} disabled={busy} onChange={setNotes}/>}
 <p role="status">{busy?"처리 중…":JSON.stringify(notes)===JSON.stringify(flow.notes)?"검증 설명 저장됨":"저장하지 않은 검증 설명이 있습니다."}</p><p>설명은 아래 저장 버튼으로 저장합니다. 제출 후 결과물과 대화가 잠기고, AI 패널 없이 직접 설명하는 단계로 이동합니다. 미완성 결과도 제출할 수 있습니다.</p><div className={styles.buttons}><button disabled={busy} onClick={()=>void act(s=>changeFlow(`/${flow.id}/notes`,{version:flow.version,notes},'PUT',s))}>검증 설명 저장</button><button disabled={busy||!ready||!notes.explanation.trim()||!notes.verification.trim()} onClick={()=>{if(window.confirm("현재 결과물과 검증 기록을 제출할까요? 제출 후에는 수정할 수 없습니다."))void act(submit);}}>결과물 제출하고 직접 설명하기</button></div>{!ready&&<p>결과물 저장과 진행 중 AI 응답을 확인하세요. 코드는 현재 버전의 테스트 기록도 필요합니다.</p>}</section>}/>;
}
function Explain({flow,busy,act}:{flow:Flow;busy:boolean;act:Act}){const [decision,setDecision]=useState('');const [change,setChange]=useState('');return <section className={styles.panel}><h2>내 판단을 직접 설명하기</h2><p>AI 패널을 잠시 닫았습니다. 상세 피드백을 보기 전에 내 생각을 적어 보세요. 설명하기 어려운 부분을 그대로 적어도 됩니다. 외부 AI 사용을 차단하는 인증 시험은 아닙니다.</p><details><summary>내 제출물 확인</summary><pre>{flow.snapshot?.artifact}</pre></details><label htmlFor="decision">{flow.task.questions[0]}</label><textarea id="decision" value={decision} maxLength={4000} onChange={e=>setDecision(e.target.value)} disabled={busy}/><label htmlFor="change">{flow.task.questions[1]}</label><textarea id="change" value={change} maxLength={4000} onChange={e=>setChange(e.target.value)} disabled={busy}/><button disabled={busy||!decision.trim()||!change.trim()} onClick={()=>void act(s=>changeFlow(`/${flow.id}/answers`,{decision,change},'POST',s))}>직접 설명 제출</button><p>확정하기 전 입력은 새로고침하면 사라집니다. 제출한 설명은 변경되지 않습니다.</p></section>;}
