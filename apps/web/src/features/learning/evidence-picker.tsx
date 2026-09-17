'use client';

import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {getMaterial,type Workspace} from '@/features/workspace/api';
import type {Notes} from './api';
import styles from './evidence-picker.module.css';

type Range={start:number;end:number};

export function EvidencePicker({sessionId,userId,materials,notes,disabled,onChange}:{sessionId:string;userId:string;materials:Workspace['materials'];notes:Notes;disabled:boolean;onChange:(notes:Notes)=>void}) {
  const [materialId,setMaterialId] = useState(materials[0]?.id ?? '');
  const [range,setRange] = useState<Range|null>(null);
  const activeId=materials.some(item=>item.id===materialId)?materialId:(materials[0]?.id??'');
  const query=useQuery({queryKey:['evidence-material',userId,sessionId,activeId],queryFn:({signal})=>getMaterial(sessionId,activeId,signal),enabled:!!activeId,meta:{private:true}});
  const selected=useMemo(()=>query.data?.lines.filter(line=>range&&line.number>=range.start&&line.number<=range.end)??[],[query.data,range]);
  const duplicate=!!range&&notes.citations.some(c=>c.materialId===activeId&&c.lineStart===range.start&&c.lineEnd===range.end);
  function choose(line:number){setRange(current=>!current||current.start!==current.end?{start:line,end:line}:{start:Math.min(current.start,line),end:Math.max(current.start,line)});}
  function connect(){if(!range||duplicate||notes.citations.length>=8)return;onChange({...notes,citations:[...notes.citations,{materialId:activeId,lineStart:range.start,lineEnd:range.end}]});setRange(null);}
  return <section className={styles.picker} aria-labelledby="evidence-heading">
    <div className={styles.heading}><div><p>원문에서 직접 선택</p><h3 id="evidence-heading">보고서에 사용한 근거</h3></div><span>{notes.citations.length} / 8개 연결</span></div>
    {materials.length===0?<p>연결할 수 있는 공개 자료가 없습니다.</p>:<>
      <div className={styles.materials} role="tablist" aria-label="근거 자료 선택">{materials.map(item=><button type="button" role="tab" aria-selected={activeId===item.id} key={item.id} disabled={disabled} onClick={()=>{setMaterialId(item.id);setRange(null);}}>{item.title}</button>)}</div>
      {query.isPending?<p role="status">원자료를 불러오는 중…</p>:query.isError?<div><p role="alert">원자료를 불러오지 못했습니다.</p><button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>자료 다시 불러오기</button></div>:<>
        <p className={styles.help}>근거의 첫 줄을 누르고, 범위가 필요하면 마지막 줄을 한 번 더 누르세요.</p>
        <ol className={styles.lines}>{query.data.lines.map(line=>{const active=!!range&&line.number>=range.start&&line.number<=range.end;return <li key={line.number}><button type="button" aria-pressed={active} disabled={disabled} onClick={()=>choose(line.number)}><span>{line.number}</span><code>{line.text||' '}</code></button></li>;})}</ol>
      </>}
      {range&&<div className={styles.preview}><div><span>선택한 원문 · {range.start===range.end?`${range.start}행`:`${range.start}–${range.end}행`}</span>{selected.map(line=><p key={line.number}>{line.text||' '}</p>)}</div><button type="button" disabled={disabled||duplicate||notes.citations.length>=8} onClick={connect}>{duplicate?'이미 연결한 근거':'이 원문 연결하기'}</button></div>}
    </>}
    {notes.citations.length>0&&<div className={styles.linked}><h4>연결한 근거</h4>{notes.citations.map((citation,index)=>{const material=materials.find(item=>item.id===citation.materialId);return <article key={`${citation.materialId}:${citation.lineStart}:${citation.lineEnd}:${index}`}><div><strong>{material?.title??'공개 자료'}</strong><span>{citation.lineStart===citation.lineEnd?`${citation.lineStart}행`:`${citation.lineStart}–${citation.lineEnd}행`}</span></div><button type="button" disabled={disabled} aria-label={`${index+1}번째 근거 삭제`} onClick={()=>onChange({...notes,citations:notes.citations.filter((_,item)=>item!==index)})}>삭제</button></article>;})}</div>}
  </section>;
}
