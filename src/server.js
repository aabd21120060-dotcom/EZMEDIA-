import app from "./app.js";
import env from "./config/env.js";
import {
  checkDatabase,
  closeDatabase
} from "./config/database.js";

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

/*
 * ==========================================
 * EZ MEDIA 11.0
 * SERVER + DATABASE BOOTSTRAP
 * ==========================================
 */

let server = null;

/*
 * ==========================================
 * DATABASE MIGRATIONS
 * ==========================================
 */

async function runMigrations() {
  if (!env.databaseUrl) {
    console.log(
      "Database migrations skipped: DATABASE_URL is not configured."
    );

    return {
      configured: false,
      executed: 0
    };
  }

  const client = new Client({
    connectionString: env.databaseUrl,

    ssl:
      env.nodeEnv === "production"
        ? {
            rejectUnauthorized: false
          }
        : false
  });

  try {
    await client.connect();

    console.log(
      "Database migration connection: OK"
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDirectory =
      path.resolve(
        process.cwd(),
        "database",
        "migrations"
      );

    let files = [];

    try {
      files = await fs.readdir(
        migrationsDirectory
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(
          "No migrations directory found."
        );

        return {
          configured: true,
          executed: 0
        };
      }

      throw error;
    }

    const migrationFiles = files
      .filter((file) =>
        file.endsWith(".sql")
      )
      .sort();

    const appliedResult =
      await client.query(`
        SELECT version
        FROM schema_migrations
        ORDER BY version ASC
      `);

    const applied =
      new Set(
        appliedResult.rows.map(
          (row) => row.version
        )
      );

    let executed = 0;

    for (const filename of migrationFiles) {
      const version =
        filename.replace(
          /\.sql$/i,
          ""
        );

      if (applied.has(version)) {
        console.log(
          `Migration already applied: ${version}`
        );

        continue;
      }

      const filePath =
        path.join(
          migrationsDirectory,
          filename
        );

      const sql =
        await fs.readFile(
          filePath,
          "utf8"
        );

      console.log(
        `Running migration: ${version}`
      );

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          `
          INSERT INTO schema_migrations
          (
            version,
            applied_at
          )
          VALUES
          ($1, NOW())
          ON CONFLICT (version)
          DO NOTHING
          `,
          [version]
        );

        await client.query("COMMIT");

        executed += 1;

        console.log(
          `Migration completed: ${version}`
        );
      } catch (error) {
        await client.query(
          "ROLLBACK"
        );

        console.error(
          `Migration failed: ${version}`
        );

        throw error;
      }
    }

    return {
      configured: true,
      executed
    };
  } finally {
    await client.end();
  }
}

/*
 * ==========================================
 * START SERVER
 * ==========================================
 */

async function startServer() {
  try {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "          EZ MEDIA 11.0"
    );
    console.log(
      "========================================"
    );

    console.log(
      `Environment: ${env.nodeEnv}`
    );

    console.log(
      `Port: ${env.port}`
    );

    console.log(
      `Node: ${process.version}`
    );

    /*
     * --------------------------------------
     * DATABASE MIGRATIONS
     * --------------------------------------
     */

    const migrationResult =
      await runMigrations();

    console.log(
      "Migrations:",
      migrationResult.configured
        ? `${migrationResult.executed} executed`
        : "SKIPPED"
    );

    /*
     * --------------------------------------
     * SERVER
     * --------------------------------------
     */

    server = app.listen(
      env.port,
      "0.0.0.0",
      async () => {
        console.log(
          "Server: ONLINE"
        );

        /*
         * ----------------------------------
         * DATABASE STATUS
         * ----------------------------------
         */

        const database =
          await checkDatabase();

        console.log(
          "Database:",
          database.connected
            ? "CONNECTED"
            : database.configured
              ? "CONFIGURED BUT NOT CONNECTED"
              : "NOT CONFIGURED"
        );

        if (
          database.databaseName
        ) {
          console.log(
            "Database Name:",
            database.databaseName
          );
        }

        if (
          database.databaseUser
        ) {
          console.log(
            "Database User:",
            database.databaseUser
          );
        }

        console.log(
          "========================================"
        );

        console.log("");
      }
    );

    server.on(
      "error",
      (error) => {
        console.error(
          "EZ MEDIA SERVER ERROR:",
          error
        );

        process.exit(1);
      }
    );
  } catch (error) {
    console.error("");
    console.error(
      "========================================"
    );

    console.error(
      "EZ MEDIA STARTUP ERROR"
    );

    console.error(
      "========================================"
    );

    console.error(error);

    console.error("");

    process.exit(1);
  }
}

/*
 * ==========================================
 * GRACEFUL SHUTDOWN
 * ==========================================
 */

async function shutdown(signal) {
  console.log(
    `\nReceived ${signal}.`
  );

  console.log(
    "Shutting down EZ MEDIA..."
  );

  if (!server) {
    try {
      await closeDatabase();
    } catch (error) {
      console.error(
        "Database shutdown error:",
        error
      );
    }

    process.exit(0);
  }

  server.close(
    async () => {
      try {
        await closeDatabase();

        console.log(
          "EZ MEDIA shutdown completed."
        );

        process.exit(0);
      } catch (error) {
        console.error(
          "Shutdown error:",
          error
        );

        process.exit(1);
      }
    }
  );

  setTimeout(
    () => {
      console.error(
        "Forced shutdown after timeout."
      );

      process.exit(1);
    },
    10000
  ).unref();
}

/*
 * ==========================================
 * PROCESS SIGNALS
 * ==========================================
 */

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

/*
 * ==========================================
 * ERROR HANDLING
 * ==========================================
 */

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled Promise Rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

/*
 * ==========================================
 * BOOT
 * ==========================================
 */

startServer();
