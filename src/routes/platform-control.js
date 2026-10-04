/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 54
 * ================================================================
 *
 * الملف:
 * src/routes/platform-control.js
 *
 * الاسم:
 * Platform Control & Internal Update Center
 *
 * الوظائف الرئيسية:
 * - مراقبة حالة المنصة
 * - قراءة الإصدار
 * - فحص الخدمات
 * - فحص قاعدة البيانات
 * - إدارة عمليات التحديث الداخلية
 * - إنشاء سجل للتحديثات
 * - منع تنفيذ تحديثات متزامنة
 * - التحقق من الصلاحيات
 * - وضع المنصة في وضع الصيانة
 * - إنهاء وضع الصيانة
 * - فحص الجاهزية قبل التحديث
 * - Health Check
 * - Readiness Check
 * - Liveness Check
 * - System Statistics
 * - Audit Log
 * - Update History
 * - Safe Rollback Metadata
 * - AI-ready control events
 *
 * مهم:
 * هذا الملف لا ينفذ أوامر نظام خطرة مباشرة.
 * أي عملية نشر حقيقية يجب أن تمر عبر طبقة Deployment
 * منفصلة ومؤمنة.
 *
 * ================================================================
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const os = require('os');

const router = express.Router();

/* ================================================================
 * 1. إعدادات النظام
 * ================================================================ */

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'EZ MEDIA';
const PLATFORM_VERSION = process.env.PLATFORM_VERSION || '11.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

const START_TIME = Date.now();

const UPDATE_TIMEOUT_MS = Number(
  process.env.UPDATE_TIMEOUT_MS || 15 * 60 * 1000
);

const MAX_AUDIT_LOGS = Number(
  process.env.MAX_AUDIT_LOGS || 5000
);

const MAX_UPDATE_HISTORY = Number(
  process.env.MAX_UPDATE_HISTORY || 500
);

/* ================================================================
 * 2. الذاكرة الداخلية المؤقتة
 *
 * في الإنتاج يفضل نقل هذه البيانات إلى PostgreSQL.
 * ================================================================ */

const state = {
  maintenanceMode: false,

  updateInProgress: false,

  currentUpdate: null,

  lastUpdate: null,

  lastHealthCheck: null,

  lastReadinessCheck: null,

  deploymentStatus: 'stable',

  systemStatus: 'online'
};

const auditLogs = [];

const updateHistory = [];

/* ================================================================
 * 3. أدوات عامة
 * ================================================================ */

function generateId(prefix = 'evt') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function uptimeSeconds() {
  return Math.floor((Date.now() - START_TIME) / 1000);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function addAuditLog({
  action,
  actor = 'system',
  status = 'success',
  details = {},
  requestId = null
}) {
  const entry = {
    id: generateId('audit'),
    timestamp: now(),
    action,
    actor,
    status,
    requestId,
    details
  };

  auditLogs.unshift(entry);

  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.length = MAX_AUDIT_LOGS;
  }

  return entry;
}

function addUpdateHistory(entry) {
  updateHistory.unshift(entry);

  if (updateHistory.length > MAX_UPDATE_HISTORY) {
    updateHistory.length = MAX_UPDATE_HISTORY;
  }

  return entry;
}

/* ================================================================
 * 4. Request ID
 * ================================================================ */

router.use((req, res, next) => {
  const requestId =
    req.headers['x-request-id'] ||
    generateId('req');

  req.requestId = requestId;

  res.setHeader('X-Request-ID', requestId);

  next();
});

/* ================================================================
 * 5. التحقق من JSON
 * ================================================================ */

function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    platform: PLATFORM_NAME,
    version: PLATFORM_VERSION,
    timestamp: now(),
    ...data
  });
}

function sendError(
  res,
  message,
  statusCode = 400,
  code = 'PLATFORM_CONTROL_ERROR',
  details = {}
) {
  return res.status(statusCode).json({
    success: false,
    platform: PLATFORM_NAME,
    version: PLATFORM_VERSION,
    timestamp: now(),
    error: {
      code,
      message,
      details
    }
  });
}

