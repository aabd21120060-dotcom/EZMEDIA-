/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 68
 * NEWS VERIFICATION & FACT-CHECK ENGINE
 * ============================================================
 *
 * المسار:
 *
 * SOURCE
 *   ↓
 * INGESTION
 *   ↓
 * SOURCE INTELLIGENCE
 *   ↓
 * NEWS VERIFICATION
 *   ↓
 * BREAKING NEWS ENGINE
 *   ↓
 * AI ORCHESTRATOR
 *   ↓
 * PUBLISH / HUMAN REVIEW
 *
 * الوظائف:
 *
 * - استخراج الادعاءات
 * - مقارنة المصادر
 * - التحقق من الأدلة
 * - كشف التعارض
 * - كشف الادعاءات غير المدعومة
 * - حساب Verification Score
 * - حساب Evidence Score
 * - حساب Fact Confidence
 * - تحديد Human Review
 * - حفظ سجل التحقق
 * - إعادة التحقق
 * - تسجيل القرارات
 *
 * ملاحظة مهمة:
 * هذا النظام لا يعتبر الخبر "حقيقة" لمجرد أن الذكاء الاصطناعي قال ذلك.
 *
 * AI = مساعد للتحليل
 * Evidence = الدليل
 * Official Source = مصدر رسمي عند توفره
 * Human Review = طبقة أمان نهائية للحالات الحساسة
 */

"use strict";

const crypto = require("crypto");
const EventEmitter = require("events");

function createNewsVerificationEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    sourceIntelligence = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    minimumEvidenceScore =
      Number(
        process.env.NEWS_VERIFICATION_MIN_EVIDENCE_SCORE ||
          70
      ),

    minimumVerificationScore =
      Number(
        process.env.NEWS_VERIFICATION_MIN_SCORE ||
          80
      ),

    minimumAutoPublishScore =
      Number(
        process.env.NEWS_VERIFICATION_AUTO_PUBLISH_SCORE ||
          88
      ),

    humanReviewScore =
      Number(
        process.env.NEWS_VERIFICATION_HUMAN_REVIEW_SCORE ||
          70
      ),

    conflictThreshold =
      Number(
        process.env.NEWS_VERIFICATION_CONFLICT_THRESHOLD ||
          25
      ),

    maxClaims =
      Number(
        process.env.NEWS_VERIFICATION_MAX_CLAIMS ||
          30
      )
  } = options;

  const emitter =
    new EventEmitter();

  const state = {
    initialized: false,

    running: false,

    analyses:
      new Map(),

    claims:
      new Map(),

    statistics: {
      totalVerifications: 0,

      verified: 0,

      partiallyVerified: 0,

      unverified: 0,

      disputed: 0,

      rejected: 0,

      humanReviews: 0,

      autoPublishEligible: 0,

      claimsAnalyzed: 0,

      claimsSupported: 0,

      claimsUnsupported: 0,

      claimsDisputed: 0,

      totalVerificationScore: 0,

      averageVerificationScore: 0,

      totalEvidenceScore: 0,

      averageEvidenceScore: 0
    }
  };

  /* =========================================================
     أدوات أساسية
  ========================================================= */

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

  function normalize(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
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
      .update(normalize(value))
      .digest("hex");
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    const n =
      Number(value);

    if (
      !Number.isFinite(n)
    ) {
      return min;
    }

    return Math.min(
      max,
      Math.max(min, n)
    );
  }

  function average(values) {
    if (
      !values ||
      !values.length
    ) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) =>
          sum +
          Number(
            value || 0
          ),
        0
      ) /
      values.length
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
        "[VERIFICATION] Event error:",
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
      CREATE TABLE IF NOT EXISTS ez_news_verifications (
        id TEXT PRIMARY KEY,

        story_hash TEXT UNIQUE NOT NULL,

        title TEXT,

        verification_status TEXT,

        verification_score NUMERIC DEFAULT 0,

        evidence_score NUMERIC DEFAULT 0,

        confidence_score NUMERIC DEFAULT 0,

        source_score NUMERIC DEFAULT 0,

        official_score NUMERIC DEFAULT 0,

        conflict_score NUMERIC DEFAULT 0,

        claims_count INTEGER DEFAULT 0,

        supported_claims INTEGER DEFAULT 0,

        unsupported_claims INTEGER DEFAULT 0,

        disputed_claims INTEGER DEFAULT 0,

        human_review_required BOOLEAN DEFAULT FALSE,

        auto_publish_eligible BOOLEAN DEFAULT FALSE,

        decision TEXT,

        claims JSONB,

        evidence JSONB,

        conflicts JSONB,

        sources JSONB,

        ai_analysis JSONB,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW(),

        verified_at TIMESTAMPTZ
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_news_claims (
        id TEXT PRIMARY KEY,

        story_hash TEXT NOT NULL,

        claim_text TEXT NOT NULL,

        claim_hash TEXT,

        claim_type TEXT,

        status TEXT DEFAULT 'unverified',

        confidence_score NUMERIC DEFAULT 0,

        evidence_score NUMERIC DEFAULT 0,

        source_count INTEGER DEFAULT 0,

        supporting_sources JSONB,

        contradicting_sources JSONB,

        evidence JSONB,

        ai_analysis JSONB,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_news_verification_evidence (
        id TEXT PRIMARY KEY,

        story_hash TEXT NOT NULL,

        claim_id TEXT,

        evidence_type TEXT,

        source_name TEXT,

        source_url TEXT,

        source_id TEXT,

        official BOOLEAN DEFAULT FALSE,

        verified BOOLEAN DEFAULT FALSE,

        relevance_score NUMERIC DEFAULT 0,

        reliability_score NUMERIC DEFAULT 0,

        support_score NUMERIC DEFAULT 0,

        content TEXT,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_news_verification_conflicts (
        id TEXT PRIMARY KEY,

        story_hash TEXT NOT NULL,

        claim_id TEXT,

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
      idx_ez_news_verifications_story
      ON ez_news_verifications(story_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_news_claims_story
      ON ez_news_claims(story_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_news_evidence_story
      ON ez_news_verification_evidence(story_hash)
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
      "news-verification.initialized",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* =========================================================
     استخراج الادعاءات
  ========================================================= */

  async function extractClaims(
    input = {}
  ) {
    const title =
      clean(input.title);

    const description =
      clean(input.description);

    const content =
      clean(input.content);

    const suppliedClaims =
      Array.isArray(
        input.claims
      )
        ? input.claims
        : [];

    if (
      suppliedClaims.length
    ) {
      return normalizeClaims(
        suppliedClaims
      ).slice(
        0,
        maxClaims
      );
    }

    /*
     * محاولة استخدام AI.
     */

    let aiClaims = [];

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        const result =
          await aiOrchestrator.process(
            "extract-claims",
            {
              title,
              description,
              content
            }
          );

        aiClaims =
          extractClaimsFromAI(
            result
          );
      } catch (error) {
        logger.warn(
          "[VERIFICATION] AI claim extraction failed:",
          error.message
        );
      }
    }

    if (
      !aiClaims.length &&
      aiCore &&
      typeof aiCore.extractEntities ===
        "function"
    ) {
      /*
       * لا نعتبر entities ادعاءات.
       * لذلك نستخدمها فقط كمعلومات مساعدة.
       */
      aiClaims = [];
    }

    if (
      aiClaims.length
    ) {
      return normalizeClaims(
        aiClaims
      ).slice(
        0,
        maxClaims
      );
    }

    /*
     * Fallback محافظ.
     *
     * نأخذ الجمل التي تحتوي على
     * مؤشرات ادعاء.
     */

    const combined =
      [
        title,
        description,
        content
      ]
        .filter(Boolean)
        .join(". ");

    const sentences =
      combined
        .split(
          /[.!؟؛\n]+/
        )
        .map(
          clean
        )
        .filter(
          Boolean
        );

    const claimIndicators = [
      "أعلنت",
      "اعلن",
      "قال",
      "صرح",
      "أكد",
      "اكد",
      "أعلنت",
      "وقع",
      "وافق",
      "بدأ",
      "بدأت",
      "حدث",
      "ارتفع",
      "انخفض",
      "توفي",
      "قتل",
      "فاز",
      "أعلنت وزارة",
      "أعلنت الهيئة",
      "بحسب"
    ];

    return sentences
      .filter(
        sentence =>
          claimIndicators.some(
            indicator =>
              sentence.includes(
                indicator
              )
          )
      )
      .slice(
        0,
        maxClaims
      )
      .map(
        sentence => ({
          text:
            sentence,

          type:
            "statement"
        })
      );
  }

  function extractClaimsFromAI(
    result
  ) {
    if (
      !result
    ) {
      return [];
    }

    const candidates = [
      result.claims,
      result.data?.claims,
      result.result?.claims,
      result.output?.claims
    ];

    for (
      const candidate of
        candidates
    ) {
      if (
        Array.isArray(
          candidate
        )
      ) {
        return candidate;
      }
    }

    return [];
  }

  function normalizeClaims(
    claims
  ) {
    return claims
      .map(
        claim => {
          if (
            typeof claim ===
            "string"
          ) {
            return {
              text:
                clean(
                  claim
                ),

              type:
                "statement"
            };
          }

          return {
            text:
              clean(
                claim.text ||
                  claim.claim ||
                  claim.statement
              ),

            type:
              clean(
                claim.type ||
                  "statement"
              ),

            importance:
              clamp(
                claim.importance ||
                  50
              ),

            metadata:
              claim.metadata ||
              {}
          };
        }
      )
      .filter(
        claim =>
          claim.text
      );
  }

  /* =========================================================
     تحليل الخبر بالكامل
  ========================================================= */

  async function verifyNews(
    input = {}
  ) {
    const title =
      clean(input.title);

    if (!title) {
      throw new Error(
        "title is required"
      );
    }

    const storyHash =
      input.storyHash ||
      hash(
        [
          title,
          clean(
            input.description
          ),
          clean(
            input.content
          )
        ].join("|")
      );

    emit(
      "news-verification.started",
      {
        storyHash
      }
    );

    const claims =
      await extractClaims(
        input
      );

    const sources =
      normalizeSources(
        input.sources ||
          []
      );

    const sourceScore =
      calculateSourceScore(
        sources
      );

    const officialScore =
      calculateOfficialScore(
        sources
      );

    const claimResults = [];

    for (
      const claim of
        claims
    ) {
      const result =
        await verifyClaim({
          storyHash,
          claim,
          sources,
          input
        });

      claimResults.push(
        result
      );
    }

    const supported =
      claimResults.filter(
        item =>
          item.status ===
          "supported"
      );

    const unsupported =
      claimResults.filter(
        item =>
          item.status ===
          "unsupported"
      );

    const disputed =
      claimResults.filter(
        item =>
          item.status ===
          "disputed"
      );

    const evidenceScore =
      calculateEvidenceScore(
        claimResults
      );

    const conflictScore =
      calculateConflictScore(
        claimResults
      );

    const verificationScore =
      calculateVerificationScore({
        evidenceScore,
        sourceScore,
        officialScore,
        conflictScore,
        claimsCount:
          claimResults.length,
        supportedCount:
          supported.length
      });

    const confidenceScore =
      calculateConfidenceScore({
        verificationScore,
        evidenceScore,
        sourceScore,
        officialScore,
        conflictScore
      });

    const decision =
      decideVerification({
        verificationScore,
        confidenceScore,
        evidenceScore,
        conflictScore,
        claimsCount:
          claimResults.length,
        unsupportedCount:
          unsupported.length,
        disputedCount:
          disputed.length
      });

    const analysis = {
      id:
        id(
          "verification"
        ),

      storyHash,

      title,

      verificationStatus:
        decision.status,

      verificationScore,

      evidenceScore,

      confidenceScore,

      sourceScore,

      officialScore,

      conflictScore,

      claimsCount:
        claimResults.length,

      supportedClaims:
        supported.length,

      unsupportedClaims:
        unsupported.length,

      disputedClaims:
        disputed.length,

      humanReviewRequired:
        decision.humanReviewRequired,

      autoPublishEligible:
        decision.autoPublishEligible,

      decision:
        decision.decision,

      claims:
        claimResults,

      evidence:
        collectEvidence(
          claimResults
        ),

      conflicts:
        collectConflicts(
          claimResults
        ),

      sources,

      aiAnalysis:
        null,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    /*
     * تحليل AI النهائي اختياري.
     */

    analysis.aiAnalysis =
      await runAIReview(
        input,
        analysis
      );

    state.analyses.set(
      storyHash,
      analysis
    );

    state.statistics.totalVerifications +=
      1;

    state.statistics.totalVerificationScore +=
      verificationScore;

    state.statistics.averageVerificationScore =
      state.statistics.totalVerificationScore /
      state.statistics.totalVerifications;

    state.statistics.totalEvidenceScore +=
      evidenceScore;

    state.statistics.averageEvidenceScore =
      state.statistics.totalEvidenceScore /
      state.statistics.totalVerifications;

    state.statistics.claimsAnalyzed +=
      claimResults.length;

    state.statistics.claimsSupported +=
      supported.length;

    state.statistics.claimsUnsupported +=
      unsupported.length;

    state.statistics.claimsDisputed +=
      disputed.length;

    if (
      decision.status ===
      "verified"
    ) {
      state.statistics.verified +=
        1;
    }

    if (
      decision.status ===
      "partially_verified"
    ) {
      state.statistics.partiallyVerified +=
        1;
    }

    if (
      decision.status ===
      "unverified"
    ) {
      state.statistics.unverified +=
        1;
    }

    if (
      decision.status ===
      "disputed"
    ) {
      state.statistics.disputed +=
        1;
    }

    if (
      decision.status ===
      "rejected"
    ) {
      state.statistics.rejected +=
        1;
    }

    if (
      decision.humanReviewRequired
    ) {
      state.statistics.humanReviews +=
        1;
    }

    if (
      decision.autoPublishEligible
    ) {
      state.statistics.autoPublishEligible +=
        1;
    }

    await persistVerification(
      analysis
    );

    emit(
      "news-verification.completed",
      {
        analysis:
          clone(analysis)
      }
    );

    return clone(
      analysis
    );
  }

  /* =========================================================
     Verify Claim
  ========================================================= */

  async function verifyClaim(
    input
  ) {
    const claimText =
      clean(
        input.claim.text
      );

    const claimHash =
      hash(
        claimText
      );

    const supporting =
      [];

    const contradicting =
      [];

    const evidence =
      [];

    /*
     * مقارنة الادعاء مع المصادر
     */

    for (
      const source of
        input.sources
    ) {
      const statement =
        clean(
          source.statement
        );

      if (!statement) {
        continue;
      }

      const similarity =
        semanticSimilarity(
          claimText,
          statement
        );

      const support =
        detectSupport(
          claimText,
          statement
        );

      const contradiction =
        detectContradiction(
          claimText,
          statement
        );

      const relevance =
        clamp(
          similarity *
            100
        );

      const reliability =
        clamp(
          Number(
            source.trustScore ??
              source.reliabilityScore ??
              50
          )
        );

      if (
        support
      ) {
        supporting.push(
          source
        );

        evidence.push({
          id:
            id(
              "evidence"
            ),

          evidenceType:
            "source_support",

          sourceName:
            source.sourceName,

          sourceId:
            source.sourceId,

          sourceUrl:
            source.url,

          official:
            Boolean(
              source.official
            ),

          verified:
            Boolean(
              source.verified
            ),

          relevanceScore:
            relevance,

          reliabilityScore:
            reliability,

          supportScore:
            clamp(
              relevance *
                0.50 +
                reliability *
                0.50
            ),

          content:
            statement
        });
      }

      if (
        contradiction
      ) {
        contradicting.push(
          source
        );

        evidence.push({
          id:
            id(
              "evidence"
            ),

          evidenceType:
            "source_contradiction",

          sourceName:
            source.sourceName,

          sourceId:
            source.sourceId,

          sourceUrl:
            source.url,

          official:
            Boolean(
              source.official
            ),

          verified:
            Boolean(
              source.verified
            ),

          relevanceScore:
            relevance,

          reliabilityScore:
            reliability,

          supportScore:
            0,

          content:
            statement
        });
      }
    }

    const evidenceScore =
      calculateClaimEvidenceScore({
        supporting,
        contradicting,
        evidence
      });

    let status =
      "unverified";

    if (
      contradicting.length &&
      supporting.length
    ) {
      status =
        "disputed";
    } else if (
      supporting.length &&
      evidenceScore >= 70
    ) {
      status =
        "supported";
    } else if (
      supporting.length
    ) {
      status =
        "partially_supported";
    }

    const result = {
      id:
        id(
          "claim"
        ),

      storyHash:
        input.storyHash,

      claimText,

      claimHash,

      claimType:
        input.claim.type ||
        "statement",

      status,

      confidenceScore:
        calculateClaimConfidence({
          evidenceScore,
          supportingCount:
            supporting.length,
          contradictingCount:
            contradicting.length
        }),

      evidenceScore,

      sourceCount:
        input.sources.length,

      supportingSources:
        supporting.map(
          source =>
            source.sourceName
        ),

      contradictingSources:
        contradicting.map(
          source =>
            source.sourceName
        ),

      evidence,

      aiAnalysis:
        null,

      metadata:
        input.claim.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.claims.set(
      claimHash,
      result
    );

    await persistClaim(
      result
    );

    for (
      const item of
        evidence
    ) {
      await persistEvidence(
        input.storyHash,
        result.id,
        item
      );
    }

    return result;
  }

  /* =========================================================
     Support / Contradiction
  ========================================================= */

  function detectSupport(
    claim,
    statement
  ) {
    const similarity =
      semanticSimilarity(
        claim,
        statement
      );

    if (
      similarity >=
      0.35
    ) {
      return true;
    }

    const claimWords =
      new Set(
        normalize(
          claim
        )
          .split(" ")
          .filter(Boolean)
      );

    const statementWords =
      new Set(
        normalize(
          statement
        )
          .split(" ")
          .filter(Boolean)
      );

    let matches = 0;

    for (
      const word of
        claimWords
    ) {
      if (
        statementWords.has(
          word
        )
      ) {
        matches++;
      }
    }

    return (
      matches >=
      Math.max(
        2,
        Math.ceil(
          claimWords.size *
            0.35
        )
      )
    );
  }

  function detectContradiction(
    claim,
    statement
  ) {
    const claimWords =
      normalize(
        claim
      ).split(" ");

    const statementNormalized =
      normalize(
        statement
      );

    const negations = [
      "ليس",
      "ليست",
      "لم",
      "لن",
      "لا",
      "ينفي",
      "نفي",
      "نفى",
      "غير صحيح",
      "كاذب",
      "خطا",
      "خطأ"
    ];

    const hasNegation =
      negations.some(
        word =>
          statementNormalized.includes(
            word
          )
      );

    if (
      !hasNegation
    ) {
      return false;
    }

    const overlap =
      claimWords.filter(
        word =>
          word &&
          statementNormalized.includes(
            word
          )
      ).length;

    return (
      overlap >=
      Math.max(
        2,
        Math.ceil(
          claimWords.length *
            0.30
        )
      )
    );
  }

  /* =========================================================
     Similarity
  ========================================================= */

  function semanticSimilarity(
    a,
    b
  ) {
    const first =
      new Set(
        normalize(a)
          .split(" ")
          .filter(Boolean)
      );

    const second =
      new Set(
        normalize(b)
          .split(" ")
          .filter(Boolean)
      );

    if (
      !first.size ||
      !second.size
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
     Scores
  ========================================================= */

  function calculateClaimEvidenceScore(
    input
  ) {
    const supportScore =
      average(
        input.evidence
          .filter(
            item =>
              item.evidenceType ===
              "source_support"
          )
          .map(
            item =>
              item.supportScore
          )
      );

    const officialCount =
      input.supporting.filter(
        source =>
          source.official
      ).length;

    const verifiedCount =
      input.supporting.filter(
        source =>
          source.verified
      ).length;

    let score =
      supportScore * 0.60;

    score +=
      Math.min(
        25,
        officialCount * 15
      );

    score +=
      Math.min(
        15,
        verifiedCount * 5
      );

    if (
      input.contradicting.length
    ) {
      score -=
        Math.min(
          50,
          input.contradicting.length *
            20
        );
    }

    return clamp(
      score
    );
  }

  function calculateClaimConfidence(
    input
  ) {
    return clamp(
      input.evidenceScore *
        0.70 +

        Math.min(
          20,
          input.supportingCount *
            8
        ) +

        Math.max(
          0,
          10 -
            input.contradictingCount *
              10
        )
    );
  }

  function calculateSourceScore(
    sources
  ) {
    if (
      !sources.length
    ) {
      return 0;
    }

    return clamp(
      average(
        sources.map(
          source =>
            Number(
              source.trustScore ??
                source.reliabilityScore ??
                50
            )
        )
      )
    );
  }

  function calculateOfficialScore(
    sources
  ) {
    if (
      !sources.length
    ) {
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

  function calculateEvidenceScore(
    claims
  ) {
    if (
      !claims.length
    ) {
      return 0;
    }

    return clamp(
      average(
        claims.map(
          claim =>
            claim.evidenceScore
        )
      )
    );
  }

  function calculateConflictScore(
    claims
  ) {
    const disputed =
      claims.filter(
        claim =>
          claim.status ===
          "disputed"
      );

    if (
      !claims.length
    ) {
      return 0;
    }

    return clamp(
      (
        disputed.length /
        claims.length
      ) *
        100
    );
  }

  function calculateVerificationScore(
    input
  ) {
    let score =
      input.evidenceScore *
      0.35;

    score +=
      input.sourceScore *
      0.20;

    score +=
      input.officialScore *
      0.15;

    if (
      input.claimsCount
    ) {
      score +=
        (
          input.supportedCount /
          input.claimsCount
        ) *
        30;
    }

    score -=
      input.conflictScore *
      0.20;

    return clamp(
      score
    );
  }

  function calculateConfidenceScore(
    input
  ) {
    return clamp(
      input.verificationScore *
        0.45 +

        input.evidenceScore *
        0.25 +

        input.sourceScore *
        0.15 +

        input.officialScore *
        0.15 -

        input.conflictScore *
        0.20
    );
  }

  /* =========================================================
     Verification Decision
  ========================================================= */

  function decideVerification(
    input
  ) {
    if (
      input.disputedCount >
      0 &&
      input.conflictScore >=
        conflictThreshold
    ) {
      return {
        status:
          "disputed",

        decision:
          "hold_for_conflict_review",

        humanReviewRequired:
          true,

        autoPublishEligible:
          false
      };
    }

    if (
      input.unsupportedCount >
        0 &&
      input.verificationScore <
        humanReviewScore
    ) {
      return {
        status:
          "unverified",

        decision:
          "do_not_publish",

        humanReviewRequired:
          true,

        autoPublishEligible:
          false
      };
    }

    if (
      input.verificationScore >=
        minimumAutoPublishScore &&
      input.evidenceScore >=
        minimumEvidenceScore &&
      input.confidenceScore >=
        minimumVerificationScore &&
      input.unsupportedCount ===
        0 &&
      input.disputedCount ===
        0
    ) {
      return {
        status:
          "verified",

        decision:
          "verified_auto_publish_eligible",

        humanReviewRequired:
          false,

        autoPublishEligible:
          true
      };
    }

    if (
      input.verificationScore >=
        minimumVerificationScore &&
      input.evidenceScore >=
        minimumEvidenceScore
    ) {
      return {
        status:
          "partially_verified",

        decision:
          "verified_with_review",

        humanReviewRequired:
          true,

        autoPublishEligible:
          false
      };
    }

    return {
      status:
        "unverified",

      decision:
        "manual_verification_required",

      humanReviewRequired:
        true,

      autoPublishEligible:
        false
    };
  }

  /* =========================================================
     Sources
  ========================================================= */

  function normalizeSources(
    sources
  ) {
    return sources
      .map(
        source => ({
          sourceId:
            source.sourceId ||
            source.id ||
            hash(
              source.sourceName ||
                source.name ||
                "unknown"
            ),

          sourceName:
            clean(
              source.sourceName ||
                source.name ||
                source.source ||
                "Unknown"
            ),

          sourceType:
            clean(
              source.sourceType ||
                source.type ||
                "unknown"
            ),

          trustScore:
            clamp(
              source.trustScore ??
                source.reliabilityScore ??
                50
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
            clean(
              source.url ||
                source.sourceUrl
            ),

          statement:
            clean(
              source.statement ||
                source.description ||
                source.content
            ),

          metadata:
            source.metadata ||
            {}
        })
      );
  }

  /* =========================================================
     AI Review
  ========================================================= */

  async function runAIReview(
    input,
    analysis
  ) {
    if (
      aiCore &&
      typeof aiCore.factCheck ===
        "function"
    ) {
      try {
        return await aiCore.factCheck({
          title:
            input.title,

          description:
            input.description,

          content:
            input.content,

          claims:
            analysis.claims,

          sources:
            analysis.sources,

          verificationScore:
            analysis.verificationScore,

          evidenceScore:
            analysis.evidenceScore,

          conflictScore:
            analysis.conflictScore
        });
      } catch (error) {
        logger.warn(
          "[VERIFICATION] AI fact-check unavailable:",
          error.message
        );
      }
    }

    return null;
  }

  /* =========================================================
     Evidence / Conflict Collectors
  ========================================================= */

  function collectEvidence(
    claims
  ) {
    return claims.flatMap(
      claim =>
        claim.evidence ||
        []
    );
  }

  function collectConflicts(
    claims
  ) {
    return claims
      .filter(
        claim =>
          claim.status ===
          "disputed"
      )
      .map(
        claim => ({
          claimId:
            claim.id,

          claim:
            claim.claimText,

          supportingSources:
            claim.supportingSources,

          contradictingSources:
            claim.contradictingSources,

          severity:
            70,

          type:
            "claim_dispute"
        })
      );
  }

  /* =========================================================
     Persistence
  ========================================================= */

  async function persistVerification(
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
      INSERT INTO ez_news_verifications (
        id,
        story_hash,
        title,
        verification_status,
        verification_score,
        evidence_score,
        confidence_score,
        source_score,
        official_score,
        conflict_score,
        claims_count,
        supported_claims,
        unsupported_claims,
        disputed_claims,
        human_review_required,
        auto_publish_eligible,
        decision,
        claims,
        evidence,
        conflicts,
        sources,
        ai_analysis,
        metadata,
        updated_at,
        verified_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,
        $23,$24,NOW(),NOW()
      )
      ON CONFLICT(story_hash)
      DO UPDATE SET
        verification_status =
          EXCLUDED.verification_status,

        verification_score =
          EXCLUDED.verification_score,

        evidence_score =
          EXCLUDED.evidence_score,

        confidence_score =
          EXCLUDED.confidence_score,

        source_score =
          EXCLUDED.source_score,

        official_score =
          EXCLUDED.official_score,

        conflict_score =
          EXCLUDED.conflict_score,

        claims_count =
          EXCLUDED.claims_count,

        supported_claims =
          EXCLUDED.supported_claims,

        unsupported_claims =
          EXCLUDED.unsupported_claims,

        disputed_claims =
          EXCLUDED.disputed_claims,

        human_review_required =
          EXCLUDED.human_review_required,

        auto_publish_eligible =
          EXCLUDED.auto_publish_eligible,

        decision =
          EXCLUDED.decision,

        claims =
          EXCLUDED.claims,

        evidence =
          EXCLUDED.evidence,

        conflicts =
          EXCLUDED.conflicts,

        sources =
          EXCLUDED.sources,

        ai_analysis =
          EXCLUDED.ai_analysis,

        metadata =
          EXCLUDED.metadata,

        updated_at =
          NOW(),

        verified_at =
          NOW()
      `,
      [
        analysis.id,
        analysis.storyHash,
        analysis.title,
        analysis.verificationStatus,
        analysis.verificationScore,
        analysis.evidenceScore,
        analysis.confidenceScore,
        analysis.sourceScore,
        analysis.officialScore,
        analysis.conflictScore,
        analysis.claimsCount,
        analysis.supportedClaims,
        analysis.unsupportedClaims,
        analysis.disputedClaims,
        analysis.humanReviewRequired,
        analysis.autoPublishEligible,
        analysis.decision,
        JSON.stringify(
          analysis.claims
        ),
        JSON.stringify(
          analysis.evidence
        ),
        JSON.stringify(
          analysis.conflicts
        ),
        JSON.stringify(
          analysis.sources
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

  async function persistClaim(
    claim
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
      INSERT INTO ez_news_claims (
        id,
        story_hash,
        claim_text,
        claim_hash,
        claim_type,
        status,
        confidence_score,
        evidence_score,
        source_count,
        supporting_sources,
        contradicting_sources,
        evidence,
        ai_analysis,
        metadata,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,NOW()
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status =
          EXCLUDED.status,

        confidence_score =
          EXCLUDED.confidence_score,

        evidence_score =
          EXCLUDED.evidence_score,

        updated_at =
          NOW()
      `,
      [
        claim.id,
        claim.storyHash,
        claim.claimText,
        claim.claimHash,
        claim.claimType,
        claim.status,
        claim.confidenceScore,
        claim.evidenceScore,
        claim.sourceCount,
        JSON.stringify(
          claim.supportingSources
        ),
        JSON.stringify(
          claim.contradictingSources
        ),
        JSON.stringify(
          claim.evidence
        ),
        JSON.stringify(
          claim.aiAnalysis
        ),
        JSON.stringify(
          claim.metadata
        )
      ]
    );
  }

  async function persistEvidence(
    storyHash,
    claimId,
    evidence
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
      INSERT INTO ez_news_verification_evidence (
        id,
        story_hash,
        claim_id,
        evidence_type,
        source_name,
        source_url,
        source_id,
        official,
        verified,
        relevance_score,
        reliability_score,
        support_score,
        content,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14
      )
      `,
      [
        evidence.id,
        storyHash,
        claimId,
        evidence.evidenceType,
        evidence.sourceName,
        evidence.sourceUrl,
        evidence.sourceId,
        evidence.official,
        evidence.verified,
        evidence.relevanceScore,
        evidence.reliabilityScore,
        evidence.supportScore,
        evidence.content,
        JSON.stringify(
          evidence.metadata ||
            {}
        )
      ]
    );
  }

  /* =========================================================
     Query
  ========================================================= */

  function getVerification(
    storyHash
  ) {
    return clone(
      state.analyses.get(
        storyHash
      ) || null
    );
  }

  function getClaim(
    claimHash
  ) {
    return clone(
      state.claims.get(
        claimHash
      ) || null
    );
  }

  function getStatistics() {
    return {
      ...state.statistics,

      analysisCount:
        state.analyses.size,

      claimCount:
        state.claims.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA News Verification & Fact-Check Engine",

      code:
        "68",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      configuration: {
        minimumEvidenceScore,

        minimumVerificationScore,

        minimumAutoPublishScore,

        humanReviewScore,

        conflictThreshold,

        maxClaims
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
      "news-verification.started",
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
      "news-verification.stopped",
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

    verifyNews,
    extractClaims,
    verifyClaim,

    getVerification,
    getClaim,

    getStatistics,
    getStatus,
    health,

    on
  };
}

module.exports = {
  createNewsVerificationEngine
};
