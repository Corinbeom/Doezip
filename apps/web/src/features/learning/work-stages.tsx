'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import styles from './work-stages.module.css';
const steps=['과제 이해','작업','검증·제출'];
export function WorkStages({brief,work,verification,busy,training,kind}:{brief:ReactNode;work:ReactNode;verification:ReactNode;busy:boolean;training:boolean;kind:'REPORT'|'CODING'}) {
 const [step,setStep]=useState(0);const [back,setBack]=useState(false);const title=useRef<HTMLHeadingElement>(null);const root=useRef<HTMLElement>(null);
 useEffect(()=>{const node=root.current;const header=node?.closest('main')?.parentElement?.querySelector('header');if(!node||!header||typeof ResizeObserver==='undefined')return;const update=()=>node.style.setProperty('--shell-header-offset',`${header.getBoundingClientRect().height}px`);update();const observer=new ResizeObserver(update);observer.observe(header);return()=>observer.disconnect();},[]);
 function move(next:number){setBack(next<step);setStep(next);requestAnimationFrame(()=>title.current?.focus({preventScroll:true}));}
 const guides=kind==='REPORT'?[
  '먼저 누구에게 무엇을 설명할 보고서인지 정하세요. 자료에서 확인한 사실과 아직 모르는 것을 나누면 AI에게 요청할 범위도 분명해집니다.',
  'AI의 제안을 그대로 옮기기 전에 자료 탭에서 주장 하나의 근거를 찾아보세요. 원인을 확정할 수 없다면 그 한계를 보고서에 남기세요.',
  '보고서의 핵심 주장과 원자료를 대조했나요? 확인한 방법과 남은 한계를 적고, 필요하면 작업 단계로 돌아가 보완하세요.'
 ]:[
  '요구사항을 읽고 시작 코드를 테스트해 보세요. 어떤 입력에서 기대와 달라지는지 확인한 뒤 AI에게 설명할 문제를 정하세요.',
  'AI 수정안을 적용한 뒤 공개 테스트를 다시 실행하세요. 중복 id·순서·입력 보존 중 무엇을 확인했는지 결과와 함께 살펴보세요.',
  '테스트 결과가 현재 코드의 결과인가요? 통과 여부뿐 아니라 확인한 요구사항과 아직 확인하지 못한 조건을 적으세요.'
 ];
 return <section ref={root} className={styles.stages} aria-label="과제 수행 단계">
  <div className={styles.bar}><nav aria-label="단계 이동">{steps.map((label,i)=><button type="button" key={label} disabled={busy} aria-current={step===i?'step':undefined} onClick={()=>move(i)}>{i+1}. {label}</button>)}<span>4. 직접 설명</span><span>5. 피드백</span></nav>
   <div className={styles.title}><h2 ref={title} tabIndex={-1}>{steps[step]}</h2><div><button type="button" disabled={busy||step===0} onClick={()=>move(step-1)}>이전 단계</button><button type="button" disabled={busy||step===2} onClick={()=>move(step+1)}>다음 단계</button></div></div>
  </div>
  {training&&<details key={step} className={styles.guide} aria-label="훈련 안내" open={step===0}><summary>이번 단계에서 연습할 것</summary><p>{guides[step]}</p></details>}
  <div className={back?styles.backward:styles.forward}>
   <div hidden={step!==0} className={styles.stage}>{brief}</div>
   <div hidden={step!==1} className={styles.stage}>{work}</div>
   <div hidden={step!==2} className={`${styles.stage} ${styles.verification}`}>{verification}</div>
  </div>
 </section>;
}
