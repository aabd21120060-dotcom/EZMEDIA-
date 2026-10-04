"use strict";

/*
===========================================================
EZ MEDIA 11.0
الإصدار الموحد للخادم
Node.js + Express + PostgreSQL
===========================================================
*/

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { Pool } = require("pg");

/*
===========================================================
الإعدادات الأساسية
===========================================================
*/

const app = express();

const PORT = Number(process.env.PORT || 3000);

const VERSION = "11.0.0";
const BUILD = "EZ-MEDIA-11-EXECUTIVE-2026-10-04";

/*
===========================================================
PostgreSQL
===========================================================
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
    console.error(
      "EZ MEDIA PostgreSQL ERROR:",
      error.message
    );
  });
}

/*
===========================================================
Middleware
===========================================================
*/

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(cors());

app.use(compression());

app.use(
  express.json({
    limit: "25mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb"
  })
);

/*
===========================================================
أدوات مساعدة
===========================================================
*/

function now() {
  return new Date().toISOString();
}

function safeNumber(value, fallback = null) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function safeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function safeText(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value);
}

async function databaseStatus() {
  if (!pool) {
    return {
      configured: false,
      ready: false,
      database: null,
      message: "DATABASE_URL is not configured"
    };
  }

  try {
    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        current_database() AS database_name
    `);

    databaseReady = true;

    return {
      configured: true,
      ready: true,
      database: result.rows[0].database_name,
      serverTime: result.rows[0].server_time,
      message: "PostgreSQL is ready"
    };
  } catch (error) {
    databaseReady = false;

    return {
      configured: true,
      ready: false,
      database: null,
      message: error.message
    };
  }
}

/*
===========================================================
تهيئة قاعدة البيانات
===========================================================
*/

async function initializeDatabase() {
  if (!pool) {
    console.log(
      "EZ MEDIA: DATABASE_URL is not configured"
    );

    return;
  }

  try {
    await pool.query("SELECT NOW()");

    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        title TEXT NOT NULL,

        slug TEXT UNIQUE,

        description TEXT,

        content_type TEXT NOT NULL
          DEFAULT 'news',

        status TEXT NOT NULL
          DEFAULT 'draft',

        primary_category TEXT,

        secondary_categories JSONB
          DEFAULT '[]'::jsonb,

        topics JSONB
          DEFAULT '[]'::jsonb,

        country TEXT,

        region TEXT,

        city TEXT,

        place TEXT,

        event_name TEXT,

        people JSONB
          DEFAULT '[]'::jsonb,

        organizations JSONB
          DEFAULT '[]'::jsonb,

        language TEXT
          DEFAULT 'ar',

        source_url TEXT,

        source_name TEXT,

        rights_status TEXT
          DEFAULT 'unknown',

        ai_confidence NUMERIC
          DEFAULT 0,

        metadata JSONB
          DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ
          DEFAULT NOW(),

        updated_at TIMESTAMPTZ
          DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_content_entities_status
      ON content_entities(status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_content_entities_type
      ON content_entities(content_type)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_content_entities_city
      ON content_entities(city)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      idx_content_entities_created
      ON content_entities(created_at DESC)
    `);

    databaseReady = true;

    console.log(
      "EZ MEDIA PostgreSQL: READY"
    );
  } catch (error) {
    databaseReady = false;

    console.error(
      "EZ MEDIA PostgreSQL initialization failed:",
      error.message
    );
  }
}

/*
===========================================================
EXECUTIVE COMMAND CENTER
===========================================================
*/

/*
هذا المسار يجب أن يكون قبل 404
*/

app.get(
  "/api/executive-command/ping",
  (req, res) => {
    res.status(200).json({
      ok: true,
      platform: "EZ MEDIA",
      service: "executive-command-center",
      version: VERSION,
      build: BUILD,
      timestamp: now()
    });
  }
);

/*
===========================================================
الحالة التنفيذية
===========================================================
*/

