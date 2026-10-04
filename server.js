"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * MAIN SERVER
 * ============================================================
 *
 * الخادم المركزي لمنصة EZ MEDIA
 *
 * يحتوي على:
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
 * 13. Autonomous Media Operations Center
 * 14. Autonomous Media Operations UI
 * 15. Multi-Agent AI
 * 16. AI Autonomous Tasks
 * 17. Media Memory
 * 18. Event Intelligence
 * 19. System
 * 20. Health
 * 21. API Overview
 *
 * CODE 117
 * Autonomous Media Operations Center
 *
 * CODE 118
 * Autonomous Media Operations Center UI
 *
 * CODE 119
 * Intelligent Media Event Intelligence
 *
 * CODE 120
 * Event Intelligence API Integration
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
   OPTIONAL MODULE LOADER
============================================================ */

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
   AUTONOMOUS MEDIA OPERATIONS
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
   AI AUTONOMOUS AGENT
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
   CODE 119
   EVENT INTELLIGENCE ENGINE
============================================================ */

const eventIntelligenceEngineModule =
  safeRequire(
    "./src/services/intelligent-media-event-intelligence-engine"
  );

/* ============================================================
   CODE 120
   EVENT INTELLIGENCE ROUTER
============================================================ */

const eventIntelligenceRoutesModule =
  safeRequire(
    "./src/routes/intelligent-media-event-intelligence"
  );

/* ============================================================
   APPLICATION
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
   PLATFORM
============================================================ */

const PLATFORM_NAME =
  "EZ MEDIA";

const PLATFORM_VERSION =
  "11.0.0";

/* ============================================================
   RUNTIME
============================================================ */

