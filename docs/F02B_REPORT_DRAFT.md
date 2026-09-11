# F02b 과제 시작·보고서 저장·복원

## 작업 기준

- 작업 브랜치: `feature/F02b-report-draft`.
- 작업 공간: `/Users/hwaseongcityboy/Desktop/doezip-worktrees/F02b-report-draft`.
- 시작 기준: `origin/develop` `4f72abc`. 2026-09-11 확인한 선행 네 브랜치의 GitHub CI는 모두 성공했다.
- 선행 과제 조회·디자인·인증·스타일 검사 커밋을 `f53dcda`, `ca7aa8f`, `c8d9ff0`, `299e60c`로 가져왔다.
  원본 선행 브랜치와 공유 이력은 보존했다. 향후 develop에 선행 작업을 통합한 뒤 F02b 변경만 반영한다.
- 원본 F00 작업 공간은 수정하지 않는다. 이번 작업에서 원격 PR·merge·배포는 하지 않는다.

## 구현 범위

인증한 사용자가 공개 과제를 시작하면 별도 수행 세션을 생성한다. 각 시도는 별도 세션이다.
`/sessions/{sessionId}`에서 공개 자료를 줄 번호와 함께 읽고 보고서를 작성한다.
1초 debounce와 직렬 요청으로 자동 저장하며 저장 중 추가로 입력한 내용을 이전 응답으로 덮어쓰지 않는다.
새로고침·과제 소개 왕복 시 서버 저장본을 복원한다. 미저장 내용이 있을 때 화면의 링크 이동·페이지 새로고침/종료에는 확인을 제공한다.

저장 버전이 충돌하면 409로 차단하고 로컬 초안을 유지한다. 서버 저장본을 불러오는 것은 사용자의 명시 선택이다.
네트워크 오류에서는 초안을 유지하고 재시도한다. 계정 변경·로그아웃 때 개인 Query와 편집기를 정리한다.

서버는 사용자 소유권·ACTIVE/WRITING 상태·예상 버전을 같은 쓰기 트랜잭션에서 검사한다.
본문은 최대 20,000 Unicode codepoint이며 LF로 정규화하고 UTF-8 SHA-256을 계산한다.
자료는 같은 과제와 공개 단계에 속한 것만 반환하며 숨겨진 자료 제목도 응답에 넣지 않는다.
HTML/Markdown을 실행하지 않고 원문 텍스트로 표시한다.

## API·DB·설정 영향

기존 OpenAPI 형식을 재사용하며 계약과 생성 타입의 의미를 바꾸지 않는다.

- POST `/api/v1/sessions`
- GET `/api/v1/sessions/{sessionId}/workspace`
- GET `/api/v1/sessions/{sessionId}/materials/{materialId}`
- PUT `/api/v1/sessions/{sessionId}/draft`

모두 인증이 필요하다. 타인 세션은 404, 인증 누락은 401, 버전·단계 충돌은 409다.
`allowedActions`는 이번에 구현한 READ_MATERIALS/WRITE_DRAFT만 포함한다.
V4는 learning_sessions·materials 두 테이블, V5는 local 프로필의 저장 확인용 가상 INITIAL 자료 1개다. V6는 기존 개발용 과제 v1을 ARCHIVED로 보존하고 작성 안내를 담은 v2와 자료 사본을 추가한다. 기존 세션의 본문·자료를 수정하지 않는다.
기존 V1~V3는 수정하지 않는다. 로컬 browse-demo에 추가한 가상 자료는 학습용 콘텐츠 발행·전체 seed가 아니다.
실제 발행 콘텐츠를 수정하는 기능은 제공하지 않는다.

추가 라이브러리는 없다. Supabase 설정은 기존 프로젝트를 재사용한다. 현재 작업 공간은 웹 3129 / API 8219 / DB 55469로 분리했다.
인증 callback은 기존 `http://localhost:3129/auth/callback`을 유지한다. `.env`의 실제 키·URL은 Git 제외다.

## 검증 방식

