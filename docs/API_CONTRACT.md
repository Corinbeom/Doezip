> **현재 구현 상태 (2026-09-12):** F02a 공개 과제 조회, F01 me/bootstrap, F02b 세션 생성·workspace·공개 자료·draft 저장을 구현한다. F02c INITIAL 제출·제출본 조회도 구현한다. F04a 검산 시작·조회도 구현한다. F04b 검토 저장/제출도 구현한다. F05a INITIAL 평가 요청·조회·재시도도 구현한다. F05b는 성공 결과 GET /reports/{id} 조회와 기본 표시를 구현한다. F05c는 설정된 Gemini 어댑터를 연결하며 실제 계정 호출 검증은 별도다. FINAL 등 나머지 제품 경로는 기본 차단이다. [F02b 범위와 검증](F02B_REPORT_DRAFT.md)을 참고한다.

# API 계약 — 화면·상태·데이터 연결

**버전:** 1.0.0 · **상태:** 구현 제안. 실행 중인 서버의 자동 추출 결과가 아니다.
기계 판독 명세는 [OpenAPI](../contracts/openapi.yaml), 원본 컬럼은 [ERD](sources/ERD.md)를 따른다.

F00 당시에는 제품 API 없이 운영 경로 `GET /actuator/health`만 공개했다. 현재 F02a 과제 조회 GET이 추가됐으며, health는
실제 PostgreSQL 연결이 정상이면 `200 {"status":"UP"}`, 장애면 `503 {"status":"DOWN"}`을 반환한다.
운영 health 응답은 제품 DTO·오류 계약과 구분하고 내부 컴포넌트·DB 연결 정보는 노출하지 않는다.
프론트 제품 타입은 루트 `npm run api:generate`로 기존 OpenAPI에서 생성한다.

## 1. 공통 계약

| 항목 | 규칙 |
|---|---|
| base | `/api/v1` |
| JSON | camelCase, enum은 ERD 대문자 코드 유지 |
| ID | UUID. 서버 생성 ID를 임의의 프론트 예제 ID로 대체하지 않음 |
| 시간 | ISO 8601 UTC, 예 `2026-09-06T03:00:00Z` |
| 본문 | UTF-8, LF 정규화. contentHash는 해당 바이트의 SHA-256 |
| 길이 | 사용자 입력 상한은 Unicode code points. 한글·이모지 테스트 필요 |
| 인증 | `Authorization: Bearer <access-token>`; health, tasks 두 GET, learning-flows catalog GET만 예외 |
| 소유권 | 부모 session.user_id == 검증된 사용자. 타인 리소스는 404 |
| 캐시 | 개인 리소스·SSE는 `Cache-Control: no-store` |
| 요청 | unknown fields 거부. `userId`, `faultTemplateId`, `leaseToken` 수신 금지 |
| 오류 | `{code, message, requestId, details?}` |
| 상태 | 화면에서 step을 수정하지 않음. 서버 allowedActions는 UI 안내, 실제 API도 재검사 |

```json
{
  "code": "DRAFT_VERSION_CONFLICT",
  "message": "다른 변경사항이 먼저 저장되었습니다. 내용을 비교한 후 다시 저장하세요.",
  "requestId": "req-demo",
  "details": {"currentLockVersion": 4}
}
```

401은 토큰 만료/검증 실패, 404는 없거나 타인 소유, 409는 단계·버전·중복 충돌,
422는 참조·내용의 의미 검증 실패, 429는 운영 한도, 503은 일시 장애다.
토큰 만료 시 SDK refresh를 한 번 수행할 수 있지만 mutation을 무조건 자동 재실행하지 않는다.
`POST /sessions`는 중복 방지가 설계되지 않았으므로 시작 버튼 pending 잠금과 결과 보존이 필요하다.

## 2. 화면별 계약표

