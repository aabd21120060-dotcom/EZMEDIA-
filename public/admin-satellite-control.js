"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 30
 * الملف: public/admin-satellite-control.js
 *
 * مركز إدارة البث الفضائي والمصادر الرسمية
 *
 * الوظائف:
 * - إدارة مصادر البث الفضائي
 * - إدارة القنوات الرسمية
 * - إدارة مصادر HLS / DASH / Embed / External
 * - تحديد المصدر الرئيسي
 * - تحديد المصادر المميزة
 * - حالة المصدر
 * - مراقبة جاهزية المصدر
 * - ربط المصدر بالواجهة الرئيسية
 * - ربط المصدر بغرفة البث
 * - حفظ إعدادات المصادر محليًا
 *
 * ملاحظة:
 * لا يقوم هذا الملف باستخراج أو تجاوز أو إعادة بث
 * أي إشارة محمية أو غير مرخصة.
 */

(function () {
  "use strict";

  const MODULE =
    "satellite-control";

  const STORAGE_KEY =
    "ezmedia_satellite_sources_v1";

  const SOURCES = {
    official:
      "مصدر رسمي",
    satellite:
      "بث فضائي",
    broadcaster:
      "قناة إعلامية",
    newsroom:
      "غرفة أخبار",
    agency:
      "وكالة أنباء",
    internal:
      "مصدر داخلي",
    partner:
      "شريك إعلامي",
    external:
      "مصدر خارجي"
  };

  const TYPES = {
    hls:
      "HLS",
    dash:
      "DASH",
    embed:
      "Embed",
    external:
      "External"
  };

  const STATUS = {
    active:
      "نشط",
    testing:
      "قيد الاختبار",
    offline:
      "غير متصل",
    paused:
      "متوقف",
    disabled:
      "معطل"
  };

  const state = {
    sources: [],
    search: "",
    sourceType: "all",
    status: "all",
    selected: null,
    showMainOnly: false
  };

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
      "sat-" +
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

  function normalizeSource(source) {
    return {
      id:
        source.id ||
        createId(),

      name:
        source.name ||
        "مصدر بدون اسم",

      description:
        source.description ||
        "",

      provider:
        source.provider ||
        "",

      source:
        source.source ||
        "external",

      type:
        source.type ||
        "hls",

      url:
        source.url ||
        "",

      logo:
        source.logo ||
        "",

      country:
        source.country ||
        "SA",

      language:
        source.language ||
        "ar",

      status:
        source.status ||
        "offline",

      isMain:
        Boolean(
          source.isMain
        ),

      featured:
        Boolean(
          source.featured
        ),

      licensed:
        Boolean(
          source.licensed
        ),

      verified:
        Boolean(
          source.verified
        ),

      latency:
        Number(
          source.latency || 0
        ),

      viewers:
        Number(
          source.viewers || 0
        ),

      lastChecked:
        source.lastChecked ||
        null,

      notes:
        source.notes ||
        "",

      createdAt:
        source.createdAt ||
        new Date().toISOString(),

      updatedAt:
        source.updatedAt ||
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
        state.sources = [];
        return;
      }

      const data =
        JSON.parse(raw);

      state.sources =
        Array.isArray(data)
          ? data.map(
              normalizeSource
            )
          : [];
    } catch (error) {
      console.warn(
        "EZ MEDIA Satellite Control:",
        error
      );

      state.sources = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state.sources
        )
      );
    } catch (error) {
      console.warn(
        "Satellite source save:",
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
              "مركز البث الفضائي",
            message
          }
        }
      )
    );

    const toast =
      document.querySelector(
        "#ez-satellite-toast"
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
      }, 3000);
  }

  function ensureSection() {
    let section =
      document.querySelector(
        "#satellite-control-section"
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
      "satellite-control-section";

    section.hidden = true;

    parent.appendChild(
      section
    );

    return section;
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-satellite-control-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-satellite-control-styles";

    style.textContent = `
      #satellite-control-section {
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

      .ez-sat-shell {
        max-width: 1600px;
        margin: auto;
      }

      .ez-sat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 23px;
        border-radius: 25px;
        background:
          linear-gradient(
            135deg,
            #eafaff,
            #ffffff
          );
        border: 1px solid #d7edf4;
      }

      .ez-sat-header h2 {
        margin: 0 0 7px;
        font-size: 28px;
      }

      .ez-sat-header p {
        margin: 0;
        color: #6e8796;
        line-height: 1.8;
      }

      .ez-sat-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-sat-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 800;
      }

      .ez-sat-btn.primary {
        background: #2eb5d7;
        color: #fff;
      }

      .ez-sat-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-sat-metrics {
        display: grid;
        grid-template-columns:
          repeat(7, minmax(0, 1fr));
        gap: 11px;
        margin: 18px 0;
      }

      .ez-sat-metric {
        padding: 15px;
        border-radius: 17px;
        background: #fff;
        border: 1px solid #deedf2;
      }

      .ez-sat-metric span {
        display: block;
        color: #718998;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .ez-sat-metric strong {
        font-size: 22px;
      }

      .ez-sat-toolbar {
        display: grid;
        grid-template-columns:
          minmax(230px, 1fr)
          170px
          170px
          170px
          auto;
        gap: 8px;
        margin-bottom: 18px;
      }

      .ez-sat-input,
      .ez-sat-select,
      .ez-sat-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        border-radius: 12px;
        padding: 12px 14px;
        background: #fff;
        color: #17384f;
        outline: none;
      }

      .ez-sat-input:focus,
      .ez-sat-select:focus,
      .ez-sat-textarea:focus {
        border-color: #55c4e4;
        box-shadow:
          0 0 0 3px
          rgba(85,196,228,.12);
      }

      .ez-sat-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 15px;
      }

      .ez-sat-card {
        background: #fff;
        border: 1px solid #deedf2;
        border-radius: 21px;
        padding: 18px;
        box-shadow:
          0 8px 28px
          rgba(25,103,129,.06);
      }

      .ez-sat-card.main {
        border-color: #65c8e3;
        box-shadow:
          0 10px 32px
          rgba(42,175,210,.12);
      }

      .ez-sat-card-top {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .ez-sat-card h3 {
        margin: 0 0 7px;
        line-height: 1.5;
      }

      .ez-sat-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 8px 0;
      }

      .ez-sat-badge {
        display: inline-flex;
        padding: 5px 9px;
        border-radius: 999px;
        background: #edf8fc;
        color: #176984;
        font-size: 11px;
        font-weight: 850;
      }

      .ez-sat-badge.success {
        background: #eefaf5;
        color: #267255;
      }

      .ez-sat-badge.warning {
        background: #fff8e8;
        color: #8b671a;
      }

      .ez-sat-badge.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-sat-badge.gray {
        background: #f1f6f8;
        color: #617b8a;
      }

      .ez-sat-description {
        color: #6f8796;
        line-height: 1.8;
        min-height: 45px;
      }

      .ez-sat-data {
        display: grid;
        grid-template-columns:
          repeat(3, 1fr);
        gap: 8px;
        margin: 14px 0;
      }

      .ez-sat-data-item {
        background: #f7fbfd;
        border-radius: 11px;
        padding: 10px;
      }

      .ez-sat-data-item span {
        display: block;
        color: #7b929f;
        font-size: 10px;
        margin-bottom: 4px;
      }

      .ez-sat-data-item strong {
        font-size: 15px;
      }

      .ez-sat-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 14px;
      }

      .ez-sat-small {
        border: 0;
        border-radius: 9px;
        padding: 8px 10px;
        background: #edf8fc;
        color: #176984;
        cursor: pointer;
        font-weight: 750;
      }

      .ez-sat-small.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-sat-empty {
        grid-column: 1 / -1;
        padding: 55px 20px;
        text-align: center;
        border: 1px dashed #cfe6ed;
        border-radius: 20px;
        color: #718997;
      }

      .ez-sat-modal {
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

      .ez-sat-modal.open {
        display: flex;
      }

      .ez-sat-dialog {
        width: min(900px,100%);
        max-height: 94vh;
        overflow: auto;
        background: #fff;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15,72,96,.22);
      }

      .ez-sat-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 21px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-sat-dialog-body {
        padding: 21px;
      }

      .ez-sat-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 15px 21px;
        border-top: 1px solid #e4eff3;
      }

      .ez-sat-notice {
        padding: 15px;
        border-radius: 15px;
        background:
          linear-gradient(
            135deg,
            #effbff,
            #ffffff
          );
        border: 1px solid #d6edf4;
        line-height: 1.85;
        margin-bottom: 15px;
      }

      #ez-satellite-toast {
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

      #ez-satellite-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width:1250px) {
        .ez-sat-grid {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .ez-sat-metrics {
          grid-template-columns:
            repeat(4,minmax(0,1fr));
        }

        .ez-sat-toolbar {
          grid-template-columns:
            1fr 1fr;
        }
      }

      @media (max-width:750px) {
        #satellite-control-section {
          padding: 12px;
        }

        .ez-sat-header {
          display: block;
        }

        .ez-sat-actions {
          margin-top: 15px;
        }

        .ez-sat-grid {
          grid-template-columns: 1fr;
        }

        .ez-sat-metrics {
          grid-template-columns: 1fr 1fr;
        }

        .ez-sat-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-sat-data {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function metric(
    label,
    value
  ) {
    return `
      <div class="ez-sat-metric">
        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${Number(value || 0).toLocaleString(
            "ar-SA"
          )}
        </strong>
      </div>
    `;
  }

  function metrics() {
    return {
      total:
        state.sources.length,

      active:
        state.sources.filter(
          (item) =>
            item.status ===
            "active"
        ).length,

      main:
        state.sources.filter(
          (item) =>
            item.isMain
        ).length,

      featured:
        state.sources.filter(
          (item) =>
            item.featured
        ).length,

      licensed:
        state.sources.filter(
          (item) =>
            item.licensed
        ).length,

      verified:
        state.sources.filter(
          (item) =>
            item.verified
        ).length,

      offline:
        state.sources.filter(
          (item) =>
            item.status ===
            "offline"
        ).length
    };
  }

  function filteredSources() {
    const query =
      state.search
        .trim()
        .toLowerCase();

    return state.sources
      .filter(
        (item) => {
          if (
            state.sourceType !==
              "all" &&
            item.type !==
              state.sourceType
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

          if (
            state.showMainOnly &&
            !item.isMain
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            item.name,
            item.provider,
            item.description,
            item.country,
            item.language,
            item.source
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }
      )
      .sort(
        (a, b) =>
          Number(b.isMain) -
          Number(a.isMain)
      );
  }

  function render() {
    const section =
      ensureSection();

    const m =
      metrics();

    const sources =
      filteredSources();

    section.innerHTML = `
      <div class="ez-sat-shell">

        <div class="ez-sat-header">

          <div>
            <h2>
              مركز البث الفضائي والمصادر الرسمية
            </h2>

            <p>
              إدارة مركزية لمصادر البث والقنوات
              الرسمية والروابط المرخصة داخل EZ MEDIA.
            </p>
          </div>

          <div class="ez-sat-actions">

            <button
              class="ez-sat-btn"
              data-sat-action="refresh"
            >
              تحديث
            </button>

            <button
              class="ez-sat-btn"
              data-sat-action="demo"
            >
              إضافة مصادر تجريبية
            </button>

            <button
              class="ez-sat-btn primary"
              data-sat-action="new"
            >
              + إضافة مصدر
            </button>

          </div>

        </div>

        <div class="ez-sat-metrics">

          ${metric(
            "إجمالي المصادر",
            m.total
          )}

          ${metric(
            "نشطة",
            m.active
          )}

          ${metric(
            "رئيسية",
            m.main
          )}

          ${metric(
            "مميزة",
            m.featured
          )}

          ${metric(
            "مرخصة",
            m.licensed
          )}

          ${metric(
            "موثقة",
            m.verified
          )}

          ${metric(
            "غير متصلة",
            m.offline
          )}

        </div>

        <div class="ez-sat-notice">

          <strong>
            سياسة المصدر:
          </strong>

          لا تستخدم EZ MEDIA أي إشارة بث محمية
          أو مصدرًا لا تملك المنصة تصريحًا باستخدامه.
          المصادر الرسمية أو الشريكة يجب أن تكون
          مصرحًا بها قبل تفعيلها على الواجهة.

        </div>

        <div class="ez-sat-toolbar">

          <input
            id="ez-sat-search"
            class="ez-sat-input"
            placeholder="ابحث عن قناة أو مصدر..."
            value="${escapeHtml(
              state.search
            )}"
          />

          <select
            id="ez-sat-type"
            class="ez-sat-select"
          >

            <option value="all">
              كل أنواع الاتصال
            </option>

            ${Object.entries(
              TYPES
            )
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${
                      state.sourceType ===
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
            id="ez-sat-status"
            class="ez-sat-select"
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
            id="ez-sat-main"
            class="ez-sat-select"
          >

            <option value="all">
              كل المصادر
            </option>

            <option
              value="main"
              ${
                state.showMainOnly
                  ? "selected"
                  : ""
              }
            >
              المصدر الرئيسي فقط
            </option>

          </select>

          <button
            class="ez-sat-btn"
            data-sat-action="clear"
          >
            مسح
          </button>

        </div>

        <div class="ez-sat-grid">

          ${
            sources.length
              ? sources
                  .map(
                    renderCard
                  )
                  .join("")
              : `
                <div class="ez-sat-empty">

                  <strong>
                    لا توجد مصادر مسجلة.
                  </strong>

                  <p>
                    أضف مصدر بث رسمي أو مرخص
                    لبدء بناء شبكة البث.
                  </p>

                </div>
              `
          }

        </div>

      </div>

      <div
        id="ez-sat-modal"
        class="ez-sat-modal"
        aria-hidden="true"
      ></div>

      <div id="ez-satellite-toast"></div>
    `;

    bindEvents();
  }

  function renderCard(
    item
  ) {
    const statusClass =
      item.status ===
      "active"
        ? "success"
        : item.status ===
          "testing"
        ? "warning"
        : item.status ===
          "offline"
        ? "danger"
        : "gray";

    return `
      <article
        class="
          ez-sat-card
          ${
            item.isMain
              ? "main"
              : ""
          }
        "
      >

        <div
          class="ez-sat-card-top"
        >

          <div>

            <h3>
              ${escapeHtml(
                item.name
              )}
            </h3>

            <div
              class="ez-sat-badges"
            >

              <span
                class="
                  ez-sat-badge
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

              <span
                class="ez-sat-badge"
              >
                ${escapeHtml(
                  TYPES[
                    item.type
                  ] ||
                    item.type
                )}
              </span>

              ${
                item.isMain
                  ? `
                    <span
                      class="
                        ez-sat-badge
                        success
                      "
                    >
                      المصدر الرئيسي
                    </span>
                  `
                  : ""
              }

              ${
                item.featured
                  ? `
                    <span
                      class="
                        ez-sat-badge
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
          class="ez-sat-description"
        >
          ${escapeHtml(
            item.description ||
              "لا يوجد وصف للمصدر."
          )}
        </p>

        <div class="ez-sat-data">

          <div
            class="ez-sat-data-item"
          >
            <span>
              المزود
            </span>

            <strong>
              ${escapeHtml(
                item.provider ||
                  "غير محدد"
              )}
            </strong>
          </div>

          <div
            class="ez-sat-data-item"
          >
            <span>
              المشاهدون
            </span>

            <strong>
              ${Number(
                item.viewers || 0
              ).toLocaleString(
                "ar-SA"
              )}
            </strong>
          </div>

          <div
            class="ez-sat-data-item"
          >
            <span>
              التأخير
            </span>

            <strong>
              ${
                item.latency
                  ? `${Number(
                      item.latency
                    )}ms`
                  : "—"
              }
            </strong>
          </div>

        </div>

        <div
          style="
            color:#748c99;
            font-size:11px;
            line-height:1.8;
          "
        >

          المصدر:
          ${escapeHtml(
            SOURCES[
              item.source
            ] ||
              item.source
          )}

          <br>

          الترخيص:
          ${
            item.licensed
              ? "مؤكد"
              : "غير مؤكد"
          }

          <br>

          التحقق:
          ${
            item.verified
              ? "موثق"
              : "غير موثق"
          }

        </div>

        <div
          class="ez-sat-card-actions"
        >

          <button
            class="ez-sat-small"
            data-sat-action="details"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            التفاصيل
          </button>

          <button
            class="ez-sat-small"
            data-sat-action="test"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            اختبار
          </button>

          <button
            class="ez-sat-small"
            data-sat-action="main"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            جعله رئيسيًا
          </button>

          <button
            class="ez-sat-small"
            data-sat-action="edit"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            تعديل
          </button>

          <button
            class="
              ez-sat-small
              danger
            "
            data-sat-action="delete"
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

  function openModal(
    title,
    body,
    footer = ""
  ) {
    const modal =
      document.querySelector(
        "#ez-sat-modal"
      );

    if (!modal) {
      return;
    }

    modal.innerHTML = `
      <div class="ez-sat-dialog">

        <div
          class="ez-sat-dialog-header"
        >

          <strong>
            ${escapeHtml(title)}
          </strong>

          <button
            class="ez-sat-btn"
            data-sat-action="close"
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-sat-dialog-body"
        >
          ${body}
        </div>

        ${
          footer
            ? `
              <div
                class="
                  ez-sat-dialog-footer
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
        "#ez-sat-modal"
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

  function findSource(id) {
    return state.sources.find(
      (item) =>
        String(item.id) ===
        String(id)
    );
  }

  function openDetails(
    id
  ) {
    const item =
      findSource(id);

    if (!item) {
      return;
    }

    state.selected =
      item;

    openModal(
      "تفاصيل مصدر البث",
      `
        <h2>
          ${escapeHtml(
            item.name
          )}
        </h2>

        <div
          class="ez-sat-badges"
        >

          <span
            class="ez-sat-badge"
          >
            ${escapeHtml(
              TYPES[
                item.type
              ] ||
                item.type
            )}
          </span>

          <span
            class="ez-sat-badge"
          >
            ${escapeHtml(
              STATUS[
                item.status
              ] ||
                item.status
            )}
          </span>

          ${
            item.licensed
              ? `
                <span
                  class="
                    ez-sat-badge
                    success
                  "
                >
                  مرخص
                </span>
              `
              : `
                <span
                  class="
                    ez-sat-badge
                    danger
                  "
                >
                  الترخيص غير مؤكد
                </span>
              `
          }

        </div>

        <p
          style="
            color:#6e8796;
            line-height:1.9;
          "
        >
          ${escapeHtml(
            item.description ||
              "لا يوجد وصف."
          )}
        </p>

        <div
          class="ez-sat-data"
        >

          <div
            class="ez-sat-data-item"
          >
            <span>
              المزود
            </span>
            <strong>
              ${escapeHtml(
                item.provider ||
                  "غير محدد"
              )}
            </strong>
          </div>

          <div
            class="ez-sat-data-item"
          >
            <span>
              الدولة
            </span>
            <strong>
              ${escapeHtml(
                item.country
              )}
            </strong>
          </div>

          <div
            class="ez-sat-data-item"
          >
            <span>
              اللغة
            </span>
            <strong>
              ${escapeHtml(
                item.language
              )}
            </strong>
          </div>

          <div
            class="ez-sat-data-item"
          >
            <span>
              المشاهدون
            </span>
            <strong>
              ${Number(
                item.viewers || 0
              ).toLocaleString(
                "ar-SA"
              )}
            </strong>
          </div>

          <div
            class="ez-sat-data-item"
          >
            <span>
              التأخير
            </span>
            <strong>
              ${
                item.latency
                  ? `${Number(
                      item.latency
                    )}ms`
                  : "—"
              }
            </strong>
          </div>

          <div
            class="ez-sat-data-item"
          >
            <span>
              رئيسي
            </span>
            <strong>
              ${
                item.isMain
                  ? "نعم"
                  : "لا"
              }
            </strong>
          </div>

        </div>

        <div
          class="ez-sat-notice"
        >

          <strong>
            عنوان المصدر
          </strong>

          <p
            style="
              word-break:break-all;
              direction:ltr;
              text-align:left;
            "
          >
            ${escapeHtml(
              item.url ||
                "لم تتم إضافة عنوان."
            )}
          </p>

        </div>

        <div
          class="ez-sat-notice"
        >

          <strong>
            حالة التحقق
          </strong>

          <p>
            ${
              item.verified
                ? "تم تسجيل المصدر كمصدر موثق."
                : "لم يتم تسجيل المصدر كمصدر موثق بعد."
            }
          </p>

          <strong>
            حالة الترخيص
          </strong>

          <p>
            ${
              item.licensed
                ? "تم تسجيل وجود تصريح/ترخيص لاستخدام المصدر."
                : "لم يتم تأكيد الترخيص داخل النظام."
            }
          </p>

        </div>
      `,
      `
        <button
          class="ez-sat-btn"
          data-sat-action="close"
        >
          إغلاق
        </button>

        <button
          class="ez-sat-btn primary"
          data-sat-action="edit"
          data-id="${escapeHtml(
            item.id
          )}"
        >
          تعديل المصدر
        </button>
      `
    );
  }

  function openForm(
    existing = null
  ) {
    const item =
      existing ||
      normalizeSource({});

    const isEdit =
      Boolean(existing);

    openModal(
      isEdit
        ? "تعديل مصدر البث"
        : "إضافة مصدر بث",
      `
        <form
          id="ez-sat-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              item.id
            )}"
          />

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
                اسم المصدر
              </label>

              <input
                class="ez-sat-input"
                name="name"
                required
                value="${escapeHtml(
                  item.name ===
                    "مصدر بدون اسم"
                    ? ""
                    : item.name
                )}"
                placeholder="اسم القناة أو المصدر"
              />

            </div>

            <div>

              <label>
                المزود
              </label>

              <input
                class="ez-sat-input"
                name="provider"
                value="${escapeHtml(
                  item.provider
                )}"
                placeholder="اسم المزود"
              />

            </div>

            <div>

              <label>
                نوع المصدر
              </label>

              <select
                class="ez-sat-select"
                name="source"
              >

                ${Object.entries(
                  SOURCES
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          item.source ===
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

            <div>

              <label>
                طريقة الاتصال
              </label>

              <select
                class="ez-sat-select"
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

            <div>

              <label>
                الحالة
              </label>

              <select
                class="ez-sat-select"
                name="status"
              >

                ${Object.entries(
                  STATUS
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
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
              style="
                grid-column:1/-1;
              "
            >

              <label>
                رابط البث أو المصدر
              </label>

              <input
                class="ez-sat-input"
                name="url"
                dir="ltr"
                value="${escapeHtml(
                  item.url
                )}"
                placeholder="https://..."
              />

            </div>

            <div>

              <label>
                الدولة
              </label>

              <input
                class="ez-sat-input"
                name="country"
                value="${escapeHtml(
                  item.country
                )}"
                placeholder="SA"
              />

            </div>

            <div>

              <label>
                اللغة
              </label>

              <input
                class="ez-sat-input"
                name="language"
                value="${escapeHtml(
                  item.language
                )}"
                placeholder="ar"
              />

            </div>

            <div
              style="
                grid-column:1/-1;
              "
            >

              <label>
                الوصف
              </label>

              <textarea
                class="ez-sat-textarea"
                name="description"
                rows="4"
              >${escapeHtml(
                item.description
              )}</textarea>

            </div>

            <div
              style="
                grid-column:1/-1;
              "
            >

              <label>
                ملاحظات
              </label>

              <textarea
                class="ez-sat-textarea"
                name="notes"
                rows="3"
              >${escapeHtml(
                item.notes
              )}</textarea>

            </div>

            <label>
              <input
                type="checkbox"
                name="licensed"
                ${
                  item.licensed
                    ? "checked"
                    : ""
                }
              />
              تم تأكيد التصريح/الترخيص
            </label>

            <label>
              <input
                type="checkbox"
                name="verified"
                ${
                  item.verified
                    ? "checked"
                    : ""
                }
              />
              مصدر موثق
            </label>

            <label>
              <input
                type="checkbox"
                name="featured"
                ${
                  item.featured
                    ? "checked"
                    : ""
                }
              />
              مصدر مميز
            </label>

          </div>

        </form>
      `,
      `
        <button
          class="ez-sat-btn"
          data-sat-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-sat-btn primary"
          data-sat-action="save"
        >
          ${isEdit
            ? "حفظ التعديلات"
            : "إضافة المصدر"}
        </button>
      `
    );
  }

  function saveForm() {
    const form =
      document.querySelector(
        "#ez-sat-form"
      );

    if (!form) {
      return;
    }

    const formData =
      new FormData(form);

    const id =
      formData.get("id");

    const name =
      String(
        formData.get("name") ||
          ""
      ).trim();

    if (!name) {
      notify(
        "اسم المصدر مطلوب.",
        "warning"
      );

      return;
    }

    const existing =
      findSource(id);

    const source =
      normalizeSource({
        id:
          id ||
          createId(),

        name,

        provider:
          String(
            formData.get(
              "provider"
            ) || ""
          ).trim(),

        source:
          formData.get(
            "source"
          ) ||
          "external",

        type:
          formData.get(
            "type"
          ) ||
          "hls",

        status:
          formData.get(
            "status"
          ) ||
          "offline",

        url:
          String(
            formData.get(
              "url"
            ) || ""
          ).trim(),

        country:
          String(
            formData.get(
              "country"
            ) || "SA"
          ).trim(),

        language:
          String(
            formData.get(
              "language"
            ) || "ar"
          ).trim(),

        description:
          String(
            formData.get(
              "description"
            ) || ""
          ).trim(),

        notes:
          String(
            formData.get(
              "notes"
            ) || ""
          ).trim(),

        licensed:
          formData.has(
            "licensed"
          ),

        verified:
          formData.has(
            "verified"
          ),

        featured:
          formData.has(
            "featured"
          ),

        isMain:
          existing
            ? existing.isMain
            : false,

        createdAt:
          existing
            ? existing.createdAt
            : new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      });

    if (existing) {
      const index =
        state.sources.findIndex(
          (item) =>
            String(item.id) ===
            String(id)
        );

      if (index >= 0) {
        state.sources[
          index
        ] = source;
      }
    } else {
      state.sources.unshift(
        source
      );
    }

    save();

    closeModal();

    render();

    notify(
      existing
        ? "تم تحديث مصدر البث."
        : "تمت إضافة مصدر البث.",
      "success"
    );
  }

  function setMain(id) {
    const source =
      findSource(id);

    if (!source) {
      return;
    }

    state.sources =
      state.sources.map(
        (item) => ({
          ...item,
          isMain:
            String(
              item.id
            ) ===
            String(id),
          updatedAt:
            new Date().toISOString()
        })
      );

    save();

    render();

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:satellite:main-source",
        {
          detail: {
            source
          }
        }
      )
    );

    notify(
      "تم تعيين المصدر الرئيسي.",
      "success"
    );
  }

  function testSource(id) {
    const source =
      findSource(id);

    if (!source) {
      return;
    }

    /*
     * لا يتم تنفيذ طلب خارجي مباشر هنا.
     * اختبار الاتصال الحقيقي يجب أن يتم
     * في Backend لأسباب أمنية وتقنية.
     */

    source.status =
      "testing";

    source.lastChecked =
      new Date().toISOString();

    source.updatedAt =
      new Date().toISOString();

    save();

    render();

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:satellite:test",
        {
          detail: {
            source
          }
        }
      )
    );

    notify(
      "تم إرسال المصدر إلى مسار الاختبار الخلفي.",
      "success"
    );
  }

  function deleteSource(id) {
    const source =
      findSource(id);

    if (!source) {
      return;
    }

    if (source.isMain) {
      notify(
        "لا يمكن حذف المصدر الرئيسي قبل تعيين مصدر رئيسي آخر.",
        "warning"
      );

      return;
    }

    const confirmed =
      window.confirm(
        "هل تريد حذف هذا المصدر؟"
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

    save();

    render();

    notify(
      "تم حذف المصدر.",
      "success"
    );
  }

  function demo() {
    const demoSources = [
      {
        name:
          "المصدر الرسمي الرئيسي",
        description:
          "مصدر رسمي تجريبي لبناء واجهة مركز البث.",
        provider:
          "EZ MEDIA",
        source:
          "official",
        type:
          "hls",
        status:
          "testing",
        licensed:
          true,
        verified:
          true,
        featured:
          true,
        isMain:
          true
      },
      {
        name:
          "قناة شريكة",
        description:
          "مصدر تجريبي لقناة إعلامية شريكة.",
        provider:
          "شريك إعلامي",
        source:
          "partner",
        type:
          "embed",
        status:
          "active",
        licensed:
          true,
        verified:
          true,
        featured:
          true
      },
      {
        name:
          "مصدر فضائي",
        description:
          "مصدر فضائي تجريبي لاختبار لوحة التحكم.",
        provider:
          "مزود فضائي",
        source:
          "satellite",
        type:
          "external",
        status:
          "offline",
        licensed:
          false,
        verified:
          false
      }
    ];

    demoSources.forEach(
      (item) => {
        state.sources.unshift(
          normalizeSource(
            item
          )
        );
      }
    );

    save();

    render();

    notify(
      "تمت إضافة مصادر تجريبية.",
      "success"
    );
  }

  function clearFilters() {
    state.search = "";
    state.sourceType =
      "all";
    state.status =
      "all";
    state.showMainOnly =
      false;

    render();
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#satellite-control-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-sat-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .satAction;

              const id =
                button.dataset.id;

              if (
                action ===
                "refresh"
              ) {
                load();
                render();

                notify(
                  "تم تحديث مركز البث.",
                  "success"
                );

                return;
              }

              if (
                action ===
                "demo"
              ) {
                demo();
                return;
              }

              if (
                action ===
                "new"
              ) {
                openForm();
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
                "save"
              ) {
                saveForm();
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
                "test"
              ) {
                testSource(id);
                return;
              }

              if (
                action ===
                "main"
              ) {
                setMain(id);
                return;
              }

              if (
                action ===
                "edit"
              ) {
                const item =
                  findSource(id);

                if (item) {
                  openForm(item);
                }

                return;
              }

              if (
                action ===
                "delete"
              ) {
                deleteSource(id);
              }
            }
          );
        }
      );

    const search =
      section.querySelector(
        "#ez-sat-search"
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
        "#ez-sat-type"
      );

    if (type) {
      type.addEventListener(
        "change",
        (event) => {
          state.sourceType =
            event.target.value;

          render();
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-sat-status"
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

    const main =
      section.querySelector(
        "#ez-sat-main"
      );

    if (main) {
      main.addEventListener(
        "change",
        (event) => {
          state.showMainOnly =
            event.target.value ===
            "main";

          render();
        }
      );
    }

    const modal =
      document.querySelector(
        "#ez-sat-modal"
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
        "#satellite-control-section"
      );

    if (section) {
      section.hidden = true;
    }
  }

  function refresh() {
    load();
    render();
  }

  function addSource(
    source
  ) {
    const normalized =
      normalizeSource(
        source || {}
      );

    if (
      normalized.isMain
    ) {
      state.sources =
        state.sources.map(
          (item) => ({
            ...item,
            isMain: false
          })
        );
    }

    state.sources.unshift(
      normalized
    );

    save();

    render();

    return normalized;
  }

  function getSources() {
    return [
      ...state.sources
    ];
  }

  function getMainSource() {
    return (
      state.sources.find(
        (item) =>
          item.isMain
      ) ||
      null
    );
  }

  window.EZMediaAdminSatelliteControl =
    {
      module: MODULE,
      show,
      hide,
      refresh,
      addSource,
      getSources,
      getMainSource
    };

  window.addEventListener(
    "ezmedia:satellite:refresh",
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
          "satellite-control" ||
        section ===
          "satellite" ||
        section ===
          "broadcast-satellite"
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
    "EZ MEDIA 11.0 — Satellite Control loaded."
  );
})();
