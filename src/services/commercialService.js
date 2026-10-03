"use strict";

const { query } = require("../database/db");


function normalizeCampaignStatus(status) {
  const allowed = [
    "draft",
    "pending",
    "approved",
    "active",
    "paused",
    "completed",
    "cancelled"
  ];

  if (!allowed.includes(status)) {
    const error =
      new Error("حالة الحملة غير صحيحة");

    error.statusCode = 400;

    throw error;
  }

  return status;
}


function normalizeCampaignType(type) {
  const allowed = [
    "advertising",
    "sponsorship",
    "partnership"
  ];

  if (!allowed.includes(type)) {
    const error =
      new Error("نوع الحملة غير صحيح");

    error.statusCode = 400;

    throw error;
  }

  return type;
}


function normalizePlacementType(type) {
  const allowed = [
    "banner",
    "native",
    "video",
    "live",
    "article",
    "section",
    "homepage"
  ];

  if (!allowed.includes(type)) {
    const error =
      new Error("نوع الإعلان غير صحيح");

    error.statusCode = 400;

    throw error;
  }

  return type;
}


async function createCampaign(data = {}) {

  if (!data.name) {
    const error =
      new Error("اسم الحملة مطلوب");

    error.statusCode = 400;

    throw error;
  }


  const campaignType =
    normalizeCampaignType(
      data.campaignType ||
      "advertising"
    );


  const result =
    await query(
      `
      INSERT INTO commercial_campaigns (
        name,
        campaign_type,
        status,
        advertiser_name,
        sponsor_name,
        contact_name,
        contact_email,
        contact_phone,
        description,
        budget,
        currency,
        start_at,
        end_at,
        priority,
        targeting,
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
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16
      )
      RETURNING *
      `,
      [
        data.name,
        campaignType,
        data.status
          ? normalizeCampaignStatus(data.status)
          : "draft",

        data.advertiserName || null,
        data.sponsorName || null,
        data.contactName || null,
        data.contactEmail || null,
        data.contactPhone || null,
        data.description || null,
        data.budget || null,
        data.currency || "SAR",
        data.startAt || null,
        data.endAt || null,
        Number(data.priority || 0),
        JSON.stringify(
          data.targeting || {}
        ),
        JSON.stringify(
          data.metadata || {}
        )
      ]
    );


  return result.rows[0];
}


async function getCampaign(id) {

  const result =
    await query(
      `
      SELECT *
      FROM commercial_campaigns
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );


  if (!result.rows.length) {

    const error =
      new Error("الحملة غير موجودة");

    error.statusCode = 404;

    throw error;
  }


  return result.rows[0];
}


async function listCampaigns({
  page = 1,
  limit = 30,
  status = null,
  campaignType = null,
  search = null
} = {}) {

  const safePage =
    Math.max(
      Number(page) || 1,
      1
    );


  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 30,
        1
      ),
      100
    );


  const offset =
    (safePage - 1) *
    safeLimit;


  const conditions = [];

  const values = [];

  let index = 1;


  if (status) {

    conditions.push(
      `status = $${index}`
    );

    values.push(
      normalizeCampaignStatus(
        status
      )
    );

    index++;

  }


  if (campaignType) {

    conditions.push(
      `campaign_type = $${index}`
    );

    values.push(
      normalizeCampaignType(
        campaignType
      )
    );

    index++;

  }


  if (search) {

    conditions.push(`
      (
        name ILIKE $${index}
        OR advertiser_name ILIKE $${index}
        OR sponsor_name ILIKE $${index}
      )
    `);

    values.push(
      `%${search}%`
    );

    index++;

  }


  const where =
    conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";


  const countResult =
    await query(
      `
      SELECT COUNT(*)::integer AS total
      FROM commercial_campaigns
      ${where}
      `,
      values
    );


  const total =
    countResult.rows[0].total;


  values.push(
    safeLimit
  );

  const limitIndex =
    index;


  values.push(
    offset
  );

  const offsetIndex =
    index + 1;


  const result =
    await query(
      `
      SELECT *
      FROM commercial_campaigns
      ${where}
      ORDER BY
        priority DESC,
        created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
      `,
      values
    );


  return {
    items: result.rows,

    pagination: {
      page: safePage,
      limit: safeLimit,
      total,

      pages:
        Math.ceil(
          total / safeLimit
        )
    }
  };
}


async function updateCampaign(
  id,
  updates = {}
) {

  const fields = {
    name: "name",
    status: "status",
    advertiserName: "advertiser_name",
    sponsorName: "sponsor_name",
    contactName: "contact_name",
    contactEmail: "contact_email",
    contactPhone: "contact_phone",
    description: "description",
    budget: "budget",
    currency: "currency",
    startAt: "start_at",
    endAt: "end_at",
    priority: "priority",
    targeting: "targeting",
    metadata: "metadata"
  };


  const setParts = [];

  const values = [];

  let index = 1;


  for (
    const [
      key,
      column
    ] of Object.entries(fields)
  ) {

    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        key
      )
    ) {

      let value =
        updates[key];


      if (key === "status") {

        value =
          normalizeCampaignStatus(
            value
          );

      }


      if (
        key === "targeting" ||
        key === "metadata"
      ) {

        value =
          JSON.stringify(
            value || {}
          );

      }


      setParts.push(
        `${column} = $${index}`
      );

      values.push(
        value
      );

      index++;

    }

  }


  if (!setParts.length) {
    return getCampaign(id);
  }


  setParts.push(
    "updated_at = NOW()"
  );


  values.push(id);


  const result =
    await query(
      `
      UPDATE commercial_campaigns
      SET
        ${setParts.join(", ")}
      WHERE id = $${index}
      RETURNING *
      `,
      values
    );


  if (!result.rows.length) {

    const error =
      new Error(
        "الحملة غير موجودة"
      );

    error.statusCode = 404;

    throw error;
  }


  return result.rows[0];
}


async function deleteCampaign(id) {

  const result =
    await query(
      `
      DELETE FROM commercial_campaigns
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );


  if (!result.rows.length) {

    const error =
      new Error(
        "الحملة غير موجودة"
      );

    error.statusCode = 404;

    throw error;
  }


  return {
    success: true,
    campaign: result.rows[0]
  };
}


