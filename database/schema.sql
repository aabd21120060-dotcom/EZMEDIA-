CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    email VARCHAR(320) NOT NULL,

    password_hash TEXT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_organization
ON users(organization_id);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) UNIQUE NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) UNIQUE NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role_id UUID NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    PRIMARY KEY(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    permission_id UUID NOT NULL
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    title VARCHAR(500) NOT NULL,

    slug VARCHAR(500),

    content TEXT NOT NULL DEFAULT '',

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    author_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_org
ON articles(organization_id);

CREATE INDEX IF NOT EXISTS idx_articles_status
ON articles(status);

CREATE INDEX IF NOT EXISTS idx_articles_created
ON articles(created_at DESC);

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(500) NOT NULL,

    type VARCHAR(100) NOT NULL,

    mime_type VARCHAR(150),

    storage_provider VARCHAR(100),

    storage_key TEXT,

    public_url TEXT,

    size_bytes BIGINT,

    metadata JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_org
ON media_assets(organization_id);

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    role VARCHAR(255) NOT NULL,

    description TEXT,

    instructions TEXT,

    autonomy_level VARCHAR(50) NOT NULL DEFAULT 'approval',

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    tools JSONB NOT NULL DEFAULT '[]',

    permissions JSONB NOT NULL DEFAULT '[]',

    knowledge JSONB NOT NULL DEFAULT '[]',

    memory JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    trigger_config JSONB NOT NULL DEFAULT '{}',

    settings JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workflow_id UUID NOT NULL
        REFERENCES automation_workflows(id)
        ON DELETE CASCADE,

    status VARCHAR(50) NOT NULL DEFAULT 'queued',

    input JSONB NOT NULL DEFAULT '{}',

    output JSONB NOT NULL DEFAULT '{}',

    error TEXT,

    started_at TIMESTAMPTZ,

    finished_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    type VARCHAR(100),

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    brief JSONB NOT NULL DEFAULT '{}',

    budget NUMERIC(14,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    content TEXT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    scheduled_at TIMESTAMPTZ,

    published_at TIMESTAMPTZ,

    destinations JSONB NOT NULL DEFAULT '[]',

    media_ids JSONB NOT NULL DEFAULT '[]',

    analytics JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(255) NOT NULL,

    resource_type VARCHAR(150),

    resource_id UUID,

    metadata JSONB NOT NULL DEFAULT '{}',

    ip_address INET,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    event_type VARCHAR(255) NOT NULL,

    payload JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description)
VALUES
('super_admin', 'الإدارة العليا'),
('admin', 'مدير النظام'),
('editor', 'محرر'),
('producer', 'منتج'),
('designer', 'مصمم'),
('social_manager', 'مدير منصات'),
('viewer', 'مشاهد')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description)
VALUES
('articles.read', 'قراءة الأخبار'),
('articles.create', 'إنشاء الأخبار'),
('articles.update', 'تعديل الأخبار'),
('articles.publish', 'نشر الأخبار'),
('media.read', 'قراءة الملفات'),
('media.upload', 'رفع الملفات'),
('production.manage', 'إدارة الإنتاج'),
('ai.execute', 'تشغيل الذكاء الاصطناعي'),
('automation.execute', 'تشغيل الأتمتة'),
('social.publish', 'النشر الاجتماعي'),
('admin.manage', 'إدارة النظام')
ON CONFLICT (name) DO NOTHING;
