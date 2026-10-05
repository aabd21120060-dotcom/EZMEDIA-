#!/usr/bin/env bash

set -euo pipefail

ROOT="$(pwd)"

echo "=============================================="
echo " EZ MEDIA — 01.04 APPLICATION FOUNDATION"
echo " Version: 01.04.10"
echo "=============================================="

if [ ! -f "$ROOT/package.json" ]; then
  echo "ERROR: يجب تشغيل السكربت من جذر مشروع EZ-MEDIA."
  exit 1
fi

echo
echo "[1/12] إنشاء مجلدات التطبيقات والاختبارات..."

mkdir -p \
  apps/api/src/routes \
  apps/web/src \
  apps/admin/src \
  apps/worker/src \
  tests/smoke \
  scripts/maintenance

echo "[2/12] إنشاء apps/api/package.json..."

cat > apps/api/package.json <<'EOF'
{
  "name": "@ez-media/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/server.js",
  "types": "./dist/server.d.ts",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -b",
    "typecheck": "tsc -b --pretty false",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@ez-media/config": "workspace:*",
    "@ez-media/contracts": "workspace:*",
    "fastify": "5.12.5"
  },
  "devDependencies": {
    "@types/node": "26.6.4",
    "tsx": "4.23.15"
  }
}
EOF

echo "[3/12] إنشاء apps/api/tsconfig.json..."

cat > apps/api/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"
  },
  "references": [
    {
      "path": "../../packages/config"
    },
    {
      "path": "../../packages/contracts"
    }
  ],
  "include": [
    "src/**/*.ts"
  ]
}
EOF

echo "[4/12] إنشاء API application..."

cat > apps/api/src/app.ts <<'EOF'
import Fastify, {
  type FastifyInstance,
} from 'fastify';

import {
  PACKAGE_NAME as CONFIG_PACKAGE_NAME,
  PACKAGE_VERSION as CONFIG_PACKAGE_VERSION,
} from '@ez-media/config';

import {
  PACKAGE_NAME as CONTRACTS_PACKAGE_NAME,
  PACKAGE_VERSION as CONTRACTS_PACKAGE_VERSION,
} from '@ez-media/contracts';

const APPLICATION_NAME = '@ez-media/api';
const APPLICATION_VERSION = '1.0.0';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: APPLICATION_NAME,
      version: APPLICATION_VERSION,
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      dependencies: {
        config: {
          package: CONFIG_PACKAGE_NAME,
          version: CONFIG_PACKAGE_VERSION,
        },
        contracts: {
          package: CONTRACTS_PACKAGE_NAME,
          version: CONTRACTS_PACKAGE_VERSION,
        },
      },
    };
  });

  app.get('/', async () => {
    return {
      platform: 'EZ MEDIA',
      service: APPLICATION_NAME,
      version: APPLICATION_VERSION,
      status: 'online',
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}
EOF

cat > apps/api/src/server.ts <<'EOF'
import { buildApp } from './app.js';

const HOST = process.env['HOST'] ?? '0.0.0.0';
const PORT = Number(process.env['PORT'] ?? '3000');

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

const app = buildApp();

const shutdown = async (signal: string): Promise<void> => {
  app.log.info(
    {
      signal,
    },
    'EZ MEDIA API shutdown requested',
  );

  try {
    await app.close();

    app.log.info('EZ MEDIA API shutdown completed');

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
};

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

try {
  await app.listen({
    host: HOST,
    port: PORT,
  });

  app.log.info(
    {
      host: HOST,
      port: PORT,
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

  process.exit(1);
}
EOF

cat > apps/api/src/routes/root.ts <<'EOF'
export const ROOT_ROUTE = '/';
export const HEALTH_ROUTE = '/health';
EOF

echo "[5/12] إنشاء Web application..."

cat > apps/web/package.json <<'EOF'
{
  "name": "@ez-media/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b --pretty false"
  },
  "devDependencies": {
    "@types/node": "26.6.4"
  }
}
EOF

cat > apps/web/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"
  },
  "include": [
    "src/**/*.ts"
  ]
}
EOF

cat > apps/web/src/index.ts <<'EOF'
export const APPLICATION_NAME = '@ez-media/web';
export const APPLICATION_VERSION = '1.0.0';

export interface WebApplicationInfo {
  readonly name: string;
  readonly version: string;
  readonly status: 'ready';
}

export const applicationInfo: WebApplicationInfo = {
  name: APPLICATION_NAME,
  version: APPLICATION_VERSION,
  status: 'ready',
};
EOF

echo "[6/12] إنشاء Admin application..."

cat > apps/admin/package.json <<'EOF'
{
  "name": "@ez-media/admin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b --pretty false"
  },
  "devDependencies": {
    "@types/node": "26.6.4"
  }
}
EOF

cat > apps/admin/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"
  },
  "include": [
    "src/**/*.ts"
  ]
}
EOF

