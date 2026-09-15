# F03a 실제 AI 대화와 보고서 작성

2026-09-14, `feature/F03a-learning-chat`, 기준 `origin/develop` = `c49abce28b3a43f2c0e0034917ddba64914ffcd0`.
별도 worktree에서 구현했다. F05d 평가 품질·F06a 원문 열람·F06b 한글 용어의 미커밋 변경은 포함하지 않았으며 develop 및 기존 실행 화면에는 아직 통합하지 않았다.

## 사용자 흐름

과제를 시작한 뒤 보고서 작성 화면의 **AI와 분석하기**에서 질문한다. 응답은 점진적으로 표시되고 서버에 저장된다. 새로고침하면 완료·실패·중지·진행 상태와 저장된 내용을 다시 읽는다. 실패해도 질문 입력과 별도로 작성한 보고서는 유지한다.

공개된 과제 자료와 완료된 대화가 AI에 전달된다. **저장된 내 보고서 초안도 AI에게 전달**은 기본 해제이며, 선택하면 보고서 저장이 끝난 뒤 요청할 수 있다. 저장하지 않은 브라우저 편집 내용은 보내지 않는다. AI 응답은 보고서를 자동 수정하지 않으며 사용자가 근거를 검토해 자신의 글에 반영한다.

이번에는 ACTIVE/WRITING에서만 새 대화를 허용한다. 최초 제출 후에는 저장된 대화만 읽는다. 진행 중 응답이 있으면 보고서 최초 제출을 막으며 응답을 기다리거나 중지해야 한다.

## 저장·호출 경계

