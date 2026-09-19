import Link from 'next/link';
import { LearningShell } from '@/shared/ui/learning-shell';
import { geminiDataTier, legalContact, legalPolicy } from '@/shared/legal/policy';
import styles from './legal.module.css';

function Contact(){return legalContact?<a href={`mailto:${legalContact}`}>{legalContact}</a>:<strong>공개 전 실제 운영자 이메일 설정 필요</strong>;}
function Page({eyebrow,title,version,children}:{eyebrow:string;title:string;version:string;children:React.ReactNode}){
 return <LearningShell><article className={styles.page}><header><p>{eyebrow}</p><h1>{title}</h1><div><span>버전 {version}</span><span>시행일 {legalPolicy.effectiveDate}</span></div></header><aside><strong>핵심 안내</strong><p>되짚은 AI와 함께 결과물을 만들고, 근거를 확인하고, 자신의 판단을 설명하는 학습 서비스입니다. 아래 내용은 현재 공개 데모의 실제 동작을 기준으로 작성했습니다.</p></aside>{children}<nav className={styles.related} aria-label="관련 운영 정책"><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보 처리방침</Link><Link href="/ai-policy">AI 이용 안내</Link></nav></article></LearningShell>;
}

export function TermsPage(){return <Page eyebrow="서비스 운영 정책" title="되짚 이용약관" version={legalPolicy.termsVersion}>
 <section><h2>1. 목적과 적용</h2><p>이 약관은 되짚 프로젝트 운영자(이하 “운영자”)가 제공하는 되짚 서비스와 이용자의 권리·의무를 정합니다. 이용자는 로그인 후 이 약관에 동의함으로써 서비스를 이용할 수 있습니다.</p></section>
 <section><h2>2. 제공하는 서비스</h2><p>되짚은 과제, 자료, AI 대화, 코드 실행, 결과물 저장, 검증 기록과 학습 피드백을 제공합니다. 현재 서비스는 공개 데모 단계이며 일부 기능·과제·제공 시간이 변경될 수 있습니다.</p></section>
 <section><h2>3. 이용 연령과 계정</h2><ul><li>Gemini API 이용 조건에 따라 되짚은 만 18세 이상이며 업무·전문 역량 학습 목적으로 사용하는 이용자에게 제공합니다.</li><li>Google과 Supabase 인증을 이용하며 타인의 계정을 사용할 수 없습니다.</li><li>이용자는 자신의 로그인 수단을 안전하게 관리해야 합니다.</li><li>비정상 접근, 서비스 공격 또는 정책 위반이 확인되면 이용을 제한할 수 있습니다.</li></ul></section>
 <section><h2>4. 이용자의 결과물</h2><p>이용자가 작성한 질문, 코드, 보고서와 직접 설명의 권리는 이용자에게 남습니다. 이용자는 자신이 입력할 권한이 있는 자료만 사용해야 합니다. 운영자는 서비스 제공, 저장, AI 처리와 피드백 생성에 필요한 범위에서만 해당 결과물을 처리합니다.</p></section>
 <section><h2>5. 과제와 서비스 콘텐츠</h2><p>과제 설명, 자료, 화면, 로고와 서비스가 제공하는 콘텐츠의 권리는 운영자 또는 정당한 권리자에게 있습니다. 개인 학습 범위를 넘어 무단 복제·배포·판매하거나 자동화된 방법으로 대량 수집할 수 없습니다.</p></section>
 <section><h2>6. 금지사항</h2><ul><li>타인의 개인정보, 회사 기밀, 비공개 코드나 입력 권한이 없는 자료를 제출하는 행위</li><li>다른 이용자의 계정·학습 기록에 접근하거나 보안 장치를 우회하는 행위</li><li>서비스 운영을 방해하거나 사용량 제한을 회피하는 행위</li><li>불법·유해 행위 또는 타인의 권리를 침해하는 목적으로 AI를 사용하는 행위</li></ul></section>
 <section><h2>7. AI와 평가 결과</h2><p>AI 답변과 평가는 부정확하거나 불완전할 수 있습니다. 이용자는 원자료, 요구사항과 실행 결과를 직접 확인해야 합니다. 되짚의 평가는 학습 피드백이며 공인 자격, 채용 합격 여부 또는 전문적 판단을 대신하지 않습니다. 자세한 내용은 <Link href="/ai-policy">AI 이용 및 데이터 안내</Link>에서 확인할 수 있습니다.</p></section>
 <section><h2>8. 변경·중단과 책임</h2><p>운영상 또는 기술상 필요한 경우 서비스를 변경하거나 일시 중단할 수 있습니다. 운영자의 고의 또는 중대한 과실이 없는 한 외부 인증·AI·호스팅 사업자의 장애, 이용자가 AI 결과를 검증하지 않아 발생한 손해에 대해 법령이 허용하는 범위에서 책임을 제한합니다.</p></section>
 <section><h2>9. 탈퇴와 기록 삭제</h2><p>이용자는 내 학습의 계정 관리에서 직접 탈퇴할 수 있습니다. 탈퇴하면 되짚 인증 계정과 학습 세션, 보고서, 코드, AI 대화, 검증·직접 설명, 평가와 피드백을 영구 삭제하며 복원할 수 없습니다. 연결에 사용한 Google 계정과 Google의 다른 서비스 데이터는 삭제되지 않습니다. 법령상 보존이 필요한 정보가 생기는 경우에는 해당 항목과 기간을 별도로 안내하고 분리 보관합니다.</p></section>
 <section><h2>10. 문의와 준거법</h2><p>운영 주체: 되짚 프로젝트 운영자<br/>서비스 및 개인정보 문의: <Contact/></p><p>이 약관은 대한민국 법령에 따라 해석합니다. 분쟁은 당사자 간 협의를 우선하며 해결되지 않으면 민사소송법상 관할법원에서 처리합니다.</p></section>
 </Page>}

