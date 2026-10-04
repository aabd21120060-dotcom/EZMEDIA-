'use strict';

/*
===========================================================
 EZ MEDIA 11.0
 الخادم الرئيسي
 API مباشر داخل server.js
 Node.js + Express + PostgreSQL
===========================================================
*/

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const PLATFORM = 'EZ MEDIA';
const VERSION = '11.0.0';

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const EXECUTIVE_DIR = path.join(
  PUBLIC_DIR,
  'autonomous-media-operations'
);

/*
===========================================================
 اختياري: الحزم
===========================================================
*/

let cors = null;
let helmet = null;
let compression = null;
let pg = null;

try {
  cors = require('cors');
} catch (error) {
  console.log('[EZ MEDIA] CORS غير متوفر.');
}

try {
  helmet = require('helmet');
} catch (error) {
  console.log('[EZ MEDIA] Helmet غير متوفر.');
}

try {
  compression = require('compression');
} catch (error) {
  console.log('[EZ MEDIA] Compression غير متوفر.');
}

try {
  pg = require('pg');
} catch (error) {
  console.log('[EZ MEDIA] PostgreSQL driver غير متوفر.');
}

/*
===========================================================
 Middleware
===========================================================
*/

app.disable('x-powered-by');

if (cors) {
  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
}

if (helmet) {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );
}

if (compression) {
  app.use(compression());
}

app.use(
  express.json({
    limit: '25mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '25mb'
  })
);

/*
===========================================================
 أدوات
===========================================================
*/

function now() {
  return new Date().toISOString();
}

function sendJSON(res, data, status = 200) {
  return res
    .status(status)
    .set({
      'Cache-Control':
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-EZ-MEDIA-API': VERSION
    })
    .json(data);
}

/*
===========================================================
 PostgreSQL
===========================================================
*/

let pool = null;

let databaseConfigured = false;
let databaseReady = false;
let databaseError = null;

if (pg && process.env.DATABASE_URL) {
  try {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,

      ssl: {
        rejectUnauthorized: false
      },

      max: 10,

      idleTimeoutMillis: 30000,

      connectionTimeoutMillis: 10000
    });

    databaseConfigured = true;

    pool.on('error', (error) => {
      databaseReady = false;
      databaseError = error.message;

      console.error(
        '[EZ MEDIA DATABASE ERROR]',
        error.message
      );
    });

  } catch (error) {

    databaseConfigured = false;
    databaseReady = false;
    databaseError = error.message;

    console.error(
      '[EZ MEDIA DATABASE SETUP ERROR]',
      error.message
    );
  }
}

/*
===========================================================
 قاعدة البيانات
===========================================================
*/

