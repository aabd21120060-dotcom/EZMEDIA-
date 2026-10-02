-- ============================================================
-- AZ MEDIA 11.0
-- Migration 001
-- Security + RBAC + Refresh Tokens + Indexes + Audit
-- PostgreSQL
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 2. REFRESH TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash CHAR(64) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
ON refresh_tokens(user_id, expires_at)
WHERE revoked_at IS NULL;


-- ============================================================
-- 3. USER ROLE INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_role
ON user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
ON role_permissions(permission_id);


-- ============================================================
-- 4. ORGANIZATION INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_organizations_status
ON organizations(status);

CREATE INDEX IF NOT EXISTS idx_organizations_created
ON organizations(created_at DESC);


-- ============================================================
-- 5. USERS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_org_status
ON users(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_users_org_created
ON users(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);


-- ============================================================
-- 6. ARTICLES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_articles_org_status_created
ON articles(
    organization_id,
    status,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_articles_org_published
ON articles(
    organization_id,
    published_at DESC
)
WHERE published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_author
ON articles(author_id);


-- ============================================================
-- 7. MEDIA
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_media_org_type
ON media_assets(
    organization_id,
    type
);

CREATE INDEX IF NOT EXISTS idx_media_org_created
ON media_assets(
    organization_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_media_mime_type
ON media_assets(mime_type);


-- ============================================================
-- 8. AI AGENTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_agents_org_status
ON ai_agents(
    organization_id,
    status
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_org_role
ON ai_agents(
    organization_id,
    role
);


-- ============================================================
-- 9. AUTOMATION WORKFLOWS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workflows_org_status
ON automation_workflows(
    organization_id,
    status
);

CREATE INDEX IF NOT EXISTS idx_workflows_org_created
ON automation_workflows(
    organization_id,
    created_at DESC
);


-- ============================================================
-- 10. AUTOMATION RUNS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_automation_runs_workflow
ON automation_runs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status
ON automation_runs(status);

CREATE INDEX IF NOT EXISTS idx_automation_runs_created
ON automation_runs(created_at DESC);


-- ============================================================
-- 11. PRODUCTION PROJECTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_production_org_status
ON production_projects(
    organization_id,
    status
);

CREATE INDEX IF NOT EXISTS idx_production_org_created
ON production_projects(
    organization_id,
    created_at DESC
);


-- ============================================================
-- 12. SOCIAL POSTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_social_org_status
ON social_posts(
    organization_id,
    status
);

CREATE INDEX IF NOT EXISTS idx_social_scheduled
ON social_posts(
    organization_id,
    scheduled_at
)
WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_published
ON social_posts(
    organization_id,
    published_at DESC
)
WHERE published_at IS NOT NULL;


-- ============================================================
-- 13. AUDIT LOGS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_org_created
ON audit_logs(
    organization_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created
ON audit_logs(
    user_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_audit_resource
ON audit_logs(
    resource_type,
    resource_id
);

CREATE INDEX IF NOT EXISTS idx_audit_action
ON audit_logs(action);


-- ============================================================
-- 14. EVENT LOG
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_org_created
ON event_log(
    organization_id,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_event_type_created
ON event_log(
    event_type,
    created_at DESC
);


-- ============================================================
-- 15. STATUS VALIDATION
-- ============================================================

ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_status_check;

ALTER TABLE organizations
ADD CONSTRAINT organizations_status_check
CHECK (
    status IN (
        'active',
        'inactive',
        'suspended',
        'deleted'
    )
);


ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users
ADD CONSTRAINT users_status_check
CHECK (
    status IN (
        'active',
        'inactive',
        'suspended',
        'pending'
    )
);


ALTER TABLE articles
DROP CONSTRAINT IF EXISTS articles_status_check;

ALTER TABLE articles
ADD CONSTRAINT articles_status_check
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
);


ALTER TABLE ai_agents
DROP CONSTRAINT IF EXISTS ai_agents_status_check;

ALTER TABLE ai_agents
ADD CONSTRAINT ai_agents_status_check
CHECK (
    status IN (
        'active',
        'inactive',
        'paused',
        'archived'
    )
);


ALTER TABLE ai_agents
DROP CONSTRAINT IF EXISTS ai_agents_autonomy_level_check;

ALTER TABLE ai_agents
ADD CONSTRAINT ai_agents_autonomy_level_check
CHECK (
    autonomy_level IN (
        'auto',
        'approval',
        'human_only'
    )
);


ALTER TABLE automation_workflows
DROP CONSTRAINT IF EXISTS automation_workflows_status_check;

ALTER TABLE automation_workflows
ADD CONSTRAINT automation_workflows_status_check
CHECK (
    status IN (
        'draft',
        'ready',
        'running',
        'paused',
        'archived'
    )
);


ALTER TABLE automation_runs
DROP CONSTRAINT IF EXISTS automation_runs_status_check;

ALTER TABLE automation_runs
ADD CONSTRAINT automation_runs_status_check
CHECK (
    status IN (
        'queued',
        'running',
        'waiting',
        'waiting_approval',
        'retrying',
        'failed',
        'completed',
        'cancelled'
    )
);


ALTER TABLE production_projects
DROP CONSTRAINT IF EXISTS production_projects_status_check;

ALTER TABLE production_projects
ADD CONSTRAINT production_projects_status_check
CHECK (
    status IN (
        'draft',
        'planning',
        'production',
        'review',
        'approved',
        'completed',
        'cancelled',
        'archived'
    )
);


ALTER TABLE social_posts
DROP CONSTRAINT IF EXISTS social_posts_status_check;

ALTER TABLE social_posts
ADD CONSTRAINT social_posts_status_check
CHECK (
    status IN (
        'draft',
        'scheduled',
        'publishing',
        'published',
        'failed',
        'cancelled'
    )
);


-- ============================================================
-- 16. REFRESH TOKEN VALIDATION
-- ============================================================

ALTER TABLE refresh_tokens
DROP CONSTRAINT IF EXISTS refresh_tokens_expiration_check;

ALTER TABLE refresh_tokens
ADD CONSTRAINT refresh_tokens_expiration_check
CHECK (
    expires_at > created_at
);


-- ============================================================
-- 17. ROLE PERMISSIONS
-- ============================================================

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


-- ============================================================
-- 18. ADMIN PERMISSIONS
-- ============================================================

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
        'articles.publish',
        'media.read',
        'media.upload',
        'production.manage',
        'ai.execute',
        'automation.execute',
        'social.publish',
        'admin.manage'
    )
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 19. EDITOR PERMISSIONS
-- ============================================================

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
        'articles.publish',
        'media.read',
        'media.upload'
    )
WHERE r.name = 'editor'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 20. PRODUCER PERMISSIONS
-- ============================================================

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
        'production.manage',
        'ai.execute'
    )
WHERE r.name = 'producer'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 21. DESIGNER PERMISSIONS
-- ============================================================

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
        'production.manage',
        'ai.execute'
    )
WHERE r.name = 'designer'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 22. SOCIAL MANAGER PERMISSIONS
-- ============================================================

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
        'social.publish',
        'analytics.read'
    )
WHERE r.name = 'social_manager'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 23. VIEWER PERMISSIONS
-- ============================================================

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
        'media.read'
    )
WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 24. MISSING ANALYTICS PERMISSION
-- ============================================================

INSERT INTO permissions (
    name,
    description
)
VALUES (
    'analytics.read',
    'قراءة التحليلات'
)
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- 25. RE-APPLY SOCIAL MANAGER ANALYTICS PERMISSION
-- ============================================================

INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles r
JOIN permissions p
    ON p.name = 'analytics.read'
WHERE r.name = 'social_manager'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 26. UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 27. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_organizations_updated_at
ON organizations;

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_users_updated_at
ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_articles_updated_at
ON articles;

CREATE TRIGGER trg_articles_updated_at
BEFORE UPDATE ON articles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_media_assets_updated_at
ON media_assets;

CREATE TRIGGER trg_media_assets_updated_at
BEFORE UPDATE ON media_assets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_ai_agents_updated_at
ON ai_agents;

CREATE TRIGGER trg_ai_agents_updated_at
BEFORE UPDATE ON ai_agents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_automation_workflows_updated_at
ON automation_workflows;

CREATE TRIGGER trg_automation_workflows_updated_at
BEFORE UPDATE ON automation_workflows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_production_projects_updated_at
ON production_projects;

CREATE TRIGGER trg_production_projects_updated_at
BEFORE UPDATE ON production_projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_social_posts_updated_at
ON social_posts;

CREATE TRIGGER trg_social_posts_updated_at
BEFORE UPDATE ON social_posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 28. CLEAN EXPIRED REFRESH TOKENS
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN

    DELETE FROM refresh_tokens
    WHERE expires_at < NOW()
       OR revoked_at IS NOT NULL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;


-- ============================================================
-- 29. SECURITY COMMENTS
-- ============================================================

COMMENT ON TABLE refresh_tokens IS
'AZ MEDIA authentication refresh token storage. Tokens are stored as SHA-256 hashes.';

COMMENT ON TABLE role_permissions IS
'RBAC mapping between system roles and permissions.';

COMMENT ON TABLE audit_logs IS
'Immutable-style application audit trail. Application layer must record administrative actions.';


-- ============================================================
-- 30. FINAL
-- ============================================================

COMMIT;
