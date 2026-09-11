# F04a 검산 시작·초안 열람

## 작업 기준

- 브랜치 `feature/F04a-challenge-start`, 작업 공간 `/Users/hwaseongcityboy/Desktop/doezip-worktrees/F04a-challenge-start`.
- origin/develop `4f72abc`에서 시작하고 F02a/F01/F02b/F02c 선행 커밋을 분리해 가져왔다. 시작 HEAD는 `32fe1e0`이다.
- F02c는 원래 브랜치에서 `5bac141`로 커밋·push했다. 원격 CI에서 드러난 시각 정밀도 문제는 F02c의 `00d73c8`로 수정·push했다. F04a에는 `4ac3c28` 선행 커밋으로 반영했다.
- 선행 기능은 develop에 아직 통합되지 않았다. F04a 변경과 선행 변경을 구분해 검토한다. 원본 F00과 앞선 작업 공간의 사용자 변경을 보존한다.

## 구현 범위

최초 제출한 세션에서 검산 안내를 읽고 확인하면 별도 검토용 초안을 배정한다.
안내 버전 `challenge-notice-v1`과 acknowledged=true가 필수다. 최초 제출본 존재·ACTIVE/CHALLENGE·소유권을 서버가 검사한다.
세션 행 잠금과 세션당 run 유일성으로 동시 시작·응답 유실 재시도를 처리한다. 재시작해도 같은 초안을 반환한다.

초안은 사용자 보고서와 별개의 데이터다. 시작/열람이 사용자 draft나 불변 제출본을 변경하지 않는다.
문장 ID/순서/텍스트만 공개하고 변형 코드·오류 개수·정답 키는 직렬화하지 않는다.
안내 확인 전에는 workspace에도 초안 제목·본문·템플릿 ID를 넣지 않는다. 원문 HTML은 실행하지 않는다.

API는 POST `/api/v1/sessions/{id}/challenge`와 GET `/api/v1/challenge-runs/{id}`다.
인증 누락 401, 타인/없는 리소스 404, 잘못된 단계 409, 안내 입력 오류 400, 준비 실패/본문 해시 불일치 503이다.
시작 실패를 가짜 성공 run으로 대체하지 않는다. 준비가 끝나기 전에 안내 확인 시각을 저장하지 않는다.

V8은 검산 템플릿·문장·실행 3개 테이블을 추가한다. 같은 과제만 배정하는 복합 FK와 템플릿/문장 UPDATE 차단을 둔다.
V9(local)은 옛 v2를 ARCHIVED로 보존하고 과제 v3·공개 자료 사본·가상 검산 문장 3개를 추가한다.
학습용 발행/정답 검수 완료가 아니며 전체 ERD·과제 seed를 구현한 것이 아니다. 도메인 테이블은 총 9개다.

검토 저장·근거 선택·검산 제출은 F04b 범위다. 현재 reviews는 비어 있고 run은 IN_PROGRESS이며 평가 완료로 표시하지 않는다.
AI 호출·평가·채팅·FINAL은 이번 범위가 아니다. 새 의존성이나 계약 변경은 없다.

## 실행 환경·검증

테스트는 웹 3149 / API 8239 / DB 55489의 별도 로컬 DB에서 실행한다. 기존 F02c DB는 유지한다.
기존 Supabase 설정을 로컬 `.env`에 재사용하고 비밀값은 커밋하지 않는다. 실제 Google 검증과 테스트 JWT 검증을 구분한다.
최종 `npm run check` 통과: 웹 lint/typecheck/단위63/build, API test/build43, 실제 PostgreSQL Testcontainers, Playwright29, OpenAPI/공개 fixture21/생성 타입 일치. 실패·skip 0개다. F04a 구현은 별도 작업 변경으로 보존하며 PR·merge·배포는 하지 않는다.


## 검증 중 발견한 문제

- F02c 첫 원격 CI는 나노초/마이크로초 시각 차이로 재전송 동일성 검사 2개가 실패했다. 저장 전 마이크로초 정규화와 실제 PostgreSQL 왕복 회귀 검사를 F02c에서 수정했다.
- 별도 포트 실행 시 기존 인증 단위 테스트가 API 주소를 하드코딩해 실패했다. 테스트 내부 환경 설정을 격리했다.
- F04a 첫 백엔드 검사는 응답 필드 수를 11개로 잘못 기대해 1개 실패했다. 계약의 실제 10개 필드 이름을 정확히 검사하도록 고쳤다.
- 수정 후 F04a 웹63/API42/브라우저29 통과. 이후 F02c 정밀도 회귀 검사와 수정을 가져온 최종 통합 검사는 별도로 기록한다.

- F02c 수정 커밋 `00d73c8`의 [GitHub CI](https://github.com/Corinbeom/Doezip/actions/runs/34572780019)가 성공했다. 이전 실패 run과 구분한다. F04a 자체 원격 CI는 아직 실행하지 않았다.


## 최종 실행 상태

- 일반 개발: 웹 http://localhost:3129/tasks / API8239 / DB55489. OAuth callback은 기존 3129를 유지한다.
- F02c 실행기만 종료하고 F04a 실행기를 시작한다. F02c DB55479, F02b DB55469와 원본 작업 공간의 변경은 보존한다. 별도 DB이므로 이전 세션 주소 대신 새 가상 과제 v3를 시작한다.
- 브라우저는 테스트 JWT로 실제 서명 검사·API·DB와 연결했다. 사용자 실제 Google 검산 시작, 두 계정 Google 로그인, 장시간 갱신은 미실행이다.
- 실제 검산 흐름에서 pageerror 없음, 안내 전 미노출·응답 유실 재시도·같은 run 복원·사용자 보고서 보존·타인 접근 차단 통과. 데스크톱/320px 캡처를 직접 확인했다. full-page 캡처 전 페이지 상단으로 이동해 고정 헤더 캡처 위치를 정리했다.
- 문서 링크·diff check·실제 설정값 미포함 확인. 기존 개발 도구 npm audit high2는 별도 정비 항목이며 신규 의존성은 없다.
- F04a는 검산 시작·열람 변경을 별도 기능 커밋으로 관리한다. F02c 커밋과 정밀도 수정은 별도 기능 브랜치에 push했고 CI가 통과했다. F04a 원격 CI 결과는 해당 커밋의 GitHub Actions에서 확인한다. PR·develop/main merge·배포는 하지 않았다.

- 실제 개발 설정에서도 웹 /tasks HTTP200, API /actuator/health HTTP200 UP을 확인했다.

## 공유 전 점검

- F04a 선행 HEAD `4ac3c28`과 원격 F02c `00d73c8`의 파일 트리는 동일하다. 선행 7개 커밋은 patch-equivalent이며 F04a 기능 변경만 추가한다.
- 원본 F00의 디자인 자료와 `apps/api/bin/` 등 기존 변경은 이번 커밋에서 제외하고 보존한다. 환경변수·의존성·OpenAPI 계약 변경은 없다.
- develop 통합 시 선행 기능을 중복 반영하지 않도록 F02c까지의 변경을 먼저 검토하고 F04a 추가 diff를 구분한다. 이번 공유에서 PR·merge는 수행하지 않는다.

- 공유 직전 `npm run check`를 다시 실행해 성공했다. 웹 단위 63개·브라우저 29개를 재실행했고 lint/typecheck/build·계약/fixture 검사가 통과했다. 백엔드 43개 검사의 입력은 동일해 이번 실행에서는 Gradle UP-TO-DATE 결과를 재사용했다. 실제 Google 수동 검증은 별도로 남아 있다.
