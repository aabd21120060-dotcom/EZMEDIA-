"use strict";

const express = require("express");

const {
  createUser,
  authenticateUser,
  getSessionByToken,
  revokeSession,
  revokeAllUserSessions,
  updateUser,
  changePassword,
  listUsers,
  findUserById,
  createAuditLog,
  getRolePermissions
} = require("../services/authService");

const {
  authenticateRequest,
  requirePermission,
  requireSuperAdmin,
  getClientIp
} = require("../middleware/auth");

const router = express.Router();

function getToken(req) {
  if (req.auth && req.auth.token) {
    return req.auth.token;
  }

  const authorization =
    req.headers.authorization || "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  if (req.headers["x-session-token"]) {
    return String(
      req.headers["x-session-token"]
    ).trim();
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| تسجيل الدخول
|--------------------------------------------------------------------------
*/

router.post(
  "/login",
  async (req, res, next) => {
    try {
      const {
        username,
        password,
        deviceName
      } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          code: "MISSING_CREDENTIALS",
          message:
            "اسم المستخدم وكلمة المرور مطلوبان"
        });
      }

      const result =
        await authenticateUser({
          username,
          password,
          ipAddress: getClientIp(req),
          userAgent:
            req.headers["user-agent"] || null,
          deviceName:
            deviceName || null
        });

      if (!result.success) {
        await createAuditLog({
          action: "login_failed",
          module: "auth",
          ipAddress: getClientIp(req),
          userAgent:
            req.headers["user-agent"] || null,
          details: {
            username,
            code: result.code
          }
        });

        return res.status(401).json(result);
      }

      await createAuditLog({
        userId: result.user.id,
        action: "login_success",
        module: "auth",
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          sessionId: result.session.id,
          deviceName:
            deviceName || null
        }
      });

      return res.json({
        success: true,
        authenticated: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        token: result.token,
        session: result.session,
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| التحقق من الجلسة الحالية
|--------------------------------------------------------------------------
*/

router.get(
  "/me",
  authenticateRequest,
  async (req, res, next) => {
    try {
      const permissions =
        await getRolePermissions(
          req.user.role
        );

      res.json({
        success: true,
        authenticated: true,
        user: req.user,
        session: req.auth.session,
        permissions
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تسجيل الخروج
|--------------------------------------------------------------------------
*/

router.post(
  "/logout",
  authenticateRequest,
  async (req, res, next) => {
    try {
      const token = getToken(req);

      await revokeSession(token);

      await createAuditLog({
        userId: req.user.id,
        action: "logout",
        module: "auth",
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          sessionId:
            req.auth.session.id
        }
      });

      res.json({
        success: true,
        authenticated: false,
        message: "تم تسجيل الخروج بنجاح"
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تسجيل الخروج من جميع الأجهزة
|--------------------------------------------------------------------------
*/

router.post(
  "/logout-all",
  authenticateRequest,
  async (req, res, next) => {
    try {
      const count =
        await revokeAllUserSessions(
          req.user.id
        );

      await createAuditLog({
        userId: req.user.id,
        action: "logout_all",
        module: "auth",
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
          "تم إنهاء جميع جلسات المستخدم",
        revokedSessions: count
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| إنشاء مستخدم
|--------------------------------------------------------------------------
*/

router.post(
  "/users",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const {
        fullName,
        username,
        email,
        password,
        role,
        phone,
        avatarUrl,
        status,
        metadata
      } = req.body || {};

      if (
        !fullName ||
        !username ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          code: "MISSING_USER_FIELDS",
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
            "إنشاء مدير أعلى متاح للمدير الأعلى فقط"
        });
      }

      const user =
        await createUser({
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
        action: "user_created",
        module: "users",
        resourceType: "admin_user",
        resourceId: user.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          username: user.username,
          role: user.role
        }
      });

      res.status(201).json({
        success: true,
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
| قائمة المستخدمين
|--------------------------------------------------------------------------
*/

router.get(
  "/users",
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

      const users =
        await listUsers({
          limit,
          offset,
          search,
          role,
          status
        });

      res.json({
        success: true,
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
| مستخدم محدد
|--------------------------------------------------------------------------
*/

router.get(
  "/users/:id",
  authenticateRequest,
  requirePermission("users.view"),
  async (req, res, next) => {
    try {
      const user =
        await findUserById(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "المستخدم غير موجود"
        });
      }

      const safeUser = {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        lastLoginAt:
          user.last_login_at,
        createdAt:
          user.created_at,
        updatedAt:
          user.updated_at
      };

      res.json({
        success: true,
        user: safeUser
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| تعديل مستخدم
|--------------------------------------------------------------------------
*/

router.patch(
  "/users/:id",
  authenticateRequest,
  requirePermission("users.manage"),
  async (req, res, next) => {
    try {
      const targetUser =
        await findUserById(
          req.params.id
        );

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "المستخدم غير موجود"
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
        action: "user_updated",
        module: "users",
        resourceType: "admin_user",
        resourceId: user.id,
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null,
        details: {
          updatedFields:
            Object.keys(req.body || {})
        }
      });

      res.json({
        success: true,
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
| تغيير كلمة مرور المستخدم الحالي
|--------------------------------------------------------------------------
*/

router.post(
  "/change-password",
  authenticateRequest,
  async (req, res, next) => {
    try {
      const {
        currentPassword,
        newPassword
      } = req.body || {};

      if (
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          code: "MISSING_PASSWORDS",
          message:
            "كلمة المرور الحالية والجديدة مطلوبة"
        });
      }

      const result =
        await changePassword(
          req.user.id,
          currentPassword,
          newPassword
        );

      if (!result.success) {
        return res.status(400).json(result);
      }

      await createAuditLog({
        userId: req.user.id,
        action: "password_changed",
        module: "auth",
        ipAddress: getClientIp(req),
        userAgent:
          req.headers["user-agent"] || null
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| إعادة التحقق من الجلسة
|--------------------------------------------------------------------------
*/

router.get(
  "/session",
  authenticateRequest,
  async (req, res, next) => {
    try {
      const token = getToken(req);

      const session =
        await getSessionByToken(token);

      if (!session) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          code: "INVALID_SESSION",
          message:
            "جلسة الدخول غير صالحة"
        });
      }

      res.json({
        success: true,
        authenticated: true,
        user: session.user,
        session: session.session
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| إنهاء جلسات مستخدم آخر
|--------------------------------------------------------------------------
*/

router.post(
  "/users/:id/logout-all",
  authenticateRequest,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const targetUser =
        await findUserById(
          req.params.id
        );

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "المستخدم غير موجود"
        });
      }

      const count =
        await revokeAllUserSessions(
          req.params.id
        );

      await createAuditLog({
        userId: req.user.id,
        action: "user_sessions_revoked",
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
        revokedSessions: count
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
