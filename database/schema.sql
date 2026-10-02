-- ============================================================================
-- AZ MEDIA 11.0
-- Database Migration Registry
-- PostgreSQL
-- ============================================================================

BEGIN;


-- ============================================================================
-- Migration Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,

    version VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,

    checksum VARCHAR(128),

    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- Initial Schema
-- ============================================================================

INSERT INTO schema_migrations (
    version,
    name
)
VALUES (
    '001',
    'initial_az_media_schema'
)
ON CONFLICT (version)
DO NOTHING;


COMMIT;
-- ============================================================================
-- AZ MEDIA 11.0
-- Production Database Schema
-- PostgreSQL
-- ============================================================================

BEGIN;


-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- Organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    slug VARCHAR(255) NOT NULL UNIQUE,

    status VARCHAR(30) NOT NULL DEFAULT 'active',

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organizations_status_check
        CHECK (
            status IN (
                'active',
                'suspended',
                'disabled'
            )
        )
);


-- ============================================================================
-- Users
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    email VARCHAR(320) NOT NULL,

    password_hash TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'active',

    email_verified_at TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_status_check
        CHECK (
            status IN (
                'active',
                'inactive',
                'suspended',
                'pending'
            )
        ),

    CONSTRAINT users_email_unique
        UNIQUE (
            organization_id,
            email
        )
);


CREATE INDEX IF NOT EXISTS idx_users_organization
    ON users(organization_id);

CREATE INDEX IF NOT EXISTS idx_users_status
    ON users(status);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(organization_id, email);


-- ============================================================================
-- Roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,

    description TEXT,

    system_role BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- Permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL UNIQUE,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- User Roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role_id UUID NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        role_id
    )
);


CREATE INDEX IF NOT EXISTS idx_user_roles_role
    ON user_roles(role_id);


-- ============================================================================
-- Role Permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    permission_id UUID NOT NULL
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        role_id,
        permission_id
    )
);


CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
    ON role_permissions(permission_id);


-- ============================================================================
-- Refresh Tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    replaced_by_token_id UUID,

    ip_address INET,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
    ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
    ON refresh_tokens(user_id, expires_at)
    WHERE revoked_at IS NULL;


-- ============================================================================
-- Articles
-- ============================================================================

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    author_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,

    slug VARCHAR(500) NOT NULL,

    excerpt TEXT,

    content TEXT NOT NULL DEFAULT '',

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    category VARCHAR(150),

    tags JSONB NOT NULL DEFAULT '[]'::jsonb,

    featured_media_id UUID,

    published_at TIMESTAMPTZ,

    scheduled_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT articles_status_check
        CHECK (
            status IN (
                'draft',
                'in_review',
                'approved',
                'scheduled',
                'published',
                'rejected',
                'archived'
            )
        ),

    CONSTRAINT articles_slug_unique
        UNIQUE (
            organization_id,
            slug
        )
);


CREATE INDEX IF NOT EXISTS idx_articles_organization
    ON articles(organization_id);

CREATE INDEX IF NOT EXISTS idx_articles_author
    ON articles(author_id);

