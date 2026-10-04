"use strict";

/**
 * EZ MEDIA 11.0
 * Admin Notification Intelligence
 *
 * الكود رقم 51
 *
 * مركز مراقبة ذكاء الإشعارات والأحداث.
 */

(() => {
  const API = {
    notifications:
      "/api/notifications",

    notificationStatistics:
      "/api/notifications/statistics",

    worker:
      "/api/notification-worker",

    workerHealth:
      "/api/notification-worker/health",

    rules:
      "/api/notification-rules",

    rulesStatistics:
      "/api/notification-rules/statistics",

    rulesHealth:
      "/api/notification-rules/health",

    events:
      "/api/notification-events",

    eventsStatistics:
      "/api/notification-events/statistics",

    eventsHealth:
      "/api/notification-events/health"
  };

  const STORAGE_KEY =
    "ezmedia_admin_notification_intelligence_v1";

  const SETTINGS_KEY =
    "ezmedia_admin_notification_intelligence_settings_v1";

  const EVENT_LOG_KEY =
    "ezmedia_admin_notification_intelligence_events_v1";

  const state = {
    loaded: false,

    loading: false,

    autoRefresh:
      true,

    refreshInterval:
      15000,

    timer:
      null,

    notifications:
      null,

    notificationStatistics:
      null,

    worker:
      null,

    workerHealth:
      null,

    rules:
      null,

    rulesStatistics:
      null,

    rulesHealth:
      null,

    events:
      null,

    eventsStatistics:
      null,

    eventsHealth:
      null,

    lastRefresh:
      null,

    selectedRule:
      null,

    selectedEvent:
      null,

    search:
      "",

    filter:
      "all"
  };

  /* =======================================================
     Storage
  ======================================================= */

  function loadSettings() {
    try {
      const settings =
        JSON.parse(
          localStorage.getItem(
            SETTINGS_KEY
          ) || "{}"
        );

      state.autoRefresh =
        settings.autoRefresh !== false;

      state.refreshInterval =
        Number(
          settings.refreshInterval
        ) || 15000;
    } catch {
      state.autoRefresh = true;
      state.refreshInterval = 15000;
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          autoRefresh:
            state.autoRefresh,

          refreshInterval:
            state.refreshInterval
        })
      );
    } catch {
      /* ignore */
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lastRefresh:
            state.lastRefresh,

          search:
            state.search,

          filter:
            state.filter
        })
      );
    } catch {
      /* ignore */
    }
  }

  function logEvent(
    type,
    data = {}
  ) {
    try {
      const current =
        JSON.parse(
          localStorage.getItem(
            EVENT_LOG_KEY
          ) || "[]"
        );

      current.unshift({
        id:
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2, 8),

        type,

        data,

        timestamp:
          new Date().toISOString()
      });

      localStorage.setItem(
        EVENT_LOG_KEY,
        JSON.stringify(
          current.slice(0, 100)
        )
      );
    } catch {
      /* ignore */
    }
  }

  /* =======================================================
     Utilities
  ======================================================= */

  function escapeHtml(
    value
  ) {
    return String(
      value ??
        ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(
    value
  ) {
    const number =
      Number(value);

    if (
      Number.isNaN(number)
    ) {
      return "0";
    }

    return number.toLocaleString(
      "ar-SA"
    );
  }

  function formatDate(
    value
  ) {
    if (!value) {
      return "—";
    }

    try {
      return new Date(
        value
      ).toLocaleString(
        "ar-SA"
      );
    } catch {
      return "—";
    }
  }

  function statusClass(
    healthy
  ) {
    return healthy
      ? "healthy"
      : "danger";
  }

  function statusText(
    healthy
  ) {
    return healthy
      ? "يعمل"
      : "يحتاج مراجعة";
  }

  async function fetchJSON(
    url,
    options = {}
  ) {
    const response =
      await fetch(
        url,
        {
          credentials:
            "same-origin",

          headers: {
            Accept:
              "application/json",

            ...(options.body
              ? {
                  "Content-Type":
                    "application/json"
                }
              : {}),

            ...(options.headers || {})
          },

          ...options
        }
      );

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    let data = null;

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      data =
        await response.json();
    } else {
      data = {
        success:
          response.ok,

        text:
          await response.text()
      };
    }

    if (!response.ok) {
      const error =
        new Error(
          data?.error ||
          "API request failed"
        );

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    return data;
  }

  /* =======================================================
     DOM
  ======================================================= */

  function getRoot() {
    return (
      document.querySelector(
        "#notification-intelligence-section"
      ) ||
      document.querySelector(
        "#notification-intelligence"
      )
    );
  }

  function createRoot() {
    let root =
      getRoot();

    if (root) {
      return root;
    }

    root =
      document.createElement(
        "section"
      );

    root.id =
      "notification-intelligence-section";

    root.className =
      "ez-notification-intelligence";

    const target =
      document.querySelector(
        "#system-section"
      ) ||
      document.querySelector(
        "main"
      ) ||
      document.body;

    target.appendChild(
      root
    );

    return root;
  }

  /* =======================================================
     Data Loading
  ======================================================= */

  async function loadNotifications() {
    try {
      return await fetchJSON(
        `${API.notifications}?limit=50`
      );
    } catch {
      return null;
    }
  }

  async function loadNotificationStatistics() {
    try {
      return await fetchJSON(
        API.notificationStatistics
      );
    } catch {
      return null;
    }
  }

  async function loadWorker() {
    try {
      return await fetchJSON(
        `${API.worker}/status`
      );
    } catch {
      return null;
    }
  }

  async function loadWorkerHealth() {
    try {
      return await fetchJSON(
        API.workerHealth
      );
    } catch {
      return null;
    }
  }

  async function loadRules() {
    try {
      return await fetchJSON(
        API.rules
      );
    } catch {
      return null;
    }
  }

  async function loadRulesStatistics() {
    try {
      return await fetchJSON(
        API.rulesStatistics
      );
    } catch {
      return null;
    }
  }

  async function loadRulesHealth() {
    try {
      return await fetchJSON(
        API.rulesHealth
      );
    } catch {
      return null;
    }
  }

  async function loadEvents() {
    try {
      return await fetchJSON(
        API.events
      );
    } catch {
      return null;
    }
  }

  async function loadEventsStatistics() {
    try {
      return await fetchJSON(
        API.eventsStatistics
      );
    } catch {
      return null;
    }
  }

  async function loadEventsHealth() {
    try {
      return await fetchJSON(
        API.eventsHealth
      );
    } catch {
      return null;
    }
  }

  async function refresh(
    options = {}
  ) {
    if (
      state.loading
    ) {
      return;
    }

    state.loading = true;

    renderLoading();

    try {
      const [
        notifications,
        notificationStatistics,
        worker,
        workerHealth,
        rules,
        rulesStatistics,
        rulesHealth,
        events,
        eventsStatistics,
        eventsHealth
      ] =
        await Promise.all([
          loadNotifications(),

          loadNotificationStatistics(),

          loadWorker(),

          loadWorkerHealth(),

          loadRules(),

          loadRulesStatistics(),

          loadRulesHealth(),

          loadEvents(),

          loadEventsStatistics(),

          loadEventsHealth()
        ]);

      state.notifications =
        notifications;

      state.notificationStatistics =
        notificationStatistics;

      state.worker =
        worker;

      state.workerHealth =
        workerHealth;

      state.rules =
        rules;

      state.rulesStatistics =
        rulesStatistics;

      state.rulesHealth =
        rulesHealth;

      state.events =
        events;

      state.eventsStatistics =
        eventsStatistics;

      state.eventsHealth =
        eventsHealth;

      state.loaded = true;

      state.lastRefresh =
        new Date().toISOString();

      saveState();

      logEvent(
        "refresh",
        {
          manual:
            options.manual === true
        }
      );

      render();
    } catch (error) {
      logEvent(
        "refresh_error",
        {
          error:
            error.message
        }
      );

      renderError(
        error
      );
    } finally {
      state.loading = false;
    }
  }

  /* =======================================================
     Rendering
  ======================================================= */

  function renderLoading() {
    const root =
      createRoot();

    if (
      !state.loaded
    ) {
      root.innerHTML = `
        <div class="ez-ni-loading">
          <div class="ez-ni-spinner"></div>
          <div>
            <strong>جاري تشغيل مركز ذكاء الإشعارات…</strong>
            <span>يتم جمع حالة القواعد والأحداث والـ Worker.</span>
          </div>
        </div>
      `;
    }
  }

  function renderError(
    error
  ) {
    const root =
      createRoot();

    root.innerHTML = `
      <div class="ez-ni-error">
        <strong>تعذر تحميل مركز ذكاء الإشعارات</strong>
        <span>${escapeHtml(
          error?.message ||
            "خطأ غير معروف"
        )}</span>
        <button type="button" data-ni-action="refresh">
          إعادة المحاولة
        </button>
      </div>
    `;
  }

  function getWorkerHealthy() {
    return Boolean(
      state.workerHealth?.healthy ||
      state.worker?.healthy
    );
  }

  function getRulesHealthy() {
    return Boolean(
      state.rulesHealth?.healthy
    );
  }

  function getEventsHealthy() {
    return Boolean(
      state.eventsHealth?.healthy
    );
  }

  function getNotificationCount() {
    const data =
      state.notificationStatistics;

    return Number(
      data?.statistics?.total ||
      data?.total ||
      0
    );
  }

  function getCreatedCount() {
    return Number(
      state.eventsStatistics
        ?.statistics
        ?.notificationsCreated ||
      state.eventsStatistics
        ?.notificationsCreated ||
      0
    );
  }

  function render() {
    const root =
      createRoot();

    const workerHealthy =
      getWorkerHealthy();

    const rulesHealthy =
      getRulesHealthy();

    const eventsHealthy =
      getEventsHealthy();

    const notificationCount =
      getNotificationCount();

    const createdCount =
      getCreatedCount();

    root.innerHTML = `
      <div class="ez-ni-shell">

        <header class="ez-ni-header">
          <div>
            <span class="ez-ni-kicker">
              EZ MEDIA 11.0
            </span>

            <h2>
              مركز ذكاء الإشعارات
            </h2>

            <p>
              مراقبة القواعد والأحداث والـ Worker
              ومحرك اتخاذ قرار الإشعار.
            </p>
          </div>

          <div class="ez-ni-actions">
            <button
              type="button"
              data-ni-action="refresh"
            >
              تحديث الآن
            </button>

            <button
              type="button"
              data-ni-action="worker"
            >
              تشغيل Worker
            </button>
          </div>
        </header>

        <section class="ez-ni-metrics">

          ${metric(
            "الإشعارات",
            formatNumber(
              notificationCount
            ),
            "notifications"
          )}

          ${metric(
            "إشعارات أنشأها المحرك",
            formatNumber(
              createdCount
            ),
            "created"
          )}

          ${metric(
            "قواعد نشطة",
            formatNumber(
              state
                .rulesStatistics
                ?.statistics
                ?.active ||
                state
                  .rulesStatistics
                  ?.active ||
                0
            ),
            "rules"
          )}

          ${metric(
            "الأحداث المعالجة",
            formatNumber(
              state
                .eventsStatistics
                ?.statistics
                ?.eventsProcessed ||
                state
                  .eventsStatistics
                  ?.eventsProcessed ||
                0
            ),
            "events"
          )}

        </section>

        <section class="ez-ni-health">

          ${healthCard(
            "Notification Worker",
            workerHealthy,
            state.workerHealth
          )}

          ${healthCard(
            "Rules Engine",
            rulesHealthy,
            state.rulesHealth
          )}

          ${healthCard(
            "Event Bridge",
            eventsHealthy,
            state.eventsHealth
          )}

          ${healthCard(
            "Notification API",
            Boolean(
              state.notificationStatistics
            ),
            state.notificationStatistics
          )}

        </section>

        <section class="ez-ni-panels">

          <div class="ez-ni-panel">
            <div class="ez-ni-panel-title">
              قواعد الإشعارات
              <button
                type="button"
                data-ni-action="rules"
              >
                عرض
              </button>
            </div>

            <div id="ez-ni-rules-list">
              ${renderRules()}
            </div>
          </div>

          <div class="ez-ni-panel">
            <div class="ez-ni-panel-title">
              آخر الأحداث
              <button
                type="button"
                data-ni-action="events"
              >
                تحديث
              </button>
            </div>

            <div id="ez-ni-events-list">
              ${renderEvents()}
            </div>
          </div>

        </section>

        <section class="ez-ni-worker-panel">

          <div>
            <strong>
              حالة المحرك الخلفي
            </strong>

            <p>
              ${workerHealthy
                ? "محرك الإشعارات يعمل."
                : "المحرك يحتاج إلى مراجعة."}
            </p>
          </div>

          <div class="ez-ni-worker-actions">
            <button
              type="button"
              data-ni-action="run"
            >
              تشغيل دورة الآن
            </button>

            <button
              type="button"
              data-ni-action="restart"
            >
              إعادة تشغيل Worker
            </button>

            <button
              type="button"
              data-ni-action="stop"
            >
              إيقاف Worker
            </button>
          </div>

        </section>

        <footer class="ez-ni-footer">
          آخر تحديث:
          ${escapeHtml(
            formatDate(
              state.lastRefresh
            )
          )}

          <span>
            التحديث التلقائي:
            ${
              state.autoRefresh
                ? "مفعّل"
                : "متوقف"
            }
          </span>
        </footer>

      </div>
    `;

    injectStyles();
  }

  function metric(
    title,
    value,
    key
  ) {
    return `
      <article
        class="ez-ni-metric"
        data-key="${escapeHtml(
          key
        )}"
      >
        <span>
          ${escapeHtml(title)}
        </span>

        <strong>
          ${escapeHtml(value)}
        </strong>
      </article>
    `;
  }

  function healthCard(
    title,
    healthy,
    data
  ) {
    return `
      <article class="ez-ni-health-card">

        <div>
          <strong>
            ${escapeHtml(title)}
          </strong>

          <span
            class="ez-ni-status ${statusClass(
              healthy
            )}"
          >
            ${statusText(
              healthy
            )}
          </span>
        </div>

        <small>
          ${
            data?.error
              ? escapeHtml(
                  data.error
                )
              : "الاتصال متاح."
          }
        </small>

      </article>
    `;
  }

  function renderRules() {
    const rules =
      state.rules?.rules ||
      [];

    if (
      !rules.length
    ) {
      return `
        <div class="ez-ni-empty">
          لا توجد قواعد متاحة حاليًا.
        </div>
      `;
    }

    return rules
      .slice(0, 12)
      .map(
        (rule) => `
          <button
            type="button"
            class="ez-ni-row"
            data-rule-id="${escapeHtml(
              rule.id
            )}"
          >
            <span>
              ${escapeHtml(
                rule.name ||
                  rule.description ||
                  "قاعدة إشعار"
              )}
            </span>

            <small>
              ${escapeHtml(
                rule.event_type ||
                  "custom"
              )}
            </small>
          </button>
        `
      )
      .join("");
  }

  function renderEvents() {
    const data =
      state.eventsStatistics
        ?.statistics ||
      state.eventsStatistics ||
      {};

    return `
      <div class="ez-ni-event-summary">

        <div>
          <span>الأحداث المستلمة</span>
          <strong>
            ${formatNumber(
              data.eventsReceived ||
                0
            )}
          </strong>
        </div>

        <div>
          <span>المعالجة</span>
          <strong>
            ${formatNumber(
              data.eventsProcessed ||
                0
            )}
          </strong>
        </div>

        <div>
          <span>فشل</span>
          <strong>
            ${formatNumber(
              data.failed ||
                0
            )}
          </strong>
        </div>

        <div>
          <span>تكرار تم منعه</span>
          <strong>
            ${formatNumber(
              data.duplicatesIgnored ||
                0
            )}
          </strong>
        </div>

      </div>
    `;
  }

  /* =======================================================
     Worker Controls
  ======================================================= */

  async function workerAction(
    action
  ) {
    const map = {
      run:
        `${API.worker}/run`,

      start:
        `${API.worker}/start`,

      stop:
        `${API.worker}/stop`,

      restart:
        `${API.worker}/restart`
    };

    const url =
      map[action];

    if (!url) {
      return;
    }

    try {
      logEvent(
        "worker_action",
        {
          action
        }
      );

      await fetchJSON(
        url,
        {
          method:
            "POST"
        }
      );

      await refresh({
        manual: true
      });
    } catch (error) {
      alert(
        error.message ||
          "تعذر تنفيذ أمر Worker"
      );
    }
  }

  /* =======================================================
     Actions
  ======================================================= */

  async function handleAction(
    action
  ) {
    switch (action) {
      case "refresh":
        await refresh({
          manual: true
        });
        break;

      case "worker":
        await workerAction(
          "start"
        );
        break;

      case "run":
        await workerAction(
          "run"
        );
        break;

      case "restart":
        await workerAction(
          "restart"
        );
        break;

      case "stop":
        await workerAction(
          "stop"
        );
        break;

      case "rules":
        await refresh({
          manual: true
        });
        break;

      case "events":
        await refresh({
          manual: true
        });
        break;

      default:
        break;
    }
  }

  /* =======================================================
     Events
  ======================================================= */

  function bindEvents() {
    document.addEventListener(
      "click",
      async (event) => {
        const actionElement =
          event.target.closest(
            "[data-ni-action]"
          );

        if (
          actionElement
        ) {
          await handleAction(
            actionElement.dataset
              .niAction
          );

          return;
        }

        const ruleElement =
          event.target.closest(
            "[data-rule-id]"
          );

        if (
          ruleElement
        ) {
          state.selectedRule =
            ruleElement.dataset
              .ruleId;

          logEvent(
            "rule_selected",
            {
              ruleId:
                state.selectedRule
            }
          );

          window.dispatchEvent(
            new CustomEvent(
              "ezmedia:notification:rule-selected",
              {
                detail: {
                  ruleId:
                    state.selectedRule
                }
              }
            )
          );
        }
      }
    );

    window.addEventListener(
      "ezmedia:notification:created",
      () => {
        refresh({
          manual: false
        });
      }
    );

    window.addEventListener(
      "ezmedia:notification:processed",
      () => {
        refresh({
          manual: false
        });
      }
    );

    window.addEventListener(
      "ezmedia:notification:event",
      () => {
        refresh({
          manual: false
        });
      }
    );

    window.addEventListener(
      "ezmedia:ai:orchestrator:event",
      () => {
        refresh({
          manual: false
        });
      }
    );

    window.addEventListener(
      "ezmedia:breaking:created",
      () => {
        refresh({
          manual: false
        });
      }
    );

    window.addEventListener(
      "ezmedia:live:started",
      () => {
        refresh({
          manual: false
        });
      }
    );
  }

  /* =======================================================
     Auto Refresh
  ======================================================= */

  function startAutoRefresh() {
    stopAutoRefresh();

    if (
      !state.autoRefresh
    ) {
      return;
    }

    state.timer =
      setInterval(
        () => {
          refresh({
            manual: false
          });
        },
        state.refreshInterval
      );
  }

  function stopAutoRefresh() {
    if (
      state.timer
    ) {
      clearInterval(
        state.timer
      );

      state.timer =
        null;
    }
  }

  /* =======================================================
     Styles
  ======================================================= */

  function injectStyles() {
    if (
      document.getElementById(
        "ez-notification-intelligence-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-notification-intelligence-styles";

    style.textContent = `
      .ez-notification-intelligence {
        direction: rtl;
        font-family: inherit;
        color: #17324d;
        width: 100%;
      }

      .ez-ni-shell {
        display: grid;
        gap: 18px;
      }

      .ez-ni-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        padding: 22px;
        border: 1px solid #d9edf9;
        border-radius: 22px;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #eefaff
          );
      }

      .ez-ni-kicker {
        color: #36aee8;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
      }

      .ez-ni-header h2 {
        margin: 5px 0;
        font-size: 26px;
      }

      .ez-ni-header p {
        margin: 0;
        color: #678097;
      }

      .ez-ni-actions,
      .ez-ni-worker-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-ni-actions button,
      .ez-ni-worker-actions button,
      .ez-ni-panel-title button,
      .ez-ni-error button {
        border: 0;
        border-radius: 12px;
        padding: 10px 15px;
        cursor: pointer;
        background: #e8f7ff;
        color: #0877ae;
        font-weight: 700;
      }

      .ez-ni-metrics {
        display: grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
        gap: 12px;
      }

      .ez-ni-metric {
        padding: 18px;
        border: 1px solid #dceef7;
        border-radius: 18px;
        background: #ffffff;
      }

      .ez-ni-metric span {
        display: block;
        color: #71889b;
        font-size: 13px;
      }

      .ez-ni-metric strong {
        display: block;
        margin-top: 8px;
        font-size: 28px;
      }

      .ez-ni-health {
        display: grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );
        gap: 12px;
      }

      .ez-ni-health-card {
        padding: 16px;
        border: 1px solid #dceef7;
        border-radius: 18px;
        background: #ffffff;
      }

      .ez-ni-health-card > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .ez-ni-status {
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-ni-status.healthy {
        background: #e7fbf2;
        color: #14845c;
      }

      .ez-ni-status.danger {
        background: #fff0f0;
        color: #b53b3b;
      }

      .ez-ni-health-card small {
        display: block;
        margin-top: 9px;
        color: #71889b;
      }

      .ez-ni-panels {
        display: grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
        gap: 14px;
      }

      .ez-ni-panel,
      .ez-ni-worker-panel {
        border: 1px solid #dceef7;
        border-radius: 20px;
        background: #ffffff;
        padding: 18px;
      }

      .ez-ni-panel-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-weight: 800;
      }

      .ez-ni-row {
        width: 100%;
        border: 0;
        border-bottom: 1px solid #edf4f8;
        background: transparent;
        padding: 12px 5px;
        display: flex;
        justify-content: space-between;
        text-align: right;
        cursor: pointer;
      }

      .ez-ni-row:hover {
        background: #f5fcff;
      }

      .ez-ni-row small {
        color: #7690a4;
      }

      .ez-ni-empty {
        padding: 20px;
        color: #7890a2;
        text-align: center;
      }

      .ez-ni-event-summary {
        display: grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
        gap: 10px;
      }

      .ez-ni-event-summary > div {
        padding: 14px;
        border-radius: 14px;
        background: #f5fbfe;
      }

      .ez-ni-event-summary span {
        display: block;
        color: #71889b;
        font-size: 12px;
      }

      .ez-ni-event-summary strong {
        display: block;
        margin-top: 5px;
        font-size: 20px;
      }

      .ez-ni-worker-panel {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #f0fbff
          );
      }

      .ez-ni-worker-panel p {
        margin: 5px 0 0;
        color: #71889b;
      }

      .ez-ni-footer {
        display: flex;
        justify-content: space-between;
        color: #8195a5;
        font-size: 12px;
      }

      .ez-ni-loading,
      .ez-ni-error {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 25px;
        border: 1px solid #dceef7;
        border-radius: 20px;
        background: #ffffff;
      }

      .ez-ni-loading span,
      .ez-ni-error span {
        display: block;
        margin-top: 5px;
        color: #71889b;
      }

      .ez-ni-spinner {
        width: 26px;
        height: 26px;
        border: 3px solid #d9f2ff;
        border-top-color: #38afe9;
        border-radius: 50%;
        animation:
          ez-ni-spin .8s linear infinite;
      }

      @keyframes ez-ni-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 900px) {
        .ez-ni-metrics,
        .ez-ni-health,
        .ez-ni-panels {
          grid-template-columns: 1fr 1fr;
        }

        .ez-ni-header,
        .ez-ni-worker-panel {
          align-items: flex-start;
          flex-direction: column;
        }
      }

      @media (max-width: 620px) {
        .ez-ni-metrics,
        .ez-ni-health,
        .ez-ni-panels {
          grid-template-columns: 1fr;
        }

        .ez-ni-footer {
          flex-direction: column;
          gap: 5px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  /* =======================================================
     Initialize
  ======================================================= */

  function init() {
    loadSettings();

    createRoot();

    bindEvents();

    renderLoading();

    refresh({
      manual: true
    });

    startAutoRefresh();

    window.EZMediaAdminNotificationIntelligence =
      {
        state,

        refresh,

        startAutoRefresh,

        stopAutoRefresh,

        workerAction,

        getState:
          () => ({
            ...state
          })
      };

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification:intelligence:ready"
      )
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
