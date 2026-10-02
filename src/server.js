import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const APP_NAME = process.env.APP_NAME || "AZ MEDIA";
const APP_VERSION = process.env.APP_VERSION || "11.0.0";

app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      : true,

    credentials: true
  })
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);


/*
|--------------------------------------------------------------------------
| Basic Request Information
|--------------------------------------------------------------------------
*/

app.use((req, res, next) => {
  req.requestId =
    req.headers["x-request-id"] ||
    crypto.randomUUID();

  res.setHeader(
    "x-request-id",
    req.requestId
  );

  next();
});


/*
|--------------------------------------------------------------------------
| Root
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    platform: APP_NAME,
    version: APP_VERSION,
    status: "online",
    message: "AZ MEDIA API is running",
    requestId: req.requestId
  });
});


/*
|--------------------------------------------------------------------------
| API Information
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  res.json({
    success: true,
    platform: APP_NAME,
    version: APP_VERSION,
    api: "v1",
    status: "online",
    requestId: req.requestId
  });
});


/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/health", async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      status: "healthy",
      platform: APP_NAME,
      version: APP_VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});


/*
|--------------------------------------------------------------------------
| Readiness Check
|--------------------------------------------------------------------------
*/

app.get("/ready", async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      ready: true,
      platform: APP_NAME,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});


/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
*/

const apiV1 = express.Router();


apiV1.get("/", (req, res) => {
  res.json({
    success: true,
    api: "v1",
    platform: APP_NAME,
    version: APP_VERSION,
    status: "online",
    requestId: req.requestId
  });
});


/*
|--------------------------------------------------------------------------
| System Status
|--------------------------------------------------------------------------
*/

apiV1.get("/status", (req, res) => {
  res.json({
    success: true,

    platform: {
      name: APP_NAME,
      version: APP_VERSION,
      environment:
        process.env.NODE_ENV || "development"
    },

    runtime: {
      node: process.version,
      uptime: process.uptime()
    },

    timestamp: new Date().toISOString(),

    requestId: req.requestId
  });
});


app.use("/api/v1", apiV1);


/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: "المسار المطلوب غير موجود",
    path: req.originalUrl,
    requestId: req.requestId
  });
});


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
      "[AZ MEDIA ERROR]",
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        message: error.message,
        stack:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.stack
      }
    );

    if (res.headersSent) {
      return next(error);
    }

    const statusCode =
      Number(error.statusCode) >= 400 &&
      Number(error.statusCode) < 600
        ? Number(error.statusCode)
        : 500;

    res.status(statusCode).json({
      success: false,

      error:
        process.env.NODE_ENV === "production"
          ? "INTERNAL_SERVER_ERROR"
          : error.message,

      requestId: req.requestId
    });
  }
);


/*
|--------------------------------------------------------------------------
| Server
|--------------------------------------------------------------------------
*/

const server = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `[AZ MEDIA] ${APP_NAME} ${APP_VERSION}`
    );

    console.log(
      `[AZ MEDIA] Server listening on port ${PORT}`
    );

    console.log(
      `[AZ MEDIA] Environment: ${
        process.env.NODE_ENV || "development"
      }`
    );
  }
);


/*
|--------------------------------------------------------------------------
| Graceful Shutdown
|--------------------------------------------------------------------------
*/

async function shutdown(signal) {
  console.log(
    `[AZ MEDIA] Received ${signal}. Shutting down...`
  );

  server.close(() => {
    console.log(
      "[AZ MEDIA] HTTP server closed"
    );
  });

  process.exit(0);
}


process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
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
      "[AZ MEDIA] Unhandled Rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "[AZ MEDIA] Uncaught Exception:",
      error
    );

    process.exit(1);
  }
);


export { app, server };
