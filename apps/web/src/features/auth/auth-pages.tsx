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
  async function login() {
    setBusy(true); setFailed(false);
    try { await startGoogleLogin(safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))); }
    catch { setFailed(true); setBusy(false); }
  }
  return <LearningShell><section className={styles.card} aria-labelledby="login-title">
    <p className={styles.eyebrow}>나의 판단을 쌓는 연습</p>
    <h1 id="login-title">되짚에 오신 것을 환영해요</h1>
    <p>Google 계정으로 로그인하고 나만의 학습을 준비하세요.</p>
    {!authConfigured() && <p role="status" className={styles.notice}>로그인 서비스 설정을 준비 중입니다. 과제는 로그인 없이 둘러볼 수 있어요.</p>}
    {(failed || auth.status === 'error') && <p role="alert" className={styles.notice}>로그인을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
    {auth.status === 'connected' ? <><p>{auth.user?.displayName}님, 로그인되었습니다.</p><Link href="/tasks" className={styles.primary}>과제 둘러보기</Link></> : <button className={styles.primary} disabled={!authConfigured() || busy} onClick={() => void login()}>{busy ? 'Google로 이동 중…' : failed ? 'Google 로그인 다시 시도' : 'Google로 계속하기'}</button>}
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
      if (!await reconnect()) throw new Error('USER_CONNECTION_FAILED');
      if (active) {
        const path = safeReturnPath(window.sessionStorage.getItem(returnPathKey));
        window.sessionStorage.removeItem(returnPathKey);
        window.location.replace(path);
      }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [reconnect]);
  return <LearningShell><section className={styles.card}><h1>로그인 연결</h1>
    {failed ? <><p role="alert">로그인이 취소되었거나 연결하지 못했습니다. 다시 로그인해 주세요.</p><Link className={styles.primary} href="/login">로그인 다시 시도</Link><Link className={styles.back} href="/tasks">과제 둘러보기</Link></> : <p role="status">로그인 정보를 확인하고 있습니다.</p>}
  </section></LearningShell>;
}
