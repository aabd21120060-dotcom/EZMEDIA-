"use strict";

(() => {
  const API = {
    content: "/api/content",
    ai: "/api/ai",
    breaking: "/api/breaking",
    media: "/api/media",
    live: "/api/live"
  };

  const state = {
    contents: [],
    filtered: [],
    breaking: [],
    media: [],
    live: [],
    selectedContent: null,
    loading: false,
    filter: {
      search: "",
      type: "all",
      status: "all"
    }
  };

  const TYPES = {
    news: "خبر",
    report: "تقرير",
    interview: "مقابلة",
    video: "فيديو",
    coverage: "تغطية",
    breaking: "عاجل"
  };

  const STATUS = {
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

  function normalizeList(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (Array.isArray(value?.items)) {
      return value.items;
    }

    if (Array.isArray(value?.data)) {
      return value.data;
    }

    return [];
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
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
      const message =
        data?.message ||
        data?.error ||
        `فشل الطلب: ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  function findContainer() {
    return (
      document.querySelector("#newsroom-section") ||
      document.querySelector("#admin-newsroom-section") ||
      document.querySelector('[data-admin-section="newsroom"]')
    );
  }

  function typeLabel(type) {
    return TYPES[type] || type || "غير محدد";
  }

  function statusLabel(status) {
    return STATUS[status] || status || "غير محدد";
  }

  function statusClass(status) {
    return `status-${String(status || "unknown").replace(
      /[^a-z0-9_-]/gi,
      "-"
    )}`;
  }

  function applyFilters() {
    const { search, type, status } = state.filter;

    const normalizedSearch = search.trim().toLowerCase();

    state.filtered = state.contents.filter((item) => {
      const matchesType =
        type === "all" ||
        String(item.type || item.content_type || "").toLowerCase() === type;

      const matchesStatus =
        status === "all" ||
        String(item.status || "").toLowerCase() === status;

      if (!normalizedSearch) {
        return matchesType && matchesStatus;
      }

      const searchable = [
        item.title,
        item.headline,
        item.summary,
        item.description,
        item.category,
        item.author_name,
        item.slug
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesType &&
        matchesStatus &&
        searchable.includes(normalizedSearch)
      );
    });
  }

  function renderShell(container) {
    container.innerHTML = `
      <div class="ez-newsroom">

        <style>
          .ez-newsroom {
            direction: rtl;
            font-family:
              -apple-system,
              BlinkMacSystemFont,
              "SF Pro Display",
              "Segoe UI",
              Tahoma,
              Arial,
              sans-serif;
            color: #16324a;
          }

          .ez-newsroom * {
            box-sizing: border-box;
          }

          .ez-newsroom-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            margin-bottom: 20px;
            padding: 20px;
            border: 1px solid #dceefa;
            border-radius: 24px;
            background:
              linear-gradient(
                135deg,
                #ffffff 0%,
                #f5fbff 50%,
                #eaf8ff 100%
              );
            box-shadow: 0 12px 35px rgba(67, 157, 210, 0.08);
          }

          .ez-newsroom-title {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .ez-newsroom-icon {
            width: 52px;
            height: 52px;
            display: grid;
            place-items: center;
            border-radius: 17px;
            background: linear-gradient(135deg, #e8f8ff, #cceeff);
            color: #168dcc;
            font-size: 25px;
            box-shadow: inset 0 0 0 1px #c5e9f9;
          }

          .ez-newsroom-title h2 {
            margin: 0;
            font-size: 24px;
            color: #123a55;
          }

          .ez-newsroom-title p {
            margin: 5px 0 0;
            color: #6b8799;
            font-size: 13px;
          }

          .ez-newsroom-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .ez-newsroom-btn {
            border: 1px solid #cfe8f5;
            background: #ffffff;
            color: #176d9c;
            padding: 10px 14px;
            border-radius: 13px;
            cursor: pointer;
            font-weight: 700;
            transition: 0.2s ease;
          }

          .ez-newsroom-btn:hover {
            transform: translateY(-1px);
            background: #f2fbff;
          }

          .ez-newsroom-btn.primary {
            border-color: #74c9ee;
            background: linear-gradient(135deg, #dff6ff, #c8edff);
            color: #0c6e9f;
          }

          .ez-newsroom-stats {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .ez-newsroom-stat {
            min-height: 105px;
            padding: 16px;
            border: 1px solid #dceefa;
            border-radius: 20px;
            background: #ffffff;
            box-shadow: 0 8px 25px rgba(64, 150, 201, 0.06);
          }

          .ez-newsroom-stat-label {
            color: #6f8999;
            font-size: 12px;
            margin-bottom: 10px;
          }

          .ez-newsroom-stat-value {
            color: #126d9e;
            font-size: 27px;
            font-weight: 800;
          }

          .ez-newsroom-toolbar {
            display: grid;
            grid-template-columns: minmax(240px, 1fr) 170px 170px auto;
            gap: 10px;
            margin-bottom: 18px;
          }

          .ez-newsroom-input,
          .ez-newsroom-select {
            width: 100%;
            min-height: 44px;
            border: 1px solid #cfe6f3;
            border-radius: 13px;
            padding: 10px 13px;
            background: #ffffff;
            color: #254a61;
            outline: none;
          }

          .ez-newsroom-input:focus,
          .ez-newsroom-select:focus {
            border-color: #63bee8;
            box-shadow: 0 0 0 3px rgba(99, 190, 232, 0.12);
          }

          .ez-newsroom-list {
            display: grid;
            gap: 12px;
          }

          .ez-newsroom-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 15px;
            padding: 18px;
            border: 1px solid #dceefa;
            border-radius: 20px;
            background: #ffffff;
            box-shadow: 0 8px 25px rgba(64, 150, 201, 0.05);
          }

          .ez-newsroom-card-main {
            min-width: 0;
          }

          .ez-newsroom-card-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 7px;
            margin-bottom: 9px;
          }

          .ez-newsroom-badge {
            display: inline-flex;
            align-items: center;
            min-height: 25px;
            padding: 4px 9px;
            border-radius: 999px;
            background: #eef9ff;
            color: #1674a5;
            font-size: 11px;
            font-weight: 800;
          }

          .ez-newsroom-badge.status-published {
            background: #e8fbf3;
            color: #16835e;
          }

          .ez-newsroom-badge.status-review {
            background: #fff8e7;
            color: #9b7411;
          }

          .ez-newsroom-badge.status-draft {
            background: #f1f6f9;
            color: #607b8c;
          }

          .ez-newsroom-card h3 {
            margin: 0 0 7px;
            font-size: 18px;
            line-height: 1.5;
            color: #143e58;
          }

          .ez-newsroom-card p {
            margin: 0;
            color: #6b8493;
            line-height: 1.7;
            font-size: 13px;
          }

          .ez-newsroom-date {
            margin-top: 9px;
            color: #8aa0ad;
            font-size: 11px;
          }

          .ez-newsroom-card-actions {
            display: flex;
            flex-direction: column;
            gap: 7px;
            min-width: 120px;
          }

          .ez-newsroom-card-actions button {
            border: 1px solid #d1e8f4;
            background: #ffffff;
            color: #176d9c;
            border-radius: 11px;
            padding: 8px 10px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
          }

          .ez-newsroom-card-actions button:hover {
            background: #f1fbff;
          }

          .ez-newsroom-card-actions .danger {
            color: #b24b62;
          }

          .ez-newsroom-empty {
            padding: 45px 20px;
            text-align: center;
            border: 1px dashed #bcddeb;
            border-radius: 20px;
            background: #fbfeff;
            color: #6e8998;
          }

          .ez-newsroom-loading {
            padding: 35px;
            text-align: center;
            color: #6b8799;
          }

          .ez-newsroom-modal {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(23, 77, 105, 0.22);
            backdrop-filter: blur(8px);
          }

          .ez-newsroom-modal.open {
            display: flex;
          }

          .ez-newsroom-modal-box {
            width: min(900px, 100%);
            max-height: 90vh;
            overflow: auto;
            border: 1px solid #d4edf8;
            border-radius: 25px;
            background: #ffffff;
            box-shadow: 0 30px 80px rgba(33, 112, 153, 0.2);
          }

          .ez-newsroom-modal-head {
            position: sticky;
            top: 0;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            padding: 18px 20px;
            border-bottom: 1px solid #e2f0f6;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(10px);
          }

          .ez-newsroom-modal-head h3 {
            margin: 0;
            color: #123e59;
          }

          .ez-newsroom-close {
            width: 38px;
            height: 38px;
            border: 0;
            border-radius: 12px;
            background: #eef9ff;
            color: #176d9c;
            cursor: pointer;
            font-size: 20px;
          }

          .ez-newsroom-modal-body {
            padding: 20px;
          }

          .ez-newsroom-form {
            display: grid;
            gap: 14px;
          }

          .ez-newsroom-form label {
            display: grid;
            gap: 7px;
            color: #35586c;
            font-size: 13px;
            font-weight: 700;
          }

          .ez-newsroom-form textarea {
            min-height: 180px;
            resize: vertical;
          }

          .ez-newsroom-form-actions {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
            gap: 8px;
            padding-top: 5px;
          }

          .ez-newsroom-alert {
            position: fixed;
            left: 20px;
            bottom: 20px;
            z-index: 100000;
            max-width: 420px;
            padding: 13px 16px;
            border-radius: 14px;
            border: 1px solid #cce8f5;
            background: #ffffff;
            color: #25536a;
            box-shadow: 0 15px 45px rgba(40, 125, 165, 0.18);
            display: none;
          }

          .ez-newsroom-alert.show {
            display: block;
          }

          @media (max-width: 1100px) {
            .ez-newsroom-stats {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .ez-newsroom-toolbar {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 700px) {
            .ez-newsroom-header {
              flex-direction: column;
              align-items: stretch;
            }

            .ez-newsroom-stats {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .ez-newsroom-toolbar {
              grid-template-columns: 1fr;
            }

            .ez-newsroom-card {
              grid-template-columns: 1fr;
            }

            .ez-newsroom-card-actions {
              flex-direction: row;
              flex-wrap: wrap;
            }
          }
        </style>

        <div class="ez-newsroom-header">
          <div class="ez-newsroom-title">
            <div class="ez-newsroom-icon">📰</div>
            <div>
              <h2>غرفة الأخبار الذكية</h2>
              <p>مركز التحكم في دورة الخبر من الفكرة إلى النشر والتوزيع</p>
            </div>
          </div>

          <div class="ez-newsroom-actions">
            <button class="ez-newsroom-btn" data-action="refresh">
              تحديث
            </button>

            <button class="ez-newsroom-btn" data-action="ai">
              🤖 الذكاء الاصطناعي
            </button>

            <button class="ez-newsroom-btn primary" data-action="new">
              + خبر جديد
            </button>
          </div>
        </div>

        <div class="ez-newsroom-stats">
          <div class="ez-newsroom-stat">
            <div class="ez-newsroom-stat-label">إجمالي المواد</div>
            <div class="ez-newsroom-stat-value" data-stat="total">0</div>
          </div>

          <div class="ez-newsroom-stat">
            <div class="ez-newsroom-stat-label">مسودات</div>
            <div class="ez-newsroom-stat-value" data-stat="draft">0</div>
          </div>

          <div class="ez-newsroom-stat">
            <div class="ez-newsroom-stat-label">قيد المراجعة</div>
            <div class="ez-newsroom-stat-value" data-stat="review">0</div>
          </div>

          <div class="ez-newsroom-stat">
            <div class="ez-newsroom-stat-label">منشورة</div>
            <div class="ez-newsroom-stat-value" data-stat="published">0</div>
          </div>

          <div class="ez-newsroom-stat">
            <div class="ez-newsroom-stat-label">عاجل</div>
            <div class="ez-newsroom-stat-value" data-stat="breaking">0</div>
          </div>

          <div class="ez-newsroom-stat">
            <div class="ez-newsroom-stat-label">مباشر الآن</div>
            <div class="ez-newsroom-stat-value" data-stat="live">0</div>
          </div>
        </div>

        <div class="ez-newsroom-toolbar">
          <input
            class="ez-newsroom-input"
            data-filter="search"
            type="search"
            placeholder="ابحث في الأخبار والعناوين والتقارير..."
            autocomplete="off"
          />

          <select class="ez-newsroom-select" data-filter="type">
            <option value="all">كل الأنواع</option>
            <option value="news">أخبار</option>
            <option value="report">تقارير</option>
            <option value="interview">مقابلات</option>
            <option value="video">فيديو</option>
            <option value="coverage">تغطيات</option>
            <option value="breaking">عاجل</option>
          </select>

          <select class="ez-newsroom-select" data-filter="status">
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="review">مراجعة</option>
            <option value="approved">معتمد</option>
            <option value="scheduled">مجدول</option>
            <option value="published">منشور</option>
            <option value="archived">مؤرشف</option>
          </select>

          <button class="ez-newsroom-btn" data-action="clear-filters">
            مسح
          </button>
        </div>

        <div class="ez-newsroom-list" data-list>
          <div class="ez-newsroom-loading">
            جارٍ تحميل غرفة الأخبار...
          </div>
        </div>

        <div class="ez-newsroom-modal" data-modal>
          <div class="ez-newsroom-modal-box">
            <div class="ez-newsroom-modal-head">
              <h3 data-modal-title>مادة إعلامية</h3>
              <button class="ez-newsroom-close" data-action="close-modal">
                ×
              </button>
            </div>

            <div class="ez-newsroom-modal-body" data-modal-body></div>
          </div>
        </div>

        <div class="ez-newsroom-alert" data-alert></div>
      </div>
    `;
  }

  function showAlert(message) {
    const container = findContainer();
    const alert = container?.querySelector("[data-alert]");

    if (!alert) return;

    alert.textContent = message;
    alert.classList.add("show");

    clearTimeout(alert._timer);

    alert._timer = setTimeout(() => {
      alert.classList.remove("show");
    }, 3500);
  }

  function updateStats() {
    const container = findContainer();
    if (!container) return;

    const counts = {
      total: state.contents.length,
      draft: 0,
      review: 0,
      published: 0,
      breaking: 0,
      live: state.live.filter(
        (item) => String(item.status || "").toLowerCase() === "live"
      ).length
    };

    state.contents.forEach((item) => {
      const status = String(item.status || "").toLowerCase();

      if (status === "draft") counts.draft++;
      if (status === "review") counts.review++;
      if (status === "published") counts.published++;

      const type = String(
        item.type || item.content_type || ""
      ).toLowerCase();

      if (type === "breaking") {
        counts.breaking++;
      }
    });

    Object.entries(counts).forEach(([key, value]) => {
      const element = container.querySelector(`[data-stat="${key}"]`);

      if (element) {
        element.textContent = value.toLocaleString("ar-SA");
      }
    });
  }

  function renderList() {
    const container = findContainer();
    if (!container) return;

    const list = container.querySelector("[data-list]");

    if (!list) return;

    if (!state.filtered.length) {
      list.innerHTML = `
        <div class="ez-newsroom-empty">
          <div style="font-size:38px;margin-bottom:10px;">📭</div>
          <strong>لا توجد مواد مطابقة</strong>
          <div style="margin-top:7px;">
            جرّب تغيير البحث أو الفلاتر.
          </div>
        </div>
      `;

      return;
    }

    list.innerHTML = state.filtered
      .map((item) => {
        const id = escapeHtml(item.id);
        const type = String(
          item.type || item.content_type || "news"
        ).toLowerCase();

        const status = String(item.status || "draft").toLowerCase();

        const title =
          item.title ||
          item.headline ||
          "بدون عنوان";

        const summary =
          item.summary ||
          item.description ||
          "لا يوجد ملخص لهذه المادة.";

        return `
          <article class="ez-newsroom-card">
            <div class="ez-newsroom-card-main">

              <div class="ez-newsroom-card-meta">
                <span class="ez-newsroom-badge">
                  ${escapeHtml(typeLabel(type))}
                </span>

                <span class="ez-newsroom-badge ${escapeHtml(
                  statusClass(status)
                )}">
                  ${escapeHtml(statusLabel(status))}
                </span>

                ${
                  item.category
                    ? `
                      <span class="ez-newsroom-badge">
                        ${escapeHtml(item.category)}
                      </span>
                    `
                    : ""
                }
              </div>

              <h3>${escapeHtml(title)}</h3>

              <p>
                ${escapeHtml(summary)}
              </p>

              <div class="ez-newsroom-date">
                ${escapeHtml(
                  formatDate(item.updated_at || item.created_at)
                )}
              </div>
            </div>

            <div class="ez-newsroom-card-actions">
              <button data-action="view" data-id="${id}">
                عرض
              </button>

              <button data-action="edit" data-id="${id}">
                تعديل
              </button>

              <button data-action="analyze" data-id="${id}">
                🤖 تحليل AI
              </button>

              ${
                status === "draft"
                  ? `
                    <button data-action="review" data-id="${id}">
                      إرسال للمراجعة
                    </button>
                  `
                  : ""
              }

              ${
                status === "review"
                  ? `
                    <button data-action="approve" data-id="${id}">
                      اعتماد
                    </button>
                  `
                  : ""
              }

              ${
                status === "approved" || status === "scheduled"
                  ? `
                    <button data-action="publish" data-id="${id}">
                      نشر
                    </button>
                  `
                  : ""
              }

              ${
                status === "published"
                  ? `
                    <button
                      class="danger"
                      data-action="archive"
                      data-id="${id}"
                    >
                      أرشفة
                    </button>
                  `
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadContents() {
    const data = await request(
      `${API.content}?limit=200`
    );

    state.contents = normalizeList(data);
    applyFilters();
    updateStats();
    renderList();
  }

  async function loadBreaking() {
    try {
      const data = await request(API.breaking);
      state.breaking = normalizeList(data);
    } catch {
      state.breaking = [];
    }
  }

  async function loadMedia() {
    try {
      const data = await request(
        `${API.media}?limit=200`
      );

      state.media = normalizeList(data);
    } catch {
      state.media = [];
    }
  }

  async function loadLive() {
    try {
      const data = await request(
        `${API.live}?limit=100`
      );

      state.live = normalizeList(data);
    } catch {
      state.live = [];
    }
  }

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    const container = findContainer();

    if (container) {
      const list = container.querySelector("[data-list]");

      if (list) {
        list.innerHTML = `
          <div class="ez-newsroom-loading">
            جارٍ تحديث غرفة الأخبار...
          </div>
        `;
      }
    }

    try {
      await Promise.all([
        loadContents(),
        loadBreaking(),
        loadMedia(),
        loadLive()
      ]);

      updateStats();
      renderList();

      showAlert("تم تحديث غرفة الأخبار بنجاح.");
    } catch (error) {
      console.error("EZ MEDIA Newsroom:", error);

      const list = container?.querySelector("[data-list]");

      if (list) {
        list.innerHTML = `
          <div class="ez-newsroom-empty">
            تعذر تحميل بيانات غرفة الأخبار.
            <br>
            <small>${escapeHtml(error.message)}</small>
          </div>
        `;
      }

      showAlert("تعذر تحديث غرفة الأخبار.");
    } finally {
      state.loading = false;
    }
  }

  function openModal(title, body) {
    const container = findContainer();
    if (!container) return;

    const modal = container.querySelector("[data-modal]");
    const modalTitle = container.querySelector("[data-modal-title]");
    const modalBody = container.querySelector("[data-modal-body]");

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modal.classList.add("open");
  }

  function closeModal() {
    const container = findContainer();

    const modal = container?.querySelector("[data-modal]");

    modal?.classList.remove("open");
  }

  function findContent(id) {
    return state.contents.find(
      (item) => String(item.id) === String(id)
    );
  }

  function viewContent(id) {
    const item = findContent(id);

    if (!item) return;

    state.selectedContent = item;

    openModal(
      item.title || item.headline || "المادة الإعلامية",
      `
        <div class="ez-newsroom-form">

          <div>
            <strong>العنوان</strong>
            <p>${escapeHtml(
              item.title || item.headline || "—"
            )}</p>
          </div>

          <div>
            <strong>الملخص</strong>
            <p>${escapeHtml(
              item.summary || item.description || "—"
            )}</p>
          </div>

          <div>
            <strong>النوع</strong>
            <p>${escapeHtml(
              typeLabel(
                item.type || item.content_type
              )
            )}</p>
          </div>

          <div>
            <strong>الحالة</strong>
            <p>${escapeHtml(
              statusLabel(item.status)
            )}</p>
          </div>

          <div>
            <strong>التصنيف</strong>
            <p>${escapeHtml(
              item.category || "—"
            )}</p>
          </div>

          <div>
            <strong>المعرّف</strong>
            <p dir="ltr">${escapeHtml(item.id)}</p>
          </div>

          <div>
            <strong>تاريخ الإنشاء</strong>
            <p>${escapeHtml(
              formatDate(item.created_at)
            )}</p>
          </div>

          <div>
            <strong>آخر تحديث</strong>
            <p>${escapeHtml(
              formatDate(item.updated_at)
            )}</p>
          </div>

        </div>
      `
    );
  }

  function openNewContent() {
    openModal(
      "إنشاء مادة إعلامية جديدة",
      `
        <form class="ez-newsroom-form" data-form="new-content">

          <label>
            العنوان
            <input
              class="ez-newsroom-input"
              name="title"
              required
              placeholder="اكتب عنوان المادة"
            />
          </label>

          <label>
            النوع
            <select
              class="ez-newsroom-select"
              name="type"
            >
              <option value="news">خبر</option>
              <option value="report">تقرير</option>
              <option value="interview">مقابلة</option>
              <option value="video">فيديو</option>
              <option value="coverage">تغطية</option>
              <option value="breaking">عاجل</option>
            </select>
          </label>

          <label>
            التصنيف
            <input
              class="ez-newsroom-input"
              name="category"
              placeholder="مثال: محلي، اقتصادي، رياضي..."
            />
          </label>

          <label>
            الملخص
            <textarea
              class="ez-newsroom-input"
              name="summary"
              placeholder="اكتب ملخص المادة..."
            ></textarea>
          </label>

          <div class="ez-newsroom-form-actions">
            <button
              type="submit"
              class="ez-newsroom-btn primary"
            >
              إنشاء المسودة
            </button>

            <button
              type="button"
              class="ez-newsroom-btn"
              data-action="close-modal"
            >
              إلغاء
            </button>
          </div>

        </form>
      `
    );
  }

  async function createContent(form) {
    const formData = new FormData(form);

    const payload = {
      title: formData.get("title"),
      type: formData.get("type"),
      category: formData.get("category"),
      summary: formData.get("summary"),
      status: "draft"
    };

    try {
      await request(API.content, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      closeModal();

      showAlert("تم إنشاء المسودة.");

      await refresh();
    } catch (error) {
      console.error(error);

      showAlert(
        `تعذر إنشاء المادة: ${error.message}`
      );
    }
  }

  function editContent(id) {
    const item = findContent(id);

    if (!item) return;

    openModal(
      "تعديل المادة الإعلامية",
      `
        <form
          class="ez-newsroom-form"
          data-form="edit-content"
          data-id="${escapeHtml(item.id)}"
        >

          <label>
            العنوان
            <input
              class="ez-newsroom-input"
              name="title"
              required
              value="${escapeHtml(
                item.title || item.headline || ""
              )}"
            />
          </label>

          <label>
            النوع
            <select
              class="ez-newsroom-select"
              name="type"
            >
              ${Object.entries(TYPES)
                .map(
                  ([value, label]) => `
                    <option
                      value="${escapeHtml(value)}"
                      ${
                        String(
                          item.type ||
                            item.content_type ||
                            ""
                        ) === value
                          ? "selected"
                          : ""
                      }
                    >
                      ${escapeHtml(label)}
                    </option>
                  `
                )
                .join("")}
            </select>
          </label>

          <label>
            التصنيف
            <input
              class="ez-newsroom-input"
              name="category"
              value="${escapeHtml(
                item.category || ""
              )}"
            />
          </label>

          <label>
            الملخص
            <textarea
              class="ez-newsroom-input"
              name="summary"
            >${escapeHtml(
              item.summary ||
                item.description ||
                ""
            )}</textarea>
          </label>

          <div class="ez-newsroom-form-actions">
            <button
              type="submit"
              class="ez-newsroom-btn primary"
            >
              حفظ التعديلات
            </button>

            <button
              type="button"
              class="ez-newsroom-btn"
              data-action="close-modal"
            >
              إلغاء
            </button>
          </div>

        </form>
      `
    );
  }

  async function updateContent(form) {
    const id = form.dataset.id;

    if (!id) return;

    const formData = new FormData(form);

    const payload = {
      title: formData.get("title"),
      type: formData.get("type"),
      category: formData.get("category"),
      summary: formData.get("summary")
    };

    try {
      await request(
        `${API.content}/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload)
        }
      );

      closeModal();

      showAlert("تم حفظ التعديلات.");

      await refresh();
    } catch (error) {
      console.error(error);

      showAlert(
        `تعذر حفظ التعديلات: ${error.message}`
      );
    }
  }

  async function changeStatus(id, action) {
    const routes = {
      review: `/submit-review`,
      approve: `/approve`,
      publish: `/publish`,
      archive: `/archive`
    };

    const route = routes[action];

    if (!route) return;

    const messages = {
      review: "تم إرسال المادة للمراجعة.",
      approve: "تم اعتماد المادة.",
      publish: "تم نشر المادة.",
      archive: "تمت أرشفة المادة."
    };

    try {
      await request(
        `${API.content}/${encodeURIComponent(id)}${route}`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      showAlert(messages[action]);

      await refresh();
    } catch (error) {
      console.error(error);

      showAlert(
        `تعذر تنفيذ العملية: ${error.message}`
      );
    }
  }

  async function analyzeContent(id) {
    const item = findContent(id);

    if (!item) return;

    openModal(
      "تحليل الذكاء الاصطناعي",
      `
        <div class="ez-newsroom-loading">
          🤖 جارٍ تحليل المادة بواسطة محرك الذكاء الاصطناعي...
        </div>
      `
    );

    try {
      const data = await request(
        `${API.ai}/content/${encodeURIComponent(
          id
        )}/analyze`,
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

      renderAIResult(result);
    } catch (error) {
      console.error(error);

      openModal(
        "تعذر تحليل المادة",
        `
          <div class="ez-newsroom-empty">
            تعذر تنفيذ تحليل الذكاء الاصطناعي.
            <br><br>
            ${escapeHtml(error.message)}
          </div>
        `
      );
    }
  }

  function renderAIResult(result) {
    const safeKeywords = Array.isArray(result?.keywords)
      ? result.keywords
      : [];

    const socialPosts =
      result?.social_posts || {};

    openModal(
      "نتيجة تحليل الذكاء الاصطناعي",
      `
        <div class="ez-newsroom-form">

          <div>
            <strong>العنوان المقترح</strong>
            <p>${escapeHtml(
              result?.headline || "—"
            )}</p>
          </div>

          <div>
            <strong>الملخص</strong>
            <p>${escapeHtml(
              result?.summary || "—"
            )}</p>
          </div>

          <div>
            <strong>التصنيف</strong>
            <p>${escapeHtml(
              result?.category || "—"
            )}</p>
          </div>

          <div>
            <strong>الكلمات المفتاحية</strong>
            <p>
              ${
                safeKeywords.length
                  ? safeKeywords
                      .map(
                        (keyword) =>
                          `<span class="ez-newsroom-badge">${escapeHtml(
                            keyword
                          )}</span>`
                      )
                      .join(" ")
                  : "—"
              }
            </p>
          </div>

          <div>
            <strong>منشورات التواصل الاجتماعي</strong>

            <p>
              <b>عام:</b>
              ${escapeHtml(
                socialPosts.general || "—"
              )}
            </p>

            <p>
              <b>X:</b>
              ${escapeHtml(
                socialPosts.x || "—"
              )}
            </p>

            <p>
              <b>Instagram:</b>
              ${escapeHtml(
                socialPosts.instagram || "—"
              )}
            </p>

            <p>
              <b>TikTok:</b>
              ${escapeHtml(
                socialPosts.tiktok || "—"
              )}
            </p>
          </div>

          <div>
            <strong>وصف الفيديو</strong>
            <p>${escapeHtml(
              result?.video_description || "—"
            )}</p>
          </div>

          <div>
            <strong>ملاحظات المحرر</strong>
            <p>${escapeHtml(
              result?.editor_notes || "—"
            )}</p>
          </div>

          <div>
            <strong>مؤشرات المخاطر</strong>
            <p>${escapeHtml(
              Array.isArray(result?.risk_flags)
                ? result.risk_flags.join("، ")
                : result?.risk_flags || "لا توجد"
            )}</p>
          </div>

          <div>
            <strong>درجة الثقة</strong>
            <p>${escapeHtml(
              result?.confidence ?? "—"
            )}</p>
          </div>

        </div>
      `
    );
  }

  function handleAction(action, id) {
    switch (action) {
      case "refresh":
        refresh();
        break;

      case "new":
        openNewContent();
        break;

      case "clear-filters": {
        const container = findContainer();

        state.filter = {
          search: "",
          type: "all",
          status: "all"
        };

        const search =
          container?.querySelector(
            '[data-filter="search"]'
          );

        const type =
          container?.querySelector(
            '[data-filter="type"]'
          );

        const status =
          container?.querySelector(
            '[data-filter="status"]'
          );

        if (search) search.value = "";
        if (type) type.value = "all";
        if (status) status.value = "all";

        applyFilters();
        renderList();
        break;
      }

      case "close-modal":
        closeModal();
        break;

      case "view":
        viewContent(id);
        break;

      case "edit":
        editContent(id);
        break;

      case "analyze":
        analyzeContent(id);
        break;

      case "review":
      case "approve":
      case "publish":
      case "archive":
        changeStatus(id, action);
        break;

      case "ai":
        showAlert(
          "حدد مادة من القائمة ثم اختر تحليل AI."
        );
        break;

      default:
        break;
    }
  }

  function bindEvents(container) {
    container.addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-action]"
      );

      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      handleAction(action, id);
    });

    container.addEventListener("input", (event) => {
      const filter =
        event.target.dataset.filter;

      if (filter !== "search") return;

      state.filter.search = event.target.value;

      applyFilters();
      renderList();
    });

    container.addEventListener("change", (event) => {
      const filter =
        event.target.dataset.filter;

      if (!filter) return;

      state.filter[filter] = event.target.value;

      applyFilters();
      renderList();
    });

    container.addEventListener("submit", (event) => {
      const form = event.target;

      if (form.dataset.form === "new-content") {
        event.preventDefault();
        createContent(form);
      }

      if (form.dataset.form === "edit-content") {
        event.preventDefault();
        updateContent(form);
      }
    });

    container.addEventListener("click", (event) => {
      const modal = event.target.closest(
        "[data-modal]"
      );

      if (
        modal &&
        event.target === modal
      ) {
        closeModal();
      }
    });
  }

  async function initialize() {
    const container = findContainer();

    if (!container) {
      return false;
    }

    renderShell(container);
    bindEvents(container);

    await refresh();

    return true;
  }

  window.EZMediaAdminNewsroom = {
    initialize,
    refresh,
    getState: () => ({
      ...state,
      contents: [...state.contents],
      filtered: [...state.filtered]
    })
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
