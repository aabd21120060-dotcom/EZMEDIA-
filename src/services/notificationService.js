"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 40
 *
 * الملف:
 * src/services/notificationService.js
 *
 * الوظيفة:
 * الخدمة المركزية للإشعارات والتنبيهات.
 *
 * تعتمد على:
 * src/database/db.js
 * src/database/notification-init.js
 *
 * ملاحظة:
 * القنوات الخارجية مثل Web Push / Email / SMS
 * لا يتم الادعاء بأنها أُرسلت فعليًا إلا بعد ربط
 * مزود الإرسال الرسمي في مرحلة لاحقة.
 */

const { query } = require("../database/db");

/* =========================================================
   الثوابت
========================================================= */

const NOTIFICATION_TYPES = [
  "breaking",
  "live",
  "news",
  "system",
  "commercial",
  "security",
  "media",
  "ai",
  "custom"
];

const PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
  "critical"
];

const STATUSES = [
  "draft",
  "queued",
  "scheduled",
  "preparing",
  "sending",
  "sent",
  "delivered",
  "partial",
  "failed",
  "cancelled",
  "expired"
];

const CHANNELS = [
  "in_app",
  "dashboard",
  "web_push",
  "firebase",
  "apns",
  "email",
  "sms",
  "social",
  "other"
];

/* =========================================================
   أدوات عامة
========================================================= */

function normalizeNotificationType(type) {
  const value = String(
    type || "custom"
  ).trim().toLowerCase();

  return NOTIFICATION_TYPES.includes(value)
    ? value
    : "custom";
}

function normalizePriority(priority) {
  const value = String(
    priority || "normal"
  ).trim().toLowerCase();

  return PRIORITIES.includes(value)
    ? value
    : "normal";
}

function normalizeStatus(status) {
  const value = String(
    status || "queued"
  ).trim().toLowerCase();

  return STATUSES.includes(value)
    ? value
    : "queued";
}

function normalizeChannels(channels) {
  if (!Array.isArray(channels)) {
    return ["in_app"];
  }

  const valid =
    channels
      .map((channel) =>
        String(channel || "")
          .trim()
          .toLowerCase()
      )
      .filter((channel) =>
        CHANNELS.includes(channel)
      );

  return [
    ...new Set(
      valid.length
        ? valid
        : ["in_app"]
    )
  ];
}

function safeJson(value, fallback = {}) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return value;
}

function mapNotification(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    uuid: row.notification_uuid,

    type:
      row.notification_type,

    title:
      row.title,

    message:
      row.message,

    priority:
      row.priority,

    status:
      row.status,

    source:
      row.source,

    sourceId:
      row.source_id,

    contentId:
      row.content_id,

    templateId:
      row.template_id,

    audience: {
      type:
        row.audience_type,

      id:
        row.audience_id
    },

    actionUrl:
      row.action_url,

    imageUrl:
      row.image_url,

    iconUrl:
      row.icon_url,

    dedupeKey:
      row.dedupe_key,

    scheduledAt:
      row.scheduled_at,

    queuedAt:
      row.queued_at,

    processingStartedAt:
      row.processing_started_at,

    processedAt:
      row.processed_at,

    expiresAt:
      row.expires_at,

    attemptCount:
      row.attempt_count,

    maxAttempts:
      row.max_attempts,

    errorMessage:
      row.error_message,

    payload:
      row.payload || {},

    metadata:
      row.metadata || {},

    createdBy:
      row.created_by,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}

/* =========================================================
   البحث عن إشعار بواسطة ID
========================================================= */

async function getNotification(id) {
  const result = await query(
    `
      SELECT *
      FROM notifications
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return mapNotification(
    result.rows[0]
  );
}

/* =========================================================
   البحث بواسطة UUID
========================================================= */

async function getNotificationByUUID(uuid) {
  const result = await query(
    `
      SELECT *
      FROM notifications
      WHERE notification_uuid = $1
      LIMIT 1
    `,
    [uuid]
  );

  return mapNotification(
    result.rows[0]
  );
}

/* =========================================================
   البحث بمفتاح منع التكرار
========================================================= */

async function findByDedupeKey(
  dedupeKey
) {
  if (!dedupeKey) {
    return null;
  }

  const result = await query(
    `
      SELECT *
      FROM notifications
      WHERE dedupe_key = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [dedupeKey]
  );

  return mapNotification(
    result.rows[0]
  );
}

