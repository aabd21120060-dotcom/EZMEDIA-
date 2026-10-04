"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 69
 * EXTERNAL VERIFICATION & EVIDENCE DISCOVERY ENGINE
 * ============================================================
 *
 * الوظيفة:
 *
 * اكتشاف أدلة خارجية تساعد CODE 68 على التحقق من الأخبار.
 *
 * المسار:
 *
 * CLAIM
 *   ↓
 * QUERY PLANNER
 *   ↓
 * SOURCE DISCOVERY
 *   ↓
 * PRIMARY / OFFICIAL SOURCES
 *   ↓
 * SECONDARY SOURCES
 *   ↓
 * EVIDENCE EXTRACTION
 *   ↓
 * SOURCE COMPARISON
 *   ↓
 * EVIDENCE PACKAGE
 *   ↓
 * CODE 68
 *
 * مبدأ أساسي:
 *
 * البحث الخارجي = اكتشاف أدلة
 * وليس = إثبات الحقيقة تلقائياً.
 *
 * لا يتم منح الخبر حالة "صحيح" هنا.
 */

const crypto =
  require("crypto");

const EventEmitter =
  require("events");

function createExternalVerificationEngine(
  options = {}
) {
  const {
    persistence = null,

    aiCore = null,

    aiOrchestrator = null,

    sourceIntelligence = null,

    newsVerificationEngine = null,

    notificationService = null,

    eventBus = null,

    logger = console,

    maxSourcesPerQuery =
      Number(
        process.env.EXTERNAL_VERIFY_MAX_SOURCES ||
        10
      ),

    maxEvidencePerClaim =
      Number(
        process.env.EXTERNAL_VERIFY_MAX_EVIDENCE ||
        20
      ),

    timeoutMs =
      Number(
        process.env.EXTERNAL_VERIFY_TIMEOUT_MS ||
        30000
      ),

    minimumSourceScore =
      Number(
        process.env.EXTERNAL_VERIFY_MIN_SOURCE_SCORE ||
        50
      ),

    minimumEvidenceScore =
      Number(
        process.env.EXTERNAL_VERIFY_MIN_EVIDENCE_SCORE ||
        60
      )
  } = options;

  const emitter =
    new EventEmitter();

  const state = {
    initialized: false,

    running: false,

    searches: new Map(),

    evidence: new Map(),

    statistics: {
      searches: 0,

      claimsProcessed: 0,

      sourcesDiscovered: 0,

      evidenceDiscovered: 0,

      officialSources: 0,

      primarySources: 0,

      secondarySources: 0,

      highQualityEvidence: 0,

      conflictsDetected: 0,

      failedSearches: 0
    }
  };

  /* =========================================================
     Helpers
  ========================================================= */

  function now() {
    return new Date().toISOString();
  }

  function createId(
    prefix
  ) {
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

  function clean(
    value
  ) {
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

  function normalize(
    value
  ) {
    return clean(value)
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(
    value
  ) {
    return crypto
      .createHash("sha256")
      .update(
        normalize(value)
      )
      .digest("hex");
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    const number =
      Number(value);

    if (
      !Number.isFinite(number)
    ) {
      return min;
    }

    return Math.max(
      min,
      Math.min(
        max,
        number
      )
    );
  }

  function clone(
    value
  ) {
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
        "[CODE69] Event error:",
        error.message
      );
    }
  }

  function on(
    event,
    callback
  ) {
    emitter.on(
      event,
      callback
    );

    return () =>
      emitter.off(
        event,
        callback
      );
  }

  /* =========================================================
     Database
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
      CREATE TABLE IF NOT EXISTS ez_external_verification_runs (
        id TEXT PRIMARY KEY,

        claim_hash TEXT,

        story_hash TEXT,

        query TEXT,

        status TEXT,

        source_count INTEGER DEFAULT 0,

        evidence_count INTEGER DEFAULT 0,

        official_source_count INTEGER DEFAULT 0,

        confidence_score NUMERIC DEFAULT 0,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_external_verification_sources (
        id TEXT PRIMARY KEY,

        run_id TEXT,

        source_name TEXT,

        source_url TEXT,

        domain TEXT,

        source_type TEXT,

        official BOOLEAN DEFAULT FALSE,

        primary_source BOOLEAN DEFAULT FALSE,

        verified BOOLEAN DEFAULT FALSE,

        source_score NUMERIC DEFAULT 0,

        relevance_score NUMERIC DEFAULT 0,

        reliability_score NUMERIC DEFAULT 0,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_external_verification_evidence (
        id TEXT PRIMARY KEY,

        run_id TEXT,

        claim_hash TEXT,

        source_id TEXT,

        evidence_type TEXT,

        title TEXT,

        url TEXT,

        excerpt TEXT,

        support_level TEXT,

        relevance_score NUMERIC DEFAULT 0,

        reliability_score NUMERIC DEFAULT 0,

        evidence_score NUMERIC DEFAULT 0,

        official BOOLEAN DEFAULT FALSE,

        primary_source BOOLEAN DEFAULT FALSE,

        contradicts BOOLEAN DEFAULT FALSE,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_external_verification_conflicts (
        id TEXT PRIMARY KEY,

        run_id TEXT,

        claim_hash TEXT,

        source_a TEXT,

        source_b TEXT,

        description TEXT,

        severity NUMERIC DEFAULT 0,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_external_verify_claim
      ON ez_external_verification_evidence(claim_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_external_verify_run
      ON ez_external_verification_runs(id)
    `);
  }

  /* =========================================================
     Initialize
  ========================================================= */

  async function initialize() {
    if (
      state.initialized
    ) {
      return getStatus();
    }

    await ensureTables();

    state.initialized =
      true;

    emit(
      "external-verification.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* =========================================================
     Query Planner
  ========================================================= */

  function buildQueries(
    claim,
    context = {}
  ) {
    const cleanClaim =
      clean(claim);

    const queries = [];

    queries.push(
      cleanClaim
    );

    if (
      context.country
    ) {
      queries.push(
        `${cleanClaim} ${context.country}`
      );
    }

    if (
      context.organization
    ) {
      queries.push(
        `"${context.organization}" ${cleanClaim}`
      );
    }

    if (
      context.person
    ) {
      queries.push(
        `"${context.person}" ${cleanClaim}`
      );
    }

    /*
     * البحث عن المصدر الأصلي.
     */

    queries.push(
      `"${cleanClaim}" official`
    );

    queries.push(
      `"${cleanClaim}" statement`
    );

    return [
      ...new Set(
        queries
          .map(clean)
          .filter(Boolean)
      )
    ];
  }

  /* =========================================================
     External Search
  ========================================================= */

  async function discoverEvidence(
    input = {}
  ) {
    const claim =
      clean(
        input.claim
      );

    if (!claim) {
      throw new Error(
        "claim is required"
      );
    }

    const claimHash =
      hash(claim);

    const runId =
      createId(
        "verification_run"
      );

    const queries =
      buildQueries(
        claim,
        input.context ||
          {}
      );

    const run = {
      id: runId,

      claimHash,

      storyHash:
        input.storyHash ||
        null,

      claim,

      queries,

      status:
        "searching",

      sources: [],

      evidence: [],

      conflicts: [],

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.searches.set(
      runId,
      run
    );

    state.statistics.searches++;

    state.statistics.claimsProcessed++;

    emit(
      "external-verification.search.started",
      {
        runId,
        claim
      }
    );

    try {
      const discovered =
        await executeDiscovery(
          queries,
          input
        );

      run.sources =
        rankSources(
          discovered.sources
        );

      run.evidence =
        rankEvidence(
          discovered.evidence
        );

      run.conflicts =
        detectConflicts(
          run.evidence
        );

      run.confidenceScore =
        calculateConfidence(
          run
        );

      run.status =
        "completed";

      run.updatedAt =
        now();

      state.statistics.sourcesDiscovered +=
        run.sources.length;

      state.statistics.evidenceDiscovered +=
        run.evidence.length;

      state.statistics.officialSources +=
        run.sources.filter(
          source =>
            source.official
        ).length;

      state.statistics.primarySources +=
        run.sources.filter(
          source =>
            source.primarySource
        ).length;

      state.statistics.secondarySources +=
        run.sources.filter(
          source =>
            !source.primarySource
        ).length;

      state.statistics.highQualityEvidence +=
        run.evidence.filter(
          item =>
            item.evidenceScore >=
            minimumEvidenceScore
        ).length;

      state.statistics.conflictsDetected +=
        run.conflicts.length;

      await persistRun(
        run
      );

      emit(
        "external-verification.search.completed",
        {
          run:
            clone(run)
        }
      );

      return clone(run);
    } catch (error) {
      run.status =
        "failed";

      run.error =
        error.message;

      run.updatedAt =
        now();

      state.statistics.failedSearches++;

      await persistRun(
        run
      );

      emit(
        "external-verification.search.failed",
        {
          runId,
          error:
            error.message
        }
      );

      throw error;
    }
  }

  /* =========================================================
     Discovery Adapter
  ========================================================= */

  async function executeDiscovery(
    queries,
    input
  ) {
    /*
     * المصادر يمكن توصيلها لاحقاً عبر:
     *
     * - Web Search
     * - News APIs
     * - RSS
     * - Official APIs
     * - Internal Source Hub
     *
     * هذا المحرك لا يخترع نتائج.
     */

    const candidates = [];

    /*
     * مصادر دخل مباشرة من CODE 66
     */

    if (
      Array.isArray(
        input.sources
      )
    ) {
      candidates.push(
        ...input.sources
      );
    }

    /*
     * مصادر مقدمة من caller.
     */

    if (
      Array.isArray(
        input.evidence
      )
    ) {
      candidates.push(
        ...input.evidence
      );
    }

    /*
     * إذا كان هناك موصل بحث خارجي
     * يتم استخدامه فقط إذا تم حقنه.
     */

    if (
      typeof input.searchProvider ===
      "function"
    ) {
      for (
        const query of
          queries
      ) {
        const results =
          await runWithTimeout(
            input.searchProvider(
              query
            ),
            timeoutMs
          );

        if (
          Array.isArray(
            results
          )
        ) {
          candidates.push(
            ...results
          );
        }
      }
    }

    const sources =
      candidates.map(
        normalizeSource
      );

    const evidence =
      candidates
        .map(
          item =>
            createEvidence(
              item,
              input.claim
            )
        )
        .filter(Boolean);

    return {
      sources:
        deduplicateSources(
          sources
        ).slice(
          0,
          maxSourcesPerQuery
        ),

      evidence:
        deduplicateEvidence(
          evidence
        ).slice(
          0,
          maxEvidencePerClaim
        )
    };
  }

  /* =========================================================
     Normalize Source
  ========================================================= */

  function normalizeSource(
    source
  ) {
    const url =
      clean(
        source.url ||
        source.sourceUrl
      );

    let domain = "";

    try {
      domain =
        url
          ? new URL(url).hostname
          : "";
    } catch {
      domain = "";
    }

    const sourceName =
      clean(
        source.sourceName ||
        source.name ||
        source.source ||
        domain ||
        "Unknown Source"
      );

    const sourceType =
      clean(
        source.sourceType ||
        source.type ||
        detectSourceType(
          source
        )
      );

    const official =
      Boolean(
        source.official ||
        source.isOfficial
      );

    const primarySource =
      Boolean(
        source.primarySource ||
        source.isPrimary ||
        official &&
          [
            "government",
            "regulator",
            "court",
            "official_statement",
            "official_document"
          ].includes(
            sourceType
          )
      );

    const reliability =
      clamp(
        source.reliabilityScore ??
        source.trustScore ??
        50
      );

    const relevance =
      clamp(
        source.relevanceScore ??
        50
      );

    const sourceScore =
      clamp(
        reliability *
          0.55 +

          relevance *
          0.25 +

          (official
            ? 15
            : 0) +

          (primarySource
            ? 10
            : 0)
      );

    return {
      id:
        source.id ||
        createId(
          "source"
        ),

      sourceName,

      url,

      domain,

      sourceType,

      official,

      primarySource,

      verified:
        Boolean(
          source.verified
        ),

      sourceScore,

      relevanceScore:
        relevance,

      reliabilityScore:
        reliability,

      statement:
        clean(
          source.statement ||
          source.content ||
          source.excerpt
        ),

      title:
        clean(
          source.title
        ),

      publishedAt:
        source.publishedAt ||
        null,

      metadata:
        source.metadata ||
        {}
    };
  }

  function detectSourceType(
    source
  ) {
    if (
      source.government ||
      source.ministry
    ) {
      return "government";
    }

    if (
      source.regulator
    ) {
      return "regulator";
    }

    if (
      source.court
    ) {
      return "court";
    }

    if (
      source.official
    ) {
      return "official_statement";
    }

    return "media";
  }

  /* =========================================================
     Evidence
  ========================================================= */

  function createEvidence(
    source,
    claim
  ) {
    const normalized =
      normalizeSource(
        source
      );

    if (
      !normalized.statement &&
      !normalized.title
    ) {
      return null;
    }

    const relevance =
      calculateRelevance(
        claim,
        normalized
      );

    const support =
      calculateSupport(
        claim,
        normalized.statement
      );

    const contradicts =
      calculateContradiction(
        claim,
        normalized.statement
      );

    let evidenceScore =
      normalized.sourceScore *
      0.40;

    evidenceScore +=
      relevance *
      0.30;

    evidenceScore +=
      support *
      0.30;

    if (
      normalized.official
    ) {
      evidenceScore +=
        10;
    }

    if (
      normalized.primarySource
    ) {
      evidenceScore +=
        10;
    }

    if (
      contradicts
    ) {
      evidenceScore -=
        30;
    }

    evidenceScore =
      clamp(
        evidenceScore
      );

    let supportLevel =
      "unknown";

    if (
      contradicts >= 65
    ) {
      supportLevel =
        "contradicting";
    } else if (
      support >= 75
    ) {
      supportLevel =
        "strong_support";
    } else if (
      support >= 50
    ) {
      supportLevel =
        "partial_support";
    } else if (
      relevance >= 70
    ) {
      supportLevel =
        "context_only";
    }

    return {
      id:
        createId(
          "evidence"
        ),

      claimHash:
        hash(claim),

      sourceId:
        normalized.id,

      evidenceType:
        detectEvidenceType(
          normalized
        ),

      title:
        normalized.title,

      url:
        normalized.url,

      excerpt:
        normalized.statement,

      supportLevel,

      relevanceScore:
        relevance,

      reliabilityScore:
        normalized.reliabilityScore,

      evidenceScore,

      official:
        normalized.official,

      primarySource:
        normalized.primarySource,

      contradicts:
        Boolean(
          contradicts >= 65
        ),

      metadata:
        normalized.metadata ||
        {}
    };
  }

  function detectEvidenceType(
    source
  ) {
    if (
      source.primarySource
    ) {
      return "primary_source";
    }

    if (
      source.official
    ) {
      return "official_source";
    }

    if (
      source.sourceType ===
      "court"
    ) {
      return "court_document";
    }

    if (
      source.sourceType ===
      "government"
    ) {
      return "government_source";
    }

    return "secondary_source";
  }

  /* =========================================================
     Relevance
  ========================================================= */

  function calculateRelevance(
    claim,
    source
  ) {
    const sourceText =
      [
        source.title,
        source.statement
      ]
        .filter(Boolean)
        .join(" ");

    const similarity =
      textSimilarity(
        claim,
        sourceText
      );

    return clamp(
      similarity * 100
    );
  }

  function textSimilarity(
    first,
    second
  ) {
    const a =
      new Set(
        normalize(first)
          .split(" ")
          .filter(Boolean)
      );

    const b =
      new Set(
        normalize(second)
          .split(" ")
          .filter(Boolean)
      );

    if (
      !a.size ||
      !b.size
    ) {
      return 0;
    }

    let intersection =
      0;

    for (
      const word of a
    ) {
      if (
        b.has(word)
      ) {
        intersection++;
      }
    }

    const union =
      new Set([
        ...a,
        ...b
      ]).size;

    return union
      ? intersection /
          union
      : 0;
  }

  /* =========================================================
     Support / Contradiction
  ========================================================= */

  function calculateSupport(
    claim,
    statement
  ) {
    if (
      !statement
    ) {
      return 0;
    }

    const similarity =
      textSimilarity(
        claim,
        statement
      );

    let score =
      similarity * 100;

    const positiveWords = [
      "أكد",
      "اعلن",
      "أعلن",
      "صحيح",
      "confirmed",
      "official",
      "statement",
      "approved",
      "حدث",
      "وقع"
    ];

    for (
      const word of
        positiveWords
    ) {
      if (
        normalize(
          statement
        ).includes(
          normalize(word)
        )
      ) {
        score += 5;
      }
    }

    return clamp(
      score
    );
  }

  function calculateContradiction(
    claim,
    statement
  ) {
    if (
      !statement
    ) {
      return 0;
    }

    const normalized =
      normalize(
        statement
      );

    const negativeWords = [
      "نفى",
      "ينفي",
      "نفي",
      "غير صحيح",
      "كاذب",
      "خطا",
      "خطأ",
      "ليس",
      "ليست",
      "لم يحدث",
      "لا صحة"
    ];

    let score =
      textSimilarity(
        claim,
        statement
      ) * 100;

    for (
      const word of
        negativeWords
    ) {
      if (
        normalized.includes(
          normalize(word)
        )
      ) {
        score += 20;
      }
    }

    return clamp(
      score
    );
  }

  /* =========================================================
     Ranking
  ========================================================= */

  function rankSources(
    sources
  ) {
    return sources
      .sort(
        (
          a,
          b
        ) =>
          b.sourceScore -
          a.sourceScore
      );
  }

  function rankEvidence(
    evidence
  ) {
    return evidence
      .sort(
        (
          a,
          b
        ) =>
          b.evidenceScore -
          a.evidenceScore
      );
  }

  function deduplicateSources(
    sources
  ) {
    const map =
      new Map();

    for (
      const source of
        sources
    ) {
      const key =
        source.url ||
        source.domain ||
        source.sourceName;

      if (
        !map.has(key)
      ) {
        map.set(
          key,
          source
        );
      }
    }

    return [
      ...map.values()
    ];
  }

  function deduplicateEvidence(
    evidence
  ) {
    const map =
      new Map();

    for (
      const item of
        evidence
    ) {
      const key =
        hash(
          [
            item.sourceId,
            item.title,
            item.excerpt
          ].join("|")
        );

      if (
        !map.has(key)
      ) {
        map.set(
          key,
          item
        );
      }
    }

    return [
      ...map.values()
    ];
  }

  /* =========================================================
     Conflict Detection
  ========================================================= */

  function detectConflicts(
    evidence
  ) {
    const conflicts =
      [];

    for (
      let i = 0;
      i < evidence.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < evidence.length;
        j++
      ) {
        const first =
          evidence[i];

        const second =
          evidence[j];

        if (
          first.sourceId ===
          second.sourceId
        ) {
          continue;
        }

        if (
          first.contradicts !==
          second.contradicts
        ) {
          const similarity =
            textSimilarity(
              first.excerpt,
              second.excerpt
            );

          if (
            similarity >=
            0.20
          ) {
            conflicts.push({
              id:
                createId(
                  "conflict"
                ),

              sourceA:
                first.sourceId,

              sourceB:
                second.sourceId,

              description:
                "Potentially conflicting evidence detected.",

              severity:
                clamp(
                  similarity * 100
                ),

              metadata: {
                firstEvidence:
                  first.id,

                secondEvidence:
                  second.id
              }
            });
          }
        }
      }
    }

    return conflicts;
  }

  /* =========================================================
     Confidence
  ========================================================= */

  function calculateConfidence(
    run
  ) {
    if (
      !run.evidence.length
    ) {
      return 0;
    }

    const evidenceAverage =
      run.evidence.reduce(
        (
          total,
          item
        ) =>
          total +
          item.evidenceScore,
        0
      ) /
      run.evidence.length;

    const officialCount =
      run.sources.filter(
        source =>
          source.official
      ).length;

    const primaryCount =
      run.sources.filter(
        source =>
          source.primarySource
      ).length;

    const conflictPenalty =
      run.conflicts.reduce(
        (
          total,
          conflict
        ) =>
          total +
          conflict.severity *
            0.20,
        0
      );

    return clamp(
      evidenceAverage *
        0.65 +

        Math.min(
          20,
          officialCount *
            10
        ) +

        Math.min(
          15,
          primaryCount *
            7.5
        ) -

        conflictPenalty
    );
  }

  /* =========================================================
     Integration with CODE 68
  ========================================================= */

  async function verifyAndEnrich(
    input = {}
  ) {
    const result =
      await discoverEvidence(
        input
      );

    let verification =
      null;

    if (
      newsVerificationEngine &&
      typeof newsVerificationEngine.verifyNews ===
        "function"
    ) {
      const sources =
        result.sources.map(
          source => ({
            sourceId:
              source.id,

            sourceName:
              source.sourceName,

            sourceUrl:
              source.url,

            official:
              source.official,

            verified:
              source.verified,

            trustScore:
              source.sourceScore,

            statement:
              source.statement
          })
        );

      verification =
        await newsVerificationEngine.verifyNews(
          {
            title:
              input.title ||
              input.claim,

            description:
              input.description,

            content:
              input.content ||
              input.claim,

            storyHash:
              input.storyHash,

            claims:
              [
                {
                  text:
                    input.claim,

                  type:
                    "external_verification_target"
                }
              ],

            sources
          }
        );
    }

    return {
      discovery:
        result,

      verification:
        verification
          ? {
              status:
                verification.verificationStatus,

              verificationScore:
                verification.verificationScore,

              evidenceScore:
                verification.evidenceScore,

              confidenceScore:
                verification.confidenceScore,

              humanReviewRequired:
                verification.humanReviewRequired,

              autoPublishEligible:
                verification.autoPublishEligible,

              decision:
                verification.decision
            }
          : null
    };
  }

  /* =========================================================
     Persistence
  ========================================================= */

  async function persistRun(
    run
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
      INSERT INTO ez_external_verification_runs (
        id,
        claim_hash,
        story_hash,
        query,
        status,
        source_count,
        evidence_count,
        official_source_count,
        confidence_score,
        metadata,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status =
          EXCLUDED.status,

        source_count =
          EXCLUDED.source_count,

        evidence_count =
          EXCLUDED.evidence_count,

        official_source_count =
          EXCLUDED.official_source_count,

        confidence_score =
          EXCLUDED.confidence_score,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          NOW()
      `,
      [
        run.id,

        run.claimHash,

        run.storyHash,

        JSON.stringify(
          run.queries
        ),

        run.status,

        run.sources.length,

        run.evidence.length,

        run.sources.filter(
          source =>
            source.official
        ).length,

        run.confidenceScore,

        JSON.stringify({
          conflicts:
            run.conflicts.length
        })
      ]
    );

    for (
      const source of
        run.sources
    ) {
      await persistence.query(
        `
        INSERT INTO ez_external_verification_sources (
          id,
          run_id,
          source_name,
          source_url,
          domain,
          source_type,
          official,
          primary_source,
          verified,
          source_score,
          relevance_score,
          reliability_score,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12,$13
        )
        ON CONFLICT(id)
        DO NOTHING
        `,
        [
          source.id,
          run.id,
          source.sourceName,
          source.url,
          source.domain,
          source.sourceType,
          source.official,
          source.primarySource,
          source.verified,
          source.sourceScore,
          source.relevanceScore,
          source.reliabilityScore,
          JSON.stringify(
            source.metadata ||
              {}
          )
        ]
      );
    }

    for (
      const evidence of
        run.evidence
    ) {
      await persistence.query(
        `
        INSERT INTO ez_external_verification_evidence (
          id,
          run_id,
          claim_hash,
          source_id,
          evidence_type,
          title,
          url,
          excerpt,
          support_level,
          relevance_score,
          reliability_score,
          evidence_score,
          official,
          primary_source,
          contradicts,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,$16
        )
        ON CONFLICT(id)
        DO NOTHING
        `,
        [
          evidence.id,
          run.id,
          evidence.claimHash,
          evidence.sourceId,
          evidence.evidenceType,
          evidence.title,
          evidence.url,
          evidence.excerpt,
          evidence.supportLevel,
          evidence.relevanceScore,
          evidence.reliabilityScore,
          evidence.evidenceScore,
          evidence.official,
          evidence.primarySource,
          evidence.contradicts,
          JSON.stringify(
            evidence.metadata ||
              {}
          )
        ]
      );
    }

    for (
      const conflict of
        run.conflicts
    ) {
      await persistence.query(
        `
        INSERT INTO ez_external_verification_conflicts (
          id,
          run_id,
          claim_hash,
          source_a,
          source_b,
          description,
          severity,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8
        )
        ON CONFLICT(id)
        DO NOTHING
        `,
        [
          conflict.id,
          run.id,
          run.claimHash,
          conflict.sourceA,
          conflict.sourceB,
          conflict.description,
          conflict.severity,
          JSON.stringify(
            conflict.metadata ||
              {}
          )
        ]
      );
    }
  }

  /* =========================================================
     Search Provider Timeout
  ========================================================= */

  async function runWithTimeout(
    promise,
    timeout
  ) {
    let timer;

    try {
      return await Promise.race([
        promise,

        new Promise(
          (
            _resolve,
            reject
          ) => {
            timer =
              setTimeout(
                () =>
                  reject(
                    new Error(
                      "External verification provider timeout"
                    )
                  ),
                timeout
              );
          }
        )
      ]);
    } finally {
      if (timer) {
        clearTimeout(
          timer
        );
      }
    }
  }

  /* =========================================================
     Public API
  ========================================================= */

  function getRun(
    runId
  ) {
    return clone(
      state.searches.get(
        runId
      ) || null
    );
  }

  function getStatistics() {
    return {
      ...state.statistics,

      activeRuns:
        state.searches.size,

      storedEvidence:
        state.evidence.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA External Verification & Evidence Discovery",

      code:
        "69",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      configuration: {
        maxSourcesPerQuery,

        maxEvidencePerClaim,

        timeoutMs,

        minimumSourceScore,

        minimumEvidenceScore
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

        sourceIntelligence:
          Boolean(
            sourceIntelligence
          ),

        newsVerificationEngine:
          Boolean(
            newsVerificationEngine
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
      "external-verification.started",
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
      "external-verification.stopped",
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

    discoverEvidence,

    verifyAndEnrich,

    buildQueries,

    getRun,

    getStatistics,

    getStatus,

    health,

    on
  };
}

module.exports = {
  createExternalVerificationEngine
};
