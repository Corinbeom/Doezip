import type { Metadata } from 'next';
import { QueryProvider } from '@/shared/api/query-provider';
import { AuthProvider } from '@/shared/auth/auth-provider';
import './globals.css';
export const metadata: Metadata = {
  title: { default: '되짚 | AI와 함께 판단하는 연습', template: '%s | 되짚' },
  description: 'AI의 제안을 근거로 확인하고 자신의 판단으로 설명하는 학습 서비스',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><QueryProvider><AuthProvider>{children}</AuthProvider></QueryProvider></body></html>;
}
