CREATE TABLE users (
    id uuid PRIMARY KEY,
    auth_provider varchar(50) NOT NULL,
    auth_subject varchar(255) NOT NULL,
    display_name varchar(80) NOT NULL,
    email varchar(320),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_auth_identity_unique UNIQUE (auth_provider, auth_subject)
);
