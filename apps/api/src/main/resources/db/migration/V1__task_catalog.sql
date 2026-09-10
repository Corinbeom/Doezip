CREATE TABLE tasks (
    id uuid PRIMARY KEY,
    task_code varchar(80) NOT NULL,
    version_no integer NOT NULL DEFAULT 1 CHECK (version_no > 0),
    title varchar(200) NOT NULL,
    description_markdown text NOT NULL,
    job_family varchar(30) NOT NULL DEFAULT 'DEVELOPMENT',
    status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (task_code, version_no)
);
CREATE INDEX tasks_publication_idx ON tasks (status, published_at DESC, id);
CREATE TABLE rubric_dimensions (
    id uuid PRIMARY KEY,
    task_id uuid NOT NULL REFERENCES tasks(id),
    code varchar(80) NOT NULL,
    area varchar(20) NOT NULL CHECK (area IN ('PROMPT', 'EVIDENCE', 'DOCUMENT', 'DEFENSE')),
    title varchar(160) NOT NULL,
    public_description text NOT NULL,
    criteria_json jsonb NOT NULL,
    sort_order integer NOT NULL DEFAULT 1 CHECK (sort_order > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (task_id, code),
    UNIQUE (id, task_id)
);
