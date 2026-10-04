"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 71
 * MEDIA INTELLIGENCE & CONTENT UNDERSTANDING ENGINE
 * ============================================================
 *
 * محرك فهم المحتوى متعدد الوسائط.
 *
 * يدعم:
 *
 * IMAGE
 * VIDEO
 * AUDIO
 * DOCUMENT
 *
 * الوظائف:
 *
 * - تحليل المحتوى
 * - OCR
 * - Speech-to-Text
 * - Scene Understanding
 * - Object Understanding
 * - Entity Extraction
 * - Topic Extraction
 * - Keyword Extraction
 * - Language Detection
 * - Translation
 * - Summarization
 * - Headline Generation
 * - Caption Generation
 * - Media-to-News
 * - Content Classification
 * - Audience Understanding
 * - Editorial Intelligence
 * - Media Forensics integration
 * - External Verification integration
 * - News Verification integration
 * - Automation integration
 *
 * ملاحظة:
 * لا يتم الادعاء بنتيجة لم يتم تنفيذها فعليًا.
 * يمكن تمرير نتائج OCR / transcription / vision
 * من مزود متخصص عبر providers.
 */

const crypto =
  require("crypto");

const EventEmitter =
  require("events");

function createMediaIntelligenceEngine(
  options = {}
) {
  const {
    persistence = null,

    aiCore = null,

    aiProvider = null,

    aiOrchestrator = null,

    mediaForensicsEngine = null,

    externalVerificationEngine = null,

    newsVerificationEngine = null,

    sourceIntelligence = null,

    automationEngine = null,

    notificationService = null,

    mediaService = null,

    cmsService = null,

    eventBus = null,

    providers = {},

    logger = console,

    maxTextLength =
      Number(
        process.env.MEDIA_INTELLIGENCE_MAX_TEXT_LENGTH ||
        500000
      ),

    maxEntities =
      Number(
        process.env.MEDIA_INTELLIGENCE_MAX_ENTITIES ||
        100
      ),

    maxKeywords =
      Number(
        process.env.MEDIA_INTELLIGENCE_MAX_KEYWORDS ||
        100
      ),

    maxScenes =
      Number(
        process.env.MEDIA_INTELLIGENCE_MAX_SCENES ||
        500
      )
  } = options;

  const emitter =
    new EventEmitter();

  const state = {
    initialized: false,

    running: false,

    analyses:
      new Map(),

    statistics: {
      totalAnalyses: 0,

      images: 0,

      videos: 0,

      audio: 0,

      documents: 0,

      ocrRuns: 0,

      transcriptionRuns: 0,

      visionRuns: 0,

      translationRuns: 0,

      summaries: 0,

      entitiesExtracted: 0,

      keywordsExtracted: 0,

      newsDrafts: 0,

      humanReviews: 0,

      failed: 0,

      totalDurationMs: 0,

      averageDurationMs: 0
    }
  };

  /*
   * ==========================================================
   * HELPERS
   * ==========================================================
   */

  function now() {
    return new Date().toISOString();
  }

  function id(
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
      Math.max(
        min,
        n
      )
    );
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
        typeof value ===
          "string"
          ? value
          : JSON.stringify(
              value
            )
      )
      .digest("hex");
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
        "[CODE71] Event error:",
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

  /*
   * ==========================================================
   * DATABASE
   * ==========================================================
   */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_intelligence (
        id TEXT PRIMARY KEY,

        media_hash TEXT UNIQUE NOT NULL,

        media_type TEXT,

        mime_type TEXT,

        file_name TEXT,

        language TEXT,

        detected_languages JSONB,

        transcript TEXT,

        ocr_text TEXT,

        summary TEXT,

        headline TEXT,

        caption TEXT,

        translation JSONB,

        entities JSONB,

        keywords JSONB,

        topics JSONB,

        scenes JSONB,

        objects JSONB,

        locations JSONB,

        organizations JSONB,

        people JSONB,

        claims JSONB,

        sentiment JSONB,

        editorial_analysis JSONB,

        news_draft JSONB,

        forensics JSONB,

        verification JSONB,

        confidence_score NUMERIC DEFAULT 0,

        content_score NUMERIC DEFAULT 0,

        status TEXT,

        human_review_required BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_intelligence_entities (
        id TEXT PRIMARY KEY,

        media_hash TEXT NOT NULL,

        entity_type TEXT,

        entity_name TEXT,

        normalized_name TEXT,

        confidence NUMERIC DEFAULT 0,

        evidence JSONB,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_intelligence_transcripts (
        id TEXT PRIMARY KEY,

        media_hash TEXT NOT NULL,

        language TEXT,

        text TEXT,

        segments JSONB,

        confidence NUMERIC DEFAULT 0,

        provider TEXT,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_intelligence_ocr (
        id TEXT PRIMARY KEY,

        media_hash TEXT NOT NULL,

        language TEXT,

        text TEXT,

        blocks JSONB,

        confidence NUMERIC DEFAULT 0,

        provider TEXT,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_intelligence_scenes (
        id TEXT PRIMARY KEY,

        media_hash TEXT NOT NULL,

        scene_index INTEGER,

        start_time NUMERIC,

        end_time NUMERIC,

        description TEXT,

        objects JSONB,

        entities JSONB,

        confidence NUMERIC DEFAULT 0,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_media_intelligence_hash
      ON ez_media_intelligence(media_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_media_intelligence_type
      ON ez_media_intelligence(media_type)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_media_intelligence_status
      ON ez_media_intelligence(status)
    `);
  }

  /*
   * ==========================================================
   * INITIALIZE
   * ==========================================================
   */

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
      "media-intelligence.initialized",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /*
   * ==========================================================
   * NORMALIZE MEDIA
   * ==========================================================
   */

  function normalizeMedia(
    input
  ) {
    const media =
      input.media ||
      input;

    const mediaType =
      detectMediaType(
        media
      );

    return {
      mediaType,

      mimeType:
        clean(
          media.mimeType ||
          media.mimetype
        ),

      fileName:
        clean(
          media.fileName ||
          media.name
        ),

      filePath:
        clean(
          media.filePath ||
          media.path
        ),

      fileUrl:
        clean(
          media.fileUrl ||
          media.url
        ),

      mediaHash:
        clean(
          media.mediaHash ||
          media.sha256 ||
          media.hash
        ),

      fileSize:
        Number(
          media.fileSize ||
          media.size ||
          0
        ),

      width:
        Number(
          media.width ||
          0
        ),

      height:
        Number(
          media.height ||
          0
        ),

      duration:
        Number(
          media.duration ||
          0
        ),

      language:
        clean(
          media.language
        ),

      metadata:
        media.metadata ||
        {},

      source:
        media.source ||
        {},

      content:
        media.content ||
        null,

      buffer:
        media.buffer ||
        null,

      frames:
        Array.isArray(
          media.frames
        )
          ? media.frames
          : [],

      transcript:
        clean(
          media.transcript
        ),

      ocrText:
        clean(
          media.ocrText
        ),

      claimedContext:
        media.claimedContext ||
        {},

      providerData:
        media.providerData ||
        {}
    };
  }

  function detectMediaType(
    media
  ) {
    const mime =
      clean(
        media.mimeType ||
        media.mimetype
      ).toLowerCase();

    if (
      mime.startsWith(
        "image/"
      )
    ) {
      return "image";
    }

    if (
      mime.startsWith(
        "video/"
      )
    ) {
      return "video";
    }

    if (
      mime.startsWith(
        "audio/"
      )
    ) {
      return "audio";
    }

    if (
      mime.includes(
        "pdf"
      )
    ) {
      return "document";
    }

    const name =
      clean(
        media.fileName ||
        media.name
      ).toLowerCase();

    if (
      /\.(jpg|jpeg|png|webp|gif|heic|avif)$/.test(
        name
      )
    ) {
      return "image";
    }

    if (
      /\.(mp4|mov|webm|mkv|avi)$/.test(
        name
      )
    ) {
      return "video";
    }

    if (
      /\.(mp3|wav|m4a|aac|ogg|flac)$/.test(
        name
      )
    ) {
      return "audio";
    }

    return "unknown";
  }

  /*
   * ==========================================================
   * MAIN ANALYSIS
   * ==========================================================
   */

  async function analyzeMedia(
    input = {}
  ) {
    const started =
      Date.now();

    const media =
      normalizeMedia(
        input
      );

    if (
      !media.mediaType ||
      media.mediaType ===
        "unknown"
    ) {
      throw new Error(
        "Unsupported media type"
      );
    }

    if (
      !media.mediaHash
    ) {
      media.mediaHash =
        calculateMediaHash(
          media
        );
    }

    const analysis = {
      id:
        id(
          "media-intelligence"
        ),

      mediaHash:
        media.mediaHash,

      mediaType:
        media.mediaType,

      mimeType:
        media.mimeType,

      fileName:
        media.fileName,

      language:
        media.language ||
        null,

      detectedLanguages:
        [],

      transcript:
        media.transcript ||
        "",

      ocrText:
        media.ocrText ||
        "",

      summary:
        "",

      headline:
        "",

      caption:
        "",

      translation:
        {},

      entities:
        [],

      keywords:
        [],

      topics:
        [],

      scenes:
        [],

      objects:
        [],

      locations:
        [],

      organizations:
        [],

      people:
        [],

      claims:
        [],

      sentiment:
        null,

      editorialAnalysis:
        null,

      newsDraft:
        null,

      forensics:
        null,

      verification:
        null,

      confidenceScore:
        0,

      contentScore:
        0,

      status:
        "processing",

      humanReviewRequired:
        false,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    try {
      emit(
        "media-intelligence.analysis.started",
        {
          id:
            analysis.id,

          mediaHash:
            analysis.mediaHash,

          mediaType:
            analysis.mediaType
        }
      );

      /*
       * ------------------------------------------------------
       * 1. LANGUAGE
       * ------------------------------------------------------
       */

      const language =
        await detectLanguage(
          media,
          analysis
        );

      analysis.language =
        language.language;

      analysis.detectedLanguages =
        language.languages;

      /*
       * ------------------------------------------------------
       * 2. OCR
       * ------------------------------------------------------
       */

      if (
        media.mediaType ===
          "image" ||
        media.mediaType ===
          "video" ||
        media.mediaType ===
          "document"
      ) {
        const ocr =
          await runOCR(
            media
          );

        analysis.ocrText =
          limitText(
            ocr.text
          );

        if (
          ocr.language &&
          !analysis.language
        ) {
          analysis.language =
            ocr.language;
        }

        state.statistics.ocrRuns++;

        await persistOCR(
          analysis.mediaHash,
          ocr
        );
      }

      /*
       * ------------------------------------------------------
       * 3. TRANSCRIPTION
       * ------------------------------------------------------
       */

      if (
        media.mediaType ===
        "audio" ||
        media.mediaType ===
        "video"
      ) {
        const transcription =
          await transcribe(
            media
          );

        analysis.transcript =
          limitText(
            transcription.text
          );

        if (
          transcription.language &&
          !analysis.language
        ) {
          analysis.language =
            transcription.language;
        }

        state.statistics
          .transcriptionRuns++;

        await persistTranscript(
          analysis.mediaHash,
          transcription
        );
      }

      /*
       * ------------------------------------------------------
       * 4. VISION
       * ------------------------------------------------------
       */

      if (
        media.mediaType ===
          "image" ||
        media.mediaType ===
          "video"
      ) {
        const vision =
          await analyzeVision(
            media
          );

        analysis.scenes =
          vision.scenes
            .slice(
              0,
              maxScenes
            );

        analysis.objects =
          vision.objects || [];

        analysis.entities =
          mergeEntities(
            analysis.entities,
            vision.entities
          );

        analysis.locations =
          uniqueStrings(
            vision.locations ||
              []
          );

        analysis.organizations =
          uniqueStrings(
            vision.organizations ||
              []
          );

        analysis.people =
          uniqueStrings(
            vision.people ||
              []
          );

        state.statistics.visionRuns++;

        await persistScenes(
          analysis.mediaHash,
          analysis.scenes
        );
      }

      /*
       * ------------------------------------------------------
       * 5. TEXT AGGREGATION
       * ------------------------------------------------------
       */

      const combinedText =
        buildCombinedText(
          media,
          analysis
        );

      /*
       * ------------------------------------------------------
       * 6. AI TEXT UNDERSTANDING
       * ------------------------------------------------------
       */

      const languageAnalysis =
        await analyzeText(
          combinedText,
          {
            language:
              analysis.language,

            mediaType:
              media.mediaType
          }
        );

      if (
        languageAnalysis
      ) {
        analysis.entities =
          mergeEntities(
            analysis.entities,
            languageAnalysis.entities
          );

        analysis.keywords =
          uniqueStrings(
            languageAnalysis.keywords ||
              []
          ).slice(
            0,
            maxKeywords
          );

        analysis.topics =
          uniqueStrings(
            languageAnalysis.topics ||
              []
          );

        analysis.claims =
          languageAnalysis.claims ||
          [];

        analysis.sentiment =
          languageAnalysis.sentiment ||
          null;

        if (
          languageAnalysis.language
        ) {
          analysis.language =
            languageAnalysis.language;
        }

        analysis.detectedLanguages =
          uniqueStrings([
            ...analysis.detectedLanguages,
            ...(languageAnalysis.detectedLanguages ||
              [])
          ]);
      }

      /*
       * ------------------------------------------------------
       * 7. SUMMARY
       * ------------------------------------------------------
       */

      analysis.summary =
        await generateSummary(
          combinedText,
          analysis
        );

      state.statistics.summaries++;

      /*
       * ------------------------------------------------------
       * 8. HEADLINE
       * ------------------------------------------------------
       */

      analysis.headline =
        await generateHeadline(
          combinedText,
          analysis
        );

      /*
       * ------------------------------------------------------
       * 9. CAPTION
       * ------------------------------------------------------
       */

      analysis.caption =
        await generateCaption(
          media,
          analysis
        );

      /*
       * ------------------------------------------------------
       * 10. TRANSLATION
       * ------------------------------------------------------
       */

      if (
        input.translateTo
      ) {
        analysis.translation =
          await translate(
            combinedText,
            analysis.language,
            input.translateTo
          );

        state.statistics
          .translationRuns++;
      }

      /*
       * ------------------------------------------------------
       * 11. EDITORIAL INTELLIGENCE
       * ------------------------------------------------------
       */

      analysis.editorialAnalysis =
        await editorialAnalysis(
          combinedText,
          analysis
        );

      /*
       * ------------------------------------------------------
       * 12. NEWS DRAFT
       * ------------------------------------------------------
       */

      if (
        input.generateNews !==
        false
      ) {
        analysis.newsDraft =
          await generateNewsDraft(
            combinedText,
            analysis
          );

        state.statistics
          .newsDrafts++;
      }

      /*
       * ------------------------------------------------------
       * 13. CODE 70
       * ------------------------------------------------------
       */

      if (
        mediaForensicsEngine &&
        typeof mediaForensicsEngine
          .analyzeMedia ===
          "function"
      ) {
        try {
          analysis.forensics =
            await mediaForensicsEngine
              .analyzeMedia(
                media
              );
        } catch (error) {
          logger.warn(
            "[CODE71] CODE70 failed:",
            error.message
          );
        }
      }

      /*
       * ------------------------------------------------------
       * 14. CODE 69
       * ------------------------------------------------------
       */

      if (
        externalVerificationEngine &&
        typeof externalVerificationEngine
          .verifyAndEnrich ===
          "function"
      ) {
        try {
          analysis.verification =
            await externalVerificationEngine
              .verifyAndEnrich({
                claim:
                  analysis.headline,

                title:
                  analysis.headline,

                description:
                  analysis.summary,

                content:
                  combinedText,

                storyHash:
                  hash(
                    combinedText
                  ),

                sources:
                  media.source
                    ? [media.source]
                    : []
              });
        } catch (error) {
          logger.warn(
            "[CODE71] CODE69 failed:",
            error.message
          );
        }
      }

      /*
       * ------------------------------------------------------
       * 15. CONTENT SCORE
       * ------------------------------------------------------
       */

      analysis.contentScore =
        calculateContentScore(
          analysis
        );

      analysis.confidenceScore =
        calculateConfidence(
          analysis
        );

      /*
       * ------------------------------------------------------
       * 16. HUMAN REVIEW
       * ------------------------------------------------------
       */

      analysis.humanReviewRequired =
        requiresHumanReview(
          analysis
        );

      analysis.status =
        analysis.humanReviewRequired
          ? "human_review"
          : "ready";

      analysis.updatedAt =
        now();

      /*
       * ------------------------------------------------------
       * SAVE
       * ------------------------------------------------------
       */

      state.analyses.set(
        analysis.mediaHash,
        analysis
      );

      updateStatistics(
        analysis,
        Date.now() -
          started
      );

      await persistAnalysis(
        analysis
      );

      emit(
        "media-intelligence.analysis.completed",
        {
          analysis:
            clone(analysis)
        }
      );

      return clone(
        analysis
      );
    } catch (error) {
      state.statistics.failed++;

      analysis.status =
        "failed";

      emit(
        "media-intelligence.analysis.failed",
        {
          id:
            analysis.id,

          mediaHash:
            analysis.mediaHash,

          error:
            error.message
        }
      );

      throw error;
    }
  }

  /*
   * ==========================================================
   * HASH
   * ==========================================================
   */

  function calculateMediaHash(
    media
  ) {
    if (
      media.buffer
    ) {
      try {
        return crypto
          .createHash(
            "sha256"
          )
          .update(
            media.buffer
          )
          .digest(
            "hex"
          );
      } catch {
        // fallback
      }
    }

    return hash({
      fileName:
        media.fileName,

      mimeType:
        media.mimeType,

      fileSize:
        media.fileSize,

      width:
        media.width,

      height:
        media.height,

      duration:
        media.duration,

      metadata:
        media.metadata
    });
  }

  /*
   * ==========================================================
   * LANGUAGE
   * ==========================================================
   */

  async function detectLanguage(
    media,
    analysis
  ) {
    if (
      media.language
    ) {
      return {
        language:
          media.language,

        languages: [
          media.language
        ]
      };
    }

    if (
      providers.language &&
      typeof providers.language.detect ===
        "function"
    ) {
      try {
        return await providers
          .language
          .detect(
            media
          );
      } catch (error) {
        logger.warn(
          "[CODE71] Language provider failed:",
          error.message
        );
      }
    }

    const text =
      [
        media.transcript,
        media.ocrText,
        media.content
      ]
        .filter(Boolean)
        .join(" ");

    if (
      /[\u0600-\u06FF]/.test(
        text
      )
    ) {
      return {
        language:
          "ar",

        languages: [
          "ar"
        ]
      };
    }

    if (
      /[A-Za-z]/.test(
        text
      )
    ) {
      return {
        language:
          "en",

        languages: [
          "en"
        ]
      };
    }

    return {
      language:
        null,

      languages:
        []
    };
  }

  /*
   * ==========================================================
   * OCR
   * ==========================================================
   */

  async function runOCR(
    media
  ) {
    if (
      media.ocrText
    ) {
      return {
        text:
          media.ocrText,

        language:
          media.language ||
          null,

        blocks:
          [],

        confidence:
          100,

        provider:
          "provided"
      };
    }

    if (
      providers.ocr &&
      typeof providers.ocr.extract ===
        "function"
    ) {
      try {
        return await providers
          .ocr
          .extract(
            media
          );
      } catch (error) {
        logger.warn(
          "[CODE71] OCR provider failed:",
          error.message
        );
      }
    }

    return {
      text:
        "",

      language:
        null,

      blocks:
        [],

      confidence:
        0,

      provider:
        "unavailable"
    };
  }

  /*
   * ==========================================================
   * SPEECH TO TEXT
   * ==========================================================
   */

  async function transcribe(
    media
  ) {
    if (
      media.transcript
    ) {
      return {
        text:
          media.transcript,

        language:
          media.language ||
          null,

        segments:
          [],

        confidence:
          100,

        provider:
          "provided"
      };
    }

    if (
      providers.transcription &&
      typeof providers.transcription.transcribe ===
        "function"
    ) {
      try {
        return await providers
          .transcription
          .transcribe(
            media
          );
      } catch (error) {
        logger.warn(
          "[CODE71] Transcription provider failed:",
          error.message
        );
      }
    }

    return {
      text:
        "",

      language:
        null,

      segments:
        [],

      confidence:
        0,

      provider:
        "unavailable"
    };
  }

  /*
   * ==========================================================
   * VISION
   * ==========================================================
   */

  async function analyzeVision(
    media
  ) {
    if (
      providers.vision &&
      typeof providers.vision.analyze ===
        "function"
    ) {
      try {
        return await providers
          .vision
          .analyze(
            media
          );
      } catch (error) {
        logger.warn(
          "[CODE71] Vision provider failed:",
          error.message
        );
      }
    }

    return {
      scenes:
        [],

      objects:
        [],

      entities:
        [],

      locations:
        [],

      organizations:
        [],

      people:
        [],

      confidence:
        0,

      provider:
        "unavailable"
    };
  }

  /*
   * ==========================================================
   * TEXT ANALYSIS
   * ==========================================================
   */

  async function analyzeText(
    text,
    context
  ) {
    if (
      !text
    ) {
      return null;
    }

    const limited =
      limitText(
        text
      );

    if (
      aiCore &&
      typeof aiCore.analyzeContent ===
        "function"
    ) {
      try {
        return await aiCore
          .analyzeContent({
            content:
              limited,

            context: {
              mediaType:
                context.mediaType,

              language:
                context.language
            }
          });
      } catch (error) {
        logger.warn(
          "[CODE71] AI text analysis failed:",
          error.message
        );
      }
    }

    return {
      language:
        context.language ||
        null,

      detectedLanguages:
        context.language
          ? [context.language]
          : [],

      entities:
        [],

      keywords:
        [],

      topics:
        [],

      claims:
        [],

      sentiment:
        null
    };
  }

  /*
   * ==========================================================
   * SUMMARY
   * ==========================================================
   */

  async function generateSummary(
    text,
    analysis
  ) {
    if (
      !text
    ) {
      return "";
    }

    if (
      aiCore &&
      typeof aiCore.summarize ===
        "function"
    ) {
      try {
        const result =
          await aiCore.summarize(
            limitText(text),
            {
              mediaType:
                analysis.mediaType,

              language:
                analysis.language,

              style:
                "journalistic"
            }
          );

        return clean(
          typeof result ===
            "string"
            ? result
            : result.summary ||
              result.text ||
              ""
        );
      } catch (error) {
        logger.warn(
          "[CODE71] Summary failed:",
          error.message
        );
      }
    }

    return limitText(
      text,
      1000
    );
  }

  /*
   * ==========================================================
   * HEADLINE
   * ==========================================================
   */

  async function generateHeadline(
    text,
    analysis
  ) {
    if (
      !text
    ) {
      return "";
    }

    if (
      aiCore &&
      typeof aiCore.generateTitle ===
        "function"
    ) {
      try {
        const result =
          await aiCore.generateTitle(
            limitText(text),
            {
              language:
                analysis.language,

              style:
                "news"
            }
          );

        return clean(
          typeof result ===
            "string"
            ? result
            : result.title ||
              result.text ||
              ""
        );
      } catch (error) {
        logger.warn(
          "[CODE71] Headline generation failed:",
          error.message
        );
      }
    }

    return clean(
      analysis.summary
    ).slice(
      0,
      140
    );
  }

  /*
   * ==========================================================
   * CAPTION
   * ==========================================================
   */

  async function generateCaption(
    media,
    analysis
  ) {
    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        const result =
          await aiCore.request({
            operation:
              "generate-caption",

            mediaType:
              media.mediaType,

            summary:
              analysis.summary,

            objects:
              analysis.objects,

            scenes:
              analysis.scenes,

            entities:
              analysis.entities,

            language:
              analysis.language
          });

        return clean(
          result?.caption ||
            result?.text ||
            ""
        );
      } catch (error) {
        logger.warn(
          "[CODE71] Caption generation failed:",
          error.message
        );
      }
    }

    return "";
  }

  /*
   * ==========================================================
   * TRANSLATION
   * ==========================================================
   */

  async function translate(
    text,
    from,
    to
  ) {
    if (
      !text ||
      !to
    ) {
      return {};
    }

    if (
      aiCore &&
      typeof aiCore.translate ===
        "function"
    ) {
      try {
        return await aiCore.translate(
          limitText(text),
          {
            from,
            to
          }
        );
      } catch (error) {
        logger.warn(
          "[CODE71] Translation failed:",
          error.message
        );
      }
    }

    return {
      sourceLanguage:
        from ||
        null,

      targetLanguage:
        to,

      text:
        ""
    };
  }

  /*
   * ==========================================================
   * EDITORIAL ANALYSIS
   * ==========================================================
   */

  async function editorialAnalysis(
    text,
    analysis
  ) {
    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        return await aiCore.request({
          operation:
            "editorial-analysis",

          content:
            limitText(text),

          mediaType:
            analysis.mediaType,

          entities:
            analysis.entities,

          topics:
            analysis.topics,

          claims:
            analysis.claims,

          language:
            analysis.language
        });
      } catch (error) {
        logger.warn(
          "[CODE71] Editorial analysis failed:",
          error.message
        );
      }
    }

    return {
      newsworthiness:
        0,

      urgency:
        0,

      publicInterest:
        0,

      sensitivity:
        0,

      recommendation:
        "human_review"
    };
  }

  /*
   * ==========================================================
   * NEWS DRAFT
   * ==========================================================
   */

  async function generateNewsDraft(
    text,
    analysis
  ) {
    if (
      !text &&
      !analysis.scenes.length &&
      !analysis.ocrText
    ) {
      return null;
    }

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        const result =
          await aiOrchestrator.process(
            {
              operation:
                "analyze-content",

              content:
                limitText(text),

              mediaType:
                analysis.mediaType,

              transcript:
                analysis.transcript,

              ocr:
                analysis.ocrText,

              entities:
                analysis.entities,

              scenes:
                analysis.scenes
            }
          );

        return {
          type:
            "media-news-draft",

          headline:
            analysis.headline,

          summary:
            analysis.summary,

          body:
            result?.content ||
            result?.text ||
            analysis.summary,

          source:
            "CODE71",

          requiresReview:
            true
        };
      } catch (error) {
        logger.warn(
          "[CODE71] News draft orchestration failed:",
          error.message
        );
      }
    }

    return {
      type:
        "media-news-draft",

      headline:
        analysis.headline,

      summary:
        analysis.summary,

      body:
        analysis.summary,

      source:
        "CODE71",

      requiresReview:
        true
    };
  }

  /*
   * ==========================================================
   * SCORE
   * ==========================================================
   */

  function calculateContentScore(
    analysis
  ) {
    let score =
      0;

    if (
      analysis.summary
    ) {
      score +=
        15;
    }

    if (
      analysis.headline
    ) {
      score +=
        10;
    }

    if (
      analysis.language
    ) {
      score +=
        10;
    }

    if (
      analysis.entities.length
    ) {
      score +=
        15;
    }

    if (
      analysis.keywords.length
    ) {
      score +=
        10;
    }

    if (
      analysis.topics.length
    ) {
      score +=
        10;
    }

    if (
      analysis.transcript ||
      analysis.ocrText
    ) {
      score +=
        15;
    }

    if (
      analysis.scenes.length
    ) {
      score +=
        10;
    }

    return clamp(
      score
    );
  }

  function calculateConfidence(
    analysis
  ) {
    let score =
      40;

    if (
      analysis.language
    ) {
      score +=
        10;
    }

    if (
      analysis.transcript ||
      analysis.ocrText
    ) {
      score +=
        15;
    }

    if (
      analysis.entities.length
    ) {
      score +=
        10;
    }

    if (
      analysis.forensics
    ) {
      score +=
        10;
    }

    if (
      analysis.verification
    ) {
      score +=
        10;
    }

    if (
      analysis.source
    ) {
      score +=
        5;
    }

    return clamp(
      score
    );
  }

  /*
   * ==========================================================
   * HUMAN REVIEW
   * ==========================================================
   */

  function requiresHumanReview(
    analysis
  ) {
    if (
      !analysis.summary
    ) {
      return true;
    }

    if (
      analysis.confidenceScore <
      70
    ) {
      return true;
    }

    if (
      analysis.forensics &&
      analysis.forensics
        .humanReviewRequired
    ) {
      return true;
    }

    if (
      analysis.verification &&
      analysis.verification
        .humanReviewRequired
    ) {
      return true;
    }

    return false;
  }

  /*
   * ==========================================================
   * TEXT HELPERS
   * ==========================================================
   */

  function buildCombinedText(
    media,
    analysis
  ) {
    return limitText(
      [
        media.content,
        analysis.transcript,
        analysis.ocrText
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  function limitText(
    text,
    customLimit
  ) {
    const value =
      clean(text);

    return value.slice(
      0,
      customLimit ||
        maxTextLength
    );
  }

  function uniqueStrings(
    values
  ) {
    return [
      ...new Set(
        (Array.isArray(values)
          ? values
          : [])
          .map(
            value =>
              clean(value)
          )
          .filter(Boolean)
      )
    ];
  }

  function mergeEntities(
    first = [],
    second = []
  ) {
    const result =
      [];

    const seen =
      new Set();

    for (
      const entity of [
        ...(first || []),
        ...(second || [])
      ]
    ) {
      const name =
        clean(
          entity?.name ||
            entity?.entity ||
            entity?.text
        );

      if (
        !name
      ) {
        continue;
      }

      const key =
        normalize(
          name
        );

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      result.push({
        ...entity,

        name,

        normalizedName:
          key
      });

      if (
        result.length >=
        maxEntities
      ) {
        break;
      }
    }

    return result;
  }

  /*
   * ==========================================================
   * PERSISTENCE
   * ==========================================================
   */

  async function persistAnalysis(
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
      INSERT INTO ez_media_intelligence (
        id,
        media_hash,
        media_type,
        mime_type,
        file_name,
        language,
        detected_languages,
        transcript,
        ocr_text,
        summary,
        headline,
        caption,
        translation,
        entities,
        keywords,
        topics,
        scenes,
        objects,
        locations,
        organizations,
        people,
        claims,
        sentiment,
        editorial_analysis,
        news_draft,
        forensics,
        verification,
        confidence_score,
        content_score,
        status,
        human_review_required,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,
        $30,$31,NOW()
      )
      ON CONFLICT(media_hash)
      DO UPDATE SET
        language =
          EXCLUDED.language,

        detected_languages =
          EXCLUDED.detected_languages,

        transcript =
          EXCLUDED.transcript,

        ocr_text =
          EXCLUDED.ocr_text,

        summary =
          EXCLUDED.summary,

        headline =
          EXCLUDED.headline,

        caption =
          EXCLUDED.caption,

        translation =
          EXCLUDED.translation,

        entities =
          EXCLUDED.entities,

        keywords =
          EXCLUDED.keywords,

        topics =
          EXCLUDED.topics,

        scenes =
          EXCLUDED.scenes,

        objects =
          EXCLUDED.objects,

        locations =
          EXCLUDED.locations,

        organizations =
          EXCLUDED.organizations,

        people =
          EXCLUDED.people,

        claims =
          EXCLUDED.claims,

        sentiment =
          EXCLUDED.sentiment,

        editorial_analysis =
          EXCLUDED.editorial_analysis,

        news_draft =
          EXCLUDED.news_draft,

        forensics =
          EXCLUDED.forensics,

        verification =
          EXCLUDED.verification,

        confidence_score =
          EXCLUDED.confidence_score,

        content_score =
          EXCLUDED.content_score,

        status =
          EXCLUDED.status,

        human_review_required =
          EXCLUDED.human_review_required,

        updated_at =
          NOW()
      `,
      [
        analysis.id,
        analysis.mediaHash,
        analysis.mediaType,
        analysis.mimeType,
        analysis.fileName,
        analysis.language,
        JSON.stringify(
          analysis.detectedLanguages
        ),
        analysis.transcript,
        analysis.ocrText,
        analysis.summary,
        analysis.headline,
        analysis.caption,
        JSON.stringify(
          analysis.translation
        ),
        JSON.stringify(
          analysis.entities
        ),
        JSON.stringify(
          analysis.keywords
        ),
        JSON.stringify(
          analysis.topics
        ),
        JSON.stringify(
          analysis.scenes
        ),
        JSON.stringify(
          analysis.objects
        ),
        JSON.stringify(
          analysis.locations
        ),
        JSON.stringify(
          analysis.organizations
        ),
        JSON.stringify(
          analysis.people
        ),
        JSON.stringify(
          analysis.claims
        ),
        JSON.stringify(
          analysis.sentiment
        ),
        JSON.stringify(
          analysis.editorialAnalysis
        ),
        JSON.stringify(
          analysis.newsDraft
        ),
        JSON.stringify(
          analysis.forensics
        ),
        JSON.stringify(
          analysis.verification
        ),
        analysis.confidenceScore,
        analysis.contentScore,
        analysis.status,
        analysis.humanReviewRequired
      ]
    );

    await persistEntities(
      analysis
    );
  }

  async function persistEntities(
    analysis
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    for (
      const entity of
        analysis.entities
    ) {
      await persistence.query(
        `
        INSERT INTO ez_media_intelligence_entities (
          id,
          media_hash,
          entity_type,
          entity_name,
          normalized_name,
          confidence,
          evidence,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8
        )
        ON CONFLICT(id)
        DO NOTHING
        `,
        [
          id("entity"),
          analysis.mediaHash,
          clean(
            entity.type ||
              "unknown"
          ),
          entity.name,
          entity.normalizedName ||
            normalize(
              entity.name
            ),
          clamp(
            entity.confidence ||
              0
          ),
          JSON.stringify(
            entity.evidence ||
              {}
          ),
          JSON.stringify(
            entity.metadata ||
              {}
          )
        ]
      );
    }
  }

  async function persistOCR(
    mediaHash,
    ocr
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    if (
      !ocr.text
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_media_intelligence_ocr (
        id,
        media_hash,
        language,
        text,
        blocks,
        confidence,
        provider,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        id("ocr"),
        mediaHash,
        ocr.language ||
          null,
        ocr.text,
        JSON.stringify(
          ocr.blocks ||
            []
        ),
        clamp(
          ocr.confidence ||
            0
        ),
        ocr.provider ||
          "unknown",
        JSON.stringify(
          ocr.metadata ||
            {}
        )
      ]
    );
  }

  async function persistTranscript(
    mediaHash,
    transcript
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    if (
      !transcript.text
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_media_intelligence_transcripts (
        id,
        media_hash,
        language,
        text,
        segments,
        confidence,
        provider,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        id("transcript"),
        mediaHash,
        transcript.language ||
          null,
        transcript.text,
        JSON.stringify(
          transcript.segments ||
            []
        ),
        clamp(
          transcript.confidence ||
            0
        ),
        transcript.provider ||
          "unknown",
        JSON.stringify(
          transcript.metadata ||
            {}
        )
      ]
    );
  }

  async function persistScenes(
    mediaHash,
    scenes
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    for (
      let index = 0;
      index < scenes.length;
      index++
    ) {
      const scene =
        scenes[index];

      await persistence.query(
        `
        INSERT INTO ez_media_intelligence_scenes (
          id,
          media_hash,
          scene_index,
          start_time,
          end_time,
          description,
          objects,
          entities,
          confidence,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        `,
        [
          id("scene"),
          mediaHash,
          index,
          Number(
            scene.startTime ||
              0
          ),
          Number(
            scene.endTime ||
              0
          ),
          clean(
            scene.description
          ),
          JSON.stringify(
            scene.objects ||
              []
          ),
          JSON.stringify(
            scene.entities ||
              []
          ),
          clamp(
            scene.confidence ||
              0
          ),
          JSON.stringify(
            scene.metadata ||
              {}
          )
        ]
      );
    }
  }

  /*
   * ==========================================================
   * STATISTICS
   * ==========================================================
   */

  function updateStatistics(
    analysis,
    durationMs
  ) {
    state.statistics.totalAnalyses++;

    if (
      analysis.mediaType ===
      "image"
    ) {
      state.statistics.images++;
    }

    if (
      analysis.mediaType ===
      "video"
    ) {
      state.statistics.videos++;
    }

    if (
      analysis.mediaType ===
      "audio"
    ) {
      state.statistics.audio++;
    }

    if (
      analysis.mediaType ===
      "document"
    ) {
      state.statistics.documents++;
    }

    if (
      analysis.humanReviewRequired
    ) {
      state.statistics.humanReviews++;
    }

    state.statistics.totalDurationMs +=
      durationMs;

    state.statistics.averageDurationMs =
      state.statistics.totalDurationMs /
      state.statistics.totalAnalyses;

    state.statistics.entitiesExtracted +=
      analysis.entities.length;

    state.statistics.keywordsExtracted +=
      analysis.keywords.length;
  }

  /*
   * ==========================================================
   * GETTERS
   * ==========================================================
   */

  function getAnalysis(
    mediaHash
  ) {
    return clone(
      state.analyses.get(
        mediaHash
      ) || null
    );
  }

  function getStatistics() {
    return {
      ...state.statistics,

      activeAnalyses:
        state.analyses.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Media Intelligence & Content Understanding",

      code:
        "71",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      integrations: {
        persistence:
          Boolean(
            persistence
          ),

        aiCore:
          Boolean(
            aiCore
          ),

        aiProvider:
          Boolean(
            aiProvider
          ),

        aiOrchestrator:
          Boolean(
            aiOrchestrator
          ),

        mediaForensics:
          Boolean(
            mediaForensicsEngine
          ),

        externalVerification:
          Boolean(
            externalVerificationEngine
          ),

        newsVerification:
          Boolean(
            newsVerificationEngine
          ),

        sourceIntelligence:
          Boolean(
            sourceIntelligence
          ),

        automation:
          Boolean(
            automationEngine
          ),

        mediaService:
          Boolean(
            mediaService
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
      "media-intelligence.started",
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
      "media-intelligence.stopped",
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

    analyzeMedia,

    getAnalysis,

    getStatistics,

    getStatus,

    health,

    on
  };
}

module.exports = {
  createMediaIntelligenceEngine
};
