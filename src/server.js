import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  max: Number(process.env.DB_POOL_MAX || 20),

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 10000,

  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false
        }
      : false
});

pool.on("error", (error) => {
  console.error("[DATABASE]", error);
});


/**
 * استعلام عادي.
 *
 * لا يستخدم Tenant Context.
 * يستخدم فقط للاستعلامات التي لا تعتمد على RLS
 * أو للاستعلامات التي يتم فيها تمرير organization_id
 * صراحةً داخل SQL.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}


/**
 * Transaction عادية.
 */
export async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[DATABASE_ROLLBACK]",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}


/**
 * Transaction مع Tenant Context.
 *
 * جميع الاستعلامات التي يتم تنفيذها داخل callback
 * تستخدم نفس PostgreSQL connection ونفس transaction.
 *
 * هذا مهم جدًا مع Row-Level Security.
 */
export async function tenantTransaction(
  organizationId,
  userId,
  callback
) {
  if (!organizationId) {
    throw new Error(
      "organizationId is required for tenant transaction"
    );
  }

  if (!userId) {
    throw new Error(
      "userId is required for tenant transaction"
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      SELECT set_config(
        'app.organization_id',
        $1,
        true
      )
      `,
      [organizationId]
    );

    await client.query(
      `
      SELECT set_config(
        'app.user_id',
        $1,
        true
      )
      `,
      [userId]
    );

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[TENANT_ROLLBACK]",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}


/**
 * تنفيذ استعلام واحد داخل Tenant Context.
 */
export async function tenantQuery(
  organizationId,
  userId,
  text,
  params = []
) {
  return tenantTransaction(
    organizationId,
    userId,
    async (client) => {
      return client.query(text, params);
    }
  );
}


/**
 * فحص اتصال قاعدة البيانات.
 */
export async function checkDatabase() {
  const result = await pool.query(
    "SELECT NOW() AS now"
  );

  return {
    connected: true,
    time: result.rows[0].now
  };
}


/**
 * إغلاق Pool.
 */
export async function closeDatabase() {
  await pool.end();
}
