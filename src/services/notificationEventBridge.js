"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Event Bridge
 *
 * الكود رقم 49
 *
 * جسر موحد بين أحداث المنصة ومحرك الإشعارات.
 */

const notificationRulesService =
  require("./notificationRulesService");

/* =========================================================
   Event Types
========================================================= */

const EVENT_TYPES = Object.freeze({
  BREAKING_NEWS:
    "breaking_news",

  CONTENT_PUBLISHED:
    "content_published",

  LIVE_STARTED:
    "live_started",

  LIVE_STOPPED:
    "live_stopped",

  AI_ALERT:
    "ai_alert",

  SYSTEM_ALERT:
    "system_alert",

  COMMERCIAL_EVENT:
    "commercial_event",

  MEDIA_UPLOADED:
    "media_uploaded",

  CONTENT_REVIEW:
    "content_review",

  SECURITY_ALERT:
    "security_alert",

  CUSTOM:
    "custom"
});

/* =========================================================
   State
========================================================= */

const state = {
  startedAt:
    new Date().toISOString(),

  eventsReceived: 0,

  eventsProcessed: 0,

  notificationsCreated: 0,

  duplicatesIgnored: 0,

  failed: 0,

  lastEventAt: null,

  lastSuccessAt: null,

  lastErrorAt: null,

  lastError: null
};

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

function normalizeObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}

function createEvent(
  type,
  data = {}
) {
  const payload =
    normalizeObject(data);

  return {
    eventType:
      normalizeString(type),

    eventId:
      payload.eventId ||
      payload.id ||
      null,

    source:
      payload.source ||
      "EZ MEDIA",

    title:
      payload.title ||
      payload.headline ||
      "",

    headline:
      payload.headline ||
      payload.title ||
      "",

    summary:
      payload.summary ||
      "",

    body:
      payload.body ||
      "",

    priority:
      payload.priority ||
      payload.severity ||
      "normal",

    severity:
      payload.severity ||
      payload.priority ||
      "normal",

    channels:
      payload.channels ||
      [],

    contentId:
      payload.contentId ||
      payload.content_id ||
      null,

    notificationType:
      payload.notificationType ||
      type,

    templateId:
      payload.templateId ||
      null,

    audience:
      payload.audience ||
      {},

    payload,

    timestamp:
      payload.timestamp ||
      new Date().toISOString()
  };
}

/* =========================================================
   Process Event
========================================================= */

async function emit(
  type,
  data = {}
) {
  const event =
    createEvent(
      type,
      data
    );

  state.eventsReceived += 1;

  state.lastEventAt =
    new Date().toISOString();

  try {
    const result =
      await notificationRulesService
        .processNotificationEvent(
          event
        );

    state.eventsProcessed += 1;

    state.notificationsCreated +=
      Number(
        result.notificationsCreated ||
        0
      );

    state.duplicatesIgnored +=
      Number(
        result.duplicatesIgnored ||
        0
      );

    state.lastSuccessAt =
      new Date().toISOString();

    return {
      success: true,

      event,

      result
    };
  } catch (error) {
    state.failed += 1;

    state.lastErrorAt =
      new Date().toISOString();

    state.lastError =
      error.message;

    console.error(
      "EZ MEDIA notification event error:",
      error
    );

    return {
      success: false,

      event,

      error:
        error.message
    };
  }
}

/* =========================================================
   Breaking News
========================================================= */

async function breakingNews(
  data = {}
) {
  return emit(
    EVENT_TYPES.BREAKING_NEWS,
    {
      ...data,

      priority:
        data.priority ||
        "urgent",

      notificationType:
        "breaking_news"
    }
  );
}

/* =========================================================
   Content Published
========================================================= */

async function contentPublished(
  data = {}
) {
  return emit(
    EVENT_TYPES.CONTENT_PUBLISHED,
    {
      ...data,

      notificationType:
        "new_content"
    }
  );
}

