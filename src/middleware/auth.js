import {
  verifyAccessToken
} from "../services/auth.service.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * AUTH MIDDLEWARE
 * ==========================================
 */

export function requireAuth(
  req,
  res,
  next
) {
  try {
    const authorization =
      req.headers.authorization || "";

    if (
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message:
          "يجب تسجيل الدخول للوصول إلى هذا المورد",
        requestId: req.requestId
      });
    }

    const token =
      authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        error: "TOKEN_REQUIRED",
        message:
          "رمز الدخول غير موجود",
        requestId: req.requestId
      });
    }

    const payload =
      verifyAccessToken(token);

    req.auth = payload;

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "INVALID_OR_EXPIRED_TOKEN",
      message:
        "رمز الدخول غير صالح أو منتهي الصلاحية",
      requestId: req.requestId
    });
  }
}

/*
 * ==========================================
 * ROLE CHECK
 * ==========================================
 */

export function requireRole(
  ...allowedRoles
) {
  return (req, res, next) => {
    const roles =
      Array.isArray(req.auth?.roles)
        ? req.auth.roles
        : [];

    const hasRole =
      allowedRoles.some(
        (role) =>
          roles.includes(role)
      );

    if (!hasRole) {
      return res.status(403).json({
        error: "ROLE_FORBIDDEN",
        message:
          "ليس لديك الصلاحية المطلوبة",
        requestId: req.requestId
      });
    }

    return next();
  };
}

/*
 * ==========================================
 * PERMISSION CHECK
 * ==========================================
 */

export function requirePermission(
  ...requiredPermissions
) {
  return (req, res, next) => {
    const permissions =
      Array.isArray(
        req.auth?.permissions
      )
        ? req.auth.permissions
        : [];

    const hasPermission =
      requiredPermissions.every(
        (permission) =>
          permissions.includes(
            permission
          )
      );

    if (!hasPermission) {
      return res.status(403).json({
        error:
          "PERMISSION_FORBIDDEN",
        message:
          "لا تملك الصلاحية لتنفيذ هذا الإجراء",
        requestId: req.requestId
      });
    }

    return next();
  };
}
