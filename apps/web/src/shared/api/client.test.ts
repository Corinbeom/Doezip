import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './client';
afterEach(() => vi.unstubAllGlobals());
describe('common API boundary', () => {
  it('preserves contract error and authentication status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: '인증이 필요합니다.', requestId: 'req-1' }), { status: 401 })));
    await expect(apiFetch('http://localhost/test', z.object({}))).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED', requestId: 'req-1' });
  });
  it('normalizes network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    await expect(apiFetch('http://localhost/test', z.object({}))).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
  it('does not treat DOWN or malformed success as connected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"DOWN"}')));
    await expect(apiFetch('http://localhost/test', z.object({ status: z.literal('UP') }))).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('handles non-JSON upstream failure without exposing raw response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('internal secret detail', { status: 503 })));
    await expect(apiFetch('http://localhost/test', z.object({}))).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 503, message: 'API 요청에 실패했습니다.' });
  });
});
