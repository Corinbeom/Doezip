# F01 로그인 기반 구현

2026-09-10. **코드·로컬 자동 검증 및 사용자 확인을 통한 최초 Google 로그인 기록이다. 새로고침·재로그인은 사용자 확인과 DB 집계로 확인했다. 토큰 갱신·실제 두 계정 검증은 남아 있다.**

## 범위와 브랜치

- 작업 공간: `/private/tmp/doezip-auth`, 브랜치: `feature/F01-auth`.
- 기준 `origin/develop`: `4f72abccf9e340911cb70062d9e3496f310c3f3b`.
- 미통합 선행 작업인 과제 조회·승인 디자인을 각각 `36e2160`, `b1e8ffe`로 가져왔다.
  develop에 선행 작업을 반영한 뒤 F01 변경만 통합해야 중복을 피할 수 있다.
- 프론트/API 병렬 작업은 각각 별도 worktree에서 진행 후 이 작업 공간에 통합했다.
- 원본 F00 작업 공간은 수정·삭제·초기화하지 않았다. 이번 마무리 범위는 기능 브랜치 커밋·push이며 PR·merge는 포함하지 않는다.

## 구현

- 승인한 디자인 기준 로그인 화면·헤더 상태, Google PKCE 시작·콜백 교환·실패 재시도.
- 설정 누락 시 안내 및 로그인 비활성화. 공개 과제 조회는 계속 사용 가능하다.
- Supabase 세션 이후 API bootstrap → me 조회가 성공해야 사용자 연결로 표시한다.
- 사용자 테이블 V3 migration, provider+subject 식별과 동시 최초 연결의 멱등성.
- Spring JWT 서명·issuer·audience·필수 만료·nbf·subject·role·익명 여부 검증.
- 사용자별 Query 취소·삭제와 공통 Bearer/401 처리. 개인 Query는 `meta: { private: true }` 필수.
- `CurrentUser` 소유권 검사 공통 기반. 실제 학습 세션·보고서 소유권 적용은 해당 기능 구현 시 진행한다.
- API 계약·생성 타입의 의미 변경은 없다. 신규 의존성은 Supabase JS 2.116.0과 Spring Resource Server다.

## 검증 경계

웹 단위 검사는 SDK 경계의 테스트 대역을 사용하고, API 통합 검사는 로컬 JWKS의 실제 서명 토큰과
Testcontainers PostgreSQL을 사용한다. 브라우저 검사는 실제 웹·API·로컬 DB 및 인증 실패 화면을 확인한다.
이들 검사는 Google/Supabase 외부 인증 성공을 증명하지 않는다.

통합 작업 공간에서 외부 인증 설정을 비활성화해 검증했다. `.env`는 덮어쓰지 않았다.

```bash
AUTH_ENABLED=false NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run check
```

- OpenAPI 검증·공개 fixture 21개·생성 타입 차이 검사: 통과.
- 웹 lint·typecheck·Vitest 34개·production build: 통과.
- API test/build: 21개 통과, 실패·skip 0. 실제 PostgreSQL Testcontainers 포함.
- 브라우저: 최초 15개 통과·2개 실패. Next.js route announcer와 본문의 alert를 함께 찾은 테스트 선택자 문제였다. 본문으로 선택 범위를 좁힌 뒤 `AUTH_ENABLED=false NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run test:e2e` 재실행: **17개 모두 통과**. 데스크톱·320px 로그인 캡처도 확인했다.
- 공개 키 설정에 secret 키 형태를 넣으면 웹 빌드 전 거부하고 값을 출력하지 않는 실행기 검사: 통과.
- 변경 문서 링크·`git diff --check`·공통 비밀값 패턴 검사: 통과. `.env`·빌드 결과는 Git 제외.
- `npm audit`: 기존 개발 의존성인 Redocly 하위 js-yaml CPU 소모 취약점 관련 high 2건. 로그인 의존성 추가로 기존 패키지 버전은 변경하지 않았다. 별도 의존성 정비 대상으로 남긴다.
- GitHub CI 실행: 미실행. 최초 외부 Google 로그인은 아래 사용자 확인 기록을 참고한다.

## 외부 설정 후 남은 확인

