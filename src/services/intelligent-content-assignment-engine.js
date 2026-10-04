"use strict";

const crypto = require("crypto");

function createIntelligentContentAssignmentEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    editorialEngine = null,
    workflowEngine = null,
    automationEngine = null,
    crmEngine = null,
    communicationEngine = null,
    supportEngine = null,
    broadcastScheduler = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxTasks = Number(
      process.env.CONTENT_ASSIGNMENT_MAX_TASKS || 100000
    ),

    maxAssignees = Number(
      process.env.CONTENT_ASSIGNMENT_MAX_ASSIGNEES || 10000
    ),

    defaultDeadlineMinutes = Number(
      process.env.CONTENT_ASSIGNMENT_DEFAULT_DEADLINE_MINUTES || 120
    ),

    overdueCheckIntervalMs = Number(
      process.env.CONTENT_ASSIGNMENT_OVERDUE_INTERVAL_MS || 30000
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    tasks: new Map(),
    assignees: new Map(),
    assignments: new Map(),
    comments: new Map(),
    alerts: new Map(),

    timer: null,

    statistics: {
      tasksCreated: 0,
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksCancelled: 0,
      tasksOverdue: 0,
      tasksReassigned: 0,
      aiAssignments: 0,
      alertsCreated: 0
    }
  };

  function now() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    return (
      `${prefix}_${Date.now()}_` +
      crypto.randomBytes(8).toString("hex")
    );
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
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

    return persistence.query(sql, values);
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
        "[CODE90] Event error:",
        error.message
      );
    }
  }

  /*
   * ============================================================
   * DATABASE
   * ============================================================
   */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_assignment_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        task_type TEXT DEFAULT 'content',
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        source_type TEXT,
        source_id TEXT,
        story_id TEXT,
        program_id TEXT,
        channel_id TEXT,
        assigned_to TEXT,
        created_by TEXT,
        due_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb,
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_assignment_assignees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'editor',
        capabilities JSONB DEFAULT '[]'::jsonb,
        availability JSONB DEFAULT '{}'::jsonb,
        workload INTEGER DEFAULT 0,
        max_workload INTEGER DEFAULT 10,
        active BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_assignment_history (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        from_value JSONB DEFAULT '{}'::jsonb,
        to_value JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_assignment_comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        author_id TEXT,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_content_assignment_alerts (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_assignment_task_status
      ON ez_content_assignment_tasks(status)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_assignment_task_due
      ON ez_content_assignment_tasks(due_at)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_assignment_task_assignee
      ON ez_content_assignment_tasks(assigned_to)
    `);
  }

  /*
   * ============================================================
   * INITIALIZATION
   * ============================================================
   */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "content.assignment.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /*
   * ============================================================
   * ASSIGNEES
   * ============================================================
   */

  async function createAssignee(input = {}) {
    if (
      state.assignees.size >= maxAssignees
    ) {
      throw new Error(
        "Maximum assignees reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Assignee name is required"
      );
    }

    const assignee = {
      id: makeId("assignee"),

      name: String(input.name)
        .trim()
        .slice(0, 255),

      role:
        input.role ||
        "editor",

      capabilities:
        Array.isArray(input.capabilities)
          ? input.capabilities
          : [],

      availability:
        input.availability ||
        {},

      workload:
        Number(input.workload || 0),

      maxWorkload:
        Number(input.maxWorkload || 10),

      active:
        input.active !== false,

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.assignees.set(
      assignee.id,
      assignee
    );

    await query(
      `
      INSERT INTO ez_content_assignment_assignees
      (
        id,
        name,
        role,
        capabilities,
        availability,
        workload,
        max_workload,
        active,
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
        assignee.id,
        assignee.name,
        assignee.role,
        JSON.stringify(
          assignee.capabilities
        ),
        JSON.stringify(
          assignee.availability
        ),
        assignee.workload,
        assignee.maxWorkload,
        assignee.active,
        JSON.stringify(
          assignee.metadata
        ),
        assignee.createdAt,
        assignee.updatedAt
      ]
    );

    return clone(assignee);
  }

  function getAssignees() {
    return Array.from(
      state.assignees.values()
    ).map(clone);
  }

  /*
   * ============================================================
   * TASK CREATION
   * ============================================================
   */

  async function createTask(input = {}) {
    if (
      state.tasks.size >= maxTasks
    ) {
      throw new Error(
        "Maximum content tasks reached"
      );
    }

    if (!input.title) {
      throw new Error(
        "Task title is required"
      );
    }

    const createdAt =
      new Date();

    let dueAt;

    if (input.dueAt) {
      dueAt =
        new Date(
          input.dueAt
        );

      if (
        Number.isNaN(
          dueAt.getTime()
        )
      ) {
        throw new Error(
          "Invalid dueAt"
        );
      }
    } else {
      dueAt =
        new Date(
          createdAt.getTime() +
          defaultDeadlineMinutes *
            60000
        );
    }

    const task = {
      id: makeId("content_task"),

      title:
        String(input.title)
          .trim()
          .slice(0, 500),

      description:
        input.description ||
        "",

      taskType:
        input.taskType ||
        "content",

      priority:
        input.priority ||
        "medium",

      status:
        "pending",

      sourceType:
        input.sourceType ||
        null,

      sourceId:
        input.sourceId ||
        null,

      storyId:
        input.storyId ||
        null,

      programId:
        input.programId ||
        null,

      channelId:
        input.channelId ||
        null,

      assignedTo:
        input.assignedTo ||
        null,

      createdBy:
        input.createdBy ||
        null,

      dueAt:
        dueAt.toISOString(),

      startedAt:
        null,

      completedAt:
        null,

      metadata:
        input.metadata || {},

      aiAnalysis:
        {},

      createdAt:
        createdAt.toISOString(),

      updatedAt:
        now()
    };

    state.tasks.set(
      task.id,
      task
    );

    state.statistics
      .tasksCreated++;

    await query(
      `
      INSERT INTO ez_content_assignment_tasks
      (
        id,
        title,
        description,
        task_type,
        priority,
        status,
        source_type,
        source_id,
        story_id,
        program_id,
        channel_id,
        assigned_to,
        created_by,
        due_at,
        metadata,
        ai_analysis,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18
      )
      `,
      [
        task.id,
        task.title,
        task.description,
        task.taskType,
        task.priority,
        task.status,
        task.sourceType,
        task.sourceId,
        task.storyId,
        task.programId,
        task.channelId,
        task.assignedTo,
        task.createdBy,
        task.dueAt,
        JSON.stringify(
          task.metadata
        ),
        JSON.stringify(
          task.aiAnalysis
        ),
        task.createdAt,
        task.updatedAt
      ]
    );

    await recordHistory(
      task.id,
      "created",
      task.createdBy,
      {},
      task
    );

    emit(
      "content.assignment.task.created",
      {
        taskId: task.id
      }
    );

    return clone(task);
  }

  function getTask(taskId) {
    const task =
      state.tasks.get(taskId);

    return task
      ? clone(task)
      : null;
  }

  function getTasks(filters = {}) {
    let tasks =
      Array.from(
        state.tasks.values()
      );

    if (filters.status) {
      tasks =
        tasks.filter(
          task =>
            task.status ===
            filters.status
        );
    }

    if (filters.priority) {
      tasks =
        tasks.filter(
          task =>
            task.priority ===
            filters.priority
        );
    }

    if (filters.assignedTo) {
      tasks =
        tasks.filter(
          task =>
            task.assignedTo ===
            filters.assignedTo
        );
    }

    if (filters.taskType) {
      tasks =
        tasks.filter(
          task =>
            task.taskType ===
            filters.taskType
        );
    }

    return tasks
      .sort(
        (a, b) =>
          new Date(a.dueAt) -
          new Date(b.dueAt)
      )
      .map(clone);
  }

  /*
   * ============================================================
   * AI ASSIGNMENT
   * ============================================================
   */

  async function analyzeTask(taskId) {
    const task =
      state.tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    const available =
      getAvailableAssignees();

    let aiResult = null;

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        aiResult =
          await aiOrchestrator.process({
            operation:
              "assign-content-task",

            input: {
              task,
              assignees:
                available
            },

            metadata: {
              source:
                "CODE90"
            }
          });
      } catch (error) {
        logger.warn(
          "[CODE90] AI assignment:",
          error.message
        );
      }
    }

    const recommendation =
      calculateAssignment(
        task,
        available
      );

    task.aiAnalysis = {
      analyzedAt: now(),

      provider:
        aiResult
          ? "ai-orchestrator"
          : "local-ranking",

      result:
        aiResult || null,

      recommendation
    };

    task.updatedAt =
      now();

    await persistTask(task);

    return clone(
      task.aiAnalysis
    );
  }

  function calculateAssignment(
    task,
    assignees
  ) {
    const ranked =
      assignees
        .map(assignee => {

          const capabilityScore =
            capabilityMatch(
              task,
              assignee
            );

          const workloadScore =
            workloadMatch(
              assignee
            );

          const priorityScore =
            priorityMatch(
              task,
              assignee
            );

          const total =
            (
              capabilityScore *
                0.5
            ) +
            (
              workloadScore *
                0.3
            ) +
            (
              priorityScore *
                0.2
            );

          return {
            assigneeId:
              assignee.id,

            name:
              assignee.name,

            role:
              assignee.role,

            score:
              Math.round(
                total * 100
              ) / 100,

            capabilityScore,

            workloadScore,

            priorityScore
          };
        })
        .sort(
          (a, b) =>
            b.score -
            a.score
        );

    return {
      recommended:
        ranked[0] ||
        null,

      candidates:
        ranked.slice(0, 10)
    };
  }

  function capabilityMatch(
    task,
    assignee
  ) {
    if (
      !assignee.capabilities
        ?.length
    ) {
      return 0.5;
    }

    const taskCapability =
      task.metadata?.requiredCapability ||
      task.taskType;

    return assignee.capabilities
      .map(
        value =>
          String(value)
            .toLowerCase()
      )
      .includes(
        String(taskCapability)
          .toLowerCase()
      )
      ? 1
      : 0.4;
  }

  function workloadMatch(
    assignee
  ) {
    if (
      !assignee.active
    ) {
      return 0;
    }

    if (
      assignee.workload >=
      assignee.maxWorkload
    ) {
      return 0;
    }

    return Math.max(
      0,
      1 -
        (
          assignee.workload /
          Math.max(
            1,
            assignee.maxWorkload
          )
        )
    );
  }

  function priorityMatch(
    task,
    assignee
  ) {
    if (
      task.priority ===
      "critical"
    ) {
      return assignee.role ===
        "editor" ||
        assignee.role ===
        "producer"
        ? 1
        : 0.5;
    }

    return 1;
  }

  function getAvailableAssignees() {
    return getAssignees()
      .filter(
        assignee =>
          assignee.active &&
          assignee.workload <
            assignee.maxWorkload
      );
  }

  /*
   * ============================================================
   * ASSIGNMENT
   * ============================================================
   */

  async function assignTask(
    taskId,
    assigneeId,
    actorId = null
  ) {
    const task =
      state.tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    const assignee =
      state.assignees.get(
        assigneeId
      );

    if (!assignee) {
      throw new Error(
        "Assignee not found"
      );
    }

    if (!assignee.active) {
      throw new Error(
        "Assignee is inactive"
      );
    }

    if (
      assignee.workload >=
      assignee.maxWorkload
    ) {
      throw new Error(
        "Assignee workload limit reached"
      );
    }

    const previous =
      task.assignedTo;

    task.assignedTo =
      assignee.id;

    task.status =
      task.status ===
      "pending"
        ? "assigned"
        : task.status;

    task.updatedAt =
      now();

    assignee.workload++;

    await persistTask(task);
    await persistAssignee(
      assignee
    );

    await recordHistory(
      task.id,
      "assigned",
      actorId,
      {
        assignedTo:
          previous
      },
      {
        assignedTo:
          assignee.id
      }
    );

    state.statistics
      .tasksAssigned++;

    if (previous) {
      state.statistics
        .tasksReassigned++;
    }

    emit(
      "content.assignment.task.assigned",
      {
        taskId,
        assigneeId
      }
    );

    return clone(task);
  }

  async function autoAssignTask(
    taskId,
    actorId = "system"
  ) {
    const analysis =
      await analyzeTask(
        taskId
      );

    const recommendation =
      analysis
        ?.recommendation
        ?.recommended;

    if (
      !recommendation
        ?.assigneeId
    ) {
      throw new Error(
        "No suitable assignee found"
      );
    }

    state.statistics
      .aiAssignments++;

    return assignTask(
      taskId,
      recommendation.assigneeId,
      actorId
    );
  }

  /*
   * ============================================================
   * TASK LIFECYCLE
   * ============================================================
   */

  async function startTask(
    taskId,
    actorId = null
  ) {
    const task =
      state.tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    if (
      !task.assignedTo
    ) {
      throw new Error(
        "Task must be assigned first"
      );
    }

    task.status =
      "in_progress";

    task.startedAt =
      task.startedAt ||
      now();

    task.updatedAt =
      now();

    await persistTask(task);

    await recordHistory(
      task.id,
      "started",
      actorId
    );

    emit(
      "content.assignment.task.started",
      {
        taskId
      }
    );

    return clone(task);
  }

  async function completeTask(
    taskId,
    actorId = null,
    result = {}
  ) {
    const task =
      state.tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    task.status =
      "completed";

    task.completedAt =
      now();

    task.updatedAt =
      now();

    task.metadata = {
      ...task.metadata,

      result
    };

    if (task.assignedTo) {
      const assignee =
        state.assignees.get(
          task.assignedTo
        );

      if (assignee) {
        assignee.workload =
          Math.max(
            0,
            assignee.workload - 1
          );

        await persistAssignee(
          assignee
        );
      }
    }

    await persistTask(task);

    await recordHistory(
      task.id,
      "completed",
      actorId,
      {},
      result
    );

    state.statistics
      .tasksCompleted++;

    emit(
      "content.assignment.task.completed",
      {
        taskId
      }
    );

    return clone(task);
  }

  async function cancelTask(
    taskId,
    actorId = null,
    reason = ""
  ) {
    const task =
      state.tasks.get(taskId);

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    if (task.assignedTo) {
      const assignee =
        state.assignees.get(
          task.assignedTo
        );

      if (assignee) {
        assignee.workload =
          Math.max(
            0,
            assignee.workload - 1
          );

        await persistAssignee(
          assignee
        );
      }
    }

    task.status =
      "cancelled";

    task.updatedAt =
      now();

    task.metadata = {
      ...task.metadata,

      cancellationReason:
        reason
    };

    await persistTask(task);

    await recordHistory(
      task.id,
      "cancelled",
      actorId,
      {},
      {
        reason
      }
    );

    state.statistics
      .tasksCancelled++;

    return clone(task);
  }

  /*
   * ============================================================
   * OVERDUE MONITOR
   * ============================================================
   */

  async function checkOverdueTasks() {
    const current =
      Date.now();

    for (
      const task
      of state.tasks.values()
    ) {
      if (
        [
          "completed",
          "cancelled"
        ].includes(
          task.status
        )
      ) {
        continue;
      }

      const due =
        new Date(
          task.dueAt
        ).getTime();

      if (
        due >= current
      ) {
        continue;
      }

      if (
        task.status !==
        "overdue"
      ) {
        task.status =
          "overdue";

        task.updatedAt =
          now();

        await persistTask(
          task
        );

        state.statistics
          .tasksOverdue++;

        await createAlert(
          task.id,
          "task_overdue",
          task.priority ===
            "critical"
            ? "critical"
            : "warning",
          `تجاوزت المهمة موعدها: ${task.title}`
        );

        emit(
          "content.assignment.task.overdue",
          {
            taskId:
              task.id
          }
        );
      }
    }

    return {
      checkedAt:
        now()
    };
  }

  /*
   * ============================================================
   * COMMENTS
   * ============================================================
   */

  async function addComment(
    taskId,
    message,
    authorId = null
  ) {
    if (
      !state.tasks.has(
        taskId
      )
    ) {
      throw new Error(
        "Task not found"
      );
    }

    if (!message) {
      throw new Error(
        "Comment message is required"
      );
    }

    const comment = {
      id:
        makeId("comment"),

      taskId,

      authorId,

      message:
        String(message)
          .slice(0, 10000),

      metadata: {},

      createdAt:
        now()
    };

    state.comments.set(
      comment.id,
      comment
    );

    await query(
      `
      INSERT INTO ez_content_assignment_comments
      (
        id,
        task_id,
        author_id,
        message,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        comment.id,
        comment.taskId,
        comment.authorId,
        comment.message,
        JSON.stringify(
          comment.metadata
        ),
        comment.createdAt
      ]
    );

    return clone(comment);
  }

  function getComments(taskId) {
    return Array.from(
      state.comments.values()
    )
      .filter(
        comment =>
          comment.taskId ===
          taskId
      )
      .map(clone);
  }

  /*
   * ============================================================
   * ALERTS
   * ============================================================
   */

  async function createAlert(
    taskId,
    type,
    severity,
    message,
    metadata = {}
  ) {
    const alert = {
      id:
        makeId("assignment_alert"),

      taskId:
        taskId || null,

      type,

      severity:
        severity || "info",

      message,

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
      INSERT INTO ez_content_assignment_alerts
      (
        id,
        task_id,
        type,
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
        alert.taskId,
        alert.type,
        alert.severity,
        alert.message,
        JSON.stringify(
          alert.metadata
        ),
        alert.createdAt
      ]
    );

    state.statistics
      .alertsCreated++;

    return clone(alert);
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

  /*
   * ============================================================
   * PERSISTENCE HELPERS
   * ============================================================
   */

  async function persistTask(task) {
    await query(
      `
      UPDATE ez_content_assignment_tasks
      SET
        assigned_to=$1,
        status=$2,
        started_at=$3,
        completed_at=$4,
        metadata=$5,
        ai_analysis=$6,
        updated_at=$7
      WHERE id=$8
      `,
      [
        task.assignedTo,
        task.status,
        task.startedAt,
        task.completedAt,
        JSON.stringify(
          task.metadata
        ),
        JSON.stringify(
          task.aiAnalysis
        ),
        task.updatedAt,
        task.id
      ]
    );
  }

  async function persistAssignee(
    assignee
  ) {
    await query(
      `
      UPDATE ez_content_assignment_assignees
      SET
        workload=$1,
        availability=$2,
        updated_at=$3
      WHERE id=$4
      `,
      [
        assignee.workload,
        JSON.stringify(
          assignee.availability
        ),
        now(),
        assignee.id
      ]
    );
  }

  async function recordHistory(
    taskId,
    action,
    actorId = null,
    fromValue = {},
    toValue = {},
    metadata = {}
  ) {
    await query(
      `
      INSERT INTO ez_content_assignment_history
      (
        id,
        task_id,
        action,
        actor_id,
        from_value,
        to_value,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        makeId("assignment_history"),
        taskId,
        action,
        actorId,
        JSON.stringify(
          fromValue
        ),
        JSON.stringify(
          toValue
        ),
        JSON.stringify(
          metadata
        ),
        now()
      ]
    );
  }

  /*
   * ============================================================
   * CONTENT → TASK
   * ============================================================
   */

  async function createFromStory(
    story,
    options = {}
  ) {
    if (!story) {
      throw new Error(
        "Story is required"
      );
    }

    const priority =
      story.priority ||
      (
        story.breaking
          ? "critical"
          : "medium"
      );

    return createTask({
      title:
        options.title ||
        story.title ||
        "مهمة تحريرية",

      description:
        options.description ||
        story.summary ||
        "",

      taskType:
        options.taskType ||
        "editorial",

      priority,

      sourceType:
        "editorial-story",

      sourceId:
        story.id ||
        null,

      storyId:
        story.id ||
        null,

      channelId:
        options.channelId ||
        null,

      dueAt:
        options.dueAt ||
        null,

      metadata: {
        storyTitle:
          story.title,

        requiredCapability:
          options.requiredCapability ||
          "editorial",

        source:
          "CODE72"
      }
    });
  }

  async function createFromBreakingNews(
    news,
    options = {}
  ) {
    if (!news) {
      throw new Error(
        "News is required"
      );
    }

    return createTask({
      title:
        options.title ||
        `خبر عاجل: ${
          news.title ||
          "خبر جديد"
        }`,

      description:
        news.summary ||
        news.description ||
        "",

      taskType:
        "breaking-news",

      priority:
        "critical",

      sourceType:
        "breaking-news",

      sourceId:
        news.id ||
        null,

      storyId:
        news.storyId ||
        null,

      dueAt:
        options.dueAt ||
        new Date(
          Date.now() +
          30 * 60000
        ).toISOString(),

      metadata: {
        requiredCapability:
          "breaking-news",

        source:
          "CODE65"
      }
    });
  }

  /*
   * ============================================================
   * START / STOP
   * ============================================================
   */

  function start() {
    if (state.running) {
      return getStatus();
    }

    state.running =
      true;

    state.timer =
      setInterval(
        () => {
          checkOverdueTasks()
            .catch(
              error =>
                logger.error(
                  "[CODE90] Overdue:",
                  error.message
                )
            );
        },
        overdueCheckIntervalMs
      );

    emit(
      "content.assignment.started",
      {
        timestamp: now()
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
      "content.assignment.stopped",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /*
   * ============================================================
   * DASHBOARD / STATUS
   * ============================================================
   */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalTasks:
        state.tasks.size,

      pendingTasks:
        Array.from(
          state.tasks.values()
        ).filter(
          task =>
            task.status ===
            "pending"
        ).length,

      assignedTasks:
        Array.from(
          state.tasks.values()
        ).filter(
          task =>
            task.status ===
            "assigned"
        ).length,

      inProgressTasks:
        Array.from(
          state.tasks.values()
        ).filter(
          task =>
            task.status ===
            "in_progress"
        ).length,

      overdueTasks:
        Array.from(
          state.tasks.values()
        ).filter(
          task =>
            task.status ===
            "overdue"
        ).length
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent News & Content Assignment Engine",

      code:
        "CODE90",

      initialized:
        state.initialized,

      running:
        state.running,

      components: {
        ai:
          Boolean(
            aiCore ||
            aiOrchestrator
          ),

        editorial:
          Boolean(
            editorialEngine
          ),

        workflow:
          Boolean(
            workflowEngine
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

        support:
          Boolean(
            supportEngine
          ),

        broadcastScheduler:
          Boolean(
            broadcastScheduler
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

    createAssignee,
    getAssignees,

    createTask,
    getTask,
    getTasks,

    analyzeTask,
    assignTask,
    autoAssignTask,

    startTask,
    completeTask,
    cancelTask,

    checkOverdueTasks,

    addComment,
    getComments,

    createAlert,
    getAlerts,

    createFromStory,
    createFromBreakingNews
  };
}

module.exports = {
  createIntelligentContentAssignmentEngine
};
