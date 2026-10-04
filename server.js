"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * MAIN SERVER
 * ============================================================
 *
 * الخادم المركزي لمنصة EZ MEDIA
 *
 * هذا الملف يجمع:
 *
 * 1. قاعدة البيانات الرئيسية
 * 2. قاعدة بيانات الوسائط
 * 3. الإشعارات
 * 4. Notification Worker
 * 5. المحتوى
 * 6. الذكاء الاصطناعي
 * 7. الوسائط
 * 8. البث المباشر
 * 9. الأخبار العاجلة
 * 10. التخزين
 * 11. الرفع
 * 12. التجاري والإعلانات
 * 13. مركز العمليات الإعلامية الذاتية
 * 14. واجهة Autonomous Media Operations Center
 * 15. Multi-Agent AI
 * 16. AI Autonomous Tasks
 * 17. Media Memory
 * 18. Health
 * 19. System
 * 20. API Overview
 *
 * CODE 117
 * Autonomous Media Operations Center
 *
 * CODE 118
 * Autonomous Media Operations Center UI
 *
 * ============================================================
 */

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

/* ============================================================
   DATABASE
============================================================ */

const {
  health: databaseHealth
} = require("./src/database/db");

const {
  initializeDatabase
} = require("./src/database/init");

const {
  initializeMediaDatabase
} = require("./src/database/media-init");

/* ============================================================
   NOTIFICATIONS
============================================================ */

const {
  initializeNotifications
} = require("./src/database/notification-bootstrap");

const {
  startNotificationWorker,
  registerNotificationWorkerShutdown
} = require("./src/services/notificationWorker");

/* ============================================================
   EXISTING ROUTES
============================================================ */

const contentRoutes =
  require("./src/routes/content");

const aiRoutes =
  require("./src/routes/ai");

const mediaRoutes =
  require("./src/routes/media");

const liveRoutes =
  require("./src/routes/live");

const breakingRoutes =
  require("./src/routes/breaking");

const storageRoutes =
  require("./src/routes/storage");

const uploadRoutes =
  require("./src/routes/upload");

const commercialRoutes =
  require("./src/routes/commercial");

const notificationsRoutes =
  require("./src/routes/notifications");

const notificationWorkerRoutes =
  require("./src/routes/notification-worker");

/* ============================================================
   OPTIONAL ADVANCED ENGINES
   ============================================================
 *
 * هذه الطريقة تمنع سقوط الخادم إذا كان أحد المحركات
 * غير موجود مؤقتًا أثناء تطوير المنصة.
 */

function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(
      `EZ MEDIA: optional module unavailable: ${modulePath}`
    );

    console.warn(
      `Reason: ${error.message}`
    );

    return null;
  }
}

/* ============================================================
   CODE 117
   AUTONOMOUS MEDIA OPERATIONS CENTER
============================================================ */

const autonomousOperationsEngineModule =
  safeRequire(
    "./src/services/autonomous-media-operations-center-engine"
  );

const autonomousOperationsRoutesModule =
  safeRequire(
    "./src/routes/autonomous-media-operations"
  );

/* ============================================================
   CODE 115
   AI AGENT COLLABORATION
============================================================ */

const collaborationEngineModule =
  safeRequire(
    "./src/services/intelligent-ai-agent-collaboration-engine"
  );

/* ============================================================
   CODE 114
   AI AGENT AUTONOMOUS ENGINE
============================================================ */

const autonomousAgentEngineModule =
  safeRequire(
    "./src/services/intelligent-ai-agent-autonomous-engine"
  );

/* ============================================================
   CODE 110
   MEDIA MEMORY
============================================================ */

const mediaMemoryEngineModule =
  safeRequire(
    "./src/services/intelligent-media-memory-engine"
  );

/* ============================================================
   APP
============================================================ */

const app = express();

/* ============================================================
   SERVER CONFIGURATION
============================================================ */

const PORT =
  Number(process.env.PORT) || 3000;

const HOST =
  process.env.HOST || "0.0.0.0";

/* ============================================================
   PLATFORM INFORMATION
============================================================ */

const PLATFORM_NAME =
  "EZ MEDIA";

const PLATFORM_VERSION =
  "11.0.0";

/* ============================================================
   RUNTIME STATE
============================================================ */

