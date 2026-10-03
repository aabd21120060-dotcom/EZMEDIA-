import { Router } from "express";
import env from "../config/env.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    platform: env.platform,

    version: env.version,

    api: "EZ MEDIA API",

    status: "online",

    endpoints: {
      health: "/health",
      status: "/status",
      api: "/api"
    },

    timestamp: new Date().toISOString(),

    requestId: req.requestId
  });
});

export default router;
