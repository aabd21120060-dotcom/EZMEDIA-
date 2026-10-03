import { Router } from "express";
import env from "../config/env.js";
import { query, isDatabaseConfigured } from "../config/database.js";

const router = Router();

/*
 * =========================================================
 * EZ MEDIA 11.0
 * PLATFORM ROUTES
 * =========================================================
 *
 * المسار الرئيسي:
 * /api/platform
 *
 * هذا الملف مسؤول عن طبقة المنصة التشغيلية:
 *
 * - حالة المنصة
 * - الأقسام
 * - الذكاء الاصطناعي
 * - القصص
 * - المحتوى
 * - الوسائط
 * - الإنتاج
 * - الأتمتة
 * - البث
 * - الإيرادات
 * - التحليلات
 * - المستخدمين
 * - الإدارة
 * - البحث
 * - لوحة التحكم
 *
 * =========================================================
 */


/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function now() {
  return new Date().toISOString();
}

function requestId(req) {
  return req.requestId || null;
}

function cleanString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function positiveInteger(value, fallback = 20, max = 100) {
  const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number) || number < 1) {
    return fallback;
  }

  return Math.min(number, max);
}

function offsetValue(value, fallback = 0) {
  const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return number;
}

function organizationIdFromRequest(req) {
  return (
    cleanString(req.query.organizationId) ||
    cleanString(req.body?.organizationId) ||
    null
  );
}

async function safeQuery(text, params = []) {
  if (!isDatabaseConfigured()) {
    return {
      connected: false,
      rows: [],
      error: "DATABASE_NOT_CONFIGURED"
    };
  }

  try {
    const result = await query(text, params);

    return {
      connected: true,
      rows: result.rows || [],
      error: null
    };
  } catch (error) {
    console.error("EZ MEDIA PLATFORM DATABASE ERROR:", error);

    return {
      connected: true,
      rows: [],
      error: error.message
    };
  }
}

function databaseUnavailable(res, req) {
  return res.status(503).json({
    error: "DATABASE_UNAVAILABLE",
    message: "قاعدة البيانات غير متاحة حاليًا",
    platform: env.platform,
    version: env.version,
    requestId: requestId(req),
    timestamp: now()
  });
}


/*
 * =========================================================
 * PLATFORM ROOT
 * =========================================================
 */

