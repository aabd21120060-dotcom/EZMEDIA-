/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 56
 * ================================================================
 *
 * Central Intelligent Automation Engine
 *
 * المسؤوليات:
 * - إنشاء وإدارة Workflows
 * - تشغيل المهام آليًا
 * - Queue داخلية
 * - Retry
 * - Priority
 * - Scheduling
 * - AI-ready processing
 * - Content pipeline
 * - News pipeline
 * - Media pipeline
 * - Publishing pipeline
 * - Notifications
 * - Audit integration
 * - PostgreSQL persistence integration
 * - Event Bus integration
 *
 * المسار الأساسي:
 *
 * SOURCE
 *   ↓
 * INGEST
 *   ↓
 * ANALYZE
 *   ↓
 * AI
 *   ↓
 * REVIEW
 *   ↓
 * STORE
 *   ↓
 * PUBLISH
 *   ↓
 * NOTIFY
 *   ↓
 * ANALYTICS
 *
 * ================================================================
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

/* ================================================================
 * 1. Constants
 * ================================================================ */

const ENGINE_NAME =
  'EZ MEDIA Intelligent Automation Engine';

const ENGINE_VERSION =
  '11.0.0';

const DEFAULT_MAX_RETRIES =
  Number(process.env.AUTOMATION_MAX_RETRIES || 3);

const DEFAULT_CONCURRENCY =
  Number(process.env.AUTOMATION_CONCURRENCY || 3);

const DEFAULT_TIMEOUT =
  Number(
    process.env.AUTOMATION_TASK_TIMEOUT_MS ||
    120000
  );

const MAX_HISTORY =
  Number(
    process.env.AUTOMATION_HISTORY_LIMIT ||
    5000
  );

/* ================================================================
 * 2. Helpers
 * ================================================================ */

