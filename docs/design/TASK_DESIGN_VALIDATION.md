# 과제 조회 디자인 이식 기록

## 작업 단위와 브랜치

- 기준: 최신 확인한 origin/develop `4f72abc`.
- 기존 기능: `feature/F02a-task-browse` / `0d8f093` 보존.
- 디자인 이식: `feature/F02a-design`, worktree `/private/tmp/doezip-task-design`.
- 조회 기능이 아직 develop에 없으므로 선행 기능을 별도 커밋 `3f26f31`로 가져왔다.
  이는 `0d8f093`의 동일 변경이며 디자인 구현 커밋과 구분한다. API·DB 기능을 새로 섞어 수정하지 않는다.
- 향후 조회 기능을 develop에 먼저 통합한 뒤 디자인 변경만 반영한다. 두 기능 커밋을 중복 적용하지 않는다.
  구체적으로 최신 develop에서 새 디자인 작업 브랜치를 만들고 이번 디자인 커밋만 cherry-pick한다.
  이 정리는 후속 통합 시 수행하며 이번에는 develop에 merge하거나 기존 공유 이력을 재작성하지 않는다.
- 원본 F00 작업 공간, 승인 원본 prototype 브랜치, 기존 조회 브랜치는 변경하지 않는다.
- 이번 작업은 로컬 구현·검증이다. push·PR·merge·배포는 수행하지 않는다.

## 적용 범위

[승인 디자인](README.md)의 /tasks 목록·상세와 공통 헤더·카드·일러스트·반응형 스타일.
실제 API 훅, 오류 처리, DB 조회는 유지한다. 원본 가상 자료·모의 AI·localStorage 학습 상태를 복사하지 않는다.
실제 사용자 계정·내 학습·자료 열람·보고서 작성·평가·리포트는 후속이다.

## 검증

검증용 주소는 web 3119 / API 8199 / PG 55449이며 전용 local DB 볼륨을 사용한다.
기존 사용자가 실행한 서버나 원본 .env를 변경하지 않는다.

- `npm run check` 통과: 계약·공개 fixture 21개·생성 타입 일치, 웹 lint/typecheck/unit 14개/build, 실제 PostgreSQL Testcontainers 11개/API build, Playwright 13개.
- 목록 → 상세 → 새로고침 → 목록 복귀, 실제 API 재시도·로딩·404 유지, 1440/390/320px의 제목 스타일·SVG 로딩·가로 넘침 없음을 확인했다.
- 키보드 본문 바로가기와 빈 목록 UI를 검사했다. 빈 목록 브라우저 검사는 의도적인 응답 fixture이며 실제 빈 DB는 백엔드 테스트에서 검증한다.
- 데스크톱·모바일 캡처를 직접 비교했다. 모바일 한글 제목 줄바꿈과 내부 과제 코드 표시를 보완한 뒤 웹 lint/typecheck/unit 14개/build 및 E2E 13개를 재실행해 모두 통과했다.
- SVG XML에 script/foreignObject/이벤트 핸들러·외부 링크가 없고 웹 runtime에 private fixture·prototype localStorage import가 없음을 확인했다.
- 수정 문서 로컬 링크 28개와 `git diff --check`를 통과했다. 최종 정적 JS에서 비공개 fixture 경로·criteria_json·테스트 sentinel 미포함도 확인했다.
- 이번 디자인 변경에는 API·DB·계약·lockfile·실행기 수정이 없다.
- 원격 GitHub CI·다른 브라우저·로그인·전체 학습 기능·AI·배포는 미실행이다. 기존 개발 도구 의존성 high 2건은 선행 F02a 기록의 후속 항목으로 유지한다.

## 재실행

Node 24.20.0, Java 21, Docker가 필요하다. 새 checkout은 루트 README를 따른다.
현재 worktree는 의존성과 local .env가 준비되어 있다.

```bash
cd /private/tmp/doezip-task-design
# Node 24 환경에서
npm run db:up
npm run dev
```

http://localhost:3119/tasks 를 연다. 전체 검사는 dev 종료 후 `npm run check`다.
DB 볼륨은 검증·종료 중 삭제하지 않는다.
