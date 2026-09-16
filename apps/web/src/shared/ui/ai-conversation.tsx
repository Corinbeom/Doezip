import type {ReactNode} from 'react';
import styles from './ai-conversation.module.css';

export function AiConversationPanel({
 ariaLabel,
 title,
 description,
 toolbar,
 children,
 composer,
}:{
 ariaLabel:string;
 title:string;
 description:string;
 toolbar?:ReactNode;
 children:ReactNode;
 composer:ReactNode;
}){
 return <section className={styles.panel} aria-label={ariaLabel}>
  <header className={styles.header}>
   <span className={styles.avatar} aria-hidden="true">AI</span>
   <div className={styles.identity}><span>AI 코치</span><h2>{title}</h2></div>
   {toolbar&&<div className={styles.toolbar}>{toolbar}</div>}
  </header>
  <p className={styles.description}>{description}</p>
  <ol className={styles.thread} role="log" aria-live="polite" aria-label="AI 대화 기록">{children}</ol>
  <div className={styles.composer}>{composer}</div>
 </section>;
}
export function AiMessage({
 role,
 label,
 status,
 children,
 actions,
}:{
 role:'user'|'assistant';
 label:string;
 status?:string;
 children:ReactNode;
 actions?:ReactNode;
}){
 return <li className={`${styles.message} ${role==='user'?styles.user:styles.assistant}`}>
  <span className={styles.messageLabel}>{label}</span>
  <div className={styles.bubble}>{children}</div>
  {status&&<span className={styles.status}>{status}</span>}
  {actions&&<div className={styles.actions}>{actions}</div>}
 </li>;
}

export function MessageContent({text}:{text:string}){
 const blocks:Array<{kind:'text'|'code';value:string;language?:string}>=[];
 const fence=/```([^\n`]*)\n?([\s\S]*?)```/g;
 let cursor=0;
 for(const match of text.matchAll(fence)){
  const index=match.index??0;
  if(index>cursor)blocks.push({kind:'text',value:text.slice(cursor,index)});
  blocks.push({kind:'code',value:match[2].replace(/\n$/,''),language:match[1].trim()});
  cursor=index+match[0].length;
 }
 if(cursor<text.length)blocks.push({kind:'text',value:text.slice(cursor)});
 if(blocks.length===0)blocks.push({kind:'text',value:text});
 return <div className={styles.content}>{blocks.map((block,index)=>block.kind==='code'
  ?<pre key={index}>{block.language&&<span>{block.language}</span>}<code>{block.value}</code></pre>
  :block.value.trim()&&<p key={index}>{block.value.trim()}</p>)}</div>;
}
