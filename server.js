/**
 * EZ MEDIA 11.0
 * AI Media Platform
 *
 * Node.js 20+
 * Express 5+
 */

"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const crypto = require("crypto");
const path = require("path");

const contentRoutes = require("./src/routes/content");
const aiRoutes = require("./src/routes/ai");
const { health: databaseHealth } = require("./src/database/db");
const { initializeDatabase } = require("./src/database/init");

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const PLATFORM = "EZ MEDIA";
const VERSION = "11.0.0";

/*
|--------------------------------------------------------------------------
| BASIC SETTINGS
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

/*
|--------------------------------------------------------------------------
| SECURITY
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| BODY PARSING
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| STATIC FILES
|--------------------------------------------------------------------------
*/

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/*
|--------------------------------------------------------------------------
| REQUEST ID
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| REQUEST LOGGING
|--------------------------------------------------------------------------
*/

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
        timestamp:
          new Date().toISOString()
      })
    );
  });

  next();
});

/*
|--------------------------------------------------------------------------
| HOME
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/*
|--------------------------------------------------------------------------
| ADMIN
|--------------------------------------------------------------------------
*/

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "admin.html"
    )
  );
});

/*
|--------------------------------------------------------------------------
| BASIC API
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  res.json({
    platform: PLATFORM,
    version: VERSION,
    status: "online",

    api: true,

    requestId:
      req.requestId,

    endpoints: {
      home: "/",
      admin: "/admin",
      health: "/health",

      system:
        "/api/system",

      database:
        "/api/system/database",

      content:
        "/api/content",

      ai:
        "/api/ai"
    },

    timestamp:
      new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

app.get(
  "/health",
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

        databaseName: null,

        error:
          error.message
      };
    }

    const databaseReady =
      Boolean(
        database.configured &&
        database.connected
      );

    res.status(200).json({
      platform: PLATFORM,

      version: VERSION,

      status: "online",

      server: {
        online: true,

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime:
          process.uptime()
      },

      database: {
        configured:
          Boolean(
            database.configured
          ),

        connected:
          Boolean(
            database.connected
          ),

        ready:
          databaseReady,

        databaseName:
          database.databaseName ||
          null,

        serverTime:
          database.serverTime ||
          null
      },

      services: {
        api: true,

        cms: true,

        ai:
          Boolean(
            process.env.AI_API_KEY
          ),

        media: true,

        live: true,

        advertising: true,

        sponsorships: true,

        automation: true,

        analytics: true
      },

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/*
|--------------------------------------------------------------------------
| DATABASE HEALTH
|--------------------------------------------------------------------------
*/

app.get(
  "/api/system/database",
  async (req, res) => {
    try {
      const database =
        await databaseHealth();

      return res.json({
        success: true,

        platform: PLATFORM,

        database,

        requestId:
          req.requestId,

        timestamp:
          new Date().toISOString()
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

          error:
            error.message
        },

        requestId:
          req.requestId,

        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| SYSTEM
|--------------------------------------------------------------------------
*/

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

        databaseName: null,

        error:
          error.message
      };
    }

    res.json({
      platform: PLATFORM,

      version: VERSION,

      status: "online",

      server: {
        online: true,

        node:
          process.version,

        environment:
          process.env.NODE_ENV ||
          "development",

        uptime:
          process.uptime()
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

      modules: {
        cms: true,

        newsroom: true,

        mediaLibrary: true,

        liveBroadcast: true,

        advertising: true,

        sponsorships: true,

        analytics: true,

        automation: true,

        aiNewsroom: true
      },

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/*
|--------------------------------------------------------------------------
| CMS
|--------------------------------------------------------------------------
*/

app.use(
  "/api/content",
  contentRoutes
);

/*
|--------------------------------------------------------------------------
| AI
|--------------------------------------------------------------------------
*/

app.use(
  "/api/ai",
  aiRoutes
);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        "NOT_FOUND",

      message:
        "المسار المطلوب غير موجود",

      path:
        req.originalUrl,

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()
    });
  }
);

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      JSON.stringify({
        type:
          "server_error",

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

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(
      error.statusCode ||
        500
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

/*
|--------------------------------------------------------------------------
| SERVER
|--------------------------------------------------------------------------
*/

let server = null;

/*
|--------------------------------------------------------------------------
| STARTUP
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {
    /*
    |--------------------------------------------------------------------------
    | DATABASE
    |--------------------------------------------------------------------------
    */

    if (
      process.env.DATABASE_URL
    ) {
      try {
        await initializeDatabase();

        console.log(
          JSON.stringify({
            type:
              "database_initialized",

            platform:
              PLATFORM,

            version:
              VERSION,

            status:
              "ready",

            timestamp:
              new Date().toISOString()
          })
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            type:
              "database_initialization_error",

            platform:
              PLATFORM,

            error:
              error.message,

            timestamp:
              new Date().toISOString()
          })
        );
      }
    } else {
      console.log(
        JSON.stringify({
          type:
            "database_skipped",

          platform:
            PLATFORM,

          message:
            "DATABASE_URL is not configured",

          timestamp:
            new Date().toISOString()
        })
      );
    }

    /*
    |--------------------------------------------------------------------------
    | HTTP SERVER
    |--------------------------------------------------------------------------
    */

    server =
      app.listen(
        PORT,
        "0.0.0.0",
        () => {
          console.log(
            JSON.stringify({
              platform:
                PLATFORM,

              version:
                VERSION,

              status:
                "online",

              port:
                PORT,

              node:
                process.version,

              environment:
                process.env.NODE_ENV ||
                "development",

              timestamp:
                new Date().toISOString()
            })
          );
        }
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        type:
          "startup_error",

        platform:
          PLATFORM,

        error:
          error.message,

        stack:
          error.stack,

        timestamp:
          new Date().toISOString()
      })
    );

    process.exit(1);
  }
}

/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
*/

async function shutdown(
  signal
) {
  console.log(
    `${signal} received. Shutting down EZ MEDIA...`
  );

  if (!server) {
    process.exit(0);
  }

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

/*
|--------------------------------------------------------------------------
| PROCESS EVENTS
|--------------------------------------------------------------------------
*/

process.on(
  "SIGTERM",
  () =>
    shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () =>
    shutdown("SIGINT")
);

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

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

startServer();

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = app;
