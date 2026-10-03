"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

const PLATFORM = "EZ MEDIA";
const VERSION = "11.1.0";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "EZ_MEDIA_CHANGE_THIS_SECRET_BEFORE_PRODUCTION";

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());

app.use(compression());

app.use(express.json({
  limit: "20mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "20mb"
}));

/* =========================================================
   REQUEST ID
========================================================= */

app.use((req, res, next) => {
  req.requestId =
    req.headers["x-request-id"] ||
    crypto.randomUUID();

  res.setHeader(
    "X-Request-ID",
    req.requestId
  );

  next();
});

/* =========================================================
   DATABASE
========================================================= */

let pool = null;
let databaseConnected = false;

if (process.env.DATABASE_URL) {

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 5000
  });

  pool.on("error", error => {
    console.error(
      "[DATABASE]",
      error.message
    );
  });
}

async function checkDatabase() {

  if (!pool) {
    return false;
  }

  try {

    await pool.query("SELECT NOW()");

    databaseConnected = true;

    return true;

  } catch (error) {

    databaseConnected = false;

    console.error(
      "[DATABASE]",
      error.message
    );

    return false;
  }
}

async function dbQuery(sql, params = []) {

  if (!pool) {
    return null;
  }

  return pool.query(sql, params);
}

/* =========================================================
   MEMORY FALLBACK
========================================================= */

const memory = {

  users: [],

  content: [],

  media: [],

  live: [],

  advertisements: [],

  sponsorships: [],

  schedules: [],

  automationRuns: [],

  newsSources: [],

  aiJobs: [],

  analytics: [],

  auditLogs: []

};

/* =========================================================
   ADMIN
========================================================= */

memory.users.push({

  id: "admin",

  name: "مدير المنصة",

  email: "admin@ezmedia.local",

  password: "change-me",

  role: "admin",

  status: "active",

  createdAt: new Date().toISOString()

});

/* =========================================================
   HELPERS
========================================================= */

function id(prefix) {

  return (
    prefix +
    "_" +
    crypto.randomUUID()
  );

}

function now() {

  return new Date().toISOString();

}

function slugify(value = "") {

  return String(value)

    .trim()

    .toLowerCase()

    .replace(/[^\p{L}\p{N}]+/gu, "-")

    .replace(/^-+|-+$/g, "")

    .slice(0, 120);

}

/* =========================================================
   AUTH
========================================================= */

function auth(required = true) {

  return (req, res, next) => {

    const header =
      req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {

      if (!required) {

        req.user = null;

        return next();

      }

      return res.status(401).json({

        success: false,

        error: "Authentication required",

        requestId: req.requestId

      });

    }

    const token =
      header.substring(7);

    try {

      req.user = jwt.verify(
        token,
        JWT_SECRET
      );

      next();

    } catch {

      return res.status(401).json({

        success: false,

        error: "Invalid or expired token",

        requestId: req.requestId

      });

    }

  };

}

function role(...roles) {

  return (req, res, next) => {

    if (!req.user) {

      return res.status(401).json({

        success: false,

        error: "Authentication required"

      });

    }

    if (!roles.includes(req.user.role)) {

      return res.status(403).json({

        success: false,

        error: "Insufficient permissions"

      });

    }

    next();

  };

}

/* =========================================================
   AUDIT
========================================================= */

async function audit(
  req,
  action,
  entity,
  entityId,
  details = {}
) {

  const record = {

    id: id("audit"),

    action,

    entity,

    entityId,

    requestId: req.requestId,

    details,

    createdAt: now()

  };

  if (pool) {

    try {

      await dbQuery(

        `
        INSERT INTO audit_logs
        (
          id,
          action,
          entity,
          entity_id,
          request_id,
          details,
          created_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7)
        `,

        [

          record.id,

          record.action,

          record.entity,

          record.entityId,

          record.requestId,

          JSON.stringify(
            record.details
          ),

          record.createdAt

        ]

      );

    } catch (error) {

      console.error(
        "[AUDIT]",
        error.message
      );

    }

  } else {

    memory.auditLogs.unshift(
      record
    );

  }

}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  async (req, res) => {

    const connected =
      await checkDatabase();

    res.json({

      platform: PLATFORM,

      version: VERSION,

      status:
        connected || !pool
          ? "online"
          : "degraded",

      server: {

        online: true,

        node: process.version,

        environment:
          process.env.NODE_ENV ||
          "production",

        uptime:
          process.uptime()

      },

      database: {

        configured:
          Boolean(pool),

        connected,

        mode:
          pool
            ? "postgresql"
            : "memory",

        message:
          pool
            ? (
              connected
                ? "PostgreSQL connected"
                : "PostgreSQL unavailable"
            )
            : "DATABASE_URL is not configured"

      },

      modules: {

        api: true,

        cms: true,

        ai: true,

        media: true,

        live: true,

        advertising: true,

        sponsorships: true,

        automation: true,

        analytics: true,

        search: true,

        authentication: true,

        audit: true

      },

      requestId:
        req.requestId,

      timestamp:
        now()

    });

  }
);

