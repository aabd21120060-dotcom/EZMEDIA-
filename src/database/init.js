"use strict";

const { query } = require("./db");

/*
|--------------------------------------------------------------------------
| EZ MEDIA 11.0
| Database Initialization
|--------------------------------------------------------------------------
|
| ينشئ جداول النظام الأساسية تلقائيًا عند تشغيل التطبيق
| إذا كان DATABASE_URL موجودًا.
|
*/

async function initializeDatabase() {
  /*
  |--------------------------------------------------------------------------
  | PostgreSQL Extension
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);

  /*
  |--------------------------------------------------------------------------
  | CMS CONTENT
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE TABLE IF NOT EXISTS cms_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      type VARCHAR(40)
        NOT NULL
        DEFAULT 'news',

      title VARCHAR(500)
        NOT NULL,

      slug VARCHAR(600)
        UNIQUE,

      summary TEXT,

      body TEXT,

      featured_image_url TEXT,

      video_url TEXT,

      audio_url TEXT,

      location VARCHAR(255),

      author_id UUID,

      editor_id UUID,

      status VARCHAR(30)
        NOT NULL
        DEFAULT 'draft',

      priority VARCHAR(20)
        NOT NULL
        DEFAULT 'normal',

      is_breaking BOOLEAN
        NOT NULL
        DEFAULT FALSE,

      is_featured BOOLEAN
        NOT NULL
        DEFAULT FALSE,

      allow_comments BOOLEAN
        NOT NULL
        DEFAULT TRUE,

      scheduled_at TIMESTAMPTZ,

      published_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    );
  `);

  /*
  |--------------------------------------------------------------------------
  | CMS INDEXES
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_content_status
    ON cms_content(status);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_content_type
    ON cms_content(type);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_content_published_at
    ON cms_content(published_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_content_created_at
    ON cms_content(created_at DESC);
  `);

  /*
  |--------------------------------------------------------------------------
  | CONTENT TAGS
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE TABLE IF NOT EXISTS cms_content_tags (
      id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

      content_id UUID
        NOT NULL
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

      tag VARCHAR(100)
        NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_content_tags_content
    ON cms_content_tags(content_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_content_tags_tag
    ON cms_content_tags(tag);
  `);

  /*
  |--------------------------------------------------------------------------
  | CONTENT REVISIONS
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE TABLE IF NOT EXISTS cms_content_revisions (
      id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

      content_id UUID
        NOT NULL
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

      title VARCHAR(500),

      summary TEXT,

      body TEXT,

      metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

      created_by UUID,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_revisions_content
    ON cms_content_revisions(content_id);
  `);

  /*
  |--------------------------------------------------------------------------
  | CONTENT EVENTS
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE TABLE IF NOT EXISTS cms_content_events (
      id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

      content_id UUID
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

      event_type VARCHAR(80)
        NOT NULL,

      old_status VARCHAR(30),

      new_status VARCHAR(30),

      actor_id UUID,

      metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_events_content
    ON cms_content_events(content_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_cms_events_created
    ON cms_content_events(created_at DESC);
  `);

  /*
  |--------------------------------------------------------------------------
  | AI JOBS
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE TABLE IF NOT EXISTS ai_jobs (
      id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

      content_id UUID
        REFERENCES cms_content(id)
        ON DELETE CASCADE,

      provider VARCHAR(100)
        NOT NULL,

      model VARCHAR(150),

      job_type VARCHAR(100)
        NOT NULL,

      status VARCHAR(40)
        NOT NULL
        DEFAULT 'queued',

      input JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

      output JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

      error TEXT,

      created_by UUID,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      completed_at TIMESTAMPTZ
    );
  `);

  /*
  |--------------------------------------------------------------------------
  | AI INDEXES
  |--------------------------------------------------------------------------
  */

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_ai_jobs_content
    ON ai_jobs(content_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_ai_jobs_status
    ON ai_jobs(status);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
      idx_ai_jobs_created
    ON ai_jobs(created_at DESC);
  `);

  /*
  |--------------------------------------------------------------------------
  | RESULT
  |--------------------------------------------------------------------------
  */

  return {
    success: true,

    platform: "EZ MEDIA",

    version: "11.0.0",

    message:
      "EZ MEDIA database initialized successfully"
  };
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  initializeDatabase
};
