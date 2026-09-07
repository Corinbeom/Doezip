# F00 개발 환경 범위

F00의 범위는 개발 환경 구축이다.
산출물은 Next.js → Spring Boot Actuator → PostgreSQL 실행 환경, 공통 규칙, 계약 타입 생성,
테스트·CI다. 전체 MVP 기반 기능 완료를 의미하지 않는다.

## 구현 경계
- 제품 API는 contracts/openapi.yaml을 보존하며 아직 구현하지 않았다. 선언만으로 성공 응답을 만들지 않는다.
- 운영 GET /actuator/health는 제품 /api/v1과 별개다. DB 검사 UP이면 200, DOWN이면 503.
  외부 응답은 status만 포함한다. 다른 경로는 인증·기능 구현 전 기본 차단한다.
- Flyway가 활성화되어 있지만 도메인 migration은 없다. JPA validate가 빈 Entity 집합을 확인하는 것은 ERD 검증이 아니다.
- 전체 22개 테이블 migration, 제약 검사·seed 변환/검수는 후속 F00b/F00c 작업.
- 로그인·채팅·검산·평가 워커·되묻기·리포트·Spring AI/Gemini·OAuth 계정·클라우드 배포는 미구현.
- 디자인은 시안 검토 중. docs/design/README.md에 승인 자료를 보관할 위치만 정의한다.

## 버전 근거
Node 24.20.0, Java 21, Next 16.3.4, Spring Boot 3.5.16, Gradle 8.14.4, PostgreSQL 17.11.
웹 직접 의존성의 정확한 버전은 apps/web/package.json, 루트 package.json과 package-lock.json에 고정한다.
서버 전이 의존성은 Spring Boot BOM으로 관리한다. Gradle 배포 ZIP은 wrapper SHA-256으로 확인한다.

- [Node LTS 다운로드](https://nodejs.org/en/download)
- [Next 16 설치](https://nextjs.org/docs/app/getting-started/installation)
- [Spring Boot 3.5 지원 Java·Gradle](https://docs.spring.io/spring-boot/3.5/system-requirements.html)
- [PostgreSQL 17 문서](https://www.postgresql.org/docs/17/)

공식 문서와 npm/Maven 저장소의 실제 버전을 대조했다. 실행 검증 결과는 F00_VALIDATION.md를 따른다.

## 환경 전달과 실행
루트 scripts/run.mjs가 Node parseEnv로 .env를 명시적으로 읽으며 이미 설정된 프로세스 환경변수가 우선한다.
Compose에는 --env-file .env를 전달한다. Next에는 .env 중 NEXT_PUBLIC_API_BASE_URL만 전달한다.
Spring에는 DATABASE_URL/USERNAME/PASSWORD와 API_PORT→SERVER_PORT, CORS_ALLOWED_ORIGIN을 전달한다.
DB_PORT를 바꾸면 DATABASE_URL도 함께 바꾼다. API_PORT를 바꾸면 NEXT_PUBLIC_API_BASE_URL도 바꾼다.
WEB_PORT를 바꾸면 CORS_ALLOWED_ORIGIN도 바꾼다. NEXT_PUBLIC 값은 production build 시 고정되므로 재빌드한다.
기본 바인딩은 로컬 전용이다. 배포 설정으로 간주하지 않는다.

npm run dev는 DB를 시작하지 않는다. 자신이 생성한 프로세스 그룹만 종료한다.
Compose 볼륨은 검증·종료 중 보존한다. Testcontainers가 만드는 테스트 전용 DB만 자동 폐기한다.
테스트 서버가 기본 포트를 사용하므로 dev를 종료한 뒤 npm run check를 실행한다.

## 저장소 운영

브랜치·리뷰 규칙과 아직 적용하지 않은 GitHub 설정은 [기여 가이드](../CONTRIBUTING.md)를 따른다.