[AUTH_SETUP.md](AUTH_SETUP.md)에 계정 생성·OAuth redirect·환경변수와 실제 로그인 체크리스트가 있다.
Supabase 프로젝트와 Google OAuth 설정을 연결했다. 최초 Google 로그인은 사용자가 완료했다고 확인했다. 새로고침 상태 유지와 로그아웃 후 재로그인은 사용자가 확인했고 DB 사용자 수는 1명으로 유지됐다. 실제 취소·토큰 갱신·개인 캐시 제거 및
실제 두 계정 연결은 미검증이다. 실제 설정값은 `.env`에만 보관하고 Google Client Secret은 Supabase 대시보드에 입력한다.

현재 PKCE 세션은 브라우저 저장소를 사용한다. HttpOnly BFF가 아니며 XSS 방어가 필요하다.
로그아웃 후 이미 발급한 JWT는 만료까지 서버에서 유효할 수 있다.
전체 도메인 migration·학습 seed·작성/저장·채팅·검산·평가·리포트·AI 호출은 이번 작업 범위 밖이다.

## 외부 설정 연결 확인 (2026-09-10)

사용자가 `.env`를 입력한 뒤 값을 출력하지 않고 URL·issuer·JWKS 일치 및 publishable 키 형식을 확인했다.
서버를 재시작했고 Supabase settings 응답 200·Google 활성화, JWKS 응답 200·ES256 키 1개,
authorize 응답 302·accounts.google.com 이동·Supabase callback 일치를 확인했다. API health는 UP이다.
현재 CUA에 사용 가능한 브라우저가 없어 계정 선택·동의·callback 이후 사용자 매핑은 직접 확인하지 못했다.
실제 로그인 검증은 사용자가 http://localhost:3129/login 에서 로그인한 뒤 이어서 진행한다.

## 최초 실제 로그인 확인 (2026-09-10)

사용자가 Google 로그인을 완료했다고 확인했다. 에이전트는 로컬 PostgreSQL을 읽기 전용 집계로 조회해
users 1행, 고유 provider+subject 1개, 표시 이름이 있는 사용자 1명을 확인했다.
이름·이메일·subject·토큰은 출력하거나 기록하지 않았다. 브라우저 성공 화면은 사용자의 확인이며
에이전트가 직접 관찰한 결과와 구분한다. 원래 과제로 복귀·새로고침·재로그인 중복 방지·로그아웃·
실제 두 계정 분리는 아직 직접 검증하지 않았다.

## 새로고침·재로그인 확인 (2026-09-10)

사용자가 새로고침 후 로그인 상태 유지와 로그아웃 후 재로그인 완료를 확인했다.
재로그인 후 읽기 전용 DB 집계는 users 1행·고유 provider+subject 1개로 최초 로그인 이후 사용자 중복이 없다.
브라우저 상태는 사용자 확인, DB 집계는 에이전트 실행 결과다. 실제 만료 후 토큰 갱신, 개인 캐시 제거,
독립 Google 계정 2개 검증까지 완료한 것으로 확대하지 않는다.

## 공유 전 점검

Next.js 개발 요청 로그에서 OAuth callback 쿼리가 출력되는 것을 확인해 해당 경로를 로그 제외 대상으로 설정했다.
실제 로그인 토큰이나 코드를 테스트·문서에 저장하지 않는다. GitHub push 후 CI 결과는 별도로 확인하며 로컬 성공으로 대체하지 않는다.

- 콜백 로그 제외 검증: 별도 개발 서버에 합성 code 쿼리로 HTTP 요청해 200 응답과 캡처한 로그에 합성 code가 없음을 확인했다.
- 설정 근거: [Next.js incoming request logging](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging). 배포 시 외부 프록시 access log의 쿼리 기록 정책은 별도 검토한다.

- 공유 전 재검사: 계약·웹 lint/typecheck·unit 34개·build 성공. API test/build는 동일 코드의 기존 21개 성공 결과를 Gradle UP-TO-DATE로 재사용했다.
- E2E 재검사 중 상세 제목 스타일을 한 번만 읽는 검사에서 빈 값(NaN)으로 1건 실패했다. 같은 28px 기준을 expect.poll로 확인하도록 별도 F02a 테스트 변경으로 분리했다. 이후 E2E 전체 17개가 통과했다.
