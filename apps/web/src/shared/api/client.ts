import { z } from 'zod';
import type { components } from '@/generated/api-types';
type ContractError = components['schemas']['Error'];
const errorSchema = z.object({ code: z.string(), message: z.string(), requestId: z.string(), details: z.record(z.string(), z.unknown()).optional() });
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) { super(message); }
}
export async function apiFetch<T>(url: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(10000), cache: 'no-store' }); }
  catch { throw new ApiError(0, 'NETWORK_ERROR', 'API에 연결할 수 없습니다.'); }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    const error: ContractError | undefined = parsed.success ? parsed.data : undefined;
    throw new ApiError(response.status, error?.code ?? 'HTTP_ERROR', error?.message ?? 'API 요청에 실패했습니다.', error?.requestId);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(response.status, 'INVALID_RESPONSE', 'API 응답 형식을 확인할 수 없습니다.');
  return parsed.data;
}
