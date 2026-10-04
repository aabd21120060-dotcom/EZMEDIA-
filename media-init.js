"use strict";

const { query } = require("./db");

async function initializeMediaDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      title VARCHAR(500) NOT NULL,

      description TEXT,

      media_type VARCHAR(50) NOT NULL DEFAULT 'file'
        CHECK (
          media_type IN (
            'image',
            'video',
            'audio',
            'document',
            'file',
            'thumbnail',
            'live_recording'
          )
        ),

      mime_type VARCHAR(200),

      file_name VARCHAR(500),

      original_file_name VARCHAR(500),

      file_size BIGINT,

      storage_provider VARCHAR(100),

      storage_bucket VARCHAR(500),

      storage_key TEXT,

      file_url TEXT,

      thumbnail_url TEXT,

      duration_seconds NUMERIC(12,3),

      width INTEGER,

      height INTEGER,

      bitrate INTEGER,

      codec VARCHAR(100),

      status VARCHAR(50) NOT NULL DEFAULT 'ready'
        CHECK (
          status IN (
            'uploading',
            'processing',
            'ready',
            'published',
            'archived',
            'deleted',
            'failed'
          )
        ),

      visibility VARCHAR(50) NOT NULL DEFAULT 'private'
        CHECK (
          visibility IN (
            'private',
            'internal',
            'public',
            'unlisted'
          )
        ),

      uploaded_by UUID,

      uploader_name VARCHAR(200),

      source VARCHAR(100),

      checksum VARCHAR(255),

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      ai_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      tags JSONB NOT NULL DEFAULT '[]'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      published_at TIMESTAMPTZ,

      deleted_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_assets_type
    ON media_assets(media_type);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_assets_status
    ON media_assets(status);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_assets_visibility
    ON media_assets(visibility);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_assets_created_at
    ON media_assets(created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_assets_source
    ON media_assets(source);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_assets_checksum
    ON media_assets(checksum);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS media_folders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      name VARCHAR(300) NOT NULL,

      description TEXT,

      parent_id UUID
        REFERENCES media_folders(id)
        ON DELETE CASCADE,

      owner_id UUID,

      visibility VARCHAR(50) NOT NULL DEFAULT 'private'
        CHECK (
          visibility IN (
            'private',
            'internal',
            'public'
          )
        ),

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_folders_parent
    ON media_folders(parent_id);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS media_folder_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      folder_id UUID NOT NULL
        REFERENCES media_folders(id)
        ON DELETE CASCADE,

      media_id UUID NOT NULL
        REFERENCES media_assets(id)
        ON DELETE CASCADE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE(folder_id, media_id)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_folder_items_folder
    ON media_folder_items(folder_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_folder_items_media
    ON media_folder_items(media_id);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS media_processing_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      media_id UUID NOT NULL
        REFERENCES media_assets(id)
        ON DELETE CASCADE,

      job_type VARCHAR(100) NOT NULL,

      status VARCHAR(50) NOT NULL DEFAULT 'queued'
        CHECK (
          status IN (
            'queued',
            'processing',
            'completed',
            'failed',
            'cancelled'
          )
        ),

      progress INTEGER NOT NULL DEFAULT 0
        CHECK (progress >= 0 AND progress <= 100),

      worker VARCHAR(200),

      error_message TEXT,

      input_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      output_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      started_at TIMESTAMPTZ,

      completed_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_processing_media
    ON media_processing_jobs(media_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_processing_status
    ON media_processing_jobs(status);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS media_ai_analysis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      media_id UUID NOT NULL
        REFERENCES media_assets(id)
        ON DELETE CASCADE,

      provider VARCHAR(100),

      model VARCHAR(200),

      analysis_type VARCHAR(100) NOT NULL,

      summary TEXT,

      transcript TEXT,

      detected_objects JSONB NOT NULL DEFAULT '[]'::jsonb,

      detected_people JSONB NOT NULL DEFAULT '[]'::jsonb,

      detected_places JSONB NOT NULL DEFAULT '[]'::jsonb,

      detected_topics JSONB NOT NULL DEFAULT '[]'::jsonb,

      detected_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,

      sentiment JSONB NOT NULL DEFAULT '{}'::jsonb,

      confidence NUMERIC(6,5),

      raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_ai_analysis_media
    ON media_ai_analysis(media_id);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS media_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      media_id UUID NOT NULL
        REFERENCES media_assets(id)
        ON DELETE CASCADE,

      version_number INTEGER NOT NULL,

      file_url TEXT,

      storage_key TEXT,

      file_size BIGINT,

      mime_type VARCHAR(200),

      checksum VARCHAR(255),

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE(media_id, version_number)
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_media_versions_media
    ON media_versions(media_id);
  `);

  return {
    success: true,

    tables: [
      "media_assets",
      "media_folders",
      "media_folder_items",
      "media_processing_jobs",
      "media_ai_analysis",
      "media_versions"
    ]
  };
}

module.exports = {
  initializeMediaDatabase
};
