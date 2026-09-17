'use client';

import {useState} from 'react';
import type {Flow} from './api';
import styles from './hint-panel.module.css';

const topics = {
  REPORT: [
    ['사실과 미확인 구분', '자료에서 확인한 내용과 아직 모르는 내용을 나눠 봅니다.'],
    ['AI 주장 대조', 'AI가 제안한 원인에 자료 근거가 있는지 확인합니다.'],
    ['근거와 다음 확인', '핵심 주장에 자료를 연결하고 다음 확인 방법을 정리합니다.'],
  ],
  CODING: [
    ['실패부터 확인', '시작 코드를 실행해 어떤 요구사항이 실패하는지 확인합니다.'],
    ['수정안 비교', 'AI 수정안이 요구사항과 현재 코드에 맞는지 비교합니다.'],
    ['다시 실행하고 설명', '수정한 코드의 테스트 결과와 남은 한계를 정리합니다.'],
  ],
} as const;

export function HintPanel({kind,hints,busy,onReveal}:{kind:Flow['kind'];hints:Flow['hints'];busy:boolean;onReveal:(index:number)=>void}) {
  const [selected,setSelected] = useState(hints.at(-1)?.index ?? 0);
  const opened = new Map(hints.map(hint=>[hint.index,hint.text]));
  const current = opened.get(selected);
  return <section className={styles.panel} aria-labelledby="hint-heading">
    <div className={styles.heading}>
      <div><p>필요할 때 꺼내 보는 안내</p><h3 id="hint-heading">어디를 다시 확인할까요?</h3></div>
      <span>{opened.size} / 3 확인</span>
    </div>
    <div className={styles.topics} role="tablist" aria-label="힌트 주제">
      {topics[kind].map(([title,description],index)=><button type="button" role="tab" aria-selected={selected===index} aria-controls="selected-hint" key={title} disabled={busy} onClick={()=>{setSelected(index);if(!opened.has(index))onReveal(index);}}>
        <span>{opened.has(index)?'확인함':`0${index+1}`}</span><strong>{title}</strong><small>{description}</small>
      </button>)}
    </div>
    <div id="selected-hint" role="tabpanel" className={styles.selected} aria-live="polite">
      <span>{topics[kind][selected][0]}</span>
      <p>{current ?? (busy?'힌트를 불러오는 중입니다…':'위 주제를 선택하면 지금 해볼 행동을 확인할 수 있습니다.')}</p>
    </div>
    <p className={styles.note}>힌트 사용 여부는 점수나 감점으로 바뀌지 않습니다.</p>
  </section>;
}
