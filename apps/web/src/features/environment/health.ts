import { z } from 'zod';
import { apiFetch } from '@/shared/api/client';
const healthSchema = z.object({ status: z.literal('UP') });
export function getHealth(signal?: AbortSignal) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1';
  return apiFetch(new URL('/actuator/health', base).toString(), healthSchema, { signal });
}
