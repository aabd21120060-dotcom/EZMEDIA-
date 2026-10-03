import { Router } from "express";
import { query } from "../config/database.js";

const router = Router();

/*
 * ============================================================
 * EZ MEDIA 11.0
 * PLATFORM ENGINE
 * ============================================================
 *
 * طبقة التشغيل الرئيسية لمنصة EZ MEDIA
 *
 * هذا الملف مسؤول عن:
 *
 * 1. حالة المنصة
 * 2. الأقسام
 * 3. وكلاء الذكاء الاصطناعي
 * 4. القصص
 * 5. المحتوى
 * 6. الوسائط
 * 7. الإنتاج
 * 8. الأتمتة
 * 9. البث المباشر
 * 10. الإعلانات
 * 11. الرعاية
 * 12. التحليلات
 * 13. المستخدمين
 * 14. لوحة الإدارة
 * 15. البحث
 * 16. الإحصائيات
 *
 * ============================================================
 */

/*
 * ============================================================
 * أدوات مساعدة
 * ============================================================
 */

function positiveInteger(value, fallback = 20, max = 100) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }

  return Math.min(number, max);
}

function cleanString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function pagination(req) {
  const limit = positiveInteger(
    req.query.limit,
    20,
    100
  );

  const page = positiveInteger(
    req.query.page,
    1,
    100000
  );

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset
  };
}

/*
 * ============================================================
 * GET /api/platform/health
 * فحص المنصة وقاعدة البيانات
 * ============================================================
 */

