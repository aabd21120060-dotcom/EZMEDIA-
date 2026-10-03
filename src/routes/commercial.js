"use strict";

const express = require("express");

const {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  createPlacement,
  listPlacements,
  getActivePlacements,
  recordEvent,
  getStatistics
} = require("../services/commercialService");

const router = express.Router();


function sendError(
  res,
  error
) {

  const status =
    error.statusCode ||
    500;


  return res
    .status(status)
    .json({
      success: false,
      error:
        error.message ||
        "حدث خطأ غير متوقع"
    });

}


/* ============================================================
   STATISTICS
============================================================ */

router.get(
  "/statistics",
  async (
    req,
    res
  ) => {

    try {

      const statistics =
        await getStatistics();


      return res.json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        statistics
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


/* ============================================================
   ACTIVE PLACEMENTS
============================================================ */

router.get(
  "/placements/active",
  async (
    req,
    res
  ) => {

    try {

      const placementKey =
        req.query.placement;


      if (!placementKey) {

        return res.status(400).json({
          success: false,
          error:
            "placement مطلوب"
        });

      }


      const items =
        await getActivePlacements(
          placementKey
        );


      return res.json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        items
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


/* ============================================================
   EVENT
============================================================ */

router.post(
  "/events",
  async (
    req,
    res
  ) => {

    try {

      const event =
        await recordEvent({
          campaignId:
            req.body.campaignId,

          placementId:
            req.body.placementId,

          eventType:
            req.body.eventType,

          visitorId:
            req.body.visitorId,

          sessionId:
            req.body.sessionId,

          contentId:
            req.body.contentId,

          metadata:
            req.body.metadata
        });


      return res.status(201).json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        event
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


/* ============================================================
   CAMPAIGNS
============================================================ */

router.get(
  "/campaigns",
  async (
    req,
    res
  ) => {

    try {

      const result =
        await listCampaigns({
          page:
            req.query.page,

          limit:
            req.query.limit,

          status:
            req.query.status,

          campaignType:
            req.query.campaignType,

          search:
            req.query.search
        });


      return res.json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        ...result
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


router.post(
  "/campaigns",
  async (
    req,
    res
  ) => {

    try {

      const campaign =
        await createCampaign(
          req.body
        );


      return res.status(201).json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        campaign
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


router.get(
  "/campaigns/:id",
  async (
    req,
    res
  ) => {

    try {

      const campaign =
        await getCampaign(
          req.params.id
        );


      return res.json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        campaign
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


router.patch(
  "/campaigns/:id",
  async (
    req,
    res
  ) => {

    try {

      const campaign =
        await updateCampaign(
          req.params.id,
          req.body
        );


      return res.json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        campaign
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


router.delete(
  "/campaigns/:id",
  async (
    req,
    res
  ) => {

    try {

      const result =
        await deleteCampaign(
          req.params.id
        );


      return res.json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        ...result
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


/* ============================================================
   PLACEMENTS
============================================================ */

router.get(
  "/campaigns/:id/placements",
  async (
    req,
    res
  ) => {

    try {

      const items =
        await listPlacements(
          req.params.id
        );


      return res.json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        items
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


router.post(
  "/campaigns/:id/placements",
  async (
    req,
    res
  ) => {

    try {

      const placement =
        await createPlacement({
          ...req.body,
          campaignId:
            req.params.id
        });


      return res.status(201).json({
        success: true,
        platform: "EZ MEDIA",
        version: "11.0.0",
        placement
      });

    } catch (error) {

      return sendError(
        res,
        error
      );

    }

  }
);


module.exports = router;
