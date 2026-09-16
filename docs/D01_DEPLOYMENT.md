# D01 공개 데모 배포

## 목표와 경계

오늘 배포는 기능 검증용 공개 데모다. Vercel 웹, Render의 단일 Spring API와 PostgreSQL, 기존 Supabase Google 인증, Gemini API를 연결한다. 전체 MVP·운영 안정성·실제 학습 콘텐츠 검수 완료를 뜻하지 않는다.

무료 Render API는 유휴 15분 뒤 중지될 수 있고 첫 요청 복구에 시간이 걸린다. 무료 PostgreSQL은 생성 후 30일에 만료되고 백업을 제공하지 않는다. 장기 시연 전에 유료 인스턴스와 백업 정책으로 전환한다.

## 코드 구성

- `apps/api/Dockerfile`: Java 21 다단계 API 이미지
- `render.yaml`: Singapore API 1개와 PostgreSQL 17 한 개, DB health check, 비밀값 입력 자리
- `application-demo.yml`: 기본 schema와 `db/demo`의 공개 가상 과제만 적용
- `apps/web/vercel.json`: `apps/web`을 Vercel Root Directory로 선택했을 때 루트 lockfile을 사용하는 빌드
- `npm run deploy:smoke`: 공개 경계와 연결 확인

`local` 프로필과 로컬 DB는 배포에 사용하지 않는다. demo seed에는 공개 가상 자료만 포함하고 비공개 정답은 포함하지 않는다.

## 배포 순서

1. 배포 브랜치를 GitHub에 일반 push하고 CI 성공을 확인한다.
2. Render에서 이 저장소의 `render.yaml` Blueprint를 연결한다.
3. Blueprint 생성 화면에서 다음 비밀값을 입력한다.
   - `CORS_ALLOWED_ORIGIN`: Vercel 주소 확정 전에는 `https://localhost.invalid`, 확정 뒤에는 최종 Vercel HTTPS origin
   - `AUTH_ISSUER`: `https://<project-ref>.supabase.co/auth/v1`
   - `AUTH_JWK_SET_URI`: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`
   - `GEMINI_API_KEY`: 서버 전용 Gemini 키
4. Render API `/actuator/health`가 `{"status":"UP"}`만 반환하는지 확인한다.
5. Vercel에서 같은 저장소를 가져오고 Root Directory를 `apps/web`으로 지정한다. Root Directory 밖의 루트 lockfile과 workspace를 빌드에 포함하도록 `Include source files outside of the Root Directory`도 켠다.
6. Vercel Production 환경변수를 입력하고 배포한다.
   - `NEXT_PUBLIC_API_BASE_URL=https://<render-api-host>/api/v1`
   - `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
7. 확정된 Vercel origin을 Render의 `CORS_ALLOWED_ORIGIN`에 반영해 API를 재배포한다.
8. Supabase Authentication URL Configuration의 Site URL을 Vercel origin으로 바꾸고, Redirect URLs에 `https://<vercel-host>/auth/callback`을 정확히 추가한다. 기존 로컬 callback은 개발용으로 유지한다.
9. `npm run deploy:smoke`를 실행한 뒤 실제 Google 로그인 → 과제 시작 → 저장 → AI 대화/평가 → 새로고침 복원을 브라우저에서 확인한다.

## 배포 환경변수 경계

웹 공개 값은 API base, Supabase URL, publishable key뿐이다. Gemini 키, DB 비밀번호, Google Client Secret, Supabase secret/service-role 키는 Vercel과 Git에 넣지 않는다. Render 로그에 토큰·전체 사용자 원문·키를 출력하지 않는다.

## 완료 기준

- GitHub CI 성공
- Render API와 PostgreSQL health 성공, Flyway 1~17 적용
- Vercel 웹 200, 정확한 API origin CORS 성공
- 비로그인 보호 경로 401, 로그인 사용자 bootstrap/소유권 성공
- 공개 가상 과제에서 실제 Gemini 대화 또는 평가 1회 성공
- 재배포와 새로고침 후 사용자 상태 복원

실패한 항목은 배포 완료로 표시하지 않는다. 외부 계정 설정과 실제 브라우저 검증 결과는 이 문서에 URL·커밋과 함께 추가한다.
