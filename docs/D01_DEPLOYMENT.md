# D01 공개 데모 배포

## 목표와 경계

오늘 배포는 기능 검증용 공개 데모다. Vercel 웹, Render의 단일 Spring API와 PostgreSQL, 기존 Supabase Google 인증, Gemini API를 연결한다. 전체 MVP·운영 안정성·실제 학습 콘텐츠 검수 완료를 뜻하지 않는다.

- 공개 웹: <https://doezip.vercel.app>
- 공개 API health: <https://doezip-api.onrender.com/actuator/health>
- 배포 브랜치: `feature/D01-demo-deployment`
- 배포 앱 커밋: `397f249d905f56f568b521ccf4aa83b89b7d4153`

무료 Render API는 유휴 15분 뒤 중지될 수 있고 첫 요청 복구에 시간이 걸린다. 무료 PostgreSQL은 생성 후 30일에 만료되고 백업을 제공하지 않는다. 장기 시연 전에 유료 인스턴스와 백업 정책으로 전환한다.

## 코드 구성

- `apps/api/Dockerfile`: Java 21 다단계 API 이미지
- `render.yaml`: Singapore API 1개와 신규 생성용 PostgreSQL 17 한 개, DB health check, 비밀값 입력 자리
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

## 2026-09-16 실제 배포 기록

- Vercel production과 Render API가 위 URL에서 응답한다.
- Supabase Site URL은 공개 웹으로 지정했고, 공개 callback을 추가했다. 기존 `localhost:3129`, `localhost:3189` callback은 보존했다.
- Render demo 프로필에서 Flyway 13개 migration이 스키마 버전 17까지 적용됐고, 공개 가상 과제 1개만 적재됐다.
- 비로그인 상태에서 웹 200, DB health 200, 공개 과제 200, 보호 경로 401, Vercel origin CORS 200을 실제 운영 URL로 확인했다. 브라우저에서도 공개 가상 과제 카드가 표시됐다.
- Render 최초 생성 DB는 PostgreSQL 18.6이다. 현재 migration은 적용됐지만 Flyway가 공식 확인한 최신 major는 17이라 경고를 남긴다. `render.yaml`은 이후 새 DB를 17로 만들도록 고쳤으며, 현재 DB 교체는 데이터 삭제 작업이므로 이번 배포에서 실행하지 않았다.
- 무료 인스턴스의 첫 요청 지연과 무료 DB의 30일 만료 조건이 있다. 장기 공개 전에 DB 17 재생성 또는 지원 Flyway 버전 검토, 백업·유료 전환 결정을 한다.
- Google OAuth는 공개 callback을 포함한 계정 선택 화면까지 자동 확인했다. 사용자는 공개 도메인에서 로그인한 뒤 보고서 작성 과제와 구현 과제의 정상 흐름을 각각 끝까지 수행해 실제 인증·저장·AI 연동·결과 화면을 확인했다.
