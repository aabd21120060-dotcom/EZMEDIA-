'use strict';

/*
===========================================================
 EZ MEDIA 11.0
 الخادم الرئيسي
 Node.js + Express + PostgreSQL
===========================================================
*/

const express = require('express');
const path = require('path');
const fs = require('fs');

let cors;
let helmet;
let compression;
let pg;

try {
  cors = require('cors');
} catch (_) {
  cors = null;
}

try {
  helmet = require('helmet');
} catch (_) {
  helmet = null;
}

try {
  compression = require('compression');
} catch (_) {
  compression = null;
}

try {
  pg = require('pg');
} catch (_) {
  pg = null;
}

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
 إعدادات عامة
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
 أدوات مساعدة
===========================================================
*/

function now() {
  return new Date().toISOString();
}

function sendJSON(res, data, status = 200) {
  res
    .status(status)
    .set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    .set('Pragma', 'no-cache')
    .set('Expires', '0')
    .json(data);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
      databaseError = error.message;
      console.error('[DATABASE ERROR]', error.message);
    });
  } catch (error) {
    databaseError = error.message;
  }
}

/*
===========================================================
 تهيئة قاعدة البيانات
===========================================================
*/

async function initializeDatabase() {
  if (!pool) {
    return {
      configured: false,
      ready: false,
      message: 'DATABASE_URL is not configured'
    };
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ez_media_system_state (
        id INTEGER PRIMARY KEY,
        platform VARCHAR(100),
        version VARCHAR(50),
        status VARCHAR(50),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      INSERT INTO ez_media_system_state
        (id, platform, version, status)
      VALUES
        (1, $1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET
        platform = EXCLUDED.platform,
        version = EXCLUDED.version,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      PLATFORM,
      VERSION,
      'online'
    ]);

    databaseReady = true;
    databaseError = null;

    return {
      configured: true,
      ready: true,
      message: 'PostgreSQL connected'
    };
  } catch (error) {
    databaseReady = false;
    databaseError = error.message;

    console.error('[DATABASE INIT ERROR]', error.message);

    return {
      configured: true,
      ready: false,
      message: error.message
    };
  }
}

/*
===========================================================
 الحالة الأساسية
===========================================================
*/

const serverStartedAt = Date.now();

function baseSystemState() {
  return {
    platform: PLATFORM,
    version: VERSION,
    status: 'online',

    server: {
      node: process.version,
      environment: process.env.NODE_ENV || 'production',
      uptime: process.uptime(),
      startedAt: new Date(serverStartedAt).toISOString(),
      timestamp: now()
    },

    database: {
      configured: databaseConfigured,
      ready: databaseReady,
      message: databaseConfigured
        ? (
            databaseReady
              ? 'PostgreSQL connected'
              : (databaseError || 'PostgreSQL not ready')
          )
        : 'DATABASE_URL is not configured'
    }
  };
}

/*
===========================================================
 ROOT
===========================================================
*/

app.get('/', (req, res) => {
  sendJSON(res, {
    ...baseSystemState(),

    message: 'EZ MEDIA 11.0 API is running',

    endpoints: {
      health: '/health',
      api: '/api',
      executivePing: '/api/executive-command/ping',
      executiveStatus: '/api/executive-command/status',
      executiveDashboard: '/api/executive-command/dashboard',
      operationsCenter: '/autonomous-media-operations/'
    },

    timestamp: now()
  });
});

/*
===========================================================
 HEALTH
===========================================================
*/

app.get('/health', (req, res) => {
  sendJSON(res, {
    ...baseSystemState(),
    health: databaseConfigured
      ? (databaseReady ? 'healthy' : 'degraded')
      : 'healthy-without-database'
  });
});

/*
===========================================================
 API ROOT
===========================================================
*/

app.get('/api', (req, res) => {
  sendJSON(res, {
    platform: PLATFORM,
    version: VERSION,
    status: 'online',

    services: {
      executiveCommand: true,
      autonomousOperations: true,
      database: databaseConfigured,
      api: true
    },

    endpoints: [
      '/api/executive-command/ping',
      '/api/executive-command/status',
      '/api/executive-command/health',
      '/api/executive-command/dashboard',
      '/api/executive-command/systems',
      '/api/executive-command/ai',
      '/api/executive-command/operations',
      '/api/executive-command/business',
      '/api/executive-command/approvals',
      '/api/executive-command/matrix'
    ],

    timestamp: now()
  });
});

/*
===========================================================
 EXECUTIVE COMMAND
 مهم:
 جميع هذه المسارات قبل أي 404
===========================================================
*/

