import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { authenticatedFetch, authenticatedStream, connectUser, deleteCurrentUser, onAuthenticationInvalidated } from './authenticated';
const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('@/shared/auth/session', () => ({ getAuthClient: () => ({ auth: { getSession: session } }) }));
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8080/api/v1'));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('gets the current token for each API request and invalidates a rejected login without retry', async () => {
  session.mockResolvedValue({ data: { session: { access_token: 'sdk-token' } }, error: null });
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 })); vi.stubGlobal('fetch', fetcher);
  const invalidate = vi.fn(); const unsubscribe = onAuthenticationInvalidated(invalidate);
  await expect(authenticatedFetch('/me', z.object({}))).rejects.toMatchObject({ status: 401 });
  expect(fetcher).toHaveBeenCalledTimes(1); expect(invalidate).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer sdk-token'); unsubscribe();
});
it('never attaches credentials to arbitrary destinations', async () => {
  await expect(authenticatedFetch('https://evil.test', z.object({}))).rejects.toThrow('Invalid API path');
  expect(session).not.toHaveBeenCalled();
});
it('bootstraps then reads the contract user and sends no client-owned user ID', async () => {
  const user = { id: '61111111-1111-4111-8111-111111111111', displayName: '테스트 사용자', email: null, legalAccepted:false };
  session.mockResolvedValue({ data: { session: { access_token: 'sdk-token' } }, error: null });
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(user))); vi.stubGlobal('fetch', fetcher);
  expect(await connectUser()).toEqual(user);
  expect(fetcher.mock.calls.map(call => call[0])).toEqual(['http://localhost:8080/api/v1/me/bootstrap', 'http://localhost:8080/api/v1/me']);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{}' });
});
it('records only the published legal policy versions for the current account',async()=>{
  const user={id:'61111111-1111-4111-8111-111111111111',displayName:'테스트 사용자',email:null,legalAccepted:true};
  session.mockResolvedValue({data:{session:{access_token:'sdk-token'}},error:null});const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(user)));vi.stubGlobal('fetch',fetcher);
  const {acceptLegalPolicies}=await import('./authenticated');
  await expect(acceptLegalPolicies({termsVersion:'2026-09-21',privacyVersion:'2026-09-21',aiNoticeVersion:'2026-09-21'})).resolves.toEqual(user);
  expect(fetcher.mock.calls[0][0]).toBe('http://localhost:8080/api/v1/me/legal-acceptance');expect(fetcher.mock.calls[0][1]).toMatchObject({method:'PUT'});
});
it('deletes only the current authenticated account and accepts the empty response',async()=>{
  session.mockResolvedValue({data:{session:{access_token:'sdk-token'}},error:null});
  const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetcher);
  await expect(deleteCurrentUser()).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0][0]).toBe('http://localhost:8080/api/v1/me');
  expect(fetcher.mock.calls[0][1]).toMatchObject({method:'DELETE',cache:'no-store'});
  expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer sdk-token');
});
it('keeps the safe server message when account deletion fails',async()=>{
  session.mockResolvedValue({data:{session:{access_token:'sdk-token'}},error:null});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({code:'ACCOUNT_DELETION_UNAVAILABLE',message:'데이터는 유지되었습니다.',requestId:'request-1'}),{status:503})));
  await expect(deleteCurrentUser()).rejects.toMatchObject({status:503,code:'ACCOUNT_DELETION_UNAVAILABLE',message:'데이터는 유지되었습니다.'});
});
it('does not report bootstrap failure as a connected account', async () => {
  session.mockResolvedValue({ data: { session: { access_token: 'sdk-token' } }, error: null });
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 })); vi.stubGlobal('fetch', fetcher);
  await expect(connectUser()).rejects.toMatchObject({ status: 503 }); expect(fetcher).toHaveBeenCalledOnce();
});

it('streams only to the trusted API and invalidates rejected authentication without retry',async()=>{
 session.mockResolvedValue({data:{session:{access_token:'sdk-token'}},error:null});
 const fetcher=vi.fn().mockResolvedValue(new Response('{"code":"UNAUTHORIZED","message":"로그인 필요"}',{status:401}));vi.stubGlobal('fetch',fetcher);
 const invalidated=vi.fn();const off=onAuthenticationInvalidated(invalidated);
 await expect(authenticatedStream('/sessions/abc/messages',{method:'POST'})).rejects.toMatchObject({status:401});expect(invalidated).toHaveBeenCalledOnce();expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
 await expect(authenticatedStream('https://evil.test',{})).rejects.toThrow('Invalid API path');expect(fetcher).toHaveBeenCalledOnce();off();
});
