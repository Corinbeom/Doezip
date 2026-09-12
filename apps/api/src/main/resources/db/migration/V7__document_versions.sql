CREATE TABLE document_versions (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES learning_sessions(id),
    version_no integer NOT NULL CHECK (version_no > 0),
    checkpoint varchar(30) NOT NULL CHECK (checkpoint IN ('INITIAL', 'REVISION', 'FINAL')),
    content_markdown text NOT NULL,
    content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    source_draft_lock_version bigint NOT NULL CHECK (source_draft_lock_version >= 0),
    sealed_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, version_no),
    UNIQUE (id, session_id)
);
CREATE UNIQUE INDEX uq_document_initial ON document_versions(session_id) WHERE checkpoint = 'INITIAL';

-- P0 snapshots are sealed at creation. Do not silently rewrite submitted evidence.
CREATE FUNCTION reject_document_version_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Submitted document versions are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER document_version_immutable BEFORE UPDATE ON document_versions
    FOR EACH ROW EXECUTE FUNCTION reject_document_version_update();
