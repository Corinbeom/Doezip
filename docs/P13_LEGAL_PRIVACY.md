# P13 운영 정책·개인정보·AI 안내

## 구현 범위

- 공개 경로 `/terms`, `/privacy`, `/ai-policy`와 공통 푸터 링크
- 로그인 후 이용약관 동의, 개인정보 처리방침 확인, AI 이용 안내 확인
- `users`의 정책 버전 세 개와 확인 시각 저장, 기존 사용자 미동의 유지
- `PUT /api/v1/me/legal-acceptance` 계약·인증·CORS·입력 검증
- Gemini API 유·무료 데이터 처리 조건에 따른 공개 안내
- 내 학습의 명시적 회원 탈퇴와 `DELETE /api/v1/me`
- Supabase 인증 사용자와 사용자 소유 학습 데이터의 연쇄 삭제
- 삭제 직후 기존 JWT의 계정 재생성을 막는 24시간 단방향 식별자 차단

정책 버전은 현재 `2026-09-21`이다. 웹과 API는 같은 버전을 사용해야 하며 정책 본문을 바꾸면 두 버전 상수, OpenAPI, 테스트를 함께 갱신한다. 동의 기록은 `legalAcceptedAt`이 공개 응답에 직접 노출되지 않고 현재 버전의 확인 여부만 `legalAccepted`로 반환한다.

## 데이터 흐름

- Supabase와 Google OAuth: 로그인, 사용자 식별, 브라우저 인증 세션
- Vercel: 웹 제공과 접속·오류 로그
- Render Singapore: Spring API와 PostgreSQL, 계정·학습 기록
- Google Gemini API: 사용자가 요청한 AI 대화와 평가에 필요한 과제·결과물·검증 기록

탈퇴는 먼저 사용자 행을 삭제 처리 중으로 잠그고, DB 트랜잭션 밖에서 Supabase Admin API를 호출한다.
외부 인증 삭제가 실패하면 잠금을 해제하고 로컬 데이터는 유지해 재시도할 수 있게 한다. 성공하거나 이미
삭제된 인증 사용자라면 한 트랜잭션에서 단방향 차단값을 기록하고 users를 삭제한다. FK cascade는 사용자
소유의 세션·문서·대화·검산·코드·학습 흐름·평가·피드백을 지우며 공유 과제·자료·평가기준은 보존한다.

인증 토큰, 로그인 이메일과 비공개 정답은 Gemini 요청에 포함하지 않는다. 사용자가 과제에 직접 작성한 개인정보·기밀은 별도 자동 탐지·삭제 기능이 없으므로 화면에서 입력 금지를 안내한다.

## 운영 전 필수 확인

- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`을 실제 수신 가능한 개인정보 문의 주소로 설정
- Supabase 프로젝트 region은 대시보드에서 `ap-northeast-2`(대한민국 서울)로 확인해 개인정보 처리방침에 반영
- Gemini API가 paid 또는 unpaid인지 확인하고 `NEXT_PUBLIC_GEMINI_DATA_TIER`와 일치시킴
- Gemini API 조건에 맞춰 만 18세 이상, 업무·전문 역량 학습 목적의 참여자만 받는 운영 기준을 유지
- unpaid라면 입력·출력이 Google 제품 및 머신러닝 개선이나 사람 검토에 사용될 수 있음을 데모 참여자에게 그대로 고지하거나, 공개 입력을 받기 전에 paid 전환 검토
- 배포 URL에서 새 사용자와 기존 사용자의 정책 확인, 로그아웃, 원래 경로 복귀를 실제 Google 계정으로 확인
- Render API에 `SUPABASE_AUTH_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 설정하고 테스트 계정 탈퇴를 확인
- 개인정보 열람·정정·처리정지 요청의 수동 처리 절차와 응답 담당자를 정함

Google의 현재 Gemini API 데이터 처리 조건은 [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms)를 기준으로 확인한다. 공급자, 리전 또는 데이터 처리 조건이 바뀌면 배포 전 문구를 다시 검토한다.

## 검증 경계

자동 검사는 JWT 인증, 동의 입력, DB 저장, 현재 버전 판정, CORS, 공개 정책 페이지, 탈퇴 확인 UI,
Supabase Admin API 경계, 사용자 소유 데이터 cascade, 기존 JWT의 재연결 차단을 확인한다. 실제 Google OAuth
동의 화면, 실제 Supabase 사용자 삭제, 공급자 대시보드의 리전·결제 상태, 문의 메일 수신은 계정 소유자가
별도로 확인해야 한다. 이 문서는 법률 자문 완료를 의미하지 않는다.
