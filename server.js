"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const crypto = require("crypto");
const path = require("path");

const contentRoutes = require("./src/routes/content");
const aiRoutes = require("./src/routes/ai");
const mediaRoutes = require("./src/routes/media");
const liveRoutes = require("./src/routes/live");
const breakingRoutes = require("./src/routes/breaking");

const {
  health: databaseHealth
} = require("./src/database/db");

const {
  initializeDatabase
} = require("./src/database/init");

const {
  initializeMediaDatabase
} = require("./src/database/media-init");

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const PLATFORM = "EZ MEDIA";
const VERSION = "11.0.0";

/*
|--------------------------------------------------------------------------
| SECURITY
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| BODY
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| STATIC
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

app.use(
  (req, res, next) => {
    const requestId =
      req.headers["x-request-id"] ||
      crypto.randomUUID();

    req.requestId =
      requestId;

    res.setHeader(
      "X-Request-ID",
      requestId
    );

    next();
  }
);

/*
|--------------------------------------------------------------------------
| LOGGING
|--------------------------------------------------------------------------
*/

app.use(
  (req, res, next) => {
    const started =
      Date.now();

    res.on(
      "finish",
      () => {
        console.log(
          JSON.stringify({
            type:
              "http_request",

            requestId:
              req.requestId,

            method:
              req.method,

            path:
              req.originalUrl,

            status:
              res.statusCode,

            durationMs:
              Date.now() - started,

            timestamp:
              new Date().toISOString()
          })
        );
      }
    );

    next();
  }
);

/*
|--------------------------------------------------------------------------
| HOME
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/*
|--------------------------------------------------------------------------
| ADMIN
|--------------------------------------------------------------------------
*/

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "admin.html"
      )
    );
  }
);

/*
|--------------------------------------------------------------------------
| API ROOT
|--------------------------------------------------------------------------
*/

app.get(
  "/api",
  (req, res) => {
    res.json({
      platform:
        PLATFORM,

      version:
        VERSION,

      status:
        "online",

      api:
        true,

      endpoints: {
        home:
          "/",

        admin:
          "/admin",

        health:
          "/health",

        system:
          "/api/system",

        database:
          "/api/system/database",

        content:
          "/api/content",

        media:
          "/api/media",

        live:
          "/api/live",

        breaking:
          "/api/breaking",

        ai:
          "/api/ai"
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

        connected:
          false,

        databaseName:
          null,

        error:
          error.message
      };
    }

    const databaseReady =
      Boolean(
        database.configured &&
        database.connected
      );

    res.json({
      platform:
        PLATFORM,

      version:
        VERSION,

      status:
        "online",

      server: {
        online:
          true,

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
        api:
          true,

        cms:
          true,

        ai:
          Boolean(
            process.env.AI_API_KEY
          ),

        media:
          true,

        live:
          true,

        breakingNews:
          true,

        advertising:
          true,

        sponsorships:
          true,

        automation:
          true,

        analytics:
          true
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
| DATABASE
|--------------------------------------------------------------------------
*/

app.get(
  "/api/system/database",
  async (req, res) => {
    try {
      const database =
        await databaseHealth();

      return res.json({
        success:
          true,

        platform:
          PLATFORM,

        database,

        requestId:
          req.requestId,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      return res.status(503).json({
        success:
          false,

        platform:
          PLATFORM,

        database: {
          configured:
            Boolean(
              process.env.DATABASE_URL
            ),

          connected:
            false,

          ready:
            false,

          databaseName:
            null,

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

        connected:
          false,

        ready:
          false,

        error:
          error.message
      };
    }

    res.json({
      platform:
        PLATFORM,

      version:
        VERSION,

      status:
        "online",

      server: {
        online:
          true,

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
        cms:
          true,

        newsroom:
          true,

        breakingNews:
          true,

        mediaLibrary:
          true,

        liveBroadcast:
          true,

        advertising:
          true,

        sponsorships:
          true,

        analytics:
          true,

        automation:
          true,

        aiNewsroom:
          true
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
| CONTENT
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
| MEDIA
|--------------------------------------------------------------------------
*/

app.use(
  "/api/media",
  mediaRoutes
);

/*
|--------------------------------------------------------------------------
| LIVE
|--------------------------------------------------------------------------
*/

app.use(
  "/api/live",
  liveRoutes
);

/*
|--------------------------------------------------------------------------
| BREAKING NEWS
|--------------------------------------------------------------------------
*/

app.use(
  "/api/breaking",
  breakingRoutes
);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(
  (req, res) => {
    res.status(404).json({
      success:
        false,

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
| ERROR HANDLER
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
      success:
        false,

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
| START
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {
    if (
      process.env.DATABASE_URL
    ) {
      try {
        await initializeDatabase();

        await initializeMediaDatabase();

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
| SHUTDOWN
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

  server.close(
    () => {
      console.log(
        "EZ MEDIA server closed."
      );

      process.exit(0);
    }
  );

  setTimeout(
    () => {
      console.error(
        "Forced shutdown."
      );

      process.exit(1);
    },
    10000
  ).unref();
}

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

startServer();

module.exports = app;
