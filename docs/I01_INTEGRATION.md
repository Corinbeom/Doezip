# I01 최초 평가 흐름 통합

## 기준과 포함 범위
origin/develop 4f72abccf9e340911cb70062d9e3496f310c3f3b에서 feature/I01-initial-flow-integration을 만들었다.
F05c 8531960의 선행 커밋 12개를 순서대로 가져온 뒤 F04c UI 수정 8949ed7 하나를 적용했다. 같은 선행 기능을 여러 번 병합하지 않는다.
과제 조회·승인 디자인·Google 로그인 코드·보고서 자동 저장·최초 제출·검산 시작/검토/인용/제출·평가 수명 주기/결과 발행·Gemini 어댑터·결과 UI를 포함한다.
API·계약·lockfile은 F05c와 동일하다. UI 적용 충돌은 평가 안내 문구 한 곳이며, F05c의 전송/근거 검증/AI 오류 안내를 유지했다. 반복된 테스트 순서 보완은 이미 적용된 상태여서 중복 변경하지 않았다.

## 실행
일반 실행은 한 checkout에서 npm install → cp .env.example .env → 인증/AI 설정 → npm run db:up → npm run dev다. 기본 공개 화면/health는 외부 키 없이 실행한다. 로그인 설정은 AUTH_SETUP.md, AI 설정은 AI_SETUP.md를 따른다. 실제 .env는 Git에 넣지 않는다.
기존 worktree와 사용자 변경, DB/볼륨은 보존한다. 통합 검증 DB는 별도 doezip-i01 / 55549, API8319 / web3149 / 테스트 issuer8999로 분리했다. 사용자가 확인할 일반 실행은 기존 local DB와 3129/8299 주소를 재사용할 수 있다.

## 검증 구분
- npm run check: 실제 PostgreSQL, 로컬 JWT, AI 비활성. 기본 CI와 동일.
- npm run test:flow:ai: tests/live-ai의 명시적 검사. 테스트 로그인 이후 브라우저에서 새 과제 시작·작성·최초 제출·검토/인용 저장·검산 제출·실제 Gemini 평가·sample:false 리포트 조회·새로고침 복원·제출본 보존을 확인한다. 결과 API 가로채기/가짜 성공 응답은 없다. trace/video 자동 수집은 꺼서 테스트 토큰을 기록하지 않는다.
- 실제 Google 공급자 로그인은 이 자동 검사에서 실행하지 않는다. 기존 사용자 수동 검증을 새 검증으로 표시하지 않는다.
- Gemini 3.5 Flash Lite 호출 성공은 의미적 평가 품질 보장이 아니다. 정답 정책, 전체 ERD/seed, 채팅/되묻기/FINAL/비교 리포트는 미완료다.

## 통합 절차
검증된 통합 브랜치를 develop 대상 PR로 제출하고 CI 통과 후 squash merge한다. 기존 선행 feature 브랜치들은 기록으로 보존하며 다시 통째로 병합하지 않는다. 이후 작업은 최신 develop에서 새 feature 브랜치로 시작한다. main 반영·배포·강제 push·기존 worktree 초기화는 이번 범위가 아니다.

patch-id 비교에서 F01/F02a/b/c/F04a/b/F05a/b의 모든 변경이 F05c에 포함됨을 확인했다. 별도 solo-development 커밋은 이후 문서 갱신으로 patch-id는 다르지만 CONTRIBUTING/PR 템플릿은 동일하고 ADR-25·1인 검토/병합 규칙도 보존돼 있다. 디자인 원본은 기존 고정 커밋 링크를 유지하며 ZIP/원본 시안을 중복 복사하지 않았다.

## 실행 결과 (2026-09-13)
- npm ci 및 새 PostgreSQL compose 시작 성공. 기존 DB/볼륨 삭제 없음.
- npm run check 성공: 웹 lint/typecheck/76개 unit/build, API 70개/Testcontainers PostgreSQL/build, E2E 37개, OpenAPI/공개 fixture/생성 타입 일치.
- npm run test:flow:ai 성공: 실제 Gemini 3.5 Flash Lite를 사용하는 브라우저 통합 1개 통과. 테스트 인증 이후 사용자 동작을 UI로 실행하고 worker 결과의 sample:false 및 동일 결과 복원을 API로 함께 확인했다. API/결과를 가로채지 않았다.
- [실제 브라우저 캡처](validation/I01-initial-flow.png): 가상 과제·테스트 사용자만 포함한다. 개인정보/비공개 정답/실제 토큰은 포함하지 않는다.
- 명시적 AI 검사 비활성 설정은 실행을 거부한다. 기본 CI에는 실제 AI 검사가 포함되지 않는다.
- 원본 F00 변경과 기존 feature worktree·사용자 데이터는 보존했다. 로컬 로그 /tmp/doezip-i01-check.log, /tmp/doezip-i01-live-flow.log는 커밋하지 않는다.
