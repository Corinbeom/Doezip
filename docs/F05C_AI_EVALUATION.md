# F05c 실제 AI 평가 어댑터

## 작업 분리

`feature/F05c-ai-evaluation`, 별도 worktree `../doezip-worktrees/F05c-ai-evaluation`에서 구현한다.
origin/develop에서 분기하고 선행 기능을 개별 커밋으로 가져왔다. 검증된 F05b는 원래 브랜치에서 로컬 `6dc58e6`으로 고정했고 F05c의 선행 HEAD는 `d3ab2da`다. 원본 F00와 F05b 작업 공간·DB는 보존했다.

## 연결

- EvaluationService가 사용 모델·프롬프트 버전·출력 제한 등 공개 설정을 snapshot과 evaluation_runs에 동일하게 고정한다. API 키는 저장하지 않는다.
- EvaluationWorker는 한 슬롯에서 처리하며 claim/heartbeat/실패/발행만 별도 트랜잭션이다. 외부 호출 중 DB 트랜잭션을 유지하지 않는다. lease 180초, heartbeat 20초, HTTP timeout 60초, attempt 150초 상한을 적용한다.
- GeminiEvaluationAdapter가 명시적 Google GenAI Client와 Spring AI ChatModel을 생성한다. JSON 응답 스키마, 고정 system prompt, 도구·검색·생각 출력 비활성화를 적용한다. 테스트용 URL 인자는 패키지 내부 HTTP 검사에만 존재하며 앱 환경변수로 외부 전송 목적지를 바꾸지 않는다.
- 기존 ResultValidator/ResultPublisher로 참조/인용/루브릭/허용 상태를 검증하고 성공 결과만 sample:false로 원자 발행한다. 모델이 만든 관찰 ID는 워커가 서버 UUID로 교체하고 method=LLM을 붙이며 실제 subject ID·인용은 검증한다. 임의 성공 대체 경로는 없다.
- V13 evaluation_call_budgets를 추가해 UTC 일일 계정/전체 호출을 원자 예약한다. 사용자 한도 초과 시 전체 한도 증가도 롤백된다. 현재 15개 기능 테이블 + 1개 운영 한도 테이블이며 전체 ERD 완료가 아니다.
- 웹은 AI 전송 안내와 안전한 오류 메시지를 표시한다. 계정별 private Query·소유자 결과 조회는 유지한다.

## 최종 검증 상태

- 실제 Gemini 3.5 Flash Lite 호출: 가상 공개 입력 1개가 결과 JSON·4개 영역·루브릭·근거 검증을 통과했다. 로그는 로컬 /tmp/doezip-f05c-lite.log다.
- 사용자 수동 확인: 실제 화면에서 평가 응답, 새로고침 후 결과 유지 정상. 모델 간 정확도·일관성 및 8개 기준 사례의 품질 비교는 아직 하지 않았다.
- 모델 기본값 정리 전 npm run check: 웹 lint/typecheck/76개 단위 테스트/build, API 70개 테스트/build 및 Testcontainers PostgreSQL, Playwright 37개, OpenAPI·공개 fixture 21개·생성 타입 일치 성공.
- 기본 검사는 실제 AI를 끄고 키를 제거한다. HTTP 테스트는 실제 SDK와 로컬 제공자 대역을 연결한다. PostgreSQL worker/validator/publisher 검사는 AI 응답만 대역으로 제공한다. 이 결과를 실제 AI 성공으로 간주하지 않는다.
- UI 보완은 별도 feature/F04c-challenge-ui에서 구현·검증했고 사용자가 화면을 확인했다.

## 모델과 진단 기록

최종 기본값은 gemini-3.5-flash-lite, temperature=1.0, thinkingLevel=MEDIUM이다. .env.example, Spring 기본값, 설정 객체, 명시적 smoke의 기본값을 동일하게 맞췄다. 모델은 평가 생성 시 snapshot에 고정한다.
기존 명세의 2.5에서 최신 모델을 검토했고, 3.8 Flash는 평가 호출에서 반복 5xx/높은 수요 오류가 관찰됐다. 단순 요청의 일부 성공을 전체 평가 성공으로 취급하지 않았다. 비교한 3.1 Pro는 무료 티어 quota 429로 실패했다. 사용자 제안에 따라 3.5 Flash Lite로 전환한 뒤 실제 평가가 성공했다. 진단 실패 기록을 성공으로 덮어쓰거나 기존 평가/사용자 제출본을 변경하지 않았다.

## 명세 대비 조정과 남은 검수

- SDK가 Retry-After를 노출하지 않아 429/5xx 자동 재시도는 보류했다. timeout/잘못된 결과는 제한 재시도하며 429는 중단, 5xx는 수동 재시도만 제공한다. ADR-35와 AI_SETUP.md를 따른다.
- 검수된 정답 정책·의미적 평가 품질·학습용 콘텐츠 발행 검수는 미완료다. 검토는 REVIEW_REQUIRED, 입력이 없는 PROMPT/DEFENSE는 NOT_OBSERVED로 유지한다.
- Spring AI 1.1.8의 responseJsonSchema 변환 차이 때문에 SDK extraBody의 native responseSchema를 사용한다. 실제 wire 검사에서 nullable·thinkingLevel·temperature·도구 미사용을 확인한다.
- 선행 F05b 테스트의 무작위 루브릭 순서 가정을 발견해 첫 항목 대신 PROMPT 영역을 선택했다. 검증 규칙을 완화하지 않았다.

## 실행과 공유

API는 F05c worktree의 8299, 사용자 DB는 55529/Compose doezip-f05c다. 현재 3129 웹은 별도 F04c UI worktree에서 API에 연결한다. 두 작업의 코드 브랜치는 합치지 않았다. 이전 F05b DB55519 및 원본 F00 사용자 변경은 보존한다.
F05b 선행 작업은 로컬 6dc58e6이며 F05c의 선행 HEAD는 d3ab2da다. F05c와 UI를 각각 커밋·일반 push하는 범위이며 PR·merge·배포·브랜치 보호 설정은 수행하지 않는다.

최종 3.5 Flash Lite 기본값 반영 후 npm run check도 성공했다: 웹 76개/린트/타입/빌드, API 70개/Testcontainers/빌드, E2E 37개, 계약·fixture·생성 타입 일치. 실제 호출 검사는 앞선 동일 모델 성공 기록을 사용하며 추가 유료 호출은 실행하지 않았다. 최종 로컬 로그는 /tmp/doezip-f05c-ship-check.log다.
