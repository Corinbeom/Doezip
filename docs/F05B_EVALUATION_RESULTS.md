# F05b 평가 결과 검증·저장·조회 기반

## 작업 기준과 범위

`feature/F05b-evaluation-results`, 별도 worktree `../doezip-worktrees/F05b-evaluation-results`에서 작업한다.
origin/develop `4f72abc`에서 분기해 미통합 선행 F05a까지의 기능 커밋만 순서대로 가져왔다. 구현 직전 HEAD는 `f831b14`다. develop/main을 변경하지 않는다.
이번 범위는 INITIAL 결과의 구조·참조 검증, 원자 발행, 소유자 조회 및 기본 표시다. 실제 AI 평가와 학습 콘텐츠 검수 완료를 뜻하지 않는다.

## 결과 검증

- 서버에 동결된 snapshot과 fingerprint를 사용한다. 호출자가 전달한 Job의 본문·설정을 신뢰하지 않고 잠근 DB 행에서 다시 읽는다.
- 모델 후보는 summary/strengths/improvements/areas/faultSummary/nextPracticeText만 허용한다. 보고서 ID·소유 세션·평가 ID·문서 ID·시각·sample은 서버가 붙인다. 알 수 없는 필드, 누락·중복·다른 과제 루브릭, 잘못된 enum·UUID·범위, 빈 설명·NUL/잘못된 Unicode를 거부한다.
- 공개 루브릭의 코드·제목·영역과 정확히 일치해야 한다. PROMPT/DEFENSE는 필요한 입력이 아직 없으므로 NOT_OBSERVED만 허용한다. 미관찰은 능력 부족이나 0점으로 해석하지 않는다.
- 관찰은 해당 snapshot의 DOCUMENT_VERSION 또는 FAULT_ATTEMPT만 참조한다. 인용문은 제출본문/검토의 실제 부분 문자열이어야 한다. 자료는 snapshot의 공개 자료, 줄 범위, 정확한 원문 및 본문 hash를 검증한다. SOURCE_CHECK/COUNTEREVIDENCE에는 자료 인용이 필요하며 FAULT_REPAIR에는 실제 수정문이 필요하다.
- 미검토 문장은 UNREVIEWED 및 NOT_OBSERVED를 유지한다. 검토한 문장도 검수된 정답 판정 정책이 연결되기 전에는 REVIEW_REQUIRED만 허용하며 DETECTED/VALID_KEEP 등을 확정하지 않는다.
- 이 검사는 구조·근거 참조의 일관성 검사다. 자연어 설명의 교육적 타당성이나 인용과 결론의 의미적 일치까지 증명하지 않는다. 정답 키·시스템 prompt를 후보 생성/공개 설명에 복사하지 않는 경계는 실제 어댑터 구현에서도 유지해야 한다.

## 저장과 공개

V12는 dimension_evaluations, evaluation_evidence, feedback_reports 3개를 추가한다. 도메인 테이블은 15개이며 전체 22개 ERD 완료가 아니다.
세션 → 실행 중 평가 순으로 잠그고 현재 lease token·실제 만료 시각을 검사한다. 루브릭별 결과·관찰·공개 리포트·SUCCEEDED·FEEDBACK 전환은 한 트랜잭션이다. 최종 성공 갱신 직전에도 clock_timestamp로 만료를 검사하며 예외 시 전부 롤백한다. 외부 호출은 이 트랜잭션 안에서 하지 않는다.

리포트와 관찰은 DB UPDATE를 거부한다. 공개 조회는 GET `/api/v1/reports/{id}`이며 JWT와 세션 소유권, 성공 평가 연결을 검사한다. 타인/없는 결과는 동일한 404, 응답은 no-store다. 외부 발행·수정 API는 없다.
Evaluation.reportId와 Workspace.initialReportId/READ_INITIAL_REPORT는 원자 발행 이후에만 제공한다. 기본 화면은 결과가 있을 때 조회하며 오류·재시도, 4개 영역, 근거 인용과 검산 피드백을 제공한다. HTML은 실행하지 않는다. sample:true는 반드시 개발용 예시 배너를 표시한다.

DB 저장 방식의 ERD 대비 조정은 ADR-34를 따른다. 정규화 결과와 공개 JSON은 같은 트랜잭션에서 한 번만 만들며 JSON에는 내부 snapshot/lease/정답을 저장하지 않는다.

## 공개 기준 검토

