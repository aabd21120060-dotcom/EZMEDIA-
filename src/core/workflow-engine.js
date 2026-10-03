import { query } from "../config/database.js";

export async function enqueueJob({
  storyId = null,
  jobType,
  payload = {},
  priority = 50,
  scheduledAt = new Date(),
}) {
  const result = await query(
    `
    INSERT INTO workflow_jobs (
      story_id,
      job_type,
      priority,
      payload,
      scheduled_at
    )
    VALUES ($1, $2, $3, $4::jsonb, $5)
    RETURNING *
    `,
    [
      storyId,
      jobType,
      priority,
      JSON.stringify(payload),
      scheduledAt,
    ]
  );

  return result.rows[0];
}

export async function getNextJobs(limit = 10) {
  const result = await query(
    `
    SELECT *
    FROM workflow_jobs
    WHERE
      status = 'queued'
      AND scheduled_at <= NOW()
      AND attempts < max_attempts
    ORDER BY
      priority DESC,
      scheduled_at ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

export async function startJob(jobId) {
  const result = await query(
    `
    UPDATE workflow_jobs
    SET
      status = 'running',
      attempts = attempts + 1,
      started_at = NOW()
    WHERE id = $1
      AND status = 'queued'
    RETURNING *
    `,
    [jobId]
  );

  return result.rows[0] || null;
}

export async function completeJob(jobId) {
  const result = await query(
    `
    UPDATE workflow_jobs
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [jobId]
  );

  return result.rows[0] || null;
}

export async function failJob(jobId, error) {
  const result = await query(
    `
    UPDATE workflow_jobs
    SET
      status =
        CASE
          WHEN attempts >= max_attempts
          THEN 'failed'
          ELSE 'queued'
        END,
      error = $1
    WHERE id = $2
    RETURNING *
    `,
    [error, jobId]
  );

  return result.rows[0] || null;
}
