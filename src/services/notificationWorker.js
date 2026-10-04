"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Worker
 *
 * الكود رقم 42
 *
 * محرك معالجة الإشعارات المركزي.
 *
 * المسؤوليات:
 * 1. البحث عن الإشعارات التي تحتاج معالجة.
 * 2. تجهيز عمليات التسليم.
 * 3. معالجة كل Delivery.
 * 4. تحديث حالة الإشعار.
 * 5. تسجيل الأحداث.
 * 6. منع التكرار.
 * 7. دعم التشغيل الدوري.
 *
 * ملاحظة:
 * الإرسال الخارجي الحقيقي Push / Email / SMS / Social
 * لا يتم ادعاؤه هنا قبل ربط مزود رسمي.
 */

const {
  query
} = require("../database/db");

const {
  prepareNotification,
  createDeliveries,
  processDelivery,
  refreshNotificationStatus,
  recordNotificationEvent
} = require("./notificationService");

const DEFAULT_INTERVAL_MS = Number(
  process.env.NOTIFICATION_WORKER_INTERVAL_MS || 15000
);

const DEFAULT_BATCH_SIZE = Number(
  process.env.NOTIFICATION_WORKER_BATCH_SIZE || 25
);

const LOCK_TIMEOUT_MINUTES = Number(
  process.env.NOTIFICATION_WORKER_LOCK_TIMEOUT_MINUTES || 10
);

let workerTimer = null;
let workerRunning = false;
let workerStarted = false;

const workerState = {
  started: false,
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  processed: 0,
  failed: 0,
  cycles: 0
};

function nowISO() {
  return new Date().toISOString();
}

function normalizeLimit(value, fallback = DEFAULT_BATCH_SIZE) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(number), 100);
}

function normalizeInterval(value, fallback = DEFAULT_INTERVAL_MS) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 1000) {
    return fallback;
  }

  return Math.max(Math.floor(number), 1000);
}

function getWorkerState() {
  return {
    ...workerState,
    started: workerStarted,
    running: workerRunning,
    intervalMs: normalizeInterval(DEFAULT_INTERVAL_MS),
    batchSize: normalizeLimit(DEFAULT_BATCH_SIZE),
    timestamp: nowISO()
  };
}

/**
 * استعادة الإشعارات التي علقت أثناء معالجة سابقة.
 */
async function recoverStaleNotifications() {
  const result = await query(
    `
      UPDATE notifications
      SET
        status = 'queued',
        updated_at = NOW()
      WHERE
        status = 'processing'
        AND updated_at < NOW() - ($1 * INTERVAL '1 minute')
      RETURNING id, uuid
    `,
    [LOCK_TIMEOUT_MINUTES]
  );

  return result.rows;
}

/**
 * جلب الإشعارات التي تحتاج معالجة.
 */
