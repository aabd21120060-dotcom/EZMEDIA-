/**
 * EZ MEDIA 11.0
 * منصة إعلامية ذكية متعددة الوحدات
 *
 * الوظائف الأساسية:
 * - API
 * - CMS
 * - الأخبار
 * - الذكاء الاصطناعي
 * - المكتبة الإعلامية
 * - البث المباشر
 * - الإعلانات
 * - الرعايات
 * - الأتمتة
 * - التحليلات
 * - الإدارة
 * - البحث
 *
 * ملاحظة:
 * إعدادات Environment Variables تؤجل للمرحلة الأخيرة.
 */

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const PLATFORM = {
  name: "EZ MEDIA",
  version: "11.0.0",
  edition: "AI MEDIA PLATFORM",
  environment: process.env.NODE_ENV || "development"
};

/* =========================================================
   MIDDLEWARE
========================================================= */

app.disable("x-powered-by");

app.use(express.json({
  limit: "20mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "20mb"
}));

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Platform", "EZ MEDIA");

  next();
});

/* =========================================================
   MEMORY DATABASE
   تعمل مؤقتاً بدون PostgreSQL
========================================================= */

const db = {
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
  settings: {},
  sections: []
};

/* =========================================================
   الأقسام الرئيسية
========================================================= */

db.sections = [
  {
    id: "news",
    name: "الأخبار",
    slug: "news",
    enabled: true
  },
  {
    id: "saudi",
    name: "السعودية",
    slug: "saudi",
    enabled: true
  },
  {
    id: "gulf",
    name: "الخليج",
    slug: "gulf",
    enabled: true
  },
  {
    id: "world",
    name: "العالم",
    slug: "world",
    enabled: true
  },
  {
    id: "economy",
    name: "اقتصاد",
    slug: "economy",
    enabled: true
  },
  {
    id: "technology",
    name: "تقنية وذكاء اصطناعي",
    slug: "technology",
    enabled: true
  },
  {
    id: "sports",
    name: "رياضة",
    slug: "sports",
    enabled: true
  },
  {
    id: "society",
    name: "مجتمع",
    slug: "society",
    enabled: true
  },
  {
    id: "culture",
    name: "ثقافة",
    slug: "culture",
    enabled: true
  },
  {
    id: "tourism",
    name: "سياحة",
    slug: "tourism",
    enabled: true
  },
  {
    id: "environment",
    name: "بيئة",
    slug: "environment",
    enabled: true
  },
  {
    id: "reports",
    name: "تقارير",
    slug: "reports",
    enabled: true
  },
  {
    id: "investigations",
    name: "تحقيقات",
    slug: "investigations",
    enabled: true
  },
  {
    id: "interviews",
    name: "مقابلات",
    slug: "interviews",
    enabled: true
  },
  {
    id: "video",
    name: "فيديو",
    slug: "video",
    enabled: true
  },
  {
    id: "live",
    name: "البث المباشر",
    slug: "live",
    enabled: true
  },
  {
    id: "my-content",
    name: "محتواي",
    slug: "my-content",
    enabled: true
  },
  {
    id: "media-library",
    name: "المكتبة الإعلامية",
    slug: "media-library",
    enabled: true
  },
  {
    id: "advertising",
    name: "الإعلانات",
    slug: "advertising",
    enabled: true
  },
  {
    id: "sponsorships",
    name: "الرعايات",
    slug: "sponsorships",
    enabled: true
  }
];

/* =========================================================
   أدوات مساعدة
========================================================= */

function id(prefix = "ez") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function createRecord(collection, data) {
  const record = {
    id: id(collection),
    createdAt: now(),
    updatedAt: now(),
    ...data
  };

  db[collection].push(record);

  return record;
}

function updateRecord(collection, recordId, data) {
  const index = db[collection].findIndex(
    item => item.id === recordId
  );

  if (index === -1) {
    return null;
  }

  db[collection][index] = {
    ...db[collection][index],
    ...data,
    updatedAt: now()
  };

  return db[collection][index];
}

function deleteRecord(collection, recordId) {
  const index = db[collection].findIndex(
    item => item.id === recordId
  );

  if (index === -1) {
    return false;
  }

  db[collection].splice(index, 1);

  return true;
}

function audit(action, details = {}) {
  db.auditLogs.push({
    id: id("audit"),
    action,
    details,
    createdAt: now()
  });
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    platform: PLATFORM.name,
    version: PLATFORM.version,
    status: "online",
    server: "online",
    database: {
      configured: Boolean(process.env.DATABASE_URL),
      connected: false,
      mode: process.env.DATABASE_URL
        ? "configured"
        : "memory"
    },
    ai: {
      enabled: true,
      providerConfigured: Boolean(process.env.AI_API_KEY)
    },
    requestId: req.requestId,
    timestamp: now()
  });
});

