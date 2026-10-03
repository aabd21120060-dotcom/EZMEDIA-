CREATE TABLE IF NOT EXISTS ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

    provider VARCHAR(100) NOT NULL,

    model VARCHAR(150),

    job_type VARCHAR(100) NOT NULL,

    status VARCHAR(40) NOT NULL DEFAULT 'queued',

    input JSONB NOT NULL DEFAULT '{}'::jsonb,

    output JSONB NOT NULL DEFAULT '{}'::jsonb,

    error TEXT,

    created_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_content
ON ai_jobs(content_id);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status
ON ai_jobs(status);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_created
ON ai_jobs(created_at DESC);
