"use strict";

(() => {
  const API = {
    campaigns: "/api/commercial/campaigns",
    statistics: "/api/commercial/statistics",
    activePlacements: "/api/commercial/placements/active",
    events: "/api/commercial/events"
  };

  const state = {
    campaigns: [],
    statistics: null,
    placements: [],
    filter: "all",
    search: "",
    loading: false
  };

  const selectors = [
    "#admin-commercial-section",
    "#commercial-section",
    "[data-admin-section='commercial']"
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

  function formatNumber(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("ar-SA").format(number);
  }

  function formatMoney(value, currency = "SAR") {
    const number = Number(value || 0);

    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency
    }).format(number);
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
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
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

  function normalizeList(data) {
    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.campaigns)) {
      return data.campaigns;
    }

    if (Array.isArray(data?.placements)) {
      return data.placements;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }

  function statusLabel(status) {
    const labels = {
      draft: "مسودة",
      pending: "بانتظار الاعتماد",
      approved: "معتمدة",
      active: "نشطة",
      paused: "متوقفة مؤقتًا",
      completed: "مكتملة",
      cancelled: "ملغاة",
      expired: "منتهية"
    };

    return labels[status] || status || "غير محدد";
  }

  function statusClass(status) {
    return `status-${String(status || "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "")}`;
  }

  function typeLabel(type) {
    const labels = {
      advertising: "إعلان",
      sponsorship: "رعاية",
      partnership: "شراكة"
    };

    return labels[type] || type || "تجاري";
  }

  function filteredCampaigns() {
    const search = state.search.trim().toLowerCase();

    return state.campaigns.filter((campaign) => {
      const matchesStatus =
        state.filter === "all" ||
        campaign.status === state.filter;

      if (!matchesStatus) return false;

      if (!search) return true;

      const text = [
        campaign.name,
        campaign.advertiser_name,
        campaign.sponsor_name,
        campaign.contact_name,
        campaign.description,
        campaign.campaign_type,
        campaign.status
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
        #ez-commercial-admin {
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

        #ez-commercial-admin * {
          box-sizing: border-box;
        }

        #ez-commercial-admin .commercial-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px;
          margin-bottom: 18px;
          border: 1px solid #d9edf8;
          border-radius: 22px;
          background:
            linear-gradient(
              135deg,
              #ffffff 0%,
              #f5fbff 55%,
              #eaf8ff 100%
            );
          box-shadow: 0 12px 35px rgba(80, 170, 220, 0.10);
        }

        #ez-commercial-admin .title-area h2 {
          margin: 0 0 7px;
          font-size: 25px;
          font-weight: 800;
        }

        #ez-commercial-admin .title-area p {
          margin: 0;
          color: #668399;
          line-height: 1.7;
        }

        #ez-commercial-admin .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        #ez-commercial-admin button {
          border: 0;
          border-radius: 13px;
          padding: 11px 16px;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
          transition: 0.2s ease;
        }

        #ez-commercial-admin button:hover {
          transform: translateY(-1px);
        }

        #ez-commercial-admin .primary {
          background: #39bce9;
          color: #ffffff;
          box-shadow: 0 7px 20px rgba(57, 188, 233, 0.25);
        }

        #ez-commercial-admin .secondary {
          background: #edf9fe;
          color: #167fa8;
          border: 1px solid #cbeefa;
        }

        #ez-commercial-admin .danger {
          background: #fff0f1;
          color: #b52e3e;
          border: 1px solid #ffd2d6;
        }

        #ez-commercial-admin .stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        #ez-commercial-admin .stat {
          min-height: 125px;
          padding: 18px;
          border: 1px solid #dceef7;
          border-radius: 19px;
          background: #ffffff;
          box-shadow: 0 9px 25px rgba(70, 160, 210, 0.07);
        }

        #ez-commercial-admin .stat-label {
          color: #7590a2;
          font-size: 13px;
          margin-bottom: 11px;
        }

        #ez-commercial-admin .stat-value {
          font-size: 28px;
          font-weight: 850;
          color: #167fa8;
        }

        #ez-commercial-admin .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          padding: 14px;
          margin-bottom: 16px;
          background: #ffffff;
          border: 1px solid #dceef7;
          border-radius: 18px;
        }

        #ez-commercial-admin input,
        #ez-commercial-admin select,
        #ez-commercial-admin textarea {
          width: 100%;
          border: 1px solid #cfe6f1;
          border-radius: 12px;
          background: #ffffff;
          color: #16384f;
          padding: 11px 13px;
          font: inherit;
          outline: none;
        }

        #ez-commercial-admin input:focus,
        #ez-commercial-admin select:focus,
        #ez-commercial-admin textarea:focus {
          border-color: #62c9ed;
          box-shadow: 0 0 0 3px rgba(98, 201, 237, 0.12);
        }

        #ez-commercial-admin .search {
          flex: 1;
          min-width: 230px;
        }

        #ez-commercial-admin .campaign-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        #ez-commercial-admin .campaign-card {
          padding: 18px;
          border: 1px solid #dceef7;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(70, 160, 210, 0.06);
        }

        #ez-commercial-admin .campaign-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        #ez-commercial-admin .campaign-name {
          font-size: 18px;
          font-weight: 800;
          color: #173c55;
        }

        #ez-commercial-admin .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 9px;
          border-radius: 999px;
          background: #edf9fe;
          color: #1680aa;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        #ez-commercial-admin .badge.status-active {
          background: #e9fbf4;
          color: #14805a;
        }

        #ez-commercial-admin .badge.status-paused {
          background: #fff8e8;
          color: #9b6b12;
        }

        #ez-commercial-admin .badge.status-completed {
          background: #f0f3f5;
          color: #657984;
        }

        #ez-commercial-admin .badge.status-cancelled {
          background: #fff0f1;
          color: #b52e3e;
        }

        #ez-commercial-admin .campaign-meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 15px;
        }

        #ez-commercial-admin .meta-item {
          padding: 10px;
          border-radius: 12px;
          background: #f7fcff;
        }

        #ez-commercial-admin .meta-label {
          display: block;
          color: #7a92a1;
          font-size: 11px;
          margin-bottom: 5px;
        }

        #ez-commercial-admin .meta-value {
          color: #21455d;
          font-weight: 750;
          font-size: 13px;
        }

        #ez-commercial-admin .description {
          color: #667f90;
          line-height: 1.7;
          margin-bottom: 15px;
          min-height: 48px;
        }

        #ez-commercial-admin .campaign-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        #ez-commercial-admin .empty {
          padding: 50px 20px;
          text-align: center;
          border: 1px dashed #bcddea;
          border-radius: 20px;
          color: #78909e;
          background: #fbfeff;
        }

        #ez-commercial-admin .loading {
          padding: 40px;
          text-align: center;
          color: #4f8199;
        }

        #ez-commercial-admin .error {
          padding: 16px;
          margin-bottom: 16px;
          border-radius: 14px;
          background: #fff1f2;
          color: #a82e3c;
          border: 1px solid #ffd4d8;
        }

        #ez-commercial-admin .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(18, 48, 74, 0.35);
          backdrop-filter: blur(8px);
        }

        #ez-commercial-admin .modal-backdrop.open {
          display: flex;
        }

        #ez-commercial-admin .modal {
          width: min(720px, 100%);
          max-height: 92vh;
          overflow: auto;
          padding: 22px;
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 30px 80px rgba(20, 80, 110, 0.22);
        }

        #ez-commercial-admin .modal h3 {
          margin: 0 0 18px;
        }

        #ez-commercial-admin .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        #ez-commercial-admin .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        #ez-commercial-admin .field.full {
          grid-column: 1 / -1;
        }

        #ez-commercial-admin .field label {
          font-size: 12px;
          color: #6d8797;
          font-weight: 700;
        }

        #ez-commercial-admin .modal-actions {
          display: flex;
          justify-content: flex-start;
          gap: 9px;
          margin-top: 18px;
        }

        @media (max-width: 1000px) {
          #ez-commercial-admin .stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          #ez-commercial-admin .campaign-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          #ez-commercial-admin .commercial-header {
            flex-direction: column;
            align-items: stretch;
          }

          #ez-commercial-admin .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          #ez-commercial-admin .form-grid,
          #ez-commercial-admin .campaign-meta {
            grid-template-columns: 1fr;
          }

          #ez-commercial-admin .field.full {
            grid-column: auto;
          }
        }
      </style>

      <div id="ez-commercial-admin">
        <div class="commercial-header">
          <div class="title-area">
            <h2>المركز التجاري الذكي</h2>
            <p>
              إدارة الإعلانات والرعايات والشراكات والحملات التجارية
              وقياس أدائها داخل EZ MEDIA.
            </p>
          </div>

          <div class="actions">
            <button class="secondary" id="commercial-refresh">
              تحديث البيانات
            </button>

            <button class="primary" id="commercial-new">
              + حملة جديدة
            </button>
          </div>
        </div>

        <div id="commercial-error"></div>

        <div class="stats" id="commercial-stats"></div>

        <div class="toolbar">
          <input
            id="commercial-search"
            class="search"
            type="search"
            placeholder="ابحث عن حملة أو معلن أو راعٍ..."
          />

          <select id="commercial-filter">
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="pending">بانتظار الاعتماد</option>
            <option value="approved">معتمدة</option>
            <option value="active">نشطة</option>
            <option value="paused">متوقفة مؤقتًا</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>

        <div id="commercial-list"></div>

        <div class="modal-backdrop" id="commercial-modal-backdrop">
          <div class="modal">
            <h3 id="commercial-modal-title">حملة تجارية جديدة</h3>

            <form id="commercial-form">
              <input type="hidden" id="commercial-id">

              <div class="form-grid">
                <div class="field">
                  <label>اسم الحملة</label>
                  <input id="commercial-name" required>
                </div>

                <div class="field">
                  <label>نوع الحملة</label>
                  <select id="commercial-type">
                    <option value="advertising">إعلان</option>
                    <option value="sponsorship">رعاية</option>
                    <option value="partnership">شراكة</option>
                  </select>
                </div>

                <div class="field">
                  <label>اسم المعلن</label>
                  <input id="commercial-advertiser">
                </div>

                <div class="field">
                  <label>اسم الراعي</label>
                  <input id="commercial-sponsor">
                </div>

                <div class="field">
                  <label>جهة الاتصال</label>
                  <input id="commercial-contact">
                </div>

                <div class="field">
                  <label>البريد الإلكتروني</label>
                  <input id="commercial-email" type="email">
                </div>

                <div class="field">
                  <label>رقم الهاتف</label>
                  <input id="commercial-phone">
                </div>

                <div class="field">
                  <label>الميزانية</label>
                  <input id="commercial-budget" type="number" min="0" step="0.01">
                </div>

                <div class="field">
                  <label>العملة</label>
                  <select id="commercial-currency">
                    <option value="SAR">ريال سعودي</option>
                    <option value="USD">دولار أمريكي</option>
                    <option value="AED">درهم إماراتي</option>
                    <option value="KWD">دينار كويتي</option>
                    <option value="BHD">دينار بحريني</option>
                    <option value="QAR">ريال قطري</option>
                    <option value="OMR">ريال عماني</option>
                  </select>
                </div>

                <div class="field">
                  <label>الأولوية</label>
                  <input id="commercial-priority" type="number" min="0" value="0">
                </div>

                <div class="field">
                  <label>تاريخ البداية</label>
                  <input id="commercial-start" type="datetime-local">
                </div>

                <div class="field">
                  <label>تاريخ النهاية</label>
                  <input id="commercial-end" type="datetime-local">
                </div>

                <div class="field full">
                  <label>الوصف</label>
                  <textarea id="commercial-description" rows="4"></textarea>
                </div>
              </div>

              <div class="modal-actions">
                <button type="submit" class="primary">
                  حفظ الحملة
                </button>

                <button type="button" class="secondary" id="commercial-cancel">
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

  function renderStats() {
    const element = document.querySelector("#commercial-stats");

    if (!element) return;

    const statistics = state.statistics || {};

    const campaigns = Array.isArray(state.campaigns)
      ? state.campaigns
      : [];

    const activeCampaigns = campaigns.filter(
      (campaign) => campaign.status === "active"
    ).length;

    const totalBudget = campaigns.reduce(
      (sum, campaign) => sum + Number(campaign.budget || 0),
      0
    );

    const impressions = Number(
      statistics.impressions ||
      statistics.total_impressions ||
      0
    );

    const clicks = Number(
      statistics.clicks ||
      statistics.total_clicks ||
      0
    );

    element.innerHTML = `
      <div class="stat">
        <div class="stat-label">إجمالي الحملات</div>
        <div class="stat-value">${formatNumber(campaigns.length)}</div>
      </div>

      <div class="stat">
        <div class="stat-label">الحملات النشطة</div>
        <div class="stat-value">${formatNumber(activeCampaigns)}</div>
      </div>

      <div class="stat">
        <div class="stat-label">إجمالي الميزانيات</div>
        <div class="stat-value">${formatMoney(totalBudget)}</div>
      </div>

      <div class="stat">
        <div class="stat-label">الظهور</div>
        <div class="stat-value">${formatNumber(impressions)}</div>
      </div>

      <div class="stat">
        <div class="stat-label">النقرات</div>
        <div class="stat-value">${formatNumber(clicks)}</div>
      </div>
    `;
  }

  function renderCampaigns() {
    const element = document.querySelector("#commercial-list");

    if (!element) return;

    const campaigns = filteredCampaigns();

    if (!campaigns.length) {
      element.innerHTML = `
        <div class="empty">
          لا توجد حملات تجارية مطابقة للبحث أو الفلتر الحالي.
        </div>
      `;
      return;
    }

    element.innerHTML = `
      <div class="campaign-grid">
        ${campaigns.map((campaign) => {
          const status = campaign.status || "draft";

          return `
            <article class="campaign-card">
              <div class="campaign-top">
                <div>
                  <div class="campaign-name">
                    ${escapeHtml(campaign.name || "حملة بدون اسم")}
                  </div>

                  <div style="margin-top:7px;color:#7a92a1;font-size:12px;">
                    ${escapeHtml(typeLabel(campaign.campaign_type))}
                  </div>
                </div>

                <span class="badge ${statusClass(status)}">
                  ${escapeHtml(statusLabel(status))}
                </span>
              </div>

              <div class="campaign-meta">
                <div class="meta-item">
                  <span class="meta-label">المعلن</span>
                  <span class="meta-value">
                    ${escapeHtml(campaign.advertiser_name || "—")}
                  </span>
                </div>

                <div class="meta-item">
                  <span class="meta-label">الراعي</span>
                  <span class="meta-value">
                    ${escapeHtml(campaign.sponsor_name || "—")}
                  </span>
                </div>

                <div class="meta-item">
                  <span class="meta-label">الميزانية</span>
                  <span class="meta-value">
                    ${formatMoney(
                      campaign.budget,
                      campaign.currency || "SAR"
                    )}
                  </span>
                </div>

                <div class="meta-item">
                  <span class="meta-label">الأولوية</span>
                  <span class="meta-value">
                    ${formatNumber(campaign.priority)}
                  </span>
                </div>

                <div class="meta-item">
                  <span class="meta-label">البداية</span>
                  <span class="meta-value">
                    ${formatDate(campaign.start_at)}
                  </span>
                </div>

                <div class="meta-item">
                  <span class="meta-label">النهاية</span>
                  <span class="meta-value">
                    ${formatDate(campaign.end_at)}
                  </span>
                </div>
              </div>

              <div class="description">
                ${escapeHtml(
                  campaign.description ||
                  "لا يوجد وصف للحملة."
                )}
              </div>

              <div class="campaign-actions">
                <button
                  class="secondary"
                  data-action="edit"
                  data-id="${escapeHtml(campaign.id)}"
                >
                  تعديل
                </button>

                ${
                  status === "draft" ||
                  status === "pending" ||
                  status === "approved"
                    ? `
                      <button
                        class="primary"
                        data-action="activate"
                        data-id="${escapeHtml(campaign.id)}"
                      >
                        تفعيل
                      </button>
                    `
                    : ""
                }

                ${
                  status === "active"
                    ? `
                      <button
                        class="secondary"
                        data-action="pause"
                        data-id="${escapeHtml(campaign.id)}"
                      >
                        إيقاف مؤقت
                      </button>
                    `
                    : ""
                }

                ${
                  status === "paused"
                    ? `
                      <button
                        class="primary"
                        data-action="activate"
                        data-id="${escapeHtml(campaign.id)}"
                      >
                        إعادة التفعيل
                      </button>
                    `
                    : ""
                }

                <button
                  class="danger"
                  data-action="delete"
                  data-id="${escapeHtml(campaign.id)}"
                >
                  حذف
                </button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  async function loadCampaigns() {
    const data = await request(`${API.campaigns}?limit=200`);

    state.campaigns = normalizeList(data);

    renderStats();
    renderCampaigns();
  }

  async function loadStatistics() {
    try {
      const data = await request(API.statistics);

      state.statistics = data?.statistics || data || {};
    } catch (error) {
      console.warn("تعذر تحميل الإحصائيات التجارية:", error);
      state.statistics = {};
    }

    renderStats();
  }

  async function loadPlacements() {
    try {
      const data = await request(API.activePlacements);

      state.placements = normalizeList(data);
    } catch (error) {
      console.warn("تعذر تحميل مواضع الإعلانات:", error);
      state.placements = [];
    }
  }

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    const errorElement = document.querySelector("#commercial-error");

    if (errorElement) {
      errorElement.innerHTML = "";
    }

    const list = document.querySelector("#commercial-list");

    if (list && !state.campaigns.length) {
      list.innerHTML = `<div class="loading">جاري تحميل المركز التجاري...</div>`;
    }

    try {
      await Promise.all([
        loadCampaigns(),
        loadStatistics(),
        loadPlacements()
      ]);
    } catch (error) {
      console.error(error);

      if (errorElement) {
        errorElement.innerHTML = `
          <div class="error">
            تعذر تحميل بيانات المركز التجاري:
            ${escapeHtml(error.message)}
          </div>
        `;
      }
    } finally {
      state.loading = false;
    }
  }

  function openModal(campaign = null) {
    const backdrop = document.querySelector(
      "#commercial-modal-backdrop"
    );

    if (!backdrop) return;

    document.querySelector("#commercial-modal-title").textContent =
      campaign
        ? "تعديل الحملة التجارية"
        : "حملة تجارية جديدة";

    document.querySelector("#commercial-id").value =
      campaign?.id || "";

    document.querySelector("#commercial-name").value =
      campaign?.name || "";

    document.querySelector("#commercial-type").value =
      campaign?.campaign_type || "advertising";

    document.querySelector("#commercial-advertiser").value =
      campaign?.advertiser_name || "";

    document.querySelector("#commercial-sponsor").value =
      campaign?.sponsor_name || "";

    document.querySelector("#commercial-contact").value =
      campaign?.contact_name || "";

    document.querySelector("#commercial-email").value =
      campaign?.contact_email || "";

    document.querySelector("#commercial-phone").value =
      campaign?.contact_phone || "";

    document.querySelector("#commercial-budget").value =
      campaign?.budget ?? "";

    document.querySelector("#commercial-currency").value =
      campaign?.currency || "SAR";

    document.querySelector("#commercial-priority").value =
      campaign?.priority ?? 0;

    document.querySelector("#commercial-start").value =
      toLocalDateTime(campaign?.start_at);

    document.querySelector("#commercial-end").value =
      toLocalDateTime(campaign?.end_at);

    document.querySelector("#commercial-description").value =
      campaign?.description || "";

    backdrop.classList.add("open");
  }

  function closeModal() {
    const backdrop = document.querySelector(
      "#commercial-modal-backdrop"
    );

    if (backdrop) {
      backdrop.classList.remove("open");
    }
  }

  function toLocalDateTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const pad = (number) =>
      String(number).padStart(2, "0");

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") + "T" +
      [
        pad(date.getHours()),
        pad(date.getMinutes())
      ].join(":");
  }

  function fromLocalDateTime(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  function formPayload() {
    return {
      name: document.querySelector("#commercial-name").value.trim(),
      campaign_type:
        document.querySelector("#commercial-type").value,
      advertiser_name:
        document.querySelector("#commercial-advertiser").value.trim(),
      sponsor_name:
        document.querySelector("#commercial-sponsor").value.trim(),
      contact_name:
        document.querySelector("#commercial-contact").value.trim(),
      contact_email:
        document.querySelector("#commercial-email").value.trim(),
      contact_phone:
        document.querySelector("#commercial-phone").value.trim(),
      budget:
        Number(
          document.querySelector("#commercial-budget").value || 0
        ),
      currency:
        document.querySelector("#commercial-currency").value,
      priority:
        Number(
          document.querySelector("#commercial-priority").value || 0
        ),
      start_at:
        fromLocalDateTime(
          document.querySelector("#commercial-start").value
        ),
      end_at:
        fromLocalDateTime(
          document.querySelector("#commercial-end").value
        ),
      description:
        document.querySelector("#commercial-description").value.trim()
    };
  }

  async function saveCampaign(event) {
    event.preventDefault();

    const id =
      document.querySelector("#commercial-id").value.trim();

    const payload = formPayload();

    const button = document.querySelector(
      "#commercial-form button[type='submit']"
    );

    if (button) {
      button.disabled = true;
      button.textContent = "جاري الحفظ...";
    }

    try {
      if (id) {
        await request(`${API.campaigns}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await request(API.campaigns, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      closeModal();

      await refresh();

      alert(
        id
          ? "تم تحديث الحملة بنجاح."
          : "تم إنشاء الحملة بنجاح."
      );
    } catch (error) {
      alert(`تعذر حفظ الحملة: ${error.message}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "حفظ الحملة";
      }
    }
  }

  async function changeStatus(id, status) {
    try {
      await request(
        `${API.campaigns}/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status })
        }
      );

      await refresh();
    } catch (error) {
      alert(`تعذر تغيير حالة الحملة: ${error.message}`);
    }
  }

  async function deleteCampaign(id) {
    const campaign = state.campaigns.find(
      (item) => String(item.id) === String(id)
    );

    const name = campaign?.name || "هذه الحملة";

    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) {
      return;
    }

    try {
      await request(
        `${API.campaigns}/${encodeURIComponent(id)}`,
        {
          method: "DELETE"
        }
      );

      await refresh();
    } catch (error) {
      alert(`تعذر حذف الحملة: ${error.message}`);
    }
  }

  function bindEvents() {
    document
      .querySelector("#commercial-refresh")
      ?.addEventListener("click", refresh);

    document
      .querySelector("#commercial-new")
      ?.addEventListener("click", () => {
        openModal();
      });

    document
      .querySelector("#commercial-cancel")
      ?.addEventListener("click", closeModal);

    document
      .querySelector("#commercial-modal-backdrop")
      ?.addEventListener("click", (event) => {
        if (
          event.target.id ===
          "commercial-modal-backdrop"
        ) {
          closeModal();
        }
      });

    document
      .querySelector("#commercial-form")
      ?.addEventListener("submit", saveCampaign);

    document
      .querySelector("#commercial-search")
      ?.addEventListener("input", (event) => {
        state.search = event.target.value;
        renderCampaigns();
      });

    document
      .querySelector("#commercial-filter")
      ?.addEventListener("change", (event) => {
        state.filter = event.target.value;
        renderCampaigns();
      });

    document
      .querySelector("#commercial-list")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;

        const campaign = state.campaigns.find(
          (item) => String(item.id) === String(id)
        );

        if (action === "edit") {
          openModal(campaign);
        }

        if (action === "activate") {
          changeStatus(id, "active");
        }

        if (action === "pause") {
          changeStatus(id, "paused");
        }

        if (action === "delete") {
          deleteCampaign(id);
        }
      });
  }

  function initialize() {
    const container = getContainer();

    if (!container) return;

    renderShell(container);
    refresh();
  }

  window.EZMediaAdminCommercial = {
    initialize,
    refresh,
    openModal,
    closeModal,
    getState: () => ({ ...state })
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
