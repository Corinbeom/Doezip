import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { exchange, oauth, create } = vi.hoisted(() => ({ exchange: vi.fn(), oauth: vi.fn(), create: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: create }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://auth.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  create.mockReturnValue({ auth: { exchangeCodeForSession: exchange, signInWithOAuth: oauth } });
  window.history.replaceState(null, '', '/auth/callback');
});
afterEach(() => vi.unstubAllEnvs());
it('allows only known task/coding lists and workspace UUID details as return paths', async () => {
  const { safeReturnPath } = await import('./session');
  for (const value of ['https://evil.test', '//evil.test', '/tasks?next=evil', '/tasks/../auth', '/tasks%2Fevil', '/coding?next=evil', '/coding/../auth', '/coding%2Fevil', '/coding/not-a-uuid']) expect(safeReturnPath(value)).toBe('/learn');
  expect(safeReturnPath('/sessions/61111111-1111-4111-8111-111111111111')).toBe('/sessions/61111111-1111-4111-8111-111111111111');
  expect(safeReturnPath('/sessions')).toBe('/learn');
  expect(safeReturnPath('/coding')).toBe('/coding');
  expect(safeReturnPath('/learn')).toBe('/learn');
  expect(safeReturnPath('/learn/61111111-1111-4111-8111-111111111111')).toBe('/learn/61111111-1111-4111-8111-111111111111');
  expect(safeReturnPath('/learn/../auth')).toBe('/learn');
  expect(safeReturnPath('/coding/61111111-1111-4111-8111-111111111111')).toBe('/coding/61111111-1111-4111-8111-111111111111');
  expect(safeReturnPath('/tasks/61111111-1111-4111-8111-111111111111')).toBe('/tasks/61111111-1111-4111-8111-111111111111');
});
it('does not initialize an SDK client without configuration', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  expect((await import('./session')).getAuthClient()).toBeNull(); expect(create).not.toHaveBeenCalled();
});
it('exchanges once and removes callback secrets from the URL immediately', async () => {
  window.history.replaceState(null, '', '/auth/callback?code=private-code');
  exchange.mockResolvedValue({ data: { session: {} }, error: null });
  const { exchangeCallback } = await import('./session');
  const first = exchangeCallback(); const second = exchangeCallback();
  expect(first).toBe(second); expect(window.location.search).toBe('');
  await first; expect(exchange).toHaveBeenCalledTimes(1);
});
it('rejects cancelled or missing-code callbacks without accepting a cached session', async () => {
  window.history.replaceState(null, '', '/auth/callback?error=access_denied&error_description=secret');
  await expect((await import('./session')).exchangeCallback()).rejects.toThrow('LOGIN_CALLBACK_FAILED');
  expect(exchange).not.toHaveBeenCalled(); expect(window.location.search).toBe('');
});
it('rejects a failed code exchange', async () => {
  window.history.replaceState(null, '', '/auth/callback?code=invalid');
  exchange.mockResolvedValue({ data: { session: null }, error: { message: 'secret' } });
  await expect((await import('./session')).exchangeCallback()).rejects.toThrow('LOGIN_CALLBACK_FAILED');
});
it('starts Google with same-origin callback and sanitized destination', async () => {
  oauth.mockResolvedValue({ error: null });
  const { startGoogleLogin, returnPathKey } = await import('./session');
  await startGoogleLogin('//evil.test');
  expect(sessionStorage.getItem(returnPathKey)).toBe('/learn');
  expect(oauth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } });
});
it('treats malformed or unsafe provider configuration as unavailable', async () => {
  const { authConfigured } = await import('./session');
  for (const value of ['not-a-url', 'http://auth.example.test', 'https://user:pass@auth.example.test', 'https://auth.example.test/other']) {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', value); expect(authConfigured()).toBe(false);
  }
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://auth.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_do-not-use'); expect(authConfigured()).toBe(false);
});
