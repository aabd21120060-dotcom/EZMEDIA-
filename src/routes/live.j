"use strict";

const express = require("express");

const {
  createLiveChannel,
  listLiveChannels,
  getLiveChannel
} = require("../services/mediaService");

const router = express.Router();

router.get(
  "/",
  async (req, res) => {
    try {
      const channels =
        await listLiveChannels();

      res.json({
        success: true,
        data: channels
      });
    } catch (error) {
      console.error(error);

      res.status(503).json({
        success: false,
        error:
          error.code ||
          "LIVE_DATABASE_ERROR",
        message:
          "تعذر قراءة قنوات البث"
      });
    }
  }
);

router.get(
  "/:id",
  async (req, res) => {
    try {
      const channel =
        await getLiveChannel(
          req.params.id
        );

      if (!channel) {
        return res.status(404).json({
          success: false,
          error:
            "LIVE_CHANNEL_NOT_FOUND"
        });
      }

      return res.json({
        success: true,
        data: channel
      });
    } catch (error) {
      console.error(error);

      return res.status(503).json({
        success: false,
        error:
          error.code ||
          "LIVE_DATABASE_ERROR"
      });
    }
  }
);

router.post(
  "/",
  async (req, res) => {
    try {
      if (
        !req.body.name ||
        !req.body.stream_url
      ) {
        return res.status(400).json({
          success: false,
          error:
            "INVALID_LIVE_CHANNEL",
          message:
            "name و stream_url مطلوبة"
        });
      }

      const channel =
        await createLiveChannel(
          req.body
        );

      return res.status(201).json({
        success: true,
        data: channel
      });
    } catch (error) {
      console.error(error);

      return res.status(503).json({
        success: false,
        error:
          error.code ||
          "LIVE_DATABASE_ERROR"
      });
    }
  }
);

module.exports = router;
