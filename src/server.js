'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const VERSION = '11.0.1';

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* =========================================================
   SECURITY
========================================================= */

app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

app.use(
  express.json({
    limit: '10mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb'
  })
);

app.use(morgan('combined'));

app.use('/uploads', express.static(uploadsDir));

/* =========================================================
   DATABASE
========================================================= */

let pool = null;
let databaseStatus = 'not_configured';

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl:
      DATABASE_URL.includes('localhost') ||
      DATABASE_URL.includes('127.0.0.1')
        ? false
        : {
            rejectUnauthorized: false
          }
  });

  pool.on('error', (error) => {
    console.error('[DATABASE]', error.message);
    databaseStatus = 'error';
  });
}

async function dbQuery(text, params = []) {
  if (!pool) {
    throw new Error('Database not configured');
  }

  return pool.query(text, params);
}

async function checkDatabase() {
  if (!pool) {
    databaseStatus = 'not_configured';
    return false;
  }

  try {
    await pool.query('SELECT NOW()');
    databaseStatus = 'connected';
    return true;
  } catch (error) {
    databaseStatus = 'error';
    console.error('[DATABASE CHECK]', error.message);
    return false;
  }
}

/* =========================================================
   DATABASE SCHEMA
========================================================= */

async function initializeDatabase() {
  if (!pool) {
    console.warn('[DATABASE] DATABASE_URL غير موجود');
    return;
  }

  await dbQuery(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) NOT NULL DEFAULT 'editor',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS section_branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(section_id, slug)
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS contents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
      branch_id UUID REFERENCES section_branches(id) ON DELETE SET NULL,
      title VARCHAR(500) NOT NULL,
      slug VARCHAR(500) UNIQUE NOT NULL,
      excerpt TEXT,
      body TEXT,
      cover_image TEXT,
      content_type VARCHAR(50) NOT NULL DEFAULT 'article',
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      author_id UUID REFERENCES users(id) ON DELETE SET NULL,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS content_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      title VARCHAR(500),
      body TEXT,
      status VARCHAR(50),
      version_number INTEGER NOT NULL,
      editor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS banners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
      title VARCHAR(500),
      subtitle TEXT,
      image_url TEXT,
      button_text VARCHAR(255),
      button_url TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      priority INTEGER NOT NULL DEFAULT 0,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename TEXT NOT NULL,
      original_name TEXT,
      mime_type VARCHAR(255),
      size BIGINT,
      url TEXT,
      storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
      publish_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      message TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(100),
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(255) PRIMARY KEY,
      value JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('[DATABASE] Schema initialized');
}

/* =========================================================
   DEFAULT SECTIONS
========================================================= */

const DEFAULT_SECTIONS = [
  'الأخبار',
  'الإعلام',
  'المحتوى',
  'الفيديو',
  'الصوتيات',
  'البودكاست',
  'البث المباشر',
  'التغطيات',
  'الفعاليات',
  'التقارير',
  'المقابلات',
  'التقنية',
  'الذكاء الاصطناعي',
  'المنصات الرقمية',
  'السوشيال ميديا',
  'الترند',
  'السفر',
  'السياحة',
  'الرياضة',
  'الاقتصاد',
  'الأعمال',
  'الإعلانات',
  'الرعايات',
  'التجارة',
  'الخدمات',
  'الهوية الرقمية',
  'صانع المحتوى',
  'فريق EZ MEDIA',
  'المكتبة الرقمية',
  'عن EZ MEDIA'
];

function createSlug(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function seedSections() {
  if (!pool) return;

  for (let i = 0; i < DEFAULT_SECTIONS.length; i++) {
    const name = DEFAULT_SECTIONS[i];
    const slug = createSlug(name);

    await dbQuery(
      `
      INSERT INTO sections
        (name, slug, sort_order)
      VALUES
        ($1, $2, $3)
      ON CONFLICT (slug)
      DO NOTHING
      `,
      [name, slug, i + 1]
    );
  }
}

/* =========================================================
   ADMIN
========================================================= */

async function seedAdmin() {
  if (!pool) return;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn(
      '[SECURITY] ADMIN_EMAIL و ADMIN_PASSWORD يجب ضبطهما في Railway'
    );
    return;
  }

  const existing = await dbQuery(
    `
    SELECT id
    FROM users
    WHERE email = $1
    LIMIT 1
    `,
    [ADMIN_EMAIL]
  );

  if (existing.rows.length > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await dbQuery(
    `
    INSERT INTO users
      (email, password_hash, name, role)
    VALUES
      ($1, $2, $3, 'admin')
    `,
    [
      ADMIN_EMAIL,
      passwordHash,
      'EZ MEDIA Administrator'
    ]
  );

  console.log('[AUTH] Admin created');
}

/* =========================================================
   AUTH
========================================================= */

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function auth(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'JWT_SECRET غير مضبوط'
    });
  }

  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const token = header.substring(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
}

