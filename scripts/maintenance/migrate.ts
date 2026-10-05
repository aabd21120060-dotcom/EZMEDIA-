import type {
  FastifyInstance,
} from 'fastify';

import {
  loadConfig,
} from '@ez-media/config';

import {
  pingDatabase,
} from '@ez-media/database';

const SERVICE_NAME =
  '@ez-media/api';

const SERVICE_VERSION =
  '1.0.0';

export async function registerHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/health',
    {
      logLevel: 'warn',
    },
    async () => {
      return {
        status: 'ok',
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        timestamp:
          new Date().toISOString(),
        uptimeSeconds:
          process.uptime(),
      };
    },
  );

  app.get(
    '/ready',
    {
      logLevel: 'warn',
    },
    async (
      _request,
      reply,
    ) => {
      const config =
        loadConfig();

      const database =
        await pingDatabase();

      const application = {
        status: 'up' as const,
      };

      const checks = {
        application,
        database,
      };

      const ready =
        database.status !== 'down';

      return reply
        .code(
          ready
            ? 200
            : 503,
        )
        .send({
          status:
            ready
              ? 'ready'
              : 'not_ready',

          service:
            SERVICE_NAME,

          version:
            SERVICE_VERSION,

          timestamp:
            new Date().toISOString(),

          checks,

          environment:
            config.environment
              .NODE_ENV,
        });
    },
  );
}
