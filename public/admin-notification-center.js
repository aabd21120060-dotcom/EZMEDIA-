"use strict";

/**
 * EZ MEDIA 11.0
 * Admin Notification Center
 *
 * الكود رقم 44
 *
 * مركز إدارة الإشعارات داخل لوحة التحكم.
 *
 * يعتمد على:
 * /api/notifications
 * /api/notifications/statistics
 * /api/notifications/:id
 * /api/notifications/:id/prepare
 * /api/notifications/:id/refresh-status
 * /api/notifications/:id/cancel
 * /api/notifications/deliveries/:deliveryId/process
 *
 * ملاحظة:
 * هذا الملف لا ينفذ Push خارجي بنفسه.
 * الإرسال الخارجي يحتاج مزودًا رسميًا وBackend Provider.
 */

(function () {
  "use strict";

  const API = "/api/notifications";

  const STORAGE_KEY =
    "ezmedia_admin_notification_center_v1";

  const SETTINGS_KEY =
    "ezmedia_admin_notification_center_settings_v1";

  const EVENTS_KEY =
    "ezmedia_admin_notification_center_events_v1";

  const DEFAULT_SETTINGS = {
    autoRefresh: true,
    refreshInterval: 15000,
    pageSize: 50,
    showCompleted: true,
    showFailed: true,
    soundAlerts: false
  };

  const state = {
    initialized: false,
    loading: false,
    notifications: [],
    selectedNotification: null,
    statistics: null,
    filter: {
      search: "",
      status: "all",
      priority: "all",
      type: "all",
      channel: "all"
    },
    settings: loadSettings(),
    timer: null,
    lastRefreshAt: null
  };

  function loadSettings() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(SETTINGS_KEY) || "null"
        ) || {};

      return {
        ...DEFAULT_SETTINGS,
        ...saved
      };
    } catch {
      return {
        ...DEFAULT_SETTINGS
      };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(state.settings)
      );
    } catch {}
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filter: state.filter,
          lastRefreshAt: state.lastRefreshAt
        })
      );
    } catch {}
  }

  function loadSavedState() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "null"
        );

      if (!saved) {
        return;
      }

      if (saved.filter) {
        state.filter = {
          ...state.filter,
          ...saved.filter
        };
      }

      state.lastRefreshAt =
        saved.lastRefreshAt || null;
    } catch {}
  }

  function getEvents() {
    try {
      return (
        JSON.parse(
          localStorage.getItem(EVENTS_KEY) || "[]"
        ) || []
      );
    } catch {
      return [];
    }
  }

  function addEvent(type, payload = {}) {
    const events = getEvents();

    events.unshift({
      id:
        "event_" +
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .slice(2, 8),

      type,

      payload,

      timestamp: new Date().toISOString()
    });

    try {
      localStorage.setItem(
        EVENTS_KEY,
        JSON.stringify(events.slice(0, 500))
      );
    } catch {}

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:admin:notification:event",
        {
          detail: {
            type,
            payload
          }
        }
      )
    );
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return escapeHTML(value);
    }

    return new Intl.DateTimeFormat(
      "ar-SA",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    ).format(date);
  }

  function formatNumber(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat(
      "ar-SA"
    ).format(number);
  }

  function statusLabel(status) {
    const labels = {
      queued: "في الطابور",
      pending: "معلّق",
      processing: "قيد المعالجة",
      prepared: "مجهز",
      sent: "تم الإرسال",
      delivered: "تم التسليم",
      failed: "فشل",
      cancelled: "ملغى",
      completed: "مكتمل",
      read: "مقروء"
    };

    return (
      labels[String(status || "").toLowerCase()] ||
      status ||
      "غير معروف"
    );
  }

  function priorityLabel(priority) {
    const labels = {
      critical: "حرج",
      urgent: "عاجل",
      high: "مرتفع",
      normal: "عادي",
      low: "منخفض"
    };

    return (
      labels[String(priority || "").toLowerCase()] ||
      priority ||
      "عادي"
    );
  }

  function typeLabel(type) {
    const labels = {
      breaking_news: "خبر عاجل",
      live_started: "بدء بث",
      new_content: "محتوى جديد",
      system_alert: "تنبيه نظام",
      commercial: "إعلان / رعاية",
      security: "أمني",
      media: "وسائط",
      general: "عام"
    };

    return (
      labels[String(type || "").toLowerCase()] ||
      type ||
      "عام"
    );
  }

  function channelLabel(channel) {
    const labels = {
      in_app: "داخل المنصة",
      dashboard: "لوحة الإدارة",
      push: "Push",
      email: "البريد",
      sms: "رسائل SMS",
      social: "اجتماعي",
      webhook: "Webhook"
    };

    return (
      labels[String(channel || "").toLowerCase()] ||
      channel ||
      "غير محدد"
    );
  }

  function priorityClass(priority) {
    return (
      "ez-notification-priority-" +
      String(priority || "normal")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
    );
  }

  function statusClass(status) {
    return (
      "ez-notification-status-" +
      String(status || "unknown")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
    );
  }

  async function apiRequest(
    url,
    options = {}
  ) {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok) {
      const error =
        new Error(
          data.error ||
          data.message ||
          `HTTP ${response.status}`
        );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  async function loadNotifications() {
    state.loading = true;

    renderLoading();

    try {
      const params =
        new URLSearchParams();

      params.set(
        "limit",
        String(state.settings.pageSize)
      );

      if (state.filter.status !== "all") {
        params.set(
          "status",
          state.filter.status
        );
      }

      if (state.filter.type !== "all") {
        params.set(
          "type",
          state.filter.type
        );
      }

      if (state.filter.priority !== "all") {
        params.set(
          "priority",
          state.filter.priority
        );
      }

      if (state.filter.channel !== "all") {
        params.set(
          "channel",
          state.filter.channel
        );
      }

      if (state.filter.search.trim()) {
        params.set(
          "search",
          state.filter.search.trim()
        );
      }

      const data =
        await apiRequest(
          `${API}?${params.toString()}`
        );

      state.notifications =
        Array.isArray(data)
          ? data
          : Array.isArray(data.notifications)
            ? data.notifications
            : Array.isArray(data.rows)
              ? data.rows
              : [];

      state.lastRefreshAt =
        new Date().toISOString();

      saveState();

      addEvent(
        "notifications_loaded",
        {
          count: state.notifications.length
        }
      );

      render();
    } catch (error) {
      renderError(
        "تعذر تحميل الإشعارات",
        error.message
      );
    } finally {
      state.loading = false;
    }
  }

  async function loadStatistics() {
    try {
      const data =
        await apiRequest(
          `${API}/statistics`
        );

      state.statistics =
        data.statistics ||
        data;

      renderStatistics();
    } catch (error) {
      console.warn(
        "EZ MEDIA notification statistics error:",
        error
      );
    }
  }

  async function loadAll() {
    await Promise.all([
      loadNotifications(),
      loadStatistics()
    ]);
  }

  function getFilteredNotifications() {
    const search =
      state.filter.search
        .trim()
        .toLowerCase();

    return state.notifications.filter(
      (notification) => {
        if (
          state.filter.status !== "all" &&
          String(notification.status) !==
            state.filter.status
        ) {
          return false;
        }

        if (
          state.filter.priority !== "all" &&
          String(notification.priority) !==
            state.filter.priority
        ) {
          return false;
        }

        if (
          state.filter.type !== "all" &&
          String(notification.type) !==
            state.filter.type
        ) {
          return false;
        }

        if (search) {
          const haystack =
            [
              notification.title,
              notification.body,
              notification.type,
              notification.status,
              notification.uuid,
              notification.dedupe_key
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          if (!haystack.includes(search)) {
            return false;
          }
        }

        return true;
      }
    );
  }

  function renderStatistics() {
    const root =
      document.querySelector(
        "#ez-notification-statistics"
      );

    if (!root) {
      return;
    }

    const stats =
      state.statistics || {};

    const total =
      stats.total ??
      stats.total_notifications ??
      stats.count ??
      0;

    const queued =
      stats.queued ??
      stats.pending ??
      stats.queued_notifications ??
      0;

    const processing =
      stats.processing ??
      stats.processing_notifications ??
      0;

    const sent =
      stats.sent ??
      stats.sent_notifications ??
      0;

    const delivered =
      stats.delivered ??
      stats.delivered_notifications ??
      0;

    const failed =
      stats.failed ??
      stats.failed_notifications ??
      0;

    root.innerHTML = `
      <div class="ez-notification-stat">
        <strong>${formatNumber(total)}</strong>
        <span>الإجمالي</span>
      </div>

      <div class="ez-notification-stat">
        <strong>${formatNumber(queued)}</strong>
        <span>في الطابور</span>
      </div>

      <div class="ez-notification-stat">
        <strong>${formatNumber(processing)}</strong>
        <span>قيد المعالجة</span>
      </div>

      <div class="ez-notification-stat">
        <strong>${formatNumber(sent)}</strong>
        <span>تم الإرسال</span>
      </div>

      <div class="ez-notification-stat">
        <strong>${formatNumber(delivered)}</strong>
        <span>تم التسليم</span>
      </div>

      <div class="ez-notification-stat">
        <strong>${formatNumber(failed)}</strong>
        <span>فشل</span>
      </div>
    `;
  }

  function renderLoading() {
    const root =
      document.querySelector(
        "#ez-notification-list"
      );

    if (!root) {
      return;
    }

    root.innerHTML = `
      <div class="ez-notification-empty">
        <div class="ez-notification-loader"></div>
        <strong>جاري تحميل مركز الإشعارات…</strong>
      </div>
    `;
  }

  function renderError(title, message) {
    const root =
      document.querySelector(
        "#ez-notification-list"
      );

    if (!root) {
      return;
    }

    root.innerHTML = `
      <div class="ez-notification-error">
        <strong>${escapeHTML(title)}</strong>
        <span>${escapeHTML(message)}</span>

        <button
          type="button"
          data-notification-action="refresh"
        >
          إعادة المحاولة
        </button>
      </div>
    `;
  }

  function render() {
    renderStatistics();

    const root =
      document.querySelector(
        "#ez-notification-list"
      );

    if (!root) {
      return;
    }

    const notifications =
      getFilteredNotifications();

    if (!notifications.length) {
      root.innerHTML = `
        <div class="ez-notification-empty">
          <strong>لا توجد إشعارات</strong>
          <span>
            لا توجد نتائج مطابقة للفلاتر الحالية.
          </span>
        </div>
      `;

      return;
    }

    root.innerHTML =
      notifications
        .map(
          (notification) =>
            renderNotificationCard(
              notification
            )
        )
        .join("");
  }

  function renderNotificationCard(
    notification
  ) {
    const channels =
      Array.isArray(notification.channels)
        ? notification.channels
        : typeof notification.channels === "string"
          ? notification.channels
              .split(",")
              .map((item) => item.trim())
          : [];

    return `
      <article
        class="
          ez-notification-card
          ${priorityClass(notification.priority)}
          ${statusClass(notification.status)}
        "
        data-notification-id="${escapeHTML(
          notification.id
        )}"
      >
        <div class="ez-notification-card-head">

          <div>
            <span class="ez-notification-type">
              ${escapeHTML(
                typeLabel(notification.type)
              )}
            </span>

            <h3>
              ${escapeHTML(
                notification.title ||
                  "إشعار بدون عنوان"
              )}
            </h3>
          </div>

          <span class="ez-notification-status">
            ${escapeHTML(
              statusLabel(
                notification.status
              )
            )}
          </span>

        </div>

        <p class="ez-notification-body">
          ${escapeHTML(
            notification.body || ""
          )}
        </p>

        <div class="ez-notification-meta">

          <span>
            الأولوية:
            <strong>
              ${escapeHTML(
                priorityLabel(
                  notification.priority
                )
              )}
            </strong>
          </span>

          <span>
            النوع:
            ${escapeHTML(
              typeLabel(notification.type)
            )}
          </span>

          <span>
            الإنشاء:
            ${formatDate(
              notification.created_at ||
                notification.createdAt
            )}
          </span>

        </div>

        ${
          channels.length
            ? `
              <div class="ez-notification-channels">
                ${channels
                  .map(
                    (channel) =>
                      `<span>${escapeHTML(
                        channelLabel(channel)
                      )}</span>`
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        <div class="ez-notification-actions">

          <button
            type="button"
            data-notification-action="open"
            data-id="${escapeHTML(
              notification.id
            )}"
          >
            التفاصيل
          </button>

          ${
            ["queued", "pending", "prepared"].includes(
              String(notification.status)
            )
              ? `
                <button
                  type="button"
                  data-notification-action="prepare"
                  data-id="${escapeHTML(
                    notification.id
                  )}"
                >
                  تجهيز
                </button>
              `
              : ""
          }

          ${
            ["queued", "pending", "processing", "prepared"].includes(
              String(notification.status)
            )
              ? `
                <button
                  type="button"
                  data-notification-action="refresh-status"
                  data-id="${escapeHTML(
                    notification.id
                  )}"
                >
                  تحديث الحالة
                </button>

                <button
                  type="button"
                  data-notification-action="cancel"
                  data-id="${escapeHTML(
                    notification.id
                  )}"
                >
                  إلغاء
                </button>
              `
              : ""
          }

        </div>
      </article>
    `;
  }

  async function openNotification(id) {
    try {
      const data =
        await apiRequest(
          `${API}/${encodeURIComponent(id)}`
        );

      state.selectedNotification =
        data.notification ||
        data;

      renderDetails();

      addEvent(
        "notification_opened",
        {
          id
        }
      );
    } catch (error) {
      notify(
        "تعذر فتح الإشعار",
        error.message,
        "error"
      );
    }
  }

  function renderDetails() {
    const root =
      document.querySelector(
        "#ez-notification-details"
      );

    if (!root) {
      return;
    }

    const notification =
      state.selectedNotification;

    if (!notification) {
      root.innerHTML = `
        <div class="ez-notification-empty">
          اختر إشعارًا لعرض التفاصيل.
        </div>
      `;

      return;
    }

    const deliveries =
      Array.isArray(
        notification.deliveries
      )
        ? notification.deliveries
        : [];

    root.innerHTML = `
      <div class="ez-notification-details-inner">

        <div class="ez-notification-details-head">
          <div>
            <small>
              ${escapeHTML(
                typeLabel(notification.type)
              )}
            </small>

            <h2>
              ${escapeHTML(
                notification.title ||
                  "إشعار"
              )}
            </h2>
          </div>

          <button
            type="button"
            data-notification-action="close-details"
          >
            إغلاق
          </button>
        </div>

        <div class="ez-notification-details-body">

          <p>
            ${escapeHTML(
              notification.body || ""
            )}
          </p>

          <dl>

            <div>
              <dt>المعرّف</dt>
              <dd>${escapeHTML(
                notification.id
              )}</dd>
            </div>

            <div>
              <dt>UUID</dt>
              <dd>${escapeHTML(
                notification.uuid || "—"
              )}</dd>
            </div>

            <div>
              <dt>الحالة</dt>
              <dd>${escapeHTML(
                statusLabel(
                  notification.status
                )
              )}</dd>
            </div>

            <div>
              <dt>الأولوية</dt>
              <dd>${escapeHTML(
                priorityLabel(
                  notification.priority
                )
              )}</dd>
            </div>

            <div>
              <dt>تاريخ الإنشاء</dt>
              <dd>${formatDate(
                notification.created_at
              )}</dd>
            </div>

            <div>
              <dt>موعد الجدولة</dt>
              <dd>${formatDate(
                notification.scheduled_at
              )}</dd>
            </div>

          </dl>

          <h3>عمليات التسليم</h3>

          ${
            deliveries.length
              ? `
                <div class="ez-notification-deliveries">
                  ${deliveries
                    .map(
                      (delivery) =>
                        renderDelivery(
                          delivery
                        )
                    )
                    .join("")}
                </div>
              `
              : `
                <div class="ez-notification-empty">
                  لا توجد عمليات تسليم مسجلة.
                </div>
              `
          }

        </div>

      </div>
    `;

    const panel =
      document.querySelector(
        "#ez-notification-details-panel"
      );

    if (panel) {
      panel.hidden = false;
    }
  }

  function renderDelivery(delivery) {
    return `
      <div class="ez-notification-delivery">

        <div>
          <strong>
            ${escapeHTML(
              channelLabel(
                delivery.channel
              )
            )}
          </strong>

          <span>
            ${escapeHTML(
              statusLabel(
                delivery.status
              )
            )}
          </span>
        </div>

        <small>
          ${formatDate(
            delivery.created_at
          )}
        </small>

        ${
          ["queued", "prepared", "failed"].includes(
            String(delivery.status)
          )
            ? `
              <button
                type="button"
                data-notification-action="process-delivery"
                data-id="${escapeHTML(
                  delivery.id
                )}"
              >
                معالجة
              </button>
            `
            : ""
        }

      </div>
    `;
  }

  async function prepareNotification(id) {
    try {
      notify(
        "الإشعار",
        "جاري تجهيز الإشعار…",
        "info"
      );

      await apiRequest(
        `${API}/${encodeURIComponent(
          id
        )}/prepare`,
        {
          method: "POST"
        }
      );

      addEvent(
        "notification_prepared",
        {
          id
        }
      );

      notify(
        "تم",
        "تم تجهيز الإشعار بنجاح.",
        "success"
      );

      await loadAll();
      await openNotification(id);
    } catch (error) {
      notify(
        "فشل التجهيز",
        error.message,
        "error"
      );
    }
  }

  async function refreshNotificationStatus(
    id
  ) {
    try {
      await apiRequest(
        `${API}/${encodeURIComponent(
          id
        )}/refresh-status`,
        {
          method: "POST"
        }
      );

      addEvent(
        "notification_status_refreshed",
        {
          id
        }
      );

      await loadAll();

      if (
        state.selectedNotification &&
        String(
          state.selectedNotification.id
        ) === String(id)
      ) {
        await openNotification(id);
      }
    } catch (error) {
      notify(
        "تعذر تحديث الحالة",
        error.message,
        "error"
      );
    }
  }

  async function cancelNotification(id) {
    const confirmed =
      window.confirm(
        "هل تريد إلغاء هذا الإشعار؟"
      );

    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(
        `${API}/${encodeURIComponent(
          id
        )}/cancel`,
        {
          method: "POST"
        }
      );

      addEvent(
        "notification_cancelled",
        {
          id
        }
      );

      notify(
        "تم الإلغاء",
        "تم إلغاء الإشعار.",
        "success"
      );

      await loadAll();
    } catch (error) {
      notify(
        "تعذر الإلغاء",
        error.message,
        "error"
      );
    }
  }

  async function processDelivery(id) {
    try {
      notify(
        "معالجة التسليم",
        "جاري معالجة عملية التسليم…",
        "info"
      );

      await apiRequest(
        `${API}/deliveries/${encodeURIComponent(
          id
        )}/process`,
        {
          method: "POST"
        }
      );

      addEvent(
        "delivery_processed",
        {
          id
        }
      );

      notify(
        "تمت المعالجة",
        "تمت معالجة عملية التسليم.",
        "success"
      );

      await loadAll();

      if (state.selectedNotification) {
        await openNotification(
          state.selectedNotification.id
        );
      }
    } catch (error) {
      notify(
        "فشلت المعالجة",
        error.message,
        "error"
      );
    }
  }

  function closeDetails() {
    const panel =
      document.querySelector(
        "#ez-notification-details-panel"
      );

    if (panel) {
      panel.hidden = true;
    }

    state.selectedNotification =
      null;
  }

  function notify(
    title,
    message,
    level = "info"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification",
        {
          detail: {
            title,
            message,
            level,
            source:
              "admin-notification-center",
            timestamp:
              new Date().toISOString()
          }
        }
      )
    );

    addEvent(
      "ui_notification",
      {
        title,
        message,
        level
      }
    );
  }

  function bindFilters() {
    const search =
      document.querySelector(
        "#ez-notification-search"
      );

    if (search) {
      search.value =
        state.filter.search;

      search.addEventListener(
        "input",
        (event) => {
          state.filter.search =
            event.target.value;

          saveState();
          render();
        }
      );
    }

    const selects = [
      [
        "#ez-notification-status-filter",
        "status"
      ],
      [
        "#ez-notification-priority-filter",
        "priority"
      ],
      [
        "#ez-notification-type-filter",
        "type"
      ],
      [
        "#ez-notification-channel-filter",
        "channel"
      ]
    ];

    selects.forEach(
      ([selector, key]) => {
        const element =
          document.querySelector(
            selector
          );

        if (!element) {
          return;
        }

        element.value =
          state.filter[key];

        element.addEventListener(
          "change",
          (event) => {
            state.filter[key] =
              event.target.value;

            saveState();

            loadNotifications();
          }
        );
      }
    );
  }

  function bindActions() {
    document.addEventListener(
      "click",
      (event) => {
        const target =
          event.target.closest(
            "[data-notification-action]"
          );

        if (!target) {
          return;
        }

        const action =
          target.dataset
            .notificationAction;

        const id =
          target.dataset.id;

        if (action === "refresh") {
          loadAll();
          return;
        }

        if (action === "open") {
          openNotification(id);
          return;
        }

        if (action === "prepare") {
          prepareNotification(id);
          return;
        }

        if (action === "refresh-status") {
          refreshNotificationStatus(id);
          return;
        }

        if (action === "cancel") {
          cancelNotification(id);
          return;
        }

        if (action === "process-delivery") {
          processDelivery(id);
          return;
        }

        if (action === "close-details") {
          closeDetails();
        }
      }
    );

    const refresh =
      document.querySelector(
        "#ez-notification-refresh"
      );

    if (refresh) {
      refresh.addEventListener(
        "click",
        () => loadAll()
      );
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    if (!state.settings.autoRefresh) {
      return;
    }

    state.timer =
      setInterval(
        () => {
          if (
            document.hidden ||
            state.loading
          ) {
            return;
          }

          loadAll();
        },
        Math.max(
          5000,
          Number(
            state.settings
              .refreshInterval
          ) || 15000
        )
      );
  }

  function stopAutoRefresh() {
    if (state.timer) {
      clearInterval(
        state.timer
      );

      state.timer = null;
    }
  }

  function bindEvents() {
    window.addEventListener(
      "ezmedia:notification:created",
      () => {
        loadAll();
      }
    );

    window.addEventListener(
      "ezmedia:notification:processed",
      () => {
        loadAll();
      }
    );

    window.addEventListener(
      "ezmedia:breaking:created",
      () => {
        loadAll();
      }
    );

    window.addEventListener(
      "ezmedia:live:started",
      () => {
        loadAll();
      }
    );
  }

  function injectBaseStyles() {
    if (
      document.querySelector(
        "#ez-notification-center-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-notification-center-styles";

    style.textContent = `
      #ez-notification-center {
        direction: rtl;
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      #ez-notification-statistics {
        display: grid;
        grid-template-columns:
          repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }

      .ez-notification-stat {
        padding: 16px;
        border-radius: 18px;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #eefaff
          );
        border: 1px solid #d7effa;
      }

      .ez-notification-stat strong {
        display: block;
        font-size: 25px;
        color: #087ea4;
      }

      .ez-notification-stat span {
        display: block;
        margin-top: 5px;
        color: #58727d;
      }

      .ez-notification-card {
        margin-bottom: 12px;
        padding: 18px;
        border-radius: 20px;
        background: #ffffff;
        border: 1px solid #dceff5;
        box-shadow:
          0 8px 25px
          rgba(35, 145, 180, 0.07);
      }

      .ez-notification-card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 15px;
      }

      .ez-notification-card h3 {
        margin: 7px 0 0;
        color: #14343e;
      }

      .ez-notification-type {
        color: #087ea4;
        font-size: 13px;
        font-weight: 700;
      }

      .ez-notification-status {
        white-space: nowrap;
        padding: 6px 10px;
        border-radius: 999px;
        background: #eefaff;
        color: #087ea4;
        font-size: 12px;
        font-weight: 700;
      }

      .ez-notification-body {
        margin: 14px 0;
        line-height: 1.8;
        color: #45616b;
      }

      .ez-notification-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 18px;
        font-size: 13px;
        color: #68808a;
      }

      .ez-notification-channels {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 13px;
      }

      .ez-notification-channels span {
        padding: 5px 9px;
        border-radius: 999px;
        background: #f1fbff;
        color: #087ea4;
        font-size: 12px;
      }

      .ez-notification-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .ez-notification-actions button,
      .ez-notification-error button,
      .ez-notification-delivery button {
        border: 0;
        border-radius: 11px;
        padding: 9px 13px;
        cursor: pointer;
        background: #eaf9ff;
        color: #087ea4;
        font-weight: 700;
      }

      .ez-notification-actions button:hover,
      .ez-notification-error button:hover,
      .ez-notification-delivery button:hover {
        background: #d7f3fc;
      }

      .ez-notification-empty,
      .ez-notification-error {
        padding: 35px;
        text-align: center;
        border-radius: 20px;
        background: #ffffff;
        border: 1px solid #dceff5;
      }

      .ez-notification-empty strong,
      .ez-notification-error strong {
        display: block;
        margin-bottom: 8px;
        color: #163b46;
      }

      .ez-notification-empty span,
      .ez-notification-error span {
        display: block;
        color: #66818b;
      }

      .ez-notification-error {
        border-color: #ffd9df;
        background: #fff9fa;
      }

      .ez-notification-loader {
        width: 30px;
        height: 30px;
        margin: 0 auto 12px;
        border-radius: 50%;
        border: 3px solid #d9f2fa;
        border-top-color: #087ea4;
        animation:
          ezNotificationSpin
          0.8s linear infinite;
      }

      @keyframes ezNotificationSpin {
        to {
          transform: rotate(360deg);
        }
      }

      #ez-notification-details-panel {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background:
          rgba(255,255,255,.96);
        overflow: auto;
        padding: 30px;
      }

      .ez-notification-details-inner {
        max-width: 1000px;
        margin: auto;
        background: #ffffff;
        border: 1px solid #dceff5;
        border-radius: 24px;
        padding: 25px;
        box-shadow:
          0 20px 70px
          rgba(30, 130, 165, .12);
      }

      .ez-notification-details-head {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        align-items: flex-start;
      }

      .ez-notification-details-head h2 {
        margin: 8px 0;
        color: #123842;
      }

      .ez-notification-details-head button {
        border: 0;
        border-radius: 10px;
        padding: 9px 13px;
        background: #eefaff;
        color: #087ea4;
        cursor: pointer;
      }

      .ez-notification-details-body {
        margin-top: 20px;
      }

      .ez-notification-details-body p {
        line-height: 1.9;
        color: #45616b;
      }

      .ez-notification-details-body dl {
        display: grid;
        grid-template-columns:
          repeat(auto-fit, minmax(220px, 1fr));
        gap: 10px;
        margin: 20px 0;
      }

      .ez-notification-details-body dl div {
        padding: 12px;
        border-radius: 13px;
        background: #f6fcff;
      }

      .ez-notification-details-body dt {
        font-size: 12px;
        color: #6c8790;
      }

      .ez-notification-details-body dd {
        margin: 5px 0 0;
        word-break: break-word;
        color: #193d47;
      }

      .ez-notification-deliveries {
        display: grid;
        gap: 9px;
      }

      .ez-notification-delivery {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        border: 1px solid #e2f1f5;
        border-radius: 14px;
      }

      .ez-notification-delivery > div {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .ez-notification-delivery small {
        color: #718991;
      }

      @media (max-width: 700px) {
        .ez-notification-card-head,
        .ez-notification-details-head,
        .ez-notification-delivery {
          flex-direction: column;
          align-items: stretch;
        }

        #ez-notification-details-panel {
          padding: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    loadSavedState();

    injectBaseStyles();
    bindFilters();
    bindActions();
    bindEvents();

    loadAll();
    startAutoRefresh();

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification:center:ready",
        {
          detail: {
            timestamp:
              new Date().toISOString()
          }
        }
      )
    );
  }

  function destroy() {
    stopAutoRefresh();

    state.initialized = false;
  }

  function refresh() {
    return loadAll();
  }

  function getState() {
    return {
      ...state,
      notifications: [
        ...state.notifications
      ]
    };
  }

  window.EZMediaAdminNotificationCenter = {
    init,
    destroy,
    refresh,
    loadAll,
    loadNotifications,
    loadStatistics,
    openNotification,
    prepareNotification,
    refreshNotificationStatus,
    cancelNotification,
    processDelivery,
    getState,
    startAutoRefresh,
    stopAutoRefresh
  };

  /**
   * التشغيل التلقائي إذا كانت لوحة الإدارة موجودة.
   */
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
