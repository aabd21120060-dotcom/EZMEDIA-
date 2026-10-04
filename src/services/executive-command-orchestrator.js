'use strict';

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 122
 * Executive Command Orchestrator
 * ============================================================
 *
 * الوظيفة:
 * - توحيد أوامر مركز القيادة التنفيذي.
 * - ربط الأتمتة والعمليات والجدولة وسير العمل والبث.
 * - عدم اختراع حالة نجاح غير حقيقية.
 * - العمليات الحساسة تمر بالموافقة البشرية.
 * - يعمل حتى لو كانت بعض المحركات غير مثبتة بعد.
 *
 * ============================================================
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class ExecutiveCommandOrchestrator extends EventEmitter {

  constructor(options = {}) {

    super();

    this.name =
      'EZ MEDIA Executive Command Orchestrator';

    this.code = '122';

    this.version = '1.0.0';

    this.startedAt = null;

    this.statusValue = 'stopped';

    this.lastError = null;

    this.lastCommand = null;

    this.commandHistory = [];

    this.maxHistory =
      Number(
        process.env.EXECUTIVE_COMMAND_MAX_HISTORY || 500
      );

    this.requireHumanApproval =
      String(
        process.env.EXECUTIVE_COMMAND_REQUIRE_HUMAN_APPROVAL ?? 'true'
      ).toLowerCase() === 'true';

    this.engines = {

      operations:
        options.operations || null,

      collaboration:
        options.collaboration || null,

      autonomousAI:
        options.autonomousAI || null,

      memory:
        options.memory || null,

      knowledge:
        options.knowledge || null,

      scheduler:
        options.scheduler || null,

      broadcast:
        options.broadcast || null,

      workflow:
        options.workflow || null,

      advertising:
        options.advertising || null,

      crm:
        options.crm || null

    };

    this.sensitiveActions = new Set([

      'broadcast.start',

      'broadcast.stop',

      'broadcast.publish',

      'broadcast.go_live',

      'content.publish',

      'distribution.publish',

      'distribution.send',

      'advertising.activate',

      'advertising.launch',

      'workflow.execute',

      'workflow.publish',

      'system.emergency_stop'

    ]);

  }


  /**
   * ==========================================================
   * START
   * ==========================================================
   */

  start() {

    if (
      this.statusValue === 'running'
    ) {

      return this.status();

    }

    this.startedAt =
      new Date().toISOString();

    this.statusValue =
      'running';

    this.lastError =
      null;

    this.emit(
      'started',
      this.status()
    );

    return this.status();

  }


  /**
   * ==========================================================
   * STOP
   * ==========================================================
   */

  stop() {

    this.statusValue =
      'stopped';

    this.emit(
      'stopped',
      this.status()
    );

    return this.status();

  }


  /**
   * ==========================================================
   * STATUS
   * ==========================================================
   */

  status() {

    return {

      ok: true,

      name: this.name,

      code: this.code,

      version: this.version,

      status: this.statusValue,

      startedAt: this.startedAt,

      lastError: this.lastError,

      lastCommand: this.lastCommand,

      engines: this.getEngineMatrix(),

      configuration: {

        requireHumanApproval:
          this.requireHumanApproval,

        maxHistory:
          this.maxHistory

      },

      timestamp:
        new Date().toISOString()

    };

  }


  /**
   * ==========================================================
   * ENGINE MATRIX
   * ==========================================================
   */

  getEngineMatrix() {

    const matrix = {};

    for (
      const [
        name,
        engine
      ]
      of Object.entries(this.engines)
    ) {

      matrix[name] = {

        configured:
          Boolean(engine),

        available:
          Boolean(
            engine &&
            typeof engine === 'object'
          ),

        callable:
          Boolean(
            engine &&
            (
              typeof engine.run === 'function' ||
              typeof engine.execute === 'function' ||
              typeof engine.start === 'function' ||
              typeof engine.stop === 'function'
            )
          )

      };

    }

    return matrix;

  }


  /**
   * ==========================================================
   * COMMAND ID
   * ==========================================================
   */

  createCommandId() {

    return (
      'cmd_' +
      Date.now() +
      '_' +
      crypto
        .randomBytes(6)
        .toString('hex')
    );

  }


  /**
   * ==========================================================
   * RECORD
   * ==========================================================
   */

  record(command) {

    this.lastCommand =
      command;

    this.commandHistory.unshift(
      command
    );

    if (
      this.commandHistory.length >
      this.maxHistory
    ) {

      this.commandHistory =
        this.commandHistory.slice(
          0,
          this.maxHistory
        );

    }

    this.emit(
      'command',
      command
    );

  }


  /**
   * ==========================================================
   * GET HISTORY
   * ==========================================================
   */

  history(limit = 50) {

    const safeLimit =
      Math.max(
        1,
        Math.min(
          Number(limit) || 50,
          this.maxHistory
        )
      );

    return this.commandHistory
      .slice(0, safeLimit);

  }


  /**
   * ==========================================================
   * VALIDATE
   * ==========================================================
   */

  validateCommand(input = {}) {

    const action =
      String(
        input.action || ''
      ).trim();

    if (!action) {

      throw new Error(
        'action is required'
      );

    }

    return {

      action,

      payload:
        (
          input.payload &&
          typeof input.payload === 'object'
        )
          ? input.payload
          : {},

      source:
        String(
          input.source ||
          'executive-command-center'
        ),

      requestedBy:
        String(
          input.requestedBy ||
          'executive-command-center'
        )

    };

  }


  /**
   * ==========================================================
   * HUMAN APPROVAL
   * ==========================================================
   */

  requiresApproval(action) {

    if (
      this.sensitiveActions.has(action)
    ) {

      return true;

    }

    return false;

  }


  /**
   * ==========================================================
   * CREATE APPROVAL
   * ==========================================================
   */

  createApproval(command) {

    const approvalId =
      'approval_' +
      Date.now() +
      '_' +
      crypto
        .randomBytes(5)
        .toString('hex');

    const approval = {

      id:
        approvalId,

      status:
        'pending',

      action:
        command.action,

      payload:
        command.payload,

      commandId:
        command.id,

      requestedBy:
        command.requestedBy,

      createdAt:
        new Date().toISOString(),

      message:
        'هذه العملية تحتاج موافقة بشرية قبل التنفيذ.'

    };

    this.emit(
      'approval.required',
      approval
    );

    return approval;

  }


  /**
   * ==========================================================
   * FIND ENGINE
   * ==========================================================
   */

  findEngineForAction(action) {

    if (
      action.startsWith('broadcast.')
    ) {

      return this.engines.broadcast;

    }

    if (
      action.startsWith('workflow.')
    ) {

      return this.engines.workflow;

    }

    if (
      action.startsWith('scheduler.')
    ) {

      return this.engines.scheduler;

    }

    if (
      action.startsWith('advertising.')
    ) {

      return this.engines.advertising;

    }

    if (
      action.startsWith('crm.')
    ) {

      return this.engines.crm;

    }

    if (
      action.startsWith('content.')
    ) {

      return this.engines.operations;

    }

    if (
      action.startsWith('distribution.')
    ) {

      return this.engines.operations;

    }

    if (
      action.startsWith('operations.')
    ) {

      return this.engines.operations;

    }

    if (
      action.startsWith('ai.')
    ) {

      return this.engines.autonomousAI;

    }

    if (
      action.startsWith('memory.')
    ) {

      return this.engines.memory;

    }

    return null;

  }


  /**
   * ==========================================================
   * EXECUTE AGAINST ENGINE
   * ==========================================================
   */

  async executeAgainstEngine(
    action,
    payload
  ) {

    const engine =
      this.findEngineForAction(
        action
      );

    if (!engine) {

      return {

        executed: false,

        reason:
          'engine_not_configured',

        message:
          'المحرك المطلوب غير موصل حاليًا.',

        action

      };

    }


    try {

      if (
        typeof engine.executeCommand ===
        'function'
      ) {

        return await engine.executeCommand(
          action,
          payload
        );

      }


      if (
        typeof engine.execute ===
        'function'
      ) {

        return await engine.execute({

          action,

          payload

        });

      }


      if (
        typeof engine.run ===
        'function'
      ) {

        return await engine.run({

          action,

          payload

        });

      }


      if (
        action.endsWith('.start') &&
        typeof engine.start ===
        'function'
      ) {

        return await engine.start(
          payload
        );

      }


      if (
        action.endsWith('.stop') &&
        typeof engine.stop ===
        'function'
      ) {

        return await engine.stop(
          payload
        );

      }


      return {

        executed: false,

        reason:
          'engine_method_not_supported',

        message:
          'المحرك موجود لكن لا يملك واجهة تنفيذ متوافقة.',

        action

      };

    } catch (error) {

      this.lastError =
        error.message;

      return {

        executed: false,

        reason:
          'engine_error',

        message:
          error.message,

        action

      };

    }

  }


  /**
   * ==========================================================
   * DISPATCH COMMAND
   * ==========================================================
   */

  async dispatch(input = {}) {

    const validated =
      this.validateCommand(
        input
      );


    const command = {

      id:
        this.createCommandId(),

      action:
        validated.action,

      payload:
        validated.payload,

      source:
        validated.source,

      requestedBy:
        validated.requestedBy,

      createdAt:
        new Date().toISOString(),

      status:
        'received'

    };


    const approvalRequired =
      this.requiresApproval(
        command.action
      );


    if (
      this.requireHumanApproval &&
      approvalRequired &&
      !input.approved
    ) {

      const approval =
        this.createApproval(
          command
        );

      command.status =
        'awaiting_human_approval';

      command.approval =
        approval;

      this.record(
        command
      );

      return {

        ok: true,

        executed: false,

        requiresApproval: true,

        command,

        approval

      };

    }


    command.status =
      'executing';


    this.record(
      command
    );


    const result =
      await this.executeAgainstEngine(
        command.action,
        command.payload
      );


    command.result =
      result;


    command.executed =
      Boolean(
        result &&
        result.executed
      );


    command.status =
      command.executed
        ? 'completed'
        : 'not_executed';


    command.completedAt =
      new Date().toISOString();


    this.emit(
      'command.completed',
      command
    );


    return {

      ok:
        true,

      executed:
        command.executed,

      requiresApproval:
        false,

      command

    };

  }


  /**
   * ==========================================================
   * EMERGENCY STOP
   * ==========================================================
   */

  async emergencyStop() {

    const command = {

      action:
        'system.emergency_stop',

      payload: {

        reason:
          'Executive Command Center',

        timestamp:
          new Date().toISOString()

      },

      source:
        'executive-command-center',

      requestedBy:
        'executive-command-center'

    };


    if (
      this.requireHumanApproval
    ) {

      const validated =
        this.validateCommand(
          command
        );

      const fullCommand = {

        id:
          this.createCommandId(),

        ...validated,

        createdAt:
          new Date().toISOString(),

        status:
          'awaiting_human_approval'

      };

      const approval =
        this.createApproval(
          fullCommand
        );

      fullCommand.approval =
        approval;

      this.record(
        fullCommand
      );

      return {

        ok: true,

        executed: false,

        requiresApproval: true,

        command:
          fullCommand,

        approval

      };

    }


    return this.dispatch({
      ...command,
      approved: true
    });

  }


  /**
   * ==========================================================
   * DASHBOARD
   * ==========================================================
   */

  dashboard() {

    return {

      ok: true,

      orchestrator: {

        code:
          this.code,

        version:
          this.version,

        status:
          this.statusValue

      },

      commands: {

        total:
          this.commandHistory.length,

        last:
          this.lastCommand

      },

      engines:
        this.getEngineMatrix(),

      approvals: {

        humanApprovalRequired:
          this.requireHumanApproval

      },

      timestamp:
        new Date().toISOString()

    };

  }

}


module.exports =
  ExecutiveCommandOrchestrator;
