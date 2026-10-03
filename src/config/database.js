import pg from "pg";

const { Pool } = pg;

const connectionString = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ""
).trim();

let pool = null;

if (connectionString) {
  try {
    pool = new Pool({
      connectionString,

      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,

      max: Number(
        process.env.PG_POOL_MAX || 10
      ),

      idleTimeoutMillis: 30000,

      connectionTimeoutMillis: 10000
    });

    pool.on("error", (error) => {
      console.error(
        "[EZ MEDIA] PostgreSQL pool error:",
        error.message
      );
    });
  } catch (error) {
    console.error(
      "[EZ MEDIA] PostgreSQL initialization error:",
      error.message
    );

    pool = null;
  }
}

export function isDatabaseConfigured() {
  return Boolean(connectionString);
}

export function isDatabaseReady() {
  return Boolean(pool);
}

export async function query(
  text,
  params = []
) {
  if (!pool) {
    throw new Error(
      "EZ MEDIA database is not configured"
    );
  }

  return pool.query(text, params);
}

export async function checkDatabase() {
  if (!connectionString) {
    return {
      configured: false,
      ready: false,
      databaseName: null,
      message:
        "DATABASE_URL is not configured"
    };
  }

  if (!pool) {
    return {
      configured: true,
      ready: false,
      databaseName: null,
      message:
        "PostgreSQL pool is not available"
    };
  }

  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        NOW() AS server_time
    `);

    return {
      configured: true,
      ready: true,
      databaseName:
        result.rows[0]?.database_name || null,
      serverTime:
        result.rows[0]?.server_time || null,
      message:
        "PostgreSQL connection is ready"
    };
  } catch (error) {
    return {
      configured: true,
      ready: false,
      databaseName: null,
      message: error.message
    };
  }
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