| 피처 | Method·경로 | 입력 / 응답 schema | 선행 조건·상태 변화 |
|---|---|---|---|
| F01 | POST `/me/bootstrap` | BootstrapRequest / User | 외부 JWT 검증, users 유일키로 upsert. email로 계정 병합 금지 |
| F01 | GET `/me` | — / User | 기존 사용자만 조회; 없으면 404 ACCOUNT_NOT_INITIALIZED |
| F02 | GET `/tasks` | — / TaskList | PUBLISHED 목록; 정답·자료 제외 |
| F02 | GET `/tasks/{taskId}` | — / Task | 공개 과제 설명·루브릭, 발행/보관 과제만 |
| F02 | POST `/sessions` | SessionCreateRequest / Workspace | PUBLISHED만 시작, ACTIVE/WRITING 생성 |
| F02 | GET `/sessions/{id}/workspace` | — / Workspace | draft, 공개 자료 목록, 진행 job/report ID 복원 |
| F02 | GET `/sessions/{id}/materials/{materialId}` | — / Material | 같은 과제·공개 단계 검사, 원문 줄 번호 제공 |
| F02 | PUT `/sessions/{id}/draft` | DraftSaveRequest / Draft | CAS, 성공 시 lockVersion+1 |
| F02 | POST `/sessions/{id}/document-versions` | DocumentCreateRequest / DocumentVersion | 예상 버퍼 확인, 불변 snapshot+seal |
| F02 | GET `/sessions/{id}/document-versions` | — / DocumentList | 현재 사용자 버전 이력 |
| F02 | GET `/sessions/{id}/document-versions/{versionId}` | — / DocumentVersion | 특정 버전만, 근거 클릭용 |
| F03 | GET `/sessions/{id}/messages` | afterSeq, limit / MessageList | seq 오름차순. 다음 조회 시작점 제공 |
| F03 | POST `/sessions/{id}/messages` | ChatRequest / SSE | 완료·현재 공개 context. clientMessageKey 중복 방지 |
| F03 | POST `/sessions/{id}/messages/{messageId}/cancel` | — / Message | 본인 ASSISTANT STREAMING만 취소; 이미 terminal이면 현 상태 반환 |
| F04 | POST `/sessions/{id}/challenge` | NoticeRequest / ChallengeRun | CHALLENGE + notice 확인. 기존 run이면 동일 run 반환 |
| F04 | GET `/challenge-runs/{runId}` | — / ChallengeRun | 제목·안내·모든 문장·본인 검토. 정답/변형코드 제외 |
| F04 | PUT `/challenge-runs/{runId}/reviews` | ReviewSaveRequest / ChallengeRun | IN_PROGRESS, 전체 검토 버퍼 CAS 저장 |
| F04 | POST `/challenge-runs/{runId}/submit` | ChallengeSubmitRequest / ChallengeRun | 관련 검토·인용 동결 |
| F05 | POST `/sessions/{id}/evaluations` | EvaluationRequest / Evaluation | Idempotency-Key 필수, snapshot 검증, 202 |
| F05 | GET `/evaluations/{evaluationId}` | — / Evaluation | job 상태만, 내부 snapshot/lease 제외 |
| F05 | POST `/evaluations/{evaluationId}/retry` | — / Evaluation | 재실행 허용 FAILED만; 같은 행·입력, 202 |
| F06 | GET `/reports/{reportId}` | — / Report | 성공 평가에 연결된 불변 리포트 |
| F07 | POST `/sessions/{id}/follow-ups` | — / FollowUps | INITIAL 성공, 질문 두 개 생성·공개 |
| F07 | GET `/sessions/{id}/follow-ups` | — / FollowUps | 이미 공개된 질문만; 생성 전 409 QUESTIONS_NOT_READY |
| F07 | POST `/defense-questions/{questionId}/answers` | AnswerRequest / Answer | 공개 질문·미응답, 확정 답변 1개 |
| F07 | POST `/sessions/{id}/condition-change/reveal` | — / ConditionReveal | 두 FOLLOW_UP 답변 완료, 새 자료 원자적 공개 |
| F02 | POST `/sessions/{id}/events` | EventRequest / EventReceipt | 클라이언트는 MATERIAL_OPENED만 기록 가능 |

위 표의 `{id}`는 문맥별 UUID다. 실제 경로 변수명·세부 schema는 OpenAPI가 기준이다.
모든 선언 API를 생성형 CRUD로 만들지 않는다. 목적 없는 PATCH/DELETE는 공개하지 않는다.

## 3. 자동 저장과 문서 제출

### 3.1 Draft

```json
{"markdown":"# 장애 분석\n현재 자료만으로 원인을 확정할 수 없다.","expectedLockVersion":2}
```

