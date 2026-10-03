"use strict";

/*
|--------------------------------------------------------------------------
| EZ MEDIA 11.0
| Main Server
|--------------------------------------------------------------------------
|
| المنصة الإعلامية الذكية
|
| الوظائف الرئيسية:
|
| - Express API
| - PostgreSQL
| - CMS
| - AI
| - Media Library
| - Object Storage
| - Upload API
| - Live Channels
| - Breaking News
| - Admin
| - Health Monitoring
| - Security Headers
| - Compression
| - CORS
| - Request ID
| - Graceful Shutdown
|
|--------------------------------------------------------------------------
*/

const express =
  require("express");

const cors =
  require("cors");

const helmet =
  require("helmet");

const compression =
  require("compression");

const crypto =
  require("crypto");

const path =
  require("path");

/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

const {
  health:
    databaseHealth,
} =
  require("./src/database/db");

const {
  initializeDatabase,
} =
  require("./src/database/init");

const {
  initializeMediaDatabase,
} =
  require("./src/database/media-init");

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Application
|--------------------------------------------------------------------------
*/

const app =
  express();

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const PORT =
  Number(
    process.env.PORT || 3000
  );

const NODE_ENV =
  process.env.NODE_ENV ||
  "development";

const VERSION =
  "11.0.0";

const PLATFORM =
  "EZ MEDIA";

/*
|--------------------------------------------------------------------------
| Trust Proxy
|--------------------------------------------------------------------------
|
| Railway يعمل خلف Proxy.
|
|--------------------------------------------------------------------------
*/

app.set(
  "trust proxy",
  1
);

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    contentSecurityPolicy:
      false,

    crossOriginEmbedderPolicy:
      false,
  })
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin:
      true,

    credentials:
      true,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
    ],
  })
);

/*
|--------------------------------------------------------------------------
| Compression
|--------------------------------------------------------------------------
*/

app.use(
  compression()
);

/*
|--------------------------------------------------------------------------
| Body Parser
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit:
      "10mb",
  })
);

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      "10mb",
  })
);

/*
|--------------------------------------------------------------------------
| Request ID
|--------------------------------------------------------------------------
*/

app.use(
  (
    req,
    res,
    next
  ) => {
    const requestId =
      req.get(
        "X-Request-ID"
      ) ||
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
| Request Logger
|--------------------------------------------------------------------------
*/

app.use(
  (
    req,
    res,
    next
  ) => {
    const started =
      Date.now();

    res.on(
      "finish",
      () => {
        const duration =
          Date.now() -
          started;

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

            duration:
              `${duration}ms`,

            timestamp:
              new Date()
                .toISOString(),
          })
        );
      }
    );

    next();
  }
);

/*
|--------------------------------------------------------------------------
| Static Files
|--------------------------------------------------------------------------
*/

const publicDirectory =
  path.join(
    __dirname,
    "public"
  );

app.use(
  express.static(
    publicDirectory,
    {
      index:
        false,
    }
  )
);

/*
|--------------------------------------------------------------------------
| Home Page
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (
    req,
    res
  ) => {
    res.sendFile(
      path.join(
        publicDirectory,
        "index.html"
      )
    );
  }
);

/*
|--------------------------------------------------------------------------
| Admin Page
|--------------------------------------------------------------------------
*/

app.get(
  "/admin",
  (
    req,
    res
  ) => {
    res.sendFile(
      path.join(
        publicDirectory,
        "admin.html"
      )
    );
  }
);

/*
|--------------------------------------------------------------------------
| API Information
|--------------------------------------------------------------------------
*/

app.get(
  "/api",
  (
    req,
    res
  ) => {
    res.json({
      platform:
        PLATFORM,

      version:
        VERSION,

      status:
        "online",

      message:
        "EZ MEDIA API يعمل بنجاح",

      requestId:
        req.requestId,

      endpoints: {
        health:
          "/health",

        system:
          "/api/system",

        database:
          "/api/system/database",

        content:
          "/api/content",

        ai:
          "/api/ai",

        media:
          "/api/media",

        upload:
          "/api/upload",

        storage:
          "/api/storage",

        live:
          "/api/live",

        breaking:
          "/api/breaking",
      },

      timestamp:
        new Date()
          .toISOString(),
    });
  }
);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get(
  "/health",
  async (
    req,
    res
  ) => {
    let database = {
      configured:
        false,

      connected:
        false,
    };

    try {
      database =
        await databaseHealth();
    } catch (error) {
      database = {
        configured:
          true,

        connected:
          false,

        error:
          error.message,
      };
    }

    const status =
      database.connected
        ? "online"
        : "degraded";

    res.status(
      status === "online"
        ? 200
        : 200
    );

    res.json({
      platform:
        PLATFORM,

      version:
        VERSION,

      status,

      server:
        "online",

      database,

      node:
        process.version,

      environment:
        NODE_ENV,

      uptime:
        process.uptime(),

      timestamp:
        new Date()
          .toISOString(),

      requestId:
        req.requestId,
    });
  }
);

