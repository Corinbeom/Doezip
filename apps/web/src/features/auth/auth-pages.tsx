'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LearningShell } from '@/shared/ui/learning-shell';
import { useAuth } from '@/shared/auth/auth-provider';
import { authConfigured, exchangeCallback, returnPathKey, safeReturnPath, startGoogleLogin } from '@/shared/auth/session';
import styles from './auth.module.css';

export function LoginPage() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [agreements,setAgreements]=useState({terms:false,privacy:false,ai:false});
  async function login() {
    setBusy(true); setFailed(false);
    try { await startGoogleLogin(safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))); }
    catch { setFailed(true); setBusy(false); }
  }
  async function accept(){setBusy(true);setFailed(false);if(await auth.acceptPolicies()){window.location.replace(safeReturnPath(new URLSearchParams(window.location.search).get('returnTo')));return;}setFailed(true);setBusy(false);}
  return <LearningShell><section className={styles.card} aria-labelledby="login-title">
    <p className={styles.eyebrow}>나의 판단을 쌓는 연습</p>
    <h1 id="login-title">되짚에 오신 것을 환영해요</h1>
    <p>Google 계정으로 로그인하고 나만의 학습을 준비하세요.</p>
    {!authConfigured() && <p role="status" className={styles.notice}>로그인 서비스 설정을 준비 중입니다. 과제는 로그인 없이 둘러볼 수 있어요.</p>}
    {(failed || auth.status === 'error') && <p role="alert" className={styles.notice}>로그인을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
    {auth.status === 'connected' ? <><p>{auth.user?.displayName}님, 로그인되었습니다.</p><Link href="/tasks" className={styles.primary}>과제 둘러보기</Link></> : auth.status==='legal_required'?<div className={styles.agreement}><p><strong>{auth.user?.displayName}님, 계속하기 전에 운영 정책을 확인해 주세요.</strong></p><label><input type="checkbox" checked={agreements.terms} onChange={e=>setAgreements(v=>({...v,terms:e.target.checked}))}/><span>만 18세 이상이며 <Link href="/terms" target="_blank">이용약관</Link>에 동의합니다. <b>필수</b></span></label><label><input type="checkbox" checked={agreements.privacy} onChange={e=>setAgreements(v=>({...v,privacy:e.target.checked}))}/><span><Link href="/privacy" target="_blank">개인정보 처리방침</Link>을 확인했습니다. <b>필수</b></span></label><label><input type="checkbox" checked={agreements.ai} onChange={e=>setAgreements(v=>({...v,ai:e.target.checked}))}/><span><Link href="/ai-policy" target="_blank">AI 이용 및 데이터 안내</Link>를 확인했습니다. <b>필수</b></span></label><button className={styles.primary} disabled={busy||!agreements.terms||!agreements.privacy||!agreements.ai} onClick={()=>void accept()}>{busy?'저장 중…':'동의하고 계속하기'}</button><button className={styles.secondary} disabled={busy} onClick={()=>void auth.logout()}>동의하지 않고 로그아웃</button></div>:<><button className={styles.primary} disabled={!authConfigured() || busy} onClick={() => void login()}>{busy ? 'Google로 이동 중…' : failed ? 'Google 로그인 다시 시도' : 'Google로 계속하기'}</button><p className={styles.legalNote}>로그인 후 <Link href="/terms">이용약관</Link>, <Link href="/privacy">개인정보 처리방침</Link>, <Link href="/ai-policy">AI 이용 안내</Link>를 확인하고 동의하는 단계가 이어집니다. 되짚은 만 18세 이상 이용자를 위한 서비스입니다.</p></>}
    <Link className={styles.back} href="/tasks">로그인 없이 과제 둘러보기</Link>
  </section></LearningShell>;
}

export function CallbackPage() {
  const { reconnect } = useAuth();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void exchangeCallback().then(async () => {
      if (!active) return;
      const status=await reconnect();if(!status) throw new Error('USER_CONNECTION_FAILED');
      if (active) {
        const path = safeReturnPath(window.sessionStorage.getItem(returnPathKey));
        window.sessionStorage.removeItem(returnPathKey);
        window.location.replace(status==='legal_required'?`/login?returnTo=${encodeURIComponent(path)}`:path);
      }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [reconnect]);
  return <LearningShell><section className={styles.card}><h1>로그인 연결</h1>
    {failed ? <><p role="alert">로그인이 취소되었거나 연결하지 못했습니다. 다시 로그인해 주세요.</p><Link className={styles.primary} href="/login">로그인 다시 시도</Link><Link className={styles.back} href="/tasks">과제 둘러보기</Link></> : <p role="status">로그인 정보를 확인하고 있습니다.</p>}
  </section></LearningShell>;
}
