"use client";
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {ApiError} from '@/shared/api/client';
import {useAuth} from '@/shared/auth/auth-provider';
import {getLearningCatalog,type LearningTask} from '@/shared/api/learning-catalog';
import {changeFlow} from '@/features/learning/api';
import {getTask,type Task} from './api';
import {LearningShell,Arrow} from '@/shared/ui/learning-shell';
import styles from './tasks.module.css';
import {StartSession} from '@/features/workspace/start-session';

function Artwork({kind}:{kind?:LearningTask['kind']}) {
  return <div className={styles.artwork} data-kind={kind??'REPORT'}><Image src="/design/task-evidence.svg" width={240} height={230} alt=""/></div>;
}
function Retry({retry,pending}:{retry:()=>void;pending:boolean}) {
  return <button className={styles.button} type="button" onClick={retry} disabled={pending}>{pending?'다시 불러오는 중…':'재시도'}<Arrow/></button>;
}
function TaskMeta({task}:{task:Task}) {
  return <p className={styles.meta}>버전 {task.versionNo} · {task.status==='PUBLISHED'?'공개':'보관됨'}</p>;
}
function CatalogMeta({task}:{task:LearningTask}) {
  return <div className={styles.catalogMeta}><span>{task.kind==='REPORT'?'보고서':'구현'}</span><span>{task.difficulty}</span><span>약 {task.estimatedMinutes}분</span></div>;
}
function Tags({task}:{task:LearningTask}) {
  return <ul className={styles.tags} aria-label="과제 태그">{task.tags.map(tag=><li key={tag}>{tag}</li>)}</ul>;
}

