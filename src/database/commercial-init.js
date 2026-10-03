"use strict";

const { query } = require("./db");

async function initializeCommercialDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS commercial_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      name VARCHAR(255) NOT NULL,

      campaign_type VARCHAR(30) NOT NULL
        CHECK (
          campaign_type IN (
            'advertising',
            'sponsorship',
            'partnership'
          )
        ),

      status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (
          status IN (
            'draft',
            'pending',
            'approved',
            'active',
            'paused',
            'completed',
            'cancelled'
          )
        ),

      advertiser_name VARCHAR(255),

      sponsor_name VARCHAR(255),

      contact_name VARCHAR(255),

      contact_email VARCHAR(255),

      contact_phone VARCHAR(100),

      description TEXT,

      budget NUMERIC(14,2),

      currency VARCHAR(10) DEFAULT 'SAR',

      start_at TIMESTAMPTZ,

      end_at TIMESTAMPTZ,

      priority INTEGER DEFAULT 0,

      targeting JSONB NOT NULL DEFAULT '{}'::jsonb,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);


  await query(`
    CREATE TABLE IF NOT EXISTS commercial_placements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      campaign_id UUID NOT NULL
        REFERENCES commercial_campaigns(id)
        ON DELETE CASCADE,

      placement_key VARCHAR(100) NOT NULL,

      placement_type VARCHAR(30) NOT NULL
        CHECK (
          placement_type IN (
            'banner',
            'native',
            'video',
            'live',
            'article',
            'section',
            'homepage'
          )
        ),

      title VARCHAR(255),

      image_url TEXT,

      video_url TEXT,

      destination_url TEXT,

      content_id UUID,

      status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (
          status IN (
            'draft',
            'active',
            'paused',
            'expired'
          )
        ),

      impressions BIGINT NOT NULL DEFAULT 0,

      clicks BIGINT NOT NULL DEFAULT 0,

      starts BIGINT NOT NULL DEFAULT 0,

      completed_views BIGINT NOT NULL DEFAULT 0,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);


  await query(`
    CREATE TABLE IF NOT EXISTS commercial_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      campaign_id UUID
        REFERENCES commercial_campaigns(id)
        ON DELETE CASCADE,

      placement_id UUID
        REFERENCES commercial_placements(id)
        ON DELETE CASCADE,

      event_type VARCHAR(50) NOT NULL,

      visitor_id VARCHAR(255),

      session_id VARCHAR(255),

      content_id UUID,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);


  await query(`
    CREATE INDEX IF NOT EXISTS idx_commercial_campaigns_status
    ON commercial_campaigns(status)
  `);


  await query(`
    CREATE INDEX IF NOT EXISTS idx_commercial_campaigns_dates
    ON commercial_campaigns(start_at, end_at)
  `);


  await query(`
    CREATE INDEX IF NOT EXISTS idx_commercial_campaigns_priority
    ON commercial_campaigns(priority DESC)
  `);


  await query(`
    CREATE INDEX IF NOT EXISTS idx_commercial_placements_campaign
    ON commercial_placements(campaign_id)
  `);


  await query(`
    CREATE INDEX IF NOT EXISTS idx_commercial_placements_key
    ON commercial_placements(placement_key)
  `);


  await query(`
    CREATE INDEX IF NOT EXISTS idx_commercial_events_campaign
    ON commercial_events(campaign_id)
  `);


  await query(`
    CREATE INDEX IF NOT EXISTS idx_commercial_events_created
    ON commercial_events(created_at DESC)
  `);


  console.log(
    "Commercial database initialized successfully."
  );
}


module.exports = {
  initializeCommercialDatabase
};
