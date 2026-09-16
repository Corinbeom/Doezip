'use client';
import {useEffect,useRef} from 'react';
import {AiConversationPanel,AiMessage,MessageContent} from '@/shared/ui/ai-conversation';
import type {Turn} from './api';
import styles from './coding-assistant.module.css';

const quickPrompts=[
 '실패한 테스트를 기준으로 원인을 설명해 줘.',
 '요구사항별로 현재 코드를 검토해 줘.',
 '수정 전에 확인할 경계 조건을 알려 줘.',
];

export function CodingAssistant({turns,instruction,locked,waiting,busy,onInstruction,onAsk,onApply,canApply}:{
 turns:Turn[];
 instruction:string;
 locked:boolean;
 waiting:boolean;
 busy:boolean;
 onInstruction:(value:string)=>void;
 onAsk:()=>void;
 onApply:(turn:Turn)=>void;
 canApply:(turn:Turn)=>boolean;
}){
 const end=useRef<HTMLLIElement|null>(null);
 useEffect(()=>{end.current?.scrollIntoView?.({block:'end'});},[turns.length,waiting]);
 const disabled=locked||busy||waiting;
 const composer=locked?<p className={styles.readonly}>제출이 끝나 이전 대화와 수정안만 확인할 수 있습니다.</p>:<form onSubmit={event=>{event.preventDefault();if(disabled||!instruction.trim())return;onAsk();}}>
  {turns.length===0&&!waiting&&<div className={styles.quickPrompts} aria-label="질문 예시"><span>이렇게 시작해 보세요</span>{quickPrompts.map(prompt=><button key={prompt} type="button" onClick={()=>onInstruction(prompt)}>{prompt}</button>)}</div>}
  <label className={styles.srOnly} htmlFor="instruction">AI에게 요청</label>
  <div className={styles.inputRow}><textarea id="instruction" value={instruction} maxLength={4000} disabled={disabled} onChange={event=>onInstruction(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} placeholder="코드와 테스트 결과에 관해 질문하세요. Shift+Enter로 줄바꿈"/><button type="submit" disabled={disabled||!instruction.trim()}>질문 보내기</button></div>
  <div className={styles.composerMeta}><span>{Array.from(instruction).length.toLocaleString()} / 4,000자</span><span>현재 코드와 최근 테스트 결과가 함께 전달됩니다.</span></div>
 </form>;
 return <AiConversationPanel ariaLabel="AI와 함께 수정하기" title="코드 수정 대화" description="AI 수정안은 자동 적용되지 않습니다. 설명과 코드를 비교하고 직접 적용한 뒤 테스트하세요." composer={composer}>
  {turns.length===0&&!waiting&&<AiMessage role="assistant" label="AI 코치"><MessageContent text="먼저 코드를 실행해 실패를 확인해 보세요. 관찰한 결과를 알려 주면 원인과 수정 방향을 함께 살펴볼게요."/></AiMessage>}
  {turns.map(turn=><CodingTurn key={turn.id} turn={turn} onApply={onApply} canApply={canApply(turn)}/>) }
  {waiting&&turns.every(turn=>turn.status!=='RUNNING')&&<AiMessage role="assistant" label="AI 코치" status="응답 생성 중…"><MessageContent text="현재 코드와 테스트 결과를 살펴보고 있어요."/></AiMessage>}
  <li ref={end} aria-hidden="true" className={styles.end}/>
 </AiConversationPanel>;
}

function CodingTurn({turn,onApply,canApply}:{turn:Turn;onApply:(turn:Turn)=>void;canApply:boolean}){
 const response=turn.status==='RUNNING'?'수정안을 준비하고 있어요.':turn.status==='FAILED'?'응답을 완료하지 못했습니다. 다시 요청해 주세요.':turn.explanation||'수정안의 설명이 없습니다.';
 const actions=turn.proposedCode!==null?<button disabled={!canApply} onClick={()=>onApply(turn)}>검토한 수정안 적용</button>:undefined;
 return <>
  <AiMessage role="user" label="나"><MessageContent text={turn.instruction}/></AiMessage>
  <AiMessage role="assistant" label="AI 코치" status={turn.status==='RUNNING'?'응답 생성 중…':turn.status==='FAILED'?'응답 실패':undefined} actions={actions}>
   <MessageContent text={response}/>
   {turn.proposedCode!==null&&<div className={styles.proposal}><details><summary>변경 전 코드</summary><pre><code>{turn.baseCode}</code></pre></details><details><summary>제안된 코드 전체</summary><pre><code>{turn.proposedCode}</code></pre></details></div>}
  </AiMessage>
 </>;
}
