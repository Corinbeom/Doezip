import type { Metadata } from 'next';
import { QueryProvider } from '@/shared/api/query-provider';
import './globals.css';
export const metadata: Metadata = { title: 'Doezip 개발 환경 확인' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><QueryProvider>{children}</QueryProvider></body></html>;
}
