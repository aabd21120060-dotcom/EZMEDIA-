"use strict";

const { query } = require("../database/db");

const ALLOWED_STATUSES = [
  "offline",
  "testing",
  "live",
  "disabled"
];

const ALLOWED_SOURCE_TYPES = [
  "hls",
  "dash",
  "rtmp",
  "embed",
  "external"
];

function createError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeChannelSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function validateSourceUrl(sourceUrl) {
  if (!sourceUrl) {
    throw createError(
      "رابط البث مطلوب",
      "LIVE_SOURCE_URL_REQUIRED"
    );
  }

  try {
    const parsed = new URL(sourceUrl);

    if (!["http:", "https:", "rtmp:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw createError(
      "رابط البث غير صالح",
      "LIVE_SOURCE_URL_INVALID"
    );
  }
}

function validateSourceType(sourceType) {
  if (!ALLOWED_SOURCE_TYPES.includes(sourceType)) {
    throw createError(
      `نوع مصدر البث غير مدعوم: ${sourceType}`,
      "LIVE_SOURCE_TYPE_INVALID"
    );
  }
}

function validateStatus(status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw createError(
      `حالة القناة غير مدعومة: ${status}`,
      "LIVE_STATUS_INVALID"
    );
  }
}

async function createLiveChannel({
  name,
  slug = null,
  description = null,
  logoUrl = null,
  sourceType = "hls",
  sourceUrl,
  status = "offline",
  isFeatured = false,
  metadata = {}
}) {
  if (!name) {
    throw createError(
      "اسم القناة مطلوب",
      "LIVE_CHANNEL_NAME_REQUIRED"
    );
  }

  validateSourceType(sourceType);
  validateSourceUrl(sourceUrl);
  validateStatus(status);

  const channelSlug =
    normalizeChannelSlug(slug || name);

  if (!channelSlug) {
    throw createError(
      "معرّف القناة غير صالح",
      "LIVE_CHANNEL_SLUG_INVALID"
    );
  }

  const result = await query(
    `
    INSERT INTO live_channels (
      name,
      slug,
      description,
      logo_url,
      source_type,
      source_url,
      status,
      is_featured,
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
      $9
    )
    RETURNING *
    `,
    [
      name,
      channelSlug,
      description,
      logoUrl,
      sourceType,
      sourceUrl,
      status,
      Boolean(isFeatured),
      JSON.stringify(metadata || {})
    ]
  );

  return result.rows[0];
}