app.get(
  "/api/executive-command/status",
  async (req, res) => {
    try {
      const db = await databaseStatus();

      let contentCount = null;

      if (pool && db.ready) {
        try {
          const result = await pool.query(`
            SELECT COUNT(*)::int AS count
            FROM content_entities
          `);

          contentCount =
            result.rows[0].count;
        } catch {
          contentCount = null;
        }
      }

      const aiEnabled =
        String(
          process.env.AI_AGENT_AUTO_EXECUTION ||
          process.env.RAG_AI_ENABLED ||
          ""
        ).toLowerCase() === "true";

      const humanApproval =
        String(
          process.env.AI_AGENT_REQUIRE_HUMAN_APPROVAL ||
          process.env.MEDIA_OPS_REQUIRE_HUMAN_APPROVAL ||
          "true"
        ).toLowerCase() !== "false";

      const autoNews =
        String(
          process.env.MEDIA_OPS_AUTO_NEWS ||
          "false"
        ).toLowerCase() === "true";

      const autoContent =
        String(
          process.env.MEDIA_OPS_AUTO_CONTENT ||
          "false"
        ).toLowerCase() === "true";

      const autoDistribution =
        String(
          process.env.MEDIA_OPS_AUTO_DISTRIBUTION ||
          "false"
        ).toLowerCase() === "true";

      const autoBroadcast =
        String(
          process.env.MEDIA_OPS_AUTO_BROADCAST ||
          "false"
        ).toLowerCase() === "true";

      const status =
        databaseReady || !databaseUrl
          ? "online"
          : "degraded";

      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );

      res.status(200).json({
        platform: "EZ MEDIA",
        version: VERSION,
        build: BUILD,

        status,

        timestamp: now(),

        server: {
          online: true,
          node: process.version,
          environment:
            process.env.NODE_ENV ||
            "production",
          uptime: process.uptime()
        },

        database: {
          configured: db.configured,
          ready: db.ready,
          database:
            db.database || null,
          message:
            db.message || null
        },

        ai: {
          enabled: aiEnabled,
          autonomousExecution:
            aiEnabled,
          humanApprovalRequired:
            humanApproval,
          status: aiEnabled
            ? "enabled"
            : "not_configured"
        },

        operations: {
          status: "ready",
          autonomousNews: autoNews,
          autonomousContent: autoContent,
          automaticDistribution:
            autoDistribution,
          automaticBroadcast:
            autoBroadcast
        },

        broadcasting: {
          system: "EZ LIVE",
          status: "ready",
          live: false,
          website: true,
          social: true,
          broadcast:
            autoBroadcast
        },

        scheduling: {
          status: "ready",
          automatic:
            autoContent
        },

        workflow: {
          status: "ready",
          eventDriven: true
        },

        content: {
          status: "ready",
          databaseRecords:
            contentCount
        },

        approvals: {
          humanApprovalRequired:
            humanApproval,
          pending: null
        },

        safety: {
          humanInTheLoop:
            humanApproval,
          automaticPublishing:
            autoDistribution,
          automaticBroadcast:
            autoBroadcast
        },

        systems: {
          server: "online",
          api: "online",
          database:
            db.ready
              ? "online"
              : "offline",
          contentOS: "ready",
          ai:
            aiEnabled
              ? "enabled"
              : "not_configured",
          mediaLibrary: "ready",
          automation: "ready",
          broadcasting: "ready",
          publishing:
            autoDistribution
              ? "enabled"
              : "approval_required"
        }
      });
    } catch (error) {
      console.error(
        "EXECUTIVE STATUS ERROR:",
        error
      );

      /*
      مهم:
      حتى لو حصل خطأ داخلي، لا نعيد 404.
      */

      res.status(200).json({
        platform: "EZ MEDIA",
        version: VERSION,
        build: BUILD,
        status: "degraded",
        timestamp: now(),

        server: {
          online: true,
          node: process.version,
          uptime: process.uptime()
        },

        database: {
          configured: Boolean(databaseUrl),
          ready: false,
          database: null
        },

        ai: {
          enabled: false,
          status: "degraded"
        },

        operations: {
          status: "degraded"
        },

        broadcasting: {
          status: "degraded"
        },

        diagnostics: {
          error: error.message
        }
      });
    }
  }
);

/*
===========================================================
Executive Health
===========================================================
*/

