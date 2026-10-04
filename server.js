"use strict";

/*
============================================================
 EZ MEDIA 11.0
 SERVER.JS — الإصدار المتكامل
============================================================

 يشمل:
 - Express
 - PostgreSQL
 - CMS
 - AI
 - AI Agents
 - AI Collaboration
 - Memory
 - Event Intelligence
 - Autonomous Media Operations
 - Executive Command Center
 - API
 - Upload / Storage
 - Live / Breaking News
 - Commercial / Advertising
 - Notifications
 - Security Headers
 - Compression
 - CORS
 - واجهة Executive Command Center
 - Health / System APIs

 لا يتم الادعاء بتنفيذ بث خارجي أو نشر خارجي
 ما لم تكن الخدمة الخارجية موصولة فعليًا.
============================================================
*/

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

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

const {
  startNotificationWorker,
  registerNotificationWorkerShutdown
} = require("./src/services/notificationWorker");

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


/* =========================================================
   SAFE REQUIRE
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
   OPTIONAL ADVANCED ENGINES
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
   EXPRESS APP
========================================================= */

const app = express();


/* =========================================================
   BASIC CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const NODE_ENV =
  process.env.NODE_ENV || "production";

const PLATFORM_VERSION =
  "11.0.0";


/* =========================================================
   RUNTIME STATE
========================================================= */

const runtime = {

  startedAt: new Date().toISOString(),

  database: {
    initialized: false,
    configured: Boolean(process.env.DATABASE_URL)
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
  },

  server: {
    online: false
  }

};


/* =========================================================
   ENGINE REGISTRY
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
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
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
      .slice(2, 12)}`;

  req.requestId = requestId;

  res.setHeader(
    "X-Request-ID",
    requestId
  );

  next();

});


/* =========================================================
   REQUEST LOGGER
========================================================= */

