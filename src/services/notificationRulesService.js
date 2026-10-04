"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Rules Service
 *
 * الكود رقم 47
 *
 * محرك قواعد الإشعارات الذكي.
 *
 * الوظائف:
 * - قراءة قواعد الإشعارات من PostgreSQL
 * - مطابقة الأحداث مع القواعد
 * - تقييم الشروط
 * - تحديد الأولوية
 * - تحديد القنوات
 * - منع التكرار
 * - إنشاء الإشعارات
 * - تسجيل الأحداث
 *
 * يعتمد على:
 * - notificationService
 * - notificationDatabase
 */

const {
  query
} = require("../database/db");

const notificationService =
  require("./notificationService");

/* =========================================================
   Constants
========================================================= */

const DEFAULT_LIMIT = 100;

const VALID_PRIORITIES = new Set([
  "low",
  "normal",
  "high",
  "urgent",
  "critical"
]);

const VALID_CHANNELS = new Set([
  "inApp",
  "dashboard",
  "push",
  "email",
  "sms",
  "social"
]);

/* =========================================================
   Helpers
========================================================= */

function normalizeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function normalizeArray(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed =
        JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed
        : [value];
    } catch {
      return value
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean);
    }
  }

  return [value];
}

function normalizeObject(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return {};
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed =
        JSON.parse(value);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function normalizePriority(
  priority,
  fallback = "normal"
) {
  const value =
    normalizeString(priority)
      .toLowerCase();

  return VALID_PRIORITIES.has(value)
    ? value
    : fallback;
}

function normalizeChannels(
  channels
) {
  return normalizeArray(channels)
    .map((channel) =>
      normalizeString(channel)
    )
    .filter((channel) =>
      VALID_CHANNELS.has(channel)
    );
}

function getNestedValue(
  object,
  path
) {
  if (
    !object ||
    !path
  ) {
    return undefined;
  }

  const parts =
    String(path)
      .split(".")
      .filter(Boolean);

  let current = object;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined
    ) {
      return undefined;
    }

    current =
      current[part];
  }

  return current;
}

function valuesEqual(
  actual,
  expected
) {
  if (
    typeof actual === "string" &&
    typeof expected === "string"
  ) {
    return (
      actual.toLowerCase() ===
      expected.toLowerCase()
    );
  }

  return actual === expected;
}

function containsValue(
  actual,
  expected
) {
  if (
    Array.isArray(actual)
  ) {
    return actual.some(
      (item) =>
        valuesEqual(
          item,
          expected
        )
    );
  }

  if (
    typeof actual === "string"
  ) {
    return actual
      .toLowerCase()
      .includes(
        normalizeString(
          expected
        ).toLowerCase()
      );
  }

  return false;
}

/* =========================================================
   Condition Evaluation
========================================================= */

function evaluateCondition(
  condition,
  event
) {
  if (!condition) {
    return true;
  }

  const operator =
    normalizeString(
      condition.operator ||
      "equals"
    ).toLowerCase();

  const field =
    condition.field;

  const actual =
    getNestedValue(
      event,
      field
    );

  const expected =
    condition.value;

  switch (operator) {
    case "equals":
    case "eq":
      return valuesEqual(
        actual,
        expected
      );

    case "not_equals":
    case "neq":
      return !valuesEqual(
        actual,
        expected
      );

    case "contains":
      return containsValue(
        actual,
        expected
      );

    case "not_contains":
      return !containsValue(
        actual,
        expected
      );

    case "exists":
      return (
        actual !== undefined &&
        actual !== null
      );

    case "not_exists":
      return (
        actual === undefined ||
        actual === null
      );

    case "gt":
    case "greater_than":
      return (
        Number(actual) >
        Number(expected)
      );

    case "gte":
    case "greater_than_or_equal":
      return (
        Number(actual) >=
        Number(expected)
      );

    case "lt":
    case "less_than":
      return (
        Number(actual) <
        Number(expected)
      );

    case "lte":
    case "less_than_or_equal":
      return (
        Number(actual) <=
        Number(expected)
      );

    case "in":
      return normalizeArray(
        expected
      ).some(
        (item) =>
          valuesEqual(
            actual,
            item
          )
      );

    case "not_in":
      return !normalizeArray(
        expected
      ).some(
        (item) =>
          valuesEqual(
            actual,
            item
          )
      );

    default:
      return false;
  }
}

