"use strict";

const express = require("express");

const {
  createUser,
  findUserById,
  updateUser,
  listUsers,
  revokeAllUserSessions,
  createAuditLog
} = require("../services/authService");

const {
  authenticateRequest,
  requirePermission,
  requireSuperAdmin,
  getClientIp
} = require("../middleware/auth");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| قائمة فريق EZ MEDIA
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  authenticateRequest,
  requirePermission("users.view"),
  async (req, res, next) => {
    try {
      const {
        limit,
        offset,
        search,
        role,
        status
      } = req.query;

      const users = await listUsers({
        limit,
        offset,
        search,
        role,
        status
      });

      res.json({
        success: true,
        platform: "EZ MEDIA",
        count: users.length,
        users
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| معلومات عضو محدد
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  authenticateRequest,
  requirePermission("users.view"),
  async (req, res, next) => {
    try {
      const user =
        await findUserById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "عضو الفريق غير موجود"
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          fullName: user.full_name,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatar_url,
          phone: user.phone,
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| إضافة عضو جديد للفريق
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const {
        fullName,
        username,
        email,
        password,
        role = "editor",
        phone,
        avatarUrl,
        status = "active",
        metadata = {}
      } = req.body || {};

      if (
        !fullName ||
        !username ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          code: "MISSING_REQUIRED_FIELDS",
          message:
            "الاسم واسم المستخدم وكلمة المرور مطلوبة"
        });
      }

      if (
        role === "super_admin" &&
        req.user.role !== "super_admin"
      ) {
        return res.status(403).json({
          success: false,
          code: "SUPER_ADMIN_REQUIRED",
          message:
            "لا يمكن إنشاء مدير أعلى إلا بواسطة مدير أعلى"
        });
      }

      const user = await createUser({
        fullName,
        username,
        email,
        password,
        role,
        phone,
        avatarUrl,
        status,
        metadata
      });

      await createAuditLog({
        userId: req.user.id,
        action: "team_member_created",
        module: "users",
        resourceType: "admin_user",
        resourceId: user.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          role: user.role,
          username: user.username
        }
      });

      res.status(201).json({
        success: true,
        message:
          "تم إنشاء عضو الفريق بنجاح",
        user
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          code: "USER_ALREADY_EXISTS",
          message:
            "اسم المستخدم أو البريد الإلكتروني مستخدم مسبقًا"
        });
      }

      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تعديل عضو
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const targetUser =
        await findUserById(req.params.id);

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "عضو الفريق غير موجود"
        });
      }

      if (
        targetUser.role === "super_admin" &&
        req.user.role !== "super_admin"
      ) {
        return res.status(403).json({
          success: false,
          code: "SUPER_ADMIN_REQUIRED",
          message:
            "لا يمكن تعديل المدير الأعلى إلا بواسطة مدير أعلى"
        });
      }

      if (
        req.body.role === "super_admin" &&
        req.user.role !== "super_admin"
      ) {
        return res.status(403).json({
          success: false,
          code: "SUPER_ADMIN_REQUIRED",
          message:
            "لا يمكن منح صلاحية المدير الأعلى"
        });
      }

      const user =
        await updateUser(
          req.params.id,
          req.body || {}
        );

      await createAuditLog({
        userId: req.user.id,
        action: "team_member_updated",
        module: "users",
        resourceType: "admin_user",
        resourceId: user.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          fields:
            Object.keys(req.body || {})
        }
      });

      res.json({
        success: true,
        message:
          "تم تحديث بيانات عضو الفريق",
        user
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          code: "USER_ALREADY_EXISTS",
          message:
            "اسم المستخدم أو البريد الإلكتروني مستخدم مسبقًا"
        });
      }

      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تعطيل عضو
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/disable",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const targetUser =
        await findUserById(req.params.id);

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "عضو الفريق غير موجود"
        });
      }

      if (
        targetUser.role === "super_admin"
      ) {
        return res.status(403).json({
          success: false,
          code: "SUPER_ADMIN_PROTECTED",
          message:
            "لا يمكن تعطيل المدير الأعلى من هذا المسار"
        });
      }

      const user =
        await updateUser(
          req.params.id,
          {
            status: "inactive"
          }
        );

      const revokedSessions =
        await revokeAllUserSessions(
          req.params.id
        );

      await createAuditLog({
        userId: req.user.id,
        action: "team_member_disabled",
        module: "users",
        resourceType: "admin_user",
        resourceId: req.params.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          revokedSessions
        }
      });

      res.json({
        success: true,
        message:
          "تم تعطيل عضو الفريق وإنهاء جلساته",
        revokedSessions,
        user
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تفعيل عضو
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/enable",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const targetUser =
        await findUserById(req.params.id);

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "عضو الفريق غير موجود"
        });
      }

      const user =
        await updateUser(
          req.params.id,
          {
            status: "active"
          }
        );

      await createAuditLog({
        userId: req.user.id,
        action: "team_member_enabled",
        module: "users",
        resourceType: "admin_user",
        resourceId: req.params.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null
      });

      res.json({
        success: true,
        message:
          "تم تفعيل عضو الفريق",
        user
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تعليق عضو
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/suspend",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const targetUser =
        await findUserById(req.params.id);

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "عضو الفريق غير موجود"
        });
      }

      if (
        targetUser.role === "super_admin"
      ) {
        return res.status(403).json({
          success: false,
          code: "SUPER_ADMIN_PROTECTED",
          message:
            "لا يمكن تعليق المدير الأعلى"
        });
      }

      const user =
        await updateUser(
          req.params.id,
          {
            status: "suspended"
          }
        );

      const revokedSessions =
        await revokeAllUserSessions(
          req.params.id
        );

      await createAuditLog({
        userId: req.user.id,
        action: "team_member_suspended",
        module: "users",
        resourceType: "admin_user",
        resourceId: req.params.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          revokedSessions
        }
      });

      res.json({
        success: true,
        message:
          "تم تعليق عضو الفريق",
        revokedSessions,
        user
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| إنهاء جميع جلسات عضو
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/revoke-sessions",
  authenticateRequest,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const targetUser =
        await findUserById(req.params.id);

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "عضو الفريق غير موجود"
        });
      }

      const count =
        await revokeAllUserSessions(
          req.params.id
        );

      await createAuditLog({
        userId: req.user.id,
        action: "team_member_sessions_revoked",
        module: "users",
        resourceType: "admin_user",
        resourceId: req.params.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          revokedSessions: count
        }
      });

      res.json({
        success: true,
        message:
          "تم إنهاء جميع جلسات عضو الفريق",
        revokedSessions: count
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