async function initializeDatabase() {

  if (!pool) {

    console.log(
      '[EZ MEDIA] DATABASE_URL غير مهيأ.'
    );

    return;
  }

  try {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ez_media_system_state (
        id INTEGER PRIMARY KEY,
        platform VARCHAR(100) NOT NULL,
        version VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(
      `
      INSERT INTO ez_media_system_state
        (
          id,
          platform,
          version,
          status
        )

      VALUES
        (
          1,
          $1,
          $2,
          $3
        )

      ON CONFLICT (id)

      DO UPDATE SET
        platform = EXCLUDED.platform,
        version = EXCLUDED.version,
        status = EXCLUDED.status,
        updated_at = NOW()
      `,
      [
        PLATFORM,
        VERSION,
        'online'
      ]
    );

    databaseReady = true;
    databaseError = null;

    console.log(
      '[EZ MEDIA] PostgreSQL متصل.'
    );

  } catch (error) {

    databaseReady = false;
    databaseError = error.message;

    console.error(
      '[EZ MEDIA DATABASE INIT ERROR]',
      error.message
    );
  }
}

/*
===========================================================
 حالة النظام
===========================================================
*/

const serverStartedAt = Date.now();

function getDatabaseState() {

  return {
    configured: databaseConfigured,

    ready: databaseReady,

    message:
      databaseConfigured
        ? (
            databaseReady
              ? 'PostgreSQL connected'
              : (
                  databaseError ||
                  'PostgreSQL not ready'
                )
          )
        : 'DATABASE_URL is not configured'
  };
}

function getSystemState() {

  return {

    platform: PLATFORM,

    version: VERSION,

    status: 'online',

    server: {

      online: true,

      node: process.version,

      environment:
        process.env.NODE_ENV ||
        'production',

      uptime: process.uptime(),

      startedAt:
        new Date(
          serverStartedAt
        ).toISOString()
    },

    database:
      getDatabaseState(),

    timestamp: now()
  };
}

/*
===========================================================
 مراقبة كل طلب API
===========================================================
*/

app.use('/api', (req, res, next) => {

  console.log(
    `[EZ MEDIA API] ${req.method} ${req.originalUrl}`
  );

  res.set(
    'X-EZ-MEDIA-API',
    VERSION
  );

  next();
});

/*
===========================================================
 API ROOT
===========================================================
*/

app.get(
  '/api',
  (req, res) => {

    return sendJSON(
      res,
      {
        success: true,

        ok: true,

        platform: PLATFORM,

        version: VERSION,

        api: 'online',

        architecture:
          'direct-server-api',

        router:
          'disabled',

        database:
          getDatabaseState(),

        endpoints: {

          root:
            '/api',

          status:
            '/api/status',

          health:
            '/api/health',

          modules:
            '/api/modules',

          stories:
            '/api/stories',

          agents:
            '/api/ai/agents',

          workflow:
            '/api/workflow/queue',

          executivePing:
            '/api/executive-command/ping',

          executiveStatus:
            '/api/executive-command/status'
        },

        timestamp: now()
      }
    );
  }
);

/*
===========================================================
 API STATUS
===========================================================
*/

app.get(
  '/api/status',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        platform: PLATFORM,

        version: VERSION,

        status: 'online',

        api: {

          online: true,

          architecture:
            'direct-server-api',

          router:
            false
        },

        server: {

          online: true,

          node:
            process.version,

          uptime:
            process.uptime()
        },

        database:
          getDatabaseState(),

        modules: {

          api: true,

          cms: true,

          stories: true,

          ai: true,

          workflow: true,

          executiveCommand: true,

          autonomousOperations: true,

          mediaLibrary: true,

          advertising: true,

          sponsorships: true,

          crm: true,

          broadcasting: true,

          scheduling: true,

          security: true,

          legal: true,

          ethics: true
        },

        timestamp: now()
      }
    );
  }
);

/*
===========================================================
 API HEALTH
===========================================================
*/

app.get(
  '/api/health',
  async (req, res) => {

    let database =
      getDatabaseState();

    if (pool) {

      try {

        await pool.query(
          'SELECT 1'
        );

        databaseReady = true;
        databaseError = null;

        database =
          getDatabaseState();

      } catch (error) {

        databaseReady = false;
        databaseError = error.message;

        database =
          getDatabaseState();
      }
    }

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        platform: PLATFORM,

        version: VERSION,

        health: {

          api: 'healthy',

          server: 'healthy',

          database:
            database.ready
              ? 'healthy'
              : (
                  database.configured
                    ? 'degraded'
                    : 'not-configured'
                )
        },

        database,

        timestamp: now()
      }
    );
  }
);

/*
===========================================================
 API MODULES
===========================================================
*/

app.get(
  '/api/modules',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        platform: PLATFORM,

        version: VERSION,

        modules: [

          {
            id: 'api',
            name: 'API',
            status: 'online'
          },

          {
            id: 'cms',
            name: 'CMS',
            status: 'ready'
          },

          {
            id: 'ai',
            name: 'AI Orchestration',
            status: 'ready'
          },

          {
            id: 'workflow',
            name: 'Workflow Engine',
            status: 'ready'
          },

          {
            id: 'executive',
            name: 'Executive Command Center',
            status: 'online'
          },

          {
            id: 'operations',
            name: 'Autonomous Media Operations',
            status: 'online'
          },

          {
            id: 'database',
            name: 'PostgreSQL',
            status:
              databaseConfigured
                ? (
                    databaseReady
                      ? 'online'
                      : 'degraded'
                  )
                : 'not-configured'
          },

          {
            id: 'broadcasting',
            name: 'Broadcasting',
            status: 'ready'
          },

          {
            id: 'advertising',
            name: 'Advertising',
            status: 'ready'
          },

          {
            id: 'sponsorships',
            name: 'Sponsorships',
            status: 'ready'
          },

          {
            id: 'crm',
            name: 'CRM',
            status: 'ready'
          },

          {
            id: 'security',
            name: 'Security',
            status: 'ready'
          },

          {
            id: 'legal',
            name: 'Legal',
            status: 'ready'
          },

          {
            id: 'ethics',
            name: 'Ethics',
            status: 'ready'
          }
        ],

        timestamp: now()
      }
    );
  }
);

