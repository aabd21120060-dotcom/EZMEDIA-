"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 39
 *
 * الملف:
 * src/database/notification-init.js
 *
 * الوظيفة:
 * قاعدة البيانات المركزية للإشعارات والتنبيهات.
 *
 * الجداول:
 * 1. notification_templates
 * 2. notifications
 * 3. notification_deliveries
 * 4. notification_preferences
 * 5. notification_rules
 * 6. notification_events
 *
 * مصمم للعمل مع PostgreSQL عبر:
 * src/database/db.js
 */

const { query } = require("./db");

/* =========================================================
   أدوات مساعدة
========================================================= */

async function tableExists(tableName) {
  const result = await query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName]
  );

  return Boolean(result.rows[0]?.exists);
}

/* =========================================================
   1. قوالب الإشعارات
========================================================= */

async function createNotificationTemplatesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notification_templates (
      id BIGSERIAL PRIMARY KEY,

      template_key VARCHAR(120) NOT NULL UNIQUE,

      name VARCHAR(200) NOT NULL,

      description TEXT,

      notification_type VARCHAR(50) NOT NULL DEFAULT 'custom',

      title_template TEXT NOT NULL,

      message_template TEXT NOT NULL,

      default_priority VARCHAR(20) NOT NULL DEFAULT 'normal',

      default_channel VARCHAR(50) NOT NULL DEFAULT 'in_app',

      is_active BOOLEAN NOT NULL DEFAULT TRUE,

      variables JSONB NOT NULL DEFAULT '[]'::jsonb,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_notification_templates_type
    ON notification_templates(notification_type)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_notification_templates_active
    ON notification_templates(is_active)
  `);
}

/* =========================================================
   2. الإشعارات الرئيسية
========================================================= */

async function createNotificationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,

      notification_uuid UUID NOT NULL DEFAULT gen_random_uuid(),

      notification_type VARCHAR(50) NOT NULL DEFAULT 'custom',

      title TEXT NOT NULL,

      message TEXT NOT NULL,

      priority VARCHAR(20) NOT NULL DEFAULT 'normal',

      status VARCHAR(30) NOT NULL DEFAULT 'queued',

      source VARCHAR(100),

      source_id VARCHAR(150),

      content_id BIGINT,

      template_id BIGINT,

      audience_type VARCHAR(50) NOT NULL DEFAULT 'all',

      audience_id VARCHAR(150),

      action_url TEXT,

      image_url TEXT,

      icon_url TEXT,

      dedupe_key VARCHAR(500),

      scheduled_at TIMESTAMPTZ,

      queued_at TIMESTAMPTZ,

      processing_started_at TIMESTAMPTZ,

      processed_at TIMESTAMPTZ,

      expires_at TIMESTAMPTZ,

      attempt_count INTEGER NOT NULL DEFAULT 0,

      max_attempts INTEGER NOT NULL DEFAULT 3,

      error_message TEXT,

      payload JSONB NOT NULL DEFAULT '{}'::jsonb,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_by BIGINT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT notification_priority_check
        CHECK (
          priority IN (
            'low',
            'normal',
            'high',
            'urgent',
            'critical'
          )
        ),

      CONSTRAINT notification_status_check
        CHECK (
          status IN (
            'draft',
            'queued',
            'scheduled',
            'preparing',
            'sending',
            'sent',
            'delivered',
            'partial',
            'failed',
            'cancelled',
            'expired'
          )
        )
    )
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_notifications_uuid
    ON notifications(notification_uuid)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_status
    ON notifications(status)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_priority
    ON notifications(priority)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_type
    ON notifications(notification_type)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_source
    ON notifications(source, source_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_content
    ON notifications(content_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_audience
    ON notifications(audience_type, audience_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_scheduled
    ON notifications(scheduled_at)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_created
    ON notifications(created_at DESC)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_dedupe
    ON notifications(dedupe_key)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notifications_payload
    ON notifications
    USING GIN(payload)
  `);
}