/* ================================================================
 * 6. الصلاحيات
 *
 * يدعم:
 * X-Admin-Key
 * PLATFORM_ADMIN_KEY
 *
 * في بيئة التطوير يسمح بالوصول إذا لم يتم تحديد المفتاح.
 * في الإنتاج يجب تحديد المفتاح.
 * ================================================================ */

function requireAdmin(req, res, next) {
  const configuredKey = process.env.PLATFORM_ADMIN_KEY;

  if (!configuredKey) {
    if (NODE_ENV === 'production') {
      return sendError(
        res,
        'لوحة التحكم الإدارية غير مهيأة بمفتاح أمان.',
        503,
        'ADMIN_SECURITY_NOT_CONFIGURED'
      );
    }

    req.admin = {
      id: 'development-admin',
      role: 'super_admin'
    };

    return next();
  }

  const suppliedKey =
    req.headers['x-admin-key'] ||
    req.headers['x-platform-admin-key'];

  if (!suppliedKey || suppliedKey !== configuredKey) {
    addAuditLog({
      action: 'ADMIN_AUTH_FAILED',
      actor: 'unknown',
      status: 'failed',
      requestId: req.requestId,
      details: {
        path: req.path,
        method: req.method
      }
    });

    return sendError(
      res,
      'غير مصرح بالوصول.',
      401,
      'UNAUTHORIZED'
    );
  }

  req.admin = {
    id: 'platform-admin',
    role: 'super_admin'
  };

  next();
}

/* ================================================================
 * 7. فحص البيئة
 * ================================================================ */

function getEnvironmentInfo() {
  return {
    node: process.version,
    environment: NODE_ENV,
    platform: process.platform,
    architecture: process.arch,
    hostname: os.hostname(),
    pid: process.pid,
    cpuCount: os.cpus().length,
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      usedBytes: os.totalmem() - os.freemem()
    },
    uptimeSeconds: process.uptime()
  };
}

/* ================================================================
 * 8. فحص قاعدة البيانات
 *
 * يدعم pool موجود في app.locals.
 * ================================================================ */

async function checkDatabase(req) {
  const pool = req.app.locals.db;

  if (!pool) {
    return {
      configured: Boolean(process.env.DATABASE_URL),
      connected: false,
      status: process.env.DATABASE_URL
        ? 'configured_not_connected'
        : 'not_configured',
      message: process.env.DATABASE_URL
        ? 'DATABASE_URL موجود لكن اتصال قاعدة البيانات غير متاح.'
        : 'DATABASE_URL غير مهيأ.'
    };
  }

  const started = Date.now();

  try {
    const result = await pool.query(
      'SELECT NOW() AS server_time'
    );

    return {
      configured: true,
      connected: true,
      status: 'ready',
      latencyMs: Date.now() - started,
      serverTime: result.rows?.[0]?.server_time || null
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      status: 'error',
      latencyMs: Date.now() - started,
      message: error.message
    };
  }
}

/* ================================================================
 * 9. فحص الخدمات الداخلية
 * ================================================================ */

async function checkServices(req) {
  const services = {};

  services.api = {
    status: 'online'
  };

  services.cms = {
    status: req.app.locals.cms
      ? 'online'
      : 'not_connected'
  };

  services.mediaLibrary = {
    status: req.app.locals.mediaLibrary
      ? 'online'
      : 'not_connected'
  };

  services.ai = {
    status:
      process.env.AI_API_KEY
        ? 'configured'
        : 'not_configured'
  };

  services.storage = {
    status:
      process.env.STORAGE_BUCKET ||
      process.env.S3_BUCKET
        ? 'configured'
        : 'not_configured'
  };

  services.live = {
    status:
      process.env.LIVE_STREAM_URL ||
      process.env.LIVE_PROVIDER
        ? 'configured'
        : 'not_configured'
  };

  services.notifications = {
    status:
      req.app.locals.notificationService
        ? 'online'
        : 'not_connected'
  };

  services.automation = {
    status:
      req.app.locals.automationService
        ? 'online'
        : 'not_connected'
  };

  return services;
}

