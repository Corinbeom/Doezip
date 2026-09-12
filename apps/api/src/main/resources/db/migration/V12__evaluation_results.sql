CREATE TABLE dimension_evaluations (
 id uuid PRIMARY KEY,evaluation_run_id uuid NOT NULL,task_id uuid NOT NULL,rubric_dimension_id uuid NOT NULL,
 evidence_state varchar(30) NOT NULL CHECK(evidence_state IN ('SUFFICIENT','PARTIAL','NEEDS_REVIEW','NOT_OBSERVED')),
 rationale text NOT NULL,gap_text text,next_action text,confidence_level varchar(10) CHECK(confidence_level IN ('LOW','MEDIUM','HIGH')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(evaluation_run_id,rubric_dimension_id),
 FOREIGN KEY(evaluation_run_id,task_id) REFERENCES evaluation_runs(id,task_id),
 FOREIGN KEY(rubric_dimension_id,task_id) REFERENCES rubric_dimensions(id,task_id)
);
CREATE TABLE evaluation_evidence (
 id uuid PRIMARY KEY,dimension_evaluation_id uuid NOT NULL REFERENCES dimension_evaluations(id),
 fault_attempt_id uuid REFERENCES fault_attempts(id),document_version_id uuid REFERENCES document_versions(id),
 evidence_kind varchar(40) NOT NULL,polarity varchar(20) NOT NULL CHECK(polarity IN ('SUPPORT','CONTRADICT')),
 method varchar(20) NOT NULL CHECK(method IN ('RULE','LLM')),observed_excerpt text,explanation text NOT NULL,
 source_json jsonb,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(fault_attempt_id,document_version_id)=1)
);
CREATE TABLE feedback_reports (
 id uuid PRIMARY KEY,session_id uuid NOT NULL,evaluation_run_id uuid NOT NULL UNIQUE,
 summary text NOT NULL,strengths_json jsonb NOT NULL,improvements_json jsonb NOT NULL,fault_summary_json jsonb NOT NULL,
 next_practice_text text,schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),sample boolean NOT NULL DEFAULT false,
 public_report_json jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(evaluation_run_id,session_id) REFERENCES evaluation_runs(id,session_id)
);
CREATE FUNCTION reject_published_result_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published evaluation results are immutable' USING ERRCODE='23514'; END;$$;
CREATE TRIGGER dimension_result_immutable BEFORE UPDATE ON dimension_evaluations FOR EACH ROW EXECUTE FUNCTION reject_published_result_change();
CREATE TRIGGER evaluation_evidence_immutable BEFORE UPDATE ON evaluation_evidence FOR EACH ROW EXECUTE FUNCTION reject_published_result_change();
CREATE TRIGGER feedback_report_immutable BEFORE UPDATE ON feedback_reports FOR EACH ROW EXECUTE FUNCTION reject_published_result_change();
