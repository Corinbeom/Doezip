import { z } from 'zod';
import type { components } from '@/generated/api-types';
import { authenticatedFetch } from '@/shared/api/authenticated';
import { taskSchema } from '@/features/tasks/api';
export type Workspace = components['schemas']['Workspace'];
export type Draft = components['schemas']['Draft'];
const materialSummary = z.strictObject({ id: z.uuid(), title: z.string(), type: z.enum(['ARCHITECTURE','LOG','METRIC','DEPLOYMENT','EXTERNAL_SERVICE','CUSTOMER_NOTE']), sortOrder: z.number().int() });
export const draftSchema: z.ZodType<Draft> = z.strictObject({ markdown: z.string(), lockVersion: z.number().int().nonnegative(), contentHash: z.string() });
const workspaceSchema: z.ZodType<Workspace> = z.strictObject({
  session: z.strictObject({ id:z.uuid(), taskId:z.uuid(), status:z.enum(['ACTIVE','COMPLETED','ABANDONED']), currentStep:z.enum(['WRITING','CHALLENGE','FEEDBACK','FOLLOW_UP','CONDITION_CHANGE','FINAL_REVIEW','DONE']), mode:z.literal('PRACTICE'), conditionReleasedAt:z.string().nullable(), allowedActions:z.array(z.enum(['READ_MATERIALS','WRITE_DRAFT','SEND_MESSAGE','SNAPSHOT_INITIAL','START_CHALLENGE','EDIT_CHALLENGE','SUBMIT_CHALLENGE','REQUEST_INITIAL_EVALUATION','READ_INITIAL_REPORT','START_FOLLOW_UPS','ANSWER_FOLLOW_UPS','REVEAL_CONDITION','SNAPSHOT_FINAL','ANSWER_CONDITION','REQUEST_FINAL_EVALUATION','READ_FINAL_REPORT','RETRY_EVALUATION'])) }),
  task:taskSchema, materials:z.array(materialSummary), draft:draftSchema, challengeRunId:z.uuid().nullable(), initialReportId:z.uuid().nullable(), finalReportId:z.uuid().nullable(), activeEvaluationId:z.uuid().nullable(),
});
const materialSchema: z.ZodType<components['schemas']['Material']> = materialSummary.extend({ contentMarkdown:z.string(), contentHash:z.string(), lines:z.array(z.strictObject({ number:z.number().int().positive(), text:z.string() })) });
export const createSession = (taskId:string, signal?:AbortSignal) => authenticatedFetch('/sessions', workspaceSchema, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId}),signal});
export const getWorkspace = (id:string, signal?:AbortSignal) => authenticatedFetch(`/sessions/${id}/workspace`,workspaceSchema,{signal});
export const getMaterial = (id:string, materialId:string, signal?:AbortSignal) => authenticatedFetch(`/sessions/${id}/materials/${materialId}`,materialSchema,{signal});
export const saveDraft = (id:string, markdown:string, expectedLockVersion:number, signal?:AbortSignal) => authenticatedFetch(`/sessions/${id}/draft`,draftSchema,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({markdown,expectedLockVersion}),signal});
