import {
  closeDatabase,
  getDatabasePool,
} from '@ez-media/database';

import {
  readdir,
  readFile,
} from 'node:fs/promises';

import {
  createHash,
} from 'node:crypto';

import {
  join,
} from 'node:path';

const ROOT =
  process.cwd();

const MIGRATIONS_DIR =
  join(
    ROOT,
    'database',
    'migrations',
  );

function checksum(
  content: string,
): string {
  return createHash(
    'sha256',
  )
    .update(content)
    .digest('hex');
}

function migrationName(
  filename: string,
): string {
  return filename
    .replace(/\.sql$/i, '');
}

async function main(): Promise<void> {
  const pool =
    getDatabasePool();

  if (!pool) {
    throw new Error(
      'DATABASE_URL is not configured.',
    );
  }

  const files =
    (
      await readdir(
        MIGRATIONS_DIR,
      )
    )
      .filter(
        (file) =>
          file.endsWith(
            '.sql',
          ),
      )
      .sort();

  if (
    files.length === 0
  ) {
    console.log(
      'No migrations found.',
    );

    return;
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      'BEGIN',
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        checksum VARCHAR(128) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const path =
        join(
          MIGRATIONS_DIR,
          file,
        );

      const content =
        await readFile(
          path,
          'utf8',
        );

      const version =
        file.split('_')[0];

      const name =
        migrationName(
          file,
        );

      const hash =
        checksum(
          content,
        );

      const existing =
        await client.query<{
          version: string;
          checksum: string;
        }>(
          `
          SELECT
            version,
            checksum
          FROM schema_migrations
          WHERE version = $1
          `,
          [version],
        );

      if (
        existing.rowCount &&
        existing.rowCount > 0
      ) {
        const previous =
          existing.rows[0];

        if (
          previous?.checksum !==
          hash
        ) {
          throw new Error(
            `Migration checksum changed: ${file}`,
          );
        }

        console.log(
          `⏭️ Already applied: ${file}`,
        );

        continue;
      }

      console.log(
        `▶️ Applying: ${file}`,
      );

      await client.query(
        content,
      );

      await client.query(
        `
        INSERT INTO schema_migrations (
          version,
          name,
          checksum
        )
        VALUES (
          $1,
          $2,
          $3
        )
        `,
        [
          version,
          name,
          hash,
        ],
      );

      console.log(
        `✅ Applied: ${file}`,
      );
    }

    await client.query(
      'COMMIT',
    );

    console.log(
      '✅ Database migrations completed.',
    );
  } catch (error) {
    await client.query(
      'ROLLBACK',
    );

    throw error;
  } finally {
    client.release();
  }
}

try {
  await main();
} finally {
  await closeDatabase();
}
