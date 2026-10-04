"use strict";

/**
 * EZ MEDIA 11.0
 * CODE 102
 *
 * Executive Command API Routes
 */

const express =
  require("express");

const router =
  express.Router();


/* ============================================================
   HELPERS
============================================================ */

function getEngine(req) {
  return req.app.locals
    .executiveCommandAPIEngine;
}

function adminGuard(
  req,
  res,
  next
) {
  /*
   * لا نضع PLATFORM_ADMIN_KEY
   * في المتصفح.
   *
   * هذه الطبقة مؤقتة ومتوافقة
   * مع البنية الحالية.
   *
   * لاحقًا يتم تحويلها إلى
   * CODE 82 Security/RBAC.
   */

  const configuredKey =
    process.env.PLATFORM_ADMIN_KEY;

  if (!configuredKey) {
    return res.status(503).json({
      ok: false,
      error:
        "PLATFORM_ADMIN_KEY is not configured"
    });
  }

  const providedKey =
    req.headers[
      "x-platform-admin-key"
    ];

  if (
    !providedKey ||
    providedKey !==
      configuredKey
  ) {
    return res.status(401).json({
      ok: false,
      error:
        "Unauthorized"
    });
  }

  next();
}


/* ============================================================
   HEALTH
============================================================ */

router.get(
  "/health",
  async (req, res) => {
    const engine =
      getEngine(req);

    if (!engine) {
      return res.status(503).json({
        ok: false,
        error:
          "Executive Command API Engine unavailable"
      });
    }

    res.json({
      ok: true,

      service:
        "executive-command-api",

      timestamp:
        new Date().toISOString(),

      status:
        engine.getStatus()
    });
  }
);


/* ============================================================
   STATUS
============================================================ */

router.get(
  "/status",
  async (req, res) => {
    const engine =
      getEngine(req);

    if (!engine) {
      return res.status(503).json({
        ok: false
      });
    }

    res.json({
      ok: true,

      status:
        engine.getStatus()
    });
  }
);


/* ============================================================
   COMMANDS
============================================================ */

router.get(
  "/commands",
  async (req, res) => {
    const engine =
      getEngine(req);

    if (!engine) {
      return res.status(503).json({
        ok: false
      });
    }

    res.json({
      ok: true,

      commands:
        engine.getAvailableCommands()
    });
  }
);


/* ============================================================
   DASHBOARD
============================================================ */

router.get(
  "/dashboard",
  async (req, res) => {
    try {
      const engine =
        getEngine(req);

      const result =
        await engine.getDashboard();

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   RUN EXECUTIVE CYCLE
============================================================ */

router.post(
  "/run",
  adminGuard,
  async (req, res) => {
    try {
      const engine =
        getEngine(req);

      const result =
        await engine.executeCommand(
          engine.COMMANDS
            .RUN_EXECUTIVE_CYCLE,

          req.body || {},

          {
            actor:
              req.headers[
                "x-platform-admin-name"
              ] ||
              "executive-admin"
          }
        );

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   GENERATE DECISIONS
============================================================ */

router.post(
  "/decisions/generate",
  adminGuard,
  async (req, res) => {
    try {
      const engine =
        getEngine(req);

      const result =
        await engine.executeCommand(
          engine.COMMANDS
            .GENERATE_DECISIONS,

          req.body || {}
        );

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   GENERATE ALERTS
============================================================ */

router.post(
  "/alerts/generate",
  adminGuard,
  async (req, res) => {
    try {
      const engine =
        getEngine(req);

      const result =
        await engine.executeCommand(
          engine.COMMANDS
            .GENERATE_ALERTS,

          req.body || {}
        );

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   ACTION PLAN
============================================================ */

router.post(
  "/plans/create",
  adminGuard,
  async (req, res) => {
    try {
      const engine =
        getEngine(req);

      const result =
        await engine.executeCommand(
          engine.COMMANDS
            .CREATE_ACTION_PLAN,

          req.body || {}
        );

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   GENERIC COMMAND
============================================================ */

router.post(
  "/execute",
  adminGuard,
  async (req, res) => {
    try {
      const {
        command,
        payload
      } = req.body || {};

      if (!command) {
        return res.status(400).json({
          ok: false,
          error:
            "command is required"
        });
      }

      const engine =
        getEngine(req);

      const result =
        await engine.executeCommand(
          command,

          payload || {},

          {
            actor:
              req.headers[
                "x-platform-admin-name"
              ] ||
              "executive-admin"
          }
        );

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   EMERGENCY STOP
============================================================ */

router.post(
  "/emergency-stop",
  adminGuard,
  async (req, res) => {
    try {
      const engine =
        getEngine(req);

      const result =
        await engine.executeCommand(
          engine.COMMANDS
            .EMERGENCY_STOP,

          {},

          {
            actor:
              req.headers[
                "x-platform-admin-name"
              ] ||
              "executive-admin"
          }
        );

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   RESUME
============================================================ */

router.post(
  "/resume",
  adminGuard,
  async (req, res) => {
    try {
      const engine =
        getEngine(req);

      const result =
        await engine.executeCommand(
          engine.COMMANDS
            .RESUME_SYSTEM,

          {},

          {
            actor:
              req.headers[
                "x-platform-admin-name"
              ] ||
              "executive-admin"
          }
        );

      res.json(result);

    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error.message
      });
    }
  }
);


/* ============================================================
   AUTOMATION
============================================================ */

router.post(
  "/automation/start",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .START_AUTOMATION
      )
    );
  }
);

router.post(
  "/automation/stop",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .STOP_AUTOMATION
      )
    );
  }
);

router.post(
  "/automation/pause",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .PAUSE_AUTOMATION
      )
    );
  }
);

router.post(
  "/automation/resume",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .RESUME_AUTOMATION
      )
    );
  }
);


/* ============================================================
   LIVE
============================================================ */

router.post(
  "/live/start",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .START_LIVE,

        req.body || {}
      )
    );
  }
);

router.post(
  "/live/stop",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .STOP_LIVE
      )
    );
  }
);


/* ============================================================
   SCHEDULER
============================================================ */

router.post(
  "/scheduler/start",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .START_SCHEDULER
      )
    );
  }
);

router.post(
  "/scheduler/stop",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .STOP_SCHEDULER
      )
    );
  }
);


/* ============================================================
   ANALYTICS
============================================================ */

router.post(
  "/analytics/start",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .START_ANALYTICS
      )
    );
  }
);

router.post(
  "/analytics/stop",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .STOP_ANALYTICS
      )
    );
  }
);


/* ============================================================
   WORKFLOW
============================================================ */

router.post(
  "/workflow/start",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .START_WORKFLOW
      )
    );
  }
);

router.post(
  "/workflow/stop",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .STOP_WORKFLOW
      )
    );
  }
);


/* ============================================================
   DISTRIBUTION
============================================================ */

router.post(
  "/distribution/start",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .START_DISTRIBUTION
      )
    );
  }
);

router.post(
  "/distribution/stop",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .STOP_DISTRIBUTION
      )
    );
  }
);


/* ============================================================
   CONTENT FACTORY
============================================================ */

router.post(
  "/content-factory/start",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .START_CONTENT_FACTORY
      )
    );
  }
);

router.post(
  "/content-factory/stop",
  adminGuard,
  async (req, res) => {
    const engine =
      getEngine(req);

    res.json(
      await engine.executeCommand(
        engine.COMMANDS
          .STOP_CONTENT_FACTORY
      )
    );
  }
);


module.exports =
  router;
