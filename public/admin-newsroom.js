"use strict";

/*
 * EZ MEDIA 11.0
 * غرفة الأخبار الذكية
 * الملف: public/admin-newsroom.js
 */

(() => {
  const API = {
    content: "/api/content",
    ai: "/api/ai",
    media: "/api/media",
    breaking: "/api/breaking"
  };

  const state = {
    items: [],
    filteredItems: [],
    loading: false,
    search: "",
    type: "",
    status: ""
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
    review: "مراجعة",
    approved: "معتمد",
    scheduled: "مجدول",
    published: "منشور",
    archived: "مؤرشف"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "غير محدد";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "غير محدد";
    }

    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function getTypeLabel(type) {
    return TYPES[type] || type || "محتوى";
  }

  function getStatusLabel(status) {
    return STATUSES[status] || status || "غير محدد";
  }

  function statusClass(status) {
    return `status-${String(status || "unknown").replace(/[^a-zA-Z0-9_-]/g, "")}`;
  }

  function notify(message, type = "info") {
    let box = document.getElementById("ez-newsroom-notification");

    if (!box) {
      box = document.createElement("div");
      box.id = "ez-newsroom-notification";

      Object.assign(box.style, {
        position: "fixed",
        top: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "99999",
        maxWidth: "calc(100vw - 32px)",
        padding: "14px 20px",
        borderRadius: "16px",
        background: "#ffffff",
        color: "#17324d",
        border: "1px solid #d9eaf7",
        boxShadow: "0 15px 45px rgba(27, 116, 170, 0.16)",
        fontFamily: "inherit",
        fontSize: "14px",
        fontWeight: "700",
        textAlign: "center"
      });

      document.body.appendChild(box);
    }

    box.textContent = message;

    if (type === "success") {
      box.style.borderColor = "#b7e7d1";
    } else if (type === "error") {
      box.style.borderColor = "#f1c1c1";
    } else {
      box.style.borderColor = "#d9eaf7";
    }

    clearTimeout(box._timer);

    box._timer = setTimeout(() => {
      box.remove();
    }, 3500);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error ||
        `تعذر تنفيذ الطلب (${response.status})`
      );
    }

    return data;
  }

  function normalizeContentResponse(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    if (Array.isArray(data?.content)) {
      return data.content;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }

  function getContainer() {
    return (
      document.getElementById("newsroom-section") ||
      document.querySelector('[data-admin-section="newsroom"]')
    );
  }

  function renderShell() {
    const container = getContainer();

    if (!container) {
      return null;
    }

    container.innerHTML = `
      <div id="ez-newsroom-app" dir="rtl">

        <style>
          #ez-newsroom-app {
            width: 100%;
            color: #17324d;
            font-family: inherit;
          }

          #ez-newsroom-app * {
            box-sizing: border-box;
          }

          .ez-nr-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            margin-bottom: 22px;
            flex-wrap: wrap;
          }

          .ez-nr-title-wrap h2 {
            margin: 0 0 7px;
            font-size: 27px;
            font-weight: 900;
            letter-spacing: -0.4px;
          }

          .ez-nr-title-wrap p {
            margin: 0;
            color: #6c879d;
            font-size: 14px;
            line-height: 1.7;
          }

          .ez-nr-live-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 13px;
            border-radius: 999px;
            background: #effaff;
            border: 1px solid #d8f0fb;
            color: #1577a8;
            font-size: 12px;
            font-weight: 800;
          }

          .ez-nr-live-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #28b779;
            box-shadow: 0 0 0 5px rgba(40,183,121,.10);
          }

          .ez-nr-actions {
            display: flex;
            gap: 9px;
            flex-wrap: wrap;
          }

          .ez-nr-btn {
            border: 0;
            border-radius: 13px;
            padding: 11px 16px;
            font-family: inherit;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            transition: .18s ease;
          }

          .ez-nr-btn:hover {
            transform: translateY(-1px);
          }

          .ez-nr-btn-primary {
            background: linear-gradient(135deg, #63c9f5, #3aa8df);
            color: white;
            box-shadow: 0 9px 24px rgba(58,168,223,.20);
          }

          .ez-nr-btn-light {
            background: #f4fbff;
            color: #26759c;
            border: 1px solid #dceef7;
          }

          .ez-nr-stats {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 18px;
          }

          .ez-nr-stat {
            background: #ffffff;
            border: 1px solid #e2eef6;
            border-radius: 18px;
            padding: 16px;
            box-shadow: 0 7px 28px rgba(29, 112, 155, .06);
          }

          .ez-nr-stat-label {
            color: #7892a6;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 7px;
          }

          .ez-nr-stat-value {
            font-size: 25px;
            font-weight: 900;
            color: #17324d;
          }

          .ez-nr-toolbar {
            display: grid;
            grid-template-columns: 1.5fr 1fr 1fr auto;
            gap: 10px;
            margin-bottom: 15px;
          }

          .ez-nr-input,
          .ez-nr-select {
            width: 100%;
            min-height: 44px;
            border: 1px solid #dcebf4;
            border-radius: 13px;
            background: #ffffff;
            color: #17324d;
            padding: 0 13px;
            outline: none;
            font-family: inherit;
            font-size: 13px;
          }

          .ez-nr-input:focus,
          .ez-nr-select:focus {
            border-color: #71c8ef;
            box-shadow: 0 0 0 4px rgba(113,200,239,.11);
          }

          .ez-nr-table-wrap {
            overflow-x: auto;
            background: #ffffff;
            border: 1px solid #e2eef6;
            border-radius: 20px;
            box-shadow: 0 7px 28px rgba(29,112,155,.06);
          }

          .ez-nr-table {
            width: 100%;
            min-width: 900px;
            border-collapse: collapse;
          }

          .ez-nr-table th {
            background: #f6fbfe;
            color: #69869b;
            font-size: 11px;
            font-weight: 900;
            text-align: right;
            padding: 14px 15px;
            border-bottom: 1px solid #e4eef5;
            white-space: nowrap;
          }

          .ez-nr-table td {
            padding: 14px 15px;
            border-bottom: 1px solid #edf3f7;
            font-size: 13px;
            vertical-align: middle;
          }

          .ez-nr-table tr:last-child td {
            border-bottom: 0;
          }

          .ez-nr-content-title {
            max-width: 360px;
            font-weight: 850;
            color: #17324d;
            line-height: 1.55;
          }

          .ez-nr-content-id {
            color: #91a5b4;
            font-size: 10px;
            margin-top: 4px;
            direction: ltr;
            text-align: right;
          }

          .ez-nr-type {
            display: inline-flex;
            padding: 6px 9px;
            border-radius: 9px;
            background: #eef9fe;
            color: #247aa3;
            font-size: 11px;
            font-weight: 800;
          }

          .ez-nr-status {
            display: inline-flex;
            padding: 6px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 850;
          }

          .status-draft {
            background: #f2f6f9;
            color: #6f8494;
          }

          .status-review {
            background: #fff7df;
            color: #987019;
          }

          .status-approved {
            background: #edf9f2;
            color: #258253;
          }

          .status-scheduled {
            background: #edf5ff;
            color: #3470a6;
          }

          .status-published {
            background: #e9faf4;
            color: #16815b;
          }

          .status-archived {
            background: #f3f3f3;
            color: #777777;
          }

          .ez-nr-row-actions {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          .ez-nr-mini-btn {
            border: 1px solid #dcecf5;
            background: #ffffff;
            color: #32799b;
            border-radius: 9px;
            padding: 7px 9px;
            font-family: inherit;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
          }

          .ez-nr-mini-btn:hover {
            background: #f2fbff;
          }

          .ez-nr-mini-btn.danger {
            color: #a74d4d;
            border-color: #f0d7d7;
          }

          .ez-nr-empty {
            padding: 55px 20px;
            text-align: center;
            color: #7b92a4;
          }

          .ez-nr-empty strong {
            display: block;
            color: #38566d;
            margin-bottom: 7px;
            font-size: 16px;
          }

          .ez-nr-loading {
            padding: 50px;
            text-align: center;
            color: #6f899b;
            font-weight: 800;
          }

          .ez-nr-footer {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 13px;
            color: #8299a9;
            font-size: 11px;
            flex-wrap: wrap;
          }

          @media (max-width: 1050px) {
            .ez-nr-stats {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .ez-nr-toolbar {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 680px) {
            .ez-nr-stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .ez-nr-toolbar {
              grid-template-columns: 1fr;
            }

            .ez-nr-title-wrap h2 {
              font-size: 22px;
            }
          }
        </style>

        <div class="ez-nr-header">
          <div class="ez-nr-title-wrap">
            <div class="ez-nr-live-indicator">
              <span class="ez-nr-live-dot"></span>
              غرفة الأخبار الذكية
            </div>

            <h2>مركز الأخبار والتحرير</h2>

            <p>
              إدارة دورة المحتوى من المسودة إلى المراجعة والاعتماد والنشر،
              مع جاهزية الربط بمحرك الذكاء الاصطناعي.
            </p>
          </div>

          <div class="ez-nr-actions">
            <button class="ez-nr-btn ez-nr-btn-light" id="ez-nr-refresh">
              تحديث البيانات
            </button>

            <button class="ez-nr-btn ez-nr-btn-primary" id="ez-nr-new">
              + إنشاء محتوى
            </button>
          </div>
        </div>

        <div class="ez-nr-stats">
          <div class="ez-nr-stat">
            <div class="ez-nr-stat-label">إجمالي المحتوى</div>
            <div class="ez-nr-stat-value" id="ez-nr-total">0</div>
          </div>

          <div class="ez-nr-stat">
            <div class="ez-nr-stat-label">مسودات</div>
            <div class="ez-nr-stat-value" id="ez-nr-drafts">0</div>
          </div>

          <div class="ez-nr-stat">
            <div class="ez-nr-stat-label">قيد المراجعة</div>
            <div class="ez-nr-stat-value" id="ez-nr-review">0</div>
          </div>

          <div class="ez-nr-stat">
            <div class="ez-nr-stat-label">مجدول</div>
            <div class="ez-nr-stat-value" id="ez-nr-scheduled">0</div>
          </div>

          <div class="ez-nr-stat">
            <div class="ez-nr-stat-label">منشور</div>
            <div class="ez-nr-stat-value" id="ez-nr-published">0</div>
          </div>
        </div>

        <div class="ez-nr-toolbar">
          <input
            id="ez-nr-search"
            class="ez-nr-input"
            type="search"
            placeholder="ابحث في العناوين والوصف..."
          />

          <select id="ez-nr-type" class="ez-nr-select">
            <option value="">كل أنواع المحتوى</option>
            <option value="news">أخبار</option>
            <option value="report">تقارير</option>
            <option value="interview">مقابلات</option>
            <option value="video">فيديو</option>
            <option value="coverage">تغطيات</option>
            <option value="breaking">عاجل</option>
          </select>

          <select id="ez-nr-status" class="ez-nr-select">
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="review">مراجعة</option>
            <option value="approved">معتمد</option>
            <option value="scheduled">مجدول</option>
            <option value="published">منشور</option>
            <option value="archived">مؤرشف</option>
          </select>

          <button class="ez-nr-btn ez-nr-btn-light" id="ez-nr-reset">
            تصفير
          </button>
        </div>

        <div class="ez-nr-table-wrap">
          <div id="ez-nr-table-content">
            <div class="ez-nr-loading">جاري تحميل غرفة الأخبار...</div>
          </div>
        </div>

        <div class="ez-nr-footer">
          <span id="ez-nr-count">0 عنصر</span>
          <span>EZ MEDIA 11.0 — غرفة الأخبار الذكية</span>
        </div>
      </div>
    `;

    bindEvents();

    return container;
  }

  function updateStats() {
    const total = state.items.length;

    const drafts = state.items.filter(
      item => item.status === "draft"
    ).length;

    const review = state.items.filter(
      item => item.status === "review"
    ).length;

    const scheduled = state.items.filter(
      item => item.status === "scheduled"
    ).length;

    const published = state.items.filter(
      item => item.status === "published"
    ).length;

    const set = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    };

    set("ez-nr-total", total);
    set("ez-nr-drafts", drafts);
    set("ez-nr-review", review);
    set("ez-nr-scheduled", scheduled);
    set("ez-nr-published", published);
  }

  function applyFilters() {
    const search = state.search.trim().toLowerCase();

    state.filteredItems = state.items.filter(item => {
      const title = String(
        item.title ||
        item.headline ||
        item.name ||
        ""
      ).toLowerCase();

      const description = String(
        item.description ||
        item.summary ||
        item.excerpt ||
        ""
      ).toLowerCase();

      const matchesSearch =
        !search ||
        title.includes(search) ||
        description.includes(search);

      const matchesType =
        !state.type ||
        item.content_type === state.type ||
        item.type === state.type;

      const matchesStatus =
        !state.status ||
        item.status === state.status;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });

    renderTable();
  }

  function renderTable() {
    const wrapper = document.getElementById("ez-nr-table-content");
    const count = document.getElementById("ez-nr-count");

    if (!wrapper) return;

    if (count) {
      count.textContent =
        `${state.filteredItems.length} عنصر من أصل ${state.items.length}`;
    }

    if (!state.filteredItems.length) {
      wrapper.innerHTML = `
        <div class="ez-nr-empty">
          <strong>لا توجد نتائج</strong>
          لم يتم العثور على محتوى مطابق للبحث أو الفلاتر الحالية.
        </div>
      `;
      return;
    }

    wrapper.innerHTML = `
      <table class="ez-nr-table">
        <thead>
          <tr>
            <th>المحتوى</th>
            <th>النوع</th>
            <th>الحالة</th>
            <th>التاريخ</th>
            <th>الإجراءات</th>
          </tr>
        </thead>

        <tbody>
          ${state.filteredItems.map(item => renderRow(item)).join("")}
        </tbody>
      </table>
    `;
  }

  function renderRow(item) {
    const id = escapeHtml(item.id);

    const title = escapeHtml(
      item.title ||
      item.headline ||
      item.name ||
      "بدون عنوان"
    );

    const type =
      item.content_type ||
      item.type ||
      "news";

    const status =
      item.status ||
      "draft";

    const date =
      item.updated_at ||
      item.created_at ||
      item.published_at;

    return `
      <tr>
        <td>
          <div class="ez-nr-content-title">
            ${title}
          </div>

          <div class="ez-nr-content-id">
            ${id}
          </div>
        </td>

        <td>
          <span class="ez-nr-type">
            ${escapeHtml(getTypeLabel(type))}
          </span>
        </td>

        <td>
          <span class="ez-nr-status ${statusClass(status)}">
            ${escapeHtml(getStatusLabel(status))}
          </span>
        </td>

        <td>
          ${escapeHtml(formatDate(date))}
        </td>

        <td>
          <div class="ez-nr-row-actions">
            <button
              class="ez-nr-mini-btn"
              data-action="view"
              data-id="${id}"
            >
              عرض
            </button>

            <button
              class="ez-nr-mini-btn"
              data-action="edit"
              data-id="${id}"
            >
              تعديل
            </button>

            <button
              class="ez-nr-mini-btn"
              data-action="ai"
              data-id="${id}"
            >
              AI
            </button>

            ${
              status !== "published"
                ? `
                  <button
                    class="ez-nr-mini-btn"
                    data-action="publish"
                    data-id="${id}"
                  >
                    نشر
                  </button>
                `
                : ""
            }
          </div>
        </td>
      </tr>
    `;
  }

  async function loadContent() {
    state.loading = true;

    const wrapper = document.getElementById("ez-nr-table-content");

    if (wrapper) {
      wrapper.innerHTML = `
        <div class="ez-nr-loading">
          جاري تحديث غرفة الأخبار...
        </div>
      `;
    }

    try {
      const data = await request(
        `${API.content}?limit=100`
      );

      state.items = normalizeContentResponse(data);

      updateStats();
      applyFilters();
    } catch (error) {
      console.error("EZ MEDIA newsroom:", error);

      state.items = [];
      state.filteredItems = [];

      if (wrapper) {
        wrapper.innerHTML = `
          <div class="ez-nr-empty">
            <strong>تعذر تحميل المحتوى</strong>
            ${escapeHtml(error.message)}
          </div>
        `;
      }

      notify(error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  async function openContent(id) {
    try {
      const data = await request(
        `${API.content}/${encodeURIComponent(id)}`
      );

      const item = data?.item || data?.content || data?.data || data;

      showContentModal(item);
    } catch (error) {
      notify(error.message, "error");
    }
  }

  function showContentModal(item) {
    const existing = document.getElementById(
      "ez-nr-content-modal"
    );

    if (existing) {
      existing.remove();
    }

    const title = item?.title || item?.headline || "";
    const description =
      item?.description ||
      item?.summary ||
      item?.body ||
      "";

    const modal = document.createElement("div");

    modal.id = "ez-nr-content-modal";

    Object.assign(modal.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99990",
      background: "rgba(13, 51, 76, 0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      direction: "rtl"
    });

    modal.innerHTML = `
      <div style="
        width:min(720px,100%);
        max-height:90vh;
        overflow:auto;
        background:#fff;
        border:1px solid #dcebf4;
        border-radius:24px;
        box-shadow:0 25px 80px rgba(20,100,140,.20);
        padding:24px;
        font-family:inherit;
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          gap:15px;
          align-items:flex-start;
          margin-bottom:18px;
        ">
          <div>
            <div style="
              color:#2380a9;
              font-size:11px;
              font-weight:900;
              margin-bottom:7px;
            ">
              معاينة المحتوى
            </div>

            <h3 style="
              margin:0;
              color:#17324d;
              font-size:22px;
              line-height:1.5;
            ">
              ${escapeHtml(title || "بدون عنوان")}
            </h3>
          </div>

          <button
            id="ez-nr-modal-close"
            style="
              width:38px;
              height:38px;
              border:1px solid #dfedf5;
              background:#f7fbfd;
              color:#46748e;
              border-radius:12px;
              cursor:pointer;
              font-size:18px;
            "
          >
            ×
          </button>
        </div>

        <div style="
          color:#587488;
          line-height:1.9;
          white-space:pre-wrap;
          font-size:14px;
        ">
          ${escapeHtml(description || "لا يوجد وصف أو ملخص.")}
        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
          margin-top:22px;
        ">
          <div style="
            padding:13px;
            border:1px solid #e4eef5;
            border-radius:14px;
            background:#fafdff;
          ">
            <small style="color:#8198a9;">النوع</small>
            <div style="font-weight:850;margin-top:5px;">
              ${escapeHtml(
                getTypeLabel(
                  item?.content_type || item?.type
                )
              )}
            </div>
          </div>

          <div style="
            padding:13px;
            border:1px solid #e4eef5;
            border-radius:14px;
            background:#fafdff;
          ">
            <small style="color:#8198a9;">الحالة</small>
            <div style="font-weight:850;margin-top:5px;">
              ${escapeHtml(
                getStatusLabel(item?.status)
              )}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById("ez-nr-modal-close")
      ?.addEventListener("click", () => modal.remove());

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        modal.remove();
      }
    });
  }

  function editContent(id) {
    const content =
      state.items.find(item => String(item.id) === String(id));

    if (!content) {
      notify("لم يتم العثور على المحتوى.", "error");
      return;
    }

    if (window.EZMediaAdminContent?.openEditor) {
      window.EZMediaAdminContent.openEditor(content);
      return;
    }

    if (window.EZMediaAdminContent?.edit) {
      window.EZMediaAdminContent.edit(content);
      return;
    }

    notify(
      "تم العثور على المحتوى، لكن محرر المحتوى غير متاح حاليًا.",
      "info"
    );
  }

  async function analyzeWithAI(id) {
    try {
      notify("جاري إرسال المحتوى إلى الذكاء الاصطناعي...");

      const data = await request(
        `${API.ai}/content/${encodeURIComponent(id)}/analyze`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      const result =
        data?.analysis ||
        data?.result ||
        data?.data ||
        data;

      showAIResult(result);

      notify(
        "اكتمل تحليل المحتوى بالذكاء الاصطناعي.",
        "success"
      );
    } catch (error) {
      notify(error.message, "error");
    }
  }

  function showAIResult(result) {
    const existing = document.getElementById(
      "ez-nr-ai-modal"
    );

    if (existing) {
      existing.remove();
    }

    const modal = document.createElement("div");

    modal.id = "ez-nr-ai-modal";

    Object.assign(modal.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99991",
      background: "rgba(13,51,76,.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      direction: "rtl"
    });

    const keywords = Array.isArray(result?.keywords)
      ? result.keywords
      : [];

    const socialPosts = result?.social_posts || {};

    modal.innerHTML = `
      <div style="
        width:min(820px,100%);
        max-height:90vh;
        overflow:auto;
        background:#fff;
        border:1px solid #dcebf4;
        border-radius:24px;
        box-shadow:0 25px 80px rgba(20,100,140,.20);
        padding:24px;
        font-family:inherit;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:15px;
          margin-bottom:20px;
        ">
          <div>
            <div style="
              color:#2380a9;
              font-size:11px;
              font-weight:900;
              margin-bottom:5px;
            ">
              مركز الذكاء الاصطناعي
            </div>

            <h3 style="
              margin:0;
              color:#17324d;
              font-size:22px;
            ">
              نتيجة التحليل
            </h3>
          </div>

          <button
            id="ez-nr-ai-close"
            style="
              width:38px;
              height:38px;
              border:1px solid #dfedf5;
              background:#f7fbfd;
              color:#46748e;
              border-radius:12px;
              cursor:pointer;
              font-size:18px;
            "
          >
            ×
          </button>
        </div>

        ${renderAIField("العنوان المقترح", result?.headline)}

        ${renderAIField("الملخص", result?.summary)}

        ${renderAIField("التصنيف", result?.category)}

        ${
          keywords.length
            ? `
              <div style="margin-top:15px;">
                <div style="
                  font-size:12px;
                  color:#6f899b;
                  font-weight:900;
                  margin-bottom:8px;
                ">
                  الكلمات المفتاحية
                </div>

                <div style="
                  display:flex;
                  gap:7px;
                  flex-wrap:wrap;
                ">
                  ${keywords.map(keyword => `
                    <span style="
                      background:#eef9fe;
                      color:#247aa3;
                      padding:7px 10px;
                      border-radius:999px;
                      font-size:11px;
                      font-weight:800;
                    ">
                      ${escapeHtml(keyword)}
                    </span>
                  `).join("")}
                </div>
              </div>
            `
            : ""
        }

        ${renderAIField(
          "وصف الفيديو",
          result?.video_description
        )}

        ${renderAIField(
          "ملاحظات التحرير",
          result?.editor_notes
        )}

        ${renderAIField(
          "مخاطر المحتوى",
          Array.isArray(result?.risk_flags)
            ? result.risk_flags.join("، ")
            : result?.risk_flags
        )}

        ${renderAIField(
          "درجة الثقة",
          result?.confidence !== undefined
            ? String(result.confidence)
            : null
        )}

        ${
          Object.keys(socialPosts).length
            ? `
              <div style="margin-top:20px;">
                <div style="
                  font-size:12px;
                  color:#6f899b;
                  font-weight:900;
                  margin-bottom:10px;
                ">
                  منشورات التواصل الاجتماعي
                </div>

                ${Object.entries(socialPosts)
                  .map(([platform, text]) => `
                    <div style="
                      border:1px solid #e4eef5;
                      border-radius:14px;
                      padding:13px;
                      margin-bottom:9px;
                      background:#fbfdff;
                    ">
                      <div style="
                        color:#287ea4;
                        font-weight:900;
                        font-size:11px;
                        margin-bottom:6px;
                      ">
                        ${escapeHtml(platform)}
                      </div>

                      <div style="
                        color:#456578;
                        line-height:1.8;
                        white-space:pre-wrap;
                        font-size:13px;
                      ">
                        ${escapeHtml(text)}
                      </div>
                    </div>
                  `)
                  .join("")}
              </div>
            `
            : ""
        }

      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById("ez-nr-ai-close")
      ?.addEventListener("click", () => modal.remove());

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        modal.remove();
      }
    });
  }

  function renderAIField(label, value) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "";
    }

    return `
      <div style="
        margin-top:14px;
        border:1px solid #e4eef5;
        border-radius:14px;
        padding:13px;
        background:#fbfdff;
      ">
        <div style="
          color:#6f899b;
          font-size:11px;
          font-weight:900;
          margin-bottom:6px;
        ">
          ${escapeHtml(label)}
        </div>

        <div style="
          color:#294d63;
          line-height:1.8;
          font-size:13px;
          white-space:pre-wrap;
        ">
          ${escapeHtml(value)}
        </div>
      </div>
    `;
  }

  async function publishContent(id) {
    const confirmed = window.confirm(
      "هل تريد نشر هذا المحتوى الآن؟"
    );

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `${API.content}/${encodeURIComponent(id)}/publish`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      notify(
        "تم إرسال طلب نشر المحتوى بنجاح.",
        "success"
      );

      await loadContent();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  function createContent() {
    if (window.EZMediaAdminContent?.create) {
      window.EZMediaAdminContent.create();
      return;
    }

    if (window.EZMediaAdminContent?.openEditor) {
      window.EZMediaAdminContent.openEditor();
      return;
    }

    notify(
      "محرر المحتوى غير متاح حاليًا.",
      "info"
    );
  }

  function bindEvents() {
    document
      .getElementById("ez-nr-refresh")
      ?.addEventListener("click", loadContent);

    document
      .getElementById("ez-nr-new")
      ?.addEventListener("click", createContent);

    document
      .getElementById("ez-nr-search")
      ?.addEventListener("input", event => {
        state.search = event.target.value;
        applyFilters();
      });

    document
      .getElementById("ez-nr-type")
      ?.addEventListener("change", event => {
        state.type = event.target.value;
        applyFilters();
      });

    document
      .getElementById("ez-nr-status")
      ?.addEventListener("change", event => {
        state.status = event.target.value;
        applyFilters();
      });

    document
      .getElementById("ez-nr-reset")
      ?.addEventListener("click", () => {
        state.search = "";
        state.type = "";
        state.status = "";

        const search =
          document.getElementById("ez-nr-search");

        const type =
          document.getElementById("ez-nr-type");

        const status =
          document.getElementById("ez-nr-status");

        if (search) search.value = "";
        if (type) type.value = "";
        if (status) status.value = "";

        applyFilters();
      });

    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "#ez-newsroom-app [data-action]"
          );

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (!id) return;

        if (action === "view") {
          openContent(id);
        }

        if (action === "edit") {
          editContent(id);
        }

        if (action === "ai") {
          analyzeWithAI(id);
        }

        if (action === "publish") {
          publishContent(id);
        }
      }
    );
  }

  function initialize() {
    const container = getContainer();

    if (!container) {
      return false;
    }

    renderShell();
    loadContent();

    return true;
  }

  window.EZMediaAdminNewsroom = {
    initialize,
    refresh: loadContent,
    getState: () => ({
      ...state,
      items: [...state.items],
      filteredItems: [...state.filteredItems]
    })
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
