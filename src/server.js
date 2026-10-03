app.get("/health", async (req, res) => {
  res.status(200).json({
    platform: "EZ MEDIA",
    version: "11.0.0",
    build: "POSTGRES-HEALTH-CHECK-2026-10-03",
    status: "health-route-active",
    database: {
      configured: Boolean(process.env.DATABASE_URL),
      ready: false
    },
    timestamp: new Date().toISOString()
  });
});
