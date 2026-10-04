'use strict';

/**
 * ============================================================
 * EZ MEDIA 11.0
 * INTELLIGENT MEDIA EVENT INTELLIGENCE ENGINE
 * CODE 120
 * ============================================================
 *
 * محرك ذكاء الأحداث الإعلامية
 *
 * المسؤوليات:
 * 1. استقبال الأحداث
 * 2. تنظيف البيانات
 * 3. تصنيف الحدث
 * 4. تحليل الأهمية
 * 5. تحليل المخاطر
 * 6. تحديد الأولوية
 * 7. تقييم الثقة
 * 8. تحديد الحاجة إلى موافقة بشرية
 * 9. بناء الإجراءات المقترحة
 * 10. تجهيز الحدث لمركز العمليات الذاتية
 *
 * لا يقوم هذا المحرك بالنشر الخارجي بنفسه.
 * ============================================================
 */

const crypto = require('crypto');

class IntelligentMediaEventIntelligenceEngine {
  constructor(options = {}) {
    this.name =
      'intelligent-media-event-intelligence';

    this.version = '120.0.0';

    this.enabled =
      options.enabled !== false &&
      String(
        process.env.MEDIA_EVENT_INTELLIGENCE_ENABLED ??
        'true'
      ).toLowerCase() !== 'false';

    this.maxTextLength = Number(
      process.env.MEDIA_EVENT_MAX_TEXT_LENGTH ||
      50000
    );

    this.maxSources = Number(
      process.env.MEDIA_EVENT_MAX_SOURCES ||
      100
    );

    this.minBreakingScore = Number(
      process.env.MEDIA_EVENT_MIN_BREAKING_SCORE ||
      80
    );

    this.minImportantScore = Number(
      process.env.MEDIA_EVENT_MIN_IMPORTANT_SCORE ||
      60
    );

    this.createdAt =
      new Date().toISOString();

    this.eventsProcessed = 0;

    this.categories = [
      'breaking',
      'politics',
      'economy',
      'technology',
      'security',
      'sports',
      'culture',
      'society',
      'health',
      'environment',
      'business',
      'local',
      'international',
      'media',
      'general'
    ];

    this.risks = [
      'low',
      'medium',
      'high',
      'critical'
    ];

    this.priorities = [
      'low',
      'normal',
      'important',
      'breaking'
    ];
  }

  /*
   * ============================================================
   * HEALTH
   * ============================================================
   */

  health() {
    return {
      success: true,
      service: this.name,
      version: this.version,
      status: this.enabled
        ? 'healthy'
        : 'disabled',

      enabled: this.enabled,

      statistics: {
        eventsProcessed:
          this.eventsProcessed
      },

      timestamp:
        new Date().toISOString()
    };
  }

  /*
   * ============================================================
   * STATUS
   * ============================================================
   */

  status() {
    return {
      success: true,

      service: this.name,

      enabled: this.enabled,

      version: this.version,

      uptime: {
        initializedAt:
          this.createdAt
      },

      statistics: {
        eventsProcessed:
          this.eventsProcessed
      },

      timestamp:
        new Date().toISOString()
    };
  }

  /*
   * ============================================================
   * TEXT NORMALIZATION
   * ============================================================
   */

  normalizeText(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return '';
    }

    return String(value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(
        0,
        this.maxTextLength
      );
  }

  /*
   * ============================================================
   * ID
   * ============================================================
   */

  createEventId() {
    return (
      'evt_' +
      Date.now() +
      '_' +
      crypto
        .randomBytes(6)
        .toString('hex')
    );
  }

  /*
   * ============================================================
   * SOURCES
   * ============================================================
   */

  normalizeSources(sources) {
    if (
      !Array.isArray(sources)
    ) {
      return [];
    }

    return sources
      .slice(0, this.maxSources)
      .map(
        (source, index) => {
          if (
            typeof source ===
            'string'
          ) {
            return {
              id:
                `source_${index + 1}`,

              name:
                this.normalizeText(
                  source
                ),

              url: null,

              trusted: false,

              type:
                'unknown'
            };
          }

          return {
            id:
              source?.id ||
              `source_${index + 1}`,

            name:
              this.normalizeText(
                source?.name ||
                'مصدر غير معروف'
              ),

            url:
              source?.url ||
              null,

            trusted:
              Boolean(
                source?.trusted
              ),

            type:
              source?.type ||
              'unknown'
          };
        }
      );
  }