function evaluateConditions(
  conditions,
  event
) {
  const list =
    Array.isArray(conditions)
      ? conditions
      : [];

  if (list.length === 0) {
    return true;
  }

  return list.every(
    (condition) =>
      evaluateCondition(
        condition,
        event
      )
  );
}

/* =========================================================
   Database Rules
========================================================= */

async function listActiveRules(
  eventType = null
) {
  let sql = `
    SELECT
      id,
      name,
      description,
      event_type,
      enabled,
      priority,
      channels,
      conditions,
      template_id,
      audience,
      dedupe_window_seconds,
      created_at,
      updated_at
    FROM notification_rules
    WHERE enabled = TRUE
  `;

  const params = [];

  if (eventType) {
    params.push(eventType);

    sql += `
      AND (
        event_type = $1
        OR event_type = '*'
      )
    `;
  }

  sql += `
    ORDER BY
      CASE priority
        WHEN 'critical' THEN 5
        WHEN 'urgent' THEN 4
        WHEN 'high' THEN 3
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
      END DESC,
      id ASC
  `;

  const result =
    await query(
      sql,
      params
    );

  return result.rows;
}

async function getRuleById(
  ruleId
) {
  const result =
    await query(
      `
        SELECT
          *
        FROM notification_rules
        WHERE id = $1
        LIMIT 1
      `,
      [ruleId]
    );

  return (
    result.rows[0] ||
    null
  );
}

/* =========================================================
   Rule Normalization
========================================================= */

function normalizeRule(
  rule
) {
  if (!rule) {
    return null;
  }

  return {
    ...rule,

    priority:
      normalizePriority(
        rule.priority
      ),

    channels:
      normalizeChannels(
        rule.channels
      ),

    conditions:
      normalizeArray(
        rule.conditions
      ),

    audience:
      normalizeObject(
        rule.audience
      ),

    dedupeWindowSeconds:
      Number(
        rule.dedupe_window_seconds ||
        0
      )
  };
}

/* =========================================================
   Event Matching
========================================================= */

function matchesRule(
  rule,
  event
) {
  if (!rule) {
    return false;
  }

  const eventType =
    normalizeString(
      event.eventType ||
      event.type
    );

  const ruleEventType =
    normalizeString(
      rule.event_type
    );

  if (
    ruleEventType &&
    ruleEventType !== "*" &&
    ruleEventType !== eventType
  ) {
    return false;
  }

  const normalized =
    normalizeRule(rule);

  return evaluateConditions(
    normalized.conditions,
    event
  );
}

/* =========================================================
   Priority Intelligence
========================================================= */

function calculatePriority(
  rule,
  event
) {
  let priority =
    normalizePriority(
      rule.priority
    );

  const severity =
    normalizeString(
      event.severity ||
      event.priority
    ).toLowerCase();

  const severityMap = {
    critical: 5,
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1
  };

  const current =
    severityMap[priority] ||
    2;

  const incoming =
    severityMap[severity] ||
    current;

  const finalLevel =
    Math.max(
      current,
      incoming
    );

  if (finalLevel >= 5) {
    return "critical";
  }

  if (finalLevel === 4) {
    return "urgent";
  }

  if (finalLevel === 3) {
    return "high";
  }

  if (finalLevel === 1) {
    return "low";
  }

  return "normal";
}

/* =========================================================
   Channel Intelligence
========================================================= */