/* =========================================================
   HEALTH
========================================================= */

app.get('/health', async (req, res) => {
  const dbConnected = await checkDatabase();

  res.status(200).json({
    success: true,
    platform: 'EZ MEDIA',
    version: VERSION,
    status: dbConnected ? 'online' : 'degraded',
    server: 'online',
    database: {
      configured: Boolean(DATABASE_URL),
      connected: dbConnected,
      status: databaseStatus
    },
    environment: NODE_ENV,
    node: process.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/* =========================================================
   API
========================================================= */

app.get('/api', (req, res) => {
  res.json({
    success: true,
    platform: 'EZ MEDIA',
    version: VERSION,
    api: '11.0',
    status: 'online'
  });
});

/* =========================================================
   AUTH LOGIN
========================================================= */

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد وكلمة المرور مطلوبان'
      });
    }

    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'قاعدة البيانات غير مهيأة'
      });
    }

    const result = await dbQuery(
      `
      SELECT *
      FROM users
      WHERE email = $1
      AND active = TRUE
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[LOGIN]', error);

    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تسجيل الدخول'
    });
  }
});

/* =========================================================
   SECTIONS
========================================================= */

app.get('/api/sections', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured'
      });
    }

    const result = await dbQuery(`
      SELECT *
      FROM sections
      WHERE active = TRUE
      ORDER BY sort_order ASC, name ASC
    `);

    res.json({
      success: true,
      sections: result.rows
    });
  } catch (error) {
    console.error('[SECTIONS]', error);

    res.status(500).json({
      success: false,
      message: 'تعذر تحميل الأقسام'
    });
  }
});

/* =========================================================
   CONTENT
========================================================= */

app.get('/api/content', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured'
      });
    }

    const result = await dbQuery(`
      SELECT
        c.*,
        s.name AS section_name,
        s.slug AS section_slug
      FROM contents c
      LEFT JOIN sections s
        ON s.id = c.section_id
      WHERE c.status = 'published'
      ORDER BY c.published_at DESC NULLS LAST,
               c.created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      content: result.rows
    });
  } catch (error) {
    console.error('[CONTENT]', error);

    res.status(500).json({
      success: false,
      message: 'تعذر تحميل المحتوى'
    });
  }
});

/* =========================================================
   CONTENT BY SLUG
========================================================= */

app.get('/api/content/:slug', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured'
      });
    }

    const result = await dbQuery(
      `
      SELECT
        c.*,
        s.name AS section_name,
        s.slug AS section_slug
      FROM contents c
      LEFT JOIN sections s
        ON s.id = c.section_id
      WHERE c.slug = $1
      AND c.status = 'published'
      LIMIT 1
      `,
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'المحتوى غير موجود'
      });
    }

    res.json({
      success: true,
      content: result.rows[0]
    });
  } catch (error) {
    console.error('[CONTENT SLUG]', error);

    res.status(500).json({
      success: false,
      message: 'تعذر تحميل المحتوى'
    });
  }
});

/* =========================================================
   ADMIN STATS
========================================================= */

app.get(
  '/api/admin/stats',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const [
        users,
        sections,
        contents,
        published,
        media
      ] = await Promise.all([
        dbQuery(`SELECT COUNT(*) FROM users`),
        dbQuery(`SELECT COUNT(*) FROM sections`),
        dbQuery(`SELECT COUNT(*) FROM contents`),
        dbQuery(`
          SELECT COUNT(*)
          FROM contents
          WHERE status = 'published'
        `),
        dbQuery(`SELECT COUNT(*) FROM media`)
      ]);

      res.json({
        success: true,
        stats: {
          users: Number(users.rows[0].count),
          sections: Number(sections.rows[0].count),
          contents: Number(contents.rows[0].count),
          published: Number(published.rows[0].count),
          media: Number(media.rows[0].count)
        }
      });
    } catch (error) {
      console.error('[STATS]', error);

      res.status(500).json({
        success: false,
        message: 'تعذر تحميل الإحصائيات'
      });
    }
  }
);

/* =========================================================
   ADMIN CONTENT CREATE
========================================================= */

