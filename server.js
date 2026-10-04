"use strict";

/*
============================================================
 EZ MEDIA 11.0
 INTELLIGENT MEDIA PLATFORM
============================================================
*/

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

/* =========================================================
   DATABASE
========================================================= */

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

/* =========================================================
   NOTIFICATION WORKER
========================================================= */

const {
  startNotificationWorker,
  registerNotificationWorkerShutdown
} = require("./src/services/notificationWorker");

/* =========================================================
   CORE ROUTES
========================================================= */

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

/* =========================================================
   OPTIONAL MODULE LOADER
========================================================= */

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

/* =========================================================
   OPTIONAL AI / MEDIA ENGINES
========================================================= */

const autonomousOperationsEngineModule =
  safeRequire(
    "./src/services/autonomous-media-operations-center-engine"
  );

const autonomousOperationsRoutesModule =
  safeRequire(
    "./src/routes/autonomous-media-operations"
  );

const collaborationEngineModule =
  safeRequire(
    "./src/services/intelligent-ai-agent-collaboration-engine"
  );

const autonomousAgentEngineModule =
  safeRequire(
    "./src/services/intelligent-ai-agent-autonomous-engine"
  );

const mediaMemoryEngineModule =
  safeRequire(
    "./src/services/intelligent-media-memory-engine"
  );

const eventIntelligenceEngineModule =
  safeRequire(
    "./src/services/intelligent-media-event-intelligence-engine"
  );

const eventIntelligenceRoutesModule =
  safeRequire(
    "./src/routes/intelligent-media-event-intelligence"
  );

/* =========================================================
   APPLICATION
========================================================= */

const app = express();

/* =========================================================
   BASIC CONFIG
========================================================= */

const PORT =
  Number(process.env.PORT) || 3000;

const VERSION =
  "11.0.0";

const BUILD =
  "EZ-MEDIA-CONTENT-OS-2026-10-04";

/* =========================================================
   RUNTIME STATE
========================================================= */

