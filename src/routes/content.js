const express = require("express");

const {
  createContent,
  getContent,
  listContent,
  updateContent,
  changeStatus
} = require("../services/cmsService");

const router = express.Router();

function actorId(req) {
  return req.user?.id || null;
}

function databaseError(res, error) {
  if (error.code === "DATABASE_NOT_CONFIGURED") {
    return res.status(503).json({
      success: false,
      error: "DATABASE_NOT_CONFIGURED",
      message: "قاعدة البيانات لم يتم إعدادها بعد"
    });
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    error: "CMS_ERROR",
    message: "حدث خطأ في نظام المحتوى"
  });
}

/**
 * إنشاء محتوى
 */
router.post("/", async (req, res) => {
  try {
    const content = await createContent(
      req.body,
      actorId(req)
    );

    res.status(201).json({
      success: true,
      content
    });
  } catch (error) {
    if (
      error.message === "العنوان مطلوب" ||
      error.message === "نوع المحتوى غير صحيح" ||
      error.message === "حالة المحتوى غير صحيحة"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return databaseError(res, error);
  }
});

/**
 * قائمة المحتوى
 */
router.get("/", async (req, res) => {
  try {
    const content = await listContent({
      status: req.query.status,
      type: req.query.type,
      search: req.query.search,
      limit: req.query.limit
    });

    res.json({
      success: true,
      count: content.length,
      content
    });
  } catch (error) {
    return databaseError(res, error);
  }
});

/**
 * محتوى واحد
 */
router.get("/:id", async (req, res) => {
  try {
    const content = await getContent(req.params.id);

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "المحتوى غير موجود"
      });
    }

    res.json({
      success: true,
      content
    });
  } catch (error) {
    return databaseError(res, error);
  }
});

/**
 * تعديل المحتوى
 */
router.patch("/:id", async (req, res) => {
  try {
    const content = await updateContent(
      req.params.id,
      req.body,
      actorId(req)
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "المحتوى غير موجود"
      });
    }

    res.json({
      success: true,
      content
    });
  } catch (error) {
    return databaseError(res, error);
  }
});

/**
 * إرسال للمراجعة
 */
router.post("/:id/submit-review", async (req, res) => {
  try {
    const content = await changeStatus(
      req.params.id,
      "review",
      actorId(req)
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "المحتوى غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم إرسال المحتوى للمراجعة",
      content
    });
  } catch (error) {
    return databaseError(res, error);
  }
});

/**
 * اعتماد المحتوى
 */
router.post("/:id/approve", async (req, res) => {
  try {
    const content = await changeStatus(
      req.params.id,
      "approved",
      actorId(req)
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "المحتوى غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم اعتماد المحتوى",
      content
    });
  } catch (error) {
    return databaseError(res, error);
  }
});

/**
 * نشر المحتوى
 */
router.post("/:id/publish", async (req, res) => {
  try {
    const content = await changeStatus(
      req.params.id,
      "published",
      actorId(req)
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "المحتوى غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم نشر المحتوى",
      content
    });
  } catch (error) {
    return databaseError(res, error);
  }
});

/**
 * أرشفة
 */
router.post("/:id/archive", async (req, res) => {
  try {
    const content = await changeStatus(
      req.params.id,
      "archived",
      actorId(req)
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "تم العثور على المحتوى"
      });
    }

    res.json({
      success: true,
      message: "تمت أرشفة المحتوى",
      content
    });
  } catch (error) {
    return databaseError(res, error);
  }
});

module.exports = router;
