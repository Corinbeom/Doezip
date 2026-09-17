-- Public synthetic content v0.2. Existing v1 task and sessions remain unchanged.
INSERT INTO tasks(id,task_code,version_no,title,description_markdown,status,published_at)
VALUES ('72222222-2222-4222-8222-222222222222','payment-observation',2,
'결제 지연 대응안을 운영 리드에게 제안하기',
'가상 훈련 과제입니다. 서로 다른 관측 자료와 이해관계자의 요청을 대조해 사실, 가설, 미확인 사항, 즉시 대응과 다음 확인 순서를 보고하세요.',
'PUBLISHED',now());

INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order)
VALUES
('74444444-4444-4444-8444-000000000001','72222222-2222-4222-8222-222222222222','payment-metrics-v2','결제 API 관측 지표 (가상)','METRIC','10:00 결제 API p95 응답 시간은 2.4초(평소 0.3초), 요청량은 평소의 98%였다.
10:02 오류율은 0.2%(평소 0.2%)였고 5xx 증가는 관찰되지 않았다.
10:10 p95는 1.8초로 낮아졌지만 지연은 계속됐다.
데이터베이스 연결 대기, 외부 결제사 응답 시간, 지역별 차이는 아직 수집하지 못했다.','01d6cf9a04c8095117a6cd736ade81ec8be20e5fb963bc2e10ba1e62c08af7c1','INITIAL',1),
('74444444-4444-4444-8444-000000000002','72222222-2222-4222-8222-222222222222','release-timeline-v2','배포와 롤백 기록 (가상)','DEPLOYMENT','09:42 checkout-web 2026.09.17.1 배포가 완료됐다. 변경 내용은 결제 대기 화면의 안내 문구이며 결제 API 설정 변경은 없었다.
10:06 배포 연관성을 확인하기 위해 롤백을 시작했고 10:09 완료했다.
10:12 결제 API p95는 1.7초였다. 롤백 직후 정상 범위로 돌아오지는 않았다.
배포 시점과 지연 발생 시점은 가깝지만 두 사건을 직접 연결한 추적 자료는 없다.','d87a44345175c428f3e4605dd7cc386296abb568ba25e115967262588839dbb7','INITIAL',2),
('74444444-4444-4444-8444-000000000003','72222222-2222-4222-8222-222222222222','partner-support-v2','외부 상태와 고객 문의 (가상)','CUSTOMER_NOTE','10:04 외부 결제사 상태 페이지는 전체 시스템 정상으로 표시됐고 광범위 장애 공지는 없었다.
고객 지원에는 iOS와 한 통신사를 사용한다는 지연 문의 3건이 들어왔다. 전체 사용자를 대표하는 표본인지는 알 수 없다.
10:08 사업 담당자는 외부 결제사 장애로 공지해 달라고 요청했다.
지역·통신사별 요청과 외부 결제사 원시 응답 시간은 아직 확인하지 못했다.','7c5e672d5d8a5e209643cbd14f1f5a2a0723e95a138dd689d702b45fbedc8639','INITIAL',3);
