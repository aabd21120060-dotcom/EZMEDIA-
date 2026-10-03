import { query } from "../config/database.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * ARTICLE REPOSITORY
 * ==========================================
 */

export async function listArticles({
  organizationId,
  status,
  limit = 50,
  offset = 0
}) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    100
  );

  const safeOffset = Math.max(
    Number(offset) || 0,
    0
  );

  const params = [organizationId];
  const conditions = ["organization_id = $1"];

  if (status) {
    params.push(status);

    conditions.push(
      `status = $${params.length}`
    );
  }

  params.push(safeLimit);

  const limitPosition = params.length;

  params.push(safeOffset);

  const offsetPosition = params.length;

  const result = await query(
    `
      SELECT
        id,
        organization_id,
        author_id,
        title,
        slug,
        excerpt,
        content,
        status,
        category,
        tags,
        featured_media_id,
        published_at,
        scheduled_at,
        metadata,
        created_at,
        updated_at
      FROM articles
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `,
    params
  );

  return result.rows;
}

export async function findArticleById(
  organizationId,
  id
) {
  const result = await query(
    `
      SELECT
        id,
        organization_id,
        author_id,
        title,
        slug,
        excerpt,
        content,
        status,
        category,
        tags,
        featured_media_id,
        published_at,
        scheduled_at,
        metadata,
        created_at,
        updated_at
      FROM articles
      WHERE organization_id = $1
        AND id = $2
      LIMIT 1
    `,
    [organizationId, id]
  );

  return result.rows[0] || null;
}

export async function createArticle({
  organizationId,
  authorId = null,
  title,
  slug,
  excerpt = null,
  content = "",
  status = "draft",
  category = null,
  tags = [],
  featuredMediaId = null,
  scheduledAt = null,
  metadata = {}
}) {
  const result = await query(
    `
      INSERT INTO articles (
        organization_id,
        author_id,
        title,
        slug,
        excerpt,
        content,
        status,
        category,
        tags,
        featured_media_id,
        scheduled_at,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        $10,
        $11,
        $12::jsonb
      )
      RETURNING *
    `,
    [
      organizationId,
      authorId,
      title,
      slug,
      excerpt,
      content,
      status,
      category,
      JSON.stringify(tags),
      featuredMediaId,
      scheduledAt,
      JSON.stringify(metadata)
    ]
  );

  return result.rows[0];
}