`npm run check`는 외부 OAuth 설정을 대신해 테스트용 웹 설정으로 빌드하고 기존 계약·웹·API·브라우저 검사를 수행한다.
`npm run test:e2e`도 테스트용 웹을 다시 빌드한다. API JAR은 먼저 `npm run check:api`로 준비해야 한다.
일반 개발은 `npm run dev`로 실제 로컬 `.env` 설정을 사용한다. 검증용 `.next`를 배포 빌드로 사용하지 않는다.

테스트 전용 issuer는 `tests/support/auth-server.mjs`이며 loopback에서만 동작하고 실행마다 RSA 키를 새로 생성한다.
테스트 JWT는 실제 Spring 서명 검증·소유권 검사와 PostgreSQL에 연결한다. 웹의 Supabase 세션 경계에만
이 테스트 세션을 주입한다. 프로덕션 인증 우회 경로나 서버의 가짜 성공 응답은 추가하지 않는다.
이는 실제 Google 계정 두 개로 로그인한 결과가 아니며 Google token refresh 검증도 아니다.
테스트 issuer 기본 포트는 8799이고 필요하면 `E2E_AUTH_PORT`로 바꾼다.

## 실행 결과 (2026-09-11)

- 최종 `npm run check` 통과: OpenAPI·공개 fixture 21개·타입 재생성 일치, 웹 lint/typecheck·단위 52개·production build, API test/build 28개, Playwright 22개.
- PostgreSQL Testcontainers: 실제 서명 JWT 두 사용자 소유권, 동시 저장 1건 성공/1건 충돌, 단계 차단, 숨겨진 자료·타 과제 자료 차단, Unicode 길이·LF 해시를 확인했다.
- 브라우저: 실제 API/DB 과제 시작 → 자료 읽기 → 자동 저장 → 화면 왕복·새로고침 복원, 409 초안 보존·명시적 서버 불러오기, 네트워크 실패 재시도, 타인 GET/PUT404, HTML 미실행과 320px 가로 넘침 없음을 확인했다.
- 과제 소개 이동 직후 뒤로 가기를 실행하던 테스트 타이밍 실패 1건을 목적 URL 확인 후 이동하도록 수정했다. 최종 전체 검사는 모두 통과했다.
- 단위 회귀: 저장 중 최신 입력 보존, 사용자 전환·로그아웃 시 편집기 제거, 캐시된 작업 공간 재진입, caller abort와 10초 timeout 병행.
- 데스크톱·모바일 캡처 직접 확인. 변경 문서 링크·diff check·실제 인증 설정값 미포함·웹 번들의 private fixture/criteria 경로 미포함 확인.
- 새 local v2 seed 재실행 시 과제 2버전·루브릭 16개·자료 2개 유지, 이전 버전의 본문 보존·ARCHIVED 전환 확인.
- 신규 의존성 없음. 기존 개발 도구 js-yaml/Redocly의 npm audit high 2건은 별도 정비 항목이다.
- 새 F02b 브랜치의 원격 CI, 실제 Google 두 계정의 작성 흐름, 장시간 토큰 갱신은 미실행이다. F02c 착수 전 사용자 승인으로 F02b 변경을 로컬 커밋한다. push·PR·merge는 하지 않는다.

## 남은 범위

불변 제출본·제출, 평가, AI 채팅·검산·리포트, 내 학습 목록은 아직 구현하지 않았다.
브라우저가 강제 종료되거나 오프라인 상태로 닫히면 서버에 저장하지 못한 초안은 복원할 수 없다. 브라우저의 SPA 뒤로/앞으로 이동을 차단하는 기능은 제공하지 않는다.
실제 두 Google 계정의 분리와 만료 후 갱신은 별도 사용자 검증이 필요하다.

- 사용자 수동 확인: 2026-09-11 새로고침 후 초안 복원을 확인했다고 응답했다. 자동 검증과 별개의 사용자 확인이며 두 Google 계정·장시간 갱신 검증을 뜻하지 않는다.
