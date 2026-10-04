"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 35
 * الملف: public/admin-social-command.js
 *
 * مركز التحكم الاجتماعي الذكي
 *
 * المسؤول عن:
 * - إدارة منصات التواصل.
 * - تجهيز المنشورات.
 * - إدارة طابور النشر.
 * - جدولة المنشورات.
 * - إعادة المحاولة.
 * - تتبع الحالة.
 * - اقتراح المنصة المناسبة.
 * - ربط المحتوى مع التوزيع.
 *
 * ملاحظة:
 * النشر الحقيقي في المنصات الخارجية يحتاج
 * APIs رسمية وصلاحيات OAuth/Business.
 * هذا الملف لا ينتحل نجاح النشر.
 */

(function () {
  "use strict";

  const MODULE =
    "social-command";

  const STORAGE_KEY =
    "ezmedia_social_command_v1";

  const SETTINGS_KEY =
    "ezmedia_social_command_settings_v1";

  const EVENT_KEY =
    "ezmedia_social_command_events_v1";

  const PLATFORMS = {
    website: {
      id: "website",
      name: "موقع EZ MEDIA",
      icon: "🌐",
      color: "#42c4e8",
      type: "internal",
      apiReady: true
    },

    x: {
      id: "x",
      name: "X",
      icon: "𝕏",
      color: "#111111",
      type: "external",
      apiReady: false
    },

    instagram: {
      id: "instagram",
      name: "Instagram",
      icon: "◎",
      color: "#d946ef",
      type: "external",
      apiReady: false
    },

    tiktok: {
      id: "tiktok",
      name: "TikTok",
      icon: "♪",
      color: "#111111",
      type: "external",
      apiReady: false
    },

    youtube: {
      id: "youtube",
      name: "YouTube",
      icon: "▶",
      color: "#ff0000",
      type: "external",
      apiReady: false
    },

    snapchat: {
      id: "snapchat",
      name: "Snapchat",
      icon: "👻",
      color: "#f4d63c",
      type: "external",
      apiReady: false
    },

    telegram: {
      id: "telegram",
      name: "Telegram",
      icon: "➤",
      color: "#229ed9",
      type: "external",
      apiReady: false
    }
  };

  const STATUS = {
    draft: "مسودة",
    queued: "في الطابور",
    preparing: "قيد التجهيز",
    scheduled: "مجدول",
    publishing: "قيد النشر",
    published: "منشور",
    failed: "فشل",
    cancelled: "ملغى"
  };

  const CONTENT_TYPES = {
    news: "خبر",
    report: "تقرير",
    interview: "مقابلة",
    video: "فيديو",
    coverage: "تغطية",
    breaking: "عاجل"
  };

  const DEFAULT_SETTINGS = {
    enabled: true,

    autoSuggestPlatforms: true,

    autoCreateDrafts: true,

    requireApproval:
      true,

    defaultLanguage:
      "ar",

    maxQueue:
      100,

    retryLimit:
      3
  };

  const state = {
    posts: [],
    events: [],
    settings: {},
    selectedPostId: null,

    search: "",

    platform:
      "all",

    status:
      "all",

    activeTab:
      "dashboard"
  };

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function uid(
    prefix = "social"
  ) {
    if (
      typeof crypto !==
        "undefined" &&
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

  function escapeHtml(value) {
    return String(
      value ?? ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizePost(
    post = {}
  ) {
    return {
      id:
        post.id ||
        uid("post"),

      contentId:
        post.contentId ||
        "",

      title:
        post.title ||
        "منشور جديد",

      body:
        post.body ||
        "",

      platform:
        post.platform ||
        "website",

      status:
        post.status ||
        "draft",

      contentType:
        post.contentType ||
        "news",

      priority:
        post.priority ||
        "normal",

      language:
        post.language ||
        "ar",

      scheduledAt:
        post.scheduledAt ||
        null,

      publishedAt:
        post.publishedAt ||
        null,

      externalId:
        post.externalId ||
        "",

      mediaUrl:
        post.mediaUrl ||
        "",

      link:
        post.link ||
        "",

      hashtags:
        Array.isArray(
          post.hashtags
        )
          ? post.hashtags
          : [],

      aiSuggestion:
        post.aiSuggestion ||
        null,

      approvalRequired:
        post.approvalRequired !==
        false,

      attempts:
        Number(
          post.attempts || 0
        ),

      error:
        post.error ||
        "",

      createdAt:
        post.createdAt ||
        now(),

      updatedAt:
        post.updatedAt ||
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
      const posts =
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
            EVENT_KEY
          ) || "[]"
        );

      state.posts =
        Array.isArray(posts)
          ? posts.map(
              normalizePost
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
        "Social Command load error:",
        error
      );

      state.posts = [];
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
      JSON.stringify(
        state.posts
      )
    );

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(
        state.settings
      )
    );

    localStorage.setItem(
      EVENT_KEY,
      JSON.stringify(
        state.events.slice(
          -500
        )
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:social:updated",
        {
          detail: {
            posts:
              clone(
                state.posts
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
        -500
      );

    save();

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:social:event",
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
            module: MODULE,
            type,
            title:
              "مركز التواصل الاجتماعي",
            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-social-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-social-toast";

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
        "#ez-social-command-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-social-command-styles";

    style.textContent = `
      #social-command-section {
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

      .ez-social-shell {
        max-width:1600px;
        margin:auto;
      }

      .ez-social-header {
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

      .ez-social-header h2 {
        margin:0 0 7px;
        font-size:29px;
      }

      .ez-social-header p {
        margin:0;
        color:#718997;
        line-height:1.8;
      }

      .ez-social-actions {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .ez-social-btn {
        border:0;
        border-radius:12px;
        padding:11px 15px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-social-btn.primary {
        background:#42c4e8;
        color:#fff;
      }

      .ez-social-btn.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-social-metrics {
        display:grid;
        grid-template-columns:
          repeat(7,minmax(0,1fr));
        gap:10px;
        margin:18px 0;
      }

      .ez-social-metric {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:17px;
        padding:15px;
      }

      .ez-social-metric span {
        display:block;
        color:#718998;
        font-size:11px;
        margin-bottom:6px;
      }

      .ez-social-metric strong {
        font-size:22px;
      }

      .ez-social-tabs {
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-bottom:16px;
      }

      .ez-social-tab {
        border:0;
        border-radius:11px;
        padding:10px 14px;
        cursor:pointer;
        background:#edf8fc;
        color:#176984;
        font-weight:800;
      }

      .ez-social-tab.active {
        background:#42c4e8;
        color:#fff;
      }

      .ez-social-toolbar {
        display:grid;
        grid-template-columns:
          minmax(240px,1fr)
          180px
          180px
          auto;
        gap:8px;
        margin-bottom:16px;
      }

      .ez-social-input,
      .ez-social-select,
      .ez-social-textarea {
        width:100%;
        box-sizing:border-box;
        border:1px solid #dbeaf0;
        border-radius:12px;
        padding:12px 13px;
        background:#fff;
        color:#17384f;
        outline:none;
      }

      .ez-social-textarea {
        min-height:140px;
        resize:vertical;
      }

      .ez-social-input:focus,
      .ez-social-select:focus,
      .ez-social-textarea:focus {
        border-color:#4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-social-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:14px;
      }

      .ez-social-card {
        background:#fff;
        border:1px solid #deedf2;
        border-radius:20px;
        padding:18px;
      }

      .ez-social-card h3 {
        margin:0 0 7px;
      }

      .ez-social-card p {
        color:#718997;
        line-height:1.8;
        font-size:12px;
      }

      .ez-social-badges {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin:9px 0;
      }

      .ez-social-badge {
        display:inline-flex;
        border-radius:999px;
        padding:5px 9px;
        background:#edf8fc;
        color:#176984;
        font-size:10px;
        font-weight:850;
      }

      .ez-social-badge.success {
        background:#eefaf5;
        color:#267255;
      }

      .ez-social-badge.warning {
        background:#fff8e8;
        color:#8b671a;
      }

      .ez-social-badge.danger {
        background:#fff0f2;
        color:#a32943;
      }

      .ez-social-platforms {
        display:grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap:10px;
      }

      .ez-social-platform {
        padding:18px;
        border:1px solid #deedf2;
        border-radius:18px;
        background:#fff;
      }

      .ez-social-platform-icon {
        font-size:28px;
        margin-bottom:10px;
      }

      .ez-social-platform-name {
        font-weight:900;
      }

      .ez-social-platform-status {
        color:#718997;
        font-size:11px;
        margin-top:6px;
      }

      .ez-social-form {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:13px;
      }

      .ez-social-field {
        display:flex;
        flex-direction:column;
        gap:6px;
      }

      .ez-social-field.full {
        grid-column:1/-1;
      }

      .ez-social-field label {
        font-size:12px;
        font-weight:800;
        color:#57717f;
      }

      .ez-social-checkboxes {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .ez-social-check {
        display:flex;
        align-items:center;
        gap:8px;
        padding:12px;
        border-radius:12px;
        background:#f7fbfd;
        border:1px solid #e2eef2;
      }

      .ez-social-check small {
        color:#7b929d;
      }

      .ez-social-modal {
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

      .ez-social-modal.open {
        display:flex;
      }

      .ez-social-dialog {
        width:min(900px,100%);
        max-height:94vh;
        overflow:auto;
        background:#fff;
        border-radius:24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-social-dialog-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:18px 21px;
        border-bottom:1px solid #e4eff3;
      }

      .ez-social-dialog-body {
        padding:21px;
      }

      .ez-social-dialog-footer {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        padding:15px 21px;
        border-top:1px solid #e4eff3;
      }

      .ez-social-log {
        max-height:430px;
        overflow:auto;
      }

      .ez-social-log-item {
        padding:13px;
        margin-bottom:8px;
        border-radius:13px;
        background:#f8fcfd;
        border:1px solid #e4eef2;
      }

      .ez-social-log-item strong {
        display:block;
        margin-bottom:4px;
      }

      .ez-social-log-item span {
        color:#8196a0;
        font-size:10px;
      }

      #ez-social-toast {
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

      #ez-social-toast.show {
        opacity:1;
        transform:translateY(0);
      }

      @media(max-width:1250px) {
        .ez-social-metrics {
          grid-template-columns:
            repeat(4,minmax(0,1fr));
        }

        .ez-social-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .ez-social-platforms {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }
      }

      @media(max-width:750px) {
        #social-command-section {
          padding:12px;
        }

        .ez-social-header {
          display:block;
        }

        .ez-social-actions {
          margin-top:15px;
        }

        .ez-social-metrics {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .ez-social-grid,
        .ez-social-platforms,
        .ez-social-form,
        .ez-social-checkboxes {
          grid-template-columns:1fr;
        }

        .ez-social-field.full {
          grid-column:auto;
        }

        .ez-social-toolbar {
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
        "#social-command-section"
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
      "social-command-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function getMetrics() {
    const posts =
      state.posts;

    return {
      total:
        posts.length,

      drafts:
        posts.filter(
          (post) =>
            post.status ===
            "draft"
        ).length,

      queued:
        posts.filter(
          (post) =>
            post.status ===
            "queued"
        ).length,

      scheduled:
        posts.filter(
          (post) =>
            post.status ===
            "scheduled"
        ).length,

      publishing:
        posts.filter(
          (post) =>
            post.status ===
            "publishing"
        ).length,

      published:
        posts.filter(
          (post) =>
            post.status ===
            "published"
        ).length,

      failed:
        posts.filter(
          (post) =>
            post.status ===
            "failed"
        ).length
    };
  }

  function render() {
    const section =
      ensureSection();

    const metrics =
      getMetrics();

    section.innerHTML = `
      <div
        class="ez-social-shell"
      >

        <div
          class="ez-social-header"
        >

          <div>
            <h2>
              مركز التحكم الاجتماعي الذكي
            </h2>

            <p>
              غرفة واحدة لإدارة وتجهيز وجدولة
              وتوزيع محتوى EZ MEDIA على المنصات.
            </p>
          </div>

          <div
            class="ez-social-actions"
          >

            <button
              class="
                ez-social-btn
                primary
              "
              data-social-action="new"
            >
              + منشور جديد
            </button>

            <button
              class="ez-social-btn"
              data-social-action="suggest"
            >
              اقتراح ذكي
            </button>

            <button
              class="ez-social-btn"
              data-social-action="refresh"
            >
              تحديث
            </button>

          </div>

        </div>

        <div
          class="ez-social-metrics"
        >

          ${metric(
            "الإجمالي",
            metrics.total
          )}

          ${metric(
            "مسودات",
            metrics.drafts
          )}

          ${metric(
            "في الطابور",
            metrics.queued
          )}

          ${metric(
            "مجدولة",
            metrics.scheduled
          )}

          ${metric(
            "قيد النشر",
            metrics.publishing
          )}

          ${metric(
            "منشورة",
            metrics.published
          )}

          ${metric(
            "فاشلة",
            metrics.failed
          )}

        </div>

        <div
          class="ez-social-tabs"
        >

          ${tab(
            "dashboard",
            "الرئيسية"
          )}

          ${tab(
            "posts",
            "المنشورات"
          )}

          ${tab(
            "platforms",
            "المنصات"
          )}

          ${tab(
            "calendar",
            "الجدولة"
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
              "posts"
            ? renderPosts()
            : state.activeTab ===
              "platforms"
            ? renderPlatforms()
            : state.activeTab ===
              "calendar"
            ? renderCalendar()
            : state.activeTab ===
              "settings"
            ? renderSettings()
            : renderEvents()
        }

      </div>

      <div
        id="ez-social-modal"
        class="ez-social-modal"
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
        class="ez-social-metric"
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
          ez-social-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-social-tab="${escapeHtml(
          key
        )}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function renderDashboard() {
    return `
      <div
        class="ez-social-grid"
      >

        <div
          class="ez-social-card"
        >

          <h3>
            المنصات المتصلة
          </h3>

          <p>
            المنصة الداخلية جاهزة للتكامل،
            بينما المنصات الخارجية تنتظر
            ربط APIs الرسمية.
          </p>

          <div
            class="ez-social-badges"
          >

            <span
              class="
                ez-social-badge
                success
              "
            >
              الموقع: جاهز
            </span>

            <span
              class="
                ez-social-badge
                warning
              "
            >
              الخارجية: تحتاج OAuth/API
            </span>

          </div>

        </div>

        <div
          class="ez-social-card"
        >

          <h3>
            التوزيع الذكي
          </h3>

          <p>
            يحدد المركز المنصة المناسبة
            بحسب نوع المحتوى وطوله وصيغته.
          </p>

          <button
            class="
              ez-social-btn
              primary
            "
            data-social-action="suggest"
          >
            تشغيل الاقتراح
          </button>

        </div>

        <div
          class="ez-social-card"
        >

          <h3>
            حماية النشر
          </h3>

          <p>
            يمكن منع النشر الخارجي حتى اعتماد
            المادة من المحرر قبل إرسالها للمنصة.
          </p>

          <div
            class="ez-social-badges"
          >

            <span
              class="ez-social-badge"
            >
              مراجعة بشرية
            </span>

            <span
              class="ez-social-badge"
            >
              سجل عمليات
            </span>

          </div>

        </div>

      </div>
    `;
  }

  function renderPosts() {
    const posts =
      filteredPosts();

    return `
      <div
        class="ez-social-toolbar"
      >

        <input
          id="ez-social-search"
          class="ez-social-input"
          placeholder="ابحث في المنشورات..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-social-platform"
          class="ez-social-select"
        >

          <option value="all">
            كل المنصات
          </option>

          ${Object.values(
            PLATFORMS
          )
            .map(
              (platform) => `
                <option
                  value="${escapeHtml(
                    platform.id
                  )}"
                  ${
                    state.platform ===
                    platform.id
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    platform.name
                  )}
                </option>
              `
            )
            .join("")}

        </select>

        <select
          id="ez-social-status"
          class="ez-social-select"
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
          class="ez-social-btn"
          data-social-action="clear"
        >
          مسح
        </button>

      </div>

      <div
        class="ez-social-grid"
      >

        ${
          posts.length
            ? posts
                .map(
                  renderPost
                )
                .join("")
            : `
              <div
                class="ez-social-card"
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد منشورات.
              </div>
            `
        }

      </div>
    `;
  }

  function filteredPosts() {
    const query =
      state.search
        .trim()
        .toLowerCase();

    return state.posts
      .filter(
        (post) => {
          if (
            state.platform !==
              "all" &&
            post.platform !==
              state.platform
          ) {
            return false;
          }

          if (
            state.status !==
              "all" &&
            post.status !==
              state.status
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            post.title,
            post.body,
            post.platform,
            post.status,
            post.contentType
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
      );
  }

  function renderPost(
    post
  ) {
    const platform =
      PLATFORMS[
        post.platform
      ];

    const statusClass =
      post.status ===
      "published"
        ? "success"
        : post.status ===
            "failed"
        ? "danger"
        : "warning";

    return `
      <article
        class="ez-social-card"
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
                post.title
              )}
            </h3>

            <div
              class="ez-social-badges"
            >

              <span
                class="ez-social-badge"
              >
                ${
                  platform
                    ? platform.icon +
                      " " +
                      escapeHtml(
                        platform.name
                      )
                    : escapeHtml(
                        post.platform
                      )
                }
              </span>

              <span
                class="
                  ez-social-badge
                  ${statusClass}
                "
              >
                ${escapeHtml(
                  STATUS[
                    post.status
                  ] ||
                    post.status
                )}
              </span>

              <span
                class="ez-social-badge"
              >
                ${escapeHtml(
                  CONTENT_TYPES[
                    post.contentType
                  ] ||
                    post.contentType
                )}
              </span>

            </div>
          </div>

        </div>

        <p>
          ${escapeHtml(
            post.body
          ).slice(
            0,
            260
          )}
          ${
            post.body.length >
            260
              ? "..."
              : ""
          }
        </p>

        ${
          post.hashtags
            .length
            ? `
              <p>
                ${post.hashtags
                  .map(
                    (tag) =>
                      "#" +
                      escapeHtml(
                        tag
                      )
                  )
                  .join(
                    " "
                  )}
              </p>
            `
            : ""
        }

        ${
          post.scheduledAt
            ? `
              <div
                style="
                  color:#718997;
                  font-size:11px;
                  margin-bottom:9px;
                "
              >
                الموعد:
                ${escapeHtml(
                  post.scheduledAt
                )}
              </div>
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
            class="ez-social-btn"
            data-social-action="details"
            data-id="${escapeHtml(
              post.id
            )}"
          >
            التفاصيل
          </button>

          ${
            post.status ===
            "draft"
              ? `
                <button
                  class="
                    ez-social-btn
                    primary
                  "
                  data-social-action="queue"
                  data-id="${escapeHtml(
                    post.id
                  )}"
                >
                  إضافة للطابور
                </button>
              `
              : ""
          }

          ${
            post.status ===
            "queued"
              ? `
                <button
                  class="
                    ez-social-btn
                    primary
                  "
                  data-social-action="publish"
                  data-id="${escapeHtml(
                    post.id
                  )}"
                >
                  تجهيز للنشر
                </button>
              `
              : ""
          }

          ${
            post.status ===
            "failed"
              ? `
                <button
                  class="
                    ez-social-btn
                    primary
                  "
                  data-social-action="retry"
                  data-id="${escapeHtml(
                    post.id
                  )}"
                >
                  إعادة المحاولة
                </button>
              `
              : ""
          }

          ${
            post.status !==
              "published" &&
            post.status !==
              "cancelled"
              ? `
                <button
                  class="
                    ez-social-btn
                    danger
                  "
                  data-social-action="cancel"
                  data-id="${escapeHtml(
                    post.id
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

  function renderPlatforms() {
    return `
      <div
        class="ez-social-platforms"
      >

        ${Object.values(
          PLATFORMS
        )
          .map(
            (platform) => `
              <div
                class="
                  ez-social-platform
                "
              >

                <div
                  class="
                    ez-social-platform-icon
                  "
                >
                  ${escapeHtml(
                    platform.icon
                  )}
                </div>

                <div
                  class="
                    ez-social-platform-name
                  "
                >
                  ${escapeHtml(
                    platform.name
                  )}
                </div>

                <div
                  class="
                    ez-social-platform-status
                  "
                >
                  ${
                    platform.apiReady
                      ? "جاهز للتكامل الداخلي"
                      : "بانتظار API رسمي"
                  }
                </div>

                <div
                  class="
                    ez-social-badges
                  "
                >

                  <span
                    class="
                      ez-social-badge
                      ${
                        platform.apiReady
                          ? "success"
                          : "warning"
                      }
                    "
                  >
                    ${
                      platform.apiReady
                        ? "متاح"
                        : "غير مربوط"
                    }
                  </span>

                </div>

              </div>
            `
          )
          .join("")}

      </div>
    `;
  }

  function renderCalendar() {
    const scheduled =
      state.posts
        .filter(
          (post) =>
            post.status ===
              "scheduled" ||
            post.status ===
              "queued"
        )
        .sort(
          (a, b) =>
            new Date(
              a.scheduledAt ||
                a.createdAt
            ) -
            new Date(
              b.scheduledAt ||
                b.createdAt
            )
        );

    return `
      <div
        class="ez-social-card"
      >

        <h3>
          تقويم التوزيع
        </h3>

        <p>
          المنشورات المجدولة والطابور الحالي.
        </p>

        ${
          scheduled.length
            ? scheduled
                .map(
                  (post) => {
                    const platform =
                      PLATFORMS[
                        post.platform
                      ];

                    return `
                      <div
                        style="
                          padding:13px;
                          margin-bottom:8px;
                          border:1px solid #e3eef2;
                          border-radius:13px;
                          background:#f8fcfd;
                        "
                      >

                        <strong>
                          ${escapeHtml(
                            post.title
                          )}
                        </strong>

                        <div
                          style="
                            color:#718997;
                            font-size:11px;
                            margin-top:5px;
                          "
                        >
                          ${
                            platform
                              ? platform.icon +
                                " " +
                                platform.name
                              : post.platform
                          }

                          ·

                          ${
                            post.scheduledAt
                              ? escapeHtml(
                                  post.scheduledAt
                                )
                              : "بدون موعد"
                          }
                        </div>

                      </div>
                    `;
                  }
                )
                .join("")
            : `
              <div
                style="
                  text-align:center;
                  padding:45px;
                  color:#718997;
                "
              >
                لا توجد منشورات مجدولة.
              </div>
            `
        }

      </div>
    `;
  }

  function renderSettings() {
    return `
      <div
        class="ez-social-card"
      >

        <h3>
          إعدادات مركز التواصل
        </h3>

        <div
          style="
            display:grid;
            gap:9px;
            margin-top:15px;
          "
        >

          ${setting(
            "تفعيل المركز",
            "enabled"
          )}

          ${setting(
            "اقتراح المنصات تلقائيًا",
            "autoSuggestPlatforms"
          )}

          ${setting(
            "إنشاء مسودات تلقائيًا",
            "autoCreateDrafts"
          )}

          ${setting(
            "طلب اعتماد قبل النشر",
            "requireApproval"
          )}

        </div>

        <div
          class="ez-social-form"
          style="margin-top:16px"
        >

          <div
            class="ez-social-field"
          >
            <label>
              الحد الأقصى لطابور النشر
            </label>

            <input
              id="ez-social-max-queue"
              class="ez-social-input"
              type="number"
              min="1"
              max="1000"
              value="${escapeHtml(
                state.settings.maxQueue
              )}"
            />
          </div>

          <div
            class="ez-social-field"
          >
            <label>
              عدد محاولات إعادة النشر
            </label>

            <input
              id="ez-social-retry-limit"
              class="ez-social-input"
              type="number"
              min="0"
              max="20"
              value="${escapeHtml(
                state.settings.retryLimit
              )}"
            />
          </div>

        </div>

        <button
          class="
            ez-social-btn
            primary
          "
          style="margin-top:16px"
          data-social-action="save-settings"
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
        class="ez-social-check"
      >

        <input
          type="checkbox"
          data-social-setting="${escapeHtml(
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
        class="ez-social-card"
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
              سجل عمليات التواصل
            </h3>

            <p>
              سجل محلي لعمليات الإنشاء والجدولة
              والتجهيز والنشر.
            </p>
          </div>

          <button
            class="
              ez-social-btn
              danger
            "
            data-social-action="clear-events"
          >
            مسح السجل
          </button>

        </div>

        <div
          class="ez-social-log"
        >

          ${
            events.length
              ? events
                  .map(
                    (event) => `
                      <div
                        class="
                          ez-social-log-item
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
        "#ez-social-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div
        class="ez-social-dialog"
      >

        <div
          class="ez-social-dialog-head"
        >

          <strong>
            ${escapeHtml(
              title
            )}
          </strong>

          <button
            class="ez-social-btn"
            data-social-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-social-dialog-body"
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-social-dialog-footer
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
        "#ez-social-modal"
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

  function openPostForm(
    existing = null
  ) {
    const post =
      existing ||
      normalizePost({});

    openModal(
      existing
        ? "تعديل المنشور"
        : "إنشاء منشور جديد",
      `
        <form
          id="ez-social-post-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              post.id
            )}"
          />

          <div
            class="ez-social-form"
          >

            <div
              class="
                ez-social-field
                full
              "
            >
              <label>
                العنوان
              </label>

              <input
                class="ez-social-input"
                name="title"
                required
                value="${escapeHtml(
                  post.title
                )}"
              />
            </div>

            <div
              class="
                ez-social-field
                full
              "
            >
              <label>
                النص
              </label>

              <textarea
                class="
                  ez-social-textarea
                "
                name="body"
                required
              >${escapeHtml(
                post.body
              )}</textarea>
            </div>

            <div
              class="
                ez-social-field
              "
            >
              <label>
                المنصة
              </label>

              <select
                class="
                  ez-social-select
                "
                name="platform"
              >

                ${Object.values(
                  PLATFORMS
                )
                  .map(
                    (platform) => `
                      <option
                        value="${escapeHtml(
                          platform.id
                        )}"
                        ${
                          post.platform ===
                          platform.id
                            ? "selected"
                            : ""
                        }
                      >
                        ${escapeHtml(
                          platform.name
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="
                ez-social-field
              "
            >
              <label>
                نوع المحتوى
              </label>

              <select
                class="
                  ez-social-select
                "
                name="contentType"
              >

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
                          post.contentType ===
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
                ez-social-field
              "
            >
              <label>
                Content ID
              </label>

              <input
                class="ez-social-input"
                name="contentId"
                dir="ltr"
                value="${escapeHtml(
                  post.contentId
                )}"
              />
            </div>

            <div
              class="
                ez-social-field
              "
            >
              <label>
                رابط المحتوى
              </label>

              <input
                class="ez-social-input"
                name="link"
                dir="ltr"
                value="${escapeHtml(
                  post.link
                )}"
              />
            </div>

            <div
              class="
                ez-social-field
              "
            >
              <label>
                رابط الوسائط
              </label>

              <input
                class="ez-social-input"
                name="mediaUrl"
                dir="ltr"
                value="${escapeHtml(
                  post.mediaUrl
                )}"
              />
            </div>

            <div
              class="
                ez-social-field
              "
            >
              <label>
                موعد الجدولة
              </label>

              <input
                class="ez-social-input"
                type="datetime-local"
                name="scheduledAt"
                value="${toLocalDateTime(
                  post.scheduledAt
                )}"
              />
            </div>

            <div
              class="
                ez-social-field
                full
              "
            >
              <label>
                الهاشتاقات
              </label>

              <input
                class="ez-social-input"
                name="hashtags"
                placeholder="السعودية, أخبار, EZMEDIA"
                value="${escapeHtml(
                  post.hashtags.join(
                    ", "
                  )
                )}"
              />
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-social-btn"
          data-social-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-social-btn
            primary
          "
          data-social-action="save-post"
        >
          حفظ المنشور
        </button>
      `
    );
  }

  function toLocalDateTime(
    value
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const pad =
      (number) =>
        String(number)
          .padStart(
            2,
            "0"
          );

    return (
      date.getFullYear() +
      "-" +
      pad(
        date.getMonth() + 1
      ) +
      "-" +
      pad(
        date.getDate()
      ) +
      "T" +
      pad(
        date.getHours()
      ) +
      ":" +
      pad(
        date.getMinutes()
      )
    );
  }

  function savePost() {
    const form =
      document.querySelector(
        "#ez-social-post-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const postId =
      String(
        data.get("id") ||
          ""
      );

    const hashtags =
      String(
        data.get(
          "hashtags"
        ) ||
          ""
      )
        .split(",")
        .map(
          (tag) =>
            tag
              .trim()
              .replace(
                /^#/,
                ""
              )
        )
        .filter(Boolean);

    const values = {
      id:
        postId ||
        uid("post"),

      title:
        String(
          data.get("title") ||
            ""
        ).trim(),

      body:
        String(
          data.get("body") ||
            ""
        ).trim(),

      platform:
        data.get(
          "platform"
        ) ||
        "website",

      contentType:
        data.get(
          "contentType"
        ) ||
        "news",

      contentId:
        String(
          data.get(
            "contentId"
          ) ||
            ""
        ).trim(),

      link:
        String(
          data.get(
            "link"
          ) ||
            ""
        ).trim(),

      mediaUrl:
        String(
          data.get(
            "mediaUrl"
          ) ||
            ""
        ).trim(),

      scheduledAt:
        data.get(
          "scheduledAt"
        )
          ? new Date(
              data.get(
                "scheduledAt"
              )
            ).toISOString()
          : null,

      hashtags
    };

    if (
      !values.title ||
      !values.body
    ) {
      notify(
        "العنوان والنص مطلوبان.",
        "warning"
      );

      return;
    }

    const existingIndex =
      state.posts.findIndex(
        (item) =>
          String(
            item.id
          ) === postId
      );

    let post;

    if (
      existingIndex >=
      0
    ) {
      post =
        normalizePost({
          ...state.posts[
            existingIndex
          ],
          ...values,
          updatedAt:
            now()
        });

      state.posts[
        existingIndex
      ] = post;

      addEvent(
        "post_updated",
        "تم تعديل منشور.",
        {
          postId:
            post.id
        }
      );
    } else {
      post =
        normalizePost({
          ...values,
          status:
            values.scheduledAt
              ? "scheduled"
              : "draft"
        });

      state.posts.push(
        post
      );

      addEvent(
        "post_created",
        "تم إنشاء منشور جديد.",
        {
          postId:
            post.id,
          platform:
            post.platform
        }
      );
    }

    save();

    closeModal();

    render();

    notify(
      "تم حفظ المنشور.",
      "success"
    );
  }

  function getPost(
    idValue
  ) {
    return state.posts.find(
      (post) =>
        String(post.id) ===
        String(idValue)
    );
  }

  function queuePost(
    idValue
  ) {
    const post =
      getPost(idValue);

    if (!post) {
      return;
    }

    if (
      post.status ===
      "published"
    ) {
      return;
    }

    const queuedCount =
      state.posts.filter(
        (item) =>
          item.status ===
          "queued"
      ).length;

    if (
      queuedCount >=
      Number(
        state.settings
          .maxQueue
      )
    ) {
      notify(
        "وصل طابور النشر إلى الحد المحدد.",
        "warning"
      );

      return;
    }

    post.status =
      "queued";

    post.updatedAt =
      now();

    addEvent(
      "post_queued",
      "تمت إضافة المنشور إلى طابور التوزيع.",
      {
        postId:
          post.id,
        platform:
          post.platform
      }
    );

    save();

    render();

    notify(
      "تمت إضافة المنشور للطابور.",
      "success"
    );
  }

  function preparePublish(
    idValue
  ) {
    const post =
      getPost(idValue);

    if (!post) {
      return;
    }

    if (
      state.settings
        .requireApproval
    ) {
      post.status =
        "preparing";

      post.updatedAt =
        now();

      addEvent(
        "publish_preparation",
        "تم تجهيز المنشور، ويحتاج اعتمادًا قبل النشر الخارجي.",
        {
          postId:
            post.id,
          platform:
            post.platform
        }
      );

      save();

      render();

      notify(
        "تم تجهيز المنشور ويحتاج اعتمادًا.",
        "success"
      );

      return;
    }

    publish(
      post.id
    );
  }

  function publish(
    idValue
  ) {
    const post =
      getPost(idValue);

    if (!post) {
      return false;
    }

    const platform =
      PLATFORMS[
        post.platform
      ];

    if (!platform) {
      return false;
    }

    post.attempts =
      Number(
        post.attempts || 0
      ) + 1;

    post.updatedAt =
      now();

    if (
      !platform.apiReady
    ) {
      post.status =
        "failed";

      post.error =
        "API الرسمي للمنصة غير مربوط بعد. لم يتم الادعاء بنجاح النشر.";

      addEvent(
        "publish_blocked",
        "تم منع النشر الخارجي لعدم وجود API رسمي مربوط.",
        {
          postId:
            post.id,
          platform:
            post.platform
        }
      );

      save();

      render();

      notify(
        `لم يتم النشر في ${platform.name}: API الرسمي غير مربوط.`,
        "warning"
      );

      return false;
    }

    if (
      post.approvalRequired &&
      state.settings
        .requireApproval
    ) {
      post.status =
        "preparing";

      addEvent(
        "approval_required",
        "المنشور يحتاج اعتمادًا قبل النشر.",
        {
          postId:
            post.id
        }
      );

      save();

      render();

      return false;
    }

    if (
      post.platform ===
      "website"
    ) {
      publishToWebsite(
        post
      );

      return true;
    }

    return false;
  }

  async function publishToWebsite(
    post
  ) {
    post.status =
      "publishing";

    post.updatedAt =
      now();

    save();

    render();

    try {
      if (
        !post.contentId
      ) {
        throw new Error(
          "Content ID غير موجود."
        );
      }

      const response =
        await fetch(
          `/api/content/${encodeURIComponent(
            post.contentId
          )}/publish`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            credentials:
              "include"
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
            "فشل نشر المحتوى على الموقع."
        );
      }

      post.status =
        "published";

      post.publishedAt =
        now();

      post.externalId =
        data.id ||
        post.contentId;

      post.error = "";

      post.updatedAt =
        now();

      addEvent(
        "website_published",
        "تم نشر المحتوى على موقع EZ MEDIA.",
        {
          postId:
            post.id,
          contentId:
            post.contentId
        }
      );

      notify(
        "تم نشر المحتوى على الموقع.",
        "success"
      );
    } catch (error) {
      post.status =
        "failed";

      post.error =
        error.message ||
        "فشل النشر.";

      post.updatedAt =
        now();

      addEvent(
        "website_publish_failed",
        "فشل نشر المحتوى على الموقع.",
        {
          postId:
            post.id,
          error:
            post.error
        }
      );

      notify(
        post.error,
        "warning"
      );
    }

    save();

    render();
  }

  function retryPost(
    idValue
  ) {
    const post =
      getPost(idValue);

    if (!post) {
      return;
    }

    if (
      Number(
        post.attempts
      ) >=
      Number(
        state.settings
          .retryLimit
      )
    ) {
      notify(
        "تم الوصول إلى الحد الأقصى لإعادة المحاولة.",
        "warning"
      );

      return;
    }

    post.status =
      "queued";

    post.error = "";

    post.updatedAt =
      now();

    addEvent(
      "publish_retry",
      "تمت إعادة المنشور إلى الطابور.",
      {
        postId:
          post.id
      }
    );

    save();

    render();

    notify(
      "تمت إعادة المحاولة.",
      "success"
    );
  }

  function cancelPost(
    idValue
  ) {
    const post =
      getPost(idValue);

    if (!post) {
      return;
    }

    post.status =
      "cancelled";

    post.updatedAt =
      now();

    addEvent(
      "post_cancelled",
      "تم إلغاء المنشور.",
      {
        postId:
          post.id
      }
    );

    save();

    render();

    notify(
      "تم إلغاء المنشور.",
      "success"
    );
  }

  function suggestPlatforms() {
    const posts =
      state.posts
        .filter(
          (post) =>
            post.status ===
              "draft" ||
            post.status ===
              "queued"
        );

    if (!posts.length) {
      notify(
        "لا توجد مواد تحتاج اقتراحًا.",
        "info"
      );

      return;
    }

    posts.forEach(
      (post) => {
        post.aiSuggestion =
          suggestForContent(
            post
          );

        post.updatedAt =
          now();
      }
    );

    addEvent(
      "ai_platform_suggestions",
      "تم إنشاء اقتراحات توزيع ذكية للمواد.",
      {
        count:
          posts.length
      }
    );

    save();

    render();

    notify(
      "تم إنشاء الاقتراحات الذكية.",
      "success"
    );
  }

  function suggestForContent(
    post
  ) {
    const text =
      (
        post.title +
        " " +
        post.body
      ).toLowerCase();

    const suggested =
      new Set([
        "website"
      ]);

    if (
      post.contentType ===
        "video" ||
      post.mediaUrl
    ) {
      suggested.add(
        "youtube"
      );

      suggested.add(
        "instagram"
      );

      suggested.add(
        "tiktok"
      );
    }

    if (
      post.contentType ===
      "breaking"
    ) {
      suggested.add(
        "x"
      );

      suggested.add(
        "telegram"
      );
    }

    if (
      post.contentType ===
        "news" ||
      post.contentType ===
        "report"
    ) {
      suggested.add(
        "x"
      );

      suggested.add(
        "telegram"
      );
    }

    if (
      text.includes(
        "فيديو"
      ) ||
      text.includes(
        "مشاهد"
      )
    ) {
      suggested.add(
        "youtube"
      );
    }

    return {
      platforms:
        [...suggested],

      reason:
        "اقتراح أولي مبني على نوع المحتوى وصيغته. القرار النهائي يعتمد على قواعد النشر وAPIs الرسمية.",

      generatedAt:
        now()
    };
  }

  function showSuggestions(
    idValue
  ) {
    const post =
      getPost(idValue);

    if (!post) {
      return;
    }

    const suggestion =
      post.aiSuggestion ||
      suggestForContent(
        post
      );

    const names =
      suggestion.platforms
        .map(
          (id) =>
            PLATFORMS[id]
              ? PLATFORMS[id]
                  .name
              : id
        );

    openModal(
      "اقتراح التوزيع الذكي",
      `
        <div
          class="ez-social-card"
        >

          <h3>
            المنصات المقترحة
          </h3>

          <div
            class="ez-social-badges"
          >

            ${names
              .map(
                (name) => `
                  <span
                    class="
                      ez-social-badge
                    "
                  >
                    ${escapeHtml(
                      name
                    )}
                  </span>
                `
              )
              .join("")}

          </div>

          <p>
            ${escapeHtml(
              suggestion.reason
            )}
          </p>

        </div>
      `,
      `
        <button
          class="ez-social-btn"
          data-social-action="close"
        >
          إغلاق
        </button>
      `
    );
  }

  function showDetails(
    idValue
  ) {
    const post =
      getPost(idValue);

    if (!post) {
      return;
    }

    const platform =
      PLATFORMS[
        post.platform
      ];

    openModal(
      "تفاصيل المنشور",
      `
        <div
          class="ez-social-form"
        >

          ${detail(
            "المعرف",
            post.id
          )}

          ${detail(
            "العنوان",
            post.title
          )}

          ${detail(
            "المنصة",
            platform
              ? platform.name
              : post.platform
          )}

          ${detail(
            "الحالة",
            STATUS[
              post.status
            ] ||
              post.status
          )}

          ${detail(
            "نوع المحتوى",
            CONTENT_TYPES[
              post.contentType
            ] ||
              post.contentType
          )}

          ${detail(
            "Content ID",
            post.contentId ||
              "غير محدد"
          )}

          ${detail(
            "المحاولات",
            post.attempts
          )}

          <div
            class="
              ez-social-field
              full
            "
          >

            <label>
              النص
            </label>

            <div
              style="
                padding:14px;
                border-radius:12px;
                background:#f7fbfd;
                border:1px solid #e2eef2;
                line-height:1.9;
              "
            >
              ${escapeHtml(
                post.body
              )}
            </div>

          </div>

          ${
            post.error
              ? `
                <div
                  class="
                    ez-social-field
                    full
                  "
                >
                  <label>
                    آخر خطأ
                  </label>

                  <div
                    style="
                      color:#a32943;
                      background:#fff0f2;
                      padding:13px;
                      border-radius:12px;
                    "
                  >
                    ${escapeHtml(
                      post.error
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
          class="ez-social-btn"
          data-social-action="close"
        >
          إغلاق
        </button>

        <button
          class="
            ez-social-btn
            primary
          "
          data-social-action="edit"
          data-id="${escapeHtml(
            post.id
          )}"
        >
          تعديل
        </button>

        <button
          class="ez-social-btn"
          data-social-action="suggest-one"
          data-id="${escapeHtml(
            post.id
          )}"
        >
          اقتراح ذكي
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
        class="ez-social-field"
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
        "[data-social-setting]"
      )
      .forEach(
        (input) => {
          state.settings[
            input.dataset
              .socialSetting
          ] =
            input.checked;
        }
      );

    const maxQueue =
      document.querySelector(
        "#ez-social-max-queue"
      );

    const retryLimit =
      document.querySelector(
        "#ez-social-retry-limit"
      );

    if (maxQueue) {
      state.settings.maxQueue =
        Math.max(
          1,
          Math.min(
            1000,
            Number(
              maxQueue.value
            ) || 100
          )
        );
    }

    if (retryLimit) {
      state.settings.retryLimit =
        Math.max(
          0,
          Math.min(
            20,
            Number(
              retryLimit.value
            ) || 3
          )
        );
    }

    save();

    render();

    notify(
      "تم حفظ إعدادات التواصل الاجتماعي.",
      "success"
    );
  }

  function clearFilters() {
    state.search = "";
    state.platform =
      "all";
    state.status =
      "all";

    render();
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#social-command-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-social-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .socialTab;

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-social-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .socialAction;

              const idValue =
                button.dataset
                  .id;

              if (
                action ===
                "new"
              ) {
                openPostForm();
                return;
              }

              if (
                action ===
                "refresh"
              ) {
                load();
                render();

                notify(
                  "تم تحديث المركز.",
                  "success"
                );

                return;
              }

              if (
                action ===
                "suggest"
              ) {
                suggestPlatforms();
                return;
              }

              if (
                action ===
                "suggest-one"
              ) {
                closeModal();
                showSuggestions(
                  idValue
                );
                return;
              }

              if (
                action ===
                "details"
              ) {
                showDetails(
                  idValue
                );
                return;
              }

              if (
                action ===
                "edit"
              ) {
                const post =
                  getPost(
                    idValue
                  );

                closeModal();

                if (post) {
                  openPostForm(
                    post
                  );
                }

                return;
              }

              if (
                action ===
                "save-post"
              ) {
                savePost();
                return;
              }

              if (
                action ===
                "queue"
              ) {
                queuePost(
                  idValue
                );
                return;
              }

              if (
                action ===
                "publish"
              ) {
                preparePublish(
                  idValue
                );
                return;
              }

              if (
                action ===
                "retry"
              ) {
                retryPost(
                  idValue
                );
                return;
              }

              if (
                action ===
                "cancel"
              ) {
                cancelPost(
                  idValue
                );
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
                "clear"
              ) {
                clearFilters();
                return;
              }

              if (
                action ===
                "clear-events"
              ) {
                if (
                  !window.confirm(
                    "هل تريد مسح سجل عمليات التواصل؟"
                  )
                ) {
                  return;
                }

                state.events =
                  [];

                save();

                render();

                notify(
                  "تم مسح السجل.",
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
        "#ez-social-search"
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

    const platform =
      section.querySelector(
        "#ez-social-platform"
      );

    if (platform) {
      platform.addEventListener(
        "change",
        (event) => {
          state.platform =
            event.target.value;

          render();
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-social-status"
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

    const modal =
      document.querySelector(
        "#ez-social-modal"
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
        "#social-command-section"
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

  function createPost(
    values = {}
  ) {
    const post =
      normalizePost(
        values
      );

    if (
      state.posts.length >=
      Number(
        state.settings
          .maxQueue
      ) &&
      post.status ===
        "queued"
    ) {
      throw new Error(
        "Social queue limit reached."
      );
    }

    state.posts.push(
      post
    );

    addEvent(
      "post_created_api",
      "تم إنشاء منشور من خلال واجهة التكامل.",
      {
        postId:
          post.id
      }
    );

    save();

    render();

    return clone(post);
  }

  function getPosts() {
    return clone(
      state.posts
    );
  }

  function getPlatforms() {
    return clone(
      PLATFORMS
    );
  }

  function getSettings() {
    return clone(
      state.settings
    );
  }

  function getEvents() {
    return clone(
      state.events
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

      platforms:
        Object.values(
          PLATFORMS
        ).map(
          (platform) => ({
            id:
              platform.id,

            name:
              platform.name,

            apiReady:
              platform.apiReady,

            type:
              platform.type
          })
        ),

      updatedAt:
        now()
    };
  }

  window.EZMediaSocialCommand =
    {
      module: MODULE,

      show,
      hide,
      refresh,

      createPost,
      getPosts,
      getPlatforms,
      getSettings,
      getEvents,
      getStatus,

      queuePost,
      publish,
      retryPost,
      cancelPost,

      suggestForContent
    };

  /*
   * استقبال المحتوى الجديد من CMS.
   */

  window.addEventListener(
    "ezmedia:content:published",
    (event) => {
      if (
        !state.settings
          .autoCreateDrafts
      ) {
        return;
      }

      const detail =
        event.detail || {};

      const contentId =
        detail.id ||
        detail.contentId ||
        "";

      const title =
        detail.title ||
        detail.headline ||
        "محتوى جديد";

      const body =
        detail.summary ||
        detail.body ||
        "";

      if (!contentId) {
        return;
      }

      createPost({
        contentId,

        title,

        body,

        platform:
          "website",

        contentType:
          detail.type ||
          "news",

        status:
          "draft"
      });
    }
  );

  /*
   * استقبال إشارات الأخبار العاجلة.
   */

  window.addEventListener(
    "ezmedia:breaking:created",
    (event) => {
      const detail =
        event.detail || {};

      const contentId =
        detail.contentId ||
        detail.id ||
        "";

      const post =
        createPost({
          contentId,

          title:
            detail.title ||
            "خبر عاجل",

          body:
            detail.summary ||
            detail.body ||
            "",

          platform:
            "x",

          contentType:
            "breaking",

          priority:
            "urgent",

          status:
            "draft"
        });

      post.aiSuggestion =
        suggestForContent(
          post
        );

      save();
    }
  );

  /*
   * استقبال طلب من أوركسترا الذكاء.
   */

  window.addEventListener(
    "ezmedia:ai:orchestrator:distribution",
    (event) => {
      const detail =
        event.detail || {};

      if (
        detail.contentId
      ) {
        createPost({
          contentId:
            detail.contentId,

          title:
            detail.title ||
            "توزيع محتوى",

          body:
            detail.body ||
            "",

          platform:
            detail.platform ||
            "website",

          contentType:
            detail.contentType ||
            "news",

          status:
            "draft"
        });
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
    "EZ MEDIA 11.0 — Social Command loaded."
  );
})();