router.get("/", async (req, res) => {
  const database = await safeQuery(`
    SELECT
      current_database() AS database_name,
      NOW() AS server_time
  `);

  return res.json({
    platform: env.platform,
    version: env.version,

    module: "platform",

    status: "online",

    server: {
      node: process.version,
      environment: env.nodeEnv,
      uptime: process.uptime()
    },

    database: {
      configured: isDatabaseConfigured(),
      connected: database.connected && !database.error,
      databaseName:
        database.rows[0]?.database_name || null,
      serverTime:
        database.rows[0]?.server_time || null
    },

    modules: {
      system: true,
      sections: true,
      ai: true,
      stories: true,
      content: true,
      media: true,
      production: true,
      automation: true,
      live: true,
      revenue: true,
      analytics: true,
      users: true,
      administration: true,
      search: true,
      dashboard: true
    },

    endpoints: {
      system: "/api/platform/system",
      sections: "/api/platform/sections",
      ai: "/api/platform/ai",
      stories: "/api/platform/stories",
      content: "/api/platform/content",
      media: "/api/platform/media",
      production: "/api/platform/production",
      automation: "/api/platform/automation",
      live: "/api/platform/live",
      revenue: "/api/platform/revenue",
      analytics: "/api/platform/analytics",
      users: "/api/platform/users",
      admin: "/api/platform/admin/overview",
      stats: "/api/platform/stats",
      search: "/api/platform/search",
      dashboard: "/api/platform/dashboard"
    },

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * SYSTEM
 * =========================================================
 */

router.get("/system", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      NOW() AS server_time
  `);

  return res.json({
    platform: env.platform,
    version: env.version,

    status:
      result.error
        ? "degraded"
        : "online",

    server: {
      node: process.version,
      environment: env.nodeEnv,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },

    database: {
      configured: isDatabaseConfigured(),
      connected: Boolean(
        result.connected &&
        !result.error
      ),
      databaseName:
        result.rows[0]?.database_name || null,
      databaseUser:
        result.rows[0]?.database_user || null,
      serverTime:
        result.rows[0]?.server_time || null,
      error:
        env.nodeEnv === "production"
          ? undefined
          : result.error
    },

    features: {
      api: true,
      cms: true,
      stories: true,
      mediaLibrary: true,
      production: true,
      ai: true,
      automation: true,
      advertising: true,
      sponsorships: true,
      socialPlatforms: true,
      liveStreaming: true,
      analytics: true,
      administration: true,
      postgres: Boolean(
        result.connected &&
        !result.error
      )
    },

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * 50 MEDIA SECTIONS
 * =========================================================
 */

const sections = [
  {
    id: 1,
    slug: "home",
    name: "الرئيسية"
  },
  {
    id: 2,
    slug: "breaking",
    name: "عاجل"
  },
  {
    id: 3,
    slug: "saudi",
    name: "أخبار السعودية"
  },
  {
    id: 4,
    slug: "madinah",
    name: "أخبار المدينة المنورة"
  },
  {
    id: 5,
    slug: "regions",
    name: "أخبار المناطق"
  },
  {
    id: 6,
    slug: "gulf",
    name: "أخبار الخليج"
  },
  {
    id: 7,
    slug: "world",
    name: "أخبار العالم"
  },
  {
    id: 8,
    slug: "economy",
    name: "الاقتصاد"
  },
  {
    id: 9,
    slug: "business",
    name: "الأعمال والاستثمار"
  },
  {
    id: 10,
    slug: "technology",
    name: "التقنية"
  },
  {
    id: 11,
    slug: "ai",
    name: "الذكاء الاصطناعي"
  },
  {
    id: 12,
    slug: "cybersecurity",
    name: "الأمن السيبراني"
  },
  {
    id: 13,
    slug: "media",
    name: "الإعلام"
  },
  {
    id: 14,
    slug: "culture",
    name: "الثقافة"
  },
  {
    id: 15,
    slug: "arts",
    name: "الفنون"
  },
  {
    id: 16,
    slug: "entertainment",
    name: "الترفيه"
  },
  {
    id: 17,
    slug: "sports",
    name: "الرياضة"
  },
  {
    id: 18,
    slug: "tourism",
    name: "السياحة"
  },
  {
    id: 19,
    slug: "travel",
    name: "السفر"
  },
  {
    id: 20,
    slug: "society",
    name: "المجتمع"
  },
  {
    id: 21,
    slug: "health",
    name: "الصحة"
  },
  {
    id: 22,
    slug: "education",
    name: "التعليم"
  },
  {
    id: 23,
    slug: "environment",
    name: "البيئة"
  },
  {
    id: 24,
    slug: "weather",
    name: "الطقس"
  },
  {
    id: 25,
    slug: "cars",
    name: "السيارات"
  },
  {
    id: 26,
    slug: "real-estate",
    name: "العقار"
  },
  {
    id: 27,
    slug: "companies",
    name: "الشركات"
  },
  {
    id: 28,
    slug: "entrepreneurship",
    name: "ريادة الأعمال"
  },
  {
    id: 29,
    slug: "innovation",
    name: "الابتكار"
  },
  {
    id: 30,
    slug: "events",
    name: "الفعاليات"
  },
  {
    id: 31,
    slug: "conferences",
    name: "المؤتمرات"
  },
  {
    id: 32,
    slug: "field-coverage",
    name: "التغطيات الميدانية"
  },
  {
    id: 33,
    slug: "investigations",
    name: "التحقيقات"
  },
  {
    id: 34,
    slug: "reports",
    name: "التقارير"
  },
  {
    id: 35,
    slug: "interviews",
    name: "المقابلات"
  },
  {
    id: 36,
    slug: "video",
    name: "الفيديو"
  },
  {
    id: 37,
    slug: "podcast",
    name: "البودكاست"
  },
  {
    id: 38,
    slug: "audio",
    name: "الصوتيات"
  },
  {
    id: 39,
    slug: "photos",
    name: "الصور"
  },
  {
    id: 40,
    slug: "live",
    name: "البث المباشر"
  },
  {
    id: 41,
    slug: "human-stories",
    name: "القصص الإنسانية"
  },
  {
    id: 42,
    slug: "opinion",
    name: "الرأي"
  },
  {
    id: 43,
    slug: "infographic",
    name: "إنفوغرافيك"
  },
  {
    id: 44,
    slug: "special-files",
    name: "ملفات خاصة"
  },
  {
    id: 45,
    slug: "archive",
    name: "أرشيف EZ MEDIA"
  },
  {
    id: 46,
    slug: "newsletter",
    name: "النشرات البريدية"
  },
  {
    id: 47,
    slug: "social",
    name: "منصات التواصل"
  },
  {
    id: 48,
    slug: "advertising",
    name: "الإعلانات"
  },
  {
    id: 49,
    slug: "sponsorships",
    name: "الرعاية والشراكات"
  },
  {
    id: 50,
    slug: "my-content",
    name: "محتواي"
  }
];


/*
 * =========================================================
 * SECTIONS
 * =========================================================
 */

router.get("/sections", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      id,
      slug,
      name,
      description,
      is_active,
      created_at
    FROM media_sections
    ORDER BY id ASC
  `);

  if (!result.error && result.rows.length) {
    return res.json({
      count: result.rows.length,
      source: "postgresql",
      sections: result.rows,
      requestId: requestId(req),
      timestamp: now()
    });
  }

  return res.json({
    count: sections.length,
    source: "platform",
    sections,
    requestId: requestId(req),
    timestamp: now()
  });
});


router.get("/sections/full", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      id,
      slug,
      name,
      description,
      is_active,
      created_at,
      updated_at
    FROM media_sections
    ORDER BY id ASC
  `);

  return res.json({
    count:
      result.rows.length ||
      sections.length,

    source:
      result.rows.length
        ? "postgresql"
        : "platform",

    sections:
      result.rows.length
        ? result.rows
        : sections,

    requestId: requestId(req),
    timestamp: now()
  });
});


router.get("/sections/:slug", async (req, res) => {
  const slug = cleanString(
    req.params.slug
  );

  const result = await safeQuery(`
    SELECT
      id,
      slug,
      name,
      description,
      is_active,
      created_at,
      updated_at
    FROM media_sections
    WHERE slug = $1
    LIMIT 1
  `, [slug]);

  if (result.rows[0]) {
    return res.json({
      source: "postgresql",
      section: result.rows[0],
      requestId: requestId(req),
      timestamp: now()
    });
  }

  const section = sections.find(
    item => item.slug === slug
  );

  if (!section) {
    return res.status(404).json({
      error: "SECTION_NOT_FOUND",
      message: "القسم غير موجود",
      requestId: requestId(req),
      timestamp: now()
    });
  }

  return res.json({
    source: "platform",
    section,
    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * AI
 * =========================================================
 */

router.get("/ai", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      id,
      name,
      slug,
      description,
      provider,
      model,
      capabilities,
      is_active,
      created_at
    FROM ai_agents
    ORDER BY id ASC
  `);

  return res.json({
    module: "ai",

    status:
      result.error
        ? "database_unavailable"
        : "ready",

    agents: result.rows,

    capabilities: [
      "news_scout",
      "research",
      "fact_check",
      "editor",
      "headline_generation",
      "summarization",
      "translation",
      "seo",
      "aeo",
      "geo",
      "design",
      "video",
      "audio",
      "social",
      "analytics",
      "revenue",
      "archive",
      "orchestration"
    ],

    humanApproval: true,

    requestId: requestId(req),
    timestamp: now()
  });
});