/* ================================================================
 * 10. حساب الحالة العامة
 * ================================================================ */

function calculateSystemStatus({
  database,
  services
}) {
  if (state.maintenanceMode) {
    return 'maintenance';
  }

  if (database.status === 'error') {
    return 'degraded';
  }

  if (
    database.status === 'not_configured' ||
    database.status === 'configured_not_connected'
  ) {
    return 'degraded';
  }

  const serviceStatuses = Object.values(services)
    .map(service => service.status);

  if (
    serviceStatuses.includes('error')
  ) {
    return 'degraded';
  }

  return 'online';
}

/* ================================================================
 * 11. Health Check
 * ================================================================ */

router.get('/health', async (req, res) => {
  const database = await checkDatabase(req);
  const services = await checkServices(req);

  const status = calculateSystemStatus({
    database,
    services
  });

  state.lastHealthCheck = now();
  state.systemStatus = status;

  const payload = {
    status,
    healthy: status === 'online',
    maintenanceMode: state.maintenanceMode,
    updateInProgress: state.updateInProgress,
    uptimeSeconds: uptimeSeconds(),
    database,
    services
  };

  if (status === 'online') {
    return sendSuccess(res, payload);
  }

  return res.status(503).json({
    success: false,
    platform: PLATFORM_NAME,
    version: PLATFORM_VERSION,
    timestamp: now(),
    ...payload
  });
});

/* ================================================================
 * 12. Liveness
 * ================================================================ */

router.get('/health/live', (req, res) => {
  return sendSuccess(res, {
    live: true,
    processId: process.pid,
    uptimeSeconds: process.uptime()
  });
});

/* ================================================================
 * 13. Readiness
 * ================================================================ */

router.get('/health/ready', async (req, res) => {
  const database = await checkDatabase(req);

  const ready =
    !state.maintenanceMode &&
    !state.updateInProgress &&
    database.status === 'ready';

  state.lastReadinessCheck = now();

  return res.status(ready ? 200 : 503).json({
    success: ready,
    ready,
    platform: PLATFORM_NAME,
    version: PLATFORM_VERSION,
    timestamp: now(),
    reason: ready
      ? null
      : state.maintenanceMode
        ? 'maintenance_mode'
        : state.updateInProgress
          ? 'update_in_progress'
          : 'database_not_ready'
  });
});

/* ================================================================
 * 14. معلومات المنصة
 * ================================================================ */

router.get('/info', (req, res) => {
  return sendSuccess(res, {
    platform: {
      name: PLATFORM_NAME,
      version: PLATFORM_VERSION,
      environment: NODE_ENV,
      status: state.systemStatus,
      deploymentStatus: state.deploymentStatus,
      maintenanceMode: state.maintenanceMode
    },

    runtime: getEnvironmentInfo(),

    update: {
      inProgress: state.updateInProgress,
      current: state.currentUpdate,
      last: state.lastUpdate
    }
  });
});

/* ================================================================
 * 15. إحصائيات النظام
 * ================================================================ */

router.get('/statistics', requireAdmin, (req, res) => {
  const memory = process.memoryUsage();

  return sendSuccess(res, {
    statistics: {
      uptimeSeconds: uptimeSeconds(),

      process: {
        pid: process.pid,
        uptimeSeconds: process.uptime()
      },

      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers
      },

      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length
      },

      audit: {
        total: auditLogs.length
      },

      updates: {
        total: updateHistory.length,
        inProgress: state.updateInProgress
      }
    }
  });
});

/* ================================================================
 * 16. حالة التحديث الحالية
 * ================================================================ */

