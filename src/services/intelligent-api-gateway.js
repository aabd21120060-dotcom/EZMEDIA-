"use strict";

const crypto = require("crypto");
const { URL } = require("url");

function createIntelligentAPIGateway(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    securityEngine = null,
    workflowEngine = null,
    automationEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    timeoutMs = Number(
      process.env.API_GATEWAY_TIMEOUT_MS || 30000
    ),

    maxRetries = Number(
      process.env.API_GATEWAY_MAX_RETRIES || 3
    ),

    maxIntegrations = Number(
      process.env.API_GATEWAY_MAX_INTEGRATIONS || 500
    ),

    maxRequestsPerMinute = Number(
      process.env.API_GATEWAY_MAX_REQUESTS_PER_MINUTE || 120
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    integrations: new Map(),
    routes: new Map(),
    apiKeys: new Map(),
    requestLogs: new Map(),
    webhookEndpoints: new Map(),
    webhookEvents: new Map(),
    rateLimits: new Map(),

    statistics: {
      integrations: 0,
      activeIntegrations: 0,
      routes: 0,
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      webhooks: 0,
      webhookEvents: 0,
      retries: 0,
      averageLatencyMs: 0
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
      crypto.randomBytes(7).toString("hex")
    );
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(String(value || ""))
      .digest("hex");
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
        "[CODE83] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    if (!persistence) return;

    await query(`
      CREATE TABLE IF NOT EXISTS ez_api_integrations (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        provider TEXT,
        base_url TEXT,
        status TEXT DEFAULT 'active',
        auth_type TEXT DEFAULT 'none',
        configuration JSONB DEFAULT '{}'::jsonb,
        allowed_domains JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_api_routes (
        id TEXT PRIMARY KEY,
        integration_id TEXT,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        target_path TEXT,
        status TEXT DEFAULT 'active',
        timeout_ms INTEGER DEFAULT 30000,
        retries INTEGER DEFAULT 3,
        permissions JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key_hash TEXT UNIQUE NOT NULL,
        key_prefix TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        permissions JSONB DEFAULT '[]'::jsonb,
        integration_id TEXT,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_api_request_logs (
        id TEXT PRIMARY KEY,
        integration_id TEXT,
        route_id TEXT,
        method TEXT,
        path TEXT,
        status_code INTEGER,
        success BOOLEAN,
        latency_ms INTEGER,
        retry_count INTEGER DEFAULT 0,
        request_id TEXT,
        user_id TEXT,
        ip_address TEXT,
        error_code TEXT,
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_api_webhooks (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        path TEXT UNIQUE NOT NULL,
        secret_hash TEXT,
        status TEXT DEFAULT 'active',
        integration_id TEXT,
        events JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_api_webhook_events (
        id TEXT PRIMARY KEY,
        webhook_id TEXT,
        event_type TEXT,
        event_id TEXT,
        signature_valid BOOLEAN DEFAULT FALSE,
        processed BOOLEAN DEFAULT FALSE,
        payload JSONB DEFAULT '{}'::jsonb,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_api_request_logs_created
      ON ez_api_request_logs(created_at)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_api_request_logs_integration
      ON ez_api_request_logs(integration_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_api_webhook_events_created
      ON ez_api_webhook_events(created_at)
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

    emit("api-gateway.initialized", {
      timestamp: now()
    });

    return getStatus();
  }

  /* ============================================================
     URL SECURITY
  ============================================================ */

  function validateBaseUrl(baseUrl) {
    if (!baseUrl) {
      throw new Error(
        "Integration base URL is required"
      );
    }

    let parsed;

    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new Error(
        "Invalid integration URL"
      );
    }

    if (
      !["http:", "https:"].includes(
        parsed.protocol
      )
    ) {
      throw new Error(
        "Only HTTP and HTTPS integrations are allowed"
      );
    }

    const hostname =
      parsed.hostname.toLowerCase();

    const blockedHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "metadata.google.internal"
    ];

    if (
      blockedHosts.includes(
        hostname
      )
    ) {
      throw new Error(
        "Local or metadata endpoints are blocked"
      );
    }

    return parsed.toString();
  }

  function isAllowedDomain(
    url,
    allowedDomains = []
  ) {
    if (!allowedDomains.length) {
      return true;
    }

    try {
      const hostname =
        new URL(url).hostname
          .toLowerCase();

      return allowedDomains.some(
        domain => {
          const normalized =
            String(domain)
              .toLowerCase()
              .trim();

          return (
            hostname ===
              normalized ||
            hostname.endsWith(
              "." + normalized
            )
          );
        }
      );
    } catch {
      return false;
    }
  }

  /* ============================================================
     INTEGRATIONS
  ============================================================ */

  async function createIntegration(
    input = {}
  ) {
    if (!input.name) {
      throw new Error(
        "Integration name is required"
      );
    }

    if (
      state.integrations.size >=
      maxIntegrations
    ) {
      throw new Error(
        "Maximum integrations reached"
      );
    }

    const baseUrl =
      validateBaseUrl(
        input.baseUrl
      );

    const existing =
      Array.from(
        state.integrations.values()
      ).find(
        item =>
          item.name ===
          input.name
      );

    if (existing) {
      throw new Error(
        "Integration already exists"
      );
    }

    const integration = {
      id:
        id("integration"),

      name:
        input.name,

      provider:
        input.provider ||
        "custom",

      baseUrl,

      status:
        input.status ||
        "active",

      authType:
        input.authType ||
        "none",

      configuration:
        input.configuration ||
        {},

      allowedDomains:
        Array.isArray(
          input.allowedDomains
        )
          ? input.allowedDomains
          : [
              new URL(
                baseUrl
              ).hostname
            ],

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.integrations.set(
      integration.id,
      integration
    );

    state.statistics.integrations++;
    state.statistics.activeIntegrations++;

    await query(
      `
      INSERT INTO ez_api_integrations
      (
        id,
        name,
        provider,
        base_url,
        status,
        auth_type,
        configuration,
        allowed_domains,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        integration.id,
        integration.name,
        integration.provider,
        integration.baseUrl,
        integration.status,
        integration.authType,
        JSON.stringify(
          integration.configuration
        ),
        JSON.stringify(
          integration.allowedDomains
        ),
        JSON.stringify(
          integration.metadata
        ),
        integration.createdAt,
        integration.updatedAt
      ]
    );

    return sanitizeIntegration(
      integration
    );
  }

  function sanitizeIntegration(
    integration
  ) {
    return {
      id:
        integration.id,

      name:
        integration.name,

      provider:
        integration.provider,

      baseUrl:
        integration.baseUrl,

      status:
        integration.status,

      authType:
        integration.authType,

      allowedDomains:
        integration.allowedDomains,

      metadata:
        integration.metadata,

      createdAt:
        integration.createdAt,

      updatedAt:
        integration.updatedAt
    };
  }

  function getIntegration(
    integrationId
  ) {
    const integration =
      state.integrations.get(
        integrationId
      );

    return integration
      ? sanitizeIntegration(
          integration
        )
      : null;
  }

  function listIntegrations() {
    return Array.from(
      state.integrations.values()
    ).map(
      sanitizeIntegration
    );
  }

  async function updateIntegration(
    integrationId,
    input = {}
  ) {
    const integration =
      state.integrations.get(
        integrationId
      );

    if (!integration) {
      throw new Error(
        "Integration not found"
      );
    }

    if (input.baseUrl) {
      integration.baseUrl =
        validateBaseUrl(
          input.baseUrl
        );
    }

    if (input.status) {
      integration.status =
        input.status;
    }

    if (input.authType) {
      integration.authType =
        input.authType;
    }

    if (
      input.allowedDomains
    ) {
      integration.allowedDomains =
        input.allowedDomains;
    }

    if (
      input.configuration
    ) {
      integration.configuration =
        input.configuration;
    }

    integration.updatedAt =
      now();

    await query(
      `
      UPDATE ez_api_integrations
      SET
        base_url=$1,
        status=$2,
        auth_type=$3,
        configuration=$4,
        allowed_domains=$5,
        updated_at=$6
      WHERE id=$7
      `,
      [
        integration.baseUrl,
        integration.status,
        integration.authType,
        JSON.stringify(
          integration.configuration
        ),
        JSON.stringify(
          integration.allowedDomains
        ),
        integration.updatedAt,
        integration.id
      ]
    );

    return sanitizeIntegration(
      integration
    );
  }

  /* ============================================================
     ROUTES
  ============================================================ */

  async function createRoute(
    input = {}
  ) {
    if (
      !input.name ||
      !input.integrationId ||
      !input.method ||
      !input.path
    ) {
      throw new Error(
        "Route name, integrationId, method and path are required"
      );
    }

    const integration =
      state.integrations.get(
        input.integrationId
      );

    if (!integration) {
      throw new Error(
        "Integration not found"
      );
    }

    const route = {
      id:
        id("route"),

      integrationId:
        input.integrationId,

      name:
        input.name,

      method:
        String(
          input.method
        ).toUpperCase(),

      path:
        input.path,

      targetPath:
        input.targetPath ||
        input.path,

      status:
        input.status ||
        "active",

      timeoutMs:
        Number(
          input.timeoutMs ||
          timeoutMs
        ),

      retries:
        Number(
          input.retries ??
            maxRetries
        ),

      permissions:
        Array.isArray(
          input.permissions
        )
          ? input.permissions
          : [],

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.routes.set(
      route.id,
      route
    );

    state.statistics.routes++;

    await query(
      `
      INSERT INTO ez_api_routes
      (
        id,
        integration_id,
        name,
        method,
        path,
        target_path,
        status,
        timeout_ms,
        retries,
        permissions,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `,
      [
        route.id,
        route.integrationId,
        route.name,
        route.method,
        route.path,
        route.targetPath,
        route.status,
        route.timeoutMs,
        route.retries,
        JSON.stringify(
          route.permissions
        ),
        JSON.stringify(
          route.metadata
        ),
        route.createdAt,
        route.updatedAt
      ]
    );

    return clone(route);
  }

  function listRoutes(
    integrationId = null
  ) {
    let routes =
      Array.from(
        state.routes.values()
      );

    if (integrationId) {
      routes =
        routes.filter(
          route =>
            route.integrationId ===
            integrationId
        );
    }

    return clone(routes);
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

    const secret =
      "ezgw_" +
      crypto.randomBytes(36)
        .toString("hex");

    const record = {
      id:
        id("gateway_key"),

      name:
        input.name,

      keyHash:
        hash(secret),

      keyPrefix:
        secret.slice(
          0,
          14
        ),

      status:
        "active",

      permissions:
        Array.isArray(
          input.permissions
        )
          ? input.permissions
          : [],

      integrationId:
        input.integrationId ||
        null,

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
      record.id,
      record
    );

    await query(
      `
      INSERT INTO ez_api_keys
      (
        id,
        name,
        key_hash,
        key_prefix,
        status,
        permissions,
        integration_id,
        expires_at,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        record.id,
        record.name,
        record.keyHash,
        record.keyPrefix,
        record.status,
        JSON.stringify(
          record.permissions
        ),
        record.integrationId,
        record.expiresAt,
        record.createdAt
      ]
    );

    return {
      id:
        record.id,

      name:
        record.name,

      key:
        secret,

      prefix:
        record.keyPrefix,

      permissions:
        record.permissions,

      expiresAt:
        record.expiresAt
    };
  }

  async function authenticateApiKey(
    secret
  ) {
    if (!secret) return null;

    const keyHash =
      hash(secret);

    const record =
      Array.from(
        state.apiKeys.values()
      ).find(
        item =>
          item.keyHash ===
            keyHash &&
          item.status ===
            "active"
      );

    if (!record) {
      return null;
    }

    if (
      record.expiresAt &&
      new Date(
        record.expiresAt
      ).getTime() <=
        Date.now()
    ) {
      record.status =
        "expired";

      return null;
    }

    record.lastUsedAt =
      now();

    return {
      id:
        record.id,

      name:
        record.name,

      permissions:
        record.permissions,

      integrationId:
        record.integrationId
    };
  }

  /* ============================================================
     RATE LIMITING
  ============================================================ */

  function rateLimitKey(
    identifier
  ) {
    return String(
      identifier ||
        "anonymous"
    );
  }

  function checkRateLimit(
    identifier
  ) {
    const key =
      rateLimitKey(
        identifier
      );

    const current =
      state.rateLimits.get(
        key
      );

    const timestamp =
      Date.now();

    if (
      !current ||
      timestamp -
        current.startedAt >=
        60000
    ) {
      state.rateLimits.set(
        key,
        {
          startedAt:
            timestamp,

          count: 1
        }
      );

      return {
        allowed: true,
        remaining:
          maxRequestsPerMinute -
          1
      };
    }

    current.count++;

    if (
      current.count >
      maxRequestsPerMinute
    ) {
      state.statistics.blockedRequests++;

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds:
          Math.ceil(
            (
              60000 -
              (
                timestamp -
                current.startedAt
              )
            ) / 1000
          )
      };
    }

    return {
      allowed: true,
      remaining:
        maxRequestsPerMinute -
        current.count
    };
  }

  /* ============================================================
     HTTP REQUEST
  ============================================================ */

  async function request(
    input = {}
  ) {
    if (!state.running) {
      throw new Error(
        "API Gateway is stopped"
      );
    }

    if (
      !input.integrationId
    ) {
      throw new Error(
        "integrationId is required"
      );
    }

    const integration =
      state.integrations.get(
        input.integrationId
      );

    if (!integration) {
      throw new Error(
        "Integration not found"
      );
    }

    if (
      integration.status !==
      "active"
    ) {
      throw new Error(
        "Integration is not active"
      );
    }

    const route =
      input.routeId
        ? state.routes.get(
            input.routeId
          )
        : null;

    const targetPath =
      input.targetPath ||
      route?.targetPath ||
      input.path ||
      "/";

    const targetUrl =
      new URL(
        targetPath,
        integration.baseUrl
      ).toString();

    if (
      !isAllowedDomain(
        targetUrl,
        integration.allowedDomains
      )
    ) {
      throw new Error(
        "Target domain is not allowed"
      );
    }

    const limit =
      checkRateLimit(
        input.rateLimitIdentifier ||
          input.ipAddress ||
          input.userId ||
          integration.id
      );

    if (!limit.allowed) {
      throw new Error(
        "API Gateway rate limit exceeded"
      );
    }

    const method =
      String(
        input.method ||
          route?.method ||
          "GET"
      ).toUpperCase();

    const headers = {
      Accept:
        "application/json",

      ...(input.headers ||
        {})
    };

    const started =
      Date.now();

    let lastError =
      null;

    let retryCount = 0;

    for (
      let attempt = 0;
      attempt <=
      Number(
        input.retries ??
          route?.retries ??
          maxRetries
      );
      attempt++
    ) {
      try {
        if (attempt > 0) {
          retryCount++;
          state.statistics.retries++;

          await delay(
            Math.min(
              1000 *
                Math.pow(
                  2,
                  attempt - 1
                ),
              10000
            )
          );
        }

        const controller =
          new AbortController();

        const timeout =
          setTimeout(
            () =>
              controller.abort(),
            Number(
              input.timeoutMs ||
                route?.timeoutMs ||
                timeoutMs
            )
          );

        let body;

        if (
          input.body !==
            undefined &&
          !["GET", "HEAD"].includes(
            method
          )
        ) {
          body =
            typeof input.body ===
            "string"
              ? input.body
              : JSON.stringify(
                  input.body
                );

          if (
            !headers[
              "Content-Type"
            ]
          ) {
            headers[
              "Content-Type"
            ] =
              "application/json";
          }
        }

        const response =
          await fetch(
            targetUrl,
            {
              method,
              headers,
              body,
              signal:
                controller.signal
            }
          );

        clearTimeout(
          timeout
        );

        const latency =
          Date.now() -
          started;

        const text =
          await response.text();

        let parsed = text;

        try {
          parsed =
            text
              ? JSON.parse(text)
              : null;
        } catch {}

        const success =
          response.ok;

        state.statistics.requests++;

        if (success) {
          state.statistics
            .successfulRequests++;
        } else {
          state.statistics
            .failedRequests++;
        }

        updateAverageLatency(
          latency
        );

        await logRequest({
          integrationId:
            integration.id,

          routeId:
            route?.id ||
            null,

          method,

          path:
            targetPath,

          statusCode:
            response.status,

          success,

          latencyMs:
            latency,

          retryCount,

          requestId:
            input.requestId ||
            id("request"),

          userId:
            input.userId ||
            null,

          ipAddress:
            input.ipAddress ||
            null,

          errorCode:
            success
              ? null
              : `HTTP_${response.status}`,

          details: {
            targetUrl:
              redactUrl(
                targetUrl
              )
          }
        });

        if (
          !success &&
          attempt <
            Number(
              input.retries ??
                route?.retries ??
                maxRetries
            ) &&
          shouldRetryStatus(
            response.status
          )
        ) {
          continue;
        }

        return {
          ok:
            success,

          status:
            response.status,

          headers:
            Object.fromEntries(
              response.headers
            ),

          data:
            parsed,

          latencyMs:
            latency,

          retryCount
        };
      } catch (error) {
        lastError =
          error;

        state.statistics
          .failedRequests++;

        if (
          attempt >=
          Number(
            input.retries ??
              route?.retries ??
              maxRetries
          )
        ) {
          break;
        }
      }
    }

    const latency =
      Date.now() -
      started;

    await logRequest({
      integrationId:
        integration.id,

      routeId:
        route?.id ||
        null,

      method,

      path:
        targetPath,

      statusCode:
        0,

      success:
        false,

      latencyMs:
        latency,

      retryCount,

      requestId:
        input.requestId ||
        id("request"),

      userId:
        input.userId ||
        null,

      ipAddress:
        input.ipAddress ||
        null,

      errorCode:
        lastError?.name ||
        "GATEWAY_ERROR",

      details: {
        message:
          lastError?.message
      }
    });

    throw lastError ||
      new Error(
        "API Gateway request failed"
      );
  }

  function shouldRetryStatus(
    status
  ) {
    return (
      status === 408 ||
      status === 425 ||
      status === 429 ||
      status >= 500
    );
  }

  function redactUrl(
    value
  ) {
    try {
      const url =
        new URL(value);

      url.search =
        "";

      return url.toString();
    } catch {
      return "[redacted]";
    }
  }

  function delay(ms) {
    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          ms
        )
    );
  }

  function updateAverageLatency(
    latency
  ) {
    const count =
      state.statistics
        .successfulRequests +
      state.statistics
        .failedRequests;

    if (!count) {
      state.statistics
        .averageLatencyMs =
        latency;

      return;
    }

    state.statistics
      .averageLatencyMs =
      Math.round(
        (
          state.statistics
            .averageLatencyMs *
            (count - 1) +
          latency
        ) /
          count
      );
  }

  async function logRequest(
    input
  ) {
    const record = {
      id:
        id("api_request"),

      ...input,

      createdAt:
        now()
    };

    state.requestLogs.set(
      record.id,
      record
    );

    await query(
      `
      INSERT INTO ez_api_request_logs
      (
        id,
        integration_id,
        route_id,
        method,
        path,
        status_code,
        success,
        latency_ms,
        retry_count,
        request_id,
        user_id,
        ip_address,
        error_code,
        details,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,
        $14,$15
      )
      `,
      [
        record.id,
        record.integrationId,
        record.routeId,
        record.method,
        record.path,
        record.statusCode,
        record.success,
        record.latencyMs,
        record.retryCount,
        record.requestId,
        record.userId,
        record.ipAddress,
        record.errorCode,
        JSON.stringify(
          record.details
        ),
        record.createdAt
      ]
    );

    return record;
  }

  /* ============================================================
     WEBHOOKS
  ============================================================ */

  async function createWebhook(
    input = {}
  ) {
    if (
      !input.name ||
      !input.path
    ) {
      throw new Error(
        "Webhook name and path are required"
      );
    }

    const secret =
      "whsec_" +
      crypto.randomBytes(32)
        .toString("hex");

    const webhook = {
      id:
        id("webhook"),

      name:
        input.name,

      path:
        input.path,

      secretHash:
        hash(secret),

      status:
        "active",

      integrationId:
        input.integrationId ||
        null,

      events:
        Array.isArray(
          input.events
        )
          ? input.events
          : [],

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.webhookEndpoints.set(
      webhook.id,
      webhook
    );

    state.statistics.webhooks++;

    await query(
      `
      INSERT INTO ez_api_webhooks
      (
        id,
        name,
        path,
        secret_hash,
        status,
        integration_id,
        events,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        webhook.id,
        webhook.name,
        webhook.path,
        webhook.secretHash,
        webhook.status,
        webhook.integrationId,
        JSON.stringify(
          webhook.events
        ),
        JSON.stringify(
          webhook.metadata
        ),
        webhook.createdAt,
        webhook.updatedAt
      ]
    );

    return {
      id:
        webhook.id,

      name:
        webhook.name,

      path:
        webhook.path,

      secret,

      events:
        webhook.events
    };
  }

  verifyWebhookSignature(
    payload,
    signature,
    secret
  ) {
    if (
      !signature ||
      !secret
    ) {
      return false;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(
          typeof payload ===
            "string"
            ? payload
            : JSON.stringify(
                payload
              )
        )
        .digest("hex");

    const received =
      String(signature)
        .replace(
          /^sha256=/i,
          ""
        );

    if (
      expected.length !==
      received.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(received)
    );
  }

  async function receiveWebhook(
    webhookId,
    input = {}
  ) {
    const webhook =
      state.webhookEndpoints.get(
        webhookId
      );

    if (!webhook) {
      throw new Error(
        "Webhook not found"
      );
    }

    if (
      webhook.status !==
      "active"
    ) {
      throw new Error(
        "Webhook is not active"
      );
    }

    const event = {
      id:
        id("webhook_event"),

      webhookId,

      eventType:
        input.eventType ||
        "webhook.received",

      eventId:
        input.eventId ||
        id("external_event"),

      signatureValid:
        Boolean(
          input.signatureValid
        ),

      processed:
        false,

      payload:
        input.payload ||
        {},

      error:
        null,

      createdAt:
        now(),

      processedAt:
        null
    };

    state.webhookEvents.set(
      event.id,
      event
    );

    state.statistics
      .webhookEvents++;

    await query(
      `
      INSERT INTO ez_api_webhook_events
      (
        id,
        webhook_id,
        event_type,
        event_id,
        signature_valid,
        processed,
        payload,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        event.id,
        event.webhookId,
        event.eventType,
        event.eventId,
        event.signatureValid,
        event.processed,
        JSON.stringify(
          event.payload
        ),
        event.createdAt
      ]
    );

    emit(
      "api.webhook.received",
      clone(event)
    );

    if (
      workflowEngine &&
      typeof workflowEngine
        .triggerEvent ===
        "function"
    ) {
      try {
        await workflowEngine
          .triggerEvent(
            "webhook.received",
            event
          );
      } catch (error) {
        logger.warn(
          "[CODE83] Workflow webhook trigger failed:",
          error.message
        );
      }
    }

    event.processed =
      true;

    event.processedAt =
      now();

    await query(
      `
      UPDATE ez_api_webhook_events
      SET
        processed=true,
        processed_at=NOW()
      WHERE id=$1
      `,
      [event.id]
    );

    return clone(event);
  }

  /* ============================================================
     AI INTEGRATION ANALYSIS
  ============================================================ */

  async function analyzeIntegration(
    integrationId
  ) {
    const integration =
      state.integrations.get(
        integrationId
      );

    if (!integration) {
      throw new Error(
        "Integration not found"
      );
    }

    let ai = null;

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        ai =
          await aiCore.request({
            operation:
              "integration-analysis",

            input: {
              integration:
                sanitizeIntegration(
                  integration
                ),

              routes:
                listRoutes(
                  integrationId
                )
            }
          });
      } catch (error) {
        logger.warn(
          "[CODE83] AI integration analysis unavailable:",
          error.message
        );
      }
    }

    return {
      integration:
        sanitizeIntegration(
          integration
        ),

      routes:
        listRoutes(
          integrationId
        ),

      aiAnalysis:
        ai,

      analyzedAt:
        now()
    };
  }

  /* ============================================================
     STATISTICS / HEALTH
  ============================================================ */

  function getStatistics() {
    return {
      ...state.statistics,

      integrationCache:
        state.integrations.size,

      routeCache:
        state.routes.size,

      apiKeyCache:
        state.apiKeys.size,

      requestLogCache:
        state.requestLogs.size,

      webhookCache:
        state.webhookEndpoints.size,

      webhookEventCache:
        state.webhookEvents.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent API Gateway & Integration Hub",

      code:
        "83",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      configuration: {
        timeoutMs,
        maxRetries,
        maxIntegrations,
        maxRequestsPerMinute
      },

      integrations: {
        persistence:
          Boolean(persistence),

        security:
          Boolean(securityEngine),

        aiCore:
          Boolean(aiCore),

        aiOrchestrator:
          Boolean(aiOrchestrator),

        workflow:
          Boolean(workflowEngine),

        automation:
          Boolean(automationEngine)
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
      "api-gateway.started",
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
      "api-gateway.stopped",
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

    createIntegration,
    getIntegration,
    listIntegrations,
    updateIntegration,

    createRoute,
    listRoutes,

    createApiKey,
    authenticateApiKey,

    request,

    createWebhook,
    verifyWebhookSignature,
    receiveWebhook,

    analyzeIntegration,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentAPIGateway
};
