/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 62
 * ================================================================
 *
 * AI COMMAND CENTER
 *
 * الملف:
 * src/routes/ai-command-center.js
 *
 * الوظيفة:
 * ------------------------------------------------
 * مركز القيادة الذكي لمنصة EZ MEDIA.
 *
 * يجمع:
 *
 * AI CORE
 * AI PROVIDER
 * AI ORCHESTRATOR
 * AUTOMATION ENGINE
 * PLATFORM PERSISTENCE
 * NOTIFICATION SERVICE
 *
 * ويقدم:
 *
 * 1. Dashboard
 * 2. Health
 * 3. AI Status
 * 4. AI Statistics
 * 5. Provider Status
 * 6. Orchestrator Status
 * 7. Automation Status
 * 8. Human Review Queue
 * 9. Active Plans
 * 10. Recent Plans
 * 11. Events
 * 12. Audit
 * 13. Alerts
 * 14. Usage
 * 15. System Snapshot
 * 16. Emergency Controls
 *
 * ================================================================
 */

'use strict';

const express =
  require('express');

const router =
  express.Router();

/* ================================================================
 * 1. Helpers
 * ================================================================ */

function now() {

  return new Date().toISOString();

}

function getAI(
  req
) {

  return (
    req.app.locals.aiCore ||
    null
  );

}

function getProvider(
  req
) {

  return (
    req.app.locals.aiProvider ||
    null
  );

}

function getOrchestrator(
  req
) {

  return (
    req.app.locals.aiOrchestrator ||
    null
  );

}

function getAutomation(
  req
) {

  return (
    req.app.locals.automationEngine ||
    null
  );

}

function getPersistence(
  req
) {

  return (
    req.app.locals.platformPersistence ||
    null
  );

}

/* ================================================================
 * 2. Response
 * ================================================================ */

function success(
  res,
  data = {},
  status = 200
) {

  return res
    .status(status)
    .json({

      success:
        true,

      timestamp:
        now(),

      ...data

    });

}

function failure(
  res,
  error,
  status = 500
) {

  return res
    .status(status)
    .json({

      success:
        false,

      timestamp:
        now(),

      error:
        error?.message ||
        String(error),

      code:
        error?.code ||
        'AI_COMMAND_CENTER_ERROR'

    });

}

/* ================================================================
 * 3. Admin Guard
 * ================================================================ */

function adminGuard(
  req,
  res,
  next
) {

  const key =
    process.env.PLATFORM_ADMIN_KEY;

  if (!key) {

    if (
      process.env.NODE_ENV ===
      'production'
    ) {

      return failure(
        res,
        new Error(
          'PLATFORM_ADMIN_KEY غير مضبوط.'
        ),
        503
      );

    }

    return next();

  }

  const supplied =
    req.headers[
      'x-platform-admin-key'
    ] ||
    req.headers[
      'x-admin-key'
    ];

  if (
    !supplied ||
    supplied !== key
  ) {

    return failure(
      res,
      new Error(
        'غير مصرح بالوصول.'
      ),
      401
    );

  }

  next();

}

/* ================================================================
 * 4. Safe Service Status
 * ================================================================ */

function serviceStatus(
  service
) {

  if (!service) {

    return {

      available:
        false,

      status:
        'unavailable'

    };

  }

  try {

    if (
      typeof service.status ===
      'function'
    ) {

      return {

        available:
          true,

        ...service.status()

      };

    }

    return {

      available:
        true,

      status:
        'available'

    };

  } catch (error) {

    return {

      available:
        true,

      status:
        'error',

      error:
        error.message

    };

  }

}

/* ================================================================
 * 5. Global Health
 * ================================================================ */