router.get("/ai/:slug", async (req, res) => {
  const slug = cleanString(
    req.params.slug
  );

  const result = await safeQuery(`
    SELECT
      id,
      name,
      slug,
      description,
      provider,
      model,
      capabilities,
      is_active,
      created_at,
      updated_at
    FROM ai_agents
    WHERE slug = $1
    LIMIT 1
  `, [slug]);

  if (!result.rows[0]) {
    return res.status(404).json({
      error: "AI_AGENT_NOT_FOUND",
      message: "وكيل الذكاء الاصطناعي غير موجود",
      requestId: requestId(req),
      timestamp: now()
    });
  }

  return res.json({
    agent: result.rows[0],
    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * STORIES
 * =========================================================
 */

router.get("/stories", async (req, res) => {
  const limit = positiveInteger(
    req.query.limit,
    20,
    100
  );

  const offset = offsetValue(
    req.query.offset,
    0
  );

  const result = await safeQuery(`
    SELECT
      id,
      organization_id,
      title,
      slug,
      summary,
      status,
      verification_status,
      created_at,
      updated_at
    FROM stories
    ORDER BY created_at DESC
    LIMIT $1
    OFFSET $2
  `, [limit, offset]);

  return res.json({
    module: "stories",
    count: result.rows.length,
    limit,
    offset,
    stories: result.rows,
    requestId: requestId(req),
    timestamp: now()
  });
});


router.get("/stories/recent", async (req, res) => {
  const limit = positiveInteger(
    req.query.limit,
    10,
    50
  );

  const result = await safeQuery(`
    SELECT
      id,
      title,
      slug,
      summary,
      status,
      verification_status,
      created_at
    FROM stories
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  return res.json({
    count: result.rows.length,
    stories: result.rows,
    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * CONTENT
 * =========================================================
 */

router.get("/content", async (req, res) => {
  const organizationId =
    organizationIdFromRequest(req);

  if (!organizationId) {
    return res.json({
      module: "content",
      status: "organization_required",
      message:
        "أرسل organizationId لقراءة المحتوى",
      requestId: requestId(req),
      timestamp: now()
    });
  }

  const limit = positiveInteger(
    req.query.limit,
    20,
    100
  );

  const offset = offsetValue(
    req.query.offset,
    0
  );

  const status =
    cleanString(
      req.query.status
    ) || null;

  const result = await safeQuery(`
    SELECT
      id,
      organization_id,
      author_id,
      title,
      slug,
      excerpt,
      status,
      category,
      tags,
      featured_media_id,
      scheduled_at,
      published_at,
      created_at,
      updated_at
    FROM articles
    WHERE organization_id = $1
      AND ($2::text IS NULL OR status = $2)
    ORDER BY created_at DESC
    LIMIT $3
    OFFSET $4
  `, [
    organizationId,
    status,
    limit,
    offset
  ]);

  if (result.error) {
    return databaseUnavailable(
      res,
      req
    );
  }

  return res.json({
    module: "content",
    status: "connected",
    database: "postgresql",
    count: result.rows.length,
    limit,
    offset,
    articles: result.rows,
    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * MEDIA LIBRARY
 * =========================================================
 */

router.get("/media", async (req, res) => {
  const organizationId =
    organizationIdFromRequest(req);

  if (!organizationId) {
    return res.json({
      module: "media",
      status: "organization_required",

      supportedTypes: [
        "image",
        "video",
        "audio",
        "document"
      ],

      capabilities: [
        "upload",
        "folders",
        "metadata",
        "search",
        "ocr",
        "transcription",
        "tags",
        "rights",
        "archive"
      ],

      requestId: requestId(req),
      timestamp: now()
    });
  }

  const limit = positiveInteger(
    req.query.limit,
    20,
    100
  );

  const offset = offsetValue(
    req.query.offset,
    0
  );

  const type =
    cleanString(req.query.type) ||
    null;

  const result = await safeQuery(`
    SELECT
      id,
      organization_id,
      uploaded_by,
      name,
      original_name,
      type,
      mime_type,
      storage_provider,
      storage_key,
      public_url,
      size_bytes,
      checksum,
      width,
      height,
      duration_seconds,
      metadata,
      status,
      created_at,
      updated_at
    FROM media_assets
    WHERE organization_id = $1
      AND ($2::text IS NULL OR type = $2)
    ORDER BY created_at DESC
    LIMIT $3
    OFFSET $4
  `, [
    organizationId,
    type,
    limit,
    offset
  ]);

  if (result.error) {
    return databaseUnavailable(
      res,
      req
    );
  }

  return res.json({
    module: "media",
    status: "connected",
    database: "postgresql",
    count: result.rows.length,
    media: result.rows,
    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * PRODUCTION
 * =========================================================
 */

router.get("/production", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      id,
      organization_id,
      name,
      description,
      status,
      priority,
      created_by,
      start_date,
      due_date,
      created_at,
      updated_at
    FROM production_projects
    ORDER BY created_at DESC
    LIMIT 100
  `);

  return res.json({
    module: "production",

    projects: result.rows,

    capabilities: [
      "planning",
      "projects",
      "tasks",
      "video",
      "audio",
      "design",
      "motion",
      "editing",
      "field_production",
      "live_production",
      "approval",
      "delivery"
    ],

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * AUTOMATION
 * =========================================================
 */

router.get("/automation", async (req, res) => {
  const workflows = await safeQuery(`
    SELECT
      id,
      organization_id,
      name,
      description,
      status,
      trigger_type,
      created_at,
      updated_at
    FROM automation_workflows
    ORDER BY created_at DESC
    LIMIT 100
  `);

  const runs = await safeQuery(`
    SELECT
      id,
      workflow_id,
      status,
      started_at,
      completed_at,
      created_at
    FROM automation_runs
    ORDER BY created_at DESC
    LIMIT 50
  `);

  return res.json({
    module: "automation",

    status:
      workflows.error
        ? "database_unavailable"
        : "ready",

    workflow: [
      "source",
      "import",
      "detect",
      "classify",
      "research",
      "verify",
      "store",
      "review",
      "publish",
      "distribute",
      "analyze",
      "archive"
    ],

    workflows: workflows.rows,
    recentRuns: runs.rows,

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * LIVE
 * =========================================================
 */

router.get("/live", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      id,
      organization_id,
      title,
      status,
      stream_key,
      scheduled_at,
      started_at,
      ended_at,
      created_at
    FROM live_sessions
    ORDER BY created_at DESC
    LIMIT 50
  `);

  return res.json({
    module: "live",

    sessions: result.rows,

    capabilities: [
      "live_session",
      "mobile_source",
      "camera_source",
      "rtmp",
      "srt",
      "multi_destination",
      "recording",
      "highlights",
      "clips",
      "shorts",
      "reels",
      "monitoring",
      "analytics",
      "archive"
    ],

    destinations: [
      "EZ MEDIA",
      "YouTube",
      "Facebook",
      "TikTok",
      "Instagram",
      "X",
      "Custom RTMP",
      "Custom SRT"
    ],

    note:
      "توفر البث لكل منصة يعتمد على صلاحيات API وRTMP/SRT الخاصة بالمنصة.",

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * REVENUE
 * =========================================================
 */

router.get("/revenue", async (req, res) => {
  const campaigns = await safeQuery(`
    SELECT
      id,
      organization_id,
      name,
      status,
      budget,
      start_date,
      end_date,
      created_at
    FROM ad_campaigns
    ORDER BY created_at DESC
    LIMIT 100
  `);

  const sponsorships = await safeQuery(`
    SELECT
      id,
      organization_id,
      sponsor_name,
      status,
      contract_value,
      start_date,
      end_date,
      created_at
    FROM sponsorship_contracts
    ORDER BY created_at DESC
    LIMIT 100
  `);

  return res.json({
    module: "revenue",

    advertising: {
      campaigns: campaigns.rows
    },

    sponsorships: {
      contracts: sponsorships.rows
    },

    flow: [
      "advertiser",
      "campaign",
      "placement",
      "content",
      "social",
      "video",
      "analytics",
      "report"
    ],

    sponsorshipFlow: [
      "sponsor",
      "contract",
      "deliverables",
      "stories",
      "videos",
      "events",
      "social",
      "performance"
    ],

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * ANALYTICS
 * =========================================================
 */

router.get("/analytics", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      event_type,
      COUNT(*)::integer AS count
    FROM analytics_events
    GROUP BY event_type
    ORDER BY count DESC
  `);

  return res.json({
    module: "analytics",

    events: result.rows,

    capabilities: [
      "page_views",
      "content_views",
      "engagement",
      "social",
      "video",
      "live",
      "advertising",
      "sponsorships",
      "audience",
      "performance",
      "reports"
    ],

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * USERS
 * =========================================================
 */

router.get("/users", async (req, res) => {
  const limit = positiveInteger(
    req.query.limit,
    50,
    200
  );

  const result = await safeQuery(`
    SELECT
      id,
      organization_id,
      email,
      first_name,
      last_name,
      display_name,
      avatar_url,
      status,
      last_login_at,
      created_at,
      updated_at
    FROM users
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  return res.json({
    module: "users",
    count: result.rows.length,
    users: result.rows,
    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * ADMIN OVERVIEW
 * =========================================================
 */

router.get("/admin/overview", async (req, res) => {
  const users = await safeQuery(`
    SELECT COUNT(*)::integer AS count
    FROM users
  `);

  const articles = await safeQuery(`
    SELECT COUNT(*)::integer AS count
    FROM articles
  `);

  const media = await safeQuery(`
    SELECT COUNT(*)::integer AS count
    FROM media_assets
  `);

  const stories = await safeQuery(`
    SELECT COUNT(*)::integer AS count
    FROM stories
  `);

  const projects = await safeQuery(`
    SELECT COUNT(*)::integer AS count
    FROM production_projects
  `);

  const live = await safeQuery(`
    SELECT COUNT(*)::integer AS count
    FROM live_sessions
  `);

  return res.json({
    module: "admin",

    counts: {
      users:
        users.rows[0]?.count || 0,

      articles:
        articles.rows[0]?.count || 0,

      media:
        media.rows[0]?.count || 0,

      stories:
        stories.rows[0]?.count || 0,

      productionProjects:
        projects.rows[0]?.count || 0,

      liveSessions:
        live.rows[0]?.count || 0
    },

    management: [
      "dashboard",
      "users",
      "employees",
      "roles",
      "permissions",
      "sections",
      "content",
      "stories",
      "media",
      "production",
      "automation",
      "advertising",
      "sponsorships",
      "social",
      "live",
      "analytics",
      "notifications",
      "audit",
      "settings"
    ],

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * STATS
 * =========================================================
 */

router.get("/stats", async (req, res) => {
  const queries = {
    users: `
      SELECT COUNT(*)::integer AS value
      FROM users
    `,

    articles: `
      SELECT COUNT(*)::integer AS value
      FROM articles
    `,

    media: `
      SELECT COUNT(*)::integer AS value
      FROM media_assets
    `,

    stories: `
      SELECT COUNT(*)::integer AS value
      FROM stories
    `,

    projects: `
      SELECT COUNT(*)::integer AS value
      FROM production_projects
    `,

    live: `
      SELECT COUNT(*)::integer AS value
      FROM live_sessions
    `,

    automation: `
      SELECT COUNT(*)::integer AS value
      FROM automation_workflows
    `,

    ai: `
      SELECT COUNT(*)::integer AS value
      FROM ai_agents
    `
  };

  const stats = {};

  for (const [key, sql] of Object.entries(
    queries
  )) {
    const result = await safeQuery(sql);

    stats[key] =
      result.rows[0]?.value || 0;
  }

  return res.json({
    platform: env.platform,
    version: env.version,
    stats,
    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * SEARCH
 * =========================================================
 */

router.get("/search", async (req, res) => {
  const q = cleanString(
    req.query.q
  );

  if (!q) {
    return res.status(400).json({
      error: "SEARCH_QUERY_REQUIRED",
      message: "اكتب كلمة البحث",
      requestId: requestId(req),
      timestamp: now()
    });
  }

  const search = `%${q}%`;

  const articles = await safeQuery(`
    SELECT
      id,
      title,
      slug,
      excerpt,
      status,
      created_at
    FROM articles
    WHERE
      title ILIKE $1
      OR content ILIKE $1
      OR excerpt ILIKE $1
    ORDER BY created_at DESC
    LIMIT 25
  `, [search]);

  const stories = await safeQuery(`
    SELECT
      id,
      title,
      slug,
      summary,
      status,
      created_at
    FROM stories
    WHERE
      title ILIKE $1
      OR summary ILIKE $1
    ORDER BY created_at DESC
    LIMIT 25
  `, [search]);

  const media = await safeQuery(`
    SELECT
      id,
      name,
      original_name,
      type,
      created_at
    FROM media_assets
    WHERE
      name ILIKE $1
      OR original_name ILIKE $1
    ORDER BY created_at DESC
    LIMIT 25
  `, [search]);

  return res.json({
    query: q,

    results: {
      articles: articles.rows,
      stories: stories.rows,
      media: media.rows
    },

    totals: {
      articles: articles.rows.length,
      stories: stories.rows.length,
      media: media.rows.length
    },

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * DASHBOARD
 * =========================================================
 */

router.get("/dashboard", async (req, res) => {
  const stats = await safeQuery(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM articles) AS articles,
      (SELECT COUNT(*) FROM stories) AS stories,
      (SELECT COUNT(*) FROM media_assets) AS media,
      (SELECT COUNT(*) FROM production_projects) AS projects,
      (SELECT COUNT(*) FROM automation_workflows) AS workflows,
      (SELECT COUNT(*) FROM ai_agents) AS ai_agents,
      (SELECT COUNT(*) FROM live_sessions) AS live_sessions
  `);

  const latestArticles = await safeQuery(`
    SELECT
      id,
      title,
      slug,
      status,
      created_at
    FROM articles
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const latestStories = await safeQuery(`
    SELECT
      id,
      title,
      slug,
      status,
      created_at
    FROM stories
    ORDER BY created_at DESC
    LIMIT 10
  `);

  const latestMedia = await safeQuery(`
    SELECT
      id,
      name,
      type,
      status,
      created_at
    FROM media_assets
    ORDER BY created_at DESC
    LIMIT 10
  `);

  return res.json({
    platform: env.platform,
    version: env.version,

    stats:
      stats.rows[0] || {
        users: 0,
        articles: 0,
        stories: 0,
        media: 0,
        projects: 0,
        workflows: 0,
        ai_agents: 0,
        live_sessions: 0
      },

    latest: {
      articles: latestArticles.rows,
      stories: latestStories.rows,
      media: latestMedia.rows
    },

    dashboardModules: [
      "newsroom",
      "content",
      "media",
      "ai",
      "production",
      "automation",
      "live",
      "social",
      "advertising",
      "sponsorships",
      "analytics",
      "administration"
    ],

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * HEALTH
 * =========================================================
 */

router.get("/health", async (req, res) => {
  const result = await safeQuery(`
    SELECT
      NOW() AS server_time
  `);

  const healthy =
    !result.error;

  return res.status(
    healthy ? 200 : 503
  ).json({
    platform: env.platform,
    version: env.version,

    status:
      healthy
        ? "healthy"
        : "degraded",

    server: "online",

    database: {
      configured:
        isDatabaseConfigured(),

      connected:
        healthy
    },

    requestId: requestId(req),
    timestamp: now()
  });
});


/*
 * =========================================================
 * ERROR HANDLER LOCAL
 * =========================================================
 */

router.use(
  (error, req, res, next) => {
    console.error(
      "EZ MEDIA PLATFORM ROUTER ERROR:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      error: "PLATFORM_ROUTE_ERROR",

      message:
        "حدث خطأ داخل منصة EZ MEDIA",

      details:
        env.nodeEnv === "production"
          ? undefined
          : error.message,

      requestId:
        requestId(req),

      timestamp:
        now()
    });
  }
);


/*
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default router;