성공은 새 lockVersion과 contentHash를 반환한다. 프론트는 저장 응답보다 나중에 입력된 로컬 버퍼를 유지한다.
요청은 직렬화하고 1초 debounce를 적용한다. 409에서 자동으로 서버/로컬 중 하나를 덮어쓰지 않는다.
세션 단계/평가 잠금 확인과 CAS는 동일한 쓰기 트랜잭션 안에서 보장한다.

### 3.2 Snapshot

```json
{"checkpoint":"INITIAL","expectedDraftLockVersion":3,"expectedContentHash":"64자리-sha256"}
```

위 해시 문자열은 설명용 placeholder다. 실제 요청은 서버 저장 응답에서 받은 64자리 hex를 사용한다.
INITIAL은 WRITING에서, FINAL은 조건 변경 자료가 공개된 CONDITION_CHANGE에서만 생성한다.
FINAL 평가 실패 후 수정할 때에는 명시적인 새 학습 흐름/새 버전 정책이 필요하며,
이번 기본 경로는 동일 입력 재시도만 제공한다. 최신 문서를 과거 run에 끼워 넣지 않는다.

P0에서는 스냅샷을 생성하면서 즉시 seal한다. 생성 후 본문과 연결 근거를 수정하는 API는 없다.
같은 checkpoint + sourceDraftLockVersion + hash의 완료 요청을 다시 받으면 기존 버전을 반환한다.
이미 다른 입력으로 INITIAL이 제출된 뒤 다시 INITIAL을 요청하면 409다. 새 세션에서 다시 시작한다.

FINAL snapshot 후 조건 변경 답변 전까지 draft가 바뀔 수 있다. Q3 제출 시 현재 draft hash/version이
참조 FINAL 버전과 같은지 확인해, 이전 최종본을 실수로 연결하지 않게 한다. 다르면 새 FINAL 버전을 제출한다.

## 4. 검산 저장·제출

실제 요청 예시는 `fixtures/public/review-save.request.json`을 본다.

```text
expectedLockVersion
reviews[]
  statementId
  decision: KEEP | CORRECT | INSUFFICIENT_EVIDENCE
  reasonText
  replacementText
  evidence[]: materialId, lineStart, lineEnd, relation, userNote?
```

- `reviews`는 **전체 편집 버퍼**다. 요청에 없는 기존 검토 행은 편집 중 삭제된 것으로 처리한다.
- 같은 statementId는 1번만 허용. 같은 원본 범위 중복 인용은 422.
- 같은 문장 기존 row ID는 유지한다. 관련 인용 diff 갱신은 부모 run 잠금 안에서 함께 처리한다.
- KEEP은 replacement null. 나머지 두 판단은 공백이 아닌 수정문 필수.
- reasonText도 공백/공백문자만으로 제출할 수 없다.
- 근거가 0개여도 검토는 저장한다. 근거를 제시하지 않은 점은 평가에 남긴다.
- 인용 구절은 클라이언트에서 받지 않고 서버가 `material.contentMarkdown` 줄 범위에서 추출한다.
- lineStart/lineEnd는 1-based inclusive, `lineEnd >= lineStart`, 원문 범위 이내.
- 자료는 같은 task, 해당 시점 공개 자료만. CONDITION_CHANGE를 임의 ID로 인용하면 404/422.
- 수정·제출은 같은 challenge_runs 부모 행을 잠근다. 제출과 경합한 늦은 저장은 409.

제출 전 UI는 미검토 개수를 알려준다. 모든 문장을 의무 검토시키지는 않는다.
제출 후 `SUBMITTED`, submittedAt 기록, lockVersion 증가, 검토·인용 수정 불가.
이미 제출된 run에 submit 재전송은 기존 상태를 반환한다. 사용자의 결과를 다시 변경하지 않는다.

## 5. 채팅 SSE

F03a의 현재 구현 범위는 ACTIVE/WRITING이다. includeCurrentDraft는 서버에 저장된 초안만 선택적으로 포함하며 기본 false다. 세션당 20회 요청을 허용하므로 기본 목록 50개로 현재 전체 이력을 복원한다. 조회 페이지네이션 계약도 처리한다. 자세한 제한·검증은 [F03a](F03A_LEARNING_CHAT.md)를 따른다.

### 5.1 정상 응답

`Content-Type: text/event-stream`, `Cache-Control: no-store`. 프론트 `fetch` streaming parser 사용.

