> **F00 당시 범위 (2026-09-06, 과거 기록):** 해당 작업은 [개발 환경 구축](F00_ENVIRONMENT.md)만 수행한다. 기존 전체 MVP·ERD·seed·AI·배포 계획은 후속 작업이다. 현재 실행 명령은 [루트 README](../README.md)를 따른다.

# 테스트·배포·운영 런북

이 문서는 **앱 구현 후 실행할 검증 절차**다. 문서의 형식 검사와 실제 서비스 테스트는 구분한다.

현재 실행 명령은 루트 README와 `npm run check`를 따른다. 과제 조회 검증은 [F02a 기록](F02A_TASK_BROWSE.md)에 있으며, 아래 초기 구축·전체 제품 검증 계획과 구분한다.

## 1. D1 로컬 시작 (초기 계획)

1. Node 24, Java 21, Docker, Git을 두 개발 환경에 동일하게 준비한다.
2. 모노레포를 만들고 Node 의존성 lockfile과 Gradle wrapper/BOM을 고정한다.
3. `templates/compose.local.yml`을 기준으로 PostgreSQL만 실행한다.
4. 전체 22개 테이블의 Flyway migration과 검수한 가상 seed를 작성한다. 이 패키지에는 전체 DDL이 없다.
5. 환경변수·Spring 설정 템플릿을 실제 앱에 맞게 적용한다. 로컬 비밀번호를 운영에 쓰지 않는다.
6. Google 로그인, ES256 서명, issuer/audience/JWKS, OAuth redirect를 확인한다.
7. 실제 모델로 채팅과 구조화 응답을 각각 1회 확인한 뒤 모델·설정을 고정한다.

```bash
# 이 패키지에서 실행할 수 있는 것은 DB 준비와 문서 검증이다.
docker compose -f templates/compose.local.yml up -d
python tools/validate_pack.py

# 아래는 실제 앱 소스를 생성한 레포에서만 실행할 수 있다.
# (cd apps/web && npm ci && npm run dev)
# (cd apps/api && ./gradlew bootRun)
```

## 2. PR CI

### 문서·계약 검사

`tools/validate_pack.py`는 공개 fixture 구조, 로컬 schema 참조, seed 관계·해시·인용,
미공개 데이터의 초기 화면 제외, 원본 문서 checksum을 검사한다.
OpenAPI 전체 메타스키마 적합성을 검사하는 도구는 아니므로, 별도의 표준 validator 검사를 CI에 추가한다.
계약이 바뀌면 fixture와 클라이언트 타입도 갱신한다.

### 웹 검사 — 앱 구현 후

TypeScript, lint, Vitest, production build를 실행한다. 핵심 UI 검사는 저장 충돌, 메시지 스트리밍,
SSE 청크 분할·UTF-8 경계, 리포트 상태, 샘플 배너다.
빌드 결과에 비공개 seed·정답 키·조건 변경 자료가 포함되지 않는지도 검사한다.

### API 검사 — 앱 구현 후

Gradle 테스트와 Spring Security 테스트를 실행한다. FK·CHECK·부분 인덱스는
Testcontainers의 실제 PostgreSQL에서 검사한다. H2 결과만으로 PostgreSQL 무결성이 검증됐다고 보지 않는다.
AiGateway mock으로 timeout, invalid JSON, 재시도, lease 만료를 테스트한다.
PR마다 실제 LLM 호출을 강제하지 않는다. 실모델 검수는 예산을 둔 별도 실행으로 관리한다.

