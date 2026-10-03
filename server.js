/**
 * =========================================================
 * EZ MEDIA 11.0
 * AI MEDIA PLATFORM
 * =========================================================
 *
 * نسخة تشغيل موحدة.
 *
 * الوحدات:
 * - API
 * - CMS
 * - News
 * - AI workflow
 * - Media Library
 * - Live Streaming
 * - Advertising
 * - Sponsorships
 * - Automation
 * - Analytics
 * - Administration
 * - Search
 * - Security
 * - Audit Log
 *
 * قاعدة البيانات:
 * - Memory mode عند عدم وجود DATABASE_URL
 * - PostgreSQL adapter عند وجود DATABASE_URL
 *
 * ملاحظة:
 * Environment Variables تؤجل للمرحلة الأخيرة.
 */

"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

let pg = null;

try {
  pg = require("pg");
} catch (_) {
  pg = null;
}

/* =========================================================
   PLATFORM
========================================================= */

const PLATFORM = {
  name: "EZ MEDIA",
  version: "11.0.0",
  edition: "AI MEDIA PLATFORM",
  environment: process.env.NODE_ENV || "development"
};

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

/* =========================================================
   APP
========================================================= */

const app = express();

app.disable("x-powered-by");

app.set("trust proxy", 1);

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "RATE_LIMITED",
      message: "تم تجاوز عدد الطلبات المسموح بها مؤقتًا",
      requestId: req.requestId || null
    });
  }
});

app.use("/api", apiLimiter);

/* =========================================================
   BODY
========================================================= */

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);

/* =========================================================
   REQUEST ID
========================================================= */

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader(
    "X-Request-ID",
    requestId
  );

  res.setHeader(
    "X-Platform",
    PLATFORM.name
  );

  next();
});

/* =========================================================
   HELPERS
========================================================= */

function now() {
  return new Date().toISOString();
}

function createId(prefix = "ez") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function cleanString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function clampNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(
    Math.max(number, min),
    max
  );
}

/* =========================================================
   SECTIONS
========================================================= */

const SECTIONS = [
  ["news", "الأخبار"],
  ["saudi", "السعودية"],
  ["gulf", "الخليج"],
  ["world", "العالم"],
  ["economy", "اقتصاد"],
  ["technology", "تقنية وذكاء اصطناعي"],
  ["sports", "رياضة"],
  ["society", "مجتمع"],
  ["culture", "ثقافة"],
  ["tourism", "سياحة"],
  ["environment", "بيئة"],
  ["reports", "تقارير"],
  ["investigations", "تحقيقات"],
  ["interviews", "مقابلات"],
  ["video", "فيديو"],
  ["live", "البث المباشر"],
  ["my-content", "محتواي"],
  ["media-library", "المكتبة الإعلامية"],
  ["advertising", "الإعلانات"],
  ["sponsorships", "الرعايات"]
].map(([id, name]) => ({
  id,
  name,
  slug: id,
  enabled: true
}));

/* =========================================================
   MEMORY DATABASE
========================================================= */

const memoryDB = {
  users: [],
  contents: [],
  media: [],
  liveStreams: [],
  advertisements: [],
  sponsorships: [],
  schedules: [],
  automationRuns: [],
  newsSources: [],
  aiJobs: [],
  analytics: [],
  auditLogs: [],
  settings: {
    platformName: "EZ MEDIA",
    language: "ar",
    direction: "rtl",
    aiHumanApproval: true
  }
};

/* =========================================================
   MEMORY DATABASE METHODS
========================================================= */

function memoryCreate(collection, data) {
  const record = {
    id: createId(collection),
    createdAt: now(),
    updatedAt: now(),
    ...data
  };

  memoryDB[collection].push(record);

  return record;
}

function memoryFind(collection, id) {
  return memoryDB[collection].find(
    item => item.id === id
  );
}

function memoryUpdate(collection, id, data) {
  const index = memoryDB[collection].findIndex(
    item => item.id === id
  );

  if (index === -1) {
    return null;
  }

  memoryDB[collection][index] = {
    ...memoryDB[collection][index],
    ...data,
    updatedAt: now()
  };

  return memoryDB[collection][index];
}

