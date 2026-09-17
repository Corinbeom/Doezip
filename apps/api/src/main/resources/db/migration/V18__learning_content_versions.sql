-- Keep existing v1 workspaces and flows readable while new learning flows use v2.
ALTER TABLE coding_workspaces
 DROP CONSTRAINT coding_workspaces_task_version_check;
ALTER TABLE coding_workspaces
 ADD CONSTRAINT coding_workspaces_task_version_check
 CHECK(task_version IN ('duplicate-items-v1','duplicate-items-v2'));

ALTER TABLE learning_flows
 ALTER COLUMN flow_version SET DEFAULT 'learning-flow-v2';
