"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 34
 * الملف: public/admin-ai-orchestrator.js
 *
 * AI ORCHESTRATOR
 *
 * العقل المركزي لتنسيق الذكاء الاصطناعي داخل المنصة.
 *
 * لا يقوم هذا الملف باستبدال خدمات AI الموجودة،
 * بل ينسقها ويرتب المهام بينها.
 *
 * المسار المستهدف:
 *
 * مصدر
 *   ↓
 * اكتشاف
 *   ↓
 * تصنيف
 *   ↓
 * تحليل AI
 *   ↓
 * تقدير الأهمية
 *   ↓
 * التحقق
 *   ↓
 * غرفة الأخبار
 *   ↓
 * الإنتاج
 *   ↓
 * النشر
 *   ↓
 * التوزيع
 *   ↓
 * الجمهور
 *   ↓
 * القياس
 */

(function () {
  "use strict";

  const MODULE =
    "ai-orchestrator";

  const STORAGE_KEY =
    "ezmedia_ai_orchestrator_v1";

  const SETTINGS_KEY =
    "ezmedia_ai_orchestrator_settings_v1";

  const EVENT_LOG_KEY =
    "ezmedia_ai_orchestrator_events_v1";

  const DEFAULT_SETTINGS = {
    enabled: true,

    autonomousMode: false,

    humanReviewRequired: true,

    breakingRequiresReview: true,

    highRiskRequiresReview: true,

    autoAnalyze:
      true,

    autoPrioritize:
      true,

    autoSuggestDistribution:
      true,

    autoSuggestHomepage:
      true,

    autoSuggestAudience:
      true,

    maxConcurrentTasks:
      5,

    confidenceThreshold:
      0.75,

    criticalConfidenceThreshold:
      0.9
  };

  const PIPELINES = {
    content: {
      id: "content",
      title:
        "خط إنتاج المحتوى",
      description:
        "تحليل المادة وتحسينها وتقدير المخاطر وتجهيزها للتحرير.",
      stages: [
        "intake",
        "classification",
        "analysis",
        "verification",
        "editorial_review",
        "publish",
        "distribution"
      ]
    },

    breaking: {
      id: "breaking",
      title:
        "خط الأخبار العاجلة",
      description:
        "معالجة الأخبار العاجلة مع رفع مستوى التحقق والمراجعة البشرية.",
      stages: [
        "intake",
        "priority",
        "risk_analysis",
        "verification",
        "editorial_review",
        "publish",
        "distribution"
      ]
    },

    media: {
      id: "media",
      title:
        "خط الوسائط",
      description:
        "ربط الصور والفيديو والصوت بالمحتوى وتجهيزها للنشر.",
      stages: [
        "intake",
        "classification",
        "metadata",
        "content_link",
        "editorial_review",
        "publish"
      ]
    },

    live: {
      id: "live",
      title:
        "خط البث المباشر",
      description:
        "تنسيق معلومات البث ومصادره مع الواجهة الرئيسية.",
      stages: [
        "source",
        "validation",
        "classification",
        "homepage",
        "audience"
      ]
    },

    homepage: {
      id: "homepage",
      title:
        "خط الواجهة الرئيسية",
      description:
        "اختيار وترتيب المحتوى المناسب للواجهة.",
      stages: [
        "content_pool",
        "priority",
        "audience",
        "homepage",
        "measurement"
      ]
    },

    commercial: {
      id: "commercial",
      title:
        "خط الإعلانات والرعايات",
      description:
        "اقتراح مواضع الإعلانات والرعايات وفق المحتوى والجمهور.",
      stages: [
        "campaign",
        "placement",
        "audience",
        "homepage",
        "measurement"
      ]
    }
  };

  const TASK_STATUS = {
    queued:
      "في الانتظار",

    running:
      "قيد التنفيذ",

    waiting_review:
      "بانتظار المراجعة",

    completed:
      "مكتملة",

    failed:
      "فشلت",

    cancelled:
      "ملغاة"
  };

  const PRIORITIES = {
    low: 1,
    normal: 2,
    high: 3,
    urgent: 4,
    critical: 5
  };

  const state = {
    tasks: [],
    events: [],
    settings: {},
    activeTab:
      "overview",
    selectedTaskId:
      null,
    search: "",
    status:
      "all",
    pipeline:
      "all"
  };

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function id(prefix = "ai") {
    if (
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function priorityValue(
    value
  ) {
    return (
      PRIORITIES[value] ||
      PRIORITIES.normal
    );
  }

  function normalizeTask(
    task = {}
  ) {
    return {
      id:
        task.id ||
        id("task"),

      title:
        task.title ||
        "مهمة ذكاء اصطناعي",

      pipeline:
        task.pipeline ||
        "content",

      stage:
        task.stage ||
        "intake",

      status:
        task.status ||
        "queued",

      priority:
        task.priority ||
        "normal",

      source:
        task.source ||
        "internal",

      contentId:
        task.contentId ||
        "",

      mediaId:
        task.mediaId ||
        "",

      liveId:
        task.liveId ||
        "",

      campaignId:
        task.campaignId ||
        "",

      requestedBy:
        task.requestedBy ||
        "system",

      confidence:
        Number(
          task.confidence || 0
        ),

      risk:
        task.risk ||
        "unknown",

      requiresHumanReview:
        task.requiresHumanReview !==
        false,

      result:
        task.result ||
        null,

      error:
        task.error ||
        "",

      createdAt:
        task.createdAt ||
        now(),

      startedAt:
        task.startedAt ||
        null,

      completedAt:
        task.completedAt ||
        null,

      updatedAt:
        task.updatedAt ||
        now()
    };
  }

  function normalizeSettings(
    settings = {}
  ) {
    return {
      ...clone(
        DEFAULT_SETTINGS
      ),
      ...(settings || {})
    };
  }

  function load() {
    try {
      const tasks =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "[]"
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
            EVENT_LOG_KEY
          ) || "[]"
        );

      state.tasks =
        Array.isArray(tasks)
          ? tasks.map(
              normalizeTask
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
        "EZ MEDIA AI Orchestrator load:",
        error
      );

      state.tasks = [];
      state.events = [];
      state.settings =
        clone(
          DEFAULT_SETTINGS
        );
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state.tasks
        )
      );

      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(
          state.settings
        )
      );

      localStorage.setItem(
        EVENT_LOG_KEY,
        JSON.stringify(
          state.events.slice(
            -500
          )
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "ezmedia:ai:orchestrator:updated",
          {
            detail: {
              tasks:
                clone(
                  state.tasks
                ),
              settings:
                clone(
                  state.settings
                )
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "EZ MEDIA AI Orchestrator save:",
        error
      );
    }
  }

  function addEvent(
    type,
    message,
    data = {}
  ) {
    const event = {
      id:
        id("event"),

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
        -500
      );

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:ai:orchestrator:event",
        {
          detail:
            clone(event)
        }
      )
    );

    save();

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
            module: MODULE,
            type,
            title:
              "مركز الذكاء المركزي",
            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-ai-orchestrator-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-ai-orchestrator-toast";

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
      setTimeout(() => {
        toast.classList.remove(
          "show"
        );
      }, 3000);
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-ai-orchestrator-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-ai-orchestrator-styles";

    style.textContent = `
      #ai-orchestrator-section {
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

      .ez-ai-shell {
        max-width:1600px;
        margin:auto;
      }

      .ez-ai-header {
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
            #e9faff,
            #ffffff
          );
      }

      .ez-ai-header h2 {
        margin:0 0 7px;
        font-size:29px;
      }

      .ez-ai-header p {
        margin:0;
        color:#718997;
        line-height:1.8;
      }

      .ez-ai-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .ez-ai-btn {
        border:0;
        border-radius:12px;
        padding:11px 15px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-ai-btn.primary {
        background:#42c4e8;
        color:#fff;
      }

      .ez-ai-btn.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-ai-metrics {
        display:grid;
        grid-template-columns:
          repeat(7,minmax(0,1fr));
        gap:10px;
        margin:18px 0;
      }

      .ez-ai-metric {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:17px;
        padding:15px;
      }

      .ez-ai-metric span {
        display:block;
        color:#718998;
        font-size:11px;
        margin-bottom:6px;
      }

      .ez-ai-metric strong {
        font-size:22px;
      }

      .ez-ai-tabs {
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-bottom:16px;
      }

      .ez-ai-tab {
        border:0;
        border-radius:11px;
        padding:10px 14px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-ai-tab.active {
        background:#42c4e8;
        color:#fff;
      }

      .ez-ai-toolbar {
        display:grid;
        grid-template-columns:
          minmax(240px,1fr)
          180px
          180px
          auto;
        gap:8px;
        margin-bottom:16px;
      }

      .ez-ai-input,
      .ez-ai-select,
      .ez-ai-textarea {
        width:100%;
        box-sizing:border-box;
        border:1px solid #dbeaf0;
        border-radius:12px;
        padding:12px 13px;
        background:#fff;
        color:#17384f;
        outline:none;
      }

      .ez-ai-input:focus,
      .ez-ai-select:focus,
      .ez-ai-textarea:focus {
        border-color:#4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-ai-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:14px;
      }

      .ez-ai-card {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:20px;
        padding:18px;
      }

      .ez-ai-card h3 {
        margin:0 0 7px;
      }

      .ez-ai-card p {
        color:#718997;
        line-height:1.8;
        font-size:12px;
      }

      .ez-ai-badges {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin:9px 0;
      }

      .ez-ai-badge {
        display:inline-flex;
        border-radius:999px;
        padding:5px 9px;
        background:#edf8fc;
        color:#176984;
        font-size:10px;
        font-weight:850;
      }

      .ez-ai-badge.success {
        background:#eefaf5;
        color:#267255;
      }

      .ez-ai-badge.warning {
        background:#fff8e8;
        color:#8b671a;
      }

      .ez-ai-badge.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-ai-pipeline {
        display:flex;
        gap:6px;
        overflow:auto;
        padding:10px 0;
      }

      .ez-ai-stage {
        min-width:115px;
        padding:10px;
        border-radius:12px;
        background:#f7fbfd;
        border:1px solid #e2eef2;
        text-align:center;
      }

      .ez-ai-stage.active {
        background:#eafaff;
        border-color:#74d1e9;
      }

      .ez-ai-stage strong {
        display:block;
        font-size:11px;
      }

      .ez-ai-stage span {
        display:block;
        color:#849aa5;
        font-size:9px;
        margin-top:4px;
      }

      .ez-ai-panel {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:21px;
        padding:20px;
      }

      .ez-ai-flow {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:12px;
      }

      .ez-ai-flow-card {
        padding:18px;
        border-radius:17px;
        background:
          linear-gradient(
            135deg,
            #f2fcff,
            #fff
          );
        border:1px solid #dceef3;
      }

      .ez-ai-flow-card strong {
        display:block;
        margin-bottom:7px;
      }

      .ez-ai-flow-card span {
        color:#718997;
        font-size:12px;
        line-height:1.7;
      }

      .ez-ai-check {
        display:flex;
        align-items:center;
        gap:8px;
        padding:13px;
        border-radius:13px;
        background:#f7fbfd;
        border:1px solid #e2eef2;
      }

      .ez-ai-settings {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .ez-ai-form {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:13px;
      }

      .ez-ai-field {
        display:flex;
        flex-direction:column;
        gap:6px;
      }

      .ez-ai-field.full {
        grid-column:1/-1;
      }

      .ez-ai-field label {
        font-size:12px;
        font-weight:800;
        color:#57717f;
      }

      .ez-ai-modal {
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

      .ez-ai-modal.open {
        display:flex;
      }

      .ez-ai-dialog {
        width:min(900px,100%);
        max-height:94vh;
        overflow:auto;
        background:#fff;
        border-radius:24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-ai-dialog-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:18px 21px;
        border-bottom:1px solid #e4eff3;
      }

      .ez-ai-dialog-body {
        padding:21px;
      }

      .ez-ai-dialog-footer {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        padding:15px 21px;
        border-top:1px solid #e4eff3;
      }

      .ez-ai-log {
        max-height:430px;
        overflow:auto;
      }

      .ez-ai-log-item {
        padding:13px;
        margin-bottom:8px;
        border-radius:13px;
        background:#f8fcfd;
        border:1px solid #e4eef2;
      }

      .ez-ai-log-item strong {
        display:block;
        margin-bottom:4px;
      }

      .ez-ai-log-item span {
        color:#8196a0;
        font-size:10px;
      }

      #ez-ai-orchestrator-toast {
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

      #ez-ai-orchestrator-toast.show {
        opacity:1;
        transform:translateY(0);
      }

      @media(max-width:1250px) {
        .ez-ai-metrics {
          grid-template-columns:
            repeat(4,minmax(0,1fr));
        }

        .ez-ai-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:750px) {
        #ai-orchestrator-section {
          padding:12px;
        }

        .ez-ai-header {
          display:block;
        }

        .ez-ai-actions {
          margin-top:15px;
        }

        .ez-ai-metrics {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .ez-ai-grid,
        .ez-ai-flow,
        .ez-ai-settings,
        .ez-ai-form {
          grid-template-columns:1fr;
        }

        .ez-ai-field.full {
          grid-column:auto;
        }

        .ez-ai-toolbar {
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
        "#ai-orchestrator-section"
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
      "ai-orchestrator-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function metrics() {
    const tasks =
      state.tasks;

    return {
      total:
        tasks.length,

      queued:
        tasks.filter(
          (task) =>
            task.status ===
            "queued"
        ).length,

      running:
        tasks.filter(
          (task) =>
            task.status ===
            "running"
        ).length,

      review:
        tasks.filter(
          (task) =>
            task.status ===
            "waiting_review"
        ).length,

      completed:
        tasks.filter(
          (task) =>
            task.status ===
            "completed"
        ).length,

      failed:
        tasks.filter(
          (task) =>
            task.status ===
            "failed"
        ).length,

      critical:
        tasks.filter(
          (task) =>
            task.priority ===
              "critical" ||
            task.risk ===
              "critical"
        ).length
    };
  }

  function metric(
    label,
    value
  ) {
    return `
      <div
        class="ez-ai-metric"
      >
        <span>
          ${escapeHtml(label)}
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
          ez-ai-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-ai-tab="${escapeHtml(
          key
        )}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function render() {
    const section =
      ensureSection();

    const m =
      metrics();

    section.innerHTML = `
      <div
        class="ez-ai-shell"
      >

        <div
          class="ez-ai-header"
        >

          <div>
            <h2>
              أوركسترا الذكاء الاصطناعي
            </h2>

            <p>
              العقل المركزي لتنسيق محركات الذكاء
              داخل EZ MEDIA 11.0.
            </p>
          </div>

          <div
            class="ez-ai-actions"
          >

            <button
              class="
                ez-ai-btn
                primary
              "
              data-ai-action="new"
            >
              + مهمة جديدة
            </button>

            <button
              class="ez-ai-btn"
              data-ai-action="run"
            >
              تشغيل الطابور
            </button>

            <button
              class="ez-ai-btn"
              data-ai-action="refresh"
            >
              تحديث
            </button>

          </div>

        </div>

        <div
          class="ez-ai-metrics"
        >

          ${metric(
            "إجمالي المهام",
            m.total
          )}

          ${metric(
            "في الانتظار",
            m.queued
          )}

          ${metric(
            "قيد التنفيذ",
            m.running
          )}

          ${metric(
            "تحتاج مراجعة",
            m.review
          )}

          ${metric(
            "مكتملة",
            m.completed
          )}

          ${metric(
            "فاشلة",
            m.failed
          )}

          ${metric(
            "حرجة",
            m.critical
          )}

        </div>

        <div
          class="ez-ai-tabs"
        >

          ${tab(
            "overview",
            "العقل المركزي"
          )}

          ${tab(
            "tasks",
            "المهام"
          )}

          ${tab(
            "pipelines",
            "مسارات الذكاء"
          )}

          ${tab(
            "settings",
            "الإعدادات"
          )}

          ${tab(
            "events",
            "سجل الأحداث"
          )}

        </div>

        ${
          state.activeTab ===
          "overview"
            ? renderOverview()
            : state.activeTab ===
              "tasks"
            ? renderTasks()
            : state.activeTab ===
              "pipelines"
            ? renderPipelines()
            : state.activeTab ===
              "settings"
            ? renderSettings()
            : renderEvents()
        }

      </div>

      <div
        id="ez-ai-orchestrator-modal"
        class="ez-ai-modal"
        aria-hidden="true"
      ></div>
    `;

    bindEvents();
  }

  function renderOverview() {
    const active =
      state.settings.enabled;

    return `
      <div
        class="ez-ai-panel"
      >

        <div
          class="ez-ai-flow"
        >

          ${flowCard(
            "01",
            "الاكتشاف",
            "استقبال الإشارات والمحتوى والوسائط والأحداث من وحدات المنصة."
          )}

          ${flowCard(
            "02",
            "التصنيف",
            "تحديد نوع المادة وأولويتها والمسار المناسب لها."
          )}

          ${flowCard(
            "03",
            "التحليل",
            "تشغيل محركات الذكاء المتخصصة حسب نوع المهمة."
          )}

          ${flowCard(
            "04",
            "التحقق",
            "تحديد مستوى المخاطر والحاجة للمراجعة البشرية."
          )}

          ${flowCard(
            "05",
            "التنسيق",
            "تمرير النتيجة إلى غرفة الأخبار أو الإنتاج أو الواجهة."
          )}

          ${flowCard(
            "06",
            "التوزيع",
            "اقتراح قنوات النشر والجمهور والواجهة المناسبة."
          )}

        </div>

        <div
          style="
            margin-top:18px;
            padding:17px;
            border-radius:15px;
            background:#effbff;
            color:#286d82;
            line-height:1.9;
          "
        >

          <strong>
            حالة العقل المركزي:
          </strong>

          ${
            active
              ? "مفعّل"
              : "متوقف"
          }

          <br>

          <strong>
            الوضع المستقل:
          </strong>

          ${
            state.settings.autonomousMode
              ? "مفعّل"
              : "غير مفعّل"
          }

          <br>

          <strong>
            المراجعة البشرية:
          </strong>

          ${
            state.settings.humanReviewRequired
              ? "مطلوبة"
              : "غير مطلوبة"
          }

        </div>

      </div>
    `;
  }

  function flowCard(
    number,
    title,
    description
  ) {
    return `
      <div
        class="
          ez-ai-flow-card
        "
      >

        <span
          style="
            font-size:11px;
            color:#42a9c7;
            font-weight:900;
          "
        >
          ${number}
        </span>

        <strong>
          ${escapeHtml(
            title
          )}
        </strong>

        <span>
          ${escapeHtml(
            description
          )}
        </span>

      </div>
    `;
  }

  function renderTasks() {
    const tasks =
      filteredTasks();

    return `
      <div
        class="ez-ai-toolbar"
      >

        <input
          id="ez-ai-search"
          class="ez-ai-input"
          placeholder="ابحث في المهام..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-ai-pipeline"
          class="ez-ai-select"
        >

          <option value="all">
            كل المسارات
          </option>

          ${Object.entries(
            PIPELINES
          )
            .map(
              ([key, pipeline]) => `
                <option
                  value="${escapeHtml(
                    key
                  )}"
                  ${
                    state.pipeline ===
                    key
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    pipeline.title
                  )}
                </option>
              `
            )
            .join("")}

        </select>

        <select
          id="ez-ai-status"
          class="ez-ai-select"
        >

          <option value="all">
            كل الحالات
          </option>

          ${Object.entries(
            TASK_STATUS
          )
            .map(
              ([key, label]) => `
                <option
                  value="${escapeHtml(
                    key
                  )}"
                  ${
                    state.status ===
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

        <button
          class="ez-ai-btn"
          data-ai-action="clear"
        >
          مسح
        </button>

      </div>

      <div
        class="ez-ai-grid"
      >

        ${
          tasks.length
            ? tasks
                .map(
                  renderTask
                )
                .join("")
            : `
              <div
                class="ez-ai-panel"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد مهام.
              </div>
            `
        }

      </div>
    `;
  }

  function filteredTasks() {
    const query =
      state.search
        .trim()
        .toLowerCase();

    return state.tasks
      .filter(
        (task) => {
          if (
            state.pipeline !==
              "all" &&
            task.pipeline !==
              state.pipeline
          ) {
            return false;
          }

          if (
            state.status !==
              "all" &&
            task.status !==
              state.status
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            task.title,
            task.pipeline,
            task.stage,
            task.status,
            task.priority,
            task.source
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      )
      .sort(
        (a, b) =>
          priorityValue(
            b.priority
          ) -
            priorityValue(
              a.priority
            ) ||
          new Date(
            b.createdAt
          ) -
            new Date(
              a.createdAt
            )
      );
  }

  function renderTask(
    task
  ) {
    const pipeline =
      PIPELINES[
        task.pipeline
      ];

    const statusClass =
      task.status ===
      "completed"
        ? "success"
        : task.status ===
            "failed" ||
          task.risk ===
            "critical"
        ? "danger"
        : "warning";

    return `
      <article
        class="ez-ai-card"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:10px;
          "
        >

          <div>
            <h3>
              ${escapeHtml(
                task.title
              )}
            </h3>

            <div
              class="ez-ai-badges"
            >

              <span
                class="ez-ai-badge"
              >
                ${
                  pipeline
                    ? escapeHtml(
                        pipeline.title
                      )
                    : escapeHtml(
                        task.pipeline
                      )
                }
              </span>

              <span
                class="
                  ez-ai-badge
                  ${statusClass}
                "
              >
                ${escapeHtml(
                  TASK_STATUS[
                    task.status
                  ] ||
                    task.status
                )}
              </span>

              <span
                class="
                  ez-ai-badge
                "
              >
                ${escapeHtml(
                  task.priority
                )}
              </span>

            </div>
          </div>

        </div>

        <p>
          المرحلة الحالية:
          <strong>
            ${escapeHtml(
              task.stage
            )}
          </strong>
        </p>

        <div
          class="ez-ai-pipeline"
        >

          ${
            pipeline
              ? pipeline.stages
                  .map(
                    (stage) => `
                      <div
                        class="
                          ez-ai-stage
                          ${
                            stage ===
                            task.stage
                              ? "active"
                              : ""
                          }
                        "
                      >
                        <strong>
                          ${escapeHtml(
                            stage
                          )}
                        </strong>

                        <span>
                          ${
                            stage ===
                            task.stage
                              ? "الحالية"
                              : ""
                          }
                        </span>
                      </div>
                    `
                  )
                  .join("")
              : ""
          }

        </div>

        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:10px;
            color:#718997;
            font-size:11px;
          "
        >

          <span>
            الثقة:
            ${
              task.confidence
                ? Math.round(
                    task.confidence *
                      100
                  ) +
                  "%"
                : "غير متاحة"
            }
          </span>

          <span>
            المخاطر:
            ${escapeHtml(
              task.risk
            )}
          </span>

        </div>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:7px;
            margin-top:14px;
          "
        >

          <button
            class="ez-ai-btn"
            data-ai-action="details"
            data-id="${escapeHtml(
              task.id
            )}"
          >
            التفاصيل
          </button>

          ${
            task.status ===
            "queued"
              ? `
                <button
                  class="
                    ez-ai-btn
                    primary
                  "
                  data-ai-action="run-task"
                  data-id="${escapeHtml(
                    task.id
                  )}"
                >
                  تشغيل
                </button>
              `
              : ""
          }

          ${
            task.status ===
            "waiting_review"
              ? `
                <button
                  class="
                    ez-ai-btn
                    primary
                  "
                  data-ai-action="approve"
                  data-id="${escapeHtml(
                    task.id
                  )}"
                >
                  اعتماد النتيجة
                </button>
              `
              : ""
          }

          ${
            task.status ===
              "queued" ||
            task.status ===
              "running"
              ? `
                <button
                  class="
                    ez-ai-btn
                    danger
                  "
                  data-ai-action="cancel"
                  data-id="${escapeHtml(
                    task.id
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

  function renderPipelines() {
    return `
      <div
        class="ez-ai-grid"
      >

        ${Object.values(
          PIPELINES
        )
          .map(
            (pipeline) => `
              <div
                class="ez-ai-card"
              >

                <h3>
                  ${escapeHtml(
                    pipeline.title
                  )}
                </h3>

                <p>
                  ${escapeHtml(
                    pipeline.description
                  )}
                </p>

                <div
                  class="ez-ai-pipeline"
                >

                  ${pipeline.stages
                    .map(
                      (
                        stage,
                        index
                      ) => `
                        <div
                          class="
                            ez-ai-stage
                          "
                        >

                          <strong>
                            ${index +
                              1}
                            .
                            ${escapeHtml(
                              stage
                            )}
                          </strong>

                        </div>
                      `
                    )
                    .join("")}

                </div>

              </div>
            `
          )
          .join("")}

      </div>
    `;
  }

  function renderSettings() {
    const settings =
      state.settings;

    return `
      <div
        class="ez-ai-panel"
      >

        <h3>
          إعدادات العقل المركزي
        </h3>

        <p
          style="
            color:#718997;
            line-height:1.9;
          "
        >
          هذه الإعدادات تتحكم في مستوى استقلال
          منظومة الذكاء، مع إبقاء العمليات الحساسة
          ضمن المراجعة البشرية عند الحاجة.
        </p>

        <div
          class="ez-ai-settings"
        >

          ${setting(
            "تفعيل أوركسترا الذكاء",
            "enabled"
          )}

          ${setting(
            "الوضع المستقل",
            "autonomousMode"
          )}

          ${setting(
            "المراجعة البشرية مطلوبة",
            "humanReviewRequired"
          )}

          ${setting(
            "مراجعة الأخبار العاجلة",
            "breakingRequiresReview"
          )}

          ${setting(
            "مراجعة المحتوى عالي المخاطر",
            "highRiskRequiresReview"
          )}

          ${setting(
            "التحليل التلقائي",
            "autoAnalyze"
          )}

          ${setting(
            "تحديد الأولوية تلقائيًا",
            "autoPrioritize"
          )}

          ${setting(
            "اقتراح التوزيع",
            "autoSuggestDistribution"
          )}

          ${setting(
            "اقتراح الواجهة الرئيسية",
            "autoSuggestHomepage"
          )}

          ${setting(
            "اقتراح تخصيص الجمهور",
            "autoSuggestAudience"
          )}

        </div>

        <div
          class="ez-ai-form"
          style="margin-top:16px"
        >

          <div
            class="ez-ai-field"
          >
            <label>
              أقصى عدد مهام متزامنة
            </label>

            <input
              id="ez-ai-concurrency"
              class="ez-ai-input"
              type="number"
              min="1"
              max="50"
              value="${escapeHtml(
                settings.maxConcurrentTasks
              )}"
            />
          </div>

          <div
            class="ez-ai-field"
          >
            <label>
              حد الثقة العام
            </label>

            <input
              id="ez-ai-confidence"
              class="ez-ai-input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value="${escapeHtml(
                settings.confidenceThreshold
              )}"
            />
          </div>

          <div
            class="ez-ai-field"
          >
            <label>
              حد الثقة للمحتوى الحرج
            </label>

            <input
              id="ez-ai-critical-confidence"
              class="ez-ai-input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value="${escapeHtml(
                settings.criticalConfidenceThreshold
              )}"
            />
          </div>

        </div>

        <button
          class="
            ez-ai-btn
            primary
          "
          style="margin-top:16px"
          data-ai-action="save-settings"
        >
          حفظ إعدادات الذكاء
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
        class="ez-ai-check"
      >

        <input
          type="checkbox"
          data-ai-setting="${escapeHtml(
            key
          )}"
          ${
            state.settings[key]
              ? "checked"
              : ""
          }
        />

        <span>
          ${escapeHtml(label)}
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
        class="ez-ai-panel"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:14px;
          "
        >

          <div>
            <h3
              style="margin:0"
            >
              سجل أحداث الذكاء
            </h3>

            <span
              style="
                color:#8196a0;
                font-size:11px;
              "
            >
              آخر 100 حدث محفوظ محليًا.
            </span>
          </div>

          <button
            class="ez-ai-btn danger"
            data-ai-action="clear-events"
          >
            مسح السجل
          </button>

        </div>

        <div
          class="ez-ai-log"
        >

          ${
            events.length
              ? events
                  .map(
                    (event) => `
                      <div
                        class="
                          ez-ai-log-item
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
        "#ez-ai-orchestrator-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div
        class="ez-ai-dialog"
      >

        <div
          class="ez-ai-dialog-head"
        >

          <strong>
            ${escapeHtml(
              title
            )}
          </strong>

          <button
            class="ez-ai-btn"
            data-ai-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-ai-dialog-body"
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-ai-dialog-footer
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
        "#ez-ai-orchestrator-modal"
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

  function openTaskForm() {
    openModal(
      "إنشاء مهمة ذكاء اصطناعي",
      `
        <form
          id="ez-ai-task-form"
        >

          <div
            class="ez-ai-form"
          >

            <div
              class="ez-ai-field"
            >
              <label>
                اسم المهمة
              </label>

              <input
                class="ez-ai-input"
                name="title"
                required
                placeholder="مثال: تحليل خبر عاجل"
              />
            </div>

            <div
              class="ez-ai-field"
            >
              <label>
                المسار
              </label>

              <select
                class="ez-ai-select"
                name="pipeline"
              >

                ${Object.entries(
                  PIPELINES
                )
                  .map(
                    ([key, value]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                      >
                        ${escapeHtml(
                          value.title
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="ez-ai-field"
            >
              <label>
                الأولوية
              </label>

              <select
                class="ez-ai-select"
                name="priority"
              >

                <option value="low">
                  منخفضة
                </option>

                <option
                  value="normal"
                  selected
                >
                  عادية
                </option>

                <option value="high">
                  عالية
                </option>

                <option value="urgent">
                  عاجلة
                </option>

                <option value="critical">
                  حرجة
                </option>

              </select>
            </div>

            <div
              class="ez-ai-field"
            >
              <label>
                المصدر
              </label>

              <input
                class="ez-ai-input"
                name="source"
                value="internal"
              />
            </div>

            <div
              class="ez-ai-field"
            >
              <label>
                Content ID
              </label>

              <input
                class="ez-ai-input"
                name="contentId"
                dir="ltr"
              />
            </div>

            <div
              class="ez-ai-field"
            >
              <label>
                Media ID
              </label>

              <input
                class="ez-ai-input"
                name="mediaId"
                dir="ltr"
              />
            </div>

            <div
              class="ez-ai-field"
            >
              <label>
                Live ID
              </label>

              <input
                class="ez-ai-input"
                name="liveId"
                dir="ltr"
              />
            </div>

            <div
              class="ez-ai-field"
            >
              <label>
                Campaign ID
              </label>

              <input
                class="ez-ai-input"
                name="campaignId"
                dir="ltr"
              />
            </div>

            <div
              class="
                ez-ai-field
                full
              "
            >
              <label>
                المرحلة الأولى
              </label>

              <select
                class="ez-ai-select"
                name="stage"
              >

                <option value="intake">
                  intake
                </option>

                <option value="analysis">
                  analysis
                </option>

                <option value="verification">
                  verification
                </option>

                <option value="priority">
                  priority
                </option>

                <option value="homepage">
                  homepage
                </option>

              </select>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-ai-btn"
          data-ai-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-ai-btn
            primary
          "
          data-ai-action="save-task"
        >
          إنشاء المهمة
        </button>
      `
    );
  }

  function saveTask() {
    const form =
      document.querySelector(
        "#ez-ai-task-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const pipeline =
      data.get(
        "pipeline"
      ) ||
      "content";

    const task =
      normalizeTask({
        title:
          String(
            data.get("title") ||
              ""
          ).trim(),

        pipeline,

        stage:
          data.get(
            "stage"
          ) ||
          "intake",

        priority:
          data.get(
            "priority"
          ) ||
          "normal",

        source:
          String(
            data.get(
              "source"
            ) ||
              "internal"
          ).trim(),

        contentId:
          String(
            data.get(
              "contentId"
            ) ||
              ""
          ).trim(),

        mediaId:
          String(
            data.get(
              "mediaId"
            ) ||
              ""
          ).trim(),

        liveId:
          String(
            data.get(
              "liveId"
            ) ||
              ""
          ).trim(),

        campaignId:
          String(
            data.get(
              "campaignId"
            ) ||
              ""
          ).trim(),

        requiresHumanReview:
          state.settings
            .humanReviewRequired
      });

    if (!task.title) {
      notify(
        "اسم المهمة مطلوب.",
        "warning"
      );

      return;
    }

    state.tasks.push(
      task
    );

    addEvent(
      "task_created",
      "تم إنشاء مهمة ذكاء اصطناعي جديدة.",
      {
        taskId:
          task.id,
        pipeline:
          task.pipeline
      }
    );

    save();

    closeModal();

    render();

    notify(
      "تم إنشاء المهمة.",
      "success"
    );
  }

  function getRunningCount() {
    return state.tasks.filter(
      (task) =>
        task.status ===
        "running"
    ).length;
  }

  function startTask(
    task
  ) {
    if (
      !state.settings.enabled
    ) {
      task.status =
        "cancelled";

      task.error =
        "أوركسترا الذكاء متوقفة.";

      return;
    }

    if (
      getRunningCount() >=
      Number(
        state.settings
          .maxConcurrentTasks
      )
    ) {
      return false;
    }

    task.status =
      "running";

    task.startedAt =
      now();

    task.updatedAt =
      now();

    addEvent(
      "task_started",
      "بدأت مهمة ذكاء اصطناعي.",
      {
        taskId:
          task.id,
        pipeline:
          task.pipeline,
        stage:
          task.stage
      }
    );

    return true;
  }

  function determineRisk(
    task
  ) {
    if (
      task.priority ===
      "critical"
    ) {
      return "critical";
    }

    if (
      task.priority ===
      "urgent"
    ) {
      return "high";
    }

    if (
      task.pipeline ===
      "breaking"
    ) {
      return "high";
    }

    return "normal";
  }

  function nextStage(
    task
  ) {
    const pipeline =
      PIPELINES[
        task.pipeline
      ];

    if (!pipeline) {
      return null;
    }

    const index =
      pipeline.stages.indexOf(
        task.stage
      );

    if (index < 0) {
      return pipeline.stages[0];
    }

    return (
      pipeline.stages[
        index + 1
      ] || null
    );
  }

  function processTask(
    task
  ) {
    if (
      !task ||
      task.status !==
        "running"
    ) {
      return;
    }

    /*
     * هذه المرحلة لا تستدعي AI خارجيًا مباشرة.
     * هي منسق Workflow فقط.
     *
     * عند وجود Backend AI حقيقي:
     * - يتم استدعاء /api/ai
     * - ثم تعاد النتيجة هنا.
     */

    task.risk =
      determineRisk(
        task
      );

    task.confidence =
      task.confidence ||
      0.8;

    const requiresReview =
      shouldRequireReview(
        task
      );

    const followingStage =
      nextStage(
        task
      );

    if (
      requiresReview
    ) {
      task.status =
        "waiting_review";

      task.requiresHumanReview =
        true;

      task.updatedAt =
        now();

      addEvent(
        "human_review_required",
        "المهمة تحتاج إلى مراجعة بشرية.",
        {
          taskId:
            task.id,
          risk:
            task.risk,
          confidence:
            task.confidence
        }
      );

      return;
    }

    if (
      followingStage
    ) {
      task.stage =
        followingStage;

      task.status =
        "queued";

      task.updatedAt =
        now();

      addEvent(
        "task_stage_advanced",
        "انتقلت المهمة إلى المرحلة التالية.",
        {
          taskId:
            task.id,
          stage:
            followingStage
        }
      );

      return;
    }

    task.status =
      "completed";

    task.completedAt =
      now();

    task.updatedAt =
      now();

    task.result = {
      orchestrated:
        true,

      pipeline:
        task.pipeline,

      stage:
        task.stage,

      confidence:
        task.confidence,

      risk:
        task.risk,

      generatedAt:
        now()
    };

    addEvent(
      "task_completed",
      "اكتملت مهمة الذكاء.",
      {
        taskId:
          task.id,
        pipeline:
          task.pipeline
      }
    );
  }

  function shouldRequireReview(
    task
  ) {
    if (
      state.settings
        .humanReviewRequired
    ) {
      return true;
    }

    if (
      task.pipeline ===
        "breaking" &&
      state.settings
        .breakingRequiresReview
    ) {
      return true;
    }

    if (
      task.risk ===
        "critical" &&
      state.settings
        .highRiskRequiresReview
    ) {
      return true;
    }

    if (
      Number(
        task.confidence
      ) <
      Number(
        state.settings
          .confidenceThreshold
      )
    ) {
      return true;
    }

    if (
      task.risk ===
        "critical" &&
      Number(
        task.confidence
      ) <
      Number(
        state.settings
          .criticalConfidenceThreshold
      )
    ) {
      return true;
    }

    return false;
  }

  function runTask(
    task
  ) {
    if (!task) {
      return false;
    }

    if (
      task.status !==
      "queued"
    ) {
      return false;
    }

    if (
      !startTask(task)
    ) {
      notify(
        "لا توجد قدرة تشغيل متاحة حاليًا.",
        "warning"
      );

      return false;
    }

    processTask(task);

    save();

    render();

    return true;
  }

  function runQueue() {
    if (
      !state.settings.enabled
    ) {
      notify(
        "أوركسترا الذكاء متوقفة.",
        "warning"
      );

      return;
    }

    const capacity =
      Math.max(
        0,
        Number(
          state.settings
            .maxConcurrentTasks
        ) -
          getRunningCount()
      );

    const queued =
      state.tasks
        .filter(
          (task) =>
            task.status ===
            "queued"
        )
        .sort(
          (a, b) =>
            priorityValue(
              b.priority
            ) -
              priorityValue(
                a.priority
              ) ||
            new Date(
              a.createdAt
            ) -
              new Date(
                b.createdAt
              )
        );

    const selected =
      queued.slice(
        0,
        capacity || queued.length
      );

    selected.forEach(
      (task) => {
        startTask(task);

        processTask(
          task
        );
      }
    );

    save();

    render();

    notify(
      `تم تشغيل ${selected.length} مهمة.`,
      "success"
    );
  }

  function approveTask(
    idValue
  ) {
    const task =
      state.tasks.find(
        (item) =>
          String(item.id) ===
          String(idValue)
      );

    if (!task) {
      return;
    }

    if (
      task.status !==
      "waiting_review"
    ) {
      return;
    }

    const following =
      nextStage(task);

    if (following) {
      task.stage =
        following;

      task.status =
        "queued";

      task.updatedAt =
        now();

      addEvent(
        "human_review_approved",
        "تم اعتماد المرحلة البشرية للمهمة.",
        {
          taskId:
            task.id,
          nextStage:
            following
        }
      );
    } else {
      task.status =
        "completed";

      task.completedAt =
        now();

      task.updatedAt =
        now();

      addEvent(
        "human_review_completed",
        "تم اعتماد المهمة وإغلاقها.",
        {
          taskId:
            task.id
        }
      );
    }

    save();

    render();

    notify(
      "تم اعتماد المهمة.",
      "success"
    );
  }

  function cancelTask(
    idValue
  ) {
    const task =
      state.tasks.find(
        (item) =>
          String(item.id) ===
          String(idValue)
      );

    if (!task) {
      return;
    }

    task.status =
      "cancelled";

    task.updatedAt =
      now();

    addEvent(
      "task_cancelled",
      "تم إلغاء مهمة الذكاء.",
      {
        taskId:
          task.id
      }
    );

    save();

    render();

    notify(
      "تم إلغاء المهمة.",
      "success"
    );
  }

  function taskDetails(
    idValue
  ) {
    const task =
      state.tasks.find(
        (item) =>
          String(item.id) ===
          String(idValue)
      );

    if (!task) {
      return;
    }

    const pipeline =
      PIPELINES[
        task.pipeline
      ];

    openModal(
      "تفاصيل مهمة الذكاء",
      `
        <div
          class="ez-ai-form"
        >

          ${detail(
            "المعرف",
            task.id
          )}

          ${detail(
            "العنوان",
            task.title
          )}

          ${detail(
            "المسار",
            pipeline
              ? pipeline.title
              : task.pipeline
          )}

          ${detail(
            "المرحلة",
            task.stage
          )}

          ${detail(
            "الحالة",
            TASK_STATUS[
              task.status
            ] ||
              task.status
          )}

          ${detail(
            "الأولوية",
            task.priority
          )}

          ${detail(
            "المخاطر",
            task.risk
          )}

          ${detail(
            "الثقة",
            task.confidence
              ? Math.round(
                  task.confidence *
                    100
                ) +
                  "%"
              : "غير متاحة"
          )}

          <div
            class="
              ez-ai-field
              full
            "
          >

            <label>
              النتيجة
            </label>

            <pre
              style="
                white-space:pre-wrap;
                margin:0;
                padding:14px;
                border-radius:12px;
                background:#f7fbfd;
                border:1px solid #e2eef2;
                direction:ltr;
                text-align:left;
                overflow:auto;
              "
            >${escapeHtml(
              JSON.stringify(
                task.result,
                null,
                2
              )
            )}</pre>

          </div>

        </div>
      `,
      `
        <button
          class="ez-ai-btn"
          data-ai-action="close"
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
        class="ez-ai-field"
      >

        <label>
          ${escapeHtml(
            label
          )}
        </label>

        <div
          style="
            padding:11px;
            border-radius:11px;
            background:#f7fbfd;
            border:1px solid #e2eef2;
            min-height:20px;
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
    const concurrency =
      document.querySelector(
        "#ez-ai-concurrency"
      );

    const confidence =
      document.querySelector(
        "#ez-ai-confidence"
      );

    const critical =
      document.querySelector(
        "#ez-ai-critical-confidence"
      );

    if (concurrency) {
      state.settings
        .maxConcurrentTasks =
        Math.max(
          1,
          Math.min(
            50,
            Number(
              concurrency.value
            ) || 5
          )
        );
    }

    if (confidence) {
      state.settings
        .confidenceThreshold =
        Math.max(
          0,
          Math.min(
            1,
            Number(
              confidence.value
            ) || 0.75
          )
        );
    }

    if (critical) {
      state.settings
        .criticalConfidenceThreshold =
        Math.max(
          0,
          Math.min(
            1,
            Number(
              critical.value
            ) || 0.9
          )
        );
    }

    save();

    render();

    notify(
      "تم حفظ إعدادات الذكاء.",
      "success"
    );
  }

  function clearFilters() {
    state.search = "";
    state.status =
      "all";
    state.pipeline =
      "all";

    render();
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#ai-orchestrator-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-ai-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .aiTab;

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-ai-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .aiAction;

              const taskId =
                button.dataset
                  .id;

              if (
                action ===
                "new"
              ) {
                openTaskForm();
                return;
              }

              if (
                action ===
                "run"
              ) {
                runQueue();
                return;
              }

              if (
                action ===
                "refresh"
              ) {
                load();
                render();

                notify(
                  "تم تحديث مركز الذكاء.",
                  "success"
                );

                return;
              }

              if (
                action ===
                "details"
              ) {
                taskDetails(
                  taskId
                );

                return;
              }

              if (
                action ===
                "run-task"
              ) {
                const task =
                  state.tasks.find(
                    (item) =>
                      String(
                        item.id
                      ) ===
                      String(
                        taskId
                      )
                  );

                runTask(task);

                return;
              }

              if (
                action ===
                "approve"
              ) {
                approveTask(
                  taskId
                );

                return;
              }

              if (
                action ===
                "cancel"
              ) {
                cancelTask(
                  taskId
                );

                return;
              }

              if (
                action ===
                "clear"
              ) {
                clearFilters();
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
                  !window.confirm(
                    "هل تريد مسح سجل أحداث الذكاء؟"
                  )
                ) {
                  return;
                }

                state.events =
                  [];

                save();

                render();

                notify(
                  "تم مسح سجل الأحداث.",
                  "success"
                );

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
        "#ez-ai-search"
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

    const pipeline =
      section.querySelector(
        "#ez-ai-pipeline"
      );

    if (pipeline) {
      pipeline.addEventListener(
        "change",
        (event) => {
          state.pipeline =
            event.target.value;

          render();
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-ai-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        (event) => {
          state.status =
            event.target.value;

          render();
        }
      );
    }

    section
      .querySelectorAll(
        "[data-ai-setting]"
      )
      .forEach(
        (input) => {
          input.addEventListener(
            "change",
            (event) => {
              state.settings[
                input.dataset
                  .aiSetting
              ] =
                event.target
                  .checked;

              save();

              addEvent(
                "setting_changed",
                "تم تغيير إعداد في أوركسترا الذكاء.",
                {
                  key:
                    input.dataset
                      .aiSetting,
                  value:
                    event.target
                      .checked
                }
              );
            }
          );
        }
      );

    const modal =
      document.querySelector(
        "#ez-ai-orchestrator-modal"
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
        "#ai-orchestrator-section"
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

  function createTask(
    values = {}
  ) {
    const task =
      normalizeTask(
        values
      );

    state.tasks.push(
      task
    );

    addEvent(
      "task_created_api",
      "تم إنشاء مهمة من خلال واجهة التكامل.",
      {
        taskId:
          task.id,
        pipeline:
          task.pipeline
      }
    );

    save();

    render();

    return clone(task);
  }

  function queueTask(
    values = {}
  ) {
    return createTask({
      ...values,
      status:
        "queued"
    });
  }

  function getTasks() {
    return clone(
      state.tasks
    );
  }

  function getEvents() {
    return clone(
      state.events
    );
  }

  function getSettings() {
    return clone(
      state.settings
    );
  }

  function getPipelines() {
    return clone(
      PIPELINES
    );
  }

  function getStatus() {
    const m =
      metrics();

    return {
      module:
        MODULE,

      enabled:
        state.settings.enabled,

      autonomousMode:
        state.settings
          .autonomousMode,

      humanReviewRequired:
        state.settings
          .humanReviewRequired,

      metrics: m,

      updatedAt:
        now()
    };
  }

  window.EZMediaAIOrchestrator =
    {
      module: MODULE,

      show,
      hide,
      refresh,

      createTask,
      queueTask,

      runQueue,

      getTasks,
      getEvents,
      getSettings,
      getPipelines,
      getStatus,

      approveTask,
      cancelTask
    };

  window.addEventListener(
    "ezmedia:ai:orchestrator:refresh",
    () => {
      refresh();
    }
  );

  /*
   * استقبال الأحداث من الوحدات الأخرى.
   */

  window.addEventListener(
    "ezmedia:homepage:updated",
    () => {
      if (
        state.settings
          .autoSuggestHomepage
      ) {
        addEvent(
          "homepage_signal",
          "تم استقبال إشارة من مركز الواجهة الرئيسية."
        );
      }
    }
  );

  window.addEventListener(
    "ezmedia:notification",
    (event) => {
      const detail =
        event.detail || {};

      if (
        detail.type ===
          "critical" ||
        detail.type ===
          "urgent"
      ) {
        addEvent(
          "critical_signal",
          "تم استقبال تنبيه عالي الأولوية من إحدى وحدات المنصة.",
          {
            source:
              detail.module ||
              "unknown"
          }
        );
      }
    }
  );

  window.addEventListener(
    "ezmedia:breaking:created",
    (event) => {
      const detail =
        event.detail || {};

      queueTask({
        title:
          "تحليل خبر عاجل",

        pipeline:
          "breaking",

        priority:
          "urgent",

        source:
          detail.source ||
          "breaking",

        contentId:
          detail.contentId ||
          ""
      });
    }
  );

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
    "EZ MEDIA 11.0 — AI Orchestrator loaded."
  );
})();
