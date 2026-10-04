"use strict";

const {
  getSessionByToken,
  hasPermission,
  createAuditLog
} = require("../services/authService");

function extractToken(req) {
  const authorization =
    req.headers.authorization || "";

  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  if (req.cookies && req.cookies.ez_media_session) {
    return req.cookies.ez_media_session;
  }

  const headerToken =
    req.headers["x-session-token"];

  if (headerToken) {
    return String(headerToken).trim();
  }

  return null;
}

async function authenticateRequest(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        code: "AUTHENTICATION_REQUIRED",
        message: "تسجيل الدخول مطلوب"
      });
    }

    const session =
      await getSessionByToken(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        code: "INVALID_SESSION",
        message: "جلسة الدخول غير صالحة أو منتهية"
      });
    }

    req.auth = {
      token,
      session: session.session,
      user: session.user
    };

    req.user = session.user;

    next();
  } catch (error) {
    next(error);
  }
}

function optionalAuthentication(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    req.auth = null;
    req.user = null;
    return next();
  }

  getSessionByToken(token)
    .then((session) => {
      if (session) {
        req.auth = {
          token,
          session: session.session,
          user: session.user
        };

        req.user = session.user;
      } else {
        req.auth = null;
        req.user = null;
      }

      next();
    })
    .catch(next);
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          code: "AUTHENTICATION_REQUIRED",
          message: "تسجيل الدخول مطلوب"
        });
      }

      if (!permission) {
        return next();
      }

      const allowed =
        await hasPermission(
          req.user,
          permission
        );

      if (!allowed) {
        await createAuditLog({
          userId: req.user.id,
          action: "permission_denied",
          module: permission.split(".")[0],
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          details: {
            permission,
            method: req.method,
            path: req.originalUrl
          }
        });

        return res.status(403).json({
          success: false,
          authenticated: true,
          authorized: false,
          code: "PERMISSION_DENIED",
          message: "ليس لديك صلاحية لتنفيذ هذا الإجراء"
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          code: "AUTHENTICATION_REQUIRED",
          message: "تسجيل الدخول مطلوب"
        });
      }

      if (
        roles.length === 0 ||
        roles.includes(req.user.role)
      ) {
        return next();
      }

      await createAuditLog({
        userId: req.user.id,
        action: "role_denied",
        module: "auth",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        details: {
          requiredRoles: roles,
          actualRole: req.user.role,
          method: req.method,
          path: req.originalUrl
        }
      });

      return res.status(403).json({
        success: false,
        authenticated: true,
        authorized: false,
        code: "ROLE_DENIED",
        message: "دور المستخدم الحالي لا يسمح بهذا الإجراء"
      });
    } catch (error) {
      next(error);
    }
  };
}

function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      code: "AUTHENTICATION_REQUIRED",
      message: "تسجيل الدخول مطلوب"
    });
  }

  if (req.user.role === "super_admin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    authenticated: true,
    authorized: false,
    code: "SUPER_ADMIN_REQUIRED",
    message: "هذه العملية متاحة للمدير الأعلى فقط"
  });
}

function getClientIp(req) {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    return String(forwarded)
      .split(",")[0]
      .trim();
  }

  return req.ip || null;
}

async function auditRequest(
  req,
  action,
  details = {}
) {
  try {
    await createAuditLog({
      userId: req.user ? req.user.id : null,
      action,
      module: details.module || null,
      resourceType: details.resourceType || null,
      resourceId: details.resourceId || null,
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
      details
    });
  } catch (error) {
    console.error(
      "EZ MEDIA audit log error:",
      error
    );
  }
}

module.exports = {
  extractToken,
  authenticateRequest,
  optionalAuthentication,
  requirePermission,
  requireRole,
  requireSuperAdmin,
  getClientIp,
  auditRequest
};
