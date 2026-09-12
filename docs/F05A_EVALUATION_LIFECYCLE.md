# F05a 평가 요청·상태·복구 기반

## 작업 기준
- feature/F05a-evaluation-lifecycle, /Users/hwaseongcityboy/Desktop/doezip-worktrees/F05a-evaluation-lifecycle.
- origin/develop에서 분기하고 선행 F04b까지 분리된 커밋으로 가져온 HEAD 22b4962 위에서 구현한다. 선행 기능은 develop 미통합이다.

## 구현
- POST /api/v1/sessions/{id}/evaluations (202, UUID Idempotency-Key 필수), GET /evaluations/{id}, POST /evaluations/{id}/retry (202).
- INITIAL의 봉인 문서·제출된 검산·세션 소유권·ACTIVE 및 CHALLENGE/FEEDBACK 단계 검사. FINAL은 후속 작업이며 거부한다.
- 같은 session/key는 phase/document ID가 같으면 기존 요청을 반환한다. 다른 입력은 409, 다른 active 요청은 기존 ID를 포함한 409다.
- 서버가 문서 본문/hash, 검산 응답·인용, 공개 자료 본문, 과제/공개 루브릭, 평가 설정을 snapshot으로 고정한다. 아직 없는 채팅·되묻기·이벤트 입력은 unimplementedInputs로 명시한다.
- 정렬된 JSON의 SHA-256을 저장하고 워커에서 검증한다. DB trigger로 입력·설정·키·fingerprint 변경을 차단한다. 공개 응답에는 snapshot/lease/원본 보고서를 포함하지 않는다.
- V11 evaluation_runs 추가로 도메인 테이블 12개. 같은 세션 active 평가 1개, 세션·문서·검산 복합 FK, 시도 횟수 및 lease 상태 제약.
- 실제 Spring 스케줄러가 2초 간격으로 복구/claim/처리를 실행한다. PostgreSQL SKIP LOCKED, 30초 lease, token/만료 확인 후 종료. claim/종료만 짧은 트랜잭션이며 처리 중 DB 트랜잭션을 유지하지 않는다.
- lease 만료 등 일시 실패는 누적 3회까지 자동 재queue, 이후 명시 재시도 1회로 총 4회 제한. retry는 같은 행과 snapshot을 사용한다. 오래된 워커 결과는 거부한다.
- 작업 공간은 terminal 실패 후에도 최신 evaluation ID를 제공해 새로고침으로 복원한다. 필드명 activeEvaluationId는 현재 화면이 추적할 최신 요청 ID로 사용한다.
- UI는 검산 제출 후 요청·상태 조회·오류·허용된 재시도를 제공한다. 응답 유실 시 같은 키 사용, 사용자별 private Query, 요청 취소 및 계정 변경 경계를 따른다.

## 완료로 표시하지 않는 범위
- 실제 평가기/AI/점수/리포트 발행은 미구현이다. 현재 워커는 입력 검증 후 EVALUATOR_NOT_CONFIGURED로 FAILED를 기록하며 retryable=false다. 대기 행만 방치하거나 가짜 SUCCEEDED를 만들지 않는다.
- SUCCEEDED enum은 계약상 존재하지만 성공 발행 경로는 F05b 이후 실제 결과·리포트 원자 발행과 함께 구현한다.
- 비용·계정별 호출 한도, worker heartbeat/장시간 외부 호출 timeout은 실제 평가 어댑터 전에 추가한다. 현재 외부 호출은 없다.
- 전체 22개 테이블·정식 seed·비공개 정답 평가·채팅·되묻기·FINAL 평가는 미완료다.

## 검증과 실행
- 자동 검증은 로컬 서명 JWT와 실제 API/PostgreSQL을 사용한다. 실제 Google 로그인 기반 F05a 평가 요청·미연결 안내·새로고침 복원·보고서/검토 보존은 사용자가 정상 수행 완료를 확인했다. 두 Google 계정과 장시간 토큰 갱신은 미실행이다.
- SessionIntegrationTest에서는 scheduler만 app.evaluation.worker-enabled=false로 끄고 실제 worker/repository를 직접 실행해 lease·시도 횟수·재시도를 검증한다. E2E와 일반 실행에서는 실제 scheduler를 활성화한다.
- 테스트 web3179/API8279/DB55509, 별도 Compose 프로젝트 doezip-f05a. 일반 Google 확인은 WEB_PORT3129를 사용한다. 기존 F04b DB55499와 작업 공간은 보존한다.
- 구현은 별도 기능 커밋으로 공유하며 PR·merge·배포는 수행하지 않는다. 최종 검사 결과는 아래와 같다.

## 최종 검증 결과
- 전체 `npm run check` 성공: 웹 lint/typecheck/단위70/build, API test/build53, Testcontainers PostgreSQL, Playwright35, OpenAPI·공개 fixture21·생성 타입 일치. 실패·skip 없음.
- 최초 새 통합 검사 1건은 기존 오류 도우미가 details 없는 3필드만 가정해 실패했다. 진행 중 evaluationId를 details로 반환하는 계약을 명시 검사하도록 수정 후 통과했다.
- 스케줄러 활성 E2E에서 요청→실제 워커 실패 처리→복원, 응답 유실 재전송 동일 키, 타인 조회/재시도 차단, 공개 응답의 snapshot 제외를 확인했다. pageerror 없음, 320px 캡처 확인.
- F04b 실행기만 종료하고 F05a를 web3129/API8279로 실행한다. DB는 별도55509이며 이전 DB와 작업 공간을 보존한다. 새 과제를 시작해 확인한다.
- 사용자 수동 검증 기록을 반영했다. 원격 CI 결과는 해당 커밋의 GitHub Actions에서 확인한다.

- 일반 개발 설정에서도 /tasks HTTP200, /actuator/health HTTP200 UP을 확인했다.

- 공유 준비에서는 문서의 검증 상태만 갱신했다. 실행 코드는 앞선 전체 검사 이후 변경하지 않았으며 이전 검사를 이번 재실행 결과로 표시하지 않는다.