  /*
   * ============================================================
   * KEYWORD DATABASE
   * ============================================================
   */

  getKeywords() {
    return {

      politics: [
        'سياسة',
        'سياسي',
        'رئيس',
        'وزير',
        'حكومة',
        'حكومي',
        'برلمان',
        'انتخابات',
        'دبلوماسية',
        'اتفاقية',
        'president',
        'minister',
        'government',
        'politics'
      ],

      economy: [
        'اقتصاد',
        'اقتصادية',
        'اقتصادي',
        'سوق',
        'أسهم',
        'بورصة',
        'بنك',
        'نفط',
        'استثمار',
        'تضخم',
        'economy',
        'market',
        'bank',
        'oil',
        'investment'
      ],

      technology: [
        'تقنية',
        'تقنيات',
        'تكنولوجيا',
        'ذكاء اصطناعي',
        'روبوت',
        'برمجيات',
        'حاسوب',
        'رقمي',
        'تقني',
        'technology',
        'artificial intelligence',
        'robot',
        'software'
      ],

      security: [
        'أمن',
        'أمني',
        'هجوم',
        'دفاع',
        'أزمة أمنية',
        'حادث أمني',
        'إرهاب',
        'تهديد',
        'انفجار',
        'security',
        'attack',
        'defense',
        'terror',
        'explosion'
      ],

      sports: [
        'رياضة',
        'رياضي',
        'مباراة',
        'بطولة',
        'دوري',
        'لاعب',
        'منتخب',
        'كرة',
        'sports',
        'match',
        'league',
        'player'
      ],

      health: [
        'صحة',
        'صحي',
        'مرض',
        'مستشفى',
        'دواء',
        'وباء',
        'فيروس',
        'health',
        'hospital',
        'disease',
        'virus'
      ],

      environment: [
        'بيئة',
        'بيئي',
        'مناخ',
        'تلوث',
        'طقس',
        'حرارة',
        'أمطار',
        'environment',
        'climate',
        'pollution',
        'weather'
      ],

      business: [
        'شركة',
        'شركات',
        'صفقة',
        'استثمار',
        'رئيس تنفيذي',
        'مشروع',
        'business',
        'company',
        'investment',
        'deal'
      ],

      culture: [
        'ثقافة',
        'ثقافي',
        'فن',
        'فنان',
        'سينما',
        'مسرح',
        'كتاب',
        'culture',
        'artist',
        'cinema'
      ],

      media: [
        'إعلام',
        'إعلامي',
        'صحافة',
        'صحفي',
        'قناة',
        'مذيع',
        'محتوى',
        'media',
        'journalism',
        'channel'
      ]
    };
  }

  /*
   * ============================================================
   * CATEGORY DETECTION
   * ============================================================
   */

  detectCategory(input) {
    const text = (
      `${input.title || ''} ` +
      `${input.description || ''}`
    ).toLowerCase();

    const keywords =
      this.getKeywords();

    let bestCategory =
      'general';

    let bestScore = 0;

    for (
      const [category, words]
      of Object.entries(
        keywords
      )
    ) {
      let score = 0;

      for (
        const word of words
      ) {
        if (
          text.includes(
            word.toLowerCase()
          )
        ) {
          score += 1;
        }
      }

      if (
        score > bestScore
      ) {
        bestScore =
          score;

        bestCategory =
          category;
      }
    }

    return bestCategory;
  }

  /*
   * ============================================================
   * RISK DETECTION
   * ============================================================
   */

  detectRisk(input) {
    const text = (
      `${input.title || ''} ` +
      `${input.description || ''}`
    ).toLowerCase();

    const critical =
      [
        'حرب',
        'هجوم',
        'انفجار',
        'ضحايا',
        'وفاة',
        'وفيات',
        'كارثة',
        'إخلاء',
        'إرهاب',
        'تهديد إرهابي',
        'war',
        'attack',
        'explosion',
        'terror',
        'casualties'
      ];

    const high =
      [
        'عاجل',
        'طوارئ',
        'أزمة',
        'تحذير',
        'تهديد',
        'أمني',
        'emergency',
        'crisis',
        'warning',
        'threat'
      ];

    const medium =
      [
        'مهم',
        'تطور',
        'قرار',
        'إعلان',
        'important',
        'development',
        'decision'
      ];

    if (
      critical.some(
        word =>
          text.includes(word)
      )
    ) {
      return 'critical';
    }

    if (
      high.some(
        word =>
          text.includes(word)
      )
    ) {
      return 'high';
    }

    if (
      input.category ===
      'security'
    ) {
      return 'high';
    }

    if (
      medium.some(
        word =>
          text.includes(word)
      )
    ) {
      return 'medium';
    }

    return 'low';
  }