const runtime = {
  startedAt:
    new Date().toISOString(),

  database: {
    initialized: false,

    configured:
      Boolean(
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

  eventIntelligence: {
    available: false,

    initialized: false,

    routeMounted: false
  },

  ai: {
    available: true,

    collaboration: false,

    autonomousAgents: false,

    memory: false
  }
};

/* ============================================================
   ADVANCED ENGINE REGISTRY
============================================================ */

const engines = {
  autonomousOperations: null,

  collaboration: null,

  autonomousAgents: null,

  memory: null,

  eventIntelligence: null
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
        } catch (_) {
          /* تجاهل أخطاء التسجيل */
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
   STATIC FILES
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

      index: false
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

app.use(
  "/api/notifications",
  notificationsRoutes
);

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

  if (
    typeof moduleObject ===
    "function"
  ) {
    return moduleObject;
  }

  for (
    const name of preferredNames
  ) {
    if (
      moduleObject[name]
    ) {
      return moduleObject[name];
    }
  }

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
   ENGINE INSTANCE CREATOR
============================================================ */

function createEngineInstance(
  moduleObject,
  options = {},
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

  if (
    typeof Engine ===
    "object"
  ) {
    return Engine;
  }

  try {
    return new Engine(
      options
    );
  } catch (newError) {
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
   INITIALIZE ADVANCED ENGINES
============================================================ */

function initializeAdvancedEngines() {
  console.log(
    "EZ MEDIA: initializing advanced engines..."
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
      "EZ MEDIA: CODE 114:",
      runtime.ai.autonomousAgents
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 114 error:",
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
      "EZ MEDIA: CODE 115:",
      runtime.ai.collaboration
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 115 error:",
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
      "EZ MEDIA: CODE 110:",
      runtime.ai.memory
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 110 error:",
      error.message
    );
  }

  /* ==========================================================
     CODE 117
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
      "EZ MEDIA: CODE 117:",
      runtime.autonomousOperations.initialized
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 117 error:",
      error.message
    );
  }

  /* ==========================================================
     CODE 119
  ========================================================== */

  try {
    engines.eventIntelligence =
      createEngineInstance(
        eventIntelligenceEngineModule,
        {
          app,

          databaseHealth,

          autonomousOperationsEngine:
            engines.autonomousOperations,

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
          "IntelligentMediaEventIntelligenceEngine",
          "MediaEventIntelligenceEngine",
          "EventIntelligenceEngine"
        ]
      );

    runtime.eventIntelligence.available =
      Boolean(
        eventIntelligenceEngineModule
      );

    runtime.eventIntelligence.initialized =
      Boolean(
        engines.eventIntelligence
      );

    console.log(
      "EZ MEDIA: CODE 119:",
      runtime.eventIntelligence.initialized
        ? "READY"
        : "UNAVAILABLE"
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 119 error:",
      error.message
    );
  }
}

/* ============================================================
   ADMIN GUARD
============================================================ */

function autonomousAdminGuard(
  req,
  res,
  next
) {
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
   CODE 117 ROUTER
============================================================ */

function mountAutonomousOperationsRoutes() {
  if (
    !autonomousOperationsRoutesModule
  ) {
    console.warn(
      "EZ MEDIA: CODE 117 route module unavailable."
    );

    return false;
  }

  if (
    !engines.autonomousOperations
  ) {
    console.warn(
      "EZ MEDIA: CODE 117 engine unavailable."
    );

    return false;
  }

  try {
    let routerFactory =
      null;

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
        "EZ MEDIA: CODE 117 router factory not found."
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
      return false;
    }

    /*
     * مهم:
     * هذا يتم قبل 404.
     */

    app.use(
      "/api/operations",
      router
    );

    runtime.autonomousOperations.routeMounted =
      true;

    console.log(
      "EZ MEDIA: CODE 117 API mounted: /api/operations"
    );

    return true;
  } catch (error) {
    console.error(
      "EZ MEDIA: CODE 117 route error:",
      error.message
    );

    return false;
  }
}

/* ============================================================
   CODE 118 UI
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

  app.get(
    "/autonomous-media-operations",
    (req, res) => {
      res.sendFile(
        uiIndex,
        (error) => {
          if (error) {
            res.status(404).json({
              success: false,

              error:
                "Autonomous Media Operations Center UI not found.",

              requestId:
                req.requestId
            });
          }
        }
      );
    }
  );

  console.log(
    "EZ MEDIA: CODE 118 UI mounted."
  );
}

/* ============================================================
   CODE 120 ROUTER
============================================================ */

function mountEventIntelligenceRoutes() {
  /*
   * إذا كان ملف Route موجودًا
   * نستخدمه.
   */

  if (
    eventIntelligenceRoutesModule &&
    engines.eventIntelligence
  ) {
    try {
      let routerFactory =
        null;

      if (
        typeof eventIntelligenceRoutesModule ===
        "function"
      ) {
        routerFactory =
          eventIntelligenceRoutesModule;
      }

      if (
        !routerFactory &&
        typeof eventIntelligenceRoutesModule
          .createIntelligentMediaEventIntelligenceRouter ===
          "function"
      ) {
        routerFactory =
          eventIntelligenceRoutesModule
            .createIntelligentMediaEventIntelligenceRouter;
      }

      if (
        !routerFactory &&
        typeof eventIntelligenceRoutesModule
          .createRouter ===
          "function"
      ) {
        routerFactory =
          eventIntelligenceRoutesModule
            .createRouter;
      }

      if (routerFactory) {
        const router =
          routerFactory({
            engine:
              engines.eventIntelligence,

            operationsEngine:
              engines.autonomousOperations
          });

        if (router) {
          app.use(
            "/api/ai/event-intelligence",
            router
          );

          runtime.eventIntelligence.routeMounted =
            true;

          console.log(
            "EZ MEDIA: CODE 120 router mounted."
          );

          return true;
        }
      }
    } catch (error) {
      console.error(
        "EZ MEDIA: CODE 120 external router failed:",
        error.message
      );
    }
  }

  /*
   * FALLBACK
   *
   * هذا مهم جدًا.
   *
   * حتى لو كان ملف Route غير موجود أو لم يتوافق
   * مع طريقة التصدير، لن يختفي المسار.
   */

  app.get(
    "/api/ai/event-intelligence/health",
    (req, res) => {
      res.status(200).json({
        success: true,

        service:
          "intelligent-media-event-intelligence",

        engine:
          "Intelligent Media Event Intelligence Engine",

        version:
          "119.0.0",

        status:
          "healthy",

        enabled:
          true,

        platform:
          PLATFORM_NAME,

        platformVersion:
          PLATFORM_VERSION,

        engineLoaded:
          Boolean(
            engines.eventIntelligence
          ),

        routerMode:
          "server-fallback",

        timestamp:
          new Date().toISOString(),

        requestId:
          req.requestId
      });
    }
  );

  app.post(
    "/api/ai/event-intelligence/analyze",
    async (req, res) => {
      try {
        const body =
          req.body || {};

        /*
         * إذا كان المحرك الحقيقي موجودًا
         * نستخدمه.
         */

        if (
          engines.eventIntelligence &&
          typeof engines
            .eventIntelligence
            .analyze ===
            "function"
        ) {
          const result =
            await engines
              .eventIntelligence
              .analyze(
                body
              );

          return res
            .status(200)
            .json(result);
        }

        /*
         * fallback تحليلي آمن.
         */

        const title =
          String(
            body.title || ""
          ).trim();

        const description =
          String(
            body.description ||
              ""
          ).trim();

        const text =
          `${title} ${description}`
            .toLowerCase();

        let category =
          "general";

        let risk =
          "low";

        let score =
          25;

        const categories = {
          politics: [
            "سياسة",
            "حكومة",
            "رئيس",
            "وزير",
            "انتخابات"
          ],

          economy: [
            "اقتصاد",
            "اقتصادية",
            "سوق",
            "أسهم",
            "بنك",
            "نفط"
          ],

          technology: [
            "تقنية",
            "تكنولوجيا",
            "ذكاء اصطناعي",
            "روبوت",
            "برمجيات"
          ],

          security: [
            "أمن",
            "أمني",
            "هجوم",
            "دفاع"
          ],

          sports: [
            "رياضة",
            "مباراة",
            "دوري",
            "بطولة"
          ],

          health: [
            "صحة",
            "مرض",
            "مستشفى",
            "دواء"
          ],

          environment: [
            "بيئة",
            "مناخ",
            "تلوث",
            "طقس"
          ],

          culture: [
            "ثقافة",
            "فن",
            "سينما",
            "مسرح",
            "كتاب"
          ],

          media: [
            "إعلام",
            "صحافة",
            "مذيع",
            "قناة"
          ]
        };

        for (
          const [
            name,
            words
          ] of Object.entries(
            categories
          )
        ) {
          if (
            words.some(
              word =>
                text.includes(
                  word
                )
            )
          ) {
            category =
              name;

            break;
          }
        }

        const criticalWords = [
          "حرب",
          "انفجار",
          "ضحايا",
          "كارثة",
          "إرهاب",
          "هجوم"
        ];

        const highRiskWords = [
          "عاجل",
          "طوارئ",
          "أزمة",
          "تحذير"
        ];

        if (
          criticalWords.some(
            word =>
              text.includes(
                word
              )
          )
        ) {
          risk =
            "critical";

          score +=
            50;
        } else if (
          highRiskWords.some(
            word =>
              text.includes(
                word
              )
          )
        ) {
          risk =
            "high";

          score +=
            30;
        }

        if (
          category ===
          "security"
        ) {
          score +=
            20;
        }

        if (
          category ===
          "politics"
        ) {
          score +=
            10;
        }

        if (
          category ===
          "economy"
        ) {
          score +=
            8;
        }

        if (
          text.includes(
            "عاجل"
          ) ||
          text.includes(
            "breaking"
          )
        ) {
          score +=
            20;
        }

        score =
          Math.min(
            100,
            score
          );

        let priority =
          "low";

        if (
          risk ===
            "critical" ||
          score >= 80
        ) {
          priority =
            "breaking";
        } else if (
          risk ===
            "high" ||
          score >= 60
        ) {
          priority =
            "important";
        } else if (
          score >= 40
        ) {
          priority =
            "normal";
        }

        const requiresHumanApproval =
          risk ===
            "high" ||
          risk ===
            "critical" ||
          priority ===
            "breaking";

        const recommendedActions =
          [];

        if (
          priority ===
          "breaking"
        ) {
          recommendedActions.push(
            "verify_sources",
            "editorial_review",
            "prepare_breaking_news",
            "prepare_distribution"
          );
        } else if (
          priority ===
          "important"
        ) {
          recommendedActions.push(
            "verify_sources",
            "editorial_review",
            "prepare_content"
          );
        } else {
          recommendedActions.push(
            "classify",
            "monitor"
          );
        }

        if (
          requiresHumanApproval
        ) {
          recommendedActions.push(
            "human_approval_required"
          );
        }

        return res
          .status(200)
          .json({
            success: true,

            service:
              "intelligent-media-event-intelligence",

            version:
              "119.0.0",

            event: {
              id:
                body.id ||
                `event-${Date.now()}`,

              title,

              description,

              source:
                body.source ||
                "unknown",

              category,

              risk,

              importanceScore:
                score,

              priority,

              requiresHumanApproval,

              recommendedActions
            },

            aiDecision: {
              action:
                priority ===
                "breaking"
                  ? "escalate"
                  : priority ===
                      "important"
                    ? "review"
                    : "monitor",

              confidence:
                category ===
                "general"
                  ? 60
                  : 80
            },

            safety: {
              automaticExternalPublishing:
                false,

              automaticExternalBroadcast:
                false,

              humanApprovalRequired:
                requiresHumanApproval
            },

            timestamp:
              new Date().toISOString(),

            requestId:
              req.requestId
          });
      } catch (error) {
        console.error(
          "EZ MEDIA: event intelligence analyze error:",
          error
        );

        return res
          .status(500)
          .json({
            success: false,

            error:
              "EVENT_INTELLIGENCE_FAILED",

            message:
              error.message,

            requestId:
              req.requestId
          });
      }
    }
  );

  app.post(
    "/api/ai/event-intelligence/process",
    async (req, res) => {
      try {
        const body =
          req.body || {};

        let analysis =
          null;

        if (
          engines.eventIntelligence &&
          typeof engines
            .eventIntelligence
            .processEvent ===
            "function"
        ) {
          analysis =
            await engines
              .eventIntelligence
              .processEvent(
                body
              );
        } else {
          analysis = {
            success: true,

            event: {
              id:
                body.id ||
                `event-${Date.now()}`,

              title:
                body.title ||
                "",

              description:
                body.description ||
                "",

              source:
                body.source ||
                "unknown"
            }
          };
        }

        /*
         * لا يوجد نشر خارجي تلقائي.
         */

        return res
          .status(200)
          .json({
            success: true,

            service:
              "intelligent-media-event-intelligence",

            analysis,

            operation: {
              connected:
                Boolean(
                  engines.autonomousOperations
                ),

              created:
                false,

              nextStep:
                "human_review_or_autonomous_operations"
            },

            safety: {
              externalPublishing:
                false,

              externalBroadcast:
                false,

              humanApproval:
                true
            },

            timestamp:
              new Date().toISOString(),

            requestId:
              req.requestId
          });
      } catch (error) {
        console.error(
          "EZ MEDIA: event processing error:",
          error
        );

        return res
          .status(500)
          .json({
            success: false,

            error:
              "EVENT_PROCESSING_FAILED",

            message:
              error.message,

            requestId:
              req.requestId
          });
      }
    }
  );

  runtime.eventIntelligence.routeMounted =
    true;

  console.log(
    "EZ MEDIA: CODE 120 fallback routes mounted."
  );

  return true;
}

/* ============================================================
   INITIALIZE ENGINES NOW
   ============================================================
 *
 * مهم جدًا:
 *
 * يتم هنا قبل 404.
 *
 * وهذا يحل المشكلة الموجودة في النسخة السابقة.
 */

initializeAdvancedEngines();

/* ============================================================
   MOUNT ADVANCED ROUTES NOW
   ============================================================
 *
 * لا ننتظر initializeServices().
 *
 * المسارات يجب أن تكون موجودة في Express قبل 404.
 */

mountAutonomousOperationsRoutes();

mountAutonomousOperationsUI();

mountEventIntelligenceRoutes();

/* ============================================================
   ROOT
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

        eventIntelligence:
          runtime.eventIntelligence.initialized,

        eventIntelligenceAPI:
          runtime.eventIntelligence.routeMounted,

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
          "/api/operations/approvals",

        eventIntelligence:
          "/api/ai/event-intelligence",

        eventIntelligenceHealth:
          "/api/ai/event-intelligence/health",

        eventIntelligenceAnalyze:
          "/api/ai/event-intelligence/analyze",

        eventIntelligenceProcess:
          "/api/ai/event-intelligence/process"
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

      res.status(200).json({
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
            runtime.autonomousOperations.initialized,

          eventIntelligence:
            runtime.eventIntelligence.initialized
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

      res.status(200).json({
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
            runtime.autonomousOperations.initialized,

          eventIntelligence:
            runtime.eventIntelligence.initialized
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
   SYSTEM AUTONOMOUS OPERATIONS
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

      eventIntelligence:
        runtime.eventIntelligence,

      ai:
        runtime.ai,

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

/* ============================================================
   EVENT INTELLIGENCE SYSTEM STATUS
============================================================ */

app.get(
  "/api/system/event-intelligence",
  async (req, res) => {
    let health =
      null;

    try {
      if (
        engines.eventIntelligence &&
        typeof engines
          .eventIntelligence
          .health ===
          "function"
      ) {
        health =
          await engines
            .eventIntelligence
            .health();
      } else {
        health = {
          success: true,

          status:
            "healthy",

          mode:
            "server-fallback"
        };
      }
    } catch (error) {
      health = {
        success: false,

        status:
          "degraded",

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

      eventIntelligence: {
        ...runtime.eventIntelligence,

        health
      },

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

/* ============================================================
   DATABASE STATUS
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
   SYSTEM
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
          ),

        eventIntelligence:
          Boolean(
            engines.eventIntelligence
          )
      },

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

/* ============================================================
   AI STATUS
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
          runtime.autonomousOperations.initialized,

        eventIntelligence:
          runtime.eventIntelligence.initialized
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
============================================================
 *
 * مهم:
 *
 * جميع المسارات السابقة تم تركيبها قبل الوصول إلى هنا.
 */

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

    if (
      res.headersSent
    ) {
      return next(error);
    }

    const status =
      Number(error.status) >= 400 &&
      Number(error.status) < 600
        ? Number(error.status)
        : 500;

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
        process.env.DATABASE_URL
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
        "EZ MEDIA: notification database not ready."
      );
    }
  } catch (error) {
    console.error(
      "EZ MEDIA: notification database initialization failed:",
      error.message
    );
  }
}

/* ============================================================
   NOTIFICATION WORKER
============================================================ */

function initializeNotificationWorker() {
  if (
    !process.env.DATABASE_URL
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
        state.started !==
          false
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
      "EZ MEDIA: Autonomous Operations disabled."
    );

    return {
      started: false,

      reason:
        "disabled"
    };
  }

  try {
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
     * قاعدة البيانات والخدمات.
     *
     * لاحظ:
     * المسارات تم تركيبها قبل هذه المرحلة.
     */

    await initializeServices();

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
                process.env.DATABASE_URL
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
            `Event Intelligence: ${
              runtime.eventIntelligence.initialized
                ? "READY"
                : "FALLBACK"
            }`
          );

          console.log(
            `Event Intelligence API: ${
              runtime.eventIntelligence.routeMounted
                ? "READY"
                : "NOT READY"
            }`
          );

          console.log(
            "=================================================="
          );

          const worker =
            initializeNotificationWorker();

          console.log(
            "EZ MEDIA Notification Worker:",
            worker
          );

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
      async signal => {
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

        server.close(
          () => {
            console.log(
              "EZ MEDIA: HTTP server closed."
            );

            process.exit(0);
          }
        );

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
   START APPLICATION
============================================================ */

if (
  require.main ===
  module
) {
  startServer();
}

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  app,

  startServer,

  runtime,

  engines
};
