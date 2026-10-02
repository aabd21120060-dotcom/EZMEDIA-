/*
|--------------------------------------------------------------------------
| AZ MEDIA 11.0
| Initial Database Schema
|--------------------------------------------------------------------------
|
| الملف:
| database/migrations/001_initial_schema.sql
|
| ملاحظة:
| لا نضع BEGIN / COMMIT هنا.
| الـMigration Runner هو المسؤول عن Transaction.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Extensions
|--------------------------------------------------------------------------
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;


/*
|--------------------------------------------------------------------------
| Organizations
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    slug VARCHAR(255) NOT NULL UNIQUE,

    description TEXT,

    logo_url TEXT,

    website_url TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organizations_status_check
        CHECK (
            status IN (
                'active',
                'suspended',
                'archived'
            )
        )
);


/*
|--------------------------------------------------------------------------
| Users
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    email VARCHAR(320) NOT NULL,

    password_hash TEXT,

    first_name VARCHAR(100),

    last_name VARCHAR(100),

    display_name VARCHAR(255),

    avatar_url TEXT,

    phone VARCHAR(50),

    status VARCHAR(50) NOT NULL DEFAULT 'active',

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
        )
);


/*
|--------------------------------------------------------------------------
| Unique User Email
|--------------------------------------------------------------------------
*/

CREATE UNIQUE INDEX IF NOT EXISTS
users_email_unique_idx
ON users (
    LOWER(email)
);


/*
|--------------------------------------------------------------------------
| Roles
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,

    slug VARCHAR(100) NOT NULL,

    description TEXT,

    is_system BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT roles_unique_slug_per_org
        UNIQUE (
            organization_id,
            slug
        )
);


/*
|--------------------------------------------------------------------------
| Permissions
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL UNIQUE,

    resource VARCHAR(100) NOT NULL,

    action VARCHAR(100) NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/*
|--------------------------------------------------------------------------
| User Roles
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL,

    role_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        user_id,
        role_id
    ),

    CONSTRAINT user_roles_user_fk
        FOREIGN KEY (
            user_id
        )
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_roles_role_fk
        FOREIGN KEY (
            role_id
        )
        REFERENCES roles(id)
        ON DELETE CASCADE
);


/*
|--------------------------------------------------------------------------
| Role Permissions
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL,

    permission_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        role_id,
        permission_id
    ),

    CONSTRAINT role_permissions_role_fk
        FOREIGN KEY (
            role_id
        )
        REFERENCES roles(id)
        ON DELETE CASCADE,

    CONSTRAINT role_permissions_permission_fk
        FOREIGN KEY (
            permission_id
        )
        REFERENCES permissions(id)
        ON DELETE CASCADE
);


/*
|--------------------------------------------------------------------------
| Refresh Tokens
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    user_agent TEXT,

    ip_address INET,

    CONSTRAINT refresh_tokens_user_fk
        FOREIGN KEY (
            user_id
        )
        REFERENCES users(id)
        ON DELETE CASCADE
);


/*
|--------------------------------------------------------------------------
| Articles
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    author_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,

    slug VARCHAR(500) NOT NULL,

    excerpt TEXT,

    content TEXT,

    content_json JSONB,

    article_type VARCHAR(50) NOT NULL DEFAULT 'news',

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    visibility VARCHAR(50) NOT NULL DEFAULT 'public',

    featured_media_id UUID,

    published_at TIMESTAMPTZ,

    scheduled_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT articles_type_check
        CHECK (
            article_type IN (
                'news',
                'report',
                'interview',
                'opinion',
                'analysis',
                'announcement',
                'press_release',
                'video',
                'audio',
                'other'
            )
        ),

    CONSTRAINT articles_status_check
        CHECK (
            status IN (
                'draft',
                'review',
                'approved',
                'scheduled',
                'published',
                'archived',
                'rejected'
            )
        ),

    CONSTRAINT articles_visibility_check
        CHECK (
            visibility IN (
                'public',
                'private',
                'internal'
            )
        ),

    CONSTRAINT articles_unique_slug_per_org
        UNIQUE (
            organization_id,
            slug
        )
);


/*
|--------------------------------------------------------------------------
| Media Assets
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    uploaded_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    filename TEXT NOT NULL,

    original_filename TEXT,

    mime_type VARCHAR(255),

    media_type VARCHAR(50) NOT NULL,

    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',

    storage_key TEXT NOT NULL,

    storage_url TEXT,

    file_size BIGINT,

    checksum VARCHAR(128),

    width INTEGER,

    height INTEGER,

    duration_seconds NUMERIC(12,3),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'ready',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_assets_type_check
        CHECK (
            media_type IN (
                'image',
                'video',
                'audio',
                'document',
                'archive',
                'other'
            )
        ),

    CONSTRAINT media_assets_status_check
        CHECK (
            status IN (
                'uploading',
                'processing',
                'ready',
                'failed',
                'deleted'
            )
        )
);


/*
|--------------------------------------------------------------------------
| Article Featured Media FK
|--------------------------------------------------------------------------
*/