/* =========================================================
   API INFO
========================================================= */

app.get(
  "/api",
  (req, res) => {

    res.json({

      platform: PLATFORM,

      version: VERSION,

      status: "online",

      endpoints: [

        "/health",

        "/api/auth/login",

        "/api/dashboard",

        "/api/content",

        "/api/news",

        "/api/ai",

        "/api/media",

        "/api/live",

        "/api/advertising",

        "/api/sponsorships",

        "/api/search",

        "/api/analytics",

        "/api/admin"

      ]

    });

  }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/auth/login",
  async (req, res) => {

    const {
      email,
      password
    } = req.body || {};

    if (!email || !password) {

      return res.status(400).json({

        success: false,

        error:
          "email and password are required"

      });

    }

    let user = null;

    if (pool) {

      const result =
        await dbQuery(
          `
          SELECT
            id,
            name,
            email,
            role,
            password_hash
          FROM users
          WHERE email = $1
          LIMIT 1
          `,
          [email]
        );

      user =
        result.rows[0];

      if (
        !user ||
        user.password_hash !== password
      ) {

        return res.status(401).json({

          success: false,

          error:
            "Invalid credentials"

        });

      }

    } else {

      user =
        memory.users.find(
          item =>
            item.email === email &&
            item.password === password
        );

      if (!user) {

        return res.status(401).json({

          success: false,

          error:
            "Invalid credentials"

        });

      }

    }

    const token =
      jwt.sign(

        {

          id: user.id,

          email: user.email,

          role: user.role,

          name: user.name

        },

        JWT_SECRET,

        {

          expiresIn: "7d"

        }

      );

    await audit(
      req,
      "login",
      "user",
      user.id
    );

    res.json({

      success: true,

      token,

      user: {

        id: user.id,

        name: user.name,

        email: user.email,

        role: user.role

      }

    });

  }
);

/* =========================================================
   SECTIONS
========================================================= */

const sections = [

  ["news", "الأخبار"],

  ["saudi", "السعودية"],

  ["gulf", "الخليج"],

  ["world", "العالم"],

  ["economy", "اقتصاد"],

  ["technology", "تقنية وذكاء اصطناعي"],

  ["sports", "رياضة"],

  ["community", "مجتمع"],

  ["culture", "ثقافة"],

  ["tourism", "سياحة"],

  ["environment", "بيئة"],

  ["reports", "تقارير"],

  ["investigations", "تحقيقات"],

  ["interviews", "مقابلات"],

  ["video", "فيديو"],

  ["live", "البث المباشر"],

  ["my-content", "محتواي"],

  ["library", "المكتبة الإعلامية"],

  ["advertising", "الإعلانات"],

  ["sponsorships", "الرعايات"],

  ["ai", "الذكاء الاصطناعي"],

  ["operations", "غرفة العمليات"]

];

app.get(
  "/api/sections",
  (req, res) => {

    res.json(

      sections.map(
        ([slug, name]) => ({
          slug,
          name
        })
      )

    );

  }
);

/* =========================================================
   CONTENT
========================================================= */

app.get(
  "/api/content",
  auth(false),
  async (req, res) => {

    if (pool) {

      const result =
        await dbQuery(
          `
          SELECT *
          FROM content
          ORDER BY created_at DESC
          LIMIT 100
          `
        );

      return res.json({

        success: true,

        data:
          result.rows

      });

    }

    res.json({

      success: true,

      data:
        memory.content

    });

  }
);

