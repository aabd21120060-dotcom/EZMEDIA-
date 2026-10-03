import pg from "pg";

const { Pool } = pg;

let pool = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ""
  ).trim();
}

const databaseUrl = getDatabaseUrl();

if (databaseUrl) {
  try {
    pool = new Pool({
      connectionString: databaseUrl,

      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,

      max: Number(process.env.PG_POOL_MAX || 5),

      idleTimeoutMillis: 30000,

      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (error) => {
      console.error(
        "[EZ MEDIA] PostgreSQL pool error:",
        error.message
      );
    });
  } catch (error) {
    console.error(
      "[EZ MEDIA] PostgreSQL initialization failed:",
      error.message
    );

    pool = null;
  }
}

export function isDatabaseConfigured() {
  return Boolean(databaseUrl);
}

export function isDatabaseReady() {
  return Boolean(pool);
}

export async function query(text, params = []) {
  if (!pool) {
    throw new Error(
      "EZ MEDIA database is not configured"
    );
  }

  return pool.query(text, params);
}

export async function transaction(callback) {
  if (!pool) {
    throw new Error(
      "EZ MEDIA database is not configured"
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // تجاهل خطأ rollback
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  if (!databaseUrl) {
    return {
      configured: false,
      ready: false,
      database: null,
      message: "DATABASE_URL is not configured",
    };
  }

  if (!pool) {
    return {
      configured: true,
      ready: false,
      database: null,
      message: "PostgreSQL pool could not be initialized",
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
      database: null,
      message: error.message,
    };
  }
}