/* =========================================================
   إنشاء إشعار
========================================================= */

async function createNotification(
  input = {}
) {
  const type =
    normalizeNotificationType(
      input.type ||
      input.notificationType
    );

  const priority =
    normalizePriority(
      input.priority
    );

  const status =
    normalizeStatus(
      input.status
    );

  const title =
    String(
      input.title || ""
    ).trim();

  const message =
    String(
      input.message || ""
    ).trim();

  if (!title) {
    throw new Error(
      "Notification title is required"
    );
  }

  if (!message) {
    throw new Error(
      "Notification message is required"
    );
  }

  const dedupeKey =
    input.dedupeKey ||
    null;

  if (dedupeKey) {
    const existing =
      await findByDedupeKey(
        dedupeKey
      );

    if (existing) {
      return {
        created: false,
        duplicated: true,
        notification:
          existing
      };
    }
  }

  const result =
    await query(
      `
        INSERT INTO notifications (
          notification_type,
          title,
          message,
          priority,
          status,
          source,
          source_id,
          content_id,
          template_id,
          audience_type,
          audience_id,
          action_url,
          image_url,
          icon_url,
          dedupe_key,
          scheduled_at,
          queued_at,
          expires_at,
          max_attempts,
          payload,
          metadata,
          created_by
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
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          $20::jsonb,
          $21::jsonb,
          $22
        )
        RETURNING *
      `,
      [
        type,
        title,
        message,
        priority,
        status,
        input.source || null,
        input.sourceId || null,
        input.contentId || null,
        input.templateId || null,
        input.audienceType || "all",
        input.audienceId || null,
        input.actionUrl || null,
        input.imageUrl || null,
        input.iconUrl || null,
        dedupeKey,
        input.scheduledAt || null,
        input.queuedAt ||
          (
            status === "queued"
              ? new Date()
              : null
          ),
        input.expiresAt || null,
        Number(
          input.maxAttempts || 3
        ),
        JSON.stringify(
          safeJson(
            input.payload
          )
        ),
        JSON.stringify(
          safeJson(
            input.metadata
          )
        ),
        input.createdBy || null
      ]
    );

  const notification =
    mapNotification(
      result.rows[0]
    );

  await recordNotificationEvent({
    notificationId:
      notification.id,

    eventType:
      "notification.created",

    eventSource:
      input.source ||
      "notification_service",

    actorId:
      input.createdBy || null,

    message:
      "Notification created",

    data: {
      type,
      priority,
      status
    }
  });

  return {
    created: true,
    duplicated: false,
    notification
  };
}

/* =========================================================
   تحديث إشعار
========================================================= */

