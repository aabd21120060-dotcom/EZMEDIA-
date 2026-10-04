"use strict";

const crypto = require("crypto");

function createIntelligentEditorialWorkforceEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    assignmentEngine = null,
    workflowEngine = null,
    crmEngine = null,
    communicationEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxEmployees =
      Number(
        process.env.WORKFORCE_MAX_EMPLOYEES ||
        10000
      ),

    maxTeams =
      Number(
        process.env.WORKFORCE_MAX_TEAMS ||
        1000
      ),

    maxDepartments =
      Number(
        process.env.WORKFORCE_MAX_DEPARTMENTS ||
        500
      ),

    maxShifts =
      Number(
        process.env.WORKFORCE_MAX_SHIFTS ||
        100000
      ),

    performanceWindowDays =
      Number(
        process.env.WORKFORCE_PERFORMANCE_WINDOW_DAYS ||
        30
      ),

    workloadCheckIntervalMs =
      Number(
        process.env.WORKFORCE_WORKLOAD_INTERVAL_MS ||
        60000
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    employees: new Map(),
    teams: new Map(),
    departments: new Map(),
    shifts: new Map(),
    leaves: new Map(),
    skills: new Map(),
    performance: new Map(),
    workload: new Map(),
    alerts: new Map(),

    timer: null,

    statistics: {
      employeesCreated: 0,
      teamsCreated: 0,
      departmentsCreated: 0,
      shiftsCreated: 0,
      leavesCreated: 0,
      assignmentsAnalyzed: 0,
      workloadAlerts: 0,
      availabilityChecks: 0,
      performanceReviews: 0
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
        "[CODE91] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_workforce_employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'editor',
        department_id TEXT,
        team_id TEXT,
        status TEXT DEFAULT 'active',
        skills JSONB DEFAULT '[]'::jsonb,
        availability JSONB DEFAULT '{}'::jsonb,
        workload_limit INTEGER DEFAULT 10,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_workforce_departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        manager_id TEXT,
        active BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_workforce_teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department_id TEXT,
        manager_id TEXT,
        type TEXT DEFAULT 'editorial',
        active BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_workforce_shifts (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        team_id TEXT,
        department_id TEXT,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        shift_type TEXT DEFAULT 'regular',
        status TEXT DEFAULT 'scheduled',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_workforce_leaves (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        leave_type TEXT DEFAULT 'leave',
        status TEXT DEFAULT 'approved',
        reason TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_workforce_performance (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        tasks_completed INTEGER DEFAULT 0,
        tasks_overdue INTEGER DEFAULT 0,
        tasks_cancelled INTEGER DEFAULT 0,
        quality_score NUMERIC DEFAULT 0,
        speed_score NUMERIC DEFAULT 0,
        reliability_score NUMERIC DEFAULT 0,
        overall_score NUMERIC DEFAULT 0,
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_workforce_alerts (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        team_id TEXT,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_workforce_employee_status
      ON ez_workforce_employees(status)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_workforce_shift_employee
      ON ez_workforce_shifts(employee_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_workforce_shift_start
      ON ez_workforce_shifts(start_at)
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
      "workforce.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     DEPARTMENTS
  ============================================================ */

  async function createDepartment(input = {}) {
    if (
      state.departments.size >=
      maxDepartments
    ) {
      throw new Error(
        "Maximum departments reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Department name is required"
      );
    }

    const department = {
      id: makeId("department"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      description:
        input.description ||
        "",

      managerId:
        input.managerId ||
        null,

      active:
        input.active !== false,

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.departments.set(
      department.id,
      department
    );

    state.statistics
      .departmentsCreated++;

    await query(
      `
      INSERT INTO ez_workforce_departments
      (
        id,
        name,
        description,
        manager_id,
        active,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        department.id,
        department.name,
        department.description,
        department.managerId,
        department.active,
        JSON.stringify(
          department.metadata
        ),
        department.createdAt,
        department.updatedAt
      ]
    );

    return clone(department);
  }

  function getDepartments() {
    return Array.from(
      state.departments.values()
    ).map(clone);
  }

  /* ============================================================
     TEAMS
  ============================================================ */

  async function createTeam(input = {}) {
    if (
      state.teams.size >=
      maxTeams
    ) {
      throw new Error(
        "Maximum teams reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Team name is required"
      );
    }

    const team = {
      id: makeId("team"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      departmentId:
        input.departmentId ||
        null,

      managerId:
        input.managerId ||
        null,

      type:
        input.type ||
        "editorial",

      active:
        input.active !== false,

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.teams.set(
      team.id,
      team
    );

    state.statistics
      .teamsCreated++;

    await query(
      `
      INSERT INTO ez_workforce_teams
      (
        id,
        name,
        department_id,
        manager_id,
        type,
        active,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        team.id,
        team.name,
        team.departmentId,
        team.managerId,
        team.type,
        team.active,
        JSON.stringify(
          team.metadata
        ),
        team.createdAt,
        team.updatedAt
      ]
    );

    return clone(team);
  }

  function getTeams() {
    return Array.from(
      state.teams.values()
    ).map(clone);
  }

  /* ============================================================
     EMPLOYEES
  ============================================================ */

  async function createEmployee(input = {}) {
    if (
      state.employees.size >=
      maxEmployees
    ) {
      throw new Error(
        "Maximum employees reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Employee name is required"
      );
    }

    const employee = {
      id: makeId("employee"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      email:
        input.email ||
        null,

      role:
        input.role ||
        "editor",

      departmentId:
        input.departmentId ||
        null,

      teamId:
        input.teamId ||
        null,

      status:
        input.status ||
        "active",

      skills:
        Array.isArray(input.skills)
          ? input.skills
          : [],

      availability:
        input.availability ||
        {
          timezone:
            "Asia/Riyadh",

          workingDays:
            [
              0,
              1,
              2,
              3,
              4
            ]
        },

      workloadLimit:
        Number(
          input.workloadLimit ||
          10
        ),

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.employees.set(
      employee.id,
      employee
    );

    state.workload.set(
      employee.id,
      {
        employeeId:
          employee.id,

        activeTasks: 0,

        scheduledTasks: 0,

        overdueTasks: 0,

        score: 100
      }
    );

    state.statistics
      .employeesCreated++;

    await query(
      `
      INSERT INTO ez_workforce_employees
      (
        id,
        name,
        email,
        role,
        department_id,
        team_id,
        status,
        skills,
        availability,
        workload_limit,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13
      )
      `,
      [
        employee.id,
        employee.name,
        employee.email,
        employee.role,
        employee.departmentId,
        employee.teamId,
        employee.status,
        JSON.stringify(
          employee.skills
        ),
        JSON.stringify(
          employee.availability
        ),
        employee.workloadLimit,
        JSON.stringify(
          employee.metadata
        ),
        employee.createdAt,
        employee.updatedAt
      ]
    );

    return clone(employee);
  }

  function getEmployees(filters = {}) {
    let employees =
      Array.from(
        state.employees.values()
      );

    if (filters.status) {
      employees =
        employees.filter(
          employee =>
            employee.status ===
            filters.status
        );
    }

    if (filters.role) {
      employees =
        employees.filter(
          employee =>
            employee.role ===
            filters.role
        );
    }

    if (filters.teamId) {
      employees =
        employees.filter(
          employee =>
            employee.teamId ===
            filters.teamId
        );
    }

    if (filters.departmentId) {
      employees =
        employees.filter(
          employee =>
            employee.departmentId ===
            filters.departmentId
        );
    }

    return employees.map(clone);
  }

  function getEmployee(
    employeeId
  ) {
    const employee =
      state.employees.get(
        employeeId
      );

    return employee
      ? clone(employee)
      : null;
  }

  /* ============================================================
     SHIFTS
  ============================================================ */

  async function createShift(input = {}) {
    if (
      state.shifts.size >=
      maxShifts
    ) {
      throw new Error(
        "Maximum shifts reached"
      );
    }

    if (
      !input.employeeId ||
      !input.startAt ||
      !input.endAt
    ) {
      throw new Error(
        "employeeId, startAt and endAt are required"
      );
    }

    const employee =
      state.employees.get(
        input.employeeId
      );

    if (!employee) {
      throw new Error(
        "Employee not found"
      );
    }

    const start =
      new Date(
        input.startAt
      );

    const end =
      new Date(
        input.endAt
      );

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      ) ||
      end <= start
    ) {
      throw new Error(
        "Invalid shift time"
      );
    }

    const conflict =
      findShiftConflict(
        employee.id,
        start,
        end
      );

    if (conflict) {
      throw new Error(
        "Employee already has a conflicting shift"
      );
    }

    const shift = {
      id:
        makeId("shift"),

      employeeId:
        employee.id,

      teamId:
        input.teamId ||
        employee.teamId ||
        null,

      departmentId:
        input.departmentId ||
        employee.departmentId ||
        null,

      startAt:
        start.toISOString(),

      endAt:
        end.toISOString(),

      shiftType:
        input.shiftType ||
        "regular",

      status:
        input.status ||
        "scheduled",

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.shifts.set(
      shift.id,
      shift
    );

    state.statistics
      .shiftsCreated++;

    await query(
      `
      INSERT INTO ez_workforce_shifts
      (
        id,
        employee_id,
        team_id,
        department_id,
        start_at,
        end_at,
        shift_type,
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
        shift.id,
        shift.employeeId,
        shift.teamId,
        shift.departmentId,
        shift.startAt,
        shift.endAt,
        shift.shiftType,
        shift.status,
        JSON.stringify(
          shift.metadata
        ),
        shift.createdAt,
        shift.updatedAt
      ]
    );

    return clone(shift);
  }

  function findShiftConflict(
    employeeId,
    start,
    end
  ) {
    for (
      const shift
      of state.shifts.values()
    ) {
      if (
        shift.employeeId !==
        employeeId
      ) {
        continue;
      }

      if (
        shift.status ===
        "cancelled"
      ) {
        continue;
      }

      const existingStart =
        new Date(
          shift.startAt
        );

      const existingEnd =
        new Date(
          shift.endAt
        );

      if (
        start < existingEnd &&
        end > existingStart
      ) {
        return shift;
      }
    }

    return null;
  }

  function getShifts(filters = {}) {
    let shifts =
      Array.from(
        state.shifts.values()
      );

    if (filters.employeeId) {
      shifts =
        shifts.filter(
          shift =>
            shift.employeeId ===
            filters.employeeId
        );
    }

    if (filters.teamId) {
      shifts =
        shifts.filter(
          shift =>
            shift.teamId ===
            filters.teamId
        );
    }

    return shifts
      .sort(
        (a, b) =>
          new Date(a.startAt) -
          new Date(b.startAt)
      )
      .map(clone);
  }

  /* ============================================================
     LEAVE
  ============================================================ */

  async function createLeave(
    input = {}
  ) {
    if (
      !input.employeeId ||
      !input.startAt ||
      !input.endAt
    ) {
      throw new Error(
        "employeeId, startAt and endAt are required"
      );
    }

    if (
      !state.employees.has(
        input.employeeId
      )
    ) {
      throw new Error(
        "Employee not found"
      );
    }

    const start =
      new Date(
        input.startAt
      );

    const end =
      new Date(
        input.endAt
      );

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      ) ||
      end <= start
    ) {
      throw new Error(
        "Invalid leave period"
      );
    }

    const leave = {
      id:
        makeId("leave"),

      employeeId:
        input.employeeId,

      startAt:
        start.toISOString(),

      endAt:
        end.toISOString(),

      leaveType:
        input.leaveType ||
        "leave",

      status:
        input.status ||
        "approved",

      reason:
        input.reason ||
        "",

      metadata:
        input.metadata || {},

      createdAt:
        now()
    };

    state.leaves.set(
      leave.id,
      leave
    );

    state.statistics
      .leavesCreated++;

    await query(
      `
      INSERT INTO ez_workforce_leaves
      (
        id,
        employee_id,
        start_at,
        end_at,
        leave_type,
        status,
        reason,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        leave.id,
        leave.employeeId,
        leave.startAt,
        leave.endAt,
        leave.leaveType,
        leave.status,
        leave.reason,
        JSON.stringify(
          leave.metadata
        ),
        leave.createdAt
      ]
    );

    return clone(leave);
  }

  function isEmployeeOnLeave(
    employeeId,
    at = new Date()
  ) {
    const time =
      new Date(at);

    for (
      const leave
      of state.leaves.values()
    ) {
      if (
        leave.employeeId !==
        employeeId
      ) {
        continue;
      }

      if (
        leave.status !==
        "approved"
      ) {
        continue;
      }

      const start =
        new Date(
          leave.startAt
        );

      const end =
        new Date(
          leave.endAt
        );

      if (
        time >= start &&
        time <= end
      ) {
        return true;
      }
    }

    return false;
  }

  /* ============================================================
     AVAILABILITY
  ============================================================ */

  function isEmployeeAvailable(
    employeeId,
    at = new Date()
  ) {
    state.statistics
      .availabilityChecks++;

    const employee =
      state.employees.get(
        employeeId
      );

    if (!employee) {
      return false;
    }

    if (
      employee.status !==
      "active"
    ) {
      return false;
    }

    const time =
      new Date(at);

    if (
      isEmployeeOnLeave(
        employeeId,
        time
      )
    ) {
      return false;
    }

    const availability =
      employee.availability ||
      {};

    const workingDays =
      Array.isArray(
        availability.workingDays
      )
        ? availability.workingDays
        : [
            0,
            1,
            2,
            3,
            4
          ];

    if (
      !workingDays.includes(
        time.getDay()
      )
    ) {
      return false;
    }

    return true;
  }

  /*
   * ============================================================
   * SKILLS
   * ============================================================
   */

  async function addSkill(
    employeeId,
    skill
  ) {
    const employee =
      state.employees.get(
        employeeId
      );

    if (!employee) {
      throw new Error(
        "Employee not found"
      );
    }

    if (!skill) {
      throw new Error(
        "Skill is required"
      );
    }

    const normalized =
      String(skill)
        .trim()
        .toLowerCase();

    if (
      !employee.skills.includes(
        normalized
      )
    ) {
      employee.skills.push(
        normalized
      );
    }

    employee.updatedAt =
      now();

    await query(
      `
      UPDATE ez_workforce_employees
      SET
        skills=$1,
        updated_at=$2
      WHERE id=$3
      `,
      [
        JSON.stringify(
          employee.skills
        ),
        employee.updatedAt,
        employee.id
      ]
    );

    return clone(employee);
  }

  /*
   * ============================================================
   * WORKLOAD
   * ============================================================
   */

  async function calculateWorkload(
    employeeId
  ) {
    const employee =
      state.employees.get(
        employeeId
      );

    if (!employee) {
      throw new Error(
        "Employee not found"
      );
    }

    let activeTasks = 0;
    let overdueTasks = 0;

    if (
      assignmentEngine &&
      typeof assignmentEngine
        .getTasks ===
        "function"
    ) {
      const tasks =
        assignmentEngine.getTasks({
          assignedTo:
            employeeId
        });

      for (
        const task
        of tasks
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

        activeTasks++;

        if (
          task.status ===
          "overdue"
        ) {
          overdueTasks++;
        }
      }
    }

    const score =
      Math.max(
        0,
        100 -
          (
            activeTasks /
            Math.max(
              1,
              employee.workloadLimit
            )
          ) *
            100
      );

    const result = {
      employeeId,

      activeTasks,

      scheduledTasks:
        0,

      overdueTasks,

      workloadLimit:
        employee.workloadLimit,

      utilization:
        Math.round(
          (
            activeTasks /
            Math.max(
              1,
              employee.workloadLimit
            )
          ) *
            100
        ),

      score:
        Math.round(
          score
        )
    };

    state.workload.set(
      employeeId,
      result
    );

    return clone(result);
  }

  async function calculateAllWorkloads() {
    for (
      const employee
      of state.employees.values()
    ) {
      try {
        await calculateWorkload(
          employee.id
        );
      } catch (error) {
        logger.warn(
          "[CODE91] Workload:",
          error.message
        );
      }
    }

    return getWorkload();
  }

  function getWorkload() {
    return Array.from(
      state.workload.values()
    ).map(clone);
  }

  /*
   * ============================================================
   * SMART RESOURCE MATCHING
   * ============================================================
   */

  async function recommendEmployees(
    input = {}
  ) {
    const employees =
      Array.from(
        state.employees.values()
      )
      .filter(
        employee =>
          employee.status ===
          "active"
      )
      .filter(
        employee =>
          !input.role ||
          employee.role ===
          input.role
      )
      .filter(
        employee =>
          !input.teamId ||
          employee.teamId ===
          input.teamId
      );

    const candidates =
      employees
        .map(employee => {

          const workload =
            state.workload.get(
              employee.id
            ) || {
              activeTasks: 0,
              score: 100
            };

          const requestedSkills =
            Array.isArray(
              input.skills
            )
              ? input.skills
              : [];

          const skillMatches =
            requestedSkills
              .filter(
                skill =>
                  employee.skills
                    .map(
                      value =>
                        String(value)
                          .toLowerCase()
                    )
                    .includes(
                      String(skill)
                        .toLowerCase()
                    )
              ).length;

          const skillScore =
            requestedSkills.length
              ? skillMatches /
                requestedSkills.length
              : 0.5;

          const availability =
            isEmployeeAvailable(
              employee.id,
              input.at
                ? new Date(input.at)
                : new Date()
            );

          const availabilityScore =
            availability
              ? 1
              : 0;

          const workloadScore =
            workload.score /
            100;

          const score =
            (
              skillScore *
              0.45
            ) +
            (
              availabilityScore *
              0.30
            ) +
            (
              workloadScore *
              0.25
            );

          return {
            employeeId:
              employee.id,

            name:
              employee.name,

            role:
              employee.role,

            score:
              Math.round(
                score * 100
              ) / 100,

            skillScore,
            availabilityScore,
            workloadScore,

            activeTasks:
              workload.activeTasks
          };
        })
        .sort(
          (a, b) =>
            b.score -
            a.score
        );

    state.statistics
      .assignmentsAnalyzed++;

    return {
      recommended:
        candidates[0] ||
        null,

      candidates:
        candidates.slice(
          0,
          20
        )
    };
  }

  /*
   * ============================================================
   * PERFORMANCE
   * ============================================================
   */

  async function calculatePerformance(
    employeeId,
    input = {}
  ) {
    const employee =
      state.employees.get(
        employeeId
      );

    if (!employee) {
      throw new Error(
        "Employee not found"
      );
    }

    const completed =
      Number(
        input.tasksCompleted ||
        0
      );

    const overdue =
      Number(
        input.tasksOverdue ||
        0
      );

    const cancelled =
      Number(
        input.tasksCancelled ||
        0
      );

    const quality =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            input.qualityScore ||
            0
          )
        )
      );

    const speed =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            input.speedScore ||
            0
          )
        )
      );

    const reliability =
      Math.max(
        0,
        Math.min(
          100,
          100 -
            (
              overdue *
              10
            ) -
            (
              cancelled *
              5
            )
        )
      );

    const completionScore =
      completed > 0
        ? Math.min(
            100,
            completed * 10
          )
        : 0;

    const overall =
      Math.round(
        (
          quality * 0.35 +
          speed * 0.20 +
          reliability * 0.25 +
          completionScore * 0.20
        ) * 100
      ) / 100;

    const performance = {
      id:
        makeId("performance"),

      employeeId,

      periodStart:
        input.periodStart ||
        new Date(
          Date.now() -
          performanceWindowDays *
            86400000
        ).toISOString(),

      periodEnd:
        input.periodEnd ||
        now(),

      tasksCompleted:
        completed,

      tasksOverdue:
        overdue,

      tasksCancelled:
        cancelled,

      qualityScore:
        quality,

      speedScore:
        speed,

      reliabilityScore:
        reliability,

      overallScore:
        overall,

      aiAnalysis:
        {},

      metadata:
        input.metadata || {},

      createdAt:
        now()
    };

    state.performance.set(
      employeeId,
      performance
    );

    state.statistics
      .performanceReviews++;

    await query(
      `
      INSERT INTO ez_workforce_performance
      (
        id,
        employee_id,
        period_start,
        period_end,
        tasks_completed,
        tasks_overdue,
        tasks_cancelled,
        quality_score,
        speed_score,
        reliability_score,
        overall_score,
        ai_analysis,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14
      )
      `,
      [
        performance.id,
        performance.employeeId,
        performance.periodStart,
        performance.periodEnd,
        performance.tasksCompleted,
        performance.tasksOverdue,
        performance.tasksCancelled,
        performance.qualityScore,
        performance.speedScore,
        performance.reliabilityScore,
        performance.overallScore,
        JSON.stringify(
          performance.aiAnalysis
        ),
        JSON.stringify(
          performance.metadata
        ),
        performance.createdAt
      ]
    );

    return clone(performance);
  }

  /*
   * ============================================================
   * AI WORKFORCE ANALYSIS
   * ============================================================
   */

  async function analyzeWorkforce(
    input = {}
  ) {
    const snapshot = {
      employees:
        getEmployees(),

      teams:
        getTeams(),

      departments:
        getDepartments(),

      workload:
        getWorkload(),

      input
    };

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      return aiOrchestrator.process({
        operation:
          "analyze-editorial-workforce",

        input:
          snapshot,

        metadata: {
          source:
            "CODE91"
        }
      });
    }

    if (
      aiCore &&
      typeof aiCore.fullAnalysis ===
        "function"
    ) {
      return aiCore.fullAnalysis(
        snapshot
      );
    }

    return {
      available: false,

      reason:
        "AI service is not configured",

      snapshot
    };
  }

  /*
   * ============================================================
   * ALERTS
   * ============================================================
   */

  async function createAlert(
    input = {}
  ) {
    const alert = {
      id:
        makeId("workforce_alert"),

      employeeId:
        input.employeeId ||
        null,

      teamId:
        input.teamId ||
        null,

      type:
        input.type ||
        "workforce",

      severity:
        input.severity ||
        "info",

      message:
        input.message ||
        "",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.alerts.set(
      alert.id,
      alert
    );

    state.statistics
      .workloadAlerts++;

    await query(
      `
      INSERT INTO ez_workforce_alerts
      (
        id,
        employee_id,
        team_id,
        type,
        severity,
        message,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        alert.id,
        alert.employeeId,
        alert.teamId,
        alert.type,
        alert.severity,
        alert.message,
        JSON.stringify(
          alert.metadata
        ),
        alert.createdAt
      ]
    );

    emit(
      "workforce.alert",
      clone(alert)
    );

    return clone(alert);
  }

  async function checkWorkforceHealth() {
    await calculateAllWorkloads();

    for (
      const workload
      of state.workload.values()
    ) {
      if (
        workload.utilization >=
        100
      ) {
        await createAlert({
          employeeId:
            workload.employeeId,

          type:
            "workload_capacity",

          severity:
            "critical",

          message:
            "وصل الموظف إلى الحد الأقصى من عبء العمل",

          metadata:
            workload
        });
      } else if (
        workload.utilization >=
        85
      ) {
        await createAlert({
          employeeId:
            workload.employeeId,

          type:
            "workload_high",

          severity:
            "warning",

          message:
            "عبء العمل مرتفع",

          metadata:
            workload
        });
      }
    }

    return getStatus();
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
   * DASHBOARD
   * ============================================================
   */

  function getDashboard() {
    const employees =
      Array.from(
        state.employees.values()
      );

    return {
      employees: {
        total:
          employees.length,

        active:
          employees.filter(
            employee =>
              employee.status ===
              "active"
          ).length,

        inactive:
          employees.filter(
            employee =>
              employee.status !==
              "active"
          ).length
      },

      teams: {
        total:
          state.teams.size,

        active:
          Array.from(
            state.teams.values()
          ).filter(
            team =>
              team.active
          ).length
      },

      departments: {
        total:
          state.departments.size,

        active:
          Array.from(
            state.departments.values()
          ).filter(
            department =>
              department.active
          ).length
      },

      workload:
        getWorkload(),

      shifts:
        state.shifts.size,

      leaves:
        state.leaves.size,

      alerts:
        getAlerts().slice(
          0,
          20
        ),

      statistics:
        getStatistics()
    };
  }

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      totalEmployees:
        state.employees.size,

      totalTeams:
        state.teams.size,

      totalDepartments:
        state.departments.size,

      totalShifts:
        state.shifts.size,

      totalLeaves:
        state.leaves.size
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Editorial Team & Workforce Management Engine",

      code:
        "CODE91",

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

        assignment:
          Boolean(
            assignmentEngine
          ),

        workflow:
          Boolean(
            workflowEngine
          ),

        crm:
          Boolean(
            crmEngine
          ),

        communication:
          Boolean(
            communicationEngine
          )
      },

      statistics:
        getStatistics()
    };
  }

  /* ============================================================
     START / STOP
  ============================================================ */

  function start() {
    if (state.running) {
      return getStatus();
    }

    state.running =
      true;

    state.timer =
      setInterval(
        () => {
          checkWorkforceHealth()
            .catch(
              error =>
                logger.error(
                  "[CODE91] Workforce:",
                  error.message
                )
            );
        },
        workloadCheckIntervalMs
      );

    emit(
      "workforce.started",
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
      "workforce.stopped",
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

    getStatus,
    getStatistics,
    getDashboard,

    createDepartment,
    getDepartments,

    createTeam,
    getTeams,

    createEmployee,
    getEmployee,
    getEmployees,

    createShift,
    getShifts,

    createLeave,
    isEmployeeOnLeave,

    isEmployeeAvailable,

    addSkill,

    calculateWorkload,
    calculateAllWorkloads,
    getWorkload,

    recommendEmployees,

    calculatePerformance,

    analyzeWorkforce,

    createAlert,
    getAlerts,

    checkWorkforceHealth
  };
}

module.exports = {
  createIntelligentEditorialWorkforceEngine
};
