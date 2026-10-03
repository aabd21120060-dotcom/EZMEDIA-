app.get("/api/system/database", async (req, res) => {
  try {
    const database = await databaseHealth();

    res.json({
      success: true,
      database
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      database: {
        configured: Boolean(process.env.DATABASE_URL),
        connected: false,
        error: error.message
      }
    });
  }
});
app.use("/api/content", contentRoutes);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
const contentRoutes = require("./src/routes/content");
const { health: databaseHealth } = require("./src/database/db");
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
