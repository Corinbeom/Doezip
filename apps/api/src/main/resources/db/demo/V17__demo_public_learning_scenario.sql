-- Public synthetic demo scenario v1. No private answer key or real incident data.
INSERT INTO tasks(id,task_code,version_no,title,description_markdown,status,published_at)
VALUES ('71111111-1111-4111-8111-111111111111','payment-observation',1,'결제 지연 상황을 동료에게 설명하기','가상 훈련 과제입니다. 시간대별 사실, 원인 가설과 미확인 사항, 다음 확인 방법을 근거와 함께 보고하세요.','PUBLISHED',now());

INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order)
VALUES ('73333333-3333-4333-8333-000000000001','71111111-1111-4111-8111-111111111111','payment-observations-v1','결제 지연 관측 기록 (가상)','LOG','10:00 결제 API p95 응답 시간 2.4초, 평소 0.3초. 요청량은 평소 범위.
10:02 결제 API 오류율 0.2%, 평소 0.2%. 지연으로 인한 고객 문의 3건 접수.
10:05 API 서버 CPU 42%, 메모리 58%. 관측값만으로 원인을 확정하지 못함.
10:07 데이터베이스 연결 대기 지표와 외부 결제사 응답 시간은 아직 수집하지 못함.
10:10 재측정한 결제 API p95 응답 시간 1.8초. 지연은 계속됨.
이 자료는 가상 훈련 자료이며 다른 API 상태와 실제 장애 원인은 포함하지 않음.','6280f11ffeb711dbf01c8e9fc94773ba61ce139ceeea31dc3a30f5e2e6396aef','INITIAL',1);
