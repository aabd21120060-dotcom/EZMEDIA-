import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  pool
} from "../config/database.js";


/*
|--------------------------------------------------------------------------
| Paths
|--------------------------------------------------------------------------
*/

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const projectRoot =
  path.resolve(
    __dirname,
    "../.."
  );

const migrationsDirectory =
  path.join(
    projectRoot,
    "database",
    "migrations"
  );


/*
|--------------------------------------------------------------------------
| Migration Registry
|--------------------------------------------------------------------------
*/

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGSERIAL PRIMARY KEY,

    version VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,

    checksum VARCHAR(128),

    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;


/*
|--------------------------------------------------------------------------
| Migration File Parser
|--------------------------------------------------------------------------
*/

function parseMigrationFilename(
  filename
) {
  const match =
    filename.match(
      /^(\d+)_([a-zA-Z0-9_-]+)\.sql$/
    );

  if (!match) {
    return null;
  }

  return {
    version: match[1],
    name: match[2],
    filename
  };
}


/*
|--------------------------------------------------------------------------
| Read Migration Files
|--------------------------------------------------------------------------
*/

async function getMigrationFiles() {
  const files =
    await fs.readdir(
      migrationsDirectory,
      {
        withFileTypes: true
      }
    );

  return files
    .filter(
      (entry) =>
        entry.isFile()
    )
    .map(
      (entry) =>
        parseMigrationFilename(
          entry.name
        )
    )
    .filter(Boolean)
    .sort(
      (a, b) =>
        Number(a.version) -
        Number(b.version)
    );
}


/*
|--------------------------------------------------------------------------
| File Checksum
|--------------------------------------------------------------------------
*/

async function getFileChecksum(
  filePath
) {
  const crypto =
    await import(
      "node:crypto"
    );

  const content =
    await fs.readFile(
      filePath
    );

  return crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");
}


/*
|--------------------------------------------------------------------------
| Ensure Registry
|--------------------------------------------------------------------------
*/

async function ensureMigrationRegistry(
  client
) {
  await client.query(
    CREATE_MIGRATIONS_TABLE
  );
}


/*
|--------------------------------------------------------------------------
| Get Applied Migrations
|--------------------------------------------------------------------------
*/

async function getAppliedMigrations(
  client
) {
  const result =
    await client.query(`
      SELECT
        version,
        name,
        checksum,
        applied_at
      FROM schema_migrations
      ORDER BY version ASC
    `);

  return result.rows;
}


/*
|--------------------------------------------------------------------------
| Validate Migration Integrity
|--------------------------------------------------------------------------
*/

function validateMigrationIntegrity(
  appliedMigrations,
  migrationFiles
) {
  const fileMap =
    new Map(
      migrationFiles.map(
        (migration) => [
          migration.version,
          migration
        ]
      )
    );

  for (
    const applied
    of appliedMigrations
  ) {
    const file =
      fileMap.get(
        applied.version
      );

    if (!file) {
      throw new Error(
        `Migration ${applied.version} is recorded in the database but its file is missing`
      );
    }
  }
}


/*
|--------------------------------------------------------------------------
| Apply Migration
|--------------------------------------------------------------------------
*/

async function applyMigration(
  client,
  migration
) {
  const filePath =
    path.join(
      migrationsDirectory,
      migration.filename
    );

  const sql =
    await fs.readFile(
      filePath,
      "utf8"
    );

  if (
    !sql.trim()
  ) {
    throw new Error(
      `Migration file is empty: ${migration.filename}`
    );
  }

  const checksum =
    await getFileChecksum(
      filePath
    );


  /*
  |--------------------------------------------------------------------------
  | Migration Transaction
  |--------------------------------------------------------------------------
  */

  await client.query(
    "BEGIN"
  );

  try {

    /*
    |--------------------------------------------------------------------------
    | Execute SQL
    |--------------------------------------------------------------------------
    */

    await client.query(
      sql
    );


    /*
    |--------------------------------------------------------------------------
    | Register Migration
    |--------------------------------------------------------------------------
    */

    await client.query(
      `
      INSERT INTO schema_migrations (
        version,
        name,
        checksum
      )
      VALUES (
        $1,
        $2,
        $3
      )
      `,
      [
        migration.version,
        migration.name,
        checksum
      ]
    );


    /*
    |--------------------------------------------------------------------------
    | Commit
    |--------------------------------------------------------------------------
    */

    await client.query(
      "COMMIT"
    );

    return {
      version:
        migration.version,

      name:
        migration.name,

      checksum
    };

  } catch (error) {

    /*
    |--------------------------------------------------------------------------
    | Rollback
    |--------------------------------------------------------------------------
    */

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (
      rollbackError
    ) {
      console.error(
        "[AZ MEDIA] Migration rollback failed:",
        rollbackError
      );
    }

    throw error;
  }
}


