"use strict";

/*
============================================================
 EZ MEDIA 11.0
 INTELLIGENT MEDIA PLATFORM
 EXECUTIVE COMMAND CENTER
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
   ADVANCED ENGINES
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
  process.env.EZ_MEDIA_BUILD ||
  "EZ-MEDIA-CONTENT-OS-2026-10-04";

/* =========================================================
   RUNTIME STATE
========================================================= */

const runtime = {
  startedAt:
    new Date().toISOString(),

  database: {
    initialized: false,
    configured:
      Boolean(process.env.DATABASE_URL),
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

  req.requestId = requestId;

  res.setHeader(
    "X-EZ-MEDIA-Request-ID",
    requestId
  );

  next();
});

/* =========================================================
   REQUEST LOG
========================================================= */

app.use((req, res, next) => {
  const started =
    Date.now();

  res.on("finish", () => {
    const duration =
      Date.now() - started;

    console.log(
      JSON.stringify({
        platform: "EZ MEDIA",
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        requestId: req.requestId,
        timestamp:
          new Date().toISOString()
      })
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
   HELPERS
========================================================= */

function objectOrEmpty(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  return {};
}

function numberOrNull(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

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

/* =========================================================
   NESTED VALUE READER
========================================================= */

function getByPath(
  source,
  pathExpression
) {
  if (
    source === undefined ||
    source === null
  ) {
    return undefined;
  }

  const parts =
    String(pathExpression)
      .split(".");

  let current =
    source;

  for (
    const part of parts
  ) {
    if (
      current === undefined ||
      current === null
    ) {
      return undefined;
    }

    current =
      current[part];
  }

  return current;
}

/* =========================================================
   COUNT READER
========================================================= */

function extractCount(
  source,
  keys
) {
  const data =
    objectOrEmpty(source);

  for (
    const key of keys
  ) {

    const value =
      getByPath(
        data,
        key
      );

    if (
      Array.isArray(value)
    ) {
      return value.length;
    }

    const number =
      numberOrNull(value);

    if (
      number !== null
    ) {
      return number;
    }
  }

  return null;
}

/* =========================================================
   STATUS READER
========================================================= */

function extractStatus(
  source
) {
  const data =
    objectOrEmpty(source);

  return firstDefined(
    getByPath(data, "status"),
    getByPath(data, "state"),
    getByPath(data, "mode"),
    getByPath(data, "health"),
    getByPath(data, "system.status"),
    getByPath(data, "system.state")
  );
}

/* =========================================================
   BOOLEAN READER
========================================================= */

function extractBoolean(
  source,
  keys
) {
  const data =
    objectOrEmpty(source);

  for (
    const key of keys
  ) {
    const value =
      getByPath(
        data,
        key
      );

    if (
      typeof value ===
      "boolean"
    ) {
      return value;
    }

    if (
      value === "true"
    ) {
      return true;
    }

    if (
      value === "false"
    ) {
      return false;
    }
  }

  return null;
}

/* =========================================================
   SAFE ENGINE READ
========================================================= */

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
      data: {},
      method: null,
      error: null
    };
  }

  let lastError =
    null;

  for (
    const method of methods
  ) {

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

          error:
            null
        };
      }

    } catch (error) {

      lastError =
        error;
    }
  }

  return {
    available: true,

    data: {},

    method: null,

    error:
      lastError
        ? lastError.message
        : null
  };
}

/* =========================================================
   ENGINE INITIALIZATION
========================================================= */

