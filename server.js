// ============================================================
// EZ MEDIA 11.0
// Production Server
// Node.js + Express + PostgreSQL
// ============================================================

"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");

// ============================================================
// إعدادات المنصة
// ============================================================

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "production";
const VERSION = "11.0.0";
const PLATFORM = "EZ MEDIA";

// ============================================================
// Middleware
// ============================================================

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// ============================================================
// PostgreSQL
// ============================================================

let pool = null;

function createDatabasePool() {
  if (!process.env.DATABASE_URL) {
    console.warn(
      "[EZ MEDIA] DATABASE_URL غير موجود في Environment Variables"
    );

    return null;
  }

  console.log("[EZ MEDIA] DATABASE_URL موجود");

  return new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
      NODE_ENV === "production"
        ? {
            rejectUnauthorized: false,
          }
        : false,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000,
  });
}

pool = createDatabasePool();

// ============================================================
// فحص قاعدة البيانات
// ============================================================

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    return {
      configured: false,
      ready: false,
      message: "DATABASE_URL is not configured",
    };
  }

  if (!pool) {
    return {
      configured: true,
      ready: false,
      message: "Database pool was not created",
    };
  }

  try {
    const result = await pool.query(
      "SELECT NOW() AS now, current_database() AS database"
    );

    return {
      configured: true,
      ready: true,
      message: "PostgreSQL connected",
      database: result.rows[0].database,
      serverTime: result.rows[0].now,
    };
  } catch (error) {
    console.error(
      "[EZ MEDIA] Database connection error:",
      error.message
    );

    return {
      configured: true,
      ready: false,
      message: error.message,
    };
  }
}

// ============================================================
// إنشاء جداول EZ MEDIA
// ============================================================

