import "dotenv/config";

const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT || 3000),

  databaseUrl: process.env.DATABASE_URL || "",

  jwtSecret:
    process.env.JWT_SECRET ||
    "CHANGE_THIS_SECRET_IN_RAILWAY",

  adminEmail:
    process.env.ADMIN_EMAIL ||
    "admin@ezmedia.local",

  adminPassword:
    process.env.ADMIN_PASSWORD ||
    "ChangeMe123!",

  platform: "EZ MEDIA",

  version: "11.0.0"
};

export default env;
