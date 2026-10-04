"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 32
 * الملف: public/admin-audience-command.js
 *
 * مركز إدارة الجمهور والعضويات الذكية
 *
 * الوظائف:
 * - إدارة شرائح الجمهور
 * - إدارة العضويات
 * - الاهتمامات
 * - التنبيهات
 * - التفاعل
 * - الجمهور النشط
 * - الجمهور العائد
 * - تصنيف الجمهور
 * - البحث والفلترة
 * - إنشاء شرائح ذكية
 * - ربط الجمهور بالمحتوى
 * - تجهيز المنصة للتخصيص الذكي
 *
 * البيانات الحالية محلية إلى أن يتم ربط Backend حقيقي.
 */

(function () {
  "use strict";

  const MODULE =
    "audience-command";

  const STORAGE_KEY =
    "ezmedia_audience_command_v1";

  const SEGMENTS_KEY =
    "ezmedia_audience_segments_v1";

  const SETTINGS_KEY =
    "ezmedia_audience_settings_v1";

  const DEFAULT_SETTINGS = {
    personalizationEnabled:
      true,

    recommendationsEnabled:
      true,

    notificationsEnabled:
      true,

    smartSegmentsEnabled:
      true,

    anonymousAnalytics:
      true,

    language:
      "ar",

    defaultSegment:
      "all"
  };

  const SEGMENT_TYPES = {
    all:
      "كل الجمهور",

    visitor:
      "زائر",

    member:
      "عضو",

    subscriber:
      "مشترك",

    journalist:
      "مهتم بالإعلام",

    business:
      "قطاع الأعمال",

    sports:
      "مهتم بالرياضة",

    technology:
      "مهتم بالتقنية",

    local:
      "جمهور محلي",

    international:
      "جمهور دولي"
  };

  const STATUS = {
    active:
      "نشط",

    inactive:
      "غير نشط",

    blocked:
      "محظور",

    pending:
      "معلق"
  };

  const state = {
    audiences: [],
    segments: [],
    settings: {},
    search: "",
    type: "all",
    status: "all",
    selected: null,
    activeTab:
      "overview"
  };

  function id(prefix = "aud") {
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

  function normalizeAudience(
    item = {}
  ) {
    return {
      id:
        item.id ||
        id(),

      name:
        item.name ||
        "عضو جديد",

      email:
        item.email ||
        "",

      type:
        item.type ||
        "visitor",

      status:
        item.status ||
        "active",

      country:
        item.country ||
        "SA",

      language:
        item.language ||
        "ar",

      interests:
        Array.isArray(
          item.interests
        )
          ? item.interests
          : [],

      notifications:
        item.notifications !==
        false,

      newsletter:
        Boolean(
          item.newsletter
        ),

      lastActive:
        item.lastActive ||
        null,

      sessions:
        Number(
          item.sessions || 0
        ),

      views:
        Number(
          item.views || 0
        ),

      shares:
        Number(
          item.shares || 0
        ),

      saves:
        Number(
          item.saves || 0
        ),

      comments:
        Number(
          item.comments || 0
        ),

      createdAt:
        item.createdAt ||
        new Date().toISOString(),

      updatedAt:
        item.updatedAt ||
        new Date().toISOString()
    };
  }

  function normalizeSegment(
    item = {}
  ) {
    return {
      id:
        item.id ||
        id("segment"),

      name:
        item.name ||
        "شريحة جديدة",

      description:
        item.description ||
        "",

      type:
        item.type ||
        "all",

      rules:
        Array.isArray(
          item.rules
        )
          ? item.rules
          : [],

      members:
        Number(
          item.members || 0
        ),

      active:
        item.active !== false,

      createdAt:
        item.createdAt ||
        new Date().toISOString(),

      updatedAt:
        item.updatedAt ||
        new Date().toISOString()
    };
  }

  function load() {
    try {
      const audiences =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "[]"
        );

      const segments =
        JSON.parse(
          localStorage.getItem(
            SEGMENTS_KEY
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

      state.audiences =
        Array.isArray(
          audiences
        )
          ? audiences.map(
              normalizeAudience
            )
          : [];

      state.segments =
        Array.isArray(
          segments
        )
          ? segments.map(
              normalizeSegment
            )
          : [];

      state.settings = {
        ...clone(
          DEFAULT_SETTINGS
        ),
        ...(settings || {})
      };
    } catch (error) {
      console.warn(
        "EZ MEDIA audience load:",
        error
      );

      state.audiences = [];
      state.segments = [];

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
          state.audiences
        )
      );

      localStorage.setItem(
        SEGMENTS_KEY,
        JSON.stringify(
          state.segments
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
          "ezmedia:audience:updated",
          {
            detail: {
              audiences:
                clone(
                  state.audiences
                ),

              segments:
                clone(
                  state.segments
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
        "EZ MEDIA audience save:",
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
              "مركز الجمهور",
            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-audience-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-audience-toast";

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
        "#ez-audience-command-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-audience-command-styles";

    style.textContent = `
      #audience-command-section {
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

      .ez-audience-shell {
        max-width: 1600px;
        margin: auto;
      }

      .ez-audience-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 24px;
        border-radius: 26px;
        border: 1px solid #d8edf4;
        background:
          linear-gradient(
            135deg,
            #eafaff,
            #ffffff
          );
      }

      .ez-audience-header h2 {
        margin: 0 0 7px;
        font-size: 29px;
      }

      .ez-audience-header p {
        margin: 0;
        color: #6d8795;
        line-height: 1.8;
      }

      .ez-audience-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-audience-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 800;
      }

      .ez-audience-btn.primary {
        background: #42c4e8;
        color: #fff;
      }

      .ez-audience-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-audience-metrics {
        display: grid;
        grid-template-columns:
          repeat(7, minmax(0, 1fr));
        gap: 10px;
        margin: 18px 0;
      }

      .ez-audience-metric {
        background: #fff;
        border: 1px solid #deedf2;
        border-radius: 17px;
        padding: 15px;
      }

      .ez-audience-metric span {
        display: block;
        color: #718998;
        font-size: 11px;
        margin-bottom: 6px;
      }

      .ez-audience-metric strong {
        font-size: 22px;
      }

      .ez-audience-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-bottom: 16px;
      }

      .ez-audience-tab {
        border: 0;
        border-radius: 11px;
        padding: 10px 14px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 800;
      }

      .ez-audience-tab.active {
        background: #42c4e8;
        color: #fff;
      }

      .ez-audience-toolbar {
        display: grid;
        grid-template-columns:
          minmax(240px, 1fr)
          180px
          180px
          auto;
        gap: 8px;
        margin-bottom: 16px;
      }

      .ez-audience-input,
      .ez-audience-select,
      .ez-audience-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        border-radius: 12px;
        padding: 12px 13px;
        background: #fff;
        color: #17384f;
        outline: none;
      }

      .ez-audience-input:focus,
      .ez-audience-select:focus,
      .ez-audience-textarea:focus {
        border-color: #4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-audience-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .ez-audience-card {
        background: #fff;
        border: 1px solid #deedf2;
        border-radius: 20px;
        padding: 18px;
      }

      .ez-audience-card h3 {
        margin: 0 0 6px;
      }

      .ez-audience-card-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .ez-audience-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 9px 0;
      }

      .ez-audience-badge {
        display: inline-flex;
        border-radius: 999px;
        padding: 5px 9px;
        background: #edf8fc;
        color: #176984;
        font-size: 10px;
        font-weight: 850;
      }

      .ez-audience-badge.success {
        background: #eefaf5;
        color: #267255;
      }

      .ez-audience-badge.warning {
        background: #fff8e8;
        color: #8b671a;
      }

      .ez-audience-badge.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-audience-info {
        display: grid;
        grid-template-columns:
          repeat(3, 1fr);
        gap: 7px;
        margin: 13px 0;
      }

      .ez-audience-info-item {
        padding: 9px;
        border-radius: 10px;
        background: #f7fbfd;
      }

      .ez-audience-info-item span {
        display: block;
        color: #8195a0;
        font-size: 10px;
        margin-bottom: 3px;
      }

      .ez-audience-info-item strong {
        font-size: 14px;
      }

      .ez-audience-interests {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 10px;
      }

      .ez-audience-interest {
        padding: 4px 8px;
        border-radius: 8px;
        background: #f0f9fc;
        color: #34758b;
        font-size: 10px;
      }

      .ez-audience-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 14px;
      }

      .ez-audience-small {
        border: 0;
        border-radius: 9px;
        padding: 8px 10px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 750;
      }

      .ez-audience-small.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-audience-empty {
        grid-column: 1 / -1;
        padding: 55px 20px;
        text-align: center;
        border: 1px dashed #cfe6ed;
        border-radius: 20px;
        color: #718997;
      }

      .ez-audience-panel {
        background: #fff;
        border: 1px solid #deedf2;
        border-radius: 21px;
        padding: 20px;
      }

      .ez-audience-settings {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .ez-audience-check {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 13px;
        border-radius: 13px;
        background: #f7fbfd;
        border: 1px solid #e2eef2;
      }

      .ez-audience-modal {
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

      .ez-audience-modal.open {
        display: flex;
      }

      .ez-audience-dialog {
        width: min(850px,100%);
        max-height: 94vh;
        overflow: auto;
        background: #fff;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-audience-dialog-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 21px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-audience-dialog-body {
        padding: 21px;
      }

      .ez-audience-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 15px 21px;
        border-top: 1px solid #e4eff3;
      }

      .ez-audience-form {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 13px;
      }

      .ez-audience-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ez-audience-field.full {
        grid-column: 1 / -1;
      }

      .ez-audience-field label {
        font-size: 12px;
        font-weight: 800;
        color: #57717f;
      }

      #ez-audience-toast {
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

      #ez-audience-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width:1250px) {
        .ez-audience-metrics {
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
        }

        .ez-audience-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-audience-toolbar {
          grid-template-columns:
            1fr 1fr;
        }
      }

      @media (max-width:700px) {
        #audience-command-section {
          padding: 12px;
        }

        .ez-audience-header {
          display: block;
        }

        .ez-audience-actions {
          margin-top: 15px;
        }

        .ez-audience-metrics {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-audience-grid {
          grid-template-columns: 1fr;
        }

        .ez-audience-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-audience-settings,
        .ez-audience-form {
          grid-template-columns: 1fr;
        }

        .ez-audience-field.full {
          grid-column: auto;
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
        "#audience-command-section"
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
      "audience-command-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function metrics() {
    const total =
      state.audiences.length;

    const active =
      state.audiences.filter(
        (item) =>
          item.status ===
          "active"
      ).length;

    const members =
      state.audiences.filter(
        (item) =>
          item.type ===
            "member" ||
          item.type ===
            "subscriber"
      ).length;

    const subscribers =
      state.audiences.filter(
        (item) =>
          item.type ===
          "subscriber"
      ).length;

    const newsletter =
      state.audiences.filter(
        (item) =>
          item.newsletter
      ).length;

    const notifications =
      state.audiences.filter(
        (item) =>
          item.notifications
      ).length;

    const engaged =
      state.audiences.filter(
        (item) =>
          item.views > 5 ||
          item.shares > 0 ||
          item.comments > 0 ||
          item.saves > 0
      ).length;

    return {
      total,
      active,
      members,
      subscribers,
      newsletter,
      notifications,
      engaged
    };
  }

  function metric(
    label,
    value
  ) {
    return `
      <div
        class="ez-audience-metric"
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

  function filteredAudiences() {
    const query =
      state.search
        .trim()
        .toLowerCase();

    return state.audiences
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
            item.name,
            item.email,
            item.country,
            item.language,
            ...(item.interests ||
              [])
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      )
      .sort(
        (a, b) =>
          Number(b.views) -
          Number(a.views)
      );
  }

  function render() {
    const section =
      ensureSection();

    const m =
      metrics();

    section.innerHTML = `
      <div
        class="ez-audience-shell"
      >

        <div
          class="ez-audience-header"
        >

          <div>
            <h2>
              مركز الجمهور والعضويات الذكية
            </h2>

            <p>
              إدارة الجمهور والتفاعل والاهتمامات
              والتخصيص الذكي داخل EZ MEDIA.
            </p>
          </div>

          <div
            class="ez-audience-actions"
          >

            <button
              class="ez-audience-btn"
              data-audience-action="seed"
            >
              بيانات تجريبية
            </button>

            <button
              class="ez-audience-btn"
              data-audience-action="settings"
            >
              إعدادات الذكاء
            </button>

            <button
              class="
                ez-audience-btn
                primary
              "
              data-audience-action="new"
            >
              + إضافة جمهور
            </button>

          </div>

        </div>

        <div
          class="ez-audience-metrics"
        >

          ${metric(
            "إجمالي الجمهور",
            m.total
          )}

          ${metric(
            "النشط",
            m.active
          )}

          ${metric(
            "الأعضاء",
            m.members
          )}

          ${metric(
            "المشتركون",
            m.subscribers
          )}

          ${metric(
            "النشرات",
            m.newsletter
          )}

          ${metric(
            "التنبيهات",
            m.notifications
          )}

          ${metric(
            "المتفاعلون",
            m.engaged
          )}

        </div>

        <div
          class="ez-audience-tabs"
        >

          ${tab(
            "overview",
            "الجمهور"
          )}

          ${tab(
            "segments",
            "الشرائح الذكية"
          )}

          ${tab(
            "settings",
            "التخصيص"
          )}

        </div>

        ${
          state.activeTab ===
          "overview"
            ? renderOverview()
            : state.activeTab ===
              "segments"
            ? renderSegments()
            : renderSettings()
        }

      </div>

      <div
        id="ez-audience-modal"
        class="ez-audience-modal"
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
          ez-audience-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-audience-tab="${escapeHtml(
          key
        )}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function renderOverview() {
    const audiences =
      filteredAudiences();

    return `
      <div
        class="ez-audience-toolbar"
      >

        <input
          id="ez-audience-search"
          class="ez-audience-input"
          placeholder="ابحث عن عضو أو اهتمام..."
          value="${escapeHtml(
            state.search
          )}"
        />

        <select
          id="ez-audience-type"
          class="ez-audience-select"
        >

          <option value="all">
            كل الأنواع
          </option>

          ${Object.entries(
            SEGMENT_TYPES
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
          id="ez-audience-status"
          class="ez-audience-select"
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
          class="ez-audience-btn"
          data-audience-action="clear"
        >
          مسح
        </button>

      </div>

      <div
        class="ez-audience-grid"
      >

        ${
          audiences.length
            ? audiences
                .map(
                  renderAudienceCard
                )
                .join("")
            : `
              <div
                class="ez-audience-empty"
              >
                <strong>
                  لا توجد بيانات جمهور.
                </strong>

                <p>
                  أضف بيانات أو اربط هذه الوحدة
                  بخدمة العضويات في Backend.
                </p>
              </div>
            `
        }

      </div>
    `;
  }

  function renderAudienceCard(
    item
  ) {
    const statusClass =
      item.status ===
      "active"
        ? "success"
        : item.status ===
          "blocked"
        ? "danger"
        : "warning";

    return `
      <article
        class="ez-audience-card"
      >

        <div
          class="ez-audience-card-top"
        >

          <div>

            <h3>
              ${escapeHtml(
                item.name
              )}
            </h3>

            <div
              class="
                ez-audience-badges
              "
            >

              <span
                class="
                  ez-audience-badge
                "
              >
                ${escapeHtml(
                  SEGMENT_TYPES[
                    item.type
                  ] ||
                    item.type
                )}
              </span>

              <span
                class="
                  ez-audience-badge
                  ${statusClass}
                "
              >
                ${escapeHtml(
                  STATUS[
                    item.status
                  ] ||
                    item.status
                )}
              </span>

            </div>

          </div>

        </div>

        ${
          item.email
            ? `
              <div
                style="
                  color:#6f8795;
                  font-size:12px;
                  direction:ltr;
                  text-align:right;
                  word-break:break-all;
                "
              >
                ${escapeHtml(
                  item.email
                )}
              </div>
            `
            : ""
        }

        <div
          class="ez-audience-info"
        >

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              المشاهدات
            </span>
            <strong>
              ${Number(
                item.views
              ).toLocaleString(
                "ar-SA"
              )}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              المشاركات
            </span>
            <strong>
              ${Number(
                item.shares
              ).toLocaleString(
                "ar-SA"
              )}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              التعليقات
            </span>
            <strong>
              ${Number(
                item.comments
              ).toLocaleString(
                "ar-SA"
              )}
            </strong>
          </div>

        </div>

        <div
          style="
            color:#718997;
            font-size:11px;
          "
        >
          الدولة:
          ${escapeHtml(
            item.country
          )}
          ·
          اللغة:
          ${escapeHtml(
            item.language
          )}
        </div>

        <div
          class="
            ez-audience-interests
          "
        >

          ${
            item.interests
              .slice(0, 8)
              .map(
                (interest) => `
                  <span
                    class="
                      ez-audience-interest
                    "
                  >
                    ${escapeHtml(
                      interest
                    )}
                  </span>
                `
              )
              .join("") ||
            `
              <span
                class="
                  ez-audience-interest
                "
              >
                لا توجد اهتمامات
              </span>
            `
          }

        </div>

        <div
          class="
            ez-audience-card-actions
          "
        >

          <button
            class="
              ez-audience-small
            "
            data-audience-action="details"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            التفاصيل
          </button>

          <button
            class="
              ez-audience-small
            "
            data-audience-action="edit"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            تعديل
          </button>

          <button
            class="
              ez-audience-small
              danger
            "
            data-audience-action="delete"
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

  function renderSegments() {
    return `
      <div
        class="ez-audience-panel"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:12px;
            align-items:center;
            margin-bottom:15px;
          "
        >

          <div>
            <h3
              style="
                margin:0 0 5px;
              "
            >
              الشرائح الذكية
            </h3>

            <div
              style="
                color:#718997;
                font-size:12px;
              "
            >
              تقسيم الجمهور بناءً على الاهتمامات
              والسلوك والعضوية.
            </div>
          </div>

          <button
            class="
              ez-audience-btn
              primary
            "
            data-audience-action="new-segment"
          >
            + شريحة جديدة
          </button>

        </div>

        <div
          class="ez-audience-grid"
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
                  class="
                    ez-audience-empty
                  "
                >
                  لا توجد شرائح ذكية حتى الآن.
                </div>
              `
          }

        </div>

      </div>
    `;
  }

  function renderSegment(
    segment
  ) {
    return `
      <div
        class="ez-audience-card"
      >

        <h3>
          ${escapeHtml(
            segment.name
          )}
        </h3>

        <p
          style="
            color:#718997;
            line-height:1.8;
          "
        >
          ${escapeHtml(
            segment.description
          )}
        </p>

        <div
          class="
            ez-audience-badges
          "
        >

          <span
            class="
              ez-audience-badge
            "
          >
            ${escapeHtml(
              SEGMENT_TYPES[
                segment.type
              ] ||
                segment.type
            )}
          </span>

          <span
            class="
              ez-audience-badge
              ${
                segment.active
                  ? "success"
                  : "danger"
              }
            "
          >
            ${
              segment.active
                ? "نشطة"
                : "متوقفة"
            }
          </span>

        </div>

        <div
          class="ez-audience-info"
        >

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              الأعضاء
            </span>

            <strong>
              ${Number(
                segment.members
              ).toLocaleString(
                "ar-SA"
              )}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              القواعد
            </span>

            <strong>
              ${segment.rules.length}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              الحالة
            </span>

            <strong>
              ${
                segment.active
                  ? "نشطة"
                  : "متوقفة"
              }
            </strong>
          </div>

        </div>

        <div
          class="
            ez-audience-card-actions
          "
        >

          <button
            class="
              ez-audience-small
            "
            data-audience-action="segment-details"
            data-id="${escapeHtml(
              segment.id
            )}"
          >
            التفاصيل
          </button>

          <button
            class="
              ez-audience-small
            "
            data-audience-action="toggle-segment"
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
              ez-audience-small
              danger
            "
            data-audience-action="delete-segment"
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

  function renderSettings() {
    return `
      <div
        class="ez-audience-panel"
      >

        <h3>
          التخصيص والذكاء
        </h3>

        <p
          style="
            color:#718997;
            line-height:1.8;
          "
        >
          هذه الإعدادات تحدد طريقة استخدام
          منظومة الجمهور للتخصيص والتوصيات.
          لا يتم اعتبار أي بيانات تجريبية
          بيانات حقيقية للمستخدمين.
        </p>

        <div
          class="ez-audience-settings"
        >

          ${settingCheck(
            "التخصيص الذكي",
            "personalizationEnabled"
          )}

          ${settingCheck(
            "التوصيات",
            "recommendationsEnabled"
          )}

          ${settingCheck(
            "تنبيهات الجمهور",
            "notificationsEnabled"
          )}

          ${settingCheck(
            "الشرائح الذكية",
            "smartSegmentsEnabled"
          )}

          ${settingCheck(
            "التحليلات المجهولة",
            "anonymousAnalytics"
          )}

        </div>

        <div
          style="
            margin-top:18px;
            padding:15px;
            border-radius:15px;
            background:#effbff;
            line-height:1.9;
            color:#286d82;
          "
        >
          <strong>
            المحرك المستقبلي:
          </strong>

          يمكن ربط هذه الوحدة لاحقًا مع
          المحتوى وAI والتوصيات والإشعارات
          والتحليلات لتخصيص تجربة كل زائر
          دون جعل الواجهة الحالية تدّعي وجود
          بيانات غير متوفرة.
        </div>

      </div>
    `;
  }

  function settingCheck(
    label,
    key
  ) {
    return `
      <label
        class="
          ez-audience-check
        "
      >

        <input
          type="checkbox"
          data-audience-setting="${escapeHtml(
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
        "#ez-audience-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div
        class="ez-audience-dialog"
      >

        <div
          class="
            ez-audience-dialog-head
          "
        >

          <strong>
            ${escapeHtml(
              title
            )}
          </strong>

          <button
            class="
              ez-audience-btn
            "
            data-audience-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="
            ez-audience-dialog-body
          "
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-audience-dialog-footer
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
        "#ez-audience-modal"
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

  function openAudienceForm(
    existing = null
  ) {
    const item =
      normalizeAudience(
        existing || {}
      );

    const edit =
      Boolean(existing);

    openModal(
      edit
        ? "تعديل بيانات الجمهور"
        : "إضافة جمهور",
      `
        <form
          id="ez-audience-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              item.id
            )}"
          />

          <div
            class="
              ez-audience-form
            "
          >

            <div
              class="
                ez-audience-field
              "
            >

              <label>
                الاسم
              </label>

              <input
                class="
                  ez-audience-input
                "
                name="name"
                required
                value="${escapeHtml(
                  item.name
                )}"
              />

            </div>

            <div
              class="
                ez-audience-field
              "
            >

              <label>
                البريد
              </label>

              <input
                class="
                  ez-audience-input
                "
                name="email"
                type="email"
                dir="ltr"
                value="${escapeHtml(
                  item.email
                )}"
              />

            </div>

            <div
              class="
                ez-audience-field
              "
            >

              <label>
                النوع
              </label>

              <select
                class="
                  ez-audience-select
                "
                name="type"
              >

                ${Object.entries(
                  SEGMENT_TYPES
                )
                  .filter(
                    ([key]) =>
                      key !==
                      "all"
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
                ez-audience-field
              "
            >

              <label>
                الحالة
              </label>

              <select
                class="
                  ez-audience-select
                "
                name="status"
              >

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
              class="
                ez-audience-field
              "
            >

              <label>
                الدولة
              </label>

              <input
                class="
                  ez-audience-input
                "
                name="country"
                value="${escapeHtml(
                  item.country
                )}"
              />

            </div>

            <div
              class="
                ez-audience-field
              "
            >

              <label>
                اللغة
              </label>

              <input
                class="
                  ez-audience-input
                "
                name="language"
                value="${escapeHtml(
                  item.language
                )}"
              />

            </div>

            <div
              class="
                ez-audience-field full
              "
            >

              <label>
                الاهتمامات
              </label>

              <input
                class="
                  ez-audience-input
                "
                name="interests"
                value="${escapeHtml(
                  item.interests.join(
                    ", "
                  )
                )}"
                placeholder="أخبار، تقنية، رياضة..."
              />

            </div>

            <div
              class="
                ez-audience-field full
              "
            >

              <div
                class="
                  ez-audience-settings
                "
              >

                <label
                  class="
                    ez-audience-check
                  "
                >
                  <input
                    type="checkbox"
                    name="notifications"
                    ${
                      item.notifications
                        ? "checked"
                        : ""
                    }
                  />
                  استقبال التنبيهات
                </label>

                <label
                  class="
                    ez-audience-check
                  "
                >
                  <input
                    type="checkbox"
                    name="newsletter"
                    ${
                      item.newsletter
                        ? "checked"
                        : ""
                    }
                  />
                  الاشتراك في النشرة
                </label>

              </div>

            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-audience-btn"
          data-audience-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-audience-btn
            primary
          "
          data-audience-action="save-audience"
        >
          ${
            edit
              ? "حفظ التعديلات"
              : "إضافة الجمهور"
          }
        </button>
      `
    );
  }

  function saveAudience() {
    const form =
      document.querySelector(
        "#ez-audience-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const audience =
      normalizeAudience({
        id:
          data.get("id"),

        name:
          String(
            data.get("name") ||
              ""
          ).trim(),

        email:
          String(
            data.get("email") ||
              ""
          ).trim(),

        type:
          data.get("type") ||
          "visitor",

        status:
          data.get("status") ||
          "active",

        country:
          String(
            data.get("country") ||
              "SA"
          ).trim(),

        language:
          String(
            data.get("language") ||
              "ar"
          ).trim(),

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

        notifications:
          data.has(
            "notifications"
          ),

        newsletter:
          data.has(
            "newsletter"
          )
      });

    if (!audience.name) {
      notify(
        "اسم الجمهور مطلوب.",
        "warning"
      );

      return;
    }

    const index =
      state.audiences.findIndex(
        (item) =>
          String(item.id) ===
          String(audience.id)
      );

    if (index >= 0) {
      state.audiences[
        index
      ] = {
        ...state.audiences[
          index
        ],
        ...audience,
        updatedAt:
          new Date().toISOString()
      };
    } else {
      state.audiences.unshift(
        audience
      );
    }

    save();

    closeModal();

    render();

    notify(
      index >= 0
        ? "تم تحديث الجمهور."
        : "تمت إضافة الجمهور.",
      "success"
    );
  }

  function details(id) {
    const item =
      state.audiences.find(
        (audience) =>
          String(
            audience.id
          ) === String(id)
      );

    if (!item) {
      return;
    }

    openModal(
      "تفاصيل الجمهور",
      `
        <h2>
          ${escapeHtml(
            item.name
          )}
        </h2>

        <div
          class="ez-audience-badges"
        >

          <span
            class="
              ez-audience-badge
            "
          >
            ${escapeHtml(
              SEGMENT_TYPES[
                item.type
              ] ||
                item.type
            )}
          </span>

          <span
            class="
              ez-audience-badge
              success
            "
          >
            ${escapeHtml(
              STATUS[
                item.status
              ] ||
                item.status
            )}
          </span>

        </div>

        <div
          class="ez-audience-info"
        >

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              المشاهدات
            </span>
            <strong>
              ${item.views}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              المشاركات
            </span>
            <strong>
              ${item.shares}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              الحفظ
            </span>
            <strong>
              ${item.saves}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              التعليقات
            </span>
            <strong>
              ${item.comments}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              الجلسات
            </span>
            <strong>
              ${item.sessions}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              التنبيهات
            </span>
            <strong>
              ${
                item.notifications
                  ? "مفعلة"
                  : "متوقفة"
              }
            </strong>
          </div>

        </div>

        <h3>
          الاهتمامات
        </h3>

        <div
          class="
            ez-audience-interests
          "
        >

          ${
            item.interests
              .map(
                (interest) => `
                  <span
                    class="
                      ez-audience-interest
                    "
                  >
                    ${escapeHtml(
                      interest
                    )}
                  </span>
                `
              )
              .join("") ||
            "لا توجد اهتمامات."
          }

        </div>
      `,
      `
        <button
          class="ez-audience-btn"
          data-audience-action="close"
        >
          إغلاق
        </button>

        <button
          class="
            ez-audience-btn
            primary
          "
          data-audience-action="edit"
          data-id="${escapeHtml(
            item.id
          )}"
        >
          تعديل
        </button>
      `
    );
  }

  function deleteAudience(id) {
    const item =
      state.audiences.find(
        (audience) =>
          String(
            audience.id
          ) === String(id)
      );

    if (!item) {
      return;
    }

    if (
      !window.confirm(
        "هل تريد حذف سجل الجمهور؟"
      )
    ) {
      return;
    }

    state.audiences =
      state.audiences.filter(
        (audience) =>
          String(
            audience.id
          ) !== String(id)
      );

    save();

    render();

    notify(
      "تم حذف السجل.",
      "success"
    );
  }

  function openSegmentForm() {
    openModal(
      "إنشاء شريحة جمهور ذكية",
      `
        <form
          id="ez-audience-segment-form"
        >

          <div
            class="
              ez-audience-form
            "
          >

            <div
              class="
                ez-audience-field
              "
            >

              <label>
                اسم الشريحة
              </label>

              <input
                class="
                  ez-audience-input
                "
                name="name"
                required
                placeholder="جمهور الأخبار العاجلة"
              />

            </div>

            <div
              class="
                ez-audience-field
              "
            >

              <label>
                نوع الشريحة
              </label>

              <select
                class="
                  ez-audience-select
                "
                name="type"
              >

                ${Object.entries(
                  SEGMENT_TYPES
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
                ez-audience-field full
              "
            >

              <label>
                الوصف
              </label>

              <textarea
                class="
                  ez-audience-textarea
                "
                name="description"
                placeholder="وصف الشريحة..."
              ></textarea>

            </div>

            <div
              class="
                ez-audience-field full
              "
            >

              <label>
                الاهتمامات المطلوبة
              </label>

              <input
                class="
                  ez-audience-input
                "
                name="interests"
                placeholder="أخبار، تقنية، رياضة"
              />

            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-audience-btn"
          data-audience-action="close"
        >
          إلغاء
        </button>

        <button
          class="
            ez-audience-btn
            primary
          "
          data-audience-action="save-segment"
        >
          إنشاء الشريحة
        </button>
      `
    );
  }

  function saveSegment() {
    const form =
      document.querySelector(
        "#ez-audience-segment-form"
      );

    if (!form) {
      return;
    }

    const data =
      new FormData(form);

    const interests =
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
        .filter(Boolean);

    const segment =
      normalizeSegment({
        name:
          String(
            data.get("name") ||
              ""
          ).trim(),

        description:
          String(
            data.get(
              "description"
            ) || ""
          ).trim(),

        type:
          data.get("type") ||
          "all",

        rules:
          interests.map(
            (interest) => ({
              field:
                "interest",

              operator:
                "contains",

              value:
                interest
            })
          ),

        members:
          calculateSegmentMembers(
            interests
          )
      });

    if (!segment.name) {
      notify(
        "اسم الشريحة مطلوب.",
        "warning"
      );

      return;
    }

    state.segments.unshift(
      segment
    );

    save();

    closeModal();

    render();

    notify(
      "تم إنشاء الشريحة الذكية.",
      "success"
    );
  }

  function calculateSegmentMembers(
    interests
  ) {
    if (
      !interests.length
    ) {
      return state.audiences.length;
    }

    return state.audiences.filter(
      (audience) =>
        interests.some(
          (interest) =>
            audience.interests
              .map(
                (item) =>
                  item.toLowerCase()
              )
              .includes(
                interest.toLowerCase()
              )
        )
    ).length;
  }

  function toggleSegment(id) {
    const segment =
      state.segments.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!segment) {
      return;
    }

    segment.active =
      !segment.active;

    segment.updatedAt =
      new Date().toISOString();

    save();

    render();

    notify(
      segment.active
        ? "تم تفعيل الشريحة."
        : "تم إيقاف الشريحة.",
      "success"
    );
  }

  function deleteSegment(id) {
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
          String(item.id) !==
          String(id)
      );

    save();

    render();

    notify(
      "تم حذف الشريحة.",
      "success"
    );
  }

  function segmentDetails(id) {
    const segment =
      state.segments.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!segment) {
      return;
    }

    openModal(
      "تفاصيل شريحة الجمهور",
      `
        <h2>
          ${escapeHtml(
            segment.name
          )}
        </h2>

        <p
          style="
            color:#718997;
            line-height:1.9;
          "
        >
          ${escapeHtml(
            segment.description
          )}
        </p>

        <div
          class="ez-audience-info"
        >

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              النوع
            </span>

            <strong>
              ${escapeHtml(
                SEGMENT_TYPES[
                  segment.type
                ] ||
                  segment.type
              )}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              الأعضاء
            </span>

            <strong>
              ${segment.members}
            </strong>
          </div>

          <div
            class="
              ez-audience-info-item
            "
          >
            <span>
              القواعد
            </span>

            <strong>
              ${segment.rules.length}
            </strong>
          </div>

        </div>

        <h3>
          قواعد الشريحة
        </h3>

        <div
          class="
            ez-audience-interests
          "
        >

          ${
            segment.rules
              .map(
                (rule) => `
                  <span
                    class="
                      ez-audience-interest
                    "
                  >
                    ${escapeHtml(
                      rule.value
                    )}
                  </span>
                `
              )
              .join("") ||
            "لا توجد قواعد."
          }

        </div>
      `,
      `
        <button
          class="ez-audience-btn"
          data-audience-action="close"
        >
          إغلاق
        </button>
      `
    );
  }

  function seed() {
    const samples = [
      {
        name:
          "زائر الأخبار",

        email:
          "visitor@example.com",

        type:
          "visitor",

        status:
          "active",

        interests: [
          "أخبار",
          "عاجل",
          "محليات"
        ],

        views:
          18,

        shares:
          2,

        comments:
          1,

        saves:
          4,

        sessions:
          6,

        newsletter:
          false
      },

      {
        name:
          "عضو إعلامي",

        email:
          "member@example.com",

        type:
          "journalist",

        status:
          "active",

        interests: [
          "إعلام",
          "تقنية",
          "تقارير"
        ],

        views:
          46,

        shares:
          11,

        comments:
          7,

        saves:
          14,

        sessions:
          15,

        newsletter:
          true
      },

      {
        name:
          "مشترك التقنية",

        email:
          "tech@example.com",

        type:
          "subscriber",

        status:
          "active",

        interests: [
          "تقنية",
          "ذكاء اصطناعي",
          "أمن سيبراني"
        ],

        views:
          81,

        shares:
          17,

        comments:
          12,

        saves:
          25,

        sessions:
          22,

        newsletter:
          true
      },

      {
        name:
          "جمهور رياضي",

        email:
          "sports@example.com",

        type:
          "sports",

        status:
          "active",

        interests: [
          "رياضة",
          "كرة قدم"
        ],

        views:
          63,

        shares:
          9,

        comments:
          8,

        saves:
          18,

        sessions:
          19,

        newsletter:
          true
      }
    ];

    samples.forEach(
      (item) => {
        state.audiences.push(
          normalizeAudience(
            item
          )
        );
      }
    );

    save();

    render();

    notify(
      "تمت إضافة بيانات تجريبية.",
      "success"
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
        "#audience-command-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-audience-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .audienceTab;

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-audience-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .audienceAction;

              const idValue =
                button.dataset.id;

              if (
                action ===
                "seed"
              ) {
                seed();
                return;
              }

              if (
                action ===
                "new"
              ) {
                openAudienceForm();
                return;
              }

              if (
                action ===
                "settings"
              ) {
                state.activeTab =
                  "settings";
                render();
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
                "details"
              ) {
                details(
                  idValue
                );
                return;
              }

              if (
                action ===
                "edit"
              ) {
                const item =
                  state.audiences.find(
                    (audience) =>
                      String(
                        audience.id
                      ) ===
                      String(
                        idValue
                      )
                  );

                if (item) {
                  openAudienceForm(
                    item
                  );
                }

                return;
              }

              if (
                action ===
                "delete"
              ) {
                deleteAudience(
                  idValue
                );
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
                "save-audience"
              ) {
                saveAudience();
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
                "segment-details"
              ) {
                segmentDetails(
                  idValue
                );
                return;
              }

              if (
                action ===
                "toggle-segment"
              ) {
                toggleSegment(
                  idValue
                );
                return;
              }

              if (
                action ===
                "delete-segment"
              ) {
                deleteSegment(
                  idValue
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
        "#ez-audience-search"
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
        "#ez-audience-type"
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
        "#ez-audience-status"
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
        "[data-audience-setting]"
      )
      .forEach(
        (input) => {
          input.addEventListener(
            "change",
            (event) => {
              const key =
                input.dataset
                  .audienceSetting;

              state.settings[key] =
                event.target.checked;

              save();

              notify(
                "تم تحديث إعدادات الجمهور.",
                "success"
              );
            }
          );
        }
      );

    const modal =
      document.querySelector(
        "#ez-audience-modal"
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
        "#audience-command-section"
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

  function addAudience(
    audience
  ) {
    const item =
      normalizeAudience(
        audience || {}
      );

    state.audiences.unshift(
      item
    );

    save();

    render();

    return item;
  }

  function addSegment(
    segment
  ) {
    const item =
      normalizeSegment(
        segment || {}
      );

    state.segments.unshift(
      item
    );

    save();

    render();

    return item;
  }

  function getAudiences() {
    return clone(
      state.audiences
    );
  }

  function getSegments() {
    return clone(
      state.segments
    );
  }

  function getSettings() {
    return clone(
      state.settings
    );
  }

  window.EZMediaAdminAudienceCommand =
    {
      module: MODULE,
      show,
      hide,
      refresh,
      addAudience,
      addSegment,
      getAudiences,
      getSegments,
      getSettings
    };

  window.addEventListener(
    "ezmedia:audience:refresh",
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
          "audience-command" ||
        section ===
          "audience" ||
        section ===
          "members"
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
    "EZ MEDIA 11.0 — Audience Command loaded."
  );
})();
