'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/shared/auth/auth-provider';
import { safeReturnPath } from '@/shared/auth/session';
import styles from './auth.module.css';
export function AuthControl() {
  const { status, user, logout, logoutFailed } = useAuth();
  const pathname = usePathname();
  return <div className={styles.control}>{logoutFailed ? <><span role="alert">로그아웃 실패</span><button onClick={() => void logout()}>다시 시도</button></> : status === 'connected' ? <><span className={styles.user}>{user?.displayName}님</span><button onClick={() => void logout()}>로그아웃</button></> : <Link href={`/login?returnTo=${encodeURIComponent(safeReturnPath(pathname))}`}>{status==='legal_required'?'약관 확인':'로그인'}</Link>}</div>;
}
