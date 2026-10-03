"use strict";

/*
 * EZ MEDIA 11.0
 * Admin Content Manager
 *
 * المسؤول عن:
 * - عرض المحتوى
 * - إنشاء محتوى جديد
 * - تعديل المحتوى
 * - حفظ مسودة
 * - إرسال للمراجعة
 * - اعتماد المحتوى
 * - نشر المحتوى
 * - أرشفة المحتوى
 * - تحليل المحتوى بالذكاء الاصطناعي
 * - عرض نتائج AI
 */

(function () {
  const state = {
    contents: [],
    selectedContent: null,
    loading: false,
    aiLoading: false,
    page: 1,
    limit: 50,
    filter: {
      status: "",
      type: "",
      search: ""
    }
  };

  const API = "/api";

  const CONTENT_TYPES = [
    { value: "news", label: "خبر" },
    { value: "report", label: "تقرير" },
    { value: "interview", label: "مقابلة" },
    { value: "video", label: "فيديو" },
    { value: "coverage", label: "تغطية" },
    { value: "breaking", label: "عاجل" }
  ];

  const CONTENT_STATUSES = [
    { value: "draft", label: "مسودة" },
    { value: "review", label: "قيد المراجعة" },
    { value: "approved", label: "معتمد" },
    { value: "scheduled", label: "مجدول" },
    { value: "published", label: "منشور" },
    { value: "archived", label: "مؤرشف" }
  ];

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function typeLabel(type) {
    const item = CONTENT_TYPES.find((entry) => entry.value === type);
    return item ? item.label : type || "غير محدد";
  }

  function statusLabel(status) {
    const item = CONTENT_STATUSES.find((entry) => entry.value === status);
    return item ? item.label : status || "غير محدد";
  }

  function statusClass(status) {
    const map = {
      draft: "draft",
      review: "review",
      approved: "approved",
      scheduled: "scheduled",
      published: "published",
      archived: "archived"
    };

    return map[status] || "draft";
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `فشل الطلب HTTP ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  function notify(message, type = "info") {
    let container = document.getElementById("ez-admin-notifications");

    if (!container) {
      container = document.createElement("div");
      container.id = "ez-admin-notifications";

      Object.assign(container.style, {
        position: "fixed",
        top: "20px",
        left: "20px",
        zIndex: "99999",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "min(380px, calc(100vw - 40px))"
      });

      document.body.appendChild(container);
    }

    const item = document.createElement("div");

    Object.assign(item.style, {
      padding: "14px 16px",
      borderRadius: "16px",
      background:
        type === "error"
          ? "#fff1f2"
          : type === "success"
            ? "#ecfdf5"
            : "#eff6ff",
      border:
        type === "error"
          ? "1px solid #fecdd3"
          : type === "success"
            ? "1px solid #a7f3d0"
            : "1px solid #bfdbfe",
      color: "#164e63",
      boxShadow: "0 15px 40px rgba(14, 116, 144, 0.12)",
      fontFamily: "inherit",
      fontSize: "14px",
      lineHeight: "1.7"
    });

    item.textContent = message;

    container.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 4500);
  }

  function ensureStyles() {
    if (document.getElementById("ez-admin-content-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "ez-admin-content-styles";

    style.textContent = `
      #ez-content-manager {
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
        color: #164e63;
      }

      #ez-content-manager * {
        box-sizing: border-box;
      }

      .ez-content-shell {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.8fr);
        gap: 20px;
        align-items: start;
      }

      .ez-content-panel {
        background: rgba(255,255,255,.94);
        border: 1px solid #dbeafe;
        border-radius: 24px;
        box-shadow: 0 15px 45px rgba(14, 165, 233, .08);
        overflow: hidden;
      }

      .ez-content-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 18px 20px;
        border-bottom: 1px solid #e0f2fe;
        background:
          linear-gradient(
            135deg,
            rgba(240,249,255,.95),
            rgba(255,255,255,.98)
          );
      }

      .ez-content-title {
        margin: 0;
        font-size: 18px;
        font-weight: 800;
        color: #075985;
      }

      .ez-content-subtitle {
        margin: 4px 0 0;
        font-size: 12px;
        color: #64748b;
      }

      .ez-content-body {
        padding: 20px;
      }

      .ez-content-toolbar {
        display: grid;
        grid-template-columns: 1fr 160px 160px auto;
        gap: 10px;
        margin-bottom: 18px;
      }

      .ez-content-input,
      .ez-content-select,
      .ez-content-textarea {
        width: 100%;
        border: 1px solid #cbdff0;
        border-radius: 14px;
        background: #ffffff;
        color: #164e63;
        padding: 12px 14px;
        outline: none;
        font: inherit;
        transition: .2s ease;
      }

      .ez-content-input:focus,
      .ez-content-select:focus,
      .ez-content-textarea:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 0 4px rgba(56,189,248,.12);
      }

      .ez-content-textarea {
        min-height: 150px;
        resize: vertical;
        line-height: 1.8;
      }

      .ez-content-button {
        border: 0;
        border-radius: 14px;
        padding: 11px 15px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: .2s ease;
        white-space: nowrap;
      }

      .ez-content-button:hover {
        transform: translateY(-1px);
      }

      .ez-content-button.primary {
        background: linear-gradient(135deg, #0ea5e9, #38bdf8);
        color: white;
      }

      .ez-content-button.secondary {
        background: #e0f2fe;
        color: #075985;
      }

      .ez-content-button.success {
        background: #d1fae5;
        color: #047857;
      }

      .ez-content-button.warning {
        background: #fef3c7;
        color: #92400e;
      }

      .ez-content-button.danger {
        background: #ffe4e6;
        color: #be123c;
      }

      .ez-content-button.light {
        background: #f0f9ff;
        color: #0369a1;
      }

      .ez-content-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .ez-content-item {
        border: 1px solid #e0f2fe;
        border-radius: 18px;
        padding: 15px;
        background: #ffffff;
        cursor: pointer;
        transition: .2s ease;
      }

      .ez-content-item:hover {
        border-color: #7dd3fc;
        box-shadow: 0 10px 30px rgba(14,165,233,.08);
      }

      .ez-content-item.active {
        border-color: #38bdf8;
        background: linear-gradient(135deg,#f0f9ff,#ffffff);
      }

      .ez-content-item-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }

      .ez-content-item-title {
        font-size: 15px;
        line-height: 1.7;
        font-weight: 800;
        color: #0f4c5c;
      }

      .ez-content-item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 10px;
      }

      .ez-content-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 11px;
        font-weight: 800;
        background: #f0f9ff;
        color: #0369a1;
      }

      .ez-content-status.draft {
        background: #f0f9ff;
        color: #0369a1;
      }

      .ez-content-status.review {
        background: #fef3c7;
        color: #92400e;
      }

      .ez-content-status.approved {
        background: #dcfce7;
        color: #166534;
      }

      .ez-content-status.scheduled {
        background: #e0e7ff;
        color: #4338ca;
      }

      .ez-content-status.published {
        background: #cffafe;
        color: #0e7490;
      }

      .ez-content-status.archived {
        background: #f1f5f9;
        color: #475569;
      }

      .ez-content-empty {
        text-align: center;
        padding: 45px 20px;
        color: #64748b;
      }

      .ez-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .ez-form-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ez-form-field.full {
        grid-column: 1 / -1;
      }

      .ez-form-label {
        font-size: 12px;
        font-weight: 800;
        color: #0c4a6e;
      }

      .ez-content-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 18px;
      }

      .ez-content-divider {
        height: 1px;
        background: #e0f2fe;
        margin: 20px 0;
      }

      .ez-ai-box {
        margin-top: 20px;
        border: 1px solid #bae6fd;
        border-radius: 20px;
        padding: 16px;
        background:
          linear-gradient(
            135deg,
            rgba(240,249,255,.9),
            rgba(255,255,255,.98)
          );
      }

      .ez-ai-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }

      .ez-ai-title {
        margin: 0;
        font-size: 15px;
        font-weight: 900;
        color: #0369a1;
      }

      .ez-ai-result {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .ez-ai-result-card {
        border: 1px solid #dbeafe;
        border-radius: 14px;
        padding: 12px;
        background: white;
      }

      .ez-ai-result-label {
        display: block;
        margin-bottom: 5px;
        font-size: 11px;
        font-weight: 900;
        color: #0284c7;
      }

      .ez-ai-result-value {
        font-size: 13px;
        line-height: 1.8;
        white-space: pre-wrap;
        color: #334155;
      }

      .ez-content-loader {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 160px;
        color: #0284c7;
        font-weight: 800;
      }

      .ez-spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #bae6fd;
        border-top-color: #0284c7;
        border-radius: 50%;
        animation: ez-spin .8s linear infinite;
        margin-left: 8px;
      }

      @keyframes ez-spin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 1100px) {
        .ez-content-shell {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 800px) {
        .ez-content-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-form-grid {
          grid-template-columns: 1fr;
        }

        .ez-form-field.full {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function mount() {
    ensureStyles();

    let root = document.getElementById("ez-content-manager");

    if (!root) {
      const host =
        document.getElementById("content-section") ||
        document.querySelector("[data-ez-section='content']") ||
        document.querySelector(".content-section");

      if (!host) {
        return;
      }

      root = document.createElement("div");
      root.id = "ez-content-manager";

      host.innerHTML = "";
      host.appendChild(root);
    }

    root.innerHTML = `
      <div class="ez-content-shell">

        <section class="ez-content-panel">

          <div class="ez-content-panel-header">
            <div>
              <h2 class="ez-content-title">إدارة المحتوى</h2>
              <p class="ez-content-subtitle">
                إنشاء وإدارة ومراجعة ونشر المحتوى الإعلامي
              </p>
            </div>

            <button
              type="button"
              class="ez-content-button primary"
              id="ez-new-content"
            >
              + محتوى جديد
            </button>
          </div>

          <div class="ez-content-body">

            <div class="ez-content-toolbar">

              <input
                id="ez-content-search"
                class="ez-content-input"
                type="search"
                placeholder="ابحث في العناوين..."
              />

              <select
                id="ez-content-status-filter"
                class="ez-content-select"
              >
                <option value="">كل الحالات</option>
                ${CONTENT_STATUSES.map(
                  (item) =>
                    `<option value="${item.value}">${item.label}</option>`
                ).join("")}
              </select>

              <select
                id="ez-content-type-filter"
                class="ez-content-select"
              >
                <option value="">كل الأنواع</option>
                ${CONTENT_TYPES.map(
                  (item) =>
                    `<option value="${item.value}">${item.label}</option>`
                ).join("")}
              </select>

              <button
                type="button"
                class="ez-content-button secondary"
                id="ez-refresh-content"
              >
                تحديث
              </button>

            </div>

            <div id="ez-content-list" class="ez-content-list">
              <div class="ez-content-loader">
                جاري تحميل المحتوى
                <span class="ez-spinner"></span>
              </div>
            </div>

          </div>

        </section>

        <section class="ez-content-panel">

          <div class="ez-content-panel-header">
            <div>
              <h2 class="ez-content-title">محرر المحتوى</h2>
              <p class="ez-content-subtitle" id="ez-editor-mode">
                اختر محتوى أو أنشئ محتوى جديدًا
              </p>
            </div>
          </div>

          <div class="ez-content-body">

            <form id="ez-content-form">

              <input
                type="hidden"
                id="ez-content-id"
              />

              <div class="ez-form-grid">

                <div class="ez-form-field full">
                  <label class="ez-form-label" for="ez-content-title-input">
                    العنوان
                  </label>

                  <input
                    id="ez-content-title-input"
                    class="ez-content-input"
                    type="text"
                    maxlength="500"
                    placeholder="اكتب عنوان المحتوى"
                    required
                  />
                </div>

                <div class="ez-form-field">
                  <label class="ez-form-label" for="ez-content-type-input">
                    نوع المحتوى
                  </label>

                  <select
                    id="ez-content-type-input"
                    class="ez-content-select"
                    required
                  >
                    ${CONTENT_TYPES.map(
                      (item) =>
                        `<option value="${item.value}">${item.label}</option>`
                    ).join("")}
                  </select>
                </div>

                <div class="ez-form-field">
                  <label class="ez-form-label" for="ez-content-status-input">
                    الحالة
                  </label>

                  <select
                    id="ez-content-status-input"
                    class="ez-content-select"
                  >
                    ${CONTENT_STATUSES.map(
                      (item) =>
                        `<option value="${item.value}">${item.label}</option>`
                    ).join("")}
                  </select>
                </div>

                <div class="ez-form-field full">
                  <label class="ez-form-label" for="ez-content-summary-input">
                    الملخص
                  </label>

                  <textarea
                    id="ez-content-summary-input"
                    class="ez-content-textarea"
                    placeholder="ملخص مختصر للمحتوى"
                  ></textarea>
                </div>

                <div class="ez-form-field full">
                  <label class="ez-form-label" for="ez-content-body-input">
                    النص الكامل
                  </label>

                  <textarea
                    id="ez-content-body-input"
                    class="ez-content-textarea"
                    style="min-height:260px"
                    placeholder="اكتب النص الكامل للمحتوى..."
                  ></textarea>
                </div>

                <div class="ez-form-field">
                  <label class="ez-form-label" for="ez-content-category-input">
                    التصنيف
                  </label>

                  <input
                    id="ez-content-category-input"
                    class="ez-content-input"
                    type="text"
                    placeholder="مثال: محلي، اقتصادي، رياضي"
                  />
                </div>

                <div class="ez-form-field">
                  <label class="ez-form-label" for="ez-content-author-input">
                    الكاتب / المحرر
                  </label>

                  <input
                    id="ez-content-author-input"
                    class="ez-content-input"
                    type="text"
                    placeholder="اسم الكاتب أو المحرر"
                  />
                </div>

                <div class="ez-form-field full">
                  <label class="ez-form-label" for="ez-content-tags-input">
                    الكلمات المفتاحية
                  </label>

                  <input
                    id="ez-content-tags-input"
                    class="ez-content-input"
                    type="text"
                    placeholder="خبر، السعودية، المدينة المنورة"
                  />
                </div>

                <div class="ez-form-field">
                  <label class="ez-form-label" for="ez-content-image-input">
                    صورة رئيسية
                  </label>

                  <input
                    id="ez-content-image-input"
                    class="ez-content-input"
                    type="url"
                    placeholder="https://..."
                  />
                </div>

                <div class="ez-form-field">
                  <label class="ez-form-label" for="ez-content-video-input">
                    رابط الفيديو
                  </label>

                  <input
                    id="ez-content-video-input"
                    class="ez-content-input"
                    type="url"
                    placeholder="https://..."
                  />
                </div>

              </div>

              <div class="ez-content-actions">

                <button
                  type="submit"
                  class="ez-content-button primary"
                >
                  حفظ المحتوى
                </button>

                <button
                  type="button"
                  class="ez-content-button secondary"
                  id="ez-submit-review"
                >
                  إرسال للمراجعة
                </button>

                <button
                  type="button"
                  class="ez-content-button success"
                  id="ez-approve-content"
                >
                  اعتماد
                </button>

                <button
                  type="button"
                  class="ez-content-button primary"
                  id="ez-publish-content"
                >
                  نشر
                </button>

                <button
                  type="button"
                  class="ez-content-button warning"
                  id="ez-archive-content"
                >
                  أرشفة
                </button>

                <button
                  type="button"
                  class="ez-content-button light"
                  id="ez-clear-editor"
                >
                  مسح
                </button>

              </div>

            </form>

            <div class="ez-content-divider"></div>

            <section class="ez-ai-box">

              <div class="ez-ai-header">

                <div>
                  <h3 class="ez-ai-title">
                    مركز الذكاء الاصطناعي
                  </h3>

                  <div class="ez-content-subtitle">
                    تحليل المحتوى واقتراح العنوان والملخص والكلمات والمنشورات
                  </div>
                </div>

                <button
                  type="button"
                  class="ez-content-button secondary"
                  id="ez-ai-analyze"
                >
                  تحليل المحتوى
                </button>

              </div>

              <div
                id="ez-ai-result"
                class="ez-ai-result"
              >
                <div class="ez-content-empty">
                  لا يوجد تحليل بعد.
                </div>
              </div>

            </section>

          </div>

        </section>

      </div>
    `;

    bindEvents();
    loadContents();
  }

  function bindEvents() {
    document
      .getElementById("ez-new-content")
      ?.addEventListener("click", () => {
        clearEditor();
      });

    document
      .getElementById("ez-refresh-content")
      ?.addEventListener("click", () => {
        loadContents();
      });

    document
      .getElementById("ez-content-search")
      ?.addEventListener("input", debounce(() => {
        state.filter.search =
          document.getElementById("ez-content-search").value.trim();

        renderContentList();
      }, 250));

    document
      .getElementById("ez-content-status-filter")
      ?.addEventListener("change", (event) => {
        state.filter.status = event.target.value;
        loadContents();
      });

    document
      .getElementById("ez-content-type-filter")
      ?.addEventListener("change", (event) => {
        state.filter.type = event.target.value;
        loadContents();
      });

    document
      .getElementById("ez-content-form")
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await saveContent();
      });

    document
      .getElementById("ez-submit-review")
      ?.addEventListener("click", () => {
        runContentAction("submit-review");
      });

    document
      .getElementById("ez-approve-content")
      ?.addEventListener("click", () => {
        runContentAction("approve");
      });

    document
      .getElementById("ez-publish-content")
      ?.addEventListener("click", () => {
        runContentAction("publish");
      });

    document
      .getElementById("ez-archive-content")
      ?.addEventListener("click", () => {
        runContentAction("archive");
      });

    document
      .getElementById("ez-clear-editor")
      ?.addEventListener("click", () => {
        clearEditor();
      });

    document
      .getElementById("ez-ai-analyze")
      ?.addEventListener("click", () => {
        analyzeWithAI();
      });
  }

  async function loadContents() {
    if (state.loading) {
      return;
    }

    state.loading = true;

    renderLoading();

    try {
      const params = new URLSearchParams();

      params.set("limit", String(state.limit));
      params.set("page", String(state.page));

      if (state.filter.status) {
        params.set("status", state.filter.status);
      }

      if (state.filter.type) {
        params.set("type", state.filter.type);
      }

      const data = await request(
        `${API}/content?${params.toString()}`
      );

      state.contents = normalizeContentResponse(data);

      renderContentList();

    } catch (error) {
      console.error("EZ MEDIA content loading error:", error);

      document.getElementById("ez-content-list").innerHTML = `
        <div class="ez-content-empty">
          تعذر تحميل المحتوى.
          <br>
          <small>${escapeHtml(error.message)}</small>
        </div>
      `;

      notify(
        `تعذر تحميل المحتوى: ${error.message}`,
        "error"
      );
    } finally {
      state.loading = false;
    }
  }

  function normalizeContentResponse(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.contents)) {
      return data.contents;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }

  function renderLoading() {
    const list = document.getElementById("ez-content-list");

    if (!list) {
      return;
    }

    list.innerHTML = `
      <div class="ez-content-loader">
        جاري تحميل المحتوى
        <span class="ez-spinner"></span>
      </div>
    `;
  }

  function renderContentList() {
    const list = document.getElementById("ez-content-list");

    if (!list) {
      return;
    }

    const search = state.filter.search.toLowerCase();

    const filtered = state.contents.filter((item) => {
      if (!search) {
        return true;
      }

      const title = String(
        item.title ||
        item.headline ||
        ""
      ).toLowerCase();

      const summary = String(
        item.summary ||
        ""
      ).toLowerCase();

      return (
        title.includes(search) ||
        summary.includes(search)
      );
    });

    if (!filtered.length) {
      list.innerHTML = `
        <div class="ez-content-empty">
          لا يوجد محتوى مطابق حاليًا.
        </div>
      `;

      return;
    }

    list.innerHTML = filtered
      .map((item) => {
        const id = item.id;

        const title =
          item.title ||
          item.headline ||
          "بدون عنوان";

        const type =
          item.type ||
          item.content_type ||
          "news";

        const status =
          item.status ||
          "draft";

        const created =
          item.created_at ||
          item.createdAt;

        return `
          <article
            class="ez-content-item ${
              state.selectedContent?.id === id
                ? "active"
                : ""
            }"
            data-content-id="${escapeHtml(id)}"
          >

            <div class="ez-content-item-top">

              <div class="ez-content-item-title">
                ${escapeHtml(title)}
              </div>

              <span
                class="
                  ez-content-badge
                  ez-content-status
                  ${statusClass(status)}
                "
              >
                ${escapeHtml(statusLabel(status))}
              </span>

            </div>

            <div class="ez-content-item-meta">

              <span class="ez-content-badge">
                ${escapeHtml(typeLabel(type))}
              </span>

              <span class="ez-content-badge">
                ${escapeHtml(formatDate(created))}
              </span>

            </div>

          </article>
        `;
      })
      .join("");

    list
      .querySelectorAll("[data-content-id]")
      .forEach((element) => {
        element.addEventListener("click", () => {
          const id = element.dataset.contentId;
          selectContent(id);
        });
      });
  }

  async function selectContent(id) {
    try {
      const data = await request(
        `${API}/content/${encodeURIComponent(id)}`
      );

      const content =
        data?.content ||
        data?.data ||
        data;

      state.selectedContent = content;

      fillEditor(content);
      renderContentList();

      await loadLatestAI(id);

    } catch (error) {
      console.error("EZ MEDIA content selection error:", error);

      notify(
        `تعذر فتح المحتوى: ${error.message}`,
        "error"
      );
    }
  }

  function fillEditor(content) {
    document.getElementById("ez-content-id").value =
      content?.id || "";

    document.getElementById("ez-content-title-input").value =
      content?.title ||
      content?.headline ||
      "";

    document.getElementById("ez-content-type-input").value =
      content?.type ||
      content?.content_type ||
      "news";

    document.getElementById("ez-content-status-input").value =
      content?.status ||
      "draft";

    document.getElementById("ez-content-summary-input").value =
      content?.summary ||
      "";

    document.getElementById("ez-content-body-input").value =
      content?.body ||
      content?.body_text ||
      content?.content ||
      "";

    document.getElementById("ez-content-category-input").value =
      content?.category ||
      "";

    document.getElementById("ez-content-author-input").value =
      content?.author_name ||
      content?.author ||
      "";

    document.getElementById("ez-content-tags-input").value =
      Array.isArray(content?.tags)
        ? content.tags.join(", ")
        : content?.tags || "";

    document.getElementById("ez-content-image-input").value =
      content?.image_url ||
      content?.imageUrl ||
      "";

    document.getElementById("ez-content-video-input").value =
      content?.video_url ||
      content?.videoUrl ||
      "";

    document.getElementById("ez-editor-mode").textContent =
      `تحرير: ${
        content?.title ||
        content?.headline ||
        "محتوى"
      }`;
  }

  function clearEditor() {
    state.selectedContent = null;

    const form = document.getElementById("ez-content-form");

    if (form) {
      form.reset();
    }

    document.getElementById("ez-content-id").value = "";

    document.getElementById("ez-content-type-input").value =
      "news";

    document.getElementById("ez-content-status-input").value =
      "draft";

    document.getElementById("ez-editor-mode").textContent =
      "إنشاء محتوى جديد";

    document.getElementById("ez-ai-result").innerHTML = `
      <div class="ez-content-empty">
        لا يوجد تحليل بعد.
      </div>
    `;

    renderContentList();
  }

  function collectFormData() {
    const tagsValue =
      document.getElementById("ez-content-tags-input").value;

    const tags = tagsValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      title:
        document.getElementById("ez-content-title-input").value.trim(),

      type:
        document.getElementById("ez-content-type-input").value,

      status:
        document.getElementById("ez-content-status-input").value,

      summary:
        document.getElementById("ez-content-summary-input").value.trim(),

      body:
        document.getElementById("ez-content-body-input").value.trim(),

      category:
        document.getElementById("ez-content-category-input").value.trim(),

      author_name:
        document.getElementById("ez-content-author-input").value.trim(),

      tags,

      image_url:
        document.getElementById("ez-content-image-input").value.trim(),

      video_url:
        document.getElementById("ez-content-video-input").value.trim()
    };
  }

  async function saveContent() {
    const id =
      document.getElementById("ez-content-id").value.trim();

    const payload = collectFormData();

    if (!payload.title) {
      notify("اكتب عنوان المحتوى أولًا.", "error");
      return;
    }

    try {
      let data;

      if (id) {
        data = await request(
          `${API}/content/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );

        notify(
          "تم تحديث المحتوى.",
          "success"
        );
      } else {
        data = await request(
          `${API}/content`,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );

        notify(
          "تم إنشاء المحتوى.",
          "success"
        );
      }

      const content =
        data?.content ||
        data?.data ||
        data;

      if (content?.id) {
        state.selectedContent = content;
        fillEditor(content);
      }

      await loadContents();

    } catch (error) {
      console.error("EZ MEDIA save content error:", error);

      notify(
        `تعذر حفظ المحتوى: ${error.message}`,
        "error"
      );
    }
  }

  async function runContentAction(action) {
    const id =
      document.getElementById("ez-content-id").value.trim();

    if (!id) {
      notify(
        "اختر محتوى أولًا.",
        "error"
      );

      return;
    }

    const endpointMap = {
      "submit-review": "submit-review",
      approve: "approve",
      publish: "publish",
      archive: "archive"
    };

    const endpoint = endpointMap[action];

    if (!endpoint) {
      return;
    }

    try {
      const data = await request(
        `${API}/content/${encodeURIComponent(id)}/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      const content =
        data?.content ||
        data?.data ||
        data;

      if (content && typeof content === "object") {
        state.selectedContent = content;
        fillEditor(content);
      }

      notify(
        action === "submit-review"
          ? "تم إرسال المحتوى للمراجعة."
          : action === "approve"
            ? "تم اعتماد المحتوى."
            : action === "publish"
              ? "تم نشر المحتوى."
              : "تمت أرشفة المحتوى.",
        "success"
      );

      await loadContents();

    } catch (error) {
      console.error(
        `EZ MEDIA content action ${action} error:`,
        error
      );

      notify(
        `تعذر تنفيذ العملية: ${error.message}`,
        "error"
      );
    }
  }

  async function analyzeWithAI() {
    const id =
      document.getElementById("ez-content-id").value.trim();

    if (!id) {
      notify(
        "احفظ المحتوى أولًا حتى يمكن تحليله بالذكاء الاصطناعي.",
        "error"
      );

      return;
    }

    if (state.aiLoading) {
      return;
    }

    state.aiLoading = true;

    const button =
      document.getElementById("ez-ai-analyze");

    if (button) {
      button.disabled = true;
      button.textContent = "جاري التحليل...";
    }

    document.getElementById("ez-ai-result").innerHTML = `
      <div class="ez-content-loader">
        الذكاء الاصطناعي يحلل المحتوى
        <span class="ez-spinner"></span>
      </div>
    `;

    try {
      const data = await request(
        `${API}/ai/content/${encodeURIComponent(id)}/analyze`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      const result =
        data?.result ||
        data?.analysis ||
        data?.data ||
        data;

      renderAIResult(result);

      notify(
        "تم تحليل المحتوى بالذكاء الاصطناعي.",
        "success"
      );

    } catch (error) {
      console.error(
        "EZ MEDIA AI analysis error:",
        error
      );

      document.getElementById("ez-ai-result").innerHTML = `
        <div class="ez-content-empty">
          تعذر تنفيذ تحليل الذكاء الاصطناعي.
          <br>
          <small>${escapeHtml(error.message)}</small>
        </div>
      `;

      notify(
        `تعذر تحليل المحتوى: ${error.message}`,
        "error"
      );

    } finally {
      state.aiLoading = false;

      if (button) {
        button.disabled = false;
        button.textContent = "تحليل المحتوى";
      }
    }
  }

  async function loadLatestAI(id) {
    if (!id) {
      return;
    }

    try {
      const data = await request(
        `${API}/ai/content/${encodeURIComponent(id)}/latest`
      );

      const result =
        data?.result ||
        data?.analysis ||
        data?.data ||
        data;

      if (result && Object.keys(result).length) {
        renderAIResult(result);
      }

    } catch (error) {
      /*
       * عدم وجود تحليل سابق ليس خطأ للمستخدم.
       */
      console.debug(
        "No previous AI analysis:",
        error.message
      );
    }
  }

  function renderAIResult(result) {
    const container =
      document.getElementById("ez-ai-result");

    if (!container) {
      return;
    }

    if (!result || typeof result !== "object") {
      container.innerHTML = `
        <div class="ez-content-empty">
          لم يتم العثور على نتيجة تحليل.
        </div>
      `;

      return;
    }

    const fields = [
      ["headline", "العنوان المقترح"],
      ["summary", "الملخص المقترح"],
      ["category", "التصنيف"],
      ["keywords", "الكلمات المفتاحية"],
      ["social_posts", "منشورات التواصل"],
      ["video_description", "وصف الفيديو"],
      ["editor_notes", "ملاحظات المحرر"],
      ["risk_flags", "مؤشرات المخاطر"],
      ["confidence", "درجة الثقة"]
    ];

    const html = [];

    fields.forEach(([key, label]) => {
      const value = result[key];

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return;
      }

      let output = value;

      if (Array.isArray(value)) {
        output = value.join("\n");
      }

      if (typeof value === "object") {
        output = JSON.stringify(
          value,
          null,
          2
        );
      }

      html.push(`
        <div class="ez-ai-result-card">

          <span class="ez-ai-result-label">
            ${escapeHtml(label)}
          </span>

          <div class="ez-ai-result-value">
            ${escapeHtml(output)}
          </div>

        </div>
      `);
    });

    if (!html.length) {
      container.innerHTML = `
        <div class="ez-content-empty">
          تم تنفيذ التحليل ولكن لم تصل بيانات قابلة للعرض.
        </div>
      `;

      return;
    }

    container.innerHTML = html.join("");
  }

  function debounce(callback, delay) {
    let timer;

    return function (...args) {
      clearTimeout(timer);

      timer = setTimeout(() => {
        callback.apply(this, args);
      }, delay);
    };
  }

  /*
   * تشغيل الوحدة.
   */
  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      mount
    );
  } else {
    mount();
  }

  /*
   * إتاحة التحكم من لوحة الإدارة عند الحاجة.
   */
  window.EZMediaAdminContent = {
    reload: loadContents,
    newContent: clearEditor,
    selectContent
  };
})();
