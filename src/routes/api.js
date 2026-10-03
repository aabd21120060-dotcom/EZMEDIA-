import express from "express";

import {
  createStory,
  getStory,
  updateStory,
} from "../core/story-object.js";

import {
  orchestrateStory,
  getAgents,
} from "../core/ai-orchestrator.js";

import {
  enqueueJob,
  getNextJobs,
} from "../core/workflow-engine.js";

const router = express.Router();

router.post("/stories", async (req, res) => {
  try {
    const story = await createStory({
      ...req.body,
      createdBy: req.user?.id || "api",
    });

    res.status(201).json({
      success: true,
      story,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/stories/:id", async (req, res) => {
  try {
    const story = await getStory(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: "Story not found",
      });
    }

    res.json({
      success: true,
      story,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.patch("/stories/:id", async (req, res) => {
  try {
    const story = await updateStory(
      req.params.id,
      req.body
    );

    res.json({
      success: true,
      story,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/stories/:id/orchestrate", async (req, res) => {
  try {
    const story = await getStory(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: "Story not found",
      });
    }

    const result = await orchestrateStory(story);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/workflow/jobs", async (req, res) => {
  try {
    const job = await enqueueJob(req.body);

    res.status(201).json({
      success: true,
      job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/workflow/queue", async (req, res) => {
  try {
    const jobs = await getNextJobs(
      Number(req.query.limit || 10)
    );

    res.json({
      success: true,
      jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/ai/agents", (req, res) => {
  res.json({
    success: true,
    agents: getAgents(),
  });
});

export default router;