async function createPlacement(
  data = {}
) {

  if (!data.campaignId) {

    const error =
      new Error(
        "معرف الحملة مطلوب"
      );

    error.statusCode = 400;

    throw error;
  }


  if (!data.placementKey) {

    const error =
      new Error(
        "موقع الإعلان مطلوب"
      );

    error.statusCode = 400;

    throw error;
  }


  const result =
    await query(
      `
      INSERT INTO commercial_placements (
        campaign_id,
        placement_key,
        placement_type,
        title,
        image_url,
        video_url,
        destination_url,
        content_id,
        status,
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
        $9,
        $10
      )
      RETURNING *
      `,
      [
        data.campaignId,
        data.placementKey,
        normalizePlacementType(
          data.placementType ||
          "banner"
        ),
        data.title || null,
        data.imageUrl || null,
        data.videoUrl || null,
        data.destinationUrl || null,
        data.contentId || null,
        data.status || "active",
        JSON.stringify(
          data.metadata || {}
        )
      ]
    );


  return result.rows[0];
}


async function listPlacements(
  campaignId
) {

  const result =
    await query(
      `
      SELECT *
      FROM commercial_placements
      WHERE campaign_id = $1
      ORDER BY created_at DESC
      `,
      [campaignId]
    );


  return result.rows;
}


async function getActivePlacements(
  placementKey
) {

  const result =
    await query(
      `
      SELECT
        p.*,
        c.name AS campaign_name,
        c.campaign_type,
        c.priority,
        c.advertiser_name,
        c.sponsor_name
      FROM commercial_placements p
      INNER JOIN commercial_campaigns c
        ON c.id = p.campaign_id
      WHERE
        p.placement_key = $1
        AND p.status = 'active'
        AND c.status = 'active'
        AND (
          c.start_at IS NULL
          OR c.start_at <= NOW()
        )
        AND (
          c.end_at IS NULL
          OR c.end_at >= NOW()
        )
      ORDER BY
        c.priority DESC,
        RANDOM()
      LIMIT 10
      `,
      [placementKey]
    );


  return result.rows;
}


async function recordEvent({
  campaignId,
  placementId,
  eventType,
  visitorId = null,
  sessionId = null,
  contentId = null,
  metadata = {}
}) {

  if (!eventType) {

    const error =
      new Error(
        "نوع الحدث مطلوب"
      );

    error.statusCode = 400;

    throw error;
  }


  const result =
    await query(
      `
      INSERT INTO commercial_events (
        campaign_id,
        placement_id,
        event_type,
        visitor_id,
        session_id,
        content_id,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      RETURNING *
      `,
      [
        campaignId || null,
        placementId || null,
        eventType,
        visitorId,
        sessionId,
        contentId,
        JSON.stringify(
          metadata || {}
        )
      ]
    );


  if (placementId) {

    if (
      eventType ===
      "impression"
    ) {

      await query(
        `
        UPDATE commercial_placements
        SET
          impressions =
            impressions + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [placementId]
      );

    }


    if (
      eventType ===
      "click"
    ) {

      await query(
        `
        UPDATE commercial_placements
        SET
          clicks =
            clicks + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [placementId]
      );

    }


    if (
      eventType ===
      "start"
    ) {

      await query(
        `
        UPDATE commercial_placements
        SET
          starts =
            starts + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [placementId]
      );

    }


    if (
      eventType ===
      "complete"
    ) {

      await query(
        `
        UPDATE commercial_placements
        SET
          completed_views =
            completed_views + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [placementId]
      );

    }

  }


  return result.rows[0];
}


async function getStatistics() {

  const result =
    await query(
      `
      SELECT
        (
          SELECT COUNT(*)
          FROM commercial_campaigns
        )::integer AS campaigns,

        (
          SELECT COUNT(*)
          FROM commercial_campaigns
          WHERE status = 'active'
        )::integer AS active_campaigns,

        (
          SELECT COUNT(*)
          FROM commercial_placements
        )::integer AS placements,

        (
          SELECT COALESCE(
            SUM(impressions),
            0
          )
          FROM commercial_placements
        )::bigint AS impressions,

        (
          SELECT COALESCE(
            SUM(clicks),
            0
          )
          FROM commercial_placements
        )::bigint AS clicks,

        (
          SELECT COALESCE(
            SUM(starts),
            0
          )
          FROM commercial_placements
        )::bigint AS starts,

        (
          SELECT COALESCE(
            SUM(completed_views),
            0
          )
          FROM commercial_placements
        )::bigint AS completed_views
      `
    );


  return result.rows[0];
}


module.exports = {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  createPlacement,
  listPlacements,
  getActivePlacements,
  recordEvent,
  getStatistics
};
