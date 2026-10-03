import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();

const PORT = process.env.PORT || 3000;

const VERSION = "11.0.0";
const BUILD = "EZ-MEDIA-CONTENT-OS-2026-10-03";

app.use(express.json({ limit: "25mb" }));

/*
|--------------------------------------------------------------------------
| PostgreSQL
|--------------------------------------------------------------------------
*/

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

let pool = null;
let databaseReady = false;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("railway")
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on("error", (error) => {
    console.error("EZ MEDIA PostgreSQL ERROR:", error.message);
  });
}

/*
|--------------------------------------------------------------------------
| تهيئة قاعدة البيانات
|--------------------------------------------------------------------------
*/

async function initializeDatabase() {
  if (!pool) {
    console.log("DATABASE_URL is not configured");
    return;
  }

  try {
    await pool.query("SELECT NOW()");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        slug TEXT UNIQUE,
        description TEXT,
        content_type TEXT NOT NULL DEFAULT 'news',
        status TEXT NOT NULL DEFAULT 'draft',

        primary_category TEXT,
        secondary_categories JSONB DEFAULT '[]'::jsonb,
        topics JSONB DEFAULT '[]'::jsonb,

        country TEXT,
        region TEXT,
        city TEXT,
        place TEXT,

        event_name TEXT,

        people JSONB DEFAULT '[]'::jsonb,
        organizations JSONB DEFAULT '[]'::jsonb,

        language TEXT DEFAULT 'ar',

        source_url TEXT,
        source_name TEXT,

        rights_status TEXT DEFAULT 'unknown',

        ai_confidence NUMERIC DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_entities_status
      ON content_entities(status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_entities_type
      ON content_entities(content_type)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_entities_city
      ON content_entities(city)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_entities_created
      ON content_entities(created_at DESC)
    `);

    databaseReady = true;

    console.log("EZ MEDIA PostgreSQL: READY");
  } catch (error) {
    databaseReady = false;

    console.error(
      "EZ MEDIA PostgreSQL initialization failed:",
      error.message
    );
  }
}

/*
|--------------------------------------------------------------------------
| الصفحة الرئيسية
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    platform: "EZ MEDIA",
    version: VERSION,
    build: BUILD,
    status: "online",
    message: "EZ MEDIA Platform is running",
    api: "/api",
    health: "/health",
    database: databaseReady ? "ready" : "not_ready",
    timestamp: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get("/health", async (req, res) => {
  let database = {
    configured: Boolean(databaseUrl),
    ready: databaseReady
  };

  if (pool) {
    try {
      await pool.query("SELECT 1");
      database.ready = true;
      databaseReady = true;
    } catch {
      database.ready = false;
      databaseReady = false;
    }
  }

  res.json({
    platform: "EZ MEDIA",
    version: VERSION,
    build: BUILD,
    status: "healthy",

    server: {
      online: true,
      node: process.version,
      environment: process.env.NODE_ENV || "production",
      uptime: process.uptime()
    },

    database,

    timestamp: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  res.json({
    platform: "EZ MEDIA",
    version: VERSION,
    build: BUILD,
    status: "online",

    systems: {
      server: "online",
      api: "online",
      database: databaseReady ? "online" : "offline",
      contentOS: "ready",
      ai: "ready",
      mediaLibrary: "ready",
      automation: "ready",
      broadcasting: "ready",
      publishing: "ready",
      analytics: "ready"
    }
  });
});

/*
|--------------------------------------------------------------------------
| Database status
|--------------------------------------------------------------------------
*/

app.get("/api/database", async (req, res) => {
  if (!pool) {
    return res.json({
      configured: false,
      ready: false,
      message: "DATABASE_URL is not configured"
    });
  }

  try {
    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        current_database() AS database_name
    `);

    res.json({
      configured: true,
      ready: true,
      database: result.rows[0].database_name,
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    res.status(503).json({
      configured: true,
      ready: false,
      message: error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| Content OS
|--------------------------------------------------------------------------
*/

/*
| إنشاء Content Entity
*/

app.post("/api/content", async (req, res) => {
  if (!pool || !databaseReady) {
    return res.status(503).json({
      success: false,
      message: "Database is not ready"
    });
  }

  try {
    const {
      title,
      slug,
      description,
      contentType = "news",
      status = "draft",
      primaryCategory = null,
      secondaryCategories = [],
      topics = [],
      country = null,
      region = null,
      city = null,
      place = null,
      eventName = null,
      people = [],
      organizations = [],
      language = "ar",
      sourceUrl = null,
      sourceName = null,
      rightsStatus = "unknown",
      aiConfidence = 0,
      metadata = {}
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title is required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO content_entities (
        title,
        slug,
        description,
        content_type,
        status,
        primary_category,
        secondary_categories,
        topics,
        country,
        region,
        city,
        place,
        event_name,
        people,
        organizations,
        language,
        source_url,
        source_name,
        rights_status,
        ai_confidence,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      RETURNING *
      `,
      [
        title,
        slug || null,
        description || null,
        contentType,
        status,
        primaryCategory,
        JSON.stringify(secondaryCategories),
        JSON.stringify(topics),
        country,
        region,
        city,
        place,
        eventName,
        JSON.stringify(people),
        JSON.stringify(organizations),
        language,
        sourceUrl,
        sourceName,
        rightsStatus,
        aiConfidence,
        JSON.stringify(metadata)
      ]
    );

    res.status(201).json({
      success: true,
      content: result.rows[0]
    });
  } catch (error) {
    console.error("CREATE CONTENT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/*
| جلب المحتوى
*/

app.get("/api/content", async (req, res) => {
  if (!pool || !databaseReady) {
    return res.status(503).json({
      success: false,
      message: "Database is not ready"
    });
  }

  try {
    const limit = Math.min(
      Number(req.query.limit) || 50,
      200
    );

    const result = await pool.query(
      `
      SELECT *
      FROM content_entities
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    res.json({
      success: true,
      count: result.rows.length,
      content: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| البحث في Content OS
|--------------------------------------------------------------------------
*/

app.get("/api/content/search", async (req, res) => {
  if (!pool || !databaseReady) {
    return res.status(503).json({
      success: false,
      message: "Database is not ready"
    });
  }

  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.status(400).json({
      success: false,
      message: "q is required"
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM content_entities
      WHERE
        title ILIKE $1
        OR description ILIKE $1
        OR city ILIKE $1
        OR country ILIKE $1
        OR primary_category ILIKE $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [`%${q}%`]
    );

    res.json({
      success: true,
      query: q,
      count: result.rows.length,
      content: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| AI Agents
|--------------------------------------------------------------------------
*/

app.get("/api/ai/agents", (req, res) => {
  res.json({
    platform: "EZ MEDIA",
    orchestrator: "EZ AI ORCHESTRATOR",
    status: "ready",

    agents: [
      "EZ WORLD RADAR",
      "EZ DISCOVERY",
      "EZ RESEARCHER",
      "EZ VERIFY",
      "EZ STORY",
      "EZ EDITOR",
      "EZ VIDEO",
      "EZ AUDIO",
      "EZ LIVE",
      "EZ PUBLISHER",
      "EZ SOCIAL",
      "EZ ANALYTICS"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| Live
|--------------------------------------------------------------------------
*/

app.get("/api/live", (req, res) => {
  res.json({
    system: "EZ LIVE",
    status: "ready",
    live: false,
    broadcast: {
      website: true,
      social: true,
      broadcast: true
    }
  });
});

/*
|--------------------------------------------------------------------------
| Automation
|--------------------------------------------------------------------------
*/

app.get("/api/automation", (req, res) => {
  res.json({
    system: "EZ AUTOMATION",
    status: "ready",
    architecture: "event-driven",
    workflows: []
  });
});

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    platform: "EZ MEDIA",
    status: "not_found",
    path: req.originalUrl
  });
});

/*
|--------------------------------------------------------------------------
| Error handler
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  console.error("EZ MEDIA ERROR:", error);

  res.status(500).json({
    platform: "EZ MEDIA",
    status: "error",
    message: "Internal server error"
  });
});

/*
|--------------------------------------------------------------------------
| تشغيل الخادم
|--------------------------------------------------------------------------
*/

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log("EZ MEDIA");
    console.log(`Version: ${VERSION}`);
    console.log(`Build: ${BUILD}`);
    console.log(`Port: ${PORT}`);
    console.log(
      `Database: ${databaseReady ? "READY" : "NOT READY"}`
    );
    console.log("Status: ONLINE");
    console.log("========================================");
  });
}

startServer();
