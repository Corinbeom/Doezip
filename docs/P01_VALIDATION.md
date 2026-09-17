# P01 검증 — 2026-09-15

## 실행 결과

| 검사 | 결과 |
| --- | --- |
| OpenAPI, 공개 fixture 31개, 생성 타입 재생성 비교 | 통과 |
| web lint / typecheck / unit / production build | 통과, 단위 95개 |
| API JUnit / Testcontainers PostgreSQL / build | 통과, 91개. 이번 작업에서 실제 실행했고 마지막 전체 검사에서는 동일 코드의 UP-TO-DATE 결과를 재사용 |
| 브라우저 E2E | 최종 47개 통과 |
| 실제 Gemini 새 피드백 | 가상 공개 입력 4회, 구조·근거·내부 용어 검사 통과. 의미 품질 전체 승인 아님 |
| diff 공백 / 설정된 비밀값 / 생성물 경계 / 응답 해시 | 통과 |

API 검사는 두 유형×두 모드, 타 사용자 404, 단계 선행조건, stale artifact 거부, 타 과제·비공개 자료 인용 거부, 제출 후 불변성, 비동기 평가 실패·stale token·중복 요청, 별도 재연습을 포함한다. 평가 성공 API 검사는 **모의 AI adapter와 실제 PostgreSQL**을 사용한다. 실제 공급자 검사와 구분한다.

E2E는 실제 웹/API/PostgreSQL로 두 유형×두 모드를 작성·저장·인용·제출·직접 설명·미설정 오류·새로고침 복원까지 실행했다. 실제 코드 실행은 QuickJS WASM이다. 페이지 JavaScript 오류가 없음을 확인했다. 375px에서 실제 편집기 로드 후 가로 넘침을 검사하고 화면을 캡처했다. 보고서·구현 데스크톱 및 모바일 캡처를 에이전트가 직접 확인했다.

처음 발견한 새 저장 계층 연결 및 JPA/JDBC flush 문제는 수정 후 API 검사로 확인했다. 첫 E2E의 새 네 사례 실패는 제품의 평가 미설정 안내와 Next route announcer를 동시에 선택한 테스트 선택자 오류였고, 실제 안내 요소로 범위를 좁힌 후 통과했다. 모바일 검사는 초기 로딩 화면만 확인하는 약점을 고쳐 편집기 로드 후 검사한다. 이 실패들을 처음부터 성공했던 것으로 표시하지 않는다.

전체 검사 로그: `/tmp/doezip-p01-final-check.log`. 마지막 모바일 CSS/테스트 변경 후 web lint/typecheck/95개 unit을 `/tmp/doezip-p01-final-web.log`, production build/47개 E2E를 `/tmp/doezip-p01-final-e2e.log`에서 재검증했다. API 코드는 이 마지막 화면 변경에 포함되지 않는다.

## 실제 AI와 미실행 범위

실제 Gemini 호출은 `learning-feedback-v1`에 대한 4회뿐이다. 반복 호출로 통과를 선택하지 않았다. [원문과 의미 검토](validation/P01/README.md)를 따른다. 제안 주체를 추정하게 하는 표현 1건이 남아 있어 전체 평가 품질 검수 완료로 표시하지 않는다.

실제 Google OAuth 재로그인부터 실제 AI 평가·재연습까지 한 브라우저에서 끝까지 수행한 검사는 이번에 실행하지 않았다. E2E 인증은 로컬 서명 issuer이며 외부 OAuth에 접근하지 않았다. 전문가 과제 검수, 더 긴 대화/조건 변경 사례 평가, 독립 서버 코드 채점, 원격 CI 실행 및 배포도 완료로 표시하지 않는다.

## 로컬 확인과 재검사

별도 worktree: `/Users/hwaseongcityboy/Desktop/doezip-worktrees/P01-learning-flow`
브랜치: `feature/P01-learning-flow`. origin/develop `c49abce`에서 분기하고 I02 의존성을 `c531dab`으로 cherry-pick했다. P01은 핵심 흐름의 첫 구현으로 로컬 커밋한다. push/PR/merge/배포는 수행하지 않는다.

직접 확인 서버: `http://localhost:3189/learn`, API `http://localhost:8389/actuator/health`.
2026-09-15 사용자 요청으로 P01 코드를 기존 I02 사용자 확인 환경에 연결했다. 사용자 확인 DB는 PostgreSQL 55609의 `doezip_preview`다. 전환 전 private 경로에 pg_dump 백업을 보관하고 V16/V17 추가 migration 적용 후 기존 사용자 기록 17개 테이블의 행 수·내용 해시가 같음을 확인했다. 기존 과제·자료는 migration에서 수정하지 않는다.
이전 I02 앱 서버와 P01 3209/8409 앱 서버만 종료했으며 원본 F00 변경과 각 DB 볼륨은 보존했다. P01 worktree의 무시되는 `.env`에 고정 포트를 저장했다. 인증 설정은 보존했으며 실제 Google 재로그인은 이번 전환 검사에 포함하지 않는다. 자동 검사용 PostgreSQL 55629의 `doezip`은 계속 분리한다.

확인 서버를 켠 채 재검사할 때는 별도 포트와 테스트 DB를 명시한다.

```sh
WEB_PORT=3219 API_PORT=8419 E2E_AUTH_PORT=9099 \
DATABASE_URL=jdbc:postgresql://localhost:55629/doezip \
CORS_ALLOWED_ORIGIN=http://localhost:3219 \
NEXT_PUBLIC_API_BASE_URL=http://localhost:8419/api/v1 npm run check
```

검사가 웹 production build를 만들므로 실행 중인 dev 서버와 `.next` 경합이 발생하면 검증을 별도 worktree에서 수행하거나 자신이 시작한 dev runner를 종료한 후 실행한다. DB 볼륨은 삭제하지 않는다.

## 마감 범위와 다음 작업

사용자가 3189에서 새 흐름을 확인하고 훈련/모의 전형의 차이가 힌트에 머무는 점, 긴 페이지 스크롤의 불편을 제기했다. 전체 Google 로그인→실제 AI→재연습 성공을 사용자 확인 완료로 확대 해석하지 않는다.
P01은 핵심 흐름 첫 구현으로 마감한다. 모드별 학습 경험, 단계형 화면·좌우 작업 공간, 저장 상태를 유지하는 패널 이동은 P02에서 구현한다. AI 의미 품질 검수·전문가 콘텐츠 검수·독립 서버 코드 채점은 별도 후속이다.
