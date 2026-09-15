# Web
- 수정 전 루트 AGENTS.md와 docs/F00_ENVIRONMENT.md 확인.
- src/app은 라우팅·레이아웃 중심. 기능은 src/features, 공통 API·UI는 src/shared.
- 서버 데이터는 TanStack Query, 편집 상태는 우선 React 상태.
- API 오류·인증 처리는 src/shared/api로 모은다. Supabase PKCE 세션은 src/shared/auth에서 관리한다. 사용자별 Query는 meta: { private: true }를 지정해 계정 변경·로그아웃 시 취소·삭제한다.
- 브라우저에서 DB·LLM 직접 호출 금지. private fixture import·public 배치 금지.
- 2026-09-10 사용자가 학습 플랫폼 시안 v0.1을 제품 디자인 기준으로 승인했다. docs/design/README.md의 고정 원본·토큰·화면 규칙을 따른다.
- 승인 시안의 레이아웃·색상·공통 컴포넌트를 재사용한다. mock·localStorage·가상 AI를 제품 동작으로 옮기지 않는다. 구현하지 않은 기능에 동작하는 것처럼 보이는 버튼을 만들지 않는다.
- generated/api-types.ts는 contracts/openapi.yaml에서 생성. 수동 수정 금지.
- 루트에서 npm run dev:web, npm run api:generate, npm run check:web.
- lint/typecheck/unit/build를 검사하며 실제 API smoke는 npm run test:e2e (DB 시작·빌드 필요).
- 인증 설정은 docs/AUTH_SETUP.md. Supabase publishable 키만 공개하고 실제 Google 검증과 SDK 경계 테스트를 구분한다.
- 보고서 편집 버퍼는 React 상태로 유지하고 localStorage에 저장하지 않는다. 자동 저장은 1초 debounce·직렬 요청·CAS이며 409에서 자동 덮어쓰기하지 않는다.
- 작업 공간 재진입은 최신 서버 응답으로 시작하고, 계정 변경·로그아웃 시 편집기와 진행 중 요청을 정리한다. F02b 검증은 docs/F02B_REPORT_DRAFT.md를 따른다.

- 최초 제출은 현재 편집 내용의 저장 성공 후 서버가 반환한 lockVersion/contentHash를 사용한다. 제출 결과가 불명확하면 같은 입력으로 재시도하거나 제출 이력을 조회한다. 제출본은 HTML을 실행하지 않는 읽기 전용 텍스트로 표시한다.

- 검산 초안은 서버가 배정한 run만 열람한다. 안내 확인 전에 초안을 미리 요청하거나 public fixture를 import하지 않는다. 시작 재시도는 같은 세션을 사용하고 사용자 보고서와 검토용 초안을 구분한다.

- 검산은 명시적 저장 후 제출한다. 미저장 버퍼·실패 입력은 유지하고 서버 재조회로 버릴 때 확인한다. 근거 미리보기는 실제 자료 API를 사용하며 제출 후 읽기 전용이다.

- 평가 요청은 동일 작업의 응답 유실 시 같은 Idempotency-Key를 재사용한다. 상태 조회는 개인 Query이며 실패/대기 상태를 가짜 점수로 대체하지 않는다. retryable인 실패에만 재시도 버튼을 표시한다.

- 성공 평가의 reportId로만 결과를 조회한다. sample:true는 개발용 예시 배너, NOT_OBSERVED는 관찰 부재로 표시한다. 결과 본문/인용을 HTML로 실행하지 않는다. private Query·no-store를 유지한다.

- 채팅은 공통 authenticatedStream과 계약 SSE 파서를 사용한다. 같은 요청 재확인은 같은 clientMessageKey, 확정 실패 후 새 생성은 새 key다. 계정/화면 전환 시 stream을 취소하며 실패가 보고서 편집 버퍼를 지우지 않게 한다. AI 응답을 보고서에 자동 반영하지 않는다.

- coding 사용자 코드는 QuickJS Worker에서만 실행한다. host eval/Function, 네트워크·인증 상태 전달을 금지한다. 수정안은 코드 버전/미저장 변경 확인 후 사용자 적용이며 계정 변경 시 요청/Worker를 종료한다.
