import { z } from 'zod';
import { ApiError, apiFetch } from './client';
import { getAuthClient } from '@/shared/auth/session';
import type { components } from '@/generated/api-types';

const invalidationListeners = new Set<() => void>();
export function onAuthenticationInvalidated(listener: () => void) {
  invalidationListeners.add(listener);
  return () => { invalidationListeners.delete(listener); };
}
export async function authenticatedFetch<T>(path: string, schema: z.ZodType<T>, options: RequestInit = {}) {
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
  try { return await apiFetch(`${base}${path}`, schema, { ...options, headers }); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) invalidationListeners.forEach((listener) => listener());
    throw error;
  }
}
export type User = components['schemas']['User'];
const userSchema: z.ZodType<User> = z.strictObject({ id: z.uuid(), displayName: z.string(), email: z.email().nullable() });
export async function connectUser(signal?: AbortSignal) {
  await authenticatedFetch('/me/bootstrap', userSchema, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal });
  return authenticatedFetch('/me', userSchema, { signal });
}
