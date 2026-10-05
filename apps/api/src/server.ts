import {
  loadConfig,
} from '@ez-media/config';

import {
  closeDatabase,
} from '@ez-media/database';

import {
  buildApp,
} from './app.js';

const config =
  loadConfig();

const HOST =
  config.environment.HOST;

const PORT =
  config.environment.PORT;

const app =
  buildApp();

let shuttingDown =
  false;

async function shutdown(
  signal: string,
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown =
    true;

  app.log.info(
    {
      signal,
    },
    'EZ MEDIA API shutdown requested',
  );

  try {
    await app.close();

    await closeDatabase();

    app.log.info(
      'EZ MEDIA API shutdown completed',
    );

    process.exit(0);
  } catch (error) {
    app.log.error(
      {
        error,
      },
      'EZ MEDIA API shutdown failed',
    );

    process.exit(1);
  }
}

process.once(
  'SIGTERM',
  () => {
    void shutdown(
      'SIGTERM',
    );
  },
);

process.once(
  'SIGINT',
  () => {
    void shutdown(
      'SIGINT',
    );
  },
);

try {
  await app.listen({
    host: HOST,
    port: PORT,
  });

  app.log.info(
    {
      host: HOST,
      port: PORT,
      environment:
        config.environment
          .NODE_ENV,
    },
    'EZ MEDIA API started',
  );
} catch (error) {
  app.log.error(
    {
      error,
    },
    'EZ MEDIA API failed to start',
  );

  await closeDatabase();

  process.exit(1);
}
