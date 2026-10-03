import pg from "pg";

const { Pool } = pg;

function getDatabaseConfig() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "";

  if (!connectionString) {
    return null;
  }

  return {
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

const config = getDatabaseConfig();

export const pool = config
  ? new Pool(config)
  : null;

export function isDatabaseConfigured() {
  return Boolean(pool);
}

export async function query(text, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.query(text, params);
}

export async function transaction(callback) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  if (!pool) {
    return {
      configured: false,
      ready: false,
      message: "DATABASE_URL is not configured",
    };
  }

  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        NOW() AS server_time
    `);

    return {
      configured: true,
      ready: true,
      database: result.rows[0].database,
      user: result.rows[0].user,
      serverTime: result.rows[0].server_time,
    };
  } catch (error) {
    return {
      configured: true,
      ready: false,
      message: error.message,
    };
  }
}
