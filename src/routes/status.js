import { Router } from "express";
import env from "../config/env.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    platform: env.platform,

    version: env.version,

    status: "online",

    environment: env.nodeEnv,

    server: {
      node: process.version,
      uptime: process.uptime()
    },

    requestId: req.requestId,

    timestamp: new Date().toISOString()
  });
});

export default router;
