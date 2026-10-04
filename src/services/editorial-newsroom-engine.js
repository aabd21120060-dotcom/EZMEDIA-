"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 72
 * INTELLIGENT EDITORIAL & NEWSROOM ENGINE
 * ============================================================
 *
 * غرفة الأخبار الذكية المركزية.
 *
 * الوظائف:
 *
 * SOURCE
 * ↓
 * STORY CREATION
 * ↓
 * STORY MERGING
 * ↓
 * EDITORIAL ANALYSIS
 * ↓
 * PRIORITY
 * ↓
 * HEADLINE
 * ↓
 * ARTICLE DRAFT
 * ↓
 * VERIFICATION GATE
 * ↓
 * HUMAN REVIEW
 * ↓
 * SCHEDULING
 * ↓
 * PUBLISHING
 *
 * لا يتم السماح بالنشر التلقائي لمجرد أن
 * الذكاء الاصطناعي أنشأ النص.
 */

const crypto = require("crypto");
const EventEmitter = require("events");

function createEditorialNewsroomEngine(options = {}) {
  const {
    persistence = null,

    aiCore = null,

    aiOrchestrator = null,

    automationEngine = null,

    breakingNewsEngine = null,

    sourceIntelligence = null,

    newsVerificationEngine = null,

    externalVerificationEngine = null,

    mediaForensicsEngine = null,

    mediaIntelligenceEngine = null,

    notificationService = null,

    cmsService = null,

    mediaService = null,

    eventBus = null,

    logger = console,

    duplicateSimilarityThreshold =
      Number(
        process.env.EDITORIAL_DUPLICATE_SIMILARITY_THRESHOLD || 72
      ),

    minimumPublishConfidence =
      Number(
        process.env.EDITORIAL_MIN_PUBLISH_CONFIDENCE || 85
      ),

    minimumVerifiedScore =
      Number(
        process.env.EDITORIAL_MIN_VERIFICATION_SCORE || 80
      ),

    breakingNewsThreshold =
      Number(
        process.env.EDITORIAL_BREAKING_SCORE || 90
      ),

    maxStoryItems =
      Number(
        process.env.EDITORIAL_MAX_STORY_ITEMS || 200
      )
  } = options;

  const emitter = new EventEmitter();

  const state = {
    initialized: false,
    running: false,

    stories: new Map(),

    scheduled: new Map(),

    statistics: {
      totalStories: 0,

      draftStories: 0,

      reviewStories: 0,

      approvedStories: 0,

      publishedStories: 0,

      rejectedStories: 0,

      breakingStories: 0,

      mergedStories: 0,

      duplicateStories: 0,

      humanReviews: 0,

      scheduledStories: 0,

      failedOperations: 0,

      totalArticlesGenerated: 0,

      averageConfidence: 0,

      totalConfidence: 0
    }
  };

  /* =========================================================
     HELPERS
  ========================================================= */

  function now() {
    return new Date().toISOString();
  }

  function createId(prefix) {
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

  function clean(value) {
    if (
      value === null ||
      value === undefined
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

  function normalize(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(
        typeof value === "string"
          ? value
          : JSON.stringify(value)
      )
      .digest("hex");
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
      emitter.emit(
        event,
        payload
      );

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
        "[CODE72] Event error:",
        error.message
      );
    }
  }

  function on(
    event,
    handler
  ) {
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

  /* =========================================================
     DATABASE
     ========================================================= */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_editorial_stories (
        id TEXT PRIMARY KEY,

        story_hash TEXT UNIQUE NOT NULL,

        title TEXT,

        slug TEXT,

        summary TEXT,

        body TEXT,

        category TEXT,

        subcategory TEXT,

        language TEXT,

        priority TEXT,

        editorial_score NUMERIC DEFAULT 0,

        newsworthiness_score NUMERIC DEFAULT 0,

        urgency_score NUMERIC DEFAULT 0,

        public_interest_score NUMERIC DEFAULT 0,

        confidence_score NUMERIC DEFAULT 0,

        verification_score NUMERIC DEFAULT 0,

        risk_score NUMERIC DEFAULT 0,

        status TEXT,

        decision TEXT,

        human_review_required BOOLEAN DEFAULT FALSE,

        breaking BOOLEAN DEFAULT FALSE,

        sources JSONB,

        media JSONB,

        entities JSONB,

        keywords JSONB,

        topics JSONB,

        claims JSONB,

        verification JSONB,

        editorial_analysis JSONB,

        timeline JSONB,

        distribution JSONB,

        ai_metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW(),

        published_at TIMESTAMPTZ
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_editorial_story_items (
        id TEXT PRIMARY KEY,

        story_id TEXT NOT NULL,

        item_type TEXT,

        external_id TEXT,

        title TEXT,

        source_name TEXT,

        source_url TEXT,

        content TEXT,

        media JSONB,

        source JSONB,

        confidence_score NUMERIC DEFAULT 0,

        added_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_editorial_revisions (
        id TEXT PRIMARY KEY,

        story_id TEXT NOT NULL,

        revision_number INTEGER,

        action TEXT,

        previous_content TEXT,

        new_content TEXT,

        editor_type TEXT,

        editor_id TEXT,

        reason TEXT,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_editorial_reviews (
        id TEXT PRIMARY KEY,

        story_id TEXT NOT NULL,

        reviewer_id TEXT,

        decision TEXT,

        notes TEXT,

        score NUMERIC DEFAULT 0,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_editorial_schedule (
        id TEXT PRIMARY KEY,

        story_id TEXT NOT NULL,

        scheduled_at TIMESTAMPTZ NOT NULL,

        channels JSONB,

        status TEXT,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_editorial_stories_hash
      ON ez_editorial_stories(story_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_editorial_stories_status
      ON ez_editorial_stories(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_editorial_stories_priority
      ON ez_editorial_stories(priority)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_editorial_schedule_time
      ON ez_editorial_schedule(scheduled_at)
    `);
  }

  /* =========================================================
     INITIALIZE
     ========================================================= */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "editorial-newsroom.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* =========================================================
     CREATE STORY
     ========================================================= */

  async function createStory(
    input = {}
  ) {
    const storyInput =
      normalizeStoryInput(input);

    if (
      !storyInput.title &&
      !storyInput.content
    ) {
      throw new Error(
        "Story requires title or content"
      );
    }

    const storyHash =
      storyInput.storyHash ||
      calculateStoryHash(
        storyInput
      );

    /*
     * منع إنشاء قصة مكررة.
     */

    const existing =
      findExistingStory(
        storyInput
      );

    if (existing) {
      state.statistics.duplicateStories++;

      return {
        duplicate: true,

        story: clone(
          existing
        )
      };
    }

    const story = {
      id:
        createId(
          "story"
        ),

      storyHash,

      title:
        storyInput.title,

      slug:
        createSlug(
          storyInput.title
        ),

      summary:
        storyInput.summary,

      body:
        storyInput.content,

      category:
        storyInput.category ||
        "general",

      subcategory:
        storyInput.subcategory ||
        null,

      language:
        storyInput.language ||
        "ar",

      priority:
        "medium",

      editorialScore:
        0,

      newsworthinessScore:
        0,

      urgencyScore:
        0,

      publicInterestScore:
        0,

      confidenceScore:
        0,

      verificationScore:
        0,

      riskScore:
        0,

      status:
        "draft",

      decision:
        "editorial_analysis_required",

      humanReviewRequired:
        true,

      breaking:
        false,

      sources:
        storyInput.sources,

      media:
        storyInput.media,

      entities:
        storyInput.entities,

      keywords:
        storyInput.keywords,

      topics:
        storyInput.topics,

      claims:
        storyInput.claims,

      verification:
        null,

      editorialAnalysis:
        null,

      timeline: [
        {
          event:
            "story.created",

          timestamp:
            now()
        }
      ],

      distribution:
        storyInput.distribution,

      aiMetadata:
        {},

      createdAt:
        now(),

      updatedAt:
        now(),

      publishedAt:
        null
    };

    state.stories.set(
      story.id,
      story
    );

    state.statistics.totalStories++;
    state.statistics.draftStories++;

    emit(
      "editorial.story.created",
      {
        story:
          clone(story)
      }
    );

    await persistStory(
      story
    );

    /*
     * تحليل القصة فورًا.
     */

    return analyzeStory(
      story.id
    );
  }

  /* =========================================================
     NORMALIZE STORY
     ========================================================= */

  function normalizeStoryInput(
    input
  ) {
    return {
      title:
        clean(
          input.title ||
          input.headline
        ),

      summary:
        clean(
          input.summary ||
          input.description
        ),

      content:
        clean(
          input.content ||
          input.body ||
          input.text
        ),

      category:
        clean(
          input.category
        ),

      subcategory:
        clean(
          input.subcategory
        ),

      language:
        clean(
          input.language
        ),

      storyHash:
        clean(
          input.storyHash
        ),

      sources:
        Array.isArray(
          input.sources
        )
          ? input.sources
          : [],

      media:
        Array.isArray(
          input.media
        )
          ? input.media
          : [],

      entities:
        Array.isArray(
          input.entities
        )
          ? input.entities
          : [],

      keywords:
        Array.isArray(
          input.keywords
        )
          ? input.keywords
          : [],

      topics:
        Array.isArray(
          input.topics
        )
          ? input.topics
          : [],

      claims:
        Array.isArray(
          input.claims
        )
          ? input.claims
          : [],

      distribution:
        input.distribution ||
        {}
    };
  }

  function calculateStoryHash(
    story
  ) {
    return hash(
      [
        normalize(
          story.title
        ),
        normalize(
          story.content
        ).slice(
          0,
          4000
        )
      ].join("|")
    );
  }

  function createSlug(
    title
  ) {
    return normalize(
      title
    )
      .replace(/\s+/g, "-")
      .slice(
        0,
        160
      );
  }

  /* =========================================================
     DUPLICATE DETECTION
     ========================================================= */

  function similarity(
    a,
    b
  ) {
    const left =
      new Set(
        normalize(a)
          .split(" ")
          .filter(
            Boolean
          )
      );

    const right =
      new Set(
        normalize(b)
          .split(" ")
          .filter(
            Boolean
          )
      );

    if (
      !left.size ||
      !right.size
    ) {
      return 0;
    }

    let intersection =
      0;

    for (
      const token of left
    ) {
      if (
        right.has(token)
      ) {
        intersection++;
      }
    }

    const union =
      new Set([
        ...left,
        ...right
      ]).size;

    return clamp(
      (intersection /
        union) *
        100
    );
  }

  function findExistingStory(
    story
  ) {
    for (
      const existing of
        state.stories.values()
    ) {
      if (
        story.storyHash &&
        existing.storyHash ===
          story.storyHash
      ) {
        return existing;
      }

      const titleSimilarity =
        similarity(
          story.title,
          existing.title
        );

      if (
        titleSimilarity >=
        duplicateSimilarityThreshold
      ) {
        return existing;
      }
    }

    return null;
  }

  /* =========================================================
     STORY ANALYSIS
     ========================================================= */

  async function analyzeStory(
    storyId
  ) {
    const story =
      state.stories.get(
        storyId
      );

    if (!story) {
      throw new Error(
        "Story not found"
      );
    }

    emit(
      "editorial.story.analysis.started",
      {
        storyId
      }
    );

    /*
     * AI editorial analysis
     */

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        const result =
          await aiCore.request({
            operation:
              "editorial-newsroom-analysis",

            title:
              story.title,

            summary:
              story.summary,

            content:
              story.body,

            category:
              story.category,

            sources:
              story.sources,

            entities:
              story.entities,

            claims:
              story.claims
          });

        story.editorialAnalysis =
          result;

        story.newsworthinessScore =
          clamp(
            result?.newsworthiness ||
              result?.newsworthinessScore ||
              0
          );

        story.urgencyScore =
          clamp(
            result?.urgency ||
              result?.urgencyScore ||
              0
          );

        story.publicInterestScore =
          clamp(
            result?.publicInterest ||
              result?.publicInterestScore ||
              0
          );

        story.riskScore =
          clamp(
            result?.risk ||
              result?.riskScore ||
              0
          );
      } catch (error) {
        logger.warn(
          "[CODE72] AI editorial analysis failed:",
          error.message
        );
      }
    }

    /*
     * حساب النتيجة التحريرية.
     */

    story.editorialScore =
      calculateEditorialScore(
        story
      );

    story.priority =
      determinePriority(
        story
      );

    story.breaking =
      story.editorialScore >=
      breakingNewsThreshold;

    if (
      story.breaking
    ) {
      state.statistics.breakingStories++;
    }

    /*
     * إنشاء العنوان.
     */

    if (
      !story.title &&
      aiCore &&
      typeof aiCore.generateTitle ===
        "function"
    ) {
      try {
        const result =
          await aiCore.generateTitle(
            story.body,
            {
              language:
                story.language,

              style:
                "breaking-news"
            }
          );

        story.title =
          clean(
            typeof result ===
              "string"
              ? result
              : result?.title ||
                result?.text ||
                ""
          );

        story.slug =
          createSlug(
            story.title
          );
      } catch (error) {
        logger.warn(
          "[CODE72] Title generation failed:",
          error.message
        );
      }
    }

    /*
     * التحقق من القصة.
     */

    await verifyStory(
      story
    );

    /*
     * قرار التحرير.
     */

    const decision =
      editorialDecision(
        story
      );

    story.decision =
      decision.decision;

    story.humanReviewRequired =
      decision.humanReviewRequired;

    story.status =
      decision.status;

    story.updatedAt =
      now();

    story.timeline.push({
      event:
        "story.analyzed",

      timestamp:
        now(),

      priority:
        story.priority,

      editorialScore:
        story.editorialScore,

      confidenceScore:
        story.confidenceScore
    });

    if (
      story.humanReviewRequired
    ) {
      state.statistics.reviewStories++;
      state.statistics.humanReviews++;
    }

    await persistStory(
      story
    );

    emit(
      "editorial.story.analysis.completed",
      {
        story:
          clone(story)
      }
    );

    return clone(
      story
    );
  }

  /* =========================================================
     VERIFICATION
     ========================================================= */

  async function verifyStory(
    story
  ) {
    let verificationScore =
      0;

    let confidenceScore =
      50;

    /*
     * CODE 67
     */

    if (
      sourceIntelligence &&
      typeof sourceIntelligence
        .analyzeStory ===
        "function"
    ) {
      try {
        const result =
          await sourceIntelligence
            .analyzeStory({
              storyHash:
                story.storyHash,

              sources:
                story.sources
            });

        story.verification =
          story.verification ||
          {};

        story.verification
          .sourceIntelligence =
          result;

        verificationScore =
          Math.max(
            verificationScore,
            clamp(
              result?.confidence ||
                result?.storyTrust ||
                result?.trustScore ||
                0
            )
          );
      } catch (error) {
        logger.warn(
          "[CODE72] CODE67 verification failed:",
          error.message
        );
      }
    }

    /*
     * CODE 68
     */

    if (
      newsVerificationEngine &&
      typeof newsVerificationEngine.verify ===
        "function"
    ) {
      try {
        const result =
          await newsVerificationEngine
            .verify({
              storyHash:
                story.storyHash,

              title:
                story.title,

              content:
                story.body,

              sources:
                story.sources,

              claims:
                story.claims
            });

        story.verification =
          story.verification ||
          {};

        story.verification
          .newsVerification =
          result;

        verificationScore =
          Math.max(
            verificationScore,
            clamp(
              result?.verificationScore ||
                result?.confidenceScore ||
                0
            )
          );
      } catch (error) {
        logger.warn(
          "[CODE72] CODE68 verification failed:",
          error.message
        );
      }
    }

    /*
     * CODE 69
     */

    if (
      externalVerificationEngine &&
      typeof externalVerificationEngine
        .verifyAndEnrich ===
        "function"
    ) {
      try {
        const result =
          await externalVerificationEngine
            .verifyAndEnrich({
              claim:
                story.title,

              title:
                story.title,

              description:
                story.summary,

              content:
                story.body,

              storyHash:
                story.storyHash,

              sources:
                story.sources
            });

        story.verification =
          story.verification ||
          {};

        story.verification
          .external =
          result;

        verificationScore =
          Math.max(
            verificationScore,
            clamp(
              result?.verification
                ?.confidenceScore ||
                result?.confidenceScore ||
                0
            )
          );
      } catch (error) {
        logger.warn(
          "[CODE72] CODE69 verification failed:",
          error.message
        );
      }
    }

    /*
     * إذا لم تتوفر نتائج حقيقية،
     * لا نعطي درجة تحقق وهمية.
     */

    if (
      verificationScore >
      0
    ) {
      story.verificationScore =
        verificationScore;

      confidenceScore =
        Math.max(
          confidenceScore,
          verificationScore
        );
    }

    story.confidenceScore =
      clamp(
        confidenceScore
      );

    story.verificationScore =
      clamp(
        story.verificationScore
      );

    return story;
  }

  /* =========================================================
     EDITORIAL SCORE
     ========================================================= */

  function calculateEditorialScore(
    story
  ) {
    const newsworthiness =
      story.newsworthinessScore ||
      0;

    const urgency =
      story.urgencyScore ||
      0;

    const publicInterest =
      story.publicInterestScore ||
      0;

    const confidence =
      story.confidenceScore ||
      0;

    const risk =
      story.riskScore ||
      0;

    const sourceCount =
      Array.isArray(
        story.sources
      )
        ? story.sources.length
        : 0;

    const sourceBonus =
      Math.min(
        10,
        sourceCount * 2
      );

    return clamp(
      newsworthiness * 0.30 +
        urgency * 0.20 +
        publicInterest * 0.20 +
        confidence * 0.20 +
        sourceBonus -
        risk * 0.10
    );
  }

  function determinePriority(
    story
  ) {
    if (
      story.editorialScore >=
        90 ||
      story.urgencyScore >=
        90
    ) {
      return "critical";
    }

    if (
      story.editorialScore >=
        75
    ) {
      return "high";
    }

    if (
      story.editorialScore >=
        50
    ) {
      return "medium";
    }

    return "low";
  }

  /* =========================================================
     EDITORIAL DECISION
     ========================================================= */

  function editorialDecision(
    story
  ) {
    /*
     * الخطر العالي يمنع النشر التلقائي.
     */

    if (
      story.riskScore >=
      70
    ) {
      return {
        status:
          "human_review",

        decision:
          "risk_review_required",

        humanReviewRequired:
          true
      };
    }

    /*
     * لا يوجد تحقق كافٍ.
     */

    if (
      story.confidenceScore <
      minimumPublishConfidence
    ) {
      return {
        status:
          "human_review",

        decision:
          "verification_required",

        humanReviewRequired:
          true
      };
    }

    if (
      story.verificationScore <
      minimumVerifiedScore
    ) {
      return {
        status:
          "human_review",

        decision:
          "verification_required",

        humanReviewRequired:
          true
      };
    }

    /*
     * الأخبار العاجلة لا تتجاوز
     * بوابة المراجعة تلقائيًا.
     */

    if (
      story.breaking
    ) {
      return {
        status:
          "human_review",

        decision:
          "breaking_news_editorial_review",

        humanReviewRequired:
          true
      };
    }

    return {
      status:
        "ready_for_approval",

      decision:
        "editorial_approval_required",

      humanReviewRequired:
        true
    };
  }

  /* =========================================================
     MERGE STORIES
     ========================================================= */

  async function mergeStories(
    storyIds = []
  ) {
    const stories =
      storyIds
        .map(
          id =>
            state.stories.get(
              id
            )
        )
        .filter(Boolean);

    if (
      stories.length <
      2
    ) {
      throw new Error(
        "At least two stories are required"
      );
    }

    const primary =
      stories[0];

    const mergedSources =
      uniqueObjects(
        stories.flatMap(
          story =>
            story.sources ||
            []
        ),
        item =>
          item.url ||
          item.sourceUrl ||
          JSON.stringify(item)
      );

    const mergedMedia =
      uniqueObjects(
        stories.flatMap(
          story =>
            story.media ||
            []
        ),
        item =>
          item.url ||
          item.sha256 ||
          JSON.stringify(item)
      );

    const mergedEntities =
      uniqueObjects(
        stories.flatMap(
          story =>
            story.entities ||
            []
        ),
        item =>
          normalize(
            item.name ||
              item.entity ||
              JSON.stringify(item)
          )
      );

    const mergedKeywords =
      [
        ...new Set(
          stories.flatMap(
            story =>
              story.keywords ||
              []
          )
        )
      ];

    const mergedClaims =
      stories.flatMap(
        story =>
          story.claims ||
          []
      );

    primary.sources =
      mergedSources;

    primary.media =
      mergedMedia;

    primary.entities =
      mergedEntities;

    primary.keywords =
      mergedKeywords;

    primary.claims =
      mergedClaims;

    primary.timeline.push({
      event:
        "story.merged",

      timestamp:
        now(),

      mergedStoryIds:
        storyIds
    });

    for (
      const story of stories.slice(
        1
      )
    ) {
      story.status =
        "merged";

      story.timeline.push({
        event:
          "story.merged_into",

        timestamp:
          now(),

        primaryStoryId:
          primary.id
      });

      state.statistics.mergedStories++;

      await persistStory(
        story
      );
    }

    await analyzeStory(
      primary.id
    );

    emit(
      "editorial.story.merged",
      {
        primaryStoryId:
          primary.id,

        storyIds
      }
    );

    return clone(
      primary
    );
  }

  function uniqueObjects(
    values,
    keyFn
  ) {
    const result = [];
    const seen = new Set();

    for (
      const value of values
    ) {
      const key =
        clean(
          keyFn(value)
        );

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      result.push(value);
    }

    return result;
  }

  /* =========================================================
     EDIT STORY
     ========================================================= */

  async function editStory(
    storyId,
    changes = {},
    actor = {}
  ) {
    const story =
      state.stories.get(
        storyId
      );

    if (!story) {
      throw new Error(
        "Story not found"
      );
    }

    const previous =
      clone(story);

    if (
      changes.title !==
      undefined
    ) {
      story.title =
        clean(
          changes.title
        );

      story.slug =
        createSlug(
          story.title
        );
    }

    if (
      changes.summary !==
      undefined
    ) {
      story.summary =
        clean(
          changes.summary
        );
    }

    if (
      changes.body !==
      undefined
    ) {
      story.body =
        clean(
          changes.body
        );
    }

    if (
      changes.category !==
      undefined
    ) {
      story.category =
        clean(
          changes.category
        );
    }

    if (
      changes.priority !==
      undefined
    ) {
      story.priority =
        clean(
          changes.priority
        );
    }

    story.updatedAt =
      now();

    story.timeline.push({
      event:
        "story.edited",

      timestamp:
        now(),

      actor:
        actor.id ||
        actor.type ||
        "unknown"
    });

    await persistRevision({
      storyId,

      previous,

      current:
        story,

      actor,

      reason:
        changes.reason ||
        "editorial_edit"
    });

    await persistStory(
      story
    );

    emit(
      "editorial.story.edited",
      {
        storyId,

        actor:
          actor.id ||
          actor.type
      }
    );

    return clone(
      story
    );
  }

  /* =========================================================
     REVIEW
     ========================================================= */

  async function reviewStory(
    storyId,
    review = {},
    reviewer = {}
  ) {
    const story =
      state.stories.get(
        storyId
      );

    if (!story) {
      throw new Error(
        "Story not found"
      );
    }

    const decision =
      clean(
        review.decision
      ).toLowerCase();

    if (
      ![
        "approve",
        "reject",
        "hold",
        "publish"
      ].includes(
        decision
      )
    ) {
      throw new Error(
        "Invalid review decision"
      );
    }

    if (
      decision ===
      "approve"
    ) {
      story.status =
        "approved";

      story.decision =
        "editorially_approved";

      story.humanReviewRequired =
        false;

      state.statistics.approvedStories++;
    }

    if (
      decision ===
      "reject"
    ) {
      story.status =
        "rejected";

      story.decision =
        "editorially_rejected";

      story.humanReviewRequired =
        false;

      state.statistics.rejectedStories++;
    }

    if (
      decision ===
      "hold"
    ) {
      story.status =
        "human_review";

      story.decision =
        "held_for_review";

      story.humanReviewRequired =
        true;
    }

    if (
      decision ===
      "publish"
    ) {
      /*
       * حتى المحرر لا يتجاوز
       * التحقق الأساسي.
       */

      if (
        story.riskScore >=
        85
      ) {
        throw new Error(
          "High-risk story cannot be directly published"
        );
      }

      story.status =
        "approved";

      story.decision =
        "approved_for_publishing";

      story.humanReviewRequired =
        false;
    }

    story.timeline.push({
      event:
        "story.reviewed",

      timestamp:
        now(),

      decision,

      reviewer:
        reviewer.id ||
        reviewer.type ||
        "unknown",

      notes:
        clean(
          review.notes
        )
    });

    await persistReview(
      story,
      review,
      reviewer
    );

    await persistStory(
      story
    );

    emit(
      "editorial.story.reviewed",
      {
        storyId,

        decision,

        reviewer:
          reviewer.id ||
          reviewer.type
      }
    );

    return clone(
      story
    );
  }

  /* =========================================================
     PUBLISH
     ========================================================= */

  async function publishStory(
    storyId,
    options = {}
  ) {
    const story =
      state.stories.get(
        storyId
      );

    if (!story) {
      throw new Error(
        "Story not found"
      );
    }

    /*
     * بوابة أمان.
     */

    if (
      story.status !==
      "approved"
    ) {
      throw new Error(
        "Story must be approved before publishing"
      );
    }

    if (
      story.humanReviewRequired
    ) {
      throw new Error(
        "Human review is still required"
      );
    }

    if (
      story.confidenceScore <
      minimumPublishConfidence
    ) {
      throw new Error(
        "Story confidence is below publishing threshold"
      );
    }

    if (
      story.verificationScore <
      minimumVerifiedScore
    ) {
      throw new Error(
        "Story verification is below publishing threshold"
      );
    }

    let publication =
      null;

    if (
      cmsService &&
      typeof cmsService.publish ===
        "function"
    ) {
      publication =
        await cmsService.publish({
          title:
            story.title,

          slug:
            story.slug,

          summary:
            story.summary,

          content:
            story.body,

          category:
            story.category,

          metadata: {
            storyId:
              story.id,

            storyHash:
              story.storyHash,

            priority:
              story.priority,

            confidence:
              story.confidenceScore,

            verification:
              story.verificationScore
          }
        });
    }

    story.status =
      "published";

    story.decision =
      "published";

    story.publishedAt =
      now();

    story.timeline.push({
      event:
        "story.published",

      timestamp:
        now(),

      publication
    });

    state.statistics.publishedStories++;

    await persistStory(
      story
    );

    emit(
      "editorial.story.published",
      {
        storyId,

        publication
      }
    );

    return {
      story:
        clone(story),

      publication
    };
  }

  /* =========================================================
     SCHEDULING
     ========================================================= */

  async function scheduleStory(
    storyId,
    schedule = {}
  ) {
    const story =
      state.stories.get(
        storyId
      );

    if (!story) {
      throw new Error(
        "Story not found"
      );
    }

    if (
      story.status !==
      "approved"
    ) {
      throw new Error(
        "Story must be approved before scheduling"
      );
    }

    const scheduledAt =
      new Date(
        schedule.scheduledAt
      );

    if (
      Number.isNaN(
        scheduledAt.getTime()
      )
    ) {
      throw new Error(
        "Invalid scheduledAt"
      );
    }

    const scheduleId =
      createId(
        "schedule"
      );

    const item = {
      id:
        scheduleId,

      storyId,

      scheduledAt:
        scheduledAt.toISOString(),

      channels:
        Array.isArray(
          schedule.channels
        )
          ? schedule.channels
          : ["ez-media"],

      status:
        "scheduled",

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.scheduled.set(
      scheduleId,
      item
    );

    state.statistics.scheduledStories++;

    story.timeline.push({
      event:
        "story.scheduled",

      timestamp:
        now(),

      scheduleId,

      scheduledAt:
        item.scheduledAt
    });

    await persistSchedule(
      item
    );

    await persistStory(
      story
    );

    emit(
      "editorial.story.scheduled",
      {
        schedule:
          clone(item)
      }
    );

    return clone(
      item
    );
  }

  /* =========================================================
     SCHEDULE PROCESSOR
     ========================================================= */

  async function processSchedules() {
    if (
      !state.running
    ) {
      return;
    }

    const timestamp =
      Date.now();

    for (
      const item of
        state.scheduled.values()
    ) {
      if (
        item.status !==
        "scheduled"
      ) {
        continue;
      }

      const target =
        new Date(
          item.scheduledAt
        ).getTime();

      if (
        target > timestamp
      ) {
        continue;
      }

      item.status =
        "processing";

      try {
        await publishStory(
          item.storyId
        );

        item.status =
          "completed";
      } catch (error) {
        item.status =
          "failed";

        logger.warn(
          "[CODE72] Scheduled publish failed:",
          error.message
        );

        state.statistics.failedOperations++;
      }

      item.updatedAt =
        now();

      await persistSchedule(
        item
      );
    }
  }

  /* =========================================================
     LIST STORIES
     ========================================================= */

  function listStories(
    filters = {}
  ) {
    let stories =
      Array.from(
        state.stories.values()
      );

    if (
      filters.status
    ) {
      stories =
        stories.filter(
          story =>
            story.status ===
            filters.status
        );
    }

    if (
      filters.priority
    ) {
      stories =
        stories.filter(
          story =>
            story.priority ===
            filters.priority
        );
    }

    if (
      filters.category
    ) {
      stories =
        stories.filter(
          story =>
            story.category ===
            filters.category
        );
    }

    if (
      filters.breaking !==
      undefined
    ) {
      stories =
        stories.filter(
          story =>
            story.breaking ===
            Boolean(
              filters.breaking
            )
        );
    }

    stories.sort(
      (a, b) =>
        Number(
          b.editorialScore
        ) -
        Number(
          a.editorialScore
        )
    );

    const limit =
      Math.min(
        Number(
          filters.limit ||
            50
        ),
        maxStoryItems
      );

    return stories
      .slice(
        0,
        limit
      )
      .map(
        clone
      );
  }

  /* =========================================================
     GET STORY
     ========================================================= */

  function getStory(
    storyId
  ) {
    return clone(
      state.stories.get(
        storyId
      ) || null
    );
  }

  /* =========================================================
     STATISTICS
     ========================================================= */

  function getStatistics() {
    return {
      ...state.statistics,

      activeStories:
        state.stories.size,

      scheduled:
        state.scheduled.size
    };
  }

  /* =========================================================
     STATUS
     ========================================================= */

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Editorial & Newsroom",

      code:
        "72",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      configuration: {
        duplicateSimilarityThreshold,

        minimumPublishConfidence,

        minimumVerifiedScore,

        breakingNewsThreshold,

        maxStoryItems
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

        breakingNews:
          Boolean(
            breakingNewsEngine
          ),

        sourceIntelligence:
          Boolean(
            sourceIntelligence
          ),

        newsVerification:
          Boolean(
            newsVerificationEngine
          ),

        externalVerification:
          Boolean(
            externalVerificationEngine
          ),

        mediaForensics:
          Boolean(
            mediaForensicsEngine
          ),

        mediaIntelligence:
          Boolean(
            mediaIntelligenceEngine
          ),

        cms:
          Boolean(
            cmsService
          )
      },

      statistics:
        getStatistics(),

      timestamp:
        now()
    };
  }

  /* =========================================================
     HEALTH
     ========================================================= */

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

  /* =========================================================
     PERSISTENCE
     ========================================================= */

  async function persistStory(
    story
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
      INSERT INTO ez_editorial_stories (
        id,
        story_hash,
        title,
        slug,
        summary,
        body,
        category,
        subcategory,
        language,
        priority,
        editorial_score,
        newsworthiness_score,
        urgency_score,
        public_interest_score,
        confidence_score,
        verification_score,
        risk_score,
        status,
        decision,
        human_review_required,
        breaking,
        sources,
        media,
        entities,
        keywords,
        topics,
        claims,
        verification,
        editorial_analysis,
        timeline,
        distribution,
        ai_metadata,
        published_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,
        $30,$31,$32,$33,NOW()
      )
      ON CONFLICT(story_hash)
      DO UPDATE SET
        title =
          EXCLUDED.title,

        slug =
          EXCLUDED.slug,

        summary =
          EXCLUDED.summary,

        body =
          EXCLUDED.body,

        category =
          EXCLUDED.category,

        priority =
          EXCLUDED.priority,

        editorial_score =
          EXCLUDED.editorial_score,

        newsworthiness_score =
          EXCLUDED.newsworthiness_score,

        urgency_score =
          EXCLUDED.urgency_score,

        public_interest_score =
          EXCLUDED.public_interest_score,

        confidence_score =
          EXCLUDED.confidence_score,

        verification_score =
          EXCLUDED.verification_score,

        risk_score =
          EXCLUDED.risk_score,

        status =
          EXCLUDED.status,

        decision =
          EXCLUDED.decision,

        human_review_required =
          EXCLUDED.human_review_required,

        breaking =
          EXCLUDED.breaking,

        sources =
          EXCLUDED.sources,

        media =
          EXCLUDED.media,

        entities =
          EXCLUDED.entities,

        keywords =
          EXCLUDED.keywords,

        topics =
          EXCLUDED.topics,

        claims =
          EXCLUDED.claims,

        verification =
          EXCLUDED.verification,

        editorial_analysis =
          EXCLUDED.editorial_analysis,

        timeline =
          EXCLUDED.timeline,

        distribution =
          EXCLUDED.distribution,

        ai_metadata =
          EXCLUDED.ai_metadata,

        published_at =
          EXCLUDED.published_at,

        updated_at =
          NOW()
      `,
      [
        story.id,
        story.storyHash,
        story.title,
        story.slug,
        story.summary,
        story.body,
        story.category,
        story.subcategory,
        story.language,
        story.priority,
        story.editorialScore,
        story.newsworthinessScore,
        story.urgencyScore,
        story.publicInterestScore,
        story.confidenceScore,
        story.verificationScore,
        story.riskScore,
        story.status,
        story.decision,
        story.humanReviewRequired,
        story.breaking,
        JSON.stringify(
          story.sources
        ),
        JSON.stringify(
          story.media
        ),
        JSON.stringify(
          story.entities
        ),
        JSON.stringify(
          story.keywords
        ),
        JSON.stringify(
          story.topics
        ),
        JSON.stringify(
          story.claims
        ),
        JSON.stringify(
          story.verification
        ),
        JSON.stringify(
          story.editorialAnalysis
        ),
        JSON.stringify(
          story.timeline
        ),
        JSON.stringify(
          story.distribution
        ),
        JSON.stringify(
          story.aiMetadata
        ),
        story.publishedAt
      ]
    );
  }

  async function persistRevision(
    data
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
      INSERT INTO ez_editorial_revisions (
        id,
        story_id,
        revision_number,
        action,
        previous_content,
        new_content,
        editor_type,
        editor_id,
        reason,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        createId("revision"),
        data.storyId,
        1,
        "edit",
        JSON.stringify(
          data.previous
        ),
        JSON.stringify(
          data.current
        ),
        data.actor.type ||
          "unknown",
        data.actor.id ||
          null,
        data.reason,
        JSON.stringify({})
      ]
    );
  }

  async function persistReview(
    story,
    review,
    reviewer
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
      INSERT INTO ez_editorial_reviews (
        id,
        story_id,
        reviewer_id,
        decision,
        notes,
        score
      )
      VALUES (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        createId("review"),
        story.id,
        reviewer.id ||
          null,
        review.decision,
        clean(
          review.notes
        ),
        clamp(
          review.score ||
            story.confidenceScore
        )
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
      INSERT INTO ez_editorial_schedule (
        id,
        story_id,
        scheduled_at,
        channels,
        status,
        metadata,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,NOW()
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status =
          EXCLUDED.status,

        channels =
          EXCLUDED.channels,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          NOW()
      `,
      [
        item.id,
        item.storyId,
        item.scheduledAt,
        JSON.stringify(
          item.channels
        ),
        item.status,
        JSON.stringify({})
      ]
    );
  }

  /* =========================================================
     START / STOP
     ========================================================= */

  function start() {
    state.running =
      true;

    emit(
      "editorial-newsroom.started",
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
      "editorial-newsroom.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /*
   * تشغيل الجدولة كل دقيقة.
   */

  let scheduler = null;

  function startScheduler() {
    if (
      scheduler
    ) {
      return;
    }

    scheduler =
      setInterval(
        () => {
          processSchedules()
            .catch(
              error =>
                logger.warn(
                  "[CODE72] Scheduler error:",
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
    if (
      scheduler
    ) {
      clearInterval(
        scheduler
      );

      scheduler =
        null;
    }
  }

  return {
    initialize,

    start,

    stop,

    startScheduler,

    stopScheduler,

    createStory,

    analyzeStory,

    mergeStories,

    editStory,

    reviewStory,

    publishStory,

    scheduleStory,

    processSchedules,

    getStory,

    listStories,

    getStatistics,

    getStatus,

    health,

    on
  };
}

module.exports = {
  createEditorialNewsroomEngine
};
