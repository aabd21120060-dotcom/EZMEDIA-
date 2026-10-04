"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    system: "/api/system",
    database: "/api/system/database",
    storage: "/api/system/storage",
    storageTest: "/api/system/storage/test",
    modules: "/api/system/modules",
    health: "/api/system/health",
    runtime: "/api/system/runtime"
  };

  const STATE = {
    system: null,
    database: null,
    storage: null,
    modules: null,
    health: null,
    runtime: null,
    loading: false,
    lastUpdate: null,
    timer: null
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

  function formatNumber(value) {
    return new Intl.NumberFormat(
      "ar-SA"
    ).format(
      Number(value || 0)
    );
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
          timeStyle: "medium"
        }
      ).format(
        new Date(value)
      );
    } catch {
      return String(value);
    }
  }

  function formatUptime(seconds) {
    const total =
      Number(seconds || 0);

    if (!total) {
      return "—";
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
      parts.push(
        `${days} يوم`
      );
    }

    if (hours) {
      parts.push(
        `${hours} ساعة`
      );
    }

    if (minutes) {
      parts.push(
        `${minutes} دقيقة`
      );
    }

    if (
      secs ||
      !parts.length
    ) {
      parts.push(
        `${secs} ثانية`
      );
    }

    return parts.join(" و ");
  }

  function statusClass(ok) {
    return ok
      ? "ez-system-ok"
      : "ez-system-error";
  }

  function statusText(ok) {
    return ok
      ? "يعمل"
      : "يحتاج مراجعة";
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-system-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-system-style";

    style.textContent = `
      #ez-admin-system {
        direction: rtl;
        color: #0f172a;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          Arial,
          sans-serif;
      }

      .ez-system-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }

      .ez-system-title {
        margin: 0;
        color: #075985;
        font-size: 26px;
        font-weight: 950;
      }

      .ez-system-subtitle {
        margin: 7px 0 0;
        color: #64748b;
        font-size: 13px;
      }

      .ez-system-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ez-system-btn {
        border: 1px solid #bae6fd;
        border-radius: 13px;
        background: #fff;
        color: #0369a1;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 850;
        cursor: pointer;
        transition: .2s ease;
      }

      .ez-system-btn:hover {
        transform: translateY(-1px);
        border-color: #38bdf8;
      }

      .ez-system-btn.primary {
        border-color: transparent;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-system-btn.danger {
        color: #dc2626;
        border-color: #fecaca;
      }

      .ez-system-grid {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
        gap: 14px;
        margin-bottom: 20px;
      }

      .ez-system-card {
        background: #fff;
        border: 1px solid #e0f2fe;
        border-radius: 21px;
        padding: 19px;
        box-shadow:
          0 10px 30px
          rgba(14,165,233,.06);
      }

      .ez-system-card-label {
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
      }

      .ez-system-card-value {
        margin-top: 8px;
        color: #075985;
        font-size: 24px;
        font-weight: 950;
      }

      .ez-system-panel {
        background: #fff;
        border: 1px solid #e0f2fe;
        border-radius: 22px;
        overflow: hidden;
        margin-bottom: 20px;
        box-shadow:
          0 10px 30px
          rgba(14,165,233,.05);
      }

      .ez-system-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 17px 19px;
        background: #fafdff;
        border-bottom: 1px solid #e0f2fe;
      }

      .ez-system-panel-head h3 {
        margin: 0;
        color: #075985;
        font-size: 16px;
        font-weight: 900;
      }

      .ez-system-panel-body {
        padding: 19px;
      }

      .ez-system-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 900;
      }

      .ez-system-ok {
        background: #ecfdf5;
        color: #047857;
      }

      .ez-system-error {
        background: #fef2f2;
        color: #b91c1c;
      }

      .ez-system-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }

      .ez-system-list {
        display: grid;
        gap: 10px;
      }

      .ez-system-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        padding: 12px 14px;
        border: 1px solid #f0f9ff;
        border-radius: 13px;
        background: #fcfeff;
      }

      .ez-system-row strong {
        color: #334155;
        font-size: 13px;
      }

      .ez-system-row span {
        color: #64748b;
        font-size: 12px;
      }

      .ez-system-modules {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
        gap: 10px;
      }

      .ez-system-module {
        border: 1px solid #e0f2fe;
        border-radius: 16px;
        padding: 14px;
        background: #fbfeff;
      }

      .ez-system-module strong {
        display: block;
        color: #075985;
        margin-bottom: 5px;
        font-size: 13px;
      }

      .ez-system-module small {
        color: #64748b;
        font-size: 11px;
      }

      .ez-system-alert {
        border: 1px solid #fecaca;
        border-radius: 16px;
        padding: 14px;
        background: #fff7f7;
        color: #991b1b;
        margin-bottom: 15px;
        font-size: 13px;
        font-weight: 800;
      }

      .ez-system-success {
        border: 1px solid #bbf7d0;
        border-radius: 16px;
        padding: 14px;
        background: #f0fdf4;
        color: #166534;
        margin-bottom: 15px;
        font-size: 13px;
        font-weight: 800;
      }

      .ez-system-loading {
        padding: 45px 15px;
        text-align: center;
        color: #64748b;
      }

      .ez-system-time {
        color: #64748b;
        font-size: 11px;
      }

      @media (max-width: 700px) {
        .ez-system-title {
          font-size: 21px;
        }

        .ez-system-panel-body {
          padding: 13px;
        }

        .ez-system-row {
          align-items: flex-start;
          flex-direction: column;
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
        "#system-section"
      ) ||
      document.querySelector(
        "#admin-system-section"
      ) ||
      document.querySelector(
        '[data-admin-section="system"]'
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
      "admin-system-section";

    const parent =
      document.querySelector(
        "main"
      ) ||
      document.body;

    parent.appendChild(
      mount
    );

    return mount;
  }

  async function request(
    url,
    options = {}
  ) {
    const token =
      window
        .EZMediaAdminCore
        ?.getToken?.();

    const headers = {
      "Content-Type":
        "application/json",
      ...(options.headers || {})
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
          headers
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
      const error =
        new Error(
          data?.message ||
          data?.error ||
          `فشل الطلب (${response.status})`
        );

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    return data;
  }

  async function loadAll() {
    STATE.loading = true;

    try {
      const results =
        await Promise.allSettled([
          request(API.system),
          request(API.database),
          request(API.storage),
          request(API.modules),
          request(API.health),
          request(API.runtime)
        ]);

      STATE.system =
        results[0].status ===
        "fulfilled"
          ? results[0].value
          : null;

      STATE.database =
        results[1].status ===
        "fulfilled"
          ? results[1].value
          : null;

      STATE.storage =
        results[2].status ===
        "fulfilled"
          ? results[2].value
          : null;

      STATE.modules =
        results[3].status ===
        "fulfilled"
          ? results[3].value
          : null;

      STATE.health =
        results[4].status ===
        "fulfilled"
          ? results[4].value
          : null;

      STATE.runtime =
        results[5].status ===
        "fulfilled"
          ? results[5].value
          : null;

      STATE.lastUpdate =
        new Date();

    } finally {
      STATE.loading = false;
    }

    render();
  }

  function databaseReady() {
    const database =
      STATE.database ||
      STATE.system?.database;

    return Boolean(
      database?.connected === true ||
      database?.ready === true
    );
  }

  function storageReady() {
    const storage =
      STATE.storage ||
      STATE.system?.storage;

    return Boolean(
      storage?.configured === true
    );
  }

  function serverReady() {
    const health =
      STATE.health ||
      STATE.system;

    return Boolean(
      health?.status === "online" ||
      health?.ok === true ||
      health?.success === true
    );
  }

  function render() {
    injectStyles();

    const mount =
      createMount();

    mount.id =
      "ez-admin-system";

    if (STATE.loading &&
        !STATE.system &&
        !STATE.health) {
      mount.innerHTML = `
        <div class="ez-system-loading">
          جارٍ تحميل حالة النظام...
        </div>
      `;

      return;
    }

    const dbOk =
      databaseReady();

    const storageOk =
      storageReady();

    const serverOk =
      serverReady();

    const overall =
      serverOk &&
      dbOk &&
      storageOk;

    const runtime =
      STATE.runtime ||
      STATE.system?.runtime ||
      {};

    const node =
      runtime.node ||
      STATE.system?.node ||
      "—";

    const environment =
      runtime.environment ||
      STATE.system?.environment ||
      "—";

    const uptime =
      runtime.uptime ||
      STATE.system?.uptime ||
      0;

    mount.innerHTML = `
      <div class="ez-system-header">

        <div>
          <h2 class="ez-system-title">
            مركز النظام
          </h2>

          <p class="ez-system-subtitle">
            مراقبة وتشخيص البنية التشغيلية لمنصة EZ MEDIA 11.0
          </p>
        </div>

        <div class="ez-system-actions">

          <button
            class="ez-system-btn primary"
            data-system-action="refresh"
          >
            تحديث الحالة
          </button>

          <button
            class="ez-system-btn"
            data-system-action="storage-test"
          >
            اختبار التخزين
          </button>

        </div>

      </div>

      ${
        overall
          ? `
            <div class="ez-system-success">
              النظام الأساسي يعمل والحالة العامة مستقرة.
            </div>
          `
          : `
            <div class="ez-system-alert">
              توجد خدمة واحدة أو أكثر تحتاج إلى مراجعة.
            </div>
          `
      }

      <div class="ez-system-grid">

        <div class="ez-system-card">
          <div class="ez-system-card-label">
            حالة المنصة
          </div>

          <div class="ez-system-card-value">
            <span class="ez-system-status ${statusClass(
              serverOk
            )}">
              <span class="ez-system-dot"></span>
              ${statusText(
                serverOk
              )}
            </span>
          </div>
        </div>

        <div class="ez-system-card">
          <div class="ez-system-card-label">
            قاعدة البيانات
          </div>

          <div class="ez-system-card-value">
            <span class="ez-system-status ${statusClass(
              dbOk
            )}">
              <span class="ez-system-dot"></span>
              ${statusText(
                dbOk
              )}
            </span>
          </div>
        </div>

        <div class="ez-system-card">
          <div class="ez-system-card-label">
            التخزين
          </div>

          <div class="ez-system-card-value">
            <span class="ez-system-status ${statusClass(
              storageOk
            )}">
              <span class="ez-system-dot"></span>
              ${statusText(
                storageOk
              )}
            </span>
          </div>
        </div>

        <div class="ez-system-card">
          <div class="ez-system-card-label">
            Node.js
          </div>

          <div class="ez-system-card-value">
            ${escapeHtml(
              node
            )}
          </div>
        </div>

        <div class="ez-system-card">
          <div class="ez-system-card-label">
            مدة التشغيل
          </div>

          <div class="ez-system-card-value">
            ${escapeHtml(
              formatUptime(
                uptime
              )
            )}
          </div>
        </div>

      </div>

      <div class="ez-system-panel">

        <div class="ez-system-panel-head">

          <h3>
            حالة الخدمات الأساسية
          </h3>

          <span class="ez-system-time">
            آخر تحديث:
            ${formatDate(
              STATE.lastUpdate
            )}
          </span>

        </div>

        <div class="ez-system-panel-body">

          <div class="ez-system-list">

            <div class="ez-system-row">
              <strong>
                الخادم
              </strong>

              <span
                class="ez-system-status ${statusClass(
                  serverOk
                )}"
              >
                <span class="ez-system-dot"></span>
                ${statusText(
                  serverOk
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                PostgreSQL
              </strong>

              <span
                class="ez-system-status ${statusClass(
                  dbOk
                )}"
              >
                <span class="ez-system-dot"></span>
                ${statusText(
                  dbOk
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                التخزين السحابي
              </strong>

              <span
                class="ez-system-status ${statusClass(
                  storageOk
                )}"
              >
                <span class="ez-system-dot"></span>
                ${statusText(
                  storageOk
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                البيئة
              </strong>

              <span>
                ${escapeHtml(
                  environment
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                إصدار EZ MEDIA
              </strong>

              <span>
                ${VERSION}
              </span>
            </div>

          </div>

        </div>

      </div>

      ${renderDatabase()}

      ${renderStorage()}

      ${renderModules()}

      ${renderRuntime()}

    `;

    bindEvents();
  }

  function renderDatabase() {
    const database =
      STATE.database ||
      STATE.system?.database ||
      {};

    return `
      <div class="ez-system-panel">

        <div class="ez-system-panel-head">

          <h3>
            PostgreSQL
          </h3>

          <span
            class="ez-system-status ${statusClass(
              databaseReady()
            )}"
          >
            <span class="ez-system-dot"></span>
            ${statusText(
              databaseReady()
            )}
          </span>

        </div>

        <div class="ez-system-panel-body">

          <div class="ez-system-list">

            <div class="ez-system-row">
              <strong>
                الاتصال
              </strong>

              <span>
                ${
                  database.connected === true
                    ? "متصل"
                    : "غير متصل"
                }
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                قاعدة البيانات
              </strong>

              <span>
                ${escapeHtml(
                  database.databaseName ||
                  database.database_name ||
                  "غير متاحة"
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                وقت الخادم
              </strong>

              <span>
                ${formatDate(
                  database.serverTime ||
                  database.server_time
                )}
              </span>
            </div>

          </div>

        </div>

      </div>
    `;
  }

  function renderStorage() {
    const storage =
      STATE.storage ||
      STATE.system?.storage ||
      {};

    return `
      <div class="ez-system-panel">

        <div class="ez-system-panel-head">

          <h3>
            التخزين والوسائط
          </h3>

          <span
            class="ez-system-status ${statusClass(
              storageReady()
            )}"
          >
            <span class="ez-system-dot"></span>
            ${statusText(
              storageReady()
            )}
          </span>

        </div>

        <div class="ez-system-panel-body">

          <div class="ez-system-list">

            <div class="ez-system-row">
              <strong>
                الحالة
              </strong>

              <span>
                ${
                  storage.configured
                    ? "مهيأ"
                    : "غير مهيأ"
                }
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                المزود
              </strong>

              <span>
                ${escapeHtml(
                  storage.provider ||
                  "غير محدد"
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                الحاوية
              </strong>

              <span>
                ${
                  storage.bucket ===
                  "configured"
                    ? "مهيأة"
                    : "غير مهيأة"
                }
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                الرابط العام
              </strong>

              <span>
                ${
                  storage.publicUrl ===
                  "configured"
                    ? "مهيأ"
                    : "غير مهيأ"
                }
              </span>
            </div>

          </div>

        </div>

      </div>
    `;
  }

  function renderModules() {
    const source =
      STATE.modules;

    let modules = [];

    if (
      Array.isArray(
        source?.modules
      )
    ) {
      modules =
        source.modules;
    } else if (
      Array.isArray(
        source
      )
    ) {
      modules =
        source;
    } else if (
      source &&
      typeof source ===
        "object"
    ) {
      modules =
        Object.entries(
          source
        )
          .filter(
            ([key]) =>
              key !== "success" &&
              key !== "platform" &&
              key !== "version"
          )
          .map(
            ([key, value]) => ({
              name: key,
              ...(
                typeof value ===
                "object"
                  ? value
                  : {
                      status: value
                    }
              )
            })
          );
    }

    return `
      <div class="ez-system-panel">

        <div class="ez-system-panel-head">

          <h3>
            وحدات المنصة
          </h3>

        </div>

        <div class="ez-system-panel-body">

          ${
            modules.length
              ? `
                <div class="ez-system-modules">

                  ${modules
                    .map(
                      module => {

                        const ok =
                          module?.status ===
                            "online" ||
                          module?.status ===
                            "ready" ||
                          module?.healthy ===
                            true ||
                          module?.enabled ===
                            true;

                        return `
                          <div class="ez-system-module">

                            <strong>
                              ${escapeHtml(
                                module.name ||
                                module.key ||
                                module.title ||
                                "وحدة"
                              )}
                            </strong>

                            <small>
                              ${
                                module.status ||
                                (
                                  ok
                                    ? "جاهزة"
                                    : "غير متاحة"
                                )
                              }
                            </small>

                          </div>
                        `;
                      }
                    )
                    .join("")}

                </div>
              `
              : `
                <div class="ez-system-loading">
                  لا توجد بيانات وحدات متاحة حاليًا.
                </div>
              `
          }

        </div>

      </div>
    `;
  }

  function renderRuntime() {
    const runtime =
      STATE.runtime ||
      STATE.system?.runtime ||
      {};

    return `
      <div class="ez-system-panel">

        <div class="ez-system-panel-head">

          <h3>
            معلومات التشغيل
          </h3>

        </div>

        <div class="ez-system-panel-body">

          <div class="ez-system-list">

            <div class="ez-system-row">
              <strong>
                Node.js
              </strong>

              <span>
                ${escapeHtml(
                  runtime.node ||
                  STATE.system?.node ||
                  "—"
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                البيئة
              </strong>

              <span>
                ${escapeHtml(
                  runtime.environment ||
                  STATE.system?.environment ||
                  "—"
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                مدة التشغيل
              </strong>

              <span>
                ${escapeHtml(
                  formatUptime(
                    runtime.uptime ||
                    STATE.system?.uptime
                  )
                )}
              </span>
            </div>

            <div class="ez-system-row">
              <strong>
                آخر تحديث للواجهة
              </strong>

              <span>
                ${formatDate(
                  STATE.lastUpdate
                )}
              </span>
            </div>

          </div>

        </div>

      </div>
    `;
  }

  function bindEvents() {
    document
      .querySelectorAll(
        "[data-system-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              const action =
                button.dataset
                  .systemAction;

              if (
                action ===
                "refresh"
              ) {
                await refresh();
                return;
              }

              if (
                action ===
                "storage-test"
              ) {
                await testStorage();
              }
            }
          );

        }
      );
  }

  async function refresh() {
    if (STATE.loading) {
      return;
    }

    await loadAll();

    document.dispatchEvent(
      new CustomEvent(
        "ezmedia:system-updated",
        {
          detail: {
            state: STATE
          }
        }
      )
    );
  }

  async function testStorage() {
    try {

      const result =
        await request(
          API.storageTest,
          {
            method: "POST"
          }
        );

      const success =
        result?.success === true ||
        result?.storage?.success === true;

      alert(
        success
          ? "تم اختبار التخزين بنجاح."
          : "اكتمل الاختبار مع وجود ملاحظات."
      );

      await refresh();

    } catch (error) {

      alert(
        error?.message ||
        "تعذر اختبار التخزين."
      );
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    STATE.timer =
      setInterval(
        () => {

          if (
            document.hidden
          ) {
            return;
          }

          refresh();

        },
        30000
      );
  }

  function stopAutoRefresh() {
    if (
      STATE.timer
    ) {
      clearInterval(
        STATE.timer
      );

      STATE.timer =
        null;
    }
  }

  async function initialize() {
    injectStyles();

    await refresh();

    startAutoRefresh();
  }

  window.EZMediaAdminSystem = {
    initialize,
    refresh,
    testStorage,
    stopAutoRefresh,

    getState() {
      return {
        ...STATE
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
