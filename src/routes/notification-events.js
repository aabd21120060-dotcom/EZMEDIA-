"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Events API
 *
 * الكود رقم 50
 *
 * API مركزي لجسر الأحداث الإعلامية مع نظام الإشعارات.
 */

const express = require("express");

const router =
  express.Router();

const eventBridge =
  require("../services/notificationEventBridge");

/* =========================================================
   Helpers
========================================================= */

function sendError(
  res,
  status,
  message,
  details = null
) {
  return res
    .status(status)
    .json({
      success: false,
      error: message,
      details,
      timestamp:
        new Date().toISOString()
    });
}

function requireEventType(
  body
) {
  return (
    body &&
    (
      body.eventType ||
      body.type
    )
  );
}

/* =========================================================
   GET /
   حالة جسر الأحداث
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const health =
        await eventBridge.health();

      return res
        .status(
          health.healthy
            ? 200
            : 503
        )
        .json({
          success:
            health.healthy,

          service:
            "notificationEventBridge",

          ...health,

          timestamp:
            new Date().toISOString()
        });
    } catch (error) {
      console.error(
        "Notification event bridge health error:",
        error
      );

      return sendError(
        res,
        503,
        "جسر أحداث الإشعارات غير متاح",
        error.message
      );
    }
  }
);

/* =========================================================
   GET /types
   أنواع الأحداث المدعومة
========================================================= */

router.get(
  "/types",
  (req, res) => {
    return res.json({
      success: true,

      eventTypes:
        eventBridge.EVENT_TYPES,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   GET /statistics
   إحصائيات الجسر
========================================================= */

router.get(
  "/statistics",
  (req, res) => {
    return res.json({
      success: true,

      statistics:
        eventBridge.getState(),

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   GET /health
========================================================= */

router.get(
  "/health",
  async (req, res) => {
    try {
      const health =
        await eventBridge.health();

      return res
        .status(
          health.healthy
            ? 200
            : 503
        )
        .json({
          success:
            health.healthy,

          ...health
        });
    } catch (error) {
      return sendError(
        res,
        503,
        "فشل فحص جسر الأحداث",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /preview
   معاينة الحدث بدون إنشاء إشعار
========================================================= */

router.post(
  "/preview",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      if (
        !requireEventType(body)
      ) {
        return sendError(
          res,
          400,
          "eventType مطلوب"
        );
      }

      const result =
        await eventBridge.preview(
          body.eventType ||
            body.type,
          body
        );

      return res.json({
        success: true,

        mode:
          "preview",

        result,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification event preview error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر معاينة الحدث",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /
   إرسال حدث عام إلى الجسر
========================================================= */

router.post(
  "/",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      if (
        !requireEventType(body)
      ) {
        return sendError(
          res,
          400,
          "eventType مطلوب"
        );
      }

      const result =
        await eventBridge.emit(
          body.eventType ||
            body.type,
          body
        );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json({
          ...result,

          timestamp:
            new Date().toISOString()
        });
    } catch (error) {
      console.error(
        "Notification event emit error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر إرسال الحدث إلى جسر الإشعارات",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /breaking-news
========================================================= */

router.post(
  "/breaking-news",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .breakingNews(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال خبر عاجل إلى نظام الإشعارات",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /content-published
========================================================= */

router.post(
  "/content-published",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .contentPublished(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال حدث نشر المحتوى",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /live-started
========================================================= */

router.post(
  "/live-started",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .liveStarted(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال حدث بدء البث",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /live-stopped
========================================================= */

router.post(
  "/live-stopped",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .liveStopped(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال حدث توقف البث",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /ai-alert
========================================================= */

router.post(
  "/ai-alert",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .aiAlert(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال تنبيه الذكاء الاصطناعي",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /system-alert
========================================================= */

router.post(
  "/system-alert",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .systemAlert(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال تنبيه النظام",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /commercial-event
========================================================= */

router.post(
  "/commercial-event",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .commercialEvent(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال الحدث التجاري",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /media-uploaded
========================================================= */

router.post(
  "/media-uploaded",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .mediaUploaded(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال حدث رفع الوسائط",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /content-review
========================================================= */

router.post(
  "/content-review",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .contentReview(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال حدث مراجعة المحتوى",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /security-alert
========================================================= */

router.post(
  "/security-alert",
  async (req, res) => {
    try {
      const result =
        await eventBridge
          .securityAlert(
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر إرسال التنبيه الأمني",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /custom/:type
========================================================= */

router.post(
  "/custom/:type",
  async (req, res) => {
    try {
      const type =
        String(
          req.params.type || ""
        ).trim();

      if (!type) {
        return sendError(
          res,
          400,
          "نوع الحدث مطلوب"
        );
      }

      const result =
        await eventBridge
          .customEvent(
            type,
            req.body || {}
          );

      return res
        .status(
          result.success
            ? 200
            : 500
        )
        .json(result);
    } catch (error) {
      return sendError(
        res,
        500,
        "تعذر تنفيذ الحدث المخصص",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /reset-statistics
========================================================= */

router.post(
  "/reset-statistics",
  (req, res) => {
    const statistics =
      eventBridge.resetState();

    return res.json({
      success: true,

      statistics,

      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   Export
========================================================= */

module.exports = router;
