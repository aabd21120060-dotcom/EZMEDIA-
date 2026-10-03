"use strict";

/*
 * EZ MEDIA 11.0
 * مركز التحليلات الذكي
 * الملف: public/admin-analytics.js
 */

(() => {
  const API = {
    system: "/api/system",
    content: "/api/content",
    media: "/api/media",
    live: "/api/live",
    commercial: "/api/commercial/statistics"
  };

  const state = {
    content: [],
    media: [],
    live: [],
    commercial: null,
    loading: false
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function number(value) {
    const parsed = Number(value || 0);

    return new Intl.NumberFormat("ar-SA").format(
      Number.isFinite(parsed) ? parsed : 0
    );
  }

  function percentage(value) {
    const parsed = Number(value || 0);

    if (!Number.isFinite(parsed)) {
      return "0%";
    }

    return `${parsed.toFixed(1)}%`;
  }

  async function request(url) {
    const response = await fetch(url);

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
        `تعذر تحميل البيانات (${response.status})`
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

  function getContainer() {
    return (
      document.getElementById("analytics-section") ||
      document.getElementById("admin-analytics-section") ||
      document.querySelector(
        '[data-admin-section="analytics"]'
      )
    );
  }

  function notify(message, type = "info") {
    let box = document.getElementById(
      "ez-analytics-notification"
    );

    if (!box) {
      box = document.createElement("div");

      box.id = "ez-analytics-notification";

      Object.assign(box.style, {
        position: "fixed",
        top: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "999999",
        maxWidth: "calc(100vw - 30px)",
        padding: "14px 20px",
        borderRadius: "16px",
        background: "#ffffff",
        color: "#17324d",
        border: "1px solid #d9eaf7",
        boxShadow: "0 18px 50px rgba(27,116,170,.16)",
        fontFamily: "inherit",
        fontSize: "13px",
        fontWeight: "800",
        textAlign: "center"
      });

      document.body.appendChild(box);
    }

    box.textContent = message;

    box.style.borderColor =
      type === "error"
        ? "#efcaca"
        : type === "success"
          ? "#bde8d0"
          : "#d9eaf7";

    clearTimeout(box._timer);

    box._timer = setTimeout(() => {
      box.remove();
    }, 3500);
  }

  function renderShell() {
    const container = getContainer();

    if (!container) {
      return null;
    }

    container.innerHTML = `
      <div id="ez-analytics-app" dir="rtl">

        <style>
          #ez-analytics-app {
            width:100%;
            color:#17324d;
            font-family:inherit;
          }

          #ez-analytics-app * {
            box-sizing:border-box;
          }

          .ez-an-header {
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:18px;
            flex-wrap:wrap;
            margin-bottom:20px;
          }

          .ez-an-badge {
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:8px 12px;
            border-radius:999px;
            background:#effaff;
            border:1px solid #d8effa;
            color:#237ca5;
            font-size:11px;
            font-weight:900;
            margin-bottom:9px;
          }

          .ez-an-dot {
            width:7px;
            height:7px;
            border-radius:50%;
            background:#39b6e8;
          }

          .ez-an-title {
            margin:0 0 6px;
            font-size:27px;
            font-weight:950;
            letter-spacing:-.4px;
          }

          .ez-an-subtitle {
            margin:0;
            color:#6d8799;
            font-size:13px;
            line-height:1.8;
          }

          .ez-an-actions {
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          }

          .ez-an-btn {
            min-height:42px;
            border:0;
            border-radius:13px;
            padding:0 15px;
            font-family:inherit;
            font-size:12px;
            font-weight:900;
            cursor:pointer;
          }

          .ez-an-btn-primary {
            color:#fff;
            background:linear-gradient(135deg,#63c9f5,#39a8df);
            box-shadow:0 10px 25px rgba(57,168,223,.18);
          }

          .ez-an-btn-light {
            color:#2a769c;
            background:#f4fbff;
            border:1px solid #dceef7;
          }

          .ez-an-grid {
            display:grid;
            grid-template-columns:repeat(4,minmax(0,1fr));
            gap:11px;
            margin-bottom:16px;
          }

          .ez-an-card {
            background:#fff;
            border:1px solid #e1edf5;
            border-radius:18px;
            padding:16px;
            box-shadow:0 7px 28px rgba(29,112,155,.05);
          }

          .ez-an-card-label {
            color:#7891a3;
            font-size:11px;
            font-weight:800;
            margin-bottom:7px;
          }

          .ez-an-card-value {
            color:#17324d;
            font-size:24px;
            font-weight:950;
          }

          .ez-an-card-note {
            margin-top:5px;
            color:#8aa0ae;
            font-size:10px;
          }

          .ez-an-layout {
            display:grid;
            grid-template-columns:1.3fr .7fr;
            gap:14px;
            margin-bottom:16px;
          }

          .ez-an-panel {
            background:#fff;
            border:1px solid #e1edf5;
            border-radius:20px;
            padding:18px;
            box-shadow:0 7px 28px rgba(29,112,155,.05);
          }

          .ez-an-panel-title {
            margin:0 0 4px;
            color:#254d64;
            font-size:16px;
            font-weight:950;
          }

          .ez-an-panel-subtitle {
            margin:0 0 15px;
            color:#8499a8;
            font-size:10px;
          }

          .ez-an-bars {
            display:flex;
            flex-direction:column;
            gap:12px;
          }

          .ez-an-bar-row {
            display:grid;
            grid-template-columns:110px 1fr 55px;
            gap:10px;
            align-items:center;
          }

          .ez-an-bar-label {
            color:#506f82;
            font-size:11px;
            font-weight:800;
          }

          .ez-an-bar-track {
            height:10px;
            border-radius:999px;
            background:#edf5f9;
            overflow:hidden;
          }

          .ez-an-bar-fill {
            height:100%;
            border-radius:999px;
            background:linear-gradient(90deg,#8ad8f7,#3ba9df);
          }

          .ez-an-bar-value {
            text-align:left;
            color:#315b72;
            font-size:10px;
            font-weight:900;
          }

          .ez-an-ranking {
            display:flex;
            flex-direction:column;
            gap:9px;
          }

          .ez-an-rank {
            display:grid;
            grid-template-columns:28px 1fr auto;
            gap:9px;
            align-items:center;
            padding:10px;
            border:1px solid #e6f0f5;
            border-radius:13px;
            background:#fbfdff;
          }

          .ez-an-rank-number {
            width:28px;
            height:28px;
            display:flex;
            align-items:center;
            justify-content:center;
            border-radius:9px;
            background:#eef9fe;
            color:#247ba4;
            font-size:11px;
            font-weight:950;
          }

          .ez-an-rank-title {
            color:#274e65;
            font-size:11px;
            font-weight:850;
            line-height:1.5;
          }

          .ez-an-rank-meta {
            color:#8aa0ae;
            font-size:9px;
            margin-top:2px;
          }

          .ez-an-rank-value {
            color:#247aa3;
            font-size:11px;
            font-weight:950;
            white-space:nowrap;
          }

          .ez-an-system {
            display:grid;
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:10px;
          }

          .ez-an-system-item {
            padding:13px;
            border:1px solid #e5eef4;
            border-radius:14px;
            background:#fbfdff;
          }

          .ez-an-system-label {
            color:#8499a8;
            font-size:10px;
            margin-bottom:5px;
          }

          .ez-an-system-value {
            color:#294f65;
            font-size:12px;
            font-weight:900;
            word-break:break-word;
          }

          .ez-an-loading {
            padding:45px 20px;
            text-align:center;
            color:#7891a2;
            font-weight:800;
          }

          @media(max-width:1050px) {
            .ez-an-grid {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }

            .ez-an-layout {
              grid-template-columns:1fr;
            }
          }

          @media(max-width:650px) {
            .ez-an-grid {
              grid-template-columns:1fr 1fr;
            }

            .ez-an-system {
              grid-template-columns:1fr;
            }

            .ez-an-title {
              font-size:22px;
            }

            .ez-an-bar-row {
              grid-template-columns:80px 1fr 45px;
            }
          }
        </style>

        <div class="ez-an-header">

          <div>
            <div class="ez-an-badge">
              <span class="ez-an-dot"></span>
              ذكاء المنصة والتحليلات
            </div>

            <h2 class="ez-an-title">
              مركز التحليلات الذكي
            </h2>

            <p class="ez-an-subtitle">
              قراءة موحدة لأداء المحتوى والوسائط والبث
              والنشاط التجاري وحالة المنصة.
            </p>
          </div>

          <div class="ez-an-actions">
            <button
              class="ez-an-btn ez-an-btn-light"
              id="ez-an-refresh"
            >
              تحديث البيانات
            </button>

            <button
              class="ez-an-btn ez-an-btn-primary"
              id="ez-an-report"
            >
              إنشاء ملخص
            </button>
          </div>

        </div>

        <div class="ez-an-grid">

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              إجمالي المحتوى
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-content"
            >
              0
            </div>
            <div class="ez-an-card-note">
              الأخبار والتقارير والفيديو والتغطيات
            </div>
          </div>

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              مكتبة الوسائط
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-media"
            >
              0
            </div>
            <div class="ez-an-card-note">
              صور وفيديو وصوت وملفات
            </div>
          </div>

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              القنوات المباشرة
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-live"
            >
              0
            </div>
            <div class="ez-an-card-note">
              إجمالي قنوات البث
            </div>
          </div>

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              القنوات المباشرة الآن
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-live-now"
            >
              0
            </div>
            <div class="ez-an-card-note">
              حالة البث الحالية
            </div>
          </div>

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              الحملات التجارية
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-campaigns"
            >
              0
            </div>
            <div class="ez-an-card-note">
              إعلانات ورعايات وشراكات
            </div>
          </div>

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              الانطباعات
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-impressions"
            >
              0
            </div>
            <div class="ez-an-card-note">
              النشاط التجاري المسجل
            </div>
          </div>

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              النقرات
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-clicks"
            >
              0
            </div>
            <div class="ez-an-card-note">
              تفاعل الإعلانات
            </div>
          </div>

          <div class="ez-an-card">
            <div class="ez-an-card-label">
              معدل النقر
            </div>
            <div
              class="ez-an-card-value"
              id="ez-an-ctr"
            >
              0%
            </div>
            <div class="ez-an-card-note">
              CTR
            </div>
          </div>

        </div>

        <div class="ez-an-layout">

          <section class="ez-an-panel">

            <h3 class="ez-an-panel-title">
              توزيع المحتوى
            </h3>

            <p class="ez-an-panel-subtitle">
              عدد العناصر حسب نوع المحتوى.
            </p>

            <div
              id="ez-an-content-bars"
              class="ez-an-bars"
            >
              <div class="ez-an-loading">
                جاري تحليل المحتوى...
              </div>
            </div>

          </section>

          <section class="ez-an-panel">

            <h3 class="ez-an-panel-title">
              حالات المحتوى
            </h3>

            <p class="ez-an-panel-subtitle">
              دورة المحتوى داخل غرفة الأخبار.
            </p>

            <div
              id="ez-an-status-bars"
              class="ez-an-bars"
            >
              <div class="ez-an-loading">
                جاري التحليل...
              </div>
            </div>

          </section>

        </div>

        <div class="ez-an-layout">

          <section class="ez-an-panel">

            <h3 class="ez-an-panel-title">
              أحدث المحتوى
            </h3>

            <p class="ez-an-panel-subtitle">
              آخر العناصر التي وصلت إلى المنصة.
            </p>

            <div
              id="ez-an-recent"
              class="ez-an-ranking"
            >
              <div class="ez-an-loading">
                جاري التحميل...
              </div>
            </div>

          </section>

          <section class="ez-an-panel">

            <h3 class="ez-an-panel-title">
              أداء البث
            </h3>

            <p class="ez-an-panel-subtitle">
              قراءة سريعة لحالة منظومة البث.
            </p>

            <div
              id="ez-an-live-summary"
              class="ez-an-ranking"
            >
              <div class="ez-an-loading">
                جاري التحميل...
              </div>
            </div>

          </section>

        </div>

        <section class="ez-an-panel">

          <h3 class="ez-an-panel-title">
            حالة النظام
          </h3>

          <p class="ez-an-panel-subtitle">
            معلومات تشغيلية من واجهة النظام.
          </p>

          <div
            id="ez-an-system"
            class="ez-an-system"
          >
            <div class="ez-an-loading">
              جاري تحميل حالة النظام...
            </div>
          </div>

        </section>

      </div>
    `;

    bindEvents();

    return container;
  }

  function bindEvents() {
    document
      .getElementById("ez-an-refresh")
      ?.addEventListener(
        "click",
        refresh
      );

    document
      .getElementById("ez-an-report")
      ?.addEventListener(
        "click",
        generateSummary
      );
  }

  async function loadContent() {
    try {
      const data = await request(
        `${API.content}?limit=100`
      );

      state.content = normalizeList(
        data,
        ["items", "content"]
      );
    } catch (error) {
      console.warn(
        "Analytics content:",
        error
      );

      state.content = [];
    }
  }

  async function loadMedia() {
    try {
      const data = await request(
        `${API.media}?limit=100`
      );

      state.media = normalizeList(
        data,
        ["items", "media", "assets"]
      );
    } catch (error) {
      console.warn(
        "Analytics media:",
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
        ["items", "channels", "live"]
      );
    } catch (error) {
      console.warn(
        "Analytics live:",
        error
      );

      state.live = [];
    }
  }

  async function loadCommercial() {
    try {
      const data = await request(
        API.commercial
      );

      state.commercial =
        data?.statistics ||
        data?.data ||
        data ||
        {};
    } catch (error) {
      console.warn(
        "Analytics commercial:",
        error
      );

      state.commercial = {};
    }
  }

  async function loadSystem() {
    try {
      return await request(
        API.system
      );
    } catch (error) {
      console.warn(
        "Analytics system:",
        error
      );

      return null;
    }
  }

  function renderOverview() {
    const commercial =
      state.commercial || {};

    const contentCount =
      state.content.length;

    const mediaCount =
      state.media.length;

    const liveCount =
      state.live.length;

    const liveNow =
      state.live.filter(
        channel =>
          channel.status === "live"
      ).length;

    const campaigns =
      commercial.campaigns ??
      commercial.totalCampaigns ??
      0;

    const impressions =
      Number(
        commercial.impressions ??
        commercial.totalImpressions ??
        0
      );

    const clicks =
      Number(
        commercial.clicks ??
        commercial.totalClicks ??
        0
      );

    const ctr =
      impressions > 0
        ? (clicks / impressions) * 100
        : 0;

    setText(
      "ez-an-content",
      number(contentCount)
    );

    setText(
      "ez-an-media",
      number(mediaCount)
    );

    setText(
      "ez-an-live",
      number(liveCount)
    );

    setText(
      "ez-an-live-now",
      number(liveNow)
    );

    setText(
      "ez-an-campaigns",
      number(campaigns)
    );

    setText(
      "ez-an-impressions",
      number(impressions)
    );

    setText(
      "ez-an-clicks",
      number(clicks)
    );

    setText(
      "ez-an-ctr",
      percentage(ctr)
    );
  }

  function renderContentBars() {
    const container =
      document.getElementById(
        "ez-an-content-bars"
      );

    if (!container) {
      return;
    }

    const types = {
      news: "أخبار",
      report: "تقارير",
      interview: "مقابلات",
      video: "فيديو",
      coverage: "تغطيات",
      breaking: "عاجل"
    };

    const counts = {};

    Object.keys(types).forEach(
      type => {
        counts[type] = 0;
      }
    );

    state.content.forEach(
      item => {
        const type =
          item.content_type ||
          item.type ||
          "news";

        if (
          Object.prototype.hasOwnProperty.call(
            counts,
            type
          )
        ) {
          counts[type]++;
        }
      }
    );

    const max =
      Math.max(
        ...Object.values(counts),
        1
      );

    container.innerHTML =
      Object.entries(counts)
        .map(
          ([type, count]) => {
            const width =
              count === 0
                ? 0
                : Math.max(
                    (count / max) * 100,
                    4
                  );

            return `
              <div class="ez-an-bar-row">

                <div class="ez-an-bar-label">
                  ${escapeHtml(
                    types[type]
                  )}
                </div>

                <div class="ez-an-bar-track">
                  <div
                    class="ez-an-bar-fill"
                    style="width:${width}%"
                  ></div>
                </div>

                <div class="ez-an-bar-value">
                  ${number(count)}
                </div>

              </div>
            `;
          }
        )
        .join("");
  }

  function renderStatusBars() {
    const container =
      document.getElementById(
        "ez-an-status-bars"
      );

    if (!container) {
      return;
    }

    const statuses = {
      draft: "مسودة",
      review: "مراجعة",
      approved: "معتمد",
      scheduled: "مجدول",
      published: "منشور",
      archived: "مؤرشف"
    };

    const counts = {};

    Object.keys(statuses).forEach(
      status => {
        counts[status] = 0;
      }
    );

    state.content.forEach(
      item => {
        const status =
          item.status || "draft";

        if (
          Object.prototype.hasOwnProperty.call(
            counts,
            status
          )
        ) {
          counts[status]++;
        }
      }
    );

    const max =
      Math.max(
        ...Object.values(counts),
        1
      );

    container.innerHTML =
      Object.entries(counts)
        .map(
          ([status, count]) => {
            const width =
              count === 0
                ? 0
                : Math.max(
                    (count / max) * 100,
                    4
                  );

            return `
              <div class="ez-an-bar-row">

                <div class="ez-an-bar-label">
                  ${escapeHtml(
                    statuses[status]
                  )}
                </div>

                <div class="ez-an-bar-track">
                  <div
                    class="ez-an-bar-fill"
                    style="width:${width}%"
                  ></div>
                </div>

                <div class="ez-an-bar-value">
                  ${number(count)}
                </div>

              </div>
            `;
          }
        )
        .join("");
  }

  function renderRecentContent() {
    const container =
      document.getElementById(
        "ez-an-recent"
      );

    if (!container) {
      return;
    }

    const items =
      [...state.content]
        .sort(
          (a, b) =>
            new Date(
              b.updated_at ||
              b.created_at ||
              0
            ) -
            new Date(
              a.updated_at ||
              a.created_at ||
              0
            )
        )
        .slice(0, 6);

    if (!items.length) {
      container.innerHTML = `
        <div class="ez-an-loading">
          لا يوجد محتوى لعرضه حاليًا.
        </div>
      `;

      return;
    }

    container.innerHTML =
      items
        .map(
          (item, index) => {
            const title =
              item.title ||
              item.headline ||
              item.name ||
              "بدون عنوان";

            const type =
              item.content_type ||
              item.type ||
              "news";

            return `
              <div class="ez-an-rank">

                <div class="ez-an-rank-number">
                  ${index + 1}
                </div>

                <div>
                  <div class="ez-an-rank-title">
                    ${escapeHtml(title)}
                  </div>

                  <div class="ez-an-rank-meta">
                    ${escapeHtml(type)}
                  </div>
                </div>

                <div class="ez-an-rank-value">
                  ${escapeHtml(
                    item.status ||
                    "draft"
                  )}
                </div>

              </div>
            `;
          }
        )
        .join("");
  }

  function renderLiveSummary() {
    const container =
      document.getElementById(
        "ez-an-live-summary"
      );

    if (!container) {
      return;
    }

    const total =
      state.live.length;

    const live =
      state.live.filter(
        channel =>
          channel.status === "live"
      ).length;

    const testing =
      state.live.filter(
        channel =>
          channel.status === "testing"
      ).length;

    const offline =
      state.live.filter(
        channel =>
          channel.status === "offline"
      ).length;

    const disabled =
      state.live.filter(
        channel =>
          channel.status === "disabled"
      ).length;

    const rows = [
      ["إجمالي القنوات", total],
      ["مباشر الآن", live],
      ["اختبار", testing],
      ["متوقف", offline],
      ["معطل", disabled]
    ];

    container.innerHTML =
      rows
        .map(
          ([label, value], index) => `
            <div class="ez-an-rank">

              <div class="ez-an-rank-number">
                ${index + 1}
              </div>

              <div class="ez-an-rank-title">
                ${escapeHtml(label)}
              </div>

              <div class="ez-an-rank-value">
                ${number(value)}
              </div>

            </div>
          `
        )
        .join("");
  }

  function renderSystem(data) {
    const container =
      document.getElementById(
        "ez-an-system"
      );

    if (!container) {
      return;
    }

    const system =
      data?.system ||
      data?.data ||
      data ||
      {};

    const values = [
      [
        "المنصة",
        system.platform ||
        "EZ MEDIA"
      ],
      [
        "الإصدار",
        system.version ||
        "11.0.0"
      ],
      [
        "الحالة",
        system.status ||
        "غير محددة"
      ],
      [
        "البيئة",
        system.environment ||
        "production"
      ],
      [
        "Node.js",
        system.node ||
        system.server?.node ||
        "غير متاح"
      ],
      [
        "قاعدة البيانات",
        system.database?.connected
          ? "متصلة"
          : system.database?.configured
            ? "مهيأة"
            : "غير مهيأة"
      ]
    ];

    container.innerHTML =
      values
        .map(
          ([label, value]) => `
            <div class="ez-an-system-item">

              <div class="ez-an-system-label">
                ${escapeHtml(label)}
              </div>

              <div class="ez-an-system-value">
                ${escapeHtml(value)}
              </div>

            </div>
          `
        )
        .join("");
  }

  function setText(id, value) {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  async function generateSummary() {
    const content =
      state.content.length;

    const media =
      state.media.length;

    const live =
      state.live.length;

    const liveNow =
      state.live.filter(
        item =>
          item.status === "live"
      ).length;

    const commercial =
      state.commercial || {};

    const impressions =
      Number(
        commercial.impressions ||
        commercial.totalImpressions ||
        0
      );

    const clicks =
      Number(
        commercial.clicks ||
        commercial.totalClicks ||
        0
      );

    const ctr =
      impressions
        ? (clicks / impressions) * 100
        : 0;

    const summary = `
ملخص EZ MEDIA 11.0

المحتوى:
${number(content)} عنصر.

مكتبة الوسائط:
${number(media)} عنصر.

البث:
${number(live)} قناة، منها ${number(liveNow)} قناة مباشرة حاليًا.

النشاط التجاري:
${number(impressions)} انطباع،
${number(clicks)} نقرة،
ومعدل نقر ${percentage(ctr)}.

التحليل:
المنصة تجمع بين المحتوى التحريري والوسائط والبث
والنشاط التجاري في لوحة تشغيل موحدة.
    `.trim();

    showSummaryModal(summary);
  }

  function showSummaryModal(summary) {
    const existing =
      document.getElementById(
        "ez-an-summary-modal"
      );

    if (existing) {
      existing.remove();
    }

    const modal =
      document.createElement("div");

    modal.id =
      "ez-an-summary-modal";

    Object.assign(
      modal.style,
      {
        position:"fixed",
        inset:"0",
        zIndex:"999990",
        background:"rgba(13,51,76,.25)",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        padding:"18px",
        direction:"rtl"
      }
    );

    modal.innerHTML = `
      <div style="
        width:min(700px,100%);
        background:#fff;
        border:1px solid #dcebf4;
        border-radius:24px;
        box-shadow:0 25px 80px rgba(20,100,140,.20);
        padding:24px;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:center;
          margin-bottom:16px;
        ">

          <div>
            <div style="
              color:#2380a9;
              font-size:11px;
              font-weight:900;
              margin-bottom:5px;
            ">
              التحليل الذكي
            </div>

            <h3 style="
              margin:0;
              color:#17324d;
              font-size:21px;
            ">
              ملخص أداء المنصة
            </h3>
          </div>

          <button
            id="ez-an-summary-close"
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

        <textarea
          id="ez-an-summary-text"
          readonly
          style="
            width:100%;
            min-height:300px;
            resize:vertical;
            border:1px solid #dfedf5;
            border-radius:15px;
            padding:15px;
            background:#fbfdff;
            color:#31576c;
            line-height:1.9;
            font-family:inherit;
            outline:none;
          "
        >${escapeHtml(summary)}</textarea>

        <div style="
          display:flex;
          gap:8px;
          margin-top:12px;
        ">

          <button
            id="ez-an-summary-copy"
            style="
              min-height:42px;
              border:0;
              border-radius:12px;
              padding:0 15px;
              background:linear-gradient(135deg,#63c9f5,#39a8df);
              color:#fff;
              font-family:inherit;
              font-weight:900;
              cursor:pointer;
            "
          >
            نسخ الملخص
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById(
        "ez-an-summary-close"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    document
      .getElementById(
        "ez-an-summary-copy"
      )
      ?.addEventListener(
        "click",
        async () => {
          try {
            await navigator.clipboard.writeText(
              summary
            );

            notify(
              "تم نسخ الملخص.",
              "success"
            );
          } catch {
            notify(
              "تعذر النسخ التلقائي.",
              "error"
            );
          }
        }
      );

    modal.addEventListener(
      "click",
      event => {
        if (event.target === modal) {
          modal.remove();
        }
      }
    );
  }

  async function refresh() {
    state.loading = true;

    try {
      const [
        ,
        ,
        ,
        ,
        system
      ] = await Promise.all([
        loadContent(),
        loadMedia(),
        loadLive(),
        loadCommercial(),
        loadSystem()
      ]);

      renderOverview();
      renderContentBars();
      renderStatusBars();
      renderRecentContent();
      renderLiveSummary();
      renderSystem(system);

      notify(
        "تم تحديث التحليلات.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA analytics:",
        error
      );

      notify(
        error.message,
        "error"
      );
    } finally {
      state.loading = false;
    }
  }

  function initialize() {
    const container =
      getContainer();

    if (!container) {
      return false;
    }

    renderShell();
    refresh();

    return true;
  }

  window.EZMediaAdminAnalytics = {
    initialize,
    refresh,
    generateSummary,
    getState: () => ({
      ...state,
      content: [...state.content],
      media: [...state.media],
      live: [...state.live]
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