  /*
   * ============================================================
   * IMPORTANCE SCORE
   * ============================================================
   */

  calculateImportance(input) {
    let score = 20;

    const text = (
      `${input.title || ''} ` +
      `${input.description || ''}`
    ).toLowerCase();

    const sources =
      Array.isArray(
        input.sources
      )
        ? input.sources
        : [];

    /*
     * عدد المصادر
     */
    score += Math.min(
      sources.length * 5,
      20
    );

    /*
     * مصدر موثوق
     */
    if (
      sources.some(
        source =>
          source.trusted === true
      )
    ) {
      score += 15;
    }

    /*
     * التصنيف
     */
    const categoryBonus = {
      breaking: 25,
      security: 20,
      politics: 12,
      economy: 10,
      international: 10,
      technology: 8,
      business: 8,
      health: 8,
      environment: 7,
      sports: 5,
      culture: 5,
      media: 5,
      local: 5,
      society: 5,
      general: 0
    };

    score +=
      categoryBonus[
        input.category
      ] || 0;

    /*
     * كلمات عاجلة
     */
    const urgentWords = [
      'عاجل',
      'عاجلة',
      'الآن',
      'فورًا',
      'طوارئ',
      'breaking',
      'urgent',
      'now',
      'emergency'
    ];

    if (
      urgentWords.some(
        word =>
          text.includes(word)
      )
    ) {
      score += 20;
    }

    /*
     * المملكة العربية السعودية
     */
    const saudiWords = [
      'السعودية',
      'المملكة',
      'الرياض',
      'مكة',
      'المدينة',
      'جدة',
      'saudi arabia',
      'saudi'
    ];

    if (
      saudiWords.some(
        word =>
          text.includes(word)
      )
    ) {
      score += 5;
    }

    return Math.max(
      0,
      Math.min(
        100,
        score
      )
    );
  }

  /*
   * ============================================================
   * PRIORITY
   * ============================================================
   */

  classifyPriority(
    score,
    risk
  ) {
    if (
      risk ===
        'critical' ||
      score >=
        this.minBreakingScore
    ) {
      return 'breaking';
    }

    if (
      risk === 'high' ||
      score >=
        this.minImportantScore
    ) {
      return 'important';
    }

    if (
      score >= 40
    ) {
      return 'normal';
    }

    return 'low';
  }

  /*
   * ============================================================
   * CONFIDENCE
   * ============================================================
   */

  calculateConfidence(
    input
  ) {
    let confidence = 40;

    if (
      input.title
    ) {
      confidence += 10;
    }

    if (
      input.description
    ) {
      confidence += 5;
    }

    if (
      input.sources.length >= 2
    ) {
      confidence += 15;
    }

    if (
      input.sources.some(
        source =>
          source.trusted === true
      )
    ) {
      confidence += 15;
    }

    if (
      input.category !==
      'general'
    ) {
      confidence += 5;
    }

    if (
      input.risk ===
      'critical'
    ) {
      confidence -= 5;
    }

    return Math.max(
      0,
      Math.min(
        95,
        confidence
      )
    );
  }

  /*
   * ============================================================
   * HUMAN APPROVAL
   * ============================================================
   */

  requiresHumanApproval(
    input
  ) {
    if (
      input.risk ===
        'critical' ||
      input.risk ===
        'high'
    ) {
      return true;
    }

    if (
      input.priority ===
      'breaking'
    ) {
      return true;
    }

    return false;
  }

  /*
   * ============================================================
   * RECOMMENDED ACTIONS
   * ============================================================
   */

  buildRecommendedActions(
    input
  ) {
    const actions = [];

    actions.push(
      'classify_event'
    );

    if (
      input.sources.length === 0
    ) {
      actions.push(
        'find_additional_sources'
      );
    }

    if (
      input.sources.length > 0
    ) {
      actions.push(
        'verify_sources'
      );
    }

    if (
      input.priority ===
      'breaking'
    ) {
      actions.push(
        'breaking_news_review'
      );

      actions.push(
        'editorial_review'
      );

      actions.push(
        'prepare_distribution'
      );
    }

    if (
      input.priority ===
      'important'
    ) {
      actions.push(
        'editorial_review'
      );

      actions.push(
        'prepare_content'
      );
    }

    if (
      input.risk ===
        'high' ||
      input.risk ===
        'critical'
    ) {
      actions.push(
        'human_approval_required'
      );
    }

    actions.push(
      'store_event_memory'
    );

    return [
      ...new Set(
        actions
      )
    ];
  }