CREATE INDEX IF NOT EXISTS idx_articles_status
    ON articles(
        organization_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_articles_published
    ON articles(
        organization_id,
        published_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_articles_created
    ON articles(
        organization_id,
        created_at DESC
    );


-- ============================================================================
-- Media Assets
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    uploaded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    name VARCHAR(500) NOT NULL,

    original_name VARCHAR(500),

    type VARCHAR(100) NOT NULL,

    mime_type VARCHAR(150),

    storage_provider VARCHAR(100),

    storage_key TEXT,

    public_url TEXT,

    size_bytes BIGINT,

    checksum VARCHAR(128),

    width INTEGER,

    height INTEGER,

    duration_seconds NUMERIC(12,3),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(30) NOT NULL DEFAULT 'uploaded',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_assets_status_check
        CHECK (
            status IN (
                'uploaded',
                'processing',
                'ready',
                'failed',
                'archived'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_media_organization
    ON media_assets(organization_id);

CREATE INDEX IF NOT EXISTS idx_media_uploaded_by
    ON media_assets(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_media_status
    ON media_assets(
        organization_id,
        status
    );

CREATE INDEX IF NOT EXISTS idx_media_created
    ON media_assets(
        organization_id,
        created_at DESC
    );


-- ============================================================================
-- AI Agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    role VARCHAR(255) NOT NULL,

    description TEXT,

    instructions TEXT,

    goals JSONB NOT NULL DEFAULT '[]'::jsonb,

    autonomy_level VARCHAR(30) NOT NULL DEFAULT 'approval',

    status VARCHAR(30) NOT NULL DEFAULT 'active',

    tools JSONB NOT NULL DEFAULT '[]'::jsonb,

    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,

    knowledge JSONB NOT NULL DEFAULT '[]'::jsonb,

    memory JSONB NOT NULL DEFAULT '{}'::jsonb,

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_agents_autonomy_check
        CHECK (
            autonomy_level IN (
                'auto',
                'approval',
                'human_only'
            )
        ),

    CONSTRAINT ai_agents_status_check
        CHECK (
            status IN (
                'active',
                'paused',
                'disabled'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_ai_agents_organization
    ON ai_agents(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_status
    ON ai_agents(
        organization_id,
        status
    );


-- ============================================================================
-- AI Tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    agent_id UUID
        REFERENCES ai_agents(id)
        ON DELETE SET NULL,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    task_type VARCHAR(150) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'queued',

    priority INTEGER NOT NULL DEFAULT 100,

    input JSONB NOT NULL DEFAULT '{}'::jsonb,

    output JSONB NOT NULL DEFAULT '{}'::jsonb,

    error TEXT,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_tasks_status_check
        CHECK (
            status IN (
                'queued',
                'running',
                'waiting_approval',
                'completed',
                'failed',
                'cancelled'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_ai_tasks_organization
    ON ai_tasks(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_agent
    ON ai_tasks(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_queue
    ON ai_tasks(
        organization_id,
        status,
        priority,
        created_at
    );


-- ============================================================================
-- Automation Workflows
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    version INTEGER NOT NULL DEFAULT 1,

    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,

    actions JSONB NOT NULL DEFAULT '[]'::jsonb,

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT automation_workflows_status_check
        CHECK (
            status IN (
                'draft',
                'ready',
                'active',
                'paused',
                'disabled'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_workflows_organization
    ON automation_workflows(organization_id);

CREATE INDEX IF NOT EXISTS idx_workflows_status
    ON automation_workflows(
        organization_id,
        status
    );


-- ============================================================================
-- Automation Runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    workflow_id UUID NOT NULL
        REFERENCES automation_workflows(id)
        ON DELETE CASCADE,

    triggered_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'queued',

    priority INTEGER NOT NULL DEFAULT 100,

    input JSONB NOT NULL DEFAULT '{}'::jsonb,

    output JSONB NOT NULL DEFAULT '{}'::jsonb,

    error TEXT,

    attempts INTEGER NOT NULL DEFAULT 0,

    max_attempts INTEGER NOT NULL DEFAULT 3,

    idempotency_key VARCHAR(255),

    started_at TIMESTAMPTZ,

    finished_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT automation_runs_status_check
        CHECK (
            status IN (
                'queued',
                'running',
                'waiting',
                'waiting_approval',
                'paused',
                'retrying',
                'failed',
                'completed',
                'cancelled'
            )
        ),

    CONSTRAINT automation_runs_attempts_check
        CHECK (
            attempts >= 0
        ),

    CONSTRAINT automation_runs_max_attempts_check
        CHECK (
            max_attempts >= 1
        )
);


CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_runs_idempotency
    ON automation_runs(
        organization_id,
        idempotency_key
    )
    WHERE idempotency_key IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_automation_runs_workflow
    ON automation_runs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_automation_runs_queue
    ON automation_runs(
        organization_id,
        status,
        priority,
        created_at
    );


-- ============================================================================
-- Production Projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,

    type VARCHAR(100),

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    brief JSONB NOT NULL DEFAULT '{}'::jsonb,

    budget NUMERIC(14,2),

    currency CHAR(3) DEFAULT 'SAR',

    client_name VARCHAR(255),

    schedule JSONB NOT NULL DEFAULT '{}'::jsonb,

    crew JSONB NOT NULL DEFAULT '[]'::jsonb,

    equipment JSONB NOT NULL DEFAULT '[]'::jsonb,

    deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT production_projects_status_check
        CHECK (
            status IN (
                'draft',
                'planning',
                'production',
                'post_production',
                'review',
                'approved',
                'completed',
                'archived',
                'cancelled'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_production_organization
    ON production_projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_production_status
    ON production_projects(
        organization_id,
        status
    );


-- ============================================================================
-- Social Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    platform VARCHAR(100) NOT NULL,

    account_name VARCHAR(255) NOT NULL,

    external_account_id VARCHAR(255),

    status VARCHAR(30) NOT NULL DEFAULT 'connected',

    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT social_accounts_status_check
        CHECK (
            status IN (
                'connected',
                'expired',
                'disconnected',
                'error'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_social_accounts_organization
    ON social_accounts(organization_id);

CREATE INDEX IF NOT EXISTS idx_social_accounts_platform
    ON social_accounts(
        organization_id,
        platform
    );


-- ============================================================================
-- Social Posts
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    content TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    scheduled_at TIMESTAMPTZ,

    published_at TIMESTAMPTZ,

    destinations JSONB NOT NULL DEFAULT '[]'::jsonb,

    media_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

    analytics JSONB NOT NULL DEFAULT '{}'::jsonb,

    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT social_posts_status_check
        CHECK (
            status IN (
                'draft',
                'approved',
                'scheduled',
                'publishing',
                'published',
                'failed',
                'cancelled'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_social_posts_organization
    ON social_posts(organization_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_schedule
    ON social_posts(
        organization_id,
        scheduled_at
    );

CREATE INDEX IF NOT EXISTS idx_social_posts_status
    ON social_posts(
        organization_id,
        status
    );


-- ============================================================================
-- Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(100) NOT NULL,

    title VARCHAR(255) NOT NULL,

    message TEXT,

    data JSONB NOT NULL DEFAULT '{}'::jsonb,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(
        user_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(
        user_id,
        created_at DESC
    )
    WHERE read_at IS NULL;


-- ============================================================================
-- Audit Logs
-- ============================================================================

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

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    ip_address INET,

    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_audit_organization
    ON audit_logs(
        organization_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_audit_user
    ON audit_logs(
        user_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_audit_resource
    ON audit_logs(
        resource_type,
        resource_id
    );


-- ============================================================================
-- Event Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    actor_user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    event_type VARCHAR(255) NOT NULL,

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_event_log_organization
    ON event_log(
        organization_id,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_event_log_type
    ON event_log(
        event_type,
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_event_log_unprocessed
    ON event_log(created_at)
    WHERE processed_at IS NULL;


-- ============================================================================
-- Seed Roles
-- ============================================================================

INSERT INTO roles (
    name,
    description,
    system_role
)
VALUES
(
    'super_admin',
    'الإدارة العليا للنظام',
    TRUE
),
(
    'admin',
    'مدير المؤسسة',
    TRUE
),
(
    'editor',
    'محرر المحتوى',
    TRUE
),
(
    'producer',
    'منتج إعلامي',
    TRUE
),
(
    'designer',
    'مصمم',
    TRUE
),
(
    'social_manager',
    'مدير المنصات الاجتماعية',
    TRUE
),
(
    'ai_manager',
    'مدير الذكاء الاصطناعي',
    TRUE
),
(
    'viewer',
    'مشاهد',
    TRUE
)
ON CONFLICT (name)
DO NOTHING;


-- ============================================================================
-- Seed Permissions
-- ============================================================================

INSERT INTO permissions (
    name,
    description
)
VALUES

-- Users
(
    'users.read',
    'قراءة المستخدمين'
),
(
    'users.create',
    'إنشاء المستخدمين'
),
(
    'users.update',
    'تعديل المستخدمين'
),
(
    'users.delete',
    'حذف المستخدمين'
),

-- Articles
(
    'articles.read',
    'قراءة الأخبار'
),
(
    'articles.create',
    'إنشاء الأخبار'
),
(
    'articles.update',
    'تعديل الأخبار'
),
(
    'articles.delete',
    'حذف الأخبار'
),
(
    'articles.approve',
    'اعتماد الأخبار'
),
(
    'articles.publish',
    'نشر الأخبار'
),

-- Media
(
    'media.read',
    'قراءة الملفات'
),
(
    'media.upload',
    'رفع الملفات'
),
(
    'media.update',
    'تعديل الملفات'
),
(
    'media.delete',
    'حذف الملفات'
),

-- Production
(
    'production.read',
    'قراءة مشاريع الإنتاج'
),
(
    'production.create',
    'إنشاء مشاريع الإنتاج'
),
(
    'production.update',
    'تعديل مشاريع الإنتاج'
),
(
    'production.manage',
    'إدارة الإنتاج'
),

-- AI
(
    'ai.read',
    'قراءة موظفي الذكاء الاصطناعي'
),
(
    'ai.create',
    'إنشاء موظفي الذكاء الاصطناعي'
),
(
    'ai.execute',
    'تشغيل الذكاء الاصطناعي'
),
(
    'ai.manage',
    'إدارة الذكاء الاصطناعي'
),

-- Automation
(
    'automation.read',
    'قراءة الأتمتة'
),
(
    'automation.create',
    'إنشاء الأتمتة'
),
(
    'automation.execute',
    'تشغيل الأتمتة'
),
(
    'automation.manage',
    'إدارة الأتمتة'
),

-- Social
(
    'social.read',
    'قراءة المنصات الاجتماعية'
),
(
    'social.create',
    'إنشاء المنشورات'
),
(
    'social.schedule',
    'جدولة المنشورات'
),
(
    'social.publish',
    'نشر المنشورات'
),
(
    'social.manage',
    'إدارة الحسابات الاجتماعية'
),

-- System
(
    'analytics.read',
    'قراءة التحليلات'
),
(
    'notifications.read',
    'قراءة الإشعارات'
),
(
    'audit.read',
    'قراءة سجل التدقيق'
),
(
    'admin.manage',
    'إدارة النظام'
)

ON CONFLICT (name)
DO NOTHING;


-- ============================================================================
-- Role Permissions
-- ============================================================================

-- Super Admin
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;


-- Admin
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name IN (
        'users.read',
        'users.create',
        'users.update',
        'users.delete',

        'articles.read',
        'articles.create',
        'articles.update',
        'articles.delete',
        'articles.approve',
        'articles.publish',

        'media.read',
        'media.upload',
        'media.update',
        'media.delete',

        'production.read',
        'production.create',
        'production.update',
        'production.manage',

        'ai.read',
        'ai.create',
        'ai.execute',
        'ai.manage',

        'automation.read',
        'automation.create',
        'automation.execute',
        'automation.manage',

        'social.read',
        'social.create',
        'social.schedule',
        'social.publish',
        'social.manage',

        'analytics.read',
        'notifications.read',
        'audit.read',
        'admin.manage'
    )
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;


-- Editor
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name IN (
        'articles.read',
        'articles.create',
        'articles.update',
        'articles.approve',

        'media.read',
        'media.upload',

        'production.read',

        'social.read',
        'social.create',

        'analytics.read'
    )
WHERE r.name = 'editor'
ON CONFLICT DO NOTHING;


-- Producer
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name IN (
        'articles.read',

        'media.read',
        'media.upload',

        'production.read',
        'production.create',
        'production.update',
        'production.manage',

        'analytics.read'
    )
WHERE r.name = 'producer'
ON CONFLICT DO NOTHING;


-- Designer
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name IN (
        'media.read',
        'media.upload',
        'media.update',

        'production.read',
        'production.update'
    )
WHERE r.name = 'designer'
ON CONFLICT DO NOTHING;


-- Social Manager
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name IN (
        'articles.read',

        'media.read',

        'social.read',
        'social.create',
        'social.schedule',
        'social.publish',
        'social.manage',

        'analytics.read'
    )
WHERE r.name = 'social_manager'
ON CONFLICT DO NOTHING;


-- AI Manager
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name IN (
        'ai.read',
        'ai.create',
        'ai.execute',
        'ai.manage',

        'automation.read',
        'automation.create',
        'automation.execute',
        'automation.manage',

        'analytics.read'
    )
WHERE r.name = 'ai_manager'
ON CONFLICT DO NOTHING;


-- Viewer
INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name IN (
        'articles.read',
        'media.read',
        'production.read',
        'social.read',
        'analytics.read',
        'notifications.read'
    )
WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();

    RETURN NEW;
END;
$$;


-- ============================================================================
-- Updated At Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS organizations_updated_at
    ON organizations;

CREATE TRIGGER organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS users_updated_at
    ON users;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS roles_updated_at
    ON roles;

CREATE TRIGGER roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS articles_updated_at
    ON articles;

CREATE TRIGGER articles_updated_at
BEFORE UPDATE ON articles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS media_assets_updated_at
    ON media_assets;

CREATE TRIGGER media_assets_updated_at
BEFORE UPDATE ON media_assets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS ai_agents_updated_at
    ON ai_agents;

CREATE TRIGGER ai_agents_updated_at
BEFORE UPDATE ON ai_agents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS ai_tasks_updated_at
    ON ai_tasks;

CREATE TRIGGER ai_tasks_updated_at
BEFORE UPDATE ON ai_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS automation_workflows_updated_at
    ON automation_workflows;

CREATE TRIGGER automation_workflows_updated_at
BEFORE UPDATE ON automation_workflows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS automation_runs_updated_at
    ON automation_runs;

CREATE TRIGGER automation_runs_updated_at
BEFORE UPDATE ON automation_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS production_projects_updated_at
    ON production_projects;

CREATE TRIGGER production_projects_updated_at
BEFORE UPDATE ON production_projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS social_accounts_updated_at
    ON social_accounts;

CREATE TRIGGER social_accounts_updated_at
BEFORE UPDATE ON social_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS social_posts_updated_at
    ON social_posts;

CREATE TRIGGER social_posts_updated_at
BEFORE UPDATE ON social_posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- Finished
-- ============================================================================

COMMIT;
