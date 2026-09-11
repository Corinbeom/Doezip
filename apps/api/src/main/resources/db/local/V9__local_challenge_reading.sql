-- Local-only synthetic reading exercise. No private answer keys or production task pack.
UPDATE tasks SET status='ARCHIVED',updated_at=now() WHERE id='61111111-1111-4111-8111-111111111112';
INSERT INTO tasks(id,task_code,version_no,title,description_markdown,status,published_at)
SELECT '61111111-1111-4111-8111-111111111113',task_code,3,title,
 '개발 기능 확인용 가상 과제입니다. 자료를 읽고 자신의 판단을 정리해 보세요. 실제 학습 콘텐츠의 검수 완료를 뜻하지 않습니다.',
 'PUBLISHED',now() FROM tasks WHERE id='61111111-1111-4111-8111-111111111112';
INSERT INTO rubric_dimensions(id,task_id,code,area,title,public_description,criteria_json,sort_order)
SELECT replace(id::text,'64444444','65555555')::uuid,'61111111-1111-4111-8111-111111111113',code,area,title,public_description,criteria_json,sort_order
FROM rubric_dimensions WHERE task_id='61111111-1111-4111-8111-111111111112';
INSERT INTO materials(id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order)
SELECT '63333333-3333-4333-8333-000000000003','61111111-1111-4111-8111-111111111113',material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order
FROM materials WHERE id='63333333-3333-4333-8333-000000000002';
INSERT INTO challenge_templates(id,task_id,variant_code,title,instructions_markdown,content_hash) VALUES ('66666666-6666-4666-8666-000000000001','61111111-1111-4111-8111-111111111113','local-reading-v1','개발용 검토 초안','개발용 가상 검토 초안입니다. 아래 문장은 사실과 다를 수 있습니다. 원자료와 대조해 근거를 확인해 보세요. 사용자 보고서를 바꾼 내용이 아닙니다.','81c054c557ac191a81a545743636895c6542d79604fc1078adccb7f95c7a48d0');
INSERT INTO challenge_statements(id,challenge_template_id,statement_key,sort_order,content_text) VALUES ('67777777-7777-4777-8777-000000000001','66666666-6666-4666-8666-000000000001','S01',1,'10:00에 결제 API 응답 지연 알림이 발생했다.');
INSERT INTO challenge_statements(id,challenge_template_id,statement_key,sort_order,content_text) VALUES ('67777777-7777-4777-8777-000000000002','66666666-6666-4666-8666-000000000001','S02',2,'10:05에는 장애 원인이 확정되었다.');
INSERT INTO challenge_statements(id,challenge_template_id,statement_key,sort_order,content_text) VALUES ('67777777-7777-4777-8777-000000000003','66666666-6666-4666-8666-000000000001','S03',3,'제공된 로그만으로 모든 서비스의 상태를 확정하기는 어렵다.');
