"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Database Bootstrap
 *
 * الكود رقم 43
 *
 * مسؤول عن:
 * - تهيئة قاعدة بيانات الإشعارات.
 * - التحقق من جاهزية الجداول.
 * - قراءة إحصائيات الإشعارات.
 * - توفير حالة موحدة للنظام.
 * - عدم كشف أي أسرار أو DATABASE_URL.
 */

const {
  query
} = require("./db");

const {
  initializeNotificationDatabase,
  notificationDatabaseHealth,
  getNotificationDatabaseStatistics
} = require("./notification-init");

let initialized = false;
let initializationInProgress = false;
let lastInitialization = null;
let lastError = null;

function nowISO() {
  return new Date().toISOString();
}

async function verifyNotificationTables() {
  const result = await query(`
    SELECT
      table_name
    FROM information_schema.tables
    WHERE
      table_schema = 'public'
      AND table_name IN (
        'notification_templates',
        'notifications',
        'notification_deliveries',
        'notification_preferences',
        'notification_rules',
        'notification_events'
      )
    ORDER BY table_name
  `);

  const expected = [
    "notification_templates",
    "notifications",
    "notification_deliveries",
    "notification_preferences",
    "notification_rules",
    "notification_events"
  ];

  const existing = result.rows.map(
    (row) => row.table_name
  );

  const missing = expected.filter(
    (table) => !existing.includes(table)
  );

  return {
    ready: missing.length === 0,
    expected,
    existing,
    missing
  };
}

async function initializeNotifications(options = {}) {
  if (initializationInProgress) {
    return {
      success: false,
      status: "initialization_in_progress"
    };
  }

  if (initialized && !options.force) {
    return {
      success: true,
      status: "already_initialized",
      timestamp: lastInitialization
    };
  }

  initializationInProgress = true;
  lastError = null;

  try {
    if (!process.env.DATABASE_URL) {
      return {
        success: false,
        status: "database_not_configured",
        message: "DATABASE_URL is not configured"
      };
    }

    /**
     * إنشاء جداول الإشعارات.
     */
    await initializeNotificationDatabase();

    /**
     * التأكد من وجود جميع الجداول الأساسية.
     */
    const tables = await verifyNotificationTables();

    if (!tables.ready) {
      throw new Error(
        `Notification database is incomplete. Missing tables: ${tables.missing.join(", ")}`
      );
    }

    initialized = true;
    lastInitialization = nowISO();

    return {
      success: true,
      status: "initialized",
      tables,
      timestamp: lastInitialization
    };
  } catch (error) {
    initialized = false;
    lastError = error.message;

    console.error(
      "EZ MEDIA notification database initialization error:",
      error
    );

    return {
      success: false,
      status: "error",
      error: error.message,
      timestamp: nowISO()
    };
  } finally {
    initializationInProgress = false;
  }
}

async function getNotificationBootstrapStatus() {
  let databaseHealth = null;
  let tables = null;
  let statistics = null;

  try {
    databaseHealth =
      await notificationDatabaseHealth();
  } catch (error) {
    databaseHealth = {
      configured: Boolean(process.env.DATABASE_URL),
      connected: false,
      error: error.message
    };
  }

  if (databaseHealth && databaseHealth.connected) {
    try {
      tables = await verifyNotificationTables();
    } catch (error) {
      tables = {
        ready: false,
        error: error.message
      };
    }

    if (tables && tables.ready) {
      try {
        statistics =
          await getNotificationDatabaseStatistics();
      } catch (error) {
        statistics = {
          available: false,
          error: error.message
        };
      }
    }
  }

  return {
    service: "notificationDatabaseBootstrap",
    status:
      databaseHealth && databaseHealth.connected
        ? tables && tables.ready
          ? "ready"
          : "incomplete"
        : "database_unavailable",

    initialized,
    initializationInProgress,

    database: databaseHealth,

    tables,

    statistics,

    lastInitialization,

    lastError,

    timestamp: nowISO()
  };
}

async function ensureNotificationDatabase() {
  const status =
    await getNotificationBootstrapStatus();

  if (
    status.database &&
    status.database.connected &&
    status.tables &&
    status.tables.ready
  ) {
    initialized = true;

    return {
      success: true,
      status: "ready",
      bootstrap: status
    };
  }

  return initializeNotifications();
}

async function getNotificationStatisticsSnapshot() {
  try {
    return await getNotificationDatabaseStatistics();
  } catch (error) {
    return {
      available: false,
      error: error.message,
      timestamp: nowISO()
    };
  }
}

async function resetBootstrapState() {
  initialized = false;
  initializationInProgress = false;
  lastInitialization = null;
  lastError = null;

  return {
    success: true,
    status: "reset",
    timestamp: nowISO()
  };
}

module.exports = {
  initializeNotifications,
  ensureNotificationDatabase,
  verifyNotificationTables,
  getNotificationBootstrapStatus,
  getNotificationStatisticsSnapshot,
  resetBootstrapState
};
