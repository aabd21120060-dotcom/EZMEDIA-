"use strict";

const { query } = require("./db");

async function initializeAuthDatabase() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      full_name VARCHAR(200) NOT NULL,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) UNIQUE,

      password_hash TEXT NOT NULL,

      role VARCHAR(50) NOT NULL DEFAULT 'editor'
        CHECK (
          role IN (
            'super_admin',
            'admin',
            'editor',
            'producer',
            'journalist',
            'media_manager',
            'commercial_manager',
            'analyst',
            'viewer'
          )
        ),

      status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (
          status IN (
            'active',
            'inactive',
            'suspended',
            'pending'
          )
        ),

      avatar_url TEXT,

      phone VARCHAR(50),

      last_login_at TIMESTAMPTZ,

      failed_login_attempts INTEGER NOT NULL DEFAULT 0,

      locked_until TIMESTAMPTZ,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      role_key VARCHAR(100) NOT NULL UNIQUE,

      role_name VARCHAR(200) NOT NULL,

      description TEXT,

      permissions JSONB NOT NULL DEFAULT '[]'::jsonb,

      is_system_role BOOLEAN NOT NULL DEFAULT FALSE,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      user_id UUID NOT NULL
        REFERENCES admin_users(id)
        ON DELETE CASCADE,

      session_token_hash TEXT NOT NULL UNIQUE,

      ip_address INET,

      user_agent TEXT,

      device_name VARCHAR(200),

      expires_at TIMESTAMPTZ NOT NULL,

      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      revoked_at TIMESTAMPTZ,

      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      permission_key VARCHAR(150) NOT NULL UNIQUE,

      permission_name VARCHAR(200) NOT NULL,

      module VARCHAR(100) NOT NULL,

      description TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      user_id UUID
        REFERENCES admin_users(id)
        ON DELETE SET NULL,

      action VARCHAR(100) NOT NULL,

      module VARCHAR(100),

      resource_type VARCHAR(100),

      resource_id UUID,

      ip_address INET,

      user_agent TEXT,

      details JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_users_role
    ON admin_users(role);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_users_status
    ON admin_users(status);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id
    ON admin_sessions(user_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
    ON admin_sessions(expires_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked_at
    ON admin_sessions(revoked_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_user_id
    ON admin_audit_logs(user_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
    ON admin_audit_logs(action);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
    ON admin_audit_logs(created_at DESC);
  `);

  await query(`
    INSERT INTO admin_roles (
      role_key,
      role_name,
      description,
      permissions,
      is_system_role
    )
    VALUES
      (
        'super_admin',
        'المدير الأعلى',
        'صلاحية كاملة على جميع أنظمة EZ MEDIA',
        '["*"]'::jsonb,
        TRUE
      ),
      (
        'admin',
        'مدير المنصة',
        'إدارة المنصة والمحتوى والمستخدمين',
        '[
          "dashboard.view",
          "content.view",
          "content.create",
          "content.edit",
          "content.publish",
          "media.view",
          "media.upload",
          "media.edit",
          "live.view",
          "live.manage",
          "breaking.view",
          "breaking.manage",
          "commercial.view",
          "commercial.manage",
          "analytics.view",
          "ai.view",
          "ai.run",
          "users.view",
          "users.manage"
        ]'::jsonb,
        TRUE
      ),
      (
        'editor',
        'محرر',
        'إدارة المحتوى والتحرير والنشر',
        '[
          "dashboard.view",
          "content.view",
          "content.create",
          "content.edit",
          "content.review",
          "content.publish",
          "media.view",
          "media.upload",
          "ai.view",
          "ai.run"
        ]'::jsonb,
        TRUE
      ),
      (
        'producer',
        'منتج',
        'إدارة الإنتاج والمحتوى المرئي',
        '[
          "dashboard.view",
          "content.view",
          "content.create",
          "content.edit",
          "media.view",
          "media.upload",
          "media.edit",
          "live.view",
          "live.manage"
        ]'::jsonb,
        TRUE
      ),
      (
        'journalist',
        'صحفي',
        'إنشاء الأخبار والتقارير والتغطيات',
        '[
          "dashboard.view",
          "content.view",
          "content.create",
          "content.edit",
          "media.view",
          "media.upload",
          "breaking.view",
          "breaking.create",
          "ai.view",
          "ai.run"
        ]'::jsonb,
        TRUE
      ),
      (
        'media_manager',
        'مدير الوسائط',
        'إدارة مكتبة الوسائط والملفات',
        '[
          "dashboard.view",
          "media.view",
          "media.upload",
          "media.edit",
          "media.delete"
        ]'::jsonb,
        TRUE
      ),
      (
        'commercial_manager',
        'مدير الإعلانات والرعايات',
        'إدارة الحملات والإعلانات والرعايات',
        '[
          "dashboard.view",
          "commercial.view",
          "commercial.create",
          "commercial.edit",
          "commercial.manage"
        ]'::jsonb,
        TRUE
      ),
      (
        'analyst',
        'محلل',
        'الوصول إلى التحليلات والتقارير',
        '[
          "dashboard.view",
          "analytics.view",
          "commercial.view"
        ]'::jsonb,
        TRUE
      ),
      (
        'viewer',
        'مشاهد إداري',
        'صلاحية قراءة محدودة',
        '[
          "dashboard.view",
          "content.view",
          "media.view",
          "live.view",
          "analytics.view"
        ]'::jsonb,
        TRUE
      )
    ON CONFLICT (role_key) DO NOTHING;
  `);

  await query(`
    INSERT INTO admin_permissions (
      permission_key,
      permission_name,
      module,
      description
    )
    VALUES
      (
        'dashboard.view',
        'عرض لوحة التحكم',
        'dashboard',
        'الوصول إلى لوحة التحكم الرئيسية'
      ),
      (
        'content.view',
        'عرض المحتوى',
        'content',
        'عرض محتوى المنصة'
      ),
      (
        'content.create',
        'إنشاء المحتوى',
        'content',
        'إنشاء مادة إعلامية جديدة'
      ),
      (
        'content.edit',
        'تعديل المحتوى',
        'content',
        'تعديل المواد الإعلامية'
      ),
      (
        'content.review',
        'مراجعة المحتوى',
        'content',
        'مراجعة المواد قبل النشر'
      ),
      (
        'content.publish',
        'نشر المحتوى',
        'content',
        'نشر المحتوى على المنصة'
      ),
      (
        'media.view',
        'عرض الوسائط',
        'media',
        'عرض مكتبة الوسائط'
      ),
      (
        'media.upload',
        'رفع الوسائط',
        'media',
        'رفع الملفات والصور والفيديو'
      ),
      (
        'media.edit',
        'تعديل الوسائط',
        'media',
        'تعديل بيانات الوسائط'
      ),
      (
        'media.delete',
        'حذف الوسائط',
        'media',
        'حذف الوسائط'
      ),
      (
        'live.view',
        'عرض البث',
        'live',
        'مشاهدة وإدارة معلومات البث'
      ),
      (
        'live.manage',
        'إدارة البث',
        'live',
        'إنشاء وإدارة قنوات البث'
      ),
      (
        'breaking.view',
        'عرض عاجل',
        'breaking',
        'عرض الأخبار العاجلة'
      ),
      (
        'breaking.create',
        'إنشاء عاجل',
        'breaking',
        'إنشاء الأخبار العاجلة'
      ),
      (
        'breaking.manage',
        'إدارة عاجل',
        'breaking',
        'إدارة الأخبار العاجلة ونشرها'
      ),
      (
        'commercial.view',
        'عرض التجاري',
        'commercial',
        'عرض الإعلانات والرعايات'
      ),
      (
        'commercial.create',
        'إنشاء حملة',
        'commercial',
        'إنشاء حملة تجارية'
      ),
      (
        'commercial.edit',
        'تعديل حملة',
        'commercial',
        'تعديل الحملات'
      ),
      (
        'commercial.manage',
        'إدارة التجاري',
        'commercial',
        'إدارة الإعلانات والرعايات والشراكات'
      ),
      (
        'analytics.view',
        'عرض التحليلات',
        'analytics',
        'الوصول إلى تحليلات المنصة'
      ),
      (
        'ai.view',
        'عرض الذكاء الاصطناعي',
        'ai',
        'الوصول إلى مركز الذكاء الاصطناعي'
      ),
      (
        'ai.run',
        'تشغيل الذكاء الاصطناعي',
        'ai',
        'تشغيل عمليات التحليل بالذكاء الاصطناعي'
      ),
      (
        'users.view',
        'عرض المستخدمين',
        'users',
        'عرض مستخدمي الإدارة'
      ),
      (
        'users.manage',
        'إدارة المستخدمين',
        'users',
        'إنشاء وتعديل وتعطيل مستخدمي الإدارة'
      )
    ON CONFLICT (permission_key) DO NOTHING;
  `);

  return {
    success: true,
    tables: [
      "admin_users",
      "admin_roles",
      "admin_sessions",
      "admin_permissions",
      "admin_audit_logs"
    ]
  };
}

module.exports = {
  initializeAuthDatabase
};