router.get(
  "/health",
  async (req, res, next) => {
    try {
      const startedAt = Date.now();

      const result = await query(`
        SELECT
          NOW() AS server_time,
          current_database() AS database_name,
          current_user AS database_user,
          version() AS database_version
      `);

      res.json({
        ok: true,

        service: "EZ MEDIA Platform",

        status: "online",

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
            null,

          version:
            result.rows[0]?.database_version ||
            null
        },

        server: {
          node: process.version,

          environment:
            process.env.NODE_ENV ||
            "development",

          responseTimeMs:
            Date.now() - startedAt
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
            "development",

          pid: process.pid
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
        },

        capabilities: {
          api: true,
          postgres: true,
          cms: true,
          mediaLibrary: true,
          stories: true,
          ai: true,
          automation: true,
          production: true,
          liveStreaming: true,
          advertising: true,
          sponsorships: true,
          analytics: true,
          administration: true
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/sections/full
 * جميع الأقسام النشطة
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
        ORDER BY sort_order ASC, id ASC
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
 * GET /api/platform/sections/:slug
 * قسم واحد
 * ============================================================
 */

router.get(
  "/sections/:slug",
  async (req, res, next) => {
    try {
      const slug = cleanString(
        req.params.slug
      );

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
        [slug]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,

          error: "SECTION_NOT_FOUND",

          message:
            "القسم المطلوب غير موجود."
        });
      }

      return res.json({
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
 * GET /api/platform/ai/:slug
 * وكيل AI محدد
 * ============================================================
 */

router.get(
  "/ai/:slug",
  async (req, res, next) => {
    try {
      const slug = cleanString(
        req.params.slug
      );

      const result = await query(
        `
        SELECT
          id,
          name,
          slug,
          status,
          model,
          description
        FROM ai_agents
        WHERE slug = $1
        LIMIT 1
        `,
        [slug]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,

          error: "AI_AGENT_NOT_FOUND"
        });
      }

      return res.json({
        ok: true,

        agent: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/stories
 * القصص
 * ============================================================
 */

router.get(
  "/stories",
  async (req, res, next) => {
    try {
      const {
        page,
        limit,
        offset
      } = pagination(req);

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
        OFFSET $2
        `,
        [limit, offset]
      );

      res.json({
        ok: true,

        pagination: {
          page,
          limit,
          returned:
            result.rows.length
        },

        stories: result.rows
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
      const limit = positiveInteger(
        req.query.limit,
        20,
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
 * GET /api/platform/content
 * آخر المحتوى
 * ============================================================
 */

router.get(
  "/content",
  async (req, res, next) => {
    try {
      const {
        page,
        limit,
        offset
      } = pagination(req);

      const result = await query(
        `
        SELECT
          id,
          title,
          slug,
          status,
          content_type,
          created_at,
          updated_at
        FROM articles
        ORDER BY created_at DESC
        LIMIT $1
        OFFSET $2
        `,
        [limit, offset]
      );

      res.json({
        ok: true,

        pagination: {
          page,
          limit,
          returned:
            result.rows.length
        },

        content: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/media
 * مكتبة الوسائط
 * ============================================================
 */

router.get(
  "/media",
  async (req, res, next) => {
    try {
      const {
        page,
        limit,
        offset
      } = pagination(req);

      const result = await query(
        `
        SELECT
          id,
          filename,
          mime_type,
          url,
          created_at
        FROM media_assets
        ORDER BY created_at DESC
        LIMIT $1
        OFFSET $2
        `,
        [limit, offset]
      );

      res.json({
        ok: true,

        pagination: {
          page,
          limit,
          returned:
            result.rows.length
        },

        media: result.rows
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
 * سير الأتمتة
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
 * GET /api/platform/live
 * البث المباشر
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
        LIMIT 100
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
 * GET /api/platform/revenue
 * الإيرادات
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
          advertising: {
            campaigns:
              campaigns.rows[0]?.count ||
              0
          },

          sponsorships: {
            contracts:
              sponsorships.rows[0]?.count ||
              0
          }
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
          COUNT(*)::int AS total_events
        FROM analytics_events
      `);

      res.json({
        ok: true,

        analytics: {
          totalEvents:
            result.rows[0]?.total_events ||
            0
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/users
 * المستخدمون
 * ============================================================
 */

router.get(
  "/users",
  async (req, res, next) => {
    try {
      const {
        page,
        limit,
        offset
      } = pagination(req);

      const result = await query(
        `
        SELECT
          id,
          email,
          first_name,
          last_name,
          status,
          created_at,
          last_login_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1
        OFFSET $2
        `,
        [limit, offset]
      );

      res.json({
        ok: true,

        pagination: {
          page,
          limit,
          returned:
            result.rows.length
        },

        users: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/admin/overview
 * لوحة الإدارة
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

        platform: {
          name: "EZ MEDIA",
          version: "11.0.0",
          status: "online"
        },

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
 * GET /api/platform/stats
 * إحصائيات المنصة
 * ============================================================
 */

router.get(
  "/stats",
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT
          (
            SELECT COUNT(*)
            FROM users
          )::int AS users,

          (
            SELECT COUNT(*)
            FROM articles
          )::int AS articles,

          (
            SELECT COUNT(*)
            FROM media_assets
          )::int AS media,

          (
            SELECT COUNT(*)
            FROM stories
          )::int AS stories,

          (
            SELECT COUNT(*)
            FROM ai_agents
          )::int AS ai_agents,

          (
            SELECT COUNT(*)
            FROM production_projects
          )::int AS production_projects,

          (
            SELECT COUNT(*)
            FROM automation_workflows
          )::int AS automation_workflows,

          (
            SELECT COUNT(*)
            FROM live_sessions
          )::int AS live_sessions,

          (
            SELECT COUNT(*)
            FROM ad_campaigns
          )::int AS ad_campaigns,

          (
            SELECT COUNT(*)
            FROM sponsorship_contracts
          )::int AS sponsorships,

          (
            SELECT COUNT(*)
            FROM analytics_events
          )::int AS analytics_events
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
 * GET /api/platform/search
 * البحث الموحد
 * ============================================================
 */

router.get(
  "/search",
  async (req, res, next) => {
    try {
      const term = cleanString(
        req.query.q
      );

      if (!term) {
        return res.status(400).json({
          ok: false,

          error: "SEARCH_QUERY_REQUIRED",

          message:
            "يجب إرسال كلمة البحث في q."
        });
      }

      const limit = positiveInteger(
        req.query.limit,
        20,
        50
      );

      const pattern = `%${term}%`;

      const [
        articles,
        stories,
        media
      ] = await Promise.all([
        query(
          `
          SELECT
            id,
            title,
            slug,
            status,
            'article' AS type,
            created_at
          FROM articles
          WHERE
            title ILIKE $1
            OR content ILIKE $1
          ORDER BY created_at DESC
          LIMIT $2
          `,
          [pattern, limit]
        ),

        query(
          `
          SELECT
            id,
            title,
            slug,
            status,
            'story' AS type,
            created_at
          FROM stories
          WHERE
            title ILIKE $1
          ORDER BY created_at DESC
          LIMIT $2
          `,
          [pattern, limit]
        ),

        query(
          `
          SELECT
            id,
            filename,
            mime_type,
            'media' AS type,
            created_at
          FROM media_assets
          WHERE
            filename ILIKE $1
          ORDER BY created_at DESC
          LIMIT $2
          `,
          [pattern, limit]
        )
      ]);

      res.json({
        ok: true,

        query: term,

        results: {
          articles:
            articles.rows,

          stories:
            stories.rows,

          media:
            media.rows
        },

        total:
          articles.rows.length +
          stories.rows.length +
          media.rows.length
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform/dashboard
 * لوحة موحدة للمنصة
 * ============================================================
 */

router.get(
  "/dashboard",
  async (req, res, next) => {
    try {
      const [
        sections,
        agents,
        users,
        articles,
        media,
        stories,
        projects,
        workflows,
        live,
        campaigns,
        sponsorships,
        analytics
      ] = await Promise.all([
        query(`
          SELECT COUNT(*)::int AS count
          FROM media_sections
          WHERE is_active = true
        `),

        query(`
          SELECT COUNT(*)::int AS count
          FROM ai_agents
        `),

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

        platform: {
          name: "EZ MEDIA",
          version: "11.0.0",
          status: "online"
        },

        dashboard: {
          sections:
            sections.rows[0]?.count || 0,

          aiAgents:
            agents.rows[0]?.count || 0,

          users:
            users.rows[0]?.count || 0,

          articles:
            articles.rows[0]?.count || 0,

          media:
            media.rows[0]?.count || 0,

          stories:
            stories.rows[0]?.count || 0,

          production:
            projects.rows[0]?.count || 0,

          automation:
            workflows.rows[0]?.count || 0,

          live:
            live.rows[0]?.count || 0,

          advertising:
            campaigns.rows[0]?.count || 0,

          sponsorships:
            sponsorships.rows[0]?.count || 0,

          analytics:
            analytics.rows[0]?.count || 0
        },

        generatedAt:
          new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * ============================================================
 * GET /api/platform
 * معلومات عامة
 * ============================================================
 */

router.get(
  "/",
  async (req, res, next) => {
    try {
      res.json({
        ok: true,

        platform: "EZ MEDIA",

        version: "11.0.0",

        service:
          "EZ MEDIA Platform Engine",

        status: "online",

        modules: [
          "system",
          "health",
          "sections",
          "ai",
          "stories",
          "content",
          "media",
          "production",
          "automation",
          "live",
          "advertising",
          "sponsorships",
          "analytics",
          "users",
          "administration",
          "search",
          "dashboard"
        ]
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
