"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    content: "/api/content"
  };

  const PLATFORMS = {
    website: {
      name: "موقع EZ MEDIA",
      icon: "🌐",
      enabled: true
    },
    x: {
      name: "X",
      icon: "𝕏",
      enabled: true
    },
    instagram: {
      name: "Instagram",
      icon: "◎",
      enabled: true
    },
    tiktok: {
      name: "TikTok",
      icon: "♪",
      enabled: true
    },
    youtube: {
      name: "YouTube",
      icon: "▶",
      enabled: true
    },
    snapchat: {
      name: "Snapchat",
      icon: "◈",
      enabled: true
    },
    telegram: {
      name: "Telegram",
      icon: "✈",
      enabled: true
    }
  };

  const STATUS_LABELS = {
    pending: "قيد الانتظار",
    preparing: "جاري التجهيز",
    scheduled: "مجدول",
    publishing: "جاري النشر",
    published: "تم النشر",
    failed: "فشل",
    cancelled: "ملغى"
  };

  const STATE = {
    contents: [],
    distributions: [],
    loading: false,
    search: "",
    status: "all",
    platform: "all",
    selectedContent: null,
    editingDistribution: null,
    currentView: "queue",
    lastUpdate: null
  };

  function escapeHtml(value) {
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

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "ar-SA",
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      ).format(
        new Date(value)
      );
    } catch {
      return String(value);
    }
  }

  function getToken() {
    return (
      window
        .EZMediaAdminCore
        ?.getToken?.() ||
      null
    );
  }

  async function request(
    url,
    options = {}
  ) {
    const token =
      getToken();

    const headers = {
      "Content-Type":
        "application/json"
    };

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    const response =
      await fetch(
        url,
        {
          credentials:
            "same-origin",
          ...options,
          headers: {
            ...headers,
            ...(options.headers || {})
          }
        }
      );

    let data = null;

    try {
      data =
        await response.json();
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

  function getArray(data) {
    if (
      Array.isArray(data)
    ) {
      return data;
    }

    for (
      const key of [
        "items",
        "data",
        "results",
        "content"
      ]
    ) {
      if (
        Array.isArray(
          data?.[key]
        )
      ) {
        return data[key];
      }
    }

    return [];
  }

  function normalizeContent(item) {
    return {
      ...item,

      id:
        item?.id ||
        item?._id ||
        null,

      title:
        item?.title ||
        item?.headline ||
        "بدون عنوان",

      summary:
        item?.summary ||
        item?.description ||
        "",

      contentType:
        item?.content_type ||
        item?.contentType ||
        item?.type ||
        "news",

      status:
        item?.status ||
        "draft",

      category:
        item?.category ||
        "",

      createdAt:
        item?.created_at ||
        item?.createdAt ||
        null,

      updatedAt:
        item?.updated_at ||
        item?.updatedAt ||
        null
    };
  }

  async function loadContent() {
    STATE.loading = true;
    render();

    try {
      const data =
        await request(
          `${API.content}?limit=500`
        );

      STATE.contents =
        getArray(data)
          .map(
            normalizeContent
          );

      buildLocalDistributionQueue();

      STATE.lastUpdate =
        new Date();

    } catch (error) {
      console.error(
        "EZ MEDIA Distribution:",
        error
      );

      showToast(
        error.message ||
        "تعذر تحميل المحتوى."
      );

    } finally {
      STATE.loading = false;
      render();
    }
  }

  function buildLocalDistributionQueue() {
    const saved =
      readStoredQueue();

    if (
      saved.length
    ) {
      STATE.distributions =
        saved;
      return;
    }

    STATE.distributions =
      [];
  }

  function readStoredQueue() {
    try {
      const raw =
        localStorage.getItem(
          "ez_media_distribution_queue"
        );

      if (!raw) {
        return [];
      }

      const parsed =
        JSON.parse(raw);

      return Array.isArray(
        parsed
      )
        ? parsed
        : [];
    } catch {
      return [];
    }
  }

  function saveStoredQueue() {
    try {
      localStorage.setItem(
        "ez_media_distribution_queue",
        JSON.stringify(
          STATE.distributions
        )
      );
    } catch {
      // لا نوقف المنصة بسبب localStorage.
    }
  }

  function getDistributionStats() {
    const list =
      STATE.distributions;

    return {
      total:
        list.length,

      published:
        list.filter(
          item =>
            item.status ===
            "published"
        ).length,

      scheduled:
        list.filter(
          item =>
            item.status ===
            "scheduled"
        ).length,

      pending:
        list.filter(
          item =>
            item.status ===
            "pending"
        ).length,

      failed:
        list.filter(
          item =>
            item.status ===
            "failed"
        ).length
    };
  }

  function filteredDistributions() {
    return STATE.distributions.filter(
      item => {

        if (
          STATE.status !==
          "all" &&
          item.status !==
            STATE.status
        ) {
          return false;
        }

        if (
          STATE.platform !==
          "all" &&
          item.platform !==
            STATE.platform
        ) {
          return false;
        }

        if (
          STATE.search
        ) {
          const text =
            [
              item.title,
              item.platform,
              item.status
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          if (
            !text.includes(
              STATE.search
                .toLowerCase()
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }

  function createDistribution(
    content,
    platform,
    options = {}
  ) {
    if (
      !content ||
      !content.id ||
      !PLATFORMS[
        platform
      ]
    ) {
      return null;
    }

    const id =
      `dist_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const distribution = {
      id,

      contentId:
        content.id,

      title:
        content.title,

      platform,

      status:
        options.status ||
        "pending",

      scheduledAt:
        options.scheduledAt ||
        null,

      publishedAt:
        null,

      retryCount:
        0,

      message:
        options.message ||
        "",

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),

      metadata: {
        version:
          VERSION
      }
    };

    STATE.distributions.unshift(
      distribution
    );

    saveStoredQueue();

    return distribution;
  }

  function render() {
    injectStyles();

    const mount =
      getMount();

    if (!mount) {
      return;
    }

    const stats =
      getDistributionStats();

    const rows =
      filteredDistributions();

    mount.innerHTML = `
      <div class="ez-distribution">

        <div class="ez-distribution-header">

          <div>
            <h2>
              مركز التوزيع والنشر
            </h2>

            <p>
              إدارة توزيع محتوى EZ MEDIA عبر الموقع والمنصات الرقمية
            </p>
          </div>

          <div class="ez-distribution-header-actions">

            <button
              class="ez-dist-btn primary"
              data-dist-action="new"
            >
              توزيع محتوى
            </button>

            <button
              class="ez-dist-btn"
              data-dist-action="refresh"
            >
              تحديث
            </button>

          </div>

        </div>

        <div class="ez-dist-stats">

          ${renderStat(
            "إجمالي العمليات",
            stats.total,
            "◉"
          )}

          ${renderStat(
            "تم النشر",
            stats.published,
            "✓"
          )}

          ${renderStat(
            "مجدول",
            stats.scheduled,
            "◷"
          )}

          ${renderStat(
            "فشل",
            stats.failed,
            "!"
          )}

        </div>

        <div class="ez-dist-tabs">

          <button
            class="${
              STATE.currentView ===
              "queue"
                ? "active"
                : ""
            }"
            data-dist-view="queue"
          >
            طابور التوزيع
          </button>

          <button
            class="${
              STATE.currentView ===
              "content"
                ? "active"
                : ""
            }"
            data-dist-view="content"
          >
            المحتوى
          </button>

          <button
            class="${
              STATE.currentView ===
              "platforms"
                ? "active"
                : ""
            }"
            data-dist-view="platforms"
          >
            المنصات
          </button>

        </div>

        ${
          STATE.currentView ===
          "queue"
            ? renderQueue(
                rows
              )
            : ""
        }

        ${
          STATE.currentView ===
          "content"
            ? renderContent()
            : ""
        }

        ${
          STATE.currentView ===
          "platforms"
            ? renderPlatforms()
            : ""
        }

        ${
          STATE.lastUpdate
            ? `
              <div class="ez-dist-last">
                آخر تحديث:
                ${formatDate(
                  STATE.lastUpdate
                )}
              </div>
            `
            : ""
        }

        <div
          id="ez-dist-modal"
          class="ez-dist-modal"
        ></div>

      </div>
    `;

    bindEvents();
  }

  function renderStat(
    label,
    value,
    icon
  ) {
    return `
      <div class="ez-dist-stat">

        <div class="ez-dist-stat-icon">
          ${icon}
        </div>

        <div>
          <span>
            ${label}
          </span>

          <strong>
            ${value}
          </strong>
        </div>

      </div>
    `;
  }

  function renderQueue(
    rows
  ) {
    return `
      <div class="ez-dist-toolbar">

        <input
          id="ez-dist-search"
          type="search"
          placeholder="ابحث في عمليات التوزيع..."
          value="${escapeHtml(
            STATE.search
          )}"
        />

        <select
          id="ez-dist-status"
        >

          <option
            value="all"
          >
            كل الحالات
          </option>

          ${Object.entries(
            STATUS_LABELS
          )
            .map(
              ([key, label]) =>
                `
                  <option
                    value="${key}"
                    ${
                      STATE.status ===
                      key
                        ? "selected"
                        : ""
                    }
                  >
                    ${label}
                  </option>
                `
            )
            .join("")}

        </select>

        <select
          id="ez-dist-platform"
        >

          <option
            value="all"
          >
            كل المنصات
          </option>

          ${Object.entries(
            PLATFORMS
          )
            .map(
              ([key, platform]) =>
                `
                  <option
                    value="${key}"
                    ${
                      STATE.platform ===
                      key
                        ? "selected"
                        : ""
                    }
                  >
                    ${platform.name}
                  </option>
                `
            )
            .join("")}

        </select>

      </div>

      <div class="ez-dist-list">

        ${
          STATE.loading
            ? `
              <div class="ez-dist-empty">
                جارٍ تحميل البيانات...
              </div>
            `
            : rows.length
            ? rows
                .map(
                  renderDistribution
                )
                .join("")
            : `
              <div class="ez-dist-empty">
                لا توجد عمليات توزيع حاليًا.
              </div>
            `
        }

      </div>
    `;
  }

  function renderDistribution(
    item
  ) {
    const platform =
      PLATFORMS[
        item.platform
      ] || {
        name:
          item.platform,
        icon: "•"
      };

    const status =
      STATUS_LABELS[
        item.status
      ] ||
      item.status;

    return `
      <article
        class="ez-dist-card"
      >

        <div class="ez-dist-platform">
          <div class="ez-dist-platform-icon">
            ${platform.icon}
          </div>

          <div>
            <strong>
              ${escapeHtml(
                platform.name
              )}
            </strong>

            <span>
              ${escapeHtml(
                status
              )}
            </span>
          </div>
        </div>

        <div class="ez-dist-content">

          <strong>
            ${escapeHtml(
              item.title
            )}
          </strong>

          <small>
            ${
              item.scheduledAt
                ? `مجدول:
                  ${formatDate(
                    item.scheduledAt
                  )}`
                : `أُنشئ:
                  ${formatDate(
                    item.createdAt
                  )}`
            }
          </small>

        </div>

        <div class="ez-dist-status status-${escapeHtml(
          item.status
        )}">
          ${escapeHtml(
            status
          )}
        </div>

        <div class="ez-dist-actions">

          ${
            item.status ===
            "failed"
              ? `
                <button
                  data-dist-retry="${escapeHtml(
                    item.id
                  )}"
                >
                  إعادة المحاولة
                </button>
              `
              : ""
          }

          ${
            item.status ===
              "pending" ||
            item.status ===
              "scheduled"
              ? `
                <button
                  data-dist-publish="${escapeHtml(
                    item.id
                  )}"
                >
                  نشر الآن
                </button>
              `
              : ""
          }

          <button
            data-dist-edit="${escapeHtml(
              item.id
            )}"
          >
            التفاصيل
          </button>

        </div>

      </article>
    `;
  }

  function renderContent() {
    const contents =
      STATE.contents;

    return `
      <div class="ez-dist-content-grid">

        ${
          contents.length
            ? contents
                .slice(
                  0,
                  100
                )
                .map(
                  renderContentCard
                )
                .join("")
            : `
              <div class="ez-dist-empty">
                لا يوجد محتوى.
              </div>
            `
        }

      </div>
    `;
  }

  function renderContentCard(
    item
  ) {
    const existing =
      STATE.distributions.filter(
        distribution =>
          String(
            distribution.contentId
          ) ===
          String(item.id)
      );

    return `
      <article
        class="ez-dist-content-card"
      >

        <div>
          <span>
            ${escapeHtml(
              item.status
            )}
          </span>

          <h3>
            ${escapeHtml(
              item.title
            )}
          </h3>

          <p>
            ${escapeHtml(
              item.summary
            ).slice(
              0,
              180
            )}
          </p>
        </div>

        <div class="ez-dist-content-footer">

          <small>
            ${existing.length}
            عملية توزيع
          </small>

          <button
            data-dist-content="${escapeHtml(
              item.id
            )}"
          >
            توزيع
          </button>

        </div>

      </article>
    `;
  }

  function renderPlatforms() {
    return `
      <div class="ez-dist-platform-grid">

        ${Object.entries(
          PLATFORMS
        )
          .map(
            ([key, platform]) => {

              const count =
                STATE.distributions.filter(
                  item =>
                    item.platform ===
                    key
                ).length;

              const published =
                STATE.distributions.filter(
                  item =>
                    item.platform ===
                      key &&
                    item.status ===
                      "published"
                ).length;

              return `
                <article
                  class="ez-dist-platform-card"
                >

                  <div class="ez-dist-big-icon">
                    ${platform.icon}
                  </div>

                  <h3>
                    ${escapeHtml(
                      platform.name
                    )}
                  </h3>

                  <span>
                    ${platform.enabled
                      ? "جاهزة للربط"
                      : "غير مفعلة"}
                  </span>

                  <div class="ez-dist-platform-numbers">

                    <div>
                      <strong>
                        ${count}
                      </strong>

                      <small>
                        عمليات
                      </small>
                    </div>

                    <div>
                      <strong>
                        ${published}
                      </strong>

                      <small>
                        منشور
                      </small>
                    </div>

                  </div>

                  <button
                    data-dist-platform="${key}"
                  >
                    إعداد التوزيع
                  </button>

                </article>
              `;
            }
          )
          .join("")}

      </div>
    `;
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-distribution-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-distribution-style";

    style.textContent = `
      #ez-admin-distribution {
        direction: rtl;
      }

      .ez-distribution {
        color: #0f172a;
      }

      .ez-distribution-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .ez-distribution-header h2 {
        margin: 0;
        color: #075985;
        font-size: 27px;
        font-weight: 950;
      }

      .ez-distribution-header p {
        margin: 7px 0 0;
        color: #64748b;
        font-size: 13px;
      }

      .ez-distribution-header-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ez-dist-btn {
        border: 1px solid #bae6fd;
        border-radius: 13px;
        background: #fff;
        color: #0369a1;
        padding: 10px 15px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 900;
      }

      .ez-dist-btn.primary {
        border-color: transparent;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-dist-stats {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(170px, 1fr)
          );
        gap: 10px;
        margin-bottom: 17px;
      }

      .ez-dist-stat {
        display: flex;
        align-items: center;
        gap: 11px;
        border: 1px solid #e0f2fe;
        border-radius: 17px;
        background: #fff;
        padding: 14px;
      }

      .ez-dist-stat-icon {
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #eff6ff;
        color: #0284c7;
        font-weight: 950;
      }

      .ez-dist-stat span {
        display: block;
        color: #64748b;
        font-size: 9px;
        font-weight: 800;
      }

      .ez-dist-stat strong {
        display: block;
        margin-top: 3px;
        color: #075985;
        font-size: 21px;
        font-weight: 950;
      }

      .ez-dist-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 13px;
        border-bottom: 1px solid #e0f2fe;
        padding-bottom: 8px;
      }

      .ez-dist-tabs button {
        border: 1px solid transparent;
        border-radius: 11px;
        background: transparent;
        color: #64748b;
        padding: 9px 13px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 900;
      }

      .ez-dist-tabs button.active {
        border-color: #bae6fd;
        background: #eff6ff;
        color: #0369a1;
      }

      .ez-dist-toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 13px;
      }

      .ez-dist-toolbar input,
      .ez-dist-toolbar select {
        border: 1px solid #bae6fd;
        border-radius: 12px;
        background: #fff;
        color: #0f172a;
        padding: 10px 12px;
        outline: none;
      }

      .ez-dist-toolbar input {
        flex: 1;
        min-width: 220px;
      }

      .ez-dist-list {
        display: grid;
        gap: 9px;
      }

      .ez-dist-card {
        display: grid;
        grid-template-columns:
          190px
          minmax(220px, 1fr)
          120px
          auto;
        align-items: center;
        gap: 13px;
        border: 1px solid #e0f2fe;
        border-radius: 17px;
        background: #fff;
        padding: 13px;
      }

      .ez-dist-platform {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .ez-dist-platform-icon {
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border-radius: 11px;
        background: #eff6ff;
        color: #0284c7;
        font-size: 17px;
        font-weight: 950;
      }

      .ez-dist-platform strong {
        display: block;
        color: #075985;
        font-size: 11px;
      }

      .ez-dist-platform span {
        display: block;
        margin-top: 3px;
        color: #64748b;
        font-size: 9px;
      }

      .ez-dist-content strong {
        display: block;
        color: #334155;
        font-size: 11px;
        line-height: 1.5;
      }

      .ez-dist-content small {
        display: block;
        margin-top: 4px;
        color: #94a3b8;
        font-size: 9px;
      }

      .ez-dist-status {
        border-radius: 999px;
        padding: 6px 9px;
        text-align: center;
        font-size: 9px;
        font-weight: 900;
        background: #eff6ff;
        color: #0369a1;
      }

      .status-published {
        background: #ecfdf5;
        color: #047857;
      }

      .status-failed {
        background: #fff1f2;
        color: #be123c;
      }

      .status-scheduled {
        background: #f0f9ff;
        color: #0369a1;
      }

      .ez-dist-actions {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
      }

      .ez-dist-actions button {
        border: 1px solid #dbeafe;
        border-radius: 9px;
        background: #fff;
        color: #0369a1;
        padding: 7px 9px;
        cursor: pointer;
        font-size: 9px;
        font-weight: 850;
      }

      .ez-dist-empty {
        display: grid;
        place-items: center;
        min-height: 180px;
        border: 1px dashed #bae6fd;
        border-radius: 17px;
        background: #fafdff;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-dist-content-grid,
      .ez-dist-platform-grid {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(220px, 1fr)
          );
        gap: 10px;
      }

      .ez-dist-content-card,
      .ez-dist-platform-card {
        border: 1px solid #e0f2fe;
        border-radius: 17px;
        background: #fff;
        padding: 14px;
      }

      .ez-dist-content-card > div > span {
        display: inline-block;
        border-radius: 999px;
        background: #eff6ff;
        color: #0369a1;
        padding: 4px 7px;
        font-size: 8px;
        font-weight: 850;
      }

      .ez-dist-content-card h3 {
        margin: 9px 0 5px;
        color: #075985;
        font-size: 13px;
        line-height: 1.5;
      }

      .ez-dist-content-card p {
        min-height: 35px;
        margin: 0;
        color: #64748b;
        font-size: 10px;
        line-height: 1.6;
      }

      .ez-dist-content-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 7px;
        margin-top: 13px;
      }

      .ez-dist-content-footer small {
        color: #94a3b8;
        font-size: 9px;
      }

      .ez-dist-content-footer button,
      .ez-dist-platform-card button {
        border: 1px solid #bae6fd;
        border-radius: 9px;
        background: #eff6ff;
        color: #0369a1;
        padding: 7px 10px;
        cursor: pointer;
        font-size: 9px;
        font-weight: 900;
      }

      .ez-dist-platform-card {
        text-align: center;
      }

      .ez-dist-big-icon {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        margin: 0 auto 9px;
        border-radius: 15px;
        background: #eff6ff;
        color: #0284c7;
        font-size: 24px;
        font-weight: 950;
      }

      .ez-dist-platform-card h3 {
        margin: 0;
        color: #075985;
        font-size: 14px;
      }

      .ez-dist-platform-card > span {
        display: block;
        margin-top: 4px;
        color: #64748b;
        font-size: 9px;
      }

      .ez-dist-platform-numbers {
        display: grid;
        grid-template-columns:
          1fr 1fr;
        gap: 7px;
        margin: 13px 0;
      }

      .ez-dist-platform-numbers div {
        border-radius: 10px;
        background: #f8fafc;
        padding: 8px;
      }

      .ez-dist-platform-numbers strong {
        display: block;
        color: #0369a1;
        font-size: 15px;
      }

      .ez-dist-platform-numbers small {
        display: block;
        margin-top: 3px;
        color: #94a3b8;
        font-size: 8px;
      }

      .ez-dist-last {
        margin-top: 12px;
        color: #94a3b8;
        font-size: 9px;
        text-align: center;
      }

      .ez-dist-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        place-items: center;
        padding: 15px;
        background:
          rgba(
            2,
            132,
            199,
            .15
          );
        backdrop-filter:
          blur(8px);
      }

      .ez-dist-modal.show {
        display: grid;
      }

      .ez-dist-modal-box {
        width: min(
          650px,
          100%
        );
        max-height: 90vh;
        overflow: auto;
        border: 1px solid #bae6fd;
        border-radius: 22px;
        background: #fff;
        padding: 17px;
        box-shadow:
          0 30px 80px
          rgba(7,89,133,.18);
      }

      .ez-dist-modal-box h3 {
        margin: 0 0 15px;
        color: #075985;
      }

      .ez-dist-modal-list {
        display: grid;
        gap: 8px;
      }

      .ez-dist-platform-option {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #e0f2fe;
        border-radius: 13px;
        padding: 10px;
        cursor: pointer;
      }

      .ez-dist-platform-option input {
        accent-color: #0284c7;
      }

      .ez-dist-platform-option strong {
        color: #075985;
        font-size: 11px;
      }

      .ez-dist-modal-actions {
        display: flex;
        gap: 7px;
        margin-top: 15px;
      }

      @media (max-width: 950px) {
        .ez-dist-card {
          grid-template-columns: 1fr;
        }

        .ez-dist-status {
          width: fit-content;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function getMount() {
    return (
      document.querySelector(
        "#distribution-section"
      ) ||
      document.querySelector(
        "#admin-distribution-section"
      ) ||
      document.querySelector(
        '[data-admin-section="distribution"]'
      )
    );
  }

  function createMount() {
    let mount =
      getMount();

    if (mount) {
      return mount;
    }

    mount =
      document.createElement(
        "section"
      );

    mount.id =
      "admin-distribution-section";

    (
      document.querySelector(
        "main"
      ) ||
      document.body
    ).appendChild(
      mount
    );

    return mount;
  }

  function openDistributionModal(
    content = null
  ) {
    const modal =
      document.querySelector(
        "#ez-dist-modal"
      );

    if (!modal) {
      return;
    }

    const selected =
      content ||
      STATE.selectedContent;

    modal.innerHTML = `
      <div class="ez-dist-modal-box">

        <h3>
          توزيع المحتوى
        </h3>

        <p
          style="
            color:#64748b;
            font-size:11px;
            line-height:1.7;
          "
        >
          ${
            selected
              ? escapeHtml(
                  selected.title
                )
              : "اختر المحتوى والمنصات المستهدفة"
          }
        </p>

        <div
          class="ez-dist-modal-list"
        >

          ${
            selected
              ? Object.entries(
                  PLATFORMS
                )
                  .map(
                    ([key, platform]) =>
                      `
                        <label
                          class="ez-dist-platform-option"
                        >

                          <input
                            type="checkbox"
                            value="${key}"
                            data-dist-platform-check
                            ${
                              key ===
                              "website"
                                ? "checked"
                                : ""
                            }
                          />

                          <span
                            style="
                              font-size:19px;
                            "
                          >
                            ${platform.icon}
                          </span>

                          <strong>
                            ${escapeHtml(
                              platform.name
                            )}
                          </strong>

                        </label>
                      `
                  )
                  .join("")
              : `
                <div
                  class="ez-dist-empty"
                  style="min-height:120px"
                >
                  لا يوجد محتوى محدد.
                </div>
              `
          }

        </div>

        ${
          selected
            ? `
              <div
                style="
                  margin-top:13px;
                "
              >
                <label
                  style="
                    display:block;
                    color:#334155;
                    font-size:10px;
                    font-weight:900;
                  "
                >
                  وقت التوزيع

                  <input
                    id="ez-dist-schedule-time"
                    type="datetime-local"
                    style="
                      width:100%;
                      box-sizing:border-box;
                      margin-top:6px;
                      border:1px solid #bae6fd;
                      border-radius:11px;
                      padding:10px;
                      outline:none;
                    "
                  />
                </label>
              </div>
            `
            : ""
        }

        <div class="ez-dist-modal-actions">

          ${
            selected
              ? `
                <button
                  class="ez-dist-btn primary"
                  data-dist-create
                >
                  إنشاء عمليات التوزيع
                </button>
              `
              : ""
          }

          <button
            class="ez-dist-btn"
            data-dist-close
          >
            إلغاء
          </button>

        </div>

      </div>
    `;

    modal.classList.add(
      "show"
    );

    modal
      .querySelector(
        "[data-dist-close]"
      )
      ?.addEventListener(
        "click",
        closeDistributionModal
      );

    modal
      .querySelector(
        "[data-dist-create]"
      )
      ?.addEventListener(
        "click",
        () => {

          const selectedPlatforms =
            Array.from(
              modal.querySelectorAll(
                "[data-dist-platform-check]:checked"
              )
            ).map(
              input =>
                input.value
            );

          if (
            !selectedPlatforms.length
          ) {
            alert(
              "اختر منصة واحدة على الأقل."
            );

            return;
          }

          const timeInput =
            modal.querySelector(
              "#ez-dist-schedule-time"
            );

          const scheduledAt =
            timeInput?.value
              ? new Date(
                  timeInput.value
                ).toISOString()
              : null;

          selectedPlatforms.forEach(
            platform => {

              createDistribution(
                selected,
                platform,
                {
                  status:
                    scheduledAt
                      ? "scheduled"
                      : "pending",

                  scheduledAt
                }
              );

            }
          );

          closeDistributionModal();

          STATE.currentView =
            "queue";

          render();

          showToast(
            `تم إنشاء ${selectedPlatforms.length} عملية توزيع.`
          );
        }
      );
  }

  function closeDistributionModal() {
    const modal =
      document.querySelector(
        "#ez-dist-modal"
      );

    if (modal) {
      modal.classList.remove(
        "show"
      );
    }

    STATE.selectedContent =
      null;
  }

  async function publishDistribution(
    id
  ) {
    const item =
      STATE.distributions.find(
        distribution =>
          String(
            distribution.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    item.status =
      "publishing";

    item.updatedAt =
      new Date().toISOString();

    saveStoredQueue();
    render();

    /*
     * النشر الخارجي الحقيقي سيتم عبر
     * الموصلات الرسمية للمنصات.
     *
     * الموقع هو المسار الوحيد الذي يمكن
     * ربطه مباشرة بالـCMS الحالي.
     */

    if (
      item.platform ===
      "website"
    ) {
      try {
        await request(
          `${API.content}/${item.contentId}/publish`,
          {
            method:
              "POST"
          }
        );

        item.status =
          "published";

        item.publishedAt =
          new Date().toISOString();

        item.updatedAt =
          new Date().toISOString();

        saveStoredQueue();
        render();

        showToast(
          "تم نشر المحتوى على موقع EZ MEDIA."
        );

        return;

      } catch (error) {

        item.status =
          "failed";

        item.retryCount =
          Number(
            item.retryCount ||
            0
          ) + 1;

        item.message =
          error.message ||
          "فشل نشر المحتوى.";

        item.updatedAt =
          new Date().toISOString();

        saveStoredQueue();
        render();

        showToast(
          item.message
        );

        return;
      }
    }

    item.status =
      "pending";

    item.message =
      "بانتظار ربط API الرسمي للمنصة.";

    item.updatedAt =
      new Date().toISOString();

    saveStoredQueue();
    render();

    showToast(
      `تم تجهيز العملية لـ ${PLATFORMS[item.platform]?.name || item.platform}، والنشر الخارجي يحتاج ربط API رسمي.`
    );
  }

  function retryDistribution(
    id
  ) {
    const item =
      STATE.distributions.find(
        distribution =>
          String(
            distribution.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    item.status =
      "pending";

    item.message =
      "";

    item.updatedAt =
      new Date().toISOString();

    saveStoredQueue();

    render();

    showToast(
      "تمت إعادة العملية إلى طابور التوزيع."
    );
  }

  function showDistributionDetails(
    id
  ) {
    const item =
      STATE.distributions.find(
        distribution =>
          String(
            distribution.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    alert(
      [
        `المحتوى: ${item.title}`,
        `المنصة: ${
          PLATFORMS[
            item.platform
          ]?.name ||
          item.platform
        }`,
        `الحالة: ${
          STATUS_LABELS[
            item.status
          ] ||
          item.status
        }`,
        `موعد التوزيع: ${
          item.scheduledAt
            ? formatDate(
                item.scheduledAt
              )
            : "غير محدد"
        }`,
        `آخر تحديث: ${
          formatDate(
            item.updatedAt
          )
        }`,
        `عدد المحاولات: ${
          item.retryCount ||
          0
        }`
      ].join(
        "\n"
      )
    );
  }

  function bindEvents() {
    document
      .querySelectorAll(
        "[data-dist-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const action =
                button.dataset
                  .distAction;

              if (
                action ===
                "refresh"
              ) {
                loadContent();
              }

              if (
                action ===
                "new"
              ) {
                STATE.currentView =
                  "content";

                render();
              }
            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-dist-view]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              STATE.currentView =
                button.dataset
                  .distView;

              render();
            }
          );

        }
      );

    const search =
      document.querySelector(
        "#ez-dist-search"
      );

    if (search) {
      search.addEventListener(
        "input",
        event => {
          STATE.search =
            event.target.value;

          render();
        }
      );
    }

    const status =
      document.querySelector(
        "#ez-dist-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        event => {
          STATE.status =
            event.target.value;

          render();
        }
      );
    }

    const platform =
      document.querySelector(
        "#ez-dist-platform"
      );

    if (platform) {
      platform.addEventListener(
        "change",
        event => {
          STATE.platform =
            event.target.value;

          render();
        }
      );
    }

    document
      .querySelectorAll(
        "[data-dist-publish]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              publishDistribution(
                button.dataset
                  .distPublish
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-dist-retry]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              retryDistribution(
                button.dataset
                  .distRetry
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-dist-edit]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              showDistributionDetails(
                button.dataset
                  .distEdit
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-dist-content]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const item =
                STATE.contents.find(
                  content =>
                    String(
                      content.id
                    ) ===
                    String(
                      button.dataset
                        .distContent
                    )
                );

              if (!item) {
                return;
              }

              STATE.selectedContent =
                item;

              openDistributionModal(
                item
              );
            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-dist-platform]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              alert(
                `إعداد ${PLATFORMS[
                  button.dataset
                    .distPlatform
                ]?.name || ""} سيكون عبر موصل API الرسمي.`
              );

            }
          );

        }
      );
  }

  function showToast(
    message
  ) {
    let toast =
      document.querySelector(
        "#ez-dist-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-dist-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100000;
        max-width:360px;
        border:1px solid #bae6fd;
        border-radius:14px;
        background:#ffffff;
        color:#075985;
        padding:12px 15px;
        box-shadow:0 15px 45px rgba(7,89,133,.15);
        font-size:11px;
        font-weight:850;
        direction:rtl;
      `;

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(
        () => {
          toast.remove();
        },
        4500
      );
  }

  function initialize() {
    createMount();

    render();

    loadContent();
  }

  window.EZMediaAdminDistribution =
    {
      initialize,
      refresh:
        loadContent,

      createDistribution,

      publishDistribution,

      retryDistribution,

      getState() {
        return {
          ...STATE,
          contents: [
            ...STATE.contents
          ],
          distributions: [
            ...STATE.distributions
          ]
        };
      }
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