/* =========================================================
   3. عمليات تسليم الإشعارات
========================================================= */

async function createNotificationDeliveriesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id BIGSERIAL PRIMARY KEY,

      notification_id BIGINT NOT NULL,

      channel VARCHAR(50) NOT NULL,

      provider VARCHAR(100),

      recipient_id VARCHAR(200),

      recipient_address TEXT,

      device_id VARCHAR(300),

      provider_message_id VARCHAR(300),

      status VARCHAR(30) NOT NULL DEFAULT 'queued',

      attempt_count INTEGER NOT NULL DEFAULT 0,

      max_attempts INTEGER NOT NULL DEFAULT 3,

      queued_at TIMESTAMPTZ,

      sending_at TIMESTAMPTZ,

      sent_at TIMESTAMPTZ,

      delivered_at TIMESTAMPTZ,

      failed_at TIMESTAMPTZ,

      error_code VARCHAR(100),

      error_message TEXT,

      response JSONB NOT NULL DEFAULT '{}'::jsonb,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT notification_delivery_status_check
        CHECK (
          status IN (
            'queued',
            'preparing',
            'sending',
            'sent',
            'delivered',
            'failed',
            'cancelled',
            'expired'
          )
        ),

      CONSTRAINT notification_delivery_channel_check
        CHECK (
          channel IN (
            'in_app',
            'dashboard',
            'web_push',
            'firebase',
            'apns',
            'email',
            'sms',
            'social',
            'other'
          )
        )
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_deliveries_notification
    ON notification_deliveries(notification_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_deliveries_status
    ON notification_deliveries(status)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_deliveries_channel
    ON notification_deliveries(channel)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_deliveries_recipient
    ON notification_deliveries(recipient_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_deliveries_device
    ON notification_deliveries(device_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_deliveries_provider_message
    ON notification_deliveries(provider_message_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_deliveries_created
    ON notification_deliveries(created_at DESC)
  `);
}

/* =========================================================
   4. تفضيلات المستخدمين
========================================================= */

async function createNotificationPreferencesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id BIGSERIAL PRIMARY KEY,

      user_id BIGINT,

      audience_id VARCHAR(150),

      device_id VARCHAR(300),

      channel VARCHAR(50) NOT NULL,

      notification_type VARCHAR(50),

      enabled BOOLEAN NOT NULL DEFAULT TRUE,

      quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,

      quiet_hours_start TIME,

      quiet_hours_end TIME,

      timezone VARCHAR(100) DEFAULT 'Asia/Riyadh',

      language VARCHAR(20) DEFAULT 'ar',

      frequency_limit INTEGER,

      frequency_window_minutes INTEGER,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_preferences_user
    ON notification_preferences(user_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_preferences_audience
    ON notification_preferences(audience_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_preferences_device
    ON notification_preferences(device_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_preferences_channel
    ON notification_preferences(channel)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_preferences_type
    ON notification_preferences(notification_type)
  `);
}

/* =========================================================
   5. قواعد الإشعارات الذكية
========================================================= */

async function createNotificationRulesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notification_rules (
      id BIGSERIAL PRIMARY KEY,

      rule_key VARCHAR(150) NOT NULL UNIQUE,

      name VARCHAR(250) NOT NULL,

      description TEXT,

      event_type VARCHAR(100) NOT NULL,

      source VARCHAR(100),

      condition JSONB NOT NULL DEFAULT '{}'::jsonb,

      action JSONB NOT NULL DEFAULT '{}'::jsonb,

      channels JSONB NOT NULL DEFAULT '[]'::jsonb,

      audience JSONB NOT NULL DEFAULT '{}'::jsonb,

      priority VARCHAR(20) NOT NULL DEFAULT 'normal',

      cooldown_minutes INTEGER NOT NULL DEFAULT 0,

      deduplicate BOOLEAN NOT NULL DEFAULT TRUE,

      is_active BOOLEAN NOT NULL DEFAULT TRUE,

      execution_count BIGINT NOT NULL DEFAULT 0,

      last_executed_at TIMESTAMPTZ,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT notification_rule_priority_check
        CHECK (
          priority IN (
            'low',
            'normal',
            'high',
            'urgent',
            'critical'
          )
        )
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_rules_event
    ON notification_rules(event_type)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_rules_active
    ON notification_rules(is_active)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_rules_source
    ON notification_rules(source)
  `);
}

/* =========================================================
   6. سجل أحداث الإشعارات
========================================================= */

async function createNotificationEventsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notification_events (
      id BIGSERIAL PRIMARY KEY,

      notification_id BIGINT,

      delivery_id BIGINT,

      event_type VARCHAR(100) NOT NULL,

      event_source VARCHAR(100),

      actor_id BIGINT,

      message TEXT,

      data JSONB NOT NULL DEFAULT '{}'::jsonb,

      ip_address INET,

      user_agent TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_events_notification
    ON notification_events(notification_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_events_delivery
    ON notification_events(delivery_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_events_type
    ON notification_events(event_type)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_events_source
    ON notification_events(event_source)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_events_created
    ON notification_events(created_at DESC)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS
    idx_notification_events_data
    ON notification_events
    USING GIN(data)
  `);
}

/* =========================================================
   7. تحديث updated_at
========================================================= */

async function createUpdatedAtFunction() {
  await query(`
    CREATE OR REPLACE FUNCTION ez_media_set_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$
  `);
}

async function createUpdatedAtTriggers() {
  const tables = [
    "notification_templates",
    "notifications",
    "notification_deliveries",
    "notification_preferences",
    "notification_rules"
  ];

  for (const table of tables) {
    const triggerName =
      `trg_${table}_updated_at`;

    await query(`
      DROP TRIGGER IF EXISTS
      ${triggerName}
      ON ${table}
    `);

    await query(`
      CREATE TRIGGER
      ${triggerName}
      BEFORE UPDATE
      ON ${table}
      FOR EACH ROW
      EXECUTE FUNCTION
      ez_media_set_updated_at()
    `);
  }
}

/* =========================================================
   8. البيانات الأساسية
========================================================= */

async function seedNotificationTemplates() {
  const templates = [
    {
      key:
        "breaking_news",

      name:
        "خبر عاجل",

      description:
        "تنبيه فوري للأخبار العاجلة.",

      type:
        "breaking",

      title:
        "عاجل: {{headline}}",

      message:
        "{{summary}}",

      priority:
        "critical",

      channel:
        "web_push",

      variables: [
        "headline",
        "summary",
        "content_id"
      ]
    },

    {
      key:
        "live_started",

      name:
        "بدء بث مباشر",

      description:
        "تنبيه الجمهور عند بدء بث مباشر.",

      type:
        "live",

      title:
        "بث مباشر الآن",

      message:
        "{{title}}",

      priority:
        "high",

      channel:
        "web_push",

      variables: [
        "title",
        "channel_id"
      ]
    },

    {
      key:
        "new_content",

      name:
        "محتوى جديد",

      description:
        "تنبيه عند نشر محتوى جديد.",

      type:
        "news",

      title:
        "{{headline}}",

      message:
        "{{summary}}",

      priority:
        "normal",

      channel:
        "web_push",

      variables: [
        "headline",
        "summary",
        "content_id"
      ]
    },

    {
      key:
        "system_alert",

      name:
        "تنبيه النظام",

      description:
        "تنبيهات تشغيلية للنظام.",

      type:
        "system",

      title:
        "{{title}}",

      message:
        "{{message}}",

      priority:
        "high",

      channel:
        "dashboard",

      variables: [
        "title",
        "message"
      ]
    }
  ];

  for (const template of templates) {
    await query(
      `
        INSERT INTO notification_templates (
          template_key,
          name,
          description,
          notification_type,
          title_template,
          message_template,
          default_priority,
          default_channel,
          variables
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb
        )
        ON CONFLICT (
          template_key
        )
        DO UPDATE SET
          name =
            EXCLUDED.name,

          description =
            EXCLUDED.description,

          notification_type =
            EXCLUDED.notification_type,

          title_template =
            EXCLUDED.title_template,

          message_template =
            EXCLUDED.message_template,

          default_priority =
            EXCLUDED.default_priority,

          default_channel =
            EXCLUDED.default_channel,

          variables =
            EXCLUDED.variables,

          updated_at =
            NOW()
      `,
      [
        template.key,
        template.name,
        template.description,
        template.type,
        template.title,
        template.message,
        template.priority,
        template.channel,
        JSON.stringify(
          template.variables
        )
      ]
    );
  }
}

/* =========================================================
   9. قواعد أساسية
========================================================= */

async function seedNotificationRules() {
  const rules = [
    {
      key:
        "breaking_news_push",

      name:
        "تنبيه الأخبار العاجلة",

      description:
        "إنشاء Push عند وصول خبر عاجل.",

      event:
        "breaking.created",

      source:
        "breaking",

      condition: {
        enabled:
          true
      },

      action: {
        template:
          "breaking_news",

        createNotification:
          true
      },

      channels: [
        "in_app",
        "web_push"
      ],

      audience: {
        type:
          "breaking"
      },

      priority:
        "critical"
    },

    {
      key:
        "live_started_push",

      name:
        "تنبيه بدء البث",

      description:
        "إرسال تنبيه عند بدء بث مباشر.",

      event:
        "live.started",

      source:
        "live",

      condition: {
        enabled:
          true
      },

      action: {
        template:
          "live_started",

        createNotification:
          true
      },

      channels: [
        "in_app",
        "web_push"
      ],

      audience: {
        type:
          "live"
      },

      priority:
        "high"
    },

    {
      key:
        "content_published_push",

      name:
        "تنبيه المحتوى الجديد",

      description:
        "تنبيه عند نشر محتوى جديد.",

      event:
        "content.published",

      source:
        "content",

      condition: {
        enabled:
          true
      },

      action: {
        template:
          "new_content",

        createNotification:
          true
      },

      channels: [
        "in_app",
        "web_push"
      ],

      audience: {
        type:
          "news"
      },

      priority:
        "normal"
    }
  ];

  for (const rule of rules) {
    await query(
      `
        INSERT INTO notification_rules (
          rule_key,
          name,
          description,
          event_type,
          source,
          condition,
          action,
          channels,
          audience,
          priority
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10
        )
        ON CONFLICT (
          rule_key
        )
        DO UPDATE SET
          name =
            EXCLUDED.name,

          description =
            EXCLUDED.description,

          event_type =
            EXCLUDED.event_type,

          source =
            EXCLUDED.source,

          condition =
            EXCLUDED.condition,

          action =
            EXCLUDED.action,

          channels =
            EXCLUDED.channels,

          audience =
            EXCLUDED.audience,

          priority =
            EXCLUDED.priority,

          updated_at =
            NOW()
      `,
      [
        rule.key,
        rule.name,
        rule.description,
        rule.event,
        rule.source,
        JSON.stringify(
          rule.condition
        ),
        JSON.stringify(
          rule.action
        ),
        JSON.stringify(
          rule.channels
        ),
        JSON.stringify(
          rule.audience
        ),
        rule.priority
      ]
    );
  }
}

/* =========================================================
   10. علاقات اختيارية مع المستخدمين والمحتوى
========================================================= */

async function createOptionalForeignKeys() {
  const adminUsersExists =
    await tableExists(
      "admin_users"
    );

  const contentExists =
    await tableExists(
      "cms_content"
    );

  if (contentExists) {
    await query(`
      DO $$
      BEGIN

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'fk_notifications_content'
        ) THEN

          ALTER TABLE
          notifications

          ADD CONSTRAINT
          fk_notifications_content

          FOREIGN KEY (
            content_id
          )

          REFERENCES
          cms_content(id)

          ON DELETE SET NULL;

        END IF;

      EXCEPTION
        WHEN undefined_column THEN
          NULL;

        WHEN undefined_table THEN
          NULL;
      END
      $$
    `);
  }

  if (adminUsersExists) {
    await query(`
      DO $$
      BEGIN

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'fk_notifications_created_by'
        ) THEN

          ALTER TABLE
          notifications

          ADD CONSTRAINT
          fk_notifications_created_by

          FOREIGN KEY (
            created_by
          )

          REFERENCES
          admin_users(id)

          ON DELETE SET NULL;

        END IF;

      EXCEPTION
        WHEN undefined_column THEN
          NULL;

        WHEN undefined_table THEN
          NULL;
      END
      $$
    `);

    await query(`
      DO $$
      BEGIN

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname =
            'fk_notification_events_actor'
        ) THEN

          ALTER TABLE
          notification_events

          ADD CONSTRAINT
          fk_notification_events_actor

          FOREIGN KEY (
            actor_id
          )

          REFERENCES
          admin_users(id)

          ON DELETE SET NULL;

        END IF;

      EXCEPTION
        WHEN undefined_column THEN
          NULL;

        WHEN undefined_table THEN
          NULL;
      END
      $$
    `);
  }

  await query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_deliveries_notification'
      ) THEN

        ALTER TABLE
        notification_deliveries

        ADD CONSTRAINT
        fk_deliveries_notification

        FOREIGN KEY (
          notification_id
        )

        REFERENCES
        notifications(id)

        ON DELETE CASCADE;

      END IF;

    EXCEPTION
      WHEN undefined_column THEN
        NULL;

      WHEN undefined_table THEN
        NULL;
    END
    $$
  `);

  await query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_events_notification'
      ) THEN

        ALTER TABLE
        notification_events

        ADD CONSTRAINT
        fk_events_notification

        FOREIGN KEY (
          notification_id
        )

        REFERENCES
        notifications(id)

        ON DELETE CASCADE;

      END IF;

    EXCEPTION
      WHEN undefined_column THEN
        NULL;

      WHEN undefined_table THEN
        NULL;
    END
    $$
  `);

  await query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_events_delivery'
      ) THEN

        ALTER TABLE
        notification_events

        ADD CONSTRAINT
        fk_events_delivery

        FOREIGN KEY (
          delivery_id
        )

        REFERENCES
        notification_deliveries(id)

        ON DELETE CASCADE;

      END IF;

    EXCEPTION
      WHEN undefined_column THEN
        NULL;

      WHEN undefined_table THEN
        NULL;
    END
    $$
  `);
}

/* =========================================================
   11. View للإحصائيات
========================================================= */

async function createNotificationStatisticsView() {
  await query(`
    CREATE OR REPLACE VIEW notification_statistics
    AS
    SELECT
      COUNT(*)::BIGINT AS total_notifications,

      COUNT(*) FILTER (
        WHERE status = 'queued'
      )::BIGINT AS queued_notifications,

      COUNT(*) FILTER (
        WHERE status = 'scheduled'
      )::BIGINT AS scheduled_notifications,

      COUNT(*) FILTER (
        WHERE status = 'sending'
      )::BIGINT AS sending_notifications,

      COUNT(*) FILTER (
        WHERE status = 'sent'
      )::BIGINT AS sent_notifications,

      COUNT(*) FILTER (
        WHERE status = 'delivered'
      )::BIGINT AS delivered_notifications,

      COUNT(*) FILTER (
        WHERE status = 'failed'
      )::BIGINT AS failed_notifications,

      COUNT(*) FILTER (
        WHERE status = 'cancelled'
      )::BIGINT AS cancelled_notifications,

      COUNT(*) FILTER (
        WHERE priority = 'critical'
      )::BIGINT AS critical_notifications,

      COUNT(*) FILTER (
        WHERE priority = 'urgent'
      )::BIGINT AS urgent_notifications,

      COUNT(*) FILTER (
        WHERE created_at >=
          NOW() - INTERVAL '24 hours'
      )::BIGINT AS last_24h_notifications,

      COUNT(*) FILTER (
        WHERE created_at >=
          NOW() - INTERVAL '7 days'
      )::BIGINT AS last_7d_notifications

    FROM notifications
  `);
}

/* =========================================================
   12. الإحصائيات الخاصة بالتسليم
========================================================= */

async function createDeliveryStatisticsView() {
  await query(`
    CREATE OR REPLACE VIEW notification_delivery_statistics
    AS
    SELECT
      channel,

      COUNT(*)::BIGINT AS total,

      COUNT(*) FILTER (
        WHERE status = 'queued'
      )::BIGINT AS queued,

      COUNT(*) FILTER (
        WHERE status = 'sending'
      )::BIGINT AS sending,

      COUNT(*) FILTER (
        WHERE status = 'sent'
      )::BIGINT AS sent,

      COUNT(*) FILTER (
        WHERE status = 'delivered'
      )::BIGINT AS delivered,

      COUNT(*) FILTER (
        WHERE status = 'failed'
      )::BIGINT AS failed,

      COUNT(*) FILTER (
        WHERE status = 'cancelled'
      )::BIGINT AS cancelled

    FROM notification_deliveries

    GROUP BY
      channel
  `);
}

/* =========================================================
   13. تشغيل التهيئة الكاملة
========================================================= */

async function initializeNotificationDatabase() {
  console.log(
    "EZ MEDIA: initializing notification database..."
  );

  await createNotificationTemplatesTable();

  await createNotificationsTable();

  await createNotificationDeliveriesTable();

  await createNotificationPreferencesTable();

  await createNotificationRulesTable();

  await createNotificationEventsTable();

  await createUpdatedAtFunction();

  await createUpdatedAtTriggers();

  await createOptionalForeignKeys();

  await createNotificationStatisticsView();

  await createDeliveryStatisticsView();

  await seedNotificationTemplates();

  await seedNotificationRules();

  console.log(
    "EZ MEDIA: notification database initialized successfully."
  );

  return {
    initialized: true,

    tables: [
      "notification_templates",
      "notifications",
      "notification_deliveries",
      "notification_preferences",
      "notification_rules",
      "notification_events"
    ],

    views: [
      "notification_statistics",
      "notification_delivery_statistics"
    ]
  };
}

/* =========================================================
   فحص قاعدة بيانات الإشعارات
========================================================= */

async function notificationDatabaseHealth() {
  const tables = [
    "notification_templates",
    "notifications",
    "notification_deliveries",
    "notification_preferences",
    "notification_rules",
    "notification_events"
  ];

  const result = {};

  for (const table of tables) {
    result[table] =
      await tableExists(
        table
      );
  }

  return {
    ready:
      Object.values(
        result
      ).every(Boolean),

    tables:
      result
  };
}

/* =========================================================
   الإحصائيات
========================================================= */

async function getNotificationDatabaseStatistics() {
  const result =
    await query(`
      SELECT *
      FROM notification_statistics
    `);

  const deliveries =
    await query(`
      SELECT *
      FROM notification_delivery_statistics
      ORDER BY channel ASC
    `);

  return {
    notifications:
      result.rows[0] || {},

    deliveries:
      deliveries.rows || []
  };
}

/* =========================================================
   التصدير
========================================================= */

module.exports = {
  initializeNotificationDatabase,

  notificationDatabaseHealth,

  getNotificationDatabaseStatistics
};
