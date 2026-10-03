"use strict";

/*
 * EZ MEDIA 11.0
 * مركز الإعلانات والرعايات والشراكات
 * الملف: public/admin-commercial.js
 */

(() => {
  const API = {
    campaigns: "/api/commercial/campaigns",
    statistics: "/api/commercial/statistics",
    placements: "/api/commercial/placements/active",
    events: "/api/commercial/events"
  };

  const state = {
    campaigns: [],
    placements: [],
    statistics: null,
    search: "",
    status: "",
    type: "",
    loading: false
  };

  const CAMPAIGN_TYPES = {
    advertising: "إعلان",
    sponsorship: "رعاية",
    partnership: "شراكة"
  };

  const CAMPAIGN_STATUSES = {
    draft: "مسودة",
    pending: "بانتظار الاعتماد",
    approved: "معتمدة",
    active: "نشطة",
    paused: "متوقفة",
    completed: "مكتملة",
    cancelled: "ملغاة"
  };

  const PLACEMENT_TYPES = {
    banner: "بانر",
    native: "إعلان أصلي",
    video: "فيديو",
    live: "بث مباشر",
    article: "مقال",
    section: "قسم",
    homepage: "الصفحة الرئيسية"
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

  function money(value, currency = "SAR") {
    const parsed = Number(value || 0);

    if (!Number.isFinite(parsed)) {
      return "0";
    }

    try {
      return new Intl.NumberFormat("ar-SA", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
      }).format(parsed);
    } catch {
      return `${number(parsed)} ${currency}`;
    }
  }

  function date(value) {
    if (!value) return "غير محدد";

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "غير محدد";
    }

    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(parsed);
  }

  function campaignTypeLabel(type) {
    return CAMPAIGN_TYPES[type] || type || "غير محدد";
  }

  function campaignStatusLabel(status) {
    return CAMPAIGN_STATUSES[status] || status || "غير محدد";
  }

  function placementTypeLabel(type) {
    return PLACEMENT_TYPES[type] || type || "غير محدد";
  }

  function statusClass(status) {
    return `ez-commercial-status-${String(status || "")
      .replace(/[^a-zA-Z0-9_-]/g, "")}`;
  }

  function notify(message, type = "info") {
    let box = document.getElementById(
      "ez-commercial-notification"
    );

    if (!box) {
      box = document.createElement("div");

      box.id = "ez-commercial-notification";

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
      document.getElementById("admin-commercial-section") ||
      document.getElementById("commercial-section") ||
      document.querySelector(
        '[data-admin-section="commercial"]'
      )
    );
  }

  function renderShell() {
    const container = getContainer();

    if (!container) {
      return null;
    }

    container.innerHTML = `
      <div id="ez-commercial-app" dir="rtl">

        <style>
          #ez-commercial-app {
            width:100%;
            color:#17324d;
            font-family:inherit;
          }

          #ez-commercial-app * {
            box-sizing:border-box;
          }

          .ez-commercial-header {
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:18px;
            flex-wrap:wrap;
            margin-bottom:20px;
          }

          .ez-commercial-badge {
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:8px 12px;
            border-radius:999px;
            background:#effaff;
            border:1px solid #d7effa;
            color:#207ba5;
            font-size:11px;
            font-weight:900;
            margin-bottom:9px;
          }

          .ez-commercial-badge-dot {
            width:7px;
            height:7px;
            border-radius:50%;
            background:#39b6e8;
            box-shadow:0 0 0 5px rgba(57,182,232,.10);
          }

          .ez-commercial-title {
            margin:0 0 6px;
            font-size:27px;
            font-weight:950;
            letter-spacing:-.4px;
          }

          .ez-commercial-subtitle {
            margin:0;
            color:#6d8799;
            font-size:13px;
            line-height:1.8;
          }

          .ez-commercial-actions {
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          }

          .ez-commercial-btn {
            min-height:42px;
            border:0;
            border-radius:13px;
            padding:0 15px;
            font-family:inherit;
            font-size:12px;
            font-weight:900;
            cursor:pointer;
            transition:.18s ease;
          }

          .ez-commercial-btn:hover {
            transform:translateY(-1px);
          }

          .ez-commercial-primary {
            color:#fff;
            background:linear-gradient(135deg,#63c9f5,#39a8df);
            box-shadow:0 10px 25px rgba(57,168,223,.18);
          }

          .ez-commercial-light {
            color:#2a769c;
            background:#f4fbff;
            border:1px solid #dceef7;
          }

          .ez-commercial-danger {
            color:#a14f4f;
            background:#fff8f8;
            border:1px solid #f0dada;
          }

          .ez-commercial-stats {
            display:grid;
            grid-template-columns:repeat(6,minmax(0,1fr));
            gap:11px;
            margin-bottom:17px;
          }

          .ez-commercial-stat {
            background:#fff;
            border:1px solid #e1edf5;
            border-radius:18px;
            padding:15px;
            box-shadow:0 7px 28px rgba(29,112,155,.05);
          }

          .ez-commercial-stat-label {
            color:#7891a3;
            font-size:11px;
            font-weight:800;
            margin-bottom:7px;
          }

          .ez-commercial-stat-value {
            color:#17324d;
            font-size:21px;
            font-weight:950;
          }

          .ez-commercial-toolbar {
            display:grid;
            grid-template-columns:1.6fr 1fr 1fr auto;
            gap:9px;
            margin-bottom:14px;
          }

          .ez-commercial-input,
          .ez-commercial-select {
            width:100%;
            min-height:44px;
            border:1px solid #dcebf4;
            border-radius:13px;
            background:#fff;
            color:#17324d;
            padding:0 12px;
            outline:none;
            font-family:inherit;
            font-size:12px;
          }

          .ez-commercial-input:focus,
          .ez-commercial-select:focus {
            border-color:#70c7ef;
            box-shadow:0 0 0 4px rgba(112,199,239,.10);
          }

          .ez-commercial-table-wrap {
            overflow-x:auto;
            background:#fff;
            border:1px solid #e1edf5;
            border-radius:20px;
            box-shadow:0 7px 28px rgba(29,112,155,.05);
          }

          .ez-commercial-table {
            width:100%;
            min-width:1000px;
            border-collapse:collapse;
          }

          .ez-commercial-table th {
            padding:13px 14px;
            background:#f6fbfe;
            border-bottom:1px solid #e3eef5;
            color:#6d8799;
            text-align:right;
            font-size:10px;
            font-weight:950;
            white-space:nowrap;
          }

          .ez-commercial-table td {
            padding:14px;
            border-bottom:1px solid #edf3f7;
            font-size:12px;
            vertical-align:middle;
          }

          .ez-commercial-table tr:last-child td {
            border-bottom:0;
          }

          .ez-commercial-name {
            font-weight:900;
            color:#17324d;
            line-height:1.55;
          }

          .ez-commercial-meta {
            margin-top:4px;
            color:#8aa0ae;
            font-size:10px;
          }

          .ez-commercial-type {
            display:inline-flex;
            padding:6px 9px;
            border-radius:9px;
            background:#eef9fe;
            color:#247aa3;
            font-size:10px;
            font-weight:900;
          }

          .ez-commercial-status {
            display:inline-flex;
            padding:6px 9px;
            border-radius:999px;
            font-size:10px;
            font-weight:900;
          }

          .ez-commercial-status-draft {
            background:#f2f6f9;
            color:#6d8292;
          }

          .ez-commercial-status-pending {
            background:#fff8df;
            color:#98721d;
          }

          .ez-commercial-status-approved {
            background:#edf6ff;
            color:#3673a4;
          }

          .ez-commercial-status-active {
            background:#eafaf3;
            color:#18805a;
          }

          .ez-commercial-status-paused {
            background:#fff6e9;
            color:#a66b1e;
          }

          .ez-commercial-status-completed {
            background:#eff4f8;
            color:#607989;
          }

          .ez-commercial-status-cancelled {
            background:#fff1f1;
            color:#a84d4d;
          }

          .ez-commercial-row-actions {
            display:flex;
            gap:5px;
            flex-wrap:wrap;
          }

          .ez-commercial-mini {
            border:1px solid #dcecf5;
            background:#fff;
            color:#33799c;
            border-radius:9px;
            padding:7px 9px;
            font-family:inherit;
            font-size:10px;
            font-weight:850;
            cursor:pointer;
          }

          .ez-commercial-mini:hover {
            background:#f3fbff;
          }

          .ez-commercial-empty,
          .ez-commercial-loading {
            padding:50px 20px;
            text-align:center;
            color:#7991a2;
          }

          .ez-commercial-empty strong {
            display:block;
            margin-bottom:6px;
            color:#38566d;
            font-size:16px;
          }

          .ez-commercial-footer {
            display:flex;
            justify-content:space-between;
            gap:10px;
            margin-top:12px;
            color:#8298a8;
            font-size:10px;
            flex-wrap:wrap;
          }

          .ez-commercial-section {
            margin-top:20px;
          }

          .ez-commercial-section-title {
            margin:0 0 10px;
            color:#284d64;
            font-size:16px;
            font-weight:950;
          }

          .ez-commercial-placement-grid {
            display:grid;
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:11px;
          }

          .ez-commercial-placement {
            background:#fff;
            border:1px solid #e1edf5;
            border-radius:18px;
            padding:15px;
            box-shadow:0 7px 28px rgba(29,112,155,.05);
          }

          .ez-commercial-placement-top {
            display:flex;
            justify-content:space-between;
            gap:10px;
            align-items:flex-start;
            margin-bottom:12px;
          }

          .ez-commercial-placement-name {
            font-weight:900;
            color:#17324d;
            font-size:13px;
          }

          .ez-commercial-placement-type {
            padding:5px 8px;
            border-radius:8px;
            background:#f0f9fd;
            color:#287ca2;
            font-size:9px;
            font-weight:900;
            white-space:nowrap;
          }

          .ez-commercial-placement-url {
            direction:ltr;
            text-align:left;
            color:#6f8b9d;
            font-size:10px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            margin-bottom:12px;
          }

          .ez-commercial-placement-stats {
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:7px;
          }

          .ez-commercial-placement-stat {
            background:#f8fcfe;
            border:1px solid #e7f0f5;
            border-radius:10px;
            padding:8px;
          }

          .ez-commercial-placement-stat span {
            display:block;
            color:#8499a7;
            font-size:9px;
            margin-bottom:4px;
          }

          .ez-commercial-placement-stat strong {
            color:#254c63;
            font-size:12px;
          }

          @media(max-width:1150px) {
            .ez-commercial-stats {
              grid-template-columns:repeat(3,minmax(0,1fr));
            }

            .ez-commercial-placement-grid {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }
          }

          @media(max-width:800px) {
            .ez-commercial-toolbar {
              grid-template-columns:1fr 1fr;
            }
          }

          @media(max-width:600px) {
            .ez-commercial-stats {
              grid-template-columns:repeat(2,minmax(0,1fr));
            }

            .ez-commercial-toolbar {
              grid-template-columns:1fr;
            }

            .ez-commercial-placement-grid {
              grid-template-columns:1fr;
            }

            .ez-commercial-title {
              font-size:22px;
            }
          }
        </style>

        <div class="ez-commercial-header">

          <div>
            <div class="ez-commercial-badge">
              <span class="ez-commercial-badge-dot"></span>
              المحرك التجاري الذكي
            </div>

            <h2 class="ez-commercial-title">
              الإعلانات والرعايات والشراكات
            </h2>

            <p class="ez-commercial-subtitle">
              إدارة الحملات التجارية ومواقع الإعلانات وقياس الأداء
              داخل منصة EZ MEDIA.
            </p>
          </div>

          <div class="ez-commercial-actions">
            <button
              class="ez-commercial-btn ez-commercial-light"
              id="ez-commercial-refresh"
            >
              تحديث
            </button>

            <button
              class="ez-commercial-btn ez-commercial-primary"
              id="ez-commercial-new"
            >
              + إنشاء حملة
            </button>
          </div>
        </div>

        <div class="ez-commercial-stats">

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              الحملات
            </div>
            <div
              class="ez-commercial-stat-value"
              id="ez-commercial-campaign-count"
            >
              0
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              الحملات النشطة
            </div>
            <div
              class="ez-commercial-stat-value"
              id="ez-commercial-active-count"
            >
              0
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              الميزانيات
            </div>
            <div
              class="ez-commercial-stat-value"
              id="ez-commercial-budget"
            >
              0
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              الانطباعات
            </div>
            <div
              class="ez-commercial-stat-value"
              id="ez-commercial-impressions"
            >
              0
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              النقرات
            </div>
            <div
              class="ez-commercial-stat-value"
              id="ez-commercial-clicks"
            >
              0
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              المشاهدات المكتملة
            </div>
            <div
              class="ez-commercial-stat-value"
              id="ez-commercial-completed"
            >
              0
            </div>
          </div>

        </div>

        <div class="ez-commercial-toolbar">

          <input
            id="ez-commercial-search"
            class="ez-commercial-input"
            type="search"
            placeholder="ابحث باسم الحملة أو المعلن أو الراعي..."
          />

          <select
            id="ez-commercial-type"
            class="ez-commercial-select"
          >
            <option value="">كل الأنواع</option>
            <option value="advertising">إعلان</option>
            <option value="sponsorship">رعاية</option>
            <option value="partnership">شراكة</option>
          </select>

          <select
            id="ez-commercial-status"
            class="ez-commercial-select"
          >
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="pending">بانتظار الاعتماد</option>
            <option value="approved">معتمدة</option>
            <option value="active">نشطة</option>
            <option value="paused">متوقفة</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغاة</option>
          </select>

          <button
            class="ez-commercial-btn ez-commercial-light"
            id="ez-commercial-reset"
          >
            تصفير
          </button>

        </div>

        <div class="ez-commercial-table-wrap">
          <div id="ez-commercial-table">
            <div class="ez-commercial-loading">
              جاري تحميل الحملات التجارية...
            </div>
          </div>
        </div>

        <div class="ez-commercial-section">
          <h3 class="ez-commercial-section-title">
            المواضع الإعلانية النشطة
          </h3>

          <div
            id="ez-commercial-placements"
            class="ez-commercial-placement-grid"
          >
            <div class="ez-commercial-loading">
              جاري تحميل المواضع...
            </div>
          </div>
        </div>

        <div class="ez-commercial-footer">
          <span id="ez-commercial-count">
            0 حملة
          </span>

          <span>
            EZ MEDIA 11.0 — Commercial Intelligence
          </span>
        </div>

      </div>
    `;

    bindEvents();

    return container;
  }

  function updateStatistics() {
    const statistics = state.statistics || {};

    const campaigns =
      statistics.campaigns ??
      statistics.totalCampaigns ??
      state.campaigns.length ??
      0;

    const active =
      statistics.activeCampaigns ??
      state.campaigns.filter(
        campaign => campaign.status === "active"
      ).length;

    const budget =
      statistics.totalBudget ??
      statistics.budget ??
      state.campaigns.reduce(
        (sum, campaign) =>
          sum + Number(campaign.budget || 0),
        0
      );

    const impressions =
      statistics.impressions ??
      statistics.totalImpressions ??
      state.campaigns.reduce(
        (sum, campaign) =>
          sum + Number(campaign.impressions || 0),
        0
      );

    const clicks =
      statistics.clicks ??
      statistics.totalClicks ??
      state.campaigns.reduce(
        (sum, campaign) =>
          sum + Number(campaign.clicks || 0),
        0
      );

    const completed =
      statistics.completed_views ??
      statistics.completedViews ??
      statistics.totalCompletedViews ??
      state.campaigns.reduce(
        (sum, campaign) =>
          sum + Number(campaign.completed_views || 0),
        0
      );

    setText(
      "ez-commercial-campaign-count",
      number(campaigns)
    );

    setText(
      "ez-commercial-active-count",
      number(active)
    );

    setText(
      "ez-commercial-budget",
      money(budget)
    );

    setText(
      "ez-commercial-impressions",
      number(impressions)
    );

    setText(
      "ez-commercial-clicks",
      number(clicks)
    );

    setText(
      "ez-commercial-completed",
      number(completed)
    );
  }

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  function filteredCampaigns() {
    const search = state.search.trim().toLowerCase();

    return state.campaigns.filter(campaign => {
      const name = String(
        campaign.name || ""
      ).toLowerCase();

      const advertiser = String(
        campaign.advertiser_name || ""
      ).toLowerCase();

      const sponsor = String(
        campaign.sponsor_name || ""
      ).toLowerCase();

      const matchesSearch =
        !search ||
        name.includes(search) ||
        advertiser.includes(search) ||
        sponsor.includes(search);

      const matchesType =
        !state.type ||
        campaign.campaign_type === state.type;

      const matchesStatus =
        !state.status ||
        campaign.status === state.status;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });
  }

  function renderCampaigns() {
    const container =
      document.getElementById("ez-commercial-table");

    const campaigns = filteredCampaigns();

    setText(
      "ez-commercial-count",
      `${campaigns.length} حملة من أصل ${state.campaigns.length}`
    );

    if (!container) {
      return;
    }

    if (!campaigns.length) {
      container.innerHTML = `
        <div class="ez-commercial-empty">
          <strong>لا توجد حملات</strong>
          لا توجد حملات مطابقة للفلاتر الحالية.
        </div>
      `;

      return;
    }

    container.innerHTML = `
      <table class="ez-commercial-table">

        <thead>
          <tr>
            <th>الحملة</th>
            <th>النوع</th>
            <th>المعلن / الراعي</th>
            <th>الميزانية</th>
            <th>الحالة</th>
            <th>الفترة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>

        <tbody>
          ${campaigns.map(renderCampaignRow).join("")}
        </tbody>

      </table>
    `;
  }

  function renderCampaignRow(campaign) {
    const id = escapeHtml(campaign.id);

    const name = escapeHtml(
      campaign.name || "حملة بدون اسم"
    );

    const type = campaign.campaign_type || "";

    const advertiser = escapeHtml(
      campaign.advertiser_name ||
      campaign.sponsor_name ||
      "غير محدد"
    );

    const budget = money(
      campaign.budget || 0,
      campaign.currency || "SAR"
    );

    const status = campaign.status || "draft";

    return `
      <tr>

        <td>
          <div class="ez-commercial-name">
            ${name}
          </div>

          <div class="ez-commercial-meta">
            ${id}
          </div>
        </td>

        <td>
          <span class="ez-commercial-type">
            ${escapeHtml(
              campaignTypeLabel(type)
            )}
          </span>
        </td>

        <td>
          ${advertiser}
        </td>

        <td>
          <strong>
            ${escapeHtml(budget)}
          </strong>
        </td>

        <td>
          <span
            class="ez-commercial-status ${statusClass(status)}"
          >
            ${escapeHtml(
              campaignStatusLabel(status)
            )}
          </span>
        </td>

        <td>
          <div>
            ${escapeHtml(
              date(campaign.start_at)
            )}
          </div>

          <div style="
            margin-top:4px;
            color:#8aa0ae;
            font-size:10px;
          ">
            إلى
            ${escapeHtml(
              date(campaign.end_at)
            )}
          </div>
        </td>

        <td>
          <div class="ez-commercial-row-actions">

            <button
              class="ez-commercial-mini"
              data-action="view"
              data-id="${id}"
            >
              عرض
            </button>

            <button
              class="ez-commercial-mini"
              data-action="edit"
              data-id="${id}"
            >
              تعديل
            </button>

            <button
              class="ez-commercial-mini"
              data-action="placements"
              data-id="${id}"
            >
              المواضع
            </button>

            <button
              class="ez-commercial-mini"
              data-action="delete"
              data-id="${id}"
            >
              حذف
            </button>

          </div>
        </td>

      </tr>
    `;
  }

  async function loadCampaigns() {
    try {
      const data = await request(
        `${API.campaigns}?limit=100`
      );

      state.campaigns = normalizeList(
        data,
        ["campaigns", "items"]
      );

      updateStatistics();
      renderCampaigns();
    } catch (error) {
      console.error(
        "EZ MEDIA commercial campaigns:",
        error
      );

      state.campaigns = [];

      const container =
        document.getElementById("ez-commercial-table");

      if (container) {
        container.innerHTML = `
          <div class="ez-commercial-empty">
            <strong>تعذر تحميل الحملات</strong>
            ${escapeHtml(error.message)}
          </div>
        `;
      }

      notify(error.message, "error");
    }
  }

  async function loadStatistics() {
    try {
      const data = await request(
        API.statistics
      );

      state.statistics =
        data?.statistics ||
        data?.data ||
        data ||
        {};

      updateStatistics();
    } catch (error) {
      console.warn(
        "Commercial statistics:",
        error
      );

      updateStatistics();
    }
  }

  async function loadPlacements() {
    const container =
      document.getElementById(
        "ez-commercial-placements"
      );

    try {
      const data = await request(
        API.placements
      );

      state.placements = normalizeList(
        data,
        ["placements", "items"]
      );

      renderPlacements();
    } catch (error) {
      console.warn(
        "Commercial placements:",
        error
      );

      state.placements = [];

      if (container) {
        container.innerHTML = `
          <div class="ez-commercial-empty">
            <strong>تعذر تحميل المواضع</strong>
            ${escapeHtml(error.message)}
          </div>
        `;
      }
    }
  }

  function renderPlacements() {
    const container =
      document.getElementById(
        "ez-commercial-placements"
      );

    if (!container) {
      return;
    }

    if (!state.placements.length) {
      container.innerHTML = `
        <div class="ez-commercial-empty">
          <strong>لا توجد مواضع إعلانية نشطة</strong>
          ستظهر هنا المواضع المرتبطة بالحملات النشطة.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.placements
        .map(placement => {
          const impressions =
            Number(
              placement.impressions || 0
            );

          const clicks =
            Number(
              placement.clicks || 0
            );

          const completed =
            Number(
              placement.completed_views || 0
            );

          return `
            <div class="ez-commercial-placement">

              <div class="ez-commercial-placement-top">

                <div class="ez-commercial-placement-name">
                  ${escapeHtml(
                    placement.title ||
                    placement.placement_key ||
                    "موضع إعلاني"
                  )}
                </div>

                <div class="ez-commercial-placement-type">
                  ${escapeHtml(
                    placementTypeLabel(
                      placement.placement_type
                    )
                  )}
                </div>

              </div>

              <div class="ez-commercial-placement-url">
                ${escapeHtml(
                  placement.destination_url ||
                  placement.image_url ||
                  placement.video_url ||
                  placement.placement_key ||
                  ""
                )}
              </div>

              <div class="ez-commercial-placement-stats">

                <div class="ez-commercial-placement-stat">
                  <span>انطباعات</span>
                  <strong>
                    ${number(impressions)}
                  </strong>
                </div>

                <div class="ez-commercial-placement-stat">
                  <span>نقرات</span>
                  <strong>
                    ${number(clicks)}
                  </strong>
                </div>

                <div class="ez-commercial-placement-stat">
                  <span>مكتملة</span>
                  <strong>
                    ${number(completed)}
                  </strong>
                </div>

              </div>

            </div>
          `;
        })
        .join("");
  }

  function openCampaign(id) {
    const campaign =
      state.campaigns.find(
        item =>
          String(item.id) === String(id)
      );

    if (!campaign) {
      notify(
        "لم يتم العثور على الحملة.",
        "error"
      );

      return;
    }

    showCampaignModal(
      campaign,
      false
    );
  }

  function editCampaign(id) {
    const campaign =
      state.campaigns.find(
        item =>
          String(item.id) === String(id)
      );

    if (!campaign) {
      notify(
        "لم يتم العثور على الحملة.",
        "error"
      );

      return;
    }

    showCampaignModal(
      campaign,
      true
    );
  }

  function createCampaign() {
    showCampaignModal(
      null,
      true
    );
  }

  function showCampaignModal(
    campaign,
    editable
  ) {
    const existing =
      document.getElementById(
        "ez-commercial-modal"
      );

    if (existing) {
      existing.remove();
    }

    const isEdit = Boolean(
      campaign?.id
    );

    const modal =
      document.createElement("div");

    modal.id =
      "ez-commercial-modal";

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
        width:min(760px,100%);
        max-height:92vh;
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
          margin-bottom:20px;
        ">

          <div>
            <div style="
              color:#2380a9;
              font-size:11px;
              font-weight:900;
              margin-bottom:6px;
            ">
              ${isEdit ? "تعديل حملة" : "حملة تجارية جديدة"}
            </div>

            <h3 style="
              margin:0;
              color:#17324d;
              font-size:22px;
            ">
              ${isEdit ? "بيانات الحملة" : "إنشاء حملة جديدة"}
            </h3>
          </div>

          <button
            id="ez-commercial-modal-close"
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

        <form id="ez-commercial-form">

          <div style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:11px;
          ">

            ${field(
              "name",
              "اسم الحملة",
              campaign?.name || "",
              "text",
              true
            )}

            <div>
              <label style="
                display:block;
                margin-bottom:6px;
                color:#6d8799;
                font-size:11px;
                font-weight:900;
              ">
                نوع الحملة
              </label>

              <select
                name="campaign_type"
                style="
                  width:100%;
                  min-height:44px;
                  border:1px solid #dcebf4;
                  border-radius:13px;
                  padding:0 12px;
                  font-family:inherit;
                  color:#17324d;
                  background:#fff;
                "
              >
                <option
                  value="advertising"
                  ${campaign?.campaign_type === "advertising" ? "selected" : ""}
                >
                  إعلان
                </option>

                <option
                  value="sponsorship"
                  ${campaign?.campaign_type === "sponsorship" ? "selected" : ""}
                >
                  رعاية
                </option>

                <option
                  value="partnership"
                  ${campaign?.campaign_type === "partnership" ? "selected" : ""}
                >
                  شراكة
                </option>
              </select>
            </div>

            ${field(
              "advertiser_name",
              "اسم المعلن",
              campaign?.advertiser_name || ""
            )}

            ${field(
              "sponsor_name",
              "اسم الراعي",
              campaign?.sponsor_name || ""
            )}

            ${field(
              "contact_name",
              "اسم جهة الاتصال",
              campaign?.contact_name || ""
            )}

            ${field(
              "contact_email",
              "البريد الإلكتروني",
              campaign?.contact_email || "",
              "email"
            )}

            ${field(
              "contact_phone",
              "رقم التواصل",
              campaign?.contact_phone || "",
              "tel"
            )}

            ${field(
              "budget",
              "الميزانية",
              campaign?.budget || "",
              "number"
            )}

            ${field(
              "currency",
              "العملة",
              campaign?.currency || "SAR"
            )}

            ${field(
              "start_at",
              "بداية الحملة",
              toDateTimeLocal(campaign?.start_at),
              "datetime-local"
            )}

            ${field(
              "end_at",
              "نهاية الحملة",
              toDateTimeLocal(campaign?.end_at),
              "datetime-local"
            )}

            ${field(
              "priority",
              "الأولوية",
              campaign?.priority ?? 0,
              "number"
            )}

          </div>

          <div style="margin-top:11px;">
            <label style="
              display:block;
              margin-bottom:6px;
              color:#6d8799;
              font-size:11px;
              font-weight:900;
            ">
              الوصف
            </label>

            <textarea
              name="description"
              rows="4"
              style="
                width:100%;
                border:1px solid #dcebf4;
                border-radius:13px;
                padding:12px;
                resize:vertical;
                font-family:inherit;
                color:#17324d;
                outline:none;
              "
            >${escapeHtml(
              campaign?.description || ""
            )}</textarea>
          </div>

          <div style="margin-top:11px;">
            <label style="
              display:block;
              margin-bottom:6px;
              color:#6d8799;
              font-size:11px;
              font-weight:900;
            ">
              الاستهداف — JSON اختياري
            </label>

            <textarea
              name="targeting"
              rows="3"
              placeholder='{"device":"mobile","language":"ar"}'
              style="
                width:100%;
                border:1px solid #dcebf4;
                border-radius:13px;
                padding:12px;
                resize:vertical;
                font-family:monospace;
                direction:ltr;
                text-align:left;
                color:#17324d;
                outline:none;
              "
            >${escapeHtml(
              stringifyJson(
                campaign?.targeting
              )
            )}</textarea>
          </div>

          <div style="
            display:flex;
            justify-content:flex-start;
            gap:8px;
            margin-top:20px;
          ">

            <button
              type="submit"
              class="ez-commercial-btn ez-commercial-primary"
            >
              ${isEdit ? "حفظ التعديلات" : "إنشاء الحملة"}
            </button>

            <button
              type="button"
              id="ez-commercial-cancel"
              class="ez-commercial-btn ez-commercial-light"
            >
              إلغاء
            </button>

          </div>

        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById(
        "ez-commercial-modal-close"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    document
      .getElementById(
        "ez-commercial-cancel"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    modal.addEventListener(
      "click",
      event => {
        if (event.target === modal) {
          modal.remove();
        }
      }
    );

    document
      .getElementById(
        "ez-commercial-form"
      )
      ?.addEventListener(
        "submit",
        async event => {
          event.preventDefault();

          await saveCampaign(
            campaign,
            new FormData(event.currentTarget),
            modal
          );
        }
      );
  }

  function field(
    name,
    label,
    value = "",
    type = "text",
    required = false
  ) {
    return `
      <div>
        <label style="
          display:block;
          margin-bottom:6px;
          color:#6d8799;
          font-size:11px;
          font-weight:900;
        ">
          ${escapeHtml(label)}
        </label>

        <input
          name="${escapeHtml(name)}"
          type="${escapeHtml(type)}"
          value="${escapeHtml(value)}"
          ${required ? "required" : ""}
          style="
            width:100%;
            min-height:44px;
            border:1px solid #dcebf4;
            border-radius:13px;
            padding:0 12px;
            font-family:inherit;
            color:#17324d;
            background:#fff;
            outline:none;
          "
        />
      </div>
    `;
  }

  function toDateTimeLocal(value) {
    if (!value) {
      return "";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    const year =
      parsed.getFullYear();

    const month =
      String(
        parsed.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        parsed.getDate()
      ).padStart(2, "0");

    const hours =
      String(
        parsed.getHours()
      ).padStart(2, "0");

    const minutes =
      String(
        parsed.getMinutes()
      ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function stringifyJson(value) {
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(
        value,
        null,
        2
      );
    } catch {
      return "";
    }
  }

  async function saveCampaign(
    original,
    formData,
    modal
  ) {
    const payload = {
      name: formData.get("name"),
      campaign_type:
        formData.get("campaign_type"),
      advertiser_name:
        formData.get("advertiser_name") || null,
      sponsor_name:
        formData.get("sponsor_name") || null,
      contact_name:
        formData.get("contact_name") || null,
      contact_email:
        formData.get("contact_email") || null,
      contact_phone:
        formData.get("contact_phone") || null,
      description:
        formData.get("description") || null,
      budget:
        formData.get("budget")
          ? Number(formData.get("budget"))
          : null,
      currency:
        formData.get("currency") || "SAR",
      start_at:
        formData.get("start_at") || null,
      end_at:
        formData.get("end_at") || null,
      priority:
        formData.get("priority")
          ? Number(formData.get("priority"))
          : 0
    };

    const targetingText =
      formData.get("targeting");

    if (targetingText) {
      try {
        payload.targeting =
          JSON.parse(targetingText);
      } catch {
        notify(
          "صيغة الاستهداف JSON غير صحيحة.",
          "error"
        );

        return;
      }
    }

    try {
      if (original?.id) {
        await request(
          `${API.campaigns}/${encodeURIComponent(original.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );

        notify(
          "تم تحديث الحملة بنجاح.",
          "success"
        );
      } else {
        await request(
          API.campaigns,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );

        notify(
          "تم إنشاء الحملة بنجاح.",
          "success"
        );
      }

      modal.remove();

      await Promise.all([
        loadCampaigns(),
        loadStatistics(),
        loadPlacements()
      ]);
    } catch (error) {
      notify(
        error.message,
        "error"
      );
    }
  }

  async function deleteCampaign(id) {
    const campaign =
      state.campaigns.find(
        item =>
          String(item.id) === String(id)
      );

    if (!campaign) {
      notify(
        "الحملة غير موجودة.",
        "error"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `هل تريد حذف الحملة "${campaign.name}"؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `${API.campaigns}/${encodeURIComponent(id)}`,
        {
          method: "DELETE"
        }
      );

      notify(
        "تم حذف الحملة.",
        "success"
      );

      await Promise.all([
        loadCampaigns(),
        loadStatistics(),
        loadPlacements()
      ]);
    } catch (error) {
      notify(
        error.message,
        "error"
      );
    }
  }

  function showPlacements(id) {
    const campaign =
      state.campaigns.find(
        item =>
          String(item.id) === String(id)
      );

    if (!campaign) {
      notify(
        "الحملة غير موجودة.",
        "error"
      );

      return;
    }

    loadCampaignPlacements(
      campaign
    );
  }

  async function loadCampaignPlacements(
    campaign
  ) {
    try {
      const data = await request(
        `${API.campaigns}/${encodeURIComponent(campaign.id)}/placements`
      );

      const placements =
        normalizeList(
          data,
          ["placements", "items"]
        );

      showCampaignPlacementsModal(
        campaign,
        placements
      );
    } catch (error) {
      notify(
        error.message,
        "error"
      );
    }
  }

  function showCampaignPlacementsModal(
    campaign,
    placements
  ) {
    const existing =
      document.getElementById(
        "ez-commercial-placement-modal"
      );

    if (existing) {
      existing.remove();
    }

    const modal =
      document.createElement("div");

    modal.id =
      "ez-commercial-placement-modal";

    Object.assign(
      modal.style,
      {
        position:"fixed",
        inset:"0",
        zIndex:"999991",
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
        width:min(850px,100%);
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
          align-items:flex-start;
          gap:15px;
          margin-bottom:18px;
        ">

          <div>
            <div style="
              color:#2380a9;
              font-size:11px;
              font-weight:900;
              margin-bottom:5px;
            ">
              المواضع الإعلانية
            </div>

            <h3 style="
              margin:0;
              color:#17324d;
              font-size:20px;
            ">
              ${escapeHtml(
                campaign.name
              )}
            </h3>
          </div>

          <button
            id="ez-commercial-placement-close"
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

        ${
          placements.length
            ? `
              <div style="
                display:grid;
                gap:10px;
              ">
                ${placements
                  .map(
                    placement => `
                      <div style="
                        border:1px solid #e4eef5;
                        border-radius:15px;
                        padding:14px;
                        background:#fbfdff;
                      ">

                        <div style="
                          display:flex;
                          justify-content:space-between;
                          gap:10px;
                          margin-bottom:8px;
                        ">

                          <strong style="
                            color:#17324d;
                          ">
                            ${escapeHtml(
                              placement.title ||
                              placement.placement_key ||
                              "موضع"
                            )}
                          </strong>

                          <span style="
                            background:#eef9fe;
                            color:#247aa3;
                            padding:5px 8px;
                            border-radius:8px;
                            font-size:10px;
                            font-weight:900;
                          ">
                            ${escapeHtml(
                              placementTypeLabel(
                                placement.placement_type
                              )
                            )}
                          </span>

                        </div>

                        <div style="
                          color:#7891a3;
                          font-size:11px;
                          line-height:1.8;
                        ">
                          الانطباعات:
                          ${number(
                            placement.impressions
                          )}
                          —
                          النقرات:
                          ${number(
                            placement.clicks
                          )}
                          —
                          المكتملة:
                          ${number(
                            placement.completed_views
                          )}
                        </div>

                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div style="
                padding:40px 20px;
                text-align:center;
                color:#7991a2;
              ">
                لا توجد مواضع مرتبطة بهذه الحملة.
              </div>
            `
        }

      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById(
        "ez-commercial-placement-close"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
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

  function bindEvents() {
    document
      .getElementById(
        "ez-commercial-refresh"
      )
      ?.addEventListener(
        "click",
        refresh
      );

    document
      .getElementById(
        "ez-commercial-new"
      )
      ?.addEventListener(
        "click",
        createCampaign
      );

    document
      .getElementById(
        "ez-commercial-search"
      )
      ?.addEventListener(
        "input",
        event => {
          state.search =
            event.target.value;

          renderCampaigns();
        }
      );

    document
      .getElementById(
        "ez-commercial-type"
      )
      ?.addEventListener(
        "change",
        event => {
          state.type =
            event.target.value;

          renderCampaigns();
        }
      );

    document
      .getElementById(
        "ez-commercial-status"
      )
      ?.addEventListener(
        "change",
        event => {
          state.status =
            event.target.value;

          renderCampaigns();
        }
      );

    document
      .getElementById(
        "ez-commercial-reset"
      )
      ?.addEventListener(
        "click",
        () => {
          state.search = "";
          state.type = "";
          state.status = "";

          const search =
            document.getElementById(
              "ez-commercial-search"
            );

          const type =
            document.getElementById(
              "ez-commercial-type"
            );

          const status =
            document.getElementById(
              "ez-commercial-status"
            );

          if (search) {
            search.value = "";
          }

          if (type) {
            type.value = "";
          }

          if (status) {
            status.value = "";
          }

          renderCampaigns();
        }
      );

    document.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "#ez-commercial-app [data-action]"
          );

        if (!button) {
          return;
        }

        const action =
          button.dataset.action;

        const id =
          button.dataset.id;

        if (!id) {
          return;
        }

        if (action === "view") {
          openCampaign(id);
        }

        if (action === "edit") {
          editCampaign(id);
        }

        if (action === "placements") {
          showPlacements(id);
        }

        if (action === "delete") {
          deleteCampaign(id);
        }
      }
    );
  }

  async function refresh() {
    state.loading = true;

    try {
      await Promise.all([
        loadCampaigns(),
        loadStatistics(),
        loadPlacements()
      ]);
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

  window.EZMediaAdminCommercial = {
    initialize,
    refresh,
    getState: () => ({
      ...state,
      campaigns: [...state.campaigns],
      placements: [...state.placements]
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
