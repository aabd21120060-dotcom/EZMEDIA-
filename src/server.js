import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT || 3000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/*
|--------------------------------------------------------------------------
| Platform
|--------------------------------------------------------------------------
*/

const PLATFORM = {
  name: "AZ MEDIA",
  repository: "EZMEDIA-",
  version: "11.0.0"
};

/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

async function databaseHealth() {
  try {
    await pool.query("SELECT 1");
    return "connected";
  } catch (error) {
    console.error("Database error:", error.message);
    return "error";
  }
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get("/health", async (req, res) => {
  const database = await databaseHealth();

  res.json({
    success: database === "connected",
    platform: PLATFORM.name,
    version: PLATFORM.version,
    status: "online",
    database,
    timestamp: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  res.json({
    success: true,
    platform: PLATFORM.name,
    version: PLATFORM.version,
    api: "v1",
    modules: [
      "auth",
      "users",
      "organizations",
      "newsroom",
      "media",
      "production",
      "design",
      "audio",
      "live",
      "social",
      "ai",
      "agents",
      "automation",
      "ads",
      "sponsorship",
      "crm",
      "commerce",
      "analytics"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

app.get("/api/v1/dashboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM articles) AS articles,
        (SELECT COUNT(*) FROM media_assets) AS media_assets,
        (SELECT COUNT(*) FROM ai_agents) AS ai_agents,
        (SELECT COUNT(*) FROM automation_workflows) AS workflows,
        (SELECT COUNT(*) FROM production_projects) AS production_projects
    `);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "dashboard_database_error"
    });
  }
});

/*
|--------------------------------------------------------------------------
| Articles
|--------------------------------------------------------------------------
*/

app.get("/api/v1/articles", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        organization_id,
        title,
        slug,
        content,
        status,
        author_id,
        published_at,
        created_at,
        updated_at
      FROM articles
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "articles_database_error"
    });
  }
});

app.post("/api/v1/articles", async (req, res) => {
  const {
    organization_id,
    title,
    slug,
    content = "",
    status = "draft",
    author_id = null
  } = req.body;

  if (!organization_id || !title) {
    return res.status(400).json({
      success: false,
      error: "organization_id_and_title_required"
    });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO articles
      (
        organization_id,
        title,
        slug,
        content,
        status,
        author_id
      )
      VALUES
      ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        organization_id,
        title,
        slug || null,
        content,
        status,
        author_id
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "article_create_failed"
    });
  }
});

/*
|--------------------------------------------------------------------------
| Media
|--------------------------------------------------------------------------
*/

app.get("/api/v1/media", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM media_assets
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch {
    res.status(500).json({
      success: false,
      error: "media_database_error"
    });
  }
});

/*
|--------------------------------------------------------------------------
| AI Agents
|--------------------------------------------------------------------------
*/

app.get("/api/v1/ai/agents", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        role,
        description,
        autonomy_level,
        status,
        created_at
      FROM ai_agents
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch {
    res.status(500).json({
      success: false,
      error: "agents_database_error"
    });
  }
});

/*
|--------------------------------------------------------------------------
| Automation
|--------------------------------------------------------------------------
*/

app.get(
  "/api/v1/automation/workflows",
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM automation_workflows
        ORDER BY created_at DESC
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch {
      res.status(500).json({
        success: false,
        error: "automation_database_error"
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Production
|--------------------------------------------------------------------------
*/

app.get(
  "/api/v1/production/projects",
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM production_projects
        ORDER BY created_at DESC
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch {
      res.status(500).json({
        success: false,
        error: "production_database_error"
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Social
|--------------------------------------------------------------------------
*/

app.get("/api/v1/social/posts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM social_posts
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch {
    res.status(500).json({
      success: false,
      error: "social_database_error"
    });
  }
});

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    success: false,
    error: "internal_server_error"
  });
});

/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("=================================");
  console.log("AZ MEDIA 11.0");
  console.log("=================================");
  console.log(`PORT: ${PORT}`);
  console.log("API: /api");
  console.log("HEALTH: /health");
  console.log("=================================");
});
