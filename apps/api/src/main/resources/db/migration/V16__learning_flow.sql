-- Versioned companion workflow; legacy sessions and submissions remain unchanged.
CREATE TABLE learning_flows (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), request_key uuid NOT NULL,
 task_kind varchar(12) NOT NULL CHECK(task_kind IN ('REPORT','CODING')),
 mode varchar(12) NOT NULL CHECK(mode IN ('TRAINING','SIMULATION')),
 flow_version varchar(40) NOT NULL DEFAULT 'learning-flow-v1',
 session_id uuid UNIQUE REFERENCES learning_sessions(id), coding_id uuid UNIQUE REFERENCES coding_workspaces(id),
 parent_id uuid UNIQUE REFERENCES learning_flows(id),
 stage varchar(16) NOT NULL DEFAULT 'WORKING' CHECK(stage IN ('WORKING','EXPLAIN','FEEDBACK')),
 version bigint NOT NULL DEFAULT 0,
 notes jsonb NOT NULL DEFAULT '{"explanation":"","verification":"","citations":[]}',
 hints jsonb NOT NULL DEFAULT '[]', snapshot jsonb, answers jsonb, feedback jsonb,
 feedback_status varchar(16) NOT NULL DEFAULT 'READY' CHECK(feedback_status IN ('READY','RUNNING','FAILED','SUCCEEDED')),
 feedback_token uuid, feedback_started_at timestamptz, feedback_attempts int NOT NULL DEFAULT 0,
 model varchar(100), prompt_version varchar(60) NOT NULL DEFAULT 'learning-feedback-v1',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_key),
 CHECK((task_kind='REPORT' AND session_id IS NOT NULL AND coding_id IS NULL) OR (task_kind='CODING' AND coding_id IS NOT NULL AND session_id IS NULL)),
 CHECK((stage='WORKING' AND snapshot IS NULL AND answers IS NULL) OR (stage='EXPLAIN' AND snapshot IS NOT NULL AND answers IS NULL) OR (stage='FEEDBACK' AND snapshot IS NOT NULL AND answers IS NOT NULL))
);
CREATE INDEX learning_flow_owner ON learning_flows(user_id,created_at DESC);
CREATE TABLE learning_flow_events (
 id uuid PRIMARY KEY, flow_id uuid NOT NULL REFERENCES learning_flows(id), kind varchar(20) NOT NULL,
 body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX learning_flow_event_order ON learning_flow_events(flow_id,created_at,id);
CREATE FUNCTION preserve_learning_flow_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.snapshot IS NOT NULL AND NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN RAISE EXCEPTION 'sealed flow snapshot'; END IF;
 IF OLD.answers IS NOT NULL AND NEW.answers IS DISTINCT FROM OLD.answers THEN RAISE EXCEPTION 'sealed flow answers'; END IF;
 IF OLD.feedback IS NOT NULL AND NEW.feedback IS DISTINCT FROM OLD.feedback THEN RAISE EXCEPTION 'sealed flow feedback'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER learning_flow_seal BEFORE UPDATE ON learning_flows FOR EACH ROW EXECUTE FUNCTION preserve_learning_flow_submission();
