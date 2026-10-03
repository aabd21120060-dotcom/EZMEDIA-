app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/content", contentRoutes);

app.get("/api/system/database", async (req, res) => {
  try {
    const database = await databaseHealth();

    return res.json({
      success: true,
      database
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      database: {
        configured: Boolean(process.env.DATABASE_URL),
        connected: false,
        error: error.message
      }
    });
  }
});
