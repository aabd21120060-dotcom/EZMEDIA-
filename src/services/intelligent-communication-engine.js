"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 78
 * INTELLIGENT COMMUNICATION & OUTREACH ENGINE
 * ============================================================
 *
 * Email
 * WhatsApp Provider
 * SMS Provider
 * Push Notifications
 * Internal Notifications
 * Outreach Campaigns
 * Message Templates
 * Follow-ups
 * Scheduling
 * Communication History
 * AI Personalization
 * AI Follow-up Recommendations
 *
 * لا يتم إرسال رسالة خارجية حقيقية إلا عند ربط
 * Provider فعلي ومفعل.
 */

const crypto = require("crypto");

function createIntelligentCommunicationEngine(
  options = {}
) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    crmEngine = null,
    advertisingEngine = null,
    monetizationEngine = null,

    automationEngine = null,
    notificationService = null,
    eventBus = null,

    providers = {},

    logger = console,

    maxMessageLength =
      Number(
        process.env.COMMUNICATION_MAX_MESSAGE_LENGTH ||
        10000
      ),

    maxCampaignRecipients =
      Number(
        process.env.COMMUNICATION_MAX_CAMPAIGN_RECIPIENTS ||
        10000
      ),

    defaultRetryCount =
      Number(
        process.env.COMMUNICATION_DEFAULT_RETRIES ||
        3
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    channels: new Map(),
    templates: new Map(),
    messages: new Map(),
    campaigns: new Map(),
    followUps: new Map(),
    conversations: new Map(),
    schedules: new Map(),

    statistics: {
      channels: 0,
      templates: 0,
      messages: 0,
      campaigns: 0,
      followUps: 0,
      conversations: 0,

      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      scheduled: 0,

      aiPersonalized: 0
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
        "[CODE78] Event error:",
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
      CREATE TABLE IF NOT EXISTS ez_communication_channels (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        channel_type TEXT NOT NULL,

        provider TEXT,

        status TEXT DEFAULT 'inactive',

        configuration JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_communication_templates (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        channel TEXT NOT NULL,

        subject TEXT,

        body TEXT NOT NULL,

        language TEXT DEFAULT 'ar',

        category TEXT DEFAULT 'general',

        variables JSONB DEFAULT '[]'::jsonb,

        status TEXT DEFAULT 'active',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_communication_messages (
        id TEXT PRIMARY KEY,

        channel TEXT NOT NULL,

        provider TEXT,

        recipient TEXT,

        recipient_name TEXT,

        subject TEXT,

        body TEXT,

        status TEXT DEFAULT 'pending',

        provider_message_id TEXT,

        crm_company_id TEXT,

        crm_contact_id TEXT,

        crm_lead_id TEXT,

        crm_deal_id TEXT,

        campaign_id TEXT,

        template_id TEXT,

        scheduled_at TIMESTAMPTZ,

        sent_at TIMESTAMPTZ,

        delivered_at TIMESTAMPTZ,

        failed_at TIMESTAMPTZ,

        retry_count INTEGER DEFAULT 0,

        ai_personalized BOOLEAN DEFAULT FALSE,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_communication_campaigns (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        channel TEXT NOT NULL,

        status TEXT DEFAULT 'draft',

        template_id TEXT,

        recipients JSONB DEFAULT '[]'::jsonb,

        sent_count INTEGER DEFAULT 0,

        delivered_count INTEGER DEFAULT 0,

        failed_count INTEGER DEFAULT 0,

        scheduled_at TIMESTAMPTZ,

        started_at TIMESTAMPTZ,

        completed_at TIMESTAMPTZ,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_communication_followups (
        id TEXT PRIMARY KEY,

        crm_lead_id TEXT,

        crm_deal_id TEXT,

        recipient TEXT,

        channel TEXT,

        message TEXT,

        status TEXT DEFAULT 'pending',

        due_at TIMESTAMPTZ,

        completed_at TIMESTAMPTZ,

        attempt_count INTEGER DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_communication_conversations (
        id TEXT PRIMARY KEY,

        channel TEXT NOT NULL,

        external_contact_id TEXT,

        crm_contact_id TEXT,

        crm_company_id TEXT,

        status TEXT DEFAULT 'open',

        last_message_at TIMESTAMPTZ,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_communication_schedules (
        id TEXT PRIMARY KEY,

        message_id TEXT,

        campaign_id TEXT,

        channel TEXT,

        scheduled_at TIMESTAMPTZ NOT NULL,

        status TEXT DEFAULT 'scheduled',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_comm_messages_status
      ON ez_communication_messages(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_comm_messages_recipient
      ON ez_communication_messages(recipient)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_comm_followups_due
      ON ez_communication_followups(due_at)
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

    registerDefaultChannels();

    state.initialized = true;

    emit(
      "communication.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     CHANNELS
  ========================================================== */

  function registerDefaultChannels() {
    const defaults = [
      {
        id: "email",
        name: "البريد الإلكتروني",
        channelType: "email",
        provider: "custom",
        status:
          providers.email
            ? "active"
            : "inactive"
      },
      {
        id: "whatsapp",
        name: "WhatsApp",
        channelType: "whatsapp",
        provider: "custom",
        status:
          providers.whatsapp
            ? "active"
            : "inactive"
      },
      {
        id: "sms",
        name: "SMS",
        channelType: "sms",
        provider: "custom",
        status:
          providers.sms
            ? "active"
            : "inactive"
      },
      {
        id: "push",
        name: "Push",
        channelType: "push",
        provider: "custom",
        status:
          providers.push
            ? "active"
            : "inactive"
      },
      {
        id: "internal",
        name: "الإشعارات الداخلية",
        channelType: "internal",
        provider: "internal",
        status: "active"
      }
    ];

    for (const channel of defaults) {
      if (
        !state.channels.has(
          channel.id
        )
      ) {
        state.channels.set(
          channel.id,
          {
            ...channel,
            createdAt: now(),
            updatedAt: now()
          }
        );

        state.statistics.channels++;
      }
    }
  }

  async function createChannel(
    input = {}
  ) {
    if (!input.name) {
      throw new Error(
        "Channel name is required"
      );
    }

    const channel = {
      id:
        input.id ||
        id("channel"),

      name:
        clean(input.name),

      channelType:
        input.channelType ||
        "custom",

      provider:
        clean(
          input.provider
        ),

      status:
        input.status ||
        "inactive",

      configuration:
        input.configuration ||
        {},

      createdAt: now(),
      updatedAt: now()
    };

    state.channels.set(
      channel.id,
      channel
    );

    state.statistics.channels++;

    await persistChannel(
      channel
    );

    return clone(
      channel
    );
  }

  /* ==========================================================
     TEMPLATES
  ========================================================== */

  async function createTemplate(
    input = {}
  ) {
    const body =
      clean(
        input.body
      );

    if (
      !input.name ||
      !body
    ) {
      throw new Error(
        "Template name and body are required"
      );
    }

    const template = {
      id:
        id("template"),

      name:
        clean(
          input.name
        ),

      channel:
        input.channel ||
        "email",

      subject:
        clean(
          input.subject
        ),

      body,

      language:
        input.language ||
        "ar",

      category:
        input.category ||
        "general",

      variables:
        Array.isArray(
          input.variables
        )
          ? input.variables
          : [],

      status:
        input.status ||
        "active",

      metadata:
        input.metadata ||
        {},

      createdAt: now(),
      updatedAt: now()
    };

    state.templates.set(
      template.id,
      template
    );

    state.statistics.templates++;

    await persistTemplate(
      template
    );

    return clone(
      template
    );
  }

  function renderTemplate(
    template,
    variables = {}
  ) {
    let body =
      template.body;

    let subject =
      template.subject ||
      "";

    for (
      const [key, value]
      of Object.entries(
        variables
      )
    ) {
      const token =
        `{{${key}}}`;

      body =
        body.split(token)
          .join(
            clean(value)
          );

      subject =
        subject
          .split(token)
          .join(
            clean(value)
          );
    }

    return {
      subject,
      body
    };
  }

  /* ==========================================================
     AI PERSONALIZATION
  ========================================================== */

  async function personalizeMessage(
    input = {}
  ) {
    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        personalized:
          false,

        subject:
          input.subject || "",

        body:
          input.body || ""
      };
    }

    try {
      const result =
        await aiCore.request({
          operation:
            "communication-personalization",

          channel:
            input.channel,

          recipient:
            input.recipient,

          recipientName:
            input.recipientName,

          subject:
            input.subject,

          body:
            input.body,

          crmContext:
            input.crmContext ||
            null,

          tone:
            input.tone ||
            "professional",

          language:
            input.language ||
            "ar"
        });

      state.statistics.aiPersonalized++;

      return {
        personalized:
          true,

        subject:
          result?.subject ||
          input.subject ||
          "",

        body:
          result?.body ||
          input.body ||
          "",

        confidence:
          number(
            result?.confidence
          )
      };
    } catch (error) {
      logger.warn(
        "[CODE78] AI personalization failed:",
        error.message
      );

      return {
        personalized:
          false,

        subject:
          input.subject || "",

        body:
          input.body || "",

        error:
          error.message
      };
    }
  }

  /* ==========================================================
     SEND MESSAGE
  ========================================================== */

  async function sendMessage(
    input = {}
  ) {
    const channel =
      input.channel ||
      "email";

    const body =
      clean(
        input.body
      );

    if (!body) {
      throw new Error(
        "Message body is required"
      );
    }

    if (
      body.length >
      maxMessageLength
    ) {
      throw new Error(
        "Message exceeds maximum allowed length"
      );
    }

    const message = {
      id:
        id("message"),

      channel,

      provider:
        clean(
          input.provider
        ),

      recipient:
        clean(
          input.recipient
        ),

      recipientName:
        clean(
          input.recipientName
        ),

      subject:
        clean(
          input.subject
        ),

      body,

      status:
        "pending",

      providerMessageId:
        null,

      crmCompanyId:
        clean(
          input.crmCompanyId
        ),

      crmContactId:
        clean(
          input.crmContactId
        ),

      crmLeadId:
        clean(
          input.crmLeadId
        ),

      crmDealId:
        clean(
          input.crmDealId
        ),

      campaignId:
        clean(
          input.campaignId
        ),

      templateId:
        clean(
          input.templateId
        ),

      scheduledAt:
        input.scheduledAt ||
        null,

      sentAt:
        null,

      deliveredAt:
        null,

      failedAt:
        null,

      retryCount: 0,

      aiPersonalized:
        Boolean(
          input.aiPersonalized
        ),

      metadata:
        input.metadata ||
        {},

      createdAt: now(),
      updatedAt: now()
    };

    state.messages.set(
      message.id,
      message
    );

    state.statistics.messages++;

    state.statistics.pending++;

    await persistMessage(
      message
    );

    if (
      message.scheduledAt &&
      new Date(
        message.scheduledAt
      ).getTime() >
        Date.now()
    ) {
      state.statistics.scheduled++;

      await persistSchedule({
        id:
          id("schedule"),

        messageId:
          message.id,

        campaignId:
          message.campaignId,

        channel,

        scheduledAt:
          message.scheduledAt,

        status:
          "scheduled",

        metadata: {}
      });

      return clone(
        message
      );
    }

    return deliverMessage(
      message
    );
  }

  /* ==========================================================
     PROVIDER DISPATCH
  ========================================================== */

  async function deliverMessage(
    message
  ) {
    const provider =
      providers[
        message.channel
      ];

    if (
      message.channel ===
      "internal"
    ) {
      return deliverInternal(
        message
      );
    }

    if (
      !provider
    ) {
      message.status =
        "failed";

      message.failedAt =
        now();

      message.updatedAt =
        now();

      state.statistics.pending =
        Math.max(
          0,
          state.statistics
            .pending - 1
        );

      state.statistics.failed++;

      await persistMessage(
        message
      );

      return clone(
        message
      );
    }

    try {
      let result;

      if (
        typeof provider.send ===
        "function"
      ) {
        result =
          await provider.send(
            {
              channel:
                message.channel,

              recipient:
                message.recipient,

              recipientName:
                message.recipientName,

              subject:
                message.subject,

              body:
                message.body,

              metadata:
                message.metadata
            }
          );
      } else {
        throw new Error(
          "Communication provider does not expose send()"
        );
      }

      message.status =
        "sent";

      message.providerMessageId =
        result?.messageId ||
        result?.id ||
        null;

      message.sentAt =
        now();

      message.updatedAt =
        now();

      state.statistics.pending =
        Math.max(
          0,
          state.statistics
            .pending - 1
        );

      state.statistics.sent++;

      await persistMessage(
        message
      );

      emit(
        "communication.message.sent",
        {
          message:
            clone(message)
        }
      );

      return clone(
        message
      );
    } catch (error) {
      message.retryCount++;

      if (
        message.retryCount >=
        defaultRetryCount
      ) {
        message.status =
          "failed";

        message.failedAt =
          now();

        state.statistics.pending =
          Math.max(
            0,
            state.statistics
              .pending - 1
          );

        state.statistics.failed++;
      }

      message.updatedAt =
        now();

      await persistMessage(
        message
      );

      return {
        ...clone(message),
        error:
          error.message
      };
    }
  }

  async function deliverInternal(
    message
  ) {
    try {
      if (
        notificationService &&
        typeof notificationService
          .notify ===
          "function"
      ) {
        await notificationService.notify({
          recipient:
            message.recipient,

          subject:
            message.subject,

          body:
            message.body,

          metadata:
            message.metadata
        });
      }

      message.status =
        "sent";

      message.sentAt =
        now();

      message.deliveredAt =
        now();

      message.updatedAt =
        now();

      state.statistics.pending =
        Math.max(
          0,
          state.statistics
            .pending - 1
        );

      state.statistics.sent++;

      state.statistics.delivered++;

      await persistMessage(
        message
      );

      return clone(
        message
      );
    } catch (error) {
      message.status =
        "failed";

      message.failedAt =
        now();

      message.updatedAt =
        now();

      state.statistics.pending =
        Math.max(
          0,
          state.statistics
            .pending - 1
        );

      state.statistics.failed++;

      await persistMessage(
        message
      );

      return {
        ...clone(message),
        error:
          error.message
      };
    }
  }

  /* ==========================================================
     CAMPAIGNS
  ========================================================== */

  async function createCampaign(
    input = {}
  ) {
    const recipients =
      Array.isArray(
        input.recipients
      )
        ? input.recipients
        : [];

    if (
      recipients.length >
      maxCampaignRecipients
    ) {
      throw new Error(
        "Campaign recipient limit exceeded"
      );
    }

    const campaign = {
      id:
        id("campaign"),

      name:
        clean(
          input.name
        ),

      channel:
        input.channel ||
        "email",

      status:
        input.status ||
        "draft",

      templateId:
        clean(
          input.templateId
        ),

      recipients,

      sentCount: 0,

      deliveredCount: 0,

      failedCount: 0,

      scheduledAt:
        input.scheduledAt ||
        null,

      startedAt:
        null,

      completedAt:
        null,

      metadata:
        input.metadata ||
        {},

      createdAt: now(),
      updatedAt: now()
    };

    if (!campaign.name) {
      throw new Error(
        "Campaign name is required"
      );
    }

    state.campaigns.set(
      campaign.id,
      campaign
    );

    state.statistics.campaigns++;

    await persistCampaign(
      campaign
    );

    return clone(
      campaign
    );
  }

  /* ==========================================================
     RUN CAMPAIGN
  ========================================================== */

  async function runCampaign(
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

    const template =
      campaign.templateId
        ? state.templates.get(
            campaign.templateId
          )
        : null;

    campaign.status =
      "running";

    campaign.startedAt =
      now();

    campaign.updatedAt =
      now();

    await persistCampaign(
      campaign
    );

    for (
      const recipient
      of campaign.recipients
    ) {
      let rendered = {
        subject:
          recipient.subject ||
          template?.subject ||
          "",

        body:
          recipient.body ||
          template?.body ||
          ""
      };

      if (
        template &&
        recipient.variables
      ) {
        rendered =
          renderTemplate(
            template,
            recipient.variables
          );
      }

      if (
        recipient.aiPersonalize
      ) {
        rendered =
          await personalizeMessage({
            channel:
              campaign.channel,

            recipient:
              recipient.address,

            recipientName:
              recipient.name,

            subject:
              rendered.subject,

            body:
              rendered.body,

            crmContext:
              recipient.crmContext,

            tone:
              recipient.tone,

            language:
              recipient.language ||
              "ar"
          });
      }

      const result =
        await sendMessage({
          channel:
            campaign.channel,

          recipient:
            recipient.address,

          recipientName:
            recipient.name,

          subject:
            rendered.subject,

          body:
            rendered.body,

          campaignId:
            campaign.id,

          templateId:
            campaign.templateId,

          crmCompanyId:
            recipient.companyId,

          crmContactId:
            recipient.contactId,

          crmLeadId:
            recipient.leadId,

          crmDealId:
            recipient.dealId,

          aiPersonalized:
            Boolean(
              recipient.aiPersonalize
            ),

          metadata:
            recipient.metadata ||
            {}
        });

      if (
        result.status ===
        "sent"
      ) {
        campaign.sentCount++;
      }

      if (
        result.status ===
        "failed"
      ) {
        campaign.failedCount++;
      }

      if (
        result.status ===
        "delivered"
      ) {
        campaign.deliveredCount++;
      }
    }

    campaign.status =
      "completed";

    campaign.completedAt =
      now();

    campaign.updatedAt =
      now();

    await persistCampaign(
      campaign
    );

    emit(
      "communication.campaign.completed",
      {
        campaign:
          clone(campaign)
      }
    );

    return clone(
      campaign
    );
  }

  /* ==========================================================
     FOLLOW-UP
  ========================================================== */

  async function createFollowUp(
    input = {}
  ) {
    const followUp = {
      id:
        id("followup"),

      crmLeadId:
        clean(
          input.crmLeadId
        ),

      crmDealId:
        clean(
          input.crmDealId
        ),

      recipient:
        clean(
          input.recipient
        ),

      channel:
        input.channel ||
        "email",

      message:
        clean(
          input.message
        ),

      status:
        input.status ||
        "pending",

      dueAt:
        input.dueAt ||
        null,

      completedAt:
        null,

      attemptCount: 0,

      metadata:
        input.metadata ||
        {},

      createdAt: now(),
      updatedAt: now()
    };

    state.followUps.set(
      followUp.id,
      followUp
    );

    state.statistics.followUps++;

    await persistFollowUp(
      followUp
    );

    return clone(
      followUp
    );
  }

  /* ==========================================================
     AI FOLLOW-UP RECOMMENDATION
  ========================================================== */

  async function recommendFollowUp(
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
            "communication-followup-recommendation",

          crmLead:
            input.crmLead ||
            null,

          crmDeal:
            input.crmDeal ||
            null,

          history:
            input.history ||
            [],

          preferredChannel:
            input.preferredChannel ||
            null,

          language:
            input.language ||
            "ar"
        });

      return {
        available:
          true,

        recommendedChannel:
          result?.channel ||
          null,

        recommendedTime:
          result?.time ||
          null,

        message:
          result?.message ||
          null,

        reason:
          result?.reason ||
          null,

        confidence:
          number(
            result?.confidence
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
     CONVERSATION
  ========================================================== */

  async function createConversation(
    input = {}
  ) {
    const conversation = {
      id:
        id("conversation"),

      channel:
        input.channel ||
        "email",

      externalContactId:
        clean(
          input.externalContactId
        ),

      crmContactId:
        clean(
          input.crmContactId
        ),

      crmCompanyId:
        clean(
          input.crmCompanyId
        ),

      status:
        input.status ||
        "open",

      lastMessageAt:
        input.lastMessageAt ||
        null,

      metadata:
        input.metadata ||
        {},

      createdAt: now(),
      updatedAt: now()
    };

    state.conversations.set(
      conversation.id,
      conversation
    );

    state.statistics.conversations++;

    await persistConversation(
      conversation
    );

    return clone(
      conversation
    );
  }

  /* ==========================================================
     SCHEDULE PROCESSOR
  ========================================================== */

  async function processSchedules() {
    const schedules =
      Array.from(
        state.schedules.values()
      );

    const due =
      schedules.filter(
        schedule =>
          schedule.status ===
            "scheduled" &&
          new Date(
            schedule.scheduledAt
          ).getTime() <=
            Date.now()
      );

    for (
      const schedule of due
    ) {
      const message =
        state.messages.get(
          schedule.messageId
        );

      if (!message) {
        schedule.status =
          "failed";

        continue;
      }

      const result =
        await deliverMessage(
          message
        );

      schedule.status =
        result.status ===
        "failed"
          ? "failed"
          : "completed";

      await persistSchedule(
        schedule
      );
    }
  }

  /* ==========================================================
     STATISTICS
  ========================================================== */

  function getStatistics() {
    return {
      ...state.statistics,

      channelCache:
        state.channels.size,

      templateCache:
        state.templates.size,

      messageCache:
        state.messages.size,

      campaignCache:
        state.campaigns.size,

      followUpCache:
        state.followUps.size,

      conversationCache:
        state.conversations.size,

      scheduleCache:
        state.schedules.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Communication & Outreach Engine",

      code:
        "78",

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

        aiOrchestrator:
          Boolean(
            aiOrchestrator
          ),

        crm:
          Boolean(
            crmEngine
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

      providers: {
        email:
          Boolean(
            providers.email
          ),

        whatsapp:
          Boolean(
            providers.whatsapp
          ),

        sms:
          Boolean(
            providers.sms
          ),

        push:
          Boolean(
            providers.push
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

      providers: {
        email:
          Boolean(
            providers.email
          ),

        whatsapp:
          Boolean(
            providers.whatsapp
          ),

        sms:
          Boolean(
            providers.sms
          ),

        push:
          Boolean(
            providers.push
          )
      },

      timestamp:
        now()
    };
  }

  /* ==========================================================
     PERSISTENCE HELPERS
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

  async function persistChannel(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_communication_channels
      (
        id,
        name,
        channel_type,
        provider,
        status,
        configuration,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status,
        configuration=EXCLUDED.configuration,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.name,
        item.channelType,
        item.provider,
        item.status,
        JSON.stringify(
          item.configuration
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistTemplate(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_communication_templates
      (
        id,
        name,
        channel,
        subject,
        body,
        language,
        category,
        variables,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      `,
      [
        item.id,
        item.name,
        item.channel,
        item.subject,
        item.body,
        item.language,
        item.category,
        JSON.stringify(
          item.variables
        ),
        item.status,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistMessage(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_communication_messages
      (
        id,
        channel,
        provider,
        recipient,
        recipient_name,
        subject,
        body,
        status,
        provider_message_id,
        crm_company_id,
        crm_contact_id,
        crm_lead_id,
        crm_deal_id,
        campaign_id,
        template_id,
        scheduled_at,
        sent_at,
        delivered_at,
        failed_at,
        retry_count,
        ai_personalized,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status,
        provider_message_id=EXCLUDED.provider_message_id,
        sent_at=EXCLUDED.sent_at,
        delivered_at=EXCLUDED.delivered_at,
        failed_at=EXCLUDED.failed_at,
        retry_count=EXCLUDED.retry_count,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.channel,
        item.provider,
        item.recipient,
        item.recipientName,
        item.subject,
        item.body,
        item.status,
        item.providerMessageId,
        item.crmCompanyId,
        item.crmContactId,
        item.crmLeadId,
        item.crmDealId,
        item.campaignId,
        item.templateId,
        item.scheduledAt,
        item.sentAt,
        item.deliveredAt,
        item.failedAt,
        item.retryCount,
        item.aiPersonalized,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistCampaign(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_communication_campaigns
      (
        id,
        name,
        channel,
        status,
        template_id,
        recipients,
        sent_count,
        delivered_count,
        failed_count,
        scheduled_at,
        started_at,
        completed_at,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status,
        sent_count=EXCLUDED.sent_count,
        delivered_count=EXCLUDED.delivered_count,
        failed_count=EXCLUDED.failed_count,
        completed_at=EXCLUDED.completed_at,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.name,
        item.channel,
        item.status,
        item.templateId,
        JSON.stringify(
          item.recipients
        ),
        item.sentCount,
        item.deliveredCount,
        item.failedCount,
        item.scheduledAt,
        item.startedAt,
        item.completedAt,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistFollowUp(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_communication_followups
      (
        id,
        crm_lead_id,
        crm_deal_id,
        recipient,
        channel,
        message,
        status,
        due_at,
        completed_at,
        attempt_count,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      `,
      [
        item.id,
        item.crmLeadId,
        item.crmDealId,
        item.recipient,
        item.channel,
        item.message,
        item.status,
        item.dueAt,
        item.completedAt,
        item.attemptCount,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistConversation(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_communication_conversations
      (
        id,
        channel,
        external_contact_id,
        crm_contact_id,
        crm_company_id,
        status,
        last_message_at,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        item.id,
        item.channel,
        item.externalContactId,
        item.crmContactId,
        item.crmCompanyId,
        item.status,
        item.lastMessageAt,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistSchedule(
    item
  ) {
    state.schedules.set(
      item.id,
      item
    );

    await execute(
      `
      INSERT INTO ez_communication_schedules
      (
        id,
        message_id,
        campaign_id,
        channel,
        scheduled_at,
        status,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,NOW()
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status
      `,
      [
        item.id,
        item.messageId,
        item.campaignId,
        item.channel,
        item.scheduledAt,
        item.status,
        JSON.stringify(
          item.metadata || {}
        )
      ]
    );
  }

  /* ==========================================================
     START / STOP
  ========================================================== */

  function start() {
    state.running =
      true;

    emit(
      "communication.started",
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
      "communication.stopped",
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

    createChannel,

    createTemplate,
    renderTemplate,

    personalizeMessage,

    sendMessage,
    deliverMessage,

    createCampaign,
    runCampaign,

    createFollowUp,
    recommendFollowUp,

    createConversation,

    processSchedules,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentCommunicationEngine
};
