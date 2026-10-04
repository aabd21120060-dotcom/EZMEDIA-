"use strict";

const crypto = require("crypto");

function createIntelligentMediaDistributionEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    contentFactory = null,
    publishingEngine = null,
    audienceEngine = null,
    advertisingEngine = null,
    communicationEngine = null,
    workflowEngine = null,
    liveBroadcastEngine = null,
    broadcastScheduler = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxDistributions = Number(
      process.env.DISTRIBUTION_MAX_DISTRIBUTIONS || 1000000
    ),

    maxChannels = Number(
      process.env.DISTRIBUTION_MAX_CHANNELS || 100
    ),

    maxAttempts = Number(
      process.env.DISTRIBUTION_MAX_ATTEMPTS || 5
    ),

    defaultRetryDelayMs = Number(
      process.env.DISTRIBUTION_RETRY_DELAY_MS || 5000
    ),

    aiSelectionThreshold = Number(
      process.env.DISTRIBUTION_AI_SELECTION_THRESHOLD || 60
    ),

    humanReviewThreshold = Number(
      process.env.DISTRIBUTION_HUMAN_REVIEW_THRESHOLD || 70
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    channels: new Map(),
    distributions: new Map(),
    jobs: new Map(),
    attempts: new Map(),
    approvals: new Map(),
    failures: new Map(),
    analytics: new Map(),

    statistics: {
      distributionsCreated: 0,
      distributionsStarted: 0,
      distributionsCompleted: 0,
      distributionsFailed: 0,
      distributionsPending: 0,
      distributionsReview: 0,
      distributionsRejected: 0,
      retries: 0,
      channelSelections: 0,
      successfulPublications: 0,
      failedPublications: 0,
      rescheduled: 0
    }
  };

  function now() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      crypto.randomBytes(8).toString("hex")
    );
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  async function query(sql, values = []) {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return null;
    }

    return persistence.query(sql, values);
  }

  function emit(event, payload = {}) {
    try {
      if (
        eventBus &&
        typeof eventBus.emit === "function"
      ) {
        eventBus.emit(event, payload);
      }
    } catch (error) {
      logger.warn(
        "[CODE98] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_distribution_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        connected BOOLEAN DEFAULT FALSE,
        priority INTEGER DEFAULT 50,
        capabilities JSONB DEFAULT '{}'::jsonb,
        configuration JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_distribution_jobs (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        source_type TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        strategy JSONB DEFAULT '{}'::jsonb,
        requested_channels JSONB DEFAULT '[]'::jsonb,
        selected_channels JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_distribution_items (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        content_id TEXT,
        channel_id TEXT NOT NULL,
        provider TEXT,
        status TEXT DEFAULT 'pending',
        scheduled_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 5,
        score NUMERIC DEFAULT 0,
        decision TEXT DEFAULT 'pending',
        payload JSONB DEFAULT '{}'::jsonb,
        response JSONB DEFAULT '{}'::jsonb,
        error JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_distribution_attempts (
        id TEXT PRIMARY KEY,
        distribution_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        provider TEXT,
        response JSONB DEFAULT '{}'::jsonb,
        error JSONB DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_distribution_approvals (
        id TEXT PRIMARY KEY,
        distribution_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reviewer_id TEXT,
        reason TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_distribution_failures (
        id TEXT PRIMARY KEY,
        distribution_id TEXT,
        job_id TEXT,
        channel_id TEXT,
        stage TEXT,
        error_message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_distribution_analytics (
        id TEXT PRIMARY KEY,
        distribution_id TEXT,
        channel_id TEXT,
        metric TEXT,
        value NUMERIC DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_distribution_jobs_status
      ON ez_distribution_jobs(status)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_distribution_items_job
      ON ez_distribution_items(job_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_distribution_items_channel
      ON ez_distribution_items(channel_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_distribution_items_status
      ON ez_distribution_items(status)
    `);
  }

  /* ============================================================
     INITIALIZATION
  ============================================================ */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();
    await seedDefaultChannels();

    state.initialized = true;

    emit(
      "distribution.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     CHANNEL REGISTRY
  ============================================================ */

  async function seedDefaultChannels() {
    const channels = [
      {
        id: "ez-website",
        name: "EZ MEDIA Website",
        type: "website",
        provider: "ez-media",
        priority: 100,
        capabilities: {
          article: true,
          breaking: true,
          video: true,
          audio: true,
          image: true
        }
      },

      {
        id: "youtube",
        name: "YouTube",
        type: "video",
        provider: "youtube",
        priority: 90,
        capabilities: {
          longVideo: true,
          shortVideo: true,
          live: true
        }
      },

      {
        id: "x",
        name: "X",
        type: "social",
        provider: "x",
        priority: 85,
        capabilities: {
          post: true,
          thread: true,
          image: true,
          video: true
        }
      },

      {
        id: "instagram",
        name: "Instagram",
        type: "social",
        provider: "instagram",
        priority: 85,
        capabilities: {
          post: true,
          reel: true,
          story: true,
          image: true,
          video: true
        }
      },

      {
        id: "tiktok",
        name: "TikTok",
        type: "social",
        provider: "tiktok",
        priority: 85,
        capabilities: {
          shortVideo: true
        }
      },

      {
        id: "snapchat",
        name: "Snapchat",
        type: "social",
        provider: "snapchat",
        priority: 85,
        capabilities: {
          story: true,
          spotlight: true,
          video: true
        }
      },

      {
        id: "facebook",
        name: "Facebook",
        type: "social",
        provider: "facebook",
        priority: 75,
        capabilities: {
          post: true,
          video: true,
          live: true
        }
      },

      {
        id: "linkedin",
        name: "LinkedIn",
        type: "social",
        provider: "linkedin",
        priority: 70,
        capabilities: {
          post: true,
          article: true,
          video: true
        }
      },

      {
        id: "audio",
        name: "EZ MEDIA Audio",
        type: "audio",
        provider: "ez-audio",
        priority: 60,
        capabilities: {
          podcast: true,
          audio: true
        }
      },

      {
        id: "broadcast",
        name: "EZ MEDIA Broadcast",
        type: "broadcast",
        provider: "ez-broadcast",
        priority: 100,
        capabilities: {
          live: true,
          scheduled: true,
          video: true
        }
      }
    ];

    for (const channel of channels) {
      await registerChannel(
        channel,
        false
      );
    }
  }

  async function registerChannel(
    input = {},
    persist = true
  ) {
    if (
      state.channels.size >=
      maxChannels
    ) {
      throw new Error(
        "Maximum distribution channels reached"
      );
    }

    const channel = {
      id:
        input.id ||
        id("channel"),

      name:
        input.name ||
        "Channel",

      type:
        input.type ||
        "social",

      provider:
        input.provider ||
        null,

      enabled:
        input.enabled !== false,

      connected:
        input.connected === true,

      priority:
        Number(
          input.priority || 50
        ),

      capabilities:
        input.capabilities ||
        {},

      configuration:
        input.configuration ||
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.channels.set(
      channel.id,
      channel
    );

    if (persist) {
      await query(
        `
        INSERT INTO ez_distribution_channels
        (
          id,
          name,
          type,
          provider,
          enabled,
          connected,
          priority,
          capabilities,
          configuration,
          metadata,
          created_at,
          updated_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          provider = EXCLUDED.provider,
          enabled = EXCLUDED.enabled,
          connected = EXCLUDED.connected,
          priority = EXCLUDED.priority,
          capabilities = EXCLUDED.capabilities,
          configuration = EXCLUDED.configuration,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
        `,
        [
          channel.id,
          channel.name,
          channel.type,
          channel.provider,
          channel.enabled,
          channel.connected,
          channel.priority,
          JSON.stringify(channel.capabilities),
          JSON.stringify(channel.configuration),
          JSON.stringify(channel.metadata),
          channel.createdAt,
          channel.updatedAt
        ]
      );
    }

    return clone(channel);
  }

  function getChannels() {
    return Array.from(
      state.channels.values()
    ).map(clone);
  }

  function getChannel(
    channelId
  ) {
    const channel =
      state.channels.get(
        channelId
      );

    return channel
      ? clone(channel)
      : null;
  }

  /* ============================================================
     AI CHANNEL SELECTION
  ============================================================ */

  async function selectChannels(
    content,
    configuration = {}
  ) {
    const available =
      Array.from(
        state.channels.values()
      ).filter(
        channel =>
          channel.enabled
      );

    if (
      Array.isArray(
        configuration.channels
      ) &&
      configuration.channels.length
    ) {
      return available.filter(
        channel =>
          configuration.channels.includes(
            channel.id
          )
      );
    }

    let aiResult = null;

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        aiResult =
          await aiOrchestrator.process({
            operation:
              "distribution-channel-selection",

            input: {
              content,
              channels:
                available.map(
                  channel => ({
                    id:
                      channel.id,

                    name:
                      channel.name,

                    type:
                      channel.type,

                    capabilities:
                      channel.capabilities,

                    priority:
                      channel.priority
                  })
                )
            }
          });
      } catch (error) {
        logger.warn(
          "[CODE98] AI channel selection failed:",
          error.message
        );
      }
    }

    state.statistics
      .channelSelections++;

    if (
      aiResult &&
      Array.isArray(
        aiResult.channels
      )
    ) {
      const selected =
        available.filter(
          channel =>
            aiResult.channels.includes(
              channel.id
            )
        );

      if (selected.length) {
        return selected;
      }
    }

    /*
     * Fallback deterministic routing.
     * It does not publish anything.
     */

    const outputType =
      content.outputType ||
      content.type ||
      "article";

    return available
      .filter(
        channel => {
          const capabilities =
            channel.capabilities ||
            {};

          if (
            outputType === "article"
          ) {
            return (
              capabilities.article ||
              channel.type === "website"
            );
          }

          if (
            outputType === "breaking"
          ) {
            return (
              channel.id ===
                "ez-website" ||
              channel.id ===
                "x"
            );
          }

          if (
            outputType ===
              "video_script" ||
            outputType ===
              "short_video"
          ) {
            return Boolean(
              capabilities.shortVideo ||
              capabilities.video ||
              capabilities.reel
            );
          }

          if (
            outputType ===
            "social_post"
          ) {
            return (
              channel.type ===
              "social"
            );
          }

          return (
            channel.id ===
              "ez-website"
          );
        }
      )
      .sort(
        (a, b) =>
          b.priority -
          a.priority
      );
  }

  /* ============================================================
     JOB CREATION
  ============================================================ */

  async function createDistributionJob(
    input = {}
  ) {
    if (
      state.jobs.size >=
      maxDistributions
    ) {
      throw new Error(
        "Maximum distribution jobs reached"
      );
    }

    if (
      !input.contentId &&
      !input.content
    ) {
      throw new Error(
        "contentId or content is required"
      );
    }

    const job = {
      id:
        id("distribution_job"),

      contentId:
        input.contentId ||
        null,

      sourceType:
        input.sourceType ||
        "content-factory",

      status:
        "pending",

      priority:
        input.priority ||
        "medium",

      content:
        input.content ||
        null,

      strategy:
        input.strategy ||
        {},

      requestedChannels:
        input.channels ||
        [],

      selectedChannels: [],

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      startedAt:
        null,

      completedAt:
        null
    };

    state.jobs.set(
      job.id,
      job
    );

    state.statistics
      .distributionsCreated++;

    await query(
      `
      INSERT INTO ez_distribution_jobs
      (
        id,
        content_id,
        source_type,
        status,
        priority,
        strategy,
        requested_channels,
        selected_channels,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        job.id,
        job.contentId,
        job.sourceType,
        job.status,
        job.priority,
        JSON.stringify(
          job.strategy
        ),
        JSON.stringify(
          job.requestedChannels
        ),
        JSON.stringify([]),
        JSON.stringify(
          job.metadata
        ),
        job.createdAt
      ]
    );

    emit(
      "distribution.job.created",
      clone(job)
    );

    return clone(job);
  }

  /* ============================================================
     DISTRIBUTION ITEM
  ============================================================ */

  async function createDistributionItem(
    job,
    channel,
    content
  ) {
    const distribution = {
      id:
        id("distribution"),

      jobId:
        job.id,

      contentId:
        job.contentId,

      channelId:
        channel.id,

      provider:
        channel.provider,

      status:
        "pending",

      scheduledAt:
        null,

      publishedAt:
        null,

      attempts:
        0,

      maxAttempts:
        maxAttempts,

      score:
        0,

      decision:
        "pending",

      payload:
        content,

      response:
        {},

      error:
        {},

      metadata:
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.distributions.set(
      distribution.id,
      distribution
    );

    state.statistics
      .distributionsPending++;

    await query(
      `
      INSERT INTO ez_distribution_items
      (
        id,
        job_id,
        content_id,
        channel_id,
        provider,
        status,
        scheduled_at,
        published_at,
        attempts,
        max_attempts,
        score,
        decision,
        payload,
        response,
        error,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18
      )
      `,
      [
        distribution.id,
        distribution.jobId,
        distribution.contentId,
        distribution.channelId,
        distribution.provider,
        distribution.status,
        distribution.scheduledAt,
        distribution.publishedAt,
        distribution.attempts,
        distribution.maxAttempts,
        distribution.score,
        distribution.decision,
        JSON.stringify(
          distribution.payload
        ),
        JSON.stringify({}),
        JSON.stringify({}),
        JSON.stringify({}),
        distribution.createdAt,
        distribution.updatedAt
      ]
    );

    return distribution;
  }

  /* ============================================================
     SAFETY / DECISION
  ============================================================ */

  function evaluateDistribution(
    content,
    channel,
    configuration = {}
  ) {
    const quality =
      Number(
        content.qualityScore ??
        100
      );

    const legal =
      Number(
        content.legalScore ??
        100
      );

    const ethics =
      Number(
        content.ethicsScore ??
        100
      );

    const brand =
      Number(
        content.brandScore ??
        100
      );

    const score =
      Math.round(
        (
          quality +
          legal +
          ethics +
          brand
        ) / 4
      );

    const sensitive =
      Boolean(
        content.metadata &&
        content.metadata.sensitive
      );

    if (
      legal < 50 ||
      ethics < 50 ||
      quality < 50
    ) {
      return {
        score,
        decision:
          "blocked"
      };
    }

    if (
      sensitive ||
      score <
        humanReviewThreshold
    ) {
      return {
        score,
        decision:
          "human_review"
      };
    }

    if (
      score >=
      aiSelectionThreshold
    ) {
      return {
        score,
        decision:
          "eligible"
      };
    }

    return {
      score,
      decision:
        "human_review"
    };
  }

  /* ============================================================
     PREPARE DISTRIBUTION
  ============================================================ */

  async function prepareDistribution(
    jobId
  ) {
    const job =
      state.jobs.get(
        jobId
      );

    if (!job) {
      throw new Error(
        "Distribution job not found"
      );
    }

    const content =
      job.content;

    if (!content) {
      throw new Error(
        "Distribution job has no content"
      );
    }

    const channels =
      await selectChannels(
        content,
        {
          ...job.strategy,

          channels:
            job.requestedChannels
        }
      );

    job.selectedChannels =
      channels.map(
        channel =>
          channel.id
      );

    await query(
      `
      UPDATE ez_distribution_jobs
      SET
        selected_channels = $1
      WHERE id = $2
      `,
      [
        JSON.stringify(
          job.selectedChannels
        ),
        job.id
      ]
    );

    const items = [];

    for (
      const channel of
        channels
    ) {
      const decision =
        evaluateDistribution(
          content,
          channel,
          job.strategy
        );

      const item =
        await createDistributionItem(
          job,
          channel,
          {
            ...content,

            distributionChannel:
              channel.id
          }
        );

      item.score =
        decision.score;

      item.decision =
        decision.decision;

      if (
        decision.decision ===
        "blocked"
      ) {
        item.status =
          "blocked";
      } else if (
        decision.decision ===
        "human_review"
      ) {
        item.status =
          "human_review";

        state.statistics
          .distributionsReview++;
      } else {
        item.status =
          "ready";
      }

      await query(
        `
        UPDATE ez_distribution_items
        SET
          status = $1,
          score = $2,
          decision = $3,
          updated_at = NOW()
        WHERE id = $4
        `,
        [
          item.status,
          item.score,
          item.decision,
          item.id
        ]
      );

      items.push(
        clone(item)
      );
    }

    return {
      job:
        clone(job),

      items
    };
  }

  /* ============================================================
     PROVIDER DISPATCH
  ============================================================ */

  async function dispatchToProvider(
    item
  ) {
    const channel =
      state.channels.get(
        item.channelId
      );

    if (!channel) {
      throw new Error(
        "Distribution channel not found"
      );
    }

    /*
     * EZ MEDIA internal publishing engine
     */

    if (
      channel.provider ===
        "ez-media" &&
      publishingEngine &&
      typeof publishingEngine.publish ===
        "function"
    ) {
      return publishingEngine.publish(
        {
          content:
            item.payload,

          channel:
            channel.id
        }
      );
    }

    /*
     * Live/broadcast infrastructure
     */

    if (
      channel.type ===
        "broadcast" &&
      liveBroadcastEngine
    ) {
      return {
        provider:
          "ez-broadcast",

        status:
          "ready_for_broadcast",

        externalDispatch:
          false
      };
    }

    /*
     * External providers intentionally
     * require real provider connectors.
     */

    return {
      provider:
        channel.provider,

      status:
        "provider_not_connected",

      externalDispatch:
        false,

      message:
        "External provider credentials/API are not connected"
    };
  }

  /* ============================================================
     EXECUTE ITEM
  ============================================================ */

  async function executeDistribution(
    distributionId
  ) {
    const item =
      state.distributions.get(
        distributionId
      );

    if (!item) {
      throw new Error(
        "Distribution item not found"
      );
    }

    if (
      item.status ===
        "blocked" ||
      item.status ===
        "human_review"
    ) {
      return clone(item);
    }

    item.status =
      "publishing";

    item.attempts += 1;

    state.statistics
      .distributionsStarted++;

    const attempt = {
      id:
        id("distribution_attempt"),

      distributionId:
        item.id,

      attemptNumber:
        item.attempts,

      status:
        "started",

      provider:
        item.provider,

      response:
        {},

      error:
        {},

      startedAt:
        now(),

      completedAt:
        null
    };

    state.attempts.set(
      attempt.id,
      attempt
    );

    await query(
      `
      INSERT INTO ez_distribution_attempts
      (
        id,
        distribution_id,
        attempt_number,
        status,
        provider,
        response,
        error,
        started_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        attempt.id,
        attempt.distributionId,
        attempt.attemptNumber,
        attempt.status,
        attempt.provider,
        JSON.stringify({}),
        JSON.stringify({}),
        attempt.startedAt
      ]
    );

    try {
      const result =
        await dispatchToProvider(
          item
        );

      item.response =
        result || {};

      /*
       * A provider that is not connected
       * is not considered a successful
       * external publication.
       */

      if (
        result &&
        result.externalDispatch ===
          false &&
        result.status ===
          "provider_not_connected"
      ) {
        item.status =
          "waiting_for_provider";

        item.updatedAt =
          now();

        attempt.status =
          "waiting_for_provider";

        attempt.completedAt =
          now();

        await persistItem(
          item
        );

        await persistAttempt(
          attempt
        );

        return clone(item);
      }

      item.status =
        "published";

      item.publishedAt =
        now();

      item.updatedAt =
        now();

      attempt.status =
        "success";

      attempt.completedAt =
        now();

      state.statistics
        .distributionsCompleted++;

      state.statistics
        .successfulPublications++;

      await persistItem(
        item
      );

      await persistAttempt(
        attempt
      );

      emit(
        "distribution.published",
        clone(item)
      );

      return clone(item);
    } catch (error) {
      item.status =
        "failed";

      item.error = {
        message:
          error.message
      };

      item.updatedAt =
        now();

      attempt.status =
        "failed";

      attempt.error = {
        message:
          error.message
      };

      attempt.completedAt =
        now();

      state.statistics
        .failedPublications++;

      await persistItem(
        item
      );

      await persistAttempt(
        attempt
      );

      if (
        item.attempts <
        item.maxAttempts
      ) {
        await scheduleRetry(
          item
        );
      } else {
        state.statistics
          .distributionsFailed++;

        await saveFailure(
          item,
          error
        );
      }

      return clone(item);
    }
  }

  async function persistItem(
    item
  ) {
    await query(
      `
      UPDATE ez_distribution_items
      SET
        status = $1,
        scheduled_at = $2,
        published_at = $3,
        attempts = $4,
        score = $5,
        decision = $6,
        payload = $7,
        response = $8,
        error = $9,
        metadata = $10,
        updated_at = $11
      WHERE id = $12
      `,
      [
        item.status,
        item.scheduledAt,
        item.publishedAt,
        item.attempts,
        item.score,
        item.decision,
        JSON.stringify(
          item.payload
        ),
        JSON.stringify(
          item.response
        ),
        JSON.stringify(
          item.error
        ),
        JSON.stringify(
          item.metadata
        ),
        item.updatedAt,
        item.id
      ]
    );
  }

  async function persistAttempt(
    attempt
  ) {
    await query(
      `
      UPDATE ez_distribution_attempts
      SET
        status = $1,
        response = $2,
        error = $3,
        completed_at = $4
      WHERE id = $5
      `,
      [
        attempt.status,
        JSON.stringify(
          attempt.response
        ),
        JSON.stringify(
          attempt.error
        ),
        attempt.completedAt,
        attempt.id
      ]
    );
  }

  /* ============================================================
     RETRY
  ============================================================ */

  async function scheduleRetry(
    item
  ) {
    const delay =
      defaultRetryDelayMs *
      Math.pow(
        2,
        Math.max(
          0,
          item.attempts - 1
        )
      );

    item.status =
      "retry_scheduled";

    item.scheduledAt =
      new Date(
        Date.now() +
          delay
      ).toISOString();

    state.statistics
      .retries++;

    state.statistics
      .rescheduled++;

    await persistItem(
      item
    );

    emit(
      "distribution.retry.scheduled",
      {
        distributionId:
          item.id,

        scheduledAt:
          item.scheduledAt
      }
    );

    return clone(item);
  }

  /* ============================================================
     PROCESS READY ITEMS
  ============================================================ */

  async function processPending() {
    const items =
      Array.from(
        state.distributions.values()
      ).filter(
        item =>
          (
            item.status ===
              "ready" ||
            item.status ===
              "retry_scheduled"
          ) &&
          (
            !item.scheduledAt ||
            new Date(
              item.scheduledAt
            ).getTime() <=
              Date.now()
          )
      );

    const results = [];

    for (
      const item of items
    ) {
      results.push(
        await executeDistribution(
          item.id
        )
      );
    }

    return results;
  }

  /* ============================================================
     HUMAN APPROVAL
  ============================================================ */

  async function approveDistribution(
    distributionId,
    input = {}
  ) {
    const item =
      state.distributions.get(
        distributionId
      );

    if (!item) {
      throw new Error(
        "Distribution item not found"
      );
    }

    const approval = {
      id:
        id("distribution_approval"),

      distributionId,

      decision:
        "approved_by_human",

      reviewerId:
        input.reviewerId ||
        null,

      reason:
        input.reason ||
        "تم اعتماد التوزيع",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.approvals.set(
      approval.id,
      approval
    );

    item.status =
      "ready";

    item.decision =
      "approved_by_human";

    item.updatedAt =
      now();

    await query(
      `
      INSERT INTO ez_distribution_approvals
      (
        id,
        distribution_id,
        decision,
        reviewer_id,
        reason,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        approval.id,
        approval.distributionId,
        approval.decision,
        approval.reviewerId,
        approval.reason,
        JSON.stringify(
          approval.metadata
        ),
        approval.createdAt
      ]
    );

    await persistItem(
      item
    );

    return clone(item);
  }

  async function rejectDistribution(
    distributionId,
    input = {}
  ) {
    const item =
      state.distributions.get(
        distributionId
      );

    if (!item) {
      throw new Error(
        "Distribution item not found"
      );
    }

    item.status =
      "rejected";

    item.decision =
      "rejected_by_human";

    item.updatedAt =
      now();

    await persistItem(
      item
    );

    const approval = {
      id:
        id("distribution_approval"),

      distributionId,

      decision:
        "rejected_by_human",

      reviewerId:
        input.reviewerId ||
        null,

      reason:
        input.reason ||
        "تم رفض التوزيع",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.approvals.set(
      approval.id,
      approval
    );

    state.statistics
      .distributionsRejected++;

    await query(
      `
      INSERT INTO ez_distribution_approvals
      (
        id,
        distribution_id,
        decision,
        reviewer_id,
        reason,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        approval.id,
        approval.distributionId,
        approval.decision,
        approval.reviewerId,
        approval.reason,
        JSON.stringify(
          approval.metadata
        ),
        approval.createdAt
      ]
    );

    return clone(item);
  }

  /* ============================================================
     ANALYTICS
  ============================================================ */

  async function recordAnalytics(
    input = {}
  ) {
    const record = {
      id:
        id("distribution_metric"),

      distributionId:
        input.distributionId ||
        null,

      channelId:
        input.channelId ||
        null,

      metric:
        input.metric ||
        "unknown",

      value:
        Number(
          input.value || 0
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.analytics.set(
      record.id,
      record
    );

    await query(
      `
      INSERT INTO ez_distribution_analytics
      (
        id,
        distribution_id,
        channel_id,
        metric,
        value,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        record.id,
        record.distributionId,
        record.channelId,
        record.metric,
        record.value,
        JSON.stringify(
          record.metadata
        ),
        record.createdAt
      ]
    );

    return clone(record);
  }

  /* ============================================================
     FAILURES
  ============================================================ */

  async function saveFailure(
    item,
    error
  ) {
    const failure = {
      id:
        id("distribution_failure"),

      distributionId:
        item.id,

      jobId:
        item.jobId,

      channelId:
        item.channelId,

      stage:
        "provider_dispatch",

      errorMessage:
        error.message,

      metadata:
        {},

      createdAt:
        now()
    };

    state.failures.set(
      failure.id,
      failure
    );

    await query(
      `
      INSERT INTO ez_distribution_failures
      (
        id,
        distribution_id,
        job_id,
        channel_id,
        stage,
        error_message,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        failure.id,
        failure.distributionId,
        failure.jobId,
        failure.channelId,
        failure.stage,
        failure.errorMessage,
        JSON.stringify(
          failure.metadata
        ),
        failure.createdAt
      ]
    );

    emit(
      "distribution.failed",
      clone(failure)
    );

    return clone(failure);
  }

  /* ============================================================
     DISTRIBUTE CONTENT
  ============================================================ */

  async function distribute(
    input = {}
  ) {
    const job =
      await createDistributionJob(
        input
      );

    const prepared =
      await prepareDistribution(
        job.id
      );

    const readyItems =
      prepared.items.filter(
        item =>
          item.status ===
          "ready"
      );

    if (
      input.autoExecute === true
    ) {
      for (
        const item of
          readyItems
      ) {
        await executeDistribution(
          item.id
        );
      }
    }

    return {
      job:
        getJob(job.id),

      items:
        getDistributions({
          jobId:
            job.id
        })
    };
  }

  /* ============================================================
     GETTERS
  ============================================================ */

  function getJob(
    jobId
  ) {
    const job =
      state.jobs.get(
        jobId
      );

    return job
      ? clone(job)
      : null;
  }

  function getJobs(
    filters = {}
  ) {
    return Array.from(
      state.jobs.values()
    )
      .filter(
        job =>
          (!filters.status ||
            job.status ===
              filters.status) &&
          (!filters.priority ||
            job.priority ===
              filters.priority)
      )
      .map(clone);
  }

  function getDistribution(
    distributionId
  ) {
    const item =
      state.distributions.get(
        distributionId
      );

    return item
      ? clone(item)
      : null;
  }

  function getDistributions(
    filters = {}
  ) {
    return Array.from(
      state.distributions.values()
    )
      .filter(
        item =>
          (!filters.jobId ||
            item.jobId ===
              filters.jobId) &&
          (!filters.channelId ||
            item.channelId ===
              filters.channelId) &&
          (!filters.status ||
            item.status ===
              filters.status)
      )
      .map(clone);
  }

  /* ============================================================
     DASHBOARD
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalChannels:
        state.channels.size,

      totalJobs:
        state.jobs.size,

      totalDistributions:
        state.distributions.size,

      totalAttempts:
        state.attempts.size,

      totalApprovals:
        state.approvals.size,

      totalFailures:
        state.failures.size
    };
  }

  function getDashboard() {
    return {
      status:
        getStatus(),

      channels:
        getChannels(),

      jobs:
        getJobs()
          .slice(-25)
          .reverse(),

      distributions:
        getDistributions()
          .slice(-50)
          .reverse(),

      statistics:
        getStatistics()
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Media Distribution & Channel Orchestration Engine",

      code:
        "CODE98",

      initialized:
        state.initialized,

      running:
        state.running,

      components: {
        ai:
          Boolean(
            aiCore ||
            aiOrchestrator
          ),

        contentFactory:
          Boolean(
            contentFactory
          ),

        publishing:
          Boolean(
            publishingEngine
          ),

        audience:
          Boolean(
            audienceEngine
          ),

        advertising:
          Boolean(
            advertisingEngine
          ),

        communication:
          Boolean(
            communicationEngine
          ),

        workflow:
          Boolean(
            workflowEngine
          ),

        liveBroadcast:
          Boolean(
            liveBroadcastEngine
          ),

        scheduler:
          Boolean(
            broadcastScheduler
          )
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running =
      true;

    emit(
      "distribution.started",
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
      "distribution.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  return {
    initialize,
    start,
    stop,

    getStatus,
    getStatistics,
    getDashboard,

    registerChannel,
    getChannels,
    getChannel,

    createDistributionJob,
    prepareDistribution,
    distribute,

    executeDistribution,
    processPending,

    getJob,
    getJobs,

    getDistribution,
    getDistributions,

    approveDistribution,
    rejectDistribution,

    recordAnalytics
  };
}

module.exports = {
  createIntelligentMediaDistributionEngine
};