router.get('/updates/current', requireAdmin, (req, res) => {
  return sendSuccess(res, {
    update: {
      inProgress: state.updateInProgress,
      current: state.currentUpdate,
      last: state.lastUpdate
    }
  });
});

/* ================================================================
 * 17. سجل التحديثات
 * ================================================================ */

router.get('/updates/history', requireAdmin, (req, res) => {
  const limit = Math.min(
    Math.max(
      safeNumber(req.query.limit, 50),
      1
    ),
    200
  );

  return sendSuccess(res, {
    updates: updateHistory.slice(0, limit)
  });
});

/* ================================================================
 * 18. فحص جاهزية التحديث
 * ================================================================ */

router.post(
  '/updates/preflight',
  requireAdmin,
  async (req, res) => {
    const database = await checkDatabase(req);

    const checks = {
      database: database.status === 'ready',

      noUpdateInProgress:
        !state.updateInProgress,

      notInMaintenance:
        !state.maintenanceMode,

      runtime:
        Number(process.versions.node.split('.')[0]) >= 20
    };

    const ready =
      Object.values(checks)
        .every(Boolean);

    const result = {
      ready,
      checks,
      database,
      checkedAt: now()
    };

    addAuditLog({
      action: 'UPDATE_PREFLIGHT',
      actor: req.admin.id,
      status: ready ? 'success' : 'failed',
      requestId: req.requestId,
      details: result
    });

    return sendSuccess(
      res,
      result,
      ready ? 200 : 409
    );
  }
);

/* ================================================================
 * 19. بدء عملية تحديث داخلية
 *
 * هذه العملية تسجل التحديث ولا تنفذ shell commands.
 * طبقة Deployment هي التي تنفذ النشر الفعلي.
 * ================================================================ */

router.post(
  '/updates/start',
  requireAdmin,
  async (req, res) => {
    if (state.updateInProgress) {
      return sendError(
        res,
        'يوجد تحديث جارٍ حاليًا.',
        409,
        'UPDATE_ALREADY_RUNNING',
        {
          update: state.currentUpdate
        }
      );
    }

    const {
      targetVersion,
      source = 'internal',
      reason = 'manual_update'
    } = req.body || {};

    if (!targetVersion) {
      return sendError(
        res,
        'يجب تحديد targetVersion.',
        400,
        'TARGET_VERSION_REQUIRED'
      );
    }

    const updateId = generateId('update');

    const update = {
      id: updateId,
      source,
      reason,
      fromVersion: PLATFORM_VERSION,
      targetVersion,
      status: 'prepared',
      startedAt: now(),
      startedBy: req.admin.id,
      progress: 0
    };

    state.updateInProgress = true;
    state.currentUpdate = update;
    state.deploymentStatus = 'updating';

    addUpdateHistory(update);

    addAuditLog({
      action: 'UPDATE_STARTED',
      actor: req.admin.id,
      requestId: req.requestId,
      details: update
    });

    return sendSuccess(
      res,
      {
        update,
        message:
          'تم إنشاء عملية التحديث داخليًا. يجب أن تنفذ طبقة النشر عملية Deployment الفعلية.'
      },
      202
    );
  }
);

/* ================================================================
 * 20. تحديث تقدم العملية
 * ================================================================ */

router.patch(
  '/updates/:updateId/progress',
  requireAdmin,
  (req, res) => {
    const { updateId } = req.params;

    if (
      !state.currentUpdate ||
      state.currentUpdate.id !== updateId
    ) {
      return sendError(
        res,
        'عملية التحديث غير موجودة.',
        404,
        'UPDATE_NOT_FOUND'
      );
    }

    const progress = Math.min(
      Math.max(
        safeNumber(req.body?.progress, 0),
        0
      ),
      100
    );

    state.currentUpdate.progress = progress;

    if (req.body?.stage) {
      state.currentUpdate.stage = String(
        req.body.stage
      );
    }

    state.currentUpdate.updatedAt = now();

    return sendSuccess(res, {
      update: state.currentUpdate
    });
  }
);

