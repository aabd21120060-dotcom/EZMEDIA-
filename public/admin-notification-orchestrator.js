"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 37
 * الملف: public/admin-notification-orchestrator.js
 *
 * محرك الإشعارات الذكي الموحد
 *
 * الوظائف:
 * - إنشاء الإشعارات.
 * - تصنيفها حسب المجال.
 * - تحديد مستوى الأولوية.
 * - توجيه الإشعار حسب شريحة الجمهور.
 * - إدارة القنوات.
 * - منع التكرار.
 * - طابور الإشعارات.
 * - سجل العمليات.
 * - الإشعارات الفورية داخل المنصة.
 *
 * ملاحظة:
 * الإرسال الحقيقي إلى البريد وSMS وPush
 * والمنصات الخارجية يحتاج Backend Provider
 * وبيانات اعتماد رسمية. هذه الوحدة لا تدعي
 * إرسالًا خارجيًا غير متصل فعليًا.
 */

(function () {
  "use strict";

  const MODULE =
    "notification-orchestrator";

  const STORAGE_KEY =
    "ezmedia_notification_orchestrator_v1";

  const SETTINGS_KEY =
    "ezmedia_notification_orchestrator_settings_v1";

  const EVENTS_KEY =
    "ezmedia_notification_orchestrator_events_v1";

  const MAX_EVENTS = 500;
  const MAX_QUEUE = 1000;

  const TYPES = {
    breaking: "عاجل",
    newsroom: "غرفة الأخبار",
    content: "المحتوى",
    live: "البث المباشر",
    ai: "الذكاء الاصطناعي",
    audience: "الجمهور",
    commercial: "الإعلانات والرعايات",
    security: "الأمان",
    system: "النظام",
    media: "الوسائط",
    social: "التواصل الاجتماعي"
  };

  const PRIORITIES = {
    low: "منخفض",
    normal: "عادي",
    high: "مرتفع",
    urgent: "عاجل",
    critical: "حرج"
  };

  const CHANNELS = {
    inApp: "داخل المنصة",
    push: "Push",
    email: "البريد الإلكتروني",
    sms: "SMS",
    social: "التواصل الاجتماعي",
    dashboard: "لوحة الإدارة"
  };

  const STATUSES = {
    queued: "في الانتظار",
    preparing: "قيد التجهيز",
    sent: "تم الإرسال",
    delivered: "تم التسليم",
    failed: "فشل",
    cancelled: "ملغى",
    draft: "مسودة"
  };

  const DEFAULT_SETTINGS = {
    enabled: true,

    inAppEnabled: true,

    pushEnabled: false,

    emailEnabled: false,

    smsEnabled: false,

    socialEnabled: false,

    dashboardEnabled: true,

    requireApprovalForExternal: true,

    deduplicate: true,

    deduplicateWindowMinutes: 30,

    maxQueue: MAX_QUEUE,

    maxHistory: 500,

    autoBreaking: true,

    autoLive: true,

    autoAI: true,

    autoCommercial: true,

    quietHoursEnabled: false,

    quietStart: "23:00",

    quietEnd: "07:00"
  };

  const state = {
    notifications: [],
    queue: [],
    rules: [],
    events: [],
    settings: {},
    activeTab: "dashboard",
    search: ""
  };

  function uid(prefix = "notification") {
    if (
      typeof crypto !== "undefined" &&
      crypto.randomUUID
    ) {
      return (
        prefix +
        "-" +
        crypto.randomUUID()
      );
    }

    return (
      prefix +
      "-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }

  function now() {
    return new Date().toISOString();
  }

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeSettings(settings = {}) {
    return {
      ...clone(DEFAULT_SETTINGS),
      ...(settings || {})
    };
  }

  function normalizeNotification(item = {}) {
    return {
      id:
        item.id ||
        uid("notification"),

      title:
        item.title ||
        "إشعار EZ MEDIA",

      message:
        item.message ||
        "",

      type:
        item.type ||
        "system",

      priority:
        item.priority ||
        "normal",

      status:
        item.status ||
        "queued",

      channels:
        Array.isArray(item.channels)
          ? item.channels
          : ["inApp"],

      audienceSegmentId:
        item.audienceSegmentId ||
        "",

      audienceSegmentName:
        item.audienceSegmentName ||
        "الجميع",

      contentId:
        item.contentId ||
        "",

      source:
        item.source ||
        MODULE,

      sourceEvent:
        item.sourceEvent ||
        "",

      dedupeKey:
        item.dedupeKey ||
        "",

      scheduledAt:
        item.scheduledAt ||
        null,

      sentAt:
        item.sentAt ||
        null,

      read:
        Boolean(item.read),

      createdAt:
        item.createdAt ||
        now(),

      updatedAt:
        item.updatedAt ||
        now(),

      attempts:
        Number(item.attempts || 0),

      error:
        item.error ||
        ""
    };
  }

  function normalizeRule(rule = {}) {
    return {
      id:
        rule.id ||
        uid("notification-rule"),

      name:
        rule.name ||
        "قاعدة إشعار",

      event:
        rule.event ||
        "manual",

      type:
        rule.type ||
        "system",

      priority:
        rule.priority ||
        "normal",

      channels:
        Array.isArray(rule.channels)
          ? rule.channels
          : ["inApp"],

      enabled:
        rule.enabled !== false,

      requireApproval:
        rule.requireApproval !== false,

      createdAt:
        rule.createdAt ||
        now(),

      updatedAt:
        rule.updatedAt ||
        now()
    };
  }

  function load() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "{}"
        );

      const settings =
        JSON.parse(
          localStorage.getItem(
            SETTINGS_KEY
          ) ||
            JSON.stringify(
              DEFAULT_SETTINGS
            )
        );

      const events =
        JSON.parse(
          localStorage.getItem(
            EVENTS_KEY
          ) || "[]"
        );

      state.notifications =
        Array.isArray(
          saved.notifications
        )
          ? saved.notifications.map(
              normalizeNotification
            )
          : [];

      state.queue =
        Array.isArray(
          saved.queue
        )
          ? saved.queue.map(
              normalizeNotification
            )
          : [];

      state.rules =
        Array.isArray(
          saved.rules
        )
          ? saved.rules.map(
              normalizeRule
            )
          : [];

      state.settings =
        normalizeSettings(
          settings
        );

      state.events =
        Array.isArray(events)
          ? events
          : [];
    } catch (error) {
      console.warn(
        "Notification orchestrator load error:",
        error
      );

      state.notifications = [];
      state.queue = [];
      state.rules = [];
      state.events = [];
      state.settings =
        clone(
          DEFAULT_SETTINGS
        );
    }
  }

  function save() {
    state.notifications =
      state.notifications.slice(
        -Number(
          state.settings
            .maxHistory || 500
        )
      );

    state.queue =
      state.queue.slice(
        -Number(
          state.settings
            .maxQueue || MAX_QUEUE
        )
      );

    state.events =
      state.events.slice(
        -MAX_EVENTS
      );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        notifications:
          state.notifications,
        queue:
          state.queue,
        rules:
          state.rules
      })
    );

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(
        state.settings
      )
    );

    localStorage.setItem(
      EVENTS_KEY,
      JSON.stringify(
        state.events
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification:orchestrator:updated",
        {
          detail: getStatus()
        }
      )
    );
  }

  function addEvent(
    type,
    message,
    data = {}
  ) {
    const event = {
      id:
        uid("event"),

      type,

      message,

      data:
        clone(data),

      createdAt:
        now()
    };

    state.events.push(
      event
    );

    state.events =
      state.events.slice(
        -MAX_EVENTS
      );

    save();

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification:orchestrator:event",
        {
          detail:
            clone(event)
        }
      )
    );

    return event;
  }

  function notify(message, type = "info") {
    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification",
        {
          detail: {
            module:
              MODULE,

            type,

            title:
              "محرك الإشعارات",

            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-notification-orchestrator-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-notification-orchestrator-toast";

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    toast.classList.add(
      "show"
    );

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(
        () => {
          toast.classList.remove(
            "show"
          );
        },
        3200
      );
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-notification-orchestrator-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-notification-orchestrator-styles";

    style.textContent = `
      #notification-orchestrator-section {
        direction:rtl;
        padding:22px;
        color:#17384f;
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
      }

      .ez-notify-shell {
        max-width:1600px;
        margin:auto;
      }

      .ez-notify-header {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:18px;
        padding:24px;
        border-radius:26px;
        border:1px solid #d7edf4;
        background:
          linear-gradient(
            135deg,
            #eafaff,
            #ffffff
          );
      }

      .ez-notify-header h2 {
        margin:0 0 7px;
        font-size:29px;
      }

      .ez-notify-header p {
        margin:0;
        color:#718997;
        line-height:1.8;
      }

      .ez-notify-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .ez-notify-btn {
        border:0;
        border-radius:12px;
        padding:11px 15px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-notify-btn.primary {
        background:#42c4e8;
        color:#fff;
      }

      .ez-notify-btn.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-notify-metrics {
        display:grid;
        grid-template-columns:
          repeat(6,minmax(0,1fr));
        gap:10px;
        margin:18px 0;
      }

      .ez-notify-metric {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:17px;
        padding:15px;
      }

      .ez-notify-metric span {
        display:block;
        color:#718998;
        font-size:11px;
        margin-bottom:6px;
      }

      .ez-notify-metric strong {
        font-size:22px;
      }

      .ez-notify-tabs {
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-bottom:16px;
      }

      .ez-notify-tab {
        border:0;
        border-radius:11px;
        padding:10px 14px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-notify-tab.active {
        background:#42c4e8;
        color:#fff;
      }

      .ez-notify-toolbar {
        display:grid;
        grid-template-columns:
          minmax(240px,1fr)
          180px
          auto;
        gap:8px;
        margin-bottom:16px;
      }

      .ez-notify-input,
      .ez-notify-select,
      .ez-notify-textarea {
        width:100%;
        box-sizing:border-box;
        border:1px solid #dbeaf0;
        border-radius:12px;
        padding:12px 13px;
        background:#fff;
        color:#17384f;
        outline:none;
      }

      .ez-notify-textarea {
        min-height:130px;
        resize:vertical;
      }

      .ez-notify-input:focus,
      .ez-notify-select:focus,
      .ez-notify-textarea:focus {
        border-color:#4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-notify-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:14px;
      }

      .ez-notify-card {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:20px;
        padding:18px;
      }

      .ez-notify-card h3 {
        margin:0 0 7px;
      }

      .ez-notify-card p {
        color:#718997;
        line-height:1.8;
        font-size:12px;
      }

      .ez-notify-badges {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin:9px 0;
      }

      .ez-notify-badge {
        display:inline-flex;
        border-radius:999px;
        padding:5px 9px;
        background:#edf8fc;
        color:#176984;
        font-size:10px;
        font-weight:850;
      }

      .ez-notify-badge.success {
        background:#eefaf5;
        color:#267255;
      }

      .ez-notify-badge.warning {
        background:#fff8e8;
        color:#8b671a;
      }

      .ez-notify-badge.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-notify-badge.critical {
        background:#f9e9ed;
        color:#8c1937;
      }

      .ez-notify-form {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:13px;
      }

      .ez-notify-field {
        display:flex;
        flex-direction:column;
        gap:6px;
      }

      .ez-notify-field.full {
        grid-column:1/-1;
      }

      .ez-notify-field label {
        font-size:12px;
        font-weight:800;
        color:#57717f;
      }

      .ez-notify-checks {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .ez-notify-check {
        display:flex;
        align-items:center;
        gap:8px;
        padding:12px;
        border-radius:12px;
        background:#f7fbfd;
        border:1px solid #e2eef2;
      }

      .ez-notify-modal {
        position:fixed;
        inset:0;
        z-index:99999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:
          rgba(12,58,76,.27);
        backdrop-filter:blur(7px);
      }

      .ez-notify-modal.open {
        display:flex;
      }

      .ez-notify-dialog {
        width:min(900px,100%);
        max-height:94vh;
        overflow:auto;
        background:#fff;
        border-radius:24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-notify-dialog-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:18px 21px;
        border-bottom:1px solid #e4eff3;
      }

      .ez-notify-dialog-body {
        padding:21px;
      }

      .ez-notify-dialog-footer {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        padding:15px 21px;
        border-top:1px solid #e4eff3;
      }

      .ez-notify-log {
        max-height:430px;
        overflow:auto;
      }

      .ez-notify-log-item {
        padding:13px;
        margin-bottom:8px;
        border-radius:13px;
        background:#f8fcfd;
        border:1px solid #e4eef2;
      }

      .ez-notify-log-item strong {
        display:block;
        margin-bottom:4px;
      }

      .ez-notify-log-item span {
        color:#8196a0;
        font-size:10px;
      }

      #ez-notification-orchestrator-toast {
        position:fixed;
        left:20px;
        bottom:20px;
        z-index:100001;
        padding:13px 17px;
        border-radius:13px;
        background:#173f55;
        color:#fff;
        opacity:0;
        transform:translateY(10px);
        pointer-events:none;
        transition:.2s ease;
      }

      #ez-notification-orchestrator-toast.show {
        opacity:1;
        transform:translateY(0);
      }

      @media(max-width:1200px) {
        .ez-notify-metrics {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }

        .ez-notify-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:750px) {
        #notification-orchestrator-section {
          padding:12px;
        }

        .ez-notify-header {
          display:block;
        }

        .ez-notify-actions {
          margin-top:15px;
        }

        .ez-notify-metrics,
        .ez-notify-grid,
        .ez-notify-form,
        .ez-notify-checks {
          grid-template-columns:1fr;
        }

        .ez-notify-field.full {
          grid-column:auto;
        }

        .ez-notify-toolbar {
          grid-template-columns:1fr;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function ensureSection() {
    let section =
      document.querySelector(
        "#notification-orchestrator-section"
      );

    if (section) {
      return section;
    }

    const parent =
      document.querySelector(
        "main"
      ) ||
      document.body;

    section =
      document.createElement(
        "section"
      );

    section.id =
      "notification-orchestrator-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function getMetrics() {
    return {
      total:
        state.notifications
          .length,

      queued:
        state.queue.filter(
          (item) =>
            item.status ===
              "queued" ||
            item.status ===
              "preparing"
        ).length,

      sent:
        state.notifications.filter(
          (item) =>
            item.status ===
              "sent" ||
            item.status ===
              "delivered"
        ).length,

      unread:
        state.notifications.filter(
          (item) =>
            !item.read
        ).length,

      urgent:
        state.notifications.filter(
          (item) =>
            item.priority ===
              "urgent" ||
            item.priority ===
              "critical"
        ).length,

      rules:
        state.rules.length
    };
  }

  function render() {
    const section =
      ensureSection();

    const metrics =
      getMetrics();

    section.innerHTML = `
      <div
        class="ez-notify-shell"
      >

        <div
          class="ez-notify-header"
        >

          <div>
            <h2>
              محرك الإشعارات الذكي
            </h2>

            <p>
              مركز موحد لصناعة الإشعارات وتحديد
              أولويتها وقنواتها وتوجيهها للجمهور المناسب.
            </p>
          </div>

          <div
            class="ez-notify-actions"
          >

            <button
              class="
                ez-notify-btn
                primary
              "
              data-notify-action="new"
            >
              + إشعار جديد
            </button>

            <button
              class="ez-notify-btn"
              data-notify-action="process"
            >
              معالجة الطابور
            </button>

            <button
              class="ez-notify-btn"
              data-notify-action="refresh"
            >
              تحديث
            </button>

          </div>

        </div>

        <div
          class="ez-notify-metrics"
        >

          ${metric(
            "كل الإشعارات",
            metrics.total
          )}

          ${metric(
            "في الطابور",
            metrics.queued
          )}

          ${metric(
            "تم إرسالها",
            metrics.sent
          )}

          ${metric(
            "غير مقروءة",
            metrics.unread
          )}

          ${metric(
            "عاجلة",
            metrics.urgent
          )}

          ${metric(
            "القواعد",
            metrics.rules
          )}

        </div>

        <div
          class="ez-notify-tabs"
        >

          ${tab(
            "dashboard",
            "الرئيسية"
          )}

          ${tab(
            "queue",
            "الطابور"
          )}

          ${tab(
            "notifications",
            "الإشعارات"
          )}

          ${tab(
            "rules",
            "القواعد"
          )}

          ${tab(
            "settings",
            "الإعدادات"
          )}

          ${tab(
            "events",
            "السجل"
          )}

        </div>

        ${
          state.activeTab ===
          "dashboard"
            ? renderDashboard()
            : state.activeTab ===
              "queue"
            ? renderQueue()
            : state.activeTab ===
              "notifications"
            ? renderNotifications()
            : state.activeTab ===
              "rules"
            ? renderRules()
            : state.activeTab ===
              "settings"
            ? renderSettings()
            : renderEvents()
        }

      </div>

      <div
        id="ez-notification-orchestrator-modal"
        class="ez-notify-modal"
        aria-hidden="true"
      ></div>
    `;

    bindEvents();
  }

  function metric(
    label,
    value
  ) {
    return `
      <div
        class="ez-notify-metric"
      >
        <span>
          ${escapeHtml(
            label
          )}
        </span>

        <strong>
          ${Number(
            value || 0
          ).toLocaleString(
            "ar-SA"
          )}
        </strong>
      </div>
    `;
  }

  function tab(
    key,
    label
  ) {
    return `
      <button
        class="
          ez-notify-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-notify-tab="${escapeHtml(
          key
        )}"
      >
        ${escapeHtml(
          label
        )}
      </button>
    `;
  }

  function renderDashboard() {
    const recent =
      [...state.notifications]
        .reverse()
        .slice(0, 8);

    return `
      <div
        class="ez-notify-grid"
      >

        <div
          class="ez-notify-card"
        >
          <h3>
            التوجيه الذكي
          </h3>

          <p>
            يحدد المحرك نوع الإشعار وأولويته
            والقنوات المناسبة قبل دخوله إلى الطابور.
          </p>

          <div
            class="ez-notify-badges"
          >
            <span
              class="
                ez-notify-badge
                success
              "
            >
              ${
                state.settings.enabled
                  ? "المحرك نشط"
                  : "المحرك متوقف"
              }
            </span>
          </div>
        </div>

        <div
          class="ez-notify-card"
        >
          <h3>
            الإشعارات العاجلة
          </h3>

          <p>
            الأخبار العاجلة والحرجة تحصل على
            أولوية أعلى داخل منظومة الإشعارات.
          </p>

          <div
            class="ez-notify-badges"
          >
            <span
              class="
                ez-notify-badge
                danger
              "
            >
              عاجل
            </span>

            <span
              class="
                ez-notify-badge
                critical
              "
            >
              حرج
            </span>
          </div>
        </div>

        <div
          class="ez-notify-card"
        >
          <h3>
            القنوات الخارجية
          </h3>

          <p>
            Push والبريد وSMS والتواصل الاجتماعي
            تبقى غير مفعلة حتى ربط مزوداتها الرسمية.
          </p>

          <div
            class="ez-notify-badges"
          >
            <span
              class="ez-notify-badge"
            >
              داخل المنصة
            </span>

            <span
              class="ez-notify-badge warning"
            >
              تحتاج ربط Backend
            </span>
          </div>
        </div>

      </div>

      <div
        class="ez-notify-card"
        style="margin-top:14px"
      >

        <h3>
          آخر الإشعارات
        </h3>

        ${
          recent.length
            ? recent
                .map(
                  renderNotification
                )
                .join("")
            : `
              <div
                style="
                  text-align:center;
                  padding:40px;
                  color:#718997;
                "
              >
                لا توجد إشعارات حتى الآن.
              </div>
            `
        }

      </div>
    `;
  }

  function renderQueue() {
    const queue =
      state.queue;

    return `
      <div
        class="ez-notify-toolbar"
      >

        <input
          id="ez-notify-search"
          class="ez-notify-input"
          placeholder="ابحث في الطابور..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-notify-queue-status"
          class="ez-notify-select"
        >

          <option value="all">
            كل الحالات
          </option>

          ${Object.entries(
            STATUSES
          )
            .map(
              ([key, label]) => `
                <option
                  value="${escapeHtml(
                    key
                  )}"
                >
                  ${escapeHtml(
                    label
                  )}
                </option>
              `
            )
            .join("")}

        </select>

        <button
          class="
            ez-notify-btn
            primary
          "
          data-notify-action="process"
        >
          معالجة
        </button>

      </div>

      <div
        class="ez-notify-grid"
      >

        ${
          queue.length
            ? queue
                .filter(
                  queueFilter
                )
                .map(
                  renderNotification
                )
                .join("")
            : `
              <div
                class="ez-notify-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                الطابور فارغ.
              </div>
            `
        }

      </div>
    `;
  }

  function queueFilter(item) {
    const query =
      state.search
        .trim()
        .toLowerCase();

    if (!query) {
      return true;
    }

    return [
      item.title,
      item.message,
      item.type,
      item.priority,
      item.audienceSegmentName
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function renderNotifications() {
    const items =
      [...state.notifications]
        .reverse();

    return `
      <div
        class="ez-notify-toolbar"
      >

        <input
          id="ez-notify-search"
          class="ez-notify-input"
          placeholder="ابحث في الإشعارات..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-notify-type"
          class="ez-notify-select"
        >

          <option value="all">
            كل الأنواع
          </option>

          ${Object.entries(
            TYPES
          )
            .map(
              ([key, label]) => `
                <option
                  value="${escapeHtml(
                    key
                  )}"
                >
                  ${escapeHtml(
                    label
                  )}
                </option>
              `
            )
            .join("")}

        </select>

        <button
          class="ez-notify-btn"
          data-notify-action="mark-all-read"
        >
          تحديد الكل كمقروء
        </button>

      </div>

      <div
        class="ez-notify-grid"
      >

        ${
          items.length
            ? items
                .filter(
                  notificationFilter
                )
                .map(
                  renderNotification
                )
                .join("")
            : `
              <div
                class="ez-notify-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد إشعارات.
              </div>
            `
        }

      </div>
    `;
  }

  function notificationFilter(item) {
    const query =
      state.search
        .trim()
        .toLowerCase();

    if (!query) {
      return true;
    }

    return [
      item.title,
      item.message,
      item.type,
      item.priority,
      item.audienceSegmentName
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function renderNotification(item) {
    const priorityClass =
      item.priority ===
      "critical"
        ? "critical"
        : item.priority ===
            "urgent"
          ? "danger"
          : item.priority ===
              "high"
            ? "warning"
            : item.status ===
                "sent" ||
              item.status ===
                "delivered"
              ? "success"
              : "";

    return `
      <article
        class="ez-notify-card"
      >

        <h3>
          ${escapeHtml(
            item.title
          )}
        </h3>

        <p>
          ${escapeHtml(
            item.message
          )}
        </p>

        <div
          class="ez-notify-badges"
        >

          <span
            class="ez-notify-badge"
          >
            ${
              TYPES[
                item.type
              ] ||
              escapeHtml(
                item.type
              )
            }
          </span>

          <span
            class="
              ez-notify-badge
              ${priorityClass}
            "
          >
            ${
              PRIORITIES[
                item.priority
              ] ||
              escapeHtml(
                item.priority
              )
            }
          </span>

          <span
            class="
              ez-notify-badge
              ${
                item.status ===
                  "sent" ||
                item.status ===
                  "delivered"
                  ? "success"
                  : ""
              }
            "
          >
            ${
              STATUSES[
                item.status
              ] ||
              escapeHtml(
                item.status
              )
            }
          </span>

          ${
            item.read
              ? ""
              : `
                <span
                  class="
                    ez-notify-badge
                    warning
                  "
                >
                  غير مقروء
                </span>
              `
          }

        </div>

        <p>
          الجمهور:
          ${escapeHtml(
            item.audienceSegmentName ||
              "الجميع"
          )}
        </p>

        <p>
          القنوات:
          ${item.channels
            .map(
              (channel) =>
                escapeHtml(
                  CHANNELS[
                    channel
                  ] ||
                    channel
                )
            )
            .join("، ")}
        </p>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:7px;
          "
        >

          ${
            !item.read
              ? `
                <button
                  class="ez-notify-btn"
                  data-notify-action="read"
                  data-id="${escapeHtml(
                    item.id
                  )}"
                >
                  تحديد كمقروء
                </button>
              `
              : ""
          }

          ${
            item.status ===
              "queued" ||
            item.status ===
              "preparing"
              ? `
                <button
                  class="
                    ez-notify-btn
                    primary
                  "
                  data-notify-action="process-one"
                  data-id="${escapeHtml(
                    item.id
                  )}"
                >
                  معالجة
                </button>
              `
              : ""
          }

          <button
            class="ez-notify-btn"
            data-notify-action="details"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            التفاصيل
          </button>

          <button
            class="
              ez-notify-btn
              danger
            "
            data-notify-action="delete"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            حذف
          </button>

        </div>

      </article>
    `;
  }

  function renderRules() {
    return `
      <div
        style="
          margin-bottom:14px;
        "
      >
        <button
          class="
            ez-notify-btn
            primary
          "
          data-notify-action="new-rule"
        >
          + قاعدة إشعار
        </button>
      </div>

      <div
        class="ez-notify-grid"
      >

        ${
          state.rules.length
            ? state.rules
                .map(
                  renderRule
                )
                .join("")
            : `
              <div
                class="ez-notify-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد قواعد إشعارات.
              </div>
            `
        }

      </div>
    `;
  }

  function renderRule(rule) {
    return `
      <div
        class="ez-notify-card"
      >

        <h3>
          ${escapeHtml(
            rule.name
          )}
        </h3>

        <p>
          الحدث:
          ${escapeHtml(
            rule.event
          )}
        </p>

        <div
          class="ez-notify-badges"
        >

          <span
            class="ez-notify-badge"
          >
            ${
              TYPES[
                rule.type
              ] ||
              escapeHtml(
                rule.type
              )
            }
          </span>

          <span
            class="ez-notify-badge"
          >
            ${
              PRIORITIES[
                rule.priority
              ] ||
              escapeHtml(
                rule.priority
              )
            }
          </span>

          <span
            class="
              ez-notify-badge
              ${
                rule.enabled
                  ? "success"
                  : "warning"
              }
            "
          >
            ${
              rule.enabled
                ? "نشطة"
                : "متوقفة"
            }
          </span>

        </div>

        <p>
          القنوات:
          ${rule.channels
            .map(
              (channel) =>
                escapeHtml(
                  CHANNELS[
                    channel
                  ] ||
                    channel
                )
            )
            .join("، ")}
        </p>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:7px;
          "
        >

          <button
            class="ez-notify-btn"
            data-notify-action="edit-rule"
            data-id="${escapeHtml(
              rule.id
            )}"
          >
            تعديل
          </button>

          <button
            class="ez-notify-btn"
            data-notify-action="toggle-rule"
            data-id="${escapeHtml(
              rule.id
            )}"
          >
            ${
              rule.enabled
                ? "إيقاف"
                : "تفعيل"
            }
          </button>

          <button
            class="
              ez-notify-btn
              danger
            "
            data-notify-action="delete-rule"
            data-id="${escapeHtml(
              rule.id
            )}"
          >
            حذف
          </button>

        </div>

      </div>
    `;
  }

  function renderSettings() {
    return `
      <div
        class="ez-notify-card"
      >

        <h3>
          إعدادات محرك الإشعارات
        </h3>

        <div
          style="
            display:grid;
            gap:9px;
            margin-top:15px;
          "
        >

          ${setting(
            "تفعيل المحرك",
            "enabled"
          )}

          ${setting(
            "الإشعارات داخل المنصة",
            "inAppEnabled"
          )}

          ${setting(
            "Push",
            "pushEnabled"
          )}

          ${setting(
            "البريد الإلكتروني",
            "emailEnabled"
          )}

          ${setting(
            "SMS",
            "smsEnabled"
          )}

          ${setting(
            "التواصل الاجتماعي",
            "socialEnabled"
          )}

          ${setting(
            "لوحة الإدارة",
            "dashboardEnabled"
          )}

          ${setting(
            "منع التكرار",
            "deduplicate"
          )}

          ${setting(
            "الإشعارات العاجلة التلقائية",
            "autoBreaking"
          )}

          ${setting(
            "إشعارات البث التلقائية",
            "autoLive"
          )}

          ${setting(
            "إشعارات AI التلقائية",
            "autoAI"
          )}

          ${setting(
            "إشعارات التجارية التلقائية",
            "autoCommercial"
          )}

          ${setting(
            "ساعات الهدوء",
            "quietHoursEnabled"
          )}

        </div>

        <div
          class="ez-notify-form"
          style="margin-top:16px"
        >

          <div
            class="ez-notify-field"
          >
            <label>
              بداية الهدوء
            </label>

            <input
              id="ez-notify-quiet-start"
              class="ez-notify-input"
              type="time"
              value="${escapeHtml(
                state.settings
                  .quietStart
              )}"
            />
          </div>

          <div
            class="ez-notify-field"
          >
            <label>
              نهاية الهدوء
            </label>

            <input
              id="ez-notify-quiet-end"
              class="ez-notify-input"
              type="time"
              value="${escapeHtml(
                state.settings
                  .quietEnd
              )}"
            />
          </div>

          <div
            class="ez-notify-field"
          >
            <label>
              نافذة منع التكرار بالدقائق
            </label>

            <input
              id="ez-notify-dedupe-window"
              class="ez-notify-input"
              type="number"
              min="1"
              max="1440"
              value="${escapeHtml(
                state.settings
                  .deduplicateWindowMinutes
              )}"
            />
          </div>

          <div
            class="ez-notify-field"
          >
            <label>
              الحد الأقصى للطابور
            </label>

            <input
              id="ez-notify-max-queue"
              class="ez-notify-input"
              type="number"
              min="10"
              max="5000"
              value="${escapeHtml(
                state.settings
                  .maxQueue
              )}"
            />
          </div>

        </div>

        <button
          class="
            ez-notify-btn
            primary
          "
          style="margin-top:16px"
          data-notify-action="save-settings"
        >
          حفظ الإعدادات
        </button>

      </div>
    `;
  }

  function setting(
    label,
    key
  ) {
    return `
      <label
        class="ez-notify-check"
      >

        <input
          type="checkbox"
          data-notify-setting="${escapeHtml(
            key
          )}"
          ${
            state.settings[key]
              ? "checked"
              : ""
          }
        />

        <span>
          ${escapeHtml(
            label
          )}
        </span>

      </label>
    `;
  }

  function renderEvents() {
    const events =
      [...state.events]
        .reverse()
        .slice(0, 100);

    return `
      <div
        class="ez-notify-card"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
          "
        >

          <div>
            <h3>
              سجل المحرك
            </h3>

            <p>
              سجل إنشاء الإشعارات ومعالجتها
              وقواعد التوجيه والأحداث.
            </p>
          </div>

          <button
            class="
              ez-notify-btn
              danger
            "
            data-notify-action="clear-events"
          >
            مسح السجل
          </button>

        </div>

        <div
          class="ez-notify-log"
        >

          ${
            events.length
              ? events
                  .map(
                    (event) => `
                      <div
                        class="
                          ez-notify-log-item
                        "
                      >

                        <strong>
                          ${escapeHtml(
                            event.message
                          )}
                        </strong>

                        <span>
                          ${escapeHtml(
                            event.type
                          )}
                          ·
                          ${escapeHtml(
                            event.createdAt
                          )}
                        </span>

                      </div>
                    `
                  )
                  .join("")
              : `
                <div
                  style="
                    text-align:center;
                    padding:40px;
                    color:#718997;
                  "
                >
                  لا توجد أحداث.
                </div>
              `
          }

        </div>

      </div>
    `;
  }

  function openModal(
    title,
    body,
    footer = ""
  ) {
    const modal =
      document.querySelector(
        "#ez-notification-orchestrator-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div
        class="ez-notify-dialog"
      >

        <div
          class="ez-notify-dialog-head"
        >

          <strong>
            ${escapeHtml(
              title
            )}
          </strong>

          <button
            class="ez-notify-btn"
            data-notify-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-notify-dialog-body"
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-notify-dialog-footer
                "
              >
                ${footer}
              </div>
            `
            : ""
        }

      </div>
    `;

    modal.classList.add(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    bindEvents();
  }

  function closeModal() {
    const modal =
      document.querySelector(
        "#ez-notification-orchestrator-modal"
      );

    if (!modal) {
      return;
    }

    modal.classList.remove(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    modal.innerHTML = "";
  }

  function openNotificationForm() {
    openModal(
      "إنشاء إشعار جديد",
      `
        <form
          id="ez-notification-form"
        >

          <div
            class="ez-notify-form"
          >

            <div
              class="
                ez-notify-field
                full
              "
            >
              <label>
                العنوان
              </label>

              <input
                class="ez-notify-input"
                name="title"
                required
                placeholder="عنوان الإشعار"
              />
            </div>

            <div
              class="
                ez-notify-field
                full
              "
            >
              <label>
                الرسالة
              </label>

              <textarea
                class="
                  ez-notify-textarea
                "
                name="message"
                required
                placeholder="نص الإشعار..."
              ></textarea>
            </div>

            <div
              class="ez-notify-field"
            >
              <label>
                النوع
              </label>

              <select
                class="ez-notify-select"
                name="type"
              >

                ${Object.entries(
                  TYPES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                      >
                        ${escapeHtml(
                          label
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="ez-notify-field"
            >
              <label>
                الأولوية
              </label>

              <select
                class="ez-notify-select"
                name="priority"
              >

                ${Object.entries(
                  PRIORITIES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                      >
                        ${escapeHtml(
                          label
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="
                ez-notify-field
                full
              "
            >
              <label>
                القنوات
              </label>

              <div
                class="ez-notify-checks"
              >

                ${Object.entries(
                  CHANNELS
                )
                  .map(
                    ([key, label]) => `
                      <label
                        class="
                          ez-notify-check
                        "
                      >

                        <input
                          type="checkbox"
                          name="channel"
                          value="${escapeHtml(
                            key
                          )}"
                          ${
                            key ===
                              "inApp" ||
                            key ===
                              "dashboard"
                              ? "checked"
                              : ""
                          }
                        />

                        <span>
                          ${escapeHtml(
                            label
                          )}
                        </span>

                      </label>
                    `
                  )
                  .join("")}

              </div>
            </div>

            <div
              class="
                ez-notify-field
                full
              "
            >
              <label>
                مفتاح منع التكرار
              </label>

              <input
                class="ez-notify-input"
                name="dedupeKey"
                placeholder="اختياري"
              />
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-notify-btn"
          data-notify-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-notify-btn
            primary
          "
          data-notify-action="save-notification"
        >
          إنشاء الإشعار
        </button>
      `
    );
  }

  function createNotification(input = {}) {
    if (
      !state.settings.enabled
    ) {
      return null;
    }

    const item =
      normalizeNotification(
        input
      );

    if (
      state.settings
        .deduplicate &&
      item.dedupeKey
    ) {
      const windowMs =
        Number(
          state.settings
            .deduplicateWindowMinutes
        ) *
        60000;

      const duplicate =
        state.notifications.some(
          (existing) => {
            if (
              existing.dedupeKey !==
              item.dedupeKey
            ) {
              return false;
            }

            return (
              Date.now() -
                new Date(
                  existing.createdAt
                ).getTime() <
              windowMs
            );
          }
        );

      if (duplicate) {
        addEvent(
          "duplicate_blocked",
          "تم منع إشعار مكرر.",
          {
            dedupeKey:
              item.dedupeKey
          }
        );

        return null;
      }
    }

    item.status =
      "queued";

    item.updatedAt =
      now();

    state.queue.push(
      item
    );

    state.notifications.push(
      item
    );

    addEvent(
      "notification_created",
      "تم إنشاء إشعار جديد.",
      {
        notificationId:
          item.id,

        type:
          item.type,

        priority:
          item.priority
      }
    );

    save();

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification:created",
        {
          detail:
            clone(item)
        }
      )
    );

    return clone(item);
  }

  function saveNotification() {
    const form =
      document.querySelector(
        "#ez-notification-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const channels =
      data
        .getAll(
          "channel"
        )
        .filter(Boolean);

    const item =
      createNotification({
        title:
          String(
            data.get(
              "title"
            ) || ""
          ).trim(),

        message:
          String(
            data.get(
              "message"
            ) || ""
          ).trim(),

        type:
          data.get(
            "type"
          ) ||
          "system",

        priority:
          data.get(
            "priority"
          ) ||
          "normal",

        channels:
          channels.length
            ? channels
            : ["inApp"],

        dedupeKey:
          String(
            data.get(
              "dedupeKey"
            ) || ""
          ).trim(),

        source:
          "manual"
      });

    if (!item) {
      notify(
        "لم يتم إنشاء الإشعار.",
        "warning"
      );

      return;
    }

    closeModal();

    render();

    notify(
      "تم وضع الإشعار في الطابور.",
      "success"
    );
  }

  function processQueue() {
    if (
      !state.settings.enabled
    ) {
      return;
    }

    const queued =
      state.queue.filter(
        (item) =>
          item.status ===
            "queued" ||
          item.status ===
            "preparing"
      );

    queued.forEach(
      processNotification
    );

    save();

    render();

    notify(
      `تمت معالجة ${queued.length} إشعار.`,
      "success"
    );
  }

  function processNotification(
    item
  ) {
    if (!item) {
      return;
    }

    item.status =
      "preparing";

    item.attempts =
      Number(
        item.attempts || 0
      ) + 1;

    item.updatedAt =
      now();

    /*
     * القنوات الداخلية تعمل داخل المنصة.
     * القنوات الخارجية لا تدعي الإرسال الحقيقي
     * ما لم يوجد Provider رسمي مربوط بالخلفية.
     */

    const internalChannels =
      item.channels.filter(
        (channel) =>
          channel ===
            "inApp" ||
          channel ===
            "dashboard"
      );

    const externalChannels =
      item.channels.filter(
        (channel) =>
          !internalChannels.includes(
            channel
          )
      );

    if (
      internalChannels.length
    ) {
      dispatchInternal(
        item
      );
    }

    if (
      externalChannels.length
    ) {
      if (
        state.settings
          .requireApprovalForExternal
      ) {
        item.status =
          "sent";

        item.error =
          "القنوات الخارجية جاهزة للتسليم بعد ربط مزود Backend الرسمي.";

        addEvent(
          "external_waiting_provider",
          "إشعار خارجي ينتظر مزود Backend رسمي.",
          {
            notificationId:
              item.id,

            channels:
              externalChannels
          }
        );
      } else {
        item.status =
          "sent";

        item.error =
          "لا يوجد مزود خارجي متصل حاليًا.";

        addEvent(
          "external_not_connected",
          "لم يتم إرسال الإشعار خارجيًا لعدم وجود مزود متصل.",
          {
            notificationId:
              item.id
          }
        );
      }
    } else {
      item.status =
        "delivered";

      item.sentAt =
        now();
    }

    item.updatedAt =
      now();

    const queueIndex =
      state.queue.findIndex(
        (queueItem) =>
          queueItem.id ===
          item.id
      );

    if (
      queueIndex >= 0
    ) {
      state.queue[
        queueIndex
      ] = item;
    }

    const historyIndex =
      state.notifications.findIndex(
        (notification) =>
          notification.id ===
          item.id
      );

    if (
      historyIndex >= 0
    ) {
      state.notifications[
        historyIndex
      ] = item;
    }

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification:processed",
        {
          detail:
            clone(item)
        }
      )
    );
  }

  function dispatchInternal(
    item
  ) {
    if (
      state.settings
        .inAppEnabled &&
      item.channels.includes(
        "inApp"
      )
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "ezmedia:notification",
          {
            detail: {
              ...clone(item),
              module:
                MODULE,
              source:
                item.source
            }
          }
        )
      );
    }

    if (
      state.settings
        .dashboardEnabled &&
      item.channels.includes(
        "dashboard"
      )
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "ezmedia:dashboard:notification",
          {
            detail:
              clone(item)
          }
        )
      );
    }
  }

  function markRead(id) {
    const notification =
      state.notifications.find(
        (item) =>
          item.id === id
      );

    if (!notification) {
      return;
    }

    notification.read =
      true;

    notification.updatedAt =
      now();

    const queueItem =
      state.queue.find(
        (item) =>
          item.id === id
      );

    if (queueItem) {
      queueItem.read =
        true;

      queueItem.updatedAt =
        now();
    }

    save();

    render();
  }

  function markAllRead() {
    state.notifications.forEach(
      (item) => {
        item.read =
          true;

        item.updatedAt =
          now();
      }
    );

    state.queue.forEach(
      (item) => {
        item.read =
          true;

        item.updatedAt =
          now();
      }
    );

    addEvent(
      "mark_all_read",
      "تم تحديد جميع الإشعارات كمقروءة."
    );

    save();

    render();

    notify(
      "تم تحديد الكل كمقروء.",
      "success"
    );
  }

  function deleteNotification(
    id
  ) {
    state.notifications =
      state.notifications.filter(
        (item) =>
          item.id !== id
      );

    state.queue =
      state.queue.filter(
        (item) =>
          item.id !== id
      );

    addEvent(
      "notification_deleted",
      "تم حذف إشعار.",
      {
        notificationId:
          id
      }
    );

    save();

    render();
  }

  function openNotificationDetails(
    id
  ) {
    const item =
      state.notifications.find(
        (notification) =>
          notification.id ===
          id
      );

    if (!item) {
      return;
    }

    openModal(
      "تفاصيل الإشعار",
      `
        <div
          class="ez-notify-form"
        >

          ${detail(
            "العنوان",
            item.title
          )}

          ${detail(
            "النوع",
            TYPES[
              item.type
            ] ||
              item.type
          )}

          ${detail(
            "الأولوية",
            PRIORITIES[
              item.priority
            ] ||
              item.priority
          )}

          ${detail(
            "الحالة",
            STATUSES[
              item.status
            ] ||
              item.status
          )}

          ${detail(
            "الجمهور",
            item.audienceSegmentName
          )}

          ${detail(
            "المصدر",
            item.source
          )}

          <div
            class="
              ez-notify-field
              full
            "
          >
            <label>
              الرسالة
            </label>

            <div
              style="
                padding:14px;
                background:#f7fbfd;
                border-radius:12px;
                line-height:1.9;
              "
            >
              ${escapeHtml(
                item.message
              )}
            </div>
          </div>

          <div
            class="
              ez-notify-field
              full
            "
          >
            <label>
              القنوات
            </label>

            <div
              class="ez-notify-badges"
            >
              ${item.channels
                .map(
                  (channel) => `
                    <span
                      class="
                        ez-notify-badge
                      "
                    >
                      ${escapeHtml(
                        CHANNELS[
                          channel
                        ] ||
                          channel
                      )}
                    </span>
                  `
                )
                .join("")}
            </div>
          </div>

        </div>
      `,
      `
        <button
          class="ez-notify-btn"
          data-notify-action="close"
        >
          إغلاق
        </button>
      `
    );
  }

  function detail(
    label,
    value
  ) {
    return `
      <div
        class="ez-notify-field"
      >

        <label>
          ${escapeHtml(
            label
          )}
        </label>

        <div
          style="
            padding:11px 13px;
            border-radius:12px;
            background:#f7fbfd;
          "
        >
          ${escapeHtml(
            value
          )}
        </div>

      </div>
    `;
  }

  function openRuleForm(
    existing = null
  ) {
    const rule =
      existing ||
      normalizeRule({});

    openModal(
      existing
        ? "تعديل قاعدة إشعار"
        : "إنشاء قاعدة إشعار",
      `
        <form
          id="ez-notification-rule-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              rule.id
            )}"
          />

          <div
            class="ez-notify-form"
          >

            <div
              class="
                ez-notify-field
                full
              "
            >
              <label>
                اسم القاعدة
              </label>

              <input
                class="ez-notify-input"
                name="name"
                required
                value="${escapeHtml(
                  rule.name
                )}"
              />
            </div>

            <div
              class="ez-notify-field"
            >
              <label>
                الحدث
              </label>

              <input
                class="ez-notify-input"
                name="event"
                value="${escapeHtml(
                  rule.event
                )}"
                placeholder="breaking.created"
              />
            </div>

            <div
              class="ez-notify-field"
            >
              <label>
                النوع
              </label>

              <select
                class="ez-notify-select"
                name="type"
              >

                ${Object.entries(
                  TYPES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                        ${
                          rule.type ===
                          key
                            ? "selected"
                            : ""
                        }
                      >
                        ${escapeHtml(
                          label
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="ez-notify-field"
            >
              <label>
                الأولوية
              </label>

              <select
                class="ez-notify-select"
                name="priority"
              >

                ${Object.entries(
                  PRIORITIES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                        ${
                          rule.priority ===
                          key
                            ? "selected"
                            : ""
                        }
                      >
                        ${escapeHtml(
                          label
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="
                ez-notify-field
                full
              "
            >
              <label>
                القنوات
              </label>

              <div
                class="ez-notify-checks"
              >

                ${Object.entries(
                  CHANNELS
                )
                  .map(
                    ([key, label]) => `
                      <label
                        class="
                          ez-notify-check
                        "
                      >

                        <input
                          type="checkbox"
                          name="channel"
                          value="${escapeHtml(
                            key
                          )}"
                          ${
                            rule.channels.includes(
                              key
                            )
                              ? "checked"
                              : ""
                          }
                        />

                        <span>
                          ${escapeHtml(
                            label
                          )}
                        </span>

                      </label>
                    `
                  )
                  .join("")}

              </div>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-notify-btn"
          data-notify-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-notify-btn
            primary
          "
          data-notify-action="save-rule"
        >
          حفظ
        </button>
      `
    );
  }

  function saveRule() {
    const form =
      document.querySelector(
        "#ez-notification-rule-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const rule =
      normalizeRule({
        id:
          data.get(
            "id"
          ) ||
          uid(
            "notification-rule"
          ),

        name:
          String(
            data.get(
              "name"
            ) || ""
          ).trim(),

        event:
          String(
            data.get(
              "event"
            ) || ""
          ).trim(),

        type:
          data.get(
            "type"
          ) ||
          "system",

        priority:
          data.get(
            "priority"
          ) ||
          "normal",

        channels:
          data
            .getAll(
              "channel"
            )
            .filter(Boolean),

        updatedAt:
          now()
      });

    if (!rule.name) {
      notify(
        "اسم القاعدة مطلوب.",
        "warning"
      );

      return;
    }

    const index =
      state.rules.findIndex(
        (item) =>
          item.id ===
          rule.id
      );

    if (index >= 0) {
      state.rules[
        index
      ] = rule;

      addEvent(
        "rule_updated",
        "تم تعديل قاعدة إشعار.",
        {
          ruleId:
            rule.id
        }
      );
    } else {
      state.rules.push(
        rule
      );

      addEvent(
        "rule_created",
        "تم إنشاء قاعدة إشعار.",
        {
          ruleId:
            rule.id
        }
      );
    }

    save();

    closeModal();

    render();

    notify(
      "تم حفظ قاعدة الإشعار.",
      "success"
    );
  }

  function toggleRule(id) {
    const rule =
      state.rules.find(
        (item) =>
          item.id === id
      );

    if (!rule) {
      return;
    }

    rule.enabled =
      !rule.enabled;

    rule.updatedAt =
      now();

    addEvent(
      "rule_toggle",
      rule.enabled
        ? "تم تفعيل قاعدة الإشعار."
        : "تم إيقاف قاعدة الإشعار.",
      {
        ruleId:
          id
      }
    );

    save();

    render();
  }

  function deleteRule(id) {
    if (
      !window.confirm(
        "هل تريد حذف قاعدة الإشعار؟"
      )
    ) {
      return;
    }

    state.rules =
      state.rules.filter(
        (rule) =>
          rule.id !== id
      );

    addEvent(
      "rule_deleted",
      "تم حذف قاعدة إشعار.",
      {
        ruleId:
          id
      }
    );

    save();

    render();

    notify(
      "تم حذف القاعدة.",
      "success"
    );
  }

  function saveSettings() {
    document
      .querySelectorAll(
        "[data-notify-setting]"
      )
      .forEach(
        (input) => {
          state.settings[
            input.dataset
              .notifySetting
          ] =
            input.checked;
        }
      );

    const start =
      document.querySelector(
        "#ez-notify-quiet-start"
      );

    const end =
      document.querySelector(
        "#ez-notify-quiet-end"
      );

    const windowInput =
      document.querySelector(
        "#ez-notify-dedupe-window"
      );

    const maxQueue =
      document.querySelector(
        "#ez-notify-max-queue"
      );

    if (start) {
      state.settings.quietStart =
        start.value ||
        "23:00";
    }

    if (end) {
      state.settings.quietEnd =
        end.value ||
        "07:00";
    }

    if (windowInput) {
      state.settings
        .deduplicateWindowMinutes =
        Math.max(
          1,
          Math.min(
            1440,
            Number(
              windowInput.value
            ) || 30
          )
        );
    }

    if (maxQueue) {
      state.settings.maxQueue =
        Math.max(
          10,
          Math.min(
            5000,
            Number(
              maxQueue.value
            ) || MAX_QUEUE
          )
        );
    }

    addEvent(
      "settings_updated",
      "تم تحديث إعدادات محرك الإشعارات."
    );

    save();

    render();

    notify(
      "تم حفظ الإعدادات.",
      "success"
    );
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#notification-orchestrator-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-notify-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .notifyTab;

              state.search =
                "";

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-notify-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .notifyAction;

              const id =
                button.dataset
                  .id;

              if (
                action ===
                "new"
              ) {
                openNotificationForm();
                return;
              }

              if (
                action ===
                "save-notification"
              ) {
                saveNotification();
                return;
              }

              if (
                action ===
                "process"
              ) {
                processQueue();
                return;
              }

              if (
                action ===
                "process-one"
              ) {
                const item =
                  state.queue.find(
                    (queueItem) =>
                      queueItem.id ===
                      id
                  );

                if (item) {
                  processNotification(
                    item
                  );

                  save();
                  render();

                  notify(
                    "تمت معالجة الإشعار.",
                    "success"
                  );
                }

                return;
              }

              if (
                action ===
                "read"
              ) {
                markRead(id);
                return;
              }

              if (
                action ===
                "mark-all-read"
              ) {
                markAllRead();
                return;
              }

              if (
                action ===
                "details"
              ) {
                openNotificationDetails(
                  id
                );
                return;
              }

              if (
                action ===
                "delete"
              ) {
                deleteNotification(
                  id
                );
                return;
              }

              if (
                action ===
                "new-rule"
              ) {
                openRuleForm();
                return;
              }

              if (
                action ===
                "edit-rule"
              ) {
                const rule =
                  state.rules.find(
                    (item) =>
                      item.id ===
                      id
                  );

                if (rule) {
                  openRuleForm(
                    rule
                  );
                }

                return;
              }

              if (
                action ===
                "save-rule"
              ) {
                saveRule();
                return;
              }

              if (
                action ===
                "toggle-rule"
              ) {
                toggleRule(id);
                return;
              }

              if (
                action ===
                "delete-rule"
              ) {
                deleteRule(id);
                return;
              }

              if (
                action ===
                "save-settings"
              ) {
                saveSettings();
                return;
              }

              if (
                action ===
                "clear-events"
              ) {
                if (
                  window.confirm(
                    "هل تريد مسح سجل المحرك؟"
                  )
                ) {
                  state.events =
                    [];

                  save();

                  render();

                  notify(
                    "تم مسح السجل.",
                    "success"
                  );
                }

                return;
              }

              if (
                action ===
                "refresh"
              ) {
                load();
                render();
                return;
              }

              if (
                action ===
                "close"
              ) {
                closeModal();
              }
            }
          );
        }
      );

    section
      .querySelectorAll(
        "#ez-notify-search"
      )
      .forEach(
        (input) => {
          input.addEventListener(
            "input",
            (event) => {
              state.search =
                event.target.value;

              render();
            }
          );
        }
      );

    const modal =
      document.querySelector(
        "#ez-notification-orchestrator-modal"
      );

    if (modal) {
      modal.addEventListener(
        "click",
        (event) => {
          if (
            event.target ===
            modal
          ) {
            closeModal();
          }
        }
      );
    }
  }

  function show() {
    const section =
      ensureSection();

    section.hidden =
      false;

    load();

    injectStyles();

    render();
  }

  function hide() {
    const section =
      document.querySelector(
        "#notification-orchestrator-section"
      );

    if (section) {
      section.hidden =
        true;
    }
  }

  function refresh() {
    load();
    render();
  }

  function create(input = {}) {
    return createNotification(
      input
    );
  }

  function process(id) {
    if (id) {
      const item =
        state.queue.find(
          (queueItem) =>
            queueItem.id === id
        );

      if (!item) {
        return null;
      }

      processNotification(
        item
      );

      save();

      return clone(
        item
      );
    }

    processQueue();

    return getStatus();
  }

  function markAsRead(id) {
    markRead(id);
  }

  function getNotifications(
    options = {}
  ) {
    let items =
      [...state.notifications];

    if (
      options.type
    ) {
      items =
        items.filter(
          (item) =>
            item.type ===
            options.type
        );
    }

    if (
      options.priority
    ) {
      items =
        items.filter(
          (item) =>
            item.priority ===
            options.priority
        );
    }

    if (
      options.unread
    ) {
      items =
        items.filter(
          (item) =>
            !item.read
        );
    }

    if (
      options.status
    ) {
      items =
        items.filter(
          (item) =>
            item.status ===
            options.status
        );
    }

    return clone(
      items
    );
  }

  function getQueue() {
    return clone(
      state.queue
    );
  }

  function getRules() {
    return clone(
      state.rules
    );
  }

  function getSettings() {
    return clone(
      state.settings
    );
  }

  function getStatus() {
    return {
      module:
        MODULE,

      enabled:
        Boolean(
          state.settings
            .enabled
        ),

      metrics:
        getMetrics(),

      queue:
        state.queue.length,

      updatedAt:
        now()
    };
  }

  window.EZMediaNotificationOrchestrator =
    {
      module:
        MODULE,

      show,
      hide,
      refresh,

      create,
      process,
      markAsRead,

      getNotifications,
      getQueue,
      getRules,
      getSettings,
      getStatus
    };

  /*
   * الأحداث الإعلامية المهمة.
   */

  window.addEventListener(
    "ezmedia:breaking:created",
    (event) => {
      if (
        !state.settings
          .autoBreaking
      ) {
        return;
      }

      const detail =
        event.detail || {};

      const title =
        detail.title ||
        detail.headline ||
        "خبر عاجل جديد";

      const message =
        detail.message ||
        detail.summary ||
        title;

      createNotification({
        title:
          "عاجل: " +
          title,

        message,

        type:
          "breaking",

        priority:
          "critical",

        channels:
          ["inApp", "dashboard"],

        contentId:
          detail.id ||
          detail.contentId ||
          "",

        source:
          "breaking",

        sourceEvent:
          "ezmedia:breaking:created",

        dedupeKey:
          "breaking:" +
          (
            detail.id ||
            title
          )
      });

      processQueue();
    }
  );

  /*
   * البث المباشر.
   */

  window.addEventListener(
    "ezmedia:live:started",
    (event) => {
      if (
        !state.settings
          .autoLive
      ) {
        return;
      }

      const detail =
        event.detail || {};

      createNotification({
        title:
          "البث المباشر بدأ",

        message:
          detail.title ||
          detail.name ||
          "بدأ بث مباشر جديد.",

        type:
          "live",

        priority:
          "high",

        channels:
          ["inApp", "dashboard"],

        source:
          "live",

        sourceEvent:
          "ezmedia:live:started",

        dedupeKey:
          "live:" +
          (
            detail.id ||
            detail.channelId ||
            detail.title ||
            ""
          )
      });
    }
  );

  /*
   * أوركسترا الذكاء الاصطناعي.
   */

  window.addEventListener(
    "ezmedia:ai:orchestrator:event",
    (event) => {
      if (
        !state.settings
          .autoAI
      ) {
        return;
      }

      const detail =
        event.detail || {};

      if (
        !detail.type
      ) {
        return;
      }

      createNotification({
        title:
          "تحديث من الذكاء الاصطناعي",

        message:
          detail.message ||
          "حدث جديد في منظومة الذكاء الاصطناعي.",

        type:
          "ai",

        priority:
          "normal",

        channels:
          ["inApp", "dashboard"],

        source:
          "ai-orchestrator",

        sourceEvent:
          "ezmedia:ai:orchestrator:event",

        dedupeKey:
          "ai:" +
          detail.type
      });
    }
  );

  /*
   * الأحداث التجارية.
   */

  window.addEventListener(
    "ezmedia:commercial:event",
    (event) => {
      if (
        !state.settings
          .autoCommercial
      ) {
        return;
      }

      const detail =
        event.detail || {};

      createNotification({
        title:
          "تحديث تجاري",

        message:
          detail.message ||
          "حدث جديد في منظومة الإعلانات والرعايات.",

        type:
          "commercial",

        priority:
          "normal",

        channels:
          ["inApp", "dashboard"],

        source:
          "commercial",

        sourceEvent:
          "ezmedia:commercial:event"
      });
    }
  );

  /*
   * إشعارات النظام العامة.
   */

  window.addEventListener(
    "ezmedia:system:alert",
    (event) => {
      const detail =
        event.detail || {};

      createNotification({
        title:
          detail.title ||
          "تنبيه النظام",

        message:
          detail.message ||
          "تنبيه جديد من النظام.",

        type:
          "system",

        priority:
          detail.priority ||
          "high",

        channels:
          ["inApp", "dashboard"],

        source:
          "system",

        sourceEvent:
          "ezmedia:system:alert"
      });
    }
  );

  /*
   * التهيئة.
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        injectStyles();
        ensureSection();
        load();
      },
      {
        once: true
      }
    );
  } else {
    injectStyles();
    ensureSection();
    load();
  }

  console.info(
    "EZ MEDIA 11.0 — Notification Orchestrator loaded."
  );
})();