/*
===========================================================
 STORIES
===========================================================
*/

const stories = new Map();

function createId() {

  return (
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 10)
  );
}

app.get(
  '/api/stories',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        total:
          stories.size,

        items:
          Array.from(
            stories.values()
          ),

        timestamp: now()
      }
    );
  }
);

app.post(
  '/api/stories',
  (req, res) => {

    const body =
      req.body || {};

    const story = {

      id:
        createId(),

      title:
        body.title ||
        null,

      summary:
        body.summary ||
        null,

      category:
        body.category ||
        null,

      status:
        body.status ||
        'draft',

      source:
        body.source ||
        null,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    stories.set(
      story.id,
      story
    );

    return sendJSON(
      res,
      {
        success: true,
        ok: true,
        story
      },
      201
    );
  }
);

app.get(
  '/api/stories/:id',
  (req, res) => {

    const story =
      stories.get(
        req.params.id
      );

    if (!story) {

      return sendJSON(
        res,
        {
          success: false,
          ok: false,
          error:
            'Story not found'
        },
        404
      );
    }

    return sendJSON(
      res,
      {
        success: true,
        ok: true,
        story
      }
    );
  }
);

app.patch(
  '/api/stories/:id',
  (req, res) => {

    const story =
      stories.get(
        req.params.id
      );

    if (!story) {

      return sendJSON(
        res,
        {
          success: false,
          ok: false,
          error:
            'Story not found'
        },
        404
      );
    }

    const body =
      req.body || {};

    const updated = {

      ...story,

      ...body,

      id:
        story.id,

      updatedAt:
        now()
    };

    stories.set(
      story.id,
      updated
    );

    return sendJSON(
      res,
      {
        success: true,
        ok: true,
        story: updated
      }
    );
  }
);

/*
===========================================================
 AI AGENTS
===========================================================
*/

app.get(
  '/api/ai',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        ai: {

          enabled: true,

          architecture:
            'orchestration-ready',

          providerConfigured:
            Boolean(
              process.env.OPENAI_API_KEY ||
              process.env.AI_API_KEY
            ),

          humanApprovalRequired:
            true
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/ai/agents',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        agents: [

          {
            id: 'news-analysis',
            name: 'News Analysis Agent',
            status: 'ready'
          },

          {
            id: 'verification',
            name: 'Verification Agent',
            status: 'ready'
          },

          {
            id: 'editorial',
            name: 'Editorial Agent',
            status: 'ready'
          },

          {
            id: 'content',
            name: 'Content Agent',
            status: 'ready'
          },

          {
            id: 'audience',
            name: 'Audience Agent',
            status: 'ready'
          },

          {
            id: 'advertising',
            name: 'Advertising Agent',
            status: 'ready'
          },

          {
            id: 'sponsorship',
            name: 'Sponsorship Agent',
            status: 'ready'
          },

          {
            id: 'security',
            name: 'Security Agent',
            status: 'ready'
          },

          {
            id: 'legal',
            name: 'Legal Review Agent',
            status: 'ready'
          },

          {
            id: 'ethics',
            name: 'Ethics Review Agent',
            status: 'ready'
          }
        ],

        humanApprovalRequired:
          true,

        timestamp: now()
      }
    );
  }
);

/*
===========================================================
 WORKFLOW
===========================================================
*/

const workflowJobs = [];

app.get(
  '/api/workflow/queue',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        total:
          workflowJobs.length,

        queue:
          workflowJobs,

        timestamp: now()
      }
    );
  }
);

app.post(
  '/api/workflow/jobs',
  (req, res) => {

    const body =
      req.body || {};

    const job = {

      id:
        createId(),

      type:
        body.type ||
        'general',

      status:
        'pending',

      payload:
        body.payload ||
        {},

      createdAt:
        now()
    };

    workflowJobs.push(
      job
    );

    return sendJSON(
      res,
      {
        success: true,
        ok: true,
        job
      },
      201
    );
  }
);

/*
===========================================================
 EXECUTIVE COMMAND
===========================================================
*/

