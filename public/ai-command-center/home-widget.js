/**
 * EZ MEDIA 11.0
 * CODE 64
 * AI Command Center — Homepage Integration
 *
 * الوظيفة:
 * - ربط الصفحة الرئيسية بمركز القيادة الذكي
 * - عرض حالة AI
 * - عرض حالة Automation
 * - عرض الخطط النشطة
 * - عرض التنبيهات
 * - عرض الأخبار العاجلة
 * - عرض الاستخدام والإحصائيات
 * - تحديث تلقائي
 * - زر الدخول إلى مركز القيادة
 * - إيقاف/استئناف الخدمات الذكية
 *
 * يعتمد على:
 * CODE 62 — AI Command Center API
 * CODE 63 — AI Command Center Frontend
 */

(() => {
  "use strict";

  const CONFIG = {
    apiBase: "/api/ai/command-center",
    commandCenterUrl: "/ai-command-center/",
    refreshInterval: 15000,
    requestTimeout: 10000,
    widgetId: "ez-ai-command-center-home"
  };

  const state = {
    connected: false,
    loading: false,
    emergencyStopped: false,
    dashboard: null,
    ai: null,
    provider: null,
    orchestrator: null,
    automation: null,
    review: null,
    plans: [],
    alerts: [],
    events: [],
    usage: null,
    summary: null,
    lastUpdate: null,
    error: null
  };

  /* =========================================================
     أدوات عامة
  ========================================================= */

  function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return new Intl.NumberFormat("ar-SA").format(number);
  }

  function formatPercent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0%";
    }

    return `${Math.round(number)}%`;
  }

  function formatDate(value) {
    if (!value) return "غير متوفر";

    try {
      return new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    } catch {
      return "غير متوفر";
    }
  }

  function normalizeStatus(value) {
    if (!value) return "unknown";

    const status = String(value).toLowerCase();

    if (
      status.includes("healthy") ||
      status.includes("online") ||
      status.includes("running") ||
      status.includes("ready") ||
      status.includes("active")
    ) {
      return "healthy";
    }

    if (
      status.includes("warning") ||
      status.includes("degraded") ||
      status.includes("paused")
    ) {
      return "warning";
    }

    if (
      status.includes("error") ||
      status.includes("failed") ||
      status.includes("offline") ||
      status.includes("stopped")
    ) {
      return "danger";
    }

    return "unknown";
  }

  function statusText(value) {
    const status = normalizeStatus(value);

    const map = {
      healthy: "يعمل",
      warning: "يحتاج متابعة",
      danger: "متوقف / خطأ",
      unknown: "غير معروف"
    };

    return map[status] || "غير معروف";
  }

  function statusClass(value) {
    return `ez-status-${normalizeStatus(value)}`;
  }

  function get(obj, paths, fallback = null) {
    for (const path of paths) {
      const parts = path.split(".");
      let current = obj;

      for (const part of parts) {
        if (
          current === null ||
          current === undefined ||
          typeof current !== "object"
        ) {
          current = undefined;
          break;
        }

        current = current[part];
      }

      if (current !== undefined && current !== null) {
        return current;
      }
    }

    return fallback;
  }

  /* =========================================================
     API
  ========================================================= */

  async function apiRequest(endpoint, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, CONFIG.requestTimeout);

    try {
      const response = await fetch(
        `${CONFIG.apiBase}${endpoint}`,
        {
          method: options.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
          },
          body: options.body
            ? JSON.stringify(options.body)
            : undefined,
          signal: controller.signal,
          credentials: "same-origin"
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      let data;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new Error(
          get(data, ["error.message", "message", "error"], `HTTP ${response.status}`)
        );
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  /* =========================================================
     تحميل البيانات
  ========================================================= */

  async function loadEndpoint(endpoint, key) {
    try {
      const data = await apiRequest(endpoint);

      state[key] = data;
      state.connected = true;
      state.error = null;

      return data;
    } catch (error) {
      console.error(
        `[EZ MEDIA] AI Command Center ${endpoint}`,
        error
      );

      state.error = error.message;
      return null;
    }
  }

  async function loadDashboardData() {
    if (state.loading) return;

    state.loading = true;

    try {
      await Promise.all([
        loadEndpoint("/dashboard", "dashboard"),
        loadEndpoint("/ai/status", "ai"),
        loadEndpoint("/provider", "provider"),
        loadEndpoint("/orchestrator", "orchestrator"),
        loadEndpoint("/automation", "automation"),
        loadEndpoint("/human-review", "review"),
        loadEndpoint("/plans/active", "plans"),
        loadEndpoint("/alerts", "alerts"),
        loadEndpoint("/events", "events"),
        loadEndpoint("/usage", "usage"),
        loadEndpoint("/summary", "summary")
      ]);

      state.lastUpdate = new Date();

      render();
    } catch (error) {
      state.connected = false;
      state.error = error.message;

      render();
    } finally {
      state.loading = false;
    }
  }

  /* =========================================================
     استخراج المعلومات
  ========================================================= */

  function aiStatus() {
    return get(
      state.ai,
      [
        "status",
        "data.status",
        "health.status",
        "state"
      ],
      "unknown"
    );
  }

  function providerStatus() {
    return get(
      state.provider,
      [
        "status",
        "data.status",
        "health.status"
      ],
      "unknown"
    );
  }

  function orchestratorStatus() {
    return get(
      state.orchestrator,
      [
        "status",
        "data.status",
        "health.status"
      ],
      "unknown"
    );
  }

  function automationStatus() {
    return get(
      state.automation,
      [
        "status",
        "data.status",
        "health.status",
        "state"
      ],
      "unknown"
    );
  }

  function getActivePlans() {
    const plans =
      get(state.plans, ["plans", "data.plans", "data"], []);

    return Array.isArray(plans) ? plans : [];
  }

  function getAlerts() {
    const alerts =
      get(state.alerts, ["alerts", "data.alerts", "data"], []);

    return Array.isArray(alerts) ? alerts : [];
  }

  function getEvents() {
    const events =
      get(state.events, ["events", "data.events", "data"], []);

    return Array.isArray(events) ? events : [];
  }

  function getUsageValue() {
    return get(
      state.usage,
      [
        "usage.total",
        "data.usage.total",
        "total",
        "usage"
      ],
      0
    );
  }

  function getActiveTasks() {
    return get(
      state.automation,
      [
        "activeTasks",
        "statistics.activeTasks",
        "data.activeTasks",
        "data.statistics.activeTasks"
      ],
      0
    );
  }

  function getPendingReview() {
    return get(
      state.review,
      [
        "pending",
        "count",
        "statistics.pending",
        "data.pending",
        "data.statistics.pending"
      ],
      0
    );
  }

  /* =========================================================
     الإجراءات
  ========================================================= */

  function openCommandCenter() {
    window.location.href = CONFIG.commandCenterUrl;
  }

  async function emergencyStop() {
    const confirmed = window.confirm(
      "هل تريد إيقاف الخدمات الذكية الداخلية مؤقتًا؟"
    );

    if (!confirmed) return;

    try {
      await apiRequest("/emergency-stop", {
        method: "POST"
      });

      state.emergencyStopped = true;

      showToast(
        "تم إرسال أمر الإيقاف الطارئ للخدمات الذكية",
        "success"
      );

      await loadDashboardData();
    } catch (error) {
      showToast(
        `تعذر تنفيذ الإيقاف: ${error.message}`,
        "error"
      );
    }
  }

  async function resumeServices() {
    try {
      await apiRequest("/resume", {
        method: "POST"
      });

      state.emergencyStopped = false;

      showToast(
        "تم إرسال أمر استئناف الخدمات الذكية",
        "success"
      );

      await loadDashboardData();
    } catch (error) {
      showToast(
        `تعذر الاستئناف: ${error.message}`,
        "error"
      );
    }
  }

  /* =========================================================
     الإشعارات
  ========================================================= */

  function showToast(message, type = "info") {
    let container =
      document.getElementById("ez-ai-home-toast-container");

    if (!container) {
      container = document.createElement("div");
      container.id = "ez-ai-home-toast-container";

      document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    toast.className =
      `ez-ai-home-toast ez-ai-home-toast-${type}`;

    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("is-hidden");

      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }

  /* =========================================================
     HTML
  ========================================================= */

  function renderHeader() {
    const ai = aiStatus();
    const automation = automationStatus();

    return `
      <div class="ez-ai-home-header">
        <div class="ez-ai-home-brand">
          <div class="ez-ai-home-icon">
            ✦
          </div>

          <div>
            <div class="ez-ai-home-title">
              مركز القيادة الذكي
            </div>

            <div class="ez-ai-home-subtitle">
              العقل التشغيلي لمنصة EZ MEDIA
            </div>
          </div>
        </div>

        <div class="ez-ai-home-header-actions">
          <div class="ez-ai-live-indicator">
            <span class="ez-ai-live-dot"></span>
            مباشر
          </div>

          <button
            type="button"
            class="ez-ai-open-button"
            data-action="open-command-center"
          >
            فتح مركز القيادة
            <span>↗</span>
          </button>
        </div>
      </div>

      <div class="ez-ai-home-status-row">

        <div class="ez-ai-mini-status">
          <span class="ez-status-dot ${statusClass(ai)}"></span>
          <span>الذكاء الاصطناعي</span>
          <strong>${escapeHTML(statusText(ai))}</strong>
        </div>

        <div class="ez-ai-mini-status">
          <span class="ez-status-dot ${statusClass(automation)}"></span>
          <span>الأتمتة</span>
          <strong>${escapeHTML(statusText(automation))}</strong>
        </div>

        <div class="ez-ai-mini-status">
          <span class="ez-status-dot ${statusClass(providerStatus())}"></span>
          <span>مزود AI</span>
          <strong>${escapeHTML(statusText(providerStatus()))}</strong>
        </div>

        <div class="ez-ai-mini-status">
          <span class="ez-status-dot ${statusClass(orchestratorStatus())}"></span>
          <span>Orchestrator</span>
          <strong>${escapeHTML(statusText(orchestratorStatus()))}</strong>
        </div>

      </div>
    `;
  }

  function renderStats() {
    const activePlans = getActivePlans();

    const alerts = getAlerts();

    return `
      <div class="ez-ai-home-stats">

        <div class="ez-ai-stat-card">
          <div class="ez-ai-stat-icon">✦</div>
          <div>
            <span>خطط AI النشطة</span>
            <strong>${formatNumber(activePlans.length)}</strong>
          </div>
        </div>

        <div class="ez-ai-stat-card">
          <div class="ez-ai-stat-icon">⚙</div>
          <div>
            <span>مهام الأتمتة</span>
            <strong>${formatNumber(getActiveTasks())}</strong>
          </div>
        </div>

        <div class="ez-ai-stat-card">
          <div class="ez-ai-stat-icon">◈</div>
          <div>
            <span>مراجعات بشرية</span>
            <strong>${formatNumber(getPendingReview())}</strong>
          </div>
        </div>

        <div class="ez-ai-stat-card">
          <div class="ez-ai-stat-icon">!</div>
          <div>
            <span>التنبيهات</span>
            <strong>${formatNumber(alerts.length)}</strong>
          </div>
        </div>

        <div class="ez-ai-stat-card">
          <div class="ez-ai-stat-icon">◉</div>
          <div>
            <span>استخدام AI</span>
            <strong>${formatNumber(getUsageValue())}</strong>
          </div>
        </div>

      </div>
    `;
  }

  function renderPlans() {
    const plans = getActivePlans();

    const visiblePlans = plans.slice(0, 5);

    return `
      <section class="ez-ai-home-section">

        <div class="ez-ai-section-title">
          <div>
            <span>الخطط الذكية</span>
            <small>خطط AI الجاري تنفيذها</small>
          </div>

          <button
            type="button"
            class="ez-ai-text-button"
            data-action="open-command-center"
          >
            عرض الكل
          </button>
        </div>

        ${
          visiblePlans.length
            ? `
              <div class="ez-ai-plans">
                ${visiblePlans
                  .map((plan) => {
                    const status =
                      plan.status ||
                      plan.state ||
                      "active";

                    const name =
                      plan.name ||
                      plan.title ||
                      plan.type ||
                      "خطة ذكية";

                    const progress =
                      plan.progress ??
                      plan.percent ??
                      0;

                    return `
                      <div class="ez-ai-plan">

                        <div class="ez-ai-plan-main">
                          <div class="ez-ai-plan-icon">
                            ✦
                          </div>

                          <div>
                            <strong>
                              ${escapeHTML(name)}
                            </strong>

                            <span>
                              ${escapeHTML(statusText(status))}
                            </span>
                          </div>
                        </div>

                        <div class="ez-ai-progress">
                          <div
                            class="ez-ai-progress-bar"
                            style="width:${Math.min(
                              100,
                              Math.max(0, Number(progress) || 0)
                            )}%"
                          ></div>
                        </div>

                        <div class="ez-ai-progress-value">
                          ${formatPercent(progress)}
                        </div>

                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
            : `
              <div class="ez-ai-empty">
                لا توجد خطط AI نشطة حاليًا
              </div>
            `
        }

      </section>
    `;
  }

  function renderAlerts() {
    const alerts = getAlerts().slice(0, 5);

    return `
      <section class="ez-ai-home-section">

        <div class="ez-ai-section-title">
          <div>
            <span>مركز التنبيهات</span>
            <small>آخر الإشعارات المهمة</small>
          </div>
        </div>

        ${
          alerts.length
            ? `
              <div class="ez-ai-alert-list">
                ${alerts
                  .map((alert) => {
                    const severity =
                      alert.severity ||
                      alert.level ||
                      "info";

                    const message =
                      alert.message ||
                      alert.title ||
                      "تنبيه ذكي";

                    return `
                      <div class="ez-ai-alert ez-ai-alert-${escapeHTML(
                        severity
                      )}">
                        <span class="ez-ai-alert-symbol">
                          !
                        </span>

                        <div>
                          <strong>
                            ${escapeHTML(message)}
                          </strong>

                          ${
                            alert.createdAt
                              ? `
                                <small>
                                  ${escapeHTML(
                                    formatDate(alert.createdAt)
                                  )}
                                </small>
                              `
                              : ""
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
            : `
              <div class="ez-ai-empty">
                لا توجد تنبيهات جديدة
              </div>
            `
        }

      </section>
    `;
  }

  function renderEvents() {
    const events = getEvents().slice(0, 6);

    return `
      <section class="ez-ai-home-section">

        <div class="ez-ai-section-title">
          <div>
            <span>النشاط الذكي</span>
            <small>آخر العمليات والأحداث</small>
          </div>
        </div>

        ${
          events.length
            ? `
              <div class="ez-ai-event-list">
                ${events
                  .map((event) => {
                    const type =
                      event.type ||
                      event.name ||
                      "system.event";

                    const timestamp =
                      event.createdAt ||
                      event.timestamp ||
                      event.date;

                    return `
                      <div class="ez-ai-event">

                        <span class="ez-ai-event-dot"></span>

                        <div>
                          <strong>
                            ${escapeHTML(type)}
                          </strong>

                          <small>
                            ${
                              timestamp
                                ? escapeHTML(
                                    formatDate(timestamp)
                                  )
                                : "حدث حديث"
                            }
                          </small>
                        </div>

                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
            : `
              <div class="ez-ai-empty">
                لا توجد أحداث حديثة
              </div>
            `
        }

      </section>
    `;
  }

  function renderControl() {
    const stopped =
      state.emergencyStopped ||
      normalizeStatus(
        get(
          state.dashboard,
          ["status", "system.status"],
          ""
        )
      ) === "danger";

    return `
      <section class="ez-ai-control-panel">

        <div>
          <span class="ez-ai-control-title">
            التحكم الذكي
          </span>

          <small>
            إدارة خدمات الذكاء الاصطناعي والأتمتة
          </small>
        </div>

        <div class="ez-ai-control-actions">

          ${
            stopped
              ? `
                <button
                  type="button"
                  class="ez-ai-control-button ez-ai-resume"
                  data-action="resume"
                >
                  ▶ استئناف الخدمات
                </button>
              `
              : `
                <button
                  type="button"
                  class="ez-ai-control-button ez-ai-stop"
                  data-action="emergency-stop"
                >
                  إيقاف طارئ
                </button>
              `
          }

          <button
            type="button"
            class="ez-ai-control-button ez-ai-command"
            data-action="open-command-center"
          >
            مركز القيادة الكامل
          </button>

        </div>

      </section>
    `;
  }

  function renderFooter() {
    return `
      <div class="ez-ai-home-footer">

        <span>
          آخر تحديث:
          ${
            state.lastUpdate
              ? escapeHTML(formatDate(state.lastUpdate))
              : "جارٍ التحميل..."
          }
        </span>

        <span>
          ${
            state.connected
              ? "● الاتصال بمركز القيادة نشط"
              : "○ الاتصال غير متاح"
          }
        </span>

      </div>
    `;
  }

  function render() {
    const root =
      document.getElementById(CONFIG.widgetId);

    if (!root) return;

    root.innerHTML = `
      <div class="ez-ai-home-widget">

        ${renderHeader()}

        ${
          state.loading && !state.lastUpdate
            ? `
              <div class="ez-ai-loading">
                <div class="ez-ai-loader"></div>
                <span>
                  يتم الاتصال بمركز القيادة الذكي...
                </span>
              </div>
            `
            : ""
        }

        ${renderStats()}

        <div class="ez-ai-home-grid">
          ${renderPlans()}
          ${renderAlerts()}
        </div>

        <div class="ez-ai-home-grid">
          ${renderEvents()}

          <section class="ez-ai-home-section ez-ai-news-preview">
            <div class="ez-ai-section-title">
              <div>
                <span>الأخبار العاجلة</span>
                <small>المعالجة الذكية للأخبار</small>
              </div>
            </div>

            <div class="ez-ai-breaking-box">
              <div class="ez-ai-breaking-icon">
                ⚡
              </div>

              <div>
                <strong>
                  محرك الأخبار الذكي
                </strong>

                <p>
                  يراقب المصادر والأحداث ويحلل الأخبار
                  قبل تمريرها إلى دورة النشر.
                </p>

                <button
                  type="button"
                  class="ez-ai-text-button"
                  data-action="open-command-center"
                >
                  فتح مركز القيادة
                </button>
              </div>
            </div>
          </section>
        </div>

        ${renderControl()}

        ${renderFooter()}

      </div>
    `;

    bindEvents();
  }

  /* =========================================================
     الأحداث
  ========================================================= */

  function bindEvents() {
    const root =
      document.getElementById(CONFIG.widgetId);

    if (!root) return;

    root.querySelectorAll(
      '[data-action="open-command-center"]'
    ).forEach((button) => {
      button.addEventListener("click", openCommandCenter);
    });

    root.querySelectorAll(
      '[data-action="emergency-stop"]'
    ).forEach((button) => {
      button.addEventListener("click", emergencyStop);
    });

    root.querySelectorAll(
      '[data-action="resume"]'
    ).forEach((button) => {
      button.addEventListener("click", resumeServices);
    });
  }

  /* =========================================================
     CSS
  ========================================================= */

  function injectStyles() {
    if (document.getElementById("ez-ai-home-widget-css")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "ez-ai-home-widget-css";

    style.textContent = `
      #${CONFIG.widgetId} {
        width: 100%;
        margin: 0;
        direction: rtl;
        font-family:
          Inter,
          "Noto Sans Arabic",
          "Segoe UI",
          Arial,
          sans-serif;
      }

      .ez-ai-home-widget {
        position: relative;
        width: 100%;
        overflow: hidden;
        border-radius: 28px;
        padding: 24px;
        color: #eaf7ff;
        background:
          radial-gradient(
            circle at 85% 0%,
            rgba(71, 196, 255, .18),
            transparent 32%
          ),
          radial-gradient(
            circle at 0% 100%,
            rgba(42, 151, 255, .12),
            transparent 35%
          ),
          linear-gradient(
            135deg,
            #07111d,
            #0a1726 45%,
            #071522
          );
        border: 1px solid rgba(126, 213, 255, .16);
        box-shadow:
          0 25px 70px rgba(0, 0, 0, .25),
          inset 0 1px 0 rgba(255, 255, 255, .04);
      }

      .ez-ai-home-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 22px;
      }

      .ez-ai-home-brand {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .ez-ai-home-icon {
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        border-radius: 16px;
        color: #dff8ff;
        background:
          linear-gradient(
            135deg,
            rgba(99, 216, 255, .25),
            rgba(41, 144, 255, .08)
          );
        border: 1px solid rgba(110, 220, 255, .25);
        box-shadow:
          0 0 30px rgba(50, 190, 255, .12);
        font-size: 25px;
      }

      .ez-ai-home-title {
        font-size: 21px;
        font-weight: 800;
        letter-spacing: -.3px;
      }

      .ez-ai-home-subtitle {
        margin-top: 4px;
        color: #8caabd;
        font-size: 12px;
      }

      .ez-ai-home-header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .ez-ai-live-indicator {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 9px 12px;
        border-radius: 999px;
        color: #a8eaff;
        background: rgba(59, 194, 255, .08);
        border: 1px solid rgba(59, 194, 255, .13);
        font-size: 12px;
      }

      .ez-ai-live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #52dcff;
        box-shadow: 0 0 12px #52dcff;
        animation: ez-ai-pulse 1.7s infinite;
      }

      .ez-ai-open-button,
      .ez-ai-control-button,
      .ez-ai-text-button {
        cursor: pointer;
        border: 0;
        font-family: inherit;
      }

      .ez-ai-open-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 11px 15px;
        border-radius: 13px;
        color: #03111b;
        font-weight: 800;
        background: linear-gradient(
          135deg,
          #b8f1ff,
          #5dd5ff
        );
        box-shadow:
          0 10px 30px rgba(65, 198, 255, .16);
      }

      .ez-ai-home-status-row {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 18px;
      }

      .ez-ai-mini-status {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        border-radius: 15px;
        background: rgba(255, 255, 255, .025);
        border: 1px solid rgba(255, 255, 255, .06);
        font-size: 11px;
        color: #8da9ba;
      }

      .ez-ai-mini-status strong {
        color: #dceefa;
        font-size: 11px;
      }

      .ez-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }

      .ez-status-healthy {
        background: #58e3b0;
        box-shadow: 0 0 12px rgba(88, 227, 176, .6);
      }

      .ez-status-warning {
        background: #ffd166;
        box-shadow: 0 0 12px rgba(255, 209, 102, .45);
      }

      .ez-status-danger {
        background: #ff6b81;
        box-shadow: 0 0 12px rgba(255, 107, 129, .45);
      }

      .ez-status-unknown {
        background: #7f9bad;
      }

      .ez-ai-home-stats {
        display: grid;
        grid-template-columns:
          repeat(5, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }

      .ez-ai-stat-card {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 86px;
        padding: 15px;
        border-radius: 17px;
        background: rgba(255, 255, 255, .035);
        border: 1px solid rgba(255, 255, 255, .06);
      }

      .ez-ai-stat-icon {
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        color: #83e7ff;
        background: rgba(83, 215, 255, .09);
        border: 1px solid rgba(83, 215, 255, .1);
      }

      .ez-ai-stat-card span {
        display: block;
        color: #7895a8;
        font-size: 10px;
        margin-bottom: 4px;
      }

      .ez-ai-stat-card strong {
        display: block;
        color: #effaff;
        font-size: 20px;
        font-weight: 850;
      }

      .ez-ai-home-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }

      .ez-ai-home-section {
        min-width: 0;
        padding: 18px;
        border-radius: 19px;
        background: rgba(255, 255, 255, .026);
        border: 1px solid rgba(255, 255, 255, .055);
      }

      .ez-ai-section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 15px;
      }

      .ez-ai-section-title span {
        display: block;
        color: #eaf8ff;
        font-size: 15px;
        font-weight: 800;
      }

      .ez-ai-section-title small {
        display: block;
        margin-top: 3px;
        color: #718b9d;
        font-size: 10px;
      }

      .ez-ai-text-button {
        padding: 7px 10px;
        border-radius: 9px;
        color: #79dcff;
        background: rgba(66, 202, 255, .07);
        font-size: 11px;
      }

      .ez-ai-plans {
        display: grid;
        gap: 9px;
      }

      .ez-ai-plan {
        display: grid;
        grid-template-columns: 1fr 130px 45px;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: 12px;
        background: rgba(255, 255, 255, .025);
      }

      .ez-ai-plan-main {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
      }

      .ez-ai-plan-icon {
        width: 31px;
        height: 31px;
        flex: 0 0 31px;
        display: grid;
        place-items: center;
        border-radius: 9px;
        color: #7ce5ff;
        background: rgba(80, 214, 255, .08);
      }

      .ez-ai-plan-main strong {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #dff4ff;
        font-size: 11px;
      }

      .ez-ai-plan-main span {
        display: block;
        margin-top: 2px;
        color: #718b9d;
        font-size: 9px;
      }

      .ez-ai-progress {
        height: 5px;
        overflow: hidden;
        border-radius: 99px;
        background: rgba(255, 255, 255, .06);
      }

      .ez-ai-progress-bar {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(
          90deg,
          #4ed8ff,
          #9cecff
        );
        transition: width .4s ease;
      }

      .ez-ai-progress-value {
        color: #9eeaff;
        font-size: 10px;
        text-align: left;
        direction: ltr;
      }

      .ez-ai-alert-list,
      .ez-ai-event-list {
        display: grid;
        gap: 8px;
      }

      .ez-ai-alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px;
        border-radius: 12px;
        background: rgba(255, 255, 255, .025);
        border: 1px solid rgba(255, 255, 255, .045);
      }

      .ez-ai-alert-symbol {
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        flex: 0 0 30px;
        border-radius: 9px;
        color: #ffda7d;
        background: rgba(255, 207, 90, .08);
      }

      .ez-ai-alert strong {
        display: block;
        color: #e3f5ff;
        font-size: 11px;
      }

      .ez-ai-alert small {
        display: block;
        margin-top: 3px;
        color: #688397;
        font-size: 9px;
      }

      .ez-ai-event {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 10px;
        border-radius: 11px;
        background: rgba(255, 255, 255, .02);
      }

      .ez-ai-event-dot {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: #65dcff;
        box-shadow: 0 0 10px rgba(101, 220, 255, .6);
      }

      .ez-ai-event strong {
        display: block;
        color: #d8effa;
        font-size: 10px;
      }

      .ez-ai-event small {
        display: block;
        margin-top: 2px;
        color: #637e91;
        font-size: 9px;
      }

      .ez-ai-breaking-box {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 15px;
        border-radius: 15px;
        background:
          linear-gradient(
            135deg,
            rgba(75, 208, 255, .08),
            rgba(255, 255, 255, .018)
          );
        border: 1px solid rgba(76, 208, 255, .1);
      }

      .ez-ai-breaking-icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        flex: 0 0 42px;
        border-radius: 13px;
        color: #b6f2ff;
        background: rgba(72, 208, 255, .1);
      }

      .ez-ai-breaking-box strong {
        display: block;
        color: #e9f9ff;
        font-size: 13px;
      }

      .ez-ai-breaking-box p {
        margin: 7px 0;
        color: #7e9aaa;
        font-size: 10px;
        line-height: 1.7;
      }

      .ez-ai-control-panel {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        padding: 17px;
        margin-top: 4px;
        border-radius: 17px;
        background:
          linear-gradient(
            135deg,
            rgba(85, 207, 255, .075),
            rgba(255, 255, 255, .018)
          );
        border: 1px solid rgba(85, 207, 255, .09);
      }

      .ez-ai-control-title {
        display: block;
        color: #e7f8ff;
        font-weight: 800;
        font-size: 13px;
      }

      .ez-ai-control-panel small {
        display: block;
        margin-top: 4px;
        color: #718d9f;
        font-size: 9px;
      }

      .ez-ai-control-actions {
        display: flex;
        gap: 8px;
      }

      .ez-ai-control-button {
        padding: 10px 13px;
        border-radius: 11px;
        font-size: 10px;
        font-weight: 800;
      }

      .ez-ai-stop {
        color: #ffdce1;
        background: rgba(255, 93, 117, .11);
        border: 1px solid rgba(255, 93, 117, .18);
      }

      .ez-ai-resume {
        color: #d9fff1;
        background: rgba(69, 221, 171, .1);
        border: 1px solid rgba(69, 221, 171, .17);
      }

      .ez-ai-command {
        color: #d8f7ff;
        background: rgba(75, 210, 255, .1);
        border: 1px solid rgba(75, 210, 255, .15);
      }

      .ez-ai-empty {
        padding: 22px 10px;
        text-align: center;
        color: #668194;
        font-size: 11px;
      }

      .ez-ai-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 20px;
        color: #88a7b8;
        font-size: 11px;
      }

      .ez-ai-loader {
        width: 17px;
        height: 17px;
        border: 2px solid rgba(93, 213, 255, .15);
        border-top-color: #62dcff;
        border-radius: 50%;
        animation: ez-ai-spin .8s linear infinite;
      }

      .ez-ai-home-footer {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 15px;
        padding: 0 4px;
        color: #5f7a8d;
        font-size: 9px;
      }

      #ez-ai-home-toast-container {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 999999;
        display: grid;
        gap: 8px;
      }

      .ez-ai-home-toast {
        max-width: 340px;
        padding: 12px 15px;
        border-radius: 12px;
        color: #eafaff;
        background: #102333;
        border: 1px solid rgba(100, 220, 255, .16);
        box-shadow: 0 20px 50px rgba(0, 0, 0, .25);
        font-size: 11px;
        transition: opacity .3s ease, transform .3s ease;
      }

      .ez-ai-home-toast-success {
        border-color: rgba(75, 225, 175, .25);
      }

      .ez-ai-home-toast-error {
        border-color: rgba(255, 100, 120, .25);
      }

      .ez-ai-home-toast.is-hidden {
        opacity: 0;
        transform: translateY(10px);
      }

      @keyframes ez-ai-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes ez-ai-pulse {
        50% {
          opacity: .35;
          transform: scale(.75);
        }
      }

      @media (max-width: 1100px) {
        .ez-ai-home-stats {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }

        .ez-ai-home-status-row {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 800px) {
        .ez-ai-home-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .ez-ai-home-header-actions {
          width: 100%;
          justify-content: space-between;
        }

        .ez-ai-home-grid {
          grid-template-columns: 1fr;
        }

        .ez-ai-home-stats {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-ai-control-panel {
          align-items: flex-start;
          flex-direction: column;
        }

        .ez-ai-control-actions {
          width: 100%;
        }

        .ez-ai-control-button {
          flex: 1;
        }
      }

      @media (max-width: 520px) {
        .ez-ai-home-widget {
          padding: 14px;
          border-radius: 20px;
        }

        .ez-ai-home-status-row {
          grid-template-columns: 1fr;
        }

        .ez-ai-home-stats {
          grid-template-columns: 1fr 1fr;
        }

        .ez-ai-open-button {
          padding: 10px 11px;
        }

        .ez-ai-live-indicator {
          display: none;
        }

        .ez-ai-plan {
          grid-template-columns: 1fr;
        }

        .ez-ai-progress-value {
          text-align: right;
        }

        .ez-ai-home-footer {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     إنشاء الودجت
  ========================================================= */

  function createWidget() {
    let root =
      document.getElementById(CONFIG.widgetId);

    if (root) return root;

    /*
     * إذا كان لديك عنصر مخصص:
     *
     * <div id="ez-ai-command-center-home"></div>
     *
     * سيستخدمه الكود مباشرة.
     */

    root = document.createElement("section");

    root.id = CONFIG.widgetId;

    /*
     * نحاول وضعه قبل محتوى الصفحة الرئيسي
     * إذا وُجدت العناصر القياسية.
     */

    const candidates = [
      "[data-ez-home-content]",
      "#home-content",
      "#main-content",
      "main",
      ".main-content",
      "body"
    ];

    let target = null;

    for (const selector of candidates) {
      target = document.querySelector(selector);

      if (target) break;
    }

    if (!target) return null;

    if (target === document.body) {
      target.prepend(root);
    } else {
      target.prepend(root);
    }

    return root;
  }

  /* =========================================================
     التشغيل
  ========================================================= */

  async function init() {
    injectStyles();

    const root = createWidget();

    if (!root) {
      console.warn(
        "[EZ MEDIA] لم يتم العثور على نقطة إدراج الواجهة الرئيسية."
      );

      return;
    }

    render();

    await loadDashboardData();

    setInterval(
      loadDashboardData,
      CONFIG.refreshInterval
    );
  }

  /*
   * API عامة للاستخدام من الصفحة الرئيسية
   */

  window.EZMediaAICommandCenter = {
    init,
    refresh: loadDashboardData,
    open: openCommandCenter,
    emergencyStop,
    resume: resumeServices,
    getState: () => ({
      ...state
    })
  };

  if (
    document.readyState === "loading"
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
