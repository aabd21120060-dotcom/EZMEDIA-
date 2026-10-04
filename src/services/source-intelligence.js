/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 67
 * Source Intelligence & Trust Layer
 * ============================================================
 *
 * المسار:
 *
 * CODE 66
 * News Source Ingestion
 *        ↓
 * CODE 67
 * Source Intelligence
 *        ↓
 * CODE 65
 * Breaking News Engine
 *
 * الوظائف:
 *
 * - تقييم موثوقية المصدر
 * - تقييم جودة الخبر
 * - تقييم الحداثة
 * - تقييم التغطية المتعددة
 * - كشف تضارب المصادر
 * - تجميع الأخبار المتشابهة
 * - حساب Trust Score
 * - حساب Confidence Score
 * - تحديد الحاجة لمصدر رسمي
 * - اكتشاف المصدر الأساسي
 * - تسجيل تاريخ المصدر
 * - Source Reputation
 * - Fact-check readiness
 *
 * ملاحظة:
 * هذا المحرك لا يدّعي أن الخبر صحيح لمجرد ارتفاع الدرجة.
 * القرار النهائي يمكن أن يتطلب AI + مراجعة بشرية + مصدر رسمي.
 */

"use strict";

const crypto = require("crypto");
const EventEmitter = require("events");

