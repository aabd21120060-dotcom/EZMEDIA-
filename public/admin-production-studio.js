"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 24
 * الملف: public/admin-production-studio.js
 *
 * استوديو الإنتاج الإعلامي الذكي
 *
 * الوظائف:
 * - إدارة مشاريع الإنتاج الإعلامي
 * - تحويل الفكرة إلى مشروع إنتاج
 * - ربط المحتوى بالوسائط
 * - تحديد نوع الإنتاج
 * - إدارة مراحل الإنتاج
 * - إدارة الأولويات
 * - إنشاء موجز إنتاج
 * - تجهيز المادة للتحرير
 * - تشغيل تحليل AI للمحتوى
 * - ربط المشروع بالمحتوى المنشور
 * - ربط المشروع بالوسائط
 * - حفظ حالة المشروع محليًا
 * - واجهة RTL متوافقة مع لوحة EZ MEDIA
 *
 * ملاحظة:
 * هذه الوحدة لا تدعي تنفيذ مونتاج أو معالجة فيديو فعلية داخل المتصفح.
 * معالجة الفيديو والصور مستقبلاً تُربط بخدمات Backend/Workers متخصصة.
 */

(function () {
  const MODULE = "production-studio";
  const STORAGE_KEY = "ezmedia_production_projects_v1";

  const API = {
    content: "/api/content",
    media: "/api/media",
    ai: "/api/ai"
  };

  const TYPES = [
    "خبر",
    "تقرير",
    "مقابلة",
    "تغطية",
    "فيديو",
    "وثائقي",
    "بودكاست",
    "بث مباشر",
    "حملة إعلامية",
    "محتوى اجتماعي"
  ];

  const STATUSES = {
    idea: "فكرة",
    planning: "تخطيط",
    production: "إنتاج",
    editing: "تحرير",
    review: "مراجعة",
    approved: "معتمد",
    published: "منشور",
    archived: "مؤرشف"
  };

  const PRIORITIES = {
    low: "منخفضة",
    normal: "عادية",
    high: "عالية",
    critical: "عاجلة"
  };

  let state = {
    projects: loadProjects(),
    contents: [],
    media: [],
    selectedProject: null,
    filter: "all",
    search: ""
  };

  function loadProjects() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error("EZ MEDIA Production load error:", error);
      return [];
    }
  }

  function saveProjects() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.projects)
      );
    } catch (error) {
      console.error("EZ MEDIA Production save error:", error);
    }
  }

  function uid(prefix = "production") {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
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
    if (typeof window.EZMediaAdminNotifications?.push === "function") {
      window.EZMediaAdminNotifications.push({
        type,
        title: "استوديو الإنتاج",
        message
      });
    }

    window.dispatchEvent(
      new CustomEvent("ezmedia:notification", {
        detail: {
          module: MODULE,
          type,
          title: "استوديو الإنتاج",
          message
        }
      })
    );

    const box = document.querySelector("#ez-production-toast");

    if (box) {
      box.textContent = message;
      box.dataset.type = type;
      box.classList.add("show");

      clearTimeout(box._timer);

      box._timer = setTimeout(() => {
        box.classList.remove("show");
      }, 3200);
    }
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

    let data = null;

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

  async function loadData() {
    try {
      const content = await fetchJSON(
        `${API.content}?limit=200`
      );

      state.contents = Array.isArray(content)
        ? content
        : content.items ||
          content.data ||
          content.content ||
          [];
    } catch (error) {
      console.warn(
        "EZ MEDIA Production content load:",
        error.message
      );

      state.contents = [];
    }

    try {
      const media = await fetchJSON(
        `${API.media}?limit=200`
      );

      state.media = Array.isArray(media)
        ? media
        : media.items ||
          media.data ||
          media.media ||
          [];
    } catch (error) {
      console.warn(
        "EZ MEDIA Production media load:",
        error.message
      );

      state.media = [];
    }
  }

  function ensureSection() {
    let section =
      document.querySelector("#production-studio-section");

    if (section) {
      return section;
    }

    const parent =
      document.querySelector("main") ||
      document.querySelector("#admin-main") ||
      document.body;

    section = document.createElement("section");

    section.id = "production-studio-section";
    section.className = "ez-production-studio-section";
    section.hidden = true;

    parent.appendChild(section);

    return section;
  }

  function renderStyles() {
    if (document.querySelector("#ez-production-studio-styles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "ez-production-studio-styles";

    style.textContent = `
      #production-studio-section {
        direction: rtl;
        font-family: system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", Tahoma, Arial, sans-serif;
        padding: 22px;
        color: #16324a;
      }

      .ez-production-shell {
        max-width: 1500px;
        margin: 0 auto;
      }

      .ez-production-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 22px;
        border-radius: 24px;
        background:
          linear-gradient(
            135deg,
            rgba(236, 250, 255, .98),
            rgba(255, 255, 255, .98)
          );
        border: 1px solid #d9f2fb;
        box-shadow: 0 12px 35px rgba(47, 159, 196, .10);
      }

      .ez-production-title h2 {
        margin: 0 0 7px;
        font-size: 28px;
      }

      .ez-production-title p {
        margin: 0;
        color: #678196;
        line-height: 1.7;
      }

      .ez-production-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-production-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #e9f8fd;
        color: #126985;
        font-weight: 700;
      }

      .ez-production-btn.primary {
        background: #2bafd1;
        color: white;
      }

      .ez-production-btn.danger {
        background: #fff0f2;
        color: #a52742;
      }

      .ez-production-metrics {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px;
        margin: 18px 0;
      }

      .ez-production-metric {
        background: white;
        border: 1px solid #e4f0f5;
        border-radius: 18px;
        padding: 17px;
        box-shadow: 0 8px 25px rgba(24, 98, 125, .06);
      }

      .ez-production-metric span {
        display: block;
        color: #71899b;
        font-size: 13px;
        margin-bottom: 8px;
      }

      .ez-production-metric strong {
        display: block;
        font-size: 25px;
        color: #123b56;
      }

      .ez-production-toolbar {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        margin: 18px 0;
      }

      .ez-production-input,
      .ez-production-select,
      .ez-production-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        border-radius: 12px;
        padding: 12px 14px;
        background: white;
        color: #183b52;
        outline: none;
      }

      .ez-production-input:focus,
      .ez-production-select:focus,
      .ez-production-textarea:focus {
        border-color: #59c7e6;
        box-shadow: 0 0 0 3px rgba(89, 199, 230, .12);
      }

      .ez-production-projects {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .ez-production-card {
        background: white;
        border: 1px solid #e0edf2;
        border-radius: 20px;
        padding: 18px;
        box-shadow: 0 8px 25px rgba(28, 103, 130, .06);
      }

      .ez-production-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }

      .ez-production-card h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.5;
      }

      .ez-production-badge {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 11px;
        font-weight: 800;
        background: #eefaff;
        color: #16708d;
      }

      .ez-production-card p {
        color: #71889a;
        line-height: 1.7;
      }

      .ez-production-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 14px 0;
      }

      .ez-production-meta div {
        background: #f7fbfd;
        border-radius: 10px;
        padding: 9px;
        font-size: 12px;
      }

      .ez-production-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .ez-production-empty {
        grid-column: 1 / -1;
        padding: 45px 20px;
        text-align: center;
        border-radius: 20px;
        background: #fbfeff;
        border: 1px dashed #cfe7ef;
        color: #7590a0;
      }

      .ez-production-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(17, 56, 75, .25);
        backdrop-filter: blur(7px);
      }

      .ez-production-modal.open {
        display: flex;
      }

      .ez-production-dialog {
        width: min(900px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: white;
        border-radius: 24px;
        box-shadow: 0 30px 80px rgba(20, 83, 110, .22);
      }

      .ez-production-dialog-header {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        align-items: center;
        padding: 20px 22px;
        border-bottom: 1px solid #e5f0f4;
      }

      .ez-production-dialog-body {
        padding: 22px;
      }

      .ez-production-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 13px;
      }

      .ez-production-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ez-production-field.full {
        grid-column: 1 / -1;
      }

      .ez-production-field label {
        font-weight: 800;
        font-size: 13px;
        color: #33566c;
      }

      .ez-production-dialog-footer {
        display: flex;
        justify-content: flex-start;
        gap: 8px;
        padding: 16px 22px;
        border-top: 1px solid #e5f0f4;
      }

      .ez-production-progress {
        height: 7px;
        overflow: hidden;
        border-radius: 99px;
        background: #e8f3f7;
        margin-top: 8px;
      }

      .ez-production-progress span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: #42badb;
      }

      #ez-production-toast {
        position: fixed;
        left: 22px;
        bottom: 22px;
        z-index: 100000;
        opacity: 0;
        pointer-events: none;
        transform: translateY(10px);
        transition: .2s ease;
        padding: 13px 17px;
        border-radius: 13px;
        background: #153f56;
        color: white;
        box-shadow: 0 12px 35px rgba(15, 69, 91, .22);
      }

      #ez-production-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 1100px) {
        .ez-production-metrics {
          grid-template-columns: repeat(3, 1fr);
        }

        .ez-production-projects {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 720px) {
        #production-studio-section {
          padding: 12px;
        }

        .ez-production-header,
        .ez-production-toolbar {
          grid-template-columns: 1fr;
          display: grid;
        }

        .ez-production-metrics {
          grid-template-columns: repeat(2, 1fr);
        }

        .ez-production-projects {
          grid-template-columns: 1fr;
        }

        .ez-production-form-grid {
          grid-template-columns: 1fr;
        }

        .ez-production-field.full {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function render() {
    const section = ensureSection();

    const visibleProjects = getFilteredProjects();

    const metrics = calculateMetrics();

    section.innerHTML = `
      <div class="ez-production-shell">

        <div class="ez-production-header">
          <div class="ez-production-title">
            <h2>استوديو الإنتاج الإعلامي الذكي</h2>
            <p>
              مركز موحد لتحويل الأفكار والمواد الخام إلى إنتاج إعلامي
              منظم وجاهز للتحرير والمراجعة والنشر.
            </p>
          </div>

          <div class="ez-production-actions">
            <button
              class="ez-production-btn"
              data-production-action="refresh"
            >
              تحديث
            </button>

            <button
              class="ez-production-btn primary"
              data-production-action="new"
            >
              + مشروع إنتاج جديد
            </button>
          </div>
        </div>

        <div class="ez-production-metrics">
          ${metricCard("إجمالي المشاريع", metrics.total)}
          ${metricCard("أفكار", metrics.idea)}
          ${metricCard("قيد الإنتاج", metrics.production)}
          ${metricCard("قيد المراجعة", metrics.review)}
          ${metricCard("معتمد", metrics.approved)}
          ${metricCard("منشور", metrics.published)}
        </div>

        <div class="ez-production-toolbar">

          <input
            id="ez-production-search"
            class="ez-production-input"
            placeholder="ابحث باسم المشروع أو الوصف أو المسؤول..."
            value="${escapeHtml(state.search)}"
          />

          <select
            id="ez-production-filter"
            class="ez-production-select"
          >
            <option value="all">كل الحالات</option>

            ${Object.entries(STATUSES)
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${state.filter === key ? "selected" : ""}
                  >
                    ${escapeHtml(label)}
                  </option>
                `
              )
              .join("")}
          </select>

          <button
            class="ez-production-btn"
            data-production-action="clear-filter"
          >
            مسح البحث
          </button>

        </div>

        <div class="ez-production-projects">
          ${
            visibleProjects.length
              ? visibleProjects.map(renderProjectCard).join("")
              : `
                <div class="ez-production-empty">
                  <strong>لا توجد مشاريع إنتاج حتى الآن</strong>
                  <p>
                    أنشئ أول مشروع إنتاج ليبدأ الاستوديو بتنظيم دورة
                    العمل الإعلامية.
                  </p>

                  <button
                    class="ez-production-btn primary"
                    data-production-action="new"
                  >
                    إنشاء مشروع
                  </button>
                </div>
              `
          }
        </div>

      </div>

      <div
        id="ez-production-modal"
        class="ez-production-modal"
        aria-hidden="true"
      ></div>

      <div id="ez-production-toast"></div>
    `;

    bindEvents();
  }

  function metricCard(label, value) {
    return `
      <div class="ez-production-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${Number(value || 0)}</strong>
      </div>
    `;
  }

  function calculateMetrics() {
    const values = {
      total: state.projects.length,
      idea: 0,
      production: 0,
      review: 0,
      approved: 0,
      published: 0
    };

    for (const project of state.projects) {
      if (project.status === "idea") values.idea++;
      if (project.status === "production") values.production++;
      if (project.status === "review") values.review++;
      if (project.status === "approved") values.approved++;
      if (project.status === "published") values.published++;
    }

    return values;
  }

  function getFilteredProjects() {
    const search = state.search.trim().toLowerCase();

    return state.projects
      .filter((project) => {
        if (
          state.filter !== "all" &&
          project.status !== state.filter
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const haystack = [
          project.title,
          project.description,
          project.type,
          project.owner,
          project.location,
          project.notes
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0) -
          new Date(a.updatedAt || 0)
      );
  }

  function renderProjectCard(project) {
    const progress = getProgress(project.status);

    return `
      <article class="ez-production-card">

        <div class="ez-production-card-top">

          <div>
            <h3>
              ${escapeHtml(project.title)}
            </h3>

            <span class="ez-production-badge">
              ${escapeHtml(project.type)}
            </span>
          </div>

          <span class="ez-production-badge">
            ${escapeHtml(STATUSES[project.status] || project.status)}
          </span>

        </div>

        <p>
          ${escapeHtml(
            project.description ||
              "لا يوجد وصف للمشروع."
          )}
        </p>

        <div class="ez-production-meta">

          <div>
            <strong>الأولوية</strong>
            <br>
            ${escapeHtml(
              PRIORITIES[project.priority] ||
                project.priority ||
                "عادية"
            )}
          </div>

          <div>
            <strong>المسؤول</strong>
            <br>
            ${escapeHtml(project.owner || "غير محدد")}
          </div>

          <div>
            <strong>الموقع</strong>
            <br>
            ${escapeHtml(project.location || "غير محدد")}
          </div>

          <div>
            <strong>آخر تحديث</strong>
            <br>
            ${escapeHtml(formatDate(project.updatedAt))}
          </div>

        </div>

        <div>
          <small>
            تقدم الإنتاج: ${progress}%
          </small>

          <div class="ez-production-progress">
            <span style="width:${progress}%"></span>
          </div>
        </div>

        <div class="ez-production-card-actions" style="margin-top:14px">

          <button
            class="ez-production-btn"
            data-production-action="open"
            data-id="${escapeHtml(project.id)}"
          >
            فتح
          </button>

          <button
            class="ez-production-btn"
            data-production-action="ai"
            data-id="${escapeHtml(project.id)}"
          >
            تحليل AI
          </button>

          <button
            class="ez-production-btn"
            data-production-action="advance"
            data-id="${escapeHtml(project.id)}"
          >
            المرحلة التالية
          </button>

          <button
            class="ez-production-btn danger"
            data-production-action="delete"
            data-id="${escapeHtml(project.id)}"
          >
            حذف
          </button>

        </div>

      </article>
    `;
  }

  function getProgress(status) {
    const map = {
      idea: 10,
      planning: 20,
      production: 45,
      editing: 65,
      review: 80,
      approved: 92,
      published: 100,
      archived: 100
    };

    return map[status] ?? 0;
  }

  function openModal(title, body, footer = "") {
    const modal = document.querySelector(
      "#ez-production-modal"
    );

    if (!modal) return;

    modal.innerHTML = `
      <div class="ez-production-dialog">

        <div class="ez-production-dialog-header">
          <strong>${escapeHtml(title)}</strong>

          <button
            class="ez-production-btn"
            data-production-action="close-modal"
          >
            إغلاق
          </button>
        </div>

        <div class="ez-production-dialog-body">
          ${body}
        </div>

        ${
          footer
            ? `
              <div class="ez-production-dialog-footer">
                ${footer}
              </div>
            `
            : ""
        }

      </div>
    `;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const modal = document.querySelector(
      "#ez-production-modal"
    );

    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = "";
  }

  function openCreateProject() {
    openModal(
      "إنشاء مشروع إنتاج إعلامي",
      `
        <form id="ez-production-create-form">

          <div class="ez-production-form-grid">

            <div class="ez-production-field full">
              <label>اسم المشروع</label>

              <input
                class="ez-production-input"
                name="title"
                required
                placeholder="مثال: تغطية فعالية إعلامية"
              />
            </div>

            <div class="ez-production-field">
              <label>نوع الإنتاج</label>

              <select
                class="ez-production-select"
                name="type"
              >
                ${TYPES.map(
                  (type) =>
                    `<option value="${escapeHtml(type)}">
                      ${escapeHtml(type)}
                    </option>`
                ).join("")}
              </select>
            </div>

            <div class="ez-production-field">
              <label>الأولوية</label>

              <select
                class="ez-production-select"
                name="priority"
              >
                <option value="normal">عادية</option>
                <option value="high">عالية</option>
                <option value="critical">عاجلة</option>
                <option value="low">منخفضة</option>
              </select>
            </div>

            <div class="ez-production-field">
              <label>المسؤول</label>

              <input
                class="ez-production-input"
                name="owner"
                placeholder="اسم المسؤول عن الإنتاج"
              />
            </div>

            <div class="ez-production-field">
              <label>الموقع</label>

              <input
                class="ez-production-input"
                name="location"
                placeholder="الموقع أو الاستديو"
              />
            </div>

            <div class="ez-production-field full">
              <label>وصف المشروع</label>

              <textarea
                class="ez-production-textarea"
                name="description"
                rows="5"
                placeholder="اكتب فكرة المشروع وأهدافه..."
              ></textarea>
            </div>

            <div class="ez-production-field full">
              <label>ملاحظات الإنتاج</label>

              <textarea
                class="ez-production-textarea"
                name="notes"
                rows="4"
                placeholder="المتطلبات والملاحظات..."
              ></textarea>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-production-btn"
          data-production-action="close-modal"
        >
          إلغاء
        </button>

        <button
          class="ez-production-btn primary"
          data-production-action="save-new"
        >
          إنشاء المشروع
        </button>
      `
    );
  }

  function createProject() {
    const form = document.querySelector(
      "#ez-production-create-form"
    );

    if (!form) return;

    const data = new FormData(form);

    const now = new Date().toISOString();

    const project = {
      id: uid(),
      title: String(data.get("title") || "").trim(),
      type: String(data.get("type") || "خبر"),
      priority: String(data.get("priority") || "normal"),
      owner: String(data.get("owner") || "").trim(),
      location: String(data.get("location") || "").trim(),
      description: String(
        data.get("description") || ""
      ).trim(),
      notes: String(data.get("notes") || "").trim(),

      status: "idea",

      contentId: null,
      mediaIds: [],

      ai: {
        analyzed: false,
        confidence: null,
        summary: null,
        headline: null,
        keywords: [],
        risks: []
      },

      createdAt: now,
      updatedAt: now
    };

    if (!project.title) {
      notify("اكتب اسم المشروع أولاً.", "warning");
      return;
    }

    state.projects.unshift(project);

    saveProjects();
    closeModal();
    render();

    notify("تم إنشاء مشروع الإنتاج بنجاح.", "success");
  }

  function openProject(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) {
      notify("المشروع غير موجود.", "warning");
      return;
    }

    state.selectedProject = project;

    const content = project.contentId
      ? state.contents.find(
          (item) =>
            String(item.id) ===
            String(project.contentId)
        )
      : null;

    const linkedMedia = state.media.filter((item) =>
      (project.mediaIds || []).some(
        (id) => String(id) === String(item.id)
      )
    );

    openModal(
      project.title,
      `
        <div>

          <div class="ez-production-meta">

            <div>
              <strong>الحالة</strong>
              <br>
              ${escapeHtml(
                STATUSES[project.status] ||
                  project.status
              )}
            </div>

            <div>
              <strong>النوع</strong>
              <br>
              ${escapeHtml(project.type)}
            </div>

            <div>
              <strong>الأولوية</strong>
              <br>
              ${escapeHtml(
                PRIORITIES[project.priority] ||
                  project.priority
              )}
            </div>

            <div>
              <strong>المسؤول</strong>
              <br>
              ${escapeHtml(
                project.owner || "غير محدد"
              )}
            </div>

          </div>

          <h3>وصف المشروع</h3>

          <p>
            ${escapeHtml(
              project.description ||
                "لا يوجد وصف."
            )}
          </p>

          <h3>موجز الإنتاج</h3>

          <textarea
            id="ez-production-notes-${escapeHtml(project.id)}"
            class="ez-production-textarea"
            rows="7"
          >${escapeHtml(project.notes || "")}</textarea>

          <div style="margin-top:15px">

            <h3>المحتوى المرتبط</h3>

            ${
              content
                ? `
                  <div class="ez-production-card">
                    <strong>
                      ${escapeHtml(
                        content.title ||
                          content.headline ||
                          "محتوى"
                      )}
                    </strong>
                    <p>
                      ${escapeHtml(
                        content.summary || ""
                      )}
                    </p>
                  </div>
                `
                : `
                  <p>
                    لا يوجد محتوى مرتبط بالمشروع.
                  </p>
                `
            }

          </div>

          <div style="margin-top:15px">

            <h3>الوسائط المرتبطة</h3>

            <p>
              عدد الملفات المرتبطة:
              <strong>${linkedMedia.length}</strong>
            </p>

          </div>

          <div style="margin-top:15px">

            <h3>التحليل الذكي</h3>

            ${
              project.ai?.analyzed
                ? `
                  <div class="ez-production-card">
                    <strong>
                      ${escapeHtml(
                        project.ai.headline ||
                          "تم التحليل"
                      )}
                    </strong>

                    <p>
                      ${escapeHtml(
                        project.ai.summary ||
                          "لا يوجد ملخص."
                      )}
                    </p>

                    <small>
                      الثقة:
                      ${escapeHtml(
                        String(
                          project.ai.confidence ??
                            "غير محددة"
                        )
                      )}
                    </small>
                  </div>
                `
                : `
                  <p>
                    لم يتم تحليل المشروع بالذكاء الاصطناعي بعد.
                  </p>
                `
            }

          </div>

        </div>
      `,
      `
        <button
          class="ez-production-btn"
          data-production-action="save-notes"
          data-id="${escapeHtml(project.id)}"
        >
          حفظ الملاحظات
        </button>

        <button
          class="ez-production-btn"
          data-production-action="ai"
          data-id="${escapeHtml(project.id)}"
        >
          تحليل AI
        </button>

        <button
          class="ez-production-btn primary"
          data-production-action="advance"
          data-id="${escapeHtml(project.id)}"
        >
          المرحلة التالية
        </button>
      `
    );
  }

  function saveProjectNotes(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) return;

    const input = document.querySelector(
      `#ez-production-notes-${CSS.escape(id)}`
    );

    if (!input) return;

    project.notes = input.value.trim();
    project.updatedAt = new Date().toISOString();

    saveProjects();

    notify("تم حفظ ملاحظات المشروع.", "success");
  }

  function advanceProject(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) {
      notify("المشروع غير موجود.", "warning");
      return;
    }

    const sequence = [
      "idea",
      "planning",
      "production",
      "editing",
      "review",
      "approved",
      "published"
    ];

    const index = sequence.indexOf(project.status);

    if (index === -1) {
      project.status = "idea";
    } else if (index < sequence.length - 1) {
      project.status = sequence[index + 1];
    }

    project.updatedAt = new Date().toISOString();

    saveProjects();

    closeModal();
    render();

    notify(
      `انتقل المشروع إلى مرحلة: ${
        STATUSES[project.status]
      }`,
      "success"
    );
  }

  async function analyzeProject(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) {
      notify("المشروع غير موجود.", "warning");
      return;
    }

    notify(
      "جارٍ تجهيز المشروع للتحليل الذكي...",
      "info"
    );

    let targetContentId = project.contentId;

    /*
     * إذا كان المشروع مرتبطًا بمحتوى فعلي:
     * يتم استخدام تحليل AI الموجود في Backend.
     */
    if (targetContentId) {
      try {
        const result = await fetchJSON(
          `${API.ai}/content/${encodeURIComponent(
            targetContentId
          )}/analyze`,
          {
            method: "POST",
            body: JSON.stringify({
              source: "production_studio",
              projectId: project.id
            })
          }
        );

        const analysis =
          result.analysis ||
          result.data ||
          result;

        project.ai = {
          analyzed: true,
          confidence:
            analysis.confidence ??
            analysis.score ??
            null,
          summary:
            analysis.summary ||
            analysis.description ||
            null,
          headline:
            analysis.headline ||
            analysis.title ||
            null,
          keywords: Array.isArray(
            analysis.keywords
          )
            ? analysis.keywords
            : [],
          risks: Array.isArray(
            analysis.risk_flags
          )
            ? analysis.risk_flags
            : []
        };

        project.updatedAt = new Date().toISOString();

        saveProjects();

        render();

        notify(
          "اكتمل تحليل المشروع عبر خدمة الذكاء الاصطناعي.",
          "success"
        );

        return;
      } catch (error) {
        console.warn(
          "Production AI analysis:",
          error.message
        );

        notify(
          "تعذر تشغيل التحليل على المحتوى المرتبط.",
          "warning"
        );
      }
    }

    /*
     * لا يتم اختلاق نتيجة AI.
     * في حال عدم وجود محتوى مرتبط، نطلب من المستخدم
     * ربط المشروع بمحتوى قبل تشغيل تحليل Backend.
     */
    openModal(
      "التحليل الذكي",
      `
        <div class="ez-production-card">
          <h3>المشروع يحتاج محتوى مرتبطًا</h3>

          <p>
            خدمة AI الحالية في EZ MEDIA تعمل على المحتوى
            الموجود في CMS. اربط المشروع بمادة CMS أولًا،
            ثم شغّل التحليل الذكي للحصول على نتيجة فعلية.
          </p>

          <p>
            لا يتم إنشاء نتيجة وهمية أو نسبة ثقة غير حقيقية.
          </p>
        </div>
      `,
      `
        <button
          class="ez-production-btn"
          data-production-action="close-modal"
        >
          فهمت
        </button>
      `
    );
  }

  function deleteProject(id) {
    const project = state.projects.find(
      (item) => item.id === id
    );

    if (!project) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف مشروع "${project.title}"؟`
    );

    if (!confirmed) return;

    state.projects = state.projects.filter(
      (item) => item.id !== id
    );

    saveProjects();
    render();

    notify("تم حذف مشروع الإنتاج.", "success");
  }

  function clearFilter() {
    state.search = "";
    state.filter = "all";

    render();
  }

  function bindEvents() {
    const section = document.querySelector(
      "#production-studio-section"
    );

    if (!section) return;

    section
      .querySelectorAll("[data-production-action]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          const action =
            button.dataset.productionAction;

          const id = button.dataset.id;

          if (action === "new") {
            openCreateProject();
            return;
          }

          if (action === "close-modal") {
            closeModal();
            return;
          }

          if (action === "save-new") {
            createProject();
            return;
          }

          if (action === "open") {
            openProject(id);
            return;
          }

          if (action === "ai") {
            await analyzeProject(id);
            return;
          }

          if (action === "advance") {
            advanceProject(id);
            return;
          }

          if (action === "delete") {
            deleteProject(id);
            return;
          }

          if (action === "save-notes") {
            saveProjectNotes(id);
            return;
          }

          if (action === "refresh") {
            await initialize();
            notify(
              "تم تحديث استوديو الإنتاج.",
              "success"
            );
            return;
          }

          if (action === "clear-filter") {
            clearFilter();
          }
        });
      });

    const search =
      section.querySelector("#ez-production-search");

    if (search) {
      search.addEventListener("input", (event) => {
        state.search = event.target.value;
        render();
      });
    }

    const filter =
      section.querySelector("#ez-production-filter");

    if (filter) {
      filter.addEventListener("change", (event) => {
        state.filter = event.target.value;
        render();
      });
    }

    const modal =
      section.querySelector("#ez-production-modal");

    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal();
        }
      });
    }
  }

  async function initialize() {
    renderStyles();

    await loadData();

    render();
  }

  function show() {
    const section = ensureSection();

    section.hidden = false;

    initialize().catch((error) => {
      console.error(
        "EZ MEDIA Production initialization error:",
        error
      );

      notify(
        "حدث خطأ أثناء تشغيل استوديو الإنتاج.",
        "error"
      );
    });
  }

  function hide() {
    const section = document.querySelector(
      "#production-studio-section"
    );

    if (section) {
      section.hidden = true;
    }
  }

  function createExternalProject(data = {}) {
    const now = new Date().toISOString();

    const project = {
      id: uid(),
      title: data.title || "مشروع إنتاج جديد",
      type: data.type || "خبر",
      priority: data.priority || "normal",
      owner: data.owner || "",
      location: data.location || "",
      description: data.description || "",
      notes: data.notes || "",
      status: data.status || "idea",
      contentId: data.contentId || null,
      mediaIds: Array.isArray(data.mediaIds)
        ? data.mediaIds
        : [],
      ai: {
        analyzed: false,
        confidence: null,
        summary: null,
        headline: null,
        keywords: [],
        risks: []
      },
      createdAt: now,
      updatedAt: now
    };

    state.projects.unshift(project);
    saveProjects();

    render();

    return project;
  }

  function getProjects() {
    return [...state.projects];
  }

  window.EZMediaAdminProductionStudio = {
    module: MODULE,
    show,
    hide,
    refresh: initialize,
    createProject: createExternalProject,
    getProjects,
    getSelectedProject: () =>
      state.selectedProject
  };

  /*
   * استقبال أمر موحد من لوحة الإدارة.
   */
  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const section =
        event.detail?.section ||
        event.detail?.target;

      if (
        section === "production" ||
        section === "production-studio"
      ) {
        show();
      }
    }
  );

  /*
   * استقبال إنشاء مشروع من وحدات أخرى.
   */
  window.addEventListener(
    "ezmedia:production:create",
    (event) => {
      createExternalProject(
        event.detail || {}
      );
    }
  );

  /*
   * عند ربط محتوى بالمشروع من وحدة CMS مستقبلًا.
   */
  window.addEventListener(
    "ezmedia:production:attach-content",
    (event) => {
      const projectId =
        event.detail?.projectId;

      const contentId =
        event.detail?.contentId;

      if (!projectId || !contentId) return;

      const project = state.projects.find(
        (item) => item.id === projectId
      );

      if (!project) return;

      project.contentId = contentId;
      project.updatedAt =
        new Date().toISOString();

      saveProjects();
      render();

      notify(
        "تم ربط المحتوى بمشروع الإنتاج.",
        "success"
      );
    }
  );

  /*
   * بدء الوحدة إذا كانت موجودة في الصفحة.
   */
  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        ensureSection();
      },
      { once: true }
    );
  } else {
    ensureSection();
  }

  console.info(
    "EZ MEDIA 11.0 — Production Studio loaded."
  );
})();
