CREATE TABLE challenge_templates (
    id uuid PRIMARY KEY,
    task_id uuid NOT NULL REFERENCES tasks(id),
    variant_code varchar(80) NOT NULL,
    title varchar(200) NOT NULL,
    instructions_markdown text NOT NULL,
    content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (task_id, variant_code), UNIQUE (id, task_id)
);
CREATE TABLE challenge_statements (
    id uuid PRIMARY KEY,
    challenge_template_id uuid NOT NULL REFERENCES challenge_templates(id),
    statement_key varchar(50) NOT NULL,
    sort_order integer NOT NULL CHECK (sort_order > 0),
    content_text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (challenge_template_id, statement_key),
    UNIQUE (challenge_template_id, sort_order), UNIQUE (id, challenge_template_id)
);
CREATE TABLE challenge_runs (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL UNIQUE,
    task_id uuid NOT NULL,
    challenge_template_id uuid NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    notice_version varchar(40) NOT NULL,
    notice_acknowledged_at timestamptz NOT NULL,
    submitted_at timestamptz,
    lock_version bigint NOT NULL DEFAULT 0 CHECK (lock_version >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (session_id, task_id) REFERENCES learning_sessions(id, task_id),
    FOREIGN KEY (challenge_template_id, task_id) REFERENCES challenge_templates(id, task_id),
    UNIQUE (id, session_id), UNIQUE (id, challenge_template_id)
);
CREATE FUNCTION reject_challenge_content_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Challenge content is immutable; create a new version' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER challenge_template_immutable BEFORE UPDATE ON challenge_templates
    FOR EACH ROW EXECUTE FUNCTION reject_challenge_content_update();
CREATE TRIGGER challenge_statement_immutable BEFORE UPDATE ON challenge_statements
    FOR EACH ROW EXECUTE FUNCTION reject_challenge_content_update();
