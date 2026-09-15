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

- 결과 발행은 ResultPublisher의 session → evaluation 잠금·최종 lease CAS 안에서 결과/관찰/리포트/세션을 원자 처리한다. 외부 후보는 ResultValidator를 통과해야 하며 실패를 성공으로 대체하지 않는다. F05B_EVALUATION_RESULTS.md의 정답 미확정·공개 투영 경계를 따른다.

- AI 호출은 GeminiEvaluationAdapter에 격리한다. snapshot의 모델/프롬프트 버전을 사용하고 키를 저장하지 않는다. 외부 호출 전 DB 예산을 예약한다. SDK 재시도 1회·60초 HTTP timeout·도구 비활성화를 유지한다. 실제 호출 검사는 명시적 npm run test:ai로 실행하며 기본 검사는 AI 비활성화다. 일반 실행의 AI_EVALUATION_ENABLED=true는 실제 worker 호출을 허용한다.

- 학습용 채팅은 GeminiChatAdapter로 격리하며 평가 adapter와 입력을 섞지 않는다. F03a의 공개 context·완료 대화·초안 opt-in·terminal CAS·예산·세션 잠금 규칙은 docs/F03A_LEARNING_CHAT.md를 따른다. 실제 호출은 npm run test:chat:ai, 기본 검사는 AI_CHAT_ENABLED=false다.
