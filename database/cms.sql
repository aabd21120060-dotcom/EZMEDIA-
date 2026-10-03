CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cms_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type VARCHAR(40) NOT NULL DEFAULT 'news',

    title VARCHAR(500) NOT NULL,

    slug VARCHAR(600) UNIQUE,

    summary TEXT,

    body TEXT,

    featured_image_url TEXT,

    video_url TEXT,

    audio_url TEXT,

    location VARCHAR(255),

    author_id UUID,

    editor_id UUID,

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    priority VARCHAR(20) NOT NULL DEFAULT 'normal',

    is_breaking BOOLEAN NOT NULL DEFAULT FALSE,

    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    allow_comments BOOLEAN NOT NULL DEFAULT TRUE,

    scheduled_at TIMESTAMPTZ,

    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_content_status
ON cms_content(status);

CREATE INDEX IF NOT EXISTS idx_cms_content_type
ON cms_content(type);

CREATE INDEX IF NOT EXISTS idx_cms_content_published_at
ON cms_content(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_cms_content_breaking
ON cms_content(is_breaking);

CREATE INDEX IF NOT EXISTS idx_cms_content_featured
ON cms_content(is_featured);


CREATE TABLE IF NOT EXISTS cms_content_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID NOT NULL
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

    tag VARCHAR(100) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_content_tags_content
ON cms_content_tags(content_id);

CREATE INDEX IF NOT EXISTS idx_cms_content_tags_tag
ON cms_content_tags(tag);


CREATE TABLE IF NOT EXISTS cms_content_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID NOT NULL
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

    title VARCHAR(500),

    summary TEXT,

    body TEXT,

    changed_by UUID,

    change_type VARCHAR(40) NOT NULL DEFAULT 'update',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_revisions_content
ON cms_content_revisions(content_id);


CREATE TABLE IF NOT EXISTS cms_content_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    content_id UUID NOT NULL
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

    event_type VARCHAR(50) NOT NULL,

    actor_id UUID,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_events_content
ON cms_content_events(content_id);

CREATE INDEX IF NOT EXISTS idx_cms_events_created
ON cms_content_events(created_at DESC);
