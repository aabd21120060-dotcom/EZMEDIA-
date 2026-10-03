"use strict";

const express = require("express");
const crypto = require("crypto");

const {
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
} = require("../services/liveService");

const router = express.Router();

function createRequestId() {
  return crypto.randomUUID();
}

function successResponse(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    platform: "EZ MEDIA",
    version: "11.0.0",
    requestId: res.locals.requestId,
    ...data
  });
}

function errorResponse(res, error) {
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
    code: error.code || "LIVE_API_ERROR"
  });
}

router.use((req, res, next) => {
  res.locals.requestId = createRequestId();
  next();
});

/*
|--------------------------------------------------------------------------
| معلومات نظام البث
|--------------------------------------------------------------------------
*/

router.get("/system", async (req, res) => {
  return successResponse(res, {
    message: "نظام البث المباشر في EZ MEDIA جاهز",
    live: {
      statuses: ALLOWED_STATUSES,
      sourceTypes: ALLOWED_SOURCE_TYPES,
      supported: true
    }
  });
});

/*
|--------------------------------------------------------------------------
| إحصائيات البث
|--------------------------------------------------------------------------
*/

router.get("/statistics", async (req, res) => {
  try {
    const statistics = await getLiveStatistics();

    return successResponse(res, {
      message: "تم جلب إحصائيات البث بنجاح",
      statistics
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| القنوات المميزة
|--------------------------------------------------------------------------
*/

router.get("/featured", async (req, res) => {
  try {
    const channels = await getFeaturedLiveChannels();

    return successResponse(res, {
      message: "تم جلب القنوات المميزة بنجاح",
      channels
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| جلب القنوات
|--------------------------------------------------------------------------
|
| GET /api/live
|
| أمثلة:
|
| /api/live
| /api/live?page=1&limit=20
| /api/live?status=live
| /api/live?featured=true
| /api/live?search=الأخبار
|
*/

router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      status = null,
      featured = null,
      search = null
    } = req.query;

    const result = await listLiveChannels({
      page,
      limit,
      status,
      featured,
      search
    });

    return successResponse(res, {
      message: "تم جلب قنوات البث بنجاح",
      channels: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| جلب قناة بواسطة Slug
|--------------------------------------------------------------------------
|
| GET /api/live/slug/:slug
|
*/

router.get("/slug/:slug", async (req, res) => {
  try {
    const channel = await getLiveChannelBySlug(
      req.params.slug
    );

    return successResponse(res, {
      message: "تم جلب القناة بنجاح",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| جلب قناة بواسطة ID
|--------------------------------------------------------------------------
|
| GET /api/live/:id
|
*/

router.get("/:id", async (req, res) => {
  try {
    const channel = await getLiveChannel(
      req.params.id
    );

    return successResponse(res, {
      message: "تم جلب قناة البث بنجاح",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| إنشاء قناة بث
|--------------------------------------------------------------------------
|
| POST /api/live
|
*/

router.post("/", async (req, res) => {
  try {
    const {
      name,
      slug = null,
      description = null,
      logoUrl = null,
      sourceType = "hls",
      sourceUrl,
      status = "offline",
      isFeatured = false,
      metadata = {}
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "اسم القناة مطلوب",
        code: "LIVE_CHANNEL_NAME_REQUIRED"
      });
    }

    if (!sourceUrl) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "رابط مصدر البث مطلوب",
        code: "LIVE_SOURCE_URL_REQUIRED"
      });
    }

    const channel = await createLiveChannel({
      name,
      slug,
      description,
      logoUrl,
      sourceType,
      sourceUrl,
      status,
      isFeatured,
      metadata
    });

    return successResponse(
      res,
      {
        message: "تم إنشاء قناة البث بنجاح",
        channel
      },
      201
    );
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| تحديث قناة
|--------------------------------------------------------------------------
|
| PATCH /api/live/:id
|
*/

router.patch("/:id", async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "slug",
      "description",
      "logoUrl",
      "sourceType",
      "sourceUrl",
      "status",
      "isFeatured",
      "metadata"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body || {},
          field
        )
      ) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "لم يتم إرسال أي بيانات للتحديث",
        code: "LIVE_UPDATE_EMPTY"
      });
    }

    const channel = await updateLiveChannel(
      req.params.id,
      updates
    );

    return successResponse(res, {
      message: "تم تحديث قناة البث بنجاح",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| تغيير حالة القناة
|--------------------------------------------------------------------------
|
| POST /api/live/:id/status
|
| الحالات:
| offline
| testing
| live
| disabled
|
*/

router.post("/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({
        success: false,
        platform: "EZ MEDIA",
        version: "11.0.0",
        requestId: res.locals.requestId,
        error: "حالة القناة مطلوبة",
        code: "LIVE_STATUS_REQUIRED"
      });
    }

    const channel = await setLiveStatus(
      req.params.id,
      status
    );

    return successResponse(res, {
      message: "تم تغيير حالة البث بنجاح",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| تشغيل القناة
|--------------------------------------------------------------------------
|
| POST /api/live/:id/start
|
*/

router.post("/:id/start", async (req, res) => {
  try {
    const channel = await setLiveStatus(
      req.params.id,
      "live"
    );

    return successResponse(res, {
      message: "تم تشغيل حالة البث للقناة",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| إيقاف القناة
|--------------------------------------------------------------------------
|
| POST /api/live/:id/stop
|
*/

router.post("/:id/stop", async (req, res) => {
  try {
    const channel = await setLiveStatus(
      req.params.id,
      "offline"
    );

    return successResponse(res, {
      message: "تم إيقاف حالة البث للقناة",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| اختبار القناة
|--------------------------------------------------------------------------
|
| POST /api/live/:id/test
|
*/

router.post("/:id/test", async (req, res) => {
  try {
    const channel = await setLiveStatus(
      req.params.id,
      "testing"
    );

    return successResponse(res, {
      message: "تم تحويل القناة إلى وضع الاختبار",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| تعطيل القناة
|--------------------------------------------------------------------------
|
| POST /api/live/:id/disable
|
*/

router.post("/:id/disable", async (req, res) => {
  try {
    const channel = await setLiveStatus(
      req.params.id,
      "disabled"
    );

    return successResponse(res, {
      message: "تم تعطيل القناة",
      channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/*
|--------------------------------------------------------------------------
| حذف قناة
|--------------------------------------------------------------------------
|
| DELETE /api/live/:id
|
*/

router.delete("/:id", async (req, res) => {
  try {
    const result = await deleteLiveChannel(
      req.params.id
    );

    return successResponse(res, {
      message: "تم حذف قناة البث بنجاح",
      channel: result.channel
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

module.exports = router;
