"use strict";

const crypto = require("crypto");

function createIntelligentBroadcastScheduler(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    liveBroadcastEngine = null,
    workflowEngine = null,
    automationEngine = null,
    damEngine = null,
    videoEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    schedulerIntervalMs =
      Number(
        process.env.BROADCAST_SCHEDULER_INTERVAL_MS ||
        15000
      ),

    maxPrograms =
      Number(
        process.env.BROADCAST_SCHEDULER_MAX_PROGRAMS ||
        10000
      ),

    maxSchedules =
      Number(
        process.env.BROADCAST_SCHEDULER_MAX_SCHEDULES ||
        50000
      ),

    defaultTimezone =
      process.env.BROADCAST_SCHEDULER_TIMEZONE ||
      "Asia/Riyadh"
  } = options;

  const state = {
    initialized: false,
    running: false,

    programs: new Map(),
    schedules: new Map(),
    channels: new Map(),
    executions: new Map(),
    alerts: new Map(),

    timer: null,

    statistics: {
      programsCreated: 0,
      schedulesCreated: 0,
      executionsStarted: 0,
      executionsCompleted: 0,
      executionsFailed: 0,
      automaticStarts: 0,
      automaticStops: 0,
      conflictsDetected: 0,
      schedulerRuns: 0
    }
  };

  function now() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return (
      `${prefix}_${Date.now()}_` +
      crypto.randomBytes(8).toString("hex")
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

  async function query(sql, values = []) {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return null;
    }

    return persistence.query(
      sql,
      values
    );
  }

  function emit(event, payload = {}) {
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
        "[CODE89] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_broadcast_programs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        program_type TEXT DEFAULT 'program',
        duration_seconds INTEGER DEFAULT 0,
        asset_id TEXT,
        channel_id TEXT,
        settings JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_broadcast_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        channel_type TEXT DEFAULT 'digital',
        timezone TEXT DEFAULT 'Asia/Riyadh',
        settings JSONB DEFAULT '{}'::jsonb,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_broadcast_schedules (
        id TEXT PRIMARY KEY,
        program_id TEXT,
        channel_id TEXT,
        broadcast_id TEXT,
        schedule_type TEXT DEFAULT 'once',
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ,
        timezone TEXT DEFAULT 'Asia/Riyadh',
        status TEXT DEFAULT 'scheduled',
        recurrence JSONB DEFAULT '{}'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_broadcast_schedule_executions (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        program_id TEXT,
        channel_id TEXT,
        broadcast_id TEXT,
        status TEXT DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        error TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_broadcast_schedule_alerts (
        id TEXT PRIMARY KEY,
        schedule_id TEXT,
        alert_type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_broadcast_schedule_start
      ON ez_broadcast_schedules(start_at)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_broadcast_schedule_status
      ON ez_broadcast_schedules(status)
    `);
  }

  /* ============================================================
     INITIALIZATION
  ============================================================ */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "broadcast.scheduler.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     CHANNELS
  ============================================================ */

  async function createChannel(input = {}) {
    if (!input.name) {
      throw new Error(
        "Channel name is required"
      );
    }

    const channel = {
      id: id("channel"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      channelType:
        input.channelType ||
        "digital",

      timezone:
        input.timezone ||
        defaultTimezone,

      settings:
        input.settings || {},

      active:
        input.active !== false,

      createdAt: now(),
      updatedAt: now()
    };

    state.channels.set(
      channel.id,
      channel
    );

    await query(
      `
      INSERT INTO ez_broadcast_channels
      (
        id,
        name,
        channel_type,
        timezone,
        settings,
        active,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        channel.id,
        channel.name,
        channel.channelType,
        channel.timezone,
        JSON.stringify(
          channel.settings
        ),
        channel.active,
        channel.createdAt,
        channel.updatedAt
      ]
    );

    return clone(channel);
  }

  function getChannels() {
    return Array.from(
      state.channels.values()
    ).map(clone);
  }

  /* ============================================================
     PROGRAMS
  ============================================================ */

  async function createProgram(input = {}) {
    if (
      state.programs.size >=
      maxPrograms
    ) {
      throw new Error(
        "Maximum programs reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Program name is required"
      );
    }

    const duration =
      Number(
        input.durationSeconds || 0
      );

    if (
      duration < 0 ||
      duration > 86400
    ) {
      throw new Error(
        "Invalid program duration"
      );
    }

    const program = {
      id: id("program"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      description:
        input.description ||
        "",

      programType:
        input.programType ||
        "program",

      durationSeconds:
        duration,

      assetId:
        input.assetId ||
        null,

      channelId:
        input.channelId ||
        null,

      settings:
        input.settings || {},

      metadata:
        input.metadata || {},

      active:
        input.active !== false,

      createdAt: now(),
      updatedAt: now()
    };

    state.programs.set(
      program.id,
      program
    );

    state.statistics
      .programsCreated++;

    await query(
      `
      INSERT INTO ez_broadcast_programs
      (
        id,
        name,
        description,
        program_type,
        duration_seconds,
        asset_id,
        channel_id,
        settings,
        metadata,
        active,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12
      )
      `,
      [
        program.id,
        program.name,
        program.description,
        program.programType,
        program.durationSeconds,
        program.assetId,
        program.channelId,
        JSON.stringify(
          program.settings
        ),
        JSON.stringify(
          program.metadata
        ),
        program.active,
        program.createdAt,
        program.updatedAt
      ]
    );

    emit(
      "broadcast.program.created",
      {
        programId:
          program.id
      }
    );

    return clone(program);
  }

  function getProgram(programId) {
    const program =
      state.programs.get(
        programId
      );

    return program
      ? clone(program)
      : null;
  }

  function getPrograms() {
    return Array.from(
      state.programs.values()
    ).map(clone);
  }

  /* ============================================================
     SCHEDULES
  ============================================================ */

  async function createSchedule(input = {}) {
    if (
      state.schedules.size >=
      maxSchedules
    ) {
      throw new Error(
        "Maximum schedules reached"
      );
    }

    if (!input.startAt) {
      throw new Error(
        "startAt is required"
      );
    }

    const start =
      new Date(
        input.startAt
      );

    if (
      Number.isNaN(
        start.getTime()
      )
    ) {
      throw new Error(
        "Invalid startAt"
      );
    }

    const program =
      input.programId
        ? state.programs.get(
            input.programId
          )
        : null;

    if (
      input.programId &&
      !program
    ) {
      throw new Error(
        "Program not found"
      );
    }

    const end =
      input.endAt
        ? new Date(
            input.endAt
          )
        : program &&
          program.durationSeconds
        ? new Date(
            start.getTime() +
            program.durationSeconds *
              1000
          )
        : null;

    if (
      end &&
      end.getTime() <=
        start.getTime()
    ) {
      throw new Error(
        "endAt must be after startAt"
      );
    }

    const schedule = {
      id:
        id("schedule"),

      programId:
        input.programId ||
        null,

      channelId:
        input.channelId ||
        program?.channelId ||
        null,

      broadcastId:
        input.broadcastId ||
        null,

      scheduleType:
        input.scheduleType ||
        "once",

      startAt:
        start.toISOString(),

      endAt:
        end
          ? end.toISOString()
          : null,

      timezone:
        input.timezone ||
        defaultTimezone,

      status:
        "scheduled",

      recurrence:
        input.recurrence || {},

      settings:
        input.settings || {},

      metadata:
        input.metadata || {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    const conflicts =
      await detectConflicts(
        schedule
      );

    if (
      conflicts.length
    ) {
      state.statistics
        .conflictsDetected++;

      schedule.metadata = {
        ...schedule.metadata,

        conflicts
      };
    }

    state.schedules.set(
      schedule.id,
      schedule
    );

    state.statistics
      .schedulesCreated++;

    await query(
      `
      INSERT INTO ez_broadcast_schedules
      (
        id,
        program_id,
        channel_id,
        broadcast_id,
        schedule_type,
        start_at,
        end_at,
        timezone,
        status,
        recurrence,
        settings,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14
      )
      `,
      [
        schedule.id,
        schedule.programId,
        schedule.channelId,
        schedule.broadcastId,
        schedule.scheduleType,
        schedule.startAt,
        schedule.endAt,
        schedule.timezone,
        schedule.status,
        JSON.stringify(
          schedule.recurrence
        ),
        JSON.stringify(
          schedule.settings
        ),
        JSON.stringify(
          schedule.metadata
        ),
        schedule.createdAt,
        schedule.updatedAt
      ]
    );

    emit(
      "broadcast.schedule.created",
      {
        scheduleId:
          schedule.id,

        conflicts
      }
    );

    return clone(schedule);
  }

  function getSchedules(filters = {}) {
    let schedules =
      Array.from(
        state.schedules.values()
      );

    if (filters.channelId) {
      schedules =
        schedules.filter(
          schedule =>
            schedule.channelId ===
            filters.channelId
        );
    }

    if (filters.status) {
      schedules =
        schedules.filter(
          schedule =>
            schedule.status ===
            filters.status
        );
    }

    if (filters.from) {
      const from =
        new Date(
          filters.from
        ).getTime();

      schedules =
        schedules.filter(
          schedule =>
            new Date(
              schedule.startAt
            ).getTime() >= from
        );
    }

    if (filters.to) {
      const to =
        new Date(
          filters.to
        ).getTime();

      schedules =
        schedules.filter(
          schedule =>
            new Date(
              schedule.startAt
            ).getTime() <= to
        );
    }

    return schedules
      .sort(
        (a, b) =>
          new Date(a.startAt) -
          new Date(b.startAt)
      )
      .map(clone);
  }

  /* ============================================================
     CONFLICTS
  ============================================================ */

  async function detectConflicts(
    candidate
  ) {
    const conflicts = [];

    if (!candidate.channelId) {
      return conflicts;
    }

    const start =
      new Date(
        candidate.startAt
      ).getTime();

    const end =
      candidate.endAt
        ? new Date(
            candidate.endAt
          ).getTime()
        : start + 60000;

    for (
      const schedule
      of state.schedules.values()
    ) {
      if (
        schedule.channelId !==
        candidate.channelId
      ) {
        continue;
      }

      if (
        schedule.status ===
        "cancelled"
      ) {
        continue;
      }

      const existingStart =
        new Date(
          schedule.startAt
        ).getTime();

      const existingEnd =
        schedule.endAt
          ? new Date(
              schedule.endAt
            ).getTime()
          : existingStart + 60000;

      const overlap =
        start < existingEnd &&
        end > existingStart;

      if (overlap) {
        conflicts.push({
          scheduleId:
            schedule.id,

          reason:
            "schedule_overlap",

          existingStart:
            schedule.startAt,

          existingEnd:
            schedule.endAt
        });
      }
    }

    return conflicts;
  }

  /* ============================================================
     EXECUTION
  ============================================================ */

  async function executeSchedule(
    scheduleId
  ) {
    const schedule =
      state.schedules.get(
        scheduleId
      );

    if (!schedule) {
      throw new Error(
        "Schedule not found"
      );
    }

    if (
      schedule.status ===
      "cancelled"
    ) {
      throw new Error(
        "Schedule is cancelled"
      );
    }

    const execution = {
      id:
        id("schedule_execution"),

      scheduleId,

      programId:
        schedule.programId,

      channelId:
        schedule.channelId,

      broadcastId:
        schedule.broadcastId,

      status:
        "running",

      startedAt:
        now(),

      completedAt:
        null,

      error:
        null,

      metadata: {},

      createdAt:
        now()
    };

    state.executions.set(
      execution.id,
      execution
    );

    state.statistics
      .executionsStarted++;

    await query(
      `
      INSERT INTO ez_broadcast_schedule_executions
      (
        id,
        schedule_id,
        program_id,
        channel_id,
        broadcast_id,
        status,
        started_at,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        execution.id,
        execution.scheduleId,
        execution.programId,
        execution.channelId,
        execution.broadcastId,
        execution.status,
        execution.startedAt,
        JSON.stringify(
          execution.metadata
        ),
        execution.createdAt
      ]
    );

    try {
      /*
       * إذا تم ربط البث بـ CODE 87
       * يبدأ البث الفعلي.
       */

      if (
        execution.broadcastId &&
        liveBroadcastEngine
      ) {
        await liveBroadcastEngine
          .startBroadcast(
            execution.broadcastId
          );

        state.statistics
          .automaticStarts++;

        emit(
          "broadcast.schedule.started",
          {
            scheduleId,
            executionId:
              execution.id,

            broadcastId:
              execution.broadcastId
          }
        );
      }

      /*
       * يمكن لاحقًا تمرير Asset إلى CODE 86
       * قبل بدء البث حسب نوع البرنامج.
       */

      if (
        videoEngine &&
        schedule.settings
          .processAsset &&
        schedule.programId
      ) {
        const program =
          state.programs.get(
            schedule.programId
          );

        if (
          program?.assetId &&
          typeof videoEngine
            .createJob ===
            "function"
        ) {
          execution.metadata
            .videoProcessing =
            await videoEngine
              .createJob({
                assetId:
                  program.assetId,

                type:
                  "broadcast-preparation",

                metadata: {
                  scheduleId
                }
              });
        }
      }

      execution.status =
        "running";

      schedule.status =
        "running";

      await persistSchedule(
        schedule
      );

      await persistExecution(
        execution
      );

      return clone(
        execution
      );

    } catch (error) {
      execution.status =
        "failed";

      execution.error =
        error.message;

      execution.completedAt =
        now();

      schedule.status =
        "failed";

      state.statistics
        .executionsFailed++;

      await persistSchedule(
        schedule
      );

      await persistExecution(
        execution
      );

      await createAlert(
        schedule.id,
        "execution_failed",
        "critical",
        error.message
      );

      throw error;
    }
  }

  async function completeSchedule(
    scheduleId
  ) {
    const schedule =
      state.schedules.get(
        scheduleId
      );

    if (!schedule) {
      throw new Error(
        "Schedule not found"
      );
    }

    const executions =
      Array.from(
        state.executions.values()
      )
      .filter(
        execution =>
          execution.scheduleId ===
          scheduleId
      )
      .sort(
        (a, b) =>
          new Date(b.startedAt) -
          new Date(a.startedAt)
      );

    const execution =
      executions[0];

    if (
      execution &&
      execution.status ===
        "running"
    ) {
      if (
        execution.broadcastId &&
        liveBroadcastEngine
      ) {
        try {
          await liveBroadcastEngine
            .stopBroadcast(
              execution.broadcastId,
              {
                reason:
                  "schedule_completed"
              }
            );

          state.statistics
            .automaticStops++;
        } catch (error) {
          logger.warn(
            "[CODE89] Stop error:",
            error.message
          );
        }
      }

      execution.status =
        "completed";

      execution.completedAt =
        now();

      await persistExecution(
        execution
      );

      state.statistics
        .executionsCompleted++;
    }

    schedule.status =
      "completed";

    await persistSchedule(
      schedule
    );

    emit(
      "broadcast.schedule.completed",
      {
        scheduleId
      }
    );

    return clone(schedule);
  }

  /* ============================================================
     PERSISTENCE
  ============================================================ */

  async function persistSchedule(
    schedule
  ) {
    await query(
      `
      UPDATE ez_broadcast_schedules
      SET
        status=$1,
        metadata=$2,
        updated_at=$3
      WHERE id=$4
      `,
      [
        schedule.status,
        JSON.stringify(
          schedule.metadata
        ),
        schedule.updatedAt ||
          now(),
        schedule.id
      ]
    );
  }

  async function persistExecution(
    execution
  ) {
    await query(
      `
      UPDATE ez_broadcast_schedule_executions
      SET
        status=$1,
        completed_at=$2,
        error=$3,
        metadata=$4
      WHERE id=$5
      `,
      [
        execution.status,
        execution.completedAt,
        execution.error,
        JSON.stringify(
          execution.metadata
        ),
        execution.id
      ]
    );
  }

  /* ============================================================
     ALERTS
  ============================================================ */

  async function createAlert(
    scheduleId,
    alertType,
    severity,
    message,
    metadata = {}
  ) {
    const alert = {
      id:
        id("schedule_alert"),

      scheduleId:
        scheduleId || null,

      alertType,

      severity:
        severity || "info",

      message:
        message || "",

      metadata,

      createdAt:
        now()
    };

    state.alerts.set(
      alert.id,
      alert
    );

    await query(
      `
      INSERT INTO ez_broadcast_schedule_alerts
      (
        id,
        schedule_id,
        alert_type,
        severity,
        message,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        alert.id,
        alert.scheduleId,
        alert.alertType,
        alert.severity,
        alert.message,
        JSON.stringify(
          alert.metadata
        ),
        alert.createdAt
      ]
    );

    emit(
      "broadcast.schedule.alert",
      clone(alert)
    );

    return alert;
  }

  function getAlerts() {
    return Array.from(
      state.alerts.values()
    )
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )
      .map(clone);
  }

  /* ============================================================
     SCHEDULER LOOP
  ============================================================ */

  async function processSchedules() {
    state.statistics
      .schedulerRuns++;

    const current =
      Date.now();

    const schedules =
      Array.from(
        state.schedules.values()
      );

    for (
      const schedule
      of schedules
    ) {
      if (
        schedule.status !==
        "scheduled"
      ) {
        continue;
      }

      const start =
        new Date(
          schedule.startAt
        ).getTime();

      if (
        start > current
      ) {
        continue;
      }

      try {
        await executeSchedule(
          schedule.id
        );

      } catch (error) {
        await createAlert(
          schedule.id,
          "scheduler_execution_error",
          "critical",
          error.message
        );
      }
    }

    /*
     * إكمال البرامج المنتهية.
     */

    for (
      const schedule
      of schedules
    ) {
      if (
        schedule.status !==
        "running"
      ) {
        continue;
      }

      if (!schedule.endAt) {
        continue;
      }

      const end =
        new Date(
          schedule.endAt
        ).getTime();

      if (
        end <= current
      ) {
        try {
          await completeSchedule(
            schedule.id
          );
        } catch (error) {
          logger.warn(
            "[CODE89] Completion:",
            error.message
          );
        }
      }
    }

    return {
      processedAt:
        now(),

      schedulesChecked:
        schedules.length
    };
  }

  function start() {
    if (state.running) {
      return getStatus();
    }

    state.running =
      true;

    state.timer =
      setInterval(
        () => {
          processSchedules()
            .catch(
              error =>
                logger.error(
                  "[CODE89] Scheduler:",
                  error.message
                )
            );
        },
        schedulerIntervalMs
      );

    emit(
      "broadcast.scheduler.started",
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

    if (state.timer) {
      clearInterval(
        state.timer
      );

      state.timer =
        null;
    }

    emit(
      "broadcast.scheduler.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     AI PLANNING
  ============================================================ */

  async function analyzeSchedule(
    input = {}
  ) {
    if (!aiOrchestrator) {
      return {
        available: false,

        reason:
          "AI Orchestrator is not configured"
      };
    }

    if (
      typeof aiOrchestrator.process !==
      "function"
    ) {
      return {
        available: false,

        reason:
          "AI Orchestrator does not expose process()"
      };
    }

    return aiOrchestrator.process({
      operation:
        "analyze-broadcast-schedule",

      input,

      metadata: {
        source:
          "CODE89"
      }
    });
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalPrograms:
        state.programs.size,

      totalSchedules:
        state.schedules.size,

      activeSchedules:
        Array.from(
          state.schedules.values()
        )
        .filter(
          schedule =>
            schedule.status ===
            "running"
        ).length,

      scheduledSchedules:
        Array.from(
          state.schedules.values()
        )
        .filter(
          schedule =>
            schedule.status ===
            "scheduled"
        ).length
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Broadcast Scheduler & Program Grid",

      code:
        "CODE 89",

      initialized:
        state.initialized,

      running:
        state.running,

      timezone:
        defaultTimezone,

      components: {
        liveBroadcast:
          Boolean(
            liveBroadcastEngine
          ),

        workflow:
          Boolean(
            workflowEngine
          ),

        automation:
          Boolean(
            automationEngine
          ),

        dam:
          Boolean(
            damEngine
          ),

        video:
          Boolean(
            videoEngine
          ),

        ai:
          Boolean(
            aiCore ||
            aiOrchestrator
          )
      },

      statistics:
        getStatistics()
    };
  }

  return {
    initialize,
    start,
    stop,

    getStatus,
    getStatistics,

    createChannel,
    getChannels,

    createProgram,
    getProgram,
    getPrograms,

    createSchedule,
    getSchedules,

    detectConflicts,

    executeSchedule,
    completeSchedule,

    processSchedules,

    createAlert,
    getAlerts,

    analyzeSchedule
  };
}

module.exports = {
  createIntelligentBroadcastScheduler
};
