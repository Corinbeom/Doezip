# API
- 수정 전 루트 AGENTS.md와 docs/F00_ENVIRONMENT.md 확인.
- 기능별 패키지에 controller/service/repository/dto/entity 배치. 빈 도메인 골격 대량 생성 금지.
- Controller·업무 규칙·데이터 접근 책임 분리. Entity를 HTTP 응답으로 반환하지 않는다.
- 소유권·단계·입력을 서버에서 검증. 외부 호출 대기 중 DB 트랜잭션 유지 금지.
- 스키마 변경은 Flyway, JPA ddl-auto=validate. 적용한 migration 수정 금지.
- 문서·평가 스냅샷과 비공개 정답 경계를 유지. fixtures/private는 서버 전용.
- 불필요한 Generic CRUD·CQRS·별도 AI 서버 금지.
- GET /actuator/health와 /api/v1/tasks, /api/v1/tasks/{taskId}만 공개. GET /api/v1/me와 POST /api/v1/me/bootstrap은 검증된 Bearer JWT가 필요하다. POST /api/v1/sessions, GET /api/v1/sessions/{id}/workspace, GET /api/v1/sessions/{id}/materials/{materialId}, PUT /api/v1/sessions/{id}/draft도 인증이 필요하며 세션 소유권을 검사한다. 그 외 기본 차단. AUTH_ENABLED=false는 인증 우회가 아닌 보호 경로 차단이다.
- 루트에서 npm run dev:api, npm run check:api. Java 21과 Docker가 필요하다.
- 앱 디렉터리에서 ./gradlew test build 실행 가능. bootRun 환경은 루트 실행기가 .env를 명시적으로 전달.
- Testcontainers PostgreSQL 검사를 H2나 성공 mock으로 대체하지 않는다.
- 사용자 식별은 고정 provider+JWT sub로 한다. 이메일로 계정을 합치지 않는다. CurrentUser를 소유권 검사에 재사용하고 외부 JWKS 호출은 업무 트랜잭션 밖에서 수행한다.

- 초안 저장은 소유한 learning_sessions 행 잠금 안에서 ACTIVE/WRITING 상태와 expectedLockVersion을 함께 검사한다. 단계 변경도 같은 행을 잠가야 한다.
- 자료는 task와 공개 단계로 필터링한다. 조건 공개 전 CONDITION_CHANGE 제목·본문을 응답에 넣지 않는다. 초안은 LF 정규화·Unicode 20,000자 제한·UTF-8 SHA-256을 사용한다.

- POST/GET /api/v1/sessions/{id}/document-versions는 인증·소유권 검사 후 처리한다. INITIAL 제출은 draft와 같은 세션 행 잠금에서 CAS·중복 확인·봉인·CHALLENGE 전환을 원자적으로 처리한다. 동일 입력 재시도는 기존 제출본을 반환하며 수정 API를 추가하지 않는다.

- 검산 시작 POST /sessions/{id}/challenge와 조회 GET /challenge-runs/{id}는 인증·소유권이 필요하다. 안내 버전/확인을 검증하고 최초 제출과 ACTIVE/CHALLENGE를 같은 세션 잠금 안에서 확인한다. 기존 run은 재배정하지 않는다. 초안 DTO에 템플릿 변형 코드·오류 수·정답을 넣지 않는다.

- 검토 PUT과 제출 POST는 session → run 잠금을 같은 순서로 사용한다. 제출 후 검토/인용 수정 금지. 인용은 같은 과제·공개 자료의 줄 범위에서 서버가 추출한다. 저장 요청은 전체 버퍼이며 CAS 충돌은 409다.

- 평가는 서버 snapshot만 사용한다. request/retry는 session 잠금, worker는 SKIP LOCKED claim·token/만료 확인을 사용한다. 실제 평가기 없는 상태를 성공으로 표시하지 않는다. F05a 기록을 따른다.
