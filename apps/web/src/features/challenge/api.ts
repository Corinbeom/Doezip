import { z } from 'zod';
import type { components } from '@/generated/api-types';
import { authenticatedFetch } from '@/shared/api/authenticated';
export type ChallengeRun = components['schemas']['ChallengeRun'];
export const noticeVersion='challenge-notice-v1' as const;
// F04a has no review writing endpoint. Reject an unexpected populated review response.
const runSchema:z.ZodType<ChallengeRun>=z.strictObject({
 id:z.uuid(),sessionId:z.uuid(),title:z.string(),instructionsMarkdown:z.string(),noticeVersion:z.string(),
 status:z.enum(['IN_PROGRESS','SUBMITTED']),lockVersion:z.number().int().nonnegative(),
 statements:z.array(z.strictObject({id:z.uuid(),statementKey:z.string(),order:z.number().int().positive(),text:z.string()})),
 reviews:z.array(z.never()),submittedAt:z.iso.datetime({offset:true}).nullable(),
});
export const getChallenge=(id:string,signal?:AbortSignal)=>authenticatedFetch(`/challenge-runs/${id}`,runSchema,{signal});
export const startChallenge=(sessionId:string,signal?:AbortSignal)=>{
 const body:components['schemas']['NoticeRequest']={noticeVersion,acknowledged:true};
 return authenticatedFetch(`/sessions/${sessionId}/challenge`,runSchema,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
};