router.get(
  '/health',
  (
    req,
    res
  ) => {

    const ai =
      getAI(req);

    const provider =
      getProvider(req);

    const orchestrator =
      getOrchestrator(req);

    const automation =
      getAutomation(req);

    const persistence =
      getPersistence(req);

    const services = {

      aiCore:
        Boolean(ai),

      aiProvider:
        Boolean(provider),

      aiOrchestrator:
        Boolean(orchestrator),

      automationEngine:
        Boolean(automation),

      persistence:
        Boolean(persistence)

    };

    const healthy =
      Object.values(
        services
      ).every(Boolean);

    return success(
      res,
      {

        service:
          'EZ MEDIA AI COMMAND CENTER',

        status:
          healthy
            ? 'healthy'
            : 'degraded',

        services

      },

      healthy
        ? 200
        : 503

    );

  }
);

/* ================================================================
 * 6. Main Dashboard
 * ================================================================ */

router.get(
  '/dashboard',
  adminGuard,
  async (
    req,
    res
  ) => {

    try {

      const ai =
        getAI(req);

      const provider =
        getProvider(req);

      const orchestrator =
        getOrchestrator(req);

      const automation =
        getAutomation(req);

      const persistence =
        getPersistence(req);

      const orchestratorStatus =
        serviceStatus(
          orchestrator
        );

      const automationStatus =
        serviceStatus(
          automation
        );

      const aiStatus =
        serviceStatus(
          ai
        );

      const providerStatus =
        serviceStatus(
          provider
        );

      let summary = null;

      if (
        persistence &&
        typeof persistence
          .getPlatformSummary ===
        'function'
      ) {

        try {

          summary =
            await persistence
              .getPlatformSummary();

        } catch {

          summary =
            null;

        }

      }

      let plans = [];

      if (
        orchestrator &&
        typeof orchestrator.getPlans ===
        'function'
      ) {

        plans =
          orchestrator.getPlans(
            50
          );

      }

      const waitingHuman =
        plans.filter(
          plan =>
            plan.status ===
            'waiting-human-review'
        );

      const running =
        plans.filter(
          plan =>
            plan.status ===
            'running'
        );

      const completed =
        plans.filter(
          plan =>
            plan.status ===
            'completed'
        );

      const failed =
        plans.filter(
          plan =>
            plan.status ===
            'failed'
        );

      return success(
        res,
        {

          dashboard: {

            generatedAt:
              now(),

            platform:
              'EZ MEDIA',

            version:
              process.env.PLATFORM_VERSION ||
              '11.0.0',

            services: {

              aiCore:
                aiStatus,

              aiProvider:
                providerStatus,

              aiOrchestrator:
                orchestratorStatus,

              automation:
                automationStatus

            },

            plans: {

              total:
                plans.length,

              running:
                running.length,

              waitingHumanReview:
                waitingHuman.length,

              completed:
                completed.length,

              failed:
                failed.length

            },

            statistics: {

              ai:
                ai &&
                typeof ai.statistics ===
                'function'
                  ? ai.statistics()
                  : null,

              provider:
                provider &&
                typeof provider.statistics ===
                'function'
                  ? provider.statistics()
                  : null,

              orchestrator:
                orchestrator &&
                typeof orchestrator.statistics ===
                'function'
                  ? orchestrator.statistics()
                  : null,

              automation:
                automation &&
                typeof automation.statistics ===
                'function'
                  ? automation.statistics()
                  : null

            },

            recentPlans:
              plans.slice(
                0,
                20
              ),

            platformSummary:
              summary

          }

        }

      );

    } catch (error) {

      return failure(
        res,
        error

      );

    }

  }
);

/* ================================================================
 * 7. AI Status
 * ================================================================ */

router.get(
  '/ai/status',
  adminGuard,
  (
    req,
    res
  ) => {

    return success(
      res,
      {

        ai:
          serviceStatus(
            getAI(req)
          )

      }
    );

  }
);

/* ================================================================
 * 8. AI Statistics
 * ================================================================ */

router.get(
  '/ai/statistics',
  adminGuard,
  (
    req,
    res
  ) => {

    const ai =
      getAI(req);

    const provider =
      getProvider(req);

    return success(
      res,
      {

        core:
          ai &&
          typeof ai.statistics ===
          'function'
            ? ai.statistics()
            : null,

        provider:
          provider &&
          typeof provider.statistics ===
          'function'
            ? provider.statistics()
            : null

      }
    );

  }
);