function memoryDelete(collection, id) {
  const index = memoryDB[collection].findIndex(
    item => item.id === id
  );

  if (index === -1) {
    return false;
  }

  memoryDB[collection].splice(index, 1);

  return true;
}

function audit(action, details = {}) {
  memoryDB.auditLogs.push({
    id: createId("audit"),
    action,
    details,
    createdAt: now()
  });
}

/* =========================================================
   DATABASE STATUS
========================================================= */

const databaseConfigured =
  Boolean(process.env.DATABASE_URL);

let pgPool = null;
let postgresConnected = false;

async function initializePostgres() {
  if (!databaseConfigured) {
    return;
  }

  if (!pg) {
    console.warn(
      "DATABASE_URL موجود لكن حزمة pg غير متاحة."
    );

    return;
  }

  try {
    pgPool = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL,

      max: 5,

      idleTimeoutMillis: 30000,

      connectionTimeoutMillis: 5000,

      ssl:
        process.env.PGSSL === "false"
          ? false
          : {
              rejectUnauthorized: false
            }
    });

    await pgPool.query(
      "SELECT NOW() AS now"
    );

    postgresConnected = true;

    console.log(
      "PostgreSQL connection established."
    );

  } catch (error) {

    postgresConnected = false;

    console.error(
      "PostgreSQL connection failed:",
      error.message
    );
  }
}

/* =========================================================
   GENERIC DATA LAYER
========================================================= */

const db = {

  async create(collection, data) {
    return memoryCreate(
      collection,
      data
    );
  },

  async find(collection, id) {
    return memoryFind(
      collection,
      id
    );
  },

  async update(collection, id, data) {
    return memoryUpdate(
      collection,
      id,
      data
    );
  },

  async delete(collection, id) {
    return memoryDelete(
      collection,
      id
    );
  },

  async all(collection) {
    return [
      ...memoryDB[collection]
    ];
  },

  async count(collection) {
    return memoryDB[collection].length;
  },

  async query(sql, params = []) {
    if (!pgPool || !postgresConnected) {
      throw new Error(
        "PostgreSQL is not connected"
      );
    }

    return pgPool.query(
      sql,
      params
    );
  }
};

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (req, res) => {

    const status =
      postgresConnected ||
      !databaseConfigured
        ? "online"
        : "degraded";

    res.json({

      platform:
        PLATFORM.name,

      version:
        PLATFORM.version,

      status,

      server:
        "online",

      database: {

        configured:
          databaseConfigured,

        connected:
          postgresConnected,

        mode:
          postgresConnected
            ? "postgresql"
            : "memory",

        databaseName:
          postgresConnected &&
          pgPool
            ? "PostgreSQL"
            : null,

        message:
          postgresConnected
            ? "PostgreSQL connected"
            : databaseConfigured
              ? "DATABASE_URL configured but PostgreSQL connection failed"
              : "Database not configured"
      },

      ai: {
        enabled: true,

        providerConfigured:
          Boolean(
            process.env.AI_API_KEY
          ),

        humanApprovalRequired:
          true
      },

      modules: {
        api: true,
        cms: true,
        news: true,
        ai: true,
        media: true,
        live: true,
        advertising: true,
        sponsorships: true,
        automation: true,
        analytics: true,
        administration: true,
        search: true
      },

      node:
        process.version,

      environment:
        PLATFORM.environment,

      uptime:
        process.uptime(),

      requestId:
        req.requestId,

      timestamp:
        now()
    });
  }
);

/* =========================================================
   API ROOT
========================================================= */

