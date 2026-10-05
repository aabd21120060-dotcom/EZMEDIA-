import { z } from 'zod';

export const PACKAGE_NAME = '@ez-media/config';
export const PACKAGE_VERSION = '1.0.0';

const booleanFromEnv = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(
      value.toLowerCase(),
    );
  });

const positiveIntegerFromEnv = (
  fallback: number,
) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') {
        return fallback;
      }

      const parsed = Number(value);

      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(
          `Invalid positive integer environment value: ${value}`,
        );
      }

      return parsed;
    });

const environmentSchema = z.object({
  NODE_ENV: z
    .enum([
      'development',
      'test',
      'production',
    ])
    .default('development'),

  HOST: z
    .string()
    .trim()
    .min(1)
    .default('0.0.0.0'),

  PORT: positiveIntegerFromEnv(3000),

  LOG_LEVEL: z
    .enum([
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
      'silent',
    ])
    .default('info'),

  API_PREFIX: z
    .string()
    .trim()
    .min(1)
    .default('/api'),

  API_VERSION: z
    .string()
    .trim()
    .min(1)
    .default('v1'),

  CORS_ORIGIN: z
    .string()
    .trim()
    .default(''),

  TRUST_PROXY: booleanFromEnv,

  REQUEST_TIMEOUT_MS:
    positiveIntegerFromEnv(30_000),

  BODY_LIMIT_BYTES:
    positiveIntegerFromEnv(10 * 1024 * 1024),

  DATABASE_URL: z
    .string()
    .trim()
    .optional(),

  DATABASE_POOL_MAX:
    positiveIntegerFromEnv(10),

  AI_ENABLED: booleanFromEnv,

  MEDIA_ENABLED: booleanFromEnv,

  LIVE_ENABLED: booleanFromEnv,
});

export type AppEnvironment =
  z.infer<typeof environmentSchema>;

export interface AppConfig {
  readonly environment: AppEnvironment;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly apiBasePath: string;
  readonly healthPath: string;
  readonly readinessPath: string;
}

let cachedConfig: AppConfig | undefined;

function normalizePrefix(
  prefix: string,
): string {
  const normalized = `/${prefix.replace(/^\/+|\/+$/g, '')}`;

  return normalized === '/'
    ? ''
    : normalized;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed =
    environmentSchema.safeParse(environment);

  if (!parsed.success) {
    const formatted =
      parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.join('.')}: ${issue.message}`,
        )
        .join('; ');

    throw new Error(
      `Invalid application configuration: ${formatted}`,
    );
  }

  const values = parsed.data;

  const apiPrefix = normalizePrefix(
    values.API_PREFIX,
  );

  const apiVersion = normalizePrefix(
    values.API_VERSION,
  );

  const apiBasePath =
    `${apiPrefix}${apiVersion}`;

  cachedConfig = {
    environment: values,
    isProduction:
      values.NODE_ENV === 'production',
    isDevelopment:
      values.NODE_ENV === 'development',
    isTest:
      values.NODE_ENV === 'test',
    apiBasePath,
    healthPath: '/health',
    readinessPath: '/ready',
  };

  return cachedConfig;
}

export function resetConfigForTests(): void {
  cachedConfig = undefined;
}
