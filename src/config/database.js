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
