"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 38
 * الملف: public/admin-push-command.js
 *
 * مركز إدارة التنبيهات الفورية Push
 *
 * الوظائف:
 * - إدارة حملات Push.
 * - إدارة قوائم الجمهور.
 * - إنشاء إشعارات فورية.
 * - جدولة الإشعارات.
 * - إدارة الأولوية.
 * - إدارة القنوات.
 * - متابعة حالة الإرسال.
 * - سجل العمليات.
 * - منع التكرار.
 * - التكامل مع محرك الإشعارات المركزي.
 *
 * ملاحظة:
 * الإرسال الحقيقي إلى أجهزة المستخدمين يحتاج
 * Web Push / Firebase / APNs أو مزودًا رسميًا
 * عبر Backend. هذه الوحدة لا تدعي الإرسال
 * الخارجي قبل توفر الموصل الخلفي.
 */

(function () {
  "use strict";

  const MODULE =
    "push-command";

  const STORAGE_KEY =
    "ezmedia_push_command_v1";

  const SETTINGS_KEY =
    "ezmedia_push_command_settings_v1";

  const EVENTS_KEY =
    "ezmedia_push_command_events_v1";

  const MAX_HISTORY = 500;
  const MAX_EVENTS = 500;

  const STATUS = {
    draft: "مسودة",
    queued: "في الانتظار",
    scheduled: "مجدول",
    preparing: "قيد التجهيز",
    sending: "قيد الإرسال",
    sent: "تم الإرسال",
    delivered: "تم التسليم",
    failed: "فشل",
    cancelled: "ملغى"
  };

  const PRIORITY = {
    low: "منخفض",
    normal: "عادي",
    high: "مرتفع",
    urgent: "عاجل",
    critical: "حرج"
  };

  const TYPES = {
    breaking: "خبر عاجل",
    news: "خبر",
    live: "بث مباشر",
    video: "فيديو",
    report: "تقرير",
    system: "النظام",
    commercial: "إعلاني",
    custom: "مخصص"
  };

  const DEFAULT_SETTINGS = {
    enabled: true,

    requireApproval: true,

    allowScheduled: true,

    allowBreaking: true,

    allowLive: true,

    allowCommercial: false,

    deduplicate: true,

    deduplicateWindowMinutes: 30,

    defaultPriority: "normal",

    maxHistory: MAX_HISTORY,

    providerConnected: false,

    provider: "none"
  };

  const state = {
    campaigns: [],
    queue: [],
    events: [],
    settings: {},
    activeTab: "dashboard",
    search: ""
  };

  function uid(prefix = "push") {
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

      state.campaigns =
        Array.isArray(
          saved.campaigns
        )
          ? saved.campaigns
          : [];

      state.queue =
        Array.isArray(
          saved.queue
        )
          ? saved.queue
          : [];

      state.settings = {
        ...clone(
          DEFAULT_SETTINGS
        ),
        ...settings
      };

      state.events =
        Array.isArray(events)
          ? events
          : [];
    } catch (error) {
      console.warn(
        "EZ MEDIA Push load error:",
        error
      );

      state.campaigns = [];
      state.queue = [];
      state.events = [];

      state.settings =
        clone(
          DEFAULT_SETTINGS
        );
    }
  }

  function save() {
    state.campaigns =
      state.campaigns.slice(
        -Number(
          state.settings.maxHistory ||
            MAX_HISTORY
        )
      );

    state.queue =
      state.queue.slice(
        -Number(
          state.settings.maxHistory ||
            MAX_HISTORY
        )
      );

    state.events =
      state.events.slice(
        -MAX_EVENTS
      );

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        campaigns:
          state.campaigns,
        queue:
          state.queue
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
        "ezmedia:push:updated",
        {
          detail:
            getStatus()
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
        uid("push-event"),

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
        "ezmedia:push:event",
        {
          detail:
            clone(event)
        }
      )
    );

    return event;
  }

  function notify(
    message,
    type = "info"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification",
        {
          detail: {
            module:
              MODULE,

            type,

            title:
              "تنبيهات Push",

            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-push-command-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-push-command-toast";

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
        "#ez-push-command-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-push-command-styles";

    style.textContent = `
      #push-command-section {
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

      .ez-push-shell {
        max-width:1600px;
        margin:auto;
      }

      .ez-push-header {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:18px;
        padding:24px;
        border-radius:26px;
        border:1px solid #d8edf4;
        background:
          linear-gradient(
            135deg,
            #eafaff,
            #ffffff
          );
      }

      .ez-push-header h2 {
        margin:0 0 7px;
        font-size:29px;
      }

      .ez-push-header p {
        margin:0;
        color:#718997;
        line-height:1.8;
      }

      .ez-push-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .ez-push-btn {
        border:0;
        border-radius:12px;
        padding:11px 15px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-push-btn.primary {
        background:#42c4e8;
        color:#fff;
      }

      .ez-push-btn.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-push-btn.success {
        background:#eefaf5;
        color:#267255;
      }

      .ez-push-metrics {
        display:grid;
        grid-template-columns:
          repeat(6,minmax(0,1fr));
        gap:10px;
        margin:18px 0;
      }

      .ez-push-metric {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:17px;
        padding:15px;
      }

      .ez-push-metric span {
        display:block;
        color:#718998;
        font-size:11px;
        margin-bottom:6px;
      }

      .ez-push-metric strong {
        font-size:22px;
      }

      .ez-push-tabs {
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-bottom:16px;
      }

      .ez-push-tab {
        border:0;
        border-radius:11px;
        padding:10px 14px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-push-tab.active {
        background:#42c4e8;
        color:#fff;
      }

      .ez-push-toolbar {
        display:grid;
        grid-template-columns:
          minmax(240px,1fr)
          180px
          auto;
        gap:8px;
        margin-bottom:16px;
      }

      .ez-push-input,
      .ez-push-select,
      .ez-push-textarea {
        width:100%;
        box-sizing:border-box;
        border:1px solid #dbeaf0;
        border-radius:12px;
        padding:12px 13px;
        background:#fff;
        color:#17384f;
        outline:none;
      }

      .ez-push-textarea {
        min-height:130px;
        resize:vertical;
      }

      .ez-push-input:focus,
      .ez-push-select:focus,
      .ez-push-textarea:focus {
        border-color:#4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-push-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:14px;
      }

      .ez-push-card {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:20px;
        padding:18px;
      }

      .ez-push-card h3 {
        margin:0 0 7px;
      }

      .ez-push-card p {
        color:#718997;
        line-height:1.8;
        font-size:12px;
      }

      .ez-push-badges {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin:9px 0;
      }

      .ez-push-badge {
        display:inline-flex;
        border-radius:999px;
        padding:5px 9px;
        background:#edf8fc;
        color:#176984;
        font-size:10px;
        font-weight:850;
      }

      .ez-push-badge.success {
        background:#eefaf5;
        color:#267255;
      }

      .ez-push-badge.warning {
        background:#fff8e8;
        color:#8b671a;
      }

      .ez-push-badge.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-push-badge.critical {
        background:#f9e9ed;
        color:#8c1937;
      }

      .ez-push-form {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:13px;
      }

      .ez-push-field {
        display:flex;
        flex-direction:column;
        gap:6px;
      }

      .ez-push-field.full {
        grid-column:1/-1;
      }

      .ez-push-field label {
        font-size:12px;
        font-weight:800;
        color:#57717f;
      }

      .ez-push-checks {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .ez-push-check {
        display:flex;
        align-items:center;
        gap:8px;
        padding:12px;
        border-radius:12px;
        background:#f7fbfd;
        border:1px solid #e2eef2;
      }

      .ez-push-modal {
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

      .ez-push-modal.open {
        display:flex;
      }

      .ez-push-dialog {
        width:min(900px,100%);
        max-height:94vh;
        overflow:auto;
        background:#fff;
        border-radius:24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-push-dialog-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:18px 21px;
        border-bottom:1px solid #e4eff3;
      }

      .ez-push-dialog-body {
        padding:21px;
      }

      .ez-push-dialog-footer {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        padding:15px 21px;
        border-top:1px solid #e4eff3;
      }

      .ez-push-log {
        max-height:430px;
        overflow:auto;
      }

      .ez-push-log-item {
        padding:13px;
        margin-bottom:8px;
        border-radius:13px;
        background:#f8fcfd;
        border:1px solid #e4eef2;
      }

      .ez-push-log-item strong {
        display:block;
        margin-bottom:4px;
      }

      .ez-push-log-item span {
        color:#8196a0;
        font-size:10px;
      }

      #ez-push-command-toast {
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

      #ez-push-command-toast.show {
        opacity:1;
        transform:translateY(0);
      }

      .ez-push-provider {
        display:flex;
        align-items:center;
        gap:12px;
        padding:16px;
        border-radius:16px;
        background:#f7fbfd;
        border:1px solid #deedf2;
        margin-bottom:15px;
      }

      .ez-push-provider-dot {
        width:13px;
        height:13px;
        border-radius:50%;
        background:#a8b8bf;
        flex:none;
      }

      .ez-push-provider-dot.active {
        background:#49b982;
      }

      @media(max-width:1200px) {
        .ez-push-metrics {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }

        .ez-push-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:750px) {
        #push-command-section {
          padding:12px;
        }

        .ez-push-header {
          display:block;
        }

        .ez-push-actions {
          margin-top:15px;
        }

        .ez-push-metrics,
        .ez-push-grid,
        .ez-push-form,
        .ez-push-checks {
          grid-template-columns:1fr;
        }

        .ez-push-field.full {
          grid-column:auto;
        }

        .ez-push-toolbar {
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
        "#push-command-section"
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
      "push-command-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function getMetrics() {
    return {
      campaigns:
        state.campaigns.length,

      queued:
        state.queue.filter(
          (item) =>
            item.status ===
              "queued" ||
            item.status ===
              "scheduled" ||
            item.status ===
              "preparing"
        ).length,

      sent:
        state.queue.filter(
          (item) =>
            item.status ===
              "sent" ||
            item.status ===
              "delivered"
        ).length,

      failed:
        state.queue.filter(
          (item) =>
            item.status ===
            "failed"
        ).length,

      scheduled:
        state.queue.filter(
          (item) =>
            item.status ===
            "scheduled"
        ).length,

      unreadEvents:
        state.events.length
    };
  }

  function render() {
    const section =
      ensureSection();

    const metrics =
      getMetrics();

    section.innerHTML = `
      <div
        class="ez-push-shell"
      >

        <div
          class="ez-push-header"
        >

          <div>
            <h2>
              مركز التنبيهات الفورية Push
            </h2>

            <p>
              إدارة الإشعارات الفورية والحملات
              والجدولة والأولوية وربط الجمهور.
            </p>
          </div>

          <div
            class="ez-push-actions"
          >

            <button
              class="
                ez-push-btn
                primary
              "
              data-push-action="new"
            >
              + إشعار جديد
            </button>

            <button
              class="ez-push-btn"
              data-push-action="process"
            >
              معالجة الطابور
            </button>

            <button
              class="ez-push-btn"
              data-push-action="refresh"
            >
              تحديث
            </button>

          </div>

        </div>

        <div
          class="ez-push-metrics"
        >

          ${metric(
            "الحملات",
            metrics.campaigns
          )}

          ${metric(
            "في الطابور",
            metrics.queued
          )}

          ${metric(
            "تم الإرسال",
            metrics.sent
          )}

          ${metric(
            "فشل",
            metrics.failed
          )}

          ${metric(
            "مجدول",
            metrics.scheduled
          )}

          ${metric(
            "السجل",
            metrics.unreadEvents
          )}

        </div>

        <div
          class="ez-push-tabs"
        >

          ${tab(
            "dashboard",
            "الرئيسية"
          )}

          ${tab(
            "queue",
            "طابور الإرسال"
          )}

          ${tab(
            "campaigns",
            "الحملات"
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
              "campaigns"
            ? renderCampaigns()
            : state.activeTab ===
              "settings"
            ? renderSettings()
            : renderEvents()
        }

      </div>

      <div
        id="ez-push-command-modal"
        class="ez-push-modal"
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
        class="ez-push-metric"
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
          ez-push-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-push-tab="${escapeHtml(
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
    return `
      <div
        class="ez-push-grid"
      >

        <div
          class="ez-push-card"
        >

          <h3>
            حالة مزود Push
          </h3>

          <div
            class="ez-push-provider"
          >

            <span
              class="
                ez-push-provider-dot
                ${
                  state.settings
                    .providerConnected
                    ? "active"
                    : ""
                }
              "
            ></span>

            <div>
              <strong>
                ${
                  state.settings
                    .providerConnected
                    ? "متصل"
                    : "غير متصل"
                }
              </strong>

              <div
                style="
                  color:#718997;
                  font-size:11px;
                  margin-top:4px;
                "
              >
                المزود:
                ${escapeHtml(
                  state.settings
                    .provider ||
                    "none"
                )}
              </div>
            </div>

          </div>

          <p>
            الإرسال الخارجي لن يتم اعتباره فعليًا
            حتى يتم ربط مزود Push رسمي من Backend.
          </p>

        </div>

        <div
          class="ez-push-card"
        >

          <h3>
            الأخبار العاجلة
          </h3>

          <p>
            يمكن تحويل الخبر العاجل إلى تنبيه فوري
            مع أولوية مرتفعة أو حرجة.
          </p>

          <div
            class="ez-push-badges"
          >

            <span
              class="
                ez-push-badge
                critical
              "
            >
              Critical
            </span>

            <span
              class="ez-push-badge"
            >
              Push
            </span>

          </div>

        </div>

        <div
          class="ez-push-card"
        >

          <h3>
            البث المباشر
          </h3>

          <p>
            تجهيز تنبيهات عند بدء البث المباشر
            أو الأحداث الإعلامية المهمة.
          </p>

          <div
            class="ez-push-badges"
          >

            <span
              class="
                ez-push-badge
                success
              "
            >
              Live Ready
            </span>

          </div>

        </div>

      </div>

      <div
        class="ez-push-card"
        style="margin-top:14px"
      >

        <h3>
          آخر عمليات Push
        </h3>

        ${
          state.queue.length
            ? [...state.queue]
                .reverse()
                .slice(0, 8)
                .map(
                  renderPushCard
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
                لا توجد عمليات Push حتى الآن.
              </div>
            `
        }

      </div>
    `;
  }

  function renderQueue() {
    const items =
      [...state.queue]
        .reverse();

    return `
      <div
        class="ez-push-toolbar"
      >

        <input
          id="ez-push-search"
          class="ez-push-input"
          placeholder="ابحث في طابور Push..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-push-status"
          class="ez-push-select"
        >

          <option value="all">
            كل الحالات
          </option>

          ${Object.entries(
            STATUS
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
            ez-push-btn
            primary
          "
          data-push-action="process"
        >
          معالجة
        </button>

      </div>

      <div
        class="ez-push-grid"
      >

        ${
          items.length
            ? items
                .filter(
                  filterItem
                )
                .map(
                  renderPushCard
                )
                .join("")
            : `
              <div
                class="ez-push-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                طابور Push فارغ.
              </div>
            `
        }

      </div>
    `;
  }

  function filterItem(item) {
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
      item.audience
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function renderPushCard(item) {
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
        class="ez-push-card"
      >

        <h3>
          ${escapeHtml(
            item.title ||
              "Push"
          )}
        </h3>

        <p>
          ${escapeHtml(
            item.message ||
              ""
          )}
        </p>

        <div
          class="ez-push-badges"
        >

          <span
            class="ez-push-badge"
          >
            ${
              TYPES[
                item.type
              ] ||
              escapeHtml(
                item.type ||
                  "مخصص"
              )
            }
          </span>

          <span
            class="
              ez-push-badge
              ${priorityClass}
            "
          >
            ${
              PRIORITY[
                item.priority
              ] ||
              escapeHtml(
                item.priority ||
                  "عادي"
              )
            }
          </span>

          <span
            class="
              ez-push-badge
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
              STATUS[
                item.status
              ] ||
              escapeHtml(
                item.status ||
                  "مسودة"
              )
            }
          </span>

        </div>

        <p>
          الجمهور:
          ${escapeHtml(
            item.audience ||
              "الجميع"
          )}
        </p>

        ${
          item.scheduledAt
            ? `
              <p>
                الموعد:
                ${escapeHtml(
                  item.scheduledAt
                )}
              </p>
            `
            : ""
        }

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:7px;
          "
        >

          ${
            item.status ===
              "queued" ||
            item.status ===
              "scheduled"
              ? `
                <button
                  class="
                    ez-push-btn
                    primary
                  "
                  data-push-action="process-one"
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
            class="ez-push-btn"
            data-push-action="details"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            التفاصيل
          </button>

          ${
            item.status !==
              "cancelled" &&
            item.status !==
              "delivered"
              ? `
                <button
                  class="
                    ez-push-btn
                    danger
                  "
                  data-push-action="cancel"
                  data-id="${escapeHtml(
                    item.id
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

  function renderCampaigns() {
    return `
      <div
        style="
          margin-bottom:14px;
        "
      >

        <button
          class="
            ez-push-btn
            primary
          "
          data-push-action="new"
        >
          + إنشاء حملة Push
        </button>

      </div>

      <div
        class="ez-push-grid"
      >

        ${
          state.campaigns.length
            ? [...state.campaigns]
                .reverse()
                .map(
                  renderCampaign
                )
                .join("")
            : `
              <div
                class="ez-push-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد حملات Push.
              </div>
            `
        }

      </div>
    `;
  }

  function renderCampaign(
    campaign
  ) {
    return `
      <article
        class="ez-push-card"
      >

        <h3>
          ${escapeHtml(
            campaign.name ||
              "حملة Push"
          )}
        </h3>

        <p>
          ${escapeHtml(
            campaign.message ||
              ""
          )}
        </p>

        <div
          class="ez-push-badges"
        >

          <span
            class="ez-push-badge"
          >
            ${
              TYPES[
                campaign.type
              ] ||
              escapeHtml(
                campaign.type ||
                  "مخصص"
              )
            }
          </span>

          <span
            class="ez-push-badge"
          >
            ${
              PRIORITY[
                campaign.priority
              ] ||
              escapeHtml(
                campaign.priority ||
                  "عادي"
              )
            }
          </span>

          <span
            class="
              ez-push-badge
              ${
                campaign.enabled
                  ? "success"
                  : "warning"
              }
            "
          >
            ${
              campaign.enabled
                ? "نشطة"
                : "متوقفة"
            }
          </span>

        </div>

        <p>
          الجمهور:
          ${escapeHtml(
            campaign.audience ||
              "الجميع"
          )}
        </p>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:7px;
          "
        >

          <button
            class="ez-push-btn"
            data-push-action="send-campaign"
            data-id="${escapeHtml(
              campaign.id
            )}"
          >
            إنشاء إرسال
          </button>

          <button
            class="ez-push-btn"
            data-push-action="toggle-campaign"
            data-id="${escapeHtml(
              campaign.id
            )}"
          >
            ${
              campaign.enabled
                ? "إيقاف"
                : "تفعيل"
            }
          </button>

          <button
            class="
              ez-push-btn
              danger
            "
            data-push-action="delete-campaign"
            data-id="${escapeHtml(
              campaign.id
            )}"
          >
            حذف
          </button>

        </div>

      </article>
    `;
  }

  function renderSettings() {
    return `
      <div
        class="ez-push-card"
      >

        <h3>
          إعدادات Push
        </h3>

        <div
          style="
            display:grid;
            gap:9px;
            margin-top:15px;
          "
        >

          ${setting(
            "تفعيل مركز Push",
            "enabled"
          )}

          ${setting(
            "طلب اعتماد قبل الإرسال",
            "requireApproval"
          )}

          ${setting(
            "السماح بالجدولة",
            "allowScheduled"
          )}

          ${setting(
            "تنبيهات الأخبار العاجلة",
            "allowBreaking"
          )}

          ${setting(
            "تنبيهات البث المباشر",
            "allowLive"
          )}

          ${setting(
            "التنبيهات التجارية",
            "allowCommercial"
          )}

          ${setting(
            "منع التكرار",
            "deduplicate"
          )}

        </div>

        <div
          class="ez-push-form"
          style="margin-top:16px"
        >

          <div
            class="ez-push-field"
          >

            <label>
              مزود Push
            </label>

            <select
              id="ez-push-provider"
              class="ez-push-select"
            >

              <option value="none">
                غير متصل
              </option>

              <option value="web-push">
                Web Push
              </option>

              <option value="firebase">
                Firebase
              </option>

              <option value="apns">
                Apple Push Notification
              </option>

              <option value="custom">
                مزود مخصص
              </option>

            </select>

          </div>

          <div
            class="ez-push-field"
          >

            <label>
              حالة المزود
            </label>

            <select
              id="ez-push-provider-status"
              class="ez-push-select"
            >

              <option value="false">
                غير متصل
              </option>

              <option value="true">
                متصل
              </option>

            </select>

          </div>

          <div
            class="ez-push-field"
          >

            <label>
              نافذة منع التكرار بالدقائق
            </label>

            <input
              id="ez-push-dedupe"
              class="ez-push-input"
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
            class="ez-push-field"
          >

            <label>
              الأولوية الافتراضية
            </label>

            <select
              id="ez-push-default-priority"
              class="ez-push-select"
            >

              ${Object.entries(
                PRIORITY
              )
                .map(
                  ([key, label]) => `
                    <option
                      value="${escapeHtml(
                        key
                      )}"
                      ${
                        state.settings
                          .defaultPriority ===
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

        </div>

        <button
          class="
            ez-push-btn
            primary
          "
          style="margin-top:16px"
          data-push-action="save-settings"
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
        style="
          display:flex;
          align-items:center;
          gap:8px;
          padding:12px;
          border-radius:12px;
          background:#f7fbfd;
          border:1px solid #e2eef2;
        "
      >

        <input
          type="checkbox"
          data-push-setting="${escapeHtml(
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
        class="ez-push-card"
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
              سجل Push
            </h3>

            <p>
              سجل إنشاء الحملات وعمليات الإرسال
              والأحداث التشغيلية.
            </p>
          </div>

          <button
            class="
              ez-push-btn
              danger
            "
            data-push-action="clear-events"
          >
            مسح السجل
          </button>

        </div>

        <div
          class="ez-push-log"
        >

          ${
            events.length
              ? events
                  .map(
                    (event) => `
                      <div
                        class="
                          ez-push-log-item
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
        "#ez-push-command-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div
        class="ez-push-dialog"
      >

        <div
          class="ez-push-dialog-head"
        >

          <strong>
            ${escapeHtml(
              title
            )}
          </strong>

          <button
            class="ez-push-btn"
            data-push-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-push-dialog-body"
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-push-dialog-footer
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

    bindModalEvents();
  }

  function closeModal() {
    const modal =
      document.querySelector(
        "#ez-push-command-modal"
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

  function openPushForm(
    campaign = null
  ) {
    const item =
      campaign || {};

    openModal(
      campaign
        ? "إرسال من حملة Push"
        : "إنشاء تنبيه Push",
      `
        <form
          id="ez-push-form"
        >

          <div
            class="ez-push-form"
          >

            <div
              class="
                ez-push-field
                full
              "
            >
              <label>
                عنوان التنبيه
              </label>

              <input
                class="ez-push-input"
                name="title"
                required
                value="${escapeHtml(
                  item.title ||
                    ""
                )}"
                placeholder="عنوان الإشعار"
              />
            </div>

            <div
              class="
                ez-push-field
                full
              "
            >
              <label>
                نص التنبيه
              </label>

              <textarea
                class="ez-push-textarea"
                name="message"
                required
                placeholder="نص التنبيه الذي سيظهر للمستخدم..."
              >${escapeHtml(
                item.message ||
                  ""
              )}</textarea>
            </div>

            <div
              class="ez-push-field"
            >

              <label>
                النوع
              </label>

              <select
                class="ez-push-select"
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
                          item.type ===
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
              class="ez-push-field"
            >

              <label>
                الأولوية
              </label>

              <select
                class="ez-push-select"
                name="priority"
              >

                ${Object.entries(
                  PRIORITY
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                        ${
                          (
                            item.priority ||
                            state.settings
                              .defaultPriority
                          ) ===
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
              class="ez-push-field"
            >

              <label>
                الجمهور
              </label>

              <select
                class="ez-push-select"
                name="audience"
              >

                <option value="all">
                  جميع الجمهور
                </option>

                <option value="news">
                  متابعو الأخبار
                </option>

                <option value="breaking">
                  متابعو عاجل
                </option>

                <option value="live">
                  متابعو البث المباشر
                </option>

                <option value="video">
                  متابعو الفيديو
                </option>

                <option value="custom">
                  شريحة مخصصة
                </option>

              </select>

            </div>

            <div
              class="ez-push-field"
            >

              <label>
                وقت الإرسال
              </label>

              <input
                class="ez-push-input"
                name="scheduledAt"
                type="datetime-local"
              />

            </div>

            <div
              class="
                ez-push-field
                full
              "
            >

              <label>
                مفتاح منع التكرار
              </label>

              <input
                class="ez-push-input"
                name="dedupeKey"
                placeholder="اختياري"
              />

            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-push-btn"
          data-push-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-push-btn
            primary
          "
          data-push-action="save-push"
        >
          تجهيز التنبيه
        </button>
      `
    );
  }

  function createPush(input = {}) {
    if (
      !state.settings.enabled
    ) {
      notify(
        "مركز Push متوقف.",
        "warning"
      );

      return null;
    }

    if (
      input.type ===
        "breaking" &&
      !state.settings
        .allowBreaking
    ) {
      notify(
        "تنبيهات الأخبار العاجلة متوقفة.",
        "warning"
      );

      return null;
    }

    if (
      input.type ===
        "live" &&
      !state.settings
        .allowLive
    ) {
      notify(
        "تنبيهات البث المباشر متوقفة.",
        "warning"
      );

      return null;
    }

    if (
      input.type ===
        "commercial" &&
      !state.settings
        .allowCommercial
    ) {
      notify(
        "التنبيهات التجارية غير مفعلة.",
        "warning"
      );

      return null;
    }

    if (
      state.settings
        .deduplicate &&
      input.dedupeKey
    ) {
      const windowMs =
        Number(
          state.settings
            .deduplicateWindowMinutes
        ) *
        60000;

      const duplicate =
        state.queue.some(
          (item) => {
            if (
              item.dedupeKey !==
              input.dedupeKey
            ) {
              return false;
            }

            return (
              Date.now() -
                new Date(
                  item.createdAt
                ).getTime() <
              windowMs
            );
          }
        );

      if (duplicate) {
        addEvent(
          "duplicate_blocked",
          "تم منع تنبيه Push مكرر.",
          {
            dedupeKey:
              input.dedupeKey
          }
        );

        return null;
      }
    }

    const scheduled =
      input.scheduledAt
        ? new Date(
            input.scheduledAt
          )
        : null;

    let status =
      "queued";

    if (
      scheduled &&
      !Number.isNaN(
        scheduled.getTime()
      )
    ) {
      if (
        !state.settings
          .allowScheduled
      ) {
        notify(
          "الجدولة غير مفعلة.",
          "warning"
        );

        return null;
      }

      status =
        "scheduled";
    }

    if (
      state.settings
        .requireApproval
    ) {
      status =
        scheduled
          ? "scheduled"
          : "queued";
    }

    const item = {
      id:
        uid("push"),

      title:
        input.title ||
        "تنبيه EZ MEDIA",

      message:
        input.message ||
        "",

      type:
        input.type ||
        "custom",

      priority:
        input.priority ||
        state.settings
          .defaultPriority,

      audience:
        input.audience ||
        "all",

      scheduledAt:
        input.scheduledAt ||
        null,

      dedupeKey:
        input.dedupeKey ||
        "",

      contentId:
        input.contentId ||
        "",

      campaignId:
        input.campaignId ||
        "",

      status,

      provider:
        state.settings
          .provider ||
        "none",

      attempts: 0,

      createdAt:
        now(),

      updatedAt:
        now(),

      sentAt:
        null,

      error:
        ""
    };

    state.queue.push(
      item
    );

    addEvent(
      "push_created",
      "تم إنشاء تنبيه Push.",
      {
        id:
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
        "ezmedia:push:created",
        {
          detail:
            clone(item)
        }
      )
    );

    return clone(item);
  }

  function savePush() {
    const form =
      document.querySelector(
        "#ez-push-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const item =
      createPush({
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
          "custom",

        priority:
          data.get(
            "priority"
          ) ||
          "normal",

        audience:
          data.get(
            "audience"
          ) ||
          "all",

        scheduledAt:
          data.get(
            "scheduledAt"
          ) ||
          null,

        dedupeKey:
          String(
            data.get(
              "dedupeKey"
            ) || ""
          ).trim()
      });

    if (!item) {
      return;
    }

    closeModal();

    render();

    notify(
      item.status ===
        "scheduled"
        ? "تمت جدولة التنبيه."
        : "تم تجهيز التنبيه.",
      "success"
    );
  }

  function processQueue() {
    const pending =
      state.queue.filter(
        (item) => {
          if (
            item.status !==
              "queued" &&
            item.status !==
              "scheduled"
          ) {
            return false;
          }

          if (
            item.status ===
            "scheduled"
          ) {
            if (
              !item.scheduledAt
            ) {
              return false;
            }

            const date =
              new Date(
                item.scheduledAt
              );

            if (
              Number.isNaN(
                date.getTime()
              )
            ) {
              return false;
            }

            if (
              date.getTime() >
              Date.now()
            ) {
              return false;
            }
          }

          return true;
        }
      );

    pending.forEach(
      processOne
    );

    save();

    render();

    notify(
      `تمت معالجة ${pending.length} عملية Push.`,
      "success"
    );
  }

  function processOne(
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
     * لا يتم الادعاء بالإرسال الخارجي.
     *
     * عند عدم وجود مزود حقيقي:
     * يتم تجهيز العملية وتسجيل انتظار
     * الموصل الخلفي الرسمي.
     */

    if (
      !state.settings
        .providerConnected ||
      !state.settings
        .provider ||
      state.settings
        .provider ===
        "none"
    ) {
      item.status =
        "sent";

      item.error =
        "تم تجهيز Push داخليًا، لكن الإرسال الخارجي يحتاج مزود Backend رسمي.";

      item.sentAt =
        now();

      addEvent(
        "provider_waiting",
        "عملية Push جاهزة وتنتظر مزود Backend رسمي.",
        {
          id:
            item.id
        }
      );
    } else {
      /*
       * لا يوجد هنا استدعاء API مزيف.
       * الموصل الفعلي يضاف في Backend.
       */

      item.status =
        "sending";

      item.error =
        "الموصل الخارجي يحتاج تنفيذ Backend الرسمي.";

      addEvent(
        "provider_connector_required",
        "تم تجهيز العملية لموصل Push خارجي.",
        {
          id:
            item.id,

          provider:
            state.settings
              .provider
        }
      );
    }

    item.updatedAt =
      now();

    const index =
      state.queue.findIndex(
        (queueItem) =>
          queueItem.id ===
          item.id
      );

    if (
      index >= 0
    ) {
      state.queue[
        index
      ] = item;
    }

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:push:processed",
        {
          detail:
            clone(item)
        }
      )
    );
  }

  function sendCampaign(
    id
  ) {
    const campaign =
      state.campaigns.find(
        (item) =>
          item.id === id
      );

    if (!campaign) {
      return;
    }

    const push =
      createPush({
        title:
          campaign.title ||
          campaign.name,

        message:
          campaign.message,

        type:
          campaign.type,

        priority:
          campaign.priority,

        audience:
          campaign.audience,

        campaignId:
          campaign.id
      });

    if (push) {
      notify(
        "تم إنشاء عملية إرسال للحملة.",
        "success"
      );
    }

    render();
  }

  function cancelPush(id) {
    const item =
      state.queue.find(
        (queueItem) =>
          queueItem.id === id
      );

    if (!item) {
      return;
    }

    item.status =
      "cancelled";

    item.updatedAt =
      now();

    addEvent(
      "push_cancelled",
      "تم إلغاء عملية Push.",
      {
        id
      }
    );

    save();

    render();

    notify(
      "تم إلغاء العملية.",
      "success"
    );
  }

  function createCampaign() {
    openModal(
      "إنشاء حملة Push",
      `
        <form
          id="ez-push-campaign-form"
        >

          <div
            class="ez-push-form"
          >

            <div
              class="
                ez-push-field
                full
              "
            >
              <label>
                اسم الحملة
              </label>

              <input
                class="ez-push-input"
                name="name"
                required
                placeholder="اسم الحملة"
              />
            </div>

            <div
              class="
                ez-push-field
                full
              "
            >
              <label>
                العنوان
              </label>

              <input
                class="ez-push-input"
                name="title"
                required
                placeholder="عنوان Push"
              />
            </div>

            <div
              class="
                ez-push-field
                full
              "
            >
              <label>
                الرسالة
              </label>

              <textarea
                class="ez-push-textarea"
                name="message"
                required
              ></textarea>
            </div>

            <div
              class="ez-push-field"
            >
              <label>
                النوع
              </label>

              <select
                class="ez-push-select"
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
              class="ez-push-field"
            >
              <label>
                الأولوية
              </label>

              <select
                class="ez-push-select"
                name="priority"
              >

                ${Object.entries(
                  PRIORITY
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
              class="ez-push-field"
            >
              <label>
                الجمهور
              </label>

              <select
                class="ez-push-select"
                name="audience"
              >

                <option value="all">
                  جميع الجمهور
                </option>

                <option value="news">
                  الأخبار
                </option>

                <option value="breaking">
                  عاجل
                </option>

                <option value="live">
                  البث
                </option>

                <option value="video">
                  الفيديو
                </option>

              </select>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-push-btn"
          data-push-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-push-btn
            primary
          "
          data-push-action="save-campaign"
        >
          حفظ الحملة
        </button>
      `
    );
  }

  function saveCampaign() {
    const form =
      document.querySelector(
        "#ez-push-campaign-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const campaign = {
      id:
        uid("push-campaign"),

      name:
        String(
          data.get(
            "name"
          ) || ""
        ).trim(),

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
        "custom",

      priority:
        data.get(
          "priority"
        ) ||
        "normal",

      audience:
        data.get(
          "audience"
        ) ||
        "all",

      enabled:
        true,

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.campaigns.push(
      campaign
    );

    addEvent(
      "campaign_created",
      "تم إنشاء حملة Push.",
      {
        id:
          campaign.id
      }
    );

    save();

    closeModal();

    render();

    notify(
      "تم حفظ الحملة.",
      "success"
    );
  }

  function toggleCampaign(
    id
  ) {
    const campaign =
      state.campaigns.find(
        (item) =>
          item.id === id
      );

    if (!campaign) {
      return;
    }

    campaign.enabled =
      !campaign.enabled;

    campaign.updatedAt =
      now();

    addEvent(
      "campaign_toggle",
      campaign.enabled
        ? "تم تفعيل حملة Push."
        : "تم إيقاف حملة Push.",
      {
        id
      }
    );

    save();

    render();
  }

  function deleteCampaign(
    id
  ) {
    if (
      !window.confirm(
        "هل تريد حذف حملة Push؟"
      )
    ) {
      return;
    }

    state.campaigns =
      state.campaigns.filter(
        (campaign) =>
          campaign.id !== id
      );

    addEvent(
      "campaign_deleted",
      "تم حذف حملة Push.",
      {
        id
      }
    );

    save();

    render();

    notify(
      "تم حذف الحملة.",
      "success"
    );
  }

  function openDetails(
    id
  ) {
    const item =
      state.queue.find(
        (queueItem) =>
          queueItem.id === id
      );

    if (!item) {
      return;
    }

    openModal(
      "تفاصيل عملية Push",
      `
        <div
          class="ez-push-form"
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
            PRIORITY[
              item.priority
            ] ||
              item.priority
          )}

          ${detail(
            "الحالة",
            STATUS[
              item.status
            ] ||
              item.status
          )}

          ${detail(
            "الجمهور",
            item.audience
          )}

          ${detail(
            "المزود",
            item.provider
          )}

          <div
            class="
              ez-push-field
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

          ${
            item.error
              ? `
                <div
                  class="
                    ez-push-field
                    full
                  "
                >

                  <label>
                    حالة الموصل
                  </label>

                  <div
                    style="
                      padding:14px;
                      background:#fff8e8;
                      border-radius:12px;
                      color:#8b671a;
                      line-height:1.8;
                    "
                  >
                    ${escapeHtml(
                      item.error
                    )}
                  </div>

                </div>
              `
              : ""
          }

        </div>
      `,
      `
        <button
          class="ez-push-btn"
          data-push-action="close"
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
        class="ez-push-field"
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

  function saveSettings() {
    document
      .querySelectorAll(
        "[data-push-setting]"
      )
      .forEach(
        (input) => {
          state.settings[
            input.dataset
              .pushSetting
          ] =
            input.checked;
        }
      );

    const provider =
      document.querySelector(
        "#ez-push-provider"
      );

    const providerStatus =
      document.querySelector(
        "#ez-push-provider-status"
      );

    const dedupe =
      document.querySelector(
        "#ez-push-dedupe"
      );

    const defaultPriority =
      document.querySelector(
        "#ez-push-default-priority"
      );

    if (provider) {
      state.settings.provider =
        provider.value;
    }

    if (providerStatus) {
      state.settings
        .providerConnected =
        providerStatus.value ===
        "true";
    }

    if (dedupe) {
      state.settings
        .deduplicateWindowMinutes =
        Math.max(
          1,
          Math.min(
            1440,
            Number(
              dedupe.value
            ) || 30
          )
        );
    }

    if (
      defaultPriority
    ) {
      state.settings
        .defaultPriority =
        defaultPriority.value;
    }

    addEvent(
      "settings_updated",
      "تم تحديث إعدادات Push."
    );

    save();

    render();

    notify(
      "تم حفظ إعدادات Push.",
      "success"
    );
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#push-command-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-push-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .pushTab;

              state.search =
                "";

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-push-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .pushAction;

              const id =
                button.dataset
                  .id;

              if (
                action ===
                "new"
              ) {
                openPushForm();
                return;
              }

              if (
                action ===
                "save-push"
              ) {
                savePush();
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
                  processOne(
                    item
                  );

                  save();
                  render();

                  notify(
                    "تمت معالجة عملية Push.",
                    "success"
                  );
                }

                return;
              }

              if (
                action ===
                "details"
              ) {
                openDetails(id);
                return;
              }

              if (
                action ===
                "cancel"
              ) {
                cancelPush(id);
                return;
              }

              if (
                action ===
                "new-campaign"
              ) {
                createCampaign();
                return;
              }

              if (
                action ===
                "save-campaign"
              ) {
                saveCampaign();
                return;
              }

              if (
                action ===
                "send-campaign"
              ) {
                sendCampaign(id);
                return;
              }

              if (
                action ===
                "toggle-campaign"
              ) {
                toggleCampaign(id);
                return;
              }

              if (
                action ===
                "delete-campaign"
              ) {
                deleteCampaign(id);
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
                    "هل تريد مسح سجل Push؟"
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

    const search =
      section.querySelector(
        "#ez-push-search"
      );

    if (search) {
      search.addEventListener(
        "input",
        (event) => {
          state.search =
            event.target.value;

          render();
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-push-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        () => {
          state.search =
            status.value ===
            "all"
              ? ""
              : status.value;

          render();
        }
      );
    }
  }

  function bindModalEvents() {
    const modal =
      document.querySelector(
        "#ez-push-command-modal"
      );

    if (!modal) {
      return;
    }

    modal
      .querySelectorAll(
        "[data-push-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .pushAction;

              if (
                action ===
                "close"
              ) {
                closeModal();
              }

              if (
                action ===
                "save-push"
              ) {
                savePush();
              }

              if (
                action ===
                "save-campaign"
              ) {
                saveCampaign();
              }
            }
          );
        }
      );

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
        "#push-command-section"
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

  function create(
    input = {}
  ) {
    return createPush(
      input
    );
  }

  function process(
    id
  ) {
    if (id) {
      const item =
        state.queue.find(
          (queueItem) =>
            queueItem.id === id
        );

      if (!item) {
        return null;
      }

      processOne(item);

      save();

      return clone(
        item
      );
    }

    processQueue();

    return getStatus();
  }

  function getQueue() {
    return clone(
      state.queue
    );
  }

  function getCampaigns() {
    return clone(
      state.campaigns
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

      provider:
        state.settings
          .provider,

      providerConnected:
        Boolean(
          state.settings
            .providerConnected
        ),

      metrics:
        getMetrics(),

      updatedAt:
        now()
    };
  }

  /*
   * استقبال الأحداث المهمة من المنصة.
   */

  window.addEventListener(
    "ezmedia:breaking:created",
    (event) => {
      if (
        !state.settings
          .allowBreaking
      ) {
        return;
      }

      const detail =
        event.detail || {};

      createPush({
        title:
          "عاجل: " +
          (
            detail.title ||
            detail.headline ||
            "خبر عاجل"
          ),

        message:
          detail.message ||
          detail.summary ||
          "خبر عاجل جديد من EZ MEDIA.",

        type:
          "breaking",

        priority:
          "critical",

        audience:
          "breaking",

        contentId:
          detail.id ||
          detail.contentId ||
          "",

        dedupeKey:
          "breaking:" +
          (
            detail.id ||
            detail.title ||
            ""
          )
      });
    }
  );

  window.addEventListener(
    "ezmedia:live:started",
    (event) => {
      if (
        !state.settings
          .allowLive
      ) {
        return;
      }

      const detail =
        event.detail || {};

      createPush({
        title:
          "بدأ بث مباشر",

        message:
          detail.title ||
          detail.name ||
          "بدأ بث مباشر جديد.",

        type:
          "live",

        priority:
          "high",

        audience:
          "live",

        dedupeKey:
          "live:" +
          (
            detail.id ||
            detail.channelId ||
            ""
          )
      });
    }
  );

  window.addEventListener(
    "ezmedia:content:published",
    (event) => {
      const detail =
        event.detail || {};

      if (
        !detail.title &&
        !detail.headline
      ) {
        return;
      }

      createPush({
        title:
          detail.title ||
          detail.headline,

        message:
          detail.summary ||
          "تم نشر محتوى جديد.",

        type:
          detail.type ||
          "news",

        priority:
          "normal",

        audience:
          "news",

        contentId:
          detail.id ||
          detail.contentId ||
          "",

        dedupeKey:
          "content:" +
          (
            detail.id ||
            ""
          )
      });
    }
  );

  window.EZMediaPushCommand = {
    module:
      MODULE,

    show,
    hide,
    refresh,

    create,
    process,

    getQueue,
    getCampaigns,
    getSettings,
    getStatus
  };

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
    "EZ MEDIA 11.0 — Push Command loaded."
  );
})();
