'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/auth-provider';
import { LearningShell } from '@/shared/ui/learning-shell';
import { getMaterial,getWorkspace,type Workspace } from './api';
import { useDraft } from './use-draft';
import { SubmissionPanel } from './submission-panel';
import styles from './workspace.module.css';
import {ChatPanel} from '@/features/chat/chat-panel';
function MaterialViewer({sessionId,userId,materialId}:{sessionId:string;userId:string;materialId:string}){
 const material=useQuery({queryKey:['material',userId,sessionId,materialId],queryFn:({signal})=>getMaterial(sessionId,materialId,signal),meta:{private:true}});
 if(material.isPending)return <p role="status">자료를 불러오는 중…</p>;
 if(material.isError)return <div><p role="alert">자료를 불러오지 못했습니다.</p><button onClick={()=>void material.refetch()} disabled={material.isFetching}>자료 재시도</button></div>;
 return <section aria-label={material.data.title}><h3>{material.data.title}</h3><ol className={styles.lines}>{material.data.lines.map(line=><li key={line.number}><span aria-hidden="true">{line.number}</span><code>{line.text||' '}</code></li>)}</ol></section>;
}
export function WorkspaceEditor({workspace,userId}:{workspace:Workspace;userId:string}){
 const [selected,setSelected]=useState(workspace.materials[0]?.id??null);
 const draft=useDraft(workspace.session.id,workspace.draft);
 const [submitting,setSubmitting]=useState(false);
 const [chatBusy,setChatBusy]=useState(false);
 const [sealed,setSealed]=useState(false);
 const markSealed=useCallback(()=>setSealed(true),[]);
 const writable=!submitting&&!sealed&&workspace.session.allowedActions.includes('WRITE_DRAFT')&&draft.status!=='locked';
 const count=Array.from(draft.text).length;
 const labels={saved:'저장됨',dirty:'저장 대기 중',saving:'저장 중…',error:'저장하지 못했습니다. 작성 내용은 이 화면에 남아 있습니다.',conflict:'다른 창에서 수정한 저장본이 있습니다. 현재 작성 내용은 유지됩니다.',locked:'현재 단계에서는 보고서를 수정할 수 없습니다. 작성 내용은 이 화면에 남아 있습니다.', 'reload-error':'서버 저장본을 불러오지 못했습니다. 현재 작성 내용은 유지됩니다.'};
 return <><nav><Link href={`/tasks/${workspace.task.id}`}>과제 소개로 돌아가기</Link></nav><div className={styles.heading}><p>자료를 읽고, 내 근거로 정리하기</p><h1>{workspace.task.title}</h1><span>보고서 작성</span></div><div className={styles.columns}>
 <aside className={styles.panel}><h2>과제 자료</h2>{workspace.session.allowedActions.includes('READ_MATERIALS')?<>{workspace.materials.length===0?<p>공개된 자료가 없습니다.</p>:<><div className={styles.tabs}>{workspace.materials.map(item=><button key={item.id} aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}>{item.title}</button>)}</div>{selected&&<MaterialViewer key={selected} sessionId={workspace.session.id} userId={userId} materialId={selected}/>}</>}</>:<p>현재 단계에서는 자료를 열 수 없습니다.</p>}</aside>
 <section className={styles.panel} aria-labelledby="draft-heading"><h2 id="draft-heading">내 보고서</h2><p>자료에서 찾은 근거와 나의 판단을 정리하세요.</p><label htmlFor="draft">보고서 내용</label><textarea id="draft" value={draft.text} readOnly={!writable} onChange={event=>draft.change(event.target.value)} placeholder="문제의 원인과 근거를 작성해 보세요."/><div className={styles.saveRow}><span>{count.toLocaleString()} / 20,000자</span><span role={['error','conflict','locked','reload-error'].includes(draft.status)?'alert':'status'}>{labels[draft.status]}</span>{writable&&<button disabled={!draft.dirty||draft.status==='saving'||['conflict','reload-error'].includes(draft.status)||count>20000} onClick={()=>draft.status==='error'?draft.retry():void draft.save()}>{draft.status==='error'?'저장 재시도':'지금 저장'}</button>}</div>{count>20000&&<p role="alert">보고서는 20,000자 이내로 작성해 주세요.</p>}{['conflict','reload-error'].includes(draft.status)&&<button onClick={()=>void draft.reload()}>서버 저장본 불러오기</button>}<p className={styles.note}>입력 후 자동 저장됩니다. 최초 제출 후에는 제출본을 변경할 수 없습니다.</p></section></div><ChatPanel sessionId={workspace.session.id} userId={userId} allowed={writable&&workspace.session.allowedActions.includes('SEND_MESSAGE')} draftReady={!draft.dirty&&draft.status==='saved'} onBusy={setChatBusy}/><SubmissionPanel sessionId={workspace.session.id} userId={userId} draft={draft.snapshot} ready={!chatBusy&&!draft.dirty&&draft.status==='saved'} allowed={workspace.session.allowedActions.includes('SNAPSHOT_INITIAL')} onBusy={setSubmitting} onSealed={markSealed} onReload={draft.reload}/></>;
}
function AuthenticatedWorkspace({sessionId,userId}:{sessionId:string;userId:string}){
 const query=useQuery({queryKey:['workspace',userId,sessionId],queryFn:({signal})=>getWorkspace(sessionId,signal),meta:{private:true},refetchOnWindowFocus:false,refetchOnMount:'always',gcTime:0});
 if(query.isPending||(!query.isFetchedAfterMount&&query.isFetching))return <p role="status">작업 공간을 불러오는 중…</p>;
 if(query.isError)return <><h1>작업 공간</h1><p role="alert">작업 공간을 불러오지 못했습니다. 접근 권한 또는 연결 상태를 확인해 주세요.</p><button disabled={query.isFetching} onClick={()=>void query.refetch()}>재시도</button><Link href="/tasks">과제 목록으로</Link></>;
 return <WorkspaceEditor key={sessionId} workspace={query.data} userId={userId}/>;
}
export function WorkspacePage({sessionId}:{sessionId:string}){
 const auth=useAuth();
 return <LearningShell><div className={styles.container}>{auth.status==='loading'?<p role="status">로그인 상태를 확인하는 중…</p>:auth.user&&auth.status==='connected'?<AuthenticatedWorkspace key={auth.user.id} userId={auth.user.id} sessionId={sessionId}/>:<><h1>로그인이 필요합니다.</h1><Link href={`/login?returnTo=${encodeURIComponent(`/sessions/${sessionId}`)}`}>로그인하고 이어서 작성하기</Link></>}</div></LearningShell>;
}
