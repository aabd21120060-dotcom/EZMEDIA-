"use strict";

const express = require("express");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| CODE 105
| Intelligent Executive Center API
|--------------------------------------------------------------------------
| يربط مركز القيادة التنفيذي مع:
| CODE 100 Command Engine
| CODE 103 Executive Command Center
| CODE 104 Approval Engine
|--------------------------------------------------------------------------
*/

function getApprovalEngine(req) {
  return req.app.locals.intelligentExecutiveApprovalEngine;
}

function getCommandEngine(req) {
  return req.app.locals.intelligentMediaCommandEngine;
}

function getAnalyticsEngine(req) {
  return req.app.locals.intelligentMediaAnalyticsEngine;
}

function getLiveEngine(req) {
  return req.app.locals.intelligentLiveBroadcastEngine;
}

function getNewsroom(req) {
  return req.app.locals.editorialNewsroomEngine;
}

/*
|--------------------------------------------------------------------------
| Admin Guard
|--------------------------------------------------------------------------
*/

function adminGuard(req, res, next) {
  const configuredKey =
    process.env.PLATFORM_ADMIN_KEY;

  if (!configuredKey) {
    return res.status(503).json({
      success: false,
      error: "PLATFORM_ADMIN_KEY is not configured"
    });
  }

  const suppliedKey =
    req.headers["x-platform-admin-key"];

  if (!suppliedKey || suppliedKey !== configuredKey) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

router.get("/health", async (req, res) => {
  try {
    const approval =
      getApprovalEngine(req);

    const command =
      getCommandEngine(req);

    return res.json({
      success: true,
      service:
        "intelligent-executive-center",
      code: "105",
      status: "online",
      approvalEngine:
        approval
          ? "available"
          : "unavailable",
      commandEngine:
        command
          ? "available"
          : "unavailable",
      timestamp:
        new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| Executive Dashboard
|--------------------------------------------------------------------------
*/

router.get("/dashboard", async (req, res) => {
  try {
    const approval =
      getApprovalEngine(req);

    const command =
      getCommandEngine(req);

    const analytics =
      getAnalyticsEngine(req);

    const live =
      getLiveEngine(req);

    const newsroom =
      getNewsroom(req);

    const result = {
      success: true,

      platform: {
        name: "EZ MEDIA",
        code: "105",
        timestamp:
          new Date().toISOString()
      },

      approval: null,
      command: null,
      analytics: null,
      live: null,
      newsroom: null
    };

    if (approval) {
      if (
        typeof approval.getDashboard ===
        "function"
      ) {
        result.approval =
          await approval.getDashboard();
      } else if (
        typeof approval.getStatistics ===
        "function"
      ) {
        result.approval =
          await approval.getStatistics();
      }
    }

    if (command) {
      if (
        typeof command.getSnapshot ===
        "function"
      ) {
        result.command =
          await command.getSnapshot();
      }
    }

    if (analytics) {
      if (
        typeof analytics.getDashboard ===
        "function"
      ) {
        result.analytics =
          await analytics.getDashboard();
      }
    }

    if (live) {
      if (
        typeof live.getStatus ===
        "function"
      ) {
        result.live =
          await live.getStatus();
      }
    }

    if (newsroom) {
      if (
        typeof newsroom.getStatistics ===
        "function"
      ) {
        result.newsroom =
          await newsroom.getStatistics();
      }
    }

    return res.json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| Pending Approvals
|--------------------------------------------------------------------------
*/

router.get(
  "/approvals/pending",
  async (req, res) => {
    try {
      const approval =
        getApprovalEngine(req);

      if (!approval) {
        return res.status(503).json({
          success: false,
          error:
            "Approval engine unavailable"
        });
      }

      let data = [];

      if (
        typeof approval.getRequests ===
        "function"
      ) {
        data =
          await approval.getRequests({
            status: "pending",
            limit:
              Number(req.query.limit || 100)
          });
      }

      return res.json({
        success: true,
        count: Array.isArray(data)
          ? data.length
          : 0,
        requests: data
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Approval Dashboard
|--------------------------------------------------------------------------
*/

router.get(
  "/approvals/dashboard",
  async (req, res) => {
    try {
      const approval =
        getApprovalEngine(req);

      if (!approval) {
        return res.status(503).json({
          success: false,
          error:
            "Approval engine unavailable"
        });
      }

      let dashboard = {};

      if (
        typeof approval.getDashboard ===
        "function"
      ) {
        dashboard =
          await approval.getDashboard();
      }

      return res.json({
        success: true,
        dashboard
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Create Approval Request
|--------------------------------------------------------------------------
*/

router.post(
  "/approvals",
  adminGuard,
  async (req, res) => {
    try {
      const approval =
        getApprovalEngine(req);

      if (!approval) {
        return res.status(503).json({
          success: false,
          error:
            "Approval engine unavailable"
        });
      }

      if (
        typeof approval.createRequest !==
        "function"
      ) {
        return res.status(501).json({
          success: false,
          error:
            "createRequest is not available"
        });
      }

      const request =
        await approval.createRequest(
          req.body || {}
        );

      return res.status(201).json({
        success: true,
        request
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Approve
|--------------------------------------------------------------------------
*/

router.post(
  "/approvals/:approvalId/approve",
  adminGuard,
  async (req, res) => {
    try {
      const approval =
        getApprovalEngine(req);

      if (!approval) {
        return res.status(503).json({
          success: false,
          error:
            "Approval engine unavailable"
        });
      }

      if (
        typeof approval.approve !==
        "function"
      ) {
        return res.status(501).json({
          success: false,
          error:
            "approve is not available"
        });
      }

      const result =
        await approval.approve(
          req.params.approvalId,
          {
            actorId:
              req.body?.actorId ||
              "super_admin",
            actorType:
              req.body?.actorType ||
              "human",
            comment:
              req.body?.comment ||
              null,
            metadata:
              req.body?.metadata ||
              {}
          }
        );

      return res.json({
        success: true,
        result
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Reject
|--------------------------------------------------------------------------
*/

router.post(
  "/approvals/:approvalId/reject",
  adminGuard,
  async (req, res) => {
    try {
      const approval =
        getApprovalEngine(req);

      if (!approval) {
        return res.status(503).json({
          success: false,
          error:
            "Approval engine unavailable"
        });
      }

      if (
        typeof approval.reject !==
        "function"
      ) {
        return res.status(501).json({
          success: false,
          error:
            "reject is not available"
        });
      }

      const result =
        await approval.reject(
          req.params.approvalId,
          {
            actorId:
              req.body?.actorId ||
              "super_admin",
            actorType:
              req.body?.actorType ||
              "human",
            reason:
              req.body?.reason ||
              "تم رفض القرار من مركز القيادة",
            metadata:
              req.body?.metadata ||
              {}
          }
        );

      return res.json({
        success: true,
        result
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Return For Revision
|--------------------------------------------------------------------------
*/

router.post(
  "/approvals/:approvalId/return",
  adminGuard,
  async (req, res) => {
    try {
      const approval =
        getApprovalEngine(req);

      if (!approval) {
        return res.status(503).json({
          success: false,
          error:
            "Approval engine unavailable"
        });
      }

      if (
        typeof approval.returnRequest !==
        "function"
      ) {
        return res.status(501).json({
          success: false,
          error:
            "returnRequest is not available"
        });
      }

      const result =
        await approval.returnRequest(
          req.params.approvalId,
          {
            actorId:
              req.body?.actorId ||
              "super_admin",
            actorType:
              req.body?.actorType ||
              "human",
            reason:
              req.body?.reason ||
              "إعادة للمراجعة والتعديل",
            metadata:
              req.body?.metadata ||
              {}
          }
        );

      return res.json({
        success: true,
        result
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Executive Cycle
|--------------------------------------------------------------------------
*/

router.post(
  "/run",
  adminGuard,
  async (req, res) => {
    try {
      const command =
        getCommandEngine(req);

      if (!command) {
        return res.status(503).json({
          success: false,
          error:
            "Command engine unavailable"
        });
      }

      let result = null;

      if (
        typeof command.run ===
        "function"
      ) {
        result =
          await command.run({
            source:
              "executive-command-center",
            requestedBy:
              "super_admin",
            mode:
              req.body?.mode ||
              "full"
          });
      } else if (
        typeof command.executeCycle ===
        "function"
      ) {
        result =
          await command.executeCycle();
      }

      return res.json({
        success: true,
        result
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| System Snapshot
|--------------------------------------------------------------------------
*/

router.get(
  "/snapshot",
  async (req, res) => {
    try {
      const command =
        getCommandEngine(req);

      if (!command) {
        return res.status(503).json({
          success: false,
          error:
            "Command engine unavailable"
        });
      }

      let snapshot = null;

      if (
        typeof command.getSnapshot ===
        "function"
      ) {
        snapshot =
          await command.getSnapshot();
      }

      return res.json({
        success: true,
        snapshot
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Emergency Stop
|--------------------------------------------------------------------------
*/

router.post(
  "/emergency-stop",
  adminGuard,
  async (req, res) => {
    try {
      const command =
        getCommandEngine(req);

      if (!command) {
        return res.status(503).json({
          success: false,
          error:
            "Command engine unavailable"
        });
      }

      let result = null;

      if (
        typeof command.emergencyStop ===
        "function"
      ) {
        result =
          await command.emergencyStop({
            actorId:
              "super_admin",
            reason:
              req.body?.reason ||
              "Emergency stop from executive center"
          });
      }

      return res.json({
        success: true,
        result
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
