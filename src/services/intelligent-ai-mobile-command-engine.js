"use strict";

/*
 * EZ MEDIA
 * CODE 109
 * Intelligent AI Mobile Command Center
 *
 * طبقة الذكاء الاصطناعي المخصصة للجوال.
 *
 * المسؤوليات:
 * - استقبال أوامر المستخدم من الجوال
 * - فهم نية المستخدم
 * - قراءة حالة EZ MEDIA
 * - الاستفادة من AI Core / AI Orchestrator
 * - إنشاء خطط تنفيذ
 * - اقتراح القرارات
 * - طلب موافقة بشرية للعمليات الحساسة
 * - تسجيل جميع العمليات
 *
 * مبدأ أمني:
 * الذكاء الاصطناعي لا يمنح نفسه صلاحيات إضافية.
 * القرارات الحساسة تمر عبر Human-in-the-Loop.
 */

function createIntelligentAIMobileCommandEngine(options = {}) {
  const {
    persistence,
    aiCore,
    aiOrchestrator,
    commandEngine,
    approvalEngine,
    executiveCenter,
    analyticsEngine,
    audienceEngine,
    advertisingEngine,
    monetizationEngine,
    crmEngine,
    newsroomEngine,
    liveBroadcastEngine,
    broadcastScheduler,
    contentFactory,
    distributionEngine,
    securityEngine,
    notificationEngine,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,
    startedAt: null,
    requests: 0,
    successful: 0,
    failed: 0,
    pendingApprovals: 0,
    lastRequestAt: null,
    lastRequestId: null,
    lastError: null,
    conversations: new Map()
  };

  const MAX_CONVERSATIONS = Number(
    process.env.AI_MOBILE_MAX_CONVERSATIONS || 10000
  );

  const MAX_MESSAGES_PER_CONVERSATION = Number(
    process.env.AI_MOBILE_MAX_MESSAGES || 100
  );

  const TIMEOUT_MS = Number(
    process.env.AI_MOBILE_TIMEOUT_MS || 120000
  );

  const AI_ENABLED =
    process.env.AI_MOBILE_ENABLED !== "false";

  function now() {
    return new Date().toISOString();
  }

  function id(prefix = "aim") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function safeString(value, fallback = "") {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    return String(value).slice(0, 20000);
  }

  function trimConversation(conversation) {
    if (
      conversation.messages.length <=
      MAX_MESSAGES_PER_CONVERSATION
    ) {
      return;
    }

    conversation.messages =
      conversation.messages.slice(
        -MAX_MESSAGES_PER_CONVERSATION
      );
  }

  function ensureConversation(conversationId) {
    const cid =
      conversationId ||
      id("conversation");

    if (!state.conversations.has(cid)) {
      if (
        state.conversations.size >=
        MAX_CONVERSATIONS
      ) {
        const first =
          state.conversations.keys().next().value;

        if (first) {
          state.conversations.delete(first);
        }
      }

      state.conversations.set(cid, {
        id: cid,
        createdAt: now(),
        updatedAt: now(),
        messages: []
      });
    }

    return state.conversations.get(cid);
  }

  async function audit(action, data = {}) {
    try {
      if (
        persistence &&
        typeof persistence.addAuditLog ===
          "function"
      ) {
        await persistence.addAuditLog({
          actorType: "ai_mobile",
          action,
          entityType: "ai_mobile_command",
          entityId: data.requestId || null,
          metadata: data
        });
      }
    } catch (error) {
      logger.error(
        "[AI Mobile] audit failed:",
        error.message
      );
    }
  }

  async function getSystemSnapshot() {
    const snapshot = {
      timestamp: now(),
      platform: null,
      command: null,
      analytics: null,
      audience: null,
      advertising: null,
      monetization: null,
      crm: null,
      newsroom: null,
      live: null,
      scheduler: null,
      contentFactory: null,
      distribution: null
    };

    async function safeCall(target, method) {
      try {
        if (
          target &&
          typeof target[method] === "function"
        ) {
          return await target[method]();
        }
      } catch (error) {
        return {
          status: "unavailable",
          error: error.message
        };
      }

      return {
        status: "unavailable"
      };
    }

    snapshot.command =
      await safeCall(
        commandEngine,
        "getSnapshot"
      );

    snapshot.analytics =
      await safeCall(
        analyticsEngine,
        "getDashboard"
      );

    snapshot.audience =
      await safeCall(
        audienceEngine,
        "getDashboard"
      );

    snapshot.advertising =
      await safeCall(
        advertisingEngine,
        "getDashboard"
      );

    snapshot.monetization =
      await safeCall(
        monetizationEngine,
        "getDashboard"
      );

    snapshot.crm =
      await safeCall(
        crmEngine,
        "getDashboard"
      );

    snapshot.newsroom =
      await safeCall(
        newsroomEngine,
        "getStatistics"
      );

    snapshot.live =
      await safeCall(
        liveBroadcastEngine,
        "getStatus"
      );

    snapshot.scheduler =
      await safeCall(
        broadcastScheduler,
        "getStatus"
      );

    snapshot.contentFactory =
      await safeCall(
        contentFactory,
        "getStatus"
      );

    snapshot.distribution =
      await safeCall(
        distributionEngine,
        "getStatus"
      );

    return snapshot;
  }

  function classifyIntent(message) {
    const text = safeString(
      message
    ).toLowerCase();

    if (
      /عاجل|خبر عاجل|breaking|breaking news/.test(
        text
      )
    ) {
      return "breaking_news";
    }

    if (
      /بث|لايف|مباشر|live|broadcast/.test(
        text
      )
    ) {
      return "broadcast";
    }

    if (
      /جمهور|مشاهدات|متابع|تفاعل|audience|analytics/.test(
        text
      )
    ) {
      return "audience_analytics";
    }

    if (
      /إعلان|اعلان|رعاية|حملة|advertising|sponsor/.test(
        text
      )
    ) {
      return "advertising";
    }

    if (
      /دخل|إيراد|ايراد|مبيعات|revenue|money/.test(
        text
      )
    ) {
      return "revenue";
    }

    if (
      /خبر|مقال|محتوى|نشر|publish|content/.test(
        text
      )
    ) {
      return "content";
    }

    if (
      /موافقة|اعتماد|approve|approval/.test(
        text
      )
    ) {
      return "approval";
    }

    if (
      /أمن|اختراق|مخاطر|security|risk/.test(
        text
      )
    ) {
      return "security";
    }

    if (
      /منصة|النظام|حالة|status|health/.test(
        text
      )
    ) {
      return "platform_status";
    }

    return "general";
  }

  function isSensitiveIntent(intent) {
    return [
      "broadcast",
      "advertising",
      "revenue",
      "approval",
      "security"
    ].includes(intent);
  }

  async function askAI({
    message,
    intent,
    snapshot,
    conversation
  }) {
    if (!AI_ENABLED) {
      return {
        provider: "disabled",
        answer:
          "الذكاء الاصطناعي للجوال متوقف حاليًا.",
        confidence: 0,
        requiresApproval: false
      };
    }

    const systemPrompt = `
أنت العقل التنفيذي الذكي لمنصة EZ MEDIA.

أنت تعمل داخل منصة إعلامية حقيقية.
مهمتك مساعدة المسؤول في:
- فهم حالة المنصة
- تحليل الأخبار
- تحليل الجمهور
- تحليل الإيرادات
- تحليل البث
- تحليل الإعلانات والرعايات
- اقتراح القرارات
- بناء خطط التنفيذ

القواعد:
1. لا تخترع بيانات.
2. إذا لم تتوفر البيانات قل إنها غير متوفرة.
3. لا تدّعي تنفيذ عملية لم يتم تنفيذها.
4. العمليات الحساسة تحتاج موافقة بشرية.
5. لا ترسل رسائل خارجية بنفسك دون مزود فعلي وصلاحية.
6. لا تنفذ قرارات قانونية أو مالية حساسة تلقائيًا.
7. كن مختصرًا وواضحًا.
8. أجب بالعربية.
9. إذا كان المطلوب تنفيذًا حساسًا، اقترح خطة وموافقة بدل التنفيذ المباشر.

نية المستخدم:
${intent}

حالة النظام:
${JSON.stringify(snapshot).slice(0, 50000)}

المحادثة السابقة:
${JSON.stringify(
  conversation.messages.slice(-10)
).slice(0, 20000)}
`;

    try {
      if (
        aiOrchestrator &&
        typeof aiOrchestrator.process ===
          "function"
      ) {
        const result =
          await aiOrchestrator.process({
            type: "ai-mobile-command",
            input: {
              systemPrompt,
              message
            },
            metadata: {
              source: "mobile",
              intent
            }
          });

        return {
          provider: "orchestrator",
          answer:
            result?.answer ||
            result?.output ||
            result?.text ||
            JSON.stringify(result),
          confidence:
            Number(
              result?.confidence || 80
            ),
          requiresApproval:
            isSensitiveIntent(intent)
        };
      }

      if (
        aiCore &&
        typeof aiCore.request === "function"
      ) {
        const result =
          await aiCore.request({
            type: "mobile-command",
            prompt: `${systemPrompt}\n\nطلب المستخدم:\n${message}`
          });

        return {
          provider: "ai-core",
          answer:
            result?.text ||
            result?.output ||
            result?.answer ||
            JSON.stringify(result),
          confidence:
            Number(
              result?.confidence || 75
            ),
          requiresApproval:
            isSensitiveIntent(intent)
        };
      }

      return {
        provider: "fallback",
        answer:
          "طبقة الذكاء الاصطناعي غير متصلة حاليًا. تم استلام الطلب ويمكن ربطه عند توفر AI Provider.",
        confidence: 0,
        requiresApproval:
          isSensitiveIntent(intent)
      };
    } catch (error) {
      throw new Error(
        `AI processing failed: ${error.message}`
      );
    }
  }

  async function createApprovalRequest({
    requestId,
    message,
    intent,
    recommendation
  }) {
    if (
      !approvalEngine ||
      typeof approvalEngine.createRequest !==
        "function"
    ) {
      state.pendingApprovals += 1;

      return {
        created: false,
        reason:
          "approval_engine_unavailable",
        requiresApproval: true
      };
    }

    const approval =
      await approvalEngine.createRequest({
        source: "ai_mobile",
        sourceId: requestId,
        type: intent,
        title:
          "موافقة مطلوبة من مركز الذكاء الاصطناعي",
        description: message,
        recommendation,
        riskLevel:
          intent === "security"
            ? "high"
            : "medium",
        metadata: {
          requestId,
          mobile: true
        }
      });

    state.pendingApprovals += 1;

    return {
      created: true,
      approval
    };
  }

  async function processCommand(input = {}) {
    const requestId = id("ai_mobile");
    const started = Date.now();

    state.requests += 1;
    state.lastRequestId = requestId;
    state.lastRequestAt = now();

    const message = safeString(
      input.message ||
        input.command ||
        input.prompt
    );

    if (!message.trim()) {
      throw new Error(
        "يجب إرسال رسالة أو أمر."
      );
    }

    const conversation =
      ensureConversation(
        input.conversationId
      );

    const intent =
      classifyIntent(message);

    conversation.messages.push({
      role: "user",
      content: message,
      createdAt: now()
    });

    trimConversation(conversation);

    try {
      const snapshot =
        await getSystemSnapshot();

      const aiResult =
        await Promise.race([
          askAI({
            message,
            intent,
            snapshot,
            conversation
          }),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "AI mobile command timeout"
                  )
                ),
              TIMEOUT_MS
            )
          )
        ]);

      let approval = null;

      if (
        aiResult.requiresApproval
      ) {
        approval =
          await createApprovalRequest({
            requestId,
            message,
            intent,
            recommendation:
              aiResult.answer
          });
      }

      const response = {
        requestId,
        conversationId:
          conversation.id,
        intent,
        answer:
          aiResult.answer,
        confidence:
          aiResult.confidence,
        requiresApproval:
          Boolean(
            aiResult.requiresApproval
          ),
        approval,
        execution: {
          executed: false,
          reason:
            aiResult.requiresApproval
              ? "human_approval_required"
              : "analysis_only"
        },
        durationMs:
          Date.now() - started,
        timestamp: now()
      };

      conversation.messages.push({
        role: "assistant",
        content: response.answer,
        intent,
        createdAt: now()
      });

      conversation.updatedAt = now();

      trimConversation(conversation);

      state.successful += 1;

      await audit(
        "ai_mobile_command_completed",
        response
      );

      return response;
    } catch (error) {
      state.failed += 1;
      state.lastError =
        error.message;

      await audit(
        "ai_mobile_command_failed",
        {
          requestId,
          error: error.message
        }
      );

      throw error;
    }
  }

  async function getConversation(idValue) {
    if (!idValue) {
      return null;
    }

    return (
      state.conversations.get(
        idValue
      ) || null
    );
  }

  async function clearConversation(idValue) {
    if (!idValue) {
      return false;
    }

    return state.conversations.delete(
      idValue
    );
  }

  function getStatistics() {
    return {
      initialized:
        state.initialized,
      running:
        state.running,
      requests:
        state.requests,
      successful:
        state.successful,
      failed:
        state.failed,
      pendingApprovals:
        state.pendingApprovals,
      conversations:
        state.conversations.size,
      lastRequestAt:
        state.lastRequestAt,
      lastRequestId:
        state.lastRequestId,
      lastError:
        state.lastError
    };
  }

  async function healthCheck() {
    return {
      status:
        state.running
          ? "healthy"
          : "stopped",
      initialized:
        state.initialized,
      running:
        state.running,
      aiEnabled:
        AI_ENABLED,
      timestamp:
        now()
    };
  }

  async function initialize() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    await audit(
      "ai_mobile_command_initialized"
    );
  }

  function start() {
    state.running = true;
    state.startedAt = now();

    return getStatistics();
  }

  function stop() {
    state.running = false;

    return getStatistics();
  }

  return {
    initialize,
    start,
    stop,
    processCommand,
    getConversation,
    clearConversation,
    getSystemSnapshot,
    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentAIMobileCommandEngine
};
