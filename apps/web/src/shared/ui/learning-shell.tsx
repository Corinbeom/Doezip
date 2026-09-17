'use client';

import { AuthControl } from '@/features/auth/auth-control';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type { ReactNode } from 'react';
import styles from './learning-shell.module.css';

export function Arrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function LearningShell({ children }: { children: ReactNode }) {
  const pathname=usePathname()??'';
  const links=[
    {href:'/tasks',label:'문제 탐색'},
    {href:'/coding',label:'구현 연습'},
    {href:'/learn',label:'AI 과제 훈련'},
  ];
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#task-main">본문으로 바로가기</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/learn" className={styles.brand} aria-label="되짚 홈"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 10a10 10 0 1 1-2 11" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" /><path d="M8 3v8h8" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="17" r="3" fill="currentColor" /></svg><span>되짚<small>doezip</small></span></Link>
      <nav className={styles.navigation} aria-label="주 메뉴">{links.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href||pathname.startsWith(`${link.href}/`)?'page':undefined}>{link.label}</Link>)}</nav>
      <AuthControl />
    </div></header>
    <main id="task-main" tabIndex={-1}>{children}</main>
    <footer className={styles.footer}><Link href="/tasks">되짚</Link><span>AI의 답을, 근거로 되짚다.</span><span className={styles.footerNote}>함께 생각하고, 스스로 판단하는 연습.</span></footer>
  </div>;
}
