ALTER TABLE users
    ADD COLUMN deletion_requested_at timestamptz;

CREATE TABLE account_deletion_blocks (
    subject_hash char(64) PRIMARY KEY CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_deletion_blocks_expiry_idx ON account_deletion_blocks(expires_at);

ALTER TABLE learning_sessions DROP CONSTRAINT learning_sessions_user_id_fkey;
ALTER TABLE learning_sessions ADD CONSTRAINT learning_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE document_versions DROP CONSTRAINT document_versions_session_id_fkey;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE;

ALTER TABLE challenge_runs DROP CONSTRAINT challenge_runs_session_id_task_id_fkey;
ALTER TABLE challenge_runs ADD CONSTRAINT challenge_runs_session_id_task_id_fkey
    FOREIGN KEY (session_id, task_id) REFERENCES learning_sessions(id, task_id) ON DELETE CASCADE;

ALTER TABLE fault_attempts DROP CONSTRAINT fault_attempts_challenge_run_id_challenge_template_id_fkey;
ALTER TABLE fault_attempts ADD CONSTRAINT fault_attempts_challenge_run_id_challenge_template_id_fkey
    FOREIGN KEY (challenge_run_id, challenge_template_id)
    REFERENCES challenge_runs(id, challenge_template_id) ON DELETE CASCADE;

ALTER TABLE evidence_links DROP CONSTRAINT evidence_links_fault_attempt_id_fkey;
ALTER TABLE evidence_links ADD CONSTRAINT evidence_links_fault_attempt_id_fkey
    FOREIGN KEY (fault_attempt_id) REFERENCES fault_attempts(id) ON DELETE CASCADE;

ALTER TABLE evaluation_runs DROP CONSTRAINT evaluation_runs_session_id_task_id_fkey;
ALTER TABLE evaluation_runs ADD CONSTRAINT evaluation_runs_session_id_task_id_fkey
    FOREIGN KEY (session_id, task_id) REFERENCES learning_sessions(id, task_id) ON DELETE CASCADE;
ALTER TABLE evaluation_runs DROP CONSTRAINT evaluation_runs_document_version_id_session_id_fkey;
ALTER TABLE evaluation_runs ADD CONSTRAINT evaluation_runs_document_version_id_session_id_fkey
    FOREIGN KEY (document_version_id, session_id) REFERENCES document_versions(id, session_id) ON DELETE CASCADE;
ALTER TABLE evaluation_runs DROP CONSTRAINT evaluation_runs_challenge_run_id_session_id_fkey;
ALTER TABLE evaluation_runs ADD CONSTRAINT evaluation_runs_challenge_run_id_session_id_fkey
    FOREIGN KEY (challenge_run_id, session_id) REFERENCES challenge_runs(id, session_id) ON DELETE CASCADE;

ALTER TABLE dimension_evaluations DROP CONSTRAINT dimension_evaluations_evaluation_run_id_task_id_fkey;
ALTER TABLE dimension_evaluations ADD CONSTRAINT dimension_evaluations_evaluation_run_id_task_id_fkey
    FOREIGN KEY (evaluation_run_id, task_id) REFERENCES evaluation_runs(id, task_id) ON DELETE CASCADE;

ALTER TABLE evaluation_evidence DROP CONSTRAINT evaluation_evidence_dimension_evaluation_id_fkey;
ALTER TABLE evaluation_evidence ADD CONSTRAINT evaluation_evidence_dimension_evaluation_id_fkey
    FOREIGN KEY (dimension_evaluation_id) REFERENCES dimension_evaluations(id) ON DELETE CASCADE;
ALTER TABLE evaluation_evidence DROP CONSTRAINT evaluation_evidence_fault_attempt_id_fkey;
ALTER TABLE evaluation_evidence ADD CONSTRAINT evaluation_evidence_fault_attempt_id_fkey
    FOREIGN KEY (fault_attempt_id) REFERENCES fault_attempts(id) ON DELETE CASCADE;
ALTER TABLE evaluation_evidence DROP CONSTRAINT evaluation_evidence_document_version_id_fkey;
ALTER TABLE evaluation_evidence ADD CONSTRAINT evaluation_evidence_document_version_id_fkey
    FOREIGN KEY (document_version_id) REFERENCES document_versions(id) ON DELETE CASCADE;

ALTER TABLE feedback_reports DROP CONSTRAINT feedback_reports_evaluation_run_id_session_id_fkey;
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_evaluation_run_id_session_id_fkey
    FOREIGN KEY (evaluation_run_id, session_id) REFERENCES evaluation_runs(id, session_id) ON DELETE CASCADE;

ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_session_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE;
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_reply_to_message_id_session_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_reply_to_message_id_session_id_fkey
    FOREIGN KEY (reply_to_message_id, session_id) REFERENCES chat_messages(id, session_id) ON DELETE CASCADE;

ALTER TABLE learning_flows DROP CONSTRAINT learning_flows_user_id_fkey;
ALTER TABLE learning_flows ADD CONSTRAINT learning_flows_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE learning_flows DROP CONSTRAINT learning_flows_session_id_fkey;
ALTER TABLE learning_flows ADD CONSTRAINT learning_flows_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE;
ALTER TABLE learning_flows DROP CONSTRAINT learning_flows_coding_id_fkey;
ALTER TABLE learning_flows ADD CONSTRAINT learning_flows_coding_id_fkey
    FOREIGN KEY (coding_id) REFERENCES coding_workspaces(id) ON DELETE CASCADE;
ALTER TABLE learning_flows DROP CONSTRAINT learning_flows_parent_id_fkey;
ALTER TABLE learning_flows ADD CONSTRAINT learning_flows_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES learning_flows(id) ON DELETE CASCADE;

ALTER TABLE learning_flow_events DROP CONSTRAINT learning_flow_events_flow_id_fkey;
ALTER TABLE learning_flow_events ADD CONSTRAINT learning_flow_events_flow_id_fkey
    FOREIGN KEY (flow_id) REFERENCES learning_flows(id) ON DELETE CASCADE;
