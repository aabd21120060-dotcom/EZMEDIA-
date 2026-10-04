"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 28
 * الملف: public/admin-source-command.js
 *
 * مركز إدارة المصادر والموصلات الذكية
 *
 * يدير:
 * - المصادر الرسمية
 * - RSS
 * - APIs
 * - غرف الأخبار
 * - المصادر الداخلية
 * - المصادر الاجتماعية
 * - مصادر البث
 * - حالة المصدر
 * - الأولوية
 * - الموثوقية
 * - اختبار المصدر
 * - تفعيل / إيقاف المصدر
 * - ربط المصدر بالأتمتة
 * - ربط المصدر بمحرك الذكاء الاصطناعي
 *
 * ملاحظة:
 * اختبار المصدر من الواجهة لا يعني أن المصدر تم جلب
 * بياناته فعليًا من الإنترنت.
 * التنفيذ الحقيقي للـfetch / RSS / API يجب أن يتم
 * من Backend Connector آمن في الخادم.
 */

(function () {
  "use strict";

  const MODULE = "source-command";

  const STORAGE_KEY =
    "ezmedia_source_command_v1";

  const TYPES = {
    official: "مصدر رسمي",
    agency: "وكالة أنباء",
    newsroom: "غرفة أخبار",
    rss: "RSS",
    api: "API",
    social: "منصة اجتماعية",
    internal: "مصدر داخلي",
    broadcast: "مصدر بث",
    other: "أخرى"
  };

  const STATUSES = {
    active: "نشط",
    paused: "متوقف مؤقتًا",
    disabled: "معطل",
    pending: "قيد الإعداد",
    error: "خطأ"
  };

  const PRIORITIES = {
    low: "منخفضة",
    normal: "عادية",
    high: "مرتفعة",
    critical: "حرجة"
  };

  const TRUST = {
    unverified: "غير موثق",
    pending: "قيد التحقق",
    verified: "موثق",
    official: "رسمي"
  };

  const state = {
    sources: [],
    selected: null,
    search: "",
    type: "all",
    status: "all",
    priority: "all",
    trust: "all",
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

  function formatDate(value) {
    if (!value) {
      return "غير محدد";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "غير محدد";
    }

    return date.toLocaleString("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    });
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
            title: "مركز المصادر",
            message
          }
        }
      )
    );

    const toast =
      document.querySelector(
        "#ez-source-command-toast"
      );

    if (!toast) {
      return;
    }

    toast.textContent = message;

    toast.dataset.type = type;

    toast.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
      toast.classList.remove(
        "show"
      );
    }, 3200);
  }

  function loadLocalSources() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        state.sources = [];
        return;
      }

      const parsed =
        JSON.parse(raw);

      state.sources =
        Array.isArray(parsed)
          ? parsed
          : [];
    } catch (error) {
      console.warn(
        "EZ MEDIA source storage:",
        error
      );

      state.sources = [];
    }
  }

  function saveLocalSources() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state.sources
        )
      );
    } catch (error) {
      console.warn(
        "EZ MEDIA source save:",
        error
      );
    }
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
      "source-" +
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  function normalizeSource(source) {
    return {
      id:
        source.id ||
        createId(),

      name:
        source.name ||
        "مصدر بدون اسم",

      type:
        source.type ||
        "other",

      status:
        source.status ||
        "pending",

      priority:
        source.priority ||
        "normal",

      trust:
        source.trust ||
        "unverified",

      url:
        source.url ||
        "",

      endpoint:
        source.endpoint ||
        "",

      description:
        source.description ||
        "",

      category:
        source.category ||
        "عام",

      language:
        source.language ||
        "ar",

      country:
        source.country ||
        "SA",

      enabledForAI:
        source.enabledForAI !== false,

      enabledForAutomation:
        source.enabledForAutomation !==
        false,

      enabledForBreaking:
        Boolean(
          source.enabledForBreaking
        ),

      fetchInterval:
        Number(
          source.fetchInterval ||
            15
        ),

      lastTest:
        source.lastTest ||
        null,

      lastStatus:
        source.lastStatus ||
        "لم يتم الاختبار",

      createdAt:
        source.createdAt ||
        new Date().toISOString(),

      updatedAt:
        source.updatedAt ||
        new Date().toISOString()
    };
  }

  function ensureSection() {
    let section =
      document.querySelector(
        "#source-command-section"
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
      "source-command-section";

    section.hidden = true;

    parent.appendChild(section);

    return section;
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-source-command-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-source-command-styles";

    style.textContent = `
      #source-command-section {
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

      .ez-source-shell {
        max-width: 1600px;
        margin: auto;
      }

      .ez-source-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 22px;
        border-radius: 24px;
        background:
          linear-gradient(
            135deg,
            #edfaff,
            #ffffff
          );
        border: 1px solid #d9edf5;
      }

      .ez-source-header h2 {
        margin: 0 0 7px;
        font-size: 28px;
      }

      .ez-source-header p {
        margin: 0;
        color: #6e8797;
        line-height: 1.8;
      }

      .ez-source-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-source-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #eaf8fd;
        color: #176984;
        font-weight: 800;
      }

      .ez-source-btn.primary {
        background: #31b4d6;
        color: white;
      }

      .ez-source-btn.success {
        background: #eefaf5;
        color: #237052;
      }

      .ez-source-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-source-metrics {
        display: grid;
        grid-template-columns:
          repeat(7, minmax(0, 1fr));
        gap: 11px;
        margin: 18px 0;
      }

      .ez-source-metric {
        background: white;
        border: 1px solid #dfedf2;
        border-radius: 17px;
        padding: 15px;
      }

      .ez-source-metric span {
        display: block;
        color: #71899a;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .ez-source-metric strong {
        font-size: 23px;
      }

      .ez-source-toolbar {
        display: grid;
        grid-template-columns:
          minmax(230px, 1fr)
          170px
          170px
          170px
          170px
          auto;
        gap: 8px;
        margin-bottom: 18px;
      }

      .ez-source-input,
      .ez-source-select,
      .ez-source-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        background: white;
        border-radius: 12px;
        padding: 12px 14px;
        color: #17384f;
        outline: none;
      }

      .ez-source-input:focus,
      .ez-source-select:focus,
      .ez-source-textarea:focus {
        border-color: #54c4e4;
        box-shadow:
          0 0 0 3px
          rgba(84, 196, 228, .12);
      }

      .ez-source-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 15px;
      }

      .ez-source-card {
        background: white;
        border: 1px solid #dfedf2;
        border-radius: 20px;
        padding: 18px;
        box-shadow:
          0 8px 28px
          rgba(27, 103, 128, .06);
      }

      .ez-source-card.official {
        border-color: #9edfee;
      }

      .ez-source-card.error {
        border-color: #f0bec7;
      }

      .ez-source-card-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
      }

      .ez-source-card h3 {
        margin: 0 0 6px;
        font-size: 18px;
      }

      .ez-source-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        background: #edf9fd;
        color: #176984;
        font-size: 11px;
        font-weight: 850;
        white-space: nowrap;
      }

      .ez-source-badge.success {
        background: #eefaf5;
        color: #237052;
      }

      .ez-source-badge.warning {
        background: #fff8e8;
        color: #8b671a;
      }

      .ez-source-badge.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-source-badge.gray {
        background: #f1f6f8;
        color: #617c8b;
      }

      .ez-source-card p {
        color: #718899;
        line-height: 1.75;
        font-size: 13px;
      }

      .ez-source-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 13px 0;
      }

      .ez-source-meta div {
        padding: 10px;
        border-radius: 10px;
        background: #f7fbfd;
        font-size: 12px;
      }

      .ez-source-switches {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 12px 0;
      }

      .ez-source-switch {
        padding: 7px 9px;
        border-radius: 9px;
        background: #f5fafc;
        color: #587585;
        font-size: 11px;
        font-weight: 750;
      }

      .ez-source-switch.enabled {
        background: #edf9f5;
        color: #277255;
      }

      .ez-source-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .ez-source-small-btn {
        border: 0;
        border-radius: 9px;
        padding: 7px 9px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 750;
      }

      .ez-source-empty {
        grid-column: 1 / -1;
        padding: 55px 20px;
        text-align: center;
        color: #718a99;
        border: 1px dashed #cfe6ed;
        border-radius: 20px;
      }

      .ez-source-modal {
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

      .ez-source-modal.open {
        display: flex;
      }

      .ez-source-dialog {
        width: min(1000px, 100%);
        max-height: 94vh;
        overflow: auto;
        background: white;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15, 72, 96, .22);
      }

      .ez-source-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 19px 21px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-source-dialog-body {
        padding: 21px;
      }

      .ez-source-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 15px 21px;
        border-top: 1px solid #e4eff3;
      }

      .ez-source-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 13px;
      }

      .ez-source-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ez-source-field.full {
        grid-column: 1 / -1;
      }

      .ez-source-field label {
        font-weight: 800;
        font-size: 13px;
      }

      .ez-source-test {
        padding: 18px;
        border-radius: 17px;
        background:
          linear-gradient(
            135deg,
            #f0fbff,
            #ffffff
          );
        border: 1px solid #d7edf4;
      }

      .ez-source-test strong {
        display: block;
        margin-bottom: 8px;
      }

      #ez-source-command-toast {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 100001;
        padding: 13px 17px;
        border-radius: 13px;
        background: #173f55;
        color: white;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition: .2s ease;
      }

      #ez-source-command-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 1250px) {
        .ez-source-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-source-metrics {
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
        }

        .ez-source-toolbar {
          grid-template-columns:
            1fr 1fr;
        }
      }

      @media (max-width: 750px) {
        #source-command-section {
          padding: 12px;
        }

        .ez-source-header {
          display: block;
        }

        .ez-source-actions {
          margin-top: 15px;
        }

        .ez-source-grid {
          grid-template-columns: 1fr;
        }

        .ez-source-metrics {
          grid-template-columns: 1fr 1fr;
        }

        .ez-source-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-source-form-grid {
          grid-template-columns: 1fr;
        }

        .ez-source-field.full {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function calculateMetrics() {
    const result = {
      total: state.sources.length,
      active: 0,
      paused: 0,
      disabled: 0,
      pending: 0,
      error: 0,
      official: 0
    };

    state.sources.forEach(
      (source) => {
        if (
          Object.prototype.hasOwnProperty.call(
            result,
            source.status
          )
        ) {
          result[source.status]++;
        }

        if (
          source.trust ===
            "official" ||
          source.trust ===
            "verified"
        ) {
          result.official++;
        }
      }
    );

    return result;
  }

  function filteredSources() {
    const search =
      state.search
        .trim()
        .toLowerCase();

    return state.sources.filter(
      (source) => {
        if (
          state.type !== "all" &&
          source.type !== state.type
        ) {
          return false;
        }

        if (
          state.status !== "all" &&
          source.status !==
            state.status
        ) {
          return false;
        }

        if (
          state.priority !== "all" &&
          source.priority !==
            state.priority
        ) {
          return false;
        }

        if (
          state.trust !== "all" &&
          source.trust !==
            state.trust
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const text = [
          source.name,
          source.type,
          source.description,
          source.category,
          source.country,
          source.language,
          source.url,
          source.endpoint
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(search);
      }
    );
  }

  function render() {
    const section =
      ensureSection();

    const metrics =
      calculateMetrics();

    const sources =
      filteredSources();

    section.innerHTML = `
      <div class="ez-source-shell">

        <div class="ez-source-header">

          <div>
            <h2>
              مركز المصادر والموصلات
            </h2>

            <p>
              إدارة المصادر التي يعتمد عليها
              نظام EZ MEDIA في جمع المعلومات
              والتحقق والأتمتة والذكاء الإعلامي.
            </p>
          </div>

          <div class="ez-source-actions">

            <button
              class="ez-source-btn"
              data-source-action="refresh"
            >
              تحديث
            </button>

            <button
              class="ez-source-btn"
              data-source-action="export"
            >
              تصدير القائمة
            </button>

            <button
              class="ez-source-btn primary"
              data-source-action="new"
            >
              + إضافة مصدر
            </button>

          </div>

        </div>

        <div class="ez-source-metrics">

          ${metric(
            "إجمالي المصادر",
            metrics.total
          )}

          ${metric(
            "نشطة",
            metrics.active
          )}

          ${metric(
            "متوقفة",
            metrics.paused
          )}

          ${metric(
            "معطلة",
            metrics.disabled
          )}

          ${metric(
            "قيد الإعداد",
            metrics.pending
          )}

          ${metric(
            "أخطاء",
            metrics.error
          )}

          ${metric(
            "موثقة/رسمية",
            metrics.official
          )}

        </div>

        <div class="ez-source-toolbar">

          <input
            id="ez-source-search"
            class="ez-source-input"
            placeholder="ابحث عن مصدر..."
            value="${escapeHtml(
              state.search
            )}"
          />

          <select
            id="ez-source-type"
            class="ez-source-select"
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
                    value="${key}"
                    ${
                      state.type === key
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
            id="ez-source-status"
            class="ez-source-select"
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
                    value="${key}"
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

          <select
            id="ez-source-priority"
            class="ez-source-select"
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
            id="ez-source-trust"
            class="ez-source-select"
          >
            <option value="all">
              كل درجات التوثيق
            </option>

            ${Object.entries(
              TRUST
            )
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${
                      state.trust === key
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
            class="ez-source-btn"
            data-source-action="clear"
          >
            مسح
          </button>

        </div>

        <div class="ez-source-grid">

          ${
            state.loading
              ? `
                <div class="ez-source-empty">
                  جاري تحميل المصادر...
                </div>
              `
              : sources.length
              ? sources
                  .map(renderSource)
                  .join("")
              : `
                <div class="ez-source-empty">

                  <strong>
                    لا توجد مصادر مطابقة.
                  </strong>

                  <p>
                    أضف مصدرًا جديدًا أو عدّل
                    خيارات البحث.
                  </p>

                </div>
              `
          }

        </div>

      </div>

      <div
        id="ez-source-command-modal"
        class="ez-source-modal"
        aria-hidden="true"
      ></div>

      <div id="ez-source-command-toast"></div>
    `;

    bindEvents();
  }

  function metric(
    label,
    value
  ) {
    return `
      <div class="ez-source-metric">

        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${escapeHtml(
            String(value ?? 0)
          )}
        </strong>

      </div>
    `;
  }

  function typeBadge(type) {
    return `
      <span class="ez-source-badge">
        ${escapeHtml(
          TYPES[type] ||
            type
        )}
      </span>
    `;
  }

  function statusBadge(status) {
    let cls = "gray";

    if (status === "active") {
      cls = "success";
    }

    if (
      status === "pending" ||
      status === "paused"
    ) {
      cls = "warning";
    }

    if (
      status === "error" ||
      status === "disabled"
    ) {
      cls = "danger";
    }

    return `
      <span
        class="ez-source-badge ${cls}"
      >
        ${escapeHtml(
          STATUSES[status] ||
            status
        )}
      </span>
    `;
  }

  function trustBadge(trust) {
    let cls = "gray";

    if (trust === "official") {
      cls = "success";
    }

    if (trust === "verified") {
      cls = "success";
    }

    if (trust === "pending") {
      cls = "warning";
    }

    return `
      <span
        class="ez-source-badge ${cls}"
      >
        ${escapeHtml(
          TRUST[trust] ||
            trust
        )}
      </span>
    `;
  }

  function renderSource(source) {
    const official =
      source.trust ===
      "official";

    return `
      <article
        class="
          ez-source-card
          ${official ? "official" : ""}
          ${
            source.status ===
            "error"
              ? "error"
              : ""
          }
        "
      >

        <div class="ez-source-card-top">

          <div>

            <h3>
              ${escapeHtml(
                source.name
              )}
            </h3>

            ${typeBadge(
              source.type
            )}

          </div>

          <div>
            ${statusBadge(
              source.status
            )}
          </div>

        </div>

        <p>
          ${escapeHtml(
            source.description ||
              "لا يوجد وصف للمصدر."
          )}
        </p>

        <div class="ez-source-meta">

          <div>
            <strong>
              الأولوية
            </strong>

            <br>

            ${escapeHtml(
              PRIORITIES[
                source.priority
              ] ||
                source.priority
            )}
          </div>

          <div>
            <strong>
              التوثيق
            </strong>

            <br>

            ${trustBadge(
              source.trust
            )}
          </div>

          <div>
            <strong>
              الفئة
            </strong>

            <br>

            ${escapeHtml(
              source.category
            )}
          </div>

          <div>
            <strong>
              التحديث
            </strong>

            <br>

            كل
            ${escapeHtml(
              String(
                source.fetchInterval
              )
            )}
            دقيقة
          </div>

        </div>

        <div class="ez-source-switches">

          <span
            class="
              ez-source-switch
              ${
                source.enabledForAI
                  ? "enabled"
                  : ""
              }
            "
          >
            AI:
            ${
              source.enabledForAI
                ? "مفعل"
                : "متوقف"
            }
          </span>

          <span
            class="
              ez-source-switch
              ${
                source.enabledForAutomation
                  ? "enabled"
                  : ""
              }
            "
          >
            الأتمتة:
            ${
              source.enabledForAutomation
                ? "مفعلة"
                : "متوقفة"
            }
          </span>

          <span
            class="
              ez-source-switch
              ${
                source.enabledForBreaking
                  ? "enabled"
                  : ""
              }
            "
          >
            عاجل:
            ${
              source.enabledForBreaking
                ? "مفعل"
                : "متوقف"
            }
          </span>

        </div>

        <p>
          آخر اختبار:
          ${escapeHtml(
            formatDate(
              source.lastTest
            )
          )}

          <br>

          النتيجة:
          ${escapeHtml(
            source.lastStatus
          )}
        </p>

        <div class="ez-source-card-actions">

          <button
            class="ez-source-small-btn"
            data-source-action="open"
            data-id="${escapeHtml(
              source.id
            )}"
          >
            التفاصيل
          </button>

          <button
            class="ez-source-small-btn"
            data-source-action="test"
            data-id="${escapeHtml(
              source.id
            )}"
          >
            اختبار
          </button>

          <button
            class="ez-source-small-btn"
            data-source-action="edit"
            data-id="${escapeHtml(
              source.id
            )}"
          >
            تعديل
          </button>

          ${
            source.status ===
            "active"
              ? `
                <button
                  class="ez-source-small-btn"
                  data-source-action="pause"
                  data-id="${escapeHtml(
                    source.id
                  )}"
                >
                  إيقاف
                </button>
              `
              : `
                <button
                  class="ez-source-small-btn"
                  data-source-action="activate"
                  data-id="${escapeHtml(
                    source.id
                  )}"
                >
                  تفعيل
                </button>
              `
          }

          <button
            class="ez-source-small-btn"
            data-source-action="delete"
            data-id="${escapeHtml(
              source.id
            )}"
          >
            حذف
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
        "#ez-source-command-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div class="ez-source-dialog">

        <div class="ez-source-dialog-header">

          <strong>
            ${escapeHtml(title)}
          </strong>

          <button
            class="ez-source-btn"
            data-source-action="close"
          >
            إغلاق
          </button>

        </div>

        <div class="ez-source-dialog-body">
          ${body}
        </div>

        ${
          footer
            ? `
              <div class="ez-source-dialog-footer">
                ${footer}
              </div>
            `
            : ""
        }

      </div>
    `;

    modal.classList.add("open");

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    bindEvents();
  }

  function closeModal() {
    const modal =
      document.querySelector(
        "#ez-source-command-modal"
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

  function openCreate() {
    openModal(
      "إضافة مصدر جديد",
      `
        <form id="ez-source-create-form">

          <div class="ez-source-form-grid">

            <div
              class="
                ez-source-field
                full
              "
            >
              <label>
                اسم المصدر
              </label>

              <input
                class="ez-source-input"
                name="name"
                required
                placeholder="مثال: مصدر رسمي"
              />
            </div>

            <div class="ez-source-field">
              <label>
                نوع المصدر
              </label>

              <select
                class="ez-source-select"
                name="type"
              >
                ${Object.entries(
                  TYPES
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

            <div class="ez-source-field">
              <label>
                الحالة
              </label>

              <select
                class="ez-source-select"
                name="status"
              >
                ${Object.entries(
                  STATUSES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          key ===
                          "pending"
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

            <div class="ez-source-field">
              <label>
                الأولوية
              </label>

              <select
                class="ez-source-select"
                name="priority"
              >
                ${Object.entries(
                  PRIORITIES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          key ===
                          "normal"
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

            <div class="ez-source-field">
              <label>
                درجة التوثيق
              </label>

              <select
                class="ez-source-select"
                name="trust"
              >
                ${Object.entries(
                  TRUST
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

            <div
              class="
                ez-source-field
                full
              "
            >
              <label>
                الرابط الرئيسي
              </label>

              <input
                class="ez-source-input"
                name="url"
                placeholder="https://..."
              />
            </div>

            <div
              class="
                ez-source-field
                full
              "
            >
              <label>
                API / RSS Endpoint
              </label>

              <input
                class="ez-source-input"
                name="endpoint"
                placeholder="https://..."
              />
            </div>

            <div class="ez-source-field">
              <label>
                الفئة
              </label>

              <input
                class="ez-source-input"
                name="category"
                value="عام"
              />
            </div>

            <div class="ez-source-field">
              <label>
                اللغة
              </label>

              <input
                class="ez-source-input"
                name="language"
                value="ar"
              />
            </div>

            <div class="ez-source-field">
              <label>
                الدولة
              </label>

              <input
                class="ez-source-input"
                name="country"
                value="SA"
              />
            </div>

            <div class="ez-source-field">
              <label>
                فترة التحديث بالدقائق
              </label>

              <input
                class="ez-source-input"
                type="number"
                min="1"
                max="1440"
                name="fetchInterval"
                value="15"
              />
            </div>

            <div
              class="
                ez-source-field
                full
              "
            >
              <label>
                الوصف
              </label>

              <textarea
                class="ez-source-textarea"
                name="description"
                rows="5"
              ></textarea>
            </div>

            <div class="ez-source-field">
              <label>
                الذكاء الاصطناعي
              </label>

              <select
                class="ez-source-select"
                name="enabledForAI"
              >
                <option value="true">
                  مفعل
                </option>

                <option value="false">
                  متوقف
                </option>
              </select>
            </div>

            <div class="ez-source-field">
              <label>
                الأتمتة
              </label>

              <select
                class="ez-source-select"
                name="enabledForAutomation"
              >
                <option value="true">
                  مفعلة
                </option>

                <option value="false">
                  متوقفة
                </option>
              </select>
            </div>

            <div class="ez-source-field">
              <label>
                الأخبار العاجلة
              </label>

              <select
                class="ez-source-select"
                name="enabledForBreaking"
              >
                <option value="false">
                  متوقف
                </option>

                <option value="true">
                  مفعل
                </option>
              </select>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-source-btn"
          data-source-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-source-btn primary"
          data-source-action="save-new"
        >
          حفظ المصدر
        </button>
      `
    );
  }

  function openEdit(id) {
    const source =
      state.sources.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!source) {
      return;
    }

    openModal(
      "تعديل المصدر",
      `
        <form id="ez-source-edit-form">

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              source.id
            )}"
          />

          <div class="ez-source-form-grid">

            <div
              class="
                ez-source-field
                full
              "
            >
              <label>
                اسم المصدر
              </label>

              <input
                class="ez-source-input"
                name="name"
                value="${escapeHtml(
                  source.name
                )}"
                required
              />
            </div>

            <div class="ez-source-field">
              <label>
                النوع
              </label>

              <select
                class="ez-source-select"
                name="type"
              >
                ${Object.entries(
                  TYPES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          source.type ===
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

            <div class="ez-source-field">
              <label>
                الحالة
              </label>

              <select
                class="ez-source-select"
                name="status"
              >
                ${Object.entries(
                  STATUSES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          source.status ===
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

            <div class="ez-source-field">
              <label>
                الأولوية
              </label>

              <select
                class="ez-source-select"
                name="priority"
              >
                ${Object.entries(
                  PRIORITIES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          source.priority ===
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

            <div class="ez-source-field">
              <label>
                التوثيق
              </label>

              <select
                class="ez-source-select"
                name="trust"
              >
                ${Object.entries(
                  TRUST
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          source.trust ===
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
                ez-source-field
                full
              "
            >
              <label>
                الرابط الرئيسي
              </label>

              <input
                class="ez-source-input"
                name="url"
                value="${escapeHtml(
                  source.url
                )}"
              />
            </div>

            <div
              class="
                ez-source-field
                full
              "
            >
              <label>
                API / RSS Endpoint
              </label>

              <input
                class="ez-source-input"
                name="endpoint"
                value="${escapeHtml(
                  source.endpoint
                )}"
              />
            </div>

            <div class="ez-source-field">
              <label>
                الفئة
              </label>

              <input
                class="ez-source-input"
                name="category"
                value="${escapeHtml(
                  source.category
                )}"
              />
            </div>

            <div class="ez-source-field">
              <label>
                اللغة
              </label>

              <input
                class="ez-source-input"
                name="language"
                value="${escapeHtml(
                  source.language
                )}"
              />
            </div>

            <div class="ez-source-field">
              <label>
                الدولة
              </label>

              <input
                class="ez-source-input"
                name="country"
                value="${escapeHtml(
                  source.country
                )}"
              />
            </div>

            <div class="ez-source-field">
              <label>
                التحديث بالدقائق
              </label>

              <input
                class="ez-source-input"
                type="number"
                min="1"
                max="1440"
                name="fetchInterval"
                value="${escapeHtml(
                  source.fetchInterval
                )}"
              />
            </div>

            <div
              class="
                ez-source-field
                full
              "
            >
              <label>
                الوصف
              </label>

              <textarea
                class="ez-source-textarea"
                name="description"
                rows="5"
              >${escapeHtml(
                source.description
              )}</textarea>
            </div>

            <div class="ez-source-field">
              <label>
                الذكاء الاصطناعي
              </label>

              <select
                class="ez-source-select"
                name="enabledForAI"
              >
                <option
                  value="true"
                  ${
                    source.enabledForAI
                      ? "selected"
                      : ""
                  }
                >
                  مفعل
                </option>

                <option
                  value="false"
                  ${
                    !source.enabledForAI
                      ? "selected"
                      : ""
                  }
                >
                  متوقف
                </option>
              </select>
            </div>

            <div class="ez-source-field">
              <label>
                الأتمتة
              </label>

              <select
                class="ez-source-select"
                name="enabledForAutomation"
              >
                <option
                  value="true"
                  ${
                    source.enabledForAutomation
                      ? "selected"
                      : ""
                  }
                >
                  مفعلة
                </option>

                <option
                  value="false"
                  ${
                    !source.enabledForAutomation
                      ? "selected"
                      : ""
                  }
                >
                  متوقفة
                </option>
              </select>
            </div>

            <div class="ez-source-field">
              <label>
                عاجل
              </label>

              <select
                class="ez-source-select"
                name="enabledForBreaking"
              >
                <option
                  value="true"
                  ${
                    source.enabledForBreaking
                      ? "selected"
                      : ""
                  }
                >
                  مفعل
                </option>

                <option
                  value="false"
                  ${
                    !source.enabledForBreaking
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
          class="ez-source-btn"
          data-source-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-source-btn primary"
          data-source-action="save-edit"
        >
          حفظ التعديلات
        </button>
      `
    );
  }

  function openDetails(id) {
    const source =
      state.sources.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!source) {
      return;
    }

    state.selected = source;

    openModal(
      "تفاصيل المصدر",
      `
        <div>

          <h2>
            ${escapeHtml(
              source.name
            )}
          </h2>

          <div
            style="
              display:flex;
              flex-wrap:wrap;
              gap:8px;
              margin:12px 0;
            "
          >
            ${typeBadge(
              source.type
            )}

            ${statusBadge(
              source.status
            )}

            ${trustBadge(
              source.trust
            )}
          </div>

          <div class="ez-source-meta">

            <div>
              <strong>
                الأولوية
              </strong>

              <br>

              ${escapeHtml(
                PRIORITIES[
                  source.priority
                ] ||
                  source.priority
              )}
            </div>

            <div>
              <strong>
                الدولة
              </strong>

              <br>

              ${escapeHtml(
                source.country
              )}
            </div>

            <div>
              <strong>
                اللغة
              </strong>

              <br>

              ${escapeHtml(
                source.language
              )}
            </div>

            <div>
              <strong>
                فترة التحديث
              </strong>

              <br>

              ${escapeHtml(
                String(
                  source.fetchInterval
                )
              )}
              دقيقة
            </div>

          </div>

          <h3>
            الوصف
          </h3>

          <p>
            ${escapeHtml(
              source.description ||
                "لا يوجد وصف."
            )}
          </p>

          <h3>
            الرابط
          </h3>

          <div
            style="
              padding:12px;
              background:#f7fbfd;
              border-radius:12px;
              word-break:break-all;
            "
          >
            ${escapeHtml(
              source.url ||
                "غير محدد"
            )}
          </div>

          <h3>
            Endpoint
          </h3>

          <div
            style="
              padding:12px;
              background:#f7fbfd;
              border-radius:12px;
              word-break:break-all;
            "
          >
            ${escapeHtml(
              source.endpoint ||
                "غير محدد"
            )}
          </div>

          <div
            class="ez-source-test"
            style="margin-top:18px"
          >
            <strong>
              آخر اختبار
            </strong>

            <div>
              ${escapeHtml(
                formatDate(
                  source.lastTest
                )
              )}
            </div>

            <div
              style="margin-top:7px"
            >
              ${escapeHtml(
                source.lastStatus
              )}
            </div>
          </div>

          <p
            style="
              margin-top:18px;
              line-height:1.8;
              color:#6d8797;
            "
          >
            تفعيل المصدر هنا يجهزه لمنظومة
            EZ MEDIA الداخلية. الجلب الخارجي
            الفعلي يجب أن يتم من Backend Connector
            آمن مع الالتزام بسياسات المصدر وشروط
            استخدامه.
          </p>

        </div>
      `,
      `
        <button
          class="ez-source-btn"
          data-source-action="close"
        >
          إغلاق
        </button>

        <button
          class="ez-source-btn"
          data-source-action="test"
          data-id="${escapeHtml(
            source.id
          )}"
        >
          اختبار
        </button>

        <button
          class="ez-source-btn"
          data-source-action="edit"
          data-id="${escapeHtml(
            source.id
          )}"
        >
          تعديل
        </button>
      `
    );
  }

  function collectFormData(
    form
  ) {
    const data =
      Object.fromEntries(
        new FormData(form).entries()
      );

    return {
      ...data,

      enabledForAI:
        data.enabledForAI ===
        "true",

      enabledForAutomation:
        data.enabledForAutomation ===
        "true",

      enabledForBreaking:
        data.enabledForBreaking ===
        "true",

      fetchInterval:
        Math.max(
          1,
          Number(
            data.fetchInterval ||
              15
          )
        )
    };
  }

  function createSource() {
    const form =
      document.querySelector(
        "#ez-source-create-form"
      );

    if (!form) {
      return;
    }

    const data =
      collectFormData(form);

    if (!data.name?.trim()) {
      notify(
        "اسم المصدر مطلوب.",
        "warning"
      );

      return;
    }

    const source =
      normalizeSource({
        ...data,
        id: createId(),
        name: data.name.trim(),
        createdAt:
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
        lastStatus:
          "لم يتم الاختبار"
      });

    state.sources.unshift(
      source
    );

    saveLocalSources();

    closeModal();

    render();

    notify(
      "تمت إضافة المصدر.",
      "success"
    );
  }

  function saveEdit() {
    const form =
      document.querySelector(
        "#ez-source-edit-form"
      );

    if (!form) {
      return;
    }

    const data =
      collectFormData(form);

    if (!data.id) {
      return;
    }

    const index =
      state.sources.findIndex(
        (source) =>
          String(source.id) ===
          String(data.id)
      );

    if (index === -1) {
      return;
    }

    state.sources[index] =
      normalizeSource({
        ...state.sources[index],
        ...data,
        id:
          state.sources[index].id,
        updatedAt:
          new Date().toISOString()
      });

    saveLocalSources();

    closeModal();

    render();

    notify(
      "تم حفظ تعديلات المصدر.",
      "success"
    );
  }

  function testSource(id) {
    const source =
      state.sources.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!source) {
      return;
    }

    /*
     * لا يتم تنفيذ fetch خارجي من الواجهة.
     * يتم تسجيل أن اختبار المصدر جاهز
     * للـBackend Connector.
     */

    source.lastTest =
      new Date().toISOString();

    source.lastStatus =
      source.endpoint ||
      source.url
        ? "جاهز للاختبار من Backend Connector"
        : "لا يوجد رابط أو Endpoint";

    if (
      !source.endpoint &&
      !source.url
    ) {
      source.status =
        "error";
    }

    source.updatedAt =
      new Date().toISOString();

    saveLocalSources();

    render();

    notify(
      source.endpoint ||
        source.url
        ? "تم تسجيل المصدر للاختبار الخلفي."
        : "المصدر يحتاج رابطًا قبل الاختبار.",
      source.endpoint ||
        source.url
        ? "success"
        : "warning"
    );
  }

  function toggleStatus(
    id,
    target
  ) {
    const source =
      state.sources.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!source) {
      return;
    }

    source.status =
      target === "activate"
        ? "active"
        : "paused";

    source.updatedAt =
      new Date().toISOString();

    saveLocalSources();

    render();

    notify(
      target === "activate"
        ? "تم تفعيل المصدر."
        : "تم إيقاف المصدر مؤقتًا.",
      "success"
    );
  }

  function deleteSource(id) {
    const source =
      state.sources.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!source) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف المصدر "${source.name}"؟`
      );

    if (!confirmed) {
      return;
    }

    state.sources =
      state.sources.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );

    saveLocalSources();

    render();

    notify(
      "تم حذف المصدر.",
      "success"
    );
  }

  function exportSources() {
    const payload =
      JSON.stringify(
        state.sources,
        null,
        2
      );

    const blob =
      new Blob(
        [payload],
        {
          type:
            "application/json;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;

    anchor.download =
      "ez-media-sources.json";

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );

    notify(
      "تم تصدير قائمة المصادر.",
      "success"
    );
  }

  function clearFilters() {
    state.search = "";
    state.type = "all";
    state.status = "all";
    state.priority = "all";
    state.trust = "all";

    render();
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#source-command-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-source-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .sourceAction;

              const id =
                button.dataset.id;

              if (
                action ===
                "new"
              ) {
                openCreate();
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
                createSource();
                return;
              }

              if (
                action ===
                "save-edit"
              ) {
                saveEdit();
                return;
              }

              if (
                action ===
                "open"
              ) {
                openDetails(id);
                return;
              }

              if (
                action ===
                "edit"
              ) {
                openEdit(id);
                return;
              }

              if (
                action ===
                "test"
              ) {
                testSource(id);
                return;
              }

              if (
                action ===
                "activate"
              ) {
                toggleStatus(
                  id,
                  "activate"
                );
                return;
              }

              if (
                action ===
                "pause"
              ) {
                toggleStatus(
                  id,
                  "pause"
                );
                return;
              }

              if (
                action ===
                "delete"
              ) {
                deleteSource(id);
                return;
              }

              if (
                action ===
                "export"
              ) {
                exportSources();
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
                "refresh"
              ) {
                render();

                notify(
                  "تم تحديث مركز المصادر.",
                  "success"
                );
              }
            }
          );
        }
      );

    const search =
      section.querySelector(
        "#ez-source-search"
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
        "#ez-source-type"
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
        "#ez-source-status"
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

    const priority =
      section.querySelector(
        "#ez-source-priority"
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

    const trust =
      section.querySelector(
        "#ez-source-trust"
      );

    if (trust) {
      trust.addEventListener(
        "change",
        (event) => {
          state.trust =
            event.target.value;

          render();
        }
      );
    }

    const modal =
      document.querySelector(
        "#ez-source-command-modal"
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

    loadLocalSources();

    render();
  }

  function hide() {
    const section =
      document.querySelector(
        "#source-command-section"
      );

    if (section) {
      section.hidden = true;
    }
  }

  function refresh() {
    loadLocalSources();

    render();
  }

  function openById(id) {
    show();

    setTimeout(() => {
      openDetails(id);
    }, 150);
  }

  function getSources() {
    return [
      ...state.sources
    ];
  }

  function addSource(source) {
    const normalized =
      normalizeSource(
        source || {}
      );

    state.sources.unshift(
      normalized
    );

    saveLocalSources();

    render();

    return normalized;
  }

  window.EZMediaAdminSourceCommand =
    {
      module: MODULE,
      show,
      hide,
      refresh,
      openById,
      getSources,
      addSource
    };

  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const section =
        event.detail?.section ||
        event.detail?.target;

      if (
        section ===
          "source-command" ||
        section ===
          "sources"
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
    "EZ MEDIA 11.0 — Source Command loaded."
  );
})();
