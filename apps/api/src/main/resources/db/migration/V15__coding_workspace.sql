-- F08a is independent of the pending F03a V14 migration; integrate in version order.
CREATE TABLE coding_workspaces (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 task_version varchar(40) NOT NULL CHECK(task_version='duplicate-items-v1'),
 code text NOT NULL CHECK(length(code)<=20000), version bigint NOT NULL DEFAULT 0 CHECK(version>=0),
 submitted_at timestamptz, explanation text, last_run jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coding_owner ON coding_workspaces(user_id,created_at DESC);
CREATE TABLE coding_turns (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES coding_workspaces(id) ON DELETE CASCADE,
 request_key uuid NOT NULL, base_version bigint NOT NULL, base_code text NOT NULL,
 instruction text NOT NULL CHECK(length(instruction) BETWEEN 1 AND 4000),
 status varchar(16) NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','FAILED')),
 explanation text, proposed_code text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,request_key)
);
CREATE UNIQUE INDEX coding_one_running ON coding_turns(workspace_id) WHERE status='RUNNING';
