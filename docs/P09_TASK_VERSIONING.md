# P09 — 과제 ID·버전 고정

## 문제

P08 카탈로그에는 안정적인 `catalogId`와 콘텐츠 `version`이 있었지만 실제 과제 시작 요청은 `kind`만 보냈다. 이 상태에서는 같은 보고서 또는 구현 유형에 과제가 둘 이상 생겼을 때 사용자가 선택한 과제를 서버가 구분할 수 없다.

## 구현

- `POST /learning-flows`는 `requestKey`, `catalogId`, `version`, `mode`를 받는다.
- 서버는 등록된 ID·버전 조합에서 REPORT/CODING 유형과 실제 자료·테스트 버전을 결정한다.
- 알 수 없는 ID·버전은 404로 거부하고, 같은 requestKey를 다른 과제·버전·모드에 재사용하면 409로 거부한다.
- V20 migration은 기존 flow를 유형에 맞는 catalogId로 보정하고 `task_catalog_id`를 필수로 만든다.
- 새 flow 응답과 재연습은 최초 선택한 catalogId·version을 유지한다.
- 웹의 `/tasks` 상세과 `/learn` 시작 버튼은 catalog 응답의 값을 그대로 전송한다.

## 호환 범위

기존 flow의 `flow_version`, 보고서 session, coding workspace와 제출 snapshot은 보존한다. V20은 적용된 이전 migration을 수정하지 않으며 기존 기록을 삭제하거나 다시 생성하지 않는다.

## 검증

- OpenAPI 생성 타입 재생성 및 변경 여부 검사
- 알려진 ID·버전 생성, 정확한 유형·콘텐츠 연결, 멱등 재시도
- requestKey 조합 변경 409, 알 수 없는 ID·버전 404, 이전 kind 요청 400
- 기존 flow migration 보정과 재연습의 과제 식별자 유지
- 웹 lint/typecheck/unit/build, API JUnit/Testcontainers, Playwright 전체 흐름