app.get(
  '/api/executive-command/ping',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        platform: PLATFORM,

        version: VERSION,

        service:
          'Executive Command Center',

        status:
          'reachable',

        message:
          'Executive Command API is reachable.',

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/status',
  async (req, res) => {

    let database =
      getDatabaseState();

    if (pool) {

      try {

        await pool.query(
          'SELECT 1'
        );

        databaseReady = true;
        databaseError = null;

        database =
          getDatabaseState();

      } catch (error) {

        databaseReady = false;
        databaseError = error.message;

        database =
          getDatabaseState();
      }
    }

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        platform: PLATFORM,

        version: VERSION,

        status: 'online',

        database,

        executive: {

          automation:
            'ready',

          broadcasting:
            'ready',

          scheduling:
            'ready',

          workflow:
            'ready',

          operations:
            'online'
        },

        ai: {

          enabled: true,

          mode:
            'orchestration-ready',

          humanApprovalRequired:
            true
        },

        business: {

          advertising:
            'ready',

          sponsorships:
            'ready',

          crm:
            'ready'
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/health',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        service:
          'Executive Command Center',

        health: {

          api:
            'healthy',

          server:
            'healthy',

          database:
            databaseConfigured
              ? (
                  databaseReady
                    ? 'healthy'
                    : 'degraded'
                )
              : 'not-configured',

          interface:
            'available'
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/dashboard',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        dashboard: {

          status:
            'online',

          systems: {

            total: 0,

            online: 0,

            degraded: 0,

            offline: 0
          },

          operations: {

            active: 0,

            pending: 0,

            completed: 0,

            failed: 0
          },

          ai: {

            enabled: true,

            agents: 10,

            missions: 0
          },

          approvals: {

            pending: 0,

            required: 0
          },

          business: {

            audience: null,

            advertising: null,

            revenue: null,

            crm: null
          }
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/systems',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        systems: [

          {
            id: 'api',
            name: 'API',
            status: 'online'
          },

          {
            id: 'executive-command',
            name:
              'Executive Command Center',
            status: 'online'
          },

          {
            id: 'autonomous-operations',
            name:
              'Autonomous Media Operations',
            status: 'online'
          },

          {
            id: 'database',
            name: 'PostgreSQL',
            status:
              databaseConfigured
                ? (
                    databaseReady
                      ? 'online'
                      : 'degraded'
                  )
                : 'not-configured'
          },

          {
            id: 'ai',
            name:
              'AI Orchestration',
            status:
              'ready'
          }
        ],

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/ai',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        ai: {

          enabled: true,

          autonomousMode:
            true,

          humanApprovalRequired:
            true,

          agents:
            10,

          missions:
            0,

          capabilities: [

            'news-analysis',

            'content-analysis',

            'verification',

            'editorial-assistance',

            'broadcast-preparation',

            'audience-analysis',

            'advertising-assistance',

            'business-assistance',

            'security-analysis',

            'legal-review',

            'ethics-review',

            'executive-analysis'
          ]
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/operations',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        operations: {

          status:
            'online',

          active: 0,

          pending: 0,

          completed: 0,

          failed: 0
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/business',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        business: {

          audience:
            null,

          advertising: {

            status:
              'ready'
          },

          sponsorships: {

            status:
              'ready'
          },

          crm: {

            status:
              'ready'
          },

          revenue:
            null
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/approvals',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        approvals: {

          pending:
            0,

          required:
            0,

          items:
            []
        },

        policy: {

          humanApprovalRequired:
            true,

          automaticPublishing:
            false,

          automaticBroadcasting:
            false
        },

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/executive-command/matrix',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        matrix: {

          api:
            'online',

          database:
            databaseConfigured
              ? (
                  databaseReady
                    ? 'online'
                    : 'degraded'
                )
              : 'not-configured',

          ai:
            'ready',

          operations:
            'online',

          automation:
            'ready',

          broadcasting:
            'ready',

          scheduling:
            'ready',

          advertising:
            'ready',

          sponsorships:
            'ready',

          crm:
            'ready',

          security:
            'ready',

          legal:
            'ready',

          ethics:
            'ready'
        },

        timestamp: now()
      }
    );
  }
);