/* ================================================================
 * 9. Provider
 * ================================================================ */

router.get(
  '/provider',
  adminGuard,
  (
    req,
    res
  ) => {

    const provider =
      getProvider(req);

    return success(
      res,
      {

        provider:
          serviceStatus(
            provider
          )

      }
    );

  }
);

/* ================================================================
 * 10. Orchestrator
 * ================================================================ */

router.get(
  '/orchestrator',
  adminGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    return success(
      res,
      {

        orchestrator:
          serviceStatus(
            orchestrator
          )

      }
    );

  }
);

/* ================================================================
 * 11. Automation
 * ================================================================ */

router.get(
  '/automation',
  adminGuard,
  (
    req,
    res
  ) => {

    const automation =
      getAutomation(req);

    return success(
      res,
      {

        automation:
          serviceStatus(
            automation
          )

      }
    );

  }
);

/* ================================================================
 * 12. Human Review Queue
 * ================================================================ */

router.get(
  '/human-review',
  adminGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    if (!orchestrator) {

      return failure(
        res,
        new Error(
          'AI Orchestrator غير متصل.'
        ),
        503
      );

    }

    const plans =
      orchestrator.getPlans(
        500
      );

    const queue =
      plans.filter(
        plan =>
          plan.status ===
          'waiting-human-review'
      );

    return success(
      res,
      {

        count:
          queue.length,

        queue

      }
    );

  }
);

/* ================================================================
 * 13. Active Plans
 * ================================================================ */

router.get(
  '/plans/active',
  adminGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    if (!orchestrator) {

      return failure(
        res,
        new Error(
          'AI Orchestrator غير متصل.'
        ),
        503
      );

    }

    const plans =
      orchestrator.getPlans(
        500
      );

    const active =
      plans.filter(
        plan =>
          plan.status ===
            'running' ||
          plan.status ===
            'created' ||
          plan.status ===
            'waiting-human-review'
      );

    return success(
      res,
      {

        count:
          active.length,

        plans:
          active

      }
    );

  }
);

/* ================================================================
 * 14. Recent Plans
 * ================================================================ */

router.get(
  '/plans/recent',
  adminGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    if (!orchestrator) {

      return failure(
        res,
        new Error(
          'AI Orchestrator غير متصل.'
        ),
        503
      );

    }

    const limit =
      Math.min(
        Math.max(
          Number(
            req.query.limit ||
            50
          ),
          1
        ),
        500
      );

    return success(
      res,
      {

        plans:
          orchestrator.getPlans(
            limit
          )

      }
    );

  }
);

/* ================================================================
 * 15. Alerts
 * ================================================================ */

router.get(
  '/alerts',
  adminGuard,
  async (
    req,
    res
  ) => {

    const alerts = [];

    const ai =
      getAI(req);

    const provider =
      getProvider(req);

    const orchestrator =
      getOrchestrator(req);

    const automation =
      getAutomation(req);

    if (!ai) {

      alerts.push({

        level:
          'critical',

        service:
          'ai-core',

        message:
          'AI Core غير متصل.'

      });

    }

    if (!provider) {

      alerts.push({

        level:
          'critical',

        service:
          'ai-provider',

        message:
          'AI Provider Gateway غير متصل.'

      });

    }

    if (!orchestrator) {

      alerts.push({

        level:
          'critical',

        service:
          'ai-orchestrator',

        message:
          'AI Orchestrator غير متصل.'

      });

    }

    if (!automation) {

      alerts.push({

        level:
          'warning',

        service:
          'automation',

        message:
          'Automation Engine غير متصل.'

      });

    }

    if (
      process.env.NODE_ENV ===
      'production' &&
      !process.env.OPENAI_API_KEY
    ) {

      alerts.push({

        level:
          'critical',

        service:
          'ai-provider',

        message:
          'OPENAI_API_KEY غير مضبوط.'

      });

    }

    if (
      process.env.NODE_ENV ===
      'production' &&
      !process.env.PLATFORM_ADMIN_KEY
    ) {

      alerts.push({

        level:
          'critical',

        service:
          'security',

        message:
          'PLATFORM_ADMIN_KEY غير مضبوط.'

      });

    }

    return success(
      res,
      {

        count:
          alerts.length,

        alerts

      }
    );

  }
);

