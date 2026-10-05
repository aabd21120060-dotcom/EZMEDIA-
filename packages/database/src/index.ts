import pg, {
  type Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

import {
  loadConfig,
} from '@ez-media/config';

export const PACKAGE_NAME =
  '@ez-media/database';

export const PACKAGE_VERSION =
  '1.0.0';

const {
  Pool,
} = pg;

export interface DatabaseConfig {
  readonly connectionString: string;
  readonly maxConnections: number;
  readonly idleTimeoutMs: number;
  readonly connectionTimeoutMs: number;
  readonly ssl: boolean;
}

export interface DatabaseHealth {
  readonly status:
    | 'up'
    | 'down'
    | 'disabled';

  readonly latencyMs?: number;

  readonly message?: string;

  readonly database?: string;

  readonly serverVersion?: string;
}

export interface QueryOptions {
  readonly text: string;
  readonly values?: readonly unknown[];
}

export interface TransactionClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
}

let databasePool:
  | Pool
  | undefined;

let databaseConfig:
  | DatabaseConfig
  | undefined;

export function createDatabaseConfig(
  connectionString: string,
  maxConnections = 10,
  options: {
    readonly idleTimeoutMs?: number;
    readonly connectionTimeoutMs?: number;
    readonly ssl?: boolean;
  } = {},
): DatabaseConfig {
  if (
    !connectionString.trim()
  ) {
    throw new Error(
      'DATABASE_URL is required.',
    );
  }

  if (
    !Number.isInteger(
      maxConnections,
    ) ||
    maxConnections < 1
  ) {
    throw new Error(
      'maxConnections must be a positive integer.',
    );
  }

  const idleTimeoutMs =
    options.idleTimeoutMs ??
    10_000;

  const connectionTimeoutMs =
    options.connectionTimeoutMs ??
    10_000;

  if (
    !Number.isInteger(
      idleTimeoutMs,
    ) ||
    idleTimeoutMs < 0
  ) {
    throw new Error(
      'idleTimeoutMs must be a non-negative integer.',
    );
  }

  if (
    !Number.isInteger(
      connectionTimeoutMs,
    ) ||
    connectionTimeoutMs < 1
  ) {
    throw new Error(
      'connectionTimeoutMs must be a positive integer.',
    );
  }

  return {
    connectionString,
    maxConnections,
    idleTimeoutMs,
    connectionTimeoutMs,
    ssl:
      options.ssl ??
      false,
  };
}

export function createDatabaseFromEnvironment(): DatabaseConfig | null {
  const config =
    loadConfig();

  const connectionString =
    config.environment
      .DATABASE_URL;

  if (
    !connectionString ||
    connectionString.trim() === ''
  ) {
    return null;
  }

  const ssl =
    config.isProduction ||
    connectionString.includes(
      'sslmode=require',
    ) ||
    connectionString.includes(
      'sslmode=verify',
    );

  databaseConfig =
    createDatabaseConfig(
      connectionString,
      config.environment
        .DATABASE_POOL_MAX,
      {
        ssl,
        connectionTimeoutMs:
          config.environment
            .REQUEST_TIMEOUT_MS,
      },
    );

  return databaseConfig;
}

export function getDatabaseConfig():
  | DatabaseConfig
  | null {
  return (
    databaseConfig ??
    createDatabaseFromEnvironment()
  );
}

export function getDatabasePool():
  | Pool
  | null {
  if (databasePool) {
    return databasePool;
  }

  const config =
    getDatabaseConfig();

  if (!config) {
    return null;
  }

  databasePool =
    new Pool({
      connectionString:
        config.connectionString,

      max:
        config.maxConnections,

      idleTimeoutMillis:
        config.idleTimeoutMs,

      connectionTimeoutMillis:
        config.connectionTimeoutMs,

      ssl: config.ssl
        ? {
            rejectUnauthorized:
              false,
          }
        : undefined,
    });

  databasePool.on(
    'error',
    (error) => {
      console.error(
        JSON.stringify({
          event:
            'database_pool_error',

          message:
            error.message,

          timestamp:
            new Date().toISOString(),
        }),
      );
    },
  );

  return databasePool;
}

export async function query<
  T extends QueryResultRow =
    QueryResultRow,
>(
  options: QueryOptions,
): Promise<QueryResult<T>> {
  const pool =
    getDatabasePool();

  if (!pool) {
    throw new Error(
      'Database is not configured.',
    );
  }

  return pool.query<T>(
    options.text,
    options.values
      ? [...options.values]
      : undefined,
  );
}

export async function pingDatabase():
  Promise<DatabaseHealth> {
  const pool =
    getDatabasePool();

  if (!pool) {
    return {
      status: 'disabled',
      message:
        'DATABASE_URL is not configured.',
    };
  }

  const started =
    performance.now();

  try {
    const result =
      await pool.query<{
        database: string;
        server_version: string;
      }>(
        `
        SELECT
          current_database() AS database,
          current_setting('server_version') AS server_version
        `,
      );

    const latencyMs =
      Math.round(
        performance.now() -
          started,
      );

    const row =
      result.rows[0];

    return {
      status: 'up',
      latencyMs,
      database:
        row?.database,
      serverVersion:
        row?.server_version,
    };
  } catch (error) {
    const latencyMs =
      Math.round(
        performance.now() -
          started,
      );

    return {
      status: 'down',
      latencyMs,
      message:
        error instanceof Error
          ? error.message
          : 'Database connection failed.',
    };
  }
}

export async function withTransaction<
  T,
>(
  callback: (
    client: TransactionClient,
  ) => Promise<T>,
): Promise<T> {
  const pool =
    getDatabasePool();

  if (!pool) {
    throw new Error(
      'Database is not configured.',
    );
  }

  const client:
    PoolClient =
    await pool.connect();

  try {
    await client.query(
      'BEGIN',
    );

    const result =
      await callback(client);

    await client.query(
      'COMMIT',
    );

    return result;
  } catch (error) {
    try {
      await client.query(
        'ROLLBACK',
      );
    } catch {
      // لا نخفي الخطأ الأصلي.
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase():
  Promise<void> {
  if (!databasePool) {
    return;
  }

  const pool =
    databasePool;

  databasePool =
    undefined;

  await pool.end();
}

export function resetDatabaseForTests():
  Promise<void> {
  databaseConfig =
    undefined;

  return closeDatabase();
}