- 기존 OpenAPI `GET/POST /sessions/{id}/messages`, `POST /sessions/{id}/messages/{messageId}/cancel` 계약을 구현한다. POST는 start/delta/done/stream_error SSE이며 개인 응답은 no-store다.
- V14 migration은 `chat_messages` 한 테이블만 추가한다. 세션 내 순번/요청 key 유일성, 같은 세션 reply FK, 진행 응답 1개 부분 UNIQUE index를 적용한다. 전체 ERD·seed 완료가 아니다.
- 소유 세션 잠금 안에서 단계·중복·사용량을 확인하고 요청/응답 행을 예약한다. 모델 대기 중에는 DB 트랜잭션을 유지하지 않는다.
- 같은 key/같은 입력은 저장 결과를 재전송하며 모델을 다시 호출하지 않는다. 진행 중이면 409와 assistantMessageId, 같은 key의 다른 입력이면 409다. 실패/중지 이후 새 생성은 새 key를 사용한다.
- partial 내용은 같은 응답 행에 갱신한다. terminal 상태를 조건으로 보호하여 취소 후 늦은 토큰이 상태/본문을 덮어쓰지 않는다. 중지는 서버 기록을 즉시 확정하며 공급자 호출은 다음 처리 지점 또는 제한 시간에 정리된다. 공급자 과금 취소를 보장하는 기능은 아니다.
- 재시작 등으로 90초 이상 남은 진행 행은 조회/다음 요청/제출 시 FAILED로 복구한다. 이전 토큰 전체를 다시 스트리밍하지 않고 GET으로 상태를 복원한다.
- 사용자당 UTC 일 20회, 전체 UTC 일 100회, 세션당 20회 요청을 기본 상한으로 둔다. 새 요청 예약 시 차감하며 실패/취소도 포함한다. 출력 4,096 토큰/20,000 UTF-16 code units, 입력 context UTF-8 100KB, HTTP/전체 호출 60초 제한을 둔다. 초과하면 실패로 기록하고 가짜 완료로 바꾸지 않는다.
- GeminiChatAdapter는 기존에 해석된 Google GenAI SDK 1.37.0을 사용한다. 모델 원본 finishReason을 확인하여 종료 신호 없는 스트림을 완료로 인정하지 않는다. 검색/함수 도구는 등록하지 않고 thought part를 표시하지 않는다. SDK 내부 재시도는 1 attempt다. [공식 스트리밍 예제](https://github.com/googleapis/java-genai#stream-generated-content)를 참고했다.
- learning context는 공개 task DTO, INITIAL 자료, 성공한 이전 대화 쌍, 선택한 저장 초안만 조립한다. 검산 템플릿·비공개 정답·미공개 조건 자료·평가 snapshot을 읽지 않는다. 시스템 프롬프트는 공개 대화 테이블에 저장하지 않는다.
- 프론트는 공통 인증 계층의 신뢰된 API 주소만 사용한다. UTF-8/CRLF/chunk 경계를 유지해 SSE를 파싱하고 개인 Query·stream은 계정/화면 전환 시 정리한다. 사용자·AI 텍스트를 HTML로 실행하지 않는다.

## 실행

이 worktree의 루트 `.env`에서 기존 서버용 `GEMINI_API_KEY`와 별도로 다음을 설정한다. 실제 키는 Git에 넣지 않는다.

```dotenv
AI_CHAT_ENABLED=true
AI_CHAT_MODEL=gemini-3.5-flash-lite
AI_CHAT_DAILY_CALL_LIMIT=20
AI_CHAT_GLOBAL_DAILY_CALL_LIMIT=100
```

실행: `npm install` → `npm run db:up` → `npm run dev`. Google 로그인은 기존 AUTH_SETUP.md 설정을 따른다. 일반 실행의 true는 실제 요청을 허용한다. 평가용 `AI_EVALUATION_ENABLED`와 독립적이다.

검사: `npm run check`는 학습 AI·평가 AI와 키를 비활성화한다. 명시적 `npm run test:chat:ai`만 가상 자료로 실제 Gemini 1회 + Testcontainers PostgreSQL 저장·복원·중복 요청을 검사한다. 키가 없으면 실패하며 성공/skip으로 대체하지 않는다.

## 검증 기록

실제 Gemini 검증: 2026-09-14 `npm run test:chat:ai` 통과. 메시지 2개 저장, 응답 260자, 저장본 재조회·같은 key replay·보고서 보존을 확인했다. 실제 Google 로그인 UI를 이번 검사로 검증한 것은 아니다. 고정 가상 입력 1건의 연결·저장 검증이며 답변의 근거 정확성과 학습 품질 검수를 완료한 것은 아니다.

최종 `npm run check` 통과:

- 계약·공개 fixture 26개 검증 및 생성 타입 차이 검사 통과.
- 웹 lint·typecheck·단위 테스트 86개·production build 통과.
- 백엔드 테스트 80개(실패/skip 0), PostgreSQL Testcontainers·JAR build 통과. 마지막 실행에서 동일한 백엔드 결과는 Gradle UP-TO-DATE로 재사용했다.
- Playwright 39개 통과. 실제 API의 미설정 오류, 타인 접근 차단, 보고서 보존/복원과 명시적 chat UI 경계 응답을 검사했다.
- [320px 대화 화면](validation/F03a-chat-mobile.png)을 직접 확인했다. 모의 대화의 UI 검사 캡처이며 실제 AI 응답 캡처가 아니다.
- `git diff --check`, 변경 파일과 브라우저 번들의 실제 설정 API 키 미포함 검사 통과. `.env` ignored, 안전한 `.env.example`만 추적한다.

초기 검사에서 테이블 수 기대값, 테스트 계정 지정, UI 비동기 검사 시점, React/TypeScript 상태 처리 문제를 수정했다. 실제로 발견된 SSE 전 오류의 content negotiation 문제는 JSON content type 명시와 클라이언트 Accept 헤더 수정으로 해결하고 회귀 테스트를 추가했다. 중간 실패를 성공 기록으로 대체하지 않고 최종 재실행 결과를 위에 기록했다.

원격 CI, 실제 Google 로그인 후 새 채팅 화면을 직접 사용하는 사용자 검증, 최종 보고서 흐름은 이번에 실행하지 않았다.

## 후속과 통합 시 주의

완료 대화를 평가 snapshot/관찰 근거에 연결하는 작업은 아직이다. 현재 평가기는 기존 보고서·검산 입력으로 동작하므로 채팅을 했다는 이유로 PROMPT 평가까지 구현됐다고 보지 않는다. 추가 단계의 채팅, 질문 편집/분기, session_events 타임라인, 답변의 보고서 삽입 편의 기능, F07·FINAL 제출/비교는 후속이다.

공통 영향: 인증 streaming helper·JSON 오류 content negotiation·보안 경로/CORS·초기 제출 잠금·워크스페이스 액션·V14 DB·AI 환경변수·fixture mapping·검증 명령. 의존성 버전/제품 OpenAPI schema는 바꾸지 않았다. PR 전에는 이 범위와 F06a/b의 동일 화면 수정 충돌을 검토한다. 초기 구현 때는 커밋·push하지 않았다. 2026-09-15 후속 정리에서 F03a만 별도 커밋·push하며 PR·merge·배포는 포함하지 않는다.


## 2026-09-15 공유 전 정리

- `origin/develop`을 fetch하고 기준 c49abce와 현재 HEAD가 일치함을 확인했다. 다른 작업의 미커밋 변경을 복사하거나 병합하지 않았다.
- 소유권·작성 단계 검사, 요청 중복 처리, 초안 opt-in, 비공개 자료 제외, 스트림 취소 및 늦은 응답 차단을 코드와 기존 회귀 테스트에서 재검토했다.
- F08a는 별도 브랜치에 공유돼 있으며 이 브랜치에는 구현 연습 코드가 없다. 통합 시 V14(F03a) → V15(F08a) 순서를 유지한다. 이미 적용된 migration이나 기존 DB 볼륨은 변경하지 않는다.
- 현재 3189는 F08a 구현 연습에 사용 중이다. 이번 자동 검증은 별도 포트를 사용하며 기존 화면을 교체하지 않는다.
- 실제 Gemini 연결은 앞선 2026-09-14 1회 검증 기록을 유지한다. 이번 정리에서 실제 AI를 다시 호출하거나 Google 로그인 UI를 새로 검증하지 않았다.
- 대화의 평가 입력 연결, 후속 작성 단계, 최종 평가 및 비교 리포트는 이번 완료 범위가 아니다.


재검증 결과: `npm run check` 통과. 계약/fixture 26개와 생성 타입 일치, 웹 lint/typecheck/86개 unit/build, API test/build, E2E 39개를 확인했다. API의 80개 성공 결과는 코드 변경이 없어 Gradle UP-TO-DATE로 재사용했다. 변경 및 staged 파일 52개의 비밀값·생성물 제외, `git diff --check`, 문서 링크도 확인했다. 기본 E2E의 AI 응답 UI 대체와 실제 API 검사를 구분하며, 실제 AI 호출 기록을 이번 재실행으로 표시하지 않는다.