app.post(
  '/api/admin/content',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        section_id,
        branch_id,
        title,
        slug,
        excerpt,
        body,
        cover_image,
        content_type = 'article',
        status = 'draft'
      } = req.body;

      if (!title || !slug) {
        return res.status(400).json({
          success: false,
          message: 'العنوان وslug مطلوبان'
        });
      }

      const result = await dbQuery(
        `
        INSERT INTO contents
        (
          section_id,
          branch_id,
          title,
          slug,
          excerpt,
          body,
          cover_image,
          content_type,
          status,
          author_id,
          published_at
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          CASE
            WHEN $9 = 'published'
            THEN NOW()
            ELSE NULL
          END
        )
        RETURNING *
        `,
        [
          section_id || null,
          branch_id || null,
          title,
          slug,
          excerpt || null,
          body || null,
          cover_image || null,
          content_type,
          status,
          req.user.id
        ]
      );

      await dbQuery(
        `
        INSERT INTO activity_logs
        (
          user_id,
          action,
          entity_type,
          entity_id,
          metadata
        )
        VALUES
        ($1,$2,$3,$4,$5)
        `,
        [
          req.user.id,
          'content.create',
          'content',
          result.rows[0].id,
          JSON.stringify({
            title,
            status
          })
        ]
      );

      res.status(201).json({
        success: true,
        content: result.rows[0]
      });
    } catch (error) {
      console.error('[CREATE CONTENT]', error);

      res.status(500).json({
        success: false,
        message: 'تعذر إنشاء المحتوى',
        error:
          NODE_ENV === 'development'
            ? error.message
            : undefined
      });
    }
  }
);

/* =========================================================
   ADMIN SETTINGS
========================================================= */

app.get('/api/settings', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured'
      });
    }

    const result = await dbQuery(`
      SELECT key, value
      FROM settings
      ORDER BY key
    `);

    res.json({
      success: true,
      settings: result.rows
    });
  } catch (error) {
    console.error('[SETTINGS]', error);

    res.status(500).json({
      success: false,
      message: 'تعذر تحميل الإعدادات'
    });
  }
});

/* =========================================================
   AUTOMATION
========================================================= */

async function runAutomation() {
  if (!pool) return;

  const run = await dbQuery(
    `
    INSERT INTO automation_runs
      (job_name, status)
    VALUES
      ('publish-scheduled-content', 'running')
    RETURNING id
    `
  );

  const runId = run.rows[0].id;

  try {
    const scheduled = await dbQuery(`
      SELECT id, content_id
      FROM schedules
      WHERE status = 'scheduled'
      AND publish_at <= NOW()
    `);

    for (const item of scheduled.rows) {
      await dbQuery(
        `
        UPDATE contents
        SET
          status = 'published',
          published_at = COALESCE(
            published_at,
            NOW()
          ),
          updated_at = NOW()
        WHERE id = $1
        `,
        [item.content_id]
      );

      await dbQuery(
        `
        UPDATE schedules
        SET status = 'published'
        WHERE id = $1
        `,
        [item.id]
      );
    }

    await dbQuery(
      `
      UPDATE automation_runs
      SET
        status = 'completed',
        message = $1,
        finished_at = NOW()
      WHERE id = $2
      `,
      [
        `تم نشر ${scheduled.rows.length} محتوى`,
        runId
      ]
    );
  } catch (error) {
    await dbQuery(
      `
      UPDATE automation_runs
      SET
        status = 'failed',
        message = $1,
        finished_at = NOW()
      WHERE id = $2
      `,
      [error.message, runId]
    );

    console.error('[AUTOMATION]', error);
  }
}

/* =========================================================
   ADMIN AUTOMATION
========================================================= */

app.post(
  '/api/admin/automation/run',
  auth,
  adminOnly,
  async (req, res) => {
    await runAutomation();

    res.json({
      success: true,
      message: 'تم تشغيل الأتمتة'
    });
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: 'API endpoint not found'
    });
  }

  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

app.use((error, req, res, next) => {
  console.error('[SERVER ERROR]', error);

  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

/* =========================================================
   STARTUP
========================================================= */

async function startServer() {
  try {
    if (!JWT_SECRET) {
      console.warn(
        '[SECURITY] JWT_SECRET غير مضبوط'
      );
    }

    if (pool) {
      await checkDatabase();
      await initializeDatabase();
      await seedSections();
      await seedAdmin();
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
========================================
 EZ MEDIA ${VERSION}
========================================
 Server:      ONLINE
 Port:        ${PORT}
 Environment: ${NODE_ENV}
 Database:    ${databaseStatus}
 Node:        ${process.version}
========================================
      `);
    });

    setInterval(
      () => {
        runAutomation().catch((error) => {
          console.error(
            '[AUTOMATION TIMER]',
            error.message
          );
        });
      },
      60 * 1000
    );
  } catch (error) {
    console.error(
      '[STARTUP ERROR]',
      error
    );

    process.exit(1);
  }
}

startServer();
