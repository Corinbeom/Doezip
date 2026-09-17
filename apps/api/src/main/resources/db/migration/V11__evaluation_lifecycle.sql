CREATE TABLE evaluation_runs (
 id uuid PRIMARY KEY, session_id uuid NOT NULL, task_id uuid NOT NULL,
 document_version_id uuid NOT NULL, challenge_run_id uuid NOT NULL,
 phase varchar(20) NOT NULL CHECK(phase IN ('INITIAL','FINAL')),
 status varchar(20) NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
 idempotency_key uuid NOT NULL, input_snapshot_json jsonb NOT NULL,
 input_fingerprint char(64) NOT NULL CHECK(input_fingerprint ~ '^[0-9a-f]{64}$'),
 evaluator_version varchar(80) NOT NULL, llm_config_json jsonb NOT NULL,
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 4),
 next_attempt_at timestamptz NOT NULL DEFAULT now(), lease_token uuid, lease_expires_at timestamptz,
 error_code varchar(80), started_at timestamptz, finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_id,idempotency_key), UNIQUE(id,session_id), UNIQUE(id,task_id),
 FOREIGN KEY(session_id,task_id) REFERENCES learning_sessions(id,task_id),
 FOREIGN KEY(document_version_id,session_id) REFERENCES document_versions(id,session_id),
 FOREIGN KEY(challenge_run_id,session_id) REFERENCES challenge_runs(id,session_id),
 CHECK((status='RUNNING' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR
       (status<>'RUNNING' AND lease_token IS NULL AND lease_expires_at IS NULL))
);
CREATE UNIQUE INDEX evaluation_one_active ON evaluation_runs(session_id) WHERE status IN ('QUEUED','RUNNING');
CREATE INDEX evaluation_queue ON evaluation_runs(next_attempt_at,created_at) WHERE status='QUEUED';
CREATE FUNCTION reject_evaluation_input_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.session_id,NEW.task_id,NEW.document_version_id,NEW.challenge_run_id,NEW.phase,NEW.idempotency_key,NEW.input_snapshot_json,NEW.input_fingerprint,NEW.evaluator_version,NEW.llm_config_json,NEW.created_at)
 IS DISTINCT FROM ROW(OLD.session_id,OLD.task_id,OLD.document_version_id,OLD.challenge_run_id,OLD.phase,OLD.idempotency_key,OLD.input_snapshot_json,OLD.input_fingerprint,OLD.evaluator_version,OLD.llm_config_json,OLD.created_at) THEN
 RAISE EXCEPTION 'Evaluation input is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER evaluation_input_immutable BEFORE UPDATE ON evaluation_runs FOR EACH ROW EXECUTE FUNCTION reject_evaluation_input_change();
