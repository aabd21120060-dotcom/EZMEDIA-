"use strict";

/*
 * EZ MEDIA
 * CODE 112
 * Intelligent Hybrid Vector & Semantic Search Engine
 *
 * المسار:
 *
 * Query
 *   ↓
 * Text Search
 *   ↓
 * Semantic Search
 *   ↓
 * Hybrid Ranking
 *   ↓
 * AI Reranking
 *   ↓
 * Results
 *
 * ملاحظة:
 * المحرك يعمل حتى قبل تركيب Vector Provider خارجي.
 * عند توفر Embeddings / pgvector يمكن تفعيله مباشرة.
 */

function createIntelligentHybridVectorSearchEngine(options = {}) {
  const {
    persistence,
    aiCore,
    aiOrchestrator,
    ragEngine,
    memoryEngine,
    documentEngine,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,
    searches: 0,
    semanticSearches: 0,
    hybridSearches: 0,
    rerankedSearches: 0,
    indexedDocuments: 0,
    failed: 0,
    lastSearchAt: null,
    lastError: null
  };

  const MAX_RESULTS = Number(
    process.env.VECTOR_SEARCH_MAX_RESULTS || 50
  );

  const MAX_QUERY_LENGTH = Number(
    process.env.VECTOR_SEARCH_MAX_QUERY_LENGTH || 5000
  );

  const MIN_SCORE = Number(
    process.env.VECTOR_SEARCH_MIN_SCORE || 20
  );

  const TEXT_WEIGHT = Number(
    process.env.VECTOR_SEARCH_TEXT_WEIGHT || 0.45
  );

  const SEMANTIC_WEIGHT = Number(
    process.env.VECTOR_SEARCH_SEMANTIC_WEIGHT || 0.55
  );

  const RERANK_ENABLED =
    process.env.VECTOR_SEARCH_RERANK_ENABLED !== "false";

  const SEMANTIC_ENABLED =
    process.env.VECTOR_SEARCH_SEMANTIC_ENABLED !== "false";

  const AI_ENABLED =
    process.env.VECTOR_SEARCH_AI_ENABLED !== "false";

  function now() {
    return new Date().toISOString();
  }

  function id(prefix = "vector") {
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

  function safeString(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value).slice(
      0,
      MAX_QUERY_LENGTH
    );
  }

  function clamp(value, min = 0, max = 100) {
    const n = Number(value);

    if (Number.isNaN(n)) {
      return min;
    }

    return Math.max(
      min,
      Math.min(max, n)
    );
  }

  async function audit(action, metadata = {}) {
    try {
      if (
        persistence &&
        typeof persistence.addAuditLog === "function"
      ) {
        await persistence.addAuditLog({
          actorType: "hybrid_vector_search",
          action,
          entityType: "search",
          entityId:
            metadata.searchId || null,
          metadata
        });
      }
    } catch (error) {
      logger.warn(
        "[Vector Search] audit failed:",
        error.message
      );
    }
  }

  async function initializeDatabase() {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return;
    }

    /*
     * نستخدم JSONB للمتجه مؤقتًا.
     *
     * عند تركيب pgvector يمكن إضافة:
     *
     * vector(1536)
     *
     * أو الحجم المناسب لمزود Embeddings.
     */

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS
      ez_vector_documents (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT,
        title TEXT,
        content TEXT NOT NULL,
        embedding JSONB,
        embedding_model TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS
      idx_ez_vector_documents_source
      ON ez_vector_documents(source_type, source_id);

      CREATE INDEX IF NOT EXISTS
      idx_ez_vector_documents_updated
      ON ez_vector_documents(updated_at);

      CREATE TABLE IF NOT EXISTS
      ez_vector_searches (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        mode TEXT NOT NULL,
        result_count INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }

  function tokenize(text) {
    return safeString(text)
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        " "
      )
      .split(/\s+/)
      .filter(
        word => word.length >= 2
      );
  }

  function textSimilarity(query, content) {
    const queryTokens =
      new Set(tokenize(query));

    const contentTokens =
      new Set(tokenize(content));

    if (
      queryTokens.size === 0 ||
      contentTokens.size === 0
    ) {
      return 0;
    }

    let matches = 0;

    for (const token of queryTokens) {
      if (contentTokens.has(token)) {
        matches++;
      }
    }

    return clamp(
      (matches / queryTokens.size) * 100
    );
  }

  function cosineSimilarity(a, b) {
    if (
      !Array.isArray(a) ||
      !Array.isArray(b) ||
      a.length !== b.length ||
      a.length === 0
    ) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const x = Number(a[i]) || 0;
      const y = Number(b[i]) || 0;

      dot += x * y;
      normA += x * x;
      normB += y * y;
    }

    if (
      normA === 0 ||
      normB === 0
    ) {
      return 0;
    }

    return clamp(
      ((dot /
        (Math.sqrt(normA) *
          Math.sqrt(normB))) +
        1) *
        50
    );
  }

  /*
   * Embedding provider abstraction.
   *
   * يمكن ربط OpenAI أو أي مزود آخر
   * من خلال aiCore / provider لاحقًا.
   */

  async function createEmbedding(text) {
    if (!SEMANTIC_ENABLED) {
      return null;
    }

    const input =
      safeString(text);

    if (!input) {
      return null;
    }

    try {
      if (
        aiCore &&
        typeof aiCore.createEmbedding ===
          "function"
      ) {
        return await aiCore.createEmbedding(
          input
        );
      }

      if (
        aiOrchestrator &&
        typeof aiOrchestrator.process ===
          "function"
      ) {
        const result =
          await aiOrchestrator.process({
            type: "embedding",
            input: {
              text: input
            }
          });

        if (
          Array.isArray(
            result?.embedding
          )
        ) {
          return result.embedding;
        }

        if (
          Array.isArray(
            result?.data?.[0]?.embedding
          )
        ) {
          return result.data[0].embedding;
        }
      }
    } catch (error) {
      logger.warn(
        "[Vector Search] embedding failed:",
        error.message
      );
    }

    return null;
  }

  async function indexDocument(input = {}) {
    const documentId =
      input.id ||
      id("vdoc");

    const content =
      safeString(
        input.content
      );

    if (!content.trim()) {
      throw new Error(
        "Document content is required"
      );
    }

    const embedding =
      input.embedding ||
      await createEmbedding(
        content
      );

    const record = {
      id: documentId,

      sourceType:
        input.sourceType ||
        "manual",

      sourceId:
        input.sourceId ||
        null,

      title:
        safeString(
          input.title
        ),

      content,

      embedding,

      embeddingModel:
        input.embeddingModel ||
        process.env.EMBEDDING_MODEL ||
        null,

      metadata:
        input.metadata || {}
    };

    if (
      persistence &&
      typeof persistence.query === "function"
    ) {
      await persistence.query(
        `
        INSERT INTO
        ez_vector_documents
        (
          id,
          source_type,
          source_id,
          title,
          content,
          embedding,
          embedding_model,
          metadata
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8
        )
        ON CONFLICT (id)
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          embedding =
            EXCLUDED.embedding,
          embedding_model =
            EXCLUDED.embedding_model,
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
          record.embedding
            ? JSON.stringify(
                record.embedding
              )
            : null,
          record.embeddingModel,
          JSON.stringify(
            record.metadata
          )
        ]
      );
    }

    state.indexedDocuments++;

    await audit(
      "vector_document_indexed",
      {
        documentId:
          record.id,
        sourceType:
          record.sourceType
      }
    );

    return record;
  }

  async function searchText(
    query,
    limit
  ) {
    if (
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return [];
    }

    const tokens =
      tokenize(query)
        .slice(0, 12);

    if (!tokens.length) {
      return [];
    }

    const conditions =
      tokens.map(
        (_, index) =>
          `
          title ILIKE $${index + 1}
          OR content ILIKE $${index + 1}
          `
      );

    const values =
      tokens.map(
        token => `%${token}%`
      );

    values.push(limit);

    const result =
      await persistence.query(
        `
        SELECT *
        FROM ez_vector_documents
        WHERE
          ${conditions
            .map(
              c => `(${c})`
            )
            .join(" OR ")}
        ORDER BY updated_at DESC
        LIMIT $${values.length}
        `,
        values
      );

    return result.rows.map(
      document => ({
        ...document,
        textScore:
          textSimilarity(
            query,
            [
              document.title,
              document.content
            ]
              .filter(Boolean)
              .join(" ")
          )
      })
    );
  }

  async function searchSemantic(
    query,
    limit
  ) {
    const queryEmbedding =
      await createEmbedding(
        query
      );

    if (
      !queryEmbedding ||
      !persistence ||
      typeof persistence.query !== "function"
    ) {
      return [];
    }

    const result =
      await persistence.query(`
        SELECT *
        FROM ez_vector_documents
        WHERE embedding IS NOT NULL
        LIMIT 5000
      `);

    return result.rows
      .map(document => {
        let embedding;

        try {
          embedding =
            typeof document.embedding ===
              "string"
              ? JSON.parse(
                  document.embedding
                )
              : document.embedding;
        } catch {
          embedding = null;
        }

        return {
          ...document,
          semanticScore:
            cosineSimilarity(
              queryEmbedding,
              embedding
            )
        };
      })
      .filter(
        item =>
          item.semanticScore >=
          MIN_SCORE
      )
      .sort(
        (a, b) =>
          b.semanticScore -
          a.semanticScore
      )
      .slice(
        0,
        limit
      );
  }

  function combineResults(
    textResults,
    semanticResults,
    limit
  ) {
    const map = new Map();

    for (
      const result of textResults
    ) {
      map.set(
        result.id,
        {
          ...result,
          textScore:
            result.textScore || 0,
          semanticScore:
            result.semanticScore || 0
        }
      );
    }

    for (
      const result of semanticResults
    ) {
      const existing =
        map.get(result.id);

      if (existing) {
        existing.semanticScore =
          result.semanticScore;

        existing.content =
          result.content ||
          existing.content;
      } else {
        map.set(
          result.id,
          {
            ...result,
            textScore:
              result.textScore || 0,
            semanticScore:
              result.semanticScore || 0
          }
        );
      }
    }

    return Array.from(
      map.values()
    )
      .map(result => ({
        ...result,

        hybridScore:
          Math.round(
            (result.textScore || 0) *
              TEXT_WEIGHT +
            (result.semanticScore || 0) *
              SEMANTIC_WEIGHT
          )
      }))
      .filter(
        result =>
          result.hybridScore >=
          MIN_SCORE
      )
      .sort(
        (a, b) =>
          b.hybridScore -
          a.hybridScore
      )
      .slice(0, limit);
  }

  async function rerank(
    query,
    results
  ) {
    if (
      !RERANK_ENABLED ||
      !AI_ENABLED ||
      !results.length
    ) {
      return results;
    }

    try {
      if (
        aiOrchestrator &&
        typeof aiOrchestrator.process ===
          "function"
      ) {
        const result =
          await aiOrchestrator.process({
            type:
              "semantic-search-rerank",

            input: {
              query,
              results:
                results.map(
                  item => ({
                    id:
                      item.id,
                    title:
                      item.title,
                    content:
                      String(
                        item.content || ""
                      ).slice(
                        0,
                        3000
                      ),
                    score:
                      item.hybridScore
                  })
                )
            }
          });

        if (
          Array.isArray(
            result?.rankedResults
          )
        ) {
          state.rerankedSearches++;

          return result.rankedResults
            .map(
              ranked => {
                const original =
                  results.find(
                    item =>
                      item.id ===
                      ranked.id
                  );

                if (!original) {
                  return null;
                }

                return {
                  ...original,

                  aiRank:
                    ranked.rank,

                  aiScore:
                    clamp(
                      ranked.score ||
                        original.hybridScore
                    )
                };
              }
            )
            .filter(Boolean)
            .sort(
              (a, b) =>
                b.aiScore -
                a.aiScore
            );
        }
      }
    } catch (error) {
      logger.warn(
        "[Vector Search] reranking failed:",
        error.message
      );
    }

    return results;
  }

  async function search(
    input = {}
  ) {
    const started =
      Date.now();

    const query =
      safeString(
        input.query ||
        input.question
      ).trim();

    if (!query) {
      throw new Error(
        "Search query is required"
      );
    }

    const searchId =
      id("search");

    const limit =
      Math.min(
        Number(
          input.limit ||
          MAX_RESULTS
        ),
        MAX_RESULTS
      );

    state.searches++;
    state.lastSearchAt =
      now();

    try {
      const [
        textResults,
        semanticResults
      ] =
        await Promise.all([
          searchText(
            query,
            limit * 2
          ),

          SEMANTIC_ENABLED
            ? searchSemantic(
                query,
                limit * 2
              )
            : Promise.resolve([])
        ]);

      if (
        semanticResults.length
      ) {
        state.semanticSearches++;
      }

      let results =
        combineResults(
          textResults,
          semanticResults,
          limit * 2
        );

      results =
        await rerank(
          query,
          results
        );

      results =
        results.slice(
          0,
          limit
        );

      state.hybridSearches++;

      const durationMs =
        Date.now() -
        started;

      if (
        persistence &&
        typeof persistence.query ===
          "function"
      ) {
        await persistence.query(
          `
          INSERT INTO
          ez_vector_searches
          (
            id,
            query,
            mode,
            result_count,
            duration_ms,
            metadata
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6
          )
          `,
          [
            searchId,
            query,
            "hybrid",
            results.length,
            durationMs,
            JSON.stringify({
              semantic:
                Boolean(
                  semanticResults.length
                ),
              reranked:
                RERANK_ENABLED
            })
          ]
        );
      }

      await audit(
        "hybrid_search_completed",
        {
          searchId,
          query,
          resultCount:
            results.length,
          durationMs
        }
      );

      return {
        searchId,
        query,
        mode:
          semanticResults.length
            ? "hybrid-semantic"
            : "hybrid-text",

        results,

        statistics: {
          textResults:
            textResults.length,

          semanticResults:
            semanticResults.length,

          finalResults:
            results.length,

          durationMs
        },

        timestamp:
          now()
      };
    } catch (error) {
      state.failed++;
      state.lastError =
        error.message;

      await audit(
        "hybrid_search_failed",
        {
          searchId,
          error:
            error.message
        }
      );

      throw error;
    }
  }

  async function searchKnowledge(
    query,
    options = {}
  ) {
    const result =
      await search({
        query,
        ...options
      });

    /*
     * إذا كان CODE 111 متاحًا،
     * نضيف نتائج RAG كطبقة معرفة إضافية.
     */
    if (
      ragEngine &&
      typeof ragEngine.retrieve ===
        "function"
    ) {
      try {
        const rag =
          await ragEngine.retrieve(
            query,
            options
          );

        const ragResults =
          (rag.sources || [])
            .map(
              source => ({
                id:
                  `rag:${source.id}`,

                title:
                  source.title,

                content:
                  source.content,

                source_type:
                  source.source_type,

                hybridScore:
                  source.relevanceScore,

                textScore:
                  source.relevanceScore,

                semanticScore:
                  source.relevanceScore
              })
            );

        const merged =
          new Map();

        for (
          const item of [
            ...result.results,
            ...ragResults
          ]
        ) {
          const current =
            merged.get(
              item.id
            );

          if (
            !current ||
            (
              item.hybridScore ||
              0
            ) >
              (
                current.hybridScore ||
                0
              )
          ) {
            merged.set(
              item.id,
              item
            );
          }
        }

        result.results =
          Array.from(
            merged.values()
          )
            .sort(
              (a, b) =>
                (
                  b.hybridScore ||
                  0
                ) -
                (
                  a.hybridScore ||
                  0
                )
            )
            .slice(
              0,
              options.limit ||
                MAX_RESULTS
            );

        result.mode =
          "hybrid-rag-semantic";
      } catch (error) {
        logger.warn(
          "[Vector Search] RAG merge failed:",
          error.message
        );
      }
    }

    return result;
  }

  async function getStatistics() {
    return {
      ...state,

      maxResults:
        MAX_RESULTS,

      minScore:
        MIN_SCORE,

      textWeight:
        TEXT_WEIGHT,

      semanticWeight:
        SEMANTIC_WEIGHT,

      semanticEnabled:
        SEMANTIC_ENABLED,

      rerankEnabled:
        RERANK_ENABLED,

      aiEnabled:
        AI_ENABLED
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

      semanticEnabled:
        SEMANTIC_ENABLED,

      rerankEnabled:
        RERANK_ENABLED,

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
      "hybrid_vector_engine_initialized"
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

    indexDocument,

    search,
    searchKnowledge,

    createEmbedding,
    cosineSimilarity,

    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentHybridVectorSearchEngine
};
