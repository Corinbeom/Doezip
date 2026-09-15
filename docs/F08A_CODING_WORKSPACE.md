# F08a 서비스 내 구현 연습

사용자가 승인한 방향은 외부 저장소 제출 대신 서비스 안에서 AI와 코드를 수정하고 검증하는 경험이다.
첫 실행 범위는 JavaScript 단일 파일 `solution.js`의 `addItem(items, item)` 버그 수정이다.
범용 IDE, 자율 에이전트, 여러 파일/언어, npm 설치, DOM 미리보기, 배포까지 구현한 것으로 표시하지 않는다.

## 사용자 흐름

`/coding` → 과제 설명 → 새 구현 과제 시작 → 시작 코드 테스트 → AI에게 실패 원인 질문 →
변경 전/제안 코드 확인 → 수정안 적용 또는 직접 편집 → 저장하고 테스트 → 구현·검증 설명 → 최종 코드 제출.
작업 URL(`/coding/{id}`)과 목록에서 다시 열 수 있으며 코드, AI 요청/응답, 마지막 공개 테스트 결과를 PostgreSQL에 저장한다.
저장 전 편집 버퍼와 제출 전 설명 버퍼는 React 상태다. 새로고침 시 미저장 입력은 복원되지 않는다.
AI 변경 되돌리기는 현재 화면의 1단계 전환이며 영구 Git 이력 기능이 아니다.

## 작업/브랜치 경계

- `feature/F08a-coding-workspace`는 `origin/develop` c49abce에서 분기했다.
- 미커밋 F03a·F05d·F06a·F06b와 원본 F00 변경을 복사/병합하지 않는다.
- 코딩용 Gemini adapter는 별도 요청·응답 구조를 사용하며 F03a의 학습 보고서 채팅 API를 대체하지 않는다.
- V15 migration은 coding_workspaces/coding_turns만 추가한다. 전체 ERD 완료가 아니다.
- 공유 DB에는 통합된 V14(F03a) → V15 순서로 적용해야 한다. F08a 독립 테스트 DB에 나중에 V14를 끼워 넣기 위해 migration을 수정하거나 Flyway out-of-order를 임의 활성화하지 않는다.

## 실행 경계와 한계

코드는 QuickJS 0.32.0 WASM 안에서 실행한다. 루트 개발 실행기와 `predev`/`prebuild`가 고정된 npm 패키지의 바이너리를 public/coding-runtime에 복사하며 이 생성 폴더는 Git에 넣지 않는다. JS 압축 과정의 바이너리 문자열 변형을 피하기 위해 WASM을 별도 정적 파일로 로드한다. Node.js/브라우저의 eval 또는 Function으로 사용자 코드를 실행하지 않는다.
별도 Web Worker를 만들고 실행 완료·오류·취소·8초 경과 시 terminate한다. 케이스마다 새 QuickJS runtime/context를 사용한다.
케이스별 interrupt deadline 300ms, 설정 메모리 한도 8MiB, 스택 256KiB다. 이 설정은 운영용 적대적 워크로드 자원 격리 인증을 의미하지 않는다.
DOM, fetch, process, localStorage, 파일/모듈 loader, host 함수는 제공하지 않는다. 비공개 정답과 채점 자료도 전달하지 않는다.
네 개의 공개 연습 테스트가 반환 배열과 입력 보존을 확인한다. 유효한 id/title 문자열 입력만 첫 과제 범위다.

**테스트 결과는 브라우저가 보고한 공개 연습 기록이다. 서버가 독립 검증한 채점 결과가 아니다.**
클라이언트나 공개 테스트를 조작하는 경우까지 막는 채점 경계가 아니므로 이를 역량 점수로 사용하지 않는다.
실패한 테스트가 있는 상태에서도 학습 결과를 제출할 수 있다. 단, 현재 저장 버전으로 테스트한 기록은 필요하다.
구현 과제 AI 역량 평가/비공개 서버 채점은 후속이다. 제출 후 화면은 저장 확인과 보고된 테스트 통과 수만 표시한다.

