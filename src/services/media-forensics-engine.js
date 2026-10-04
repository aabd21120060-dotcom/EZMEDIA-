"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 70
 * VISUAL VERIFICATION & MEDIA FORENSICS ENGINE
 * ============================================================
 *
 * التحقق الجنائي الرقمي للصور والفيديو والصوت.
 *
 * الوظائف:
 *
 * 1. فحص نوع الملف
 * 2. حساب SHA-256
 * 3. فحص MIME
 * 4. تحليل الحجم
 * 5. قراءة Metadata إذا تم توفيرها
 * 6. فحص التناقضات الزمنية
 * 7. فحص المصدر
 * 8. فحص إعادة الاستخدام
 * 9. مقارنة الادعاء بالمحتوى
 * 10. تحليل مؤشرات التلاعب
 * 11. تحليل مؤشرات AI-generated
 * 12. إنشاء Evidence Package
 * 13. إرسال النتيجة إلى CODE 68
 * 14. Human Review Gate
 *
 * لا يتم اعتبار أي مؤشر منفرد دليلاً قاطعاً.
 */

const crypto =
  require("crypto");

const EventEmitter =
  require("events");

function createMediaForensicsEngine(
  options = {}
) {
  const {
    persistence = null,

    aiCore = null,

    aiOrchestrator = null,

    externalVerificationEngine = null,

    newsVerificationEngine = null,

    sourceIntelligence = null,

    notificationService = null,

    eventBus = null,

    logger = console,

    maxFileSize =
      Number(
        process.env.MEDIA_FORENSICS_MAX_FILE_SIZE ||
        500 * 1024 * 1024
      ),

    manipulationReviewThreshold =
      Number(
        process.env.MEDIA_FORENSICS_MANIPULATION_REVIEW_THRESHOLD ||
        55
      ),

    aiGeneratedReviewThreshold =
      Number(
        process.env.MEDIA_FORENSICS_AI_REVIEW_THRESHOLD ||
        60
      ),

    autoClearThreshold =
      Number(
        process.env.MEDIA_FORENSICS_AUTO_CLEAR_THRESHOLD ||
        85
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

      verified: 0,

      suspicious: 0,

      manipulated: 0,

      aiGeneratedSuspected: 0,

      humanReviews: 0,

      rejected: 0,

      insufficientEvidence: 0,

      totalManipulationScore: 0,

      averageManipulationScore: 0,

      totalAIScore: 0,

      averageAIScore: 0
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

    return Math.min(
      max,
      Math.max(
        min,
        number
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

  function sha256(
    value
  ) {
    return crypto
      .createHash("sha256")
      .update(value)
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
        "[CODE70] Event error:",
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
      CREATE TABLE IF NOT EXISTS ez_media_forensics (
        id TEXT PRIMARY KEY,

        media_hash TEXT UNIQUE NOT NULL,

        media_type TEXT,

        mime_type TEXT,

        file_name TEXT,

        file_size BIGINT,

        width INTEGER,

        height INTEGER,

        duration NUMERIC,

        manipulation_score NUMERIC DEFAULT 0,

        ai_generated_score NUMERIC DEFAULT 0,

        authenticity_score NUMERIC DEFAULT 0,

        metadata_score NUMERIC DEFAULT 0,

        provenance_score NUMERIC DEFAULT 0,

        reuse_score NUMERIC DEFAULT 0,

        verification_status TEXT,

        decision TEXT,

        human_review_required BOOLEAN DEFAULT FALSE,

        indicators JSONB,

        metadata JSONB,

        source JSONB,

        ai_analysis JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_forensics_indicators (
        id TEXT PRIMARY KEY,

        media_hash TEXT NOT NULL,

        indicator_type TEXT,

        severity TEXT,

        score NUMERIC DEFAULT 0,

        description TEXT,

        evidence JSONB,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_provenance (
        id TEXT PRIMARY KEY,

        media_hash TEXT NOT NULL,

        source_name TEXT,

        source_url TEXT,

        source_type TEXT,

        original_url TEXT,

        original_hash TEXT,

        captured_at TIMESTAMPTZ,

        uploaded_at TIMESTAMPTZ,

        location JSONB,

        chain JSONB,

        verified BOOLEAN DEFAULT FALSE,

        confidence_score NUMERIC DEFAULT 0,

        metadata JSONB,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_media_forensics_hash
      ON ez_media_forensics(media_hash)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_media_forensics_type
      ON ez_media_forensics(media_type)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_media_forensics_status
      ON ez_media_forensics(verification_status)
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
      "media-forensics.initialized",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* =========================================================
     Analyze Media
  ========================================================= */

  async function analyzeMedia(
    input = {}
  ) {
    if (
      !input
    ) {
      throw new Error(
        "media input is required"
      );
    }

    const media =
      normalizeMediaInput(
        input
      );

    validateMedia(
      media
    );

    const mediaHash =
      media.sha256 ||
      calculateMediaHash(
        media
      );

    const analysis = {
      id:
        createId(
          "forensics"
        ),

      mediaHash,

      mediaType:
        media.mediaType,

      mimeType:
        media.mimeType,

      fileName:
        media.fileName,

      fileSize:
        media.fileSize,

      width:
        media.width,

      height:
        media.height,

      duration:
        media.duration,

      manipulationScore:
        0,

      aiGeneratedScore:
        0,

      authenticityScore:
        0,

      metadataScore:
        0,

      provenanceScore:
        0,

      reuseScore:
        0,

      verificationStatus:
        "insufficient_evidence",

      decision:
        "human_review_required",

      humanReviewRequired:
        true,

      indicators: [],

      metadata:
        media.metadata || {},

      source:
        media.source || {},

      aiAnalysis:
        null,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    emit(
      "media-forensics.analysis.started",
      {
        id:
          analysis.id,

        mediaHash
      }
    );

    /*
     * 1. Metadata
     */

    const metadataResult =
      analyzeMetadata(
        media
      );

    analysis.metadataScore =
      metadataResult.score;

    analysis.indicators.push(
      ...metadataResult.indicators
    );

    /*
     * 2. Provenance
     */

    const provenanceResult =
      analyzeProvenance(
        media
      );

    analysis.provenanceScore =
      provenanceResult.score;

    analysis.indicators.push(
      ...provenanceResult.indicators
    );

    /*
     * 3. Media structure
     */

    const structureResult =
      analyzeStructure(
        media
      );

    analysis.indicators.push(
      ...structureResult.indicators
    );

    /*
     * 4. Reuse
     */

    const reuseResult =
      await analyzeReuse(
        media
      );

    analysis.reuseScore =
      reuseResult.score;

    analysis.indicators.push(
      ...reuseResult.indicators
    );

    /*
     * 5. Manipulation
     */

    const manipulationResult =
      await analyzeManipulation(
        media
      );

    analysis.manipulationScore =
      manipulationResult.score;

    analysis.indicators.push(
      ...manipulationResult.indicators
    );

    /*
     * 6. AI-generated
     */

    const aiResult =
      await analyzeAIGenerated(
        media
      );

    analysis.aiGeneratedScore =
      aiResult.score;

    analysis.indicators.push(
      ...aiResult.indicators
    );

    /*
     * 7. Authenticity
     */

    analysis.authenticityScore =
      calculateAuthenticity(
        analysis
      );

    /*
     * 8. AI review
     */

    analysis.aiAnalysis =
      await runAIAnalysis(
        media,
        analysis
      );

    /*
     * 9. Final decision
     */

    const decision =
      decide(
        analysis
      );

    analysis.verificationStatus =
      decision.status;

    analysis.decision =
      decision.decision;

    analysis.humanReviewRequired =
      decision.humanReviewRequired;

    /*
     * حفظ
     */

    state.analyses.set(
      mediaHash,
      analysis
    );

    updateStatistics(
      analysis
    );

    await persistAnalysis(
      analysis
    );

    emit(
      "media-forensics.analysis.completed",
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
     Normalize Input
  ========================================================= */

  function normalizeMediaInput(
    input
  ) {
    const media =
      input.media ||
      input;

    return {
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

      mimeType:
        clean(
          media.mimeType ||
          media.mimetype
        ),

      mediaType:
        detectMediaType(
          media
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

      sha256:
        clean(
          media.sha256 ||
          media.hash
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

      perceptualHash:
        clean(
          media.perceptualHash
        ),

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

      claimedDate:
        media.claimedDate ||
        null,

      claimedLocation:
        media.claimedLocation ||
        null,

      metadataTimestamp:
        media.metadataTimestamp ||
        null
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
      ) ||
      mime.includes(
        "document"
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

  function validateMedia(
    media
  ) {
    if (
      media.fileSize >
      maxFileSize
    ) {
      throw new Error(
        "Media file exceeds configured maximum size"
      );
    }

    if (
      !media.fileName &&
      !media.sha256 &&
      !media.buffer
    ) {
      throw new Error(
        "Media requires fileName, sha256, or buffer"
      );
    }
  }

  /* =========================================================
     Hash
  ========================================================= */

  function calculateMediaHash(
    media
  ) {
    if (
      media.buffer
    ) {
      try {
        return sha256(
          media.buffer
        );
      } catch {
        // continue
      }
    }

    return sha256(
      [
        media.fileName,
        media.mimeType,
        media.fileSize,
        media.width,
        media.height,
        media.duration,
        JSON.stringify(
          media.metadata
        )
      ].join("|")
    );
  }

  /* =========================================================
     Metadata Analysis
  ========================================================= */

  function analyzeMetadata(
    media
  ) {
    const indicators =
      [];

    let score =
      50;

    const metadata =
      media.metadata ||
      {};

    const hasCreationTime =
      Boolean(
        metadata.DateTimeOriginal ||
        metadata.CreateDate ||
        metadata.creationTime ||
        media.metadataTimestamp
      );

    const hasDevice =
      Boolean(
        metadata.Make ||
        metadata.Model ||
        metadata.device
      );

    const hasGPS =
      Boolean(
        metadata.GPSLatitude ||
        metadata.GPSLongitude ||
        metadata.gps
      );

    const software =
      clean(
        metadata.Software ||
        metadata.software
      );

    if (
      hasCreationTime
    ) {
      score +=
        15;
    } else {
      indicators.push(
        createIndicator(
          "metadata_missing_timestamp",
          "low",
          10,
          "لا توجد بيانات زمنية موثوقة داخل Metadata المقدمة."
        )
      );
    }

    if (
      hasDevice
    ) {
      score +=
        10;
    }

    if (
      hasGPS
    ) {
      score +=
        10;
    }

    if (
      software
    ) {
      const editingSoftware =
        [
          "photoshop",
          "lightroom",
          "after effects",
          "premiere",
          "davinci",
          "gimp",
          "canva"
        ];

      const normalizedSoftware =
        software.toLowerCase();

      if (
        editingSoftware.some(
          item =>
            normalizedSoftware.includes(
              item
            )
        )
      ) {
        indicators.push(
          createIndicator(
            "editing_software_metadata",
            "medium",
            25,
            "Metadata تشير إلى برنامج تحرير أو معالجة."
          )
        );

        score -=
          15;
      }
    }

    return {
      score:
        clamp(score),

      indicators
    };
  }

  /* =========================================================
     Provenance
  ========================================================= */

  function analyzeProvenance(
    media
  ) {
    const indicators =
      [];

    let score =
      40;

    const source =
      media.source ||
      {};

    if (
      source.official
    ) {
      score +=
        25;
    }

    if (
      source.verified
    ) {
      score +=
        20;
    }

    if (
      source.originalUrl
    ) {
      score +=
        15;
    }

    if (
      source.sourceName
    ) {
      score +=
        5;
    }

    if (
      source.chain
    ) {
      score +=
        10;
    }

    if (
      !source.sourceName &&
      !source.originalUrl
    ) {
      indicators.push(
        createIndicator(
          "unknown_provenance",
          "medium",
          20,
          "سلسلة مصدر المحتوى غير مكتملة."
        )
      );
    }

    return {
      score:
        clamp(score),

      indicators
    };
  }

  /* =========================================================
     Structure
  ========================================================= */

  function analyzeStructure(
    media
  ) {
    const indicators =
      [];

    let score =
      50;

    if (
      media.mediaType ===
      "image"
    ) {
      if (
        media.width > 0 &&
        media.height > 0
      ) {
        score +=
          10;
      }

      if (
        media.width &&
        media.height
      ) {
        const ratio =
          media.width /
          media.height;

        /*
         * النسب غير المعتادة لا تعني تلاعباً.
         * فقط نسجلها كمؤشر منخفض.
         */

        if (
          ratio < 0.25 ||
          ratio > 4
        ) {
          indicators.push(
            createIndicator(
              "unusual_aspect_ratio",
              "low",
              5,
              "أبعاد الوسائط غير معتادة."
            )
          );
        }
      }
    }

    if (
      media.mediaType ===
      "video"
    ) {
      if (
        media.duration > 0
      ) {
        score +=
          10;
      }

      if (
        media.frames.length
      ) {
        score +=
          10;
      }
    }

    if (
      media.mediaType ===
      "audio"
    ) {
      if (
        media.duration > 0
      ) {
        score +=
          10;
      }
    }

    return {
      score:
        clamp(score),

      indicators
    };
  }

  /* =========================================================
     Reuse Analysis
  ========================================================= */

  async function analyzeReuse(
    media
  ) {
    const indicators =
      [];

    let score =
      50;

    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      indicators.push(
        createIndicator(
          "reuse_database_unavailable",
          "low",
          0,
          "لم يتم توفير سجل بحث كامل لإعادة استخدام المحتوى."
        )
      );

      return {
        score,
        indicators
      };
    }

    try {
      const result =
        await persistence.query(
          `
          SELECT
            media_hash,
            file_name,
            source,
            created_at
          FROM ez_media_forensics
          WHERE media_hash = $1
          LIMIT 5
          `,
          [
            media.sha256 ||
            calculateMediaHash(
              media
            )
          ]
        );

      if (
        result.rows &&
        result.rows.length
      ) {
        indicators.push(
          createIndicator(
            "previously_seen_media",
            "medium",
            20,
            "تم العثور على نسخة سابقة من نفس البصمة الرقمية."
          )
        );

        score -=
          10;
      } else {
        score +=
          10;
      }
    } catch (error) {
      logger.warn(
        "[CODE70] Reuse analysis failed:",
        error.message
      );
    }

    return {
      score:
        clamp(score),

      indicators
    };
  }

  /* =========================================================
     Manipulation
  ========================================================= */

  async function analyzeManipulation(
    media
  ) {
    const indicators =
      [];

    let score =
      10;

    /*
     * لا نعتبر وجود Metadata لبرنامج تحرير
     * دليلاً كافياً وحده.
     */

    const editingIndicator =
      media.metadata &&
      clean(
        media.metadata.Software ||
        media.metadata.software
      );

    if (
      editingIndicator
    ) {
      score +=
        20;
    }

    /*
     * اختلافات الصور/الفريمات يمكن توفيرها
     * من طبقة تحليل متخصصة لاحقاً.
     */

    if (
      Array.isArray(
        media.frames
      ) &&
      media.frames.length >= 2
    ) {
      const frameResults =
        compareFrames(
          media.frames
        );

      score +=
        frameResults.score;

      indicators.push(
        ...frameResults.indicators
      );
    }

    /*
     * إذا أرسل مزود خارجي نتيجة تحليل:
     */

    if (
      media.metadata &&
      media.metadata.forensics
    ) {
      const external =
        media.metadata.forensics;

      if (
        external.manipulationScore !==
        undefined
      ) {
        score =
          Math.max(
            score,
            clamp(
              external.manipulationScore
            )
          );
      }
    }

    return {
      score:
        clamp(score),

      indicators
    };
  }

  function compareFrames(
    frames
  ) {
    const indicators =
      [];

    let score =
      0;

    /*
     * هذه طبقة مؤشرات فقط.
     * التحليل العميق للـ pixels يجب أن يتم
     * عبر Media Forensics Provider متخصص.
     */

    for (
      let i = 1;
      i < frames.length;
      i++
    ) {
      const previous =
        frames[i - 1];

      const current =
        frames[i];

      if (
        previous.hash &&
        current.hash &&
        previous.hash ===
          current.hash
      ) {
        indicators.push(
          createIndicator(
            "duplicate_frame",
            "low",
            5,
            "تم العثور على فريمات متطابقة."
          )
        );
      }
    }

    return {
      score:
        clamp(score),

      indicators
    };
  }

  /* =========================================================
     AI Generated Analysis
  ========================================================= */

  async function analyzeAIGenerated(
    media
  ) {
    const indicators =
      [];

    let score =
      0;

    /*
     * إذا وفر النظام نتيجة من مزود متخصص.
     */

    const detector =
      media.metadata &&
      media.metadata.aiDetection;

    if (
      detector &&
      detector.score !==
        undefined
    ) {
      score =
        clamp(
          detector.score
        );

      indicators.push(
        createIndicator(
          "external_ai_detection",
          score >= 70
            ? "high"
            : "medium",
          score,
          "تم استلام نتيجة من مزود كشف محتوى مولد بالذكاء الاصطناعي."
        )
      );

      return {
        score,
        indicators
      };
    }

    /*
     * لا نخمن من شكل الملف.
     */

    indicators.push(
      createIndicator(
        "ai_detection_unavailable",
        "low",
        0,
        "لم يتم توفير مزود متخصص لكشف المحتوى المولد بالذكاء الاصطناعي."
      )
    );

    return {
      score,
      indicators
    };
  }

  /* =========================================================
     AI Analysis
  ========================================================= */

  async function runAIAnalysis(
    media,
    analysis
  ) {
    if (
      !aiCore ||
      typeof aiCore.analyzeMedia !==
        "function"
    ) {
      return null;
    }

    try {
      return await aiCore.analyzeMedia({
        mediaType:
          media.mediaType,

        fileName:
          media.fileName,

        mimeType:
          media.mimeType,

        width:
          media.width,

        height:
          media.height,

        duration:
          media.duration,

        metadata:
          media.metadata,

        source:
          media.source,

        manipulationScore:
          analysis.manipulationScore,

        aiGeneratedScore:
          analysis.aiGeneratedScore,

        provenanceScore:
          analysis.provenanceScore
      });
    } catch (error) {
      logger.warn(
        "[CODE70] AI media analysis failed:",
        error.message
      );

      return null;
    }
  }

  /* =========================================================
     Authenticity
  ========================================================= */

  function calculateAuthenticity(
    analysis
  ) {
    let score =
      100;

    score -=
      analysis.manipulationScore *
      0.45;

    score -=
      analysis.aiGeneratedScore *
      0.25;

    score +=
      analysis.metadataScore *
      0.10;

    score +=
      analysis.provenanceScore *
      0.20;

    score +=
      analysis.reuseScore *
      0.05;

    return clamp(
      score
    );
  }

  /* =========================================================
     Final Decision
  ========================================================= */

  function decide(
    analysis
  ) {
    if (
      analysis.manipulationScore >=
      manipulationReviewThreshold
    ) {
      return {
        status:
          analysis.manipulationScore >=
          80
            ? "manipulated"
            : "suspicious",

        decision:
          "human_review_required",

        humanReviewRequired:
          true
      };
    }

    if (
      analysis.aiGeneratedScore >=
      aiGeneratedReviewThreshold
    ) {
      return {
        status:
          "ai_generated_suspected",

        decision:
          "human_review_required",

        humanReviewRequired:
          true
      };
    }

    if (
      analysis.authenticityScore >=
        autoClearThreshold &&
      analysis.provenanceScore >=
        60
    ) {
      return {
        status:
          "verified",

        decision:
          "media_verification_passed",

        humanReviewRequired:
          false
      };
    }

    if (
      analysis.provenanceScore <
      30
    ) {
      return {
        status:
          "insufficient_evidence",

        decision:
          "provenance_review_required",

        humanReviewRequired:
          true
      };
    }

    return {
      status:
        "suspicious",

      decision:
        "human_review_required",

      humanReviewRequired:
        true
    };
  }

  /* =========================================================
     Indicators
  ========================================================= */

  function createIndicator(
    type,
    severity,
    score,
    description
  ) {
    return {
      id:
        createId(
          "indicator"
        ),

      type,

      severity,

      score:
        clamp(score),

      description,

      createdAt:
        now()
    };
  }

  /* =========================================================
     Statistics
  ========================================================= */

  function updateStatistics(
    analysis
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
      analysis.verificationStatus ===
      "verified"
    ) {
      state.statistics.verified++;
    }

    if (
      analysis.verificationStatus ===
      "suspicious"
    ) {
      state.statistics.suspicious++;
    }

    if (
      analysis.verificationStatus ===
      "manipulated"
    ) {
      state.statistics.manipulated++;
    }

    if (
      analysis.verificationStatus ===
      "ai_generated_suspected"
    ) {
      state.statistics.aiGeneratedSuspected++;
    }

    if (
      analysis.humanReviewRequired
    ) {
      state.statistics.humanReviews++;
    }

    if (
      analysis.verificationStatus ===
      "rejected"
    ) {
      state.statistics.rejected++;
    }

    if (
      analysis.verificationStatus ===
      "insufficient_evidence"
    ) {
      state.statistics.insufficientEvidence++;
    }

    state.statistics.totalManipulationScore +=
      analysis.manipulationScore;

    state.statistics.averageManipulationScore =
      state.statistics.totalManipulationScore /
      state.statistics.totalAnalyses;

    state.statistics.totalAIScore +=
      analysis.aiGeneratedScore;

    state.statistics.averageAIScore =
      state.statistics.totalAIScore /
      state.statistics.totalAnalyses;
  }

  /* =========================================================
     Persistence
  ========================================================= */

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
      INSERT INTO ez_media_forensics (
        id,
        media_hash,
        media_type,
        mime_type,
        file_name,
        file_size,
        width,
        height,
        duration,
        manipulation_score,
        ai_generated_score,
        authenticity_score,
        metadata_score,
        provenance_score,
        reuse_score,
        verification_status,
        decision,
        human_review_required,
        indicators,
        metadata,
        source,
        ai_analysis,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,NOW()
      )
      ON CONFLICT(media_hash)
      DO UPDATE SET
        manipulation_score =
          EXCLUDED.manipulation_score,

        ai_generated_score =
          EXCLUDED.ai_generated_score,

        authenticity_score =
          EXCLUDED.authenticity_score,

        metadata_score =
          EXCLUDED.metadata_score,

        provenance_score =
          EXCLUDED.provenance_score,

        reuse_score =
          EXCLUDED.reuse_score,

        verification_status =
          EXCLUDED.verification_status,

        decision =
          EXCLUDED.decision,

        human_review_required =
          EXCLUDED.human_review_required,

        indicators =
          EXCLUDED.indicators,

        metadata =
          EXCLUDED.metadata,

        source =
          EXCLUDED.source,

        ai_analysis =
          EXCLUDED.ai_analysis,

        updated_at =
          NOW()
      `,
      [
        analysis.id,
        analysis.mediaHash,
        analysis.mediaType,
        analysis.mimeType,
        analysis.fileName,
        analysis.fileSize,
        analysis.width,
        analysis.height,
        analysis.duration,
        analysis.manipulationScore,
        analysis.aiGeneratedScore,
        analysis.authenticityScore,
        analysis.metadataScore,
        analysis.provenanceScore,
        analysis.reuseScore,
        analysis.verificationStatus,
        analysis.decision,
        analysis.humanReviewRequired,
        JSON.stringify(
          analysis.indicators
        ),
        JSON.stringify(
          analysis.metadata
        ),
        JSON.stringify(
          analysis.source
        ),
        JSON.stringify(
          analysis.aiAnalysis
        )
      ]
    );

    for (
      const indicator of
        analysis.indicators
    ) {
      await persistence.query(
        `
        INSERT INTO ez_media_forensics_indicators (
          id,
          media_hash,
          indicator_type,
          severity,
          score,
          description,
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
          indicator.id,
          analysis.mediaHash,
          indicator.type,
          indicator.severity,
          indicator.score,
          indicator.description,
          JSON.stringify(
            indicator.evidence ||
              {}
          ),
          JSON.stringify(
            indicator.metadata ||
              {}
          )
        ]
      );
    }
  }

  /* =========================================================
     Public
  ========================================================= */

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
        "EZ MEDIA Visual Verification & Media Forensics",

      code:
        "70",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      configuration: {
        maxFileSize,

        manipulationReviewThreshold,

        aiGeneratedReviewThreshold,

        autoClearThreshold
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
      "media-forensics.started",
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
      "media-forensics.stopped",
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
  createMediaForensicsEngine
};
