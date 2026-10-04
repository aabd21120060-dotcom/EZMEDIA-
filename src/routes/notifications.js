"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 41
 *
 * الملف:
 * src/routes/notifications.js
 *
 * الوظيفة:
 * API المركزي للإشعارات والتنبيهات.
 *
 * يعتمد على:
 * src/services/notificationService.js
 */

const express = require("express");

const {
  createNotification,
  getNotification,
  getNotificationByUUID,
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
  processEvent
} = require("../services/notificationService");

const router = express.Router();

/* =========================================================
   أدوات مساعدة
========================================================= */

function numberOrNull(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getRequestUserId(req) {
  return (
    req.user?.id ||
    req.admin?.id ||
    req.auth?.user?.id ||
    null
  );
}

function getRequestIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    null
  );
}

function getUserAgent(req) {
  return (
    req.headers["user-agent"] ||
    null
  );
}

function asyncRoute(handler) {
  return async (
    req,
    res,
    next
  ) => {
    try {
      await handler(
        req,
        res,
        next
      );
    } catch (error) {
      next(error);
    }
  };
}

/* =========================================================
   معلومات API
========================================================= */

router.get(
  "/",
  asyncRoute(
    async (req, res) => {
      const statistics =
        await getStatistics();

      res.json({
        success: true,

        service:
          "EZ MEDIA Notification API",

        version:
          "11.0.0",

        status:
          "online",

        endpoints: {
          list:
            "/api/notifications",

          create:
            "POST /api/notifications",

          get:
            "GET /api/notifications/:id",

          update:
            "PATCH /api/notifications/:id",

          delete:
            "DELETE /api/notifications/:id",

          prepare:
            "POST /api/notifications/:id/prepare",

          cancel:
            "POST /api/notifications/:id/cancel",

          deliveries:
            "POST /api/notifications/:id/deliveries",

          event:
            "POST /api/notifications/events",

          statistics:
            "/api/notifications/statistics"
        },

        statistics
      });
    }
  )
);

/* =========================================================
   الإحصائيات
========================================================= */

router.get(
  "/statistics",
  asyncRoute(
    async (req, res) => {
      const statistics =
        await getStatistics();

      res.json({
        success: true,
        data: statistics
      });
    }
  )
);

/* =========================================================
   قائمة الإشعارات
========================================================= */

router.get(
  "/list",
  asyncRoute(
    async (req, res) => {
      const result =
        await listNotifications({
          type:
            req.query.type,

          status:
            req.query.status,

          priority:
            req.query.priority,

          source:
            req.query.source,

          audienceType:
            req.query.audienceType,

          audienceId:
            req.query.audienceId,

          search:
            req.query.search,

          from:
            req.query.from,

          to:
            req.query.to,

          limit:
            req.query.limit,

          offset:
            req.query.offset
        });

      res.json({
        success: true,
        ...result
      });
    }
  )
);

/* =========================================================
   إنشاء إشعار
========================================================= */

router.post(
  "/",
  asyncRoute(
    async (req, res) => {
      const body =
        req.body || {};

      const result =
        await createNotification({
          ...body,

          createdBy:
            body.createdBy ||
            getRequestUserId(req)
        });

      res.status(
        result.created
          ? 201
          : 200
      );

      res.json({
        success: true,

        created:
          result.created,

        duplicated:
          result.duplicated,

        data:
          result.notification
      });
    }
  )
);

/* =========================================================
   معالجة حدث ذكي
========================================================= */

