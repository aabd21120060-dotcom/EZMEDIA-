"use strict";

const express = require("express");
const os = require("os");

const {
  health: databaseHealth
} = require("../database/db");

const {
  isStorageConfigured,
  testStorage,
  getStorageConfig
} = require("../services/storageService");

const {
  authenticateRequest,
  requirePermission
} = require("../middleware/auth");

const router = express.Router();

const startedAt = Date.now();

/*
|--------------------------------------------------------------------------
| معلومات النظام العامة
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  authenticateRequest,
  requirePermission("dashboard.view"),
  async (req, res, next) => {
    try {
      const database =
        await getDatabaseStatus();

      const storage =
        await getStorageStatus();

      const memory =
        process.memoryUsage();

      const uptimeSeconds =
        Math.floor(
          (Date.now() - startedAt) / 1000
        );

      res.json({
        success: true,

        platform: "EZ MEDIA",

        version: "11.0.0",

        status: "online",

        environment:
          process.env.NODE_ENV ||
          "production",

        server: {
          node:
            process.version,

          platform:
            process.platform,

          architecture:
            process.arch,

          hostname:
            os.hostname(),

          uptime:
            uptimeSeconds,

          uptimeFormatted:
            formatUptime(
              uptimeSeconds
            )
        },

        memory: {
          rss:
            memory.rss,

          heapTotal:
            memory.heapTotal,

          heapUsed:
            memory.heapUsed,

          external:
            memory.external,

          arrayBuffers:
            memory.arrayBuffers
        },

        database,

        storage,

        modules: {
          api: true,
          cms: true,
          ai: true,
          mediaLibrary: true,
          upload: true,
          live: true,
          breakingNews: true,
          advertising: true,
          sponsorships: true,
          automation: true,
          authentication: true,
          authorization: true,
          auditLogs: true
        },

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| حالة قاعدة البيانات
|--------------------------------------------------------------------------
*/

router.get(
  "/database",
  authenticateRequest,
  requirePermission("dashboard.view"),
  async (req, res, next) => {
    try {
      const database =
        await getDatabaseStatus();

      res.json({
        success: true,
        database
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| حالة التخزين
|--------------------------------------------------------------------------
*/

router.get(
  "/storage",
  authenticateRequest,
  requirePermission("media.view"),
  async (req, res, next) => {
    try {
      const storage =
        await getStorageStatus();

      res.json({
        success: true,
        storage
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| اختبار التخزين
|--------------------------------------------------------------------------
*/

router.post(
  "/storage/test",
  authenticateRequest,
  requirePermission("media.upload"),
  async (req, res, next) => {
    try {
      const configured =
        isStorageConfigured();

      if (!configured) {
        return res.status(503).json({
          success: false,
          code: "STORAGE_NOT_CONFIGURED",
          message:
            "التخزين غير مهيأ بعد",
          storage: {
            configured: false
          }
        });
      }

      const result =
        await testStorage();

      res.json({
        success:
          Boolean(result.success),

        storage: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| معلومات الوحدات
|--------------------------------------------------------------------------
*/

router.get(
  "/modules",
  authenticateRequest,
  requirePermission("dashboard.view"),
  async (req, res, next) => {
    try {
      res.json({
        success: true,

        modules: [
          {
            key: "dashboard",
            name: "لوحة التحكم",
            status: "active"
          },
          {
            key: "newsroom",
            name: "غرفة الأخبار",
            status: "active"
          },
          {
            key: "content",
            name: "إدارة المحتوى",
            status: "active"
          },
          {
            key: "media",
            name: "مكتبة الوسائط",
            status: "active"
          },
          {
            key: "live",
            name: "البث المباشر",
            status: "active"
          },
          {
            key: "breaking",
            name: "الأخبار العاجلة",
            status: "active"
          },
          {
            key: "commercial",
            name: "الإعلانات والرعايات",
            status: "active"
          },
          {
            key: "ai",
            name: "الذكاء الاصطناعي",
            status: "active"
          },
          {
            key: "analytics",
            name: "التحليلات",
            status: "active"
          },
          {
            key: "authentication",
            name: "المصادقة",
            status: "active"
          },
          {
            key: "authorization",
            name: "الصلاحيات",
            status: "active"
          },
          {
            key: "audit",
            name: "السجل الأمني",
            status: "active"
          }
        ]
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| Health داخلي للإدارة
|--------------------------------------------------------------------------
*/

router.get(
  "/health",
  authenticateRequest,
  requirePermission("dashboard.view"),
  async (req, res, next) => {
    try {
      const [
        database,
        storage
      ] = await Promise.all([
        getDatabaseStatus(),
        getStorageStatus()
      ]);

      const services = {
        api: true,

        database:
          database.connected === true,

        storage:
          storage.configured === true
      };

      const healthy =
        services.api &&
        services.database;

      res.status(
        healthy ? 200 : 503
      ).json({
        success: healthy,

        status:
          healthy
            ? "healthy"
            : "degraded",

        services,

        database,

        storage,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| معلومات بيئة التشغيل
|--------------------------------------------------------------------------
|
| لا نعرض الأسرار أو Environment Variables.
|--------------------------------------------------------------------------
*/

router.get(
  "/runtime",
  authenticateRequest,
  requirePermission("dashboard.view"),
  async (req, res, next) => {
    try {
      res.json({
        success: true,

        runtime: {
          node:
            process.version,

          environment:
            process.env.NODE_ENV ||
            "production",

          platform:
            process.platform,

          architecture:
            process.arch,

          cpuCount:
            os.cpus().length,

          totalMemory:
            os.totalmem(),

          freeMemory:
            os.freemem(),

          hostname:
            os.hostname()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| وظائف داخلية
|--------------------------------------------------------------------------
*/

async function getDatabaseStatus() {
  try {
    return await databaseHealth();
  } catch (error) {
    return {
      configured:
        Boolean(
          process.env.DATABASE_URL
        ),

      connected: false,

      error:
        error.message
    };
  }
}

async function getStorageStatus() {
  const configured =
    isStorageConfigured();

  const config =
    getStorageConfig();

  let connection = null;

  if (configured) {
    try {
      connection =
        await testStorage();
    } catch (error) {
      connection = {
        success: false,
        error: error.message
      };
    }
  }

  return {
    configured,

    provider:
      config.endpoint
        ? "S3 Compatible"
        : null,

    bucket:
      config.bucket
        ? "configured"
        : null,

    publicUrl:
      config.publicBaseUrl
        ? "configured"
        : null,

    connection
  };
}

function formatUptime(seconds) {
  const days =
    Math.floor(
      seconds / 86400
    );

  const hours =
    Math.floor(
      (seconds % 86400) / 3600
    );

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );

  const remainingSeconds =
    seconds % 60;

  return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
}

module.exports = router;
