import { z } from 'zod';
import type { components } from '@/generated/api-types';
import { apiFetch } from '@/shared/api/client';

export type Task = components['schemas']['Task'];
export type TaskList = components['schemas']['TaskList'];
const taskSchema: z.ZodType<Task> = z.strictObject({
  id: z.uuid(), taskCode: z.string(), versionNo: z.number().int().min(1),
  title: z.string(), descriptionMarkdown: z.string(), status: z.enum(['PUBLISHED', 'ARCHIVED']),
  rubrics: z.array(z.strictObject({
    code: z.string(), area: z.enum(['PROMPT', 'EVIDENCE', 'DOCUMENT', 'DEFENSE']),
    title: z.string(), description: z.string(),
  })),
});
const taskListSchema: z.ZodType<TaskList> = z.strictObject({ items: z.array(taskSchema) });
function taskUrl(taskId?: string) {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');
  return `${base}/tasks${taskId === undefined ? '' : `/${encodeURIComponent(taskId)}`}`;
}
export function getTasks(signal?: AbortSignal) { return apiFetch(taskUrl(), taskListSchema, { signal }); }
export function getTask(taskId: string, signal?: AbortSignal) { return apiFetch(taskUrl(taskId), taskSchema, { signal }); }
