"use strict";

const express = require("express");
const crypto = require("crypto");

const {
  createMediaAsset,
  getMediaAsset,
  listMediaAssets,
  updateMediaAsset,
  deleteMediaAsset,
  getMediaStatistics,
  attachMediaToContent
} = require("../services/mediaService");

const router = express.Router();

function createRequestId() {
  return crypto.randomUUID();
}

function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    platform: "EZ MEDIA",
    version: "11.0.0",
    requestId: res.locals.requestId,
    ...data
  });
}

function sendError(res, error) {
  const statusCode =
    Number(error.statusCode) >= 400
      ? Number(error.statusCode)
      : 500;

  return res.status(statusCode).json({
    success: false,
    platform: "EZ MEDIA",
    version: "11.0.0",
    requestId: res.locals.requestId,
    error: error.message || "حدث خطأ غير متوقع",
    code: error.code || "MEDIA_API_ERROR"
  });
}

router.use((req, res, next) => {
  res.locals.requestId = createRequestId();
  next();
});

/**
 * GET /api/media
 *
 * جلب مكتبة الوسائط مع البحث والتصفية والتقسيم إلى صفحات.
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      assetType = null,
      status = null,
      search = null
    } = req.query;

    const result = await listMediaAssets({
      page,
      limit,
      assetType,
      status,
      search
    });

    return sendSuccess(res, {
      message: "تم جلب مكتبة الوسائط بنجاح",
      media: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * GET /api/media/statistics
 *
 * إحصائيات مكتبة الوسائط.
 */
router.get("/statistics", async (req, res) => {
  try {
    const statistics = await getMediaStatistics();

    return sendSuccess(res, {
      message: "تم جلب إحصائيات الوسائط بنجاح",
      statistics
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * GET /api/media/:id
 *
 * جلب وسيط واحد.
 */
router.get("/:id", async (req, res) => {
  try {
    const media = await getMediaAsset(req.params.id);

    return sendSuccess(res, {
      message: "تم جلب الوسائط بنجاح",
      media
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * POST /api/media
 *
 * إنشاء سجل وسائط.
 *
 * هذا المسار لا يرفع الملف نفسه.
 * رفع الملف يتم عبر:
 * POST /api/upload
 *
 * ثم يمكن تسجيل بيانات الوسائط هنا إذا كان السيناريو يحتاج ذلك.
 */
router.post("/", async (req, res) => {
  try {
    const {
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
    } = req.body || {};

    if (!title) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "عنوان الوسائط مطلوب",
        code: "MEDIA_TITLE_REQUIRED"
      });
    }

    if (!assetType) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "نوع الوسائط مطلوب",
        code: "MEDIA_TYPE_REQUIRED"
      });
    }

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "رابط الوسائط مطلوب",
        code: "MEDIA_URL_REQUIRED"
      });
    }

    const media = await createMediaAsset({
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
      metadata
    });

    return sendSuccess(
      res,
      {
        message: "تم إنشاء سجل الوسائط بنجاح",
        media
      },
      201
    );
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * PATCH /api/media/:id
 *
 * تحديث بيانات الوسائط.
 */
router.patch("/:id", async (req, res) => {
  try {
    const {
      title,
      description,
      thumbnailUrl,
      status,
      durationSeconds,
      width,
      height,
      metadata
    } = req.body || {};

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "title")) {
      updates.title = title;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "description"
      )
    ) {
      updates.description = description;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "thumbnailUrl"
      )
    ) {
      updates.thumbnailUrl = thumbnailUrl;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
      updates.status = status;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "durationSeconds"
      )
    ) {
      updates.durationSeconds = durationSeconds;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "width"
      )
    ) {
      updates.width = width;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "height"
      )
    ) {
      updates.height = height;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "metadata"
      )
    ) {
      updates.metadata = metadata;
    }

    const media = await updateMediaAsset(
      req.params.id,
      updates
    );

    return sendSuccess(res, {
      message: "تم تحديث الوسائط بنجاح",
      media
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * POST /api/media/:id/attach
 *
 * ربط وسيط بمحتوى في نظام CMS.
 */
router.post("/:id/attach", async (req, res) => {
  try {
    const {
      contentId,
      role = "content"
    } = req.body || {};

    if (!contentId) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "معرّف المحتوى مطلوب",
        code: "CONTENT_ID_REQUIRED"
      });
    }

    const media = await attachMediaToContent({
      mediaId: req.params.id,
      contentId,
      role
    });

    return sendSuccess(res, {
      message: "تم ربط الوسائط بالمحتوى بنجاح",
      media,
      relation: {
        contentId,
        role
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * DELETE /api/media/:id
 *
 * حذف الوسائط من قاعدة البيانات
 * وحذف الملف من التخزين عند توفر storage_key.
 */
router.delete("/:id", async (req, res) => {
  try {
    const result = await deleteMediaAsset(req.params.id);

    return sendSuccess(res, {
      message: "تم حذف الوسائط بنجاح",
      media: result.asset
    });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
