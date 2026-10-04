/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 60
 * ================================================================
 *
 * AI ORCHESTRATOR
 *
 * الملف:
 * src/services/ai-orchestrator.js
 *
 * الوظيفة:
 *
 * AI CORE
 *    ↓
 * AI ORCHESTRATOR
 *    ↓
 * ┌─────────────────────────────────────────────┐
 * │ فهم المهمة                                  │
 * │ تحديد نوع العملية                           │
 * │ اختيار الأدوات                              │
 * │ تحديد الأولوية                              │
 * │ تحديد الحاجة للمراجعة البشرية               │
 * │ إنشاء خطة التنفيذ                            │
 * │ تنفيذ الخطوات                               │
 * │ إرسال النتيجة للأتمتة                       │
 * └─────────────────────────────────────────────┘
 *
 * ================================================================
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

/* ================================================================
 * 1. Constants
 * ================================================================ */

const SERVICE_NAME =
  'EZ MEDIA AI ORCHESTRATOR';

const VERSION =
  process.env.PLATFORM_VERSION ||
  '11.0.0';

const MAX_PLAN_STEPS =
  Number(
    process.env.AI_ORCHESTRATOR_MAX_STEPS ||
    20
  );

const DEFAULT_TIMEOUT =
  Number(
    process.env.AI_ORCHESTRATOR_TIMEOUT_MS ||
    120000
  );

/* ================================================================
 * 2. Helpers
 * ================================================================ */

function createId(prefix = 'orchestrator') {

  return (
    `${prefix}_${Date.now()}_` +
    crypto.randomBytes(6).toString('hex')
  );

}

function now() {

  return new Date().toISOString();

}

function clone(value) {

  try {

    return JSON.parse(
      JSON.stringify(value)
    );

  } catch {

    return value;

  }

}

/* ================================================================
 * 3. AI Orchestrator
 * ================================================================ */

