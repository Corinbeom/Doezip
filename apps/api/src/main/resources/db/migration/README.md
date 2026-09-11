# 현재 구현한 스키마

- V1: tasks, rubric_dimensions. 공개 과제 조회에 필요한 컬럼만 JPA에 매핑하며 criteria_json은 응답에 넣지 않는다.
- V3: users. UNIQUE(auth_provider, auth_subject)로 인증 계정을 구분한다. 이메일은 병합 키가 아니다.
- V4: learning_sessions, materials. 세션의 소유권·작성 초안·잠금 버전과 과제 자료의 공개 단계를 저장한다. 같은 사용자·과제의 재시도는 별도 세션이다.

기본 profile은 스키마만 생성한다. local profile만 db/local의 V2(가상 과제 1개·공개 rubric 8개), V5(가상 INITIAL 자료 1개)를 적용한다.
가상 예시는 저장·복원 검증용이며 실제 과제 pack·비공개 정답·평가 seed가 아니다. 로컬 예시의 PUBLISHED 상태가 실제 pack 발행 검수 완료를 뜻하지 않는다.

local profile은 개발 DB에서만 사용하고 local migration 이력이 있는 DB를 production으로 전환하지 않는다.
전체 22개 테이블, 평가 스냅샷·채팅·이벤트·평가·보고서 스키마와 실제 과제 pack seed는 미구현이다.
후속 migration은 V8 이상을 사용하며 이미 적용한 migration을 수정하지 않는다.

V6(local)은 개발용 과제의 옛 조회 전용 안내를 고치는 대신 새 v2를 추가한다. v1은 ARCHIVED로 보존하며 기존 세션의 본문·자료는 그대로다. 현재 로컬 seed는 두 버전 중 v2만 신규 시작할 수 있다.

V7은 document_versions 1개 테이블을 추가한다. INITIAL은 세션당 한 번 생성하며 본문·해시·저장 버전과 봉인 시각을 보관한다. UPDATE는 DB 트리거로 거부한다. P0에서는 생성과 동시에 봉인하므로 sealed_at은 NOT NULL이다. 기존 V1~V6는 수정하지 않는다.
