"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 74
 * INTELLIGENT AUDIENCE & RECOMMENDATION ENGINE
 * ============================================================
 *
 * الوظيفة:
 *
 * VISITOR
 *   ↓
 * EVENT
 *   ↓
 * PROFILE
 *   ↓
 * CONTENT INTEREST
 *   ↓
 * CONTEXT
 *   ↓
 * AI ANALYSIS
 *   ↓
 * RECOMMENDATION
 *   ↓
 * PERSONALIZED EXPERIENCE
 *   ↓
 * ANALYTICS
 *
 * مبدأ مهم:
 * - لا يعتمد النظام على هوية شخصية حساسة.
 * - يستخدم معرف جلسة/زائر مجهول.
 * - لا يتخذ قرارات تحريرية بدل CODE 72.
 * - لا ينشر المحتوى بدل CODE 73.
 * - التوصيات لا تعني أن الخبر صحيح.
 */

const crypto = require("crypto");

function createIntelligentAudienceEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    automationEngine = null,
    publishingDistributionEngine = null,
    editorialNewsroomEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxRecommendations =
      Number(
        process.env.AUDIENCE_MAX_RECOMMENDATIONS ||
        20
      ),

    profileWindowDays =
      Number(
        process.env.AUDIENCE_PROFILE_WINDOW_DAYS ||
        90
      ),

    minimumRecommendationScore =
      Number(
        process.env.AUDIENCE_MIN_RECOMMENDATION_SCORE ||
        45
      ),

    trendWindowMinutes =
      Number(
        process.env.AUDIENCE_TREND_WINDOW_MINUTES ||
        60
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    visitors: new Map(),
    events: new Map(),
    interests: new Map(),
    recommendations: new Map(),
    trends: new Map(),

    statistics: {
      events: 0,
      visitors: 0,
      profiles: 0,
      recommendations: 0,
      clicks: 0,
      views: 0,
      likes: 0,
      shares: 0,
      saves: 0,
      trendSignals: 0,
      aiAnalyses: 0
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
      crypto
        .randomBytes(6)
        .toString("hex")
    );
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(String(value || ""))
      .digest("hex");
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

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
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

  function emit(
    event,
    payload = {}
  ) {
    try {
      if (
        eventBus &&
        typeof eventBus.emit ===
          "function"
      ) {
        eventBus.emit(
          event,
          payload
        );
      }
    } catch (error) {
      logger.warn(
        "[CODE74] Event error:",
        error.message
      );
    }
  }

  /* ==========================================================
     DATABASE
  ========================================================== */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_audience_visitors (
        visitor_id TEXT PRIMARY KEY,

        first_seen TIMESTAMPTZ DEFAULT NOW(),

        last_seen TIMESTAMPTZ DEFAULT NOW(),

        language TEXT,

        country TEXT,

        region TEXT,

        device_type TEXT,

        platform TEXT,

        referrer TEXT,

        interests JSONB DEFAULT '{}'::jsonb,

        categories JSONB DEFAULT '{}'::jsonb,

        topics JSONB DEFAULT '{}'::jsonb,

        preferences JSONB DEFAULT '{}'::jsonb,

        statistics JSONB DEFAULT '{}'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_audience_events (
        id TEXT PRIMARY KEY,

        visitor_id TEXT NOT NULL,

        event_type TEXT NOT NULL,

        content_id TEXT,

        category TEXT,

        topic TEXT,

        duration_seconds NUMERIC DEFAULT 0,

        value NUMERIC DEFAULT 1,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_audience_interests (
        id TEXT PRIMARY KEY,

        visitor_id TEXT NOT NULL,

        interest_type TEXT NOT NULL,

        interest_key TEXT NOT NULL,

        score NUMERIC DEFAULT 0,

        interactions INTEGER DEFAULT 0,

        last_interaction TIMESTAMPTZ DEFAULT NOW(),

        metadata JSONB DEFAULT '{}'::jsonb,

        UNIQUE (
          visitor_id,
          interest_type,
          interest_key
        )
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_audience_recommendations (
        id TEXT PRIMARY KEY,

        visitor_id TEXT NOT NULL,

        content_id TEXT,

        recommendation_type TEXT,

        score NUMERIC DEFAULT 0,

        reasons JSONB DEFAULT '[]'::jsonb,

        position INTEGER,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_audience_trends (
        id TEXT PRIMARY KEY,

        trend_key TEXT NOT NULL,

        category TEXT,

        score NUMERIC DEFAULT 0,

        velocity NUMERIC DEFAULT 0,

        volume NUMERIC DEFAULT 0,

        confidence NUMERIC DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_audience_events_visitor
      ON ez_audience_events(visitor_id)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_audience_events_content
      ON ez_audience_events(content_id)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_audience_events_created
      ON ez_audience_events(created_at)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_audience_interests_visitor
      ON ez_audience_interests(visitor_id)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_audience_recommendations_visitor
      ON ez_audience_recommendations(visitor_id)
    `);
  }

  /* ==========================================================
     INITIALIZE
  ========================================================== */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "audience.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     ANONYMOUS VISITOR
  ========================================================== */

  function normalizeVisitorId(
    visitorId
  ) {
    if (!visitorId) {
      return id("visitor");
    }

    /*
     * نستخدم hash حتى لا نخزن معرفًا
     * خامًا غير ضروري.
     */

    return hash(
      clean(visitorId)
    );
  }

  /* ==========================================================
     VISITOR PROFILE
  ========================================================== */

  function createVisitorProfile(
    visitorId,
    context = {}
  ) {
    const normalized =
      normalizeVisitorId(
        visitorId
      );

    let visitor =
      state.visitors.get(
        normalized
      );

    if (!visitor) {
      visitor = {
        visitorId:
          normalized,

        firstSeen:
          now(),

        lastSeen:
          now(),

        language:
          clean(
            context.language ||
              "ar"
          ),

        country:
          clean(
            context.country
          ),

        region:
          clean(
            context.region
          ),

        deviceType:
          clean(
            context.deviceType
          ),

        platform:
          clean(
            context.platform
          ),

        referrer:
          clean(
            context.referrer
          ),

        interests: {},

        categories: {},

        topics: {},

        preferences: {},

        statistics: {
          views: 0,
          clicks: 0,
          likes: 0,
          shares: 0,
          saves: 0,
          readingTime: 0
        },

        metadata: {}
      };

      state.visitors.set(
        normalized,
        visitor
      );

      state.statistics.visitors++;
      state.statistics.profiles++;
    }

    visitor.lastSeen =
      now();

    return visitor;
  }

  /* ==========================================================
     EVENT TRACKING
  ========================================================== */

  async function trackEvent(
    input = {}
  ) {
    const visitor =
      createVisitorProfile(
        input.visitorId,
        input
      );

    const event = {
      id:
        id("audience-event"),

      visitorId:
        visitor.visitorId,

      eventType:
        clean(
          input.eventType ||
            "view"
        ),

      contentId:
        clean(
          input.contentId
        ),

      category:
        clean(
          input.category
        ),

      topic:
        clean(
          input.topic
        ),

      durationSeconds:
        Number(
          input.durationSeconds ||
            0
        ),

      value:
        Number(
          input.value || 1
        ),

      metadata:
        input.metadata || {},

      createdAt:
        now()
    };

    state.events.set(
      event.id,
      event
    );

    state.statistics.events++;

    updateVisitorStatistics(
      visitor,
      event
    );

    updateInterests(
      visitor,
      event
    );

    await persistEvent(
      event
    );

    await persistVisitor(
      visitor
    );

    await detectTrend(
      event
    );

    emit(
      "audience.event",
      {
        event:
          clone(event)
      }
    );

    return {
      accepted: true,

      event:
        clone(event)
    };
  }

  /* ==========================================================
     VISITOR STATISTICS
  ========================================================== */

  function updateVisitorStatistics(
    visitor,
    event
  ) {
    const statistics =
      visitor.statistics;

    switch (
      event.eventType
    ) {
      case "view":
        statistics.views++;
        state.statistics.views++;
        break;

      case "click":
        statistics.clicks++;
        state.statistics.clicks++;
        break;

      case "like":
        statistics.likes++;
        state.statistics.likes++;
        break;

      case "share":
        statistics.shares++;
        state.statistics.shares++;
        break;

      case "save":
        statistics.saves++;
        state.statistics.saves++;
        break;

      case "read":
        statistics.readingTime +=
          event.durationSeconds;
        break;

      default:
        break;
    }
  }

  /* ==========================================================
     INTEREST MODEL
  ========================================================== */

  function updateInterests(
    visitor,
    event
  ) {
    const weight =
      eventWeight(
        event.eventType
      );

    if (
      event.category
    ) {
      updateInterest(
        visitor.categories,
        event.category,
        weight
      );
    }

    if (
      event.topic
    ) {
      updateInterest(
        visitor.topics,
        event.topic,
        weight
      );
    }

    const key =
      event.contentId ||
      event.category ||
      event.topic;

    if (key) {
      updateInterest(
        visitor.interests,
        key,
        weight
      );
    }
  }

  function updateInterest(
    collection,
    key,
    weight
  ) {
    if (
      !collection[key]
    ) {
      collection[key] = {
        score: 0,
        interactions: 0,
        lastInteraction:
          now()
      };
    }

    collection[key].score =
      clamp(
        collection[key].score +
          weight,
        0,
        1000
      );

    collection[key].interactions++;

    collection[key].lastInteraction =
      now();
  }

  function eventWeight(
    type
  ) {
    switch (type) {
      case "view":
        return 1;

      case "read":
        return 4;

      case "click":
        return 5;

      case "like":
        return 8;

      case "save":
        return 10;

      case "share":
        return 12;

      case "complete":
        return 15;

      default:
        return 1;
    }
  }

  /* ==========================================================
     CONTENT SCORE
  ========================================================== */

  function calculateRecommendationScore(
    content,
    visitor,
    context = {}
  ) {
    if (!content) {
      return 0;
    }

    let score = 0;

    const category =
      clean(
        content.category
      );

    const topic =
      clean(
        content.topic
      );

    const contentId =
      clean(
        content.id
      );

    /*
     * اهتمام القسم
     */

    if (
      category &&
      visitor.categories[
        category
      ]
    ) {
      score += clamp(
        visitor.categories[
          category
        ].score,
        0,
        30
      );
    }

    /*
     * اهتمام الموضوع
     */

    if (
      topic &&
      visitor.topics[
        topic
      ]
    ) {
      score += clamp(
        visitor.topics[
          topic
        ].score,
        0,
        30
      );
    }

    /*
     * المحتوى نفسه
     */

    if (
      contentId &&
      visitor.interests[
        contentId
      ]
    ) {
      score += 15;
    }

    /*
     * الحداثة
     */

    const published =
      new Date(
        content.publishedAt ||
          content.createdAt ||
          now()
      );

    const ageHours =
      Math.max(
        0,
        (
          Date.now() -
          published.getTime()
        ) /
          3600000
      );

    const freshness =
      Math.max(
        0,
        20 -
          Math.min(
            20,
            ageHours
          )
      );

    score += freshness;

    /*
     * عاجل
     */

    if (
      content.breaking
    ) {
      score += 8;
    }

    /*
     * السياق الحالي
     */

    if (
      context.category &&
      category ===
        context.category
    ) {
      score += 8;
    }

    return clamp(
      score,
      0,
      100
    );
  }

  /* ==========================================================
     RECOMMEND CONTENT
  ========================================================== */

  async function recommend(
    input = {}
  ) {
    const visitor =
      createVisitorProfile(
        input.visitorId,
        input.context || {}
      );

    let contents =
      Array.isArray(
        input.contents
      )
        ? input.contents
        : [];

    /*
     * إذا لم تمرر المحتوى،
     * نحاول الحصول عليه من غرفة الأخبار.
     */

    if (
      !contents.length &&
      editorialNewsroomEngine &&
      typeof editorialNewsroomEngine.listStories ===
        "function"
    ) {
      try {
        contents =
          await editorialNewsroomEngine
            .listStories({
              status:
                "approved",

              limit:
                100
            });
      } catch (error) {
        logger.warn(
          "[CODE74] Story retrieval failed:",
          error.message
        );
      }
    }

    const excluded =
      new Set(
        Array.isArray(
          input.excludeContentIds
        )
          ? input.excludeContentIds
          : []
      );

    const scored =
      contents
        .filter(
          content =>
            content &&
            !excluded.has(
              content.id
            )
        )
        .map(
          content => ({
            content:
              clone(content),

            score:
              calculateRecommendationScore(
                content,
                visitor,
                input.context ||
                  {}
              ),

            reasons:
              recommendationReasons(
                content,
                visitor
              )
          })
        )
        .filter(
          item =>
            item.score >=
            minimumRecommendationScore
        )
        .sort(
          (a, b) =>
            b.score -
            a.score
        )
        .slice(
          0,
          Math.min(
            Number(
              input.limit ||
                maxRecommendations
            ),
            maxRecommendations
          )
        );

    const recommendations =
      [];

    for (
      let index = 0;
      index < scored.length;
      index++
    ) {
      const item =
        scored[index];

      const recommendation = {
        id:
          id("recommendation"),

        visitorId:
          visitor.visitorId,

        contentId:
          item.content.id,

        recommendationType:
          input.type ||
          "personalized",

        score:
          Number(
            item.score.toFixed(2)
          ),

        reasons:
          item.reasons,

        position:
          index + 1,

        content:
          item.content,

        createdAt:
          now()
      };

      recommendations.push(
        recommendation
      );

      state.recommendations.set(
        recommendation.id,
        recommendation
      );

      state.statistics.recommendations++;

      await persistRecommendation(
        recommendation
      );
    }

    emit(
      "audience.recommendations.generated",
      {
        visitorId:
          visitor.visitorId,

        count:
          recommendations.length
      }
    );

    return {
      visitorId:
        visitor.visitorId,

      recommendations:
        clone(
          recommendations
        )
    };
  }

  /* ==========================================================
     RECOMMENDATION REASONS
  ========================================================== */

  function recommendationReasons(
    content,
    visitor
  ) {
    const reasons = [];

    if (
      content.category &&
      visitor.categories[
        content.category
      ]
    ) {
      reasons.push(
        "اهتمام سابق بالقسم"
      );
    }

    if (
      content.topic &&
      visitor.topics[
        content.topic
      ]
    ) {
      reasons.push(
        "اهتمام سابق بالموضوع"
      );
    }

    if (
      content.breaking
    ) {
      reasons.push(
        "خبر عاجل"
      );
    }

    reasons.push(
      "حداثة المحتوى"
    );

    return reasons;
  }

  /* ==========================================================
     AI AUDIENCE ANALYSIS
  ========================================================== */

  async function analyzeAudience(
    visitorId
  ) {
    const visitor =
      createVisitorProfile(
        visitorId
      );

    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        analyzed:
          false,

        reason:
          "AI Core unavailable",

        profile:
          clone(visitor)
      };
    }

    try {
      const result =
        await aiCore.request({
          operation:
            "analyze-audience",

          profile:
            clone(visitor),

          interests:
            clone(
              visitor.interests
            ),

          categories:
            clone(
              visitor.categories
            ),

          topics:
            clone(
              visitor.topics
            )
        });

      state.statistics.aiAnalyses++;

      visitor.preferences = {
        ...visitor.preferences,

        ...(result?.preferences ||
          {})
      };

      await persistVisitor(
        visitor
      );

      return {
        analyzed:
          true,

        profile:
          clone(visitor),

        analysis:
          result
      };
    } catch (error) {
      return {
        analyzed:
          false,

        error:
          error.message
      };
    }
  }

  /* ==========================================================
     TREND DETECTION
  ========================================================== */

  async function detectTrend(
    event
  ) {
    const key =
      event.topic ||
      event.category ||
      event.contentId;

    if (!key) {
      return null;
    }

    const cutoff =
      Date.now() -
      trendWindowMinutes *
        60 *
        1000;

    const recent =
      Array.from(
        state.events.values()
      ).filter(
        item =>
          item.createdAt &&
          new Date(
            item.createdAt
          ).getTime() >=
            cutoff &&
          (
            item.topic ===
              event.topic ||
            item.category ===
              event.category ||
            item.contentId ===
              event.contentId
          )
      );

    const volume =
      recent.length;

    if (
      volume < 3
    ) {
      return null;
    }

    const velocity =
      volume /
      Math.max(
        1,
        trendWindowMinutes
      );

    const score =
      clamp(
        volume * 8 +
          velocity * 10,
        0,
        100
      );

    const trend = {
      id:
        id("trend"),

      trendKey:
        key,

      category:
        event.category,

      score,

      velocity,

      volume,

      confidence:
        clamp(
          50 +
            volume * 5,
          0,
          100
        ),

      metadata: {
        windowMinutes:
          trendWindowMinutes
      },

      createdAt:
        now()
    };

    state.trends.set(
      trend.id,
      trend
    );

    state.statistics.trendSignals++;

    await persistTrend(
      trend
    );

    emit(
      "audience.trend.detected",
      {
        trend:
          clone(trend)
      }
    );

    return clone(
      trend
    );
  }

  /* ==========================================================
     TREND LIST
  ========================================================== */

  function getTrends(
    limit = 20
  ) {
    return Array.from(
      state.trends.values()
    )
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(
        0,
        limit
      )
      .map(
        clone
      );
  }

  /* ==========================================================
     PROFILE
  ========================================================== */

  function getVisitorProfile(
    visitorId
  ) {
    const normalized =
      normalizeVisitorId(
        visitorId
      );

    return clone(
      state.visitors.get(
        normalized
      ) || null
    );
  }

  /* ==========================================================
     PERSONALIZED HOMEPAGE
  ========================================================== */

  async function personalizeHomepage(
    input = {}
  ) {
    const result =
      await recommend({
        visitorId:
          input.visitorId,

        contents:
          input.contents,

        context:
          input.context,

        excludeContentIds:
          input.excludeContentIds,

        limit:
          input.limit,

        type:
          "homepage"
      });

    return {
      mode:
        "personalized",

      visitorId:
        result.visitorId,

      sections: [
        {
          id:
            "recommended-for-you",

          title:
            "مقترح لك",

          items:
            result.recommendations
        }
      ]
    };
  }

  /* ==========================================================
     SMART CONTENT ORDER
  ========================================================== */

  async function rankContent(
    input = {}
  ) {
    const visitor =
      createVisitorProfile(
        input.visitorId,
        input.context || {}
      );

    const contents =
      Array.isArray(
        input.contents
      )
        ? input.contents
        : [];

    return contents
      .map(
        content => ({
          ...clone(content),

          recommendationScore:
            calculateRecommendationScore(
              content,
              visitor,
              input.context ||
                {}
            )
        })
      )
      .sort(
        (a, b) =>
          b.recommendationScore -
          a.recommendationScore
      );
  }

  /* ==========================================================
     AI TREND ANALYSIS
  ========================================================== */

  async function analyzeTrends() {
    const trends =
      getTrends(50);

    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        analyzed:
          false,

        trends
      };
    }

    try {
      const analysis =
        await aiCore.request({
          operation:
            "analyze-trends",

          trends
        });

      state.statistics.aiAnalyses++;

      return {
        analyzed:
          true,

        trends,

        analysis
      };
    } catch (error) {
      return {
        analyzed:
          false,

        trends,

        error:
          error.message
      };
    }
  }

  /* ==========================================================
     DATABASE PERSISTENCE
  ========================================================== */

  async function persistVisitor(
    visitor
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
      INSERT INTO ez_audience_visitors (
        visitor_id,
        first_seen,
        last_seen,
        language,
        country,
        region,
        device_type,
        platform,
        referrer,
        interests,
        categories,
        topics,
        preferences,
        statistics,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15
      )
      ON CONFLICT(visitor_id)
      DO UPDATE SET
        last_seen =
          EXCLUDED.last_seen,

        language =
          EXCLUDED.language,

        country =
          EXCLUDED.country,

        region =
          EXCLUDED.region,

        device_type =
          EXCLUDED.device_type,

        platform =
          EXCLUDED.platform,

        referrer =
          EXCLUDED.referrer,

        interests =
          EXCLUDED.interests,

        categories =
          EXCLUDED.categories,

        topics =
          EXCLUDED.topics,

        preferences =
          EXCLUDED.preferences,

        statistics =
          EXCLUDED.statistics,

        metadata =
          EXCLUDED.metadata
      `,
      [
        visitor.visitorId,
        visitor.firstSeen,
        visitor.lastSeen,
        visitor.language,
        visitor.country,
        visitor.region,
        visitor.deviceType,
        visitor.platform,
        visitor.referrer,
        JSON.stringify(
          visitor.interests
        ),
        JSON.stringify(
          visitor.categories
        ),
        JSON.stringify(
          visitor.topics
        ),
        JSON.stringify(
          visitor.preferences
        ),
        JSON.stringify(
          visitor.statistics
        ),
        JSON.stringify(
          visitor.metadata
        )
      ]
    );
  }

  async function persistEvent(
    event
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
      INSERT INTO ez_audience_events (
        id,
        visitor_id,
        event_type,
        content_id,
        category,
        topic,
        duration_seconds,
        value,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        event.id,
        event.visitorId,
        event.eventType,
        event.contentId,
        event.category,
        event.topic,
        event.durationSeconds,
        event.value,
        JSON.stringify(
          event.metadata
        )
      ]
    );
  }

  async function persistRecommendation(
    recommendation
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
      INSERT INTO ez_audience_recommendations (
        id,
        visitor_id,
        content_id,
        recommendation_type,
        score,
        reasons,
        position,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        recommendation.id,
        recommendation.visitorId,
        recommendation.contentId,
        recommendation.recommendationType,
        recommendation.score,
        JSON.stringify(
          recommendation.reasons
        ),
        recommendation.position,
        JSON.stringify(
          recommendation.metadata ||
            {}
        )
      ]
    );
  }

  async function persistTrend(
    trend
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
      INSERT INTO ez_audience_trends (
        id,
        trend_key,
        category,
        score,
        velocity,
        volume,
        confidence,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        trend.id,
        trend.trendKey,
        trend.category,
        trend.score,
        trend.velocity,
        trend.volume,
        trend.confidence,
        JSON.stringify(
          trend.metadata
        )
      ]
    );
  }

  /* ==========================================================
     STATUS
  ========================================================== */

  function getStatistics() {
    return {
      ...state.statistics,

      activeVisitors:
        state.visitors.size,

      trackedEvents:
        state.events.size,

      recommendationCache:
        state.recommendations.size,

      trends:
        state.trends.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Audience & Recommendation Engine",

      code:
        "74",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      configuration: {
        maxRecommendations,
        profileWindowDays,
        minimumRecommendationScore,
        trendWindowMinutes
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

        publishing:
          Boolean(
            publishingDistributionEngine
          ),

        editorial:
          Boolean(
            editorialNewsroomEngine
          ),

        notifications:
          Boolean(
            notificationService
          )
      },

      statistics:
        getStatistics(),

      timestamp:
        now()
    };
  }

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

      database,

      timestamp:
        now()
    };
  }

  function start() {
    state.running =
      true;

    emit(
      "audience.started",
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
      "audience.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     PUBLIC API
  ========================================================== */

  return {
    initialize,

    start,
    stop,

    trackEvent,

    createVisitorProfile,
    getVisitorProfile,

    recommend,
    personalizeHomepage,
    rankContent,

    analyzeAudience,
    analyzeTrends,

    detectTrend,
    getTrends,

    calculateRecommendationScore,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentAudienceEngine
};