const runtime = {
  startedAt: new Date().toISOString(),

  database: {
    initialized: false,
    configured: Boolean(
      process.env.DATABASE_URL
    )
  },

  notifications: {
    initialized: false,
    workerStarted: false
  },

  autonomousOperations: {
    available: false,
    initialized: false,
    routeMounted: false,
    started: false
  },

  ai: {
    available: true,
    collaboration: false,
    autonomousAgents: false,
    memory: false
  }
};

/* ============================================================
   SECURITY
============================================================ */

app.disable(
  "x-powered-by"
);

app.set(
  "trust proxy",
  true
);

/*
 * نسمح للمنصة بالعمل مع:
 * - الواجهة
 * - الجوال
 * - PWA
 * - الخدمات الداخلية
 * - APIs
 *
 * CSP متوقف هنا لأن المنصة تحتوي على واجهات
 * وملفات JavaScript متعددة ومصادر مستقبلية.
 */

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

/* ============================================================
   PERFORMANCE
============================================================ */

app.use(
  compression()
);

/* ============================================================
   BODY PARSER
============================================================ */

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

/* ============================================================
   REQUEST ID
============================================================ */

app.use(
  (req, res, next) => {
    const requestId =
      req.headers["x-request-id"] ||
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}`;

    req.requestId =
      String(requestId);

    res.setHeader(
      "X-Request-ID",
      req.requestId
    );

    next();
  }
);

/* ============================================================
   REQUEST TIMING
============================================================ */

app.use(
  (req, res, next) => {
    const started =
      process.hrtime.bigint();

    res.on(
      "finish",
      () => {
        try {
          const finished =
            process.hrtime.bigint();

          const duration =
            Number(
              finished - started
            ) / 1000000;

          if (
            process.env.NODE_ENV !==
            "production"
          ) {
            console.log(
              `[EZ MEDIA] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration.toFixed(
                2
              )}ms`
            );
          }
        } catch (error) {
          /* ignore logging error */
        }
      }
    );

    next();
  }
);

/* ============================================================
   PUBLIC DIRECTORY
============================================================ */

const publicDirectory =
  path.join(
    __dirname,
    "public"
  );

/* ============================================================
   GLOBAL STATIC FILES
============================================================ */

app.use(
  express.static(
    publicDirectory,
    {
      maxAge:
        process.env.NODE_ENV ===
        "production"
          ? "1h"
          : 0,

      index:
        false
    }
  )
);

/* ============================================================
   EXISTING API ROUTES
============================================================ */

app.use(
  "/api/content",
  contentRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

app.use(
  "/api/media",
  mediaRoutes
);

app.use(
  "/api/live",
  liveRoutes
);

app.use(
  "/api/breaking",
  breakingRoutes
);

app.use(
  "/api/storage",
  storageRoutes
);

app.use(
  "/api/upload",
  uploadRoutes
);

app.use(
  "/api/commercial",
  commercialRoutes
);

/* ============================================================
   NOTIFICATION API
============================================================ */

app.use(
  "/api/notifications",
  notificationsRoutes
);

/* ============================================================
   NOTIFICATION WORKER API
============================================================ */

app.use(
  "/api/notification-worker",
  notificationWorkerRoutes
);

/* ============================================================
   ENGINE RESOLVER
============================================================ */

function resolveEngineExport(
  moduleObject,
  preferredNames = []
) {
  if (!moduleObject) {
    return null;
  }

  /*
   * إذا كان التصدير نفسه كلاس/دالة.
   */
  if (
    typeof moduleObject ===
    "function"
  ) {
    return moduleObject;
  }

  /*
   * البحث عن الأسماء المتوقعة.
   */
  for (
    const name of preferredNames
  ) {
    if (
      moduleObject[name]
    ) {
      return moduleObject[name];
    }
  }

  /*
   * البحث عن أول function.
   */
  for (
    const key of Object.keys(
      moduleObject
    )
  ) {
    if (
      typeof moduleObject[key] ===
      "function"
    ) {
      return moduleObject[key];
    }
  }

  return null;
}

/* ============================================================
   ENGINE INSTANCE HELPER
============================================================ */

function createEngineInstance(
  moduleObject,
  options,
  preferredNames = []
) {
  const Engine =
    resolveEngineExport(
      moduleObject,
      preferredNames
    );

  if (!Engine) {
    return null;
  }

  /*
   * إذا كان كائنًا جاهزًا.
   */
  if (
    typeof Engine ===
    "object"
  ) {
    return Engine;
  }

  /*
   * محاولة الإنشاء باستخدام new.
   */
  try {
    return new Engine(
      options
    );
  } catch (newError) {
    /*
     * محاولة الاستدعاء كدالة.
     */
    try {
      return Engine(
        options
      );
    } catch (callError) {
      console.warn(
        "EZ MEDIA: engine initialization failed."
      );

      console.warn(
        newError.message
      );

      console.warn(
        callError.message
      );

      return null;
    }
  }
}

/* ============================================================
   ADVANCED ENGINE REGISTRY
============================================================ */

const engines = {
  autonomousOperations: null,

  collaboration: null,

  autonomousAgents: null,

  memory: null
};

/* ============================================================
   ENGINE INITIALIZATION
============================================================ */

function initializeAdvancedEngines() {
  console.log(
    "EZ MEDIA: initializing advanced AI engines..."
  );

  /* ==========================================================
     CODE 114
  ========================================================== */

  try {
    engines.autonomousAgents =
      createEngineInstance(
        autonomousAgentEngineModule,
        {
          app,
          databaseHealth,
          environment:
            process.env.NODE_ENV ||
            "development"
        },
        [
          "IntelligentAIAgentAutonomousEngine",
          "AutonomousAgentEngine",
          "AIAgentAutonomousEngine"
        ]
      );

    runtime.ai.autonomousAgents =
      Boolean(
        engines.autonomousAgents
      );

    console.log(
      "EZ MEDIA: CODE 114 autonomous agent engine:",
      runtime.ai.autonomousAgents
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 114 initialization error:",
      error.message
    );
  }

  /* ==========================================================
     CODE 115
  ========================================================== */

  try {
    engines.collaboration =
      createEngineInstance(
        collaborationEngineModule,
        {
          app,
          databaseHealth,

          autonomousAgentEngine:
            engines.autonomousAgents,

          environment:
            process.env.NODE_ENV ||
            "development"
        },
        [
          "IntelligentAIAgentCollaborationEngine",
          "AIAgentCollaborationEngine",
          "AgentCollaborationEngine"
        ]
      );

    runtime.ai.collaboration =
      Boolean(
        engines.collaboration
      );

    console.log(
      "EZ MEDIA: CODE 115 collaboration engine:",
      runtime.ai.collaboration
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 115 initialization error:",
      error.message
    );
  }

  /* ==========================================================
     CODE 110
  ========================================================== */

  try {
    engines.memory =
      createEngineInstance(
        mediaMemoryEngineModule,
        {
          app,
          databaseHealth,

          environment:
            process.env.NODE_ENV ||
            "development"
        },
        [
          "IntelligentMediaMemoryEngine",
          "MediaMemoryEngine",
          "MemoryEngine"
        ]
      );

    runtime.ai.memory =
      Boolean(
        engines.memory
      );

    console.log(
      "EZ MEDIA: CODE 110 memory engine:",
      runtime.ai.memory
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 110 initialization error:",
      error.message
    );
  }

  /* ==========================================================
     CODE 117
     AUTONOMOUS MEDIA OPERATIONS
  ========================================================== */

  try {
    engines.autonomousOperations =
      createEngineInstance(
        autonomousOperationsEngineModule,
        {
          app,

          databaseHealth,

          collaborationEngine:
            engines.collaboration,

          autonomousAgentEngine:
            engines.autonomousAgents,

          memoryEngine:
            engines.memory,

          environment:
            process.env.NODE_ENV ||
            "development"
        },
        [
          "AutonomousMediaOperationsCenterEngine",
          "IntelligentAutonomousMediaOperationsCenterEngine",
          "AutonomousMediaOperationsEngine",
          "MediaOperationsCenterEngine"
        ]
      );

    runtime.autonomousOperations.available =
      Boolean(
        autonomousOperationsEngineModule
      );

    runtime.autonomousOperations.initialized =
      Boolean(
        engines.autonomousOperations
      );

    console.log(
      "EZ MEDIA: CODE 117 Autonomous Media Operations Center:",
      runtime.autonomousOperations.initialized
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 117 initialization error:",
      error.message
    );
  }
}

/* ============================================================
   ADMIN GUARD
===============================================================
 *
 * مهم:
 * لا نضع ADMIN KEY في الواجهة الأمامية.
 *
 * الحماية هنا اختيارية وتعمل فقط إذا تم إعداد
 * ADMIN API KEY في Railway.
 *
 * ويمكن لاحقًا استبدالها بنظام الهوية الكامل.
 */

function autonomousAdminGuard(
  req,
  res,
  next
) {
  /*
   * إذا لم يتم تفعيل الحماية
   * نسمح للمنصة بالعمل أثناء التطوير.
   */

  const protectionEnabled =
    String(
      process.env
        .AUTONOMOUS_OPERATIONS_ADMIN_GUARD ||
        "false"
    ).toLowerCase() ===
    "true";

  if (!protectionEnabled) {
    return next();
  }

  /*
   * لا نستخدم مفتاح الإدارة إذا لم يكن موجودًا.
   */

  const adminKey =
    process.env
      .PLATFORM_ADMIN_KEY;

  if (!adminKey) {
    return res
      .status(503)
      .json({
        success: false,

        error:
          "Administrative protection is enabled but PLATFORM_ADMIN_KEY is not configured.",

        requestId:
          req.requestId,

        timestamp:
          new Date().toISOString()
      });
  }

  /*
   * يمكن إرسال المفتاح في:
   *
   * Authorization: Bearer KEY
   *
   * أو:
   *
   * X-Admin-Key: KEY
   */

  const authorization =
    req.headers.authorization ||
    "";

  const bearer =
    authorization.startsWith(
      "Bearer "
    )
      ? authorization.slice(7)
      : null;

  const headerKey =
    req.headers[
      "x-admin-key"
    ];

  const provided =
    bearer ||
    headerKey;

  if (
    !provided ||
    provided !== adminKey
  ) {
    return res
      .status(401)
      .json({
        success: false,

        error:
          "Unauthorized",

        requestId:
          req.requestId,

        timestamp:
          new Date().toISOString()
      });
  }

  return next();
}

/* ============================================================
   CODE 117 ROUTES
============================================================ */

function mountAutonomousOperationsRoutes() {
  if (
    !autonomousOperationsRoutesModule
  ) {
    console.warn(
      "EZ MEDIA: CODE 117 route module not available."
    );

    return false;
  }

  if (
    !engines.autonomousOperations
  ) {
    console.warn(
      "EZ MEDIA: CODE 117 engine unavailable. Route not mounted."
    );

    return false;
  }

  try {
    /*
     * Route module قد يكون:
     *
     * module.exports = function...
     *
     * أو:
     *
     * module.exports = {
     *   createAutonomousMediaOperationsRouter
     * }
     */

    let routerFactory = null;

    if (
      typeof autonomousOperationsRoutesModule ===
      "function"
    ) {
      routerFactory =
        autonomousOperationsRoutesModule;
    }

    if (
      !routerFactory &&
      typeof autonomousOperationsRoutesModule
        .createAutonomousMediaOperationsRouter ===
        "function"
    ) {
      routerFactory =
        autonomousOperationsRoutesModule
          .createAutonomousMediaOperationsRouter;
    }

    if (
      !routerFactory &&
      typeof autonomousOperationsRoutesModule
        .createRouter ===
        "function"
    ) {
      routerFactory =
        autonomousOperationsRoutesModule
          .createRouter;
    }

    if (!routerFactory) {
      console.error(
        "EZ MEDIA: CODE 117 route factory not found."
      );

      return false;
    }

    const router =
      routerFactory({
        engine:
          engines.autonomousOperations,

        adminGuard:
          autonomousAdminGuard
      });

    if (!router) {
      console.error(
        "EZ MEDIA: CODE 117 route creation returned empty router."
      );

      return false;
    }

    app.use(
      "/api/operations",
      router
    );

    runtime.autonomousOperations.routeMounted =
      true;

    console.log(
      "EZ MEDIA: CODE 117 API mounted at /api/operations"
    );

    return true;
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 117 route mounting failed:",
      error
    );

    return false;
  }
}

/* ============================================================
   CODE 118 STATIC UI
============================================================ */

function mountAutonomousOperationsUI() {
  const uiDirectory =
    path.join(
      publicDirectory,
      "autonomous-media-operations"
    );

  const uiIndex =
    path.join(
      uiDirectory,
      "index.html"
    );

  /*
   * الواجهة تكون:
   *
   * /autonomous-media-operations/
   */

  app.use(
    "/autonomous-media-operations",
    express.static(
      uiDirectory,
      {
        index:
          "index.html",

        maxAge:
          process.env.NODE_ENV ===
          "production"
            ? "10m"
            : 0
      }
    )
  );

  /*
   * fallback للصفحة الرئيسية للواجهة.
   */

  app.get(
    "/autonomous-media-operations",
    (req, res) => {
      res.sendFile(
        uiIndex,
        (error) => {
          if (error) {
            res
              .status(404)
              .json({
                success: false,

                error:
                  "Autonomous Media Operations Center UI not found.",

                path:
                  uiIndex,

                requestId:
                  req.requestId
              });
          }
        }
      );
    }
  );

  console.log(
    "EZ MEDIA: CODE 118 UI mounted at /autonomous-media-operations/"
  );
}

/* ============================================================
   PLATFORM INFO
============================================================ */

app.get(
  "/",
  (req, res) => {
    res.json({
      platform:
        PLATFORM_NAME,

      version:
        PLATFORM_VERSION,

      status:
        "online",

      message:
        "EZ MEDIA 11.0 يعمل بنجاح",

      services: {
        api: true,

        cms: true,

        mediaLibrary: true,

        live: true,

        breakingNews: true,

        advertising: true,

        sponsorships: true,

        automation: true,

        ai: true,

        notifications: true,

        notificationWorker:
          runtime.notifications.workerStarted,

        autonomousOperations:
          runtime.autonomousOperations.initialized,

        autonomousOperationsAPI:
          runtime.autonomousOperations.routeMounted,

        autonomousOperationsUI:
          true,

        aiCollaboration:
          runtime.ai.collaboration,

        aiAutonomousAgents:
          runtime.ai.autonomousAgents,

        mediaMemory:
          runtime.ai.memory
      },

      runtime,

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* ============================================================
   ADMIN
============================================================ */

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        publicDirectory,
        "admin.html"
      )
    );
  }
);

/* ============================================================
   API OVERVIEW
============================================================ */

app.get(
  "/api",
  (req, res) => {
    res.json({
      platform:
        PLATFORM_NAME,

      version:
        PLATFORM_VERSION,

      status:
        "online",

      routes: {
        content:
          "/api/content",

        ai:
          "/api/ai",

        media:
          "/api/media",

        live:
          "/api/live",

        breaking:
          "/api/breaking",

        storage:
          "/api/storage",

        upload:
          "/api/upload",

        commercial:
          "/api/commercial",

        notifications:
          "/api/notifications",

        notificationWorker:
          "/api/notification-worker",

        autonomousOperations:
          "/api/operations",

        autonomousOperationsHealth:
          "/api/operations/health",

        autonomousOperationsDashboard:
          "/api/operations/dashboard",

        autonomousOperationsStatistics:
          "/api/operations/statistics",

        autonomousOperationsEvents:
          "/api/operations/events",

        autonomousOperationsApprovals:
          "/api/operations/approvals"
      },

      interfaces: {
        admin:
          "/admin",

        autonomousMediaOperations:
          "/autonomous-media-operations/"
      },

      timestamp:
        new Date().toISOString()
    });
  }
);

/* ============================================================
   HEALTH
============================================================ */

app.get(
  "/health",
  async (req, res) => {
    try {
      const database =
        await databaseHealth();

      const databaseStatus =
        database &&
        database.connected
          ? "ready"
          : database &&
              database.configured
            ? "configured_not_ready"
            : "not_configured";

      const healthy =
        databaseStatus ===
        "ready";

      res.status(
        healthy ? 200 : 200
      );

      res.json({
        platform:
          PLATFORM_NAME,

        version:
          PLATFORM_VERSION,

        status:
          "online",

        server:
          "online",

        database: {
          ...database,

          status:
            databaseStatus
        },

        services: {
          api: true,

          ai: true,

          media: true,

          live: true,

          breakingNews: true,

          notifications: true,

          notificationWorker:
            runtime.notifications.workerStarted,

          autonomousOperations:
            runtime.autonomousOperations.initialized
        },

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime:
          process.uptime(),

        requestId:
          req.requestId,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Health check error:",
        error
      );

      res.status(503).json({
        platform:
          PLATFORM_NAME,

        version:
          PLATFORM_VERSION,

        status:
          "degraded",

        server:
          "online",

        database: {
          configured:
            Boolean(
              process.env
                .DATABASE_URL
            ),

          connected:
            false,

          error:
            error.message
        },

        services: {
          api: true,

          ai: true,

          media: true,

          live: true,

          breakingNews: true,

          notifications: true,

          notificationWorker:
            runtime.notifications.workerStarted,

          autonomousOperations:
            runtime.autonomousOperations.initialized
        },

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime:
          process.uptime(),

        requestId:
          req.requestId,

        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/* ============================================================
   AUTONOMOUS OPERATIONS PLATFORM HEALTH
============================================================ */

app.get(
  "/api/system/autonomous-operations",
  async (req, res) => {
    let engineHealth =
      null;

    try {
      const engine =
        engines.autonomousOperations;

      if (
        engine &&
        typeof engine.health ===
          "function"
      ) {
        engineHealth =
          await engine.health();
      } else if (
        engine &&
        typeof engine.getHealth ===
          "function"
      ) {
        engineHealth =
          await engine.getHealth();
      }
    } catch (error) {
      engineHealth = {
        success: false,

        error:
          error.message
      };
    }

    res.json({
      success: true,

      platform:
        PLATFORM_NAME,

      version:
        PLATFORM_VERSION,

      autonomousOperations: {
        available:
          runtime.autonomousOperations.available,

        initialized:
          runtime.autonomousOperations.initialized,

        routeMounted:
          runtime.autonomousOperations.routeMounted,

        engine:
          engineHealth
      },

      ai: runtime.ai,

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

/* ============================================================
   SYSTEM DATABASE
============================================================ */

app.get(
  "/api/system/database",
  async (req, res) => {
    try {
      const database =
        await databaseHealth();

      res.json({
        success: true,

        database,

        timestamp:
          new Date().toISOString(),

        requestId:
          req.requestId
      });
    } catch (error) {
      res.status(503).json({
        success: false,

        database: {
          configured:
            Boolean(
              process.env
                .DATABASE_URL
            ),

          connected:
            false,

          error:
            error.message
        },

        timestamp:
          new Date().toISOString(),

        requestId:
          req.requestId
      });
    }
  }
);

/* ============================================================
   SYSTEM INFO
============================================================ */

app.get(
  "/api/system",
  async (req, res) => {
    let database =
      null;

    try {
      database =
        await databaseHealth();
    } catch (error) {
      database = {
        configured:
          Boolean(
            process.env
              .DATABASE_URL
          ),

        connected:
          false,

        error:
          error.message
      };
    }

    res.json({
      platform:
        PLATFORM_NAME,

      version:
        PLATFORM_VERSION,

      status:
        "online",

      server: {
        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime:
          process.uptime(),

        memory:
          process.memoryUsage()
      },

      database,

      runtime,

      engines: {
        autonomousOperations:
          Boolean(
            engines.autonomousOperations
          ),

        collaboration:
          Boolean(
            engines.collaboration
          ),

        autonomousAgents:
          Boolean(
            engines.autonomousAgents
          ),

        memory:
          Boolean(
            engines.memory
          )
      },

      services: {
        cms: true,

        ai: true,

        media: true,

        live: true,

        breaking: true,

        commercial: true,

        notifications: true,

        notificationWorker:
          runtime.notifications.workerStarted,

        autonomousOperations:
          runtime.autonomousOperations.initialized
      },

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

/* ============================================================
   AI / OPERATIONS STATUS
============================================================ */

app.get(
  "/api/system/ai",
  (req, res) => {
    res.json({
      success: true,

      platform:
        PLATFORM_NAME,

      version:
        PLATFORM_VERSION,

      ai: {
        enabled: true,

        autonomousAgents:
          runtime.ai.autonomousAgents,

        multiAgentCollaboration:
          runtime.ai.collaboration,

        mediaMemory:
          runtime.ai.memory,

        autonomousMediaOperations:
          runtime.autonomousOperations.initialized
      },

      humanApproval: {
        required:
          String(
            process.env
              .MEDIA_OPS_REQUIRE_HUMAN_APPROVAL ||
              "true"
          ).toLowerCase() ===
          "true"
      },

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

/* ============================================================
   FAVICON
============================================================ */

app.get(
  "/favicon.ico",
  (req, res) => {
    res.status(204).end();
  }
);

/* ============================================================
   404
============================================================ */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        "Route not found",

      path:
        req.originalUrl,

      method:
        req.method,

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* ============================================================
   ERROR HANDLER
============================================================ */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "EZ MEDIA server error:",
      error
    );

    const status =
      Number(error.status) >= 400 &&
      Number(error.status) < 600
        ? Number(error.status)
        : 500;

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(status).json({
      success: false,

      error:
        error.message ||
        "Internal server error",

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* ============================================================
   DATABASE INITIALIZATION
============================================================ */

async function initializeServices() {
  console.log(
    "=================================================="
  );

  console.log(
    "EZ MEDIA: initializing services..."
  );

  console.log(
    "=================================================="
  );

  /* ==========================================================
     MAIN DATABASE
  ========================================================== */

  try {
    await initializeDatabase();

    runtime.database.initialized =
      true;

    runtime.database.configured =
      Boolean(
        process.env
          .DATABASE_URL
      );

    console.log(
      "EZ MEDIA: main database initialized."
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: main database initialization failed:",
      error.message
    );
  }

  /* ==========================================================
     MEDIA DATABASE
  ========================================================== */

  try {
    await initializeMediaDatabase();

    console.log(
      "EZ MEDIA: media database initialized."
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: media database initialization failed:",
      error.message
    );
  }

  /* ==========================================================
     NOTIFICATION DATABASE
  ========================================================== */

  try {
    const notificationDatabase =
      await initializeNotifications();

    if (
      notificationDatabase &&
      notificationDatabase.success
    ) {
      runtime.notifications.initialized =
        true;

      console.log(
        "EZ MEDIA: notification database initialized."
      );
    } else {
      console.warn(
        "EZ MEDIA: notification database not ready:",
        notificationDatabase &&
          (
            notificationDatabase.status ||
            notificationDatabase.message
          )
      );
    }
  } catch (error) {
    console.error(
      "EZ MEDIA: notification database initialization failed:",
      error.message
    );
  }

  /* ==========================================================
     ADVANCED AI ENGINES
  ========================================================== */

  initializeAdvancedEngines();

  /* ==========================================================
     CODE 117 ROUTES
  ========================================================== */

  mountAutonomousOperationsRoutes();

  /* ==========================================================
     CODE 118 UI
  ========================================================== */

  mountAutonomousOperationsUI();

  console.log(
    "=================================================="
  );

  console.log(
    "EZ MEDIA: service initialization completed."
  );

  console.log(
    "=================================================="
  );
}

/* ============================================================
   NOTIFICATION WORKER
============================================================ */

function initializeNotificationWorker() {
  /*
   * إذا لم تكن قاعدة البيانات موجودة
   * ينتظر Worker إلى أن يتم إعدادها.
   */

  if (
    !process.env
      .DATABASE_URL
  ) {
    console.warn(
      "EZ MEDIA: Notification Worker waiting for DATABASE_URL."
    );

    return {
      started: false,

      reason:
        "DATABASE_URL is not configured"
    };
  }

  const intervalMs =
    Number(
      process.env
        .NOTIFICATION_WORKER_INTERVAL_MS ||
        15000
    );

  const batchSize =
    Number(
      process.env
        .NOTIFICATION_WORKER_BATCH_SIZE ||
        25
    );

  try {
    const state =
      startNotificationWorker({
        intervalMs,

        batchSize
      });

    registerNotificationWorkerShutdown();

    runtime.notifications.workerStarted =
      Boolean(
        state &&
        (
          state.started !==
            false
        )
      );

    return state;
  } catch (error) {
    console.error(
      "EZ MEDIA: Notification Worker startup failed:",
      error.message
    );

    return {
      started: false,

      reason:
        error.message
    };
  }
}

/* ============================================================
   AUTONOMOUS OPERATIONS START
============================================================ */

async function startAutonomousOperations() {
  if (
    !engines.autonomousOperations
  ) {
    console.warn(
      "EZ MEDIA: Autonomous Operations engine is not available."
    );

    return {
      started: false,

      reason:
        "engine_not_available"
    };
  }

  const enabled =
    String(
      process.env
        .MEDIA_OPS_ENABLED ||
        "true"
    ).toLowerCase() ===
    "true";

  if (!enabled) {
    console.log(
      "EZ MEDIA: Autonomous Operations is disabled by MEDIA_OPS_ENABLED."
    );

    return {
      started: false,

      reason:
        "disabled"
    };
  }

  try {
    /*
     * يدعم عدة أسماء محتملة حسب إصدار المحرك.
     */

    if (
      typeof engines
        .autonomousOperations
        .start ===
      "function"
    ) {
      const result =
        await engines
          .autonomousOperations
          .start();

      runtime.autonomousOperations.started =
        true;

      return {
        started: true,

        result
      };
    }

    if (
      typeof engines
        .autonomousOperations
        .initialize ===
      "function"
    ) {
      const result =
        await engines
          .autonomousOperations
          .initialize();

      runtime.autonomousOperations.started =
        true;

      return {
        started: true,

        result
      };
    }

    /*
     * المحرك لا يحتاج start صريح.
     */

    runtime.autonomousOperations.started =
      true;

    return {
      started: true,

      mode:
        "engine_ready_without_explicit_start"
    };
  } catch (error) {
    console.error(
      "EZ MEDIA: Autonomous Operations start failed:",
      error.message
    );

    return {
      started: false,

      error:
        error.message
    };
  }
}

/* ============================================================
   SERVER START
============================================================ */

async function startServer() {
  try {
    /*
     * أولًا:
     * تهيئة قاعدة البيانات والخدمات.
     */

    await initializeServices();

    /*
     * بدء الخادم.
     */

    const server =
      app.listen(
        PORT,
        HOST,
        async () => {
          console.log(
            "=================================================="
          );

          console.log(
            "EZ MEDIA 11.0"
          );

          console.log(
            "Server is running"
          );

          console.log(
            `Host: ${HOST}`
          );

          console.log(
            `Port: ${PORT}`
          );

          console.log(
            `Environment: ${
              process.env.NODE_ENV ||
              "development"
            }`
          );

          console.log(
            `Database configured: ${
              Boolean(
                process.env
                  .DATABASE_URL
              )
            }`
          );

          console.log(
            `Autonomous Operations: ${
              runtime.autonomousOperations.initialized
                ? "READY"
                : "NOT READY"
            }`
          );

          console.log(
            `Autonomous Operations API: ${
              runtime.autonomousOperations.routeMounted
                ? "READY"
                : "NOT READY"
            }`
          );

          console.log(
            "Autonomous Operations UI:"
          );

          console.log(
            "https://ez-media-production.up.railway.app/autonomous-media-operations/"
          );

          console.log(
            "=================================================="
          );

          /*
           * تشغيل Notification Worker.
           */

          const worker =
            initializeNotificationWorker();

          console.log(
            "EZ MEDIA Notification Worker:",
            worker
          );

          /*
           * تشغيل Autonomous Media Operations.
           */

          const operations =
            await startAutonomousOperations();

          console.log(
            "EZ MEDIA Autonomous Media Operations:",
            operations
          );

          console.log(
            "=================================================="
          );

          console.log(
            "EZ MEDIA: ALL STARTUP TASKS COMPLETED."
          );

          console.log(
            "=================================================="
          );
        }
      );

    /* ========================================================
       GRACEFUL SHUTDOWN
    ======================================================== */

    let shuttingDown =
      false;

    const shutdown =
      async (signal) => {
        if (
          shuttingDown
        ) {
          return;
        }

        shuttingDown =
          true;

        console.log(
          `EZ MEDIA: received ${signal}. Shutting down...`
        );

        /*
         * محاولة إيقاف مركز العمليات.
         */

        try {
          if (
            engines.autonomousOperations
          ) {
            if (
              typeof engines
                .autonomousOperations
                .stop ===
              "function"
            ) {
              await engines
                .autonomousOperations
                .stop();
            }

            if (
              typeof engines
                .autonomousOperations
                .shutdown ===
              "function"
            ) {
              await engines
                .autonomousOperations
                .shutdown();
            }
          }
        } catch (error) {
          console.error(
            "EZ MEDIA: autonomous operations shutdown error:",
            error.message
          );
        }

        /*
         * إغلاق HTTP Server.
         */

        server.close(
          () => {
            console.log(
              "EZ MEDIA: HTTP server closed."
            );

            process.exit(0);
          }
        );

        /*
         * حماية من التعليق.
         */

        setTimeout(
          () => {
            console.error(
              "EZ MEDIA: forced shutdown."
            );

            process.exit(1);
          },
          10000
        ).unref();
      };

    process.once(
      "SIGTERM",
      () =>
        shutdown(
          "SIGTERM"
        )
    );

    process.once(
      "SIGINT",
      () =>
        shutdown(
          "SIGINT"
        )
    );

    return server;
  } catch (error) {
    console.error(
      "EZ MEDIA startup error:",
      error
    );

    process.exit(1);
  }
}

/* ============================================================
   START
============================================================ */

if (
  require.main ===
  module
) {
  startServer();
}

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  app,

  startServer,

  runtime,

  engines
};