/*
|--------------------------------------------------------------------------
| System Status
|--------------------------------------------------------------------------
*/

app.get(
  "/api/system",
  async (
    req,
    res
  ) => {
    let database = {
      configured:
        false,

      connected:
        false,
    };

    try {
      database =
        await databaseHealth();
    } catch (error) {
      database = {
        configured:
          true,

        connected:
          false,

        error:
          error.message,
      };
    }

    const aiConfigured =
      Boolean(
        process.env.AI_API_KEY
      );

    const storageConfigured =
      Boolean(
        process.env.STORAGE_ENDPOINT &&
        process.env.STORAGE_BUCKET &&
        process.env.STORAGE_ACCESS_KEY_ID &&
        process.env.STORAGE_SECRET_ACCESS_KEY
      );

    res.json({
      platform:
        PLATFORM,

      version:
        VERSION,

      status:
        "online",

      server: {
        status:
          "online",

        node:
          process.version,

        environment:
          NODE_ENV,

        uptime:
          process.uptime(),
      },

      services: {
        api:
          true,

        cms:
          true,

        mediaLibrary:
          true,

        upload:
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

        ai:
          aiConfigured,

        storage:
          storageConfigured,

        database:
          database.connected,
      },

      database,

      ai: {
        configured:
          aiConfigured,

        provider:
          process.env.AI_PROVIDER ||
          null,

        model:
          process.env.AI_MODEL ||
          null,
      },

      storage: {
        configured:
          storageConfigured,
      },

      requestId:
        req.requestId,

      timestamp:
        new Date()
          .toISOString(),
    });
  }
);

/*
|--------------------------------------------------------------------------
| Database Status
|--------------------------------------------------------------------------
*/

