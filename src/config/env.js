const nodeEnvironment =
  process.env.NODE_ENV || "development";

const isProduction =
  nodeEnvironment === "production";

const isDevelopment =
  nodeEnvironment === "development";

const isTest =
  nodeEnvironment === "test";

const nodeEnvironment =
  process.env.NODE_ENV || "development";

const isProduction =
  nodeEnvironment === "production";

const isDevelopment =
  nodeEnvironment === "development";

const isTest =
  nodeEnvironment === "test";


const appName =
  process.env.APP_NAME || "EZ MEDIA";

const appVersion =
  process.env.APP_VERSION || "11.0.0";

const appUrl =
  process.env.APP_URL ||
  "http://localhost:3000";

const port =
  Number(process.env.PORT || 3000);


const databaseUrl =
  process.env.DATABASE_URL || null;

const dbPoolMax =
  Number(process.env.DB_POOL_MAX || 20);


const jwtSecret =
  process.env.JWT_SECRET || null;

const jwtAccessExpiresIn =
  process.env.JWT_ACCESS_EXPIRES_IN ||
  "15m";

const jwtRefreshExpiresDays =
  Number(
    process.env.JWT_REFRESH_EXPIRES_DAYS || 30
  );

const bcryptRounds =
  Number(
    process.env.BCRYPT_ROUNDS || 12
  );


const corsOrigin =
  process.env.CORS_ORIGIN || "*";


const storageProvider =
  process.env.STORAGE_PROVIDER || "local";

const storageBucket =
  process.env.STORAGE_BUCKET || null;

const storageRegion =
  process.env.STORAGE_REGION || null;

const storageEndpoint =
  process.env.STORAGE_ENDPOINT || null;

const storageAccessKey =
  process.env.STORAGE_ACCESS_KEY || null;

const storageSecretKey =
  process.env.STORAGE_SECRET_KEY || null;


const aiProvider =
  process.env.AI_PROVIDER || null;

const aiApiKey =
  process.env.AI_API_KEY || null;

const aiModel =
  process.env.AI_MODEL || null;


const redisUrl =
  process.env.REDIS_URL || null;


const logLevel =
  process.env.LOG_LEVEL || "info";


const webhookSecret =
  process.env.WEBHOOK_SECRET || null;


const encryptionKey =
  process.env.ENCRYPTION_KEY || null;


/*
|--------------------------------------------------------------------------
| Production
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
| EZ MEDIA Configuration
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


export {
  config
};
