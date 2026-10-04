"use strict";

/*
 * ============================================================
 * EZ MEDIA 11.0
 * CONTENT + AI + AUTONOMOUS MEDIA OPERATIONS
 * EXECUTIVE COMMAND CENTER
 *
 * الملف الرئيسي:
 * /server.js
 *
 * التشغيل:
 * node server.js
 *
 * Node:
 * >= 20
 * ============================================================
 */

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

/* ============================================================
 * DATABASE
 * ============================================================
 */

const {
  health: databaseHealth
} = require("./src/database/db");

const {
  initializeDatabase
} = require("./src/database/init");

const {
  initializeMediaDatabase
} = require("./src/database/media-init");

const {
  initializeNotifications
} = require("./src/database/notification-bootstrap");

/* ============================================================
 * NOTIFICATIONS
 * ============================================================
 */

const {
  startNotificationWorker,
  registerNotificationWorkerShutdown
} = require("./src/services/notificationWorker");

/* ============================================================
 * CORE ROUTES
 * ============================================================
 */

const contentRoutes = require("./src/routes/content");
const aiRoutes = require("./src/routes/ai");
const mediaRoutes = require("./src/routes/media");
const liveRoutes = require("./src/routes/live");
const breakingRoutes = require("./src/routes/breaking");
const storageRoutes = require("./src/routes/storage");
const uploadRoutes = require("./src/routes/upload");
const commercialRoutes = require("./src/routes/commercial");
const notificationsRoutes = require("./src/routes/notifications");
const notificationWorkerRoutes = require("./src/routes/notification-worker");

/* ============================================================
 * SAFE REQUIRE
 * ============================================================
 */

function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(
      `[EZ MEDIA] الوحدة غير متاحة: ${modulePath}`,
      error && error.message ? error.message : error
    );

    return null;
  }
}

/* ============================================================
 * ADVANCED ENGINES
 * ============================================================
 */

const autonomousOperationsEngineModule = safeRequire(
  "./src/services/autonomous-media-operations-center-engine"
);

const autonomousOperationsRoutesModule = safeRequire(
  "./src/routes/autonomous-media-operations"
);

const collaborationEngineModule = safeRequire(
  "./src/services/intelligent-ai-agent-collaboration-engine"
);

const autonomousAgentEngineModule = safeRequire(
  "./src/services/intelligent-ai-agent-autonomous-engine"
);

const mediaMemoryEngineModule = safeRequire(
  "./src/services/intelligent-media-memory-engine"
);

const eventIntelligenceEngineModule = safeRequire(
  "./src/services/intelligent-media-event-intelligence-engine"
);

const eventIntelligenceRoutesModule = safeRequire(
  "./src/routes/intelligent-media-event-intelligence"
);

/* ============================================================
 * EXPRESS
 * ============================================================
 */

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const VERSION = "11.0.0";

const BUILD =
  process.env.EZ_MEDIA_BUILD ||
  "EZ-MEDIA-CONTENT-OS-2026-10-04";

/* ============================================================
 * RUNTIME STATE
 * ============================================================
 */

const runtime = {
  startedAt: new Date().toISOString(),

  database: {
    initialized: false,
    configured: Boolean(process.env.DATABASE_URL),
    ready: false,
    health: null,
    error: null
  },

  notifications: {
    initialized: false,
    workerStarted: false,
    error: null
  },

  autonomousOperations: {
    available: false,
    initialized: false,
    routeMounted: false,
    started: false,
    lastError: null
  },

  eventIntelligence: {
    available: false,
    initialized: false,
    routeMounted: false,
    lastError: null
  },

  ai: {
    available: true,
    collaboration: false,
    autonomousAgents: false,
    memory: false,
    eventIntelligence: false
  },

  executiveCommand: {
    available: true,
    status: "online",
    lastRefresh: null,
    lastError: null
  }
};

/* ============================================================
 * ENGINE REGISTRY
 * ============================================================
 */

const engines = {
  autonomousOperations: null,
  collaboration: null,
  autonomousAgents: null,
  memory: null,
  eventIntelligence: null
};

/* ============================================================
 * MIDDLEWARE
 * ============================================================
 */

app.disable("x-powered-by");

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

app.use(compression());

app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.URLENCODED_BODY_LIMIT || "20mb"
  })
);

/* ============================================================
 * REQUEST ID
 * ============================================================
 */

