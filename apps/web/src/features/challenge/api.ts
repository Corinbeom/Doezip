import { z } from 'zod';
import type { components } from '@/generated/api-types';
import { authenticatedFetch } from '@/shared/api/authenticated';
export type ChallengeRun = components['schemas']['ChallengeRun'];
export const noticeVersion='challenge-notice-v1' as const;
export type ReviewInput=components['schemas']['ReviewInput'];
const evidenceSchema=z.strictObject({id:z.uuid(),materialId:z.uuid(),lineStart:z.number().int().positive(),lineEnd:z.number().int().positive(),quotedText:z.string(),relation:z.enum(['SUPPORTS','CONTRADICTS','CONTEXT']),origin:z.enum(['USER','AI']),reviewStatus:z.enum(['PROPOSED','ACCEPTED','REJECTED']),userNote:z.string().nullable()});
const reviewSchema=z.strictObject({id:z.uuid(),statementId:z.uuid(),decision:z.enum(['KEEP','CORRECT','INSUFFICIENT_EVIDENCE']),reasonText:z.string(),replacementText:z.string().nullable(),evidence:z.array(evidenceSchema)});
const runSchema:z.ZodType<ChallengeRun>=z.strictObject({
 id:z.uuid(),sessionId:z.uuid(),title:z.string(),instructionsMarkdown:z.string(),noticeVersion:z.string(),
 status:z.enum(['IN_PROGRESS','SUBMITTED']),lockVersion:z.number().int().nonnegative(),
 statements:z.array(z.strictObject({id:z.uuid(),statementKey:z.string(),order:z.number().int().positive(),text:z.string()})),
 reviews:z.array(reviewSchema),submittedAt:z.iso.datetime({offset:true}).nullable(),
});
export const getChallenge=(id:string,signal?:AbortSignal)=>authenticatedFetch(`/challenge-runs/${id}`,runSchema,{signal});
export const startChallenge=(sessionId:string,signal?:AbortSignal)=>{
 const body:components['schemas']['NoticeRequest']={noticeVersion,acknowledged:true};
 return authenticatedFetch(`/sessions/${sessionId}/challenge`,runSchema,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
};

export const saveReviews=(id:string,reviews:ReviewInput[],expectedLockVersion:number,signal?:AbortSignal)=>authenticatedFetch(`/challenge-runs/${id}/reviews`,runSchema,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviews,expectedLockVersion}),signal});
export const submitChallenge=(id:string,expectedLockVersion:number,signal?:AbortSignal)=>authenticatedFetch(`/challenge-runs/${id}/submit`,runSchema,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedLockVersion}),signal});
