"use strict";

/**
 * EZ MEDIA 11.0
 * CODE 102
 *
 * Executive Command API Engine
 *
 * طبقة التحكم التنفيذية بين واجهة CODE 101
 * والعقل التنفيذي CODE 100 وبقية أنظمة المنصة.
 */

function createExecutiveCommandAPIEngine(options = {}) {
  const {
    commandEngine,
    platformControl,
    analyticsEngine,
    automationEngine,
    liveBroadcastEngine,
    broadcastScheduler,
    editorialNewsroom,
    contentAssignment,
    workforceEngine,
    trainingEngine,
    advertisingEngine,
    monetizationEngine,
    crmEngine,
    contentFactory,
    distributionEngine,
    workflowEngine,
    securityEngine,
    communicationEngine,
    customerSupportEngine,
    aiOrchestrator,
    persistence,
    eventBus,
    notificationService,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,
    startedAt: null,

    commandCount: 0,
    successfulCommands: 0,
    failedCommands: 0,

    lastCommandAt: null,
    lastCommand: null,

    emergencyStopped: false
  };

  const COMMANDS = {
    RUN_EXECUTIVE_CYCLE:
      "run_executive_cycle",

    REFRESH_SNAPSHOT:
      "refresh_snapshot",

    GENERATE_DECISIONS:
      "generate_decisions",

    GENERATE_ALERTS:
      "generate_alerts",

    CREATE_ACTION_PLAN:
      "create_action_plan",

    START_AUTOMATION:
      "start_automation",

    STOP_AUTOMATION:
      "stop_automation",

    PAUSE_AUTOMATION:
      "pause_automation",

    RESUME_AUTOMATION:
      "resume_automation",

    START_LIVE:
      "start_live",

    STOP_LIVE:
      "stop_live",

    START_SCHEDULER:
      "start_scheduler",

    STOP_SCHEDULER:
      "stop_scheduler",

    START_WORKFLOW:
      "start_workflow",

    STOP_WORKFLOW:
      "stop_workflow",

    START_ANALYTICS:
      "start_analytics",

    STOP_ANALYTICS:
      "stop_analytics",

    START_DISTRIBUTION:
      "start_distribution",

    STOP_DISTRIBUTION:
      "stop_distribution",

    START_CONTENT_FACTORY:
      "start_content_factory",

    STOP_CONTENT_FACTORY:
      "stop_content_factory",

    EMERGENCY_STOP:
      "emergency_stop",

    RESUME_SYSTEM:
      "resume_system"
  };

  function now() {
    return new Date().toISOString();
  }

  function serviceExists(service) {
    return !!service;
  }

  async function safeCall(
    service,
    method,
    args = []
  ) {
    if (!service) {
      return {
        ok: false,
        skipped: true,
        reason: "service_not_available"
      };
    }

    if (
      typeof service[method] !==
      "function"
    ) {
      return {
        ok: false,
        skipped: true,
        reason:
          `method_not_available:${method}`
      };
    }

    try {
      const result =
        await service[method](...args);

      return {
        ok: true,
        result
      };
    } catch (error) {
      logger.error(
        `[CODE 102] ${method}`,
        error
      );

      return {
        ok: false,
        error:
          error.message ||
          String(error)
      };
    }
  }

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    state.initialized =
      true;

    state.startedAt =
      now();

    return getStatus();
  }

  function start() {
    state.running = true;

    return getStatus();
  }

  function stop() {
    state.running = false;

    return getStatus();
  }

  function getStatus() {
    return {
      initialized:
        state.initialized,

      running:
        state.running,

      emergencyStopped:
        state.emergencyStopped,

      startedAt:
        state.startedAt,

      commandCount:
        state.commandCount,

      successfulCommands:
        state.successfulCommands,

      failedCommands:
        state.failedCommands,

      lastCommandAt:
        state.lastCommandAt,

      lastCommand:
        state.lastCommand
    };
  }

  function getAvailableCommands() {
    return Object.values(
      COMMANDS
    );
  }

  async function audit(
    command,
    payload,
    result,
    actor = "executive-command-center"
  ) {
    if (
      persistence &&
      typeof persistence.addAuditLog ===
        "function"
    ) {
      try {
        await persistence.addAuditLog({
          action:
            `executive_command:${command}`,

          actor,

          target:
            "ez-media-platform",

          metadata: {
            payload,
            result
          }
        });
      } catch (error) {
        logger.warn(
          "[CODE 102] Audit failed",
          error.message
        );
      }
    }

    if (
      eventBus &&
      typeof eventBus.emit ===
        "function"
    ) {
      try {
        eventBus.emit(
          "executive.command.executed",
          {
            command,
            actor,
            result,
            timestamp: now()
          }
        );
      } catch {
        // لا نسمح لفشل Event Bus
        // بإيقاف الأمر التنفيذي.
      }
    }
  }

  async function runExecutiveCycle(
    payload = {}
  ) {
    if (!commandEngine) {
      return {
        ok: false,
        error:
          "command_engine_not_available"
      };
    }

    return safeCall(
      commandEngine,
      "run",
      [payload]
    );
  }

  async function refreshSnapshot() {
    if (!commandEngine) {
      return {
        ok: false,
        error:
          "command_engine_not_available"
      };
    }

    if (
      typeof commandEngine.getSnapshot ===
      "function"
    ) {
      return safeCall(
        commandEngine,
        "getSnapshot"
      );
    }

    if (
      typeof commandEngine.snapshot ===
      "function"
    ) {
      return safeCall(
        commandEngine,
        "snapshot"
      );
    }

    return {
      ok: false,
      error:
        "snapshot_method_not_available"
    };
  }

  async function generateDecisions(
    payload = {}
  ) {
    if (!commandEngine) {
      return {
        ok: false,
        error:
          "command_engine_not_available"
      };
    }

    return safeCall(
      commandEngine,
      "generateDecisions",
      [payload]
    );
  }

  async function generateAlerts(
    payload = {}
  ) {
    if (!commandEngine) {
      return {
        ok: false,
        error:
          "command_engine_not_available"
      };
    }

    return safeCall(
      commandEngine,
      "generateAlerts",
      [payload]
    );
  }

  async function createActionPlan(
    payload = {}
  ) {
    if (!commandEngine) {
      return {
        ok: false,
        error:
          "command_engine_not_available"
      };
    }

    return safeCall(
      commandEngine,
      "createActionPlan",
      [payload]
    );
  }

  async function executeCommand(
    command,
    payload = {},
    context = {}
  ) {
    state.commandCount++;

    state.lastCommandAt =
      now();

    state.lastCommand =
      command;

    let result;

    switch (command) {
      case COMMANDS.RUN_EXECUTIVE_CYCLE:
        result =
          await runExecutiveCycle(
            payload
          );
        break;

      case COMMANDS.REFRESH_SNAPSHOT:
        result =
          await refreshSnapshot();
        break;

      case COMMANDS.GENERATE_DECISIONS:
        result =
          await generateDecisions(
            payload
          );
        break;

      case COMMANDS.GENERATE_ALERTS:
        result =
          await generateAlerts(
            payload
          );
        break;

      case COMMANDS.CREATE_ACTION_PLAN:
        result =
          await createActionPlan(
            payload
          );
        break;

      case COMMANDS.START_AUTOMATION:
        result =
          await safeCall(
            automationEngine,
            "start"
          );
        break;

      case COMMANDS.STOP_AUTOMATION:
        result =
          await safeCall(
            automationEngine,
            "stop"
          );
        break;

      case COMMANDS.PAUSE_AUTOMATION:
        result =
          await safeCall(
            automationEngine,
            "pause"
          );
        break;

      case COMMANDS.RESUME_AUTOMATION:
        result =
          await safeCall(
            automationEngine,
            "resume"
          );
        break;

      case COMMANDS.START_LIVE:
        result =
          await safeCall(
            liveBroadcastEngine,
            "start"
          );
        break;

      case COMMANDS.STOP_LIVE:
        result =
          await safeCall(
            liveBroadcastEngine,
            "stop"
          );
        break;

      case COMMANDS.START_SCHEDULER:
        result =
          await safeCall(
            broadcastScheduler,
            "start"
          );
        break;

      case COMMANDS.STOP_SCHEDULER:
        result =
          await safeCall(
            broadcastScheduler,
            "stop"
          );
        break;

      case COMMANDS.START_WORKFLOW:
        result =
          await safeCall(
            workflowEngine,
            "start"
          );
        break;

      case COMMANDS.STOP_WORKFLOW:
        result =
          await safeCall(
            workflowEngine,
            "stop"
          );
        break;

      case COMMANDS.START_ANALYTICS:
        result =
          await safeCall(
            analyticsEngine,
            "start"
          );
        break;

      case COMMANDS.STOP_ANALYTICS:
        result =
          await safeCall(
            analyticsEngine,
            "stop"
          );
        break;

      case COMMANDS.START_DISTRIBUTION:
        result =
          await safeCall(
            distributionEngine,
            "start"
          );
        break;

      case COMMANDS.STOP_DISTRIBUTION:
        result =
          await safeCall(
            distributionEngine,
            "stop"
          );
        break;

      case COMMANDS.START_CONTENT_FACTORY:
        result =
          await safeCall(
            contentFactory,
            "start"
          );
        break;

      case COMMANDS.STOP_CONTENT_FACTORY:
        result =
          await safeCall(
            contentFactory,
            "stop"
          );
        break;

      case COMMANDS.EMERGENCY_STOP:
        result =
          await emergencyStop();
        break;

      case COMMANDS.RESUME_SYSTEM:
        result =
          await resumeSystem();
        break;

      default:
        result = {
          ok: false,
          error:
            "unknown_command"
        };
    }

    if (result?.ok) {
      state.successfulCommands++;
    } else {
      state.failedCommands++;
    }

    await audit(
      command,
      payload,
      result,
      context.actor
    );

    return {
      command,
      timestamp:
        now(),
      ...result
    };
  }

  async function emergencyStop() {
    state.emergencyStopped =
      true;

    const results = {};

    results.automation =
      await safeCall(
        automationEngine,
        "stop"
      );

    results.workflow =
      await safeCall(
        workflowEngine,
        "stop"
      );

    results.distribution =
      await safeCall(
        distributionEngine,
        "stop"
      );

    results.contentFactory =
      await safeCall(
        contentFactory,
        "stop"
      );

    results.live =
      await safeCall(
        liveBroadcastEngine,
        "stop"
      );

    results.scheduler =
      await safeCall(
        broadcastScheduler,
        "stop"
      );

    results.analytics =
      await safeCall(
        analyticsEngine,
        "stop"
      );

    if (
      notificationService &&
      typeof notificationService.notify ===
        "function"
    ) {
      try {
        await notificationService.notify({
          type:
            "executive_emergency_stop",

          severity:
            "critical",

          title:
            "تم تفعيل الإيقاف التنفيذي",

          message:
            "تم إيقاف الخدمات الداخلية القابلة للإيقاف من مركز القيادة."
        });
      } catch {
        // notification failure
      }
    }

    return {
      ok: true,

      emergencyStopped:
        true,

      results
    };
  }

  async function resumeSystem() {
    state.emergencyStopped =
      false;

    const results = {};

    results.automation =
      await safeCall(
        automationEngine,
        "start"
      );

    results.workflow =
      await safeCall(
        workflowEngine,
        "start"
      );

    results.analytics =
      await safeCall(
        analyticsEngine,
        "start"
      );

    return {
      ok: true,

      emergencyStopped:
        false,

      results
    };
  }

  async function getSystemMatrix() {
    const systems = {
      commandEngine,
      platformControl,
      analyticsEngine,
      automationEngine,
      liveBroadcastEngine,
      broadcastScheduler,
      editorialNewsroom,
      contentAssignment,
      workforceEngine,
      trainingEngine,
      advertisingEngine,
      monetizationEngine,
      crmEngine,
      contentFactory,
      distributionEngine,
      workflowEngine,
      securityEngine,
      communicationEngine,
      customerSupportEngine,
      aiOrchestrator
    };

    const result = {};

    for (
      const [
        name,
        service
      ] of Object.entries(
        systems
      )
    ) {
      let status = null;

      if (
        service &&
        typeof service.getStatus ===
          "function"
      ) {
        try {
          status =
            await service.getStatus();
        } catch (error) {
          status = {
            error:
              error.message
          };
        }
      }

      result[name] = {
        available:
          serviceExists(
            service
          ),

        status
      };
    }

    return result;
  }

  async function getDashboard() {
    const [
      matrix,
      commandStatus
    ] =
      await Promise.all([
        getSystemMatrix(),
        Promise.resolve(
          getStatus()
        )
      ]);

    return {
      ok: true,

      timestamp:
        now(),

      command:
        commandStatus,

      systems:
        matrix
    };
  }

  return {
    initialize,
    start,
    stop,

    getStatus,
    getAvailableCommands,
    getDashboard,

    executeCommand,

    runExecutiveCycle,
    refreshSnapshot,
    generateDecisions,
    generateAlerts,
    createActionPlan,

    emergencyStop,
    resumeSystem,

    COMMANDS
  };
}

module.exports = {
  createExecutiveCommandAPIEngine
};
