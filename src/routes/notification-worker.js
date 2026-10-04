"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Worker Routes
 *
 * الكود رقم 45
 *
 * API التحكم بمحرك الإشعارات الخلفي.
 *
 * المسارات:
 *
 * GET  /status
 * GET  /health
 * POST /run
 * POST /start
 * POST /stop
 * POST /restart
 */

const express = require("express");

const {
  getWorkerState,
  runNotificationWorkerOnce,
  startNotificationWorker,
  stopNotificationWorker,
  restartNotificationWorker,
  notificationWorkerHealth
} = require("../services/notificationWorker");

const router = express.Router();

function getNumber(
  value,
  fallback
) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return Math.floor(number);
}

function safeError(error) {
  return {
    message:
      error &&
      error.message
        ? error.message
        : "Unknown error"
  };
}

/**
 * حالة Worker الحالية.
 *
 * GET /api/notification-worker/status
 */
router.get(
  "/status",
  async (req, res) => {
    try {
      const state =
        getWorkerState();

      return res.json({
        success: true,
        service:
          "EZ MEDIA Notification Worker",
        state,
        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification worker status error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: safeError(error),
        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/**
 * فحص صحة Worker وقاعدة البيانات.
 *
 * GET /api/notification-worker/health
 */
router.get(
  "/health",
  async (req, res) => {
    try {
      const health =
        await notificationWorkerHealth();

      const statusCode =
        health.status === "online"
          ? 200
          : health.status ===
              "ready"
            ? 200
            : 503;

      return res
        .status(statusCode)
        .json({
          success:
            statusCode === 200,
          ...health
        });
    } catch (error) {
      console.error(
        "Notification worker health error:",
        error
      );

      return res.status(503).json({
        success: false,
        status: "error",
        service:
          "notificationWorker",
        error: safeError(error),
        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/**
 * تشغيل دورة معالجة واحدة.
 *
 * POST /api/notification-worker/run
 *
 * body:
 * {
 *   "batchSize": 25
 * }
 */
router.post(
  "/run",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const batchSize =
        getNumber(
          body.batchSize,
          Number(
            process.env
              .NOTIFICATION_WORKER_BATCH_SIZE ||
              25
          )
        );

      const result =
        await runNotificationWorkerOnce({
          batchSize
        });

      return res.json({
        success:
          Boolean(result.success),
        service:
          "EZ MEDIA Notification Worker",
        action:
          "run_once",
        result,
        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification worker run error:",
        error
      );

      return res.status(500).json({
        success: false,
        action:
          "run_once",
        error: safeError(error),
        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/**
 * بدء Worker الدوري.
 *
 * POST /api/notification-worker/start
 *
 * body:
 * {
 *   "intervalMs": 15000,
 *   "batchSize": 25
 * }
 */
router.post(
  "/start",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const intervalMs =
        getNumber(
          body.intervalMs,
          Number(
            process.env
              .NOTIFICATION_WORKER_INTERVAL_MS ||
              15000
          )
        );

      const batchSize =
        getNumber(
          body.batchSize,
          Number(
            process.env
              .NOTIFICATION_WORKER_BATCH_SIZE ||
              25
          )
        );

      const state =
        startNotificationWorker({
          intervalMs,
          batchSize
        });

      return res.json({
        success: true,
        service:
          "EZ MEDIA Notification Worker",
        action: "start",
        state,
        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification worker start error:",
        error
      );

      return res.status(500).json({
        success: false,
        action: "start",
        error: safeError(error),
        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/**
 * إيقاف Worker الدوري.
 *
 * POST /api/notification-worker/stop
 */
router.post(
  "/stop",
  async (req, res) => {
    try {
      const state =
        stopNotificationWorker();

      return res.json({
        success: true,
        service:
          "EZ MEDIA Notification Worker",
        action: "stop",
        state,
        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification worker stop error:",
        error
      );

      return res.status(500).json({
        success: false,
        action: "stop",
        error: safeError(error),
        timestamp:
          new Date().toISOString()
      });
    }
  }
);

/**
 * إعادة تشغيل Worker.
 *
 * POST /api/notification-worker/restart
 *
 * body:
 * {
 *   "intervalMs": 15000,
 *   "batchSize": 25
 * }
 */
router.post(
  "/restart",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const intervalMs =
        getNumber(
          body.intervalMs,
          Number(
            process.env
              .NOTIFICATION_WORKER_INTERVAL_MS ||
              15000
          )
        );

      const batchSize =
        getNumber(
          body.batchSize,
          Number(
            process.env
              .NOTIFICATION_WORKER_BATCH_SIZE ||
              25
          )
        );

      const state =
        restartNotificationWorker({
          intervalMs,
          batchSize
        });

      return res.json({
        success: true,
        service:
          "EZ MEDIA Notification Worker",
        action: "restart",
        state,
        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Notification worker restart error:",
        error
      );

      return res.status(500).json({
        success: false,
        action: "restart",
        error: safeError(error),
        timestamp:
          new Date().toISOString()
      });
    }
  }
);

module.exports = router;
