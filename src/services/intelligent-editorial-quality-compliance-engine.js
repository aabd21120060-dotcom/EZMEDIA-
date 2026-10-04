"use strict";

const crypto = require("crypto");

function createIntelligentEditorialQualityComplianceEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    sourceIntelligence =
      null,

    verificationEngine =
      null,

    externalVerificationEngine =
      null,

    mediaForensicsEngine =
      null,

    mediaIntelligenceEngine =
      null,

    editorialEngine =
      null,

    publishingEngine =
      null,

    assignmentEngine =
      null,

    workforceEngine =
      null,

    trainingEngine =
      null,

    securityEngine =
      null,

    workflowEngine =
      null,

    automationEngine =
      null,

    notificationService =
      null,

    eventBus =
      null,

    logger = console,

    maxReviews =
      Number(
        process.env.QUALITY_MAX_REVIEWS ||
        500000
      ),

    maxPolicies =
      Number(
        process.env.QUALITY_MAX_POLICIES ||
        1000
      ),

    maxRules =
      Number(
        process.env.QUALITY_MAX_RULES ||
        10000
      ),

    maxViolations =
      Number(
        process.env.QUALITY_MAX_VIOLATIONS ||
        500000
      ),

    autoPublishScore =
      Number(
        process.env.QUALITY_AUTO_PUBLISH_SCORE ||
        90
      ),

    humanReviewScore =
      Number(
        process.env.QUALITY_HUMAN_REVIEW_SCORE ||
        70
      ),

    rejectScore =
      Number(
        process.env.QUALITY_REJECT_SCORE ||
        50
      ),

    criticalRiskThreshold =
      Number(
        process.env.QUALITY_CRITICAL_RISK_THRESHOLD ||
        80
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    reviews: new Map(),
    policies: new Map(),
    rules: new Map(),
    violations: new Map(),
    decisions: new Map(),
    audits: new Map(),
    alerts: new Map(),

    statistics: {
      reviewsCreated: 0,
      reviewsCompleted: 0,
      autoApproved: 0,
      humanReviews: 0,
      rejected: 0,
      held: 0,
      violationsDetected: 0,
      criticalViolations: 0,
      policyChecks: 0,
      aiAnalyses: 0
    }
  };

  function now() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    return (
      `${prefix}_${Date.now()}_` +
      crypto.randomBytes(8).toString("hex")
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

  async function query(sql, values = []) {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return null;
    }

    return persistence.query(
      sql,
      values
    );
  }

  function emit(event, payload = {}) {
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
        "[CODE93] Event error:",
        error.message
      );
    }
  }

  /*
   * ============================================================
   * DATABASE
   * ============================================================
   */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_quality_reviews (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        story_id TEXT,
        content_type TEXT DEFAULT 'news',
        status TEXT DEFAULT 'pending',
        quality_score NUMERIC DEFAULT 0,
        compliance_score NUMERIC DEFAULT 0,
        risk_score NUMERIC DEFAULT 0,
        verification_score NUMERIC DEFAULT 0,
        source_score NUMERIC DEFAULT 0,
        media_score NUMERIC DEFAULT 0,
        language_score NUMERIC DEFAULT 0,
        completeness_score NUMERIC DEFAULT 0,
        decision TEXT DEFAULT 'pending',
        reasons JSONB DEFAULT '[]'::jsonb,
        recommendations JSONB DEFAULT '[]'::jsonb,
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_quality_policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'editorial',
        active BOOLEAN DEFAULT TRUE,
        rules JSONB DEFAULT '[]'::jsonb,
        severity TEXT DEFAULT 'medium',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_quality_rules (
        id TEXT PRIMARY KEY,
        policy_id TEXT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'threshold',
        field TEXT,
        operator TEXT,
        value JSONB,
        severity TEXT DEFAULT 'medium',
        action TEXT DEFAULT 'review',
        active BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_quality_violations (
        id TEXT PRIMARY KEY,
        review_id TEXT,
        content_id TEXT,
        policy_id TEXT,
        rule_id TEXT,
        type TEXT,
        severity TEXT DEFAULT 'medium',
        message TEXT,
        evidence JSONB DEFAULT '{}'::jsonb,
        status TEXT DEFAULT 'open',
        resolved_by TEXT,
        resolved_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_quality_decisions (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        score NUMERIC DEFAULT 0,
        risk_score NUMERIC DEFAULT 0,
        reviewer_id TEXT,
        reason TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_quality_audits (
        id TEXT PRIMARY KEY,
        review_id TEXT,
        action TEXT,
        actor_id TEXT,
        previous_state JSONB DEFAULT '{}'::jsonb,
        new_state JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_quality_alerts (
        id TEXT PRIMARY KEY,
        review_id TEXT,
        content_id TEXT,
        severity TEXT DEFAULT 'warning',
        type TEXT,
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_quality_reviews_content
      ON ez_quality_reviews(content_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_quality_reviews_decision
      ON ez_quality_reviews(decision)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_quality_violations_review
      ON ez_quality_violations(review_id)
    `);
  }

  /*
   * ============================================================
   * INITIALIZE
   * ============================================================
   */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    registerDefaultPolicies();

    state.initialized = true;

    emit(
      "quality.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /*
   * ============================================================
   * DEFAULT POLICIES
   * ============================================================
   */

  function registerDefaultPolicies() {
    const defaults = [
      {
        name:
          "Editorial Accuracy",

        category:
          "accuracy",

        severity:
          "critical",

        rules: [
          {
            name:
              "Minimum Verification",

            type:
              "threshold",

            field:
              "verificationScore",

            operator:
              ">=",

            value:
              80,

            severity:
              "high",

            action:
              "review"
          }
        ]
      },

      {
        name:
          "Source Reliability",

        category:
          "sources",

        severity:
          "high",

        rules: [
          {
            name:
              "Minimum Source Score",

            type:
              "threshold",

            field:
              "sourceScore",

            operator:
              ">=",

            value:
              70,

            severity:
              "high",

            action:
              "review"
          }
        ]
      },

      {
        name:
          "Media Rights",

        category:
          "rights",

        severity:
          "critical",

        rules: [
          {
            name:
              "Media Rights Required",

            type:
              "boolean",

            field:
              "mediaRightsCleared",

            operator:
              "===",

            value:
              true,

            severity:
              "critical",

            action:
              "hold"
          }
        ]
      },

      {
        name:
          "Editorial Completeness",

        category:
          "completeness",

        severity:
          "medium",

        rules: [
          {
            name:
              "Minimum Completeness",

            type:
              "threshold",

            field:
              "completenessScore",

            operator:
              ">=",

            value:
              75,

            severity:
              "medium",

            action:
              "review"
          }
        ]
      }
    ];

    for (
      const policy
      of defaults
    ) {
      const existing =
        Array.from(
          state.policies.values()
        ).find(
          item =>
            item.name ===
            policy.name
        );

      if (existing) {
        continue;
      }

      const policyId =
        createId("policy");

      const record = {
        id:
          policyId,

        name:
          policy.name,

        description:
          "Default EZ MEDIA editorial policy",

        category:
          policy.category,

        active:
          true,

        rules:
          policy.rules,

        severity:
          policy.severity,

        metadata: {},

        createdAt:
          now(),

        updatedAt:
          now()
      };

      state.policies.set(
        policyId,
        record
      );

      for (
        const rule
        of policy.rules
      ) {
        const ruleId =
          createId("rule");

        state.rules.set(
          ruleId,
          {
            id:
              ruleId,

            policyId,

            ...rule,

            active:
              true,

            createdAt:
              now()
          }
        );
      }
    }
  }

  /*
   * ============================================================
   * POLICIES
   * ============================================================
   */

  async function createPolicy(
    input = {}
  ) {
    if (
      state.policies.size >=
      maxPolicies
    ) {
      throw new Error(
        "Maximum policies reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Policy name is required"
      );
    }

    const policy = {
      id:
        createId("policy"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      description:
        input.description ||
        "",

      category:
        input.category ||
        "editorial",

      active:
        input.active !== false,

      rules:
        Array.isArray(
          input.rules
        )
          ? input.rules
          : [],

      severity:
        input.severity ||
        "medium",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.policies.set(
      policy.id,
      policy
    );

    for (
      const rule
      of policy.rules
    ) {
      if (
        state.rules.size >=
        maxRules
      ) {
        break;
      }

      const ruleId =
        createId("rule");

      state.rules.set(
        ruleId,
        {
          id:
            ruleId,

          policyId:
            policy.id,

          ...rule,

          active:
            rule.active !== false,

          createdAt:
            now()
        }
      );
    }

    await query(
      `
      INSERT INTO ez_quality_policies
      (
        id,
        name,
        description,
        category,
        active,
        rules,
        severity,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        policy.id,
        policy.name,
        policy.description,
        policy.category,
        policy.active,
        JSON.stringify(
          policy.rules
        ),
        policy.severity,
        JSON.stringify(
          policy.metadata
        ),
        policy.createdAt,
        policy.updatedAt
      ]
    );

    return clone(policy);
  }

  function getPolicies() {
    return Array.from(
      state.policies.values()
    ).map(clone);
  }

  /*
   * ============================================================
   * FIELD VALUE
   * ============================================================
   */

  function getField(
    object,
    path
  ) {
    if (!path) {
      return undefined;
    }

    return String(path)
      .split(".")
      .reduce(
        (current, key) =>
          current == null
            ? undefined
            : current[key],
        object
      );
  }

  /*
   * ============================================================
   * RULE EVALUATION
   * ============================================================
   */

  function evaluateRule(
    rule,
    data
  ) {
    const actual =
      getField(
        data,
        rule.field
      );

    const expected =
      rule.value;

    switch (
      rule.operator
    ) {
      case ">":
        return actual > expected;

      case ">=":
        return actual >= expected;

      case "<":
        return actual < expected;

      case "<=":
        return actual <= expected;

      case "===":
        return actual === expected;

      case "!==":
        return actual !== expected;

      case "includes":
        return Array.isArray(actual)
          ? actual.includes(
              expected
            )
          : String(actual || "")
              .toLowerCase()
              .includes(
                String(expected)
                  .toLowerCase()
              );

      default:
        return true;
    }
  }

  /*
   * ============================================================
   * CONTENT SIGNALS
   * ============================================================
   */

  function calculateLanguageScore(
    content = {}
  ) {
    const text =
      String(
        content.text ||
        content.body ||
        ""
      );

    if (!text.trim()) {
      return 0;
    }

    let score = 100;

    if (
      text.length < 100
    ) {
      score -= 20;
    }

    const repeated =
      /(.)\1{6,}/u.test(
        text
      );

    if (repeated) {
      score -= 20;
    }

    return Math.max(
      0,
      Math.min(
        100,
        score
      )
    );
  }

  function calculateCompletenessScore(
    content = {}
  ) {
    const fields = [
      "title",
      "text",
      "body",
      "summary",
      "source",
      "publishedAt"
    ];

    const available =
      fields.filter(
        field =>
          content[field] !==
            undefined &&
          content[field] !==
            null &&
          String(
            content[field]
          ).trim() !== ""
      ).length;

    return Math.round(
      (
        available /
        fields.length
      ) *
        100
    );
  }

  function calculateOverallScore(
    scores
  ) {
    return Math.round(
      (
        scores.verificationScore *
          0.25 +

        scores.sourceScore *
          0.15 +

        scores.mediaScore *
          0.10 +

        scores.languageScore *
          0.15 +

        scores.completenessScore *
          0.15 +

        scores.complianceScore *
          0.20
      ) * 100
    ) / 100;
  }

  /*
   * ============================================================
   * EXTERNAL INTELLIGENCE
   * ============================================================
   */

  async function collectExternalSignals(
    content
  ) {
    const result = {
      verificationScore:
        Number(
          content.verificationScore ||
          0
        ),

      sourceScore:
        Number(
          content.sourceScore ||
          0
        ),

      mediaScore:
        Number(
          content.mediaScore ||
          0
        ),

      riskScore:
        Number(
          content.riskScore ||
          0
        ),

      mediaRightsCleared:
        content.mediaRightsCleared !==
        false
    };

    if (
      sourceIntelligence &&
      typeof sourceIntelligence
        .analyzeStory ===
        "function"
    ) {
      try {
        const sourceResult =
          await sourceIntelligence
            .analyzeStory(
              content
            );

        result.sourceScore =
          Number(
            sourceResult
              ?.confidenceScore ||
            sourceResult
              ?.trustScore ||
            result.sourceScore
          );
      } catch (error) {
        logger.warn(
          "[CODE93] Source intelligence:",
          error.message
        );
      }
    }

    if (
      verificationEngine &&
      typeof verificationEngine
        .verify ===
        "function"
    ) {
      try {
        const verification =
          await verificationEngine
            .verify(
              content
            );

        result.verificationScore =
          Number(
            verification
              ?.verificationScore ||
            verification
              ?.score ||
            result.verificationScore
          );
      } catch (error) {
        logger.warn(
          "[CODE93] Verification:",
          error.message
        );
      }
    }

    if (
      mediaForensicsEngine &&
      content.media
    ) {
      try {
        const forensic =
          await mediaForensicsEngine
            .analyze(
              content.media
            );

        result.mediaScore =
          Number(
            forensic
              ?.score ||
            forensic
              ?.confidence ||
            result.mediaScore
          );
      } catch (error) {
        logger.warn(
          "[CODE93] Media forensics:",
          error.message
        );
      }
    }

    return result;
  }

  /*
   * ============================================================
   * AI ANALYSIS
   * ============================================================
   */

  async function runAIAnalysis(
    content,
    signals
  ) {
    state.statistics
      .aiAnalyses++;

    const input = {
      content,

      signals,

      instruction:
        "حلل جودة المحتوى الإعلامي وامتثاله التحريري، وحدد المخاطر، ونقاط الضعف، والتوصيات. لا تعتبر التحليل الآلي إثباتاً للحقيقة."
    };

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        return await aiOrchestrator
          .process({
            operation:
              "editorial-quality-compliance",

            input,

            metadata: {
              source:
                "CODE93"
            }
          });
      } catch (error) {
        logger.warn(
          "[CODE93] AI orchestrator:",
          error.message
        );
      }
    }

    if (
      aiCore &&
      typeof aiCore.fullAnalysis ===
        "function"
    ) {
      try {
        return await aiCore
          .fullAnalysis(
            input
          );
      } catch (error) {
        logger.warn(
          "[CODE93] AI core:",
          error.message
        );
      }
    }

    return {
      available: false,

      risks: [],

      recommendations: []
    };
  }

  /*
   * ============================================================
   * POLICY CHECK
   * ============================================================
   */

  async function checkPolicies(
    data
  ) {
    const violations = [];

    for (
      const policy
      of state.policies.values()
    ) {
      if (!policy.active) {
        continue;
      }

      for (
        const rule
        of state.rules.values()
      ) {
        if (
          rule.policyId !==
          policy.id
        ) {
          continue;
        }

        if (!rule.active) {
          continue;
        }

        state.statistics
          .policyChecks++;

        const passed =
          evaluateRule(
            rule,
            data
          );

        if (!passed) {
          violations.push({
            policyId:
              policy.id,

            ruleId:
              rule.id,

            type:
              policy.category,

            severity:
              rule.severity ||
              policy.severity ||
              "medium",

            message:
              `فشل شرط السياسة: ${rule.name}`,

            evidence: {
              field:
                rule.field,

              operator:
                rule.operator,

              expected:
                rule.value,

              actual:
                getField(
                  data,
                  rule.field
                )
            },

            action:
              rule.action ||
              "review"
          });
        }
      }
    }

    return violations;
  }

  /*
   * ============================================================
   * VIOLATIONS
   * ============================================================
   */

  async function saveViolation(
    reviewId,
    contentId,
    violation
  ) {
    if (
      state.violations.size >=
      maxViolations
    ) {
      return null;
    }

    const record = {
      id:
        createId("violation"),

      reviewId,

      contentId:
        contentId ||
        null,

      policyId:
        violation.policyId ||
        null,

      ruleId:
        violation.ruleId ||
        null,

      type:
        violation.type ||
        "editorial",

      severity:
        violation.severity ||
        "medium",

      message:
        violation.message ||
        "",

      evidence:
        violation.evidence ||
        {},

      status:
        "open",

      resolvedBy:
        null,

      resolvedAt:
        null,

      metadata: {},

      createdAt:
        now()
    };

    state.violations.set(
      record.id,
      record
    );

    state.statistics
      .violationsDetected++;

    if (
      record.severity ===
        "critical" ||
      record.severity ===
        "high"
    ) {
      state.statistics
        .criticalViolations++;
    }

    await query(
      `
      INSERT INTO ez_quality_violations
      (
        id,
        review_id,
        content_id,
        policy_id,
        rule_id,
        type,
        severity,
        message,
        evidence,
        status,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12
      )
      `,
      [
        record.id,
        record.reviewId,
        record.contentId,
        record.policyId,
        record.ruleId,
        record.type,
        record.severity,
        record.message,
        JSON.stringify(
          record.evidence
        ),
        record.status,
        JSON.stringify(
          record.metadata
        ),
        record.createdAt
      ]
    );

    return clone(record);
  }

  /*
   * ============================================================
   * DECISION ENGINE
   * ============================================================
   */

  function determineDecision(
    scores,
    violations
  ) {
    const critical =
      violations.some(
        violation =>
          violation.severity ===
          "critical"
      );

    const highRisk =
      Number(
        scores.riskScore || 0
      ) >=
      criticalRiskThreshold;

    const hardHold =
      violations.some(
        violation =>
          violation.action ===
          "hold"
      );

    if (
      critical ||
      highRisk ||
      hardHold
    ) {
      return {
        decision:
          "hold",

        reason:
          "مخاطر أو مخالفات حرجة تتطلب الإيقاف والمراجعة البشرية"
      };
    }

    if (
      scores.overallScore >=
      autoPublishScore &&
      scores.verificationScore >=
      80 &&
      scores.complianceScore >=
      80
    ) {
      return {
        decision:
          "auto_publish_eligible",

        reason:
          "حقق المحتوى الحد الأدنى للنشر الآلي المؤهل"
      };
    }

    if (
      scores.overallScore >=
      humanReviewScore
    ) {
      return {
        decision:
          "human_review",

        reason:
          "المحتوى يحتاج مراجعة بشرية قبل النشر"
      };
    }

    if (
      scores.overallScore <
      rejectScore
    ) {
      return {
        decision:
          "reject",

        reason:
          "درجة الجودة أقل من الحد الأدنى"
      };
    }

    return {
      decision:
        "human_review",

      reason:
        "يتطلب مراجعة تحريرية"
    };
  }

  /*
   * ============================================================
   * FULL REVIEW
   * ============================================================
   */

  async function reviewContent(
    input = {}
  ) {
    if (
      state.reviews.size >=
      maxReviews
    ) {
      throw new Error(
        "Maximum reviews reached"
      );
    }

    if (!input.contentId) {
      throw new Error(
        "contentId is required"
      );
    }

    const content =
      input.content ||
      {};

    const review = {
      id:
        createId("quality_review"),

      contentId:
        input.contentId,

      storyId:
        input.storyId ||
        null,

      contentType:
        input.contentType ||
        "news",

      status:
        "processing",

      qualityScore:
        0,

      complianceScore:
        0,

      riskScore:
        0,

      verificationScore:
        0,

      sourceScore:
        0,

      mediaScore:
        0,

      languageScore:
        0,

      completenessScore:
        0,

      decision:
        "pending",

      reasons: [],

      recommendations: [],

      aiAnalysis:
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.reviews.set(
      review.id,
      review
    );

    state.statistics
      .reviewsCreated++;

    try {
      const externalSignals =
        await collectExternalSignals(
          content
        );

      review.verificationScore =
        externalSignals
          .verificationScore;

      review.sourceScore =
        externalSignals
          .sourceScore;

      review.mediaScore =
        externalSignals
          .mediaScore;

      review.riskScore =
        externalSignals
          .riskScore;

      review.languageScore =
        calculateLanguageScore(
          content
        );

      review.completenessScore =
        calculateCompletenessScore(
          content
        );

      const baseCompliance =
        Math.round(
          (
            review.languageScore +
            review.completenessScore +
            (
              externalSignals
                .mediaRightsCleared
                ? 100
                : 0
            )
          ) /
            3
        );

      review.complianceScore =
        baseCompliance;

      review.aiAnalysis =
        await runAIAnalysis(
          content,
          externalSignals
        );

      const violations =
        await checkPolicies({
          ...content,

          verificationScore:
            review.verificationScore,

          sourceScore:
            review.sourceScore,

          mediaScore:
            review.mediaScore,

          languageScore:
            review.languageScore,

          completenessScore:
            review.completenessScore,

          complianceScore:
            review.complianceScore,

          riskScore:
            review.riskScore,

          mediaRightsCleared:
            externalSignals
              .mediaRightsCleared
        });

      for (
        const violation
        of violations
      ) {
        review.reasons.push(
          violation.message
        );

        await saveViolation(
          review.id,
          review.contentId,
          violation
        );
      }

      review.qualityScore =
        calculateOverallScore({
          verificationScore:
            review.verificationScore,

          sourceScore:
            review.sourceScore,

          mediaScore:
            review.mediaScore,

          languageScore:
            review.languageScore,

          completenessScore:
            review.completenessScore,

          complianceScore:
            review.complianceScore
        });

      const decision =
        determineDecision(
          {
            overallScore:
              review.qualityScore,

            verificationScore:
              review.verificationScore,

            complianceScore:
              review.complianceScore,

            riskScore:
              review.riskScore
          },
          violations
        );

      review.decision =
        decision.decision;

      review.reasons.push(
        decision.reason
      );

      review.recommendations =
        buildRecommendations(
          review,
          violations
        );

      review.status =
        "completed";

      review.updatedAt =
        now();

      await saveDecision(
        review,
        decision
      );

      await saveAudit(
        review,
        "review_completed",
        input.actorId ||
          null
      );

      state.statistics
        .reviewsCompleted++;

      if (
        review.decision ===
        "auto_publish_eligible"
      ) {
        state.statistics
          .autoApproved++;
      }

      if (
        review.decision ===
        "human_review"
      ) {
        state.statistics
          .humanReviews++;
      }

      if (
        review.decision ===
        "reject"
      ) {
        state.statistics
          .rejected++;
      }

      if (
        review.decision ===
        "hold"
      ) {
        state.statistics
          .held++;
      }

      await query(
        `
        INSERT INTO ez_quality_reviews
        (
          id,
          content_id,
          story_id,
          content_type,
          status,
          quality_score,
          compliance_score,
          risk_score,
          verification_score,
          source_score,
          media_score,
          language_score,
          completeness_score,
          decision,
          reasons,
          recommendations,
          ai_analysis,
          metadata,
          created_at,
          updated_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        `,
        [
          review.id,
          review.contentId,
          review.storyId,
          review.contentType,
          review.status,
          review.qualityScore,
          review.complianceScore,
          review.riskScore,
          review.verificationScore,
          review.sourceScore,
          review.mediaScore,
          review.languageScore,
          review.completenessScore,
          review.decision,
          JSON.stringify(
            review.reasons
          ),
          JSON.stringify(
            review.recommendations
          ),
          JSON.stringify(
            review.aiAnalysis
          ),
          JSON.stringify(
            review.metadata
          ),
          review.createdAt,
          review.updatedAt
        ]
      );

      emit(
        "quality.review.completed",
        clone(review)
      );

      if (
        review.decision ===
          "hold" ||
        review.decision ===
          "human_review"
      ) {
        await createAlert({
          reviewId:
            review.id,

          contentId:
            review.contentId,

          severity:
            review.decision ===
            "hold"
              ? "critical"
              : "warning",

          type:
            "editorial_review_required",

          message:
            decision.reason
        });
      }

      return clone(review);

    } catch (error) {
      review.status =
        "failed";

      review.updatedAt =
        now();

      await saveAudit(
        review,
        "review_failed",
        input.actorId ||
          null
      );

      throw error;
    }
  }

  /*
   * ============================================================
   * RECOMMENDATIONS
   * ============================================================
   */

  function buildRecommendations(
    review,
    violations
  ) {
    const recommendations =
      [];

    if (
      review.verificationScore <
      80
    ) {
      recommendations.push(
        "رفع مستوى التحقق من الخبر والأدلة قبل النشر"
      );
    }

    if (
      review.sourceScore <
      70
    ) {
      recommendations.push(
        "إضافة أو تحسين المصادر الموثوقة"
      );
    }

    if (
      review.languageScore <
      80
    ) {
      recommendations.push(
        "مراجعة اللغة والأسلوب التحريري"
      );
    }

    if (
      review.completenessScore <
      80
    ) {
      recommendations.push(
        "استكمال عناصر الخبر الأساسية"
      );
    }

    if (
      review.mediaScore <
      70
    ) {
      recommendations.push(
        "فحص الوسائط ومصدرها وحقوق استخدامها"
      );
    }

    for (
      const violation
      of violations
    ) {
      if (
        violation.severity ===
        "critical"
      ) {
        recommendations.push(
          `معالجة المخالفة الحرجة: ${violation.message}`
        );
      }
    }

    if (!recommendations.length) {
      recommendations.push(
        "لا توجد توصيات حرجة وفق نتائج الفحص الحالي"
      );
    }

    return [
      ...new Set(
        recommendations
      )
    ];
  }

  /*
   * ============================================================
   * DECISION
   * ============================================================
   */

  async function saveDecision(
    review,
    decision,
    reviewerId = null
  ) {
    const record = {
      id:
        createId("quality_decision"),

      reviewId:
        review.id,

      decision:
        decision.decision,

      score:
        review.qualityScore,

      riskScore:
        review.riskScore,

      reviewerId,

      reason:
        decision.reason,

      metadata: {},

      createdAt:
        now()
    };

    state.decisions.set(
      record.id,
      record
    );

    await query(
      `
      INSERT INTO ez_quality_decisions
      (
        id,
        review_id,
        decision,
        score,
        risk_score,
        reviewer_id,
        reason,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        record.id,
        record.reviewId,
        record.decision,
        record.score,
        record.riskScore,
        record.reviewerId,
        record.reason,
        JSON.stringify(
          record.metadata
        ),
        record.createdAt
      ]
    );

    return clone(record);
  }

  /*
   * ============================================================
   * HUMAN REVIEW
   * ============================================================
   */

  async function humanApprove(
    reviewId,
    input = {}
  ) {
    const review =
      state.reviews.get(
        reviewId
      );

    if (!review) {
      throw new Error(
        "Review not found"
      );
    }

    const previous =
      clone(review);

    review.decision =
      "approved_by_human";

    review.status =
      "approved";

    review.updatedAt =
      now();

    await saveDecision(
      review,
      {
        decision:
          "approved_by_human",

        reason:
          "تم اعتماد المحتوى بواسطة المراجع البشري"
      },
      input.reviewerId ||
        null
    );

    await saveAudit(
      review,
      "human_approved",
      input.reviewerId ||
        null,
      previous
    );

    emit(
      "quality.human.approved",
      clone(review)
    );

    return clone(review);
  }

  async function humanReject(
    reviewId,
    input = {}
  ) {
    const review =
      state.reviews.get(
        reviewId
      );

    if (!review) {
      throw new Error(
        "Review not found"
      );
    }

    const previous =
      clone(review);

    review.decision =
      "rejected_by_human";

    review.status =
      "rejected";

    review.updatedAt =
      now();

    await saveDecision(
      review,
      {
        decision:
          "rejected_by_human",

        reason:
          input.reason ||
          "تم رفض المحتوى بواسطة المراجع البشري"
      },
      input.reviewerId ||
        null
    );

    await saveAudit(
      review,
      "human_rejected",
      input.reviewerId ||
        null,
      previous
    );

    emit(
      "quality.human.rejected",
      clone(review)
    );

    return clone(review);
  }

  /*
   * ============================================================
   * AUDIT
   * ============================================================
   */

  async function saveAudit(
    review,
    action,
    actorId = null,
    previousState = {}
  ) {
    const audit = {
      id:
        createId("quality_audit"),

      reviewId:
        review.id,

      action,

      actorId,

      previousState:
        previousState || {},

      newState:
        clone(review),

      metadata: {},

      createdAt:
        now()
    };

    state.audits.set(
      audit.id,
      audit
    );

    await query(
      `
      INSERT INTO ez_quality_audits
      (
        id,
        review_id,
        action,
        actor_id,
        previous_state,
        new_state,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        audit.id,
        audit.reviewId,
        audit.action,
        audit.actorId,
        JSON.stringify(
          audit.previousState
        ),
        JSON.stringify(
          audit.newState
        ),
        JSON.stringify(
          audit.metadata
        ),
        audit.createdAt
      ]
    );

    return clone(audit);
  }

  /*
   * ============================================================
   * ALERTS
   * ============================================================
   */

  async function createAlert(
    input = {}
  ) {
    const alert = {
      id:
        createId("quality_alert"),

      reviewId:
        input.reviewId ||
        null,

      contentId:
        input.contentId ||
        null,

      severity:
        input.severity ||
        "warning",

      type:
        input.type ||
        "quality",

      message:
        input.message ||
        "",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.alerts.set(
      alert.id,
      alert
    );

    state.statistics
      .alertsCreated++;

    await query(
      `
      INSERT INTO ez_quality_alerts
      (
        id,
        review_id,
        content_id,
        severity,
        type,
        message,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        alert.id,
        alert.reviewId,
        alert.contentId,
        alert.severity,
        alert.type,
        alert.message,
        JSON.stringify(
          alert.metadata
        ),
        alert.createdAt
      ]
    );

    emit(
      "quality.alert",
      clone(alert)
    );

    return clone(alert);
  }

  function getAlerts() {
    return Array.from(
      state.alerts.values()
    )
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map(clone);
  }

  /*
   * ============================================================
   * GETTERS
   * ============================================================
   */

  function getReviews(
    filters = {}
  ) {
    let reviews =
      Array.from(
        state.reviews.values()
      );

    if (filters.contentId) {
      reviews =
        reviews.filter(
          item =>
            item.contentId ===
            filters.contentId
        );
    }

    if (filters.decision) {
      reviews =
        reviews.filter(
          item =>
            item.decision ===
            filters.decision
        );
    }

    if (filters.status) {
      reviews =
        reviews.filter(
          item =>
            item.status ===
            filters.status
        );
    }

    return reviews
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map(clone);
  }

  function getReview(
    reviewId
  ) {
    const review =
      state.reviews.get(
        reviewId
      );

    return review
      ? clone(review)
      : null;
  }

  function getViolations(
    filters = {}
  ) {
    let violations =
      Array.from(
        state.violations.values()
      );

    if (filters.reviewId) {
      violations =
        violations.filter(
          item =>
            item.reviewId ===
            filters.reviewId
        );
    }

    if (filters.contentId) {
      violations =
        violations.filter(
          item =>
            item.contentId ===
            filters.contentId
        );
    }

    if (filters.severity) {
      violations =
        violations.filter(
          item =>
            item.severity ===
            filters.severity
        );
    }

    return violations.map(
      clone
    );
  }

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  function getDashboard() {
    const reviews =
      Array.from(
        state.reviews.values()
      );

    return {
      reviews: {
        total:
          reviews.length,

        completed:
          reviews.filter(
            item =>
              item.status ===
              "completed"
          ).length,

        pending:
          reviews.filter(
            item =>
              item.status ===
              "processing" ||
              item.status ===
              "pending"
          ).length,

        humanReview:
          reviews.filter(
            item =>
              item.decision ===
              "human_review"
          ).length,

        held:
          reviews.filter(
            item =>
              item.decision ===
              "hold"
          ).length,

        rejected:
          reviews.filter(
            item =>
              item.decision ===
              "reject"
          ).length,

        autoPublishEligible:
          reviews.filter(
            item =>
              item.decision ===
              "auto_publish_eligible"
          ).length
      },

      policies:
        state.policies.size,

      rules:
        state.rules.size,

      violations:
        state.violations.size,

      criticalViolations:
        state.statistics
          .criticalViolations,

      alerts:
        getAlerts().slice(
          0,
          20
        ),

      statistics:
        getStatistics()
    };
  }

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalReviews:
        state.reviews.size,

      totalPolicies:
        state.policies.size,

      totalRules:
        state.rules.size,

      totalViolations:
        state.violations.size,

      totalDecisions:
        state.decisions.size,

      totalAudits:
        state.audits.size
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Editorial Quality & Compliance Engine",

      code:
        "CODE93",

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

        sourceIntelligence:
          Boolean(
            sourceIntelligence
          ),

        verification:
          Boolean(
            verificationEngine
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

        editorial:
          Boolean(
            editorialEngine
          ),

        publishing:
          Boolean(
            publishingEngine
          ),

        assignment:
          Boolean(
            assignmentEngine
          ),

        workforce:
          Boolean(
            workforceEngine
          ),

        training:
          Boolean(
            trainingEngine
          ),

        security:
          Boolean(
            securityEngine
          ),

        workflow:
          Boolean(
            workflowEngine
          ),

        automation:
          Boolean(
            automationEngine
          )
      },

      thresholds: {
        autoPublishScore,
        humanReviewScore,
        rejectScore,
        criticalRiskThreshold
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    if (state.running) {
      return getStatus();
    }

    state.running =
      true;

    emit(
      "quality.started",
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
      "quality.stopped",
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

    createPolicy,
    getPolicies,

    reviewContent,
    getReviews,
    getReview,

    getViolations,

    humanApprove,
    humanReject,

    createAlert,
    getAlerts
  };
}

module.exports = {
  createIntelligentEditorialQualityComplianceEngine
};
