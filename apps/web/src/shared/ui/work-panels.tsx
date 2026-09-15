'use client';
import {useState,type ReactNode} from 'react';
import styles from './work-panels.module.css';
/** Keep hidden panels mounted: switching views must not reset an editor or an AI request. */
export function WorkPanels({reference,assistant,artifact}:{reference?:ReactNode;assistant:ReactNode;artifact:ReactNode}) {
 const [left,setLeft]=useState<'reference'|'assistant'>(reference?'reference':'assistant');
 const [mobile,setMobile]=useState<'reference'|'assistant'|'artifact'>('artifact');
 return <div className={styles.workspace}>
  <nav className={styles.mobileTabs} aria-label="작업 패널 선택">
   {reference&&<button type="button" aria-pressed={mobile==='reference'} onClick={()=>{setMobile('reference');setLeft('reference');}}>자료</button>}
   <button type="button" aria-pressed={mobile==='assistant'} onClick={()=>{setMobile('assistant');setLeft('assistant');}}>AI 대화</button>
   <button type="button" aria-pressed={mobile==='artifact'} onClick={()=>setMobile('artifact')}>내 결과물</button>
  </nav>
  <div className={styles.columns}>
   <aside className={`${styles.side} ${mobile==='artifact'?styles.mobileHidden:''}`} aria-label="자료와 AI">
    <nav className={styles.desktopTabs} aria-label="참고 패널 선택">
     {reference&&<button type="button" aria-pressed={left==='reference'} onClick={()=>setLeft('reference')}>자료</button>}
     <button type="button" aria-pressed={left==='assistant'} onClick={()=>setLeft('assistant')}>AI 대화</button>
    </nav>
    {reference&&<div className={styles.scroll} hidden={left!=='reference'} tabIndex={0} aria-label="자료 패널">{reference}</div>}
    <div className={styles.scroll} hidden={left!=='assistant'} tabIndex={0} aria-label="AI 대화 패널">{assistant}</div>
   </aside>
   <div className={`${styles.artifact} ${mobile!=='artifact'?styles.mobileHidden:''}`} tabIndex={0} aria-label="결과물 패널">{artifact}</div>
  </div>
 </div>;
}
