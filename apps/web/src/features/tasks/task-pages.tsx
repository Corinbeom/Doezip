"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { getTask, getTasks, type Task } from './api';
import { LearningShell, Arrow } from '@/shared/ui/learning-shell';
import styles from './tasks.module.css';

function Artwork() {
  return <div className={styles.artwork}><Image src="/design/task-evidence.svg" width={240} height={230} alt="" /></div>;
}
function Retry({ retry, pending }: { retry: () => void; pending: boolean }) {
  return <button className={styles.button} type="button" onClick={retry} disabled={pending}>{pending ? '다시 불러오는 중…' : '재시도'}<Arrow /></button>;
}
function TaskMeta({ task }: { task: Task }) {
  return <p className={styles.meta}>버전 {task.versionNo} · {task.status === 'PUBLISHED' ? '공개' : '보관됨'}</p>;
}
export function TaskListPage() {
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: ({ signal }) => getTasks(signal) });
  return <LearningShell><div className={styles.container}>
    <section className={styles.hero} aria-labelledby="explore-heading">
      <div><p className={styles.eyebrow}>배운 것을, 나의 판단으로</p>
        <h2 id="explore-heading">AI와 함께 풀고,<br /><em>내 근거로 완성하세요.</em></h2>
        <p className={styles.description}>실무의 문제를 고르고, 어떤 근거가 필요한지 살펴보세요.<br />스스로 설명할 수 있는 판단의 첫걸음입니다.</p>
        <div className={styles.heroAction}><a className={styles.button} href="#task-list">문제 살펴보기<Arrow /></a><span>한 문제에서 시작하는 생각의 변화</span></div>
      </div>
      <Image className={styles.heroArt} src="/design/learning-notes.svg" width={430} height={300} alt="자료를 읽고 근거를 연결해 판단을 완성하는 노트 일러스트" priority />
    </section>
    <section id="task-list" className={styles.listSection} aria-labelledby="task-list-title">
      <div className={styles.sectionHeading}><h1 id="task-list-title">과제 목록 {tasks.isSuccess && <span aria-hidden="true">{tasks.data.items.length}</span>}</h1><span className={styles.pill}>문제 탐색</span></div>
      <div className={styles.exploreGrid}><div>
        {tasks.isPending && <div className={styles.state}><span className={styles.loader} aria-hidden="true" /><p role="status">과제를 불러오는 중…</p><p className={styles.description}>공개된 문제를 준비하고 있어요.</p></div>}
        {tasks.isError && <div className={styles.state}><p role="alert">과제 목록을 불러오지 못했습니다.</p><p className={styles.description}>잠시 후 다시 시도해 주세요.</p><Retry retry={() => void tasks.refetch()} pending={tasks.isFetching} /></div>}
        {tasks.isSuccess && (tasks.data.items.length === 0 ? <div className={styles.state}><p role="status">공개된 과제가 없습니다.</p><p className={styles.description}>새로운 문제가 공개되면 여기에서 확인할 수 있어요.</p></div> :
          <ul className={styles.cards}>{tasks.data.items.map(task => <li key={task.id}><article className={styles.card}>
            <Artwork /><div className={styles.cardBody}><span className={styles.pill}>{task.status === 'PUBLISHED' ? '공개 과제' : '보관된 과제'}</span>
              <h2><Link href={`/tasks/${task.id}`}>{task.title}</Link></h2>
              <p className={styles.excerpt}>{task.descriptionMarkdown}</p><TaskMeta task={task} />
              <Link className={styles.textLink} href={`/tasks/${task.id}`} aria-label={`${task.title} 자세히 보기`}>문제 살펴보기<Arrow /></Link>
            </div>
          </article></li>)}</ul>)}
      </div><aside className={styles.learningNote} aria-labelledby="learning-note-title"><h2 id="learning-note-title">판단의 시작, 문제 읽기.</h2>
        <div className={styles.step}><span>01</span><div><h3>문제를 고르고</h3><p>관심 있는 과제의 제목과<br />설명을 살펴보세요.</p></div></div>
        <div className={styles.step}><span>02</span><div><h3>상황을 이해하고</h3><p>풀어야 할 문제와 필요한<br />판단이 무엇인지 확인해요.</p></div></div>
        <div className={styles.step}><span>03</span><div><h3>기준을 확인해요</h3><p>공개된 평가 기준을 읽고<br />생각의 방향을 잡아보세요.</p></div></div>
        <p className={styles.noteFoot}>현재는 과제와 평가 기준을 살펴볼 수 있어요. 보고서 작성과 AI 학습은 준비 중입니다.</p>
      </aside></div>
    </section>
  </div></LearningShell>;
}
export function TaskDetailPage({ taskId }: { taskId: string }) {
  const task = useQuery({ queryKey: ['tasks', taskId], queryFn: ({ signal }) => getTask(taskId, signal) });
  const unavailable = task.error instanceof ApiError && [400, 404].includes(task.error.status);
  return <LearningShell><div className={styles.container}>
    <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href="/tasks">과제 목록으로</Link><span aria-hidden="true">/</span><span>문제 소개</span></nav>
    {task.isPending && <div className={styles.state}><h1>과제 상세</h1><span className={styles.loader} aria-hidden="true" /><p role="status">과제를 불러오는 중…</p></div>}
    {task.isError && <div className={styles.state}><h1>과제 상세</h1><p role="alert">{unavailable ? '과제를 찾을 수 없습니다.' : '과제를 불러오지 못했습니다.'}</p><p className={styles.description}>{unavailable ? '목록으로 돌아가 다른 문제를 살펴보세요.' : '잠시 후 다시 시도해 주세요.'}</p>
      {!unavailable && <Retry retry={() => void task.refetch()} pending={task.isFetching} />}</div>}
    {task.isSuccess && <>
      <section className={styles.detailHead} aria-labelledby="task-title"><div><span className={styles.pill}>문제 소개</span><h1 id="task-title">{task.data.title}</h1><TaskMeta task={task.data} /></div><Artwork /></section>
      <div className={styles.detailGrid}><div>
        <section className={styles.contentSection} aria-labelledby="description-title"><h2 id="description-title">과제 설명</h2><div className={styles.brief}><span className={styles.quote} aria-hidden="true">“</span>
          <p className={styles.preserve}>{task.data.descriptionMarkdown}</p></div>
        </section>
        <section className={styles.contentSection} aria-labelledby="rubrics-title"><h2 id="rubrics-title">평가 기준</h2>
          {task.data.rubrics.length === 0 ? <p className={styles.brief}>등록된 평가 기준이 없습니다.</p> : <ul className={styles.rubrics}>{task.data.rubrics.map((rubric, index) =>
            <li key={rubric.code}><span className={styles.rubricNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><h3>{rubric.title}</h3><p className={styles.preserve}>{rubric.description}</p></div></li>)}</ul>}
        </section>
      </div><aside className={styles.detailAside}><p className={styles.eyebrow}>문제를 만나기 전에</p><h2>먼저, 충분히 살펴보세요.</h2><p className={styles.description}>과제의 상황과 평가 기준을 읽으며 어떤 근거로 판단할지 생각해 보세요.</p><div className={styles.availability}>지금은 과제와 평가 기준을 살펴볼 수 있어요. 보고서 작성과 제출은 준비 중입니다.</div><Link className={styles.secondaryButton} href="/tasks">다른 문제 살펴보기<Arrow /></Link></aside></div>
    </>}
  </div></LearningShell>;
}