/* ================================================================
 * 16. System Snapshot
 * ================================================================ */

router.get(
  '/snapshot',
  adminGuard,
  async (
    req,
    res
  ) => {

    const ai =
      getAI(req);

    const provider =
      getProvider(req);

    const orchestrator =
      getOrchestrator(req);

    const automation =
      getAutomation(req);

    const persistence =
      getPersistence(req);

    let database = null;

    if (
      persistence &&
      typeof persistence.health ===
      'function'
    ) {

      try {

        database =
          await persistence.health();

      } catch (error) {

        database = {

          healthy:
            false,

          error:
            error.message

        };

      }

    }

    return success(
      res,
      {

        snapshot: {

          timestamp:
            now(),

          platform: {

            name:
              'EZ MEDIA',

            version:
              process.env.PLATFORM_VERSION ||
              '11.0.0',

            environment:
              process.env.NODE_ENV ||
              'development'

          },

          database,

          ai:
            serviceStatus(
              ai
            ),

          provider:
            serviceStatus(
              provider
            ),

          orchestrator:
            serviceStatus(
              orchestrator
            ),

          automation:
            serviceStatus(
              automation
            )

        }

      }
    );

  }
);

/* ================================================================
 * 17. Events
 * ================================================================ */

router.get(
  '/events',
  adminGuard,
  async (
    req,
    res
  ) => {

    const persistence =
      getPersistence(req);

    if (
      !persistence ||
      typeof persistence.getEvents !==
      'function'
    ) {

      return success(
        res,
        {

          events: []

        }
      );

    }

    try {

      const events =
        await persistence
          .getEvents({

            limit:
              Math.min(
                Number(
                  req.query.limit ||
                  100
                ),
                500
              ),

            source:
              req.query.source ||
              'ai-orchestrator'

          });

      return success(
        res,
        {

          events

        }
      );

    } catch (error) {

      return failure(
        res,
        error

      );

    }

  }
);

/* ================================================================
 * 18. Audit
 * ================================================================ */

router.get(
  '/audit',
  adminGuard,
  async (
    req,
    res
  ) => {

    const persistence =
      getPersistence(req);

    if (
      !persistence ||
      typeof persistence.getAuditLogs !==
      'function'
    ) {

      return success(
        res,
        {

          audit: []

        }
      );

    }

    try {

      const audit =
        await persistence
          .getAuditLogs({

            limit:
              Math.min(
                Number(
                  req.query.limit ||
                  100
                ),
                500
              ),

            source:
              req.query.source ||
              'ai-orchestrator'

          });

      return success(
        res,
        {

          audit

        }
      );

    } catch (error) {

      return failure(
        res,
        error

      );

    }

  }
);

/* ================================================================
 * 19. Usage
 * ================================================================ */

router.get(
  '/usage',
  adminGuard,
  (
    req,
    res
  ) => {

    const provider =
      getProvider(req);

    const ai =
      getAI(req);

    const orchestrator =
      getOrchestrator(req);

    return success(
      res,
      {

        usage: {

          provider:
            provider &&
            typeof provider.statistics ===
            'function'
              ? provider.statistics()
              : null,

          aiCore:
            ai &&
            typeof ai.statistics ===
            'function'
              ? ai.statistics()
              : null,

          orchestrator:
            orchestrator &&
            typeof orchestrator.statistics ===
            'function'
              ? orchestrator.statistics()
              : null

        }

      }
    );

  }
);

/* ================================================================
 * 20. AI Command
 * ================================================================ */