async function updateNotification(
  id,
  updates = {}
) {
  const current =
    await getNotification(id);

  if (!current) {
    return null;
  }

  const fields = [];
  const values = [];
  let index = 1;

  function addField(
    sql,
    value
  ) {
    fields.push(
      `${sql} = $${index}`
    );

    values.push(value);

    index += 1;
  }

  if (
    updates.title !== undefined
  ) {
    addField(
      "title",
      String(
        updates.title
      ).trim()
    );
  }

  if (
    updates.message !== undefined
  ) {
    addField(
      "message",
      String(
        updates.message
      ).trim()
    );
  }

  if (
    updates.type !== undefined ||
    updates.notificationType !== undefined
  ) {
    addField(
      "notification_type",
      normalizeNotificationType(
        updates.type ||
        updates.notificationType
      )
    );
  }

  if (
    updates.priority !== undefined
  ) {
    addField(
      "priority",
      normalizePriority(
        updates.priority
      )
    );
  }

  if (
    updates.status !== undefined
  ) {
    addField(
      "status",
      normalizeStatus(
        updates.status
      )
    );
  }

  if (
    updates.scheduledAt !== undefined
  ) {
    addField(
      "scheduled_at",
      updates.scheduledAt
    );
  }

  if (
    updates.actionUrl !== undefined
  ) {
    addField(
      "action_url",
      updates.actionUrl
    );
  }

  if (
    updates.imageUrl !== undefined
  ) {
    addField(
      "image_url",
      updates.imageUrl
    );
  }

  if (
    updates.iconUrl !== undefined
  ) {
    addField(
      "icon_url",
      updates.iconUrl
    );
  }

  if (
    updates.audienceType !== undefined
  ) {
    addField(
      "audience_type",
      updates.audienceType
    );
  }

  if (
    updates.audienceId !== undefined
  ) {
    addField(
      "audience_id",
      updates.audienceId
    );
  }

  if (
    updates.payload !== undefined
  ) {
    addField(
      "payload",
      JSON.stringify(
        updates.payload
      )
    );

    fields[
      fields.length - 1
    ] += "::jsonb";
  }

  if (
    updates.metadata !== undefined
  ) {
    addField(
      "metadata",
      JSON.stringify(
        updates.metadata
      )
    );

    fields[
      fields.length - 1
    ] += "::jsonb";
  }

  if (!fields.length) {
    return current;
  }

  values.push(id);

  const result =
    await query(
      `
        UPDATE notifications
        SET ${fields.join(", ")}
        WHERE id = $${index}
        RETURNING *
      `,
      values
    );

  const notification =
    mapNotification(
      result.rows[0]
    );

  await recordNotificationEvent({
    notificationId:
      id,

    eventType:
      "notification.updated",

    eventSource:
      "notification_service",

    message:
      "Notification updated",

    data:
      updates
  });

  return notification;
}

/* =========================================================
   حذف إشعار
========================================================= */

async function deleteNotification(
  id
) {
  const current =
    await getNotification(id);

  if (!current) {
    return {
      deleted: false
    };
  }

  await query(
    `
      DELETE FROM notifications
      WHERE id = $1
    `,
    [id]
  );

  await recordNotificationEvent({
    eventType:
      "notification.deleted",

    eventSource:
      "notification_service",

    message:
      "Notification deleted",

    data: {
      notificationId:
        id
    }
  });

  return {
    deleted: true,
    id
  };
}

/* =========================================================
   إنشاء عمليات التسليم
========================================================= */

async function createDeliveries(
  notificationId,
  options = {}
) {
  const notification =
    await getNotification(
      notificationId
    );

  if (!notification) {
    throw new Error(
      "Notification not found"
    );
  }

  const channels =
    normalizeChannels(
      options.channels
    );

  const recipients =
    Array.isArray(
      options.recipients
    )
      ? options.recipients
      : [{}];

  const created = [];

  for (
    const channel of channels
  ) {
    for (
      const recipient of recipients
    ) {
      const result =
        await query(
          `
            INSERT INTO notification_deliveries (
              notification_id,
              channel,
              provider,
              recipient_id,
              recipient_address,
              device_id,
              status,
              max_attempts,
              queued_at,
              metadata
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              'queued',
              $7,
              NOW(),
              $8::jsonb
            )
            RETURNING *
          `,
          [
            notificationId,
            channel,
            recipient.provider ||
              null,
            recipient.recipientId ||
              null,
            recipient.address ||
              null,
            recipient.deviceId ||
              null,
            Number(
              options.maxAttempts ||
              3
            ),
            JSON.stringify(
              recipient.metadata ||
              {}
            )
          ]
        );

      created.push(
        result.rows[0]
      );
    }
  }

  await recordNotificationEvent({
    notificationId,

    eventType:
      "notification.deliveries.created",

    eventSource:
      "notification_service",

    message:
      "Notification deliveries created",

    data: {
      channels,
      count:
        created.length
    }
  });

  return created;
}

/* =========================================================
   تجهيز الإشعار للإرسال
========================================================= */

