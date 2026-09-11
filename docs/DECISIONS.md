> **F00 당시 범위 (2026-09-06, 과거 기록):** 해당 작업은 [개발 환경 구축](F00_ENVIRONMENT.md)만 수행한다. 기존 전체 MVP·ERD·seed·AI·배포 계획은 후속 작업이다. 현재 실행 명령은 [루트 README](../README.md)를 따른다.

# 결정 기록 — 원문 유지 / 구현 구체화 / 범위 조정

**상태:** 아래 결정은 사용자 최신 조건을 반영한 권고안이다. D1 회의에서 승인/수정한다.
원본 ERD·기획의 파일은 덮어쓰지 않았다.

| ID | 구분 | 결정 | 원문 또는 이전 상태 | 영향 / 검증 |
|---|---|---|---|---|
| ADR-01 | 사용자 확정 | 후보 ① Next.js + Spring Boot + PostgreSQL | 직전 후보 목록 | 별도 Python 서버 없음 |
| ADR-02 | 새 제안 | Java21, Boot3.5.16, AI1.1.8, Node24, Next16, PG17 | patch/version 미정 | 공식 문서상 호환, 실제 build/계정 smoke는 D1 |
| ADR-03 | 새 제안 | Supabase Auth + Google 단일 로그인, Spring JWT Resource Server | ERD D02: 외부 인증, 공급자 미정 | 비대칭 키, issuer/aud/JWK/alg 검사. 도메인 DB는 Spring만 접근 |
| ADR-04 | ERD 가정 구체화 | 별도 고정 검산 초안, notice 확인 후 시작 | 기획의 초안 소유 관계 모호 / ERD D03,D06 | 사용자 보고서·일반 chat에는 인위적 오류를 넣지 않음 |
| ADR-05 | 유지 | 22개 테이블·enum·동일 과제/세션 FK | ERD v1.0 | 7개 콘텐츠 테이블은 seed, 22개 CRUD 만들지 않음 |
| ADR-06 | 범위 조정 | 자동 claims 추출/추천 UI는 보류, 수동 challenge 근거 연결 필수 | 기획 must와 P1 중첩, ERD claims P1 | claims 스키마 유지. 자동 mapper를 구현했다고 주장하지 않음 |
| ADR-07 | 범위 조정 | 되묻기 2개+조건 변경1개를 이번 목표에 포함 | ERD에서 P1 | 학습 루프 유지. 실패 시 명시적인 축소 릴리스만 |
| ADR-08 | 구체화 | INITIAL snapshot 생성 즉시 seal | ERD는 주석→봉인 단계도 허용 | P0 주석 편집 없음. P1 도입 시 endpoint 분리 |
| ADR-09 | 구체화 | INITIAL은 검산 제출 후, FINAL은 조건 변경 답변 후 | ERD §6 순서 | 같은 검산 결과를 개선으로 중복 계산하지 않음 |
| ADR-10 | 새 제안 | task fixture 초기 자료5개 + 추가 자료1개 | 기획 자료4~6개 및 별도 추가정보 | 배포·고객 메모를 초기 운영 메모에 통합. 이후 배포 상세만 공개 |
| ADR-11 | 새 제안 | 가상 시간은 12:00~12:10, 장애12:04, 추가 배포12:01 | 기획 데모14시 / ERD 예시12시 혼재 | 서로 다른 원문 예시를 하나의 신규 seed로 통일. 실장애 자료 아님 |
| ADR-12 | 새 제안 | 8개 세부 루브릭으로 시작 | 기획은 영역별 여러 항목 | 4영역 의미는 유지. 없는 행동·미제공 기회는 구분 |
| ADR-13 | 새 제안 | 같은 API 프로세스의 bounded DB worker | ERD D07 작업 저장만 제안 | SKIP LOCKED+lease/heartbeat/조건부 발행. 별도 MQ 없음 |
| ADR-14 | 새 제안 | API 한 인스턴스, 세션당 active stream1개 부분 UNIQUE | ERD에는 메시지 동시 생성 제한 없음 | SQL 인덱스만 추가. 다중 인스턴스 메시지 복구는 후속 설계 |
| ADR-15 | 새 제안 | JSON camelCase / enum 유지 / action API | API 명세 없음 | OpenAPI와 DB 이름 매핑. Entity 직렬화 금지 |
| ADR-16 | 사용자 확정 | 피처별 풀스택 작성자 A/B + 상호 리뷰 | ERD §10.1은 프론트/백엔드 역할 분리 제안 | 이전 역할 표 대신 FEATURE_BACKLOG 적용 |
| ADR-17 | 일정 제안 | D5 실제 INITIAL 흐름, D10 동결, 나머지 검증 | 기획에 실제 2주 스프린트 없음 | 시간 추정은 실측 아님, 일일 가능시간 확인 |
| ADR-18 | 유지/구체화 | 사용자 보고서와 평가입력은 불변 버전 | ERD §5~6 | 새 문서와 다른 공개 자료를 평가 도중 섞지 않음 |
| ADR-19 | 새 제안 | 후속 질문 timeout 시 검수 템플릿 표시 | 기획은 맞춤질문만 언급 | generation_version 보존, 개인화라고 허위 표시하지 않음 |
| ADR-20 | 유지 | RULE과 LLM 평가 근거를 구분 | ERD evaluation_evidence.method | 자유서술을 문자열 일치만으로 확정하지 않음 |
| ADR-21 | 새 제안 | POST /me/bootstrap으로 외부 인증 계정 최초 연결 | 초기 API 제안은 GET /me만 표기 | GET은 사용자 행·학습 상태를 변경하지 않음 |