/* =========================================================
   Live Started
========================================================= */

async function liveStarted(
  data = {}
) {
  return emit(
    EVENT_TYPES.LIVE_STARTED,
    {
      ...data,

      notificationType:
        "live_started"
    }
  );
}

/* =========================================================
   Live Stopped
========================================================= */

async function liveStopped(
  data = {}
) {
  return emit(
    EVENT_TYPES.LIVE_STOPPED,
    {
      ...data,

      notificationType:
        "live_stopped"
    }
  );
}

/* =========================================================
   AI Alert
========================================================= */

async function aiAlert(
  data = {}
) {
  return emit(
    EVENT_TYPES.AI_ALERT,
    {
      ...data,

      notificationType:
        "ai_alert"
    }
  );
}

/* =========================================================
   System Alert
========================================================= */

async function systemAlert(
  data = {}
) {
  return emit(
    EVENT_TYPES.SYSTEM_ALERT,
    {
      ...data,

      notificationType:
        "system_alert"
    }
  );
}

/* =========================================================
   Commercial Event
========================================================= */

async function commercialEvent(
  data = {}
) {
  return emit(
    EVENT_TYPES.COMMERCIAL_EVENT,
    {
      ...data,

      notificationType:
        "commercial_event"
    }
  );
}

/* =========================================================
   Media Uploaded
========================================================= */

async function mediaUploaded(
  data = {}
) {
  return emit(
    EVENT_TYPES.MEDIA_UPLOADED,
    {
      ...data,

      notificationType:
        "media_uploaded"
    }
  );
}

/* =========================================================
   Content Review
========================================================= */

async function contentReview(
  data = {}
) {
  return emit(
    EVENT_TYPES.CONTENT_REVIEW,
    {
      ...data,

      notificationType:
        "content_review"
    }
  );
}

/* =========================================================
   Security Alert
========================================================= */

async function securityAlert(
  data = {}
) {
  return emit(
    EVENT_TYPES.SECURITY_ALERT,
    {
      ...data,

      priority:
        data.priority ||
        "critical",

      notificationType:
        "security_alert"
    }
  );
}

/* =========================================================
   Custom Event
========================================================= */

async function customEvent(
  type,
  data = {}
) {
  const eventType =
    normalizeString(type);

  if (!eventType) {
    throw new Error(
      "Custom notification event type is required"
    );
  }

  return emit(
    eventType,
    {
      ...data,

      notificationType:
        data.notificationType ||
        eventType
    }
  );
}

/* =========================================================
   Preview
========================================================= */

async function preview(
  type,
  data = {}
) {
  const event =
    createEvent(
      type,
      data
    );

  return notificationRulesService
    .previewEvent(
      event
    );
}

/* =========================================================
   Statistics
========================================================= */

function getState() {
  return {
    ...state
  };
}

function resetState() {
  state.eventsReceived = 0;

  state.eventsProcessed = 0;

  state.notificationsCreated = 0;

  state.duplicatesIgnored = 0;

  state.failed = 0;

  state.lastEventAt = null;

  state.lastSuccessAt = null;

  state.lastErrorAt = null;

  state.lastError = null;

  return getState();
}

/* =========================================================
   Health
========================================================= */

async function health() {
  const rulesHealth =
    await notificationRulesService
      .health();

  return {
    healthy:
      rulesHealth.healthy,

    service:
      "notificationEventBridge",

    rulesEngine:
      rulesHealth,

    state:
      getState(),

    timestamp:
      new Date().toISOString()
  };
}

/* =========================================================
   Exports
========================================================= */

module.exports = {
  EVENT_TYPES,

  createEvent,

  emit,

  breakingNews,

  contentPublished,

  liveStarted,

  liveStopped,

  aiAlert,

  systemAlert,

  commercialEvent,

  mediaUploaded,

  contentReview,

  securityAlert,

  customEvent,

  preview,

  getState,

  resetState,

  health
};
