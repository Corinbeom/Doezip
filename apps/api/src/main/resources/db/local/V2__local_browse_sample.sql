-- Synthetic browse-only example, not publication of the private task pack.
-- No materials, answers, evaluation criteria or learning sessions are seeded.
INSERT INTO tasks (id, task_code, title, description_markdown, status, published_at)
VALUES ('61111111-1111-4111-8111-111111111111', 'browse-demo', '개발용 예시: 결제 API 장애 원인 분석',
'개발용 가상 과제입니다. 원인 가설·근거·미확인 사항·대응 방안을 정리하는 과제의 설명과 공개 평가 기준을 확인합니다. 현재는 조회만 가능하며 자료 열람·보고서 작성·AI 분석·평가는 제공하지 않습니다.',
'PUBLISHED', '2026-09-10T00:00:00Z');
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000001', '61111111-1111-4111-8111-111111111111', 'prompt.context', 'PROMPT', '목표·맥락 전달', '목표·자료 범위·제약을 충분히 전달했는지 확인한다.', '{}', 1);
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000002', '61111111-1111-4111-8111-111111111111', 'prompt.iteration', 'PROMPT', '질문 보완', '관찰한 문제를 반영해 요청을 보완했는지 확인한다.', '{}', 2);
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000003', '61111111-1111-4111-8111-111111111111', 'evidence.source_check', 'EVIDENCE', '원본 대조', '수치와 주장을 원본 자료로 확인했는지 본다.', '{}', 3);
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000004', '61111111-1111-4111-8111-111111111111', 'evidence.calibration', 'EVIDENCE', '신뢰 수준 판단', '정상·오류·미확인 내용을 구분했는지 본다.', '{}', 4);
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000005', '61111111-1111-4111-8111-111111111111', 'document.grounding', 'DOCUMENT', '문서의 근거', '핵심 주장과 자료의 연결을 확인한다.', '{}', 5);
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000006', '61111111-1111-4111-8111-111111111111', 'document.uncertainty', 'DOCUMENT', '불확실성 표현', '사실·추론·미확인 정보를 구분했는지 본다.', '{}', 6);
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000007', '61111111-1111-4111-8111-111111111111', 'defense.explanation', 'DEFENSE', '판단 이유 설명', '결론의 근거와 한계를 설명했는지 본다.', '{}', 7);
INSERT INTO rubric_dimensions (id, task_id, code, area, title, public_description, criteria_json, sort_order) VALUES ('62222222-2222-4222-8222-000000000008', '61111111-1111-4111-8111-111111111111', 'defense.revision', 'DEFENSE', '새 정보 반영', '추가 정보에 맞게 문서를 일관되게 바꿨는지 본다.', '{}', 8);