const runtime = {
  startedAt: new Date().toISOString(),

  database: {
    initialized: false,
    configured: Boolean(process.env.DATABASE_URL),
    ready: false
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

/* =========================================================
   ENGINE STATE
========================================================= */

const engines = {
  autonomousOperations: null,
  collaboration: null,
  autonomousAgents: null,
  memory: null,
  eventIntelligence: null
};

/* =========================================================
   MIDDLEWARE
========================================================= */

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  compression()
);

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

/* =========================================================
   REQUEST ID
========================================================= */

app.use((req, res, next) => {
  const requestId =
    req.headers["x-request-id"] ||
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

  res.setHeader(
    "X-EZ-MEDIA-Request-ID",
    requestId
  );

  req.requestId = requestId;

  next();
});

/* =========================================================
   REQUEST LOG
========================================================= */

app.use((req, res, next) => {
  const started = Date.now();

  res.on("finish", () => {
    const duration =
      Date.now() - started;

    console.log(
      `[EZ MEDIA] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });

  next();
});

/* =========================================================
   STATIC PUBLIC
========================================================= */

const publicPath =
  path.join(__dirname, "public");

app.use(
  express.static(publicPath, {
    fallthrough: true
  })
);

/* =========================================================
   AUTONOMOUS MEDIA OPERATIONS UI
========================================================= */

const autonomousOperationsUIPath =
  path.join(
    __dirname,
    "public",
    "autonomous-media-operations"
  );

app.use(
  "/autonomous-media-operations",
  express.static(
    autonomousOperationsUIPath,
    {
      index: "index.html",
      fallthrough: true
    }
  )
);

app.get(
  "/autonomous-media-operations",
  (req, res) => {
    res.sendFile(
      path.join(
        autonomousOperationsUIPath,
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
        autonomousOperationsUIPath,
        "index.html"
      )
    );
  }
);

/* =========================================================
   CORE ROUTES
========================================================= */

app.use(
  "/api/commercial",
  commercialRoutes
);

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
  "/api/notifications",
  notificationsRoutes
);

app.use(
  "/api/notification-worker",
  notificationWorkerRoutes
);

/* =========================================================
   ENGINE INITIALIZATION
========================================================= */

function initializeAdvancedEngines() {

  /*
  ----------------------------------------------------------
  Autonomous Operations
  ----------------------------------------------------------
  */

  try {

    if (
      autonomousOperationsEngineModule
    ) {

      const Engine =
        autonomousOperationsEngineModule
          .AutonomousMediaOperationsCenterEngine ||
        autonomousOperationsEngineModule.default ||
        autonomousOperationsEngineModule;

      if (typeof Engine === "function") {

        engines.autonomousOperations =
          new Engine();

        runtime.autonomousOperations.available =
          true;

        runtime.autonomousOperations.initialized =
          true;
      }
    }

  } catch (error) {

    console.error(
      "Autonomous Operations initialization error:",
      error.message
    );
  }

  /*
  ----------------------------------------------------------
  Collaboration
  ----------------------------------------------------------
  */

  try {

    if (
      collaborationEngineModule
    ) {

      const Engine =
        collaborationEngineModule
          .IntelligentAIAgentCollaborationEngine ||
        collaborationEngineModule.default ||
        collaborationEngineModule;

      if (typeof Engine === "function") {

        engines.collaboration =
          new Engine();

        runtime.ai.collaboration =
          true;
      }
    }

  } catch (error) {

    console.error(
      "AI Collaboration initialization error:",
      error.message
    );
  }

  /*
  ----------------------------------------------------------
  Autonomous Agents
  ----------------------------------------------------------
  */

  try {

    if (
      autonomousAgentEngineModule
    ) {

      const Engine =
        autonomousAgentEngineModule
          .IntelligentAIAgentAutonomousEngine ||
        autonomousAgentEngineModule.default ||
        autonomousAgentEngineModule;

      if (typeof Engine === "function") {

        engines.autonomousAgents =
          new Engine();

        runtime.ai.autonomousAgents =
          true;
      }
    }

  } catch (error) {

    console.error(
      "Autonomous AI Agents initialization error:",
      error.message
    );
  }

  /*
  ----------------------------------------------------------
  Media Memory
  ----------------------------------------------------------
  */

  try {

    if (
      mediaMemoryEngineModule
    ) {

      const Engine =
        mediaMemoryEngineModule
          .IntelligentMediaMemoryEngine ||
        mediaMemoryEngineModule.default ||
        mediaMemoryEngineModule;

      if (typeof Engine === "function") {

        engines.memory =
          new Engine();

        runtime.ai.memory =
          true;
      }
    }

  } catch (error) {

    console.error(
      "Media Memory initialization error:",
      error.message
    );
  }

  /*
  ----------------------------------------------------------
  Event Intelligence
  ----------------------------------------------------------
  */

  try {

    if (
      eventIntelligenceEngineModule
    ) {

      const Engine =
        eventIntelligenceEngineModule
          .IntelligentMediaEventIntelligenceEngine ||
        eventIntelligenceEngineModule.default ||
        eventIntelligenceEngineModule;

      if (typeof Engine === "function") {

        engines.eventIntelligence =
          new Engine();

        runtime.eventIntelligence.available =
          true;

        runtime.eventIntelligence.initialized =
          true;

        runtime.ai.eventIntelligence =
          true;
      }
    }

  } catch (error) {

    console.error(
      "Event Intelligence initialization error:",
      error.message
    );
  }
}

/* =========================================================
   AUTONOMOUS OPERATIONS ROUTES
========================================================= */

function mountAutonomousOperationsRoutes() {

  if (
    !autonomousOperationsRoutesModule
  ) {
    console.warn(
      "EZ MEDIA: Autonomous Operations routes unavailable"
    );

    return;
  }

  try {

    const factory =
      autonomousOperationsRoutesModule
        .createAutonomousMediaOperationsRouter ||
      autonomousOperationsRoutesModule.default;

    if (
      typeof factory === "function" &&
      engines.autonomousOperations
    ) {

      const router =
        factory({
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
      }
    }

  } catch (error) {

    console.error(
      "Autonomous Operations route error:",
      error.message
    );
  }
}

/* =========================================================
   EVENT INTELLIGENCE ROUTES
========================================================= */

function mountEventIntelligenceRoutes() {

  if (
    !eventIntelligenceRoutesModule
  ) {
    return;
  }

  try {

    const factory =
      eventIntelligenceRoutesModule
        .createIntelligentMediaEventIntelligenceRouter ||
      eventIntelligenceRoutesModule.default;

    if (
      typeof factory === "function"
    ) {

      const router =
        factory({
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
      }
    }

  } catch (error) {

    console.error(
      "Event Intelligence route error:",
      error.message
    );
  }
}

/* =========================================================
   EXECUTIVE COMMAND CENTER
   CODE 119/122 - INLINE
========================================================= */

const executiveCommand = {

  refresh() {

    const now =
      new Date().toISOString();

    runtime.executiveCommand.lastRefresh =
      now;

    runtime.executiveCommand.status =
      "online";

    runtime.executiveCommand.lastError =
      null;

    return {
      platform: "EZ MEDIA",
      version: VERSION,
      build: BUILD,

      status: "online",

      timestamp: now,

      executive: {
        automation: "active",
        broadcasting: "ready",
        scheduling: "ready",
        workflow: "ready"
      },

      ai: {
        enabled: true,

        collaboration:
          runtime.ai.collaboration,

        autonomousAgents:
          runtime.ai.autonomousAgents,

        memory:
          runtime.ai.memory,

        eventIntelligence:
          runtime.ai.eventIntelligence
      },

      operations: {
        available:
          runtime.autonomousOperations.available,

        initialized:
          runtime.autonomousOperations.initialized,

        routeMounted:
          runtime.autonomousOperations.routeMounted,

        started:
          runtime.autonomousOperations.started
      },

      database: {
        configured:
          Boolean(process.env.DATABASE_URL),

        initialized:
          runtime.database.initialized,

        ready:
          runtime.database.ready
      },

      approvals: {
        required:
          process.env.MEDIA_OPS_REQUIRE_HUMAN_APPROVAL !==
          "false",

        pending: 0
      },

      broadcasting: {
        website: true,
        social: false,
        satellite: false,
        externalIntegration: false
      },

      safety: {
        humanApproval:
          process.env.MEDIA_OPS_REQUIRE_HUMAN_APPROVAL !==
          "false",

        emergencyStop:
          false
      }
    };
  }
};

/* =========================================================
   EXECUTIVE COMMAND API
   IMPORTANT:
   يجب أن يكون قبل 404
========================================================= */

app.get(
  "/api/executive-command/status",
  (req, res) => {

    res.json(
      executiveCommand.refresh()
    );
  }
);

app.get(
  "/api/executive-command/health",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",
      service: "Executive Command Center",
      status: "healthy",
      available: true,
      timestamp:
        new Date().toISOString()
    });
  }
);

app.get(
  "/api/executive-command/dashboard",
  (req, res) => {

    res.json(
      executiveCommand.refresh()
    );
  }
);

app.get(
  "/api/executive-command/systems",
  (req, res) => {

    res.json({
      server: "online",
      api: "online",

      database:
        runtime.database.ready
          ? "online"
          : "offline",

      ai: "online",

      autonomousOperations:
        runtime.autonomousOperations.available
          ? "online"
          : "limited",

      eventIntelligence:
        runtime.eventIntelligence.available
          ? "online"
          : "limited",

      timestamp:
        new Date().toISOString()
    });
  }
);

app.get(
  "/api/executive-command/ai",
  (req, res) => {

    res.json({
      enabled: true,

      collaboration:
        runtime.ai.collaboration,

      autonomousAgents:
        runtime.ai.autonomousAgents,

      memory:
        runtime.ai.memory,

      eventIntelligence:
        runtime.ai.eventIntelligence
    });
  }
);

app.get(
  "/api/executive-command/operations",
  (req, res) => {

    res.json({
      available:
        runtime.autonomousOperations.available,

      initialized:
        runtime.autonomousOperations.initialized,

      routeMounted:
        runtime.autonomousOperations.routeMounted,

      started:
        runtime.autonomousOperations.started,

      timestamp:
        new Date().toISOString()
    });
  }
);

app.get(
  "/api/executive-command/approvals",
  (req, res) => {

    res.json({
      humanApprovalRequired:
        process.env.MEDIA_OPS_REQUIRE_HUMAN_APPROVAL !==
        "false",

      pending: 0,

      message:
        "لا توجد موافقات معلقة مسجلة حاليًا."
    });
  }
);

app.get(
  "/api/executive-command/business",
  (req, res) => {

    res.json({
      audience: {
        status: "ready"
      },

      advertising: {
        status: "ready"
      },

      revenue: {
        status: "not_connected"
      },

      crm: {
        status: "ready"
      }
    });
  }
);

app.get(
  "/api/executive-command/matrix",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",

      matrix: {
        server: true,
        database:
          runtime.database.ready,
        ai: true,
        memory:
          runtime.ai.memory,
        agents:
          runtime.ai.autonomousAgents,
        collaboration:
          runtime.ai.collaboration,
        operations:
          runtime.autonomousOperations.available,
        eventIntelligence:
          runtime.eventIntelligence.available,
        executiveCommand: true
      },

      timestamp:
        new Date().toISOString()
    });
  }
);

app.post(
  "/api/executive-command/refresh",
  (req, res) => {

    res.json(
      executiveCommand.refresh()
    );
  }
);

app.post(
  "/api/executive-command/analysis",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",

      analysis: {
        status: "ready",

        recommendation:
          "النظام جاهز للتحليل التنفيذي، مع إبقاء القرارات الحساسة تحت موافقة بشرية."
      },

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   OPERATIONS FALLBACK API
========================================================= */

app.get(
  "/api/operations/health",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",
      service: "Autonomous Media Operations",
      status:
        runtime.autonomousOperations.available
          ? "online"
          : "limited",

      initialized:
        runtime.autonomousOperations.initialized,

      routeMounted:
        runtime.autonomousOperations.routeMounted,

      timestamp:
        new Date().toISOString()
    });
  }
);

app.get(
  "/api/operations/status",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",

      status:
        runtime.autonomousOperations.started
          ? "running"
          : "ready",

      available:
        runtime.autonomousOperations.available,

      started:
        runtime.autonomousOperations.started
    });
  }
);

/* =========================================================
   ROOT
========================================================= */

app.get(
  "/",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",
      version: VERSION,
      build: BUILD,

      status: "online",

      message:
        "EZ MEDIA Platform is running",

      api: "/api",
      health: "/health",

      executiveCommand:
        "/api/executive-command/status",

      autonomousOperations:
        "/autonomous-media-operations/",

      database:
        runtime.database.ready
          ? "ready"
          : "not_ready",

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  async (req, res) => {

    let database = {
      configured:
        Boolean(process.env.DATABASE_URL),

      ready:
        runtime.database.ready
    };

    try {

      if (
        typeof databaseHealth === "function"
      ) {

        const result =
          await databaseHealth();

        if (
          result &&
          typeof result === "object"
        ) {

          database = {
            ...database,
            ...result
          };
        }
      }

    } catch (error) {

      database.ready = false;

      runtime.database.ready =
        false;
    }

    res.json({
      platform: "EZ MEDIA",

      version: VERSION,

      build: BUILD,

      status: "healthy",

      server: {
        online: true,

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "production",

        uptime:
          process.uptime()
      },

      database,

      executiveCommand: {
        available: true,
        status: "online"
      },

      timestamp:
        new Date().toISOString()
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
      platform: "EZ MEDIA",

      version: VERSION,

      build: BUILD,

      status: "online",

      endpoints: {
        health: "/health",

        executiveCommand:
          "/api/executive-command/status",

        operations:
          "/api/operations/health",

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
          "/api/commercial"
      }
    });
  }
);

/* =========================================================
   SYSTEM API
========================================================= */

app.get(
  "/api/system",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",
      version: VERSION,

      status: "online",

      server: true,

      database:
        runtime.database.ready,

      ai: true,

      executiveCommand: true,

      autonomousOperations:
        runtime.autonomousOperations.available,

      eventIntelligence:
        runtime.eventIntelligence.available,

      timestamp:
        new Date().toISOString()
    });
  }
);

app.get(
  "/api/system/database",
  async (req, res) => {

    let health = {
      configured:
        Boolean(process.env.DATABASE_URL),

      ready:
        runtime.database.ready
    };

    try {

      if (
        typeof databaseHealth === "function"
      ) {

        const result =
          await databaseHealth();

        if (result) {
          health = {
            ...health,
            ...result
          };
        }
      }

    } catch (error) {

      health.ready = false;
    }

    res.json(health);
  }
);

app.get(
  "/api/system/ai",
  (req, res) => {

    res.json({
      available: true,

      collaboration:
        runtime.ai.collaboration,

      autonomousAgents:
        runtime.ai.autonomousAgents,

      memory:
        runtime.ai.memory,

      eventIntelligence:
        runtime.ai.eventIntelligence
    });
  }
);

app.get(
  "/api/system/autonomous-operations",
  (req, res) => {

    res.json({
      available:
        runtime.autonomousOperations.available,

      initialized:
        runtime.autonomousOperations.initialized,

      routeMounted:
        runtime.autonomousOperations.routeMounted,

      started:
        runtime.autonomousOperations.started
    });
  }
);

app.get(
  "/api/system/event-intelligence",
  (req, res) => {

    res.json({
      available:
        runtime.eventIntelligence.available,

      initialized:
        runtime.eventIntelligence.initialized,

      routeMounted:
        runtime.eventIntelligence.routeMounted
    });
  }
);

/* =========================================================
   SIMPLE AI AGENTS API
========================================================= */

app.get(
  "/api/ai/agents",
  (req, res) => {

    res.json({
      platform: "EZ MEDIA",

      orchestrator:
        "EZ AI ORCHESTRATOR",

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
  }
);

/* =========================================================
   LIVE STATUS
========================================================= */

app.get(
  "/api/live/status",
  (req, res) => {

    res.json({
      system: "EZ LIVE",

      status: "ready",

      live: false,

      integrations: {
        website: true,
        social: false,
        satellite: false
      },

      message:
        "البث الخارجي يحتاج إلى تكامل فعلي ومصرح به."
    });
  }
);

/* =========================================================
   AUTOMATION
========================================================= */

app.get(
  "/api/automation",
  (req, res) => {

    res.json({
      system: "EZ AUTOMATION",

      status: "ready",

      architecture:
        "event-driven",

      workflows: [],

      humanApproval:
        true
    });
  }
);

/* =========================================================
   FAVICON
========================================================= */

app.get(
  "/favicon.ico",
  (req, res) => {
    res.status(204).end();
  }
);

/* =========================================================
   404
   يجب أن يكون آخر شيء تقريبًا
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({
      platform: "EZ MEDIA",

      status: "not_found",

      path:
        req.originalUrl,

      message:
        "المسار المطلوب غير موجود في الإصدار الحالي."
    });
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

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      platform: "EZ MEDIA",

      status: "error",

      message:
        "Internal server error",

      requestId:
        req.requestId || null
    });
  }
);

/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeAllSystems() {

  /*
  Database
  */

  try {

    await initializeDatabase();

    runtime.database.initialized =
      true;

    runtime.database.ready =
      true;

  } catch (error) {

    runtime.database.initialized =
      false;

    runtime.database.ready =
      false;

    console.error(
      "EZ MEDIA database initialization error:",
      error.message
    );
  }

  /*
  Media Database
  */

  try {

    if (
      typeof initializeMediaDatabase ===
      "function"
    ) {

      await initializeMediaDatabase();
    }

  } catch (error) {

    console.error(
      "EZ MEDIA media database initialization error:",
      error.message
    );
  }

  /*
  Notifications
  */

  try {

    if (
      typeof initializeNotifications ===
      "function"
    ) {

      await initializeNotifications();

      runtime.notifications.initialized =
        true;
    }

  } catch (error) {

    console.error(
      "EZ MEDIA notification initialization error:",
      error.message
    );
  }

  /*
  Advanced Engines
  */

  initializeAdvancedEngines();

  /*
  Operations Routes
  */

  mountAutonomousOperationsRoutes();

  /*
  Event Intelligence
  */

  mountEventIntelligenceRoutes();

  /*
  Executive State
  */

  executiveCommand.refresh();
}

/* =========================================================
   START AUTONOMOUS OPERATIONS
========================================================= */

async function startAutonomousOperations() {

  const engine =
    engines.autonomousOperations;

  if (!engine) {
    return;
  }

  try {

    if (
      typeof engine.start ===
      "function"
    ) {

      await engine.start();

      runtime.autonomousOperations.started =
        true;
    }

  } catch (error) {

    console.error(
      "Autonomous Operations start error:",
      error.message
    );
  }
}

/* =========================================================
   NOTIFICATION WORKER
========================================================= */

async function startNotificationsWorkerSafe() {

  try {

    if (
      typeof startNotificationWorker ===
      "function"
    ) {

      await startNotificationWorker();

      runtime.notifications.workerStarted =
        true;
    }

  } catch (error) {

    console.error(
      "Notification worker start error:",
      error.message
    );
  }
}

/* =========================================================
   START SERVER
========================================================= */

let server = null;

async function startServer() {

  await initializeAllSystems();

  await startAutonomousOperations();

  await startNotificationsWorkerSafe();

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
          `Version: ${VERSION}`
        );

        console.log(
          `Build: ${BUILD}`
        );

        console.log(
          `Port: ${PORT}`
        );

        console.log(
          "Status: ONLINE"
        );

        console.log(
          `Executive Command: /api/executive-command/status`
        );

        console.log(
          `Operations UI: /autonomous-media-operations/`
        );

        console.log(
          `Database: ${
            runtime.database.ready
              ? "READY"
              : "NOT READY"
          }`
        );

        console.log(
          "========================================"
        );
      }
    );

  return server;
}

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {

  console.log(
    `EZ MEDIA: ${signal} received`
  );

  try {

    if (
      typeof registerNotificationWorkerShutdown ===
      "function"
    ) {

      registerNotificationWorkerShutdown();
    }

  } catch (error) {

    console.error(
      "Notification worker shutdown error:",
      error.message
    );
  }

  try {

    if (
      engines.autonomousOperations &&
      typeof engines.autonomousOperations.stop ===
      "function"
    ) {

      await engines.autonomousOperations.stop();
    }

  } catch (error) {

    console.error(
      "Autonomous Operations shutdown error:",
      error.message
    );
  }

  if (server) {

    server.close(() => {

      console.log(
        "EZ MEDIA: server closed"
      );

      process.exit(0);
    });

  } else {

    process.exit(0);
  }
}

/* =========================================================
   PROCESS SIGNALS
========================================================= */

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

/* =========================================================
   UNHANDLED ERRORS
========================================================= */

process.on(
  "unhandledRejection",
  (reason) => {

    console.error(
      "EZ MEDIA unhandledRejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {

    console.error(
      "EZ MEDIA uncaughtException:",
      error
    );
  }
);

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  app,
  startServer,
  runtime,
  engines
};

/* =========================================================
   START
========================================================= */

if (
  require.main === module
) {

  startServer().catch(
    (error) => {

      console.error(
        "EZ MEDIA STARTUP ERROR:",
        error
      );

      process.exit(1);
    }
  );
}