async function initializeAdvancedEngines() {

  /* -------------------------------------------------------
     AUTONOMOUS OPERATIONS
  ------------------------------------------------------- */

  try {

    if (
      autonomousOperationsEngineModule
    ) {

      const Engine =
        autonomousOperationsEngineModule
          .AutonomousMediaOperationsCenterEngine ||
        autonomousOperationsEngineModule
          .default ||
        autonomousOperationsEngineModule;

      if (
        typeof Engine ===
        "function"
      ) {

        engines.autonomousOperations =
          new Engine();

        runtime.autonomousOperations
          .available = true;

        runtime.autonomousOperations
          .initialized = true;

        console.log(
          "[EZ MEDIA] Autonomous Operations Engine: READY"
        );
      }
    }

  } catch (error) {

    runtime.autonomousOperations
      .lastError =
      error.message;

    console.error(
      "[EZ MEDIA] Autonomous Operations:",
      error.message
    );
  }

  /* -------------------------------------------------------
     AI COLLABORATION
  ------------------------------------------------------- */

  try {

    if (
      collaborationEngineModule
    ) {

      const Engine =
        collaborationEngineModule
          .IntelligentAIAgentCollaborationEngine ||
        collaborationEngineModule
          .default ||
        collaborationEngineModule;

      if (
        typeof Engine ===
        "function"
      ) {

        engines.collaboration =
          new Engine();

        runtime.ai.collaboration =
          true;

        console.log(
          "[EZ MEDIA] AI Collaboration Engine: READY"
        );
      }
    }

  } catch (error) {

    console.error(
      "[EZ MEDIA] AI Collaboration:",
      error.message
    );
  }

  /* -------------------------------------------------------
     AUTONOMOUS AI AGENTS
  ------------------------------------------------------- */

  try {

    if (
      autonomousAgentEngineModule
    ) {

      const Engine =
        autonomousAgentEngineModule
          .IntelligentAIAgentAutonomousEngine ||
        autonomousAgentEngineModule
          .default ||
        autonomousAgentEngineModule;

      if (
        typeof Engine ===
        "function"
      ) {

        engines.autonomousAgents =
          new Engine();

        runtime.ai.autonomousAgents =
          true;

        console.log(
          "[EZ MEDIA] Autonomous AI Agents: READY"
        );
      }
    }

  } catch (error) {

    console.error(
      "[EZ MEDIA] Autonomous Agents:",
      error.message
    );
  }

  /* -------------------------------------------------------
     MEDIA MEMORY
  ------------------------------------------------------- */

  try {

    if (
      mediaMemoryEngineModule
    ) {

      const Engine =
        mediaMemoryEngineModule
          .IntelligentMediaMemoryEngine ||
        mediaMemoryEngineModule
          .default ||
        mediaMemoryEngineModule;

      if (
        typeof Engine ===
        "function"
      ) {

        engines.memory =
          new Engine();

        runtime.ai.memory =
          true;

        console.log(
          "[EZ MEDIA] Media Memory: READY"
        );
      }
    }

  } catch (error) {

    console.error(
      "[EZ MEDIA] Media Memory:",
      error.message
    );
  }

  /* -------------------------------------------------------
     EVENT INTELLIGENCE
  ------------------------------------------------------- */

  try {

    if (
      eventIntelligenceEngineModule
    ) {

      const Engine =
        eventIntelligenceEngineModule
          .IntelligentMediaEventIntelligenceEngine ||
        eventIntelligenceEngineModule
          .default ||
        eventIntelligenceEngineModule;

      if (
        typeof Engine ===
        "function"
      ) {

        engines.eventIntelligence =
          new Engine();

        runtime.eventIntelligence
          .available = true;

        runtime.eventIntelligence
          .initialized = true;

        runtime.ai.eventIntelligence =
          true;

        console.log(
          "[EZ MEDIA] Event Intelligence: READY"
        );
      }
    }

  } catch (error) {

    runtime.eventIntelligence
      .lastError =
      error.message;

    console.error(
      "[EZ MEDIA] Event Intelligence:",
      error.message
    );
  }
}

/* =========================================================
   AUTONOMOUS OPERATIONS ROUTER
========================================================= */

function mountAutonomousOperationsRoutes() {

  if (
    !autonomousOperationsRoutesModule
  ) {

    console.warn(
      "[EZ MEDIA] Autonomous Operations Router unavailable"
    );

    return;
  }

  try {

    const factory =
      autonomousOperationsRoutesModule
        .createAutonomousMediaOperationsRouter ||
      autonomousOperationsRoutesModule
        .default;

    if (
      typeof factory !==
        "function" ||
      !engines.autonomousOperations
    ) {

      console.warn(
        "[EZ MEDIA] Autonomous Operations Router cannot mount"
      );

      return;
    }

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

      runtime.autonomousOperations
        .routeMounted = true;

      console.log(
        "[EZ MEDIA] /api/operations mounted"
      );
    }

  } catch (error) {

    runtime.autonomousOperations
      .lastError =
      error.message;

    console.error(
      "[EZ MEDIA] Operations Router:",
      error.message
    );
  }
}

/* =========================================================
   EVENT INTELLIGENCE ROUTER
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
      eventIntelligenceRoutesModule
        .createEventIntelligenceRouter ||
      eventIntelligenceRoutesModule
        .default;

    if (
      typeof factory !==
      "function"
    ) {
      return;
    }

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

      runtime.eventIntelligence
        .routeMounted = true;

      console.log(
        "[EZ MEDIA] Event Intelligence Router mounted"
      );
    }

  } catch (error) {

    runtime.eventIntelligence
      .lastError =
      error.message;

    console.error(
      "[EZ MEDIA] Event Intelligence Router:",
      error.message
    );
  }
}

/* =========================================================
   EXECUTIVE COMMAND CENTER
   CODE 122
========================================================= */