app.get(
  "/api/system/database",
  async (
    req,
    res
  ) => {
    try {
      const result =
        await databaseHealth();

      res.json({
        success:
          true,

        platform:
          PLATFORM,

        version:
          VERSION,

        database:
          result,

        requestId:
          req.requestId,

        timestamp:
          new Date()
            .toISOString(),
      });
    } catch (error) {
      res.status(
        503
      );

      res.json({
        success:
          false,

        platform:
          PLATFORM,

        version:
          VERSION,

        database: {
          configured:
            Boolean(
              process.env
                .DATABASE_URL
            ),

          connected:
            false,

          error:
            error.message,
        },

        requestId:
          req.requestId,

        timestamp:
          new Date()
            .toISOString(),
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CMS Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/content",
  contentRoutes
);

/*
|--------------------------------------------------------------------------
| AI Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/ai",
  aiRoutes
);

/*
|--------------------------------------------------------------------------
| Media Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/media",
  mediaRoutes
);

/*
|--------------------------------------------------------------------------
| Live Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/live",
  liveRoutes
);

/*
|--------------------------------------------------------------------------
| Breaking News Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/breaking",
  breakingRoutes
);

/*
|--------------------------------------------------------------------------
| Storage Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/storage",
  storageRoutes
);

/*
|--------------------------------------------------------------------------
| Upload Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/upload",
  uploadRoutes
);

/*
|--------------------------------------------------------------------------
| 404 API
|--------------------------------------------------------------------------
*/

app.use(
  "/api",
  (
    req,
    res
  ) => {
    res.status(
      404
    );

    res.json({
      success:
        false,

      platform:
        PLATFORM,

      version:
        VERSION,

      error:
        "API endpoint not found",

      path:
        req.originalUrl,

      requestId:
        req.requestId,

      timestamp:
        new Date()
          .toISOString(),
    });
  }
);

/*
|--------------------------------------------------------------------------
| 404 Web
|--------------------------------------------------------------------------
*/

app.use(
  (
    req,
    res
  ) => {
    res.status(
      404
    );

    res.send(
      `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >
        <title>EZ MEDIA</title>

        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            background:
              linear-gradient(
                135deg,
                #ffffff,
                #eefaff,
                #dff7ff
              );
          }

          .box {
            text-align: center;
            padding: 40px;
          }

          h1 {
            margin: 0 0 12px;
            font-size: 42px;
          }

          p {
            color: #527080;
            font-size: 18px;
          }

          a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            border-radius: 14px;
            text-decoration: none;
            background: #0ea5e9;
            color: white;
          }
        </style>
      </head>

      <body>

        <div class="box">

          <h1>
            EZ MEDIA
          </h1>

          <p>
            الصفحة غير موجودة
          </p>

          <a href="/">
            العودة للرئيسية
          </a>

        </div>

      </body>
      </html>
      `
    );
  }
);

/*
|--------------------------------------------------------------------------
| Global Error Handler
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
          "application_error",

        requestId:
          req.requestId,

        message:
          error.message,

        code:
          error.code ||
          null,

        stack:
          NODE_ENV ===
          "production"
            ? undefined
            : error.stack,

        timestamp:
          new Date()
            .toISOString(),
      })
    );

    /*
    |--------------------------------------------------------------------------
    | Multer Errors
    |--------------------------------------------------------------------------
    */

    if (
      error.name ===
      "MulterError"
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "خطأ في رفع الملف",

          code:
            error.code,

          message:
            error.message,

          requestId:
            req.requestId,
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Validation
    |--------------------------------------------------------------------------
    */

    if (
      error.code ===
      "UPLOAD_VALIDATION_FAILED"
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            error.message,

          details:
            error.details ||
            [],

          requestId:
            req.requestId,
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Storage Not Configured
    |--------------------------------------------------------------------------
    */

    if (
      error.code ===
      "STORAGE_NOT_CONFIGURED"
    ) {
      return res
        .status(503)
        .json({
          success:
            false,

          error:
            "Object Storage غير مهيأ",

          code:
            error.code,

          message:
            error.message,

          requestId:
            req.requestId,
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Database Not Configured
    |--------------------------------------------------------------------------
    */

    if (
      error.code ===
      "DATABASE_NOT_CONFIGURED"
    ) {
      return res
        .status(503)
        .json({
          success:
            false,

          error:
            "PostgreSQL غير مهيأ",

          code:
            error.code,

          message:
            error.message,

          requestId:
            req.requestId,
        });
    }

    /*
    |--------------------------------------------------------------------------
    | General Error
    |--------------------------------------------------------------------------
    */

    return res
      .status(
        error.statusCode ||
        500
      )
      .json({
        success:
          false,

        platform:
          PLATFORM,

        version:
          VERSION,

        error:
          "Internal Server Error",

        message:
          NODE_ENV ===
          "production"
            ? "حدث خطأ داخلي في المنصة"
            : error.message,

        requestId:
          req.requestId,

        timestamp:
          new Date()
            .toISOString(),
      });
  }
);

/*
|--------------------------------------------------------------------------
| Database Initialization
|--------------------------------------------------------------------------
*/

async function initializeApplication() {
  if (
    !process.env
      .DATABASE_URL
  ) {
    console.log(
      "DATABASE_URL is not configured. Database initialization skipped."
    );

    return {
      database:
        false,
    };
  }

  try {
    console.log(
      "Initializing EZ MEDIA database..."
    );

    await initializeDatabase();

    await initializeMediaDatabase();

    console.log(
      "EZ MEDIA database initialized successfully."
    );

    return {
      database:
        true,
    };
  } catch (error) {
    console.error(
      "Database initialization failed:",
      error.message
    );

    /*
    |--------------------------------------------------------------------------
    | لا نوقف السيرفر بالكامل.
    |
    | السبب:
    | يمكن للواجهة الأساسية أن تعمل أثناء معالجة
    | إعداد PostgreSQL.
    |--------------------------------------------------------------------------
    */

    return {
      database:
        false,

      error:
        error.message,
    };
  }
}

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

let server = null;

async function startServer() {
  await initializeApplication();

  server =
    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          "=================================================="
        );

        console.log(
          `🚀 ${PLATFORM} ${VERSION}`
        );

        console.log(
          `🌐 Server: http://0.0.0.0:${PORT}`
        );

        console.log(
          `📡 Environment: ${NODE_ENV}`
        );

        console.log(
          `🟢 Status: ONLINE`
        );

        console.log(
          "=================================================="
        );
      }
    );
}

/*
|--------------------------------------------------------------------------
| Graceful Shutdown
|--------------------------------------------------------------------------
*/

async function shutdown(
  signal
) {
  console.log(
    `${signal} received. Shutting down EZ MEDIA...`
  );

  if (!server) {
    process.exit(
      0
    );
  }

  server.close(
    () => {
      console.log(
        "HTTP server closed."
      );

      process.exit(
        0
      );
    }
  );

  setTimeout(
    () => {
      console.error(
        "Forced shutdown."
      );

      process.exit(
        1
      );
    },
    10000
  ).unref();
}

process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);

/*
|--------------------------------------------------------------------------
| Unhandled Errors
|--------------------------------------------------------------------------
*/

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled Promise Rejection:",
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
| Start
|--------------------------------------------------------------------------
*/

startServer().catch(
  (error) => {
    console.error(
      "Failed to start EZ MEDIA:",
      error
    );

    process.exit(
      1
    );
  }
);

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports =
  app;
