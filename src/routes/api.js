import { Router } from "express";
import env from "../config/env.js";

import {
  listArticles,
  findArticleById,
  createArticle
} from "../repositories/article.repository.js";

import {
  listMedia,
  findMediaById,
  createMedia
} from "../repositories/media.repository.js";

import { getDatabaseSummary } from "../services/database-bootstrap.js";

const router = Router();

/*
 * ==========================================
 * EZ MEDIA 11.0
 * API ROOT
 * ==========================================
 */

router.get("/", (req, res) => {
  res.json({
    platform: env.platform,
    version: env.version,
    api: "EZ MEDIA API",
    status: "online",

    endpoints: {
      system: "/api/system",
      sections: "/api/sections",
      content: "/api/content",
      media: "/api/media",
      ads: "/api/ads",
      sponsors: "/api/sponsors",
      automation: "/api/automation",
      platforms: "/api/platforms",
      live: "/api/live",
      analytics: "/api/analytics",
      admin: "/api/admin"
    },

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * SYSTEM
 * ==========================================
 */

router.get("/system", async (req, res) => {
  const database = await getDatabaseSummary();

  res.json({
    platform: env.platform,
    version: env.version,
    status: "online",

    server: {
      node: process.version,
      environment: env.nodeEnv,
      uptime: process.uptime()
    },

    database,

    features: {
      api: true,
      cms: true,
      mediaLibrary: true,
      advertising: true,
      sponsorships: true,
      automation: true,
      socialPlatforms: true,
      liveStreaming: true,
      analytics: true,
      administration: true,
      postgres: database.ready
    },

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * SECTIONS
 * ==========================================
 */

const sections = [
  {
    id: 1,
    key: "news",
    name: "الأخبار"
  },
  {
    id: 2,
    key: "media",
    name: "الإعلام"
  },
  {
    id: 3,
    key: "content",
    name: "المحتوى"
  },
  {
    id: 4,
    key: "video",
    name: "الفيديو"
  },
  {
    id: 5,
    key: "audio",
    name: "الصوتيات"
  },
  {
    id: 6,
    key: "podcast",
    name: "البودكاست"
  },
  {
    id: 7,
    key: "live",
    name: "البث المباشر"
  },
  {
    id: 8,
    key: "coverage",
    name: "التغطيات"
  },
  {
    id: 9,
    key: "events",
    name: "الفعاليات"
  },
  {
    id: 10,
    key: "reports",
    name: "التقارير"
  },
  {
    id: 11,
    key: "interviews",
    name: "المقابلات"
  },
  {
    id: 12,
    key: "technology",
    name: "التقنية"
  },
  {
    id: 13,
    key: "ai",
    name: "الذكاء الاصطناعي"
  },
  {
    id: 14,
    key: "digital-platforms",
    name: "المنصات الرقمية"
  },
  {
    id: 15,
    key: "social-media",
    name: "السوشيال ميديا"
  },
  {
    id: 16,
    key: "trending",
    name: "الترند"
  },
  {
    id: 17,
    key: "travel",
    name: "السفر"
  },
  {
    id: 18,
    key: "tourism",
    name: "السياحة"
  },
  {
    id: 19,
    key: "sports",
    name: "الرياضة"
  },
  {
    id: 20,
    key: "economy",
    name: "الاقتصاد"
  },
  {
    id: 21,
    key: "business",
    name: "الأعمال"
  },
  {
    id: 22,
    key: "advertising",
    name: "الإعلانات"
  },
  {
    id: 23,
    key: "sponsorships",
    name: "الرعايات"
  },
  {
    id: 24,
    key: "commerce",
    name: "التجارة"
  },
  {
    id: 25,
    key: "services",
    name: "الخدمات"
  },
  {
    id: 26,
    key: "digital-identity",
    name: "الهوية الرقمية"
  },
  {
    id: 27,
    key: "creator",
    name: "صانع المحتوى"
  },
  {
    id: 28,
    key: "team",
    name: "فريق EZ MEDIA"
  },
  {
    id: 29,
    key: "library",
    name: "المكتبة الرقمية"
  },
  {
    id: 30,
    key: "about",
    name: "عن EZ MEDIA"
  }
];

router.get("/sections", (req, res) => {
  res.json({
    platform: env.platform,
    version: env.version,
    count: sections.length,
    sections,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

router.get("/sections/:key", (req, res) => {
  const section = sections.find(
    (item) => item.key === req.params.key
  );

  if (!section) {
    return res.status(404).json({
      error: "SECTION_NOT_FOUND",
      message: "القسم غير موجود",
      requestId: req.requestId
    });
  }

  return res.json({
    section,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * CONTENT / ARTICLES
 * ==========================================
 */

router.get("/content", async (req, res) => {
  try {
    const organizationId =
      req.query.organizationId || null;

    if (!organizationId) {
      return res.json({
        module: "content",
        status: "ready",
        database: "organization_required",

        capabilities: [
          "articles",
          "news",
          "reports",
          "interviews",
          "coverage",
          "drafts",
          "review",
          "publishing",
          "scheduling",
          "content_versions",
          "tags"
        ],

        usage: {
          organizationId:
            "/api/content?organizationId=YOUR_ORGANIZATION_ID",
          status:
            "/api/content?organizationId=YOUR_ORGANIZATION_ID&status=published",
          pagination:
            "/api/content?organizationId=YOUR_ORGANIZATION_ID&limit=50&offset=0"
        },

        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    }

    const articles = await listArticles({
      organizationId,
      status: req.query.status || undefined,
      limit: req.query.limit,
      offset: req.query.offset
    });

    return res.json({
      module: "content",
      status: "connected",
      database: "postgresql",

      count: articles.length,

      articles,

      capabilities: [
        "articles",
        "news",
        "reports",
        "interviews",
        "coverage",
        "drafts",
        "review",
        "publishing",
        "scheduling",
        "content_versions",
        "tags"
      ],

      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    console.error(
      "EZ MEDIA CONTENT ERROR:",
      error
    );

    return res.status(500).json({
      error: "CONTENT_DATABASE_ERROR",
      message: "تعذر قراءة المحتوى من قاعدة البيانات",
      details:
        env.nodeEnv === "production"
          ? undefined
          : error.message,
      requestId: req.requestId
    });
  }
});

/*
 * ==========================================
 * ARTICLE BY ID
 * ==========================================
 */

router.get(
  "/content/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.query.organizationId || null;

      if (!organizationId) {
        return res.status(400).json({
          error: "ORGANIZATION_ID_REQUIRED",
          message:
            "organizationId مطلوب للوصول إلى المقال",
          requestId: req.requestId
        });
      }

      const article =
        await findArticleById(
          organizationId,
          req.params.id
        );

      if (!article) {
        return res.status(404).json({
          error: "ARTICLE_NOT_FOUND",
          message: "المقال غير موجود",
          requestId: req.requestId
        });
      }

      return res.json({
        article,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      console.error(
        "EZ MEDIA ARTICLE ERROR:",
        error
      );

      return res.status(500).json({
        error: "ARTICLE_DATABASE_ERROR",
        message:
          "تعذر قراءة المقال من قاعدة البيانات",
        details:
          env.nodeEnv === "production"
            ? undefined
            : error.message,
        requestId: req.requestId
      });
    }
  }
);

/*
 * ==========================================
 * CREATE ARTICLE
 * ==========================================
 */

router.post(
  "/content",
  async (req, res) => {
    try {
      const {
        organizationId,
        authorId = null,
        title,
        slug,
        excerpt = null,
        content = "",
        status = "draft",
        category = null,
        tags = [],
        featuredMediaId = null,
        scheduledAt = null,
        metadata = {}
      } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          error: "ORGANIZATION_ID_REQUIRED",
          message:
            "organizationId مطلوب لإنشاء المقال",
          requestId: req.requestId
        });
      }

      if (!title) {
        return res.status(400).json({
          error: "TITLE_REQUIRED",
          message: "عنوان المقال مطلوب",
          requestId: req.requestId
        });
      }

      if (!slug) {
        return res.status(400).json({
          error: "SLUG_REQUIRED",
          message: "slug مطلوب للمقال",
          requestId: req.requestId
        });
      }

      const article =
        await createArticle({
          organizationId,
          authorId,
          title,
          slug,
          excerpt,
          content,
          status,
          category,
          tags,
          featuredMediaId,
          scheduledAt,
          metadata
        });

      return res.status(201).json({
        message: "تم إنشاء المقال بنجاح",
        article,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      console.error(
        "EZ MEDIA CREATE ARTICLE ERROR:",
        error
      );

      return res.status(500).json({
        error: "ARTICLE_CREATE_ERROR",
        message: "تعذر إنشاء المقال",
        details:
          env.nodeEnv === "production"
            ? undefined
            : error.message,
        requestId: req.requestId
      });
    }
  }
);

/*
 * ==========================================
 * MEDIA LIBRARY
 * ==========================================
 */

router.get("/media", async (req, res) => {
  try {
    const organizationId =
      req.query.organizationId || null;

    if (!organizationId) {
      return res.json({
        module: "media",
        status: "ready",
        database: "organization_required",

        supportedTypes: [
          "image",
          "video",
          "audio",
          "document"
        ],

        capabilities: [
          "upload",
          "metadata",
          "folders",
          "search",
          "library",
          "content_attachment",
          "media_versions"
        ],

        usage: {
          organizationId:
            "/api/media?organizationId=YOUR_ORGANIZATION_ID",
          type:
            "/api/media?organizationId=YOUR_ORGANIZATION_ID&type=image",
          status:
            "/api/media?organizationId=YOUR_ORGANIZATION_ID&status=uploaded"
        },

        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    }

    const media =
      await listMedia({
        organizationId,
        status: req.query.status || undefined,
        type: req.query.type || undefined,
        limit: req.query.limit,
        offset: req.query.offset
      });

    return res.json({
      module: "media",
      status: "connected",
      database: "postgresql",

      count: media.length,

      media,

      supportedTypes: [
        "image",
        "video",
        "audio",
        "document"
      ],

      capabilities: [
        "upload",
        "metadata",
        "folders",
        "search",
        "library",
        "content_attachment",
        "media_versions"
      ],

      storage: {
        provider:
          "database_metadata_ready",
        persistent: true
      },

      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    console.error(
      "EZ MEDIA MEDIA ERROR:",
      error
    );

    return res.status(500).json({
      error: "MEDIA_DATABASE_ERROR",
      message:
        "تعذر قراءة مكتبة الوسائط من قاعدة البيانات",
      details:
        env.nodeEnv === "production"
          ? undefined
          : error.message,
      requestId: req.requestId
    });
  }
});

/*
 * ==========================================
 * MEDIA BY ID
 * ==========================================
 */

router.get(
  "/media/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.query.organizationId || null;

      if (!organizationId) {
        return res.status(400).json({
          error: "ORGANIZATION_ID_REQUIRED",
          message:
            "organizationId مطلوب للوصول إلى الوسائط",
          requestId: req.requestId
        });
      }

      const media =
        await findMediaById(
          organizationId,
          req.params.id
        );

      if (!media) {
        return res.status(404).json({
          error: "MEDIA_NOT_FOUND",
          message: "الملف الإعلامي غير موجود",
          requestId: req.requestId
        });
      }

      return res.json({
        media,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      console.error(
        "EZ MEDIA MEDIA ITEM ERROR:",
        error
      );

      return res.status(500).json({
        error: "MEDIA_ITEM_DATABASE_ERROR",
        message:
          "تعذر قراءة الملف من قاعدة البيانات",
        details:
          env.nodeEnv === "production"
            ? undefined
            : error.message,
        requestId: req.requestId
      });
    }
  }
);

/*
 * ==========================================
 * CREATE MEDIA RECORD
 * ==========================================
 */

router.post(
  "/media",
  async (req, res) => {
    try {
      const {
        organizationId,
        uploadedBy = null,
        name,
        originalName = null,
        type,
        mimeType = null,
        storageProvider = null,
        storageKey = null,
        publicUrl = null,
        sizeBytes = null,
        checksum = null,
        width = null,
        height = null,
        durationSeconds = null,
        metadata = {},
        status = "uploaded"
      } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          error: "ORGANIZATION_ID_REQUIRED",
          message:
            "organizationId مطلوب لإنشاء سجل الوسائط",
          requestId: req.requestId
        });
      }

      if (!name) {
        return res.status(400).json({
          error: "MEDIA_NAME_REQUIRED",
          message: "اسم الملف مطلوب",
          requestId: req.requestId
        });
      }

      if (!type) {
        return res.status(400).json({
          error: "MEDIA_TYPE_REQUIRED",
          message: "نوع الملف مطلوب",
          requestId: req.requestId
        });
      }

      const media =
        await createMedia({
          organizationId,
          uploadedBy,
          name,
          originalName,
          type,
          mimeType,
          storageProvider,
          storageKey,
          publicUrl,
          sizeBytes,
          checksum,
          width,
          height,
          durationSeconds,
          metadata,
          status
        });

      return res.status(201).json({
        message:
          "تم إنشاء سجل الوسائط بنجاح",
        media,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      console.error(
        "EZ MEDIA CREATE MEDIA ERROR:",
        error
      );

      return res.status(500).json({
        error: "MEDIA_CREATE_ERROR",
        message:
          "تعذر إنشاء سجل الوسائط",
        details:
          env.nodeEnv === "production"
            ? undefined
            : error.message,
        requestId: req.requestId
      });
    }
  }
);

/*
 * ==========================================
 * ADVERTISING
 * ==========================================
 */

router.get("/ads", (req, res) => {
  res.json({
    module: "advertising",
    status: "ready",

    capabilities: [
      "campaigns",
      "advertisements",
      "placements",
      "scheduling",
      "targeting",
      "analytics"
    ],

    database: "pending_schema",

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * SPONSORSHIPS
 * ==========================================
 */

router.get("/sponsors", (req, res) => {
  res.json({
    module: "sponsorships",
    status: "ready",

    capabilities: [
      "sponsors",
      "packages",
      "campaigns",
      "contracts",
      "placements",
      "section_sponsorships",
      "analytics"
    ],

    database: "pending_schema",

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * AUTOMATION
 * ==========================================
 */

router.get("/automation", (req, res) => {
  res.json({
    module: "automation",
    status: "ready",

    workflow: [
      "source",
      "import",
      "process",
      "classify",
      "store",
      "review",
      "publish",
      "distribute",
      "analyze"
    ],

    capabilities: [
      "source_ingestion",
      "classification",
      "scheduling",
      "publishing",
      "distribution",
      "notifications",
      "analytics"
    ],

    database: "postgresql_schema_ready",

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * SOCIAL PLATFORMS
 * ==========================================
 */

router.get("/platforms", (req, res) => {
  res.json({
    module: "platforms",
    status: "ready",

    platforms: [
      {
        key: "snapchat",
        name: "Snapchat",
        connected: false
      },
      {
        key: "tiktok",
        name: "TikTok",
        connected: false
      },
      {
        key: "instagram",
        name: "Instagram",
        connected: false
      },
      {
        key: "youtube",
        name: "YouTube",
        connected: false
      },
      {
        key: "x",
        name: "X",
        connected: false
      },
      {
        key: "linkedin",
        name: "LinkedIn",
        connected: false
      },
      {
        key: "facebook",
        name: "Facebook",
        connected: false
      }
    ],

    capabilities: [
      "accounts",
      "tokens",
      "publishing",
      "scheduling",
      "publishing_jobs",
      "publishing_results",
      "analytics"
    ],

    database: "postgresql_schema_ready",

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * LIVE
 * ==========================================
 */

router.get("/live", (req, res) => {
  res.json({
    module: "live",
    status: "ready",

    capabilities: [
      "live_events",
      "streams",
      "stream_sources",
      "destinations",
      "broadcast_sessions",
      "scheduling",
      "monitoring"
    ],

    streaming: {
      server: "pending_external_provider",
      status: "not_configured"
    },

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * ANALYTICS
 * ==========================================
 */

router.get("/analytics", (req, res) => {
  res.json({
    module: "analytics",
    status: "ready",

    capabilities: [
      "content_views",
      "engagement",
      "advertising",
      "sponsorships",
      "social_platforms",
      "live",
      "system",
      "reports"
    ],

    database: "postgresql_schema_ready",

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * ADMIN
 * ==========================================
 */

router.get("/admin", (req, res) => {
  res.json({
    module: "admin",
    status: "ready",

    sections: [
      "dashboard",
      "content",
      "sections",
      "branches",
      "media",
      "library",
      "advertising",
      "sponsorships",
      "platforms",
      "live",
      "automation",
      "schedules",
      "employees",
      "roles",
      "permissions",
      "analytics",
      "settings",
      "activity_logs"
    ],

    authentication: {
      required: true,
      provider: "JWT"
    },

    database: "postgresql_schema_ready",

    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/*
 * ==========================================
 * EXPORT
 * ==========================================
 */

export default router;
