'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { acceptLegalPolicies, connectUser, deleteCurrentUser, onAuthenticationInvalidated, type User } from '@/shared/api/authenticated';
import { legalPolicy } from '@/shared/legal/policy';
import { getAuthClient } from './session';

type ConnectedStatus='connected'|'legal_required';
type State = { status: 'loading' | 'anonymous' | ConnectedStatus | 'error'; user: User | null; logoutFailed?: boolean };
type AuthContextValue = State & { reconnect: () => Promise<ConnectedStatus|false>; acceptPolicies:()=>Promise<boolean>; logout: () => Promise<void>; deleteAccount:()=>Promise<void> };
const AuthContext = createContext<AuthContextValue>({ status: 'anonymous', user: null, reconnect: async () => false, acceptPolicies:async()=>false, logout: async () => {},deleteAccount:async()=>{} });
export function useAuth() { return useContext(AuthContext); }
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ status: 'loading', user: null });
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const subject = useRef<string | null>(null);
  const clearPrivate = useCallback(() => {
    generation.current++;
    request.current?.abort();
    // Cancel before removal: late results from the previous account cannot refill its cache.
    void queryClient.cancelQueries({ predicate: (query) => query.meta?.private === true });
    queryClient.removeQueries({ predicate: (query) => query.meta?.private === true });
  }, [queryClient]);
  const reconnect = useCallback(async () => {
    const auth = getAuthClient();
    if (!auth) { setState({ status: 'anonymous', user: null }); return false; }
    clearPrivate();
    const current = generation.current;
    const controller = new AbortController(); request.current = controller;
    setState({ status: 'loading', user: null });
    try {
      const session = await auth.auth.getSession();
      if (current !== generation.current) return false;
      if (session.error || !session.data.session) { setState({ status: 'anonymous', user: null }); return false; }
      subject.current = session.data.session.user.id;
      const user = await connectUser(controller.signal);
      if (current !== generation.current) return false;
      const status=user.legalAccepted?'connected':'legal_required';
      setState({ status, user });
      return status;
    } catch {
      if (current === generation.current) setState({ status: 'error', user: null });
      return false;
    }
  }, [clearPrivate]);
  const acceptPolicies=useCallback(async()=>{
    try{
      const user=await acceptLegalPolicies({termsVersion:legalPolicy.termsVersion,privacyVersion:legalPolicy.privacyVersion,aiNoticeVersion:legalPolicy.aiNoticeVersion});
      setState({status:'connected',user});return true;
    }catch{return false;}
  },[]);
  const logout = useCallback(async () => {
    clearPrivate(); subject.current = null;
    // Unmount sensitive editors before awaiting the provider's logout request.
    setState({ status: 'loading', user: null });
    try {
      const result = await getAuthClient()?.auth.signOut({ scope: 'local' });
      if (result?.error) throw new Error('LOGOUT_FAILED');
      setState({ status: 'anonymous', user: null });
    } catch { setState({ status: 'error', user: null, logoutFailed: true }); }
  }, [clearPrivate]);
  const deleteAccount=useCallback(async()=>{
    await deleteCurrentUser();
    clearPrivate();subject.current=null;setState({status:'loading',user:null});
    // The server has already removed the identity. Always remove the local SDK session,
    // even if the provider can no longer acknowledge sign-out for that deleted user.
    try{await getAuthClient()?.auth.signOut({scope:'local'});}catch{/* The product account is already deleted; do not retain its UI state. */}finally{setState({status:'anonymous',user:null});}
  },[clearPrivate]);
  useEffect(() => {
    const client = getAuthClient();
    // Callback page owns exchange/bootstrap. A cached session must not override a bad callback.
    let active = true;
    queueMicrotask(() => { if (active && window.location.pathname !== '/auth/callback') void reconnect(); });
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { clearPrivate(); subject.current = null; setState({ status: 'anonymous', user: null }); }
      else if (window.location.pathname !== '/auth/callback' && event === 'SIGNED_IN' && session?.user.id !== subject.current) {
        // Never await SDK operations inside its auth callback (SDK lock).
        queueMicrotask(() => { if (active) void reconnect(); });
      }
    });
    const unsubscribe = onAuthenticationInvalidated(() => { clearPrivate(); setState({ status: 'anonymous', user: null }); });
    return () => { active = false; subscription?.data.subscription.unsubscribe(); unsubscribe(); clearPrivate(); };
  }, [clearPrivate, reconnect]);
  return <AuthContext.Provider value={{ ...state, reconnect, acceptPolicies, logout,deleteAccount }}>{children}</AuthContext.Provider>;
}
