'use client';

import { AuthControl } from '@/features/auth/auth-control';
import Image from 'next/image';
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
    {href:'/learn',label:'내 학습'},
    {href:'/tasks',label:'과제 둘러보기'},
  ];
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#task-main">본문으로 바로가기</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand} aria-label="되짚 홈"><Image src="/brand/doezip-wordmark.svg" width={96} height={41} alt="" priority/></Link>
      <nav className={styles.navigation} aria-label="주 메뉴">{links.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href||pathname.startsWith(`${link.href}/`)?'page':undefined}>{link.label}</Link>)}</nav>
      <AuthControl />
    </div></header>
    <main id="task-main" tabIndex={-1}>{children}</main>
    <footer className={styles.footer}><div className={styles.footerBrand}><Link href="/" aria-label="되짚 홈으로 이동"><Image src="/brand/doezip-wordmark.svg" width={80} height={34} alt=""/></Link><span>AI의 답을, 근거로 되짚다.</span></div><nav aria-label="운영 정책"><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보 처리방침</Link><Link href="/ai-policy">AI 이용 안내</Link></nav><span className={styles.footerNote}>함께 생각하고, 스스로 판단하는 연습.</span></footer>
  </div>;
}