```text
event: start
data: {"userMessageId":"UUID","assistantMessageId":"UUID"}

event: delta
data: {"assistantMessageId":"UUID","delta":"현재 자료에서는 "}

: heartbeat

event: done
data: {"message":{"id":"UUID","seqNo":2,"role":"ASSISTANT","contentText":"완성된 응답","status":"COMPLETED","replyToMessageId":"UUID","createdAt":"ISO8601","completedAt":"ISO8601"}}
```

이 예시의 UUID/ISO8601은 실제 값이 아니라 구조 설명이다. `ChatStart`, `ChatDelta`, `ChatDone` schemas가 계약이다.
부분 TCP chunk가 이벤트 한 개와 같다고 가정하지 않는다. 줄 경계·UTF-8 decoder·버퍼를 유지한다.

### 5.2 실패

SSE 헤더 전 인증/입력 실패는 JSON 오류. 헤더 후 모델 실패는 `event: stream_error`, data는 Error schema다.
사용자 토큰을 event/data/log에 포함하지 않는다. 부분 메시지는 FAILED/CANCELLED로 남기고 평가에서 제외한다.
연결 단절 시 같은 세션 GET messages로 상태를 복원한다. delta 전부 replay하는 기능은 없다.

같은 clientMessageKey가 있으면:
- 완료 응답: 저장된 terminal 메시지를 start/done으로 반환, 모델 재호출 없음.
- STREAMING: 409 MESSAGE_IN_PROGRESS, details.assistantMessageId 제공.
- FAILED/CANCELLED: 해당 terminal 상태를 done 메시지로 반환. 새 생성은 새 key로 명시 요청.
- 같은 key인데 다른 사용자 입력: 409 MESSAGE_KEY_CONFLICT.

다른 key라도 같은 세션에 STREAMING 응답이 있으면 409. 부분 UNIQUE index는 이 제약의 DB 안전장치다.
서버 생성 취소와 모델 응답 도착이 경합하면 terminal 상태 조건부 UPDATE로 덮어쓰기 방지한다.

## 6. 평가와 멱등성

```http
POST /api/v1/sessions/{sessionId}/evaluations
Authorization: Bearer ...
Idempotency-Key: {uuid}
Content-Type: application/json
```

```json
{"phase":"INITIAL","documentVersionId":"UUID"}
```

INITIAL 선행 조건: 봉인 INITIAL 문서, 제출 검산, 메시지 STREAMING 없음, 현재 CHALLENGE/FEEDBACK.
FINAL 선행 조건: 두 FOLLOW_UP 답변, 조건 공개, Q3 답변, 답변과 일치하는 봉인 FINAL 문서, FINAL_REVIEW.
세션당 QUEUED/RUNNING은 하나. 정상 성공한 같은 phase를 새 키로 무한히 재평가하는 API는 제공하지 않는다.

**idempotency 처리 순서**

1. 소유권을 검사하고 같은 session/key의 기존 run을 먼저 찾는다.
2. 기존 run이 있으면 phase/documentVersionId가 같을 때 기존 run 반환, 다르면 409.
3. 기존 요청 재전송 때 나중에 추가된 chat/공개 자료로 새 fingerprint를 만들지 않는다. 원래 동결 입력을 재사용한다.
4. 새 key일 때만 현재 상태를 검증하고 snapshot/설정/fingerprint를 확정한다.
5. 다른 active run이 있으면 409 EVALUATION_IN_PROGRESS에 기존 evaluationId를 알려준다.

input_snapshot_json에는 보고서 ID/hash, 완료 message IDs, 공개 material IDs, 검산 응답·인용 IDs,
확정 defense answer IDs, event cutoff, 코드/모델/프롬프트 버전이 들어간다. 클라이언트는 이 목록을 정하지 않는다.

`GET /evaluations`는 내부 입력이나 진행률 추측치를 노출하지 않는다. `QUEUED/RUNNING`이면 2초 간격 조회한다.
성공하면 reportId를 사용한다. 리포트 생성이 끝나기 전 partial 결과를 완성 리포트로 표시하지 않는다.

