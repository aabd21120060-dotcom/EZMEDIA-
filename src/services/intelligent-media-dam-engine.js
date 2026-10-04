"use strict";

const crypto = require("crypto");

function createIntelligentMediaDAMEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    storageEngine = null,
    storageAdapter = null,
    mediaForensicsEngine = null,
    mediaIntelligenceEngine = null,
    documentEngine = null,
    securityEngine = null,
    workflowEngine = null,
    automationEngine = null,
    publishingEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    maxAssets = Number(
      process.env.DAM_MAX_ASSETS || 1000000
    ),

    maxTags = Number(
      process.env.DAM_MAX_TAGS_PER_ASSET || 100
    ),

    maxCollections = Number(
      process.env.DAM_MAX_COLLECTIONS || 10000
    ),

    searchLimit = Number(
      process.env.DAM_MAX_SEARCH_RESULTS || 100
    )
  } = options;

  const state = {
    initialized: false,
    running: false,

    assets: new Map(),
    collections: new Map(),
    tags: new Map(),
    assetTags: new Map(),
    renditions: new Map(),
    rights: new Map(),
    reviews: new Map(),
    usage: new Map(),

    statistics: {
      assets: 0,
      collections: 0,
      tags: 0,
      renditions: 0,
      rights: 0,
      reviews: 0,
      usageEvents: 0,
      indexedAssets: 0,
      publishedAssets: 0,
      archivedAssets: 0
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
        "[CODE85] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    if (!persistence) {
      return;
    }

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_assets (
        id TEXT PRIMARY KEY,
        storage_file_id TEXT,
        owner_id TEXT,
        title TEXT,
        description TEXT,
        asset_type TEXT NOT NULL,
        mime_type TEXT,
        object_key TEXT,
        original_name TEXT,
        size_bytes BIGINT DEFAULT 0,
        checksum_sha256 TEXT,
        status TEXT DEFAULT 'active',
        visibility TEXT DEFAULT 'private',
        ai_metadata JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        search_text TEXT,
        rights_status TEXT DEFAULT 'unknown',
        current_version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        archived_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_asset_collections (
        asset_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY(asset_id, collection_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        normalized_name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_asset_tags (
        asset_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        confidence NUMERIC DEFAULT 100,
        source TEXT DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY(asset_id, tag_id)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_renditions (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        rendition_type TEXT NOT NULL,
        object_key TEXT,
        width INTEGER,
        height INTEGER,
        duration_seconds NUMERIC,
        bitrate INTEGER,
        mime_type TEXT,
        size_bytes BIGINT DEFAULT 0,
        status TEXT DEFAULT 'queued',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_rights (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        rights_type TEXT DEFAULT 'unknown',
        owner_name TEXT,
        license_name TEXT,
        license_url TEXT,
        valid_from TIMESTAMPTZ,
        valid_until TIMESTAMPTZ,
        territories JSONB DEFAULT '[]'::jsonb,
        restrictions JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'unknown',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_reviews (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        review_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        score NUMERIC,
        decision TEXT,
        reviewer_id TEXT,
        notes TEXT,
        result JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_dam_usage (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        action TEXT NOT NULL,
        channel TEXT,
        content_id TEXT,
        user_id TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_dam_assets_type
      ON ez_dam_assets(asset_type)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_dam_assets_checksum
      ON ez_dam_assets(checksum_sha256)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_dam_assets_status
      ON ez_dam_assets(status)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_dam_assets_search
      ON ez_dam_assets USING gin (
        to_tsvector(
          'simple',
          COALESCE(search_text, '')
        )
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_dam_usage_asset
      ON ez_dam_usage(asset_id)
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

    emit("dam.initialized", {
      timestamp: now()
    });

    return getStatus();
  }

  /* ============================================================
     ASSET TYPE
  ============================================================ */

  function classifyAsset(
    mimeType = "",
    fileName = ""
  ) {
    const mime =
      String(mimeType).toLowerCase();

    const name =
      String(fileName).toLowerCase();

    if (mime.startsWith("image/")) {
      return "image";
    }

    if (mime.startsWith("video/")) {
      return "video";
    }

    if (mime.startsWith("audio/")) {
      return "audio";
    }

    if (
      mime.includes("pdf") ||
      /\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(name)
    ) {
      return "document";
    }

    return "other";
  }

  /* ============================================================
     CREATE ASSET
  ============================================================ */

  async function createAsset(input = {}) {
    if (!input.storageFileId) {
      throw new Error(
        "storageFileId is required"
      );
    }

    if (state.assets.size >= maxAssets) {
      throw new Error(
        "DAM maximum asset limit reached"
      );
    }

    const assetId = id("asset");

    const assetType =
      input.assetType ||
      classifyAsset(
        input.mimeType,
        input.originalName
      );

    const asset = {
      id: assetId,

      storageFileId:
        input.storageFileId,

      ownerId:
        input.ownerId || null,

      title:
        input.title ||
        input.originalName ||
        "Untitled asset",

      description:
        input.description || "",

      assetType,

      mimeType:
        input.mimeType ||
        "application/octet-stream",

      objectKey:
        input.objectKey ||
        null,

      originalName:
        input.originalName ||
        null,

      sizeBytes:
        Number(input.sizeBytes || 0),

      checksumSha256:
        input.checksumSha256 ||
        null,

      status: "active",

      visibility:
        input.visibility || "private",

      aiMetadata: {},

      metadata:
        input.metadata || {},

      searchText: "",

      rightsStatus: "unknown",

      currentVersion: 1,

      createdAt: now(),

      updatedAt: now(),

      archivedAt: null
    };

    asset.searchText =
      buildSearchText(asset);

    state.assets.set(
      asset.id,
      asset
    );

    state.statistics.assets++;

    await persistAsset(asset);

    emit(
      "dam.asset.created",
      clone(asset)
    );

    return clone(asset);
  }

  async function persistAsset(asset) {
    await query(
      `
      INSERT INTO ez_dam_assets
      (
        id,
        storage_file_id,
        owner_id,
        title,
        description,
        asset_type,
        mime_type,
        object_key,
        original_name,
        size_bytes,
        checksum_sha256,
        status,
        visibility,
        ai_metadata,
        metadata,
        search_text,
        rights_status,
        current_version,
        created_at,
        updated_at,
        archived_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21
      )
      ON CONFLICT(id)
      DO UPDATE SET
        title=EXCLUDED.title,
        description=EXCLUDED.description,
        status=EXCLUDED.status,
        visibility=EXCLUDED.visibility,
        ai_metadata=EXCLUDED.ai_metadata,
        metadata=EXCLUDED.metadata,
        search_text=EXCLUDED.search_text,
        rights_status=EXCLUDED.rights_status,
        current_version=EXCLUDED.current_version,
        updated_at=EXCLUDED.updated_at,
        archived_at=EXCLUDED.archived_at
      `,
      [
        asset.id,
        asset.storageFileId,
        asset.ownerId,
        asset.title,
        asset.description,
        asset.assetType,
        asset.mimeType,
        asset.objectKey,
        asset.originalName,
        asset.sizeBytes,
        asset.checksumSha256,
        asset.status,
        asset.visibility,
        JSON.stringify(asset.aiMetadata),
        JSON.stringify(asset.metadata),
        asset.searchText,
        asset.rightsStatus,
        asset.currentVersion,
        asset.createdAt,
        asset.updatedAt,
        asset.archivedAt
      ]
    );
  }

  function buildSearchText(asset) {
    return [
      asset.title,
      asset.description,
      asset.originalName,
      asset.assetType,
      asset.mimeType,
      asset.metadata
        ? JSON.stringify(asset.metadata)
        : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getAsset(assetId) {
    const asset =
      state.assets.get(assetId);

    return asset
      ? clone(asset)
      : null;
  }

  /* ============================================================
     COLLECTIONS
  ============================================================ */

  async function createCollection(
    input = {}
  ) {
    if (!input.name) {
      throw new Error(
        "Collection name is required"
      );
    }

    if (
      state.collections.size >=
      maxCollections
    ) {
      throw new Error(
        "Maximum collection limit reached"
      );
    }

    const collection = {
      id: id("collection"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      description:
        input.description || "",

      ownerId:
        input.ownerId || null,

      status: "active",

      metadata:
        input.metadata || {},

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
      INSERT INTO ez_dam_collections
      (
        id,
        name,
        description,
        owner_id,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        collection.id,
        collection.name,
        collection.description,
        collection.ownerId,
        collection.status,
        JSON.stringify(
          collection.metadata
        ),
        collection.createdAt,
        collection.updatedAt
      ]
    );

    return clone(collection);
  }

  async function addToCollection(
    assetId,
    collectionId
  ) {
    if (
      !state.assets.has(assetId)
    ) {
      throw new Error(
        "Asset not found"
      );
    }

    if (
      !state.collections.has(
        collectionId
      )
    ) {
      throw new Error(
        "Collection not found"
      );
    }

    await query(
      `
      INSERT INTO ez_dam_asset_collections
      (
        asset_id,
        collection_id
      )
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [
        assetId,
        collectionId
      ]
    );

    return {
      ok: true,
      assetId,
      collectionId
    };
  }

  /* ============================================================
     TAGS
  ============================================================ */

  async function createOrGetTag(
    name
  ) {
    const normalized =
      String(name)
        .trim()
        .toLowerCase();

    if (!normalized) {
      throw new Error(
        "Tag name is required"
      );
    }

    for (
      const tag
      of state.tags.values()
    ) {
      if (
        tag.normalizedName ===
        normalized
      ) {
        return clone(tag);
      }
    }

    const tag = {
      id: id("tag"),

      name:
        String(name)
          .trim()
          .slice(0, 100),

      normalizedName:
        normalized,

      createdAt: now()
    };

    state.tags.set(
      tag.id,
      tag
    );

    state.statistics.tags++;

    await query(
      `
      INSERT INTO ez_dam_tags
      (
        id,
        name,
        normalized_name,
        created_at
      )
      VALUES ($1,$2,$3,$4)
      ON CONFLICT(normalized_name)
      DO NOTHING
      `,
      [
        tag.id,
        tag.name,
        tag.normalizedName,
        tag.createdAt
      ]
    );

    return clone(tag);
  }

  async function tagAsset(
    assetId,
    input = {}
  ) {
    if (
      !state.assets.has(assetId)
    ) {
      throw new Error(
        "Asset not found"
      );
    }

    const names =
      Array.isArray(input.tags)
        ? input.tags
        : [];

    if (
      names.length > maxTags
    ) {
      throw new Error(
        "Too many tags"
      );
    }

    const results = [];

    for (const name of names) {
      const tag =
        await createOrGetTag(name);

      state.assetTags.set(
        `${assetId}:${tag.id}`,
        {
          assetId,
          tagId: tag.id,
          confidence:
            Number(
              input.confidence ?? 100
            ),
          source:
            input.source || "manual"
        }
      );

      await query(
        `
        INSERT INTO ez_dam_asset_tags
        (
          asset_id,
          tag_id,
          confidence,
          source
        )
        VALUES ($1,$2,$3,$4)
        ON CONFLICT(asset_id, tag_id)
        DO UPDATE SET
          confidence=EXCLUDED.confidence,
          source=EXCLUDED.source
        `,
        [
          assetId,
          tag.id,
          Number(
            input.confidence ?? 100
          ),
          input.source || "manual"
        ]
      );

      results.push(tag);
    }

    return results;
  }

  /* ============================================================
     AI ANALYSIS
  ============================================================ */

  async function analyzeAsset(
    assetId
  ) {
    const asset =
      state.assets.get(assetId);

    if (!asset) {
      throw new Error(
        "Asset not found"
      );
    }

    const result = {
      ai: null,
      forensics: null,
      intelligence: null
    };

    if (
      mediaForensicsEngine &&
      typeof mediaForensicsEngine.analyze ===
        "function"
    ) {
      try {
        result.forensics =
          await mediaForensicsEngine.analyze(
            {
              mediaHash:
                asset.checksumSha256,

              mimeType:
                asset.mimeType,

              size:
                asset.sizeBytes,

              objectKey:
                asset.objectKey
            }
          );
      } catch (error) {
        result.forensics = {
          status: "unavailable",
          error: error.message
        };
      }
    }

    if (
      mediaIntelligenceEngine &&
      typeof mediaIntelligenceEngine.analyze ===
        "function"
    ) {
      try {
        result.intelligence =
          await mediaIntelligenceEngine.analyze(
            {
              mediaHash:
                asset.checksumSha256,

              mimeType:
                asset.mimeType,

              objectKey:
                asset.objectKey,

              fileName:
                asset.originalName
            }
          );
      } catch (error) {
        result.intelligence = {
          status: "unavailable",
          error: error.message
        };
      }
    }

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        result.ai =
          await aiCore.request({
            operation:
              "dam-asset-analysis",

            input: {
              asset,
              forensics:
                result.forensics,
              intelligence:
                result.intelligence
            }
          });
      } catch (error) {
        result.ai = {
          status: "unavailable",
          error: error.message
        };
      }
    }

    asset.aiMetadata =
      result;

    asset.metadata = {
      ...asset.metadata,

      analyzedAt: now()
    };

    asset.searchText =
      buildSearchText(asset);

    asset.updatedAt = now();

    state.statistics.indexedAssets++;

    await persistAsset(asset);

    emit(
      "dam.asset.analyzed",
      {
        assetId,
        result
      }
    );

    return {
      asset: clone(asset),
      analysis: clone(result)
    };
  }

  /* ============================================================
     RIGHTS MANAGEMENT
  ============================================================ */

  async function setRights(
    assetId,
    input = {}
  ) {
    if (
      !state.assets.has(assetId)
    ) {
      throw new Error(
        "Asset not found"
      );
    }

    const rights = {
      id: id("rights"),

      assetId,

      rightsType:
        input.rightsType ||
        "unknown",

      ownerName:
        input.ownerName ||
        null,

      licenseName:
        input.licenseName ||
        null,

      licenseUrl:
        input.licenseUrl ||
        null,

      validFrom:
        input.validFrom ||
        null,

      validUntil:
        input.validUntil ||
        null,

      territories:
        input.territories || [],

      restrictions:
        input.restrictions || [],

      status:
        input.status ||
        "active",

      metadata:
        input.metadata || {},

      createdAt: now(),

      updatedAt: now()
    };

    state.rights.set(
      rights.id,
      rights
    );

    state.statistics.rights++;

    const asset =
      state.assets.get(assetId);

    asset.rightsStatus =
      rights.status;

    asset.updatedAt = now();

    await persistAsset(asset);

    await query(
      `
      INSERT INTO ez_dam_rights
      (
        id,
        asset_id,
        rights_type,
        owner_name,
        license_name,
        license_url,
        valid_from,
        valid_until,
        territories,
        restrictions,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14
      )
      `,
      [
        rights.id,
        rights.assetId,
        rights.rightsType,
        rights.ownerName,
        rights.licenseName,
        rights.licenseUrl,
        rights.validFrom,
        rights.validUntil,
        JSON.stringify(
          rights.territories
        ),
        JSON.stringify(
          rights.restrictions
        ),
        rights.status,
        JSON.stringify(
          rights.metadata
        ),
        rights.createdAt,
        rights.updatedAt
      ]
    );

    return clone(rights);
  }

  /* ============================================================
     REVIEWS
  ============================================================ */

  async function createReview(
    assetId,
    input = {}
  ) {
    if (
      !state.assets.has(assetId)
    ) {
      throw new Error(
        "Asset not found"
      );
    }

    const review = {
      id: id("review"),

      assetId,

      reviewType:
        input.reviewType ||
        "editorial",

      status: "pending",

      score:
        input.score ??
        null,

      decision:
        input.decision ||
        null,

      reviewerId:
        input.reviewerId ||
        null,

      notes:
        input.notes ||
        "",

      result:
        input.result || {},

      createdAt: now(),

      completedAt:
        null
    };

    state.reviews.set(
      review.id,
      review
    );

    state.statistics.reviews++;

    await query(
      `
      INSERT INTO ez_dam_reviews
      (
        id,
        asset_id,
        review_type,
        status,
        score,
        decision,
        reviewer_id,
        notes,
        result,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      `,
      [
        review.id,
        review.assetId,
        review.reviewType,
        review.status,
        review.score,
        review.decision,
        review.reviewerId,
        review.notes,
        JSON.stringify(
          review.result
        ),
        review.createdAt
      ]
    );

    return clone(review);
  }

  async function completeReview(
    reviewId,
    input = {}
  ) {
    const review =
      state.reviews.get(reviewId);

    if (!review) {
      throw new Error(
        "Review not found"
      );
    }

    review.status =
      input.status ||
      "completed";

    review.score =
      input.score ??
      review.score;

    review.decision =
      input.decision ||
      review.decision;

    review.notes =
      input.notes ??
      review.notes;

    review.result =
      input.result ||
      review.result;

    review.completedAt =
      now();

    await query(
      `
      UPDATE ez_dam_reviews
      SET
        status=$1,
        score=$2,
        decision=$3,
        notes=$4,
        result=$5,
        completed_at=$6
      WHERE id=$7
      `,
      [
        review.status,
        review.score,
        review.decision,
        review.notes,
        JSON.stringify(
          review.result
        ),
        review.completedAt,
        review.id
      ]
    );

    return clone(review);
  }

  /* ============================================================
     RENDITIONS
  ============================================================ */

  async function createRendition(
    assetId,
    input = {}
  ) {
    if (
      !state.assets.has(assetId)
    ) {
      throw new Error(
        "Asset not found"
      );
    }

    const rendition = {
      id: id("rendition"),

      assetId,

      renditionType:
        input.renditionType ||
        "preview",

      objectKey:
        input.objectKey ||
        null,

      width:
        input.width ??
        null,

      height:
        input.height ??
        null,

      durationSeconds:
        input.durationSeconds ??
        null,

      bitrate:
        input.bitrate ??
        null,

      mimeType:
        input.mimeType ||
        null,

      sizeBytes:
        Number(
          input.sizeBytes || 0
        ),

      status:
        input.status ||
        "queued",

      metadata:
        input.metadata || {},

      createdAt: now()
    };

    state.renditions.set(
      rendition.id,
      rendition
    );

    state.statistics.renditions++;

    await query(
      `
      INSERT INTO ez_dam_renditions
      (
        id,
        asset_id,
        rendition_type,
        object_key,
        width,
        height,
        duration_seconds,
        bitrate,
        mime_type,
        size_bytes,
        status,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13
      )
      `,
      [
        rendition.id,
        rendition.assetId,
        rendition.renditionType,
        rendition.objectKey,
        rendition.width,
        rendition.height,
        rendition.durationSeconds,
        rendition.bitrate,
        rendition.mimeType,
        rendition.sizeBytes,
        rendition.status,
        JSON.stringify(
          rendition.metadata
        ),
        rendition.createdAt
      ]
    );

    return clone(rendition);
  }

  /* ============================================================
     USAGE TRACKING
  ============================================================ */

  async function recordUsage(
    assetId,
    input = {}
  ) {
    if (
      !state.assets.has(assetId)
    ) {
      throw new Error(
        "Asset not found"
      );
    }

    const usage = {
      id: id("usage"),

      assetId,

      action:
        input.action ||
        "view",

      channel:
        input.channel ||
        null,

      contentId:
        input.contentId ||
        null,

      userId:
        input.userId ||
        null,

      metadata:
        input.metadata || {},

      createdAt: now()
    };

    state.usage.set(
      usage.id,
      usage
    );

    state.statistics.usageEvents++;

    if (
      usage.action ===
      "publish"
    ) {
      state.statistics
        .publishedAssets++;
    }

    await query(
      `
      INSERT INTO ez_dam_usage
      (
        id,
        asset_id,
        action,
        channel,
        content_id,
        user_id,
        metadata,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        usage.id,
        usage.assetId,
        usage.action,
        usage.channel,
        usage.contentId,
        usage.userId,
        JSON.stringify(
          usage.metadata
        ),
        usage.createdAt
      ]
    );

    emit(
      "dam.asset.used",
      clone(usage)
    );

    return clone(usage);
  }

  /* ============================================================
     SEARCH
  ============================================================ */

  function search(
    input = {}
  ) {
    const queryText =
      String(
        input.query || ""
      )
        .trim()
        .toLowerCase();

    let assets =
      Array.from(
        state.assets.values()
      );

    if (queryText) {
      assets =
        assets.filter(
          asset => {
            const text =
              [
                asset.title,
                asset.description,
                asset.originalName,
                asset.assetType,
                asset.mimeType,
                asset.searchText
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return text.includes(
              queryText
            );
          }
        );
    }

    if (input.assetType) {
      assets =
        assets.filter(
          asset =>
            asset.assetType ===
            input.assetType
        );
    }

    if (input.status) {
      assets =
        assets.filter(
          asset =>
            asset.status ===
            input.status
        );
    }

    if (input.ownerId) {
      assets =
        assets.filter(
          asset =>
            asset.ownerId ===
            input.ownerId
        );
    }

    if (input.rightsStatus) {
      assets =
        assets.filter(
          asset =>
            asset.rightsStatus ===
            input.rightsStatus
        );
    }

    const limit =
      Math.min(
        Number(
          input.limit ||
          searchLimit
        ),
        searchLimit
      );

    return clone(
      assets.slice(
        0,
        limit
      )
    );
  }

  /* ============================================================
     ARCHIVE
  ============================================================ */

  async function archiveAsset(
    assetId
  ) {
    const asset =
      state.assets.get(assetId);

    if (!asset) {
      throw new Error(
        "Asset not found"
      );
    }

    asset.status =
      "archived";

    asset.archivedAt =
      now();

    asset.updatedAt =
      now();

    state.statistics
      .archivedAssets++;

    await persistAsset(asset);

    emit(
      "dam.asset.archived",
      {
        assetId
      }
    );

    return clone(asset);
  }

  async function restoreAsset(
    assetId
  ) {
    const asset =
      state.assets.get(assetId);

    if (!asset) {
      throw new Error(
        "Asset not found"
      );
    }

    asset.status =
      "active";

    asset.archivedAt =
      null;

    asset.updatedAt =
      now();

    await persistAsset(asset);

    emit(
      "dam.asset.restored",
      {
        assetId
      }
    );

    return clone(asset);
  }

  /* ============================================================
     STATISTICS / STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      limits: {
        maxAssets,
        maxTags,
        maxCollections,
        searchLimit
      }
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Media Library & Digital Asset Management",

      code:
        "CODE 85",

      initialized:
        state.initialized,

      running:
        state.running,

      storage: {
        engine:
          Boolean(storageEngine),

        adapter:
          Boolean(storageAdapter)
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running = true;

    emit(
      "dam.started",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  function stop() {
    state.running = false;

    emit(
      "dam.stopped",
      {
        timestamp: now()
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

    createAsset,
    getAsset,

    createCollection,
    addToCollection,

    createOrGetTag,
    tagAsset,

    analyzeAsset,

    setRights,

    createReview,
    completeReview,

    createRendition,

    recordUsage,

    search,

    archiveAsset,
    restoreAsset
  };
}

module.exports = {
  createIntelligentMediaDAMEngine
};
