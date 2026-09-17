CREATE TABLE chat_messages (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES learning_sessions(id),
 seq_no bigint NOT NULL CHECK (seq_no > 0), role varchar(20) NOT NULL CHECK(role IN ('USER','ASSISTANT')),
 content_text text NOT NULL, status varchar(20) NOT NULL CHECK(status IN ('STREAMING','COMPLETED','FAILED','CANCELLED')),
 reply_to_message_id uuid, client_message_key uuid NOT NULL,
 include_current_draft boolean NOT NULL DEFAULT false,
 provider varchar(50), model varchar(120), usage_json jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(session_id,seq_no), UNIQUE(session_id,client_message_key), UNIQUE(id,session_id),
 FOREIGN KEY(reply_to_message_id,session_id) REFERENCES chat_messages(id,session_id),
 CHECK ((role='USER' AND status='COMPLETED' AND reply_to_message_id IS NULL) OR (role='ASSISTANT' AND reply_to_message_id IS NOT NULL)),
 CHECK ((status='STREAMING') = (completed_at IS NULL))
);
CREATE UNIQUE INDEX one_chat_stream_per_session ON chat_messages(session_id) WHERE status='STREAMING';
CREATE INDEX chat_daily_usage ON chat_messages(created_at) WHERE role='USER';
