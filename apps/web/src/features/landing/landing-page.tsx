import Image from 'next/image';
import Link from 'next/link';
import {Arrow,LearningShell} from '@/shared/ui/learning-shell';
import styles from './landing.module.css';

const practices=[
  {number:'01',title:'질문을 구체화해요',body:'상황과 목표를 정리하고, AI가 제대로 답할 수 있는 질문을 만듭니다.'},
  {number:'02',title:'제안을 직접 확인해요',body:'보고서는 원자료와 대조하고, 코드는 테스트를 실행해 AI의 제안을 검증합니다.'},
  {number:'03',title:'내 판단을 설명해요',body:'무엇을 채택했고 무엇을 보류했는지 내 말로 설명한 뒤 근거 중심 피드백을 받습니다.'},
];

export function LandingPage(){return <LearningShell><div className={styles.page}>
  <section className={styles.hero} aria-labelledby="landing-title">
    <div className={styles.heroCopy}><p className={styles.eyebrow}>AI 활용 역량 훈련</p><h1 id="landing-title">AI의 답을 그대로 쓰지 않고,<br/><em>내 판단으로 완성하는 연습.</em></h1><p className={styles.lead}>되짚은 AI와 과제를 해결하는 과정에서 질문, 검증, 수정, 설명을 기록합니다. 결과만 채점하지 않고 어떻게 판단했는지 함께 돌아봅니다.</p><div className={styles.actions}><Link className={styles.primary} href="/learn">내 학습 시작하기<Arrow/></Link><a className={styles.secondary} href="#how-it-works">어떻게 연습하나요?<Arrow/></a></div><p className={styles.heroNote}>보고서 작성과 JavaScript 구현 과제를 바로 체험할 수 있습니다.</p></div>
    <div className={styles.visual}><Image src="/design/learning-notes.svg" width={430} height={300} alt="자료의 근거를 확인하고 나의 판단을 기록하는 과정" priority/><div className={styles.visualLabel}><span aria-hidden="true">✓</span><p><strong>답보다 과정을 봅니다</strong><small>질문 · 검증 · 개선 · 설명</small></p></div></div>
  </section>

  <section className={styles.statement} aria-labelledby="difference-title"><p>AI를 잘 쓴다는 건</p><h2 id="difference-title">빠른 답을 받는 것에서 끝나지 않습니다.</h2><p>좋은 질문을 만들고, 받은 답을 근거로 확인하고, 자신의 선택을 설명할 수 있어야 합니다.</p></section>

  <section id="how-it-works" className={styles.process} aria-labelledby="process-title"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>되짚의 학습 방식</p><h2 id="process-title">한 번의 과제에서 세 가지를 연습해요.</h2></div><p>AI 대화와 최종 결과물 사이에 검증과 설명을 넣어, 내가 실제로 한 판단을 남깁니다.</p></div><ol>{practices.map(item=><li key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.body}</p></li>)}</ol></section>

  <section className={styles.taskSection} aria-labelledby="task-types-title"><div className={styles.taskIntro}><p className={styles.eyebrow}>두 가지 과제</p><h2 id="task-types-title">글과 코드, 서로 다른 결과물로 같은 판단 과정을 훈련합니다.</h2><p>훈련 모드에서는 단계별 안내와 힌트를 확인할 수 있고, 모의 전형에서는 안내 없이 스스로 수행합니다.</p><Link className={styles.textLink} href="/tasks">공개 과제 먼저 둘러보기<Arrow/></Link></div><div className={styles.taskCards}><article><span>REPORT</span><h3>보고서 작성</h3><p>자료를 읽고 AI와 원인을 분석한 뒤, 핵심 주장에 원문 근거를 연결합니다.</p><ul><li>원자료 대조</li><li>불확실성 구분</li><li>근거가 있는 결론</li></ul></article><article><span>CODING</span><h3>구현 과제</h3><p>AI와 코드를 검토하고 직접 수정한 뒤, 공개 테스트와 검증 설명을 남깁니다.</p><ul><li>실패 원인 확인</li><li>제안 코드 검토</li><li>경계 조건 테스트</li></ul></article></div></section>

  <section className={styles.finalCta}><div><p className={styles.eyebrow}>지금 시작하기</p><h2>AI와 함께 풀되,<br/>판단은 내 것으로 남겨 보세요.</h2></div><Link className={styles.primary} href="/learn">첫 과제 시작하기<Arrow/></Link></section>
 </div></LearningShell>}
