import {z} from 'zod';
import type {components} from '@/generated/api-types';
import {apiFetch} from './client';

export type LearningTask=components['schemas']['FlowTask'];
export const learningTaskSchema:z.ZodType<LearningTask>=z.strictObject({
  catalogId:z.string().min(1),version:z.string().min(1),kind:z.enum(['REPORT','CODING']),
  difficulty:z.string().min(1),estimatedMinutes:z.number().int().positive(),tags:z.array(z.string().min(1)),
  title:z.string(),situation:z.string(),requirements:z.array(z.string()),deliverable:z.string(),
  questions:z.array(z.string()),hints:z.array(z.string()),
});

function url(){const base=(process.env.NEXT_PUBLIC_API_BASE_URL??'http://localhost:8080/api/v1').replace(/\/$/,'');return `${base}/learning-flows/catalog`;}
export function getLearningCatalog(signal?:AbortSignal){return apiFetch(url(),z.array(learningTaskSchema),{signal});}