function id(prefix = 'auto') {
  return `${prefix}_${Date.now()}_${crypto
    .randomBytes(7)
    .toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

/* ================================================================
 * 3. Engine
 * ================================================================ */

function createAutomationEngine({
  persistence = null,
  aiService = null,
  notificationService = null,
  mediaService = null,
  cmsService = null,
  eventBus = null,
  logger = console
} = {}) {

  const emitter =
    eventBus || new EventEmitter();

  const workflows = new Map();

  const tasks = new Map();

  const history = [];

  const queue = [];

  const workers = [];

  const state = {
    running: false,
    paused: false,
    startedAt: null,
    processed: 0,
    successful: 0,
    failed: 0,
    retries: 0,
    activeWorkers: 0,
    queuedTasks: 0
  };

  /* ==============================================================
   * 4. Logging
   * ============================================================== */

  function log(...args) {

    if (
      logger &&
      typeof logger.log === 'function'
    ) {
      logger.log(
        '[EZ MEDIA][AUTOMATION]',
        ...args
      );
    }
  }

  function errorLog(...args) {

    if (
      logger &&
      typeof logger.error === 'function'
    ) {
      logger.error(
        '[EZ MEDIA][AUTOMATION]',
        ...args
      );
    }
  }

  /* ==============================================================
   * 5. History
   * ============================================================== */

  function addHistory(entry) {

    history.unshift({
      id: id('history'),
      timestamp: now(),
      ...entry
    });

    if (
      history.length >
      MAX_HISTORY
    ) {
      history.length =
        MAX_HISTORY;
    }
  }

  /* ==============================================================
   * 6. Workflow Registration
   * ============================================================== */

  function registerWorkflow({
    id: workflowId,
    name,
    description = '',
    trigger = 'manual',
    steps = [],
    enabled = true,
    metadata = {}
  }) {

    if (!workflowId) {
      throw new Error(
        'workflow id مطلوب'
      );
    }

    if (
      workflows.has(workflowId)
    ) {
      throw new Error(
        `Workflow موجود مسبقًا: ${workflowId}`
      );
    }

    if (
      !Array.isArray(steps) ||
      !steps.length
    ) {
      throw new Error(
        'Workflow يحتاج خطوة واحدة على الأقل'
      );
    }

    const workflow = {
      id: workflowId,
      name:
        name ||
        workflowId,
      description,
      trigger,
      steps,
      enabled,
      metadata,
      createdAt: now(),
      updatedAt: now()
    };

    workflows.set(
      workflowId,
      workflow
    );

    addHistory({
      type: 'workflow_registered',
      workflowId
    });

    return workflow;
  }

  /* ==============================================================
   * 7. حذف Workflow
   * ============================================================== */

  function unregisterWorkflow(
    workflowId
  ) {

    const deleted =
      workflows.delete(
        workflowId
      );

    if (deleted) {
      addHistory({
        type:
          'workflow_unregistered',
        workflowId
      });
    }

    return deleted;
  }

  /* ==============================================================
   * 8. قراءة Workflow
   * ============================================================== */

  function getWorkflow(
    workflowId
  ) {
    return (
      workflows.get(
        workflowId
      ) || null
    );
  }

  /* ==============================================================
   * 9. جميع Workflows
   * ============================================================== */

  function getWorkflows() {
    return Array.from(
      workflows.values()
    );
  }

  /* ==============================================================
   * 10. إنشاء Task
   * ============================================================== */

  function createTask({
    workflowId,
    payload = {},
    priority = 5,
    maxRetries =
      DEFAULT_MAX_RETRIES,
    scheduledAt = null,
    metadata = {}
  }) {

    const workflow =
      getWorkflow(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        `Workflow غير موجود: ${workflowId}`
      );
    }

    if (!workflow.enabled) {
      throw new Error(
        `Workflow متوقف: ${workflowId}`
      );
    }

    const task = {
      id: id('task'),

      workflowId,

      payload,

      priority,

      maxRetries,

      retries: 0,

      status: 'queued',

      scheduledAt,

      metadata,

      createdAt: now(),

      startedAt: null,

      completedAt: null,

      failedAt: null,

      error: null,

      result: null
    };

    tasks.set(
      task.id,
      task
    );

    queue.push(task);

    queue.sort(
      (a, b) =>
        b.priority -
        a.priority
    );

    state.queuedTasks =
      queue.length;

    addHistory({
      type: 'task_created',
      taskId: task.id,
      workflowId
    });

    return task;
  }

  /* ==============================================================
   * 11. إزالة Task من Queue
   * ============================================================== */

  function dequeueTask() {

    const currentTime =
      Date.now();

    const index =
      queue.findIndex(
        task => {

          if (
            !task.scheduledAt
          ) {
            return true;
          }

          return (
            new Date(
              task.scheduledAt
            ).getTime() <=
            currentTime
          );
        }
      );

    if (index === -1) {
      return null;
    }

    const [task] =
      queue.splice(
        index,
        1
      );

    state.queuedTasks =
      queue.length;

    return task;
  }

  /* ==============================================================
   * 12. Timeout Wrapper
   * ============================================================== */

  async function withTimeout(
    promise,
    timeout = DEFAULT_TIMEOUT
  ) {

    let timer;

    const timeoutPromise =
      new Promise(
        (_, reject) => {

          timer =
            setTimeout(() => {

              reject(
                new Error(
                  'Automation task timeout'
                )
              );

            }, timeout);
        }
      );

    try {

      return await Promise.race([
        promise,
        timeoutPromise
      ]);

    } finally {

      clearTimeout(
        timer
      );

    }
  }

  /* ==============================================================
   * 13. AI Step
   * ============================================================== */

  async function executeAIStep(
    step,
    context
  ) {

    if (!aiService) {

      return {
        skipped: true,
        reason:
          'AI service غير متصل',
        input:
          context.data
      };

    }

    if (
      typeof aiService.execute ===
      'function'
    ) {

      return aiService.execute({
        operation:
          step.operation ||
          'analyze',

        input:
          context.data,

        instructions:
          step.instructions ||
          '',

        metadata:
          context.metadata
      });

    }

    if (
      typeof aiService.analyze ===
      'function'
    ) {

      return aiService.analyze(
        context.data,
        step.instructions || ''
      );

    }

    return {
      skipped: true,
      reason:
        'AI service لا يحتوي على execute أو analyze'
    };
  }

  /* ==============================================================
   * 14. Storage Step
   * ============================================================== */

  async function executeStorageStep(
    step,
    context
  ) {

    if (
      persistence &&
      typeof persistence.saveEvent ===
      'function'
    ) {

      await persistence.saveEvent({
        eventType:
          step.eventType ||
          'automation.storage',

        source:
          'automation-engine',

        actor:
          context.task.id,

        payload:
          context.data
      });
    }

    return {
      stored: true,
      data: context.data
    };
  }

  /* ==============================================================
   * 15. CMS Step
   * ============================================================== */

  async function executeCMSStep(
    step,
    context
  ) {

    if (!cmsService) {

      return {
        skipped: true,
        reason:
          'CMS service غير متصل'
      };

    }

    if (
      typeof cmsService.publish ===
      'function'
    ) {

      return cmsService.publish({
        ...context.data,
        channel:
          step.channel ||
          'website'
      });

    }

    if (
      typeof cmsService.create ===
      'function'
    ) {

      return cmsService.create(
        context.data
      );

    }

    return {
      skipped: true,
      reason:
        'CMS service غير متوافق'
    };
  }

  /* ==============================================================
   * 16. Media Step
   * ============================================================== */

  async function executeMediaStep(
    step,
    context
  ) {

    if (!mediaService) {

      return {
        skipped: true,
        reason:
          'Media service غير متصل'
      };

    }

    if (
      typeof mediaService.process ===
      'function'
    ) {

      return mediaService.process({
        operation:
          step.operation ||
          'process',

        input:
          context.data
      });

    }

    return {
      skipped: true,
      reason:
        'Media service غير متوافق'
    };
  }

  /* ==============================================================
   * 17. Notification Step
   * ============================================================== */

  async function executeNotificationStep(
    step,
    context
  ) {

    if (!notificationService) {

      return {
        skipped: true,
        reason:
          'Notification service غير متصل'
      };

    }

    const payload = {
      type:
        step.type ||
        'automation',

      title:
        step.title ||
        'EZ MEDIA',

      message:
        step.message ||
        'Automation event',

      data:
        context.data
    };

    if (
      typeof notificationService.send ===
      'function'
    ) {

      return notificationService.send(
        payload
      );

    }

    if (
      typeof notificationService.notify ===
      'function'
    ) {

      return notificationService.notify(
        payload
      );

    }

    return {
      skipped: true,
      reason:
        'Notification service غير متوافق'
    };
  }

  /* ==============================================================
   * 18. Event Step
   * ============================================================== */

  async function executeEventStep(
    step,
    context
  ) {

    const event = {
      id: id('event'),

      type:
        step.eventType ||
        'automation.event',

      source:
        'automation-engine',

      taskId:
        context.task.id,

      workflowId:
        context.task.workflowId,

      payload:
        context.data,

      timestamp:
        now()
    };

    emitter.emit(
      event.type,
      event
    );

    if (
      persistence &&
      typeof persistence.saveEvent ===
      'function'
    ) {

      await persistence.saveEvent({
        eventType:
          event.type,

        source:
          event.source,

        actor:
          context.task.id,

        payload:
          event.payload
      });

    }

    return event;
  }

  /* ==============================================================
   * 19. Generic Step
   * ============================================================== */

  async function executeStep(
    step,
    context
  ) {

    const type =
      step.type ||
      'transform';

    switch (type) {

      case 'ai':
        return executeAIStep(
          step,
          context
        );

      case 'storage':
        return executeStorageStep(
          step,
          context
        );

      case 'cms':
      case 'publish':
        return executeCMSStep(
          step,
          context
        );

      case 'media':
        return executeMediaStep(
          step,
          context
        );

      case 'notification':
        return executeNotificationStep(
          step,
          context
        );

      case 'event':
        return executeEventStep(
          step,
          context
        );

      case 'delay':
        await sleep(
          Number(
            step.ms || 1000
          )
        );

        return {
          delayed: true,
          milliseconds:
            Number(
              step.ms || 1000
            )
        };

      case 'transform':

        if (
          typeof step.transform ===
          'function'
        ) {

          return step.transform(
            context.data,
            context
          );

        }

        return context.data;

      default:

        throw new Error(
          `نوع Automation Step غير معروف: ${type}`
        );
    }
  }

  /* ==============================================================
   * 20. Execute Workflow
   * ============================================================== */

  async function executeTask(
    task
  ) {

    const workflow =
      getWorkflow(
        task.workflowId
      );

    if (!workflow) {
      throw new Error(
        `Workflow غير موجود: ${task.workflowId}`
      );
    }

    task.status =
      'running';

    task.startedAt =
      now();

    state.activeWorkers++;

    const context = {
      task,
      workflow,
      data:
        task.payload,
      metadata:
        task.metadata,
      results: []
    };

    try {

      if (
        persistence &&
        typeof persistence.addAuditLog ===
        'function'
      ) {

        await persistence.addAuditLog({
          action:
            'AUTOMATION_STARTED',

          actor:
            task.id,

          status:
            'success',

          details: {
            workflowId:
              task.workflowId
          }
        });

      }

      for (
        let i = 0;
        i < workflow.steps.length;
        i++
      ) {

        const step =
          workflow.steps[i];

        const result =
          await withTimeout(
            Promise.resolve(
              executeStep(
                step,
                context
              )
            ),
            step.timeout ||
              DEFAULT_TIMEOUT
          );

        context.results.push({
          step:
            i + 1,

          type:
            step.type,

          result
        });

        if (
          typeof result !==
          'undefined'
        ) {

          context.data =
            result;
        }
      }

      task.status =
        'completed';

      task.completedAt =
        now();

      task.result =
        context.data;

      state.processed++;

      state.successful++;

      addHistory({
        type:
          'task_completed',

        taskId:
          task.id,

        workflowId:
          task.workflowId
      });

      if (
        persistence &&
        typeof persistence.addAuditLog ===
        'function'
      ) {

        await persistence.addAuditLog({
          action:
            'AUTOMATION_COMPLETED',

          actor:
            task.id,

          status:
            'success',

          details: {
            workflowId:
              task.workflowId
          }
        });

      }

      emitter.emit(
        'automation.completed',
        task
      );

      return task;

    } catch (error) {

      task.retries++;

      state.retries++;

      if (
        task.retries <=
        task.maxRetries
      ) {

        task.status =
          'retrying';

        task.error =
          error.message;

        queue.push(task);

        queue.sort(
          (a, b) =>
            b.priority -
            a.priority
        );

        addHistory({
          type:
            'task_retry',

          taskId:
            task.id,

          workflowId:
            task.workflowId,

          retry:
            task.retries,

          error:
            error.message
        });

        return task;

      }

      task.status =
        'failed';

      task.failedAt =
        now();

      task.error =
        error.message;

      state.processed++;

      state.failed++;

      addHistory({
        type:
          'task_failed',

        taskId:
          task.id,

        workflowId:
          task.workflowId,

        error:
          error.message
      });

      if (
        persistence &&
        typeof persistence.addAuditLog ===
        'function'
      ) {

        await persistence.addAuditLog({
          action:
            'AUTOMATION_FAILED',

          actor:
            task.id,

          status:
            'failed',

          details: {
            workflowId:
              task.workflowId,

            error:
              error.message
          }
        });

      }

      emitter.emit(
        'automation.failed',
        task
      );

      errorLog(
        'Automation task failed',
        task.id,
        error
      );

      return task;

    } finally {

      state.activeWorkers--;

    }
  }

  /* ==============================================================
   * 21. Worker
   * ============================================================== */

  async function workerLoop(
    workerId
  ) {

    while (
      state.running
    ) {

      if (
        state.paused
      ) {

        await sleep(500);

        continue;
      }

      const task =
        dequeueTask();

      if (!task) {

        await sleep(250);

        continue;
      }

      try {

        await executeTask(
          task
        );

      } catch (error) {

        errorLog(
          `Worker ${workerId} error`,
          error
        );

      }

    }

  }

  /* ==============================================================
   * 22. Start
   * ============================================================== */

  async function start({
    concurrency =
      DEFAULT_CONCURRENCY
  } = {}) {

    if (
      state.running
    ) {

      return {
        started: false,
        reason:
          'engine_already_running'
      };

    }

    state.running =
      true;

    state.paused =
      false;

    state.startedAt =
      now();

    const workersCount =
      Math.max(
        Number(concurrency) || 1,
        1
      );

    for (
      let i = 0;
      i < workersCount;
      i++
    ) {

      const worker =
        workerLoop(
          i + 1
        );

      workers.push(
        worker
      );

    }

    addHistory({
      type:
        'engine_started'
    });

    emitter.emit(
      'automation.started'
    );

    log(
      `Automation Engine started with ${workersCount} workers`
    );

    return {
      started: true,
      workers:
        workersCount
    };
  }

  /* ==============================================================
   * 23. Stop
   * ============================================================== */

  async function stop() {

    state.running =
      false;

    state.paused =
      false;

    workers.length =
      0;

    addHistory({
      type:
        'engine_stopped'
    });

    emitter.emit(
      'automation.stopped'
    );

    return {
      stopped: true
    };
  }

  /* ==============================================================
   * 24. Pause
   * ============================================================== */

  function pause() {

    state.paused =
      true;

    emitter.emit(
      'automation.paused'
    );

    return {
      paused: true
    };
  }

  /* ==============================================================
   * 25. Resume
   * ============================================================== */

  function resume() {

    state.paused =
      false;

    emitter.emit(
      'automation.resumed'
    );

    return {
      paused: false
    };
  }

  /* ==============================================================
   * 26. Queue Task
   * ============================================================== */

  function enqueue(
    options
  ) {

    const task =
      createTask(
        options
      );

    emitter.emit(
      'automation.queued',
      task
    );

    return task;
  }

  /* ==============================================================
   * 27. قراءة Task
   * ============================================================== */

  function getTask(
    taskId
  ) {

    return (
      tasks.get(
        taskId
      ) || null
    );
  }

  /* ==============================================================
   * 28. إلغاء Task
   * ============================================================== */

  function cancelTask(
    taskId
  ) {

    const task =
      getTask(
        taskId
      );

    if (!task) {
      return false;
    }

    if (
      task.status ===
      'completed'
    ) {
      return false;
    }

    task.status =
      'cancelled';

    const index =
      queue.findIndex(
        item =>
          item.id ===
          taskId
      );

    if (index !== -1) {

      queue.splice(
        index,
        1
      );

    }

    state.queuedTasks =
      queue.length;

    addHistory({
      type:
        'task_cancelled',

      taskId
    });

    emitter.emit(
      'automation.cancelled',
      task
    );

    return true;
  }

  /* ==============================================================
   * 29. Statistics
   * ============================================================== */

  function statistics() {

    return {

      engine: {
        name:
          ENGINE_NAME,

        version:
          ENGINE_VERSION,

        running:
          state.running,

        paused:
          state.paused,

        startedAt:
          state.startedAt
      },

      workflows: {
        total:
          workflows.size,

        enabled:
          Array.from(
            workflows.values()
          ).filter(
            workflow =>
              workflow.enabled
          ).length
      },

      tasks: {
        total:
          tasks.size,

        queued:
          queue.length,

        active:
          state.activeWorkers,

        processed:
          state.processed,

        successful:
          state.successful,

        failed:
          state.failed,

        retries:
          state.retries
      },

      generatedAt:
        now()
    };
  }

  /* ==============================================================
   * 30. Built-in Workflows
   * ============================================================== */

  function registerBuiltInWorkflows() {

    const workflowsList = [

      {
        id:
          'news-auto-publish',

        name:
          'النشر الإخباري الذكي',

        description:
          'تحليل الخبر ثم تجهيزه للنشر وإرسال الإشعارات.',

        trigger:
          'news.received',

        steps: [

          {
            type:
              'ai',

            operation:
              'analyze-news',

            instructions:
              'حلل الخبر وحدد التصنيف والعنوان والملخص والأولوية.'
          },

          {
            type:
              'storage',

            eventType:
              'news.analyzed'
          },

          {
            type:
              'notification',

            type:
              'news-ready',

            title:
              'خبر جديد',

            message:
              'تم تحليل خبر جديد بواسطة EZ MEDIA.'
          }

        ]
      },

      {
        id:
          'content-auto-publish',

        name:
          'النشر الذكي للمحتوى',

        description:
          'معالجة المحتوى وتجهيزه للنشر.',

        trigger:
          'content.created',

        steps: [

          {
            type:
              'ai',

            operation:
              'content-optimize',

            instructions:
              'حسن العنوان والوصف والكلمات المفتاحية.'
          },

          {
            type:
              'storage',

            eventType:
              'content.optimized'
          },

          {
            type:
              'event',

            eventType:
              'content.ready'
          }

        ]
      },

      {
        id:
          'media-processing',

        name:
          'معالجة الوسائط',

        description:
          'تمرير ملفات الوسائط إلى خدمة المعالجة.',

        trigger:
          'media.uploaded',

        steps: [

          {
            type:
              'media',

            operation:
              'process'
          },

          {
            type:
              'event',

            eventType:
              'media.processed'
          }

        ]
      },

      {
        id:
          'breaking-news',

        name:
          'الأخبار العاجلة',

        description:
          'مسار سريع للأخبار ذات الأولوية العالية.',

        trigger:
          'breaking-news',

        steps: [

          {
            type:
              'ai',

            operation:
              'breaking-news-analysis',

            instructions:
              'حدد درجة الاستعجال، التصنيف، والتنبيه التحريري.'
          },

          {
            type:
              'event',

            eventType:
              'breaking-news.analyzed'
          },

          {
            type:
              'notification',

            type:
              'breaking-news',

            title:
              'عاجل',

            message:
              'تمت معالجة خبر عاجل.'
          }

        ]
      }

    ];

    for (
      const workflow
      of workflowsList
    ) {

      if (
        !workflows.has(
          workflow.id
        )
      ) {

        registerWorkflow(
          workflow
        );

      }

    }

    return getWorkflows();
  }

  /* ==============================================================
   * 31. Event Integration
   * ============================================================== */

  function connectEvents() {

    emitter.on(
      'news.received',
      payload => {

        try {

          enqueue({
            workflowId:
              'news-auto-publish',

            payload,

            priority:
              10
          });

        } catch (error) {

          errorLog(
            'news.received automation error',
            error
          );

        }

      }
    );

    emitter.on(
      'content.created',
      payload => {

        try {

          enqueue({
            workflowId:
              'content-auto-publish',

            payload,

            priority:
              7
          });

        } catch (error) {

          errorLog(
            'content.created automation error',
            error
          );

        }

      }
    );

    emitter.on(
      'media.uploaded',
      payload => {

        try {

          enqueue({
            workflowId:
              'media-processing',

            payload,

            priority:
              6
          });

        } catch (error) {

          errorLog(
            'media.uploaded automation error',
            error
          );

        }

      }
    );

    emitter.on(
      'breaking-news',
      payload => {

        try {

          enqueue({
            workflowId:
              'breaking-news',

            payload,

            priority:
              100
          });

        } catch (error) {

          errorLog(
            'breaking-news automation error',
            error
          );

        }

      }
    );

  }

  /* ==============================================================
   * 32. Initialize
   * ============================================================== */

  function initialize() {

    registerBuiltInWorkflows();

    connectEvents();

    return {
      initialized: true,

      workflows:
        workflows.size,

      engine:
        ENGINE_NAME
    };
  }

  /* ==============================================================
   * 33. Public API
   * ============================================================== */

  return {

    initialize,

    start,

    stop,

    pause,

    resume,

    registerWorkflow,

    unregisterWorkflow,

    getWorkflow,

    getWorkflows,

    createTask,

    enqueue,

    getTask,

    cancelTask,

    statistics,

    executeTask,

    emitter,

    state,

    history

  };
}

/* ================================================================
 * 34. Export
 * ================================================================ */

module.exports = {
  createAutomationEngine,
  ENGINE_NAME,
  ENGINE_VERSION
};
