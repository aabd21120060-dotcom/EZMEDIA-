"use strict";

const crypto = require("crypto");

function createIntelligentMediaEthicsGovernanceEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    editorialEngine = null,
    qualityEngine = null,
    legalRightsEngine = null,
    verificationEngine = null,
    sourceIntelligence = null,
    publishingEngine = null,
    workflowEngine = null,
    securityEngine = null,
    communicationEngine = null,
    notificationService = null,
    eventBus = null,

    logger = console,

    maxPolicies = Number(
      process.env.ETHICS_MAX_POLICIES || 10000
    ),

    maxReviews = Number(
      process.env.ETHICS_MAX_REVIEWS || 500000
    ),

    maxConflicts = Number(
      process.env.ETHICS_MAX_CONFLICTS || 100000
    ),

    maxCorrections = Number(
      process.env.ETHICS_MAX_CORRECTIONS || 100000
    ),

    maxAlerts = Number(
      process.env.ETHICS_MAX_ALERTS || 100000
    ),

    autoClearScore = Number(
      process.env.ETHICS_AUTO_CLEAR_SCORE || 90
    ),

    humanReviewScore = Number(
      process.env.ETHICS_HUMAN_REVIEW_SCORE || 70
    ),

    blockScore = Number(
      process.env.ETHICS_BLOCK_SCORE || 50
    ),

    conflictThreshold = Number(
      process.env.ETHICS_CONFLICT_THRESHOLD || 60
    ),

    sensitiveThreshold = Number(
      process.env.ETHICS_SENSITIVE_THRESHOLD || 60
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    policies: new Map(),
    reviews: new Map(),
    conflicts: new Map(),
    corrections: new Map(),
    alerts: new Map(),
    decisions: new Map(),
    audits: new Map(),

    statistics: {
      policiesCreated: 0,
      reviewsCompleted: 0,
      cleared: 0,
      humanReviews: 0,
      blocked: 0,
      conflictsDetected: 0,
      sensitiveCases: 0,
      correctionsCreated: 0,
      alertsCreated: 0
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
        typeof eventBus.emit === "function"
      ) {
        eventBus.emit(
          event,
          payload
        );
      }
    } catch (error) {
      logger.warn(
        "[CODE95] Event error:",
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
      CREATE TABLE IF NOT EXISTS ez_ethics_policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        rules JSONB DEFAULT '[]'::jsonb,
        severity TEXT DEFAULT 'medium',
        enabled BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_ethics_reviews (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        story_id TEXT,
        reviewer_id TEXT,
        status TEXT DEFAULT 'pending',
        decision TEXT DEFAULT 'pending',
        ethics_score NUMERIC DEFAULT 0,
        risk_score NUMERIC DEFAULT 0,
        categories JSONB DEFAULT '[]'::jsonb,
        indicators JSONB DEFAULT '[]'::jsonb,
        recommendations JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_ethics_conflicts (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        employee_id TEXT,
        organization TEXT,
        conflict_type TEXT,
        severity TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        description TEXT,
        resolution TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_ethics_corrections (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        story_id TEXT,
        correction_type TEXT,
        original_text TEXT,
        corrected_text TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        published_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_ethics_alerts (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        type TEXT,
        severity TEXT DEFAULT 'warning',
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_ethics_decisions (
        id TEXT PRIMARY KEY,
        review_id TEXT,
        decision TEXT,
        score NUMERIC DEFAULT 0,
        risk_score NUMERIC DEFAULT 0,
        reviewer_id TEXT,
        reason TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_ethics_audits (
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
      CREATE INDEX IF NOT EXISTS
      idx_ethics_reviews_content
      ON ez_ethics_reviews(content_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ethics_conflicts_content
      ON ez_ethics_conflicts(content_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ethics_corrections_content
      ON ez_ethics_corrections(content_id)
    `);
  }

  /*
   * ============================================================
   * INITIALIZATION
   * ============================================================
   */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    await seedDefaultPolicies();

    state.initialized = true;

    emit(
      "ethics.initialized",
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

  async function seedDefaultPolicies() {
    const policies = [
      {
        name:
          "فصل الخبر عن الإعلان",
        category:
          "commercial_transparency",
        description:
          "يجب عدم تقديم الإعلان أو الرعاية على أنها خبر مستقل.",
        rules: [
          "الإعلان يجب أن يكون واضحاً",
          "الرعاية يجب أن تكون معلنة",
          "عدم التأثير التجاري على الحكم التحريري"
        ],
        severity: "high"
      },

      {
        name:
          "حماية الخصوصية",
        category:
          "privacy",
        description:
          "تجنب نشر البيانات الشخصية غير الضرورية.",
        rules: [
          "عدم نشر بيانات شخصية غير لازمة",
          "تقليل كشف هوية الأشخاص عند الحاجة",
          "المراجعة البشرية للمحتوى الحساس"
        ],
        severity: "high"
      },

      {
        name:
          "حماية المصادر",
        category:
          "source_protection",
        description:
          "عدم كشف المصادر السرية دون مبرر مشروع.",
        rules: [
          "عدم كشف المصدر السري",
          "تحديد مستوى حساسية المصدر",
          "المراجعة البشرية قبل النشر"
        ],
        severity: "critical"
      },

      {
        name:
          "تصحيح الأخطاء",
        category:
          "corrections",
        description:
          "تصحيح الأخطاء الجوهرية بشفافية.",
        rules: [
          "توثيق التصحيح",
          "عدم حذف أثر التصحيح",
          "تسجيل سبب التصحيح"
        ],
        severity: "high"
      },

      {
        name:
          "تضارب المصالح",
        category:
          "conflict_of_interest",
        description:
          "كشف ومعالجة تضارب المصالح التحريري.",
        rules: [
          "تسجيل العلاقة",
          "تقييم التأثير",
          "إعادة التعيين عند الحاجة"
        ],
        severity: "critical"
      },

      {
        name:
          "المحتوى الحساس",
        category:
          "sensitive_content",
        description:
          "المحتوى الحساس يحتاج إلى سياق ومراجعة إضافية.",
        rules: [
          "عدم الإثارة غير الضرورية",
          "إضافة السياق",
          "حماية الفئات الهشة"
        ],
        severity: "high"
      }
    ];

    for (const policy of policies) {
      if (
        Array.from(
          state.policies.values()
        ).some(
          item =>
            item.name ===
            policy.name
        )
      ) {
        continue;
      }

      await createPolicy(
        policy,
        false
      );
    }
  }

  /*
   * ============================================================
   * POLICIES
   * ============================================================
   */

  async function createPolicy(
    input = {},
    count = true
  ) {
    if (
      state.policies.size >=
      maxPolicies
    ) {
      throw new Error(
        "Maximum ethics policies reached"
      );
    }

    const policy = {
      id: id("ethics_policy"),

      name:
        input.name ||
        "سياسة تحريرية",

      category:
        input.category ||
        "general",

      description:
        input.description ||
        "",

      rules:
        Array.isArray(
          input.rules
        )
          ? input.rules
          : [],

      severity:
        input.severity ||
        "medium",

      enabled:
        input.enabled !== false,

      metadata:
        input.metadata ||
        {},

      createdAt: now(),
      updatedAt: now()
    };

    state.policies.set(
      policy.id,
      policy
    );

    if (count) {
      state.statistics
        .policiesCreated++;
    }

    await query(
      `
      INSERT INTO ez_ethics_policies
      (
        id,
        name,
        category,
        description,
        rules,
        severity,
        enabled,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      ON CONFLICT (id)
      DO NOTHING
      `,
      [
        policy.id,
        policy.name,
        policy.category,
        policy.description,
        JSON.stringify(
          policy.rules
        ),
        policy.severity,
        policy.enabled,
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
   * SENSITIVE CONTENT
   * ============================================================
   */

  function analyzeSensitiveContent(
    content = {}
  ) {
    const text = String(
      content.text ||
      content.body ||
      ""
    );

    const indicators = [];
    let score = 0;

    const rules = [
      {
        category:
          "children",

        words: [
          "طفل",
          "أطفال",
          "قاصر",
          "طفلة",
          "حدث"
        ],

        weight: 25
      },

      {
        category:
          "violence",

        words: [
          "قتل",
          "مقتل",
          "عنف",
          "اعتداء",
          "إصابة",
          "جريمة"
        ],

        weight: 20
      },

      {
        category:
          "sexual",

        words: [
          "اعتداء جنسي",
          "تحرش",
          "اغتصاب"
        ],

        weight: 35
      },

      {
        category:
          "self_harm",

        words: [
          "انتحار",
          "إيذاء النفس"
        ],

        weight: 35
      },

      {
        category:
          "private_person",

        words: [
          "رقم الجوال",
          "العنوان",
          "الهوية",
          "رقم الهوية"
        ],

        weight: 30
      },

      {
        category:
          "death",

        words: [
          "وفاة",
          "متوفى",
          "جنازة"
        ],

        weight: 20
      }
    ];

    for (const rule of rules) {
      const matches =
        rule.words.filter(
          word =>
            text.includes(word)
        );

      if (matches.length) {
        score +=
          rule.weight;

        indicators.push({
          category:
            rule.category,

          matches
        });
      }
    }

    return {
      score:
        Math.min(
          100,
          score
        ),

      sensitive:
        score >=
        sensitiveThreshold,

      indicators
    };
  }

  /*
   * ============================================================
   * ADVERTISING / SPONSORSHIP SEPARATION
   * ============================================================
   */

  function analyzeCommercialTransparency(
    content = {}
  ) {
    const indicators = [];

    if (
      content.sponsored === true
    ) {
      indicators.push(
        "sponsored"
      );
    }

    if (
      content.advertisement === true
    ) {
      indicators.push(
        "advertisement"
      );
    }

    if (
      content.brandMention === true
    ) {
      indicators.push(
        "brand_mention"
      );
    }

    const hasDisclosure =
      Boolean(
        content.sponsorDisclosure ||
        content.adDisclosure ||
        content.isAdvertisementLabel
      );

    let risk = 0;

    if (
      indicators.length &&
      !hasDisclosure
    ) {
      risk = 80;
    }

    if (
      indicators.length &&
      hasDisclosure
    ) {
      risk = 10;
    }

    return {
      risk,
      indicators,
      disclosed:
        hasDisclosure
    };
  }

  /*
   * ============================================================
   * SOURCE PROTECTION
   * ============================================================
   */

  function analyzeSourceProtection(
    content = {}
  ) {
    const source =
      content.source || {};

    let risk = 0;
    const indicators = [];

    if (
      source.confidential === true
    ) {
      indicators.push(
        "confidential_source"
      );

      risk += 60;
    }

    if (
      source.identityExposed === true
    ) {
      indicators.push(
        "source_identity_exposed"
      );

      risk += 40;
    }

    if (
      source.protectionRequested === true
    ) {
      indicators.push(
        "protection_requested"
      );

      risk += 30;
    }

    return {
      risk:
        Math.min(
          100,
          risk
        ),

      indicators
    };
  }

  /*
   * ============================================================
   * CONFLICT OF INTEREST
   * ============================================================
   */

  async function detectConflictOfInterest(
    content = {},
    employee = {}
  ) {
    const indicators = [];
    let score = 0;

    if (
      employee.hasFinancialInterest === true
    ) {
      indicators.push(
        "financial_interest"
      );

      score += 50;
    }

    if (
      employee.relatedToSubject === true
    ) {
      indicators.push(
        "personal_relationship"
      );

      score += 40;
    }

    if (
      employee.receivedBenefit === true
    ) {
      indicators.push(
        "received_benefit"
      );

      score += 50;
    }

    if (
      employee.worksForSubject === true
    ) {
      indicators.push(
        "works_for_subject"
      );

      score += 60;
    }

    if (
      score >=
      conflictThreshold
    ) {
      state.statistics
        .conflictsDetected++;

      await createConflict({
        contentId:
          content.contentId ||
          null,

        employeeId:
          employee.employeeId ||
          null,

        organization:
          employee.organization ||
          null,

        conflictType:
          "editorial_conflict",

        severity:
          score >= 80
            ? "critical"
            : "high",

        description:
          "تم اكتشاف مؤشرات محتملة لتضارب المصالح",

        metadata: {
          score,
          indicators
        }
      });
    }

    return {
      score:
        Math.min(
          100,
          score
        ),

      indicators
    };
  }

  async function createConflict(
    input = {}
  ) {
    if (
      state.conflicts.size >=
      maxConflicts
    ) {
      throw new Error(
        "Maximum conflict records reached"
      );
    }

    const conflict = {
      id:
        id("ethics_conflict"),

      contentId:
        input.contentId ||
        null,

      employeeId:
        input.employeeId ||
        null,

      organization:
        input.organization ||
        null,

      conflictType:
        input.conflictType ||
        "general",

      severity:
        input.severity ||
        "medium",

      status:
        "open",

      description:
        input.description ||
        "",

      resolution:
        null,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      resolvedAt:
        null
    };

    state.conflicts.set(
      conflict.id,
      conflict
    );

    await query(
      `
      INSERT INTO ez_ethics_conflicts
      (
        id,
        content_id,
        employee_id,
        organization,
        conflict_type,
        severity,
        status,
        description,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        conflict.id,
        conflict.contentId,
        conflict.employeeId,
        conflict.organization,
        conflict.conflictType,
        conflict.severity,
        conflict.status,
        conflict.description,
        JSON.stringify(
          conflict.metadata
        ),
        conflict.createdAt
      ]
    );

    return clone(conflict);
  }

  /*
   * ============================================================
   * AI ANALYSIS
   * ============================================================
   */

  async function analyzeWithAI(
    content,
    signals
  ) {
    const input = {
      content,
      signals,

      instruction:
        "حلل المحتوى وفق مبادئ الأخلاقيات الإعلامية والحوكمة التحريرية. حدد المخاطر والمؤشرات والتوصيات. لا تعتبر النتيجة رأياً قانونياً ولا تجعل الذكاء الاصطناعي صاحب القرار النهائي في القضايا الحساسة."
    };

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        return await aiOrchestrator.process({
          operation:
            "media-ethics-governance",

          input,

          metadata: {
            source:
              "CODE95"
          }
        });
      } catch (error) {
        logger.warn(
          "[CODE95] AI orchestrator:",
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
        return await aiCore.fullAnalysis(
          input
        );
      } catch (error) {
        logger.warn(
          "[CODE95] AI core:",
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
   * EXTERNAL ENGINE SIGNALS
   * ============================================================
   */

  async function collectExternalSignals(
    content
  ) {
    const signals = {
      verificationRisk: 0,
      legalRisk: 0,
      qualityRisk: 0
    };

    if (
      verificationEngine &&
      typeof verificationEngine
        .getStatus ===
        "function"
    ) {
      try {
        const status =
          verificationEngine
            .getStatus();

        if (
          status &&
          status.running === false
        ) {
          signals.verificationRisk =
            20;
        }
      } catch {}
    }

    if (
      legalRightsEngine &&
      typeof legalRightsEngine
        .getCase ===
        "function" &&
      content.legalCaseId
    ) {
      try {
        const legalCase =
          legalRightsEngine.getCase(
            content.legalCaseId
          );

        if (
          legalCase &&
          legalCase.decision ===
          "blocked"
        ) {
          signals.legalRisk =
            100;
        }
      } catch {}
    }

    if (
      qualityEngine &&
      typeof qualityEngine
        .getStatus ===
        "function"
    ) {
      try {
        const status =
          qualityEngine
            .getStatus();

        if (
          status &&
          status.running === false
        ) {
          signals.qualityRisk =
            20;
        }
      } catch {}
    }

    return signals;
  }

  /*
   * ============================================================
   * REVIEW
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
        "Maximum ethics reviews reached"
      );
    }

    if (!input.contentId) {
      throw new Error(
        "contentId is required"
      );
    }

    const review = {
      id:
        id("ethics_review"),

      contentId:
        input.contentId,

      storyId:
        input.storyId ||
        null,

      reviewerId:
        input.reviewerId ||
        null,

      status:
        "processing",

      decision:
        "pending",

      ethicsScore:
        0,

      riskScore:
        0,

      categories: [],

      indicators: [],

      recommendations: [],

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

    const content =
      input.content || {};

    try {
      const sensitive =
        analyzeSensitiveContent(
          content
        );

      const commercial =
        analyzeCommercialTransparency(
          content
        );

      const sourceProtection =
        analyzeSourceProtection(
          content
        );

      const conflict =
        await detectConflictOfInterest(
          content,
          input.employee || {}
        );

      const external =
        await collectExternalSignals(
          content
        );

      const ai =
        await analyzeWithAI(
          content,
          {
            sensitive,
            commercial,
            sourceProtection,
            conflict,
            external
          }
        );

      if (
        sensitive.sensitive
      ) {
        state.statistics
          .sensitiveCases++;
      }

      const indicators = [
        ...sensitive.indicators,
        ...commercial.indicators,
        ...sourceProtection.indicators,
        ...conflict.indicators
      ];

      const categories = [
        ...new Set(
          sensitive.indicators.map(
            item =>
              item.category
          )
        )
      ];

      if (
        commercial.risk >
        0
      ) {
        categories.push(
          "commercial_transparency"
        );
      }

      if (
        sourceProtection.risk >
        0
      ) {
        categories.push(
          "source_protection"
        );
      }

      if (
        conflict.score >
        0
      ) {
        categories.push(
          "conflict_of_interest"
        );
      }

      const riskScore =
        Math.round(
          (
            sensitive.score *
              0.25 +

            commercial.risk *
              0.20 +

            sourceProtection.risk *
              0.20 +

            conflict.score *
              0.20 +

            external.verificationRisk *
              0.05 +

            external.legalRisk *
              0.05 +

            external.qualityRisk *
              0.05
          ) * 100
        ) / 100;

      const ethicsScore =
        Math.max(
          0,
          Math.min(
            100,
            Math.round(
              100 -
              riskScore
            )
          )
        );

      let decision =
        "human_review";

      let reason =
        "المحتوى يحتاج مراجعة تحريرية أخلاقية";

      if (
        external.legalRisk >=
        100
      ) {
        decision =
          "blocked";

        reason =
          "طبقة الحقوق القانونية منعت المحتوى";
      } else if (
        conflict.score >=
        conflictThreshold
      ) {
        decision =
          "human_review";

        reason =
          "وجود تضارب مصالح محتمل";
      } else if (
        sourceProtection.risk >=
        80
      ) {
        decision =
          "human_review";

        reason =
          "حماية المصدر تتطلب مراجعة بشرية";
      } else if (
        sensitive.score >=
        80
      ) {
        decision =
          "human_review";

        reason =
          "المحتوى حساس بدرجة مرتفعة";
      } else if (
        commercial.risk >=
        70
      ) {
        decision =
          "human_review";

        reason =
          "يجب الفصل الواضح بين المحتوى التحريري والمحتوى التجاري";
      } else if (
        ethicsScore >=
        autoClearScore
      ) {
        decision =
          "cleared";

        reason =
          "لم تظهر مؤشرات أخلاقية حرجة";
      } else if (
        ethicsScore <
        blockScore
      ) {
        decision =
          "blocked";

        reason =
          "مستوى المخاطر الأخلاقية مرتفع";
      }

      review.ethicsScore =
        ethicsScore;

      review.riskScore =
        riskScore;

      review.categories =
        [
          ...new Set(
            categories
          )
        ];

      review.indicators =
        indicators;

      review.decision =
        decision;

      review.status =
        decision ===
        "cleared"
          ? "cleared"
          : decision ===
            "blocked"
            ? "blocked"
            : "human_review";

      review.recommendations =
        buildRecommendations({
          sensitive,
          commercial,
          sourceProtection,
          conflict,
          external,
          ai
        });

      review.metadata = {
        ...review.metadata,

        signals: {
          sensitive,
          commercial,
          sourceProtection,
          conflict,
          external
        },

        ai
      };

      review.updatedAt =
        now();

      await saveDecision(
        review,
        {
          decision,
          reason
        },
        input.reviewerId
      );

      await saveAudit(
        review,
        "ethics_review_completed",
        input.reviewerId
      );

      await query(
        `
        INSERT INTO ez_ethics_reviews
        (
          id,
          content_id,
          story_id,
          reviewer_id,
          status,
          decision,
          ethics_score,
          risk_score,
          categories,
          indicators,
          recommendations,
          metadata,
          created_at,
          updated_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14
        )
        `,
        [
          review.id,
          review.contentId,
          review.storyId,
          review.reviewerId,
          review.status,
          review.decision,
          review.ethicsScore,
          review.riskScore,
          JSON.stringify(
            review.categories
          ),
          JSON.stringify(
            review.indicators
          ),
          JSON.stringify(
            review.recommendations
          ),
          JSON.stringify(
            review.metadata
          ),
          review.createdAt,
          review.updatedAt
        ]
      );

      state.statistics
        .reviewsCompleted++;

      if (
        decision ===
        "cleared"
      ) {
        state.statistics
          .cleared++;
      }

      if (
        decision ===
        "human_review"
      ) {
        state.statistics
          .humanReviews++;
      }

      if (
        decision ===
        "blocked"
      ) {
        state.statistics
          .blocked++;
      }

      if (
        decision !==
        "cleared"
      ) {
        await createAlert({
          contentId:
            review.contentId,

          type:
            "ethics_review_required",

          severity:
            decision ===
            "blocked"
              ? "critical"
              : "warning",

          message:
            reason,

          metadata: {
            reviewId:
              review.id,

            riskScore,
            ethicsScore
          }
        });
      }

      emit(
        "ethics.review.completed",
        clone(review)
      );

      return clone(review);
    } catch (error) {
      review.status =
        "failed";

      review.updatedAt =
        now();

      throw error;
    }
  }

  /*
   * ============================================================
   * RECOMMENDATIONS
   * ============================================================
   */

  function buildRecommendations(
    data
  ) {
    const result = [];

    if (
      data.sensitive.score >=
      sensitiveThreshold
    ) {
      result.push(
        "إجراء مراجعة بشرية للمحتوى الحساس قبل النشر"
      );
    }

    if (
      data.commercial.risk >=
      50
    ) {
      result.push(
        "إظهار بوضوح ما إذا كان المحتوى إعلاناً أو رعاية"
      );
    }

    if (
      data.sourceProtection.risk >=
      50
    ) {
      result.push(
        "حماية هوية المصدر وعدم كشفها دون مبرر"
      );
    }

    if (
      data.conflict.score >=
      conflictThreshold
    ) {
      result.push(
        "إعادة تقييم تعيين الشخص للمادة بسبب احتمال تضارب المصالح"
      );
    }

    if (
      data.external.verificationRisk >
      0
    ) {
      result.push(
        "التأكد من اكتمال التحقق قبل النشر"
      );
    }

    if (
      data.ai &&
      Array.isArray(
        data.ai.recommendations
      )
    ) {
      result.push(
        ...data.ai.recommendations
      );
    }

    if (!result.length) {
      result.push(
        "لا توجد مؤشرات أخلاقية حرجة وفق البيانات المتاحة"
      );
    }

    return [
      ...new Set(result)
    ];
  }

  /*
   * ============================================================
   * HUMAN DECISIONS
   * ============================================================
   */

  async function approveReview(
    reviewId,
    input = {}
  ) {
    const review =
      state.reviews.get(
        reviewId
      );

    if (!review) {
      throw new Error(
        "Ethics review not found"
      );
    }

    const previous =
      clone(review);

    review.decision =
      "approved_by_human";

    review.status =
      "cleared";

    review.reviewerId =
      input.reviewerId ||
      review.reviewerId;

    review.updatedAt =
      now();

    await saveDecision(
      review,
      {
        decision:
          "approved_by_human",

        reason:
          input.reason ||
          "تم اعتماد المحتوى بعد المراجعة البشرية"
      },
      review.reviewerId
    );

    await saveAudit(
      review,
      "human_approved",
      review.reviewerId,
      previous
    );

    emit(
      "ethics.human.approved",
      clone(review)
    );

    return clone(review);
  }

  async function rejectReview(
    reviewId,
    input = {}
  ) {
    const review =
      state.reviews.get(
        reviewId
      );

    if (!review) {
      throw new Error(
        "Ethics review not found"
      );
    }

    const previous =
      clone(review);

    review.decision =
      "rejected_by_human";

    review.status =
      "blocked";

    review.reviewerId =
      input.reviewerId ||
      review.reviewerId;

    review.updatedAt =
      now();

    await saveDecision(
      review,
      {
        decision:
          "rejected_by_human",

        reason:
          input.reason ||
          "تم رفض المحتوى بعد المراجعة البشرية"
      },
      review.reviewerId
    );

    await saveAudit(
      review,
      "human_rejected",
      review.reviewerId,
      previous
    );

    emit(
      "ethics.human.rejected",
      clone(review)
    );

    return clone(review);
  }

  /*
   * ============================================================
   * CORRECTIONS
   * ============================================================
   */

  async function createCorrection(
    input = {}
  ) {
    if (
      state.corrections.size >=
      maxCorrections
    ) {
      throw new Error(
        "Maximum corrections reached"
      );
    }

    if (!input.contentId) {
      throw new Error(
        "contentId is required"
      );
    }

    const correction = {
      id:
        id("correction"),

      contentId:
        input.contentId,

      storyId:
        input.storyId ||
        null,

      correctionType:
        input.correctionType ||
        "editorial",

      originalText:
        input.originalText ||
        "",

      correctedText:
        input.correctedText ||
        "",

      reason:
        input.reason ||
        "",

      status:
        "pending",

      approvedBy:
        null,

      publishedAt:
        null,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.corrections.set(
      correction.id,
      correction
    );

    state.statistics
      .correctionsCreated++;

    await query(
      `
      INSERT INTO ez_ethics_corrections
      (
        id,
        content_id,
        story_id,
        correction_type,
        original_text,
        corrected_text,
        reason,
        status,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        correction.id,
        correction.contentId,
        correction.storyId,
        correction.correctionType,
        correction.originalText,
        correction.correctedText,
        correction.reason,
        correction.status,
        JSON.stringify(
          correction.metadata
        ),
        correction.createdAt
      ]
    );

    emit(
      "ethics.correction.created",
      clone(correction)
    );

    return clone(correction);
  }

  async function approveCorrection(
    correctionId,
    input = {}
  ) {
    const correction =
      state.corrections.get(
        correctionId
      );

    if (!correction) {
      throw new Error(
        "Correction not found"
      );
    }

    correction.status =
      "approved";

    correction.approvedBy =
      input.reviewerId ||
      null;

    await query(
      `
      UPDATE ez_ethics_corrections
      SET
        status = $1,
        approved_by = $2
      WHERE id = $3
      `,
      [
        correction.status,
        correction.approvedBy,
        correction.id
      ]
    );

    return clone(correction);
  }

  function getCorrections(
    filters = {}
  ) {
    let records =
      Array.from(
        state.corrections.values()
      );

    if (filters.contentId) {
      records = records.filter(
        item =>
          item.contentId ===
          filters.contentId
      );
    }

    if (filters.status) {
      records = records.filter(
        item =>
          item.status ===
          filters.status
      );
    }

    return records.map(clone);
  }

  /*
   * ============================================================
   * DECISIONS
   * ============================================================
   */

  async function saveDecision(
    review,
    decision,
    reviewerId = null
  ) {
    const record = {
      id:
        id("ethics_decision"),

      reviewId:
        review.id,

      decision:
        decision.decision,

      score:
        review.ethicsScore,

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
      INSERT INTO ez_ethics_decisions
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
   * AUDIT
   * ============================================================
   */

  async function saveAudit(
    review,
    action,
    actorId = null,
    previousState = {}
  ) {
    const record = {
      id:
        id("ethics_audit"),

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
      record.id,
      record
    );

    await query(
      `
      INSERT INTO ez_ethics_audits
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
        record.id,
        record.reviewId,
        record.action,
        record.actorId,
        JSON.stringify(
          record.previousState
        ),
        JSON.stringify(
          record.newState
        ),
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
   * ALERTS
   * ============================================================
   */

  async function createAlert(
    input = {}
  ) {
    if (
      state.alerts.size >=
      maxAlerts
    ) {
      return null;
    }

    const alert = {
      id:
        id("ethics_alert"),

      contentId:
        input.contentId ||
        null,

      type:
        input.type ||
        "ethics",

      severity:
        input.severity ||
        "warning",

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
      INSERT INTO ez_ethics_alerts
      (
        id,
        content_id,
        type,
        severity,
        message,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        alert.id,
        alert.contentId,
        alert.type,
        alert.severity,
        alert.message,
        JSON.stringify(
          alert.metadata
        ),
        alert.createdAt
      ]
    );

    emit(
      "ethics.alert",
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
   * DATA ACCESS
   * ============================================================
   */

  function getReviews(
    filters = {}
  ) {
    let records =
      Array.from(
        state.reviews.values()
      );

    if (filters.contentId) {
      records = records.filter(
        item =>
          item.contentId ===
          filters.contentId
      );
    }

    if (filters.decision) {
      records = records.filter(
        item =>
          item.decision ===
          filters.decision
      );
    }

    if (filters.status) {
      records = records.filter(
        item =>
          item.status ===
          filters.status
      );
    }

    return records.map(clone);
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

  function getConflicts() {
    return Array.from(
      state.conflicts.values()
    ).map(clone);
  }

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalPolicies:
        state.policies.size,

      totalReviews:
        state.reviews.size,

      totalConflicts:
        state.conflicts.size,

      totalCorrections:
        state.corrections.size,

      totalAlerts:
        state.alerts.size,

      totalDecisions:
        state.decisions.size,

      totalAudits:
        state.audits.size
    };
  }

  function getDashboard() {
    const reviews =
      Array.from(
        state.reviews.values()
      );

    return {
      reviews: {
        total:
          reviews.length,

        cleared:
          reviews.filter(
            item =>
              item.status ===
              "cleared"
          ).length,

        humanReview:
          reviews.filter(
            item =>
              item.decision ===
              "human_review"
          ).length,

        blocked:
          reviews.filter(
            item =>
              item.status ===
              "blocked"
          ).length
      },

      conflicts:
        getConflicts()
          .slice(0, 20),

      corrections:
        getCorrections()
          .slice(0, 20),

      alerts:
        getAlerts()
          .slice(0, 20),

      statistics:
        getStatistics()
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Media Ethics & Editorial Governance Engine",

      code:
        "CODE95",

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

        editorial:
          Boolean(
            editorialEngine
          ),

        quality:
          Boolean(
            qualityEngine
          ),

        legalRights:
          Boolean(
            legalRightsEngine
          ),

        verification:
          Boolean(
            verificationEngine
          ),

        sourceIntelligence:
          Boolean(
            sourceIntelligence
          ),

        publishing:
          Boolean(
            publishingEngine
          ),

        workflow:
          Boolean(
            workflowEngine
          ),

        security:
          Boolean(
            securityEngine
          )
      },

      thresholds: {
        autoClearScore,
        humanReviewScore,
        blockScore,
        conflictThreshold,
        sensitiveThreshold
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running = true;

    emit(
      "ethics.started",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  function stop() {
    state.running = false;

    emit(
      "ethics.stopped",
      {
        timestamp: now()
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

    approveReview,
    rejectReview,

    createConflict,
    getConflicts,

    createCorrection,
    approveCorrection,
    getCorrections,

    createAlert,
    getAlerts
  };
}

module.exports = {
  createIntelligentMediaEthicsGovernanceEngine
};