/* ================================================================
 * 21. إكمال التحديث
 * ================================================================ */

router.post(
  '/updates/:updateId/complete',
  requireAdmin,
  (req, res) => {
    const { updateId } = req.params;

    if (
      !state.currentUpdate ||
      state.currentUpdate.id !== updateId
    ) {
      return sendError(
        res,
        'عملية التحديث غير موجودة.',
        404,
        'UPDATE_NOT_FOUND'
      );
    }

    const completed = {
      ...state.currentUpdate,
      status: 'completed',
      progress: 100,
      completedAt: now(),
      deployedVersion:
        req.body?.deployedVersion ||
        state.currentUpdate.targetVersion
    };

    state.updateInProgress = false;
    state.currentUpdate = null;
    state.lastUpdate = completed;
    state.deploymentStatus = 'stable';

    const index = updateHistory.findIndex(
      item => item.id === updateId
    );

    if (index !== -1) {
      updateHistory[index] = completed;
    }

    addAuditLog({
      action: 'UPDATE_COMPLETED',
      actor: req.admin.id,
      requestId: req.requestId,
      details: completed
    });

    return sendSuccess(res, {
      update: completed
    });
  }
);

/* ================================================================
 * 22. فشل التحديث
 * ================================================================ */

router.post(
  '/updates/:updateId/fail',
  requireAdmin,
  (req, res) => {
    const { updateId } = req.params;

    if (
      !state.currentUpdate ||
      state.currentUpdate.id !== updateId
    ) {
      return sendError(
        res,
        'عملية التحديث غير موجودة.',
        404,
        'UPDATE_NOT_FOUND'
      );
    }

    const failed = {
      ...state.currentUpdate,
      status: 'failed',
      failedAt: now(),
      error:
        req.body?.error ||
        'Unknown update failure'
    };

    state.updateInProgress = false;
    state.currentUpdate = null;
    state.lastUpdate = failed;
    state.deploymentStatus = 'failed';

    const index = updateHistory.findIndex(
      item => item.id === updateId
    );

    if (index !== -1) {
      updateHistory[index] = failed;
    }

    addAuditLog({
      action: 'UPDATE_FAILED',
      actor: req.admin.id,
      status: 'failed',
      requestId: req.requestId,
      details: failed
    });

    return sendSuccess(res, {
      update: failed
    });
  }
);

/* ================================================================
 * 23. وضع الصيانة
 * ================================================================ */

router.post(
  '/maintenance/enable',
  requireAdmin,
  (req, res) => {
    if (state.updateInProgress) {
      return sendError(
        res,
        'لا يمكن تغيير وضع الصيانة أثناء عملية تحديث.',
        409,
        'UPDATE_IN_PROGRESS'
      );
    }

    state.maintenanceMode = true;
    state.systemStatus = 'maintenance';

    addAuditLog({
      action: 'MAINTENANCE_ENABLED',
      actor: req.admin.id,
      requestId: req.requestId
    });

    return sendSuccess(res, {
      maintenanceMode: true
    });
  }
);

/* ================================================================
 * 24. إنهاء الصيانة
 * ================================================================ */

router.post(
  '/maintenance/disable',
  requireAdmin,
  (req, res) => {
    state.maintenanceMode = false;
    state.systemStatus = 'online';

    addAuditLog({
      action: 'MAINTENANCE_DISABLED',
      actor: req.admin.id,
      requestId: req.requestId
    });

    return sendSuccess(res, {
      maintenanceMode: false
    });
  }
);

/* ================================================================
 * 25. سجل التدقيق
 * ================================================================ */

router.get(
  '/audit',
  requireAdmin,
  (req, res) => {
    const limit = Math.min(
      Math.max(
        safeNumber(req.query.limit, 100),
        1
      ),
      500
    );

    return sendSuccess(res, {
      logs: auditLogs.slice(0, limit)
    });
  }
);