/* =========================================================
   API ROOT
========================================================= */

app.get("/api", (req, res) => {
  res.json({
    platform: PLATFORM,
    status: "online",
    message: "EZ MEDIA API تعمل بنجاح",
    modules: [
      "cms",
      "news",
      "ai",
      "media",
      "live",
      "advertising",
      "sponsorships",
      "analytics",
      "automation",
      "search",
      "administration"
    ]
  });
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get("/api/dashboard", (req, res) => {
  res.json({
    platform: PLATFORM.name,

    statistics: {
      users: db.users.length,
      contents: db.contents.length,
      media: db.media.length,
      liveStreams: db.liveStreams.length,
      advertisements: db.advertisements.length,
      sponsorships: db.sponsorships.length,
      automationRuns: db.automationRuns.length,
      aiJobs: db.aiJobs.length
    },

    system: {
      server: "online",
      database:
        process.env.DATABASE_URL
          ? "configured"
          : "not_configured"
    },

    timestamp: now()
  });
});

/* =========================================================
   SECTIONS
========================================================= */

app.get("/api/sections", (req, res) => {
  res.json({
    success: true,
    sections: db.sections
  });
});

/* =========================================================
   CMS — المحتوى
========================================================= */

app.get("/api/content", (req, res) => {
  let results = [...db.contents];

  if (req.query.section) {
    results = results.filter(
      item => item.section === req.query.section
    );
  }

  if (req.query.status) {
    results = results.filter(
      item => item.status === req.query.status
    );
  }

  results.sort(
    (a, b) =>
      new Date(b.createdAt) -
      new Date(a.createdAt)
  );

  res.json({
    success: true,
    count: results.length,
    contents: results
  });
});

app.post("/api/content", (req, res) => {
  const {
    title,
    description = "",
    body = "",
    section = "news",
    type = "article",
    status = "draft",
    author = "EZ MEDIA"
  } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      message: "عنوان المحتوى مطلوب"
    });
  }

  const content = createRecord("contents", {
    title,
    description,
    body,
    section,
    type,
    status,
    author,
    aiGenerated: false
  });

  audit("content.created", {
    contentId: content.id
  });

  res.status(201).json({
    success: true,
    content
  });
});

app.patch("/api/content/:id", (req, res) => {
  const content = updateRecord(
    "contents",
    req.params.id,
    req.body
  );

  if (!content) {
    return res.status(404).json({
      success: false,
      message: "المحتوى غير موجود"
    });
  }

  audit("content.updated", {
    contentId: content.id
  });

  res.json({
    success: true,
    content
  });
});

app.delete("/api/content/:id", (req, res) => {
  const deleted = deleteRecord(
    "contents",
    req.params.id
  );

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "المحتوى غير موجود"
    });
  }

  audit("content.deleted", {
    contentId: req.params.id
  });

  res.json({
    success: true
  });
});

/* =========================================================
   الأخبار
========================================================= */

app.get("/api/news", (req, res) => {
  const news = db.contents
    .filter(item =>
      [
        "news",
        "saudi",
        "gulf",
        "world",
        "economy",
        "technology"
      ].includes(item.section)
    )
    .filter(item => item.status === "published")
    .sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  res.json({
    success: true,
    count: news.length,
    news
  });
});

/* =========================================================
   AI ENGINE
========================================================= */

app.post("/api/ai/analyze", (req, res) => {
  const {
    text: inputText = "",
    type = "article"
  } = req.body;

  if (!inputText.trim()) {
    return res.status(400).json({
      success: false,
      message: "النص مطلوب"
    });
  }

  const job = createRecord("aiJobs", {
    type: "analysis",
    inputType: type,
    status: "completed",
    inputLength: inputText.length,

    result: {
      summary:
        inputText.length > 250
          ? `${inputText.substring(0, 250)}...`
          : inputText,

      suggestedTitle:
        inputText
          .replace(/\s+/g, " ")
          .trim()
          .split(" ")
          .slice(0, 10)
          .join(" "),

      keywords: [],

      classification: {
        section: "news",
        confidence: 0
      },

      requiresHumanReview: true
    }
  });

  audit("ai.analysis", {
    jobId: job.id
  });

  res.json({
    success: true,
    job
  });
});

/*
 * إنشاء مسودة خبر بواسطة محرك AI.
 * النشر النهائي يبقى بقرار بشري.
 */