FAILED retry는 동일 run을 QUEUED로 되돌린다. 현재 active job 없음과 retryable을 확인한다.
자동 시도는 최대 3회, 이후 일시 오류에 대한 명시 재실행 1회로 **run당 총 4회**를 상한으로 제안한다.
`attempt_count`는 누적하고 초기화하지 않는다. 영구 오류나 count가 4 이상이면 retryable=false다.
worker는 실패 후 count<3일 때만 자동 재queue하고, 3 이상이면 FAILED로 끝낸다.
별도로 세션·계정 비용 한도를 적용한다. 이 상한은 새 구현 제안이며 기존 ERD 컬럼 안에서 처리한다.

## 7. 되묻기와 자료 공개

- POST follow-ups는 초기 평가 성공 후 2개 질문을 생성·공개한다. 이미 있으면 같은 질문 반환.
- 질문 생성 실패 시 검수 템플릿을 사용하고 `generationMode: TEMPLATE`으로 표시한다.
- 아직 세 번째 CONDITION_CHANGE 질문은 response에 넣지 않는다. 개별 hidden ID도 보내지 않는다.
- FOLLOW_UP 답변에 documentVersionId는 null/생략. 두 개를 각각 확정한다.
- 같은 질문·같은 정규화 답변·같은 doc FK의 재전송은 기존 답변, 내용이 다르면 409 ANSWER_ALREADY_SUBMITTED.
- reveal은 두 답변 후 실행. 질문3.revealedAt, session.conditionReleasedAt, currentStep을 한 transaction으로 변경.
- 반복 reveal은 기존 공개 결과를 반환. 공개된 시점을 되돌리지 않는다.
- Q3는 같은 세션의 최신 봉인 FINAL 문서를 참조하고, 수정 이유를 answerText로 남긴다.
- FINAL 요청은 Q3와 같은 documentVersionId여야 한다.

## 8. 리포트와 근거 이동

`Report`는 UI용 DTO다. DB 원본 Entity와 같은 모양이 아니다.
- areas는 네 영역. 하위 dimension에는 code/state/rationale/gap/nextAction과 observations.
- observation 주 대상은 ERD의 6개 FK 중 하나다. API에서는 subjectType+subjectId로 표현한다.
- source는 보조 원본 자료 인용. 보안 검사 후 공개 가능한 자료만 제공한다.
- CLAIM은 향후 예약이므로 현재 기본 리포트에서 생성하지 않는다.
- FAULT_ATTEMPT는 같은 session의 challenge GET에서, DOCUMENT_VERSION은 버전 GET에서 조회한다.
- CHAT_MESSAGE는 messages에서 해당 seq/ID로 이동한다. 앱 내부 resolver는 이미 권한 확인된 ID 목록만 사용한다.
- DEFENSE_ANSWER는 리포트 excerpt와 소속 질문/답변 데이터로 이동한다.
- SESSION_EVENT는 이 MVP에서 개별 공개 상세 API가 없으므로 검증된 excerpt/explanation만 표시한다. 없는 URL로 연결하지 않는다.

같은 검산 결과의 INITIAL/FINAL은 `UNCHANGED`; 새로 수행한 Defense는 `NEWLY_OBSERVED`다.
향상이라는 용어는 근거가 있을 때만 사용한다. sample fixture는 `sample: true`와 예시 배너가 필수다.
공개 리포트에도 raw GroundTruth, repair_criteria_json, variant_code, 시스템 prompt를 복사하지 않는다.

## 9. 구현 전 계약 테스트

OpenAPI 형식 확인과 다음 비즈니스 조건은 별개다. 스키마만 통과했다고 권한·학습 평가가 맞는 것은 아니다.
unknown field, 다른 과제 자료, 숨긴 자료, KEEP+replacement, 빈 이유, 줄 범위 역전,
제출 이후 수정, 동일 key 다른 입력, 만료 worker 결과, 정상 문장 오탐, 근거 없는 LLM ID를 통합 테스트한다.

## 원문과 추가 설계의 경계

원문 기획의 학습 순서와 원본 ERD의 관계·상태는 유지했다.
HTTP 경로, DTO, bootstrap 액션, SSE 프레임, input 상한, 재전송 정책, 동일 화면 buffer 교체 방식은
2인 구현을 위해 이 패키지에서 새로 제안한 계약이다. 변경 시 OpenAPI와 fixture도 같이 바꾼다.

### F02c 구현 범위 (2026-09-11)

