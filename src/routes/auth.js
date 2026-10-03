import { Router } from "express";

import {
  login
} from "../services/auth.service.js";

import {
  requireAuth
} from "../middleware/auth.js";

const router = Router();

/*
 * ==========================================
 * EZ MEDIA 11.0
 * AUTH ROUTES
 * ==========================================
 */

/*
 * ==========================================
 * LOGIN
 * ==========================================
 */

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        organizationId,
        email,
        password
      } = req.body;

      const result =
        await login({
          organizationId,
          email,
          password
        });

      return res.json({
        success: true,
        message:
          "تم تسجيل الدخول بنجاح",
        ...result,
        timestamp:
          new Date().toISOString(),
        requestId:
          req.requestId
      });
    } catch (error) {
      if (
        error.message ===
          "ORGANIZATION_EMAIL_PASSWORD_REQUIRED"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "LOGIN_FIELDS_REQUIRED",
          message:
            "organizationId والبريد الإلكتروني وكلمة المرور مطلوبة",
          requestId:
            req.requestId
        });
      }

      if (
        error.message ===
          "INVALID_CREDENTIALS"
      ) {
        return res.status(401).json({
          success: false,
          error:
            "INVALID_CREDENTIALS",
          message:
            "بيانات تسجيل الدخول غير صحيحة",
          requestId:
            req.requestId
        });
      }

      if (
        error.message ===
          "USER_ACCOUNT_INACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          error:
            "USER_ACCOUNT_INACTIVE",
          message:
            "حساب المستخدم غير نشط",
          requestId:
            req.requestId
        });
      }

      console.error(
        "EZ MEDIA LOGIN ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "LOGIN_SERVER_ERROR",
        message:
          "حدث خطأ أثناء تسجيل الدخول",
        requestId:
          req.requestId
      });
    }
  }
);

/*
 * ==========================================
 * CURRENT USER
 * ==========================================
 */

router.get(
  "/me",
  requireAuth,
  async (req, res) => {
    return res.json({
      success: true,

      user: {
        id: req.auth.sub,
        organizationId:
          req.auth.organizationId,
        name: req.auth.name,
        email: req.auth.email
      },

      roles:
        req.auth.roles || [],

      permissions:
        req.auth.permissions || [],

      timestamp:
        new Date().toISOString(),

      requestId:
        req.requestId
    });
  }
);

export default router;
