"use strict";

const express = require("express");

function createAutonomousMediaOperationsRouter({
  engine,
  adminGuard
}) {
  const router = express.Router();

  if (!engine) {
    throw new Error(
      "Autonomous Media Operations Engine is not initialized."
    );
  }

  const guard =
    typeof adminGuard === "function"
      ? adminGuard
      : (_req, _res, next) => next();

  router.get(
    "/health",
    guard,
    async (_req, res) => {
      try {
        res.json(
          engine.health()
        );
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.get(
    "/status",
    guard,
    async (_req, res) => {
      try {
        res.json(
          engine.health()
        );
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.get(
    "/statistics",
    guard,
    async (_req, res) => {
      try {
        res.json(
          engine.statistics()
        );
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.get(
    "/dashboard",
    guard,
    async (_req, res) => {
      try {
        res.json(
          engine.dashboard()
        );
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.get(
    "/operations",
    guard,
    async (req, res) => {
      try {
        res.json({
          success: true,
          operations:
            engine.getOperations({
              status:
                req.query.status,
              type:
                req.query.type,
              limit:
                req.query.limit
            })
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.get(
    "/operations/:operationId",
    guard,
    async (req, res) => {
      try {
        const operation =
          engine.operations.get(
            req.params.operationId
          );

        if (!operation) {
          return res.status(404).json({
            success: false,
            error:
              "العملية غير موجودة."
          });
        }

        res.json({
          success: true,
          operation
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.post(
    "/operations",
    guard,
    express.json({
      limit: "2mb"
    }),
    async (req, res) => {
      try {
        const operation =
          await engine.createOperation(
            req.body || {}
          );

        res.status(201).json({
          success: true,
          operation
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.post(
    "/operations/:operationId/run",
    guard,
    async (req, res) => {
      try {
        const operation =
          await engine.executeOperation(
            req.params.operationId
          );

        res.json({
          success: true,
          operation
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.get(
    "/events",
    guard,
    async (req, res) => {
      try {
        res.json({
          success: true,
          events:
            engine.getEvents({
              type:
                req.query.type,
              limit:
                req.query.limit
            })
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.post(
    "/events",
    guard,
    express.json({
      limit: "5mb"
    }),
    async (req, res) => {
      try {
        const result =
          await engine.processEvent(
            req.body || {}
          );

        res.status(201).json({
          success: true,
          ...result
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.get(
    "/approvals",
    guard,
    async (req, res) => {
      try {
        res.json({
          success: true,
          approvals:
            engine.getApprovals(
              req.query.status ||
                "pending"
            )
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.post(
    "/approvals/:approvalId/approve",
    guard,
    express.json(),
    async (req, res) => {
      try {
        const result =
          await engine.approveOperation(
            req.params.approvalId,
            req.body?.actorId ||
              "human"
          );

        res.json(result);
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.post(
    "/approvals/:approvalId/reject",
    guard,
    express.json(),
    async (req, res) => {
      try {
        const result =
          await engine.rejectOperation(
            req.params.approvalId,
            req.body?.actorId ||
              "human",
            req.body?.reason ||
              ""
          );

        res.json(result);
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.post(
    "/start",
    guard,
    async (_req, res) => {
      try {
        const result =
          await engine.start();

        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  router.post(
    "/stop",
    guard,
    express.json(),
    async (req, res) => {
      try {
        const result =
          await engine.stop(
            req.body?.reason ||
              "manual_stop"
          );

        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  );

  return router;
}

module.exports =
  createAutonomousMediaOperationsRouter; قال