ALTER TABLE articles
DROP CONSTRAINT IF EXISTS
articles_featured_media_fk;


ALTER TABLE articles
ADD CONSTRAINT
articles_featured_media_fk
FOREIGN KEY (
    featured_media_id
)
REFERENCES media_assets(id)
ON DELETE SET NULL;


/*
|--------------------------------------------------------------------------
| AI Agents
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    slug VARCHAR(255) NOT NULL,

    description TEXT,

    agent_type VARCHAR(100) NOT NULL,

    model VARCHAR(255),

    provider VARCHAR(100),

    system_prompt TEXT,

    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,

    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_agents_status_check
        CHECK (
            status IN (
                'active',
                'inactive',
                'disabled'
            )
        ),

    CONSTRAINT ai_agents_unique_slug_per_org
        UNIQUE (
            organization_id,
            slug
        )
);


/*
|--------------------------------------------------------------------------
| AI Tasks
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    agent_id UUID
        REFERENCES ai_agents(id)
        ON DELETE SET NULL,

    requested_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    task_type VARCHAR(100) NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'queued',

    priority INTEGER NOT NULL DEFAULT 100,

    input JSONB NOT NULL DEFAULT '{}'::jsonb,

    output JSONB,

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
                'completed',
                'failed',
                'cancelled'
            )
        )
);


/*
|--------------------------------------------------------------------------
| Automation Workflows
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS automation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,

    slug VARCHAR(255) NOT NULL,

    description TEXT,

    trigger_type VARCHAR(100) NOT NULL,

    definition JSONB NOT NULL DEFAULT '{}'::jsonb,

    version INTEGER NOT NULL DEFAULT 1,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT automation_workflows_status_check
        CHECK (
            status IN (
                'draft',
                'active',
                'paused',
                'archived'
            )
        ),

    CONSTRAINT automation_workflows_unique_slug
        UNIQUE (
            organization_id,
            slug
        )
);


/*
|--------------------------------------------------------------------------
| Automation Runs
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workflow_id UUID NOT NULL,

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    status VARCHAR(50) NOT NULL DEFAULT 'queued',

    trigger_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    context JSONB NOT NULL DEFAULT '{}'::jsonb,

    result JSONB,

    error TEXT,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT automation_runs_workflow_fk
        FOREIGN KEY (
            workflow_id
        )
        REFERENCES automation_workflows(id)
        ON DELETE CASCADE,

    CONSTRAINT automation_runs_status_check
        CHECK (
            status IN (
                'queued',
                'running',
                'completed',
                'failed',
                'cancelled'
            )
        )
);


/*
|--------------------------------------------------------------------------
| Production Projects
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS production_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    owner_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    project_type VARCHAR(100),

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT production_projects_status_check
        CHECK (
            status IN (
                'draft',
                'active',
                'review',
                'completed',
                'archived'
            )
        )
);


/*
|--------------------------------------------------------------------------
| Social Accounts
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    connected_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    platform VARCHAR(100) NOT NULL,

    account_id VARCHAR(255),

    account_name VARCHAR(255),

    username VARCHAR(255),

    access_token_encrypted TEXT,

    refresh_token_encrypted TEXT,

    token_expires_at TIMESTAMPTZ,

    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT social_accounts_status_check
        CHECK (
            status IN (
                'active',
                'expired',
                'revoked',
                'disabled'
            )
        )
);


/*
|--------------------------------------------------------------------------
| Social Posts
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    social_account_id UUID
        REFERENCES social_accounts(id)
        ON DELETE CASCADE,

    article_id UUID
        REFERENCES articles(id)
        ON DELETE SET NULL,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    content TEXT,

    media_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    scheduled_at TIMESTAMPTZ,

    published_at TIMESTAMPTZ,

    external_post_id VARCHAR(255),

    external_url TEXT,

    response_data JSONB,

    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT social_posts_status_check
        CHECK (
            status IN (
                'draft',
                'scheduled',
                'publishing',
                'published',
                'failed',
                'cancelled'
            )
        )
);


/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(100) NOT NULL,

    title VARCHAR(500) NOT NULL,

    message TEXT,

    data JSONB NOT NULL DEFAULT '{}'::jsonb,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/*
|--------------------------------------------------------------------------
| Audit Logs
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE SET NULL,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(150) NOT NULL,

    resource_type VARCHAR(150),

    resource_id UUID,

    old_data JSONB,

    new_data JSONB,

    ip_address INET,

    user_agent TEXT,

    request_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/*
|--------------------------------------------------------------------------
| Event Log
|--------------------------------------------------------------------------
*/