cat > apps/admin/src/index.ts <<'EOF'
export const APPLICATION_NAME = '@ez-media/admin';
export const APPLICATION_VERSION = '1.0.0';

export interface AdminApplicationInfo {
  readonly name: string;
  readonly version: string;
  readonly status: 'ready';
}

export const applicationInfo: AdminApplicationInfo = {
  name: APPLICATION_NAME,
  version: APPLICATION_VERSION,
  status: 'ready',
};
EOF

echo "[7/12] إنشاء Worker application..."

cat > apps/worker/package.json <<'EOF'
{
  "name": "@ez-media/worker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "typecheck": "tsc -b --pretty false",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "@types/node": "26.6.4"
  }
}
EOF

cat > apps/worker/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo"
  },
  "include": [
    "src/**/*.ts"
  ]
}
EOF

cat > apps/worker/src/index.ts <<'EOF'
const APPLICATION_NAME = '@ez-media/worker';
const APPLICATION_VERSION = '1.0.0';

let shuttingDown = false;

const shutdown = (signal: string): void => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    JSON.stringify({
      event: 'worker_shutdown',
      signal,
      service: APPLICATION_NAME,
      version: APPLICATION_VERSION,
      timestamp: new Date().toISOString(),
    }),
  );

  process.exit(0);
};

process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.once('SIGINT', () => {
  shutdown('SIGINT');
});

console.log(
  JSON.stringify({
    event: 'worker_started',
    service: APPLICATION_NAME,
    version: APPLICATION_VERSION,
    timestamp: new Date().toISOString(),
  }),
);
EOF

echo "[8/12] تحديث TypeScript project references..."

cat > tsconfig.json <<'EOF'
{
  "files": [],
  "references": [
    {
      "path": "./packages/config"
    },
    {
      "path": "./packages/contracts"
    },
    {
      "path": "./packages/database"
    },
    {
      "path": "./packages/security"
    },
    {
      "path": "./packages/logging"
    },
    {
      "path": "./packages/events"
    },
    {
      "path": "./packages/storage"
    },
    {
      "path": "./packages/observability"
    },
    {
      "path": "./packages/ai"
    },
    {
      "path": "./packages/media"
    },
    {
      "path": "./packages/search"
    },
    {
      "path": "./apps/api"
    },
    {
      "path": "./apps/web"
    },
    {
      "path": "./apps/admin"
    },
    {
      "path": "./apps/worker"
    }
  ]
}
EOF

echo "[9/12] إنشاء إعداد Vitest..."

cat > vitest.config.ts <<'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
    ],
    reporters: [
      'default',
    ],
  },
});
EOF

echo "[10/12] إنشاء اختبارات Smoke..."

cat > tests/smoke/api-health.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';

import { buildApp } from '../../apps/api/src/app.js';

describe('EZ MEDIA API — Health', () => {
  it('should return a healthy response', async () => {
    const app = buildApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.status).toBe('ok');
      expect(body.service).toBe('@ez-media/api');
      expect(body.version).toBe('1.0.0');
      expect(body.timestamp).toBeTypeOf('string');
      expect(body.uptimeSeconds).toBeTypeOf('number');
    } finally {
      await app.close();
    }
  });
});
EOF

cat > tests/smoke/api-root.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';