async function prepareNotification(
  id,
  options = {}
) {
  const notification =
    await getNotification(id);

  if (!notification) {
    return null;
  }

  if (
    notification.status ===
      "cancelled" ||
    notification.status ===
      "expired"
  ) {
    return notification;
  }

  await updateNotification(
    id,
    {
      status:
        "preparing"
    }
  );

  const deliveries =
    await createDeliveries(
      id,
      options
    );

  await updateNotification(
    id,
    {
      status:
        "sending"
    }
  );

  await recordNotificationEvent({
    notificationId:
      id,

    eventType:
      "notification.prepared",

    eventSource:
      "notification_service",

    message:
      "Notification prepared for delivery",

    data: {
      deliveryCount:
        deliveries.length
    }
  });

  return {
    notification:
      await getNotification(id),

    deliveries
  };
}

/* =========================================================
   معالجة التسليم
========================================================= */

async function processDelivery(
  deliveryId
) {
  const result =
    await query(
      `
        SELECT
          nd.*,
          n.notification_type,
          n.title,
          n.message,
          n.payload,
          n.metadata AS notification_metadata
        FROM notification_deliveries nd

        INNER JOIN notifications n
          ON n.id = nd.notification_id

        WHERE nd.id = $1

        LIMIT 1
      `,
      [deliveryId]
    );

  const delivery =
    result.rows[0];

  if (!delivery) {
    return null;
  }

  if (
    delivery.status ===
      "cancelled" ||
    delivery.status ===
      "expired" ||
    delivery.status ===
      "delivered"
  ) {
    return delivery;
  }

  await query(
    `
      UPDATE notification_deliveries
      SET
        status = 'sending',
        sending_at = NOW(),
        attempt_count =
          attempt_count + 1
      WHERE id = $1
    `,
    [deliveryId]
  );

  /*
   * لا يتم هنا الاتصال بمزود خارجي.
   *
   * هذه المرحلة فقط تنقل العملية إلى حالة
   * sending وتجعلها جاهزة لمزود حقيقي.
   */

  await recordNotificationEvent({
    notificationId:
      delivery.notification_id,

    deliveryId,

    eventType:
      "delivery.processing",

    eventSource:
      "notification_service",

    message:
      "Delivery processing started",

    data: {
      channel:
        delivery.channel,

      provider:
        delivery.provider || null
    }
  });

  return {
    id:
      delivery.id,

    notificationId:
      delivery.notification_id,

    channel:
      delivery.channel,

    provider:
      delivery.provider,

    status:
      "sending",

    externalProviderRequired:
      ![
        "in_app",
        "dashboard"
      ].includes(
        delivery.channel
      )
  };
}

/* =========================================================
   تعليم التسليم كمُرسل
========================================================= */

