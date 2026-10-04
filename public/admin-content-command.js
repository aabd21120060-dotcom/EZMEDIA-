"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 27
 * الملف: public/admin-content-command.js
 *
 * مركز إدارة المحتوى الذكي المتقدم
 *
 * يعتمد على:
 * /api/content
 * /api/ai/content/:id/analyze
 * /api/ai/content/:id/latest
 *
 * يدعم:
 * - الأخبار
 * - التقارير
 * - المقابلات
 * - الفيديو
 * - التغطيات
 * - العاجل
 * - البحث والفلترة
 * - الأولوية
 * - المراجعة
 * - الاعتماد
 * - النشر
 * - الأرشفة
 * - جدولة المحتوى
 * - تحليل AI
 * - لوحة تفاصيل المادة
 * - محرر المحتوى
 *
 * لا يدعي نجاح عملية لم يؤكدها الـBackend.
 */

(function () {
  "use strict";

  const MODULE = "content-command";

  const API = {
    content: "/api/content",
    ai: "/api/ai/content"
  };

  const TYPES = {
    news: "خبر",
    report: "تقرير",
    interview: "مقابلة",
    video: "فيديو",
    coverage: "تغطية",
    breaking: "عاجل"
  };

  const STATUSES = {
    draft: "مسودة",
    review: "قيد المراجعة",
    approved: "معتمد",
    scheduled: "مجدول",
    published: "منشور",
    archived: "مؤرشف"
  };

  const PRIORITIES = {
    low: "منخفضة",
    normal: "عادية",
    high: "مرتفعة",
    urgent: "عاجلة",
    critical: "حرجة"
  };

  const state = {
    items: [],
    selected: null,
    ai: null,
    loading: false,
    search: "",
    type: "all",
    status: "all",
    priority: "all",
    page: 1,
    limit: 50
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
    if (!value) return "غير محدد";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "غير محدد";
    }

    return date.toLocaleString("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function notify(message, type = "info") {
    window.dispatchEvent(
      new CustomEvent("ezmedia:notification", {
        detail: {
          module: MODULE,
          type,
          title: "مركز المحتوى",
          message
        }
      })
    );

    const toast = document.querySelector(
      "#ez-content-command-toast"
    );

    if (!toast) return;

    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `HTTP ${response.status}`
      );
    }

    return data;
  }

  function normalizeContent(item) {
    return {
      ...item,

      id: item.id,

      title:
        item.title ||
        item.headline ||
        item.name ||
        "مادة بدون عنوان",

      headline:
        item.headline ||
        item.title ||
        "",

      summary:
        item.summary ||
        item.excerpt ||
        item.description ||
        "",

      body:
        item.body ||
        item.content ||
        "",

      type:
        item.type ||
        item.content_type ||
        "news",

      status:
        item.status ||
        "draft",

      priority:
        item.priority ||
        item.metadata?.priority ||
        "normal",

      category:
        item.category ||
        "عام",

      author:
        item.author_name ||
        item.author ||
        item.created_by_name ||
        "غير محدد",

      createdAt:
        item.created_at ||
        item.createdAt ||
        null,

      updatedAt:
        item.updated_at ||
        item.updatedAt ||
        null,

      publishedAt:
        item.published_at ||
        item.publishedAt ||
        null,

      scheduledAt:
        item.scheduled_at ||
        item.scheduledAt ||
        null,

      slug:
        item.slug ||
        "",

      tags:
        Array.isArray(item.tags)
          ? item.tags
          : [],

      metadata:
        item.metadata || {}
    };
  }

  function normalizeList(data) {
    if (Array.isArray(data)) {
      return data;
    }

    return (
      data.items ||
      data.content ||
      data.data ||
      data.results ||
      []
    );
  }

  async function loadContent() {
    state.loading = true;

    try {
      const params = new URLSearchParams();

      params.set(
        "limit",
        String(state.limit)
      );

      params.set(
        "page",
        String(state.page)
      );

      if (state.search.trim()) {
        params.set(
          "search",
          state.search.trim()
        );
      }

      if (state.type !== "all") {
        params.set(
          "type",
          state.type
        );
      }

      if (state.status !== "all") {
        params.set(
          "status",
          state.status
        );
      }

      if (state.priority !== "all") {
        params.set(
          "priority",
          state.priority
        );
      }

      const data = await fetchJSON(
        `${API.content}?${params.toString()}`
      );

      state.items = normalizeList(data)
        .map(normalizeContent);
    } catch (error) {
      console.error(
        "EZ MEDIA Content Command:",
        error
      );

      state.items = [];

      notify(
        "تعذر تحميل المحتوى.",
        "error"
      );
    } finally {
      state.loading = false;
    }
  }

  function calculateMetrics() {
    const metrics = {
      total: state.items.length,
      draft: 0,
      review: 0,
      approved: 0,
      scheduled: 0,
      published: 0,
      archived: 0,
      urgent: 0
    };

    state.items.forEach((item) => {
      if (
        Object.prototype.hasOwnProperty.call(
          metrics,
          item.status
        )
      ) {
        metrics[item.status]++;
      }

      if (
        item.priority === "urgent" ||
        item.priority === "critical"
      ) {
        metrics.urgent++;
      }
    });

    return metrics;
  }

  function ensureSection() {
    let section = document.querySelector(
      "#content-command-section"
    );

    if (section) return section;

    const parent =
      document.querySelector("main") ||
      document.querySelector("#admin-main") ||
      document.body;

    section = document.createElement("section");

    section.id =
      "content-command-section";

    section.hidden = true;

    parent.appendChild(section);

    return section;
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-content-command-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "ez-content-command-styles";

    style.textContent = `
      #content-command-section {
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

      .ez-content-shell {
        max-width: 1600px;
        margin: auto;
      }

      .ez-content-header {
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

      .ez-content-header h2 {
        margin: 0 0 7px;
        font-size: 28px;
      }

      .ez-content-header p {
        margin: 0;
        color: #6e8797;
        line-height: 1.7;
      }

      .ez-content-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-content-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #eaf8fd;
        color: #176984;
        font-weight: 800;
      }

      .ez-content-btn.primary {
        background: #31b4d6;
        color: white;
      }

      .ez-content-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-content-btn.success {
        background: #eefaf5;
        color: #237052;
      }

      .ez-content-metrics {
        display: grid;
        grid-template-columns:
          repeat(7, minmax(0, 1fr));
        gap: 11px;
        margin: 18px 0;
      }

      .ez-content-metric {
        background: white;
        border: 1px solid #dfedf2;
        border-radius: 17px;
        padding: 15px;
      }

      .ez-content-metric span {
        display: block;
        color: #71899a;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .ez-content-metric strong {
        font-size: 23px;
      }

      .ez-content-toolbar {
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

      .ez-content-input,
      .ez-content-select,
      .ez-content-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        background: white;
        border-radius: 12px;
        padding: 12px 14px;
        color: #17384f;
        outline: none;
      }

      .ez-content-input:focus,
      .ez-content-select:focus,
      .ez-content-textarea:focus {
        border-color: #54c4e4;
        box-shadow:
          0 0 0 3px
          rgba(84, 196, 228, .12);
      }

      .ez-content-table-wrap {
        background: white;
        border: 1px solid #dfedf2;
        border-radius: 20px;
        overflow: auto;
      }

      .ez-content-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1050px;
      }

      .ez-content-table th,
      .ez-content-table td {
        padding: 14px;
        border-bottom: 1px solid #edf3f5;
        text-align: right;
        vertical-align: middle;
      }

      .ez-content-table th {
        background: #f7fbfd;
        color: #59788a;
        font-size: 12px;
      }

      .ez-content-table tr:hover td {
        background: #fbfeff;
      }

      .ez-content-title {
        font-weight: 850;
        color: #173d56;
        line-height: 1.5;
      }

      .ez-content-sub {
        color: #78909e;
        font-size: 12px;
        margin-top: 4px;
      }

      .ez-content-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 11px;
        font-weight: 850;
        white-space: nowrap;
      }

      .ez-content-badge.live {
        background: #edf9ff;
        color: #14708d;
      }

      .ez-content-badge.review {
        background: #fff8e8;
        color: #8b671a;
      }

      .ez-content-badge.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-content-badge.success {
        background: #eefaf5;
        color: #237052;
      }

      .ez-content-badge.gray {
        background: #f1f6f8;
        color: #617c8b;
      }

      .ez-content-row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .ez-content-small-btn {
        border: 0;
        border-radius: 9px;
        padding: 7px 9px;
        cursor: pointer;
        background: #edf8fc;
        color: #176984;
        font-weight: 750;
      }

      .ez-content-modal {
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

      .ez-content-modal.open {
        display: flex;
      }

      .ez-content-dialog {
        width: min(1100px, 100%);
        max-height: 94vh;
        overflow: auto;
        background: white;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15, 72, 96, .22);
      }

      .ez-content-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 19px 21px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-content-dialog-body {
        padding: 21px;
      }

      .ez-content-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 15px 21px;
        border-top: 1px solid #e4eff3;
      }

      .ez-content-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 13px;
      }

      .ez-content-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ez-content-field.full {
        grid-column: 1 / -1;
      }

      .ez-content-field label {
        font-weight: 800;
        font-size: 13px;
      }

      .ez-content-ai {
        margin-top: 18px;
        padding: 18px;
        border-radius: 18px;
        background:
          linear-gradient(
            135deg,
            #f0fbff,
            #ffffff
          );
        border: 1px solid #d7edf4;
      }

      .ez-content-ai h3 {
        margin-top: 0;
      }

      .ez-content-ai-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .ez-content-ai-item {
        padding: 12px;
        border-radius: 12px;
        background: white;
        border: 1px solid #e5f0f3;
      }

      .ez-content-ai-item strong {
        display: block;
        margin-bottom: 6px;
      }

      .ez-content-ai-item p {
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.7;
      }

      .ez-content-empty {
        padding: 50px 20px;
        text-align: center;
        color: #718a99;
      }

      #ez-content-command-toast {
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

      #ez-content-command-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 1250px) {
        .ez-content-metrics {
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
        }

        .ez-content-toolbar {
          grid-template-columns:
            1fr 1fr;
        }
      }

      @media (max-width: 750px) {
        #content-command-section {
          padding: 12px;
        }

        .ez-content-header {
          display: block;
        }

        .ez-content-actions {
          margin-top: 15px;
        }

        .ez-content-metrics {
          grid-template-columns: 1fr 1fr;
        }

        .ez-content-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-content-form-grid,
        .ez-content-ai-grid {
          grid-template-columns: 1fr;
        }

        .ez-content-field.full {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function statusBadge(status) {
    let cls = "gray";

    if (status === "published") {
      cls = "success";
    } else if (status === "review") {
      cls = "review";
    } else if (status === "approved") {
      cls = "live";
    } else if (status === "draft") {
      cls = "gray";
    }

    return `
      <span class="ez-content-badge ${cls}">
        ${escapeHtml(
          STATUSES[status] ||
            status
        )}
      </span>
    `;
  }

  function priorityBadge(priority) {
    let cls = "gray";

    if (
      priority === "urgent" ||
      priority === "critical"
    ) {
      cls = "danger";
    } else if (
      priority === "high"
    ) {
      cls = "review";
    }

    return `
      <span class="ez-content-badge ${cls}">
        ${escapeHtml(
          PRIORITIES[priority] ||
            priority
        )}
      </span>
    `;
  }

  function render() {
    const section = ensureSection();
    const metrics = calculateMetrics();

    section.innerHTML = `
      <div class="ez-content-shell">

        <div class="ez-content-header">

          <div>
            <h2>
              مركز إدارة المحتوى الذكي
            </h2>

            <p>
              غرفة تحكم موحدة لإنشاء وتحرير
              ومراجعة واعتماد ونشر المحتوى.
            </p>
          </div>

          <div class="ez-content-actions">

            <button
              class="ez-content-btn"
              data-content-action="refresh"
            >
              تحديث
            </button>

            <button
              class="ez-content-btn"
              data-content-action="ai"
            >
              تحليل AI
            </button>

            <button
              class="ez-content-btn primary"
              data-content-action="new"
            >
              + مادة جديدة
            </button>

          </div>

        </div>

        <div class="ez-content-metrics">

          ${metric(
            "الإجمالي",
            metrics.total
          )}

          ${metric(
            "مسودات",
            metrics.draft
          )}

          ${metric(
            "مراجعة",
            metrics.review
          )}

          ${metric(
            "معتمد",
            metrics.approved
          )}

          ${metric(
            "مجدول",
            metrics.scheduled
          )}

          ${metric(
            "منشور",
            metrics.published
          )}

          ${metric(
            "عاجل/حرج",
            metrics.urgent
          )}

        </div>

        <div class="ez-content-toolbar">

          <input
            id="ez-content-search"
            class="ez-content-input"
            placeholder="ابحث في المحتوى..."
            value="${escapeHtml(
              state.search
            )}"
          />

          <select
            id="ez-content-type"
            class="ez-content-select"
          >
            <option value="all">
              كل الأنواع
            </option>

            ${Object.entries(TYPES)
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
            id="ez-content-status"
            class="ez-content-select"
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
            id="ez-content-priority"
            class="ez-content-select"
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

          <button
            class="ez-content-btn"
            data-content-action="clear"
          >
            مسح
          </button>

        </div>

        <div class="ez-content-table-wrap">

          ${
            state.loading
              ? `
                <div class="ez-content-empty">
                  جاري تحميل المحتوى...
                </div>
              `
              : state.items.length
              ? renderTable()
              : `
                <div class="ez-content-empty">
                  لا توجد مواد مطابقة للبحث الحالي.
                </div>
              `
          }

        </div>

      </div>

      <div
        id="ez-content-command-modal"
        class="ez-content-modal"
        aria-hidden="true"
      ></div>

      <div id="ez-content-command-toast"></div>
    `;

    bindEvents();
  }

  function metric(label, value) {
    return `
      <div class="ez-content-metric">
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

  function renderTable() {
    return `
      <table class="ez-content-table">

        <thead>
          <tr>
            <th>
              المادة
            </th>

            <th>
              النوع
            </th>

            <th>
              الحالة
            </th>

            <th>
              الأولوية
            </th>

            <th>
              الكاتب
            </th>

            <th>
              التحديث
            </th>

            <th>
              الإجراءات
            </th>
          </tr>
        </thead>

        <tbody>

          ${state.items
            .map(
              (item) => `
                <tr>

                  <td>
                    <div class="ez-content-title">
                      ${escapeHtml(
                        item.title
                      )}
                    </div>

                    <div class="ez-content-sub">
                      ID:
                      ${escapeHtml(
                        String(item.id)
                      )}
                    </div>
                  </td>

                  <td>
                    ${escapeHtml(
                      TYPES[item.type] ||
                        item.type
                    )}
                  </td>

                  <td>
                    ${statusBadge(
                      item.status
                    )}
                  </td>

                  <td>
                    ${priorityBadge(
                      item.priority
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      item.author
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatDate(
                        item.updatedAt ||
                          item.createdAt
                      )
                    )}
                  </td>

                  <td>
                    <div
                      class="ez-content-row-actions"
                    >

                      <button
                        class="ez-content-small-btn"
                        data-content-action="open"
                        data-id="${escapeHtml(
                          item.id
                        )}"
                      >
                        فتح
                      </button>

                      <button
                        class="ez-content-small-btn"
                        data-content-action="edit"
                        data-id="${escapeHtml(
                          item.id
                        )}"
                      >
                        تعديل
                      </button>

                      <button
                        class="ez-content-small-btn"
                        data-content-action="analyze"
                        data-id="${escapeHtml(
                          item.id
                        )}"
                      >
                        AI
                      </button>

                      ${
                        item.status ===
                        "review"
                          ? `
                            <button
                              class="ez-content-small-btn"
                              data-content-action="approve"
                              data-id="${escapeHtml(
                                item.id
                              )}"
                            >
                              اعتماد
                            </button>
                          `
                          : ""
                      }

                      ${
                        item.status ===
                          "approved" ||
                        item.status ===
                          "scheduled"
                          ? `
                            <button
                              class="ez-content-small-btn"
                              data-content-action="publish"
                              data-id="${escapeHtml(
                                item.id
                              )}"
                            >
                              نشر
                            </button>
                          `
                          : ""
                      }

                    </div>
                  </td>

                </tr>
              `
            )
            .join("")}

        </tbody>

      </table>
    `;
  }

  function openModal(
    title,
    body,
    footer = ""
  ) {
    const modal = document.querySelector(
      "#ez-content-command-modal"
    );

    if (!modal) return;

    modal.innerHTML = `
      <div class="ez-content-dialog">

        <div class="ez-content-dialog-header">

          <strong>
            ${escapeHtml(title)}
          </strong>

          <button
            class="ez-content-btn"
            data-content-action="close"
          >
            إغلاق
          </button>

        </div>

        <div class="ez-content-dialog-body">
          ${body}
        </div>

        ${
          footer
            ? `
              <div class="ez-content-dialog-footer">
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
    const modal = document.querySelector(
      "#ez-content-command-modal"
    );

    if (!modal) return;

    modal.classList.remove("open");

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    modal.innerHTML = "";
  }

  function getItem(id) {
    return state.items.find(
      (item) =>
        String(item.id) ===
        String(id)
    );
  }

  function openCreate() {
    openModal(
      "إنشاء مادة إعلامية",
      `
        <form id="ez-content-create-form">

          <div class="ez-content-form-grid">

            <div class="ez-content-field full">
              <label>
                العنوان
              </label>

              <input
                class="ez-content-input"
                name="title"
                required
                placeholder="عنوان المادة"
              />
            </div>

            <div class="ez-content-field">
              <label>
                النوع
              </label>

              <select
                class="ez-content-select"
                name="type"
              >
                ${Object.entries(TYPES)
                  .map(
                    ([key, label]) => `
                      <option value="${key}">
                        ${escapeHtml(
                          label
                        )}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </div>

            <div class="ez-content-field">
              <label>
                الأولوية
              </label>

              <select
                class="ez-content-select"
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

            <div class="ez-content-field">
              <label>
                التصنيف
              </label>

              <input
                class="ez-content-input"
                name="category"
                value="عام"
              />
            </div>

            <div class="ez-content-field">
              <label>
                Slug
              </label>

              <input
                class="ez-content-input"
                name="slug"
              />
            </div>

            <div class="ez-content-field full">
              <label>
                الملخص
              </label>

              <textarea
                class="ez-content-textarea"
                name="summary"
                rows="4"
                placeholder="ملخص المادة"
              ></textarea>
            </div>

            <div class="ez-content-field full">
              <label>
                النص
              </label>

              <textarea
                class="ez-content-textarea"
                name="body"
                rows="12"
                placeholder="اكتب المادة الإعلامية هنا..."
              ></textarea>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-content-btn"
          data-content-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-content-btn primary"
          data-content-action="save-new"
        >
          إنشاء المادة
        </button>
      `
    );
  }

  function openEdit(id) {
    const item = getItem(id);

    if (!item) return;

    openModal(
      "تعديل المادة",
      `
        <form id="ez-content-edit-form">

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              item.id
            )}"
          />

          <div class="ez-content-form-grid">

            <div class="ez-content-field full">
              <label>
                العنوان
              </label>

              <input
                class="ez-content-input"
                name="title"
                value="${escapeHtml(
                  item.title
                )}"
                required
              />
            </div>

            <div class="ez-content-field">
              <label>
                النوع
              </label>

              <select
                class="ez-content-select"
                name="type"
              >
                ${Object.entries(TYPES)
                  .map(
                    ([key, label]) => `
                      <option
                        value="${key}"
                        ${
                          item.type === key
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

            <div class="ez-content-field">
              <label>
                الأولوية
              </label>

              <select
                class="ez-content-select"
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
                          item.priority ===
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

            <div class="ez-content-field">
              <label>
                التصنيف
              </label>

              <input
                class="ez-content-input"
                name="category"
                value="${escapeHtml(
                  item.category
                )}"
              />
            </div>

            <div class="ez-content-field">
              <label>
                Slug
              </label>

              <input
                class="ez-content-input"
                name="slug"
                value="${escapeHtml(
                  item.slug
                )}"
              />
            </div>

            <div class="ez-content-field full">
              <label>
                الملخص
              </label>

              <textarea
                class="ez-content-textarea"
                name="summary"
                rows="4"
              >${escapeHtml(
                item.summary
              )}</textarea>
            </div>

            <div class="ez-content-field full">
              <label>
                النص
              </label>

              <textarea
                class="ez-content-textarea"
                name="body"
                rows="12"
              >${escapeHtml(
                item.body
              )}</textarea>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-content-btn"
          data-content-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-content-btn primary"
          data-content-action="save-edit"
        >
          حفظ التعديلات
        </button>
      `
    );
  }

  function openDetails(id) {
    const item = getItem(id);

    if (!item) return;

    state.selected = item;

    openModal(
      "تفاصيل المادة",
      `
        <div>

          <h2>
            ${escapeHtml(
              item.title
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
            ${statusBadge(
              item.status
            )}

            ${priorityBadge(
              item.priority
            )}

            <span
              class="ez-content-badge gray"
            >
              ${escapeHtml(
                TYPES[item.type] ||
                  item.type
              )}
            </span>
          </div>

          <p>
            <strong>
              الكاتب:
            </strong>

            ${escapeHtml(
              item.author
            )}
          </p>

          <p>
            <strong>
              التصنيف:
            </strong>

            ${escapeHtml(
              item.category
            )}
          </p>

          <p>
            <strong>
              الإنشاء:
            </strong>

            ${escapeHtml(
              formatDate(
                item.createdAt
              )
            )}
          </p>

          <p>
            <strong>
              آخر تحديث:
            </strong>

            ${escapeHtml(
              formatDate(
                item.updatedAt
              )
            )}
          </p>

          ${
            item.scheduledAt
              ? `
                <p>
                  <strong>
                    موعد النشر:
                  </strong>

                  ${escapeHtml(
                    formatDate(
                      item.scheduledAt
                    )
                  )}
                </p>
              `
              : ""
          }

          <hr>

          <h3>
            الملخص
          </h3>

          <p style="line-height:1.9">
            ${escapeHtml(
              item.summary ||
                "لا يوجد ملخص."
            )}
          </p>

          <h3>
            النص
          </h3>

          <div
            style="
              white-space:pre-wrap;
              line-height:2;
              padding:16px;
              border-radius:15px;
              background:#f7fbfd;
            "
          >
            ${escapeHtml(
              item.body ||
                "لا يوجد نص."
            )}
          </div>

          ${
            item.tags?.length
              ? `
                <h3>
                  الوسوم
                </h3>

                <p>
                  ${item.tags
                    .map(
                      (tag) =>
                        `<span class="ez-content-badge gray">
                          ${escapeHtml(
                            tag
                          )}
                        </span>`
                    )
                    .join(" ")}
                </p>
              `
              : ""
          }

        </div>
      `,
      `
        <button
          class="ez-content-btn"
          data-content-action="close"
        >
          إغلاق
        </button>

        <button
          class="ez-content-btn"
          data-content-action="edit"
          data-id="${escapeHtml(
            item.id
          )}"
        >
          تعديل
        </button>

        <button
          class="ez-content-btn"
          data-content-action="analyze"
          data-id="${escapeHtml(
            item.id
          )}"
        >
          تحليل AI
        </button>

        ${
          item.status === "review"
            ? `
              <button
                class="ez-content-btn success"
                data-content-action="approve"
                data-id="${escapeHtml(
                  item.id
                )}"
              >
                اعتماد
              </button>
            `
            : ""
        }

        ${
          item.status === "approved" ||
          item.status === "scheduled"
            ? `
              <button
                class="ez-content-btn primary"
                data-content-action="publish"
                data-id="${escapeHtml(
                  item.id
                )}"
              >
                نشر
              </button>
            `
            : ""
        }

        ${
          item.status !== "archived"
            ? `
              <button
                class="ez-content-btn danger"
                data-content-action="archive"
                data-id="${escapeHtml(
                  item.id
                )}"
              >
                أرشفة
              </button>
            `
            : ""
        }
      `
    );
  }

  async function createContent() {
    const form = document.querySelector(
      "#ez-content-create-form"
    );

    if (!form) return;

    const data =
      Object.fromEntries(
        new FormData(form).entries()
      );

    if (!data.title?.trim()) {
      notify(
        "العنوان مطلوب.",
        "warning"
      );
      return;
    }

    try {
      await fetchJSON(
        API.content,
        {
          method: "POST",
          body: JSON.stringify({
            title:
              data.title.trim(),

            headline:
              data.title.trim(),

            type:
              data.type || "news",

            priority:
              data.priority || "normal",

            category:
              data.category?.trim() ||
              "عام",

            slug:
              data.slug?.trim() ||
              undefined,

            summary:
              data.summary?.trim() ||
              "",

            body:
              data.body || ""
          })
        }
      );

      closeModal();

      await loadContent();

      render();

      notify(
        "تم إنشاء المادة.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA create content:",
        error
      );

      notify(
        "تعذر إنشاء المادة.",
        "error"
      );
    }
  }

  async function saveContent() {
    const form = document.querySelector(
      "#ez-content-edit-form"
    );

    if (!form) return;

    const data =
      Object.fromEntries(
        new FormData(form).entries()
      );

    if (!data.id) return;

    try {
      await fetchJSON(
        `${API.content}/${encodeURIComponent(
          data.id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title:
              data.title?.trim(),

            headline:
              data.title?.trim(),

            type:
              data.type,

            priority:
              data.priority,

            category:
              data.category?.trim(),

            slug:
              data.slug?.trim(),

            summary:
              data.summary?.trim(),

            body:
              data.body || ""
          })
        }
      );

      closeModal();

      await loadContent();

      render();

      notify(
        "تم حفظ المادة.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA save content:",
        error
      );

      notify(
        "تعذر حفظ المادة.",
        "error"
      );
    }
  }

  async function contentAction(
    id,
    action
  ) {
    const endpoints = {
      approve: "approve",
      publish: "publish",
      archive: "archive",
      "submit-review":
        "submit-review"
    };

    const endpoint =
      endpoints[action];

    if (!endpoint) return;

    try {
      await fetchJSON(
        `${API.content}/${encodeURIComponent(
          id
        )}/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      await loadContent();

      render();

      notify(
        action === "approve"
          ? "تم اعتماد المادة."
          : action === "publish"
          ? "تم نشر المادة."
          : action === "archive"
          ? "تمت أرشفة المادة."
          : "تم إرسال المادة للمراجعة.",
        "success"
      );
    } catch (error) {
      console.error(
        `EZ MEDIA content ${action}:`,
        error
      );

      notify(
        "تعذر تنفيذ العملية.",
        "error"
      );
    }
  }

  async function analyzeAI(id) {
    const item = getItem(id);

    if (!item) return;

    try {
      notify(
        "جاري إرسال المادة إلى الذكاء الاصطناعي...",
        "info"
      );

      const data = await fetchJSON(
        `${API.ai}/${encodeURIComponent(
          id
        )}/analyze`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      state.ai =
        data.analysis ||
        data.result ||
        data.data ||
        data;

      openAIModal(item, state.ai);
    } catch (error) {
      console.error(
        "EZ MEDIA AI analyze:",
        error
      );

      notify(
        "تعذر تحليل المادة بالذكاء الاصطناعي.",
        "error"
      );
    }
  }

  async function loadLatestAI(id) {
    try {
      const data = await fetchJSON(
        `${API.ai}/${encodeURIComponent(
          id
        )}/latest`
      );

      return (
        data.analysis ||
        data.result ||
        data.data ||
        data
      );
    } catch {
      return null;
    }
  }

  function openAIModal(
    item,
    analysis
  ) {
    const result =
      analysis || {};

    const keywords =
      Array.isArray(
        result.keywords
      )
        ? result.keywords.join("، ")
        : result.keywords || "—";

    const socialPosts =
      result.social_posts ||
      result.socialPosts ||
      {};

    openModal(
      "تحليل الذكاء الاصطناعي",
      `
        <div class="ez-content-ai">

          <h3>
            ${escapeHtml(
              item.title
            )}
          </h3>

          <div class="ez-content-ai-grid">

            ${aiItem(
              "العنوان المقترح",
              result.headline ||
                "—"
            )}

            ${aiItem(
              "الملخص",
              result.summary ||
                "—"
            )}

            ${aiItem(
              "التصنيف",
              result.category ||
                "—"
            )}

            ${aiItem(
              "الكلمات المفتاحية",
              keywords
            )}

            ${aiItem(
              "وصف الفيديو",
              result.video_description ||
                result.videoDescription ||
                "—"
            )}

            ${aiItem(
              "ملاحظات المحرر",
              result.editor_notes ||
                result.editorNotes ||
                "—"
            )}

            ${aiItem(
              "درجة الثقة",
              result.confidence ??
                "—"
            )}

            ${aiItem(
              "مخاطر المحتوى",
              Array.isArray(
                result.risk_flags
              )
                ? result.risk_flags.join(
                    "، "
                  )
                : result.risk_flags ||
                    "لا توجد"
            )}

            ${aiItem(
              "منشور X",
              socialPosts.x ||
                socialPosts.twitter ||
                "—"
            )}

            ${aiItem(
              "منشور Instagram",
              socialPosts.instagram ||
                "—"
            )}

            ${aiItem(
              "منشور TikTok",
              socialPosts.tiktok ||
                "—"
            )}

            ${aiItem(
              "منشور YouTube",
              socialPosts.youtube ||
                "—"
            )}

          </div>

          <p
            style="
              margin-top:15px;
              color:#6f8997;
              line-height:1.8;
            "
          >
            الذكاء الاصطناعي مساعد للتحرير
            والتحليل، والقرار النهائي للمحتوى
            الحساس يبقى ضمن سير العمل التحريري.
          </p>

        </div>
      `,
      `
        <button
          class="ez-content-btn"
          data-content-action="close"
        >
          إغلاق
        </button>

        <button
          class="ez-content-btn primary"
          data-content-action="edit"
          data-id="${escapeHtml(
            item.id
          )}"
        >
          تعديل المادة
        </button>
      `
    );
  }

  function aiItem(label, value) {
    return `
      <div class="ez-content-ai-item">

        <strong>
          ${escapeHtml(label)}
        </strong>

        <p>
          ${escapeHtml(
            String(value ?? "—")
          )}
        </p>

      </div>
    `;
  }

  async function openAIForSelected(id) {
    const item = getItem(id);

    if (!item) return;

    const latest =
      await loadLatestAI(id);

    if (latest) {
      state.ai = latest;
      openAIModal(
        item,
        latest
      );
      return;
    }

    await analyzeAI(id);
  }

  function clearFilters() {
    state.search = "";
    state.type = "all";
    state.status = "all";
    state.priority = "all";
    state.page = 1;

    loadContent().then(render);
  }

  function bindEvents() {
    const section = document.querySelector(
      "#content-command-section"
    );

    if (!section) return;

    section
      .querySelectorAll(
        "[data-content-action]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const action =
              button.dataset
                .contentAction;

            const id =
              button.dataset.id;

            if (action === "new") {
              openCreate();
              return;
            }

            if (action === "close") {
              closeModal();
              return;
            }

            if (action === "save-new") {
              await createContent();
              return;
            }

            if (action === "save-edit") {
              await saveContent();
              return;
            }

            if (action === "open") {
              openDetails(id);
              return;
            }

            if (action === "edit") {
              openEdit(id);
              return;
            }

            if (
              action === "approve" ||
              action === "publish" ||
              action === "archive" ||
              action === "submit-review"
            ) {
              await contentAction(
                id,
                action
              );
              return;
            }

            if (action === "analyze") {
              await openAIForSelected(id);
              return;
            }

            if (action === "ai") {
              if (state.selected) {
                await openAIForSelected(
                  state.selected.id
                );
              } else {
                notify(
                  "اختر مادة أولًا لتحليلها.",
                  "warning"
                );
              }
              return;
            }

            if (action === "refresh") {
              await loadContent();
              render();

              notify(
                "تم تحديث المحتوى.",
                "success"
              );

              return;
            }

            if (action === "clear") {
              clearFilters();
            }
          }
        );
      });

    const search =
      section.querySelector(
        "#ez-content-search"
      );

    if (search) {
      search.addEventListener(
        "input",
        (event) => {
          state.search =
            event.target.value;

          clearTimeout(
            search._timer
          );

          search._timer =
            setTimeout(
              async () => {
                state.page = 1;
                await loadContent();
                render();
              },
              350
            );
        }
      );
    }

    const type =
      section.querySelector(
        "#ez-content-type"
      );

    if (type) {
      type.addEventListener(
        "change",
        async (event) => {
          state.type =
            event.target.value;

          state.page = 1;

          await loadContent();

          render();
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-content-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        async (event) => {
          state.status =
            event.target.value;

          state.page = 1;

          await loadContent();

          render();
        }
      );
    }

    const priority =
      section.querySelector(
        "#ez-content-priority"
      );

    if (priority) {
      priority.addEventListener(
        "change",
        async (event) => {
          state.priority =
            event.target.value;

          state.page = 1;

          await loadContent();

          render();
        }
      );
    }

    const modal =
      document.querySelector(
        "#ez-content-command-modal"
      );

    if (modal) {
      modal.addEventListener(
        "click",
        (event) => {
          if (
            event.target === modal
          ) {
            closeModal();
          }
        }
      );
    }
  }

  async function refresh() {
    await loadContent();
    render();
  }

  function show() {
    const section =
      ensureSection();

    section.hidden = false;

    injectStyles();

    refresh().catch(
      (error) => {
        console.error(
          "EZ MEDIA Content Command:",
          error
        );

        notify(
          "تعذر تشغيل مركز المحتوى.",
          "error"
        );
      }
    );
  }

  function hide() {
    const section =
      document.querySelector(
        "#content-command-section"
      );

    if (section) {
      section.hidden = true;
    }
  }

  function openById(id) {
    show();

    setTimeout(() => {
      openDetails(id);
    }, 250);
  }

  function getItems() {
    return [...state.items];
  }

  window.EZMediaAdminContentCommand = {
    module: MODULE,
    show,
    hide,
    refresh,
    openById,
    getItems
  };

  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const section =
        event.detail?.section ||
        event.detail?.target;

      if (
        section === "content-command" ||
        section === "content"
      ) {
        show();
      }
    }
  );

  window.addEventListener(
    "ezmedia:content:updated",
    async () => {
      await refresh();
    }
  );

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        injectStyles();
        ensureSection();
      },
      { once: true }
    );
  } else {
    injectStyles();
    ensureSection();
  }

  console.info(
    "EZ MEDIA 11.0 — Content Command loaded."
  );
})();
