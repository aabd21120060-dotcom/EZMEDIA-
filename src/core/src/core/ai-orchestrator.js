import { query } from "../config/database.js";

const agents = {
  research: "EZ_RESEARCH_AGENT",
  classification: "EZ_CLASSIFICATION_AGENT",
  verification: "EZ_VERIFICATION_AGENT",
  editorial: "EZ_EDITORIAL_AGENT",
  seo: "EZ_SEO_AGENT",
  social: "EZ_SOCIAL_AGENT",
  monitoring: "EZ_MONITORING_AGENT",
};

export function getAgents() {
  return agents;
}

export async function createAIRun({
  storyId,
  agent,
  task,
  input = {},
}) {
  const result = await query(
    `
    INSERT INTO ai_runs (
      story_id,
      agent_name,
      task,
      model,
      status,
      input
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'queued',
      $5::jsonb
    )
    RETURNING *
    `,
    [
      storyId || null,
      agent,
      task,
      process.env.AI_MODEL || "configured-model",
      JSON.stringify(input),
    ]
  );

  return result.rows[0];
}

export async function completeAIRun(
  runId,
  {
    output = {},
    confidence = null,
    tokensInput = null,
    tokensOutput = null,
    durationMs = null,
  } = {}
) {
  const result = await query(
    `
    UPDATE ai_runs
    SET
      status = 'completed',
      output = $1::jsonb,
      confidence = $2,
      tokens_input = $3,
      tokens_output = $4,
      duration_ms = $5,
      completed_at = NOW()
    WHERE id = $6
    RETURNING *
    `,
    [
      JSON.stringify(output),
      confidence,
      tokensInput,
      tokensOutput,
      durationMs,
      runId,
    ]
  );

  return result.rows[0] || null;
}

export async function failAIRun(runId, error) {
  const result = await query(
    `
    UPDATE ai_runs
    SET
      status = 'failed',
      error = $1,
      completed_at = NOW()
    WHERE id = $2
    RETURNING *
    `,
    [error, runId]
  );

  return result.rows[0] || null;
}

export async function orchestrateStory(story) {
  const pipeline = [
    {
      agent: agents.research,
      task: "research_story",
    },
    {
      agent: agents.classification,
      task: "classify_story",
    },
    {
      agent: agents.verification,
      task: "verify_story",
    },
    {
      agent: agents.editorial,
      task: "prepare_editorial",
    },
    {
      agent: agents.seo,
      task: "prepare_seo",
    },
    {
      agent: agents.social,
      task: "prepare_social_distribution",
    },
  ];

  const runs = [];

  for (const step of pipeline) {
    const run = await createAIRun({
      storyId: story.id,
      agent: step.agent,
      task: step.task,
      input: {
        storyId: story.id,
        storyKey: story.story_key,
      },
    });

    runs.push(run);
  }

  return {
    storyId: story.id,
    status: "orchestrated",
    runs,
  };
}
