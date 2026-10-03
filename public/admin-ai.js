"use strict";

/*
 * EZ MEDIA 11.0
 * مركز الذكاء الاصطناعي
 *
 * الملف:
 * public/admin-ai.js
 *
 * يعتمد على الـ API الموجود مسبقًا:
 *
 * GET  /api/content
 * GET  /api/content/:id
 *
 * POST /api/ai/content/:id/analyze
 * GET  /api/ai/content/:id/latest
 *
 * لا ينشئ هذا الملف أي API جديد.
 */

(function () {
  "use strict";

  const API = {
    content: "/api/content",
    ai: "/api/ai"
  };

  const state = {
    contents: [],
    selectedContent: null,
    selectedAnalysis: null,
    loading: false,
    analyzing: false,
    filters: {
      search: "",
      type: "all",
      status: "all"
    }
  };

  const colors = {
    primary: "#38bdf8",
    primaryDark: "#0284c7",
    cyan: "#06b6d4",
    ice: "#e0f2fe",
    background: "#f8fbff",
    white: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    border: "#dbeafe",
    success: "#16a34a",
    warning: "#f59e0b",
    danger: "#ef4444"
  };

  function escapeHTML(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ar-SA").format(
      Number(value || 0)
    );
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatPercent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "—";
    }

    const normalized =
      number <= 1
        ? number * 100
        : number;

    return `${normalized.toFixed(0)}%`;
  }

  function getContentTypeLabel(type) {
    const labels = {
      news: "خبر",
      report: "تقرير",
      interview: "مقابلة",
      video: "فيديو",
      coverage: "تغطية",
      breaking: "عاجل"
    };

    return labels[type] || type || "محتوى";
  }

  function getStatusLabel(status) {
    const labels = {
      draft: "مسودة",
      review: "قيد المراجعة",
      approved: "معتمد",
      scheduled: "مجدول",
      published: "منشور",
      archived: "مؤرشف"
    };

    return labels[status] || status || "غير محدد";
  }

  function getRiskLabel(value) {
    const text = String(value || "").toLowerCase();

    if (
      text.includes("high") ||
      text.includes("critical") ||
      text.includes("عالي") ||
      text.includes("مرتفع")
    ) {
      return "مرتفع";
    }

    if (
      text.includes("medium") ||
      text.includes("moderate") ||
      text.includes("متوسط")
    ) {
      return "متوسط";
    }

    return "منخفض";
  }

  async function apiRequest(
    url,
    options = {}
  ) {
    const config = {
      method:
        options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    };

    if (
      options.body !== undefined
    ) {
      config.headers[
        "Content-Type"
      ] = "application/json";

      config.body =
        JSON.stringify(
          options.body
        );
    }

    const response =
      await fetch(
        url,
        config
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `فشل الطلب (${response.status})`
      );
    }

    return data;
  }

  function unwrapArray(
    data,
    keys = []
  ) {
    if (Array.isArray(data)) {
      return data;
    }

    for (
      const key of keys
    ) {
      if (
        Array.isArray(
          data?.[key]
        )
      ) {
        return data[key];
      }

      if (
        Array.isArray(
          data?.data?.[key]
        )
      ) {
        return data.data[key];
      }
    }

    if (
      Array.isArray(
        data?.data
      )
    ) {
      return data.data;
    }

    return [];
  }

  function unwrapObject(data) {
    if (!data) {
      return null;
    }

    if (
      data.data &&
      typeof data.data ===
        "object"
    ) {
      return data.data;
    }

    return data;
  }

  function ensureStyles() {
    if (
      document.getElementById(
        "ez-ai-admin-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-ai-admin-styles";

    style.textContent = `
      #ez-ai-admin {
        direction: rtl;
        width: 100%;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
        color: ${colors.text};
      }

      #ez-ai-admin *,
      #ez-ai-admin *::before,
      #ez-ai-admin *::after {
        box-sizing: border-box;
      }

      .ez-ai-shell {
        width: 100%;
        background:
          radial-gradient(
            circle at top right,
            rgba(56,189,248,.14),
            transparent 28%
          ),
          ${colors.background};
        border: 1px solid ${colors.border};
        border-radius: 24px;
        padding: 22px;
        overflow: hidden;
      }

      .ez-ai-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        margin-bottom: 22px;
      }

      .ez-ai-title h2 {
        margin: 0 0 7px;
        font-size: 28px;
        font-weight: 950;
        letter-spacing: -.6px;
      }

      .ez-ai-title p {
        margin: 0;
        color: ${colors.muted};
        line-height: 1.8;
      }

      .ez-ai-header-actions {
        display: flex;
        gap: 9px;
        flex-wrap: wrap;
      }

      .ez-ai-btn {
        min-height: 43px;
        padding: 0 16px;
        border: 0;
        border-radius: 13px;
        font-family: inherit;
        font-weight: 850;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition:
          transform .15s ease,
          opacity .15s ease;
      }

      .ez-ai-btn:hover {
        transform: translateY(-1px);
      }

      .ez-ai-btn:disabled {
        opacity: .55;
        cursor: not-allowed;
        transform: none;
      }

      .ez-ai-btn-primary {
        color: #fff;
        background:
          linear-gradient(
            135deg,
            ${colors.primaryDark},
            ${colors.cyan}
          );
        box-shadow:
          0 9px 24px
          rgba(14,165,233,.18);
      }

      .ez-ai-btn-light {
        color: ${colors.primaryDark};
        background: #fff;
        border: 1px solid ${colors.border};
      }

      .ez-ai-btn-soft {
        color: ${colors.primaryDark};
        background: ${colors.ice};
      }

      .ez-ai-layout {
        display: grid;
        grid-template-columns:
          minmax(300px, .85fr)
          minmax(0, 1.5fr);
        gap: 17px;
      }

      .ez-ai-card {
        background: rgba(255,255,255,.94);
        border: 1px solid ${colors.border};
        border-radius: 19px;
        overflow: hidden;
      }

      .ez-ai-card-head {
        padding: 15px 17px;
        border-bottom: 1px solid #eaf4fb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }

      .ez-ai-card-head h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 950;
      }

      .ez-ai-card-head span {
        color: ${colors.muted};
        font-size: 11px;
      }

      .ez-ai-toolbar {
        padding: 12px;
        display: grid;
        gap: 8px;
        border-bottom: 1px solid #eaf4fb;
      }

      .ez-ai-input,
      .ez-ai-select {
        width: 100%;
        border: 1px solid #cfe3f5;
        background: #fff;
        color: ${colors.text};
        border-radius: 11px;
        padding: 10px 11px;
        font-family: inherit;
        outline: none;
      }

      .ez-ai-input:focus,
      .ez-ai-select:focus {
        border-color: ${colors.primary};
        box-shadow:
          0 0 0 3px
          rgba(56,189,248,.12);
      }

      .ez-ai-content-list {
        max-height: 650px;
        overflow-y: auto;
      }

      .ez-ai-content-item {
        padding: 14px;
        border-bottom: 1px solid #edf5fb;
        cursor: pointer;
        transition:
          background .15s ease,
          transform .15s ease;
      }

      .ez-ai-content-item:last-child {
        border-bottom: 0;
      }

      .ez-ai-content-item:hover {
        background: #f8fdff;
      }

      .ez-ai-content-item.selected {
        background:
          linear-gradient(
            90deg,
            #f0f9ff,
            #ffffff
          );
        border-right:
          4px solid
          ${colors.primary};
      }

      .ez-ai-content-title {
        font-weight: 900;
        line-height: 1.6;
        margin-bottom: 7px;
      }

      .ez-ai-content-meta {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .ez-ai-badge {
        display: inline-flex;
        align-items: center;
        min-height: 25px;
        padding: 0 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 900;
        background: #eff6ff;
        color: ${colors.primaryDark};
      }

      .ez-ai-badge-success {
        background: #ecfdf5;
        color: #15803d;
      }

      .ez-ai-badge-warning {
        background: #fffbeb;
        color: #b45309;
      }

      .ez-ai-badge-danger {
        background: #fef2f2;
        color: #b91c1c;
      }

      .ez-ai-empty {
        padding: 45px 18px;
        text-align: center;
        color: ${colors.muted};
      }

      .ez-ai-empty-icon {
        font-size: 40px;
        margin-bottom: 10px;
      }

      .ez-ai-result {
        padding: 18px;
      }

      .ez-ai-hero {
        border:
          1px solid
          ${colors.border};
        border-radius: 17px;
        padding: 17px;
        background:
          linear-gradient(
            135deg,
            #f0f9ff,
            #ffffff
          );
        margin-bottom: 15px;
      }

      .ez-ai-hero-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .ez-ai-hero h4 {
        margin: 0 0 8px;
        font-size: 21px;
        line-height: 1.55;
        font-weight: 950;
      }

      .ez-ai-hero p {
        margin: 0;
        color: ${colors.muted};
        line-height: 1.8;
      }

      .ez-ai-confidence {
        min-width: 92px;
        padding: 10px;
        border-radius: 14px;
        background: #fff;
        border: 1px solid ${colors.border};
        text-align: center;
      }

      .ez-ai-confidence-value {
        font-size: 22px;
        font-weight: 950;
        color: ${colors.primaryDark};
      }

      .ez-ai-confidence-label {
        font-size: 10px;
        color: ${colors.muted};
        margin-top: 2px;
      }

      .ez-ai-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .ez-ai-result-card {
        border: 1px solid ${colors.border};
        border-radius: 16px;
        padding: 14px;
        background: #fff;
        min-width: 0;
      }

      .ez-ai-result-card.full {
        grid-column: 1 / -1;
      }

      .ez-ai-result-card h5 {
        margin: 0 0 9px;
        font-size: 13px;
        font-weight: 950;
      }

      .ez-ai-result-text {
        color: #334155;
        line-height: 1.8;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .ez-ai-keywords {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .ez-ai-keyword {
        background: #f0f9ff;
        color: #0369a1;
        border-radius: 999px;
        padding: 6px 9px;
        font-size: 11px;
        font-weight: 850;
      }

      .ez-ai-social {
        border:
          1px solid
          #e5eef6;
        border-radius: 12px;
        padding: 11px;
        margin-bottom: 8px;
        background: #fbfdff;
      }

      .ez-ai-social:last-child {
        margin-bottom: 0;
      }

      .ez-ai-social strong {
        display: block;
        margin-bottom: 5px;
        font-size: 11px;
        color: ${colors.primaryDark};
      }

      .ez-ai-risk {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        padding: 10px 11px;
        border-radius: 11px;
        margin-bottom: 7px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .ez-ai-risk:last-child {
        margin-bottom: 0;
      }

      .ez-ai-risk-high {
        background: #fef2f2;
        border-color: #fecaca;
      }

      .ez-ai-risk-medium {
        background: #fffbeb;
        border-color: #fde68a;
      }

      .ez-ai-risk-low {
        background: #ecfdf5;
        border-color: #bbf7d0;
      }

      .ez-ai-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 15px;
      }

      .ez-ai-placeholder {
        padding: 55px 25px;
        text-align: center;
        color: ${colors.muted};
      }

      .ez-ai-placeholder-icon {
        font-size: 52px;
        margin-bottom: 12px;
      }

      .ez-ai-loading {
        opacity: .58;
        pointer-events: none;
      }

      .ez-ai-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,.45);
        border-top-color: #fff;
        border-radius: 50%;
        animation:
          ezAiSpin .8s linear infinite;
      }

      @keyframes ezAiSpin {
        to {
          transform: rotate(360deg);
        }
      }

      .ez-ai-toast {
        position: fixed;
        left: 22px;
        bottom: 22px;
        z-index: 100000;
        min-width: 260px;
        max-width:
          min(420px, calc(100vw - 44px));
        padding: 13px 15px;
        border-radius: 14px;
        background: #fff;
        border: 1px solid ${colors.border};
        box-shadow:
          0 18px 45px
          rgba(15,23,42,.14);
        font-weight: 800;
        display: none;
      }

      .ez-ai-toast.show {
        display: block;
        animation:
          ezAiToastIn .2s ease;
      }

      @keyframes ezAiToastIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 1000px) {
        .ez-ai-layout {
          grid-template-columns: 1fr;
        }

        .ez-ai-content-list {
          max-height: 380px;
        }
      }

      @media (max-width: 650px) {
        .ez-ai-shell {
          padding: 14px;
          border-radius: 18px;
        }

        .ez-ai-header {
          flex-direction: column;
        }

        .ez-ai-header-actions {
          width: 100%;
        }

        .ez-ai-header-actions .ez-ai-btn {
          flex: 1;
        }

        .ez-ai-grid {
          grid-template-columns: 1fr;
        }

        .ez-ai-result-card.full {
          grid-column: auto;
        }

        .ez-ai-hero-top {
          flex-direction: column;
        }

        .ez-ai-confidence {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getMount() {
    return (
      document.getElementById(
        "ai-section"
      ) ||
      document.getElementById(
        "admin-ai-section"
      ) ||
      document.querySelector(
        '[data-admin-section="ai"]'
      ) ||
      document.querySelector(
        '[data-section="ai"]'
      )
    );
  }

  function createMountIfNeeded() {
    let mount = getMount();

    if (mount) {
      return mount;
    }

    mount =
      document.createElement(
        "section"
      );

    mount.id =
      "admin-ai-section";

    const parent =
      document.getElementById(
        "admin-content"
      ) ||
      document.querySelector(
        "main"
      ) ||
      document.body;

    parent.appendChild(
      mount
    );

    return mount;
  }

  function renderShell() {
    const mount =
      createMountIfNeeded();

    mount.innerHTML = `
      <div id="ez-ai-admin">
        <div class="ez-ai-shell">

          <div class="ez-ai-header">

            <div class="ez-ai-title">
              <h2>
                🧠 مركز الذكاء الاصطناعي
              </h2>

              <p>
                تحليل المحتوى، تحسين العناوين،
                التلخيص، الكلمات المفتاحية،
                منشورات التواصل، وصف الفيديو
                ورصد مؤشرات المخاطر.
              </p>
            </div>

            <div class="ez-ai-header-actions">

              <button
                type="button"
                id="ez-ai-refresh"
                class="ez-ai-btn ez-ai-btn-light"
              >
                ↻ تحديث
              </button>

              <button
                type="button"
                id="ez-ai-analyze-selected"
                class="ez-ai-btn ez-ai-btn-primary"
                disabled
              >
                ✨ تحليل المحتوى
              </button>

            </div>

          </div>

          <div class="ez-ai-layout">

            <div class="ez-ai-card">

              <div class="ez-ai-card-head">
                <div>
                  <h3>المحتوى</h3>
                  <span id="ez-ai-content-count">
                    جاري التحميل...
                  </span>
                </div>
              </div>

              <div class="ez-ai-toolbar">

                <input
                  id="ez-ai-search"
                  class="ez-ai-input"
                  type="search"
                  placeholder="ابحث في المحتوى..."
                />

                <select
                  id="ez-ai-type"
                  class="ez-ai-select"
                >
                  <option value="all">
                    كل الأنواع
                  </option>
                  <option value="news">
                    أخبار
                  </option>
                  <option value="report">
                    تقارير
                  </option>
                  <option value="interview">
                    مقابلات
                  </option>
                  <option value="video">
                    فيديو
                  </option>
                  <option value="coverage">
                    تغطيات
                  </option>
                  <option value="breaking">
                    عاجل
                  </option>
                </select>

                <select
                  id="ez-ai-status"
                  class="ez-ai-select"
                >
                  <option value="all">
                    كل الحالات
                  </option>
                  <option value="draft">
                    مسودة
                  </option>
                  <option value="review">
                    مراجعة
                  </option>
                  <option value="approved">
                    معتمد
                  </option>
                  <option value="scheduled">
                    مجدول
                  </option>
                  <option value="published">
                    منشور
                  </option>
                  <option value="archived">
                    مؤرشف
                  </option>
                </select>

              </div>

              <div
                id="ez-ai-content-list"
                class="ez-ai-content-list"
              >
                <div class="ez-ai-empty">
                  جاري تحميل المحتوى...
                </div>
              </div>

            </div>

            <div class="ez-ai-card">

              <div class="ez-ai-card-head">
                <div>
                  <h3>
                    نتيجة الذكاء الاصطناعي
                  </h3>

                  <span id="ez-ai-analysis-date">
                    لم يتم اختيار محتوى
                  </span>
                </div>
              </div>

              <div
                id="ez-ai-result"
                class="ez-ai-result"
              >
                <div class="ez-ai-placeholder">
                  <div class="ez-ai-placeholder-icon">
                    🧠
                  </div>

                  <strong>
                    اختر محتوى من القائمة
                  </strong>

                  <div style="margin-top:7px;">
                    ثم اضغط «تحليل المحتوى»
                    لتشغيل محرك الذكاء الاصطناعي.
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>

      <div
        id="ez-ai-toast"
        class="ez-ai-toast"
        role="status"
        aria-live="polite"
      ></div>
    `;

    bindEvents();
  }

  function bindEvents() {
    document
      .getElementById(
        "ez-ai-refresh"
      )
      ?.addEventListener(
        "click",
        refresh
      );

    document
      .getElementById(
        "ez-ai-analyze-selected"
      )
      ?.addEventListener(
        "click",
        analyzeSelected
      );

    document
      .getElementById(
        "ez-ai-search"
      )
      ?.addEventListener(
        "input",
        (event) => {
          state.filters.search =
            event.target.value
              .trim()
              .toLowerCase();

          renderContentList();
        }
      );

    document
      .getElementById(
        "ez-ai-type"
      )
      ?.addEventListener(
        "change",
        (event) => {
          state.filters.type =
            event.target.value;

          renderContentList();
        }
      );

    document
      .getElementById(
        "ez-ai-status"
      )
      ?.addEventListener(
        "change",
        (event) => {
          state.filters.status =
            event.target.value;

          renderContentList();
        }
      );

    document
      .getElementById(
        "ez-ai-content-list"
      )
      ?.addEventListener(
        "click",
        handleContentClick
      );
  }

  async function refresh() {
    if (state.loading) {
      return;
    }

    state.loading = true;

    const root =
      document.getElementById(
        "ez-ai-admin"
      );

    root?.classList.add(
      "ez-ai-loading"
    );

    try {
      await loadContent();

      renderContentList();

      if (
        state.selectedContent
      ) {
        const refreshed =
          state.contents.find(
            (item) =>
              String(item.id) ===
              String(
                state.selectedContent.id
              )
          );

        if (refreshed) {
          state.selectedContent =
            refreshed;

          await loadLatestAnalysis(
            refreshed.id,
            false
          );
        }
      }
    } catch (error) {
      console.error(
        "EZ MEDIA AI:",
        error
      );

      showToast(
        error.message ||
          "تعذر تحميل مركز الذكاء الاصطناعي",
        "error"
      );
    } finally {
      state.loading = false;

      root?.classList.remove(
        "ez-ai-loading"
      );
    }
  }

  async function loadContent() {
    const params =
      new URLSearchParams();

    params.set(
      "limit",
      "100"
    );

    const data =
      await apiRequest(
        `${API.content}?${params.toString()}`
      );

    state.contents =
      unwrapArray(
        data,
        [
          "content",
          "items",
          "results"
        ]
      );
  }

  function getFilteredContent() {
    return state.contents.filter(
      (item) => {
        const typeMatch =
          state.filters.type ===
            "all" ||
          item.content_type ===
            state.filters.type ||
          item.type ===
            state.filters.type;

        const statusMatch =
          state.filters.status ===
            "all" ||
          item.status ===
            state.filters.status;

        const searchText = [
          item.title,
          item.headline,
          item.slug,
          item.summary,
          item.category
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const searchMatch =
          !state.filters.search ||
          searchText.includes(
            state.filters.search
          );

        return (
          typeMatch &&
          statusMatch &&
          searchMatch
        );
      }
    );
  }

  function renderContentList() {
    const list =
      document.getElementById(
        "ez-ai-content-list"
      );

    const count =
      document.getElementById(
        "ez-ai-content-count"
      );

    if (!list) {
      return;
    }

    const contents =
      getFilteredContent();

    if (count) {
      count.textContent =
        `${formatNumber(
          contents.length
        )} عنصر`;
    }

    if (!contents.length) {
      list.innerHTML = `
        <div class="ez-ai-empty">
          <div class="ez-ai-empty-icon">
            🔎
          </div>

          <strong>
            لا يوجد محتوى مطابق
          </strong>

          <div style="margin-top:6px;">
            جرّب تغيير البحث أو الفلاتر.
          </div>
        </div>
      `;

      return;
    }

    list.innerHTML =
      contents
        .map(
          (item) => {
            const id =
              item.id;

            const type =
              item.content_type ||
              item.type;

            const selected =
              state.selectedContent &&
              String(
                state.selectedContent.id
              ) ===
                String(id);

            return `
              <div
                class="
                  ez-ai-content-item
                  ${selected ? "selected" : ""}
                "
                data-content-id="${escapeHTML(
                  id
                )}"
              >

                <div class="ez-ai-content-title">
                  ${escapeHTML(
                    item.title ||
                      item.headline ||
                      "بدون عنوان"
                  )}
                </div>

                <div class="ez-ai-content-meta">

                  <span class="ez-ai-badge">
                    ${escapeHTML(
                      getContentTypeLabel(
                        type
                      )
                    )}
                  </span>

                  <span class="ez-ai-badge">
                    ${escapeHTML(
                      getStatusLabel(
                        item.status
                      )
                    )}
                  </span>

                  ${
                    item.category
                      ? `
                        <span class="ez-ai-badge">
                          ${escapeHTML(
                            item.category
                          )}
                        </span>
                      `
                      : ""
                  }

                </div>

                <div
                  style="
                    margin-top:7px;
                    color:#64748b;
                    font-size:10px;
                  "
                >
                  ${escapeHTML(
                    formatDate(
                      item.updated_at ||
                        item.created_at
                    )
                  )}
                </div>

              </div>
            `;
          }
        )
        .join("");
  }

  async function handleContentClick(
    event
  ) {
    const item =
      event.target.closest(
        "[data-content-id]"
      );

    if (!item) {
      return;
    }

    const id =
      item.dataset.contentId;

    await selectContent(id);
  }

  async function selectContent(
    id
  ) {
    const content =
      state.contents.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!content) {
      showToast(
        "المحتوى غير موجود",
        "error"
      );

      return;
    }

    state.selectedContent =
      content;

    state.selectedAnalysis =
      null;

    renderContentList();

    updateAnalyzeButton(
      true
    );

    renderLoadingResult(
      "جاري البحث عن آخر تحليل..."
    );

    await loadLatestAnalysis(
      id,
      true
    );
  }

  async function loadLatestAnalysis(
    id,
    render
  ) {
    try {
      const data =
        await apiRequest(
          `${API.ai}/content/${encodeURIComponent(
            id
          )}/latest`
        );

      const analysis =
        unwrapObject(
          data
        );

      state.selectedAnalysis =
        analysis || null;

      if (render) {
        renderAnalysis(
          state.selectedContent,
          state.selectedAnalysis
        );
      }
    } catch (error) {
      /*
       * عدم وجود تحليل سابق ليس خطأ
       * يمنع استخدام المركز.
       */
      state.selectedAnalysis =
        null;

      if (render) {
        renderAnalysis(
          state.selectedContent,
          null
        );
      }
    }
  }

  async function analyzeSelected() {
    if (
      !state.selectedContent
    ) {
      showToast(
        "اختر محتوى أولًا",
        "error"
      );

      return;
    }

    if (state.analyzing) {
      return;
    }

    state.analyzing = true;

    const button =
      document.getElementById(
        "ez-ai-analyze-selected"
      );

    setButtonLoading(
      button,
      true
    );

    renderLoadingResult(
      "الذكاء الاصطناعي يحلل المحتوى الآن..."
    );

    try {
      const data =
        await apiRequest(
          `${API.ai}/content/${encodeURIComponent(
            state.selectedContent.id
          )}/analyze`,
          {
            method: "POST",
            body: {}
          }
        );

      state.selectedAnalysis =
        unwrapObject(
          data
        );

      renderAnalysis(
        state.selectedContent,
        state.selectedAnalysis
      );

      showToast(
        "تم تحليل المحتوى بواسطة الذكاء الاصطناعي",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA AI analysis:",
        error
      );

      renderAnalysisError(
        error.message ||
          "تعذر تنفيذ تحليل الذكاء الاصطناعي"
      );

      showToast(
        error.message ||
          "تعذر تنفيذ التحليل",
        "error"
      );
    } finally {
      state.analyzing =
        false;

      setButtonLoading(
        button,
        false
      );
    }
  }

  function updateAnalyzeButton(
    enabled
  ) {
    const button =
      document.getElementById(
        "ez-ai-analyze-selected"
      );

    if (!button) {
      return;
    }

    button.disabled =
      !enabled ||
      state.analyzing;
  }

  function setButtonLoading(
    button,
    loading
  ) {
    if (!button) {
      return;
    }

    button.disabled =
      loading;

    if (loading) {
      button.innerHTML = `
        <span class="ez-ai-spinner"></span>
        جاري التحليل...
      `;
    } else {
      button.innerHTML =
        "✨ تحليل المحتوى";
    }
  }

  function renderLoadingResult(
    message
  ) {
    const result =
      document.getElementById(
        "ez-ai-result"
      );

    if (!result) {
      return;
    }

    result.innerHTML = `
      <div class="ez-ai-placeholder">

        <div
          class="ez-ai-spinner"
          style="
            margin:0 auto 15px;
            width:28px;
            height:28px;
            border-width:3px;
            border-color:#bae6fd;
            border-top-color:#0284c7;
          "
        ></div>

        <strong>
          ${escapeHTML(
            message
          )}
        </strong>

        <div style="margin-top:7px;">
          قد يستغرق التحليل بضع ثوانٍ.
        </div>

      </div>
    `;
  }

  function renderAnalysisError(
    message
  ) {
    const result =
      document.getElementById(
        "ez-ai-result"
      );

    if (!result) {
      return;
    }

    result.innerHTML = `
      <div class="ez-ai-placeholder">

        <div
          class="ez-ai-placeholder-icon"
        >
          ⚠️
        </div>

        <strong>
          تعذر تنفيذ التحليل
        </strong>

        <div
          style="
            margin:10px auto 0;
            max-width:500px;
            line-height:1.8;
          "
        >
          ${escapeHTML(
            message
          )}
        </div>

      </div>
    `;
  }

  function renderAnalysis(
    content,
    analysis
  ) {
    const result =
      document.getElementById(
        "ez-ai-result"
      );

    const date =
      document.getElementById(
        "ez-ai-analysis-date"
      );

    if (!result) {
      return;
    }

    if (date) {
      date.textContent =
        analysis
          ? `آخر تحليل: ${formatDate(
              analysis.created_at ||
                analysis.updated_at
            )}`
          : "لا يوجد تحليل سابق";
    }

    if (!analysis) {
      result.innerHTML = `
        <div class="ez-ai-placeholder">

          <div class="ez-ai-placeholder-icon">
            ✨
          </div>

          <strong>
            لم يتم تحليل هذا المحتوى بعد
          </strong>

          <div style="margin-top:7px;">
            اضغط «تحليل المحتوى» لتشغيل الذكاء الاصطناعي.
          </div>

        </div>
      `;

      return;
    }

    const data =
      normalizeAnalysis(
        analysis
      );

    const riskFlags =
      data.riskFlags;

    result.innerHTML = `

      <div class="ez-ai-actions">

        <button
          type="button"
          id="ez-ai-reanalyze"
          class="ez-ai-btn ez-ai-btn-primary"
        >
          ↻ إعادة التحليل
        </button>

        <button
          type="button"
          id="ez-ai-copy-summary"
          class="ez-ai-btn ez-ai-btn-soft"
        >
          نسخ الملخص
        </button>

        <button
          type="button"
          id="ez-ai-copy-headline"
          class="ez-ai-btn ez-ai-btn-light"
        >
          نسخ العنوان
        </button>

      </div>

      <div class="ez-ai-hero">

        <div class="ez-ai-hero-top">

          <div style="flex:1;min-width:0;">

            <h4>
              ${escapeHTML(
                data.headline ||
                  content?.title ||
                  "بدون عنوان"
              )}
            </h4>

            <p>
              ${escapeHTML(
                data.summary ||
                  content?.summary ||
                  "لا يوجد ملخص."
              )}
            </p>

          </div>

          <div class="ez-ai-confidence">

            <div class="ez-ai-confidence-value">
              ${escapeHTML(
                formatPercent(
                  data.confidence
                )
              )}
            </div>

            <div class="ez-ai-confidence-label">
              مستوى الثقة
            </div>

          </div>

        </div>

      </div>

      <div class="ez-ai-grid">

        <div class="ez-ai-result-card">

          <h5>
            📝 العنوان المقترح
          </h5>

          <div class="ez-ai-result-text">
            ${escapeHTML(
              data.headline ||
                "لا يوجد"
            )}
          </div>

        </div>

        <div class="ez-ai-result-card">

          <h5>
            🗂 التصنيف
          </h5>

          <div class="ez-ai-result-text">
            ${escapeHTML(
              data.category ||
                content?.category ||
                "غير محدد"
            )}
          </div>

        </div>

        <div class="ez-ai-result-card full">

          <h5>
            📌 الملخص الذكي
          </h5>

          <div class="ez-ai-result-text">
            ${escapeHTML(
              data.summary ||
                "لا يوجد ملخص."
            )}
          </div>

        </div>

        <div class="ez-ai-result-card">

          <h5>
            🔎 الكلمات المفتاحية
          </h5>

          ${
            data.keywords.length
              ? `
                <div class="ez-ai-keywords">
                  ${data.keywords
                    .map(
                      (keyword) => `
                        <span class="ez-ai-keyword">
                          ${escapeHTML(
                            keyword
                          )}
                        </span>
                      `
                    )
                    .join("")}
                </div>
              `
              : `
                <div class="ez-ai-result-text">
                  لا توجد كلمات مفتاحية.
                </div>
              `
          }

        </div>

        <div class="ez-ai-result-card">

          <h5>
            🎬 وصف الفيديو
          </h5>

          <div class="ez-ai-result-text">
            ${escapeHTML(
              data.videoDescription ||
                "لا يوجد وصف."
            )}
          </div>

        </div>

        <div class="ez-ai-result-card full">

          <h5>
            📱 منشورات التواصل الاجتماعي
          </h5>

          ${renderSocialPosts(
            data.socialPosts
          )}

        </div>

        <div class="ez-ai-result-card full">

          <h5>
            🛡️ مؤشرات المخاطر
          </h5>

          ${renderRiskFlags(
            riskFlags
          )}

        </div>

        <div class="ez-ai-result-card full">

          <h5>
            👨‍💻 ملاحظات تحريرية
          </h5>

          <div class="ez-ai-result-text">
            ${escapeHTML(
              data.editorNotes ||
                "لا توجد ملاحظات تحريرية."
            )}
          </div>

        </div>

      </div>
    `;

    document
      .getElementById(
        "ez-ai-reanalyze"
      )
      ?.addEventListener(
        "click",
        analyzeSelected
      );

    document
      .getElementById(
        "ez-ai-copy-summary"
      )
      ?.addEventListener(
        "click",
        () => {
          copyText(
            data.summary ||
              ""
          );
        }
      );

    document
      .getElementById(
        "ez-ai-copy-headline"
      )
      ?.addEventListener(
        "click",
        () => {
          copyText(
            data.headline ||
              ""
          );
        }
      );
  }

  function normalizeAnalysis(
    analysis
  ) {
    /*
     * خدمة AI الحالية ترجع:
     *
     * headline
     * summary
     * category
     * keywords
     * social_posts
     * video_description
     * editor_notes
     * risk_flags
     * confidence
     */

    const source =
      analysis.analysis ||
      analysis.result ||
      analysis.output ||
      analysis;

    return {
      headline:
        source.headline ||
        source.title ||
        "",

      summary:
        source.summary ||
        "",

      category:
        source.category ||
        "",

      keywords:
        normalizeArray(
          source.keywords
        ),

      socialPosts:
        normalizeSocialPosts(
          source.social_posts ||
            source.socialPosts
        ),

      videoDescription:
        source.video_description ||
        source.videoDescription ||
        "",

      editorNotes:
        source.editor_notes ||
        source.editorNotes ||
        "",

      riskFlags:
        normalizeRiskFlags(
          source.risk_flags ||
            source.riskFlags
        ),

      confidence:
        source.confidence ??
        analysis.confidence ??
        null
    };
  }

  function normalizeArray(
    value
  ) {
    if (
      Array.isArray(value)
    ) {
      return value
        .map((item) => {
          if (
            typeof item ===
            "object"
          ) {
            return (
              item.keyword ||
              item.name ||
              item.text ||
              JSON.stringify(item)
            );
          }

          return String(
            item
          );
        })
        .filter(Boolean);
    }

    if (
      typeof value ===
      "string"
    ) {
      return value
        .split(
          /[,،\n]+/
        )
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean);
    }

    return [];
  }

  function normalizeSocialPosts(
    value
  ) {
    if (
      !value
    ) {
      return [];
    }

    if (
      Array.isArray(value)
    ) {
      return value
        .map(
          (item) => {
            if (
              typeof item ===
              "string"
            ) {
              return {
                platform:
                  "منشور",
                text: item
              };
            }

            return {
              platform:
                item.platform ||
                item.network ||
                item.channel ||
                "منشور",

              text:
                item.text ||
                item.content ||
                item.post ||
                ""
            };
          }
        )
        .filter(
          (item) =>
            item.text
        );
    }

    if (
      typeof value ===
      "object"
    ) {
      return Object.entries(
        value
      ).map(
        ([platform, text]) => ({
          platform,
          text:
            typeof text ===
            "string"
              ? text
              : JSON.stringify(
                  text
                )
        })
      );
    }

    return [
      {
        platform:
          "منشور",
        text:
          String(value)
      }
    ];
  }

  function normalizeRiskFlags(
    value
  ) {
    if (
      !value
    ) {
      return [];
    }

    if (
      Array.isArray(value)
    ) {
      return value
        .map(
          (item) => {
            if (
              typeof item ===
              "string"
            ) {
              return {
                level:
                  getRiskLabel(
                    item
                  ),
                text:
                  item
              };
            }

            return {
              level:
                item.level ||
                item.risk ||
                item.severity ||
                "منخفض",

              text:
                item.text ||
                item.message ||
                item.description ||
                ""
            };
          }
        )
        .filter(
          (item) =>
            item.text
        );
    }

    if (
      typeof value ===
      "object"
    ) {
      return Object.entries(
        value
      ).map(
        ([key, value]) => ({
          level:
            getRiskLabel(
              key
            ),
          text:
            typeof value ===
            "string"
              ? value
              : JSON.stringify(
                  value
                )
        })
      );
    }

    return [
      {
        level:
          getRiskLabel(
            value
          ),
        text:
          String(value)
      }
    ];
  }

  function renderSocialPosts(
    posts
  ) {
    if (
      !posts.length
    ) {
      return `
        <div class="ez-ai-result-text">
          لا توجد منشورات مقترحة.
        </div>
      `;
    }

    return posts
      .map(
        (post) => `
          <div class="ez-ai-social">
            <strong>
              ${escapeHTML(
                post.platform
              )}
            </strong>

            <div class="ez-ai-result-text">
              ${escapeHTML(
                post.text
              )}
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderRiskFlags(
    flags
  ) {
    if (
      !flags.length
    ) {
      return `
        <div
          class="ez-ai-risk ez-ai-risk-low"
        >
          <span>
            لم يرصد الذكاء الاصطناعي
            مؤشرات مخاطر واضحة.
          </span>

          <strong>
            منخفض
          </strong>
        </div>
      `;
    }

    return flags
      .map(
        (flag) => {
          const level =
            getRiskLabel(
              flag.level
            );

          let className =
            "ez-ai-risk-low";

          if (
            level ===
            "مرتفع"
          ) {
            className =
              "ez-ai-risk-high";
          } else if (
            level ===
            "متوسط"
          ) {
            className =
              "ez-ai-risk-medium";
          }

          return `
            <div
              class="
                ez-ai-risk
                ${className}
              "
            >

              <span>
                ${escapeHTML(
                  flag.text
                )}
              </span>

              <strong>
                ${escapeHTML(
                  level
                )}
              </strong>

            </div>
          `;
        }
      )
      .join("");
  }

  function copyText(
    text
  ) {
    if (!text) {
      showToast(
        "لا يوجد نص لنسخه",
        "error"
      );

      return;
    }

    if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          showToast(
            "تم نسخ النص",
            "success"
          );
        })
        .catch(() => {
          fallbackCopy(text);
        });

      return;
    }

    fallbackCopy(text);
  }

  function fallbackCopy(
    text
  ) {
    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value =
      text;

    textarea.style.position =
      "fixed";

    textarea.style.opacity =
      "0";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    try {
      document.execCommand(
        "copy"
      );

      showToast(
        "تم نسخ النص",
        "success"
      );
    } catch (_) {
      showToast(
        "تعذر نسخ النص",
        "error"
      );
    }

    textarea.remove();
  }

  function showToast(
    message,
    type = "success"
  ) {
    const toast =
      document.getElementById(
        "ez-ai-toast"
      );

    if (!toast) {
      return;
    }

    toast.textContent =
      message;

    toast.style.borderColor =
      type === "error"
        ? "#fecaca"
        : "#bae6fd";

    toast.style.color =
      type === "error"
        ? "#b91c1c"
        : "#0369a1";

    toast.classList.add(
      "show"
    );

    clearTimeout(
      showToast.timer
    );

    showToast.timer =
      setTimeout(() => {
        toast.classList.remove(
          "show"
        );
      }, 3500);
  }

  function initialize() {
    ensureStyles();

    const mount =
      getMount() ||
      createMountIfNeeded();

    if (!mount) {
      return;
    }

    if (
      document.getElementById(
        "ez-ai-admin"
      )
    ) {
      return;
    }

    renderShell();

    refresh().catch(
      (error) => {
        console.error(
          "EZ MEDIA AI initialization:",
          error
        );
      }
    );
  }

  window.EZMediaAdminAI = {
    refresh,
    analyze:
      analyzeSelected,
    selectContent,
    getState: () => ({
      contents: [
        ...state.contents
      ],
      selectedContent:
        state.selectedContent,
      selectedAnalysis:
        state.selectedAnalysis
    })
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }
})();