import { buildApp } from '../../apps/api/src/app.js';

describe('EZ MEDIA API — Root', () => {
  it('should return platform information', async () => {
    const app = buildApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.platform).toBe('EZ MEDIA');
      expect(body.service).toBe('@ez-media/api');
      expect(body.version).toBe('1.0.0');
      expect(body.status).toBe('online');
      expect(body.timestamp).toBeTypeOf('string');
    } finally {
      await app.close();
    }
  });
});
EOF

cat > tests/smoke/application-foundation.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';

import {
  APPLICATION_NAME as WEB_NAME,
  APPLICATION_VERSION as WEB_VERSION,
} from '../../apps/web/src/index.js';

import {
  APPLICATION_NAME as ADMIN_NAME,
  APPLICATION_VERSION as ADMIN_VERSION,
} from '../../apps/admin/src/index.js';

describe('EZ MEDIA Application Foundation', () => {
  it('should expose the Web application identity', () => {
    expect(WEB_NAME).toBe('@ez-media/web');
    expect(WEB_VERSION).toBe('1.0.0');
  });

  it('should expose the Admin application identity', () => {
    expect(ADMIN_NAME).toBe('@ez-media/admin');
    expect(ADMIN_VERSION).toBe('1.0.0');
  });
});
EOF

echo "[11/12] إنشاء سكربت التحقق الكامل..."

cat > scripts/maintenance/verify-foundation.sh <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

echo "=========================================="
echo " EZ MEDIA FOUNDATION VERIFICATION"
echo " Version: 01.04.10"
echo "=========================================="

echo
echo "[1/8] Checking Node.js..."
node --version

echo
echo "[2/8] Checking pnpm..."
pnpm --version

echo
echo "[3/8] Installing dependencies..."
pnpm install

echo
echo "[4/8] Running TypeScript verification..."
pnpm typecheck

echo
echo "[5/8] Running production build..."
pnpm build

echo
echo "[6/8] Running tests..."
pnpm test

echo
echo "[7/8] Checking API package..."
pnpm --filter @ez-media/api typecheck

echo
echo "[8/8] Git status..."
git status --short

echo
echo "=========================================="
echo " EZ MEDIA FOUNDATION VERIFICATION PASSED"
echo "=========================================="
EOF

chmod +x scripts/maintenance/verify-foundation.sh

echo "[12/12] تحديث package.json الجذر..."

node <<'EOF'
const fs = require('node:fs');

const path = 'package.json';

const packageJson = JSON.parse(
  fs.readFileSync(path, 'utf8'),
);

packageJson.scripts = {
  ...(packageJson.scripts ?? {}),
  "dev": "pnpm --filter @ez-media/api dev",
  "build": "pnpm -r build",
  "typecheck": "pnpm -r typecheck",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run tests/unit",
  "test:integration": "vitest run tests/integration",
  "test:security": "vitest run tests/security",
  "test:smoke": "vitest run tests/smoke",
  "lint": "pnpm -r lint",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "check": "pnpm typecheck && pnpm build && pnpm test",
  "ci": "pnpm check",
  "start": "pnpm --filter @ez-media/api start"
};

if (!packageJson.devDependencies) {
  packageJson.devDependencies = {};
}

packageJson.devDependencies.vitest = "5.0.3";

fs.writeFileSync(
  path,
  `${JSON.stringify(packageJson, null, 2)}\n`,
);

console.log('Root package.json updated.');
EOF

echo
echo "=============================================="
echo " 01.04 APPLICATION FOUNDATION CREATED"
echo "=============================================="

echo
echo "الملفات الرئيسية:"
echo "  apps/api"
echo "  apps/web"
echo "  apps/admin"
echo "  apps/worker"
echo "  tests/smoke"
echo "  scripts/maintenance/verify-foundation.sh"

echo
echo "الآن نفذ:"
echo
echo "  pnpm install"
echo "  pnpm typecheck"
echo "  pnpm build"
echo "  pnpm test"
echo
echo "أو:"
echo
echo "  ./scripts/maintenance/verify-foundation.sh"
echo
