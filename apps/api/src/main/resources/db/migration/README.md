# 과제 조회·사용자 스키마

V1은 ERD의 tasks와 rubric_dimensions 두 테이블만 구성한다. 전체 22개 테이블,
학습 세션·비공개 정답·발행 검증·실제 과제 pack seed는 미구현이다.
JPA는 공개 조회에 필요한 컬럼만 매핑하고 criteria_json은 조회/직렬화하지 않는다.

기본 profile은 스키마만 생성하며 과제 목록은 비어 있다.
`SPRING_PROFILES_ACTIVE=local`에서만 `db/local/V2__local_browse_sample.sql`을 추가 적용한다.
별도 UUID/code의 가상 조회 예시 한 개와 공개 rubric 8개다. PUBLISHED는 로컬 목록 조회
검증을 위한 상태이며 전체 pack 발행 검수를 통과했다는 뜻이 아니다. criteria_json은
평가 기준이 아직 없어 빈 객체다. 학습 시작 API는 제공하지 않는다.

local profile은 개발용 DB에서만 사용한다. 로컬 V2 이력이 있는 DB를 production DB로
전환하지 않는다. 기본 profile 검증과 local 검증은 서로 별도 Testcontainers DB를 사용한다.
V3는 users와 UNIQUE(auth_provider, auth_subject)를 추가한다. 이메일은 병합 키가 아니다.
후속 공통 migration은 이미 사용한 V3와 충돌하지 않는 V4 이상을 사용한다.
적용된 migration은 수정하지 않는다.
