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

const app = express();

app.disable("x-powered-by");

app.set("trust proxy", 1);

/*
 * ================================
 * Security
 * ================================
 */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

/*
 * ================================
 * CORS
 * ================================
 */

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
 * ================================
 * Body Parser
 * ================================
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
 * ================================
 * Request ID
 * ================================
 */

app.use(requestId);

/*
 * ================================
 * Logging
 * ================================
 */

app.use(
  morgan(
    ":remote-addr - :method :url :status :res[content-length] - :response-time ms - request_id=:req[x-request-id]"
  )
);

/*
 * ================================
 * Public Directory
 * ================================
 *
 * Railway:
 *
 * /app/public
 *
 * وهذا هو المسار الصحيح للواجهة
 */

const publicDirectory = path.resolve(
  process.cwd(),
  "public"
);

/*
 * ================================
 * Static Files
 * ================================
 */

app.use(
  express.static(publicDirectory)
);

/*
 * ================================
 * EZ MEDIA Homepage
 * ================================
 */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      publicDirectory,
      "index.html"
    )
  );
});

/*
 * ================================
 * Health
 * ================================
 */

app.use(
  "/health",
  healthRouter
);

/*
 * ================================
 * Status
 * ================================
 */

app.use(
  "/status",
  statusRouter
);

/*
 * ================================
 * API
 * ================================
 */

app.use(
  "/api",
  apiRouter
);

/*
 * ================================
 * 404
 * ================================
 */

app.use(
  notFoundHandler
);

/*
 * ================================
 * Error Handler
 * ================================
 */

app.use(
  errorHandler
);

/*
 * ================================
 * Export
 * ================================
 */

export default app;
