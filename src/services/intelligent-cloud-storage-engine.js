"use strict";

const crypto = require("crypto");
const path = require("path");

function createIntelligentCloudStorageEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,
    securityEngine = null,
    mediaForensicsEngine = null,
    mediaIntelligenceEngine = null,
    documentEngine = null,
    workflowEngine = null,
    automationEngine = null,
    notificationService = null,
    eventBus = null,
    logger = console,

    provider =
      process.env.STORAGE_PROVIDER || "s3",

    maxFileSize =
      Number(
        process.env.STORAGE_MAX_FILE_SIZE ||
        1073741824
      ),

    maxFiles =
      Number(
        process.env.STORAGE_MAX_FILES ||
        1000000
      ),

    multipartThreshold =
      Number(
        process.env.STORAGE_MULTIPART_THRESHOLD ||
        52428800
      ),

    signedUrlMinutes =
      Number(
        process.env.STORAGE_SIGNED_URL_MINUTES ||
        30
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    files: new Map(),
    folders: new Map(),
    uploads: new Map(),
    versions: new Map(),
    shares: new Map(),
    processingJobs: new Map(),

    statistics: {
      files: 0,
      folders: 0,
      uploads: 0,
      versions: 0,
      shares: 0,
      processingJobs: 0,
      totalBytes: 0,
      activeFiles: 0,
      deletedFiles: 0
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

  function clone(value) {
    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch {
      return null;
    }
  }

  async function query(
    sql,
    values = []
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return null;
    }

    return persistence.query(
      sql,
      values
    );
  }

  function emit(
    event,
    payload = {}
  ) {
    try {
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
      logger.warn(
        "[CODE84] Event error:",
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
      CREATE TABLE IF NOT EXISTS ez_storage_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        path TEXT UNIQUE NOT NULL,
        owner_id TEXT,
        status TEXT DEFAULT 'active',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_storage_files (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        owner_id TEXT,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        object_key TEXT NOT NULL,
        provider TEXT NOT NULL,
        mime_type TEXT,
        extension TEXT,
        size_bytes BIGINT DEFAULT 0,
        checksum_sha256 TEXT,
        etag TEXT,
        category TEXT DEFAULT 'other',
        status TEXT DEFAULT 'active',
        visibility TEXT DEFAULT 'private',
        current_version INTEGER DEFAULT 1,
        metadata JSONB DEFAULT '{}'::jsonb,
        ai_metadata JSONB DEFAULT '{}'::jsonb,
        security_metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_storage_versions (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        object_key TEXT NOT NULL,
        size_bytes BIGINT DEFAULT 0,
        checksum_sha256 TEXT,
        etag TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(file_id, version_number)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_storage_uploads (
        id TEXT PRIMARY KEY,
        file_id TEXT,
        upload_token_hash TEXT UNIQUE,
        provider TEXT NOT NULL,
        object_key TEXT,
        status TEXT DEFAULT 'created',
        multipart BOOLEAN DEFAULT FALSE,
        expected_size BIGINT,
        uploaded_size BIGINT DEFAULT 0,
        mime_type TEXT,
        original_name TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_storage_shares (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        permission TEXT DEFAULT 'read',
        expires_at TIMESTAMPTZ,
        max_downloads INTEGER,
        download_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_storage_processing_jobs (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT DEFAULT 'queued',
        priority INTEGER DEFAULT 50,
        result JSONB DEFAULT '{}'::jsonb,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_storage_files_folder
      ON ez_storage_files(folder_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_storage_files_checksum
      ON ez_storage_files(checksum_sha256)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_storage_uploads_status
      ON ez_storage_uploads(status)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_storage_jobs_file
      ON ez_storage_processing_jobs(file_id)
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

    emit(
      "storage.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     FILE CLASSIFICATION
  ============================================================ */

  function classifyFile(
    mimeType = "",
    fileName = ""
  ) {
    const mime =
      String(mimeType)
        .toLowerCase();

    const extension =
      path
        .extname(fileName)
        .toLowerCase();

    if (
      mime.startsWith(
        "image/"
      )
    ) {
      return "image";
    }

    if (
      mime.startsWith(
        "video/"
      )
    ) {
      return "video";
    }

    if (
      mime.startsWith(
        "audio/"
      )
    ) {
      return "audio";
    }

    if (
      mime.includes(
        "pdf"
      ) ||
      [
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx"
      ].includes(extension)
    ) {
      return "document";
    }

    if (
      mime.includes(
        "zip"
      ) ||
      mime.includes(
        "compressed"
      )
    ) {
      return "archive";
    }

    return "other";
  }

  function sanitizeName(
    fileName
  ) {
    return String(
      fileName ||
        "file"
    )
      .replace(
        /[\/\\:*?"<>|]/g,
        "_"
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        255
      );
  }

  function buildObjectKey(
    file
  ) {
    const date =
      new Date();

    const yyyy =
      date.getUTCFullYear();

    const mm =
      String(
        date.getUTCMonth() + 1
      ).padStart(2, "0");

    const dd =
      String(
        date.getUTCDate()
      ).padStart(2, "0");

    return [
      "ez-media",
      file.category,
      String(yyyy),
      mm,
      dd,
      file.id,
      file.storedName
    ].join("/");
  }

  /* ============================================================
     FOLDERS
  ============================================================ */

  async function createFolder(
    input = {}
  ) {
    if (!input.name) {
      throw new Error(
        "Folder name is required"
      );
    }

    const name =
      sanitizeName(
        input.name
      );

    const parent =
      input.parentId
        ? state.folders.get(
            input.parentId
          )
        : null;

    if (
      input.parentId &&
      !parent
    ) {
      throw new Error(
        "Parent folder not found"
      );
    }

    const folderPath =
      parent
        ? `${parent.path}/${name}`
        : `/${name}`;

    const folder = {
      id:
        id("folder"),

      name,

      parentId:
        input.parentId ||
        null,

      path:
        folderPath,

      ownerId:
        input.ownerId ||
        null,

      status:
        "active",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.folders.set(
      folder.id,
      folder
    );

    state.statistics.folders++;

    await query(
      `
      INSERT INTO ez_storage_folders
      (
        id,
        name,
        parent_id,
        path,
        owner_id,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        folder.id,
        folder.name,
        folder.parentId,
        folder.path,
        folder.ownerId,
        folder.status,
        JSON.stringify(
          folder.metadata
        ),
        folder.createdAt,
        folder.updatedAt
      ]
    );

    return clone(folder);
  }

  function listFolders(
    parentId = null
  ) {
    return Array.from(
      state.folders.values()
    )
      .filter(
        folder =>
          folder.parentId ===
          parentId
      )
      .map(clone);
  }

  /* ============================================================
     FILE RECORD
  ============================================================ */

  async function createFileRecord(
    input = {}
  ) {
    if (!input.originalName) {
      throw new Error(
        "originalName is required"
      );
    }

    const originalName =
      sanitizeName(
        input.originalName
      );

    const mimeType =
      input.mimeType ||
      "application/octet-stream";

    const sizeBytes =
      Number(
        input.sizeBytes || 0
      );

    if (
      sizeBytes >
      maxFileSize
    ) {
      throw new Error(
        "File exceeds maximum allowed size"
      );
    }

    if (
      state.files.size >=
      maxFiles
    ) {
      throw new Error(
        "Maximum storage file count reached"
      );
    }

    const category =
      input.category ||
      classifyFile(
        mimeType,
        originalName
      );

    const fileId =
      id("file");

    const extension =
      path
        .extname(originalName)
        .toLowerCase();

    const storedName =
      `${fileId}${extension}`;

    const file = {
      id:
        fileId,

      folderId:
        input.folderId ||
        null,

      ownerId:
        input.ownerId ||
        null,

      originalName,

      storedName,

      objectKey:
        "",

      provider,

      mimeType,

      extension,

      sizeBytes,

      checksumSha256:
        input.checksumSha256 ||
        null,

      etag:
        input.etag ||
        null,

      category,

      status:
        "active",

      visibility:
        input.visibility ||
        "private",

      currentVersion:
        1,

      metadata:
        input.metadata ||
        {},

      aiMetadata:
        {},

      securityMetadata:
        {},

      createdAt:
        now(),

      updatedAt:
        now(),

      deletedAt:
        null
    };

    file.objectKey =
      buildObjectKey(
        file
      );

    state.files.set(
      file.id,
      file
    );

    state.statistics.files++;
    state.statistics.activeFiles++;
    state.statistics.totalBytes +=
      sizeBytes;

    await persistFile(
      file
    );

    await createVersion({
      fileId:
        file.id,

      versionNumber:
        1,

      objectKey:
        file.objectKey,

      sizeBytes,

      checksumSha256:
        file.checksumSha256,

      etag:
        file.etag
    });

    emit(
      "storage.file.created",
      clone(file)
    );

    return clone(file);
  }

  async function persistFile(
    file
  ) {
    await query(
      `
      INSERT INTO ez_storage_files
      (
        id,
        folder_id,
        owner_id,
        original_name,
        stored_name,
        object_key,
        provider,
        mime_type,
        extension,
        size_bytes,
        checksum_sha256,
        etag,
        category,
        status,
        visibility,
        current_version,
        metadata,
        ai_metadata,
        security_metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21
      )
      ON CONFLICT(id)
      DO UPDATE SET
        folder_id=EXCLUDED.folder_id,
        owner_id=EXCLUDED.owner_id,
        original_name=EXCLUDED.original_name,
        object_key=EXCLUDED.object_key,
        size_bytes=EXCLUDED.size_bytes,
        checksum_sha256=EXCLUDED.checksum_sha256,
        etag=EXCLUDED.etag,
        status=EXCLUDED.status,
        visibility=EXCLUDED.visibility,
        current_version=EXCLUDED.current_version,
        metadata=EXCLUDED.metadata,
        ai_metadata=EXCLUDED.ai_metadata,
        security_metadata=EXCLUDED.security_metadata,
        updated_at=EXCLUDED.updated_at,
        deleted_at=EXCLUDED.deleted_at
      `,
      [
        file.id,
        file.folderId,
        file.ownerId,
        file.originalName,
        file.storedName,
        file.objectKey,
        file.provider,
        file.mimeType,
        file.extension,
        file.sizeBytes,
        file.checksumSha256,
        file.etag,
        file.category,
        file.status,
        file.visibility,
        file.currentVersion,
        JSON.stringify(
          file.metadata
        ),
        JSON.stringify(
          file.aiMetadata
        ),
        JSON.stringify(
          file.securityMetadata
        ),
        file.createdAt,
        file.updatedAt
      ]
    );
  }

  function getFile(
    fileId
  ) {
    const file =
      state.files.get(
        fileId
      );

    return file
      ? clone(file)
      : null;
  }

  function listFiles(
    filters = {}
  ) {
    let files =
      Array.from(
        state.files.values()
      );

    if (
      filters.folderId
    ) {
      files =
        files.filter(
          file =>
            file.folderId ===
            filters.folderId
        );
    }

    if (
      filters.category
    ) {
      files =
        files.filter(
          file =>
            file.category ===
            filters.category
        );
    }

    if (
      filters.status
    ) {
      files =
        files.filter(
          file =>
            file.status ===
            filters.status
        );
    }

    return clone(
      files
    );
  }

  /* ============================================================
     UPLOADS
  ============================================================ */

  async function createUpload(
    input = {}
  ) {
    const originalName =
      sanitizeName(
        input.originalName
      );

    const expectedSize =
      Number(
        input.expectedSize ||
        0
      );

    if (
      expectedSize >
      maxFileSize
    ) {
      throw new Error(
        "Expected file size exceeds configured limit"
      );
    }

    const uploadToken =
      "upload_" +
      crypto.randomBytes(
        40
      ).toString("hex");

    const upload = {
      id:
        id("upload"),

      fileId:
        input.fileId ||
        null,

      uploadTokenHash:
        hash(
          uploadToken
        ),

      provider,

      objectKey:
        input.objectKey ||
        null,

      status:
        "created",

      multipart:
        expectedSize >=
        multipartThreshold,

      expectedSize,

      uploadedSize:
        0,

      mimeType:
        input.mimeType ||
        "application/octet-stream",

      originalName,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      completedAt:
        null,

      expiresAt:
        new Date(
          Date.now() +
            60 *
              60 *
              1000
        ).toISOString()
    };

    state.uploads.set(
      upload.id,
      upload
    );

    state.statistics.uploads++;

    await query(
      `
      INSERT INTO ez_storage_uploads
      (
        id,
        file_id,
        upload_token_hash,
        provider,
        object_key,
        status,
        multipart,
        expected_size,
        uploaded_size,
        mime_type,
        original_name,
        metadata,
        created_at,
        expires_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14
      )
      `,
      [
        upload.id,
        upload.fileId,
        upload.uploadTokenHash,
        upload.provider,
        upload.objectKey,
        upload.status,
        upload.multipart,
        upload.expectedSize,
        upload.uploadedSize,
        upload.mimeType,
        upload.originalName,
        JSON.stringify(
          upload.metadata
        ),
        upload.createdAt,
        upload.expiresAt
      ]
    );

    return {
      uploadId:
        upload.id,

      uploadToken,

      provider:
        upload.provider,

      multipart:
        upload.multipart,

      expiresAt:
        upload.expiresAt
    };
  }

  async function completeUpload(
    uploadId,
    input = {}
  ) {
    const upload =
      state.uploads.get(
        uploadId
      );

    if (!upload) {
      throw new Error(
        "Upload not found"
      );
    }

    if (
      upload.status ===
      "completed"
    ) {
      return clone(upload);
    }

    const uploadedSize =
      Number(
        input.uploadedSize ??
          upload.expectedSize
      );

    if (
      uploadedSize >
      maxFileSize
    ) {
      throw new Error(
        "Uploaded file exceeds maximum size"
      );
    }

    upload.uploadedSize =
      uploadedSize;

    upload.objectKey =
      input.objectKey ||
      upload.objectKey;

    upload.status =
      "completed";

    upload.completedAt =
      now();

    await query(
      `
      UPDATE ez_storage_uploads
      SET
        object_key=$1,
        status='completed',
        uploaded_size=$2,
        completed_at=NOW()
      WHERE id=$3
      `,
      [
        upload.objectKey,
        upload.uploadedSize,
        upload.id
      ]
    );

    emit(
      "storage.upload.completed",
      clone(upload)
    );

    return clone(upload);
  }

  /* ============================================================
     VERSIONS
  ============================================================ */

  async function createVersion(
    input = {}
  ) {
    const version = {
      id:
        id("version"),

      fileId:
        input.fileId,

      versionNumber:
        Number(
          input.versionNumber ||
            1
        ),

      objectKey:
        input.objectKey,

      sizeBytes:
        Number(
          input.sizeBytes ||
            0
        ),

      checksumSha256:
        input.checksumSha256 ||
        null,

      etag:
        input.etag ||
        null,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.versions.set(
      version.id,
      version
    );

    state.statistics.versions++;

    await query(
      `
      INSERT INTO ez_storage_versions
      (
        id,
        file_id,
        version_number,
        object_key,
        size_bytes,
        checksum_sha256,
        etag,
        metadata,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(file_id, version_number)
      DO UPDATE SET
        object_key=EXCLUDED.object_key,
        size_bytes=EXCLUDED.size_bytes,
        checksum_sha256=EXCLUDED.checksum_sha256,
        etag=EXCLUDED.etag,
        metadata=EXCLUDED.metadata
      `,
      [
        version.id,
        version.fileId,
        version.versionNumber,
        version.objectKey,
        version.sizeBytes,
        version.checksumSha256,
        version.etag,
        JSON.stringify(
          version.metadata
        ),
        version.createdAt
      ]
    );

    return clone(version);
  }

  function listVersions(
    fileId
  ) {
    return Array.from(
      state.versions.values()
    )
      .filter(
        version =>
          version.fileId ===
          fileId
      )
      .sort(
        (a, b) =>
          a.versionNumber -
          b.versionNumber
      )
      .map(clone);
  }

  /* ============================================================
     FILE PROCESSING
  ============================================================ */

  async function queueProcessing(
    fileId,
    jobType,
    priority = 50
  ) {
    const file =
      state.files.get(
        fileId
      );

    if (!file) {
      throw new Error(
        "File not found"
      );
    }

    const job = {
      id:
        id("storage_job"),

      fileId,

      jobType,

      status:
        "queued",

      priority,

      result:
        {},

      error:
        null,

      createdAt:
        now(),

      startedAt:
        null,

      completedAt:
        null
    };

    state.processingJobs.set(
      job.id,
      job
    );

    state.statistics
      .processingJobs++;

    await query(
      `
      INSERT INTO ez_storage_processing_jobs
      (
        id,
        file_id,
        job_type,
        status,
        priority,
        result,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        job.id,
        job.fileId,
        job.jobType,
        job.status,
        job.priority,
        JSON.stringify(
          job.result
        ),
        job.createdAt
      ]
    );

    emit(
      "storage.processing.queued",
      clone(job)
    );

    return clone(job);
  }

  async function processFile(
    fileId
  ) {
    const file =
      state.files.get(
        fileId
      );

    if (!file) {
      throw new Error(
        "File not found"
      );
    }

    const results = {};

    /*
     * 1. Security / media forensics
     */

    if (
      mediaForensicsEngine &&
      [
        "image",
        "video",
        "audio"
      ].includes(
        file.category
      ) &&
      typeof mediaForensicsEngine
        .analyze ===
        "function"
    ) {
      try {
        results.forensics =
          await mediaForensicsEngine
            .analyze({
              mediaHash:
                file.checksumSha256,

              mimeType:
                file.mimeType,

              size:
                file.sizeBytes,

              objectKey:
                file.objectKey
            });
      } catch (error) {
        results.forensics = {
          status:
            "unavailable",

          error:
            error.message
        };
      }
    }

    /*
     * 2. Media Intelligence
     */

    if (
      mediaIntelligenceEngine &&
      [
        "image",
        "video",
        "audio"
      ].includes(
        file.category
      ) &&
      typeof mediaIntelligenceEngine
        .analyze ===
        "function"
    ) {
      try {
        results.intelligence =
          await mediaIntelligenceEngine
            .analyze({
              mediaHash:
                file.checksumSha256,

              mimeType:
                file.mimeType,

              objectKey:
                file.objectKey,

              fileName:
                file.originalName
            });
      } catch (error) {
        results.intelligence = {
          status:
            "unavailable",

          error:
            error.message
        };
      }
    }

    /*
     * 3. Documents / Knowledge
     */

    if (
      documentEngine &&
      file.category ===
        "document"
    ) {
      results.document = {
        queued:
          true
      };
    }

    /*
     * 4. AI analysis
     */

   
