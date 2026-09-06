# F00 실제 검증 기록

실행일: 2026-09-06. 실행 환경: macOS Intel, Node 24.20.0, npm 11.9.0,
Java 21.0.2, Docker Desktop 4.40.0 / Engine 28.0.4, PostgreSQL 17.11.
검증 중 시스템 기본 Node 25.6.1은 변경하지 않고 `/tmp/doezip-node24/node_modules/node/bin`을 PATH 앞에 사용했다.
장기 개발에는 각자 Node 24.20.0을 설치·선택해야 한다. `.nvmrc`와 `.node-version`에 버전을 기록했다.

## 실행 결과

| 검사 | 결과 | 실제 확인 범위 |
|---|---|---|
| npm 의존성 설치 | 성공 | 정확한 직접 버전·package-lock, audit 취약점 0건 |
| OpenAPI 표준 validator | 성공 | 기존 계약에서 빈 required 배열만 형식 수정 |
| 공개 fixture 검증 | 성공 | 기존 20개 + 선택 입력 bootstrap 요청 1개 |
| API 타입 재생성 비교 | 성공 | 재생성 전후 동일, 수동 편집 없음 |
| 웹 lint / typecheck | 성공 | ESLint, Next typegen, tsc |
| 웹 Vitest | 성공 | 2개 파일, 5개 테스트: 오류·인증 상태, 잘못된 응답, 로딩·재시도 |
| 웹 production build | 성공 | Next 16.3.4 / React 19.2.8 / Tailwind 4 |
| API test / build | 성공 | Spring Boot 3.5.16, Gradle 8.14.4, Java 21 JAR |
| PostgreSQL Testcontainers | 성공 | 5개 테스트, skip 0: 실제 DataSource, 도메인 테이블 미생성, health, 보호 경로, CORS, 실제 DB 중단 |
| Compose DB | 성공 | 영속 볼륨, 로컬 바인딩, 실제 healthy 상태 |
| Chromium E2E | 성공 | 실제 웹→API→DB 성공, 네트워크 실패→재시도 복구, 응답 대기 로딩 3개 |
| dev 동시 실행·Ctrl+C | 성공 | 웹 HTTP 200, API UP, 종료 후 이번 web/api 포트 해제 |
| E2E 서버 정리 | 성공 | SIGTERM으로 실행기 정리 코드를 거친 뒤 포트 해제 |
| 비공개 자료 경계 | 성공 (현재 코드·산출물 범위) | 웹 fixture import 없음, 빌드에서 private fixture 대표 필드·파일명 없음 |
| 원본 자료 보존 | 성공 | source-checksums.json의 기획안·ERD SHA-256 일치 |
| GitHub Actions | 미실행 | 동일 npm run check 워크플로만 작성, push하지 않음 |
| 두 번째 팀원 PC / Linux CI | 미실행 | 해당 환경의 실행 결과를 대신 주장하지 않음 |
| GitHub 브랜치 보호 | 미적용 | [기여 가이드](../CONTRIBUTING.md)에 체크리스트만 작성 |

최종 전체 `npm run check`는 종료 코드 0으로 완료했다. 마지막 실행의 API 검사는 변경이 없어 Gradle UP-TO-DATE였으며, 앞선 실제 실행에서 5개 테스트가 성공하고 skip이 0임을 확인했다. 테스트 보고서와 캡처는
`apps/api/build/reports/tests/test`, `playwright-report`, `test-results`에 있으며 Git에서 제외한다.

## 확인하면서 수정한 문제

- Compose healthcheck의 YAML 인용 오류 수정.
- 기존 로컬 서비스가 기본 포트를 사용 중이어서 **로컬 .env만** web 3100 / api 8181 / PG 55432로 설정.
  기본 예시·CI 포트는 3000 / 8080 / 5432. 기존 프로세스는 종료하지 않았다.
- Next 빌드의 샌드박스 내부 포트 제한은 승인된 실행 환경에서 재검증했다.
- 기존 BootstrapRequest의 `required: []` 제거. 선택 입력 의미 유지, 빈 요청 fixture 추가.
- OAS nullable/allOf 선언은 fixture 검증 시 JSON Schema null 대안으로 변환한다. 원본 nullable 계약은 보존한다.
- Playwright 기본 강제 종료와 분리된 자식 프로세스 그룹의 충돌을 발견해 gracefulShutdown(SIGTERM)을 명시했다.
  [공식 종료 설정](https://playwright.dev/docs/test-webserver)을 확인하고 재검증했다.
- Next의 AGENTS 자동 추가를 `agentRules: false`로 비활성화해 팀 규칙 파일을 보존한다.

## 검증하지 않은 제품 기능

전체 ERD·도메인 제약·seed·로그인·권한 소유권 흐름·채팅·검산·평가 워커·되묻기·리포트·실제 AI·OAuth·배포는 범위 밖이다.
현재 보안 검사는 health만 공개되고 제품 경로가 차단되는 것을 확인한 것이다. 로그인 기능 검증이 아니다.
Flyway의 빈 migration 경로와 JPA validate를 전체 스키마 구현·검증 완료로 해석하지 않는다.
가상 fixture 검증은 콘텐츠 정답의 인간 검수나 실제 학습 평가를 대신하지 않는다.
