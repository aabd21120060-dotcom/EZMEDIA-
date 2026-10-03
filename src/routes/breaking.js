"use strict";

/*
 * ============================================================
 * EZ MEDIA 11.0
 * لوحة إدارة الأخبار العاجلة
 * ============================================================
 *
 * الملف:
 * public/admin-breaking.js
 *
 * الوظائف:
 * - عرض الأخبار العاجلة
 * - إنشاء عاجل جديد
 * - تعديل عاجل
 * - نشر عاجل
 * - إيقاف عاجل
 * - حذف عاجل
 * - تحديد الأولوية
 * - ربط العاجل بالمحتوى
 * - عرض الحالة
 * - شريط الأخبار العاجلة
 * - المؤقت الزمني
 * - التحديث التلقائي
 *
 * API:
 * GET    /api/breaking
 * GET    /api/breaking/:id
 * POST   /api/breaking
 * PATCH  /api/breaking/:id
 * DELETE /api/breaking/:id
 *
 * ملاحظة:
 * الملف لا يحتاج مكتبات إضافية.
 * ============================================================
 */

(function () {
  "use strict";

  const CONFIG = {
    API: "/api/breaking",
    CONTENT_API: "/api/content",
    REFRESH_INTERVAL: 30000,
    MAX_ITEMS: 100
  };

  const state = {
    items: [],
    content: [],
    editingId: null,
    loading: false,
    contentLoading: false,
    refreshTimer: null,
    filter: "all",
    search: "",
    priority: "all",
    status: "all"
  };

  const rootSelectors = [
    "#breaking-section",
    "#admin-breaking-section",
    '[data-admin-section="breaking"]'
  ];

  function getRoot() {
    for (const selector of rootSelectors) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

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

  function escapeAttribute(value) {
    return escapeHtml(value);
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

  function formatRelativeTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = Date.now();
    const difference = now - date.getTime();

    const seconds = Math.floor(difference / 1000);

    if (seconds < 60) {
      return "الآن";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `منذ ${minutes} دقيقة`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `منذ ${hours} ساعة`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `منذ ${days} يوم`;
    }

    return formatDate(value);
  }

  function normalizeStatus(status) {
    const value = String(status || "").toLowerCase();

    if (
      value === "published" ||
      value === "active" ||
      value === "live"
    ) {
      return "published";
    }

    if (
      value === "paused" ||
      value === "stopped" ||
      value === "inactive"
    ) {
      return "paused";
    }

    if (
      value === "expired" ||
      value === "archived"
    ) {
      return "expired";
    }

    return "draft";
  }

  function normalizePriority(priority) {
    const value = String(priority || "").toLowerCase();

    if (
      value === "critical" ||
      value === "urgent" ||
      value === "emergency"
    ) {
      return "critical";
    }

    if (
      value === "high" ||
      value === "important"
    ) {
      return "high";
    }

    if (
      value === "low"
    ) {
      return "low";
    }

    return "normal";
  }

  function statusLabel(status) {
    const labels = {
      published: "منشور",
      paused: "متوقف",
      expired: "منتهي",
      draft: "مسودة"
    };

    return labels[normalizeStatus(status)] || "مسودة";
  }

  function priorityLabel(priority) {
    const labels = {
      critical: "حرج",
      high: "مرتفع",
      normal: "عادي",
      low: "منخفض"
    };

    return labels[normalizePriority(priority)] || "عادي";
  }

  function statusClass(status) {
    return `ez-breaking-status-${normalizeStatus(status)}`;
  }

  function priorityClass(priority) {
    return `ez-breaking-priority-${normalizePriority(priority)}`;
  }

  function showToast(message, type = "info") {
    let container = document.getElementById(
      "ez-breaking-toast-container"
    );

    if (!container) {
      container = document.createElement("div");

      container.id = "ez-breaking-toast-container";

      container.innerHTML = `
        <style>
          #ez-breaking-toast-container {
            position: fixed;
            left: 20px;
            bottom: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: min(380px, calc(100vw - 40px));
          }

          .ez-breaking-toast {
            background: rgba(255,255,255,.97);
            border: 1px solid #dbeafe;
            border-radius: 16px;
            padding: 14px 16px;
            box-shadow: 0 15px 45px rgba(15,23,42,.14);
            color: #0f172a;
            font-size: 14px;
            line-height: 1.7;
            animation: ezBreakingToastIn .25s ease;
          }

          .ez-breaking-toast.success {
            border-right: 4px solid #16a34a;
          }

          .ez-breaking-toast.error {
            border-right: 4px solid #dc2626;
          }

          .ez-breaking-toast.warning {
            border-right: 4px solid #f59e0b;
          }

          .ez-breaking-toast.info {
            border-right: 4px solid #0ea5e9;
          }

          @keyframes ezBreakingToastIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        </style>
      `;

      document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    toast.className = `ez-breaking-toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4500);
  }

  async function apiRequest(
    url,
    options = {}
  ) {
    const requestOptions = {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    const response = await fetch(
      url,
      requestOptions
    );

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

  function extractItems(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    if (Array.isArray(data?.breaking)) {
      return data.breaking;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.rows)) {
      return data.rows;
    }

    return [];
  }

  function extractSingle(data) {
    if (data?.item) {
      return data.item;
    }

    if (data?.breaking) {
      return data.breaking;
    }

    if (data?.data && !Array.isArray(data.data)) {
      return data.data;
    }

    return data;
  }

  async function loadBreaking(options = {}) {
    if (state.loading && !options.force) {
      return;
    }

    state.loading = true;

    updateLoadingState(true);

    try {
      const query = new URLSearchParams();

      query.set("limit", String(CONFIG.MAX_ITEMS));

      const data = await apiRequest(
        `${CONFIG.API}?${query.toString()}`
      );

      state.items = extractItems(data);

      render();
    } catch (error) {
      console.error(
        "EZ MEDIA Breaking News:",
        error
      );

      showToast(
        `تعذر تحميل الأخبار العاجلة: ${error.message}`,
        "error"
      );
    } finally {
      state.loading = false;

      updateLoadingState(false);
    }
  }

  async function loadContent() {
    if (state.contentLoading) {
      return;
    }

    state.contentLoading = true;

    try {
      const data = await apiRequest(
        `${CONFIG.CONTENT_API}?limit=100`
      );

      state.content = extractItems(data);
    } catch (error) {
      console.warn(
        "تعذر تحميل المحتوى لربط العاجل:",
        error
      );

      state.content = [];
    } finally {
      state.contentLoading = false;
    }
  }

  function updateLoadingState(isLoading) {
    const root = getRoot();

    if (!root) {
      return;
    }

    const refreshButton = root.querySelector(
      '[data-action="refresh"]'
    );

    if (!refreshButton) {
      return;
    }

    refreshButton.disabled = isLoading;

    refreshButton.innerHTML = isLoading
      ? "جاري التحديث..."
      : "تحديث";
  }

  function getFilteredItems() {
    const search = state.search
      .trim()
      .toLowerCase();

    return state.items.filter((item) => {
      const status = normalizeStatus(
        item.status
      );

      const priority = normalizePriority(
        item.priority
      );

      if (
        state.status !== "all" &&
        status !== state.status
      ) {
        return false;
      }

      if (
        state.priority !== "all" &&
        priority !== state.priority
      ) {
        return false;
      }

      if (
        state.filter === "active" &&
        status !== "published"
      ) {
        return false;
      }

      if (
        state.filter === "critical" &&
        priority !== "critical"
      ) {
        return false;
      }

      if (
        state.filter === "recent"
      ) {
        const created =
          new Date(
            item.created_at ||
            item.createdAt ||
            item.published_at ||
            item.publishedAt ||
            0
          ).getTime();

        if (
          !created ||
          Date.now() - created > 24 * 60 * 60 * 1000
        ) {
          return false;
        }
      }

      if (search) {
        const text = [
          item.title,
          item.headline,
          item.text,
          item.message,
          item.summary,
          item.description,
          item.category,
          item.location
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!text.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }

  function calculateStats() {
    const total = state.items.length;

    const published = state.items.filter(
      (item) =>
        normalizeStatus(item.status) ===
        "published"
    ).length;

    const critical = state.items.filter(
      (item) =>
        normalizePriority(item.priority) ===
        "critical"
    ).length;

    const recent = state.items.filter(
      (item) => {
        const date = new Date(
          item.created_at ||
          item.createdAt ||
          item.published_at ||
          item.publishedAt ||
          0
        ).getTime();

        return (
          date &&
          Date.now() - date <=
            24 * 60 * 60 * 1000
        );
      }
    ).length;

    return {
      total,
      published,
      critical,
      recent
    };
  }

  function render() {
    const root = getRoot();

    if (!root) {
      return;
    }

    const stats = calculateStats();

    root.innerHTML = `
      <div class="ez-breaking-admin">

        ${renderStyles()}

        <div class="ez-breaking-header">

          <div>
            <div class="ez-breaking-kicker">
              EZ MEDIA 11.0
            </div>

            <h2>
              مركز الأخبار العاجلة
            </h2>

            <p>
              إدارة الأخبار العاجلة والنشر الفوري
              ومتابعة الأولويات والحالات.
            </p>
          </div>

          <div class="ez-breaking-header-actions">

            <button
              type="button"
              class="ez-breaking-btn ez-breaking-btn-secondary"
              data-action="refresh"
            >
              تحديث
            </button>

            <button
              type="button"
              class="ez-breaking-btn ez-breaking-btn-primary"
              data-action="new"
            >
              + عاجل جديد
            </button>

          </div>

        </div>

        <div class="ez-breaking-stats">

          ${statCard(
            "إجمالي العاجل",
            stats.total,
            "كل الأخبار"
          )}

          ${statCard(
            "منشور الآن",
            stats.published,
            "نشط على المنصة"
          )}

          ${statCard(
            "عاجل حرج",
            stats.critical,
            "أولوية قصوى"
          )}

          ${statCard(
            "آخر 24 ساعة",
            stats.recent,
            "محتوى حديث"
          )}

        </div>

        ${renderLiveTicker()}

        <div class="ez-breaking-toolbar">

          <div class="ez-breaking-search">

            <span>⌕</span>

            <input
              type="search"
              placeholder="ابحث في الأخبار العاجلة..."
              value="${escapeAttribute(
                state.search
              )}"
              data-field="search"
            />

          </div>

          <select
            data-field="status"
            class="ez-breaking-select"
          >
            <option value="all"
              ${state.status === "all" ? "selected" : ""}
            >
              كل الحالات
            </option>

            <option value="published"
              ${state.status === "published" ? "selected" : ""}
            >
              منشور
            </option>

            <option value="paused"
              ${state.status === "paused" ? "selected" : ""}
            >
              متوقف
            </option>

            <option value="draft"
              ${state.status === "draft" ? "selected" : ""}
            >
              مسودة
            </option>

            <option value="expired"
              ${state.status === "expired" ? "selected" : ""}
            >
              منتهي
            </option>
          </select>

          <select
            data-field="priority"
            class="ez-breaking-select"
          >
            <option value="all"
              ${state.priority === "all" ? "selected" : ""}
            >
              كل الأولويات
            </option>

            <option value="critical"
              ${state.priority === "critical" ? "selected" : ""}
            >
              حرج
            </option>

            <option value="high"
              ${state.priority === "high" ? "selected" : ""}
            >
              مرتفع
            </option>

            <option value="normal"
              ${state.priority === "normal" ? "selected" : ""}
            >
              عادي
            </option>

            <option value="low"
              ${state.priority === "low" ? "selected" : ""}
            >
              منخفض
            </option>
          </select>

        </div>

        <div class="ez-breaking-filters">

          ${filterButton(
            "all",
            "الكل"
          )}

          ${filterButton(
            "active",
            "المنشور الآن"
          )}

          ${filterButton(
            "critical",
            "العاجل الحرج"
          )}

          ${filterButton(
            "recent",
            "آخر 24 ساعة"
          )}

        </div>

        <div class="ez-breaking-list">

          ${renderList()}

        </div>

      </div>
    `;

    bindEvents(root);
  }

  function statCard(title, value, subtitle) {
    return `
      <div class="ez-breaking-stat">

        <div class="ez-breaking-stat-title">
          ${escapeHtml(title)}
        </div>

        <div class="ez-breaking-stat-value">
          ${escapeHtml(value)}
        </div>

        <div class="ez-breaking-stat-subtitle">
          ${escapeHtml(subtitle)}
        </div>

      </div>
    `;
  }

  function filterButton(
    key,
    label
  ) {
    return `
      <button
        type="button"
        class="ez-breaking-filter ${
          state.filter === key
            ? "active"
            : ""
        }"
        data-filter="${escapeAttribute(key)}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function renderLiveTicker() {
    const liveItems = state.items
      .filter(
        (item) =>
          normalizeStatus(item.status) ===
          "published"
      )
      .sort(
        (a, b) =>
          priorityScore(
            b.priority
          ) -
            priorityScore(
              a.priority
            )
      )
      .slice(0, 5);

    if (!liveItems.length) {
      return `
        <div class="ez-breaking-ticker empty">
          <div class="ticker-label">
            عاجل
          </div>

          <div class="ticker-content">
            لا توجد أخبار عاجلة منشورة حاليًا.
          </div>
        </div>
      `;
    }

    return `
      <div class="ez-breaking-ticker">

        <div class="ticker-label">
          <span class="ticker-dot"></span>
          عاجل الآن
        </div>

        <div class="ticker-content">

          ${liveItems
            .map(
              (item) => `
                <div class="ticker-item">
                  ${escapeHtml(
                    getTitle(item)
                  )}
                </div>
              `
            )
            .join("")}

        </div>

      </div>
    `;
  }

  function priorityScore(priority) {
    const scores = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1
    };

    return (
      scores[
        normalizePriority(priority)
      ] || 0
    );
  }

  function getTitle(item) {
    return (
      item.title ||
      item.headline ||
      item.message ||
      item.text ||
      "خبر عاجل"
    );
  }

  function getDescription(item) {
    return (
      item.description ||
      item.summary ||
      item.message ||
      item.text ||
      ""
    );
  }

  function renderList() {
    const items =
      getFilteredItems();

    if (!items.length) {
      return `
        <div class="ez-breaking-empty">

          <div class="ez-breaking-empty-icon">
            !
          </div>

          <h3>
            لا توجد أخبار مطابقة
          </h3>

          <p>
            جرّب تغيير البحث أو الفلاتر
            أو أنشئ خبرًا عاجلًا جديدًا.
          </p>

          <button
            type="button"
            class="ez-breaking-btn ez-breaking-btn-primary"
            data-action="new"
          >
            إنشاء عاجل
          </button>

        </div>
      `;
    }

    return items
      .map(
        (item) =>
          renderBreakingCard(item)
      )
      .join("");
  }

  function renderBreakingCard(item) {
    const status =
      normalizeStatus(
        item.status
      );

    const priority =
      normalizePriority(
        item.priority
      );

    const id =
      item.id ||
      item.uuid;

    const title =
      getTitle(item);

    const description =
      getDescription(item);

    const createdAt =
      item.created_at ||
      item.createdAt;

    const publishedAt =
      item.published_at ||
      item.publishedAt;

    const expiresAt =
      item.expires_at ||
      item.expiresAt;

    const contentId =
      item.content_id ||
      item.contentId;

    return `
      <article
        class="ez-breaking-card ${priorityClass(
          priority
        )}"
        data-id="${escapeAttribute(id)}"
      >

        <div class="ez-breaking-card-main">

          <div class="ez-breaking-card-top">

            <div class="ez-breaking-badges">

              <span
                class="ez-breaking-badge ${priorityClass(
                  priority
                )}"
              >
                ${escapeHtml(
                  priorityLabel(
                    priority
                  )
                )}
              </span>

              <span
                class="ez-breaking-badge ${statusClass(
                  status
                )}"
              >
                ${escapeHtml(
                  statusLabel(status)
                )}
              </span>

            </div>

            <div class="ez-breaking-card-time">

              ${
                publishedAt
                  ? escapeHtml(
                      formatRelativeTime(
                        publishedAt
                      )
                    )
                  : escapeHtml(
                      formatRelativeTime(
                        createdAt
                      )
                    )
              }

            </div>

          </div>

          <h3 class="ez-breaking-card-title">
            ${escapeHtml(title)}
          </h3>

          ${
            description
              ? `
                <p class="ez-breaking-card-description">
                  ${escapeHtml(
                    description
                  )}
                </p>
              `
              : ""
          }

          <div class="ez-breaking-card-meta">

            ${
              item.category
                ? `
                  <span>
                    التصنيف:
                    ${escapeHtml(
                      item.category
                    )}
                  </span>
                `
                : ""
            }

            ${
              item.location
                ? `
                  <span>
                    الموقع:
                    ${escapeHtml(
                      item.location
                    )}
                  </span>
                `
                : ""
            }

            ${
              contentId
                ? `
                  <span>
                    مرتبط بالمحتوى
                  </span>
                `
                : ""
            }

            ${
              expiresAt
                ? `
                  <span>
                    ينتهي:
                    ${escapeHtml(
                      formatDate(
                        expiresAt
                      )
                    )}
                  </span>
                `
                : ""
            }

          </div>

        </div>

        <div class="ez-breaking-card-actions">

          ${
            status !== "published"
              ? `
                <button
                  type="button"
                  class="ez-breaking-action publish"
                  data-action="publish"
                  data-id="${escapeAttribute(
                    id
                  )}"
                >
                  نشر
                </button>
              `
              : `
                <button
                  type="button"
                  class="ez-breaking-action pause"
                  data-action="pause"
                  data-id="${escapeAttribute(
                    id
                  )}"
                >
                  إيقاف
                </button>
              `
          }

          <button
            type="button"
            class="ez-breaking-action"
            data-action="edit"
            data-id="${escapeAttribute(
              id
            )}"
          >
            تعديل
          </button>

          <button
            type="button"
            class="ez-breaking-action danger"
            data-action="delete"
            data-id="${escapeAttribute(
              id
            )}"
          >
            حذف
          </button>

        </div>

      </article>
    `;
  }

  function bindEvents(root) {
    const refreshButton =
      root.querySelector(
        '[data-action="refresh"]'
      );

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        () => {
          loadBreaking({
            force: true
          });
        }
      );
    }

    root
      .querySelectorAll(
        '[data-action="new"]'
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            openEditor();
          }
        );
      });

    const search =
      root.querySelector(
        '[data-field="search"]'
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

    const status =
      root.querySelector(
        '[data-field="status"]'
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
      root.querySelector(
        '[data-field="priority"]'
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

    root
      .querySelectorAll(
        "[data-filter]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            state.filter =
              button.dataset.filter;

            render();
          }
        );
      });

    root
      .querySelectorAll(
        "[data-action]"
      )
      .forEach((button) => {
        const action =
          button.dataset.action;

        if (
          [
            "publish",
            "pause",
            "edit",
            "delete"
          ].includes(action)
        ) {
          button.addEventListener(
            "click",
            () => {
              const id =
                button.dataset.id;

              if (
                action ===
                "publish"
              ) {
                publishBreaking(id);
              }

              if (
                action === "pause"
              ) {
                pauseBreaking(id);
              }

              if (
                action === "edit"
              ) {
                openEditor(id);
              }

              if (
                action === "delete"
              ) {
                deleteBreaking(id);
              }
            }
          );
        }
      });
  }

  function openEditor(id = null) {
    state.editingId = id;

    const item = id
      ? state.items.find(
          (entry) =>
            String(
              entry.id ||
                entry.uuid
            ) === String(id)
        )
      : null;

    showEditorModal(item);
  }

  function showEditorModal(item) {
    const isEdit =
      Boolean(item);

    const id =
      item?.id ||
      item?.uuid ||
      "";

    const title =
      getTitle(item || {});

    const description =
      getDescription(item || {});

    const priority =
      normalizePriority(
        item?.priority
      );

    const status =
      normalizeStatus(
        item?.status
      );

    const category =
      item?.category ||
      "";

    const location =
      item?.location ||
      "";

    const source =
      item?.source ||
      item?.source_name ||
      "";

    const contentId =
      item?.content_id ||
      item?.contentId ||
      "";

    const expiresAt =
      item?.expires_at ||
      item?.expiresAt ||
      "";

    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "ez-breaking-modal";

    modal.className =
      "ez-breaking-modal";

    modal.innerHTML = `
      <div class="ez-breaking-modal-backdrop"></div>

      <div
        class="ez-breaking-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="إدارة الخبر العاجل"
      >

        <div class="ez-breaking-modal-header">

          <div>
            <div class="ez-breaking-kicker">
              EZ MEDIA NEWSROOM
            </div>

            <h2>
              ${
                isEdit
                  ? "تعديل الخبر العاجل"
                  : "إنشاء خبر عاجل"
              }
            </h2>

          </div>

          <button
            type="button"
            class="ez-breaking-modal-close"
            data-modal-action="close"
            aria-label="إغلاق"
          >
            ×
          </button>

        </div>

        <form
          id="ez-breaking-form"
          class="ez-breaking-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeAttribute(id)}"
          />

          <div class="ez-breaking-form-grid">

            <div class="ez-breaking-field full">

              <label>
                عنوان العاجل
              </label>

              <input
                name="title"
                required
                maxlength="500"
                value="${escapeAttribute(
                  title
                )}"
                placeholder="اكتب عنوان الخبر العاجل..."
              />

            </div>

            <div class="ez-breaking-field full">

              <label>
                التفاصيل
              </label>

              <textarea
                name="description"
                rows="5"
                maxlength="5000"
                placeholder="أضف تفاصيل الخبر..."
              >${escapeHtml(
                description
              )}</textarea>

            </div>

            <div class="ez-breaking-field">

              <label>
                الأولوية
              </label>

              <select name="priority">

                <option value="critical"
                  ${
                    priority ===
                    "critical"
                      ? "selected"
                      : ""
                  }
                >
                  حرج
                </option>

                <option value="high"
                  ${
                    priority ===
                    "high"
                      ? "selected"
                      : ""
                  }
                >
                  مرتفع
                </option>

                <option value="normal"
                  ${
                    priority ===
                    "normal"
                      ? "selected"
                      : ""
                  }
                >
                  عادي
                </option>

                <option value="low"
                  ${
                    priority ===
                    "low"
                      ? "selected"
                      : ""
                  }
                >
                  منخفض
                </option>

              </select>

            </div>

            <div class="ez-breaking-field">

              <label>
                الحالة
              </label>

              <select name="status">

                <option value="draft"
                  ${
                    status ===
                    "draft"
                      ? "selected"
                      : ""
                  }
                >
                  مسودة
                </option>

                <option value="published"
                  ${
                    status ===
                    "published"
                      ? "selected"
                      : ""
                  }
                >
                  منشور
                </option>

                <option value="paused"
                  ${
                    status ===
                    "paused"
                      ? "selected"
                      : ""
                  }
                >
                  متوقف
                </option>

              </select>

            </div>

            <div class="ez-breaking-field">

              <label>
                التصنيف
              </label>

              <input
                name="category"
                maxlength="100"
                value="${escapeAttribute(
                  category
                )}"
                placeholder="سياسة، اقتصاد، رياضة..."
              />

            </div>

            <div class="ez-breaking-field">

              <label>
                الموقع
              </label>

              <input
                name="location"
                maxlength="200"
                value="${escapeAttribute(
                  location
                )}"
                placeholder="المدينة / الدولة"
              />

            </div>

            <div class="ez-breaking-field">

              <label>
                المصدر
              </label>

              <input
                name="source"
                maxlength="300"
                value="${escapeAttribute(
                  source
                )}"
                placeholder="مصدر الخبر"
              />

            </div>

            <div class="ez-breaking-field">

              <label>
                معرف المحتوى المرتبط
              </label>

              <input
                name="content_id"
                maxlength="100"
                value="${escapeAttribute(
                  contentId
                )}"
                placeholder="اختياري"
              />

            </div>

            <div class="ez-breaking-field">

              <label>
                انتهاء العاجل
              </label>

              <input
                type="datetime-local"
                name="expires_at"
                value="${escapeAttribute(
                  toDatetimeLocal(
                    expiresAt
                  )
                )}"
              />

            </div>

            <div class="ez-breaking-field full">

              <label>
                تعليمات العرض
              </label>

              <div class="ez-breaking-help">

                سيتم استخدام الأولوية والحالة
                لتحديد طريقة ظهور الخبر في شريط
                الأخبار العاجلة والواجهة الرئيسية.

              </div>

            </div>

          </div>

          <div class="ez-breaking-form-footer">

            <button
              type="button"
              class="ez-breaking-btn ez-breaking-btn-secondary"
              data-modal-action="close"
            >
              إلغاء
            </button>

            <button
              type="submit"
              class="ez-breaking-btn ez-breaking-btn-primary"
            >
              ${
                isEdit
                  ? "حفظ التعديلات"
                  : "إنشاء العاجل"
              }
            </button>

          </div>

        </form>

      </div>
    `;

    document.body.appendChild(
      modal
    );

    modal
      .querySelectorAll(
        '[data-modal-action="close"]'
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            modal.remove();
          }
        );
      });

    modal
      .querySelector(
        ".ez-breaking-modal-backdrop"
      )
      .addEventListener(
        "click",
        () => {
          modal.remove();
        }
      );

    const form =
      modal.querySelector(
        "#ez-breaking-form"
      );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await saveBreaking(
          form,
          modal
        );
      }
    );

    const titleInput =
      form.querySelector(
        '[name="title"]'
      );

    if (titleInput) {
      setTimeout(
        () => titleInput.focus(),
        50
      );
    }
  }

  function toDatetimeLocal(
    value
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const offset =
      date.getTimezoneOffset();

    const local =
      new Date(
        date.getTime() -
          offset * 60000
      );

    return local
      .toISOString()
      .slice(0, 16);
  }

  async function saveBreaking(
    form,
    modal
  ) {
    const formData =
      new FormData(form);

    const id =
      formData.get("id");

    const payload = {
      title:
        String(
          formData.get("title") ||
            ""
        ).trim(),

      description:
        String(
          formData.get(
            "description"
          ) || ""
        ).trim(),

      priority:
        formData.get(
          "priority"
        ),

      status:
        formData.get(
          "status"
        ),

      category:
        String(
          formData.get(
            "category"
          ) || ""
        ).trim(),

      location:
        String(
          formData.get(
            "location"
          ) || ""
        ).trim(),

      source:
        String(
          formData.get(
            "source"
          ) || ""
        ).trim(),

      content_id:
        String(
          formData.get(
            "content_id"
          ) || ""
        ).trim() || null,

      expires_at:
        formData.get(
          "expires_at"
        ) || null
    };

    if (!payload.title) {
      showToast(
        "عنوان العاجل مطلوب.",
        "warning"
      );

      return;
    }

    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );

    if (submitButton) {
      submitButton.disabled =
        true;

      submitButton.textContent =
        "جاري الحفظ...";
    }

    try {
      let data;

      if (id) {
        data =
          await apiRequest(
            `${CONFIG.API}/${encodeURIComponent(
              id
            )}`,
            {
              method: "PATCH",
              body: JSON.stringify(
                payload
              )
            }
          );
      } else {
        data =
          await apiRequest(
            CONFIG.API,
            {
              method: "POST",
              body: JSON.stringify(
                payload
              )
            }
          );
      }

      const saved =
        extractSingle(data);

      if (saved) {
        upsertLocalItem(
          saved
        );
      }

      modal.remove();

      showToast(
        id
          ? "تم حفظ تعديل الخبر العاجل."
          : "تم إنشاء الخبر العاجل.",
        "success"
      );

      await loadBreaking({
        force: true
      });
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر حفظ العاجل: ${error.message}`,
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          id
            ? "حفظ التعديلات"
            : "إنشاء العاجل";
      }
    }
  }

  function upsertLocalItem(
    item
  ) {
    if (!item) {
      return;
    }

    const id =
      item.id ||
      item.uuid;

    if (!id) {
      return;
    }

    const index =
      state.items.findIndex(
        (entry) =>
          String(
            entry.id ||
              entry.uuid
          ) === String(id)
      );

    if (index === -1) {
      state.items.unshift(
        item
      );
    } else {
      state.items[index] =
        {
          ...state.items[index],
          ...item
        };
    }
  }

  async function publishBreaking(
    id
  ) {
    if (!id) {
      return;
    }

    try {
      await apiRequest(
        `${CONFIG.API}/${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "published"
          })
        }
      );

      showToast(
        "تم نشر الخبر العاجل.",
        "success"
      );

      await loadBreaking({
        force: true
      });
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر نشر العاجل: ${error.message}`,
        "error"
      );
    }
  }

  async function pauseBreaking(
    id
  ) {
    if (!id) {
      return;
    }

    try {
      await apiRequest(
        `${CONFIG.API}/${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "paused"
          })
        }
      );

      showToast(
        "تم إيقاف الخبر العاجل.",
        "success"
      );

      await loadBreaking({
        force: true
      });
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر إيقاف العاجل: ${error.message}`,
        "error"
      );
    }
  }

  async function deleteBreaking(
    id
  ) {
    if (!id) {
      return;
    }

    const confirmed =
      window.confirm(
        "هل أنت متأكد من حذف هذا الخبر العاجل؟ لا يمكن التراجع عن هذا الإجراء."
      );

    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(
        `${CONFIG.API}/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE"
        }
      );

      state.items =
        state.items.filter(
          (item) =>
            String(
              item.id ||
                item.uuid
            ) !== String(id)
        );

      showToast(
        "تم حذف الخبر العاجل.",
        "success"
      );

      render();
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر حذف العاجل: ${error.message}`,
        "error"
      );
    }
  }

  function renderStyles() {
    return `
      <style>

        .ez-breaking-admin {
          direction: rtl;
          color: #0f172a;
          font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .ez-breaking-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .ez-breaking-kicker {
          color: #0284c7;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .08em;
          margin-bottom: 6px;
        }

        .ez-breaking-header h2 {
          margin: 0;
          font-size: clamp(24px, 3vw, 34px);
          font-weight: 900;
        }

        .ez-breaking-header p {
          margin: 8px 0 0;
          color: #64748b;
          line-height: 1.8;
        }

        .ez-breaking-header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ez-breaking-btn {
          border: 0;
          border-radius: 13px;
          padding: 11px 17px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform .2s ease,
            opacity .2s ease,
            box-shadow .2s ease;
        }

        .ez-breaking-btn:hover {
          transform: translateY(-1px);
        }

        .ez-breaking-btn:disabled {
          opacity: .6;
          cursor: wait;
        }

        .ez-breaking-btn-primary {
          color: #fff;
          background:
            linear-gradient(
              135deg,
              #0ea5e9,
              #38bdf8
            );
          box-shadow:
            0 10px 25px
            rgba(14,165,233,.18);
        }

        .ez-breaking-btn-secondary {
          color: #0369a1;
          background: #e0f2fe;
        }

        .ez-breaking-stats {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .ez-breaking-stat {
          background:
            linear-gradient(
              145deg,
              #ffffff,
              #f0f9ff
            );
          border:
            1px solid
            #dbeafe;
          border-radius: 18px;
          padding: 18px;
          box-shadow:
            0 8px 30px
            rgba(14,165,233,.06);
        }

        .ez-breaking-stat-title {
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .ez-breaking-stat-value {
          color: #0369a1;
          font-size: 30px;
          font-weight: 900;
          margin-top: 4px;
        }

        .ez-breaking-stat-subtitle {
          color: #94a3b8;
          font-size: 12px;
          margin-top: 3px;
        }

        .ez-breaking-ticker {
          display: flex;
          align-items: center;
          min-height: 52px;
          overflow: hidden;
          border-radius: 16px;
          background:
            linear-gradient(
              90deg,
              #e0f2fe,
              #f0f9ff
            );
          border:
            1px solid
            #bae6fd;
          margin-bottom: 18px;
        }

        .ez-breaking-ticker.empty {
          color: #64748b;
        }

        .ticker-label {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 16px;
          min-height: 52px;
          color: #0369a1;
          font-weight: 900;
          border-left:
            1px solid
            #bae6fd;
        }

        .ticker-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow:
            0 0 0 5px
            rgba(239,68,68,.12);
        }

        .ticker-content {
          display: flex;
          gap: 30px;
          overflow: auto;
          white-space: nowrap;
          padding: 0 18px;
          scrollbar-width: none;
        }

        .ticker-content::-webkit-scrollbar {
          display: none;
        }

        .ticker-item {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .ez-breaking-toolbar {
          display: grid;
          grid-template-columns:
            minmax(240px, 1fr)
            180px
            180px;
          gap: 10px;
          margin-bottom: 12px;
        }

        .ez-breaking-search {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 46px;
          padding: 0 13px;
          border:
            1px solid
            #dbeafe;
          border-radius: 13px;
          background: #fff;
        }

        .ez-breaking-search span {
          color: #0ea5e9;
          font-size: 22px;
        }

        .ez-breaking-search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #0f172a;
          font-size: 14px;
        }

        .ez-breaking-select {
          width: 100%;
          min-height: 46px;
          padding: 0 12px;
          border:
            1px solid
            #dbeafe;
          border-radius: 13px;
          background: #fff;
          color: #0f172a;
          outline: 0;
          font-weight: 700;
        }

        .ez-breaking-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .ez-breaking-filter {
          border:
            1px solid
            #dbeafe;
          background: #fff;
          color: #64748b;
          border-radius: 999px;
          padding: 8px 14px;
          cursor: pointer;
          font-weight: 800;
          font-size: 12px;
        }

        .ez-breaking-filter.active {
          color: #0369a1;
          background: #e0f2fe;
          border-color: #7dd3fc;
        }

        .ez-breaking-list {
          display: grid;
          gap: 12px;
        }

        .ez-breaking-card {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 18px;
          background: #fff;
          border:
            1px solid
            #dbeafe;
          border-radius: 18px;
          box-shadow:
            0 8px 25px
            rgba(15,23,42,.04);
          transition:
            transform .2s ease,
            box-shadow .2s ease;
        }

        .ez-breaking-card:hover {
          transform: translateY(-1px);
          box-shadow:
            0 12px 35px
            rgba(14,165,233,.09);
        }

        .ez-breaking-card-main {
          min-width: 0;
          flex: 1;
        }

        .ez-breaking-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 9px;
        }

        .ez-breaking-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .ez-breaking-badge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
        }

        .ez-breaking-priority-critical {
          border-right:
            3px solid
            #ef4444;
        }

        .ez-breaking-priority-high {
          border-right:
            3px solid
            #f97316;
        }

        .ez-breaking-priority-normal {
          border-right:
            3px solid
            #0ea5e9;
        }

        .ez-breaking-priority-low {
          border-right:
            3px solid
            #94a3b8;
        }

        .ez-breaking-badge.ez-breaking-priority-critical {
          color: #b91c1c;
          background: #fee2e2;
          border: 0;
        }

        .ez-breaking-badge.ez-breaking-priority-high {
          color: #c2410c;
          background: #ffedd5;
          border: 0;
        }

        .ez-breaking-badge.ez-breaking-priority-normal {
          color: #0369a1;
          background: #e0f2fe;
          border: 0;
        }

        .ez-breaking-badge.ez-breaking-priority-low {
          color: #475569;
          background: #f1f5f9;
          border: 0;
        }

        .ez-breaking-badge.ez-breaking-status-published {
          color: #047857;
          background: #d1fae5;
        }

        .ez-breaking-badge.ez-breaking-status-paused {
          color: #92400e;
          background: #fef3c7;
        }

        .ez-breaking-badge.ez-breaking-status-draft {
          color: #475569;
          background: #f1f5f9;
        }

        .ez-breaking-badge.ez-breaking-status-expired {
          color: #64748b;
          background: #e2e8f0;
        }

        .ez-breaking-card-time {
          color: #94a3b8;
          font-size: 12px;
          white-space: nowrap;
        }

        .ez-breaking-card-title {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
          line-height: 1.65;
          font-weight: 900;
        }

        .ez-breaking-card-description {
          margin: 7px 0 0;
          color: #64748b;
          line-height: 1.8;
          font-size: 13px;
        }

        .ez-breaking-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          margin-top: 12px;
          color: #94a3b8;
          font-size: 11px;
        }

        .ez-breaking-card-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
          align-content: flex-start;
        }

        .ez-breaking-action {
          border:
            1px solid
            #dbeafe;
          background: #f8fafc;
          color: #0369a1;
          border-radius: 10px;
          padding: 8px 11px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
        }

        .ez-breaking-action.publish {
          background: #dcfce7;
          color: #166534;
          border-color: #bbf7d0;
        }

        .ez-breaking-action.pause {
          background: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
        }

        .ez-breaking-action.danger {
          background: #fee2e2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        .ez-breaking-empty {
          text-align: center;
          padding: 60px 20px;
          background: #fff;
          border:
            1px dashed
            #bae6fd;
          border-radius: 20px;
        }

        .ez-breaking-empty-icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 12px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: #e0f2fe;
          color: #0284c7;
          font-size: 22px;
          font-weight: 900;
        }

        .ez-breaking-empty h3 {
          margin: 0;
          font-size: 19px;
        }

        .ez-breaking-empty p {
          color: #64748b;
          margin: 7px 0 17px;
        }

        .ez-breaking-modal {
          position: fixed;
          inset: 0;
          z-index: 99990;
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .ez-breaking-modal-backdrop {
          position: absolute;
          inset: 0;
          background:
            rgba(224,242,254,.78);
          backdrop-filter: blur(7px);
        }

        .ez-breaking-modal-dialog {
          position: relative;
          width: min(850px, 100%);
          max-height: calc(100vh - 40px);
          overflow: auto;
          background: #fff;
          border:
            1px solid
            #bae6fd;
          border-radius: 24px;
          box-shadow:
            0 30px 90px
            rgba(15,23,42,.18);
        }

        .ez-breaking-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          padding: 22px;
          border-bottom:
            1px solid
            #e0f2fe;
        }

        .ez-breaking-modal-header h2 {
          margin: 0;
          font-size: 23px;
        }

        .ez-breaking-modal-close {
          width: 38px;
          height: 38px;
          border: 0;
          border-radius: 12px;
          background: #e0f2fe;
          color: #0369a1;
          font-size: 24px;
          cursor: pointer;
        }

        .ez-breaking-form {
          padding: 22px;
        }

        .ez-breaking-form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .ez-breaking-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .ez-breaking-field.full {
          grid-column: 1 / -1;
        }

        .ez-breaking-field label {
          color: #334155;
          font-size: 13px;
          font-weight: 900;
        }

        .ez-breaking-field input,
        .ez-breaking-field textarea,
        .ez-breaking-field select {
          width: 100%;
          box-sizing: border-box;
          border:
            1px solid
            #cbd5e1;
          border-radius: 12px;
          background: #fff;
          color: #0f172a;
          padding: 11px 12px;
          outline: 0;
          font: inherit;
        }

        .ez-breaking-field textarea {
          resize: vertical;
          line-height: 1.8;
        }

        .ez-breaking-field input:focus,
        .ez-breaking-field textarea:focus,
        .ez-breaking-field select:focus {
          border-color: #38bdf8;
          box-shadow:
            0 0 0 3px
            rgba(56,189,248,.12);
        }

        .ez-breaking-help {
          padding: 12px 14px;
          border-radius: 12px;
          background: #f0f9ff;
          color: #64748b;
          line-height: 1.8;
          font-size: 12px;
        }

        .ez-breaking-form-footer {
          display: flex;
          justify-content: flex-start;
          gap: 9px;
          margin-top: 22px;
          padding-top: 18px;
          border-top:
            1px solid
            #e0f2fe;
        }

        @media (max-width: 900px) {

          .ez-breaking-stats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .ez-breaking-toolbar {
            grid-template-columns:
              1fr 1fr;
          }

          .ez-breaking-search {
            grid-column: 1 / -1;
          }

          .ez-breaking-card {
            flex-direction: column;
          }

          .ez-breaking-card-actions {
            width: 100%;
          }

        }

        @media (max-width: 620px) {

          .ez-breaking-header {
            flex-direction: column;
          }

          .ez-breaking-header-actions {
            width: 100%;
          }

          .ez-breaking-header-actions .ez-breaking-btn {
            flex: 1;
          }

          .ez-breaking-stats {
            grid-template-columns: 1fr 1fr;
          }

          .ez-breaking-toolbar {
            grid-template-columns: 1fr;
          }

          .ez-breaking-search {
            grid-column: auto;
          }

          .ez-breaking-form-grid {
            grid-template-columns: 1fr;
          }

          .ez-breaking-field.full {
            grid-column: auto;
          }

          .ez-breaking-ticker {
            align-items: stretch;
            flex-direction: column;
          }

          .ticker-label {
            border-left: 0;
            border-bottom:
              1px solid
              #bae6fd;
          }

        }

      </style>
    `;
  }

  function startAutoRefresh() {
    if (state.refreshTimer) {
      clearInterval(
        state.refreshTimer
      );
    }

    state.refreshTimer =
      setInterval(
        () => {
          if (
            document.hidden
          ) {
            return;
          }

          loadBreaking({
            force: true
          });
        },
        CONFIG.REFRESH_INTERVAL
      );
  }

  async function init() {
    const root = getRoot();

    if (!root) {
      return;
    }

    render();

    await Promise.all([
      loadBreaking({
        force: true
      }),
      loadContent()
    ]);

    startAutoRefresh();
  }

  /*
   * ============================================================
   * API عامة
   * ============================================================
   */

  window.EZMediaAdminBreaking = {
    refresh: function () {
      return loadBreaking({
        force: true
      });
    },

    create: function () {
      openEditor();
    },

    edit: function (id) {
      openEditor(id);
    },

    publish: function (id) {
      return publishBreaking(id);
    },

    pause: function (id) {
      return pauseBreaking(id);
    },

    delete: function (id) {
      return deleteBreaking(id);
    },

    stop: function () {
      if (state.refreshTimer) {
        clearInterval(
          state.refreshTimer
        );

        state.refreshTimer =
          null;
      }
    },

    getState: function () {
      return {
        ...state,
        items: [
          ...state.items
        ]
      };
    }
  };

  /*
   * تشغيل المنصة بعد جاهزية DOM
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();
