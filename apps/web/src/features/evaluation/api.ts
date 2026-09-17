import {z} from 'zod';
import type {components} from '@/generated/api-types';
import {authenticatedFetch} from '@/shared/api/authenticated';
export type Evaluation=components['schemas']['Evaluation'];
const schema:z.ZodType<Evaluation>=z.strictObject({id:z.uuid(),sessionId:z.uuid(),phase:z.enum(['INITIAL','FINAL']),status:z.enum(['QUEUED','RUNNING','SUCCEEDED','FAILED']),reportId:z.uuid().nullable(),errorCode:z.string().nullable(),retryable:z.boolean(),pollAfterMs:z.number().int().min(1000),createdAt:z.iso.datetime({offset:true})});
export const getEvaluation=(id:string,signal?:AbortSignal)=>authenticatedFetch(`/evaluations/${id}`,schema,{signal});
export const requestEvaluation=(sessionId:string,documentVersionId:string,key:string,signal?:AbortSignal)=>authenticatedFetch(`/sessions/${sessionId}/evaluations`,schema,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({phase:'INITIAL',documentVersionId}),signal});
export const retryEvaluation=(id:string,signal?:AbortSignal)=>authenticatedFetch(`/evaluations/${id}/retry`,schema,{method:'POST',signal});
