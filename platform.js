import { Router } from "express";
import { query } from "../config/database.js";

const router = Router();

/*
 * ============================================================
 * EZ MEDIA 11.0
 * PLATFORM ROUTES
 * ============================================================
 *
 * المسارات التشغيلية لمنصة EZ MEDIA
 *
 * GET  /api/platform/sections/full
 * GET  /api/platform/ai
 * GET  /api/platform/admin/overview
 * GET  /api/platform/health
 *
 * ============================================================
 */

/*
 * ============================================================
 * GET /api/platform/sections/full
 * الأقسام الرئيسية للمنصة
 * ============================================================
 */

router.get(
  "/sections/full",
  async (req, res, next) => {
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
  }
);

/*
 * ============================================================
 * GET /api/platform/ai
 * وكلاء الذكاء الاصطناعي
 * ============================================================
 */

router.get(
  "/ai",
  async (req, res, next) => {
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
  }
);

/*
 * ============================================================
 * GET /api/platform/admin/overview
 * لوحة الإدارة - الملخص التشغيلي
 * ============================================================
 */

router.get(
  "/admin/overview",
  async (req, res, next) => {
    try {
      const [
        users,
        articles,
        media,
        agents,
        sections,
        stories,
        projects,
        workflows,
        liveSessions,
        campaigns,
        sponsorships,
        analytics
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
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM media_sections
          WHERE is_active = true
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM stories
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM production_projects
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM automation_workflows
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM live_sessions
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM ad_campaigns
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM sponsorship_contracts
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM analytics_events
        `)
      ]);

      res.json({
        ok: true,

        counts: {
          users:
            users.rows[0]?.count || 0,

          articles:
            articles.rows[0]?.count || 0,

          media:
            media.rows[0]?.count || 0,

          aiAgents:
            agents.rows[0]?.count || 0,

          sections:
            sections.rows[0]?.count || 0,

          stories:
            stories.rows[0]?.count || 0,

          productionProjects:
            projects.rows[0]?.count || 0,

          automationWorkflows:
            workflows.rows[0]?.count || 0,

          liveSessions:
            liveSessions.rows[0]?.count || 0,

          adCampaigns:
            campaigns.rows[0]?.count || 0,

          sponsorshipContracts:
            sponsorships.rows[0]?.count || 0,

          analyticsEvents:
            analytics.rows[0]?.count || 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/health
 * فحص اتصال منصة EZ MEDIA بقاعدة البيانات
 * ============================================================
 */

router.get(
  "/health",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          NOW() AS server_time,
          current_database() AS database_name,
          current_user AS database_user
      `);

      res.json({
        ok: true,

        service:
          "EZ MEDIA Platform API",

        database: {
          connected: true,

          databaseName:
            result.rows[0]?.database_name ||
            null,

          databaseUser:
            result.rows[0]?.database_user ||
            null,

          serverTime:
            result.rows[0]?.server_time ||
            null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/stats
 * إحصائيات تشغيلية سريعة
 * ============================================================
 */

router.get(
  "/stats",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          (SELECT COUNT(*) FROM users)::int
            AS users,

          (SELECT COUNT(*) FROM articles)::int
            AS articles,

          (SELECT COUNT(*) FROM media_assets)::int
            AS media,

          (SELECT COUNT(*) FROM stories)::int
            AS stories,

          (SELECT COUNT(*) FROM ai_agents)::int
            AS ai_agents,

          (SELECT COUNT(*) FROM live_sessions)::int
            AS live_sessions,

          (SELECT COUNT(*) FROM ad_campaigns)::int
            AS ad_campaigns,

          (SELECT COUNT(*) FROM sponsorship_contracts)::int
            AS sponsorships,

          (SELECT COUNT(*) FROM analytics_events)::int
            AS analytics_events
      `);

      res.json({
        ok: true,
        stats: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/sections/:slug
 * جلب قسم محدد
 * ============================================================
 */

router.get(
  "/sections/:slug",
  async (req, res, next) => {
    try {
      const result = await query(
        `
        SELECT
          id,
          slug,
          name_ar,
          name_en,
          sort_order,
          is_active
        FROM media_sections
        WHERE slug = $1
        LIMIT 1
        `,
        [req.params.slug]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          error: "Section not found"
        });
      }

      res.json({
        ok: true,
        section: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/stories/recent
 * آخر القصص
 * ============================================================
 */

router.get(
  "/stories/recent",
  async (req, res, next) => {
    try {
      const limit = Math.min(
        Math.max(
          Number(req.query.limit) || 20,
          1
        ),
        100
      );

      const result = await query(
        `
        SELECT
          id,
          title,
          slug,
          status,
          created_at,
          updated_at
        FROM stories
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit]
      );

      res.json({
        ok: true,
        count: result.rows.length,
        stories: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/live
 * جلسات البث المباشر
 * ============================================================
 */

router.get(
  "/live",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          id,
          title,
          status,
          started_at,
          ended_at,
          created_at
        FROM live_sessions
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json({
        ok: true,
        count: result.rows.length,
        liveSessions: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/production
 * مشاريع الإنتاج
 * ============================================================
 */

router.get(
  "/production",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          status,
          created_at,
          updated_at
        FROM production_projects
        ORDER BY created_at DESC
        LIMIT 100
      `);

      res.json({
        ok: true,
        count: result.rows.length,
        projects: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/automation
 * الأتمتة
 * ============================================================
 */

router.get(
  "/automation",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          id,
          name,
          status,
          created_at,
          updated_at
        FROM automation_workflows
        ORDER BY created_at DESC
        LIMIT 100
      `);

      res.json({
        ok: true,
        count: result.rows.length,
        workflows: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/revenue
 * الإعلانات والرعاية
 * ============================================================
 */

router.get(
  "/revenue",
  async (req, res, next) => {
    try {
      const [
        campaigns,
        sponsorships
      ] = await Promise.all([
        query(`
          SELECT
            COUNT(*)::int AS count
          FROM ad_campaigns
        `),

        query(`
          SELECT
            COUNT(*)::int AS count
          FROM sponsorship_contracts
        `)
      ]);

      res.json({
        ok: true,

        revenue: {
          adCampaigns:
            campaigns.rows[0]?.count || 0,

          sponsorshipContracts:
            sponsorships.rows[0]?.count || 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/analytics
 * التحليلات
 * ============================================================
 */

router.get(
  "/analytics",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          COUNT(*)::int AS total_events,

          COUNT(
            DISTINCT
            COALESCE(
              session_id::text,
              ''
            )
          )::int AS sessions
        FROM analytics_events
      `);

      res.json({
        ok: true,
        analytics: {
          totalEvents:
            result.rows[0]?.total_events || 0,

          sessions:
            result.rows[0]?.sessions || 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/system
 * معلومات النظام
 * ============================================================
 */

router.get(
  "/system",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          current_database() AS database_name,
          current_user AS database_user,
          NOW() AS server_time
      `);

      res.json({
        ok: true,

        platform: "EZ MEDIA",

        version: "11.0.0",

        status: "online",

        server: {
          node: process.version,
          environment:
            process.env.NODE_ENV ||
            "development"
        },

        database: {
          connected: true,

          name:
            result.rows[0]?.database_name ||
            null,

          user:
            result.rows[0]?.database_user ||
            null,

          serverTime:
            result.rows[0]?.server_time ||
            null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * تصدير Router
 * ============================================================
 */

export default router;
