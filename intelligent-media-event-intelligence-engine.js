'use strict';

/**
 * EZ MEDIA 11.0
 * Intelligent Media Event Intelligence Engine
 *
 * الوظيفة:
 * - استقبال الأحداث الإعلامية
 * - تنظيف وتطبيع البيانات
 * - تحديد نوع الحدث
 * - حساب درجة الأهمية
 * - تحديد مستوى المخاطر
 * - اقتراح الإجراءات التالية
 * - تجهيز الحدث لمركز العمليات الذاتية
 *
 * ملاحظة:
 * هذا المحرك لا ينشر أي محتوى خارجيًا بنفسه.
 * التنفيذ النهائي يمر عبر طبقات الصلاحيات والموافقات.
 */

class IntelligentMediaEventIntelligenceEngine {
  constructor(options = {}) {
    this.options = options;

    this.enabled =
      options.enabled !== false &&
      String(process.env.MEDIA_EVENT_INTELLIGENCE_ENABLED ?? 'true')
        .toLowerCase() !== 'false';

    this.maxTextLength = Number(
      process.env.MEDIA_EVENT_MAX_TEXT_LENGTH || 50000
    );

    this.maxSources = Number(
      process.env.MEDIA_EVENT_MAX_SOURCES || 100
    );

    this.minBreakingScore = Number(
      process.env.MEDIA_EVENT_MIN_BREAKING_SCORE || 80
    );

    this.minImportantScore = Number(
      process.env.MEDIA_EVENT_MIN_IMPORTANT_SCORE || 60
    );

    this.version = '119.0.0';

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

    this.riskLevels = [
      'low',
      'medium',
      'high',
      'critical'
    ];

    this.initializedAt = new Date().toISOString();
  }

  health() {
    return {
      success: true,
      service: 'intelligent-media-event-intelligence-engine',
      version: this.version,
      enabled: this.enabled,
      status: this.enabled ? 'healthy' : 'disabled',
      initializedAt: this.initializedAt
    };
  }

