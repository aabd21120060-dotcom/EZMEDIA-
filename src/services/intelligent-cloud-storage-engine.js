  /* ============================================================
     SIGNED URL / STORAGE PROVIDER
  ============================================================ */

  function storageProviderConfigured() {
    return Boolean(
      process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY &&
      process.env.STORAGE_SECRET_KEY
    );
  }

  function getProviderStatus() {
    return {
      provider,
      configured:
        storageProviderConfigured(),
      bucket:
        process.env.STORAGE_BUCKET ||
        null,
      region:
        process.env.STORAGE_REGION ||
        null,
      endpoint:
        process.env.STORAGE_ENDPOINT ||
        null
    };
  }

  /*
   * هذه الطبقة لا تخترع رابطًا حقيقيًا.
   * الرابط الفعلي يجب أن يصدر من Adapter للمزود.
   */

  async function createSignedUpload(
    input = {}
  ) {
    const upload =
      await createUpload(
        input
      );

    return {
      ...upload,

      mode:
        storageProviderConfigured()
          ? "provider-ready"
          : "provider-not-configured",

      objectKey:
        input.objectKey ||
        null,

      uploadUrl:
        null,

      message:
        storageProviderConfigured()
          ? "Storage provider is configured but a provider adapter must generate the signed URL."
          : "Configure STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY."
    };
  }

  async function createSignedDownload(
    fileId,
    input = {}
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

    if (
      file.status !==
      "active"
    ) {
      throw new Error(
        "File is not available"
      );
    }

    return {
      fileId:
        file.id,

      objectKey:
        file.objectKey,

      expiresInMinutes:
        Number(
          input.expiresInMinutes ||
            signedUrlMinutes
        ),

      downloadUrl:
        null,

      provider,
      
      configured:
        storageProviderConfigured(),

      message:
        storageProviderConfigured()
          ? "Provider adapter must generate the signed download URL."
          : "Storage provider is not configured."
    };
  }

  /* ============================================================
     DUPLICATE DETECTION
  ============================================================ */

  function findDuplicate(
    checksumSha256
  ) {
    if (!checksumSha256) {
      return null;
    }

    for (
      const file
      of state.files.values()
    ) {
      if (
        file.status ===
          "active" &&
        file.checksumSha256 ===
          checksumSha256
      ) {
        return clone(file);
      }
    }

    return null;
  }

  /* ============================================================
     UPDATE FILE METADATA
  ============================================================ */

  async function updateFile(
    fileId,
    updates = {}
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

    if (
      updates.originalName
    ) {
      file.originalName =
        sanitizeName(
          updates.originalName
        );
    }

    if (
      updates.folderId !==
      undefined
    ) {
      file.folderId =
        updates.folderId;
    }

    if (
      updates.visibility
    ) {
      file.visibility =
        updates.visibility;
    }

    if (
      updates.metadata
    ) {
      file.metadata = {
        ...file.metadata,
        ...updates.metadata
      };
    }

    file.updatedAt =
      now();

    await persistFile(
      file
    );

    emit(
      "storage.file.updated",
      clone(file)
    );

    return clone(file);
  }

  /* ============================================================
     DELETE / RESTORE
  ============================================================ */

  async function deleteFile(
    fileId,
    permanent = false
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

    if (permanent) {
      file.status =
        "deleted";

      file.deletedAt =
        now();

      state.statistics
        .deletedFiles++;

      state.statistics
        .activeFiles =
        Math.max(
          0,
          state.statistics
            .activeFiles - 1
        );
    } else {
      file.status =
        "trash";

      file.deletedAt =
        now();

      state.statistics
        .activeFiles =
        Math.max(
          0,
          state.statistics
            .activeFiles - 1
        );
    }

    file.updatedAt =
      now();

    await persistFile(
      file
    );

    emit(
      "storage.file.deleted",
      {
        fileId,
        permanent
      }
    );

    return clone(file);
  }

  async function restoreFile(
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

    if (
      file.status !==
      "trash"
    ) {
      throw new Error(
        "Only files in trash can be restored"
      );
    }

    file.status =
      "active";

    file.deletedAt =
      null;

    file.updatedAt =
      now();

    state.statistics
      .activeFiles++;

    await persistFile(
      file
    );

    emit(
      "storage.file.restored",
      clone(file)
    );

    return clone(file);
  }

  /* ============================================================
     SEARCH
  ============================================================ */

  function search(
    input = {}
  ) {
    const q =
      String(
        input.query ||
          ""
      )
        .trim()
        .toLowerCase();

    let results =
      Array.from(
        state.files.values()
      );

    if (q) {
      results =
        results.filter(
          file =>
            file.originalName
              .toLowerCase()
              .includes(q) ||

            file.mimeType
              .toLowerCase()
              .includes(q) ||

            file.category
              .toLowerCase()
              .includes(q) ||

            file.objectKey
              .toLowerCase()
              .includes(q)
        );
    }

    if (
      input.category
    ) {
      results =
        results.filter(
          file =>
            file.category ===
            input.category
        );
    }

    if (
      input.folderId
    ) {
      results =
        results.filter(
          file =>
            file.folderId ===
            input.folderId
        );
    }

    if (
      input.status
    ) {
      results =
        results.filter(
          file =>
            file.status ===
            input.status
        );
    }

    const limit =
      Math.min(
        Number(
          input.limit ||
            100
        ),
        500
      );

    return clone(
      results.slice(
        0,
        limit
      )
    );
  }

  /* ============================================================
     PROCESSING PIPELINE
  ============================================================ */

  async function startProcessing(
    fileId
  ) {
    const job =
      await queueProcessing(
        fileId,
        "full-analysis",
        90
      );

    try {
      job.status =
        "running";

      job.startedAt =
        now();

      const result =
        await processFile(
          fileId
        );

      job.status =
        "completed";

      job.result =
        result;

      job.completedAt =
        now();

      await query(
        `
        UPDATE ez_storage_processing_jobs
        SET
          status='completed',
          result=$1,
          started_at=$2,
          completed_at=$3
        WHERE id=$4
        `,
        [
          JSON.stringify(
            result
          ),
          job.startedAt,
          job.completedAt,
          job.id
        ]
      );

      return clone(job);
    } catch (error) {
      job.status =
        "failed";

      job.error =
        error.message;

      job.completedAt =
        now();

      await query(
        `
        UPDATE ez_storage_processing_jobs
        SET
          status='failed',
          error=$1,
          completed_at=$2
        WHERE id=$3
        `,
        [
          job.error,
          job.completedAt,
          job.id
        ]
      );

      throw error;
    }
  }

  /* ============================================================
     STATISTICS
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      provider:
        getProviderStatus(),

      maxFileSize,

      maxFiles,

      multipartThreshold,

      signedUrlMinutes
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Cloud Storage & Media Asset Management",

      code:
        "CODE 84",

      initialized:
        state.initialized,

      running:
        state.running,

      provider:
        getProviderStatus(),

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running =
      true;

    emit(
      "storage.started",
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

    emit(
      "storage.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     PUBLIC API
  ============================================================ */

  return {
    initialize,
    start,
    stop,

    getStatus,
    getStatistics,

    createFolder,
    listFolders,

    createFileRecord,
    getFile,
    listFiles,
    updateFile,

    createUpload,
    completeUpload,

    createSignedUpload,
    createSignedDownload,

    createVersion,
    listVersions,

    findDuplicate,

    queueProcessing,
    processFile,
    startProcessing,

    createShare,

    deleteFile,
    restoreFile,

    search,

    getProviderStatus
  };
}

module.exports = {
  createIntelligentCloudStorageEngine
};