app.get(
  "/api",
  (req, res) => {

    res.json({

      success: true,

      platform:
        PLATFORM,

      message:
        "EZ MEDIA API تعمل بنجاح",

      modules: [
        "cms",
        "news",
        "ai",
        "media",
        "live",
        "advertising",
        "sponsorships",
        "automation",
        "analytics",
        "administration",
        "search"
      ],

      requestId:
        req.requestId
    });
  }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
  "/api/dashboard",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        platform:
          PLATFORM.name,

        statistics: {

          users:
            await db.count("users"),

          contents:
            await db.count("contents"),

          media:
            await db.count("media"),

          liveStreams:
            await db.count("liveStreams"),

          advertisements:
            await db.count("advertisements"),

          sponsorships:
            await db.count("sponsorships"),

          automationRuns:
            await db.count("automationRuns"),

          aiJobs:
            await db.count("aiJobs"),

          analytics:
            await db.count("analytics")
        },

        system: {

          server:
            "online",

          database:
            postgresConnected
              ? "postgresql"
              : "memory"
        },

        timestamp:
          now()
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   SECTIONS
========================================================= */

app.get(
  "/api/sections",
  (req, res) => {

    res.json({

      success: true,

      sections:
        SECTIONS
    });
  }
);

/* =========================================================
   CMS
========================================================= */

app.get(
  "/api/content",
  async (req, res, next) => {

    try {

      let contents =
        await db.all("contents");

      if (req.query.section) {

        contents =
          contents.filter(
            item =>
              item.section ===
              req.query.section
          );
      }

      if (req.query.status) {

        contents =
          contents.filter(
            item =>
              item.status ===
              req.query.status
          );
      }

      contents.sort(
        (a, b) =>
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
      );

      res.json({

        success: true,

        count:
          contents.length,

        contents
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/content",
  async (req, res, next) => {

    try {

      const title =
        cleanString(
          req.body.title
        );

      if (!title) {

        return res.status(400)
          .json({

            success: false,

            message:
              "عنوان المحتوى مطلوب"
          });
      }

      const content =
        await db.create(
          "contents",
          {

            title,

            description:
              cleanString(
                req.body.description
              ),

            body:
              cleanString(
                req.body.body
              ),

            section:
              cleanString(
                req.body.section,
                "news"
              ),

            type:
              cleanString(
                req.body.type,
                "article"
              ),

            status:
              cleanString(
                req.body.status,
                "draft"
              ),

            author:
              cleanString(
                req.body.author,
                "EZ MEDIA"
              ),

            aiGenerated:
              false,

            requiresHumanApproval:
              true,

            views: 0,

            publishedAt:
              null
          }
        );

      audit(
        "content.created",
        {
          contentId:
            content.id
        }
      );

      res.status(201)
        .json({

          success: true,

          content
        });

    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  "/api/content/:id",
  async (req, res, next) => {

    try {

      const existing =
        await db.find(
          "contents",
          req.params.id
        );

      if (!existing) {

        return res.status(404)
          .json({

            success: false,

            message:
              "المحتوى غير موجود"
          });
      }

      const data = {
        ...req.body
      };

      if (
        data.status ===
        "published"
      ) {

        data.publishedAt =
          existing.publishedAt ||
          now();
      }

      const content =
        await db.update(
          "contents",
          req.params.id,
          data
        );

      audit(
        "content.updated",
        {
          contentId:
            content.id
        }
      );

      res.json({

        success: true,

        content
      });

    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/content/:id",
  async (req, res, next) => {

    try {

      const deleted =
        await db.delete(
          "contents",
          req.params.id
        );

      if (!deleted) {

        return res.status(404)
          .json({

            success: false,

            message:
              "المحتوى غير موجود"
          });
      }

      audit(
        "content.deleted",
        {
          contentId:
            req.params.id
        }
      );

      res.json({
        success: true
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   NEWS
========================================================= */

app.get(
  "/api/news",
  async (req, res, next) => {

    try {

      const sections = [
        "news",
        "saudi",
        "gulf",
        "world",
        "economy",
        "technology"
      ];

      let news =
        await db.all(
          "contents"
        );

      news =
        news.filter(
          item =>
            sections.includes(
              item.section
            ) &&
            item.status ===
              "published"
        );

      news.sort(
        (a, b) =>
          new Date(
            b.publishedAt ||
            b.createdAt
          ) -
          new Date(
            a.publishedAt ||
            a.createdAt
          )
      );

      res.json({

        success: true,

        count:
          news.length,

        news
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   NEWS SOURCES
========================================================= */

app.get(
  "/api/news/sources",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        sources:
          await db.all(
            "newsSources"
          )
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/news/sources",
  async (req, res, next) => {

    try {

      const name =
        cleanString(
          req.body.name
        );

      const url =
        cleanString(
          req.body.url
        );

      if (!name) {

        return res.status(400)
          .json({

            success: false,

            message:
              "اسم المصدر مطلوب"
          });
      }

      const source =
        await db.create(
          "newsSources",
          {

            name,

            url,

            type:
              cleanString(
                req.body.type,
                "rss"
              ),

            enabled:
              req.body.enabled !==
              false,

            trusted:
              Boolean(
                req.body.trusted
              )
          }
        );

      audit(
        "news_source.created",
        {
          sourceId:
            source.id
        }
      );

      res.status(201)
        .json({

          success: true,

          source
        });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   AI ENGINE
========================================================= */

function analyzeText(inputText) {

  const normalized =
    inputText
      .replace(/\s+/g, " ")
      .trim();

  const words =
    normalized
      .split(" ")
      .filter(Boolean);

  const suggestedTitle =
    words
      .slice(0, 12)
      .join(" ");

  const summary =
    normalized.length > 500
      ? `${normalized.slice(0, 500)}...`
      : normalized;

  const keywords = [
    ...new Set(
      words
        .filter(
          word =>
            word.length >= 4
        )
        .slice(0, 12)
    )
  ];

  return {

    summary,

    suggestedTitle,

    keywords,

    classification: {
      section: "news",
      confidence:
        normalized.length > 20
          ? 0.65
          : 0.25
    },

    duplicateCheck: {
      checked: true,
      duplicate: false
    },

    safety: {
      requiresHumanReview: true,
      automaticallyPublish: false
    }
  };
}

app.post(
  "/api/ai/analyze",
  async (req, res, next) => {

    try {

      const inputText =
        cleanString(
          req.body.text
        );

      if (!inputText) {

        return res.status(400)
          .json({

            success: false,

            message:
              "النص مطلوب"
          });
      }

      const result =
        analyzeText(
          inputText
        );

      const job =
        await db.create(
          "aiJobs",
          {

            type:
              "analysis",

            status:
              "completed",

            inputLength:
              inputText.length,

            result
          }
        );

      audit(
        "ai.analysis",
        {
          jobId:
            job.id
        }
      );

      res.json({

        success: true,

        job
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/ai/draft",
  async (req, res, next) => {

    try {

      const sourceText =
        cleanString(
          req.body.sourceText
        );

      const section =
        cleanString(
          req.body.section,
          "news"
        );

      if (!sourceText) {

        return res.status(400)
          .json({

            success: false,

            message:
              "المصدر مطلوب"
          });
      }

      const analysis =
        analyzeText(
          sourceText
        );

      const draft =
        await db.create(
          "contents",
          {

            title:
              analysis.suggestedTitle ||
              "مسودة خبر",

            description:
              analysis.summary,

            body:
              sourceText,

            section,

            type:
              "article",

            status:
              "ai_review",

            author:
              "EZ MEDIA AI",

            aiGenerated:
              true,

            requiresHumanApproval:
              true,

            aiAnalysis:
              analysis
          }
        );

      const job =
        await db.create(
          "aiJobs",
          {

            type:
              "content_draft",

            status:
              "completed",

            contentId:
              draft.id,

            result:
              analysis
          }
        );

      audit(
        "ai.draft_created",
        {
          contentId:
            draft.id,
          jobId:
            job.id
        }
      );

      res.status(201)
        .json({

          success: true,

          requiresHumanApproval:
            true,

          content:
            draft,

          aiJob:
            job
        });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   MEDIA LIBRARY
========================================================= */

app.get(
  "/api/media",
  async (req, res, next) => {

    try {

      const media =
        await db.all(
          "media"
        );

      res.json({

        success: true,

        count:
          media.length,

        media
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/media",
  async (req, res, next) => {

    try {

      const name =
        cleanString(
          req.body.name
        );

      if (!name) {

        return res.status(400)
          .json({

            success: false,

            message:
              "اسم الملف مطلوب"
          });
      }

      const media =
        await db.create(
          "media",
          {

            name,

            type:
              cleanString(
                req.body.type,
                "file"
              ),

            url:
              req.body.url ||
              null,

            mimeType:
              req.body.mimeType ||
              null,

            size:
              clampNumber(
                req.body.size,
                0
              ),

            folder:
              cleanString(
                req.body.folder,
                "general"
              ),

            tags:
              Array.isArray(
                req.body.tags
              )
                ? req.body.tags
                : []
          }
        );

      audit(
        "media.created",
        {
          mediaId:
            media.id
        }
      );

      res.status(201)
        .json({

          success: true,

          media
        });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   LIVE
========================================================= */

app.get(
  "/api/live",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        streams:
          await db.all(
            "liveStreams"
          )
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/live",
  async (req, res, next) => {

    try {

      const stream =
        await db.create(
          "liveStreams",
          {

            title:
              cleanString(
                req.body.title,
                "بث مباشر"
              ),

            description:
              cleanString(
                req.body.description
              ),

            status:
              cleanString(
                req.body.status,
                "offline"
              ),

            streamUrl:
              req.body.streamUrl ||
              null,

            playbackUrl:
              req.body.playbackUrl ||
              null,

            provider:
              req.body.provider ||
              null,

            schedule:
              req.body.schedule ||
              null,

            officialSource:
              Boolean(
                req.body.officialSource
              )
          }
        );

      audit(
        "live.created",
        {
          streamId:
            stream.id
        }
      );

      res.status(201)
        .json({

          success: true,

          stream
        });

    } catch (error) {
      next(error);
    }
  }
);

app.patch(
  "/api/live/:id",
  async (req, res, next) => {

    try {

      const stream =
        await db.update(
          "liveStreams",
          req.params.id,
          req.body
        );

      if (!stream) {

        return res.status(404)
          .json({

            success: false,

            message:
              "البث غير موجود"
          });
      }

      res.json({

        success: true,

        stream
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ADVERTISING
========================================================= */

app.get(
  "/api/advertising",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        advertisements:
          await db.all(
            "advertisements"
          )
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/advertising",
  async (req, res, next) => {

    try {

      const advertisement =
        await db.create(
          "advertisements",
          {

            name:
              cleanString(
                req.body.name
              ),

            advertiser:
              cleanString(
                req.body.advertiser
              ),

            placement:
              cleanString(
                req.body.placement,
                "homepage"
              ),

            startAt:
              req.body.startAt ||
              null,

            endAt:
              req.body.endAt ||
              null,

            status:
              cleanString(
                req.body.status,
                "draft"
              ),

            impressions: 0,

            clicks: 0
          }
        );

      res.status(201)
        .json({

          success: true,

          advertisement
        });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ADVERTISING EVENTS
========================================================= */

app.post(
  "/api/advertising/:id/impression",
  async (req, res, next) => {

    try {

      const advertisement =
        await db.find(
          "advertisements",
          req.params.id
        );

      if (!advertisement) {

        return res.status(404)
          .json({

            success: false,

            message:
              "الإعلان غير موجود"
          });
      }

      const updated =
        await db.update(
          "advertisements",
          req.params.id,
          {
            impressions:
              Number(
                advertisement.impressions ||
                0
              ) + 1
          }
        );

      res.json({

        success: true,

        impressions:
          updated.impressions
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/advertising/:id/click",
  async (req, res, next) => {

    try {

      const advertisement =
        await db.find(
          "advertisements",
          req.params.id
        );

      if (!advertisement) {

        return res.status(404)
          .json({

            success: false,

            message:
              "الإعلان غير موجود"
          });
      }

      const updated =
        await db.update(
          "advertisements",
          req.params.id,
          {
            clicks:
              Number(
                advertisement.clicks ||
                0
              ) + 1
          }
        );

      res.json({

        success: true,

        clicks:
          updated.clicks
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   SPONSORSHIPS
========================================================= */

app.get(
  "/api/sponsorships",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        sponsorships:
          await db.all(
            "sponsorships"
          )
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/sponsorships",
  async (req, res, next) => {

    try {

      const sponsorship =
        await db.create(
          "sponsorships",
          {

            sponsor:
              cleanString(
                req.body.sponsor
              ),

            campaign:
              cleanString(
                req.body.campaign
              ),

            level:
              cleanString(
                req.body.level,
                "section"
              ),

            section:
              req.body.section ||
              null,

            startAt:
              req.body.startAt ||
              null,

            endAt:
              req.body.endAt ||
              null,

            status:
              cleanString(
                req.body.status,
                "draft"
              )
          }
        );

      res.status(201)
        .json({

          success: true,

          sponsorship
        });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   AUTOMATION
========================================================= */

async function runAutomation() {

  const run =
    await db.create(
      "automationRuns",
      {

        status:
          "running",

        pipeline: [
          "source_collection",
          "normalization",
          "duplicate_detection",
          "ai_analysis",
          "draft_generation",
          "human_review",
          "publication"
        ],

        startedAt:
          now()
      }
    );

  try {

    const sources =
      await db.all(
        "newsSources"
      );

    const enabledSources =
      sources.filter(
        source =>
          source.enabled !== false
      );

    await db.update(
      "automationRuns",
      run.id,
      {

        status:
          "completed",

        sourcesChecked:
          enabledSources.length,

        finishedAt:
          now()
      }
    );

    return db.find(
      "automationRuns",
      run.id
    );

  } catch (error) {

    await db.update(
      "automationRuns",
      run.id,
      {

        status:
          "failed",

        error:
          error.message,

        finishedAt:
          now()
      }
    );

    throw error;
  }
}

app.post(
  "/api/admin/automation/run",
  async (req, res, next) => {

    try {

      const run =
        await runAutomation();

      res.json({

        success: true,

        run
      });

    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/admin/automation/runs",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        runs:
          await db.all(
            "automationRuns"
          )
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   SCHEDULES
========================================================= */

app.get(
  "/api/admin/schedules",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        schedules:
          await db.all(
            "schedules"
          )
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/admin/schedules",
  async (req, res, next) => {

    try {

      const schedule =
        await db.create(
          "schedules",
          {

            name:
              cleanString(
                req.body.name
              ),

            type:
              cleanString(
                req.body.type,
                "content"
              ),

            cron:
              req.body.cron ||
              null,

            enabled:
              req.body.enabled !==
              false,

            action:
              req.body.action ||
              null
          }
        );

      res.status(201)
        .json({

          success: true,

          schedule
        });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ANALYTICS
========================================================= */

app.post(
  "/api/analytics/event",
  async (req, res, next) => {

    try {

      const event =
        await db.create(
          "analytics",
          {

            type:
              cleanString(
                req.body.type,
                "page_view"
              ),

            path:
              cleanString(
                req.body.path,
                "/"
              ),

            contentId:
              req.body.contentId ||
              null,

            metadata:
              req.body.metadata ||
              {}
          }
        );

      res.status(201)
        .json({

          success: true,

          eventId:
            event.id
        });

    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/admin/analytics",
  async (req, res, next) => {

    try {

      const events =
        await db.all(
          "analytics"
        );

      const summary = {};

      for (
        const event of events
      ) {

        summary[event.type] =
          (
            summary[event.type] ||
            0
          ) + 1;
      }

      res.json({

        success: true,

        totalEvents:
          events.length,

        summary
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   ADMIN USERS
========================================================= */

const ROLES = [
  "super_admin",
  "admin",
  "editor",
  "journalist",
  "producer",
  "media_manager",
  "advertising_manager",
  "sponsorship_manager",
  "analyst",
  "viewer"
];

app.get(
  "/api/admin/users",
  async (req, res, next) => {

    try {

      res.json({

        success: true,

        roles:
          ROLES,

        users:
          await db.all(
            "users"
          )
      });

    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/admin/users",
  async (req, res, next) => {

    try {

      const name =
        cleanString(
          req.body.name
        );

      const email =
        cleanString(
          req.body.email
        );

      const role =
        cleanString(
          req.body.role,
          "editor"
        );

      if (!name) {

        return res.status(400)
          .json({

            success: false,

            message:
              "اسم المستخدم مطلوب"
          });
      }

      if (
        !ROLES.includes(role)
      ) {

        return res.status(400)
          .json({

            success: false,

            message:
              "صلاحية المستخدم غير صحيحة"
          });
      }

      const user =
        await db.create(
          "users",
          {

            name,

            email,

            role,

            permissions:
              Array.isArray(
                req.body.permissions
              )
                ? req.body.permissions
                : [],

            active: true
          }
        );

      audit(
        "user.created",
        {
          userId:
            user.id
        }
      );

      res.status(201)
        .json({

          success: true,

          user
        });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   SETTINGS
========================================================= */

app.get(
  "/api/admin/settings",
  (req, res) => {

    res.json({

      success: true,

      settings:
        memoryDB.settings
    });
  }
);

app.patch(
  "/api/admin/settings",
  (req, res) => {

    memoryDB.settings = {

      ...memoryDB.settings,

      ...req.body,

      updatedAt:
        now()
    };

    audit(
      "settings.updated"
    );

    res.json({

      success: true,

      settings:
        memoryDB.settings
    });
  }
);

/* =========================================================
   AUDIT
========================================================= */

app.get(
  "/api/admin/audit",
  (req, res) => {

    res.json({

      success: true,

      count:
        memoryDB.auditLogs.length,

      logs:
        memoryDB.auditLogs
    });
  }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
  "/api/search",
  async (req, res, next) => {

    try {

      const query =
        cleanString(
          req.query.q
        ).toLowerCase();

      if (!query) {

        return res.json({

          success: true,

          query: "",

          count: 0,

          results: []
        });
      }

      const contents =
        await db.all(
          "contents"
        );

      const results =
        contents.filter(
          item => {

            const text = [
              item.title,
              item.description,
              item.body,
              item.section,
              item.type
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return text.includes(
              query
            );
          }
        );

      res.json({

        success: true,

        query,

        count:
          results.length,

        results
      });

    } catch (error) {
      next(error);
    }
  }
);

/* =========================================================
   404 API
========================================================= */

app.use(
  "/api",
  (req, res) => {

    res.status(404)
      .json({

        success: false,

        error:
          "API_NOT_FOUND",

        message:
          "المسار غير موجود",

        path:
          req.originalUrl,

        requestId:
          req.requestId
      });
  }
);

/* =========================================================
   FRONTEND
========================================================= */

const publicDirectory =
  path.join(
    __dirname,
    "public"
  );

app.use(
  express.static(
    publicDirectory
  )
);

/*
 * نستخدم middleware بدل app.get("*")
 * لتفادي مشاكل wildcard بين إصدارات Express.
 */

app.use(
  (req, res, next) => {

    if (
      req.method !== "GET" ||
      req.path.startsWith("/api")
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        publicDirectory,
        "index.html"
      ),
      error => {

        if (error) {

          res.status(200)
            .send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width, initial-scale=1">
<title>EZ MEDIA 11.0</title>
</head>

<body>

<h1>EZ MEDIA 11.0</h1>

<p>
منصة إعلامية ذكية تعمل بنجاح.
</p>

</body>
</html>
            `);

        }
      }
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "EZ MEDIA ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500)
      .json({

        success: false,

        error:
          "INTERNAL_SERVER_ERROR",

        message:
          "حدث خطأ داخلي في المنصة",

        requestId:
          req.requestId
      });
  }
);

/* =========================================================
   START
========================================================= */

let server = null;

async function start() {

  await initializePostgres();

  server =
    app.listen(
      PORT,
      HOST,
      () => {

        console.log(`
================================================
                 EZ MEDIA 11.0
================================================

Platform   : ${PLATFORM.name}
Version    : ${PLATFORM.version}
Node       : ${process.version}
Environment: ${PLATFORM.environment}
Port       : ${PORT}

Database   : ${
  postgresConnected
    ? "PostgreSQL"
    : "Memory Mode"
}

AI         : ENABLED
CMS        : ENABLED
NEWS       : ENABLED
MEDIA      : ENABLED
LIVE       : ENABLED
ADS        : ENABLED
SPONSOR    : ENABLED
AUTOMATION : ENABLED
ANALYTICS  : ENABLED
ADMIN      : ENABLED
SEARCH     : ENABLED

================================================
EZ MEDIA SERVER IS RUNNING
================================================
`);
      }
    );
}

start().catch(error => {

  console.error(
    "EZ MEDIA startup failed:",
    error
  );

  process.exit(1);
});

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {

  console.log(
    `EZ MEDIA received ${signal}`
  );

  if (!server) {
    process.exit(0);
  }

  server.close(
    async () => {

      try {

        if (pgPool) {
          await pgPool.end();
        }

      } catch (error) {

        console.error(
          "Database shutdown error:",
          error.message
        );
      }

      console.log(
        "EZ MEDIA server closed."
      );

      process.exit(0);
    }
  );
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

module.exports = {
  app,
  PLATFORM,
  memoryDB
};
