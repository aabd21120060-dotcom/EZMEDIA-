'use strict';

/*
===========================================================
 EZ MEDIA 11.0 CORE
 Digital Media Platform
 Node.js + Express + PostgreSQL
===========================================================
*/

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { v4: uuid } = require('uuid');

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const NODE_ENV = process.env.NODE_ENV || 'development';

const JWT_SECRET =
  process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_RAILWAY';

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || 'admin@ezmedia.local';

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || 'ChangeMe123!';

const DATABASE_URL = process.env.DATABASE_URL;

const PLATFORM = 'EZ MEDIA';
const VERSION = '11.0.0';

/* =========================================================
   DATABASE
========================================================= */

let pool = null;
let databaseConnected = false;
let databaseName = null;
let databaseError = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false },

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (error) => {
    console.error('[DATABASE POOL ERROR]', error.message);
    databaseError = error.message;
    databaseConnected = false;
  });
}

/* =========================================================
   EXPRESS
========================================================= */

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  express.json({
    limit: '50mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb'
  })
);

app.use(morgan('combined'));

/* =========================================================
   DIRECTORIES
========================================================= */

const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(__dirname, 'uploads');

const uploadDirectories = [
  uploadsDir,
  path.join(uploadsDir, 'images'),
  path.join(uploadsDir, 'videos'),
  path.join(uploadsDir, 'audio'),
  path.join(uploadsDir, 'documents')
];

for (const directory of uploadDirectories) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }
}

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  '/uploads',
  express.static(uploadsDir)
);

app.use(
  express.static(publicDir)
);

/* =========================================================
   MULTER
========================================================= */

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const mime = file.mimetype || '';

    let folder = 'documents';

    if (mime.startsWith('image/')) {
      folder = 'images';
    } else if (mime.startsWith('video/')) {
      folder = 'videos';
    } else if (mime.startsWith('audio/')) {
      folder = 'audio';
    }

    cb(
      null,
      path.join(uploadsDir, folder)
    );
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '');
    const filename =
      `${Date.now()}-${uuid()}${ext}`;

    cb(null, filename);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

/* =========================================================
   DEFAULT SECTIONS
========================================================= */

const DEFAULT_SECTIONS = [
  ['الأخبار', 'news'],
  ['الإعلام', 'media'],
  ['المحتوى', 'content'],
  ['الفيديو', 'video'],
  ['الصوتيات', 'audio'],
  ['البودكاست', 'podcast'],
  ['البث المباشر', 'live'],
  ['التغطيات', 'coverage'],
  ['الفعاليات', 'events'],
  ['التقارير', 'reports'],
  ['المقابلات', 'interviews'],
  ['التقنية', 'technology'],
  ['الذكاء الاصطناعي', 'ai'],
  ['المنصات الرقمية', 'digital-platforms'],
  ['السوشيال ميديا', 'social-media'],
  ['الترند', 'trending'],
  ['السفر', 'travel'],
  ['السياحة', 'tourism'],
  ['الرياضة', 'sports'],
  ['الاقتصاد', 'economy'],
  ['الأعمال', 'business'],
  ['الإعلانات', 'advertising'],
  ['الرعايات', 'sponsorships'],
  ['التجارة', 'commerce'],
  ['الخدمات', 'services'],
  ['الهوية الرقمية', 'digital-identity'],
  ['صانع المحتوى', 'creator'],
  ['فريق EZ MEDIA', 'team'],
  ['المكتبة الرقمية', 'library'],
  ['عن EZ MEDIA', 'about']
];

/* =========================================================
   DATABASE QUERY
========================================================= */

async function query(text, params = []) {
  if (!pool) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }

  return pool.query(text, params);
}

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initDatabase() {
  if (!pool) {
    databaseConnected = false;
    databaseError = 'Database not configured';
    return;
  }

  try {
    const result = await pool.query(
      'SELECT current_database() AS database_name'
    );

    databaseName =
      result.rows[0]?.database_name || null;

    databaseConnected = true;
    databaseError = null;

    console.log(
      `[DATABASE] Connected: ${databaseName}`
    );

    await createTables();

    await seedSections();

    await seedAdmin();

    await seedSettings();

    console.log(
      '[DATABASE] Initialization completed'
    );
  } catch (error) {
    databaseConnected = false;
    databaseError = error.message;

    console.error(
      '[DATABASE] Initialization failed:',
      error.message
    );
  }
}

/* =========================================================
   TABLES
========================================================= */

