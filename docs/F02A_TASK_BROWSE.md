# F02a 과제 목록·상세 조회

아래는 최초 기능 구현 당시 기록이다. 이후 디자인 승인·이식 상태는 [디자인 기준](design/README.md)을 따른다.

## 구현 범위

1인 개발의 첫 제품 기능은 과제 조회다. `/tasks` → `/tasks/{taskId}` 화면이 기존 계약의
GET `/api/v1/tasks`, GET `/api/v1/tasks/{taskId}`를 호출해 PostgreSQL의 설명과 공개 루브릭을 읽는다.
목록은 PUBLISHED만, 상세는 PUBLISHED·ARCHIVED를 허용한다. DRAFT와 없는 ID는 404,
잘못된 UUID는 400이다. DB 연결 실패는 상세 없는 공통 오류 형식의 503이다.
health와 이 두 GET 외 제품 경로는 기본 차단한다. 계약과 생성 타입은 변경하지 않았다.

화면은 기능 확인용이며 최종 디자인은 미승인 상태다. 설명의 Markdown은 현재 안전한 일반 텍스트로
표시한다. 로딩·빈 목록·오류·재시도·없는 과제·목록 복귀를 제공한다.

## DB와 로컬 예시

- `db/migration/V1__task_catalog.sql`: ERD의 tasks·rubric_dimensions 두 테이블과 관련 제약·인덱스.
- `db/local/V2__local_browse_sample.sql`: 별도 UUID의 가상 조회 예시와 공개 루브릭 8개.
- `application-local.yml`: local 프로필일 때만 추가 seed 경로를 사용한다.
- criteria_json은 DB에만 존재하며 JPA 조회 필드·HTTP DTO에 포함하지 않는다. 로컬 값 `{}`는 평가 기준 구현이 아니다.

원본 private task-pack은 발행하지 않았다. 이 예시는 학습용 발행 검수, 전체 22개 테이블,
자료·정답·평가 기준 seed를 완료했다는 의미가 아니다. seed 적용 후에는 기존 migration을 수정하지 않는다.
local 프로필을 끄더라도 기존 데이터는 삭제되지 않는다. 로컬 DB를 운영 DB로 전환해 사용하지 않는다.

## 실행

루트 README대로 Node 24.20.0, Java 21, Docker를 준비한다.

```bash
npm ci
cp .env.example .env
npm run db:up
npm run dev
```

기존 `.env`에는 `SPRING_PROFILES_ACTIVE=local`을 추가한다. 다른 설정을 덮어쓸 필요는 없다.
기본 웹 주소는 http://localhost:3000/tasks 이다. 기본 프로필의 새 DB는 빈 과제 목록을 반환한다.

## 검증 기록

통합 worktree: `/private/tmp/doezip-task-browse`, 브랜치 `feature/F02a-task-browse`.
실행 결과는 아래 기록하며, 에이전트의 개별 검사와 통합 검사를 구분한다.

- 프론트 개별 작업: lint·typecheck·unit 12개·production build 통과.
- 통합 `npm run check`: 성공. OpenAPI 검증·공개 fixture 21개·생성 타입 재생성 차이 없음, lint·typecheck·unit 12개·production build, JUnit/Testcontainers 11개·JAR build, Playwright 8개 통과. skip 0.
- 실제 PostgreSQL 기본 프로필의 빈 목록과 local seed를 별도 컨테이너에서 검사했다. 재 migration 무중복, 제약, 상태 필터, 공개 필드만 반환, ID 오류, CORS·보호 경로, DB 중단 시 health/과제 503을 확인했다.
- Chromium에서 실제 목록 → 상세 → 새로고침 → 목록 복귀, 요청 차단 후 실패 UI·실제 API 재시도, 응답 지연 중 로딩, 실제 404, 모바일 390px 가로 넘침 없음을 확인했다. 정상 상세 흐름의 pageerror 0. 오류 UI 테스트의 요청 차단은 의도한 실패이며 성공 응답을 mock하지 않았다.
- 과제 상세 캡처를 직접 확인했다. 증거는 로컬 `test-results/`에 있으며 Git에는 넣지 않는다.
- 수정 문서의 로컬 링크 32개, `git diff --check`, 실행기 JS 문법, production static JS의 private fixture 경로·criteria_json·테스트 sentinel 미포함 검사를 통과했다.
- 검증용 포트: web 3109 / API 8189 / PG 55439. 원본 `.env`와 DB는 변경하지 않았고 별도 Compose 볼륨은 보존했다.
- 실제 `npm run dev`의 웹·API 기동과 SIGTERM 종료를 확인했고 web/API 포트 잔여 listener가 없었다. 그룹 리더의 강제 비정상 종료 시나리오는 별도로 검증하지 않았다.
- GitHub CI 원격 실행·실제 인증·AI·전체 학습 흐름·배포 검증은 미실행이며 이번 범위 밖이다.

## 실행기 수정

통합 빌드 후 기존 scripts/run.mjs가 종료된 자식 프로세스를 정리 목록에 남긴 채 그룹 종료 신호를 보내
`kill EPERM`으로 실패했다. exit 이벤트에서 해당 자식을 먼저 제외한 뒤 남은 실행 프로세스만 정리하도록
순서를 수정했다. 빌드 오류를 무시하거나 권한 오류를 무조건 삼키는 처리는 추가하지 않았다.

## 후속 작업과 제한

- F01 사용자 식별·소유권 → F02b 보고서 저장·복원 → F02c 불변 버전 제출.
- 전체 ERD migration·학습용 콘텐츠 발행 검수·seed, 승인 디자인 이식, 채팅·검산·평가·리포트.
- GitHub CI 실행·브랜치 보호 설정·배포는 이번 로컬 검증으로 완료 처리하지 않는다.
- `npm ci` 후 `npm audit`에서 기존 개발 도구 전이 의존성 js-yaml 및 @redocly/openapi-core의 high 2건이 보고됐다.
  이 작업은 기존 lockfile을 유지했다. 별도 의존성 보안 업데이트와 계약 생성 검증이 필요하다.