app.post("/api/ai/draft", (req, res) => {
  const {
    sourceText,
    section = "news"
  } = req.body;

  if (!sourceText) {
    return res.status(400).json({
      success: false,
      message: "المصدر مطلوب"
    });
  }

  const draft = createRecord("contents", {
    title: "مسودة مولدة بالذكاء الاصطناعي",
    body: sourceText,
    section,
    type: "article",
    status: "ai_review",
    aiGenerated: true,
    requiresHumanApproval: true
  });

  const job = createRecord("aiJobs", {
    type: "content_draft",
    status: "completed",
    contentId: draft.id
  });

  res.status(201).json({
    success: true,
    requiresHumanApproval: true,
    content: draft,
    aiJob: job
  });
});

/* =========================================================
   MEDIA LIBRARY
========================================================= */

app.get("/api/media", (req, res) => {
  res.json({
    success: true,
    count: db.media.length,
    media: db.media
  });
});

app.post("/api/media", (req, res) => {
  const media = createRecord("media", {
    name: req.body.name,
    type: req.body.type || "file",
    url: req.body.url || null,
    mimeType: req.body.mimeType || null,
    size: req.body.size || 0,
    folder: req.body.folder || "general",
    tags: req.body.tags || []
  });

  res.status(201).json({
    success: true,
    media
  });
});

/* =========================================================
   LIVE STREAMING
========================================================= */

app.get("/api/live", (req, res) => {
  res.json({
    success: true,
    streams: db.liveStreams
  });
});

app.post("/api/live", (req, res) => {
  const stream = createRecord("liveStreams", {
    title: req.body.title || "بث مباشر",
    description: req.body.description || "",
    status: req.body.status || "offline",
    streamUrl: req.body.streamUrl || null,
    playbackUrl: req.body.playbackUrl || null,
    provider: req.body.provider || null,
    schedule: req.body.schedule || null,
    officialSource: req.body.officialSource || false
  });

  audit("live.created", {
    streamId: stream.id
  });

  res.status(201).json({
    success: true,
    stream
  });
});

app.patch("/api/live/:id", (req, res) => {
  const stream = updateRecord(
    "liveStreams",
    req.params.id,
    req.body
  );

  if (!stream) {
    return res.status(404).json({
      success: false,
      message: "البث غير موجود"
    });
  }

  res.json({
    success: true,
    stream
  });
});

/* =========================================================
   ADVERTISING
========================================================= */

app.get("/api/advertising", (req, res) => {
  res.json({
    success: true,
    advertisements: db.advertisements
  });
});

app.post("/api/advertising", (req, res) => {
  const advertisement = createRecord(
    "advertisements",
    {
      name: req.body.name,
      advertiser: req.body.advertiser,
      placement: req.body.placement || "homepage",
      startAt: req.body.startAt || null,
      endAt: req.body.endAt || null,
      status: req.body.status || "draft",
      impressions: 0,
      clicks: 0
    }
  );

  res.status(201).json({
    success: true,
    advertisement
  });
});

/* =========================================================
   SPONSORSHIPS
========================================================= */

app.get("/api/sponsorships", (req, res) => {
  res.json({
    success: true,
    sponsorships: db.sponsorships
  });
});

app.post("/api/sponsorships", (req, res) => {
  const sponsorship = createRecord(
    "sponsorships",
    {
      sponsor: req.body.sponsor,
      campaign: req.body.campaign,
      level: req.body.level || "section",
      section: req.body.section || null,
      startAt: req.body.startAt || null,
      endAt: req.body.endAt || null,
      status: req.body.status || "draft"
    }
  );

  res.status(201).json({
    success: true,
    sponsorship
  });
});

/* =========================================================
   AUTOMATION
========================================================= */

async function runAutomation() {

  const run = createRecord(
    "automationRuns",
    {
      status: "running",
      startedAt: now()
    }
  );

  try {

    /*
     * هنا مستقبلاً:
     * 1. قراءة المصادر
     * 2. اكتشاف الأخبار
     * 3. تحليل AI
     * 4. منع التكرار
     * 5. إنشاء المسودات
     * 6. إرسالها للمراجعة
     */

    run.status = "completed";
    run.finishedAt = now();

    return run;

  } catch (error) {

    run.status = "failed";
    run.error = error.message;
    run.finishedAt = now();

    throw error;
  }
}

app.post("/api/admin/automation/run", async (req, res) => {

  try {

    const run = await runAutomation();

    res.json({
      success: true,
      run
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: "فشلت عملية الأتمتة"
    });
  }
});

app.get("/api/admin/automation/runs", (req, res) => {
  res.json({
    success: true,
    runs: db.automationRuns
  });
});

/* =========================================================
   SCHEDULER
========================================================= */

app.get("/api/admin/schedules", (req, res) => {
  res.json({
    success: true,
    schedules: db.schedules
  });
});

app.post("/api/admin/schedules", (req, res) => {

  const schedule = createRecord(
    "schedules",
    {
      name: req.body.name,
      type: req.body.type || "content",
      cron: req.body.cron || null,
      enabled: req.body.enabled !== false,
      action: req.body.action || null
    }
  );

  res.status(201).json({
    success: true,
    schedule
  });
});