const executiveCommand = {

  async refresh() {

    const timestamp =
      new Date().toISOString();

    runtime.executiveCommand
      .lastRefresh =
      timestamp;

    try {

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

      /* ---------------------------------------------------
         DATABASE
      --------------------------------------------------- */

      let database =
        runtime.database.health;

      try {

        if (
          typeof databaseHealth ===
          "function"
        ) {

          database =
            await databaseHealth();

          runtime.database.health =
            database;

          const data =
            objectOrEmpty(
              database
            );

          runtime.database.ready =
            data.ready === true ||
            data.connected === true ||
            data.ok === true ||
            data.status ===
              "healthy";
        }

      } catch (error) {

        runtime.database.ready =
          false;

        runtime.database.error =
          error.message;
      }

      /* ---------------------------------------------------
         NORMALIZED ENGINE DATA
      --------------------------------------------------- */

      const operations =
        objectOrEmpty(
          operationsSnapshot.data
        );

      const collaboration =
        objectOrEmpty(
          collaborationSnapshot.data
        );

      const agents =
        objectOrEmpty(
          agentsSnapshot.data
        );

      const memory =
        objectOrEmpty(
          memorySnapshot.data
        );

      const events =
        objectOrEmpty(
          eventSnapshot.data
        );

      /* ---------------------------------------------------
         OPERATION COUNTERS
      --------------------------------------------------- */

      const active =
        extractCount(
          operations,
          [
            "active",
            "running",
            "activeOperations",
            "runningOperations",
            "activeCount",
            "counts.active",
            "statistics.active",
            "statistics.running",
            "metrics.active"
          ]
        );

      const pending =
        extractCount(
          operations,
          [
            "pending",
            "pendingOperations",
            "pendingCount",
            "queued",
            "queuedOperations",
            "counts.pending",
            "statistics.pending",
            "metrics.pending"
          ]
        );

      const completed =
        extractCount(
          operations,
          [
            "completed",
            "completedOperations",
            "completedCount",
            "counts.completed",
            "statistics.completed",
            "metrics.completed"
          ]
        );

      const failed =
        extractCount(
          operations,
          [
            "failed",
            "failedOperations",
            "failedCount",
            "counts.failed",
            "statistics.failed",
            "metrics.failed"
          ]
        );

      /* ---------------------------------------------------
         AI COUNTERS
      --------------------------------------------------- */

      const agentsCount =
        extractCount(
          agents,
          [
            "agents",
            "agentCount",
            "totalAgents",
            "activeAgents",
            "counts.agents",
            "statistics.agents",
            "statistics.totalAgents",
            "metrics.agents"
          ]
        );

      const missions =
        extractCount(
          collaboration,
          [
            "missions",
            "missionCount",
            "activeMissions",
            "totalMissions",
            "counts.missions",
            "statistics.missions",
            "metrics.missions"
          ]
        );

      const teams =
        extractCount(
          collaboration,
          [
            "teams",
            "teamCount",
            "activeTeams",
            "totalTeams",
            "counts.teams",
            "statistics.teams",
            "metrics.teams"
          ]
        );

      /* ---------------------------------------------------
         APPROVALS
      --------------------------------------------------- */

      const approvals =
        extractCount(
          operations,
          [
            "pendingApprovals",
            "approvalCount",
            "approvalsPending",
            "approvals.pending",
            "counts.pendingApprovals",
            "statistics.pendingApprovals"
          ]
        );

      /* ---------------------------------------------------
         MEMORY
      --------------------------------------------------- */

      const memoryCount =
        extractCount(
          memory,
          [
            "memories",
            "memoryCount",
            "totalMemories",
            "records",
            "count",
            "total",
            "counts.memories",
            "statistics.memories",
            "statistics.total",
            "metrics.memories"
          ]
        );

      /* ---------------------------------------------------
         EVENTS
      --------------------------------------------------- */

      const eventCount =
        extractCount(
          events,
          [
            "events",
            "eventCount",
            "totalEvents",
            "activeEvents",
            "count",
            "total",
            "counts.events",
            "statistics.events",
            "statistics.total",
            "metrics.events"
          ]
        );

      /* ---------------------------------------------------
         HUMAN APPROVAL
      --------------------------------------------------- */

      const humanApproval =
        process.env
          .MEDIA_OPS_REQUIRE_HUMAN_APPROVAL !==
        "false";

      /* ---------------------------------------------------
         BROADCAST
      --------------------------------------------------- */

      const socialBroadcast =
        process.env
          .SOCIAL_BROADCAST_ENABLED ===
        "true";

      const satelliteBroadcast =
        process.env
          .SATELLITE_BROADCAST_ENABLED ===
        "true";

      const externalBroadcast =
        process.env
          .BROADCAST_EXTERNAL_INTEGRATION ===
        "true";

      const broadcasting = {

        website:
          true,

        social:
          socialBroadcast,

        satellite:
          satelliteBroadcast,

        externalIntegration:
          externalBroadcast,

        status:
          externalBroadcast
            ? "configured"
            : socialBroadcast ||
              satelliteBroadcast
            ? "partially_configured"
            : "not_connected"
      };

      /* ---------------------------------------------------
         REAL SYSTEM MATRIX
      --------------------------------------------------- */

      const systems = {

        server: {

          available:
            true,

          status:
            "online"
        },

        database: {

          configured:
            runtime.database.configured,

          initialized:
            runtime.database.initialized,

          ready:
            runtime.database.ready,

          status:
            runtime.database.ready
              ? "ready"
              : runtime.database.configured
              ? "not_ready"
              : "not_configured"
        },

        autonomousOperations: {

          available:
            runtime.autonomousOperations
              .available,

          initialized:
            runtime.autonomousOperations
              .initialized,

          routeMounted:
            runtime.autonomousOperations
              .routeMounted,

          started:
            runtime.autonomousOperations
              .started,

          status:
            extractStatus(
              operations
            )
        },

        collaboration: {

          available:
            runtime.ai.collaboration,

          teams,

          missions
        },

        autonomousAgents: {

          available:
            runtime.ai.autonomousAgents,

          count:
            agentsCount
        },

        memory: {

          available:
            runtime.ai.memory,

          records:
            memoryCount
        },

        eventIntelligence: {

          available:
            runtime.ai.eventIntelligence,

          events:
            eventCount
        }
      };

      /* ---------------------------------------------------
         EXECUTIVE STATUS
      --------------------------------------------------- */

      const automationStatus =
        runtime.autonomousOperations
          .started
          ? "active"
          : runtime.autonomousOperations
              .initialized
          ? "ready"
          : "unavailable";

      /*
       * لا نضع "ready" للجدولة أو Workflow
       * إذا لم يوجد محرك فعلي لها.
       */

      const schedulingStatus =
        "not_connected";

      const workflowStatus =
        runtime.autonomousOperations
          .available
          ? "available"
          : "not_connected";

      /* ---------------------------------------------------
         SNAPSHOT
      --------------------------------------------------- */

      const snapshot = {

        platform:
          "EZ MEDIA",

        version:
          VERSION,

        build:
          BUILD,

        status:
          "online",

        timestamp,

        executive: {

          automation:
            automationStatus,

          broadcasting:
            broadcasting.status,

          scheduling:
            schedulingStatus,

          workflow:
            workflowStatus
        },

        ai: {

          enabled:
            true,

          collaboration:
            runtime.ai.collaboration,

          autonomousAgents:
            runtime.ai.autonomousAgents,

          memory:
            runtime.ai.memory,

          eventIntelligence:
            runtime.ai.eventIntelligence,

          agents:
            agentsCount,

          missions,

          teams
        },

        operations: {

          available:
            runtime.autonomousOperations
              .available,

          initialized:
            runtime.autonomousOperations
              .initialized,

          routeMounted:
            runtime.autonomousOperations
              .routeMounted,

          started:
            runtime.autonomousOperations
              .started,

          active,

          pending,

          completed,

          failed,

          engineStatus:
            extractStatus(
              operations
            )
        },

        approvals: {

          required:
            humanApproval,

          pending:
            approvals,

          mode:
            humanApproval
              ? "human_required"
              : "automatic"
        },

        broadcasting,

        business: {

          status:
            "not_connected",

          audience:
            null,

          advertising:
            null,

          revenue:
            null,

          crm:
            null
        },

        systems,

        memory: {

          available:
            runtime.ai.memory,

          records:
            memoryCount
        },

        eventIntelligence: {

          available:
            runtime.ai.eventIntelligence,

          events:
            eventCount
        },

        database: {

          configured:
            runtime.database.configured,

          initialized:
            runtime.database.initialized,

          ready:
            runtime.database.ready,

          health:
            database
        },

        safety: {

          humanApproval,

          emergencyStop:
            false
        },

        diagnostics: {

          operationsReader:
            operationsSnapshot.method,

          collaborationReader:
            collaborationSnapshot.method,

          agentsReader:
            agentsSnapshot.method,

          memoryReader:
            memorySnapshot.method,

          eventReader:
            eventSnapshot.method,

          errors: {

            operations:
              operationsSnapshot.error,

            collaboration:
              collaborationSnapshot.error,

            agents:
              agentsSnapshot.error,

            memory:
              memorySnapshot.error,

            event:
              eventSnapshot.error
          }
        }
      };

      runtime.executiveCommand.status =
        "online";

      runtime.executiveCommand.lastError =
        null;

      return snapshot;

    } catch (error) {

      runtime.executiveCommand.status =
        "degraded";

      runtime.executiveCommand.lastError =
        error.message;

      return {

        platform:
          "EZ MEDIA",

        version:
          VERSION,

        build:
          BUILD,

        status:
          "degraded",

        timestamp,

        error:
          error.message,

        database:
          runtime.database,

        ai:
          runtime.ai,

        operations:
          runtime.autonomousOperations
      };
    }
  }
};