POST/GET `/api/v1/sessions/{sessionId}/document-versions`를 구현했다. 인증과 소유권 검사가 필요하다.
INITIAL만 생성하며 FINAL/REVISION은 구현하지 않았다. 평가 시작은 F05a를 따른다. 생성 성공과 동일 입력 재전송은 기존 계약대로 201이다.
소유자 세션 행 잠금 안에서 버전·해시를 검사한 뒤 저장과 WRITING → CHALLENGE 전환을 함께 커밋한다.
다른 입력의 중복 INITIAL은 DOCUMENT_ALREADY_SUBMITTED(409), 버전/해시 불일치는 각각
DRAFT_VERSION_CONFLICT/DRAFT_CONTENT_CONFLICT(409), 빈 본문(Unicode 공백만 포함)은 EMPTY_DOCUMENT(422)다.
최초 제출 이후 status는 ACTIVE이며 initialReportId는 리포트 발행 전 null이며 F05b 원자 발행 후 실제 ID를 제공한다.
제출본은 사용자 작성 보고서이고 검산 초안·비공개 정답과는 별개다. 응답은 no-store이며 수정 API는 없다.

### F04a 검산 시작·조회

POST `/api/v1/sessions/{id}/challenge`, GET `/api/v1/challenge-runs/{id}`를 구현했다.
`challenge-notice-v1`과 acknowledged=true를 엄격히 검사한다. 사용자 소유 세션에 최초 제출본이 있고
ACTIVE/CHALLENGE 상태여야 새 run을 배정한다. 세션 행 잠금과 UNIQUE(session_id)로 중복 시작을 막고
같은 요청에는 기존 run을 반환한다. GET은 소유자만 가능하고 응답은 no-store다.
안내 확인 전 workspace에는 초안 본문·제목·템플릿 ID를 넣지 않는다. 확인 후 run ID와 공개 문장만 제공한다.
variant_code·오류 키·정답·오류 개수는 응답에서 제외한다. 초안 준비 실패/해시 불일치는 CHALLENGE_UNAVAILABLE(503)이며 run을 저장하지 않는다.
F04a에는 검토 저장 API가 없으므로 reviews는 실제로 비어 있고 submittedAt은 null이다. 검토 저장·제출은 후속 구현이다.

F05a 구현과 미구현 평가기 경계는 [F05a 기록](F05A_EVALUATION_LIFECYCLE.md)을 따른다. workspace.activeEvaluationId는 복원을 위해 terminal 상태를 포함한 최신 요청 ID를 제공한다.

F05b GET /reports/{id}는 성공 평가의 소유자만 조회하며 no-store, 타인/없는 ID는 REPORT_NOT_FOUND(404)다. 공개 결과 스키마는 기존 계약을 사용한다. INITIAL 및 DOCUMENT_VERSION/FAULT_ATTEMPT 관찰만 발행하며 FINAL·기타 관찰 대상은 미지원이다. [결과 검증 경계](F05B_EVALUATION_RESULTS.md)를 따른다.

F05c 오류/호출 설정은 [AI 설정](AI_SETUP.md)을 따른다. 공개 Evaluation/Report 계약은 유지하며 원문 제공자 오류나 키를 응답에 넣지 않는다.

## F08a 구현 연습

`/coding-workspaces`와 Coding* 계약을 추가한다. 기존 보고서 세션 API는 변경하지 않는다.
코드 버전 CAS, AI 요청 key/예산, 브라우저 보고 실행 결과와 제출 잠금은 [F08a](F08A_CODING_WORKSPACE.md)를 따른다.

## P01 버전별 수행 흐름
`/learning-flows`의 생성/목록/상세, notes/hints/submit/answers/feedback/practice를 추가했다. `GET /learning-flows/catalog`만 공개하며 안정적인 catalogId, 콘텐츠 version, 유형·난도·예상 시간·태그와 공개 문제 설명을 반환하고 힌트는 빈 목록이다. 나머지는 인증·소유권이 필요하고 개인 응답은 no-store다. feedback 요청은 비동기 상태를 반환하고 GET으로 조회한다. 모드·단계·버전 및 고정 근거 인터페이스는 OpenAPI와 [P01 명세](P01_LEARNING_FLOW.md)를 따른다. 기존 세션·코딩 계약은 보존하며 새 흐름에 속한 작업의 단독 제출 우회는 409다.
