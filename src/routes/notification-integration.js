"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Integration Routes
 *
 * الكود رقم 53
 *
 * API لبوابة تكامل الإشعارات والأحداث.
 */

const express = require("express");

const notificationIntegrationService =
  require("../services/notificationIntegrationService");

const router = express.Router();

/* =========================================================
   Helpers
========================================================= */

function sendError(
  res,
  error,
  status = 500
) {
  return res.status(status).json({
    success: false,
    error:
      error?.message ||
      "حدث خطأ غير متوقع",
    code:
      error?.code ||
      "NOTIFICATION_INTEGRATION_ERROR"
  });
}

function getPayload(
  req
) {
  return (
    req.body?.payload ||
    req.body?.data ||
    {}
  );
}

function getOptions(
  req
) {
  return (
    req.body?.options ||
    {}
  );
}

/* =========================================================
   Health
========================================================= */

router.get(
  "/health",
  (req, res) => {
    try {
      return res.json(
        notificationIntegrationService.health()
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   State
========================================================= */

router.get(
  "/state",
  (req, res) => {
    try {
      return res.json({
        success: true,
        state:
          notificationIntegrationService.getState()
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Event Types
========================================================= */

router.get(
  "/types",
  (req, res) => {
    try {
      return res.json({
        success: true,
        eventTypes:
          notificationIntegrationService.EVENT_TYPES
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Generic Event
========================================================= */

router.post(
  "/event",
  async (req, res) => {
    try {
      const eventType =
        req.body?.eventType ||
        req.body?.type;

      if (!eventType) {
        return res.status(400).json({
          success: false,
          error:
            "eventType is required",
          code:
            "EVENT_TYPE_REQUIRED"
        });
      }

      const result =
        await notificationIntegrationService.emit(
          eventType,
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Breaking News
========================================================= */

router.post(
  "/breaking-news",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.breakingNews(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Content Published
========================================================= */

router.post(
  "/content-published",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.contentPublished(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Live Started
========================================================= */

router.post(
  "/live-started",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.liveStarted(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Live Stopped
========================================================= */

router.post(
  "/live-stopped",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.liveStopped(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   AI Alert
========================================================= */

router.post(
  "/ai-alert",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.aiAlert(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   System Alert
========================================================= */

router.post(
  "/system-alert",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.systemAlert(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Commercial Event
========================================================= */

router.post(
  "/commercial-event",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.commercialEvent(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Media Uploaded
========================================================= */

router.post(
  "/media-uploaded",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.mediaUploaded(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Content Review
========================================================= */

router.post(
  "/content-review",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.contentReview(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Security Alert
========================================================= */

router.post(
  "/security-alert",
  async (req, res) => {
    try {
      const result =
        await notificationIntegrationService.securityAlert(
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Custom Event
========================================================= */

router.post(
  "/custom/:type",
  async (req, res) => {
    try {
      const type =
        req.params.type;

      if (!type) {
        return res.status(400).json({
          success: false,
          error:
            "Custom event type is required",
          code:
            "CUSTOM_EVENT_TYPE_REQUIRED"
        });
      }

      const result =
        await notificationIntegrationService.customEvent(
          type,
          getPayload(req),
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Batch
========================================================= */

router.post(
  "/batch",
  async (req, res) => {
    try {
      const events =
        req.body?.events;

      if (
        !Array.isArray(events)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "events must be an array",
          code:
            "EVENT_BATCH_INVALID"
        });
      }

      const result =
        await notificationIntegrationService.emitBatch(
          events,
          getOptions(req)
        );

      return res.status(202).json(
        result
      );
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Preview
========================================================= */

router.post(
  "/preview",
  async (req, res) => {
    try {
      const eventType =
        req.body?.eventType ||
        req.body?.type;

      if (!eventType) {
        return res.status(400).json({
          success: false,
          error:
            "eventType is required",
          code:
            "PREVIEW_EVENT_TYPE_REQUIRED"
        });
      }

      const result =
        await notificationIntegrationService.preview(
          eventType,
          getPayload(req)
        );

      return res.json({
        success: true,
        result
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Reset Statistics
========================================================= */

router.post(
  "/reset-statistics",
  (req, res) => {
    try {
      const state =
        notificationIntegrationService.resetState();

      return res.json({
        success: true,
        state
      });
    } catch (error) {
      return sendError(
        res,
        error
      );
    }
  }
);

/* =========================================================
   Export
========================================================= */

module.exports = router;
