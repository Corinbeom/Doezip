'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { getWorkspace, saveDraft, type Draft } from './api';
export function useDraft(sessionId:string, initial:Draft) {
  const [text,setText]=useState(initial.markdown);
  const [saved,setSaved]=useState(initial.markdown);
  const [status,setStatus]=useState<'saved'|'dirty'|'saving'|'error'|'conflict'|'locked'|'reload-error'>('saved');
  const state=useRef({text:initial.markdown,saved:initial.markdown,version:initial.lockVersion,blocked:false,busy:false,alive:true});
  const request=useRef<AbortController|null>(null);
  useEffect(()=> { const current=state.current;current.alive=true; return ()=>{current.alive=false;request.current?.abort();}; },[]);
  const change=(value:string)=>{ const s=state.current; s.text=value.replace(/\r\n?/g,'\n');setText(s.text);if(!s.blocked&&!s.busy)setStatus(s.text===s.saved?'saved':'dirty'); };
  const save=useCallback(async()=>{
    const s=state.current;
    if(s.busy||s.blocked||s.text===s.saved||Array.from(s.text).length>20000)return;
    s.busy=true;setStatus('saving');const sent=s.text;const controller=new AbortController();request.current=controller;
    try { const draft=await saveDraft(sessionId,sent,s.version,controller.signal);if(!s.alive)return;s.version=draft.lockVersion;s.saved=draft.markdown;setSaved(draft.markdown);setStatus(s.text===s.saved?'saved':'dirty'); }
    catch(error){if(!s.alive)return;s.blocked=true;setStatus(error instanceof ApiError&&error.status===409?(error.code==='INVALID_SESSION_STATE'?'locked':'conflict'):'error');}
    finally{s.busy=false;}
  },[sessionId]);
  useEffect(()=>{if(status!=='dirty')return;const timer=setTimeout(()=>void save(),1000);return()=>clearTimeout(timer);},[text,status,save]);
  const retry=()=>{state.current.blocked=false;void save();};
  const reload=async()=>{
    if(!window.confirm('현재 작성한 내용을 버리고 서버의 저장본을 불러올까요?'))return;
    const s=state.current;if(s.busy)return;const confirmed=s.text;s.busy=true;const controller=new AbortController();request.current=controller;
    try {const {draft}=await getWorkspace(sessionId,controller.signal);if(!s.alive||s.text!==confirmed)return;s.text=draft.markdown;s.saved=draft.markdown;setSaved(draft.markdown);s.version=draft.lockVersion;s.blocked=false;setText(draft.markdown);setStatus('saved');}
    catch{if(s.alive)setStatus('reload-error');}finally{s.busy=false;}
  };
  const dirty=text!==saved;
  useEffect(()=>{
    if(!dirty)return;
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    const navigate=(event:MouseEvent)=>{const anchor=(event.target as Element).closest('a');if(anchor&&!anchor.getAttribute('href')?.startsWith('#')&&!window.confirm('저장되지 않은 내용이 있습니다. 페이지를 떠날까요?')){event.preventDefault();event.stopPropagation();}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',navigate,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigate,true);};
  },[dirty]);
  return {text,change,status,save,retry,reload,dirty};
}
