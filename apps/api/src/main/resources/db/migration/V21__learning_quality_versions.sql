ALTER TABLE coding_workspaces
  DROP CONSTRAINT coding_workspaces_task_version_check;

ALTER TABLE coding_workspaces
  ADD CONSTRAINT coding_workspaces_task_version_check
  CHECK(task_version IN ('duplicate-items-v1','duplicate-items-v2','retry-policy-v1'));

ALTER TABLE learning_flows
  ALTER COLUMN prompt_version SET DEFAULT 'learning-feedback-v2';
