"use strict";

const crypto = require("crypto");

function createIntelligentMediaContentFactoryEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    editorialEngine = null,
    automationEngine = null,
    assignmentEngine = null,
    damEngine = null,
    mediaIntelligenceEngine = null,
    videoEngine = null,

    qualityEngine = null,
    legalRightsEngine = null,
    ethicsEngine = null,
    brandEngine = null,

    publishingEngine = null,
    workflowEngine = null,
    communicationEngine = null,
    notificationService = null,
    eventBus = null,

    logger = console,

    maxJobs = Number(
      process.env.CONTENT_FACTORY_MAX_JOBS || 100000
    ),

    maxOutputsPerJob = Number(
      process.env.CONTENT_FACTORY_MAX_OUTPUTS || 100
    ),

    maxTemplates = Number(
      process.env.CONTENT_FACTORY_MAX_TEMPLATES || 10000
    ),

    maxLanguages = Number(
      process.env.CONTENT_FACTORY_MAX_LANGUAGES || 50
    ),

    autoApprovalScore = Number(
      process.env.CONTENT_FACTORY_AUTO_APPROVAL_SCORE || 90
    ),

    humanReviewScore = Number(
      process.env.CONTENT_FACTORY_HUMAN_REVIEW_SCORE || 70
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    jobs: new Map(),
    outputs: new Map(),
    templates: new Map(),
    channels: new Map(),
    approvals: new Map(),
    failures: new Map(),

    statistics: {
      jobsCreated: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      outputsGenerated: 0,
      outputsApproved: 0,
      outputsReview: 0,
      outputsRejected: 0,
      translations: 0,
      videos: 0,
      socialPosts: 0,
      articles: 0,
      alerts: 0
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
        "[CODE97] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_factory_jobs (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT,
        title TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        source JSONB DEFAULT '{}'::jsonb,
        configuration JSONB DEFAULT '{}'::jsonb,
        requested_outputs JSONB DEFAULT '[]'::jsonb,
        generated_outputs JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_factory_outputs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        output_type TEXT NOT NULL,
        channel TEXT,
        language TEXT DEFAULT 'ar',
        status TEXT DEFAULT 'draft',
        title TEXT,
        body TEXT,
        caption TEXT,
        description TEXT,
        hashtags JSONB DEFAULT '[]'::jsonb,
        keywords JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        quality_score NUMERIC DEFAULT 0,
        ethics_score NUMERIC DEFAULT 0,
        legal_score NUMERIC DEFAULT 0,
        brand_score NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_factory_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        output_type TEXT NOT NULL,
        channel TEXT,
        language TEXT DEFAULT 'ar',
        structure JSONB DEFAULT '{}'::jsonb,
        instructions TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_factory_approvals (
        id TEXT PRIMARY KEY,
        output_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        reviewer_id TEXT,
        reason TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_factory_failures (
        id TEXT PRIMARY KEY,
        job_id TEXT,
        output_id TEXT,
        stage TEXT,
        error_message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_content_factory_jobs_status
      ON ez_content_factory_jobs(status)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_content_factory_outputs_job
      ON ez_content_factory_outputs(job_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_content_factory_outputs_channel
      ON ez_content_factory_outputs(channel)
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
    await seedDefaultTemplates();
    await seedDefaultChannels();

    state.initialized = true;

    emit(
      "content-factory.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     CHANNELS
  ============================================================ */

  async function seedDefaultChannels() {
    const channels = [
      {
        id: "website",
        name: "EZ MEDIA Website",
        type: "website"
      },
      {
        id: "breaking-news",
        name: "Breaking News",
        type: "news"
      },
      {
        id: "youtube",
        name: "YouTube",
        type: "video"
      },
      {
        id: "short-video",
        name: "Short Video",
        type: "video"
      },
      {
        id: "x",
        name: "X",
        type: "social"
      },
      {
        id: "instagram",
        name: "Instagram",
        type: "social"
      },
      {
        id: "tiktok",
        name: "TikTok",
        type: "social"
      },
      {
        id: "snapchat",
        name: "Snapchat",
        type: "social"
      },
      {
        id: "facebook",
        name: "Facebook",
        type: "social"
      },
      {
        id: "linkedin",
        name: "LinkedIn",
        type: "social"
      },
      {
        id: "audio",
        name: "Audio",
        type: "audio"
      },
      {
        id: "broadcast",
        name: "Broadcast",
        type: "broadcast"
      }
    ];

    for (const channel of channels) {
      state.channels.set(
        channel.id,
        channel
      );
    }
  }

  function getChannels() {
    return Array.from(
      state.channels.values()
    ).map(clone);
  }

  /* ============================================================
     DEFAULT TEMPLATES
  ============================================================ */

  async function seedDefaultTemplates() {
    const templates = [
      {
        name: "خبر موقع",
        outputType: "article",
        channel: "website",
        language: "ar",
        structure: {
          title: true,
          lead: true,
          body: true,
          source: true,
          related: true
        },
        instructions:
          "صياغة خبر واضح ومهني دون اختلاق معلومات."
      },

      {
        name: "عاجل",
        outputType: "breaking",
        channel: "breaking-news",
        language: "ar",
        structure: {
          headline: true,
          summary: true,
          source: true
        },
        instructions:
          "صياغة عاجلة مختصرة مع المحافظة على دقة المعلومات."
      },

      {
        name: "منشور X",
        outputType: "social_post",
        channel: "x",
        language: "ar",
        structure: {
          hook: true,
          body: true,
          source: true,
          hashtags: true
        },
        instructions:
          "منشور مختصر مناسب لمنصة X."
      },

      {
        name: "وصف إنستغرام",
        outputType: "social_caption",
        channel: "instagram",
        language: "ar",
        structure: {
          hook: true,
          caption: true,
          hashtags: true
        },
        instructions:
          "وصف جذاب دون مبالغة أو ادعاءات غير مثبتة."
      },

      {
        name: "سيناريو فيديو قصير",
        outputType: "video_script",
        channel: "short-video",
        language: "ar",
        structure: {
          hook: true,
          scenes: true,
          narration: true,
          ending: true
        },
        instructions:
          "سيناريو فيديو قصير سريع وواضح."
      },

      {
        name: "نص مذيع",
        outputType: "anchor_script",
        channel: "broadcast",
        language: "ar",
        structure: {
          intro: true,
          body: true,
          transition: true,
          outro: true
        },
        instructions:
          "نص مذيع احترافي قابل للقراءة على الهواء."
      },

      {
        name: "بودكاست",
        outputType: "audio_script",
        channel: "audio",
        language: "ar",
        structure: {
          intro: true,
          segments: true,
          conclusion: true
        },
        instructions:
          "نص صوتي طبيعي ومنظم."
      }
    ];

    for (const template of templates) {
      await createTemplate(
        template,
        false
      );
    }
  }

  /* ============================================================
     TEMPLATES
  ============================================================ */

  async function createTemplate(
    input = {},
    count = true
  ) {
    if (
      state.templates.size >=
      maxTemplates
    ) {
      throw new Error(
        "Maximum content factory templates reached"
      );
    }

    const template = {
      id:
        id("factory_template"),

      name:
        input.name ||
        "Content Template",

      outputType:
        input.outputType ||
        "article",

      channel:
        input.channel ||
        "website",

      language:
        input.language ||
        "ar",

      structure:
        input.structure ||
        {},

      instructions:
        input.instructions ||
        "",

      enabled:
        input.enabled !== false,

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

    if (count) {
      state.statistics
        .templatesCreated++;
    }

    await query(
      `
      INSERT INTO ez_content_factory_templates
      (
        id,
        name,
        output_type,
        channel,
        language,
        structure,
        instructions,
        enabled,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      `,
      [
        template.id,
        template.name,
        template.outputType,
        template.channel,
        template.language,
        JSON.stringify(
          template.structure
        ),
        template.instructions,
        template.enabled,
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
    filters = {}
  ) {
    return Array.from(
      state.templates.values()
    )
      .filter(
        template =>
          (!filters.outputType ||
            template.outputType ===
              filters.outputType) &&
          (!filters.channel ||
            template.channel ===
              filters.channel) &&
          (!filters.language ||
            template.language ===
              filters.language)
      )
      .map(clone);
  }

  /* ============================================================
     SOURCE NORMALIZATION
  ============================================================ */

  function normalizeSource(
    input = {}
  ) {
    const source =
      input.source ||
      {};

    return {
      id:
        input.sourceId ||
        source.id ||
        null,

      type:
        input.sourceType ||
        source.type ||
        "editorial",

      title:
        source.title ||
        input.title ||
        "",

      text:
        source.text ||
        source.body ||
        input.text ||
        input.body ||
        "",

      summary:
        source.summary ||
        input.summary ||
        "",

      sourceName:
        source.sourceName ||
        source.publisher ||
        input.sourceName ||
        "",

      sourceUrl:
        source.sourceUrl ||
        source.url ||
        input.sourceUrl ||
        null,

      media:
        Array.isArray(
          source.media
        )
          ? source.media
          : [],

      language:
        source.language ||
        input.language ||
        "ar",

      metadata:
        source.metadata ||
        {}
    };
  }

  /* ============================================================
     AI GENERATION
  ============================================================ */

  async function generateWithAI(
    outputType,
    source,
    configuration,
    template
  ) {
    const prompt = {
      outputType,
      source,
      configuration,
      template,

      rules: [
        "لا تخترع حقائق",
        "لا تضف أسماء أو أرقاماً غير موجودة في المصدر",
        "حافظ على المعنى الأساسي",
        "افصل الرأي عن الخبر",
        "استخدم اللغة المطلوبة",
        "التزم بنوع المحتوى",
        "إذا كانت المعلومة غير مؤكدة فاذكر ذلك بوضوح"
      ]
    };

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      return aiOrchestrator.process({
        operation:
          "content-factory-generate",

        input: prompt,

        metadata: {
          source:
            "CODE97"
        }
      });
    }

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      return aiCore.request({
        operation:
          "content-generation",

        input: prompt
      });
    }

    return null;
  }

  /* ============================================================
     FALLBACK GENERATION
  ============================================================ */

  function fallbackGenerate(
    outputType,
    source,
    configuration
  ) {
    const title =
      source.title ||
      "محتوى EZ MEDIA";

    const body =
      source.text ||
      source.summary ||
      "";

    switch (
      outputType
    ) {
      case "breaking":
        return {
          title,
          body:
            source.summary ||
            body.slice(0, 500)
        };

      case "social_post":
        return {
          title,
          body:
            body.slice(0, 700)
        };

      case "social_caption":
        return {
          title,
          caption:
            body.slice(0, 1200)
        };

      case "video_script":
        return {
          title,
          body,
          scenes: [
            {
              scene: 1,
              narration:
                body.slice(0, 300)
            }
          ]
        };

      case "anchor_script":
        return {
          title,
          body
        };

      case "audio_script":
        return {
          title,
          body
        };

      case "article":
      default:
        return {
          title,
          body
        };
    }
  }

  /* ============================================================
     OUTPUT NORMALIZATION
  ============================================================ */

  function normalizeGeneratedOutput(
    generated,
    source,
    configuration
  ) {
    const data =
      generated &&
      generated.output
        ? generated.output
        : generated || {};

    return {
      title:
        data.title ||
        source.title ||
        "EZ MEDIA",

      body:
        data.body ||
        data.text ||
        source.text ||
        "",

      caption:
        data.caption ||
        "",

      description:
        data.description ||
        "",

      hashtags:
        Array.isArray(
          data.hashtags
        )
          ? data.hashtags
          : [],

      keywords:
        Array.isArray(
          data.keywords
        )
          ? data.keywords
          : [],

      scenes:
        Array.isArray(
          data.scenes
        )
          ? data.scenes
          : [],

      narration:
        data.narration ||
        "",

      metadata:
        {
          generatedBy:
            "CODE97",

          requestedLanguage:
            configuration.language ||
            "ar"
        }
    };
  }

  /* ============================================================
     QUALITY / RIGHTS / ETHICS / BRAND
  ============================================================ */

  async function validateOutput(
    output,
    source,
    configuration
  ) {
    const result = {
      qualityScore: 100,
      legalScore: 100,
      ethicsScore: 100,
      brandScore: 100,

      decisions: [],

      warnings: []
    };

    /* QUALITY */

    if (
      qualityEngine &&
      typeof qualityEngine.checkContent ===
        "function"
    ) {
      try {
        const quality =
          await qualityEngine
            .checkContent({
              contentId:
                output.id,

              content: output
            });

        if (
          quality &&
          typeof quality.score ===
            "number"
        ) {
          result.qualityScore =
            quality.score;
        }
      } catch (error) {
        result.warnings.push(
          "تعذر الحصول على نتيجة الجودة"
        );
      }
    }

    /* LEGAL */

    if (
      legalRightsEngine &&
      typeof legalRightsEngine.review ===
        "function"
    ) {
      try {
        const legal =
          await legalRightsEngine
            .review({
              contentId:
                output.id,

              content: output,

              source
            });

        if (
          legal &&
          typeof legal.score ===
            "number"
        ) {
          result.legalScore =
            legal.score;
        }
      } catch (error) {
        result.warnings.push(
          "تعذر الحصول على نتيجة الحقوق"
        );
      }
    }

    /* ETHICS */

    if (
      ethicsEngine &&
      typeof ethicsEngine.reviewContent ===
        "function"
    ) {
      try {
        const ethics =
          await ethicsEngine
            .reviewContent({
              contentId:
                output.id,

              content: output,

              metadata:
                configuration.metadata
            });

        if (
          ethics &&
          typeof ethics.ethicsScore ===
            "number"
        ) {
          result.ethicsScore =
            ethics.ethicsScore;
        }
      } catch (error) {
        result.warnings.push(
          "تعذر الحصول على نتيجة الأخلاقيات"
        );
      }
    }

    /* BRAND */

    if (
      brandEngine &&
      typeof brandEngine.checkCompliance ===
        "function"
    ) {
      try {
        const brand =
          await brandEngine
            .checkCompliance({
              contentId:
                output.id,

              brandId:
                configuration.brandId ||
                "ez-media",

              content: {
                ...output,

                colors:
                  configuration.colors ||
                  [],

                logoUsed:
                  configuration.logoUsed !==
                  false,

                textContrast:
                  configuration.textContrast ||
                  "good",

                fontReadability:
                  configuration.fontReadability ||
                  "good",

                accessibility:
                  configuration.accessibility ||
                  "good",

                style:
                  configuration.style ||
                  "modern"
              }
            });

        if (
          brand &&
          typeof brand.score ===
            "number"
        ) {
          result.brandScore =
            brand.score;
        }
      } catch (error) {
        result.warnings.push(
          "تعذر الحصول على نتيجة الهوية"
        );
      }
    }

    return result;
  }

  /* ============================================================
     FINAL DECISION
  ============================================================ */

  function decide(
    validation
  ) {
    const scores = [
      validation.qualityScore,
      validation.legalScore,
      validation.ethicsScore,
      validation.brandScore
    ];

    const score =
      Math.round(
        scores.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        scores.length
      );

    if (
      scores.some(
        value =>
          value < 50
      )
    ) {
      return {
        score,
        decision:
          "rejected"
      };
    }

    if (
      scores.some(
        value =>
          value < 70
      )
    ) {
      return {
        score,
        decision:
          "human_review"
      };
    }

    if (
      score >=
      autoApprovalScore
    ) {
      return {
        score,
        decision:
          "approved"
      };
    }

    return {
      score,
      decision:
        "human_review"
    };
  }

  /* ============================================================
     CREATE OUTPUT
  ============================================================ */

  async function createOutput(
    job,
    requested
  ) {
    if (
      state.outputs.size >=
      maxJobs *
        maxOutputsPerJob
    ) {
      throw new Error(
        "Maximum content factory outputs reached"
      );
    }

    const outputType =
      requested.outputType ||
      "article";

    const channel =
      requested.channel ||
      "website";

    const language =
      requested.language ||
      "ar";

    const template =
      getTemplates({
        outputType,
        channel,
        language
      })[0] || null;

    let generated =
      await generateWithAI(
        outputType,
        job.source,
        {
          ...job.configuration,
          language
        },
        template
      );

    if (!generated) {
      generated =
        fallbackGenerate(
          outputType,
          job.source,
          {
            ...job.configuration,
            language
          }
        );
    }

    const normalized =
      normalizeGeneratedOutput(
        generated,
        job.source,
        {
          language
        }
      );

    const output = {
      id:
        id("factory_output"),

      jobId:
        job.id,

      outputType,

      channel,

      language,

      status:
        "draft",

      ...normalized,

      qualityScore: 0,
      ethicsScore: 0,
      legalScore: 0,
      brandScore: 0,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.outputs.set(
      output.id,
      output
    );

    state.statistics
      .outputsGenerated++;

    const validation =
      await validateOutput(
        output,
        job.source,
        job.configuration
      );

    output.qualityScore =
      validation.qualityScore;

    output.ethicsScore =
      validation.ethicsScore;

    output.legalScore =
      validation.legalScore;

    output.brandScore =
      validation.brandScore;

    const decision =
      decide(
        validation
      );

    output.status =
      decision.decision;

    output.metadata = {
      ...output.metadata,

      validation,

      finalScore:
        decision.score,

      decision:
        decision.decision
    };

    if (
      decision.decision ===
      "approved"
    ) {
      state.statistics
        .outputsApproved++;
    } else if (
      decision.decision ===
      "human_review"
    ) {
      state.statistics
        .outputsReview++;
    } else {
      state.statistics
        .outputsRejected++;
    }

    if (
      language !==
      job.source.language
    ) {
      state.statistics
        .translations++;
    }

    if (
      outputType ===
      "video_script"
    ) {
      state.statistics
        .videos++;
    }

    if (
      outputType ===
        "social_post" ||
      outputType ===
        "social_caption"
    ) {
      state.statistics
        .socialPosts++;
    }

    if (
      outputType ===
      "article"
    ) {
      state.statistics
        .articles++;
    }

    await saveOutput(
      output
    );

    emit(
      "content-factory.output.created",
      clone(output)
    );

    return clone(output);
  }

  async function saveOutput(
    output
  ) {
    await query(
      `
      INSERT INTO ez_content_factory_outputs
      (
        id,
        job_id,
        output_type,
        channel,
        language,
        status,
        title,
        body,
        caption,
        description,
        hashtags,
        keywords,
        metadata,
        quality_score,
        ethics_score,
        legal_score,
        brand_score,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      `,
      [
        output.id,
        output.jobId,
        output.outputType,
        output.channel,
        output.language,
        output.status,
        output.title,
        output.body,
        output.caption,
        output.description,
        JSON.stringify(
          output.hashtags
        ),
        JSON.stringify(
          output.keywords
        ),
        JSON.stringify(
          output.metadata
        ),
        output.qualityScore,
        output.ethicsScore,
        output.legalScore,
        output.brandScore,
        output.createdAt,
        output.updatedAt
      ]
    );
  }

  /* ============================================================
     CREATE JOB
  ============================================================ */

  async function createJob(
    input = {}
  ) {
    if (
      state.jobs.size >=
      maxJobs
    ) {
      throw new Error(
        "Maximum content factory jobs reached"
      );
    }

    const source =
      normalizeSource(
        input
      );

    if (!source.text && !source.title) {
      throw new Error(
        "A source title or source text is required"
      );
    }

    const requestedOutputs =
      Array.isArray(
        input.outputs
      ) &&
      input.outputs.length
        ? input.outputs
        : [
            {
              outputType:
                "article",

              channel:
                "website",

              language:
                "ar"
            },

            {
              outputType:
                "social_post",

              channel:
                "x",

              language:
                "ar"
            },

            {
              outputType:
                "video_script",

              channel:
                "short-video",

              language:
                "ar"
            }
          ];

    if (
      requestedOutputs.length >
      maxOutputsPerJob
    ) {
      throw new Error(
        `Maximum outputs per job is ${maxOutputsPerJob}`
      );
    }

    const job = {
      id:
        id("factory_job"),

      sourceType:
        input.sourceType ||
        source.type,

      sourceId:
        input.sourceId ||
        source.id ||
        null,

      title:
        source.title,

      status:
        "pending",

      priority:
        input.priority ||
        "medium",

      source,

      configuration:
        input.configuration ||
        {},

      requestedOutputs,

      generatedOutputs: [],

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      startedAt:
        null,

      completedAt:
        null,

      failedAt:
        null
    };

    state.jobs.set(
      job.id,
      job
    );

    state.statistics
      .jobsCreated++;

    await query(
      `
      INSERT INTO ez_content_factory_jobs
      (
        id,
        source_type,
        source_id,
        title,
        status,
        priority,
        source,
        configuration,
        requested_outputs,
        generated_outputs,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      `,
      [
        job.id,
        job.sourceType,
        job.sourceId,
        job.title,
        job.status,
        job.priority,
        JSON.stringify(
          job.source
        ),
        JSON.stringify(
          job.configuration
        ),
        JSON.stringify(
          job.requestedOutputs
        ),
        JSON.stringify(
          []
        ),
        JSON.stringify(
          job.metadata
        ),
        job.createdAt
      ]
    );

    emit(
      "content-factory.job.created",
      clone(job)
    );

    return clone(job);
  }

  /* ============================================================
     PROCESS JOB
  ============================================================ */

  async function processJob(
    jobId
  ) {
    const job =
      state.jobs.get(
        jobId
      );

    if (!job) {
      throw new Error(
        "Content factory job not found"
      );
    }

    if (
      job.status ===
      "completed"
    ) {
      return clone(job);
    }

    job.status =
      "processing";

    job.startedAt =
      now();

    try {
      for (
        const requested of
          job.requestedOutputs
      ) {
        try {
          const output =
            await createOutput(
              job,
              requested
            );

          job.generatedOutputs.push(
            output.id
          );
        } catch (error) {
          const failure = {
            id:
              id("factory_failure"),

            jobId:
              job.id,

            outputId:
              null,

            stage:
              "output_generation",

            errorMessage:
              error.message,

            metadata: {},

            createdAt:
              now()
          };

          state.failures.set(
            failure.id,
            failure
          );

          await query(
            `
            INSERT INTO ez_content_factory_failures
            (
              id,
              job_id,
              stage,
              error_message,
              metadata,
              created_at
            )
            VALUES
            (
              $1,$2,$3,$4,$5,$6
            )
            `,
            [
              failure.id,
              failure.jobId,
              failure.stage,
              failure.errorMessage,
              JSON.stringify(
                failure.metadata
              ),
              failure.createdAt
            ]
          );
        }
      }

      job.status =
        "completed";

      job.completedAt =
        now();

      state.statistics
        .jobsCompleted++;

      await query(
        `
        UPDATE ez_content_factory_jobs
        SET
          status = $1,
          generated_outputs = $2,
          started_at = $3,
          completed_at = $4
        WHERE id = $5
        `,
        [
          job.status,
          JSON.stringify(
            job.generatedOutputs
          ),
          job.startedAt,
          job.completedAt,
          job.id
        ]
      );

      emit(
        "content-factory.job.completed",
        clone(job)
      );

      return clone(job);
    } catch (error) {
      job.status =
        "failed";

      job.failedAt =
        now();

      state.statistics
        .jobsFailed++;

      throw error;
    }
  }

  /* ============================================================
     APPROVAL
  ============================================================ */

  async function approveOutput(
    outputId,
    input = {}
  ) {
    const output =
      state.outputs.get(
        outputId
      );

    if (!output) {
      throw new Error(
        "Content factory output not found"
      );
    }

    const approval = {
      id:
        id("factory_approval"),

      outputId,

      decision:
        "approved_by_human",

      reviewerId:
        input.reviewerId ||
        null,

      reason:
        input.reason ||
        "تم اعتماد المحتوى بعد المراجعة البشرية",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    output.status =
      "approved_by_human";

    output.updatedAt =
      now();

    state.approvals.set(
      approval.id,
      approval
    );

    state.statistics
      .outputsApproved++;

    await query(
      `
      INSERT INTO ez_content_factory_approvals
      (
        id,
        output_id,
        decision,
        reviewer_id,
        reason,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        approval.id,
        approval.outputId,
        approval.decision,
        approval.reviewerId,
        approval.reason,
        JSON.stringify(
          approval.metadata
        ),
        approval.createdAt
      ]
    );

    await query(
      `
      UPDATE ez_content_factory_outputs
      SET
        status = $1,
        updated_at = $2
      WHERE id = $3
      `,
      [
        output.status,
        output.updatedAt,
        output.id
      ]
    );

    emit(
      "content-factory.output.approved",
      clone(output)
    );

    return clone(output);
  }

  async function rejectOutput(
    outputId,
    input = {}
  ) {
    const output =
      state.outputs.get(
        outputId
      );

    if (!output) {
      throw new Error(
        "Content factory output not found"
      );
    }

    output.status =
      "rejected_by_human";

    output.updatedAt =
      now();

    const approval = {
      id:
        id("factory_approval"),

      outputId,

      decision:
        "rejected_by_human",

      reviewerId:
        input.reviewerId ||
        null,

      reason:
        input.reason ||
        "تم رفض المحتوى بعد المراجعة البشرية",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.approvals.set(
      approval.id,
      approval
    );

    state.statistics
      .outputsRejected++;

    await query(
      `
      INSERT INTO ez_content_factory_approvals
      (
        id,
        output_id,
        decision,
        reviewer_id,
        reason,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        approval.id,
        approval.outputId,
        approval.decision,
        approval.reviewerId,
        approval.reason,
        JSON.stringify(
          approval.metadata
        ),
        approval.createdAt
      ]
    );

    await query(
      `
      UPDATE ez_content_factory_outputs
      SET
        status = $1,
        updated_at = $2
      WHERE id = $3
      `,
      [
        output.status,
        output.updatedAt,
        output.id
      ]
    );

    return clone(output);
  }

  /* ============================================================
     GETTERS
  ============================================================ */

  function getJob(jobId) {
    const job =
      state.jobs.get(
        jobId
      );

    return job
      ? clone(job)
      : null;
  }

  function getJobs(
    filters = {}
  ) {
    return Array.from(
      state.jobs.values()
    )
      .filter(
        job =>
          (!filters.status ||
            job.status ===
              filters.status) &&
          (!filters.priority ||
            job.priority ===
              filters.priority)
      )
      .map(clone);
  }

  function getOutput(
    outputId
  ) {
    const output =
      state.outputs.get(
        outputId
      );

    return output
      ? clone(output)
      : null;
  }

  function getOutputs(
    filters = {}
  ) {
    return Array.from(
      state.outputs.values()
    )
      .filter(
        output =>
          (!filters.jobId ||
            output.jobId ===
              filters.jobId) &&
          (!filters.channel ||
            output.channel ===
              filters.channel) &&
          (!filters.language ||
            output.language ===
              filters.language) &&
          (!filters.status ||
            output.status ===
              filters.status)
      )
      .map(clone);
  }

  /* ============================================================
     DASHBOARD
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalJobs:
        state.jobs.size,

      totalOutputs:
        state.outputs.size,

      totalTemplates:
        state.templates.size,

      totalApprovals:
        state.approvals.size,

      totalFailures:
        state.failures.size
    };
  }

  function getDashboard() {
    return {
      status:
        getStatus(),

      jobs:
        getJobs().slice(
          -20
        ).reverse(),

      outputs:
        getOutputs().slice(
          -50
        ).reverse(),

      channels:
        getChannels(),

      statistics:
        getStatistics()
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Media Content Factory Engine",

      code:
        "CODE97",

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

        automation:
          Boolean(
            automationEngine
          ),

        assignment:
          Boolean(
            assignmentEngine
          ),

        dam:
          Boolean(
            damEngine
          ),

        mediaIntelligence:
          Boolean(
            mediaIntelligenceEngine
          ),

        video:
          Boolean(
            videoEngine
          ),

        quality:
          Boolean(
            qualityEngine
          ),

        legal:
          Boolean(
            legalRightsEngine
          ),

        ethics:
          Boolean(
            ethicsEngine
          ),

        brand:
          Boolean(
            brandEngine
          ),

        publishing:
          Boolean(
            publishingEngine
          )
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running =
      true;

    emit(
      "content-factory.started",
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
      "content-factory.stopped",
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

    getChannels,

    createTemplate,
    getTemplates,

    createJob,
    processJob,
    getJob,
    getJobs,

    getOutput,
    getOutputs,

    approveOutput,
    rejectOutput
  };
}

module.exports = {
  createIntelligentMediaContentFactoryEngine
};
