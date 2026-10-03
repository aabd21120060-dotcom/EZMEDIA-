BEGIN;

-- =========================================================
-- EZ MEDIA 11.0
-- MEDIA PLATFORM OPERATIONAL DATABASE
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- 1. الأقسام الرئيسية
-- =========================================================

CREATE TABLE IF NOT EXISTS media_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    slug VARCHAR(120) NOT NULL UNIQUE,
    name_ar VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),

    description_ar TEXT,
    description_en TEXT,

    icon VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_sections_active
ON media_sections(is_active);

CREATE INDEX IF NOT EXISTS idx_media_sections_sort
ON media_sections(sort_order);

-- =========================================================
-- 2. مساحات العمل
-- =========================================================

CREATE TABLE IF NOT EXISTS media_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    slug VARCHAR(150) NOT NULL,

    description TEXT,

    workspace_type VARCHAR(50)
        NOT NULL DEFAULT 'newsroom',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        organization_id,
        slug
    )
);

CREATE INDEX IF NOT EXISTS idx_media_workspaces_org
ON media_workspaces(organization_id);

-- =========================================================
-- 3. القصص
-- =========================================================

CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    workspace_id UUID
        REFERENCES media_workspaces(id)
        ON DELETE SET NULL,

    section_id UUID
        REFERENCES media_sections(id)
        ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,

    slug VARCHAR(500),

    summary TEXT,
    content TEXT,

    status VARCHAR(40)
        NOT NULL DEFAULT 'draft',

    priority VARCHAR(30)
        NOT NULL DEFAULT 'normal',

    source_type VARCHAR(50),

    author_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    editor_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    published_at TIMESTAMPTZ,

    scheduled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_org
ON stories(organization_id);

CREATE INDEX IF NOT EXISTS idx_stories_section
ON stories(section_id);

CREATE INDEX IF NOT EXISTS idx_stories_status
ON stories(status);

CREATE INDEX IF NOT EXISTS idx_stories_published
ON stories(published_at);

-- =========================================================
-- 4. إصدارات القصص
-- =========================================================

CREATE TABLE IF NOT EXISTS story_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES stories(id)
        ON DELETE CASCADE,

    version_number INTEGER NOT NULL,

    title VARCHAR(500),
    summary TEXT,
    content TEXT,

    changed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    change_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        story_id,
        version_number
    )
);

-- =========================================================
-- 5. مهام الذكاء الاصطناعي
-- =========================================================

CREATE TABLE IF NOT EXISTS ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    agent_id UUID
        REFERENCES ai_agents(id)
        ON DELETE SET NULL,

    entity_type VARCHAR(100),
    entity_id UUID,

    task_type VARCHAR(100) NOT NULL,

    status VARCHAR(40)
        NOT NULL DEFAULT 'queued',

    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    output JSONB NOT NULL DEFAULT '{}'::jsonb,

    error_message TEXT,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_status
ON ai_runs(status);

CREATE INDEX IF NOT EXISTS idx_ai_runs_entity
ON ai_runs(entity_type, entity_id);

-- =========================================================
-- 6. مهام النشر
-- =========================================================

CREATE TABLE IF NOT EXISTS publishing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    story_id UUID
        REFERENCES stories(id)
        ON DELETE CASCADE,

    media_asset_id UUID
        REFERENCES media_assets(id)
        ON DELETE SET NULL,

    platform VARCHAR(100) NOT NULL,

    destination_id UUID,

    content_type VARCHAR(50),

    status VARCHAR(40)
        NOT NULL DEFAULT 'queued',

    scheduled_at TIMESTAMPTZ,

    published_at TIMESTAMPTZ,

    external_id VARCHAR(300),

    response JSONB NOT NULL DEFAULT '{}'::jsonb,

    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_status
ON publishing_jobs(status);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_story
ON publishing_jobs(story_id);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_platform
ON publishing_jobs(platform);

-- =========================================================
-- 7. حسابات ومنصات التواصل
-- =========================================================

CREATE TABLE IF NOT EXISTS social_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    social_account_id UUID
        REFERENCES social_accounts(id)
        ON DELETE CASCADE,

    platform VARCHAR(100) NOT NULL,

    account_name VARCHAR(200),

    account_identifier VARCHAR(300),

    status VARCHAR(40)
        NOT NULL DEFAULT 'disconnected',

    capabilities JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    last_sync_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_destinations_org
ON social_destinations(organization_id);

CREATE INDEX IF NOT EXISTS idx_social_destinations_platform
ON social_destinations(platform);

-- =========================================================
-- 8. جلسات البث المباشر
-- =========================================================

CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,

    description TEXT,

    status VARCHAR(40)
        NOT NULL DEFAULT 'scheduled',

    stream_key_hash TEXT,

    ingest_protocol VARCHAR(30)
        NOT NULL DEFAULT 'rtmp',

    ingest_url TEXT,

    started_at TIMESTAMPTZ,

    ended_at TIMESTAMPTZ,

    recording_media_id UUID
        REFERENCES media_assets(id)
        ON DELETE SET NULL,

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status
ON live_sessions(status);

-- =========================================================
-- 9. وجهات البث
-- =========================================================

CREATE TABLE IF NOT EXISTS live_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    live_session_id UUID NOT NULL
        REFERENCES live_sessions(id)
        ON DELETE CASCADE,

    platform VARCHAR(100) NOT NULL,

    destination_name VARCHAR(200),

    status VARCHAR(40)
        NOT NULL DEFAULT 'pending',

    external_stream_id VARCHAR(300),

    started_at TIMESTAMPTZ,

    ended_at TIMESTAMPTZ,

    viewer_count INTEGER NOT NULL DEFAULT 0,

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_destinations_session
ON live_destinations(live_session_id);

-- =========================================================
-- 10. مشاريع التصميم والإنتاج
-- =========================================================

CREATE TABLE IF NOT EXISTS production_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    project_type VARCHAR(100) NOT NULL,

    title VARCHAR(500) NOT NULL,

    description TEXT,

    status VARCHAR(40)
        NOT NULL DEFAULT 'draft',

    priority VARCHAR(30)
        NOT NULL DEFAULT 'normal',

    aspect_ratio VARCHAR(30),

    deadline TIMESTAMPTZ,

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_projects_status
ON production_projects(status);

-- =========================================================
-- 11. مهام الإنتاج
-- =========================================================

CREATE TABLE IF NOT EXISTS production_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES production_projects(id)
        ON DELETE CASCADE,

    assigned_to UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,

    description TEXT,

    task_type VARCHAR(100),

    status VARCHAR(40)
        NOT NULL DEFAULT 'pending',

    priority VARCHAR(30)
        NOT NULL DEFAULT 'normal',

    due_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_tasks_project
ON production_tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_production_tasks_assigned
ON production_tasks(assigned_to);

-- =========================================================
-- 12. الحملات الإعلانية
-- =========================================================

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    advertiser_name VARCHAR(300) NOT NULL,

    campaign_name VARCHAR(500) NOT NULL,

    status VARCHAR(40)
        NOT NULL DEFAULT 'draft',

    budget NUMERIC(14,2)
        NOT NULL DEFAULT 0,

    currency VARCHAR(10)
        NOT NULL DEFAULT 'SAR',

    start_at TIMESTAMPTZ,

    end_at TIMESTAMPTZ,

    target_audience JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    placements JSONB
        NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status
ON ad_campaigns(status);

-- =========================================================
-- 13. الرعايات والشراكات
-- =========================================================

CREATE TABLE IF NOT EXISTS sponsorship_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    sponsor_name VARCHAR(300) NOT NULL,

    contract_name VARCHAR(500) NOT NULL,

    status VARCHAR(40)
        NOT NULL DEFAULT 'draft',

    contract_value NUMERIC(14,2)
        NOT NULL DEFAULT 0,

    currency VARCHAR(10)
        NOT NULL DEFAULT 'SAR',

    start_at TIMESTAMPTZ,

    end_at TIMESTAMPTZ,

    deliverables JSONB
        NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_status
ON sponsorship_contracts(status);

-- =========================================================
-- 14. أحداث التحليلات
-- =========================================================

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    event_name VARCHAR(200) NOT NULL,

    entity_type VARCHAR(100),

    entity_id UUID,

    platform VARCHAR(100),

    session_id VARCHAR(300),

    metadata JSONB
        NOT NULL DEFAULT '{}'::jsonb,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name
ON analytics_events(event_name);

CREATE INDEX IF NOT EXISTS idx_analytics_events_entity
ON analytics_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_time
ON analytics_events(occurred_at);

-- =========================================================
-- 15. الأقسام الـ50
-- =========================================================

INSERT INTO media_sections
(
    slug,
    name_ar,
    name_en,
    sort_order
)
VALUES

('home', 'الرئيسية', 'Home', 1),

('breaking', 'عاجل', 'Breaking News', 2),

('saudi', 'أخبار السعودية', 'Saudi Arabia', 3),

('madinah', 'أخبار المدينة المنورة', 'Madinah', 4),

('regions', 'أخبار المناطق', 'Regions', 5),

('gulf', 'أخبار الخليج', 'Gulf', 6),

('world', 'أخبار العالم', 'World', 7),

('economy', 'الاقتصاد', 'Economy', 8),

('business-investment', 'الأعمال والاستثمار', 'Business & Investment', 9),

('technology', 'التقنية', 'Technology', 10),

('artificial-intelligence', 'الذكاء الاصطناعي', 'Artificial Intelligence', 11),

('cybersecurity', 'الأمن السيبراني', 'Cybersecurity', 12),

