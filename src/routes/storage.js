"use strict";

const express =
  require("express");

const {
  isStorageConfigured,
  getStorageConfig
} =
  require("../services/storageService");

const router =
  express.Router();

router.get(
  "/status",
  async (
    req,
    res,
    next
  ) => {
    try {
      const configured =
        isStorageConfigured();

      const config =
        getStorageConfig();

      res.json({
        success: true,

        platform:
          "EZ MEDIA",

        version:
          "11.0.0",

        storage: {
          configured,

          provider:
            config.endpoint
              ? "S3 Compatible"
              : null,

          bucket:
            config.bucket
              ? "configured"
              : null,

          publicUrl:
            config.publicBaseUrl
              ? "configured"
              : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports =
  router;
