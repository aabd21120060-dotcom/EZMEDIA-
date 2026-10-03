app.use(
  express.static(
    path.join(__dirname, "public")
  )
);
const app = express();
const path = require("path");
/**
 * EZ MEDIA 11.0
 * Main Server
 *
 * Node.js 20+
 * Express 5
 */

"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const crypto = require("crypto");

const contentRoutes = require("./src/routes/content");
const aiRoutes = require("./src/routes/ai");
const { health: databaseHealth } = require("./src/database/db");

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const PLATFORM = "EZ MEDIA";
const VERSION = "11.0.0";

/* =========================================================
   SECURITY
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

app.use(compression());

/* =========================================================
   BODY PARSING
========================================================= */

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

/* =========================================================
   REQUEST ID
========================================================= */

app.use((req, res, next) => {
  const requestId =
    req.headers["x-request-id"] ||
    crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader(
    "X-Request-ID",
    requestId
  );

  next();
});

/* =========================================================
   REQUEST LOGGING
========================================================= */

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const duration =
      Date.now() - startedAt;

    console.log(
      JSON.stringify({
        type: "http_request",
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        timestamp: new Date().toISOString()
      })
    );
  });

  next();
});

/* =========================================================
   ROOT
========================================================= */
app.get("/", (req, res) => {
  res.json({
    platform: PLATFORM,
    version: VERSION,
    status: "online",
    message: "EZ MEDIA 11.0 يعمل بنجاح",
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});


/* =========================================================
   BASIC API
========================================================= */

app.get("/api", (req, res) => {
  res.json({
    platform: PLATFORM,
    version: VERSION,
    status: "online",
    api: true,
    requestId: req.requestId,
    endpoints: {
      health: "/health",
      database: "/api/system/database",
      content: "/api/content",
      ai: "/api/ai"
    }
  });
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", async (req, res) => {
  let database;

  try {
    database = await databaseHealth();
  } catch (error) {
    database = {
      configured: Boolean(
        process.env.DATABASE_URL
      ),
      connected: false,
      databaseName: null,
      error: error.message
    };
  }

  const databaseReady =
    database.configured &&
    database.connected;

  res.status(200).json({
    platform: PLATFORM,
    version: VERSION,

    status: "online",

    server: {
      online: true,
      node: process.version,
      environment:
        process.env.NODE_ENV || "development"
    },

    database: {
      configured:
        Boolean(database.configured),

      connected:
        Boolean(database.connected),

      ready:
        Boolean(databaseReady),

      databaseName:
        database.databaseName || null,

      serverTime:
        database.serverTime || null
    },

    services: {
      api: true,
      cms: true,
      ai: Boolean(
        process.env.AI_API_KEY
      ),
      media: true,
      live: true,
      advertising: true,
      sponsorships: true,
      automation: true,
      analytics: true
    },

    requestId: req.requestId,

    timestamp:
      new Date().toISOString()
  });
});

/* =========================================================
   DATABASE HEALTH
========================================================= */

app.get(
  "/api/system/database",
  async (req, res) => {
    try {
      const database =
        await databaseHealth();

      return res.json({
        success: true,

        platform: PLATFORM,

        database
      });
    } catch (error) {
      return res.status(503).json({
        success: false,

        platform: PLATFORM,

        database: {
          configured:
            Boolean(
              process.env.DATABASE_URL
            ),

          connected: false,

          ready: false,

          databaseName: null,

          error: error.message
        },

        requestId: req.requestId,

        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/* =========================================================
   CMS
========================================================= */

app.use(
  "/api/content",
  contentRoutes
);

/* =========================================================
   AI ENGINE
========================================================= */

app.use(
  "/api/ai",
  aiRoutes
);

/* =========================================================
   SYSTEM INFORMATION
========================================================= */

app.get(
  "/api/system",
  async (req, res) => {
    let database;

    try {
      database =
        await databaseHealth();
    } catch (error) {
      database = {
        configured:
          Boolean(
            process.env.DATABASE_URL
          ),

        connected: false,

        ready: false,

        error: error.message
      };
    }

    res.json({
      platform: PLATFORM,

      version: VERSION,

      status: "online",

      server: {
        node: process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime: process.uptime()
      },

      database,

      ai: {
        configured:
          Boolean(
            process.env.AI_API_KEY
          ),

        provider:
          process.env.AI_PROVIDER ||
          "openai",

        model:
          process.env.AI_MODEL ||
          "gpt-5"
      },

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   404
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,

    error: "NOT_FOUND",

    message:
      "المسار المطلوب غير موجود",

    path: req.originalUrl,

    requestId:
      req.requestId,

    timestamp:
      new Date().toISOString()
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      JSON.stringify({
        type: "server_error",

        requestId:
          req.requestId,

        message:
          error.message,

        stack:
          error.stack,

        timestamp:
          new Date().toISOString()
      })
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(
      error.statusCode || 500
    ).json({
      success: false,

      error:
        error.code ||
        "INTERNAL_SERVER_ERROR",

      message:
        "حدث خطأ داخلي في EZ MEDIA",

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   SERVER START
========================================================= */

const server = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      JSON.stringify({
        platform: PLATFORM,

        version: VERSION,

        status: "online",

        port: PORT,

        node: process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        timestamp:
          new Date().toISOString()
      })
    );
  }
);

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {
  console.log(
    `${signal} received. Shutting down EZ MEDIA...`
  );

  server.close(() => {
    console.log(
      "EZ MEDIA server closed."
    );

    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "Forced shutdown."
    );

    process.exit(1);
  }, 10000).unref();
}

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
      "Unhandled Rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

module.exports = app;
