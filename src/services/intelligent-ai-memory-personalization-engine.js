"use strict";

/*
 * EZ MEDIA
 * CODE 113
 * Intelligent AI Memory & Personalization Engine
 *
 * الوظيفة:
 * - حفظ سياق العمل
 * - تفضيلات المستخدم
 * - قرارات المنصة
 * - سجل العمليات المهمة
 * - تفضيل أسلوب المحتوى
 * - ربط الذاكرة مع RAG والبحث الدلالي
 *
 * مهم:
 * الذاكرة لا تعني حفظ كل شيء بلا حدود.
 * يتم تصنيف الذاكرة وتحديد أهميتها ومدة الاحتفاظ بها.
 */

function createIntelligentAIMemoryPersonalizationEngine(
  options = {}
) {
  const {
    persistence,
    aiCore,
    aiOrchestrator,
    ragEngine,
    vectorSearchEngine,
    commandEngine,
    securityEngine,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,

    memoriesCreated: 0,
    memoriesUpdated: 0,
    memoriesRetrieved: 0,
    memoriesExpired: 0,
    personalizationRequests: 0,

    lastMemoryAt: null,
    lastPersonalizationAt: null,
    lastError: null
  };

  const MAX_MEMORIES = Number(
    process.env.AI_MEMORY_MAX_MEMORIES || 1000000
  );

  const MAX_CONTEXT_MEMORIES = Number(
    process.env.AI_MEMORY_MAX_CONTEXT_MEMORIES || 30
  );

  const DEFAULT_RETENTION_DAYS = Number(
    process.env.AI_MEMORY_DEFAULT_RETENTION_DAYS || 365
  );

  const MIN_MEMORY_IMPORTANCE = Number(
    process.env.AI_MEMORY_MIN_IMPORTANCE || 25
  );

  const PERSONALIZATION_ENABLED =
    process.env.AI_PERSONALIZATION_ENABLED !== "false";

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

  function safeString(value, max = 20000) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value).slice(0, max);
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    const number = Number(value);

    if (Number.isNaN(number)) {
      return min;
    }

    return Math.max(
      min,
      Math.min(max, number)
    );
  }

  function normalizeType(type) {
    const allowed = [
      "preference",
      "decision",
      "workflow",
      "project",
      "content",
      "editorial",
      "business",
      "brand",
      "security",
      "system",
      "instruction",
      "context",
      "temporary"
    ];

    return allowed.includes(type)
      ? type
      : "context";
  }

  async function audit(
    action,
    metadata = {}
  ) {
    try {
      if (
        persistence &&
        typeof persistence.addAuditLog ===
          "function"
      ) {
        await persistence.addAuditLog({
          actorType:
            "ai_memory_personalization",
          action,
          entityType:
            "ai_memory",
          entityId:
            metadata.memoryId ||
            metadata.requestId ||
            null,
          metadata
        });
      }
    } catch (error) {
      logger.warn(
        "[AI Memory] audit failed:",
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
      CREATE TABLE IF NOT EXISTS
      ez_ai_memories (
        id TEXT PRIMARY KEY,

        owner_id TEXT,

        memory_type TEXT NOT NULL,

        scope TEXT DEFAULT 'platform',

        title TEXT,

        content TEXT NOT NULL,

        normalized_content TEXT,

        importance INTEGER DEFAULT 50,

        confidence INTEGER DEFAULT 50,

        retention_days INTEGER DEFAULT 365,

        expires_at TIMESTAMPTZ,

        source_type TEXT,

        source_id TEXT,

        tags JSONB DEFAULT '[]'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        active BOOLEAN DEFAULT TRUE,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW(),

        last_used_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_memories_owner
      ON ez_ai_memories(owner_id);

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_memories_type
      ON ez_ai_memories(memory_type);

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_memories_scope
      ON ez_ai_memories(scope);

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_memories_active
      ON ez_ai_memories(active);

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_memories_importance
      ON ez_ai_memories(importance);

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_memories_expires
      ON ez_ai_memories(expires_at);

      CREATE TABLE IF NOT EXISTS
      ez_ai_memory_events (
        id TEXT PRIMARY KEY,

        memory_id TEXT,

        event_type TEXT NOT NULL,

        actor_id TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_memory_events_memory
      ON ez_ai_memory_events(memory_id);

      CREATE TABLE IF NOT EXISTS
      ez_ai_personalization_profiles (
        id TEXT PRIMARY KEY,

        owner_id TEXT NOT NULL,

        profile JSONB DEFAULT '{}'::jsonb,

        preferences JSONB DEFAULT '{}'::jsonb,

        behavior JSONB DEFAULT '{}'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        updated_at TIMESTAMPTZ DEFAULT NOW(),

        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_ez_ai_personalization_owner
      ON ez_ai_personalization_profiles(owner_id);
    `);
  }

  function normalizeContent(content) {
    return safeString(
      content
    )
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function calculateMemoryScore(memory) {
    const importance =
      clamp(
        memory.importance || 50
      );

    const confidence =
      clamp(
        memory.confidence || 50
      );

    const typeBonus =
      memory.memory_type ===
      "decision"
        ? 10
        : memory.memory_type ===
          "instruction"
        ? 10
        : 0;

    return clamp(
      importance * 0.55 +
        confidence * 0.35 +
        typeBonus
    );
  }

  async function createMemory(
    input = {}
  ) {
    if (
      !input.content ||
      !safeString(
        input.content
      ).trim()
    ) {
      throw new Error(
        "Memory content is required"
      );
    }

    if (
      state.memoriesCreated >=
      MAX_MEMORIES
    ) {
      throw new Error(
        "AI memory capacity limit reached"
      );
    }

    const memoryId =
      input.id ||
      id("memory");

    const retentionDays =
      Number(
        input.retentionDays ||
          DEFAULT_RETENTION_DAYS
      );

    const memory = {
      id: memoryId,

      ownerId:
        input.ownerId ||
        null,

      memoryType:
        normalizeType(
          input.memoryType
        ),

      scope:
        input.scope ||
        "platform",

      title:
        safeString(
          input.title,
          500
        ),

      content:
        safeString(
          input.content
        ),

      normalizedContent:
        normalizeContent(
          input.content
        ),

      importance:
        clamp(
          input.importance ||
            50
        ),

      confidence:
        clamp(
          input.confidence ||
            70
        ),

      retentionDays,

      sourceType:
        input.sourceType ||
        "manual",

      sourceId:
        input.sourceId ||
        null,

      tags:
        Array.isArray(
          input.tags
        )
          ? input.tags
          : [],

      metadata:
        input.metadata ||
        {}
    };

    if (
      memory.importance <
      MIN_MEMORY_IMPORTANCE
    ) {
      return {
        skipped: true,
        reason:
          "memory_importance_below_threshold"
      };
    }

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        INSERT INTO
        ez_ai_memories
        (
          id,
          owner_id,
          memory_type,
          scope,
          title,
          content,
          normalized_content,
          importance,
          confidence,
          retention_days,
          expires_at,
          source_type,
          source_id,
          tags,
          metadata
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,
          NOW() +
          ($10 || ' days')::interval,
          $11,$12,$13,$14
        )
        ON CONFLICT (id)
        DO UPDATE SET
          title =
            EXCLUDED.title,

          content =
            EXCLUDED.content,

          normalized_content =
            EXCLUDED.normalized_content,

          importance =
            EXCLUDED.importance,

          confidence =
            EXCLUDED.confidence,

          retention_days =
            EXCLUDED.retention_days,

          expires_at =
            EXCLUDED.expires_at,

          tags =
            EXCLUDED.tags,

          metadata =
            EXCLUDED.metadata,

          active =
            TRUE,

          updated_at =
            NOW()
        `,
        [
          memory.id,
          memory.ownerId,
          memory.memoryType,
          memory.scope,
          memory.title,
          memory.content,
          memory.normalizedContent,
          memory.importance,
          memory.confidence,
          memory.retentionDays,
          memory.sourceType,
          memory.sourceId,
          JSON.stringify(
            memory.tags
          ),
          JSON.stringify(
            memory.metadata
          )
        ]
      );
    }

    state.memoriesCreated++;
    state.lastMemoryAt =
      now();

    /*
     * نسخ الذاكرة إلى RAG
     * حتى تصبح قابلة للاسترجاع.
     */
    if (
      ragEngine &&
      typeof ragEngine.indexMemory ===
        "function"
    ) {
      try {
        await ragEngine.indexMemory(
          {
            id:
              memory.id,

            title:
              memory.title,

            content:
              memory.content,

            importance:
              memory.importance,

            confidence:
              memory.confidence,

            summary:
              memory.content.slice(
                0,
                500
              )
          }
        );
      } catch (error) {
        logger.warn(
          "[AI Memory] RAG indexing failed:",
          error.message
        );
      }
    }

    /*
     * فهرسة دلالية إذا كانت الطبقة متاحة.
     */
    if (
      vectorSearchEngine &&
      typeof vectorSearchEngine.indexDocument ===
        "function"
    ) {
      try {
        await vectorSearchEngine.indexDocument(
          {
            id:
              `memory:${memory.id}`,

            sourceType:
              "memory",

            sourceId:
              memory.id,

            title:
              memory.title,

            content:
              memory.content,

            metadata: {
              memoryType:
                memory.memoryType,

              scope:
                memory.scope
            }
          }
        );
      } catch (error) {
        logger.warn(
          "[AI Memory] vector indexing failed:",
          error.message
        );
      }
    }

    await recordEvent(
      memory.id,
      "created",
      {
        sourceType:
          memory.sourceType
      }
    );

    await audit(
      "memory_created",
      {
        memoryId:
          memory.id,

        memoryType:
          memory.memoryType,

        importance:
          memory.importance
      }
    );

    return memory;
  }

  async function recordEvent(
    memoryId,
    eventType,
    metadata = {},
    actorId = null
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
      INSERT INTO
      ez_ai_memory_events
      (
        id,
        memory_id,
        event_type,
        actor_id,
        metadata
      )
      VALUES
      (
        $1,$2,$3,$4,$5
      )
      `,
      [
        id("memory_event"),
        memoryId,
        eventType,
        actorId,
        JSON.stringify(
          metadata
        )
      ]
    );
  }

  async function retrieveMemories(
    input = {}
  ) {
    const query =
      safeString(
        input.query ||
          input.context
      ).trim();

    const ownerId =
      input.ownerId ||
      null;

    const scope =
      input.scope ||
      "platform";

    const limit =
      Math.min(
        Number(
          input.limit ||
            MAX_CONTEXT_MEMORIES
        ),
        MAX_CONTEXT_MEMORIES
      );

    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return [];
    }

    let result;

    if (query) {
      const tokens =
        query
          .toLowerCase()
          .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
          )
          .split(/\s+/)
          .filter(
            word =>
              word.length >= 2
          )
          .slice(0, 10);

      if (tokens.length) {
        const conditions =
          tokens.map(
            (_, index) =>
              `
              normalized_content
              ILIKE
              $${index + 1}
              OR title
              ILIKE
              $${index + 1}
              `
          );

        const values =
          tokens.map(
            token =>
              `%${token}%`
          );

        let parameter =
          tokens.length;

        let ownerCondition =
          "";

        if (ownerId) {
          parameter++;
          ownerCondition =
            `AND owner_id = $${parameter}`;
          values.push(
            ownerId
          );
        }

        parameter++;

        const scopeValue =
          scope;

        values.push(
          scopeValue
        );

        parameter++;

        values.push(
          limit
        );

        result =
          await persistence.query(
            `
            SELECT *
            FROM ez_ai_memories

            WHERE active = TRUE

            AND (
              ${conditions
                .map(
                  condition =>
                    `(${condition})`
                )
                .join(" OR ")}
            )

            ${ownerCondition}

            AND (
              scope = $${parameter - 1}
              OR scope = 'platform'
            )

            AND (
              expires_at IS NULL
              OR expires_at > NOW()
            )

            ORDER BY
              importance DESC,
              confidence DESC,
              updated_at DESC

            LIMIT $${parameter}
            `,
            values
          );
      }
    }

    if (!result) {
      const values = [];

      let parameter = 0;

      let ownerCondition = "";

      if (ownerId) {
        parameter++;

        ownerCondition =
          `AND owner_id = $${parameter}`;

        values.push(
          ownerId
        );
      }

      parameter++;

      values.push(
        scope
      );

      parameter++;

      values.push(
        limit
      );

      result =
        await persistence.query(
          `
          SELECT *
          FROM ez_ai_memories

          WHERE active = TRUE

          ${ownerCondition}

          AND (
            scope = $${parameter - 1}
            OR scope = 'platform'
          )

          AND (
            expires_at IS NULL
            OR expires_at > NOW()
          )

          ORDER BY
            importance DESC,
            confidence DESC,
            updated_at DESC

          LIMIT $${parameter}
          `,
          values
        );
    }

    const memories =
      result.rows.map(
        memory => ({
          ...memory,

          memoryScore:
            calculateMemoryScore(
              memory
            )
        })
      );

    state.memoriesRetrieved +=
      memories.length;

    for (
      const memory of memories
    ) {
      await recordEvent(
        memory.id,
        "retrieved",
        {
          query
        }
      );
    }

    return memories;
  }

  async function updateMemory(
    memoryId,
    updates = {}
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      throw new Error(
        "Persistence is not available"
      );
    }

    const current =
      await persistence.query(
        `
        SELECT *
        FROM ez_ai_memories
        WHERE id = $1
        LIMIT 1
        `,
        [memoryId]
      );

    if (!current.rows.length) {
      throw new Error(
        "Memory not found"
      );
    }

    const memory =
      current.rows[0];

    const content =
      updates.content !==
      undefined
        ? safeString(
            updates.content
          )
        : memory.content;

    const title =
      updates.title !==
      undefined
        ? safeString(
            updates.title
          )
        : memory.title;

    const importance =
      updates.importance !==
      undefined
        ? clamp(
            updates.importance
          )
        : memory.importance;

    const confidence =
      updates.confidence !==
      undefined
        ? clamp(
            updates.confidence
          )
        : memory.confidence;

    const metadata =
      updates.metadata ||
      memory.metadata ||
      {};

    const tags =
      updates.tags ||
      memory.tags ||
      [];

    await persistence.query(
      `
      UPDATE
      ez_ai_memories

      SET
        title = $2,
        content = $3,
        normalized_content = $4,
        importance = $5,
        confidence = $6,
        metadata = $7,
        tags = $8,
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        memoryId,
        title,
        content,
        normalizeContent(
          content
        ),
        importance,
        confidence,
        JSON.stringify(
          metadata
        ),
        JSON.stringify(
          tags
        )
      ]
    );

    state.memoriesUpdated++;

    await recordEvent(
      memoryId,
      "updated",
      {
        fields:
          Object.keys(
            updates
          )
      }
    );

    await audit(
      "memory_updated",
      {
        memoryId
      }
    );

    return {
      id: memoryId,
      title,
      content,
      importance,
      confidence
    };
  }

  async function forgetMemory(
    memoryId,
    reason = "manual"
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      throw new Error(
        "Persistence is not available"
      );
    }

    await persistence.query(
      `
      UPDATE
      ez_ai_memories
      SET
        active = FALSE,
        updated_at = NOW()
      WHERE id = $1
      `,
      [memoryId]
    );

    await recordEvent(
      memoryId,
      "forgotten",
      {
        reason
      }
    );

    await audit(
      "memory_forgotten",
      {
        memoryId,
        reason
      }
    );

    return {
      id: memoryId,
      forgotten: true
    };
  }

  async function cleanupExpiredMemories() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return {
        expired: 0
      };
    }

    const result =
      await persistence.query(
        `
        UPDATE
        ez_ai_memories

        SET
          active = FALSE,
          updated_at = NOW()

        WHERE
          active = TRUE

        AND expires_at IS NOT NULL

        AND expires_at <= NOW()

        RETURNING id
        `
      );

    const count =
      result.rows.length;

    state.memoriesExpired +=
      count;

    if (count) {
      await audit(
        "expired_memories_cleaned",
        {
          count
        }
      );
    }

    return {
      expired: count
    };
  }

  async function buildContext(
    input = {}
  ) {
    const memories =
      await retrieveMemories(
        input
      );

    const context =
      memories
        .map(
          memory =>
            `
[ذاكرة ${memory.memory_type}]
العنوان:
${memory.title || ""}

المحتوى:
${memory.content}

الأهمية:
${memory.importance}

الثقة:
${memory.confidence}
`
        )
        .join("\n");

    return {
      memories,
      context,
      count:
        memories.length
    };
  }

  async function personalize(
    input = {}
  ) {
    const requestId =
      id("personalization");

    const query =
      safeString(
        input.query ||
          input.prompt ||
          input.task
      ).trim();

    if (!query) {
      throw new Error(
        "Personalization query is required"
      );
    }

    state.personalizationRequests++;

    const context =
      await buildContext({
        query,
        ownerId:
          input.ownerId,
        scope:
          input.scope ||
          "platform",
        limit:
          input.limit ||
          MAX_CONTEXT_MEMORIES
      });

    let profile =
      await getProfile(
        input.ownerId ||
          "platform"
      );

    let instructions =
      "";

    if (
      PERSONALIZATION_ENABLED
    ) {
      instructions = `
سياق التخصيص:

${context.context}

ملف التفضيلات:

${JSON.stringify(
  profile || {},
  null,
  2
)}

تعامل مع هذا السياق باعتباره
معلومات مساعدة وليست حقيقة مطلقة.

إذا تعارضت ذاكرة قديمة مع
معلومة أحدث، فالأحدث أولى.

لا تكشف الذاكرة الداخلية
للمستخدم إلا إذا كان ذلك
مطلوباً ومسموحاً.
`;
    }

    state.lastPersonalizationAt =
      now();

    await audit(
      "personalization_context_built",
      {
        requestId,
        memoryCount:
          context.count
      }
    );

    return {
      requestId,

      query,

      profile,

      memories:
        context.memories,

      context:
        instructions,

      memoryCount:
        context.count,

      timestamp:
        now()
    };
  }

  async function getProfile(
    ownerId = "platform"
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return {
        ownerId,
        preferences: {},
        behavior: {}
      };
    }

    const result =
      await persistence.query(
        `
        SELECT *
        FROM
        ez_ai_personalization_profiles
        WHERE owner_id = $1
        LIMIT 1
        `,
        [ownerId]
      );

    if (!result.rows.length) {
      return {
        ownerId,
        preferences: {},
        behavior: {},
        profile: {}
      };
    }

    return {
      ...result.rows[0],
      ownerId
    };
  }

  async function updateProfile(
    input = {}
  ) {
    const ownerId =
      input.ownerId ||
      "platform";

    const current =
      await getProfile(
        ownerId
      );

    const profile =
      input.profile ||
      current.profile ||
      {};

    const preferences =
      input.preferences ||
      current.preferences ||
      {};

    const behavior =
      input.behavior ||
      current.behavior ||
      {};

    const metadata =
      input.metadata ||
      current.metadata ||
      {};

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        INSERT INTO
        ez_ai_personalization_profiles
        (
          id,
          owner_id,
          profile,
          preferences,
          behavior,
          metadata
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6
        )
        ON CONFLICT (owner_id)
        DO UPDATE SET
          profile =
            EXCLUDED.profile,

          preferences =
            EXCLUDED.preferences,

          behavior =
            EXCLUDED.behavior,

          metadata =
            EXCLUDED.metadata,

          updated_at =
            NOW()
        `,
        [
          id("profile"),
          ownerId,
          JSON.stringify(
            profile
          ),
          JSON.stringify(
            preferences
          ),
          JSON.stringify(
            behavior
          ),
          JSON.stringify(
            metadata
          )
        ]
      );
    }

    await audit(
      "personalization_profile_updated",
      {
        ownerId
      }
    );

    return {
      ownerId,
      profile,
      preferences,
      behavior,
      metadata
    };
  }

  async function rememberDecision(
    decision = {}
  ) {
    return createMemory({
      ownerId:
        decision.ownerId ||
        null,

      memoryType:
        "decision",

      scope:
        decision.scope ||
        "platform",

      title:
        decision.title ||
        "قرار تنفيذي",

      content:
        decision.content ||
        decision.decision,

      importance:
        decision.importance ||
        90,

      confidence:
        decision.confidence ||
        90,

      sourceType:
        "decision",

      sourceId:
        decision.sourceId ||
        null,

      tags: [
        "decision",
        "executive"
      ],

      metadata:
        decision.metadata ||
        {}
    });
  }

  async function rememberPreference(
    preference = {}
  ) {
    return createMemory({
      ownerId:
        preference.ownerId ||
        null,

      memoryType:
        "preference",

      scope:
        preference.scope ||
        "platform",

      title:
        preference.title ||
        "تفضيل",

      content:
        preference.content ||
        preference.preference,

      importance:
        preference.importance ||
        80,

      confidence:
        preference.confidence ||
        90,

      sourceType:
        "preference",

      tags: [
        "preference"
      ],

      metadata:
        preference.metadata ||
        {}
    });
  }

  async function rememberInstruction(
    instruction = {}
  ) {
    return createMemory({
      ownerId:
        instruction.ownerId ||
        null,

      memoryType:
        "instruction",

      scope:
        instruction.scope ||
        "platform",

      title:
        instruction.title ||
        "تعليمات",

      content:
        instruction.content ||
        instruction.instruction,

      importance:
        instruction.importance ||
        95,

      confidence:
        instruction.confidence ||
        95,

      sourceType:
        "instruction",

      tags: [
        "instruction"
      ],

      metadata:
        instruction.metadata ||
        {}
    });
  }

  async function askWithMemory(
    input = {}
  ) {
    const personalization =
      await personalize(
        input
      );

    if (
      ragEngine &&
      typeof ragEngine.answerQuestion ===
        "function"
    ) {
      const result =
        await ragEngine.answerQuestion(
          `${input.query || input.prompt}

${personalization.context}`,
          {
            limit:
              input.limit ||
              MAX_CONTEXT_MEMORIES
          }
        );

      return {
        ...result,

        personalization:
          {
            memoryCount:
              personalization.memoryCount
          }
      };
    }

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      return aiOrchestrator.process({
        type:
          "personalized-ai-answer",

        input: {
          query:
            input.query ||
            input.prompt,

          memoryContext:
            personalization.context
        }
      });
    }

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      return aiCore.request({
        type:
          "personalized-ai-answer",

        prompt:
          `${input.query || input.prompt}

${personalization.context}`
      });
    }

    return {
      answer:
        "لا يوجد مزود ذكاء اصطناعي متصل حالياً.",

      memoryCount:
        personalization.memoryCount
    };
  }

  async function getStatistics() {
    return {
      ...state,

      maxMemories:
        MAX_MEMORIES,

      maxContextMemories:
        MAX_CONTEXT_MEMORIES,

      defaultRetentionDays:
        DEFAULT_RETENTION_DAYS,

      minMemoryImportance:
        MIN_MEMORY_IMPORTANCE,

      personalizationEnabled:
        PERSONALIZATION_ENABLED
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

      ragAvailable:
        Boolean(
          ragEngine
        ),

      vectorSearchAvailable:
        Boolean(
          vectorSearchEngine
        ),

      personalizationEnabled:
        PERSONALIZATION_ENABLED,

      timestamp:
        now()
    };
  }

  async function initialize() {
    if (state.initialized) {
      return;
    }

    await initializeDatabase();

    state.initialized =
      true;

    await audit(
      "ai_memory_engine_initialized"
    );
  }

  function start() {
    state.running = true;

    return state;
  }

  function stop() {
    state.running = false;

    return state;
  }

  return {
    initialize,
    start,
    stop,

    createMemory,
    retrieveMemories,
    updateMemory,
    forgetMemory,

    cleanupExpiredMemories,

    buildContext,
    personalize,

    getProfile,
    updateProfile,

    rememberDecision,
    rememberPreference,
    rememberInstruction,

    askWithMemory,

    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentAIMemoryPersonalizationEngine
};
