import express from "express";

import cors from "cors";

import helmet from "helmet";

import morgan from "morgan";

import { randomUUID } from "node:crypto";

import { config } from "./config/env.js";

import {
  checkDatabase
} from "./config/database.js";


const app =
  express();


/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    crossOriginResourcePolicy: false
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
      config.cors.origin === "*"
        ? true
        : config.cors.origin,

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
    limit: "50mb"
  })
);


app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb"
  })
);


/*
|--------------------------------------------------------------------------
| Logging
|--------------------------------------------------------------------------
*/

app.use(
  morgan("combined")
);


/*
|--------------------------------------------------------------------------
| Request ID
|--------------------------------------------------------------------------
*/

app.use(
  (req, res, next) => {

    req.requestId =
      req.headers["x-request-id"] ||
      randomUUID();


    res.setHeader(
      "X-Request-ID",
      req.requestId
    );


    next();

  }
);


/*
|--------------------------------------------------------------------------
| Root
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {

    res.json({

      platform:
        "EZ MEDIA",

      version:
        config.app.version,

      status:
        "online",

      message:
        "EZ MEDIA 11.0 يعمل بنجاح",

      environment:
        config.app.environment,

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()

    });

  }
);


/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  "/health",
  async (req, res) => {

    let database = {

      connected: false,

      databaseName: null,

      message:
        "Database not configured"

    };


    try {

      database =
        await checkDatabase();

    } catch (error) {

      database = {

        connected: false,

        databaseName: null,

        message:
          error.message

      };

    }


    const healthy =
      database.connected;


    res.status(
      healthy ? 200 : 503
    );


    res.json({

      platform:
        "EZ MEDIA",

      version:
        config.app.version,

      status:
        healthy
          ? "healthy"
          : "degraded",

      server:
        "online",

      database,

      node:
        process.version,

      environment:
        config.app.environment,

      uptime:
        process.uptime(),

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId

    });

  }
);


/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

app.get(
  "/api",
  (req, res) => {

    res.json({

      name:
        "EZ MEDIA API",

      version:
        "11.0.0",

      status:
        "online",

      endpoints: {

        root:
          "/",

        health:
          "/health",

        api:
          "/api",

        status:
          "/api/status"

      },

      timestamp:
        new Date().toISOString()

    });

  }
);


/*
|--------------------------------------------------------------------------
| API Status
|--------------------------------------------------------------------------
*/

app.get(
  "/api/status",
  async (req, res) => {

    let databaseStatus =
      "not_configured";


    try {

      const database =
        await checkDatabase();


      databaseStatus =
        database.connected
          ? "connected"
          : "not_configured";

    } catch {

      databaseStatus =
        "error";

    }


    res.json({

      platform:
        "EZ MEDIA",

      version:
        "11.0.0",

      server:
        "online",

      database:
        databaseStatus,

      automation:
        "ready",

      media:
        "ready",

      content:
        "ready",

      advertising:
        "ready",

      sponsorship:
        "ready",

      social:
        "ready",

      live:
        "ready",

      ai:
        "ready",

      timestamp:
        new Date().toISOString()

    });

  }
);


/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(
  (req, res) => {

    res.status(404);

    res.json({

      success:
        false,

      error:
        "NOT_FOUND",

      message:
        "المسار المطلوب غير موجود",

      path:
        req.originalUrl,

      requestId:
        req.requestId

    });

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
      "[EZ MEDIA] ERROR:",
      error
    );


    if (res.headersSent) {

      return next(error);

    }


    res.status(
      error.status || 500
    );


    res.json({

      success:
        false,

      error:
        "INTERNAL_SERVER_ERROR",

      message:
        config.app.isDevelopment
          ? error.message
          : "حدث خطأ داخلي في الخادم",

      requestId:
        req.requestId,

      timestamp:
        new Date().toISOString()

    });

  }
);


export default app;