/* =========================================================
   EXECUTIVE API
========================================================= */

app.get(
  "/api/executive-command/status",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json(
      snapshot
    );
  }
);

app.get(
  "/api/executive-command/health",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({

      platform:
        "EZ MEDIA",

      service:
        "Executive Command Center",

      status:
        snapshot.status,

      timestamp:
        new Date().toISOString(),

      database:
        snapshot.database,

      ai:
        snapshot.ai,

      operations:
        snapshot.operations
    });
  }
);

app.get(
  "/api/executive-command/dashboard",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({
      dashboard:
        snapshot
    });
  }
);

app.get(
  "/api/executive-command/systems",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({
      systems:
        snapshot.systems
    });
  }
);

app.get(
  "/api/executive-command/ai",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({
      ai:
        snapshot.ai
    });
  }
);

app.get(
  "/api/executive-command/operations",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({
      operations:
        snapshot.operations
    });
  }
);

app.get(
  "/api/executive-command/approvals",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({
      approvals:
        snapshot.approvals
    });
  }
);

app.get(
  "/api/executive-command/business",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({
      business:
        snapshot.business
    });
  }
);

app.get(
  "/api/executive-command/matrix",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({

      matrix: {

        systems:
          snapshot.systems,

        ai:
          snapshot.ai,

        operations:
          snapshot.operations,

        approvals:
          snapshot.approvals,

        broadcasting:
          snapshot.broadcasting,

        business:
          snapshot.business,

        database:
          snapshot.database
      }
    });
  }
);