## 3. 출하 차단 테스트

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| SEC01 | 타인 session/report/document/challenge ID 접근 | 조회·쓰기 404, 내용 미노출 |
| SEC02 | 잘못된 issuer, audience, 서명, 만료 토큰 | 401 |
| SEC03 | 미공개 자료를 직접 조회·인용·AI에 요청 | 원문·제목·context 미노출 |
| SEC04 | 과제·검산 응답 검사 | 정답 키·변형 코드·비공개 기준 없음 |
| SEC05 | Markdown script/악성 URL, 평가 지시문 삽입 | 브라우저 실행 금지, 시스템 지시로 취급하지 않음 |
| DOC01 | 오래된 draft lock으로 저장 | 409, 최신 DB와 사용자 로컬 내용 보존 |
| DOC02 | snapshot 뒤 draft 수정 | 과거 본문·해시·리포트 불변 |
| DOC03 | FINAL 뒤 draft 수정 후 Q3 제출 | 오래된 최종본 연결 차단 |
| CH01 | 다른 초안 문장·다른 과제 자료 전달 | 검증 거부 |
| CH02 | 없는 줄, 역전 범위, 중복 인용 | 422 |
| CH03 | KEEP인데 수정문 포함, 공백 판단 이유 | 422 |
| CH04 | 검산 저장·제출 경합 | 제출 뒤 응답·인용 동결 |
| CH05 | 검토 없이 제출 | 정상 검증 완료로 표시하지 않음 |
| CH06 | 정상 문장의 타당한 보완 | 무조건 오탐 처리하지 않음 |
| AI01 | 같은 메시지 key 재전송 | 같은 입력은 재사용, 다른 입력은 409 |
| AI02 | SSE 단절·취소·종료 경합 | terminal 상태 보존, GET으로 복원 |
| AI03 | 모델이 없는 근거 ID/인용문 반환 | 검증 거부, 가짜 리포트 발행 금지 |
| JOB01 | 평가 key 재전송 후 대화가 늘어남 | 기존 run·기존 snapshot 재사용 |
| JOB02 | 세션당 평가 두 개 동시 요청 | active job 한 개 |
| JOB03 | lease 만료 뒤 이전 worker 완료 | 결과 발행 거부 |
| JOB04 | 결과 저장 중 프로세스 중단 | 부분 성공 리포트 없음 |
| JOB05 | 429, 5xx, timeout | 제한된 재시도, draft·입력 보존 |
| JOB06 | 자동 3회 + 명시 재시도 1회 모두 실패 | 총 4회에서 종료, retryable=false |
| DEF01 | Q1/Q2 완료 전 Q3·추가 자료 요청 | 차단 |
| DEF02 | 아직 수행 기회가 없는 Defense | NOT_OBSERVED |
| REP01 | 같은 검산 결과로 INITIAL/FINAL 비교 | 새 향상으로 중복 계산하지 않음 |
| REP02 | 리포트 관찰 근거 클릭 | 같은 세션 실제 원문 또는 명시적 비링크 설명 |
| E2E01 | 독립된 두 계정의 전체 수행 | 데이터가 섞이지 않고 최종 리포트 완료 |

## 4. 실제 LLM 검수용 8가지 사례

과제 자료와 판정 기준을 두 사람이 먼저 합의한다. **UI 샘플 리포트의 상태값은 평가 정답 데이터가 아니다.**

| 사례 | 기대 관찰 |
|---|---|
| 오류 문장 모두 수용 | 실제 오류 미탐. 보고서 완성만으로 충분한 근거가 되지 않음 |
| 수치만 정확히 수정 | 일부 탐지·수정 성공. 근거 없는 원인 단정은 남음 |
| 수치 정정·원인 단정 철회·근거 연결 | 해당 검증 행동의 긍정적 근거 |
| 정상 문장까지 전부 오류 신고 | 실제 부당한 지적만 오탐, 타당한 보완은 별도 검수 |
| “DB CPU 정상 → DB는 절대 원인 아님” | 새로운 근거 없는 단정. 수정 성공으로 단정하지 않음 |
| 근거 ID는 맞지만 설명과 원문이 무관 | 형식 검사와 의미 검사를 구분 |
| 긴 프롬프트지만 자료 검증 없음 | 길이만으로 높은 평가를 주지 않음 |
| 배포 정보를 받아 가설 조정 | 조건 변경 대응 관찰, 단일 원인 확정으로 과대평가하지 않음 |

