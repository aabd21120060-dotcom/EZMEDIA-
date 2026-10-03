"use strict";

const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (
    !process.env.DATABASE_URL
  ) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL,

      ssl:
        process.env.NODE_ENV ===
        "production"
          ? {
              rejectUnauthorized:
                false
            }
          : false,

      max: 10,

      idleTimeoutMillis:
        30000,

      connectionTimeoutMillis:
        10000
    });

    pool.on(
      "error",
      (error) => {
        console.error(
          "PostgreSQL pool error:",
          error
        );
      }
    );
  }

  return pool;
}

async function query(
  text,
  params = []
) {
  const database =
    getPool();

  if (!database) {
    const error =
      new Error(
        "DATABASE_URL is not configured"
      );

    error.code =
      "DATABASE_NOT_CONFIGURED";

    throw error;
  }

  return database.query(
    text,
    params
  );
}

async function health() {
  const database =
    getPool();

  if (!database) {
    return {
      configured: false,

      connected: false
    };
  }

  const result =
    await database.query(`
      SELECT
        current_database()
          AS database_name,

        NOW()
          AS server_time
    `);

  return {
    configured: true,

    connected: true,

    databaseName:
      result.rows[0]
        .database_name,

    serverTime:
      result.rows[0]
        .server_time
  };
}

module.exports = {
  getPool,
  query,
  health
};
