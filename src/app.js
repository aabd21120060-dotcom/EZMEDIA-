import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

const APP_NAME =
  process.env.APP_NAME || "AZ MEDIA";

const APP_VERSION =
  process.env.APP_VERSION || "11.0.0";


/*
|--------------------------------------------------------------------------
| Express Configuration
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

app.set("trust proxy", 1);


/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : true;

app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);


/*
|--------------------------------------------------------------------------
| Body Parser
|--------------------------------------------------------------------------
*/

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
| Request ID
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
  res.status(200).json({
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
| API
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  res.status(200).json({
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
| Health
|--------------------------------------------------------------------------
*/

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    platform: APP_NAME,
    version: APP_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});


/*
|--------------------------------------------------------------------------
| Readiness
|--------------------------------------------------------------------------
*/

app.get("/ready", (req, res) => {
  res.status(200).json({
    success: true,
    ready: true,
    platform: APP_NAME,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});


/*
|--------------------------------------------------------------------------
| API v1 Router
|--------------------------------------------------------------------------
*/

const apiV1 = express.Router();


apiV1.get("/", (req, res) => {
  res.status(200).json({
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
| System Status
|--------------------------------------------------------------------------
*/

apiV1.get("/status", (req, res) => {
  res.status(200).json({
    success: true,

    platform: {
      name: APP_NAME,
      version: APP_VERSION,
      environment:
        process.env.NODE_ENV ||
        "development"
    },

    runtime: {
      node: process.version,
      uptime: process.uptime()
    },

    timestamp:
      new Date().toISOString(),

    requestId:
      req.requestId
  });
});


app.use(
  "/api/v1",
  apiV1
);


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message:
      "المسار المطلوب غير موجود",
    path: req.originalUrl,
    requestId:
      req.requestId
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
        requestId:
          req.requestId,

        method:
          req.method,

        path:
          req.originalUrl,

        message:
          error.message,

        stack:
          process.env.NODE_ENV ===
          "production"
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
        process.env.NODE_ENV ===
        "production"
          ? "INTERNAL_SERVER_ERROR"
          : error.message,

      requestId:
        req.requestId
    });
  }
);


export default app;

export {
  app
};