function createSourceIntelligence(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    minimumTrustForAutoPublish =
      Number(
        process.env.SOURCE_MIN_TRUST_AUTO_PUBLISH || 85
      ),

    minimumConfidenceForAutoPublish =
      Number(
        process.env.SOURCE_MIN_CONFIDENCE_AUTO_PUBLISH || 85
      ),

    conflictReviewThreshold =
      Number(
        process.env.SOURCE_CONFLICT_REVIEW_THRESHOLD || 25
      ),

    duplicateSimilarityThreshold =
      Number(
        process.env.SOURCE_DUPLICATE_SIMILARITY_THRESHOLD || 72
      )
  } = options;

  const emitter = new EventEmitter();

  const state = {
    initialized: false,

    sources: new Map(),

    stories: new Map(),

    analyses: new Map(),

    statistics: {
      sourcesAnalyzed: 0,
      storiesAnalyzed: 0,

      highTrustSources: 0,
      lowTrustSources: 0,

      duplicateStories: 0,
      conflictsDetected: 0,

      officialSourcesDetected: 0,

      humanReviewsRequired: 0,

      autoPublishEligible: 0,

      averageTrustScore: 0,
      averageConfidenceScore: 0,

      totalTrustScore: 0,
      totalConfidenceScore: 0
    }
  };

  /* =========================================================
     أدوات أساسية
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

  function cleanText(value) {
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

  function normalizeText(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/[ى]/g, "ي")
      .replace(/[ؤ]/g, "و")
      .replace(/[ئ]/g, "ي")
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(normalizeText(value))
      .digest("hex");
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.min(
      max,
      Math.max(min, number)
    );
  }

  function safeClone(value) {
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
      logger.error(
        "[SOURCE INTELLIGENCE] Event error:",
        error
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
     تهيئة قاعدة البيانات
  ========================================================= */

  async function initialize() {
    if (
      state.initialized
    ) {
      return getStatus();
    }

    await ensureTables();

    await loadSources();

    state.initialized = true;

    emit(
      "source-intelligence.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_source_reputation (
        source_id TEXT PRIMARY KEY,

        source_name TEXT,

        source_type TEXT,

        country TEXT,

        language TEXT,

        official BOOLEAN DEFAULT FALSE,

        verified BOOLEAN DEFAULT FALSE,

        trust_score NUMERIC DEFAULT 50,

        accuracy_score NUMERIC DEFAULT 50,

        consistency_score NUMERIC DEFAULT 50,

        freshness_score NUMERIC DEFAULT 50,

        transparency_score NUMERIC DEFAULT 50,

        historical_success_score NUMERIC DEFAULT 50,

        conflict_score NUMERIC DEFAULT 0,

        publication_count BIGINT DEFAULT 0,

        accepted_count BIGINT DEFAULT 0,

        rejected_count BIGINT DEFAULT 0,

        correction_count BIGINT DEFAULT 0,

        conflict_count BIGINT DEFAULT 0,

        last_analyzed_at TIMESTAMPTZ,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_source_story_analysis (
        id TEXT PRIMARY KEY,

        story_hash TEXT NOT NULL,

        title TEXT,

        category TEXT,

        trust_score NUMERIC DEFAULT 0,

        confidence_score NUMERIC DEFAULT 0,

        credibility_score NUMERIC DEFAULT 0,

        freshness_score NUMERIC DEFAULT 0,

        corroboration_score NUMERIC DEFAULT 0,

        conflict_score NUMERIC DEFAULT 0,

        official_source_score NUMERIC DEFAULT 0,

        source_count INTEGER DEFAULT 0,

        official_source_count INTEGER DEFAULT 0,

        status TEXT DEFAULT 'pending',

        decision TEXT DEFAULT 'review',

        sources JSONB,

        conflicts JSONB,

        entities JSONB,

        keywords JSONB,

        ai_analysis JSONB,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW(),

        UNIQUE(story_hash)
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_source_conflicts (
        id TEXT PRIMARY KEY,

        story_hash TEXT,

        source_a TEXT,

        source_b TEXT,

        conflict_type TEXT,

        severity NUMERIC DEFAULT 0,

        description TEXT,

        resolved BOOLEAN DEFAULT FALSE,

        resolution TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        resolved_at TIMESTAMPTZ
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_source_story_hash
      ON ez_source_story_analysis(story_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_source_conflicts_story
      ON ez_source_conflicts(story_hash)
    `);
  }

  async function loadSources() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    try {
      const result =
        await persistence.query(`
          SELECT *
          FROM ez_source_reputation
          ORDER BY updated_at DESC
        `);

      for (
        const row of
          result.rows || []
      ) {
        state.sources.set(
          row.source_id,
          deserializeSource(row)
        );
      }
    } catch (error) {
      logger.error(
        "[SOURCE INTELLIGENCE] Loading failed:",
        error
      );
    }
  }

  function deserializeSource(row) {
    return {
      sourceId:
        row.source_id,

      sourceName:
        row.source_name,

      sourceType:
        row.source_type,

      country:
        row.country,

      language:
        row.language,

      official:
        row.official,

      verified:
        row.verified,

      trustScore:
        Number(
          row.trust_score || 50
        ),

      accuracyScore:
        Number(
          row.accuracy_score || 50
        ),

      consistencyScore:
        Number(
          row.consistency_score || 50
        ),

      freshnessScore:
        Number(
          row.freshness_score || 50
        ),

      transparencyScore:
        Number(
          row.transparency_score || 50
        ),

      historicalSuccessScore:
        Number(
          row.historical_success_score ||
            50
        ),

      conflictScore:
        Number(
          row.conflict_score || 0
        ),

      publicationCount:
        Number(
          row.publication_count || 0
        ),

      acceptedCount:
        Number(
          row.accepted_count || 0
        ),

      rejectedCount:
        Number(
          row.rejected_count || 0
        ),

      correctionCount:
        Number(
          row.correction_count || 0
        ),

      conflictCount:
        Number(
          row.conflict_count || 0
        ),

      lastAnalyzedAt:
        row.last_analyzed_at,

      metadata:
        row.metadata || {}
    };
  }

  /* =========================================================
     تعريف / تحديث المصدر
  ========================================================= */

  async function registerSource(
    input = {}
  ) {
    if (
      !input.sourceId
    ) {
      throw new Error(
        "sourceId is required"
      );
    }

    const existing =
      state.sources.get(
        input.sourceId
      );

    const source = {
      sourceId:
        input.sourceId,

      sourceName:
        cleanText(
          input.sourceName ||
            input.name ||
            input.sourceId
        ),

      sourceType:
        cleanText(
          input.sourceType ||
            input.type ||
            "unknown"
        ),

      country:
        cleanText(
          input.country
        ),

      language:
        cleanText(
          input.language ||
            "ar"
        ),

      official:
        Boolean(
          input.official
        ),

      verified:
        Boolean(
          input.verified
        ),

      trustScore:
        existing?.trustScore ??
        clamp(
          input.trustScore ??
            50
        ),

      accuracyScore:
        existing?.accuracyScore ??
        clamp(
          input.accuracyScore ??
            50
        ),

      consistencyScore:
        existing?.consistencyScore ??
        clamp(
          input.consistencyScore ??
            50
        ),

      freshnessScore:
        existing?.freshnessScore ??
        clamp(
          input.freshnessScore ??
            50
        ),

      transparencyScore:
        existing?.transparencyScore ??
        clamp(
          input.transparencyScore ??
            50
        ),

      historicalSuccessScore:
        existing?.historicalSuccessScore ??
        clamp(
          input.historicalSuccessScore ??
            50
        ),

      conflictScore:
        existing?.conflictScore ??
        0,

      publicationCount:
        existing?.publicationCount ??
        0,

      acceptedCount:
        existing?.acceptedCount ??
        0,

      rejectedCount:
        existing?.rejectedCount ??
        0,

      correctionCount:
        existing?.correctionCount ??
        0,

      conflictCount:
        existing?.conflictCount ??
        0,

      lastAnalyzedAt:
        now(),

      metadata:
        {
          ...(existing?.metadata ||
            {}),
          ...(input.metadata ||
            {})
        }
    };

    state.sources.set(
      source.sourceId,
      source
    );

    await persistSource(
      source
    );

    return safeClone(
      source
    );
  }

  async function persistSource(
    source
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
      INSERT INTO ez_source_reputation (
        source_id,
        source_name,
        source_type,
        country,
        language,
        official,
        verified,
        trust_score,
        accuracy_score,
        consistency_score,
        freshness_score,
        transparency_score,
        historical_success_score,
        conflict_score,
        publication_count,
        accepted_count,
        rejected_count,
        correction_count,
        conflict_count,
        last_analyzed_at,
        metadata,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,NOW()
      )
      ON CONFLICT(source_id)
      DO UPDATE SET
        source_name = EXCLUDED.source_name,
        source_type = EXCLUDED.source_type,
        country = EXCLUDED.country,
        language = EXCLUDED.language,
        official = EXCLUDED.official,
        verified = EXCLUDED.verified,
        trust_score = EXCLUDED.trust_score,
        accuracy_score = EXCLUDED.accuracy_score,
        consistency_score = EXCLUDED.consistency_score,
        freshness_score = EXCLUDED.freshness_score,
        transparency_score = EXCLUDED.transparency_score,
        historical_success_score =
          EXCLUDED.historical_success_score,
        conflict_score =
          EXCLUDED.conflict_score,
        publication_count =
          EXCLUDED.publication_count,
        accepted_count =
          EXCLUDED.accepted_count,
        rejected_count =
          EXCLUDED.rejected_count,
        correction_count =
          EXCLUDED.correction_count,
        conflict_count =
          EXCLUDED.conflict_count,
        last_analyzed_at =
          EXCLUDED.last_analyzed_at,
        metadata =
          EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        source.sourceId,
        source.sourceName,
        source.sourceType,
        source.country,
        source.language,
        source.official,
        source.verified,
        source.trustScore,
        source.accuracyScore,
        source.consistencyScore,
        source.freshnessScore,
        source.transparencyScore,
        source.historicalSuccessScore,
        source.conflictScore,
        source.publicationCount,
        source.acceptedCount,
        source.rejectedCount,
        source.correctionCount,
        source.conflictCount,
        source.lastAnalyzedAt,
        JSON.stringify(
          source.metadata || {}
        )
      ]
    );
  }

  /* =========================================================
     Source Trust Score
  ========================================================= */

  function calculateTrustScore(
    source
  ) {
    if (!source) {
      return 0;
    }

    let score = 0;

    score +=
      Number(
        source.accuracyScore || 0
      ) *
      0.25;

    score +=
      Number(
        source.consistencyScore || 0
      ) *
      0.15;

    score +=
      Number(
        source.freshnessScore || 0
      ) *
      0.10;

    score +=
      Number(
        source.transparencyScore || 0
      ) *
      0.10;

    score +=
      Number(
        source.historicalSuccessScore || 0
      ) *
      0.20;

    if (
      source.verified
    ) {
      score += 7;
    }

    if (
      source.official
    ) {
      score += 10;
    }

    score -=
      Number(
        source.conflictScore || 0
      ) *
      0.10;

    return clamp(
      score
    );
  }

  async function analyzeSource(
    input
  ) {
    const source =
      await registerSource(
        input
      );

    source.trustScore =
      calculateTrustScore(
        source
      );

    source.lastAnalyzedAt =
      now();

    state.statistics.sourcesAnalyzed +=
      1;

    state.statistics.totalTrustScore +=
      source.trustScore;

    state.statistics.averageTrustScore =
      state.statistics.totalTrustScore /
      Math.max(
        1,
        state.statistics.sourcesAnalyzed
      );

    if (
      source.trustScore >= 80
    ) {
      state.statistics.highTrustSources +=
        1;
    }

    if (
      source.trustScore < 50
    ) {
      state.statistics.lowTrustSources +=
        1;
    }

    await persistSource(
      source
    );

    emit(
      "source-intelligence.source-analyzed",
      {
        source:
          safeClone(source)
      }
    );

    return safeClone(
      source
    );
  }

  /* =========================================================
     تحليل الخبر
  ========================================================= */

  async function analyzeStory(
    input = {}
  ) {
    const title =
      cleanText(
        input.title
      );

    const description =
      cleanText(
        input.description
      );

    const content =
      cleanText(
        input.content
      );

    if (!title) {
      throw new Error(
        "Story title is required"
      );
    }

    const storyHash =
      hash(
        `${title}|${description}|${content}`
      );

    const sources =
      normalizeStorySources(
        input.sources ||
          []
      );

    /*
     * تسجيل المصادر أولًا.
     */

    const sourceProfiles = [];

    for (
      const source of sources
    ) {
      sourceProfiles.push(
        await registerSource(
          source
        )
      );
    }

    const trustScores =
      sourceProfiles.map(
        source =>
          source.trustScore
      );

    const averageSourceTrust =
      trustScores.length
        ? average(
            trustScores
          )
        : 0;

    const officialSources =
      sourceProfiles.filter(
        source =>
          source.official
      );

    const officialScore =
      calculateOfficialScore(
        sourceProfiles
      );

    const corroborationScore =
      calculateCorroborationScore(
        sourceProfiles
      );

    const freshnessScore =
      calculateFreshnessScore(
        input.publishedAt
      );

    const credibilityScore =
      calculateCredibilityScore({
        averageSourceTrust,
        officialScore,
        corroborationScore,
        freshnessScore
      });

    const conflicts =
      detectConflicts(
        input,
        sources
      );

    const conflictScore =
      calculateConflictScore(
        conflicts
      );

    const confidenceScore =
      calculateConfidenceScore({
        credibilityScore,
        corroborationScore,
        officialScore,
        freshnessScore,
        conflictScore
      });

    const trustScore =
      calculateStoryTrustScore({
        averageSourceTrust,
        credibilityScore,
        officialScore,
        corroborationScore,
        conflictScore
      });

    let aiAnalysis = null;

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        aiAnalysis =
          await aiOrchestrator.process(
            "analyze-news",
            {
              title,
              description,
              content,
              sources
            }
          );
      } catch (error) {
        logger.warn(
          "[SOURCE INTELLIGENCE] AI analysis unavailable:",
          error.message
        );
      }
    } else if (
      aiCore &&
      typeof aiCore.analyzeNews ===
        "function"
    ) {
      try {
        aiAnalysis =
          await aiCore.analyzeNews({
            title,
            description,
            content,
            sources
          });
      } catch (error) {
        logger.warn(
          "[SOURCE INTELLIGENCE] AI analysis unavailable:",
          error.message
        );
      }
    }

    const decision =
      makeDecision({
        trustScore,
        confidenceScore,
        conflictScore,
        officialScore
      });

    const result = {
      id:
        createId(
          "story-analysis"
        ),

      storyHash,

      title,

      category:
        cleanText(
          input.category ||
            "general"
        ),

      trustScore,

      confidenceScore,

      credibilityScore,

      freshnessScore,

      corroborationScore,

      conflictScore,

      officialSourceScore:
        officialScore,

      sourceCount:
        sourceProfiles.length,

      officialSourceCount:
        officialSources.length,

      status:
        decision.status,

      decision:
        decision.decision,

      sources:
        sourceProfiles,

      conflicts,

      entities:
        input.entities ||
        [],

      keywords:
        input.keywords ||
        [],

      aiAnalysis,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.analyses.set(
      storyHash,
      result
    );

    state.stories.set(
      storyHash,
      result
    );

    state.statistics.storiesAnalyzed +=
      1;

    state.statistics.totalConfidenceScore +=
      confidenceScore;

    state.statistics.averageConfidenceScore =
      state.statistics.totalConfidenceScore /
      Math.max(
        1,
        state.statistics.storiesAnalyzed
      );

    if (
      conflicts.length
    ) {
      state.statistics.conflictsDetected +=
        conflicts.length;
    }

    if (
      decision.status ===
      "human_review"
    ) {
      state.statistics.humanReviewsRequired +=
        1;
    }

    if (
      decision.decision ===
      "auto_publish_eligible"
    ) {
      state.statistics.autoPublishEligible +=
        1;
    }

    await persistStoryAnalysis(
      result
    );

    for (
      const conflict of
        conflicts
    ) {
      await persistConflict(
        storyHash,
        conflict
      );
    }

    emit(
      "source-intelligence.story-analyzed",
      {
        analysis:
          safeClone(result)
      }
    );

    return safeClone(
      result
    );
  }

  /* =========================================================
     Sources Normalize
  ========================================================= */

  function normalizeStorySources(
    sources
  ) {
    return sources
      .map(
        source => ({
          sourceId:
            source.sourceId ||
            source.id ||
            hash(
              source.name ||
                source.source ||
                "unknown"
            ),

          sourceName:
            cleanText(
              source.sourceName ||
                source.name ||
                source.source ||
                "Unknown Source"
            ),

          sourceType:
            cleanText(
              source.sourceType ||
                source.type ||
                "unknown"
            ),

          country:
            cleanText(
              source.country
            ),

          language:
            cleanText(
              source.language ||
                "ar"
            ),

          official:
            Boolean(
              source.official
            ),

          verified:
            Boolean(
              source.verified
            ),

          url:
            cleanText(
              source.url ||
                source.sourceUrl
            ),

          publishedAt:
            source.publishedAt ||
            null,

          statement:
            cleanText(
              source.statement ||
                source.description ||
                ""
            )
        })
      );
  }

  /* =========================================================
     Corroboration
  ========================================================= */

  function calculateCorroborationScore(
    sources
  ) {
    const count =
      sources.length;

    if (count <= 0) {
      return 0;
    }

    if (count === 1) {
      return 25;
    }

    if (count === 2) {
      return 55;
    }

    if (count === 3) {
      return 75;
    }

    if (count >= 4) {
      return 90;
    }

    return 50;
  }

  /* =========================================================
     Official Source Score
  ========================================================= */

  function calculateOfficialScore(
    sources
  ) {
    if (!sources.length) {
      return 0;
    }

    const official =
      sources.filter(
        source =>
          source.official
      ).length;

    const verified =
      sources.filter(
        source =>
          source.verified
      ).length;

    return clamp(
      official * 35 +
        verified * 10
    );
  }

  /* =========================================================
     Freshness
  ========================================================= */

  function calculateFreshnessScore(
    publishedAt
  ) {
    if (!publishedAt) {
      return 40;
    }

    const date =
      new Date(
        publishedAt
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return 30;
    }

    const ageMinutes =
      Math.max(
        0,
        (
          Date.now() -
          date.getTime()
        ) /
          60000
      );

    if (
      ageMinutes <= 5
    ) {
      return 100;
    }

    if (
      ageMinutes <= 30
    ) {
      return 95;
    }

    if (
      ageMinutes <= 120
    ) {
      return 85;
    }

    if (
      ageMinutes <= 360
    ) {
      return 75;
    }

    if (
      ageMinutes <= 1440
    ) {
      return 60;
    }

    if (
      ageMinutes <= 4320
    ) {
      return 45;
    }

    return 30;
  }

  /* =========================================================
     Credibility
  ========================================================= */

  function calculateCredibilityScore(
    input
  ) {
    return clamp(
      input.averageSourceTrust *
        0.45 +

        input.officialScore *
        0.20 +

        input.corroborationScore *
        0.20 +

        input.freshnessScore *
        0.15
    );
  }

  /* =========================================================
     Conflict Detection
  ========================================================= */

  function detectConflicts(
    input,
    sources
  ) {
    const conflicts = [];

    for (
      let i = 0;
      i < sources.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < sources.length;
        j++
      ) {
        const a =
          sources[i];

        const b =
          sources[j];

        if (
          !a.statement ||
          !b.statement
        ) {
          continue;
        }

        const similarity =
          textSimilarity(
            a.statement,
            b.statement
          );

        /*
         * اختلاف شديد في النصوص
         * لا يعني تلقائيًا أن أحدهما خطأ.
         * لذلك نسميها "potential conflict".
         */

        if (
          similarity <
          duplicateSimilarityThreshold / 100
        ) {
          const severity =
            clamp(
              100 -
                similarity * 100
            );

          conflicts.push({
            id:
              createId(
                "conflict"
              ),

            sourceA:
              a.sourceName,

            sourceB:
              b.sourceName,

            type:
              "potential_conflict",

            severity,

            similarity:

              Number(
                (
                  similarity *
                  100
                ).toFixed(2)
              ),

            description:
              "وجود اختلاف جوهري محتمل بين تصريحات أو تفاصيل المصادر."
          });
        }
      }
    }

    return conflicts;
  }

  /* =========================================================
     Similarity
  ========================================================= */

  function textSimilarity(
    a,
    b
  ) {
    const first =
      new Set(
        normalizeText(a)
          .split(" ")
          .filter(Boolean)
      );

    const second =
      new Set(
        normalizeText(b)
          .split(" ")
          .filter(Boolean)
      );

    if (
      first.size === 0 ||
      second.size === 0
    ) {
      return 0;
    }

    let intersection = 0;

    for (
      const word of first
    ) {
      if (
        second.has(word)
      ) {
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
     Conflict Score
  ========================================================= */

  function calculateConflictScore(
    conflicts
  ) {
    if (
      !conflicts.length
    ) {
      return 0;
    }

    return clamp(
      average(
        conflicts.map(
          conflict =>
            conflict.severity
        )
      )
    );
  }

  /* =========================================================
     Story Trust
  ========================================================= */

  function calculateStoryTrustScore(
    input
  ) {
    return clamp(
      input.averageSourceTrust *
        0.35 +

        input.credibilityScore *
        0.30 +

        input.officialScore *
        0.15 +

        input.corroborationScore *
        0.15 -

        input.conflictScore *
        0.20
    );
  }

  /* =========================================================
     Confidence
  ========================================================= */

  function calculateConfidenceScore(
    input
  ) {
    return clamp(
      input.credibilityScore *
        0.40 +

        input.corroborationScore *
        0.25 +

        input.officialScore *
        0.15 +

        input.freshnessScore *
        0.10 +

        (100 -
          input.conflictScore) *
        0.10
    );
  }

  /* =========================================================
     Decision
  ========================================================= */

  function makeDecision(
    input
  ) {
    if (
      input.conflictScore >=
      conflictReviewThreshold
    ) {
      return {
        status:
          "human_review",

        decision:
          "conflict_review_required",

        reason:
          "وجود تعارض أو اختلاف يحتاج إلى مراجعة."
      };
    }

    if (
      input.officialScore < 20 &&
      input.confidenceScore <
        minimumConfidenceForAutoPublish
    ) {
      return {
        status:
          "human_review",

        decision:
          "corroboration_required",

        reason:
          "الخبر يحتاج إلى دعم إضافي من مصادر موثوقة."
      };
    }

    if (
      input.trustScore >=
        minimumTrustForAutoPublish &&
      input.confidenceScore >=
        minimumConfidenceForAutoPublish
    ) {
      return {
        status:
          "eligible",

        decision:
          "auto_publish_eligible",

        reason:
          "درجات الثقة والتأكيد تجاوزت الحدود المحددة."
      };
    }

    return {
      status:
        "human_review",

      decision:
        "manual_review",

      reason:
        "لم يصل الخبر إلى مستوى النشر الآلي."
    };
  }

  /* =========================================================
     حفظ تحليل الخبر
  ========================================================= */

  async function persistStoryAnalysis(
    analysis
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
      INSERT INTO ez_source_story_analysis (
        id,
        story_hash,
        title,
        category,
        trust_score,
        confidence_score,
        credibility_score,
        freshness_score,
        corroboration_score,
        conflict_score,
        official_source_score,
        source_count,
        official_source_count,
        status,
        decision,
        sources,
        conflicts,
        entities,
        keywords,
        ai_analysis,
        metadata,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,NOW()
      )
      ON CONFLICT(story_hash)
      DO UPDATE SET
        trust_score =
          EXCLUDED.trust_score,

        confidence_score =
          EXCLUDED.confidence_score,

        credibility_score =
          EXCLUDED.credibility_score,

        freshness_score =
          EXCLUDED.freshness_score,

        corroboration_score =
          EXCLUDED.corroboration_score,

        conflict_score =
          EXCLUDED.conflict_score,

        official_source_score =
          EXCLUDED.official_source_score,

        source_count =
          EXCLUDED.source_count,

        official_source_count =
          EXCLUDED.official_source_count,

        status =
          EXCLUDED.status,

        decision =
          EXCLUDED.decision,

        sources =
          EXCLUDED.sources,

        conflicts =
          EXCLUDED.conflicts,

        entities =
          EXCLUDED.entities,

        keywords =
          EXCLUDED.keywords,

        ai_analysis =
          EXCLUDED.ai_analysis,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          NOW()
      `,
      [
        analysis.id,
        analysis.storyHash,
        analysis.title,
        analysis.category,
        analysis.trustScore,
        analysis.confidenceScore,
        analysis.credibilityScore,
        analysis.freshnessScore,
        analysis.corroborationScore,
        analysis.conflictScore,
        analysis.officialSourceScore,
        analysis.sourceCount,
        analysis.officialSourceCount,
        analysis.status,
        analysis.decision,
        JSON.stringify(
          analysis.sources
        ),
        JSON.stringify(
          analysis.conflicts
        ),
        JSON.stringify(
          analysis.entities
        ),
        JSON.stringify(
          analysis.keywords
        ),
        JSON.stringify(
          analysis.aiAnalysis
        ),
        JSON.stringify(
          analysis.metadata
        )
      ]
    );
  }

  async function persistConflict(
    storyHash,
    conflict
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
      INSERT INTO ez_source_conflicts (
        id,
        story_hash,
        source_a,
        source_b,
        conflict_type,
        severity,
        description
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        conflict.id,
        storyHash,
        conflict.sourceA,
        conflict.sourceB,
        conflict.type,
        conflict.severity,
        conflict.description
      ]
    );
  }

  /* =========================================================
     أدوات إحصائية
  ========================================================= */

  function average(
    values
  ) {
    if (
      !values.length
    ) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) =>
          sum + Number(value || 0),
        0
      ) /
      values.length
    );
  }

  function getSource(
    sourceId
  ) {
    return safeClone(
      state.sources.get(
        sourceId
      ) || null
    );
  }

  function listSources() {
    return Array.from(
      state.sources.values()
    ).map(
      safeClone
    );
  }

  function getStory(
    storyHash
  ) {
    return safeClone(
      state.stories.get(
        storyHash
      ) || null
    );
  }

  function getStatistics() {
    return {
      ...state.statistics,

      sourceCount:
        state.sources.size,

      storyCount:
        state.stories.size,

      analysisCount:
        state.analyses.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Source Intelligence & Trust Layer",

      code:
        "67",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      configuration: {
        minimumTrustForAutoPublish,

        minimumConfidenceForAutoPublish,

        conflictReviewThreshold,

        duplicateSimilarityThreshold
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
        state.initialized,

      database,

      sources:
        state.sources.size,

      stories:
        state.stories.size,

      timestamp:
        now()
    };
  }

  return {
    initialize,

    registerSource,
    analyzeSource,
    analyzeStory,

    calculateTrustScore,
    calculateCorroborationScore,
    calculateOfficialScore,

    getSource,
    listSources,
    getStory,

    getStatistics,
    getStatus,
    health,

    on
  };
}

module.exports = {
  createSourceIntelligence
};
