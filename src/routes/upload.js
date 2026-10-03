"use strict";

const express =
  require("express");

const multer =
  require("multer");

const {
  uploadBuffer,
  getPublicUrl
} =
  require("../services/storageService");

const {
  query
} =
  require("../database/db");

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Multer
|--------------------------------------------------------------------------
|
| نستخدم الذاكرة مؤقتًا.
| الملف ينتقل مباشرة من الطلب إلى Object Storage.
|
|--------------------------------------------------------------------------
*/

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        2 *
        1024 *
        1024 *
        1024
    }
  });

router.post(
  "/",
  upload.single("file"),
  async (
    req,
    res,
    next
  ) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "يجب اختيار ملف"
          });
      }

      const folder =
        req.body.folder ||
        "media";

      const title =
        req.body.title ||
        req.file.originalname;

      const description =
        req.body.description ||
        null;

      const uploaded =
        await uploadBuffer({
          buffer:
            req.file.buffer,

          originalName:
            req.file.originalname,

          mimeType:
            req.file.mimetype,

          folder,

          metadata: {
            source:
              "EZ MEDIA",

            original_name:
              req.file.originalname
          }
        });

      const result =
        await query(
          `
          INSERT INTO media_assets (
            title,
            description,
            asset_type,
            mime_type,
            file_url,
            storage_provider,
            storage_key,
            file_size,
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
            'ready',
            $9
          )
          RETURNING *
          `,
          [
            title,

            description,

            uploaded.assetType,

            uploaded.mimeType,

            uploaded.url,

            "s3",

            uploaded.key,

            uploaded.size,

            JSON.stringify({
              originalName:
                req.file.originalname,

              uploadedAt:
                new Date()
                  .toISOString()
            })
          ]
        );

      return res.json({
        success: true,

        platform:
          "EZ MEDIA",

        version:
          "11.0.0",

        message:
          "تم رفع الملف بنجاح",

        asset:
          result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports =
  router;
