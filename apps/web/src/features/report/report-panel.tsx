'use client';
import {useQuery} from '@tanstack/react-query';
import {getReport} from './api';
import styles from './report.module.css';
const areas={PROMPT:'질문과 맥락',EVIDENCE:'근거 확인',DOCUMENT:'보고서',DEFENSE:'판단 설명'};
const states={SUFFICIENT:'충분한 관찰',PARTIAL:'일부 관찰',NEEDS_REVIEW:'검토 필요',NOT_OBSERVED:'관찰되지 않음'};
const confidence={LOW:'낮음',MEDIUM:'보통',HIGH:'높음'};
const judgments:Record<string,string>={DETECTED:'오류 탐지',MISSED:'오류 미탐지',FALSE_POSITIVE:'잘못된 오류 판단',VALID_KEEP:'타당한 유지',UNREVIEWED:'미검토',REVIEW_REQUIRED:'검토 필요',SUPPORTED:'근거 확인',INSUFFICIENT:'근거 부족',NOT_OBSERVED:'관찰되지 않음',VALID:'타당함',INVALID:'재검토 필요',NOT_APPLICABLE:'해당 없음',OBSERVED:'관찰됨'};
export function ReportPanel({id,userId}:{id:string;userId:string}){
 const query=useQuery({queryKey:['report',userId,id],queryFn:({signal})=>getReport(id,signal),meta:{private:true},refetchOnMount:'always'});
 if(!query.data||query.isError)return <section className={styles.panel} aria-label="평가 결과"><p role={query.isError?'alert':'status'}>{query.isError?'평가 결과를 불러오지 못했습니다.':'평가 결과를 불러오는 중…'}</p>{query.isError&&<button onClick={()=>void query.refetch()}>결과 다시 불러오기</button>}</section>;
 const report=query.data;
 return <section className={styles.panel} aria-label="평가 결과"><h3>최초 평가 결과</h3>
 {report.sample&&<p role="note">개발용 예시 — 실제 AI 평가나 학습 성과를 의미하지 않습니다.</p>}
 <p>{report.summary}</p><p>관찰되지 않은 항목은 능력이 부족하다는 뜻이 아닙니다.</p>
 {report.strengths.length>0&&<><h4>확인한 강점</h4><ul>{report.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
 {report.improvements.length>0&&<><h4>보완할 점</h4><ul>{report.improvements.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
 {report.areas.map(area=><section key={area.area} aria-label={areas[area.area]}><h4>{areas[area.area]}</h4>{area.dimensions.map(d=><article key={d.code}><h5>{d.title} · {states[d.state]}</h5><p>{d.rationale}</p>{d.gap&&<p>보완할 점: {d.gap}</p>}{d.nextAction&&<p>다음 행동: {d.nextAction}</p>}{d.confidenceLevel&&<p>판정 확신도: {confidence[d.confidenceLevel]}</p>}{d.evidence.map(e=><details key={e.id}><summary>{e.polarity==='SUPPORT'?'판단을 뒷받침하는 관찰':'반대 관찰'}</summary><p>{e.explanation}</p>{e.excerpt&&<blockquote>{e.excerpt}</blockquote>}{e.source&&<><p>자료 인용 · {e.source.lineStart}–{e.source.lineEnd}행</p><blockquote>{e.source.quotedText}</blockquote></>}</details>)}</article>)}</section>)}
 <h4>검산 검토 피드백</h4><p>{report.faultSummary.note}</p><ol>{report.faultSummary.statements.map(s=><li key={s.statementId}><p>{s.feedback}</p><p>탐지: {judgments[s.detectionResult]} · 근거: {judgments[s.evidenceResult]} · 수정: {judgments[s.repairResult]} · 재확인: {judgments[s.recheckResult]}</p></li>)}</ol>
 {report.nextPracticeText&&<><h4>다음 연습</h4><p>{report.nextPracticeText}</p></>}
 </section>;
}
