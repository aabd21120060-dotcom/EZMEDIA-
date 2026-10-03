import { query } from "../config/database.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * ORGANIZATION REPOSITORY
 * ==========================================
 */

export async function findOrganizationBySlug(slug) {
  const result = await query(
    `
      SELECT
        id,
        name,
        slug,
        status,
        settings,
        metadata,
        created_at,
        updated_at
      FROM organizations
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

export async function findOrganizationById(id) {
  const result = await query(
    `
      SELECT
        id,
        name,
        slug,
        status,
        settings,
        metadata,
        created_at,
        updated_at
      FROM organizations
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function createOrganization({
  name,
  slug,
  settings = {},
  metadata = {}
}) {
  const result = await query(
    `
      INSERT INTO organizations (
        name,
        slug,
        settings,
        metadata
      )
      VALUES ($1, $2, $3::jsonb, $4::jsonb)
      RETURNING
        id,
        name,
        slug,
        status,
        settings,
        metadata,
        created_at,
        updated_at
    `,
    [
      name,
      slug,
      JSON.stringify(settings),
      JSON.stringify(metadata)
    ]
  );

  return result.rows[0];
}

export async function listOrganizations() {
  const result = await query(
    `
      SELECT
        id,
        name,
        slug,
        status,
        settings,
        metadata,
        created_at,
        updated_at
      FROM organizations
      ORDER BY created_at ASC
    `
  );

  return result.rows;
}
