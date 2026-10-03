import pg from "pg";
import env from "./env.js";

const { Pool } = pg;

let pool = null;

if (env.databaseUrl) {
  pool = new Pool({
    connectionString: env.databaseUrl,

    ssl:
      env.nodeEnv === "production"
        ? {
            rejectUnauthorized: false
          }
        : false,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
  });
}

export function isDatabaseConfigured() {
  return Boolean(env.databaseUrl);
}

export async function query(text, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.query(text, params);
}

export async function checkDatabase() {
  if (!pool) {
    return {
      connected: false,
      configured: false,
      databaseName: null,
      message: "Database not configured"
    };
  }

  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        NOW() AS server_time
    `);

    return {
      connected: true,
      configured: true,
      databaseName: result.rows[0]?.database_name || null,
      databaseUser: result.rows[0]?.database_user || null,
      serverTime: result.rows[0]?.server_time || null,
      message: "Database connected"
    };
  } catch (error) {
    return {
      connected: false,
      configured: true,
      databaseName: null,
      message: error.message
    };
  }
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}

export { pool };