## API와 상태

계약은 contracts/openapi.yaml의 Coding* 스키마와 /coding-workspaces 경로다.
모든 API는 검증된 로그인과 소유권이 필요하고 개인 응답은 no-store다. 다른 사용자는 404, 인증 없음은 401.
- GET/POST /coding-workspaces: 내 작업 목록/새 작업. 사용자당 최대 50개.
- GET/PUT /coding-workspaces/{id}: 조회/코드 저장. expectedVersion CAS. 저장 시 이전 실행 기록 무효화.
- POST /turns: 코드·최근 완료 대화 4개·마지막 공개 테스트 결과로 AI 수정안 요청. 전체 context 256KiB 상한.
- POST /runs: 현재 코드 버전에 연결한 브라우저 연습 결과 저장.
- POST /submit: 현재 버전과 설명으로 제출. 같은 입력은 동일 제출 결과, 제출 후 코드/실행/AI 수정 차단.

요청마다 UUID requestKey를 쓰며 동일 key/입력 재시도는 기록을 재사용한다. 다른 입력의 key 재사용은 409.
DB의 workspace 행 잠금과 RUNNING 부분 unique로 한 작업에서 동시 AI 생성을 막는다.
외부 호출 전 예약 트랜잭션을 끝내고, 외부 호출 후 조건부 terminal 갱신한다. 90초가 지난 RUNNING은 다음 조회/변경에서 실패로 전환한다.
UTC 사용자 20회/전체 100회/작업당 20회 제한을 DB 잠금 안에서 예약한다. 실패 요청도 예산에 포함된다.
실패·중단은 성공 코드로 대체하지 않는다. UI가 연결을 끊어도 서버 호출은 timeout까지 이어질 수 있고 재진입 시 결과를 확인한다.
AI 수정안은 자동으로 원본을 덮어쓰지 않는다. 생성 기준 버전이 다르거나 미저장 편집이 있으면 적용을 막는다.

## 실행과 설정

루트에서 `npm install`, `.env.example`을 참고해 로컬 `.env` 구성, `npm run db:up`, `npm run dev`.
`/coding`으로 접속한다. 직접 편집/실행/저장/제출은 AI 키 없이 가능하다.
AI 수정안은 기존 GEMINI_API_KEY와 `AI_CODING_ENABLED=true`, `AI_CODING_MODEL=gemini-3.5-flash-lite`로 활성화한다.
키는 API에만 전달한다. Next에는 공개 인증/서비스 주소만 전달한다.
로컬 웹 포트를 바꾸면 CORS_ALLOWED_ORIGIN과 Supabase의 허용 callback 주소도 맞춰야 한다.
일반 검증/CI는 AI_CODING_ENABLED=false 및 빈 키로 실행한다.

## 검증

- `npm run check`: OpenAPI/fixture/생성 타입, web lint/typecheck/unit/build, API test/build, PostgreSQL Testcontainers, 전체 E2E.
- `npm run test:coding:ai`: 명시적으로 Gemini 1회 호출해 수정안 형식과 실제 공개 테스트 통과 확인. 유효 키 필요, 기본 CI에서 제외.
- runner unit: 시작 코드 실패, 수정 코드 통과, 무한 루프/구문 오류, host globals 접근 불가.
- UI unit: 적용/되돌리기, 미저장 편집 보호, 실패 시 버퍼 보존, 제출 잠금.
- API: JWT/소유권/CAS/테스트 버전/제출 불변성, AI 결과 저장·중복 요청·예산·stale 복구.
- E2E: 실제 브라우저 WASM 실행, PG 저장/복원/제출, AI 미설정 실패, 무한 루프 복구, 모바일 폭.

### 실제 검증 결과 (2026-09-15)