async function createTables() {
  const sql = `

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'editor',
    status VARCHAR(30) DEFAULT 'active',
    avatar TEXT,
    phone VARCHAR(100),
    department VARCHAR(255),
    job_title VARCHAR(255),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id UUID REFERENCES departments(id)
      ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS section_branches (
    id UUID PRIMARY KEY,
    section_id UUID REFERENCES sections(id)
      ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contents (
    id UUID PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    excerpt TEXT,
    body TEXT,
    content_type VARCHAR(50) DEFAULT 'article',
    status VARCHAR(50) DEFAULT 'draft',
    section_id UUID REFERENCES sections(id)
      ON DELETE SET NULL,
    branch_id UUID REFERENCES section_branches(id)
      ON DELETE SET NULL,
    author_id UUID REFERENCES users(id)
      ON DELETE SET NULL,
    featured_image TEXT,
    video_url TEXT,
    audio_url TEXT,
    source_name VARCHAR(500),
    source_url TEXT,
    seo_title VARCHAR(500),
    seo_description TEXT,
    seo_keywords TEXT,
    views BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS content_tags (
    content_id UUID REFERENCES contents(id)
      ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id)
      ON DELETE CASCADE,
    PRIMARY KEY (content_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS content_versions (
    id UUID PRIMARY KEY,
    content_id UUID REFERENCES contents(id)
      ON DELETE CASCADE,
    title TEXT,
    body TEXT,
    status VARCHAR(50),
    version_number INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id)
      ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT,
    path TEXT NOT NULL,
    url TEXT,
    mime_type VARCHAR(255),
    size BIGINT DEFAULT 0,
    media_type VARCHAR(50),
    title VARCHAR(500),
    description TEXT,
    folder VARCHAR(255),
    uploaded_by UUID REFERENCES users(id)
      ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    image TEXT,
    link TEXT,
    section_id UUID REFERENCES sections(id)
      ON DELETE SET NULL,
    position VARCHAR(100) DEFAULT 'home',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    advertiser VARCHAR(500),
    description TEXT,
    image TEXT,
    link TEXT,
    placement VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    logo TEXT,
    website TEXT,
    description TEXT,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    sponsor_id UUID REFERENCES sponsors(id)
      ON DELETE SET NULL,
    budget NUMERIC(14,2),
    status VARCHAR(50) DEFAULT 'draft',
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY,
    content_id UUID REFERENCES contents(id)
      ON DELETE CASCADE,
    publish_at TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_by UUID REFERENCES users(id)
      ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS automation_runs (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    status VARCHAR(50),
    source TEXT,
    imported INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    published INTEGER DEFAULT 0,
    message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    url TEXT,
    type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS platform_accounts (
    id UUID PRIMARY KEY,
    platform VARCHAR(100) NOT NULL,
    account_name VARCHAR(500),
    account_id VARCHAR(500),
    access_token TEXT,
    refresh_token TEXT,
    status VARCHAR(50) DEFAULT 'disconnected',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS publishing_jobs (
    id UUID PRIMARY KEY,
    content_id UUID REFERENCES contents(id)
      ON DELETE CASCADE,
    platform_account_id UUID REFERENCES platform_accounts(id)
      ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS publishing_results (
    id UUID PRIMARY KEY,
    publishing_job_id UUID REFERENCES publishing_jobs(id)
      ON DELETE CASCADE,
    platform_url TEXT,
    external_id VARCHAR(500),
    status VARCHAR(50),
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS live_events (
    id UUID PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    thumbnail TEXT,
    created_by UUID REFERENCES users(id)
      ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY,
    live_event_id UUID REFERENCES live_events(id)
      ON DELETE CASCADE,
    name VARCHAR(500),
    protocol VARCHAR(100),
    stream_url TEXT,
    stream_key TEXT,
    status VARCHAR(50) DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stream_sources (
    id UUID PRIMARY KEY,
    stream_id UUID REFERENCES streams(id)
      ON DELETE CASCADE,
    source_type VARCHAR(100),
    source_url TEXT,
    configuration JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY,
    stream_id UUID REFERENCES streams(id)
      ON DELETE CASCADE,
    platform VARCHAR(100),
    destination_url TEXT,
    status VARCHAR(50) DEFAULT 'inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS broadcast_sessions (
    id UUID PRIMARY KEY,
    stream_id UUID REFERENCES streams(id)
      ON DELETE CASCADE,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'created'
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    content_id UUID REFERENCES contents(id)
      ON DELETE SET NULL,
    user_id UUID REFERENCES users(id)
      ON DELETE SET NULL,
    platform VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id)
      ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_contents_status
    ON contents(status);

  CREATE INDEX IF NOT EXISTS idx_contents_section
    ON contents(section_id);

  CREATE INDEX IF NOT EXISTS idx_contents_published
    ON contents(published_at);

  CREATE INDEX IF NOT EXISTS idx_media_type
    ON media(media_type);

  CREATE INDEX IF NOT EXISTS idx_activity_created
    ON activity_logs(created_at);

  CREATE INDEX IF NOT EXISTS idx_analytics_created
    ON analytics_events(created_at);

  `;

  await query(sql);
}

/* =========================================================
   SEED SECTIONS
========================================================= */

async function seedSections() {
  for (let i = 0; i < DEFAULT_SECTIONS.length; i++) {
    const [name, slug] =
      DEFAULT_SECTIONS[i];

    await query(
      `
      INSERT INTO sections
      (
        id,
        name,
        slug,
        sort_order
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order
      `,
      [
        uuid(),
        name,
        slug,
        i + 1
      ]
    );
  }
}

/* =========================================================
   SEED ADMIN
========================================================= */