/* =========================================================
   SEARCH
========================================================= */

app.get("/api/search", (req, res) => {

  const query =
    String(req.query.q || "")
      .trim()
      .toLowerCase();

  if (!query) {
    return res.json({
      success: true,
      results: []
    });
  }

  const results = db.contents.filter(item => {

    const text = [
      item.title,
      item.description,
      item.body,
      item.section
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(query);
  });

  res.json({
    success: true,
    query,
    count: results.length,
    results
  });
});

/* =========================================================
   ANALYTICS
========================================================= */

app.post("/api/analytics/event", (req, res) => {

  const event = createRecord(
    "analytics",
    {
      type: req.body.type || "page_view",
      path: req.body.path || "/",
      contentId: req.body.contentId || null,
      metadata: req.body.metadata || {}
    }
  );

  res.status(201).json({
    success: true,
    eventId: event.id
  });
});

app.get("/api/admin/analytics", (req, res) => {

  const summary = {};

  for (const event of db.analytics) {

    summary[event.type] =
      (summary[event.type] || 0) + 1;
  }

  res.json({
    success: true,
    totalEvents: db.analytics.length,
    summary
  });
});

/* =========================================================
   USERS / ADMIN
========================================================= */

app.get("/api/admin/users", (req, res) => {

  res.json({
    success: true,
    users: db.users
  });
});

app.post("/api/admin/users", (req, res) => {

  const user = createRecord(
    "users",
    {
      name: req.body.name,
      email: req.body.email,
      role: req.body.role || "editor",
      permissions: req.body.permissions || [],
      active: true
    }
  );

  audit("user.created", {
    userId: user.id
  });

  res.status(201).json({
    success: true,
    user
  });
});

/* =========================================================
   SETTINGS
========================================================= */

app.get("/api/admin/settings", (req, res) => {

  res.json({
    success: true,
    settings: db.settings
  });
});

app.patch("/api/admin/settings", (req, res) => {

  db.settings = {
    ...db.settings,
    ...req.body,
    updatedAt: now()
  };

  res.json({
    success: true,
    settings: db.settings
  });
});

/* =========================================================
   AUDIT LOG
========================================================= */

app.get("/api/admin/audit", (req, res) => {

  res.json({
    success: true,
    logs: db.auditLogs
  });
});

/* =========================================================
   NEWS SOURCES
========================================================= */

app.get("/api/news/sources", (req, res) => {

  res.json({
    success: true,
    sources: db.newsSources
  });
});

app.post("/api/news/sources", (req, res) => {

  const source = createRecord(
    "newsSources",
    {
      name: req.body.name,
      url: req.body.url,
      type: req.body.type || "rss",
      enabled: req.body.enabled !== false,
      trusted: req.body.trusted || false
    }
  );

  res.status(201).json({
    success: true,
    source
  });
});

/* =========================================================
   404 API
========================================================= */

app.use("/api", (req, res) => {

  res.status(404).json({
    success: false,
    error: "API_NOT_FOUND",
    message: "المسار غير موجود",
    path: req.originalUrl,
    requestId: req.requestId
  });
});

/* =========================================================
   FRONTEND
========================================================= */

const publicDirectory =
  path.join(__dirname, "public");

app.use(
  express.static(publicDirectory, {
    extensions: ["html"]
  })
);

app.get("*", (req, res) => {

  if (req.path.startsWith("/api")) {
    return res.status(404).end();
  }

  res.sendFile(
    path.join(publicDirectory, "index.html"),
    error => {

      if (error) {

        res.status(200).send(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                  content="width=device-width,initial-scale=1">
            <title>EZ MEDIA</title>
          </head>
          <body>
            <h1>EZ MEDIA 11.0</h1>
            <p>منصة إعلامية ذكية تعمل بنجاح.</p>
          </body>
          </html>
        `);
      }
    }
  );
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {

  console.error("EZ MEDIA ERROR:", error);

  res.status(500).json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: "حدث خطأ داخلي في المنصة",
    requestId: req.requestId
  });
});

/* =========================================================
   START
========================================================= */

const server = app.listen(
  PORT,
  HOST,
  () => {

    console.log(`
=========================================
        EZ MEDIA 11.0
=========================================

Platform : ${PLATFORM.name}
Version  : ${PLATFORM.version}
Node     : ${process.version}
Port     : ${PORT}
Database : ${
  process.env.DATABASE_URL
    ? "configured"
    : "memory mode"
}

Server is running.
=========================================
`);
  }
);

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(signal) {

  console.log(
    `EZ MEDIA received ${signal}`
  );

  server.close(() => {

    console.log(
      "EZ MEDIA server closed."
    );

    process.exit(0);
  });
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);