app.post(
  "/api/content",
  auth(),
  async (req, res) => {

    const {

      title,

      body = "",

      section = "news",

      type = "article",

      status = "draft",

      tags = []

    } = req.body || {};

    if (!title) {

      return res.status(400).json({

        success: false,

        error:
          "title is required"

      });

    }

    const record = {

      id: id("content"),

      title,

      slug:
        slugify(title),

      body,

      section,

      type,

      status,

      tags,

      authorId:
        req.user.id,

      aiGenerated: false,

      requiresHumanApproval:
        status !== "published",

      createdAt:
        now(),

      updatedAt:
        now()

    };

    if (pool) {

      const result =
        await dbQuery(

          `
          INSERT INTO content
          (
            id,
            title,
            slug,
            body,
            section,
            type,
            status,
            author_id,
            ai_generated,
            requires_human_approval,
            tags,
            created_at,
            updated_at
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13
          )
          RETURNING *
          `,

          [

            record.id,

            record.title,

            record.slug,

            record.body,

            record.section,

            record.type,

            record.status,

            record.authorId,

            record.aiGenerated,

            record.requiresHumanApproval,

            JSON.stringify(tags),

            record.createdAt,

            record.updatedAt

          ]

        );

      await audit(
        req,
        "create",
        "content",
        record.id
      );

      return res.status(201).json({

        success: true,

        data:
          result.rows[0]

      });

    }

    memory.content.unshift(
      record
    );

    await audit(
      req,
      "create",
      "content",
      record.id
    );

    res.status(201).json({

      success: true,

      data: record

    });

  }
);

/* =========================================================
   AI ENGINE
========================================================= */

function analyzeText(text) {

  const clean =
    String(text)
      .replace(/\s+/g, " ")
      .trim();

  const words =
    clean
      ? clean.split(/\s+/)
      : [];

  const sentences =
    clean
      ? clean
          .split(/[.!؟]+/)
          .map(x => x.trim())
          .filter(Boolean)
      : [];

  const keywords =
    [
      ...new Set(
        words
          .filter(
            word =>
              word.length >= 4
          )
          .slice(0, 20)
      )
    ];

  let category =
    "news";

  if (
    /اقتصاد|استثمار|شركة|أسهم|مال/
      .test(clean)
  ) {

    category =
      "economy";

  } else if (
    /تقنية|ذكاء اصطناعي|برمجة|روبوت/
      .test(clean)
  ) {

    category =
      "technology";

  } else if (
    /رياضة|مباراة|نادي|لاعب/
      .test(clean)
  ) {

    category =
      "sports";

  } else if (
    /السعودية|الرياض|جدة|المدينة|مكة/
      .test(clean)
  ) {

    category =
      "saudi";

  }

  return {

    language:
      /[\u0600-\u06FF]/
        .test(clean)
        ? "ar"
        : "en",

    category,

    wordCount:
      words.length,

    sentenceCount:
      sentences.length,

    keywords,

    summary:
      clean.slice(0, 400)

  };

}

app.post(
  "/api/ai/analyze",
  auth(),
  async (req, res) => {

    const text =
      req.body?.text || "";

    if (!text) {

      return res.status(400).json({

        success: false,

        error:
          "text is required"

      });

    }

    const analysis =
      analyzeText(text);

    const job = {

      id:
        id("ai"),

      type:
        "analysis",

      status:
        "completed",

      input:
        text,

      output:
        analysis,

      createdAt:
        now()

    };

    if (pool) {

      await dbQuery(

        `
        INSERT INTO ai_jobs
        (
          id,
          type,
          status,
          input,
          output,
          created_at,
          updated_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7)
        `,

        [

          job.id,

          job.type,

          job.status,

          job.input,

          JSON.stringify(
            job.output
          ),

          job.createdAt,

          job.createdAt

        ]

      );

    } else {

      memory.aiJobs.unshift(
        job
      );

    }

    res.json({

      success: true,

      data: analysis,

      jobId:
        job.id

    });

  }
);

/* =========================================================
   AI NEWS DRAFT
========================================================= */

