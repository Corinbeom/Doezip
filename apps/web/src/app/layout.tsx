import type { Metadata } from 'next';
import { QueryProvider } from '@/shared/api/query-provider';
import { AuthProvider } from '@/shared/auth/auth-provider';
import './globals.css';
export const metadata: Metadata = { title: 'Doezip 개발 환경 확인' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><QueryProvider><AuthProvider>{children}</AuthProvider></QueryProvider></body></html>;
}