로컬 v3는 가상 로그와 3개 검토 문장, 8개 공개 루브릭을 가진 개발용 과제다. rubric criteria_json은 비어 있고 검수된 비공개 정답 정책은 연결되지 않았다. 기존 로컬 migration이나 private task-pack은 수정하지 않았다.

| 기준 | 현재 검증 가능한 입력 | 이번 처리 |
| --- | --- | --- |
| prompt.context / prompt.iteration | 채팅 입력 미구현 | NOT_OBSERVED |
| evidence.source_check / evidence.calibration | 제출 검토·원문 인용 | ID·공개 단계·줄 인용 일치 검사; 정답 판정은 미확정 |
| document.grounding / document.uncertainty | 봉인된 사용자 보고서 | 관찰의 보고서 참조와 인용 검사; 의미 평가는 후속 |
| defense.explanation / defense.revision | 되묻기·새 정보 입력 미구현 | NOT_OBSERVED |

원자료와 문장 간 비교를 위한 구조가 있는 것과 학습용 발행을 승인한 것은 별개다. 실제 콘텐츠 정답 일관성·수정 기준·평가 기대값은 F05c 연결 전에 검수해야 한다. 사용자 보고서, 별도 검산 초안, 비공개 정답의 경계를 유지한다.

## 검증 구분

- 2026-09-12 전체 `npm run check` 성공: 웹 lint/typecheck/단위 74/build, API test/build 60, Testcontainers PostgreSQL, Playwright 37, OpenAPI·공개 fixture 21·생성 타입 일치. 실패·skip 없음.
- 성공 발행/소유자 조회/불변성, 동시 발행 1건 보장, 잘못된 근거·미검토의 정답 처리 차단, 만료·재claim된 워커 차단, 저장 도중 DB 실패·lease 만료 전체 롤백을 실제 PostgreSQL에서 확인했다.
- 브라우저에서 실제 미연결 실패·복원, 공개되지 않은 리포트의 인증/404/수정 차단, UI 전용 sample 결과·새로고침·실패/재시도를 확인했다. 결과 화면 pageerror 없음, 320px 가로 넘침 없음, 모바일 캡처를 육안 확인했다.
- PostgreSQL 통합 검사는 테스트 코드에서만 가상 후보를 만들고 내부 publisher를 직접 호출한다. 성공 발행·조회·소유권·불변성·중복 발행·stale lease·잘못된 후보·중도 실패/만료 롤백을 검사한다.
- 브라우저의 실제 API/worker 검사는 계속 미연결 실패와 복원을 확인한다. 결과 화면 성공 검사는 GET 응답을 가상 데이터로 대체한 **UI 경계 검사**이며 실제 AI 또는 일반 실행의 성공 평가로 표시하지 않는다.
- 일반 실행에는 테스트 발행 토글·자동 sample 결과·fixture 조회 API가 없다. 현재 워커는 EVALUATOR_NOT_CONFIGURED로 종료한다.
- 실제 Google 로그인 기반 이번 변경 수동 확인, 실제 AI 호출·성공 평가, 의미 평가 정확도·콘텐츠 검수는 미실행이다.

## 후속 작업

F05c: 검수된 입력·정답 정책, 실제 평가 어댑터, 출력 검증 실패 처리, 외부 호출 timeout/비용 상한을 연결한다.
F06: 근거 원문 이동·리포트 전용 화면과 최종 비교를 확장한다. 채팅·되묻기·조건 변경·FINAL 및 나머지 ERD/seed는 미완료다.

개발 의존성 점검에서 기존 js-yaml과 이를 사용하는 @redocly/openapi-core에 npm audit high 2건이 보고됐다. 이번 결과 기능에서 의존성은 변경하지 않았으며, OpenAPI 도구 의존성 보안 갱신은 별도 환경 관리 작업으로 남긴다.

## 로컬 실행 상태
테스트는 web3189/API8289/DB55519와 별도 Compose 프로젝트 doezip-f05b를 사용했다. 일반 개발을 web3129/API8289로 전환했고 `/tasks` HTTP 200과 `/actuator/health` UP을 확인했다. 기존 F05a의 DB55509와 원본 F00 작업 공간은 보존한다. 이전 세션 URL은 새 DB에 없으므로 `/tasks`에서 새 과제를 시작한다. 실제 Google 기반 이번 수동 검증은 아직 하지 않았다.

F05c 후속 구현을 위해 검증된 F05b 변경을 로컬 기준 커밋으로 고정한다. push·PR·merge·배포는 하지 않았다. 선행 F05a 커밋/CI 성공과 이번 F05b 로컬 검증은 구분한다.