async function initializeDatabase() {
  if (!pool) {
    console.warn(
      "[EZ MEDIA] Database initialization skipped"
    );

    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ========================================================
    // المستخدمون
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash TEXT,
        role VARCHAR(50) NOT NULL DEFAULT 'editor',
        avatar_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // الأخبار والمحتوى
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS content (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE,
        excerpt TEXT,
        body TEXT,
        content_type VARCHAR(50) NOT NULL DEFAULT 'article',
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        source_name TEXT,
        source_url TEXT,
        featured_image TEXT,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // الأقسام
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // مكتبة الوسائط
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id UUID PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type VARCHAR(100),
        mime_type VARCHAR(150),
        file_size BIGINT,
        uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // الإعلانات
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS advertisements (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        advertiser VARCHAR(255),
        type VARCHAR(50) NOT NULL DEFAULT 'banner',
        content TEXT,
        image_url TEXT,
        target_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // الرعاية
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS sponsorships (
        id UUID PRIMARY KEY,
        sponsor_name VARCHAR(255) NOT NULL,
        package_name VARCHAR(255),
        description TEXT,
        logo_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // البث المباشر
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS live_streams (
        id UUID PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        stream_url TEXT,
        playback_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'offline',
        thumbnail_url TEXT,
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // مصادر الأخبار
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS news_sources (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        feed_url TEXT,
        source_type VARCHAR(50) NOT NULL DEFAULT 'rss',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // مهام الأتمتة
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_jobs (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        job_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        payload JSONB,
        result JSONB,
        error_message TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ========================================================
    // سجل النظام
    // ========================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id UUID PRIMARY KEY,
        level VARCHAR(30) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query("COMMIT");

    console.log(
      "[EZ MEDIA] Database tables initialized successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "[EZ MEDIA] Database initialization error:",
      error.message
    );

    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// الصفحة الرئيسية
// ============================================================

app.get("/", async (req, res) => {
  const requestId = crypto.randomUUID();

  res.json({
    platform: PLATFORM,
    version: VERSION,
    status: "online",
    message: "EZ MEDIA 11.0 يعمل بنجاح",
    requestId,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// Health Check
// ============================================================

app.get("/health", async (req, res) => {
  const requestId = crypto.randomUUID();

  const database = await checkDatabase();

  const status = database.ready
    ? "online"
    : "degraded";

  res.status(database.ready ? 200 : 503).json({
    platform: PLATFORM,
    version: VERSION,
    status,
    server: {
      online: true,
      node: process.version,
      environment: NODE_ENV,
      uptime: process.uptime(),
    },
    database,
    requestId,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// فحص قاعدة البيانات فقط
// ============================================================

app.get("/api/database/health", async (req, res) => {
  const database = await checkDatabase();

  res.status(database.ready ? 200 : 503).json({
    platform: PLATFORM,
    version: VERSION,
    database,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// معلومات المنصة
// ============================================================

app.get("/api/status", async (req, res) => {
  const database = await checkDatabase();

  res.json({
    platform: PLATFORM,
    version: VERSION,

    status: database.ready
      ? "online"
      : "degraded",

    database,

    features: {
      api: true,
      cms: true,
      mediaLibrary: true,
      advertising: true,
      sponsorships: true,
      automation: true,
      liveStreaming: true,
      aiReady: true,
    },

    server: {
      node: process.version,
      environment: NODE_ENV,
      uptime: process.uptime(),
    },

    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// API: الإحصائيات
// ============================================================

app.get("/api/dashboard/stats", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: "Database is not configured",
    });
  }

  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM content) AS content,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM media) AS media,
        (SELECT COUNT(*) FROM advertisements) AS advertisements,
        (SELECT COUNT(*) FROM sponsorships) AS sponsorships,
        (SELECT COUNT(*) FROM live_streams) AS live_streams
    `);

    res.json({
      success: true,
      platform: PLATFORM,
      stats: result.rows[0],
    });
  } catch (error) {
    console.error(
      "[EZ MEDIA] Stats error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// API: إنشاء محتوى
// ============================================================

app.post("/api/content", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: "Database is not configured",
    });
  }

  const {
    title,
    slug,
    excerpt,
    body,
    content_type,
    status,
    source_name,
    source_url,
    featured_image,
  } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      message: "title is required",
    });
  }

  try {
    const id = crypto.randomUUID();

    const result = await pool.query(
      `
      INSERT INTO content (
        id,
        title,
        slug,
        excerpt,
        body,
        content_type,
        status,
        source_name,
        source_url,
        featured_image
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      RETURNING *
      `,
      [
        id,
        title,
        slug || null,
        excerpt || null,
        body || null,
        content_type || "article",
        status || "draft",
        source_name || null,
        source_url || null,
        featured_image || null,
      ]
    );

    res.status(201).json({
      success: true,
      content: result.rows[0],
    });
  } catch (error) {
    console.error(
      "[EZ MEDIA] Content creation error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// API: جلب المحتوى
// ============================================================

app.get("/api/content", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: "Database is not configured",
    });
  }

  try {
    const result = await pool.query(`
      SELECT *
      FROM content
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "[EZ MEDIA] Content query error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ============================================================
// معالجة الأخطاء
// ============================================================

app.use((err, req, res, next) => {
  console.error(
    "[EZ MEDIA] Server error:",
    err
  );

  res.status(500).json({
    success: false,
    platform: PLATFORM,
    version: VERSION,
    message: "Internal server error",
  });
});

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    platform: PLATFORM,
    version: VERSION,
    message: "Endpoint not found",
    path: req.originalUrl,
  });
});

// ============================================================
// تشغيل الخادم
// ============================================================

const server = app.listen(PORT, async () => {
  console.log("==========================================");
  console.log("       EZ MEDIA 11.0");
  console.log("==========================================");
  console.log(`Platform: ${PLATFORM}`);
  console.log(`Version: ${VERSION}`);
  console.log(`Node: ${process.version}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Port: ${PORT}`);
  console.log("==========================================");

  try {
    await initializeDatabase();

    const database = await checkDatabase();

    console.log(
      "[EZ MEDIA] Database status:",
      database
    );
  } catch (error) {
    console.error(
      "[EZ MEDIA] Startup database error:",
      error.message
    );
  }

  console.log(
    "[EZ MEDIA] Server is running successfully"
  );
});

// ============================================================
// إغلاق قاعدة البيانات
// ============================================================

async function closeDatabase() {
  if (!pool) {
    return;
  }

  await pool.end();

  console.log(
    "[EZ MEDIA] Database connection closed"
  );
}

// ============================================================
// SIGTERM
// ============================================================

process.on("SIGTERM", async () => {
  console.log(
    "[EZ MEDIA] SIGTERM received"
  );

  try {
    await closeDatabase();
  } catch (error) {
    console.error(
      "[EZ MEDIA] Database shutdown error:",
      error.message
    );
  }

  server.close(() => {
    process.exit(0);
  });
});

// ============================================================
// SIGINT
// ============================================================

process.on("SIGINT", async () => {
  console.log(
    "[EZ MEDIA] SIGINT received"
  );

  try {
    await closeDatabase();
  } catch (error) {
    console.error(
      "[EZ MEDIA] Database shutdown error:",
      error.message
    );
  }

  server.close(() => {
    process.exit(0);
  });
});

// ============================================================
// أخطاء PostgreSQL غير المعالجة
// ============================================================

if (pool) {
  pool.on("error", (error) => {
    console.error(
      "[EZ MEDIA] Unexpected PostgreSQL error:",
      error.message
    );
  });
}
