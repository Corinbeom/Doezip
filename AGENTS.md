# Doezip 협업 규칙

AI 활용 역량 훈련 서비스. 현재 1인 개발로 진행하며 기능별로 화면·API·DB·테스트까지 함께 구현·검증한다.
F00 실행 환경은 구축됐다. 이후 기능은 docs/FEATURE_BACKLOG.md의 현재 실행 순서를 따른다. 디자인은 학습 플랫폼 v0.1을 기준으로 승인됐으며 화면별 이식 상태는 docs/design/README.md에서 관리한다. 로그인은 구현·검증 상태를 docs/F01_AUTH_VALIDATION.md에서 확인한다. 채팅·검산·평가·리포트·AI 호출,
전체 22개 테이블 migration과 seed는 후속 작업이며 완료로 표시하지 않는다.

## Git
- main은 배포 기준, develop은 통합 기준이다. 두 브랜치에서 직접 기능 개발 금지.
- feature/*는 develop에서 분기하며 PR 대상은 develop. 같은 기능의 web/api는 같은 브랜치.
- 1인 개발 중에는 작성자의 diff 검토·실제 동작 확인과 CI 통과 후 squash merge. Codex 검토는 보조이며 작성자의 확인을 대신하지 않는다. squash한 기능 브랜치는 재사용하지 않는다.
- develop → main은 배포 검증 후 merge commit. main 반영 결과는 develop에도 동기화.
- 공유 브랜치 강제 push·임의 히스토리 재작성 금지. 동시 Codex는 별도 clone/worktree 사용.
- 공통 UI·계약·의존성·DB 변경은 PR에 영향 범위와 리뷰 대상을 표시한다.
- 커밋은 관련 파일만 명시적으로 stage하고 diff·비밀값·검증 결과를 확인한다. 기존 변경 보존.
- 커밋·push·PR·merge는 사용자가 요청한 범위에서 수행한다. 준비 요청만으로 원격 변경을 실행하지 않는다.
- 팀의 작업 절차와 GitHub 설정 체크리스트는 CONTRIBUTING.md를 따른다.

## 변경 전
- web 수정 전 apps/web/AGENTS.md, api 수정 전 apps/api/AGENTS.md를 읽는다. 풀스택은 둘 다 확인.
- 실제 계약과 공통 코드를 먼저 재사용한다. 계약 변경 시 생성 타입·fixture·테스트도 갱신.
- src/generated/api-types.ts는 생성물이며 수동 수정 금지. npm run api:generate 사용.
- 실제 실행한 검증과 미실행 검증을 구분해 보고한다. 실패한 필수 검증을 완료로 커밋하지 않는다.
- 사용자 보고서 / 검산 초안 / 비공개 정답을 분리한다. 미공개 자료를 브라우저·학습용 AI에 전달 금지.
- fixtures/README.md의 공개 단계 규칙을 따른다. 파일 이름만으로 공개 가능 여부를 판단하지 않는다.

## 실제 명령 (루트)
Node 24.20.0, Java 21, Docker Compose v2를 준비한다.
`npm install` → `cp .env.example .env` → `npm run db:up` → `npm run dev`.
개별 실행: `npm run dev:web`, `npm run dev:api`. 전체 검증: `npm run check`.
DB 시작은 별도다. 볼륨 삭제를 일반 실행·검증에 넣지 않는다.

## 기준 문서
최신 사용자 지시 → docs/F00_ENVIRONMENT.md → docs/DECISIONS.md →
docs/DEVELOPMENT_SPEC.md, docs/FEATURE_BACKLOG.md, docs/API_CONTRACT.md,
contracts/openapi.yaml, docs/sources/ERD.md, docs/TEST_RUNBOOK.md.
디자인 상태는 docs/design/README.md. templates/는 원본 참고용, 실제 설정은 루트와 apps/api.
