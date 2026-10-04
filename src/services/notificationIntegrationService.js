"use strict";

/**
 * EZ MEDIA 11.0
 * Notification Integration Service
 *
 * الكود رقم 52
 *
 * بوابة التكامل المركزية بين وحدات المنصة
 * ومحرك الإشعارات والأحداث.
 */

const notificationEventBridge =
  require("./notificationEventBridge");

const EVENT_TYPES =
  notificationEventBridge.EVENT_TYPES || {
    BREAKING_NEWS: "breaking_news",
    CONTENT_PUBLISHED: "content_published",
    LIVE_STARTED: "live_started",
    LIVE_STOPPED: "live_stopped",
    AI_ALERT: "ai_alert",
    SYSTEM_ALERT: "system_alert",
    COMMERCIAL_EVENT: "commercial_event",
    MEDIA_UPLOADED: "media_uploaded",
    CONTENT_REVIEW: "content_review",
    SECURITY_ALERT: "security_alert",
    CUSTOM: "custom"
  };

const state = {
  eventsReceived: 0,
  eventsProcessed: 0,
  eventsFailed: 0,
  notificationsRequested: 0,
  lastEventType: null,
  lastEventAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null
};

/* =========================================================
   Utilities
========================================================= */

function now() {
  return new Date().toISOString();
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return {
    ...payload
  };
}

function validateEventType(eventType) {
  if (!eventType) {
    const error =
      new Error("eventType is required");

    error.code =
      "NOTIFICATION_EVENT_TYPE_REQUIRED";

    throw error;
  }

  return String(eventType);
}

function updateSuccessState(eventType) {
  state.eventsReceived += 1;
  state.eventsProcessed += 1;
  state.notificationsRequested += 1;
  state.lastEventType = eventType;
  state.lastEventAt = now();
  state.lastSuccessAt = state.lastEventAt;
  state.lastError = null;
}

function updateErrorState(eventType, error) {
  state.eventsReceived += 1;
  state.eventsFailed += 1;
  state.lastEventType =
    eventType || null;
  state.lastEventAt = now();
  state.lastErrorAt =
    state.lastEventAt;
  state.lastError =
    error?.message ||
    String(error);
}

/* =========================================================
   Generic Event
========================================================= */

async function emit(
  eventType,
  payload = {},
  options = {}
) {
  const type =
    validateEventType(eventType);

  const normalizedPayload =
    normalizePayload(payload);

  try {
    const result =
      await notificationEventBridge.emit(
        type,
        normalizedPayload,
        options
      );

    updateSuccessState(type);

    return {
      success: true,
      eventType: type,
      result
    };
  } catch (error) {
    updateErrorState(
      type,
      error
    );

    throw error;
  }
}

/* =========================================================
   Breaking News
========================================================= */

async function breakingNews(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.BREAKING_NEWS,
    {
      ...data,

      source:
        data.source ||
        "breaking-command",

      severity:
        data.severity ||
        data.priority ||
        "high"
    },
    options
  );
}

/* =========================================================
   Published Content
========================================================= */

async function contentPublished(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.CONTENT_PUBLISHED,
    {
      ...data,

      contentId:
        data.contentId ||
        data.content_id ||
        data.id ||
        null,

      title:
        data.title ||
        data.headline ||
        "",

      source:
        data.source ||
        "cms"
    },
    options
  );
}

/* =========================================================
   Live
========================================================= */

async function liveStarted(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.LIVE_STARTED,
    {
      ...data,

      channelId:
        data.channelId ||
        data.channel_id ||
        data.id ||
        null,

      channelName:
        data.channelName ||
        data.channel_name ||
        "",

      source:
        data.source ||
        "live"
    },
    options
  );
}

async function liveStopped(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.LIVE_STOPPED,
    {
      ...data,

      channelId:
        data.channelId ||
        data.channel_id ||
        data.id ||
        null,

      channelName:
        data.channelName ||
        data.channel_name ||
        "",

      source:
        data.source ||
        "live"
    },
    options
  );
}

/* =========================================================
   AI
========================================================= */

async function aiAlert(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.AI_ALERT,
    {
      ...data,

      severity:
        data.severity ||
        data.riskLevel ||
        "medium",

      confidence:
        data.confidence ??
        null,

      source:
        data.source ||
        "ai"
    },
    options
  );
}

/* =========================================================
   System
========================================================= */

