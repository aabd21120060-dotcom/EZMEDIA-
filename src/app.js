import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

import requestId from "./middleware/request-id.js";

import {
  notFoundHandler,
  errorHandler
} from "./middleware/errors.js";

import healthRouter from "./routes/health.js";
import statusRouter from "./routes/status.js";
import apiRouter from "./routes/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.disable("x-powered-by");

app.set("trust proxy", 1);

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

app.use(requestId);

app.use(
  morgan(
    ":remote-addr - :method :url :status :res[content-length] - :response-time ms - request_id=:req[x-request-id]"
  )
);

const publicDirectory = path.resolve(
  __dirname,
  "../../public"
);

app.use(
  express.static(publicDirectory)
);

/*
 * الصفحة الرئيسية
 * يتم تقديم واجهة EZ MEDIA من public/index.html
 */
app.get("/", (req, res) => {
  res.sendFile(
    path.join(publicDirectory, "index.html")
  );
});

app.use(
  "/health",
  healthRouter
);

app.use(
  "/status",
  statusRouter
);

app.use(
  "/api",
  apiRouter
);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;