- `npm run check` 통과: 계약/fixture 23개·타입 재생성 일치, web lint/typecheck/build 및 unit 85개, API test/build 및 테스트 74개, PostgreSQL Testcontainers, 브라우저 E2E 39개.
- API는 앞선 실행에서 74개 성공했으며 최종 전체 검사에서는 코드 변경이 없어 Gradle의 UP-TO-DATE 결과를 재사용했다.
- `npm run test:coding:ai`로 실제 Gemini를 1회 호출했다. 반환 수정안은 공개 테스트 4/4를 통과했다. 이후 최종 runner에서도 저장된 동일 수정안으로 4/4를 재확인했으며 추가 AI 호출은 없었다.
- 브라우저 검증 중 발견한 WASM 번들 문자열 변형은 별도 정적 WASM 로드로 수정했다. Next 경로 안내 요소와 충돌하던 오류 선택자도 수정한 뒤 전체 E2E를 통과했다.
- 모바일 375px 캡처와 가로 넘침 검사를 확인했다. 실제 Google 로그인부터 AI 요청·제출까지의 수동 브라우저 흐름 및 원격 GitHub Actions는 이번 검증에서 수행하지 않았다.
- 로컬 확인 주소는 `http://localhost:3189/coding`, API는 8369, 별도 DB는 55599다. 기존 3129 통합 실행과 기존 작업 DB는 보존한다.
- 위 결과는 기능 구현 시점의 검증이다. 이후 사용자가 기본 흐름 진행을 확인했다. 세부 품질 검수와 고도화 완료를 의미하지 않는다.

## 정리 및 다음 작업

이번 공유 단위는 F08a 코드·계약·fixture·테스트·실행 설정·관련 문서다. 다른 기능의 미커밋 변경은 포함하지 않는다.
공통 영향은 구현 연습 메뉴, QuickJS 의존성과 WASM 준비, 인증 경로 허용 목록, Coding API 계약, V15 migration, AI_CODING 설정이다.

1. F03a 학습 채팅과 평가 품질/리포트 변경을 각각 검증·커밋하고 통합 순서를 결정한다.
2. 공유 DB는 V14 → V15 순서를 확인한 후 통합한다. 현재 F08a 테스트 DB와 기존 학습 DB는 별도로 유지한다.
3. 보고서/구현 과제의 진입과 제출 흐름을 통합한다.
4. 구현 과제의 독립 서버 검증 및 AI 활용 역량 평가를 연결한다.
5. 이후 편집기, 과제 구성, 여러 파일 지원을 고도화한다.

브랜치별 잔여 작업은 [작업 정리 기록](WORK_STATUS_2026-09-15.md)을 따른다.

### 공유 전 재검증 (2026-09-15)

- 루트 `npm run dev`/`dev:web`가 npm predev를 거치지 않아 WASM 준비를 누락하던 문제를 수정했다.
- 빈 public 폴더의 격리 실행에서 루트 dev:web가 WASM을 생성하고 HTTP로 제공하는 것을 확인했다. 첫 임시 실행은 의존성 symlink가 Turbopack root 밖에 있어 실패했으며, 검사 환경의 root를 맞춰 재검증했다.
- 수정 후 `npm run check` 전체 통과: web 85개, E2E 39개, 계약/fixture/생성 타입·lint/typecheck/build 성공. API test/build는 74개 성공 기록을 UP-TO-DATE로 재사용했다.
- 실제 AI 호출 검사는 앞선 1회 결과를 유지하며 이번 정리에서는 추가 호출하지 않았다.
- staged diff/check, 문서 링크, 실제 로컬 비밀값과 키 패턴 및 생성물 제외를 확인했다. `.env.example`의 기존 로컬 전용 예시 비밀번호는 비밀값 검사에서 예시로 구분했다.
- 사용자 확인은 기본 흐름 진행이며 세부 UX·평가 품질 승인으로 확대하지 않는다. GitHub CI 결과는 push 후 해당 커밋의 Actions에서 별도로 확인한다.
