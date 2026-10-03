import { Router } from "express";
import env from "../config/env.js";
import { checkDatabase } from "../config/database.js";

const router = Router();

router.get("/", async (req, res) => {
  const database = await checkDatabase();

  const status = database.connected
    ? "online"
    : "degraded";

  res.status(200).json({
    platform: env.platform,

    version: env.version,

    status,

    server: "online",

    database,

    node: process.version,

    environment: env.nodeEnv,

    uptime: process.uptime(),

    timestamp: new Date().toISOString(),

    requestId: req.requestId
  });
});

export default router;