/*
-----------------------------------------------------------
 PING
-----------------------------------------------------------
*/

app.get('/api/executive-command/ping', (req, res) => {
  sendJSON(res, {
    ok: true,
    success: true,

    platform: PLATFORM,
    version: VERSION,

    service: 'Executive Command Center',

    message: 'Executive Command API is reachable',

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 STATUS
-----------------------------------------------------------
*/

app.get('/api/executive-command/status', async (req, res) => {
  let db = {
    configured: databaseConfigured,
    ready: databaseReady,
    message: databaseConfigured
      ? (
          databaseReady
            ? 'PostgreSQL connected'
            : (databaseError || 'PostgreSQL not ready')
        )
      : 'DATABASE_URL is not configured'
  };

  /*
  إذا كانت قاعدة البيانات متصلة نتحقق منها فعليًا
  */
  if (pool) {
    try {
      await pool.query('SELECT 1');
      databaseReady = true;
      databaseError = null;

      db = {
        configured: true,
        ready: true,
        message: 'PostgreSQL connected'
      };
    } catch (error) {
      databaseReady = false;
      databaseError = error.message;

      db = {
        configured: true,
        ready: false,
        message: error.message
      };
    }
  }

  sendJSON(res, {
    ok: true,
    success: true,

    platform: PLATFORM,
    version: VERSION,

    status: 'online',

    server: {
      online: true,
      node: process.version,
      environment: process.env.NODE_ENV || 'production',
      uptime: process.uptime()
    },

    database: db,

    executive: {
      automation: 'ready',
      broadcasting: 'ready',
      scheduling: 'ready',
      workflow: 'ready'
    },

    ai: {
      enabled: true,
      mode: 'orchestration-ready',
      humanApprovalRequired: true
    },

    operations: {
      center: 'online',
      autonomous: true,
      humanApprovalRequired: true
    },

    business: {
      advertising: 'ready',
      sponsorships: 'ready',
      crm: 'ready'
    },

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 HEALTH
-----------------------------------------------------------
*/

app.get('/api/executive-command/health', (req, res) => {
  sendJSON(res, {
    ok: true,

    platform: PLATFORM,
    version: VERSION,

    service: 'Executive Command Center',

    health: {
      api: 'healthy',
      server: 'healthy',
      database: databaseConfigured
        ? (databaseReady ? 'healthy' : 'degraded')
        : 'not-configured',
      interface: 'available'
    },

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 DASHBOARD
-----------------------------------------------------------
*/

app.get('/api/executive-command/dashboard', (req, res) => {
  sendJSON(res, {
    ok: true,

    platform: PLATFORM,
    version: VERSION,

    dashboard: {
      status: 'online',

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
        agents: 0,
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
  });
});

/*
-----------------------------------------------------------
 SYSTEMS
-----------------------------------------------------------
*/

app.get('/api/executive-command/systems', (req, res) => {
  sendJSON(res, {
    ok: true,

    systems: [
      {
        id: 'api',
        name: 'API',
        status: 'online'
      },
      {
        id: 'executive-command',
        name: 'Executive Command Center',
        status: 'online'
      },
      {
        id: 'autonomous-operations',
        name: 'Autonomous Media Operations',
        status: 'online'
      },
      {
        id: 'database',
        name: 'PostgreSQL',
        status: databaseConfigured
          ? (databaseReady ? 'online' : 'degraded')
          : 'not-configured'
      },
      {
        id: 'ai',
        name: 'AI Orchestration',
        status: 'ready'
      }
    ],

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 AI
-----------------------------------------------------------
*/

app.get('/api/executive-command/ai', (req, res) => {
  sendJSON(res, {
    ok: true,

    ai: {
      enabled: true,
      autonomousMode: true,
      humanApprovalRequired: true,

      agents: {
        total: 0,
        active: 0
      },

      missions: {
        total: 0,
        active: 0
      },

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
  });
});

/*
-----------------------------------------------------------
 OPERATIONS
-----------------------------------------------------------
*/

app.get('/api/executive-command/operations', (req, res) => {
  sendJSON(res, {
    ok: true,

    operations: {
      status: 'online',
      active: 0,
      pending: 0,
      completed: 0,
      failed: 0
    },

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 BUSINESS
-----------------------------------------------------------
*/

app.get('/api/executive-command/business', (req, res) => {
  sendJSON(res, {
    ok: true,

    business: {
      audience: null,
      advertising: {
        status: 'ready'
      },
      sponsorships: {
        status: 'ready'
      },
      crm: {
        status: 'ready'
      },
      revenue: null
    },

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 APPROVALS
-----------------------------------------------------------
*/

app.get('/api/executive-command/approvals', (req, res) => {
  sendJSON(res, {
    ok: true,

    approvals: {
      pending: 0,
      required: 0,
      items: []
    },

    policy: {
      humanApprovalRequired: true,
      automaticPublishing: false,
      automaticBroadcasting: false
    },

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 MATRIX
-----------------------------------------------------------
*/

app.get('/api/executive-command/matrix', (req, res) => {
  sendJSON(res, {
    ok: true,

    matrix: {
      api: 'online',
      database: databaseConfigured
        ? (databaseReady ? 'online' : 'degraded')
        : 'not-configured',

      ai: 'ready',
      operations: 'online',
      automation: 'ready',
      broadcasting: 'ready',
      scheduling: 'ready',
      advertising: 'ready',
      sponsorships: 'ready',
      crm: 'ready',
      security: 'ready',
      legal: 'ready',
      ethics: 'ready'
    },

    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 REFRESH
-----------------------------------------------------------
*/

app.post('/api/executive-command/refresh', async (req, res) => {
  if (pool) {
    try {
      await pool.query('SELECT 1');
      databaseReady = true;
      databaseError = null;
    } catch (error) {
      databaseReady = false;
      databaseError = error.message;
    }
  }

  sendJSON(res, {
    ok: true,
    refreshed: true,
    timestamp: now()
  });
});

/*
-----------------------------------------------------------
 ANALYSIS
-----------------------------------------------------------
*/

app.post('/api/executive-command/analysis', (req, res) => {
  const request = req.body || {};

  sendJSON(res, {
    ok: true,

    analysis: {
      mode: 'local-orchestration',
      requestReceived: true,
      topic: request.topic || null,
      recommendation:
        'يجب استخدام بيانات حقيقية قبل اتخاذ أي قرار تنفيذي.',
      requiresHumanApproval: true
    },

    timestamp: now()
  });
});

/*
===========================================================
 AUTONOMOUS MEDIA OPERATIONS
===========================================================
*/

app.get('/api/operations/health', (req, res) => {
  sendJSON(res, {
    ok: true,
    service: 'Autonomous Media Operations Center',
    status: 'online',
    timestamp: now()
  });
});

app.get('/api/operations/status', (req, res) => {
  sendJSON(res, {
    ok: true,
    status: 'online',

    automation: {
      enabled: true,
      autoNews: true,
      autoContent: true,
      autoDistribution: false,
      autoBroadcast: false
    },

    humanApprovalRequired: true,

    timestamp: now()
  });
});

app.get('/api/operations/dashboard', (req, res) => {
  sendJSON(res, {
    ok: true,

    dashboard: {
      status: 'online',
      activeOperations: 0,
      pendingOperations: 0,
      approvals: 0,
      events: 0
    },

    timestamp: now()
  });
});

app.get('/api/operations/statistics', (req, res) => {
  sendJSON(res, {
    ok: true,

    statistics: {
      events: 0,
      operations: 0,
      active: 0,
      completed: 0,
      failed: 0,
      approvals: 0
    },

    timestamp: now()
  });
});

app.post('/api/operations/start', (req, res) => {
  sendJSON(res, {
    ok: true,
    status: 'started',
    message: 'تم تشغيل مركز العمليات.',
    timestamp: now()
  });
});

app.post('/api/operations/stop', (req, res) => {
  sendJSON(res, {
    ok: true,
    status: 'stopped',
    message: 'تم إيقاف مركز العمليات.',
    timestamp: now()
  });
});

/*
===========================================================
 المحتوى
===========================================================
*/

app.get('/api/content', (req, res) => {
  sendJSON(res, {
    ok: true,
    items: [],
    total: 0,
    timestamp: now()
  });
});

/*
===========================================================
 AI
===========================================================
*/

app.get('/api/ai', (req, res) => {
  sendJSON(res, {
    ok: true,

    ai: {
      enabled: true,
      providerConfigured: Boolean(
        process.env.OPENAI_API_KEY ||
        process.env.AI_API_KEY
      ),
      humanApprovalRequired: true
    },

    timestamp: now()
  });
});

/*
===========================================================
 LIVE
===========================================================
*/

app.get('/api/live', (req, res) => {
  sendJSON(res, {
    ok: true,

    live: {
      status: 'ready',
      active: false,
      broadcastConfigured: false
    },

    timestamp: now()
  });
});

/*
===========================================================
 AUTOMATION
===========================================================
*/

app.get('/api/automation', (req, res) => {
  sendJSON(res, {
    ok: true,

    automation: {
      enabled: true,
      status: 'ready',
      humanApprovalRequired: true
    },

    timestamp: now()
  });
});

/*
===========================================================
 STORAGE
===========================================================
*/

app.get('/api/storage', (req, res) => {
  sendJSON(res, {
    ok: true,

    storage: {
      configured: Boolean(
        process.env.STORAGE_BUCKET ||
        process.env.S3_BUCKET ||
        process.env.CLOUDINARY_URL
      ),

      provider: null
    },

    timestamp: now()
  });
});

/*
===========================================================
 UPLOAD
===========================================================
*/

app.post('/api/upload', (req, res) => {
  sendJSON(res, {
    ok: false,

    message:
      'خدمة رفع الملفات تحتاج ربط التخزين السحابي الفعلي قبل استقبال الملفات.',

    configured: false,

    timestamp: now()
  }, 501);
});

/*
===========================================================
 STATIC FILES
===========================================================
*/

if (fs.existsSync(EXECUTIVE_DIR)) {
  app.use(
    '/autonomous-media-operations',
    express.static(EXECUTIVE_DIR, {
      index: 'index.html',
      fallthrough: true
    })
  );
}

/*
-----------------------------------------------------------
 المسار المباشر للواجهة
-----------------------------------------------------------
*/

app.get(
  '/autonomous-media-operations',
  (req, res) => {
    const indexFile = path.join(
      EXECUTIVE_DIR,
      'index.html'
    );

    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
      return;
    }

    sendJSON(res, {
      ok: false,
      error: 'Executive UI index.html not found',
      expectedPath: indexFile
    }, 404);
  }
);

app.get(
  '/autonomous-media-operations/',
  (req, res) => {
    const indexFile = path.join(
      EXECUTIVE_DIR,
      'index.html'
    );

    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
      return;
    }

    sendJSON(res, {
      ok: false,
      error: 'Executive UI index.html not found',
      expectedPath: indexFile
    }, 404);
  }
);

/*
===========================================================
 PUBLIC
===========================================================
*/

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(
    express.static(PUBLIC_DIR, {
      fallthrough: true
    })
  );
}

/*
===========================================================
 404
===========================================================
*/

app.use((req, res) => {
  sendJSON(res, {
    ok: false,

    error: 'Not Found',

    path: req.originalUrl,

    platform: PLATFORM,
    version: VERSION,

    available: [
      '/',
      '/health',
      '/api',
      '/api/executive-command/ping',
      '/api/executive-command/status',
      '/api/executive-command/health',
      '/api/executive-command/dashboard',
      '/api/executive-command/systems',
      '/api/executive-command/ai',
      '/api/executive-command/operations',
      '/api/executive-command/business',
      '/api/executive-command/approvals',
      '/api/executive-command/matrix',
      '/autonomous-media-operations/'
    ],

    timestamp: now()
  }, 404);
});

/*
===========================================================
 ERROR HANDLER
===========================================================
*/

app.use((error, req, res, next) => {
  console.error('[SERVER ERROR]', error);

  if (res.headersSent) {
    return next(error);
  }

  sendJSON(res, {
    ok: false,

    error: 'Internal Server Error',

    message:
      process.env.NODE_ENV === 'production'
        ? 'حدث خطأ داخلي في الخادم.'
        : error.message,

    timestamp: now()
  }, 500);
});

/*
===========================================================
 START
===========================================================
*/

async function startServer() {
  console.log('');
  console.log('==============================================');
  console.log(' EZ MEDIA 11.0');
  console.log('==============================================');
  console.log(`Node: ${process.version}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Port: ${PORT}`);
  console.log(`Database configured: ${databaseConfigured}`);
  console.log('==============================================');

  await initializeDatabase();

  app.listen(PORT, HOST, () => {
    console.log('');
    console.log('==============================================');
    console.log(' EZ MEDIA SERVER ONLINE');
    console.log('==============================================');
    console.log(`http://${HOST}:${PORT}`);
    console.log('');
    console.log('Executive Command:');
    console.log('/api/executive-command/ping');
    console.log('/api/executive-command/status');
    console.log('');
    console.log('Autonomous Operations:');
    console.log('/autonomous-media-operations/');
    console.log('==============================================');
  });
}

startServer().catch((error) => {
  console.error('[FATAL SERVER ERROR]', error);

  process.exit(1);
});
