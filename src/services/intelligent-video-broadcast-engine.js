"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

function createIntelligentVideoBroadcastEngine(options = {}) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    damEngine = null,
    storageEngine = null,
    storageAdapter = null,

    mediaForensicsEngine = null,
    mediaIntelligenceEngine = null,

    publishingEngine = null,
    automationEngine = null,
    workflowEngine = null,
    notificationService = null,
    eventBus = null,

    logger = console,

    workDirectory =
      process.env.VIDEO_WORK_DIRECTORY ||
      "/tmp/ez-media-video",

    ffmpegPath =
      process.env.FFMPEG_PATH ||
      "ffmpeg",

    ffprobePath =
      process.env.FFPROBE_PATH ||
      "ffprobe",

    maxJobs =
      Number(
        process.env.VIDEO_MAX_JOBS || 4
      ),

    maxFileSize =
      Number(
        process.env.VIDEO_MAX_FILE_SIZE ||
        5368709120
      ),

    maxDurationSeconds =
      Number(
        process.env.VIDEO_MAX_DURATION_SECONDS ||
        21600
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    jobs: new Map(),
    streams: new Map(),
    channels: new Map(),
    outputs: new Map(),

    queue: [],
    workers: 0,

    statistics: {
      jobsCreated: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      videosProcessed: 0,
      thumbnailsGenerated: 0,
      hlsGenerated: 0,
      clipsGenerated: 0,
      broadcastsStarted: 0,
      broadcastsStopped: 0,
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
        "[CODE86] Event error:",
        error.message
      );
    }
  }

  /* ============================================================
     DATABASE
  ============================================================ */

  async function ensureTables() {
    await query(`
      CREATE TABLE IF NOT EXISTS ez_video_jobs (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        job_type TEXT NOT NULL,
        status TEXT DEFAULT 'queued',
        progress NUMERIC DEFAULT 0,
        input_path TEXT,
        output_path TEXT,
        options JSONB DEFAULT '{}'::jsonb,
        result JSONB DEFAULT '{}'::jsonb,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_video_outputs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        asset_id TEXT,
        output_type TEXT NOT NULL,
        format TEXT,
        resolution TEXT,
        bitrate INTEGER,
        object_key TEXT,
        local_path TEXT,
        size_bytes BIGINT DEFAULT 0,
        duration_seconds NUMERIC,
        status TEXT DEFAULT 'ready',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_video_streams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        input_type TEXT,
        input_url TEXT,
        output_url TEXT,
        protocol TEXT,
        settings JSONB DEFAULT '{}'::jsonb,
        statistics JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_video_channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        channel_type TEXT DEFAULT 'web',
        protocol TEXT,
        endpoint TEXT,
        status TEXT DEFAULT 'inactive',
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_video_clips (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        source_job_id TEXT,
        start_seconds NUMERIC NOT NULL,
        end_seconds NUMERIC NOT NULL,
        output_path TEXT,
        object_key TEXT,
        status TEXT DEFAULT 'queued',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ez_video_subtitles (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        language TEXT NOT NULL,
        format TEXT DEFAULT 'vtt',
        object_key TEXT,
        local_path TEXT,
        transcript TEXT,
        status TEXT DEFAULT 'generated',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  /* ============================================================
     INITIALIZATION
  ============================================================ */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    fs.mkdirSync(
      workDirectory,
      {
        recursive: true
      }
    );

    await ensureTables();

    state.initialized = true;

    emit(
      "video.broadcast.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ============================================================
     FFPROBE
  ============================================================ */

  function runProcess(
    command,
    args = {},
    options = {}
  ) {
    return new Promise(
      (resolve, reject) => {
        const child =
          spawn(
            command,
            args,
            {
              cwd:
                options.cwd ||
                workDirectory,

              env: {
                ...process.env,
                ...(options.env || {})
              }
            }
          );

        let stdout = "";
        let stderr = "";

        child.stdout.on(
          "data",
          data => {
            stdout +=
              data.toString();
          }
        );

        child.stderr.on(
          "data",
          data => {
            stderr +=
              data.toString();
          }
        );

        child.on(
          "error",
          reject
        );

        child.on(
          "close",
          code => {
            if (code === 0) {
              resolve({
                code,
                stdout,
                stderr
              });
            } else {
              const error =
                new Error(
                  `Process exited with code ${code}: ${stderr}`
                );

              error.code =
                code;

              reject(error);
            }
          }
        );
      }
    );
  }

  async function probe(
    inputPath
  ) {
    const result =
      await runProcess(
        ffprobePath,
        [
          "-v",
          "quiet",

          "-print_format",
          "json",

          "-show_format",

          "-show_streams",

          inputPath
        ]
      );

    let data;

    try {
      data =
        JSON.parse(
          result.stdout
        );
    } catch {
      throw new Error(
        "Invalid ffprobe response"
      );
    }

    const format =
      data.format || {};

    const streams =
      Array.isArray(
        data.streams
      )
        ? data.streams
        : [];

    const video =
      streams.find(
        stream =>
          stream.codec_type ===
          "video"
      );

    const audio =
      streams.find(
        stream =>
          stream.codec_type ===
          "audio"
      );

    const duration =
      Number(
        format.duration ||
        video?.duration ||
        audio?.duration ||
        0
      );

    if (
      duration >
      maxDurationSeconds
    ) {
      throw new Error(
        `Video duration exceeds ${maxDurationSeconds} seconds`
      );
    }

    let size =
      Number(
        format.size || 0
      );

    if (!size) {
      try {
        size =
          fs.statSync(
            inputPath
          ).size;
      } catch {}
    }

    if (
      size >
      maxFileSize
    ) {
      throw new Error(
        "Video file exceeds maximum allowed size"
      );
    }

    return {
      format,
      streams,
      duration,
      size,

      video: video
        ? {
            codec:
              video.codec_name,

            width:
              Number(
                video.width || 0
              ),

            height:
              Number(
                video.height || 0
              ),

            fps:
              parseFrameRate(
                video.r_frame_rate
              )
          }
        : null,

      audio: audio
        ? {
            codec:
              audio.codec_name,

            sampleRate:
              Number(
                audio.sample_rate || 0
              ),

            channels:
              Number(
                audio.channels || 0
              )
          }
        : null
    };
  }

  function parseFrameRate(value) {
    if (!value) {
      return 0;
    }

    const parts =
      String(value).split(
        "/"
      );

    if (
      parts.length === 2
    ) {
      const a =
        Number(parts[0]);

      const b =
        Number(parts[1]);

      if (b) {
        return a / b;
      }
    }

    return Number(value) || 0;
  }

  /* ============================================================
     JOBS
  ============================================================ */

  async function createJob(
    input = {}
  ) {
    const job = {
      id: id("video_job"),

      assetId:
        input.assetId || null,

      jobType:
        input.jobType ||
        "probe",

      status:
        "queued",

      progress: 0,

      inputPath:
        input.inputPath ||
        null,

      outputPath:
        input.outputPath ||
        null,

      options:
        input.options || {},

      result: {},

      error: null,

      createdAt:
        now(),

      startedAt: null,

      completedAt: null
    };

    state.jobs.set(
      job.id,
      job
    );

    state.queue.push(
      job.id
    );

    state.statistics.jobsCreated++;

    await persistJob(job);

    return clone(job);
  }

  async function persistJob(job) {
    await query(
      `
      INSERT INTO ez_video_jobs
      (
        id,
        asset_id,
        job_type,
        status,
        progress,
        input_path,
        output_path,
        options,
        result,
        error,
        created_at,
        started_at,
        completed_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13
      )
      ON CONFLICT(id)
      DO UPDATE SET
        status=EXCLUDED.status,
        progress=EXCLUDED.progress,
        output_path=EXCLUDED.output_path,
        result=EXCLUDED.result,
        error=EXCLUDED.error,
        started_at=EXCLUDED.started_at,
        completed_at=EXCLUDED.completed_at
      `,
      [
        job.id,
        job.assetId,
        job.jobType,
        job.status,
        job.progress,
        job.inputPath,
        job.outputPath,
        JSON.stringify(
          job.options
        ),
        JSON.stringify(
          job.result
        ),
        job.error,
        job.createdAt,
        job.startedAt,
        job.completedAt
      ]
    );
  }

  /* ============================================================
     THUMBNAIL
  ============================================================ */

  async function generateThumbnail(
    input = {}
  ) {
    if (!input.inputPath) {
      throw new Error(
        "inputPath is required"
      );
    }

    const outputPath =
      input.outputPath ||
      path.join(
        workDirectory,
        `${id("thumb")}.jpg`
      );

    const timestamp =
      input.timestamp ||
      "00:00:03";

    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-ss",
        String(timestamp),

        "-i",
        input.inputPath,

        "-frames:v",
        "1",

        "-vf",
        "scale='min(1280,iw)':-2",

        "-q:v",
        "2",

        outputPath
      ]
    );

    state.statistics
      .thumbnailsGenerated++;

    return {
      outputPath,
      type: "thumbnail"
    };
  }

  /* ============================================================
     PREVIEW
  ============================================================ */

  async function generatePreview(
    input = {}
  ) {
    if (!input.inputPath) {
      throw new Error(
        "inputPath is required"
      );
    }

    const outputPath =
      input.outputPath ||
      path.join(
        workDirectory,
        `${id("preview")}.mp4`
      );

    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-i",
        input.inputPath,

        "-t",
        String(
          input.duration ||
          30
        ),

        "-vf",
        "scale='min(1280,iw)':-2",

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "28",

        "-c:a",
        "aac",

        "-b:a",
        "96k",

        outputPath
      ]
    );

    return {
      outputPath,
      type: "preview"
    };
  }

  /* ============================================================
     MULTI QUALITY
  ============================================================ */

  async function generateQuality(
    input = {}
  ) {
    if (!input.inputPath) {
      throw new Error(
        "inputPath is required"
      );
    }

    const quality =
      input.quality ||
      "720p";

    const profiles = {
      "360p": {
        height: 360,
        bitrate: "800k"
      },

      "480p": {
        height: 480,
        bitrate: "1400k"
      },

      "720p": {
        height: 720,
        bitrate: "2800k"
      },

      "1080p": {
        height: 1080,
        bitrate: "5000k"
      },

      "1440p": {
        height: 1440,
        bitrate: "9000k"
      },

      "2160p": {
        height: 2160,
        bitrate: "16000k"
      }
    };

    const profile =
      profiles[quality];

    if (!profile) {
      throw new Error(
        "Unsupported video quality"
      );
    }

    const outputPath =
      input.outputPath ||
      path.join(
        workDirectory,
        `${id("quality")}_${quality}.mp4`
      );

    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-i",
        input.inputPath,

        "-vf",
        `scale=-2:${profile.height}`,

        "-c:v",
        "libx264",

        "-preset",
        "medium",

        "-b:v",
        profile.bitrate,

        "-maxrate",
        profile.bitrate,

        "-bufsize",
        "2M",

        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-movflags",
        "+faststart",

        outputPath
      ]
    );

    state.statistics
      .videosProcessed++;

    return {
      outputPath,
      quality,
      height:
        profile.height,
      bitrate:
        profile.bitrate
    };
  }

  /* ============================================================
     HLS
  ============================================================ */

  async function generateHLS(
    input = {}
  ) {
    if (!input.inputPath) {
      throw new Error(
        "inputPath is required"
      );
    }

    const outputDirectory =
      input.outputDirectory ||
      path.join(
        workDirectory,
        id("hls")
      );

    fs.mkdirSync(
      outputDirectory,
      {
        recursive: true
      }
    );

    const playlist =
      path.join(
        outputDirectory,
        "master.m3u8"
      );

    const segmentPattern =
      path.join(
        outputDirectory,
        "segment_%05d.ts"
      );

    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-i",
        input.inputPath,

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-g",
        "48",

        "-keyint_min",
        "48",

        "-sc_threshold",
        "0",

        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-f",
        "hls",

        "-hls_time",
        "6",

        "-hls_playlist_type",
        "vod",

        "-hls_segment_filename",
        segmentPattern,

        playlist
      ]
    );

    state.statistics
      .hlsGenerated++;

    return {
      playlist,
      directory:
        outputDirectory,

      type: "hls"
    };
  }

  /* ============================================================
     CLIP
  ============================================================ */

  async function createClip(
    input = {}
  ) {
    if (!input.inputPath) {
      throw new Error(
        "inputPath is required"
      );
    }

    const start =
      Number(
        input.startSeconds || 0
      );

    const end =
      Number(
        input.endSeconds
      );

    if (
      !Number.isFinite(end) ||
      end <= start
    ) {
      throw new Error(
        "Invalid clip time range"
      );
    }

    const outputPath =
      input.outputPath ||
      path.join(
        workDirectory,
        `${id("clip")}.mp4`
      );

    await runProcess(
      ffmpegPath,
      [
        "-y",

        "-ss",
        String(start),

        "-i",
        input.inputPath,

        "-t",
        String(end - start),

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-c:a",
        "aac",

        "-movflags",
        "+faststart",

        outputPath
      ]
    );

    state.statistics
      .clipsGenerated++;

    return {
      outputPath,
      startSeconds:
        start,
      endSeconds:
        end
    };
  }

  /* ============================================================
     AI VIDEO ANALYSIS
  ============================================================ */

  async function analyzeVideo(
    input = {}
  ) {
    const result = {
      probe: null,
      forensics: null,
      intelligence: null,
      ai: null
    };

    if (input.inputPath) {
      result.probe =
        await probe(
          input.inputPath
        );
    }

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
                input.mediaHash ||
                null,

              mimeType:
                input.mimeType ||
                "video/*",

              size:
                result.probe?.size ||
                0,

              objectKey:
                input.objectKey ||
                null
            }
          );
      } catch (error) {
        result.forensics = {
          status:
            "unavailable",
          error:
            error.message
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
                input.mediaHash ||
                null,

              mimeType:
                input.mimeType ||
                "video/*",

              objectKey:
                input.objectKey ||
                null,

              fileName:
                input.fileName ||
                null
            }
          );
      } catch (error) {
        result.intelligence = {
          status:
            "unavailable",
          error:
            error.message
        };
      }
    }

    if (
      aiOrchestrator &&
      typeof aiOrchestrator.process ===
        "function"
    ) {
      try {
        result.ai =
          await aiOrchestrator.process(
            {
              operation:
                "analyze-media",

              input: {
                media:
                  input,

                probe:
                  result.probe,

                forensics:
                  result.forensics,

                intelligence:
                  result.intelligence
              }
            }
          );
      } catch (error) {
        result.ai = {
          status:
            "unavailable",
          error:
            error.message
        };
      }
    } else if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        result.ai =
          await aiCore.request({
            operation:
              "video-analysis",

            input: {
              media:
                input,

              probe:
                result.probe,

              forensics:
                result.forensics,

              intelligence:
                result.intelligence
            }
          });
      } catch (error) {
        result.ai = {
          status:
            "unavailable",
          error:
            error.message
        };
      }
    }

    return result;
  }

  /* ============================================================
     BROADCAST CHANNELS
  ============================================================ */

  async function createChannel(
    input = {}
  ) {
    if (!input.name) {
      throw new Error(
        "Channel name is required"
      );
    }

    const channel = {
      id:
        id("channel"),

      name:
        input.name,

      channelType:
        input.channelType ||
        "web",

      protocol:
        input.protocol ||
        "hls",

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

    state.channels.set(
      channel.id,
      channel
    );

    await query(
      `
      INSERT INTO ez_video_channels
      (
        id,
        name,
        channel_type,
        protocol,
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
        channel.id,
        channel.name,
        channel.channelType,
        channel.protocol,
        channel.endpoint,
        channel.status,
        JSON.stringify(
          channel.settings
        ),
        channel.createdAt,
        channel.updatedAt
      ]
    );

    return clone(channel);
  }

  /* ============================================================
     LIVE STREAM
  ============================================================ */

  async function createStream(
    input = {}
  ) {
    const stream = {
      id:
        id("stream"),

      name:
        input.name ||
        "EZ MEDIA Live",

      status:
        "offline",

      inputType:
        input.inputType ||
        "rtmp",

      inputUrl:
        input.inputUrl ||
        null,

      outputUrl:
        input.outputUrl ||
        null,

      protocol:
        input.protocol ||
        "rtmp",

      settings:
        input.settings || {},

      statistics: {
        startedAt:
          null,

        stoppedAt:
          null
      },

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.streams.set(
      stream.id,
      stream
    );

    await query(
      `
      INSERT INTO ez_video_streams
      (
        id,
        name,
        status,
        input_type,
        input_url,
        output_url,
        protocol,
        settings,
        statistics,
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
        stream.id,
        stream.name,
        stream.status,
        stream.inputType,
        stream.inputUrl,
        stream.outputUrl,
        stream.protocol,
        JSON.stringify(
          stream.settings
        ),
        JSON.stringify(
          stream.statistics
        ),
        stream.createdAt,
        stream.updatedAt
      ]
    );

    return clone(stream);
  }

  async function startStream(
    streamId
  ) {
    const stream =
      state.streams.get(
        streamId
      );

    if (!stream) {
      throw new Error(
        "Stream not found"
      );
    }

    if (
      stream.status ===
      "live"
    ) {
      return clone(stream);
    }

    if (
      !stream.inputUrl
    ) {
      throw new Error(
        "Stream input URL is required"
      );
    }

    stream.status =
      "live";

    stream.statistics
      .startedAt =
      now();

    stream.updatedAt =
      now();

    state.statistics
      .broadcastsStarted++;

    await persistStream(
      stream
    );

    emit(
      "broadcast.started",
      {
        stream:
          clone(stream)
      }
    );

    return clone(stream);
  }

  async function stopStream(
    streamId
  ) {
    const stream =
      state.streams.get(
        streamId
      );

    if (!stream) {
      throw new Error(
        "Stream not found"
      );
    }

    stream.status =
      "offline";

    stream.statistics
      .stoppedAt =
      now();

    stream.updatedAt =
      now();

    state.statistics
      .broadcastsStopped++;

    await persistStream(
      stream
    );

    emit(
      "broadcast.stopped",
      {
        stream:
          clone(stream)
      }
    );

    return clone(stream);
  }

  async function persistStream(
    stream
  ) {
    await query(
      `
      UPDATE ez_video_streams
      SET
        status=$1,
        input_url=$2,
        output_url=$3,
        settings=$4,
        statistics=$5,
        updated_at=$6
      WHERE id=$7
      `,
      [
        stream.status,
        stream.inputUrl,
        stream.outputUrl,
        JSON.stringify(
          stream.settings
        ),
        JSON.stringify(
          stream.statistics
        ),
        stream.updatedAt,
        stream.id
      ]
    );
  }

  /* ============================================================
     PROCESS ASSET
  ============================================================ */

  async function processAsset(
    input = {}
  ) {
    if (!input.inputPath) {
      throw new Error(
        "inputPath is required"
      );
    }

    const metadata =
      await probe(
        input.inputPath
      );

    const output = {
      metadata
    };

    if (
      input.thumbnail !== false
    ) {
      output.thumbnail =
        await generateThumbnail({
          inputPath:
            input.inputPath
        });
    }

    if (
      input.preview !== false
    ) {
      output.preview =
        await generatePreview({
          inputPath:
            input.inputPath,

          duration:
            input.previewDuration ||
            30
        });
    }

    if (
      Array.isArray(
        input.qualities
      )
    ) {
      output.qualities = [];

      for (
        const quality
        of input.qualities
      ) {
        output.qualities.push(
          await generateQuality({
            inputPath:
              input.inputPath,

            quality
          })
        );
      }
    }

    if (
      input.hls === true
    ) {
      output.hls =
        await generateHLS({
          inputPath:
            input.inputPath
        });
    }

    state.statistics
      .videosProcessed++;

    emit(
      "video.processed",
      {
        assetId:
          input.assetId ||
          null,

        output
      }
    );

    return output;
  }

  /* ============================================================
     STATUS
  ============================================================ */

  function getStatistics() {
    return {
      ...clone(
        state.statistics
      ),

      queue:
        state.queue.length,

      activeWorkers:
        state.workers,

      limits: {
        maxJobs,
        maxFileSize,
        maxDurationSeconds
      }
    };
  }

  function getStatus() {
    return {
      service:
        "Intelligent Video Processing & Broadcast Engine",

      code:
        "CODE 86",

      initialized:
        state.initialized,

      running:
        state.running,

      ffmpeg:
        ffmpegPath,

      ffprobe:
        ffprobePath,

      storageAdapter:
        Boolean(
          storageAdapter
        ),

      dam:
        Boolean(
          damEngine
        ),

      statistics:
        getStatistics()
    };
  }

  function start() {
    state.running =
      true;

    emit(
      "video.broadcast.started",
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
      "video.broadcast.engine.stopped",
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

    probe,

    createJob,

    generateThumbnail,
    generatePreview,
    generateQuality,
    generateHLS,

    createClip,

    analyzeVideo,

    processAsset,

    createChannel,

    createStream,
    startStream,
    stopStream
  };
}

module.exports = {
  createIntelligentVideoBroadcastEngine
};
