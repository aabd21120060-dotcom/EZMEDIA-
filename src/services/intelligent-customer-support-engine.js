"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 79
 * INTELLIGENT CUSTOMER SERVICE & SUPPORT ENGINE
 * ============================================================
 *
 * AI Customer Service
 * Tickets
 * Complaints
 * Questions
 * Requests
 * Knowledge Base
 * SLA
 * Priority
 * Routing
 * Escalation
 * AI Replies
 * Sentiment
 * Satisfaction
 * Agent Handoff
 * CRM Integration
 * Communication Integration
 * Automation Integration
 *
 * لا يدّعي هذا المحرك أنه بديل كامل عن موظف بشري.
 * الحالات الحساسة أو غير الواضحة يمكن تحويلها للمراجعة البشرية.
 */

const crypto = require("crypto");

function createIntelligentCustomerSupportEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    crmEngine = null,
    communicationEngine = null,
    monetizationEngine = null,

    automationEngine = null,
    notificationService = null,
    eventBus = null,

    logger = console,

    maxTicketMessageLength =
      Number(
        process.env.SUPPORT_MAX_TICKET_MESSAGE_LENGTH || 10000
      ),

    maxKnowledgeResults =
      Number(
        process.env.SUPPORT_MAX_KNOWLEDGE_RESULTS || 10
      ),

    defaultSlaMinutes =
      Number(
        process.env.SUPPORT_DEFAULT_SLA_MINUTES || 1440
      ),

    criticalSlaMinutes =
      Number(
        process.env.SUPPORT_CRITICAL_SLA_MINUTES || 60
      ),

    autoReplyEnabled =
      process.env.SUPPORT_AUTO_REPLY_ENABLED !== "false",

    humanReviewThreshold =
      Number(
        process.env.SUPPORT_HUMAN_REVIEW_THRESHOLD || 45
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    tickets: new Map(),
    messages: new Map(),
    knowledgeBase: new Map(),
    agents: new Map(),
    escalations: new Map(),
    satisfaction: new Map(),
    slaTimers: new Map(),

    statistics: {
      tickets: 0,
      openTickets: 0,
      pendingTickets: 0,
      resolvedTickets: 0,
      closedTickets: 0,
      escalatedTickets: 0,

      criticalTickets: 0,

      aiProcessed: 0,
      aiAutoReplies: 0,
      humanReviews: 0,

      knowledgeArticles: 0,

      messages: 0,

      averageResolutionMinutes: 0,
      averageFirstResponseMinutes: 0,

      satisfactionResponses: 0,
      satisfactionScore: 0
    }
  };

  /* ==========================================================
     HELPERS
  ========================================================== */

  function now() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      crypto.randomBytes(6).toString("hex")
    );
  }

  function clean(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
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
        "[CODE79] Event error:",
        error.message
      );
    }
  }

  function minutesBetween(start, end) {
    if (!start || !end) {
      return 0;
    }

    const value =
      (new Date(end).getTime() -
        new Date(start).getTime()) /
      60000;

    return Number.isFinite(value)
      ? Math.max(0, value)
      : 0;
  }

  /* ==========================================================
     DATABASE
  ========================================================== */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_support_tickets (
        id TEXT PRIMARY KEY,

        ticket_number TEXT UNIQUE NOT NULL,

        customer_name TEXT,

        customer_email TEXT,

        customer_phone TEXT,

        crm_company_id TEXT,

        crm_contact_id TEXT,

        crm_lead_id TEXT,

        crm_deal_id TEXT,

        subject TEXT,

        message TEXT NOT NULL,

        category TEXT DEFAULT 'general',

        priority TEXT DEFAULT 'normal',

        status TEXT DEFAULT 'open',

        channel TEXT DEFAULT 'web',

        assigned_agent_id TEXT,

        ai_confidence NUMERIC DEFAULT 0,

        sentiment TEXT,

        sentiment_score NUMERIC DEFAULT 0,

        first_response_at TIMESTAMPTZ,

        resolved_at TIMESTAMPTZ,

        closed_at TIMESTAMPTZ,

        sla_due_at TIMESTAMPTZ,

        sla_status TEXT DEFAULT 'within_sla',

        resolution_minutes NUMERIC DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_support_messages (
        id TEXT PRIMARY KEY,

        ticket_id TEXT NOT NULL,

        direction TEXT DEFAULT 'inbound',

        sender_type TEXT DEFAULT 'customer',

        sender_id TEXT,

        channel TEXT DEFAULT 'web',

        message TEXT NOT NULL,

        ai_generated BOOLEAN DEFAULT FALSE,

        human_reviewed BOOLEAN DEFAULT FALSE,

        delivered BOOLEAN DEFAULT FALSE,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_support_knowledge (
        id TEXT PRIMARY KEY,

        title TEXT NOT NULL,

        content TEXT NOT NULL,

        category TEXT DEFAULT 'general',

        language TEXT DEFAULT 'ar',

        keywords JSONB DEFAULT '[]'::jsonb,

        status TEXT DEFAULT 'published',

        priority INTEGER DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_support_agents (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        email TEXT,

        role TEXT DEFAULT 'support',

        status TEXT DEFAULT 'active',

        skills JSONB DEFAULT '[]'::jsonb,

        maximum_open_tickets INTEGER DEFAULT 20,

        current_open_tickets INTEGER DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_support_escalations (
        id TEXT PRIMARY KEY,

        ticket_id TEXT NOT NULL,

        reason TEXT,

        from_level TEXT,

        to_level TEXT,

        status TEXT DEFAULT 'open',

        assigned_agent_id TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        resolved_at TIMESTAMPTZ
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_support_satisfaction (
        id TEXT PRIMARY KEY,

        ticket_id TEXT NOT NULL,

        customer_id TEXT,

        rating INTEGER,

        score NUMERIC DEFAULT 0,

        comment TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_support_ticket_status
      ON ez_support_tickets(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_support_ticket_priority
      ON ez_support_tickets(priority)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_support_ticket_sla
      ON ez_support_tickets(sla_due_at)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_support_messages_ticket
      ON ez_support_messages(ticket_id)
    `);
  }

  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "support.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     TICKET NUMBER
  ========================================================== */

  function generateTicketNumber() {
    const timestamp =
      Date.now()
        .toString()
        .slice(-8);

    const random =
      Math.floor(
        Math.random() * 900 + 100
      );

    return `EZ-${timestamp}-${random}`;
  }

  /* ==========================================================
     CLASSIFICATION
  ========================================================== */

  function localClassify(message) {
    const text =
      clean(message).toLowerCase();

    if (
      text.includes("شكوى") ||
      text.includes("مشكلة") ||
      text.includes("سيء") ||
      text.includes("سيئة")
    ) {
      return {
        category: "complaint",
        priority: "high"
      };
    }

    if (
      text.includes("دفع") ||
      text.includes("فاتورة") ||
      text.includes("اشتراك") ||
      text.includes("مبلغ")
    ) {
      return {
        category: "billing",
        priority: "normal"
      };
    }

    if (
      text.includes("إعلان") ||
      text.includes("اعلان") ||
      text.includes("رعاية") ||
      text.includes("حملة")
    ) {
      return {
        category: "advertising",
        priority: "normal"
      };
    }

    if (
      text.includes("خبر عاجل") ||
      text.includes("عاجل") ||
      text.includes("طارئ")
    ) {
      return {
        category: "urgent",
        priority: "critical"
      };
    }

    if (
      text.includes("حساب") ||
      text.includes("دخول") ||
      text.includes("تسجيل")
    ) {
      return {
        category: "account",
        priority: "normal"
      };
    }

    return {
      category: "general",
      priority: "normal"
    };
  }

  /* ==========================================================
     AI CLASSIFICATION
  ========================================================== */

  async function analyzeTicket(input = {}) {
    const local =
      localClassify(
        input.message
      );

    let result = {
      category:
        local.category,

      priority:
        local.priority,

      sentiment:
        "neutral",

      sentimentScore:
        50,

      confidence:
        55,

      requiresHuman:
        false,

      suggestedAction:
        "respond"
    };

    if (
      aiCore &&
      typeof aiCore.request === "function"
    ) {
      try {
        const aiResult =
          await aiCore.request({
            operation:
              "customer-support-analysis",

            subject:
              input.subject,

            message:
              input.message,

            customer:
              input.customer || null,

            history:
              input.history || [],

            category:
              local.category
          });

        result = {
          category:
            aiResult?.category ||
            result.category,

          priority:
            aiResult?.priority ||
            result.priority,

          sentiment:
            aiResult?.sentiment ||
            result.sentiment,

          sentimentScore:
            Number(
              aiResult?.sentimentScore ??
                result.sentimentScore
            ),

          confidence:
            Number(
              aiResult?.confidence ??
                result.confidence
            ),

          requiresHuman:
            Boolean(
              aiResult?.requiresHuman
            ),

          suggestedAction:
            aiResult?.suggestedAction ||
            result.suggestedAction
        };

        state.statistics.aiProcessed++;
      } catch (error) {
        logger.warn(
          "[CODE79] AI classification failed:",
          error.message
        );
      }
    }

    if (
      result.confidence <
      humanReviewThreshold
    ) {
      result.requiresHuman = true;
    }

    if (
      result.priority === "critical"
    ) {
      result.requiresHuman = true;
    }

    return result;
  }

  /* ==========================================================
     CREATE TICKET
  ========================================================== */

  async function createTicket(input = {}) {
    const message =
      clean(input.message);

    if (!message) {
      throw new Error(
        "Ticket message is required"
      );
    }

    if (
      message.length >
      maxTicketMessageLength
    ) {
      throw new Error(
        "Ticket message exceeds maximum allowed length"
      );
    }

    const analysis =
      await analyzeTicket({
        subject:
          input.subject,

        message,

        customer:
          input.customer,

        history:
          input.history
      });

    const priority =
      input.priority ||
      analysis.priority;

    const slaMinutes =
      priority === "critical"
        ? criticalSlaMinutes
        : defaultSlaMinutes;

    const createdAt =
      now();

    const slaDueAt =
      new Date(
        Date.now() +
          slaMinutes * 60000
      ).toISOString();

    const ticket = {
      id:
        createId("ticket"),

      ticketNumber:
        generateTicketNumber(),

      customerName:
        clean(
          input.customerName
        ),

      customerEmail:
        clean(
          input.customerEmail
        ),

      customerPhone:
        clean(
          input.customerPhone
        ),

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

      subject:
        clean(
          input.subject ||
            "طلب خدمة عملاء"
        ),

      message,

      category:
        analysis.category,

      priority,

      status:
        "open",

      channel:
        input.channel ||
        "web",

      assignedAgentId:
        null,

      aiConfidence:
        analysis.confidence,

      sentiment:
        analysis.sentiment,

      sentimentScore:
        analysis.sentimentScore,

      firstResponseAt:
        null,

      resolvedAt:
        null,

      closedAt:
        null,

      slaDueAt,

      slaStatus:
        "within_sla",

      resolutionMinutes:
        0,

      metadata:
        input.metadata ||
        {},

      createdAt,

      updatedAt:
        createdAt
    };

    state.tickets.set(
      ticket.id,
      ticket
    );

    state.statistics.tickets++;
    state.statistics.openTickets++;

    if (
      priority === "critical"
    ) {
      state.statistics.criticalTickets++;
    }

    await persistTicket(
      ticket
    );

    await createMessage({
      ticketId:
        ticket.id,

      direction:
        "inbound",

      senderType:
        "customer",

      senderId:
        ticket.customerEmail,

      channel:
        ticket.channel,

      message,

      aiGenerated:
        false
    });

    await routeTicket(
      ticket
    );

    if (
      analysis.requiresHuman
    ) {
      state.statistics.humanReviews++;

      await escalateTicket(
        ticket.id,
        "AI confidence or ticket risk requires human review"
      );
    } else if (
      autoReplyEnabled
    ) {
      await generateAndSendReply(
        ticket.id
      );
    }

    emit(
      "support.ticket.created",
      {
        ticket:
          clone(ticket)
      }
    );

    return clone(ticket);
  }

  /* ==========================================================
     KNOWLEDGE BASE
  ========================================================== */

  async function createKnowledgeArticle(
    input = {}
  ) {
    if (
      !input.title ||
      !input.content
    ) {
      throw new Error(
        "Knowledge title and content are required"
      );
    }

    const article = {
      id:
        createId("knowledge"),

      title:
        clean(input.title),

      content:
        clean(input.content),

      category:
        input.category ||
        "general",

      language:
        input.language ||
        "ar",

      keywords:
        Array.isArray(
          input.keywords
        )
          ? input.keywords
          : [],

      status:
        input.status ||
        "published",

      priority:
        Number(
          input.priority || 0
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.knowledgeBase.set(
      article.id,
      article
    );

    state.statistics.knowledgeArticles++;

    await persistKnowledge(
      article
    );

    return clone(article);
  }

  function searchKnowledge(
    query
  ) {
    const text =
      clean(query)
        .toLowerCase();

    if (!text) {
      return [];
    }

    const terms =
      text.split(/\s+/);

    const results =
      Array.from(
        state.knowledgeBase.values()
      )
        .map(article => {
          const haystack =
            (
              article.title +
              " " +
              article.content +
              " " +
              article.keywords.join(" ")
            ).toLowerCase();

          let score = 0;

          for (
            const term of terms
          ) {
            if (
              haystack.includes(term)
            ) {
              score++;
            }
          }

          return {
            article,
            score
          };
        })
        .filter(
          item => item.score > 0
        )
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .slice(
          0,
          maxKnowledgeResults
        );

    return results.map(
      item => ({
        ...clone(item.article),
        relevance:
          item.score
      })
    );
  }

  /* ==========================================================
     AI REPLY
  ========================================================== */

  async function generateReply(
    ticketId
  ) {
    const ticket =
      state.tickets.get(
        ticketId
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    const knowledge =
      searchKnowledge(
        ticket.message
      );

    let reply = null;

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        const result =
          await aiOrchestrator.process({
            operation:
              "customer-support-reply",

            ticket:
              clone(ticket),

            knowledge:

              knowledge,

            language:
              "ar"
          });

        reply =
          result?.output ||
          result?.reply ||
          result?.message ||
          null;
      } catch (error) {
        logger.warn(
          "[CODE79] Orchestrator reply failed:",
          error.message
        );
      }
    }

    if (
      !reply &&
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        const result =
          await aiCore.request({
            operation:
              "customer-support-reply",

            ticket:
              clone(ticket),

            knowledge:
              knowledge,

            language:
              "ar"
          });

        reply =
          result?.reply ||
          result?.message ||
          result?.output ||
          null;
      } catch (error) {
        logger.warn(
          "[CODE79] AI reply failed:",
          error.message
        );
      }
    }

    if (!reply) {
      if (
        knowledge.length > 0
      ) {
        reply =
          `مرحبًا ${ticket.customerName || "بك"}،\n\n` +
          `${knowledge[0].content}\n\n` +
          "إذا لم يحل ذلك استفسارك، فسيتم تحويل طلبك إلى فريق الدعم للمراجعة.";
      } else {
        reply =
          "مرحبًا بك في EZ MEDIA.\n\n" +
          "تم استلام طلبك وسيتم مراجعته من فريق الدعم.";
      }
    }

    return {
      reply:
        clean(reply),

      knowledgeUsed:
        knowledge.map(
          article => article.id
        )
    };
  }

  /* ==========================================================
     SEND REPLY
  ========================================================== */

  async function generateAndSendReply(
    ticketId
  ) {
    const ticket =
      state.tickets.get(
        ticketId
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    const generated =
      await generateReply(
        ticketId
      );

    if (
      !generated.reply
    ) {
      return null;
    }

    const message =
      await createMessage({
        ticketId,

        direction:
          "outbound",

        senderType:
          "ai",

        senderId:
          "ez-ai",

        channel:
          ticket.channel,

        message:
          generated.reply,

        aiGenerated:
          true
      });

    ticket.firstResponseAt =
      ticket.firstResponseAt ||
      now();

    ticket.updatedAt =
      now();

    await persistTicket(
      ticket
    );

    state.statistics.aiAutoReplies++;

    if (
      communicationEngine &&
      typeof communicationEngine.sendMessage ===
        "function"
    ) {
      try {
        let recipient =
          ticket.customerEmail;

        if (
          ticket.channel ===
          "whatsapp"
        ) {
          recipient =
            ticket.customerPhone;
        }

        if (
          recipient
        ) {
          await communicationEngine.sendMessage({
            channel:
              ticket.channel,

            recipient,

            recipientName:
              ticket.customerName,

            subject:
              ticket.subject,

            body:
              generated.reply,

            crmCompanyId:
              ticket.crmCompanyId,

            crmContactId:
              ticket.crmContactId,

            crmLeadId:
              ticket.crmLeadId,

            crmDealId:
              ticket.crmDealId,

            metadata: {
              supportTicketId:
                ticket.id,

              aiGenerated:
                true
            }
          });
        }
      } catch (error) {
        logger.warn(
          "[CODE79] Communication delivery failed:",
          error.message
        );
      }
    }

    emit(
      "support.ticket.ai_replied",
      {
        ticketId,
        message:
          clone(message)
      }
    );

    return clone(message);
  }

  /* ==========================================================
     MESSAGES
  ========================================================== */

  async function createMessage(
    input = {}
  ) {
    if (
      !input.ticketId ||
      !input.message
    ) {
      throw new Error(
        "ticketId and message are required"
      );
    }

    const message = {
      id:
        createId("supportmsg"),

      ticketId:
        input.ticketId,

      direction:
        input.direction ||
        "inbound",

      senderType:
        input.senderType ||
        "customer",

      senderId:
        clean(
          input.senderId
        ),

      channel:
        input.channel ||
        "web",

      message:
        clean(
          input.message
        ),

      aiGenerated:
        Boolean(
          input.aiGenerated
        ),

      humanReviewed:
        Boolean(
          input.humanReviewed
        ),

      delivered:
        Boolean(
          input.delivered
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.messages.set(
      message.id,
      message
    );

    state.statistics.messages++;

    await persistMessage(
      message
    );

    return clone(message);
  }

  /* ==========================================================
     ROUTING
  ========================================================== */

  async function routeTicket(
    ticket
  ) {
    const agents =
      Array.from(
        state.agents.values()
      )
        .filter(
          agent =>
            agent.status ===
            "active"
        )
        .filter(
          agent =>
            agent.currentOpenTickets <
            agent.maximumOpenTickets
        );

    if (
      agents.length === 0
    ) {
      return null;
    }

    const matching =
      agents.filter(agent => {
        if (
          !Array.isArray(
            agent.skills
          )
        ) {
          return false;
        }

        return agent.skills
          .includes(
            ticket.category
          );
      });

    const pool =
      matching.length > 0
        ? matching
        : agents;

    pool.sort(
      (a, b) =>
        a.currentOpenTickets -
        b.currentOpenTickets
    );

    const agent =
      pool[0];

    ticket.assignedAgentId =
      agent.id;

    agent.currentOpenTickets++;

    ticket.updatedAt =
      now();

    await persistTicket(
      ticket
    );

    await persistAgent(
      agent
    );

    return clone(agent);
  }

  async function createAgent(
    input = {}
  ) {
    if (!input.name) {
      throw new Error(
        "Agent name is required"
      );
    }

    const agent = {
      id:
        createId("agent"),

      name:
        clean(input.name),

      email:
        clean(input.email),

      role:
        input.role ||
        "support",

      status:
        input.status ||
        "active",

      skills:
        Array.isArray(
          input.skills
        )
          ? input.skills
          : [],

      maximumOpenTickets:
        Number(
          input.maximumOpenTickets ||
            20
        ),

      currentOpenTickets:
        0,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.agents.set(
      agent.id,
      agent
    );

    await persistAgent(
      agent
    );

    return clone(agent);
  }

  /* ==========================================================
     ESCALATION
  ========================================================== */

  async function escalateTicket(
    ticketId,
    reason,
    level = "human"
  ) {
    const ticket =
      state.tickets.get(
        ticketId
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    const escalation = {
      id:
        createId("escalation"),

      ticketId,

      reason:
        clean(reason),

      fromLevel:
        "ai",

      toLevel:
        level,

      status:
        "open",

      assignedAgentId:
        ticket.assignedAgentId,

      metadata: {},

      createdAt:
        now(),

      resolvedAt:
        null
    };

    state.escalations.set(
      escalation.id,
      escalation
    );

    state.statistics.escalatedTickets++;

    ticket.status =
      "human_review";

    ticket.updatedAt =
      now();

    await persistTicket(
      ticket
    );

    await persistEscalation(
      escalation
    );

    if (
      notificationService &&
      typeof notificationService.notify ===
        "function"
    ) {
      try {
        await notificationService.notify({
          type:
            "support_escalation",

          priority:
            ticket.priority,

          ticketId:
            ticket.id,

          ticketNumber:
            ticket.ticketNumber,

          reason:
            escalation.reason
        });
      } catch (error) {
        logger.warn(
          "[CODE79] Escalation notification failed:",
          error.message
        );
      }
    }

    emit(
      "support.ticket.escalated",
      {
        ticket:
          clone(ticket),

        escalation:
          clone(escalation)
      }
    );

    return clone(
      escalation
    );
  }

  /* ==========================================================
     STATUS UPDATES
  ========================================================== */

  async function updateTicket(
    ticketId,
    patch = {}
  ) {
    const ticket =
      state.tickets.get(
        ticketId
      );

    if (!ticket) {
      throw new Error(
        "Ticket not found"
      );
    }

    const previousStatus =
      ticket.status;

    if (
      patch.status
    ) {
      ticket.status =
        patch.status;
    }

    if (
      patch.priority
    ) {
      ticket.priority =
        patch.priority;
    }

    if (
      patch.assignedAgentId
    ) {
      ticket.assignedAgentId =
        patch.assignedAgentId;
    }

    if (
      ticket.status ===
        "resolved" &&
      !ticket.resolvedAt
    ) {
      ticket.resolvedAt =
        now();

      ticket.resolutionMinutes =
        minutesBetween(
          ticket.createdAt,
          ticket.resolvedAt
        );

      state.statistics.resolvedTickets++;

      state.statistics.openTickets =
        Math.max(
          0,
          state.statistics.openTickets -
            1
        );
    }

    if (
      ticket.status ===
        "closed" &&
      !ticket.closedAt
    ) {
      ticket.closedAt =
        now();

      state.statistics.closedTickets++;
    }

    if (
      previousStatus !==
      ticket.status &&
      ticket.status ===
        "open"
    ) {
      state.statistics.openTickets++;
    }

    ticket.updatedAt =
      now();

    await persistTicket(
      ticket
    );

    return clone(ticket);
  }

  /* ==========================================================
     SLA MONITOR
  ========================================================== */

  async function checkSLA() {
    const current =
      Date.now();

    const tickets =
      Array.from(
        state.tickets.values()
      );

    const breached = [];

    for (
      const ticket of tickets
    ) {
      if (
        [
          "resolved",
          "closed"
        ].includes(
          ticket.status
        )
      ) {
        continue;
      }

      const due =
        new Date(
          ticket.slaDueAt
        ).getTime();

      if (
        current >= due
      ) {
        ticket.slaStatus =
          "breached";

        ticket.updatedAt =
          now();

        breached.push(
          ticket.id
        );

        await persistTicket(
          ticket
        );

        await escalateTicket(
          ticket.id,
          "SLA breached",
          "manager"
        );
      }
    }

    return {
      checked:
        tickets.length,

      breached:
        breached.length,

      ticketIds:
        breached
    };
  }

  /* ==========================================================
     SATISFACTION
  ========================================================== */

  async function recordSatisfaction(
    input = {}
  ) {
    const rating =
      Number(input.rating);

    if (
      !Number.isInteger(
        rating
      ) ||
      rating < 1 ||
      rating > 5
    ) {
      throw new Error(
        "Rating must be between 1 and 5"
      );
    }

    const item = {
      id:
        createId("satisfaction"),

      ticketId:
        input.ticketId,

      customerId:
        clean(
          input.customerId
        ),

      rating,

      score:
        rating * 20,

      comment:
        clean(
          input.comment
        ),

      createdAt:
        now()
    };

    state.satisfaction.set(
      item.id,
      item
    );

    state.statistics.satisfactionResponses++;

    const values =
      Array.from(
        state.satisfaction.values()
      );

    state.statistics.satisfactionScore =
      values.length
        ? values.reduce(
            (sum, row) =>
              sum + row.score,
            0
          ) / values.length
        : 0;

    await persistSatisfaction(
      item
    );

    return clone(item);
  }

  /* ==========================================================
     DASHBOARD
  ========================================================== */

  async function getDashboard() {
    const tickets =
      Array.from(
        state.tickets.values()
      );

    const byCategory = {};

    const byPriority = {};

    const byStatus = {};

    for (
      const ticket of tickets
    ) {
      byCategory[
        ticket.category
      ] =
        (byCategory[
          ticket.category
        ] || 0) + 1;

      byPriority[
        ticket.priority
      ] =
        (byPriority[
          ticket.priority
        ] || 0) + 1;

      byStatus[
        ticket.status
      ] =
        (byStatus[
          ticket.status
        ] || 0) + 1;
    }

    return {
      statistics:
        getStatistics(),

      tickets: {
        byCategory,
        byPriority,
        byStatus
      },

      knowledgeBase: {
        articles:
          state.knowledgeBase.size
      },

      agents: {
        total:
          state.agents.size,

        active:
          Array.from(
            state.agents.values()
          ).filter(
            agent =>
              agent.status ===
              "active"
          ).length
      },

      timestamp:
        now()
    };
  }

  /* ==========================================================
     STATISTICS
  ========================================================== */

  function getStatistics() {
    return {
      ...state.statistics,

      ticketsCache:
        state.tickets.size,

      messagesCache:
        state.messages.size,

      knowledgeCache:
        state.knowledgeBase.size,

      agentsCache:
        state.agents.size,

      escalationsCache:
        state.escalations.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Customer Service & Support Engine",

      code:
        "79",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      autoReplyEnabled,

      integrations: {
        persistence:
          Boolean(persistence),

        aiCore:
          Boolean(aiCore),

        aiOrchestrator:
          Boolean(aiOrchestrator),

        crm:
          Boolean(crmEngine),

        communication:
          Boolean(communicationEngine),

        monetization:
          Boolean(monetizationEngine),

        automation:
          Boolean(automationEngine)
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

      ai:
        Boolean(aiCore),

      crm:
        Boolean(crmEngine),

      communication:
        Boolean(communicationEngine),

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

  async function persistTicket(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_support_tickets
      (
        id,
        ticket_number,
        customer_name,
        customer_email,
        customer_phone,
        crm_company_id,
        crm_contact_id,
        crm_lead_id,
        crm_deal_id,
        subject,
        message,
        category,
        priority,
        status,
        channel,
        assigned_agent_id,
        ai_confidence,
        sentiment,
        sentiment_score,
        first_response_at,
        resolved_at,
        closed_at,
        sla_due_at,
        sla_status,
        resolution_minutes,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status,
        priority=EXCLUDED.priority,
        assigned_agent_id=EXCLUDED.assigned_agent_id,
        first_response_at=EXCLUDED.first_response_at,
        resolved_at=EXCLUDED.resolved_at,
        closed_at=EXCLUDED.closed_at,
        sla_status=EXCLUDED.sla_status,
        resolution_minutes=EXCLUDED.resolution_minutes,
        metadata=EXCLUDED.metadata,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.ticketNumber,
        item.customerName,
        item.customerEmail,
        item.customerPhone,
        item.crmCompanyId,
        item.crmContactId,
        item.crmLeadId,
        item.crmDealId,
        item.subject,
        item.message,
        item.category,
        item.priority,
        item.status,
        item.channel,
        item.assignedAgentId,
        item.aiConfidence,
        item.sentiment,
        item.sentimentScore,
        item.firstResponseAt,
        item.resolvedAt,
        item.closedAt,
        item.slaDueAt,
        item.slaStatus,
        item.resolutionMinutes,
        JSON.stringify(item.metadata),
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
      INSERT INTO ez_support_messages
      (
        id,
        ticket_id,
        direction,
        sender_type,
        sender_id,
        channel,
        message,
        ai_generated,
        human_reviewed,
        delivered,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT(id)
      DO UPDATE SET
        delivered=EXCLUDED.delivered,
        human_reviewed=EXCLUDED.human_reviewed
      `,
      [
        item.id,
        item.ticketId,
        item.direction,
        item.senderType,
        item.senderId,
        item.channel,
        item.message,
        item.aiGenerated,
        item.humanReviewed,
        item.delivered,
        JSON.stringify(item.metadata),
        item.createdAt
      ]
    );
  }

  async function persistKnowledge(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_support_knowledge
      (
        id,
        title,
        content,
        category,
        language,
        keywords,
        status,
        priority,
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
        item.title,
        item.content,
        item.category,
        item.language,
        JSON.stringify(item.keywords),
        item.status,
        item.priority,
        JSON.stringify(item.metadata),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistAgent(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_support_agents
      (
        id,
        name,
        email,
        role,
        status,
        skills,
        maximum_open_tickets,
        current_open_tickets,
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
        status=EXCLUDED.status,
        current_open_tickets=EXCLUDED.current_open_tickets,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.name,
        item.email,
        item.role,
        item.status,
        JSON.stringify(item.skills),
        item.maximumOpenTickets,
        item.currentOpenTickets,
        JSON.stringify(item.metadata),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistEscalation(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_support_escalations
      (
        id,
        ticket_id,
        reason,
        from_level,
        to_level,
        status,
        assigned_agent_id,
        metadata,
        created_at,
        resolved_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        item.id,
        item.ticketId,
        item.reason,
        item.fromLevel,
        item.toLevel,
        item.status,
        item.assignedAgentId,
        JSON.stringify(item.metadata),
        item.createdAt,
        item.resolvedAt
      ]
    );
  }

  async function persistSatisfaction(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_support_satisfaction
      (
        id,
        ticket_id,
        customer_id,
        rating,
        score,
        comment,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        item.id,
        item.ticketId,
        item.customerId,
        item.rating,
        item.score,
        item.comment,
        item.createdAt
      ]
    );
  }

  /* ==========================================================
     START / STOP
  ========================================================== */

  function start() {
    state.running = true;

    emit(
      "support.started",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  function stop() {
    state.running = false;

    emit(
      "support.stopped",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  return {
    initialize,
    start,
    stop,

    createTicket,
    analyzeTicket,

    createMessage,

    createKnowledgeArticle,
    searchKnowledge,

    generateReply,
    generateAndSendReply,

    createAgent,
    routeTicket,

    escalateTicket,
    updateTicket,

    checkSLA,

    recordSatisfaction,

    getDashboard,
    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentCustomerSupportEngine
};
