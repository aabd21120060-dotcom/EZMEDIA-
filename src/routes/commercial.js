"use strict";

/*
 * EZ MEDIA 11.0
 * الإدارة التجارية والإعلانية
 *
 * الملف:
 * public/admin-commercial.js
 *
 * المسؤوليات:
 * - الحملات الإعلانية
 * - الرعايات
 * - الشراكات
 * - مواضع الإعلانات
 * - الإحصائيات
 * - الظهور والنقرات والمشاهدات
 * - تفعيل وإيقاف الحملات والمواضع
 * - إنشاء وتعديل وحذف الحملات
 * - إنشاء وإدارة مواضع الإعلانات
 * - معاينة الإعلان
 *
 * يعتمد على API الموجود مسبقًا:
 * /api/commercial/statistics
 * /api/commercial/placements/active
 * /api/commercial/events
 * /api/commercial/campaigns
 * /api/commercial/campaigns/:id
 * /api/commercial/campaigns/:id/placements
 */

(function () {
  "use strict";

  const API = "/api/commercial";

  const state = {
    campaigns: [],
    placements: [],
    statistics: null,
    activePlacements: [],
    selectedCampaign: null,
    editingCampaignId: null,
    editingPlacementId: null,
    loading: false,
    filters: {
      search: "",
      status: "all",
      type: "all"
    }
  };

  const COLORS = {
    primary: "#38bdf8",
    primaryDark: "#0284c7",
    primarySoft: "#e0f2fe",
    cyan: "#06b6d4",
    green: "#16a34a",
    orange: "#f59e0b",
    red: "#ef4444",
    text: "#0f172a",
    muted: "#64748b",
    border: "#dbeafe",
    background: "#f8fbff",
    white: "#ffffff"
  };

  function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
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

  function formatMoney(value, currency) {
    const amount = Number(value || 0);

    return `${new Intl.NumberFormat("ar-SA", {
      maximumFractionDigits: 2
    }).format(amount)} ${currency || "SAR"}`;
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

  function getCampaignTypeLabel(type) {
    const labels = {
      advertising: "إعلان",
      sponsorship: "رعاية",
      partnership: "شراكة"
    };

    return labels[type] || type || "غير محدد";
  }

  function getCampaignStatusLabel(status) {
    const labels = {
      draft: "مسودة",
      pending: "بانتظار الاعتماد",
      approved: "معتمدة",
      active: "نشطة",
      paused: "متوقفة",
      completed: "مكتملة",
      cancelled: "ملغاة"
    };

    return labels[status] || status || "غير محدد";
  }

  function getPlacementTypeLabel(type) {
    const labels = {
      banner: "بانر",
      native: "إعلان مدمج",
      video: "فيديو",
      live: "البث المباشر",
      article: "داخل المحتوى",
      section: "قسم",
      homepage: "الرئيسية"
    };

    return labels[type] || type || "غير محدد";
  }

  function getStatusClass(status) {
    return `ez-commercial-status-${String(status || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/gi, "-")}`;
  }

  async function apiRequest(url, options = {}) {
    const config = {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    };

    if (options.body !== undefined) {
      config.headers["Content-Type"] = "application/json";
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `حدث خطأ في الطلب (${response.status})`;

      throw new Error(message);
    }

    return data;
  }

  function unwrapArray(data, possibleKeys = []) {
    if (Array.isArray(data)) {
      return data;
    }

    for (const key of possibleKeys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }

      if (Array.isArray(data?.data?.[key])) {
        return data.data[key];
      }
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }

  function unwrapObject(data) {
    if (!data) return null;

    if (data.data && typeof data.data === "object") {
      return data.data;
    }

    return data;
  }

  function ensureStyles() {
    if (document.getElementById("ez-commercial-styles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "ez-commercial-styles";

    style.textContent = `
      #ez-commercial-admin {
        direction: rtl;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
        color: ${COLORS.text};
        width: 100%;
        box-sizing: border-box;
      }

      #ez-commercial-admin *,
      #ez-commercial-admin *::before,
      #ez-commercial-admin *::after {
        box-sizing: border-box;
      }

      .ez-commercial-shell {
        width: 100%;
        background:
          radial-gradient(
            circle at top right,
            rgba(56,189,248,.12),
            transparent 28%
          ),
          ${COLORS.background};
        border: 1px solid ${COLORS.border};
        border-radius: 24px;
        padding: 22px;
        overflow: hidden;
      }

      .ez-commercial-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        margin-bottom: 24px;
      }

      .ez-commercial-title-wrap h2 {
        margin: 0 0 7px;
        font-size: 27px;
        font-weight: 900;
        letter-spacing: -.5px;
      }

      .ez-commercial-title-wrap p {
        margin: 0;
        color: ${COLORS.muted};
        line-height: 1.8;
      }

      .ez-commercial-actions {
        display: flex;
        gap: 9px;
        flex-wrap: wrap;
      }

      .ez-commercial-btn {
        border: 0;
        border-radius: 13px;
        min-height: 43px;
        padding: 0 16px;
        font-weight: 800;
        cursor: pointer;
        transition:
          transform .15s ease,
          box-shadow .15s ease,
          opacity .15s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-family: inherit;
      }

      .ez-commercial-btn:hover {
        transform: translateY(-1px);
      }

      .ez-commercial-btn:disabled {
        opacity: .55;
        cursor: not-allowed;
        transform: none;
      }

      .ez-commercial-btn-primary {
        color: #fff;
        background: linear-gradient(
          135deg,
          ${COLORS.primaryDark},
          ${COLORS.cyan}
        );
        box-shadow: 0 8px 22px rgba(14,165,233,.18);
      }

      .ez-commercial-btn-secondary {
        color: ${COLORS.primaryDark};
        background: ${COLORS.primarySoft};
      }

      .ez-commercial-btn-danger {
        color: #fff;
        background: linear-gradient(
          135deg,
          #ef4444,
          #f97316
        );
      }

      .ez-commercial-btn-light {
        color: ${COLORS.text};
        background: #fff;
        border: 1px solid ${COLORS.border};
      }

      .ez-commercial-kpis {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 13px;
        margin-bottom: 20px;
      }

      .ez-commercial-kpi {
        background: rgba(255,255,255,.9);
        border: 1px solid ${COLORS.border};
        border-radius: 18px;
        padding: 17px;
        min-width: 0;
      }

      .ez-commercial-kpi-label {
        color: ${COLORS.muted};
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 9px;
      }

      .ez-commercial-kpi-value {
        font-size: 25px;
        line-height: 1.2;
        font-weight: 950;
      }

      .ez-commercial-kpi-note {
        margin-top: 7px;
        font-size: 11px;
        color: ${COLORS.muted};
      }

      .ez-commercial-toolbar {
        background: #fff;
        border: 1px solid ${COLORS.border};
        border-radius: 18px;
        padding: 14px;
        display: grid;
        grid-template-columns: minmax(180px, 1fr) 170px 170px auto;
        gap: 10px;
        margin-bottom: 16px;
      }

      .ez-commercial-field,
      .ez-commercial-field-group {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ez-commercial-field label,
      .ez-commercial-field-group label {
        font-size: 12px;
        color: ${COLORS.muted};
        font-weight: 800;
      }

      .ez-commercial-input,
      .ez-commercial-select,
      .ez-commercial-textarea {
        width: 100%;
        border: 1px solid #cfe3f5;
        background: #fff;
        color: ${COLORS.text};
        border-radius: 11px;
        padding: 11px 12px;
        outline: none;
        font-family: inherit;
        font-size: 14px;
      }

      .ez-commercial-input:focus,
      .ez-commercial-select:focus,
      .ez-commercial-textarea:focus {
        border-color: ${COLORS.primary};
        box-shadow: 0 0 0 3px rgba(56,189,248,.12);
      }

      .ez-commercial-textarea {
        min-height: 100px;
        resize: vertical;
      }

      .ez-commercial-table-wrap {
        background: #fff;
        border: 1px solid ${COLORS.border};
        border-radius: 18px;
        overflow: auto;
      }

      .ez-commercial-table {
        width: 100%;
        min-width: 900px;
        border-collapse: collapse;
      }

      .ez-commercial-table th {
        background: #f0f9ff;
        color: #475569;
        text-align: right;
        padding: 13px 12px;
        font-size: 12px;
        white-space: nowrap;
        border-bottom: 1px solid ${COLORS.border};
      }

      .ez-commercial-table td {
        padding: 13px 12px;
        border-bottom: 1px solid #edf5fb;
        vertical-align: middle;
        font-size: 13px;
      }

      .ez-commercial-table tr:last-child td {
        border-bottom: 0;
      }

      .ez-commercial-table tbody tr:hover {
        background: #fafeff;
      }

      .ez-commercial-name {
        font-weight: 900;
      }

      .ez-commercial-sub {
        margin-top: 4px;
        color: ${COLORS.muted};
        font-size: 11px;
      }

      .ez-commercial-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 27px;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
        background: #eff6ff;
        color: ${COLORS.primaryDark};
      }

      .ez-commercial-status-active {
        background: #ecfdf5;
        color: #15803d;
      }

      .ez-commercial-status-draft {
        background: #f1f5f9;
        color: #475569;
      }

      .ez-commercial-status-pending {
        background: #fffbeb;
        color: #b45309;
      }

      .ez-commercial-status-approved {
        background: #ecfeff;
        color: #0e7490;
      }

      .ez-commercial-status-paused {
        background: #fff7ed;
        color: #c2410c;
      }

      .ez-commercial-status-completed {
        background: #eff6ff;
        color: #1d4ed8;
      }

      .ez-commercial-status-cancelled {
        background: #fef2f2;
        color: #b91c1c;
      }

      .ez-commercial-row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .ez-commercial-mini-btn {
        border: 1px solid #cfe3f5;
        background: #fff;
        color: ${COLORS.primaryDark};
        border-radius: 9px;
        padding: 7px 9px;
        cursor: pointer;
        font-family: inherit;
        font-weight: 800;
        font-size: 11px;
      }

      .ez-commercial-mini-btn:hover {
        background: #f0f9ff;
      }

      .ez-commercial-mini-btn.danger {
        color: #dc2626;
        border-color: #fecaca;
      }

      .ez-commercial-empty {
        padding: 45px 20px;
        text-align: center;
        color: ${COLORS.muted};
      }

      .ez-commercial-empty-icon {
        font-size: 35px;
        margin-bottom: 9px;
      }

      .ez-commercial-section {
        margin-top: 22px;
      }

      .ez-commercial-section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }

      .ez-commercial-section-head h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 950;
      }

      .ez-commercial-section-head span {
        color: ${COLORS.muted};
        font-size: 12px;
      }

      .ez-commercial-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(15,23,42,.34);
        backdrop-filter: blur(7px);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }

      .ez-commercial-modal.is-open {
        display: flex;
      }

      .ez-commercial-modal-card {
        width: min(760px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: #fff;
        border: 1px solid ${COLORS.border};
        border-radius: 24px;
        box-shadow: 0 25px 80px rgba(15,23,42,.18);
      }

      .ez-commercial-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px;
        border-bottom: 1px solid #eaf4fb;
      }

      .ez-commercial-modal-head h3 {
        margin: 0;
        font-size: 19px;
        font-weight: 950;
      }

      .ez-commercial-close {
        border: 0;
        background: #f0f9ff;
        color: ${COLORS.primaryDark};
        width: 38px;
        height: 38px;
        border-radius: 11px;
        cursor: pointer;
        font-size: 18px;
      }

      .ez-commercial-modal-body {
        padding: 20px;
      }

      .ez-commercial-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 13px;
      }

      .ez-commercial-full {
        grid-column: 1 / -1;
      }

      .ez-commercial-modal-foot {
        padding: 15px 20px;
        border-top: 1px solid #eaf4fb;
        display: flex;
        justify-content: flex-start;
        gap: 9px;
      }

      .ez-commercial-preview {
        border: 1px solid ${COLORS.border};
        border-radius: 18px;
        overflow: hidden;
        background: #f8fbff;
      }

      .ez-commercial-preview-media {
        min-height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          linear-gradient(
            135deg,
            #e0f2fe,
            #f0fdfa
          );
      }

      .ez-commercial-preview-media img,
      .ez-commercial-preview-media video {
        display: block;
        width: 100%;
        max-height: 360px;
        object-fit: contain;
      }

      .ez-commercial-preview-content {
        padding: 16px;
      }

      .ez-commercial-preview-content h4 {
        margin: 0 0 7px;
        font-size: 18px;
      }

      .ez-commercial-preview-content p {
        margin: 0 0 10px;
        color: ${COLORS.muted};
        line-height: 1.7;
      }

      .ez-commercial-preview-content a {
        color: ${COLORS.primaryDark};
        font-weight: 900;
        text-decoration: none;
      }

      .ez-commercial-toast {
        position: fixed;
        bottom: 22px;
        left: 22px;
        z-index: 100000;
        min-width: 260px;
        max-width: min(420px, calc(100vw - 44px));
        padding: 13px 15px;
        border-radius: 14px;
        background: #fff;
        border: 1px solid ${COLORS.border};
        box-shadow: 0 18px 45px rgba(15,23,42,.14);
        font-weight: 800;
        display: none;
      }

      .ez-commercial-toast.is-visible {
        display: block;
        animation: ezCommercialToastIn .2s ease;
      }

      @keyframes ezCommercialToastIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .ez-commercial-loading {
        opacity: .55;
        pointer-events: none;
      }

      .ez-commercial-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,.45);
        border-top-color: #fff;
        border-radius: 50%;
        animation: ezCommercialSpin .8s linear infinite;
      }

      @keyframes ezCommercialSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 1100px) {
        .ez-commercial-kpis {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .ez-commercial-toolbar {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 700px) {
        .ez-commercial-shell {
          padding: 14px;
          border-radius: 18px;
        }

        .ez-commercial-header {
          flex-direction: column;
        }

        .ez-commercial-actions {
          width: 100%;
        }

        .ez-commercial-actions .ez-commercial-btn {
          flex: 1;
        }

        .ez-commercial-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .ez-commercial-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-commercial-form-grid {
          grid-template-columns: 1fr;
        }

        .ez-commercial-full {
          grid-column: auto;
        }
      }

      @media (max-width: 430px) {
        .ez-commercial-kpis {
          grid-template-columns: 1fr;
        }

        .ez-commercial-title-wrap h2 {
          font-size: 22px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getMount() {
    return (
      document.getElementById("commercial-section") ||
      document.getElementById("admin-commercial-section") ||
      document.querySelector('[data-admin-section="commercial"]') ||
      document.querySelector('[data-section="commercial"]')
    );
  }

  function createMountIfNeeded() {
    let mount = getMount();

    if (mount) {
      return mount;
    }

    mount = document.createElement("section");
    mount.id = "admin-commercial-section";

    const preferred =
      document.getElementById("admin-content") ||
      document.querySelector("main") ||
      document.body;

    preferred.appendChild(mount);

    return mount;
  }

  function renderShell() {
    const mount = createMountIfNeeded();

    mount.innerHTML = `
      <div id="ez-commercial-admin">
        <div class="ez-commercial-shell">

          <div class="ez-commercial-header">
            <div class="ez-commercial-title-wrap">
              <h2>💼 الإعلانات والرعايات</h2>
              <p>
                مركز EZ MEDIA لإدارة الحملات التجارية والرعايات والشراكات
                وقياس أدائها من مكان واحد.
              </p>
            </div>

            <div class="ez-commercial-actions">
              <button
                class="ez-commercial-btn ez-commercial-btn-light"
                id="ez-commercial-refresh"
                type="button"
              >
                ↻ تحديث
              </button>

              <button
                class="ez-commercial-btn ez-commercial-btn-primary"
                id="ez-commercial-new-campaign"
                type="button"
              >
                ＋ حملة جديدة
              </button>
            </div>
          </div>

          <div class="ez-commercial-kpis" id="ez-commercial-kpis">
            ${renderKpis()}
          </div>

          <div class="ez-commercial-toolbar">
            <div class="ez-commercial-field">
              <label>بحث</label>
              <input
                id="ez-commercial-search"
                class="ez-commercial-input"
                type="search"
                placeholder="ابحث باسم الحملة أو المعلن أو الراعي..."
              />
            </div>

            <div class="ez-commercial-field">
              <label>الحالة</label>
              <select id="ez-commercial-status" class="ez-commercial-select">
                <option value="all">كل الحالات</option>
                <option value="draft">مسودة</option>
                <option value="pending">بانتظار الاعتماد</option>
                <option value="approved">معتمدة</option>
                <option value="active">نشطة</option>
                <option value="paused">متوقفة</option>
                <option value="completed">مكتملة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>

            <div class="ez-commercial-field">
              <label>النوع</label>
              <select id="ez-commercial-type" class="ez-commercial-select">
                <option value="all">كل الأنواع</option>
                <option value="advertising">إعلان</option>
                <option value="sponsorship">رعاية</option>
                <option value="partnership">شراكة</option>
              </select>
            </div>

            <div style="display:flex;align-items:end;">
              <button
                id="ez-commercial-clear-filter"
                class="ez-commercial-btn ez-commercial-btn-secondary"
                type="button"
                style="width:100%;"
              >
                مسح
              </button>
            </div>
          </div>

          <div class="ez-commercial-section">
            <div class="ez-commercial-section-head">
              <div>
                <h3>الحملات التجارية</h3>
                <span id="ez-commercial-campaign-count">
                  جاري التحميل...
                </span>
              </div>
            </div>

            <div class="ez-commercial-table-wrap">
              <table class="ez-commercial-table">
                <thead>
                  <tr>
                    <th>الحملة</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th>الميزانية</th>
                    <th>الفترة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody id="ez-commercial-campaigns-body">
                  <tr>
                    <td colspan="6">
                      <div class="ez-commercial-empty">
                        جاري تحميل الحملات...
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="ez-commercial-section">
            <div class="ez-commercial-section-head">
              <div>
                <h3>مواضع الإعلانات النشطة</h3>
                <span>
                  الإعلانات التي يمكن عرضها على واجهة EZ MEDIA
                </span>
              </div>
            </div>

            <div class="ez-commercial-table-wrap">
              <table class="ez-commercial-table">
                <thead>
                  <tr>
                    <th>العنوان</th>
                    <th>الحملة</th>
                    <th>الموضع</th>
                    <th>الحالة</th>
                    <th>الظهور</th>
                    <th>النقرات</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody id="ez-commercial-placements-body">
                  <tr>
                    <td colspan="7">
                      <div class="ez-commercial-empty">
                        جاري تحميل مواضع الإعلانات...
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      ${renderCampaignModal()}
      ${renderPlacementModal()}
      ${renderPreviewModal()}

      <div
        id="ez-commercial-toast"
        class="ez-commercial-toast"
        role="status"
        aria-live="polite"
      ></div>
    `;

    bindEvents();
  }

  function renderKpis() {
    const statistics = state.statistics || {};

    const campaigns =
      statistics.campaigns ||
      statistics.campaign ||
      {};

    const totals =
      statistics.totals ||
      statistics ||
      {};

    const activeCampaigns =
      campaigns.active ??
      totals.active_campaigns ??
      state.campaigns.filter(
        (item) => item.status === "active"
      ).length;

    const impressions =
      totals.impressions ??
      statistics.impressions ??
      0;

    const clicks =
      totals.clicks ??
      statistics.clicks ??
      0;

    const starts =
      totals.starts ??
      statistics.starts ??
      0;

    const completedViews =
      totals.completed_views ??
      statistics.completed_views ??
      0;

    return `
      ${kpiCard(
        "الحملات النشطة",
        formatNumber(activeCampaigns),
        "حملات تعمل حاليًا"
      )}

      ${kpiCard(
        "مرات الظهور",
        formatNumber(impressions),
        "إجمالي الظهور المسجل"
      )}

      ${kpiCard(
        "النقرات",
        formatNumber(clicks),
        "إجمالي النقرات"
      )}

      ${kpiCard(
        "بدء المشاهدة",
        formatNumber(starts),
        "بدء تشغيل الإعلانات"
      )}

      ${kpiCard(
        "المشاهدات المكتملة",
        formatNumber(completedViews),
        "مشاهدات مكتملة"
      )}
    `;
  }

  function kpiCard(label, value, note) {
    return `
      <div class="ez-commercial-kpi">
        <div class="ez-commercial-kpi-label">
          ${escapeHTML(label)}
        </div>
        <div class="ez-commercial-kpi-value">
          ${escapeHTML(value)}
        </div>
        <div class="ez-commercial-kpi-note">
          ${escapeHTML(note)}
        </div>
      </div>
    `;
  }

  function renderCampaignModal() {
    return `
      <div
        id="ez-commercial-campaign-modal"
        class="ez-commercial-modal"
        aria-hidden="true"
      >
        <div class="ez-commercial-modal-card">

          <div class="ez-commercial-modal-head">
            <h3 id="ez-commercial-campaign-modal-title">
              إنشاء حملة تجارية
            </h3>

            <button
              type="button"
              class="ez-commercial-close"
              data-close-modal="campaign"
              aria-label="إغلاق"
            >
              ×
            </button>
          </div>

          <form id="ez-commercial-campaign-form">

            <div class="ez-commercial-modal-body">

              <div class="ez-commercial-form-grid">

                <div class="ez-commercial-field-group">
                  <label>اسم الحملة *</label>
                  <input
                    id="commercial-campaign-name"
                    class="ez-commercial-input"
                    required
                    maxlength="200"
                    placeholder="مثال: الحملة الإعلامية لليوم الوطني"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>نوع الحملة *</label>
                  <select
                    id="commercial-campaign-type"
                    class="ez-commercial-select"
                    required
                  >
                    <option value="advertising">إعلان</option>
                    <option value="sponsorship">رعاية</option>
                    <option value="partnership">شراكة</option>
                  </select>
                </div>

                <div class="ez-commercial-field-group">
                  <label>المعلن</label>
                  <input
                    id="commercial-advertiser-name"
                    class="ez-commercial-input"
                    maxlength="200"
                    placeholder="اسم الجهة المعلنة"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>الراعي</label>
                  <input
                    id="commercial-sponsor-name"
                    class="ez-commercial-input"
                    maxlength="200"
                    placeholder="اسم الراعي"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>اسم جهة الاتصال</label>
                  <input
                    id="commercial-contact-name"
                    class="ez-commercial-input"
                    maxlength="200"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>البريد الإلكتروني</label>
                  <input
                    id="commercial-contact-email"
                    class="ez-commercial-input"
                    type="email"
                    maxlength="320"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>رقم التواصل</label>
                  <input
                    id="commercial-contact-phone"
                    class="ez-commercial-input"
                    maxlength="50"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>الحالة</label>
                  <select
                    id="commercial-campaign-status"
                    class="ez-commercial-select"
                  >
                    <option value="draft">مسودة</option>
                    <option value="pending">بانتظار الاعتماد</option>
                    <option value="approved">معتمدة</option>
                    <option value="active">نشطة</option>
                    <option value="paused">متوقفة</option>
                    <option value="completed">مكتملة</option>
                    <option value="cancelled">ملغاة</option>
                  </select>
                </div>

                <div class="ez-commercial-field-group">
                  <label>الميزانية</label>
                  <input
                    id="commercial-campaign-budget"
                    class="ez-commercial-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>العملة</label>
                  <select
                    id="commercial-campaign-currency"
                    class="ez-commercial-select"
                  >
                    <option value="SAR">SAR - ريال سعودي</option>
                    <option value="USD">USD - دولار</option>
                    <option value="AED">AED - درهم إماراتي</option>
                    <option value="KWD">KWD - دينار كويتي</option>
                    <option value="BHD">BHD - دينار بحريني</option>
                    <option value="QAR">QAR - ريال قطري</option>
                  </select>
                </div>

                <div class="ez-commercial-field-group">
                  <label>الأولوية</label>
                  <input
                    id="commercial-campaign-priority"
                    class="ez-commercial-input"
                    type="number"
                    min="0"
                    max="9999"
                    value="0"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>تاريخ البداية</label>
                  <input
                    id="commercial-campaign-start"
                    class="ez-commercial-input"
                    type="datetime-local"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>تاريخ النهاية</label>
                  <input
                    id="commercial-campaign-end"
                    class="ez-commercial-input"
                    type="datetime-local"
                  />
                </div>

                <div class="ez-commercial-field-group ez-commercial-full">
                  <label>وصف الحملة</label>
                  <textarea
                    id="commercial-campaign-description"
                    class="ez-commercial-textarea"
                    placeholder="وصف الحملة وأهدافها وملاحظاتها..."
                  ></textarea>
                </div>

              </div>

            </div>

            <div class="ez-commercial-modal-foot">
              <button
                type="submit"
                class="ez-commercial-btn ez-commercial-btn-primary"
                id="commercial-campaign-save"
              >
                حفظ الحملة
              </button>

              <button
                type="button"
                class="ez-commercial-btn ez-commercial-btn-light"
                data-close-modal="campaign"
              >
                إلغاء
              </button>
            </div>

          </form>
        </div>
      </div>
    `;
  }

  function renderPlacementModal() {
    return `
      <div
        id="ez-commercial-placement-modal"
        class="ez-commercial-modal"
        aria-hidden="true"
      >
        <div class="ez-commercial-modal-card">

          <div class="ez-commercial-modal-head">
            <h3 id="ez-commercial-placement-modal-title">
              إضافة موضع إعلاني
            </h3>

            <button
              type="button"
              class="ez-commercial-close"
              data-close-modal="placement"
              aria-label="إغلاق"
            >
              ×
            </button>
          </div>

          <form id="ez-commercial-placement-form">

            <div class="ez-commercial-modal-body">

              <div class="ez-commercial-form-grid">

                <div class="ez-commercial-field-group ez-commercial-full">
                  <label>الحملة</label>
                  <select
                    id="commercial-placement-campaign"
                    class="ez-commercial-select"
                    required
                  ></select>
                </div>

                <div class="ez-commercial-field-group">
                  <label>عنوان الإعلان *</label>
                  <input
                    id="commercial-placement-title"
                    class="ez-commercial-input"
                    required
                    maxlength="200"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>نوع الموضع *</label>
                  <select
                    id="commercial-placement-type"
                    class="ez-commercial-select"
                    required
                  >
                    <option value="banner">بانر</option>
                    <option value="native">إعلان مدمج</option>
                    <option value="video">فيديو</option>
                    <option value="live">البث المباشر</option>
                    <option value="article">داخل المحتوى</option>
                    <option value="section">قسم</option>
                    <option value="homepage">الرئيسية</option>
                  </select>
                </div>

                <div class="ez-commercial-field-group">
                  <label>معرّف الموضع</label>
                  <input
                    id="commercial-placement-key"
                    class="ez-commercial-input"
                    placeholder="homepage-top"
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>الحالة</label>
                  <select
                    id="commercial-placement-status"
                    class="ez-commercial-select"
                  >
                    <option value="draft">مسودة</option>
                    <option value="active">نشط</option>
                    <option value="paused">متوقف</option>
                    <option value="expired">منتهي</option>
                  </select>
                </div>

                <div class="ez-commercial-field-group ez-commercial-full">
                  <label>رابط الصورة</label>
                  <input
                    id="commercial-placement-image"
                    class="ez-commercial-input"
                    type="url"
                    placeholder="https://..."
                  />
                </div>

                <div class="ez-commercial-field-group ez-commercial-full">
                  <label>رابط الفيديو</label>
                  <input
                    id="commercial-placement-video"
                    class="ez-commercial-input"
                    type="url"
                    placeholder="https://..."
                  />
                </div>

                <div class="ez-commercial-field-group ez-commercial-full">
                  <label>رابط الوجهة</label>
                  <input
                    id="commercial-placement-destination"
                    class="ez-commercial-input"
                    type="url"
                    placeholder="https://..."
                  />
                </div>

                <div class="ez-commercial-field-group">
                  <label>معرّف المحتوى</label>
                  <input
                    id="commercial-placement-content-id"
                    class="ez-commercial-input"
                    placeholder="اختياري"
                  />
                </div>

                <div class="ez-commercial-field-group ez-commercial-full">
                  <label>ملاحظات / Metadata بصيغة JSON</label>
                  <textarea
                    id="commercial-placement-metadata"
                    class="ez-commercial-textarea"
                    placeholder='{"campaign":"national-day","position":"top"}'
                  ></textarea>
                </div>

              </div>

            </div>

            <div class="ez-commercial-modal-foot">

              <button
                type="submit"
                class="ez-commercial-btn ez-commercial-btn-primary"
                id="commercial-placement-save"
              >
                حفظ الموضع
              </button>

              <button
                type="button"
                class="ez-commercial-btn ez-commercial-btn-light"
                data-close-modal="placement"
              >
                إلغاء
              </button>

            </div>

          </form>
        </div>
      </div>
    `;
  }

  function renderPreviewModal() {
    return `
      <div
        id="ez-commercial-preview-modal"
        class="ez-commercial-modal"
        aria-hidden="true"
      >
        <div class="ez-commercial-modal-card">

          <div class="ez-commercial-modal-head">
            <h3>معاينة الإعلان</h3>

            <button
              type="button"
              class="ez-commercial-close"
              data-close-modal="preview"
              aria-label="إغلاق"
            >
              ×
            </button>
          </div>

          <div
            class="ez-commercial-modal-body"
            id="ez-commercial-preview-body"
          ></div>

        </div>
      </div>
    `;
  }

  function bindEvents() {
    document
      .getElementById("ez-commercial-refresh")
      ?.addEventListener("click", refresh);

    document
      .getElementById("ez-commercial-new-campaign")
      ?.addEventListener("click", () => {
        openCampaignModal();
      });

    document
      .getElementById("ez-commercial-search")
      ?.addEventListener("input", (event) => {
        state.filters.search = event.target.value.trim().toLowerCase();
        renderCampaigns();
      });

    document
      .getElementById("ez-commercial-status")
      ?.addEventListener("change", (event) => {
        state.filters.status = event.target.value;
        renderCampaigns();
      });

    document
      .getElementById("ez-commercial-type")
      ?.addEventListener("change", (event) => {
        state.filters.type = event.target.value;
        renderCampaigns();
      });

    document
      .getElementById("ez-commercial-clear-filter")
      ?.addEventListener("click", () => {
        state.filters.search = "";
        state.filters.status = "all";
        state.filters.type = "all";

        const search = document.getElementById(
          "ez-commercial-search"
        );

        const status = document.getElementById(
          "ez-commercial-status"
        );

        const type = document.getElementById(
          "ez-commercial-type"
        );

        if (search) search.value = "";
        if (status) status.value = "all";
        if (type) type.value = "all";

        renderCampaigns();
      });

    document
      .getElementById("ez-commercial-campaign-form")
      ?.addEventListener("submit", saveCampaign);

    document
      .getElementById("ez-commercial-placement-form")
      ?.addEventListener("submit", savePlacement);

    document
      .querySelectorAll("[data-close-modal]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          closeModal(button.dataset.closeModal);
        });
      });

    document
      .getElementById("ez-commercial-campaigns-body")
      ?.addEventListener("click", handleCampaignAction);

    document
      .getElementById("ez-commercial-placements-body")
      ?.addEventListener("click", handlePlacementAction);
  }

  async function refresh() {
    if (state.loading) {
      return;
    }

    state.loading = true;

    const root = document.getElementById("ez-commercial-admin");

    root?.classList.add("ez-commercial-loading");

    try {
      await Promise.all([
        loadStatistics(),
        loadCampaigns(),
        loadActivePlacements()
      ]);

      renderKpis();
      renderCampaigns();
      renderPlacements();
      populateCampaignSelect();
    } catch (error) {
      console.error("EZ MEDIA Commercial:", error);

      showToast(
        error.message || "تعذر تحميل البيانات التجارية",
        "error"
      );
    } finally {
      state.loading = false;

      root?.classList.remove("ez-commercial-loading");
    }
  }

  async function loadStatistics() {
    try {
      const data = await apiRequest(
        `${API}/statistics`
      );

      state.statistics = unwrapObject(data) || {};
    } catch (error) {
      state.statistics = {};
      throw error;
    }
  }

  async function loadCampaigns() {
    const params = new URLSearchParams();

    params.set("limit", "100");

    if (state.filters.status !== "all") {
      params.set("status", state.filters.status);
    }

    if (state.filters.type !== "all") {
      params.set("campaign_type", state.filters.type);
    }

    const data = await apiRequest(
      `${API}/campaigns?${params.toString()}`
    );

    state.campaigns = unwrapArray(data, [
      "campaigns",
      "items",
      "results"
    ]);
  }

  async function loadActivePlacements() {
    const data = await apiRequest(
      `${API}/placements/active`
    );

    state.activePlacements = unwrapArray(data, [
      "placements",
      "items",
      "results"
    ]);

    state.placements = state.activePlacements;
  }

  function getFilteredCampaigns() {
    return state.campaigns.filter((campaign) => {
      const statusMatch =
        state.filters.status === "all" ||
        campaign.status === state.filters.status;

      const typeMatch =
        state.filters.type === "all" ||
        campaign.campaign_type === state.filters.type;

      const searchText = [
        campaign.name,
        campaign.advertiser_name,
        campaign.sponsor_name,
        campaign.contact_name,
        campaign.description
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch =
        !state.filters.search ||
        searchText.includes(state.filters.search);

      return statusMatch && typeMatch && searchMatch;
    });
  }

  function renderCampaigns() {
    const body = document.getElementById(
      "ez-commercial-campaigns-body"
    );

    const count = document.getElementById(
      "ez-commercial-campaign-count"
    );

    if (!body) return;

    const campaigns = getFilteredCampaigns();

    if (count) {
      count.textContent =
        `${formatNumber(campaigns.length)} حملة ظاهرة`;
    }

    if (!campaigns.length) {
      body.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="ez-commercial-empty">
              <div class="ez-commercial-empty-icon">📢</div>
              <strong>لا توجد حملات</strong>
              <div style="margin-top:6px;">
                أنشئ أول حملة تجارية من زر «حملة جديدة».
              </div>
            </div>
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML = campaigns
      .map((campaign) => {
        return `
          <tr>
            <td>
              <div class="ez-commercial-name">
                ${escapeHTML(campaign.name || "بدون اسم")}
              </div>

              <div class="ez-commercial-sub">
                ${escapeHTML(
                  campaign.advertiser_name ||
                  campaign.sponsor_name ||
                  "بدون معلن/راعٍ"
                )}
              </div>
            </td>

            <td>
              <span class="ez-commercial-badge">
                ${escapeHTML(
                  getCampaignTypeLabel(
                    campaign.campaign_type
                  )
                )}
              </span>
            </td>

            <td>
              <span
                class="ez-commercial-badge ${getStatusClass(
                  campaign.status
                )}"
              >
                ${escapeHTML(
                  getCampaignStatusLabel(
                    campaign.status
                  )
                )}
              </span>
            </td>

            <td>
              ${escapeHTML(
                formatMoney(
                  campaign.budget,
                  campaign.currency
                )
              )}
            </td>

            <td>
              <div>
                ${escapeHTML(
                  formatDate(campaign.start_at)
                )}
              </div>

              <div class="ez-commercial-sub">
                إلى
                ${escapeHTML(
                  formatDate(campaign.end_at)
                )}
              </div>
            </td>

            <td>
              <div class="ez-commercial-row-actions">

                <button
                  class="ez-commercial-mini-btn"
                  data-action="edit-campaign"
                  data-id="${escapeHTML(campaign.id)}"
                >
                  تعديل
                </button>

                <button
                  class="ez-commercial-mini-btn"
                  data-action="placements"
                  data-id="${escapeHTML(campaign.id)}"
                >
                  المواضع
                </button>

                <button
                  class="ez-commercial-mini-btn"
                  data-action="new-placement"
                  data-id="${escapeHTML(campaign.id)}"
                >
                  ＋ إعلان
                </button>

                <button
                  class="ez-commercial-mini-btn"
                  data-action="preview-campaign"
                  data-id="${escapeHTML(campaign.id)}"
                >
                  معاينة
                </button>

                <button
                  class="ez-commercial-mini-btn danger"
                  data-action="delete-campaign"
                  data-id="${escapeHTML(campaign.id)}"
                >
                  حذف
                </button>

              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderPlacements() {
    const body = document.getElementById(
      "ez-commercial-placements-body"
    );

    if (!body) return;

    if (!state.placements.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="ez-commercial-empty">
              <div class="ez-commercial-empty-icon">🧩</div>
              <strong>لا توجد مواضع إعلانية نشطة</strong>
              <div style="margin-top:6px;">
                أضف موضعًا من داخل الحملة.
              </div>
            </div>
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML = state.placements
      .map((placement) => {
        const campaign = findCampaign(
          placement.campaign_id
        );

        return `
          <tr>
            <td>
              <div class="ez-commercial-name">
                ${escapeHTML(
                  placement.title || "بدون عنوان"
                )}
              </div>

              <div class="ez-commercial-sub">
                ${escapeHTML(
                  placement.placement_key ||
                  "بدون معرّف موضع"
                )}
              </div>
            </td>

            <td>
              ${escapeHTML(
                campaign?.name ||
                placement.campaign_name ||
                "—"
              )}
            </td>

            <td>
              <span class="ez-commercial-badge">
                ${escapeHTML(
                  getPlacementTypeLabel(
                    placement.placement_type
                  )
                )}
              </span>
            </td>

            <td>
              <span
                class="ez-commercial-badge ${getStatusClass(
                  placement.status
                )}"
              >
                ${escapeHTML(
                  placement.status || "—"
                )}
              </span>
            </td>

            <td>
              ${formatNumber(
                placement.impressions
              )}
            </td>

            <td>
              ${formatNumber(
                placement.clicks
              )}
            </td>

            <td>
              <div class="ez-commercial-row-actions">

                <button
                  class="ez-commercial-mini-btn"
                  data-placement-action="preview"
                  data-id="${escapeHTML(placement.id)}"
                >
                  معاينة
                </button>

                <button
                  class="ez-commercial-mini-btn"
                  data-placement-action="edit"
                  data-id="${escapeHTML(placement.id)}"
                >
                  تعديل
                </button>

                <button
                  class="ez-commercial-mini-btn danger"
                  data-placement-action="delete"
                  data-id="${escapeHTML(placement.id)}"
                >
                  حذف
                </button>

              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function findCampaign(id) {
    return state.campaigns.find(
      (campaign) =>
        String(campaign.id) === String(id)
    );
  }

  function findPlacement(id) {
    return state.placements.find(
      (placement) =>
        String(placement.id) === String(id)
    );
  }

  function populateCampaignSelect(selectedId = null) {
    const select = document.getElementById(
      "commercial-placement-campaign"
    );

    if (!select) return;

    const current =
      selectedId ||
      select.value ||
      "";

    select.innerHTML = `
      <option value="">
        اختر الحملة
      </option>
      ${state.campaigns
        .map(
          (campaign) => `
            <option
              value="${escapeHTML(campaign.id)}"
              ${String(campaign.id) === String(current)
                ? "selected"
                : ""}
            >
              ${escapeHTML(
                campaign.name || "بدون اسم"
              )}
            </option>
          `
        )
        .join("")}
    `;
  }

  function openCampaignModal(campaign = null) {
    const modal = document.getElementById(
      "ez-commercial-campaign-modal"
    );

    const title = document.getElementById(
      "ez-commercial-campaign-modal-title"
    );

    state.editingCampaignId =
      campaign?.id || null;

    if (title) {
      title.textContent = campaign
        ? "تعديل الحملة التجارية"
        : "إنشاء حملة تجارية";
    }

    setValue(
      "commercial-campaign-name",
      campaign?.name || ""
    );

    setValue(
      "commercial-campaign-type",
      campaign?.campaign_type || "advertising"
    );

    setValue(
      "commercial-advertiser-name",
      campaign?.advertiser_name || ""
    );

    setValue(
      "commercial-sponsor-name",
      campaign?.sponsor_name || ""
    );

    setValue(
      "commercial-contact-name",
      campaign?.contact_name || ""
    );

    setValue(
      "commercial-contact-email",
      campaign?.contact_email || ""
    );

    setValue(
      "commercial-contact-phone",
      campaign?.contact_phone || ""
    );

    setValue(
      "commercial-campaign-status",
      campaign?.status || "draft"
    );

    setValue(
      "commercial-campaign-budget",
      campaign?.budget ?? ""
    );

    setValue(
      "commercial-campaign-currency",
      campaign?.currency || "SAR"
    );

    setValue(
      "commercial-campaign-priority",
      campaign?.priority ?? 0
    );

    setDateValue(
      "commercial-campaign-start",
      campaign?.start_at
    );

    setDateValue(
      "commercial-campaign-end",
      campaign?.end_at
    );

    setValue(
      "commercial-campaign-description",
      campaign?.description || ""
    );

    openModal("campaign");
  }

  function openPlacementModal(
    placement = null,
    campaignId = null
  ) {
    const modal = document.getElementById(
      "ez-commercial-placement-modal"
    );

    const title = document.getElementById(
      "ez-commercial-placement-modal-title"
    );

    state.editingPlacementId =
      placement?.id || null;

    if (title) {
      title.textContent = placement
        ? "تعديل الموضع الإعلاني"
        : "إضافة موضع إعلاني";
    }

    populateCampaignSelect(
      campaignId ||
      placement?.campaign_id ||
      ""
    );

    setValue(
      "commercial-placement-campaign",
      campaignId ||
      placement?.campaign_id ||
      ""
    );

    setValue(
      "commercial-placement-title",
      placement?.title || ""
    );

    setValue(
      "commercial-placement-type",
      placement?.placement_type || "banner"
    );

    setValue(
      "commercial-placement-key",
      placement?.placement_key || ""
    );

    setValue(
      "commercial-placement-status",
      placement?.status || "draft"
    );

    setValue(
      "commercial-placement-image",
      placement?.image_url || ""
    );

    setValue(
      "commercial-placement-video",
      placement?.video_url || ""
    );

    setValue(
      "commercial-placement-destination",
      placement?.destination_url || ""
    );

    setValue(
      "commercial-placement-content-id",
      placement?.content_id || ""
    );

    setValue(
      "commercial-placement-metadata",
      placement?.metadata
        ? JSON.stringify(
            placement.metadata,
            null,
            2
          )
        : ""
    );

    openModal("placement");
  }

  function setValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.value = value;
    }
  }

  function setDateValue(id, value) {
    const element = document.getElementById(id);

    if (!element || !value) {
      if (element) element.value = "";
      return;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      element.value = "";
      return;
    }

    const local = new Date(
      date.getTime() -
      date.getTimezoneOffset() * 60000
    );

    element.value = local
      .toISOString()
      .slice(0, 16);
  }

  function getValue(id) {
    return document.getElementById(id)?.value?.trim() || "";
  }

  function getNumberValue(id) {
    const value = getValue(id);

    if (!value) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  function getDateValue(id) {
    const value = getValue(id);

    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  }

  async function saveCampaign(event) {
    event.preventDefault();

    const saveButton = document.getElementById(
      "commercial-campaign-save"
    );

    const payload = {
      name: getValue(
        "commercial-campaign-name"
      ),
      campaign_type: getValue(
        "commercial-campaign-type"
      ),
      advertiser_name: getValue(
        "commercial-advertiser-name"
      ) || null,
      sponsor_name: getValue(
        "commercial-sponsor-name"
      ) || null,
      contact_name: getValue(
        "commercial-contact-name"
      ) || null,
      contact_email: getValue(
        "commercial-contact-email"
      ) || null,
      contact_phone: getValue(
        "commercial-contact-phone"
      ) || null,
      status: getValue(
        "commercial-campaign-status"
      ),
      budget: getNumberValue(
        "commercial-campaign-budget"
      ),
      currency: getValue(
        "commercial-campaign-currency"
      ) || "SAR",
      priority:
        getNumberValue(
          "commercial-campaign-priority"
        ) ?? 0,
      start_at: getDateValue(
        "commercial-campaign-start"
      ),
      end_at: getDateValue(
        "commercial-campaign-end"
      ),
      description:
        getValue(
          "commercial-campaign-description"
        ) || null
    };

    if (!payload.name) {
      showToast(
        "اسم الحملة مطلوب",
        "error"
      );
      return;
    }

    try {
      setButtonLoading(
        saveButton,
        true,
        "جاري الحفظ..."
      );

      if (state.editingCampaignId) {
        await apiRequest(
          `${API}/campaigns/${encodeURIComponent(
            state.editingCampaignId
          )}`,
          {
            method: "PATCH",
            body: payload
          }
        );

        showToast(
          "تم تحديث الحملة بنجاح",
          "success"
        );
      } else {
        await apiRequest(
          `${API}/campaigns`,
          {
            method: "POST",
            body: payload
          }
        );

        showToast(
          "تم إنشاء الحملة بنجاح",
          "success"
        );
      }

      closeModal("campaign");

      await refresh();
    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "تعذر حفظ الحملة",
        "error"
      );
    } finally {
      setButtonLoading(
        saveButton,
        false,
        "حفظ الحملة"
      );
    }
  }

  async function savePlacement(event) {
    event.preventDefault();

    const saveButton = document.getElementById(
      "commercial-placement-save"
    );

    const campaignId = getValue(
      "commercial-placement-campaign"
    );

    if (!campaignId) {
      showToast(
        "اختر الحملة أولًا",
        "error"
      );
      return;
    }

    const metadataText = getValue(
      "commercial-placement-metadata"
    );

    let metadata = null;

    if (metadataText) {
      try {
        metadata = JSON.parse(metadataText);
      } catch (_) {
        showToast(
          "صيغة Metadata غير صحيحة. استخدم JSON صالحًا.",
          "error"
        );
        return;
      }
    }

    const payload = {
      placement_key:
        getValue(
          "commercial-placement-key"
        ) || null,
      placement_type:
        getValue(
          "commercial-placement-type"
        ),
      title:
        getValue(
          "commercial-placement-title"
        ),
      image_url:
        getValue(
          "commercial-placement-image"
        ) || null,
      video_url:
        getValue(
          "commercial-placement-video"
        ) || null,
      destination_url:
        getValue(
          "commercial-placement-destination"
        ) || null,
      content_id:
        getValue(
          "commercial-placement-content-id"
        ) || null,
      status:
        getValue(
          "commercial-placement-status"
        ),
      metadata
    };

    if (!payload.title) {
      showToast(
        "عنوان الإعلان مطلوب",
        "error"
      );
      return;
    }

    try {
      setButtonLoading(
        saveButton,
        true,
        "جاري الحفظ..."
      );

      if (state.editingPlacementId) {
        await apiRequest(
          `${API}/campaigns/${encodeURIComponent(
            campaignId
          )}/placements/${encodeURIComponent(
            state.editingPlacementId
          )}`,
          {
            method: "PATCH",
            body: payload
          }
        );
      } else {
        await apiRequest(
          `${API}/campaigns/${encodeURIComponent(
            campaignId
          )}/placements`,
          {
            method: "POST",
            body: payload
          }
        );
      }

      showToast(
        state.editingPlacementId
          ? "تم تحديث الموضع الإعلاني"
          : "تم إنشاء الموضع الإعلاني",
        "success"
      );

      closeModal("placement");

      await refresh();
    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "تعذر حفظ الموضع الإعلاني",
        "error"
      );
    } finally {
      setButtonLoading(
        saveButton,
        false,
        "حفظ الموضع"
      );
    }
  }

  function setButtonLoading(
    button,
    loading,
    label
  ) {
    if (!button) return;

    button.disabled = loading;

    if (loading) {
      button.innerHTML = `
        <span class="ez-commercial-spinner"></span>
        ${escapeHTML(label)}
      `;
    } else {
      button.textContent = label;
    }
  }

  async function handleCampaignAction(event) {
    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    const campaign = findCampaign(id);

    if (!campaign) {
      showToast(
        "الحملة غير موجودة",
        "error"
      );
      return;
    }

    if (action === "edit-campaign") {
      openCampaignModal(campaign);
      return;
    }

    if (action === "new-placement") {
      openPlacementModal(
        null,
        campaign.id
      );
      return;
    }

    if (action === "placements") {
      openPlacementModal(
        null,
        campaign.id
      );
      return;
    }

    if (action === "preview-campaign") {
      const placement =
        state.placements.find(
          (item) =>
            String(
              item.campaign_id
            ) === String(campaign.id)
        );

      if (placement) {
        openPlacementPreview(
          placement
        );
      } else {
        openCampaignPreview(
          campaign
        );
      }

      return;
    }

    if (action === "delete-campaign") {
      await deleteCampaign(campaign);
    }
  }

  async function handlePlacementAction(event) {
    const button =
      event.target.closest(
        "[data-placement-action]"
      );

    if (!button) return;

    const action =
      button.dataset.placementAction;

    const id = button.dataset.id;

    const placement =
      findPlacement(id);

    if (!placement) {
      showToast(
        "الموضع الإعلاني غير موجود",
        "error"
      );
      return;
    }

    if (action === "preview") {
      openPlacementPreview(
        placement
      );
      return;
    }

    if (action === "edit") {
      openPlacementModal(
        placement
      );
      return;
    }

    if (action === "delete") {
      await deletePlacement(
        placement
      );
    }
  }

  async function deleteCampaign(campaign) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الحملة:\n\n${campaign.name}\n\nسيتم حذف الحملة من النظام.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(
        `${API}/campaigns/${encodeURIComponent(
          campaign.id
        )}`,
        {
          method: "DELETE"
        }
      );

      showToast(
        "تم حذف الحملة",
        "success"
      );

      await refresh();
    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "تعذر حذف الحملة",
        "error"
      );
    }
  }

  async function deletePlacement(
    placement
  ) {
    const campaignId =
      placement.campaign_id;

    if (!campaignId) {
      showToast(
        "لا يمكن تحديد الحملة المرتبطة بالإعلان",
        "error"
      );
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف الإعلان:\n\n${placement.title || "بدون عنوان"}`
    );

    if (!confirmed) {
      return;
    }

    try {
      /*
       * API الخلفية الحالية تربط المواضع بالحملة.
       * نحاول مسار الحذف المباشر أولًا.
       */
      try {
        await apiRequest(
          `${API}/campaigns/${encodeURIComponent(
            campaignId
          )}/placements/${encodeURIComponent(
            placement.id
          )}`,
          {
            method: "DELETE"
          }
        );
      } catch (directError) {
        /*
         * إذا لم يكن مسار الحذف المباشر موجودًا
         * في النسخة الحالية من الـ API، نستخدم
         * تحديث الحالة بدلًا من إسقاط الواجهة.
         */
        await apiRequest(
          `${API}/campaigns/${encodeURIComponent(
            campaignId
          )}/placements/${encodeURIComponent(
            placement.id
          )}`,
          {
            method: "PATCH",
            body: {
              status: "expired"
            }
          }
        );
      }

      showToast(
        "تم حذف/إيقاف الإعلان",
        "success"
      );

      await refresh();
    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "تعذر حذف الإعلان",
        "error"
      );
    }
  }

  function openCampaignPreview(
    campaign
  ) {
    const body = document.getElementById(
      "ez-commercial-preview-body"
    );

    if (!body) return;

    body.innerHTML = `
      <div class="ez-commercial-preview">

        <div class="ez-commercial-preview-media">
          <div style="
            text-align:center;
            padding:35px;
          ">
            <div style="
              font-size:42px;
              margin-bottom:10px;
            ">
              💼
            </div>

            <strong>
              ${escapeHTML(
                campaign.name ||
                "حملة تجارية"
              )}
            </strong>
          </div>
        </div>

        <div class="ez-commercial-preview-content">

          <div style="
            display:flex;
            gap:7px;
            flex-wrap:wrap;
            margin-bottom:10px;
          ">
            <span class="ez-commercial-badge">
              ${escapeHTML(
                getCampaignTypeLabel(
                  campaign.campaign_type
                )
              )}
            </span>

            <span
              class="ez-commercial-badge ${getStatusClass(
                campaign.status
              )}"
            >
              ${escapeHTML(
                getCampaignStatusLabel(
                  campaign.status
                )
              )}
            </span>
          </div>

          <h4>
            ${escapeHTML(
              campaign.name ||
              "بدون اسم"
            )}
          </h4>

          <p>
            ${escapeHTML(
              campaign.description ||
              "لا يوجد وصف للحملة."
            )}
          </p>

          ${
            campaign.advertiser_name
              ? `
                <div class="ez-commercial-sub">
                  المعلن:
                  <strong>
                    ${escapeHTML(
                      campaign.advertiser_name
                    )}
                  </strong>
                </div>
              `
              : ""
          }

          ${
            campaign.sponsor_name
              ? `
                <div class="ez-commercial-sub">
                  الراعي:
                  <strong>
                    ${escapeHTML(
                      campaign.sponsor_name
                    )}
                  </strong>
                </div>
              `
              : ""
          }

          <div class="ez-commercial-sub" style="margin-top:10px;">
            الميزانية:
            ${escapeHTML(
              formatMoney(
                campaign.budget,
                campaign.currency
              )
            )}
          </div>

        </div>
      </div>
    `;

    openModal("preview");
  }

  function openPlacementPreview(
    placement
  ) {
    const body = document.getElementById(
      "ez-commercial-preview-body"
    );

    if (!body) return;

    let media = "";

    if (placement.video_url) {
      media = `
        <video
          controls
          playsinline
          preload="metadata"
          src="${escapeHTML(
            placement.video_url
          )}"
        ></video>
      `;
    } else if (placement.image_url) {
      media = `
        <img
          src="${escapeHTML(
            placement.image_url
          )}"
          alt="${escapeHTML(
            placement.title ||
            "إعلان"
          )}"
        />
      `;
    } else {
      media = `
        <div style="
          padding:45px;
          text-align:center;
          color:#64748b;
        ">
          لا توجد صورة أو فيديو لهذا الإعلان
        </div>
      `;
    }

    body.innerHTML = `
      <div class="ez-commercial-preview">

        <div class="ez-commercial-preview-media">
          ${media}
        </div>

        <div class="ez-commercial-preview-content">

          <div style="
            display:flex;
            gap:7px;
            flex-wrap:wrap;
            margin-bottom:10px;
          ">

            <span class="ez-commercial-badge">
              ${escapeHTML(
                getPlacementTypeLabel(
                  placement.placement_type
                )
              )}
            </span>

            <span
              class="ez-commercial-badge ${getStatusClass(
                placement.status
              )}"
            >
              ${escapeHTML(
                placement.status ||
                "—"
              )}
            </span>

          </div>

          <h4>
            ${escapeHTML(
              placement.title ||
              "بدون عنوان"
            )}
          </h4>

          <p>
            معاينة موضع الإعلان كما سيظهر
            داخل منصة EZ MEDIA.
          </p>

          ${
            placement.destination_url
              ? `
                <a
                  href="${escapeHTML(
                    placement.destination_url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  فتح رابط الإعلان ↗
                </a>
              `
              : ""
          }

          <div style="
            margin-top:15px;
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:8px;
          ">

            <div style="
              background:#f0f9ff;
              padding:10px;
              border-radius:10px;
              text-align:center;
            ">
              <strong>
                ${formatNumber(
                  placement.impressions
                )}
              </strong>
              <div class="ez-commercial-sub">
                ظهور
              </div>
            </div>

            <div style="
              background:#f0f9ff;
              padding:10px;
              border-radius:10px;
              text-align:center;
            ">
              <strong>
                ${formatNumber(
                  placement.clicks
                )}
              </strong>
              <div class="ez-commercial-sub">
                نقرات
              </div>
            </div>

            <div style="
              background:#f0f9ff;
              padding:10px;
              border-radius:10px;
              text-align:center;
            ">
              <strong>
                ${formatNumber(
                  placement.completed_views
                )}
              </strong>
              <div class="ez-commercial-sub">
                مكتمل
              </div>
            </div>

          </div>

        </div>
      </div>
    `;

    openModal("preview");
  }

  function openModal(type) {
    const ids = {
      campaign:
        "ez-commercial-campaign-modal",
      placement:
        "ez-commercial-placement-modal",
      preview:
        "ez-commercial-preview-modal"
    };

    const modal = document.getElementById(
      ids[type]
    );

    if (!modal) return;

    modal.classList.add(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow =
      "hidden";
  }

  function closeModal(type) {
    const ids = {
      campaign:
        "ez-commercial-campaign-modal",
      placement:
        "ez-commercial-placement-modal",
      preview:
        "ez-commercial-preview-modal"
    };

    const modal = document.getElementById(
      ids[type]
    );

    if (!modal) return;

    modal.classList.remove(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    const anyOpen =
      document.querySelector(
        ".ez-commercial-modal.is-open"
      );

    if (!anyOpen) {
      document.body.style.overflow =
        "";
    }

    if (type === "campaign") {
      state.editingCampaignId =
        null;
    }

    if (type === "placement") {
      state.editingPlacementId =
        null;
    }
  }

  function showToast(
    message,
    type = "success"
  ) {
    const toast = document.getElementById(
      "ez-commercial-toast"
    );

    if (!toast) return;

    toast.textContent = message;

    toast.style.borderColor =
      type === "error"
        ? "#fecaca"
        : "#bae6fd";

    toast.style.color =
      type === "error"
        ? "#b91c1c"
        : "#0369a1";

    toast.classList.add(
      "is-visible"
    );

    window.clearTimeout(
      showToast.timer
    );

    showToast.timer =
      window.setTimeout(() => {
        toast.classList.remove(
          "is-visible"
        );
      }, 3500);
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") {
        return;
      }

      [
        "campaign",
        "placement",
        "preview"
      ].forEach((type) => {
        closeModal(type);
      });
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.classList.contains(
          "ez-commercial-modal"
        )
      ) {
        const modal =
          event.target;

        if (
          modal.id ===
          "ez-commercial-campaign-modal"
        ) {
          closeModal("campaign");
        }

        if (
          modal.id ===
          "ez-commercial-placement-modal"
        ) {
          closeModal("placement");
        }

        if (
          modal.id ===
          "ez-commercial-preview-modal"
        ) {
          closeModal("preview");
        }
      }
    }
  );

  function initialize() {
    ensureStyles();

    const mount =
      getMount() ||
      createMountIfNeeded();

    if (!mount) {
      return;
    }

    if (
      document.getElementById(
        "ez-commercial-admin"
      )
    ) {
      return;
    }

    renderShell();

    refresh().catch((error) => {
      console.error(
        "EZ MEDIA Commercial initialization:",
        error
      );
    });
  }

  window.EZMediaAdminCommercial = {
    refresh,
    openCampaign: openCampaignModal,
    openPlacement: openPlacementModal,
    previewPlacement: openPlacementPreview,
    closeModal,
    getState: () => ({
      campaigns: [...state.campaigns],
      placements: [...state.placements],
      statistics: state.statistics
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
