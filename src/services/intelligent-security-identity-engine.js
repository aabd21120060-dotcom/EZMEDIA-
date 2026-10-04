"use strict";

const crypto = require("crypto");

function createIntelligentSecurityIdentityEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    workflowEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    sessionTtlHours = Number(
      process.env.SECURITY_SESSION_TTL_HOURS || 24
    ),

    maxLoginAttempts = Number(
      process.env.SECURITY_MAX_LOGIN_ATTEMPTS || 5
    ),

    lockMinutes = Number(
      process.env.SECURITY_LOCK_MINUTES || 30
    ),

    maxSessionsPerUser = Number(
      process.env.SECURITY_MAX_SESSIONS_PER_USER || 10
    ),

    riskReviewThreshold = Number(
      process.env.SECURITY_RISK_REVIEW_THRESHOLD || 70
    ),

    maxApiKeys = Number(
      process.env.SECURITY_MAX_API_KEYS || 20
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    users: new Map(),
    roles: new Map(),
    permissions: new Map(),
    sessions: new Map(),
    apiKeys: new Map(),
    securityEvents: new Map(),
    loginAttempts: new Map(),
    riskProfiles: new Map(),

    statistics: {
      users: 0,
      activeUsers: 0,
      roles: 0,
      permissions: 0,
      sessions: 0,
      activeSessions: 0,
      apiKeys: 0,
      securityEvents: 0,
      blockedAttempts: 0,
      riskAnalyses: 0
    }
  };

  function now() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      crypto.randomBytes(8).toString("hex")
    );
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(String(value || ""))
      .digest("hex");
  }

  function randomSecret(bytes = 32) {
    return crypto
      .randomBytes(bytes)
      .toString("hex");
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
        "[CODE82] Event error:",
        error.message
      );
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

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    if (!persistence) {
      return;
    }

    await query(`
      CREATE TABLE IF NOT EXISTS ez_security_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        display_name TEXT,
        status TEXT DEFAULT 'active',
        roles JSONB DEFAULT '[]'::jsonb,
        permissions JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        last_login_ip TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_security_roles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '[]'::jsonb,
        system_role BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_security_permissions (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_security_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'active',
        ip_address TEXT,
        user_agent TEXT,
        device_id TEXT,
        risk_score NUMERIC DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        last_activity_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_security_api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        key_hash TEXT UNIQUE NOT NULL,
        key_prefix TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        permissions JSONB DEFAULT '[]'::jsonb,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_security_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        user_id TEXT,
        session_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        resource TEXT,
        action TEXT,
        risk_score NUMERIC DEFAULT 0,
        success BOOLEAN DEFAULT TRUE,
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_security_risk_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        identifier TEXT,
        risk_score NUMERIC DEFAULT 0,
        risk_level TEXT DEFAULT 'low',
        factors JSONB DEFAULT '[]'::jsonb,
        recommendation TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_security_sessions_user
      ON ez_security_sessions(user_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_security_sessions_token
      ON ez_security_sessions(token_hash)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_security_events_user
      ON ez_security_events(user_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_security_events_created
      ON ez_security_events(created_at)
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

    await createBuiltInPermissions();
    await createBuiltInRoles();

    state.initialized = true;

    emit("security.initialized", {
      timestamp: now()
    });

    return getStatus();
  }

  /* ============================================================
     PERMISSIONS
  ============================================================ */

  async function createPermission(input = {}) {
    if (!input.name) {
      throw new Error(
        "Permission name is required"
      );
    }

    const permission = {
      id:
        input.id ||
        id("permission"),

      name:
        input.name,

      resource:
        input.resource ||
        "*",

      action:
        input.action ||
        "*",

      description:
        input.description ||
        "",

      createdAt:
        now()
    };

    state.permissions.set(
      permission.name,
      permission
    );

    state.statistics.permissions++;

    await query(
      `
      INSERT INTO ez_security_permissions
      (
        id,
        name,
        resource,
        action,
        description,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6)
      ON CONFLICT(name)
      DO UPDATE SET
        resource=EXCLUDED.resource,
        action=EXCLUDED.action,
        description=EXCLUDED.description
      `,
      [
        permission.id,
        permission.name,
        permission.resource,
        permission.action,
        permission.description,
        permission.createdAt
      ]
    );

    return clone(permission);
  }

  async function createBuiltInPermissions() {
    const permissions = [
      ["platform.read", "*", "read"],
      ["platform.manage", "*", "manage"],

      ["users.read", "users", "read"],
      ["users.manage", "users", "manage"],

      ["roles.read", "roles", "read"],
      ["roles.manage", "roles", "manage"],

      ["documents.read", "documents", "read"],
      ["documents.manage", "documents", "manage"],

      ["crm.read", "crm", "read"],
      ["crm.manage", "crm", "manage"],

      ["advertising.read", "advertising", "read"],
      ["advertising.manage", "advertising", "manage"],

      ["monetization.read", "monetization", "read"],
      ["monetization.manage", "monetization", "manage"],

      ["support.read", "support", "read"],
      ["support.manage", "support", "manage"],

      ["automation.read", "automation", "read"],
      ["automation.manage", "automation", "manage"],

      ["security.read", "security", "read"],
      ["security.manage", "security", "manage"]
    ];

    for (const item of permissions) {
      const [
        name,
        resource,
        action
      ] = item;

      if (
        !state.permissions.has(name)
      ) {
        await createPermission({
          name,
          resource,
          action
        });
      }
    }
  }

  /* ============================================================
     ROLES
  ============================================================ */

  async function createRole(input = {}) {
    if (!input.name) {
      throw new Error(
        "Role name is required"
      );
    }

    const role = {
      id:
        input.id ||
        id("role"),

      name:
        input.name,

      description:
        input.description ||
        "",

      permissions:
        Array.isArray(
          input.permissions
        )
          ? input.permissions
          : [],

      systemRole:
        Boolean(
          input.systemRole
        ),

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.roles.set(
      role.name,
      role
    );

    state.statistics.roles++;

    await query(
      `
      INSERT INTO ez_security_roles
      (
        id,
        name,
        description,
        permissions,
        system_role,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(name)
      DO UPDATE SET
        description=EXCLUDED.description,
        permissions=EXCLUDED.permissions,
        system_role=EXCLUDED.system_role,
        updated_at=EXCLUDED.updated_at
      `,
      [
        role.id,
        role.name,
        role.description,
        JSON.stringify(
          role.permissions
        ),
        role.systemRole,
        role.createdAt,
        role.updatedAt
      ]
    );

    return clone(role);
  }

  async function createBuiltInRoles() {
    const roles = [
      {
        name: "super_admin",
        description:
          "إدارة كاملة للمنصة",
        permissions: [
          "*"
        ],
        systemRole: true
      },
      {
        name: "admin",
        description:
          "إدارة تشغيلية",
        permissions: [
          "platform.read",
          "users.read",
          "roles.read",
          "documents.manage",
          "crm.manage",
          "advertising.manage",
          "monetization.read",
          "support.manage",
          "automation.manage"
        ],
        systemRole: true
      },
      {
        name: "editor",
        description:
          "إدارة المحتوى والتحرير",
        permissions: [
          "documents.read",
          "documents.manage"
        ],
        systemRole: true
      },
      {
        name: "sales",
        description:
          "المبيعات وCRM",
        permissions: [
          "crm.read",
          "crm.manage",
          "advertising.read",
          "advertising.manage",
          "monetization.read"
        ],
        systemRole: true
      },
      {
        name: "support",
        description:
          "خدمة العملاء",
        permissions: [
          "support.read",
          "support.manage"
        ],
        systemRole: true
      }
    ];

    for (const role of roles) {
      if (
        !state.roles.has(
          role.name
        )
      ) {
        await createRole(role);
      }
    }
  }

  /* ============================================================
     USERS
  ============================================================ */

  async function createUser(input = {}) {
    if (!input.username) {
      throw new Error(
        "Username is required"
      );
    }

    const username =
      String(
        input.username
      )
        .trim()
        .toLowerCase();

    const duplicate =
      Array.from(
        state.users.values()
      ).find(
        user =>
          user.username ===
            username ||
          (
            input.email &&
            user.email ===
              input.email
                .trim()
                .toLowerCase()
          )
      );

    if (duplicate) {
      throw new Error(
        "User already exists"
      );
    }

    const user = {
      id:
        input.id ||
        id("user"),

      username,

      email:
        input.email
          ? input.email
              .trim()
              .toLowerCase()
          : null,

      passwordHash:
        input.password
          ? hashPassword(
              input.password
            )
          : null,

      displayName:
        input.displayName ||
        username,

      status:
        input.status ||
        "active",

      roles:
        Array.isArray(
          input.roles
        )
          ? input.roles
          : ["support"],

      permissions:
        Array.isArray(
          input.permissions
        )
          ? input.permissions
          : [],

      metadata:
        input.metadata ||
        {},

      failedLoginAttempts: 0,

      lockedUntil: null,

      lastLoginAt: null,

      lastLoginIp: null,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.users.set(
      user.id,
      user
    );

    state.statistics.users++;

    if (
      user.status ===
      "active"
    ) {
      state.statistics.activeUsers++;
    }

    await persistUser(user);

    await logSecurityEvent({
      eventType:
        "user.created",

      severity:
        "info",

      userId:
        user.id,

      success:
        true,

      details: {
        username:
          user.username
      }
    });

    return sanitizeUser(
      user
    );
  }

  function hashPassword(
    password
  ) {
    if (
      !password ||
      String(password).length <
        12
    ) {
      throw new Error(
        "Password must contain at least 12 characters"
      );
    }

    /*
     * PBKDF2 is used here so the service
     * does not store plaintext passwords.
     *
     * For production authentication at scale,
     * a dedicated identity provider or Argon2id
     * implementation should be preferred.
     */

    const salt =
      crypto.randomBytes(16);

    const derived =
      crypto.pbkdf2Sync(
        String(password),
        salt,
        210000,
        32,
        "sha256"
      );

    return [
      "pbkdf2",
      "sha256",
      "210000",
      salt.toString("hex"),
      derived.toString("hex")
    ].join("$");
  }

  function verifyPassword(
    password,
    stored
  ) {
    if (
      !password ||
      !stored
    ) {
      return false;
    }

    const parts =
      stored.split("$");

    if (
      parts.length !== 5
    ) {
      return false;
    }

    const [
      scheme,
      digest,
      iterations,
      saltHex,
      hashHex
    ] = parts;

    if (
      scheme !== "pbkdf2" ||
      digest !== "sha256"
    ) {
      return false;
    }

    const calculated =
      crypto.pbkdf2Sync(
        String(password),
        Buffer.from(
          saltHex,
          "hex"
        ),
        Number(iterations),
        32,
        "sha256"
      );

    const expected =
      Buffer.from(
        hashHex,
        "hex"
      );

    if (
      calculated.length !==
      expected.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      calculated,
      expected
    );
  }

  function sanitizeUser(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName:
        user.displayName,
      status:
        user.status,
      roles:
        user.roles,
      permissions:
        user.permissions,
      createdAt:
        user.createdAt,
      lastLoginAt:
        user.lastLoginAt
    };
  }

  async function persistUser(user) {
    await query(
      `
      INSERT INTO ez_security_users
      (
        id,
        username,
        email,
        password_hash,
        display_name,
        status,
        roles,
        permissions,
        metadata,
        failed_login_attempts,
        locked_until,
        last_login_at,
        last_login_ip,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT(id)
      DO UPDATE SET
        username=EXCLUDED.username,
        email=EXCLUDED.email,
        password_hash=EXCLUDED.password_hash,
        display_name=EXCLUDED.display_name,
        status=EXCLUDED.status,
        roles=EXCLUDED.roles,
        permissions=EXCLUDED.permissions,
        metadata=EXCLUDED.metadata,
        failed_login_attempts=EXCLUDED.failed_login_attempts,
        locked_until=EXCLUDED.locked_until,
        last_login_at=EXCLUDED.last_login_at,
        last_login_ip=EXCLUDED.last_login_ip,
        updated_at=EXCLUDED.updated_at
      `,
      [
        user.id,
        user.username,
        user.email,
        user.passwordHash,
        user.displayName,
        user.status,
        JSON.stringify(
          user.roles
        ),
        JSON.stringify(
          user.permissions
        ),
        JSON.stringify(
          user.metadata
        ),
        user.failedLoginAttempts,
        user.lockedUntil,
        user.lastLoginAt,
        user.lastLoginIp,
        user.createdAt,
        user.updatedAt
      ]
    );
  }

  function getUser(
    userId
  ) {
    const user =
      state.users.get(
        userId
      );

    return user
      ? sanitizeUser(user)
      : null;
  }

  function listUsers() {
    return Array.from(
      state.users.values()
    ).map(
      sanitizeUser
    );
  }

  /* ============================================================
     LOGIN
  ============================================================ */

  function getAttemptKey(
    username,
    ip
  ) {
    return (
      String(username || "")
        .toLowerCase() +
      "|" +
      String(ip || "")
    );
  }

  function isLocked(user) {
    if (
      !user ||
      !user.lockedUntil
    ) {
      return false;
    }

    const locked =
      new Date(
        user.lockedUntil
      ).getTime() >
      Date.now();

    if (!locked) {
      user.lockedUntil =
        null;
      user.failedLoginAttempts =
        0;
    }

    return locked;
  }

  async function login(input = {}) {
    const username =
      String(
        input.username ||
        ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        input.password ||
        ""
      );

    const ip =
      input.ipAddress ||
      "unknown";

    const user =
      Array.from(
        state.users.values()
      ).find(
        item =>
          item.username ===
            username ||
          (
            item.email &&
            item.email ===
              username
          )
      );

    if (!user) {
      await logSecurityEvent({
        eventType:
          "login.failed",

        severity:
          "warning",

        ipAddress:
          ip,

        success:
          false,

        details: {
          reason:
            "unknown_user"
        }
      });

      throw new Error(
        "Invalid credentials"
      );
    }

    if (
      user.status !==
      "active"
    ) {
      throw new Error(
        "User account is not active"
      );
    }

    if (
      isLocked(user)
    ) {
      state.statistics.blockedAttempts++;

      await logSecurityEvent({
        eventType:
          "login.blocked",

        severity:
          "high",

        userId:
          user.id,

        ipAddress:
          ip,

        success:
          false,

        details: {
          reason:
            "account_locked"
        }
      });

      throw new Error(
        "Account temporarily locked"
      );
    }

    const valid =
      verifyPassword(
        password,
        user.passwordHash
      );

    if (!valid) {
      user.failedLoginAttempts++;

      if (
        user.failedLoginAttempts >=
        maxLoginAttempts
      ) {
        user.lockedUntil =
          new Date(
            Date.now() +
              lockMinutes *
                60 *
                1000
          ).toISOString();

        state.statistics.blockedAttempts++;
      }

      user.updatedAt =
        now();

      await persistUser(
        user
      );

      await logSecurityEvent({
        eventType:
          "login.failed",

        severity:
          user.lockedUntil
            ? "high"
            : "warning",

        userId:
          user.id,

        ipAddress:
          ip,

        success:
          false,

        details: {
          attempts:
            user.failedLoginAttempts
        }
      });

      throw new Error(
        "Invalid credentials"
      );
    }

    user.failedLoginAttempts =
      0;

    user.lockedUntil =
      null;

    user.lastLoginAt =
      now();

    user.lastLoginIp =
      ip;

    user.updatedAt =
      now();

    await persistUser(
      user
    );

    const risk =
      await analyzeRisk({
        userId:
          user.id,

        ipAddress:
          ip,

        userAgent:
          input.userAgent,

        deviceId:
          input.deviceId,

        eventType:
          "login"
      });

    if (
      risk.score >=
      riskReviewThreshold
    ) {
      await logSecurityEvent({
        eventType:
          "login.risk_review",

        severity:
          "high",

        userId:
          user.id,

        ipAddress:
          ip,

        riskScore:
          risk.score,

        success:
          true,

        details:
          risk
      });
    }

    const session =
      await createSession({
        userId:
          user.id,

        ipAddress:
          ip,

        userAgent:
          input.userAgent,

        deviceId:
          input.deviceId,

        riskScore:
          risk.score
      });

    await logSecurityEvent({
      eventType:
        "login.success",

      severity:
        "info",

      userId:
        user.id,

      sessionId:
        session.id,

      ipAddress:
        ip,

      riskScore:
        risk.score,

      success:
        true
    });

    return {
      user:
        sanitizeUser(user),

      session,

      risk
    };
  }

  /* ============================================================
     SESSIONS
  ============================================================ */

  async function createSession(
    input = {}
  ) {
    const sessions =
      Array.from(
        state.sessions.values()
      ).filter(
        session =>
          session.userId ===
            input.userId &&
          session.status ===
            "active"
      );

    if (
      sessions.length >=
      maxSessionsPerUser
    ) {
      sessions.sort(
        (a, b) =>
          new Date(
            a.createdAt
          ) -
          new Date(
            b.createdAt
          )
      );

      await revokeSession(
        sessions[0].id,
        "session_limit"
      );
    }

    const token =
      randomSecret(48);

    const tokenHash =
      hash(token);

    const expiresAt =
      new Date(
        Date.now() +
          sessionTtlHours *
            60 *
            60 *
            1000
      ).toISOString();

    const session = {
      id:
        id("session"),

      userId:
        input.userId,

      tokenHash,

      status:
        "active",

      ipAddress:
        input.ipAddress ||
        null,

      userAgent:
        input.userAgent ||
        null,

      deviceId:
        input.deviceId ||
        null,

      riskScore:
        Number(
          input.riskScore || 0
        ),

      expiresAt,

      lastActivityAt:
        now(),

      createdAt:
        now(),

      revokedAt:
        null
    };

    state.sessions.set(
      session.id,
      session
    );

    state.statistics.sessions++;
    state.statistics.activeSessions++;

    await query(
      `
      INSERT INTO ez_security_sessions
      (
        id,
        user_id,
        token_hash,
        status,
        ip_address,
        user_agent,
        device_id,
        risk_score,
        expires_at,
        last_activity_at,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        session.id,
        session.userId,
        session.tokenHash,
        session.status,
        session.ipAddress,
        session.userAgent,
        session.deviceId,
        session.riskScore,
        session.expiresAt,
        session.lastActivityAt,
        session.createdAt
      ]
    );

    return {
      id:
        session.id,

      token,

      expiresAt:
        session.expiresAt,

      riskScore:
        session.riskScore
    };
  }

  async function authenticateToken(
    token
  ) {
    if (!token) {
      return null;
    }

    const tokenHash =
      hash(token);

    const session =
      Array.from(
        state.sessions.values()
      ).find(
        item =>
          item.tokenHash ===
            tokenHash &&
          item.status ===
            "active"
      );

    if (!session) {
      return null;
    }

    if (
      new Date(
        session.expiresAt
      ).getTime() <=
      Date.now()
    ) {
      await revokeSession(
        session.id,
        "expired"
      );

      return null;
    }

    const user =
      state.users.get(
        session.userId
      );

    if (
      !user ||
      user.status !==
        "active"
    ) {
      await revokeSession(
        session.id,
        "user_inactive"
      );

      return null;
    }

    session.lastActivityAt =
      now();

    return {
      user:
        sanitizeUser(user),

      session:
        clone(session)
    };
  }

  async function revokeSession(
    sessionId,
    reason = "manual"
  ) {
    const session =
      state.sessions.get(
        sessionId
      );

    if (!session) {
      return false;
    }

    if (
      session.status ===
      "revoked"
    ) {
      return true;
    }

    session.status =
      "revoked";

    session.revokedAt =
      now();

    state.statistics.activeSessions =
      Math.max(
        0,
        state.statistics
          .activeSessions - 1
      );

    await query(
      `
      UPDATE ez_security_sessions
      SET
        status='revoked',
        revoked_at=NOW()
      WHERE id=$1
      `,
      [sessionId]
    );

    await logSecurityEvent({
      eventType:
        "session.revoked",

      severity:
        reason === "manual"
          ? "info"
          : "warning",

      userId:
        session.userId,

      sessionId,

      details: {
        reason
      }
    });

    return true;
  }

  async function revokeAllUserSessions(
    userId
  ) {
    const sessions =
      Array.from(
        state.sessions.values()
      ).filter(
        session =>
          session.userId ===
            userId &&
          session.status ===
            "active"
      );

    for (
      const session of sessions
    ) {
      await revokeSession(
        session.id,
        "all_user_sessions"
      );
    }

    return sessions.length;
  }

  /* ============================================================
     API KEYS
  ============================================================ */

  async function createApiKey(
    input = {}
  ) {
    if (!input.name) {
      throw new Error(
        "API key name is required"
      );
    }

    if (
      input.userId
    ) {
      const count =
        Array.from(
          state.apiKeys.values()
        ).filter(
          key =>
            key.userId ===
              input.userId &&
            key.status ===
              "active"
        ).length;

      if (
        count >=
        maxApiKeys
      ) {
        throw new Error(
          "Maximum API keys reached"
        );
      }
    }

    const secret =
      "ezm_" +
      randomSecret(40);

    const key = {
      id:
        id("apikey"),

      userId:
        input.userId ||
        null,

      name:
        input.name,

      keyHash:
        hash(secret),

      keyPrefix:
        secret.slice(
          0,
          12
        ),

      status:
        "active",

      permissions:
        Array.isArray(
          input.permissions
        )
          ? input.permissions
          : [],

      expiresAt:
        input.expiresAt ||
        null,

      lastUsedAt:
        null,

      createdAt:
        now(),

      revokedAt:
        null
    };

    state.apiKeys.set(
      key.id,
      key
    );

    state.statistics.apiKeys++;

    await query(
      `
      INSERT INTO ez_security_api_keys
      (
        id,
        user_id,
        name,
        key_hash,
        key_prefix,
        status,
        permissions,
        expires_at,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        key.id,
        key.userId,
        key.name,
        key.keyHash,
        key.keyPrefix,
        key.status,
        JSON.stringify(
          key.permissions
        ),
        key.expiresAt,
        key.createdAt
      ]
    );

    /*
     * السر الكامل يظهر مرة واحدة فقط.
     * لا يتم تخزينه بصورته الأصلية.
     */

    return {
      id:
        key.id,

      name:
        key.name,

      key:
        secret,

      prefix:
        key.keyPrefix,

      permissions:
        key.permissions,

      expiresAt:
        key.expiresAt
    };
  }

  async function authenticateApiKey(
    secret
  ) {
    if (!secret) {
      return null;
    }

    const keyHash =
      hash(secret);

    const key =
      Array.from(
        state.apiKeys.values()
      ).find(
        item =>
          item.keyHash ===
            keyHash &&
          item.status ===
            "active"
      );

    if (!key) {
      return null;
    }

    if (
      key.expiresAt &&
      new Date(
        key.expiresAt
      ).getTime() <=
        Date.now()
    ) {
      key.status =
        "expired";

      return null;
    }

    key.lastUsedAt =
      now();

    return {
      id:
        key.id,

      userId:
        key.userId,

      permissions:
        key.permissions,

      name:
        key.name
    };
  }

  async function revokeApiKey(
    apiKeyId
  ) {
    const key =
      state.apiKeys.get(
        apiKeyId
      );

    if (!key) {
      return false;
    }

    key.status =
      "revoked";

    key.revokedAt =
      now();

    await query(
      `
      UPDATE ez_security_api_keys
      SET
        status='revoked',
        revoked_at=NOW()
      WHERE id=$1
      `,
      [apiKeyId]
    );

    return true;
  }

  /* ============================================================
     AUTHORIZATION
  ============================================================ */

  function userHasPermission(
    user,
    requiredPermission
  ) {
    if (!user) {
      return false;
    }

    const direct =
      user.permissions ||
      [];

    if (
      direct.includes("*") ||
      direct.includes(
        requiredPermission
      )
    ) {
      return true;
    }

    const roles =
      user.roles ||
      [];

    for (
      const roleName of roles
    ) {
      const role =
        state.roles.get(
          roleName
        );

      if (!role) {
        continue;
      }

      if (
        role.permissions.includes(
          "*"
        ) ||
        role.permissions.includes(
          requiredPermission
        )
      ) {
        return true;
      }
    }

    return false;
  }

  function authorize(
    user,
    permission
  ) {
    if (
      !user ||
      !permission
    ) {
      return false;
    }

    return userHasPermission(
      user,
      permission
    );
  }

  /* ============================================================
     RISK ANALYSIS
  ============================================================ */

  async function analyzeRisk(
    input = {}
  ) {
    state.statistics.riskAnalyses++;

    let score = 0;

    const factors = [];

    if (
      !input.ipAddress ||
      input.ipAddress ===
        "unknown"
    ) {
      score += 5;

      factors.push(
        "unknown_ip"
      );
    }

    if (
      input.eventType ===
      "login"
    ) {
      const key =
        getAttemptKey(
          input.userId,
          input.ipAddress
        );

      const attempts =
        state.loginAttempts.get(
          key
        ) || 0;

      if (
        attempts >= 3
      ) {
        score += 30;

        factors.push(
          "repeated_login_attempts"
        );
      }
    }

    if (
      input.deviceId ===
        "unknown"
    ) {
      score += 10;

      factors.push(
        "unknown_device"
      );
    }

    let aiResult = null;

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        aiResult =
          await aiCore.request({
            operation:
              "security-risk-analysis",

            input
          });

        if (
          Number(
            aiResult?.riskScore
          ) > 0
        ) {
          score =
            Math.max(
              score,
              Number(
                aiResult.riskScore
              )
            );
        }

        if (
          Array.isArray(
            aiResult?.factors
          )
        ) {
          factors.push(
            ...aiResult.factors
          );
        }
      } catch (error) {
        logger.warn(
          "[CODE82] AI risk analysis unavailable:",
          error.message
        );
      }
    }

    score =
      Math.min(
        100,
        Math.round(score)
      );

    let level =
      "low";

    if (
      score >= 80
    ) {
      level =
        "critical";
    } else if (
      score >= 60
    ) {
      level =
        "high";
    } else if (
      score >= 30
    ) {
      level =
        "medium";
    }

    const recommendation =
      score >= 80
        ? "block_or_human_review"
        : score >= 60
        ? "step_up_verification"
        : score >= 30
        ? "monitor"
        : "allow";

    const result = {
      score,
      level,
      factors:
        [...new Set(factors)],
      recommendation,
      analyzedAt:
        now()
    };

    const profile = {
      id:
        id("risk"),

      userId:
        input.userId ||
        null,

      identifier:
        input.ipAddress ||
        input.deviceId ||
        null,

      riskScore:
        score,

      riskLevel:
        level,

      factors:
        result.factors,

      recommendation,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.riskProfiles.set(
      profile.id,
      profile
    );

    await query(
      `
      INSERT INTO ez_security_risk_profiles
      (
        id,
        user_id,
        identifier,
        risk_score,
        risk_level,
        factors,
        recommendation,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        profile.id,
        profile.userId,
        profile.identifier,
        profile.riskScore,
        profile.riskLevel,
        JSON.stringify(
          profile.factors
        ),
        profile.recommendation,
        profile.createdAt,
        profile.updatedAt
      ]
    );

    return result;
  }

  /* ============================================================
     SECURITY EVENTS
  ============================================================ */

  async function logSecurityEvent(
    input = {}
  ) {
    const event = {
      id:
        id("security_event"),

      eventType:
        input.eventType ||
        "security.event",

      severity:
        input.severity ||
        "info",

      userId:
        input.userId ||
        null,

      sessionId:
        input.sessionId ||
        null,

      ipAddress:
        input.ipAddress ||
        null,

      userAgent:
        input.userAgent ||
        null,

      resource:
        input.resource ||
        null,

      action:
        input.action ||
        null,

      riskScore:
        Number(
          input.riskScore || 0
        ),

      success:
        input.success !== false,

      details:
        input.details ||
        {},

      createdAt:
        now()
    };

    state.securityEvents.set(
      event.id,
      event
    );

    state.statistics.securityEvents++;

    await query(
      `
      INSERT INTO ez_security_events
      (
        id,
        event_type,
        severity,
        user_id,
        session_id,
        ip_address,
        user_agent,
        resource,
        action,
        risk_score,
        success,
        details,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13
      )
      `,
      [
        event.id,
        event.eventType,
        event.severity,
        event.userId,
        event.sessionId,
        event.ipAddress,
        event.userAgent,
        event.resource,
        event.action,
        event.riskScore,
        event.success,
        JSON.stringify(
          event.details
        ),
        event.createdAt
      ]
    );

    if (
      event.severity ===
        "critical" &&
      notificationService &&
      typeof notificationService.notify ===
        "function"
    ) {
      try {
        await notificationService.notify({
          type:
            "security_alert",

          severity:
            event.severity,

          message:
            "تم اكتشاف حدث أمني عالي الخطورة في EZ MEDIA.",

          eventId:
            event.id
        });
      } catch (error) {
        logger.warn(
          "[CODE82] Security notification failed:",
          error.message
        );
      }
    }

    emit(
      "security.event",
      clone(event)
    );

    return clone(event);
  }

  function listSecurityEvents(
    filters = {}
  ) {
    let events =
      Array.from(
        state.securityEvents.values()
      );

    if (
      filters.userId
    ) {
      events =
        events.filter(
          event =>
            event.userId ===
            filters.userId
        );
    }

    if (
      filters.severity
    ) {
      events =
        events.filter(
          event =>
            event.severity ===
            filters.severity
        );
    }

    if (
      filters.eventType
    ) {
      events =
        events.filter(
          event =>
            event.eventType ===
            filters.eventType
        );
    }

    return clone(
      events.slice(
        -500
      )
    );
  }

  /* ============================================================
     SECURITY CLEANUP
  ============================================================ */

  async function cleanupExpiredSessions() {
    const expired =
      Array.from(
        state.sessions.values()
      ).filter(
        session =>
          session.status ===
            "active" &&
          new Date(
            session.expiresAt
          ).getTime() <=
            Date.now()
      );

    for (
      const session of expired
    ) {
      await revokeSession(
        session.id,
        "expired"
      );
    }

    return {
      expired:
        expired.length
    };
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...state.statistics,

      userCache:
        state.users.size,

      roleCache:
        state.roles.size,

      permissionCache:
        state.permissions.size,

      sessionCache:
        state.sessions.size,

      apiKeyCache:
        state.apiKeys.size,

      securityEventCache:
        state.securityEvents.size,

      riskProfileCache:
        state.riskProfiles.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Security, Identity & Access Control Engine",

      code:
        "82",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      security: {
        passwordHashing:
          "PBKDF2-SHA256",

        sessionTtlHours:
          sessionTtlHours,

        maxLoginAttempts:
          maxLoginAttempts,

        lockMinutes:
          lockMinutes,

        riskReviewThreshold:
          riskReviewThreshold
      },

      integrations: {
        persistence:
          Boolean(persistence),

        aiCore:
          Boolean(aiCore),

        aiOrchestrator:
          Boolean(aiOrchestrator),

        workflow:
          Boolean(workflowEngine),

        notification:
          Boolean(notificationService)
      },

      statistics:
        getStatistics(),

      timestamp:
        now()
    };
  }

  async function health() {
    let database = {
      connected: false
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

      timestamp:
        now()
    };
  }

  function start() {
    state.running = true;

    emit(
      "security.started",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function stop() {
    state.running = false;

    emit(
      "security.stopped",
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

    createUser,
    getUser,
    listUsers,

    createRole,
    createPermission,

    login,

    createSession,
    authenticateToken,
    revokeSession,
    revokeAllUserSessions,

    createApiKey,
    authenticateApiKey,
    revokeApiKey,

    authorize,
    userHasPermission,

    analyzeRisk,

    logSecurityEvent,
    listSecurityEvents,

    cleanupExpiredSessions,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentSecurityIdentityEngine
};
