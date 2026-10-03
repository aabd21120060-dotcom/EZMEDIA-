"use strict";

const express = require("express");

const {
  createBreakingNews,
  listBreakingNews
} = require("../services/mediaService");

const router = express.Router();

router.get(
  "/",
  async (req, res) => {
    try {
      const news =
        await listBreakingNews();

      return res.json({
        success: true,
        data: news
      });
    } catch (error) {
      console.error(error);

      return res.status(503).json({
        success: false,
        error:
          error.code ||
          "BREAKING_NEWS_ERROR"
      });
    }
  }
);

router.post(
  "/",
  async (req, res) => {
    try {
      if (!req.body.title) {
        return res.status(400).json({
          success: false,
          error:
            "TITLE_REQUIRED"
        });
      }

      const news =
        await createBreakingNews(
          req.body
        );

      return res.status(201).json({
        success: true,
        data: news
      });
    } catch (error) {
      console.error(error);

      return res.status(503).json({
        success: false,
        error:
          error.code ||
          "BREAKING_NEWS_ERROR"
      });
    }
  }
);

module.exports = router;
