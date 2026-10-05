CREATE TABLE IF NOT EXISTS system_metadata (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_metadata (
    key,
    value
)
VALUES (
    'platform',
    'EZ MEDIA'
)
ON CONFLICT (key)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
