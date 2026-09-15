import {z} from 'zod';
import type {components} from '@/generated/api-types';
import {authenticatedFetch} from '@/shared/api/authenticated';
export type Flow=components['schemas']['LearningFlow'];
export type Notes=components['schemas']['FlowNotes'];
export type Task=components['schemas']['FlowTask'];
const task=z.object({kind:z.string(),title:z.string(),situation:z.string(),requirements:z.array(z.string()),deliverable:z.string(),questions:z.array(z.string()),hints:z.array(z.string())});
const notes=z.object({explanation:z.string(),verification:z.string(),citations:z.array(z.object({materialId:z.string(),lineStart:z.number(),lineEnd:z.number()}))});
const record=z.object({id:z.string(),label:z.string(),text:z.string()});
const snapshot=z.object({artifact:z.string(),records:z.array(record),notes,citations:z.array(z.object({materialId:z.string(),lineStart:z.number(),lineEnd:z.number(),quote:z.string()})),artifactVersion:z.number(),artifactHash:z.string(),flowVersion:z.number(),task,mode:z.string(),hints:z.array(z.object({index:z.number(),text:z.string()})),cutoff:z.string(),publicRun:z.object({version:z.number(),suite:z.literal('duplicate-items-v1'),results:z.array(z.object({name:z.string(),passed:z.boolean(),detail:z.string()}))}).optional()});
export const flowSchema:z.ZodType<Flow>=z.object({id:z.uuid(),kind:z.enum(['REPORT','CODING']),mode:z.enum(['TRAINING','SIMULATION']),flowVersion:z.string(),sessionId:z.uuid().nullable(),codingId:z.uuid().nullable(),parentId:z.uuid().nullable(),stage:z.enum(['WORKING','EXPLAIN','FEEDBACK']),version:z.number(),notes,hints:z.array(z.object({index:z.number(),text:z.string()})),snapshot:snapshot.nullable(),answers:z.object({decision:z.string(),change:z.string()}).nullable(),feedback:z.object({practiceArea:z.enum(['REQUEST','VERIFY','IMPROVE','EXPLAIN']),items:z.array(z.object({area:z.enum(['REQUEST','VERIFY','IMPROVE','EXPLAIN']),observation:z.string(),nextAction:z.string(),recordIds:z.array(z.string()),sources:z.array(record)}))}).nullable(),feedbackStatus:z.enum(['READY','RUNNING','FAILED','SUCCEEDED']),task,comparison:z.array(z.object({label:z.string(),previousArtifact:z.string(),currentArtifact:z.string(),changed:z.boolean(),previousVerification:notes,currentVerification:notes}))});
export const getFlow=(id:string,signal?:AbortSignal)=>authenticatedFetch(`/learning-flows/${id}`,flowSchema,{signal});
export const listFlows=(signal?:AbortSignal)=>authenticatedFetch('/learning-flows',z.array(flowSchema),{signal});
export const catalog=(signal?:AbortSignal)=>authenticatedFetch('/learning-flows/catalog',z.array(task),{signal});
export function changeFlow(path:string,body:unknown={},method='POST',signal?:AbortSignal){return authenticatedFetch(`/learning-flows${path}`,flowSchema,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});}
