import { query } from "../config/database.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * AUTH REPOSITORY
 * ==========================================
 */

export async function findUserForLogin(
  organizationId,
  email
) {
  const result = await query(
    `
      SELECT
        u.id,
        u.organization_id,
        u.name,
        u.email,
        u.password_hash,
        u.status,
        u.email_verified_at,
        u.last_login_at,
        u.metadata,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.organization_id = $1
        AND LOWER(u.email) = LOWER($2)
      LIMIT 1
    `,
    [
      organizationId,
      email
    ]
  );

  return result.rows[0] || null;
}

export async function findUserRoles(userId) {
  const result = await query(
    `
      SELECT
        r.id,
        r.name,
        r.slug
      FROM user_roles ur
      INNER JOIN roles r
        ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.name ASC
    `,
    [userId]
  );

  return result.rows;
}

export async function findUserPermissions(userId) {
  const result = await query(
    `
      SELECT DISTINCT
        p.id,
        p.name,
        p.slug
      FROM user_roles ur
      INNER JOIN role_permissions rp
        ON rp.role_id = ur.role_id
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE ur.user_id = $1
      ORDER BY p.name ASC
    `,
    [userId]
  );

  return result.rows;
}

export async function updateLoginState(userId) {
  const result = await query(
    `
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        organization_id,
        name,
        email,
        status,
        email_verified_at,
        last_login_at,
        metadata,
        created_at,
        updated_at
    `,
    [userId]
  );

  return result.rows[0] || null;
}
