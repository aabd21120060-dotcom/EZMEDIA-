"use strict";

(() => {
  const API = {
    content: "/api/content",
    breaking: "/api/breaking",
    media: "/api/media",
    live: "/api/live",
    ai: "/api/ai"
  };

  const state = {
    content: [],
    breaking: [],
    media: [],
    live: [],
    filter: "all",
    search: "",
    loading: false
  };

  const selectors = [
    "#admin-newsroom-section",
    "#newsroom-section",
    "[data-admin-section='newsroom']"
  ];

  function getContainer() {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function number(value) {
    return new Intl.NumberFormat("ar-SA").format(
      Number(value || 0)
    );
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
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
        `فشل الطلب (${response.status})`
      );
    }

    return data;
  }

  function normalizeList(data, keys = []) {
    if (Array.isArray(data)) {
      return data;
    }

    for (const key of keys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }

  function contentStatusLabel(status) {
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

  function contentTypeLabel(type) {
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

  function statusClass(status) {
    return `status-${String(status || "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "")}`;
  }

  function getTitle(item) {
    return (
      item.title ||
      item.headline ||
      item.name ||
      "بدون عنوان"
    );
  }

  function getSummary(item) {
    return (
      item.summary ||
      item.description ||
      item.excerpt ||
      ""
    );
  }

  function getItems() {
    const contentItems = state.content.map((item) => ({
      ...item,
      newsroom_type: "content"
    }));

    const breakingItems = state.breaking.map((item) => ({
      ...item,
      newsroom_type: "breaking",
      content_type: "breaking",
      status: item.status || "active"
    }));

    return [...breakingItems, ...contentItems];
  }

  function filteredItems() {
    const search = state.search.trim().toLowerCase();

    return getItems().filter((item) => {
      if (
        state.filter !== "all" &&
        item.status !== state.filter
      ) {
        return false;
      }

      if (!search) return true;

      const text = [
        getTitle(item),
        getSummary(item),
        item.category,
        item.content_type,
        item.type,
        item.status,
        item.author_name,
        item.location
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }

  function renderShell(container) {
    container.innerHTML = `
      <style>
        #ez-newsroom {
          direction: rtl;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "SF Pro Display",
            "Segoe UI",
            Tahoma,
            Arial,
            sans-serif;
          color: #12304a;
        }

        #ez-newsroom * {
          box-sizing: border-box;
        }

        #ez-newsroom .newsroom-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 22px;
          margin-bottom: 18px;
          border: 1px solid #d9edf8;
          border-radius: 24px;
          background:
            linear-gradient(
              135deg,
              #ffffff 0%,
              #f4fbff 55%,
              #e7f8ff 100%
            );
          box-shadow:
            0 15px 40px rgba(63, 167, 214, 0.09);
        }

        #ez-newsroom .title h2 {
          margin: 0 0 7px;
          font-size: 27px;
          font-weight: 850;
        }

        #ez-newsroom .title p {
          margin: 0;
          color: #698394;
          line-height: 1.7;
        }

        #ez-newsroom .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        #ez-newsroom button {
          border: 0;
          border-radius: 13px;
          padding: 11px 15px;
          cursor: pointer;
          font: inherit;
          font-weight: 750;
          transition: 0.2s ease;
        }

        #ez-newsroom button:hover {
          transform: translateY(-1px);
        }

        #ez-newsroom .primary {
          background: #39bce9;
          color: #fff;
          box-shadow:
            0 8px 20px rgba(57, 188, 233, 0.23);
        }

        #ez-newsroom .secondary {
          background: #eefaff;
          color: #147ea7;
          border: 1px solid #cceefa;
        }

        #ez-newsroom .danger {
          background: #fff0f2;
          color: #ad3040;
          border: 1px solid #ffd5da;
        }

        #ez-newsroom .pipeline {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        #ez-newsroom .pipeline-card {
          position: relative;
          min-height: 105px;
          padding: 16px;
          overflow: hidden;
          border: 1px solid #dceef7;
          border-radius: 18px;
          background: #fff;
          box-shadow:
            0 9px 25px rgba(70, 160, 210, 0.06);
        }

        #ez-newsroom .pipeline-card::after {
          content: "";
          position: absolute;
          left: -20px;
          bottom: -25px;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: #eaf9ff;
        }

        #ez-newsroom .pipeline-label {
          position: relative;
          z-index: 1;
          color: #7590a2;
          font-size: 12px;
          margin-bottom: 9px;
        }

        #ez-newsroom .pipeline-value {
          position: relative;
          z-index: 1;
          color: #147fa8;
          font-size: 26px;
          font-weight: 850;
        }

        #ez-newsroom .toolbar {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          padding: 14px;
          margin-bottom: 16px;
          border: 1px solid #dceef7;
          border-radius: 18px;
          background: #fff;
        }

        #ez-newsroom .search {
          flex: 1;
          min-width: 230px;
        }

        #ez-newsroom input,
        #ez-newsroom select,
        #ez-newsroom textarea {
          width: 100%;
          padding: 11px 13px;
          border: 1px solid #cfe6f1;
          border-radius: 12px;
          outline: none;
          background: #fff;
          color: #173b53;
          font: inherit;
        }

        #ez-newsroom input:focus,
        #ez-newsroom select:focus,
        #ez-newsroom textarea:focus {
          border-color: #60c9ed;
          box-shadow:
            0 0 0 3px rgba(96, 201, 237, 0.12);
        }

        #ez-newsroom .workspace {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr)
                               minmax(280px, 0.8fr);
          gap: 16px;
          align-items: start;
        }

        #ez-newsroom .feed,
        #ez-newsroom .side-panel {
          border: 1px solid #dceef7;
          border-radius: 20px;
          background: #fff;
          box-shadow:
            0 10px 28px rgba(70, 160, 210, 0.06);
        }

        #ez-newsroom .panel-title {
          padding: 16px 18px;
          border-bottom: 1px solid #e7f2f7;
          font-weight: 850;
        }

        #ez-newsroom .items {
          padding: 13px;
          display: grid;
          gap: 11px;
        }

        #ez-newsroom .story {
          padding: 15px;
          border: 1px solid #e1f0f6;
          border-radius: 17px;
          background:
            linear-gradient(
              145deg,
              #ffffff,
              #fbfeff
            );
        }

        #ez-newsroom .story.breaking {
          border-color: #ffd8dc;
          background: #fffafa;
        }

        #ez-newsroom .story-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        #ez-newsroom .story-title {
          font-size: 17px;
          line-height: 1.6;
          font-weight: 850;
          color: #173d56;
        }

        #ez-newsroom .story-summary {
          margin: 9px 0;
          color: #6a8292;
          line-height: 1.7;
          font-size: 13px;
        }

        #ez-newsroom .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 9px 0;
        }

        #ez-newsroom .badge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 999px;
          background: #eef9fd;
          color: #167da4;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        #ez-newsroom .badge.status-published {
          background: #e9fbf4;
          color: #147b59;
        }

        #ez-newsroom .badge.status-review {
          background: #fff7e8;
          color: #9b6c16;
        }

        #ez-newsroom .badge.status-approved {
          background: #eef8ff;
          color: #197aa3;
        }

        #ez-newsroom .badge.status-draft {
          background: #f4f6f7;
          color: #667984;
        }

        #ez-newsroom .badge.status-active {
          background: #fff0f1;
          color: #b42d3e;
        }

        #ez-newsroom .story-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 12px;
          padding-top: 11px;
          border-top: 1px solid #edf4f7;
        }

        #ez-newsroom .story-date {
          color: #8296a2;
          font-size: 11px;
        }

        #ez-newsroom .story-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        #ez-newsroom .story-actions button {
          padding: 8px 11px;
          font-size: 12px;
        }

        #ez-newsroom .side-content {
          padding: 15px;
        }

        #ez-newsroom .ai-card {
          padding: 15px;
          border-radius: 16px;
          background:
            linear-gradient(
              145deg,
              #f2fbff,
              #e6f8ff
            );
          border: 1px solid #cdeefa;
          margin-bottom: 12px;
        }

        #ez-newsroom .ai-title {
          font-weight: 850;
          color: #147da6;
          margin-bottom: 7px;
        }

        #ez-newsroom .ai-text {
          color: #668090;
          font-size: 13px;
          line-height: 1.7;
        }

        #ez-newsroom .live-card {
          padding: 15px;
          border: 1px solid #dceef7;
          border-radius: 16px;
          margin-bottom: 10px;
        }

        #ez-newsroom .live-name {
          font-weight: 800;
          margin-bottom: 7px;
        }

        #ez-newsroom .live-status {
          color: #17805c;
          font-size: 12px;
          font-weight: 800;
        }

        #ez-newsroom .empty {
          padding: 45px 20px;
          text-align: center;
          color: #7a909d;
        }

        #ez-newsroom .loading {
          padding: 40px;
          text-align: center;
          color: #4d8099;
        }

        #ez-newsroom .error {
          padding: 15px;
          margin-bottom: 15px;
          border-radius: 14px;
          background: #fff1f2;
          color: #a82d3c;
          border: 1px solid #ffd4d8;
        }

        #ez-newsroom .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(18, 48, 74, 0.36);
          backdrop-filter: blur(8px);
        }

        #ez-newsroom .modal-backdrop.open {
          display: flex;
        }

        #ez-newsroom .modal {
          width: min(760px, 100%);
          max-height: 92vh;
          overflow: auto;
          padding: 22px;
          border-radius: 24px;
          background: #fff;
          box-shadow:
            0 30px 80px rgba(20, 80, 110, 0.22);
        }

        #ez-newsroom .modal h3 {
          margin: 0 0 18px;
        }

        #ez-newsroom .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        #ez-newsroom .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        #ez-newsroom .field.full {
          grid-column: 1 / -1;
        }

        #ez-newsroom .field label {
          font-size: 12px;
          color: #6c8595;
          font-weight: 750;
        }

        #ez-newsroom .modal-actions {
          display: flex;
          gap: 9px;
          margin-top: 18px;
        }

        @media (max-width: 1050px) {
          #ez-newsroom .pipeline {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          #ez-newsroom .workspace {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          #ez-newsroom .newsroom-header {
            flex-direction: column;
            align-items: stretch;
          }

          #ez-newsroom .pipeline {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          #ez-newsroom .form-grid {
            grid-template-columns: 1fr;
          }

          #ez-newsroom .field.full {
            grid-column: auto;
          }
        }
      </style>

      <div id="ez-newsroom">

        <div class="newsroom-header">
          <div class="title">
            <h2>غرفة الأخبار الذكية</h2>
            <p>
              مركز عمليات EZ MEDIA لمتابعة الخبر من لحظة وروده
              حتى المراجعة والاعتماد والنشر والتوزيع.
            </p>
          </div>

          <div class="actions">
            <button
              class="secondary"
              id="newsroom-refresh"
            >
              تحديث
            </button>

            <button
              class="primary"
              id="newsroom-new"
            >
              + خبر جديد
            </button>
          </div>
        </div>

        <div id="newsroom-error"></div>

        <div class="pipeline" id="newsroom-pipeline"></div>

        <div class="toolbar">
          <input
            id="newsroom-search"
            class="search"
            type="search"
            placeholder="ابحث في غرفة الأخبار..."
          />

          <select id="newsroom-filter">
            <option value="all">كل المحتوى</option>
            <option value="draft">مسودة</option>
            <option value="review">قيد المراجعة</option>
            <option value="approved">معتمد</option>
            <option value="scheduled">مجدول</option>
            <option value="published">منشور</option>
            <option value="active">عاجل نشط</option>
            <option value="archived">مؤرشف</option>
          </select>
        </div>

        <div class="workspace">

          <section class="feed">
            <div class="panel-title">
              موجز غرفة الأخبار
            </div>

            <div
              class="items"
              id="newsroom-items"
            ></div>
          </section>

          <aside class="side-panel">

            <div class="panel-title">
              ذكاء غرفة الأخبار
            </div>

            <div class="side-content">

              <div class="ai-card">
                <div class="ai-title">
                  محرك الذكاء الاصطناعي
                </div>

                <div class="ai-text">
                  تحليل العناوين والملخصات والكلمات المفتاحية
                  والمخاطر التحريرية واقتراحات التوزيع
                  مع إبقاء القرار التحريري النهائي للبشر.
                </div>
              </div>

              <div id="newsroom-ai-status"></div>

              <div
                class="panel-title"
                style="
                  margin:15px -15px 12px;
                  border-top:1px solid #e7f2f7;
                "
              >
                البث المباشر
              </div>

              <div id="newsroom-live"></div>

            </div>
          </aside>

        </div>

        <div
          class="modal-backdrop"
          id="newsroom-modal-backdrop"
        >
          <div class="modal">

            <h3>
              إنشاء خبر جديد
            </h3>

            <form id="newsroom-form">

              <div class="form-grid">

                <div class="field full">
                  <label>العنوان</label>

                  <input
                    id="newsroom-title"
                    required
                  >
                </div>

                <div class="field">
                  <label>نوع المحتوى</label>

                  <select id="newsroom-type">
                    <option value="news">خبر</option>
                    <option value="report">تقرير</option>
                    <option value="interview">مقابلة</option>
                    <option value="video">فيديو</option>
                    <option value="coverage">تغطية</option>
                  </select>
                </div>

                <div class="field">
                  <label>التصنيف</label>

                  <input
                    id="newsroom-category"
                    placeholder="محلي، عالمي، اقتصاد..."
                  >
                </div>

                <div class="field full">
                  <label>الملخص</label>

                  <textarea
                    id="newsroom-summary"
                    rows="5"
                  ></textarea>
                </div>

              </div>

              <div class="modal-actions">

                <button
                  type="submit"
                  class="primary"
                >
                  إنشاء المسودة
                </button>

                <button
                  type="button"
                  class="secondary"
                  id="newsroom-cancel"
                >
                  إلغاء
                </button>

              </div>

            </form>

          </div>
        </div>

      </div>
    `;

    bindEvents();
  }

  function renderPipeline() {
    const element =
      document.querySelector("#newsroom-pipeline");

    if (!element) return;

    const all = getItems();

    const draft = all.filter(
      (item) => item.status === "draft"
    ).length;

    const review = all.filter(
      (item) => item.status === "review"
    ).length;

    const published = all.filter(
      (item) => item.status === "published"
    ).length;

    const breaking = state.breaking.filter(
      (item) =>
        item.status === "active" ||
        item.status === "published"
    ).length;

    const live = state.live.filter(
      (item) =>
        item.status === "live"
    ).length;

    element.innerHTML = `
      <div class="pipeline-card">
        <div class="pipeline-label">
          إجمالي المواد
        </div>
        <div class="pipeline-value">
          ${number(all.length)}
        </div>
      </div>

      <div class="pipeline-card">
        <div class="pipeline-label">
          مسودات
        </div>
        <div class="pipeline-value">
          ${number(draft)}
        </div>
      </div>

      <div class="pipeline-card">
        <div class="pipeline-label">
          قيد المراجعة
        </div>
        <div class="pipeline-value">
          ${number(review)}
        </div>
      </div>

      <div class="pipeline-card">
        <div class="pipeline-label">
          منشور
        </div>
        <div class="pipeline-value">
          ${number(published)}
        </div>
      </div>

      <div class="pipeline-card">
        <div class="pipeline-label">
          مباشر الآن
        </div>
        <div class="pipeline-value">
          ${number(live + breaking)}
        </div>
      </div>
    `;
  }

  function renderItems() {
    const element =
      document.querySelector("#newsroom-items");

    if (!element) return;

    const items = filteredItems();

    if (!items.length) {
      element.innerHTML = `
        <div class="empty">
          لا توجد مواد مطابقة للبحث أو الفلتر الحالي.
        </div>
      `;
      return;
    }

    element.innerHTML = items
      .sort((a, b) => {
        const aDate =
          new Date(
            a.updated_at ||
            a.created_at ||
            a.published_at ||
            0
          ).getTime();

        const bDate =
          new Date(
            b.updated_at ||
            b.created_at ||
            b.published_at ||
            0
          ).getTime();

        return bDate - aDate;
      })
      .map((item) => {

        const isBreaking =
          item.newsroom_type === "breaking" ||
          item.content_type === "breaking";

        const status =
          item.status || "draft";

        const id =
          item.id || "";

        return `
          <article
            class="story ${isBreaking ? "breaking" : ""}"
          >

            <div class="story-head">

              <div class="story-title">
                ${escapeHtml(getTitle(item))}
              </div>

              <span
                class="badge ${statusClass(status)}"
              >
                ${escapeHtml(
                  isBreaking
                    ? "عاجل"
                    : contentStatusLabel(status)
                )}
              </span>

            </div>

            <div class="badges">

              ${
                item.content_type ||
                item.type
                  ? `
                    <span class="badge">
                      ${escapeHtml(
                        contentTypeLabel(
                          item.content_type ||
                          item.type
                        )
                      )}
                    </span>
                  `
                  : ""
              }

              ${
                item.category
                  ? `
                    <span class="badge">
                      ${escapeHtml(item.category)}
                    </span>
                  `
                  : ""
              }

              ${
                item.location
                  ? `
                    <span class="badge">
                      ${escapeHtml(item.location)}
                    </span>
                  `
                  : ""
              }

            </div>

            <div class="story-summary">
              ${escapeHtml(
                getSummary(item) ||
                "لا يوجد ملخص."
              )}
            </div>

            <div class="story-footer">

              <span class="story-date">
                ${formatDate(
                  item.updated_at ||
                  item.created_at ||
                  item.published_at
                )}
              </span>

              <div class="story-actions">

                ${
                  !isBreaking
                    ? `
                      <button
                        class="secondary"
                        data-action="analyze"
                        data-id="${escapeHtml(id)}"
                      >
                        تحليل AI
                      </button>
                    `
                    : ""
                }

                ${
                  status === "draft"
                    ? `
                      <button
                        class="secondary"
                        data-action="review"
                        data-id="${escapeHtml(id)}"
                      >
                        إرسال للمراجعة
                      </button>
                    `
                    : ""
                }

                ${
                  status === "review"
                    ? `
                      <button
                        class="primary"
                        data-action="approve"
                        data-id="${escapeHtml(id)}"
                      >
                        اعتماد
                      </button>
                    `
                    : ""
                }

                ${
                  status === "approved" ||
                  status === "scheduled"
                    ? `
                      <button
                        class="primary"
                        data-action="publish"
                        data-id="${escapeHtml(id)}"
                      >
                        نشر
                      </button>
                    `
                    : ""
                }

              </div>

            </div>

          </article>
        `;
      })
      .join("");
  }

  function renderAIStatus() {
    const element =
      document.querySelector("#newsroom-ai-status");

    if (!element) return;

    element.innerHTML = `
      <div class="ai-card">
        <div class="ai-title">
          النظام التحريري
        </div>

        <div class="ai-text">
          ${number(state.content.length)}
          مادة متاحة للتحليل والمعالجة التحريرية.
        </div>
      </div>
    `;
  }

  function renderLive() {
    const element =
      document.querySelector("#newsroom-live");

    if (!element) return;

    const liveChannels = state.live.filter(
      (channel) =>
        channel.status === "live" ||
        channel.status === "testing"
    );

    if (!liveChannels.length) {
      element.innerHTML = `
        <div class="empty" style="padding:25px 10px;">
          لا توجد قنوات مباشرة الآن.
        </div>
      `;
      return;
    }

    element.innerHTML = liveChannels
      .slice(0, 8)
      .map((channel) => `
        <div class="live-card">

          <div class="live-name">
            ${escapeHtml(
              channel.name ||
              channel.title ||
              "قناة مباشرة"
            )}
          </div>

          <div class="live-status">
            ● ${
              channel.status === "live"
                ? "مباشر الآن"
                : "اختبار"
            }
          </div>

        </div>
      `)
      .join("");
  }

  async function loadContent() {
    const data = await request(
      `${API.content}?limit=200`
    );

    state.content = normalizeList(
      data,
      ["content", "items"]
    );
  }

  async function loadBreaking() {
    try {
      const data = await request(
        `${API.breaking}?limit=200`
      );

      state.breaking = normalizeList(
        data,
        ["breaking", "items"]
      );
    } catch (error) {
      console.warn(
        "تعذر تحميل العاجل:",
        error
      );

      state.breaking = [];
    }
  }

  async function loadMedia() {
    try {
      const data = await request(
        `${API.media}?limit=100`
      );

      state.media = normalizeList(
        data,
        ["media", "assets", "items"]
      );
    } catch (error) {
      console.warn(
        "تعذر تحميل الوسائط:",
        error
      );

      state.media = [];
    }
  }

  async function loadLive() {
    try {
      const data = await request(
        `${API.live}?limit=100`
      );

      state.live = normalizeList(
        data,
        ["channels", "live", "items"]
      );
    } catch (error) {
      console.warn(
        "تعذر تحميل البث:",
        error
      );

      state.live = [];
    }
  }

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    const errorElement =
      document.querySelector("#newsroom-error");

    const itemsElement =
      document.querySelector("#newsroom-items");

    if (errorElement) {
      errorElement.innerHTML = "";
    }

    if (itemsElement) {
      itemsElement.innerHTML = `
        <div class="loading">
          جاري تحديث غرفة الأخبار...
        </div>
      `;
    }

    try {
      await Promise.all([
        loadContent(),
        loadBreaking(),
        loadMedia(),
        loadLive()
      ]);

      renderPipeline();
      renderItems();
      renderAIStatus();
      renderLive();

    } catch (error) {
      console.error(error);

      if (errorElement) {
        errorElement.innerHTML = `
          <div class="error">
            تعذر تحديث غرفة الأخبار:
            ${escapeHtml(error.message)}
          </div>
        `;
      }

    } finally {
      state.loading = false;
    }
  }

  async function createContent(event) {
    event.preventDefault();

    const title =
      document.querySelector("#newsroom-title")
        .value
        .trim();

    const contentType =
      document.querySelector("#newsroom-type")
        .value;

    const category =
      document.querySelector("#newsroom-category")
        .value
        .trim();

    const summary =
      document.querySelector("#newsroom-summary")
        .value
        .trim();

    if (!title) {
      alert("اكتب عنوان الخبر أولًا.");
      return;
    }

    const button =
      document.querySelector(
        "#newsroom-form button[type='submit']"
      );

    if (button) {
      button.disabled = true;
      button.textContent = "جاري الإنشاء...";
    }

    try {
      await request(API.content, {
        method: "POST",
        body: JSON.stringify({
          title,
          content_type: contentType,
          type: contentType,
          category,
          summary,
          status: "draft"
        })
      });

      closeModal();

      await refresh();

      alert("تم إنشاء المسودة بنجاح.");

    } catch (error) {
      alert(
        `تعذر إنشاء المحتوى: ${error.message}`
      );

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "إنشاء المسودة";
      }
    }
  }

  async function analyzeContent(id) {
    try {
      const data = await request(
        `${API.ai}/content/${encodeURIComponent(id)}/analyze`,
        {
          method: "POST"
        }
      );

      const result =
        data?.analysis ||
        data?.result ||
        data?.data ||
        data;

      const headline =
        result?.headline ||
        result?.title ||
        "لا يوجد عنوان مقترح";

      const summary =
        result?.summary ||
        "لا يوجد ملخص";

      alert(
        `تحليل الذكاء الاصطناعي\n\n` +
        `العنوان المقترح:\n${headline}\n\n` +
        `الملخص:\n${summary}`
      );

    } catch (error) {
      alert(
        `تعذر تشغيل تحليل الذكاء الاصطناعي: ${error.message}`
      );
    }
  }

  async function changeContentStatus(
    id,
    action
  ) {
    const routes = {
      review: `/api/content/${encodeURIComponent(id)}/submit-review`,
      approve: `/api/content/${encodeURIComponent(id)}/approve`,
      publish: `/api/content/${encodeURIComponent(id)}/publish`
    };

    const url = routes[action];

    if (!url) return;

    try {
      await request(url, {
        method: "POST"
      });

      await refresh();

    } catch (error) {
      alert(
        `تعذر تنفيذ العملية: ${error.message}`
      );
    }
  }

  function openModal() {
    const backdrop =
      document.querySelector(
        "#newsroom-modal-backdrop"
      );

    if (!backdrop) return;

    document.querySelector(
      "#newsroom-title"
    ).value = "";

    document.querySelector(
      "#newsroom-type"
    ).value = "news";

    document.querySelector(
      "#newsroom-category"
    ).value = "";

    document.querySelector(
      "#newsroom-summary"
    ).value = "";

    backdrop.classList.add("open");
  }

  function closeModal() {
    const backdrop =
      document.querySelector(
        "#newsroom-modal-backdrop"
      );

    if (backdrop) {
      backdrop.classList.remove("open");
    }
  }

  function bindEvents() {

    document
      .querySelector("#newsroom-refresh")
      ?.addEventListener(
        "click",
        refresh
      );

    document
      .querySelector("#newsroom-new")
      ?.addEventListener(
        "click",
        openModal
      );

    document
      .querySelector("#newsroom-cancel")
      ?.addEventListener(
        "click",
        closeModal
      );

    document
      .querySelector("#newsroom-modal-backdrop")
      ?.addEventListener(
        "click",
        (event) => {
          if (
            event.target.id ===
            "newsroom-modal-backdrop"
          ) {
            closeModal();
          }
        }
      );

    document
      .querySelector("#newsroom-form")
      ?.addEventListener(
        "submit",
        createContent
      );

    document
      .querySelector("#newsroom-search")
      ?.addEventListener(
        "input",
        (event) => {
          state.search = event.target.value;
          renderItems();
        }
      );

    document
      .querySelector("#newsroom-filter")
      ?.addEventListener(
        "change",
        (event) => {
          state.filter = event.target.value;
          renderItems();
        }
      );

    document
      .querySelector("#newsroom-items")
      ?.addEventListener(
        "click",
        (event) => {

          const button =
            event.target.closest(
              "button[data-action]"
            );

          if (!button) return;

          const action =
            button.dataset.action;

          const id =
            button.dataset.id;

          if (!id) return;

          if (action === "analyze") {
            analyzeContent(id);
          }

          if (
            action === "review" ||
            action === "approve" ||
            action === "publish"
          ) {
            changeContentStatus(
              id,
              action
            );
          }
        }
      );
  }

  function initialize() {
    const container = getContainer();

    if (!container) return;

    renderShell(container);
    refresh();
  }

  window.EZMediaAdminNewsroom = {
    initialize,
    refresh,
    openModal,
    closeModal,
    getState: () => ({
      ...state
    })
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();
