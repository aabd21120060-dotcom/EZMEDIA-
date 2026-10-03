"use strict";

/*
 * EZ MEDIA 11.0
 * مركز التحليلات الذكي
 *
 * الملف:
 * public/admin-analytics.js
 *
 * الوظائف:
 * - لوحة تحليلات موحدة
 * - تحليلات المحتوى
 * - تحليلات الوسائط
 * - تحليلات البث
 * - تحليلات الإعلانات والرعايات
 * - مؤشرات تشغيلية
 * - مقارنة البيانات
 * - تحديث تلقائي
 * - تصدير تقرير JSON
 * - واجهة مستقبلية RTL
 */

(() => {
  const state = {
    loading: false,
    refreshing: false,
    lastUpdated: null,

    content: {
      total: 0,
      published: 0,
      draft: 0,
      review: 0,
      scheduled: 0,
      archived: 0,
      byType: {}
    },

    media: {
      total: 0,
      images: 0,
      videos: 0,
      audio: 0,
      documents: 0,
      other: 0
    },

    live: {
      total: 0,
      live: 0,
      testing: 0,
      offline: 0,
      disabled: 0
    },

    commercial: {
      campaigns: 0,
      placements: 0,
      impressions: 0,
      clicks: 0,
      starts: 0,
      completedViews: 0
    },

    system: {
      status: "unknown",
      database: null,
      storage: null
    }
  };

  const selectors = [
    "#analytics-section",
    "#admin-analytics-section",
    '[data-admin-section="analytics"]'
  ];

  function getRoot() {
    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }
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
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return "0";
    }

    return new Intl.NumberFormat("ar-SA").format(parsed);
  }

  function percent(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return "0%";
    }

    return `${parsed.toFixed(1)}%`;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function apiUrl(path) {
    return path;
  }

  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message =
        data &&
        typeof data === "object" &&
        data.error
          ? data.error
          : `فشل الطلب (${response.status})`;

      throw new Error(message);
    }

    return data;
  }

  function statusBadge(status) {
    const value = String(status || "unknown").toLowerCase();

    let label = "غير معروف";
    let className = "unknown";

    if (
      value === "online" ||
      value === "ready" ||
      value === "connected" ||
      value === "active"
    ) {
      label = "يعمل";
      className = "success";
    } else if (
      value === "degraded" ||
      value === "warning" ||
      value === "testing"
    ) {
      label = "يحتاج متابعة";
      className = "warning";
    } else if (
      value === "offline" ||
      value === "error" ||
      value === "failed"
    ) {
      label = "متوقف";
      className = "danger";
    }

    return `
      <span class="ez-analytics-status ${className}">
        <span class="ez-analytics-status-dot"></span>
        ${escapeHtml(label)}
      </span>
    `;
  }

  function icon(name) {
    const icons = {
      content: "📰",
      published: "🚀",
      media: "🗂️",
      video: "🎬",
      live: "📡",
      ads: "📢",
      clicks: "🖱️",
      views: "👁️",
      database: "🗄️",
      storage: "☁️",
      ai: "🧠",
      report: "📊",
      refresh: "↻",
      export: "⬇️",
      trend: "📈"
    };

    return icons[name] || "◉";
  }

  function calculateContentStats(items) {
    const list = safeArray(items);

    const stats = {
      total: list.length,
      published: 0,
      draft: 0,
      review: 0,
      scheduled: 0,
      archived: 0,
      byType: {}
    };

    list.forEach((item) => {
      const status = String(item.status || "").toLowerCase();
      const type = String(item.content_type || item.type || "other");

      if (status === "published") {
        stats.published += 1;
      } else if (status === "draft") {
        stats.draft += 1;
      } else if (status === "review") {
        stats.review += 1;
      } else if (status === "scheduled") {
        stats.scheduled += 1;
      } else if (status === "archived") {
        stats.archived += 1;
      }

      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  }

  function calculateMediaStats(items) {
    const list = safeArray(items);

    const stats = {
      total: list.length,
      images: 0,
      videos: 0,
      audio: 0,
      documents: 0,
      other: 0
    };

    list.forEach((item) => {
      const type = String(
        item.asset_type ||
        item.type ||
        item.media_type ||
        ""
      ).toLowerCase();

      if (type === "image" || type === "images") {
        stats.images += 1;
      } else if (
        type === "video" ||
        type === "videos"
      ) {
        stats.videos += 1;
      } else if (
        type === "audio" ||
        type === "audios"
      ) {
        stats.audio += 1;
      } else if (
        type === "document" ||
        type === "documents" ||
        type === "file" ||
        type === "files"
      ) {
        stats.documents += 1;
      } else {
        stats.other += 1;
      }
    });

    return stats;
  }

  function calculateLiveStats(items) {
    const list = safeArray(items);

    const stats = {
      total: list.length,
      live: 0,
      testing: 0,
      offline: 0,
      disabled: 0
    };

    list.forEach((item) => {
      const status = String(item.status || "").toLowerCase();

      if (status === "live") {
        stats.live += 1;
      } else if (status === "testing") {
        stats.testing += 1;
      } else if (status === "disabled") {
        stats.disabled += 1;
      } else {
        stats.offline += 1;
      }
    });

    return stats;
  }

  async function loadContent() {
    try {
      const data = await request("/api/content?limit=100");

      const items =
        data.items ||
        data.content ||
        data.data ||
        (Array.isArray(data) ? data : []);

      state.content = calculateContentStats(items);
    } catch (error) {
      console.warn("Analytics content error:", error);
    }
  }

  async function loadMedia() {
    try {
      const data = await request("/api/media?limit=100");

      const items =
        data.items ||
        data.media ||
        data.assets ||
        data.data ||
        (Array.isArray(data) ? data : []);

      state.media = calculateMediaStats(items);
    } catch (error) {
      console.warn("Analytics media error:", error);
    }
  }

  async function loadLive() {
    try {
      const data = await request("/api/live?limit=100");

      const items =
        data.items ||
        data.channels ||
        data.live ||
        data.data ||
        (Array.isArray(data) ? data : []);

      state.live = calculateLiveStats(items);
    } catch (error) {
      console.warn("Analytics live error:", error);
    }
  }

  async function loadCommercial() {
    try {
      const data = await request(
        "/api/commercial/statistics"
      );

      const statistics =
        data.statistics ||
        data.data ||
        data;

      state.commercial = {
        campaigns: Number(
          statistics.campaigns ||
          statistics.total_campaigns ||
          0
        ),

        placements: Number(
          statistics.placements ||
          statistics.total_placements ||
          0
        ),

        impressions: Number(
          statistics.impressions || 0
        ),

        clicks: Number(
          statistics.clicks || 0
        ),

        starts: Number(
          statistics.starts || 0
        ),

        completedViews: Number(
          statistics.completed_views ||
          statistics.completedViews ||
          0
        )
      };
    } catch (error) {
      console.warn("Analytics commercial error:", error);
    }
  }

  async function loadSystem() {
    try {
      const data = await request("/api/system");

      state.system.status =
        data.status ||
        data.system?.status ||
        "unknown";

      state.system.database =
        data.database ||
        null;

      state.system.storage =
        data.storage ||
        null;
    } catch (error) {
      console.warn("Analytics system error:", error);
    }
  }

  function calculateCommercialCTR() {
    const impressions = Number(
      state.commercial.impressions
    );

    const clicks = Number(
      state.commercial.clicks
    );

    if (!impressions) {
      return 0;
    }

    return (clicks / impressions) * 100;
  }

  function calculatePublishedRate() {
    const total = Number(state.content.total);

    if (!total) {
      return 0;
    }

    return (
      Number(state.content.published) /
      total
    ) *
      100;
  }

  function renderStyles() {
    if (document.getElementById("ez-media-analytics-styles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "ez-media-analytics-styles";

    style.textContent = `
      #ez-analytics-dashboard {
        direction: rtl;
        width: 100%;
        box-sizing: border-box;
        color: #17324d;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
      }

      #ez-analytics-dashboard * {
        box-sizing: border-box;
      }

      .ez-analytics-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 22px;
        margin-bottom: 18px;
        border: 1px solid #dceff9;
        border-radius: 24px;
        background:
          radial-gradient(
            circle at top right,
            rgba(123, 211, 255, .20),
            transparent 38%
          ),
          linear-gradient(
            135deg,
            #ffffff,
            #f3fbff
          );
        box-shadow:
          0 12px 35px rgba(77, 170, 210, .08);
      }

      .ez-analytics-title {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .ez-analytics-title-icon {
        width: 52px;
        height: 52px;
        border-radius: 17px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 25px;
        background:
          linear-gradient(
            145deg,
            #dff7ff,
            #ffffff
          );
        border: 1px solid #c8edf9;
        box-shadow:
          inset 0 0 20px rgba(93, 205, 246, .10);
      }

      .ez-analytics-title h2 {
        margin: 0;
        font-size: 23px;
        font-weight: 850;
        letter-spacing: -.4px;
      }

      .ez-analytics-title p {
        margin: 5px 0 0;
        color: #6a879c;
        font-size: 13px;
      }

      .ez-analytics-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-analytics-btn {
        border: 1px solid #cdebf7;
        background: #ffffff;
        color: #17698d;
        border-radius: 13px;
        min-height: 40px;
        padding: 0 14px;
        cursor: pointer;
        font-weight: 750;
        transition:
          transform .18s ease,
          box-shadow .18s ease,
          background .18s ease;
      }

      .ez-analytics-btn:hover {
        transform: translateY(-1px);
        background: #f1fbff;
        box-shadow:
          0 8px 20px rgba(69, 180, 222, .12);
      }

      .ez-analytics-btn.primary {
        border-color: #87d8f4;
        background:
          linear-gradient(
            135deg,
            #dff8ff,
            #ffffff
          );
      }

      .ez-analytics-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        color: #7891a2;
        font-size: 12px;
      }

      .ez-analytics-live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #47c8ef;
        box-shadow: 0 0 0 4px rgba(71, 200, 239, .12);
      }

      .ez-analytics-kpis {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }

      .ez-analytics-card {
        position: relative;
        overflow: hidden;
        padding: 19px;
        border-radius: 21px;
        border: 1px solid #deeff7;
        background: #ffffff;
        box-shadow:
          0 10px 28px rgba(73, 159, 194, .07);
      }

      .ez-analytics-card::after {
        content: "";
        position: absolute;
        width: 100px;
        height: 100px;
        left: -45px;
        bottom: -55px;
        border-radius: 50%;
        background: rgba(112, 211, 244, .10);
      }

      .ez-analytics-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .ez-analytics-card-icon {
        width: 39px;
        height: 39px;
        border-radius: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #eefaff;
        border: 1px solid #d5f1fb;
        font-size: 18px;
      }

      .ez-analytics-card-label {
        color: #7892a5;
        font-size: 12px;
        font-weight: 700;
      }

      .ez-analytics-card-value {
        margin-top: 10px;
        font-size: 29px;
        line-height: 1;
        font-weight: 900;
        color: #123c59;
      }

      .ez-analytics-card-note {
        margin-top: 9px;
        color: #7993a4;
        font-size: 11px;
      }

      .ez-analytics-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .ez-analytics-panel {
        min-width: 0;
        padding: 20px;
        border-radius: 22px;
        border: 1px solid #deeff7;
        background: #ffffff;
        box-shadow:
          0 10px 28px rgba(73, 159, 194, .06);
      }

      .ez-analytics-panel.full {
        grid-column: 1 / -1;
      }

      .ez-analytics-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
      }

      .ez-analytics-panel-header h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 850;
      }

      .ez-analytics-panel-header span {
        color: #7892a5;
        font-size: 11px;
      }

      .ez-analytics-bars {
        display: grid;
        gap: 13px;
      }

      .ez-analytics-bar-row {
        display: grid;
        grid-template-columns: 100px 1fr 65px;
        align-items: center;
        gap: 10px;
      }

      .ez-analytics-bar-label {
        font-size: 12px;
        color: #58758a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ez-analytics-bar-track {
        height: 9px;
        overflow: hidden;
        border-radius: 20px;
        background: #edf7fb;
      }

      .ez-analytics-bar-fill {
        height: 100%;
        border-radius: inherit;
        background:
          linear-gradient(
            90deg,
            #74d5f4,
            #bceeff
          );
        transition: width .45s ease;
      }

      .ez-analytics-bar-value {
        text-align: left;
        color: #39748f;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-analytics-mini-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .ez-analytics-mini {
        padding: 14px;
        border: 1px solid #e2f1f7;
        border-radius: 16px;
        background: #fafeff;
      }

      .ez-analytics-mini-label {
        color: #7b96a8;
        font-size: 11px;
      }

      .ez-analytics-mini-value {
        margin-top: 7px;
        color: #1a506d;
        font-size: 21px;
        font-weight: 900;
      }

      .ez-analytics-status-list {
        display: grid;
        gap: 10px;
      }

      .ez-analytics-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 14px;
        background: #f9fdff;
        border: 1px solid #e4f2f8;
      }

      .ez-analytics-status-name {
        color: #557388;
        font-size: 12px;
        font-weight: 700;
      }

      .ez-analytics-status-value {
        font-size: 13px;
        font-weight: 850;
      }

      .ez-analytics-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 9px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 800;
      }

      .ez-analytics-status.success {
        color: #267a62;
        background: #eafbf5;
      }

      .ez-analytics-status.warning {
        color: #997128;
        background: #fff9e8;
      }

      .ez-analytics-status.danger {
        color: #a34848;
        background: #fff0f0;
      }

      .ez-analytics-status.unknown {
        color: #637f90;
        background: #eef7fa;
      }

      .ez-analytics-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      .ez-analytics-insight {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 15px;
        border-radius: 16px;
        border: 1px solid #dff1f8;
        background:
          linear-gradient(
            135deg,
            #f9feff,
            #f0fbff
          );
        margin-bottom: 10px;
      }

      .ez-analytics-insight:last-child {
        margin-bottom: 0;
      }

      .ez-analytics-insight-icon {
        width: 36px;
        height: 36px;
        flex: 0 0 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: #e3f8ff;
        font-size: 16px;
      }

      .ez-analytics-insight strong {
        display: block;
        color: #28546d;
        font-size: 12px;
        margin-bottom: 4px;
      }

      .ez-analytics-insight p {
        margin: 0;
        color: #6f8a9a;
        line-height: 1.7;
        font-size: 11px;
      }

      .ez-analytics-empty {
        padding: 28px;
        text-align: center;
        color: #809aaa;
        border: 1px dashed #cfeaf4;
        border-radius: 16px;
        background: #fbfeff;
      }

      .ez-analytics-loading {
        padding: 35px;
        text-align: center;
        color: #6d8999;
      }

      .ez-analytics-spinner {
        width: 32px;
        height: 32px;
        margin: 0 auto 12px;
        border-radius: 50%;
        border: 3px solid #dff3fa;
        border-top-color: #69cce9;
        animation: ezAnalyticsSpin .8s linear infinite;
      }

      @keyframes ezAnalyticsSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 1100px) {
        .ez-analytics-kpis {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .ez-analytics-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .ez-analytics-actions {
          width: 100%;
        }

        .ez-analytics-btn {
          flex: 1;
        }

        .ez-analytics-kpis,
        .ez-analytics-grid {
          grid-template-columns: 1fr;
        }

        .ez-analytics-panel.full {
          grid-column: auto;
        }

        .ez-analytics-mini-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 480px) {
        .ez-analytics-kpis {
          grid-template-columns: 1fr;
        }

        .ez-analytics-mini-grid {
          grid-template-columns: 1fr;
        }

        .ez-analytics-bar-row {
          grid-template-columns: 82px 1fr 48px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function render() {
    const root = getRoot();

    if (!root) {
      return;
    }

    renderStyles();

    const contentTotal = state.content.total;
    const publishedRate = calculatePublishedRate();

    const mediaTotal = state.media.total;

    const commercialCTR = calculateCommercialCTR();

    const liveNow = state.live.live;

    const totalCommercialEvents =
      state.commercial.impressions +
      state.commercial.clicks +
      state.commercial.starts +
      state.commercial.completedViews;

    const typeEntries = Object.entries(
      state.content.byType || {}
    );

    const maxTypeValue = Math.max(
      ...typeEntries.map(
        ([, value]) => Number(value) || 0
      ),
      1
    );

    const typeLabels = {
      news: "أخبار",
      report: "تقارير",
      interview: "مقابلات",
      video: "فيديو",
      coverage: "تغطيات",
      breaking: "عاجل",
      other: "أخرى"
    };

    const typeBars = typeEntries.length
      ? typeEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([type, value]) => {
            const width =
              ((Number(value) || 0) /
                maxTypeValue) *
              100;

            return `
              <div class="ez-analytics-bar-row">
                <div class="ez-analytics-bar-label">
                  ${escapeHtml(
                    typeLabels[type] || type
                  )}
                </div>

                <div class="ez-analytics-bar-track">
                  <div
                    class="ez-analytics-bar-fill"
                    style="width:${width}%"
                  ></div>
                </div>

                <div class="ez-analytics-bar-value">
                  ${number(value)}
                </div>
              </div>
            `;
          })
          .join("")
      : `
        <div class="ez-analytics-empty">
          لا توجد بيانات محتوى كافية للعرض حاليًا.
        </div>
      `;

    root.innerHTML = `
      <div id="ez-analytics-dashboard">

        <div class="ez-analytics-header">

          <div>
            <div class="ez-analytics-title">

              <div class="ez-analytics-title-icon">
                ${icon("report")}
              </div>

              <div>
                <h2>
                  مركز التحليلات الذكي
                </h2>

                <p>
                  قراءة موحدة لأداء المحتوى والوسائط والبث والإعلانات والنظام.
                </p>
              </div>

            </div>

            <div class="ez-analytics-meta">
              <span class="ez-analytics-live-dot"></span>
              <span>
                آخر تحديث:
                ${
                  state.lastUpdated
                    ? escapeHtml(
                        state.lastUpdated.toLocaleTimeString(
                          "ar-SA"
                        )
                      )
                    : "جاري التحميل"
                }
              </span>
            </div>
          </div>

          <div class="ez-analytics-actions">

            <button
              type="button"
              class="ez-analytics-btn primary"
              id="ez-analytics-refresh"
            >
              ${icon("refresh")}
              تحديث
            </button>

            <button
              type="button"
              class="ez-analytics-btn"
              id="ez-analytics-export"
            >
              ${icon("export")}
              تصدير التقرير
            </button>

          </div>

        </div>

        <div class="ez-analytics-kpis">

          <div class="ez-analytics-card">
            <div class="ez-analytics-card-top">
              <div>
                <div class="ez-analytics-card-label">
                  إجمالي المحتوى
                </div>
              </div>

              <div class="ez-analytics-card-icon">
                ${icon("content")}
              </div>
            </div>

            <div class="ez-analytics-card-value">
              ${number(contentTotal)}
            </div>

            <div class="ez-analytics-card-note">
              منشور ومسودات ومحتوى قيد المراجعة
            </div>
          </div>

          <div class="ez-analytics-card">
            <div class="ez-analytics-card-top">
              <div>
                <div class="ez-analytics-card-label">
                  المحتوى المنشور
                </div>
              </div>

              <div class="ez-analytics-card-icon">
                ${icon("published")}
              </div>
            </div>

            <div class="ez-analytics-card-value">
              ${number(state.content.published)}
            </div>

            <div class="ez-analytics-card-note">
              معدل النشر الحالي ${percent(publishedRate)}
            </div>
          </div>

          <div class="ez-analytics-card">
            <div class="ez-analytics-card-top">
              <div>
                <div class="ez-analytics-card-label">
                  مكتبة الوسائط
                </div>
              </div>

              <div class="ez-analytics-card-icon">
                ${icon("media")}
              </div>
            </div>

            <div class="ez-analytics-card-value">
              ${number(mediaTotal)}
            </div>

            <div class="ez-analytics-card-note">
              صور وفيديو وصوت وملفات
            </div>
          </div>

          <div class="ez-analytics-card">
            <div class="ez-analytics-card-top">
              <div>
                <div class="ez-analytics-card-label">
                  البث المباشر الآن
                </div>
              </div>

              <div class="ez-analytics-card-icon">
                ${icon("live")}
              </div>
            </div>

            <div class="ez-analytics-card-value">
              ${number(liveNow)}
            </div>

            <div class="ez-analytics-card-note">
              من إجمالي ${number(state.live.total)} قناة
            </div>
          </div>

        </div>

        <div class="ez-analytics-grid">

          <section class="ez-analytics-panel">

            <div class="ez-analytics-panel-header">
              <div>
                <h3>حالة المحتوى</h3>
              </div>

              <span>
                التوزيع حسب الحالة
              </span>
            </div>

            <div class="ez-analytics-mini-grid">

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  منشور
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.content.published)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  مسودة
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.content.draft)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  مراجعة
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.content.review)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  مجدول
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.content.scheduled)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  مؤرشف
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.content.archived)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  الإجمالي
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.content.total)}
                </div>
              </div>

            </div>

          </section>

          <section class="ez-analytics-panel">

            <div class="ez-analytics-panel-header">
              <div>
                <h3>مكتبة الوسائط</h3>
              </div>

              <span>
                توزيع الأصول
              </span>
            </div>

            <div class="ez-analytics-mini-grid">

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  صور
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.media.images)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  فيديو
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.media.videos)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  صوت
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.media.audio)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  مستندات
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.media.documents)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  أخرى
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.media.other)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  الإجمالي
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.media.total)}
                </div>
              </div>

            </div>

          </section>

          <section class="ez-analytics-panel">

            <div class="ez-analytics-panel-header">
              <div>
                <h3>أنواع المحتوى</h3>
              </div>

              <span>
                الأكثر إنتاجًا
              </span>
            </div>

            <div class="ez-analytics-bars">
              ${typeBars}
            </div>

          </section>

          <section class="ez-analytics-panel">

            <div class="ez-analytics-panel-header">
              <div>
                <h3>البث المباشر</h3>
              </div>

              <span>
                حالة القنوات
              </span>
            </div>

            <div class="ez-analytics-status-list">

              <div class="ez-analytics-status-row">
                <span class="ez-analytics-status-name">
                  مباشر الآن
                </span>

                <strong class="ez-analytics-status-value">
                  ${number(state.live.live)}
                </strong>
              </div>

              <div class="ez-analytics-status-row">
                <span class="ez-analytics-status-name">
                  اختبار
                </span>

                <strong class="ez-analytics-status-value">
                  ${number(state.live.testing)}
                </strong>
              </div>

              <div class="ez-analytics-status-row">
                <span class="ez-analytics-status-name">
                  متوقف
                </span>

                <strong class="ez-analytics-status-value">
                  ${number(state.live.offline)}
                </strong>
              </div>

              <div class="ez-analytics-status-row">
                <span class="ez-analytics-status-name">
                  معطل
                </span>

                <strong class="ez-analytics-status-value">
                  ${number(state.live.disabled)}
                </strong>
              </div>

            </div>

          </section>

          <section class="ez-analytics-panel full">

            <div class="ez-analytics-panel-header">
              <div>
                <h3>الإعلانات والرعايات</h3>
              </div>

              <span>
                مؤشرات تجارية
              </span>
            </div>

            <div class="ez-analytics-mini-grid">

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  الحملات
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.commercial.campaigns)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  مواضع الإعلانات
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.commercial.placements)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  مرات الظهور
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.commercial.impressions)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  النقرات
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.commercial.clicks)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  بدء المشاهدة
                </div>
                <div class="ez-analytics-mini-value">
                  ${number(state.commercial.starts)}
                </div>
              </div>

              <div class="ez-analytics-mini">
                <div class="ez-analytics-mini-label">
                  CTR
                </div>
                <div class="ez-analytics-mini-value">
                  ${percent(commercialCTR)}
                </div>
              </div>

            </div>

          </section>

          <section class="ez-analytics-panel">

            <div class="ez-analytics-panel-header">
              <div>
                <h3>حالة المنصة</h3>
              </div>

              <span>
                التشغيل والبنية
              </span>
            </div>

            <div class="ez-analytics-status-list">

              <div class="ez-analytics-status-row">
                <span class="ez-analytics-status-name">
                  النظام
                </span>

                ${statusBadge(state.system.status)}
              </div>

              <div class="ez-analytics-status-row">
                <span class="ez-analytics-status-name">
                  قاعدة البيانات
                </span>

                ${
                  state.system.database
                    ? statusBadge(
                        state.system.database.connected
                          ? "connected"
                          : "error"
                      )
                    : statusBadge("unknown")
                }
              </div>

              <div class="ez-analytics-status-row">
                <span class="ez-analytics-status-name">
                  التخزين
                </span>

                ${
                  state.system.storage
                    ? statusBadge(
                        state.system.storage.configured
                          ? "connected"
                          : "warning"
                      )
                    : statusBadge("unknown")
                }
              </div>

            </div>

          </section>

          <section class="ez-analytics-panel">

            <div class="ez-analytics-panel-header">
              <div>
                <h3>قراءة ذكية</h3>
              </div>

              <span>
                تحليلات تشغيلية
              </span>
            </div>

            <div>

              <div class="ez-analytics-insight">
                <div class="ez-analytics-insight-icon">
                  ${icon("trend")}
                </div>

                <div>
                  <strong>
                    إنتاج المحتوى
                  </strong>

                  <p>
                    لدى المنصة
                    ${number(contentTotal)}
                    عنصرًا في نظام المحتوى،
                    منها
                    ${number(state.content.published)}
                    منشور.
                  </p>
                </div>
              </div>

              <div class="ez-analytics-insight">
                <div class="ez-analytics-insight-icon">
                  ${icon("video")}
                </div>

                <div>
                  <strong>
                    الوسائط
                  </strong>

                  <p>
                    تحتوي مكتبة الوسائط على
                    ${number(mediaTotal)}
                    أصلًا رقميًا، منها
                    ${number(state.media.videos)}
                    فيديو.
                  </p>
                </div>
              </div>

              <div class="ez-analytics-insight">
                <div class="ez-analytics-insight-icon">
                  ${icon("ads")}
                </div>

                <div>
                  <strong>
                    النشاط التجاري
                  </strong>

                  <p>
                    تم تسجيل
                    ${number(totalCommercialEvents)}
                    حدثًا تجاريًا ضمن بيانات الإعلانات والرعايات الحالية.
                  </p>
                </div>
              </div>

              <div class="ez-analytics-insight">
                <div class="ez-analytics-insight-icon">
                  ${icon("ai")}
                </div>

                <div>
                  <strong>
                    طبقة الذكاء الاصطناعي
                  </strong>

                  <p>
                    مركز التحليلات مصمم ليكون طبقة قرار مستقبلية،
                    بحيث يمكن لاحقًا ربطه بوكلاء AI لاكتشاف الاتجاهات
                    واقتراح القرارات التحريرية والتجارية.
                  </p>
                </div>
              </div>

            </div>

          </section>

        </div>

      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const refreshButton = document.getElementById(
      "ez-analytics-refresh"
    );

    const exportButton = document.getElementById(
      "ez-analytics-export"
    );

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        async () => {
          await refresh();
        }
      );
    }

    if (exportButton) {
      exportButton.addEventListener(
        "click",
        exportReport
      );
    }
  }

  async function refresh() {
    if (state.refreshing) {
      return;
    }

    state.refreshing = true;

    const root = getRoot();

    if (root) {
      const dashboard =
        root.querySelector(
          "#ez-analytics-dashboard"
        );

      if (dashboard) {
        const button =
          dashboard.querySelector(
            "#ez-analytics-refresh"
          );

        if (button) {
          button.disabled = true;
          button.textContent =
            "⟳ جاري التحديث...";
        }
      }
    }

    await Promise.all([
      loadContent(),
      loadMedia(),
      loadLive(),
      loadCommercial(),
      loadSystem()
    ]);

    state.lastUpdated = new Date();

    state.refreshing = false;

    render();
  }

  function exportReport() {
    const report = {
      platform: "EZ MEDIA",
      version: "11.0.0",
      generatedAt:
        new Date().toISOString(),

      analytics: {
        content: state.content,
        media: state.media,
        live: state.live,
        commercial: state.commercial,
        system: state.system
      }
    };

    const blob = new Blob(
      [
        JSON.stringify(
          report,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `ez-media-analytics-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);
  }

  async function init() {
    const root = getRoot();

    if (!root) {
      return;
    }

    renderStyles();

    root.innerHTML = `
      <div
        id="ez-analytics-dashboard"
        class="ez-analytics-loading"
      >
        <div class="ez-analytics-spinner"></div>

        <div>
          جاري تجهيز مركز التحليلات الذكي...
        </div>
      </div>
    `;

    await refresh();
  }

  /*
   * API عامة للوحة الإدارة
   */
  window.EZMediaAdminAnalytics = {
    refresh,
    exportReport,
    getState: () => ({
      ...state,
      content: {
        ...state.content,
        byType: {
          ...state.content.byType
        }
      },
      media: {
        ...state.media
      },
      live: {
        ...state.live
      },
      commercial: {
        ...state.commercial
      },
      system: {
        ...state.system
      }
    })
  };

  /*
   * التشغيل التلقائي
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

  /*
   * تحديث دوري كل 60 ثانية.
   */
  setInterval(
    () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refresh();
      }
    },
    60000
  );
})();
