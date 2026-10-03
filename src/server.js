import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    platform: "EZ MEDIA",
    version: "11.0.0",
    status: "online",
    message: "EZ MEDIA Platform is running",
    api: "/api",
    health: "/health"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    platform: "EZ MEDIA",
    version: "11.0.0",
    status: "healthy",
    server: {
      online: true,
      node: process.version,
      environment:
        process.env.NODE_ENV || "production",
      uptime: process.uptime()
    },
    database: {
      configured: Boolean(
        process.env.DATABASE_URL
      ),
      ready: false,
      message:
        process.env.DATABASE_URL
          ? "Database variable detected"
          : "DATABASE_URL is not configured"
    },
    features: {
      api: true,
      cms: true,
      storyObject: true,
      aiOrchestrator: true,
      workflowEngine: true,
      mediaLibrary: true,
      advertising: true,
      sponsorships: true,
      automation: true,
      worldRadar: false
    },
    timestamp: new Date().toISOString()
  });
});

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    platform: "EZ MEDIA",
    version: "11.0.0",
    status: "online",
    endpoints: {
      health: "/health",
      status: "/api/status",
      stories: "/api/stories",
      aiAgents: "/api/ai/agents",
      workflow: "/api/workflow/queue"
    }
  });
});

app.get("/api/status", (req, res) => {
  res.status(200).json({
    success: true,
    platform: "EZ MEDIA",
    version: "11.0.0",
    status: "online",
    server: "ready",
    database: {
      configured: Boolean(
        process.env.DATABASE_URL
      )
    },
    timestamp: new Date().toISOString()
  });
});

app.get("/api/stories", (req, res) => {
  res.status(200).json({
    success: true,
    count: 0,
    stories: []
  });
});

app.get("/api/ai/agents", (req, res) => {
  res.status(200).json({
    success: true,
    agents: [
      "EZ_RESEARCH_AGENT",
      "EZ_CLASSIFICATION_AGENT",
      "EZ_VERIFICATION_AGENT",
      "EZ_EDITORIAL_AGENT",
      "EZ_SEO_AGENT",
      "EZ_SOCIAL_AGENT"
    ]
  });
});

app.get("/api/workflow/queue", (req, res) => {
  res.status(200).json({
    success: true,
    count: 0,
    jobs: []
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.originalUrl
  });
});

app.use((error, req, res, next) => {
  console.error(
    "[EZ MEDIA] Server error:",
    error
  );

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

const server = app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `[EZ MEDIA] Server running on ${HOST}:${PORT}`
    );

    console.log(
      `[EZ MEDIA] Version 11.0.0`
    );

    console.log(
      `[EZ MEDIA] Environment: ${
        process.env.NODE_ENV || "production"
      }`
    );

    console.log(
      `[EZ MEDIA] DATABASE_URL: ${
        process.env.DATABASE_URL
          ? "configured"
          : "not configured"
      }`
    );
  }
);

function shutdown(signal) {
  console.log(
    `[EZ MEDIA] ${signal} received`
  );

  server.close(() => {
    console.log(
      "[EZ MEDIA] Server stopped"
    );

    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "[EZ MEDIA] Uncaught exception:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "[EZ MEDIA] Unhandled rejection:",
      reason
    );
  }
);