export function PrivacyPage(){return <Page eyebrow="개인정보 보호" title="개인정보 처리방침" version={legalPolicy.privacyVersion}>
 <section><h2>1. 처리하는 정보</h2><div className={styles.tableWrap}><table><thead><tr><th>구분</th><th>항목</th><th>목적</th></tr></thead><tbody><tr><td>로그인</td><td>인증 제공자, 사용자 식별자, 이름, 이메일</td><td>본인 식별과 계정 연결</td></tr><tr><td>학습</td><td>과제 진행, 질문, AI 대화, 코드, 보고서, 테스트·검증 기록, 직접 설명, 피드백</td><td>학습 기능, 저장·복원, AI 피드백 제공</td></tr><tr><td>자동 생성</td><td>접속 시각, IP, 브라우저·기기 정보, 요청·오류 로그, 인증 세션</td><td>보안, 장애 대응, 서비스 운영</td></tr></tbody></table></div><p>민감정보나 고유식별정보는 요구하지 않습니다. 과제 수행 중 실제 개인정보, 회사 기밀 또는 비공개 자료를 입력하지 마세요.</p></section>
 <section><h2>2. 처리 근거와 보유 기간</h2><p>계정·학습 정보는 서비스 제공을 위한 계약 체결 및 이행에 필요한 범위에서 처리합니다. 계정과 학습 기록은 이용자가 직접 탈퇴하거나 서비스가 종료될 때까지 보관합니다. 탈퇴가 완료되면 운영 데이터베이스와 Supabase 인증 사용자를 삭제합니다. 이미 발급된 인증 토큰으로 계정이 즉시 재생성되는 일을 막기 위해 인증 제공자와 사용자 식별자를 단방향 변환한 값만 최대 24시간 보관한 뒤 자동 삭제합니다. 관계 법령에 따라 보존할 필요가 있는 경우에는 해당 정보와 기간을 별도로 안내하고 분리 보관합니다.</p></section>
 <section><h2>3. 처리위탁과 국외 이전</h2><p>되짚은 개인정보를 독립된 광고·판매 목적으로 제3자에게 제공하지 않습니다. 아래 사업자에는 서비스 제공에 필요한 처리를 위탁하거나 보관합니다.</p><div className={styles.tableWrap}><table><thead><tr><th>이전받는 자·연락처</th><th>항목·목적</th><th>국가·시기·방법</th><th>보유·이용 기간</th></tr></thead><tbody>
 <tr><td>Supabase, Inc.<br/><a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">개인정보 문의</a></td><td>사용자 식별자, 이름, 이메일, 인증 세션 / 로그인·세션 유지</td><td>대한민국(서울)<br/>로그인·세션 갱신 시 HTTPS 전송</td><td>계정 또는 서비스 계약 종료 후 공급자 정책과 백업 주기에 따라 삭제</td></tr>
 <tr><td>Google LLC (OAuth)<br/><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">개인정보 문의</a></td><td>Google 사용자 식별자, 이름, 이메일 / 본인 인증</td><td>Google 인프라 운영 국가<br/>Google 로그인 선택 시 OAuth 통신</td><td>Google 계정 설정과 공급자 정책에 따름</td></tr>
 <tr><td>Vercel Inc.<br/><a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noreferrer">privacy@vercel.com</a></td><td>IP, 기기·브라우저, 요청·오류 로그 / 웹 제공·보안·장애 대응</td><td>미국 등 글로벌 CDN 운영 국가<br/>서비스 접속 시 HTTPS 전송</td><td>서비스 제공 목적 또는 법적 의무에 필요한 기간</td></tr>
 <tr><td>Render Services, Inc.<br/><a href="mailto:privacy@render.com">privacy@render.com</a></td><td>계정·학습 기록, IP, 요청·오류 로그 / API·PostgreSQL 운영</td><td>싱가포르 및 공급자 운영 국가<br/>서비스 이용 시 HTTPS 전송·DB 보관</td><td>계정 삭제 또는 계약 종료 후 공급자 정책과 백업 주기에 따라 삭제</td></tr>
 <tr><td>Google LLC (Gemini API)<br/><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">개인정보 문의</a></td><td>AI 질문·응답, 코드·보고서, 평가에 필요한 학습 기록 / AI 대화·피드백 생성</td><td>미국 등 Google 인프라 운영 국가<br/>AI 요청 시 서버에서 HTTPS 전송</td><td>유료는 안전·부정사용 탐지에 필요한 제한된 기간, 무료는 Google의 제품·AI 개선 정책에 따름</td></tr>
 </tbody></table></div><p>국외 처리는 서비스 제공 계약의 이행에 필요한 처리위탁·보관을 근거로 하며, 전송 구간 암호화와 접근 제한을 적용합니다. 국외 이전을 원하지 않으면 로그인 또는 AI 기능을 이용하지 않고 계정·기록 삭제를 요청할 수 있으며, 이 경우 로그인 학습과 AI 피드백을 제공할 수 없습니다. 공급자나 처리 지역이 바뀌면 이 방침을 갱신합니다.</p></section>
 <section><h2>4. 브라우저 저장 정보</h2><p>로그인 유지를 위해 Supabase 인증 세션이 브라우저 저장소에 보관됩니다. 로그아웃하면 현재 브라우저의 세션을 제거합니다. 현재 맞춤형 광고나 광고 추적 쿠키를 사용하지 않습니다.</p></section>
 <section><h2>5. 파기</h2><p>내 학습에서 탈퇴하면 되짚 계정과 사용자 소유의 학습 세션, 보고서, 코드, AI 대화, 검증·직접 설명, 평가와 피드백을 운영 데이터베이스에서 함께 삭제합니다. Supabase 인증 사용자와 새 세션을 만들 수 있는 갱신 토큰도 삭제됩니다. 이미 발급된 접근 토큰은 만료 전까지 형식상 유효할 수 있어 위 단방향 차단값으로 계정 재생성을 막습니다. 백업과 공급자 운영 로그에 남은 정보는 각 공급자의 보존 주기에 따라 삭제되며 복구 목적 외에는 사용하지 않습니다.</p></section>
 <section><h2>6. 이용자의 권리</h2><p>이용자는 자신의 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 계정과 학습 기록의 삭제는 내 학습에서 직접 실행할 수 있으며, 그 밖의 요청은 개인정보 문의처로 접수합니다. 본인 확인 후 법령에서 정한 범위와 기간 안에 처리하며, 처리할 수 없는 사유가 있으면 이유를 안내합니다.</p></section>
 <section><h2>7. 보호조치와 침해 대응</h2><ul><li>인증 토큰은 승인된 API에만 전송합니다.</li><li>사용자별 소유권 검사와 비공개 응답의 캐시 방지를 적용합니다.</li><li>AI 키와 데이터베이스 비밀번호는 서버 환경변수로 분리합니다.</li><li>침해 사고가 확인되면 관계 법령에 따라 이용자와 관계기관에 알립니다.</li></ul></section>
 <section><h2>8. 담당자와 요청 방법</h2><p>개인정보 보호 담당: 되짚 개인정보 담당<br/>문의·권리 행사: <Contact/></p><p>위 연락처로 접수된 요청은 본인 확인 후 처리합니다.</p></section>
 <section><h2>9. 변경</h2><p>이 방침이 변경되면 시행일 7일 전 서비스에 알립니다. 이용자 권리에 중대한 변경은 30일 전에 알립니다.</p></section>
 </Page>}

