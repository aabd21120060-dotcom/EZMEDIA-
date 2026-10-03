const { query } = require("../database/db");

const AI_PROVIDER = process.env.AI_PROVIDER || "openai";
const AI_MODEL = process.env.AI_MODEL || "gpt-5";

function cleanText(value, max = 20000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function buildPrompt(content) {
  return `
أنت محرك الذكاء الاصطناعي لمنصة EZ MEDIA.

حلل المادة الإعلامية التالية دون اختلاق معلومات.

العنوان:
${cleanText(content.title, 1000)}

الملخص:
${cleanText(content.summary, 5000)}

النص:
${cleanText(content.body, 20000)}

أعد النتيجة بصيغة JSON فقط:

{
  "headline": "",
  "summary": "",
  "category": "",
  "keywords": [],
  "social_posts": {
    "x": "",
    "instagram": "",
    "facebook": "",
    "linkedin": "",
    "tiktok": ""
  },
  "video_description": "",
  "editor_notes": [],
  "risk_flags": [],
  "confidence": 0
}

القواعد:
- لا تخترع أسماء أو أرقامًا أو أحداثًا.
- لا تضف معلومات غير موجودة في المادة.
- إذا كانت معلومة غير مؤكدة فاذكر ذلك.
- لا تعتبر التحليل موافقة على النشر.
- confidence رقم بين 0 و1.
`;
}

async function callAI(prompt) {
  if (!process.env.AI_API_KEY) {
    const error = new Error("AI_API_KEY is not configured");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  if (AI_PROVIDER === "openai") {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: AI_MODEL,
          input: prompt
        })
      }
    );

    if (!response.ok) {
      const body = await response.text();

      const error = new Error(
        `AI provider returned ${response.status}: ${body}`
      );

      error.code = "AI_PROVIDER_ERROR";

      throw error;
    }

    const data = await response.json();

    const text =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        ?.map(item => item.text || "")
        ?.join("") ||
      "";

    if (!text) {
      throw new Error("AI provider returned an empty response");
    }

    return text;
  }

  throw new Error(
    `Unsupported AI_PROVIDER: ${AI_PROVIDER}`
  );
}

function parseJSON(text) {
  const cleaned = String(text)
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("AI returned invalid JSON");
    }

    return JSON.parse(
      cleaned.slice(start, end + 1)
    );
  }
}

async function analyzeContent(contentId, actorId = null) {
  const result = await query(
    `
    SELECT *
    FROM cms_content
    WHERE id = $1
    `,
    [contentId]
  );

  if (!result.rows.length) {
    const error = new Error("المحتوى غير موجود");
    error.code = "CONTENT_NOT_FOUND";
    throw error;
  }

  const content = result.rows[0];

  const prompt = buildPrompt(content);

  const rawResponse = await callAI(prompt);

  const analysis = parseJSON(rawResponse);

  const job = await query(
    `
    INSERT INTO ai_jobs (
      content_id,
      provider,
      model,
      job_type,
      status,
      input,
      output,
      created_by
    )
    VALUES (
      $1,
      $2,
      $3,
      'content_analysis',
      'completed',
      $4,
      $5,
      $6
    )
    RETURNING *
    `,
    [
      contentId,
      AI_PROVIDER,
      AI_MODEL,
      JSON.stringify({
        title: content.title,
        summary: content.summary
      }),
      JSON.stringify(analysis),
      actorId
    ]
  );

  return {
    job: job.rows[0],
    analysis
  };
}

async function getLatestAnalysis(contentId) {
  const result = await query(
    `
    SELECT *
    FROM ai_jobs
    WHERE content_id = $1
      AND job_type = 'content_analysis'
      AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [contentId]
  );

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0];
}

module.exports = {
  analyzeContent,
  getLatestAnalysis
};
