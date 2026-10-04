"use strict";

const crypto = require("crypto");

function createIntelligentLegalRightsComplianceEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    qualityEngine = null,
    mediaForensicsEngine = null,
    mediaIntelligenceEngine = null,
    damEngine = null,
    documentEngine = null,
    securityEngine = null,
    editorialEngine = null,
    publishingEngine = null,
    workflowEngine = null,
    automationEngine = null,
    communicationEngine = null,
    notificationService = null,
    eventBus = null,

    logger = console,

    maxRights = Number(
      process.env.LEGAL_MAX_RIGHTS || 500000
    ),

    maxLicenses = Number(
      process.env.LEGAL_MAX_LICENSES || 200000
    ),

    maxClaims = Number(
      process.env.LEGAL_MAX_CLAIMS || 500000
    ),

    maxCases = Number(
      process.env.LEGAL_MAX_CASES || 100000
    ),

    maxAlerts = Number(
      process.env.LEGAL_MAX_ALERTS || 100000
    ),

    autoClearScore = Number(
      process.env.LEGAL_AUTO_CLEAR_SCORE || 90
    ),

    reviewScore = Number(
      process.env.LEGAL_HUMAN_REVIEW_SCORE || 70
    ),

    blockScore = Number(
      process.env.LEGAL_BLOCK_SCORE || 50
    ),

    expiryWarningDays = Number(
      process.env.LEGAL_EXPIRY_WARNING_DAYS || 30
    ),

    privacyRiskThreshold = Number(
      process.env.LEGAL_PRIVACY_RISK_THRESHOLD || 70
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    rights: new Map(),
    licenses: new Map(),
    claims: new Map(),
    cases: new Map(),
    alerts: new Map(),
    decisions: new Map(),
    audits: new Map(),

    statistics: {
      rightsCreated: 0,
      licensesCreated: 0,
      claimsCreated: 0,
      casesCreated: 0,
      reviewsCompleted: 0,
      autoCleared: 0,
      humanReviews: 0,
      blocked: 0,
      expiredLicenses: 0,
      expiringLicenses: 0,
      privacyRisks: 0,
      copyrightRisks: 0,
      legalAlerts: 0
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
        "[CODE94] Event error:",
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
      CREATE TABLE IF NOT EXISTS ez_legal_rights (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        content_id TEXT,
        owner_name TEXT,
        owner_type TEXT,
        rights_type TEXT,
        status TEXT DEFAULT 'unknown',
        territory TEXT,
        permitted_uses JSONB DEFAULT '[]'::jsonb,
        prohibited_uses JSONB DEFAULT '[]'::jsonb,
        attribution_required BOOLEAN DEFAULT FALSE,
        commercial_use_allowed BOOLEAN DEFAULT FALSE,
        modification_allowed BOOLEAN DEFAULT FALSE,
        redistribution_allowed BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_legal_licenses (
        id TEXT PRIMARY KEY,
        right_id TEXT,
        asset_id TEXT,
        license_type TEXT,
        licensor TEXT,
        licensee TEXT,
        territory TEXT,
        starts_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        permitted_uses JSONB DEFAULT '[]'::jsonb,
        conditions JSONB DEFAULT '[]'::jsonb,
        document_id TEXT,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_legal_claims (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        asset_id TEXT,
        claimant TEXT,
        claim_type TEXT,
        status TEXT DEFAULT 'open',
        severity TEXT DEFAULT 'medium',
        description TEXT,
        evidence JSONB DEFAULT '{}'::jsonb,
        resolution TEXT,
        resolved_by TEXT,
        resolved_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_legal_cases (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        asset_id TEXT,
        case_type TEXT,
        status TEXT DEFAULT 'open',
        severity TEXT DEFAULT 'medium',
        risk_score NUMERIC DEFAULT 0,
        decision TEXT DEFAULT 'pending',
        description TEXT,
        recommendations JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_legal_alerts (
        id TEXT PRIMARY KEY,
        content_id TEXT,
        asset_id TEXT,
        type TEXT,
        severity TEXT DEFAULT 'warning',
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_legal_decisions (
        id TEXT PRIMARY KEY,
        case_id TEXT,
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
      CREATE TABLE IF NOT EXISTS ez_legal_audits (
        id TEXT PRIMARY KEY,
        case_id TEXT,
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
      idx_legal_rights_asset
      ON ez_legal_rights(asset_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_legal_licenses_asset
      ON ez_legal_licenses(asset_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_legal_cases_content
      ON ez_legal_cases(content_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_legal_claims_content
      ON ez_legal_claims(content_id)
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

    state.initialized = true;

    emit("legal.initialized", {
      timestamp: now()
    });

    return getStatus();
  }

  /*
   * ============================================================
   * RIGHTS
   * ============================================================
   */

  async function createRight(input = {}) {
    if (state.rights.size >= maxRights) {
      throw new Error(
        "Maximum rights records reached"
      );
    }

    const record = {
      id: id("right"),

      assetId:
        input.assetId || null,

      contentId:
        input.contentId || null,

      ownerName:
        input.ownerName || null,

      ownerType:
        input.ownerType || "unknown",

      rightsType:
        input.rightsType ||
        "copyright",

      status:
        input.status || "unknown",

      territory:
        input.territory || "global",

      permittedUses:
        Array.isArray(input.permittedUses)
          ? input.permittedUses
          : [],

      prohibitedUses:
        Array.isArray(input.prohibitedUses)
          ? input.prohibitedUses
          : [],

      attributionRequired:
        input.attributionRequired === true,

      commercialUseAllowed:
        input.commercialUseAllowed === true,

      modificationAllowed:
        input.modificationAllowed === true,

      redistributionAllowed:
        input.redistributionAllowed === true,

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.rights.set(record.id, record);

    state.statistics.rightsCreated++;

    await query(
      `
      INSERT INTO ez_legal_rights
      (
        id,
        asset_id,
        content_id,
        owner_name,
        owner_type,
        rights_type,
        status,
        territory,
        permitted_uses,
        prohibited_uses,
        attribution_required,
        commercial_use_allowed,
        modification_allowed,
        redistribution_allowed,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16,$17
      )
      `,
      [
        record.id,
        record.assetId,
        record.contentId,
        record.ownerName,
        record.ownerType,
        record.rightsType,
        record.status,
        record.territory,
        JSON.stringify(record.permittedUses),
        JSON.stringify(record.prohibitedUses),
        record.attributionRequired,
        record.commercialUseAllowed,
        record.modificationAllowed,
        record.redistributionAllowed,
        JSON.stringify(record.metadata),
        record.createdAt,
        record.updatedAt
      ]
    );

    return clone(record);
  }

  function getRights(filters = {}) {
    let records =
      Array.from(state.rights.values());

    if (filters.assetId) {
      records = records.filter(
        item =>
          item.assetId === filters.assetId
      );
    }

    if (filters.contentId) {
      records = records.filter(
        item =>
          item.contentId === filters.contentId
      );
    }

    if (filters.status) {
      records = records.filter(
        item =>
          item.status === filters.status
      );
    }

    return records.map(clone);
  }

  /*
   * ============================================================
   * LICENSES
   * ============================================================
   */

  async function createLicense(input = {}) {
    if (
      state.licenses.size >=
      maxLicenses
    ) {
      throw new Error(
        "Maximum licenses reached"
      );
    }

    const license = {
      id: id("license"),

      rightId:
        input.rightId || null,

      assetId:
        input.assetId || null,

      licenseType:
        input.licenseType || "unknown",

      licensor:
        input.licensor || null,

      licensee:
        input.licensee || null,

      territory:
        input.territory || "global",

      startsAt:
        input.startsAt || now(),

      expiresAt:
        input.expiresAt || null,

      permittedUses:
        Array.isArray(input.permittedUses)
          ? input.permittedUses
          : [],

      conditions:
        Array.isArray(input.conditions)
          ? input.conditions
          : [],

      documentId:
        input.documentId || null,

      status:
        input.status || "active",

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.licenses.set(
      license.id,
      license
    );

    state.statistics.licensesCreated++;

    await query(
      `
      INSERT INTO ez_legal_licenses
      (
        id,
        right_id,
        asset_id,
        license_type,
        licensor,
        licensee,
        territory,
        starts_at,
        expires_at,
        permitted_uses,
        conditions,
        document_id,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16
      )
      `,
      [
        license.id,
        license.rightId,
        license.assetId,
        license.licenseType,
        license.licensor,
        license.licensee,
        license.territory,
        license.startsAt,
        license.expiresAt,
        JSON.stringify(
          license.permittedUses
        ),
        JSON.stringify(
          license.conditions
        ),
        license.documentId,
        license.status,
        JSON.stringify(
          license.metadata
        ),
        license.createdAt,
        license.updatedAt
      ]
    );

    return clone(license);
  }

  function licenseStatus(license) {
    if (!license.expiresAt) {
      return "active";
    }

    const expiry =
      new Date(
        license.expiresAt
      ).getTime();

    const current =
      Date.now();

    if (expiry <= current) {
      return "expired";
    }

    const warning =
      expiry -
      current <=
      expiryWarningDays *
        24 *
        60 *
        60 *
        1000;

    if (warning) {
      return "expiring_soon";
    }

    return "active";
  }

  function getLicenses(filters = {}) {
    let records =
      Array.from(
        state.licenses.values()
      );

    records = records.map(item => ({
      ...item,
      calculatedStatus:
        licenseStatus(item)
    }));

    if (filters.assetId) {
      records = records.filter(
        item =>
          item.assetId ===
          filters.assetId
      );
    }

    if (filters.status) {
      records = records.filter(
        item =>
          item.calculatedStatus ===
          filters.status
      );
    }

    return records.map(clone);
  }

  /*
   * ============================================================
   * CLAIMS
   * ============================================================
   */

  async function createClaim(input = {}) {
    if (
      state.claims.size >=
      maxClaims
    ) {
      throw new Error(
        "Maximum claims reached"
      );
    }

    const claim = {
      id: id("claim"),

      contentId:
        input.contentId || null,

      assetId:
        input.assetId || null,

      claimant:
        input.claimant || null,

      claimType:
        input.claimType ||
        "copyright",

      status:
        input.status || "open",

      severity:
        input.severity || "medium",

      description:
        input.description || "",

      evidence:
        input.evidence || {},

      resolution:
        null,

      resolvedBy:
        null,

      resolvedAt:
        null,

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.claims.set(
      claim.id,
      claim
    );

    state.statistics.claimsCreated++;

    await query(
      `
      INSERT INTO ez_legal_claims
      (
        id,
        content_id,
        asset_id,
        claimant,
        claim_type,
        status,
        severity,
        description,
        evidence,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12
      )
      `,
      [
        claim.id,
        claim.contentId,
        claim.assetId,
        claim.claimant,
        claim.claimType,
        claim.status,
        claim.severity,
        claim.description,
        JSON.stringify(
          claim.evidence
        ),
        JSON.stringify(
          claim.metadata
        ),
        claim.createdAt,
        claim.updatedAt
      ]
    );

    return clone(claim);
  }

  function getClaims(filters = {}) {
    let records =
      Array.from(
        state.claims.values()
      );

    if (filters.contentId) {
      records = records.filter(
        item =>
          item.contentId ===
          filters.contentId
      );
    }

    if (filters.assetId) {
      records = records.filter(
        item =>
          item.assetId ===
          filters.assetId
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
   * PRIVACY / LEGAL SIGNALS
   * ============================================================
   */

  function detectPrivacyRisk(
    content = {}
  ) {
    const text = String(
      content.text ||
      content.body ||
      ""
    );

    let score = 0;
    const indicators = [];

    /*
     * لا تعتبر هذه الأنماط إثباتاً قانونياً.
     * هي مجرد إشارات تستدعي المراجعة.
     */

    const patterns = [
      {
        type: "phone",
        regex:
          /(?:\+?966|05)\d{8}/g
      },

      {
        type: "email",
        regex:
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
      },

      {
        type: "national_id_like",
        regex:
          /\b[12]\d{9}\b/g
      }
    ];

    for (const item of patterns) {
      const matches =
        text.match(item.regex);

      if (matches?.length) {
        score +=
          item.type ===
          "national_id_like"
            ? 40
            : 20;

        indicators.push({
          type: item.type,
          count: matches.length
        });
      }
    }

    return {
      score: Math.min(100, score),
      indicators
    };
  }

  function detectCopyrightRisk(
    content = {}
  ) {
    const signals = [];

    if (
      content.copyrightOwner
    ) {
      signals.push(
        "copyright_owner_present"
      );
    }

    if (
      content.licenseRequired === true
    ) {
      signals.push(
        "license_required"
      );
    }

    if (
      content.licenseId
    ) {
      signals.push(
        "license_reference_present"
      );
    }

    if (
      content.attributionRequired === true
    ) {
      signals.push(
        "attribution_required"
      );
    }

    if (
      content.rightsStatus ===
      "unknown"
    ) {
      signals.push(
        "rights_unknown"
      );
    }

    let score = 0;

    if (
      signals.includes(
        "rights_unknown"
      )
    ) {
      score += 60;
    }

    if (
      signals.includes(
        "license_required"
      ) &&
      !signals.includes(
        "license_reference_present"
      )
    ) {
      score += 30;
    }

    return {
      score: Math.min(100, score),
      signals
    };
  }

  /*
   * ============================================================
   * AI LEGAL RISK ANALYSIS
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
        "حلل مخاطر الحقوق والامتثال القانوني للمحتوى الإعلامي. لا تقدم رأياً قانونياً نهائياً. حدد فقط مؤشرات الخطر والتوصيات والحاجة إلى مراجعة بشرية مختصة."
    };

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        return await aiOrchestrator.process({
          operation:
            "legal-rights-compliance",

          input,

          metadata: {
            source:
              "CODE94"
          }
        });
      } catch (error) {
        logger.warn(
          "[CODE94] AI orchestrator:",
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
          "[CODE94] AI core:",
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

  async function collectSignals(
    content = {}
  ) {
    const privacy =
      detectPrivacyRisk(
        content
      );

    const copyright =
      detectCopyrightRisk(
        content
      );

    let mediaRisk = 0;

    if (
      mediaForensicsEngine &&
      content.media
    ) {
      try {
        const result =
          await mediaForensicsEngine.analyze(
            content.media
          );

        mediaRisk = Number(
          result?.riskScore ||
          result?.score ||
          0
        );
      } catch (error) {
        logger.warn(
          "[CODE94] Media forensics:",
          error.message
        );
      }
    }

    return {
      privacyRisk:
        privacy.score,

      privacyIndicators:
        privacy.indicators,

      copyrightRisk:
        copyright.score,

      copyrightSignals:
        copyright.signals,

      mediaRisk
    };
  }

  /*
   * ============================================================
   * LICENSE CHECK
   * ============================================================
   */

  function checkAssetLicenses(
    assetId
  ) {
    const licenses =
      getLicenses({
        assetId
      });

    if (!licenses.length) {
      return {
        status:
          "no_license_found",

        score: 0,

        licenses: []
      };
    }

    const valid =
      licenses.filter(
        item =>
          item.calculatedStatus ===
          "active"
      );

    const expiring =
      licenses.filter(
        item =>
          item.calculatedStatus ===
          "expiring_soon"
      );

    const expired =
      licenses.filter(
        item =>
          item.calculatedStatus ===
          "expired"
      );

    if (valid.length) {
      return {
        status:
          expiring.length
            ? "expiring_soon"
            : "active",

        score:
          expiring.length
            ? 75
            : 100,

        licenses
      };
    }

    if (expired.length) {
      return {
        status:
          "expired",

        score: 0,

        licenses
      };
    }

    return {
      status:
        "unknown",

      score: 0,

      licenses
    };
  }

  /*
   * ============================================================
   * DECISION
   * ============================================================
   */

  function determineDecision(
    result
  ) {
    if (
      result.privacyRisk >=
      privacyRiskThreshold
    ) {
      return {
        decision:
          "human_review",

        reason:
          "اكتشاف مؤشرات خصوصية مرتفعة تتطلب مراجعة بشرية"
      };
    }

    if (
      result.copyrightRisk >=
      80
    ) {
      return {
        decision:
          "blocked",

        reason:
          "مخاطر حقوق نشر مرتفعة"
      };
    }

    if (
      result.licenseStatus ===
      "expired"
    ) {
      return {
        decision:
          "blocked",

        reason:
          "انتهاء الترخيص"
      };
    }

    if (
      result.licenseStatus ===
      "no_license_found" &&
      result.copyrightRisk >=
      50
    ) {
      return {
        decision:
          "human_review",

        reason:
          "حقوق الاستخدام غير مكتملة"
      };
    }

    if (
      result.overallScore >=
      autoClearScore &&
      result.privacyRisk <
        privacyRiskThreshold &&
      result.copyrightRisk <
        50 &&
      result.mediaRisk <
        50
    ) {
      return {
        decision:
          "cleared",

        reason:
          "المؤشرات الحالية تسمح بالمرور إلى طبقة الجودة والنشر"
      };
    }

    if (
      result.overallScore >=
      reviewScore
    ) {
      return {
        decision:
          "human_review",

        reason:
          "المحتوى يحتاج مراجعة حقوق وامتثال"
      };
    }

    if (
      result.overallScore <
      blockScore
    ) {
      return {
        decision:
          "blocked",

        reason:
          "مستوى الامتثال منخفض"
      };
    }

    return {
      decision:
        "human_review",

      reason:
        "المؤشرات غير كافية للمرور الآلي"
    };
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
      state.cases.size >=
      maxCases
    ) {
      throw new Error(
        "Maximum legal cases reached"
      );
    }

    if (!input.contentId) {
      throw new Error(
        "contentId is required"
      );
    }

    const content =
      input.content || {};

    const caseRecord = {
      id:
        id("legal_case"),

      contentId:
        input.contentId,

      assetId:
        input.assetId || null,

      caseType:
        input.caseType ||
        "pre_publish_compliance",

      status:
        "processing",

      severity:
        "medium",

      riskScore:
        0,

      decision:
        "pending",

      description:
        "",

      recommendations:
        [],

      metadata:
        input.metadata || {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.cases.set(
      caseRecord.id,
      caseRecord
    );

    state.statistics.casesCreated++;

    try {
      const signals =
        await collectSignals(
          content
        );

      const license =
        input.assetId
          ? checkAssetLicenses(
              input.assetId
            )
          : {
              status:
                content.licenseStatus ||
                "unknown",

              score:
                content.licenseScore ||
                0,

              licenses: []
            };

      if (
        license.status ===
        "expired"
      ) {
        state.statistics
          .expiredLicenses++;
      }

      if (
        license.status ===
        "expiring_soon"
      ) {
        state.statistics
          .expiringLicenses++;
      }

      if (
        signals.privacyRisk >=
        privacyRiskThreshold
      ) {
        state.statistics
          .privacyRisks++;
      }

      if (
        signals.copyrightRisk >=
        50
      ) {
        state.statistics
          .copyrightRisks++;
      }

      const aiAnalysis =
        await analyzeWithAI(
          content,
          {
            ...signals,
            license
          }
        );

      const baseScore =
        Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (
                (
                  100 -
                  signals.privacyRisk
                ) *
                  0.25 +

                (
                  100 -
                  signals.copyrightRisk
                ) *
                  0.30 +

                license.score *
                  0.25 +

                (
                  100 -
                  signals.mediaRisk
                ) *
                  0.20
              )
            )
          )
        );

      const decision =
        determineDecision({
          overallScore:
            baseScore,

          privacyRisk:
            signals.privacyRisk,

          copyrightRisk:
            signals.copyrightRisk,

          mediaRisk:
            signals.mediaRisk,

          licenseStatus:
            license.status
        });

      caseRecord.riskScore =
        Math.round(
          (
            signals.privacyRisk *
              0.30 +

            signals.copyrightRisk *
              0.35 +

            signals.mediaRisk *
              0.20 +

            (
              100 -
              license.score
            ) *
              0.15
          ) * 100
        ) / 100;

      caseRecord.decision =
        decision.decision;

      caseRecord.status =
        decision.decision ===
        "cleared"
          ? "cleared"
          : decision.decision ===
            "blocked"
            ? "blocked"
            : "human_review";

      caseRecord.description =
        decision.reason;

      caseRecord.recommendations =
        buildRecommendations({
          signals,
          license,
          decision,
          aiAnalysis
        });

      caseRecord.metadata = {
        ...caseRecord.metadata,

        signals,
        license,
        aiAnalysis
      };

      caseRecord.updatedAt =
        now();

      await saveDecision(
        caseRecord,
        decision,
        input.reviewerId ||
          null
      );

      await saveAudit(
        caseRecord,
        "legal_review_completed",
        input.reviewerId ||
          null
      );

      await query(
        `
        INSERT INTO ez_legal_cases
        (
          id,
          content_id,
          asset_id,
          case_type,
          status,
          severity,
          risk_score,
          decision,
          description,
          recommendations,
          metadata,
          created_at,
          updated_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12,$13
        )
        `,
        [
          caseRecord.id,
          caseRecord.contentId,
          caseRecord.assetId,
          caseRecord.caseType,
          caseRecord.status,
          caseRecord.severity,
          caseRecord.riskScore,
          caseRecord.decision,
          caseRecord.description,
          JSON.stringify(
            caseRecord.recommendations
          ),
          JSON.stringify(
            caseRecord.metadata
          ),
          caseRecord.createdAt,
          caseRecord.updatedAt
        ]
      );

      state.statistics
        .reviewsCompleted++;

      if (
        caseRecord.decision ===
        "cleared"
      ) {
        state.statistics
          .autoCleared++;
      }

      if (
        caseRecord.decision ===
        "human_review"
      ) {
        state.statistics
          .humanReviews++;
      }

      if (
        caseRecord.decision ===
        "blocked"
      ) {
        state.statistics
          .blocked++;
      }

      if (
        caseRecord.decision ===
          "human_review" ||
        caseRecord.decision ===
          "blocked"
      ) {
        await createAlert({
          contentId:
            caseRecord.contentId,

          assetId:
            caseRecord.assetId,

          type:
            "legal_review_required",

          severity:
            caseRecord.decision ===
            "blocked"
              ? "critical"
              : "warning",

          message:
            decision.reason,

          metadata: {
            caseId:
              caseRecord.id
          }
        });
      }

      emit(
        "legal.review.completed",
        clone(caseRecord)
      );

      return clone(caseRecord);
    } catch (error) {
      caseRecord.status =
        "failed";

      caseRecord.updatedAt =
        now();

      await saveAudit(
        caseRecord,
        "legal_review_failed",
        input.reviewerId ||
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
    data
  ) {
    const result = [];

    if (
      data.signals.privacyRisk >=
      privacyRiskThreshold
    ) {
      result.push(
        "مراجعة البيانات الشخصية قبل النشر وإزالة أو طمس البيانات غير الضرورية"
      );
    }

    if (
      data.signals.copyrightRisk >=
      50
    ) {
      result.push(
        "التحقق من مالك الحقوق وترخيص الاستخدام"
      );
    }

    if (
      data.license.status ===
      "no_license_found"
    ) {
      result.push(
        "إضافة سجل ترخيص أو إثبات حق استخدام المادة"
      );
    }

    if (
      data.license.status ===
      "expiring_soon"
    ) {
      result.push(
        "تجديد الترخيص قبل انتهاء صلاحيته"
      );
    }

    if (
      data.license.status ===
      "expired"
    ) {
      result.push(
        "إيقاف استخدام المادة حتى الحصول على ترخيص ساري"
      );
    }

    if (
      data.signals.mediaRisk >=
      50
    ) {
      result.push(
        "إجراء فحص إضافي لمصدر الوسائط وسلامتها وحقوقها"
      );
    }

    if (
      data.aiAnalysis &&
      Array.isArray(
        data.aiAnalysis.recommendations
      )
    ) {
      result.push(
        ...data.aiAnalysis
          .recommendations
      );
    }

    if (!result.length) {
      result.push(
        "لا توجد مؤشرات حقوق حرجة وفق البيانات المتاحة"
      );
    }

    return [
      ...new Set(result)
    ];
  }

  /*
   * ============================================================
   * DECISIONS
   * ============================================================
   */

  async function saveDecision(
    caseRecord,
    decision,
    reviewerId = null
  ) {
    const record = {
      id:
        id("legal_decision"),

      caseId:
        caseRecord.id,

      decision:
        decision.decision,

      score:
        Math.max(
          0,
          100 -
            caseRecord.riskScore
        ),

      riskScore:
        caseRecord.riskScore,

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
      INSERT INTO ez_legal_decisions
      (
        id,
        case_id,
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
        record.caseId,
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

  async function approveCase(
    caseId,
    input = {}
  ) {
    const record =
      state.cases.get(caseId);

    if (!record) {
      throw new Error(
        "Legal case not found"
      );
    }

    const previous =
      clone(record);

    record.decision =
      "approved_by_human";

    record.status =
      "cleared";

    record.updatedAt =
      now();

    await saveDecision(
      record,
      {
        decision:
          "approved_by_human",

        reason:
          input.reason ||
          "تم اعتماد الحالة بواسطة المراجع البشري"
      },
      input.reviewerId ||
        null
    );

    await saveAudit(
      record,
      "human_approved",
      input.reviewerId ||
        null,
      previous
    );

    emit(
      "legal.human.approved",
      clone(record)
    );

    return clone(record);
  }

  async function blockCase(
    caseId,
    input = {}
  ) {
    const record =
      state.cases.get(caseId);

    if (!record) {
      throw new Error(
        "Legal case not found"
      );
    }

    const previous =
      clone(record);

    record.decision =
      "blocked_by_human";

    record.status =
      "blocked";

    record.updatedAt =
      now();

    await saveDecision(
      record,
      {
        decision:
          "blocked_by_human",

        reason:
          input.reason ||
          "تم منع الحالة بواسطة المراجع البشري"
      },
      input.reviewerId ||
        null
    );

    await saveAudit(
      record,
      "human_blocked",
      input.reviewerId ||
        null,
      previous
    );

    emit(
      "legal.human.blocked",
      clone(record)
    );

    return clone(record);
  }

  /*
   * ============================================================
   * CLAIM RESOLUTION
   * ============================================================
   */

  async function resolveClaim(
    claimId,
    input = {}
  ) {
    const claim =
      state.claims.get(
        claimId
      );

    if (!claim) {
      throw new Error(
        "Claim not found"
      );
    }

    claim.status =
      input.status ||
      "resolved";

    claim.resolution =
      input.resolution ||
      "";

    claim.resolvedBy =
      input.resolvedBy ||
      null;

    claim.resolvedAt =
      now();

    claim.updatedAt =
      now();

    await query(
      `
      UPDATE ez_legal_claims
      SET
        status = $1,
        resolution = $2,
        resolved_by = $3,
        resolved_at = $4,
        updated_at = $5
      WHERE id = $6
      `,
      [
        claim.status,
        claim.resolution,
        claim.resolvedBy,
        claim.resolvedAt,
        claim.updatedAt,
        claim.id
      ]
    );

    emit(
      "legal.claim.resolved",
      clone(claim)
    );

    return clone(claim);
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
        id("legal_alert"),

      contentId:
        input.contentId ||
        null,

      assetId:
        input.assetId ||
        null,

      type:
        input.type ||
        "legal",

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
      .legalAlerts++;

    await query(
      `
      INSERT INTO ez_legal_alerts
      (
        id,
        content_id,
        asset_id,
        type,
        severity,
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
        alert.contentId,
        alert.assetId,
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
      "legal.alert",
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
   * CASES
   * ============================================================
   */

  function getCases(filters = {}) {
    let records =
      Array.from(
        state.cases.values()
      );

    if (filters.contentId) {
      records = records.filter(
        item =>
          item.contentId ===
          filters.contentId
      );
    }

    if (filters.assetId) {
      records = records.filter(
        item =>
          item.assetId ===
          filters.assetId
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

  function getCase(caseId) {
    const record =
      state.cases.get(caseId);

    return record
      ? clone(record)
      : null;
  }

  /*
   * ============================================================
   * EXPIRY CHECK
   * ============================================================
   */

  async function checkLicenseExpiry() {
    const licenses =
      Array.from(
        state.licenses.values()
      );

    const results = [];

    for (const license of licenses) {
      const status =
        licenseStatus(license);

      if (
        status ===
        "expired"
      ) {
        state.statistics
          .expiredLicenses++;

        results.push({
          licenseId:
            license.id,

          status
        });

        await createAlert({
          assetId:
            license.assetId,

          type:
            "license_expired",

          severity:
            "critical",

          message:
            "انتهت صلاحية ترخيص المادة",

          metadata: {
            licenseId:
              license.id
          }
        });
      }

      if (
        status ===
        "expiring_soon"
      ) {
        results.push({
          licenseId:
            license.id,

          status
        });

        await createAlert({
          assetId:
            license.assetId,

          type:
            "license_expiring",

          severity:
            "warning",

          message:
            "اقترب انتهاء صلاحية ترخيص المادة",

          metadata: {
            licenseId:
              license.id
          }
        });
      }
    }

    return results;
  }

  /*
   * ============================================================
   * DASHBOARD / STATUS
   * ============================================================
   */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalRights:
        state.rights.size,

      totalLicenses:
        state.licenses.size,

      totalClaims:
        state.claims.size,

      totalCases:
        state.cases.size,

      totalAlerts:
        state.alerts.size,

      totalDecisions:
        state.decisions.size,

      totalAudits:
        state.audits.size
    };
  }

  function getDashboard() {
    const cases =
      Array.from(
        state.cases.values()
      );

    return {
      cases: {
        total:
          cases.length,

        cleared:
          cases.filter(
            item =>
              item.status ===
              "cleared"
          ).length,

        humanReview:
          cases.filter(
            item =>
              item.decision ===
              "human_review"
          ).length,

        blocked:
          cases.filter(
            item =>
              item.status ===
              "blocked"
          ).length
      },

      licenses: {
        total:
          state.licenses.size,

        expired:
          getLicenses({
            status:
              "expired"
          }).length,

        expiringSoon:
          getLicenses({
            status:
              "expiring_soon"
          }).length
      },

      claims:
        state.claims.size,

      alerts:
        getAlerts().slice(
          0,
          20
        ),

      statistics:
        getStatistics()
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Legal, Rights & Media Compliance Engine",

      code:
        "CODE94",

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

        quality:
          Boolean(
            qualityEngine
          ),

        mediaForensics:
          Boolean(
            mediaForensicsEngine
          ),

        mediaIntelligence:
          Boolean(
            mediaIntelligenceEngine
          ),

        dam:
          Boolean(
            damEngine
          ),

        documents:
          Boolean(
            documentEngine
          ),

        security:
          Boolean(
            securityEngine
          ),

        editorial:
          Boolean(
            editorialEngine
          ),

        publishing:
          Boolean(
            publishingEngine
          ),

        workflow:
          Boolean(
            workflowEngine
          ),

        automation:
          Boolean(
            automationEngine
          ),

        communication:
          Boolean(
            communicationEngine
          )
      },

      thresholds: {
        autoClearScore,
        reviewScore,
        blockScore,
        privacyRiskThreshold,
        expiryWarningDays
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    if (state.running) {
      return getStatus();
    }

    state.running = true;

    emit("legal.started", {
      timestamp: now()
    });

    return getStatus();
  }

  function stop() {
    state.running = false;

    emit("legal.stopped", {
      timestamp: now()
    });

    return getStatus();
  }

  return {
    initialize,
    start,
    stop,

    getStatus,
    getStatistics,
    getDashboard,

    createRight,
    getRights,

    createLicense,
    getLicenses,

    createClaim,
    getClaims,
    resolveClaim,

    reviewContent,
    getCases,
    getCase,

    approveCase,
    blockCase,

    createAlert,
    getAlerts,

    checkLicenseExpiry
  };
}

module.exports = {
  createIntelligentLegalRightsComplianceEngine
};
