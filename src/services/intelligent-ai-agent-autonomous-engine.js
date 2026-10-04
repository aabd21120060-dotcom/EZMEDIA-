"use strict";

/*
 * EZ MEDIA
 * CODE 114
 * Intelligent AI Agent & Autonomous Task Engine
 *
 * ARCHITECTURE
 *
 * User / Event
 *      ↓
 * Agent Router
 *      ↓
 * Agent
 *      ↓
 * Planner
 *      ↓
 * Policy / Security
 *      ↓
 * Approval Gate
 *      ↓
 * Tools
 *      ↓
 * Verification
 *      ↓
 * Memory
 *      ↓
 * Result
 *
 * الوكيل لا يملك صلاحية تنفيذ أوامر النظام
 * ولا shell ولا أوامر تشغيلية خطرة.
 *
 * العمليات الحساسة تمر بالموافقة البشرية.
 */

function createIntelligentAIAgentAutonomousEngine(
  options = {}
) {
  const {
    persistence,
    aiCore,
    aiOrchestrator,
    memoryEngine,
    ragEngine,
    vectorSearchEngine,
    approvalEngine,
    securityEngine,
    commandEngine,
    automationEngine,
    workflowEngine,
    newsroomEngine,
    contentFactory,
    distributionEngine,
    analyticsEngine,
    audienceEngine,
    advertisingEngine,
    monetizationEngine,
    crmEngine,
    communicationEngine,
    customerSupportEngine,
    liveBroadcastEngine,
    broadcastScheduler,
    legalEngine,
    ethicsEngine,
    qualityEngine,
    brandEngine,
    notificationService,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,

    agents: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    tasksWaitingApproval: 0,
    toolCalls: 0,

    lastTaskAt: null,
    lastError: null
  };

  const MAX_AGENTS = Number(
    process.env.AI_AGENT_MAX_AGENTS || 100
  );

  const MAX_TASKS = Number(
    process.env.AI_AGENT_MAX_TASKS || 100000
  );

  const MAX_STEPS = Number(
    process.env.AI_AGENT_MAX_STEPS || 20
  );

  const TASK_TIMEOUT_MS = Number(
    process.env.AI_AGENT_TASK_TIMEOUT_MS ||
      120000
  );

  const MAX_RETRIES = Number(
    process.env.AI_AGENT_MAX_RETRIES || 2
  );

  const AUTO_EXECUTION =
    process.env.AI_AGENT_AUTO_EXECUTION !==
    "false";

  const HUMAN_APPROVAL =
    process.env.AI_AGENT_REQUIRE_HUMAN_APPROVAL !==
    "false";

  const agents = new Map();
  const tasks = new Map();

  function now() {
    return new Date().toISOString();
  }

  function id(prefix = "agent") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  function safeString(
    value,
    max = 20000
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value).slice(
      0,
      max
    );
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    const n = Number(value);

    if (Number.isNaN(n)) {
      return min;
    }

    return Math.max(
      min,
      Math.min(max, n)
    );
  }

  function timeoutPromise(
    promise,
    timeout
  ) {
    let timer;

    const timeoutTask =
      new Promise(
        (_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "AI agent task timeout"
                )
              ),
            timeout
          );
        }
      );

    return Promise.race([
      promise,
      timeoutTask
    ]).finally(() =>
      clearTimeout(timer)
    );
  }

  async function audit(
    action,
    metadata = {}
  ) {
    try {
      if (
        persistence &&
        typeof persistence.addAuditLog ===
          "function"
      ) {
        await persistence.addAuditLog({
          actorType:
            "ai_agent_engine",
          action,
          entityType:
            metadata.taskId
              ? "ai_agent_task"
              : "ai_agent",
          entityId:
            metadata.taskId ||
            metadata.agentId ||
            null,
          metadata
        });
      }
    } catch (error) {
      logger.warn(
        "[AI Agent] audit failed:",
        error.message
      );
    }
  }

  /*
   * --------------------------------------------------
   * Agent Registry
   * --------------------------------------------------
   */

  function registerAgent(
    definition = {}
  ) {
    if (
      agents.size >=
      MAX_AGENTS
    ) {
      throw new Error(
        "AI agent limit reached"
      );
    }

    if (!definition.name) {
      throw new Error(
        "Agent name is required"
      );
    }

    const agentId =
      definition.id ||
      id("agent");

    const agent = {
      id: agentId,

      name:
        safeString(
          definition.name,
          200
        ),

      role:
        safeString(
          definition.role ||
            "general",
          100
        ),

      description:
        safeString(
          definition.description ||
            "",
          1000
        ),

      capabilities:
        Array.isArray(
          definition.capabilities
        )
          ? definition.capabilities
          : [],

      tools:
        Array.isArray(
          definition.tools
        )
          ? definition.tools
          : [],

      sensitive:
        Boolean(
          definition.sensitive
        ),

      autonomous:
        definition.autonomous !==
        false,

      maxSteps:
        Math.min(
          Number(
            definition.maxSteps ||
              MAX_STEPS
          ),
          MAX_STEPS
        ),

      systemPrompt:
        safeString(
          definition.systemPrompt ||
            "",
          10000
        ),

      metadata:
        definition.metadata ||
        {},

      enabled:
        definition.enabled !==
        false,

      createdAt:
        now()
    };

    agents.set(
      agent.id,
      agent
    );

    state.agents =
      agents.size;

    return agent;
  }

  function getAgent(
    agentId
  ) {
    return agents.get(
      agentId
    );
  }

  function listAgents() {
    return Array.from(
      agents.values()
    );
  }

  /*
   * --------------------------------------------------
   * Default EZ MEDIA Agents
   * --------------------------------------------------
   */

  function registerDefaultAgents() {
    const defaults = [
      {
        id: "news-agent",
        name: "وكيل الأخبار",
        role: "news",
        capabilities: [
          "news-analysis",
          "breaking-news",
          "classification",
          "verification"
        ],
        tools: [
          "newsroom",
          "verification",
          "source-intelligence",
          "rag",
          "search"
        ]
      },

      {
        id: "editorial-agent",
        name: "وكيل غرفة الأخبار",
        role: "editorial",
        capabilities: [
          "story-building",
          "editing",
          "headlines",
          "publishing-preparation"
        ],
        tools: [
          "newsroom",
          "quality",
          "legal",
          "ethics",
          "brand"
        ]
      },

      {
        id: "verification-agent",
        name: "وكيل التحقق",
        role: "verification",
        capabilities: [
          "fact-checking",
          "source-analysis",
          "evidence"
        ],
        tools: [
          "rag",
          "search",
          "verification",
          "source-intelligence",
          "forensics"
        ],
        sensitive: true
      },

      {
        id: "content-agent",
        name: "وكيل المحتوى",
        role: "content",
        capabilities: [
          "content-generation",
          "repurposing",
          "scripts",
          "social-content"
        ],
        tools: [
          "content-factory",
          "brand",
          "quality",
          "memory"
        ]
      },

      {
        id: "broadcast-agent",
        name: "وكيل البث",
        role: "broadcast",
        capabilities: [
          "live-broadcast",
          "broadcast-scheduling",
          "broadcast-monitoring"
        ],
        tools: [
          "live",
          "video",
          "scheduler",
          "dam"
        ],
        sensitive: true
      },

      {
        id: "audience-agent",
        name: "وكيل الجمهور",
        role: "audience",
        capabilities: [
          "audience-analysis",
          "recommendations",
          "trends"
        ],
        tools: [
          "audience",
          "analytics",
          "rag"
        ]
      },

      {
        id: "advertising-agent",
        name: "وكيل الإعلانات والرعاية",
        role: "advertising",
        capabilities: [
          "campaign-analysis",
          "targeting",
          "optimization"
        ],
        tools: [
          "advertising",
          "audience",
          "analytics",
          "crm"
        ],
        sensitive: true
      },

      {
        id: "sales-agent",
        name: "وكيل المبيعات",
        role: "sales",
        capabilities: [
          "lead-scoring",
          "deal-analysis",
          "sales-assistance"
        ],
        tools: [
          "crm",
          "communication",
          "analytics"
        ],
        sensitive: true
      },

      {
        id: "support-agent",
        name: "وكيل خدمة العملاء",
        role: "support",
        capabilities: [
          "ticket-analysis",
          "customer-replies",
          "escalation"
        ],
        tools: [
          "support",
          "communication",
          "crm",
          "knowledge"
        ]
      },

      {
        id: "security-agent",
        name: "وكيل الأمن",
        role: "security",
        capabilities: [
          "risk-analysis",
          "security-monitoring",
          "access-review"
        ],
        tools: [
          "security",
          "command"
        ],
        sensitive: true
      },

      {
        id: "legal-agent",
        name: "وكيل الحقوق",
        role: "legal",
        capabilities: [
          "rights-analysis",
          "license-review",
          "privacy-risk"
        ],
        tools: [
          "legal",
          "dam",
          "rag"
        ],
        sensitive: true
      },

      {
        id: "ethics-agent",
        name: "وكيل الأخلاقيات",
        role: "ethics",
        capabilities: [
          "ethics-review",
          "conflict-analysis",
          "editorial-governance"
        ],
        tools: [
          "ethics",
          "quality",
          "editorial"
        ],
        sensitive: true
      },

      {
        id: "analytics-agent",
        name: "وكيل التحليلات",
        role: "analytics",
        capabilities: [
          "performance-analysis",
          "trend-analysis",
          "recommendations"
        ],
        tools: [
          "analytics",
          "audience",
          "command"
        ]
      },

      {
        id: "executive-agent",
        name: "الوكيل التنفيذي الرئيسي",
        role: "executive",
        capabilities: [
          "executive-analysis",
          "planning",
          "prioritization",
          "decision-support"
        ],
        tools: [
          "command",
          "analytics",
          "memory",
          "rag",
          "search",
          "workflow"
        ],
        sensitive: true
      }
    ];

    for (
      const definition of defaults
    ) {
      if (
        !agents.has(
          definition.id
        )
      ) {
        registerAgent(
          definition
        );
      }
    }
  }

  /*
   * --------------------------------------------------
   * Intent Router
   * --------------------------------------------------
   */

  function routeAgent(
    input = {}
  ) {
    const intent =
      safeString(
        input.intent
      ).toLowerCase();

    const text =
      safeString(
        input.task ||
          input.prompt ||
          input.query
      ).toLowerCase();

    const rules = [
      [
        [
          "خبر",
          "أخبار",
          "عاجل",
          "breaking",
          "news"
        ],
        "news-agent"
      ],

      [
        [
          "تحرير",
          "غرفة الأخبار",
          "عنوان",
          "قصة",
          "تحريرية"
        ],
        "editorial-agent"
      ],

      [
        [
          "تحقق",
          "مصدر",
          "دليل",
          "fact",
          "verify"
        ],
        "verification-agent"
      ],

      [
        [
          "محتوى",
          "منشور",
          "سكريبت",
          "فيديو",
          "caption"
        ],
        "content-agent"
      ],

      [
        [
          "بث",
          "مباشر",
          "stream",
          "live"
        ],
        "broadcast-agent"
      ],

      [
        [
          "جمهور",
          "مشاهدات",
          "ترند",
          "audience"
        ],
        "audience-agent"
      ],

      [
        [
          "إعلان",
          "رعاية",
          "حملة",
          "advertising"
        ],
        "advertising-agent"
      ],

      [
        [
          "مبيعات",
          "عميل",
          "صفقة",
          "lead",
          "deal"
        ],
        "sales-agent"
      ],

      [
        [
          "دعم",
          "شكوى",
          "عميل",
          "تذكرة"
        ],
        "support-agent"
      ],

      [
        [
          "أمن",
          "اختراق",
          "صلاحيات",
          "security"
        ],
        "security-agent"
      ],

      [
        [
          "حقوق",
          "ترخيص",
          "ملكية",
          "legal"
        ],
        "legal-agent"
      ],

      [
        [
          "أخلاق",
          "تحيز",
          "تضارب مصالح",
          "ethics"
        ],
        "ethics-agent"
      ],

      [
        [
          "تحليل",
          "إحصائيات",
          "أداء",
          "analytics"
        ],
        "analytics-agent"
      ]
    ];

    if (intent) {
      const direct =
        Array.from(
          agents.values()
        ).find(
          agent =>
            agent.role === intent ||
            agent.id === intent
        );

      if (direct) {
        return direct;
      }
    }

    for (
      const [
        keywords,
        agentId
      ] of rules
    ) {
      if (
        keywords.some(
          keyword =>
            text.includes(
              keyword
            )
        )
      ) {
        return getAgent(
          agentId
        );
      }
    }

    return getAgent(
      "executive-agent"
    );
  }

  /*
   * --------------------------------------------------
   * Policy
   * --------------------------------------------------
   */

  function isSensitive(
    agent,
    task
  ) {
    if (
      agent.sensitive
    ) {
      return true;
    }

    const text =
      safeString(
        task.title ||
          task.description ||
          task.input?.query
      ).toLowerCase();

    const sensitiveWords = [
      "نشر",
      "حذف",
      "إرسال",
      "دفع",
      "دفع مالي",
      "إعلان",
      "رعاية",
      "بث",
      "صلاحيات",
      "مستخدم",
      "أمني",
      "قانوني",
      "حقوق",
      "حملة"
    ];

    return sensitiveWords.some(
      word =>
        text.includes(word)
    );
  }

  function requiresApproval(
    agent,
    task
  ) {
    if (!HUMAN_APPROVAL) {
      return false;
    }

    return isSensitive(
      agent,
      task
    );
  }

  /*
   * --------------------------------------------------
   * Planning
   * --------------------------------------------------
   */

  async function generatePlan(
    agent,
    task
  ) {
    const fallbackPlan = [
      {
        step: 1,
        action: "analyze",
        description:
          "تحليل المهمة والسياق"
      },

      {
        step: 2,
        action: "execute",
        description:
          "تنفيذ العملية المسموح بها"
      },

      {
        step: 3,
        action: "verify",
        description:
          "التحقق من النتيجة"
      },

      {
        step: 4,
        action: "complete",
        description:
          "إكمال المهمة وتسجيل النتيجة"
      }
    ];

    if (
      !aiOrchestrator ||
      typeof aiOrchestrator.process !==
        "function"
    ) {
      return fallbackPlan;
    }

    try {
      const result =
        await aiOrchestrator.process({
          type:
            "agent-plan",

          input: {
            agent: {
              id:
                agent.id,

              role:
                agent.role,

              capabilities:
                agent.capabilities,

              tools:
                agent.tools
            },

            task
          }
        });

      if (
        Array.isArray(
          result?.plan
        )
      ) {
        return result.plan
          .slice(
            0,
            agent.maxSteps
          )
          .map(
            (
              step,
              index
            ) => ({
              step:
                index + 1,

              action:
                safeString(
                  step.action ||
                    "execute",
                  100
                ),

              description:
                safeString(
                  step.description ||
                    "",
                  1000
                ),

              tool:
                step.tool ||
                null,

              input:
                step.input ||
                {}
            })
          );
      }
    } catch (error) {
      logger.warn(
        "[AI Agent] planning failed:",
        error.message
      );
    }

    return fallbackPlan;
  }

  /*
   * --------------------------------------------------
   * Tool Execution
   * --------------------------------------------------
   */

  async function callTool(
    toolName,
    input = {}
  ) {
    state.toolCalls++;

    switch (toolName) {
      case "newsroom":
        return callMethod(
          newsroomEngine,
          [
            "analyze",
            "process",
            "createStory"
          ],
          input
        );

      case "verification":
        return callMethod(
          input.verificationEngine,
          [
            "verify",
            "process"
          ],
          input
        );

      case "rag":
      case "knowledge":
        if (
          ragEngine &&
          typeof ragEngine.search ===
            "function"
        ) {
          return ragEngine.search(
            input.query ||
              input.question ||
              ""
          );
        }

        if (
          ragEngine &&
          typeof ragEngine.answerQuestion ===
            "function"
        ) {
          return ragEngine.answerQuestion(
            input.query ||
              input.question ||
              ""
          );
        }

        return {
          ok: false,
          error:
            "RAG engine unavailable"
        };

      case "search":
        if (
          vectorSearchEngine &&
          typeof vectorSearchEngine.searchKnowledge ===
            "function"
        ) {
          return vectorSearchEngine.searchKnowledge(
            input.query ||
              input.question ||
              "",
            input
          );
        }

        if (
          vectorSearchEngine &&
          typeof vectorSearchEngine.search ===
            "function"
        ) {
          return vectorSearchEngine.search(
            input
          );
        }

        return {
          ok: false,
          error:
            "Search engine unavailable"
        };

      case "memory":
        if (
          memoryEngine &&
          typeof memoryEngine.personalize ===
            "function"
        ) {
          return memoryEngine.personalize(
            input
          );
        }

        return {
          ok: false,
          error:
            "Memory engine unavailable"
        };

      case "content-factory":
        return callMethod(
          contentFactory,
          [
            "createJob",
            "process",
            "generate"
          ],
          input
        );

      case "distribution":
        return callMethod(
          distributionEngine,
          [
            "distribute",
            "prepare",
            "execute"
          ],
          input
        );

      case "analytics":
        return callMethod(
          analyticsEngine,
          [
            "analyze",
            "dashboard",
            "getDashboard"
          ],
          input
        );

      case "audience":
        return callMethod(
          audienceEngine,
          [
            "analyze",
            "recommend",
            "homepage"
          ],
          input
        );

      case "advertising":
        return callMethod(
          advertisingEngine,
          [
            "optimizeCampaign",
            "analyze",
            "optimize"
          ],
          input
        );

      case "crm":
        return callMethod(
          crmEngine,
          [
            "assistant",
            "analyzeDeal",
            "scoreLead"
          ],
          input
        );

      case "communication":
        return callMethod(
          communicationEngine,
          [
            "send",
            "personalize",
            "recommendFollowUp"
          ],
          input
        );

      case "support":
        return callMethod(
          customerSupportEngine,
          [
            "analyzeTicket",
            "aiReply",
            "escalate"
          ],
          input
        );

      case "live":
        return callMethod(
          liveBroadcastEngine,
          [
            "getStatus",
            "healthCheck",
            "startBroadcast",
            "stopBroadcast"
          ],
          input
        );

      case "scheduler":
        return callMethod(
          broadcastScheduler,
          [
            "process",
            "getStatistics",
            "analyze"
          ],
          input
        );

      case "legal":
        return callMethod(
          legalEngine,
          [
            "review",
            "analyze",
            "check"
          ],
          input
        );

      case "ethics":
        return callMethod(
          ethicsEngine,
          [
            "review",
            "analyze"
          ],
          input
        );

      case "quality":
        return callMethod(
          qualityEngine,
          [
            "review",
            "check",
            "analyze"
          ],
          input
        );

      case "brand":
        return callMethod(
          brandEngine,
          [
            "checkCompliance",
            "check",
            "analyze"
          ],
          input
        );

      case "command":
        return callMethod(
          commandEngine,
          [
            "run",
            "getSnapshot",
            "generateDecision"
          ],
          input
        );

      case "workflow":
        return callMethod(
          workflowEngine,
          [
            "execute",
            "trigger",
            "process"
          ],
          input
        );

      default:
        return {
          ok: false,
          error:
            `Unknown agent tool: ${toolName}`
        };
    }
  }

  async function callMethod(
    engine,
    methods,
    input
  ) {
    if (!engine) {
      return {
        ok: false,
        error:
          "Required engine unavailable"
      };
    }

    for (
      const method of methods
    ) {
      if (
        typeof engine[method] ===
        "function"
      ) {
        return engine[method](
          input
        );
      }
    }

    return {
      ok: false,
      error:
        "No compatible method found"
    };
  }

  /*
   * --------------------------------------------------
   * Approval
   * --------------------------------------------------
   */

  async function requestApproval(
    agent,
    task,
    plan
  ) {
    state.tasksWaitingApproval++;

    if (
      approvalEngine &&
      typeof approvalEngine.createRequest ===
        "function"
    ) {
      try {
        return await approvalEngine.createRequest(
          {
            type:
              "ai_agent_task",

            title:
              task.title ||
              `مهمة ${agent.name}`,

            description:
              task.description ||
              "طلب تنفيذ مهمة بواسطة وكيل AI",

            requestedBy:
              "ai-agent",

            riskLevel:
              task.riskLevel ||
              "high",

            agentId:
              agent.id,

            taskId:
              task.id,

            plan,

            metadata:
              task.metadata ||
              {}
          }
        );
      } catch (error) {
        logger.warn(
          "[AI Agent] approval request failed:",
          error.message
        );
      }
    }

    return {
      required: true,
      status:
        "pending_approval",
      taskId:
        task.id,
      agentId:
        agent.id
    };
  }

  /*
   * --------------------------------------------------
   * Step Executor
   * --------------------------------------------------
   */

  async function executeStep(
    agent,
    task,
    step
  ) {
    if (
      step.action ===
      "analyze"
    ) {
      if (
        aiCore &&
        typeof aiCore.request ===
          "function"
      ) {
        return aiCore.request({
          type:
            "agent-analysis",

          prompt:
            `
أنت ${agent.name}.

المهمة:
${task.description}

الخطوة:
${step.description}

حلل المطلوب دون تنفيذ
عملية حساسة.
`
        });
      }

      return {
        analyzed: true
      };
    }

    if (
      step.action ===
      "verify"
    ) {
      if (
        aiCore &&
        typeof aiCore.request ===
          "function"
      ) {
        return aiCore.request({
          type:
            "agent-verification",

          prompt:
            `
تحقق من نتيجة المهمة التالية:

${JSON.stringify(
  task.result || {},
  null,
  2
)}
`
        });
      }

      return {
        verified: true
      };
    }

    if (
      step.action ===
      "complete"
    ) {
      return {
        completed: true
      };
    }

    if (
      step.tool
    ) {
      return callTool(
        step.tool,
        {
          ...task.input,
          ...(step.input || {})
        }
      );
    }

    return {
      ok: true,
      action:
        step.action,
      description:
        step.description
    };
  }

  /*
   * --------------------------------------------------
   * Task Creation
   * --------------------------------------------------
   */

  async function createTask(
    input = {}
  ) {
    if (
      state.tasksCreated >=
      MAX_TASKS
    ) {
      throw new Error(
        "AI agent task capacity reached"
      );
    }

    const agent =
      input.agentId
        ? getAgent(
            input.agentId
          )
        : routeAgent(
            input
          );

    if (!agent) {
      throw new Error(
        "No AI agent available"
      );
    }

    const task = {
      id:
        input.id ||
        id("agent_task"),

      agentId:
        agent.id,

      title:
        safeString(
          input.title ||
            "مهمة AI"
        ),

      description:
        safeString(
          input.description ||
            input.task ||
            input.prompt ||
            input.query
        ),

      input:
        input.input ||
        {},

      priority:
        input.priority ||
        "medium",

      status:
        "created",

      riskLevel:
        input.riskLevel ||
        (
          agent.sensitive
            ? "high"
            : "medium"
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      steps: [],

      results: []
    };

    tasks.set(
      task.id,
      task
    );

    state.tasksCreated++;
    state.lastTaskAt =
      now();

    await audit(
      "agent_task_created",
      {
        taskId:
          task.id,
        agentId:
          agent.id,
        role:
          agent.role
      }
    );

    return task;
  }

  /*
   * --------------------------------------------------
   * Task Execution
   * --------------------------------------------------
   */

  async function executeTask(
    taskId
  ) {
    const task =
      tasks.get(taskId);

    if (!task) {
      throw new Error(
        "AI agent task not found"
      );
    }

    const agent =
      getAgent(
        task.agentId
      );

    if (!agent) {
      throw new Error(
        "AI agent not found"
      );
    }

    if (!agent.enabled) {
      throw new Error(
        "AI agent is disabled"
      );
    }

    /*
     * الموافقة البشرية قبل
     * العمليات الحساسة.
     */

    if (
      requiresApproval(
        agent,
        task
      )
    ) {
      const plan =
        await generatePlan(
          agent,
          task
        );

      task.steps =
        plan;

      const approval =
        await requestApproval(
          agent,
          task,
          plan
        );

      task.status =
        "pending_approval";

      task.approval =
        approval;

      await audit(
        "agent_task_waiting_approval",
        {
          taskId:
            task.id,
          agentId:
            agent.id
        }
      );

      return task;
    }

    if (!AUTO_EXECUTION) {
      task.status =
        "waiting_manual_start";

      return task;
    }

    task.status =
      "running";

    const plan =
      await generatePlan(
        agent,
        task
      );

    task.steps =
      plan;

    try {
      for (
        const step of plan
      ) {
        if (
          task.status ===
          "cancelled"
        ) {
          break;
        }

        let attempt = 0;
        let result;

        while (
          attempt <=
          MAX_RETRIES
        ) {
          try {
            result =
              await timeoutPromise(
                executeStep(
                  agent,
                  task,
                  step
                ),
                TASK_TIMEOUT_MS
              );

            break;
          } catch (error) {
            attempt++;

            if (
              attempt >
              MAX_RETRIES
            ) {
              throw error;
            }

            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  500 *
                    attempt
                )
            );
          }
        }

        task.results.push({
          step:
            step.step,

          action:
            step.action,

          tool:
            step.tool ||
            null,

          result
        });

        task.result =
          result;
      }

      task.status =
        "completed";

      task.completedAt =
        now();

      state.tasksCompleted++;

      /*
       * حفظ النتيجة في الذاكرة.
       */

      if (
        memoryEngine &&
        typeof memoryEngine.createMemory ===
          "function"
      ) {
        try {
          await memoryEngine.createMemory({
            memoryType:
              "workflow",

            scope:
              "platform",

            title:
              `نتيجة وكيل: ${agent.name}`,

            content:
              JSON.stringify(
                {
                  task:
                    task.title,

                  status:
                    task.status,

                  result:
                    task.result
                }
              ).slice(
                0,
                15000
              ),

            importance:
              55,

            confidence:
              75,

            sourceType:
              "ai-agent",

            sourceId:
              task.id,

            metadata: {
              agentId:
                agent.id
            }
          });
        } catch (error) {
          logger.warn(
            "[AI Agent] memory save failed:",
            error.message
          );
        }
      }

      await audit(
        "agent_task_completed",
        {
          taskId:
            task.id,
          agentId:
            agent.id
        }
      );

      return task;
    } catch (error) {
      task.status =
        "failed";

      task.error =
        error.message;

      task.failedAt =
        now();

      state.tasksFailed++;
      state.lastError =
        error.message;

      await audit(
        "agent_task_failed",
        {
          taskId:
            task.id,
          agentId:
            agent.id,
          error:
            error.message
        }
      );

      throw error;
    }
  }

  async function run(
    input = {}
  ) {
    const task =
      await createTask(
        input
      );

    return executeTask(
      task.id
    );
  }

  async function approveTask(
    taskId
  ) {
    const task =
      tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    if (
      task.status !==
      "pending_approval"
    ) {
      throw new Error(
        "Task is not waiting for approval"
      );
    }

    task.status =
      "approved";

    /*
     * إزالة الموافقة من قائمة
     * الانتظار بعد الموافقة.
     */
    if (
      state.tasksWaitingApproval >
      0
    ) {
      state.tasksWaitingApproval--;
    }

    await audit(
      "agent_task_approved",
      {
        taskId
      }
    );

    /*
     * تنفيذ الخطة بعد الموافقة.
     */
    task.status =
      "running";

    const agent =
      getAgent(
        task.agentId
      );

    try {
      for (
        const step of task.steps
      ) {
        const result =
          await timeoutPromise(
            executeStep(
              agent,
              task,
              step
            ),
            TASK_TIMEOUT_MS
          );

        task.results.push({
          step:
            step.step,

          action:
            step.action,

          tool:
            step.tool ||
            null,

          result
        });

        task.result =
          result;
      }

      task.status =
        "completed";

      task.completedAt =
        now();

      state.tasksCompleted++;

      return task;
    } catch (error) {
      task.status =
        "failed";

      task.error =
        error.message;

      state.tasksFailed++;

      throw error;
    }
  }

  async function rejectTask(
    taskId,
    reason = "rejected"
  ) {
    const task =
      tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    task.status =
      "rejected";

    task.rejectionReason =
      safeString(
        reason,
        2000
      );

    if (
      state.tasksWaitingApproval >
      0
    ) {
      state.tasksWaitingApproval--;
    }

    await audit(
      "agent_task_rejected",
      {
        taskId,
        reason
      }
    );

    return task;
  }

  function cancelTask(
    taskId
  ) {
    const task =
      tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    task.status =
      "cancelled";

    return task;
  }

  function getTask(
    taskId
  ) {
    return tasks.get(
      taskId
    );
  }

  function listTasks(
    filters = {}
  ) {
    let result =
      Array.from(
        tasks.values()
      );

    if (
      filters.status
    ) {
      result =
        result.filter(
          task =>
            task.status ===
            filters.status
        );
    }

    if (
      filters.agentId
    ) {
      result =
        result.filter(
          task =>
            task.agentId ===
            filters.agentId
        );
    }

    return result
      .slice(
        -Number(
          filters.limit ||
            100
        )
      )
      .reverse();
  }

  async function getStatistics() {
    return {
      ...state,

      maxAgents:
        MAX_AGENTS,

      maxTasks:
        MAX_TASKS,

      maxSteps:
        MAX_STEPS,

      taskTimeoutMs:
        TASK_TIMEOUT_MS,

      maxRetries:
        MAX_RETRIES,

      autoExecution:
        AUTO_EXECUTION,

      humanApproval:
        HUMAN_APPROVAL,

      registeredAgents:
        agents.size,

      activeTasks:
        Array.from(
          tasks.values()
        ).filter(
          task =>
            task.status ===
            "running"
        ).length
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

      agents:
        agents.size,

      tasks:
        tasks.size,

      memory:
        Boolean(
          memoryEngine
        ),

      rag:
        Boolean(
          ragEngine
        ),

      vectorSearch:
        Boolean(
          vectorSearchEngine
        ),

      approval:
        Boolean(
          approvalEngine
        ),

      timestamp:
        now()
    };
  }

  async function initialize() {
    if (
      state.initialized
    ) {
      return;
    }

    registerDefaultAgents();

    state.initialized =
      true;

    await audit(
      "ai_agent_engine_initialized",
      {
        agents:
          agents.size
      }
    );
  }

  function start() {
    state.running =
      true;

    return state;
  }

  function stop() {
    state.running =
      false;

    return state;
  }

  return {
    initialize,
    start,
    stop,

    registerAgent,
    getAgent,
    listAgents,

    routeAgent,

    createTask,
    executeTask,
    run,

    approveTask,
    rejectTask,
    cancelTask,

    getTask,
    listTasks,

    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentAIAgentAutonomousEngine
};