async function getLiveChannel(id) {
  const result = await query(
    `
    SELECT *
    FROM live_channels
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  if (result.rows.length === 0) {
    throw createError(
      "قناة البث غير موجودة",
      "LIVE_CHANNEL_NOT_FOUND",
      404
    );
  }

  return result.rows[0];
}

async function getLiveChannelBySlug(slug) {
  const result = await query(
    `
    SELECT *
    FROM live_channels
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  if (result.rows.length === 0) {
    throw createError(
      "قناة البث غير موجودة",
      "LIVE_CHANNEL_NOT_FOUND",
      404
    );
  }

  return result.rows[0];
}

async function listLiveChannels({
  page = 1,
  limit = 30,
  status = null,
  featured = null,
  search = null
} = {}) {
  const safePage = Math.max(
    Number(page) || 1,
    1
  );

  const safeLimit = Math.min(
    Math.max(Number(limit) || 30, 1),
    100
  );

  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const values = [];
  let parameterIndex = 1;

  if (status) {
    validateStatus(status);

    conditions.push(
      `status = $${parameterIndex}`
    );

    values.push(status);
    parameterIndex++;
  }

  if (featured !== null && featured !== undefined) {
    const featuredValue =
      featured === true ||
      featured === "true" ||
      featured === "1";

    conditions.push(
      `is_featured = $${parameterIndex}`
    );

    values.push(featuredValue);
    parameterIndex++;
  }

  if (search) {
    conditions.push(`
      (
        name ILIKE $${parameterIndex}
        OR slug ILIKE $${parameterIndex}
        OR description ILIKE $${parameterIndex}
      )
    `);

    values.push(`%${search}%`);
    parameterIndex++;
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await query(
    `
    SELECT COUNT(*)::integer AS total
    FROM live_channels
    ${whereClause}
    `,
    values
  );

  const total = countResult.rows[0].total;

  const limitParameter = parameterIndex;

  values.push(safeLimit);

  const offsetParameter = parameterIndex + 1;

  values.push(offset);

  const result = await query(
    `
    SELECT
      id,
      name,
      slug,
      description,
      logo_url,
      source_type,
      source_url,
      status,
      is_featured,
      metadata,
      created_at,
      updated_at
    FROM live_channels
    ${whereClause}
    ORDER BY
      is_featured DESC,
      created_at DESC
    LIMIT $${limitParameter}
    OFFSET $${offsetParameter}
    `,
    values
  );

  return {
    items: result.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
}

async function updateLiveChannel(id, updates = {}) {
  await getLiveChannel(id);

  const allowedFields = {
    name: "name",
    slug: "slug",
    description: "description",
    logoUrl: "logo_url",
    sourceType: "source_type",
    sourceUrl: "source_url",
    status: "status",
    isFeatured: "is_featured",
    metadata: "metadata"
  };

  const setParts = [];
  const values = [];
  let parameterIndex = 1;

  for (const [key, column] of Object.entries(
    allowedFields
  )) {
    if (
      !Object.prototype.hasOwnProperty.call(
        updates,
        key
      )
    ) {
      continue;
    }

    let value = updates[key];

    if (key === "sourceType") {
      validateSourceType(value);
    }

    if (key === "sourceUrl") {
      validateSourceUrl(value);
    }

    if (key === "status") {
      validateStatus(value);
    }

    if (key === "slug") {
      value = normalizeChannelSlug(value);

      if (!value) {
        throw createError(
          "معرّف القناة غير صالح",
          "LIVE_CHANNEL_SLUG_INVALID"
        );
      }
    }

    if (key === "metadata") {
      value = JSON.stringify(value || {});
    }

    if (key === "isFeatured") {
      value = Boolean(value);
    }

    setParts.push(
      `${column} = $${parameterIndex}`
    );

    values.push(value);
    parameterIndex++;
  }

  if (setParts.length === 0) {
    return getLiveChannel(id);
  }

  setParts.push("updated_at = NOW()");

  values.push(id);

  const result = await query(
    `
    UPDATE live_channels
    SET
      ${setParts.join(", ")}
    WHERE id = $${parameterIndex}
    RETURNING *
    `,
    values
  );

  if (result.rows.length === 0) {
    throw createError(
      "قناة البث غير موجودة",
      "LIVE_CHANNEL_NOT_FOUND",
      404
    );
  }

  return result.rows[0];
}

async function setLiveStatus(id, status) {
  validateStatus(status);

  const result = await query(
    `
    UPDATE live_channels
    SET
      status = $1,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [
      status,
      id
    ]
  );

  if (result.rows.length === 0) {
    throw createError(
      "قناة البث غير موجودة",
      "LIVE_CHANNEL_NOT_FOUND",
      404
    );
  }

  return result.rows[0];
}

async function deleteLiveChannel(id) {
  const result = await query(
    `
    DELETE FROM live_channels
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  if (result.rows.length === 0) {
    throw createError(
      "قناة البث غير موجودة",
      "LIVE_CHANNEL_NOT_FOUND",
      404
    );
  }

  return {
    success: true,
    channel: result.rows[0]
  };
}

async function getLiveStatistics() {
  const result = await query(
    `
    SELECT
      COUNT(*)::integer AS total,

      COUNT(*) FILTER (
        WHERE status = 'live'
      )::integer AS live,

      COUNT(*) FILTER (
        WHERE status = 'offline'
      )::integer AS offline,

      COUNT(*) FILTER (
        WHERE status = 'testing'
      )::integer AS testing,

      COUNT(*) FILTER (
        WHERE status = 'disabled'
      )::integer AS disabled,

      COUNT(*) FILTER (
        WHERE is_featured = TRUE
      )::integer AS featured

    FROM live_channels
    `
  );

  return result.rows[0];
}

async function getFeaturedLiveChannels() {
  const result = await query(
    `
    SELECT
      id,
      name,
      slug,
      description,
      logo_url,
      source_type,
      source_url,
      status,
      is_featured,
      metadata
    FROM live_channels
    WHERE is_featured = TRUE
      AND status != 'disabled'
    ORDER BY
      CASE
        WHEN status = 'live' THEN 0
        WHEN status = 'testing' THEN 1
        ELSE 2
      END,
      created_at DESC
    `
  );

  return result.rows;
}

module.exports = {
  createLiveChannel,
  getLiveChannel,
  getLiveChannelBySlug,
  listLiveChannels,
  updateLiveChannel,
  setLiveStatus,
  deleteLiveChannel,
  getLiveStatistics,
  getFeaturedLiveChannels,
  ALLOWED_STATUSES,
  ALLOWED_SOURCE_TYPES
};