app.post(
  '/api/executive-command/refresh',
  async (req, res) => {

    if (pool) {

      try {

        await pool.query(
          'SELECT 1'
        );

        databaseReady = true;
        databaseError = null;

      } catch (error) {

        databaseReady = false;
        databaseError =
          error.message;
      }
    }

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        refreshed:
          true,

        database:
          getDatabaseState(),

        timestamp:
          now()
      }
    );
  }
);

app.post(
  '/api/executive-command/analysis',
  (req, res) => {

    const body =
      req.body || {};

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        analysis: {

          mode:
            'local-orchestration',

          requestReceived:
            true,

          topic:
            body.topic ||
            null,

          recommendation:
            'يجب استخدام بيانات حقيقية قبل اتخاذ أي قرار تنفيذي.',

          requiresHumanApproval:
            true
        },

        timestamp: now()
      }
    );
  }
);

/*
===========================================================
 OPERATIONS
===========================================================
*/

app.get(
  '/api/operations/health',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        service:
          'Autonomous Media Operations Center',

        status:
          'online',

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/operations/status',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        status:
          'online',

        automation: {

          enabled:
            true,

          autoNews:
            true,

          autoContent:
            true,

          autoDistribution:
            false,

          autoBroadcast:
            false
        },

        humanApprovalRequired:
          true,

        timestamp: now()
      }
    );
  }
);

app.get(
  '/api/operations/dashboard',
  (req, res) => {

    return sendJSON(
      res,
      {

        success: true,

        ok: true,

        dashboard: {

          status:
            'online',

          activeOperations:
            0,

          pendingOperations:
            0,

          approvals:
            0,

          events:
            0
        },

        timestamp:
          now()
      }
    );
  }
);

/*
===========================================================
 CONTENT
===========================================================
*/

app.get(
  '/api/content',
  (req, res) => {

    return sendJSON(
      res,
      {

        success:
          true,

        ok:
          true,

        items:
          [],

        total:
          0,

        timestamp:
          now()
      }
    );
  }
);

/*
===========================================================
 LIVE
===========================================================
*/

app.get(
  '/api/live',
  (req, res) => {

    return sendJSON(
      res,
      {

        success:
          true,

        ok:
          true,

        live: {

          status:
            'ready',

          active:
            false,

          broadcastConfigured:
            false
        },

        timestamp:
          now()
      }
    );
  }
);

/*
===========================================================
 AUTOMATION
===========================================================
*/

app.get(
  '/api/automation',
  (req, res) => {

    return sendJSON(
      res,
      {

        success:
          true,

        ok:
          true,

        automation: {

          enabled:
            true,

          status:
            'ready',

          humanApprovalRequired:
            true
        },

        timestamp:
          now()
      }
    );
  }
);

/*
===========================================================
 STORAGE
===========================================================
*/

app.get(
  '/api/storage',
  (req, res) => {

    const configured =
      Boolean(
        process.env.STORAGE_BUCKET ||
        process.env.S3_BUCKET ||
        process.env.CLOUDINARY_URL
      );

    return sendJSON(
      res,
      {

        success:
          true,

        ok:
          true,

        storage: {

          configured,

          provider:
            null
        },

        timestamp:
          now()
      }
    );
  }
);

/*
===========================================================
 UPLOAD
===========================================================
*/

app.post(
  '/api/upload',
  (req, res) => {

    return sendJSON(
      res,
      {

        success:
          false,

        ok:
          false,

        message:
          'خدمة رفع الملفات تحتاج ربط التخزين السحابي الفعلي.',

        configured:
          false,

        timestamp:
          now()
      },

      501
    );
  }
);

/*
===========================================================
 ROOT
===========================================================
*/

app.get(
  '/',
  (req, res) => {

    return sendJSON(
      res,
      {

        ...getSystemState(),

        message:
          'EZ MEDIA 11.0 is running.',

        architecture:
          'Direct Server API',

        api:
          '/api',

        apiStatus:
          '/api/status',

        apiHealth:
          '/api/health',

        operations:
          '/autonomous-media-operations/'
      }
    );
  }
);

/*
===========================================================
 HEALTH
===========================================================
*/

app.get(
  '/health',
  (req, res) => {

    return sendJSON(
      res,
      {

        ...getSystemState(),

        health:
          databaseConfigured
            ? (
                databaseReady
                  ? 'healthy'
                  : 'degraded'
              )
            : 'healthy-without-database'
      }
    );
  }
);