export function AiPolicyPage(){return <Page eyebrow="생성형 AI 투명성" title="AI 이용 및 데이터 안내" version={legalPolicy.aiNoticeVersion}>
 <section><h2>1. AI를 사용하는 곳</h2><ul><li><strong>학습 대화:</strong> 질문에 답하고 확인할 관점과 수정 방향을 제안합니다.</li><li><strong>코드 수정 대화:</strong> 현재 코드와 최근 공개 테스트 결과를 바탕으로 수정안을 제안합니다.</li><li><strong>학습 평가:</strong> 제출 결과물, AI 대화, 근거·검증 기록과 직접 설명을 바탕으로 피드백을 생성합니다.</li></ul><p>AI가 만든 내용에는 “AI 코치”, “AI 제안” 또는 “AI 평가”임을 표시합니다.</p></section>
 <section><h2>2. AI에 전달되는 정보</h2><p>AI 요청에 필요한 질문, 공개 과제·자료, 사용자가 포함하기로 선택한 보고서, 현재 코드, 최근 테스트 결과, 제출·검증·설명 기록이 Google Gemini API에 전달될 수 있습니다. 로그인 이메일, 인증 토큰과 비공개 정답은 AI 요청에 포함하지 않습니다.</p></section>
 <section><h2>3. 현재 Gemini 데이터 처리 조건</h2>{geminiDataTier==='paid'?<p className={styles.statusGood}><strong>유료 데이터 처리 모드</strong>로 안내 중입니다. Google은 유료 Gemini API의 입력과 출력을 제품 개선에 사용하지 않지만 정책 위반 탐지를 위해 제한된 기간 처리할 수 있습니다.</p>:<p className={styles.statusWarn}><strong>무료 데이터 처리 모드</strong>로 안내 중입니다. Google 정책에 따라 입력과 출력이 제품·머신러닝 기술 개선에 이용되거나 승인된 검토자가 확인할 수 있습니다. 개인정보, 회사 기밀, 미공개 코드와 민감한 자료를 입력하지 마세요.</p>}<p>운영 환경의 결제 상태와 이 화면의 안내가 다르면 AI 기능을 중지하고 운영자에게 알려 주세요.</p></section>
 <section><h2>4. 이용자가 확인해야 하는 점</h2><ul><li>AI 답변과 코드는 틀리거나 존재하지 않는 근거를 제시할 수 있습니다.</li><li>AI 수정안은 자동으로 최종 결과물에 반영되지 않으며 직접 비교하고 테스트해야 합니다.</li><li>평가는 기록에서 관찰된 행동만 다루며 관찰되지 않은 항목을 능력 부족으로 보지 않습니다.</li><li>평가 결과는 학습 피드백이며 채용, 자격 인증 또는 전문적인 의사결정 결과가 아닙니다.</li></ul></section>
 <section><h2>5. 문의와 동의 철회</h2><p>AI 처리에 동의하지 않으면 로그인 후 학습 기능을 이용하지 않고 로그아웃할 수 있습니다. 저장된 AI 대화와 평가를 포함한 계정 기록은 내 학습의 계정 관리에서 직접 삭제할 수 있습니다. 다른 권리 행사는 <Contact/>로 요청하세요.</p><p>현재 데이터 처리 조건은 <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Gemini API 추가 약관</a>에서 확인할 수 있습니다.</p></section>
 </Page>}
