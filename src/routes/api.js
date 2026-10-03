import express from "express";
import crypto from "node:crypto";

const router = express.Router();

const stories = new Map();
const jobs = [];

function id() {
  return crypto.randomUUID();
}

router.get("/", (req, res) => {
  res.json({
    success: true,
    platform: "EZ MEDIA",
    version: "11.0.0",
    api: "online"
  });
});

router.get("/status", (req, res) => {
  res.json({
    success: true,
    platform: "EZ MEDIA",
    version: "11.0.0",
    status: "online",
    modules: {
      api: true,
      cms: true,
      storyObject: true,
      aiOrchestrator: true,
      workflowEngine: true,
      audit: true,
      worldRadar: false
    },
    timestamp: new Date().toISOString()
  });
});

router.post("/stories", (req, res) => {
  try {
    const story = {
      id: id(),
      storyKey: `EZ-${Date.now()}`,

      title: req.body?.title || null,
      subtitle: req.body?.subtitle || null,
      summary: req.body?.summary || null,
      body: req.body?.body || null,

      contentType:
        req.body?.contentType || "news",

      language:
        req.body?.language || "ar",

      status: "draft",

      primaryCategory: null,
      secondaryCategories: [],
      topics: [],

      country: null,
      region: null,
      city: null,
      district: null,
      place: null,

      confidenceScore: 0,
      importanceScore: 0,

      breakingCandidate: false,

      ai: {
        status: "queued",
        agents: []
      },

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    stories.set(story.id, story);

    res.status(201).json({
      success: true,
      story
    });
  } catch (error) {
    console.error(
      "[EZ MEDIA] Story creation error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/stories", (req, res) => {
  res.json({
    success: true,
    count: stories.size,
    stories: Array.from(stories.values())
  });
});

router.get("/stories/:id", (req, res) => {
  const story = stories.get(req.params.id);

  if (!story) {
    return res.status(404).json({
      success: false,
      error: "Story not found"
    });
  }

  res.json({
    success: true,
    story
  });
});

router.patch("/stories/:id", (req, res) => {
  const story = stories.get(req.params.id);

  if (!story) {
    return res.status(404).json({
      success: false,
      error: "Story not found"
    });
  }

  const allowedFields = [
    "title",
    "subtitle",
    "summary",
    "body",
    "contentType",
    "primaryCategory",
    "secondaryCategories",
    "topics",
    "country",
    "region",
    "city",
    "district",
    "place",
    "confidenceScore",
    "importanceScore",
    "breakingCandidate",
    "status"
  ];

  for (const field of allowedFields) {
    if (req.body?.[field] !== undefined) {
      story[field] = req.body[field];
    }
  }

  story.updatedAt =
    new Date().toISOString();

  stories.set(story.id, story);

  res.json({
    success: true,
    story
  });
});

router.post(
  "/stories/:id/orchestrate",
  (req, res) => {
    const story = stories.get(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: "Story not found"
      });
    }

    const agents = [
      "EZ_RESEARCH_AGENT",
      "EZ_CLASSIFICATION_AGENT",
      "EZ_VERIFICATION_AGENT",
      "EZ_EDITORIAL_AGENT",
      "EZ_SEO_AGENT",
      "EZ_SOCIAL_AGENT"
    ];

    const runs = agents.map((agent) => ({
      id: id(),
      agent,
      status: "queued",
      createdAt: new Date().toISOString()
    }));

    story.ai = {
      status: "queued",
      agents: runs
    };

    story.status = "researching";
    story.updatedAt =
      new Date().toISOString();

    stories.set(story.id, story);

    res.json({
      success: true,
      storyId: story.id,
      orchestration: {
        status: "queued",
        runs
      }
    });
  }
);

router.get("/ai/agents", (req, res) => {
  res.json({
    success: true,
    agents: [
      {
        id: "EZ_RESEARCH_AGENT",
        name: "البحث",
        status: "ready"
      },
      {
        id: "EZ_CLASSIFICATION_AGENT",
        name: "التصنيف",
        status: "ready"
      },
      {
        id: "EZ_VERIFICATION_AGENT",
        name: "التحقق",
        status: "ready"
      },
      {
        id: "EZ_EDITORIAL_AGENT",
        name: "التحرير",
        status: "ready"
      },
      {
        id: "EZ_SEO_AGENT",
        name: "SEO",
        status: "ready"
      },
      {
        id: "EZ_SOCIAL_AGENT",
        name: "التوزيع الاجتماعي",
        status: "ready"
      }
    ]
  });
});

router.post("/workflow/jobs", (req, res) => {
  const job = {
    id: id(),

    jobType:
      req.body?.jobType ||
      "content.process",

    priority:
      Number(req.body?.priority || 50),

    status: "queued",

    payload:
      req.body?.payload || {},

    createdAt:
      new Date().toISOString()
  };

  jobs.push(job);

  res.status(201).json({
    success: true,
    job
  });
});

router.get("/workflow/queue", (req, res) => {
  res.json({
    success: true,
    count: jobs.length,
    jobs
  });
});

export default router;