async function systemAlert(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.SYSTEM_ALERT,
    {
      ...data,

      severity:
        data.severity ||
        "high",

      source:
        data.source ||
        "system"
    },
    options
  );
}

/* =========================================================
   Commercial
========================================================= */

async function commercialEvent(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.COMMERCIAL_EVENT,
    {
      ...data,

      campaignId:
        data.campaignId ||
        data.campaign_id ||
        null,

      placementId:
        data.placementId ||
        data.placement_id ||
        null,

      source:
        data.source ||
        "commercial"
    },
    options
  );
}

/* =========================================================
   Media
========================================================= */

async function mediaUploaded(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.MEDIA_UPLOADED,
    {
      ...data,

      mediaId:
        data.mediaId ||
        data.media_id ||
        data.id ||
        null,

      fileName:
        data.fileName ||
        data.file_name ||
        "",

      source:
        data.source ||
        "media"
    },
    options
  );
}

/* =========================================================
   Content Review
========================================================= */

async function contentReview(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.CONTENT_REVIEW,
    {
      ...data,

      contentId:
        data.contentId ||
        data.content_id ||
        data.id ||
        null,

      reviewStatus:
        data.reviewStatus ||
        data.review_status ||
        data.status ||
        "review",

      source:
        data.source ||
        "editorial"
    },
    options
  );
}

/* =========================================================
   Security
========================================================= */

async function securityAlert(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.SECURITY_ALERT,
    {
      ...data,

      severity:
        data.severity ||
        "critical",

      source:
        data.source ||
        "security"
    },
    options
  );
}

/* =========================================================
   Custom
========================================================= */

async function customEvent(
  type,
  data = {},
  options = {}
) {
  return emit(
    type ||
      EVENT_TYPES.CUSTOM,
    data,
    options
  );
}

/* =========================================================
   Batch Events
========================================================= */

async function emitBatch(
  events = [],
  options = {}
) {
  if (!Array.isArray(events)) {
    const error =
      new Error(
        "events must be an array"
      );

    error.code =
      "NOTIFICATION_EVENT_BATCH_INVALID";

    throw error;
  }

  const results = [];

  for (
    const event of events
  ) {
    if (!event) {
      continue;
    }

    try {
      const result =
        await emit(
          event.eventType ||
            event.type,
          event.payload ||
            event.data ||
            {},
          {
            ...options,
            ...(event.options || {})
          }
        );

      results.push({
        success: true,
        result
      });
    } catch (error) {
      results.push({
        success: false,
        error:
          error.message
      });
    }
  }

  return {
    success: true,
    total:
      events.length,
    processed:
      results.filter(
        item =>
          item.success
      ).length,
    failed:
      results.filter(
        item =>
          !item.success
      ).length,
    results
  };
}

/* =========================================================
   Preview
========================================================= */

async function preview(
  eventType,
  payload = {}
) {
  const type =
    validateEventType(
      eventType
    );

  const normalizedPayload =
    normalizePayload(
      payload
    );

  if (
    typeof notificationEventBridge.preview ===
    "function"
  ) {
    return notificationEventBridge.preview(
      type,
      normalizedPayload
    );
  }

  return {
    success: true,
    preview: true,
    eventType: type,
    payload:
      normalizedPayload
  };
}

/* =========================================================
   Health
========================================================= */

function health() {
  let bridgeHealth = null;

  try {
    if (
      typeof notificationEventBridge.health ===
      "function"
    ) {
      bridgeHealth =
        notificationEventBridge.health();
    }
  } catch (error) {
    bridgeHealth = {
      healthy: false,
      error:
        error.message
    };
  }

  return {
    healthy:
      state.eventsFailed === 0 &&
      (
        bridgeHealth
          ? bridgeHealth.healthy !== false
          : true
      ),

    service:
      "notificationIntegrationService",

    eventBridge:
      bridgeHealth,

    state: {
      ...state
    },

    timestamp:
      now()
  };
}

/* =========================================================
   State
========================================================= */

function getState() {
  return {
    ...state
  };
}

function resetState() {
  state.eventsReceived = 0;
  state.eventsProcessed = 0;
  state.eventsFailed = 0;
  state.notificationsRequested = 0;
  state.lastEventType = null;
  state.lastEventAt = null;
  state.lastSuccessAt = null;
  state.lastErrorAt = null;
  state.lastError = null;

  return getState();
}

/* =========================================================
   Export
========================================================= */

module.exports = {
  EVENT_TYPES,

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

  emitBatch,

  preview,

  health,

  getState,

  resetState
};
