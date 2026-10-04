"use strict";

const express = require("express");

const {
  query
} = require("../database/db");

const {
  authenticateRequest,
  requirePermission,
  getClientIp
} = require("../middleware/auth");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| قائمة السجل الأمني
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  authenticateRequest,
  requirePermission("users.view"),
  async (req, res, next) => {
    try {
      const {
        limit = 100,
        offset = 0,
        action,
        module,
        userId,
        resourceType,
        search,
        from,
        to
      } = req.query;

      const conditions = [];
      const values = [];
      let index = 1;

      if (action) {
        conditions.push(
          `a.action = $${index}`
        );
        values.push(action);
        index++;
      }

      if (module) {
        conditions.push(
          `a.module = $${index}`
        );
        values.push(module);
        index++;
      }

      if (userId) {
        conditions.push(
          `a.user_id = $${index}`
        );
        values.push(userId);
        index++;
      }

      if (resourceType) {
        conditions.push(
          `a.resource_type = $${index}`
        );
        values.push(resourceType);
        index++;
      }

      if (search) {
        conditions.push(`
          (
            a.action ILIKE $${index}
            OR a.module ILIKE $${index}
            OR a.resource_type ILIKE $${index}
            OR u.full_name ILIKE $${index}
            OR u.username ILIKE $${index}
          )
        `);

        values.push(`%${search}%`);
        index++;
      }

      if (from) {
        conditions.push(
          `a.created_at >= $${index}`
        );
        values.push(from);
        index++;
      }

      if (to) {
        conditions.push(
          `a.created_at <= $${index}`
        );
        values.push(to);
        index++;
      }

      const safeLimit = Math.min(
        Math.max(Number(limit) || 100, 1),
        500
      );

      const safeOffset = Math.max(
        Number(offset) || 0,
        0
      );

      values.push(safeLimit);
      const limitIndex = index;
      index++;

      values.push(safeOffset);
      const offsetIndex = index;

      const where =
        conditions.length > 0
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const result = await query(
        `
          SELECT
            a.id,
            a.user_id,
            a.action,
            a.module,
            a.resource_type,
            a.resource_id,
            a.ip_address,
            a.user_agent,
            a.details,
            a.created_at,

            u.full_name,
            u.username,
            u.role

          FROM admin_audit_logs a

          LEFT JOIN admin_users u
            ON u.id = a.user_id

          ${where}

          ORDER BY a.created_at DESC

          LIMIT $${limitIndex}
          OFFSET $${offsetIndex}
        `,
        values
      );

      res.json({
        success: true,
        count: result.rows.length,
        logs: result.rows.map(
          normalizeAuditLog
        )
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| سجل مستخدم محدد
|--------------------------------------------------------------------------
*/

router.get(
  "/user/:userId",
  authenticateRequest,
  requirePermission("users.view"),
  async (req, res, next) => {
    try {
      const {
        limit = 100,
        offset = 0
      } = req.query;

      const safeLimit = Math.min(
        Math.max(Number(limit) || 100, 1),
        500
      );

      const safeOffset = Math.max(
        Number(offset) || 0,
        0
      );

      const result = await query(
        `
          SELECT
            a.id,
            a.user_id,
            a.action,
            a.module,
            a.resource_type,
            a.resource_id,
            a.ip_address,
            a.user_agent,
            a.details,
            a.created_at,

            u.full_name,
            u.username,
            u.role

          FROM admin_audit_logs a

          LEFT JOIN admin_users u
            ON u.id = a.user_id

          WHERE a.user_id = $1

          ORDER BY a.created_at DESC

          LIMIT $2
          OFFSET $3
        `,
        [
          req.params.userId,
          safeLimit,
          safeOffset
        ]
      );

      res.json({
        success: true,
        count: result.rows.length,
        logs: result.rows.map(
          normalizeAuditLog
        )
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| سجل عملية محددة
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  authenticateRequest,
  requirePermission("users.view"),
  async (req, res, next) => {
    try {
      const result = await query(
        `
          SELECT
            a.id,
            a.user_id,
            a.action,
            a.module,
            a.resource_type,
            a.resource_id,
            a.ip_address,
            a.user_agent,
            a.details,
            a.created_at,

            u.full_name,
            u.username,
            u.role

          FROM admin_audit_logs a

          LEFT JOIN admin_users u
            ON u.id = a.user_id

          WHERE a.id = $1

          LIMIT 1
        `,
        [req.params.id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          success: false,
          code: "AUDIT_LOG_NOT_FOUND",
          message:
            "السجل المطلوب غير موجود"
        });
      }

      res.json({
        success: true,
        log: normalizeAuditLog(
          result.rows[0]
        )
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| إحصائيات السجل الأمني
|--------------------------------------------------------------------------
*/

router.get(
  "/statistics/summary",
  authenticateRequest,
  requirePermission("analytics.view"),
  async (req, res, next) => {
    try {
      const [
        totalResult,
        todayResult,
        actionResult,
        moduleResult,
        userResult,
        failedLoginResult
      ] = await Promise.all([
        query(`
          SELECT COUNT(*)::INTEGER AS total
          FROM admin_audit_logs
        `),

        query(`
          SELECT COUNT(*)::INTEGER AS total
          FROM admin_audit_logs
          WHERE created_at >= CURRENT_DATE
        `),

        query(`
          SELECT
            action,
            COUNT(*)::INTEGER AS count
          FROM admin_audit_logs
          GROUP BY action
          ORDER BY count DESC
          LIMIT 20
        `),

        query(`
          SELECT
            module,
            COUNT(*)::INTEGER AS count
          FROM admin_audit_logs
          WHERE module IS NOT NULL
          GROUP BY module
          ORDER BY count DESC
          LIMIT 20
        `),

        query(`
          SELECT
            u.id,
            u.full_name,
            u.username,
            COUNT(a.id)::INTEGER AS count
          FROM admin_users u
          INNER JOIN admin_audit_logs a
            ON a.user_id = u.id
          GROUP BY
            u.id,
            u.full_name,
            u.username
          ORDER BY count DESC
          LIMIT 20
        `),

        query(`
          SELECT
            COUNT(*)::INTEGER AS total
          FROM admin_audit_logs
          WHERE action = 'login_failed'
        `)
      ]);

      res.json({
        success: true,
        statistics: {
          total:
            totalResult.rows[0].total,

          today:
            todayResult.rows[0].total,

          failedLogins:
            failedLoginResult.rows[0].total,

          byAction:
            actionResult.rows,

          byModule:
            moduleResult.rows,

          byUser:
            userResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تسجيل حدث إداري مخصص
|--------------------------------------------------------------------------
|
| هذا المسار لا يسمح للمستخدم بإرسال user_id
| أو تزوير هوية المنفذ.
|--------------------------------------------------------------------------
*/

router.post(
  "/event",
  authenticateRequest,
  async (req, res, next) => {
    try {
      const {
        action,
        module = null,
        resourceType = null,
        resourceId = null,
        details = {}
      } = req.body || {};

      if (!action) {
        return res.status(400).json({
          success: false,
          code: "ACTION_REQUIRED",
          message:
            "نوع العملية مطلوب"
        });
      }

      const result = await query(
        `
          INSERT INTO admin_audit_logs (
            user_id,
            action,
            module,
            resource_type,
            resource_id,
            ip_address,
            user_agent,
            details
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
          RETURNING *
        `,
        [
          req.user.id,
          action,
          module,
          resourceType,
          resourceId,
          getClientIp(req),
          req.headers["user-agent"] || null,
          JSON.stringify(details)
        ]
      );

      res.status(201).json({
        success: true,
        log: normalizeAuditLog(
          result.rows[0]
        )
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| حذف السجلات القديمة
|--------------------------------------------------------------------------
|
| هذه العملية للمدير الأعلى فقط.
| الافتراضي: الاحتفاظ بالسجلات لمدة سنة.
|--------------------------------------------------------------------------
*/

router.delete(
  "/maintenance/old",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const months = Math.min(
        Math.max(
          Number(req.body?.months) || 12,
          1
        ),
        120
      );

      const result = await query(
        `
          DELETE FROM admin_audit_logs
          WHERE created_at <
            NOW() - ($1 || ' months')::INTERVAL
        `,
        [months]
      );

      res.json({
        success: true,
        message:
          "تم تنظيف السجلات القديمة",
        deleted: result.rowCount,
        retentionMonths: months
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تحويل السجل إلى استجابة آمنة
|--------------------------------------------------------------------------
*/

function normalizeAuditLog(row) {
  return {
    id: row.id,

    user: row.user_id
      ? {
          id: row.user_id,
          fullName: row.full_name,
          username: row.username,
          role: row.role
        }
      : null,

    action: row.action,

    module: row.module,

    resource: {
      type: row.resource_type,
      id: row.resource_id
    },

    ipAddress: row.ip_address,

    userAgent: row.user_agent,

    details:
      row.details || {},

    createdAt: row.created_at
  };
}

module.exports = router;