function calculateChannels(
  rule,
  event
) {
  const ruleChannels =
    normalizeChannels(
      rule.channels
    );

  const eventChannels =
    normalizeChannels(
      event.channels
    );

  const channels =
    eventChannels.length > 0
      ? eventChannels
      : ruleChannels;

  if (channels.length > 0) {
    return [
      ...new Set(channels)
    ];
  }

  return [
    "inApp",
    "dashboard"
  ];
}

/* =========================================================
   Template Variables
========================================================= */

function buildTemplateVariables(
  event,
  rule
) {
  const payload =
    normalizeObject(
      event.payload
    );

  return {
    ...payload,

    eventType:
      event.eventType ||
      event.type ||
      "",

    ruleName:
      rule.name ||
      "",

    priority:
      calculatePriority(
        rule,
        event
      ),

    timestamp:
      event.timestamp ||
      new Date().toISOString(),

    source:
      event.source ||
      "EZ MEDIA",

    title:
      event.title ||
      payload.title ||
      payload.headline ||
      "",

    headline:
      event.headline ||
      payload.headline ||
      "",

    summary:
      event.summary ||
      payload.summary ||
      "",

    contentId:
      event.contentId ||
      payload.contentId ||
      payload.content_id ||
      null
  };
}

/* =========================================================
   Dedupe
========================================================= */

function buildRuleDedupeKey(
  rule,
  event
) {
  const eventId =
    event.eventId ||
    event.id ||
    event.contentId ||
    "";

  const eventType =
    event.eventType ||
    event.type ||
    "event";

  return [
    "rule",
    rule.id,
    eventType,
    eventId
  ]
    .filter(Boolean)
    .join(":");
}

async function checkDuplicate(
  dedupeKey,
  windowSeconds
) {
  if (
    !dedupeKey ||
    !windowSeconds ||
    windowSeconds <= 0
  ) {
    return false;
  }

  const result =
    await query(
      `
        SELECT id
        FROM notifications
        WHERE dedupe_key = $1
          AND created_at >= NOW() -
            ($2::text || ' seconds')::interval
        LIMIT 1
      `,
      [
        dedupeKey,
        String(windowSeconds)
      ]
    );

  return (
    result.rows.length > 0
  );
}

/* =========================================================
   Notification Creation
========================================================= */

async function createNotificationFromRule(
  rule,
  event
) {
  const normalizedRule =
    normalizeRule(rule);

  const dedupeKey =
    buildRuleDedupeKey(
      normalizedRule,
      event
    );

  const duplicate =
    await checkDuplicate(
      dedupeKey,
      normalizedRule
        .dedupeWindowSeconds
    );

  if (duplicate) {
    return {
      created: false,
      duplicate: true,
      ruleId:
        normalizedRule.id,
      dedupeKey
    };
  }

  const priority =
    calculatePriority(
      normalizedRule,
      event
    );

  const channels =
    calculateChannels(
      normalizedRule,
      event
    );

  const variables =
    buildTemplateVariables(
      event,
      normalizedRule
    );

  const payload =
    normalizeObject(
      event.payload
    );

  const notification =
    await notificationService
      .createNotification({
        type:
          event.notificationType ||
          event.type ||
          normalizedRule.event_type ||
          "system_alert",

        title:
          event.title ||
          event.headline ||
          payload.title ||
          payload.headline ||
          normalizedRule.name,

        body:
          event.body ||
          event.summary ||
          payload.summary ||
          payload.body ||
          normalizedRule.description ||
          "",

        priority,

        channels,

        templateId:
          event.templateId ||
          normalizedRule.template_id ||
          null,

        audience:
          event.audience ||
          normalizedRule.audience ||
          {},

        data: {
          ...payload,

          eventType:
            event.eventType ||
            event.type ||
            normalizedRule.event_type,

          ruleId:
            normalizedRule.id,

          ruleName:
            normalizedRule.name,

          source:
            event.source ||
            "EZ MEDIA",

          variables
        },

        dedupeKey
      });

  try {
    await notificationService
      .recordNotificationEvent({
        notificationId:
          notification.id,

        eventType:
          "rule_matched",

        data: {
          ruleId:
            normalizedRule.id,

          ruleName:
            normalizedRule.name,

          eventType:
            event.eventType ||
            event.type,

          priority,

          channels
        }
      });
  } catch (error) {
    console.warn(
      "EZ MEDIA notification rule event log failed:",
      error.message
    );
  }

  return {
    created: true,
    duplicate: false,
    ruleId:
      normalizedRule.id,
    notification
  };
}

