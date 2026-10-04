"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 80
 * INTELLIGENT WORKFLOW & BUSINESS PROCESS ENGINE
 * ============================================================
 *
 * EVENT
 *   ↓
 * TRIGGER
 *   ↓
 * CONDITION
 *   ↓
 * AI DECISION
 *   ↓
 * ACTIONS
 *   ↓
 * WAIT / SCHEDULE
 *   ↓
 * NEXT STEP
 *   ↓
 * COMPLETE
 *
 * يربط:
 * CRM
 * Communication
 * Customer Support
 * Advertising
 * Sponsorship
 * Monetization
 * Audience
 * Editorial
 * Automation
 * AI
 *
 * ملاحظة:
 * المحرك لا ينفذ أوامر نظام التشغيل أو Shell Commands.
 * جميع العمليات محصورة داخل خدمات EZ MEDIA المسجلة.
 */

const crypto = require("crypto");

function createIntelligentWorkflowEngine(options = {}) {
  const {
    persistence = null,

    aiCore = null,
    aiOrchestrator = null,

    automationEngine = null,

    crmEngine = null,
    communicationEngine = null,
    customerSupportEngine = null,

    advertisingEngine = null,
    monetizationEngine = null,

    audienceEngine = null,

    editorialNewsroomEngine = null,
    publishingDistributionEngine = null,

    notificationService = null,
    eventBus = null,

    logger = console,

    maxWorkflows =
      Number(
        process.env.WORKFLOW_MAX_WORKFLOWS || 1000
      ),

    maxStepsPerWorkflow =
      Number(
        process.env.WORKFLOW_MAX_STEPS || 50
      ),

    maxExecutionHistory =
      Number(
        process.env.WORKFLOW_MAX_EXECUTION_HISTORY || 10000
      ),

    defaultTimeoutMs =
      Number(
        process.env.WORKFLOW_DEFAULT_TIMEOUT_MS || 120000
      ),

    maxRetries =
      Number(
        process.env.WORKFLOW_MAX_RETRIES || 3
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    workflows: new Map(),
    executions: new Map(),
    schedules: new Map(),
    triggers: new Map(),
    actionRegistry: new Map(),

    statistics: {
      workflows: 0,
      activeWorkflows: 0,

      executions: 0,
      runningExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      cancelledExecutions: 0,

      successfulSteps: 0,
      failedSteps: 0,

      aiDecisions: 0,

      scheduledExecutions: 0,

      eventsProcessed: 0
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
        typeof eventBus.emit === "function"
      ) {
        eventBus.emit(
          event,
          payload
        );
      }
    } catch (error) {
      logger.warn(
        "[CODE80] Event error:",
        error.message
      );
    }
  }

  function sleep(ms) {
    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          ms
        )
    );
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
      CREATE TABLE IF NOT EXISTS ez_workflows (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        description TEXT,

        status TEXT DEFAULT 'draft',

        trigger_type TEXT,

        trigger_config JSONB DEFAULT '{}'::jsonb,

        steps JSONB DEFAULT '[]'::jsonb,

        conditions JSONB DEFAULT '[]'::jsonb,

        variables JSONB DEFAULT '{}'::jsonb,

        version INTEGER DEFAULT 1,

        execution_count INTEGER DEFAULT 0,

        success_count INTEGER DEFAULT 0,

        failure_count INTEGER DEFAULT 0,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_workflow_executions (
        id TEXT PRIMARY KEY,

        workflow_id TEXT NOT NULL,

        status TEXT DEFAULT 'pending',

        trigger_event JSONB DEFAULT '{}'::jsonb,

        context JSONB DEFAULT '{}'::jsonb,

        current_step INTEGER DEFAULT 0,

        completed_steps INTEGER DEFAULT 0,

        failed_steps INTEGER DEFAULT 0,

        result JSONB DEFAULT '{}'::jsonb,

        error TEXT,

        started_at TIMESTAMPTZ,

        completed_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_workflow_schedules (
        id TEXT PRIMARY KEY,

        workflow_id TEXT NOT NULL,

        execution_id TEXT,

        run_at TIMESTAMPTZ NOT NULL,

        status TEXT DEFAULT 'scheduled',

        payload JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        executed_at TIMESTAMPTZ
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_workflow_triggers (
        id TEXT PRIMARY KEY,

        workflow_id TEXT NOT NULL,

        trigger_type TEXT NOT NULL,

        configuration JSONB DEFAULT '{}'::jsonb,

        status TEXT DEFAULT 'active',

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_workflow_execution_status
      ON ez_workflow_executions(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_workflow_schedule_run_at
      ON ez_workflow_schedules(run_at)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_workflow_trigger_type
      ON ez_workflow_triggers(trigger_type)
    `);
  }

  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  async function initialize() {
    if (
      state.initialized
    ) {
      return getStatus();
    }

    await ensureTables();

    registerBuiltInActions();

    state.initialized =
      true;

    emit(
      "workflow.initialized",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     ACTION REGISTRY
  ========================================================== */

  function registerAction(
    name,
    handler,
    metadata = {}
  ) {
    if (
      !name ||
      typeof handler !==
        "function"
    ) {
      throw new Error(
        "Workflow action requires name and function"
      );
    }

    state.actionRegistry.set(
      name,
      {
        name,
        handler,
        metadata
      }
    );

    return name;
  }

  function registerBuiltInActions() {

    registerAction(
      "log",
      async context => ({
        ok: true,
        action: "log",
        message:
          context.step?.message ||
          "Workflow log",
        timestamp:
          now()
      })
    );

    registerAction(
      "delay",
      async context => {
        const ms =
          Math.min(
            Number(
              context.step?.milliseconds ||
              0
            ),
            300000
          );

        if (ms > 0) {
          await sleep(ms);
        }

        return {
          ok: true,
          delayed:
            ms
        };
      }
    );

    registerAction(
      "ai_decision",
      async context =>
        runAIDecision(
          context
        )
    );

    registerAction(
      "crm_create_lead",
      async context => {
        if (
          !crmEngine ||
          typeof crmEngine.createLead !==
            "function"
        ) {
          throw new Error(
            "CRM createLead is unavailable"
          );
        }

        return crmEngine.createLead(
          context.step?.data ||
          context.data ||
          {}
        );
      }
    );

    registerAction(
      "crm_create_deal",
      async context => {
        if (
          !crmEngine ||
          typeof crmEngine.createDeal !==
            "function"
        ) {
          throw new Error(
            "CRM createDeal is unavailable"
          );
        }

        return crmEngine.createDeal(
          context.step?.data ||
          context.data ||
          {}
        );
      }
    );

    registerAction(
      "crm_analyze_deal",
      async context => {
        if (
          !crmEngine ||
          typeof crmEngine.analyzeDeal !==
            "function"
        ) {
          throw new Error(
            "CRM analyzeDeal is unavailable"
          );
        }

        const dealId =
          context.step?.dealId ||
          context.data?.dealId;

        return crmEngine.analyzeDeal(
          dealId
        );
      }
    );

    registerAction(
      "communication_send",
      async context => {
        if (
          !communicationEngine ||
          typeof communicationEngine.sendMessage !==
            "function"
        ) {
          throw new Error(
            "Communication engine is unavailable"
          );
        }

        return communicationEngine.sendMessage(
          context.step?.message ||
          context.data ||
          {}
        );
      }
    );

    registerAction(
      "communication_campaign",
      async context => {
        if (
          !communicationEngine ||
          typeof communicationEngine.runCampaign !==
            "function"
        ) {
          throw new Error(
            "Communication campaign service is unavailable"
          );
        }

        return communicationEngine.runCampaign(
          context.step?.campaignId
        );
      }
    );

    registerAction(
      "support_create_ticket",
      async context => {
        if (
          !customerSupportEngine ||
          typeof customerSupportEngine.createTicket !==
            "function"
        ) {
          throw new Error(
            "Customer support engine is unavailable"
          );
        }

        return customerSupportEngine.createTicket(
          context.step?.data ||
          context.data ||
          {}
        );
      }
    );

    registerAction(
      "support_escalate",
      async context => {
        if (
          !customerSupportEngine ||
          typeof customerSupportEngine.escalateTicket !==
            "function"
          ) {
          throw new Error(
            "Customer support escalation is unavailable"
          );
        }

        return customerSupportEngine.escalateTicket(
          context.step?.ticketId ||
          context.data?.ticketId,

          context.step?.reason ||
            "Workflow escalation",

          context.step?.level ||
            "human"
        );
      }
    );

    registerAction(
      "advertising_activate",
      async context => {
        if (
          !advertisingEngine ||
          typeof advertisingEngine.activateCampaign !==
            "function"
        ) {
          throw new Error(
            "Advertising campaign activation is unavailable"
          );
        }

        return advertisingEngine.activateCampaign(
          context.step?.campaignId
        );
      }
    );

    registerAction(
      "monetization_forecast",
      async context => {
        if (
          !monetizationEngine ||
          typeof monetizationEngine.forecast !==
            "function"
        ) {
          throw new Error(
            "Monetization forecast is unavailable"
          );
        }

        return monetizationEngine.forecast(
          context.step?.data ||
          context.data ||
          {}
        );
      }
    );

    registerAction(
      "automation_enqueue",
      async context => {
        if (
          !automationEngine ||
          typeof automationEngine.enqueue !==
            "function"
        ) {
          throw new Error(
            "Automation enqueue is unavailable"
          );
        }

        return automationEngine.enqueue(
          context.step?.task ||
          context.data ||
          {}
        );
      }
    );

    registerAction(
      "notification",
      async context => {
        if (
          !notificationService ||
          typeof notificationService.notify !==
            "function"
        ) {
          throw new Error(
            "Notification service is unavailable"
          );
        }

        return notificationService.notify(
          context.step?.data ||
          context.data ||
          {}
        );
      }
    );

    registerAction(
      "event",
      async context => {
        emit(
          context.step?.event ||
            "workflow.custom_event",

          context.data ||
            {}
        );

        return {
          ok: true
        };
      }
    );
  }

  /* ==========================================================
     WORKFLOW CREATION
  ========================================================== */

  async function createWorkflow(
    input = {}
  ) {
    if (
      state.workflows.size >=
      maxWorkflows
    ) {
      throw new Error(
        "Maximum workflow limit reached"
      );
    }

    const steps =
      Array.isArray(
        input.steps
      )
        ? input.steps
        : [];

    if (
      steps.length >
      maxStepsPerWorkflow
    ) {
      throw new Error(
        "Maximum workflow steps exceeded"
      );
    }

    if (!input.name) {
      throw new Error(
        "Workflow name is required"
      );
    }

    const workflow = {
      id:
        input.id ||
        createId("workflow"),

      name:
        clean(input.name),

      description:
        clean(
          input.description
        ),

      status:
        input.status ||
        "draft",

      triggerType:
        input.triggerType ||
        "manual",

      triggerConfig:
        input.triggerConfig ||
        {},

      steps,

      conditions:
        Array.isArray(
          input.conditions
        )
          ? input.conditions
          : [],

      variables:
        input.variables ||
        {},

      version:
        Number(
          input.version ||
            1
        ),

      executionCount: 0,
      successCount: 0,
      failureCount: 0,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    validateWorkflow(
      workflow
    );

    state.workflows.set(
      workflow.id,
      workflow
    );

    state.statistics.workflows++;

    if (
      workflow.status ===
      "active"
    ) {
      state.statistics.activeWorkflows++;
    }

    await persistWorkflow(
      workflow
    );

    return clone(
      workflow
    );
  }

  function validateWorkflow(
    workflow
  ) {
    if (
      !Array.isArray(
        workflow.steps
      )
    ) {
      throw new Error(
        "Workflow steps must be an array"
      );
    }

    workflow.steps.forEach(
      (step, index) => {
        if (!step.action) {
          throw new Error(
            `Workflow step ${index} has no action`
          );
        }

        if (
          !state.actionRegistry.has(
            step.action
          )
        ) {
          throw new Error(
            `Unknown workflow action: ${step.action}`
          );
        }
      }
    );
  }

  /* ==========================================================
     UPDATE WORKFLOW
  ========================================================== */

  async function updateWorkflow(
    workflowId,
    patch = {}
  ) {
    const workflow =
      state.workflows.get(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        "Workflow not found"
      );
    }

    const previousStatus =
      workflow.status;

    if (
      patch.name
    ) {
      workflow.name =
        clean(patch.name);
    }

    if (
      patch.description !==
      undefined
    ) {
      workflow.description =
        clean(
          patch.description
        );
    }

    if (
      patch.status
    ) {
      workflow.status =
        patch.status;
    }

    if (
      patch.triggerType
    ) {
      workflow.triggerType =
        patch.triggerType;
    }

    if (
      patch.triggerConfig
    ) {
      workflow.triggerConfig =
        patch.triggerConfig;
    }

    if (
      patch.steps
    ) {
      if (
        patch.steps.length >
        maxStepsPerWorkflow
      ) {
        throw new Error(
          "Maximum workflow steps exceeded"
        );
      }

      workflow.steps =
        patch.steps;
    }

    if (
      patch.conditions
    ) {
      workflow.conditions =
        patch.conditions;
    }

    if (
      patch.variables
    ) {
      workflow.variables =
        patch.variables;
    }

    workflow.version++;

    workflow.updatedAt =
      now();

    validateWorkflow(
      workflow
    );

    if (
      previousStatus !==
        "active" &&
      workflow.status ===
        "active"
    ) {
      state.statistics.activeWorkflows++;
    }

    if (
      previousStatus ===
        "active" &&
      workflow.status !==
        "active"
    ) {
      state.statistics.activeWorkflows =
        Math.max(
          0,
          state.statistics.activeWorkflows -
            1
        );
    }

    await persistWorkflow(
      workflow
    );

    return clone(
      workflow
    );
  }

  /* ==========================================================
     CONDITIONS
  ========================================================== */

  function evaluateCondition(
    condition,
    context
  ) {
    if (!condition) {
      return true;
    }

    const left =
      resolveValue(
        condition.left,
        context
      );

    const right =
      resolveValue(
        condition.right,
        context
      );

    switch (
      condition.operator
    ) {
      case "equals":
        return left === right;

      case "not_equals":
        return left !== right;

      case "contains":
        return String(
          left || ""
        ).includes(
          String(
            right || ""
          )
        );

      case "starts_with":
        return String(
          left || ""
        ).startsWith(
          String(
            right || ""
          )
        );

      case "greater_than":
        return Number(left) >
          Number(right);

      case "less_than":
        return Number(left) <
          Number(right);

      case "greater_or_equal":
        return Number(left) >=
          Number(right);

      case "less_or_equal":
        return Number(left) <=
          Number(right);

      case "exists":
        return (
          left !==
            undefined &&
          left !==
            null &&
          left !== ""
        );

      case "truthy":
        return Boolean(
          left
        );

      case "falsy":
        return !Boolean(
          left
        );

      default:
        return false;
    }
  }

  function evaluateConditions(
    conditions,
    context
  ) {
    if (
      !Array.isArray(
        conditions
      ) ||
      conditions.length === 0
    ) {
      return true;
    }

    return conditions.every(
      condition =>
        evaluateCondition(
          condition,
          context
        )
    );
  }

  function resolveValue(
    value,
    context
  ) {
    if (
      typeof value !==
      "string"
    ) {
      return value;
    }

    if (
      !value.startsWith(
        "{{"
      ) ||
      !value.endsWith(
        "}}"
      )
    ) {
      return value;
    }

    const path =
      value
        .slice(2, -2)
        .trim()
        .split(".");

    let current =
      context;

    for (
      const key of path
    ) {
      if (
        current ===
          null ||
        current ===
          undefined
      ) {
        return undefined;
      }

      current =
        current[key];
    }

    return current;
  }

  function resolveObject(
    value,
    context
  ) {
    if (
      typeof value ===
      "string"
    ) {
      const resolved =
        resolveValue(
          value,
          context
        );

      if (
        resolved !== value
      ) {
        return resolved;
      }

      return value.replace(
        /\{\{([^}]+)\}\}/g,
        (_, path) => {
          const result =
            resolveValue(
              `{{${path}}}`,
              context
            );

          return result ===
            undefined
            ? ""
            : String(
                result
              );
        }
      );
    }

    if (
      Array.isArray(
        value
      )
    ) {
      return value.map(
        item =>
          resolveObject(
            item,
            context
          )
      );
    }

    if (
      value &&
      typeof value ===
        "object"
    ) {
      const output = {};

      for (
        const [
          key,
          item
        ] of Object.entries(
          value
        )
      ) {
        output[key] =
          resolveObject(
            item,
            context
          );
      }

      return output;
    }

    return value;
  }

  /* ==========================================================
     AI DECISION
  ========================================================== */

  async function runAIDecision(
    context
  ) {
    state.statistics.aiDecisions++;

    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        available: false,
        decision:
          context.step?.defaultDecision ||
          "continue",
        confidence: 0
      };
    }

    try {
      const result =
        await aiCore.request({
          operation:
            "workflow-decision",

          workflow:
            context.workflow,

          step:
            context.step,

          context:
            context.data,

          variables:
            context.variables
        });

      return {
        available:
          true,

        decision:
          result?.decision ||
          "continue",

        confidence:
          Number(
            result?.confidence ||
              0
          ),

        reason:
          result?.reason ||
          null,

        output:
          result?.output ||
          null
      };
    } catch (error) {
      return {
        available: false,

        decision:
          context.step?.defaultDecision ||
          "continue",

        confidence: 0,

        error:
          error.message
      };
    }
  }

  /* ==========================================================
     EXECUTION
  ========================================================== */

  async function executeWorkflow(
    workflowId,
    input = {}
  ) {
    const workflow =
      state.workflows.get(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        "Workflow not found"
      );
    }

    if (
      workflow.status !==
        "active" &&
      input.allowDraft !== true
    ) {
      throw new Error(
        "Workflow is not active"
      );
    }

    const execution = {
      id:
        createId("execution"),

      workflowId,

      status:
        "running",

      triggerEvent:
        input.triggerEvent ||
        {},

      context:
        input.context ||
        input.data ||
        {},

      currentStep: 0,

      completedSteps: 0,

      failedSteps: 0,

      result: {},

      error:
        null,

      startedAt:
        now(),

      completedAt:
        null,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.executions.set(
      execution.id,
      execution
    );

    state.statistics.executions++;
    state.statistics.runningExecutions++;

    workflow.executionCount++;

    await persistExecution(
      execution
    );

    await persistWorkflow(
      workflow
    );

    emit(
      "workflow.execution.started",
      {
        execution:
          clone(execution)
      }
    );

    try {
      const context = {
        execution,
        workflow,
        data:
          execution.context,
        variables:
          {
            ...(workflow.variables ||
              {}),
            ...(input.variables ||
              {})
          }
      };

      if (
        !evaluateConditions(
          workflow.conditions,
          context
        )
      ) {
        execution.status =
          "skipped";

        execution.completedAt =
          now();

        state.statistics.runningExecutions =
          Math.max(
            0,
            state.statistics
              .runningExecutions -
              1
          );

        await persistExecution(
          execution
        );

        return clone(
          execution
        );
      }

      for (
        let index = 0;
        index <
          workflow.steps.length;
        index++
      ) {
        execution.currentStep =
          index;

        await persistExecution(
          execution
        );

        const step =
          workflow.steps[index];

        const contextForStep = {
          ...context,

          step,

          data:
            execution.context,

          variables:
            context.variables,

          previousResult:
            execution.result
        };

        if (
          step.conditions &&
          !evaluateConditions(
            step.conditions,
            contextForStep
          )
        ) {
          continue;
        }

        try {
          const result =
            await runStep(
              step,
              contextForStep
            );

          execution.result[
            step.id ||
            `step_${index}`
          ] =
            result;

          execution.completedSteps++;

          state.statistics.successfulSteps++;
        } catch (error) {
          execution.failedSteps++;

          state.statistics.failedSteps++;

          if (
            step.continueOnError
          ) {
            execution.result[
              step.id ||
              `step_${index}`
            ] = {
              ok: false,
              error:
                error.message
            };

            continue;
          }

          throw error;
        }

        execution.updatedAt =
          now();

        await persistExecution(
          execution
        );
      }

      execution.status =
        "completed";

      execution.completedAt =
        now();

      workflow.successCount++;

      state.statistics.completedExecutions++;

      emit(
        "workflow.execution.completed",
        {
          execution:
            clone(execution)
        }
      );
    } catch (error) {
      execution.status =
        "failed";

      execution.error =
        error.message;

      execution.completedAt =
        now();

      workflow.failureCount++;

      state.statistics.failedExecutions++;

      emit(
        "workflow.execution.failed",
        {
          execution:
            clone(execution),

          error:
            error.message
        }
      );
    }

    state.statistics.runningExecutions =
      Math.max(
        0,
        state.statistics
          .runningExecutions -
          1
      );

    execution.updatedAt =
      now();

    workflow.updatedAt =
      now();

    await persistExecution(
      execution
    );

    await persistWorkflow(
      workflow
    );

    return clone(
      execution
    );
  }

  /* ==========================================================
     RUN STEP
  ========================================================== */

  async function runStep(
    step,
    context
  ) {
    if (
      !step.action
    ) {
      throw new Error(
        "Workflow step has no action"
      );
    }

    const registry =
      state.actionRegistry.get(
        step.action
      );

    if (!registry) {
      throw new Error(
        `Action not registered: ${step.action}`
      );
    }

    const timeout =
      Math.min(
        Number(
          step.timeoutMs ||
            defaultTimeoutMs
        ),
        600000
      );

    const promise =
      registry.handler(
        context
      );

    const timeoutPromise =
      new Promise(
        (_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `Workflow step timeout: ${step.action}`
                )
              ),
            timeout
          );
        }
      );

    let result;

    try {
      result =
        await Promise.race([
          promise,
          timeoutPromise
        ]);
    } catch (error) {
      if (
        step.retries &&
        Number(
          step.retries
        ) > 0
      ) {
        const retries =
          Math.min(
            Number(
              step.retries
            ),
            maxRetries
          );

        for (
          let attempt = 1;
          attempt <= retries;
          attempt++
        ) {
          try {
            result =
              await Promise.race([
                registry.handler(
                  context
                ),
                timeoutPromise
              ]);

            break;
          } catch (retryError) {
            if (
              attempt ===
              retries
            ) {
              throw retryError;
            }
          }
        }
      } else {
        throw error;
      }
    }

    return result;
  }

  /* ==========================================================
     EVENT TRIGGERS
  ========================================================== */

  async function triggerEvent(
    eventName,
    payload = {}
  ) {
    state.statistics.eventsProcessed++;

    const workflows =
      Array.from(
        state.workflows.values()
      ).filter(
        workflow =>
          workflow.status ===
            "active" &&
          workflow.triggerType ===
            "event" &&
          (
            workflow.triggerConfig
              ?.event ===
            eventName
          )
      );

    const results = [];

    for (
      const workflow of workflows
    ) {
      try {
        const result =
          await executeWorkflow(
            workflow.id,
            {
              triggerEvent: {
                event:
                  eventName,

                payload
              },

              context:
                payload
            }
          );

        results.push(
          result
        );
      } catch (error) {
        results.push({
          workflowId:
            workflow.id,

          error:
            error.message
        });
      }
    }

    return results;
  }

  /* ==========================================================
     SCHEDULING
  ========================================================== */

  async function scheduleWorkflow(
    workflowId,
    runAt,
    input = {}
  ) {
    const workflow =
      state.workflows.get(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        "Workflow not found"
      );
    }

    const timestamp =
      new Date(
        runAt
      );

    if (
      Number.isNaN(
        timestamp.getTime()
      )
    ) {
      throw new Error(
        "Invalid schedule time"
      );
    }

    const schedule = {
      id:
        createId("workflow_schedule"),

      workflowId,

      executionId:
        null,

      runAt:
        timestamp.toISOString(),

      status:
        "scheduled",

      payload:
        input,

      createdAt:
        now(),

      executedAt:
        null
    };

    state.schedules.set(
      schedule.id,
      schedule
    );

    state.statistics.scheduledExecutions++;

    await persistSchedule(
      schedule
    );

    return clone(
      schedule
    );
  }

  async function processSchedules() {
    const current =
      Date.now();

    const schedules =
      Array.from(
        state.schedules.values()
      ).filter(
        schedule =>
          schedule.status ===
            "scheduled" &&
          new Date(
            schedule.runAt
          ).getTime() <=
            current
      );

    const results = [];

    for (
      const schedule of schedules
    ) {
      try {
        const result =
          await executeWorkflow(
            schedule.workflowId,
            {
              context:
                schedule.payload
            }
          );

        schedule.status =
          "completed";

        schedule.executionId =
          result.id;

        schedule.executedAt =
          now();

        results.push(
          result
        );
      } catch (error) {
        schedule.status =
          "failed";

        schedule.executedAt =
          now();

        results.push({
          ok: false,
          error:
            error.message
        });
      }

      await persistSchedule(
        schedule
      );
    }

    return {
      processed:
        schedules.length,

      results
    };
  }

  /* ==========================================================
     BUILT-IN BUSINESS WORKFLOWS
  ========================================================== */

  async function createDefaultBusinessWorkflows() {
    const defaults = [
      {
        id:
          "wf-new-lead",

        name:
          "New Lead Intelligent Processing",

        description:
          "تحويل العميل المحتمل الجديد إلى عملية ذكية.",

        triggerType:
          "event",

        triggerConfig: {
          event:
            "crm.lead.created"
        },

        steps: [
          {
            id:
              "analyze-lead",

            action:
              "ai_decision",

            data: {
              type:
                "lead-analysis"
            }
          },

          {
            id:
              "send-followup",

            action:
              "communication_send",

            conditions: [
              {
                left:
                  "{{previousResult.decision}}",

                operator:
                  "equals",

                right:
                  "continue"
              }
            ],

            message: {
              channel:
                "email",

              recipient:
                "{{data.email}}",

              subject:
                "مرحبًا بك في EZ MEDIA",

              body:
                "مرحبًا {{data.name}}، سعداء بتواصلك معنا."
            },

            continueOnError:
              true
          }
        ]
      },

      {
        id:
          "wf-support-escalation",

        name:
          "Support Intelligent Escalation",

        description:
          "تصعيد حالات الدعم ذات الأولوية.",

        triggerType:
          "event",

        triggerConfig: {
          event:
            "support.ticket.created"
        },

        steps: [
          {
            id:
              "support-ai",

            action:
              "ai_decision",

            data: {
              type:
                "support-risk"
            }
          },

          {
            id:
              "notification",

            action:
              "notification",

            data: {
              type:
                "support_workflow_alert",

              priority:
                "high",

              message:
                "تم إنشاء حالة دعم تحتاج متابعة."
            },

            continueOnError:
              true
          }
        ]
      }
    ];

    const created = [];

    for (
      const workflow
      of defaults
    ) {
      if (
        state.workflows.has(
          workflow.id
        )
      ) {
        continue;
      }

      try {
        const result =
          await createWorkflow({
            ...workflow,

            status:
              "active"
          });

        created.push(
          result
        );
      } catch (error) {
        logger.warn(
          "[CODE80] Default workflow failed:",
          error.message
        );
      }
    }

    return created;
  }

  /* ==========================================================
     QUERIES
  ========================================================== */

  function getWorkflow(
    workflowId
  ) {
    return clone(
      state.workflows.get(
        workflowId
      ) || null
    );
  }

  function getExecution(
    executionId
  ) {
    return clone(
      state.executions.get(
        executionId
      ) || null
    );
  }

  function listWorkflows(
    filters = {}
  ) {
    let items =
      Array.from(
        state.workflows.values()
      );

    if (
      filters.status
    ) {
      items =
        items.filter(
          item =>
            item.status ===
            filters.status
        );
    }

    if (
      filters.triggerType
    ) {
      items =
        items.filter(
          item =>
            item.triggerType ===
            filters.triggerType
        );
    }

    return clone(
      items
    );
  }

  function listExecutions(
    filters = {}
  ) {
    let items =
      Array.from(
        state.executions.values()
      );

    if (
      filters.workflowId
    ) {
      items =
        items.filter(
          item =>
            item.workflowId ===
            filters.workflowId
        );
    }

    if (
      filters.status
    ) {
      items =
        items.filter(
          item =>
            item.status ===
            filters.status
        );
    }

    return clone(
      items.slice(
        -maxExecutionHistory
      )
    );
  }

  /* ==========================================================
     STATISTICS
  ========================================================== */

  function getStatistics() {
    return {
      ...state.statistics,

      workflowCache:
        state.workflows.size,

      executionCache:
        state.executions.size,

      scheduleCache:
        state.schedules.size,

      registeredActions:
        state.actionRegistry.size,

      registeredTriggers:
        state.triggers.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Workflow & Business Process Engine",

      code:
        "80",

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

        automation:
          Boolean(
            automationEngine
          ),

        crm:
          Boolean(
            crmEngine
          ),

        communication:
          Boolean(
            communicationEngine
          ),

        customerSupport:
          Boolean(
            customerSupportEngine
          ),

        advertising:
          Boolean(
            advertisingEngine
          ),

        monetization:
          Boolean(
            monetizationEngine
          ),

        audience:
          Boolean(
            audienceEngine
          ),

        editorial:
          Boolean(
            editorialNewsroomEngine
          ),

        publishing:
          Boolean(
            publishingDistributionEngine
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

      registeredActions:
        state.actionRegistry.size,

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

  async function persistWorkflow(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_workflows
      (
        id,
        name,
        description,
        status,
        trigger_type,
        trigger_config,
        steps,
        conditions,
        variables,
        version,
        execution_count,
        success_count,
        failure_count,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16
      )
      ON CONFLICT(id)
      DO UPDATE SET
        name=EXCLUDED.name,
        description=EXCLUDED.description,
        status=EXCLUDED.status,
        trigger_type=EXCLUDED.trigger_type,
        trigger_config=EXCLUDED.trigger_config,
        steps=EXCLUDED.steps,
        conditions=EXCLUDED.conditions,
        variables=EXCLUDED.variables,
        version=EXCLUDED.version,
        execution_count=EXCLUDED.execution_count,
        success_count=EXCLUDED.success_count,
        failure_count=EXCLUDED.failure_count,
        metadata=EXCLUDED.metadata,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.name,
        item.description,
        item.status,
        item.triggerType,
        JSON.stringify(
          item.triggerConfig
        ),
        JSON.stringify(
          item.steps
        ),
        JSON.stringify(
          item.conditions
        ),
        JSON.stringify(
          item.variables
        ),
        item.version,
        item.executionCount,
        item.successCount,
        item.failureCount,
        JSON.stringify(
          item.metadata
        ),
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistExecution(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_workflow_executions
      (
        id,
        workflow_id,
        status,
        trigger_event,
        context,
        current_step,
        completed_steps,
        failed_steps,
        result,
        error,
        started_at,
        completed_at,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status,
        context=EXCLUDED.context,
        current_step=EXCLUDED.current_step,
        completed_steps=EXCLUDED.completed_steps,
        failed_steps=EXCLUDED.failed_steps,
        result=EXCLUDED.result,
        error=EXCLUDED.error,
        completed_at=EXCLUDED.completed_at,
        updated_at=EXCLUDED.updated_at
      `,
      [
        item.id,
        item.workflowId,
        item.status,
        JSON.stringify(
          item.triggerEvent
        ),
        JSON.stringify(
          item.context
        ),
        item.currentStep,
        item.completedSteps,
        item.failedSteps,
        JSON.stringify(
          item.result
        ),
        item.error,
        item.startedAt,
        item.completedAt,
        item.createdAt,
        item.updatedAt
      ]
    );
  }

  async function persistSchedule(
    item
  ) {
    await execute(
      `
      INSERT INTO ez_workflow_schedules
      (
        id,
        workflow_id,
        execution_id,
        run_at,
        status,
        payload,
        created_at,
        executed_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      ON CONFLICT(id)
      DO UPDATE SET
        execution_id=EXCLUDED.execution_id,
        status=EXCLUDED.status,
        executed_at=EXCLUDED.executed_at
      `,
      [
        item.id,
        item.workflowId,
        item.executionId,
        item.runAt,
        item.status,
        JSON.stringify(
          item.payload
        ),
        item.createdAt,
        item.executedAt
      ]
    );
  }

  /* ==========================================================
     START / STOP
  ========================================================== */

  async function start() {
    state.running =
      true;

    await createDefaultBusinessWorkflows();

    emit(
      "workflow.started",
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
      "workflow.stopped",
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

    registerAction,

    createWorkflow,
    updateWorkflow,

    executeWorkflow,
    runStep,

    triggerEvent,

    scheduleWorkflow,
    processSchedules,

    evaluateCondition,
    evaluateConditions,

    getWorkflow,
    getExecution,

    listWorkflows,
    listExecutions,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentWorkflowEngine
};
