# Doezip

AI 활용 역량 훈련 서비스.
현재 저장소에는 Next.js 웹, Spring Boot API, PostgreSQL 개발 환경과 과제 목록·상세 조회 기능이 구성되어 있다.
제품 기능의 구현 범위와 진행 상태는 [개발 계획](docs/FEATURE_BACKLOG.md)을 참고한다.

## 로컬 실행

Node **24.20.0** (`.nvmrc` / `.node-version`), JDK **21**, 실행 중인 Docker Desktop 또는 Docker Engine + Compose v2,
Git이 필요하다. 아래 명령은 macOS/Linux/WSL 셸 기준이다. Windows는 WSL에서 실행한다.

```bash
git clone https://github.com/Corinbeom/Doezip.git
cd Doezip
# 통합된 개발 환경을 checkout한다.
git switch develop
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
웹 http://localhost:3000/tasks 에서 로컬 조회용 가상 과제의 설명과 공개 루브릭을 확인한다.
공개 과제 조회 외에 인증된 사용자 연결 POST `/api/v1/me/bootstrap`, 조회 GET `/api/v1/me`를 제공한다. 과제 시작·공개 자료 열람·보고서 저장/복원 API도 제공한다. [F02b 범위](docs/F02B_REPORT_DRAFT.md)를 참고한다. 미구현 제품 경로는 차단된다.

Google 로그인 설정은 [인증 설정](docs/AUTH_SETUP.md)을 따른다. 설정이 없으면 `/login`에서 안내를 표시하고 로그인 버튼을 비활성화한다. 최초 Google 로그인은 사용자 확인 및 DB 연결 확인을 마쳤으며, 세부 검증 상태는 F01 기록을 따른다.

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
- 기존 `.env` 사용자는 `SPRING_PROFILES_ACTIVE=local`을 추가해야 조회용 가상 과제가 생성된다.
  `local`은 전용 개발 DB에서만 사용한다. 기본 프로필에는 샘플이 없으며 새 DB는 빈 목록을 반환한다.
  이미 local seed를 적용한 DB는 프로필을 바꿔도 데이터가 없어지지 않으므로 운영 DB로 재사용하지 않는다.
- 웹 공개 설정은 `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`다. Supabase publishable 키만 사용하며 서버 비밀번호·Google Client Secret·Supabase secret 키·AI 키는 넣지 않는다.
- 기본 포트는 web 3000 / api 8080 / PG 5432이며 로컬에 바인딩한다.
- `DB_PORT` 변경 시 `DATABASE_URL`, `API_PORT` 변경 시 `NEXT_PUBLIC_API_BASE_URL`,
  `WEB_PORT` 변경 시 `CORS_ALLOWED_ORIGIN`도 맞춘다. 공개 URL 변경 후 production build를 다시 한다.
- `apps/web/src/app`: 라우팅, `src/features/environment`: 임시 연결 확인 화면, `src/features/tasks`: 과제 조회.
- `apps/web/src/shared/api`: 공통 fetch·오류·Query Provider. `shared/ui`: 승인 디자인의 공통 화면 구성·스타일.
- `apps/web/src/generated/api-types.ts`: 생성 타입. **손으로 수정하지 않는다.**
- `apps/api`: Spring MVC·JPA·Validation·Security·Actuator·Flyway. DB 상세 비공개. health·과제 조회 GET은 공개, me 경로는 JWT 인증, 나머지는 기본 차단.
- `apps/api/src/main/resources/db/migration`: 과제·루브릭·사용자·학습 세션·자료 다섯 테이블. `db/local`: 로컬 조회용 seed.
  전체 ERD migration·학습 과제 패키지 seed는 후속 작업.
- `contracts`, `docs`, `fixtures`, `templates`: 기존 기준 자료 보존. fixture는 웹에 import·배포하지 않는다.
  templates는 참고 예시이며 실제 앱 설정은 루트와 apps/api 아래에 있다.
- `.github/workflows/ci.yml`: 로컬과 같은 `npm run check`. PR(main/develop), push(main/develop/feature/**).

## 문서

| 문서 | 내용 |
|---|---|
| [기여 가이드](CONTRIBUTING.md) | 브랜치·리뷰·커밋 규칙, 저장소 설정 |
| [Codex 작업 지침](AGENTS.md) | 에이전트 작업 규칙과 스택별 지침 |
| [개발 계획](docs/FEATURE_BACKLOG.md) | 현재 구현 상태와 후속 작업 |
| [API 계약](docs/API_CONTRACT.md) | 제품 API와 운영 health 구분 |
| [디자인 자료](docs/design/README.md) | 승인 상태와 자료 관리 기준 |
| [환경 범위](docs/F00_ENVIRONMENT.md) | 기술 구성과 환경변수 전달 |

과제 조회의 범위와 검증 기록은 [F02a 작업 기록](docs/F02A_TASK_BROWSE.md)을 참고한다.

과제 조회 화면은 승인된 학습 플랫폼 v0.1 디자인을 기준으로 구현한다. [적용 범위와 검증](docs/design/TASK_DESIGN_VALIDATION.md)을 참고한다.

로그인 구현 범위와 검증 기록: [F01 인증](docs/F01_AUTH_VALIDATION.md).

보고서 작성·자동 저장·복원과 인증 통합 검사: [F02b 기록](docs/F02B_REPORT_DRAFT.md). `npm run test:e2e`는 외부 OAuth 없이 검증하도록 테스트용 웹을 다시 빌드한다. 일반 실행은 `npm run dev`를 사용한다.
