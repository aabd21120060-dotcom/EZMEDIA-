"use strict";

const { query } = require("./db");

async function initializeMediaDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      title VARCHAR(500) NOT NULL,

      description TEXT,

      asset_type VARCHAR(30) NOT NULL,

      mime_type VARCHAR(150),

      file_url TEXT NOT NULL,

      thumbnail_url TEXT,

      storage_provider VARCHAR(100),

      storage_key TEXT,

      file_size BIGINT,

      duration_seconds INTEGER,

      width INTEGER,

      height INTEGER,

      status VARCHAR(30) NOT NULL DEFAULT 'processing',

      uploaded_by UUID,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_media_assets_type
      ON media_assets(asset_type);

    CREATE INDEX IF NOT EXISTS idx_media_assets_status
      ON media_assets(status);

    CREATE INDEX IF NOT EXISTS idx_media_assets_created
      ON media_assets(created_at DESC);


    CREATE TABLE IF NOT EXISTS live_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      name VARCHAR(255) NOT NULL,

      description TEXT,

      stream_type VARCHAR(30) NOT NULL DEFAULT 'hls',

      stream_url TEXT NOT NULL,

      backup_stream_url TEXT,

      logo_url TEXT,

      thumbnail_url TEXT,

      status VARCHAR(30) NOT NULL DEFAULT 'offline',

      is_featured BOOLEAN NOT NULL DEFAULT FALSE,

      is_public BOOLEAN NOT NULL DEFAULT TRUE,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_live_channels_status
      ON live_channels(status);

    CREATE INDEX IF NOT EXISTS idx_live_channels_featured
      ON live_channels(is_featured);


    CREATE TABLE IF NOT EXISTS breaking_news (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      title VARCHAR(500) NOT NULL,

      summary TEXT,

      body TEXT,

      source_name VARCHAR(255),

      source_url TEXT,

      image_url TEXT,

      priority VARCHAR(30) NOT NULL DEFAULT 'high',

      status VARCHAR(30) NOT NULL DEFAULT 'draft',

      published_at TIMESTAMPTZ,

      expires_at TIMESTAMPTZ,

      created_by UUID,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_breaking_news_status
      ON breaking_news(status);

    CREATE INDEX IF NOT EXISTS idx_breaking_news_published
      ON breaking_news(published_at DESC);

    CREATE INDEX IF NOT EXISTS idx_breaking_news_expires
      ON breaking_news(expires_at);
  `);

  return {
    success: true,
    message: "Media database initialized"
  };
}

module.exports = {
  initializeMediaDatabase
};
