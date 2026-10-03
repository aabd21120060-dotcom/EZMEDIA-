CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ez_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_key TEXT UNIQUE NOT NULL,

    title TEXT,
    subtitle TEXT,
    summary TEXT,
    body TEXT,

    content_type TEXT NOT NULL DEFAULT 'news',

    language TEXT NOT NULL DEFAULT 'ar',

    status TEXT NOT NULL DEFAULT 'draft',

    primary_category TEXT,

    secondary_categories JSONB NOT NULL DEFAULT '[]'::jsonb,

    topics JSONB NOT NULL DEFAULT '[]'::jsonb,

    country TEXT,
    region TEXT,
    city TEXT,
    district TEXT,
    place TEXT,

    entities JSONB NOT NULL DEFAULT '[]'::jsonb,

    sources JSONB NOT NULL DEFAULT '[]'::jsonb,

    rights JSONB NOT NULL DEFAULT '{}'::jsonb,

    ai JSONB NOT NULL DEFAULT '{}'::jsonb,

    confidence_score NUMERIC(5,2) DEFAULT 0,

    importance_score NUMERIC(5,2) DEFAULT 0,

    breaking_candidate BOOLEAN NOT NULL DEFAULT false,

    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ez_stories_status
ON ez_stories(status);

CREATE INDEX IF NOT EXISTS idx_ez_stories_content_type
ON ez_stories(content_type);

CREATE INDEX IF NOT EXISTS idx_ez_stories_country
ON ez_stories(country);

CREATE INDEX IF NOT EXISTS idx_ez_stories_city
ON ez_stories(city);

CREATE INDEX IF NOT EXISTS idx_ez_stories_created_at
ON ez_stories(created_at DESC);


CREATE TABLE IF NOT EXISTS ez_story_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES ez_stories(id)
        ON DELETE CASCADE,

    version_number INTEGER NOT NULL,

    title TEXT,
    body TEXT,

    change_type TEXT,

    created_by TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(story_id, version_number)
);


CREATE TABLE IF NOT EXISTS ez_ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID
        REFERENCES ez_stories(id)
        ON DELETE CASCADE,

    agent_id TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'queued',

    input JSONB NOT NULL DEFAULT '{}'::jsonb,

    output JSONB NOT NULL DEFAULT '{}'::jsonb,

    error TEXT,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS ez_workflow_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_type TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'queued',

    priority INTEGER NOT NULL DEFAULT 50,

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    result JSONB NOT NULL DEFAULT '{}'::jsonb,

    error TEXT,

    attempts INTEGER NOT NULL DEFAULT 0,

    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_ez_workflow_status
ON ez_workflow_jobs(status, priority DESC, available_at);


CREATE TABLE IF NOT EXISTS ez_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_type TEXT NOT NULL,

    actor_id TEXT,

    action TEXT NOT NULL,

    entity_type TEXT,

    entity_id UUID,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS ez_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID,

    asset_type TEXT NOT NULL,

    storage_provider TEXT,

    storage_key TEXT,

    original_url TEXT,

    mime_type TEXT,

    file_size BIGINT,

    duration_seconds NUMERIC,

    width INTEGER,

    height INTEGER,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    rights JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS ez_story_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES ez_stories(id)
        ON DELETE CASCADE,

    source_type TEXT,

    source_name TEXT,

    source_url TEXT,

    published_at TIMESTAMPTZ,

    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    reliability_score NUMERIC(5,2),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);


CREATE TABLE IF NOT EXISTS ez_story_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES ez_stories(id)
        ON DELETE CASCADE,

    active BOOLEAN NOT NULL DEFAULT true,

    interval_seconds INTEGER NOT NULL DEFAULT 300,

    last_checked_at TIMESTAMPTZ,

    next_check_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS ez_external_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    source_type TEXT NOT NULL,

    base_url TEXT,

    feed_url TEXT,

    active BOOLEAN NOT NULL DEFAULT true,

    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    last_success_at TIMESTAMPTZ,

    last_error_at TIMESTAMPTZ,

    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE OR REPLACE FUNCTION ez_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_ez_stories_updated
ON ez_stories;

CREATE TRIGGER trg_ez_stories_updated
BEFORE UPDATE ON ez_stories
FOR EACH ROW
EXECUTE FUNCTION ez_update_timestamp();


DROP TRIGGER IF EXISTS trg_ez_external_sources_updated
ON ez_external_sources;

CREATE TRIGGER trg_ez_external_sources_updated
BEFORE UPDATE ON ez_external_sources
FOR EACH ROW
EXECUTE FUNCTION ez_update_timestamp();