app.post(
  "/api/executive-command/refresh",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({

      success:
        true,

      data:
        snapshot
    });
  }
);

app.post(
  "/api/executive-command/analysis",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    const recommendations =
      [];

    if (
      !snapshot.database.ready
    ) {

      recommendations.push(
        "قاعدة البيانات غير جاهزة حاليًا."
      );
    }

    if (
      !snapshot.operations.available
    ) {

      recommendations.push(
        "محرك العمليات المستقلة غير متاح."
      );
    }

    if (
      snapshot.operations.available &&
      !snapshot.operations.started
    ) {

      recommendations.push(
        "محرك العمليات متاح لكنه غير مشغّل."
      );
    }

    if (
      snapshot.broadcasting.status ===
      "not_connected"
    ) {

      recommendations.push(
        "لا يوجد تكامل بث خارجي فعلي متصل حاليًا."
      );
    }

    if (
      snapshot.executive.scheduling ===
      "not_connected"
    ) {

      recommendations.push(
        "محرك الجدولة التنفيذي غير متصل حاليًا."
      );
    }

    if (
      recommendations.length ===
      0
    ) {

      recommendations.push(
        "لا توجد ملاحظات حرجة في الحالة الحالية."
      );
    }

    res.json({

      success:
        true,

      mode:
        "local-runtime-analysis",

      timestamp:
        new Date().toISOString(),

      recommendations,

      snapshot
    });
  }
);

/* =========================================================
   OPERATIONS FALLBACK
   IMPORTANT ROUTE-ORDER FIX
========================================================= */

