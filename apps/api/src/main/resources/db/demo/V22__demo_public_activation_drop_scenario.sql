-- Public synthetic product-analysis task. No private answer key or real user data.
INSERT INTO tasks(id,task_code,version_no,title,description_markdown,status,published_at)
VALUES ('73333333-3333-4333-8333-333333333333','activation-drop',1,
'가입 후 활성화 하락 원인을 제품 리드에게 보고하기',
'가상 훈련 과제입니다. 퍼널 CSV, 실험 JSON, VOC 표본과 이해관계자 요청을 비교해 오늘 할 조치와 다음 분석을 제안하세요.',
'PUBLISHED',now());

INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order)
VALUES
('75555555-5555-4555-8555-000000000001','73333333-3333-4333-8333-333333333333','activation-funnel-v1','가입·활성화 퍼널 CSV (가상)','METRIC','segment,signups,activation_7d,previous_4w
all,1200,62%,74%
mobile_web,480,49%,71%
ios,390,70%,75%
android,330,69%,76%
신규 가입 수는 이전 4주 평균과 5% 이내였으며 결측 세그먼트는 3.1%다.','8c7d5e01fe9f2e27f468d7a2f9fa35a99628d4e2520a19964232dda3232adb59','INITIAL',1),
('75555555-5555-4555-8555-000000000002','73333333-3333-4333-8333-333333333333','activation-experiment-v1','온보딩 실험 배정 JSON (가상)','DEPLOYMENT','{"experiment":"onboarding-copy-v3","allocation":"control 50% / variant 50%","activation_7d":{"control":"62.4%","variant":"61.8%"},"mobile_web":{"control":"49.2%","variant":"48.7%"}}
실험은 9월 14일 시작됐고 활성화 하락은 9월 12일부터 관찰됐다.
배정 로그의 8%는 클라이언트 이벤트 누락으로 실험군을 확인할 수 없다.','0501a15bde76c5e83ec79d3faab51fbff2e5b44711adaebe591807d4c406b328','INITIAL',2),
('75555555-5555-4555-8555-000000000003','73333333-3333-4333-8333-333333333333','activation-voc-v1','신규 사용자 VOC 표본 (가상)','CUSTOMER_NOTE','최근 7일 신규 사용자 문의 24건 중 11건이 인증 코드 입력 화면을 언급했고, 그중 7건은 모바일 웹 사용자가 작성했다.
같은 기간 전체 신규 사용자는 1,200명이며 문의자는 자발적으로 고객센터에 접수한 사람이다.
앱 리뷰 표본 18건에서는 인증 코드보다 가격과 알림 빈도 언급이 많았다.','084d3afd6c42b228a0601ba4d3b475f36de999343ead3ad578b90cdd998ee201','INITIAL',3),
('75555555-5555-4555-8555-000000000004','73333333-3333-4333-8333-333333333333','activation-request-v1','제품 리드 요청과 결정 시점 (가상)','CUSTOMER_NOTE','제품 리드는 오늘 16시 경영 회의 전에 원인과 즉시 조치를 한 페이지로 요청했다.
회의 자료에는 "온보딩 문구 실험이 활성화 하락의 원인"이라고 결론 내려 달라는 요청이 포함됐다.
실험 중단은 가능하지만 인증 코드 전달 로그와 브라우저별 오류율은 아직 수집 중이다.','2108ebf1b4621cbac153215d99e820a7a6e05fdf92089fad52f42a424596b936','INITIAL',4);
