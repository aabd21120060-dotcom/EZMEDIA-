"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 29
 * الملف: public/admin-trend-radar.js
 *
 * محرك مراقبة الأخبار والاتجاهات
 *
 * الوظائف:
 * - رادار الموضوعات
 * - قياس الزخم
 * - ترتيب الأولوية
 * - اكتشاف الموضوعات الصاعدة
 * - متابعة الموضوعات الحرجة
 * - ربط الموضوع بغرفة الأخبار
 * - ربط الموضوع بالذكاء الاصطناعي
 * - تحويل الإشارة إلى مسودة محتوى
 * - تحويل الإشارة إلى خبر عاجل
 * - إدارة مصادر الإشارة
 *
 * لا ينفذ جلبًا خارجيًا مباشرًا.
 * الجلب الخارجي الحقيقي يكون عبر Backend Connectors.
 */

(function () {
  "use strict";

  const MODULE = "trend-radar";

  const STORAGE_KEY =
    "ezmedia_trend_radar_v1";

  const REFRESH_EVENT =
    "ezmedia:trend-radar:refresh";

  const PRIORITIES = {
    low: "منخفضة",
    normal: "عادية",
    high: "مرتفعة",
    critical: "حرجة"
  };

  const LEVELS = {
    emerging: "صاعد",
    rising: "متنامٍ",
    hot: "ساخن",
    critical: "حرج",
    stable: "مستقر",
    declining: "متراجع"
  };

  const CATEGORIES = {
    local: "محلي",
    national: "وطني",
    regional: "إقليمي",
    international: "دولي",
    economy: "اقتصاد",
    sports: "رياضة",
    technology: "تقنية",
    culture: "ثقافة",
    society: "مجتمع",
    environment: "بيئة",
    politics: "سياسة",
    media: "إعلام",
    other: "أخرى"
  };

  const state = {
    trends: [],
    selected: null,
    search: "",
    category: "all",
    level: "all",
    priority: "all",
    sort: "momentum",
    loading: false
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return new Intl.NumberFormat(
      "ar-SA"
    ).format(number);
  }

  function formatDate(value) {
    if (!value) {
      return "غير محدد";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "غير محدد";
    }

    return date.toLocaleString(
      "ar-SA",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );
  }

  function createId() {
    if (
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
    ) {
      return crypto.randomUUID();
    }

    return (
      "trend-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }

  function normalizeTrend(
    trend
  ) {
    return {
      id:
        trend.id ||
        createId(),

      title:
        trend.title ||
        "موضوع بدون عنوان",

      description:
        trend.description ||
        "",

      category:
        trend.category ||
        "other",

      level:
        trend.level ||
        "emerging",

      priority:
        trend.priority ||
        "normal",

      momentum:
        Number(
          trend.momentum || 0
        ),

      mentions:
        Number(
          trend.mentions || 0
        ),

      growth:
        Number(
          trend.growth || 0
        ),

      sources:
        Number(
          trend.sources || 0
        ),

      confidence:
        Number(
          trend.confidence || 0
        ),

      keywords:
        Array.isArray(
          trend.keywords
        )
          ? trend.keywords
          : [],

      sourceNames:
        Array.isArray(
          trend.sourceNames
        )
          ? trend.sourceNames
          : [],

      firstSeen:
        trend.firstSeen ||
        new Date().toISOString(),

      lastSeen:
        trend.lastSeen ||
        new Date().toISOString(),

      aiReady:
        trend.aiReady !== false,

      breakingReady:
        Boolean(
          trend.breakingReady
        ),

      newsroomReady:
        trend.newsroomReady !== false,

      status:
        trend.status ||
        "active",

      createdAt:
        trend.createdAt ||
        new Date().toISOString(),

      updatedAt:
        trend.updatedAt ||
        new Date().toISOString()
    };
  }

  function load() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        state.trends = [];
        return;
      }

      const parsed =
        JSON.parse(raw);

      state.trends =
        Array.isArray(parsed)
          ? parsed.map(
              normalizeTrend
            )
          : [];
    } catch (error) {
      console.warn(
        "EZ MEDIA Trend Radar:",
        error
      );

      state.trends = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state.trends
        )
      );
    } catch (error) {
      console.warn(
        "EZ MEDIA Trend Radar save:",
        error
      );
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
              "رادار الاتجاهات",
            message
          }
        }
      )
    );

    const toast =
      document.querySelector(
        "#ez-trend-radar-toast"
      );

    if (!toast) {
      return;
    }

    toast.textContent =
      message;

    toast.dataset.type =
      type;

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
      }, 3200);
  }

  function ensureSection() {
    let section =
      document.querySelector(
        "#trend-radar-section"
      );

    if (section) {
      return section;
    }

    const parent =
      document.querySelector(
        "main"
      ) ||
      document.querySelector(
        "#admin-main"
      ) ||
      document.body;

    section =
      document.createElement(
        "section"
      );

    section.id =
      "trend-radar-section";

    section.hidden = true;

    parent.appendChild(
      section
    );

    return section;
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-trend-radar-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-trend-radar-styles";

    style.textContent = `
      #trend-radar-section {
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

      .ez-trend-shell {
        max-width: 1600px;
        margin: auto;
      }

      .ez-trend-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 22px;
        border-radius: 25px;
        background:
          linear-gradient(
            135deg,
            #ecfbff,
            #ffffff
          );
        border: 1px solid #d8edf4;
      }

      .ez-trend-header h2 {
        margin: 0 0 7px;
        font-size: 28px;
      }

      .ez-trend-header p {
        margin: 0;
        line-height: 1.8;
        color: #6c8797;
      }

      .ez-trend-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-trend-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 800;
      }

      .ez-trend-btn.primary {
        background: #31b4d6;
        color: #ffffff;
      }

      .ez-trend-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-trend-metrics {
        display: grid;
        grid-template-columns:
          repeat(7, minmax(0, 1fr));
        gap: 11px;
        margin: 18px 0;
      }

      .ez-trend-metric {
        background: #ffffff;
        border: 1px solid #dfedf2;
        border-radius: 17px;
        padding: 15px;
      }

      .ez-trend-metric span {
        display: block;
        color: #71899a;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .ez-trend-metric strong {
        font-size: 23px;
      }

      .ez-trend-toolbar {
        display: grid;
        grid-template-columns:
          minmax(230px, 1fr)
          165px
          165px
          165px
          165px
          auto;
        gap: 8px;
        margin-bottom: 18px;
      }

      .ez-trend-input,
      .ez-trend-select,
      .ez-trend-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        background: #ffffff;
        border-radius: 12px;
        padding: 12px 14px;
        color: #17384f;
        outline: none;
      }

      .ez-trend-input:focus,
      .ez-trend-select:focus,
      .ez-trend-textarea:focus {
        border-color: #54c4e4;
        box-shadow:
          0 0 0 3px
          rgba(84, 196, 228, .12);
      }

      .ez-trend-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 15px;
      }

      .ez-trend-card {
        position: relative;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid #dfedf2;
        border-radius: 21px;
        padding: 18px;
        box-shadow:
          0 8px 28px
          rgba(27, 103, 128, .06);
      }

      .ez-trend-card.hot {
        border-color: #9edfee;
      }

      .ez-trend-card.critical {
        border-color: #efb8c2;
      }

      .ez-trend-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }

      .ez-trend-card h3 {
        margin: 0 0 7px;
        font-size: 18px;
        line-height: 1.55;
      }

      .ez-trend-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .ez-trend-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        background: #edf8fc;
        color: #176984;
        font-size: 11px;
        font-weight: 850;
        white-space: nowrap;
      }

      .ez-trend-badge.success {
        background: #eefaf5;
        color: #237052;
      }

      .ez-trend-badge.warning {
        background: #fff8e8;
        color: #8b671a;
      }

      .ez-trend-badge.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-trend-badge.gray {
        background: #f1f6f8;
        color: #617c8b;
      }

      .ez-trend-description {
        color: #718899;
        line-height: 1.8;
        font-size: 13px;
        min-height: 46px;
      }

      .ez-trend-score {
        display: grid;
        grid-template-columns:
          1fr 1fr 1fr;
        gap: 8px;
        margin: 14px 0;
      }

      .ez-trend-score-item {
        padding: 11px;
        border-radius: 11px;
        background: #f7fbfd;
      }

      .ez-trend-score-item span {
        display: block;
        color: #78909e;
        font-size: 11px;
        margin-bottom: 4px;
      }

      .ez-trend-score-item strong {
        font-size: 17px;
      }

      .ez-trend-keywords {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 12px 0;
      }

      .ez-trend-keyword {
        padding: 5px 8px;
        border-radius: 8px;
        background: #f3fafc;
        color: #587785;
        font-size: 11px;
      }

      .ez-trend-actions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 14px;
      }

      .ez-trend-small {
        border: 0;
        border-radius: 9px;
        padding: 8px 10px;
        background: #edf8fc;
        color: #176984;
        cursor: pointer;
        font-weight: 750;
      }

      .ez-trend-empty {
        grid-column: 1 / -1;
        padding: 55px 20px;
        text-align: center;
        color: #718a99;
        border: 1px dashed #cfe6ed;
        border-radius: 20px;
      }

      .ez-trend-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background:
          rgba(13, 57, 76, .27);
        backdrop-filter: blur(7px);
      }

      .ez-trend-modal.open {
        display: flex;
      }

      .ez-trend-dialog {
        width: min(980px, 100%);
        max-height: 94vh;
        overflow: auto;
        background: #ffffff;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15, 72, 96, .22);
      }

      .ez-trend-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 19px 21px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-trend-dialog-body {
        padding: 21px;
      }

      .ez-trend-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 15px 21px;
        border-top: 1px solid #e4eff3;
      }

      .ez-trend-alert {
        padding: 15px;
        border-radius: 15px;
        background:
          linear-gradient(
            135deg,
            #eefbff,
            #ffffff
          );
        border: 1px solid #d6edf4;
        line-height: 1.8;
      }

      #ez-trend-radar-toast {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 100001;
        padding: 13px 17px;
        border-radius: 13px;
        background: #173f55;
        color: #ffffff;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition: .2s ease;
      }

      #ez-trend-radar-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 1250px) {
        .ez-trend-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-trend-metrics {
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
        }

        .ez-trend-toolbar {
          grid-template-columns:
            1fr 1fr;
        }
      }

      @media (max-width: 750px) {
        #trend-radar-section {
          padding: 12px;
        }

        .ez-trend-header {
          display: block;
        }

        .ez-trend-actions {
          margin-top: 15px;
        }

        .ez-trend-grid {
          grid-template-columns: 1fr;
        }

        .ez-trend-metrics {
          grid-template-columns: 1fr 1fr;
        }

        .ez-trend-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-trend-score {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function metrics() {
    const result = {
      total: state.trends.length,
      emerging: 0,
      rising: 0,
      hot: 0,
      critical: 0,
      highPriority: 0,
      aiReady: 0
    };

    state.trends.forEach(
      (trend) => {
        if (
          Object.prototype.hasOwnProperty.call(
            result,
            trend.level
          )
        ) {
          result[trend.level]++;
        }

        if (
          trend.priority ===
            "high" ||
          trend.priority ===
            "critical"
        ) {
          result.highPriority++;
        }

        if (
          trend.aiReady
        ) {
          result.aiReady++;
        }
      }
    );

    return result;
  }

  function getFiltered() {
    const query =
      state.search
        .trim()
        .toLowerCase();

    const result =
      state.trends.filter(
        (trend) => {
          if (
            state.category !==
              "all" &&
            trend.category !==
              state.category
          ) {
            return false;
          }

          if (
            state.level !==
              "all" &&
            trend.level !==
              state.level
          ) {
            return false;
          }

          if (
            state.priority !==
              "all" &&
            trend.priority !==
              state.priority
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const text = [
            trend.title,
            trend.description,
            trend.category,
            ...(trend.keywords ||
              []),
            ...(trend.sourceNames ||
              [])
          ]
            .join(" ")
            .toLowerCase();

          return text.includes(
            query
          );
        }
      );

    result.sort(
      (a, b) => {
        if (
          state.sort ===
          "mentions"
        ) {
          return (
            b.mentions -
            a.mentions
          );
        }

        if (
          state.sort ===
          "growth"
        ) {
          return (
            b.growth -
            a.growth
          );
        }

        if (
          state.sort ===
          "confidence"
        ) {
          return (
            b.confidence -
            a.confidence
          );
        }

        return (
          b.momentum -
          a.momentum
        );
      }
    );

    return result;
  }

  function render() {
    const section =
      ensureSection();

    const m =
      metrics();

    const trends =
      getFiltered();

    section.innerHTML = `
      <div class="ez-trend-shell">

        <div class="ez-trend-header">

          <div>

            <h2>
              رادار الأخبار والاتجاهات
            </h2>

            <p>
              مركز ذكي لاكتشاف الموضوعات الصاعدة
              وترتيبها قبل تحويلها إلى محتوى
              أو تغطية أو خبر عاجل.
            </p>

          </div>

          <div class="ez-trend-actions">

            <button
              class="ez-trend-btn"
              data-trend-action="refresh"
            >
              تحديث الرادار
            </button>

            <button
              class="ez-trend-btn"
              data-trend-action="seed"
            >
              إضافة بيانات تجريبية
            </button>

            <button
              class="ez-trend-btn primary"
              data-trend-action="new"
            >
              + إضافة إشارة
            </button>

          </div>

        </div>

        <div class="ez-trend-metrics">

          ${metric(
            "إجمالي الإشارات",
            m.total
          )}

          ${metric(
            "صاعدة",
            m.emerging
          )}

          ${metric(
            "متنامية",
            m.rising
          )}

          ${metric(
            "ساخنة",
            m.hot
          )}

          ${metric(
            "حرجة",
            m.critical
          )}

          ${metric(
            "أولوية عالية",
            m.highPriority
          )}

          ${metric(
            "جاهزة للـAI",
            m.aiReady
          )}

        </div>

        <div class="ez-trend-toolbar">

          <input
            id="ez-trend-search"
            class="ez-trend-input"
            placeholder="ابحث عن موضوع أو كلمة..."
            value="${escapeHtml(
              state.search
            )}"
          />

          <select
            id="ez-trend-category"
            class="ez-trend-select"
          >
            <option value="all">
              كل التصنيفات
            </option>

            ${Object.entries(
              CATEGORIES
            )
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${
                      state.category ===
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
            id="ez-trend-level"
            class="ez-trend-select"
          >
            <option value="all">
              كل المستويات
            </option>

            ${Object.entries(
              LEVELS
            )
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${
                      state.level ===
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
            id="ez-trend-priority"
            class="ez-trend-select"
          >
            <option value="all">
              كل الأولويات
            </option>

            ${Object.entries(
              PRIORITIES
            )
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${
                      state.priority ===
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
            id="ez-trend-sort"
            class="ez-trend-select"
          >

            <option
              value="momentum"
              ${
                state.sort ===
                "momentum"
                  ? "selected"
                  : ""
              }
            >
              الأعلى زخمًا
            </option>

            <option
              value="mentions"
              ${
                state.sort ===
                "mentions"
                  ? "selected"
                  : ""
              }
            >
              الأكثر ذكرًا
            </option>

            <option
              value="growth"
              ${
                state.sort ===
                "growth"
                  ? "selected"
                  : ""
              }
            >
              الأسرع نموًا
            </option>

            <option
              value="confidence"
              ${
                state.sort ===
                "confidence"
                  ? "selected"
                  : ""
              }
            >
              الأعلى ثقة
            </option>

          </select>

          <button
            class="ez-trend-btn"
            data-trend-action="clear"
          >
            مسح
          </button>

        </div>

        <div class="ez-trend-grid">

          ${
            state.loading
              ? `
                <div class="ez-trend-empty">
                  جاري تحديث الرادار...
                </div>
              `
              : trends.length
              ? trends
                  .map(
                    renderTrend
                  )
                  .join("")
              : `
                <div class="ez-trend-empty">

                  <strong>
                    لا توجد إشارات حتى الآن.
                  </strong>

                  <p>
                    يمكن إضافة إشارة يدويًا أو
                    ربط Backend Connector لاحقًا
                    بمصادر خارجية.
                  </p>

                </div>
              `
          }

        </div>

      </div>

      <div
        id="ez-trend-radar-modal"
        class="ez-trend-modal"
        aria-hidden="true"
      ></div>

      <div id="ez-trend-radar-toast"></div>
    `;

    bindEvents();
  }

  function metric(
    label,
    value
  ) {
    return `
      <div class="ez-trend-metric">

        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${formatNumber(value)}
        </strong>

      </div>
    `;
  }

  function levelClass(
    level
  ) {
    if (
      level === "critical"
    ) {
      return "danger";
    }

    if (
      level === "hot" ||
      level === "rising"
    ) {
      return "warning";
    }

    if (
      level === "emerging"
    ) {
      return "success";
    }

    return "gray";
  }

  function renderTrend(
    trend
  ) {
    const keywords =
      Array.isArray(
        trend.keywords
      )
        ? trend.keywords
        : [];

    return `
      <article
        class="
          ez-trend-card
          ${
            trend.level ===
            "hot"
              ? "hot"
              : ""
          }
          ${
            trend.level ===
            "critical"
              ? "critical"
              : ""
          }
        "
      >

        <div class="ez-trend-card-top">

          <div>

            <h3>
              ${escapeHtml(
                trend.title
              )}
            </h3>

            <div
              class="ez-trend-badges"
            >

              <span
                class="
                  ez-trend-badge
                  ${levelClass(
                    trend.level
                  )}
                "
              >
                ${escapeHtml(
                  LEVELS[
                    trend.level
                  ] ||
                    trend.level
                )}
              </span>

              <span
                class="ez-trend-badge"
              >
                ${escapeHtml(
                  CATEGORIES[
                    trend.category
                  ] ||
                    trend.category
                )}
              </span>

              <span
                class="ez-trend-badge"
              >
                ${escapeHtml(
                  PRIORITIES[
                    trend.priority
                  ] ||
                    trend.priority
                )}
              </span>

            </div>

          </div>

        </div>

        <p class="ez-trend-description">
          ${escapeHtml(
            trend.description ||
              "لا يوجد وصف."
          )}
        </p>

        <div class="ez-trend-score">

          <div
            class="ez-trend-score-item"
          >
            <span>
              الزخم
            </span>

            <strong>
              ${formatNumber(
                trend.momentum
              )}
            </strong>
          </div>

          <div
            class="ez-trend-score-item"
          >
            <span>
              النمو
            </span>

            <strong>
              ${formatNumber(
                trend.growth
              )}%
            </strong>
          </div>

          <div
            class="ez-trend-score-item"
          >
            <span>
              الذكر
            </span>

            <strong>
              ${formatNumber(
                trend.mentions
              )}
            </strong>
          </div>

        </div>

        <div class="ez-trend-keywords">

          ${
            keywords.length
              ? keywords
                  .slice(
                    0,
                    8
                  )
                  .map(
                    (keyword) => `
                      <span
                        class="ez-trend-keyword"
                      >
                        #${escapeHtml(
                          keyword
                        )}
                      </span>
                    `
                  )
                  .join("")
              : `
                  <span
                    class="ez-trend-keyword"
                  >
                    لا توجد كلمات
                  </span>
                `
          }

        </div>

        <div
          style="
            font-size:11px;
            color:#79909d;
            line-height:1.8;
          "
        >
          الثقة:
          ${formatNumber(
            trend.confidence
          )}%

          <br>

          آخر ظهور:
          ${escapeHtml(
            formatDate(
              trend.lastSeen
            )
          )}
        </div>

        <div
          class="ez-trend-actions-row"
        >

          <button
            class="ez-trend-small"
            data-trend-action="details"
            data-id="${escapeHtml(
              trend.id
            )}"
          >
            التفاصيل
          </button>

          <button
            class="ez-trend-small"
            data-trend-action="ai"
            data-id="${escapeHtml(
              trend.id
            )}"
          >
            تحليل AI
          </button>

          <button
            class="ez-trend-small"
            data-trend-action="draft"
            data-id="${escapeHtml(
              trend.id
            )}"
          >
            إنشاء مسودة
          </button>

          <button
            class="ez-trend-small"
            data-trend-action="breaking"
            data-id="${escapeHtml(
              trend.id
            )}"
          >
            تجهيز عاجل
          </button>

        </div>

      </article>
    `;
  }

  function openModal(
    title,
    body,
    footer = ""
  ) {
    const modal =
      document.querySelector(
        "#ez-trend-radar-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div class="ez-trend-dialog">

        <div
          class="ez-trend-dialog-header"
        >

          <strong>
            ${escapeHtml(title)}
          </strong>

          <button
            class="ez-trend-btn"
            data-trend-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-trend-dialog-body"
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="ez-trend-dialog-footer"
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
        "#ez-trend-radar-modal"
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

  function openDetails(id) {
    const trend =
      state.trends.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!trend) {
      return;
    }

    state.selected =
      trend;

    openModal(
      "تفاصيل الإشارة الإعلامية",
      `
        <h2>
          ${escapeHtml(
            trend.title
          )}
        </h2>

        <div
          class="ez-trend-badges"
          style="margin:12px 0"
        >

          <span
            class="ez-trend-badge"
          >
            ${escapeHtml(
              LEVELS[
                trend.level
              ] ||
                trend.level
            )}
          </span>

          <span
            class="ez-trend-badge"
          >
            ${escapeHtml(
              CATEGORIES[
                trend.category
              ] ||
                trend.category
            )}
          </span>

          <span
            class="ez-trend-badge"
          >
            ${escapeHtml(
              PRIORITIES[
                trend.priority
              ] ||
                trend.priority
            )}
          </span>

        </div>

        <p
          style="
            line-height:1.9;
            color:#6e8797;
          "
        >
          ${escapeHtml(
            trend.description ||
              "لا يوجد وصف."
          )}
        </p>

        <div
          class="ez-trend-score"
        >

          <div
            class="ez-trend-score-item"
          >
            <span>
              الزخم
            </span>

            <strong>
              ${formatNumber(
                trend.momentum
              )}
            </strong>
          </div>

          <div
            class="ez-trend-score-item"
          >
            <span>
              النمو
            </span>

            <strong>
              ${formatNumber(
                trend.growth
              )}%
            </strong>
          </div>

          <div
            class="ez-trend-score-item"
          >
            <span>
              الذكر
            </span>

            <strong>
              ${formatNumber(
                trend.mentions
              )}
            </strong>
          </div>

          <div
            class="ez-trend-score-item"
          >
            <span>
              المصادر
            </span>

            <strong>
              ${formatNumber(
                trend.sources
              )}
            </strong>
          </div>

          <div
            class="ez-trend-score-item"
          >
            <span>
              الثقة
            </span>

            <strong>
              ${formatNumber(
                trend.confidence
              )}%
            </strong>
          </div>

        </div>

        <div
          class="ez-trend-alert"
        >
          <strong>
            حالة الذكاء الاصطناعي
          </strong>

          <p>
            ${
              trend.aiReady
                ? "الإشارة جاهزة للتحليل بواسطة محرك الذكاء الاصطناعي."
                : "الإشارة غير مفعلة لمحرك الذكاء الاصطناعي."
            }
          </p>

          <strong>
            حالة غرفة الأخبار
          </strong>

          <p>
            ${
              trend.newsroomReady
                ? "يمكن تحويل الإشارة إلى مسودة داخل غرفة الأخبار."
                : "الإشارة غير جاهزة لغرفة الأخبار."
            }
          </p>

          <strong>
            حالة الأخبار العاجلة
          </strong>

          <p>
            ${
              trend.breakingReady
                ? "الإشارة مرشحة لمسار الأخبار العاجلة."
                : "الإشارة ليست مجهزة لمسار العاجل."
            }
          </p>
        </div>

        <h3>
          الكلمات المفتاحية
        </h3>

        <div
          class="ez-trend-keywords"
        >
          ${
            trend.keywords
              .map(
                (keyword) => `
                  <span
                    class="ez-trend-keyword"
                  >
                    #${escapeHtml(
                      keyword
                    )}
                  </span>
                `
              )
              .join("") ||
            "لا توجد كلمات."
          }
        </div>

        <h3>
          المصادر
        </h3>

        <p>
          ${
            trend.sourceNames
              .map(
                (source) =>
                  escapeHtml(
                    source
                  )
              )
              .join(
                "، "
              ) ||
            "لم يتم تحديد المصادر."
          }
        </p>

        <p
          style="
            color:#78909e;
            line-height:1.8;
          "
        >
          أول ظهور:
          ${escapeHtml(
            formatDate(
              trend.firstSeen
            )
          )}

          <br>

          آخر ظهور:
          ${escapeHtml(
            formatDate(
              trend.lastSeen
            )
          )}
        </p>
      `,
      `
        <button
          class="ez-trend-btn"
          data-trend-action="close"
        >
          إغلاق
        </button>

        <button
          class="ez-trend-btn"
          data-trend-action="ai"
          data-id="${escapeHtml(
            trend.id
          )}"
        >
          تحليل AI
        </button>

        <button
          class="ez-trend-btn primary"
          data-trend-action="draft"
          data-id="${escapeHtml(
            trend.id
          )}"
        >
          إنشاء مسودة
        </button>

        <button
          class="ez-trend-btn danger"
          data-trend-action="breaking"
          data-id="${escapeHtml(
            trend.id
          )}"
        >
          تجهيز عاجل
        </button>
      `
    );
  }

  function openCreate() {
    openModal(
      "إضافة إشارة إعلامية",
      `
        <form id="ez-trend-create-form">

          <div
            style="
              display:grid;
              grid-template-columns:
                1fr 1fr;
              gap:13px;
            "
          >

            <div
              style="
                grid-column:1/-1;
              "
            >
              <label>
                عنوان الموضوع
              </label>

              <input
                class="ez-trend-input"
                name="title"
                required
                placeholder="مثال: موضوع إعلامي صاعد"
              />
            </div>

            <div>
              <label>
                التصنيف
              </label>

              <select
                class="ez-trend-select"
                name="category"
              >
                ${Object.entries(
                  CATEGORIES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
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

            <div>
              <label>
                المستوى
              </label>

              <select
                class="ez-trend-select"
                name="level"
              >
                ${Object.entries(
                  LEVELS
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
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

            <div>
              <label>
                الأولوية
              </label>

              <select
                class="ez-trend-select"
                name="priority"
              >
                ${Object.entries(
                  PRIORITIES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
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

            <div>
              <label>
                الزخم
              </label>

              <input
                class="ez-trend-input"
                type="number"
                min="0"
                name="momentum"
                value="0"
              />
            </div>

            <div>
              <label>
                النمو %
              </label>

              <input
                class="ez-trend-input"
                type="number"
                min="0"
                name="growth"
                value="0"
              />
            </div>

            <div>
              <label>
                عدد الذكر
              </label>

              <input
                class="ez-trend-input"
                type="number"
                min="0"
                name="mentions"
                value="0"
              />
            </div>

            <div>
              <label>
                عدد المصادر
              </label>

              <input
                class="ez-trend-input"
                type="number"
                min="0"
                name="sources"
                value="0"
              />
            </div>

            <div>
              <label>
                الثقة %
              </label>

              <input
                class="ez-trend-input"
                type="number"
                min="0"
                max="100"
                name="confidence"
                value="0"
              />
            </div>

            <div
              style="
                grid-column:1/-1;
              "
            >
              <label>
                الكلمات المفتاحية
              </label>

              <input
                class="ez-trend-input"
                name="keywords"
                placeholder="كلمة، كلمة، كلمة"
              />
            </div>

            <div
              style="
                grid-column:1/-1;
              "
            >
              <label>
                وصف الموضوع
              </label>

              <textarea
                class="ez-trend-textarea"
                name="description"
                rows="5"
              ></textarea>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-trend-btn"
          data-trend-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-trend-btn primary"
          data-trend-action="save-new"
        >
          حفظ الإشارة
        </button>
      `
    );
  }

  function createTrend() {
    const form =
      document.querySelector(
        "#ez-trend-create-form"
      );

    if (!form) {
      return;
    }

    const data =
      Object.fromEntries(
        new FormData(
          form
        ).entries()
      );

    if (
      !data.title ||
      !data.title.trim()
    ) {
      notify(
        "عنوان الموضوع مطلوب.",
        "warning"
      );

      return;
    }

    const trend =
      normalizeTrend({
        id: createId(),
        title:
          data.title.trim(),
        description:
          data.description ||
          "",
        category:
          data.category ||
          "other",
        level:
          data.level ||
          "emerging",
        priority:
          data.priority ||
          "normal",
        momentum:
          Number(
            data.momentum || 0
          ),
        growth:
          Number(
            data.growth || 0
          ),
        mentions:
          Number(
            data.mentions || 0
          ),
        sources:
          Number(
            data.sources || 0
          ),
        confidence:
          Number(
            data.confidence || 0
          ),
        keywords:
          String(
            data.keywords || ""
          )
            .split(",")
            .map(
              (item) =>
                item.trim()
            )
            .filter(Boolean),
        sourceNames: [],
        firstSeen:
          new Date().toISOString(),
        lastSeen:
          new Date().toISOString()
      });

    state.trends.unshift(
      trend
    );

    save();

    closeModal();

    render();

    notify(
      "تمت إضافة الإشارة الإعلامية.",
      "success"
    );
  }

  function seedData() {
    const examples = [
      {
        title:
          "تطور إعلامي صاعد",
        description:
          "إشارة تجريبية لاختبار محرك مراقبة الاتجاهات.",
        category:
          "media",
        level:
          "rising",
        priority:
          "high",
        momentum: 84,
        mentions: 1260,
        growth: 47,
        sources: 8,
        confidence: 88,
        keywords: [
          "إعلام",
          "أخبار",
          "تغطية"
        ],
        sourceNames: [
          "مصدر داخلي",
          "غرفة الأخبار"
        ]
      },
      {
        title:
          "موضوع تقني سريع النمو",
        description:
          "إشارة تجريبية لقياس سرعة النمو.",
        category:
          "technology",
        level:
          "hot",
        priority:
          "high",
        momentum: 93,
        mentions: 2740,
        growth: 71,
        sources: 12,
        confidence: 91,
        keywords: [
          "تقنية",
          "ذكاء اصطناعي"
        ],
        sourceNames: [
          "مصدر تقني"
        ]
      },
      {
        title:
          "إشارة عاجلة محتملة",
        description:
          "إشارة تجريبية بمستوى أولوية مرتفع.",
        category:
          "national",
        level:
          "critical",
        priority:
          "critical",
        momentum: 98,
        mentions: 5600,
        growth: 93,
        sources: 17,
        confidence: 95,
        keywords: [
          "عاجل",
          "وطني"
        ],
        sourceNames: [
          "مصدر رسمي"
        ],
        breakingReady:
          true
      }
    ];

    examples.forEach(
      (example) => {
        state.trends.unshift(
          normalizeTrend(
            example
          )
        );
      }
    );

    save();

    render();

    notify(
      "تمت إضافة بيانات تجريبية للرادار.",
      "success"
    );
  }

  function analyzeWithAI(
    id
  ) {
    const trend =
      state.trends.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!trend) {
      return;
    }

    /*
     * الربط الحقيقي بمحرك AI سيتم عبر
     * Backend API.
     *
     * هنا نرسل حدثًا موحدًا حتى تستطيع
     * وحدة AI الحالية استقبال الإشارة
     * لاحقًا بدون تغيير الواجهة.
     */

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:trend:analyze",
        {
          detail: {
            trend
          }
        }
      )
    );

    notify(
      "تم إرسال الإشارة إلى مسار تحليل AI.",
      "success"
    );
  }

  function createDraft(
    id
  ) {
    const trend =
      state.trends.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!trend) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:trend:create-draft",
        {
          detail: {
            trend
          }
        }
      )
    );

    trend.newsroomReady =
      true;

    trend.updatedAt =
      new Date().toISOString();

    save();

    notify(
      "تم تجهيز الإشارة لمسار إنشاء المسودة.",
      "success"
    );
  }

  function prepareBreaking(
    id
  ) {
    const trend =
      state.trends.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!trend) {
      return;
    }

    trend.breakingReady =
      true;

    trend.priority =
      "critical";

    trend.updatedAt =
      new Date().toISOString();

    save();

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:trend:breaking",
        {
          detail: {
            trend
          }
        }
      )
    );

    render();

    notify(
      "تم تجهيز الإشارة لمسار الأخبار العاجلة.",
      "warning"
    );
  }

  function clearFilters() {
    state.search = "";
    state.category = "all";
    state.level = "all";
    state.priority = "all";
    state.sort = "momentum";

    render();
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#trend-radar-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-trend-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .trendAction;

              const id =
                button.dataset.id;

              if (
                action ===
                "refresh"
              ) {
                load();

                render();

                notify(
                  "تم تحديث الرادار.",
                  "success"
                );

                return;
              }

              if (
                action ===
                "seed"
              ) {
                seedData();
                return;
              }

              if (
                action ===
                "new"
              ) {
                openCreate();
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
                "close"
              ) {
                closeModal();
                return;
              }

              if (
                action ===
                "save-new"
              ) {
                createTrend();
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
                "ai"
              ) {
                analyzeWithAI(id);
                return;
              }

              if (
                action ===
                "draft"
              ) {
                createDraft(id);
                return;
              }

              if (
                action ===
                "breaking"
              ) {
                prepareBreaking(
                  id
                );
              }
            }
          );
        }
      );

    const search =
      section.querySelector(
        "#ez-trend-search"
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

    const category =
      section.querySelector(
        "#ez-trend-category"
      );

    if (category) {
      category.addEventListener(
        "change",
        (event) => {
          state.category =
            event.target.value;

          render();
        }
      );
    }

    const level =
      section.querySelector(
        "#ez-trend-level"
      );

    if (level) {
      level.addEventListener(
        "change",
        (event) => {
          state.level =
            event.target.value;

          render();
        }
      );
    }

    const priority =
      section.querySelector(
        "#ez-trend-priority"
      );

    if (priority) {
      priority.addEventListener(
        "change",
        (event) => {
          state.priority =
            event.target.value;

          render();
        }
      );
    }

    const sort =
      section.querySelector(
        "#ez-trend-sort"
      );

    if (sort) {
      sort.addEventListener(
        "change",
        (event) => {
          state.sort =
            event.target.value;

          render();
        }
      );
    }

    const modal =
      document.querySelector(
        "#ez-trend-radar-modal"
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

    section.hidden = false;

    injectStyles();

    load();

    render();
  }

  function hide() {
    const section =
      document.querySelector(
        "#trend-radar-section"
      );

    if (section) {
      section.hidden = true;
    }
  }

  function refresh() {
    load();

    render();
  }

  function addTrend(
    trend
  ) {
    const normalized =
      normalizeTrend(
        trend || {}
      );

    state.trends.unshift(
      normalized
    );

    save();

    render();

    return normalized;
  }

  function getTrends() {
    return [
      ...state.trends
    ];
  }

  function openById(id) {
    show();

    setTimeout(
      () => {
        openDetails(id);
      },
      150
    );
  }

  window.EZMediaAdminTrendRadar =
    {
      module: MODULE,
      show,
      hide,
      refresh,
      addTrend,
      getTrends,
      openById
    };

  window.addEventListener(
    REFRESH_EVENT,
    () => {
      refresh();
    }
  );

  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const section =
        event.detail?.section ||
        event.detail?.target;

      if (
        section ===
          "trend-radar" ||
        section ===
          "trends" ||
        section ===
          "trend"
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
      },
      {
        once: true
      }
    );
  } else {
    injectStyles();
    ensureSection();
  }

  console.info(
    "EZ MEDIA 11.0 — Trend Radar loaded."
  );
})();
