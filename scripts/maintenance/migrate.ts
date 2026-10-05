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
  return filename.replace(
    /\.sql$/i,
    '',
  );
}

function migrationVersion(
  filename: string,
): string {
  const match =
    filename.match(
      /^(\d+)_/,
    );

  if (!match?.[1]) {
    throw new Error(
      `Invalid migration filename: ${filename}`,
    );
  }

  return match[1];
}

async function main(): Promise<void> {
  const pool =
    getDatabasePool();

  if (!pool) {
    throw new Error(
      [
        'DATABASE_URL is not configured.',
        'Configure DATABASE_URL before running database migrations.',
      ].join(' '),
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
          file
            .toLowerCase()
            .endsWith('.sql'),
      )
      .sort();

  if (
    files.length === 0
  ) {
    console.log(
      'No database migrations found.',
    );

    return;
  }

  const client =
    await pool.connect();

  try {
    await client.query(
      'SELECT pg_advisory_lock($1)',
      [731001],
    );

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

    for (
      const file of files
    ) {
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
        migrationVersion(
          file,
        );

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
          name: string;
          checksum: string;
        }>(
          `
          SELECT
            version,
            name,
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

        if (!previous) {
          throw new Error(
            `Unable to read migration record: ${file}`,
          );
        }

        if (
          previous.checksum !==
          hash
        ) {
          throw new Error(
            [
              `Migration checksum changed: ${file}`,
              `Version: ${version}`,
              'The migration was already applied with different contents.',
              'Create a new migration instead of modifying an applied migration.',
            ].join('\n'),
          );
        }

        console.log(
          `Already applied: ${file}`,
        );

        continue;
      }

      console.log(
        `Applying: ${file}`,
      );

      await client.query(
        content,
      );

      await client.query(
        `
        INSERT INTO schema_migrations (
          version,
          name,
          checksum,
          applied_at
        )
        VALUES (
          $1,
          $2,
          $3,
          NOW()
        )
        `,
        [
          version,
          name,
          hash,
        ],
      );

      console.log(
        `Applied: ${file}`,
      );
    }

    await client.query(
      'COMMIT',
    );

    console.log(
      '========================================',
    );

    console.log(
      'EZ MEDIA database migrations completed.',
    );

    console.log(
      '========================================',
    );
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
    try {
      await client.query(
        'SELECT pg_advisory_unlock($1)',
        [731001],
      );
    } catch {
      // لا نخفي خطأ Migration الأصلي.
    }

    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    'Database migration failed.',
  );

  if (
    error instanceof Error
  ) {
    console.error(
      error.message,
    );

    if (error.stack) {
      console.error(
        error.stack,
      );
    }
  } else {
    console.error(
      error,
    );
  }

  process.exitCode = 1;
} finally {
  await closeDatabase();
}
