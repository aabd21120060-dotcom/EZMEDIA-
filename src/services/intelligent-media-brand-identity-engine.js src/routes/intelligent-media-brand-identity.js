"use strict";

const crypto = require("crypto");

function createIntelligentMediaBrandIdentityEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    damEngine = null,
    videoEngine = null,
    editorialEngine = null,
    publishingEngine = null,
    workflowEngine = null,
    legalRightsEngine = null,
    qualityEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxBrands = Number(
      process.env.BRAND_MAX_BRANDS || 100
    ),

    maxAssets = Number(
      process.env.BRAND_MAX_ASSETS || 100000
    ),

    maxTemplates = Number(
      process.env.BRAND_MAX_TEMPLATES || 10000
    ),

    maxGuidelines = Number(
      process.env.BRAND_MAX_GUIDELINES || 1000
    ),

    maxChecks = Number(
      process.env.BRAND_MAX_CHECKS || 500000
    ),

    approvalThreshold = Number(
      process.env.BRAND_APPROVAL_THRESHOLD || 90
    ),

    reviewThreshold = Number(
      process.env.BRAND_REVIEW_THRESHOLD || 70
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    brands: new Map(),
    assets: new Map(),
    templates: new Map(),
    guidelines: new Map(),
    checks: new Map(),
    violations: new Map(),
    usage: new Map(),

    statistics: {
      brandsCreated: 0,
      assetsCreated: 0,
      templatesCreated: 0,
      guidelinesCreated: 0,
      checksCompleted: 0,
      approved: 0,
      humanReview: 0,
      rejected: 0,
      violations: 0
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
        "[CODE96] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_brand_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        primary_color TEXT,
        secondary_color TEXT,
        accent_color TEXT,
        background_color TEXT,
        text_color TEXT,
        logo_asset_id TEXT,
        typography JSONB DEFAULT '{}'::jsonb,
        visual_style JSONB DEFAULT '{}'::jsonb,
        voice JSONB DEFAULT '{}'::jsonb,
        rules JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_brand_assets (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT,
        storage_key TEXT,
        mime_type TEXT,
        variant TEXT,
        approved BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_brand_templates (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL,
        name TEXT NOT NULL,
        template_type TEXT NOT NULL,
        structure JSONB DEFAULT '{}'::jsonb,
        approved BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_brand_guidelines (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        rules JSONB DEFAULT '[]'::jsonb,
        severity TEXT DEFAULT 'medium',
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_brand_compliance_checks (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL,
        content_id TEXT,
        asset_id TEXT,
        template_id TEXT,
        score NUMERIC DEFAULT 0,
        decision TEXT DEFAULT 'human_review',
        violations JSONB DEFAULT '[]'::jsonb,
        recommendations JSONB DEFAULT '[]'::jsonb,
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_brand_usage (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL,
        asset_id TEXT,
        content_id TEXT,
        channel TEXT,
        action TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_brand_assets_brand
      ON ez_brand_assets(brand_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_brand_checks_brand
      ON ez_brand_compliance_checks(brand_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_brand_usage_brand
      ON ez_brand_usage(brand_id)
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

    await ensureDefaultEZMediaBrand();

    state.initialized = true;

    emit(
      "brand.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     DEFAULT EZ MEDIA BRAND
  ============================================================ */

  async function ensureDefaultEZMediaBrand() {
    const exists =
      Array.from(
        state.brands.values()
      ).some(
        brand =>
          brand.slug ===
          "ez-media"
      );

    if (exists) {
      return;
    }

    await createBrand(
      {
        name: "EZ MEDIA",
        slug: "ez-media",

        description:
          "الهوية الإعلامية المركزية لمنصة EZ MEDIA.",

        status: "active",

        primaryColor:
          "#EAF8FF",

        secondaryColor:
          "#D8F3FF",

        accentColor:
          "#65CFFF",

        backgroundColor:
          "#FFFFFF",

        textColor:
          "#123247",

        typography: {
          heading:
            "Modern Sans",

          body:
            "Modern Sans",

          weight:
            "600"
        },

        visualStyle: {
          direction:
            "futuristic",

          mood:
            "clean",

          technology:
            "modern",

          accessibility:
            "high",

          avoid: [
            "black",
            "dark-gray",
            "gold",
            "cartoon"
          ]
        },

        voice: {
          language:
            "ar",

          tone:
            "professional",

          style:
            "clear",

          credibility:
            "high"
        },

        rules: {
          requireLogo:
            true,

          requireReadableText:
            true,

          requireBrandColors:
            true,

          requireEditorialSeparation:
            true,

          requireAccessibility:
            true
        }
      },
      false
    );

    const brand =
      Array.from(
        state.brands.values()
      ).find(
        item =>
          item.slug ===
          "ez-media"
      );

    if (!brand) {
      return;
    }

    await seedDefaultGuidelines(
      brand.id
    );
  }

  /* ============================================================
     BRANDS
  ============================================================ */

  async function createBrand(
    input = {},
    count = true
  ) {
    if (
      state.brands.size >=
      maxBrands
    ) {
      throw new Error(
        "Maximum brands reached"
      );
    }

    const brand = {
      id:
        id("brand"),

      name:
        input.name ||
        "EZ MEDIA",

      slug:
        input.slug ||
        id("brand-slug"),

      description:
        input.description ||
        "",

      status:
        input.status ||
        "active",

      primaryColor:
        input.primaryColor ||
        "#EAF8FF",

      secondaryColor:
        input.secondaryColor ||
        "#D8F3FF",

      accentColor:
        input.accentColor ||
        "#65CFFF",

      backgroundColor:
        input.backgroundColor ||
        "#FFFFFF",

      textColor:
        input.textColor ||
        "#123247",

      logoAssetId:
        input.logoAssetId ||
        null,

      typography:
        input.typography ||
        {},

      visualStyle:
        input.visualStyle ||
        {},

      voice:
        input.voice ||
        {},

      rules:
        input.rules ||
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.brands.set(
      brand.id,
      brand
    );

    if (count) {
      state.statistics
        .brandsCreated++;
    }

    await query(
      `
      INSERT INTO ez_brand_profiles
      (
        id,
        name,
        slug,
        description,
        status,
        primary_color,
        secondary_color,
        accent_color,
        background_color,
        text_color,
        logo_asset_id,
        typography,
        visual_style,
        voice,
        rules,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18
      )
      ON CONFLICT (id)
      DO NOTHING
      `,
      [
        brand.id,
        brand.name,
        brand.slug,
        brand.description,
        brand.status,
        brand.primaryColor,
        brand.secondaryColor,
        brand.accentColor,
        brand.backgroundColor,
        brand.textColor,
        brand.logoAssetId,
        JSON.stringify(
          brand.typography
        ),
        JSON.stringify(
          brand.visualStyle
        ),
        JSON.stringify(
          brand.voice
        ),
        JSON.stringify(
          brand.rules
        ),
        JSON.stringify(
          brand.metadata
        ),
        brand.createdAt,
        brand.updatedAt
      ]
    );

    return clone(brand);
  }

  function getBrands() {
    return Array.from(
      state.brands.values()
    ).map(clone);
  }

  function getBrand(brandId) {
    const brand =
      state.brands.get(
        brandId
      );

    return brand
      ? clone(brand)
      : null;
  }

  function findBrand(
    identifier
  ) {
    return (
      Array.from(
        state.brands.values()
      ).find(
        brand =>
          brand.id ===
            identifier ||
          brand.slug ===
            identifier
      ) || null
    );
  }

  /* ============================================================
     GUIDELINES
  ============================================================ */

  async function seedDefaultGuidelines(
    brandId
  ) {
    const guidelines = [
      {
        category:
          "colors",

        title:
          "الألوان المعتمدة",

        rules: [
          "استخدام الأبيض والأزرق السماوي والجليدي",
          "عدم استخدام الأسود كلون رئيسي",
          "عدم استخدام الذهبي",
          "عدم استخدام الرمادي كلون هوية رئيسي"
        ],

        severity:
          "high"
      },

      {
        category:
          "typography",

        title:
          "سهولة القراءة",

        rules: [
          "وضوح النص",
          "تباين مناسب",
          "أحجام مناسبة للجوال",
          "عدم استخدام خطوط زخرفية صعبة القراءة"
        ],

        severity:
          "high"
      },

      {
        category:
          "logo",

        title:
          "استخدام الشعار",

        rules: [
          "عدم تشويه الشعار",
          "عدم تغيير نسب الشعار",
          "ترك مساحة حماية حول الشعار",
          "استخدام النسخة المعتمدة فقط"
        ],

        severity:
          "critical"
      },

      {
        category:
          "editorial",

        title:
          "الفصل التحريري",

        rules: [
          "عدم الخلط بين الخبر والإعلان",
          "تمييز الرعاية بوضوح",
          "عدم استخدام الهوية لإخفاء طبيعة الإعلان"
        ],

        severity:
          "critical"
      },

      {
        category:
          "accessibility",

        title:
          "إتاحة المحتوى",

        rules: [
          "نص قابل للقراءة",
          "تباين مناسب",
          "عدم الاعتماد على اللون وحده",
          "دعم الشاشات الصغيرة"
        ],

        severity:
          "high"
      }
    ];

    for (
      const guideline of guidelines
    ) {
      await createGuideline({
        brandId,
        ...guideline
      });
    }
  }

  async function createGuideline(
    input = {}
  ) {
    if (
      state.guidelines.size >=
      maxGuidelines
    ) {
      throw new Error(
        "Maximum guidelines reached"
      );
    }

    const guideline = {
      id:
        id("guideline"),

      brandId:
        input.brandId,

      category:
        input.category ||
        "general",

      title:
        input.title ||
        "Brand guideline",

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

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.guidelines.set(
      guideline.id,
      guideline
    );

    await query(
      `
      INSERT INTO ez_brand_guidelines
      (
        id,
        brand_id,
        category,
        title,
        rules,
        severity,
        enabled,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        guideline.id,
        guideline.brandId,
        guideline.category,
        guideline.title,
        JSON.stringify(
          guideline.rules
        ),
        guideline.severity,
        guideline.enabled,
        guideline.createdAt,
        guideline.updatedAt
      ]
    );

    state.statistics
      .guidelinesCreated++;

    return clone(guideline);
  }

  function getGuidelines(
    brandId
  ) {
    return Array.from(
      state.guidelines.values()
    )
      .filter(
        item =>
          !brandId ||
          item.brandId ===
            brandId
      )
      .map(clone);
  }

  /* ============================================================
     BRAND ASSETS
  ============================================================ */

  async function createAsset(
    input = {}
  ) {
    if (
      state.assets.size >=
      maxAssets
    ) {
      throw new Error(
        "Maximum brand assets reached"
      );
    }

    const asset = {
      id:
        id("brand_asset"),

      brandId:
        input.brandId,

      assetType:
        input.assetType ||
        "logo",

      name:
        input.name ||
        "Brand Asset",

      url:
        input.url ||
        null,

      storageKey:
        input.storageKey ||
        null,

      mimeType:
        input.mimeType ||
        null,

      variant:
        input.variant ||
        "default",

      approved:
        input.approved === true,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.assets.set(
      asset.id,
      asset
    );

    state.statistics
      .assetsCreated++;

    await query(
      `
      INSERT INTO ez_brand_assets
      (
        id,
        brand_id,
        asset_type,
        name,
        url,
        storage_key,
        mime_type,
        variant,
        approved,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12
      )
      `,
      [
        asset.id,
        asset.brandId,
        asset.assetType,
        asset.name,
        asset.url,
        asset.storageKey,
        asset.mimeType,
        asset.variant,
        asset.approved,
        JSON.stringify(
          asset.metadata
        ),
        asset.createdAt,
        asset.updatedAt
      ]
    );

    return clone(asset);
  }

  function getAssets(
    brandId
  ) {
    return Array.from(
      state.assets.values()
    )
      .filter(
        item =>
          !brandId ||
          item.brandId ===
            brandId
      )
      .map(clone);
  }

  /* ============================================================
     TEMPLATES
  ============================================================ */

  async function createTemplate(
    input = {}
  ) {
    if (
      state.templates.size >=
      maxTemplates
    ) {
      throw new Error(
        "Maximum brand templates reached"
      );
    }

    const template = {
      id:
        id("brand_template"),

      brandId:
        input.brandId,

      name:
        input.name ||
        "News Template",

      templateType:
        input.templateType ||
        "news",

      structure:
        input.structure ||
        {},

      approved:
        input.approved === true,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.templates.set(
      template.id,
      template
    );

    state.statistics
      .templatesCreated++;

    await query(
      `
      INSERT INTO ez_brand_templates
      (
        id,
        brand_id,
        name,
        template_type,
        structure,
        approved,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        template.id,
        template.brandId,
        template.name,
        template.templateType,
        JSON.stringify(
          template.structure
        ),
        template.approved,
        JSON.stringify(
          template.metadata
        ),
        template.createdAt,
        template.updatedAt
      ]
    );

    return clone(template);
  }

  function getTemplates(
    brandId
  ) {
    return Array.from(
      state.templates.values()
    )
      .filter(
        item =>
          !brandId ||
          item.brandId ===
            brandId
      )
      .map(clone);
  }

  /* ============================================================
     COLOR ANALYSIS
  ============================================================ */

  function normalizeColor(
    color
  ) {
    if (
      typeof color !==
      "string"
    ) {
      return null;
    }

    const value =
      color
        .trim()
        .toLowerCase();

    if (
      /^#[0-9a-f]{6}$/i.test(
        value
      )
    ) {
      return value;
    }

    return null;
  }

  function isForbiddenColor(
    color
  ) {
    const normalized =
      normalizeColor(
        color
      );

    if (!normalized) {
      return false;
    }

    const forbidden = [
      "#000000",
      "#111111",
      "#222222",
      "#333333",
      "#444444",
      "#555555",
      "#d4af37",
      "#ffd700",
      "#c9a227"
    ];

    return forbidden.includes(
      normalized
    );
  }

  function colorDistance(
    a,
    b
  ) {
    const first =
      normalizeColor(a);

    const second =
      normalizeColor(b);

    if (
      !first ||
      !second
    ) {
      return 999;
    }

    const parse = value => ({
      r: parseInt(
        value.slice(1, 3),
        16
      ),

      g: parseInt(
        value.slice(3, 5),
        16
      ),

      b: parseInt(
        value.slice(5, 7),
        16
      )
    });

    const x =
      parse(first);

    const y =
      parse(second);

    return Math.sqrt(
      Math.pow(
        x.r - y.r,
        2
      ) +
      Math.pow(
        x.g - y.g,
        2
      ) +
      Math.pow(
        x.b - y.b,
        2
      )
    );
  }

  /* ============================================================
     CONTENT BRAND COMPLIANCE
  ============================================================ */

  async function checkCompliance(
    input = {}
  ) {
    if (
      state.checks.size >=
      maxChecks
    ) {
      throw new Error(
        "Maximum brand compliance checks reached"
      );
    }

    const brand =
      findBrand(
        input.brandId ||
        "ez-media"
      );

    if (!brand) {
      throw new Error(
        "Brand not found"
      );
    }

    const content =
      input.content ||
      {};

    const violations = [];
    const recommendations = [];

    let score = 100;

    /* ----------------------------------------------------------
       COLORS
    ---------------------------------------------------------- */

    const colors =
      Array.isArray(
        content.colors
      )
        ? content.colors
        : [];

    for (
      const color of colors
    ) {
      if (
        isForbiddenColor(
          color
        )
      ) {
        violations.push({
          type:
            "forbidden_color",

          value:
            color,

          severity:
            "high"
        });

        score -= 15;
      }
    }

    /* ----------------------------------------------------------
       BRAND COLORS
    ---------------------------------------------------------- */

    if (colors.length) {
      const approvedColors = [
        brand.primaryColor,
        brand.secondaryColor,
        brand.accentColor,
        brand.backgroundColor,
        brand.textColor
      ]
        .map(
          normalizeColor
        )
        .filter(Boolean);

      let matching = 0;

      for (
        const color of colors
      ) {
        if (
          approvedColors.some(
            approved =>
              colorDistance(
                color,
                approved
              ) < 70
          )
        ) {
          matching++;
        }
      }

      const ratio =
        matching /
        colors.length;

      if (
        ratio < 0.5
      ) {
        violations.push({
          type:
            "brand_color_mismatch",

          severity:
            "medium",

          ratio
        });

        score -= 15;

        recommendations.push(
          "استخدم لوحة ألوان EZ MEDIA المعتمدة"
        );
      }
    }

    /* ----------------------------------------------------------
       LOGO
    ---------------------------------------------------------- */

    if (
      brand.rules.requireLogo &&
      input.logoUsed === false
    ) {
      violations.push({
        type:
          "missing_logo",

        severity:
          "medium"
      });

      score -= 10;

      recommendations.push(
        "استخدم الشعار المعتمد عند الحاجة"
      );
    }

    if (
      input.logoDistorted === true
    ) {
      violations.push({
        type:
          "logo_distortion",

        severity:
          "critical"
      });

      score -= 30;

      recommendations.push(
        "إعادة الشعار إلى نسبه الأصلية"
      );
    }

    /* ----------------------------------------------------------
       TYPOGRAPHY
    ---------------------------------------------------------- */

    if (
      input.textContrast ===
      "low"
    ) {
      violations.push({
        type:
          "low_text_contrast",

        severity:
          "high"
      });

      score -= 15;

      recommendations.push(
        "رفع تباين النص وتحسين سهولة القراءة"
      );
    }

    if (
      input.fontReadability ===
      "low"
    ) {
      violations.push({
        type:
          "poor_typography",

        severity:
          "high"
      });

      score -= 15;

      recommendations.push(
        "استخدام خط واضح وسهل القراءة"
      );
    }

    /* ----------------------------------------------------------
       ACCESSIBILITY
    ---------------------------------------------------------- */

    if (
      input.accessibility ===
      "poor"
    ) {
      violations.push({
        type:
          "accessibility",

        severity:
          "high"
      });

      score -= 20;
    }

    /* ----------------------------------------------------------
       CARTOON / STYLE
    ---------------------------------------------------------- */

    if (
      input.style ===
      "cartoon"
    ) {
      violations.push({
        type:
          "unapproved_visual_style",

        severity:
          "medium"
      });

      score -= 10;
    }

    /* ----------------------------------------------------------
       SPONSORSHIP
    ---------------------------------------------------------- */

    if (
      content.sponsored === true &&
      !content.sponsorDisclosure
    ) {
      violations.push({
        type:
          "missing_sponsor_disclosure",

        severity:
          "critical"
      });

      score -= 30;

      recommendations.push(
        "يجب توضيح أن المحتوى برعاية"
      );
    }

    /* ----------------------------------------------------------
       AI
    ---------------------------------------------------------- */

    let aiAnalysis = {};

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        aiAnalysis =
          await aiOrchestrator.process({
            operation:
              "brand-compliance",

            input: {
              brand,
              content,
              violations,
              score
            },

            metadata: {
              source:
                "CODE96"
            }
          });
      } catch (error) {
        logger.warn(
          "[CODE96] AI analysis:",
          error.message
        );
      }
    } else if (
      aiCore &&
      typeof aiCore.fullAnalysis ===
        "function"
    ) {
      try {
        aiAnalysis =
          await aiCore.fullAnalysis({
            brand,
            content,
            violations,
            score
          });
      } catch (error) {
        logger.warn(
          "[CODE96] AI core:",
          error.message
        );
      }
    }

    score =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(score)
        )
      );

    let decision =
      "human_review";

    if (
      score >=
      approvalThreshold &&
      !violations.some(
        item =>
          item.severity ===
          "critical"
      )
    ) {
      decision =
        "approved";

      state.statistics
        .approved++;
    } else if (
      score <
      reviewThreshold ||
      violations.some(
        item =>
          item.severity ===
          "critical"
      )
    ) {
      decision =
        "rejected";

      state.statistics
        .rejected++;
    } else {
      decision =
        "human_review";

      state.statistics
        .humanReview++;
    }

    const check = {
      id:
        id("brand_check"),

      brandId:
        brand.id,

      contentId:
        input.contentId ||
        null,

      assetId:
        input.assetId ||
        null,

      templateId:
        input.templateId ||
        null,

      score,

      decision,

      violations,

      recommendations: [
        ...new Set(
          recommendations
        )
      ],

      aiAnalysis,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.checks.set(
      check.id,
      check
    );

    state.statistics
      .checksCompleted++;

    if (
      violations.length
    ) {
      state.statistics
        .violations +=
        violations.length;

      for (
        const violation of
          violations
      ) {
        state.violations.set(
          id("brand_violation"),
          {
            ...violation,
            checkId:
              check.id,
            brandId:
              brand.id,
            createdAt:
              now()
          }
        );
      }
    }

    await query(
      `
      INSERT INTO ez_brand_compliance_checks
      (
        id,
        brand_id,
        content_id,
        asset_id,
        template_id,
        score,
        decision,
        violations,
        recommendations,
        ai_analysis,
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
        check.id,
        check.brandId,
        check.contentId,
        check.assetId,
        check.templateId,
        check.score,
        check.decision,
        JSON.stringify(
          check.violations
        ),
        JSON.stringify(
          check.recommendations
        ),
        JSON.stringify(
          check.aiAnalysis
        ),
        JSON.stringify(
          check.metadata
        ),
        check.createdAt
      ]
    );

    emit(
      "brand.compliance.completed",
      clone(check)
    );

    return clone(check);
  }

  /* ============================================================
     BRAND USAGE
  ============================================================ */

  async function recordUsage(
    input = {}
  ) {
    const record = {
      id:
        id("brand_usage"),

      brandId:
        input.brandId,

      assetId:
        input.assetId ||
        null,

      contentId:
        input.contentId ||
        null,

      channel:
        input.channel ||
        "website",

      action:
        input.action ||
        "publish",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.usage.set(
      record.id,
      record
    );

    await query(
      `
      INSERT INTO ez_brand_usage
      (
        id,
        brand_id,
        asset_id,
        content_id,
        channel,
        action,
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
        record.brandId,
        record.assetId,
        record.contentId,
        record.channel,
        record.action,
        JSON.stringify(
          record.metadata
        ),
        record.createdAt
      ]
    );

    return clone(record);
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalBrands:
        state.brands.size,

      totalAssets:
        state.assets.size,

      totalTemplates:
        state.templates.size,

      totalGuidelines:
        state.guidelines.size,

      totalChecks:
        state.checks.size,

      totalViolations:
        state.violations.size,

      totalUsageRecords:
        state.usage.size
    };
  }

  function getDashboard() {
    return {
      primaryBrand:
        findBrand(
          "ez-media"
        ),

      brands:
        getBrands(),

      guidelines:
        getGuidelines(),

      templates:
        getTemplates(),

      recentChecks:
        Array.from(
          state.checks.values()
        )
          .slice(-20)
          .reverse()
          .map(clone),

      statistics:
        getStatistics()
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Media Brand & Identity Engine",

      code:
        "CODE96",

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

        dam:
          Boolean(
            damEngine
          ),

        video:
          Boolean(
            videoEngine
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

        legal:
          Boolean(
            legalRightsEngine
          ),

        quality:
          Boolean(
            qualityEngine
          )
      },

      thresholds: {
        approvalThreshold,
        reviewThreshold
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running = true;

    emit(
      "brand.started",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function stop() {
    state.running = false;

    emit(
      "brand.stopped",
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

    createBrand,
    getBrands,
    getBrand,

    createAsset,
    getAssets,

    createTemplate,
    getTemplates,

    createGuideline,
    getGuidelines,

    checkCompliance,

    recordUsage
  };
}

module.exports = {
  createIntelligentMediaBrandIdentityEngine
};
