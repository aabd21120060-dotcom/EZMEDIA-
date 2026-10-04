"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Rules API
 *
 * الكود رقم 48
 *
 * API لإدارة وتشغيل محرك قواعد الإشعارات.
 *
 * يعتمد على:
 * - notificationRulesService
 */

const express = require("express");

const router =
  express.Router();

const rulesService =
  require("../services/notificationRulesService");

/* =========================================================
   Helpers
========================================================= */

function parseInteger(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isInteger(number)
    ? number
    : fallback;
}

function sendError(
  res,
  status,
  error,
  details = null
) {
  return res
    .status(status)
    .json({
      success: false,
      error,
      details,
      timestamp:
        new Date().toISOString()
    });
}

/* =========================================================
   GET /
   قائمة القواعد النشطة
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const eventType =
        req.query.eventType ||
        req.query.event_type ||
        null;

      const rules =
        await rulesService
          .listActiveRules(
            eventType
          );

      return res.json({
        success: true,

        count:
          rules.length,

        eventType,

        rules,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification rules list error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر تحميل قواعد الإشعارات",
        error.message
      );
    }
  }
);

/* =========================================================
   GET /statistics
   إحصائيات القواعد
========================================================= */

router.get(
  "/statistics",
  async (req, res) => {
    try {
      const statistics =
        await rulesService
          .getRulesStatistics();

      return res.json({
        success: true,

        statistics,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification rules statistics error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر تحميل إحصائيات قواعد الإشعارات",
        error.message
      );
    }
  }
);

/* =========================================================
   GET /health
   صحة محرك القواعد
========================================================= */

router.get(
  "/health",
  async (req, res) => {
    try {
      const health =
        await rulesService
          .health();

      return res
        .status(
          health.healthy
            ? 200
            : 503
        )
        .json({
          success:
            health.healthy,

          ...health,

          timestamp:
            new Date().toISOString()
        });
    } catch (error) {
      console.error(
        "Notification rules health error:",
        error
      );

      return sendError(
        res,
        503,
        "محرك قواعد الإشعارات غير متاح",
        error.message
      );
    }
  }
);

/* =========================================================
   GET /:id
   جلب قاعدة محددة
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const id =
        parseInteger(
          req.params.id,
          NaN
        );

      if (
        !Number.isInteger(id)
      ) {
        return sendError(
          res,
          400,
          "معرف القاعدة غير صحيح"
        );
      }

      const rule =
        await rulesService
          .getRuleById(id);

      if (!rule) {
        return sendError(
          res,
          404,
          "قاعدة الإشعار غير موجودة"
        );
      }

      return res.json({
        success: true,

        rule,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification rule get error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر تحميل قاعدة الإشعار",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /preview
   معاينة القواعد قبل إنشاء إشعار
========================================================= */

router.post(
  "/preview",
  async (req, res) => {
    try {
      const event =
        req.body || {};

      if (
        !event.eventType &&
        !event.type
      ) {
        return sendError(
          res,
          400,
          "eventType مطلوب"
        );
      }

      const result =
        await rulesService
          .previewEvent(
            event
          );

      return res.json({
        success: true,

        mode:
          "preview",

        ...result,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification rule preview error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر معاينة قواعد الإشعارات",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /evaluate
   تقييم حدث وإنشاء الإشعارات المطابقة
========================================================= */

router.post(
  "/evaluate",
  async (req, res) => {
    try {
      const event =
        req.body || {};

      if (
        !event.eventType &&
        !event.type
      ) {
        return sendError(
          res,
          400,
          "eventType مطلوب"
        );
      }

      const result =
        await rulesService
          .processNotificationEvent(
            event
          );

      return res.json({
        success: true,

        mode:
          "evaluate",

        ...result,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification rule evaluate error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر تنفيذ قواعد الإشعارات",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /:id/test
   اختبار قاعدة محددة
========================================================= */

router.post(
  "/:id/test",
  async (req, res) => {
    try {
      const id =
        parseInteger(
          req.params.id,
          NaN
        );

      if (
        !Number.isInteger(id)
      ) {
        return sendError(
          res,
          400,
          "معرف القاعدة غير صحيح"
        );
      }

      const rule =
        await rulesService
          .getRuleById(id);

      if (!rule) {
        return sendError(
          res,
          404,
          "قاعدة الإشعار غير موجودة"
        );
      }

      const event =
        req.body || {};

      const matched =
        rulesService.matchesRule(
          rule,
          event
        );

      return res.json({
        success: true,

        mode:
          "rule_test",

        rule: {
          id:
            rule.id,

          name:
            rule.name,

          eventType:
            rule.event_type
        },

        matched,

        priority:
          rulesService
            .calculatePriority(
              rule,
              event
            ),

        channels:
          rulesService
            .calculateChannels(
              rule,
              event
            ),

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification rule test error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر اختبار قاعدة الإشعار",
        error.message
      );
    }
  }
);

/* =========================================================
   POST /event
   اختصار لتشغيل حدث إعلامي
========================================================= */

router.post(
  "/event",
  async (req, res) => {
    try {
      const event =
        req.body || {};

      if (
        !event.eventType &&
        !event.type
      ) {
        return sendError(
          res,
          400,
          "eventType مطلوب"
        );
      }

      const result =
        await rulesService
          .processNotificationEvent(
            event
          );

      return res.json({
        success: true,

        event:
          event.eventType ||
          event.type,

        result,

        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification event processing error:",
        error
      );

      return sendError(
        res,
        500,
        "تعذر معالجة الحدث الإعلامي",
        error.message
      );
    }
  }
);

/* =========================================================
   Export
========================================================= */

module.exports = router;
