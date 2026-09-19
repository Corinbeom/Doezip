ALTER TABLE users
    ADD COLUMN terms_version varchar(20),
    ADD COLUMN privacy_version varchar(20),
    ADD COLUMN ai_notice_version varchar(20),
    ADD COLUMN legal_accepted_at timestamptz;

ALTER TABLE users ADD CONSTRAINT users_legal_acceptance_complete CHECK (
    (terms_version IS NULL AND privacy_version IS NULL AND ai_notice_version IS NULL AND legal_accepted_at IS NULL)
    OR
    (terms_version IS NOT NULL AND privacy_version IS NOT NULL AND ai_notice_version IS NOT NULL AND legal_accepted_at IS NOT NULL)
);
