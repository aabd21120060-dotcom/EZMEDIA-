const nodeEnvironment =
  process.env.NODE_ENV || "development";

const isProduction =
  nodeEnvironment === "production";

const isDevelopment =
  nodeEnvironment === "development";

const isTest =
  nodeEnvironment === "test";


function required(name) {
  const value = process.env[name];

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    throw new Error(
      `Environment variable "${name}" is required`
    );
  }

  return String(value).trim();
}


function optional(
  name,
  defaultValue = undefined
) {
  const value = process.env[name];

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return defaultValue;
  }

  return String(value).trim();
}


function number(
  name,
  defaultValue,
  options = {}
) {
  const value = optional(
    name,
    String(defaultValue)
  );

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Environment variable "${name}" must be a valid number`
    );
  }

  if (
    options.min !== undefined &&
    parsed < options.min
  ) {
    throw new Error(
      `Environment variable "${name}" must be >= ${options.min}`
    );
  }

  if (
    options.max !== undefined &&
    parsed > options.max
  ) {
    throw new Error(
      `Environment variable "${name}" must be <= ${options.max}`
    );
  }

  return parsed;
}


function boolean(
  name,
  defaultValue = false
) {
  const value = optional(
    name,
    defaultValue ? "true" : "false"
  ).toLowerCase();

  if (
    value === "true" ||
    value === "1" ||
    value === "yes"
  ) {
    return true;
  }

  if (
    value === "false" ||
    value === "0" ||
    value === "no"
  ) {
    return false;
  }

  throw new Error(
    `Environment variable "${name}" must be true/false`
  );
}


/*
|--------------------------------------------------------------------------
| Application
|--------------------------------------------------------------------------
*/

const appName =
  optional(
    "APP_NAME",
    "EZ MEDIA"
  );

const appVersion =
  optional(
    "APP_VERSION",
    "11.0.0"
  );

const appUrl =
  optional(
    "APP_URL",
    "http://localhost:3000"
  );

const port =
  number(
    "PORT",
    3000,
    {
      min: 1,
      max: 65535
    }
  );


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

const databaseUrl =
  optional(
    "DATABASE_URL"
  );

const dbPoolMax =
  number(
    "DB_POOL_MAX",
    20,
    {
      min: 1,
      max: 100
    }
  );


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

const jwtSecret =
  optional(
    "JWT_SECRET"
  );

const jwtAccessExpiresIn =
  optional(
    "JWT_ACCESS_EXPIRES_IN",
    "15m"
  );

const jwtRefreshExpiresDays =
  number(
    "JWT_REFRESH_EXPIRES_DAYS",
    30,
    {
      min: 1,
      max: 365
    }
  );

const bcryptRounds =
  number(
    "BCRYPT_ROUNDS",
    12,
    {
      min: 10,
      max: 16
    }
  );


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

const corsOrigin =
  optional(
    "CORS_ORIGIN",
    "*"
  );


/*
|--------------------------------------------------------------------------
| Storage
|--------------------------------------------------------------------------
*/

const storageProvider =
  optional(
    "STORAGE_PROVIDER",
    "local"
  );

const storageBucket =
  optional(
    "STORAGE_BUCKET"
  );

const storageRegion =
  optional(
    "STORAGE_REGION"
  );

const storageEndpoint =
  optional(
    "STORAGE_ENDPOINT"
  );

const storageAccessKey =
  optional(
    "STORAGE_ACCESS_KEY"
  );

const storageSecretKey =
  optional(
    "STORAGE_SECRET_KEY"
  );


/*
|--------------------------------------------------------------------------
| AI
|--------------------------------------------------------------------------
*/

const aiProvider =
  optional(
    "AI_PROVIDER"
  );

const aiApiKey =
  optional(
    "AI_API_KEY"
  );

const aiModel =
  optional(
    "AI_MODEL"
  );


/*
|--------------------------------------------------------------------------
| Redis
|--------------------------------------------------------------------------
*/

const redisUrl =
  optional(
    "REDIS_URL"
  );


/*
|--------------------------------------------------------------------------
| Logging
|--------------------------------------------------------------------------
*/

const logLevel =
  optional(
    "LOG_LEVEL",
    "info"
  );


/*
|--------------------------------------------------------------------------
| Webhooks
|--------------------------------------------------------------------------
*/

const webhookSecret =
  optional(
    "WEBHOOK_SECRET"
  );


/*
|--------------------------------------------------------------------------
| Encryption
|--------------------------------------------------------------------------
*/

const encryptionKey =
  optional(
    "ENCRYPTION_KEY"
  );


/*
|--------------------------------------------------------------------------
| Production Validation
|--------------------------------------------------------------------------
*/

if (isProduction) {

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required in production"
    );
  }

  if (!jwtSecret) {
    throw new Error(
      "JWT_SECRET is required in production"
    );
  }

  if (jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters"
    );
  }

  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY is required in production"
    );
  }

  if (encryptionKey.length < 32) {
    throw new Error(
      "ENCRYPTION_KEY must contain at least 32 characters"
    );
  }
}


/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const config = Object.freeze({

  app: Object.freeze({
    name: appName,
    version: appVersion,
    url: appUrl,
    port,
    environment: nodeEnvironment,
    isProduction,
    isDevelopment,
    isTest
  }),

  database: Object.freeze({
    url: databaseUrl,
    poolMax: dbPoolMax
  }),

  auth: Object.freeze({
    jwtSecret,
    jwtAccessExpiresIn,
    jwtRefreshExpiresDays,
    bcryptRounds
  }),

  cors: Object.freeze({
    origin: corsOrigin
  }),

  storage: Object.freeze({
    provider: storageProvider,
    bucket: storageBucket,
    region: storageRegion,
    endpoint: storageEndpoint,
    accessKey: storageAccessKey,
    secretKey: storageSecretKey
  }),

  ai: Object.freeze({
    provider: aiProvider,
    apiKey: aiApiKey,
    model: aiModel
  }),

  queue: Object.freeze({
    redisUrl
  }),

  logging: Object.freeze({
    level: logLevel
  }),

  webhooks: Object.freeze({
    secret: webhookSecret
  }),

  encryption: Object.freeze({
    key: encryptionKey
  })

});


/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

export {
  config,
  required,
  optional,
  number,
  boolean
};
