import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "EZ MEDIA MIGRATION ERROR: DATABASE_URL is not configured."
  );

  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false
        }
      : false
});

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getMigrationFiles() {
  const migrationsDirectory = path.resolve(
    process.cwd(),
    "database",
    "migrations"
  );

  const files = await fs.readdir(
    migrationsDirectory
  );

  return files
    .filter((file) =>
      file.endsWith(".sql")
    )
    .sort();
}

async function getAppliedMigrations() {
  const result = await client.query(`
    SELECT version
    FROM schema_migrations
    ORDER BY version ASC
  `);

  return new Set(
    result.rows.map(
      (row) => row.version
    )
  );
}

function migrationVersion(filename) {
  return filename
    .replace(/\.sql$/i, "");
}

async function runMigration(
  filename
) {
  const migrationsDirectory = path.resolve(
    process.cwd(),
    "database",
    "migrations"
  );

  const filePath = path.join(
    migrationsDirectory,
    filename
  );

  const sql = await fs.readFile(
    filePath,
    "utf8"
  );

  const version =
    migrationVersion(filename);

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

    console.log(
      `Migration completed: ${version}`
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      `Migration failed: ${version}`
    );

    throw error;
  }
}

async function main() {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "       EZ MEDIA DATABASE MIGRATOR"
  );
  console.log(
    "========================================"
  );

  await client.connect();

  console.log(
    "Database connection: OK"
  );

  await ensureMigrationsTable();

  const files =
    await getMigrationFiles();

  const applied =
    await getAppliedMigrations();

  let executed = 0;

  for (const filename of files) {
    const version =
      migrationVersion(filename);

    if (applied.has(version)) {
      console.log(
        `Already applied: ${version}`
      );

      continue;
    }

    await runMigration(filename);

    executed += 1;
  }

  console.log("");
  console.log(
    `Migrations executed: ${executed}`
  );

  console.log(
    "EZ MEDIA DATABASE MIGRATION COMPLETE"
  );

  console.log(
    "========================================"
  );
  console.log("");
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "EZ MEDIA DATABASE MIGRATION ERROR:"
    );
    console.error(error);
    console.error("");

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {
      // Ignore connection close errors.
    }
  });
