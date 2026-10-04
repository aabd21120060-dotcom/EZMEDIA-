/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 57
 * ================================================================
 *
 * Intelligent Automation API
 *
 * الملف:
 * src/routes/automation.js
 *
 * يعتمد على:
 * CODE 54  Platform Control
 * CODE 55  Platform Persistence
 * CODE 56  Automation Engine
 *
 * الوظائف:
 * - Workflows
 * - Tasks
 * - Queue
 * - Start / Stop / Pause / Resume
 * - Retry
 * - Cancel
 * - Statistics
 * - History
 * - Events
 * - AI automation triggers
 * - News automation
 * - Content automation
 * - Media automation
 * - Publishing automation
 *
 * ================================================================
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

/* ================================================================
 * 1. Helpers
 * ================================================================ */

function generateId(prefix = 'api') {
  return `${prefix}_${Date.now()}_${crypto
    .randomBytes(6)
    .toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function success(res, data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    platform: 'EZ MEDIA',
    version:
      process.env.PLATFORM_VERSION ||
      '11.0.0',
    timestamp: now(),
    ...data
  });
}

function failure(
  res,
  message,
  status = 400,
  code = 'AUTOMATION_API_ERROR',
  details = {}
) {
  return res.status(status).json({
    success: false,
    platform: 'EZ MEDIA',
    version:
      process.env.PLATFORM_VERSION ||
      '11.0.0',
    timestamp: now(),
    error: {
      code,
      message,
      details
    }
  });
}

/* ================================================================
 * 2. الحصول على Automation Engine
 * ================================================================ */

function getEngine(req) {
  return (
    req.app.locals.automationEngine ||
    null
  );
}

/* ================================================================
 * 3. الحصول على Persistence
 * ================================================================ */

function getPersistence(req) {
  return (
    req.app.locals.platformPersistence ||
    null
  );
}

/* ================================================================
 * 4. Admin Guard
 * ================================================================ */

function adminGuard(req, res, next) {

  const configuredKey =
    process.env.PLATFORM_ADMIN_KEY;

  if (!configuredKey) {

    if (
      process.env.NODE_ENV ===
      'production'
    ) {

      return failure(
        res,
        'صلاحيات الإدارة غير مهيأة.',
        503,
        'ADMIN_SECURITY_NOT_CONFIGURED'
      );

    }

    req.admin = {
      id:
        'development-admin',
      role:
        'super_admin'
    };

    return next();
  }

  const suppliedKey =
    req.headers['x-admin-key'] ||
    req.headers['x-platform-admin-key'];

  if (
    !suppliedKey ||
    suppliedKey !== configuredKey
  ) {

    return failure(
      res,
      'غير مصرح بالوصول.',
      401,
      'UNAUTHORIZED'
    );

  }

  req.admin = {
    id:
      'platform-admin',
    role:
      'super_admin'
  };

  next();
}

/* ================================================================
 * 5. Engine Guard
 * ================================================================ */

function engineGuard(
  req,
  res,
  next
) {

  const engine =
    getEngine(req);

  if (!engine) {

    return failure(
      res,
      'Automation Engine غير متصل.',
      503,
      'AUTOMATION_ENGINE_UNAVAILABLE'
    );

  }

  next();
}

/* ================================================================
 * 6. Health
 * ================================================================ */

router.get(
  '/health',
  (req, res) => {

    const engine =
      getEngine(req);

    if (!engine) {

      return failure(
        res,
        'Automation Engine غير متصل.',
        503,
        'ENGINE_UNAVAILABLE'
      );

    }

    return success(res, {
      healthy: true,

      engine:
        engine.statistics(),

      timestamp:
        now()
    });

  }
);

/* ================================================================
 * 7. Statistics
 * ================================================================ */

router.get(
  '/statistics',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    return success(res, {
      statistics:
        engine.statistics()
    });

  }
);

/* ================================================================
 * 8. قائمة Workflows
 * ================================================================ */

router.get(
  '/workflows',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    return success(res, {
      workflows:
        engine.getWorkflows()
    });

  }
);

/* ================================================================
 * 9. Workflow واحد
 * ================================================================ */

router.get(
  '/workflows/:workflowId',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const workflow =
      engine.getWorkflow(
        req.params.workflowId
      );

    if (!workflow) {

      return failure(
        res,
        'Workflow غير موجود.',
        404,
        'WORKFLOW_NOT_FOUND'
      );

    }

    return success(res, {
      workflow
    });

  }
);

/* ================================================================
 * 10. إنشاء Workflow
 * ================================================================ */

router.post(
  '/workflows',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const workflow =
        engine.registerWorkflow({
          id:
            req.body?.id,

          name:
            req.body?.name,

          description:
            req.body?.description || '',

          trigger:
            req.body?.trigger ||
            'manual',

          steps:
            req.body?.steps || [],

          enabled:
            req.body?.enabled !== false,

          metadata:
            req.body?.metadata || {}
        });

      const persistence =
        getPersistence(req);

      if (
        persistence &&
        typeof persistence.addAuditLog ===
        'function'
      ) {

        persistence.addAuditLog({
          action:
            'AUTOMATION_WORKFLOW_CREATED',

          actor:
            req.admin.id,

          requestId:
            req.headers['x-request-id'] ||
            generateId('request'),

          details: {
            workflowId:
              workflow.id
          }
        }).catch(() => {});

      }

      return success(
        res,
        { workflow },
        201
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'WORKFLOW_CREATE_FAILED'
      );

    }

  }
);

/* ================================================================
 * 11. حذف Workflow
 * ================================================================ */

router.delete(
  '/workflows/:workflowId',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const deleted =
      engine.unregisterWorkflow(
        req.params.workflowId
      );

    if (!deleted) {

      return failure(
        res,
        'Workflow غير موجود.',
        404,
        'WORKFLOW_NOT_FOUND'
      );

    }

    return success(res, {
      deleted: true,
      workflowId:
        req.params.workflowId
    });

  }
);

/* ================================================================
 * 12. تشغيل المحرك
 * ================================================================ */

router.post(
  '/engine/start',
  adminGuard,
  engineGuard,
  async (req, res) => {

    const engine =
      getEngine(req);

    try {

      const result =
        await engine.start({
          concurrency:
            req.body?.concurrency
        });

      return success(res, {
        result
      });

    } catch (error) {

      return failure(
        res,
        error.message,
        500,
        'ENGINE_START_FAILED'
      );

    }

  }
);

/* ================================================================
 * 13. إيقاف المحرك
 * ================================================================ */

router.post(
  '/engine/stop',
  adminGuard,
  engineGuard,
  async (req, res) => {

    const engine =
      getEngine(req);

    try {

      const result =
        await engine.stop();

      return success(res, {
        result
      });

    } catch (error) {

      return failure(
        res,
        error.message,
        500,
        'ENGINE_STOP_FAILED'
      );

    }

  }
);

/* ================================================================
 * 14. إيقاف مؤقت
 * ================================================================ */

router.post(
  '/engine/pause',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const result =
        engine.pause();

      return success(res, {
        result
      });

    } catch (error) {

      return failure(
        res,
        error.message,
        500,
        'ENGINE_PAUSE_FAILED'
      );

    }

  }
);

/* ================================================================
 * 15. استئناف
 * ================================================================ */

router.post(
  '/engine/resume',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const result =
        engine.resume();

      return success(res, {
        result
      });

    } catch (error) {

      return failure(
        res,
        error.message,
        500,
        'ENGINE_RESUME_FAILED'
      );

    }

  }
);

/* ================================================================
 * 16. إنشاء Task
 * ================================================================ */

router.post(
  '/tasks',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const {
      workflowId,
      payload = {},
      priority = 5,
      maxRetries,
      scheduledAt,
      metadata = {}
    } = req.body || {};

    if (!workflowId) {

      return failure(
        res,
        'workflowId مطلوب.',
        400,
        'WORKFLOW_ID_REQUIRED'
      );

    }

    try {

      const task =
        engine.createTask({
          workflowId,
          payload,
          priority,
          maxRetries,
          scheduledAt,
          metadata
        });

      return success(
        res,
        {
          task
        },
        201
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'TASK_CREATE_FAILED'
      );

    }

  }
);

/* ================================================================
 * 17. إدخال Task مباشرة إلى Queue
 * ================================================================ */

router.post(
  '/tasks/enqueue',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const task =
        engine.enqueue({
          workflowId:
            req.body?.workflowId,

          payload:
            req.body?.payload || {},

          priority:
            req.body?.priority || 5,

          maxRetries:
            req.body?.maxRetries,

          scheduledAt:
            req.body?.scheduledAt,

          metadata:
            req.body?.metadata || {}
        });

      return success(
        res,
        { task },
        202
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'TASK_ENQUEUE_FAILED'
      );

    }

  }
);

/* ================================================================
 * 18. Task
 * ================================================================ */

router.get(
  '/tasks/:taskId',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const task =
      engine.getTask(
        req.params.taskId
      );

    if (!task) {

      return failure(
        res,
        'Task غير موجود.',
        404,
        'TASK_NOT_FOUND'
      );

    }

    return success(res, {
      task
    });

  }
);

/* ================================================================
 * 19. إلغاء Task
 * ================================================================ */

router.post(
  '/tasks/:taskId/cancel',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const cancelled =
      engine.cancelTask(
        req.params.taskId
      );

    if (!cancelled) {

      return failure(
        res,
        'تعذر إلغاء المهمة.',
        409,
        'TASK_CANCEL_FAILED'
      );

    }

    return success(res, {
      cancelled: true,

      taskId:
        req.params.taskId
    });

  }
);

/* ================================================================
 * 20. تشغيل Task فورًا
 * ================================================================ */

router.post(
  '/tasks/:taskId/run',
  adminGuard,
  engineGuard,
  async (req, res) => {

    const engine =
      getEngine(req);

    const task =
      engine.getTask(
        req.params.taskId
      );

    if (!task) {

      return failure(
        res,
        'Task غير موجود.',
        404,
        'TASK_NOT_FOUND'
      );

    }

    try {

      const result =
        await engine.executeTask(
          task
        );

      return success(res, {
        task:
          result
      });

    } catch (error) {

      return failure(
        res,
        error.message,
        500,
        'TASK_EXECUTION_FAILED'
      );

    }

  }
);

/* ================================================================
 * 21. إرسال Event
 * ================================================================ */

router.post(
  '/events',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const {
      type,
      payload = {}
    } = req.body || {};

    if (!type) {

      return failure(
        res,
        'event type مطلوب.',
        400,
        'EVENT_TYPE_REQUIRED'
      );

    }

    const event = {
      id:
        generateId('automation_event'),

      type,

      source:
        'automation-api',

      payload,

      timestamp:
        now()
    };

    engine.emitter.emit(
      type,
      payload
    );

    const persistence =
      getPersistence(req);

    if (
      persistence &&
      typeof persistence.saveEvent ===
      'function'
    ) {

      persistence.saveEvent({
        eventType:
          type,

        source:
          'automation-api',

        actor:
          req.admin.id,

        payload,

        requestId:
          req.headers['x-request-id'] ||
          null
      }).catch(() => {});

    }

    return success(
      res,
      {
        event
      },
      202
    );

  }
);

/* ================================================================
 * 22. تشغيل الأخبار تلقائيًا
 * ================================================================ */

router.post(
  '/trigger/news',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const task =
        engine.enqueue({
          workflowId:
            'news-auto-publish',

          payload:
            req.body?.news ||
            req.body ||
            {},

          priority:
            req.body?.priority ||
            10,

          metadata: {
            trigger:
              'api',

            triggeredBy:
              req.admin.id
          }
        });

      return success(
        res,
        {
          triggered:
            true,

          task
        },
        202
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'NEWS_AUTOMATION_FAILED'
      );

    }

  }
);

/* ================================================================
 * 23. تشغيل خبر عاجل
 * ================================================================ */

router.post(
  '/trigger/breaking-news',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const task =
        engine.enqueue({
          workflowId:
            'breaking-news',

          payload:
            req.body?.news ||
            req.body ||
            {},

          priority:
            100,

          metadata: {
            trigger:
              'breaking-news-api',

            triggeredBy:
              req.admin.id
          }
        });

      return success(
        res,
        {
          triggered:
            true,

          urgent:
            true,

          task
        },
        202
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'BREAKING_NEWS_AUTOMATION_FAILED'
      );

    }

  }
);

/* ================================================================
 * 24. تشغيل المحتوى
 * ================================================================ */

router.post(
  '/trigger/content',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const task =
        engine.enqueue({
          workflowId:
            'content-auto-publish',

          payload:
            req.body?.content ||
            req.body ||
            {},

          priority:
            req.body?.priority ||
            7,

          metadata: {
            trigger:
              'content-api',

            triggeredBy:
              req.admin.id
          }
        });

      return success(
        res,
        {
          triggered:
            true,

          task
        },
        202
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'CONTENT_AUTOMATION_FAILED'
      );

    }

  }
);

/* ================================================================
 * 25. تشغيل الوسائط
 * ================================================================ */

router.post(
  '/trigger/media',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    try {

      const task =
        engine.enqueue({
          workflowId:
            'media-processing',

          payload:
            req.body?.media ||
            req.body ||
            {},

          priority:
            req.body?.priority ||
            6,

          metadata: {
            trigger:
              'media-api',

            triggeredBy:
              req.admin.id
          }
        });

      return success(
        res,
        {
          triggered:
            true,

          task
        },
        202
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'MEDIA_AUTOMATION_FAILED'
      );

    }

  }
);

/* ================================================================
 * 26. قراءة History
 * ================================================================ */

router.get(
  '/history',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const limit =
      Math.min(
        Math.max(
          Number(
            req.query.limit ||
            100
          ),
          1
        ),
        500
      );

    return success(res, {
      history:
        engine.history
          .slice(0, limit)
    });

  }
);

/* ================================================================
 * 27. قراءة Events من PostgreSQL
 * ================================================================ */

router.get(
  '/events/history',
  adminGuard,
  (req, res) => {

    const persistence =
      getPersistence(req);

    if (!persistence) {

      return failure(
        res,
        'طبقة الحفظ غير متصلة.',
        503,
        'PERSISTENCE_UNAVAILABLE'
      );

    }

    persistence
      .getEvents({
        limit:
          req.query.limit,

        offset:
          req.query.offset,

        eventType:
          req.query.eventType
      })
      .then(events => {

        return success(
          res,
          { events }
        );

      })
      .catch(error => {

        return failure(
          res,
          error.message,
          500,
          'EVENT_HISTORY_FAILED'
        );

      });

  }
);

/* ================================================================
 * 28. Audit للأتمتة
 * ================================================================ */

router.get(
  '/audit',
  adminGuard,
  (req, res) => {

    const persistence =
      getPersistence(req);

    if (!persistence) {

      return failure(
        res,
        'طبقة الحفظ غير متصلة.',
        503,
        'PERSISTENCE_UNAVAILABLE'
      );

    }

    persistence
      .getAuditLogs({
        limit:
          req.query.limit,

        offset:
          req.query.offset,

        action:
          req.query.action,

        actor:
          req.query.actor
      })
      .then(logs => {

        return success(
          res,
          { logs }
        );

      })
      .catch(error => {

        return failure(
          res,
          error.message,
          500,
          'AUTOMATION_AUDIT_FAILED'
        );

      });

  }
);

/* ================================================================
 * 29. AI Automation Trigger
 * ================================================================ */

router.post(
  '/trigger/ai',
  adminGuard,
  engineGuard,
  (req, res) => {

    const engine =
      getEngine(req);

    const {
      operation =
        'analyze',

      input = {},

      instructions = '',

      priority = 20
    } = req.body || {};

    try {

      const workflowId =
        `ai-${operation}`;

      if (
        !engine.getWorkflow(
          workflowId
        )
      ) {

        engine.registerWorkflow({
          id:
            workflowId,

          name:
            `AI ${operation}`,

          description:
            'AI automation workflow',

          trigger:
            'manual',

          steps: [
            {
              type:
                'ai',

              operation,

              instructions
            },

            {
              type:
                'event',

              eventType:
                'ai.automation.completed'
            }
          ]
        });

      }

      const task =
        engine.enqueue({
          workflowId,

          payload: input,

          priority,

          metadata: {
            operation,

            instructions,

            triggeredBy:
              req.admin.id
          }
        });

      return success(
        res,
        {
          triggered:
            true,

          task
        },
        202
      );

    } catch (error) {

      return failure(
        res,
        error.message,
        400,
        'AI_AUTOMATION_FAILED'
      );

    }

  }
);

/* ================================================================
 * 30. ملخص كامل
 * ================================================================ */

router.get(
  '/dashboard',
  adminGuard,
  engineGuard,
  async (req, res) => {

    const engine =
      getEngine(req);

    const persistence =
      getPersistence(req);

    const response = {
      engine:
        engine.statistics(),

      workflows:
        engine.getWorkflows(),

      recentHistory:
        engine.history.slice(
          0,
          20
        )
    };

    if (persistence) {

      try {

        response.platform =
          await persistence
            .getPlatformSummary();

      } catch (error) {

        response.platform = {
          error:
            error.message
        };

      }

    }

    return success(
      res,
      response
    );

  }
);

/* ================================================================
 * 31. تصدير
 * ================================================================ */

module.exports = router;
