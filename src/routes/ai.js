const express = require("express");

const {
  analyzeContent,
  getLatestAnalysis
} = require("../services/aiService");

const router = express.Router();

function actorId(req) {
  return req.user?.id || null;
}

router.post("/content/:id/analyze", async (req, res) => {
  try {
    const result = await analyzeContent(
      req.params.id,
      actorId(req)
    );

    return res.status(201).json({
      success: true,
      message: "تم تحليل المحتوى بواسطة EZ AI",
      ...result
    });
  } catch (error) {
    if (error.code === "AI_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        error: "AI_NOT_CONFIGURED",
        message: "محرك الذكاء الاصطناعي يحتاج إلى إعداد مفتاح المزود"
      });
    }

    if (error.code === "CONTENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "المحتوى غير موجود"
      });
    }

    if (error.code === "AI_PROVIDER_ERROR") {
      return res.status(502).json({
        success: false,
        error: "AI_PROVIDER_ERROR",
        message: "مزود الذكاء الاصطناعي لم يُرجع استجابة ناجحة"
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      error: "AI_ERROR",
      message: "حدث خطأ أثناء تحليل المحتوى"
    });
  }
});

router.get("/content/:id/latest", async (req, res) => {
  try {
    const analysis = await getLatestAnalysis(
      req.params.id
    );

    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "AI_ERROR"
    });
  }
});

module.exports = router;
