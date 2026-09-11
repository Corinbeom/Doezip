import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
export function authConfigured() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
      && /^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '');
  } catch { return false; }
}
export function getAuthClient() {
  if (typeof window === 'undefined' || !authConfigured()) return null;
  // Browser-only PKCE. The SDK persists/refreshes the session in browser storage.
  // OAuth callback exchange is explicit so errors cannot be mistaken for a cached login.
  return client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
  });
}
export function safeReturnPath(value: string | null | undefined) {
  return value && /^\/(?:tasks|(?:tasks|sessions)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value) ? value : '/tasks';
}
export const returnPathKey = 'doezip.auth.return';
let callbackOperation: Promise<void> | undefined;
export function exchangeCallback() {
  // Shared promise covers Strict Mode effect replay and route remounts; never re-use a code.
  if (callbackOperation) return callbackOperation;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const denied = params.has('error');
  window.history.replaceState(null, '', window.location.pathname);
  callbackOperation = (async () => {
    if (denied || !code) throw new Error('LOGIN_CALLBACK_FAILED');
    const auth = getAuthClient();
    if (!auth) throw new Error('LOGIN_NOT_CONFIGURED');
    const { error, data } = await auth.auth.exchangeCodeForSession(code);
    if (error || !data.session) throw new Error('LOGIN_CALLBACK_FAILED');
  })();
  return callbackOperation;
}
export async function startGoogleLogin(returnTo: string) {
  const client = getAuthClient();
  if (!client) throw new Error('LOGIN_NOT_CONFIGURED');
  callbackOperation = undefined;
  window.sessionStorage.setItem(returnPathKey, safeReturnPath(returnTo));
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
  if (error) throw new Error('LOGIN_START_FAILED');
}
