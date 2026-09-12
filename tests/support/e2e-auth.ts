import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const env = { ...(existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {}), ...process.env };
export const apiBase = `http://localhost:${env.API_PORT ?? '8080'}/api/v1`;
export const sampleTaskId = '61111111-1111-4111-8111-111111111113';
export async function testIdentity(request: APIRequestContext, user: 'alice' | 'bob' = 'alice') {
  const response = await request.get(`http://127.0.0.1:${env.E2E_AUTH_PORT ?? '8799'}/session?user=${user}`);
  if (!response.ok()) throw new Error('Local fixture issuer unavailable');
  const session = await response.json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const bootstrap = await request.post(`${apiBase}/me/bootstrap`, { headers, data: {} });
  if (!bootstrap.ok()) throw new Error(`Real API bootstrap failed: ${bootstrap.status()}`);
  return { session, headers };
}
export async function installTestSession(context: BrowserContext, session: Awaited<ReturnType<typeof testIdentity>>['session']) {
  // Only local test sessions issued by tests/support/auth-server.mjs, never real OAuth tokens.
  await context.addInitScript(value => {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      localStorage.setItem('sb-e2e-auth-auth-token', JSON.stringify(value));
  }, session);
}
export async function createWorkspace(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.post(`${apiBase}/sessions`, { headers, data: { taskId: sampleTaskId } });
  if (response.status() !== 201) throw new Error(`Real session creation failed: ${response.status()}`);
  return response.json();
}
