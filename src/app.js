import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";

import requestId from "./middleware/request-id.js";

import {
  notFoundHandler,
  errorHandler
} from "./middleware/errors.js";

import healthRouter from "./routes/health.js";
import statusRouter from "./routes/status.js";
import apiRouter from "./routes/api.js";
import authRouter from "./routes/auth.js";

const app = express();

app.disable("x-powered-by");

app.set(
  "trust proxy",
  1
);

/*
 * ==========================================
 * SECURITY
 * ==========================================
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
    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID"
    ]
  })
);

/*
 * ==========================================
 * BODY PARSING
 * ==========================================
 */

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);

/*
 * ==========================================
 * REQUEST ID
 * ==========================================
 */

app.use(requestId);

/*
 * ==========================================
 * LOGGING
 * ==========================================
 */

app.use(
  morgan(
    ":remote-addr - :method :url :status :res[content-length] - :response-time ms - request_id=:req[x-request-id]"
  )
);

/*
 * ==========================================
 * PUBLIC DIRECTORY
 * ==========================================
 */

const publicDirectory =
  path.resolve(
    process.cwd(),
    "public"
  );

app.use(
  express.static(
    publicDirectory
  )
);

/*
 * ==========================================
 * HOME
 * ==========================================
 */

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        publicDirectory,
        "index.html"
      )
    );
  }
);

/*
 * ==========================================
 * HEALTH
 * ==========================================
 */

app.use(
  "/health",
  healthRouter
);

/*
 * ==========================================
 * STATUS
 * ==========================================
 */

app.use(
  "/status",
  statusRouter
);

/*
 * ==========================================
 * MAIN API
 * ==========================================
 */

app.use(
  "/api",
  apiRouter
);

/*
 * ==========================================
 * AUTHENTICATION
 * ==========================================
 */

app.use(
  "/api/auth",
  authRouter
);

/*
 * ==========================================
 * 404
 * ==========================================
 */

app.use(
  notFoundHandler
);

/*
 * ==========================================
 * ERROR HANDLER
 * ==========================================
 */

app.use(
  errorHandler
);

export default app;
