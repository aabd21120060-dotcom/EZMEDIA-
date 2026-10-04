"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 36
 * الملف: public/admin-personalization-command.js
 *
 * محرك التخصيص الذكي للجمهور
 *
 * المسؤول عن:
 * - شرائح الجمهور.
 * - قواعد التخصيص.
 * - توصيات المحتوى.
 * - ترتيب المحتوى.
 * - التخصيص حسب الاهتمامات.
 * - التخصيص حسب نوع الجمهور.
 * - التخصيص حسب المنصة.
 * - التخصيص حسب الأولوية.
 * - سجل قرارات التخصيص.
 *
 * ملاحظة:
 * هذه الوحدة تبني طبقة التخصيص في الواجهة.
 * القرارات الحساسة أو الآلية بالكامل تحتاج Backend
 * وبيانات فعلية قبل تشغيلها على نطاق إنتاجي.
 */

(function () {
  "use strict";

  const MODULE =
    "personalization-command";

  const STORAGE_KEY =
    "ezmedia_personalization_command_v1";

  const SETTINGS_KEY =
    "ezmedia_personalization_settings_v1";

  const EVENTS_KEY =
    "ezmedia_personalization_events_v1";

  const MAX_EVENTS = 500;

  const CONTENT_TYPES = {
    news: "أخبار",
    report: "تقارير",
    interview: "مقابلات",
    video: "فيديو",
    coverage: "تغطيات",
    breaking: "عاجل"
  };

  const AUDIENCE_TYPES = {
    general: "عام",
    local: "محلي",
    business: "أعمال",
    youth: "شباب",
    media: "إعلام",
    technology: "تقنية",
    sports: "رياضة",
    culture: "ثقافة"
  };

  const PLATFORMS = {
    website: "الموقع",
    x: "X",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    snapchat: "Snapchat",
    telegram: "Telegram"
  };

  const PRIORITIES = {
    low: "منخفض",
    normal: "عادي",
    high: "مرتفع",
    urgent: "عاجل",
    critical: "حرج"
  };

  const DEFAULT_SETTINGS = {
    enabled: true,

    smartRecommendations: true,

    smartOrdering: true,

    audienceMatching: true,

    interestMatching: true,

    platformMatching: true,

    breakingBoost: true,

    freshnessBoost: true,

    manualOverride: true,

    maxRecommendations: 12,

    minimumScore: 35
  };

  const state = {
    content: [],
    segments: [],
    rules: [],
    recommendations: [],
    events: [],

    settings: {},

    activeTab: "dashboard",

    search: "",

    selectedSegmentId: null,

    selectedContentId: null
  };

  function uid(prefix = "item") {
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
        .slice(2, 10)
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

  function normalizeSettings(
    settings = {}
  ) {
    return {
      ...clone(DEFAULT_SETTINGS),
      ...(settings || {})
    };
  }

  function normalizeSegment(
    segment = {}
  ) {
    return {
      id:
        segment.id ||
        uid("segment"),

      name:
        segment.name ||
        "شريحة جديدة",

      description:
        segment.description ||
        "",

      audienceType:
        segment.audienceType ||
        "general",

      interests:
        Array.isArray(
          segment.interests
        )
          ? segment.interests
          : [],

      platforms:
        Array.isArray(
          segment.platforms
        )
          ? segment.platforms
          : ["website"],

      active:
        segment.active !== false,

      priority:
        segment.priority ||
        "normal",

      members:
        Number(
          segment.members || 0
        ),

      createdAt:
        segment.createdAt ||
        now(),

      updatedAt:
        segment.updatedAt ||
        now()
    };
  }

  function normalizeRule(
    rule = {}
  ) {
    return {
      id:
        rule.id ||
        uid("rule"),

      name:
        rule.name ||
        "قاعدة تخصيص",

      description:
        rule.description ||
        "",

      segmentId:
        rule.segmentId ||
        "",

      contentType:
        rule.contentType ||
        "all",

      priority:
        rule.priority ||
        "normal",

      weight:
        Number(
          rule.weight ?? 50
        ),

      active:
        rule.active !== false,

      createdAt:
        rule.createdAt ||
        now(),

      updatedAt:
        rule.updatedAt ||
        now()
    };
  }

  function normalizeContent(
    item = {}
  ) {
    return {
      id:
        item.id ||
        uid("content"),

      title:
        item.title ||
        item.headline ||
        "محتوى",

      summary:
        item.summary ||
        item.description ||
        "",

      type:
        item.type ||
        item.contentType ||
        "news",

      category:
        item.category ||
        "عام",

      tags:
        Array.isArray(
          item.tags
        )
          ? item.tags
          : Array.isArray(
              item.keywords
            )
          ? item.keywords
          : [],

      priority:
        item.priority ||
        "normal",

      publishedAt:
        item.publishedAt ||
        item.createdAt ||
        now(),

      status:
        item.status ||
        "published",

      media:
        item.media ||
        null,

      url:
        item.url ||
        item.link ||
        "",

      source:
        item.source ||
        "EZ MEDIA",

      views:
        Number(
          item.views || 0
        ),

      interactions:
        Number(
          item.interactions || 0
        )
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

      state.content =
        Array.isArray(
          saved.content
        )
          ? saved.content.map(
              normalizeContent
            )
          : [];

      state.segments =
        Array.isArray(
          saved.segments
        )
          ? saved.segments.map(
              normalizeSegment
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

      state.recommendations =
        Array.isArray(
          saved.recommendations
        )
          ? saved.recommendations
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
        "Personalization load error:",
        error
      );

      state.content = [];
      state.segments = [];
      state.rules = [];
      state.recommendations = [];
      state.events = [];

      state.settings =
        clone(
          DEFAULT_SETTINGS
        );
    }
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        content:
          state.content,
        segments:
          state.segments,
        rules:
          state.rules,
        recommendations:
          state.recommendations
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
        state.events.slice(
          -MAX_EVENTS
        )
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:personalization:updated",
        {
          detail: {
            segments:
              clone(
                state.segments
              ),
            rules:
              clone(
                state.rules
              ),
            recommendations:
              clone(
                state.recommendations
              )
          }
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
        "ezmedia:personalization:event",
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
              "التخصيص الذكي",

            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-personalization-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-personalization-toast";

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
        3000
      );
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-personalization-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-personalization-styles";

    style.textContent = `
      #personalization-command-section {
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

      .ez-personal-shell {
        max-width:1600px;
        margin:auto;
      }

      .ez-personal-header {
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

      .ez-personal-header h2 {
        margin:0 0 7px;
        font-size:29px;
      }

      .ez-personal-header p {
        margin:0;
        color:#718997;
        line-height:1.8;
      }

      .ez-personal-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .ez-personal-btn {
        border:0;
        border-radius:12px;
        padding:11px 15px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-personal-btn.primary {
        background:#42c4e8;
        color:#fff;
      }

      .ez-personal-btn.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-personal-metrics {
        display:grid;
        grid-template-columns:
          repeat(6,minmax(0,1fr));
        gap:10px;
        margin:18px 0;
      }

      .ez-personal-metric {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:17px;
        padding:15px;
      }

      .ez-personal-metric span {
        display:block;
        color:#718998;
        font-size:11px;
        margin-bottom:6px;
      }

      .ez-personal-metric strong {
        font-size:22px;
      }

      .ez-personal-tabs {
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-bottom:16px;
      }

      .ez-personal-tab {
        border:0;
        border-radius:11px;
        padding:10px 14px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-personal-tab.active {
        background:#42c4e8;
        color:#fff;
      }

      .ez-personal-toolbar {
        display:grid;
        grid-template-columns:
          minmax(240px,1fr)
          190px
          auto;
        gap:8px;
        margin-bottom:16px;
      }

      .ez-personal-input,
      .ez-personal-select,
      .ez-personal-textarea {
        width:100%;
        box-sizing:border-box;
        border:1px solid #dbeaf0;
        border-radius:12px;
        padding:12px 13px;
        background:#fff;
        color:#17384f;
        outline:none;
      }

      .ez-personal-textarea {
        min-height:130px;
        resize:vertical;
      }

      .ez-personal-input:focus,
      .ez-personal-select:focus,
      .ez-personal-textarea:focus {
        border-color:#4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-personal-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:14px;
      }

      .ez-personal-card {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:20px;
        padding:18px;
      }

      .ez-personal-card h3 {
        margin:0 0 7px;
      }

      .ez-personal-card p {
        color:#718997;
        line-height:1.8;
        font-size:12px;
      }

      .ez-personal-badges {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin:9px 0;
      }

      .ez-personal-badge {
        display:inline-flex;
        border-radius:999px;
        padding:5px 9px;
        background:#edf8fc;
        color:#176984;
        font-size:10px;
        font-weight:850;
      }

      .ez-personal-badge.success {
        background:#eefaf5;
        color:#267255;
      }

      .ez-personal-badge.warning {
        background:#fff8e8;
        color:#8b671a;
      }

      .ez-personal-badge.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-personal-score {
        display:flex;
        align-items:center;
        gap:10px;
        margin:13px 0;
      }

      .ez-personal-score-bar {
        flex:1;
        height:8px;
        border-radius:999px;
        background:#eaf2f5;
        overflow:hidden;
      }

      .ez-personal-score-fill {
        height:100%;
        border-radius:999px;
        background:#42c4e8;
      }

      .ez-personal-form {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:13px;
      }

      .ez-personal-field {
        display:flex;
        flex-direction:column;
        gap:6px;
      }

      .ez-personal-field.full {
        grid-column:1/-1;
      }

      .ez-personal-field label {
        font-size:12px;
        font-weight:800;
        color:#57717f;
      }

      .ez-personal-checks {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .ez-personal-check {
        display:flex;
        align-items:center;
        gap:8px;
        padding:12px;
        border-radius:12px;
        background:#f7fbfd;
        border:1px solid #e2eef2;
      }

      .ez-personal-modal {
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

      .ez-personal-modal.open {
        display:flex;
      }

      .ez-personal-dialog {
        width:min(900px,100%);
        max-height:94vh;
        overflow:auto;
        background:#fff;
        border-radius:24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-personal-dialog-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:18px 21px;
        border-bottom:1px solid #e4eff3;
      }

      .ez-personal-dialog-body {
        padding:21px;
      }

      .ez-personal-dialog-footer {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        padding:15px 21px;
        border-top:1px solid #e4eff3;
      }

      .ez-personal-log {
        max-height:430px;
        overflow:auto;
      }

      .ez-personal-log-item {
        padding:13px;
        margin-bottom:8px;
        border-radius:13px;
        background:#f8fcfd;
        border:1px solid #e4eef2;
      }

      .ez-personal-log-item strong {
        display:block;
        margin-bottom:4px;
      }

      .ez-personal-log-item span {
        color:#8196a0;
        font-size:10px;
      }

      #ez-personalization-toast {
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

      #ez-personalization-toast.show {
        opacity:1;
        transform:translateY(0);
      }

      @media(max-width:1200px) {
        .ez-personal-metrics {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }

        .ez-personal-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:750px) {
        #personalization-command-section {
          padding:12px;
        }

        .ez-personal-header {
          display:block;
        }

        .ez-personal-actions {
          margin-top:15px;
        }

        .ez-personal-metrics,
        .ez-personal-grid,
        .ez-personal-form,
        .ez-personal-checks {
          grid-template-columns:1fr;
        }

        .ez-personal-field.full {
          grid-column:auto;
        }

        .ez-personal-toolbar {
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
        "#personalization-command-section"
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
      "personalization-command-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function getMetrics() {
    return {
      content:
        state.content.length,

      segments:
        state.segments.length,

      activeSegments:
        state.segments.filter(
          (item) =>
            item.active
        ).length,

      rules:
        state.rules.length,

      activeRules:
        state.rules.filter(
          (item) =>
            item.active
        ).length,

      recommendations:
        state.recommendations
          .length
    };
  }

  function render() {
    const section =
      ensureSection();

    const metrics =
      getMetrics();

    section.innerHTML = `
      <div
        class="ez-personal-shell"
      >

        <div
          class="ez-personal-header"
        >

          <div>
            <h2>
              محرك التخصيص الذكي
            </h2>

            <p>
              عقل التخصيص الذي يربط الجمهور بالمحتوى
              المناسب في الوقت والمنصة المناسبة.
            </p>
          </div>

          <div
            class="ez-personal-actions"
          >

            <button
              class="
                ez-personal-btn
                primary
              "
              data-personal-action="generate"
            >
              توليد التوصيات
            </button>

            <button
              class="ez-personal-btn"
              data-personal-action="new-segment"
            >
              + شريحة جديدة
            </button>

            <button
              class="ez-personal-btn"
              data-personal-action="new-rule"
            >
              + قاعدة جديدة
            </button>

          </div>

        </div>

        <div
          class="ez-personal-metrics"
        >

          ${metric(
            "المحتوى",
            metrics.content
          )}

          ${metric(
            "الشرائح",
            metrics.segments
          )}

          ${metric(
            "الشرائح النشطة",
            metrics.activeSegments
          )}

          ${metric(
            "القواعد",
            metrics.rules
          )}

          ${metric(
            "القواعد النشطة",
            metrics.activeRules
          )}

          ${metric(
            "التوصيات",
            metrics.recommendations
          )}

        </div>

        <div
          class="ez-personal-tabs"
        >

          ${tab(
            "dashboard",
            "الرئيسية"
          )}

          ${tab(
            "segments",
            "شرائح الجمهور"
          )}

          ${tab(
            "rules",
            "قواعد التخصيص"
          )}

          ${tab(
            "recommendations",
            "التوصيات"
          )}

          ${tab(
            "content",
            "المحتوى"
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
              "segments"
            ? renderSegments()
            : state.activeTab ===
              "rules"
            ? renderRules()
            : state.activeTab ===
              "recommendations"
            ? renderRecommendations()
            : state.activeTab ===
              "content"
            ? renderContent()
            : state.activeTab ===
              "settings"
            ? renderSettings()
            : renderEvents()
        }

      </div>

      <div
        id="ez-personalization-modal"
        class="ez-personal-modal"
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
        class="ez-personal-metric"
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
          ez-personal-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-personal-tab="${escapeHtml(
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
    const top =
      state.recommendations
        .slice(0, 6);

    return `
      <div
        class="ez-personal-grid"
      >

        <div
          class="ez-personal-card"
        >
          <h3>
            محرك الجمهور
          </h3>

          <p>
            يطابق شرائح الجمهور مع المحتوى
            بناءً على الاهتمامات والنوع والأولوية.
          </p>

          <div
            class="ez-personal-badges"
          >
            <span
              class="
                ez-personal-badge
                success
              "
            >
              ${
                state.settings
                  .audienceMatching
                  ? "مطابقة الجمهور مفعلة"
                  : "مطابقة الجمهور متوقفة"
              }
            </span>
          </div>
        </div>

        <div
          class="ez-personal-card"
        >
          <h3>
            محرك الاهتمامات
          </h3>

          <p>
            يستخدم اهتمامات الشرائح لرفع أولوية
            المواد الأقرب لاحتياج الجمهور.
          </p>

          <div
            class="ez-personal-badges"
          >
            <span
              class="
                ez-personal-badge
                success
              "
            >
              ${
                state.settings
                  .interestMatching
                  ? "نشط"
                  : "متوقف"
              }
            </span>
          </div>
        </div>

        <div
          class="ez-personal-card"
        >
          <h3>
            التخصيص اللحظي
          </h3>

          <p>
            الأخبار العاجلة والمحتوى الحديث
            يحصلان على أولوية إضافية عند تفعيل
            قواعد الحداثة والعاجل.
          </p>

          <div
            class="ez-personal-badges"
          >
            <span
              class="ez-personal-badge"
            >
              عاجل
            </span>

            <span
              class="ez-personal-badge"
            >
              حداثة
            </span>
          </div>
        </div>

      </div>

      <div
        class="ez-personal-card"
        style="margin-top:14px"
      >

        <h3>
          آخر التوصيات
        </h3>

        ${
          top.length
            ? top
                .map(
                  renderRecommendation
                )
                .join("")
            : `
              <div
                style="
                  text-align:center;
                  padding:35px;
                  color:#718997;
                "
              >
                لم يتم توليد توصيات بعد.
              </div>
            `
        }

      </div>
    `;
  }

  function renderSegments() {
    return `
      <div
        class="ez-personal-grid"
      >

        ${
          state.segments.length
            ? state.segments
                .map(
                  renderSegment
                )
                .join("")
            : `
              <div
                class="ez-personal-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد شرائح جمهور.
              </div>
            `
        }

      </div>
    `;
  }

  function renderSegment(
    segment
  ) {
    return `
      <div
        class="ez-personal-card"
      >

        <h3>
          ${escapeHtml(
            segment.name
          )}
        </h3>

        <p>
          ${escapeHtml(
            segment.description ||
              "بدون وصف."
          )}
        </p>

        <div
          class="ez-personal-badges"
        >

          <span
            class="ez-personal-badge"
          >
            ${escapeHtml(
              AUDIENCE_TYPES[
                segment.audienceType
              ] ||
                segment.audienceType
            )}
          </span>

          <span
            class="
              ez-personal-badge
              ${
                segment.active
                  ? "success"
                  : "warning"
              }
            "
          >
            ${
              segment.active
                ? "نشطة"
                : "متوقفة"
            }
          </span>

          <span
            class="ez-personal-badge"
          >
            ${Number(
              segment.members || 0
            ).toLocaleString(
              "ar-SA"
            )}
            عضو
          </span>

        </div>

        ${
          segment.interests
            .length
            ? `
              <p>
                الاهتمامات:
                ${segment.interests
                  .map(
                    (item) =>
                      escapeHtml(
                        item
                      )
                  )
                  .join(
                    "، "
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

          <button
            class="ez-personal-btn"
            data-personal-action="edit-segment"
            data-id="${escapeHtml(
              segment.id
            )}"
          >
            تعديل
          </button>

          <button
            class="ez-personal-btn"
            data-personal-action="toggle-segment"
            data-id="${escapeHtml(
              segment.id
            )}"
          >
            ${
              segment.active
                ? "إيقاف"
                : "تفعيل"
            }
          </button>

          <button
            class="
              ez-personal-btn
              danger
            "
            data-personal-action="delete-segment"
            data-id="${escapeHtml(
              segment.id
            )}"
          >
            حذف
          </button>

        </div>

      </div>
    `;
  }

  function renderRules() {
    return `
      <div
        class="ez-personal-grid"
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
                class="ez-personal-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد قواعد تخصيص.
              </div>
            `
        }

      </div>
    `;
  }

  function renderRule(
    rule
  ) {
    const segment =
      state.segments.find(
        (item) =>
          item.id ===
          rule.segmentId
      );

    return `
      <div
        class="ez-personal-card"
      >

        <h3>
          ${escapeHtml(
            rule.name
          )}
        </h3>

        <p>
          ${escapeHtml(
            rule.description ||
              "بدون وصف."
          )}
        </p>

        <div
          class="ez-personal-badges"
        >

          <span
            class="
              ez-personal-badge
              ${
                rule.active
                  ? "success"
                  : "warning"
              }
          "
          >
            ${
              rule.active
                ? "نشطة"
                : "متوقفة"
            }
          </span>

          <span
            class="ez-personal-badge"
          >
            الوزن:
            ${Number(
              rule.weight
            )}
          </span>

          <span
            class="ez-personal-badge"
          >
            ${
              segment
                ? escapeHtml(
                    segment.name
                  )
                : "كل الجمهور"
            }
          </span>

        </div>

        <div
          class="ez-personal-score"
        >

          <div
            class="
              ez-personal-score-bar
            "
          >
            <div
              class="
                ez-personal-score-fill
              "
              style="
                width:${Math.max(
                  0,
                  Math.min(
                    100,
                    Number(
                      rule.weight
                    )
                  )
                )}%;
              "
            ></div>
          </div>

          <strong>
            ${Number(
              rule.weight
            )}
          </strong>

        </div>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:7px;
          "
        >

          <button
            class="ez-personal-btn"
            data-personal-action="edit-rule"
            data-id="${escapeHtml(
              rule.id
            )}"
          >
            تعديل
          </button>

          <button
            class="ez-personal-btn"
            data-personal-action="toggle-rule"
            data-id="${escapeHtml(
              rule.id
            )}"
          >
            ${
              rule.active
                ? "إيقاف"
                : "تفعيل"
            }
          </button>

          <button
            class="
              ez-personal-btn
              danger
            "
            data-personal-action="delete-rule"
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

  function renderRecommendations() {
    const recommendations =
      state.recommendations;

    return `
      <div
        class="ez-personal-toolbar"
      >

        <input
          id="ez-personal-search"
          class="ez-personal-input"
          placeholder="ابحث في التوصيات..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-personal-segment-filter"
          class="ez-personal-select"
        >

          <option value="all">
            كل الشرائح
          </option>

          ${state.segments
            .map(
              (segment) => `
                <option
                  value="${escapeHtml(
                    segment.id
                  )}"
                >
                  ${escapeHtml(
                    segment.name
                  )}
                </option>
              `
            )
            .join("")}

        </select>

        <button
          class="
            ez-personal-btn
            primary
          "
          data-personal-action="generate"
        >
          تحديث التوصيات
        </button>

      </div>

      <div
        class="ez-personal-grid"
      >

        ${
          recommendations.length
            ? recommendations
                .filter(
                  recommendationFilter
                )
                .map(
                  renderRecommendation
                )
                .join("")
            : `
              <div
                class="ez-personal-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد توصيات.
              </div>
            `
        }

      </div>
    `;
  }

  function recommendationFilter(
    item
  ) {
    const query =
      state.search
        .trim()
        .toLowerCase();

    if (!query) {
      return true;
    }

    return [
      item.title,
      item.segmentName,
      item.reason,
      item.contentType
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function renderRecommendation(
    recommendation
  ) {
    const score =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            recommendation.score ||
              0
          )
        )
      );

    return `
      <article
        class="ez-personal-card"
      >

        <h3>
          ${escapeHtml(
            recommendation.title
          )}
        </h3>

        <div
          class="ez-personal-badges"
        >

          <span
            class="
              ez-personal-badge
              success
            "
          >
            ${escapeHtml(
              recommendation.segmentName ||
                "عام"
            )}
          </span>

          <span
            class="ez-personal-badge"
          >
            ${escapeHtml(
              recommendation.contentType ||
                "محتوى"
            )}
          </span>

          <span
            class="ez-personal-badge"
          >
            ${escapeHtml(
              recommendation.platform ||
                "الموقع"
            )}
          </span>

        </div>

        <div
          class="ez-personal-score"
        >

          <div
            class="
              ez-personal-score-bar
            "
          >
            <div
              class="
                ez-personal-score-fill
              "
              style="
                width:${score}%;
              "
            ></div>
          </div>

          <strong>
            ${score}
          </strong>

        </div>

        <p>
          ${escapeHtml(
            recommendation.reason ||
              "توصية ذكية."
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
            class="ez-personal-btn"
            data-personal-action="view-content"
            data-id="${escapeHtml(
              recommendation.contentId
            )}"
          >
            عرض المادة
          </button>

          <button
            class="
              ez-personal-btn
              primary
            "
            data-personal-action="apply-recommendation"
            data-id="${escapeHtml(
              recommendation.id
            )}"
          >
            تطبيق
          </button>

        </div>

      </article>
    `;
  }

  function renderContent() {
    const items =
      filteredContent();

    return `
      <div
        class="ez-personal-toolbar"
      >

        <input
          id="ez-personal-content-search"
          class="ez-personal-input"
          placeholder="ابحث في المحتوى..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-personal-content-type"
          class="ez-personal-select"
        >

          <option value="all">
            كل الأنواع
          </option>

          ${Object.entries(
            CONTENT_TYPES
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
          class="ez-personal-btn"
          data-personal-action="import-content"
        >
          تحديث من CMS
        </button>

      </div>

      <div
        class="ez-personal-grid"
      >

        ${
          items.length
            ? items
                .map(
                  renderContentCard
                )
                .join("")
            : `
              <div
                class="ez-personal-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا يوجد محتوى داخل محرك التخصيص.
              </div>
            `
        }

      </div>
    `;
  }

  function filteredContent() {
    const query =
      state.search
        .trim()
        .toLowerCase();

    return state.content
      .filter(
        (item) => {
          if (!query) {
            return true;
          }

          return [
            item.title,
            item.summary,
            item.category,
            item.type,
            ...(item.tags || [])
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      )
      .sort(
        (a, b) =>
          new Date(
            b.publishedAt
          ) -
          new Date(
            a.publishedAt
          )
      );
  }

  function renderContentCard(
    item
  ) {
    return `
      <div
        class="ez-personal-card"
      >

        <h3>
          ${escapeHtml(
            item.title
          )}
        </h3>

        <div
          class="ez-personal-badges"
        >

          <span
            class="ez-personal-badge"
          >
            ${
              escapeHtml(
                CONTENT_TYPES[
                  item.type
                ] ||
                  item.type
              )
            }
          </span>

          <span
            class="ez-personal-badge"
          >
            ${escapeHtml(
              item.category
            )}
          </span>

          <span
            class="
              ez-personal-badge
              ${
                item.priority ===
                  "urgent" ||
                item.priority ===
                  "critical"
                  ? "danger"
                  : ""
              }
            "
          >
            ${
              escapeHtml(
                PRIORITIES[
                  item.priority
                ] ||
                  item.priority
              )
            }
          </span>

        </div>

        <p>
          ${escapeHtml(
            item.summary
          ).slice(
            0,
            220
          )}
        </p>

        <button
          class="
            ez-personal-btn
            primary
          "
          data-personal-action="recommend-content"
          data-id="${escapeHtml(
            item.id
          )}"
        >
          تخصيص هذه المادة
        </button>

      </div>
    `;
  }

  function renderSettings() {
    return `
      <div
        class="ez-personal-card"
      >

        <h3>
          إعدادات محرك التخصيص
        </h3>

        <div
          style="
            display:grid;
            gap:9px;
            margin-top:15px;
          "
        >

          ${setting(
            "تفعيل التخصيص",
            "enabled"
          )}

          ${setting(
            "التوصيات الذكية",
            "smartRecommendations"
          )}

          ${setting(
            "ترتيب المحتوى الذكي",
            "smartOrdering"
          )}

          ${setting(
            "مطابقة الجمهور",
            "audienceMatching"
          )}

          ${setting(
            "مطابقة الاهتمامات",
            "interestMatching"
          )}

          ${setting(
            "مطابقة المنصة",
            "platformMatching"
          )}

          ${setting(
            "رفع أولوية العاجل",
            "breakingBoost"
          )}

          ${setting(
            "رفع أولوية المحتوى الحديث",
            "freshnessBoost"
          )}

          ${setting(
            "السماح بالتعديل اليدوي",
            "manualOverride"
          )}

        </div>

        <div
          class="ez-personal-form"
          style="margin-top:16px"
        >

          <div
            class="ez-personal-field"
          >

            <label>
              الحد الأقصى للتوصيات
            </label>

            <input
              id="ez-personal-max"
              class="ez-personal-input"
              type="number"
              min="1"
              max="100"
              value="${escapeHtml(
                state.settings
                  .maxRecommendations
              )}"
            />

          </div>

          <div
            class="ez-personal-field"
          >

            <label>
              الحد الأدنى للدرجة
            </label>

            <input
              id="ez-personal-min"
              class="ez-personal-input"
              type="number"
              min="0"
              max="100"
              value="${escapeHtml(
                state.settings
                  .minimumScore
              )}"
            />

          </div>

        </div>

        <button
          class="
            ez-personal-btn
            primary
          "
          style="margin-top:16px"
          data-personal-action="save-settings"
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
        class="ez-personal-check"
      >

        <input
          type="checkbox"
          data-personal-setting="${escapeHtml(
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
        class="ez-personal-card"
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
              سجل محرك التخصيص
            </h3>

            <p>
              يسجل عمليات إنشاء الشرائح والقواعد
              والتوصيات وقرارات التخصيص.
            </p>
          </div>

          <button
            class="
              ez-personal-btn
              danger
            "
            data-personal-action="clear-events"
          >
            مسح السجل
          </button>

        </div>

        <div
          class="ez-personal-log"
        >

          ${
            events.length
              ? events
                  .map(
                    (event) => `
                      <div
                        class="
                          ez-personal-log-item
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
        "#ez-personalization-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div
        class="ez-personal-dialog"
      >

        <div
          class="ez-personal-dialog-head"
        >

          <strong>
            ${escapeHtml(
              title
            )}
          </strong>

          <button
            class="ez-personal-btn"
            data-personal-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-personal-dialog-body"
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-personal-dialog-footer
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
        "#ez-personalization-modal"
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

  function openSegmentForm(
    existing = null
  ) {
    const segment =
      existing ||
      normalizeSegment({});

    openModal(
      existing
        ? "تعديل شريحة الجمهور"
        : "إنشاء شريحة جمهور",
      `
        <form
          id="ez-personal-segment-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              segment.id
            )}"
          />

          <div
            class="ez-personal-form"
          >

            <div
              class="
                ez-personal-field
                full
              "
            >
              <label>
                اسم الشريحة
              </label>

              <input
                class="ez-personal-input"
                name="name"
                required
                value="${escapeHtml(
                  segment.name
                )}"
              />
            </div>

            <div
              class="
                ez-personal-field
                full
              "
            >
              <label>
                الوصف
              </label>

              <textarea
                class="
                  ez-personal-textarea
                "
                name="description"
              >${escapeHtml(
                segment.description
              )}</textarea>
            </div>

            <div
              class="ez-personal-field"
            >
              <label>
                نوع الجمهور
              </label>

              <select
                class="
                  ez-personal-select
                "
                name="audienceType"
              >

                ${Object.entries(
                  AUDIENCE_TYPES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                        ${
                          segment.audienceType ===
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
              class="ez-personal-field"
            >
              <label>
                عدد الأعضاء
              </label>

              <input
                class="ez-personal-input"
                type="number"
                min="0"
                name="members"
                value="${escapeHtml(
                  segment.members
                )}"
              />
            </div>

            <div
              class="
                ez-personal-field
                full
              "
            >
              <label>
                الاهتمامات
              </label>

              <input
                class="ez-personal-input"
                name="interests"
                placeholder="أخبار، تقنية، اقتصاد، رياضة"
                value="${escapeHtml(
                  segment.interests.join(
                    ", "
                  )
                )}"
              />
            </div>

            <div
              class="
                ez-personal-field
                full
              "
            >
              <label>
                المنصات
              </label>

              <div
                class="ez-personal-checks"
              >

                ${Object.entries(
                  PLATFORMS
                )
                  .map(
                    ([key, label]) => `
                      <label
                        class="
                          ez-personal-check
                        "
                      >

                        <input
                          type="checkbox"
                          name="platform"
                          value="${escapeHtml(
                            key
                          )}"
                          ${
                            segment.platforms.includes(
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
          class="ez-personal-btn"
          data-personal-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-personal-btn
            primary
          "
          data-personal-action="save-segment"
        >
          حفظ
        </button>
      `
    );
  }

  function saveSegment() {
    const form =
      document.querySelector(
        "#ez-personal-segment-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const id =
      String(
        data.get("id") ||
          ""
      );

    const segment =
      normalizeSegment({
        id:
          id ||
          uid("segment"),

        name:
          String(
            data.get(
              "name"
            ) || ""
          ).trim(),

        description:
          String(
            data.get(
              "description"
            ) || ""
          ).trim(),

        audienceType:
          data.get(
            "audienceType"
          ) ||
          "general",

        members:
          Number(
            data.get(
              "members"
            ) || 0
          ),

        interests:
          String(
            data.get(
              "interests"
            ) || ""
          )
            .split(",")
            .map(
              (item) =>
                item.trim()
            )
            .filter(Boolean),

        platforms:
          data
            .getAll(
              "platform"
            )
            .filter(Boolean),

        updatedAt:
          now()
      });

    if (!segment.name) {
      notify(
        "اسم الشريحة مطلوب.",
        "warning"
      );

      return;
    }

    const index =
      state.segments.findIndex(
        (item) =>
          item.id ===
          segment.id
      );

    if (index >= 0) {
      state.segments[
        index
      ] = segment;

      addEvent(
        "segment_updated",
        "تم تعديل شريحة جمهور.",
        {
          segmentId:
            segment.id
        }
      );
    } else {
      state.segments.push(
        segment
      );

      addEvent(
        "segment_created",
        "تم إنشاء شريحة جمهور.",
        {
          segmentId:
            segment.id
        }
      );
    }

    save();

    closeModal();

    render();

    notify(
      "تم حفظ شريحة الجمهور.",
      "success"
    );
  }

  function toggleSegment(
    id
  ) {
    const segment =
      state.segments.find(
        (item) =>
          item.id === id
      );

    if (!segment) {
      return;
    }

    segment.active =
      !segment.active;

    segment.updatedAt =
      now();

    addEvent(
      "segment_toggle",
      segment.active
        ? "تم تفعيل شريحة الجمهور."
        : "تم إيقاف شريحة الجمهور.",
      {
        segmentId:
          segment.id
      }
    );

    save();

    render();
  }

  function deleteSegment(
    id
  ) {
    const segment =
      state.segments.find(
        (item) =>
          item.id === id
      );

    if (!segment) {
      return;
    }

    if (
      !window.confirm(
        "هل تريد حذف شريحة الجمهور؟"
      )
    ) {
      return;
    }

    state.segments =
      state.segments.filter(
        (item) =>
          item.id !== id
      );

    state.rules =
      state.rules.map(
        (rule) =>
          rule.segmentId === id
            ? {
                ...rule,
                segmentId: ""
              }
            : rule
      );

    addEvent(
      "segment_deleted",
      "تم حذف شريحة جمهور.",
      {
        segmentId:
          id
      }
    );

    save();

    render();

    notify(
      "تم حذف الشريحة.",
      "success"
    );
  }

  function openRuleForm(
    existing = null
  ) {
    const rule =
      existing ||
      normalizeRule({});

    openModal(
      existing
        ? "تعديل قاعدة التخصيص"
        : "إنشاء قاعدة تخصيص",
      `
        <form
          id="ez-personal-rule-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              rule.id
            )}"
          />

          <div
            class="ez-personal-form"
          >

            <div
              class="
                ez-personal-field
                full
              "
            >
              <label>
                اسم القاعدة
              </label>

              <input
                class="ez-personal-input"
                name="name"
                required
                value="${escapeHtml(
                  rule.name
                )}"
              />
            </div>

            <div
              class="
                ez-personal-field
                full
              "
            >
              <label>
                الوصف
              </label>

              <textarea
                class="
                  ez-personal-textarea
                "
                name="description"
              >${escapeHtml(
                rule.description
              )}</textarea>
            </div>

            <div
              class="ez-personal-field"
            >
              <label>
                شريحة الجمهور
              </label>

              <select
                class="
                  ez-personal-select
                "
                name="segmentId"
              >

                <option value="">
                  كل الجمهور
                </option>

                ${state.segments
                  .map(
                    (segment) => `
                      <option
                        value="${escapeHtml(
                          segment.id
                        )}"
                        ${
                          rule.segmentId ===
                          segment.id
                            ? "selected"
                            : ""
                        }
                      >
                        ${escapeHtml(
                          segment.name
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="ez-personal-field"
            >
              <label>
                نوع المحتوى
              </label>

              <select
                class="
                  ez-personal-select
                "
                name="contentType"
              >

                <option value="all">
                  كل الأنواع
                </option>

                ${Object.entries(
                  CONTENT_TYPES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                        ${
                          rule.contentType ===
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
              class="ez-personal-field"
            >
              <label>
                الأولوية
              </label>

              <select
                class="
                  ez-personal-select
                "
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
              class="ez-personal-field"
            >
              <label>
                وزن القاعدة
              </label>

              <input
                class="ez-personal-input"
                type="number"
                min="0"
                max="100"
                name="weight"
                value="${escapeHtml(
                  rule.weight
                )}"
              />
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-personal-btn"
          data-personal-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-personal-btn
            primary
          "
          data-personal-action="save-rule"
        >
          حفظ
        </button>
      `
    );
  }

  function saveRule() {
    const form =
      document.querySelector(
        "#ez-personal-rule-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const rule =
      normalizeRule({
        id:
          String(
            data.get("id") ||
              ""
          ) ||
          uid("rule"),

        name:
          String(
            data.get(
              "name"
            ) || ""
          ).trim(),

        description:
          String(
            data.get(
              "description"
            ) || ""
          ).trim(),

        segmentId:
          data.get(
            "segmentId"
          ) ||
          "",

        contentType:
          data.get(
            "contentType"
          ) ||
          "all",

        priority:
          data.get(
            "priority"
          ) ||
          "normal",

        weight:
          Math.max(
            0,
            Math.min(
              100,
              Number(
                data.get(
                  "weight"
                ) || 50
              )
            )
          ),

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
        "تم تعديل قاعدة تخصيص.",
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
        "تم إنشاء قاعدة تخصيص.",
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
      "تم حفظ قاعدة التخصيص.",
      "success"
    );
  }

  function toggleRule(
    id
  ) {
    const rule =
      state.rules.find(
        (item) =>
          item.id === id
      );

    if (!rule) {
      return;
    }

    rule.active =
      !rule.active;

    rule.updatedAt =
      now();

    addEvent(
      "rule_toggle",
      rule.active
        ? "تم تفعيل قاعدة التخصيص."
        : "تم إيقاف قاعدة التخصيص.",
      {
        ruleId:
          rule.id
      }
    );

    save();

    render();
  }

  function deleteRule(
    id
  ) {
    if (
      !window.confirm(
        "هل تريد حذف قاعدة التخصيص؟"
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
      "تم حذف قاعدة تخصيص.",
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

  function calculateScore(
    content,
    segment
  ) {
    let score = 0;

    const reasons = [];

    const tags =
      [
        ...(content.tags || []),
        content.category,
        content.type
      ]
        .filter(Boolean)
        .map(
          (value) =>
            String(
              value
            ).toLowerCase()
        );

    const interests =
      (
        segment.interests ||
        []
      ).map(
        (value) =>
          String(
            value
          ).toLowerCase()
      );

    if (
      state.settings
        .interestMatching
    ) {
      const matches =
        interests.filter(
          (interest) =>
            tags.some(
              (tag) =>
                tag.includes(
                  interest
                ) ||
                interest.includes(
                  tag
                )
            )
        );

      if (matches.length) {
        score += Math.min(
          35,
          matches.length *
            12
        );

        reasons.push(
          "تطابق مع اهتمامات الجمهور"
        );
      }
    }

    if (
      content.type ===
      segment.audienceType
    ) {
      score += 15;

      reasons.push(
        "تطابق نوع الجمهور"
      );
    }

    if (
      content.type ===
      "breaking"
    ) {
      if (
        state.settings
          .breakingBoost
      ) {
        score += 25;

        reasons.push(
          "أولوية للخبر العاجل"
        );
      }
    }

    if (
      [
        "urgent",
        "critical"
      ].includes(
        content.priority
      )
    ) {
      score += 15;

      reasons.push(
        "أولوية تحريرية مرتفعة"
      );
    }

    if (
      state.settings
        .freshnessBoost
    ) {
      const published =
        new Date(
          content.publishedAt
        );

      const age =
        (
          Date.now() -
          published.getTime()
        ) /
        3600000;

      if (
        age <= 1
      ) {
        score += 15;

        reasons.push(
          "محتوى حديث جدًا"
        );
      } else if (
        age <= 6
      ) {
        score += 10;

        reasons.push(
          "محتوى حديث"
        );
      } else if (
        age <= 24
      ) {
        score += 5;
      }
    }

    if (
      content.views > 0
    ) {
      score += Math.min(
        10,
        Math.log10(
          content.views + 1
        ) * 3
      );

      reasons.push(
        "أداء سابق للمادة"
      );
    }

    if (
      content.interactions >
      0
    ) {
      score += Math.min(
        10,
        Math.log10(
          content.interactions +
            1
        ) * 4
      );

      reasons.push(
        "تفاعل الجمهور"
      );
    }

    const rules =
      state.rules.filter(
        (rule) =>
          rule.active &&
          (
            !rule.segmentId ||
            rule.segmentId ===
              segment.id
          ) &&
          (
            rule.contentType ===
              "all" ||
            rule.contentType ===
              content.type
          )
      );

    rules.forEach(
      (rule) => {
        score +=
          Number(
            rule.weight || 0
          ) / 4;

        reasons.push(
          `قاعدة: ${rule.name}`
        );
      }
    );

    score =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(score)
        )
      );

    return {
      score,

      reasons:
        [...new Set(
          reasons
        )]
    };
  }

  function generateRecommendations() {
    if (
      !state.settings
        .enabled ||
      !state.settings
        .smartRecommendations
    ) {
      notify(
        "محرك التخصيص متوقف.",
        "warning"
      );

      return [];
    }

    if (
      !state.segments.length
    ) {
      notify(
        "أنشئ شريحة جمهور أولًا.",
        "warning"
      );

      return [];
    }

    const recommendations = [];

    const activeSegments =
      state.segments.filter(
        (segment) =>
          segment.active
      );

    const activeContent =
      state.content.filter(
        (content) =>
          content.status ===
            "published" ||
          content.status ===
            "approved" ||
          content.status ===
            "scheduled"
      );

    activeSegments.forEach(
      (segment) => {
        activeContent.forEach(
          (content) => {
            const result =
              calculateScore(
                content,
                segment
              );

            if (
              result.score <
              Number(
                state.settings
                  .minimumScore
              )
            ) {
              return;
            }

            const platform =
              segment.platforms
                ?.length
                ? segment
                    .platforms[0]
                : "website";

            recommendations.push({
              id:
                uid(
                  "recommendation"
                ),

              contentId:
                content.id,

              title:
                content.title,

              segmentId:
                segment.id,

              segmentName:
                segment.name,

              contentType:
                CONTENT_TYPES[
                  content.type
                ] ||
                content.type,

              platform:
                PLATFORMS[
                  platform
                ] ||
                platform,

              score:
                result.score,

              reason:
                result.reasons.join(
                  "، "
                ) ||
                "تطابق عام",

              reasons:
                result.reasons,

              generatedAt:
                now()
            });
          }
        );
      }
    );

    recommendations.sort(
      (a, b) =>
        b.score -
        a.score
    );

    state.recommendations =
      recommendations.slice(
        0,
        Number(
          state.settings
            .maxRecommendations
        )
      );

    addEvent(
      "recommendations_generated",
      "تم توليد توصيات تخصيص جديدة.",
      {
        count:
          state
            .recommendations
            .length
      }
    );

    save();

    render();

    notify(
      `تم توليد ${state.recommendations.length} توصية.`,
      "success"
    );

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:personalization:recommendations",
        {
          detail: {
            recommendations:
              clone(
                state.recommendations
              )
          }
        }
      )
    );

    return clone(
      state.recommendations
    );
  }

  function applyRecommendation(
    id
  ) {
    const recommendation =
      state.recommendations.find(
        (item) =>
          item.id === id
      );

    if (
      !recommendation
    ) {
      return;
    }

    addEvent(
      "recommendation_applied",
      "تم تطبيق توصية تخصيص.",
      {
        recommendationId:
          id,

        contentId:
          recommendation.contentId,

        segmentId:
          recommendation.segmentId
      }
    );

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:personalization:apply",
        {
          detail:
            clone(
              recommendation
            )
        }
      )
    );

    notify(
      "تم إرسال قرار التخصيص إلى منظومة المنصة.",
      "success"
    );
  }

  function recommendContent(
    contentId
  ) {
    const content =
      state.content.find(
        (item) =>
          String(
            item.id
          ) ===
          String(
            contentId
          )
      );

    if (!content) {
      notify(
        "المحتوى غير موجود.",
        "warning"
      );

      return;
    }

    const recommendations =
      [];

    state.segments
      .filter(
        (segment) =>
          segment.active
      )
      .forEach(
        (segment) => {
          const result =
            calculateScore(
              content,
              segment
            );

          recommendations.push({
            id:
              uid(
                "recommendation"
              ),

            contentId:
              content.id,

            title:
              content.title,

            segmentId:
              segment.id,

            segmentName:
              segment.name,

            contentType:
              CONTENT_TYPES[
                content.type
              ] ||
              content.type,

            platform:
              PLATFORMS[
                segment
                  .platforms?.[0] ||
                  "website"
              ],

            score:
              result.score,

            reason:
              result.reasons.join(
                "، "
              ) ||
              "تطابق عام",

            reasons:
              result.reasons,

            generatedAt:
              now()
          });
        }
      );

    state.recommendations =
      recommendations
        .sort(
          (a, b) =>
            b.score -
            a.score
        )
        .slice(
          0,
          Number(
            state.settings
              .maxRecommendations
          )
        );

    addEvent(
      "content_personalized",
      "تم تحليل مادة وتوليد تخصيص للجمهور.",
      {
        contentId:
          content.id,

        count:
          state.recommendations
            .length
      }
    );

    save();

    state.activeTab =
      "recommendations";

    render();

    notify(
      "تم تحليل المادة وتوليد توصيات.",
      "success"
    );
  }

  function importContentFromCMS() {
    return fetch(
      "/api/content?status=published&limit=100",
      {
        credentials:
          "include"
      }
    )
      .then(
        async (response) => {
          const data =
            await response
              .json()
              .catch(
                () => []
              );

          if (
            !response.ok
          ) {
            throw new Error(
              data.message ||
                "فشل جلب المحتوى."
            );
          }

          const items =
            Array.isArray(
              data
            )
              ? data
              : Array.isArray(
                  data.items
                )
              ? data.items
              : Array.isArray(
                  data.content
                )
              ? data.content
              : [];

          state.content =
            items.map(
              normalizeContent
            );

          addEvent(
            "cms_import",
            "تم تحديث المحتوى من CMS.",
            {
              count:
                state.content
                  .length
            }
          );

          save();

          render();

          notify(
            "تم تحديث المحتوى من CMS.",
            "success"
          );

          return clone(
            state.content
          );
        }
      )
      .catch(
        (error) => {
          notify(
            error.message ||
              "تعذر تحديث المحتوى.",
            "warning"
          );

          return [];
        }
      );
  }

  function saveSettings() {
    document
      .querySelectorAll(
        "[data-personal-setting]"
      )
      .forEach(
        (input) => {
          state.settings[
            input.dataset
              .personalSetting
          ] =
            input.checked;
        }
      );

    const max =
      document.querySelector(
        "#ez-personal-max"
      );

    const minimum =
      document.querySelector(
        "#ez-personal-min"
      );

    if (max) {
      state.settings
        .maxRecommendations =
        Math.max(
          1,
          Math.min(
            100,
            Number(
              max.value
            ) || 12
          )
        );
    }

    if (minimum) {
      state.settings
        .minimumScore =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              minimum.value
            ) || 35
          )
        );
    }

    addEvent(
      "settings_updated",
      "تم تحديث إعدادات التخصيص.",
      {}
    );

    save();

    render();

    notify(
      "تم حفظ إعدادات التخصيص.",
      "success"
    );
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#personalization-command-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-personal-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .personalTab;

              state.search =
                "";

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-personal-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .personalAction;

              const id =
                button.dataset
                  .id;

              if (
                action ===
                "generate"
              ) {
                generateRecommendations();
                return;
              }

              if (
                action ===
                "new-segment"
              ) {
                openSegmentForm();
                return;
              }

              if (
                action ===
                "edit-segment"
              ) {
                const segment =
                  state.segments.find(
                    (item) =>
                      item.id ===
                      id
                  );

                if (segment) {
                  openSegmentForm(
                    segment
                  );
                }

                return;
              }

              if (
                action ===
                "toggle-segment"
              ) {
                toggleSegment(
                  id
                );
                return;
              }

              if (
                action ===
                "delete-segment"
              ) {
                deleteSegment(
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
                "toggle-rule"
              ) {
                toggleRule(
                  id
                );
                return;
              }

              if (
                action ===
                "delete-rule"
              ) {
                deleteRule(
                  id
                );
                return;
              }

              if (
                action ===
                "save-segment"
              ) {
                saveSegment();
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
                "apply-recommendation"
              ) {
                applyRecommendation(
                  id
                );
                return;
              }

              if (
                action ===
                "recommend-content"
              ) {
                recommendContent(
                  id
                );
                return;
              }

              if (
                action ===
                "view-content"
              ) {
                const content =
                  state.content.find(
                    (item) =>
                      String(
                        item.id
                      ) ===
                      String(id)
                  );

                if (content) {
                  openModal(
                    "تفاصيل المحتوى",
                    `
                      <div
                        class="
                          ez-personal-form
                        "
                      >

                        ${detail(
                          "العنوان",
                          content.title
                        )}

                        ${detail(
                          "النوع",
                          CONTENT_TYPES[
                            content.type
                          ] ||
                            content.type
                        )}

                        ${detail(
                          "التصنيف",
                          content.category
                        )}

                        <div
                          class="
                            ez-personal-field
                            full
                          "
                        >
                          <label>
                            الملخص
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
                              content.summary
                            )}
                          </div>
                        </div>

                      </div>
                    `,
                    `
                      <button
                        class="ez-personal-btn"
                        data-personal-action="close"
                      >
                        إغلاق
                      </button>
                    `
                  );
                }

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
                "import-content"
              ) {
                importContentFromCMS();
                return;
              }

              if (
                action ===
                "clear-events"
              ) {
                if (
                  window.confirm(
                    "هل تريد مسح سجل التخصيص؟"
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
        "#ez-personal-search"
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

    const contentSearch =
      section.querySelector(
        "#ez-personal-content-search"
      );

    if (contentSearch) {
      contentSearch.addEventListener(
        "input",
        (event) => {
          state.search =
            event.target.value;

          render();
        }
      );
    }

    const modal =
      document.querySelector(
        "#ez-personalization-modal"
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
        "#personalization-command-section"
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

  function addContent(
    content
  ) {
    const normalized =
      normalizeContent(
        content
      );

    const existing =
      state.content.findIndex(
        (item) =>
          item.id ===
          normalized.id
      );

    if (existing >= 0) {
      state.content[
        existing
      ] = normalized;
    } else {
      state.content.push(
        normalized
      );
    }

    save();

    return clone(
      normalized
    );
  }

  function addSegment(
    segment
  ) {
    const normalized =
      normalizeSegment(
        segment
      );

    state.segments.push(
      normalized
    );

    addEvent(
      "segment_created_api",
      "تم إنشاء شريحة من واجهة التكامل.",
      {
        segmentId:
          normalized.id
      }
    );

    save();

    return clone(
      normalized
    );
  }

  function getRecommendations(
    segmentId = null
  ) {
    if (!segmentId) {
      return clone(
        state.recommendations
      );
    }

    return clone(
      state.recommendations.filter(
        (item) =>
          item.segmentId ===
          segmentId
      )
    );
  }

  function getSegments() {
    return clone(
      state.segments
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
    const metrics =
      getMetrics();

    return {
      module:
        MODULE,

      enabled:
        state.settings
          .enabled,

      metrics,

      settings:
        clone(
          state.settings
        ),

      updatedAt:
        now()
    };
  }

  window.EZMediaPersonalization =
    {
      module:
        MODULE,

      show,
      hide,
      refresh,

      addContent,
      addSegment,

      generateRecommendations,
      recommendContent,

      getRecommendations,
      getSegments,
      getRules,
      getSettings,
      getStatus
    };

  /*
   * استقبال بيانات الجمهور من مركز الجمهور.
   */

  window.addEventListener(
    "ezmedia:audience:updated",
    (event) => {
      const detail =
        event.detail || {};

      const segments =
        detail.segments ||
        detail.audienceSegments;

      if (
        Array.isArray(
          segments
        )
      ) {
        state.segments =
          segments.map(
            normalizeSegment
          );

        save();

        window.dispatchEvent(
          new CustomEvent(
            "ezmedia:personalization:audience-synced",
            {
              detail: {
                count:
                  state.segments
                    .length
              }
            }
          )
        );
      }
    }
  );

  /*
   * استقبال المحتوى المنشور.
   */

  window.addEventListener(
    "ezmedia:content:published",
    (event) => {
      const detail =
        event.detail || {};

      if (
        detail.id ||
        detail.contentId
      ) {
        addContent({
          ...detail,

          id:
            detail.id ||
            detail.contentId,

          status:
            "published"
        });

        if (
          state.settings
            .smartRecommendations
        ) {
          generateRecommendations();
        }
      }
    }
  );

  /*
   * استقبال الأخبار العاجلة.
   */

  window.addEventListener(
    "ezmedia:breaking:created",
    (event) => {
      const detail =
        event.detail || {};

      const content =
        addContent({
          ...detail,

          id:
            detail.id ||
            detail.contentId ||
            uid("breaking"),

          type:
            "breaking",

          contentType:
            "breaking",

          priority:
            "urgent",

          status:
            "published",

          publishedAt:
            now()
        });

      if (
        state.settings
          .breakingBoost
      ) {
        recommendContent(
          content.id
        );
      }
    }
  );

  /*
   * استقبال تحديثات أوركسترا الذكاء.
   */

  window.addEventListener(
    "ezmedia:ai:orchestrator:updated",
    () => {
      if (
        state.settings
          .smartRecommendations
      ) {
        window.dispatchEvent(
          new CustomEvent(
            "ezmedia:personalization:refresh"
          )
        );
      }
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
    "EZ MEDIA 11.0 — Personalization Command loaded."
  );
})();