  /*
   * ============================================================
   * EXPLANATION
   * ============================================================
   */

  buildExplanation(
    input
  ) {
    const reasons = [];

    reasons.push(
      `التصنيف: ${input.category}`
    );

    reasons.push(
      `الأهمية: ${input.importanceScore}/100`
    );

    reasons.push(
      `المخاطر: ${input.risk}`
    );

    reasons.push(
      `الأولوية: ${input.priority}`
    );

    reasons.push(
      `الثقة: ${input.confidence}%`
    );

    if (
      input.requiresHumanApproval
    ) {
      reasons.push(
        'الموافقة البشرية مطلوبة'
      );
    }

    return reasons.join(
      ' | '
    );
  }

  /*
   * ============================================================
   * NORMALIZE EVENT
   * ============================================================
   */

  normalizeEvent(
    event = {}
  ) {
    const normalized = {
      id:
        event.id ||
        this.createEventId(),

      title:
        this.normalizeText(
          event.title
        ),

      description:
        this.normalizeText(
          event.description
        ),

      source:
        this.normalizeText(
          event.source
        ) ||
        'unknown',

      sources:
        this.normalizeSources(
          event.sources
        ),

      url:
        event.url ||
        null,

      location:
        this.normalizeText(
          event.location
        ) ||
        null,

      language:
        event.language ||
        'ar',

      receivedAt:
        event.receivedAt ||
        new Date().toISOString(),

      metadata:
        event.metadata &&
        typeof event.metadata ===
          'object'
          ? event.metadata
          : {}
    };

    return normalized;
  }

  /*
   * ============================================================
   * MAIN ANALYSIS
   * ============================================================
   */

  analyze(
    event = {}
  ) {
    if (
      !this.enabled
    ) {
      return {
        success: false,

        enabled: false,

        error:
          'MEDIA_EVENT_INTELLIGENCE_DISABLED'
      };
    }

    const normalized =
      this.normalizeEvent(
        event
      );

    normalized.category =
      this.categories.includes(
        event.category
      )
        ? event.category
        : this.detectCategory(
            normalized
          );

    normalized.risk =
      this.detectRisk(
        normalized
      );

    normalized.importanceScore =
      this.calculateImportance(
        normalized
      );

    normalized.priority =
      this.classifyPriority(
        normalized.importanceScore,
        normalized.risk
      );

    normalized.confidence =
      this.calculateConfidence(
        normalized
      );

    normalized.requiresHumanApproval =
      this.requiresHumanApproval(
        normalized
      );

    normalized.recommendedActions =
      this.buildRecommendedActions(
        normalized
      );

    normalized.aiDecision = {
      decision:
        normalized.priority ===
        'breaking'
          ? 'escalate'
          : normalized.priority ===
              'important'
            ? 'review'
            : 'monitor',

      confidence:
        normalized.confidence,

      explanation:
        this.buildExplanation(
          normalized
        )
    };

    this.eventsProcessed += 1;

    return {
      success: true,

      engine:
        this.name,

      version:
        this.version,

      event:
        normalized,

      timestamp:
        new Date().toISOString()
    };
  }

  /*
   * ============================================================
   * PROCESS
   * ============================================================
   */

  async processEvent(
    event = {}
  ) {
    const analysis =
      this.analyze(
        event
      );

    if (
      !analysis.success
    ) {
      return analysis;
    }

    return {
      success: true,

      analysis,

      operationRequest: {
        eventId:
          analysis.event.id,

        title:
          analysis.event.title,

        description:
          analysis.event.description,

        category:
          analysis.event.category,

        risk:
          analysis.event.risk,

        priority:
          analysis.event.priority,

        importanceScore:
          analysis.event.importanceScore,

        confidence:
          analysis.event.confidence,

        requiresHumanApproval:
          analysis.event
            .requiresHumanApproval,

        recommendedActions:
          analysis.event
            .recommendedActions
      },

      timestamp:
        new Date().toISOString()
    };
  }
}

module.exports =
  IntelligentMediaEventIntelligenceEngine;
