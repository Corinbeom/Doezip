import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/shared/api/query-provider';
import { TaskDetailPage, TaskListPage } from './task-pages';
import type { Task } from './api';

vi.mock('next/navigation', async (importOriginal) => ({...await importOriginal<typeof import('next/navigation')>(), useRouter:()=>({push:vi.fn()})}));

const task: Task = {
  id: '61111111-1111-4111-8111-111111111111', taskCode: 'test-task', versionNo: 1,
  title: '조회 테스트용 가상 과제', descriptionMarkdown: '공개된 과제 설명\n<script>unsafe()</script>', status: 'PUBLISHED',
  rubrics: [{ code: 'E1', area: 'EVIDENCE', title: '근거 확인', description: '공개된 자료로 설명합니다.' }],
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('loads the real configured endpoint shape and links each task to detail', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8181/api/v1/');
  const fetcher = vi.fn().mockResolvedValue(json({ items: [task] }));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryProvider><TaskListPage /></QueryProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('과제를 불러오는 중');
  expect(await screen.findByRole('link', { name: task.title })).toHaveAttribute('href', `/tasks/${task.id}`);
  expect(fetcher).toHaveBeenCalledWith('http://localhost:8181/api/v1/tasks', expect.objectContaining({ signal: expect.any(AbortSignal) }));
});
it('shows an empty published task list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ items: [] })));
  render(<QueryProvider><TaskListPage /></QueryProvider>);
  await screen.findByText('공개된 과제가 없습니다.');
});
it('reports network failure and retries the request successfully', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(json({ items: [task] }));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryProvider><TaskListPage /></QueryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('과제 목록을 불러오지 못했습니다.');
  fireEvent.click(screen.getByRole('button', { name: '재시도' }));
  await screen.findByRole('link', { name: task.title });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('renders public detail and rubrics safely as text without starting a session', async () => {
  const fetcher = vi.fn().mockResolvedValue(json(task));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryProvider><TaskDetailPage taskId={task.id} /></QueryProvider>);
  await screen.findByRole('heading', { name: task.title });
  expect(screen.getByRole('region', { name: '과제 설명' })).toHaveTextContent('공개된 과제 설명 <script>unsafe()</script>');
  expect(document.querySelector('script')).toBeNull();
  expect(screen.getByRole('heading', { name: '근거 확인' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '과제 목록으로' })).toHaveAttribute('href', '/tasks');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(fetcher.mock.calls[0][0]).toContain(`/tasks/${task.id}`);
});
it('shows unavailable detail without a misleading retry action', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'NOT_FOUND', message: '없음', requestId: 'test' }, 404)));
  render(<QueryProvider><TaskDetailPage taskId={task.id} /></QueryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('과제를 찾을 수 없습니다.');
  expect(screen.queryByRole('button', { name: '재시도' })).not.toBeInTheDocument();
});
it('retries detail after server failure', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(task));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryProvider><TaskDetailPage taskId={task.id} /></QueryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('과제를 불러오지 못했습니다.');
  fireEvent.click(screen.getByRole('button', { name: '재시도' }));
  await screen.findByRole('heading', { name: task.title });
});
it('does not display task data when the response violates the public contract', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...task, privateAnswer: 'must never render' })));
  render(<QueryProvider><TaskDetailPage taskId={task.id} /></QueryProvider>);
  await screen.findByRole('alert');
  expect(screen.queryByText('must never render')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: task.title })).not.toBeInTheDocument();
});

it('keeps the approved exploration shell honest about available capabilities', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ items: [task] })));
  render(<QueryProvider><TaskListPage /></QueryProvider>);
  await screen.findByRole('link', { name: task.title });
  expect(screen.getByRole('link', { name: '되짚 홈' })).toHaveAttribute('href', '/tasks');
  expect(screen.getByRole('link', { name: '본문으로 바로가기' })).toHaveAttribute('href', '#task-main');
  expect(screen.getByRole('link', { name: '문제 살펴보기' })).toHaveAttribute('href', '#task-list');
  expect(screen.queryByText(/미승인/)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '내 학습' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /시작하기/ })).not.toBeInTheDocument();
  expect(screen.getByText(/보고서 과제는 AI와 자료를 분석/)).toBeInTheDocument();
});

it('renders missing rubrics without inventing evaluation criteria', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...task, rubrics: [] })));
  render(<QueryProvider><TaskDetailPage taskId={task.id} /></QueryProvider>);
  await screen.findByText('등록된 평가 기준이 없습니다.');
  expect(screen.queryByRole('heading', { name: '근거 확인' })).not.toBeInTheDocument();
  expect(screen.getByText(/보고서를 작성해 제출할 수/)).toBeInTheDocument();
});
