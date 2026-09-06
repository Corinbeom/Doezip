import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/shared/api/query-provider';
import { EnvironmentCheck } from './environment-check';
afterEach(() => vi.unstubAllGlobals());
it('shows loading, failure and a real retry of the API request', async () => {
  let reject!: (reason?: unknown) => void;
  const pending = new Promise<Response>((_, r) => { reject = r; });
  const fetcher = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(new Response('{"status":"UP"}'));
  vi.stubGlobal('fetch', fetcher);
  render(<QueryProvider><EnvironmentCheck /></QueryProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('연결 확인 중');
  expect(screen.getByRole('button')).toBeDisabled();
  reject(new Error('offline'));
  await screen.findByText(/연결 실패/);
  fireEvent.click(screen.getByRole('button', { name: '재시도' }));
  await screen.findByText(/연결 성공/);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