async function markDeliverySent(
  deliveryId,
  providerMessageId = null,
  response = {}
) {
  const result =
    await query(
      `
        UPDATE notification_deliveries
        SET
          status = 'sent',
          sent_at = NOW(),
          provider_message_id = $2,
          response = $3::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        deliveryId,
        providerMessageId,
        JSON.stringify(
          response
        )
      ]
    );

  if (!result.rows[0]) {
    return null;
  }

  const delivery =
    result.rows[0];

  await recordNotificationEvent({
    notificationId:
      delivery.notification_id,

    deliveryId,

    eventType:
      "delivery.sent",

    eventSource:
      "notification_service",

    message:
      "Delivery marked as sent",

    data: {
      providerMessageId
    }
  });

  await refreshNotificationStatus(
    delivery.notification_id
  );

  return delivery;
}

/* =========================================================
   تعليم التسليم كمُسلّم فعليًا
========================================================= */

async function markDeliveryDelivered(
  deliveryId,
  response = {}
) {
  const result =
    await query(
      `
        UPDATE notification_deliveries
        SET
          status = 'delivered',
          delivered_at = NOW(),
          response = $2::jsonb
        WHERE id = $1
        RETURNING *
      `,
      [
        deliveryId,
        JSON.stringify(
          response
        )
      ]
    );

  if (!result.rows[0]) {
    return null;
  }

  const delivery =
    result.rows[0];

  await recordNotificationEvent({
    notificationId:
      delivery.notification_id,

    deliveryId,

    eventType:
      "delivery.delivered",

    eventSource:
      "notification_service",

    message:
      "Delivery marked as delivered",

    data: {}
  });

  await refreshNotificationStatus(
    delivery.notification_id
  );

  return delivery;
}

/* =========================================================
   فشل التسليم
========================================================= */

async function markDeliveryFailed(
  deliveryId,
  errorCode = null,
  errorMessage = null
) {
  const result =
    await query(
      `
        UPDATE notification_deliveries
        SET
          status = 'failed',
          failed_at = NOW(),
          error_code = $2,
          error_message = $3
        WHERE id = $1
        RETURNING *
      `,
      [
        deliveryId,
        errorCode,
        errorMessage
      ]
    );

  if (!result.rows[0]) {
    return null;
  }

  const delivery =
    result.rows[0];

  await recordNotificationEvent({
    notificationId:
      delivery.notification_id,

    deliveryId,

    eventType:
      "delivery.failed",

    eventSource:
      "notification_service",

    message:
      errorMessage ||
      "Delivery failed",

    data: {
      errorCode
    }
  });

  await refreshNotificationStatus(
    delivery.notification_id
  );

  return delivery;
}

/* =========================================================
   تحديث حالة الإشعار حسب عمليات التسليم
========================================================= */

async function refreshNotificationStatus(
  notificationId
) {
  const result =
    await query(
      `
        SELECT
          COUNT(*)::INTEGER AS total,

          COUNT(*) FILTER (
            WHERE status = 'queued'
          )::INTEGER AS queued,

          COUNT(*) FILTER (
            WHERE status = 'sending'
          )::INTEGER AS sending,

          COUNT(*) FILTER (
            WHERE status = 'sent'
          )::INTEGER AS sent,

          COUNT(*) FILTER (
            WHERE status = 'delivered'
          )::INTEGER AS delivered,

          COUNT(*) FILTER (
            WHERE status = 'failed'
          )::INTEGER AS failed

        FROM notification_deliveries

        WHERE notification_id = $1
      `,
      [notificationId]
    );

  const stats =
    result.rows[0];

  let status =
    "queued";

  const total =
    Number(
      stats.total || 0
    );

  const queued =
    Number(
      stats.queued || 0
    );

  const sending =
    Number(
      stats.sending || 0
    );

  const sent =
    Number(
      stats.sent || 0
    );

  const delivered =
    Number(
      stats.delivered || 0
    );

  const failed =
    Number(
      stats.failed || 0
    );

  if (total === 0) {
    status =
      "queued";
  } else if (
    delivered === total
  ) {
    status =
      "delivered";
  } else if (
    failed === total
  ) {
    status =
      "failed";
  } else if (
    delivered > 0 ||
    sent > 0
  ) {
    status =
      "partial";
  } else if (
    sending > 0
  ) {
    status =
      "sending";
  } else if (
    queued === total
  ) {
    status =
      "queued";
  }

  await query(
    `
      UPDATE notifications
      SET
        status = $2,
        processed_at =
          CASE
            WHEN $2 IN (
              'delivered',
              'failed'
            )
            THEN NOW()
            ELSE processed_at
          END
      WHERE id = $1
    `,
    [
      notificationId,
      status
    ]
  );

  return {
    notificationId,
    status,
    deliveries: {
      total,
      queued,
      sending,
      sent,
      delivered,
      failed
    }
  };
}

/* =========================================================
   إلغاء إشعار
========================================================= */

async function cancelNotification(
  id
) {
  const result =
    await query(
      `
        UPDATE notifications
        SET
          status = 'cancelled',
          processed_at = NOW()
        WHERE id = $1
        AND status NOT IN (
          'delivered',
          'cancelled',
          'expired'
        )
        RETURNING *
      `,
      [id]
    );

  if (!result.rows[0]) {
    return null;
  }

  await query(
    `
      UPDATE notification_deliveries
      SET
        status = 'cancelled'
      WHERE notification_id = $1
      AND status IN (
        'queued',
        'preparing',
        'sending'
      )
    `,
    [id]
  );

  await recordNotificationEvent({
    notificationId:
      id,

    eventType:
      "notification.cancelled",

    eventSource:
      "notification_service",

    message:
      "Notification cancelled",

    data: {}
  });

  return mapNotification(
    result.rows[0]
  );
}

/* =========================================================
   تسجيل حدث
========================================================= */

async function recordNotificationEvent(
  input = {}
) {
  const result =
    await query(
      `
        INSERT INTO notification_events (
          notification_id,
          delivery_id,
          event_type,
          event_source,
          actor_id,
          message,
          data,
          ip_address,
          user_agent
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8,
          $9
        )
        RETURNING *
      `,
      [
        input.notificationId ||
          null,

        input.deliveryId ||
          null,

        input.eventType ||
          "notification.event",

        input.eventSource ||
          "notification_service",

        input.actorId ||
          null,

        input.message ||
          null,

        JSON.stringify(
          input.data || {}
        ),

        input.ipAddress ||
          null,

        input.userAgent ||
          null
      ]
    );

  return result.rows[0];
}

/* =========================================================
   جلب الإشعارات
========================================================= */

async function listNotifications(
  options = {}
) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (options.type) {
    conditions.push(
      `notification_type = $${index}`
    );

    values.push(
      normalizeNotificationType(
        options.type
      )
    );

    index += 1;
  }

  if (options.status) {
    conditions.push(
      `status = $${index}`
    );

    values.push(
      normalizeStatus(
        options.status
      )
    );

    index += 1;
  }

  if (options.priority) {
    conditions.push(
      `priority = $${index}`
    );

    values.push(
      normalizePriority(
        options.priority
      )
    );

    index += 1;
  }

  if (options.source) {
    conditions.push(
      `source = $${index}`
    );

    values.push(
      options.source
    );

    index += 1;
  }

  if (options.audienceType) {
    conditions.push(
      `audience_type = $${index}`
    );

    values.push(
      options.audienceType
    );

    index += 1;
  }

  if (options.audienceId) {
    conditions.push(
      `audience_id = $${index}`
    );

    values.push(
      options.audienceId
    );

    index += 1;
  }

  if (options.search) {
    conditions.push(`
      (
        title ILIKE $${index}
        OR
        message ILIKE $${index}
      )
    `);

    values.push(
      `%${options.search}%`
    );

    index += 1;
  }

  if (options.from) {
    conditions.push(
      `created_at >= $${index}`
    );

    values.push(
      options.from
    );

    index += 1;
  }

  if (options.to) {
    conditions.push(
      `created_at <= $${index}`
    );

    values.push(
      options.to
    );

    index += 1;
  }

  const limit =
    Math.min(
      Math.max(
        Number(
          options.limit || 50
        ),
        1
      ),
      200
    );

  const offset =
    Math.max(
      Number(
        options.offset || 0
      ),
      0
    );

  const where =
    conditions.length
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  values.push(
    limit
  );

  const limitIndex =
    index;

  index += 1;

  values.push(
    offset
  );

  const offsetIndex =
    index;

  const result =
    await query(
      `
        SELECT *
        FROM notifications

        ${where}

        ORDER BY
          created_at DESC

        LIMIT
          $${limitIndex}

        OFFSET
          $${offsetIndex}
      `,
      values
    );

  const countResult =
    await query(
      `
        SELECT
          COUNT(*)::BIGINT AS total

        FROM notifications

        ${where}
      `,
      values.slice(
        0,
        values.length - 2
      )
    );

  return {
    items:
      result.rows.map(
        mapNotification
      ),

    total:
      Number(
        countResult.rows[0]?.total ||
        0
      ),

    limit,

    offset
  };
}

/* =========================================================
   الإحصائيات
========================================================= */

async function getStatistics() {
  const summary =
    await query(`
      SELECT *
      FROM notification_statistics
    `);

  const channels =
    await query(`
      SELECT *
      FROM notification_delivery_statistics
      ORDER BY channel
    `);

  return {
    summary:
      summary.rows[0] || {},

    channels:
      channels.rows || []
  };
}

/* =========================================================
   معالجة الأحداث الذكية
========================================================= */

async function processEvent(
  event = {}
) {
  const eventType =
    String(
      event.type ||
      event.eventType ||
      ""
    ).trim();

  if (!eventType) {
    throw new Error(
      "Event type is required"
    );
  }

  const source =
    event.source ||
    event.eventSource ||
    null;

  const rulesResult =
    await query(
      `
        SELECT *
        FROM notification_rules
        WHERE event_type = $1
        AND is_active = TRUE
        AND (
          source IS NULL
          OR source = $2
        )
        ORDER BY
          priority DESC,
          id ASC
      `,
      [
        eventType,
        source
      ]
    );

  const executions = [];

  for (
    const rule
    of rulesResult.rows
  ) {
    const action =
      rule.action || {};

    if (
      action.createNotification ===
      false
    ) {
      continue;
    }

    const templateKey =
      action.template ||
      null;

    let template =
      null;

    if (templateKey) {
      const templateResult =
        await query(
          `
            SELECT *
            FROM notification_templates
            WHERE template_key = $1
            AND is_active = TRUE
            LIMIT 1
          `,
          [templateKey]
        );

      template =
        templateResult.rows[0] ||
        null;
    }

    if (!template) {
      continue;
    }

    const payload =
      event.payload ||
      event.data ||
      {};

    const title =
      renderTemplate(
        template.title_template,
        payload
      );

    const message =
      renderTemplate(
        template.message_template,
        payload
      );

    const dedupeKey =
      buildDedupeKey(
        rule,
        event,
        payload
      );

    const created =
      await createNotification({
        type:
          template.notification_type,

        title,

        message,

        priority:
          rule.priority ||
          template.default_priority,

        source,

        sourceId:
          event.sourceId ||
          null,

        contentId:
          event.contentId ||
          payload.content_id ||
          null,

        templateId:
          template.id,

        audienceType:
          rule.audience?.type ||
          "all",

        audienceId:
          rule.audience?.id ||
          null,

        actionUrl:
          payload.action_url ||
          payload.url ||
          null,

        imageUrl:
          payload.image_url ||
          null,

        payload,

        metadata: {
          ruleId:
            rule.id,

          ruleKey:
            rule.rule_key,

          eventType
        },

        dedupeKey
      });

    executions.push({
      ruleId:
        rule.id,

      ruleKey:
        rule.rule_key,

      notification:
        created.notification,

      duplicated:
        created.duplicated
    });

    await query(
      `
        UPDATE notification_rules
        SET
          execution_count =
            execution_count + 1,

          last_executed_at =
            NOW()

        WHERE id = $1
      `,
      [rule.id]
    );
  }

  return {
    eventType,

    source,

    rulesMatched:
      rulesResult.rows.length,

    executions
  };
}

/* =========================================================
   القوالب
========================================================= */

function renderTemplate(
  template,
  data
) {
  if (!template) {
    return "";
  }

  return String(
    template
  ).replace(
    /\{\{\s*([^}]+)\s*\}\}/g,
    (match, key) => {
      const value =
        resolvePath(
          data,
          String(key).trim()
        );

      if (
        value === undefined ||
        value === null
      ) {
        return "";
      }

      return String(
        value
      );
    }
  );
}

function resolvePath(
  object,
  path
) {
  return path
    .split(".")
    .reduce(
      (current, key) => {
        if (
          current === undefined ||
          current === null
        ) {
          return undefined;
        }

        return current[key];
      },
      object
    );
}

/* =========================================================
   مفتاح منع التكرار
========================================================= */

function buildDedupeKey(
  rule,
  event,
  payload
) {
  const explicit =
    event.dedupeKey ||
    payload.dedupe_key ||
    null;

  if (explicit) {
    return explicit;
  }

  const sourceId =
    event.sourceId ||
    payload.id ||
    payload.content_id ||
    "none";

  return [
    "rule",
    rule.rule_key,
    "event",
    event.type ||
      event.eventType,
    "source",
    sourceId
  ].join(":");
}

/* =========================================================
   تصدير الخدمة
========================================================= */

module.exports = {
  createNotification,

  getNotification,

  getNotificationByUUID,

  findByDedupeKey,

  updateNotification,

  deleteNotification,

  createDeliveries,

  prepareNotification,

  processDelivery,

  markDeliverySent,

  markDeliveryDelivered,

  markDeliveryFailed,

  refreshNotificationStatus,

  cancelNotification,

  recordNotificationEvent,

  listNotifications,

  getStatistics,

  processEvent,

  renderTemplate,

  buildDedupeKey
};
