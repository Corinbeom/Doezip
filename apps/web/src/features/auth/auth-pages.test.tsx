import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CallbackPage, LoginPage } from './auth-pages';
const { configured, start, exchange, reconnect,acceptPolicies,logout,authState } = vi.hoisted(() => ({ configured: vi.fn(), start: vi.fn(), exchange: vi.fn(), reconnect: vi.fn(),acceptPolicies:vi.fn(),logout:vi.fn(),authState:{status:'anonymous',user:null} as {status:string;user:null|{id:string;displayName:string;email:null;legalAccepted:boolean}} }));
vi.mock('@/shared/auth/session', () => ({ authConfigured: configured, startGoogleLogin: start, exchangeCallback: exchange, safeReturnPath: () => '/tasks', returnPathKey: 'test-return' }));
vi.mock('@/shared/auth/auth-provider', () => ({ useAuth: () => ({ ...authState, reconnect,acceptPolicies,logout }) }));
afterEach(() => {vi.clearAllMocks();authState.status='anonymous';authState.user=null;});
it('explains missing provider setup and disables login', () => {
  configured.mockReturnValue(false); render(<LoginPage />);
  expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('로그인 서비스 설정을 준비 중');
});
it('requires all current policies before an existing account can continue',()=>{
  configured.mockReturnValue(true);authState.status='legal_required';authState.user={id:'user',displayName:'학습자',email:null,legalAccepted:false};render(<LoginPage/>);const button=screen.getByRole('button',{name:'동의하고 계속하기'});expect(button).toBeDisabled();for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox);expect(button).toBeEnabled();expect(screen.getAllByRole('link',{name:'개인정보 처리방침'}).some(link=>link.getAttribute('target')==='_blank')).toBe(true);
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
