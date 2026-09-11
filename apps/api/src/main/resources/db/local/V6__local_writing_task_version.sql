-- A new version keeps the previous demo description/material immutable for existing sessions.
-- Synthetic development content only; this is not a reviewed training package.
UPDATE tasks SET status='ARCHIVED',updated_at=now() WHERE id='61111111-1111-4111-8111-111111111111';
INSERT INTO tasks (id,task_code,version_no,title,description_markdown,status,published_at)
VALUES ('61111111-1111-4111-8111-111111111112','browse-demo',2,'개발용 예시: 결제 API 장애 원인 분석',
'개발용 가상 과제입니다. 공개 자료를 읽고 원인 가설·근거·미확인 사항·대응 방안을 보고서 초안으로 작성하세요. 작성 내용은 자동 저장되며, 제출·AI 분석·평가는 아직 제공하지 않습니다.','PUBLISHED',now());
INSERT INTO rubric_dimensions (id,task_id,code,area,title,public_description,criteria_json,sort_order)
SELECT replace(id::text,'62222222','64444444')::uuid,'61111111-1111-4111-8111-111111111112'::uuid,
code,area,title,public_description,criteria_json,sort_order FROM rubric_dimensions WHERE task_id='61111111-1111-4111-8111-111111111111';
INSERT INTO materials (id,task_id,material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order)
SELECT '63333333-3333-4333-8333-000000000002'::uuid,'61111111-1111-4111-8111-111111111112'::uuid,
material_code,title,material_type,content_markdown,content_hash,release_stage,sort_order
FROM materials WHERE id='63333333-3333-4333-8333-000000000001';