CREATE TABLE IF NOT EXISTS event_log (
    id BIGSERIAL PRIMARY KEY,

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE SET NULL,

    event_type VARCHAR(150) NOT NULL,

    aggregate_type VARCHAR(150),

    aggregate_id UUID,

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/


CREATE INDEX IF NOT EXISTS
users_organization_idx
ON users (
    organization_id
);


CREATE INDEX IF NOT EXISTS
roles_organization_idx
ON roles (
    organization_id
);


CREATE INDEX IF NOT EXISTS
user_roles_role_idx
ON user_roles (
    role_id
);


CREATE INDEX IF NOT EXISTS
role_permissions_permission_idx
ON role_permissions (
    permission_id
);


CREATE INDEX IF NOT EXISTS
refresh_tokens_user_idx
ON refresh_tokens (
    user_id
);


CREATE INDEX IF NOT EXISTS
refresh_tokens_expires_idx
ON refresh_tokens (
    expires_at
);


CREATE INDEX IF NOT EXISTS
articles_organization_idx
ON articles (
    organization_id
);


CREATE INDEX IF NOT EXISTS
articles_author_idx
ON articles (
    author_id
);


CREATE INDEX IF NOT EXISTS
articles_status_idx
ON articles (
    status
);


CREATE INDEX IF NOT EXISTS
articles_published_at_idx
ON articles (
    published_at
);


CREATE INDEX IF NOT EXISTS
articles_scheduled_at_idx
ON articles (
    scheduled_at
);


CREATE INDEX IF NOT EXISTS
media_assets_organization_idx
ON media_assets (
    organization_id
);


CREATE INDEX IF NOT EXISTS
media_assets_uploaded_by_idx
ON media_assets (
    uploaded_by
);


CREATE INDEX IF NOT EXISTS
media_assets_type_idx
ON media_assets (
    media_type
);


CREATE INDEX IF NOT EXISTS
ai_agents_organization_idx
ON ai_agents (
    organization_id
);


CREATE INDEX IF NOT EXISTS
ai_tasks_organization_idx
ON ai_tasks (
    organization_id
);


CREATE INDEX IF NOT EXISTS
ai_tasks_status_idx
ON ai_tasks (
    status
);


CREATE INDEX IF NOT EXISTS
automation_workflows_organization_idx
ON automation_workflows (
    organization_id
);


CREATE INDEX IF NOT EXISTS
automation_runs_workflow_idx
ON automation_runs (
    workflow_id
);


CREATE INDEX IF NOT EXISTS
automation_runs_status_idx
ON automation_runs (
    status
);


CREATE INDEX IF NOT EXISTS
production_projects_organization_idx
ON production_projects (
    organization_id
);


CREATE INDEX IF NOT EXISTS
social_accounts_organization_idx
ON social_accounts (
    organization_id
);


CREATE INDEX IF NOT EXISTS
social_posts_account_idx
ON social_posts (
    social_account_id
);


CREATE INDEX IF NOT EXISTS
social_posts_status_idx
ON social_posts (
    status
);


CREATE INDEX IF NOT EXISTS
notifications_user_idx
ON notifications (
    user_id
);


CREATE INDEX IF NOT EXISTS
notifications_read_idx
ON notifications (
    read_at
);


CREATE INDEX IF NOT EXISTS
audit_logs_organization_idx
ON audit_logs (
    organization_id
);


CREATE INDEX IF NOT EXISTS
audit_logs_user_idx
ON audit_logs (
    user_id
);


CREATE INDEX IF NOT EXISTS
audit_logs_resource_idx
ON audit_logs (
    resource_type,
    resource_id
);


CREATE INDEX IF NOT EXISTS
audit_logs_created_at_idx
ON audit_logs (
    created_at
);


CREATE INDEX IF NOT EXISTS
event_log_organization_idx
ON event_log (
    organization_id
);


CREATE INDEX IF NOT EXISTS
event_log_type_idx
ON event_log (
    event_type
);


CREATE INDEX IF NOT EXISTS
event_log_aggregate_idx
ON event_log (
    aggregate_type,
    aggregate_id
);


CREATE INDEX IF NOT EXISTS
event_log_created_at_idx
ON event_log (
    created_at
);


/*
|--------------------------------------------------------------------------
| Updated At Function
|--------------------------------------------------------------------------
*/

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.updated_at =
        NOW();

    RETURN NEW;

END;
$$;


/*
|--------------------------------------------------------------------------
| Updated At Triggers
|--------------------------------------------------------------------------
*/


DROP TRIGGER IF EXISTS
organizations_updated_at
ON organizations;

CREATE TRIGGER
organizations_updated_at
BEFORE UPDATE
ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
users_updated_at
ON users;

CREATE TRIGGER
users_updated_at
BEFORE UPDATE
ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
roles_updated_at
ON roles;

CREATE TRIGGER
roles_updated_at
BEFORE UPDATE
ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
articles_updated_at
ON articles;

CREATE TRIGGER
articles_updated_at
BEFORE UPDATE
ON articles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
media_assets_updated_at
ON media_assets;

CREATE TRIGGER
media_assets_updated_at
BEFORE UPDATE
ON media_assets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
ai_agents_updated_at
ON ai_agents;

CREATE TRIGGER
ai_agents_updated_at
BEFORE UPDATE
ON ai_agents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
ai_tasks_updated_at
ON ai_tasks;

CREATE TRIGGER
ai_tasks_updated_at
BEFORE UPDATE
ON ai_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
automation_workflows_updated_at
ON automation_workflows;

CREATE TRIGGER
automation_workflows_updated_at
BEFORE UPDATE
ON automation_workflows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
automation_runs_updated_at
ON automation_runs;

CREATE TRIGGER
automation_runs_updated_at
BEFORE UPDATE
ON automation_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
production_projects_updated_at
ON production_projects;

CREATE TRIGGER
production_projects_updated_at
BEFORE UPDATE
ON production_projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
social_accounts_updated_at
ON social_accounts;

CREATE TRIGGER
social_accounts_updated_at
BEFORE UPDATE
ON social_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
social_posts_updated_at
ON social_posts;

CREATE TRIGGER
social_posts_updated_at
BEFORE UPDATE
ON social_posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


/*
|--------------------------------------------------------------------------
| System Roles
|--------------------------------------------------------------------------
*/

INSERT INTO roles (
    organization_id,
    name,
    slug,
    description,
    is_system
)
VALUES
(
    NULL,
    'Super Administrator',
    'super_admin',
    'صلاحيات النظام الكاملة',
    TRUE
),
(
    NULL,
    'Administrator',
    'admin',
    'إدارة المنصة',
    TRUE
),
(
    NULL,
    'Editor',
    'editor',
    'إدارة وتحرير المحتوى',
    TRUE
),
(
    NULL,
    'Author',
    'author',
    'إنشاء المحتوى',
    TRUE
),
(
    NULL,
    'Producer',
    'producer',
    'إدارة الإنتاج الإعلامي',
    TRUE
),
(
    NULL,
    'Analyst',
    'analyst',
    'الوصول إلى التحليلات',
    TRUE
),
(
    NULL,
    'Viewer',
    'viewer',
    'صلاحيات المشاهدة',
    TRUE
)
ON CONFLICT (
    organization_id,
    slug
)
DO NOTHING;


/*
|--------------------------------------------------------------------------
| System Permissions
|--------------------------------------------------------------------------
*/

INSERT INTO permissions (
    name,
    resource,
    action,
    description
)
VALUES

(
    'system.read',
    'system',
    'read',
    'قراءة بيانات النظام'
),

(
    'system.manage',
    'system',
    'manage',
    'إدارة النظام'
),

(
    'users.read',
    'users',
    'read',
    'قراءة المستخدمين'
),

(
    'users.create',
    'users',
    'create',
    'إنشاء المستخدمين'
),

(
    'users.update',
    'users',
    'update',
    'تعديل المستخدمين'
),

(
    'users.delete',
    'users',
    'delete',
    'حذف المستخدمين'
),

(
    'roles.read',
    'roles',
    'read',
    'قراءة الأدوار'
),

(
    'roles.manage',
    'roles',
    'manage',
    'إدارة الأدوار'
),

(
    'content.read',
    'content',
    'read',
    'قراءة المحتوى'
),

(
    'content.create',
    'content',
    'create',
    'إنشاء المحتوى'
),

(
    'content.update',
    'content',
    'update',
    'تعديل المحتوى'
),

(
    'content.delete',
    'content',
    'delete',
    'حذف المحتوى'
),

(
    'content.publish',
    'content',
    'publish',
    'نشر المحتوى'
),

(
    'media.read',
    'media',
    'read',
    'قراءة الوسائط'
),

(
    'media.upload',
    'media',
    'upload',
    'رفع الوسائط'
),

(
    'media.manage',
    'media',
    'manage',
    'إدارة الوسائط'
),

(
    'ai.read',
    'ai',
    'read',
    'قراءة خدمات الذكاء الاصطناعي'
),

(
    'ai.execute',
    'ai',
    'execute',
    'تشغيل مهام الذكاء الاصطناعي'
),

(
    'automation.read',
    'automation',
    'read',
    'قراءة الأتمتة'
),

(
    'automation.manage',
    'automation',
    'manage',
    'إدارة الأتمتة'
),

(
    'production.read',
    'production',
    'read',
    'قراءة مشاريع الإنتاج'
),

(
    'production.manage',
    'production',
    'manage',
    'إدارة الإنتاج'
),

(
    'social.read',
    'social',
    'read',
    'قراءة الحسابات الاجتماعية'
),

(
    'social.manage',
    'social',
    'manage',
    'إدارة الحسابات الاجتماعية'
),

(
    'social.publish',
    'social',
    'publish',
    'النشر على المنصات الاجتماعية'
),

(
    'analytics.read',
    'analytics',
    'read',
    'قراءة التحليلات'
),

(
    'audit.read',
    'audit',
    'read',
    'قراءة سجل التدقيق'
)

ON CONFLICT (
    name
)
DO NOTHING;


/*
|--------------------------------------------------------------------------
| Super Admin Permissions
|--------------------------------------------------------------------------
*/

INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
CROSS JOIN permissions p
WHERE
    r.slug = 'super_admin'
    AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;


/*
|--------------------------------------------------------------------------
| Admin Permissions
|--------------------------------------------------------------------------
*/

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
        'roles.read',
        'roles.manage',
        'content.read',
        'content.create',
        'content.update',
        'content.delete',
        'content.publish',
        'media.read',
        'media.upload',
        'media.manage',
        'ai.read',
        'ai.execute',
        'automation.read',
        'automation.manage',
        'production.read',
        'production.manage',
        'social.read',
        'social.manage',
        'social.publish',
        'analytics.read',
        'audit.read'
    )