router.post(
  "/events",
  asyncRoute(
    async (req, res) => {
      const body =
        req.body || {};

      const result =
        await processEvent({
          ...body,

          actorId:
            body.actorId ||
            getRequestUserId(req)
        });

      res.status(201);

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   تسجيل حدث يدوي
========================================================= */

router.post(
  "/events/log",
  asyncRoute(
    async (req, res) => {
      const body =
        req.body || {};

      const result =
        await recordNotificationEvent({
          notificationId:
            body.notificationId ||
            null,

          deliveryId:
            body.deliveryId ||
            null,

          eventType:
            body.eventType ||
            "notification.manual_event",

          eventSource:
            body.eventSource ||
            "api",

          actorId:
            body.actorId ||
            getRequestUserId(req),

          message:
            body.message ||
            null,

          data:
            body.data ||
            {},

          ipAddress:
            getRequestIp(req),

          userAgent:
            getUserAgent(req)
        });

      res.status(201);

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   جلب إشعار بالـ UUID
========================================================= */

router.get(
  "/uuid/:uuid",
  asyncRoute(
    async (req, res) => {
      const notification =
        await getNotificationByUUID(
          req.params.uuid
        );

      if (!notification) {
        return res.status(404).json({
          success: false,

          error:
            "NOTIFICATION_NOT_FOUND",

          message:
            "الإشعار غير موجود"
        });
      }

      res.json({
        success: true,
        data: notification
      });
    }
  )
);

/* =========================================================
   جلب إشعار
========================================================= */

router.get(
  "/:id",
  asyncRoute(
    async (req, res) => {
      const id =
        numberOrNull(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_NOTIFICATION_ID",

          message:
            "معرف الإشعار غير صحيح"
        });
      }

      const notification =
        await getNotification(id);

      if (!notification) {
        return res.status(404).json({
          success: false,

          error:
            "NOTIFICATION_NOT_FOUND",

          message:
            "الإشعار غير موجود"
        });
      }

      res.json({
        success: true,
        data: notification
      });
    }
  )
);

/* =========================================================
   تعديل إشعار
========================================================= */

router.patch(
  "/:id",
  asyncRoute(
    async (req, res) => {
      const id =
        numberOrNull(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_NOTIFICATION_ID",

          message:
            "معرف الإشعار غير صحيح"
        });
      }

      const notification =
        await updateNotification(
          id,
          req.body || {}
        );

      if (!notification) {
        return res.status(404).json({
          success: false,

          error:
            "NOTIFICATION_NOT_FOUND",

          message:
            "الإشعار غير موجود"
        });
      }

      res.json({
        success: true,
        data: notification
      });
    }
  )
);

/* =========================================================
   حذف إشعار
========================================================= */

router.delete(
  "/:id",
  asyncRoute(
    async (req, res) => {
      const id =
        numberOrNull(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_NOTIFICATION_ID",

          message:
            "معرف الإشعار غير صحيح"
        });
      }

      const result =
        await deleteNotification(
          id
        );

      if (!result.deleted) {
        return res.status(404).json({
          success: false,

          error:
            "NOTIFICATION_NOT_FOUND",

          message:
            "الإشعار غير موجود"
        });
      }

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   تجهيز الإشعار
========================================================= */

router.post(
  "/:id/prepare",
  asyncRoute(
    async (req, res) => {
      const id =
        numberOrNull(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_NOTIFICATION_ID",

          message:
            "معرف الإشعار غير صحيح"
        });
      }

      const body =
        req.body || {};

      const result =
        await prepareNotification(
          id,
          {
            channels:
              body.channels,

            recipients:
              body.recipients,

            maxAttempts:
              body.maxAttempts
          }
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          error:
            "NOTIFICATION_NOT_FOUND",

          message:
            "الإشعار غير موجود"
        });
      }

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   إنشاء عمليات تسليم
========================================================= */

router.post(
  "/:id/deliveries",
  asyncRoute(
    async (req, res) => {
      const id =
        numberOrNull(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_NOTIFICATION_ID",

          message:
            "معرف الإشعار غير صحيح"
        });
      }

      const body =
        req.body || {};

      const deliveries =
        await createDeliveries(
          id,
          {
            channels:
              body.channels,

            recipients:
              body.recipients,

            maxAttempts:
              body.maxAttempts
          }
        );

      res.status(201);

      res.json({
        success: true,

        count:
          deliveries.length,

        data:
          deliveries
      });
    }
  )
);

