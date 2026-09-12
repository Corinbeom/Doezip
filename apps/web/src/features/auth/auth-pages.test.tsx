import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CallbackPage, LoginPage } from './auth-pages';
const { configured, start, exchange, reconnect } = vi.hoisted(() => ({ configured: vi.fn(), start: vi.fn(), exchange: vi.fn(), reconnect: vi.fn() }));
vi.mock('@/shared/auth/session', () => ({ authConfigured: configured, startGoogleLogin: start, exchangeCallback: exchange, safeReturnPath: () => '/tasks', returnPathKey: 'test-return' }));
vi.mock('@/shared/auth/auth-provider', () => ({ useAuth: () => ({ status: 'anonymous', user: null, reconnect }) }));
afterEach(() => vi.clearAllMocks());
it('explains missing provider setup and disables login', () => {
  configured.mockReturnValue(false); render(<LoginPage />);
  expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('로그인 서비스 설정을 준비 중');
});
it('shows safe error text and permits a new login attempt', async () => {
  configured.mockReturnValue(true); start.mockRejectedValueOnce(new Error('private-token')); start.mockResolvedValueOnce(undefined);
  render(<LoginPage />); fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private-token');
  fireEvent.click(screen.getByRole('button', { name: 'Google 로그인 다시 시도' })); expect(start).toHaveBeenCalledTimes(2);
});
it('does not bootstrap after a cancelled OAuth callback', async () => {
  exchange.mockRejectedValue(new Error('access_denied')); render(<CallbackPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('취소되었거나'); expect(reconnect).not.toHaveBeenCalled();
});
it('keeps callback failed when the product user cannot be connected', async () => {
  exchange.mockResolvedValue(undefined); reconnect.mockResolvedValue(false); render(<CallbackPage />);
  await screen.findByRole('alert'); expect(reconnect).toHaveBeenCalledOnce();
});
