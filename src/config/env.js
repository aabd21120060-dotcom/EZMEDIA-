import pg from "pg";
import { config } from "./env.js";

const { Pool } = pg;

let pool = null;

function createPool() {
  if (pool) {
    return pool;
  }

  if (!config.database.url) {
    console.warn(
      "[AZ MEDIA] DATABASE_URL غير موجودة. سيتم تشغيل التطبيق بدون اتصال بقاعدة البيانات."
    );

    return null;
  }

  pool = new Pool({
    connectionString: config.database.url,

    max: config.database.poolMax,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000,

    allowExitOnIdle: false,

    ssl:
      config.app.isProduction
        ? {
            rejectUnauthorized: false
          }
        : undefined
  });

  pool.on("error", (error) => {
    console.error(
      "[AZ MEDIA] PostgreSQL pool error:",
      error
    );
  });

  return pool;
}

function getPool() {
  return createPool();
}

async function query(text, params = []) {
  const databasePool = getPool();

  if (!databasePool) {
    throw new Error(
      "Database is not configured. DATABASE_URL is missing."
    );
  }

  return databasePool.query(text, params);
}

async function checkDatabase() {
  const databasePool = getPool();

  if (!databasePool) {
    return {
      connected: false,
      databaseName: null,
      message: "Database not configured"
    };
  }

  const result = await databasePool.query(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      NOW() AS server_time,
      version() AS version
  `);

  const row = result.rows[0];

  return {
    connected: true,
    databaseName: row.database_name,
    databaseUser: row.database_user,
    serverTime: row.server_time,
    version: row.version
  };
}

async function closeDatabase() {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = null;

  await currentPool.end();
}

export {
  getPool,
  query,
  checkDatabase,
  closeDatabase
};

export default {
  getPool,
  query,
  checkDatabase,
  closeDatabase
};