('media', 'الإعلام', 'Media', 13),

('culture', 'الثقافة', 'Culture', 14),

('arts', 'الفنون', 'Arts', 15),

('entertainment', 'الترفيه', 'Entertainment', 16),

('sports', 'الرياضة', 'Sports', 17),

('tourism', 'السياحة', 'Tourism', 18),

('travel', 'السفر', 'Travel', 19),

('society', 'المجتمع', 'Society', 20),

('health', 'الصحة', 'Health', 21),

('education', 'التعليم', 'Education', 22),

('environment', 'البيئة', 'Environment', 23),

('weather', 'الطقس', 'Weather', 24),

('cars', 'السيارات', 'Cars', 25),

('real-estate', 'العقار', 'Real Estate', 26),

('companies', 'الشركات', 'Companies', 27),

('entrepreneurship', 'ريادة الأعمال', 'Entrepreneurship', 28),

('innovation', 'الابتكار', 'Innovation', 29),

('events', 'الفعاليات', 'Events', 30),

('conferences', 'المؤتمرات', 'Conferences', 31),

('field-coverage', 'التغطيات الميدانية', 'Field Coverage', 32),

('investigations', 'التحقيقات', 'Investigations', 33),

('reports', 'التقارير', 'Reports', 34),

('interviews', 'المقابلات', 'Interviews', 35),

('video', 'الفيديو', 'Video', 36),

('podcast', 'البودكاست', 'Podcast', 37),

('audio', 'الصوتيات', 'Audio', 38),

('photos', 'الصور', 'Photos', 39),

('live', 'البث المباشر', 'Live', 40),

('human-stories', 'القصص الإنسانية', 'Human Stories', 41),

('opinion', 'الرأي', 'Opinion', 42),

('infographic', 'إنفوغرافيك', 'Infographic', 43),

('special-files', 'ملفات خاصة', 'Special Files', 44),

('archive', 'أرشيف EZ MEDIA', 'EZ MEDIA Archive', 45),

('newsletter', 'النشرات البريدية', 'Newsletter', 46),

('social', 'منصات التواصل', 'Social Platforms', 47),

('advertising', 'الإعلانات', 'Advertising', 48),

('sponsorships', 'الرعاية والشراكات', 'Sponsorships', 49),

('my-content', 'محتواي', 'My Content', 50)

ON CONFLICT (slug)
DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- =========================================================
-- 16. وكلاء الذكاء الاصطناعي
-- =========================================================

INSERT INTO ai_agents
(
    name,
    slug,
    status,
    description
)
VALUES

(
    'News Scout',
    'news-scout',
    'active',
    'اكتشاف الأخبار والمصادر والمواضيع الجديدة'
),

(
    'Research Agent',
    'research-agent',
    'active',
    'البحث وتجميع المعلومات والمصادر'
),

(
    'Fact Check Agent',
    'fact-check-agent',
    'active',
    'فحص المعلومات والمصادر قبل النشر'
),

(
    'Editor Agent',
    'editor-agent',
    'active',
    'تحرير الأخبار والمقالات والعناوين'
),

(
    'Design Agent',
    'design-agent',
    'active',
    'المساعدة في إنتاج التصاميم والمحتوى البصري'
),

(
    'Video Agent',
    'video-agent',
    'active',
    'تحليل وإنتاج محتوى الفيديو'
),

(
    'Audio Agent',
    'audio-agent',
    'active',
    'معالجة الصوت والتفريغ والبودكاست'
),

(
    'Translation Agent',
    'translation-agent',
    'active',
    'ترجمة المحتوى إلى اللغات المختلفة'
),

(
    'Social Agent',
    'social-agent',
    'active',
    'تحويل المحتوى إلى منشورات لمنصات التواصل'
),

(
    'SEO AEO GEO Agent',
    'seo-aeo-geo-agent',
    'active',
    'تحسين ظهور المحتوى في محركات البحث ومحركات الإجابات والذكاء الاصطناعي'
),

(
    'Analytics Agent',
    'analytics-agent',
    'active',
    'تحليل الجمهور والأداء والمحتوى'
),

(
    'Revenue Agent',
    'revenue-agent',
    'active',
    'تحليل الإعلانات والرعاية وفرص الإيرادات'
),

(
    'Archive Agent',
    'archive-agent',
    'active',
    'تصنيف وأرشفة المحتوى والوسائط'
),

(
    'AI Orchestrator',
    'ai-orchestrator',
    'active',
    'تنسيق وتشغيل وكلاء الذكاء الاصطناعي'
)

ON CONFLICT DO NOTHING;

-- =========================================================
-- 17. سجل الترحيل
-- =========================================================

INSERT INTO schema_migrations
(
    version
)
VALUES
(
    '004_media_platform'
)
ON CONFLICT DO NOTHING;

COMMIT;