/*
===========================================================
 واجهة مركز العمليات
===========================================================
*/

if (fs.existsSync(EXECUTIVE_DIR)) {

  app.use(
    '/autonomous-media-operations',
    express.static(
      EXECUTIVE_DIR,
      {
        index:
          'index.html',

        fallthrough:
          true
      }
    )
  );
}

app.get(
  '/autonomous-media-operations',
  (req, res) => {

    const indexFile =
      path.join(
        EXECUTIVE_DIR,
        'index.html'
      );

    if (
      fs.existsSync(
        indexFile
      )
    ) {

      return res.sendFile(
        indexFile
      );
    }

    return sendJSON(
      res,
      {

        success:
          false,

        ok:
          false,

        error:
          'Executive UI index.html not found',

        expectedPath:
          indexFile
      },

      404
    );
  }
);

app.get(
  '/autonomous-media-operations/',
  (req, res) => {

    const indexFile =
      path.join(
        EXECUTIVE_DIR,
        'index.html'
      );

    if (
      fs.existsSync(
        indexFile
      )
    ) {

      return res.sendFile(
        indexFile
      );
    }

    return sendJSON(
      res,
      {

        success:
          false,

        ok:
          false,

        error:
          'Executive UI index.html not found',

        expectedPath:
          indexFile
      },

      404
    );
  }
);

/*
===========================================================
 PUBLIC
===========================================================
*/

if (
  fs.existsSync(
    PUBLIC_DIR
  )
) {

  app.use(
    express.static(
      PUBLIC_DIR,
      {
        fallthrough:
          true
      }
    )
  );
}

/*
===========================================================
 404
===========================================================
*/

app.use(
  (req, res) => {

    return sendJSON(
      res,
      {

        success:
          false,

        ok:
          false,

        error:
          'Not Found',

        path:
          req.originalUrl,

        method:
          req.method,

        platform:
          PLATFORM,

        version:
          VERSION,

        timestamp:
          now()
      },

      404
    );
  }
);

/*
===========================================================
 ERROR HANDLER
===========================================================
*/

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      '[EZ MEDIA SERVER ERROR]',
      error
    );

    if (
      res.headersSent
    ) {

      return next(
        error
      );
    }

    return sendJSON(
      res,
      {

        success:
          false,

        ok:
          false,

        error:
          'Internal Server Error',

        message:
          process.env.NODE_ENV ===
          'production'

            ? 'حدث خطأ داخلي في الخادم.'

            : error.message,

        timestamp:
          now()
      },

      500
    );
  }
);

/*
===========================================================
 START
===========================================================
*/

async function startServer() {

  console.log('');
  console.log(
    '=============================================='
  );

  console.log(
    ' EZ MEDIA 11.0'
  );

  console.log(
    ' DIRECT API SERVER'
  );

  console.log(
    '=============================================='
  );

  console.log(
    `Node: ${process.version}`
  );

  console.log(
    `Environment: ${
      process.env.NODE_ENV ||
      'production'
    }`
  );

  console.log(
    `Port: ${PORT}`
  );

  console.log(
    `Database configured: ${
      databaseConfigured
    }`
  );

  console.log(
    'API Router: DISABLED'
  );

  console.log(
    'API Architecture: DIRECT'
  );

  console.log(
    '=============================================='
  );

  await initializeDatabase();

  app.listen(
    PORT,
    HOST,
    () => {

      console.log('');

      console.log(
        '=============================================='
      );

      console.log(
        ' EZ MEDIA SERVER ONLINE'
      );

      console.log(
        '=============================================='
      );

      console.log(
        `http://${HOST}:${PORT}`
      );

      console.log('');

      console.log(
        'API: /api'
      );

      console.log(
        'API Status: /api/status'
      );

      console.log(
        'API Health: /api/health'
      );

      console.log(
        'API Modules: /api/modules'
      );

      console.log(
        'Executive Ping: /api/executive-command/ping'
      );

      console.log(
        'Executive Status: /api/executive-command/status'
      );

      console.log(
        'Operations: /autonomous-media-operations/'
      );

      console.log('');

      console.log(
        'DIRECT API READY'
      );

      console.log(
        '=============================================='
      );
    }
  );
}

startServer().catch(
  (error) => {

    console.error(
      '[EZ MEDIA FATAL ERROR]',
      error
    );

    process.exit(1);
  }
);
