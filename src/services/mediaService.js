"use strict";

/*
|--------------------------------------------------------------------------
| EZ MEDIA 11.0
| Media Service
|--------------------------------------------------------------------------
|
| إدارة المكتبة الإعلامية:
|
| - الصور
| - الفيديو
| - الصوت
| - المستندات
| - الملفات
| - البحث
| - التصنيف
| - الحذف
| - ربط الوسائط بالمحتوى
|
|--------------------------------------------------------------------------
*/

const {
  query
} = require("../database/db");

const {
  deleteFile
} = require("./storageService");

/*
|--------------------------------------------------------------------------
| إنشاء Media Asset
|--------------------------------------------------------------------------
*/

async function createMediaAsset({
  title,
  description = null,
  assetType,
  mimeType = null,
  fileUrl,
  thumbnailUrl = null,
  storageProvider = "s3",
  storageKey = null,
  fileSize = null,
  durationSeconds = null,
  width = null,
  height = null,
  uploadedBy = null,
  metadata = {}
}) {
  if (!title) {
    const error =
      new Error(
        "عنوان الوسائط مطلوب"
      );

    error.code =
      "MEDIA_TITLE_REQUIRED";

    error.statusCode =
      400;

    throw error;
  }

  if (!assetType) {
    const error =
      new Error(
        "نوع الوسائط مطلوب"
      );

    error.code =
      "MEDIA_TYPE_REQUIRED";

    error.statusCode =
      400;

    throw error;
  }

  if (!fileUrl) {
    const error =
      new Error(
        "رابط الوسائط مطلوب"
      );

    error.code =
      "MEDIA_URL_REQUIRED";

    error.statusCode =
      400;

    throw error;
  }

  const result =
    await query(
      `
      INSERT INTO media_assets (
        title,
        description,
        asset_type,
        mime_type,
        file_url,
        thumbnail_url,
        storage_provider,
        storage_key,
        file_size,
        duration_seconds,
        width,
        height,
        status,
        uploaded_by,
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
        'ready',
        $13,
        $14
      )
      RETURNING *
      `,
      [
        title,
        description,
        assetType,
        mimeType,
        fileUrl,
        thumbnailUrl,
        storageProvider,
        storageKey,
        fileSize,
        durationSeconds,
        width,
        height,
        uploadedBy,
        JSON.stringify(
          metadata || {}
        )
      ]
    );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| جلب وسائط
|--------------------------------------------------------------------------
*/

async function getMediaAsset(
  id
) {
  const result =
    await query(
      `
      SELECT *
      FROM media_assets
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

  if (
    result.rows.length ===
    0
  ) {
    const error =
      new Error(
        "الوسائط غير موجودة"
      );

    error.code =
      "MEDIA_NOT_FOUND";

    error.statusCode =
      404;

    throw error;
  }

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| قائمة المكتبة
|--------------------------------------------------------------------------
*/

async function listMediaAssets({
  page = 1,
  limit = 30,
  assetType = null,
  status = null,
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

  let parameterIndex =
    1;

  if (assetType) {
    conditions.push(
      `asset_type = $${parameterIndex}`
    );

    values.push(
      assetType
    );

    parameterIndex++;
  }

  if (status) {
    conditions.push(
      `status = $${parameterIndex}`
    );

    values.push(
      status
    );

    parameterIndex++;
  }

  if (search) {
    conditions.push(
      `
      (
        title ILIKE $${parameterIndex}
        OR description ILIKE $${parameterIndex}
        OR mime_type ILIKE $${parameterIndex}
      )
      `
    );

    values.push(
      `%${search}%`
    );

    parameterIndex++;
  }

  const whereClause =
    conditions.length
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  const countResult =
    await query(
      `
      SELECT COUNT(*)::integer AS total
      FROM media_assets
      ${whereClause}
      `,
      values
    );

  const total =
    countResult.rows[0]
      .total;

  values.push(
    safeLimit
  );

  const limitParameter =
    parameterIndex;

  values.push(
    offset
  );

  const offsetParameter =
    parameterIndex + 1;

  const result =
    await query(
      `
      SELECT *
      FROM media_assets
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParameter}
      OFFSET $${offsetParameter}
      `,
      values
    );

  return {
    items:
      result.rows,

    pagination: {
      page:
        safePage,

      limit:
        safeLimit,

      total,

      pages:
        Math.ceil(
          total /
          safeLimit
        )
    }
  };
}

/*
|--------------------------------------------------------------------------
| تحديث الوسائط
|--------------------------------------------------------------------------
*/

async function updateMediaAsset(
  id,
  updates = {}
) {
  const allowedFields = {
    title:
      "title",

    description:
      "description",

    thumbnailUrl:
      "thumbnail_url",

    status:
      "status",

    durationSeconds:
      "duration_seconds",

    width:
      "width",

    height:
      "height",

    metadata:
      "metadata"
  };

  const setParts = [];

  const values = [];

  let index = 1;

  for (
    const [
      key,
      column
    ] of Object.entries(
      allowedFields
    )
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        key
      )
    ) {
      setParts.push(
        `${column} = $${index}`
      );

      let value =
        updates[key];

      if (
        key ===
        "metadata"
      ) {
        value =
          JSON.stringify(
            value || {}
          );
      }

      values.push(
        value
      );

      index++;
    }
  }

  if (
    setParts.length ===
    0
  ) {
    return getMediaAsset(
      id
    );
  }

  setParts.push(
    "updated_at = NOW()"
  );

  values.push(id);

  const result =
    await query(
      `
      UPDATE media_assets
      SET
        ${setParts.join(
          ", "
        )}
      WHERE id = $${index}
      RETURNING *
      `,
      values
    );

  if (
    result.rows.length ===
    0
  ) {
    const error =
      new Error(
        "الوسائط غير موجودة"
      );

    error.code =
      "MEDIA_NOT_FOUND";

    error.statusCode =
      404;

    throw error;
  }

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| حذف الوسائط
|--------------------------------------------------------------------------
*/

async function deleteMediaAsset(
  id
) {
  const media =
    await getMediaAsset(
      id
    );

  /*
  |--------------------------------------------------------------------------
  | حذف الملف من Object Storage
  |--------------------------------------------------------------------------
  */

  if (
    media.storage_key
  ) {
    try {
      await deleteFile(
        media.storage_key
      );
    } catch (error) {
      /*
      |--------------------------------------------------------------------------
      | إذا لم يكن التخزين مهيأ،
      | لا نخفي خطأ قاعدة البيانات.
      |--------------------------------------------------------------------------
      */

      if (
        error.code !==
        "STORAGE_NOT_CONFIGURED"
      ) {
        throw error;
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | حذف السجل من PostgreSQL
  |--------------------------------------------------------------------------
  */

  const result =
    await query(
      `
      DELETE FROM media_assets
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

  return {
    success:
      true,

    asset:
      result.rows[0]
  };
}

/*
|--------------------------------------------------------------------------
| إحصائيات المكتبة
|--------------------------------------------------------------------------
*/

async function getMediaStatistics() {
  const result =
    await query(
      `
      SELECT
        COUNT(*)::integer AS total,

        COUNT(*) FILTER (
          WHERE asset_type = 'image'
        )::integer AS images,

        COUNT(*) FILTER (
          WHERE asset_type = 'video'
        )::integer AS videos,

        COUNT(*) FILTER (
          WHERE asset_type = 'audio'
        )::integer AS audios,

        COUNT(*) FILTER (
          WHERE asset_type = 'document'
        )::integer AS documents,

        COUNT(*) FILTER (
          WHERE status = 'ready'
        )::integer AS ready,

        COUNT(*) FILTER (
          WHERE status = 'processing'
        )::integer AS processing,

        COALESCE(
          SUM(file_size),
          0
        )::bigint AS total_size

      FROM media_assets
      `
    );

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| ربط الوسائط بالمحتوى
|--------------------------------------------------------------------------
|
| يتم تخزين العلاقة داخل metadata حاليًا.
| يمكن لاحقًا إنشاء جدول media_content_relations
| عندما نوسع النظام.
|
|--------------------------------------------------------------------------
*/

async function attachMediaToContent({
  mediaId,
  contentId,
  role = "content"
}) {
  const media =
    await getMediaAsset(
      mediaId
    );

  const metadata =
    media.metadata || {};

  const relations =
    Array.isArray(
      metadata.contentRelations
    )
      ? metadata.contentRelations
      : [];

  const exists =
    relations.some(
      (relation) =>
        relation.contentId ===
          contentId &&
        relation.role ===
          role
    );

  if (!exists) {
    relations.push({
      contentId,
      role,
      attachedAt:
        new Date()
          .toISOString()
    });
  }

  const updated =
    await updateMediaAsset(
      mediaId,
      {
        metadata: {
          ...metadata,

          contentRelations:
            relations
        }
      }
    );

  return updated;
}

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

module.exports = {
  createMediaAsset,

  getMediaAsset,

  listMediaAssets,

  updateMediaAsset,

  deleteMediaAsset,

  getMediaStatistics,

  attachMediaToContent
};