app.post(
  "/api/ai/draft",
  auth(),
  async (req, res) => {

    const {

      title = "",

      sourceText = "",

      section = "news",

      sourceUrl = ""

    } = req.body || {};

    if (!sourceText) {

      return res.status(400).json({

        success: false,

        error:
          "sourceText is required"

      });

    }

    const analysis =
      analyzeText(
        sourceText
      );

    const finalTitle =
      title ||
      analysis.summary
        .split(/[.!؟]/)[0]
        .slice(0, 140);

    const record = {

      id:
        id("content"),

      title:
        finalTitle,

      slug:
        slugify(finalTitle),

      body:
        sourceText,

      section,

      type:
        "article",

      status:
        "ai_review",

      sourceUrl,

      authorId:
        req.user.id,

      aiGenerated:
        true,

      requiresHumanApproval:
        true,

      aiAnalysis:
        analysis,

      createdAt:
        now(),

      updatedAt:
        now()

    };

    if (pool) {

      const result =
        await dbQuery(

          `
          INSERT INTO content
          (
            id,
            title,
            slug,
            body,
            section,
            type,
            status,
            source_url,
            author_id,
            ai_generated,
            ai_analysis,
            requires_human_approval,
            created_at,
            updated_at
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,$14
          )
          RETURNING *
          `,

          [

            record.id,

            record.title,

            record.slug,

            record.body,

            record.section,

            record.type,

            record.status,

            record.sourceUrl,

            record.authorId,

            true,

            JSON.stringify(
              record.aiAnalysis
            ),

            true,

            record.createdAt,

            record.updatedAt

          ]

        );

      return res.status(201).json({

        success: true,

        workflow: [

          "source",

          "analysis",

          "draft",

          "human_review",

          "approval",

          "publish"

        ],

        data:
          result.rows[0]

      });

    }

    memory.content.unshift(
      record
    );

    res.status(201).json({

      success: true,

      workflow: [

        "source",

        "analysis",

        "draft",

        "human_review",

        "approval",

        "publish"

      ],

      data: record

    });

  }
);

/* =========================================================
   MEDIA
========================================================= */

app.get(
  "/api/media",
  auth(false),
  async (req, res) => {

    if (pool) {

      const result =
        await dbQuery(
          `
          SELECT *
          FROM media
          ORDER BY created_at DESC
          LIMIT 100
          `
        );

      return res.json({

        success: true,

        data:
          result.rows

      });

    }

    res.json({

      success: true,

      data:
        memory.media

    });

  }
);

app.post(
  "/api/media",
  auth(),
  async (req, res) => {

    const {

      name,

      url,

      type = "video",

      mimeType = null,

      size = 0,

      alt = ""

    } = req.body || {};

    if (!name || !url) {

      return res.status(400).json({

        success: false,

        error:
          "name and url are required"

      });

    }

    const record = {

      id:
        id("media"),

      name,

      url,

      type,

      mimeType,

      size:
        Number(size) || 0,

      alt,

      ownerId:
        req.user.id,

      createdAt:
        now(),

      updatedAt:
        now()

    };

    if (!pool) {

      memory.media.unshift(
        record
      );

      return res.status(201).json({

        success: true,

        data: record

      });

    }

    const result =
      await dbQuery(

        `
        INSERT INTO media
        (
          id,
          name,
          url,
          type,
          mime_type,
          size,
          alt,
          owner_id,
          created_at,
          updated_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
        `,

        [

          record.id,

          record.name,

          record.url,

          record.type,

          record.mimeType,

          record.size,

          record.alt,

          record.ownerId,

          record.createdAt,

          record.updatedAt

        ]

      );

    res.status(201).json({

      success: true,

      data:
        result.rows[0]

    });

  }
);

/* =========================================================
   LIVE
========================================================= */

app.get(
  "/api/live",
  async (req, res) => {

    if (pool) {

      const result =
        await dbQuery(
          `
          SELECT *
          FROM live
          ORDER BY created_at DESC
          `
        );

      return res.json(
        result.rows
      );

    }

    res.json(
      memory.live
    );

  }
);

