/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 66
 * News Source Ingestion Hub
 * ============================================================
 *
 * الوظيفة:
 *
 * SOURCE
 *   ↓
 * FETCH
 *   ↓
 * VALIDATE
 *   ↓
 * PARSE
 *   ↓
 * NORMALIZE
 *   ↓
 * DEDUPLICATE
 *   ↓
 * BREAKING NEWS ENGINE
 *   ↓
 * CODE 65
 *
 * أنواع المصادر:
 *
 * - RSS
 * - Atom
 * - JSON API
 * - Webhook
 * - Internal Source
 *
 * ============================================================
 */

"use strict";

const crypto = require("crypto");
const EventEmitter = require("events");

function createNewsSourceIngestion(options = {}) {
  const {
    persistence = null,
    breakingNewsEngine = null,
    automationEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    requestTimeout = Number(
      process.env.NEWS_SOURCE_TIMEOUT_MS || 20000
    ),

    maxRetries = Number(
      process.env.NEWS_SOURCE_MAX_RETRIES || 3
    ),

    concurrency = Number(
      process.env.NEWS_SOURCE_CONCURRENCY || 3
    ),

    defaultInterval = Number(
      process.env.NEWS_SOURCE_DEFAULT_INTERVAL_MS || 300000
    ),

    maxResponseBytes = Number(
      process.env.NEWS_SOURCE_MAX_RESPONSE_BYTES ||
      5 * 1024 * 1024
    ),

    userAgent =
      process.env.NEWS_SOURCE_USER_AGENT ||
      "EZ-MEDIA-News-Ingestion/11.0"
  } = options;

  const emitter = new EventEmitter();

  const state = {
    initialized: false,
    running: false,
    paused: false,

    sources: new Map(),
    jobs: new Map(),
    processing: new Set(),

    statistics: {
      sourcesCreated: 0,
      sourcesUpdated: 0,
      sourcesDeleted: 0,

      fetches: 0,
      successfulFetches: 0,
      failedFetches: 0,

      itemsReceived: 0,
      itemsAccepted: 0,
      itemsDuplicated: 0,
      itemsRejected: 0,

      webhookReceived: 0,

      totalLatency: 0,
      averageLatency: 0
    },

    lastRunAt: null,
    startedAt: null,
    stoppedAt: null
  };

  /* =========================================================
     أدوات عامة
  ========================================================= */

  function id(prefix = "source") {
    return `${prefix}_${Date.now()}_${crypto
      .randomBytes(6)
      .toString("hex")}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function cleanText(value) {
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

  function normalizeText(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(normalizeText(value))
      .digest("hex");
  }

  function parseJSON(value, fallback = null) {
    if (!value) return fallback;

    if (
      typeof value === "object"
    ) {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function emit(event, payload = {}) {
    try {
      emitter.emit(
        event,
        payload
      );

      if (
        eventBus &&
        typeof eventBus.emit ===
          "function"
      ) {
        eventBus.emit(
          event,
          payload
        );
      }
    } catch (error) {
      logger.error(
        "[NEWS INGESTION] Event error:",
        error
      );
    }
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    const n = Number(value);

    if (!Number.isFinite(n)) {
      return min;
    }

    return Math.min(
      max,
      Math.max(min, n)
    );
  }

  /* =========================================================
     URL Security
  ========================================================= */

  function validateSourceUrl(
    rawUrl,
    options = {}
  ) {
    if (!rawUrl) {
      throw new Error(
        "Source URL is required"
      );
    }

    let parsed;

    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(
        "Invalid source URL"
      );
    }

    const allowedProtocols =
      options.allowedProtocols || [
        "https:"
      ];

    if (
      !allowedProtocols.includes(
        parsed.protocol
      )
    ) {
      throw new Error(
        "Only HTTPS source URLs are allowed"
      );
    }

    const hostname =
      parsed.hostname.toLowerCase();

    /*
     * منع العناوين الداخلية الخطرة افتراضيًا.
     */

    const blockedHosts = [
      "localhost",
      "localhost.localdomain",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "169.254.169.254",
      "metadata.google.internal"
    ];

    if (
      blockedHosts.includes(
        hostname
      )
    ) {
      throw new Error(
        "Private/internal hostname is not allowed"
      );
    }

    /*
     * منع IPv4 الداخلي الشائع.
     */

    if (
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(
        hostname
      )
    ) {
      throw new Error(
        "Private network address is not allowed"
      );
    }

    return parsed.toString();
  }

  /* =========================================================
     Persistence
  ========================================================= */

  async function initialize() {
    if (
      state.initialized
    ) {
      return getStatus();
    }

    state.initialized = true;

    await ensurePersistence();

    await loadSources();

    emit(
      "news-source-ingestion.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  async function ensurePersistence() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_news_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT,
        category TEXT,
        language TEXT DEFAULT 'ar',
        country TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        interval_ms BIGINT DEFAULT 300000,
        timeout_ms BIGINT DEFAULT 20000,
        max_retries INTEGER DEFAULT 3,
        headers JSONB,
        config JSONB,
        status TEXT DEFAULT 'idle',
        last_fetch_at TIMESTAMPTZ,
        last_success_at TIMESTAMPTZ,
        last_failure_at TIMESTAMPTZ,
        last_error TEXT,
        fetch_count BIGINT DEFAULT 0,
        success_count BIGINT DEFAULT 0,
        failure_count BIGINT DEFAULT 0,
        item_count BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_news_sources_enabled
      ON ez_news_sources(enabled)
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_news_source_items (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        external_id TEXT,
        item_hash TEXT NOT NULL,
        title TEXT,
        description TEXT,
        content TEXT,
        url TEXT,
        author TEXT,
        published_at TIMESTAMPTZ,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB,
        UNIQUE(source_id, item_hash)
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_news_source_items_hash
      ON ez_news_source_items(item_hash)
    `);
  }

  async function loadSources() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    try {
      const result =
        await persistence.query(`
          SELECT *
          FROM ez_news_sources
          ORDER BY created_at ASC
        `);

      for (
        const row of
          result.rows || []
      ) {
        state.sources.set(
          row.id,
          deserializeSource(row)
        );
      }
    } catch (error) {
      logger.error(
        "[NEWS INGESTION] Source loading failed:",
        error
      );
    }
  }

  /* =========================================================
     Source normalization
  ========================================================= */

  function normalizeSource(input = {}) {
    const name =
      cleanText(
        input.name ||
        input.title
      );

    if (!name) {
      throw new Error(
        "Source name is required"
      );
    }

    const type =
      cleanText(
        input.type ||
        "rss"
      ).toLowerCase();

    const allowedTypes = [
      "rss",
      "atom",
      "json",
      "api",
      "webhook",
      "internal"
    ];

    if (
      !allowedTypes.includes(
        type
      )
    ) {
      throw new Error(
        `Unsupported source type: ${type}`
      );
    }

    let url =
      input.url ||
      input.endpoint ||
      "";

    if (
      type !== "webhook" &&
      type !== "internal"
    ) {
      url =
        validateSourceUrl(
          url
        );
    }

    return {
      id:
        input.id ||
        id("source"),

      name,

      type,

      url,

      category:
        cleanText(
          input.category ||
          "general"
        ),

      language:
        cleanText(
          input.language ||
          "ar"
        ),

      country:
        cleanText(
          input.country ||
          ""
        ),

      enabled:
        input.enabled !== false,

      intervalMs:
        Math.max(
          30000,
          Number(
            input.intervalMs ||
            defaultInterval
          )
        ),

      timeoutMs:
        Math.max(
          5000,
          Number(
            input.timeoutMs ||
            requestTimeout
          )
        ),

      maxRetries:
        Math.max(
          0,
          Number(
            input.maxRetries ??
            maxRetries
          )
        ),

      headers:
        input.headers &&
        typeof input.headers ===
          "object"
          ? input.headers
          : {},

      config:
        input.config &&
        typeof input.config ===
          "object"
          ? input.config
          : {},

      status:
        "idle",

      lastFetchAt:
        null,

      lastSuccessAt:
        null,

      lastFailureAt:
        null,

      lastError:
        null,

      fetchCount:
        0,

      successCount:
        0,

      failureCount:
        0,

      itemCount:
        0,

      createdAt:
        now(),

      updatedAt:
        now()
    };
  }

  /* =========================================================
     CRUD Sources
  ========================================================= */

  async function createSource(
    input
  ) {
    const source =
      normalizeSource(
        input
      );

    if (
      state.sources.has(
        source.id
      )
    ) {
      throw new Error(
        "Source ID already exists"
      );
    }

    state.sources.set(
      source.id,
      source
    );

    await persistSource(
      source
    );

    state.statistics.sourcesCreated +=
      1;

    emit(
      "news-source.created",
      {
        source:
          safeClone(source)
      }
    );

    scheduleSource(
      source
    );

    return source;
  }

  async function updateSource(
    sourceId,
    changes = {}
  ) {
    const source =
      state.sources.get(
        sourceId
      );

    if (!source) {
      throw new Error(
        "Source not found"
      );
    }

    if (
      changes.url
    ) {
      changes.url =
        validateSourceUrl(
          changes.url
        );
    }

    const mutableFields = [
      "name",
      "type",
      "url",
      "category",
      "language",
      "country",
      "enabled",
      "intervalMs",
      "timeoutMs",
      "maxRetries",
      "headers",
      "config"
    ];

    for (
      const field of
        mutableFields
    ) {
      if (
        changes[field] !==
        undefined
      ) {
        source[field] =
          changes[field];
      }
    }

    source.updatedAt =
      now();

    await persistSource(
      source
    );

    state.statistics.sourcesUpdated +=
      1;

    rescheduleSource(
      source
    );

    emit(
      "news-source.updated",
      {
        source:
          safeClone(source)
      }
    );

    return source;
  }

  async function deleteSource(
    sourceId
  ) {
    const source =
      state.sources.get(
        sourceId
      );

    if (!source) {
      throw new Error(
        "Source not found"
      );
    }

    cancelSourceJob(
      sourceId
    );

    state.sources.delete(
      sourceId
    );

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        DELETE FROM ez_news_sources
        WHERE id = $1
        `,
        [sourceId]
      );
    }

    state.statistics.sourcesDeleted +=
      1;

    emit(
      "news-source.deleted",
      {
        sourceId
      }
    );

    return {
      deleted: true,
      sourceId
    };
  }

  async function enableSource(
    sourceId
  ) {
    return updateSource(
      sourceId,
      {
        enabled: true
      }
    );
  }

  async function disableSource(
    sourceId
  ) {
    return updateSource(
      sourceId,
      {
        enabled: false
      }
    );
  }

  function getSource(
    sourceId
  ) {
    const source =
      state.sources.get(
        sourceId
      );

    return source
      ? safeClone(source)
      : null;
  }

  function listSources(
    options = {}
  ) {
    let sources =
      Array.from(
        state.sources.values()
      );

    if (
      options.enabled !==
      undefined
    ) {
      sources =
        sources.filter(
          source =>
            source.enabled ===
            Boolean(
              options.enabled
            )
        );
    }

    if (
      options.type
    ) {
      sources =
        sources.filter(
          source =>
            source.type ===
            options.type
        );
    }

    return sources.map(
      safeClone
    );
  }

  /* =========================================================
     تشغيل المحرك
  ========================================================= */

  async function start() {
    if (
      !state.initialized
    ) {
      await initialize();
    }

    if (
      state.running
    ) {
      return getStatus();
    }

    state.running = true;
    state.paused = false;
    state.startedAt =
      now();

    for (
      const source of
        state.sources.values()
    ) {
      if (
        source.enabled
      ) {
        scheduleSource(
          source
        );
      }
    }

    emit(
      "news-source-ingestion.started",
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

    state.stoppedAt =
      now();

    for (
      const sourceId of
        state.jobs.keys()
    ) {
      cancelSourceJob(
        sourceId
      );
    }

    emit(
      "news-source-ingestion.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function pause() {
    state.paused =
      true;

    emit(
      "news-source-ingestion.paused",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function resume() {
    state.paused =
      false;

    if (
      !state.running
    ) {
      state.running =
        true;
    }

    for (
      const source of
        state.sources.values()
    ) {
      if (
        source.enabled
      ) {
        scheduleSource(
          source
        );
      }
    }

    emit(
      "news-source-ingestion.resumed",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* =========================================================
     Scheduler
  ========================================================= */

  function scheduleSource(
    source
  ) {
    cancelSourceJob(
      source.id
    );

    if (
      !state.running ||
      state.paused ||
      !source.enabled
    ) {
      return;
    }

    const timer =
      setInterval(
        () => {
          fetchSource(
            source.id
          ).catch(
            error =>
              logger.error(
                "[NEWS INGESTION] Scheduled fetch failed:",
                error
              )
          );
        },
        source.intervalMs
      );

    state.jobs.set(
      source.id,
      timer
    );

    /*
     * أول جلب مباشرة.
     */

    setImmediate(() => {
      fetchSource(
        source.id
      ).catch(
        error =>
          logger.error(
            "[NEWS INGESTION] Initial fetch failed:",
            error
          )
      );
    });
  }

  function rescheduleSource(
    source
  ) {
    scheduleSource(
      source
    );
  }

  function cancelSourceJob(
    sourceId
  ) {
    const timer =
      state.jobs.get(
        sourceId
      );

    if (timer) {
      clearInterval(
        timer
      );

      state.jobs.delete(
        sourceId
      );
    }
  }

  /* =========================================================
     Fetch Source
  ========================================================= */

  async function fetchSource(
    sourceId,
    options = {}
  ) {
    if (
      !state.running ||
      state.paused
    ) {
      return {
        skipped: true,
        reason:
          "engine_not_running"
      };
    }

    const source =
      state.sources.get(
        sourceId
      );

    if (!source) {
      throw new Error(
        "Source not found"
      );
    }

    if (
      !source.enabled
    ) {
      return {
        skipped: true,
        reason:
          "source_disabled"
      };
    }

    if (
      state.processing.size >=
      concurrency
    ) {
      return {
        skipped: true,
        reason:
          "concurrency_limit"
      };
    }

    state.processing.add(
      sourceId
    );

    const started =
      Date.now();

    source.status =
      "fetching";

    source.lastFetchAt =
      now();

    source.fetchCount +=
      1;

    state.statistics.fetches +=
      1;

    try {
      let response;

      if (
        source.type ===
        "webhook"
      ) {
        throw new Error(
          "Webhook sources receive data through the webhook API"
        );
      }

      if (
        source.type ===
        "internal"
      ) {
        response =
          await fetchInternalSource(
            source
          );
      } else {
        response =
          await fetchRemoteSource(
            source
          );
      }

      const items =
        parseSourceResponse(
          source,
          response
        );

      state.statistics.itemsReceived +=
        items.length;

      const accepted =
        await processItems(
          source,
          items
        );

      source.status =
        "healthy";

      source.lastSuccessAt =
        now();

      source.lastError =
        null;

      source.successCount +=
        1;

      source.itemCount +=
        accepted;

      state.statistics.successfulFetches +=
        1;

      const latency =
        Date.now() -
        started;

      state.statistics.totalLatency +=
        latency;

      state.statistics.averageLatency =
        state.statistics.totalLatency /
        Math.max(
          1,
          state.statistics.successfulFetches
        );

      state.lastRunAt =
        now();

      await persistSource(
        source
      );

      emit(
        "news-source.fetch.success",
        {
          sourceId,
          source:
            safeClone(source),
          itemsReceived:
            items.length,
          itemsAccepted:
            accepted,
          latency
        }
      );

      return {
        ok: true,
        sourceId,
        itemsReceived:
          items.length,
        itemsAccepted:
          accepted,
        latency
      };
    } catch (error) {
      source.status =
        "error";

      source.lastFailureAt =
        now();

      source.lastError =
        error.message;

      source.failureCount +=
        1;

      state.statistics.failedFetches +=
        1;

      await persistSource(
        source
      );

      emit(
        "news-source.fetch.failed",
        {
          sourceId,
          error:
            error.message
        }
      );

      throw error;
    } finally {
      state.processing.delete(
        sourceId
      );
    }
  }

  /* =========================================================
     Remote Fetch
  ========================================================= */

  async function fetchRemoteSource(
    source
  ) {
    let lastError =
      null;

    for (
      let attempt = 0;
      attempt <= source.maxRetries;
      attempt++
    ) {
      try {
        return await request(
          source.url,
          {
            timeout:
              source.timeoutMs,
            headers:
              source.headers
          }
        );
      } catch (error) {
        lastError =
          error;

        if (
          attempt <
          source.maxRetries
        ) {
          await sleep(
            backoffDelay(
              attempt
            )
          );
        }
      }
    }

    throw lastError ||
      new Error(
        "Source request failed"
      );
  }

  async function request(
    url,
    options = {}
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        options.timeout ||
          requestTimeout
      );

    try {
      const headers = {
        "User-Agent":
          userAgent,

        Accept:
          "application/rss+xml, application/atom+xml, application/json, text/xml, text/plain;q=0.9, */*;q=0.8",

        ...(options.headers || {})
      };

      const response =
        await fetch(
          validateSourceUrl(
            url
          ),
          {
            method:
              "GET",

            headers,

            redirect:
              "follow",

            signal:
              controller.signal
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const contentLength =
        Number(
          response.headers.get(
            "content-length"
          ) || 0
        );

      if (
        contentLength >
        maxResponseBytes
      ) {
        throw new Error(
          "Response exceeds configured size limit"
        );
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      const buffer =
        await readResponseWithLimit(
          response,
          maxResponseBytes
        );

      return {
        body:
          buffer.toString(
            "utf8"
          ),

        contentType,

        status:
          response.status,

        headers:
          Object.fromEntries(
            response.headers.entries()
          )
      };
    } finally {
      clearTimeout(
        timeout
      );
    }
  }

  async function readResponseWithLimit(
    response,
    limit
  ) {
    if (
      !response.body
    ) {
      const text =
        await response.text();

      if (
        Buffer.byteLength(
          text,
          "utf8"
        ) > limit
      ) {
        throw new Error(
          "Response exceeds configured size limit"
        );
      }

      return Buffer.from(
        text,
        "utf8"
      );
    }

    const reader =
      response.body.getReader();

    const chunks = [];

    let total = 0;

    while (true) {
      const {
        done,
        value
      } = await reader.read();

      if (done) break;

      total +=
        value.byteLength;

      if (
        total > limit
      ) {
        try {
          await reader.cancel();
        } catch {}

        throw new Error(
          "Response exceeds configured size limit"
        );
      }

      chunks.push(
        Buffer.from(value)
      );
    }

    return Buffer.concat(
      chunks
    );
  }

  /* =========================================================
     Internal Source
  ========================================================= */

  async function fetchInternalSource(
    source
  ) {
    emit(
      "news-source.internal.request",
      {
        source:
          safeClone(source)
      }
    );

    return {
      body:
        source.config?.payload ||
        "",
      contentType:
        source.config?.contentType ||
        "application/json",
      status: 200,
      headers: {}
    };
  }

  /* =========================================================
     Parsing
  ========================================================= */

  function parseSourceResponse(
    source,
    response
  ) {
    const body =
      response.body || "";

    if (
      source.type ===
      "json" ||
      source.type ===
      "api"
    ) {
      return parseJSONItems(
        body,
        source
      );
    }

    if (
      source.type ===
      "rss" ||
      source.type ===
      "atom"
    ) {
      return parseXmlItems(
        body,
        source
      );
    }

    return [];
  }

  /* =========================================================
     JSON Parser
  ========================================================= */

  function parseJSONItems(
    body,
    source
  ) {
    const parsed =
      parseJSON(body);

    if (!parsed) {
      throw new Error(
        "Invalid JSON source response"
      );
    }

    let items =
      getPath(
        parsed,
        source.config?.itemsPath ||
        "items"
      );

    if (
      !Array.isArray(items)
    ) {
      if (
        Array.isArray(parsed)
      ) {
        items = parsed;
      } else {
        items = [parsed];
      }
    }

    return items
      .map(
        item =>
          normalizeSourceItem(
            item,
            source
          )
      )
      .filter(Boolean);
  }

  function getPath(
    object,
    path
  ) {
    if (
      !path ||
      path === "."
    ) {
      return object;
    }

    return path
      .split(".")
      .reduce(
        (current, key) =>
          current === undefined ||
          current === null
            ? undefined
            : current[key],
        object
      );
  }

  /* =========================================================
     XML / RSS / Atom
  ========================================================= */

  function parseXmlItems(
    xml,
    source
  ) {
    /*
     * Parser خفيف مخصص لـ RSS/Atom.
     * لا يعتمد على مكتبة خارجية.
     */

    const items = [];

    const rssBlocks =
      extractBlocks(
        xml,
        "item"
      );

    const atomBlocks =
      extractBlocks(
        xml,
        "entry"
      );

    const blocks =
      rssBlocks.length
        ? rssBlocks
        : atomBlocks;

    for (
      const block of blocks
    ) {
      const isAtom =
        block.tagName ===
        "entry";

      const title =
        extractXmlText(
          block.xml,
          "title"
        );

      const description =
        extractXmlText(
          block.xml,
          isAtom
            ? "summary"
            : "description"
        ) ||
        extractXmlText(
          block.xml,
          "content"
        );

      const content =
        extractXmlText(
          block.xml,
          "content:encoded"
        ) ||
        extractXmlText(
          block.xml,
          "content"
        ) ||
        description;

      const guid =
        extractXmlText(
          block.xml,
          "guid"
        ) ||
        extractXmlText(
          block.xml,
          "id"
        );

      const link =
        extractXmlLink(
          block.xml,
          isAtom
        );

      const author =
        extractXmlText(
          block.xml,
          isAtom
            ? "name"
            : "author"
        );

      const published =
        extractXmlText(
          block.xml,
          "pubDate"
        ) ||
        extractXmlText(
          block.xml,
          "published"
        ) ||
        extractXmlText(
          block.xml,
          "updated"
        );

      if (!title) {
        continue;
      }

      items.push(
        normalizeSourceItem(
          {
            id: guid,
            guid,
            title,
            description,
            content,
            link,
            url: link,
            author,
            publishedAt:
              published
          },
          source
        )
      );
    }

    return items.filter(
      Boolean
    );
  }

  function extractBlocks(
    xml,
    tagName
  ) {
    const results = [];

    const regex =
      new RegExp(
        `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
        "gi"
      );

    let match;

    while (
      (match =
        regex.exec(xml))
    ) {
      results.push({
        tagName,
        xml:
          match[1]
      });
    }

    return results;
  }

  function extractXmlText(
    xml,
    tagName
  ) {
    const escaped =
      tagName.replace(
        /[-/\\^$*+?.()|[\]{}]/g,
        "\\$&"
      );

    const regex =
      new RegExp(
        `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
        "i"
      );

    const match =
      regex.exec(xml);

    if (!match) {
      return "";
    }

    return stripXml(
      decodeEntities(
        match[1]
      )
    );
  }

  function extractXmlLink(
    xml,
    isAtom
  ) {
    if (isAtom) {
      const match =
        /<link[^>]+href=["']([^"']+)["'][^>]*>/i.exec(
          xml
        );

      if (
        match &&
        match[1]
      ) {
        return match[1];
      }
    }

    return (
      extractXmlText(
        xml,
        "link"
      ) || ""
    );
  }

  function stripXml(
    value
  ) {
    return cleanText(
      String(value)
        .replace(
          /<!\[CDATA\[([\s\S]*?)\]\]>/gi,
          "$1"
        )
        .replace(
          /<[^>]+>/g,
          " "
        )
    );
  }

  function decodeEntities(
    value
  ) {
    return String(value)
      .replace(
        /&amp;/g,
        "&"
      )
      .replace(
        /&lt;/g,
        "<"
      )
      .replace(
        /&gt;/g,
        ">"
      )
      .replace(
        /&quot;/g,
        '"'
      )
      .replace(
        /&#39;/g,
        "'"
      )
      .replace(
        /&#x27;/gi,
        "'"
      );
  }

  /* =========================================================
     Normalize Item
  ========================================================= */

  function normalizeSourceItem(
    item,
    source
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      return null;
    }

    const title =
      cleanText(
        item.title ||
        item.headline ||
        item.name
      );

    if (!title) {
      return null;
    }

    const description =
      cleanText(
        item.description ||
        item.summary ||
        item.excerpt
      );

    const content =
      cleanText(
        item.content ||
        item.body ||
        item.text ||
        description
      );

    const url =
      cleanText(
        item.url ||
        item.link ||
        item.sourceUrl ||
        ""
      );

    const externalId =
      cleanText(
        item.externalId ||
        item.guid ||
        item.id ||
        url
      );

    const publishedAt =
      normalizeDate(
        item.publishedAt ||
        item.pubDate ||
        item.published ||
        item.date
      );

    const itemHash =
      hash(
        `${title}|${url}|${publishedAt || ""}`
      );

    return {
      id:
        id("item"),

      sourceId:
        source.id,

      externalId,

      itemHash,

      title,

      description,

      content,

      url,

      author:
        cleanText(
          item.author ||
          ""
        ),

      publishedAt,

      receivedAt:
        now(),

      metadata: {
        sourceType:
          source.type,

        sourceName:
          source.name,

        sourceCategory:
          source.category,

        sourceLanguage:
          source.language,

        raw:
          item
      }
    };
  }

  function normalizeDate(
    value
  ) {
    if (!value) {
      return null;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date.toISOString();
  }

  /* =========================================================
     Process Items
  ========================================================= */

  async function processItems(
    source,
    items
  ) {
    let accepted = 0;

    for (
      const item of items
    ) {
      const isDuplicate =
        await isItemDuplicate(
          source.id,
          item
        );

      if (
        isDuplicate
      ) {
        state.statistics.itemsDuplicated +=
          1;

        emit(
          "news-source.item.duplicate",
          {
            sourceId:
              source.id,
            item:
              safeClone(item)
          }
        );

        continue;
      }

      const saved =
        await persistItem(
          item
        );

      if (!saved) {
        state.statistics.itemsRejected +=
          1;

        continue;
      }

      state.statistics.itemsAccepted +=
        1;

      accepted +=
        1;

      emit(
        "news-source.item.accepted",
        {
          sourceId:
            source.id,
          item:
            safeClone(item)
        }
      );

      await sendToBreakingNews(
        source,
        item
      );
    }

    return accepted;
  }

  async function isItemDuplicate(
    sourceId,
    item
  ) {
    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      try {
        const result =
          await persistence.query(
            `
            SELECT id
            FROM ez_news_source_items
            WHERE source_id = $1
            AND item_hash = $2
            LIMIT 1
            `,
            [
              sourceId,
              item.itemHash
            ]
          );

        if (
          result.rows &&
          result.rows.length
        ) {
          return true;
        }
      } catch (error) {
        logger.error(
          "[NEWS INGESTION] Duplicate check failed:",
          error
        );
      }
    }

    return false;
  }

  async function persistItem(
    item
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return true;
    }

    try {
      await persistence.query(
        `
        INSERT INTO ez_news_source_items (
          id,
          source_id,
          external_id,
          item_hash,
          title,
          description,
          content,
          url,
          author,
          published_at,
          received_at,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12
        )
        ON CONFLICT (
          source_id,
          item_hash
        )
        DO NOTHING
        `,
        [
          item.id,
          item.sourceId,
          item.externalId,
          item.itemHash,
          item.title,
          item.description,
          item.content,
          item.url,
          item.author,
          item.publishedAt,
          item.receivedAt,
          JSON.stringify(
            item.metadata
          )
        ]
      );

      return true;
    } catch (error) {
      logger.error(
        "[NEWS INGESTION] Item persistence failed:",
        error
      );

      return false;
    }
  }

  /* =========================================================
     إرسال CODE 65
  ========================================================= */

  async function sendToBreakingNews(
    source,
    item
  ) {
    if (
      !breakingNewsEngine ||
      typeof breakingNewsEngine.ingest !==
        "function"
    ) {
      throw new Error(
        "Breaking News Engine is not connected"
      );
    }

    const news =
      await breakingNewsEngine.ingest({
        title:
          item.title,

        description:
          item.description,

        content:
          item.content,

        source:
          source.name,

        sourceUrl:
          item.url,

        externalId:
          item.externalId,

        category:
          source.category ||
          "general",

        priority:
          source.config?.priority ||
          "medium",

        sources: [
          {
            name:
              source.name,

            url:
              item.url,

            sourceId:
              source.id
          }
        ],

        receivedAt:
          item.receivedAt,

        metadata: {
          ingestionSourceId:
            source.id,

          ingestionSourceType:
            source.type,

          ingestionSourceName:
            source.name,

          sourceItemId:
            item.id
        }
      });

    emit(
      "news-source.sent-to-breaking-news",
      {
        sourceId:
          source.id,

        itemId:
          item.id,

        newsId:
          news.id
      }
    );

    return news;
  }

  /* =========================================================
     Webhook
  ========================================================= */

  async function receiveWebhook(
    sourceId,
    payload,
    options = {}
  ) {
    const source =
      state.sources.get(
        sourceId
      );

    if (!source) {
      throw new Error(
        "Source not found"
      );
    }

    if (
      source.type !==
      "webhook"
    ) {
      throw new Error(
        "Source is not configured as webhook"
      );
    }

    if (
      !source.enabled
    ) {
      throw new Error(
        "Source is disabled"
      );
    }

    state.statistics.webhookReceived +=
      1;

    const rawItems =
      Array.isArray(
        payload
      )
        ? payload
        : Array.isArray(
            payload?.items
          )
          ? payload.items
          : [payload];

    const items =
      rawItems
        .map(
          item =>
            normalizeSourceItem(
              item,
              source
            )
        )
        .filter(Boolean);

    const accepted =
      await processItems(
        source,
        items
      );

    source.itemCount +=
      accepted;

    await persistSource(
      source
    );

    emit(
      "news-source.webhook.received",
      {
        sourceId,
        received:
          items.length,
        accepted
      }
    );

    return {
      ok: true,
      sourceId,
      received:
        items.length,
      accepted
    };
  }

  /* =========================================================
     Source Persistence
  ========================================================= */

  async function persistSource(
    source
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_news_sources (
        id,
        name,
        type,
        url,
        category,
        language,
        country,
        enabled,
        interval_ms,
        timeout_ms,
        max_retries,
        headers,
        config,
        status,
        last_fetch_at,
        last_success_at,
        last_failure_at,
        last_error,
        fetch_count,
        success_count,
        failure_count,
        item_count,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24
      )
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        url = EXCLUDED.url,
        category = EXCLUDED.category,
        language = EXCLUDED.language,
        country = EXCLUDED.country,
        enabled = EXCLUDED.enabled,
        interval_ms = EXCLUDED.interval_ms,
        timeout_ms = EXCLUDED.timeout_ms,
        max_retries = EXCLUDED.max_retries,
        headers = EXCLUDED.headers,
        config = EXCLUDED.config,
        status = EXCLUDED.status,
        last_fetch_at = EXCLUDED.last_fetch_at,
        last_success_at = EXCLUDED.last_success_at,
        last_failure_at = EXCLUDED.last_failure_at,
        last_error = EXCLUDED.last_error,
        fetch_count = EXCLUDED.fetch_count,
        success_count = EXCLUDED.success_count,
        failure_count = EXCLUDED.failure_count,
        item_count = EXCLUDED.item_count,
        updated_at = NOW()
      `,
      [
        source.id,
        source.name,
        source.type,
        source.url,
        source.category,
        source.language,
        source.country,
        source.enabled,
        source.intervalMs,
        source.timeoutMs,
        source.maxRetries,
        JSON.stringify(
          source.headers
        ),
        JSON.stringify(
          source.config
        ),
        source.status,
        source.lastFetchAt,
        source.lastSuccessAt,
        source.lastFailureAt,
        source.lastError,
        source.fetchCount,
        source.successCount,
        source.failureCount,
        source.itemCount,
        source.createdAt,
        source.updatedAt
      ]
    );
  }

  function deserializeSource(
    row
  ) {
    return {
      id:
        row.id,

      name:
        row.name,

      type:
        row.type,

      url:
        row.url,

      category:
        row.category,

      language:
        row.language,

      country:
        row.country,

      enabled:
        row.enabled,

      intervalMs:
        Number(
          row.interval_ms ||
          defaultInterval
        ),

      timeoutMs:
        Number(
          row.timeout_ms ||
          requestTimeout
        ),

      maxRetries:
        Number(
          row.max_retries ??
          maxRetries
        ),

      headers:
        parseJSON(
          row.headers,
          {}
        ),

      config:
        parseJSON(
          row.config,
          {}
        ),

      status:
        row.status,

      lastFetchAt:
        row.last_fetch_at,

      lastSuccessAt:
        row.last_success_at,

      lastFailureAt:
        row.last_failure_at,

      lastError:
        row.last_error,

      fetchCount:
        Number(
          row.fetch_count || 0
        ),

      successCount:
        Number(
          row.success_count || 0
        ),

      failureCount:
        Number(
          row.failure_count || 0
        ),

      itemCount:
        Number(
          row.item_count || 0
        ),

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at
    };
  }

  /* =========================================================
     Statistics
  ========================================================= */

  function getStatistics() {
    return {
      ...state.statistics,

      sourceCount:
        state.sources.size,

      enabledSources:
        Array.from(
          state.sources.values()
        ).filter(
          source =>
            source.enabled
        ).length,

      processing:
        state.processing.size,

      scheduledJobs:
        state.jobs.size,

      running:
        state.running,

      paused:
        state.paused,

      initialized:
        state.initialized
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA News Source Ingestion Hub",

      version:
        "11.0.0",

      code:
        "66",

      initialized:
        state.initialized,

      running:
        state.running,

      paused:
        state.paused,

      sourceCount:
        state.sources.size,

      scheduledJobs:
        state.jobs.size,

      processing:
        state.processing.size,

      concurrency,

      configuration: {
        requestTimeout,
        maxRetries,
        defaultInterval,
        maxResponseBytes
      },

      integrations: {
        persistence:
          Boolean(
            persistence
          ),

        breakingNewsEngine:
          Boolean(
            breakingNewsEngine
          ),

        automationEngine:
          Boolean(
            automationEngine
          ),

        notificationService:
          Boolean(
            notificationService
          )
      },

      statistics:
        getStatistics(),

      timestamp:
        now()
    };
  }

  /* =========================================================
     Health
  ========================================================= */

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
      } catch {
        database = {
          connected: false
        };
      }
    }

    const sources =
      Array.from(
        state.sources.values()
      );

    const errors =
      sources.filter(
        source =>
          source.status ===
          "error"
      ).length;

    return {
      ok:
        state.initialized &&
        state.running &&
        errors === 0,

      service:
        "news-source-ingestion",

      database,

      sources: {
        total:
          sources.length,

        enabled:
          sources.filter(
            source =>
              source.enabled
          ).length,

        errors
      },

      timestamp:
        now()
    };
  }

  /* =========================================================
     Utility
  ========================================================= */

  function safeClone(value) {
    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch {
      return null;
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

  function backoffDelay(
    attempt
  ) {
    return Math.min(
      30000,
      1000 *
        Math.pow(
          2,
          attempt
        )
    );
  }

  function on(
    event,
    handler
  ) {
    emitter.on(
      event,
      handler
    );

    return () => {
      emitter.off(
        event,
        handler
      );
    };
  }

  /* =========================================================
     API
  ========================================================= */

  return {
    initialize,

    start,
    stop,
    pause,
    resume,

    createSource,
    updateSource,
    deleteSource,

    enableSource,
    disableSource,

    getSource,
    listSources,

    fetchSource,
    receiveWebhook,

    getStatistics,
    getStatus,
    health,

    on
  };
}

module.exports = {
  createNewsSourceIngestion
};