실모델 실행마다 모델·템플릿·평가기 버전, 입력 해시, 결과, 지연, 사용량을 기록한다.
동일 입력의 판정이 반복해서 바뀌면 원문 근거와 상태 집계 규칙을 점검한다.
표본과 정의 없이 “평가 정확도 90%” 같은 수치를 발표하지 않는다.

## 5. 배포

| 환경 | DB / Auth / AI |
|---|---|
| 로컬 | Docker PG, 개발용 인증, 개발 API 키 또는 mock |
| Preview | 개발 전용 데이터와 작은 호출 예산. 운영 데이터 없음 |
| Demo/Production | 별도 secret, 실제 도메인 allowlist, 단일 API 인스턴스 |

웹은 Vercel, API는 상시 실행 환경, DB는 관리형 PostgreSQL을 제안한다.
실제 비용·유휴 정책·quota는 계정에서 확인한다. 무료 상시 운영이 보장된다고 가정하지 않는다.

### D3부터 확인할 것

OAuth redirect, Authorization header와 CORS, 프록시의 SSE buffering/heartbeat,
worker의 요청 종료 후 실행과 재시작 회수, DB 연결 상한, health 정보 노출 범위를 확인한다.
D13에 처음으로 외부 도메인에서 스트리밍을 시도하지 않는다.

### 릴리스 순서

1. 직전 정상 버전 커밋·이미지와 DB 백업·복구 방법을 확인한다.
2. migration의 데이터 손실 여부와 이전 코드 호환성을 검토한다.
3. Flyway 적용, API 기동과 health 확인 후 웹을 배포한다.
4. 두 계정으로 채팅·검산·리포트까지 수행하고 데모 tag를 고정한다.

스키마 변경이 있으면 코드만 rollback해도 안전하다고 가정하지 않는다.
데모 기간 중 위험한 destructive migration을 새로 추가하지 않는다.

## 6. 장애 대응

| 증상 | 확인 | 대응 |
|---|---|---|
| 채팅이 계속 로딩 | 메시지 상태, timeout, 네트워크 | 취소/실패 표시, draft 유지, GET 복원 |
| 평가가 계속 RUNNING | lease, worker, 로그 | 만료 회수, 이전 작업자 발행 차단, 제한된 재시도 |
| 모델 429 | quota, Retry-After, 사용량 | 대기 안내와 예산 상한 준수 |
| 평가 JSON·근거 불일치 | schema, ID, 인용 원문 | 제한 재시도 후 FAILED. 가짜 성공값 대체 금지 |
| 질문 생성 실패 | timeout, parsing | TEMPLATE 표시, INITIAL 리포트 보존 |
| 자동 저장 409 | 중복 탭, expected lock | 사용자 비교 후 재저장, 자동 덮어쓰기 금지 |
| 인증 실패 | issuer, audience, JWKS, 키 회전 | 설정 수정. 인증 검증을 끄고 우회하지 않음 |

운영 로그에는 requestId/sessionId/runId, 상태·지연·토큰 수만 남긴다.
인증 토큰·API 키·사용자 전체 원문은 로그에 기록하지 않는다.

## 7. 외부 사용자 검증

목표는 최대 5명이 흐름을 이해하고 끝까지 수행하는지 확인하는 것이다.
기획안의 수요·결제 의향 지표는 검증 목표이지 달성된 성과가 아니다.

테스트 전에 AI에 전달되는 정보, 저장 범위, 삭제 요청 방법, 훈련 오류 가능성을 안내한다.
보존 기간은 팀에서 정한 뒤 명시한다. 검산이 별도 문서라는 이해, 근거 연결, 실제 문서 수정,
피드백 납득 여부, 중도 이탈 지점을 관찰한다. 성실성·지능을 추론하지 않는다.

## 8. 발표 리허설

