import {z} from 'zod';
import {authenticatedFetch} from '@/shared/api/authenticated';
import type {components} from '@/generated/api-types';
export type Workspace=components['schemas']['CodingWorkspace'];
export type Turn=components['schemas']['CodingTurn'];
const result=z.object({name:z.string(),passed:z.boolean(),detail:z.string()});
const suite=z.enum(['duplicate-items-v1','duplicate-items-v2','retry-policy-v1']);
export const workspaceSchema: z.ZodType<Workspace>=z.object({id:z.uuid(),taskVersion:suite,code:z.string(),version:z.number().int().nonnegative(),submittedAt:z.string().nullable(),explanation:z.string().nullable(),lastRun:z.object({version:z.number(),suite,results:z.array(result)}).nullable(),turns:z.array(z.object({id:z.uuid(),requestKey:z.uuid(),baseVersion:z.number(),baseCode:z.string(),instruction:z.string(),status:z.enum(['RUNNING','SUCCEEDED','FAILED']),explanation:z.string().nullable(),proposedCode:z.string().nullable()}))});
export const listWorkspaces=(signal?:AbortSignal)=>authenticatedFetch('/coding-workspaces',z.array(z.uuid()),{signal});
export const getWorkspace=(id:string,signal?:AbortSignal)=>authenticatedFetch(`/coding-workspaces/${id}`,workspaceSchema,{signal});
export function mutate(path:string,method:string,body:unknown,signal?:AbortSignal){return authenticatedFetch(`/coding-workspaces${path}`,workspaceSchema,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});}