class AIOrchestrator
  extends EventEmitter {

  constructor(options = {}) {

    super();

    this.name =
      SERVICE_NAME;

    this.version =
      VERSION;

    this.logger =
      options.logger ||
      console;

    this.aiCore =
      options.aiCore ||
      null;

    this.aiProvider =
      options.aiProvider ||
      null;

    this.automationEngine =
      options.automationEngine ||
      null;

    this.persistence =
      options.persistence ||
      null;

    this.notificationService =
      options.notificationService ||
      null;

    this.enabled =
      options.enabled !== false;

    this.started =
      false;

    this.timeout =
      options.timeout ||
      DEFAULT_TIMEOUT;

    this.maxPlanSteps =
      options.maxPlanSteps ||
      MAX_PLAN_STEPS;

    this.history = [];

    this.plans = new Map();

    this.operations = new Map();

    this.statisticsData = {

      requests:
        0,

      plansCreated:
        0,

      plansExecuted:
        0,

      successful:
        0,

      failed:
        0,

      humanReviews:
        0,

      automationTasks:
        0,

      aiCalls:
        0,

      totalDurationMs:
        0

    };

  }

  /* ==============================================================
   * 4. Initialize
   * ============================================================== */

  initialize() {

    if (this.started) {

      return this.status();

    }

    this.started =
      true;

    this.emit(
      'initialized',
      {
        service:
          this.name,

        version:
          this.version,

        timestamp:
          now()
      }
    );

    return this.status();

  }

  /* ==============================================================
   * 5. Stop
   * ============================================================== */

  stop() {

    this.started =
      false;

    this.emit(
      'stopped',
      {
        timestamp:
          now()
      }
    );

    return this.status();

  }

  /* ==============================================================
   * 6. Status
   * ============================================================== */

  status() {

    return {

      service:
        this.name,

      version:
        this.version,

      started:
        this.started,

      enabled:
        this.enabled,

      plans:
        this.plans.size,

      operations:
        this.operations.size,

      statistics:
        this.statistics()

    };

  }

  /* ==============================================================
   * 7. Statistics
   * ============================================================== */

  statistics() {

    const total =
      this.statisticsData.requests;

    return {

      ...this.statisticsData,

      averageDurationMs:
        total
          ? Math.round(
              this.statisticsData
                .totalDurationMs /
              total
            )
          : 0

    };

  }

  /* ==============================================================
   * 8. Register Operation
   * ============================================================== */

  registerOperation(
    name,
    handler,
    options = {}
  ) {

    if (
      typeof handler !==
      'function'
    ) {

      throw new Error(
        `Handler غير صالح للعملية: ${name}`
      );

    }

    this.operations.set(
      name,
      {

        name,

        handler,

        description:
          options.description ||
          '',

        category:
          options.category ||
          'general',

        requiresHumanReview:
          Boolean(
            options.requiresHumanReview
          ),

        enabled:
          options.enabled !== false,

        priority:
          options.priority ||
          5

      }
    );

    return this.operations.get(
      name
    );

  }

  /* ==============================================================
   * 9. Unregister Operation
   * ============================================================== */

  unregisterOperation(
    name
  ) {

    return this.operations.delete(
      name
    );

  }

  /* ==============================================================
   * 10. Get Operations
   * ============================================================== */

  getOperations() {

    return Array.from(
      this.operations.values()
    ).map(
      operation => ({
        ...operation,
        handler:
          undefined
      })
    );

  }

  /* ==============================================================
   * 11. Determine Intent
   * ============================================================== */

  determineIntent(
    request = {}
  ) {

    const text =
      String(
        request.text ||
        request.content ||
        request.prompt ||
        ''
      ).toLowerCase();

    const type =
      String(
        request.type ||
        ''
      ).toLowerCase();

    if (
      type === 'breaking-news' ||
      text.includes('خبر عاجل')
    ) {

      return {
        intent:
          'breaking-news',

        priority:
          100
      };

    }

    if (
      type === 'news' ||
      text.includes('خبر') ||
      text.includes('أخبار')
    ) {

      return {
        intent:
          'news',

        priority:
          90
      };

    }

    if (
      type === 'content'
    ) {

      return {
        intent:
          'content',

        priority:
          60
      };

    }

    if (
      type === 'media'
    ) {

      return {
        intent:
          'media',

        priority:
          50
      };

    }

    if (
      type === 'advertising'
    ) {

      return {
        intent:
          'advertising',

        priority:
          50
      };

    }

    if (
      type === 'sponsorship'
    ) {

      return {
        intent:
          'sponsorship',

        priority:
          50
      };

    }

    if (
      type === 'live'
    ) {

      return {
        intent:
          'live',

        priority:
          100
      };

    }

    return {

      intent:
        'general',

      priority:
        30

    };

  }

  /* ==============================================================
   * 12. Determine Operations
   * ============================================================== */

  determineOperations(
    request,
    intent
  ) {

    const explicit =
      Array.isArray(
        request.operations
      )
        ? request.operations
        : null;

    if (explicit) {

      return explicit;

    }

    switch (
      intent.intent
    ) {

      case 'breaking-news':

        return [

          'analyze-news',

          'fact-check',

          'risk-analysis',

          'generate-title',

          'summarize',

          'publishing-decision',

          'notify'

        ];

      case 'news':

        return [

          'analyze-news',

          'classify',

          'fact-check',

          'summarize',

          'generate-title',

          'seo',

          'risk-analysis',

          'publishing-decision'

        ];

      case 'content':

        return [

          'analyze-content',

          'classify',

          'summarize',

          'seo',

          'score-content',

          'publishing-decision'

        ];

      case 'media':

        return [

          'analyze-media',

          'classify',

          'score-content'

        ];

      case 'advertising':

        return [

          'analyze-advertising',

          'audience-analysis',

          'risk-analysis'

        ];

      case 'sponsorship':

        return [

          'analyze-sponsorship',

          'audience-analysis',

          'risk-analysis'

        ];

      case 'live':

        return [

          'risk-analysis',

          'publishing-decision',

          'notify'

        ];

      default:

        return [

          'analyze-content',

          'classify',

          'score-content'

        ];

    }

  }

  /* ==============================================================
   * 13. Human Review Decision
   * ============================================================== */

  requiresHumanReview(
    request,
    intent,
    operations
  ) {

    if (
      request.requireHumanApproval ===
      true
    ) {

      return true;

    }

    if (
      request.requireHumanApproval ===
      false
    ) {

      return false;

    }

    if (
      intent.intent ===
      'breaking-news'
    ) {

      return (
        process.env.AI_BREAKING_NEWS_HUMAN_REVIEW !==
        'false'
      );

    }

    if (
      operations.includes(
        'fact-check'
      )
    ) {

      return (
        process.env.AI_FACT_CHECK_HUMAN_REVIEW ===
        'true'
      );

    }

    if (
      operations.includes(
        'publishing-decision'
      )
    ) {

      return (
        process.env.AI_PUBLISHING_HUMAN_REVIEW !==
        'false'
      );

    }

    return false;

  }

  /* ==============================================================
   * 14. Create Plan
   * ============================================================== */

  async createPlan(
    request = {}
  ) {

    if (!this.enabled) {

      throw new Error(
        'AI Orchestrator متوقف.'
      );

    }

    if (!this.started) {

      this.initialize();

    }

    this.statisticsData
      .requests++;

    const planId =
      createId(
        'ai_plan'
      );

    const intent =
      this.determineIntent(
        request
      );

    const operations =
      this.determineOperations(
        request,
        intent
      );

    const limitedOperations =
      operations.slice(
        0,
        this.maxPlanSteps
      );

    const humanReview =
      this.requiresHumanReview(
        request,
        intent,
        limitedOperations
      );

    const steps =
      limitedOperations.map(
        (operation, index) => {

          const registered =
            this.operations.get(
              operation
            );

          return {

            id:
              `${planId}_step_${index + 1}`,

            order:
              index + 1,

            operation,

            category:
              registered?.category ||
              'ai',

            enabled:
              registered?.enabled !== false,

            requiresHumanReview:
              Boolean(
                registered?.requiresHumanReview
              ),

            priority:
              registered?.priority ||
              intent.priority,

            status:
              'pending'

          };

        }
      );

    const plan = {

      id:
        planId,

      createdAt:
        now(),

      status:
        'created',

      intent:
        intent.intent,

      priority:
        intent.priority,

      requiresHumanReview:
        humanReview,

      steps,

      input:
        clone(
          request
        ),

      metadata:
        clone(
          request.metadata ||
          {}
        )

    };

    this.plans.set(
      planId,
      plan
    );

    this.statisticsData
      .plansCreated++;

    this.recordHistory({

      type:
        'plan-created',

      planId,

      intent:
        plan.intent,

      priority:
        plan.priority,

      requiresHumanReview:
        plan.requiresHumanReview

    });

    await this.persistEvent(
      'ai.orchestrator.plan.created',
      plan
    );

    this.emit(
      'plan-created',
      plan
    );

    return plan;

  }

  /* ==============================================================
   * 15. Get Plan
   * ============================================================== */

  getPlan(
    planId
  ) {

    return this.plans.get(
      planId
    ) || null;

  }

  /* ==============================================================
   * 16. Get Plans
   * ============================================================== */

  getPlans(
    limit = 100
  ) {

    return Array.from(
      this.plans.values()
    )
      .slice(
        -Math.min(
          Math.max(
            Number(limit) || 100,
            1
          ),
          500
        )
      )
      .reverse();

  }

  /* ==============================================================
   * 17. Execute Plan
   * ============================================================== */

  async executePlan(
    planId,
    context = {}
  ) {

    const started =
      Date.now();

    const plan =
      this.getPlan(
        planId
      );

    if (!plan) {

      throw new Error(
        'خطة الذكاء الاصطناعي غير موجودة.'
      );

    }

    if (
      plan.status ===
      'running'
    ) {

      throw new Error(
        'الخطة قيد التنفيذ بالفعل.'
      );

    }

    if (
      plan.requiresHumanReview &&
      !context.humanApproved
    ) {

      plan.status =
        'waiting-human-review';

      this.statisticsData
        .humanReviews++;

      await this.persistEvent(
        'ai.orchestrator.human-review-required',
        plan
      );

      this.emit(
        'human-review-required',
        plan
      );

      return {

        success:
          true,

        status:
          'waiting-human-review',

        plan

      };

    }

    plan.status =
      'running';

    plan.startedAt =
      now();

    const results = {};

    this.statisticsData
      .plansExecuted++;

    try {

      for (
        const step of plan.steps
      ) {

        if (
          step.enabled === false
        ) {

          step.status =
            'skipped';

          continue;

        }

        step.status =
          'running';

        step.startedAt =
          now();

        try {

          const result =
            await this.executeStep(
              step,
              plan,
              {
                ...context,
                previousResults:
                  results
              }
            );

          results[
            step.operation
          ] =
            result;

          step.result =
            result;

          step.status =
            'completed';

          step.completedAt =
            now();

        } catch (error) {

          step.status =
            'failed';

          step.error =
            error.message;

          step.completedAt =
            now();

          /*
           * يمكن للخطة الاستمرار عند تحديد
           * continueOnError.
           */

          if (
            context.continueOnError !==
            true
          ) {

            throw error;

          }

        }

      }

      plan.status =
        'completed';

      plan.completedAt =
        now();

      plan.results =
        results;

      this.statisticsData
        .successful++;

      const duration =
        Date.now() -
        started;

      this.statisticsData
        .totalDurationMs +=
        duration;

      await this.persistEvent(
        'ai.orchestrator.plan.completed',
        plan
      );

      this.emit(
        'plan-completed',
        plan
      );

      return {

        success:
          true,

        plan,

        durationMs:
          duration

      };

    } catch (error) {

      plan.status =
        'failed';

      plan.error =
        error.message;

      plan.failedAt =
        now();

      this.statisticsData
        .failed++;

      const duration =
        Date.now() -
        started;

      this.statisticsData
        .totalDurationMs +=
        duration;

      await this.persistEvent(
        'ai.orchestrator.plan.failed',
        {

          planId:
            plan.id,

          error:
            error.message

        }
      );

      this.emit(
        'plan-failed',
        {

          plan,

          error:
            error.message

        }
      );

      throw error;

    }

  }

  /* ==============================================================
   * 18. Execute Step
   * ============================================================== */

  async executeStep(
    step,
    plan,
    context
  ) {

    const operation =
      this.operations.get(
        step.operation
      );

    if (
      operation &&
      operation.enabled === false
    ) {

      return {

        skipped:
          true,

        reason:
          'operation-disabled'

      };

    }

    /*
     * عمليات النظام الأساسية
     */

    switch (
      step.operation
    ) {

      case 'analyze-content':

        return this.callAICore(
          'analyzeContent',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input
          ]
        );

      case 'analyze-news':

        return this.callAICore(
          'analyzeNews',
          [
            plan.input.news ||
            plan.input.content ||
            plan.input
          ]
        );

      case 'classify':

        return this.callAICore(
          'classify',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.categories ||
            []
          ]
        );

      case 'summarize':

        return this.callAICore(
          'summarize',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'generate-title':

        return this.callAICore(
          'generateTitle',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'seo':

        return this.callAICore(
          'generateSEO',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'fact-check':

        return this.callAICore(
          'factCheck',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.sources ||
            []
          ]
        );

      case 'risk-analysis':

        return this.callAICore(
          'riskAnalysis',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'score-content':

        return this.callAICore(
          'scoreContent',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'publishing-decision':

        return this.callAICore(
          'publishingDecision',
          [
            plan.input.content ||
            plan.input.text ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'analyze-media':

        return this.callAICore(
          'analyzeMedia',
          [
            plan.input.media ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'analyze-advertising':

        return this.callAICore(
          'analyzeAdvertising',
          [
            plan.input.campaign ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'analyze-sponsorship':

        return this.callAICore(
          'analyzeSponsorship',
          [
            plan.input.sponsorship ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'audience-analysis':

        return this.callAICore(
          'analyzeAudience',
          [
            plan.input.audience ||
            plan.input,
            plan.input.options ||
            {}
          ]
        );

      case 'notify':

        return this.sendNotification(
          plan,
          context
        );

      default:

        return this.executeRegisteredOperation(
          step.operation,
          plan,
          context
        );

    }

  }

  /* ==============================================================
   * 19. Call AI Core
   * ============================================================== */

  async callAICore(
    method,
    args
  ) {

    if (!this.aiCore) {

      throw new Error(
        'AI Core غير متصل.'
      );

    }

    if (
      typeof this.aiCore[method] !==
      'function'
    ) {

      throw new Error(
        `AI Core method غير موجود: ${method}`
      );

    }

    this.statisticsData
      .aiCalls++;

    return this.aiCore[
      method
    ](
      ...args
    );

  }

  /* ==============================================================
   * 20. Execute Registered Operation
   * ============================================================== */

  async executeRegisteredOperation(
    operationName,
    plan,
    context
  ) {

    const operation =
      this.operations.get(
        operationName
      );

    if (!operation) {

      throw new Error(
        `عملية AI غير مسجلة: ${operationName}`
      );

    }

    if (
      operation.enabled === false
    ) {

      return {

        skipped:
          true,

        reason:
          'operation-disabled'

      };

    }

    this.statisticsData
      .aiCalls++;

    return operation.handler({

      plan,

      context,

      aiCore:
        this.aiCore,

      aiProvider:
        this.aiProvider,

      automationEngine:
        this.automationEngine

    });

  }

  /* ==============================================================
   * 21. إرسال إشعار
   * ============================================================== */

  async sendNotification(
    plan,
    context
  ) {

    if (
      !this.notificationService
    ) {

      return {

        notified:
          false,

        reason:
          'notification-service-unavailable'

      };

    }

    const payload = {

      type:
        plan.intent ===
        'breaking-news'
          ? 'breaking-news'
          : 'ai-automation',

      title:
        plan.intent ===
        'breaking-news'
          ? 'خبر عاجل'
          : 'تنفيذ ذكي',

      message:
        context.message ||
        `تم تنفيذ خطة الذكاء الاصطناعي ${plan.id}`,

      planId:
        plan.id

    };

    if (
      typeof this.notificationService
        .send ===
      'function'
    ) {

      return this.notificationService
        .send(
          payload
        );

    }

    if (
      typeof this.notificationService
        .notify ===
      'function'
    ) {

      return this.notificationService
        .notify(
          payload
        );

    }

    return {

      notified:
        false,

      reason:
        'notification-method-unavailable'

    };

  }

  /* ==============================================================
   * 22. إرسال المهمة للأتمتة
   * ============================================================== */

  async enqueueAutomation(
    workflowId,
    payload = {},
    options = {}
  ) {

    if (
      !this.automationEngine
    ) {

      throw new Error(
        'Automation Engine غير متصل.'
      );

    }

    if (
      typeof this.automationEngine
        .enqueue !==
      'function'
    ) {

      throw new Error(
        'Automation Engine لا يدعم enqueue.'
      );

    }

    this.statisticsData
      .automationTasks++;

    const task =
      this.automationEngine
        .enqueue({

          workflowId,

          payload,

          priority:
            options.priority ||
            5,

          maxRetries:
            options.maxRetries,

          scheduledAt:
            options.scheduledAt,

          metadata: {

            source:
              'ai-orchestrator',

            planId:
              options.planId ||
              null

          }

        });

    await this.persistEvent(
      'ai.orchestrator.automation.enqueued',
      {

        workflowId,

        taskId:
          task?.id ||
          null,

        planId:
          options.planId ||
          null

      }
    );

    return task;

  }

  /* ==============================================================
   * 23. Auto Process
   * ============================================================== */

  async process(
    request = {},
    context = {}
  ) {

    const plan =
      await this.createPlan(
        request
      );

    if (
      plan.requiresHumanReview &&
      !context.humanApproved
    ) {

      return {

        success:
          true,

        status:
          'waiting-human-review',

        plan

      };

    }

    return this.executePlan(
      plan.id,
      context
    );

  }

  /* ==============================================================
   * 24. Breaking News
   * ============================================================== */

  async processBreakingNews(
    news,
    options = {}
  ) {

    return this.process(

      {

        type:
          'breaking-news',

        news,

        content:
          news?.content,

        requireHumanApproval:
          options.requireHumanApproval,

        metadata:
          options.metadata

      },

      options

    );

  }

  /* ==============================================================
   * 25. News
   * ============================================================== */

  async processNews(
    news,
    options = {}
  ) {

    return this.process(

      {

        type:
          'news',

        news,

        content:
          news?.content,

        requireHumanApproval:
          options.requireHumanApproval,

        metadata:
          options.metadata

      },

      options

    );

  }

  /* ==============================================================
   * 26. Content
   * ============================================================== */

  async processContent(
    content,
    options = {}
  ) {

    return this.process(

      {

        type:
          'content',

        content,

        requireHumanApproval:
          options.requireHumanApproval,

        metadata:
          options.metadata

      },

      options

    );

  }

  /* ==============================================================
   * 27. Media
   * ============================================================== */

  async processMedia(
    media,
    options = {}
  ) {

    return this.process(

      {

        type:
          'media',

        media,

        requireHumanApproval:
          options.requireHumanApproval,

        metadata:
          options.metadata

      },

      options

    );

  }

  /* ==============================================================
   * 28. Advertising
   * ============================================================== */

  async processAdvertising(
    campaign,
    options = {}
  ) {

    return this.process(

      {

        type:
          'advertising',

        campaign,

        requireHumanApproval:
          options.requireHumanApproval,

        metadata:
          options.metadata

      },

      options

    );

  }

  /* ==============================================================
   * 29. Sponsorship
   * ============================================================== */

  async processSponsorship(
    sponsorship,
    options = {}
  ) {

    return this.process(

      {

        type:
          'sponsorship',

        sponsorship,

        requireHumanApproval:
          options.requireHumanApproval,

        metadata:
          options.metadata

      },

      options

    );

  }

  /* ==============================================================
   * 30. Human Approval
   * ============================================================== */

  async approvePlan(
    planId,
    options = {}
  ) {

    const plan =
      this.getPlan(
        planId
      );

    if (!plan) {

      throw new Error(
        'الخطة غير موجودة.'
      );

    }

    if (
      plan.status !==
      'waiting-human-review'
    ) {

      throw new Error(
        'الخطة ليست بانتظار المراجعة البشرية.'
      );

    }

    plan.humanApproval = {

      approved:
        true,

      approvedBy:
        options.approvedBy ||
        'admin',

      approvedAt:
        now(),

      note:
        options.note ||
        ''

    };

    return this.executePlan(
      planId,
      {

        ...options,

        humanApproved:
          true

      }
    );

  }

  /* ==============================================================
   * 31. رفض الخطة
   * ============================================================== */

  rejectPlan(
    planId,
    options = {}
  ) {

    const plan =
      this.getPlan(
        planId
      );

    if (!plan) {

      throw new Error(
        'الخطة غير موجودة.'
      );

    }

    plan.status =
      'rejected';

    plan.humanApproval = {

      approved:
        false,

      rejectedBy:
        options.rejectedBy ||
        'admin',

      rejectedAt:
        now(),

      note:
        options.note ||
        ''

    };

    this.persistEvent(
      'ai.orchestrator.plan.rejected',
      plan
    ).catch(() => {});

    this.emit(
      'plan-rejected',
      plan
    );

    return plan;

  }

  /* ==============================================================
   * 32. إلغاء الخطة
   * ============================================================== */

  cancelPlan(
    planId,
    reason = ''
  ) {

    const plan =
      this.getPlan(
        planId
      );

    if (!plan) {

      return false;

    }

    if (
      plan.status ===
      'completed'
    ) {

      return false;

    }

    plan.status =
      'cancelled';

    plan.cancelledAt =
      now();

    plan.cancelReason =
      reason;

    this.persistEvent(
      'ai.orchestrator.plan.cancelled',
      plan
    ).catch(() => {});

    return true;

  }

  /* ==============================================================
   * 33. History
   * ============================================================== */

  recordHistory(
    entry
  ) {

    this.history.unshift({

      id:
        createId(
          'ai_history'
        ),

      timestamp:
        now(),

      ...clone(
        entry
      )

    });

    if (
      this.history.length >
      500
    ) {

      this.history =
        this.history.slice(
          0,
          500
        );

    }

  }

  /* ==============================================================
   * 34. Persistence
   * ============================================================== */

  async persistEvent(
    eventType,
    payload
  ) {

    if (
      !this.persistence
    ) {

      return;

    }

    try {

      if (
        typeof this.persistence
          .saveEvent ===
        'function'
      ) {

        await this.persistence
          .saveEvent({

            eventType,

            source:
              'ai-orchestrator',

            payload:
              clone(payload)

          });

      }

    } catch (error) {

      this.logger.warn(
        '[AI ORCHESTRATOR] Persistence error:',
        error.message
      );

    }

  }

}

/* ================================================================
 * 35. Factory
 * ================================================================ */

function createAIOrchestrator(
  options = {}
) {

  return new AIOrchestrator(
    options
  );

}

/* ================================================================
 * 36. Export
 * ================================================================ */

module.exports = {

  AIOrchestrator,

  createAIOrchestrator,

  SERVICE_NAME,

  VERSION

};