실제 실행과 fixture/녹화 자료를 구분한다. 검산 오류는 사전 설계한 훈련 초안임을 설명한다.
DB 20%와 초안 92%, 근거 없는 원인 단정 두 사례를 원본 자료와 함께 보여준다.
새 정보 공개→실제 수정본→리포트 비교를 연결하되, 같은 검산을 재사용한 결과를 향상이라고 말하지 않는다.
네트워크 실패 대비 영상은 실제 기능을 녹화하고, 재생 중인 것을 live라고 부르지 않는다.

## F02b 실제 인증 경계·저장 검증

현재 검사는 [F02b 기록](F02B_REPORT_DRAFT.md)을 따른다. `npm run check`는 테스트용 웹 설정을 사용하고 Playwright가 로컬 JWKS issuer·실제 API·웹을 실행한다. CI에서도 외부 Google 키 없이 실행한다. 타인 읽기/쓰기404, CAS409, 실패 초안 보존, 서버 저장본 복원, 모바일·안전한 텍스트 표시를 확인한다.

F02c는 `tests/e2e/submission.spec.ts`와 SessionIntegrationTest에서 저장 후 제출·재조회, 실제 서버 저장 후 응답 유실 재시도, stale 버전·해시 차단, 동시 저장/제출 및 중복 제출, 소유권·DB UPDATE 차단·HTML 미실행을 검사한다. 실제 Google 계정 검증과 별개이며 [검증 기록](F02C_INITIAL_SUBMISSION.md)에 실행 결과를 남긴다.

F04a 검산 시작/열람 검사는 `tests/e2e/challenge.spec.ts`와 SessionIntegrationTest에 있다. 안내 확인 전 미노출, 실제 배정·복원·응답 유실 재시도, 사용자 보고서 보존, 소유권, 동시 시작, 단계·해시 검사, 320px 화면을 확인한다. [F04a 실행 기록](F04A_CHALLENGE_START.md)을 참고한다.

F04b 검토·인용·제출 검사는 SessionIntegrationTest와 tests/e2e/reviews.spec.ts에 있다. 실행 결과와 실제 Google 검증 구분은 [F04b](F04B_CHALLENGE_REVIEW.md)를 따른다.

F05a: SessionIntegrationTest의 평가·lease 검사와 tests/e2e/evaluation.spec.ts를 실행한다. 실제 evaluator 미연결 실패가 정상이며 성공 점수를 기대하지 않는다. [기록](F05A_EVALUATION_LIFECYCLE.md).

## F05b 결과 검증·저장·조회
`npm run check`에 PostgreSQL 원자 발행/롤백/소유권 검사, 리포트 단위 검사, 브라우저 UI 경계 검사를 포함한다. 기본 검사의 worker는 AI 비활성 상태의 미연결 실패를 검증하며 sample GET 응답을 사용한 화면 검사를 실제 AI 성공으로 표시하지 않는다. 상세 검증과 미실행 범위는 [F05b 기록](F05B_EVALUATION_RESULTS.md)을 따른다.

## F05c 실제 AI 검사
기본 check는 외부 AI를 호출하지 않는다. SDK HTTP 경계와 PostgreSQL worker 통합 검사를 포함한다. 명시적 `npm run test:ai`는 가상 공개 데이터로 실제 Gemini를 1회 호출한다. 키가 없으면 실행 불가이며 성공/skip으로 대신하지 않는다. [AI 설정](AI_SETUP.md)과 [F05c 검증 기록](F05C_AI_EVALUATION.md)을 따른다.

## I01 한 checkout 통합 검증
기본 전체 검사는 npm run check, 선택적 실제 AI 브라우저 검사는 npm run test:flow:ai다. 가상 과제·테스트 JWT를 사용하며 실제 Gemini/DB/worker/결과 API는 대체하지 않는다. Google OAuth 공급자 화면의 실제 로그인과 모델 품질 평가는 별도다. 실행 결과와 이전 브랜치 관계는 [I01 기록](I01_INTEGRATION.md)을 따른다.
