# P06 과제 콘텐츠 v0.2

## 목적

입문용 단일 자료·단일 버그 과제보다 실제 AI 활용 판단을 더 잘 관찰한다. 기존 제출과 피드백은 그대로 열 수 있게 두고, 새로 시작하는 `/learn` 흐름만 v0.2를 사용한다.

## 보고서 과제

새 과제 `payment-observation` version 2는 다음 공개 가상 자료 세 개를 함께 제공한다.

- 결제 API 지연·오류율·미수집 지표
- 배포와 롤백 시점, 인과관계를 확정할 수 없는 추적 공백
- 외부 사업자 상태, 제한된 고객 문의, 외부 원인으로 공지해 달라는 요청

사용자는 자료 간 일치와 충돌, 직접 근거와 반대 근거, 지금 할 대응과 다음 확인을 구분해 운영 리드용 보고서를 작성한다. 실제 사건 자료와 비공개 정답은 포함하지 않는다.

## 구현 과제

`duplicate-items-v2`는 제목을 항목 식별 기준으로 사용하는 시작 코드를 제공한다. 공개 브라우저 테스트는 다음 경계 조건을 실제 QuickJS 격리 환경에서 실행한다.

- 새 id 추가
- 같은 id와 다른 제목이면 기존 항목 유지
- 다른 id와 같은 제목이면 새 항목 추가
- 입력 배열 보존

테스트 결과는 서버 채점이 아니라 사용자가 실행한 공개 검증 기록이다. AI 수정안은 자동 적용하지 않으며 사용자가 채택·거절 이유와 남은 한계를 설명한다.

## 호환성과 데이터

- `learning-flow-v1`, 기존 보고서 task와 `duplicate-items-v1`은 수정하거나 삭제하지 않는다.
- Flyway V18은 새 coding task version을 허용하고 새 flow의 기본 버전만 v2로 바꾼다.
- local/demo V19는 공개 가상 보고서 task와 자료 세 개를 추가한다.
- 기존 flow를 열거나 재연습하면 저장된 `flow_version`과 같은 과제 정의·실행 스위트를 사용한다.
- 독립 `/coding`의 기존 연습은 v1을 유지한다.

## 검증

- v1·v2 과제 정의가 함께 유지되는 단위 테스트
- v2 시작 코드의 식별 기준 오류와 id 기반 수정안을 실제 QuickJS로 실행
- PostgreSQL 17 Testcontainers에서 새 report flow의 자료 세 개, 새 coding flow의 v2 workspace, 잘못된 suite 거부, 독립 v1 workspace를 확인
- OpenAPI의 coding version enum과 생성 타입을 함께 갱신

## 2026-09-17 검증 결과

- `npm run check` 통과: OpenAPI·공개 fixture 31개, 웹 lint/typecheck·Vitest 106개·production build, API JUnit 93개·PostgreSQL 17 Testcontainers·JAR build, Playwright E2E 49개.
- v2 문구와 공개 테스트 이름을 반영한 학습 흐름 7개도 별도 재실행해 통과했다.
- 기본 검사는 외부 AI와 OAuth 없이 실행했다. 실제 Gemini 의미 품질과 새 Google 계정 로그인은 공개 배포에서 별도로 확인한다.
