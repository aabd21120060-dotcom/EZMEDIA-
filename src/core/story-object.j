import crypto from "node:crypto";
import { query, transaction } from "../config/database.js";

function createStoryKey() {
  return `EZ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

export async function createStory(input = {}) {
  const storyKey = createStoryKey();

  return transaction(async (client) => {
    const result = await client.query(
      `
      INSERT INTO stories (
        story_key,
        title,
        subtitle,
        summary,
        body,
        content_type,
        language,
        created_by,
        first_discovered_at,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        COALESCE($9::timestamptz, NOW()),
        $10::jsonb
      )
      RETURNING *
      `,
      [
        storyKey,
        input.title || null,
        input.subtitle || null,
        input.summary || null,
        input.body || null,
        input.contentType || "news",
        input.language || "ar",
        input.createdBy || "system",
        input.firstDiscoveredAt || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    const story = result.rows[0];

    await client.query(
      `
      INSERT INTO story_versions (
        story_id,
        version_number,
        title,
        summary,
        body,
        created_by
      )
      VALUES ($1, 1, $2, $3, $4, $5)
      `,
      [
        story.id,
        story.title,
        story.summary,
        story.body,
        input.createdBy || "system",
      ]
    );

    await client.query(
      `
      INSERT INTO audit_logs (
        actor_type,
        actor_id,
        action,
        resource_type,
        resource_id,
        after_data
      )
      VALUES (
        'system',
        'story-object',
        'story.created',
        'story',
        $1,
        $2::jsonb
      )
      `,
      [
        story.id,
        JSON.stringify(story),
      ]
    );

    return story;
  });
}

export async function getStory(storyId) {
  const result = await query(
    `
    SELECT *
    FROM stories
    WHERE id = $1
    LIMIT 1
    `,
    [storyId]
  );

  return result.rows[0] || null;
}

export async function updateStory(storyId, updates = {}) {
  const allowed = [
    "title",
    "subtitle",
    "summary",
    "body",
    "status",
    "content_type",
    "primary_category",
    "secondary_categories",
    "topics",
    "country",
    "region",
    "city",
    "district",
    "place",
    "confidence_score",
    "importance_score",
    "breaking_candidate",
    "metadata",
  ];

  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      values.push(
        Array.isArray(updates[key]) || typeof updates[key] === "object"
          ? JSON.stringify(updates[key])
          : updates[key]
      );

      fields.push(`${key} = $${values.length}`);
    }
  }

  if (!fields.length) {
    return getStory(storyId);
  }

  values.push(storyId);

  const result = await query(
    `
    UPDATE stories
    SET
      ${fields.join(", ")},
      updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}
