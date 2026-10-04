"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 33
 * الملف: public/admin-homepage-command.js
 *
 * مركز التحكم بالواجهة الرئيسية الذكية
 *
 * الوظائف:
 * - إدارة Hero الرئيسي
 * - إدارة الأخبار المميزة
 * - إدارة عاجل
 * - إدارة البث المباشر
 * - إدارة البانرات
 * - إدارة الأقسام الرئيسية
 * - إدارة الإعلانات والرعايات
 * - ترتيب عناصر الصفحة
 * - تفعيل / إيقاف العناصر
 * - جدولة العناصر
 * - معاينة الصفحة
 * - إعدادات التخصيص الذكي
 * - تجهيز الصفحة للربط مع AI
 */

(function () {
  "use strict";

  const MODULE =
    "homepage-command";

  const STORAGE_KEY =
    "ezmedia_homepage_command_v1";

  const SETTINGS_KEY =
    "ezmedia_homepage_settings_v1";

  const DEFAULT_STATE = {
    hero: {
      enabled: true,
      title:
        "EZ MEDIA",
      subtitle:
        "منصة إعلامية ذكية تجمع الأخبار والبث والمحتوى في تجربة واحدة.",
      description:
        "الواجهة الرئيسية الذكية لمنصة EZ MEDIA.",
      image: "",
      buttonText:
        "استكشف الآن",
      buttonUrl:
        "#",
      contentId: "",
      liveEnabled:
        true,
      breakingEnabled:
        true
    },

    items: [],

    sections: [
      {
        id: "breaking",
        title: "عاجل",
        type: "breaking",
        enabled: true,
        order: 1
      },
      {
        id: "live",
        title: "البث المباشر",
        type: "live",
        enabled: true,
        order: 2
      },
      {
        id: "featured-news",
        title: "أبرز الأخبار",
        type: "news",
        enabled: true,
        order: 3
      },
      {
        id: "reports",
        title: "تقارير",
        type: "reports",
        enabled: true,
        order: 4
      },
      {
        id: "videos",
        title: "فيديو",
        type: "video",
        enabled: true,
        order: 5
      },
      {
        id: "sponsors",
        title: "الرعايات والشراكات",
        type: "sponsors",
        enabled: true,
        order: 6
      }
    ]
  };

  const DEFAULT_SETTINGS = {
    smartOrdering:
      true,

    aiPersonalization:
      true,

    showLiveFirst:
      true,

    showBreakingFirst:
      true,

    showSponsoredContent:
      true,

    autoRefresh:
      true,

    refreshSeconds:
      30,

    maxFeatured:
      6,

    maxBreaking:
      5,

    maxLive:
      4
  };

  const ITEM_TYPES = {
    hero:
      "البطل الرئيسي",

    breaking:
      "عاجل",

    live:
      "بث مباشر",

    news:
      "خبر",

    report:
      "تقرير",

    interview:
      "مقابلة",

    video:
      "فيديو",

    coverage:
      "تغطية",

    sponsor:
      "رعاية",

    ad:
      "إعلان",

    banner:
      "بانر",

    section:
      "قسم"
  };

  const ITEM_STATUS = {
    draft:
      "مسودة",

    active:
      "نشط",

    scheduled:
      "مجدول",

    paused:
      "متوقف",

    expired:
      "منتهي"
  };

  const state = {
    config: {},
    settings: {},
    activeTab:
      "overview",
    search: "",
    type:
      "all",
    status:
      "all",
    selectedId:
      null
  };

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function createId(
    prefix = "home"
  ) {
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
        .slice(2, 8)
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

  function normalizeItem(
    item = {}
  ) {
    return {
      id:
        item.id ||
        createId(),

      title:
        item.title ||
        "عنصر جديد",

      subtitle:
        item.subtitle ||
        "",

      description:
        item.description ||
        "",

      type:
        item.type ||
        "news",

      status:
        item.status ||
        "draft",

      order:
        Number(
          item.order || 999
        ),

      enabled:
        item.enabled !== false,

      featured:
        Boolean(
          item.featured
        ),

      url:
        item.url ||
        "#",

      image:
        item.image ||
        "",

      contentId:
        item.contentId ||
        "",

      liveId:
        item.liveId ||
        "",

      sponsorId:
        item.sponsorId ||
        "",

      priority:
        item.priority ||
        "normal",

      startAt:
        item.startAt ||
        "",

      endAt:
        item.endAt ||
        "",

      createdAt:
        item.createdAt ||
        new Date().toISOString(),

      updatedAt:
        item.updatedAt ||
        new Date().toISOString()
    };
  }

  function normalizeConfig(
    config = {}
  ) {
    return {
      hero: {
        ...clone(
          DEFAULT_STATE.hero
        ),
        ...(config.hero || {})
      },

      items: Array.isArray(
        config.items
      )
        ? config.items.map(
            normalizeItem
          )
        : [],

      sections:
        Array.isArray(
          config.sections
        )
          ? config.sections.map(
              (section) => ({
                id:
                  section.id ||
                  createId(
                    "section"
                  ),

                title:
                  section.title ||
                  "قسم",

                type:
                  section.type ||
                  "news",

                enabled:
                  section.enabled !==
                  false,

                order:
                  Number(
                    section.order ||
                      999
                  )
              })
            )
          : clone(
              DEFAULT_STATE.sections
            )
    };
  }

  function load() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "null"
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

      state.config =
        normalizeConfig(
          saved || DEFAULT_STATE
        );

      state.settings = {
        ...clone(
          DEFAULT_SETTINGS
        ),
        ...(settings || {})
      };
    } catch (error) {
      console.warn(
        "EZ MEDIA Homepage load:",
        error
      );

      state.config =
        normalizeConfig(
          DEFAULT_STATE
        );

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
          state.config
        )
      );

      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(
          state.settings
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "ezmedia:homepage:updated",
          {
            detail: {
              config:
                clone(
                  state.config
                ),

              settings:
                clone(
                  state.settings
                )
            }
          }
        )
      );

      return true;
    } catch (error) {
      console.error(
        "EZ MEDIA Homepage save:",
        error
      );

      return false;
    }
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
              "الواجهة الرئيسية",
            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-homepage-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-homepage-toast";

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
        "#ez-homepage-command-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-homepage-command-styles";

    style.textContent = `
      #homepage-command-section {
        direction: rtl;
        padding: 22px;
        color: #17384f;
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
      }

      .ez-home-shell {
        max-width: 1600px;
        margin: auto;
      }

      .ez-home-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 24px;
        border-radius: 26px;
        border: 1px solid #d7edf4;
        background:
          linear-gradient(
            135deg,
            #eafaff,
            #ffffff
          );
      }

      .ez-home-header h2 {
        margin: 0 0 7px;
        font-size: 29px;
      }

      .ez-home-header p {
        margin: 0;
        color: #718997;
        line-height: 1.8;
      }

      .ez-home-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-home-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 800;
      }

      .ez-home-btn.primary {
        background: #42c4e8;
        color: #fff;
      }

      .ez-home-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-home-metrics {
        display: grid;
        grid-template-columns:
          repeat(7, minmax(0, 1fr));
        gap: 10px;
        margin: 18px 0;
      }

      .ez-home-metric {
        background: #fff;
        border: 1px solid #deedf2;
        border-radius: 17px;
        padding: 15px;
      }

      .ez-home-metric span {
        display: block;
        color: #718998;
        font-size: 11px;
        margin-bottom: 6px;
      }

      .ez-home-metric strong {
        font-size: 22px;
      }

      .ez-home-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-bottom: 16px;
      }

      .ez-home-tab {
        border: 0;
        border-radius: 11px;
        padding: 10px 14px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 800;
      }

      .ez-home-tab.active {
        background: #42c4e8;
        color: #fff;
      }

      .ez-home-toolbar {
        display: grid;
        grid-template-columns:
          minmax(240px, 1fr)
          180px
          180px
          auto;
        gap: 8px;
        margin-bottom: 16px;
      }

      .ez-home-input,
      .ez-home-select,
      .ez-home-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        border-radius: 12px;
        padding: 12px 13px;
        background: #fff;
        color: #17384f;
        outline: none;
      }

      .ez-home-input:focus,
      .ez-home-select:focus,
      .ez-home-textarea:focus {
        border-color: #4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-home-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .ez-home-card {
        background: #fff;
        border: 1px solid #deedf2;
        border-radius: 20px;
        padding: 18px;
      }

      .ez-home-card h3 {
        margin: 0 0 7px;
      }

      .ez-home-card-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .ez-home-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 9px 0;
      }

      .ez-home-badge {
        display: inline-flex;
        border-radius: 999px;
        padding: 5px 9px;
        background: #edf8fc;
        color: #176984;
        font-size: 10px;
        font-weight: 850;
      }

      .ez-home-badge.success {
        background: #eefaf5;
        color: #267255;
      }

      .ez-home-badge.warning {
        background: #fff8e8;
        color: #8b671a;
      }

      .ez-home-badge.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-home-card-image {
        width: 100%;
        height: 145px;
        object-fit: cover;
        border-radius: 14px;
        background: #eef8fb;
        margin-bottom: 12px;
      }

      .ez-home-placeholder {
        width: 100%;
        height: 145px;
        border-radius: 14px;
        background:
          linear-gradient(
            135deg,
            #e8f9ff,
            #f7fdff
          );
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5890a4;
        margin-bottom: 12px;
      }

      .ez-home-info {
        display: grid;
        grid-template-columns:
          repeat(3, 1fr);
        gap: 7px;
        margin: 13px 0;
      }

      .ez-home-info-item {
        padding: 9px;
        border-radius: 10px;
        background: #f7fbfd;
      }

      .ez-home-info-item span {
        display: block;
        color: #8195a0;
        font-size: 10px;
        margin-bottom: 3px;
      }

      .ez-home-info-item strong {
        font-size: 14px;
      }

      .ez-home-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 14px;
      }

      .ez-home-small {
        border: 0;
        border-radius: 9px;
        padding: 8px 10px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 750;
      }

      .ez-home-small.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-home-panel {
        background: #fff;
        border: 1px solid #deedf2;
        border-radius: 21px;
        padding: 20px;
      }

      .ez-home-hero-preview {
        padding: 28px;
        border-radius: 24px;
        min-height: 230px;
        display: flex;
        align-items: center;
        background:
          linear-gradient(
            135deg,
            #e8faff,
            #ffffff
          );
        border: 1px solid #d9edf3;
        position: relative;
        overflow: hidden;
      }

      .ez-home-hero-preview::after {
        content: "";
        position: absolute;
        width: 300px;
        height: 300px;
        border-radius: 50%;
        background:
          rgba(66,196,232,.12);
        left: -80px;
        bottom: -150px;
      }

      .ez-home-hero-content {
        max-width: 750px;
        position: relative;
        z-index: 1;
      }

      .ez-home-hero-content h1 {
        font-size: 38px;
        margin: 0 0 9px;
      }

      .ez-home-hero-content p {
        line-height: 1.9;
        color: #607f8d;
      }

      .ez-home-section-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        margin-bottom: 8px;
        border: 1px solid #e2eef2;
        border-radius: 14px;
        background: #fbfdfe;
      }

      .ez-home-section-row.dragging {
        opacity: .55;
      }

      .ez-home-drag {
        cursor: grab;
        color: #7b98a4;
        font-size: 20px;
      }

      .ez-home-section-main {
        flex: 1;
      }

      .ez-home-section-main strong {
        display: block;
      }

      .ez-home-section-main span {
        color: #8097a2;
        font-size: 11px;
      }

      .ez-home-toggle {
        width: 42px;
        height: 23px;
        border-radius: 999px;
        border: 0;
        padding: 2px;
        cursor: pointer;
        background: #cbdfe6;
      }

      .ez-home-toggle::after {
        content: "";
        display: block;
        width: 19px;
        height: 19px;
        border-radius: 50%;
        background: #fff;
        transition: .2s ease;
      }

      .ez-home-toggle.on {
        background: #42c4e8;
      }

      .ez-home-toggle.on::after {
        transform: translateX(-19px);
      }

      .ez-home-settings {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .ez-home-check {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 13px;
        border-radius: 13px;
        background: #f7fbfd;
        border: 1px solid #e2eef2;
      }

      .ez-home-form {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 13px;
      }

      .ez-home-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ez-home-field.full {
        grid-column: 1 / -1;
      }

      .ez-home-field label {
        font-size: 12px;
        font-weight: 800;
        color: #57717f;
      }

      .ez-home-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background:
          rgba(12,58,76,.27);
        backdrop-filter: blur(7px);
      }

      .ez-home-modal.open {
        display: flex;
      }

      .ez-home-dialog {
        width: min(900px,100%);
        max-height: 94vh;
        overflow: auto;
        background: #fff;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-home-dialog-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 21px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-home-dialog-body {
        padding: 21px;
      }

      .ez-home-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 15px 21px;
        border-top: 1px solid #e4eff3;
      }

      #ez-homepage-toast {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 100001;
        padding: 13px 17px;
        border-radius: 13px;
        background: #173f55;
        color: #fff;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition: .2s ease;
      }

      #ez-homepage-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width:1250px) {
        .ez-home-metrics {
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
        }

        .ez-home-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-home-toolbar {
          grid-template-columns:
            1fr 1fr;
        }
      }

      @media (max-width:700px) {
        #homepage-command-section {
          padding: 12px;
        }

        .ez-home-header {
          display: block;
        }

        .ez-home-actions {
          margin-top: 15px;
        }

        .ez-home-metrics {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-home-grid {
          grid-template-columns: 1fr;
        }

        .ez-home-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-home-settings,
        .ez-home-form {
          grid-template-columns: 1fr;
        }

        .ez-home-field.full {
          grid-column: auto;
        }

        .ez-home-hero-content h1 {
          font-size: 29px;
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
        "#homepage-command-section"
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
      "homepage-command-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function getMetrics() {
    const items =
      state.config.items;

    return {
      total:
        items.length,

      active:
        items.filter(
          (item) =>
            item.enabled
        ).length,

      featured:
        items.filter(
          (item) =>
            item.featured
        ).length,

      scheduled:
        items.filter(
          (item) =>
            item.status ===
            "scheduled"
        ).length,

      live:
        items.filter(
          (item) =>
            item.type ===
              "live" &&
            item.enabled
        ).length,

      breaking:
        items.filter(
          (item) =>
            item.type ===
              "breaking" &&
            item.enabled
        ).length,

      sections:
        state.config.sections.filter(
          (section) =>
            section.enabled
        ).length
    };
  }

  function renderMetric(
    label,
    value
  ) {
    return `
      <div
        class="ez-home-metric"
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

  function render() {
    const section =
      ensureSection();

    const m =
      getMetrics();

    section.innerHTML = `
      <div
        class="ez-home-shell"
      >

        <div
          class="ez-home-header"
        >

          <div>
            <h2>
              مركز التحكم بالواجهة الرئيسية
            </h2>

            <p>
              إدارة كل ما يظهر في واجهة EZ MEDIA
              من مركز واحد وبنية جاهزة للتخصيص الذكي.
            </p>
          </div>

          <div
            class="ez-home-actions"
          >

            <button
              class="
                ez-home-btn
                primary
              "
              data-home-action="new"
            >
              + إضافة عنصر
            </button>

            <button
              class="ez-home-btn"
              data-home-action="preview"
            >
              معاينة الواجهة
            </button>

            <button
              class="ez-home-btn"
              data-home-action="refresh"
            >
              تحديث
            </button>

          </div>

        </div>

        <div
          class="ez-home-metrics"
        >

          ${renderMetric(
            "إجمالي العناصر",
            m.total
          )}

          ${renderMetric(
            "العناصر النشطة",
            m.active
          )}

          ${renderMetric(
            "المميزة",
            m.featured
          )}

          ${renderMetric(
            "المجدولة",
            m.scheduled
          )}

          ${renderMetric(
            "قنوات البث",
            m.live
          )}

          ${renderMetric(
            "عاجل",
            m.breaking
          )}

          ${renderMetric(
            "الأقسام النشطة",
            m.sections
          )}

        </div>

        <div
          class="ez-home-tabs"
        >

          ${tab(
            "overview",
            "نظرة عامة"
          )}

          ${tab(
            "hero",
            "البطل الرئيسي"
          )}

          ${tab(
            "items",
            "عناصر الصفحة"
          )}

          ${tab(
            "sections",
            "الأقسام"
          )}

          ${tab(
            "settings",
            "الذكاء والتخصيص"
          )}

        </div>

        ${
          state.activeTab ===
          "overview"
            ? renderOverview()
            : state.activeTab ===
              "hero"
            ? renderHero()
            : state.activeTab ===
              "items"
            ? renderItems()
            : state.activeTab ===
              "sections"
            ? renderSections()
            : renderSettings()
        }

      </div>

      <div
        id="ez-homepage-modal"
        class="ez-home-modal"
        aria-hidden="true"
      ></div>
    `;

    bindEvents();
  }

  function tab(
    key,
    label
  ) {
    return `
      <button
        class="
          ez-home-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-home-tab="${escapeHtml(
          key
        )}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function renderOverview() {
    const hero =
      state.config.hero;

    const activeSections =
      state.config.sections
        .filter(
          (section) =>
            section.enabled
        )
        .sort(
          (a, b) =>
            a.order -
            b.order
        );

    return `
      <div
        class="ez-home-panel"
      >

        <h3>
          صورة الواجهة الحالية
        </h3>

        <div
          class="
            ez-home-hero-preview
          "
        >

          <div
            class="
              ez-home-hero-content
            "
          >

            <div
              class="
                ez-home-badges
              "
            >

              <span
                class="
                  ez-home-badge
                  success
                "
              >
                ${
                  hero.enabled
                    ? "البطل نشط"
                    : "البطل متوقف"
                }
              </span>

              ${
                hero.liveEnabled
                  ? `
                    <span
                      class="
                        ez-home-badge
                      "
                    >
                      بث مباشر
                    </span>
                  `
                  : ""
              }

              ${
                hero.breakingEnabled
                  ? `
                    <span
                      class="
                        ez-home-badge
                      "
                    >
                      عاجل
                    </span>
                  `
                  : ""
              }

            </div>

            <h1>
              ${escapeHtml(
                hero.title
              )}
            </h1>

            <p>
              ${escapeHtml(
                hero.subtitle
              )}
            </p>

            <button
              class="
                ez-home-btn
                primary
              "
              type="button"
            >
              ${escapeHtml(
                hero.buttonText
              )}
            </button>

          </div>

        </div>

        <h3
          style="
            margin-top:24px;
          "
        >
          ترتيب الأقسام
        </h3>

        ${
          activeSections
            .map(
              (item) => `
                <div
                  class="
                    ez-home-section-row
                  "
                >

                  <span
                    class="ez-home-drag"
                  >
                    ☷
                  </span>

                  <div
                    class="
                      ez-home-section-main
                    "
                  >

                    <strong>
                      ${escapeHtml(
                        item.title
                      )}
                    </strong>

                    <span>
                      ${escapeHtml(
                        item.type
                      )}
                    </span>

                  </div>

                  <strong>
                    #${item.order}
                  </strong>

                </div>
              `
            )
            .join("") ||
          `
            <div
              style="
                padding:30px;
                text-align:center;
                color:#718997;
              "
            >
              لا توجد أقسام نشطة.
            </div>
          `
        }

      </div>
    `;
  }

  function renderHero() {
    const hero =
      state.config.hero;

    return `
      <div
        class="ez-home-panel"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            margin-bottom:18px;
          "
        >

          <div>
            <h3
              style="margin:0 0 5px"
            >
              البطل الرئيسي
            </h3>

            <span
              style="
                color:#718997;
                font-size:12px;
              "
            >
              العنصر الأبرز في الواجهة.
            </span>
          </div>

          <button
            class="
              ez-home-btn
              primary
            "
            data-home-action="edit-hero"
          >
            تعديل البطل
          </button>

        </div>

        <div
          class="
            ez-home-hero-preview
          "
        >

          <div
            class="
              ez-home-hero-content
            "
          >

            <div
              class="
                ez-home-badges
              "
            >

              <span
                class="
                  ez-home-badge
                  ${
                    hero.enabled
                      ? "success"
                      : "danger"
                  }
                "
              >
                ${
                  hero.enabled
                    ? "نشط"
                    : "متوقف"
                }
              </span>

            </div>

            <h1>
              ${escapeHtml(
                hero.title
              )}
            </h1>

            <p>
              ${escapeHtml(
                hero.subtitle
              )}
            </p>

            <p>
              ${escapeHtml(
                hero.description
              )}
            </p>

          </div>

        </div>

        <div
          class="ez-home-info"
          style="margin-top:18px"
        >

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              البث
            </span>

            <strong>
              ${
                hero.liveEnabled
                  ? "مفعّل"
                  : "متوقف"
              }
            </strong>
          </div>

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              عاجل
            </span>

            <strong>
              ${
                hero.breakingEnabled
                  ? "مفعّل"
                  : "متوقف"
              }
            </strong>
          </div>

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              المحتوى
            </span>

            <strong>
              ${
                hero.contentId
                  ? "مرتبط"
                  : "تلقائي"
              }
            </strong>
          </div>

        </div>

      </div>
    `;
  }

  function renderItems() {
    const items =
      filteredItems();

    return `
      <div
        class="ez-home-toolbar"
      >

        <input
          id="ez-home-search"
          class="ez-home-input"
          placeholder="ابحث في عناصر الواجهة..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-home-type"
          class="ez-home-select"
        >

          <option value="all">
            كل الأنواع
          </option>

          ${Object.entries(
            ITEM_TYPES
          )
            .map(
              ([key, label]) => `
                <option
                  value="${escapeHtml(
                    key
                  )}"
                  ${
                    state.type ===
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

        <select
          id="ez-home-status"
          class="ez-home-select"
        >

          <option value="all">
            كل الحالات
          </option>

          ${Object.entries(
            ITEM_STATUS
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
          class="ez-home-btn"
          data-home-action="clear"
        >
          مسح
        </button>

      </div>

      <div
        class="ez-home-grid"
      >

        ${
          items.length
            ? items
                .map(
                  renderItemCard
                )
                .join("")
            : `
              <div
                class="
                  ez-home-panel
                "
                style="
                  grid-column:1/-1;
                  text-align:center;
                  padding:50px;
                "
              >
                لا توجد عناصر.
              </div>
            `
        }

      </div>
    `;
  }

  function filteredItems() {
    const query =
      state.search
        .trim()
        .toLowerCase();

    return state.config.items
      .filter(
        (item) => {
          if (
            state.type !==
              "all" &&
            item.type !==
              state.type
          ) {
            return false;
          }

          if (
            state.status !==
              "all" &&
            item.status !==
              state.status
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            item.title,
            item.subtitle,
            item.description,
            item.type,
            item.status
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      )
      .sort(
        (a, b) =>
          a.order -
          b.order
      );
  }

  function renderItemCard(
    item
  ) {
    const statusClass =
      item.status ===
      "active"
        ? "success"
        : item.status ===
          "expired"
        ? "danger"
        : "warning";

    return `
      <article
        class="ez-home-card"
      >

        ${
          item.image
            ? `
              <img
                class="
                  ez-home-card-image
                "
                src="${escapeHtml(
                  item.image
                )}"
                alt="${escapeHtml(
                  item.title
                )}"
                loading="lazy"
              />
            `
            : `
              <div
                class="
                  ez-home-placeholder
                "
              >
                ${escapeHtml(
                  ITEM_TYPES[
                    item.type
                  ] ||
                    "EZ MEDIA"
                )}
              </div>
            `
        }

        <div
          class="ez-home-card-top"
        >

          <div>
            <h3>
              ${escapeHtml(
                item.title
              )}
            </h3>

            <div
              class="
                ez-home-badges
              "
            >

              <span
                class="
                  ez-home-badge
                "
              >
                ${escapeHtml(
                  ITEM_TYPES[
                    item.type
                  ] ||
                    item.type
                )}
              </span>

              <span
                class="
                  ez-home-badge
                  ${statusClass}
                "
              >
                ${escapeHtml(
                  ITEM_STATUS[
                    item.status
                  ] ||
                    item.status
                )}
              </span>

              ${
                item.featured
                  ? `
                    <span
                      class="
                        ez-home-badge
                        success
                      "
                    >
                      مميز
                    </span>
                  `
                  : ""
              }

            </div>
          </div>

        </div>

        <p
          style="
            color:#718997;
            line-height:1.8;
            font-size:12px;
          "
        >
          ${escapeHtml(
            item.subtitle ||
              item.description
          )}
        </p>

        <div
          class="ez-home-info"
        >

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              الترتيب
            </span>

            <strong>
              #${item.order}
            </strong>
          </div>

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              الظهور
            </span>

            <strong>
              ${
                item.enabled
                  ? "نشط"
                  : "متوقف"
              }
            </strong>
          </div>

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              الأولوية
            </span>

            <strong>
              ${escapeHtml(
                item.priority
              )}
            </strong>
          </div>

        </div>

        <div
          class="
            ez-home-card-actions
          "
        >

          <button
            class="
              ez-home-small
            "
            data-home-action="edit-item"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            تعديل
          </button>

          <button
            class="
              ez-home-small
            "
            data-home-action="toggle-item"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            ${
              item.enabled
                ? "إيقاف"
                : "تفعيل"
            }
          </button>

          <button
            class="
              ez-home-small
            "
            data-home-action="feature-item"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            ${
              item.featured
                ? "إلغاء التمييز"
                : "تمييز"
            }
          </button>

          <button
            class="
              ez-home-small
              danger
            "
            data-home-action="delete-item"
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

  function renderSections() {
    const sections =
      [...state.config.sections]
        .sort(
          (a, b) =>
            a.order -
            b.order
        );

    return `
      <div
        class="ez-home-panel"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            margin-bottom:15px;
          "
        >

          <div>
            <h3
              style="margin:0 0 5px"
            >
              أقسام الصفحة الرئيسية
            </h3>

            <span
              style="
                color:#718997;
                font-size:12px;
              "
            >
              ترتيب الأقسام التي تظهر للزائر.
            </span>
          </div>

          <button
            class="
              ez-home-btn
              primary
            "
            data-home-action="new-section"
          >
            + قسم جديد
          </button>

        </div>

        ${
          sections
            .map(
              renderSectionRow
            )
            .join("") ||
          `
            <div
              style="
                text-align:center;
                padding:40px;
                color:#718997;
              "
            >
              لا توجد أقسام.
            </div>
          `
        }

      </div>
    `;
  }

  function renderSectionRow(
    section
  ) {
    return `
      <div
        class="
          ez-home-section-row
        "
        draggable="true"
        data-section-id="${escapeHtml(
          section.id
        )}"
      >

        <span
          class="ez-home-drag"
        >
          ☷
        </span>

        <div
          class="
            ez-home-section-main
          "
        >

          <strong>
            ${escapeHtml(
              section.title
            )}
          </strong>

          <span>
            النوع:
            ${escapeHtml(
              section.type
            )}
            · الترتيب:
            #${section.order}
          </span>

        </div>

        <button
          class="
            ez-home-toggle
            ${
              section.enabled
                ? "on"
                : ""
            }
          "
          data-home-action="toggle-section"
          data-id="${escapeHtml(
            section.id
          )}"
          aria-label="تفعيل القسم"
        ></button>

        <button
          class="
            ez-home-small
          "
          data-home-action="edit-section"
          data-id="${escapeHtml(
            section.id
          )}"
        >
          تعديل
        </button>

        <button
          class="
            ez-home-small
            danger
          "
          data-home-action="delete-section"
          data-id="${escapeHtml(
            section.id
          )}"
        >
          حذف
        </button>

      </div>
    `;
  }

  function renderSettings() {
    return `
      <div
        class="ez-home-panel"
      >

        <h3>
          الذكاء والتخصيص
        </h3>

        <p
          style="
            color:#718997;
            line-height:1.9;
          "
        >
          إعدادات التحكم في طريقة ترتيب الواجهة
          وتخصيصها مستقبلًا بواسطة محرك الذكاء
          الاصطناعي المركزي.
        </p>

        <div
          class="ez-home-settings"
        >

          ${setting(
            "ترتيب ذكي للمحتوى",
            "smartOrdering"
          )}

          ${setting(
            "تخصيص الواجهة بالذكاء الاصطناعي",
            "aiPersonalization"
          )}

          ${setting(
            "إظهار البث أولًا",
            "showLiveFirst"
          )}

          ${setting(
            "إظهار عاجل أولًا",
            "showBreakingFirst"
          )}

          ${setting(
            "إظهار المحتوى المدعوم",
            "showSponsoredContent"
          )}

          ${setting(
            "التحديث التلقائي",
            "autoRefresh"
          )}

        </div>

        <div
          class="ez-home-info"
          style="margin-top:16px"
        >

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              أقصى أخبار مميزة
            </span>

            <strong>
              ${state.settings.maxFeatured}
            </strong>
          </div>

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              أقصى عاجل
            </span>

            <strong>
              ${state.settings.maxBreaking}
            </strong>
          </div>

          <div
            class="
              ez-home-info-item
            "
          >
            <span>
              أقصى بث
            </span>

            <strong>
              ${state.settings.maxLive}
            </strong>
          </div>

        </div>

        <div
          style="
            margin-top:18px;
            padding:16px;
            border-radius:15px;
            background:#effbff;
            color:#286d82;
            line-height:1.9;
          "
        >
          <strong>
            طبقة الذكاء:
          </strong>

          يمكن لاحقًا جعل النظام يغيّر ترتيب
          الواجهة تلقائيًا حسب الأخبار العاجلة،
          البث المباشر، اهتمامات الجمهور،
          أداء المحتوى، والرعايات النشطة،
          مع بقاء القرار التحريري للمحتوى الحساس
          ضمن الصلاحيات المحددة.
        </div>

      </div>
    `;
  }

  function setting(
    label,
    key
  ) {
    return `
      <label
        class="
          ez-home-check
        "
      >

        <input
          type="checkbox"
          data-home-setting="${escapeHtml(
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

  function openModal(
    title,
    body,
    footer = ""
  ) {
    const modal =
      document.querySelector(
        "#ez-homepage-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div
        class="ez-home-dialog"
      >

        <div
          class="
            ez-home-dialog-head
          "
        >

          <strong>
            ${escapeHtml(
              title
            )}
          </strong>

          <button
            class="ez-home-btn"
            data-home-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="
            ez-home-dialog-body
          "
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-home-dialog-footer
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
        "#ez-homepage-modal"
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

  function openItemForm(
    existing = null
  ) {
    const item =
      normalizeItem(
        existing || {}
      );

    const isEdit =
      Boolean(existing);

    openModal(
      isEdit
        ? "تعديل عنصر الواجهة"
        : "إضافة عنصر للواجهة",
      `
        <form
          id="ez-home-item-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              item.id
            )}"
          />

          <div
            class="ez-home-form"
          >

            <div
              class="ez-home-field"
            >
              <label>
                العنوان
              </label>

              <input
                class="ez-home-input"
                name="title"
                required
                value="${escapeHtml(
                  item.title
                )}"
              />
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                النوع
              </label>

              <select
                class="ez-home-select"
                name="type"
              >

                ${Object.entries(
                  ITEM_TYPES
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
              class="
                ez-home-field
                full
              "
            >
              <label>
                الوصف المختصر
              </label>

              <textarea
                class="ez-home-textarea"
                name="subtitle"
              >${escapeHtml(
                item.subtitle
              )}</textarea>
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                الحالة
              </label>

              <select
                class="ez-home-select"
                name="status"
              >

                ${Object.entries(
                  ITEM_STATUS
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                        ${
                          item.status ===
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
              class="ez-home-field"
            >
              <label>
                الترتيب
              </label>

              <input
                class="ez-home-input"
                type="number"
                name="order"
                value="${escapeHtml(
                  item.order
                )}"
              />
            </div>

            <div
              class="
                ez-home-field
                full
              "
            >
              <label>
                الصورة
              </label>

              <input
                class="ez-home-input"
                name="image"
                dir="ltr"
                value="${escapeHtml(
                  item.image
                )}"
                placeholder="رابط الصورة بعد ربط التخزين"
              />
            </div>

            <div
              class="
                ez-home-field
                full
              "
            >
              <label>
                الرابط
              </label>

              <input
                class="ez-home-input"
                name="url"
                dir="ltr"
                value="${escapeHtml(
                  item.url
                )}"
              />
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                معرف المحتوى
              </label>

              <input
                class="ez-home-input"
                name="contentId"
                dir="ltr"
                value="${escapeHtml(
                  item.contentId
                )}"
              />
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                الأولوية
              </label>

              <select
                class="ez-home-select"
                name="priority"
              >

                ${[
                  "low",
                  "normal",
                  "high",
                  "urgent",
                  "critical"
                ]
                  .map(
                    (key) => `
                      <option
                        value="${key}"
                        ${
                          item.priority ===
                          key
                            ? "selected"
                            : ""
                        }
                      >
                        ${key}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </div>

            <div
              class="
                ez-home-field
                full
              "
            >

              <div
                class="
                  ez-home-settings
                "
              >

                <label
                  class="
                    ez-home-check
                  "
                >

                  <input
                    type="checkbox"
                    name="enabled"
                    ${
                      item.enabled
                        ? "checked"
                        : ""
                    }
                  />

                  ظهور العنصر
                </label>

                <label
                  class="
                    ez-home-check
                  "
                >

                  <input
                    type="checkbox"
                    name="featured"
                    ${
                      item.featured
                        ? "checked"
                        : ""
                    }
                  />

                  عنصر مميز
                </label>

              </div>

            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-home-btn"
          data-home-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-home-btn
            primary
          "
          data-home-action="save-item"
        >
          ${
            isEdit
              ? "حفظ التعديل"
              : "إضافة العنصر"
          }
        </button>
      `
    );
  }

  function saveItem() {
    const form =
      document.querySelector(
        "#ez-home-item-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const item =
      normalizeItem({
        id:
          data.get("id"),

        title:
          String(
            data.get("title") ||
              ""
          ).trim(),

        type:
          data.get("type") ||
          "news",

        subtitle:
          String(
            data.get(
              "subtitle"
            ) || ""
          ).trim(),

        status:
          data.get("status") ||
          "draft",

        order:
          Number(
            data.get("order") ||
              999
          ),

        image:
          String(
            data.get("image") ||
              ""
          ).trim(),

        url:
          String(
            data.get("url") ||
              "#"
          ).trim(),

        contentId:
          String(
            data.get(
              "contentId"
            ) || ""
          ).trim(),

        priority:
          data.get(
            "priority"
          ) ||
          "normal",

        enabled:
          data.has("enabled"),

        featured:
          data.has("featured")
      });

    if (!item.title) {
      notify(
        "عنوان العنصر مطلوب.",
        "warning"
      );

      return;
    }

    const index =
      state.config.items.findIndex(
        (current) =>
          String(
            current.id
          ) ===
          String(item.id)
      );

    if (index >= 0) {
      state.config.items[
        index
      ] = {
        ...state.config.items[
          index
        ],
        ...item,
        updatedAt:
          new Date().toISOString()
      };
    } else {
      state.config.items.push(
        item
      );
    }

    save();

    closeModal();

    render();

    notify(
      index >= 0
        ? "تم تحديث عنصر الواجهة."
        : "تمت إضافة عنصر الواجهة.",
      "success"
    );
  }

  function toggleItem(id) {
    const item =
      state.config.items.find(
        (current) =>
          String(
            current.id
          ) === String(id)
      );

    if (!item) {
      return;
    }

    item.enabled =
      !item.enabled;

    item.updatedAt =
      new Date().toISOString();

    save();

    render();

    notify(
      item.enabled
        ? "تم تفعيل العنصر."
        : "تم إيقاف العنصر.",
      "success"
    );
  }

  function featureItem(id) {
    const item =
      state.config.items.find(
        (current) =>
          String(
            current.id
          ) === String(id)
      );

    if (!item) {
      return;
    }

    item.featured =
      !item.featured;

    item.updatedAt =
      new Date().toISOString();

    save();

    render();

    notify(
      item.featured
        ? "تم تمييز العنصر."
        : "تم إلغاء تمييز العنصر.",
      "success"
    );
  }

  function deleteItem(id) {
    if (
      !window.confirm(
        "هل تريد حذف عنصر الواجهة؟"
      )
    ) {
      return;
    }

    state.config.items =
      state.config.items.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );

    save();

    render();

    notify(
      "تم حذف العنصر.",
      "success"
    );
  }

  function openHeroForm() {
    const hero =
      state.config.hero;

    openModal(
      "إدارة البطل الرئيسي",
      `
        <form
          id="ez-home-hero-form"
        >

          <div
            class="ez-home-form"
          >

            <div
              class="ez-home-field"
            >
              <label>
                العنوان
              </label>

              <input
                class="ez-home-input"
                name="title"
                required
                value="${escapeHtml(
                  hero.title
                )}"
              />
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                نص الزر
              </label>

              <input
                class="ez-home-input"
                name="buttonText"
                value="${escapeHtml(
                  hero.buttonText
                )}"
              />
            </div>

            <div
              class="
                ez-home-field
                full
              "
            >
              <label>
                العنوان الفرعي
              </label>

              <textarea
                class="ez-home-textarea"
                name="subtitle"
              >${escapeHtml(
                hero.subtitle
              )}</textarea>
            </div>

            <div
              class="
                ez-home-field
                full
              "
            >
              <label>
                الوصف
              </label>

              <textarea
                class="ez-home-textarea"
                name="description"
              >${escapeHtml(
                hero.description
              )}</textarea>
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                رابط الزر
              </label>

              <input
                class="ez-home-input"
                name="buttonUrl"
                dir="ltr"
                value="${escapeHtml(
                  hero.buttonUrl
                )}"
              />
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                معرف المحتوى
              </label>

              <input
                class="ez-home-input"
                name="contentId"
                dir="ltr"
                value="${escapeHtml(
                  hero.contentId
                )}"
              />
            </div>

            <div
              class="
                ez-home-field
                full
              "
            >
              <label>
                صورة البطل
              </label>

              <input
                class="ez-home-input"
                name="image"
                dir="ltr"
                value="${escapeHtml(
                  hero.image
                )}"
              />
            </div>

            <div
              class="
                ez-home-field
                full
              "
            >

              <div
                class="
                  ez-home-settings
                "
              >

                <label
                  class="
                    ez-home-check
                  "
                >
                  <input
                    type="checkbox"
                    name="enabled"
                    ${
                      hero.enabled
                        ? "checked"
                        : ""
                    }
                  />
                  تفعيل البطل
                </label>

                <label
                  class="
                    ez-home-check
                  "
                >
                  <input
                    type="checkbox"
                    name="liveEnabled"
                    ${
                      hero.liveEnabled
                        ? "checked"
                        : ""
                    }
                  />
                  إظهار البث المباشر
                </label>

                <label
                  class="
                    ez-home-check
                  "
                >
                  <input
                    type="checkbox"
                    name="breakingEnabled"
                    ${
                      hero.breakingEnabled
                        ? "checked"
                        : ""
                    }
                  />
                  إظهار عاجل
                </label>

              </div>

            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-home-btn"
          data-home-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-home-btn
            primary
          "
          data-home-action="save-hero"
        >
          حفظ البطل
        </button>
      `
    );
  }

  function saveHero() {
    const form =
      document.querySelector(
        "#ez-home-hero-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    state.config.hero = {
      ...state.config.hero,

      title:
        String(
          data.get("title") ||
            ""
        ).trim(),

      subtitle:
        String(
          data.get(
            "subtitle"
          ) || ""
        ).trim(),

      description:
        String(
          data.get(
            "description"
          ) || ""
        ).trim(),

      buttonText:
        String(
          data.get(
            "buttonText"
          ) || ""
        ).trim(),

      buttonUrl:
        String(
          data.get(
            "buttonUrl"
          ) || "#"
        ).trim(),

      contentId:
        String(
          data.get(
            "contentId"
          ) || ""
        ).trim(),

      image:
        String(
          data.get("image") ||
            ""
        ).trim(),

      enabled:
        data.has("enabled"),

      liveEnabled:
        data.has(
          "liveEnabled"
        ),

      breakingEnabled:
        data.has(
          "breakingEnabled"
        )
    };

    save();

    closeModal();

    render();

    notify(
      "تم تحديث البطل الرئيسي.",
      "success"
    );
  }

  function openSectionForm(
    existing = null
  ) {
    const item =
      existing || {
        id:
          createId(
            "section"
          ),

        title:
          "قسم جديد",

        type:
          "news",

        enabled:
          true,

        order:
          state.config.sections
            .length + 1
      };

    openModal(
      existing
        ? "تعديل القسم"
        : "إضافة قسم",
      `
        <form
          id="ez-home-section-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              item.id
            )}"
          />

          <div
            class="ez-home-form"
          >

            <div
              class="ez-home-field"
            >
              <label>
                اسم القسم
              </label>

              <input
                class="ez-home-input"
                name="title"
                required
                value="${escapeHtml(
                  item.title
                )}"
              />
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                نوع القسم
              </label>

              <select
                class="ez-home-select"
                name="type"
              >

                <option
                  value="breaking"
                  ${
                    item.type ===
                    "breaking"
                      ? "selected"
                      : ""
                  }
                >
                  عاجل
                </option>

                <option
                  value="live"
                  ${
                    item.type ===
                    "live"
                      ? "selected"
                      : ""
                  }
                >
                  بث مباشر
                </option>

                <option
                  value="news"
                  ${
                    item.type ===
                    "news"
                      ? "selected"
                      : ""
                  }
                >
                  أخبار
                </option>

                <option
                  value="reports"
                  ${
                    item.type ===
                    "reports"
                      ? "selected"
                      : ""
                  }
                >
                  تقارير
                </option>

                <option
                  value="video"
                  ${
                    item.type ===
                    "video"
                      ? "selected"
                      : ""
                  }
                >
                  فيديو
                </option>

                <option
                  value="sponsors"
                  ${
                    item.type ===
                    "sponsors"
                      ? "selected"
                      : ""
                  }
                >
                  رعايات
                </option>

                <option
                  value="custom"
                  ${
                    item.type ===
                    "custom"
                      ? "selected"
                      : ""
                  }
                >
                  مخصص
                </option>

              </select>
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                الترتيب
              </label>

              <input
                class="ez-home-input"
                type="number"
                name="order"
                value="${escapeHtml(
                  item.order
                )}"
              />
            </div>

            <div
              class="ez-home-field"
            >
              <label>
                الحالة
              </label>

              <select
                class="ez-home-select"
                name="enabled"
              >

                <option
                  value="true"
                  ${
                    item.enabled
                      ? "selected"
                      : ""
                  }
                >
                  نشط
                </option>

                <option
                  value="false"
                  ${
                    !item.enabled
                      ? "selected"
                      : ""
                  }
                >
                  متوقف
                </option>

              </select>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-home-btn"
          data-home-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-home-btn
            primary
          "
          data-home-action="save-section"
        >
          حفظ القسم
        </button>
      `
    );
  }

  function saveSection() {
    const form =
      document.querySelector(
        "#ez-home-section-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const section = {
      id:
        String(
          data.get("id")
        ),

      title:
        String(
          data.get("title") ||
            ""
        ).trim(),

      type:
        data.get("type") ||
        "news",

      order:
        Number(
          data.get("order") ||
            999
        ),

      enabled:
        data.get(
          "enabled"
        ) === "true"
    };

    if (!section.title) {
      notify(
        "اسم القسم مطلوب.",
        "warning"
      );

      return;
    }

    const index =
      state.config.sections.findIndex(
        (current) =>
          String(
            current.id
          ) ===
          String(
            section.id
          )
      );

    if (index >= 0) {
      state.config.sections[
        index
      ] = section;
    } else {
      state.config.sections.push(
        section
      );
    }

    save();

    closeModal();

    render();

    notify(
      index >= 0
        ? "تم تحديث القسم."
        : "تمت إضافة القسم.",
      "success"
    );
  }

  function toggleSection(id) {
    const section =
      state.config.sections.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!section) {
      return;
    }

    section.enabled =
      !section.enabled;

    save();

    render();

    notify(
      section.enabled
        ? "تم تفعيل القسم."
        : "تم إيقاف القسم.",
      "success"
    );
  }

  function deleteSection(id) {
    if (
      !window.confirm(
        "هل تريد حذف هذا القسم؟"
      )
    ) {
      return;
    }

    state.config.sections =
      state.config.sections.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );

    normalizeSectionOrders();

    save();

    render();

    notify(
      "تم حذف القسم.",
      "success"
    );
  }

  function normalizeSectionOrders() {
    state.config.sections
      .sort(
        (a, b) =>
          a.order -
          b.order
      )
      .forEach(
        (item, index) => {
          item.order =
            index + 1;
        }
      );
  }

  function reorderSections(
    draggedId,
    targetId
  ) {
    if (
      draggedId ===
      targetId
    ) {
      return;
    }

    const list =
      state.config.sections;

    const from =
      list.findIndex(
        (item) =>
          String(item.id) ===
          String(draggedId)
      );

    const to =
      list.findIndex(
        (item) =>
          String(item.id) ===
          String(targetId)
      );

    if (
      from < 0 ||
      to < 0
    ) {
      return;
    }

    const [
      moved
    ] =
      list.splice(
        from,
        1
      );

    list.splice(
      to,
      0,
      moved
    );

    list.forEach(
      (item, index) => {
        item.order =
          index + 1;
      }
    );

    save();

    render();

    notify(
      "تم تحديث ترتيب الأقسام.",
      "success"
    );
  }

  function saveSetting(
    key,
    value
  ) {
    state.settings[key] =
      value;

    save();

    notify(
      "تم تحديث إعداد الواجهة.",
      "success"
    );
  }

  function preview() {
    const hero =
      state.config.hero;

    const activeItems =
      state.config.items
        .filter(
          (item) =>
            item.enabled
        )
        .sort(
          (a, b) =>
            a.order -
            b.order
        )
        .slice(0, 8);

    openModal(
      "معاينة الواجهة الرئيسية",
      `
        <div
          class="
            ez-home-hero-preview
          "
        >

          <div
            class="
              ez-home-hero-content
            "
          >

            <h1>
              ${escapeHtml(
                hero.title
              )}
            </h1>

            <p>
              ${escapeHtml(
                hero.subtitle
              )}
            </p>

            <button
              class="
                ez-home-btn
                primary
              "
            >
              ${escapeHtml(
                hero.buttonText
              )}
            </button>

          </div>

        </div>

        <div
          style="
            margin-top:18px;
          "
        >

          ${
            activeItems
              .map(
                (item) => `
                  <div
                    class="
                      ez-home-section-row
                    "
                  >

                    <div
                      class="
                        ez-home-section-main
                      "
                    >

                      <strong>
                        ${escapeHtml(
                          item.title
                        )}
                      </strong>

                      <span>
                        ${escapeHtml(
                          ITEM_TYPES[
                            item.type
                          ] ||
                            item.type
                        )}
                      </span>

                    </div>

                  </div>
                `
              )
              .join("") ||
            `
              <div
                style="
                  padding:30px;
                  text-align:center;
                  color:#718997;
                "
              >
                لا توجد عناصر نشطة.
              </div>
            `
          }

        </div>
      `,
      `
        <button
          class="ez-home-btn"
          data-home-action="close"
        >
          إغلاق المعاينة
        </button>
      `
    );
  }

  function clearFilters() {
    state.search = "";
    state.type =
      "all";
    state.status =
      "all";

    render();
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#homepage-command-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-home-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .homeTab;

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-home-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .homeAction;

              const id =
                button.dataset.id;

              if (
                action ===
                "new"
              ) {
                openItemForm();
                return;
              }

              if (
                action ===
                "preview"
              ) {
                preview();
                return;
              }

              if (
                action ===
                "refresh"
              ) {
                load();
                render();

                notify(
                  "تم تحديث مركز الواجهة.",
                  "success"
                );

                return;
              }

              if (
                action ===
                "edit-hero"
              ) {
                openHeroForm();
                return;
              }

              if (
                action ===
                "edit-item"
              ) {
                const item =
                  state.config.items.find(
                    (current) =>
                      String(
                        current.id
                      ) ===
                      String(id)
                  );

                if (item) {
                  openItemForm(
                    item
                  );
                }

                return;
              }

              if (
                action ===
                "toggle-item"
              ) {
                toggleItem(id);
                return;
              }

              if (
                action ===
                "feature-item"
              ) {
                featureItem(id);
                return;
              }

              if (
                action ===
                "delete-item"
              ) {
                deleteItem(id);
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
                "new-section"
              ) {
                openSectionForm();
                return;
              }

              if (
                action ===
                "edit-section"
              ) {
                const item =
                  state.config.sections.find(
                    (current) =>
                      String(
                        current.id
                      ) ===
                      String(id)
                  );

                if (item) {
                  openSectionForm(
                    item
                  );
                }

                return;
              }

              if (
                action ===
                "toggle-section"
              ) {
                toggleSection(id);
                return;
              }

              if (
                action ===
                "delete-section"
              ) {
                deleteSection(id);
                return;
              }

              if (
                action ===
                "save-item"
              ) {
                saveItem();
                return;
              }

              if (
                action ===
                "save-hero"
              ) {
                saveHero();
                return;
              }

              if (
                action ===
                "save-section"
              ) {
                saveSection();
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
        "#ez-home-search"
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

    const type =
      section.querySelector(
        "#ez-home-type"
      );

    if (type) {
      type.addEventListener(
        "change",
        (event) => {
          state.type =
            event.target.value;

          render();
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-home-status"
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
        "[data-home-setting]"
      )
      .forEach(
        (input) => {
          input.addEventListener(
            "change",
            (event) => {
              saveSetting(
                input.dataset
                  .homeSetting,
                event.target
                  .checked
              );
            }
          );
        }
      );

    const modal =
      document.querySelector(
        "#ez-homepage-modal"
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

    let draggedId =
      null;

    section
      .querySelectorAll(
        "[data-section-id]"
      )
      .forEach(
        (row) => {
          row.addEventListener(
            "dragstart",
            () => {
              draggedId =
                row.dataset
                  .sectionId;

              row.classList.add(
                "dragging"
              );
            }
          );

          row.addEventListener(
            "dragend",
            () => {
              row.classList.remove(
                "dragging"
              );
            }
          );

          row.addEventListener(
            "dragover",
            (event) => {
              event.preventDefault();
            }
          );

          row.addEventListener(
            "drop",
            (event) => {
              event.preventDefault();

              reorderSections(
                draggedId,
                row.dataset
                  .sectionId
              );

              draggedId =
                null;
            }
          );
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
        "#homepage-command-section"
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

  function getConfig() {
    return clone(
      state.config
    );
  }

  function getSettings() {
    return clone(
      state.settings
    );
  }

  function updateHero(
    values = {}
  ) {
    state.config.hero = {
      ...state.config.hero,
      ...values
    };

    save();

    render();

    return clone(
      state.config.hero
    );
  }

  function addItem(
    values = {}
  ) {
    const item =
      normalizeItem(
        values
      );

    state.config.items.push(
      item
    );

    save();

    render();

    return clone(item);
  }

  function addSection(
    values = {}
  ) {
    const section = {
      id:
        values.id ||
        createId(
          "section"
        ),

      title:
        values.title ||
        "قسم جديد",

      type:
        values.type ||
        "news",

      enabled:
        values.enabled !==
        false,

      order:
        Number(
          values.order ||
            state.config.sections
              .length + 1
        )
    };

    state.config.sections.push(
      section
    );

    normalizeSectionOrders();

    save();

    render();

    return clone(section);
  }

  window.EZMediaAdminHomepageCommand =
    {
      module: MODULE,

      show,
      hide,
      refresh,

      getConfig,
      getSettings,

      updateHero,
      addItem,
      addSection
    };

  window.addEventListener(
    "ezmedia:homepage:refresh",
    () => {
      refresh();
    }
  );

  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const target =
        event.detail?.section ||
        event.detail?.target;

      if (
        target ===
          "homepage-command" ||
        target ===
          "homepage" ||
        target ===
          "home"
      ) {
        show();
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
    "EZ MEDIA 11.0 — Homepage Command loaded."
  );
})();
