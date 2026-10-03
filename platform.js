import { Router } from "express";
import { query } from "../config/database.js";

const router = Router();

/*
 * ==========================================
 * EZ MEDIA 11.0
 * PLATFORM ROUTES
 * ==========================================
 *
 * هذا الملف مسؤول عن الأنظمة التشغيلية
 * للمنصة، وليس مجرد بيانات تعريفية.
 *
 * المسارات:
 *
 * GET /api/platform/sections/full
 * GET /api/platform/ai
 * GET /api/platform/admin/overview
 *
 */

/*
 * ==========================================
 * الأقسام الرئيسية
 * ==========================================
 */

router.get("/sections/full", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        id,
        slug,
        name_ar,
        name_en,
        sort_order,
        is_active
      FROM media_sections
      WHERE is_active = true
      ORDER BY sort_order ASC
    `);

    res.json({
      ok: true,
      count: result.rows.length,
      sections: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/*
 * ==========================================
 * وكلاء الذكاء الاصطناعي
 * ==========================================
 */

router.get("/ai", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        id,
        name,
        slug,
        status,
        model,
        description
      FROM ai_agents
      ORDER BY id ASC
    `);

    res.json({
      ok: true,
      count: result.rows.length,
      agents: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/*
 * ==========================================
 * لوحة الإدارة - ملخص تشغيلي
 * ==========================================
 */

router.get("/admin/overview", async (req, res, next) => {
  try {
    const [
      users,
      articles,
      media,
      agents
    ] = await Promise.all([
      query(`
        SELECT COUNT(*)::int AS count
        FROM users
      `),

      query(`
        SELECT COUNT(*)::int AS count
        FROM articles
      `),

      query(`
        SELECT COUNT(*)::int AS count
        FROM media_assets
      `),

      query(`
        SELECT COUNT(*)::int AS count
        FROM ai_agents
      `)
    ]);

    res.json({
      ok: true,

      counts: {
        users: users.rows[0]?.count || 0,
        articles: articles.rows[0]?.count || 0,
        media: media.rows[0]?.count || 0,
        aiAgents: agents.rows[0]?.count || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

/*
 * ==========================================
 * فحص تشغيل النظام
 * ==========================================
 */

router.get("/health", async (req, res, next) => {
  try {
    await query("SELECT 1");

    res.json({
      ok: true,
      service: "EZ MEDIA Platform API",
      database: "connected"
    });
  } catch (error) {
    next(error);
  }
});

export default router;