app.use((req, res, next) => {

  const started =
    Date.now();

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
   HEALTH HELPERS
========================================================= */

function safeDatabaseHealth() {

  try {

    if (typeof databaseHealth === "function") {

      return databaseHealth();

    }

    return {
      configured:
        Boolean(process.env.DATABASE_URL),

      ready: false,

      message:
        "Database health function unavailable"
    };

  } catch (error) {

    return {

      configured:
        Boolean(process.env.DATABASE_URL),

      ready: false,

      message:
        error.message

    };

  }

}


/* =========================================================
   INITIALIZE ADVANCED ENGINES
========================================================= */

function initializeAdvancedEngines() {

  /*
   * CODE 117
   */

  if (
    autonomousOperationsEngineModule
  ) {

    try {

      const Engine =
        autonomousOperationsEngineModule
          .AutonomousMediaOperationsCenterEngine ||
        autonomousOperationsEngineModule.default ||
        autonomousOperationsEngineModule;

      if (typeof Engine === "function") {

        engines.autonomousOperations =
          new Engine({
            databaseHealth:
              safeDatabaseHealth
          });

        runtime.autonomousOperations.available =
          true;

        runtime.autonomousOperations.initialized =
          true;

      }

    } catch (error) {

      console.error(
        "Autonomous Operations initialization error:",
        error
      );

    }

  }


  /*
   * CODE 115
   */

  if (
    collaborationEngineModule
  ) {

    try {

      const Engine =
        collaborationEngineModule
          .IntelligentAIAgentCollaborationEngine ||
        collaborationEngineModule.default ||
        collaborationEngineModule;

      if (typeof Engine === "function") {

        engines.collaboration =
          new Engine({
            databaseHealth:
              safeDatabaseHealth
          });

        runtime.ai.collaboration =
          true;

      }

    } catch (error) {

      console.error(
        "AI Collaboration initialization error:",
        error
      );

    }

  }


  /*
   * CODE 114
   */

  if (
    autonomousAgentEngineModule
  ) {

    try {

      const Engine =
        autonomousAgentEngineModule
          .IntelligentAIAgentAutonomousEngine ||
        autonomousAgentEngineModule.default ||
        autonomousAgentEngineModule;

      if (typeof Engine === "function") {

        engines.autonomousAgents =
          new Engine({
            databaseHealth:
              safeDatabaseHealth
          });

        runtime.ai.autonomousAgents =
          true;

      }

    } catch (error) {

      console.error(
        "Autonomous AI Agents initialization error:",
        error
      );

    }

  }


  /*
   * CODE 110
   */

  if (
    mediaMemoryEngineModule
  ) {

    try {

      const Engine =
        mediaMemoryEngineModule
          .IntelligentMediaMemoryEngine ||
        mediaMemoryEngineModule.default ||
        mediaMemoryEngineModule;

      if (typeof Engine === "function") {

        engines.memory =
          new Engine({
            databaseHealth:
              safeDatabaseHealth
          });

        runtime.ai.memory =
          true;

      }

    } catch (error) {

      console.error(
        "Media Memory initialization error:",
        error
      );

    }

  }


  /*
   * Event Intelligence
   */

  if (
    eventIntelligenceEngineModule
  ) {

    try {

      const Engine =
        eventIntelligenceEngineModule
          .IntelligentMediaEventIntelligenceEngine ||
        eventIntelligenceEngineModule.default ||
        eventIntelligenceEngineModule;

      if (typeof Engine === "function") {

        engines.eventIntelligence =
          new Engine({
            databaseHealth:
              safeDatabaseHealth
          });

        runtime.eventIntelligence.available =
          true;

        runtime.eventIntelligence.initialized =
          true;

      }

    } catch (error) {

      console.error(
        "Event Intelligence initialization error:",
        error
      );

    }

  }

}


/* =========================================================
   GENERIC ENGINE CALL
========================================================= */

async function safeEngineCall(
  engine,
  methods = [],
  fallback = null
) {

  if (!engine) {

    return fallback;

  }

  for (const method of methods) {

    try {

      if (
        typeof engine[method] === "function"
      ) {

        return await engine[method]();

      }

    } catch (error) {

      console.warn(
        `Engine method ${method} failed:`,
        error.message
      );

    }

  }

  return fallback;

}


/* =========================================================
   AUTONOMOUS OPERATIONS ROUTES
========================================================= */

function mountAutonomousOperationsRoutes() {

  if (
    !autonomousOperationsRoutesModule ||
    !engines.autonomousOperations
  ) {

    return;

  }

  try {

    const createRouter =
      autonomousOperationsRoutesModule
        .createAutonomousMediaOperationsRouter ||
      autonomousOperationsRoutesModule.default ||
      autonomousOperationsRoutesModule;

    if (typeof createRouter !== "function") {

      return;

    }

    const router =
      createRouter({
        engine:
          engines.autonomousOperations,

        adminGuard:
          null
      });

    if (router) {

      app.use(
        "/api/operations",
        router
      );

      runtime.autonomousOperations.routeMounted =
        true;

      console.log(
        "EZ MEDIA: Autonomous Operations routes mounted."
      );

    }

  } catch (error) {

    console.error(
      "Autonomous Operations routes error:",
      error
    );

  }

}


/* =========================================================
   AUTONOMOUS OPERATIONS UI
========================================================= */

function mountAutonomousOperationsUI() {

  const uiPath =
    path.join(
      __dirname,
      "public",
      "autonomous-media-operations"
    );

  app.use(
    "/autonomous-media-operations",
    express.static(
      uiPath,
      {
        index: "index.html",
        fallthrough: false,
        redirect: true
      }
    )
  );

  app.get(
    "/autonomous-media-operations",
    (req, res) => {

      res.sendFile(
        path.join(
          uiPath,
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
          uiPath,
          "index.html"
        )
      );

    }
  );

}


/* =========================================================
   EVENT INTELLIGENCE
========================================================= */

function mountEventIntelligenceRoutes() {

  if (
    !eventIntelligenceRoutesModule ||
    !engines.eventIntelligence
  ) {

    return;

  }

  try {

    const createRouter =
      eventIntelligenceRoutesModule
        .createIntelligentMediaEventIntelligenceRouter ||
      eventIntelligenceRoutesModule
        .createEventIntelligenceRouter ||
      eventIntelligenceRoutesModule.default ||
      eventIntelligenceRoutesModule;

    if (typeof createRouter !== "function") {

      return;

    }

    const router =
      createRouter({
        engine:
          engines.eventIntelligence,

        adminGuard:
          null
      });

    if (router) {

      app.use(
        "/api/ai/event-intelligence",
        router
      );

      runtime.eventIntelligence.routeMounted =
        true;

    }

  } catch (error) {

    console.error(
      "Event Intelligence routes error:",
      error
    );

  }

}


/* =========================================================
   EXISTING CORE ROUTES
========================================================= */

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


/* =========================================================
   INITIALIZE ENGINES + ADVANCED ROUTES
========================================================= */

initializeAdvancedEngines();

mountAutonomousOperationsRoutes();

mountAutonomousOperationsUI();

mountEventIntelligenceRoutes();


/* =========================================================
   CODE 122
   EXECUTIVE COMMAND CENTER
========================================================= */


/*
============================================================
 الحالة التنفيذية
============================================================
*/

const executiveCommandState = {

  platform: "EZ MEDIA",

  version: PLATFORM_VERSION,

  status: "online",

  startedAt:
    new Date().toISOString(),

  lastRefresh:
    new Date().toISOString(),

  lastCommand:
    null,

  lastAnalysis:
    null,

  lastError:
    null,

  automation: {

    enabled: true,

    humanApprovalRequired:
      true

  },

  broadcasting: {

    enabled:
      true,

    liveReady:
      false,

    externalProviderConnected:
      false

  },

  scheduling: {

    enabled:
      true

  },

  workflow: {

    enabled:
      true

  },

  approvals: [],

  history: [],

  commands: [],

  emergencyStop:
    false

};


/* =========================================================
   EXECUTIVE HELPERS
========================================================= */

function executiveNow() {

  return new Date().toISOString();

}


function executiveAddHistory(
  type,
  action,
  status,
  data = {}
) {

  const item = {

    id:
      `exec-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    type,

    action,

    status,

    timestamp:
      executiveNow(),

    data

  };

  executiveCommandState.history.unshift(
    item
  );

  if (
    executiveCommandState.history.length >
    200
  ) {

    executiveCommandState.history =
      executiveCommandState.history.slice(
        0,
        200
      );

  }

  return item;

}


function executiveCreateApproval(
  action,
  description,
  payload = {}
) {

  const approval = {

    id:
      `approval-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    action,

    description,

    payload,

    status:
      "pending",

    createdAt:
      executiveNow(),

    decidedAt:
      null,

    decision:
      null

  };

  executiveCommandState.approvals.push(
    approval
  );

  executiveAddHistory(
    "approval",
    action,
    "pending",
    {
      approvalId:
        approval.id
    }
  );

  return approval;

}


function executivePendingApprovals() {

  return executiveCommandState.approvals
    .filter(
      item =>
        item.status === "pending"
    );

}


/* =========================================================
   SYSTEM MATRIX
========================================================= */

function executiveSystems() {

  const database =
    safeDatabaseHealth();

  return {

    platform: {

      name:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION,

      environment:
        NODE_ENV,

      online:
        true

    },

    database: {

      configured:
        Boolean(
          process.env.DATABASE_URL
        ),

      ready:
        Boolean(
          database &&
          database.ready
        ),

      status:
        database &&
        database.ready
          ? "ready"
          : "not_ready"

    },

    ai: {

      available:
        runtime.ai.available,

      collaboration:
        runtime.ai.collaboration,

      autonomousAgents:
        runtime.ai.autonomousAgents,

      memory:
        runtime.ai.memory

    },

    operations: {

      available:
        runtime.autonomousOperations.available,

      initialized:
        runtime.autonomousOperations.initialized,

      routes:
        runtime.autonomousOperations.routeMounted,

      started:
        runtime.autonomousOperations.started

    },

    eventIntelligence: {

      available:
        runtime.eventIntelligence.available,

      initialized:
        runtime.eventIntelligence.initialized,

      routes:
        runtime.eventIntelligence.routeMounted

    },

    broadcast: {

      interface:
        true,

      providerConnected:
        executiveCommandState
          .broadcasting
          .externalProviderConnected,

      liveReady:
        executiveCommandState
          .broadcasting
          .liveReady

    },

    automation: {

      enabled:
        executiveCommandState
          .automation
          .enabled,

      humanApprovalRequired:
        executiveCommandState
          .automation
          .humanApprovalRequired

    },

    security: {

      helmet:
        true,

      cors:
        true,

      requestId:
        true

    }

  };

}


/* =========================================================
   AI EXECUTIVE STATE
========================================================= */

function executiveAIState() {

  return {

    enabled:
      true,

    autonomous:
      runtime.ai.autonomousAgents,

    collaboration:
      runtime.ai.collaboration,

    memory:
      runtime.ai.memory,

    eventIntelligence:
      runtime.eventIntelligence.available,

    humanApprovalRequired:
      true,

    agents: {

      available:
        runtime.ai.autonomousAgents
          ? 14
          : 0,

      active:
        0

    },

    teams: {

      available:
        runtime.ai.collaboration
          ? 6
          : 0,

      active:
        0

    }

  };

}


/* =========================================================
   OPERATIONS STATE
========================================================= */

async function executiveOperationsState() {

  const fallback = {

    available:
      runtime.autonomousOperations.available,

    started:
      runtime.autonomousOperations.started,

    active:
      0,

    pending:
      0,

    completed:
      0,

    failed:
      0,

    total:
      0

  };

  if (
    !engines.autonomousOperations
  ) {

    return fallback;

  }

  try {

    let data = null;

    if (
      typeof engines
        .autonomousOperations
        .statistics === "function"
    ) {

      data =
        await engines
          .autonomousOperations
          .statistics();

    } else if (
      typeof engines
        .autonomousOperations
        .getStatistics === "function"
    ) {

      data =
        await engines
          .autonomousOperations
          .getStatistics();

    }

    if (!data) {

      return fallback;

    }

    return {

      ...fallback,

      ...data

    };

  } catch (error) {

    return {

      ...fallback,

      error:
        error.message

    };

  }

}


/* =========================================================
   BUSINESS STATE
========================================================= */

function executiveBusinessState() {

  return {

    advertising: {

      enabled:
        true,

      status:
        "ready"

    },

    sponsorships: {

      enabled:
        true,

      status:
        "ready"

    },

    crm: {

      enabled:
        true,

      status:
        "ready"

    },

    audience: {

      analytics:
        true,

      status:
        "ready"

    },

    revenue: {

      tracking:
        true,

      status:
        "ready"

    }

  };

}


/* =========================================================
   EXECUTIVE DASHBOARD
========================================================= */

async function buildExecutiveDashboard() {

  const operations =
    await executiveOperationsState();

  const systems =
    executiveSystems();

  const ai =
    executiveAIState();

  const approvals =
    executivePendingApprovals();

  return {

    platform: {

      name:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION,

      status:
        executiveCommandState
          .emergencyStop
          ? "emergency_stop"
          : "online",

      environment:
        NODE_ENV,

      uptime:
        process.uptime(),

      startedAt:
        runtime.startedAt,

      lastRefresh:
        executiveNow()

    },

    executive: {

      automation:
        executiveCommandState.automation,

      broadcasting:
        executiveCommandState.broadcasting,

      scheduling:
        executiveCommandState.scheduling,

      workflow:
        executiveCommandState.workflow,

      emergencyStop:
        executiveCommandState.emergencyStop

    },

    systems,

    ai,

    operations,

    approvals: {

      pending:
        approvals.length,

      required:
        executiveCommandState
          .automation
          .humanApprovalRequired,

      items:
        approvals

    },

    business:
      executiveBusinessState(),

    history:
      executiveCommandState.history
        .slice(0, 20)

  };

}


/* =========================================================
   EXECUTIVE STATUS
========================================================= */

app.get(
  "/api/executive-command/status",
  async (req, res) => {

    try {

      const dashboard =
        await buildExecutiveDashboard();

      res.json({

        success:
          true,

        platform:
          "EZ MEDIA",

        version:
          PLATFORM_VERSION,

        status:
          dashboard.platform.status,

        timestamp:
          executiveNow(),

        dashboard

      });

    } catch (error) {

      executiveCommandState.lastError =
        error.message;

      res.status(500).json({

        success:
          false,

        error:
          "EXECUTIVE_STATUS_ERROR",

        message:
          error.message

      });

    }

  }
);


/* =========================================================
   EXECUTIVE HEALTH
========================================================= */

app.get(
  "/api/executive-command/health",
  async (req, res) => {

    const database =
      safeDatabaseHealth();

    res.json({

      success:
        true,

      platform:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION,

      status:
        "online",

      server:
        "online",

      database: {

        configured:
          Boolean(
            process.env.DATABASE_URL
          ),

        ready:
          Boolean(
            database &&
            database.ready
          )

      },

      ai:
        executiveAIState(),

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

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   EXECUTIVE DASHBOARD API
========================================================= */

app.get(
  "/api/executive-command/dashboard",
  async (req, res) => {

    try {

      const dashboard =
        await buildExecutiveDashboard();

      executiveCommandState.lastRefresh =
        executiveNow();

      res.json({

        success:
          true,

        data:
          dashboard,

        dashboard

      });

    } catch (error) {

      res.status(500).json({

        success:
          false,

        error:
          "DASHBOARD_ERROR",

        message:
          error.message

      });

    }

  }
);


/* =========================================================
   SYSTEMS
========================================================= */

app.get(
  "/api/executive-command/systems",
  (req, res) => {

    res.json({

      success:
        true,

      systems:
        executiveSystems(),

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   AI
========================================================= */

app.get(
  "/api/executive-command/ai",
  (req, res) => {

    res.json({

      success:
        true,

      ai:
        executiveAIState(),

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   OPERATIONS
========================================================= */

app.get(
  "/api/executive-command/operations",
  async (req, res) => {

    try {

      const operations =
        await executiveOperationsState();

      res.json({

        success:
          true,

        operations,

        timestamp:
          executiveNow()

      });

    } catch (error) {

      res.status(500).json({

        success:
          false,

        error:
          "OPERATIONS_ERROR",

        message:
          error.message

      });

    }

  }
);


/* =========================================================
   APPROVALS
========================================================= */

app.get(
  "/api/executive-command/approvals",
  (req, res) => {

    res.json({

      success:
        true,

      approvals:
        executivePendingApprovals(),

      pending:
        executivePendingApprovals().length,

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   BUSINESS
========================================================= */

app.get(
  "/api/executive-command/business",
  (req, res) => {

    res.json({

      success:
        true,

      business:
        executiveBusinessState(),

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   MATRIX
========================================================= */

app.get(
  "/api/executive-command/matrix",
  (req, res) => {

    res.json({

      success:
        true,

      matrix:
        executiveSystems(),

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   HISTORY
========================================================= */

app.get(
  "/api/executive-command/history",
  (req, res) => {

    res.json({

      success:
        true,

      history:
        executiveCommandState.history,

      commands:
        executiveCommandState.commands,

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   REFRESH
========================================================= */

app.post(
  "/api/executive-command/refresh",
  async (req, res) => {

    try {

      executiveCommandState.lastRefresh =
        executiveNow();

      const dashboard =
        await buildExecutiveDashboard();

      executiveAddHistory(
        "system",
        "refresh",
        "completed"
      );

      res.json({

        success:
          true,

        message:
          "تم تحديث مركز القيادة التنفيذية",

        dashboard,

        timestamp:
          executiveNow()

      });

    } catch (error) {

      executiveCommandState.lastError =
        error.message;

      res.status(500).json({

        success:
          false,

        error:
          "REFRESH_ERROR",

        message:
          error.message

      });

    }

  }
);


/* =========================================================
   AI ANALYSIS
========================================================= */

app.post(
  "/api/executive-command/analysis",
  async (req, res) => {

    try {

      const dashboard =
        await buildExecutiveDashboard();

      const analysis = {

        generatedAt:
          executiveNow(),

        platformStatus:
          dashboard.platform.status,

        database:
          dashboard.systems.database.status,

        aiReady:
          dashboard.ai.enabled,

        autonomousAgents:
          dashboard.ai.autonomous,

        collaboration:
          dashboard.ai.collaboration,

        operationsActive:
          dashboard.operations.active || 0,

        pendingApprovals:
          dashboard.approvals.pending,

        recommendations: []

      };


      if (
        dashboard.approvals.pending > 0
      ) {

        analysis.recommendations.push(
          "يوجد إجراء أو أكثر يحتاج إلى موافقة بشرية."
        );

      }


      if (
        dashboard.systems.database.ready !== true
      ) {

        analysis.recommendations.push(
          "قاعدة البيانات غير جاهزة حاليًا."
        );

      }


      if (
        !dashboard.ai.autonomous
      ) {

        analysis.recommendations.push(
          "محرك الوكلاء الذاتيين غير متاح."
        );

      }


      if (
        analysis.recommendations.length === 0
      ) {

        analysis.recommendations.push(
          "الأنظمة الأساسية في حالة تشغيلية مستقرة."
        );

      }


      executiveCommandState.lastAnalysis =
        analysis;

      executiveAddHistory(
        "ai",
        "analysis",
        "completed"
      );


      res.json({

        success:
          true,

        analysis

      });

    } catch (error) {

      executiveCommandState.lastError =
        error.message;

      res.status(500).json({

        success:
          false,

        error:
          "ANALYSIS_ERROR",

        message:
          error.message

      });

    }

  }
);


/* =========================================================
   COMMAND CENTER COMMAND
========================================================= */

app.post(
  "/api/executive-command/command",
  async (req, res) => {

    try {

      const {
        command,
        action,
        payload = {},
        requireApproval
      } = req.body || {};

      const requestedAction =
        command ||
        action;


      if (!requestedAction) {

        return res.status(400).json({

          success:
            false,

          error:
            "COMMAND_REQUIRED",

          message:
            "يجب تحديد command أو action."

        });

      }


      const sensitiveActions = [

        "publish",

        "publish-news",

        "broadcast",

        "start-broadcast",

        "stop-broadcast",

        "delete",

        "delete-content",

        "send",

        "send-notification",

        "commercial",

        "advertising",

        "financial",

        "external-publish"

      ];


      const needsApproval =
        requireApproval === true ||
        sensitiveActions.includes(
          requestedAction
        );


      if (
        needsApproval &&
        executiveCommandState
          .automation
          .humanApprovalRequired
      ) {

        const approval =
          executiveCreateApproval(

            requestedAction,

            `طلب تنفيذ الإجراء: ${requestedAction}`,

            payload

          );


        executiveCommandState.lastCommand =
          requestedAction;


        return res.status(202).json({

          success:
            true,

          accepted:
            true,

          requiresHumanApproval:
            true,

          approval,

          message:
            "تم إنشاء طلب موافقة بشرية قبل تنفيذ الإجراء."

        });

      }


      const commandRecord = {

        id:
          `cmd-${Date.now()}`,

        command:
          requestedAction,

        payload,

        status:
          "accepted",

        timestamp:
          executiveNow()

      };


      executiveCommandState.commands.unshift(
        commandRecord
      );


      executiveCommandState.lastCommand =
        requestedAction;


      executiveAddHistory(
        "command",
        requestedAction,
        "accepted",
        payload
      );


      res.json({

        success:
          true,

        accepted:
          true,

        executed:
          false,

        command:
          commandRecord,

        message:
          "تم قبول الأمر داخل مركز القيادة. التنفيذ الخارجي يتطلب تكامل الخدمة الفعلية."

      });

    } catch (error) {

      executiveCommandState.lastError =
        error.message;

      res.status(500).json({

        success:
          false,

        error:
          "COMMAND_ERROR",

        message:
          error.message

      });

    }

  }
);


/* =========================================================
   START EXECUTIVE AUTOMATION
========================================================= */

app.post(
  "/api/executive-command/start",
  (req, res) => {

    executiveCommandState
      .automation
      .enabled = true;

    executiveCommandState
      .emergencyStop = false;

    executiveAddHistory(
      "system",
      "start",
      "completed"
    );

    res.json({

      success:
        true,

      status:
        "started",

      automation:
        executiveCommandState
          .automation,

      message:
        "تم تشغيل أتمتة مركز القيادة."

    });

  }
);


/* =========================================================
   STOP EXECUTIVE AUTOMATION
========================================================= */

app.post(
  "/api/executive-command/stop",
  (req, res) => {

    executiveCommandState
      .automation
      .enabled = false;

    executiveAddHistory(
      "system",
      "stop",
      "completed"
    );

    res.json({

      success:
        true,

      status:
        "stopped",

      automation:
        executiveCommandState
          .automation,

      message:
        "تم إيقاف أتمتة مركز القيادة."

    });

  }
);


/* =========================================================
   EMERGENCY STOP
========================================================= */

app.post(
  "/api/executive-command/emergency-stop",
  (req, res) => {

    executiveCommandState
      .emergencyStop = true;

    executiveCommandState
      .automation
      .enabled = false;

    executiveAddHistory(
      "emergency",
      "emergency-stop",
      "completed"
    );

    res.json({

      success:
        true,

      emergencyStop:
        true,

      automation:
        executiveCommandState
          .automation,

      message:
        "تم تفعيل الإيقاف الطارئ للأتمتة."

    });

  }
);


/* =========================================================
   APPROVE ACTION
========================================================= */

app.post(
  "/api/executive-command/approvals/:approvalId/approve",
  (req, res) => {

    const approval =
      executiveCommandState.approvals
        .find(
          item =>
            item.id ===
            req.params.approvalId
        );


    if (!approval) {

      return res.status(404).json({

        success:
          false,

        error:
          "APPROVAL_NOT_FOUND",

        message:
          "طلب الموافقة غير موجود."

      });

    }


    if (
      approval.status !== "pending"
    ) {

      return res.status(409).json({

        success:
          false,

        error:
          "APPROVAL_ALREADY_DECIDED",

        approval

      });

    }


    approval.status =
      "approved";

    approval.decision =
      "approved";

    approval.decidedAt =
      executiveNow();


    executiveAddHistory(
      "approval",
      approval.action,
      "approved",
      {
        approvalId:
          approval.id
      }
    );


    res.json({

      success:
        true,

      approval,

      message:
        "تمت الموافقة. أصبح الإجراء مصرحًا بالتنفيذ."

    });

  }
);


/* =========================================================
   REJECT ACTION
========================================================= */

app.post(
  "/api/executive-command/approvals/:approvalId/reject",
  (req, res) => {

    const approval =
      executiveCommandState.approvals
        .find(
          item =>
            item.id ===
            req.params.approvalId
        );


    if (!approval) {

      return res.status(404).json({

        success:
          false,

        error:
          "APPROVAL_NOT_FOUND",

        message:
          "طلب الموافقة غير موجود."

      });

    }


    approval.status =
      "rejected";

    approval.decision =
      "rejected";

    approval.decidedAt =
      executiveNow();


    executiveAddHistory(
      "approval",
      approval.action,
      "rejected",
      {
        approvalId:
          approval.id
      }
    );


    res.json({

      success:
        true,

      approval,

      message:
        "تم رفض الإجراء."

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

      platform:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION,

      status:
        "online",

      message:
        "EZ MEDIA 11.0 API is running.",

      executiveCommand:
        "/api/executive-command/status",

      operations:
        "/api/operations",

      autonomousOperationsUI:
        "/autonomous-media-operations/",

      health:
        "/health",

      system:
        "/api/system"

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

      platform:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION,

      status:
        "online",

      api: {

        health:
          "/health",

        system:
          "/api/system",

        executive:
          "/api/executive-command/status",

        operations:
          "/api/operations"

      }

    });

  }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (req, res) => {

    const database =
      safeDatabaseHealth();

    const healthy =
      Boolean(
        database &&
        (
          database.ready === true ||
          !process.env.DATABASE_URL
        )
      );

    res.status(
      healthy ? 200 : 503
    ).json({

      platform:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION,

      status:
        "online",

      server:
        "online",

      database: {

        configured:
          Boolean(
            process.env.DATABASE_URL
          ),

        ready:
          Boolean(
            database &&
            database.ready
          ),

        message:
          database &&
          database.message
            ? database.message
            : null

      },

      runtime: {

        uptime:
          process.uptime(),

        node:
          process.version,

        environment:
          NODE_ENV

      },

      timestamp:
        executiveNow(),

      requestId:
        req.requestId

    });

  }
);


/* =========================================================
   SYSTEM AUTONOMOUS OPERATIONS
========================================================= */

app.get(
  "/api/system/autonomous-operations",
  (req, res) => {

    res.json({

      success:
        true,

      runtime:
        runtime.autonomousOperations,

      available:
        Boolean(
          engines.autonomousOperations
        ),

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   SYSTEM EVENT INTELLIGENCE
========================================================= */

app.get(
  "/api/system/event-intelligence",
  (req, res) => {

    res.json({

      success:
        true,

      runtime:
        runtime.eventIntelligence,

      available:
        Boolean(
          engines.eventIntelligence
        ),

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   SYSTEM DATABASE
========================================================= */

app.get(
  "/api/system/database",
  (req, res) => {

    const database =
      safeDatabaseHealth();

    res.json({

      success:
        true,

      configured:
        Boolean(
          process.env.DATABASE_URL
        ),

      database,

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   SYSTEM AI
========================================================= */

app.get(
  "/api/system/ai",
  (req, res) => {

    res.json({

      success:
        true,

      ai:
        executiveAIState(),

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   SYSTEM
========================================================= */

app.get(
  "/api/system",
  async (req, res) => {

    const database =
      safeDatabaseHealth();

    res.json({

      platform:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION,

      status:
        "online",

      node:
        process.version,

      environment:
        NODE_ENV,

      uptime:
        process.uptime(),

      database: {

        configured:
          Boolean(
            process.env.DATABASE_URL
          ),

        ready:
          Boolean(
            database &&
            database.ready
          )

      },

      runtime,

      ai:
        executiveAIState(),

      executive: {

        endpoint:
          "/api/executive-command/status",

        status:
          executiveCommandState
            .status

      },

      timestamp:
        executiveNow()

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
   يجب أن يكون آخر شيء
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({

      success:
        false,

      error:
        "NOT_FOUND",

      message:
        "المسار المطلوب غير موجود.",

      path:
        req.originalUrl,

      method:
        req.method,

      requestId:
        req.requestId,

      platform:
        "EZ MEDIA",

      version:
        PLATFORM_VERSION

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

    res.status(
      error.status ||
      500
    ).json({

      success:
        false,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        NODE_ENV === "production"
          ? "حدث خطأ داخلي في المنصة."
          : error.message,

      requestId:
        req.requestId,

      timestamp:
        executiveNow()

    });

  }
);


/* =========================================================
   START AUTONOMOUS OPERATIONS
========================================================= */

async function startAutonomousOperations() {

  if (
    !engines.autonomousOperations
  ) {

    console.log(
      "EZ MEDIA: Autonomous Operations engine unavailable."
    );

    return;

  }


  try {

    if (
      typeof engines
        .autonomousOperations
        .start === "function"
    ) {

      await engines
        .autonomousOperations
        .start();

      runtime.autonomousOperations.started =
        true;

      console.log(
        "EZ MEDIA: Autonomous Operations started."
      );

    }

  } catch (error) {

    console.error(
      "EZ MEDIA: Autonomous Operations start failed:",
      error
    );

  }

}


/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeAllDatabases() {

  try {

    if (
      typeof initializeDatabase === "function"
    ) {

      await initializeDatabase();

      runtime.database.initialized =
        true;

      console.log(
        "EZ MEDIA: Main database initialized."
      );

    }

  } catch (error) {

    runtime.database.initialized =
      false;

    console.error(
      "EZ MEDIA: Main database initialization failed:",
      error
    );

  }


  try {

    if (
      typeof initializeMediaDatabase === "function"
    ) {

      await initializeMediaDatabase();

      console.log(
        "EZ MEDIA: Media database initialized."
      );

    }

  } catch (error) {

    console.error(
      "EZ MEDIA: Media database initialization failed:",
      error
    );

  }

}


/* =========================================================
   NOTIFICATIONS INITIALIZATION
========================================================= */

async function initializeNotificationSystem() {

  try {

    if (
      typeof initializeNotifications ===
      "function"
    ) {

      await initializeNotifications();

      runtime.notifications.initialized =
        true;

      console.log(
        "EZ MEDIA: Notifications initialized."
      );

    }

  } catch (error) {

    console.error(
      "EZ MEDIA: Notification initialization failed:",
      error
    );

  }


  try {

    if (
      typeof startNotificationWorker ===
      "function"
    ) {

      await startNotificationWorker();

      runtime.notifications.workerStarted =
        true;

      console.log(
        "EZ MEDIA: Notification worker started."
      );

    }

  } catch (error) {

    console.error(
      "EZ MEDIA: Notification worker failed:",
      error
    );

  }


  try {

    if (
      typeof registerNotificationWorkerShutdown ===
      "function"
    ) {

      registerNotificationWorkerShutdown();

    }

  } catch (error) {

    console.warn(
      "EZ MEDIA: Notification shutdown registration failed:",
      error.message
    );

  }

}


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    " EZ MEDIA 11.0"
  );
  console.log(
    " Intelligent Media Platform"
  );
  console.log(
    "============================================================"
  );
  console.log(
    `Version: ${PLATFORM_VERSION}`
  );
  console.log(
    `Node: ${process.version}`
  );
  console.log(
    `Environment: ${NODE_ENV}`
  );
  console.log(
    `PORT: ${PORT}`
  );
  console.log(
    `DATABASE_URL configured: ${Boolean(
      process.env.DATABASE_URL
    )}`
  );
  console.log(
    "============================================================"
  );


  await
