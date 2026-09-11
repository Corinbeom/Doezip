# F01 Google 로그인 외부 설정

외부 프로젝트와 Google provider 설정을 연결했고 설정 API·JWKS·Google 리다이렉트 응답을 확인했다. 최초 Google 로그인은 사용자가 완료를 확인했고 로컬 사용자 DB 1행도 확인했다. 나머지 검증은 아래 체크리스트에 남겨 둔다.
아래 설정은 저장소 소유자의 Supabase·Google 계정에서 수행한다. 코드·JWT 자동 검증과 별도로 완료 여부를 기록한다.

## 1. Supabase 프로젝트

Supabase 대시보드에서 Doezip용 프로젝트를 만든다. 이 프로젝트는 인증에만 사용한다.
Doezip의 users·과제·보고서는 기존 Spring PostgreSQL에 저장하며 Supabase DB로 옮기지 않는다.
프로젝트의 Connect 또는 API Keys에서 **Project URL**과 **Publishable key (`sb_publishable_...`)**를 확인한다.
Google Client Secret이나 Supabase secret/service_role 키를 웹 설정에 넣지 않는다.

## 2. Google OAuth 설정

Google Cloud 프로젝트를 만들고 Google Auth Platform에서 앱 이름·지원 이메일·대상 사용자를 설정한다.
테스트 상태라면 테스트 사용자에 본인 Google 계정을 추가한다. 필요한 범위는 openid, email, profile뿐이다.
OAuth Client를 **Web application**으로 만든다.

| 항목 | 현재 F01 로컬 값 |
|---|---|
| Authorized JavaScript origins | `http://localhost:3129` |
| Authorized redirect URIs (Google → Supabase) | Supabase Google provider 화면에 표시되는 `https://<project-ref>.supabase.co/auth/v1/callback` |

발급한 Google Client ID와 Client Secret은 Supabase의 Authentication → Google provider 설정에 넣고 활성화한다.
Google 비밀 키를 Doezip `.env`나 채팅에 넣을 필요는 없다.

## 3. Supabase 복귀 주소와 서명 키

Authentication URL 설정:
- Site URL: `http://localhost:3129`
- 허용 Redirect URL: `http://localhost:3129/auth/callback`

두 callback을 혼동하지 않는다. Google은 Supabase로, Supabase는 Doezip `/auth/callback`으로 돌아온다.
웹 포트를 변경하면 허용 origin·redirect·CORS도 함께 수정한다. 기본 README 포트 3000으로 실행한다면
위 3129를 모두 3000으로 바꾼다. 광범위한 wildcard 복귀 URL은 등록하지 않는다.

JWT Signing Keys에서 비대칭 키 ES256 또는 RS256을 사용한다. 이 구현은 공유 비밀 HS256을 받지 않는다.
프로젝트 issuer와 JWKS URL은 다음 설정과 정확히 일치해야 한다.

## 4. 로컬 환경변수

실행할 checkout 루트의 `.env`에 설정한다. 현재 F04a 작업 공간은 `/Users/hwaseongcityboy/Desktop/doezip-worktrees/F04a-challenge-start`다. 기존 `.env`를 덮어쓰지 말고 인증 항목만 채운다.
아래 예시의 `<project-ref>`와 공개 키를 실제 값으로 바꾼다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
AUTH_ENABLED=true
AUTH_ISSUER=https://<project-ref>.supabase.co/auth/v1
AUTH_JWK_SET_URI=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
AUTH_AUDIENCE=authenticated
AUTH_PROVIDER_ID=doezip-supabase
```

AUTH_PROVIDER_ID는 사용자를 구분하는 내부 제공자 코드다. 같은 DB에 연결하는 Supabase 프로젝트를
교체할 때 이 코드를 그대로 재사용하지 말고 사용자 매핑 정책을 먼저 결정한다.
이 파일은 Git 제외다. 설정 후 dev 서버를 재시작한다. production build 및 E2E는 공개 설정을 빌드에
포함하므로 다시 빌드해야 한다. 기본 CI는 실제 계정 없이 AUTH_ENABLED=false로 동작한다.

## 5. 실제 로그인 확인 항목

- [x] 최초 Google 로그인: 사용자 완료 확인 및 로컬 users 1행 확인.
- [ ] Google 로그인 동의 → callback → 원래 과제로 복귀까지 브라우저 직접 확인.
- [x] 최초 로그인 및 재로그인 후 로컬 DB users 1행 유지: 사용자 재로그인 확인 + DB 집계.
- [ ] 로그인 취소·실패 안내와 다시 시도.
- [x] 새로고침 후 로그인 상태 유지: 사용자 확인.
- [x] 로그아웃 → 재로그인 흐름: 사용자 완료 확인.
- [ ] 새로고침 시 API 사용자 조회의 브라우저 네트워크 직접 관찰.
- [ ] 로그아웃 후 사용자 표시와 개인 캐시 제거.
- [ ] 독립 Google 계정 2개의 `/me`가 서로 다른 사용자를 반환.

외부 설정이 준비되기 전에는 이 체크리스트를 완료 처리하지 않는다. 자동 검증에서 생성한 서명 토큰과
SDK 대역은 실제 Google 로그인 증거가 아니다.

## 구현 선택과 경계

웹은 Supabase SDK의 PKCE를 사용하며 브라우저 세션 저장·자동 갱신을 SDK에 맡긴다.
이는 HttpOnly 서버 세션 방식이 아니다. Spring API는 각 요청의 Bearer access token을 검증한다.
웹의 로그인 표시를 서버 권한 판정으로 사용하지 않는다. OAuth code·access/refresh token은 로그나 문서에 기록하지 않는다.
로그아웃은 브라우저 세션·캐시를 정리하지만 이미 발급된 JWT는 만료 전 즉시 무효화된다고 주장하지 않는다.
실제 학습 자료의 소유권 검증은 해당 기능을 구현할 때 서버의 CurrentUser와 함께 적용한다.

## 공식 근거 (2026-09-10 확인)

- [Google 연결·Client ID/Secret·callback·scope](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Publishable key와 secret key 구분](https://supabase.com/docs/guides/getting-started/api-keys)
- [Redirect URL 허용 목록](https://supabase.com/docs/guides/auth/redirect-urls)
- [PKCE 코드 교환](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [JWT 서명 키](https://supabase.com/docs/guides/auth/signing-keys)
- [Spring JWT 검증](https://docs.spring.io/spring-security/reference/6.5/servlet/oauth2/resource-server/jwt.html)
