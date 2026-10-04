"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 77
 * INTELLIGENT CRM & SALES ENGINE
 * ============================================================
 *
 * العملاء
 * العملاء المحتملون
 * الشركات
 * المعلنون
 * الرعاة
 * الفرص البيعية
 * خط المبيعات
 * عروض الأسعار
 * المتابعات
 * المهام
 * الاجتماعات
 * توقع إغلاق الصفقات
 * AI Sales Intelligence
 * Revenue Forecast
 *
 * التكامل:
 *
 * CODE 75
 * Intelligent Advertising & Sponsorship
 *
 * CODE 76
 * Intelligent Monetization & Revenue
 *
 * ============================================================
 */

const crypto = require("crypto");

function createIntelligentCRMSalesEngine(
  options = {}
) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    advertisingEngine = null,
    monetizationEngine = null,

    automationEngine = null,
    notificationService = null,
    eventBus = null,

    logger = console,

    currency =
      process.env.CRM_CURRENCY ||
      "SAR",

    defaultProbability =
      Number(
        process.env.CRM_DEFAULT_PROBABILITY ||
        20
      ),

    forecastDays =
      Number(
        process.env.CRM_FORECAST_DAYS ||
        30
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    companies: new Map(),
    contacts: new Map(),
    leads: new Map(),
    deals: new Map(),
    activities: new Map(),
    tasks: new Map(),
    quotes: new Map(),
    pipelines: new Map(),
    notes: new Map(),

    statistics: {
      companies: 0,
      contacts: 0,
      leads: 0,
      deals: 0,
      wonDeals: 0,
      lostDeals: 0,
      openDeals: 0,
      activities: 0,
      tasks: 0,
      quotes: 0,
      pipelineValue: 0,
      weightedPipelineValue: 0,
      wonRevenue: 0
    }
  };

  /* ==========================================================
     HELPERS
  ========================================================== */

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

  function clean(value) {
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

  function number(
    value,
    fallback = 0
  ) {
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
        "[CODE77] Event error:",
        error.message
      );
    }
  }

  /* ==========================================================
     DATABASE
  ========================================================== */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_companies (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        company_type TEXT DEFAULT 'company',

        industry TEXT,

        website TEXT,

        email TEXT,

        phone TEXT,

        status TEXT DEFAULT 'active',

        source TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_contacts (
        id TEXT PRIMARY KEY,

        company_id TEXT,

        name TEXT NOT NULL,

        job_title TEXT,

        email TEXT,

        phone TEXT,

        role TEXT,

        status TEXT DEFAULT 'active',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_leads (
        id TEXT PRIMARY KEY,

        company_id TEXT,

        contact_id TEXT,

        name TEXT,

        source TEXT,

        status TEXT DEFAULT 'new',

        temperature TEXT DEFAULT 'cold',

        score NUMERIC DEFAULT 0,

        estimated_value NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        owner TEXT,

        next_action TEXT,

        notes TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_deals (
        id TEXT PRIMARY KEY,

        company_id TEXT,

        contact_id TEXT,

        lead_id TEXT,

        name TEXT NOT NULL,

        deal_type TEXT DEFAULT 'general',

        stage TEXT DEFAULT 'qualification',

        status TEXT DEFAULT 'open',

        value NUMERIC DEFAULT 0,

        probability NUMERIC DEFAULT 20,

        weighted_value NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        expected_close_at TIMESTAMPTZ,

        owner TEXT,

        source TEXT,

        product_id TEXT,

        campaign_id TEXT,

        sponsorship_id TEXT,

        notes TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_activities (
        id TEXT PRIMARY KEY,

        company_id TEXT,

        contact_id TEXT,

        lead_id TEXT,

        deal_id TEXT,

        activity_type TEXT NOT NULL,

        subject TEXT,

        description TEXT,

        status TEXT DEFAULT 'completed',

        due_at TIMESTAMPTZ,

        completed_at TIMESTAMPTZ,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_tasks (
        id TEXT PRIMARY KEY,

        company_id TEXT,

        contact_id TEXT,

        lead_id TEXT,

        deal_id TEXT,

        title TEXT NOT NULL,

        description TEXT,

        status TEXT DEFAULT 'pending',

        priority TEXT DEFAULT 'medium',

        assigned_to TEXT,

        due_at TIMESTAMPTZ,

        completed_at TIMESTAMPTZ,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_quotes (
        id TEXT PRIMARY KEY,

        company_id TEXT,

        contact_id TEXT,

        deal_id TEXT,

        quote_number TEXT UNIQUE,

        status TEXT DEFAULT 'draft',

        subtotal NUMERIC DEFAULT 0,

        discount NUMERIC DEFAULT 0,

        tax NUMERIC DEFAULT 0,

        total NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        valid_until TIMESTAMPTZ,

        items JSONB DEFAULT '[]'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_pipelines (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        stages JSONB DEFAULT '[]'::jsonb,

        is_default BOOLEAN DEFAULT FALSE,

        status TEXT DEFAULT 'active',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_crm_notes (
        id TEXT PRIMARY KEY,

        company_id TEXT,

        contact_id TEXT,

        lead_id TEXT,

        deal_id TEXT,

        content TEXT NOT NULL,

        author TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_crm_deals_status
      ON ez_crm_deals(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_crm_deals_company
      ON ez_crm_deals(company_id)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_crm_leads_status
      ON ez_crm_leads(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_crm_tasks_due
      ON ez_crm_tasks(due_at)
    `);
  }

  /* ==========================================================
     INITIALIZE
  ========================================================== */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    await ensureDefaultPipeline();

    state.initialized = true;

    emit(
      "crm.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     DEFAULT PIPELINE
  ========================================================== */

  async function ensureDefaultPipeline() {
    if (
      state.pipelines.size > 0
    ) {
      return;
    }

    const pipeline = {
      id:
        "pipeline_default",

      name:
        "المبيعات الرئيسية",

      stages: [
        {
          id:
            "qualification",

          name:
            "تأهيل العميل",

          probability:
            20
        },

        {
          id:
            "discovery",

          name:
            "اكتشاف الاحتياج",

          probability:
            35
        },

        {
          id:
            "proposal",

          name:
            "العرض",

          probability:
            55
        },

        {
          id:
            "negotiation",

          name:
            "التفاوض",

          probability:
            75
        },

        {
          id:
            "approval",

          name:
            "الاعتماد",

          probability:
            90
        },

        {
          id:
            "won",

          name:
            "مغلقة - ناجحة",

          probability:
            100
        },

        {
          id:
            "lost",

          name:
            "مغلقة - خسارة",

          probability:
            0
        }
      ],

      isDefault:
        true,

      status:
        "active",

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.pipelines.set(
      pipeline.id,
      pipeline
    );

    await persistPipeline(
      pipeline
    );
  }

  /* ==========================================================
     COMPANY
  ========================================================== */

  async function createCompany(
    input = {}
  ) {
    if (
      !clean(input.name)
    ) {
      throw new Error(
        "Company name is required"
      );
    }

    const company = {
      id:
        id("company"),

      name:
        clean(
          input.name
        ),

      companyType:
        input.companyType ||
        "company",

      industry:
        clean(
          input.industry
        ),

      website:
        clean(
          input.website
        ),

      email:
        clean(
          input.email
        ),

      phone:
        clean(
          input.phone
        ),

      status:
        input.status ||
        "active",

      source:
        clean(
          input.source
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.companies.set(
      company.id,
      company
    );

    state.statistics.companies++;

    await persistCompany(
      company
    );

    emit(
      "crm.company.created",
      {
        company
      }
    );

    return clone(
      company
    );
  }

  /* ==========================================================
     CONTACT
  ========================================================== */

  async function createContact(
    input = {}
  ) {
    const contact = {
      id:
        id("contact"),

      companyId:
        clean(
          input.companyId
        ),

      name:
        clean(
          input.name
        ),

      jobTitle:
        clean(
          input.jobTitle
        ),

      email:
        clean(
          input.email
        ),

      phone:
        clean(
          input.phone
        ),

      role:
        clean(
          input.role
        ),

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

    if (!contact.name) {
      throw new Error(
        "Contact name is required"
      );
    }

    state.contacts.set(
      contact.id,
      contact
    );

    state.statistics.contacts++;

    await persistContact(
      contact
    );

    return clone(
      contact
    );
  }

  /* ==========================================================
     LEAD
  ========================================================== */

  async function createLead(
    input = {}
  ) {
    const lead = {
      id:
        id("lead"),

      companyId:
        clean(
          input.companyId
        ),

      contactId:
        clean(
          input.contactId
        ),

      name:
        clean(
          input.name
        ),

      source:
        clean(
          input.source
        ),

      status:
        input.status ||
        "new",

      temperature:
        input.temperature ||
        "cold",

      score:
        clamp(
          input.score ||
            0
        ),

      estimatedValue:
        Math.max(
          0,
          number(
            input.estimatedValue
          )
        ),

      currency:
        input.currency ||
        currency,

      owner:
        clean(
          input.owner
        ),

      nextAction:
        clean(
          input.nextAction
        ),

      notes:
        clean(
          input.notes
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.leads.set(
      lead.id,
      lead
    );

    state.statistics.leads++;

    await persistLead(
      lead
    );

    emit(
      "crm.lead.created",
      {
        lead
      }
    );

    return clone(
      lead
    );
  }

  /* ==========================================================
     AI LEAD SCORING
  ========================================================== */

  async function scoreLead(
    leadId
  ) {
    const lead =
      state.leads.get(
        leadId
      );

    if (!lead) {
      throw new Error(
        "Lead not found"
      );
    }

    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        leadId,
        score:
          lead.score,
        confidence:
          0,
        aiAvailable:
          false
      };
    }

    try {
      const result =
        await aiCore.request({
          operation:
            "crm-lead-scoring",

          lead:
            clone(lead),

          company:
            clone(
              state.companies.get(
                lead.companyId
              )
            ),

          contact:
            clone(
              state.contacts.get(
                lead.contactId
              )
            )
        });

      lead.score =
        clamp(
          result?.score ??
            lead.score
        );

      lead.temperature =
        result?.temperature ||
        lead.temperature;

      lead.nextAction =
        result?.nextAction ||
        lead.nextAction;

      lead.updatedAt =
        now();

      await persistLead(
        lead
      );

      return {
        leadId,

        score:
          lead.score,

        temperature:
          lead.temperature,

        nextAction:
          lead.nextAction,

        confidence:
          clamp(
            result?.confidence ||
              0
          ),

        aiAvailable:
          true
      };
    } catch (error) {
      logger.warn(
        "[CODE77] Lead scoring failed:",
        error.message
      );

      return {
        leadId,
        score:
          lead.score,
        confidence:
          0,
        aiAvailable:
          false,
        error:
          error.message
      };
    }
  }

  /* ==========================================================
     DEAL
  ========================================================== */

  async function createDeal(
    input = {}
  ) {
    const value =
      Math.max(
        0,
        number(
          input.value
        )
      );

    const probability =
      clamp(
        input.probability ??
          defaultProbability
      );

    const deal = {
      id:
        id("deal"),

      companyId:
        clean(
          input.companyId
        ),

      contactId:
        clean(
          input.contactId
        ),

      leadId:
        clean(
          input.leadId
        ),

      name:
        clean(
          input.name
        ),

      dealType:
        input.dealType ||
        "general",

      stage:
        input.stage ||
        "qualification",

      status:
        input.status ||
        "open",

      value,

      probability,

      weightedValue:
        value *
        (probability / 100),

      currency:
        input.currency ||
        currency,

      expectedCloseAt:
        input.expectedCloseAt ||
        null,

      owner:
        clean(
          input.owner
        ),

      source:
        clean(
          input.source
        ),

      productId:
        clean(
          input.productId
        ),

      campaignId:
        clean(
          input.campaignId
        ),

      sponsorshipId:
        clean(
          input.sponsorshipId
        ),

      notes:
        clean(
          input.notes
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    if (!deal.name) {
      throw new Error(
        "Deal name is required"
      );
    }

    state.deals.set(
      deal.id,
      deal
    );

    state.statistics.deals++;

    updatePipelineStatistics();

    await persistDeal(
      deal
    );

    emit(
      "crm.deal.created",
      {
        deal
      }
    );

    return clone(
      deal
    );
  }

  /* ==========================================================
     UPDATE DEAL
  ========================================================== */

  async function updateDeal(
    dealId,
    input = {}
  ) {
    const deal =
      state.deals.get(
        dealId
      );

    if (!deal) {
      throw new Error(
        "Deal not found"
      );
    }

    Object.assign(
      deal,
      {
        ...input,

        value:
          input.value !==
          undefined
            ? Math.max(
                0,
                number(
                  input.value
                )
              )
            : deal.value,

        probability:
          input.probability !==
          undefined
            ? clamp(
                input.probability
              )
            : deal.probability,

        updatedAt:
          now()
      }
    );

    deal.weightedValue =
      deal.value *
      (
        deal.probability /
        100
      );

    if (
      deal.status ===
      "won"
    ) {
      deal.probability =
        100;

      deal.weightedValue =
        deal.value;
    }

    if (
      deal.status ===
      "lost"
    ) {
      deal.probability =
        0;

      deal.weightedValue =
        0;
    }

    await persistDeal(
      deal
    );

    updatePipelineStatistics();

    emit(
      "crm.deal.updated",
      {
        deal
      }
    );

    return clone(
      deal
    );
  }

  /* ==========================================================
     AI DEAL ANALYSIS
  ========================================================== */

  async function analyzeDeal(
    dealId
  ) {
    const deal =
      state.deals.get(
        dealId
      );

    if (!deal) {
      throw new Error(
        "Deal not found"
      );
    }

    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        dealId,
        aiAvailable:
          false
      };
    }

    const company =
      state.companies.get(
        deal.companyId
      );

    const contact =
      state.contacts.get(
        deal.contactId
      );

    const activities =
      Array.from(
        state.activities.values()
      ).filter(
        activity =>
          activity.dealId ===
          dealId
      );

    try {
      const result =
        await aiCore.request({
          operation:
            "crm-deal-analysis",

          deal:
            clone(deal),

          company:
            clone(company),

          contact:
            clone(contact),

          activities:
            clone(activities)
        });

      const probability =
        clamp(
          result?.probability ??
            deal.probability
        );

      deal.probability =
        probability;

      deal.weightedValue =
        deal.value *
        (
          probability /
          100
        );

      deal.updatedAt =
        now();

      await persistDeal(
        deal
      );

      return {
        dealId,

        probability,

        weightedValue:
          deal.weightedValue,

        risk:
          result?.risk ||
          "unknown",

        recommendation:
          result?.recommendation ||
          null,

        nextAction:
          result?.nextAction ||
          null,

        confidence:
          clamp(
            result?.confidence ||
              0
          ),

        aiAvailable:
          true
      };
    } catch (error) {
      return {
        dealId,

        aiAvailable:
          false,

        error:
          error.message
      };
    }
  }

  /* ==========================================================
     ACTIVITY
  ========================================================== */

  async function createActivity(
    input = {}
  ) {
    const activity = {
      id:
        id("activity"),

      companyId:
        clean(
          input.companyId
        ),

      contactId:
        clean(
          input.contactId
        ),

      leadId:
        clean(
          input.leadId
        ),

      dealId:
        clean(
          input.dealId
        ),

      activityType:
        input.activityType ||
        "note",

      subject:
        clean(
          input.subject
        ),

      description:
        clean(
          input.description
        ),

      status:
        input.status ||
        "completed",

      dueAt:
        input.dueAt ||
        null,

      completedAt:
        input.completedAt ||
        (
          input.status ===
          "completed"
            ? now()
            : null
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.activities.set(
      activity.id,
      activity
    );

    state.statistics.activities++;

    await persistActivity(
      activity
    );

    return clone(
      activity
    );
  }

  /* ==========================================================
     TASK
  ========================================================== */

  async function createTask(
    input = {}
  ) {
    const task = {
      id:
        id("task"),

      companyId:
        clean(
          input.companyId
        ),

      contactId:
        clean(
          input.contactId
        ),

      leadId:
        clean(
          input.leadId
        ),

      dealId:
        clean(
          input.dealId
        ),

      title:
        clean(
          input.title
        ),

      description:
        clean(
          input.description
        ),

      status:
        input.status ||
        "pending",

      priority:
        input.priority ||
        "medium",

      assignedTo:
        clean(
          input.assignedTo
        ),

      dueAt:
        input.dueAt ||
        null,

      completedAt:
        input.completedAt ||
        null,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    if (!task.title) {
      throw new Error(
        "Task title is required"
      );
    }

    state.tasks.set(
      task.id,
      task
    );

    state.statistics.tasks++;

    await persistTask(
      task
    );

    if (
      notificationService &&
      typeof notificationService
        .notify ===
        "function"
    ) {
      try {
        await notificationService.notify({
          type:
            "crm_task_created",

          task:
            clone(task)
        });
      } catch {}
    }

    return clone(
      task
    );
  }

  /* ==========================================================
     QUOTE
  ========================================================== */

  async function createQuote(
    input = {}
  ) {
    const items =
      Array.isArray(
        input.items
      )
        ? input.items
        : [];

    const subtotal =
      items.reduce(
        (sum, item) =>
          sum +
          number(
            item.quantity,
            1
          ) *
            number(
              item.unitPrice
            ),
        0
      );

    const discount =
      Math.max(
        0,
        number(
          input.discount
        )
      );

    const taxable =
      Math.max(
        0,
        subtotal -
          discount
      );

    const tax =
      number(
        input.tax,
        0
      );

    const total =
      taxable + tax;

    const quote = {
      id:
        id("quote"),

      companyId:
        clean(
          input.companyId
        ),

      contactId:
        clean(
          input.contactId
        ),

      dealId:
        clean(
          input.dealId
        ),

      quoteNumber:
        input.quoteNumber ||
        `EZQ-${Date.now()}`,

      status:
        input.status ||
        "draft",

      subtotal,

      discount,

      tax,

      total,

      currency:
        input.currency ||
        currency,

      validUntil:
        input.validUntil ||
        null,

      items,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.quotes.set(
      quote.id,
      quote
    );

    state.statistics.quotes++;

    await persistQuote(
      quote
    );

    return clone(
      quote
    );
  }

  /* ==========================================================
     NOTE
  ========================================================== */

  async function createNote(
    input = {}
  ) {
    const note = {
      id:
        id("note"),

      companyId:
        clean(
          input.companyId
        ),

      contactId:
        clean(
          input.contactId
        ),

      leadId:
        clean(
          input.leadId
        ),

      dealId:
        clean(
          input.dealId
        ),

      content:
        clean(
          input.content
        ),

      author:
        clean(
          input.author
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    if (!note.content) {
      throw new Error(
        "Note content is required"
      );
    }

    state.notes.set(
      note.id,
      note
    );

    await persistNote(
      note
    );

    return clone(
      note
    );
  }

  /* ==========================================================
     PIPELINE
  ========================================================== */

  function updatePipelineStatistics() {
    const deals =
      Array.from(
        state.deals.values()
      );

    const open =
      deals.filter(
        deal =>
          deal.status ===
          "open"
      );

    const won =
      deals.filter(
        deal =>
          deal.status ===
          "won"
      );

    const lost =
      deals.filter(
        deal =>
          deal.status ===
          "lost"
      );

    state.statistics.openDeals =
      open.length;

    state.statistics.wonDeals =
      won.length;

    state.statistics.lostDeals =
      lost.length;

    state.statistics.pipelineValue =
      open.reduce(
        (sum, deal) =>
          sum +
          deal.value,
        0
      );

    state.statistics
      .weightedPipelineValue =
      open.reduce(
        (sum, deal) =>
          sum +
          deal.weightedValue,
        0
      );

    state.statistics.wonRevenue =
      won.reduce(
        (sum, deal) =>
          sum +
          deal.value,
        0
      );
  }

  /* ==========================================================
     SALES FORECAST
  ========================================================== */

  async function forecastSales() {
    updatePipelineStatistics();

    const openDeals =
      Array.from(
        state.deals.values()
      ).filter(
        deal =>
          deal.status ===
          "open"
      );

    const weighted =
      openDeals.reduce(
        (sum, deal) =>
          sum +
          deal.weightedValue,
        0
      );

    let aiResult = null;

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        aiResult =
          await aiCore.request({
            operation:
              "crm-sales-forecast",

            deals:
              clone(openDeals),

            forecastDays,

            weightedPipeline:
              weighted
          });
      } catch {}
    }

    return {
      currency,

      forecastDays,

      openDeals:
        openDeals.length,

      pipelineValue:
        Number(
          state.statistics
            .pipelineValue
            .toFixed(2)
        ),

      weightedPipelineValue:
        Number(
          weighted.toFixed(2)
        ),

      predictedRevenue:
        Number(
          number(
            aiResult?.predictedRevenue,
            weighted
          ).toFixed(2)
        ),

      confidence:
        clamp(
          aiResult?.confidence ||
            (
              openDeals.length >
              0
                ? 60
                : 0
            )
        ),

      recommendations:
        aiResult?.recommendations ||
        []
    };
  }

  /* ==========================================================
     AI SALES ASSISTANT
  ========================================================== */

  async function salesAssistant(
    input = {}
  ) {
    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        available:
          false
      };
    }

    try {
      const result =
        await aiCore.request({
          operation:
            "crm-sales-assistant",

          question:
            clean(
              input.question
            ),

          company:
            clone(
              state.companies.get(
                input.companyId
              )
            ),

          contact:
            clone(
              state.contacts.get(
                input.contactId
              )
            ),

          lead:
            clone(
              state.leads.get(
                input.leadId
              )
            ),

          deal:
            clone(
              state.deals.get(
                input.dealId
              )
            )
        });

      return {
        available:
          true,

        answer:
          result?.answer ||
          null,

        recommendations:
          result?.recommendations ||
          [],

        nextActions:
          result?.nextActions ||
          [],

        confidence:
          clamp(
            result?.confidence ||
              0
          )
      };
    } catch (error) {
      return {
        available:
          false,

        error:
          error.message
      };
    }
  }

  /* ==========================================================
     DASHBOARD
  ========================================================== */

  async function getDashboard() {
    updatePipelineStatistics();

    const forecast =
      await forecastSales();

    return {
      statistics:
        getStatistics(),

      forecast,

      companies:
        Array.from(
          state.companies.values()
        ).slice(-20),

      recentLeads:
        Array.from(
          state.leads.values()
        )
          .slice(-20)
          .reverse(),

      recentDeals:
        Array.from(
          state.deals.values()
        )
          .slice(-20)
          .reverse(),

      openTasks:
        Array.from(
          state.tasks.values()
        )
          .filter(
            task =>
              task.status !==
              "completed"
          )
          .slice(-20)
          .reverse(),

      timestamp:
        now()
    };
  }

  /* ==========================================================
     PERSISTENCE
  ========================================================== */

  async function execute(
    sql,
    values
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      sql,
      values
    );
  }

  async function persistCompany(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_companies
      (
        id,
        name,
        company_type,
        industry,
        website,
        email,
        phone,
        status,
        source,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      ON CONFLICT(id)
      DO UPDATE SET
        name=EXCLUDED.name,
        status=EXCLUDED.status,
        metadata=EXCLUDED.metadata,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.name,
        item.companyType,
        item.industry,
        item.website,
        item.email,
        item.phone,
        item.status,
        item.source,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistContact(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_contacts
      (
        id,
        company_id,
        name,
        job_title,
        email,
        phone,
        role,
        status,
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
        item.id,
        item.companyId,
        item.name,
        item.jobTitle,
        item.email,
        item.phone,
        item.role,
        item.status,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistLead(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_leads
      (
        id,
        company_id,
        contact_id,
        name,
        source,
        status,
        temperature,
        score,
        estimated_value,
        currency,
        owner,
        next_action,
        notes,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status,
        temperature=EXCLUDED.temperature,
        score=EXCLUDED.score,
        next_action=EXCLUDED.next_action,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.companyId,
        item.contactId,
        item.name,
        item.source,
        item.status,
        item.temperature,
        item.score,
        item.estimatedValue,
        item.currency,
        item.owner,
        item.nextAction,
        item.notes,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistDeal(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_deals
      (
        id,
        company_id,
        contact_id,
        lead_id,
        name,
        deal_type,
        stage,
        status,
        value,
        probability,
        weighted_value,
        currency,
        expected_close_at,
        owner,
        source,
        product_id,
        campaign_id,
        sponsorship_id,
        notes,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      ON CONFLICT(id)
      DO UPDATE SET
        stage=EXCLUDED.stage,
        status=EXCLUDED.status,
        value=EXCLUDED.value,
        probability=EXCLUDED.probability,
        weighted_value=EXCLUDED.weighted_value,
        expected_close_at=EXCLUDED.expected_close_at,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.companyId,
        item.contactId,
        item.leadId,
        item.name,
        item.dealType,
        item.stage,
        item.status,
        item.value,
        item.probability,
        item.weightedValue,
        item.currency,
        item.expectedCloseAt,
        item.owner,
        item.source,
        item.productId,
        item.campaignId,
        item.sponsorshipId,
        item.notes,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistActivity(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_activities
      (
        id,
        company_id,
        contact_id,
        lead_id,
        deal_id,
        activity_type,
        subject,
        description,
        status,
        due_at,
        completed_at,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      )
      `,
      [
        item.id,
        item.companyId,
        item.contactId,
        item.leadId,
        item.dealId,
        item.activityType,
        item.subject,
        item.description,
        item.status,
        item.dueAt,
        item.completedAt,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt
      ]
    );
  }

  async function persistTask(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_tasks
      (
        id,
        company_id,
        contact_id,
        lead_id,
        deal_id,
        title,
        description,
        status,
        priority,
        assigned_to,
        due_at,
        completed_at,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15
      )
      `,
      [
        item.id,
        item.companyId,
        item.contactId,
        item.leadId,
        item.dealId,
        item.title,
        item.description,
        item.status,
        item.priority,
        item.assignedTo,
        item.dueAt,
        item.completedAt,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistQuote(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_quotes
      (
        id,
        company_id,
        contact_id,
        deal_id,
        quote_number,
        status,
        subtotal,
        discount,
        tax,
        total,
        currency,
        valid_until,
        items,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16
      )
      `,
      [
        item.id,
        item.companyId,
        item.contactId,
        item.dealId,
        item.quoteNumber,
        item.status,
        item.subtotal,
        item.discount,
        item.tax,
        item.total,
        item.currency,
        item.validUntil,
        JSON.stringify(
          item.items
        ),
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistPipeline(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_pipelines
      (
        id,
        name,
        stages,
        is_default,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      ON CONFLICT(id)
      DO UPDATE SET
        stages=EXCLUDED.stages,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.name,
        JSON.stringify(
          item.stages
        ),
        item.isDefault,
        item.status,
        JSON.stringify(
          item.metadata || {}
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistNote(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_crm_notes
      (
        id,
        company_id,
        contact_id,
        lead_id,
        deal_id,
        content,
        author,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        item.id,
        item.companyId,
        item.contactId,
        item.leadId,
        item.dealId,
        item.content,
        item.author,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt
      ]
    );
  }

  /* ==========================================================
     STATUS / HEALTH
  ========================================================== */

  function getStatistics() {
    return {
      ...state.statistics,

      currency,

      companyCache:
        state.companies.size,

      contactCache:
        state.contacts.size,

      leadCache:
        state.leads.size,

      dealCache:
        state.deals.size,

      activityCache:
        state.activities.size,

      taskCache:
        state.tasks.size,

      quoteCache:
        state.quotes.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent CRM & Sales Engine",

      code:
        "77",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      currency,

      forecastDays,

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

        advertising:
          Boolean(
            advertisingEngine
          ),

        monetization:
          Boolean(
            monetizationEngine
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
      } catch {}
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
      "crm.started",
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
      "crm.stopped",
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

    createCompany,
    createContact,

    createLead,
    scoreLead,

    createDeal,
    updateDeal,
    analyzeDeal,

    createActivity,
    createTask,
    createQuote,
    createNote,

    forecastSales,
    salesAssistant,

    getDashboard,
    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentCRMSalesEngine
};
