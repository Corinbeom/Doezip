CREATE TABLE fault_attempts (
 id uuid PRIMARY KEY, challenge_run_id uuid NOT NULL, challenge_template_id uuid NOT NULL,
 statement_id uuid NOT NULL, decision varchar(30) NOT NULL CHECK (decision IN ('KEEP','CORRECT','INSUFFICIENT_EVIDENCE')),
 reason_text text NOT NULL CHECK (length(btrim(reason_text))>0), replacement_text text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(challenge_run_id,statement_id),
 FOREIGN KEY(challenge_run_id,challenge_template_id) REFERENCES challenge_runs(id,challenge_template_id),
 FOREIGN KEY(statement_id,challenge_template_id) REFERENCES challenge_statements(id,challenge_template_id),
 CHECK ((decision='KEEP' AND replacement_text IS NULL) OR (decision<>'KEEP' AND length(btrim(replacement_text))>0 AND replacement_text IS NOT NULL))
);
-- Only manual challenge citations are supported. Claim citations are a later migration.
CREATE TABLE evidence_links (
 id uuid PRIMARY KEY, fault_attempt_id uuid NOT NULL REFERENCES fault_attempts(id),
 material_id uuid NOT NULL REFERENCES materials(id), line_start integer NOT NULL CHECK(line_start>0),
 line_end integer NOT NULL CHECK(line_end>=line_start), quoted_text text NOT NULL,
 relation varchar(20) NOT NULL CHECK(relation IN ('SUPPORTS','CONTRADICTS','CONTEXT')),
 origin varchar(20) NOT NULL CHECK(origin='USER'), review_status varchar(20) NOT NULL CHECK(review_status='ACCEPTED'),
 user_note text, reviewed_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(fault_attempt_id,material_id,line_start,line_end)
);
