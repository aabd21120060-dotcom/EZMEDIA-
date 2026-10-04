"use strict";

const crypto = require("crypto");
const { spawn } = require("child_process");

function createIntelligentLiveBroadcastEngine(options = {}) {
  const {
    persistence = null,

    aiCore = null,
    aiOrchestrator = null,

    videoEngine = null,
    damEngine = null,

    storageEngine = null,
    storageAdapter = null,

    publishingEngine = null,
    automationEngine = null,
    workflowEngine = null,

    notificationService = null,
    eventBus = null,

    logger = console,

    ffmpegPath =
      process.env.FFMPEG_PATH ||
      "ffmpeg",

    maxBroadcasts =
      Number(
        process.env.LIVE_MAX_BROADCASTS || 20
      ),

    maxDestinations =
      Number(
        process.env.LIVE_MAX_DESTINATIONS || 50
      ),

    reconnectAttempts =
      Number(
        process.env.LIVE_RECONNECT_ATTEMPTS || 5
      ),

    reconnectDelayMs =
      Number(
        process.env.LIVE_RECONNECT_DELAY_MS || 5000
      ),

    healthIntervalMs =
      Number(
        process.env.LIVE_HEALTH_INTERVAL_MS || 10000
      ),

    recordingEnabled =
      process.env.LIVE_RECORDING_ENABLED !== "false"
  } = options;

  const state = {
    initialized: false,
    running: false,

    broadcasts: new Map(),
    destinations: new Map(),
    inputs: new Map(),
    recordings: new Map(),
    events: new Map(),

    processes: new Map(),
    healthTimers: new Map(),

    statistics: {
      broadcastsCreated: 0,
      broadcastsStarted: 0,
      broadcastsStopped: 0,
      broadcastsFailed: 0,

      destinationsCreated: 0,
      destinationsStarted: 0,
      destinationsFailed: 0,

      reconnects: 0,

      recordingsStarted: 0,
      recordingsCompleted: 0,

      healthChecks: 0,

      bytesProcessed: 0
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
      return JSON.parse(
        JSON.stringify(value)
      );
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

    return persistence.query(
      sql,
      values
    );
  }

  function emit(event, payload = {}) {
    try {
      if (
        eventBus &&
        typeof eventBus.emit === "function"
      ) {
        eventBus.emit(
          event,
          payload
        );
      }
    } catch (error) {
      logger.warn(
        "[CODE87] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_live_broadcasts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'created',
        input_type TEXT,
        input_url TEXT,
        protocol TEXT,
        settings JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ,
        stopped_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_live_destinations (
        id TEXT PRIMARY KEY,
        broadcast_id TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT,
        protocol TEXT,
        endpoint TEXT,
        stream_key_encrypted TEXT,
        status TEXT DEFAULT 'inactive',
        settings JSONB DEFAULT '{}'::jsonb,
        last_error TEXT,
        started_at TIMESTAMPTZ,
        stopped_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_live_inputs (
        id TEXT PRIMARY KEY,
        broadcast_id TEXT NOT NULL,
        name TEXT NOT NULL,
        input_type TEXT NOT NULL,
        endpoint TEXT,
        status TEXT DEFAULT 'inactive',
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_live_recordings (
        id TEXT PRIMARY KEY,
        broadcast_id TEXT NOT NULL,
        status TEXT DEFAULT 'recording',
        object_key TEXT,
        local_path TEXT,
        duration_seconds NUMERIC,
        size_bytes BIGINT DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_live_events (
        id TEXT PRIMARY KEY,
        broadcast_id TEXT,
        destination_id TEXT,
        event_type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_live_broadcast_status
      ON ez_live_broadcasts(status)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_live_dest_broadcast
      ON ez_live_destinations(broadcast_id)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_live_events_broadcast
      ON ez_live_events(broadcast_id)
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
      "live.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     SECURITY
  ============================================================ */

  function validateEndpoint(endpoint) {
    if (!endpoint) {
      throw new Error(
        "Broadcast endpoint is required"
      );
    }

    let url;

    try {
      url = new URL(endpoint);
    } catch {
      throw new Error(
        "Invalid broadcast endpoint"
      );
    }

    const allowed = [
      "rtmp:",
      "rtmps:",
      "srt:",
      "http:",
      "https:"
    ];

    if (
      !allowed.includes(
        url.protocol
      )
    ) {
      throw new Error(
        "Unsupported broadcast protocol"
      );
    }

    return true;
  }

  function redactDestination(
    destination
  ) {
    const copy =
      clone(destination);

    if (copy) {
      delete copy.streamKey;
      delete copy.streamKeyEncrypted;
    }

    return copy;
  }

  /*
   * لا يتم الاحتفاظ بمفتاح البث في استجابات API.
   * في الإنتاج يفضل استخدام Secret Manager / KMS.
   */

  function protectStreamKey(
    streamKey
  ) {
    if (!streamKey) {
      return null;
    }

    const secret =
      process.env.LIVE_STREAM_KEY_SECRET;

    if (!secret) {
      throw new Error(
        "LIVE_STREAM_KEY_SECRET is not configured"
      );
    }

    const iv =
      crypto.randomBytes(12);

    const key =
      crypto
        .createHash("sha256")
        .update(secret)
        .digest();

    const cipher =
      crypto.createCipheriv(
        "aes-256-gcm",
        key,
        iv
      );

    const encrypted =
      Buffer.concat([
        cipher.update(
          String(streamKey),
          "utf8"
        ),
        cipher.final()
      ]);

    const tag =
      cipher.getAuthTag();

    return [
      iv.toString("base64"),
      tag.toString("base64"),
      encrypted.toString("base64")
    ].join(".");
  }

  function unprotectStreamKey(
    value
  ) {
    if (!value) {
      return null;
    }

    const secret =
      process.env.LIVE_STREAM_KEY_SECRET;

    if (!secret) {
      throw new Error(
        "LIVE_STREAM_KEY_SECRET is not configured"
      );
    }

    const [
      ivEncoded,
      tagEncoded,
      encryptedEncoded
    ] = String(value).split(".");

    const iv =
      Buffer.from(
        ivEncoded,
        "base64"
      );

    const tag =
      Buffer.from(
        tagEncoded,
        "base64"
      );

    const encrypted =
      Buffer.from(
        encryptedEncoded,
        "base64"
      );

    const key =
      crypto
        .createHash("sha256")
        .update(secret)
        .digest();

    const decipher =
      crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        iv
      );

    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(
        encrypted
      ),
      decipher.final()
    ]).toString("utf8");
  }

  /* ============================================================
     BROADCAST
  ============================================================ */

  async function createBroadcast(
    input = {}
  ) {
    if (
      state.broadcasts.size >=
      maxBroadcasts
    ) {
      throw new Error(
        "Maximum live broadcasts reached"
      );
    }

    if (!input.name) {
      throw new Error(
        "Broadcast name is required"
      );
    }

    const broadcast = {
      id:
        id("broadcast"),

      name:
        String(input.name)
          .trim()
          .slice(0, 255),

      status:
        "created",

      inputType:
        input.inputType ||
        "rtmp",

      inputUrl:
        input.inputUrl ||
        null,

      protocol:
        input.protocol ||
        "rtmp",

      settings:
        input.settings || {},

      metadata:
        input.metadata || {},

      startedAt:
        null,

      stoppedAt:
        null,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.broadcasts.set(
      broadcast.id,
      broadcast
    );

    state.statistics
      .broadcastsCreated++;

    await query(
      `
      INSERT INTO ez_live_broadcasts
      (
        id,
        name,
        status,
        input_type,
        input_url,
        protocol,
        settings,
        metadata,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10
      )
      `,
      [
        broadcast.id,
        broadcast.name,
        broadcast.status,
        broadcast.inputType,
        broadcast.inputUrl,
        broadcast.protocol,
        JSON.stringify(
          broadcast.settings
        ),
        JSON.stringify(
          broadcast.metadata
        ),
        broadcast.createdAt,
        broadcast.updatedAt
      ]
    );

    emit(
      "live.broadcast.created",
      {
        broadcastId:
          broadcast.id
      }
    );

    return clone(
      broadcast
    );
  }

  async function persistBroadcast(
    broadcast
  ) {
    await query(
      `
      UPDATE ez_live_broadcasts
      SET
        status=$1,
        input_url=$2,
        settings=$3,
        metadata=$4,
        started_at=$5,
        stopped_at=$6,
        updated_at=$7
      WHERE id=$8
      `,
      [
        broadcast.status,
        broadcast.inputUrl,
        JSON.stringify(
          broadcast.settings
        ),
        JSON.stringify(
          broadcast.metadata
        ),
        broadcast.startedAt,
        broadcast.stoppedAt,
        broadcast.updatedAt,
        broadcast.id
      ]
    );
  }

  function getBroadcast(
    broadcastId
  ) {
    const broadcast =
      state.broadcasts.get(
        broadcastId
      );

    return broadcast
      ? clone(broadcast)
      : null;
  }

  /* ============================================================
     INPUTS
  ============================================================ */

  async function createInput(
    input = {}
  ) {
    if (
      !input.broadcastId
    ) {
      throw new Error(
        "broadcastId is required"
      );
    }

    if (
      !state.broadcasts.has(
        input.broadcastId
      )
    ) {
      throw new Error(
        "Broadcast not found"
      );
    }

    const liveInput = {
      id:
        id("live_input"),

      broadcastId:
        input.broadcastId,

      name:
        input.name ||
        "Primary Input",

      inputType:
        input.inputType ||
        "rtmp",

      endpoint:
        input.endpoint ||
        null,

      status:
        "inactive",

      settings:
        input.settings || {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.inputs.set(
      liveInput.id,
      liveInput
    );

    await query(
      `
      INSERT INTO ez_live_inputs
      (
        id,
        broadcast_id,
        name,
        input_type,
        endpoint,
        status,
        settings,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        liveInput.id,
        liveInput.broadcastId,
        liveInput.name,
        liveInput.inputType,
        liveInput.endpoint,
        liveInput.status,
        JSON.stringify(
          liveInput.settings
        ),
        liveInput.createdAt,
        liveInput.updatedAt
      ]
    );

    return clone(
      liveInput
    );
  }

  /* ============================================================
     DESTINATIONS
  ============================================================ */

  async function createDestination(
    input = {}
  ) {
    if (
      state.destinations.size >=
      maxDestinations
    ) {
      throw new Error(
        "Maximum destinations reached"
      );
    }

    if (
      !input.broadcastId
    ) {
      throw new Error(
        "broadcastId is required"
      );
    }

    if (
      !state.broadcasts.has(
        input.broadcastId
      )
    ) {
      throw new Error(
        "Broadcast not found"
      );
    }

    validateEndpoint(
      input.endpoint
    );

    const destination = {
      id:
        id("destination"),

      broadcastId:
        input.broadcastId,

      name:
        input.name ||
        "Destination",

      provider:
        input.provider ||
        "custom",

      protocol:
        input.protocol ||
        "rtmp",

      endpoint:
        input.endpoint,

      streamKeyEncrypted:
        input.streamKey
          ? protectStreamKey(
              input.streamKey
            )
          : null,

      status:
        "inactive",

      settings:
        input.settings || {},

      lastError:
        null,

      startedAt:
        null,

      stoppedAt:
        null,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.destinations.set(
      destination.id,
      destination
    );

    state.statistics
      .destinationsCreated++;

    await query(
      `
      INSERT INTO ez_live_destinations
      (
        id,
        broadcast_id,
        name,
        provider,
        protocol,
        endpoint,
        stream_key_encrypted,
        status,
        settings,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11
      )
      `,
      [
        destination.id,
        destination.broadcastId,
        destination.name,
        destination.provider,
        destination.protocol,
        destination.endpoint,
        destination.streamKeyEncrypted,
        destination.status,
        JSON.stringify(
          destination.settings
        ),
        destination.createdAt,
        destination.updatedAt
      ]
    );

    emit(
      "live.destination.created",
      {
        broadcastId:
          destination.broadcastId,

        destinationId:
          destination.id
      }
    );

    return redactDestination(
      destination
    );
  }

  async function getDestinations(
    broadcastId
  ) {
    return Array.from(
      state.destinations.values()
    )
      .filter(
        destination =>
          !broadcastId ||
          destination.broadcastId ===
            broadcastId
      )
      .map(
        redactDestination
      );
  }

  /* ============================================================
     FFMPEG COMMAND
  ============================================================ */

  function buildFFmpegArgs(
    broadcast,
    destinations,
    recordingPath
  ) {
    if (
      !broadcast.inputUrl
    ) {
      throw new Error(
        "Broadcast input URL is required"
      );
    }

    const args = [
      "-hide_banner",

      "-loglevel",
      "warning",

      "-i",
      broadcast.inputUrl
    ];

    /*
     * نسخة البث القياسية.
     * يمكن تعديلها لاحقًا حسب قدرات المصدر
     * ومواصفات كل مزود.
     */

    args.push(
      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-tune",
      "zerolatency",

      "-pix_fmt",
      "yuv420p",

      "-g",
      "60",

      "-keyint_min",
      "60",

      "-c:a",
      "aac",

      "-b:a",
      "128k"
    );

    if (
      destinations.length === 0 &&
      !recordingPath
    ) {
      throw new Error(
        "No broadcast destination or recording configured"
      );
    }

    /*
     * FFmpeg tee muxer يسمح بإرسال
     * نفس المعالجة إلى أكثر من وجهة.
     */

    const outputs = [];

    for (
      const destination
      of destinations
    ) {
      const streamKey =
        destination
          .streamKeyEncrypted
          ? unprotectStreamKey(
              destination
                .streamKeyEncrypted
            )
          : null;

      if (!streamKey) {
        throw new Error(
          `Destination ${destination.name} has no stream key`
        );
      }

      const separator =
        destination.endpoint.includes("?")
          ? "&"
          : "/";

      const url =
        `${destination.endpoint}` +
        `${separator}` +
        `${encodeURIComponent(
          streamKey
        )}`;

      outputs.push(
        `[f=flv:onfail=ignore]${url}`
      );
    }

    if (recordingPath) {
      outputs.push(
        `[f=mp4]${recordingPath}`
      );
    }

    args.push(
      "-f",
      "tee",
      outputs.join("|")
    );

    return args;
  }

  /* ============================================================
     RECORDING
  ============================================================ */

  async function createRecording(
    broadcastId,
    input = {}
  ) {
    const recording = {
      id:
        id("recording"),

      broadcastId,

      status:
        "recording",

      objectKey:
        input.objectKey ||
        null,

      localPath:
        input.localPath ||
        null,

      durationSeconds:
        null,

      sizeBytes:
        0,

      metadata:
        input.metadata || {},

      startedAt:
        now(),

      completedAt:
        null,

      createdAt:
        now()
    };

    state.recordings.set(
      recording.id,
      recording
    );

    state.statistics
      .recordingsStarted++;

    await query(
      `
      INSERT INTO ez_live_recordings
      (
        id,
        broadcast_id,
        status,
        object_key,
        local_path,
        metadata,
        started_at,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        recording.id,
        recording.broadcastId,
        recording.status,
        recording.objectKey,
        recording.localPath,
        JSON.stringify(
          recording.metadata
        ),
        recording.startedAt,
        recording.createdAt
      ]
    );

    return clone(
      recording
    );
  }

  async function completeRecording(
    recordingId
  ) {
    const recording =
      state.recordings.get(
        recordingId
      );

    if (!recording) {
      return null;
    }

    recording.status =
      "completed";

    recording.completedAt =
      now();

    if (
      recording.localPath
    ) {
      try {
        const fs =
          require("fs");

        recording.sizeBytes =
          fs.statSync(
            recording.localPath
          ).size;
      } catch {}
    }

    state.statistics
      .recordingsCompleted++;

    await query(
      `
      UPDATE ez_live_recordings
      SET
        status=$1,
        size_bytes=$2,
        completed_at=$3
      WHERE id=$4
      `,
      [
        recording.status,
        recording.sizeBytes,
        recording.completedAt,
        recording.id
      ]
    );

    return clone(
      recording
    );
  }

  /* ============================================================
     START BROADCAST
  ============================================================ */

  async function startBroadcast(
    broadcastId
  ) {
    const broadcast =
      state.broadcasts.get(
        broadcastId
      );

    if (!broadcast) {
      throw new Error(
        "Broadcast not found"
      );
    }

    if (
      broadcast.status ===
      "live"
    ) {
      return getBroadcast(
        broadcastId
      );
    }

    const destinations =
      Array.from(
        state.destinations.values()
      ).filter(
        destination =>
          destination.broadcastId ===
            broadcastId &&
          destination.status !==
            "disabled"
      );

    if (
      destinations.length === 0 &&
      !recordingEnabled
    ) {
      throw new Error(
        "No active destination configured"
      );
    }

    if (
      destinations.length > 0
    ) {
      for (
        const destination
        of destinations
      ) {
        validateEndpoint(
          destination.endpoint
        );

        if (
          !destination
            .streamKeyEncrypted
        ) {
          throw new Error(
            `Missing stream key for ${destination.name}`
          );
        }
      }
    }

    const recording =
      recordingEnabled
        ? await createRecording(
            broadcastId,
            {
              localPath:
                broadcast
                  .settings
                  .recordingPath ||
                null
            }
          )
        : null;

    let recordingPath =
      recording?.localPath ||
      null;

    if (
      recordingEnabled &&
      !recordingPath
    ) {
      recordingPath =
        `/tmp/ez-media-live-${broadcastId}-${Date.now()}.mp4`;

      if (recording) {
        recording.localPath =
          recordingPath;
      }
    }

    let args;

    try {
      args =
        buildFFmpegArgs(
          broadcast,
          destinations,
          recordingPath
        );
    } catch (error) {
      if (recording) {
        await completeRecording(
          recording.id
        );
      }

      throw error;
    }

    const process =
      spawn(
        ffmpegPath,
        args,
        {
          env: {
            ...process.env
          }
        }
      );

    const processId =
      id("ffmpeg");

    state.processes.set(
      processId,
      {
        process,
        broadcastId,
        startedAt:
          now(),
        restartCount: 0
      }
    );

    broadcast.status =
      "live";

    broadcast.startedAt =
      now();

    broadcast.stoppedAt =
      null;

    broadcast.updatedAt =
      now();

    state.statistics
      .broadcastsStarted++;

    await persistBroadcast(
      broadcast
    );

    for (
      const destination
      of destinations
    ) {
      destination.status =
        "live";

      destination.startedAt =
        now();

      destination.updatedAt =
        now();

      state.statistics
        .destinationsStarted++;

      await persistDestination(
        destination
      );
    }

    process.stderr.on(
      "data",
      data => {
        const message =
          data.toString();

        emit(
          "live.ffmpeg.log",
          {
            broadcastId,
            message:
              message.slice(
                0,
                2000
              )
          }
        );
      }
    );

    process.on(
      "error",
      async error => {
        await handleBroadcastProcessError(
          broadcastId,
          processId,
          error
        );
      }
    );

    process.on(
      "close",
      async code => {
        await handleBroadcastProcessExit(
          broadcastId,
          processId,
          code
        );
      }
    );

    emit(
      "live.broadcast.started",
      {
        broadcastId,

        destinations:
          destinations.map(
            destination =>
              destination.id
          ),

        recording:
          Boolean(recording)
      }
    );

    return {
      broadcast:
        getBroadcast(
          broadcastId
        ),

      destinations:
        await getDestinations(
          broadcastId
        ),

      processId
    };
  }

  /* ============================================================
     DESTINATION PERSISTENCE
  ============================================================ */

  async function persistDestination(
    destination
  ) {
    await query(
      `
      UPDATE ez_live_destinations
      SET
        status=$1,
        last_error=$2,
        started_at=$3,
        stopped_at=$4,
        updated_at=$5
      WHERE id=$6
      `,
      [
        destination.status,
        destination.lastError,
        destination.startedAt,
        destination.stoppedAt,
        destination.updatedAt,
        destination.id
      ]
    );
  }

  /* ============================================================
     PROCESS ERROR
  ============================================================ */

  async function handleBroadcastProcessError(
    broadcastId,
    processId,
    error
  ) {
    const broadcast =
      state.broadcasts.get(
        broadcastId
      );

    if (!broadcast) {
      return;
    }

    state.statistics
      .broadcastsFailed++;

    await recordEvent(
      broadcastId,
      null,
      "process_error",
      "critical",
      error.message
    );

    emit(
      "live.broadcast.error",
      {
        broadcastId,
        error:
          error.message
      }
    );
  }

  /* ============================================================
     PROCESS EXIT / RECONNECT
  ============================================================ */

  async function handleBroadcastProcessExit(
    broadcastId,
    processId,
    code
  ) {
    const processInfo =
      state.processes.get(
        processId
      );

    if (!processInfo) {
      return;
    }

    state.processes.delete(
      processId
    );

    const broadcast =
      state.broadcasts.get(
        broadcastId
      );

    if (!broadcast) {
      return;
    }

    if (
      broadcast.status !==
      "live"
    ) {
      return;
    }

    await recordEvent(
      broadcastId,
      null,
      "process_exit",
      code === 0
        ? "info"
        : "warning",
      `FFmpeg exited with code ${code}`
    );

    /*
     * إعادة الاتصال التلقائية.
     */

    const currentRestartCount =
      processInfo.restartCount || 0;

    if (
      currentRestartCount <
      reconnectAttempts
    ) {
      state.statistics
        .reconnects++;

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            reconnectDelayMs
          )
      );

      try {
        await restartBroadcast(
          broadcastId,
          currentRestartCount + 1
        );
      } catch (error) {
        await stopBroadcast(
          broadcastId,
          {
            reason:
              error.message
          }
        );
      }

      return;
    }

    await stopBroadcast(
      broadcastId,
      {
        reason:
          "Maximum reconnect attempts reached"
      }
    );
  }

  async function restartBroadcast(
    broadcastId,
    restartCount
  ) {
    const broadcast =
      state.broadcasts.get(
        broadcastId
      );

    if (!broadcast) {
      return;
    }

    broadcast.metadata = {
      ...broadcast.metadata,

      lastRestart:
        now(),

      restartCount
    };

    /*
     * إعادة تشغيل البث بدون تغيير
     * الحالة العامة للمستخدم.
     */

    await startBroadcast(
      broadcastId
    );
  }

  /* ============================================================
     STOP BROADCAST
  ============================================================ */

  async function stopBroadcast(
    broadcastId,
    options = {}
  ) {
    const broadcast =
      state.broadcasts.get(
        broadcastId
      );

    if (!broadcast) {
      throw new Error(
        "Broadcast not found"
      );
    }

    for (
      const [
        processId,
        processInfo
      ]
      of state.processes.entries()
    ) {
      if (
        processInfo.broadcastId ===
        broadcastId
      ) {
        try {
          processInfo.process.kill(
            "SIGTERM"
          );
        } catch {}
        
        state.processes.delete(
          processId
        );
      }
    }

    broadcast.status =
      "offline";

    broadcast.stoppedAt =
      now();

    broadcast.updatedAt =
      now();

    broadcast.metadata = {
      ...broadcast.metadata,

      stopReason:
        options.reason ||
        "manual"
    };

    await persistBroadcast(
      broadcast
    );

    for (
      const destination
      of state.destinations.values()
    ) {
      if (
        destination.broadcastId ===
        broadcastId
      ) {
        destination.status =
          "inactive";

        destination.stoppedAt =
          now();

        destination.updatedAt =
          now();

        await persistDestination(
          destination
        );
      }
    }

    state.statistics
      .broadcastsStopped++;

    emit(
      "live.broadcast.stopped",
      {
        broadcastId,
        reason:
          options.reason ||
          "manual"
      }
    );

    return getBroadcast(
      broadcastId
    );
  }

  /* ============================================================
     HEALTH MONITOR
  ============================================================ */

  function startHealthMonitor(
    broadcastId
  ) {
    stopHealthMonitor(
      broadcastId
    );

    const timer =
      setInterval(
        async () => {
          try {
            await checkBroadcastHealth(
              broadcastId
            );
          } catch (error) {
            logger.warn(
              "[CODE87] Health:",
              error.message
            );
          }
        },
        healthIntervalMs
      );

    state.healthTimers.set(
      broadcastId,
      timer
    );
  }

  function stopHealthMonitor(
    broadcastId
  ) {
    const timer =
      state.healthTimers.get(
        broadcastId
      );

    if (timer) {
      clearInterval(
        timer
      );

      state.healthTimers.delete(
        broadcastId
      );
    }
  }

  async function checkBroadcastHealth(
    broadcastId
  ) {
    const broadcast =
      state.broadcasts.get(
        broadcastId
      );

    if (!broadcast) {
      return null;
    }

    state.statistics
      .healthChecks++;

    const destinations =
      Array.from(
        state.destinations.values()
      ).filter(
        destination =>
          destination.broadcastId ===
          broadcastId
      );

    const liveDestinations =
      destinations.filter(
        destination =>
          destination.status ===
          "live"
      ).length;

    const health = {
      broadcastId,

      status:
        broadcast.status,

      totalDestinations:
        destinations.length,

      liveDestinations,

      healthy:
        broadcast.status ===
          "live" &&
        (
          destinations.length ===
            0 ||
          liveDestinations > 0
        ),

      checkedAt:
        now()
    };

    emit(
      "live.health.checked",
      health
    );

    if (
      !health.healthy
    ) {
      await recordEvent(
        broadcastId,
        null,
        "health_degraded",
        "warning",
        "Broadcast health is degraded",
        health
      );
    }

    return health;
  }

  /* ============================================================
     EVENTS
  ============================================================ */

  async function recordEvent(
    broadcastId,
    destinationId,
    eventType,
    severity,
    message,
    metadata = {}
  ) {
    const event = {
      id:
        id("live_event"),

      broadcastId:
        broadcastId || null,

      destinationId:
        destinationId || null,

      eventType,

      severity:
        severity || "info",

      message:
        message || "",

      metadata,

      createdAt:
        now()
    };

    state.events.set(
      event.id,
      event
    );

    await query(
      `
      INSERT INTO ez_live_events
      (
        id,
        broadcast_id,
        destination_id,
        event_type,
        severity,
        message,
        metadata,
        created_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      `,
      [
        event.id,
        event.broadcastId,
        event.destinationId,
        event.eventType,
        event.severity,
        event.message,
        JSON.stringify(
          event.metadata
        ),
        event.createdAt
      ]
    );

    emit(
      "live.event",
      clone(event)
    );

    return event;
  }

  async function getEvents(
    broadcastId,
    limit = 100
  ) {
    const events =
      Array.from(
        state.events.values()
      )
      .filter(
        event =>
          !broadcastId ||
          event.broadcastId ===
            broadcastId
      )
      .sort(
        (a, b) =>
          String(b.createdAt)
            .localeCompare(
              String(a.createdAt)
            )
      );

    return clone(
      events.slice(
        0,
        Math.min(
          Number(limit) || 100,
          500
        )
      )
    );
  }

  /* ============================================================
     VOD HANDOFF
  ============================================================ */

  async function finalizeRecording(
    recordingId
  ) {
    const recording =
      await completeRecording(
        recordingId
      );

    if (!recording) {
      throw new Error(
        "Recording not found"
      );
    }

    /*
     * إذا كان DAM متاحًا يمكن تحويل
     * التسجيل إلى Asset.
     */

    let asset = null;

    if (
      damEngine &&
      typeof damEngine.createAsset ===
        "function" &&
      recording.localPath
    ) {
      asset =
        await damEngine.createAsset({
          storageFileId:
            recording.objectKey ||
            recording.localPath,

          title:
            `Live Broadcast ${recording.broadcastId}`,

          assetType:
            "video",

          mimeType:
            "video/mp4",

          objectKey:
            recording.objectKey,

          metadata: {
            source:
              "live-broadcast",

            broadcastId:
              recording.broadcastId,

            recordingId
          }
        });
    }

    emit(
      "live.recording.finalized",
      {
        recordingId,
        asset
      }
    );

    return {
      recording,
      asset
    };
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      activeBroadcasts:
        Array.from(
          state.broadcasts.values()
        ).filter(
          broadcast =>
            broadcast.status ===
            "live"
        ).length,

      activeDestinations:
        Array.from(
          state.destinations.values()
        ).filter(
          destination =>
            destination.status ===
            "live"
        ).length
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Live Broadcast & Multi-Platform Distribution Engine",

      code:
        "CODE 87",

      initialized:
        state.initialized,

      running:
        state.running,

      ffmpeg:
        ffmpegPath,

      components: {
        videoEngine:
          Boolean(videoEngine),

        damEngine:
          Boolean(damEngine),

        storageEngine:
          Boolean(storageEngine),

        storageAdapter:
          Boolean(storageAdapter),

        publishingEngine:
          Boolean(publishingEngine),

        automationEngine:
          Boolean(automationEngine),

        workflowEngine:
          Boolean(workflowEngine)
      },

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running =
      true;

    emit(
      "live.engine.started",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  async function stop() {
    state.running =
      false;

    for (
      const broadcast
      of state.broadcasts.values()
    ) {
      if (
        broadcast.status ===
        "live"
      ) {
        try {
          await stopBroadcast(
            broadcast.id,
            {
              reason:
                "engine_stop"
            }
          );
        } catch {}
      }
    }

    for (
      const timer
      of state.healthTimers.values()
    ) {
      clearInterval(
        timer
      );
    }

    state.healthTimers.clear();

    emit(
      "live.engine.stopped",
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

    getStatus,
    getStatistics,

    createBroadcast,
    getBroadcast,

    createInput,

    createDestination,
    getDestinations,

    createRecording,
    completeRecording,
    finalizeRecording,

    startBroadcast,
    stopBroadcast,

    checkBroadcastHealth,

    getEvents
  };
}

module.exports = {
  createIntelligentLiveBroadcastEngine
};
