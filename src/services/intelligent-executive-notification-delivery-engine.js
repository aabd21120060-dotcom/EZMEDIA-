"use strict";

const crypto = require("crypto");

function createIntelligentExecutiveNotificationDeliveryEngine(options = {}) {
  const {
    persistence = null,
    communicationEngine = null,
    notificationEngine = null,
    securityEngine = null,
    workflowEngine = null,
    aiCore = null,
    logger = console
  } = options;

  const state = {
    initialized: false,
    running: false,
    startedAt: null,
    sent: 0,
    failed: 0,
    queued: 0,
    channels: new Map(),
    providers: new Map()
  };

  const DEFAULT_MAX_QUEUE = Number(
    process.env.EXECUTIVE_DELIVERY_MAX_QUEUE || 10000
  );

  const DEFAULT_RETRIES = Number(
    process.env.EXECUTIVE_DELIVERY_DEFAULT_RETRIES || 3
  );

  const DEFAULT_TIMEOUT = Number(
    process.env.EXECUTIVE_DELIVERY_TIMEOUT_MS || 30000
  );

  function now() {
    return new Date().toISOString();
  }

  function id(prefix = "delivery") {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
  }

  function normalizeChannel(channel) {
    return String(channel || "")
      .trim()
      .toLowerCase();
  }

  function normalizePriority(priority) {
    const allowed = [
      "critical",
      "high",
      "medium",
      "low",
      "info"
    ];

    const value = String(priority || "medium").toLowerCase();

    return allowed.includes(value)
      ? value
      : "medium";
  }

  function maskDestination(destination) {
    if (!destination) return null;

    const value = String(destination);

    if (value.includes("@")) {
      const [name, domain] = value.split("@");

      return `${name.slice(0, 2)}***@${domain}`;
    }

    if (value.length > 6) {
      return `${value.slice(0, 3)}***${value.slice(-3)}`;
    }

    return "***";
  }

  async function audit(action, payload = {}) {
    try {
      if (
        persistence &&
        typeof persistence.addAuditLog === "function"
      ) {
        await persistence.addAuditLog({
          action,
          actorType: payload.actorType || "system",
          actorId: payload.actorId || "executive-delivery-engine",
          resourceType: payload.resourceType || "notification_delivery",
          resourceId: payload.resourceId || null,
          metadata: payload.metadata || {}
        });
      }
    } catch (error) {
      logger.error(
        "[EXECUTIVE DELIVERY AUDIT ERROR]",
        error
      );
    }
  }

  async function initialize() {
    if (state.initialized) return;

    state.channels.set("internal", {
      id: "internal",
      enabled: true,
      provider: "internal"
    });

    state.channels.set("email", {
      id: "email",
      enabled:
        process.env.EXECUTIVE_EMAIL_ENABLED === "true",
      provider: "email"
    });

    state.channels.set("whatsapp", {
      id: "whatsapp",
      enabled:
        process.env.EXECUTIVE_WHATSAPP_ENABLED === "true",
      provider: "whatsapp"
    });

    state.channels.set("sms", {
      id: "sms",
      enabled:
        process.env.EXECUTIVE_SMS_ENABLED === "true",
      provider: "sms"
    });

    state.channels.set("push", {
      id: "push",
      enabled:
        process.env.EXECUTIVE_PUSH_ENABLED === "true",
      provider: "push"
    });

    state.initialized = true;

    await audit(
      "executive_delivery_initialized"
    );

    return getStatus();
  }

  function registerProvider(
    channel,
    provider
  ) {
    const normalized =
      normalizeChannel(channel);

    if (!normalized) {
      throw new Error(
        "Notification channel is required"
      );
    }

    if (
      !provider ||
      typeof provider.send !== "function"
    ) {
      throw new Error(
        "Provider must expose send()"
      );
    }

    state.providers.set(
      normalized,
      provider
    );

    const current =
      state.channels.get(normalized) || {
        id: normalized,
        provider: normalized
      };

    current.enabled = true;

    state.channels.set(
      normalized,
      current
    );

    return {
      channel: normalized,
      registered: true
    };
  }

  function getChannels() {
    return Array.from(
      state.channels.values()
    ).map((channel) => ({
      ...channel,
      providerRegistered:
        state.providers.has(channel.id)
    }));
  }

  function getStatus() {
    return {
      initialized: state.initialized,
      running: state.running,
      startedAt: state.startedAt,
      sent: state.sent,
      failed: state.failed,
      queued: state.queued,
      channels: getChannels()
    };
  }

  async function checkPermission({
    actorId = "system",
    channel,
    priority = "medium"
  }) {
    if (!securityEngine) {
      return {
        allowed: true,
        reason: "security_engine_unavailable"
      };
    }

    if (
      typeof securityEngine.authorize !== "function"
    ) {
      return {
        allowed: true,
        reason: "authorization_hook_unavailable"
      };
    }

    try {
      const result =
        await securityEngine.authorize({
          userId: actorId,
          permission:
            "communication.send",
          resource:
            `notification:${channel}`
        });

      return {
        allowed:
          result === true ||
          result?.authorized === true ||
          result?.allowed === true,
        reason:
          result?.reason ||
          "security_authorization"
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error.message
      };
    }
  }

  function buildMessage(notification = {}) {
    const title =
      notification.title ||
      "تنبيه EZ MEDIA";

    const message =
      notification.message ||
      notification.body ||
      "";

    const priority =
      normalizePriority(
        notification.priority
      );

    return {
      title,
      message,
      priority,
      type:
        notification.type ||
        "executive_alert",
      alertId:
        notification.alertId ||
        null,
      actionUrl:
        notification.actionUrl ||
        null,
      metadata:
        notification.metadata ||
        {}
    };
  }

  async function dispatchInternal(
    message
  ) {
    if (
      notificationEngine &&
      typeof notificationEngine.notify === "function"
    ) {
      return notificationEngine.notify({
        type: message.type,
        title: message.title,
        message: message.message,
        priority: message.priority,
        metadata: message.metadata
      });
    }

    if (
      communicationEngine &&
      typeof communicationEngine.send === "function"
    ) {
      return communicationEngine.send({
        channel: "internal",
        subject: message.title,
        message: message.message,
        priority: message.priority,
        metadata: message.metadata
      });
    }

    return {
      delivered: true,
      mode: "internal-fallback"
    };
  }

  async function dispatchExternal(
    channel,
    message,
    destination,
    options = {}
  ) {
    const normalized =
      normalizeChannel(channel);

    const channelConfig =
      state.channels.get(normalized);

    if (!channelConfig) {
      throw new Error(
        `Unsupported notification channel: ${normalized}`
      );
    }

    if (!channelConfig.enabled) {
      throw new Error(
        `Notification channel disabled: ${normalized}`
      );
    }

    const provider =
      state.providers.get(normalized);

    if (!provider) {
      return {
        delivered: false,
        queued: false,
        providerConnected: false,
        status:
          "provider_not_connected",
        channel: normalized,
        destination:
          maskDestination(destination)
      };
    }

    const timeout =
      Number(
        options.timeoutMs ||
        DEFAULT_TIMEOUT
      );

    const payload = {
      id: id("message"),
      channel: normalized,
      destination,
      title: message.title,
      message: message.message,
      priority: message.priority,
      type: message.type,
      alertId: message.alertId,
      actionUrl: message.actionUrl,
      metadata: message.metadata
    };

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        timeout
      );

    try {
      const result =
        await provider.send({
          ...payload,
          signal:
            controller.signal
        });

      return {
        delivered: true,
        queued: false,
        providerConnected: true,
        channel: normalized,
        providerResult: result
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(
    notification = {}
  ) {
    if (!state.initialized) {
      await initialize();
    }

    if (
      process.env.EXECUTIVE_NOTIFICATIONS_ENABLED ===
      "false"
    ) {
      return {
        success: false,
        disabled: true
      };
    }

    if (
      state.queued >=
      DEFAULT_MAX_QUEUE
    ) {
      throw new Error(
        "Executive notification delivery queue is full"
      );
    }

    const message =
      buildMessage(notification);

    const channels =
      Array.isArray(notification.channels) &&
      notification.channels.length
        ? notification.channels
        : ["internal"];

    const destination =
      notification.destination ||
      null;

    const actorId =
      notification.actorId ||
      "system";

    const results = [];

    state.queued++;

    try {
      for (
        const requestedChannel
        of channels
      ) {
        const channel =
          normalizeChannel(
            requestedChannel
          );

        const permission =
          await checkPermission({
            actorId,
            channel,
            priority:
              message.priority
          });

        if (!permission.allowed) {
          results.push({
            channel,
            delivered: false,
            status:
              "authorization_denied",
            reason:
              permission.reason
          });

          continue;
        }

        try {
          let result;

          if (
            channel === "internal"
          ) {
            result =
              await dispatchInternal(
                message
              );
          } else {
            result =
              await dispatchExternal(
                channel,
                message,
                destination,
                notification
              );
          }

          if (result.delivered) {
            state.sent++;
          } else if (
            result.status ===
            "provider_not_connected"
          ) {
            state.failed++;
          }

          results.push({
            channel,
            ...result
          });

        } catch (error) {
          state.failed++;

          results.push({
            channel,
            delivered: false,
            status: "failed",
            error: error.message
          });
        }
      }
    } finally {
      state.queued =
        Math.max(
          0,
          state.queued - 1
        );
    }

    const deliveryId =
      id("delivery");

    await audit(
      "executive_notification_dispatched",
      {
        resourceId: deliveryId,
        metadata: {
          notificationType:
            message.type,
          priority:
            message.priority,
          channels,
          results: results.map(
            (item) => ({
              channel:
                item.channel,
              delivered:
                item.delivered,
              status:
                item.status || null
            })
          )
        }
      }
    );

    return {
      success:
        results.some(
          (item) =>
            item.delivered === true
        ),
      deliveryId,
      results
    };
  }

  async function broadcast(
    notification = {}
  ) {
    const channels =
      notification.channels ||
      [
        "internal",
        "email",
        "whatsapp",
        "sms",
        "push"
      ];

    return send({
      ...notification,
      channels
    });
  }

  async function testChannel(
    channel,
    destination
  ) {
    return send({
      title:
        "اختبار EZ MEDIA",
      message:
        "هذه رسالة اختبار من بوابة التنبيهات التنفيذية.",
      type:
        "system_test",
      priority:
        "info",
      channels: [channel],
      destination,
      actorId:
        "super_admin"
    });
  }

  async function start() {
    if (state.running) {
      return getStatus();
    }

    state.running = true;
    state.startedAt = now();

    await audit(
      "executive_delivery_started"
    );

    return getStatus();
  }

  async function stop() {
    state.running = false;

    await audit(
      "executive_delivery_stopped"
    );

    return getStatus();
  }

  async function healthCheck() {
    return {
      status:
        state.initialized &&
        state.running
          ? "healthy"
          : state.initialized
            ? "ready"
            : "not_initialized",
      ...getStatus()
    };
  }

  async function getStatistics() {
    return {
      sent: state.sent,
      failed: state.failed,
      queued: state.queued,
      channels:
        getChannels().length,
      providers:
        state.providers.size
    };
  }

  return {
    initialize,
    start,
    stop,
    send,
    broadcast,
    testChannel,
    registerProvider,
    getChannels,
    getStatus,
    getStatistics,
    healthCheck
  };
}

module.exports = {
  createIntelligentExecutiveNotificationDeliveryEngine
};
