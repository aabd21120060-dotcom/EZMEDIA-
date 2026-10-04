"use strict";

/*
 * EZ MEDIA
 * CODE 116
 *
 * Intelligent AI Mission Scheduler
 * & Autonomous Operations Engine
 *
 * المسؤوليات:
 * - جدولة مهام AI
 * - المهام الفورية
 * - المهام المؤجلة
 * - المهام المتكررة
 * - الأولويات
 * - إعادة المحاولة
 * - اكتشاف المهام المتأخرة
 * - تشغيل Multi-Agent Missions
 * - مراقبة المهام
 * - إيقاف المهام الحساسة
 * - Human-in-the-Loop
 *
 * لا ينفذ أوامر نظام تشغيل.
 */

function createIntelligentAIMissionSchedulerEngine(
  options = {}
) {
  const {
    collaborationEngine,
    agentEngine,
    approvalEngine,
    memoryEngine,
    persistence,
    commandEngine,
    notificationService,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,

    jobsCreated: 0,
    jobsStarted: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    jobsCancelled: 0,
    jobsRetried: 0,

    overdueJobs: 0,
    approvalJobs: 0,

    lastTickAt: null,
    lastError: null
  };

  const jobs = new Map();

  const MAX_JOBS = Number(
    process.env.AI_SCHEDULER_MAX_JOBS || 100000
  );

  const MAX_RETRIES = Number(
    process.env.AI_SCHEDULER_MAX_RETRIES || 3
  );

  const TICK_MS = Number(
    process.env.AI_SCHEDULER_TICK_MS || 5000
  );

  const DEFAULT_TIMEOUT_MS = Number(
    process.env.AI_SCHEDULER_TIMEOUT_MS || 180000
  );

  const OVERDUE_AFTER_MS = Number(
    process.env.AI_SCHEDULER_OVERDUE_AFTER_MS || 300000
  );

  const REQUIRE_HUMAN_APPROVAL =
    process.env.AI_SCHEDULER_REQUIRE_HUMAN_APPROVAL !==
    "false";

  let timer = null;

  function now() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }

  function safeString(
    value,
    max = 10000
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value).slice(
      0,
      max
    );
  }

  function parseTime(value) {
    const time =
      new Date(value);

    if (
      Number.isNaN(
        time.getTime()
      )
    ) {
      return null;
    }

    return time;
  }

  function normalizePriority(
    priority
  ) {
    const allowed = [
      "critical",
      "urgent",
      "high",
      "normal",
      "low"
    ];

    return allowed.includes(
      priority
    )
      ? priority
      : "normal";
  }

  function priorityScore(
    priority
  ) {
    const map = {
      critical: 100,
      urgent: 90,
      high: 75,
      normal: 50,
      low: 25
    };

    return (
      map[
        normalizePriority(
          priority
        )
      ] || 50
    );
  }

  async function audit(
    action,
    metadata = {}
  ) {
    try {
      if (
        persistence &&
        typeof persistence.addAuditLog ===
          "function"
      ) {
        await persistence.addAuditLog({
          actorType:
            "ai_mission_scheduler",

          action,

          entityType:
            "ai_scheduled_job",

          entityId:
            metadata.jobId ||
            null,

          metadata
        });
      }
    } catch (error) {
      logger.warn(
        "[AI Scheduler] audit failed:",
        error.message
      );
    }
  }

  /*
   * ============================================
   * CREATE JOB
   * ============================================
   */

  function createJob(
    input = {}
  ) {
    if (
      jobs.size >=
      MAX_JOBS
    ) {
      throw new Error(
        "Maximum scheduled jobs reached"
      );
    }

    const scheduledAt =
      parseTime(
        input.scheduledAt ||
          input.runAt ||
          new Date()
      );

    if (!scheduledAt) {
      throw new Error(
        "Invalid scheduledAt"
      );
    }

    const job = {
      id:
        input.id ||
        createId("job"),

      name:
        safeString(
          input.name ||
            input.title ||
            "AI Scheduled Mission",
          500
        ),

      description:
        safeString(
          input.description ||
            input.prompt ||
            input.task ||
            "",
          20000
        ),

      type:
        input.type ||
        "ai_mission",

      priority:
        normalizePriority(
          input.priority
        ),

      priorityScore:
        priorityScore(
          input.priority
        ),

      teamId:
        input.teamId ||
        null,

      agentIds:
        Array.isArray(
          input.agentIds
        )
          ? input.agentIds
          : [],

      strategy:
        input.strategy ||
        "hybrid",

      scheduledAt:
        scheduledAt.toISOString(),

      timezone:
        input.timezone ||
        "UTC",

      recurring:
        Boolean(
          input.recurring
        ),

      recurrence:
        input.recurrence ||
        null,

      recurrenceLimit:
        Number(
          input.recurrenceLimit ||
            0
        ),

      recurrenceCount:
        0,

      status:
        scheduledAt.getTime() <=
        Date.now()
          ? "queued"
          : "scheduled",

      retries:
        0,

      maxRetries:
        Number(
          input.maxRetries ??
            MAX_RETRIES
        ),

      timeoutMs:
        Number(
          input.timeoutMs ||
            DEFAULT_TIMEOUT_MS
        ),

      riskLevel:
        input.riskLevel ||
        "medium",

      requiresApproval:
        Boolean(
          input.requiresApproval
        ),

      autoStart:
        input.autoStart !==
        false,

      payload:
        input.payload ||
        {},

      metadata:
        input.metadata ||
        {},

      missionId:
        null,

      result:
        null,

      error:
        null,

      createdAt:
        now(),

      startedAt:
        null,

      completedAt:
        null,

      nextRunAt:
        scheduledAt.toISOString()
    };

    jobs.set(
      job.id,
      job
    );

    state.jobsCreated++;

    audit(
      "scheduled_job_created",
      {
        jobId:
          job.id,

        priority:
          job.priority,

        scheduledAt:
          job.scheduledAt
      }
    );

    return job;
  }

  /*
   * ============================================
   * RECURRENCE
   * ============================================
   */

  function calculateNextRun(
    job
  ) {
    if (
      !job.recurring ||
      !job.recurrence
    ) {
      return null;
    }

    const current =
      parseTime(
        job.nextRunAt
      );

    if (!current) {
      return null;
    }

    const next =
      new Date(
        current.getTime()
      );

    switch (
      job.recurrence
    ) {
      case "minutely":
        next.setMinutes(
          next.getMinutes() + 1
        );
        break;

      case "hourly":
        next.setHours(
          next.getHours() + 1
        );
        break;

      case "daily":
        next.setDate(
          next.getDate() + 1
        );
        break;

      case "weekly":
        next.setDate(
          next.getDate() + 7
        );
        break;

      case "monthly":
        next.setMonth(
          next.getMonth() + 1
        );
        break;

      default:
        return null;
    }

    return next.toISOString();
  }

  /*
   * ============================================
   * APPROVAL
   * ============================================
   */

  async function requestApproval(
    job
  ) {
    if (
      !REQUIRE_HUMAN_APPROVAL &&
      !job.requiresApproval
    ) {
      return {
        required:
          false
      };
    }

    const sensitive =
      [
        "high",
        "critical"
      ].includes(
        job.riskLevel
      );

    if (
      !sensitive &&
      !job.requiresApproval
    ) {
      return {
        required:
          false
      };
    }

    state.approvalJobs++;

    if (
      approvalEngine &&
      typeof approvalEngine.createRequest ===
        "function"
    ) {
      try {
        return await approvalEngine.createRequest({
          type:
            "ai_scheduled_mission",

          title:
            job.name,

          description:
            job.description,

          requestedBy:
            "ai-mission-scheduler",

          riskLevel:
            job.riskLevel,

          metadata: {
            jobId:
              job.id,

            teamId:
              job.teamId,

            scheduledAt:
              job.scheduledAt
          }
        });
      } catch (error) {
        logger.warn(
          "[AI Scheduler] approval request failed:",
          error.message
        );
      }
    }

    return {
      required:
        true,

      status:
        "pending_approval",

      jobId:
        job.id
    };
  }

  /*
   * ============================================
   * EXECUTE
   * ============================================
   */

  async function executeJob(
    job
  ) {
    if (
      job.status ===
      "cancelled"
    ) {
      return job;
    }

    job.status =
      "starting";

    job.startedAt =
      now();

    state.jobsStarted++;

    const approval =
      await requestApproval(
        job
      );

    if (
      approval.required &&
      approval.status ===
        "pending_approval"
    ) {
      job.status =
        "pending_approval";

      job.approval =
        approval;

      await audit(
        "scheduled_job_pending_approval",
        {
          jobId:
            job.id
        }
      );

      return job;
    }

    job.status =
      "running";

    try {
      let result;

      /*
       * الطريقة الأساسية:
       * تشغيل CODE 115.
       */

      if (
        collaborationEngine &&
        typeof collaborationEngine.createAndRun ===
          "function"
      ) {
        result =
          await runWithTimeout(
            collaborationEngine.createAndRun({
              title:
                job.name,

              description:
                job.description,

              teamId:
                job.teamId,

              agentIds:
                job.agentIds,

              strategy:
                job.strategy,

              priority:
                job.priority,

              riskLevel:
                job.riskLevel,

              payload:
                job.payload,

              metadata:
                job.metadata
            }),
            job.timeoutMs
          );
      } else if (
        agentEngine &&
        typeof agentEngine.createTask ===
          "function"
      ) {
        const task =
          await agentEngine.createTask({
            title:
              job.name,

            description:
              job.description,

            priority:
              job.priority,

            riskLevel:
              job.riskLevel,

            input:
              job.payload
          });

        result =
          await runWithTimeout(
            agentEngine.executeTask(
              task.id
            ),
            job.timeoutMs
          );
      } else {
        throw new Error(
          "AI execution engine unavailable"
        );
      }

      job.result =
        result;

      job.status =
        "completed";

      job.completedAt =
        now();

      state.jobsCompleted++;

      await saveMemory(
        job,
        result
      );

      await audit(
        "scheduled_job_completed",
        {
          jobId:
            job.id
        }
      );

      /*
       * إنشاء الموعد التالي.
       */

      if (
        job.recurring
      ) {
        scheduleNextRecurrence(
          job
        );
      }

      return job;
    } catch (error) {
      job.error =
        safeString(
          error.message,
          5000
        );

      state.jobsFailed++;

      if (
        job.retries <
        job.maxRetries
      ) {
        job.retries++;

        state.jobsRetried++;

        job.status =
          "retry_pending";

        const retryDelay =
          Math.min(
            60000 *
              Math.pow(
                2,
                job.retries - 1
              ),
            3600000
          );

        job.nextRunAt =
          new Date(
            Date.now() +
              retryDelay
          ).toISOString();

        await audit(
          "scheduled_job_retry",
          {
            jobId:
              job.id,

            retry:
              job.retries,

            nextRunAt:
              job.nextRunAt
          }
        );

        return job;
      }

      job.status =
        "failed";

      await audit(
        "scheduled_job_failed",
        {
          jobId:
            job.id,

          error:
            job.error
        }
      );

      return job;
    }
  }

  function runWithTimeout(
    promise,
    timeout
  ) {
    let timer;

    const timeoutPromise =
      new Promise(
        (_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Scheduled mission timeout"
                )
              ),
            timeout
          );
        }
      );

    return Promise.race([
      promise,
      timeoutPromise
    ]).finally(() => {
      clearTimeout(
        timer
      );
    });
  }

  async function saveMemory(
    job,
    result
  ) {
    if (
      !memoryEngine ||
      typeof memoryEngine.createMemory !==
        "function"
    ) {
      return;
    }

    try {
      await memoryEngine.createMemory({
        memoryType:
          "operational",

        scope:
          "platform",

        title:
          `نتيجة المهمة المجدولة: ${job.name}`,

        content:
          JSON.stringify(
            result
          ).slice(
            0,
            20000
          ),

        importance:
          65,

        confidence:
          75,

        sourceType:
          "ai-scheduler",

        sourceId:
          job.id
      });
    } catch (error) {
      logger.warn(
        "[AI Scheduler] memory save failed:",
        error.message
      );
    }
  }

  function scheduleNextRecurrence(
    job
  ) {
    if (
      job.recurrenceLimit > 0 &&
      job.recurrenceCount >=
        job.recurrenceLimit
    ) {
      job.status =
        "completed";

      return;
    }

    const next =
      calculateNextRun(
        job
      );

    if (!next) {
      job.status =
        "completed";

      return;
    }

    job.recurrenceCount++;

    job.nextRunAt =
      next;

    job.scheduledAt =
      next;

    job.status =
      "scheduled";

    job.startedAt =
      null;

    job.completedAt =
      null;

    job.result =
      null;

    job.error =
      null;
  }

  /*
   * ============================================
   * QUEUE
   * ============================================
   */

  function getDueJobs() {
    const timestamp =
      Date.now();

    return Array.from(
      jobs.values()
    )
      .filter(
        job => {
          if (
            ![
              "scheduled",
              "queued",
              "retry_pending"
            ].includes(
              job.status
            )
          ) {
            return false;
          }

          const runAt =
            parseTime(
              job.nextRunAt ||
                job.scheduledAt
            );

          return (
            runAt &&
            runAt.getTime() <=
              timestamp
          );
        }
      )
      .sort(
        (a, b) =>
          b.priorityScore -
          a.priorityScore
      );
  }

  /*
   * ============================================
   * OVERDUE
   * ============================================
   */

  function detectOverdueJobs() {
    const timestamp =
      Date.now();

    const overdue =
      Array.from(
        jobs.values()
      ).filter(
        job => {
          if (
            ![
              "running",
              "starting"
            ].includes(
              job.status
            )
          ) {
            return false;
          }

          const started =
            parseTime(
              job.startedAt
            );

          return (
            started &&
            timestamp -
              started.getTime() >
              OVERDUE_AFTER_MS
          );
        }
      );

    state.overdueJobs =
      overdue.length;

    return overdue;
  }

  /*
   * ============================================
   * TICK
   * ============================================
   */

  async function tick() {
    if (
      !state.running
    ) {
      return;
    }

    state.lastTickAt =
      now();

    try {
      detectOverdueJobs();

      const dueJobs =
        getDueJobs();

      /*
       * لا نشغل كل شيء دفعة واحدة.
       * الأولوية تحدد الترتيب.
       */

      for (
        const job of dueJobs
      ) {
        if (
          !job.autoStart
        ) {
          continue;
        }

        /*
         * حماية من تشغيل المهمة
         * أكثر من مرة.
         */

        if (
          [
            "starting",
            "running"
          ].includes(
            job.status
          )
        ) {
          continue;
        }

        await executeJob(
          job
        );
      }
    } catch (error) {
      state.lastError =
        error.message;

      logger.error(
        "[AI Scheduler] tick error:",
        error
      );
    }
  }

  /*
   * ============================================
   * CONTROL
   * ============================================
   */

  function start() {
    if (
      state.running
    ) {
      return state;
    }

    state.running =
      true;

    timer =
      setInterval(
        () => {
          tick().catch(
            error => {
              state.lastError =
                error.message;
            }
          );
        },
        TICK_MS
      );

    return state;
  }

  function stop() {
    state.running =
      false;

    if (timer) {
      clearInterval(
        timer
      );

      timer = null;
    }

    return state;
  }

  function cancelJob(
    jobId
  ) {
    const job =
      jobs.get(
        jobId
      );

    if (!job) {
      throw new Error(
        "Job not found"
      );
    }

    job.status =
      "cancelled";

    job.completedAt =
      now();

    state.jobsCancelled++;

    audit(
      "scheduled_job_cancelled",
      {
        jobId
      }
    );

    return job;
  }

  function getJob(
    jobId
  ) {
    return jobs.get(
      jobId
    );
  }

  function listJobs(
    filters = {}
  ) {
    let result =
      Array.from(
        jobs.values()
      );

    if (
      filters.status
    ) {
      result =
        result.filter(
          job =>
            job.status ===
            filters.status
        );
    }

    if (
      filters.priority
    ) {
      result =
        result.filter(
          job =>
            job.priority ===
            filters.priority
        );
    }

    return result
      .sort(
        (a, b) =>
          priorityScore(
            b.priority
          ) -
          priorityScore(
            a.priority
          )
      )
      .slice(
        0,
        Number(
          filters.limit ||
            100
        )
      );
  }

  function getStatistics() {
    return {
      ...state,

      totalJobs:
        jobs.size,

      running:
        state.running,

      tickMs:
        TICK_MS,

      maxJobs:
        MAX_JOBS,

      maxRetries:
        MAX_RETRIES,

      requireHumanApproval:
        REQUIRE_HUMAN_APPROVAL
    };
  }

  function healthCheck() {
    return {
      status:
        state.running
          ? "healthy"
          : "stopped",

      initialized:
        state.initialized,

      running:
        state.running,

      jobs:
        jobs.size,

      overdue:
        state.overdueJobs,

      timestamp:
        now()
    };
  }

  async function initialize() {
    if (
      state.initialized
    ) {
      return;
    }

    state.initialized =
      true;

    await audit(
      "ai_scheduler_initialized"
    );
  }

  return {
    initialize,
    start,
    stop,

    createJob,
    executeJob,
    cancelJob,

    getJob,
    listJobs,

    getDueJobs,
    detectOverdueJobs,

    tick,

    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentAIMissionSchedulerEngine
};
