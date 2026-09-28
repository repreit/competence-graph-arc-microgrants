CREATE TABLE IF NOT EXISTS accounts (
    id bigint generated always as identity PRIMARY KEY,
    address text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deltas (
    id bigint generated always as identity PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    seq bigint NOT NULL,
    prev_hash text,
    content text NOT NULL,
    signature text NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_id, seq)
);

CREATE TABLE IF NOT EXISTS sessions (
    id bigint generated always as identity PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_account_id_idx ON sessions (account_id);

CREATE TABLE IF NOT EXISTS bindings (
    id bigint generated always as identity PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    public_key text NOT NULL,
    bind_seq bigint NOT NULL,
    unbind_seq bigint,
    -- Intentional: never allow key re-bind
    UNIQUE (account_id, public_key)
);

CREATE INDEX IF NOT EXISTS bindings_account_id_idx ON bindings (account_id);

CREATE INDEX IF NOT EXISTS bindings_account_id_active_idx
    ON bindings (account_id)
    WHERE unbind_seq IS NULL;

CREATE TABLE IF NOT EXISTS nonces (
    nonce text PRIMARY KEY,
    expires_at timestamptz NOT NULL
);
