import "dotenv/config";

const NODE_ENV =
  process.env.NODE_ENV || "development";

const IS_PRODUCTION =
  NODE_ENV === "production";

const IS_DEVELOPMENT =
  NODE_ENV === "development";

const IS_TEST =
  NODE_ENV === "test";


const APP_NAME =
  process.env.APP_NAME || "EZ MEDIA";

const APP_VERSION =
  process.env.APP_VERSION || "11.0.0";

const APP_URL =
  process.env.APP_URL ||
  "http://localhost:3000";

const PORT =
  Number(process.env.PORT || 3000);


const DATABASE_URL =
  process.env.DATABASE_URL || null;

const DB_POOL_MAX =
  Number(process.env.DB_POOL_MAX || 10);


const JWT_SECRET =
  process.env.JWT_SECRET || null;

const JWT_ACCESS_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || "15m";

const JWT_REFRESH_EXPIRES_DAYS =
  Number(
    process.env.JWT_REFRESH_EXPIRES_DAYS || 30
  );


const CORS_ORIGIN =
  process.env.CORS_ORIGIN || "*";


const LOG_LEVEL =
  process.env.LOG_LEVEL || "info";


const STORAGE_PROVIDER =
  process.env.STORAGE_PROVIDER || "local";

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET || null;

const STORAGE_REGION =
  process.env.STORAGE_REGION || null;

const STORAGE_ENDPOINT =
  process.env.STORAGE_ENDPOINT || null;

const STORAGE_ACCESS_KEY =
  process.env.STORAGE_ACCESS_KEY || null;

const STORAGE_SECRET_KEY =
  process.env.STORAGE_SECRET_KEY || null;


const AI_PROVIDER =
  process.env.AI_PROVIDER || null;

const AI_API_KEY =
  process.env.AI_API_KEY || null;

const AI_MODEL =
  process.env.AI_MODEL || null;


const REDIS_URL =
  process.env.REDIS_URL || null;


const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET || null;


const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || null;


/*
|--------------------------------------------------------------------------
| EZ MEDIA CONFIG
|--------------------------------------------------------------------------
*/

const config = Object.freeze({

  app: Object.freeze({
    name: APP_NAME,
    version: APP_VERSION,
    url: APP_URL,
    port: PORT,
    environment: NODE_ENV,
    isProduction: IS_PRODUCTION,
    isDevelopment: IS_DEVELOPMENT,
    isTest: IS_TEST
  }),

  database: Object.freeze({
    url: DATABASE_URL,
    poolMax: DB_POOL_MAX
  }),

  auth: Object.freeze({
    jwtSecret: JWT_SECRET,
    accessExpiresIn: JWT_ACCESS_EXPIRES_IN,
    refreshExpiresDays: JWT_REFRESH_EXPIRES_DAYS
  }),

  cors: Object.freeze({
    origin: CORS_ORIGIN
  }),

  storage: Object.freeze({
    provider: STORAGE_PROVIDER,
    bucket: STORAGE_BUCKET,
    region: STORAGE_REGION,
    endpoint: STORAGE_ENDPOINT,
    accessKey: STORAGE_ACCESS_KEY,
    secretKey: STORAGE_SECRET_KEY
  }),

  ai: Object.freeze({
    provider: AI_PROVIDER,
    apiKey: AI_API_KEY,
    model: AI_MODEL
  }),

  redis: Object.freeze({
    url: REDIS_URL
  }),

  webhooks: Object.freeze({
    secret: WEBHOOK_SECRET
  }),

  encryption: Object.freeze({
    key: ENCRYPTION_KEY
  }),

  logging: Object.freeze({
    level: LOG_LEVEL
  })

});


export {
  config
};
