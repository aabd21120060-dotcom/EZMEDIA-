"use strict";

const crypto = require("crypto");

function createIntelligentDocumentKnowledgeEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    automationEngine = null,
    workflowEngine = null,
    crmEngine = null,
    customerSupportEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxDocuments = Number(
      process.env.DOCUMENT_MAX_DOCUMENTS || 100000
    ),

    maxDocumentSize = Number(
      process.env.DOCUMENT_MAX_SIZE || 524288000
    ),

    maxSearchResults = Number(
      process.env.DOCUMENT_MAX_SEARCH_RESULTS || 50
    ),

    maxTextLength = Number(
      process.env.DOCUMENT_MAX_TEXT_LENGTH || 2000000
    ),

    autoAnalyze =
      process.env.DOCUMENT_AUTO_ANALYZE !== "false"
  } = options;

  const state = {
    initialized: false,
    running: false,

    documents: new Map(),
    chunks: new Map(),
    knowledge: new Map(),
    collections: new Map(),
    searches: new Map(),

    statistics: {
      documents: 0,
      analyzed: 0,
      indexed: 0,
      searches: 0,
      knowledgeItems: 0,
      collections: 0,
      aiOperations: 0,
      failedOperations: 0
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
      crypto.randomBytes(6).toString("hex")
    );
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(String(value || ""))
      .digest("hex");
  }

  function clean(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
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
        "[CODE81] Event error:",
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

    return persistence.query(sql, values);
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    if (!persistence) {
      return;
    }

    await query(`
      CREATE TABLE IF NOT EXISTS ez_documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        description TEXT,
        document_type TEXT DEFAULT 'general',
        mime_type TEXT,
        extension TEXT,
        size BIGINT DEFAULT 0,
        storage_key TEXT,
        storage_url TEXT,
        content_hash TEXT,
        text_content TEXT,
        language TEXT,
        status TEXT DEFAULT 'uploaded',
        analysis JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        tags JSONB DEFAULT '[]'::jsonb,
        permissions JSONB DEFAULT '{}'::jsonb,
        owner_id TEXT,
        collection_id TEXT,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_estimate INTEGER DEFAULT 0,
        embedding JSONB,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_knowledge_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        source_type TEXT DEFAULT 'document',
        source_id TEXT,
        language TEXT,
        confidence NUMERIC DEFAULT 0,
        tags JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_document_collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        collection_type TEXT DEFAULT 'general',
        owner_id TEXT,
        permissions JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_document_searches (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        filters JSONB DEFAULT '{}'::jsonb,
        results JSONB DEFAULT '[]'::jsonb,
        result_count INTEGER DEFAULT 0,
        search_type TEXT DEFAULT 'keyword',
        ai_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_documents_hash
      ON ez_documents(content_hash)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_documents_type
      ON ez_documents(document_type)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_documents_collection
      ON ez_documents(collection_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_document_chunks_document
      ON ez_document_chunks(document_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_knowledge_source
      ON ez_knowledge_items(source_id)
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

    emit("documents.initialized", {
      timestamp: now()
    });

    return getStatus();
  }

  /* ============================================================
     COLLECTIONS
  ============================================================ */

  async function createCollection(input = {}) {
    if (!input.name) {
      throw new Error(
        "Collection name is required"
      );
    }

    const collection = {
      id: input.id || id("collection"),
      name: clean(input.name),
      description: clean(input.description),
      collectionType:
        input.collectionType || "general",
      ownerId: input.ownerId || null,
      permissions: input.permissions || {},
      metadata: input.metadata || {},
      createdAt: now(),
      updatedAt: now()
    };

    state.collections.set(
      collection.id,
      collection
    );

    state.statistics.collections++;

    await query(
      `
      INSERT INTO ez_document_collections
      (
        id,
        name,
        description,
        collection_type,
        owner_id,
        permissions,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(id)
      DO UPDATE SET
        name=EXCLUDED.name,
        description=EXCLUDED.description,
        collection_type=EXCLUDED.collection_type,
        owner_id=EXCLUDED.owner_id,
        permissions=EXCLUDED.permissions,
        metadata=EXCLUDED.metadata,
        updated_at=EXCLUDED.updated_at
      `,
      [
        collection.id,
        collection.name,
        collection.description,
        collection.collectionType,
        collection.ownerId,
        JSON.stringify(collection.permissions),
        JSON.stringify(collection.metadata),
        collection.createdAt,
        collection.updatedAt
      ]
    );

    return clone(collection);
  }

  function getCollection(collectionId) {
    return clone(
      state.collections.get(collectionId) || null
    );
  }

  /* ============================================================
     DOCUMENT CREATION
  ============================================================ */

  async function createDocument(input = {}) {
    if (
      state.documents.size >=
      maxDocuments
    ) {
      throw new Error(
        "Maximum document limit reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Document name is required"
      );
    }

    const textContent =
      clean(
        input.textContent ||
        input.content ||
        ""
      );

    if (
      textContent.length >
      maxTextLength
    ) {
      throw new Error(
        "Document text exceeds maximum length"
      );
    }

    const size =
      Number(input.size || 0);

    if (
      size > maxDocumentSize
    ) {
      throw new Error(
        "Document exceeds maximum file size"
      );
    }

    const contentHash =
      input.contentHash ||
      hash(
        textContent ||
        input.storageKey ||
        input.name
      );

    const duplicate =
      Array.from(
        state.documents.values()
      ).find(
        document =>
          document.contentHash ===
          contentHash
      );

    if (duplicate) {
      return {
        duplicate: true,
        document: clone(duplicate)
      };
    }

    const document = {
      id:
        input.id ||
        id("document"),

      name:
        clean(input.name),

      title:
        clean(
          input.title ||
          input.name
        ),

      description:
        clean(input.description),

      documentType:
        input.documentType ||
        "general",

      mimeType:
        input.mimeType ||
        null,

      extension:
        input.extension ||
        null,

      size,

      storageKey:
        input.storageKey ||
        null,

      storageUrl:
        input.storageUrl ||
        null,

      contentHash,

      textContent,

      language:
        input.language ||
        "ar",

      status:
        "uploaded",

      analysis: {},

      metadata:
        input.metadata ||
        {},

      tags:
        Array.isArray(input.tags)
          ? input.tags
          : [],

      permissions:
        input.permissions ||
        {},

      ownerId:
        input.ownerId ||
        null,

      collectionId:
        input.collectionId ||
        null,

      version:
        Number(input.version || 1),

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.documents.set(
      document.id,
      document
    );

    state.statistics.documents++;

    await persistDocument(document);

    emit("document.created", {
      document: clone(document)
    });

    if (
      autoAnalyze &&
      textContent
    ) {
      try {
        await analyzeDocument(
          document.id
        );
      } catch (error) {
        logger.warn(
          "[CODE81] Document analysis failed:",
          error.message
        );
      }
    }

    return clone(document);
  }

  async function persistDocument(
    document
  ) {
    await query(
      `
      INSERT INTO ez_documents
      (
        id,
        name,
        title,
        description,
        document_type,
        mime_type,
        extension,
        size,
        storage_key,
        storage_url,
        content_hash,
        text_content,
        language,
        status,
        analysis,
        metadata,
        tags,
        permissions,
        owner_id,
        collection_id,
        version,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,$23
      )
      ON CONFLICT(id)
      DO UPDATE SET
        name=EXCLUDED.name,
        title=EXCLUDED.title,
        description=EXCLUDED.description,
        document_type=EXCLUDED.document_type,
        mime_type=EXCLUDED.mime_type,
        extension=EXCLUDED.extension,
        size=EXCLUDED.size,
        storage_key=EXCLUDED.storage_key,
        storage_url=EXCLUDED.storage_url,
        text_content=EXCLUDED.text_content,
        language=EXCLUDED.language,
        status=EXCLUDED.status,
        analysis=EXCLUDED.analysis,
        metadata=EXCLUDED.metadata,
        tags=EXCLUDED.tags,
        permissions=EXCLUDED.permissions,
        owner_id=EXCLUDED.owner_id,
        collection_id=EXCLUDED.collection_id,
        version=EXCLUDED.version,
        updated_at=EXCLUDED.updated_at
      `,
      [
        document.id,
        document.name,
        document.title,
        document.description,
        document.documentType,
        document.mimeType,
        document.extension,
        document.size,
        document.storageKey,
        document.storageUrl,
        document.contentHash,
        document.textContent,
        document.language,
        document.status,
        JSON.stringify(document.analysis),
        JSON.stringify(document.metadata),
        JSON.stringify(document.tags),
        JSON.stringify(document.permissions),
        document.ownerId,
        document.collectionId,
        document.version,
        document.createdAt,
        document.updatedAt
      ]
    );
  }

  /* ============================================================
     DOCUMENT ANALYSIS
  ============================================================ */

  async function analyzeDocument(
    documentId
  ) {
    const document =
      state.documents.get(
        documentId
      );

    if (!document) {
      throw new Error(
        "Document not found"
      );
    }

    state.statistics.aiOperations++;

    const text =
      document.textContent;

    if (!text) {
      return {
        ok: false,
        reason:
          "Document has no extracted text"
      };
    }

    let analysis = {
      language:
        document.language,

      characters:
        text.length,

      words:
        text
          .split(/\s+/)
          .filter(Boolean)
          .length,

      pages:
        Math.max(
          1,
          Math.ceil(
            text.length / 3000
          )
        ),

      keywords: [],

      summary: null,

      entities: [],

      topics: [],

      classification:
        document.documentType
    };

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        const aiResult =
          await aiCore.request({
            operation:
              "document-analysis",

            document: {
              id:
                document.id,

              title:
                document.title,

              type:
                document.documentType,

              language:
                document.language
            },

            text
          });

        analysis = {
          ...analysis,
          ...aiResult
        };
      } catch (error) {
        state.statistics.failedOperations++;

        logger.warn(
          "[CODE81] AI analysis unavailable:",
          error.message
        );
      }
    }

    document.analysis =
      analysis;

    document.status =
      "analyzed";

    document.updatedAt =
      now();

    state.statistics.analyzed++;

    await persistDocument(
      document
    );

    await indexDocument(
      document.id
    );

    await createKnowledgeFromDocument(
      document
    );

    emit("document.analyzed", {
      documentId,
      analysis: clone(analysis)
    });

    return clone(analysis);
  }

  /* ============================================================
     CHUNKING & INDEXING
  ============================================================ */

  function splitText(
    text,
    chunkSize = 4000,
    overlap = 400
  ) {
    const chunks = [];

    let start = 0;
    let index = 0;

    while (
      start < text.length
    ) {
      const end =
        Math.min(
          start +
            chunkSize,
          text.length
        );

      const content =
        text.slice(
          start,
          end
        );

      chunks.push({
        index,
        content
      });

      if (
        end >=
        text.length
      ) {
        break;
      }

      start =
        Math.max(
          0,
          end - overlap
        );

      index++;
    }

    return chunks;
  }

  async function indexDocument(
    documentId
  ) {
    const document =
      state.documents.get(
        documentId
      );

    if (!document) {
      throw new Error(
        "Document not found"
      );
    }

    const chunks =
      splitText(
        document.textContent
      );

    for (
      const chunk of chunks
    ) {
      const chunkId =
        `${documentId}_${chunk.index}`;

      const item = {
        id: chunkId,
        documentId,
        chunkIndex:
          chunk.index,
        content:
          chunk.content,
        tokenEstimate:
          Math.ceil(
            chunk.content.length /
              4
          ),
        embedding: null,
        metadata: {
          documentId,
          title:
            document.title
        },
        createdAt: now()
      };

      state.chunks.set(
        chunkId,
        item
      );

      await query(
        `
        INSERT INTO ez_document_chunks
        (
          id,
          document_id,
          chunk_index,
          content,
          token_estimate,
          embedding,
          metadata,
          created_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(id)
        DO UPDATE SET
          content=EXCLUDED.content,
          token_estimate=EXCLUDED.token_estimate,
          metadata=EXCLUDED.metadata
        `,
        [
          item.id,
          item.documentId,
          item.chunkIndex,
          item.content,
          item.tokenEstimate,
          null,
          JSON.stringify(
            item.metadata
          ),
          item.createdAt
        ]
      );
    }

    document.status =
      "indexed";

    document.updatedAt =
      now();

    state.statistics.indexed++;

    await persistDocument(
      document
    );

    return {
      documentId,
      chunks:
        chunks.length
    };
  }

  /* ============================================================
     KNOWLEDGE
  ============================================================ */

  async function createKnowledgeFromDocument(
    document
  ) {
    const analysis =
      document.analysis ||
      {};

    const content =
      analysis.summary ||
      document.textContent.slice(
        0,
        10000
      );

    const knowledge = {
      id:
        id("knowledge"),

      title:
        document.title,

      content,

      category:
        analysis.classification ||
        document.documentType,

      sourceType:
        "document",

      sourceId:
        document.id,

      language:
        document.language,

      confidence:
        Number(
          analysis.confidence ||
            0
        ),

      tags:
        document.tags,

      metadata: {
        documentId:
          document.id,

        contentHash:
          document.contentHash
      },

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.knowledge.set(
      knowledge.id,
      knowledge
    );

    state.statistics.knowledgeItems++;

    await query(
      `
      INSERT INTO ez_knowledge_items
      (
        id,
        title,
        content,
        category,
        source_type,
        source_id,
        language,
        confidence,
        tags,
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
        knowledge.id,
        knowledge.title,
        knowledge.content,
        knowledge.category,
        knowledge.sourceType,
        knowledge.sourceId,
        knowledge.language,
        knowledge.confidence,
        JSON.stringify(
          knowledge.tags
        ),
        JSON.stringify(
          knowledge.metadata
        ),
        knowledge.createdAt,
        knowledge.updatedAt
      ]
    );

    return clone(
      knowledge
    );
  }

  /* ============================================================
     SEARCH
  ============================================================ */

  async function search(
    input = {}
  ) {
    const searchId =
      id("search");

    const searchQuery =
      clean(input.query);

    if (!searchQuery) {
      throw new Error(
        "Search query is required"
      );
    }

    state.statistics.searches++;

    const terms =
      searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    let results =
      Array.from(
        state.documents.values()
      )
        .map(document => {
          const haystack =
            (
              document.title +
              " " +
              document.description +
              " " +
              document.textContent
            ).toLowerCase();

          let score = 0;

          for (
            const term of terms
          ) {
            if (
              haystack.includes(
                term
              )
            ) {
              score++;
            }

            if (
              document.title
                .toLowerCase()
                .includes(term)
            ) {
              score += 3;
            }
          }

          return {
            document,
            score
          };
        })
        .filter(
          item =>
            item.score > 0
        )
        .sort(
          (a, b) =>
            b.score -
            a.score
        );

    if (
      input.documentType
    ) {
      results =
        results.filter(
          item =>
            item.document
              .documentType ===
            input.documentType
        );
    }

    if (
      input.collectionId
    ) {
      results =
        results.filter(
          item =>
            item.document
              .collectionId ===
            input.collectionId
        );
    }

    const limited =
      results
        .slice(
          0,
          Math.min(
            Number(
              input.limit ||
                maxSearchResults
            ),
            maxSearchResults
          )
        )
        .map(
          item => ({
            id:
              item.document.id,

            title:
              item.document.title,

            type:
              item.document.documentType,

            score:
              item.score,

            status:
              item.document.status,

            collectionId:
              item.document.collectionId
          })
        );

    const record = {
      id:
        searchId,

      query:
        searchQuery,

      filters:
        input,

      results:
        limited,

      resultCount:
        limited.length,

      searchType:
        "keyword",

      aiUsed:
        false,

      createdAt:
        now()
    };

    state.searches.set(
      searchId,
      record
    );

    await query(
      `
      INSERT INTO ez_document_searches
      (
        id,
        query,
        filters,
        results,
        result_count,
        search_type,
        ai_used,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        record.id,
        record.query,
        JSON.stringify(
          record.filters
        ),
        JSON.stringify(
          record.results
        ),
        record.resultCount,
        record.searchType,
        record.aiUsed,
        record.createdAt
      ]
    );

    return clone(record);
  }

  /* ============================================================
     AI KNOWLEDGE SEARCH
  ============================================================ */

  async function askKnowledge(
    question,
    options = {}
  ) {
    if (!question) {
      throw new Error(
        "Question is required"
      );
    }

    const searchResult =
      await search({
        query:
          question,

        limit:
          options.limit ||
          10
      });

    const documents =
      searchResult.results;

    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        answer:
          "تم العثور على المستندات، لكن محرك الذكاء الاصطناعي غير متصل حاليًا.",

        sources:
          documents,

        aiUsed:
          false
      };
    }

    state.statistics.aiOperations++;

    const sourceTexts =
      documents.map(
        item => {
          const document =
            state.documents.get(
              item.id
            );

          return {
            title:
              document?.title,

            content:
              document?.textContent?.slice(
                0,
                20000
              )
          };
        }
      );

    try {
      const result =
        await aiCore.request({
          operation:
            "knowledge-question",

          question,

          sources:
            sourceTexts
        });

      return {
        answer:
          result?.answer ||
          result?.output ||
          null,

        sources:
          documents,

        confidence:
          Number(
            result?.confidence ||
              0
          ),

        aiUsed:
          true
      };
    } catch (error) {
      state.statistics.failedOperations++;

      return {
        answer:
          null,

        sources:
          documents,

        aiUsed:
          false,

        error:
          error.message
      };
    }
  }

  /* ============================================================
     DOCUMENT GETTERS
  ============================================================ */

  function getDocument(
    documentId
  ) {
    return clone(
      state.documents.get(
        documentId
      ) || null
    );
  }

  function listDocuments(
    filters = {}
  ) {
    let documents =
      Array.from(
        state.documents.values()
      );

    if (
      filters.type
    ) {
      documents =
        documents.filter(
          item =>
            item.documentType ===
            filters.type
        );
    }

    if (
      filters.status
    ) {
      documents =
        documents.filter(
          item =>
            item.status ===
            filters.status
        );
    }

    if (
      filters.collectionId
    ) {
      documents =
        documents.filter(
          item =>
            item.collectionId ===
            filters.collectionId
        );
    }

    return clone(
      documents
    );
  }

  /* ============================================================
     DELETE
  ============================================================ */

  async function deleteDocument(
    documentId
  ) {
    const document =
      state.documents.get(
        documentId
      );

    if (!document) {
      throw new Error(
        "Document not found"
      );
    }

    state.documents.delete(
      documentId
    );

    for (
      const [
        chunkId,
        chunk
      ] of state.chunks
    ) {
      if (
        chunk.documentId ===
        documentId
      ) {
        state.chunks.delete(
          chunkId
        );
      }
    }

    for (
      const [
        knowledgeId,
        item
      ] of state.knowledge
    ) {
      if (
        item.sourceId ===
        documentId
      ) {
        state.knowledge.delete(
          knowledgeId
        );
      }
    }

    await query(
      `
      DELETE FROM ez_document_chunks
      WHERE document_id = $1
      `,
      [documentId]
    );

    await query(
      `
      DELETE FROM ez_knowledge_items
      WHERE source_id = $1
      `,
      [documentId]
    );

    await query(
      `
      DELETE FROM ez_documents
      WHERE id = $1
      `,
      [documentId]
    );

    emit("document.deleted", {
      documentId
    });

    return {
      ok: true,
      documentId
    };
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...state.statistics,

      documentCache:
        state.documents.size,

      chunkCache:
        state.chunks.size,

      knowledgeCache:
        state.knowledge.size,

      collectionCache:
        state.collections.size,

      searchCache:
        state.searches.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Document & Knowledge Management Engine",

      code:
        "81",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      integrations: {
        persistence:
          Boolean(persistence),

        aiCore:
          Boolean(aiCore),

        aiOrchestrator:
          Boolean(aiOrchestrator),

        automation:
          Boolean(automationEngine),

        workflow:
          Boolean(workflowEngine),

        crm:
          Boolean(crmEngine),

        customerSupport:
          Boolean(customerSupportEngine),

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

    emit("documents.started", {
      timestamp: now()
    });

    return getStatus();
  }

  function stop() {
    state.running = false;

    emit("documents.stopped", {
      timestamp: now()
    });

    return getStatus();
  }

  return {
    initialize,
    start,
    stop,

    createCollection,
    getCollection,

    createDocument,
    getDocument,
    listDocuments,
    deleteDocument,

    analyzeDocument,
    indexDocument,

    createKnowledgeFromDocument,

    search,
    askKnowledge,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentDocumentKnowledgeEngine
};
