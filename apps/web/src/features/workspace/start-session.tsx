'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-provider';
import { createSession } from './api';
import styles from '@/features/tasks/tasks.module.css';
function AuthenticatedStart({taskId}:{taskId:string}){
 const router=useRouter();
 const [pending,setPending]=useState(false);const [error,setError]=useState(false);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();},[]);
 const start=async()=>{
  if(request.current&&!request.current.signal.aborted)return;
  const controller=new AbortController();request.current=controller;setPending(true);setError(false);
  try{const workspace=await createSession(taskId,controller.signal);if(!controller.signal.aborted)router.push(`/sessions/${workspace.session.id}`);}
  catch{if(!controller.signal.aborted){setError(true);setPending(false);request.current=null;}}
 };
 return <div>{error&&<p role="alert">과제를 시작하지 못했습니다. 다시 시도해 주세요.</p>}<button className={styles.button} type="button" onClick={()=>void start()} disabled={pending}>{pending?'작업 공간을 여는 중…':'과제 시작하기'}</button></div>;
}
export function StartSession({taskId}:{taskId:string}){
 const auth=useAuth();
 if(auth.status==='loading')return <p role="status">로그인 상태를 확인하는 중…</p>;
 if(!auth.user||auth.status!=='connected')return <Link className={styles.button} href={`/login?returnTo=${encodeURIComponent(`/tasks/${taskId}`)}`}>로그인하고 과제 시작하기</Link>;
 return <AuthenticatedStart key={`${auth.user.id}:${taskId}`} taskId={taskId}/>;
}
