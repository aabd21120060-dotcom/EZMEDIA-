CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_key TEXT UNIQUE NOT NULL,

    title TEXT,
    subtitle TEXT,
    summary TEXT,
    body TEXT,

    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'researching',
                'verification',
                'ready',
                'published',
                'updated',
                'retracted',
                'archived'
            )
        ),

    content_type TEXT NOT NULL DEFAULT 'news',

    primary_category TEXT,
    secondary_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    topics JSONB NOT NULL DEFAULT '[]'::jsonb,

    country TEXT,
    region TEXT,
    city TEXT,
    district TEXT,
    place TEXT,

    language TEXT NOT NULL DEFAULT 'ar',

    importance_score NUMERIC(5,2) DEFAULT 0,
    confidence_score NUMERIC(5,2) DEFAULT 0,

    breaking_candidate BOOLEAN NOT NULL DEFAULT FALSE,

    first_discovered_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_by TEXT,
    updated_by TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_status
ON stories(status);

CREATE INDEX IF NOT EXISTS idx_stories_category
ON stories(primary_category);

CREATE INDEX IF NOT EXISTS idx_stories_city
ON stories(city);

CREATE INDEX IF NOT EXISTS idx_stories_updated
ON stories(updated_at DESC);

CREATE TABLE IF NOT EXISTS story_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    version_number INTEGER NOT NULL,

    title TEXT,
    summary TEXT,
    body TEXT,

    changes JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(story_id, version_number)
);

CREATE TABLE IF NOT EXISTS story_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    claim TEXT NOT NULL,

    claim_type TEXT DEFAULT 'statement',

    status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (
            status IN (
                'unverified',
                'supported',
                'partially_supported',
                'disputed',
                'rejected'
            )
        ),

    confidence NUMERIC(5,2) DEFAULT 0,

    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    source_type TEXT NOT NULL,

    source_name TEXT,

    url TEXT,

    external_id TEXT,

    published_at TIMESTAMPTZ,

    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    reliability_score NUMERIC(5,2) DEFAULT 0,

    source_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_story_sources_story
ON story_sources(story_id);

CREATE TABLE IF NOT EXISTS story_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    entity_type TEXT NOT NULL,

    entity_name TEXT NOT NULL,

    entity_id TEXT,

    confidence NUMERIC(5,2) DEFAULT 0,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_story_entities_story
ON story_entities(story_id);

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID
        REFERENCES stories(id)
        ON DELETE SET NULL,

    asset_type TEXT NOT NULL,

    original_filename TEXT,

    storage_provider TEXT,

    storage_key TEXT,

    mime_type TEXT,

    file_size BIGINT,

    duration_seconds NUMERIC,

    width INTEGER,
    height INTEGER,

    checksum TEXT,

    rights_status TEXT DEFAULT 'unknown',

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID
        REFERENCES stories(id)
        ON DELETE CASCADE,

    agent_name TEXT NOT NULL,

    task TEXT NOT NULL,

    model TEXT,

    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (
            status IN (
                'queued',
                'running',
                'completed',
                'failed',
                'cancelled'
            )
        ),

    input JSONB NOT NULL DEFAULT '{}'::jsonb,

    output JSONB NOT NULL DEFAULT '{}'::jsonb,

    confidence NUMERIC(5,2),

    tokens_input INTEGER,
    tokens_output INTEGER,

    duration_ms INTEGER,

    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_story
ON ai_runs(story_id);

CREATE TABLE IF NOT EXISTS workflow_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID
        REFERENCES stories(id)
        ON DELETE CASCADE,

    job_type TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (
            status IN (
                'queued',
                'running',
                'completed',
                'failed',
                'cancelled'
            )
        ),

    priority INTEGER NOT NULL DEFAULT 50,

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    attempts INTEGER NOT NULL DEFAULT 0,

    max_attempts INTEGER NOT NULL DEFAULT 3,

    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_queue
ON workflow_jobs(status, priority DESC, scheduled_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_type TEXT NOT NULL,

    actor_id TEXT,

    action TEXT NOT NULL,

    resource_type TEXT,

    resource_id TEXT,

    before_data JSONB,

    after_data JSONB,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_resource
ON audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_created
ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS external_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_key TEXT UNIQUE NOT NULL,

    name TEXT NOT NULL,

    source_type TEXT NOT NULL,

    base_url TEXT,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    polling_interval_seconds INTEGER DEFAULT 300,

    last_checked_at TIMESTAMPTZ,

    last_success_at TIMESTAMPTZ,

    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    interval_seconds INTEGER NOT NULL DEFAULT 300,

    next_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_check_at TIMESTAMPTZ,

    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    UNIQUE(story_id)
);

CREATE INDEX IF NOT EXISTS idx_story_monitoring_queue
ON story_monitoring(enabled, next_check_at);