router.post(
  '/command',
  adminGuard,
  async (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    if (!orchestrator) {

      return failure(
        res,
        new Error(
          'AI Orchestrator غير متصل.'
        ),
        503
      );

    }

    try {

      const command =
        String(
          req.body?.command ||
          ''
        ).trim();

      if (!command) {

        return failure(
          res,
          new Error(
            'command مطلوب.'
          ),
          400
        );

      }

      /*
       * لا يتم تنفيذ أوامر نظام التشغيل.
       * الأمر يتحول إلى طلب AI داخلي آمن.
       */

      const result =
        await orchestrator.process({

          type:
            req.body?.type ||
            'general',

          text:
            command,

          content:
            req.body?.content ||
            command,

          metadata: {

            source:
              'ai-command-center',

            requestedBy:
              req.headers[
                'x-admin-user'
              ] ||
              'admin'

          }

        }, {

          humanApproved:
            req.body?.humanApproved ===
            true,

          continueOnError:
            req.body?.continueOnError ===
            true

        });

      return success(
        res,
        {

          result

        }
      );

    } catch (error) {

      return failure(
        res,
        error

      );

    }

  }
);

/* ================================================================
 * 21. Emergency Stop
 * ================================================================ */

router.post(
  '/emergency-stop',
  adminGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    const automation =
      getAutomation(req);

    const result = {

      orchestrator:
        false,

      automation:
        false

    };

    try {

      if (
        orchestrator &&
        typeof orchestrator.stop ===
        'function'
      ) {

        orchestrator.stop();

        result.orchestrator =
          true;

      }

      if (
        automation &&
        typeof automation.stop ===
        'function'
      ) {

        automation.stop();

        result.automation =
          true;

      }

    } catch (error) {

      return failure(
        res,
        error

      );

    }

    return success(
      res,
      {

        emergencyStop:
          result,

        message:
          'تم إرسال أمر الإيقاف الطارئ للخدمات المدعومة.'

      }
    );

  }
);

/* ================================================================
 * 22. Resume
 * ================================================================ */

router.post(
  '/resume',
  adminGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    const automation =
      getAutomation(req);

    const result = {

      orchestrator:
        false,

      automation:
        false

    };

    try {

      if (
        orchestrator &&
        typeof orchestrator.initialize ===
        'function'
      ) {

        orchestrator.initialize();

        result.orchestrator =
          true;

      }

      if (
        automation &&
        typeof automation.resume ===
        'function'
      ) {

        automation.resume();

        result.automation =
          true;

      }

    } catch (error) {

      return failure(
        res,
        error

      );

    }

    return success(
      res,
      {

        resumed:
          result

      }
    );

  }
);

/* ================================================================
 * 23. Human Review Statistics
 * ================================================================ */

router.get(
  '/human-review/statistics',
  adminGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    if (!orchestrator) {

      return failure(
        res,
        new Error(
          'AI Orchestrator غير متصل.'
        ),
        503
      );

    }

    const plans =
      orchestrator.getPlans(
        500
      );

    const statistics = {

      total:
        plans.length,

      waiting:
        plans.filter(
          plan =>
            plan.status ===
            'waiting-human-review'
        ).length,

      approved:
        plans.filter(
          plan =>
            plan.humanApproval?.approved ===
            true
        ).length,

      rejected:
        plans.filter(
          plan =>
            plan.humanApproval?.approved ===
            false
        ).length

    };

    return success(
      res,
      {

        statistics

      }
    );

  }
);

/* ================================================================
 * 24. Platform AI Summary
 * ================================================================ */

router.get(
  '/summary',
  adminGuard,
  async (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(req);

    const automation =
      getAutomation(req);

    const ai =
      getAI(req);

    const provider =
      getProvider(req);

    return success(
      res,
      {

        summary: {

          platform:
            'EZ MEDIA',

          ai: {

            core:
              serviceStatus(ai),

            provider:
              serviceStatus(provider),

            orchestrator:
              serviceStatus(orchestrator)

          },

          automation:
            serviceStatus(
              automation
            ),

          generatedAt:
            now()

        }

      }
    );

  }
);

/* ================================================================
 * 25. Export
 * ================================================================ */

module.exports =
  router;
