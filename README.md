# Doezip

AI 활용 역량 훈련 서비스. 현재는 **F00 개발 환경 구축** 단계다.
제품 UI·로그인·AI·전체 ERD·seed는 아직 구현하지 않았다. 디자인은 별도 Lovable 시안 검토 중이다.

## 팀원이 clone 후 실행

Node **24.20.0** (`.nvmrc` / `.node-version`), JDK **21**, 실행 중인 Docker Desktop 또는 Docker Engine + Compose v2,
Git이 필요하다. 아래 명령은 macOS/Linux/WSL 셸 기준이다. Windows는 WSL에서 실행한다.

```bash
git clone https://github.com/Corinbeom/Doezip.git
cd Doezip
# 이 브랜치가 원격에 공유된 후 사용 가능. 이번 작업에서는 push하지 않는다.
git switch feature/F00-dev-environment
# nvm을 사용하는 경우
nvm install
nvm use
npm install
cp .env.example .env
npm run db:up
npm run dev
```

현재 로컬 checkout에서는 `npm install`부터 실행한다. CI와 lockfile 그대로 재설치할 때는 `npm ci`를 쓴다.
웹 http://localhost:3000 에서 API와 PostgreSQL 연결 상태를 확인한다.
API 운영 health: http://localhost:8080/actuator/health (`UP`: 200 / DB 장애 `DOWN`: 503, 상세 비공개).
계약상의 `/api/v1` 제품 API는 아직 미구현이며 차단된다.

`npm run dev`는 웹과 API만 함께 실행한다. **DB 시작은 별도**이며 먼저 `npm run db:up`을 실행한다.
Ctrl+C는 이 실행기가 시작한 프로세스만 종료한다. DB와 영속 볼륨은 유지한다.
다른 터미널의 프로세스를 포트 번호로 찾아 종료하지 않는다.

| 명령 (루트) | 동작 |
|---|---|
| `npm install` | workspace 의존성 설치 |
| `npm run db:up` | 로컬 PG 시작·health 대기 |
| `npm run dev:web` | Next 개발 서버 |
| `npm run dev:api` | Gradle bootRun |
| `npm run dev` | 웹·API 동시 실행 |
| `npm run api:generate` | 기존 OpenAPI에서 프론트 타입 생성 |
| `npm run api:check` | OpenAPI·공개 fixture 검사, 타입 재생성 차이가 있으면 실패 |
| `npm run check:web` | lint·typecheck·Vitest·production build |
| `npm run check:api` | JUnit·실제 PostgreSQL Testcontainers·JAR build |
| `npm run test:e2e` | 빌드된 실제 웹·API 서버를 시작해 Playwright 검사 |
| `npm run check` | 계약·웹·API·E2E 전체 검사 |

## 검증

개발 서버를 Ctrl+C로 종료하고, DB는 유지한 상태에서 실행한다.
Playwright는 기존 서버를 재사용하지 않으며 사용 중인 포트가 있으면 실패한다.

```bash
npx playwright install chromium
npm run db:up
npm run check
```

Linux에서 브라우저 OS 라이브러리도 필요하면 `npx playwright install --with-deps chromium`을 실행한다.
첫 설치·Gradle 해석·Docker image pull·브라우저 설치에는 네트워크가 필요하다.
Docker 또는 Java가 없으면 관련 검사는 실패하며 자동 skip/H2 대체하지 않는다.
AI 키·OAuth 계정은 검사에 필요 없다. 실제 결과는 [F00 검증 기록](docs/F00_VALIDATION.md)을 참고한다.

DB를 멈출 때는 `docker compose --env-file .env -f compose.local.yml stop db`를 쓴다.
볼륨 삭제 옵션은 일반 실행·검증 명령에 넣지 않는다.

## 설정·구조

- `.env.example` → 로컬 `.env`. 실제 `.env`는 Git 제외. 루트 실행기가 명시적으로 파싱한다.
- 웹 공개 설정은 `NEXT_PUBLIC_API_BASE_URL`뿐이다. 서버 비밀번호·AI 키는 넣지 않는다.
- 기본 포트는 web 3000 / api 8080 / PG 5432이며 로컬에 바인딩한다.
- `DB_PORT` 변경 시 `DATABASE_URL`, `API_PORT` 변경 시 `NEXT_PUBLIC_API_BASE_URL`,
  `WEB_PORT` 변경 시 `CORS_ALLOWED_ORIGIN`도 맞춘다. 공개 URL 변경 후 production build를 다시 한다.
- `apps/web/src/app`: 라우팅, `src/features/environment`: 임시 연결 확인 화면.
- `apps/web/src/shared/api`: 공통 fetch·오류·Query Provider. `shared/ui`: 승인 디자인 이후 사용할 위치.
- `apps/web/src/generated/api-types.ts`: 생성 타입. **손으로 수정하지 않는다.**
- `apps/api`: Spring MVC·JPA·Validation·Security·Actuator·Flyway. DB 상세 비공개, health GET 외 기본 차단.
- `apps/api/src/main/resources/db/migration`: 경로만 준비. 전체 ERD migration·seed는 후속 작업.
- `contracts`, `docs`, `fixtures`, `templates`: 기존 기준 자료 보존. fixture는 웹에 import·배포하지 않는다.
  templates는 참고 예시이며 실제 앱 설정은 루트와 apps/api 아래에 있다.
- `.github/workflows/ci.yml`: 로컬과 같은 `npm run check`. PR(main/develop), push(main/develop/feature/**).

## 협업·남은 작업

`main ← develop ← feature/*`. 기능 브랜치에서 화면·API·DB·테스트를 함께 작업한다.
상대방 1명 승인과 CI 후 develop에 squash merge. develop → main은 배포 검증 후 merge commit.
main 결과는 develop에 동기화하며 squash한 기능 브랜치는 재사용하지 않는다.
Codex 동시 작업은 별도 clone/worktree를 사용한다. 상세 규칙은 [AGENTS.md](AGENTS.md).

GitHub 보호 규칙은 [설정 체크리스트](docs/F00_ENVIRONMENT.md)에만 기록했으며 적용하지 않았다.
이번 작업은 로컬 커밋까지만 수행한다. 원격 공유는 팀의 별도 push 이후 가능하다.

후속 작업: ERD 22개 테이블·제약 Flyway migration, fixture 검수와 과제 seed,
승인된 Lovable 디자인 검토·이식, 로그인과 제품 기능, Spring AI/Gemini 실제 연동.
이 환경을 전체 MVP·최종 디자인·전체 DB 구현 완료로 표현하지 않는다.