async function seedAdmin() {
  const existing = await query(
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

  const passwordHash =
    await bcrypt.hash(
      ADMIN_PASSWORD,
      12
    );

  await query(
    `
    INSERT INTO users
    (
      id,
      name,
      email,
      password_hash,
      role,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      uuid(),
      'EZ MEDIA Administrator',
      ADMIN_EMAIL,
      passwordHash,
      'admin',
      'active'
    ]
  );

  console.log(
    `[ADMIN] Created: ${ADMIN_EMAIL}`
  );
}

/* =========================================================
   SEED SETTINGS
========================================================= */

async function seedSettings() {
  const settings = {
    platform_name: PLATFORM,
    platform_version: VERSION,
    platform_description:
      'منصة EZ MEDIA الإعلامية الرقمية',
    contact_whatsapp: '',
    contact_email: ADMIN_EMAIL,
    homepage_title:
      'EZ MEDIA | منصة إعلامية رقمية',
    automation_enabled: 'true',
    analytics_enabled: 'true',
    maintenance_mode: 'false'
  };

  for (const [key, value] of Object.entries(settings)) {
    await query(
      `
      INSERT INTO settings
      (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key)
      DO NOTHING
      `,
      [key, value]
    );
  }
}

/* =========================================================
   AUTH
========================================================= */

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function auth(req, res, next) {
  const header =
    req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'رمز الدخول مطلوب'
    });
  }

  const token =
    header.substring(7);

  try {
    req.user =
      jwt.verify(
        token,
        JWT_SECRET
      );

    next();
  } catch {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'رمز الدخول غير صالح أو منتهي'
    });
  }
}

function adminOnly(req, res, next) {
  if (
    !req.user ||
    !['admin', 'superadmin'].includes(
      req.user.role
    )
  ) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'هذه العملية للمسؤول فقط'
    });
  }

  next();
}

/* =========================================================
   LOGGING
========================================================= */

async function logActivity(
  req,
  action,
  entityType = null,
  entityId = null,
  details = {}
) {
  if (!pool) return;

  try {
    await query(
      `
      INSERT INTO activity_logs
      (
        id,
        user_id,
        action,
        entity_type,
        entity_id,
        details,
        ip_address,
        user_agent
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        uuid(),
        req.user?.id || null,
        action,
        entityType,
        entityId || null,
        JSON.stringify(details),
        req.ip || null,
        req.headers['user-agent'] || null
      ]
    );
  } catch (error) {
    console.error(
      '[ACTIVITY LOG]',
      error.message
    );
  }
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/health',
  async (req, res) => {
    let database = {
      connected: false,
      databaseName: null,
      message:
        DATABASE_URL
          ? databaseError || 'Not connected'
          : 'Database not configured'
    };

    if (pool) {
      try {
        const result =
          await query(
            'SELECT current_database() AS name'
          );

        databaseConnected = true;
        databaseError = null;
        databaseName =
          result.rows[0]?.name || null;

        database = {
          connected: true,
          databaseName,
          message: 'Connected'
        };
      } catch (error) {
        databaseConnected = false;
        databaseError =
          error.message;

        database = {
          connected: false,
          databaseName: null,
          message: error.message
        };
      }
    }

    res.json({
      platform: PLATFORM,
      version: VERSION,
      status:
        database.connected
          ? 'online'
          : 'degraded',
      server: 'online',
      database,
      node: process.version,
      environment: NODE_ENV,
      uptime: process.uptime(),
      timestamp:
        new Date().toISOString(),
      requestId: req.requestId || uuid()
    });
  }
);

/* =========================================================
   API ROOT
========================================================= */

app.get(
  '/api',
  (req, res) => {
    res.json({
      platform: PLATFORM,
      version: VERSION,
      status: 'online',

      endpoints: {
        health: '/health',
        login: '/api/auth/login',
        sections: '/api/sections',
        content: '/api/content',
        banners: '/api/banners',
        settings: '/api/settings'
      }
    });
  }
);

/* =========================================================
   AUTH LOGIN
========================================================= */

