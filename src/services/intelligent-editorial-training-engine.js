"use strict";

const crypto = require("crypto");

function createIntelligentEditorialTrainingEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    workforceEngine = null,
    assignmentEngine = null,
    workflowEngine = null,
    communicationEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxCourses =
      Number(
        process.env.TRAINING_MAX_COURSES || 5000
      ),

    maxPrograms =
      Number(
        process.env.TRAINING_MAX_PROGRAMS || 1000
      ),

    maxEnrollments =
      Number(
        process.env.TRAINING_MAX_ENROLLMENTS || 100000
      ),

    maxAssessments =
      Number(
        process.env.TRAINING_MAX_ASSESSMENTS || 500000
      ),

    maxLearningPlans =
      Number(
        process.env.TRAINING_MAX_LEARNING_PLANS || 100000
      ),

    progressCheckIntervalMs =
      Number(
        process.env.TRAINING_PROGRESS_INTERVAL_MS || 60000
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    courses: new Map(),
    programs: new Map(),
    enrollments: new Map(),
    assessments: new Map(),
    learningPlans: new Map(),
    certificates: new Map(),
    skillGaps: new Map(),
    alerts: new Map(),

    timer: null,

    statistics: {
      coursesCreated: 0,
      programsCreated: 0,
      enrollmentsCreated: 0,
      assessmentsCreated: 0,
      learningPlansCreated: 0,
      certificatesIssued: 0,
      skillGapAnalyses: 0,
      aiAnalyses: 0,
      alertsCreated: 0
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
        "[CODE92] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_courses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        level TEXT DEFAULT 'beginner',
        duration_minutes INTEGER DEFAULT 60,
        skills JSONB DEFAULT '[]'::jsonb,
        modules JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_programs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        course_ids JSONB DEFAULT '[]'::jsonb,
        target_roles JSONB DEFAULT '[]'::jsonb,
        target_skills JSONB DEFAULT '[]'::jsonb,
        duration_days INTEGER DEFAULT 30,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_enrollments (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        course_id TEXT,
        program_id TEXT,
        status TEXT DEFAULT 'enrolled',
        progress NUMERIC DEFAULT 0,
        score NUMERIC DEFAULT 0,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_assessments (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        course_id TEXT,
        skill TEXT,
        assessment_type TEXT DEFAULT 'skill',
        score NUMERIC DEFAULT 0,
        passed BOOLEAN DEFAULT FALSE,
        answers JSONB DEFAULT '{}'::jsonb,
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_learning_plans (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        goal TEXT,
        target_skills JSONB DEFAULT '[]'::jsonb,
        recommended_courses JSONB DEFAULT '[]'::jsonb,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'active',
        progress NUMERIC DEFAULT 0,
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_certificates (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        course_id TEXT,
        program_id TEXT,
        certificate_number TEXT UNIQUE,
        title TEXT,
        score NUMERIC DEFAULT 0,
        issued_at TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_skill_gaps (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        current_level NUMERIC DEFAULT 0,
        required_level NUMERIC DEFAULT 0,
        gap_score NUMERIC DEFAULT 0,
        priority TEXT DEFAULT 'medium',
        recommended_courses JSONB DEFAULT '[]'::jsonb,
        ai_analysis JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_training_alerts (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_training_enrollment_employee
      ON ez_training_enrollments(employee_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_training_skill_gap_employee
      ON ez_training_skill_gaps(employee_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_training_assessment_employee
      ON ez_training_assessments(employee_id)
    `);
  }

  /* ============================================================
     INITIALIZE
  ============================================================ */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "training.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     COURSES
  ============================================================ */

  async function createCourse(input = {}) {
    if (
      state.courses.size >=
      maxCourses
    ) {
      throw new Error(
        "Maximum courses reached"
      );
    }

    if (!input.title) {
      throw new Error(
        "Course title is required"
      );
    }

    const course = {
      id: id("course"),

      title:
        String(input.title)
          .trim()
          .slice(0, 255),

      description:
        input.description || "",

      category:
        input.category ||
        "media",

      level:
        input.level ||
        "beginner",

      durationMinutes:
        Number(
          input.durationMinutes ||
          60
        ),

      skills:
        Array.isArray(input.skills)
          ? input.skills
          : [],

      modules:
        Array.isArray(input.modules)
          ? input.modules
          : [],

      status:
        input.status ||
        "active",

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.courses.set(
      course.id,
      course
    );

    state.statistics
      .coursesCreated++;

    await query(
      `
      INSERT INTO ez_training_courses
      (
        id,
        title,
        description,
        category,
        level,
        duration_minutes,
        skills,
        modules,
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
        course.id,
        course.title,
        course.description,
        course.category,
        course.level,
        course.durationMinutes,
        JSON.stringify(course.skills),
        JSON.stringify(course.modules),
        course.status,
        JSON.stringify(course.metadata),
        course.createdAt,
        course.updatedAt
      ]
    );

    return clone(course);
  }

  function getCourses(filters = {}) {
    let courses =
      Array.from(
        state.courses.values()
      );

    if (filters.category) {
      courses =
        courses.filter(
          course =>
            course.category ===
            filters.category
        );
    }

    if (filters.level) {
      courses =
        courses.filter(
          course =>
            course.level ===
            filters.level
        );
    }

    if (filters.status) {
      courses =
        courses.filter(
          course =>
            course.status ===
            filters.status
        );
    }

    return courses.map(clone);
  }

  function getCourse(courseId) {
    const course =
      state.courses.get(
        courseId
      );

    return course
      ? clone(course)
      : null;
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

    const program = {
      id: id("program"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      description:
        input.description || "",

      courseIds:
        Array.isArray(
          input.courseIds
        )
          ? input.courseIds
          : [],

      targetRoles:
        Array.isArray(
          input.targetRoles
        )
          ? input.targetRoles
          : [],

      targetSkills:
        Array.isArray(
          input.targetSkills
        )
          ? input.targetSkills
          : [],

      durationDays:
        Number(
          input.durationDays ||
          30
        ),

      status:
        input.status ||
        "active",

      metadata:
        input.metadata || {},

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
      INSERT INTO ez_training_programs
      (
        id,
        name,
        description,
        course_ids,
        target_roles,
        target_skills,
        duration_days,
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
        program.id,
        program.name,
        program.description,
        JSON.stringify(
          program.courseIds
        ),
        JSON.stringify(
          program.targetRoles
        ),
        JSON.stringify(
          program.targetSkills
        ),
        program.durationDays,
        program.status,
        JSON.stringify(
          program.metadata
        ),
        program.createdAt,
        program.updatedAt
      ]
    );

    return clone(program);
  }

  function getPrograms() {
    return Array.from(
      state.programs.values()
    ).map(clone);
  }

  /* ============================================================
     ENROLLMENTS
  ============================================================ */

  async function enrollEmployee(
    input = {}
  ) {
    if (
      state.enrollments.size >=
      maxEnrollments
    ) {
      throw new Error(
        "Maximum enrollments reached"
      );
    }

    if (!input.employeeId) {
      throw new Error(
        "employeeId is required"
      );
    }

    if (
      !input.courseId &&
      !input.programId
    ) {
      throw new Error(
        "courseId or programId is required"
      );
    }

    if (
      workforceEngine &&
      typeof workforceEngine
        .getEmployee ===
        "function"
    ) {
      const employee =
        workforceEngine.getEmployee(
          input.employeeId
        );

      if (!employee) {
        throw new Error(
          "Employee not found"
        );
      }
    }

    const enrollment = {
      id:
        id("enrollment"),

      employeeId:
        input.employeeId,

      courseId:
        input.courseId ||
        null,

      programId:
        input.programId ||
        null,

      status:
        "enrolled",

      progress: 0,

      score: 0,

      startedAt:
        null,

      completedAt:
        null,

      metadata:
        input.metadata || {},

      createdAt: now(),
      updatedAt: now()
    };

    state.enrollments.set(
      enrollment.id,
      enrollment
    );

    state.statistics
      .enrollmentsCreated++;

    await query(
      `
      INSERT INTO ez_training_enrollments
      (
        id,
        employee_id,
        course_id,
        program_id,
        status,
        progress,
        score,
        started_at,
        completed_at,
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
        enrollment.id,
        enrollment.employeeId,
        enrollment.courseId,
        enrollment.programId,
        enrollment.status,
        enrollment.progress,
        enrollment.score,
        enrollment.startedAt,
        enrollment.completedAt,
        JSON.stringify(
          enrollment.metadata
        ),
        enrollment.createdAt,
        enrollment.updatedAt
      ]
    );

    emit(
      "training.enrollment.created",
      clone(enrollment)
    );

    return clone(enrollment);
  }

  async function updateEnrollment(
    enrollmentId,
    input = {}
  ) {
    const enrollment =
      state.enrollments.get(
        enrollmentId
      );

    if (!enrollment) {
      throw new Error(
        "Enrollment not found"
      );
    }

    if (
      input.progress !==
      undefined
    ) {
      enrollment.progress =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              input.progress
            )
          )
        );
    }

    if (input.score !== undefined) {
      enrollment.score =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              input.score
            )
          )
        );
    }

    if (input.status) {
      enrollment.status =
        input.status;
    }

    if (
      enrollment.status ===
      "in_progress" &&
      !enrollment.startedAt
    ) {
      enrollment.startedAt =
        now();
    }

    if (
      enrollment.progress >=
        100 ||
      enrollment.status ===
        "completed"
    ) {
      enrollment.progress = 100;

      enrollment.status =
        "completed";

      enrollment.completedAt =
        enrollment.completedAt ||
        now();
    }

    enrollment.updatedAt =
      now();

    await query(
      `
      UPDATE ez_training_enrollments
      SET
        status=$1,
        progress=$2,
        score=$3,
        started_at=$4,
        completed_at=$5,
        metadata=$6,
        updated_at=$7
      WHERE id=$8
      `,
      [
        enrollment.status,
        enrollment.progress,
        enrollment.score,
        enrollment.startedAt,
        enrollment.completedAt,
        JSON.stringify(
          enrollment.metadata
        ),
        enrollment.updatedAt,
        enrollment.id
      ]
    );

    if (
      enrollment.status ===
      "completed"
    ) {
      await issueCertificate(
        enrollment
      );
    }

    return clone(enrollment);
  }

  function getEnrollments(
    filters = {}
  ) {
    let items =
      Array.from(
        state.enrollments.values()
      );

    if (filters.employeeId) {
      items =
        items.filter(
          item =>
            item.employeeId ===
            filters.employeeId
        );
    }

    if (filters.courseId) {
      items =
        items.filter(
          item =>
            item.courseId ===
            filters.courseId
        );
    }

    if (filters.programId) {
      items =
        items.filter(
          item =>
            item.programId ===
            filters.programId
        );
    }

    return items.map(clone);
  }

  /* ============================================================
     ASSESSMENTS
  ============================================================ */

  async function createAssessment(
    input = {}
  ) {
    if (
      state.assessments.size >=
      maxAssessments
    ) {
      throw new Error(
        "Maximum assessments reached"
      );
    }

    if (!input.employeeId) {
      throw new Error(
        "employeeId is required"
      );
    }

    const score =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            input.score || 0
          )
        )
      );

    const passMark =
      Number(
        input.passMark ||
        70
      );

    const assessment = {
      id:
        id("assessment"),

      employeeId:
        input.employeeId,

      courseId:
        input.courseId ||
        null,

      skill:
        input.skill ||
        null,

      assessmentType:
        input.assessmentType ||
        "skill",

      score,

      passed:
        score >= passMark,

      answers:
        input.answers || {},

      aiAnalysis:
        {},

      createdAt:
        now()
    };

    state.assessments.set(
      assessment.id,
      assessment
    );

    state.statistics
      .assessmentsCreated++;

    await query(
      `
      INSERT INTO ez_training_assessments
      (
        id,
        employee_id,
        course_id,
        skill,
        assessment_type,
        score,
        passed,
        answers,
        ai_analysis,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        assessment.id,
        assessment.employeeId,
        assessment.courseId,
        assessment.skill,
        assessment.assessmentType,
        assessment.score,
        assessment.passed,
        JSON.stringify(
          assessment.answers
        ),
        JSON.stringify(
          assessment.aiAnalysis
        ),
        assessment.createdAt
      ]
    );

    return clone(assessment);
  }

  /* ============================================================
     SKILL GAP ANALYSIS
  ============================================================ */

  async function analyzeSkillGaps(
    input = {}
  ) {
    if (!input.employeeId) {
      throw new Error(
        "employeeId is required"
      );
    }

    const employee =
      workforceEngine &&
      typeof workforceEngine
        .getEmployee ===
        "function"
        ? workforceEngine.getEmployee(
            input.employeeId
          )
        : null;

    if (
      !employee &&
      workforceEngine
    ) {
      throw new Error(
        "Employee not found"
      );
    }

    const requiredSkills =
      Array.isArray(
        input.requiredSkills
      )
        ? input.requiredSkills
        : [];

    const currentSkills =
      employee &&
      Array.isArray(
        employee.skills
      )
        ? employee.skills
        : [];

    const gaps = [];

    for (
      const item
      of requiredSkills
    ) {
      const skill =
        typeof item ===
        "string"
          ? item
          : item.skill;

      const requiredLevel =
        typeof item ===
        "object"
          ? Number(
              item.requiredLevel ||
              80
            )
          : 80;

      const hasSkill =
        currentSkills
          .map(
            value =>
              String(value)
                .toLowerCase()
          )
          .includes(
            String(skill)
              .toLowerCase()
          );

      const currentLevel =
        hasSkill
          ? 100
          : 0;

      const gapScore =
        Math.max(
          0,
          requiredLevel -
            currentLevel
        );

      if (gapScore <= 0) {
        continue;
      }

      const recommendedCourses =
        getCourses()
          .filter(
            course =>
              course.skills.some(
                courseSkill =>
                  String(
                    courseSkill
                  ).toLowerCase() ===
                  String(skill)
                    .toLowerCase()
              )
          )
          .slice(0, 5)
          .map(
            course =>
              course.id
          );

      const gap = {
        id:
          id("skill_gap"),

        employeeId:
          input.employeeId,

        skill,

        currentLevel,

        requiredLevel,

        gapScore,

        priority:
          gapScore >= 70
            ? "critical"
            : gapScore >= 40
              ? "high"
              : "medium",

        recommendedCourses,

        aiAnalysis:
          {},

        createdAt:
          now()
      };

      gaps.push(gap);

      state.skillGaps.set(
        gap.id,
        gap
      );

      await query(
        `
        INSERT INTO ez_training_skill_gaps
        (
          id,
          employee_id,
          skill,
          current_level,
          required_level,
          gap_score,
          priority,
          recommended_courses,
          ai_analysis,
          created_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        `,
        [
          gap.id,
          gap.employeeId,
          gap.skill,
          gap.currentLevel,
          gap.requiredLevel,
          gap.gapScore,
          gap.priority,
          JSON.stringify(
            gap.recommendedCourses
          ),
          JSON.stringify(
            gap.aiAnalysis
          ),
          gap.createdAt
        ]
      );
    }

    state.statistics
      .skillGapAnalyses++;

    return {
      employeeId:
        input.employeeId,

      gaps:
        gaps.map(clone)
    };
  }

  /* ============================================================
     LEARNING PLAN
  ============================================================ */

  async function createLearningPlan(
    input = {}
  ) {
    if (
      state.learningPlans.size >=
      maxLearningPlans
    ) {
      throw new Error(
        "Maximum learning plans reached"
      );
    }

    if (!input.employeeId) {
      throw new Error(
        "employeeId is required"
      );
    }

    const targetSkills =
      Array.isArray(
        input.targetSkills
      )
        ? input.targetSkills
        : [];

    const recommendedCourses =
      getCourses()
        .filter(
          course =>
            targetSkills.some(
              skill =>
                course.skills
                  .map(
                    value =>
                      String(value)
                        .toLowerCase()
                  )
                  .includes(
                    String(skill)
                      .toLowerCase()
                  )
            )
        )
        .slice(0, 10)
        .map(
          course =>
            course.id
        );

    const plan = {
      id:
        id("learning_plan"),

      employeeId:
        input.employeeId,

      goal:
        input.goal ||
        "تطوير المهارات الإعلامية",

      targetSkills,

      recommendedCourses,

      priority:
        input.priority ||
        "medium",

      status:
        "active",

      progress: 0,

      aiAnalysis:
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.learningPlans.set(
      plan.id,
      plan
    );

    state.statistics
      .learningPlansCreated++;

    await query(
      `
      INSERT INTO ez_training_learning_plans
      (
        id,
        employee_id,
        goal,
        target_skills,
        recommended_courses,
        priority,
        status,
        progress,
        ai_analysis,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      `,
      [
        plan.id,
        plan.employeeId,
        plan.goal,
        JSON.stringify(
          plan.targetSkills
        ),
        JSON.stringify(
          plan.recommendedCourses
        ),
        plan.priority,
        plan.status,
        plan.progress,
        JSON.stringify(
          plan.aiAnalysis
        ),
        plan.createdAt,
        plan.updatedAt
      ]
    );

    emit(
      "training.learning-plan.created",
      clone(plan)
    );

    return clone(plan);
  }

  /* ============================================================
     AI
  ============================================================ */

  async function analyzeEmployeeTraining(
    input = {}
  ) {
    state.statistics
      .aiAnalyses++;

    const snapshot = {
      employeeId:
        input.employeeId,

      employee:
        workforceEngine &&
        typeof workforceEngine
          .getEmployee ===
          "function"
          ? workforceEngine.getEmployee(
              input.employeeId
            )
          : null,

      enrollments:
        getEnrollments({
          employeeId:
            input.employeeId
        }),

      assessments:
        Array.from(
          state.assessments.values()
        ).filter(
          item =>
            item.employeeId ===
            input.employeeId
        ),

      skillGaps:
        Array.from(
          state.skillGaps.values()
        ).filter(
          item =>
            item.employeeId ===
            input.employeeId
        )
    };

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      return aiOrchestrator.process({
        operation:
          "analyze-editorial-training",

        input:
          snapshot,

        metadata: {
          source:
            "CODE92"
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

  /* ============================================================
     CERTIFICATES
  ============================================================ */

  async function issueCertificate(
    enrollment
  ) {
    if (
      enrollment.status !==
      "completed"
    ) {
      return null;
    }

    const existing =
      Array.from(
        state.certificates.values()
      ).find(
        certificate =>
          certificate.employeeId ===
            enrollment.employeeId &&
          certificate.courseId ===
            enrollment.courseId
      );

    if (existing) {
      return clone(existing);
    }

    const certificate = {
      id:
        id("certificate"),

      employeeId:
        enrollment.employeeId,

      courseId:
        enrollment.courseId,

      programId:
        enrollment.programId,

      certificateNumber:
        `EZ-${Date.now()}-${crypto
          .randomBytes(4)
          .toString("hex")
          .toUpperCase()}`,

      title:
        "شهادة إتمام برنامج تدريبي في EZ MEDIA",

      score:
        enrollment.score,

      issuedAt:
        now(),

      metadata: {}
    };

    state.certificates.set(
      certificate.id,
      certificate
    );

    state.statistics
      .certificatesIssued++;

    await query(
      `
      INSERT INTO ez_training_certificates
      (
        id,
        employee_id,
        course_id,
        program_id,
        certificate_number,
        title,
        score,
        issued_at,
        metadata
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        certificate.id,
        certificate.employeeId,
        certificate.courseId,
        certificate.programId,
        certificate.certificateNumber,
        certificate.title,
        certificate.score,
        certificate.issuedAt,
        JSON.stringify(
          certificate.metadata
        )
      ]
    );

    emit(
      "training.certificate.issued",
      clone(certificate)
    );

    return clone(certificate);
  }

  function getCertificates(
    filters = {}
  ) {
    let certificates =
      Array.from(
        state.certificates.values()
      );

    if (filters.employeeId) {
      certificates =
        certificates.filter(
          certificate =>
            certificate.employeeId ===
            filters.employeeId
        );
    }

    return certificates.map(
      clone
    );
  }

  /* ============================================================
     ALERTS
  ============================================================ */

  async function createAlert(
    input = {}
  ) {
    const alert = {
      id:
        id("training_alert"),

      employeeId:
        input.employeeId ||
        null,

      type:
        input.type ||
        "training",

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
      .alertsCreated++;

    await query(
      `
      INSERT INTO ez_training_alerts
      (
        id,
        employee_id,
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
        alert.employeeId,
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
      "training.alert",
      clone(alert)
    );

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

  /* ============================================================
     DASHBOARD
  ============================================================ */

  function getDashboard() {
    const enrollments =
      Array.from(
        state.enrollments.values()
      );

    const completed =
      enrollments.filter(
        item =>
          item.status ===
          "completed"
      ).length;

    const inProgress =
      enrollments.filter(
        item =>
          item.status ===
          "in_progress"
      ).length;

    const averageProgress =
      enrollments.length
        ? Math.round(
            enrollments.reduce(
              (sum, item) =>
                sum +
                Number(
                  item.progress || 0
                ),
              0
            ) /
              enrollments.length
          )
        : 0;

    return {
      courses:
        state.courses.size,

      programs:
        state.programs.size,

      enrollments: {
        total:
          enrollments.length,

        completed,

        inProgress,

        averageProgress
      },

      assessments:
        state.assessments.size,

      learningPlans:
        state.learningPlans.size,

      certificates:
        state.certificates.size,

      skillGaps:
        state.skillGaps.size,

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

      totalCourses:
        state.courses.size,

      totalPrograms:
        state.programs.size,

      totalEnrollments:
        state.enrollments.size,

      totalAssessments:
        state.assessments.size,

      totalLearningPlans:
        state.learningPlans.size,

      totalCertificates:
        state.certificates.size,

      totalSkillGaps:
        state.skillGaps.size
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Editorial Training & Skills Academy",

      code:
        "CODE92",

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

        workforce:
          Boolean(
            workforceEngine
          ),

        assignment:
          Boolean(
            assignmentEngine
          ),

        workflow:
          Boolean(
            workflowEngine
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
          try {
            for (
              const enrollment
              of state.enrollments.values()
            ) {
              if (
                enrollment.progress >=
                  90 &&
                enrollment.status !==
                  "completed"
              ) {
                createAlert({
                  employeeId:
                    enrollment.employeeId,

                  type:
                    "training_near_completion",

                  severity:
                    "info",

                  message:
                    "المتدرب اقترب من إكمال البرنامج التدريبي",

                  metadata:
                    {
                      enrollmentId:
                        enrollment.id,

                      progress:
                        enrollment.progress
                    }
                }).catch(
                  () => {}
                );
              }
            }
          } catch (error) {
            logger.warn(
              "[CODE92] Monitor:",
              error.message
            );
          }
        },
        progressCheckIntervalMs
      );

    emit(
      "training.started",
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
      "training.stopped",
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

    createCourse,
    getCourse,
    getCourses,

    createProgram,
    getPrograms,

    enrollEmployee,
    updateEnrollment,
    getEnrollments,

    createAssessment,

    analyzeSkillGaps,

    createLearningPlan,

    analyzeEmployeeTraining,

    issueCertificate,
    getCertificates,

    createAlert,
    getAlerts
  };
}

module.exports = {
  createIntelligentEditorialTrainingEngine
};