/*
|--------------------------------------------------------------------------
| Migration Runner
|--------------------------------------------------------------------------
*/

export async function runMigrations() {
  const client =
    await pool.connect();

  try {

    /*
    |--------------------------------------------------------------------------
    | Migration Registry
    |--------------------------------------------------------------------------
    */

    await client.query(
      "BEGIN"
    );

    try {

      await ensureMigrationRegistry(
        client
      );

      await client.query(
        "COMMIT"
      );

    } catch (error) {

      await client.query(
        "ROLLBACK"
      );

      throw error;
    }


    /*
    |--------------------------------------------------------------------------
    | Migration Files
    |--------------------------------------------------------------------------
    */

    const migrationFiles =
      await getMigrationFiles();


    /*
    |--------------------------------------------------------------------------
    | No Migrations
    |--------------------------------------------------------------------------
    */

    if (
      migrationFiles.length === 0
    ) {
      return {
        applied: [],
        pending: [],
        message:
          "No migration files found"
      };
    }


    /*
    |--------------------------------------------------------------------------
    | Applied Migrations
    |--------------------------------------------------------------------------
    */

    const appliedMigrations =
      await getAppliedMigrations(
        client
      );


    /*
    |--------------------------------------------------------------------------
    | Integrity
    |--------------------------------------------------------------------------
    */

    validateMigrationIntegrity(
      appliedMigrations,
      migrationFiles
    );


    /*
    |--------------------------------------------------------------------------
    | Applied Map
    |--------------------------------------------------------------------------
    */

    const appliedMap =
      new Map(
        appliedMigrations.map(
          (migration) => [
            migration.version,
            migration
          ]
        )
      );


    /*
    |--------------------------------------------------------------------------
    | Pending
    |--------------------------------------------------------------------------
    */

    const pendingMigrations =
      migrationFiles.filter(
        (migration) =>
          !appliedMap.has(
            migration.version
          )
      );


    /*
    |--------------------------------------------------------------------------
    | Apply Pending
    |--------------------------------------------------------------------------
    */

    const applied = [];

    for (
      const migration
      of pendingMigrations
    ) {
      console.log(
        `[AZ MEDIA] Applying migration ${migration.version}_${migration.name}`
      );

      const result =
        await applyMigration(
          client,
          migration
        );

      applied.push(
        result
      );

      console.log(
        `[AZ MEDIA] Migration ${migration.version} applied`
      );
    }


    /*
    |--------------------------------------------------------------------------
    | Return Result
    |--------------------------------------------------------------------------
    */

    return {
      applied,

      pending:
        pendingMigrations
          .slice(
            applied.length
          )
          .map(
            (migration) => ({
              version:
                migration.version,

              name:
                migration.name
            })
          ),

      total:
        migrationFiles.length
    };

  } finally {
    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| Migration Status
|--------------------------------------------------------------------------
*/

export async function getMigrationStatus() {
  const client =
    await pool.connect();

  try {

    await client.query(
      "BEGIN"
    );

    try {

      await ensureMigrationRegistry(
        client
      );

      await client.query(
        "COMMIT"
      );

    } catch (error) {

      await client.query(
        "ROLLBACK"
      );

      throw error;
    }


    const migrationFiles =
      await getMigrationFiles();

    const appliedMigrations =
      await getAppliedMigrations(
        client
      );

    const appliedMap =
      new Map(
        appliedMigrations.map(
          (migration) => [
            migration.version,
            migration
          ]
        )
      );

    const status =
      migrationFiles.map(
        (migration) => ({
          version:
            migration.version,

          name:
            migration.name,

          status:
            appliedMap.has(
              migration.version
            )
              ? "applied"
              : "pending",

          appliedAt:
            appliedMap.get(
              migration.version
            )?.applied_at ?? null
        })
      );


    return {
      total:
        migrationFiles.length,

      applied:
        status.filter(
          (migration) =>
            migration.status ===
            "applied"
        ).length,

      pending:
        status.filter(
          (migration) =>
            migration.status ===
            "pending"
        ).length,

      migrations:
        status
    };

  } finally {
    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| CLI
|--------------------------------------------------------------------------
*/

if (
 process.argv[1] &&
  path.resolve(
    process.argv[1]
  ) === __filename
) {
  try {

    console.log(
      "[AZ MEDIA] Starting database migrations..."
    );

    const result =
      await runMigrations();

    console.log(
      "[AZ MEDIA] Migration result:",
      result
    );

    console.log(
      "[AZ MEDIA] Database migrations completed"
    );

  } catch (error) {

    console.error(
      "[AZ MEDIA] Database migration failed:"
    );

    console.error(
      error
    );

    process.exit(1);
  }
}


/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

export {
  migrationsDirectory
};
import pg from "pg";

import { config } from "./env.js";

const { Pool } = pg;


/*
|--------------------------------------------------------------------------
| Database Configuration
|--------------------------------------------------------------------------
*/

if (!config.database.url) {
  throw new Error(
    "DATABASE_URL is required"
  );
}


const pool = new Pool({
  connectionString:
    config.database.url,

  max:
    config.database.poolMax,

  min: 0,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,

  allowExitOnIdle:
    config.app.isTest,

  application_name:
    `${config.app.name}/${config.app.version}`,

  keepAlive: true,

  ssl:
    config.app.isProduction
      ? {
          rejectUnauthorized: false
        }
      : false
});


/*
|--------------------------------------------------------------------------
| Pool Error
|--------------------------------------------------------------------------
*/

pool.on(
  "error",
  (error) => {
    console.error(
      "[DATABASE_POOL_ERROR]",
      error
    );
  }
);


/*
|--------------------------------------------------------------------------
| Database Query
|--------------------------------------------------------------------------
*/

export async function query(
  text,
  params = []
) {
  return pool.query(
    text,
    params
  );
}


/*
|--------------------------------------------------------------------------
| Database Transaction
|--------------------------------------------------------------------------
|
| مهم:
| جميع الاستعلامات داخل transaction
| يجب أن تستخدم client وليس pool.
|
*/

export async function transaction(
  callback
) {
  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const result =
      await callback(client);

    await client.query(
      "COMMIT"
    );

    return result;

  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (
      rollbackError
    ) {
      console.error(
        "[DATABASE_ROLLBACK_ERROR]",
        rollbackError
      );
    }

    throw error;

  } finally {
    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| Database Health Check
|--------------------------------------------------------------------------
*/

export async function checkDatabase() {
  const result =
    await pool.query(`
      SELECT
        NOW() AS database_time,
        current_database() AS database_name,
        current_user AS database_user
    `);

  return {
    connected: true,

    databaseTime:
      result.rows[0]
        .database_time,

    databaseName:
      result.rows[0]
        .database_name,

    databaseUser:
      result.rows[0]
        .database_user
  };
}


/*
|--------------------------------------------------------------------------
| Pool Statistics
|--------------------------------------------------------------------------
*/

export function getDatabasePoolStats() {
  return {
    total:
      pool.totalCount,

    idle:
      pool.idleCount,

    waiting:
      pool.waitingCount
  };
}


/*
|--------------------------------------------------------------------------
| Close Database
|--------------------------------------------------------------------------
*/

export async function closeDatabase() {
  await pool.end();
}


/*
|--------------------------------------------------------------------------
| Export Pool
|--------------------------------------------------------------------------
*/

export {
  pool
};