app.get(
  "/api/operations/health",
  (req, res, next) => {

    /*
     * إذا كان الراوتر الحقيقي مركبًا،
     * نمرر الطلب إليه بدل fallback.
     */

    if (
      runtime.autonomousOperations
        .routeMounted
    ) {

      return next();
    }

    return res.json({

      platform:
        "EZ MEDIA",

      service:
        "Autonomous Media Operations",

      status:
        runtime.autonomousOperations
          .available
          ? "ready"
          : "unavailable",

      available:
        runtime.autonomousOperations
          .available,

      initialized:
        runtime.autonomousOperations
          .initialized,

      routeMounted:
        runtime.autonomousOperations
          .routeMounted,

      started:
        runtime.autonomousOperations
          .started,

      timestamp:
        new Date().toISOString(),

      error:
        runtime.autonomousOperations
          .lastError
    });
  }
);

app.get(
  "/api/operations/status",
  (req, res, next) => {

    /*
     * إذا كان الراوتر الحقيقي مركبًا،
     * نمرر الطلب إليه بدل fallback.
     */

    if (
      runtime.autonomousOperations
        .routeMounted
    ) {

      return next();
    }

    return res.json({

      platform:
        "EZ MEDIA",

      service:
        "Autonomous Media Operations",

      status:
        runtime.autonomousOperations
          .started
          ? "running"
          : runtime.autonomousOperations
              .available
          ? "ready"
          : "unavailable",

      available:
        runtime.autonomousOperations
          .available,

      initialized:
        runtime.autonomousOperations
          .initialized,

      routeMounted:
        runtime.autonomousOperations
          .routeMounted,

      started:
        runtime.autonomousOperations
          .started,

      timestamp:
        new Date().toISOString()
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
        VERSION,

      build:
        BUILD,

      status:
        "online",

      message:
        "EZ MEDIA 11.0 يعمل",

      endpoints: {

        health:
          "/health",

        status:
          "/api/status",

        executiveCommand:
          "/api/executive-command/status",

        executiveDashboard:
          "/api/executive-command/dashboard",

        operations:
          "/api/operations/status",

        operationsUI:
          "/autonomous-media-operations/"
      },

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   GLOBAL HEALTH
========================================================= */

app.get(
  "/health",
  async (req, res) => {

    let health = {

      configured:
        Boolean(process.env.DATABASE_URL),

      initialized:
        runtime.database.initialized,

      ready:
        runtime.database.ready
    };

    try {

      if (
        typeof databaseHealth ===
        "function"
      ) {

        const result =
          await databaseHealth();

        if (
          result &&
          typeof result ===
          "object"
        ) {

          health = {
            ...health,
            ...result
          };
        }
      }

    } catch (error) {

      health.ready =
        false;

      health.error =
        error.message;
    }

    res.json({

      platform:
        "EZ MEDIA",

      version:
        VERSION,

      build:
        BUILD,

      status:
        "online",

      server: {

        online:
          true,

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "production",

        uptime:
          process.uptime()
      },

      database:
        health,

      ai:
        runtime.ai,

      autonomousOperations:
        runtime.autonomousOperations,

      eventIntelligence:
        runtime.eventIntelligence,

      executiveCommand:
        runtime.executiveCommand,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   API STATUS
========================================================= */

app.get(
  "/api/status",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({

      platform:
        "EZ MEDIA",

      version:
        VERSION,

      build:
        BUILD,

      status:
        "online",

      server: {

        node:
          process.version,

        uptime:
          process.uptime(),

        environment:
          process.env.NODE_ENV ||
          "production"
      },

      database:
        snapshot.database,

      ai:
        snapshot.ai,

      operations:
        snapshot.operations,

      eventIntelligence:
        snapshot.eventIntelligence
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
        VERSION,

      status:
        "online",

      endpoints: {

        health:
          "/health",

        status:
          "/api/status",

        executive:
          "/api/executive-command/status",

        dashboard:
          "/api/executive-command/dashboard",

        operations:
          "/api/operations/status",

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
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({

      platform:
        "EZ MEDIA",

      version:
        VERSION,

      status:
        snapshot.status,

      server:
        true,

      database:
        snapshot.database.ready,

      ai:
        snapshot.ai,

      operations:
        snapshot.operations,

      eventIntelligence:
        snapshot.eventIntelligence,

      timestamp:
        new Date().toISOString()
    });
  }
);

app.get(
  "/api/system/database",
  async (req, res) => {

    let result = {

      configured:
        Boolean(process.env.DATABASE_URL),

      initialized:
        runtime.database.initialized,

      ready:
        runtime.database.ready
    };

    try {

      if (
        typeof databaseHealth ===
        "function"
      ) {

        const health =
          await databaseHealth();

        if (health) {

          result = {
            ...result,
            ...health
          };
        }
      }

    } catch (error) {

      result.error =
        error.message;

      result.ready =
        false;
    }

    res.json(
      result
    );
  }
);

app.get(
  "/api/system/ai",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json(
      snapshot.ai
    );
  }
);

app.get(
  "/api/system/autonomous-operations",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json(
      snapshot.operations
    );
  }
);

app.get(
  "/api/system/event-intelligence",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json(
      snapshot.eventIntelligence
    );
  }
);

/* =========================================================
   AI AGENTS
========================================================= */

app.get(
  "/api/ai/agents",
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({

      platform:
        "EZ MEDIA",

      status:
        snapshot.ai.autonomousAgents
          ? "ready"
          : "unavailable",

      available:
        snapshot.ai.autonomousAgents,

      count:
        snapshot.ai.agents,

      collaboration:
        snapshot.ai.collaboration,

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

    const social =
      process.env
        .SOCIAL_BROADCAST_ENABLED ===
      "true";

    const satellite =
      process.env
        .SATELLITE_BROADCAST_ENABLED ===
      "true";

    res.json({

      system:
        "EZ LIVE",

      status:
        "ready",

      live:
        false,

      integrations: {

        website:
          true,

        social,

        satellite,

        external:
          process.env
            .BROADCAST_EXTERNAL_INTEGRATION ===
          "true"
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
  async (req, res) => {

    const snapshot =
      await executiveCommand.refresh();

    res.json({

      system:
        "EZ AUTOMATION",

      status:
        snapshot.executive.automation,

      architecture:
        "event-driven",

      humanApproval:
        snapshot.approvals.required,

      operations:
        snapshot.operations
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
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({

      platform:
        "EZ MEDIA",

      status:
        "not_found",

      path:
        req.originalUrl,

      method:
        req.method,

      message:
        "المسار المطلوب غير موجود.",

      requestId:
        req.requestId || null
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
      "[EZ MEDIA] ERROR:",
      error
    );

    if (
      res.headersSent
    ) {

      return next(error);
    }

    res.status(
      error.status || 500
    );

    res.json({

      platform:
        "EZ MEDIA",

      status:
        "error",

      message:
        error.message ||
        "حدث خطأ داخلي.",

      requestId:
        req.requestId || null,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   INITIALIZE ALL SYSTEMS
========================================================= */

async function initializeAllSystems() {

  console.log(
    "[EZ MEDIA] Initializing EZ MEDIA 11.0..."
  );

  /* -------------------------------------------------------
     DATABASE
  ------------------------------------------------------- */

  try {

    if (
      typeof initializeDatabase ===
      "function"
    ) {

      await initializeDatabase();

      runtime.database.initialized =
        true;

      console.log(
        "[EZ MEDIA] Database initialized"
      );
    }

  } catch (error) {

    runtime.database.error =
      error.message;

    runtime.database.ready =
      false;

    console.error(
      "[EZ MEDIA] Database:",
      error.message
    );
  }

  /* -------------------------------------------------------
     MEDIA DATABASE
  ------------------------------------------------------- */

  try {

    if (
      typeof initializeMediaDatabase ===
      "function"
    ) {

      await initializeMediaDatabase();

      console.log(
        "[EZ MEDIA] Media database initialized"
      );
    }

  } catch (error) {

    console.error(
      "[EZ MEDIA] Media database:",
      error.message
    );
  }

  /* -------------------------------------------------------
     NOTIFICATIONS
  ------------------------------------------------------- */

  try {

    if (
      typeof initializeNotifications ===
      "function"
    ) {

      await initializeNotifications();

      runtime.notifications.initialized =
        true;

      console.log(
        "[EZ MEDIA] Notifications initialized"
      );
    }

  } catch (error) {

    runtime.notifications.error =
      error.message;

    console.error(
      "[EZ MEDIA] Notifications:",
      error.message
    );
  }

  /* -------------------------------------------------------
     DATABASE HEALTH
  ------------------------------------------------------- */

  try {

    if (
      typeof databaseHealth ===
      "function"
    ) {

      const health =
        await databaseHealth();

      runtime.database.health =
        health;

      const data =
        objectOrEmpty(
          health
        );

      runtime.database.ready =
        data.ready === true ||
        data.connected === true ||
        data.ok === true ||
        data.status ===
          "healthy";
    }

  } catch (error) {

    runtime.database.ready =
      false;

    runtime.database.error =
      error.message;
  }

  /* -------------------------------------------------------
     ADVANCED ENGINES
  ------------------------------------------------------- */

  await initializeAdvancedEngines();

  /* -------------------------------------------------------
     REAL ROUTES
  ------------------------------------------------------- */

  mountAutonomousOperationsRoutes();

  mountEventIntelligenceRoutes();

  console.log(
    "[EZ MEDIA] Advanced routes mounted"
  );
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

      runtime.autonomousOperations
        .started = true;

      console.log(
        "[EZ MEDIA] Autonomous Operations started"
      );
    }

  } catch (error) {

    runtime.autonomousOperations
      .lastError =
      error.message;

    runtime.autonomousOperations
      .started = false;

    console.error(
      "[EZ MEDIA] Autonomous Operations start:",
      error.message
    );
  }
}

/* =========================================================
   START NOTIFICATION WORKER
========================================================= */

async function startNotificationsWorkerSafe() {

  try {

    if (
      typeof startNotificationWorker ===
      "function"
    ) {

      await startNotificationWorker();

      runtime.notifications
        .workerStarted = true;

      console.log(
        "[EZ MEDIA] Notification Worker started"
      );
    }

  } catch (error) {

    runtime.notifications.error =
      error.message;

    console.error(
      "[EZ MEDIA] Notification Worker:",
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

  /*
   * تحديث Executive Command Center
   * بعد اكتمال تهيئة وتشغيل المحركات.
   */

  try {

    await executiveCommand.refresh();

  } catch (error) {

    runtime.executiveCommand
      .lastError =
      error.message;
  }

  server =
    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          "============================================================"
        );

        console.log(
          "EZ MEDIA 11.0"
        );

        console.log(
          `VERSION: ${VERSION}`
        );

        console.log(
          `BUILD: ${BUILD}`
        );

        console.log(
          `NODE: ${process.version}`
        );

        console.log(
          `PORT: ${PORT}`
        );

        console.log(
          "STATUS: ONLINE"
        );

        console.log(
          `DATABASE: ${
            runtime.database.ready
              ? "READY"
              : "NOT READY"
          }`
        );

        console.log(
          `AUTONOMOUS OPERATIONS: ${
            runtime.autonomousOperations
              .available
              ? "AVAILABLE"
              : "UNAVAILABLE"
          }`
        );

        console.log(
          `OPERATIONS ROUTE: ${
            runtime.autonomousOperations
              .routeMounted
              ? "MOUNTED"
              : "NOT MOUNTED"
          }`
        );

        console.log(
          `AI COLLABORATION: ${
            runtime.ai.collaboration
              ? "READY"
              : "UNAVAILABLE"
          }`
        );

        console.log(
          `AI AGENTS: ${
            runtime.ai.autonomousAgents
              ? "READY"
              : "UNAVAILABLE"
          }`
        );

        console.log(
          `MEMORY: ${
            runtime.ai.memory
              ? "READY"
              : "UNAVAILABLE"
          }`
        );

        console.log(
          `EVENT INTELLIGENCE: ${
            runtime.ai.eventIntelligence
              ? "READY"
              : "UNAVAILABLE"
          }`
        );

        console.log(
          "EXECUTIVE COMMAND: /api/executive-command/status"
        );

        console.log(
          "OPERATIONS: /api/operations/status"
        );

        console.log(
          "OPERATIONS UI: /autonomous-media-operations/"
        );

        console.log(
          "============================================================"
        );
      }
    );

  return server;
}

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

    if (
      engines.autonomousOperations &&
      typeof engines.autonomousOperations
        .stop ===
      "function"
    ) {

      await engines.autonomousOperations
        .stop();

      runtime.autonomousOperations
        .started = false;
    }

  } catch (error) {

    console.error(
      "[EZ MEDIA] Operations shutdown:",
      error.message
    );
  }

  try {

    if (
      typeof registerNotificationWorkerShutdown ===
      "function"
    ) {

      await registerNotificationWorkerShutdown();
    }

  } catch (error) {

    console.error(
      "[EZ MEDIA] Notification shutdown:",
      error.message
    );
  }

  if (server) {

    server.close(
      () => {

        console.log(
          "[EZ MEDIA] Server closed"
        );

        process.exit(0);
      }
    );

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
   PROCESS ERRORS
========================================================= */

process.on(
  "unhandledRejection",
  (reason) => {

    console.error(
      "[EZ MEDIA] unhandledRejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {

    console.error(
      "[EZ MEDIA] uncaughtException:",
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

  engines,

  executiveCommand
};

/* =========================================================
   START
========================================================= */

if (
  require.main ===
  module
) {

  startServer()
    .catch(
      (error) => {

        console.error(
          "[EZ MEDIA] STARTUP ERROR:",
          error
        );

        process.exit(1);
      }
    );
}