/* ================================================================
 * 26. إرسال حدث داخلي
 *
 * تستخدمه بقية وحدات EZ MEDIA.
 * ================================================================ */

router.post(
  '/events',
  requireAdmin,
  (req, res) => {
    const {
      type,
      payload = {},
      source = 'platform-control'
    } = req.body || {};

    if (!type) {
      return sendError(
        res,
        'event type مطلوب.',
        400,
        'EVENT_TYPE_REQUIRED'
      );
    }

    const event = {
      id: generateId('event'),
      type,
      source,
      payload,
      timestamp: now()
    };

    addAuditLog({
      action: 'INTERNAL_EVENT',
      actor: req.admin.id,
      requestId: req.requestId,
      details: event
    });

    /*
     * إذا كان Event Bus موجودًا في التطبيق،
     * نرسل الحدث إليه.
     */
    if (
      req.app.locals.eventBus &&
      typeof req.app.locals.eventBus.emit === 'function'
    ) {
      req.app.locals.eventBus.emit(
        type,
        event
      );
    }

    return sendSuccess(res, {
      event
    }, 202);
  }
);

/* ================================================================
 * 27. AI Control Snapshot
 *
 * نقطة جاهزة لربط الذكاء الاصطناعي لاحقًا.
 * ================================================================ */

router.get(
  '/ai/snapshot',
  requireAdmin,
  async (req, res) => {
    const database = await checkDatabase(req);
    const services = await checkServices(req);

    const snapshot = {
      platform: PLATFORM_NAME,
      version: PLATFORM_VERSION,

      status: state.systemStatus,

      maintenanceMode:
        state.maintenanceMode,

      updateInProgress:
        state.updateInProgress,

      database,

      services,

      environment:
        getEnvironmentInfo(),

      generatedAt: now()
    };

    return sendSuccess(res, {
      snapshot
    });
  }
);

/* ================================================================
 * 28. حماية من انتهاء عملية التحديث
 *
 * تمنع بقاء updateInProgress إلى الأبد
 * في حالة انقطاع عملية النشر.
 * ================================================================ */

setInterval(() => {
  if (
    !state.updateInProgress ||
    !state.currentUpdate
  ) {
    return;
  }

  const startedAt =
    new Date(
      state.currentUpdate.startedAt
    ).getTime();

  if (
    Date.now() - startedAt >
    UPDATE_TIMEOUT_MS
  ) {
    const expired = {
      ...state.currentUpdate,
      status: 'timeout',
      timeoutAt: now()
    };

    state.updateInProgress = false;
    state.currentUpdate = null;
    state.lastUpdate = expired;
    state.deploymentStatus = 'failed';

    const index =
      updateHistory.findIndex(
        item => item.id === expired.id
      );

    if (index !== -1) {
      updateHistory[index] = expired;
    }

    addAuditLog({
      action: 'UPDATE_TIMEOUT',
      actor: 'system',
      status: 'failed',
      details: expired
    });
  }
}, 60 * 1000);

/* ================================================================
 * 29. Middleware خاص بوضع الصيانة
 *
 * لا نستخدمه على health endpoints.
 * يمكن تركيبه من server.js على المسارات العامة.
 * ================================================================ */

function maintenanceGuard(req, res, next) {
  if (
    !state.maintenanceMode
  ) {
    return next();
  }

  return res.status(503).json({
    success: false,
    platform: PLATFORM_NAME,
    version: PLATFORM_VERSION,
    status: 'maintenance',
    message:
      'المنصة تعمل حاليًا في وضع الصيانة.',
    timestamp: now()
  });
}

/* ================================================================
 * 30. تصدير Router + الأدوات
 * ================================================================ */

router.maintenanceGuard = maintenanceGuard;

router.platformState = state;

router.auditLogs = auditLogs;

router.updateHistory = updateHistory;

router.getState = () => ({
  ...state
});

module.exports = router;