app.post(
  '/api/auth/login',
  async (req, res) => {
    try {
      const {
        email,
        password
      } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password required'
        });
      }

      const result = await query(
        `
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        `,
        [email]
      );

      if (!result.rows.length) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const user =
        result.rows[0];

      if (user.status !== 'active') {
        return res.status(403).json({
          error: 'Account disabled'
        });
      }

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      await query(
        `
        UPDATE users
        SET last_login = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [user.id]
      );

      const token =
        createToken(user);

      await logActivity(
        req,
        'login',
        'user',
        user.id
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error(
        '[LOGIN]',
        error
      );

      res.status(500).json({
        error: 'Login failed',
        message: error.message
      });
    }
  }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  '/api/auth/me',
  auth,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT
            id,
            name,
            email,
            role,
            status,
            avatar,
            phone,
            department,
            job_title,
            last_login,
            created_at
          FROM users
          WHERE id = $1
          `,
          [req.user.id]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        user: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   SECTIONS
========================================================= */

app.get(
  '/api/sections',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT *
          FROM sections
          WHERE is_active = TRUE
          ORDER BY sort_order ASC
          `
        );

      res.json({
        success: true,
        sections: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get(
  '/api/sections/:slug',
  async (req, res) => {
    try {
      const section =
        await query(
          `
          SELECT *
          FROM sections
          WHERE slug = $1
          LIMIT 1
          `,
          [req.params.slug]
        );

      if (!section.rows.length) {
        return res.status(404).json({
          error: 'Section not found'
        });
      }

      const branches =
        await query(
          `
          SELECT *
          FROM section_branches
          WHERE section_id = $1
          AND is_active = TRUE
          ORDER BY sort_order
          `,
          [section.rows[0].id]
        );

      const contents =
        await query(
          `
          SELECT
            c.*,
            u.name AS author_name
          FROM contents c
          LEFT JOIN users u
            ON u.id = c.author_id
          WHERE c.section_id = $1
          AND c.status = 'published'
          ORDER BY
            COALESCE(
              c.published_at,
              c.created_at
            ) DESC
          LIMIT 100
          `,
          [section.rows[0].id]
        );

      res.json({
        success: true,
        section: section.rows[0],
        branches: branches.rows,
        contents: contents.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   ADMIN SECTION CREATE
========================================================= */

app.post(
  '/api/admin/sections',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        slug,
        description,
        image,
        icon,
        sort_order
      } = req.body;

      if (!name || !slug) {
        return res.status(400).json({
          error: 'name and slug are required'
        });
      }

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO sections
          (
            id,
            name,
            slug,
            description,
            image,
            icon,
            sort_order
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7)
          RETURNING *
          `,
          [
            id,
            name,
            slug,
            description || null,
            image || null,
            icon || null,
            Number(sort_order || 0)
          ]
        );

      await logActivity(
        req,
        'create_section',
        'section',
        id
      );

      res.status(201).json({
        success: true,
        section: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   BRANCHES
========================================================= */

app.get(
  '/api/sections/:sectionId/branches',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT *
          FROM section_branches
          WHERE section_id = $1
          ORDER BY sort_order
          `,
          [req.params.sectionId]
        );

      res.json({
        success: true,
        branches: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.post(
  '/api/admin/branches',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        section_id,
        name,
        slug,
        description,
        sort_order
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO section_branches
          (
            id,
            section_id,
            name,
            slug,
            description,
            sort_order
          )
          VALUES
          ($1,$2,$3,$4,$5,$6)
          RETURNING *
          `,
          [
            id,
            section_id,
            name,
            slug,
            description || null,
            Number(sort_order || 0)
          ]
        );

      await logActivity(
        req,
        'create_branch',
        'section_branch',
        id
      );

      res.status(201).json({
        success: true,
        branch: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   CONTENT
========================================================= */

app.get(
  '/api/content',
  async (req, res) => {
    try {
      const {
        section,
        type,
        status = 'published',
        limit = 50,
        offset = 0
      } = req.query;

      const values = [];
      const conditions = [];

      if (status) {
        values.push(status);
        conditions.push(
          `c.status = $${values.length}`
        );
      }

      if (section) {
        values.push(section);
        conditions.push(
          `s.slug = $${values.length}`
        );
      }

      if (type) {
        values.push(type);
        conditions.push(
          `c.content_type = $${values.length}`
        );
      }

      values.push(
        Math.min(
          Number(limit) || 50,
          100
        )
      );

      const limitIndex =
        values.length;

      values.push(
        Math.max(
          Number(offset) || 0,
          0
        )
      );

      const offsetIndex =
        values.length;

      const where =
        conditions.length
          ? `WHERE ${conditions.join(' AND ')}`
          : '';

      const result =
        await query(
          `
          SELECT
            c.*,
            s.name AS section_name,
            s.slug AS section_slug,
            u.name AS author_name
          FROM contents c
          LEFT JOIN sections s
            ON s.id = c.section_id
          LEFT JOIN users u
            ON u.id = c.author_id
          ${where}
          ORDER BY
            COALESCE(
              c.published_at,
              c.created_at
            ) DESC
          LIMIT $${limitIndex}
          OFFSET $${offsetIndex}
          `,
          values
        );

      res.json({
        success: true,
        count: result.rows.length,
        contents: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   CONTENT BY SLUG
========================================================= */

app.get(
  '/api/content/:slug',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT
            c.*,
            s.name AS section_name,
            s.slug AS section_slug,
            u.name AS author_name
          FROM contents c
          LEFT JOIN sections s
            ON s.id = c.section_id
          LEFT JOIN users u
            ON u.id = c.author_id
          WHERE c.slug = $1
          LIMIT 1
          `,
          [req.params.slug]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          error: 'Content not found'
        });
      }

      await query(
        `
        UPDATE contents
        SET views = views + 1
        WHERE id = $1
        `,
        [result.rows[0].id]
      );

      res.json({
        success: true,
        content: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
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
        title,
        slug,
        excerpt,
        body,
        content_type = 'article',
        status = 'draft',
        section_id,
        branch_id,
        featured_image,
        video_url,
        audio_url,
        source_name,
        source_url,
        seo_title,
        seo_description,
        seo_keywords,
        scheduled_at
      } = req.body;

      if (!title || !slug) {
        return res.status(400).json({
          error:
            'title and slug are required'
        });
      }

      const id = uuid();

      const publishedAt =
        status === 'published'
          ? new Date()
          : null;

      const result =
        await query(
          `
          INSERT INTO contents
          (
            id,
            title,
            slug,
            excerpt,
            body,
            content_type,
            status,
            section_id,
            branch_id,
            author_id,
            featured_image,
            video_url,
            audio_url,
            source_name,
            source_url,
            seo_title,
            seo_description,
            seo_keywords,
            scheduled_at,
            published_at
          )
          VALUES
          (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
          )
          RETURNING *
          `,
          [
            id,
            title,
            slug,
            excerpt || null,
            body || null,
            content_type,
            status,
            section_id || null,
            branch_id || null,
            req.user.id,
            featured_image || null,
            video_url || null,
            audio_url || null,
            source_name || null,
            source_url || null,
            seo_title || null,
            seo_description || null,
            seo_keywords || null,
            scheduled_at || null,
            publishedAt
          ]
        );

      await createContentVersion(
        result.rows[0],
        req.user.id
      );

      await logActivity(
        req,
        'create_content',
        'content',
        id
      );

      res.status(201).json({
        success: true,
        content: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   CONTENT VERSION
========================================================= */

async function createContentVersion(
  content,
  userId
) {
  if (!pool) return;

  const existing =
    await query(
      `
      SELECT
        COALESCE(
          MAX(version_number),
          0
        ) + 1 AS next_version
      FROM content_versions
      WHERE content_id = $1
      `,
      [content.id]
    );

  const version =
    Number(
      existing.rows[0].next_version
    );

  await query(
    `
    INSERT INTO content_versions
    (
      id,
      content_id,
      title,
      body,
      status,
      version_number,
      created_by
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      uuid(),
      content.id,
      content.title,
      content.body,
      content.status,
      version,
      userId
    ]
  );
}

/* =========================================================
   ADMIN CONTENT UPDATE
========================================================= */

app.put(
  '/api/admin/content/:id',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const allowed = [
        'title',
        'slug',
        'excerpt',
        'body',
        'content_type',
        'status',
        'section_id',
        'branch_id',
        'featured_image',
        'video_url',
        'audio_url',
        'source_name',
        'source_url',
        'seo_title',
        'seo_description',
        'seo_keywords',
        'scheduled_at'
      ];

      const fields = [];
      const values = [];

      for (const field of allowed) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body,
            field
          )
        ) {
          values.push(req.body[field]);

          fields.push(
            `${field} = $${values.length}`
          );
        }
      }

      if (!fields.length) {
        return res.status(400).json({
          error: 'No fields to update'
        });
      }

      if (
        req.body.status === 'published'
      ) {
        values.push(new Date());

        fields.push(
          `published_at = $${values.length}`
        );
      }

      values.push(req.params.id);

      const result =
        await query(
          `
          UPDATE contents
          SET
            ${fields.join(', ')},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $${values.length}
          RETURNING *
          `,
          values
        );

      if (!result.rows.length) {
        return res.status(404).json({
          error: 'Content not found'
        });
      }

      await createContentVersion(
        result.rows[0],
        req.user.id
      );

      await logActivity(
        req,
        'update_content',
        'content',
        req.params.id
      );

      res.json({
        success: true,
        content: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   DELETE CONTENT
========================================================= */

app.delete(
  '/api/admin/content/:id',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          DELETE FROM contents
          WHERE id = $1
          RETURNING id
          `,
          [req.params.id]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          error: 'Content not found'
        });
      }

      await logActivity(
        req,
        'delete_content',
        'content',
        req.params.id
      );

      res.json({
        success: true,
        deleted:
          result.rows[0].id
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   SEARCH
========================================================= */

app.get(
  '/api/search',
  async (req, res) => {
    try {
      const q =
        String(
          req.query.q || ''
        ).trim();

      if (!q) {
        return res.json({
          success: true,
          results: []
        });
      }

      const result =
        await query(
          `
          SELECT
            c.id,
            c.title,
            c.slug,
            c.excerpt,
            c.featured_image,
            c.content_type,
            c.published_at,
            s.name AS section_name
          FROM contents c
          LEFT JOIN sections s
            ON s.id = c.section_id
          WHERE
            c.status = 'published'
            AND (
              c.title ILIKE $1
              OR c.excerpt ILIKE $1
              OR c.body ILIKE $1
            )
          ORDER BY
            COALESCE(
              c.published_at,
              c.created_at
            ) DESC
          LIMIT 100
          `,
          [`%${q}%`]
        );

      res.json({
        success: true,
        query: q,
        results: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   BANNERS
========================================================= */

app.get(
  '/api/banners',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT *
          FROM banners
          WHERE is_active = TRUE
          AND (
            starts_at IS NULL
            OR starts_at <= CURRENT_TIMESTAMP
          )
          AND (
            ends_at IS NULL
            OR ends_at >= CURRENT_TIMESTAMP
          )
          ORDER BY priority DESC, created_at DESC
          `
        );

      res.json({
        success: true,
        banners: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.post(
  '/api/admin/banners',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        title,
        description,
        image,
        link,
        section_id,
        position = 'home',
        priority = 0,
        starts_at,
        ends_at
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO banners
          (
            id,
            title,
            description,
            image,
            link,
            section_id,
            position,
            priority,
            starts_at,
            ends_at
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING *
          `,
          [
            id,
            title,
            description || null,
            image || null,
            link || null,
            section_id || null,
            position,
            Number(priority || 0),
            starts_at || null,
            ends_at || null
          ]
        );

      await logActivity(
        req,
        'create_banner',
        'banner',
        id
      );

      res.status(201).json({
        success: true,
        banner: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   ADS
========================================================= */

app.get(
  '/api/ads',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT *
          FROM ads
          WHERE status = 'active'
          AND (
            starts_at IS NULL
            OR starts_at <= CURRENT_TIMESTAMP
          )
          AND (
            ends_at IS NULL
            OR ends_at >= CURRENT_TIMESTAMP
          )
          ORDER BY created_at DESC
          `
        );

      res.json({
        success: true,
        ads: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.post(
  '/api/admin/ads',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        title,
        advertiser,
        description,
        image,
        link,
        placement,
        status = 'draft',
        starts_at,
        ends_at
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO ads
          (
            id,
            title,
            advertiser,
            description,
            image,
            link,
            placement,
            status,
            starts_at,
            ends_at
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING *
          `,
          [
            id,
            title,
            advertiser || null,
            description || null,
            image || null,
            link || null,
            placement || null,
            status,
            starts_at || null,
            ends_at || null
          ]
        );

      res.status(201).json({
        success: true,
        ad: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   SPONSORS
========================================================= */

app.get(
  '/api/sponsors',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT *
          FROM sponsors
          WHERE status = 'active'
          ORDER BY created_at DESC
          `
        );

      res.json({
        success: true,
        sponsors: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.post(
  '/api/admin/sponsors',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        logo,
        website,
        description,
        contact_name,
        contact_email,
        contact_phone,
        status = 'active'
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO sponsors
          (
            id,
            name,
            logo,
            website,
            description,
            contact_name,
            contact_email,
            contact_phone,
            status
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING *
          `,
          [
            id,
            name,
            logo || null,
            website || null,
            description || null,
            contact_name || null,
            contact_email || null,
            contact_phone || null,
            status
          ]
        );

      res.status(201).json({
        success: true,
        sponsor: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   CAMPAIGNS
========================================================= */

app.post(
  '/api/admin/campaigns',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        description,
        sponsor_id,
        budget,
        status = 'draft',
        starts_at,
        ends_at
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO campaigns
          (
            id,
            name,
            description,
            sponsor_id,
            budget,
            status,
            starts_at,
            ends_at
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING *
          `,
          [
            id,
            name,
            description || null,
            sponsor_id || null,
            budget || null,
            status,
            starts_at || null,
            ends_at || null
          ]
        );

      res.status(201).json({
        success: true,
        campaign:
          result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   MEDIA UPLOAD
========================================================= */

app.post(
  '/api/admin/media/upload',
  auth,
  adminOnly,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      const relative =
        path.relative(
          __dirname,
          req.file.path
        );

      const url =
        `/${relative.replace(/\\/g, '/')}`;

      const mediaType =
        req.file.mimetype.startsWith('image/')
          ? 'image'
          : req.file.mimetype.startsWith('video/')
            ? 'video'
            : req.file.mimetype.startsWith('audio/')
              ? 'audio'
              : 'document';

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO media
          (
            id,
            filename,
            original_name,
            path,
            url,
            mime_type,
            size,
            media_type,
            title,
            description,
            folder,
            uploaded_by
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          RETURNING *
          `,
          [
            id,
            req.file.filename,
            req.file.originalname,
            relative,
            url,
            req.file.mimetype,
            req.file.size,
            mediaType,
            req.body.title || null,
            req.body.description || null,
            req.body.folder || null,
            req.user.id
          ]
        );

      await logActivity(
        req,
        'upload_media',
        'media',
        id
      );

      res.status(201).json({
        success: true,
        media: result.rows[0]
      });
    } catch (error) {
      console.error(
        '[MEDIA UPLOAD]',
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   MEDIA LIBRARY
========================================================= */

app.get(
  '/api/admin/media',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT
            m.*,
            u.name AS uploader_name
          FROM media m
          LEFT JOIN users u
            ON u.id = m.uploaded_by
          ORDER BY m.created_at DESC
          LIMIT 500
          `
        );

      res.json({
        success: true,
        media: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   SETTINGS
========================================================= */

app.get(
  '/api/settings',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT key, value
          FROM settings
          ORDER BY key
          `
        );

      const settings = {};

      for (const row of result.rows) {
        settings[row.key] =
          row.value;
      }

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.put(
  '/api/admin/settings/:key',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const value =
        typeof req.body.value === 'object'
          ? JSON.stringify(
              req.body.value
            )
          : String(
              req.body.value ?? ''
            );

      const result =
        await query(
          `
          INSERT INTO settings
          (
            key,
            value,
            updated_at
          )
          VALUES
          ($1,$2,CURRENT_TIMESTAMP)
          ON CONFLICT (key)
          DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
          `,
          [
            req.params.key,
            value
          ]
        );

      await logActivity(
        req,
        'update_setting',
        'setting'
      );

      res.json({
        success: true,
        setting:
          result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   SCHEDULES
========================================================= */

app.post(
  '/api/admin/schedules',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        content_id,
        publish_at
      } = req.body;

      if (
        !content_id ||
        !publish_at
      ) {
        return res.status(400).json({
          error:
            'content_id and publish_at are required'
        });
      }

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO schedules
          (
            id,
            content_id,
            publish_at,
            created_by
          )
          VALUES
          ($1,$2,$3,$4)
          RETURNING *
          `,
          [
            id,
            content_id,
            publish_at,
            req.user.id
          ]
        );

      res.status(201).json({
        success: true,
        schedule:
          result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   AUTOMATION
========================================================= */

async function runAutomation() {
  if (!pool) {
    return {
      success: false,
      message:
        'Database not configured'
    };
  }

  const runId = uuid();

  let imported = 0;
  let processed = 0;
  let published = 0;

  await query(
    `
    INSERT INTO automation_runs
    (
      id,
      name,
      status
    )
    VALUES
    ($1,$2,$3)
    `,
    [
      runId,
      'EZ MEDIA Automation',
      'running'
    ]
  );

  try {
    /*
      1. Scheduled content
    */

    const scheduled =
      await query(
        `
        SELECT *
        FROM schedules
        WHERE status = 'scheduled'
        AND publish_at <= CURRENT_TIMESTAMP
        LIMIT 100
        `
      );

    for (const item of scheduled.rows) {
      await query(
        `
        UPDATE contents
        SET
          status = 'published',
          published_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [item.content_id]
      );

      await query(
        `
        UPDATE schedules
        SET status = 'published'
        WHERE id = $1
        `,
        [item.id]
      );

      published++;
    }

    /*
      2. Mark scheduled content
    */

    const processResult =
      await query(
        `
        SELECT COUNT(*)::INTEGER AS count
        FROM contents
        WHERE status IN
        ('draft','review','scheduled')
        `
      );

    processed =
      Number(
        processResult.rows[0]?.count || 0
      );

    /*
      3. Sources
    */

    const sources =
      await query(
        `
        SELECT COUNT(*)::INTEGER AS count
        FROM sources
        WHERE status = 'active'
        `
      );

    imported =
      Number(
        sources.rows[0]?.count || 0
      );

    await query(
      `
      UPDATE automation_runs
      SET
        status = 'completed',
        imported = $1,
        processed = $2,
        published = $3,
        message = $4,
        finished_at = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [
        imported,
        processed,
        published,
        'Automation completed',
        runId
      ]
    );

    return {
      success: true,
      runId,
      imported,
      processed,
      published
    };
  } catch (error) {
    await query(
      `
      UPDATE automation_runs
      SET
        status = 'failed',
        message = $1,
        finished_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [
        error.message,
        runId
      ]
    );

    throw error;
  }
}

app.post(
  '/api/admin/automation/run',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await runAutomation();

      await logActivity(
        req,
        'run_automation',
        'automation'
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

app.get(
  '/api/admin/automation/runs',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT *
          FROM automation_runs
          ORDER BY started_at DESC
          LIMIT 100
          `
        );

      res.json({
        success: true,
        runs: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

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
        media,
        sponsors,
        ads,
        live,
        platforms
      ] = await Promise.all([
        query(
          'SELECT COUNT(*)::INTEGER AS count FROM users'
        ),

        query(
          'SELECT COUNT(*)::INTEGER AS count FROM sections'
        ),

        query(
          'SELECT COUNT(*)::INTEGER AS count FROM contents'
        ),

        query(
          `
          SELECT COUNT(*)::INTEGER AS count
          FROM contents
          WHERE status = 'published'
          `
        ),

        query(
          'SELECT COUNT(*)::INTEGER AS count FROM media'
        ),

        query(
          'SELECT COUNT(*)::INTEGER AS count FROM sponsors'
        ),

        query(
          'SELECT COUNT(*)::INTEGER AS count FROM ads'
        ),

        query(
          'SELECT COUNT(*)::INTEGER AS count FROM live_events'
        ),

        query(
          `
          SELECT COUNT(*)::INTEGER AS count
          FROM platform_accounts
          `
        )
      ]);

      res.json({
        success: true,
        stats: {
          users:
            users.rows[0].count,
          sections:
            sections.rows[0].count,
          contents:
            contents.rows[0].count,
          published:
            published.rows[0].count,
          media:
            media.rows[0].count,
          sponsors:
            sponsors.rows[0].count,
          ads:
            ads.rows[0].count,
          live:
            live.rows[0].count,
          platforms:
            platforms.rows[0].count
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   USERS
========================================================= */

app.get(
  '/api/admin/users',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT
            id,
            name,
            email,
            role,
            status,
            avatar,
            phone,
            department,
            job_title,
            last_login,
            created_at
          FROM users
          ORDER BY created_at DESC
          `
        );

      res.json({
        success: true,
        users: result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.post(
  '/api/admin/users',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role = 'editor',
        status = 'active',
        phone,
        department,
        job_title
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          error:
            'name, email and password are required'
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO users
          (
            id,
            name,
            email,
            password_hash,
            role,
            status,
            phone,
            department,
            job_title
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING
            id,
            name,
            email,
            role,
            status,
            phone,
            department,
            job_title,
            created_at
          `,
          [
            id,
            name,
            email,
            passwordHash,
            role,
            status,
            phone || null,
            department || null,
            job_title || null
          ]
        );

      await logActivity(
        req,
        'create_user',
        'user',
        id
      );

      res.status(201).json({
        success: true,
        user: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   LIVE EVENTS
========================================================= */

app.get(
  '/api/live',
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT *
          FROM live_events
          ORDER BY
            COALESCE(
              start_time,
              created_at
            ) DESC
          LIMIT 100
          `
        );

      res.json({
        success: true,
        live_events:
          result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.post(
  '/api/admin/live',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        title,
        description,
        status = 'draft',
        start_time,
        end_time,
        thumbnail
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO live_events
          (
            id,
            title,
            description,
            status,
            start_time,
            end_time,
            thumbnail,
            created_by
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING *
          `,
          [
            id,
            title,
            description || null,
            status,
            start_time || null,
            end_time || null,
            thumbnail || null,
            req.user.id
          ]
        );

      res.status(201).json({
        success: true,
        live_event:
          result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   PLATFORM ACCOUNTS
========================================================= */

app.get(
  '/api/admin/platforms',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT
            id,
            platform,
            account_name,
            account_id,
            status,
            created_at,
            updated_at
          FROM platform_accounts
          ORDER BY created_at DESC
          `
        );

      res.json({
        success: true,
        platforms:
          result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.post(
  '/api/admin/platforms',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        platform,
        account_name,
        account_id,
        access_token,
        refresh_token,
        status = 'connected'
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO platform_accounts
          (
            id,
            platform,
            account_name,
            account_id,
            access_token,
            refresh_token,
            status
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7)
          RETURNING
            id,
            platform,
            account_name,
            account_id,
            status,
            created_at
          `,
          [
            id,
            platform,
            account_name || null,
            account_id || null,
            access_token || null,
            refresh_token || null,
            status
          ]
        );

      res.status(201).json({
        success: true,
        platform:
          result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   PUBLISHING JOBS
========================================================= */

app.post(
  '/api/admin/publishing/jobs',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const {
        content_id,
        platform_account_id,
        scheduled_at
      } = req.body;

      const id = uuid();

      const result =
        await query(
          `
          INSERT INTO publishing_jobs
          (
            id,
            content_id,
            platform_account_id,
            scheduled_at
          )
          VALUES
          ($1,$2,$3,$4)
          RETURNING *
          `,
          [
            id,
            content_id,
            platform_account_id,
            scheduled_at || null
          ]
        );

      res.status(201).json({
        success: true,
        job: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   ANALYTICS
========================================================= */

app.post(
  '/api/analytics/event',
  async (req, res) => {
    try {
      const {
        event_type,
        content_id,
        platform,
        metadata
      } = req.body;

      if (!event_type) {
        return res.status(400).json({
          error:
            'event_type is required'
        });
      }

      await query(
        `
        INSERT INTO analytics_events
        (
          id,
          event_type,
          content_id,
          user_id,
          platform,
          metadata
        )
        VALUES
        ($1,$2,$3,$4,$5,$6)
        `,
        [
          uuid(),
          event_type,
          content_id || null,
          null,
          platform || null,
          metadata
            ? JSON.stringify(metadata)
            : null
        ]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get(
  '/api/admin/analytics',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT
            event_type,
            platform,
            COUNT(*)::INTEGER AS count
          FROM analytics_events
          GROUP BY
            event_type,
            platform
          ORDER BY count DESC
          `
        );

      res.json({
        success: true,
        analytics:
          result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   ACTIVITY LOG
========================================================= */

app.get(
  '/api/admin/activity',
  auth,
  adminOnly,
  async (req, res) => {
    try {
      const result =
        await query(
          `
          SELECT
            a.*,
            u.name AS user_name,
            u.email AS user_email
          FROM activity_logs a
          LEFT JOIN users u
            ON u.id = a.user_id
          ORDER BY a.created_at DESC
          LIMIT 500
          `
        );

      res.json({
        success: true,
        activities:
          result.rows
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

/* =========================================================
   404 API
========================================================= */

app.use(
  '/api',
  (req, res) => {
    res.status(404).json({
      error: 'API endpoint not found',
      path: req.originalUrl
    });
  }
);

/* =========================================================
   FRONTEND FALLBACK
========================================================= */

app.get(
  '*',
  (req, res) => {
    const indexFile =
      path.join(
        publicDir,
        'index.html'
      );

    if (
      fs.existsSync(indexFile)
    ) {
      return res.sendFile(
        indexFile
      );
    }

    res.status(404).send(
      'EZ MEDIA frontend not found'
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      '[SERVER ERROR]',
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(
      error.status || 500
    ).json({
      error:
        error.message ||
        'Internal Server Error'
    });
  }
);

/* =========================================================
   AUTOMATION TIMER
========================================================= */

let automationTimer = null;

function startAutomationTimer() {
  if (automationTimer) {
    clearInterval(
      automationTimer
    );
  }

  automationTimer =
    setInterval(
      async () => {
        try {
          if (
            databaseConnected
          ) {
            await runAutomation();

            console.log(
              '[AUTOMATION] Cycle completed'
            );
          }
        } catch (error) {
          console.error(
            '[AUTOMATION]',
            error.message
          );
        }
      },
      60 * 1000
    );
}

/* =========================================================
   START SERVER
========================================================= */

async function start() {
  console.log(
    '================================================'
  );

  console.log(
    ` ${PLATFORM} ${VERSION}`
  );

  console.log(
    ` Environment: ${NODE_ENV}`
  );

  console.log(
    ` Node: ${process.version}`
  );

  console.log(
    ` Port: ${PORT}`
  );

  console.log(
    '================================================'
  );

  await initDatabase();

  startAutomationTimer();

  app.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `[SERVER] ${PLATFORM} running on port ${PORT}`
      );

      console.log(
        `[SERVER] Environment: ${NODE_ENV}`
      );

      console.log(
        `[SERVER] Database: ${
          databaseConnected
            ? 'CONNECTED'
            : 'NOT CONNECTED'
        }`
      );
    }
  );
}

/* =========================================================
   PROCESS HANDLING
========================================================= */

process.on(
  'SIGTERM',
  async () => {
    console.log(
      '[SERVER] SIGTERM received'
    );

    if (automationTimer) {
      clearInterval(
        automationTimer
      );
    }

    if (pool) {
      await pool.end();
    }

    process.exit(0);
  }
);

process.on(
  'SIGINT',
  async () => {
    console.log(
      '[SERVER] SIGINT received'
    );

    if (automationTimer) {
      clearInterval(
        automationTimer
      );
    }

    if (pool) {
      await pool.end();
    }

    process.exit(0);
  }
);

process.on(
  'unhandledRejection',
  (error) => {
    console.error(
      '[UNHANDLED REJECTION]',
      error
    );
  }
);

process.on(
  'uncaughtException',
  (error) => {
    console.error(
      '[UNCAUGHT EXCEPTION]',
      error
    );
  }
);

start();

module.exports = app;
