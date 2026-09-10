"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { getTask, getTasks } from './api';

function PreviewNotice() {
  return <p>과제 조회 기능 확인용 화면입니다. 최종 디자인은 미승인 상태입니다.</p>;
}
function Retry({ retry, pending }: { retry: () => void; pending: boolean }) {
  return <button type="button" onClick={retry} disabled={pending}>{pending ? '다시 불러오는 중…' : '재시도'}</button>;
}
export function TaskListPage() {
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: ({ signal }) => getTasks(signal) });
  return <main>
    <Link href="/">개발 환경 확인</Link>
    <h1>과제 목록</h1>
    <PreviewNotice />
    {tasks.isPending && <p role="status">과제를 불러오는 중…</p>}
    {tasks.isError && <div><p role="alert">과제 목록을 불러오지 못했습니다.</p><Retry retry={() => void tasks.refetch()} pending={tasks.isFetching} /></div>}
    {tasks.isSuccess && (tasks.data.items.length === 0 ? <p role="status">공개된 과제가 없습니다.</p> :
      <ul>{tasks.data.items.map(task => <li key={task.id}>
        <Link href={`/tasks/${task.id}`}>{task.title}</Link>
        <p>{task.taskCode} · 버전 {task.versionNo} · {task.status === 'PUBLISHED' ? '공개' : '보관됨'}</p>
      </li>)}</ul>)}
  </main>;
}
export function TaskDetailPage({ taskId }: { taskId: string }) {
  const task = useQuery({ queryKey: ['tasks', taskId], queryFn: ({ signal }) => getTask(taskId, signal) });
  const unavailable = task.error instanceof ApiError && [400, 404].includes(task.error.status);
  return <main>
    <Link href="/tasks">과제 목록으로</Link>
    <PreviewNotice />
    {task.isPending && <><h1>과제 상세</h1><p role="status">과제를 불러오는 중…</p></>}
    {task.isError && <><h1>과제 상세</h1><p role="alert">{unavailable ? '과제를 찾을 수 없습니다.' : '과제를 불러오지 못했습니다.'}</p>
      {!unavailable && <Retry retry={() => void task.refetch()} pending={task.isFetching} />}</>}
    {task.isSuccess && <>
      <h1>{task.data.title}</h1>
      <p>{task.data.taskCode} · 버전 {task.data.versionNo} · {task.data.status === 'PUBLISHED' ? '공개' : '보관됨'}</p>
      <section aria-labelledby="description-title"><h2 id="description-title">과제 설명</h2>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{task.data.descriptionMarkdown}</p>
      </section>
      <section aria-labelledby="rubrics-title"><h2 id="rubrics-title">평가 기준</h2>
        {task.data.rubrics.length === 0 ? <p>등록된 평가 기준이 없습니다.</p> : <ul>{task.data.rubrics.map(rubric =>
          <li key={rubric.code}><h3>{rubric.title}</h3><p>{rubric.description}</p></li>)}</ul>}
      </section>
      <p>이번 단계에서는 과제 조회만 제공합니다. 보고서 작성과 제출은 후속 구현입니다.</p>
    </>}
  </main>;
}
