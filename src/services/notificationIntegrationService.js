"use strict";

/**
 * EZ MEDIA 11.0
 * القسم 53
 * منظومة الإشعارات الذكية المتكاملة
 *
 * طبقة التكامل المركزية لجميع أحداث المنصة.
 */

const eventBridge =
  require("./notificationEventBridge");

const rulesService =
  require("./notificationRulesService");

const notificationService =
  require("./notificationService");

const EVENT_TYPES =
  eventBridge.EVENT_TYPES || {
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
  received: 0,
  processed: 0,
  failed: 0,
  duplicates: 0,
  notificationsCreated: 0,
  lastEventType: null,
  lastEventAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null
};

function timestamp() {
  return new Date().toISOString();
}

function normalize(value) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {};
  }

  return {
    ...value
  };
}

function success(
  type,
  result
) {
  state.received += 1;
  state.processed += 1;
  state.lastEventType = type;
  state.lastEventAt = timestamp();
  state.lastSuccessAt =
    state.lastEventAt;
  state.lastError = null;

  if (
    result?.notification ||
    result?.notificationId ||
    result?.created
  ) {
    state.notificationsCreated += 1;
  }

  return {
    success: true,
    eventType: type,
    result
  };
}

function failure(
  type,
  error
) {
  state.received += 1;
  state.failed += 1;
  state.lastEventType = type;
  state.lastEventAt = timestamp();
  state.lastErrorAt =
    state.lastEventAt;
  state.lastError =
    error?.message ||
    String(error);
}

async function emit(
  type,
  payload = {},
  options = {}
) {
  if (!type) {
    const error =
      new Error(
        "eventType is required"
      );

    error.code =
      "EVENT_TYPE_REQUIRED";

    throw error;
  }

  const eventType =
    String(type);

  const data =
    normalize(payload);

  try {
    /*
     * Event Bridge
     */
    const bridgeResult =
      await eventBridge.emit(
        eventType,
        data,
        options
      );

    /*
     * Rules Engine
     *
     * إذا كان محرك القواعد متاحًا،
     * نعطيه الحدث لمعالجة قواعد الإشعار.
     */
    let ruleResult = null;

    if (
      typeof rulesService
        .processNotificationEvent ===
      "function"
    ) {
      ruleResult =
        await rulesService
          .processNotificationEvent(
            eventType,
            data,
            options
          );
    }

    /*
     * بعض الأنظمة قد تنشئ الإشعار
     * مباشرة من Event Bridge.
     */
    let directNotification =
      null;

    if (
      bridgeResult?.notification
    ) {
      directNotification =
        bridgeResult.notification;
    }

    return success(
      eventType,
      {
        bridge:
          bridgeResult,
        rules:
          ruleResult,
        notification:
          directNotification
      }
    );
  } catch (error) {
    failure(
      eventType,
      error
    );

    throw error;
  }
}

/* =========================================================
   أحداث المنصة
========================================================= */

async function breakingNews(
  data = {},
  options = {}
) {
  return emit(
    EVENT_TYPES.BREAKING_NEWS,
    {
      ...data,
      severity:
        data.severity ||
        data.priority ||
        "high",
      source:
        data.source ||
        "breaking-news"
    },
    options
  );
}

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
        data.confidence ?? null,
      source:
        data.source ||
        "ai"
    },
    options
  );
}

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
   Batch
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
      "EVENT_BATCH_INVALID";

    throw error;
  }

  const results = [];

  for (
    const item of events
  ) {
    try {
      results.push(
        await emit(
          item.eventType ||
            item.type,
          item.payload ||
            item.data ||
            {},
          {
            ...options,
            ...(item.options || {})
          }
        )
      );
    } catch (error) {
      results.push({
        success: false,
        error:
          error.message,
        eventType:
          item.eventType ||
          item.type ||
          null
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
          item.success !== false
      ).length,
    failed:
      results.filter(
        item =>
          item.success === false
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
  if (
    typeof rulesService.previewEvent ===
    "function"
  ) {
    return rulesService.previewEvent(
      eventType,
      normalize(payload)
    );
  }

  return {
    success: true,
    preview: true,
    eventType,
    payload:
      normalize(payload)
  };
}

/* =========================================================
   Health
========================================================= */

async function health() {
  let bridge = null;
  let rules = null;

  try {
    if (
      typeof eventBridge.health ===
      "function"
    ) {
      bridge =
        await eventBridge.health();
    }
  } catch (error) {
    bridge = {
      healthy: false,
      error:
        error.message
    };
  }

  try {
    if (
      typeof rulesService.health ===
      "function"
    ) {
      rules =
        await rulesService.health();
    }
  } catch (error) {
    rules = {
      healthy: false,
      error:
        error.message
    };
  }

  return {
    healthy:
      state.failed === 0 &&
      bridge?.healthy !== false &&
      rules?.healthy !== false,

    service:
      "notificationIntegrationService",

    eventBridge:
      bridge,

    rulesEngine:
      rules,

    state: {
      ...state
    },

    timestamp:
      timestamp()
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
  Object.assign(
    state,
    {
      received: 0,
      processed: 0,
      failed: 0,
      duplicates: 0,
      notificationsCreated: 0,
      lastEventType: null,
      lastEventAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null
    }
  );

  return getState();
}

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