export function TaskListPage() {
  const [kind,setKind]=useState<'ALL'|'REPORT'|'CODING'>('ALL');
  const tasks=useQuery({queryKey:['learning-catalog'],queryFn:({signal})=>getLearningCatalog(signal)});
  const visible=useMemo(()=>tasks.data?.filter(task=>kind==='ALL'||task.kind===kind)??[],[tasks.data,kind]);
  return <LearningShell><div className={styles.container}>
    <section className={styles.hero} aria-labelledby="explore-heading">
      <div><p className={styles.eyebrow}>배운 것을, 나의 판단으로</p>
        <h2 id="explore-heading">AI와 함께 풀고,<br/><em>내 근거로 완성하세요.</em></h2>
        <p className={styles.description}>보고서와 개발 과제를 한곳에서 비교하고, 연습할 판단과 검증 방식을 먼저 살펴보세요.</p>
        <div className={styles.heroAction}><a className={styles.button} href="#task-list">과제 살펴보기<Arrow/></a></div>
      </div>
      <Image className={styles.heroArt} src="/design/learning-notes.svg" width={430} height={300} alt="자료를 읽고 근거를 연결해 판단을 완성하는 노트 일러스트" priority/>
    </section>
    <section id="task-list" className={styles.listSection} aria-labelledby="task-list-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>과제 카탈로그</p><h1 id="task-list-title">어떤 역량을 연습할까요? {tasks.isSuccess&&<span aria-hidden="true">{tasks.data.length}</span>}</h1></div>
        <div className={styles.filters} role="group" aria-label="과제 유형 필터">{([['ALL','전체'],['REPORT','보고서'],['CODING','구현']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={kind===value} onClick={()=>setKind(value)}>{label}</button>)}</div>
      </div>
      {tasks.isPending&&<div className={styles.state}><span className={styles.loader} aria-hidden="true"/><p role="status">과제를 불러오는 중…</p><p className={styles.description}>공개된 문제를 준비하고 있어요.</p></div>}
      {tasks.isError&&<div className={styles.state}><p role="alert">과제 목록을 불러오지 못했습니다.</p><p className={styles.description}>잠시 후 다시 시도해 주세요.</p><Retry retry={()=>void tasks.refetch()} pending={tasks.isFetching}/></div>}
      {tasks.isSuccess&&(tasks.data.length===0?<div className={styles.state}><p role="status">공개된 과제가 없습니다.</p><p className={styles.description}>새로운 문제가 공개되면 여기에서 확인할 수 있어요.</p></div>:
        visible.length===0?<div className={styles.state}><p role="status">선택한 유형의 과제가 없습니다.</p></div>:
        <ul className={styles.catalogCards}>{visible.map(task=><li key={task.catalogId+':'+task.version}><article className={styles.catalogCard}>
          <Artwork kind={task.kind}/><div className={styles.cardBody}><CatalogMeta task={task}/><h2><Link href={'/tasks/'+task.catalogId}>{task.title}</Link></h2><p className={styles.excerpt}>{task.situation}</p><Tags task={task}/><p className={styles.deliverable}><strong>제출물</strong>{task.deliverable}</p><Link className={styles.textLink} href={'/tasks/'+task.catalogId} aria-label={task.title+' 자세히 보기'}>과제 자세히 보기<Arrow/></Link></div>
        </article></li>)}</ul>)}
    </section>
  </div></LearningShell>;
}

function StartLearningTask({task}:{task:LearningTask}) {
  const auth=useAuth();const router=useRouter();const [mode,setMode]=useState<'TRAINING'|'SIMULATION'>('TRAINING');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const pending=useRef<{catalogId:string;version:string;mode:string;requestKey:string}|null>(null);const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  if(auth.status==='loading')return <p role="status">로그인 상태를 확인하는 중…</p>;
  if(auth.status!=='connected'||!auth.user)return <Link className={styles.button} href={'/login?returnTo='+encodeURIComponent('/tasks/'+task.catalogId)}>로그인하고 시작하기<Arrow/></Link>;
  async function start(){if(busy)return;const controller=new AbortController();request.current=controller;setBusy(true);setError('');const body=pending.current?.catalogId===task.catalogId&&pending.current.version===task.version&&pending.current.mode===mode?pending.current:{catalogId:task.catalogId,version:task.version,mode,requestKey:crypto.randomUUID()};pending.current=body;try{const flow=await changeFlow('',body,'POST',controller.signal);if(!controller.signal.aborted)router.push('/learn/'+flow.id);}catch{if(!controller.signal.aborted)setError('과제를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');}finally{if(!controller.signal.aborted)setBusy(false);}}
  return <div className={styles.startControl}><label htmlFor="catalog-mode">연습 방식</label><select id="catalog-mode" value={mode} onChange={event=>setMode(event.target.value as typeof mode)} disabled={busy}><option value="TRAINING">훈련 · 안내와 힌트 제공</option><option value="SIMULATION">모의 전형 · 스스로 수행</option></select><p>{mode==='TRAINING'?'막히는 지점에서 힌트를 선택해 볼 수 있습니다.':'힌트 없이 수행한 기록으로 피드백을 받습니다.'}</p>{error&&<p role="alert">{error}</p>}<button className={styles.button} type="button" onClick={()=>void start()} disabled={busy}>{busy?'과제를 준비하는 중…':'이 과제 시작하기'}<Arrow/></button></div>;
}

function CatalogTaskDetail({catalogId}:{catalogId:string}) {
  const catalog=useQuery({queryKey:['learning-catalog'],queryFn:({signal})=>getLearningCatalog(signal)});
  const task=catalog.data?.find(item=>item.catalogId===catalogId);
  return <LearningShell><div className={styles.container}>
    <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href="/tasks">과제 목록으로</Link><span aria-hidden="true">/</span><span>과제 소개</span></nav>
    {catalog.isPending&&<div className={styles.state}><h1>과제 상세</h1><span className={styles.loader} aria-hidden="true"/><p role="status">과제를 불러오는 중…</p></div>}
    {catalog.isError&&<div className={styles.state}><h1>과제 상세</h1><p role="alert">과제를 불러오지 못했습니다.</p><Retry retry={()=>void catalog.refetch()} pending={catalog.isFetching}/></div>}
    {catalog.isSuccess&&!task&&<div className={styles.state}><h1>과제 상세</h1><p role="alert">과제를 찾을 수 없습니다.</p><p className={styles.description}>목록으로 돌아가 다른 문제를 살펴보세요.</p><Link className={styles.secondaryButton} href="/tasks">과제 목록으로</Link></div>}
    {task&&<><section className={styles.detailHead} aria-labelledby="task-title"><div><CatalogMeta task={task}/><h1 id="task-title">{task.title}</h1><Tags task={task}/></div><Artwork kind={task.kind}/></section>
      <div className={styles.detailGrid}><div><section className={styles.contentSection} aria-labelledby="situation-title"><h2 id="situation-title">과제 상황</h2><div className={styles.brief}><span className={styles.quote} aria-hidden="true">“</span><p className={styles.preserve}>{task.situation}</p></div></section>
      <section className={styles.contentSection} aria-labelledby="requirements-title"><h2 id="requirements-title">완료 조건</h2><ol className={styles.rubrics}>{task.requirements.map((requirement,index)=><li key={requirement}><span className={styles.rubricNumber} aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><p>{requirement}</p></div></li>)}</ol></section></div>
      <aside className={styles.detailAside}><p className={styles.eyebrow}>{task.kind==='REPORT'?'자료 기반 보고서':'코드 수정과 검증'}</p><h2>결과보다 판단 과정을 남겨요.</h2><p className={styles.description}>AI와 작업한 뒤 제안을 직접 검증하고, 채택한 이유와 남은 한계를 설명합니다.</p><div className={styles.availability}><strong>제출물</strong><br/>{task.deliverable}</div><StartLearningTask task={task}/><Link className={styles.secondaryButton} href="/tasks">다른 과제 살펴보기<Arrow/></Link></aside></div></>}
  </div></LearningShell>;
}

function LegacyTaskDetail({taskId}:{taskId:string}) {
  const task=useQuery({queryKey:['tasks',taskId],queryFn:({signal})=>getTask(taskId,signal)});
  const unavailable=task.error instanceof ApiError&&[400,404].includes(task.error.status);
  return <LearningShell><div className={styles.container}>
    <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href="/tasks">과제 목록으로</Link><span aria-hidden="true">/</span><span>이전 과제 소개</span></nav>
    {task.isPending&&<div className={styles.state}><h1>과제 상세</h1><span className={styles.loader} aria-hidden="true"/><p role="status">과제를 불러오는 중…</p></div>}
    {task.isError&&<div className={styles.state}><h1>과제 상세</h1><p role="alert">{unavailable?'과제를 찾을 수 없습니다.':'과제를 불러오지 못했습니다.'}</p><p className={styles.description}>{unavailable?'목록으로 돌아가 다른 문제를 살펴보세요.':'잠시 후 다시 시도해 주세요.'}</p>{!unavailable&&<Retry retry={()=>void task.refetch()} pending={task.isFetching}/>}</div>}
    {task.isSuccess&&<><section className={styles.detailHead} aria-labelledby="task-title"><div><span className={styles.pill}>이전 보고서 과제</span><h1 id="task-title">{task.data.title}</h1><TaskMeta task={task.data}/></div><Artwork/></section>
      <div className={styles.detailGrid}><div><section className={styles.contentSection} aria-labelledby="description-title"><h2 id="description-title">과제 설명</h2><div className={styles.brief}><span className={styles.quote} aria-hidden="true">“</span><p className={styles.preserve}>{task.data.descriptionMarkdown}</p></div></section>
      <section className={styles.contentSection} aria-labelledby="rubrics-title"><h2 id="rubrics-title">평가 기준</h2>{task.data.rubrics.length===0?<p className={styles.brief}>등록된 평가 기준이 없습니다.</p>:<ul className={styles.rubrics}>{task.data.rubrics.map((rubric,index)=><li key={rubric.code}><span className={styles.rubricNumber} aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><h3>{rubric.title}</h3><p className={styles.preserve}>{rubric.description}</p></div></li>)}</ul>}</section></div>
      <aside className={styles.detailAside}><p className={styles.eyebrow}>이전 과제 기록</p><h2>먼저, 충분히 살펴보세요.</h2><p className={styles.description}>과제의 상황과 평가 기준을 읽으며 어떤 근거로 판단할지 생각해 보세요.</p><div className={styles.availability}>AI와 자료를 분석하고 보고서를 작성해 제출할 수 있어요.</div>{task.data.status==='PUBLISHED'&&<StartSession taskId={task.data.id}/>}<Link className={styles.secondaryButton} href="/tasks">현재 과제 둘러보기<Arrow/></Link></aside></div></>}
  </div></LearningShell>;
}

export function TaskDetailPage({taskId}:{taskId:string}) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(taskId)?<LegacyTaskDetail taskId={taskId}/>:<CatalogTaskDetail catalogId={taskId}/>;
}
