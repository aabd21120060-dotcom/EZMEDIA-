"use strict";

/*
 * EZ MEDIA
 * CODE 110
 * Intelligent Media Memory & Context Engine
 *
 * الذاكرة الذكية والسياق طويل المدى للمنصة.
 *
 * الوظائف:
 * - حفظ ذكريات المنصة
 * - حفظ القرارات
 * - حفظ السياق التشغيلي
 * - ربط الذاكرة بالمحتوى والأخبار
 * - استرجاع الذاكرة ذات الصلة
 * - تصنيف الذكريات
 * - أهمية الذاكرة
 * - انتهاء صلاحية الذاكرة
 * - حذف الذاكرة
 * - سجل تدقيق
 *
 * مبدأ أساسي:
 * الذاكرة ليست مصدر حقيقة مستقل.
 * البيانات الحالية من الأنظمة الأساسية لها الأولوية.
 */

function createIntelligentMediaMemoryEngine(options = {}) {
  const {
    persistence,
    aiCore,
    aiOrchestrator,
    securityEngine,
    analyticsEngine,
    commandEngine,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,
    memoriesCreated: 0,
    memoriesRetrieved: 0,
    memoriesUpdated: 0,
    memoriesDeleted: 0,
    searches: 0,
    lastSearchAt: null,
    lastMemoryAt: null,
    lastError: null
  };

  const MAX_MEMORY_TEXT = Number(
    process.env.MEMORY_MAX_TEXT_LENGTH || 50000
  );

  const MAX_RESULTS = Number(
    process.env.MEMORY_MAX_RESULTS || 50
  );

  const DEFAULT_RETENTION_DAYS = Number(
    process.env.MEMORY_DEFAULT_RETENTION_DAYS || 365
  );

  const AI_ENABLED =
    process.env.MEMORY_AI_ENABLED !== "false";

  function now() {
    return new Date().toISOString();
  }

  function id(prefix = "memory") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  function safeString(value, fallback = "") {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    return String(value).slice(
      0,
      MAX_MEMORY_TEXT
    );
  }

  function normalizeType(type) {
    const allowed = [
      "decision",
      "project",
      "content",
      "news",
      "audience",
      "advertising",
      "sponsorship",
      "revenue",
      "crm",
      "broadcast",
      "editorial",
      "brand",
      "legal",
      "ethics",
      "security",
      "workflow",
      "system",
      "conversation",
      "preference",
      "general"
    ];

    return allowed.includes(type)
      ? type
      : "general";
  }

  function normalizeImportance(value) {
    const number =
      Number(value);

    if (
      Number.isNaN(number)
    ) {
      return 50;
    }

    return Math.max(
      0,
      Math.min(100, number)
    );
  }

  async function audit(
    action,
    data = {}
  ) {
    try {
      if (
        persistence &&
        typeof persistence.addAuditLog ===
          "function"
      ) {
        await persistence.addAuditLog({
          actorType: "memory_engine",
          action,
          entityType: "memory",
          entityId:
            data.memoryId || null,
          metadata: data
        });
      }
    } catch (error) {
      logger.error(
        "[Memory] audit failed:",
        error.message
      );
    }
  }

  async function initializeDatabase() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_media_memories (
        id TEXT PRIMARY KEY,
        memory_type TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        summary TEXT,
        importance INTEGER DEFAULT 50,
        confidence INTEGER DEFAULT 50,
        source_type TEXT,
        source_id TEXT,
        entity_type TEXT,
        entity_id TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        access_count INTEGER DEFAULT 0,
        last_accessed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS
      idx_ez_media_memories_type
      ON ez_media_memories(memory_type);

      CREATE INDEX IF NOT EXISTS
      idx_ez_media_memories_entity
      ON ez_media_memories(entity_type, entity_id);

      CREATE INDEX IF NOT EXISTS
      idx_ez_media_memories_importance
      ON ez_media_memories(importance);

      CREATE INDEX IF NOT EXISTS
      idx_ez_media_memories_expires
      ON ez_media_memories(expires_at);
    `);
  }

  async function createMemory(input = {}) {
    const memoryId =
      input.id || id();

    const type =
      normalizeType(
        input.memoryType ||
          input.type
      );

    const content =
      safeString(
        input.content
      );

    if (!content.trim()) {
      throw new Error(
        "Memory content is required"
      );
    }

    const importance =
      normalizeImportance(
        input.importance
      );

    const confidence =
      normalizeImportance(
        input.confidence
      );

    const retentionDays =
      Number(
        input.retentionDays ||
          DEFAULT_RETENTION_DAYS
      );

    let expiresAt =
      input.expiresAt || null;

    if (
      !expiresAt &&
      retentionDays > 0
    ) {
      expiresAt =
        new Date(
          Date.now() +
            retentionDays *
              86400000
        ).toISOString();
    }

    const memory = {
      id: memoryId,
      memoryType: type,
      title:
        safeString(
          input.title,
          "ذاكرة EZ MEDIA"
        ),
      content,
      summary:
        safeString(
          input.summary,
          content.slice(0, 500)
        ),
      importance,
      confidence,
      sourceType:
        safeString(
          input.sourceType,
          "system"
        ),
      sourceId:
        input.sourceId || null,
      entityType:
        input.entityType || null,
      entityId:
        input.entityId || null,
      tags:
        Array.isArray(input.tags)
          ? input.tags.slice(0, 100)
          : [],
      metadata:
        input.metadata &&
        typeof input.metadata ===
          "object"
          ? input.metadata
          : {},
      expiresAt,
      createdAt: now(),
      updatedAt: now()
    };

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        INSERT INTO ez_media_memories
        (
          id,
          memory_type,
          title,
          content,
          summary,
          importance,
          confidence,
          source_type,
          source_id,
          entity_type,
          entity_id,
          tags,
          metadata,
          expires_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14
        )
        `,
        [
          memory.id,
          memory.memoryType,
          memory.title,
          memory.content,
          memory.summary,
          memory.importance,
          memory.confidence,
          memory.sourceType,
          memory.sourceId,
          memory.entityType,
          memory.entityId,
          JSON.stringify(
            memory.tags
          ),
          JSON.stringify(
            memory.metadata
          ),
          memory.expiresAt
        ]
      );
    }

    state.memoriesCreated += 1;
    state.lastMemoryAt = now();

    await audit(
      "memory_created",
      memory
    );

    return memory;
  }

  async function getMemory(
    memoryId
  ) {
    if (!memoryId) {
      return null;
    }

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      const result =
        await persistence.query(
          `
          SELECT *
          FROM ez_media_memories
          WHERE id = $1
          LIMIT 1
          `,
          [memoryId]
        );

      if (
        result.rows &&
        result.rows[0]
      ) {
        const row =
          result.rows[0];

        await persistence.query(
          `
          UPDATE ez_media_memories
          SET
            access_count =
              access_count + 1,
            last_accessed_at = NOW()
          WHERE id = $1
          `,
          [memoryId]
        );

        state.memoriesRetrieved += 1;

        return row;
      }
    }

    return null;
  }

  async function searchMemories(
    input = {}
  ) {
    const query =
      safeString(
        input.query
      ).trim();

    const type =
      input.memoryType ||
      input.type ||
      null;

    const entityId =
      input.entityId ||
      null;

    const limit = Math.min(
      Number(
        input.limit || MAX_RESULTS
      ),
      MAX_RESULTS
    );

    state.searches += 1;
    state.lastSearchAt = now();

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      const values = [];
      const conditions = [];

      if (query) {
        values.push(
          `%${query}%`
        );

        conditions.push(`
          (
            title ILIKE $${values.length}
            OR content ILIKE $${values.length}
            OR summary ILIKE $${values.length}
          )
        `);
      }

      if (type) {
        values.push(type);

        conditions.push(
          `memory_type = $${values.length}`
        );
      }

      if (entityId) {
        values.push(entityId);

        conditions.push(
          `entity_id = $${values.length}`
        );
      }

      conditions.push(`
        (
          expires_at IS NULL
          OR expires_at > NOW()
        )
      `);

      values.push(limit);

      const sql = `
        SELECT *
        FROM ez_media_memories
        WHERE ${conditions.join(
          " AND "
        )}
        ORDER BY
          importance DESC,
          confidence DESC,
          updated_at DESC
        LIMIT $${values.length}
      `;

      const result =
        await persistence.query(
          sql,
          values
        );

      state.memoriesRetrieved +=
        result.rows.length;

      return result.rows;
    }

    return [];
  }

  async function updateMemory(
    memoryId,
    patch = {}
  ) {
    if (!memoryId) {
      throw new Error(
        "memoryId is required"
      );
    }

    const current =
      await getMemory(memoryId);

    if (!current) {
      throw new Error(
        "Memory not found"
      );
    }

    const content =
      patch.content !== undefined
        ? safeString(
            patch.content
          )
        : current.content;

    const title =
      patch.title !== undefined
        ? safeString(
            patch.title
          )
        : current.title;

    const importance =
      patch.importance !==
      undefined
        ? normalizeImportance(
            patch.importance
          )
        : current.importance;

    const confidence =
      patch.confidence !==
      undefined
        ? normalizeImportance(
            patch.confidence
          )
        : current.confidence;

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        UPDATE ez_media_memories
        SET
          title = $2,
          content = $3,
          importance = $4,
          confidence = $5,
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          memoryId,
          title,
          content,
          importance,
          confidence
        ]
      );
    }

    state.memoriesUpdated += 1;

    await audit(
      "memory_updated",
      {
        memoryId
      }
    );

    return getMemory(
      memoryId
    );
  }

  async function deleteMemory(
    memoryId
  ) {
    if (!memoryId) {
      throw new Error(
        "memoryId is required"
      );
    }

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        DELETE FROM ez_media_memories
        WHERE id = $1
        `,
        [memoryId]
      );
    }

    state.memoriesDeleted += 1;

    await audit(
      "memory_deleted",
      {
        memoryId
      }
    );

    return {
      deleted: true,
      memoryId
    };
  }

  async function cleanupExpired() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return {
        deleted: 0
      };
    }

    const result =
      await persistence.query(`
        DELETE FROM ez_media_memories
        WHERE
          expires_at IS NOT NULL
          AND expires_at <= NOW()
      `);

    const count =
      result.rowCount || 0;

    state.memoriesDeleted += count;

    await audit(
      "memory_cleanup",
      {
        deleted: count
      }
    );

    return {
      deleted: count
    };
  }

  async function createDecisionMemory(
    input = {}
  ) {
    return createMemory({
      ...input,
      memoryType: "decision",
      sourceType:
        input.sourceType ||
        "command_engine",
      importance:
        input.importance || 90
    });
  }

  async function createProjectMemory(
    input = {}
  ) {
    return createMemory({
      ...input,
      memoryType: "project",
      importance:
        input.importance || 85
    });
  }

  async function createConversationMemory(
    input = {}
  ) {
    return createMemory({
      ...input,
      memoryType:
        "conversation",
      sourceType:
        input.sourceType ||
        "ai_mobile",
      importance:
        input.importance || 60
    });
  }

  async function analyzeMemoryContext(
    input = {}
  ) {
    if (!AI_ENABLED) {
      return {
        available: false,
        reason:
          "memory_ai_disabled"
      };
    }

    const memories =
      await searchMemories({
        query:
          input.query ||
          input.context ||
          "",
        limit:
          input.limit || 20
      });

    const context = memories.map(
      (memory) => ({
        type:
          memory.memory_type,
        title:
          memory.title,
        summary:
          memory.summary,
        importance:
          memory.importance,
        confidence:
          memory.confidence,
        createdAt:
          memory.created_at
      })
    );

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        const result =
          await aiOrchestrator.process({
            type:
              "memory-context-analysis",
            input: {
              query:
                input.query ||
                input.context ||
                "",
              memories: context
            }
          });

        return {
          available: true,
          memories,
          analysis:
            result?.answer ||
            result?.output ||
            result?.text ||
            result
        };
      } catch (error) {
        return {
          available: true,
          memories,
          analysis: null,
          error:
            error.message
        };
      }
    }

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        const result =
          await aiCore.request({
            type:
              "memory-context-analysis",
            prompt:
              `حلل سياق الذاكرة التالي:\n${JSON.stringify(
                context
              )}`
          });

        return {
          available: true,
          memories,
          analysis:
            result?.text ||
            result?.output ||
            result
        };
      } catch (error) {
        return {
          available: true,
          memories,
          analysis: null,
          error:
            error.message
        };
      }
    }

    return {
      available: true,
      memories,
      analysis:
        "تم استرجاع الذكريات ذات الصلة."
    };
  }

  function getStatistics() {
    return {
      ...state,
      aiEnabled: AI_ENABLED,
      maxResults: MAX_RESULTS,
      defaultRetentionDays:
        DEFAULT_RETENTION_DAYS
    };
  }

  async function healthCheck() {
    return {
      status:
        state.running
          ? "healthy"
          : "stopped",
      initialized:
        state.initialized,
      running:
        state.running,
      database:
        Boolean(
          persistence
        ),
      aiEnabled:
        AI_ENABLED,
      timestamp:
        now()
    };
  }

  async function initialize() {
    if (state.initialized) {
      return;
    }

    await initializeDatabase();

    state.initialized = true;

    await audit(
      "memory_engine_initialized"
    );
  }

  function start() {
    state.running = true;
    return getStatistics();
  }

  function stop() {
    state.running = false;
    return getStatistics();
  }

  return {
    initialize,
    start,
    stop,

    createMemory,
    getMemory,
    searchMemories,
    updateMemory,
    deleteMemory,
    cleanupExpired,

    createDecisionMemory,
    createProjectMemory,
    createConversationMemory,

    analyzeMemoryContext,

    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentMediaMemoryEngine
};
