"use strict";

const express = require("express");

const {
  createMediaAsset,
  getMediaAsset,
  listMediaAssets
} = require("../services/mediaService");

const router = express.Router();

function databaseError(res, error) {
  if (
    error &&
    error.code ===
      "DATABASE_NOT_CONFIGURED"
  ) {
    return res.status(503).json({
      success: false,
      error:
        "DATABASE_NOT_CONFIGURED",
      message:
        "قاعدة البيانات غير مهيأة بعد"
    });
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    error:
      "MEDIA_DATABASE_ERROR",
    message:
      "تعذر تنفيذ عملية المكتبة الإعلامية"
  });
}

router.get(
  "/",
  async (req, res) => {
    try {
      const assets =
        await listMediaAssets({
          limit:
            req.query.limit,
          offset:
            req.query.offset
        });

      return res.json({
        success: true,
        data: assets
      });
    } catch (error) {
      return databaseError(
        res,
        error
      );
    }
  }
);

router.get(
  "/:id",
  async (req, res) => {
    try {
      const asset =
        await getMediaAsset(
          req.params.id
        );

      if (!asset) {
        return res.status(404).json({
          success: false,
          error:
            "MEDIA_NOT_FOUND"
        });
      }

      return res.json({
        success: true,
        data: asset
      });
    } catch (error) {
      return databaseError(
        res,
        error
      );
    }
  }
);

router.post(
  "/",
  async (req, res) => {
    try {
      const {
        title,
        asset_type,
        file_url
      } = req.body;

      if (
        !title ||
        !asset_type ||
        !file_url
      ) {
        return res.status(400).json({
          success: false,
          error:
            "INVALID_MEDIA_DATA",
          message:
            "title و asset_type و file_url مطلوبة"
        });
      }

      const asset =
        await createMediaAsset(
          req.body
        );

      return res.status(201).json({
        success: true,
        data: asset
      });
    } catch (error) {
      return databaseError(
        res,
        error
      );
    }
  }
);

module.exports = router;