  normalizeText(value) {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, this.maxTextLength);
  }

  normalizeSources(sources) {
    if (!Array.isArray(sources)) {
      return [];
    }

    return sources
      .slice(0, this.maxSources)
      .map((source, index) => {
        if (typeof source === 'string') {
          return {
            id: `source-${index + 1}`,
            name: source,
            url: null,
            trusted: false
          };
        }

        return {
          id: source?.id || `source-${index + 1}`,
          name: this.normalizeText(source?.name || 'مصدر غير معروف'),
          url: source?.url || null,
          trusted: Boolean(source?.trusted),
          type: source?.type || 'unknown'
        };
      });
  }

  detectCategory(input) {
    const text = `${input.title || ''} ${input.description || ''}`
      .toLowerCase();

    const keywords = {
      politics: [
        'حكومة',
        'رئيس',
        'وزير',
        'برلمان',
        'انتخابات',
        'سياسة',
        'government',
        'president',
        'minister'
      ],

      economy: [
        'اقتصاد',
        'سوق',
        'أسهم',
        'بنك',
        'نفط',
        'اقتصادية',
        'economy',
        'market',
        'bank',
        'oil'
      ],

      technology: [
        'ذكاء اصطناعي',
        'تقنية',
        'تقنيات',
        'روبوت',
        'برمجيات',
        'تكنولوجيا',
        'ai',
        'technology',
        'software',
        'robot'
      ],

      security: [
        'أمن',
        'هجوم',
        'دفاع',
        'أمني',
        'حادث أمني',
        'security',
        'attack',
        'defense'
      ],

      sports: [
        'كرة',
        'مباراة',
        'دوري',
        'بطولة',
        'رياضة',
        'sports',
        'match',
        'league'
      ],

      health: [
        'صحة',
        'مرض',
        'مستشفى',
        'دواء',
        'health',
        'hospital',
        'disease'
      ],

      environment: [
        'بيئة',
        'مناخ',
        'تلوث',
        'طقس',
        'environment',
        'climate',
        'pollution'
      ],

      business: [
        'شركة',
        'استثمار',
        'صفقة',
        'رئيس تنفيذي',
        'business',
        'company',
        'investment'
      ],

      culture: [
        'ثقافة',
        'فن',
        'سينما',
        'مسرح',
        'كتاب',
        'culture',
        'film',
        'art'
      ],

      media: [
        'إعلام',
        'صحافة',
        'مذيع',
        'قناة',
        'media',
        'journalism'
      ]
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => text.includes(word))) {
        return category;
      }
    }

    return 'general';
  }

  detectRisk(input) {
    const text = `${input.title || ''} ${input.description || ''}`
      .toLowerCase();

    const criticalWords = [
      'هجوم',
      'حرب',
      'انفجار',
      'ضحايا',
      'وفاة',
      'كارثة',
      'إخلاء',
      'إرهاب',
      'attack',
      'war',
      'explosion',
      'terror'
    ];

    const highWords = [
      'عاجل',
      'طوارئ',
      'أزمة',
      'تحذير',
      'أمني',
      'emergency',
      'crisis',
      'warning'
    ];

    if (criticalWords.some(word => text.includes(word))) {
      return 'critical';
    }

    if (highWords.some(word => text.includes(word))) {
      return 'high';
    }

    if (input.category === 'security') {
      return 'high';
    }

    return 'low';
  }

  calculateImportance(input) {
    let score = 25;

    const text = `${input.title || ''} ${input.description || ''}`
      .toLowerCase();

    const sources = input.sources || [];

    score += Math.min(sources.length * 5, 20);

    if (input.category === 'breaking') {
      score += 25;
    }

    if (input.category === 'security') {
      score += 20;
    }

    if (input.category === 'politics') {
      score += 10;
    }

    if (input.category === 'economy') {
      score += 8;
    }

    if (
      text.includes('عاجل') ||
      text.includes('breaking') ||
      text.includes('urgent')
    ) {
      score += 20;
    }

    if (
      text.includes('السعودية') ||
      text.includes('المملكة') ||
      text.includes('saudi')
    ) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  classifyPriority(score, risk) {
    if (risk === 'critical' || score >= this.minBreakingScore) {
      return 'breaking';
    }

    if (risk === 'high' || score >= this.minImportantScore) {
      return 'important';
    }

    if (score >= 40) {
      return 'normal';
    }

    return 'low';
  }

  buildRecommendedActions(input) {
    const actions = [];

    if (input.priority === 'breaking') {
      actions.push('verify_sources');
      actions.push('editorial_review');
      actions.push('prepare_breaking_news');
      actions.push('prepare_distribution');
    } else if (input.priority === 'important') {
      actions.push('verify_sources');
      actions.push('editorial_review');
      actions.push('prepare_content');
    } else {
      actions.push('classify');
      actions.push('archive_candidate');
    }

    if (
      input.risk === 'high' ||
      input.risk === 'critical'
    ) {
      actions.push('human_approval_required');
    }

    return [...new Set(actions)];
  }

  analyze(event = {}) {
    if (!this.enabled) {
      return {
        success: false,
        enabled: false,
        error: 'MEDIA_EVENT_INTELLIGENCE_DISABLED'
      };
    }

    const title = this.normalizeText(event.title);
    const description = this.normalizeText(event.description);

    const normalized = {
      id:
        event.id ||
        `event-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      title,

      description,

      source:
        this.normalizeText(event.source || '') ||
        'unknown',

      sources: this.normalizeSources(event.sources),

      receivedAt:
        event.receivedAt ||
        new Date().toISOString()
    };

    const category =
      event.category &&
      this.categories.includes(event.category)
        ? event.category
        : this.detectCategory(normalized);

    normalized.category = category;

    const risk = this.detectRisk(normalized);

    normalized.risk = risk;

    const importanceScore =
      this.calculateImportance(normalized);

    normalized.importanceScore = importanceScore;

    const priority =
      this.classifyPriority(
        importanceScore,
        risk
      );

    normalized.priority = priority;

    normalized.requiresHumanApproval =
      risk === 'high' ||
      risk === 'critical' ||
      priority === 'breaking';

    normalized.recommendedActions =
      this.buildRecommendedActions(normalized);

    normalized.aiDecision = {
      action:
        priority === 'breaking'
          ? 'escalate'
          : priority === 'important'
            ? 'review'
            : 'monitor',

      confidence: this.calculateConfidence(normalized),

      explanation:
        this.buildExplanation(normalized)
    };

    return {
      success: true,
      engine: 'intelligent-media-event-intelligence',
      version: this.version,
      event: normalized,
      timestamp: new Date().toISOString()
    };
  }

  calculateConfidence(input) {
    let confidence = 50;

    if (input.sources.length >= 2) {
      confidence += 15;
    }

    if (input.sources.some(source => source.trusted)) {
      confidence += 15;
    }

    if (input.title) {
      confidence += 5;
    }

    if (input.description) {
      confidence += 5;
    }

    if (input.category !== 'general') {
      confidence += 5;
    }

    return Math.min(95, confidence);
  }

  buildExplanation(input) {
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

    if (input.sources.length) {
      reasons.push(
        `عدد المصادر: ${input.sources.length}`
      );
    }

    if (input.requiresHumanApproval) {
      reasons.push(
        'الموافقة البشرية مطلوبة قبل التنفيذ الحساس'
      );
    }

    return reasons.join(' | ');
  }

  async processEvent(event = {}) {
    const analysis = this.analyze(event);

    if (!analysis.success) {
      return analysis;
    }

    return {
      success: true,
      analysis,
      nextStep: {
        type: 'autonomous_media_operation',
        operation: {
          eventId: analysis.event.id,
          title: analysis.event.title,
          category: analysis.event.category,
          priority: analysis.event.priority,
          risk: analysis.event.risk,
          requiresHumanApproval:
            analysis.event.requiresHumanApproval,
          recommendedActions:
            analysis.event.recommendedActions
        }
      }
    };
  }
}

module.exports =
  IntelligentMediaEventIntelligenceEngine;