/* =========================================================
   Process Event
========================================================= */

async function processNotificationEvent(
  event
) {
  if (
    !event ||
    typeof event !== "object"
  ) {
    throw new Error(
      "Notification event must be an object"
    );
  }

  const eventType =
    normalizeString(
      event.eventType ||
      event.type
    );

  if (!eventType) {
    throw new Error(
      "Notification event type is required"
    );
  }

  const rules =
    await listActiveRules(
      eventType
    );

  const matched = [];
  const created = [];
  const duplicates = [];

  for (const rawRule of rules) {
    const rule =
      normalizeRule(
        rawRule
      );

    if (
      !matchesRule(
        rule,
        event
      )
    ) {
      continue;
    }

    matched.push(
      rule.id
    );

    const result =
      await createNotificationFromRule(
        rule,
        event
      );

    if (result.duplicate) {
      duplicates.push(result);
    } else if (result.created) {
      created.push(result);
    }
  }

  return {
    success: true,

    eventType,

    rulesChecked:
      rules.length,

    rulesMatched:
      matched.length,

    matchedRuleIds:
      matched,

    notificationsCreated:
      created.length,

    notifications:
      created.map(
        (item) =>
          item.notification
      ),

    duplicatesIgnored:
      duplicates.length
  };
}

/* =========================================================
   Rule Preview
========================================================= */

async function previewEvent(
  event
) {
  const eventType =
    normalizeString(
      event.eventType ||
      event.type
    );

  if (!eventType) {
    throw new Error(
      "Notification event type is required"
    );
  }

  const rules =
    await listActiveRules(
      eventType
    );

  return {
    success: true,

    eventType,

    rules: rules.map(
      (rawRule) => {
        const rule =
          normalizeRule(
            rawRule
          );

        return {
          id:
            rule.id,

          name:
            rule.name,

          eventType:
            rule.event_type,

          matched:
            matchesRule(
              rule,
              event
            ),

          priority:
            calculatePriority(
              rule,
              event
            ),

          channels:
            calculateChannels(
              rule,
              event
            )
        };
      }
    )
  };
}

/* =========================================================
   Statistics
========================================================= */

async function getRulesStatistics() {
  const result =
    await query(`
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (
          WHERE enabled = TRUE
        )::integer AS active,
        COUNT(*) FILTER (
          WHERE enabled = FALSE
        )::integer AS disabled,
        COUNT(DISTINCT event_type)::integer
          AS event_types
      FROM notification_rules
    `);

  return (
    result.rows[0] || {
      total: 0,
      active: 0,
      disabled: 0,
      event_types: 0
    }
  );
}

/* =========================================================
   Health
========================================================= */

async function health() {
  try {
    const statistics =
      await getRulesStatistics();

    return {
      healthy: true,

      databaseConfigured:
        Boolean(
          process.env
            .DATABASE_URL
        ),

      statistics
    };
  } catch (error) {
    return {
      healthy: false,

      databaseConfigured:
        Boolean(
          process.env
            .DATABASE_URL
        ),

      error:
        error.message
    };
  }
}

/* =========================================================
   Exports
========================================================= */

module.exports = {
  listActiveRules,
  getRuleById,
  normalizeRule,
  matchesRule,
  evaluateCondition,
  evaluateConditions,
  calculatePriority,
  calculateChannels,
  buildTemplateVariables,
  buildRuleDedupeKey,
  checkDuplicate,
  createNotificationFromRule,
  processNotificationEvent,
  previewEvent,
  getRulesStatistics,
  health
};
