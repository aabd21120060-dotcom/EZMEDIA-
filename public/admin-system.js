"use strict";

/*
 * EZ MEDIA 11.0
 * مركز النظام والإدارة التقنية
 *
 * الملف:
 * public/admin-system.js
 *
 * الوظائف:
 * - حالة المنصة
 * - حالة قاعدة البيانات
 * - حالة التخزين
 * - معلومات الخادم
 * - معلومات البيئة
 * - معلومات Railway
 * - معلومات API
 * - تحديث الحالة
 * - نسخ معلومات النظام
 * - تصدير تقرير النظام
 *
 * ملاحظة:
 * لا يحتوي هذا الملف على أسرار أو مفاتيح API.
 */

(() => {
  const state = {
    loading: false,
    refreshing: false,
    lastUpdated: null,

    system: null,
    health: null,
    database: null,
    storage: null,

    api: {
      available: true
    }
  };

  const selectors = [
    "#system-section",
    "#admin-system-section",
    '[data-admin-section="system"]'
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

  function formatDate(value) {
    if (!value) {
      return "غير متوفر";
    }

    try {
      return new Intl.DateTimeFormat(
        "ar-SA",
        {
          dateStyle: "medium",
          timeStyle: "medium"
        }
      ).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function formatBytes(value) {
    const bytes = Number(value);

    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB"
    ];

    const index = Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024)
      ),
      units.length - 1
    );

    const size =
      bytes /
      Math.pow(1024, index);

    return `${size.toFixed(
      index === 0 ? 0 : 2
    )} ${units[index]}`;
  }

  function formatUptime(seconds) {
    const total =
      Number(seconds);

    if (
      !Number.isFinite(total) ||
      total < 0
    ) {
      return "غير متوفر";
    }

    const days =
      Math.floor(
        total / 86400
      );

    const hours =
      Math.floor(
        (total % 86400) / 3600
      );

    const minutes =
      Math.floor(
        (total % 3600) / 60
      );

    const secs =
      Math.floor(
        total % 60
      );

    const parts = [];

    if (days) {
      parts.push(`${days} يوم`);
    }

    if (hours) {
      parts.push(`${hours} ساعة`);
    }

    if (minutes) {
      parts.push(`${minutes} دقيقة`);
    }

    if (
      !parts.length ||
      secs
    ) {
      parts.push(`${secs} ثانية`);
    }

    return parts.join(" و ");
  }

  function icon(name) {
    const icons = {
      system: "⚙️",
      server: "🖥️",
      database: "🗄️",
      storage: "☁️",
      api: "🔌",
      security: "🛡️",
      railway: "🚂",
      node: "⬢",
      environment: "🌐",
      refresh: "↻",
      copy: "⧉",
      export: "⬇️",
      check: "✓",
      warning: "!",
      error: "×",
      info: "i"
    };

    return icons[name] || "◉";
  }

  function statusInfo(status) {
    const value =
      String(
        status || ""
      ).toLowerCase();

    if (
      value === "online" ||
      value === "ready" ||
      value === "connected" ||
      value === "healthy" ||
      value === "active" ||
      value === "configured"
    ) {
      return {
        label: "يعمل",
        className: "success"
      };
    }

    if (
      value === "degraded" ||
      value === "warning" ||
      value === "testing"
    ) {
      return {
        label: "يحتاج متابعة",
        className: "warning"
      };
    }

    if (
      value === "offline" ||
      value === "error" ||
      value === "failed" ||
      value === "disconnected"
    ) {
      return {
        label: "متوقف",
        className: "danger"
      };
    }

    return {
      label: "غير معروف",
      className: "unknown"
    };
  }

  function statusBadge(status) {
    const info =
      statusInfo(status);

    return `
      <span
        class="ez-system-status ${info.className}"
      >
        <span
          class="ez-system-status-dot"
        ></span>

        ${escapeHtml(info.label)}
      </span>
    `;
  }

  async function request(
    path,
    options = {}
  ) {
    const response =
      await fetch(
        path,
        {
          ...options,
          headers: {
            "Content-Type":
              "application/json",
            ...(options.headers || {})
          }
        }
      );

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    let data;

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      data =
        await response.json();
    } else {
      data =
        await response.text();
    }

    if (!response.ok) {
      const message =
        data &&
        typeof data === "object" &&
        data.error
          ? data.error
          : `فشل الطلب (${response.status})`;

      throw new Error(
        message
      );
    }

    return data;
  }

  async function loadSystem() {
    try {
      const data =
        await request(
          "/api/system"
        );

      state.system =
        data.system ||
        data;

      return data;
    } catch (error) {
      console.warn(
        "EZ MEDIA system error:",
        error
      );

      state.system = null;

      return null;
    }
  }

  async function loadHealth() {
    try {
      const data =
        await request(
          "/health"
        );

      state.health =
        data;

      return data;
    } catch (error) {
      console.warn(
        "EZ MEDIA health error:",
        error
      );

      state.health = null;

      return null;
    }
  }

  async function loadDatabase() {
    try {
      const data =
        await request(
          "/api/system/database"
        );

      state.database =
        data.database ||
        data;

      return data;
    } catch (error) {
      console.warn(
        "EZ MEDIA database error:",
        error
      );

      state.database = null;

      return null;
    }
  }

  async function loadStorage() {
    try {
      const data =
        await request(
          "/api/storage/status"
        );

      state.storage =
        data.storage ||
        data;

      return data;
    } catch (error) {
      console.warn(
        "EZ MEDIA storage error:",
        error
      );

      state.storage = null;

      return null;
    }
  }

  function getDatabaseStatus() {
    if (!state.database) {
      return "unknown";
    }

    if (
      state.database.connected ===
      true
    ) {
      return "connected";
    }

    if (
      state.database.configured ===
      false
    ) {
      return "warning";
    }

    return "error";
  }

  function getStorageStatus() {
    if (!state.storage) {
      return "unknown";
    }

    if (
      state.storage.configured ===
      true
    ) {
      return "configured";
    }

    return "warning";
  }

  function getPlatformStatus() {
    if (
      state.health &&
      state.health.status
    ) {
      return state.health.status;
    }

    if (
      state.system &&
      state.system.status
    ) {
      return state.system.status;
    }

    return "unknown";
  }

  function getNodeVersion() {
    return (
      state.health?.server?.node ||
      state.health?.node ||
      state.system?.node ||
      "غير متوفر"
    );
  }

  function getEnvironment() {
    return (
      state.health?.server?.environment ||
      state.health?.environment ||
      state.system?.environment ||
      "غير متوفر"
    );
  }

  function getUptime() {
    return (
      state.health?.server?.uptime ||
      state.health?.uptime ||
      state.system?.uptime ||
      0
    );
  }

  function getDatabaseName() {
    return (
      state.health?.database?.databaseName ||
      state.database?.databaseName ||
      state.database?.database_name ||
      "غير متوفر"
    );
  }

  function getVersion() {
    return (
      state.health?.version ||
      state.system?.version ||
      "11.0.0"
    );
  }

  function getRailwayInfo() {
    return {
      service:
        state.system?.railway?.service ||
        state.system?.service ||
        window.__RAILWAY_SERVICE_NAME__ ||
        "غير متوفر",

      environment:
        state.system?.railway?.environment ||
        state.system?.railway?.environmentName ||
        window.__RAILWAY_ENVIRONMENT_NAME__ ||
        "غير متوفر",

      domain:
        state.system?.railway?.domain ||
        window.location.hostname ||
        "غير متوفر"
    };
  }

  function renderStyles() {
    if (
      document.getElementById(
        "ez-media-system-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-media-system-styles";

    style.textContent = `
      #ez-system-dashboard {
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

      #ez-system-dashboard * {
        box-sizing: border-box;
      }

      .ez-system-header {
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

      .ez-system-title {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .ez-system-title-icon {
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
      }

      .ez-system-title h2 {
        margin: 0;
        font-size: 23px;
        font-weight: 850;
      }

      .ez-system-title p {
        margin: 5px 0 0;
        color: #6a879c;
        font-size: 13px;
      }

      .ez-system-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ez-system-btn {
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

      .ez-system-btn:hover {
        transform: translateY(-1px);
        background: #f1fbff;
        box-shadow:
          0 8px 20px rgba(69, 180, 222, .12);
      }

      .ez-system-btn.primary {
        border-color: #87d8f4;
        background:
          linear-gradient(
            135deg,
            #dff8ff,
            #ffffff
          );
      }

      .ez-system-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        color: #7891a2;
        font-size: 12px;
      }

      .ez-system-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .ez-system-panel {
        min-width: 0;
        padding: 20px;
        border-radius: 22px;
        border: 1px solid #deeff7;
        background: #ffffff;
        box-shadow:
          0 10px 28px rgba(73, 159, 194, .06);
      }

      .ez-system-panel.full {
        grid-column: 1 / -1;
      }

      .ez-system-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      .ez-system-panel-header h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 850;
      }

      .ez-system-panel-header span {
        color: #7892a5;
        font-size: 11px;
      }

      .ez-system-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 850;
      }

      .ez-system-status.success {
        color: #267a62;
        background: #eafbf5;
      }

      .ez-system-status.warning {
        color: #997128;
        background: #fff9e8;
      }

      .ez-system-status.danger {
        color: #a34848;
        background: #fff0f0;
      }

      .ez-system-status.unknown {
        color: #637f90;
        background: #eef7fa;
      }

      .ez-system-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      .ez-system-info {
        display: grid;
        gap: 9px;
      }

      .ez-system-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        padding: 12px 14px;
        border-radius: 14px;
        background: #f9fdff;
        border: 1px solid #e4f2f8;
      }

      .ez-system-label {
        color: #668297;
        font-size: 12px;
        font-weight: 700;
      }

      .ez-system-value {
        color: #234d66;
        font-size: 12px;
        font-weight: 800;
        text-align: left;
        word-break: break-word;
      }

      .ez-system-cards {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .ez-system-card {
        padding: 16px;
        border-radius: 17px;
        border: 1px solid #e2f1f7;
        background: #fbfeff;
      }

      .ez-system-card-icon {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #eaf9ff;
        border: 1px solid #d5f1fb;
        font-size: 17px;
      }

      .ez-system-card-label {
        margin-top: 10px;
        color: #7b96a8;
        font-size: 11px;
      }

      .ez-system-card-value {
        margin-top: 6px;
        color: #1a506d;
        font-size: 18px;
        font-weight: 900;
        word-break: break-word;
      }

      .ez-system-copy {
        border: 1px solid #d6edf6;
        background: #ffffff;
        color: #4b7890;
        border-radius: 9px;
        padding: 5px 8px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 800;
      }

      .ez-system-copy:hover {
        background: #effaff;
      }

      .ez-system-notice {
        padding: 15px;
        border-radius: 16px;
        border: 1px solid #dceff7;
        background:
          linear-gradient(
            135deg,
            #f9feff,
            #f0fbff
          );
        color: #668496;
        font-size: 12px;
        line-height: 1.8;
      }

      .ez-system-loading {
        padding: 35px;
        text-align: center;
        color: #6d8999;
      }

      .ez-system-spinner {
        width: 32px;
        height: 32px;
        margin: 0 auto 12px;
        border-radius: 50%;
        border: 3px solid #dff3fa;
        border-top-color: #69cce9;
        animation:
          ezSystemSpin .8s linear infinite;
      }

      @keyframes ezSystemSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 1050px) {
        .ez-system-cards {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .ez-system-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .ez-system-actions {
          width: 100%;
        }

        .ez-system-btn {
          flex: 1;
        }

        .ez-system-grid {
          grid-template-columns: 1fr;
        }

        .ez-system-panel.full {
          grid-column: auto;
        }
      }

      @media (max-width: 500px) {
        .ez-system-cards {
          grid-template-columns: 1fr;
        }

        .ez-system-row {
          align-items: flex-start;
          flex-direction: column;
        }

        .ez-system-value {
          text-align: right;
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

    const platformStatus =
      getPlatformStatus();

    const databaseStatus =
      getDatabaseStatus();

    const storageStatus =
      getStorageStatus();

    const railway =
      getRailwayInfo();

    const nodeVersion =
      getNodeVersion();

    const environment =
      getEnvironment();

    const uptime =
      getUptime();

    const databaseName =
      getDatabaseName();

    const version =
      getVersion();

    const port =
      state.health?.server?.port ||
      state.health?.port ||
      state.system?.port ||
      "يتم تحديده تلقائيًا";

    root.innerHTML = `
      <div id="ez-system-dashboard">

        <div class="ez-system-header">

          <div>

            <div class="ez-system-title">

              <div class="ez-system-title-icon">
                ${icon("system")}
              </div>

              <div>

                <h2>
                  مركز النظام
                </h2>

                <p>
                  مراقبة حالة EZ MEDIA 11.0 والبنية التشغيلية من مكان واحد.
                </p>

              </div>

            </div>

            <div class="ez-system-meta">
              ${statusBadge(platformStatus)}

              <span>
                آخر تحديث:
                ${
                  state.lastUpdated
                    ? escapeHtml(
                        state.lastUpdated.toLocaleTimeString(
                          "ar-SA"
                        )
                      )
                    : "غير متوفر"
                }
              </span>
            </div>

          </div>

          <div class="ez-system-actions">

            <button
              type="button"
              class="ez-system-btn primary"
              id="ez-system-refresh"
            >
              ${icon("refresh")}
              تحديث الحالة
            </button>

            <button
              type="button"
              class="ez-system-btn"
              id="ez-system-copy"
            >
              ${icon("copy")}
              نسخ التقرير
            </button>

            <button
              type="button"
              class="ez-system-btn"
              id="ez-system-export"
            >
              ${icon("export")}
              تصدير
            </button>

          </div>

        </div>

        <div class="ez-system-grid">

          <section class="ez-system-panel full">

            <div class="ez-system-panel-header">
              <h3>
                الحالة العامة
              </h3>

              <span>
                EZ MEDIA 11.0
              </span>
            </div>

            <div class="ez-system-cards">

              <div class="ez-system-card">

                <div class="ez-system-card-icon">
                  ${icon("system")}
                </div>

                <div class="ez-system-card-label">
                  حالة المنصة
                </div>

                <div class="ez-system-card-value">
                  ${statusBadge(platformStatus)}
                </div>

              </div>

              <div class="ez-system-card">

                <div class="ez-system-card-icon">
                  ${icon("database")}
                </div>

                <div class="ez-system-card-label">
                  قاعدة البيانات
                </div>

                <div class="ez-system-card-value">
                  ${statusBadge(databaseStatus)}
                </div>

              </div>

              <div class="ez-system-card">

                <div class="ez-system-card-icon">
                  ${icon("storage")}
                </div>

                <div class="ez-system-card-label">
                  التخزين
                </div>

                <div class="ez-system-card-value">
                  ${statusBadge(storageStatus)}
                </div>

              </div>

              <div class="ez-system-card">

                <div class="ez-system-card-icon">
                  ${icon("api")}
                </div>

                <div class="ez-system-card-label">
                  API
                </div>

                <div class="ez-system-card-value">
                  ${statusBadge(
                    state.api.available
                      ? "online"
                      : "error"
                  )}
                </div>

              </div>

            </div>

          </section>

          <section class="ez-system-panel">

            <div class="ez-system-panel-header">

              <h3>
                الخادم
              </h3>

              <span>
                Runtime
              </span>

            </div>

            <div class="ez-system-info">

              <div class="ez-system-row">
                <span class="ez-system-label">
                  Node.js
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(nodeVersion)}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  البيئة
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(environment)}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  المنفذ
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(port)}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  مدة التشغيل
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(
                    formatUptime(
                      uptime
                    )
                  )}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  إصدار EZ MEDIA
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(version)}
                </strong>
              </div>

            </div>

          </section>

          <section class="ez-system-panel">

            <div class="ez-system-panel-header">

              <h3>
                PostgreSQL
              </h3>

              <span>
                قاعدة البيانات
              </span>

            </div>

            <div class="ez-system-info">

              <div class="ez-system-row">
                <span class="ez-system-label">
                  الحالة
                </span>

                ${statusBadge(databaseStatus)}
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  الإعداد
                </span>

                <strong class="ez-system-value">
                  ${
                    state.database?.configured === true
                      ? "مضبوط"
                      : "غير مضبوط"
                  }
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  الاتصال
                </span>

                <strong class="ez-system-value">
                  ${
                    state.database?.connected === true
                      ? "متصل"
                      : "غير متصل"
                  }
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  قاعدة البيانات
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(databaseName)}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  وقت الخادم
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(
                    formatDate(
                      state.database?.serverTime ||
                      state.database?.server_time
                    )
                  )}
                </strong>
              </div>

            </div>

          </section>

          <section class="ez-system-panel">

            <div class="ez-system-panel-header">

              <h3>
                التخزين السحابي
              </h3>

              <span>
                Media Storage
              </span>

            </div>

            <div class="ez-system-info">

              <div class="ez-system-row">
                <span class="ez-system-label">
                  الحالة
                </span>

                ${statusBadge(storageStatus)}
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  المزود
                </span>

                <strong class="ez-system-value">
                  ${
                    state.storage?.provider ||
                    "غير محدد"
                  }
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  Bucket
                </span>

                <strong class="ez-system-value">
                  ${
                    state.storage?.bucket ||
                    "غير محدد"
                  }
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  الرابط العام
                </span>

                <strong class="ez-system-value">
                  ${
                    state.storage?.publicUrl ||
                    "غير محدد"
                  }
                </strong>
              </div>

            </div>

          </section>

          <section class="ez-system-panel">

            <div class="ez-system-panel-header">

              <h3>
                Railway
              </h3>

              <span>
                الاستضافة
              </span>

            </div>

            <div class="ez-system-info">

              <div class="ez-system-row">
                <span class="ez-system-label">
                  الخدمة
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(
                    railway.service
                  )}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  البيئة
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(
                    railway.environment
                  )}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  النطاق
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(
                    railway.domain
                  )}
                </strong>
              </div>

              <div class="ez-system-row">
                <span class="ez-system-label">
                  الإصدار
                </span>

                <strong class="ez-system-value">
                  ${escapeHtml(version)}
                </strong>
              </div>

            </div>

          </section>

          <section class="ez-system-panel full">

            <div class="ez-system-panel-header">

              <h3>
                معلومات التشغيل
              </h3>

              <span>
                Runtime Information
              </span>

            </div>

            <div class="ez-system-notice">

              <strong>
                ${icon("info")}
                ملاحظة:
              </strong>

              هذا المركز يعرض معلومات التشغيل التي توفرها
              API الخاصة بالمنصة. لا يعرض المفاتيح السرية أو
              كلمات المرور أو قيم المتغيرات الحساسة داخل المتصفح.

            </div>

          </section>

        </div>

      </div>
    `;

    bindEvents();
  }

  function buildReport() {
    return {
      platform: "EZ MEDIA",
      version: getVersion(),

      generatedAt:
        new Date().toISOString(),

      status:
        getPlatformStatus(),

      server: {
        node:
          getNodeVersion(),

        environment:
          getEnvironment(),

        uptime:
          getUptime(),

        uptimeFormatted:
          formatUptime(
            getUptime()
          )
      },

      database: {
        configured:
          state.database?.configured ??
          false,

        connected:
          state.database?.connected ??
          false,

        databaseName:
          getDatabaseName(),

        serverTime:
          state.database?.serverTime ||
          state.database?.server_time ||
          null
      },

      storage: {
        configured:
          state.storage?.configured ??
          false,

        provider:
          state.storage?.provider ||
          null,

        bucket:
          state.storage?.bucket ||
          null,

        publicUrl:
          state.storage?.publicUrl ||
          null
      },

      railway: getRailwayInfo()
    };
  }

  function buildSafeTextReport() {
    const report =
      buildReport();

    return [
      "EZ MEDIA 11.0",
      "تقرير النظام",
      "",
      `الحالة: ${report.status}`,
      `الإصدار: ${report.version}`,
      "",
      "الخادم:",
      `Node.js: ${report.server.node}`,
      `البيئة: ${report.server.environment}`,
      `مدة التشغيل: ${report.server.uptimeFormatted}`,
      "",
      "قاعدة البيانات:",
      `الإعداد: ${
        report.database.configured
          ? "مضبوط"
          : "غير مضبوط"
      }`,
      `الاتصال: ${
        report.database.connected
          ? "متصل"
          : "غير متصل"
      }`,
      `اسم قاعدة البيانات: ${
        report.database.databaseName
      }`,
      "",
      "التخزين:",
      `الحالة: ${
        report.storage.configured
          ? "مضبوط"
          : "غير مضبوط"
      }`,
      `المزود: ${
        report.storage.provider ||
        "غير محدد"
      }`,
      "",
      "Railway:",
      `الخدمة: ${
        report.railway.service
      }`,
      `البيئة: ${
        report.railway.environment
      }`,
      `النطاق: ${
        report.railway.domain
      }`
    ].join("\n");
  }

  async function copyReport() {
    const text =
      buildSafeTextReport();

    try {
      await navigator.clipboard.writeText(
        text
      );

      showToast(
        "تم نسخ تقرير النظام"
      );
    } catch {
      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value = text;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();

      showToast(
        "تم نسخ التقرير"
      );
    }
  }

  function exportReport() {
    const report =
      buildReport();

    const blob =
      new Blob(
        [
          JSON.stringify(
            report,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;

    anchor.download =
      `ez-media-system-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );

    showToast(
      "تم تصدير تقرير النظام"
    );
  }

  function showToast(message) {
    let toast =
      document.getElementById(
        "ez-system-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-system-toast";

      toast.style.position =
        "fixed";

      toast.style.left =
        "20px";

      toast.style.bottom =
        "20px";

      toast.style.zIndex =
        "99999";

      toast.style.padding =
        "12px 16px";

      toast.style.borderRadius =
        "14px";

      toast.style.border =
        "1px solid #ccecf7";

      toast.style.background =
        "#ffffff";

      toast.style.color =
        "#24617b";

      toast.style.fontWeight =
        "800";

      toast.style.fontSize =
        "12px";

      toast.style.boxShadow =
        "0 10px 30px rgba(60,150,190,.15)";

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    toast.style.opacity =
      "1";

    clearTimeout(
      toast.__timer
    );

    toast.__timer =
      setTimeout(() => {
        toast.style.opacity =
          "0";
      }, 2200);
  }

  function bindEvents() {
    const refreshButton =
      document.getElementById(
        "ez-system-refresh"
      );

    const copyButton =
      document.getElementById(
        "ez-system-copy"
      );

    const exportButton =
      document.getElementById(
        "ez-system-export"
      );

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        refresh
      );
    }

    if (copyButton) {
      copyButton.addEventListener(
        "click",
        copyReport
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

    const root =
      getRoot();

    if (root) {
      const button =
        root.querySelector(
          "#ez-system-refresh"
        );

      if (button) {
        button.disabled =
          true;

        button.textContent =
          "⟳ جاري التحديث...";
      }
    }

    await Promise.all([
      loadSystem(),
      loadHealth(),
      loadDatabase(),
      loadStorage()
    ]);

    state.lastUpdated =
      new Date();

    state.refreshing =
      false;

    render();
  }

  async function init() {
    const root =
      getRoot();

    if (!root) {
      return;
    }

    renderStyles();

    root.innerHTML = `
      <div
        id="ez-system-dashboard"
        class="ez-system-loading"
      >
        <div class="ez-system-spinner"></div>

        <div>
          جاري تجهيز مركز النظام...
        </div>
      </div>
    `;

    await refresh();
  }

  window.EZMediaAdminSystem = {
    refresh,
    copyReport,
    exportReport,

    getState: () => ({
      ...state,
      system: state.system
        ? { ...state.system }
        : null,

      health: state.health
        ? { ...state.health }
        : null,

      database: state.database
        ? { ...state.database }
        : null,

      storage: state.storage
        ? { ...state.storage }
        : null
    })
  };

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