/* =========================================================
   معالجة عملية تسليم
========================================================= */

router.post(
  "/deliveries/:deliveryId/process",
  asyncRoute(
    async (req, res) => {
      const deliveryId =
        numberOrNull(
          req.params.deliveryId
        );

      if (!deliveryId) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_DELIVERY_ID",

          message:
            "معرف عملية التسليم غير صحيح"
        });
      }

      const result =
        await processDelivery(
          deliveryId
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          error:
            "DELIVERY_NOT_FOUND",

          message:
            "عملية التسليم غير موجودة"
        });
      }

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   تعليم التسليم كمُرسل
========================================================= */

router.post(
  "/deliveries/:deliveryId/sent",
  asyncRoute(
    async (req, res) => {
      const deliveryId =
        numberOrNull(
          req.params.deliveryId
        );

      if (!deliveryId) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_DELIVERY_ID",

          message:
            "معرف عملية التسليم غير صحيح"
        });
      }

      const body =
        req.body || {};

      const result =
        await markDeliverySent(
          deliveryId,

          body.providerMessageId ||
            null,

          body.response ||
            {}
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          error:
            "DELIVERY_NOT_FOUND",

          message:
            "عملية التسليم غير موجودة"
        });
      }

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   تعليم التسليم كمُسلّم
========================================================= */

router.post(
  "/deliveries/:deliveryId/delivered",
  asyncRoute(
    async (req, res) => {
      const deliveryId =
        numberOrNull(
          req.params.deliveryId
        );

      if (!deliveryId) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_DELIVERY_ID",

          message:
            "معرف عملية التسليم غير صحيح"
        });
      }

      const result =
        await markDeliveryDelivered(
          deliveryId,

          req.body?.response ||
            {}
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          error:
            "DELIVERY_NOT_FOUND",

          message:
            "عملية التسليم غير موجودة"
        });
      }

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   تعليم التسليم كفاشل
========================================================= */

router.post(
  "/deliveries/:deliveryId/failed",
  asyncRoute(
    async (req, res) => {
      const deliveryId =
        numberOrNull(
          req.params.deliveryId
        );

      if (!deliveryId) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_DELIVERY_ID",

          message:
            "معرف عملية التسليم غير صحيح"
        });
      }

      const body =
        req.body || {};

      const result =
        await markDeliveryFailed(
          deliveryId,

          body.errorCode ||
            null,

          body.errorMessage ||
            null
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          error:
            "DELIVERY_NOT_FOUND",

          message:
            "عملية التسليم غير موجودة"
        });
      }

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   تحديث حالة الإشعار
========================================================= */

router.post(
  "/:id/refresh-status",
  asyncRoute(
    async (req, res) => {
      const id =
        numberOrNull(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_NOTIFICATION_ID",

          message:
            "معرف الإشعار غير صحيح"
        });
      }

      const notification =
        await getNotification(id);

      if (!notification) {
        return res.status(404).json({
          success: false,

          error:
            "NOTIFICATION_NOT_FOUND",

          message:
            "الإشعار غير موجود"
        });
      }

      const result =
        await refreshNotificationStatus(
          id
        );

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   إلغاء إشعار
========================================================= */

router.post(
  "/:id/cancel",
  asyncRoute(
    async (req, res) => {
      const id =
        numberOrNull(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,

          error:
            "INVALID_NOTIFICATION_ID",

          message:
            "معرف الإشعار غير صحيح"
        });
      }

      const result =
        await cancelNotification(
          id
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          error:
            "NOTIFICATION_NOT_FOUND",

          message:
            "الإشعار غير موجود أو لا يمكن إلغاؤه"
        });
      }

      res.json({
        success: true,
        data: result
      });
    }
  )
);

/* =========================================================
   تصدير Router
========================================================= */

module.exports = router;
