import { query } from "../config/database.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * USER REPOSITORY
 * ==========================================
 */

export async function findUserById(id) {
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
      WHERE u.id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function findUserByEmail(
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
    [organizationId, email]
  );

  return result.rows[0] || null;
}

export async function createUser({
  organizationId,
  name,
  email,
  passwordHash,
  status = "active",
  metadata = {}
}) {
  const result = await query(
    `
      INSERT INTO users (
        organization_id,
        name,
        email,
        password_hash,
        status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
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
    [
      organizationId,
      name,
      email,
      passwordHash,
      status,
      JSON.stringify(metadata)
    ]
  );

  return result.rows[0];
}

export async function updateLastLogin(id) {
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
    [id]
  );

  return result.rows[0] || null;
}

export async function listUsers(
  organizationId,
  limit = 50,
  offset = 0
) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    100
  );

  const safeOffset = Math.max(
    Number(offset) || 0,
    0
  );

  const result = await query(
    `
      SELECT
        u.id,
        u.organization_id,
        u.name,
        u.email,
        u.status,
        u.email_verified_at,
        u.last_login_at,
        u.metadata,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.organization_id = $1
      ORDER BY u.created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [organizationId, safeLimit, safeOffset]
  );

  return result.rows;
}
