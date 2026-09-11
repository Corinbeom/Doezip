CREATE TABLE learning_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), task_id uuid NOT NULL REFERENCES tasks(id),
 mode varchar(20) NOT NULL DEFAULT 'PRACTICE' CHECK (mode = 'PRACTICE'),
 status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','ABANDONED')),
 current_step varchar(30) NOT NULL DEFAULT 'WRITING' CHECK (current_step IN ('WRITING','CHALLENGE','FEEDBACK','FOLLOW_UP','CONDITION_CHANGE','FINAL_REVIEW','DONE')),
 draft_markdown text NOT NULL DEFAULT '', draft_lock_version bigint NOT NULL DEFAULT 0 CHECK (draft_lock_version >= 0),
 next_message_seq bigint NOT NULL DEFAULT 1 CHECK (next_message_seq > 0), next_event_seq bigint NOT NULL DEFAULT 1 CHECK (next_event_seq > 0),
 condition_released_at timestamptz, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, task_id)
);
CREATE INDEX learning_sessions_user_id_idx ON learning_sessions(user_id);
CREATE TABLE materials (
 id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES tasks(id), material_code varchar(80) NOT NULL,
 title varchar(200) NOT NULL, material_type varchar(30) NOT NULL CHECK (material_type IN ('ARCHITECTURE','LOG','METRIC','DEPLOYMENT','EXTERNAL_SERVICE','CUSTOMER_NOTE')),
 content_markdown text NOT NULL, content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
 release_stage varchar(30) NOT NULL DEFAULT 'INITIAL' CHECK (release_stage IN ('INITIAL','CONDITION_CHANGE')),
 sort_order integer NOT NULL DEFAULT 1 CHECK (sort_order > 0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(task_id, material_code)
);