async function getPendingNotifications(limit = DEFAULT_BATCH_SIZE) {
  const safeLimit = normalizeLimit(limit);

  const result = await query(
    `
      SELECT
        id,
        uuid,
        type,
        priority,
        title,
        body,
        status,
        channels,
        audience,
        data,
        dedupe_key,
        scheduled_at,
        created_at,
        updated_at
      FROM notifications
      WHERE
        status IN ('queued', 'pending', 'prepared')
        AND (
          scheduled_at IS NULL
          OR scheduled_at <= NOW()
        )
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'urgent' THEN 2
          WHEN 'high' THEN 3
          WHEN 'normal' THEN 4
          WHEN 'low' THEN 5
          ELSE 6
        END,
        created_at ASC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

/**
 * قفل إشعار لمعالجته.
 *
 * نستخدم تحديثًا مشروطًا حتى لا تعالجه أكثر من دورة
 * في الوقت نفسه.
 */
async function claimNotification(id) {
  const result = await query(
    `
      UPDATE notifications
      SET
        status = 'processing',
        updated_at = NOW()
      WHERE
        id = $1
        AND status IN ('queued', 'pending', 'prepared')
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * معالجة إشعار واحد.
 */
async function processNotification(notification) {
  if (!notification || !notification.id) {
    return {
      success: false,
      skipped: true,
      reason: "INVALID_NOTIFICATION"
    };
  }

  const claimed = await claimNotification(notification.id);

  if (!claimed) {
    return {
      success: false,
      skipped: true,
      reason: "ALREADY_CLAIMED",
      notificationId: notification.id
    };
  }

  try {
    let prepared = claimed;

    /**
     * تجهيز الإشعار إذا لم يكن مجهزًا.
     */
    if (claimed.status === "processing") {
      prepared = await prepareNotification(claimed.id);
    }

    /**
     * إنشاء عمليات التسليم.
     *
     * الخدمة نفسها مسؤولة عن منع التكرار حسب قواعدها.
     */
    let deliveries = [];

    try {
      const created = await createDeliveries(prepared.id);

      if (Array.isArray(created)) {
        deliveries = created;
      } else if (created && Array.isArray(created.rows)) {
        deliveries = created.rows;
      }
    } catch (deliveryCreationError) {
      /**
       * قد تكون عمليات التسليم موجودة مسبقًا.
       * لذلك نحاول قراءتها بدل اعتبار الإشعار فاشلًا مباشرة.
       */
      const existing = await query(
        `
          SELECT *
          FROM notification_deliveries
          WHERE notification_id = $1
          ORDER BY created_at ASC
        `,
        [prepared.id]
      );

      deliveries = existing.rows;

      if (!deliveries.length) {
        throw deliveryCreationError;
      }
    }

    /**
     * إذا لم توجد Delivery، نعيد فحص الحالة.
     */
    if (!deliveries.length) {
      await refreshNotificationStatus(prepared.id);

      await recordNotificationEvent(
        prepared.id,
        "worker_no_deliveries",
        {
          worker: "notificationWorker",
          timestamp: nowISO()
        }
      );

      return {
        success: true,
        notificationId: prepared.id,
        deliveries: 0
      };
    }

    let deliveryProcessed = 0;
    let deliveryFailed = 0;

    /**
     * معالجة عمليات التسليم واحدة واحدة.
     */
    for (const delivery of deliveries) {
      try {
        if (!delivery || !delivery.id) {
          continue;
        }

        /**
         * لا نعيد معالجة العمليات النهائية.
         */
        if (
          ["sent", "delivered", "cancelled"].includes(
            String(delivery.status || "").toLowerCase()
          )
        ) {
          continue;
        }

        await processDelivery(delivery.id);

        deliveryProcessed += 1;
      } catch (error) {
        deliveryFailed += 1;

        await recordNotificationEvent(
          prepared.id,
          "worker_delivery_failed",
          {
            deliveryId: delivery.id,
            error: error.message,
            timestamp: nowISO()
          }
        );
      }
    }

    await refreshNotificationStatus(prepared.id);

    await recordNotificationEvent(
      prepared.id,
      "worker_processed",
      {
        deliveriesProcessed: deliveryProcessed,
        deliveriesFailed: deliveryFailed,
        timestamp: nowISO()
      }
    );

    return {
      success: deliveryFailed === 0,
      notificationId: prepared.id,
      deliveries: deliveries.length,
      processed: deliveryProcessed,
      failed: deliveryFailed
    };
  } catch (error) {
    /**
     * تسجيل فشل المعالجة.
     */
    try {
      await query(
        `
          UPDATE notifications
          SET
            status = 'failed',
            error_message = $2,
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          claimed.id,
          String(error.message || "Notification processing failed").slice(
            0,
            4000
          )
        ]
      );
    } catch (statusError) {
      console.error(
        "EZ MEDIA notification status update error:",
        statusError
      );
    }

    try {
      await recordNotificationEvent(
        claimed.id,
        "worker_failed",
        {
          error: error.message,
          timestamp: nowISO()
        }
      );
    } catch (eventError) {
      console.error(
        "EZ MEDIA notification event error:",
        eventError
      );
    }

    throw error;
  }
}

/**
 * دورة Worker واحدة.
 */
async function runNotificationWorkerOnce(options = {}) {
  if (workerRunning) {
    return {
      success: false,
      skipped: true,
      reason: "WORKER_ALREADY_RUNNING",
      state: getWorkerState()
    };
  }

  workerRunning = true;

  workerState.running = true;
  workerState.cycles += 1;
  workerState.lastRunAt = nowISO();

  try {
    /**
     * استعادة أي إشعارات عالقة.
     */
    await recoverStaleNotifications();

    const notifications = await getPendingNotifications(
      options.batchSize || DEFAULT_BATCH_SIZE
    );

    const results = [];

    for (const notification of notifications) {
      try {
        const result = await processNotification(notification);

        results.push(result);

        if (result.success) {
          workerState.processed += 1;
        } else if (!result.skipped) {
          workerState.failed += 1;
        }
      } catch (error) {
        workerState.failed += 1;

        results.push({
          success: false,
          notificationId: notification.id,
          error: error.message
        });
      }
    }

    workerState.lastSuccessAt = nowISO();
    workerState.lastError = null;

    return {
      success: true,
      processedCount: results.filter(
        (item) => item && item.success
      ).length,
      failedCount: results.filter(
        (item) => item && item.success === false && !item.skipped
      ).length,
      skippedCount: results.filter(
        (item) => item && item.skipped
      ).length,
      results,
      state: getWorkerState()
    };
  } catch (error) {
    workerState.lastErrorAt = nowISO();
    workerState.lastError = error.message;

    console.error(
      "EZ MEDIA Notification Worker error:",
      error
    );

    return {
      success: false,
      error: error.message,
      state: getWorkerState()
    };
  } finally {
    workerRunning = false;
    workerState.running = false;
  }
}

/**
 * بدء Worker دوري.
 */
function startNotificationWorker(options = {}) {
  if (workerStarted) {
    return getWorkerState();
  }

  const intervalMs = normalizeInterval(
    options.intervalMs || DEFAULT_INTERVAL_MS
  );

  workerStarted = true;

  workerState.started = true;

  /**
   * تشغيل دورة أولى مباشرة.
   */
  runNotificationWorkerOnce({
    batchSize:
      options.batchSize || DEFAULT_BATCH_SIZE
  }).catch((error) => {
    console.error(
      "EZ MEDIA initial notification worker cycle error:",
      error
    );
  });

  /**
   * التشغيل الدوري.
   */
  workerTimer = setInterval(() => {
    runNotificationWorkerOnce({
      batchSize:
        options.batchSize || DEFAULT_BATCH_SIZE
    }).catch((error) => {
      console.error(
        "EZ MEDIA scheduled notification worker error:",
        error
      );
    });
  }, intervalMs);

  /**
   * لا يمنع Node.js من الإغلاق الطبيعي.
   */
  if (
    workerTimer &&
    typeof workerTimer.unref === "function"
  ) {
    workerTimer.unref();
  }

  console.log(
    `EZ MEDIA Notification Worker started. Interval: ${intervalMs}ms`
  );

  return getWorkerState();
}

/**
 * إيقاف Worker.
 */
function stopNotificationWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }

  workerStarted = false;
  workerRunning = false;

  workerState.started = false;
  workerState.running = false;

  console.log(
    "EZ MEDIA Notification Worker stopped."
  );

  return getWorkerState();
}

/**
 * إعادة تشغيل Worker.
 */
function restartNotificationWorker(options = {}) {
  stopNotificationWorker();

  return startNotificationWorker(options);
}

/**
 * فحص صحة Worker.
 */
async function notificationWorkerHealth() {
  let database = {
    configured: false,
    connected: false
  };

  try {
    const result = await query(
      `
        SELECT
          current_database() AS database_name,
          NOW() AS server_time
      `
    );

    database = {
      configured: true,
      connected: true,
      databaseName: result.rows[0].database_name,
      serverTime: result.rows[0].server_time
    };
  } catch (error) {
    database = {
      configured: Boolean(process.env.DATABASE_URL),
      connected: false,
      error: error.message
    };
  }

  return {
    service: "notificationWorker",
    status:
      database.connected && workerStarted
        ? "online"
        : database.connected
          ? "ready"
          : "database_unavailable",
    database,
    worker: getWorkerState(),
    timestamp: nowISO()
  };
}

/**
 * تشغيل Worker عند الطلب.
 */
async function triggerNotificationWorker(options = {}) {
  return runNotificationWorkerOnce(options);
}

/**
 * إغلاق آمن.
 */
function registerNotificationWorkerShutdown() {
  const shutdown = () => {
    stopNotificationWorker();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return true;
}

module.exports = {
  getWorkerState,
  getPendingNotifications,
  recoverStaleNotifications,
  claimNotification,
  processNotification,
  runNotificationWorkerOnce,
  startNotificationWorker,
  stopNotificationWorker,
  restartNotificationWorker,
  notificationWorkerHealth,
  triggerNotificationWorker,
  registerNotificationWorkerShutdown
};