app.use((req, res, next) => {
  const requestId =
    req.headers["x-request-id"] ||
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 12)}`;

  req.requestId = requestId;

  res.setHeader("X-Request-ID", requestId);

  next();
});

/* ============================================================
 * REQUEST LOGGER
 * ============================================================
 */

app.use((req, res, next) => {
  const started = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - started;

    console.log(
      JSON.stringify({
        message: "handled request",
        level: "info",
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration
      })
    );
  });

  next();
});

/* ============================================================
 * STATIC FILES
 * ============================================================
 */

const publicPath = path.join(__dirname, "public");

app.use(
  express.static(publicPath, {
    index: "index.html",
    fallthrough: true
  })
);

/* ============================================================
 * AUTONOMOUS MEDIA OPERATIONS UI
 *
 * لا نغيّر واجهة المستخدم الحالية.
 * ============================================================
 */

const executiveCommandCenterUIPath = path.join(
  __dirname,
  "public",
  "autonomous-media-operations"
);

app.use(
  "/autonomous-media-operations",
  express.static(executiveCommandCenterUIPath, {
    index: "index.html",
    fallthrough: false,
    redirect: true
  })
);

app.get(
  "/autonomous-media-operations",
  (req, res) => {
    res.sendFile(
      path.join(
        executiveCommandCenterUIPath,
        "index.html"
      )
    );
  }
);

app.get(
  "/autonomous-media-operations/",
  (req, res) => {
    res.sendFile(
      path.join(
        executiveCommandCenterUIPath,
        "index.html"
      )
    );
  }
);

/* ============================================================
 * BASIC SYSTEM ROUTES
 * ============================================================
 */

app.get("/", (req, res) => {
  res.json({
    platform: "EZ MEDIA",
    version: VERSION,
    build: BUILD,
    status: "online",
    message: "EZ MEDIA 11.0 يعمل",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      status: "/api/status",
      executiveCommand: "/api/executive-command/status",
      executiveDashboard:
        "/api/executive-command/dashboard",
      operations: "/api/operations/status",
      autonomousOperations:
        "/autonomous-media-operations/"
    }
  });
});

app.get("/health", async (req, res) => {
  let database = null;

  try {
    if (typeof databaseHealth === "function") {
      database = await databaseHealth();
    }
  } catch (error) {
    database = {
      ready: false,
      error: error.message
    };
  }

  res.json({
    platform: "EZ MEDIA",
    version: VERSION,
    build: BUILD,
    status: "online",
    timestamp: new Date().toISOString(),

    server: {
      online: true,
      node: process.version,
      environment:
        process.env.NODE_ENV || "production",
      uptime: process.uptime()
    },

    database: {
      configured: Boolean(process.env.DATABASE_URL),
      initialized:
        runtime.database.initialized,
      ready:
        runtime.database.ready,
      health: database
    },

    ai: runtime.ai,

    autonomousOperations:
      runtime.autonomousOperations,

    eventIntelligence:
      runtime.eventIntelligence,

    executiveCommand:
      runtime.executiveCommand
  });
});

app.get("/api/status", async (req, res) => {
  res.json({
    platform: "EZ MEDIA",
    version: VERSION,
    build: BUILD,
    status: "online",
    timestamp: new Date().toISOString(),

    server: {
      node: process.version,
      uptime: process.uptime(),
      environment:
        process.env.NODE_ENV || "production"
    },

    database: runtime.database,

    ai: runtime.ai,

    operations:
      runtime.autonomousOperations,

    eventIntelligence:
      runtime.eventIntelligence
  });
});

/* ============================================================
 * CORE API ROUTES
 * ============================================================
 */

app.use("/api/commercial", commercialRoutes);

app.use("/api/content", contentRoutes);

app.use("/api/ai", aiRoutes);

app.use("/api/media", mediaRoutes);

app.use("/api/live", liveRoutes);

app.use("/api/breaking", breakingRoutes);

app.use("/api/storage", storageRoutes);

app.use("/api/upload", uploadRoutes);

app.use(
  "/api/notifications",
  notificationsRoutes
);

app.use(
  "/api/notification-worker",
  notificationWorkerRoutes
);

/* ============================================================
 * SAFE VALUE HELPERS
 * ============================================================
 */

function firstDefined(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null
    ) {
      return value;
    }
  }

  return null;
}

function numberOrNull(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function booleanOrNull(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (
    value === "true" ||
    value === 1 ||
    value === "1"
  ) {
    return true;
  }

  if (
    value === "false" ||
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  return null;
}

function objectOrEmpty(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  return {};
}

/* ============================================================
 * SAFE ENGINE READ
 *
 * نقرأ فقط الدوال الآمنة الخاصة بالحالة.
 * لا يتم استدعاء start / stop / execute.
 * ============================================================
 */

async function safeEngineRead(
  engine,
  methods = [
    "dashboard",
    "status",
    "health",
    "statistics",
    "getDashboard",
    "getStatus",
    "getHealth",
    "getStatistics"
  ]
) {
  if (!engine) {
    return {
      available: false,
      data: null,
      method: null,
      error: null
    };
  }

  let lastError = null;

  for (const method of methods) {
    try {
      if (
        typeof engine[method] ===
        "function"
      ) {
        const result =
          await engine[method]();

        return {
          available: true,
          data:
            result === undefined
              ? {}
              : result,
          method,
          error: null
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  return {
    available: true,
    data: {},
    method: null,
    error: lastError
      ? lastError.message
      : null
  };
}

/* ============================================================
 * NORMALIZE ENGINE DATA
 * ============================================================
 */

function extractCollectionCount(
  source,
  keys
) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    if (
      source[key] !== undefined &&
      source[key] !== null
    ) {
      const value =
        numberOrNull(source[key]);

      if (value !== null) {
        return value;
      }

      if (
        Array.isArray(source[key])
      ) {
        return source[key].length;
      }
    }
  }

  return null;
}

function extractStatus(
  source
) {
  if (!source) {
    return null;
  }

  return firstDefined(
    source.status,
    source.state,
    source.health,
    source.mode
  );
}

/* ============================================================
 * ADVANCED ENGINE INITIALIZATION
 * ============================================================
 */

async function initializeAdvancedEngines() {
  console.log(
    "[EZ MEDIA] بدء تهيئة المحركات المتقدمة..."
  );

  /* ========================================================
   * AUTONOMOUS OPERATIONS
   * ========================================================
   */

  try {
    if (
      autonomousOperationsEngineModule
    ) {
      const Constructor =
        autonomousOperationsEngineModule.IntelligentMediaOperationsCenterEngine ||
        autonomousOperationsEngineModule.AutonomousMediaOperationsCenterEngine ||
        autonomousOperationsEngineModule.default ||
        autonomousOperationsEngineModule;

      if (
        typeof Constructor ===
        "function"
      ) {
        engines.autonomousOperations =
          new Constructor();

        runtime.autonomousOperations.available =
          true;

        runtime.autonomousOperations.initialized =
          true;

        console.log(
          "[EZ MEDIA] Autonomous Media Operations Engine: جاهز"
        );
      }
    }
  } catch (error) {
    runtime.autonomousOperations.lastError =
      error.message;

    console.error(
      "[EZ MEDIA] خطأ Autonomous Operations:",
      error.message
    );
  }

  /* ========================================================
   * AI COLLABORATION
   * ========================================================
   */

  try {
    if (
      collaborationEngineModule
    ) {
      const Constructor =
        collaborationEngineModule.IntelligentAIAgentCollaborationEngine ||
        collaborationEngineModule.default ||
        collaborationEngineModule;

      if (
        typeof Constructor ===
        "function"
      ) {
        engines.collaboration =
          new Constructor();

        runtime.ai.collaboration =
          true;

        console.log(
          "[EZ MEDIA] AI Collaboration Engine: جاهز"
        );
      }
    }
  } catch (error) {
    console.error(
      "[EZ MEDIA] خطأ AI Collaboration:",
      error.message
    );
  }

  /* ========================================================
   * AUTONOMOUS AI AGENTS
   * ========================================================
   */

  try {
    if (
      autonomousAgentEngineModule
    ) {
      const Constructor =
        autonomousAgentEngineModule.IntelligentAIAgentAutonomousEngine ||
        autonomousAgentEngineModule.default ||
        autonomousAgentEngineModule;

      if (
        typeof Constructor ===
        "function"
      ) {
        engines.autonomousAgents =
          new Constructor();

        runtime.ai.autonomousAgents =
          true;

        console.log(
          "[EZ MEDIA] Autonomous AI Agents Engine: جاهز"
        );
      }
    }
  } catch (error) {
    console.error(
      "[EZ MEDIA] خطأ Autonomous Agents:",
      error.message
    );
  }

  /* ========================================================
   * MEMORY
   * ========================================================
   */

  try {
    if (
      mediaMemoryEngineModule
    ) {
      const Constructor =
        mediaMemoryEngineModule.IntelligentMediaMemoryEngine ||
        mediaMemoryEngineModule.default ||
        mediaMemoryEngineModule;

      if (
        typeof Constructor ===
        "function"
      ) {
        engines.memory =
          new Constructor();

        runtime.ai.memory =
          true;

        console.log(
          "[EZ MEDIA] Intelligent Media Memory: جاهز"
        );
      }
    }
  } catch (error) {
    console.error(
      "[EZ MEDIA] خطأ Memory Engine:",
      error.message
    );
  }

  /* ========================================================
   * EVENT INTELLIGENCE
   * ========================================================
   */

  try {
    if (
      eventIntelligenceEngineModule
    ) {
      const Constructor =
        eventIntelligenceEngineModule.IntelligentMediaEventIntelligenceEngine ||
        eventIntelligenceEngineModule.default ||
        eventIntelligenceEngineModule;

      if (
        typeof Constructor ===
        "function"
      ) {
        engines.eventIntelligence =
          new Constructor();

        runtime.eventIntelligence.available =
          true;

        runtime.eventIntelligence.initialized =
          true;

        runtime.ai.eventIntelligence =
          true;

        console.log(
          "[EZ MEDIA] Event Intelligence Engine: جاهز"
        );
      }
    }
  } catch (error) {
    runtime.eventIntelligence.lastError =
      error.message;

    console.error(
      "[EZ MEDIA] خطأ Event Intelligence:",
      error.message
    );
  }

  console.log(
    "[EZ MEDIA] انتهت تهيئة المحركات المتقدمة."
  );
}

/* ============================================================
 * AUTONOMOUS OPERATIONS ROUTES
 * ============================================================
 */

function mountAutonomousOperationsRoutes() {
  try {
    if (
      !autonomousOperationsRoutesModule
    ) {
      return;
    }

    const factory =
      autonomousOperationsRoutesModule.createAutonomousMediaOperationsRouter ||
      autonomousOperationsRoutesModule.default;

    if (
      typeof factory !==
        "function" ||
      !engines.autonomousOperations
    ) {
      console.warn(
        "[EZ MEDIA] Autonomous Operations Router غير متاح."
      );

      return;
    }

    const router = factory({
      engine:
        engines.autonomousOperations
    });

    if (router) {
      app.use(
        "/api/operations",
        router
      );

      runtime.autonomousOperations.routeMounted =
        true;

      console.log(
        "[EZ MEDIA] تم تركيب /api/operations"
      );
    }
  } catch (error) {
    runtime.autonomousOperations.lastError =
      error.message;

    console.error(
      "[EZ MEDIA] خطأ تركيب Operations Router:",
      error.message
    );
  }
}

/* ============================================================
 * EVENT INTELLIGENCE ROUTES
 * ============================================================
 */

function mountEventIntelligenceRoutes() {
  try {
    if (
      !eventIntelligenceRoutesModule
    ) {
      return;
    }

    const factory =
      eventIntelligenceRoutesModule.createIntelligentMediaEventIntelligenceRouter ||
      eventIntelligenceRoutesModule.createEventIntelligenceRouter ||
      eventIntelligenceRoutesModule.default;

    if (
      typeof factory !==
        "function" ||
      !engines.eventIntelligence
    ) {
      console.warn(
        "[EZ MEDIA] Event Intelligence Router غير متاح."
      );

      return;
    }

    const router = factory({
      engine:
        engines.eventIntelligence
    });

    if (router) {
      app.use(
        "/api/ai/event-intelligence",
        router
      );

      runtime.eventIntelligence.routeMounted =
        true;

      console.log(
        "[EZ MEDIA] تم تركيب Event Intelligence Router"
      );
    }
  } catch (error) {
    runtime.eventIntelligence.lastError =
      error.message;

    console.error(
      "[EZ MEDIA] خطأ تركيب Event Intelligence Router:",
      error.message
    );
  }
}

/* ============================================================
 * EXECUTIVE COMMAND CENTER
 *
 * CODE 122
 *
 * هذه النسخة لا تفترض أرقامًا غير موجودة.
 * إذا لم يوفر المحرك رقمًا حقيقيًا يرجع null.
 * ============================================================
 */

const executiveCommand = {
  async refresh() {
    const now =
      new Date().toISOString();

    runtime.executiveCommand.lastRefresh =
      now;

    runtime.executiveCommand.status =
      "online";

    runtime.executiveCommand.lastError =
      null;

    try {
      /* ======================================================
       * READ ENGINES
       * ======================================================
       */

      const [
        operationsSnapshot,
        collaborationSnapshot,
        agentsSnapshot,
        memorySnapshot,
        eventSnapshot
      ] = await Promise.all([
        safeEngineRead(
          engines.autonomousOperations
        ),

        safeEngineRead(
          engines.collaboration
        ),

        safeEngineRead(
          engines.autonomousAgents
        ),

        safeEngineRead(
          engines.memory
        ),

        safeEngineRead(
          engines.eventIntelligence
        )
      ]);

      /* ======================================================
       * DATABASE
       * ======================================================
       */

      let databaseSnapshot =
        runtime.database.health;

      try {
        if (
          typeof databaseHealth ===
          "function"
        ) {
          databaseSnapshot =
            await databaseHealth();

          runtime.database.health =
            databaseSnapshot;

          const databaseObject =
            objectOrEmpty(
              databaseSnapshot
            );

          runtime.database.ready =
            databaseObject.ready ===
              true ||
            databaseObject.connected ===
              true ||
            databaseObject.ok === true ||
            databaseObject.status ===
              "healthy";
        }
      } catch (error) {
        runtime.database.ready =
          false;

        runtime.database.error =
          error.message;
      }

      /* ======================================================
       * RAW ENGINE OBJECTS
       * ======================================================
       */

      const operationData =
        objectOrEmpty(
          operationsSnapshot.data
        );

      const collaborationData =
        objectOrEmpty(
          collaborationSnapshot.data
        );

      const agentsData =
        objectOrEmpty(
          agentsSnapshot.data
        );

      const memoryData =
        objectOrEmpty(
          memorySnapshot.data
        );

      const eventData =
        objectOrEmpty(
          eventSnapshot.data
        );

      /* ======================================================
       * OPERATIONS COUNTS
       * ======================================================
       */

      const activeOperations =
        extractCollectionCount(
          operationData,
          [
            "active",
            "running",
            "activeOperations",
            "runningOperations",
            "activeCount"
          ]
        );

      const pendingOperations =
        extractCollectionCount(
          operationData,
          [
            "pending",
            "pendingOperations",
            "pendingCount",
            "queued",
            "queuedOperations"
          ]
        );

      const completedOperations =
        extractCollectionCount(
          operationData,
          [
            "completed",
            "completedOperations",
            "completedCount"
          ]
        );

      const failedOperations =
        extractCollectionCount(
          operationData,
          [
            "failed",
            "failedOperations",
            "failedCount"
          ]
        );

      /* ======================================================
       * AI COUNTS
       * ======================================================
       */

      const agentsCount =
        extractCollectionCount(
          agentsData,
          [
            "agents",
            "agentCount",
            "totalAgents",
            "activeAgents"
          ]
        );

      const missionsCount =
        extractCollectionCount(
          collaborationData,
          [
            "missions",
            "missionCount",
            "activeMissions",
            "totalMissions"
          ]
        );

      const teamsCount =
        extractCollectionCount(
          collaborationData,
          [
            "teams",
            "teamCount",
            "activeTeams",
            "totalTeams"
          ]
        );

      /* ======================================================
       * APPROVALS
       * ======================================================
       */

      const pendingApprovals =
        extractCollectionCount(
          operationData,
          [
            "pendingApprovals",
            "approvalCount",
            "approvalsPending"
          ]
        );

      /* ======================================================
       * EVENT INTELLIGENCE
       * ======================================================
       */

      const eventsCount =
        extractCollectionCount(
          eventData,
          [
            "events",
            "eventCount",
            "totalEvents",
            "activeEvents"
          ]
        );

      /* ======================================================
       * MEMORY
       * ======================================================
       */

      const memoryCount =
        extractCollectionCount(
          memoryData,
          [
            "memories",
            "memoryCount",
            "totalMemories",
            "records"
          ]
        );

      /* ======================================================
       * HUMAN APPROVAL
       * ======================================================
       */

      const humanApprovalRequired =
        process.env
          .MEDIA_OPS_REQUIRE_HUMAN_APPROVAL !==
        "false";

      /* ======================================================
       * BROADCASTING
       *
       * لا ندعي وجود بث فضائي حقيقي بدون
       * تكامل خارجي فعلي.
       * ======================================================
       */

      const broadcasting = {
        website: true,

        social:
          Boolean(
            process
