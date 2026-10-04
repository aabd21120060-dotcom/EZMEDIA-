"use strict";

/**
 * EZ MEDIA 11.0
 * Main Server
 *
 * الكود رقم 46
 *
 * الخادم المركزي للمنصة.
 *
 * تمت إضافة:
 * - Notification Database Bootstrap
 * - Notification API
 * - Notification Worker API
 * - Notification Worker
 *
 * مع الحفاظ على الوحدات السابقة.
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

/* ================================
   Routes
================================ */

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

/* ================================
   App
================================ */

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const HOST =
  process.env.HOST || "0.0.0.0";

/* ================================
   Security
================================ */

app.disable("x-powered-by");

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

/* ================================
   Performance
================================ */

app.use(
  compression()
);

/* ================================
   Body Parser
================================ */

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

/* ================================
   Request ID
================================ */

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

/* ================================
   Static Files
================================ */

const publicDirectory =
  path.join(
    __dirname,
    "public"
  );

app.use(
  express.static(
    publicDirectory,
    {
      maxAge:
        process.env.NODE_ENV ===
        "production"
          ? "1h"
          : 0
    }
  )
);

/* ================================
   API Routes
================================ */

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

/* ================================
   Notification API
================================ */

app.use(
  "/api/notifications",
  notificationsRoutes
);

/* ================================
   Notification Worker API
================================ */

app.use(
  "/api/notification-worker",
  notificationWorkerRoutes
);

/* ================================
   Platform Info
================================ */

app.get(
  "/",
  (req, res) => {
    res.json({
      platform:
        "EZ MEDIA",

      version:
        "11.0.0",

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
        notificationWorker: true
      },

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* ================================
   Admin
================================ */

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

/* ================================
   API Overview
================================ */

app.get(
  "/api",
  (req, res) => {
    res.json({
      platform:
        "EZ MEDIA",

      version:
        "11.0.0",

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
          "/api/notification-worker"
      },

      timestamp:
        new Date().toISOString()
    });
  }
);

/* ================================
   Health
================================ */

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

      res.json({
        platform:
          "EZ MEDIA",

        version:
          "11.0.0",

        status:
          "online",

        server:
          "online",

        database: {
          ...database,
          status:
            databaseStatus
        },

        notifications: {
          api: true,
          worker: true
        },

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime:
          process.uptime(),

        timestamp:
          new Date().toISOString(),

        requestId:
          req.requestId
      });
    } catch (error) {
      console.error(
        "Health check error:",
        error
      );

      res.status(503).json({
        platform:
          "EZ MEDIA",

        version:
          "11.0.0",

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

        notifications: {
          api: true,
          worker: true
        },

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime:
          process.uptime(),

        timestamp:
          new Date().toISOString(),

        requestId:
          req.requestId
      });
    }
  }
);

/* ================================
   System Database
================================ */

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

/* ================================
   System Info
================================ */

app.get(
  "/api/system",
  async (req, res) => {
    let database = null;

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
        "EZ MEDIA",

      version:
        "11.0.0",

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

      services: {
        cms: true,
        ai: true,
        media: true,
        live: true,
        breaking: true,
        commercial: true,
        notifications: true,
        notificationWorker: true
      },

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

/* ================================
   Favicon
================================ */

app.get(
  "/favicon.ico",
  (req, res) => {
    res.status(204).end();
  }
);

/* ================================
   404
================================ */

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

/* ================================
   Error Handler
================================ */

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

/* ================================
   Database Initialization
================================ */

async function initializeServices() {
  console.log(
    "EZ MEDIA: initializing services..."
  );

  /**
   * قاعدة البيانات الأساسية.
   */
  try {
    await initializeDatabase();

    console.log(
      "EZ MEDIA: main database initialized."
    );
  } catch (error) {
    console.error(
      "EZ MEDIA: main database initialization failed:",
      error.message
    );
  }

  /**
   * قاعدة بيانات الوسائط والبث والعاجل.
   */
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

  /**
   * قاعدة بيانات الإشعارات.
   */
  try {
    const notificationDatabase =
      await initializeNotifications();

    if (
      notificationDatabase.success
    ) {
      console.log(
        "EZ MEDIA: notification database initialized."
      );
    } else {
      console.warn(
        "EZ MEDIA: notification database not ready:",
        notificationDatabase.status ||
          notificationDatabase.message
      );
    }
  } catch (error) {
    console.error(
      "EZ MEDIA: notification database initialization failed:",
      error.message
    );
  }
}

/* ================================
   Notification Worker
================================ */

function initializeNotificationWorker() {
  /**
   * لا نشغّل Worker إذا لم تكن قاعدة البيانات
   * معرفة أصلًا.
   */
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

  const state =
    startNotificationWorker({
      intervalMs,
      batchSize
    });

  registerNotificationWorkerShutdown();

  return state;
}

/* ================================
   Start Server
================================ */

async function startServer() {
  try {
    await initializeServices();

    const server =
      app.listen(
        PORT,
        HOST,
        () => {
          console.log(
            "========================================"
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
            "========================================"
          );

          /**
           * تشغيل Notification Worker بعد بدء الخادم.
           */
          const worker =
            initializeNotificationWorker();

          console.log(
            "EZ MEDIA Notification Worker:",
            worker
          );
        }
      );

    /**
     * إغلاق آمن للخادم.
     */
    const shutdown =
      async (signal) => {
        console.log(
          `EZ MEDIA: received ${signal}. Shutting down...`
        );

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
      () => shutdown("SIGTERM")
    );

    process.once(
      "SIGINT",
      () => shutdown("SIGINT")
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

/* ================================
   Start
================================ */

if (
  require.main === module
) {
  startServer();
}

module.exports = {
  app,
  startServer
};
