CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =========================================================
-- ORGANIZATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    avatar_url TEXT,
    phone VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- CONTENT CATEGORIES
-- =========================================================

CREATE TABLE IF NOT EXISTS content_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES content_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- CONTENT
-- =========================================================

CREATE TABLE IF NOT EXISTS content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE SET NULL,

    author_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    category_id UUID
        REFERENCES content_categories(id)
        ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,

    slug VARCHAR(600) NOT NULL UNIQUE,

    excerpt TEXT,

    body TEXT,

    content_type VARCHAR(50)
        NOT NULL DEFAULT 'article',

    status VARCHAR(50)
        NOT NULL DEFAULT 'draft',

    visibility VARCHAR(50)
        NOT NULL DEFAULT 'public',

    featured BOOLEAN
        NOT NULL DEFAULT FALSE,

    breaking BOOLEAN
        NOT NULL DEFAULT FALSE,

    ai_generated BOOLEAN
        NOT NULL DEFAULT FALSE,

    ai_reviewed BOOLEAN
        NOT NULL DEFAULT FALSE,

    source_url TEXT,

    source_name VARCHAR(255),

    published_at TIMESTAMPTZ,

    scheduled_at TIMESTAMPTZ,

    seo_title VARCHAR(500),

    seo_description TEXT,

    seo_keywords TEXT[],

    views BIGINT
        NOT NULL DEFAULT 0,

    shares BIGINT
        NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- MEDIA ASSETS
-- =========================================================

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE SET NULL,

    uploaded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    filename VARCHAR(500) NOT NULL,

    original_filename VARCHAR(500),

    mime_type VARCHAR(150),

    media_type VARCHAR(50),

    size_bytes BIGINT,

    storage_provider VARCHAR(100),

    storage_key TEXT,

    public_url TEXT,

    thumbnail_url TEXT,

    width INTEGER,

    height INTEGER,

    duration_seconds NUMERIC,

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- CONTENT MEDIA
-- =========================================================

CREATE TABLE IF NOT EXISTS content_media (
    content_id UUID
        REFERENCES content(id)
        ON DELETE CASCADE,

    media_id UUID
        REFERENCES media_assets(id)
        ON DELETE CASCADE,

    sort_order INTEGER
        NOT NULL DEFAULT 0,

    role VARCHAR(50)
        NOT NULL DEFAULT 'attachment',

    PRIMARY KEY (
        content_id,
        media_id
    )
);


-- =========================================================
-- SOURCES
-- =========================================================

CREATE TABLE IF NOT EXISTS content_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    url TEXT,

    type VARCHAR(50)
        NOT NULL DEFAULT 'web',

    feed_url TEXT,

    is_active BOOLEAN
        NOT NULL DEFAULT TRUE,

    last_fetched_at TIMESTAMPTZ,

    settings JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- INGEST QUEUE
-- =========================================================

CREATE TABLE IF NOT EXISTS ingest_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_id UUID
        REFERENCES content_sources(id)
        ON DELETE SET NULL,

    source_url TEXT,

    external_id VARCHAR(500),

    title TEXT,

    raw_content TEXT,

    normalized_content TEXT,

    media JSONB
        NOT NULL DEFAULT '[]'::jsonb,

    ai_analysis JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50)
        NOT NULL DEFAULT 'pending',

    review_required BOOLEAN
        NOT NULL DEFAULT FALSE,

    fetched_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- PUBLISH JOBS
-- =========================================================

CREATE TABLE IF NOT EXISTS publish_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID
        REFERENCES content(id)
        ON DELETE CASCADE,

    platform VARCHAR(100) NOT NULL,

    account_id UUID,

    status VARCHAR(50)
        NOT NULL DEFAULT 'pending',

    scheduled_at TIMESTAMPTZ,

    published_at TIMESTAMPTZ,

    external_post_id TEXT,

    error_message TEXT,

    response JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- AUTOMATION WORKFLOWS
-- =========================================================

CREATE TABLE IF NOT EXISTS automation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    description TEXT,

    trigger_type VARCHAR(100) NOT NULL,

    status VARCHAR(50)
        NOT NULL DEFAULT 'active',

    configuration JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- AUTOMATION RUNS
-- =========================================================

CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workflow_id UUID
        REFERENCES automation_workflows(id)
        ON DELETE CASCADE,

    status VARCHAR(50)
        NOT NULL DEFAULT 'queued',

    input JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    output JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    error_message TEXT,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- AI TASKS
-- =========================================================

CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    task_type VARCHAR(100) NOT NULL,

    model VARCHAR(255),

    status VARCHAR(50)
        NOT NULL DEFAULT 'queued',

    input JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    output JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    error_message TEXT,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ
);


-- =========================================================
-- NOTIFICATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(100),

    title VARCHAR(500) NOT NULL,

    message TEXT,

    data JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- AUDIT LOG
-- =========================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(255) NOT NULL,

    entity_type VARCHAR(100),

    entity_id UUID,

    ip_address INET,

    user_agent TEXT,

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- ANALYTICS EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL PRIMARY KEY,

    event_name VARCHAR(255) NOT NULL,

    entity_type VARCHAR(100),

    entity_id UUID,

    user_id UUID,

    platform VARCHAR(100),

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_content_status
ON content(status);

CREATE INDEX IF NOT EXISTS idx_content_type
ON content(content_type);

CREATE INDEX IF NOT EXISTS idx_content_category
ON content(category_id);

CREATE INDEX IF NOT EXISTS idx_content_published
ON content(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_featured
ON content(featured);

CREATE INDEX IF NOT EXISTS idx_content_breaking
ON content(breaking);

CREATE INDEX IF NOT EXISTS idx_media_type
ON media_assets(media_type);

CREATE INDEX IF NOT EXISTS idx_ingest_status
ON ingest_items(status);

CREATE INDEX IF NOT EXISTS idx_publish_status
ON publish_jobs(status);

CREATE INDEX IF NOT EXISTS idx_automation_status
ON automation_runs(status);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status
ON ai_tasks(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_event
ON analytics_events(event_name);

CREATE INDEX IF NOT EXISTS idx_analytics_created
ON analytics_events(created_at DESC);


-- =========================================================
-- DEFAULT CATEGORIES
-- =========================================================

INSERT INTO content_categories
    (name, slug, description)
VALUES
    ('الأخبار', 'news', 'الأخبار والمستجدات'),
    ('عاجل', 'breaking', 'الأخبار العاجلة'),
    ('تغطيات', 'coverage', 'التغطيات الإعلامية'),
    ('فيديو', 'video', 'المحتوى المرئي'),
    ('صوتيات', 'audio', 'المحتوى الصوتي والبودكاست'),
    ('بث مباشر', 'live', 'البث المباشر'),
    ('تقارير', 'reports', 'التقارير الإعلامية'),
    ('اقتصاد', 'business', 'الأخبار والموضوعات الاقتصادية'),
    ('تقنية', 'technology', 'التقنية والذكاء الاصطناعي'),
    ('مجتمع', 'community', 'المجتمع والفعاليات')
ON CONFLICT (slug)
DO NOTHING;