app.post(
  "/api/live",
  auth(),
  role("admin", "editor"),
  async (req, res) => {

    const {

      title,

      streamUrl,

      status = "scheduled",

      startsAt = null,

      description = ""

    } = req.body || {};

    if (!title || !streamUrl) {

      return res.status(400).json({

        success: false,

        error:
          "title and streamUrl are required"

      });

    }

    const record = {

      id:
        id("live"),

      title,

      streamUrl,

      status,

      startsAt,

      description,

      createdBy:
        req.user.id,

      createdAt:
        now(),

      updatedAt:
        now()

    };

    if (!pool) {

      memory.live.unshift(
        record
      );

      return res.status(201).json({

        success: true,

        data: record

      });

    }

    const result =
      await dbQuery(

        `
        INSERT INTO live
        (
          id,
          title,
          stream_url,
          status,
          starts_at,
          description,
          created_by,
          created_at,
          updated_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,

        [

          record.id,

          record.title,

          record.streamUrl,

          record.status,

          record.startsAt,

          record.description,

          record.createdBy,

          record.createdAt,

          record.updatedAt

        ]

      );

    res.status(201).json({

      success: true,

      data:
        result.rows[0]

    });

  }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
  "/api/search",
  async (req, res) => {

    const q =
      String(
        req.query.q || ""
      )
      .trim()
      .toLowerCase();

    if (!q) {

      return res.json([]);

    }

    if (pool) {

      const result =
        await dbQuery(

          `
          SELECT *
          FROM content
          WHERE
            LOWER(title) LIKE $1
            OR LOWER(body) LIKE $1
          ORDER BY created_at DESC
          LIMIT 50
          `,

          [`%${q}%`]

        );

      return res.json(
        result.rows
      );

    }

    const results =
      memory.content.filter(
        item =>
          `${item.title} ${item.body}`
            .toLowerCase()
            .includes(q)
      );

    res.json(
      results.slice(0, 50)
    );

  }
);

/* =========================================================
   ANALYTICS
========================================================= */

app.post(
  "/api/analytics/event",
  async (req, res) => {

    const record = {

      id:
        id("event"),

      event:
        req.body?.event ||
        "page_view",

      path:
        req.body?.path ||
        "/",

      metadata:
        req.body?.metadata ||
        {},

      createdAt:
        now()

    };

    if (!pool) {

      memory.analytics.unshift(
        record
      );

    } else {

      await dbQuery(

        `
        INSERT INTO analytics
        (
          id,
          event,
          path,
          metadata,
          created_at,
          updated_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6)
        `,

        [

          record.id,

          record.event,

          record.path,

          JSON.stringify(
            record.metadata
          ),

          record.createdAt,

          record.createdAt

        ]

      );

    }

    res.status(201).json({

      success: true,

      id:
        record.id

    });

  }
);

/* =========================================================
   ADMIN
========================================================= */

app.get(
  "/api/admin/audit",
  auth(),
  role("admin"),
  async (req, res) => {

    if (pool) {

      const result =
        await dbQuery(
          `
          SELECT *
          FROM audit_logs
          ORDER BY created_at DESC
          LIMIT 200
          `
        );

      return res.json(
        result.rows
      );

    }

    res.json(
      memory.auditLogs
    );

  }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
  "/api/dashboard",
  auth(false),
  async (req, res) => {

    if (pool) {

      const queries = {

        content:
          "SELECT COUNT(*) FROM content",

        media:
          "SELECT COUNT(*) FROM media",

        live:
          "SELECT COUNT(*) FROM live",

        ads:
          "SELECT COUNT(*) FROM advertisements",

        sponsorships:
          "SELECT COUNT(*) FROM sponsorships"

      };

      const results = {};

      for (
        const [key, sql]
        of Object.entries(queries)
      ) {

        try {

          const result =
            await dbQuery(sql);

          results[key] =
            Number(
              result.rows[0].count
            );

        } catch {

          results[key] = 0;

        }

      }

      return res.json({

        success: true,

        version: VERSION,

        database:
          "postgresql",

        statistics:
          results

      });

    }

    res.json({

      success: true,

      version: VERSION,

      database:
        "memory",

      statistics: {

        content:
          memory.content.length,

        media:
          memory.media.length,

        live:
          memory.live.length,

        advertisements:
          memory.advertisements.length,

        sponsorships:
          memory.sponsorships.length,

        aiJobs:
          memory.aiJobs.length,

        analytics:
          memory.analytics.length

      }

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

app.get(
  "*",
  (req, res, next) => {

    if (
      req.path.startsWith("/api") ||
      req.path === "/health"
    ) {

      return next();

    }

    res.sendFile(
      path.join(
        publicDirectory,
        "index.html"
      )
    );

  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      error:
        "Endpoint not found",

      path:
        req.originalUrl,

      requestId:
        req.requestId

    });

  }
);

/* =========================================================
   ERROR
========================================================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "[SERVER ERROR]",
      error
    );

    res.status(500).json({

      success: false,

      error:
        "Internal server error",

      requestId:
        req.requestId

    });

  }
);

/* =========================================================
   START
========================================================= */

const server =
  app.listen(
    PORT,
    HOST,
    () => {

      console.log(
        `EZ MEDIA ${VERSION} running on ${HOST}:${PORT}`
      );

    }
  );

/* =========================================================
   SHUTDOWN
========================================================= */

async function shutdown(
  signal
) {

  console.log(
    `${signal}: shutting down EZ MEDIA`
  );

  server.close(
    async () => {

      if (pool) {

        await pool
          .end()
          .catch(() => {});

      }

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
