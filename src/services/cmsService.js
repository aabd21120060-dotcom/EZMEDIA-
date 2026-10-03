const { query } = require("../database/db");

const ALLOWED_TYPES = [
  "news",
  "report",
  "interview",
  "video",
  "coverage",
  "breaking"
];

const ALLOWED_STATUSES = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "archived"
];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateContent(data) {
  if (!data.title || !String(data.title).trim()) {
    throw new Error("العنوان مطلوب");
  }

  if (data.type && !ALLOWED_TYPES.includes(data.type)) {
    throw new Error("نوع المحتوى غير صحيح");
  }

  if (data.status && !ALLOWED_STATUSES.includes(data.status)) {
    throw new Error("حالة المحتوى غير صحيحة");
  }
}

async function createContent(data, actorId = null) {
  validateContent(data);

  const slug = data.slug || slugify(data.title);

  const result = await query(
    `
    INSERT INTO cms_content (
      type,
      title,
      slug,
      summary,
      body,
      featured_image_url,
      video_url,
      audio_url,
      location,
      author_id,
      status,
      priority,
      is_breaking,
      is_featured,
      allow_comments,
      scheduled_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16
    )
    RETURNING *
    `,
    [
      data.type || "news",
      data.title.trim(),
      slug,
      data.summary || null,
      data.body || null,
      data.featuredImageUrl || null,
      data.videoUrl || null,
      data.audioUrl || null,
      data.location || null,
      actorId,
      data.status || "draft",
      data.priority || "normal",
      Boolean(data.isBreaking),
      Boolean(data.isFeatured),
      data.allowComments !== false,
      data.scheduledAt || null
    ]
  );

  const content = result.rows[0];

  await query(
    `
    INSERT INTO cms_content_events (
      content_id,
      event_type,
      actor_id,
      metadata
    )
    VALUES ($1,$2,$3,$4)
    `,
    [
      content.id,
      "created",
      actorId,
      JSON.stringify({
        type: content.type
      })
    ]
  );

  return content;
}

async function getContent(id) {
  const result = await query(
    `
    SELECT *
    FROM cms_content
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listContent(options = {}) {
  const values = [];
  const conditions = [];

  if (options.status) {
    values.push(options.status);
    conditions.push(`status = $${values.length}`);
  }

  if (options.type) {
    values.push(options.type);
    conditions.push(`type = $${values.length}`);
  }

  if (options.search) {
    values.push(`%${options.search}%`);
    conditions.push(`
      (
        title ILIKE $${values.length}
        OR summary ILIKE $${values.length}
        OR body ILIKE $${values.length}
      )
    `);
  }

  const limit = Math.min(Number(options.limit) || 50, 100);

  values.push(limit);

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await query(
    `
    SELECT *
    FROM cms_content
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length}
    `,
    values
  );

  return result.rows;
}

async function updateContent(id, data, actorId = null) {
  const current = await getContent(id);

  if (!current) {
    return null;
  }

  validateContent({
    title: data.title || current.title,
    type: data.type || current.type,
    status: data.status || current.status
  });

  await query(
    `
    INSERT INTO cms_content_revisions (
      content_id,
      title,
      summary,
      body,
      changed_by,
      change_type
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [
      id,
      current.title,
      current.summary,
      current.body,
      actorId,
      "before_update"
    ]
  );

  const result = await query(
    `
    UPDATE cms_content
    SET
      type = COALESCE($2, type),
      title = COALESCE($3, title),
      summary = COALESCE($4, summary),
      body = COALESCE($5, body),
      featured_image_url = COALESCE($6, featured_image_url),
      video_url = COALESCE($7, video_url),
      audio_url = COALESCE($8, audio_url),
      location = COALESCE($9, location),
      status = COALESCE($10, status),
      priority = COALESCE($11, priority),
      is_breaking = COALESCE($12, is_breaking),
      is_featured = COALESCE($13, is_featured),
      scheduled_at = COALESCE($14, scheduled_at),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      data.type,
      data.title,
      data.summary,
      data.body,
      data.featuredImageUrl,
      data.videoUrl,
      data.audioUrl,
      data.location,
      data.status,
      data.priority,
      data.isBreaking,
      data.isFeatured,
      data.scheduledAt
    ]
  );

  await query(
    `
    INSERT INTO cms_content_events (
      content_id,
      event_type,
      actor_id,
      metadata
    )
    VALUES ($1,$2,$3,$4)
    `,
    [
      id,
      "updated",
      actorId,
      JSON.stringify({
        status: result.rows[0].status
      })
    ]
  );

  return result.rows[0];
}

async function changeStatus(id, status, actorId = null) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error("الحالة غير صحيحة");
  }

  const publishedAt =
    status === "published"
      ? "NOW()"
      : "published_at";

  const result = await query(
    `
    UPDATE cms_content
    SET
      status = $2,
      published_at = ${publishedAt},
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, status]
  );

  if (!result.rows.length) {
    return null;
  }

  await query(
    `
    INSERT INTO cms_content_events (
      content_id,
      event_type,
      actor_id,
      metadata
    )
    VALUES ($1,$2,$3,$4)
    `,
    [
      id,
      `status_${status}`,
      actorId,
      JSON.stringify({
        status
      })
    ]
  );

  return result.rows[0];
}

module.exports = {
  createContent,
  getContent,
  listContent,
  updateContent,
  changeStatus
};
