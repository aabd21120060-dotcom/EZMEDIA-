"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 73
 * INTELLIGENT PUBLISHING & DISTRIBUTION ENGINE
 * ============================================================
 *
 * المسار:
 *
 * CODE 72
 *    ↓
 * PUBLISHING GATE
 *    ↓
 * CHANNEL SELECTION
 *    ↓
 * CONTENT ADAPTATION
 *    ↓
 * SCHEDULING
 *    ↓
 * DELIVERY
 *    ↓
 * RETRY / FAILOVER
 *    ↓
 * ANALYTICS
 *    ↓
 * AI OPTIMIZATION
 *
 * مبدأ أمني:
 * لا يمكن لهذا المحرك تجاوز اعتماد CODE 72.
 *
 * جميع موفري النشر الخارجيين يتم حقنهم عبر providers
 * ولا يتم اختراع API أو مفاتيح لخدمات خارجية.
 */

const crypto = require("crypto");
const EventEmitter = require("events");

function createPublishingDistributionEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    automationEngine = null,
    editorialNewsroomEngine = null,
    cmsService = null,
    mediaService = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    providers = {},

    maxRetries = Number(
      process.env.PUBLISHING_MAX_RETRIES || 3
    ),

    retryDelayMs = Number(
      process.env.PUBLISHING_RETRY_DELAY_MS || 5000
    ),

    deliveryTimeoutMs = Number(
      process.env.PUBLISHING_DELIVERY_TIMEOUT_MS || 60000
    ),

    maxQueueSize = Number(
      process.env.PUBLISHING_MAX_QUEUE || 5000
    )
  } = options;

  const emitter = new EventEmitter();

  const state = {
    initialized: false,
    running: false,
    paused: false,

    jobs: new Map(),
    deliveries: new Map(),
    schedules: new Map(),

    statistics: {
      totalJobs: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      scheduled: 0,
      delivered: 0,
      retried: 0,
      rejected: 0,
      adapted: 0,
      notifications: 0
    }
  };

  /* ==========================================================
     HELPERS
  ========================================================== */

  function now() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      crypto.randomBytes(6).toString("hex")
    );
  }

  function clean(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function clamp(value, min = 0, max = 100) {
    const n = Number(value);

    if (!Number.isFinite(n)) {
      return min;
    }

    return Math.min(
      max,
      Math.max(min, n)
    );
  }

  function clone(value) {
    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch {
      return null;
    }
  }

  function emit(event, payload = {}) {
    try {
      emitter.emit(
        event,
        payload
      );

      if (
        eventBus &&
        typeof eventBus.emit === "function"
      ) {
        eventBus.emit(
          event,
          payload
        );
      }
    } catch (error) {
      logger.warn(
        "[CODE73] Event error:",
        error.message
      );
    }
  }

  function on(event, handler) {
    emitter.on(
      event,
      handler
    );

    return () =>
      emitter.off(
        event,
        handler
      );
  }

  /* ==========================================================
     DATABASE
  ========================================================== */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_publishing_jobs (
        id TEXT PRIMARY KEY,

        story_id TEXT NOT NULL,

        status TEXT NOT NULL,

        priority TEXT,

        content JSONB,

        channels JSONB,

        selected_channels JSONB,

        distribution_plan JSONB,

        metadata JSONB,

        retry_count INTEGER DEFAULT 0,

        error TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        started_at TIMESTAMPTZ,

        completed_at TIMESTAMPTZ,

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_publishing_deliveries (
        id TEXT PRIMARY KEY,

        job_id TEXT NOT NULL,

        story_id TEXT NOT NULL,

        channel TEXT NOT NULL,

        provider TEXT,

        status TEXT NOT NULL,

        external_id TEXT,

        response JSONB,

        error TEXT,

        retry_count INTEGER DEFAULT 0,

        delivered_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_publishing_schedules (
        id TEXT PRIMARY KEY,

        job_id TEXT NOT NULL,

        story_id TEXT NOT NULL,

        scheduled_at TIMESTAMPTZ NOT NULL,

        channels JSONB,

        status TEXT NOT NULL,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_publishing_analytics (
        id TEXT PRIMARY KEY,

        job_id TEXT,

        delivery_id TEXT,

        channel TEXT,

        metric TEXT,

        value NUMERIC,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_publishing_jobs_story
      ON ez_publishing_jobs(story_id)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_publishing_jobs_status
      ON ez_publishing_jobs(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_publishing_deliveries_job
      ON ez_publishing_deliveries(job_id)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_publishing_deliveries_channel
      ON ez_publishing_deliveries(channel)
    `);
  }

  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "publishing-distribution.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     PUBLISHING GATE
  ========================================================== */

  function validatePublishingGate(story) {
    if (!story) {
      return {
        allowed: false,
        reason: "story_missing"
      };
    }

    /*
     * يجب أن تكون القصة معتمدة من CODE 72.
     */

    if (
      story.status !== "approved"
    ) {
      return {
        allowed: false,
        reason: "story_not_approved"
      };
    }

    if (
      story.humanReviewRequired
    ) {
      return {
        allowed: false,
        reason: "human_review_required"
      };
    }

    const verification =
      Number(
        story.verificationScore || 0
      );

    const confidence =
      Number(
        story.confidenceScore || 0
      );

    const risk =
      Number(
        story.riskScore || 0
      );

    if (verification < 80) {
      return {
        allowed: false,
        reason: "verification_score_too_low",
        verification
      };
    }

    if (confidence < 85) {
      return {
        allowed: false,
        reason: "confidence_score_too_low",
        confidence
      };
    }

    if (risk >= 85) {
      return {
        allowed: false,
        reason: "risk_too_high",
        risk
      };
    }

    return {
      allowed: true,
      reason: "publishing_gate_passed",
      verification,
      confidence,
      risk
    };
  }

  /* ==========================================================
     CHANNEL REGISTRY
  ========================================================== */

  function getAvailableChannels() {
    return Object.keys(
      providers
    ).map(channel => ({
      channel,
      available:
        Boolean(
          providers[channel]
        )
    }));
  }

  function providerFor(channel) {
    const provider =
      providers[channel];

    if (!provider) {
      return null;
    }

    return provider;
  }

  /* ==========================================================
     CHANNEL SELECTION
  ========================================================== */

  async function selectChannels(
    story,
    requestedChannels = []
  ) {
    let channels =
      Array.isArray(
        requestedChannels
      )
        ? requestedChannels.filter(Boolean)
        : [];

    /*
     * إذا لم يحدد المستخدم قنوات،
     * يتم استخدام القنوات المتاحة.
     */

    if (!channels.length) {
      channels = [
        "ez-media"
      ];
    }

    /*
     * AI يستطيع اقتراح القنوات،
     * لكنه لا يستطيع تجاوز القنوات
     * غير المسجلة في النظام.
     */

    if (
      aiCore &&
      typeof aiCore.recommendChannels ===
        "function"
    ) {
      try {
        const recommendation =
          await aiCore.recommendChannels(
            story
          );

        const suggested =
          Array.isArray(
            recommendation
          )
            ? recommendation
            : recommendation?.channels;

        if (
          Array.isArray(
            suggested
          )
        ) {
          const valid =
            suggested.filter(
              channel =>
                channels.includes(
                  channel
                ) ||
                providers[channel]
            );

          if (valid.length) {
            channels = [
              ...new Set([
                ...channels,
                ...valid
              ])
            ];
          }
        }
      } catch (error) {
        logger.warn(
          "[CODE73] AI channel recommendation failed:",
          error.message
        );
      }
    }

    return channels;
  }

  /* ==========================================================
     CONTENT ADAPTATION
  ========================================================== */

  async function adaptContent(
    story,
    channel
  ) {
    const content = {
      title:
        clean(story.title),

      summary:
        clean(story.summary),

      body:
        clean(story.body),

      slug:
        clean(story.slug),

      category:
        clean(story.category),

      language:
        clean(story.language || "ar"),

      media:
        Array.isArray(story.media)
          ? story.media
          : [],

      metadata: {
        storyId:
          story.id,

        storyHash:
          story.storyHash,

        priority:
          story.priority,

        breaking:
          Boolean(
            story.breaking
          )
      }
    };

    /*
     * القنوات يمكن أن تحتاج تنسيقًا
     * مختلفًا.
     */

    if (channel === "ez-media") {
      return content;
    }

    if (
      aiCore &&
      typeof aiCore.request === "function"
    ) {
      try {
        const result =
          await aiCore.request({
            operation:
              "adapt-content-for-channel",

            channel,

            title:
              content.title,

            summary:
              content.summary,

            body:
              content.body,

            media:
              content.media,

            language:
              content.language
          });

        state.statistics.adapted++;

        return {
          ...content,

          title:
            clean(
              result?.title ||
              content.title
            ),

          summary:
            clean(
              result?.summary ||
              content.summary
            ),

          body:
            clean(
              result?.body ||
              content.body
            ),

          metadata: {
            ...content.metadata,

            aiAdapted: true
          }
        };
      } catch (error) {
        logger.warn(
          "[CODE73] AI adaptation failed:",
          error.message
        );
      }
    }

    return content;
  }

  /* ==========================================================
     CREATE JOB
  ========================================================== */

  async function createJob(input = {}) {
    if (
      state.jobs.size >=
      maxQueueSize
    ) {
      throw new Error(
        "Publishing queue is full"
      );
    }

    let story =
      input.story;

    /*
     * يمكن تمرير storyId فقط
     * إذا كانت غرفة الأخبار موجودة.
     */

    if (
      !story &&
      input.storyId &&
      editorialNewsroomEngine &&
      typeof editorialNewsroomEngine.getStory ===
        "function"
    ) {
      story =
        editorialNewsroomEngine.getStory(
          input.storyId
        );
    }

    const gate =
      validatePublishingGate(
        story
      );

    if (!gate.allowed) {
      state.statistics.rejected++;

      emit(
        "publishing.job.rejected",
        {
          storyId:
            story?.id ||
            input.storyId,

          reason:
            gate.reason
        }
      );

      return {
        accepted: false,
        gate
      };
    }

    const channels =
      await selectChannels(
        story,
        input.channels
      );

    const job = {
      id:
        id("publish"),

      storyId:
        story.id,

      status:
        "queued",

      priority:
        story.priority || "medium",

      content:
        null,

      channels,

      selectedChannels:
        channels,

      distributionPlan:
        null,

      metadata:
        input.metadata || {},

      retryCount:
        0,

      error:
        null,

      createdAt:
        now(),

      startedAt:
        null,

      completedAt:
        null,

      updatedAt:
        now()
    };

    job.distributionPlan =
      await buildDistributionPlan(
        story,
        channels
      );

    state.jobs.set(
      job.id,
      job
    );

    state.statistics.totalJobs++;
    state.statistics.queued++;

    await persistJob(
      job
    );

    emit(
      "publishing.job.created",
      {
        job:
          clone(job)
      }
    );

    return {
      accepted: true,

      job:
        clone(job)
    };
  }

  /* ==========================================================
     DISTRIBUTION PLAN
  ========================================================== */

  async function buildDistributionPlan(
    story,
    channels
  ) {
    const plan = [];

    for (
      const channel of channels
    ) {
      const provider =
        providerFor(
          channel
        );

      plan.push({
        channel,

        provider:
          provider
            ? provider.name ||
              channel
            : null,

        available:
          Boolean(
            provider
          ),

        mode:
          provider
            ? "provider"
            : "unavailable",

        priority:
          story.priority,

        breaking:
          Boolean(
            story.breaking
          ),

        retry:
          true
      });
    }

    return plan;
  }

  /* ==========================================================
     PROCESS JOB
  ========================================================== */

  async function processJob(
    jobId
  ) {
    const job =
      state.jobs.get(
        jobId
      );

    if (!job) {
      throw new Error(
        "Publishing job not found"
      );
    }

    if (
      state.paused
    ) {
      throw new Error(
        "Publishing engine is paused"
      );
    }

    if (
      job.status === "completed"
    ) {
      return clone(job);
    }

    job.status =
      "processing";

    job.startedAt =
      now();

    job.updatedAt =
      now();

    state.statistics.queued =
      Math.max(
        0,
        state.statistics.queued - 1
      );

    state.statistics.processing++;

    await persistJob(
      job
    );

    emit(
      "publishing.job.started",
      {
        jobId
      }
    );

    let story = null;

    if (
      editorialNewsroomEngine &&
      typeof editorialNewsroomEngine.getStory ===
        "function"
    ) {
      story =
        editorialNewsroomEngine.getStory(
          job.storyId
        );
    }

    if (!story) {
      throw new Error(
        "Original story unavailable"
      );
    }

    const gate =
      validatePublishingGate(
        story
      );

    if (!gate.allowed) {
      job.status =
        "rejected";

      job.error =
        gate.reason;

      state.statistics.rejected++;

      await persistJob(
        job
      );

      return clone(job);
    }

    const deliveries = [];

    for (
      const channel of
        job.selectedChannels
    ) {
      const delivery =
        await deliverToChannel(
          job,
          story,
          channel
        );

      deliveries.push(
        delivery
      );
    }

    const successful =
      deliveries.filter(
        item =>
          item.status ===
          "delivered"
      );

    const failed =
      deliveries.filter(
        item =>
          item.status ===
          "failed"
      );

    if (
      successful.length &&
      !failed.length
    ) {
      job.status =
        "completed";

      job.completedAt =
        now();

      state.statistics.completed++;
    } else if (
      successful.length &&
      failed.length
    ) {
      job.status =
        "partial";

      job.completedAt =
        now();
    } else {
      job.status =
        "failed";

      job.completedAt =
        now();

      state.statistics.failed++;
    }

    state.statistics.processing =
      Math.max(
        0,
        state.statistics.processing - 1
      );

    job.updatedAt =
      now();

    await persistJob(
      job
    );

    emit(
      "publishing.job.completed",
      {
        job:
          clone(job),

        deliveries
      }
    );

    return {
      job:
        clone(job),

      deliveries:
        clone(deliveries)
    };
  }

  /* ==========================================================
     DELIVERY
  ========================================================== */

  async function deliverToChannel(
    job,
    story,
    channel
  ) {
    const delivery = {
      id:
        id("delivery"),

      jobId:
        job.id,

      storyId:
        story.id,

      channel,

      provider:
        channel,

      status:
        "processing",

      externalId:
        null,

      response:
        null,

      error:
        null,

      retryCount:
        0,

      deliveredAt:
        null,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.deliveries.set(
      delivery.id,
      delivery
    );

    const provider =
      providerFor(
        channel
      );

    if (!provider) {
      delivery.status =
        "failed";

      delivery.error =
        "No provider configured";

      await persistDelivery(
        delivery
      );

      return clone(
        delivery
      );
    }

    const content =
      await adaptContent(
        story,
        channel
      );

    for (
      let attempt = 0;
      attempt <= maxRetries;
      attempt++
    ) {
      delivery.retryCount =
        attempt;

      try {
        const result =
          await executeWithTimeout(
            provider.publish
              ? provider.publish({
                  story:
                    clone(story),

                  content:
                    clone(content),

                  jobId:
                    job.id,

                  deliveryId:
                    delivery.id,

                  channel
                })
              : Promise.reject(
                  new Error(
                    "Provider.publish is not implemented"
                  )
                ),
            deliveryTimeoutMs
          );

        delivery.status =
          "delivered";

        delivery.response =
          result || null;

        delivery.externalId =
          result?.externalId ||
          result?.id ||
          null;

        delivery.deliveredAt =
          now();

        state.statistics.delivered++;

        await persistDelivery(
          delivery
        );

        emit(
          "publishing.delivery.completed",
          {
            delivery:
              clone(delivery)
          }
        );

        return clone(
          delivery
        );
      } catch (error) {
        delivery.error =
          error.message;

        if (
          attempt <
          maxRetries
        ) {
          state.statistics.retried++;

          await delay(
            retryDelayMs *
              Math.pow(
                2,
                attempt
              )
          );

          continue;
        }
      }
    }

    delivery.status =
      "failed";

    delivery.updatedAt =
      now();

    await persistDelivery(
      delivery
    );

    emit(
      "publishing.delivery.failed",
      {
        delivery:
          clone(delivery)
      }
    );

    return clone(
      delivery
    );
  }

  /* ==========================================================
     TIMEOUT
  ========================================================== */

  function executeWithTimeout(
    promise,
    timeout
  ) {
    return Promise.race([
      promise,

      new Promise(
        (_, reject) => {
          const timer =
            setTimeout(
              () => {
                reject(
                  new Error(
                    "Publishing provider timeout"
                  )
                );
              },
              timeout
            );

          if (
            typeof timer.unref ===
            "function"
          ) {
            timer.unref();
          }
        }
      )
    ]);
  }

  function delay(ms) {
    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          ms
        )
    );
  }

  /* ==========================================================
     SCHEDULING
  ========================================================== */

  async function scheduleJob(
    jobId,
    scheduledAt
  ) {
    const job =
      state.jobs.get(
        jobId
      );

    if (!job) {
      throw new Error(
        "Publishing job not found"
      );
    }

    const date =
      new Date(
        scheduledAt
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      throw new Error(
        "Invalid scheduledAt"
      );
    }

    const item = {
      id:
        id("pubschedule"),

      jobId,

      storyId:
        job.storyId,

      scheduledAt:
        date.toISOString(),

      channels:
        job.selectedChannels,

      status:
        "scheduled",

      metadata: {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.schedules.set(
      item.id,
      item
    );

    job.status =
      "scheduled";

    state.statistics.scheduled++;

    await persistSchedule(
      item
    );

    await persistJob(
      job
    );

    emit(
      "publishing.job.scheduled",
      {
        schedule:
          clone(item)
      }
    );

    return clone(
      item
    );
  }

  async function processSchedules() {
    if (
      !state.running ||
      state.paused
    ) {
      return;
    }

    const timestamp =
      Date.now();

    for (
      const item of
        state.schedules.values()
    ) {
      if (
        item.status !==
        "scheduled"
      ) {
        continue;
      }

      if (
        new Date(
          item.scheduledAt
        ).getTime() >
        timestamp
      ) {
        continue;
      }

      item.status =
        "processing";

      try {
        await processJob(
          item.jobId
        );

        item.status =
          "completed";
      } catch (error) {
        item.status =
          "failed";

        item.metadata = {
          error:
            error.message
        };
      }

      item.updatedAt =
        now();

      await persistSchedule(
        item
      );
    }
  }

  /* ==========================================================
     CANCEL
  ========================================================== */

  async function cancelJob(
    jobId
  ) {
    const job =
      state.jobs.get(
        jobId
      );

    if (!job) {
      throw new Error(
        "Publishing job not found"
      );
    }

    if (
      [
        "completed",
        "partial"
      ].includes(
        job.status
      )
    ) {
      throw new Error(
        "Completed job cannot be cancelled"
      );
    }

    job.status =
      "cancelled";

    job.updatedAt =
      now();

    state.statistics.cancelled++;

    await persistJob(
      job
    );

    emit(
      "publishing.job.cancelled",
      {
        jobId
      }
    );

    return clone(
      job
    );
  }

  /* ==========================================================
     RETRY
  ========================================================== */

  async function retryJob(
    jobId
  ) {
    const job =
      state.jobs.get(
        jobId
      );

    if (!job) {
      throw new Error(
        "Publishing job not found"
      );
    }

    if (
      job.status !==
      "failed"
    ) {
      throw new Error(
        "Only failed jobs can be retried"
      );
    }

    job.status =
      "queued";

    job.retryCount++;

    job.error =
      null;

    job.updatedAt =
      now();

    state.statistics.queued++;

    await persistJob(
      job
    );

    return processJob(
      jobId
    );
  }

  /* ==========================================================
     ANALYTICS
  ========================================================== */

  async function recordAnalytics(
    input = {}
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_publishing_analytics (
        id,
        job_id,
        delivery_id,
        channel,
        metric,
        value,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        id("metric"),
        input.jobId || null,
        input.deliveryId || null,
        input.channel || null,
        input.metric || null,
        Number(
          input.value || 0
        ),
        JSON.stringify(
          input.metadata || {}
        )
      ]
    );
  }

  /* ==========================================================
     AI OPTIMIZATION
  ========================================================== */

  async function optimizeDistribution(
    story,
    performance = {}
  ) {
    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        optimized: false,
        reason:
          "AI Core unavailable"
      };
    }

    try {
      const result =
        await aiCore.request({
          operation:
            "optimize-distribution",

          story:
            clone(story),

          performance
        });

      emit(
        "publishing.distribution.optimized",
        {
          storyId:
            story.id,

          result
        }
      );

      return {
        optimized: true,
        result
      };
    } catch (error) {
      logger.warn(
        "[CODE73] Distribution optimization failed:",
        error.message
      );

      return {
        optimized: false,
        error:
          error.message
      };
    }
  }

  /* ==========================================================
     NOTIFICATION
  ========================================================== */

  async function notifyPublication(
    story,
    result
  ) {
    if (
      !notificationService
    ) {
      return;
    }

    if (
      typeof notificationService.notify !==
      "function"
    ) {
      return;
    }

    try {
      await notificationService.notify({
        type:
          "content.published",

        storyId:
          story.id,

        title:
          story.title,

        result
      });

      state.statistics.notifications++;
    } catch (error) {
      logger.warn(
        "[CODE73] Notification failed:",
        error.message
      );
    }
  }

  /* ==========================================================
     GET JOB
  ========================================================== */

  function getJob(jobId) {
    return clone(
      state.jobs.get(
        jobId
      ) || null
    );
  }

  /* ==========================================================
     GET DELIVERY
  ========================================================== */

  function getDelivery(
    deliveryId
  ) {
    return clone(
      state.deliveries.get(
        deliveryId
      ) || null
    );
  }

  /* ==========================================================
     LIST JOBS
  ========================================================== */

  function listJobs(
    filters = {}
  ) {
    let jobs =
      Array.from(
        state.jobs.values()
      );

    if (
      filters.status
    ) {
      jobs =
        jobs.filter(
          job =>
            job.status ===
            filters.status
        );
    }

    if (
      filters.storyId
    ) {
      jobs =
        jobs.filter(
          job =>
            job.storyId ===
            filters.storyId
        );
    }

    jobs.sort(
      (a, b) =>
        new Date(
          b.createdAt
        ) -
        new Date(
          a.createdAt
        )
    );

    return jobs
      .slice(
        0,
        Math.min(
          Number(
            filters.limit || 100
          ),
          500
        )
      )
      .map(
        clone
      );
  }

  /* ==========================================================
     STATISTICS
  ========================================================== */

  function getStatistics() {
    return {
      ...state.statistics,

      jobs:
        state.jobs.size,

      deliveries:
        state.deliveries.size,

      schedules:
        state.schedules.size,

      channels:
        getAvailableChannels()
    };
  }

  /* ==========================================================
     STATUS
  ========================================================== */

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Publishing & Distribution",

      code:
        "73",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      paused:
        state.paused,

      configuration: {
        maxRetries,
        retryDelayMs,
        deliveryTimeoutMs,
        maxQueueSize
      },

      integrations: {
        persistence:
          Boolean(
            persistence
          ),

        aiCore:
          Boolean(
            aiCore
          ),

        aiOrchestrator:
          Boolean(
            aiOrchestrator
          ),

        automation:
          Boolean(
            automationEngine
          ),

        editorialNewsroom:
          Boolean(
            editorialNewsroomEngine
          ),

        cms:
          Boolean(
            cmsService
          ),

        media:
          Boolean(
            mediaService
          ),

        notifications:
          Boolean(
            notificationService
          )
      },

      providers:
        getAvailableChannels(),

      statistics:
        getStatistics(),

      timestamp:
        now()
    };
  }

  /* ==========================================================
     HEALTH
  ========================================================== */

  async function health() {
    let database = {
      connected:
        false
    };

    if (
      persistence &&
      typeof persistence.health ===
        "function"
    ) {
      try {
        database =
          await persistence.health();
      } catch {
        database = {
          connected:
            false
        };
      }
    }

    return {
      ok:
        state.initialized,

      running:
        state.running,

      paused:
        state.paused,

      database,

      timestamp:
        now()
    };
  }

  /* ==========================================================
     START / STOP / PAUSE / RESUME
  ========================================================== */

  function start() {
    state.running =
      true;

    state.paused =
      false;

    emit(
      "publishing-distribution.started",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function stop() {
    state.running =
      false;

    emit(
      "publishing-distribution.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function pause() {
    state.paused =
      true;

    emit(
      "publishing-distribution.paused",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function resume() {
    state.paused =
      false;

    emit(
      "publishing-distribution.resumed",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     SCHEDULER
  ========================================================== */

  let scheduler =
    null;

  function startScheduler() {
    if (scheduler) {
      return;
    }

    scheduler =
      setInterval(
        () => {
          processSchedules()
            .catch(
              error =>
                logger.warn(
                  "[CODE73] Scheduler error:",
                  error.message
                )
            );
        },
        60 * 1000
      );

    if (
      typeof scheduler.unref ===
      "function"
    ) {
      scheduler.unref();
    }
  }

  function stopScheduler() {
    if (scheduler) {
      clearInterval(
        scheduler
      );

      scheduler =
        null;
    }
  }

  /* ==========================================================
     PERSISTENCE
  ========================================================== */

  async function persistJob(job) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_publishing_jobs (
        id,
        story_id,
        status,
        priority,
        content,
        channels,
        selected_channels,
        distribution_plan,
        metadata,
        retry_count,
        error,
        started_at,
        completed_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,NOW()
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status =
          EXCLUDED.status,

        priority =
          EXCLUDED.priority,

        content =
          EXCLUDED.content,

        channels =
          EXCLUDED.channels,

        selected_channels =
          EXCLUDED.selected_channels,

        distribution_plan =
          EXCLUDED.distribution_plan,

        metadata =
          EXCLUDED.metadata,

        retry_count =
          EXCLUDED.retry_count,

        error =
          EXCLUDED.error,

        started_at =
          EXCLUDED.started_at,

        completed_at =
          EXCLUDED.completed_at,

        updated_at =
          NOW()
      `,
      [
        job.id,
        job.storyId,
        job.status,
        job.priority,
        JSON.stringify(
          job.content
        ),
        JSON.stringify(
          job.channels
        ),
        JSON.stringify(
          job.selectedChannels
        ),
        JSON.stringify(
          job.distributionPlan
        ),
        JSON.stringify(
          job.metadata
        ),
        job.retryCount,
        job.error,
        job.startedAt,
        job.completedAt
      ]
    );
  }

  async function persistDelivery(
    delivery
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_publishing_deliveries (
        id,
        job_id,
        story_id,
        channel,
        provider,
        status,
        external_id,
        response,
        error,
        retry_count,
        delivered_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,NOW()
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status =
          EXCLUDED.status,

        external_id =
          EXCLUDED.external_id,

        response =
          EXCLUDED.response,

        error =
          EXCLUDED.error,

        retry_count =
          EXCLUDED.retry_count,

        delivered_at =
          EXCLUDED.delivered_at,

        updated_at =
          NOW()
      `,
      [
        delivery.id,
        delivery.jobId,
        delivery.storyId,
        delivery.channel,
        delivery.provider,
        delivery.status,
        delivery.externalId,
        JSON.stringify(
          delivery.response
        ),
        delivery.error,
        delivery.retryCount,
        delivery.deliveredAt
      ]
    );
  }

  async function persistSchedule(
    item
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_publishing_schedules (
        id,
        job_id,
        story_id,
        scheduled_at,
        channels,
        status,
        metadata,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,NOW()
      )
      ON CONFLICT(id)
      DO UPDATE SET
        scheduled_at =
          EXCLUDED.scheduled_at,

        channels =
          EXCLUDED.channels,

        status =
          EXCLUDED.status,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          NOW()
      `,
      [
        item.id,
        item.jobId,
        item.storyId,
        item.scheduledAt,
        JSON.stringify(
          item.channels
        ),
        item.status,
        JSON.stringify(
          item.metadata
        )
      ]
    );
  }

  /* ==========================================================
     PUBLIC API
  ========================================================== */

  return {
    initialize,

    start,
    stop,
    pause,
    resume,

    startScheduler,
    stopScheduler,

    createJob,
    processJob,

    scheduleJob,
    processSchedules,

    cancelJob,
    retryJob,

    selectChannels,
    adaptContent,

    optimizeDistribution,
    recordAnalytics,
    notifyPublication,

    getJob,
    getDelivery,
    listJobs,

    getAvailableChannels,
    getStatistics,
    getStatus,
    health,

    validatePublishingGate,

    on
  };
}

module.exports = {
  createPublishingDistributionEngine
};