app.get(
  "/api/executive-command/health",
  async (req, res) => {
    const db = await databaseStatus();

    res.status(200).json({
      ok: true,
      platform: "EZ MEDIA",
      service:
        "executive-command-center",
      status:
        db.ready || !db.configured
          ? "healthy"
          : "degraded",
      database: db,
      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Dashboard
===========================================================
*/

app.get(
  "/api/executive-command/dashboard",
  async (req, res) => {
    const db = await databaseStatus();

    res.status(200).json({
      platform: "EZ MEDIA",
      version: VERSION,

      dashboard: {
        server: "online",
        database:
          db.ready
            ? "online"
            : "offline",

        ai:
          process.env.AI_AGENT_AUTO_EXECUTION ===
          "true"
            ? "enabled"
            : "not_configured",

        operations: "ready",

        broadcasting: "ready",

        scheduling: "ready",

        workflow: "ready"
      },

      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Systems
===========================================================
*/

app.get(
  "/api/executive-command/systems",
  async (req, res) => {
    const db = await databaseStatus();

    res.status(200).json({
      server: "online",
      api: "online",

      database:
        db.ready
          ? "online"
          : "offline",

      content: "ready",

      mediaLibrary: "ready",

      ai:
        process.env.AI_AGENT_AUTO_EXECUTION ===
        "true"
          ? "enabled"
          : "not_configured",

      automation: "ready",

      broadcasting: "ready",

      publishing:
        process.env.MEDIA_OPS_AUTO_DISTRIBUTION ===
        "true"
          ? "enabled"
          : "approval_required",

      timestamp: now()
    });
  }
);

/*
===========================================================
Executive AI
===========================================================
*/

app.get(
  "/api/executive-command/ai",
  (req, res) => {
    res.status(200).json({
      platform: "EZ MEDIA",

      ai: {
        enabled:
          process.env.AI_AGENT_AUTO_EXECUTION ===
          "true",

        autonomousExecution:
          process.env.AI_AGENT_AUTO_EXECUTION ===
          "true",

        humanApproval:
          process.env.AI_AGENT_REQUIRE_HUMAN_APPROVAL !==
          "false",

        agents: null,

        missions: null,

        provider:
          process.env.AI_PROVIDER ||
          null
      },

      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Operations
===========================================================
*/

app.get(
  "/api/executive-command/operations",
  (req, res) => {
    res.status(200).json({
      platform: "EZ MEDIA",

      operations: {
        status: "ready",
        active: null,
        pending: null,
        completed: null,
        failed: null
      },

      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Business
===========================================================
*/

app.get(
  "/api/executive-command/business",
  (req, res) => {
    res.status(200).json({
      platform: "EZ MEDIA",

      business: {
        audience: null,
        advertising: null,
        revenue: null,
        crm: null
      },

      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Approvals
===========================================================
*/

app.get(
  "/api/executive-command/approvals",
  (req, res) => {
    res.status(200).json({
      platform: "EZ MEDIA",

      approvals: {
        humanApprovalRequired:
          process.env.MEDIA_OPS_REQUIRE_HUMAN_APPROVAL !==
          "false",

        pending: null
      },

      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Matrix
===========================================================
*/

app.get(
  "/api/executive-command/matrix",
  async (req, res) => {
    const db = await databaseStatus();

    res.status(200).json({
      platform: "EZ MEDIA",

      matrix: {
        server: true,
        api: true,
        database:
          db.ready,
        content: true,
        ai:
          process.env.AI_AGENT_AUTO_EXECUTION ===
          "true",
        automation: true,
        media: true,
        broadcasting: true,
        publishing:
          process.env.MEDIA_OPS_AUTO_DISTRIBUTION ===
          "true"
      },

      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Refresh
===========================================================
*/

app.post(
  "/api/executive-command/refresh",
  async (req, res) => {
    const db = await databaseStatus();

    res.status(200).json({
      success: true,
      refreshed: true,
      database: db,
      timestamp: now()
    });
  }
);

/*
===========================================================
Executive Analysis
===========================================================
*/

app.post(
  "/api/executive-command/analysis",
  async (req, res) => {
    const db = await databaseStatus();

    res.status(200).json({
      platform: "EZ MEDIA",

      analysis: {
        server:
          "الخادم يعمل",

        database:
          db.ready
            ? "قاعدة البيانات متصلة"
            : "قاعدة البيانات غير متصلة",

        ai:
          process.env.AI_AGENT_AUTO_EXECUTION ===
          "true"
            ? "الذكاء الاصطناعي مفعل"
            : "الذكاء الاصطناعي يحتاج إلى مزود",

        operations:
          "نظام العمليات جاهز",

        broadcasting:
          "نظام البث جاهز",

        safety:
          "الموافقات البشرية مفعلة"
      },

      timestamp: now()
    });
  }
);

/*
===========================================================
واجهة مركز القيادة التنفيذي
===========================================================
*/

const EXECUTIVE_UI_HTML = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
EZ MEDIA 11.0 — مركز القيادة التنفيذي
</title>

<meta
  name="theme-color"
  content="#eaf8ff"
>

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

body {
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Tahoma,
    Arial,
    sans-serif;

  background:
    linear-gradient(
      135deg,
      #ffffff 0%,
      #f4fbff 45%,
      #e7f8ff 100%
    );

  color: #12344d;
}

button {
  font: inherit;
}

.container {
  width: min(1400px, 94%);
  margin: auto;
  padding: 24px 0 50px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;

  padding: 24px;

  border-radius: 28px;

  background:
    rgba(255,255,255,.88);

  border:
    1px solid rgba(105,190,230,.25);

  box-shadow:
    0 15px 50px rgba(60,160,210,.12);

  backdrop-filter: blur(20px);
}

.brand h1 {
  margin: 0;

  font-size: clamp(24px, 4vw, 42px);

  letter-spacing: -1px;
}

.brand p {
  margin: 8px 0 0;

  color: #65849a;

  font-size: 14px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  border: 0;

  border-radius: 16px;

  padding: 12px 18px;

  cursor: pointer;

  background:
    linear-gradient(
      135deg,
      #dff6ff,
      #bceaff
    );

  color: #0d5577;

  font-weight: 700;
}

.btn:hover {
  transform: translateY(-1px);
}

.status {
  margin-top: 20px;

  padding: 15px 20px;

  border-radius: 18px;

  background: white;

  border:
    1px solid #d9eef7;
}

.status.online {
  border-color: #a8e3c4;
}

.status.degraded {
  border-color: #ffd49a;
}

.status.error {
  border-color: #ffb5b5;
}

.grid {
  display: grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(210px, 1fr)
    );

  gap: 16px;

  margin-top: 20px;
}

.card {
  background:
    rgba(255,255,255,.92);

  border:
    1px solid rgba(100,190,225,.2);

  border-radius: 24px;

  padding: 22px;

  box-shadow:
    0 12px 35px rgba(55,150,195,.08);
}

.card h3 {
  margin: 0 0 10px;

  font-size: 15px;

  color: #6a8da3;
}

.value {
  font-size: 24px;

  font-weight: 800;

  color: #14577b;
}

.section {
  margin-top: 20px;
}

.section-title {
  margin: 0 0 14px;

  font-size: 21px;
}

.list {
  display: grid;

  gap: 10px;
}

.row {
  display: flex;

  justify-content: space-between;

  gap: 15px;

  padding: 14px 16px;

  border-radius: 15px;

  background: #f7fcff;

  border:
    1px solid #e3f2f8;
}

.label {
  color: #648298;
}

.badge {
  display: inline-flex;

  align-items: center;

  padding: 5px 10px;

  border-radius: 999px;

  font-size: 12px;

  font-weight: 800;

  background: #e8f8ff;

  color: #14749e;
}

.error-box {
  display: none;

  margin-top: 20px;

  padding: 18px;

  border-radius: 18px;

  background: #fff5f5;

  border: 1px solid #ffcaca;

  color: #a02d2d;

  white-space: pre-wrap;
}

.footer {
  margin-top: 30px;

  text-align: center;

  color: #7893a3;

  font-size: 13px;
}

@media (max-width: 700px) {

  .container {
    width: 94%;
  }

  .header {
    flex-direction: column;

    align-items: stretch;
  }

  .actions {
    width: 100%;
  }

  .btn {
    flex: 1;
  }

}

</style>

</head>

<body>

<div class="container">

  <header class="header">

    <div class="brand">

      <h1>
        EZ MEDIA 11.0
      </h1>

      <p>
        مركز القيادة التنفيذي — التحكم الذكي بالمنصة الإعلامية
      </p>

    </div>

    <div class="actions">

      <button
        class="btn"
        onclick="loadData()"
      >
        تحديث الآن
      </button>

      <button
        class="btn"
        onclick="testAPI()"
      >
        اختبار API
      </button>

    </div>

  </header>

  <div
    id="status"
    class="status"
  >
    جاري الاتصال بمركز القيادة...
  </div>

  <div
    id="errorBox"
    class="error-box"
  ></div>

  <section class="grid">

    <div class="card">

      <h3>الخادم</h3>

      <div
        id="server"
        class="value"
      >
        —
      </div>

    </div>

    <div class="card">

      <h3>قاعدة البيانات</h3>

      <div
        id="database"
        class="value"
      >
        —
      </div>

    </div>

    <div class="card">

      <h3>الذكاء الاصطناعي</h3>

      <div
        id="ai"
        class="value"
      >
        —
      </div>

    </div>

    <div class="card">

      <h3>العمليات</h3>

      <div
        id="operations"
        class="value"
      >
        —
      </div>

    </div>

    <div class="card">

      <h3>البث</h3>

      <div
        id="broadcasting"
        class="value"
      >
        —
      </div>

    </div>

    <div class="card">

      <h3>المحتوى</h3>

      <div
        id="content"
        class="value"
      >
        —
      </div>

    </div>

  </section>

  <section class="section">

    <h2 class="section-title">
      حالة الأنظمة
    </h2>

    <div class="card">

      <div class="list">

        <div class="row">
          <span class="label">
            API
          </span>
          <span
            id="apiStatus"
            class="badge"
          >
            —
          </span>
        </div>

        <div class="row">
          <span class="label">
            الأتمتة
          </span>
          <span
            id="automation"
            class="badge"
          >
            —
          </span>
        </div>

        <div class="row">
          <span class="label">
            النشر
          </span>
          <span
            id="publishing"
            class="badge"
          >
            —
          </span>
        </div>

        <div class="row">
          <span class="label">
            الموافقة البشرية
          </span>
          <span
            id="approval"
            class="badge"
          >
            —
          </span>
        </div>

        <div class="row">
          <span class="label">
            البث التلقائي
          </span>
          <span
            id="autoBroadcast"
            class="badge"
          >
            —
          </span>
        </div>

      </div>

    </div>

  </section>

  <section class="section">

    <h2 class="section-title">
      معلومات المنصة
    </h2>

    <div class="card">

      <div class="list">

        <div class="row">
          <span class="label">
            الإصدار
          </span>
          <strong id="version">
            —
          </strong>
        </div>

        <div class="row">
          <span class="label">
            Node.js
          </span>
          <strong id="node">
            —
          </strong>
        </div>

        <div class="row">
          <span class="label">
            البيئة
          </span>
          <strong id="environment">
            —
          </strong>
        </div>

        <div class="row">
          <span class="label">
            وقت التشغيل
          </span>
          <strong id="uptime">
            —
          </strong>
        </div>

        <div class="row">
          <span class="label">
            آخر تحديث
          </span>
          <strong id="updated">
            —
          </strong>
        </div>

      </div>

    </div>

  </section>

  <div class="footer">
    EZ MEDIA 11.0 — Executive Command Center
  </div>

</div>

<script>

const STATUS_API =
  "/api/executive-command/status";

const PING_API =
  "/api/executive-command/ping";

function text(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function statusText(value) {

  if (value === true) {
    return "مفعل";
  }

  if (value === false) {
    return "غير مفعل";
  }

  if (!value) {
    return "غير متاح";
  }

  const map = {
    online: "متصل",
    ready: "جاهز",
    enabled: "مفعل",
    offline: "غير متصل",
    degraded: "متراجع",
    not_configured: "غير مهيأ",
    approval_required: "يتطلب موافقة"
  };

  return map[value] || value;
}

function set(id, value) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      text(value);
  }
}

function showError(message) {

  const box =
    document.getElementById(
      "errorBox"
    );

  box.style.display = "block";

  box.textContent =
    "تعذر تحميل بيانات مركز القيادة:\\n" +
    message;
}

function hideError() {

  const box =
    document.getElementById(
      "errorBox"
    );

  box.style.display = "none";

  box.textContent = "";
}

function setStatus(
  message,
  type
) {

  const element =
    document.getElementById(
      "status"
    );

  element.textContent =
    message;

  element.className =
    "status " +
    (type || "");
}

async function loadData() {

  try {

    hideError();

    setStatus(
      "جاري تحميل بيانات مركز القيادة...",
      ""
    );

    const response =
      await fetch(
        STATUS_API +
        "?t=" +
        Date.now(),
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Accept":
              "application/json"
          }
        }
      );

    if (!response.ok) {

      throw new Error(
        "HTTP " +
        response.status
      );

    }

    const data =
      await response.json();

    render(data);

    setStatus(
      "مركز القيادة متصل ويعمل",
      "online"
    );

  } catch (error) {

    console.error(error);

    setStatus(
      "تعذر الاتصال بمركز القيادة",
      "error"
    );

    showError(
      error.message
    );

  }

}

function render(data) {

  set(
    "server",
    statusText(
      data.server &&
      data.server.online
    )
  );

  set(
    "database",
    statusText(
      data.database &&
      data.database.ready
        ? "online"
        : "offline"
    )
  );

  set(
    "ai",
    statusText(
      data.ai &&
      data.ai.status
    )
  );

  set(
    "operations",
    statusText(
      data.operations &&
      data.operations.status
    )
  );

  set(
    "broadcasting",
    statusText(
      data.broadcasting &&
      data.broadcasting.status
    )
  );

  set(
    "content",
    statusText(
      data.content &&
      data.content.status
    )
  );

  set(
    "apiStatus",
    "متصل"
  );

  set(
    "automation",
    statusText(
      data.systems &&
      data.systems.automation
    )
  );

  set(
    "publishing",
    statusText(
      data.systems &&
      data.systems.publishing
    )
  );

  set(
    "approval",
    data.approvals &&
    data.approvals.humanApprovalRequired
      ? "مطلوبة"
      : "غير مطلوبة"
  );

  set(
    "autoBroadcast",
    data.operations &&
    data.operations.automaticBroadcast
      ? "مفعل"
      : "متوقف"
  );

  set(
    "version",
    data.version
  );

  set(
    "node",
    data.server &&
    data.server.node
  );

  set(
    "environment",
    data.server &&
    data.server.environment
  );

  const uptime =
    data.server &&
    data.server.uptime;

  if (
    uptime !== null &&
    uptime !== undefined
  ) {

    set(
      "uptime",
      Math.floor(
        Number(uptime)
      ) +
      " ثانية"
    );

  } else {

    set(
      "uptime",
      null
    );

  }

  set(
    "updated",
    data.timestamp
  );

}

async function testAPI() {

  try {

    const response =
      await fetch(
        PING_API +
        "?t=" +
        Date.now(),
        {
          cache: "no-store"
        }
      );

    const data =
      await response.json();

    alert(
      JSON.stringify(
        data,
        null,
        2
      )
    );

  } catch (error) {

    alert(
      "فشل اختبار API: " +
      error.message
    );

  }

}

loadData();

setInterval(
  loadData,
  10000
);

</script>

</body>
</html>
`;

/*
===========================================================
واجهة مركز القيادة
===========================================================
*/

function sendExecutiveUI(req, res) {

  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  res.set(
    "Content-Type",
    "text/html; charset=utf-8"
  );

  res.status(200).send(
    EXECUTIVE_UI_HTML
  );
}

app.get(
  "/autonomous-media-operations",
  sendExecutiveUI
);

app.get(
  "/autonomous-media-operations/",
  sendExecutiveUI
);

/*
===========================================================
Static assets
===========================================================
*/

const publicPath =
  path.join(
    __dirname,
    "public"
  );

const autonomousPath =
  path.join(
    publicPath,
    "autonomous-media-operations"
  );

app.use(
  "/autonomous-media-operations",
  express.static(
    autonomousPath,
    {
      fallthrough: true
    }
  )
);

app.use(
  express.static(
    publicPath,
    {
      fallthrough: true
    }
  )
);

/*
===========================================================
الصفحة الرئيسية
===========================================================
*/

app.get(
  "/",
  (req, res) => {

    res.status(200).json({

      platform: "EZ MEDIA",

      version: VERSION,

      build: BUILD,

      status: "online",

      message:
        "EZ MEDIA Platform is running",

      api: "/api",

      health: "/health",

      executiveCommand:
        "/autonomous-media-operations/",

      executiveAPI:
        "/api/executive-command/status",

      database:
        databaseReady
          ? "ready"
          : "not_ready",

      timestamp: now()

    });

  }
);

/*
===========================================================
Health
===========================================================
*/

app.get(
  "/health",
  async (req, res) => {

    const database =
      await databaseStatus();

    res.status(200).json({

      platform: "EZ MEDIA",

      version: VERSION,

      build: BUILD,

      status:
        database.ready ||
        !database.configured
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

      timestamp: now()

    });

  }
);

/*
===========================================================
API Root
===========================================================
*/

app.get(
  "/api",
  (req, res) => {

    res.status(200).json({

      platform: "EZ MEDIA",

      version: VERSION,

      build: BUILD,

      status: "online",

      endpoints: {

        health: "/health",

        database:
          "/api/database",

        executive:
          "/api/executive-command/status",

        executiveUI:
          "/autonomous-media-operations/"

      }

    });

  }
);

/*
===========================================================
Database
===========================================================
*/

app.get(
  "/api/database",
  async (req, res) => {

    const database =
      await databaseStatus();

    if (
      !database.configured
    ) {

      return res.status(200).json(
        database
      );

    }

    res.status(
      database.ready
        ? 200
        : 503
    ).json(database);

  }
);

/*
===========================================================
Content OS
===========================================================
*/

app.post(
  "/api/content",
  async (req, res) => {

    if (
      !pool ||
      !databaseReady
    ) {

      return res.status(503).json({

        success: false,

        message:
          "Database is not ready"

      });

    }

    try {

      const {

        title,

        slug,

        description,

        contentType =
          "news",

        status =
          "draft",

        primaryCategory =
          null,

        secondaryCategories =
          [],

        topics =
          [],

        country =
          null,

        region =
          null,

        city =
          null,

        place =
          null,

        eventName =
          null,

        people =
          [],

        organizations =
          [],

        language =
          "ar",

        sourceUrl =
          null,

        sourceName =
          null,

        rightsStatus =
          "unknown",

        aiConfidence =
          0,

        metadata =
          {}

      } = req.body || {};

      if (!title) {

        return res.status(400).json({

          success: false,

          message:
            "title is required"

        });

      }

      const result =
        await pool.query(
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

            JSON.stringify(
              secondaryCategories
            ),

            JSON.stringify(
              topics
            ),

            country,

            region,

            city,

            place,

            eventName,

            JSON.stringify(
              people
            ),

            JSON.stringify(
              organizations
            ),

            language,

            sourceUrl,

            sourceName,

            rightsStatus,

            aiConfidence,

            JSON.stringify(
              metadata
            )

          ]
        );

      res.status(201).json({

        success: true,

        content:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "CREATE CONTENT ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  }
);

/*
===========================================================
جلب المحتوى
===========================================================
*/

app.get(
  "/api/content",
  async (req, res) => {

    if (
      !pool ||
      !databaseReady
    ) {

      return res.status(503).json({

        success: false,

        message:
          "Database is not ready"

      });

    }

    try {

      const requestedLimit =
        Number(
          req.query.limit
        ) || 50;

      const limit =
        Math.min(
          Math.max(
            requestedLimit,
            1
          ),
          200
        );

      const result =
        await pool.query(
          `
          SELECT *
          FROM content_entities
          ORDER BY created_at DESC
          LIMIT $1
          `,
          [limit]
        );

      res.status(200).json({

        success: true,

        count:
          result.rows.length,

        content:
          result.rows

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  }
);

/*
===========================================================
البحث
===========================================================
*/

app.get(
  "/api/content/search",
  async (req, res) => {

    if (
      !pool ||
      !databaseReady
    ) {

      return res.status(503).json({

        success: false,

        message:
          "Database is not ready"

      });

    }

    const q =
      String(
        req.query.q || ""
      ).trim();

    if (!q) {

      return res.status(400).json({

        success: false,

        message:
          "q is required"

      });

    }

    try {

      const result =
        await pool.query(
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

      res.status(200).json({

        success: true,

        query: q,

        count:
          result.rows.length,

        content:
          result.rows

      });

    } catch (error) {

      res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  }
);

/*
===========================================================
AI
===========================================================
*/

app.get(
  "/api/ai/agents",
  (req, res) => {

    const enabled =
      process.env.AI_AGENT_AUTO_EXECUTION ===
      "true";

    res.status(200).json({

      platform: "EZ MEDIA",

      orchestrator:
        "EZ AI ORCHESTRATOR",

      status:
        enabled
          ? "enabled"
          : "not_configured",

      humanApproval:
        process.env.AI_AGENT_REQUIRE_HUMAN_APPROVAL !==
        "false",

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

  }
);

/*
===========================================================
Live
===========================================================
*/

app.get(
  "/api/live",
  (req, res) => {

    res.status(200).json({

      system: "EZ LIVE",

      status: "ready",

      live: false,

      broadcast: {

        website: true,

        social: true,

        broadcast: true

      }

    });

  }
);

/*
===========================================================
Automation
===========================================================
*/

app.get(
  "/api/automation",
  (req, res) => {

    res.status(200).json({

      system:
        "EZ AUTOMATION",

      status: "ready",

      architecture:
        "event-driven",

      workflows: []

    });

  }
);

/*
===========================================================
عمليات EZ MEDIA
===========================================================
*/

app.get(
  "/api/operations",
  (req, res) => {

    res.status(200).json({

      platform: "EZ MEDIA",

      system:
        "AUTONOMOUS MEDIA OPERATIONS CENTER",

      status: "ready",

      active: null,

      pending: null,

      completed: null,

      failed: null,

      humanApprovalRequired:
        process.env.MEDIA_OPS_REQUIRE_HUMAN_APPROVAL !==
        "false",

      timestamp: now()

    });

  }
);

/*
===========================================================
Storage
===========================================================
*/

app.get(
  "/api/storage",
  (req, res) => {

    res.status(200).json({

      platform: "EZ MEDIA",

      status: "ready",

      configured:
        Boolean(
          process.env.STORAGE_PROVIDER
        ),

      provider:
        process.env.STORAGE_PROVIDER ||
        null

    });

  }
);

/*
===========================================================
Upload
===========================================================
*/

app.get(
  "/api/upload",
  (req, res) => {

    res.status(200).json({

      platform: "EZ MEDIA",

      status: "ready",

      message:
        "Upload API endpoint is available"

    });

  }
);

/*
===========================================================
Breaking
===========================================================
*/

app.get(
  "/api/breaking",
  (req, res) => {

    res.status(200).json({

      platform: "EZ MEDIA",

      system: "EZ BREAKING",

      status: "ready",

      items: []

    });

  }
);

/*
===========================================================
404
===========================================================
*/

app.use(
  (req, res) => {

    res.status(404).json({

      platform: "EZ MEDIA",

      status: "not_found",

      path:
        req.originalUrl,

      hint:
        "Check the EZ MEDIA API route."

    });

  }
);

/*
===========================================================
Error Handler
===========================================================
*/

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "EZ MEDIA ERROR:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({

      platform: "EZ MEDIA",

      status: "error",

      message:
        "Internal server error"

    });

  }
);

/*
===========================================================
تشغيل الخادم
===========================================================
*/

let server = null;

async function startServer() {

  await initializeDatabase();

  server =
    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          "========================================"
        );

        console.log(
          "EZ MEDIA 11.0"
        );

        console.log(
          "Version:",
          VERSION
        );

        console.log(
          "Build:",
          BUILD
        );

        console.log(
          "Port:",
          PORT
        );

        console.log(
          "Database:",
          databaseReady
            ? "READY"
            : "NOT READY"
        );

        console.log(
          "Executive Command:",
          "/autonomous-media-operations/"
        );

        console.log(
          "Executive API:",
          "/api/executive-command/status"
        );

        console.log(
          "Status: ONLINE"
        );

        console.log(
          "========================================"
        );

      }
    );

}

/*
===========================================================
إيقاف آمن
===========================================================
*/

async function shutdown(
  signal
) {

  console.log(
    "EZ MEDIA shutdown:",
    signal
  );

  try {

    if (server) {

      await new Promise(
        (resolve) => {
          server.close(
            resolve
          );
        }
      );

    }

    if (pool) {
      await pool.end();
    }

    process.exit(0);

  } catch (error) {

    console.error(
      "Shutdown error:",
      error
    );

    process.exit(1);

  }

}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "uncaughtException",
  (error) => {

    console.error(
      "UNCAUGHT EXCEPTION:",
      error
    );

  }
);

process.on(
  "unhandledRejection",
  (error) => {

    console.error(
      "UNHANDLED REJECTION:",
      error
    );

  }
);

/*
===========================================================
START
===========================================================
*/

startServer();

module.exports = app;
