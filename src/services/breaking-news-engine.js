/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 65
 * Intelligent Breaking News Engine
 * ============================================================
 *
 * دورة الخبر:
 *
 * SOURCE
 *   ↓
 * INGEST
 *   ↓
 * NORMALIZE
 *   ↓
 * DEDUPLICATE
 *   ↓
 * CLASSIFY
 *   ↓
 * AI ANALYSIS
 *   ↓
 * IMPORTANCE SCORE
 *   ↓
 * RISK ANALYSIS
 *   ↓
 * PUBLISHING DECISION
 *   ↓
 * HUMAN REVIEW / AUTO PUBLISH
 *   ↓
 * STORE
 *   ↓
 * PUBLISH
 *   ↓
 * NOTIFY
 *   ↓
 * ANALYTICS
 *
 * ============================================================
 */

"use strict";

const crypto = require("crypto");
const EventEmitter = require("events");

function createBreakingNewsEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    automationEngine = null,
    notificationService = null,
    cmsService = null,
    mediaService = null,
    eventBus = null,
    logger = console,

    maxQueueSize = Number(
      process.env.BREAKING_NEWS_MAX_QUEUE || 5000
    ),

    concurrency = Number(
      process.env.BREAKING_NEWS_CONCURRENCY || 2
    ),

    processingTimeout = Number(
      process.env.BREAKING_NEWS_TIMEOUT_MS || 90000
    ),

    duplicateWindowMinutes = Number(
      process.env.BREAKING_NEWS_DUPLICATE_WINDOW_MINUTES || 180
    ),

    autoPublishScore = Number(
      process.env.BREAKING_NEWS_AUTO_PUBLISH_SCORE || 85
    ),

    humanReviewScore = Number(
      process.env.BREAKING_NEWS_HUMAN_REVIEW_SCORE || 60
    ),

    minimumPublishScore = Number(
      process.env.BREAKING_NEWS_MIN_PUBLISH_SCORE || 70
    )
  } = options;

  const emitter = new EventEmitter();

  const state = {
    initialized: false,
    running: false,
    paused: false,

    startedAt: null,
    stoppedAt: null,

    queue: [],
    processing: new Map(),
    processed: new Map(),

    statistics: {
      received: 0,
      normalized: 0,
      duplicates: 0,
      classified: 0,
      analyzed: 0,
      reviewed: 0,
      published: 0,
      rejected: 0,
      failed: 0,
      notifications: 0,

      byCategory: {},
      byPriority: {},
      bySource: {},

      averageProcessingTime: 0,
      totalProcessingTime: 0
    }
  };

  const categories = [
    "breaking",
    "politics",
    "security",
    "economy",
    "business",
    "technology",
    "ai",
    "sports",
    "culture",
    "entertainment",
    "health",
    "environment",
    "weather",
    "traffic",
    "local",
    "international",
    "general"
  ];

  const priorities = [
    "critical",
    "high",
    "medium",
    "low"
  ];

  const statuses = [
    "received",
    "processing",
    "review",
    "approved",
    "rejected",
    "published",
    "failed",
    "duplicate"
  ];

  /* =========================================================
     أدوات عامة
  ========================================================= */

  function id(prefix = "news") {
    return `${prefix}_${Date.now()}_${crypto
      .randomBytes(6)
      .toString("hex")}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function cleanText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeText(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(normalizeText(value))
      .digest("hex");
  }

  function clamp(value, min = 0, max = 100) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.min(max, Math.max(min, number));
  }

  function timeoutPromise(promise, ms, label) {
    let timer;

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            `${label || "Operation"} timed out after ${ms}ms`
          )
        );
      }, ms);
    });

    return Promise.race([
      promise.finally(() => clearTimeout(timer)),
      timeout
    ]);
  }

  function safeJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function emit(event, payload = {}) {
    try {
      emitter.emit(event, payload);

      if (
        eventBus &&
        typeof eventBus.emit === "function"
      ) {
        eventBus.emit(event, payload);
      }
    } catch (error) {
      logger.error(
        "[BREAKING NEWS] Event error:",
        error
      );
    }
  }

  /* =========================================================
     التهيئة
  ========================================================= */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    state.initialized = true;

    if (persistence) {
      try {
        await ensurePersistence();
      } catch (error) {
        logger.error(
          "[BREAKING NEWS] Persistence initialization failed:",
          error
        );
      }
    }

    emit("breaking-news.engine.initialized", {
      timestamp: now()
    });

    return getStatus();
  }

  async function ensurePersistence() {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_breaking_news (
        id TEXT PRIMARY KEY,
        source TEXT,
        source_url TEXT,
        external_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        normalized_hash TEXT,
        category TEXT,
        priority TEXT,
        status TEXT,
        importance_score NUMERIC DEFAULT 0,
        credibility_score NUMERIC DEFAULT 0,
        risk_score NUMERIC DEFAULT 0,
        publish_score NUMERIC DEFAULT 0,
        ai_analysis JSONB,
        entities JSONB,
        keywords JSONB,
        sources JSONB,
        metadata JSONB,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS idx_ez_breaking_news_hash
      ON ez_breaking_news(normalized_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS idx_ez_breaking_news_status
      ON ez_breaking_news(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS idx_ez_breaking_news_priority
      ON ez_breaking_news(priority)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS idx_ez_breaking_news_received
      ON ez_breaking_news(received_at DESC)
    `);
  }

  /* =========================================================
     تشغيل المحرك
  ========================================================= */

  function start() {
    if (!state.initialized) {
      initialize().catch((error) => {
        logger.error(error);
      });
    }

    if (state.running) {
      return getStatus();
    }

    state.running = true;
    state.paused = false;
    state.startedAt = now();

    emit("breaking-news.engine.started", {
      timestamp: now()
    });

    processQueue();

    return getStatus();
  }

  function stop() {
    state.running = false;
    state.stoppedAt = now();

    emit("breaking-news.engine.stopped", {
      timestamp: now()
    });

    return getStatus();
  }

  function pause() {
    state.paused = true;

    emit("breaking-news.engine.paused", {
      timestamp: now()
    });

    return getStatus();
  }

  function resume() {
    state.paused = false;

    if (!state.running) {
      state.running = true;
    }

    processQueue();

    emit("breaking-news.engine.resumed", {
      timestamp: now()
    });

    return getStatus();
  }

  /* =========================================================
     استقبال خبر
  ========================================================= */

  async function ingest(input = {}) {
    const news = normalizeNews(input);

    state.statistics.received += 1;

    state.statistics.bySource[news.source] =
      (state.statistics.bySource[news.source] || 0) + 1;

    emit("breaking-news.received", {
      news: safeJson(news)
    });

    const duplicate = await detectDuplicate(news);

    if (duplicate.isDuplicate) {
      news.status = "duplicate";
      news.duplicateOf = duplicate.newsId;

      state.statistics.duplicates += 1;

      await persistNews(news);

      emit("breaking-news.duplicate", {
        news: safeJson(news),
        duplicateOf: duplicate.newsId
      });

      return news;
    }

    if (state.queue.length >= maxQueueSize) {
      throw new Error(
        "Breaking news queue is full"
      );
    }

    state.queue.push(news);

    state.statistics.normalized += 1;

    emit("breaking-news.queued", {
      news: safeJson(news),
      queueSize: state.queue.length
    });

    if (state.running && !state.paused) {
      processQueue();
    }

    return news;
  }

  /* =========================================================
     تطبيع الخبر
  ========================================================= */

  function normalizeNews(input) {
    const title = cleanText(
      input.title ||
      input.headline ||
      input.name
    );

    const description = cleanText(
      input.description ||
      input.summary ||
      input.excerpt
    );

    const content = cleanText(
      input.content ||
      input.body ||
      input.text
    );

    const source = cleanText(
      input.source ||
      input.sourceName ||
      input.publisher ||
      "unknown"
    );

    const sourceUrl = cleanText(
      input.sourceUrl ||
      input.url ||
      ""
    );

    const externalId = cleanText(
      input.externalId ||
      input.guid ||
      input.id ||
      ""
    );

    if (!title) {
      throw new Error(
        "News title is required"
      );
    }

    const normalizedHash = hash(
      `${title} ${description}`
    );

    return {
      id: input.id || id("news"),

      source,
      sourceUrl,
      externalId,

      title,
      description,
      content,

      normalizedHash,

      category:
        input.category || "general",

      priority:
        input.priority || "medium",

      status: "received",

      importanceScore: 0,
      credibilityScore: 0,
      riskScore: 0,
      publishScore: 0,

      aiAnalysis: null,

      entities: [],
      keywords: [],
      sources: input.sources || [],

      metadata: {
        ...(
          input.metadata &&
          typeof input.metadata === "object"
            ? input.metadata
            : {}
        ),

        receivedFrom:
          input.receivedFrom ||
          "api",

        originalReceivedAt:
          input.receivedAt ||
          now()
      },

      receivedAt:
        input.receivedAt ||
        now(),

      processedAt: null,
      publishedAt: null,

      createdAt: now(),
      updatedAt: now()
    };
  }

  /* =========================================================
     كشف الأخبار المكررة
  ========================================================= */

  async function detectDuplicate(news) {
    const memoryDuplicate =
      findMemoryDuplicate(news);

    if (memoryDuplicate) {
      return {
        isDuplicate: true,
        newsId: memoryDuplicate.id
      };
    }

    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return {
        isDuplicate: false
      };
    }

    try {
      const result = await persistence.query(
        `
        SELECT id
        FROM ez_breaking_news
        WHERE normalized_hash = $1
        AND received_at >= NOW() - INTERVAL '${Math.max(
          1,
          duplicateWindowMinutes
        )} minutes'
        ORDER BY received_at DESC
        LIMIT 1
        `,
        [news.normalizedHash]
      );

      if (
        result &&
        result.rows &&
        result.rows.length
      ) {
        return {
          isDuplicate: true,
          newsId: result.rows[0].id
        };
      }
    } catch (error) {
      logger.error(
        "[BREAKING NEWS] Duplicate check failed:",
        error
      );
    }

    return {
      isDuplicate: false
    };
  }

  function findMemoryDuplicate(news) {
    const cutoff =
      Date.now() -
      duplicateWindowMinutes * 60 * 1000;

    for (const item of state.processed.values()) {
      if (
        new Date(item.receivedAt).getTime() <
        cutoff
      ) {
        continue;
      }

      if (
        item.normalizedHash ===
        news.normalizedHash
      ) {
        return item;
      }

      const similarity =
        calculateSimilarity(
          item.title,
          news.title
        );

      if (similarity >= 0.92) {
        return item;
      }
    }

    return null;
  }

  function calculateSimilarity(a, b) {
    const first = new Set(
      normalizeText(a)
        .split(" ")
        .filter(Boolean)
    );

    const second = new Set(
      normalizeText(b)
        .split(" ")
        .filter(Boolean)
    );

    if (!first.size || !second.size) {
      return 0;
    }

    let intersection = 0;

    for (const word of first) {
      if (second.has(word)) {
        intersection++;
      }
    }

    const union =
      new Set([
        ...first,
        ...second
      ]).size;

    return union
      ? intersection / union
      : 0;
  }

  /* =========================================================
     معالجة الطابور
  ========================================================= */

  async function processQueue() {
    if (
      !state.running ||
      state.paused
    ) {
      return;
    }

    while (
      state.processing.size < concurrency &&
      state.queue.length > 0 &&
      state.running &&
      !state.paused
    ) {
      const news = state.queue.shift();

      if (!news) {
        break;
      }

      const workerId = id("worker");

      const promise =
        processNews(news)
          .catch((error) => {
            logger.error(
              "[BREAKING NEWS] Processing error:",
              error
            );
          })
          .finally(() => {
            state.processing.delete(workerId);

            setImmediate(() => {
              processQueue();
            });
          });

      state.processing.set(
        workerId,
        promise
      );
    }
  }

  /* =========================================================
     دورة معالجة الخبر
  ========================================================= */

  async function processNews(news) {
    const started = Date.now();

    news.status = "processing";
    news.updatedAt = now();

    emit("breaking-news.processing", {
      news: safeJson(news)
    });

    try {
      await persistNews(news);

      await timeoutPromise(
        runPipeline(news),
        processingTimeout,
        "Breaking news pipeline"
      );

      news.processedAt = now();
      news.updatedAt = now();

      state.processed.set(
        news.id,
        safeJson(news)
      );

      const duration =
        Date.now() - started;

      state.statistics.totalProcessingTime +=
        duration;

      state.statistics.averageProcessingTime =
        state.statistics.totalProcessingTime /
        Math.max(
          1,
          state.statistics.analyzed +
          state.statistics.failed
        );

      await persistNews(news);

      emit("breaking-news.processed", {
        news: safeJson(news),
        duration
      });

      return news;
    } catch (error) {
      news.status = "failed";
      news.error = error.message;
      news.updatedAt = now();

      state.statistics.failed += 1;

      await persistNews(news);

      emit("breaking-news.failed", {
        news: safeJson(news),
        error: error.message
      });

      return news;
    }
  }

  /* =========================================================
     Pipeline
  ========================================================= */

  async function runPipeline(news) {
    await classifyNews(news);

    await analyzeWithAI(news);

    calculateImportance(news);

    calculateRisk(news);

    calculatePublishingScore(news);

    decidePublishing(news);

    await persistNews(news);

    await handlePublishingDecision(news);

    return news;
  }

  /* =========================================================
     التصنيف
  ========================================================= */

  async function classifyNews(news) {
    const text =
      `${news.title} ${news.description} ${news.content}`
        .toLowerCase();

    let category = news.category;

    const rules = [
      {
        category: "security",
        words: [
          "أمن",
          "أمني",
          "هجوم",
          "انفجار",
          "حادث أمني",
          "شرطة",
          "دفاع"
        ]
      },
      {
        category: "politics",
        words: [
          "رئيس",
          "حكومة",
          "وزير",
          "انتخابات",
          "برلمان",
          "سياسة"
        ]
      },
      {
        category: "economy",
        words: [
          "اقتصاد",
          "أسعار",
          "تضخم",
          "نفط",
          "بنك",
          "سوق"
        ]
      },
      {
        category: "technology",
        words: [
          "تقنية",
          "تقنيات",
          "تطبيق",
          "رقمي",
          "تقني"
        ]
      },
      {
        category: "ai",
        words: [
          "ذكاء اصطناعي",
          "AI",
          "نموذج",
          "روبوت"
        ]
      },
      {
        category: "sports",
        words: [
          "مباراة",
          "بطولة",
          "دوري",
          "منتخب",
          "لاعب"
        ]
      },
      {
        category: "health",
        words: [
          "صحة",
          "مرض",
          "مستشفى",
          "دواء",
          "وباء"
        ]
      },
      {
        category: "environment",
        words: [
          "بيئة",
          "مناخ",
          "تلوث",
          "حرارة",
          "أمطار"
        ]
      }
    ];

    for (const rule of rules) {
      if (
        rule.words.some((word) =>
          text.includes(word.toLowerCase())
        )
      ) {
        category = rule.category;
        break;
      }
    }

    if (!categories.includes(category)) {
      category = "general";
    }

    news.category = category;

    state.statistics.classified += 1;

    state.statistics.byCategory[category] =
      (state.statistics.byCategory[category] || 0) + 1;

    emit("breaking-news.classified", {
      newsId: news.id,
      category
    });

    return category;
  }

  /* =========================================================
     تحليل AI
  ========================================================= */

  async function analyzeWithAI(news) {
    if (
      !aiCore &&
      !aiOrchestrator
    ) {
      news.aiAnalysis = {
        available: false,
        reason: "AI service not configured"
      };

      state.statistics.analyzed += 1;

      return news.aiAnalysis;
    }

    const payload = {
      id: news.id,
      title: news.title,
      description: news.description,
      content: news.content,
      source: news.source,
      category: news.category,
      sourceUrl: news.sourceUrl
    };

    let result = null;

    try {
      if (
        aiOrchestrator &&
        typeof aiOrchestrator.process === "function"
      ) {
        result =
          await aiOrchestrator.process({
            type: "breaking-news",
            operation: "analyze-news",
            input: payload,
            requireHumanReview: false
          });
      } else if (
        aiCore &&
        typeof aiCore.analyzeNews === "function"
      ) {
        result =
          await aiCore.analyzeNews(payload);
      } else if (
        aiCore &&
        typeof aiCore.analyzeContent === "function"
      ) {
        result =
          await aiCore.analyzeContent(payload);
      }
    } catch (error) {
      logger.error(
        "[BREAKING NEWS] AI analysis failed:",
        error
      );

      result = {
        available: false,
        error: error.message
      };
    }

    news.aiAnalysis =
      result || {
        available: false
      };

    const analysis =
      result?.result ||
      result?.data ||
      result ||
      {};

    if (Array.isArray(analysis.keywords)) {
      news.keywords = analysis.keywords;
    }

    if (Array.isArray(analysis.entities)) {
      news.entities = analysis.entities;
    }

    if (
      analysis.category &&
      categories.includes(analysis.category)
    ) {
      news.category =
        analysis.category;
    }

    if (
      analysis.priority &&
      priorities.includes(analysis.priority)
    ) {
      news.priority =
        analysis.priority;
    }

    if (
      Number.isFinite(
        Number(analysis.importanceScore)
      )
    ) {
      news.importanceScore =
        clamp(
          analysis.importanceScore
        );
    }

    if (
      Number.isFinite(
        Number(analysis.credibilityScore)
      )
    ) {
      news.credibilityScore =
        clamp(
          analysis.credibilityScore
        );
    }

    if (
      Number.isFinite(
        Number(analysis.riskScore)
      )
    ) {
      news.riskScore =
        clamp(
          analysis.riskScore
        );
    }

    state.statistics.analyzed += 1;

    emit("breaking-news.ai.analyzed", {
      newsId: news.id,
      analysis: safeJson(news.aiAnalysis)
    });

    return news.aiAnalysis;
  }

  /* =========================================================
     درجة الأهمية
  ========================================================= */

  function calculateImportance(news) {
    let score = Number(
      news.importanceScore || 0
    );

    const priorityWeights = {
      critical: 100,
      high: 85,
      medium: 60,
      low: 30
    };

    score = Math.max(
      score,
      priorityWeights[news.priority] || 30
    );

    if (
      news.category === "breaking"
    ) {
      score += 15;
    }

    if (
      news.category === "security"
    ) {
      score += 10;
    }

    if (
      news.category === "politics"
    ) {
      score += 5;
    }

    if (
      news.category === "international"
    ) {
      score += 5;
    }

    if (
      news.sourceUrl
    ) {
      score += 5;
    }

    news.importanceScore =
      clamp(score);

    return news.importanceScore;
  }

  /* =========================================================
     تقييم المخاطر
  ========================================================= */

  function calculateRisk(news) {
    let risk = Number(
      news.riskScore || 0
    );

    const sensitiveCategories = [
      "security",
      "politics",
      "health",
      "international"
    ];

    if (
      sensitiveCategories.includes(
        news.category
      )
    ) {
      risk += 20;
    }

    const sensitiveWords = [
      "وفاة",
      "قتيل",
      "ضحايا",
      "انفجار",
      "هجوم",
      "حرب",
      "إصابة",
      "وباء",
      "كارثة",
      "إخلاء",
      "تحذير"
    ];

    const text =
      normalizeText(
        `${news.title} ${news.description}`
      );

    for (const word of sensitiveWords) {
      if (
        text.includes(
          normalizeText(word)
        )
      ) {
        risk += 8;
      }
    }

    news.riskScore =
      clamp(risk);

    return news.riskScore;
  }

  /* =========================================================
     درجة النشر
  ========================================================= */

  function calculatePublishingScore(news) {
    const importance =
      Number(news.importanceScore || 0);

    const credibility =
      Number(news.credibilityScore || 0);

    const risk =
      Number(news.riskScore || 0);

    let score =
      importance * 0.45 +
      credibility * 0.40 +
      (100 - risk) * 0.15;

    if (
      !news.credibilityScore
    ) {
      score -= 10;
    }

    news.publishScore =
      clamp(score);

    return news.publishScore;
  }

  /* =========================================================
     قرار النشر
  ========================================================= */

  function decidePublishing(news) {
    const score =
      Number(news.publishScore || 0);

    const risk =
      Number(news.riskScore || 0);

    let decision = "review";

    if (
      risk >= 75
    ) {
      decision = "review";
    } else if (
      score >= autoPublishScore &&
      risk < 40
    ) {
      decision = "auto_publish";
    } else if (
      score >= minimumPublishScore &&
      score < autoPublishScore
    ) {
      decision = "review";
    } else {
      decision = "reject";
    }

    news.metadata = {
      ...news.metadata,
      publishingDecision: decision,
      publishingRules: {
        autoPublishScore,
        humanReviewScore,
        minimumPublishScore
      }
    };

    if (decision === "review") {
      news.status = "review";
      state.statistics.reviewed += 1;
    }

    if (decision === "reject") {
      news.status = "rejected";
      state.statistics.rejected += 1;
    }

    state.statistics.byPriority[
      news.priority
    ] =
      (state.statistics.byPriority[
        news.priority
      ] || 0) + 1;

    emit(
      "breaking-news.publishing.decision",
      {
        newsId: news.id,
        decision,
        publishScore: news.publishScore,
        riskScore: news.riskScore
      }
    );

    return decision;
  }

  /* =========================================================
     تنفيذ قرار النشر
  ========================================================= */

  async function handlePublishingDecision(news) {
    const decision =
      news.metadata?.publishingDecision;

    if (decision === "reject") {
      await persistNews(news);

      emit(
        "breaking-news.rejected",
        {
          news: safeJson(news)
        }
      );

      return news;
    }

    if (decision === "review") {
      await enqueueHumanReview(news);

      await notifyReviewRequired(news);

      return news;
    }

    if (
      decision === "auto_publish"
    ) {
      await publish(news);

      return news;
    }

    return news;
  }

  /* =========================================================
     المراجعة البشرية
  ========================================================= */

  async function enqueueHumanReview(news) {
    news.metadata = {
      ...news.metadata,
      humanReviewRequired: true,
      humanReviewQueuedAt: now()
    };

    emit(
      "breaking-news.human-review.required",
      {
        news: safeJson(news)
      }
    );

    if (
      automationEngine &&
      typeof automationEngine.enqueue === "function"
    ) {
      try {
        await automationEngine.enqueue({
          type: "breaking-news",
          name: "human-review",
          priority: "high",
          payload: {
            newsId: news.id
          }
        });
      } catch (error) {
        logger.error(
          "[BREAKING NEWS] Human review enqueue failed:",
          error
        );
      }
    }

    await persistNews(news);
  }

  /* =========================================================
     نشر الخبر
  ========================================================= */

  async function publish(news) {
    if (
      news.status === "published"
    ) {
      return news;
    }

    news.status = "approved";

    await persistNews(news);

    let publicationResult = null;

    try {
      if (
        cmsService &&
        typeof cmsService.publish === "function"
      ) {
        publicationResult =
          await cmsService.publish({
            type: "breaking-news",
            title: news.title,
            description: news.description,
            content: news.content,
            category: news.category,
            priority: news.priority,
            source: news.source,
            sourceUrl: news.sourceUrl,
            metadata: news.metadata
          });
      } else if (
        cmsService &&
        typeof cmsService.createContent === "function"
      ) {
        publicationResult =
          await cmsService.createContent({
            type: "breaking-news",
            title: news.title,
            description: news.description,
            content: news.content,
            category: news.category,
            priority: news.priority,
            source: news.source,
            sourceUrl: news.sourceUrl,
            metadata: news.metadata
          });
      } else {
        publicationResult = {
          published: false,
          reason: "CMS service not configured"
        };
      }
    } catch (error) {
      news.status = "failed";
      news.error = error.message;

      state.statistics.failed += 1;

      await persistNews(news);

      emit(
        "breaking-news.publish.failed",
        {
          news: safeJson(news),
          error: error.message
        }
      );

      return news;
    }

    news.status = "published";
    news.publishedAt = now();

    news.metadata = {
      ...news.metadata,
      publicationResult
    };

    state.statistics.published += 1;

    await persistNews(news);

    emit(
      "breaking-news.published",
      {
        news: safeJson(news),
        publicationResult
      }
    );

    await notifyPublished(news);

    return news;
  }

  /* =========================================================
     الموافقة اليدوية
  ========================================================= */

  async function approve(newsId, options = {}) {
    const news =
      await getNews(newsId);

    if (!news) {
      throw new Error(
        "News item not found"
      );
    }

    news.metadata = {
      ...news.metadata,
      approvedBy:
        options.approvedBy ||
        "admin",

      approvedAt: now()
    };

    news.status = "approved";

    await persistNews(news);

    return publish(news);
  }

  async function reject(newsId, options = {}) {
    const news =
      await getNews(newsId);

    if (!news) {
      throw new Error(
        "News item not found"
      );
    }

    news.status = "rejected";

    news.metadata = {
      ...news.metadata,
      rejectedBy:
        options.rejectedBy ||
        "admin",

      rejectedAt: now(),

      rejectionReason:
        options.reason ||
        "Rejected by reviewer"
    };

    state.statistics.rejected += 1;

    await persistNews(news);

    emit(
      "breaking-news.review.rejected",
      {
        news: safeJson(news)
      }
    );

    return news;
  }

  /* =========================================================
     الإشعارات
  ========================================================= */

  async function notifyReviewRequired(news) {
    if (
      !notificationService
    ) {
      return;
    }

    try {
      if (
        typeof notificationService.notify ===
        "function"
      ) {
        await notificationService.notify({
          type: "breaking-news.review",
          title: "خبر عاجل يحتاج مراجعة",
          message: news.title,
          priority: "high",
          data: {
            newsId: news.id
          }
        });
      }

      state.statistics.notifications += 1;
    } catch (error) {
      logger.error(
        "[BREAKING NEWS] Review notification failed:",
        error
      );
    }
  }

  async function notifyPublished(news) {
    if (
      !notificationService
    ) {
      return;
    }

    try {
      if (
        typeof notificationService.notify ===
        "function"
      ) {
        await notificationService.notify({
          type: "breaking-news.published",
          title: "تم نشر خبر عاجل",
          message: news.title,
          priority:
            news.priority === "critical"
              ? "critical"
              : "high",
          data: {
            newsId: news.id,
            category: news.category,
            source: news.source
          }
        });
      }

      state.statistics.notifications += 1;
    } catch (error) {
      logger.error(
        "[BREAKING NEWS] Publication notification failed:",
        error
      );
    }
  }

  /* =========================================================
     التخزين
  ========================================================= */

  async function persistNews(news) {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return news;
    }

    try {
      await persistence.query(
        `
        INSERT INTO ez_breaking_news (
          id,
          source,
          source_url,
          external_id,
          title,
          description,
          content,
          normalized_hash,
          category,
          priority,
          status,
          importance_score,
          credibility_score,
          risk_score,
          publish_score,
          ai_analysis,
          entities,
          keywords,
          sources,
          metadata,
          received_at,
          processed_at,
          published_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23,$24,$25
        )
        ON CONFLICT (id)
        DO UPDATE SET
          source = EXCLUDED.source,
          source_url = EXCLUDED.source_url,
          external_id = EXCLUDED.external_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          content = EXCLUDED.content,
          normalized_hash = EXCLUDED.normalized_hash,
          category = EXCLUDED.category,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          importance_score = EXCLUDED.importance_score,
          credibility_score = EXCLUDED.credibility_score,
          risk_score = EXCLUDED.risk_score,
          publish_score = EXCLUDED.publish_score,
          ai_analysis = EXCLUDED.ai_analysis,
          entities = EXCLUDED.entities,
          keywords = EXCLUDED.keywords,
          sources = EXCLUDED.sources,
          metadata = EXCLUDED.metadata,
          processed_at = EXCLUDED.processed_at,
          published_at = EXCLUDED.published_at,
          updated_at = NOW()
        `,
        [
          news.id,
          news.source,
          news.sourceUrl,
          news.externalId,
          news.title,
          news.description,
          news.content,
          news.normalizedHash,
          news.category,
          news.priority,
          news.status,
          news.importanceScore,
          news.credibilityScore,
          news.riskScore,
          news.publishScore,
          JSON.stringify(
            news.aiAnalysis
          ),
          JSON.stringify(
            news.entities
          ),
          JSON.stringify(
            news.keywords
          ),
          JSON.stringify(
            news.sources
          ),
          JSON.stringify(
            news.metadata
          ),
          news.receivedAt,
          news.processedAt,
          news.publishedAt,
          news.createdAt,
          news.updatedAt
        ]
      );
    } catch (error) {
      logger.error(
        "[BREAKING NEWS] Persistence failed:",
        error
      );
    }

    return news;
  }

  /* =========================================================
     جلب خبر
  ========================================================= */

  async function getNews(newsId) {
    if (
      state.processed.has(newsId)
    ) {
      return safeJson(
        state.processed.get(newsId)
      );
    }

    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return null;
    }

    const result =
      await persistence.query(
        `
        SELECT *
        FROM ez_breaking_news
        WHERE id = $1
        LIMIT 1
        `,
        [newsId]
      );

    if (
      !result.rows ||
      !result.rows.length
    ) {
      return null;
    }

    return deserializeRow(
      result.rows[0]
    );
  }

  function deserializeRow(row) {
    return {
      ...row,

      importanceScore:
        Number(row.importance_score || 0),

      credibilityScore:
        Number(row.credibility_score || 0),

      riskScore:
        Number(row.risk_score || 0),

      publishScore:
        Number(row.publish_score || 0),

      aiAnalysis:
        parseJSON(row.ai_analysis),

      entities:
        parseJSON(row.entities) || [],

      keywords:
        parseJSON(row.keywords) || [],

      sources:
        parseJSON(row.sources) || [],

      metadata:
        parseJSON(row.metadata) || {},

      normalizedHash:
        row.normalized_hash,

      sourceUrl:
        row.source_url,

      externalId:
        row.external_id,

      receivedAt:
        row.received_at,

      processedAt:
        row.processed_at,

      publishedAt:
        row.published_at,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at
    };
  }

  function parseJSON(value) {
    if (!value) return null;

    if (
      typeof value === "object"
    ) {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /* =========================================================
     قائمة الأخبار
  ========================================================= */

  async function list(options = {}) {
    const limit =
      Math.min(
        Number(options.limit || 50),
        200
      );

    const offset =
      Math.max(
        0,
        Number(options.offset || 0)
      );

    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return Array.from(
        state.processed.values()
      ).slice(
        offset,
        offset + limit
      );
    }

    const conditions = [];
    const values = [];

    if (options.status) {
      values.push(options.status);

      conditions.push(
        `status = $${values.length}`
      );
    }

    if (options.category) {
      values.push(options.category);

      conditions.push(
        `category = $${values.length}`
      );
    }

    if (options.priority) {
      values.push(options.priority);

      conditions.push(
        `priority = $${values.length}`
      );
    }

    values.push(limit);
    const limitIndex = values.length;

    values.push(offset);
    const offsetIndex = values.length;

    const where =
      conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result =
      await persistence.query(
        `
        SELECT *
        FROM ez_breaking_news
        ${where}
        ORDER BY received_at DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
        `,
        values
      );

    return (
      result.rows || []
    ).map(deserializeRow);
  }

  /* =========================================================
     البحث
  ========================================================= */

  async function search(query, options = {}) {
    const q = cleanText(query);

    if (!q) {
      return [];
    }

    const limit =
      Math.min(
        Number(options.limit || 20),
        100
      );

    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return Array.from(
        state.processed.values()
      )
        .filter((news) =>
          normalizeText(
            `${news.title} ${news.description}`
          ).includes(
            normalizeText(q)
          )
        )
        .slice(0, limit);
    }

    const result =
      await persistence.query(
        `
        SELECT *
        FROM ez_breaking_news
        WHERE
          title ILIKE $1
          OR description ILIKE $1
          OR content ILIKE $1
        ORDER BY received_at DESC
        LIMIT $2
        `,
        [`%${q}%`, limit]
      );

    return (
      result.rows || []
    ).map(deserializeRow);
  }

  /* =========================================================
     إحصائيات
  ========================================================= */

  function getStatistics() {
    return {
      ...state.statistics,

      queueSize:
        state.queue.length,

      processing:
        state.processing.size,

      processed:
        state.processed.size,

      running:
        state.running,

      paused:
        state.paused,

      initialized:
        state.initialized,

      uptime:
        state.startedAt
          ? Date.now() -
            new Date(
              state.startedAt
            ).getTime()
          : 0
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Breaking News Engine",

      version:
        "11.0.0",

      code:
        "65",

      initialized:
        state.initialized,

      running:
        state.running,

      paused:
        state.paused,

      queueSize:
        state.queue.length,

      processing:
        state.processing.size,

      concurrency,

      limits: {
        maxQueueSize,
        processingTimeout,
        duplicateWindowMinutes,
        autoPublishScore,
        humanReviewScore,
        minimumPublishScore
      },

      statistics:
        getStatistics(),

      integrations: {
        persistence:
          Boolean(persistence),

        aiCore:
          Boolean(aiCore),

        aiOrchestrator:
          Boolean(aiOrchestrator),

        automationEngine:
          Boolean(automationEngine),

        notificationService:
          Boolean(notificationService),

        cmsService:
          Boolean(cmsService),

        mediaService:
          Boolean(mediaService)
      },

      timestamp:
        now()
    };
  }

  /* =========================================================
     Health
  ========================================================= */

  async function health() {
    let database = {
      connected: false
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
          connected: false
        };
      }
    }

    return {
      ok:
        state.initialized &&
        state.running &&
        !state.paused,

      service:
        "breaking-news-engine",

      engine:
        getStatus(),

      database,

      timestamp:
        now()
    };
  }

  /* =========================================================
     تنظيف الذاكرة
  ========================================================= */

  function cleanupMemory() {
    const cutoff =
      Date.now() -
      duplicateWindowMinutes *
        60 *
        1000;

    for (
      const [
        newsId,
        news
      ] of state.processed
    ) {
      if (
        new Date(
          news.receivedAt
        ).getTime() < cutoff
      ) {
        state.processed.delete(
          newsId
        );
      }
    }

    return {
      processed:
        state.processed.size
    };
  }

  /* =========================================================
     واجهة EventEmitter
  ========================================================= */

  function on(event, handler) {
    emitter.on(event, handler);

    return () => {
      emitter.off(
        event,
        handler
      );
    };
  }

  /* =========================================================
     API العامة
  ========================================================= */

  return {
    initialize,

    start,
    stop,
    pause,
    resume,

    ingest,
    processNews,

    approve,
    reject,
    publish,

    getNews,
    list,
    search,

    detectDuplicate,

    calculateImportance,
    calculateRisk,
    calculatePublishingScore,
    decidePublishing,

    getStatistics,
    getStatus,
    health,

    cleanupMemory,

    on,

    categories,
    priorities,
    statuses
  };
}

module.exports = {
  createBreakingNewsEngine
};
