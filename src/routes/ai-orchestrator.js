/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 61
 * ================================================================
 *
 * AI ORCHESTRATOR API
 *
 * الملف:
 * src/routes/ai-orchestrator.js
 *
 * الوظيفة:
 * ------------------------------------------------
 * واجهة API كاملة لعقل الذكاء الاصطناعي المركزي.
 *
 * تشمل:
 *
 * 1. Health
 * 2. Status
 * 3. Statistics
 * 4. Operations
 * 5. Plans
 * 6. Create Plan
 * 7. Execute Plan
 * 8. Approve Plan
 * 9. Reject Plan
 * 10. Cancel Plan
 * 11. Process News
 * 12. Breaking News
 * 13. Content
 * 14. Media
 * 15. Advertising
 * 16. Sponsorship
 * 17. Automation
 * 18. History
 * 19. AI Dashboard
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

function getOrchestrator(
  req
) {

  return (
    req.app.locals.aiOrchestrator ||
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
 * 2. Response Helpers
 * ================================================================ */

function success(
  res,
  data = {},
  statusCode = 200
) {

  return res
    .status(statusCode)
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
  statusCode = 500
) {

  return res
    .status(statusCode)
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
        'AI_ORCHESTRATOR_ERROR'

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

  const configuredKey =
    process.env.PLATFORM_ADMIN_KEY;

  /*
   * في بيئة التطوير يمكن السماح إذا لم يتم
   * ضبط المفتاح، لكن في الإنتاج يجب ضبطه.
   */

  if (!configuredKey) {

    if (
      process.env.NODE_ENV ===
      'production'
    ) {

      return failure(
        res,
        new Error(
          'PLATFORM_ADMIN_KEY غير مضبوط في بيئة الإنتاج.'
        ),
        503
      );

    }

    return next();

  }

  const suppliedKey =
    req.headers[
      'x-platform-admin-key'
    ] ||
    req.headers[
      'x-admin-key'
    ];

  if (
    !suppliedKey ||
    suppliedKey !== configuredKey
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
 * 4. Orchestrator Guard
 * ================================================================ */

function orchestratorGuard(
  req,
  res,
  next
) {

  const orchestrator =
    getOrchestrator(
      req
    );

  if (!orchestrator) {

    return failure(
      res,
      new Error(
        'AI Orchestrator غير متصل.'
      ),
      503
    );

  }

  next();

}

/* ================================================================
 * 5. Health
 * ================================================================ */

router.get(
  '/health',
  (req, res) => {

    const orchestrator =
      getOrchestrator(
        req
      );

    if (!orchestrator) {

      return failure(
        res,
        new Error(
          'AI Orchestrator unavailable.'
        ),
        503
      );

    }

    return success(
      res,
      {

        service:
          'ai-orchestrator',

        status:
          orchestrator.started
            ? 'healthy'
            : 'stopped',

        enabled:
          orchestrator.enabled,

        version:
          orchestrator.version

      }
    );

  }
);

/* ================================================================
 * 6. Status
 * ================================================================ */

router.get(
  '/status',
  orchestratorGuard,
  (req, res) => {

    return success(
      res,
      {

        status:
          getOrchestrator(
            req
          ).status()

      }
    );

  }
);

/* ================================================================
 * 7. Statistics
 * ================================================================ */

router.get(
  '/statistics',
  orchestratorGuard,
  (req, res) => {

    return success(
      res,
      {

        statistics:
          getOrchestrator(
            req
          ).statistics()

      }
    );

  }
);

/* ================================================================
 * 8. Operations
 * ================================================================ */

router.get(
  '/operations',
  orchestratorGuard,
  (req, res) => {

    return success(
      res,
      {

        operations:
          getOrchestrator(
            req
          ).getOperations()

      }
    );

  }
);

/* ================================================================
 * 9. Plans
 * ================================================================ */

router.get(
  '/plans',
  orchestratorGuard,
  (req, res) => {

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

    return success(
      res,
      {

        plans:
          getOrchestrator(
            req
          ).getPlans(
            limit
          )

      }
    );

  }
);

/* ================================================================
 * 10. Get Single Plan
 * ================================================================ */

router.get(
  '/plans/:planId',
  orchestratorGuard,
  (req, res) => {

    const plan =
      getOrchestrator(
        req
      ).getPlan(
        req.params.planId
      );

    if (!plan) {

      return failure(
        res,
        new Error(
          'الخطة غير موجودة.'
        ),
        404
      );

    }

    return success(
      res,
      {

        plan

      }
    );

  }
);

/* ================================================================
 * 11. Create Plan
 * ================================================================ */

router.post(
  '/plans',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const plan =
        await getOrchestrator(
          req
        ).createPlan(
          req.body || {}
        );

      return success(
        res,
        {

          plan

        },
        201
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
 * 12. Execute Plan
 * ================================================================ */

router.post(
  '/plans/:planId/execute',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).executePlan(

          req.params.planId,

          req.body || {}

        );

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
 * 13. Approve Plan
 * ================================================================ */

router.post(
  '/plans/:planId/approve',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).approvePlan(

          req.params.planId,

          {

            approvedBy:
              req.body?.approvedBy ||
              req.headers[
                'x-admin-user'
              ] ||
              'admin',

            note:
              req.body?.note ||
              ''

          }

        );

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
 * 14. Reject Plan
 * ================================================================ */

router.post(
  '/plans/:planId/reject',
  adminGuard,
  orchestratorGuard,
  (
    req,
    res
  ) => {

    try {

      const result =
        getOrchestrator(
          req
        ).rejectPlan(

          req.params.planId,

          {

            rejectedBy:
              req.body?.rejectedBy ||
              req.headers[
                'x-admin-user'
              ] ||
              'admin',

            note:
              req.body?.note ||
              ''

          }

        );

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
 * 15. Cancel Plan
 * ================================================================ */

router.post(
  '/plans/:planId/cancel',
  adminGuard,
  orchestratorGuard,
  (
    req,
    res
  ) => {

    try {

      const result =
        getOrchestrator(
          req
        ).cancelPlan(

          req.params.planId,

          req.body?.reason ||
          'Cancelled by administrator'

        );

      if (!result) {

        return failure(
          res,
          new Error(
            'تعذر إلغاء الخطة.'
          ),
          400
        );

      }

      return success(
        res,
        {

          cancelled:
            true,

          planId:
            req.params.planId

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
 * 16. Generic Process
 * ================================================================ */

router.post(
  '/process',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).process(

          req.body || {},

          req.body?.context ||
          {}

        );

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
 * 17. Breaking News
 * ================================================================ */

router.post(
  '/process/breaking-news',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).processBreakingNews(

          req.body?.news ||
          req.body,

          req.body?.options ||
          {}

        );

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
 * 18. News
 * ================================================================ */

router.post(
  '/process/news',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).processNews(

          req.body?.news ||
          req.body,

          req.body?.options ||
          {}

        );

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
 * 19. Content
 * ================================================================ */

router.post(
  '/process/content',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).processContent(

          req.body?.content ||
          req.body,

          req.body?.options ||
          {}

        );

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
 * 20. Media
 * ================================================================ */

router.post(
  '/process/media',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).processMedia(

          req.body?.media ||
          req.body,

          req.body?.options ||
          {}

        );

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
 * 21. Advertising
 * ============================================================== */

router.post(
  '/process/advertising',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).processAdvertising(

          req.body?.campaign ||
          req.body,

          req.body?.options ||
          {}

        );

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
 * 22. Sponsorship
 * ============================================================== */

router.post(
  '/process/sponsorship',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await getOrchestrator(
          req
        ).processSponsorship(

          req.body?.sponsorship ||
          req.body,

          req.body?.options ||
          {}

        );

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
 * 23. Automation
 * ================================================================ */

router.post(
  '/automation/enqueue',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const workflowId =
        req.body?.workflowId;

      if (!workflowId) {

        return failure(
          res,
          new Error(
            'workflowId مطلوب.'
          ),
          400
        );

      }

      const result =
        await getOrchestrator(
          req
        ).enqueueAutomation(

          workflowId,

          req.body?.payload ||
          {},

          {

            priority:
              req.body?.priority,

            maxRetries:
              req.body?.maxRetries,

            scheduledAt:
              req.body?.scheduledAt,

            planId:
              req.body?.planId

          }

        );

      return success(
        res,
        {

          task:
            result

        },
        202
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
 * 24. History
 * ================================================================ */

router.get(
  '/history',
  orchestratorGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(
        req
      );

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

    return success(
      res,
      {

        history:
          orchestrator.history
            .slice(
              0,
              limit
            )

      }
    );

  }
);

/* ================================================================
 * 25. Database Audit
 * ================================================================ */

router.get(
  '/audit',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    const persistence =
      getPersistence(
        req
      );

    if (
      !persistence ||
      typeof persistence.getAuditLogs !==
      'function'
    ) {

      return success(
        res,
        {

          audit: [],

          source:
            'memory/unavailable'

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
 * 26. Dashboard
 * ================================================================ */

router.get(
  '/dashboard',
  adminGuard,
  orchestratorGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(
        req
      );

    const statistics =
      orchestrator.statistics();

    const plans =
      orchestrator.getPlans(
        20
      );

    const waiting =
      plans.filter(
        plan =>
          plan.status ===
          'waiting-human-review'
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

          service:
            orchestrator.name,

          version:
            orchestrator.version,

          status:
            orchestrator.status(),

          statistics,

          planCounts: {

            total:
              plans.length,

            waitingHumanReview:
              waiting.length,

            completed:
              completed.length,

            failed:
              failed.length

          },

          recentPlans:
            plans

        }

      }
    );

  }
);

/* ================================================================
 * 27. Decision Endpoint
 * ================================================================ */

router.post(
  '/decision',
  adminGuard,
  orchestratorGuard,
  async (
    req,
    res
  ) => {

    try {

      const request =
        req.body || {};

      const intent =
        getOrchestrator(
          req
        ).determineIntent(
          request
        );

      const operations =
        getOrchestrator(
          req
        ).determineOperations(
          request,
          intent
        );

      const humanReview =
        getOrchestrator(
          req
        ).requiresHumanReview(
          request,
          intent,
          operations
        );

      return success(
        res,
        {

          decision: {

            intent:
              intent.intent,

            priority:
              intent.priority,

            operations,

            requiresHumanReview:
              humanReview

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
 * 28. Start
 * ================================================================ */

router.post(
  '/start',
  adminGuard,
  orchestratorGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(
        req
      );

    orchestrator.initialize();

    return success(
      res,
      {

        status:
          orchestrator.status()

      }
    );

  }
);

/* ================================================================
 * 29. Stop
 * ================================================================ */

router.post(
  '/stop',
  adminGuard,
  orchestratorGuard,
  (
    req,
    res
  ) => {

    const orchestrator =
      getOrchestrator(
        req
      );

    orchestrator.stop();

    return success(
      res,
      {

        status:
          orchestrator.status()

      }
    );

  }
);

/* ================================================================
 * 30. Export
 * ================================================================ */

module.exports =
  router;
