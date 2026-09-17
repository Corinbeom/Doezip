import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-provider';
const { getSession, connect, signOut, handlers } = vi.hoisted(() => ({ getSession: vi.fn(), connect: vi.fn(), signOut: vi.fn(), handlers: { event: undefined as undefined | ((event: string, session: unknown) => void), invalid: undefined as undefined | (() => void) } }));
vi.mock('./session', () => ({ getAuthClient: () => ({ auth: { getSession, signOut, onAuthStateChange: (handler: typeof handlers.event) => { handlers.event = handler; return { data: { subscription: { unsubscribe: vi.fn() } } }; } } }) }));
vi.mock('@/shared/api/authenticated', () => ({ connectUser: connect, onAuthenticationInvalidated: (handler: () => void) => { handlers.invalid = handler; return vi.fn(); } }));
function State() { const auth = useAuth(); return <><p>{auth.status}:{auth.user?.displayName}</p>{auth.logoutFailed && <p>logout failed</p>}<button onClick={() => void auth.logout()}>logout</button></>; }
function mount() { const client = new QueryClient(); render(<QueryClientProvider client={client}><AuthProvider><State /></AuthProvider></QueryClientProvider>); return client; }
afterEach(() => { vi.clearAllMocks(); window.history.replaceState(null, '', '/'); });
it('exposes a connected user only after successful API registration and lookup', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'subject-a' } } } });
  connect.mockResolvedValue({ id: 'user-a', displayName: '사용자A', email: null }); mount();
  await screen.findByText('connected:사용자A');
});
it('does not mark a Supabase session connected when product bootstrap fails', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'subject-a' } } } });
  connect.mockRejectedValue(new Error('db offline')); mount(); await screen.findByText('error:');
});
it('cancels in-flight private queries and ignores late user results after signout', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'subject-a' } } } });
  let resolve!: (value: unknown) => void;
  connect.mockReturnValue(new Promise(done => { resolve = done; }));
  const client = mount(); await waitFor(() => expect(connect).toHaveBeenCalled());
  client.setQueryDefaults(['private'], { meta: { private: true } });
  let finishPrivate!: (value: string) => void;
  const pendingPrivate = client.fetchQuery({ queryKey: ['private'], queryFn: () => new Promise<string>(done => { finishPrivate = done; }), meta: { private: true } }).catch(() => undefined);
  client.setQueryData(['tasks'], { public: true });
  act(() => handlers.event?.('SIGNED_OUT', null));
  await act(async () => { resolve({ id: 'old', displayName: '이전사용자', email: null }); finishPrivate('old private data'); await pendingPrivate; });
  expect(screen.getByText('anonymous:')).toBeInTheDocument();
  expect(client.getQueryData(['private'])).toBeUndefined(); expect(client.getQueryData(['tasks'])).toEqual({ public: true });
});
it('does not bootstrap a cached session on the OAuth callback route', async () => {
  window.history.replaceState(null, '', '/auth/callback?error=access_denied'); mount();
  await act(async () => {}); expect(connect).not.toHaveBeenCalled();
});

it('reports logout failure instead of claiming the retained SDK session is signed out', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'subject-a' } } } });
  connect.mockResolvedValue({ id: 'user-a', displayName: '사용자A', email: null });
  signOut.mockResolvedValue({ error: new Error('offline') }); mount();
  await screen.findByText('connected:사용자A'); fireEvent.click(screen.getByRole('button', { name: 'logout' }));
  await screen.findByText('logout failed'); expect(screen.queryByText('anonymous:')).not.toBeInTheDocument();
});
it('hides private account content immediately while provider logout is pending', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'subject-a' } } } });
  connect.mockResolvedValue({ id: 'user-a', displayName: '사용자A', email: null });
  signOut.mockImplementation(() => new Promise(() => {})); mount();
  await screen.findByText('connected:사용자A'); fireEvent.click(screen.getByRole('button', { name: 'logout' }));
  expect(screen.queryByText('connected:사용자A')).not.toBeInTheDocument();
  expect(screen.getByText('loading:')).toBeInTheDocument();
});
