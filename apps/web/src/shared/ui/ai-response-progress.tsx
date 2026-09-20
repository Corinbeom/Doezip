'use client';
import {useEffect,useState} from 'react';
import styles from './ai-conversation.module.css';

const reportSteps=[
 '자료와 대화 맥락을 확인하고 있어요.',
 '질문에 필요한 근거를 정리하고 있어요.',
 '답변을 구성하고 있어요.',
];
const codeSteps=[
 '현재 코드와 테스트 결과를 확인하고 있어요.',
 '실패 원인과 경계 조건을 살펴보고 있어요.',
 '설명과 수정안을 구성하고 있어요.',
];

export function AiResponseProgress({context}:{context:'report'|'code'}){
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{
  const timer=window.setInterval(()=>setElapsed(value=>value+1),1000);
  return()=>window.clearInterval(timer);
 },[]);
 const steps=context==='report'?reportSteps:codeSteps;
 const step=elapsed<4?steps[0]:elapsed<8?steps[1]:steps[2];
 return <div className={styles.responseProgress}>
  <span className={styles.srOnly}>AI가 답변을 준비하고 있습니다.</span>
  <span className={styles.progressVisual} aria-hidden="true">
   <span>{step}</span>
   <span className={styles.thinkingDots}><i/><i/><i/></span>
   <strong>{elapsed}초</strong>
  </span>
 </div>;
}
