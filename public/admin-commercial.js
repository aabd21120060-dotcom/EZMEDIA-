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
    placements: [],
    statistics: null,
    filtered: [],
    loading: false,
    filter: {
      search: "",
      type: "all",
      status: "all"
    }
  };

  const CAMPAIGN_TYPES = {
    advertising: "إعلان",
    sponsorship: "رعاية",
    partnership: "شراكة"
  };

  const CAMPAIGN_STATUS = {
    draft: "مسودة",
    pending: "بانتظار الاعتماد",
    approved: "معتمد",
    active: "نشط",
    paused: "متوقف مؤقتًا",
    completed: "مكتمل",
    cancelled: "ملغى"
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
    const numeric = Number(value || 0);

    return numeric.toLocaleString("ar-SA");
  }

  function money(value, currency = "SAR") {
    const numeric = Number(value || 0);

    return `${numeric.toLocaleString("ar-SA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })} ${currency}`;
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

    if (Array.isArray(value?.campaigns)) {
      return value.campaigns;
    }

    if (Array.isArray(value?.placements)) {
      return value.placements;
    }

    return [];
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? {
              "Content-Type": "application/json"
            }
          : {}),
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
          `فشل الطلب: ${response.status}`
      );
    }

    return data;
  }

  function findContainer() {
    return (
      document.querySelector(
        "#admin-commercial-section"
      ) ||
      document.querySelector(
        "#commercial-section"
      ) ||
      document.querySelector(
        '[data-admin-section="commercial"]'
      )
    );
  }

  function typeLabel(type) {
    return (
      CAMPAIGN_TYPES[type] ||
      type ||
      "غير محدد"
    );
  }

  function statusLabel(status) {
    return (
      CAMPAIGN_STATUS[status] ||
      status ||
      "غير محدد"
    );
  }

  function statusClass(status) {
    return `status-${String(
      status || "unknown"
    ).replace(/[^a-z0-9_-]/gi, "-")}`;
  }

  function renderShell(container) {
    container.innerHTML = `
      <div class="ez-commercial">

        <style>
          .ez-commercial {
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

          .ez-commercial * {
            box-sizing: border-box;
          }

          .ez-commercial-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
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
            box-shadow:
              0 12px 35px
              rgba(67, 157, 210, 0.08);
          }

          .ez-commercial-title {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .ez-commercial-icon {
            width: 54px;
            height: 54px;
            display: grid;
            place-items: center;
            border-radius: 17px;
            background:
              linear-gradient(
                135deg,
                #e8f8ff,
                #cceeff
              );
            color: #168dcc;
            font-size: 25px;
            box-shadow:
              inset 0 0 0 1px #c5e9f9;
          }

          .ez-commercial-title h2 {
            margin: 0;
            font-size: 24px;
            color: #123a55;
          }

          .ez-commercial-title p {
            margin: 5px 0 0;
            color: #6b8799;
            font-size: 13px;
          }

          .ez-commercial-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .ez-commercial-btn {
            border: 1px solid #cfe8f5;
            background: #ffffff;
            color: #176d9c;
            padding: 10px 14px;
            border-radius: 13px;
            cursor: pointer;
            font-weight: 700;
            transition: 0.2s ease;
          }

          .ez-commercial-btn:hover {
            transform: translateY(-1px);
            background: #f2fbff;
          }

          .ez-commercial-btn.primary {
            border-color: #74c9ee;
            background:
              linear-gradient(
                135deg,
                #dff6ff,
                #c8edff
              );
            color: #0c6e9f;
          }

          .ez-commercial-stats {
            display: grid;
            grid-template-columns:
              repeat(6, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .ez-commercial-stat {
            min-height: 108px;
            padding: 16px;
            border: 1px solid #dceefa;
            border-radius: 20px;
            background: #ffffff;
            box-shadow:
              0 8px 25px
              rgba(64, 150, 201, 0.06);
          }

          .ez-commercial-stat-label {
            color: #6f8999;
            font-size: 12px;
            margin-bottom: 10px;
          }

          .ez-commercial-stat-value {
            color: #126d9e;
            font-size: 25px;
            font-weight: 800;
          }

          .ez-commercial-toolbar {
            display: grid;
            grid-template-columns:
              minmax(240px, 1fr)
              180px
              180px
              auto;
            gap: 10px;
            margin-bottom: 18px;
          }

          .ez-commercial-input,
          .ez-commercial-select {
            width: 100%;
            min-height: 44px;
            border: 1px solid #cfe6f3;
            border-radius: 13px;
            padding: 10px 13px;
            background: #ffffff;
            color: #254a61;
            outline: none;
          }

          .ez-commercial-input:focus,
          .ez-commercial-select:focus {
            border-color: #63bee8;
            box-shadow:
              0 0 0 3px
              rgba(99, 190, 232, 0.12);
          }

          .ez-commercial-list {
            display: grid;
            gap: 12px;
          }

          .ez-commercial-card {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              auto;
            gap: 16px;
            padding: 18px;
            border: 1px solid #dceefa;
            border-radius: 20px;
            background: #ffffff;
            box-shadow:
              0 8px 25px
              rgba(64, 150, 201, 0.05);
          }

          .ez-commercial-card-main {
            min-width: 0;
          }

          .ez-commercial-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            align-items: center;
            margin-bottom: 9px;
          }

          .ez-commercial-badge {
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

          .ez-commercial-badge.status-active {
            background: #e8fbf3;
            color: #16835e;
          }

          .ez-commercial-badge.status-approved {
            background: #e8f7ff;
            color: #1674a5;
          }

          .ez-commercial-badge.status-paused {
            background: #fff8e7;
            color: #9b7411;
          }

          .ez-commercial-badge.status-cancelled {
            background: #fff0f3;
            color: #b24b62;
          }

          .ez-commercial-card h3 {
            margin: 0 0 7px;
            font-size: 18px;
            line-height: 1.5;
            color: #143e58;
          }

          .ez-commercial-card p {
            margin: 0;
            color: #6b8493;
            line-height: 1.7;
            font-size: 13px;
          }

          .ez-commercial-contact {
            margin-top: 12px;
            display: grid;
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .ez-commercial-contact-item {
            padding: 10px;
            border-radius: 12px;
            background: #f7fcff;
            border: 1px solid #e1f1f8;
          }

          .ez-commercial-contact-item small {
            display: block;
            color: #7892a0;
            font-size: 10px;
            margin-bottom: 4px;
          }

          .ez-commercial-contact-item strong {
            display: block;
            color: #315a70;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .ez-commercial-budget {
            margin-top: 12px;
            color: #1674a5;
            font-weight: 800;
            font-size: 14px;
          }

          .ez-commercial-date {
            margin-top: 8px;
            color: #8aa0ad;
            font-size: 11px;
          }

          .ez-commercial-card-actions {
            display: flex;
            flex-direction: column;
            gap: 7px;
            min-width: 125px;
          }

          .ez-commercial-card-actions button {
            border: 1px solid #d1e8f4;
            background: #ffffff;
            color: #176d9c;
            border-radius: 11px;
            padding: 8px 10px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
          }

          .ez-commercial-card-actions button:hover {
            background: #f1fbff;
          }

          .ez-commercial-card-actions .danger {
            color: #b24b62;
          }

          .ez-commercial-empty {
            padding: 45px 20px;
            text-align: center;
            border: 1px dashed #bcddeb;
            border-radius: 20px;
            background: #fbfeff;
            color: #6e8998;
          }

          .ez-commercial-loading {
            padding: 35px;
            text-align: center;
            color: #6b8799;
          }

          .ez-commercial-modal {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background:
              rgba(23, 77, 105, 0.22);
            backdrop-filter: blur(8px);
          }

          .ez-commercial-modal.open {
            display: flex;
          }

          .ez-commercial-modal-box {
            width: min(900px, 100%);
            max-height: 90vh;
            overflow: auto;
            border: 1px solid #d4edf8;
            border-radius: 25px;
            background: #ffffff;
            box-shadow:
              0 30px 80px
              rgba(33, 112, 153, 0.2);
          }

          .ez-commercial-modal-head {
            position: sticky;
            top: 0;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            padding: 18px 20px;
            border-bottom: 1px solid #e2f0f6;
            background:
              rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(10px);
          }

          .ez-commercial-modal-head h3 {
            margin: 0;
            color: #123e59;
          }

          .ez-commercial-close {
            width: 38px;
            height: 38px;
            border: 0;
            border-radius: 12px;
            background: #eef9ff;
            color: #176d9c;
            cursor: pointer;
            font-size: 20px;
          }

          .ez-commercial-modal-body {
            padding: 20px;
          }

          .ez-commercial-form {
            display: grid;
            gap: 14px;
          }

          .ez-commercial-form label {
            display: grid;
            gap: 7px;
            color: #35586c;
            font-size: 13px;
            font-weight: 700;
          }

          .ez-commercial-form textarea {
            min-height: 120px;
            resize: vertical;
          }

          .ez-commercial-form-grid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .ez-commercial-form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding-top: 5px;
          }

          .ez-commercial-placement-list {
            display: grid;
            gap: 10px;
            margin-top: 15px;
          }

          .ez-commercial-placement {
            padding: 13px;
            border: 1px solid #dceefa;
            border-radius: 15px;
            background: #fafdff;
          }

          .ez-commercial-placement strong {
            display: block;
            color: #24556d;
            margin-bottom: 5px;
          }

          .ez-commercial-placement span {
            color: #718b99;
            font-size: 12px;
          }

          .ez-commercial-alert {
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
            box-shadow:
              0 15px 45px
              rgba(40, 125, 165, 0.18);
            display: none;
          }

          .ez-commercial-alert.show {
            display: block;
          }

          @media (max-width: 1150px) {
            .ez-commercial-stats {
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }

            .ez-commercial-toolbar {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 750px) {
            .ez-commercial-header {
              flex-direction: column;
              align-items: stretch;
            }

            .ez-commercial-stats {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .ez-commercial-toolbar {
              grid-template-columns: 1fr;
            }

            .ez-commercial-card {
              grid-template-columns: 1fr;
            }

            .ez-commercial-card-actions {
              flex-direction: row;
              flex-wrap: wrap;
            }

            .ez-commercial-contact {
              grid-template-columns: 1fr;
            }

            .ez-commercial-form-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>

        <div class="ez-commercial-header">
          <div class="ez-commercial-title">
            <div class="ez-commercial-icon">💼</div>

            <div>
              <h2>الإعلانات والرعايات الذكية</h2>

              <p>
                إدارة الحملات والإعلانات والرعايات والشراكات
                من مركز تجاري واحد
              </p>
            </div>
          </div>

          <div class="ez-commercial-actions">
            <button
              class="ez-commercial-btn"
              data-action="refresh"
            >
              تحديث
            </button>

            <button
              class="ez-commercial-btn"
              data-action="statistics"
            >
              الإحصائيات
            </button>

            <button
              class="ez-commercial-btn primary"
              data-action="new-campaign"
            >
              + حملة جديدة
            </button>
          </div>
        </div>

        <div class="ez-commercial-stats">

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              إجمالي الحملات
            </div>

            <div
              class="ez-commercial-stat-value"
              data-stat="campaigns"
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
              data-stat="active"
            >
              0
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              مرات الظهور
            </div>

            <div
              class="ez-commercial-stat-value"
              data-stat="impressions"
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
              data-stat="clicks"
            >
              0
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              نسبة النقر CTR
            </div>

            <div
              class="ez-commercial-stat-value"
              data-stat="ctr"
            >
              0%
            </div>
          </div>

          <div class="ez-commercial-stat">
            <div class="ez-commercial-stat-label">
              المشاهدات المكتملة
            </div>

            <div
              class="ez-commercial-stat-value"
              data-stat="completed"
            >
              0
            </div>
          </div>

        </div>

        <div class="ez-commercial-toolbar">

          <input
            class="ez-commercial-input"
            data-filter="search"
            type="search"
            placeholder="ابحث باسم الحملة أو المعلن أو الراعي..."
            autocomplete="off"
          />

          <select
            class="ez-commercial-select"
            data-filter="type"
          >
            <option value="all">
              كل الأنواع
            </option>

            <option value="advertising">
              إعلانات
            </option>

            <option value="sponsorship">
              رعايات
            </option>

            <option value="partnership">
              شراكات
            </option>
          </select>

          <select
            class="ez-commercial-select"
            data-filter="status"
          >
            <option value="all">
              كل الحالات
            </option>

            <option value="draft">
              مسودة
            </option>

            <option value="pending">
              بانتظار الاعتماد
            </option>

            <option value="approved">
              معتمد
            </option>

            <option value="active">
              نشط
            </option>

            <option value="paused">
              متوقف مؤقتًا
            </option>

            <option value="completed">
              مكتمل
            </option>

            <option value="cancelled">
              ملغى
            </option>
          </select>

          <button
            class="ez-commercial-btn"
            data-action="clear-filters"
          >
            مسح
          </button>

        </div>

        <div
          class="ez-commercial-list"
          data-list
        >
          <div class="ez-commercial-loading">
            جارٍ تحميل الحملات التجارية...
          </div>
        </div>

        <div
          class="ez-commercial-modal"
          data-modal
        >
          <div class="ez-commercial-modal-box">

            <div class="ez-commercial-modal-head">
              <h3 data-modal-title>
                الحملة التجارية
              </h3>

              <button
                class="ez-commercial-close"
                data-action="close-modal"
              >
                ×
              </button>
            </div>

            <div
              class="ez-commercial-modal-body"
              data-modal-body
            ></div>

          </div>
        </div>

        <div
          class="ez-commercial-alert"
          data-alert
        ></div>

      </div>
    `;
  }

  function showAlert(message) {
    const container = findContainer();

    const alert =
      container?.querySelector(
        "[data-alert]"
      );

    if (!alert) return;

    alert.textContent = message;

    alert.classList.add("show");

    clearTimeout(alert._timer);

    alert._timer = setTimeout(() => {
      alert.classList.remove("show");
    }, 3500);
  }

  function calculateStats() {
    const campaigns = state.campaigns;

    const active = campaigns.filter(
      (campaign) =>
        String(campaign.status || "")
          .toLowerCase() === "active"
    ).length;

    const statistics = state.statistics || {};

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

    const completed = Number(
      statistics.completed_views ||
        statistics.completed ||
        statistics.total_completed_views ||
        0
    );

    const ctr =
      impressions > 0
        ? (clicks / impressions) * 100
        : 0;

    return {
      campaigns: campaigns.length,
      active,
      impressions,
      clicks,
      completed,
      ctr
    };
  }

  function renderStats() {
    const container = findContainer();

    if (!container) return;

    const stats = calculateStats();

    const values = {
      campaigns: number(stats.campaigns),
      active: number(stats.active),
      impressions: number(stats.impressions),
      clicks: number(stats.clicks),
      ctr: `${stats.ctr.toFixed(2)}%`,
      completed: number(stats.completed)
    };

    Object.entries(values).forEach(
      ([key, value]) => {
        const element =
          container.querySelector(
            `[data-stat="${key}"]`
          );

        if (element) {
          element.textContent = value;
        }
      }
    );
  }

  function applyFilters() {
    const {
      search,
      type,
      status
    } = state.filter;

    const query =
      search.trim().toLowerCase();

    state.filtered =
      state.campaigns.filter(
        (campaign) => {
          const campaignType =
            String(
              campaign.campaign_type ||
                campaign.type ||
                ""
            ).toLowerCase();

          const campaignStatus =
            String(
              campaign.status || ""
            ).toLowerCase();

          const matchesType =
            type === "all" ||
            campaignType === type;

          const matchesStatus =
            status === "all" ||
            campaignStatus === status;

          if (!query) {
            return (
              matchesType &&
              matchesStatus
            );
          }

          const searchable = [
            campaign.name,
            campaign.advertiser_name,
            campaign.sponsor_name,
            campaign.contact_name,
            campaign.description,
            campaign.contact_email,
            campaign.contact_phone
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return (
            matchesType &&
            matchesStatus &&
            searchable.includes(query)
          );
        }
      );
  }

  function renderList() {
    const container = findContainer();

    if (!container) return;

    const list =
      container.querySelector(
        "[data-list]"
      );

    if (!list) return;

    if (!state.filtered.length) {
      list.innerHTML = `
        <div class="ez-commercial-empty">
          <div
            style="
              font-size:38px;
              margin-bottom:10px;
            "
          >
            💼
          </div>

          <strong>
            لا توجد حملات مطابقة
          </strong>

          <div style="margin-top:7px;">
            جرّب تغيير البحث أو الفلاتر.
          </div>
        </div>
      `;

      return;
    }

    list.innerHTML =
      state.filtered
        .map((campaign) => {
          const id =
            escapeHtml(campaign.id);

          const type =
            String(
              campaign.campaign_type ||
                campaign.type ||
                "advertising"
            ).toLowerCase();

          const status =
            String(
              campaign.status ||
                "draft"
            ).toLowerCase();

          const name =
            campaign.name ||
            "حملة بدون اسم";

          const advertiser =
            campaign.advertiser_name ||
            "غير محدد";

          const sponsor =
            campaign.sponsor_name ||
            "غير محدد";

          const description =
            campaign.description ||
            "لا يوجد وصف للحملة.";

          const currency =
            campaign.currency ||
            "SAR";

          return `
            <article
              class="ez-commercial-card"
            >

              <div
                class="ez-commercial-card-main"
              >

                <div
                  class="ez-commercial-meta"
                >
                  <span
                    class="ez-commercial-badge"
                  >
                    ${escapeHtml(
                      typeLabel(type)
                    )}
                  </span>

                  <span
                    class="
                      ez-commercial-badge
                      ${escapeHtml(
                        statusClass(status)
                      )}
                    "
                  >
                    ${escapeHtml(
                      statusLabel(status)
                    )}
                  </span>
                </div>

                <h3>
                  ${escapeHtml(name)}
                </h3>

                <p>
                  ${escapeHtml(
                    description
                  )}
                </p>

                <div
                  class="
                    ez-commercial-contact
                  "
                >
                  <div
                    class="
                      ez-commercial-contact-item
                    "
                  >
                    <small>
                      المعلن
                    </small>

                    <strong>
                      ${escapeHtml(
                        advertiser
                      )}
                    </strong>
                  </div>

                  <div
                    class="
                      ez-commercial-contact-item
                    "
                  >
                    <small>
                      الراعي
                    </small>

                    <strong>
                      ${escapeHtml(
                        sponsor
                      )}
                    </strong>
                  </div>

                  <div
                    class="
                      ez-commercial-contact-item
                    "
                  >
                    <small>
                      جهة الاتصال
                    </small>

                    <strong>
                      ${escapeHtml(
                        campaign.contact_name ||
                          "غير محدد"
                      )}
                    </strong>
                  </div>
                </div>

                <div
                  class="ez-commercial-budget"
                >
                  الميزانية:
                  ${escapeHtml(
                    money(
                      campaign.budget,
                      currency
                    )
                  )}
                </div>

                <div
                  class="ez-commercial-date"
                >
                  من:
                  ${escapeHtml(
                    formatDate(
                      campaign.start_at
                    )
                  )}

                  &nbsp; — &nbsp;

                  إلى:
                  ${escapeHtml(
                    formatDate(
                      campaign.end_at
                    )
                  )}
                </div>

              </div>

              <div
                class="
                  ez-commercial-card-actions
                "
              >

                <button
                  data-action="view"
                  data-id="${id}"
                >
                  عرض
                </button>

                <button
                  data-action="edit"
                  data-id="${id}"
                >
                  تعديل
                </button>

                <button
                  data-action="placements"
                  data-id="${id}"
                >
                  أماكن الإعلان
                </button>

                ${
                  status === "draft"
                    ? `
                      <button
                        data-action="activate"
                        data-id="${id}"
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
                        data-action="pause"
                        data-id="${id}"
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
                        data-action="activate"
                        data-id="${id}"
                      >
                        إعادة تفعيل
                      </button>
                    `
                    : ""
                }

                <button
                  class="danger"
                  data-action="delete"
                  data-id="${id}"
                >
                  حذف
                </button>

              </div>

            </article>
          `;
        })
        .join("");
  }

  async function loadCampaigns() {
    const data =
      await request(
        `${API.campaigns}?limit=200`
      );

    state.campaigns =
      normalizeList(data);

    applyFilters();
    renderStats();
    renderList();
  }

  async function loadStatistics() {
    try {
      state.statistics =
        await request(
          API.statistics
        );
    } catch (error) {
      console.warn(
        "Commercial statistics:",
        error
      );

      state.statistics = {};
    }

    renderStats();
  }

  async function loadPlacements() {
    try {
      const data =
        await request(
          API.activePlacements
        );

      state.placements =
        normalizeList(data);
    } catch {
      state.placements = [];
    }
  }

  async function refresh() {
    if (state.loading) {
      return;
    }

    state.loading = true;

    const container =
      findContainer();

    const list =
      container?.querySelector(
        "[data-list]"
      );

    if (list) {
      list.innerHTML = `
        <div class="ez-commercial-loading">
          جارٍ تحديث الحملات التجارية...
        </div>
      `;
    }

    try {
      await Promise.all([
        loadCampaigns(),
        loadStatistics(),
        loadPlacements()
      ]);

      showAlert(
        "تم تحديث البيانات التجارية."
      );
    } catch (error) {
      console.error(
        "EZ MEDIA Commercial:",
        error
      );

      if (list) {
        list.innerHTML = `
          <div class="ez-commercial-empty">
            تعذر تحميل الحملات التجارية.
            <br><br>
            <small>
              ${escapeHtml(
                error.message
              )}
            </small>
          </div>
        `;
      }

      showAlert(
        "تعذر تحديث الحملات التجارية."
      );
    } finally {
      state.loading = false;
    }
  }

  function findCampaign(id) {
    return state.campaigns.find(
      (campaign) =>
        String(campaign.id) ===
        String(id)
    );
  }

  function openModal(
    title,
    body
  ) {
    const container =
      findContainer();

    if (!container) return;

    const modal =
      container.querySelector(
        "[data-modal]"
      );

    const modalTitle =
      container.querySelector(
        "[data-modal-title]"
      );

    const modalBody =
      container.querySelector(
        "[data-modal-body]"
      );

    if (
      !modal ||
      !modalTitle ||
      !modalBody
    ) {
      return;
    }

    modalTitle.textContent =
      title;

    modalBody.innerHTML =
      body;

    modal.classList.add(
      "open"
    );
  }

  function closeModal() {
    const container =
      findContainer();

    container
      ?.querySelector(
        "[data-modal]"
      )
      ?.classList.remove(
        "open"
      );
  }

  function openNewCampaign() {
    openModal(
      "إنشاء حملة تجارية جديدة",
      `
        <form
          class="ez-commercial-form"
          data-form="new-campaign"
        >

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              اسم الحملة

              <input
                class="ez-commercial-input"
                name="name"
                required
                placeholder="مثال: رعاية التغطية الوطنية"
              />
            </label>

            <label>
              نوع الحملة

              <select
                class="ez-commercial-select"
                name="campaign_type"
              >
                <option
                  value="advertising"
                >
                  إعلان
                </option>

                <option
                  value="sponsorship"
                >
                  رعاية
                </option>

                <option
                  value="partnership"
                >
                  شراكة
                </option>
              </select>
            </label>

          </div>

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              اسم المعلن

              <input
                class="ez-commercial-input"
                name="advertiser_name"
                placeholder="اسم الشركة أو الجهة"
              />
            </label>

            <label>
              اسم الراعي

              <input
                class="ez-commercial-input"
                name="sponsor_name"
                placeholder="اسم الراعي"
              />
            </label>

          </div>

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              اسم جهة الاتصال

              <input
                class="ez-commercial-input"
                name="contact_name"
                placeholder="اسم المسؤول"
              />
            </label>

            <label>
              البريد الإلكتروني

              <input
                class="ez-commercial-input"
                name="contact_email"
                type="email"
                placeholder="email@example.com"
              />
            </label>

          </div>

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              رقم الهاتف

              <input
                class="ez-commercial-input"
                name="contact_phone"
                placeholder="+966..."
              />
            </label>

            <label>
              الميزانية

              <input
                class="ez-commercial-input"
                name="budget"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </label>

          </div>

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              تاريخ البداية

              <input
                class="ez-commercial-input"
                name="start_at"
                type="datetime-local"
              />
            </label>

            <label>
              تاريخ النهاية

              <input
                class="ez-commercial-input"
                name="end_at"
                type="datetime-local"
              />
            </label>

          </div>

          <label>
            وصف الحملة

            <textarea
              class="ez-commercial-input"
              name="description"
              placeholder="تفاصيل الحملة وأهدافها..."
            ></textarea>
          </label>

          <div
            class="
              ez-commercial-form-actions
            "
          >

            <button
              type="submit"
              class="
                ez-commercial-btn
                primary
              "
            >
              إنشاء الحملة
            </button>

            <button
              type="button"
              class="ez-commercial-btn"
              data-action="close-modal"
            >
              إلغاء
            </button>

          </div>

        </form>
      `
    );
  }

  async function createCampaign(form) {
    const data =
      new FormData(form);

    const payload = {
      name: data.get("name"),
      campaign_type:
        data.get("campaign_type"),
      status: "draft",
      advertiser_name:
        data.get("advertiser_name"),
      sponsor_name:
        data.get("sponsor_name"),
      contact_name:
        data.get("contact_name"),
      contact_email:
        data.get("contact_email"),
      contact_phone:
        data.get("contact_phone"),
      budget:
        Number(
          data.get("budget") || 0
        ),
      currency: "SAR",
      start_at:
        data.get("start_at") || null,
      end_at:
        data.get("end_at") || null,
      description:
        data.get("description")
    };

    try {
      await request(
        API.campaigns,
        {
          method: "POST",
          body: JSON.stringify(
            payload
          )
        }
      );

      closeModal();

      showAlert(
        "تم إنشاء الحملة."
      );

      await refresh();
    } catch (error) {
      console.error(error);

      showAlert(
        `تعذر إنشاء الحملة: ${error.message}`
      );
    }
  }

  function openEditCampaign(id) {
    const campaign =
      findCampaign(id);

    if (!campaign) return;

    openModal(
      "تعديل الحملة التجارية",
      `
        <form
          class="ez-commercial-form"
          data-form="edit-campaign"
          data-id="${escapeHtml(
            campaign.id
          )}"
        >

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              اسم الحملة

              <input
                class="ez-commercial-input"
                name="name"
                required
                value="${escapeHtml(
                  campaign.name || ""
                )}"
              />
            </label>

            <label>
              نوع الحملة

              <select
                class="ez-commercial-select"
                name="campaign_type"
              >

                ${Object.entries(
                  CAMPAIGN_TYPES
                )
                  .map(
                    ([value, label]) => `
                      <option
                        value="${escapeHtml(
                          value
                        )}"
                        ${
                          String(
                            campaign.campaign_type ||
                              ""
                          ) === value
                            ? "selected"
                            : ""
                        }
                      >
                        ${escapeHtml(
                          label
                        )}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </label>

          </div>

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              اسم المعلن

              <input
                class="ez-commercial-input"
                name="advertiser_name"
                value="${escapeHtml(
                  campaign.advertiser_name ||
                    ""
                )}"
              />
            </label>

            <label>
              اسم الراعي

              <input
                class="ez-commercial-input"
                name="sponsor_name"
                value="${escapeHtml(
                  campaign.sponsor_name ||
                    ""
                )}"
              />
            </label>

          </div>

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              اسم جهة الاتصال

              <input
                class="ez-commercial-input"
                name="contact_name"
                value="${escapeHtml(
                  campaign.contact_name ||
                    ""
                )}"
              />
            </label>

            <label>
              البريد الإلكتروني

              <input
                class="ez-commercial-input"
                name="contact_email"
                type="email"
                value="${escapeHtml(
                  campaign.contact_email ||
                    ""
                )}"
              />
            </label>

          </div>

          <div
            class="
              ez-commercial-form-grid
            "
          >

            <label>
              رقم الهاتف

              <input
                class="ez-commercial-input"
                name="contact_phone"
                value="${escapeHtml(
                  campaign.contact_phone ||
                    ""
                )}"
              />
            </label>

            <label>
              الميزانية

              <input
                class="ez-commercial-input"
                name="budget"
                type="number"
                min="0"
                step="0.01"
                value="${escapeHtml(
                  campaign.budget || 0
                )}"
              />
            </label>

          </div>

          <label>
            الحالة

            <select
              class="ez-commercial-select"
              name="status"
            >

              ${Object.entries(
                CAMPAIGN_STATUS
              )
                .map(
                  ([value, label]) => `
                    <option
                      value="${escapeHtml(
                        value
                      )}"
                      ${
                        String(
                          campaign.status ||
                            ""
                        ) === value
                          ? "selected"
                          : ""
                      }
                    >
                      ${escapeHtml(
                        label
                      )}
                    </option>
                  `
                )
                .join("")}

            </select>
          </label>

          <label>
            وصف الحملة

            <textarea
              class="ez-commercial-input"
              name="description"
            >${escapeHtml(
              campaign.description ||
                ""
            )}</textarea>
          </label>

          <div
            class="
              ez-commercial-form-actions
            "
          >

            <button
              type="submit"
              class="
                ez-commercial-btn
                primary
              "
            >
              حفظ التعديلات
            </button>

            <button
              type="button"
              class="ez-commercial-btn"
              data-action="close-modal"
            >
              إلغاء
            </button>

          </div>

        </form>
      `
    );
  }

  async function updateCampaign(form) {
    const id =
      form.dataset.id;

    if (!id) return;

    const data =
      new FormData(form);

    const payload = {
      name: data.get("name"),
      campaign_type:
        data.get("campaign_type"),
      status:
        data.get("status"),
      advertiser_name:
        data.get("advertiser_name"),
      sponsor_name:
        data.get("sponsor_name"),
      contact_name:
        data.get("contact_name"),
      contact_email:
        data.get("contact_email"),
      contact_phone:
        data.get("contact_phone"),
      budget:
        Number(
          data.get("budget") || 0
        ),
      description:
        data.get("description")
    };

    try {
      await request(
        `${API.campaigns}/${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify(
            payload
          )
        }
      );

      closeModal();

      showAlert(
        "تم حفظ الحملة."
      );

      await refresh();
    } catch (error) {
      console.error(error);

      showAlert(
        `تعذر حفظ الحملة: ${error.message}`
      );
    }
  }

  function viewCampaign(id) {
    const campaign =
      findCampaign(id);

    if (!campaign) return;

    openModal(
      campaign.name ||
        "الحملة التجارية",
      `
        <div class="ez-commercial-form">

          <div>
            <strong>
              نوع الحملة
            </strong>

            <p>
              ${escapeHtml(
                typeLabel(
                  campaign.campaign_type
                )
              )}
            </p>
          </div>

          <div>
            <strong>
              الحالة
            </strong>

            <p>
              ${escapeHtml(
                statusLabel(
                  campaign.status
                )
              )}
            </p>
          </div>

          <div>
            <strong>
              المعلن
            </strong>

            <p>
              ${escapeHtml(
                campaign.advertiser_name ||
                  "—"
              )}
            </p>
          </div>

          <div>
            <strong>
              الراعي
            </strong>

            <p>
              ${escapeHtml(
                campaign.sponsor_name ||
                  "—"
              )}
            </p>
          </div>

          <div>
            <strong>
              جهة الاتصال
            </strong>

            <p>
              ${escapeHtml(
                campaign.contact_name ||
                  "—"
              )}
            </p>
          </div>

          <div>
            <strong>
              البريد
            </strong>

            <p dir="ltr">
              ${escapeHtml(
                campaign.contact_email ||
                  "—"
              )}
            </p>
          </div>

          <div>
            <strong>
              الهاتف
            </strong>

            <p dir="ltr">
              ${escapeHtml(
                campaign.contact_phone ||
                  "—"
              )}
            </p>
          </div>

          <div>
            <strong>
              الميزانية
            </strong>

            <p>
              ${escapeHtml(
                money(
                  campaign.budget,
                  campaign.currency ||
                    "SAR"
                )
              )}
            </p>
          </div>

          <div>
            <strong>
              الوصف
            </strong>

            <p>
              ${escapeHtml(
                campaign.description ||
                  "—"
              )}
            </p>
          </div>

          <div>
            <strong>
              الفترة
            </strong>

            <p>
              من
              ${escapeHtml(
                formatDate(
                  campaign.start_at
                )
              )}
              إلى
              ${escapeHtml(
                formatDate(
                  campaign.end_at
                )
              )}
            </p>
          </div>

        </div>
      `
    );
  }

  async function showPlacements(id) {
    const campaign =
      findCampaign(id);

    if (!campaign) return;

    const placements =
      state.placements.filter(
        (placement) =>
          String(
            placement.campaign_id
          ) === String(id)
      );

    openModal(
      `أماكن الإعلان — ${
        campaign.name || ""
      }`,
      `
        <div>

          <p>
            الأماكن النشطة المرتبطة بالحملة.
          </p>

          <div
            class="
              ez-commercial-placement-list
            "
          >

            ${
              placements.length
                ? placements
                    .map(
                      (placement) => `
                        <div
                          class="
                            ez-commercial-placement
                          "
                        >

                          <strong>
                            ${escapeHtml(
                              placement.title ||
                                placement.placement_key ||
                                "مكان إعلاني"
                            )}
                          </strong>

                          <span>
                            النوع:
                            ${escapeHtml(
                              placement.placement_type ||
                                "—"
                            )}
                            <br>

                            الحالة:
                            ${escapeHtml(
                              placement.status ||
                                "—"
                            )}
                            <br>

                            الظهور:
                            ${number(
                              placement.impressions
                            )}
                            <br>

                            النقرات:
                            ${number(
                              placement.clicks
                            )}
                          </span>

                        </div>
                      `
                    )
                    .join("")
                : `
                  <div
                    class="
                      ez-commercial-empty
                    "
                  >
                    لا توجد أماكن إعلانية
                    نشطة مرتبطة بهذه الحملة.
                  </div>
                `
            }

          </div>

        </div>
      `
    );
  }

  async function changeStatus(
    id,
    status
  ) {
    try {
      await request(
        `${API.campaigns}/${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status
          })
        }
      );

      const message =
        status === "active"
          ? "تم تفعيل الحملة."
          : "تم إيقاف الحملة مؤقتًا.";

      showAlert(message);

      await refresh();
    } catch (error) {
      console.error(error);

      showAlert(
        `تعذر تغيير حالة الحملة: ${error.message}`
      );
    }
  }

  async function deleteCampaign(id) {
    const campaign =
      findCampaign(id);

    if (!campaign) return;

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف الحملة "${campaign.name}"؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `${API.campaigns}/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE"
        }
      );

      showAlert(
        "تم حذف الحملة."
      );

      await refresh();
    } catch (error) {
      console.error(error);

      showAlert(
        `تعذر حذف الحملة: ${error.message}`
      );
    }
  }

  function showStatistics() {
    const stats =
      calculateStats();

    openModal(
      "الإحصائيات التجارية",
      `
        <div class="ez-commercial-form">

          <div>
            <strong>
              إجمالي الحملات
            </strong>

            <p>
              ${number(
                stats.campaigns
              )}
            </p>
          </div>

          <div>
            <strong>
              الحملات النشطة
            </strong>

            <p>
              ${number(
                stats.active
              )}
            </p>
          </div>

          <div>
            <strong>
              مرات الظهور
            </strong>

            <p>
              ${number(
                stats.impressions
              )}
            </p>
          </div>

          <div>
            <strong>
              النقرات
            </strong>

            <p>
              ${number(
                stats.clicks
              )}
            </p>
          </div>

          <div>
            <strong>
              CTR
            </strong>

            <p>
              ${stats.ctr.toFixed(
                2
              )}%
            </p>
          </div>

          <div>
            <strong>
              المشاهدات المكتملة
            </strong>

            <p>
              ${number(
                stats.completed
              )}
            </p>
          </div>

        </div>
      `
    );
  }

  function handleAction(
    action,
    id
  ) {
    switch (action) {
      case "refresh":
        refresh();
        break;

      case "statistics":
        showStatistics();
        break;

      case "new-campaign":
        openNewCampaign();
        break;

      case "close-modal":
        closeModal();
        break;

      case "view":
        viewCampaign(id);
        break;

      case "edit":
        openEditCampaign(id);
        break;

      case "placements":
        showPlacements(id);
        break;

      case "activate":
        changeStatus(id, "active");
        break;

      case "pause":
        changeStatus(id, "paused");
        break;

      case "delete":
        deleteCampaign(id);
        break;

      case "clear-filters": {
        const container =
          findContainer();

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

        if (search) {
          search.value = "";
        }

        if (type) {
          type.value = "all";
        }

        if (status) {
          status.value = "all";
        }

        applyFilters();
        renderList();

        break;
      }

      default:
        break;
    }
  }

  function bindEvents(
    container
  ) {
    container.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "[data-action]"
          );

        if (!button) {
          return;
        }

        handleAction(
          button.dataset.action,
          button.dataset.id
        );
      }
    );

    container.addEventListener(
      "input",
      (event) => {
        if (
          event.target.dataset
            .filter !== "search"
        ) {
          return;
        }

        state.filter.search =
          event.target.value;

        applyFilters();
        renderList();
      }
    );

    container.addEventListener(
      "change",
      (event) => {
        const filter =
          event.target.dataset
            .filter;

        if (!filter) {
          return;
        }

        state.filter[filter] =
          event.target.value;

        applyFilters();
        renderList();
      }
    );

    container.addEventListener(
      "submit",
      (event) => {
        const form =
          event.target;

        if (
          form.dataset.form ===
          "new-campaign"
        ) {
          event.preventDefault();

          createCampaign(form);
        }

        if (
          form.dataset.form ===
          "edit-campaign"
        ) {
          event.preventDefault();

          updateCampaign(form);
        }
      }
    );

    container.addEventListener(
      "click",
      (event) => {
        const modal =
          event.target.closest(
            "[data-modal]"
          );

        if (
          modal &&
          event.target === modal
        ) {
          closeModal();
        }
      }
    );
  }

  async function initialize() {
    const container =
      findContainer();

    if (!container) {
      return false;
    }

    renderShell(container);

    bindEvents(container);

    await refresh();

    return true;
  }

  window.EZMediaAdminCommercial = {
    initialize,
    refresh,
    getState: () => ({
      ...state,
      campaigns: [
        ...state.campaigns
      ],
      placements: [
        ...state.placements
      ],
      filtered: [
        ...state.filtered
      ]
    })
  };

  if (
    document.readyState ===
    "loading"
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
