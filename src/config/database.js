import pg from "pg";

import { config } from "./env.js";

const { Pool } = pg;

let pool = null;


/*
|--------------------------------------------------------------------------
| إنشاء اتصال PostgreSQL
|--------------------------------------------------------------------------
*/

function createPool() {

  if (pool) {
    return pool;
  }

  if (!config.database.url) {

    console.warn(
      "[EZ MEDIA] DATABASE_URL غير موجودة."
    );

    return null;
  }


  pool = new Pool({

    connectionString:
      config.database.url,

    max:
      config.database.poolMax,

    idleTimeoutMillis:
      30000,

    connectionTimeoutMillis:
      10000,

    allowExitOnIdle:
      false,

    ssl:
      config.app.isProduction
        ? {
            rejectUnauthorized: false
          }
        : undefined

  });


  pool.on(
    "error",
    (error) => {

      console.error(
        "[EZ MEDIA] PostgreSQL Pool Error:",
        error
      );

    }
  );


  return pool;
}


/*
|--------------------------------------------------------------------------
| الحصول على Pool
|--------------------------------------------------------------------------
*/

function getPool() {

  return createPool();

}


/*
|--------------------------------------------------------------------------
| تنفيذ Query
|--------------------------------------------------------------------------
*/

async function query(
  text,
  params = []
) {

  const databasePool =
    getPool();


  if (!databasePool) {

    throw new Error(
      "DATABASE_URL غير موجودة"
    );

  }


  return databasePool.query(
    text,
    params
  );

}


/*
|--------------------------------------------------------------------------
| فحص قاعدة البيانات
|--------------------------------------------------------------------------
*/

async function checkDatabase() {

  const databasePool =
    getPool();


  if (!databasePool) {

    return {

      connected: false,

      databaseName: null,

      message:
        "Database not configured"

    };

  }


  const result =
    await databasePool.query(`

      SELECT

        current_database()
          AS database_name,

        current_user
          AS database_user,

        NOW()
          AS server_time,

        version()
          AS version

    `);


  const row =
    result.rows[0];


  return {

    connected: true,

    databaseName:
      row.database_name,

    databaseUser:
      row.database_user,

    serverTime:
      row.server_time,

    version:
      row.version

  };

}


/*
|--------------------------------------------------------------------------
| إغلاق قاعدة البيانات
|--------------------------------------------------------------------------
*/

async function closeDatabase() {

  if (!pool) {
    return;
  }


  const currentPool =
    pool;


  pool = null;


  await currentPool.end();

}


/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

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
