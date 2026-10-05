import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getDatabasePool,
  pingDatabase,
  resetDatabaseForTests,
  withTransaction,
} from '@ez-media/database';

const DATABASE_URL =
  process.env['DATABASE_URL'];

describe(
  'EZ MEDIA PostgreSQL Core',
  () => {
    it(
      'يكتشف إعداد قاعدة البيانات',
      async () => {
        const health =
          await pingDatabase();

        if (!DATABASE_URL) {
          expect(
            health.status,
          ).toBe('disabled');

          return;
        }

        expect(
          ['up', 'down'],
        ).toContain(
          health.status,
        );
      },
    );

    it(
      'ينشئ PostgreSQL connection pool عند توفر DATABASE_URL',
      () => {
        const pool =
          getDatabasePool();

        if (!DATABASE_URL) {
          expect(
            pool,
          ).toBeNull();

          return;
        }

        expect(
          pool,
        ).not.toBeNull();
      },
    );

    it(
      'يتحقق من اتصال PostgreSQL الحقيقي',
      async () => {
        if (!DATABASE_URL) {
          return;
        }

        const health =
          await pingDatabase();

        expect(
          health.status,
        ).toBe('up');

        expect(
          health.database,
        ).toBeTruthy();

        expect(
          health.serverVersion,
        ).toBeTruthy();

        expect(
          health.latencyMs,
        ).toBeGreaterThanOrEqual(
          0,
        );
      },
    );

    it(
      'ينفذ transaction حقيقية',
      async () => {
        if (!DATABASE_URL) {
          return;
        }

        const result =
          await withTransaction(
            async (
              client,
            ) => {
              const response =
                await client.query<{
                  value: number;
                }>(
                  `
                  SELECT
                    1::integer AS value
                  `,
                );

              return response
                .rows[0]
                ?.value;
            },
          );

        expect(
          result,
        ).toBe(1);
      },
    );

    it(
      'يغلق موارد قاعدة البيانات بشكل صحيح',
      async () => {
        await resetDatabaseForTests();

        const pool =
          getDatabasePool();

        expect(
          pool,
        ).toBeNull();
      },
    );
  },
);
