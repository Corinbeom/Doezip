import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch } from './client';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
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

// Model a transport that only settles when its actual request signal aborts.
function abortableTransport() {
  const transport = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const signal = options.signal!;
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  vi.stubGlobal('fetch', transport);
  return transport;
}
it('retains the ten-second timeout even when the caller supplies cancellation', async () => {
  const timeout = new AbortController();
  const caller = new AbortController();
  const timeoutFactory = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
  abortableTransport();
  const request = apiFetch('http://localhost/test', z.object({}), { signal: caller.signal });
  const assertion = expect(request).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  timeout.abort(new DOMException('Timed out', 'TimeoutError'));
  await assertion;
  expect(timeoutFactory).toHaveBeenCalledWith(10000);
  expect(caller.signal.aborted).toBe(false);
});
it('still cancels transport immediately when the caller aborts before the timeout', async () => {
  const timeout = new AbortController();
  const caller = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
  const transport = abortableTransport();
  const request = apiFetch('http://localhost/test', z.object({}), { signal: caller.signal });
  const assertion = expect(request).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  caller.abort();
  await assertion;
  expect(transport.mock.calls[0][1].signal?.aborted).toBe(true);
  expect(timeout.signal.aborted).toBe(false);
});
