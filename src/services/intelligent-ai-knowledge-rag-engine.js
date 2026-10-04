"use strict";

/*
 * EZ MEDIA
 * CODE 111
 * Intelligent AI Knowledge & RAG Engine
 *
 * Retrieval-Augmented Generation
 *
 * الهدف:
 * جعل الذكاء الاصطناعي يبحث في معرفة EZ MEDIA
 * قبل بناء الإجابة.
 *
 * مصادر المعرفة:
 * - المستندات
 * - أجزاء المستندات
 * - الذاكرة الذكية
 * - الأخبار
 * - المحتوى التحريري
 * - بيانات المنصة
 * - المعرفة التي يضيفها المسؤول
 *
 * مبدأ مهم:
 * إذا لم يجد المحرك دليلاً مناسباً،
 * يجب ألا يخترع إجابة على أنها حقيقة داخلية.
 */

function createIntelligentAIKnowledgeRAGEngine(
  options = {}
) {
  const {
    persistence,
    aiCore,
    aiOrchestrator,
    memoryEngine,
    documentEngine,
    commandEngine,
    analyticsEngine,
    securityEngine,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,

    searches: 0,
    answers: 0,
    failed: 0,

    documentsIndexed: 0,
    memoriesIndexed: 0,
    knowledgeItems: 0,

    lastSearchAt: null,
    lastAnswerAt: null,
    lastError: null
  };

  const MAX_RESULTS = Number(
    process.env.RAG_MAX_RESULTS || 20
  );

  const MAX_CONTEXT_LENGTH = Number(
    process.env.RAG_MAX_CONTEXT_LENGTH || 60000
  );

  const MIN_RELEVANCE_SCORE = Number(
    process.env.RAG_MIN_RELEVANCE_SCORE || 35
  );

  const MAX_QUERY_LENGTH = Number(
    process.env.RAG_MAX_QUERY_LENGTH || 5000
  );

  const AI_ENABLED =
    process.env.RAG_AI_ENABLED !== "false";

  const REQUIRE_EVIDENCE =
    process.env.RAG_REQUIRE_EVIDENCE !== "false";

  function now() {
    return new Date().toISOString();
  }

  function id(prefix = "rag") {
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

  function safeString(
    value,
    fallback = ""
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    return String(value).slice(
      0,
      MAX_QUERY_LENGTH
    );
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    const number =
      Number(value);

    if (
      Number.isNaN(number)
    ) {
      return min;
    }

    return Math.max(
      min,
      Math.min(max, number)
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
          actorType: "rag_engine",
          action,
          entityType: "rag",
          entityId:
            data.queryId ||
            data.answerId ||
            null,
          metadata: data
        });
      }
    } catch (error) {
      logger.error(
        "[RAG] audit failed:",
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
      ez_ai_knowledge_sources (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT,
        title TEXT,
        content TEXT NOT NULL,
        summary TEXT,
        url TEXT,
        language TEXT DEFAULT 'ar',
        importance INTEGER DEFAULT 50,
        confidence INTEGER DEFAULT 50,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_knowledge_sources_type
      ON ez_ai_knowledge_sources(source_type);

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_knowledge_sources_source
      ON ez_ai_knowledge_sources(source_id);

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_knowledge_sources_importance
      ON ez_ai_knowledge_sources(importance);

      CREATE TABLE IF NOT EXISTS
      ez_ai_rag_queries (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        source_count INTEGER DEFAULT 0,
        relevance_score INTEGER DEFAULT 0,
        answer_generated BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS
      ez_ai_rag_answers (
        id TEXT PRIMARY KEY,
        query_id TEXT NOT NULL,
        answer TEXT NOT NULL,
        confidence INTEGER DEFAULT 0,
        evidence_count INTEGER DEFAULT 0,
        grounded BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS
      idx_ez_ai_rag_answers_query
      ON ez_ai_rag_answers(query_id);
    `);
  }

  /*
   * حساب تشابه بسيط قائم على الكلمات.
   *
   * هذا هو fallback المحلي.
   * يمكن لاحقاً استبداله بـ embeddings/vector search
   * دون تغيير API الخارجي للمحرك.
   */
  function tokenize(text) {
    return safeString(text)
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        " "
      )
      .split(/\s+/)
      .filter(
        (word) =>
          word.length >= 2
      );
  }

  function calculateLexicalScore(
    query,
    content
  ) {
    const queryTokens =
      new Set(
        tokenize(query)
      );

    const contentTokens =
      tokenize(content);

    if (
      queryTokens.size === 0 ||
      contentTokens.length === 0
    ) {
      return 0;
    }

    let matches = 0;

    for (
      const token of queryTokens
    ) {
      if (
        contentTokens.includes(token)
      ) {
        matches += 1;
      }
    }

    const score =
      (matches /
        queryTokens.size) *
      100;

    return clamp(
      score
    );
  }

  function rankSource(
    query,
    source
  ) {
    const lexical =
      calculateLexicalScore(
        query,
        [
          source.title,
          source.summary,
          source.content
        ]
          .filter(Boolean)
          .join(" ")
      );

    const importance =
      clamp(
        source.importance ||
          50
      );

    const confidence =
      clamp(
        source.confidence ||
          50
      );

    const score =
      lexical * 0.60 +
      importance * 0.20 +
      confidence * 0.20;

    return Math.round(
      score
    );
  }

  async function indexKnowledge(
    input = {}
  ) {
    const sourceId =
      input.sourceId ||
      id("knowledge");

    const content =
      safeString(
        input.content
      );

    if (!content.trim()) {
      throw new Error(
        "Knowledge content is required"
      );
    }

    const record = {
      id: sourceId,

      sourceType:
        input.sourceType ||
        "manual",

      sourceId:
        input.externalId ||
        null,

      title:
        safeString(
          input.title,
          "معرفة EZ MEDIA"
        ),

      content,

      summary:
        safeString(
          input.summary,
          content.slice(0, 500)
        ),

      url:
        input.url ||
        null,

      language:
        input.language ||
        "ar",

      importance:
        clamp(
          input.importance ||
            50
        ),

      confidence:
        clamp(
          input.confidence ||
            50
        ),

      metadata:
        input.metadata || {}
    };

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        INSERT INTO
        ez_ai_knowledge_sources
        (
          id,
          source_type,
          source_id,
          title,
          content,
          summary,
          url,
          language,
          importance,
          confidence,
          metadata
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11
        )
        ON CONFLICT (id)
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          summary = EXCLUDED.summary,
          url = EXCLUDED.url,
          language = EXCLUDED.language,
          importance =
            EXCLUDED.importance,
          confidence =
            EXCLUDED.confidence,
          metadata =
            EXCLUDED.metadata,
          updated_at = NOW()
        `,
        [
          record.id,
          record.sourceType,
          record.sourceId,
          record.title,
          record.content,
          record.summary,
          record.url,
          record.language,
          record.importance,
          record.confidence,
          JSON.stringify(
            record.metadata
          )
        ]
      );
    }

    state.knowledgeItems += 1;

    if (
      record.sourceType ===
      "document"
    ) {
      state.documentsIndexed += 1;
    }

    if (
      record.sourceType ===
      "memory"
    ) {
      state.memoriesIndexed += 1;
    }

    await audit(
      "knowledge_indexed",
      {
        sourceId:
          record.id,
        sourceType:
          record.sourceType
      }
    );

    return record;
  }

  async function searchLocalKnowledge(
    query,
    options = {}
  ) {
    const limit = Math.min(
      Number(
        options.limit ||
          MAX_RESULTS
      ),
      MAX_RESULTS
    );

    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return [];
    }

    /*
     * PostgreSQL lexical retrieval.
     *
     * نستخدم ILIKE كطبقة توافق.
     * يمكن إضافة PostgreSQL FTS أو pgvector
     * لاحقاً دون كسر الواجهة.
     */
    const terms =
      tokenize(query)
        .slice(0, 10);

    if (
      terms.length === 0
    ) {
      return [];
    }

    const conditions =
      terms.map(
        (_, index) =>
          `
          (
            title ILIKE $${index + 1}
            OR content ILIKE $${index + 1}
            OR summary ILIKE $${index + 1}
          )
          `
      );

    const values =
      terms.map(
        (term) =>
          `%${term}%`
      );

    values.push(limit);

    const result =
      await persistence.query(
        `
        SELECT *
        FROM
        ez_ai_knowledge_sources
        WHERE
          (
            ${conditions.join(
              " OR "
            )}
          )
        ORDER BY
          importance DESC,
          confidence DESC,
          updated_at DESC
        LIMIT $${values.length}
        `,
        values
      );

    return result.rows
      .map((source) => ({
        ...source,
        relevanceScore:
          rankSource(
            query,
            {
              title:
                source.title,
              summary:
                source.summary,
              content:
                source.content,
              importance:
                source.importance,
              confidence:
                source.confidence
            }
          )
      }))
      .filter(
        (source) =>
          source.relevanceScore >=
          MIN_RELEVANCE_SCORE
      )
      .sort(
        (a, b) =>
          b.relevanceScore -
          a.relevanceScore
      )
      .slice(0, limit);
  }

  async function searchMemory(
    query,
    options = {}
  ) {
    if (
      !memoryEngine ||
      typeof memoryEngine.searchMemories !==
        "function"
    ) {
      return [];
    }

    try {
      const memories =
        await memoryEngine.searchMemories(
          {
            query,
            limit:
              options.limit ||
              MAX_RESULTS
          }
        );

      return memories.map(
        (memory) => ({
          id:
            memory.id,

          source_type:
            "memory",

          source_id:
            memory.id,

          title:
            memory.title,

          content:
            memory.content,

          summary:
            memory.summary,

          importance:
            memory.importance,

          confidence:
            memory.confidence,

          relevanceScore:
            rankSource(
              query,
              {
                title:
                  memory.title,
                summary:
                  memory.summary,
                content:
                  memory.content,
                importance:
                  memory.importance,
                confidence:
                  memory.confidence
              }
            )
        })
      );
    } catch (error) {
      logger.warn(
        "[RAG] memory search failed:",
        error.message
      );

      return [];
    }
  }

  async function searchDocuments(
    query,
    options = {}
  ) {
    if (
      !documentEngine
    ) {
      return [];
    }

    try {
      /*
       * نحاول استخدام API الداخلي
       * إذا كان متاحاً.
       */
      if (
        typeof documentEngine.search ===
        "function"
      ) {
        const results =
          await documentEngine.search(
            {
              query,
              limit:
                options.limit ||
                MAX_RESULTS
            }
          );

        return (
          results || []
        ).map(
          (item) => ({
            ...item,
            source_type:
              "document",
            relevanceScore:
              rankSource(
                query,
                {
                  title:
                    item.title,
                  summary:
                    item.summary,
                  content:
                    item.content,
                  importance:
                    item.importance ||
                    70,
                  confidence:
                    item.confidence ||
                    80
                }
              )
          })
        );
      }
    } catch (error) {
      logger.warn(
        "[RAG] document search failed:",
        error.message
      );
    }

    return [];
  }

  async function retrieve(
    query,
    options = {}
  ) {
    const cleanQuery =
      safeString(
        query
      ).trim();

    if (!cleanQuery) {
      return {
        query: "",
        sources: [],
        count: 0,
        averageScore: 0
      };
    }

    state.searches += 1;
    state.lastSearchAt = now();

    const [
      localSources,
      memories,
      documents
    ] =
      await Promise.all([
        searchLocalKnowledge(
          cleanQuery,
          options
        ),

        searchMemory(
          cleanQuery,
          options
        ),

        searchDocuments(
          cleanQuery,
          options
        )
      ]);

    const combined = [
      ...localSources,
      ...memories,
      ...documents
    ];

    /*
     * منع التكرار.
     */
    const unique =
      new Map();

    for (
      const source of combined
    ) {
      const key =
        source.id ||
        `${source.source_type}:${source.source_id}`;

      const existing =
        unique.get(key);

      if (
        !existing ||
        source.relevanceScore >
          existing.relevanceScore
      ) {
        unique.set(
          key,
          source
        );
      }
    }

    const sources =
      Array.from(
        unique.values()
      )
        .sort(
          (a, b) =>
            b.relevanceScore -
            a.relevanceScore
        )
        .slice(
          0,
          Math.min(
            Number(
              options.limit ||
                MAX_RESULTS
            ),
            MAX_RESULTS
          )
        );

    const averageScore =
      sources.length
        ? Math.round(
            sources.reduce(
              (
                total,
                source
              ) =>
                total +
                Number(
                  source.relevanceScore ||
                    0
                ),
              0
            ) /
              sources.length
          )
        : 0;

    return {
      query:
        cleanQuery,

      sources,

      count:
        sources.length,

      averageScore,

      hasEvidence:
        sources.length > 0
    };
  }

  function buildContext(
    sources
  ) {
    let context = "";

    for (
      const source of sources
    ) {
      const block = `
[مصدر ${source.source_type}]
العنوان:
${source.title || ""}

الملخص:
${source.summary || ""}

المحتوى:
${source.content || ""}

درجة الصلة:
${source.relevanceScore || 0}
`;

      if (
        context.length +
          block.length >
        MAX_CONTEXT_LENGTH
      ) {
        break;
      }

      context +=
        block;
    }

    return context;
  }

  async function generateGroundedAnswer(
    input = {}
  ) {
    const query =
      safeString(
        input.query ||
          input.question
      ).trim();

    if (!query) {
      throw new Error(
        "RAG query is required"
      );
    }

    const queryId =
      id("rag_query");

    const retrieval =
      await retrieve(
        query,
        {
          limit:
            input.limit ||
            MAX_RESULTS
        }
      );

    const context =
      buildContext(
        retrieval.sources
      );

    let answer =
      "لم أجد معلومات كافية في معرفة EZ MEDIA للإجابة بثقة.";

    let confidence = 0;

    let grounded =
      false;

    if (
      AI_ENABLED &&
      retrieval.hasEvidence
    ) {
      try {
        const systemPrompt = `
أنت نظام المعرفة الذكي لمنصة EZ MEDIA.

أجب باللغة العربية.

القواعد:
1. استخدم الأدلة الموجودة في السياق.
2. لا تخترع معلومة غير موجودة في الأدلة.
3. إذا كانت الأدلة غير كافية، صرّح بذلك.
4. فرّق بين الحقيقة الموجودة في المصدر والاستنتاج.
5. لا تعتبر الذاكرة القديمة حقيقة إذا تعارضت
   مع البيانات الحالية.
6. لا تدّعي تنفيذ أي إجراء.
7. لا تعطِ قراراً قانونياً نهائياً.
8. عند وجود تعارض بين المصادر، اذكر التعارض.
9. اجعل الإجابة واضحة ومباشرة.

السؤال:
${query}

السياق المسترجع:
${context}
`;

        if (
          aiOrchestrator &&
          typeof aiOrchestrator.process ===
            "function"
        ) {
          const result =
            await aiOrchestrator.process(
              {
                type:
                  "knowledge-rag-answer",

                input: {
                  systemPrompt,
                  query,
                  context
                }
              }
            );

          answer =
            result?.answer ||
            result?.output ||
            result?.text ||
            JSON.stringify(
              result
            );

          confidence =
            clamp(
              result?.confidence ||
                retrieval.averageScore
            );

          grounded = true;
        } else if (
          aiCore &&
          typeof aiCore.request ===
            "function"
        ) {
          const result =
            await aiCore.request(
              {
                type:
                  "knowledge-rag-answer",

                prompt:
                  `${systemPrompt}`
              }
            );

          answer =
            result?.answer ||
            result?.output ||
            result?.text ||
            JSON.stringify(
              result
            );

          confidence =
            clamp(
              result?.confidence ||
                retrieval.averageScore
            );

          grounded = true;
        }
      } catch (error) {
        state.failed += 1;
        state.lastError =
          error.message;

        logger.error(
          "[RAG] generation failed:",
          error.message
        );
      }
    }

    if (
      REQUIRE_EVIDENCE &&
      !retrieval.hasEvidence
    ) {
      grounded = false;
      confidence = 0;
    }

    const answerId =
      id("rag_answer");

    if (
      persistence &&
      typeof persistence.query ===
        "function"
    ) {
      await persistence.query(
        `
        INSERT INTO
        ez_ai_rag_queries
        (
          id,
          query,
          source_count,
          relevance_score,
          answer_generated,
          metadata
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6
        )
        `,
        [
          queryId,
          query,
          retrieval.count,
          retrieval.averageScore,
          Boolean(answer),
          JSON.stringify({
            sources:
              retrieval.sources.map(
                (source) => ({
                  id:
                    source.id,
                  type:
                    source.source_type,
                  score:
                    source.relevanceScore
                })
              )
          })
        ]
      );

      await persistence.query(
        `
        INSERT INTO
        ez_ai_rag_answers
        (
          id,
          query_id,
          answer,
          confidence,
          evidence_count,
          grounded,
          metadata
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7
        )
        `,
        [
          answerId,
          queryId,
          answer,
          confidence,
          retrieval.count,
          grounded,
          JSON.stringify({
            sourceIds:
              retrieval.sources.map(
                (source) =>
                  source.id
              )
          })
        ]
      );
    }

    state.answers += 1;
    state.lastAnswerAt = now();

    await audit(
      "rag_answer_generated",
      {
        queryId,
        answerId,
        sourceCount:
          retrieval.count,
        confidence,
        grounded
      }
    );

    return {
      queryId,
      answerId,

      query,

      answer,

      confidence,

      grounded,

      evidenceCount:
        retrieval.count,

      sources:
        retrieval.sources.map(
          (source) => ({
            id:
              source.id,

            type:
              source.source_type,

            title:
              source.title,

            score:
              source.relevanceScore,

            sourceId:
              source.source_id,

            url:
              source.url ||
              null
          })
        ),

      retrieval: {
        averageScore:
          retrieval.averageScore
      },

      timestamp:
        now()
    };
  }

  async function answerQuestion(
    question,
    options = {}
  ) {
    return generateGroundedAnswer({
      query:
        question,
      ...options
    });
  }

  async function indexMemory(
    memory
  ) {
    return indexKnowledge({
      sourceType:
        "memory",

      externalId:
        memory.id,

      title:
        memory.title,

      content:
        memory.content,

      summary:
        memory.summary,

      importance:
        memory.importance,

      confidence:
        memory.confidence,

      metadata:
        {
          memoryId:
            memory.id
        }
    });
  }

  async function indexDocument(
    document
  ) {
    return indexKnowledge({
      sourceType:
        "document",

      externalId:
        document.id,

      title:
        document.title,

      content:
        document.content ||
        document.text ||
        "",

      summary:
        document.summary,

      url:
        document.url,

      importance:
        document.importance ||
        70,

      confidence:
        document.confidence ||
        80,

      metadata:
        {
          documentId:
            document.id
        }
    });
  }

  async function indexNews(
    news
  ) {
    return indexKnowledge({
      sourceType:
        "news",

      externalId:
        news.id ||
        news.newsId,

      title:
        news.title ||
        news.headline,

      content:
        news.content ||
        news.body ||
        "",

      summary:
        news.summary,

      url:
        news.url,

      importance:
        news.importance ||
        news.score ||
        70,

      confidence:
        news.confidence ||
        news.verificationScore ||
        70,

      metadata:
        {
          storyHash:
            news.storyHash
        }
    });
  }

  async function getStatistics() {
    return {
      ...state,

      maxResults:
        MAX_RESULTS,

      minRelevanceScore:
        MIN_RELEVANCE_SCORE,

      maxContextLength:
        MAX_CONTEXT_LENGTH,

      aiEnabled:
        AI_ENABLED,

      requireEvidence:
        REQUIRE_EVIDENCE
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

      evidenceRequired:
        REQUIRE_EVIDENCE,

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
      "rag_engine_initialized"
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

    indexKnowledge,
    indexMemory,
    indexDocument,
    indexNews,

    searchLocalKnowledge,
    retrieve,

    generateGroundedAnswer,
    answerQuestion,

    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentAIKnowledgeRAGEngine
};
