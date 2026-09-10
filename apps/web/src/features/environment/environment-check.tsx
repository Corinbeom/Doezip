"use client";
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getHealth } from './health';
export function EnvironmentCheck() {
  const health = useQuery({ queryKey: ['operational-health'], queryFn: ({ signal }) => getHealth(signal) });
  return <main>
    <Link href="/tasks">과제 목록 보기</Link>
    <h1>개발 환경 확인</h1>
    <p>기술 연결 확인용 임시 화면입니다. 최종 제품 UI가 아닙니다.</p>
    <p role="status" aria-live="polite">{health.isFetching ? '연결 확인 중…' : health.isError ? '연결 실패: API 또는 DB 상태를 확인하세요.' : health.isSuccess ? '연결 성공: API와 PostgreSQL이 정상입니다.' : '연결 대기'}</p>
    <button type="button" onClick={() => void health.refetch()} disabled={health.isFetching}>재시도</button>
  </main>;
}
