'use client';

import {useMemo,useRef,useState} from 'react';
import {formatTestResultDetail} from '@/features/coding/test-result-copy';
import type {Flow} from './api';
import styles from './feedback-review.module.css';

type Item=NonNullable<NonNullable<Flow['feedback']>['items']>[number];
const order:Item['area'][]=['REQUEST','VERIFY','IMPROVE','EXPLAIN'];
const copy:Record<Item['area'],{title:string;question:string;short:string}>={
  REQUEST:{title:'문제와 요청 구체화',short:'요청',question:'AI에게 풀어야 할 문제와 맥락을 어떻게 전달했나요?'},
  VERIFY:{title:'제안 검증',short:'검증',question:'AI의 제안을 어떤 근거와 실행 결과로 확인했나요?'},
  IMPROVE:{title:'결과물 개선',short:'개선',question:'확인한 내용을 결과물에 어떻게 반영했나요?'},
  EXPLAIN:{title:'판단 설명',short:'설명',question:'선택한 방법과 한계를 자신의 말로 설명했나요?'},
};

function readableSourceText(text:string) {
  const start=text.indexOf('{');
  if(start<0)return text;
  try {
    const value:unknown=JSON.parse(text.slice(start));
    if(value&&typeof value==='object'&&'quote' in value&&typeof value.quote==='string')return value.quote;
    if(value&&typeof value==='object'&&'results' in value&&Array.isArray(value.results)) {
      const results=value.results.filter((entry):entry is {name:string;passed:boolean;detail?:string}=>!!entry&&typeof entry==='object'&&'name' in entry&&typeof entry.name==='string'&&'passed' in entry&&typeof entry.passed==='boolean');
      if(results.length>0)return results.map(result=>`${result.passed?'통과':'확인 필요'} · ${result.name}${result.detail?`\n${formatTestResultDetail(result.detail)}`:''}`).join('\n\n');
    }
  } catch {}
  return text;
}

function sourceLabel(label:string){return label==='PUBLIC_TEST'?'공개 테스트 기록':label.replace(/^브라우저 보고\s*/,'');}
function Source({source}:{source:Item['sources'][number]}) {
  const text=readableSourceText(source.text);
  return <details className={styles.source}><summary><span>{sourceLabel(source.label)}</span><small>내용 펼쳐 보기</small></summary><p>{text}</p></details>;
}

export function FeedbackReview({feedback,onPractice,busy}:{feedback:NonNullable<Flow['feedback']>;onPractice:()=>void;busy:boolean}) {
  const items=useMemo(()=>[...feedback.items].sort((a,b)=>order.indexOf(a.area)-order.indexOf(b.area)),[feedback.items]);
  const [index,setIndex]=useState(0);const heading=useRef<HTMLHeadingElement>(null);const item=items[index];
  function move(next:number){setIndex((next+items.length)%items.length);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));}
  const priority=items.find(entry=>entry.area===feedback.practiceArea);
  return <>
    <section className={styles.focus} aria-labelledby="feedback-focus-heading">
      <div className={styles.top}><div><p>집중해서 보기 · {index+1} / {items.length}</p><h2 id="feedback-focus-heading" ref={heading} tabIndex={-1}>{copy[item.area].title}</h2></div><span>{copy[item.area].short}</span></div>
      <p className={styles.question}>{copy[item.area].question}</p>
      <div className={styles.body}>
        <section><h3>관찰한 행동</h3><p>{item.observation}</p></section>
        <section><h3>판단에 사용한 실제 기록</h3><div className={styles.sources}>{item.sources.map(source=><Source key={source.id} source={source}/>)}</div></section>
        <section className={styles.action}><h3>다음에 해볼 행동</h3><p>{item.nextAction}</p></section>
      </div>
      <div className={styles.controls}><button type="button" onClick={()=>move(index-1)}>이전 피드백</button><nav aria-label="피드백 항목 이동">{items.map((entry,itemIndex)=><button type="button" key={entry.area} aria-current={itemIndex===index?'step':undefined} aria-label={`${itemIndex+1}. ${copy[entry.area].title}`} onClick={()=>move(itemIndex)}><span>{itemIndex+1}</span><em>{copy[entry.area].short}</em></button>)}</nav><button type="button" onClick={()=>move(index+1)}>다음 피드백</button></div>
    </section>
    <section className={styles.priority} aria-labelledby="priority-heading"><div><p>가장 먼저 다시 연습할 부분</p><h2 id="priority-heading">{priority&&copy[priority.area].title}</h2><p>{priority?.nextAction}</p></div><button type="button" disabled={busy} onClick={onPractice}>이 피드백으로 재연습하기</button></section>
    <details className={styles.archive}>
      <summary className={styles.archiveHeading}><div><p>나중에도 다시 보는 기록</p><h2 id="feedback-archive-heading">전체 피드백</h2></div><span>4가지 관점 · 펼쳐 보기</span></summary>
      <div className={styles.archiveContent}><p>이 수행에서 관찰된 기록을 한 화면에 모았습니다. 관찰되지 않은 항목은 능력 부족을 뜻하지 않습니다.</p>
      <div className={styles.grid}>{items.map((entry,itemIndex)=><article key={entry.area}><span>0{itemIndex+1}</span><h3>{copy[entry.area].title}</h3><p>{entry.observation}</p><div><strong>다음 행동</strong><p>{entry.nextAction}</p></div><details><summary>판단 근거 {entry.sources.length}개 보기</summary>{entry.sources.map(source=><Source key={source.id} source={source}/>)}</details><button type="button" onClick={()=>{move(itemIndex);document.getElementById('feedback-focus-heading')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}}>집중해서 보기</button></article>)}</div></div>
    </details>
  </>;
}
