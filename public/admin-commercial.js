"use strict";

/*
 * ============================================================
 * EZ MEDIA 11.0
 * مركز الإعلانات والرعايات والشراكات
 * ============================================================
 *
 * الملف:
 * public/admin-commercial.js
 *
 * الوظائف:
 * - إدارة الحملات
 * - الإعلانات
 * - الرعايات
 * - الشراكات
 * - إدارة المواضع الإعلانية
 * - الإحصائيات
 * - الظهور
 * - النقرات
 * - مشاهدات الفيديو
 * - الحملات النشطة
 * - البحث والتصفية
 * - إنشاء وتعديل الحملات
 * - إنشاء المواضع الإعلانية
 *
 * API:
 *
 * GET    /api/commercial/statistics
 * GET    /api/commercial/placements/active
 * POST   /api/commercial/events
 *
 * GET    /api/commercial/campaigns
 * POST   /api/commercial/campaigns
 * GET    /api/commercial/campaigns/:id
 * PATCH  /api/commercial/campaigns/:id
 * DELETE /api/commercial/campaigns/:id
 *
 * GET    /api/commercial/campaigns/:id/placements
 * POST   /api/commercial/campaigns/:id/placements
 *
 * ============================================================
 */

(function () {
  "use strict";

  const CONFIG = {
    API: "/api/commercial",
    REFRESH_INTERVAL: 30000,
    MAX_CAMPAIGNS: 100
  };

  const state = {
    campaigns: [],
    statistics: null,
    activePlacements: [],
    loading: false,
    statisticsLoading: false,
    editingId: null,
    search: "",
    type: "all",
    status: "all",
    selectedCampaignId: null,
    refreshTimer: null
  };

  const rootSelectors = [
    "#commercial-section",
    "#admin-commercial-section",
    "#ads-section",
    "#advertising-section",
    '[data-admin-section="commercial"]',
    '[data-admin-section="advertising"]'
  ];

  function getRoot() {
    for (const selector of rootSelectors) {
      const element =
        document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

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

  function formatNumber(value) {
    const number =
      Number(value) || 0;

    return new Intl.NumberFormat(
      "ar-SA"
    ).format(number);
  }

  function formatMoney(
    value,
    currency = "SAR"
  ) {
    const number =
      Number(value) || 0;

    try {
      return new Intl.NumberFormat(
        "ar-SA",
        {
          style: "currency",
          currency
        }
      ).format(number);
    } catch {
      return `${formatNumber(number)} ${currency}`;
    }
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "ar-SA",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    ).format(date);
  }

  function normalizeType(type) {
    const value =
      String(type || "")
        .toLowerCase();

    if (
      value === "sponsorship" ||
      value === "sponsor"
    ) {
      return "sponsorship";
    }

    if (
      value === "partnership" ||
      value === "partner"
    ) {
      return "partnership";
    }

    return "advertising";
  }

  function normalizeStatus(status) {
    const value =
      String(status || "")
        .toLowerCase();

    const allowed = [
      "draft",
      "pending",
      "approved",
      "active",
      "paused",
      "completed",
      "cancelled"
    ];

    if (
      allowed.includes(value)
    ) {
      return value;
    }

    return "draft";
  }

  function typeLabel(type) {
    const labels = {
      advertising: "إعلان",
      sponsorship: "رعاية",
      partnership: "شراكة"
    };

    return (
      labels[
        normalizeType(type)
      ] ||
      "إعلان"
    );
  }

  function statusLabel(status) {
    const labels = {
      draft: "مسودة",
      pending: "قيد المراجعة",
      approved: "معتمد",
      active: "نشط",
      paused: "متوقف",
      completed: "مكتمل",
      cancelled: "ملغى"
    };

    return (
      labels[
        normalizeStatus(status)
      ] ||
      "مسودة"
    );
  }

  function showToast(
    message,
    type = "info"
  ) {
    let container =
      document.getElementById(
        "ez-commercial-toast-container"
      );

    if (!container) {
      container =
        document.createElement(
          "div"
        );

      container.id =
        "ez-commercial-toast-container";

      container.innerHTML = `
        <style>

          #ez-commercial-toast-container {
            position: fixed;
            left: 20px;
            bottom: 20px;
            z-index: 99999;
            width: min(380px, calc(100vw - 40px));
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .ez-commercial-toast {
            background: rgba(255,255,255,.98);
            border: 1px solid #dbeafe;
            border-radius: 16px;
            padding: 14px 16px;
            box-shadow: 0 18px 50px rgba(15,23,42,.15);
            color: #0f172a;
            font-size: 14px;
            line-height: 1.7;
          }

          .ez-commercial-toast.success {
            border-right: 4px solid #16a34a;
          }

          .ez-commercial-toast.error {
            border-right: 4px solid #dc2626;
          }

          .ez-commercial-toast.warning {
            border-right: 4px solid #f59e0b;
          }

          .ez-commercial-toast.info {
            border-right: 4px solid #0ea5e9;
          }

        </style>
      `;

      document.body.appendChild(
        container
      );
    }

    const toast =
      document.createElement(
        "div"
      );

    toast.className =
      `ez-commercial-toast ${type}`;

    toast.textContent =
      message;

    container.appendChild(
      toast
    );

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
        Accept:
          "application/json",
        "Content-Type":
          "application/json",
        ...(options.headers || {})
      }
    };

    const response =
      await fetch(
        url,
        requestOptions
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `فشل الطلب HTTP ${response.status}`;

      throw new Error(
        message
      );
    }

    return data;
  }

  function extractItems(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (
      Array.isArray(
        data?.items
      )
    ) {
      return data.items;
    }

    if (
      Array.isArray(
        data?.campaigns
      )
    ) {
      return data.campaigns;
    }

    if (
      Array.isArray(
        data?.data
      )
    ) {
      return data.data;
    }

    if (
      Array.isArray(
        data?.rows
      )
    ) {
      return data.rows;
    }

    return [];
  }

  function extractSingle(data) {
    if (data?.campaign) {
      return data.campaign;
    }

    if (data?.item) {
      return data.item;
    }

    if (
      data?.data &&
      !Array.isArray(data.data)
    ) {
      return data.data;
    }

    return data;
  }

  async function loadCampaigns(
    options = {}
  ) {
    if (
      state.loading &&
      !options.force
    ) {
      return;
    }

    state.loading = true;

    try {
      const query =
        new URLSearchParams();

      query.set(
        "limit",
        String(
          CONFIG.MAX_CAMPAIGNS
        )
      );

      const data =
        await apiRequest(
          `${CONFIG.API}/campaigns?${query.toString()}`
        );

      state.campaigns =
        extractItems(data);

      render();
    } catch (error) {
      console.error(
        "EZ MEDIA Commercial:",
        error
      );

      showToast(
        `تعذر تحميل الحملات: ${error.message}`,
        "error"
      );
    } finally {
      state.loading =
        false;
    }
  }

  async function loadStatistics() {
    state.statisticsLoading =
      true;

    try {
      const data =
        await apiRequest(
          `${CONFIG.API}/statistics`
        );

      state.statistics =
        data?.statistics ||
        data?.data ||
        data ||
        null;

      render();
    } catch (error) {
      console.error(
        error
      );

      state.statistics =
        null;

      showToast(
        `تعذر تحميل إحصائيات الإعلانات: ${error.message}`,
        "error"
      );
    } finally {
      state.statisticsLoading =
        false;
    }
  }

  async function loadActivePlacements() {
    try {
      const data =
        await apiRequest(
          `${CONFIG.API}/placements/active`
        );

      state.activePlacements =
        extractItems(data);
    } catch (error) {
      console.warn(
        "تعذر تحميل المواضع النشطة:",
        error
      );

      state.activePlacements =
        [];
    }
  }

  function calculateLocalStats() {
    const campaigns =
      state.campaigns;

    const total =
      campaigns.length;

    const active =
      campaigns.filter(
        (item) =>
          normalizeStatus(
            item.status
          ) === "active"
      ).length;

    const pending =
      campaigns.filter(
        (item) =>
          normalizeStatus(
            item.status
          ) === "pending"
      ).length;

    const sponsorships =
      campaigns.filter(
        (item) =>
          normalizeType(
            item.campaign_type ||
              item.campaignType ||
              item.type
          ) === "sponsorship"
      ).length;

    const budget =
      campaigns.reduce(
        (sum, item) =>
          sum +
          (Number(
            item.budget
          ) || 0),
        0
      );

    return {
      total,
      active,
      pending,
      sponsorships,
      budget
    };
  }

  function getStatisticValue(
    keys
  ) {
    const source =
      state.statistics || {};

    for (const key of keys) {
      if (
        source[key] !==
        undefined
      ) {
        return source[key];
      }

      if (
        source.data &&
        source.data[key] !==
          undefined
      ) {
        return source.data[key];
      }

      if (
        source.statistics &&
        source.statistics[key] !==
          undefined
      ) {
        return source.statistics[key];
      }
    }

    return 0;
  }

  function getFilteredCampaigns() {
    const search =
      state.search
        .trim()
        .toLowerCase();

    return state.campaigns.filter(
      (campaign) => {
        const status =
          normalizeStatus(
            campaign.status
          );

        const type =
          normalizeType(
            campaign.campaign_type ||
              campaign.campaignType ||
              campaign.type
          );

        if (
          state.status !==
            "all" &&
          status !==
            state.status
        ) {
          return false;
        }

        if (
          state.type !==
            "all" &&
          type !==
            state.type
        ) {
          return false;
        }

        if (search) {
          const text = [
            campaign.name,
            campaign.advertiser_name,
            campaign.advertiserName,
            campaign.sponsor_name,
            campaign.sponsorName,
            campaign.contact_name,
            campaign.description,
            typeLabel(type),
            statusLabel(status)
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (
            !text.includes(
              search
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }

  function render() {
    const root =
      getRoot();

    if (!root) {
      return;
    }

    root.innerHTML = `
      <div class="ez-commercial-admin">

        ${renderStyles()}

        ${renderHeader()}

        ${renderStats()}

        ${renderToolbar()}

        ${renderCampaignList()}

      </div>
    `;

    bindEvents(root);
  }

  function renderHeader() {
    return `
      <div class="ez-commercial-header">

        <div>

          <div class="ez-commercial-kicker">
            EZ MEDIA 11.0
          </div>

          <h2>
            مركز الإعلانات والرعايات
          </h2>

          <p>
            إدارة الحملات التجارية والرعايات
            والشراكات وقياس الأداء من مكان واحد.
          </p>

        </div>

        <div class="ez-commercial-header-actions">

          <button
            type="button"
            class="ez-commercial-btn ez-commercial-btn-secondary"
            data-action="refresh"
          >
            تحديث
          </button>

          <button
            type="button"
            class="ez-commercial-btn ez-commercial-btn-primary"
            data-action="new-campaign"
          >
            + حملة جديدة
          </button>

        </div>

      </div>
    `;
  }

  function renderStats() {
    const local =
      calculateLocalStats();

    const impressions =
      getStatisticValue([
        "impressions",
        "total_impressions",
        "totalImpressions"
      ]);

    const clicks =
      getStatisticValue([
        "clicks",
        "total_clicks",
        "totalClicks"
      ]);

    const starts =
      getStatisticValue([
        "starts",
        "video_starts",
        "total_starts"
      ]);

    const completed =
      getStatisticValue([
        "completed_views",
        "completedViews",
        "completions"
      ]);

    return `
      <div class="ez-commercial-stats">

        ${statCard(
          "الحملات",
          local.total,
          "إجمالي الحملات"
        )}

        ${statCard(
          "الحملات النشطة",
          local.active,
          "تعمل حاليًا"
        )}

        ${statCard(
          "الرعايات",
          local.sponsorships,
          "حملات رعاية"
        )}

        ${statCard(
          "الميزانيات",
          formatMoney(local.budget),
          "إجمالي الميزانيات المسجلة"
        )}

        ${statCard(
          "الظهور",
          formatNumber(impressions),
          "Impressions"
        )}

        ${statCard(
          "النقرات",
          formatNumber(clicks),
          "Clicks"
        )}

        ${statCard(
          "بدء المشاهدة",
          formatNumber(starts),
          "Video Starts"
        )}

        ${statCard(
          "الإكمال",
          formatNumber(completed),
          "Completed Views"
        )}

      </div>
    `;
  }

  function statCard(
    title,
    value,
    subtitle
  ) {
    return `
      <div class="ez-commercial-stat">

        <div class="ez-commercial-stat-title">
          ${escapeHtml(title)}
        </div>

        <div class="ez-commercial-stat-value">
          ${escapeHtml(value)}
        </div>

        <div class="ez-commercial-stat-subtitle">
          ${escapeHtml(subtitle)}
        </div>

      </div>
    `;
  }

  function renderToolbar() {
    return `
      <div class="ez-commercial-toolbar">

        <div class="ez-commercial-search">

          <span>⌕</span>

          <input
            type="search"
            data-field="search"
            value="${escapeHtml(
              state.search
            )}"
            placeholder="ابحث عن حملة أو معلن أو راعٍ..."
          />

        </div>

        <select
          class="ez-commercial-select"
          data-field="type"
        >

          <option value="all"
            ${
              state.type ===
              "all"
                ? "selected"
                : ""
            }
          >
            كل الأنواع
          </option>

          <option value="advertising"
            ${
              state.type ===
              "advertising"
                ? "selected"
                : ""
            }
          >
            إعلانات
          </option>

          <option value="sponsorship"
            ${
              state.type ===
              "sponsorship"
                ? "selected"
                : ""
            }
          >
            رعايات
          </option>

          <option value="partnership"
            ${
              state.type ===
              "partnership"
                ? "selected"
                : ""
            }
          >
            شراكات
          </option>

        </select>

        <select
          class="ez-commercial-select"
          data-field="status"
        >

          <option value="all"
            ${
              state.status ===
              "all"
                ? "selected"
                : ""
            }
          >
            كل الحالات
          </option>

          <option value="draft"
            ${
              state.status ===
              "draft"
                ? "selected"
                : ""
            }
          >
            مسودة
          </option>

          <option value="pending"
            ${
              state.status ===
              "pending"
                ? "selected"
                : ""
            }
          >
            قيد المراجعة
          </option>

          <option value="approved"
            ${
              state.status ===
              "approved"
                ? "selected"
                : ""
            }
          >
            معتمد
          </option>

          <option value="active"
            ${
              state.status ===
              "active"
                ? "selected"
                : ""
            }
          >
            نشط
          </option>

          <option value="paused"
            ${
              state.status ===
              "paused"
                ? "selected"
                : ""
            }
          >
            متوقف
          </option>

          <option value="completed"
            ${
              state.status ===
              "completed"
                ? "selected"
                : ""
            }
          >
            مكتمل
          </option>

          <option value="cancelled"
            ${
              state.status ===
              "cancelled"
                ? "selected"
                : ""
            }
          >
            ملغى
          </option>

        </select>

      </div>
    `;
  }

  function renderCampaignList() {
    const campaigns =
      getFilteredCampaigns();

    if (!campaigns.length) {
      return `
        <div class="ez-commercial-empty">

          <div class="ez-commercial-empty-icon">
            $
          </div>

          <h3>
            لا توجد حملات
          </h3>

          <p>
            أنشئ أول حملة إعلانية أو رعاية
            لبدء الإدارة التجارية للمنصة.
          </p>

          <button
            type="button"
            class="ez-commercial-btn ez-commercial-btn-primary"
            data-action="new-campaign"
          >
            إنشاء حملة
          </button>

        </div>
      `;
    }

    return `
      <div class="ez-commercial-list">

        ${campaigns
          .map(
            renderCampaignCard
          )
          .join("")}

      </div>
    `;
  }

  function renderCampaignCard(
    campaign
  ) {
    const id =
      campaign.id ||
      campaign.uuid;

    const type =
      normalizeType(
        campaign.campaign_type ||
          campaign.campaignType ||
          campaign.type
      );

    const status =
      normalizeStatus(
        campaign.status
      );

    const name =
      campaign.name ||
      "حملة بدون اسم";

    const advertiser =
      campaign.advertiser_name ||
      campaign.advertiserName ||
      "";

    const sponsor =
      campaign.sponsor_name ||
      campaign.sponsorName ||
      "";

    const budget =
      campaign.budget;

    const currency =
      campaign.currency ||
      "SAR";

    const startAt =
      campaign.start_at ||
      campaign.startAt;

    const endAt =
      campaign.end_at ||
      campaign.endAt;

    return `
      <article
        class="ez-commercial-card"
        data-id="${escapeHtml(id)}"
      >

        <div class="ez-commercial-card-main">

          <div class="ez-commercial-card-top">

            <div class="ez-commercial-badges">

              <span class="ez-commercial-badge type">
                ${escapeHtml(
                  typeLabel(type)
                )}
              </span>

              <span
                class="ez-commercial-badge status-${escapeHtml(
                  status
                )}"
              >
                ${escapeHtml(
                  statusLabel(status)
                )}
              </span>

            </div>

            <span class="ez-commercial-date">
              ${escapeHtml(
                formatDate(
                  campaign.created_at ||
                    campaign.createdAt
                )
              )}
            </span>

          </div>

          <h3 class="ez-commercial-card-title">
            ${escapeHtml(name)}
          </h3>

          ${
            campaign.description
              ? `
                <p class="ez-commercial-card-description">
                  ${escapeHtml(
                    campaign.description
                  )}
                </p>
              `
              : ""
          }

          <div class="ez-commercial-card-info">

            ${
              advertiser
                ? `
                  <span>
                    المعلن:
                    <strong>
                      ${escapeHtml(
                        advertiser
                      )}
                    </strong>
                  </span>
                `
                : ""
            }

            ${
              sponsor
                ? `
                  <span>
                    الراعي:
                    <strong>
                      ${escapeHtml(
                        sponsor
                      )}
                    </strong>
                  </span>
                `
                : ""
            }

            <span>
              الميزانية:
              <strong>
                ${escapeHtml(
                  formatMoney(
                    budget,
                    currency
                  )
                )}
              </strong>
            </span>

          </div>

          <div class="ez-commercial-card-dates">

            <span>
              البداية:
              ${escapeHtml(
                formatDate(
                  startAt
                )
              )}
            </span>

            <span>
              النهاية:
              ${escapeHtml(
                formatDate(
                  endAt
                )
              )}
            </span>

          </div>

        </div>

        <div class="ez-commercial-card-actions">

          ${
            status !==
            "active"
              ? `
                <button
                  type="button"
                  class="ez-commercial-action activate"
                  data-action="activate"
                  data-id="${escapeHtml(
                    id
                  )}"
                >
                  تفعيل
                </button>
              `
              : `
                <button
                  type="button"
                  class="ez-commercial-action pause"
                  data-action="pause"
                  data-id="${escapeHtml(
                    id
                  )}"
                >
                  إيقاف
                </button>
              `
          }

          <button
            type="button"
            class="ez-commercial-action"
            data-action="placements"
            data-id="${escapeHtml(
              id
            )}"
          >
            المواضع
          </button>

          <button
            type="button"
            class="ez-commercial-action"
            data-action="edit"
            data-id="${escapeHtml(
              id
            )}"
          >
            تعديل
          </button>

          <button
            type="button"
            class="ez-commercial-action danger"
            data-action="delete"
            data-id="${escapeHtml(
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
    const refresh =
      root.querySelector(
        '[data-action="refresh"]'
      );

    if (refresh) {
      refresh.addEventListener(
        "click",
        () => {
          refreshAll();
        }
      );
    }

    root
      .querySelectorAll(
        '[data-action="new-campaign"]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              openCampaignEditor();
            }
          );
        }
      );

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

    const type =
      root.querySelector(
        '[data-field="type"]'
      );

    if (type) {
      type.addEventListener(
        "change",
        (event) => {
          state.type =
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

    root
      .querySelectorAll(
        "[data-action]"
      )
      .forEach(
        (button) => {
          const action =
            button.dataset.action;

          const id =
            button.dataset.id;

          if (
            action ===
            "edit"
          ) {
            button.addEventListener(
              "click",
              () => {
                openCampaignEditor(
                  id
                );
              }
            );
          }

          if (
            action ===
            "delete"
          ) {
            button.addEventListener(
              "click",
              () => {
                deleteCampaign(
                  id
                );
              }
            );
          }

          if (
            action ===
            "activate"
          ) {
            button.addEventListener(
              "click",
              () => {
                updateCampaignStatus(
                  id,
                  "active"
                );
              }
            );
          }

          if (
            action ===
            "pause"
          ) {
            button.addEventListener(
              "click",
              () => {
                updateCampaignStatus(
                  id,
                  "paused"
                );
              }
            );
          }

          if (
            action ===
            "placements"
          ) {
            button.addEventListener(
              "click",
              () => {
                openPlacements(
                  id
                );
              }
            );
          }
        }
      );
  }

  function openCampaignEditor(
    id = null
  ) {
    state.editingId =
      id;

    const campaign =
      id
        ? state.campaigns.find(
            (item) =>
              String(
                item.id ||
                  item.uuid
              ) ===
              String(id)
          )
        : null;

    showCampaignModal(
      campaign
    );
  }

  function showCampaignModal(
    campaign
  ) {
    const isEdit =
      Boolean(campaign);

    const id =
      campaign?.id ||
      campaign?.uuid ||
      "";

    const type =
      normalizeType(
        campaign?.campaign_type ||
          campaign?.campaignType ||
          campaign?.type
      );

    const status =
      normalizeStatus(
        campaign?.status
      );

    const modal =
      document.createElement(
        "div"
      );

    modal.className =
      "ez-commercial-modal";

    modal.innerHTML = `
      <div class="ez-commercial-modal-backdrop"></div>

      <div
        class="ez-commercial-modal-dialog"
        role="dialog"
        aria-modal="true"
      >

        <div class="ez-commercial-modal-header">

          <div>

            <div class="ez-commercial-kicker">
              EZ MEDIA COMMERCIAL ENGINE
            </div>

            <h2>
              ${
                isEdit
                  ? "تعديل الحملة"
                  : "إنشاء حملة جديدة"
              }
            </h2>

          </div>

          <button
            type="button"
            class="ez-commercial-close"
            data-modal="close"
          >
            ×
          </button>

        </div>

        <form
          class="ez-commercial-form"
          id="ez-commercial-campaign-form"
        >

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(id)}"
          />

          <div class="ez-commercial-form-grid">

            <div class="ez-commercial-field full">

              <label>
                اسم الحملة
              </label>

              <input
                name="name"
                required
                maxlength="300"
                value="${escapeHtml(
                  campaign?.name ||
                    ""
                )}"
                placeholder="مثال: حملة اليوم الوطني"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                نوع الحملة
              </label>

              <select name="campaign_type">

                <option value="advertising"
                  ${
                    type ===
                    "advertising"
                      ? "selected"
                      : ""
                  }
                >
                  إعلان
                </option>

                <option value="sponsorship"
                  ${
                    type ===
                    "sponsorship"
                      ? "selected"
                      : ""
                  }
                >
                  رعاية
                </option>

                <option value="partnership"
                  ${
                    type ===
                    "partnership"
                      ? "selected"
                      : ""
                  }
                >
                  شراكة
                </option>

              </select>

            </div>

            <div class="ez-commercial-field">

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

                <option value="pending"
                  ${
                    status ===
                    "pending"
                      ? "selected"
                      : ""
                  }
                >
                  قيد المراجعة
                </option>

                <option value="approved"
                  ${
                    status ===
                    "approved"
                      ? "selected"
                      : ""
                  }
                >
                  معتمد
                </option>

                <option value="active"
                  ${
                    status ===
                    "active"
                      ? "selected"
                      : ""
                  }
                >
                  نشط
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

                <option value="completed"
                  ${
                    status ===
                    "completed"
                      ? "selected"
                      : ""
                  }
                >
                  مكتمل
                </option>

                <option value="cancelled"
                  ${
                    status ===
                    "cancelled"
                      ? "selected"
                      : ""
                  }
                >
                  ملغى
                </option>

              </select>

            </div>

            <div class="ez-commercial-field">

              <label>
                اسم المعلن
              </label>

              <input
                name="advertiser_name"
                maxlength="300"
                value="${escapeHtml(
                  campaign?.advertiser_name ||
                    campaign?.advertiserName ||
                    ""
                )}"
                placeholder="اسم الجهة المعلنة"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                اسم الراعي
              </label>

              <input
                name="sponsor_name"
                maxlength="300"
                value="${escapeHtml(
                  campaign?.sponsor_name ||
                    campaign?.sponsorName ||
                    ""
                )}"
                placeholder="اسم الراعي"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                مسؤول التواصل
              </label>

              <input
                name="contact_name"
                maxlength="200"
                value="${escapeHtml(
                  campaign?.contact_name ||
                    campaign?.contactName ||
                    ""
                )}"
                placeholder="اسم المسؤول"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                البريد الإلكتروني
              </label>

              <input
                type="email"
                name="contact_email"
                maxlength="300"
                value="${escapeHtml(
                  campaign?.contact_email ||
                    campaign?.contactEmail ||
                    ""
                )}"
                placeholder="البريد الإلكتروني"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                رقم التواصل
              </label>

              <input
                name="contact_phone"
                maxlength="50"
                value="${escapeHtml(
                  campaign?.contact_phone ||
                    campaign?.contactPhone ||
                    ""
                )}"
                placeholder="رقم التواصل"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                الميزانية
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                name="budget"
                value="${escapeHtml(
                  campaign?.budget ||
                    ""
                )}"
                placeholder="0"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                العملة
              </label>

              <select name="currency">

                <option value="SAR"
                  ${
                    (campaign?.currency ||
                      "SAR") ===
                    "SAR"
                      ? "selected"
                      : ""
                  }
                >
                  ريال سعودي
                </option>

                <option value="USD"
                  ${
                    campaign?.currency ===
                    "USD"
                      ? "selected"
                      : ""
                  }
                >
                  دولار أمريكي
                </option>

                <option value="AED"
                  ${
                    campaign?.currency ===
                    "AED"
                      ? "selected"
                      : ""
                  }
                >
                  درهم إماراتي
                </option>

                <option value="KWD"
                  ${
                    campaign?.currency ===
                    "KWD"
                      ? "selected"
                      : ""
                  }
                >
                  دينار كويتي
                </option>

              </select>

            </div>

            <div class="ez-commercial-field">

              <label>
                تاريخ البداية
              </label>

              <input
                type="datetime-local"
                name="start_at"
                value="${escapeHtml(
                  toDatetimeLocal(
                    campaign?.start_at ||
                      campaign?.startAt
                  )
                )}"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                تاريخ النهاية
              </label>

              <input
                type="datetime-local"
                name="end_at"
                value="${escapeHtml(
                  toDatetimeLocal(
                    campaign?.end_at ||
                      campaign?.endAt
                  )
                )}"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                الأولوية
              </label>

              <input
                type="number"
                name="priority"
                min="0"
                max="1000"
                value="${escapeHtml(
                  campaign?.priority ??
                    0
                )}"
              />

            </div>

            <div class="ez-commercial-field full">

              <label>
                وصف الحملة
              </label>

              <textarea
                name="description"
                rows="5"
                maxlength="5000"
                placeholder="وصف الحملة وأهدافها..."
              >${escapeHtml(
                campaign?.description ||
                  ""
              )}</textarea>

            </div>

            <div class="ez-commercial-field full">

              <label>
                الاستهداف الذكي
              </label>

              <textarea
                name="targeting"
                rows="4"
                placeholder='مثال: {"device":"mobile","section":"news"}'
              >${escapeHtml(
                campaign?.targeting
                  ? typeof campaign.targeting ===
                    "string"
                    ? campaign.targeting
                    : JSON.stringify(
                        campaign.targeting,
                        null,
                        2
                      )
                  : ""
              )}</textarea>

            </div>

          </div>

          <div class="ez-commercial-form-footer">

            <button
              type="button"
              class="ez-commercial-btn ez-commercial-btn-secondary"
              data-modal="close"
            >
              إلغاء
            </button>

            <button
              type="submit"
              class="ez-commercial-btn ez-commercial-btn-primary"
            >
              ${
                isEdit
                  ? "حفظ التعديلات"
                  : "إنشاء الحملة"
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
        '[data-modal="close"]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              modal.remove();
            }
          );
        }
      );

    modal
      .querySelector(
        ".ez-commercial-modal-backdrop"
      )
      .addEventListener(
        "click",
        () => {
          modal.remove();
        }
      );

    const form =
      modal.querySelector(
        "#ez-commercial-campaign-form"
      );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await saveCampaign(
          form,
          modal
        );
      }
    );
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

  function parseJson(
    value,
    fallback = {}
  ) {
    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(
        value
      );
    } catch {
      return fallback;
    }
  }

  async function saveCampaign(
    form,
    modal
  ) {
    const formData =
      new FormData(form);

    const id =
      String(
        formData.get("id") ||
          ""
      ).trim();

    const payload = {
      name:
        String(
          formData.get("name") ||
            ""
        ).trim(),

      campaign_type:
        formData.get(
          "campaign_type"
        ),

      status:
        formData.get(
          "status"
        ),

      advertiser_name:
        String(
          formData.get(
            "advertiser_name"
          ) || ""
        ).trim(),

      sponsor_name:
        String(
          formData.get(
            "sponsor_name"
          ) || ""
        ).trim(),

      contact_name:
        String(
          formData.get(
            "contact_name"
          ) || ""
        ).trim(),

      contact_email:
        String(
          formData.get(
            "contact_email"
          ) || ""
        ).trim(),

      contact_phone:
        String(
          formData.get(
            "contact_phone"
          ) || ""
        ).trim(),

      description:
        String(
          formData.get(
            "description"
          ) || ""
        ).trim(),

      budget:
        formData.get(
          "budget"
        )
          ? Number(
              formData.get(
                "budget"
              )
            )
          : 0,

      currency:
        formData.get(
          "currency"
        ) || "SAR",

      start_at:
        formData.get(
          "start_at"
        ) || null,

      end_at:
        formData.get(
          "end_at"
        ) || null,

      priority:
        Number(
          formData.get(
            "priority"
          ) || 0
        ),

      targeting:
        parseJson(
          String(
            formData.get(
              "targeting"
            ) || ""
          ).trim(),
          {}
        )
    };

    if (!payload.name) {
      showToast(
        "اسم الحملة مطلوب.",
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
            `${CONFIG.API}/campaigns/${encodeURIComponent(
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
            `${CONFIG.API}/campaigns`,
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
        upsertCampaign(
          saved
        );
      }

      modal.remove();

      showToast(
        id
          ? "تم تحديث الحملة."
          : "تم إنشاء الحملة.",
        "success"
      );

      await refreshAll();
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر حفظ الحملة: ${error.message}`,
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          id
            ? "حفظ التعديلات"
            : "إنشاء الحملة";
      }
    }
  }

  function upsertCampaign(
    campaign
  ) {
    if (!campaign) {
      return;
    }

    const id =
      campaign.id ||
      campaign.uuid;

    if (!id) {
      return;
    }

    const index =
      state.campaigns.findIndex(
        (item) =>
          String(
            item.id ||
              item.uuid
          ) ===
          String(id)
      );

    if (index === -1) {
      state.campaigns.unshift(
        campaign
      );
    } else {
      state.campaigns[
        index
      ] = {
        ...state.campaigns[
          index
        ],
        ...campaign
      };
    }
  }

  async function updateCampaignStatus(
    id,
    status
  ) {
    if (!id) {
      return;
    }

    try {
      await apiRequest(
        `${CONFIG.API}/campaigns/${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status
          })
        }
      );

      showToast(
        status === "active"
          ? "تم تفعيل الحملة."
          : "تم إيقاف الحملة.",
        "success"
      );

      await refreshAll();
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر تحديث حالة الحملة: ${error.message}`,
        "error"
      );
    }
  }

  async function deleteCampaign(
    id
  ) {
    if (!id) {
      return;
    }

    const confirmed =
      window.confirm(
        "هل أنت متأكد من حذف هذه الحملة؟"
      );

    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(
        `${CONFIG.API}/campaigns/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE"
        }
      );

      state.campaigns =
        state.campaigns.filter(
          (campaign) =>
            String(
              campaign.id ||
                campaign.uuid
            ) !== String(id)
        );

      showToast(
        "تم حذف الحملة.",
        "success"
      );

      render();
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر حذف الحملة: ${error.message}`,
        "error"
      );
    }
  }

  async function openPlacements(
    campaignId
  ) {
    if (!campaignId) {
      return;
    }

    state.selectedCampaignId =
      campaignId;

    try {
      const data =
        await apiRequest(
          `${CONFIG.API}/campaigns/${encodeURIComponent(
            campaignId
          )}/placements`
        );

      const placements =
        extractItems(data);

      showPlacementsModal(
        campaignId,
        placements
      );
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر تحميل المواضع الإعلانية: ${error.message}`,
        "error"
      );
    }
  }

  function showPlacementsModal(
    campaignId,
    placements
  ) {
    const campaign =
      state.campaigns.find(
        (item) =>
          String(
            item.id ||
              item.uuid
          ) ===
          String(campaignId)
      );

    const modal =
      document.createElement(
        "div"
      );

    modal.className =
      "ez-commercial-modal";

    modal.innerHTML = `
      <div class="ez-commercial-modal-backdrop"></div>

      <div
        class="ez-commercial-modal-dialog placement-dialog"
        role="dialog"
        aria-modal="true"
      >

        <div class="ez-commercial-modal-header">

          <div>

            <div class="ez-commercial-kicker">
              COMMERCIAL PLACEMENTS
            </div>

            <h2>
              مواضع الحملة
            </h2>

            <p class="ez-commercial-modal-subtitle">
              ${escapeHtml(
                campaign?.name ||
                  "الحملة"
              )}
            </p>

          </div>

          <button
            type="button"
            class="ez-commercial-close"
            data-modal="close"
          >
            ×
          </button>

        </div>

        <div class="ez-commercial-placement-body">

          <div class="ez-commercial-placement-actions">

            <button
              type="button"
              class="ez-commercial-btn ez-commercial-btn-primary"
              data-modal-action="new-placement"
            >
              + إضافة موضع
            </button>

          </div>

          <div class="ez-commercial-placement-list">

            ${
              placements.length
                ? placements
                    .map(
                      renderPlacement
                    )
                    .join("")
                : `
                  <div class="ez-commercial-empty small">
                    لا توجد مواضع لهذه الحملة.
                  </div>
                `
            }

          </div>

        </div>

      </div>
    `;

    document.body.appendChild(
      modal
    );

    modal
      .querySelectorAll(
        '[data-modal="close"]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              modal.remove();
            }
          );
        }
      );

    modal
      .querySelector(
        ".ez-commercial-modal-backdrop"
      )
      .addEventListener(
        "click",
        () => {
          modal.remove();
        }
      );

    const newPlacement =
      modal.querySelector(
        '[data-modal-action="new-placement"]'
      );

    if (newPlacement) {
      newPlacement.addEventListener(
        "click",
        () => {
          showPlacementEditor(
            campaignId,
            modal
          );
        }
      );
    }
  }

  function renderPlacement(
    placement
  ) {
    const status =
      String(
        placement.status ||
          "draft"
      ).toLowerCase();

    const type =
      placement.placement_type ||
      placement.placementType ||
      "banner";

    return `
      <div class="ez-commercial-placement-card">

        <div>

          <strong>
            ${escapeHtml(
              placement.title ||
                placement.placement_key ||
                "موضع إعلاني"
            )}
          </strong>

          <div class="ez-commercial-placement-meta">

            <span>
              ${escapeHtml(
                placementTypeLabel(
                  type
                )
              )}
            </span>

            <span>
              ${escapeHtml(
                placement.placement_key ||
                  "بدون مفتاح"
              )}
            </span>

            <span>
              ${escapeHtml(
                status
              )}
            </span>

          </div>

        </div>

        <div class="ez-commercial-placement-metrics">

          <span>
            ظهور:
            ${formatNumber(
              placement.impressions
            )}
          </span>

          <span>
            نقرات:
            ${formatNumber(
              placement.clicks
            )}
          </span>

        </div>

      </div>
    `;
  }

  function placementTypeLabel(
    type
  ) {
    const labels = {
      banner: "بانر",
      native: "إعلان أصلي",
      video: "فيديو",
      live: "بث",
      article: "مقال",
      section: "قسم",
      homepage: "الصفحة الرئيسية"
    };

    return (
      labels[type] ||
      type ||
      "إعلان"
    );
  }

  function showPlacementEditor(
    campaignId,
    parentModal
  ) {
    const modal =
      document.createElement(
        "div"
      );

    modal.className =
      "ez-commercial-modal ez-commercial-modal-inner";

    modal.innerHTML = `
      <div class="ez-commercial-modal-backdrop"></div>

      <div
        class="ez-commercial-modal-dialog placement-editor-dialog"
        role="dialog"
        aria-modal="true"
      >

        <div class="ez-commercial-modal-header">

          <div>

            <div class="ez-commercial-kicker">
              COMMERCIAL ENGINE
            </div>

            <h2>
              إضافة موضع إعلاني
            </h2>

          </div>

          <button
            type="button"
            class="ez-commercial-close"
            data-modal="close"
          >
            ×
          </button>

        </div>

        <form
          id="ez-commercial-placement-form"
          class="ez-commercial-form"
        >

          <div class="ez-commercial-form-grid">

            <div class="ez-commercial-field">

              <label>
                مفتاح الموضع
              </label>

              <input
                name="placement_key"
                required
                maxlength="150"
                placeholder="homepage_top"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                نوع الموضع
              </label>

              <select name="placement_type">

                <option value="homepage">
                  الصفحة الرئيسية
                </option>

                <option value="banner">
                  بانر
                </option>

                <option value="native">
                  إعلان أصلي
                </option>

                <option value="video">
                  فيديو
                </option>

                <option value="live">
                  البث
                </option>

                <option value="article">
                  مقال
                </option>

                <option value="section">
                  قسم
                </option>

              </select>

            </div>

            <div class="ez-commercial-field full">

              <label>
                عنوان الإعلان
              </label>

              <input
                name="title"
                maxlength="300"
                placeholder="عنوان الإعلان"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                رابط الصورة
              </label>

              <input
                name="image_url"
                type="url"
                placeholder="https://..."
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                رابط الفيديو
              </label>

              <input
                name="video_url"
                type="url"
                placeholder="https://..."
              />

            </div>

            <div class="ez-commercial-field full">

              <label>
                رابط الوجهة
              </label>

              <input
                name="destination_url"
                type="url"
                placeholder="https://..."
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                معرف المحتوى
              </label>

              <input
                name="content_id"
                placeholder="اختياري"
              />

            </div>

            <div class="ez-commercial-field">

              <label>
                الحالة
              </label>

              <select name="status">

                <option value="draft">
                  مسودة
                </option>

                <option value="active">
                  نشط
                </option>

                <option value="paused">
                  متوقف
                </option>

              </select>

            </div>

          </div>

          <div class="ez-commercial-form-footer">

            <button
              type="button"
              class="ez-commercial-btn ez-commercial-btn-secondary"
              data-modal="close"
            >
              إلغاء
            </button>

            <button
              type="submit"
              class="ez-commercial-btn ez-commercial-btn-primary"
            >
              إنشاء الموضع
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
        '[data-modal="close"]'
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              modal.remove();
            }
          );
        }
      );

    modal
      .querySelector(
        ".ez-commercial-modal-backdrop"
      )
      .addEventListener(
        "click",
        () => {
          modal.remove();
        }
      );

    const form =
      modal.querySelector(
        "#ez-commercial-placement-form"
      );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await savePlacement(
          form,
          modal,
          parentModal,
          campaignId
        );
      }
    );
  }

  async function savePlacement(
    form,
    modal,
    parentModal,
    campaignId
  ) {
    const formData =
      new FormData(form);

    const payload = {
      placement_key:
        String(
          formData.get(
            "placement_key"
          ) || ""
        ).trim(),

      placement_type:
        formData.get(
          "placement_type"
        ),

      title:
        String(
          formData.get(
            "title"
          ) || ""
        ).trim(),

      image_url:
        String(
          formData.get(
            "image_url"
          ) || ""
        ).trim(),

      video_url:
        String(
          formData.get(
            "video_url"
          ) || ""
        ).trim(),

      destination_url:
        String(
          formData.get(
           