WHERE
    r.slug = 'admin'
    AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;


/*
|--------------------------------------------------------------------------
| Editor Permissions
|--------------------------------------------------------------------------
*/

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
        'content.read',
        'content.create',
        'content.update',
        'content.delete',
        'content.publish',
        'media.read',
        'media.upload',
        'media.manage',
        'production.read',
        'production.manage',
        'analytics.read'
    )
WHERE
    r.slug = 'editor'
    AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;


/*
|--------------------------------------------------------------------------
| Author Permissions
|--------------------------------------------------------------------------
*/

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
        'content.read',
        'content.create',
        'content.update',
        'media.read',
        'media.upload'
    )
WHERE
    r.slug = 'author'
    AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;


/*
|--------------------------------------------------------------------------
| Producer Permissions
|--------------------------------------------------------------------------
*/

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
        'content.read',
        'content.create',
        'content.update',
        'media.read',
        'media.upload',
        'media.manage',
        'production.read',
        'production.manage'
    )
WHERE
    r.slug = 'producer'
    AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;


/*
|--------------------------------------------------------------------------
| Analyst Permissions
|--------------------------------------------------------------------------
*/

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
        'analytics.read',
        'content.read',
        'media.read'
    )
WHERE
    r.slug = 'analyst'
    AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;


/*
|--------------------------------------------------------------------------
| Viewer Permissions
|--------------------------------------------------------------------------
*/

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
        'content.read',
        'media.read'
    )
WHERE
    r.slug = 'viewer'
    AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;
