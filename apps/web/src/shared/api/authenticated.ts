import { z } from 'zod';
import { ApiError, apiFetch } from './client';
import { getAuthClient } from '@/shared/auth/session';
import type { components } from '@/generated/api-types';

const invalidationListeners = new Set<() => void>();
export function onAuthenticationInvalidated(listener: () => void) {
  invalidationListeners.add(listener);
  return () => { invalidationListeners.delete(listener); };
}
async function authorize(path: string, options: RequestInit = {}) {
  // Only relative product API paths are accepted. Never send a bearer token to an arbitrary URL.
  if (!/^\/[a-z][a-z0-9/\-]*$/i.test(path)) throw new Error('Invalid API path');
  const client = getAuthClient();
  const session = client ? await client.auth.getSession() : null;
  if (!session?.data.session || session.error) {
    invalidationListeners.forEach((listener) => listener());
    throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.data.session.access_token}`);
  return {url:`${base}${path}`,options:{...options,headers}};
}
function invalidated(error:unknown){if(error instanceof ApiError&&error.status===401)invalidationListeners.forEach(listener=>listener());}
export async function authenticatedFetch<T>(path:string,schema:z.ZodType<T>,options:RequestInit={}) {
 const request=await authorize(path,options);
 try{return await apiFetch(request.url,schema,request.options);}catch(error){invalidated(error);throw error;}
}
/** Authenticated streaming uses the same trusted API origin and 401 invalidation as JSON. */
export async function authenticatedStream(path:string,options:RequestInit):Promise<Response>{
 const request=await authorize(path,options);
 try{
  const timeout=AbortSignal.timeout(90000);const signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  const response=await fetch(request.url,{...request.options,signal,cache:'no-store'});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new ApiError(response.status,typeof body?.code==='string'?body.code:'HTTP_ERROR',typeof body?.message==='string'?body.message:'대화 요청에 실패했습니다.');}
  if(!response.headers.get('content-type')?.startsWith('text/event-stream')||!response.body)throw new ApiError(0,'INVALID_RESPONSE','대화 응답 형식을 확인할 수 없습니다.');
  return response;
 }catch(error){invalidated(error);throw error;}
}
export type User = components['schemas']['User'];
const userSchema: z.ZodType<User> = z.strictObject({ id: z.uuid(), displayName: z.string(), email: z.email().nullable(), legalAccepted:z.boolean() });
export async function connectUser(signal?: AbortSignal) {
  await authenticatedFetch('/me/bootstrap', userSchema, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal });
  return authenticatedFetch('/me', userSchema, { signal });
}
export function acceptLegalPolicies(body:components['schemas']['LegalAcceptanceRequest'],signal?:AbortSignal){
 return authenticatedFetch('/me/legal-acceptance',userSchema,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
}
export async function deleteCurrentUser(signal?:AbortSignal){
 const request=await authorize('/me',{method:'DELETE',signal});
 let response:Response;
 try{const timeout=AbortSignal.timeout(15000);response=await fetch(request.url,{...request.options,signal:signal?AbortSignal.any([signal,timeout]):timeout,cache:'no-store'});}catch{throw new ApiError(0,'NETWORK_ERROR','API에 연결할 수 없습니다.');}
 if(response.status===204)return;
 const body=await response.json().catch(()=>null);
 if(response.status===401)invalidationListeners.forEach(listener=>listener());
 throw new ApiError(response.status,typeof body?.code==='string'?body.code:'HTTP_ERROR',typeof body?.message==='string'?body.message:'계정을 삭제하지 못했습니다.',typeof body?.requestId==='string'?body.requestId:undefined);
}
