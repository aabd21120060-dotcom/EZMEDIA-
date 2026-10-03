import express from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const VERSION = "11.0.0";

/* =========================================================
   EZ MEDIA — DATABASE
========================================================= */

const databaseUrl = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ""
).trim();

let pool = null;

if (databaseUrl) {
  try {
    pool = new Pool({
      connectionString: databaseUrl,

      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,

      max: Number(
        process.env.PG_POOL_MAX || 10
      ),

      idleTimeoutMillis: 30000,

      connectionTimeoutMillis: 10000
    });

    pool.on("error", (error) => {
      console.error(
        "[EZ MEDIA] PostgreSQL pool error:",
        error.message
      );
    });
  } catch (error) {
    console.error(
      "[EZ MEDIA] PostgreSQL initialization error:",
      error.message
    );

    pool = null;
  }
}

async function checkDatabase() {
  if (!databaseUrl) {
    return {
      configured: false,
      ready: false,
      databaseName: null,
      message:
        "DATABASE_URL is not configured"
    };
  }

  if (!pool) {
    return {
      configured: true,
      ready: false,
      databaseName: null,
      message:
        "PostgreSQL pool is not available"
    };
  }

  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        NOW() AS server_time
    `);

    return {
      configured: true,
      ready: true,
      databaseName:
        result.rows[0]?.database_name || null,
      serverTime:
        result.rows[0]?.server_time || null,
      message:
        "PostgreSQL connection is ready"
    };
  } catch (error) {
    return {
      configured: true,
      ready: false,
      databaseName: null,
      message: error.message
    };
  }
}

/* =========================================================
   EZ MEDIA — MEMORY FALLBACK
========================================================= */

const stories = new Map();
const workflowJobs = new Map();

/* =========================================================
   EXPRESS
========================================================= */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "50mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb"
  })
);

/* =========================================================
   ROOT
========================================================= */

app.get("/", (req, res) => {
  res.status(200).json({
    platform: "EZ MEDIA",
    version: VERSION,
    status: "online",
    message:
      "EZ MEDIA Platform is running",
    api: "/api",
    health: "/health"
  });
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", async (req, res) => {
  const database =
    await checkDatabase();

  res.status(200).json({
    platform: "EZ MEDIA",

    version: VERSION,

    build:
      "EZ-MEDIA-11-POSTGRES-2026-10-03",

    status:
      database.ready
        ? "healthy"
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

    database,

    features: {
      api: true,
      cms: true,
      storyObject: true,
      aiOrchestrator: true,
      workflowEngine: true,
      mediaLibrary: true,
      advertising: true,
      sponsorships: true,
      automation: true,
      worldRadar: false
    },

    timestamp:
      new Date().toISOString()
  });
});

/* =========================================================
   API ROOT
========================================================= */

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,

    platform: "EZ MEDIA",

    version: VERSION,

    status: "online",

    endpoints: {
      health: "/health",

      status: "/api/status",

      database: "/api/database",

      stories: "/api/stories",

      aiAgents:
        "/api/ai/agents",

      workflow:
        "/api/workflow/queue"
    }
  });
});

/* =========================================================
   API STATUS
========================================================= */

app.get("/api/status", async (req, res) => {
  const database =
    await checkDatabase();

  res.status(200).json({
    success: true,

    platform: "EZ MEDIA",

    version: VERSION,

    status:
      database.ready
        ? "healthy"
        : "degraded",

    server: "online",

    database,

    timestamp:
      new Date().toISOString()
  });
});

/* =========================================================
   DATABASE STATUS
========================================================= */

app.get(
  "/api/database",
  async (req, res) => {
    const database =
      await checkDatabase();

    res.status(
      database.ready ? 200 : 503
    ).json({
      success:
        database.ready,

      database
    });
  }
);

/* =========================================================
   CREATE STORY
========================================================= */

app.post(
  "/api/stories",
  async (req, res) => {
    try {
      const storyId =
        crypto.randomUUID();

      const storyKey =
        `EZ-${Date.now()}`;

      const story = {
        id: storyId,

        storyKey,

        title:
          req.body?.title || null,

        subtitle:
          req.body?.subtitle || null,

        summary:
          req.body?.summary || null,

        body:
          req.body?.body || null,

        contentType:
          req.body?.contentType ||
          "news",

        language:
          req.body?.language ||
          "ar",

        status: "draft",

        primaryCategory: null,

        secondaryCategories: [],

        topics: [],

        country: null,

        region: null,

        city: null,

        district: null,

        place: null,

        entities: [],

        sources: [],

        rights: {},

        ai: {
          status: "pending",
          agents: []
        },

        confidenceScore: 0,

        importanceScore: 0,

        breakingCandidate: false,

        createdAt:
          new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      };

      /* =========================================
         SAVE TO POSTGRESQL WHEN AVAILABLE
      ========================================= */

      if (pool) {
        try {
          await pool.query(
            `
            CREATE TABLE IF NOT EXISTS ez_stories (
              id UUID PRIMARY KEY,
              story_key TEXT UNIQUE NOT NULL,
              title TEXT,
              subtitle TEXT,
              summary TEXT,
              body TEXT,
              content_type TEXT NOT NULL,
              language TEXT NOT NULL,
              status TEXT NOT NULL,
              primary_category TEXT,
              secondary_categories JSONB DEFAULT '[]',
              topics JSONB DEFAULT '[]',
              country TEXT,
              region TEXT,
              city TEXT,
              district TEXT,
              place TEXT,
              entities JSONB DEFAULT '[]',
              sources JSONB DEFAULT '[]',
              rights JSONB DEFAULT '{}',
              ai JSONB DEFAULT '{}',
              confidence_score NUMERIC DEFAULT 0,
              importance_score NUMERIC DEFAULT 0,
              breaking_candidate BOOLEAN DEFAULT false,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            `
          );

          await pool.query(
            `
            INSERT INTO ez_stories (
              id,
              story_key,
              title,
              subtitle,
              summary,
              body,
              content_type,
              language,
              status,
              ai
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10
            )
            `,
            [
              story.id,
              story.storyKey,
              story.title,
              story.subtitle,
              story.summary,
              story.body,
              story.contentType,
              story.language,
              story.status,
              JSON.stringify(
                story.ai
              )
            ]
          );
        } catch (databaseError) {
          console.error(
            "[EZ MEDIA] Story database error:",
            databaseError.message
          );
        }
      }

      stories.set(
        story.id,
        story
      );

      res.status(201).json({
        success: true,

        storage:
          pool
            ? "postgresql"
            : "memory",

        story
      });
    } catch (error) {
      console.error(
        "[EZ MEDIA] Story creation error:",
        error
      );

      res.status(500).json({
        success: false,

        error:
          error.message
      });
    }
  }
);

/* =========================================================
   LIST STORIES
========================================================= */

app.get(
  "/api/stories",
  async (req, res) => {
    try {
      if (pool) {
        try {
          const result =
            await pool.query(`
              SELECT *
              FROM ez_stories
              ORDER BY created_at DESC
              LIMIT 100
            `);

          return res.json({
            success: true,

            storage:
              "postgresql",

            count:
              result.rows.length,

            stories:
              result.rows
          });
        } catch (error) {
          console.error(
            "[EZ MEDIA] Story list database error:",
            error.message
          );
        }
      }

      res.json({
        success: true,

        storage: "memory",

        count:
          stories.size,

        stories:
          Array.from(
            stories.values()
          )
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          error.message
      });
    }
  }
);

/* =========================================================
   GET STORY
========================================================= */

app.get(
  "/api/stories/:id",
  async (req, res) => {
    try {
      if (pool) {
        try {
          const result =
            await pool.query(
              `
              SELECT *
              FROM ez_stories
              WHERE id = $1
              LIMIT 1
              `,
              [req.params.id]
            );

          if (
            result.rows.length
          ) {
            return res.json({
              success: true,

              storage:
                "postgresql",

              story:
                result.rows[0]
            });
          }
        } catch (error) {
          console.error(
            "[EZ MEDIA] Story lookup error:",
            error.message
          );
        }
      }

      const story =
        stories.get(
          req.params.id
        );

      if (!story) {
        return res.status(404).json({
          success: false,

          error:
            "Story not found"
        });
      }

      res.json({
        success: true,

        storage: "memory",

        story
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          error.message
      });
    }
  }
);

/* =========================================================
   UPDATE STORY
========================================================= */

app.patch(
  "/api/stories/:id",
  async (req, res) => {
    const story =
      stories.get(
        req.params.id
      );

    if (story) {
      const allowedFields = [
        "title",
        "subtitle",
        "summary",
        "body",
        "contentType",
        "primaryCategory",
        "secondaryCategories",
        "topics",
        "country",
        "region",
        "city",
        "district",
        "place",
        "confidenceScore",
        "importanceScore",
        "breakingCandidate",
        "status"
      ];

      for (
        const field
        of allowedFields
      ) {
        if (
          req.body?.[field] !==
          undefined
        ) {
          story[field] =
            req.body[field];
        }
      }

      story.updatedAt =
        new Date().toISOString();

      stories.set(
        story.id,
        story
      );
    }

    if (pool) {
      try {
        await pool.query(
          `
          UPDATE ez_stories
          SET
            title = COALESCE($2, title),
            subtitle = COALESCE($3, subtitle),
            summary = COALESCE($4, summary),
            body = COALESCE($5, body),
            status = COALESCE($6, status),
            updated_at = NOW()
          WHERE id = $1
          `,
          [
            req.params.id,
            req.body?.title || null,
            req.body?.subtitle || null,
            req.body?.summary || null,
            req.body?.body || null,
            req.body?.status || null
          ]
        );
      } catch (error) {
        console.error(
          "[EZ MEDIA] Story update database error:",
          error.message
        );
      }
    }

    const updated =
      stories.get(
        req.params.id
      );

    res.json({
      success: true,

      story:
        updated || null
    });
  }
);

/* =========================================================
   AI AGENTS
========================================================= */

app.get(
  "/api/ai/agents",
  (req, res) => {
    res.json({
      success: true,

      agents: [
        {
          id:
            "EZ_RESEARCH_AGENT",
          name: "البحث",
          status: "ready"
        },

        {
          id:
            "EZ_DISCOVERY_AGENT",
          name: "اكتشاف القصص",
          status: "ready"
        },

        {
          id:
            "EZ_CLASSIFICATION_AGENT",
          name: "التصنيف الذكي",
          status: "ready"
        },

        {
          id:
            "EZ_VERIFICATION_AGENT",
          name: "التحقق",
          status: "ready"
        },

        {
          id:
            "EZ_EDITORIAL_AGENT",
          name: "التحرير",
          status: "ready"
        },

        {
          id:
            "EZ_SEO_AGENT",
          name: "تحسين الظهور",
          status: "ready"
        },

        {
          id:
            "EZ_SOCIAL_AGENT",
          name: "التوزيع الاجتماعي",
          status: "ready"
        },

        {
          id:
            "EZ_MONITORING_AGENT",
          name: "مراقبة القصة",
          status: "ready"
        }
      ]
    });
  }
);

/* =========================================================
   STORY AI ORCHESTRATION
========================================================= */

app.post(
  "/api/stories/:id/orchestrate",
  async (req, res) => {
    const story =
      stories.get(
        req.params.id
      );

    const agents = [
      "EZ_RESEARCH_AGENT",
      "EZ_DISCOVERY_AGENT",
      "EZ_CLASSIFICATION_AGENT",
      "EZ_VERIFICATION_AGENT",
      "EZ_EDITORIAL_AGENT",
      "EZ_SEO_AGENT",
      "EZ_SOCIAL_AGENT",
      "EZ_MONITORING_AGENT"
    ];

    const runs =
      agents.map((agent) => ({
        id:
          crypto.randomUUID(),

        agent,

        status: "queued",

        createdAt:
          new Date().toISOString()
      }));

    if (story) {
      story.ai = {
        status: "queued",
        agents: runs
      };

      story.status =
        "researching";

      story.updatedAt =
        new Date().toISOString();

      stories.set(
        story.id,
        story
      );
    }

    res.json({
      success: true,

      storyId:
        req.params.id,

      orchestration: {
        status: "queued",

        agents:
          runs
      }
    });
  }
);

/* =========================================================
   WORKFLOW
========================================================= */

app.post(
  "/api/workflow/jobs",
  (req, res) => {
    const job = {
      id:
        crypto.randomUUID(),

      jobType:
        req.body?.jobType ||
        "content.process",

      priority:
        Number(
          req.body?.priority ||
          50
        ),

      status: "queued",

      payload:
        req.body?.payload ||
        {},

      createdAt:
        new Date().toISOString()
    };

    workflowJobs.set(
      job.id,
      job
    );

    res.status(201).json({
      success: true,

      job
    });
  }
);

app.get(
  "/api/workflow/queue",
  (req, res) => {
    res.json({
      success: true,

      count:
        workflowJobs.size,

      jobs:
        Array.from(
          workflowJobs.values()
        )
    });
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
        req.originalUrl
    });
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "[EZ MEDIA] Server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      success: false,

      error:
        "Internal server error"
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

const server =
  app.listen(
    PORT,
    HOST,
    async () => {
      console.log(
        "========================================"
      );

      console.log(
        "[EZ MEDIA] Platform started"
      );

      console.log(
        `[EZ MEDIA] Version: ${VERSION}`
      );

      console.log(
        `[EZ MEDIA] Node: ${process.version}`
      );

      console.log(
        `[EZ MEDIA] Port: ${PORT}`
      );

      console.log(
        `[EZ MEDIA] Environment: ${
          process.env.NODE_ENV ||
          "production"
        }`
      );

      console.log(
        `[EZ MEDIA] DATABASE_URL: ${
          databaseUrl
            ? "configured"
            : "not configured"
        }`
      );

      console.log(
        "========================================"
      );

      const database =
        await checkDatabase();

      console.log(
        "[EZ MEDIA] Database:",
        database
      );
    }
  );

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(
  signal
) {
  console.log(
    `[EZ MEDIA] ${signal} received`
  );

  try {
    if (pool) {
      await pool.end();

      console.log(
        "[EZ MEDIA] PostgreSQL connection closed"
      );
    }
  } catch (error) {
    console.error(
      "[EZ MEDIA] Database shutdown error:",
      error.message
    );
  }

  server.close(() => {
    console.log(
      "[EZ MEDIA] HTTP server stopped"
    );

    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "[EZ MEDIA] Forced shutdown"
    );

    process.exit(1);
  }, 10000).unref();
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

/* =========================================================
   PROCESS ERRORS
========================================================= */

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "[EZ MEDIA] Uncaught exception:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "[EZ MEDIA] Unhandled rejection:",
      reason
    );
  }
);
