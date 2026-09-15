# I02 보고서·구현 과제 통합

기준 `origin/develop` c49abce. F03a 6df1c15와 F08a 46f9a05의 검증된 변경을 별도 `feature/I02-unified-workspace`에 가져와 통합한다. 공유 develop/main 직접 변경이나 PR/merge는 하지 않는다.

## 한 실행 환경

- 같은 Next.js 웹, Spring Boot API, PostgreSQL, Supabase 로그인으로 `/tasks`와 `/coding`에 접근한다.
- 문제 탐색의 구현 과제 링크 및 공통 메뉴로 이동한다. 보고서 작성 화면에는 AI 대화가 함께 있다.
- 보고서: 공개 자료 확인 → AI 대화 → 직접 보고서 작성 → 최초 제출 → 기존 검산/평가 흐름.
- 구현: 코드 편집 → AI 수정안 확인/적용 → 공개 테스트 → 코드와 설명 제출.
- 저장된 보고서는 기존 `/sessions/{id}` 주소에서, 구현 과제는 내 작업 목록에서 다시 연다. 미저장 편집 버퍼를 페이지 이동까지 보존하는 기능은 아니다.
- 로그인 복귀 경로에 `/coding`과 UUID 작업 경로를 추가하고 외부 URL·쿼리·경로 우회는 계속 거부한다.

## DB 및 공통 변경

V14 학습 대화 → V15 구현 작업 순서로 적용한다. 각 migration은 원본을 유지한다. 두 기능의 인증/CORS 경로, AI 비활성 검사 설정, fixture 목록, Gradle 실제 AI 검사 태그를 모두 유지한다.

새 환경은 `.env.example`을 로컬 `.env`로 복사하고 `npm install` → `npm run db:up` → `npm run dev`로 실행한다. 기본 웹은 3000/API 8080이다. AI_CHAT_ENABLED와 AI_CODING_ENABLED는 각각 opt-in이며 키는 서버 전용이다. 공통 Supabase 설정은 AUTH_SETUP.md를 따른다.

현재 작업용 통합 화면은 `http://localhost:3189/tasks`, API 8389, DB 포트 55609다. 기존 3189 로그인 callback을 재사용한다. 이번 자동 검사는 별도 포트와 `doezip` DB를 사용했고, 사용자가 확인하는 서버는 `doezip_preview` DB를 사용한다. 로컬 재검증 시 미리보기 DB를 대상으로 실행하지 않도록 아래 명령을 사용한다.

```bash
WEB_PORT=3199 API_PORT=8399 E2E_AUTH_PORT=9069 \
DATABASE_URL=jdbc:postgresql://localhost:55609/doezip \
CORS_ALLOWED_ORIGIN=http://localhost:3199 \
NEXT_PUBLIC_API_BASE_URL=http://localhost:8399/api/v1 npm run check
```

기존 F03a/F08a DB를 삭제하지 않는다. 통합 미리보기 DB에는 F03a 스냅샷을 복원한 후 V15를 적용하고 F08a 구현 기록을 복사한다. 동일 사용자는 이메일 대신 auth_provider/auth_subject로 대응시킨다. 원본 구현 UUID·요청·제출 기록을 유지하며 사용자 FK만 통합 사용자 ID로 대응시킨다. 기존 DB를 대상으로 migration을 되돌리거나 out-of-order를 켜지 않는다.

## 검증과 한계

`npm run check`: 계약/fixture/생성 타입, 웹 검사/빌드, 실제 PostgreSQL Testcontainers, 백엔드 검사/빌드, 전체 E2E.
`tests/e2e/unified-workspace.spec.ts`: 한 로그인으로 보고서 대화 화면 → 코드 실행 → 문제 탐색 → 양쪽 작업 재진입/새로고침 시 저장 유지.
기존 채팅·구현 테스트의 취소/소유권/실패/제출 잠금 검사를 함께 유지한다.

실제 Gemini 어댑터는 기존 기능 커밋을 사용한다. 통합 검사에서 기본 AI는 비활성화하며 실제 연결의 선행 검증과 혼동하지 않는다. 대화의 평가 입력 반영, 구현 과제 역량 평가, F05d 평가 품질·F06a/b 결과 화면 변경은 이번 통합에 포함하지 않는다.

## 실제 검증 결과 (2026-09-15)

- `npm run check` 통과: 계약/fixture 28개와 타입 재생성 일치, 웹 lint/typecheck/build와 unit 95개, 백엔드 test/build 84개(실패/skip 0), E2E 42개.
- 로그인 복귀 경로 수정 전 중간 검사는 중단했으며 최종 변경 기준으로 전체를 다시 실행했다.
- 한 로그인으로 보고서 대화 화면과 코드 실행 화면 사이를 이동하고 양쪽 저장 내용을 복원하는 통합 E2E가 통과했다. 실제 Google 인증 공급자 화면을 새로 거치는 검사는 아니다.
- F03a 스냅샷의 18개 테이블(이력 테이블 포함)을 새 DB에 복원한 뒤 모든 행 수와 내용 digest가 일치함을 확인했다. 복원 시점 학습 세션 87개, 대화 메시지 6개다. 여기에는 기존 개발 테스트 기록도 포함한다.
- V15를 정상 적용한 뒤 F08a 코드 작업 11개, 요청 기록 1개를 복사했다. 모든 내용·UUID·버전·제출 상태가 같고 소유자 auth_provider/auth_subject가 일치함을 대조했다. 기존 DB는 그대로 남았다.
- 실제 브라우저에서 3189의 동일 로그인 상태로 구현 작업 목록과 기존 보고서·대화 복원을 확인했다. 새 Gemini 요청/평가를 추가 실행하지 않았다. AI 채팅·코드 제안은 활성화했고, 기존 I01과 같이 보고서 AI 평가도 활성화했다. 복사 당시 대기 평가 작업은 없었다.
- API 8389 health UP, 기존 3129 통합 서버 유지. 현재 3189는 I02 한 서버로 실행한다. 코드·대화·제출이 다른 DB에 따로 저장되지 않는다.
- 변경 파일·브라우저 번들의 실제 비밀값 미포함, diff check 통과. 로컬 DB 복사 파일/스크립트와 .env는 저장소에 포함하지 않는다.
- 통합 구현 때에는 별도 브랜치에 미커밋 변경을 보존했다. 후속 공유 작업에서는 최종 변경·테스트·문서를 함께 커밋하며 원격 CI 결과는 해당 커밋의 Actions에서 확인한다. PR·develop/main 병합은 포함하지 않는다.


## 다음 작업
통합본 공유와 평가 품질 검증의 순서·완료 조건은 [다음 작업 준비](NEXT_WORK.md)를 따른다.
