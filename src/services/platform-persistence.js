/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 55
 * ================================================================
 *
 * Platform Persistence & Audit Repository
 *
 * المسؤوليات:
 * - إنشاء جداول نظام المنصة
 * - سجل العمليات Audit
 * - سجل التحديثات
 * - حالة المنصة
 * - أحداث النظام
 * - سجل الصيانة
 * - سجل Deployment
 * - حفظ بيانات العمليات بشكل دائم في PostgreSQL
 * - دعم المعاملات Transactions
 * - منع فقدان البيانات عند إعادة تشغيل السيرفر
 *
 * يعتمد على:
 * DATABASE_URL
 * PostgreSQL
 *
 * ================================================================
 */

'use strict';

const crypto = require('crypto');

/* ================================================================
 * 1. الإعدادات
 * ================================================================ */

const TABLES = {
  platformState: 'ez_platform_state',
  auditLogs: 'ez_audit_logs',
  updateHistory: 'ez_update_history',
  systemEvents: 'ez_system_events',
  maintenance: 'ez_maintenance_history',
  deployments: 'ez_deployment_history'
};

/* ================================================================
 * 2. أدوات عامة
 * ================================================================ */

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto
    .randomBytes(8)
    .toString('hex')}`;
}

function isoNow() {
  return new Date().toISOString();
}

function sanitizeLimit(value, fallback = 100, max = 500) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    Math.max(Math.floor(number), 1),
    max
  );
}

/* ================================================================
 * 3. إنشاء Repository
 * ================================================================ */

function createPlatformPersistence({
  pool,
  logger = console
} = {}) {

  if (!pool) {
    throw new Error(
      'PlatformPersistence يحتاج PostgreSQL pool.'
    );
  }

  /* ==============================================================
   * 4. تنفيذ Query
   * ============================================================== */

  async function query(text, params = []) {
    const started = Date.now();

    try {
      const result = await pool.query(
        text,
        params
      );

      if (
        logger &&
        typeof logger.debug === 'function'
      ) {
        logger.debug(
          '[EZ MEDIA] PostgreSQL query',
          {
            durationMs: Date.now() - started
          }
        );
      }

      return result;
    } catch (error) {

      if (
        logger &&
        typeof logger.error === 'function'
      ) {
        logger.error(
          '[EZ MEDIA] PostgreSQL error',
          error
        );
      }

      throw error;
    }
  }

  /* ==============================================================
   * 5. تهيئة الجداول
   * ============================================================== */

  async function initialize() {

    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.platformState} (
        id INTEGER PRIMARY KEY DEFAULT 1,
        platform_name VARCHAR(255) NOT NULL,
        platform_version VARCHAR(100) NOT NULL,
        environment VARCHAR(100),
        system_status VARCHAR(100),
        deployment_status VARCHAR(100),
        maintenance_mode BOOLEAN DEFAULT FALSE,
        update_in_progress BOOLEAN DEFAULT FALSE,
        current_update_id VARCHAR(255),
        last_update_id VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.auditLogs} (
        id VARCHAR(255) PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        actor VARCHAR(255),
        status VARCHAR(100),
        request_id VARCHAR(255),
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_audit_created_at
      ON ${TABLES.auditLogs}(created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_audit_action
      ON ${TABLES.auditLogs}(action);
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.updateHistory} (
        id VARCHAR(255) PRIMARY KEY,
        source VARCHAR(100),
        reason VARCHAR(255),
        from_version VARCHAR(100),
        target_version VARCHAR(100),
        deployed_version VARCHAR(100),
        status VARCHAR(100),
        progress INTEGER DEFAULT 0,
        started_by VARCHAR(255),
        started_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        timeout_at TIMESTAMPTZ,
        error TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_updates_started_at
      ON ${TABLES.updateHistory}(started_at DESC);
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.systemEvents} (
        id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL,
        source VARCHAR(255),
        actor VARCHAR(255),
        payload JSONB DEFAULT '{}'::jsonb,
        request_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_events_created_at
      ON ${TABLES.systemEvents}(created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS
      idx_ez_events_type
      ON ${TABLES.systemEvents}(event_type);
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.maintenance} (
        id VARCHAR(255) PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        actor VARCHAR(255),
        reason TEXT,
        request_id VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.deployments} (
        id VARCHAR(255) PRIMARY KEY,
        deployment_id VARCHAR(255),
        version VARCHAR(100),
        environment VARCHAR(100),
        status VARCHAR(100),
        source VARCHAR(255),
        commit_hash VARCHAR(255),
        actor VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await query(`
      INSERT INTO ${TABLES.platformState}
      (
        id,
        platform_name,
        platform_version,
        environment,
        system_status,
        deployment_status
      )
      VALUES
      (
        1,
        $1,
        $2,
        $3,
        'online',
        'stable'
      )
      ON CONFLICT (id)
      DO NOTHING;
    `, [
      process.env.PLATFORM_NAME || 'EZ MEDIA',
      process.env.PLATFORM_VERSION || '11.0.0',
      process.env.NODE_ENV || 'production'
    ]);

    return {
      initialized: true,
      tables: Object.values(TABLES)
    };
  }

  /* ==============================================================
   * 6. قراءة حالة المنصة
   * ============================================================== */

  async function getPlatformState() {

    const result = await query(`
      SELECT *
      FROM ${TABLES.platformState}
      WHERE id = 1
      LIMIT 1
    `);

    return result.rows[0] || null;
  }

  /* ==============================================================
   * 7. تحديث حالة المنصة
   * ============================================================== */

  async function updatePlatformState(data = {}) {

    const allowed = {
      platform_name: data.platformName,
      platform_version: data.platformVersion,
      environment: data.environment,
      system_status: data.systemStatus,
      deployment_status: data.deploymentStatus,
      maintenance_mode: data.maintenanceMode,
      update_in_progress: data.updateInProgress,
      current_update_id: data.currentUpdateId,
      last_update_id: data.lastUpdateId,
      metadata: data.metadata
    };

    const fields = [];
    const values = [];
    let index = 1;

    for (const [field, value] of Object.entries(allowed)) {

      if (typeof value === 'undefined') {
        continue;
      }

      fields.push(
        `${field} = $${index++}`
      );

      values.push(value);
    }

    if (!fields.length) {
      return getPlatformState();
    }

    fields.push(
      `updated_at = NOW()`
    );

    const result = await query(`
      UPDATE ${TABLES.platformState}
      SET ${fields.join(', ')}
      WHERE id = 1
      RETURNING *
    `, values);

    return result.rows[0] || null;
  }

  /* ==============================================================
   * 8. إضافة Audit Log
   * ============================================================== */

  async function addAuditLog({
    id = generateId('audit'),
    action,
    actor = 'system',
    status = 'success',
    requestId = null,
    details = {}
  }) {

    if (!action) {
      throw new Error(
        'Audit action مطلوب.'
      );
    }

    const result = await query(`
      INSERT INTO ${TABLES.auditLogs}
      (
        id,
        action,
        actor,
        status,
        request_id,
        details
      )
      VALUES
      ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      id,
      action,
      actor,
      status,
      requestId,
      JSON.stringify(details || {})
    ]);

    return result.rows[0];
  }

  /* ==============================================================
   * 9. قراءة Audit Logs
   * ============================================================== */

  async function getAuditLogs({
    limit = 100,
    offset = 0,
    action = null,
    actor = null
  } = {}) {

    limit = sanitizeLimit(limit);
    offset = Math.max(
      Number(offset) || 0,
      0
    );

    const conditions = [];
    const params = [];
    let index = 1;

    if (action) {
      conditions.push(
        `action = $${index++}`
      );

      params.push(action);
    }

    if (actor) {
      conditions.push(
        `actor = $${index++}`
      );

      params.push(actor);
    }

    params.push(limit);
    params.push(offset);

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await query(`
      SELECT *
      FROM ${TABLES.auditLogs}
      ${where}
      ORDER BY created_at DESC
      LIMIT $${index++}
      OFFSET $${index++}
    `, params);

    return result.rows;
  }

  /* ==============================================================
   * 10. حفظ تحديث
   * ============================================================== */

  async function saveUpdate(update) {

    if (!update || !update.id) {
      throw new Error(
        'Update ID مطلوب.'
      );
    }

    const result = await query(`
      INSERT INTO ${TABLES.updateHistory}
      (
        id,
        source,
        reason,
        from_version,
        target_version,
        deployed_version,
        status,
        progress,
        started_by,
        started_at,
        updated_at,
        completed_at,
        failed_at,
        timeout_at,
        error,
        metadata
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16
      )
      ON CONFLICT (id)
      DO UPDATE SET
        source = EXCLUDED.source,
        reason = EXCLUDED.reason,
        from_version = EXCLUDED.from_version,
        target_version = EXCLUDED.target_version,
        deployed_version = EXCLUDED.deployed_version,
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        started_by = EXCLUDED.started_by,
        started_at = EXCLUDED.started_at,
        updated_at = EXCLUDED.updated_at,
        completed_at = EXCLUDED.completed_at,
        failed_at = EXCLUDED.failed_at,
        timeout_at = EXCLUDED.timeout_at,
        error = EXCLUDED.error,
        metadata = EXCLUDED.metadata
      RETURNING *
    `, [
      update.id,
      update.source || 'internal',
      update.reason || null,
      update.fromVersion || null,
      update.targetVersion || null,
      update.deployedVersion || null,
      update.status || 'prepared',
      Number(update.progress || 0),
      update.startedBy || null,
      update.startedAt || null,
      update.updatedAt || null,
      update.completedAt || null,
      update.failedAt || null,
      update.timeoutAt || null,
      update.error || null,
      JSON.stringify(update.metadata || {})
    ]);

    return result.rows[0];
  }

  /* ==============================================================
   * 11. قراءة تحديث واحد
   * ============================================================== */

  async function getUpdate(updateId) {

    const result = await query(`
      SELECT *
      FROM ${TABLES.updateHistory}
      WHERE id = $1
      LIMIT 1
    `, [updateId]);

    return result.rows[0] || null;
  }

  /* ==============================================================
   * 12. سجل التحديثات
   * ============================================================== */

  async function getUpdates({
    limit = 100,
    offset = 0,
    status = null
  } = {}) {

    limit = sanitizeLimit(limit);

    const params = [];
    const conditions = [];

    let index = 1;

    if (status) {
      conditions.push(
        `status = $${index++}`
      );

      params.push(status);
    }

    params.push(limit);
    params.push(offset);

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await query(`
      SELECT *
      FROM ${TABLES.updateHistory}
      ${where}
      ORDER BY created_at DESC
      LIMIT $${index++}
      OFFSET $${index++}
    `, params);

    return result.rows;
  }

  /* ==============================================================
   * 13. حفظ Event
   * ============================================================== */

  async function saveEvent({
    id = generateId('event'),
    eventType,
    source = 'system',
    actor = 'system',
    payload = {},
    requestId = null
  }) {

    if (!eventType) {
      throw new Error(
        'eventType مطلوب.'
      );
    }

    const result = await query(`
      INSERT INTO ${TABLES.systemEvents}
      (
        id,
        event_type,
        source,
        actor,
        payload,
        request_id
      )
      VALUES
      ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [
      id,
      eventType,
      source,
      actor,
      JSON.stringify(payload || {}),
      requestId
    ]);

    return result.rows[0];
  }

  /* ==============================================================
   * 14. قراءة Events
   * ============================================================== */

  async function getEvents({
    limit = 100,
    offset = 0,
    eventType = null
  } = {}) {

    limit = sanitizeLimit(limit);

    const params = [];
    const conditions = [];

    let index = 1;

    if (eventType) {
      conditions.push(
        `event_type = $${index++}`
      );

      params.push(eventType);
    }

    params.push(limit);
    params.push(offset);

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await query(`
      SELECT *
      FROM ${TABLES.systemEvents}
      ${where}
      ORDER BY created_at DESC
      LIMIT $${index++}
      OFFSET $${index++}
    `, params);

    return result.rows;
  }

  /* ==============================================================
   * 15. تسجيل الصيانة
   * ============================================================== */

  async function saveMaintenance({
    action,
    actor = 'system',
    reason = null,
    requestId = null,
    metadata = {}
  }) {

    const result = await query(`
      INSERT INTO ${TABLES.maintenance}
      (
        id,
        action,
        actor,
        reason,
        request_id,
        metadata
      )
      VALUES
      ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [
      generateId('maintenance'),
      action,
      actor,
      reason,
      requestId,
      JSON.stringify(metadata || {})
    ]);

    return result.rows[0];
  }

  /* ==============================================================
   * 16. تسجيل Deployment
   * ============================================================== */

  async function saveDeployment({
    deploymentId = null,
    version = null,
    environment = process.env.NODE_ENV,
    status = 'started',
    source = 'unknown',
    commitHash = null,
    actor = 'system',
    metadata = {},
    startedAt = isoNow(),
    completedAt = null
  }) {

    const id = generateId('deploy');

    const result = await query(`
      INSERT INTO ${TABLES.deployments}
      (
        id,
        deployment_id,
        version,
        environment,
        status,
        source,
        commit_hash,
        actor,
        metadata,
        started_at,
        completed_at
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      RETURNING *
    `, [
      id,
      deploymentId,
      version,
      environment,
      status,
      source,
      commitHash,
      actor,
      JSON.stringify(metadata || {}),
      startedAt,
      completedAt
    ]);

    return result.rows[0];
  }

  /* ==============================================================
   * 17. تحديث Deployment
   * ============================================================== */

  async function updateDeployment(
    deploymentId,
    data = {}
  ) {

    if (!deploymentId) {
      throw new Error(
        'deploymentId مطلوب.'
      );
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (data.status) {
      fields.push(
        `status = $${index++}`
      );

      values.push(data.status);
    }

    if (data.version) {
      fields.push(
        `version = $${index++}`
      );

      values.push(data.version);
    }

    if (data.commitHash) {
      fields.push(
        `commit_hash = $${index++}`
      );

      values.push(data.commitHash);
    }

    if (data.completedAt) {
      fields.push(
        `completed_at = $${index++}`
      );

      values.push(data.completedAt);
    }

    if (data.metadata) {
      fields.push(
        `metadata = $${index++}`
      );

      values.push(
        JSON.stringify(data.metadata)
      );
    }

    if (!fields.length) {
      return null;
    }

    values.push(deploymentId);

    const result = await query(`
      UPDATE ${TABLES.deployments}
      SET ${fields.join(', ')}
      WHERE deployment_id = $${index}
      RETURNING *
    `, values);

    return result.rows[0] || null;
  }

  /* ==============================================================
   * 18. ملخص المنصة
   * ============================================================== */

  async function getPlatformSummary() {

    const [
      platform,
      audits,
      updates,
      events,
      deployments
    ] = await Promise.all([

      getPlatformState(),

      query(`
        SELECT COUNT(*)::INTEGER AS count
        FROM ${TABLES.auditLogs}
      `),

      query(`
        SELECT COUNT(*)::INTEGER AS count
        FROM ${TABLES.updateHistory}
      `),

      query(`
        SELECT COUNT(*)::INTEGER AS count
        FROM ${TABLES.systemEvents}
      `),

      query(`
        SELECT COUNT(*)::INTEGER AS count
        FROM ${TABLES.deployments}
      `)
    ]);

    return {
      platform,
      totals: {
        auditLogs:
          audits.rows[0]?.count || 0,

        updates:
          updates.rows[0]?.count || 0,

        events:
          events.rows[0]?.count || 0,

        deployments:
          deployments.rows[0]?.count || 0
      }
    };
  }

  /* ==============================================================
   * 19. تنظيف السجلات القديمة
   *
   * اختياري.
   * ============================================================= */

  async function cleanup({
    auditDays = 180,
    eventDays = 180,
    updateDays = 365
  } = {}) {

    const auditResult = await query(`
      DELETE FROM ${TABLES.auditLogs}
      WHERE created_at <
        NOW() - ($1::INTEGER * INTERVAL '1 day')
    `, [auditDays]);

    const eventResult = await query(`
      DELETE FROM ${TABLES.systemEvents}
      WHERE created_at <
        NOW() - ($1::INTEGER * INTERVAL '1 day')
    `, [eventDays]);

    const updateResult = await query(`
      DELETE FROM ${TABLES.updateHistory}
      WHERE created_at <
        NOW() - ($1::INTEGER * INTERVAL '1 day')
    `, [updateDays]);

    return {
      auditDeleted:
        auditResult.rowCount,

      eventsDeleted:
        eventResult.rowCount,

      updatesDeleted:
        updateResult.rowCount
    };
  }

  /* ==============================================================
   * 20. Transaction Helper
   * ============================================================== */

  async function transaction(callback) {

    const client =
      await pool.connect();

    try {

      await client.query(
        'BEGIN'
      );

      const result =
        await callback(client);

      await client.query(
        'COMMIT'
      );

      return result;

    } catch (error) {

      await client.query(
        'ROLLBACK'
      );

      throw error;

    } finally {

      client.release();

    }
  }

  /* ==============================================================
   * 21. Health
   * ============================================================== */

  async function health() {

    try {

      const result = await query(
        'SELECT NOW() AS database_time'
      );

      return {
        connected: true,
        status: 'ready',
        databaseTime:
          result.rows[0]?.database_time || null
      };

    } catch (error) {

      return {
        connected: false,
        status: 'error',
        error: error.message
      };

    }
  }

  /* ==============================================================
   * 22. Public API
   * ============================================================== */

  return {

    tables: TABLES,

    initialize,

    query,

    transaction,

    health,

    getPlatformState,

    updatePlatformState,

    addAuditLog,

    getAuditLogs,

    saveUpdate,

    getUpdate,

    getUpdates,

    saveEvent,

    getEvents,

    saveMaintenance,

    saveDeployment,

    updateDeployment,

    getPlatformSummary,

    cleanup

  };
}

/* ================================================================
 * 23. التصدير
 * ================================================================ */

module.exports = {
  createPlatformPersistence,
  TABLES
};
