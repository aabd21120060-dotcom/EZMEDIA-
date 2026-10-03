import { query } from "../config/database.js";

/*
 * ==========================================
 * EZ MEDIA 11.0
 * MEDIA REPOSITORY
 * ==========================================
 */

export async function listMedia({
  organizationId,
  status,
  type,
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

  if (type) {
    params.push(type);

    conditions.push(
      `type = $${params.length}`
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
        uploaded_by,
        name,
        original_name,
        type,
        mime_type,
        storage_provider,
        storage_key,
        public_url,
        size_bytes,
        checksum,
        width,
        height,
        duration_seconds,
        metadata,
        status,
        created_at,
        updated_at
      FROM media_assets
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `,
    params
  );

  return result.rows;
}

export async function findMediaById(
  organizationId,
  id
) {
  const result = await query(
    `
      SELECT *
      FROM media_assets
      WHERE organization_id = $1
        AND id = $2
      LIMIT 1
    `,
    [organizationId, id]
  );

  return result.rows[0] || null;
}

export async function createMedia({
  organizationId,
  uploadedBy = null,
  name,
  originalName = null,
  type,
  mimeType = null,
  storageProvider = null,
  storageKey = null,
  publicUrl = null,
  sizeBytes = null,
  checksum = null,
  width = null,
  height = null,
  durationSeconds = null,
  metadata = {},
  status = "uploaded"
}) {
  const result = await query(
    `
      INSERT INTO media_assets (
        organization_id,
        uploaded_by,
        name,
        original_name,
        type,
        mime_type,
        storage_provider,
        storage_key,
        public_url,
        size_bytes,
        checksum,
        width,
        height,
        duration_seconds,
        metadata,
        status
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
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15::jsonb,
        $16
      )
      RETURNING *
    `,
    [
      organizationId,
      uploadedBy,
      name,
      originalName,
      type,
      mimeType,
      storageProvider,
      storageKey,
      publicUrl,
      sizeBytes,
      checksum,
      width,
      height,
      durationSeconds,
      JSON.stringify(metadata),
      status
    ]
  );

  return result.rows[0];
}
