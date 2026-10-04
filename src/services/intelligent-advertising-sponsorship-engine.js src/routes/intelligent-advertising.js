"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 75
 * INTELLIGENT ADVERTISING & SPONSORSHIP ENGINE
 * ============================================================
 *
 * المسؤوليات:
 *
 * - إدارة المعلنين
 * - إدارة الرعاة
 * - إدارة الحملات
 * - إدارة الإعلانات
 * - إدارة الرعايات
 * - استهداف الجمهور
 * - اختيار المواضع الإعلانية
 * - التسعير المقترح
 * - جدولة الحملات
 * - قياس الأداء
 * - تحسين الحملات بالذكاء الاصطناعي
 * - تقارير المعلنين والرعاة
 * - ربط CODE 74 بالجمهور
 * - ربط CODE 73 بالتوزيع
 * - ربط CODE 72 بالمحتوى التحريري
 *
 * مبدأ أمني:
 * لا يتم نشر حملة أو إعلان أو رعاية
 * تلقائيًا إذا كانت تحتاج موافقة بشرية.
 */

const crypto = require("crypto");

function createIntelligentAdvertisingSponsorshipEngine(
  options = {}
) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    audienceEngine = null,
    publishingDistributionEngine = null,
    editorialNewsroomEngine = null,
    automationEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxCampaigns =
      Number(
        process.env.ADVERTISING_MAX_CAMPAIGNS || 1000
      ),

    maxAdsPerCampaign =
      Number(
        process.env.ADVERTISING_MAX_ADS_PER_CAMPAIGN || 100
      ),

    minimumAudienceScore =
      Number(
        process.env.ADVERTISING_MIN_AUDIENCE_SCORE || 45
      ),

    automaticOptimization =
      process.env.ADVERTISING_AUTO_OPTIMIZATION !==
      "false"
  } = options;

  const state = {
    initialized: false,
    running: false,

    advertisers: new Map(),
    campaigns: new Map(),
    advertisements: new Map(),
    sponsorships: new Map(),
    placements: new Map(),
    events: new Map(),
    reports: new Map(),

    statistics: {
      advertisers: 0,
      campaigns: 0,
      activeCampaigns: 0,
      advertisements: 0,
      sponsorships: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      optimizationRuns: 0,
      reportsGenerated: 0
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
      crypto
        .randomBytes(6)
        .toString("hex")
    );
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(String(value || ""))
      .digest("hex");
  }

  function clean(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function number(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    return Math.min(
      max,
      Math.max(
        min,
        number(value)
      )
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
        "[CODE75] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_advertisers (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        contact_name TEXT,

        contact_email TEXT,

        contact_phone TEXT,

        website TEXT,

        status TEXT DEFAULT 'active',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_advertising_campaigns (
        id TEXT PRIMARY KEY,

        advertiser_id TEXT,

        name TEXT NOT NULL,

        campaign_type TEXT DEFAULT 'advertising',

        objective TEXT,

        status TEXT DEFAULT 'draft',

        budget NUMERIC DEFAULT 0,

        spent NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        start_at TIMESTAMPTZ,

        end_at TIMESTAMPTZ,

        target JSONB DEFAULT '{}'::jsonb,

        placements JSONB DEFAULT '[]'::jsonb,

        settings JSONB DEFAULT '{}'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_advertisements (
        id TEXT PRIMARY KEY,

        campaign_id TEXT NOT NULL,

        title TEXT,

        description TEXT,

        media_url TEXT,

        click_url TEXT,

        ad_type TEXT DEFAULT 'display',

        status TEXT DEFAULT 'draft',

        approval_status TEXT DEFAULT 'pending',

        targeting JSONB DEFAULT '{}'::jsonb,

        placement JSONB DEFAULT '{}'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_sponsorships (
        id TEXT PRIMARY KEY,

        sponsor_id TEXT,

        name TEXT NOT NULL,

        sponsorship_type TEXT,

        status TEXT DEFAULT 'draft',

        amount NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        start_at TIMESTAMPTZ,

        end_at TIMESTAMPTZ,

        sections JSONB DEFAULT '[]'::jsonb,

        benefits JSONB DEFAULT '[]'::jsonb,

        exclusivity JSONB DEFAULT '{}'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_ad_placements (
        id TEXT PRIMARY KEY,

        campaign_id TEXT,

        advertisement_id TEXT,

        placement_key TEXT NOT NULL,

        section TEXT,

        position TEXT,

        priority INTEGER DEFAULT 0,

        status TEXT DEFAULT 'active',

        targeting JSONB DEFAULT '{}'::jsonb,

        schedule JSONB DEFAULT '{}'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_ad_events (
        id TEXT PRIMARY KEY,

        campaign_id TEXT,

        advertisement_id TEXT,

        sponsorship_id TEXT,

        visitor_id TEXT,

        event_type TEXT NOT NULL,

        value NUMERIC DEFAULT 1,

        revenue NUMERIC DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_ad_reports (
        id TEXT PRIMARY KEY,

        campaign_id TEXT,

        report_type TEXT,

        metrics JSONB DEFAULT '{}'::jsonb,

        insights JSONB DEFAULT '[]'::jsonb,

        recommendations JSONB DEFAULT '[]'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_ad_campaigns_status
      ON ez_advertising_campaigns(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_ad_events_campaign
      ON ez_ad_events(campaign_id)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_ad_events_created
      ON ez_ad_events(created_at)
    `);
  }

  /* ============================================================
     INITIALIZE
  ============================================================ */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "advertising.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     ADVERTISER
  ============================================================ */

  async function createAdvertiser(
    input = {}
  ) {
    const advertiser = {
      id:
        id("advertiser"),

      name:
        clean(input.name),

      contactName:
        clean(input.contactName),

      contactEmail:
        clean(input.contactEmail),

      contactPhone:
        clean(input.contactPhone),

      website:
        clean(input.website),

      status:
        input.status ||
        "active",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    if (
      !advertiser.name
    ) {
      throw new Error(
        "Advertiser name is required"
      );
    }

    state.advertisers.set(
      advertiser.id,
      advertiser
    );

    state.statistics.advertisers++;

    await persistAdvertiser(
      advertiser
    );

    emit(
      "advertising.advertiser.created",
      {
        advertiser:
          clone(advertiser)
      }
    );

    return clone(
      advertiser
    );
  }

  /* ============================================================
     CAMPAIGN
  ============================================================ */

  async function createCampaign(
    input = {}
  ) {
    if (
      state.campaigns.size >=
      maxCampaigns
    ) {
      throw new Error(
        "Campaign capacity reached"
      );
    }

    const campaign = {
      id:
        id("campaign"),

      advertiserId:
        clean(
          input.advertiserId
        ),

      name:
        clean(input.name),

      campaignType:
        input.campaignType ||
        "advertising",

      objective:
        input.objective ||
        "awareness",

      status:
        input.status ||
        "draft",

      budget:
        number(
          input.budget
        ),

      spent: 0,

      currency:
        input.currency ||
        "SAR",

      startAt:
        input.startAt ||
        null,

      endAt:
        input.endAt ||
        null,

      target:
        input.target ||
        {},

      placements:
        input.placements ||
        [],

      settings:
        input.settings ||
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    if (
      !campaign.name
    ) {
      throw new Error(
        "Campaign name is required"
      );
    }

    if (
      campaign.budget < 0
    ) {
      throw new Error(
        "Campaign budget cannot be negative"
      );
    }

    state.campaigns.set(
      campaign.id,
      campaign
    );

    state.statistics.campaigns++;

    if (
      campaign.status ===
      "active"
    ) {
      state.statistics.activeCampaigns++;
    }

    await persistCampaign(
      campaign
    );

    emit(
      "advertising.campaign.created",
      {
        campaign:
          clone(campaign)
      }
    );

    return clone(
      campaign
    );
  }

  /* ============================================================
     ADVERTISEMENT
  ============================================================ */

  async function createAdvertisement(
    input = {}
  ) {
    const campaign =
      state.campaigns.get(
        input.campaignId
      );

    if (!campaign) {
      throw new Error(
        "Campaign not found"
      );
    }

    const currentAds =
      Array.from(
        state.advertisements.values()
      ).filter(
        ad =>
          ad.campaignId ===
          campaign.id
      );

    if (
      currentAds.length >=
      maxAdsPerCampaign
    ) {
      throw new Error(
        "Campaign advertisement limit reached"
      );
    }

    const advertisement = {
      id:
        id("ad"),

      campaignId:
        campaign.id,

      title:
        clean(input.title),

      description:
        clean(
          input.description
        ),

      mediaUrl:
        clean(
          input.mediaUrl
        ),

      clickUrl:
        clean(
          input.clickUrl
        ),

      adType:
        input.adType ||
        "display",

      status:
        input.status ||
        "draft",

      approvalStatus:
        input.approvalStatus ||
        "pending",

      targeting:
        input.targeting ||
        {},

      placement:
        input.placement ||
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.advertisements.set(
      advertisement.id,
      advertisement
    );

    state.statistics.advertisements++;

    await persistAdvertisement(
      advertisement
    );

    emit(
      "advertising.ad.created",
      {
        advertisement:
          clone(
            advertisement
          )
      }
    );

    return clone(
      advertisement
    );
  }

  /* ============================================================
     SPONSORSHIP
  ============================================================ */

  async function createSponsorship(
    input = {}
  ) {
    const sponsorship = {
      id:
        id("sponsorship"),

      sponsorId:
        clean(
          input.sponsorId
        ),

      name:
        clean(input.name),

      sponsorshipType:
        input.sponsorshipType ||
        "section",

      status:
        input.status ||
        "draft",

      amount:
        number(
          input.amount
        ),

      currency:
        input.currency ||
        "SAR",

      startAt:
        input.startAt ||
        null,

      endAt:
        input.endAt ||
        null,

      sections:
        Array.isArray(
          input.sections
        )
          ? input.sections
          : [],

      benefits:
        Array.isArray(
          input.benefits
        )
          ? input.benefits
          : [],

      exclusivity:
        input.exclusivity ||
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    if (
      !sponsorship.name
    ) {
      throw new Error(
        "Sponsorship name is required"
      );
    }

    state.sponsorships.set(
      sponsorship.id,
      sponsorship
    );

    state.statistics.sponsorships++;

    await persistSponsorship(
      sponsorship
    );

    emit(
      "advertising.sponsorship.created",
      {
        sponsorship:
          clone(sponsorship)
      }
    );

    return clone(
      sponsorship
    );
  }

  /* ============================================================
     SMART TARGETING
  ============================================================ */

  async function analyzeCampaignTargeting(
    campaignId
  ) {
    const campaign =
      state.campaigns.get(
        campaignId
      );

    if (!campaign) {
      throw new Error(
        "Campaign not found"
      );
    }

    let audience = null;

    if (
      audienceEngine &&
      typeof audienceEngine.getStatistics ===
        "function"
    ) {
      audience =
        audienceEngine.getStatistics();
    }

    let aiAnalysis = null;

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        aiAnalysis =
          await aiCore.request({
            operation:
              "analyze-advertising",

            campaign:
              clone(campaign),

            audience
          });

        state.statistics.optimizationRuns++;
      } catch (error) {
        logger.warn(
          "[CODE75] AI targeting analysis failed:",
          error.message
        );
      }
    }

    const targeting = {
      campaignId,

      audience:

        aiAnalysis?.audience ||
        campaign.target ||
        {},

      recommendedSections:
        aiAnalysis?.recommendedSections ||
        [],

      recommendedPlacement:
        aiAnalysis?.recommendedPlacement ||
        [],

      estimatedAudience:
        aiAnalysis?.estimatedAudience ||
        0,

      confidence:
        clamp(
          aiAnalysis?.confidence ||
            0
        ),

      ai:
        aiAnalysis
    };

    campaign.target =
      targeting;

    campaign.updatedAt =
      now();

    await persistCampaign(
      campaign
    );

    return clone(
      targeting
    );
  }

  /* ============================================================
     SMART PLACEMENT
  ============================================================ */

  async function recommendPlacements(
    campaignId
  ) {
    const campaign =
      state.campaigns.get(
        campaignId
      );

    if (!campaign) {
      throw new Error(
        "Campaign not found"
      );
    }

    const possiblePlacements = [
      {
        key:
          "homepage.hero",

        section:
          "home",

        position:
          "hero",

        priority:
          100
      },

      {
        key:
          "homepage.featured",

        section:
          "home",

        position:
          "featured",

        priority:
          90
      },

      {
        key:
          "news.top",

        section:
          "news",

        position:
          "top",

        priority:
          85
      },

      {
        key:
          "news.inline",

        section:
          "news",

        position:
          "inline",

        priority:
          70
      },

      {
        key:
          "video.pre-roll",

        section:
          "video",

        position:
          "pre-roll",

        priority:
          80
      },

      {
        key:
          "article.inline",

        section:
          "articles",

        position:
          "inline",

        priority:
          65
      },

      {
        key:
          "section.sponsor",

        section:
          "section",

        position:
          "header",

        priority:
          95
      }
    ];

    let selected =
      possiblePlacements;

    if (
      campaign.target &&
      Array.isArray(
        campaign.target
          .recommendedSections
      )
    ) {
      const sections =
        new Set(
          campaign.target
            .recommendedSections
        );

      const filtered =
        possiblePlacements.filter(
          placement =>
            sections.has(
              placement.section
            )
        );

      if (
        filtered.length
      ) {
        selected =
          filtered;
      }
    }

    return selected.map(
      placement => ({
        ...placement,

        score:
          clamp(
            placement.priority
          )
      })
    );
  }

  /* ============================================================
     CREATE PLACEMENT
  ============================================================ */

  async function createPlacement(
    input = {}
  ) {
    const placement = {
      id:
        id("placement"),

      campaignId:
        clean(
          input.campaignId
        ),

      advertisementId:
        clean(
          input.advertisementId
        ),

      placementKey:
        clean(
          input.placementKey
        ),

      section:
        clean(
          input.section
        ),

      position:
        clean(
          input.position
        ),

      priority:
        number(
          input.priority
        ),

      status:
        input.status ||
        "active",

      targeting:
        input.targeting ||
        {},

      schedule:
        input.schedule ||
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    if (
      !placement.placementKey
    ) {
      throw new Error(
        "placementKey is required"
      );
    }

    state.placements.set(
      placement.id,
      placement
    );

    await persistPlacement(
      placement
    );

    return clone(
      placement
    );
  }

  /* ============================================================
     AD EVENT
  ============================================================ */

  async function trackEvent(
    input = {}
  ) {
    const event = {
      id:
        id("ad-event"),

      campaignId:
        clean(
          input.campaignId
        ),

      advertisementId:
        clean(
          input.advertisementId
        ),

      sponsorshipId:
        clean(
          input.sponsorshipId
        ),

      visitorId:
        input.visitorId
          ? hash(
              input.visitorId
            )
          : null,

      eventType:
        clean(
          input.eventType
        ),

      value:
        number(
          input.value,
          1
        ),

      revenue:
        number(
          input.revenue
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    if (
      !event.eventType
    ) {
      throw new Error(
        "eventType is required"
      );
    }

    state.events.set(
      event.id,
      event
    );

    switch (
      event.eventType
    ) {
      case "impression":
        state.statistics.impressions++;
        break;

      case "click":
        state.statistics.clicks++;
        break;

      case "conversion":
        state.statistics.conversions++;
        break;

      default:
        break;
    }

    state.statistics.revenue +=
      event.revenue;

    await persistAdEvent(
      event
    );

    emit(
      "advertising.event",
      {
        event:
          clone(event)
      }
    );

    return {
      accepted:
        true,

      event:
        clone(event)
    };
  }

  /* ============================================================
     CAMPAIGN METRICS
  ============================================================ */

  function calculateMetrics(
    campaignId
  ) {
    const events =
      Array.from(
        state.events.values()
      ).filter(
        event =>
          event.campaignId ===
          campaignId
      );

    const impressions =
      events.filter(
        e =>
          e.eventType ===
          "impression"
      ).length;

    const clicks =
      events.filter(
        e =>
          e.eventType ===
          "click"
      ).length;

    const conversions =
      events.filter(
        e =>
          e.eventType ===
          "conversion"
      ).length;

    const revenue =
      events.reduce(
        (sum, event) =>
          sum +
          number(
            event.revenue
          ),
        0
      );

    const ctr =
      impressions
        ? (clicks /
            impressions) *
          100
        : 0;

    const conversionRate =
      clicks
        ? (conversions /
            clicks) *
          100
        : 0;

    return {
      campaignId,

      impressions,

      clicks,

      conversions,

      revenue,

      ctr:
        Number(
          ctr.toFixed(2)
        ),

      conversionRate:
        Number(
          conversionRate.toFixed(
            2
          )
        )
    };
  }

  /* ============================================================
     AI OPTIMIZATION
  ============================================================ */

  async function optimizeCampaign(
    campaignId
  ) {
    const campaign =
      state.campaigns.get(
        campaignId
      );

    if (!campaign) {
      throw new Error(
        "Campaign not found"
      );
    }

    const metrics =
      calculateMetrics(
        campaignId
      );

    let ai = null;

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        ai =
          await aiOrchestrator.process({
            type:
              "advertising",

            campaign:
              clone(campaign),

            metrics
          });
      } catch (error) {
        logger.warn(
          "[CODE75] AI optimization failed:",
          error.message
        );
      }
    }

    if (
      !ai &&
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        ai =
          await aiCore.request({
            operation:
              "analyze-advertising",

            campaign:
              clone(campaign),

            metrics
          });
      } catch (error) {
        logger.warn(
          "[CODE75] AI analysis failed:",
          error.message
        );
      }
    }

    const optimization = {
      campaignId,

      metrics,

      recommendations:
        ai?.recommendations ||
        [],

      recommendedBudget:
        ai?.recommendedBudget ||
        campaign.budget,

      recommendedPlacements:
        ai?.recommendedPlacements ||
        [],

      recommendedTargeting:
        ai?.recommendedTargeting ||
        campaign.target,

      confidence:
        clamp(
          ai?.confidence ||
            0
        ),

      generatedAt:
        now()
    };

    state.statistics.optimizationRuns++;

    emit(
      "advertising.campaign.optimized",
      {
        optimization:
          clone(optimization)
      }
    );

    return optimization;
  }

  /* ============================================================
     REPORT
  ============================================================ */

  async function generateReport(
    campaignId
  ) {
    const campaign =
      state.campaigns.get(
        campaignId
      );

    if (!campaign) {
      throw new Error(
        "Campaign not found"
      );
    }

    const metrics =
      calculateMetrics(
        campaignId
      );

    const report = {
      id:
        id("ad-report"),

      campaignId,

      reportType:
        "campaign-performance",

      metrics,

      insights: [],

      recommendations: [],

      createdAt:
        now()
    };

    if (
      metrics.ctr < 1 &&
      metrics.impressions > 0
    ) {
      report.insights.push(
        "نسبة النقر الحالية منخفضة وتحتاج الحملة إلى تحسين الاستهداف أو التصميم."
      );
    }

    if (
      metrics.conversionRate > 5
    ) {
      report.insights.push(
        "الحملة تحقق معدل تحويل جيدًا مقارنة بالتفاعل المسجل."
      );
    }

    if (
      metrics.impressions === 0
    ) {
      report.insights.push(
        "لم يتم تسجيل مشاهدات للحملة حتى الآن."
      );
    }

    if (
      metrics.ctr < 2
    ) {
      report.recommendations.push(
        "اختبار موضع إعلاني مختلف."
      );

      report.recommendations.push(
        "اختبار صياغة إعلانية جديدة."
      );
    }

    if (
      automaticOptimization
    ) {
      const optimization =
        await optimizeCampaign(
          campaignId
        );

      report.insights.push(
        ...(
          optimization
            .recommendations ||
          []
        )
      );

      report.recommendations.push(
        ...(
          optimization
            .recommendedPlacements ||
          []
        )
      );
    }

    state.reports.set(
      report.id,
      report
    );

    state.statistics.reportsGenerated++;

    await persistReport(
      report
    );

    return clone(
      report
    );
  }

  /* ============================================================
     PUBLISH APPROVAL
  ============================================================ */

  async function approveAdvertisement(
    advertisementId
  ) {
    const advertisement =
      state.advertisements.get(
        advertisementId
      );

    if (!advertisement) {
      throw new Error(
        "Advertisement not found"
      );
    }

    advertisement.approvalStatus =
      "approved";

    advertisement.updatedAt =
      now();

    await persistAdvertisement(
      advertisement
    );

    emit(
      "advertising.ad.approved",
      {
        advertisement:
          clone(
            advertisement
          )
      }
    );

    return clone(
      advertisement
    );
  }

  async function rejectAdvertisement(
    advertisementId,
    reason = ""
  ) {
    const advertisement =
      state.advertisements.get(
        advertisementId
      );

    if (!advertisement) {
      throw new Error(
        "Advertisement not found"
      );
    }

    advertisement.approvalStatus =
      "rejected";

    advertisement.status =
      "rejected";

    advertisement.metadata = {
      ...(advertisement.metadata ||
        {}),

      rejectionReason:
        clean(reason)
    };

    advertisement.updatedAt =
      now();

    await persistAdvertisement(
      advertisement
    );

    return clone(
      advertisement
    );
  }

  /* ============================================================
     CAMPAIGN ACTIVATION
  ============================================================ */

  async function activateCampaign(
    campaignId
  ) {
    const campaign =
      state.campaigns.get(
        campaignId
      );

    if (!campaign) {
      throw new Error(
        "Campaign not found"
      );
    }

    campaign.status =
      "active";

    campaign.updatedAt =
      now();

    await persistCampaign(
      campaign
    );

    emit(
      "advertising.campaign.activated",
      {
        campaignId
      }
    );

    return clone(
      campaign
    );
  }

  async function pauseCampaign(
    campaignId
  ) {
    const campaign =
      state.campaigns.get(
        campaignId
      );

    if (!campaign) {
      throw new Error(
        "Campaign not found"
      );
    }

    campaign.status =
      "paused";

    campaign.updatedAt =
      now();

    await persistCampaign(
      campaign
    );

    return clone(
      campaign
    );
  }

  /* ============================================================
     DATABASE PERSISTENCE
  ============================================================ */

  async function persistAdvertiser(
    advertiser
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
      INSERT INTO ez_advertisers (
        id,
        name,
        contact_name,
        contact_email,
        contact_phone,
        website,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      ON CONFLICT(id)
      DO UPDATE SET
        name =
          EXCLUDED.name,
        contact_name =
          EXCLUDED.contact_name,
        contact_email =
          EXCLUDED.contact_email,
        contact_phone =
          EXCLUDED.contact_phone,
        website =
          EXCLUDED.website,
        status =
          EXCLUDED.status,
        metadata =
          EXCLUDED.metadata,
        updated_at =
          EXCLUDED.updated_at
      `,
      [
        advertiser.id,
        advertiser.name,
        advertiser.contactName,
        advertiser.contactEmail,
        advertiser.contactPhone,
        advertiser.website,
        advertiser.status,
        JSON.stringify(
          advertiser.metadata
        ),
        advertiser.createdAt,
        advertiser.updatedAt
      ]
    );
  }

  async function persistCampaign(
    campaign
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
      INSERT INTO ez_advertising_campaigns (
        id,
        advertiser_id,
        name,
        campaign_type,
        objective,
        status,
        budget,
        spent,
        currency,
        start_at,
        end_at,
        target,
        placements,
        settings,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,$17
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status =
          EXCLUDED.status,
        budget =
          EXCLUDED.budget,
        spent =
          EXCLUDED.spent,
        target =
          EXCLUDED.target,
        placements =
          EXCLUDED.placements,
        settings =
          EXCLUDED.settings,
        metadata =
          EXCLUDED.metadata,
        updated_at =
          EXCLUDED.updated_at
      `,
      [
        campaign.id,
        campaign.advertiserId,
        campaign.name,
        campaign.campaignType,
        campaign.objective,
        campaign.status,
        campaign.budget,
        campaign.spent,
        campaign.currency,
        campaign.startAt,
        campaign.endAt,
        JSON.stringify(
          campaign.target
        ),
        JSON.stringify(
          campaign.placements
        ),
        JSON.stringify(
          campaign.settings
        ),
        JSON.stringify(
          campaign.metadata
        ),
        campaign.createdAt,
        campaign.updatedAt
      ]
    );
  }

  async function persistAdvertisement(
    ad
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
      INSERT INTO ez_advertisements (
        id,
        campaign_id,
        title,
        description,
        media_url,
        click_url,
        ad_type,
        status,
        approval_status,
        targeting,
        placement,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14
      )
      ON CONFLICT(id)
      DO UPDATE SET
        title =
          EXCLUDED.title,
        description =
          EXCLUDED.description,
        media_url =
          EXCLUDED.media_url,
        click_url =
          EXCLUDED.click_url,
        status =
          EXCLUDED.status,
        approval_status =
          EXCLUDED.approval_status,
        targeting =
          EXCLUDED.targeting,
        placement =
          EXCLUDED.placement,
        metadata =
          EXCLUDED.metadata,
        updated_at =
          EXCLUDED.updated_at
      `,
      [
        ad.id,
        ad.campaignId,
        ad.title,
        ad.description,
        ad.mediaUrl,
        ad.clickUrl,
        ad.adType,
        ad.status,
        ad.approvalStatus,
        JSON.stringify(
          ad.targeting
        ),
        JSON.stringify(
          ad.placement
        ),
        JSON.stringify(
          ad.metadata
        ),
        ad.createdAt,
        ad.updatedAt
      ]
    );
  }

  async function persistSponsorship(
    sponsorship
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
      INSERT INTO ez_sponsorships (
        id,
        sponsor_id,
        name,
        sponsorship_type,
        status,
        amount,
        currency,
        start_at,
        end_at,
        sections,
        benefits,
        exclusivity,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14
      )
      `,
      [
        sponsorship.id,
        sponsorship.sponsorId,
        sponsorship.name,
        sponsorship.sponsorshipType,
        sponsorship.status,
        sponsorship.amount,
        sponsorship.currency,
        sponsorship.startAt,
        sponsorship.endAt,
        JSON.stringify(
          sponsorship.sections
        ),
        JSON.stringify(
          sponsorship.benefits
        ),
        JSON.stringify(
          sponsorship.exclusivity
        ),
        JSON.stringify(
          sponsorship.metadata
        ),
        sponsorship.createdAt,
        sponsorship.updatedAt
      ]
    );
  }

  async function persistPlacement(
    placement
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
      INSERT INTO ez_ad_placements (
        id,
        campaign_id,
        advertisement_id,
        placement_key,
        section,
        position,
        priority,
        status,
        targeting,
        schedule,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      `,
      [
        placement.id,
        placement.campaignId,
        placement.advertisementId,
        placement.placementKey,
        placement.section,
        placement.position,
        placement.priority,
        placement.status,
        JSON.stringify(
          placement.targeting
        ),
        JSON.stringify(
          placement.schedule
        ),
        JSON.stringify(
          placement.metadata
        )
      ]
    );
  }

  async function persistAdEvent(
    event
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
      INSERT INTO ez_ad_events (
        id,
        campaign_id,
        advertisement_id,
        sponsorship_id,
        visitor_id,
        event_type,
        value,
        revenue,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        event.id,
        event.campaignId,
        event.advertisementId,
        event.sponsorshipId,
        event.visitorId,
        event.eventType,
        event.value,
        event.revenue,
        JSON.stringify(
          event.metadata
        )
      ]
    );
  }

  async function persistReport(
    report
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
      INSERT INTO ez_ad_reports (
        id,
        campaign_id,
        report_type,
        metrics,
        insights,
        recommendations
      )
      VALUES (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        report.id,
        report.campaignId,
        report.reportType,
        JSON.stringify(
          report.metrics
        ),
        JSON.stringify(
          report.insights
        ),
        JSON.stringify(
          report.recommendations
        )
      ]
    );
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...state.statistics,

      advertiserCache:
        state.advertisers.size,

      campaignCache:
        state.campaigns.size,

      advertisementCache:
        state.advertisements.size,

      sponsorshipCache:
        state.sponsorships.size,

      placementCache:
        state.placements.size,

      eventCache:
        state.events.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Advertising & Sponsorship Engine",

      code:
        "75",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      configuration: {
        maxCampaigns,
        maxAdsPerCampaign,
        minimumAudienceScore,
        automaticOptimization
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

        audience:
          Boolean(
            audienceEngine
          ),

        publishing:
          Boolean(
            publishingDistributionEngine
          ),

        editorial:
          Boolean(
            editorialNewsroomEngine
          ),

        automation:
          Boolean(
            automationEngine
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
      "advertising.started",
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
      "advertising.stopped",
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

    createAdvertiser,
    createCampaign,
    createAdvertisement,
    createSponsorship,
    createPlacement,

    analyzeCampaignTargeting,
    recommendPlacements,

    trackEvent,

    calculateMetrics,

    optimizeCampaign,
    generateReport,

    approveAdvertisement,
    rejectAdvertisement,

    activateCampaign,
    pauseCampaign,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentAdvertisingSponsorshipEngine
};