| ADR-22 | 새 제안 | 평가 자동 3회 + 일시 오류의 명시 재시도 1회, run 총4회 상한 | ERD는 한도 숫자 미정 | attempt_count 누적, 4회째 실패 시 retryable=false. 계정 비용 상한 별도 |

## 아직 팀/계정에서 결정해야 하는 것

| 항목 | 이번 문서의 기본안 | 반드시 확인할 시점 |
|---|---|---|
| 실제 작업 시간 | 개발일10 × 2인 × 6h | D1 |
| auth 프로젝트·OAuth redirect | Supabase Google, SPA client session | D1 |
| 실제 배포 계정과 비용 상한 | Vercel+상시 API+PG | D1 |
| 정확한 의존성 lockfile | 위 조합 smoke 후 고정 | D1 |
| 모델 API 접근/계정 quota | Gemini2.5Flash 초기 | D1 |
| 콘텐츠/판정 검수자 | 두 명 서로 검수 | D2 |
| 사용자 기록 보존 기간·삭제 요청 처리 | 원문 미정, 임의 법적 기간 추정 안 함 | 외부 테스트 전 |
| 오탐·애매한 수정 예시 | fixture로 판정 규칙 합의 | D4 |

## 결정 기록 변경법

원본 파일을 조용히 수정하지 않는다. 이 표에 변경 이유/영향을 추가하고
개발명세·API·fixture·DB migration·테스트를 같은 PR 또는 연결 PR로 갱신한다.

## F00 실행 환경 추가 결정

- ADR-23 (사용자 확정): main ← develop ← feature/* 및 이번 F00 범위는 루트 AGENTS.md와 F00_ENVIRONMENT.md를 따른다. 전체 ERD·seed·AI·디자인 이식은 후속 작업이다.
- ADR-24 (형식 수정): 표준 OpenAPI 3.0 validator가 BootstrapRequest의 required: []를 거부하여 빈 선언을 제거했다. displayName은 기존처럼 선택 입력이며 제품 API 의미는 바꾸지 않는다. 빈 bootstrap 요청 fixture와 공개 fixture schema 검증으로 확인한다.

## 1인 개발 전환 (2026-09-10)

- ADR-25 (사용자 확정): 1인 개발로 전환한다. ADR-16의 A/B 분담과 상호 승인 필수 규칙은 현재 적용하지 않는다. 기능별 풀스택 소유는 유지하며 작성자의 diff 검토·실제 동작 확인과 CI 통과를 병합 기준으로 삼는다. GitHub 설정 자체는 이번 문서 변경으로 적용되지 않는다.
- 실행 순서는 FEATURE_BACKLOG.md의 현재 실행 순서를 따른다. 기존 2인·2주 추정은 참고 기록이며 새 일정의 약속이 아니다. 과제 조회부터 작은 단위로 구현하며 전체 MVP 범위를 완료한 것으로 표시하지 않는다.

- ADR-26 (F02a 구현): 기존 공개 GET tasks 계약으로 과제 조회를 구현한다. ERD의 tasks·rubric_dimensions만 우선 적용하고, 별도 local 프로필의 조회용 가상 데이터는 실제 학습용 과제 발행과 구분한다. 원본 과제 패키지의 정답·자료 검수와 나머지 migration은 후속 작업이다.

- ADR-27 (사용자 확정, 2026-09-10): 학습 플랫폼 시안 v0.1을 제품 디자인 기준으로 승인한다. 과제 조회 화면부터 실제 API에 연결해 이식하며, 미구현 흐름의 가상 데이터·모의 AI는 제품에 포함하지 않는다. 후속 개선은 승인 기준에서 필요한 부분을 점진적으로 수정한다.

- ADR-28 (F01 구현, 2026-09-10): Supabase Google 인증을 브라우저 PKCE로 연결하고 Spring은 고정 issuer/audience 및 ES256·RS256 JWKS 서명을 검증한다. 사용자 매핑은 provider+sub이며 이메일로 합치지 않는다. 세션은 SDK의 브라우저 저장소에 저장하므로 XSS 방어가 필요하며 HttpOnly BFF 구조가 아니다. 로그아웃은 로컬 세션을 제거하고 기존 access JWT의 서버 수명은 만료까지 남는다. 설정 미완료 시 인증은 비활성화하고 실제 Google 성공 검증으로 표시하지 않는다. 자세한 설정과 검증 경계는 AUTH_SETUP.md와 F01_AUTH_VALIDATION.md를 따른다.

- ADR-29 (F02b, 2026-09-11): 보고서 draft는 기존 계약의 1초 debounce·직렬 저장·expectedLockVersion CAS를 따른다. ACTIVE/WRITING 및 버전 검사는 소유자 세션의 행 잠금 안에서 처리한다. 충돌에서 자동 덮어쓰기하지 않는다. 수행 세션과 공개 자료만 추가하며 제출본·평가 기능은 별도 구현한다.
