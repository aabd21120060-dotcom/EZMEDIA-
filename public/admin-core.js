"use strict";

(function () {
  const EZ_ADMIN = {
    version: "11.0.0",
    initialized: false,
    user: null,
    token: null,
    users: [],
    auditLogs: [],
    auditStats: null,
    filters: {
      usersSearch: "",
      usersRole: "",
      usersStatus: "",
      auditSearch: "",
      auditAction: "",
      auditModule: ""
    }
  };

  const API = {
    me: "/api/auth/me",
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    logoutAll: "/api/auth/logout-all",

    users: "/api/auth/users",
    usersManagement: "/api/users",

    audit: "/api/audit",
    auditStats: "/api/audit/statistics/summary",

    system: "/api/system"
  };

  const STORAGE = {
    token: "ez_media_admin_session"
  };

  const ROLES = [
    {
      key: "super_admin",
      name: "المدير الأعلى",
      description: "صلاحيات كاملة على المنصة"
    },
    {
      key: "admin",
      name: "مدير",
      description: "إدارة تشغيلية متقدمة"
    },
    {
      key: "editor",
      name: "محرر",
      description: "إدارة المحتوى والتحرير"
    },
    {
      key: "producer",
      name: "منتج",
      description: "إدارة الإنتاج والمحتوى المرئي"
    },
    {
      key: "journalist",
      name: "صحفي",
      description: "إنشاء وإدارة المواد الصحفية"
    },
    {
      key: "media_manager",
      name: "مدير الوسائط",
      description: "إدارة مكتبة الوسائط"
    },
    {
      key: "commercial_manager",
      name: "مدير تجاري",
      description: "الإعلانات والرعايات والشراكات"
    },
    {
      key: "analyst",
      name: "محلل",
      description: "التحليلات والتقارير"
    },
    {
      key: "viewer",
      name: "مشاهد",
      description: "صلاحيات قراءة محدودة"
    }
  ];

  const STATUSES = [
    {
      key: "active",
      name: "نشط"
    },
    {
      key: "disabled",
      name: "معطل"
    },
    {
      key: "suspended",
      name: "موقوف"
    }
  ];

  function escapeHtml(value) {
    if (value === null || value === undefined) {
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
      return new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    } catch (error) {
      return String(value);
    }
  }

  function formatNumber(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("ar-SA").format(number);
  }

  function getRoleName(role) {
    const found = ROLES.find(
      item => item.key === role
    );

    return found ? found.name : role || "غير محدد";
  }

  function getStatusName(status) {
    const found = STATUSES.find(
      item => item.key === status
    );

    return found ? found.name : status || "غير محدد";
  }

  function getStatusClass(status) {
    if (status === "active") {
      return "ez-status-active";
    }

    if (status === "suspended") {
      return "ez-status-suspended";
    }

    return "ez-status-disabled";
  }

  function readToken() {
    try {
      return localStorage.getItem(STORAGE.token) || "";
    } catch (error) {
      return "";
    }
  }

  function saveToken(token) {
    if (!token) {
      return;
    }

    try {
      localStorage.setItem(
        STORAGE.token,
        token
      );
    } catch (error) {
      console.error(
        "تعذر حفظ جلسة الإدارة:",
        error
      );
    }
  }

  function removeToken() {
    try {
      localStorage.removeItem(
        STORAGE.token
      );
    } catch (error) {
      console.error(
        "تعذر حذف جلسة الإدارة:",
        error
      );
    }
  }

  function getHeaders() {
    const headers = {
      "Content-Type": "application/json"
    };

    const token =
      EZ_ADMIN.token ||
      readToken();

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    return headers;
  }

  async function request(
    url,
    options = {}
  ) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {})
      }
    });

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `تعذر تنفيذ الطلب (${response.status})`;

      const error =
        new Error(message);

      error.status =
        response.status;

      error.data = data;

      throw error;
    }

    return data;
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-core-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "ez-admin-core-styles";

    style.textContent = `
      #ez-admin-core {
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

      .ez-core-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }

      .ez-core-title {
        margin: 0;
        color: #075985;
        font-size: 25px;
        font-weight: 950;
      }

      .ez-core-subtitle {
        margin: 7px 0 0;
        color: #64748b;
        font-size: 13px;
      }

      .ez-core-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ez-core-btn {
        border: 1px solid #bae6fd;
        border-radius: 13px;
        padding: 10px 14px;
        background: #fff;
        color: #0369a1;
        font-size: 13px;
        font-weight: 850;
        cursor: pointer;
        transition: .2s ease;
      }

      .ez-core-btn:hover {
        transform: translateY(-1px);
        border-color: #38bdf8;
      }

      .ez-core-btn.primary {
        border-color: transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color: #fff;
      }

      .ez-core-btn.danger {
        color: #dc2626;
        border-color: #fecaca;
      }

      .ez-core-btn.success {
        color: #047857;
        border-color: #a7f3d0;
      }

      .ez-core-grid {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(210px, 1fr)
          );
        gap: 14px;
        margin-bottom: 20px;
      }

      .ez-core-card {
        background: #fff;
        border: 1px solid #e0f2fe;
        border-radius: 20px;
        padding: 19px;
        box-shadow:
          0 8px 25px
          rgba(14, 165, 233, .06);
      }

      .ez-core-card-label {
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
      }

      .ez-core-card-value {
        margin-top: 7px;
        color: #075985;
        font-size: 27px;
        font-weight: 950;
      }

      .ez-core-panel {
        background: #fff;
        border: 1px solid #e0f2fe;
        border-radius: 22px;
        margin-bottom: 20px;
        overflow: hidden;
        box-shadow:
          0 8px 30px
          rgba(14, 165, 233, .05);
      }

      .ez-core-panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 17px 19px;
        border-bottom: 1px solid #e0f2fe;
        background: #fafdff;
      }

      .ez-core-panel-head h3 {
        margin: 0;
        color: #075985;
        font-size: 16px;
        font-weight: 900;
      }

      .ez-core-panel-body {
        padding: 19px;
      }

      .ez-core-table-wrap {
        overflow-x: auto;
      }

      .ez-core-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 850px;
      }

      .ez-core-table th,
      .ez-core-table td {
        padding: 12px 10px;
        text-align: right;
        border-bottom: 1px solid #f0f9ff;
        font-size: 13px;
      }

      .ez-core-table th {
        color: #0369a1;
        background: #f8fdff;
        font-weight: 900;
      }

      .ez-core-table td {
        color: #334155;
      }

      .ez-status {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 11px;
        font-weight: 900;
      }

      .ez-status-active {
        background: #ecfdf5;
        color: #047857;
      }

      .ez-status-disabled {
        background: #f1f5f9;
        color: #475569;
      }

      .ez-status-suspended {
        background: #fff7ed;
        color: #c2410c;
      }

      .ez-core-filter {
        display: flex;
        gap: 9px;
        flex-wrap: wrap;
        margin-bottom: 15px;
      }

      .ez-core-filter input,
      .ez-core-filter select {
        min-width: 170px;
        border: 1px solid #dbeafe;
        border-radius: 12px;
        background: #fff;
        padding: 10px 12px;
        color: #0f172a;
        outline: none;
      }

      .ez-core-filter input:focus,
      .ez-core-filter select:focus {
        border-color: #38bdf8;
        box-shadow:
          0 0 0 3px
          rgba(56,189,248,.10);
      }

      .ez-core-actions-cell {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
      }

      .ez-core-mini-btn {
        border: 1px solid #dbeafe;
        border-radius: 9px;
        padding: 6px 8px;
        background: #fff;
        color: #0369a1;
        cursor: pointer;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-core-empty {
        padding: 35px 15px;
        text-align: center;
        color: #64748b;
      }

      .ez-core-role-grid {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(220px, 1fr)
          );
        gap: 10px;
      }

      .ez-core-role {
        border: 1px solid #e0f2fe;
        border-radius: 16px;
        padding: 14px;
        background: #fbfeff;
      }

      .ez-core-role strong {
        display: block;
        color: #075985;
        margin-bottom: 5px;
      }

      .ez-core-role span {
        color: #64748b;
        font-size: 12px;
      }

      #ez-admin-core-login {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #effaff,
            #dff6ff
          );
      }

      .ez-core-login-card {
        width: min(430px, 100%);
        background: rgba(255,255,255,.96);
        border: 1px solid #bae6fd;
        border-radius: 28px;
        padding: 30px;
        box-shadow:
          0 30px 90px
          rgba(14,116,144,.13);
      }

      .ez-core-login-logo {
        width: 68px;
        height: 68px;
        margin: 0 auto 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 21px;
        background:
          linear-gradient(
            135deg,
            #e0f7ff,
            #bae6fd
          );
        color: #0369a1;
        font-weight: 950;
        font-size: 22px;
      }

      .ez-core-login-card h2 {
        margin: 0;
        text-align: center;
        color: #075985;
        font-size: 25px;
        font-weight: 950;
      }

      .ez-core-login-card p {
        text-align: center;
        color: #64748b;
        font-size: 13px;
        margin: 8px 0 25px;
      }

      .ez-core-login-field {
        margin-bottom: 15px;
      }

      .ez-core-login-field label {
        display: block;
        margin-bottom: 7px;
        color: #334155;
        font-size: 13px;
        font-weight: 850;
      }

      .ez-core-login-field input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeafe;
        border-radius: 14px;
        padding: 13px;
        outline: none;
      }

      .ez-core-login-field input:focus {
        border-color: #38bdf8;
        box-shadow:
          0 0 0 4px
          rgba(56,189,248,.10);
      }

      #ez-core-login-submit {
        width: 100%;
        border: 0;
        border-radius: 14px;
        padding: 14px;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color: #fff;
        font-weight: 900;
        cursor: pointer;
      }

      #ez-core-login-message {
        min-height: 20px;
        margin-top: 13px;
        text-align: center;
        color: #dc2626;
        font-size: 12px;
        font-weight: 800;
      }

      #ez-core-user-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 20px;
        padding: 13px 16px;
        border: 1px solid #e0f2fe;
        border-radius: 17px;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #f5fcff
          );
      }

      .ez-core-user-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .ez-core-avatar {
        width: 40px;
        height: 40px;
        border-radius: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e0f7ff;
        color: #0369a1;
        font-weight: 950;
      }

      .ez-core-user-name {
        color: #075985;
        font-size: 13px;
        font-weight: 900;
      }

      .ez-core-user-role {
        color: #64748b;
        font-size: 11px;
      }

      @media (max-width: 700px) {
        .ez-core-table {
          min-width: 700px;
        }

        .ez-core-panel-body {
          padding: 13px;
        }

        .ez-core-title {
          font-size: 21px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function getMountPoint() {
    return (
      document.querySelector(
        "#system-section"
      ) ||
      document.querySelector(
        "#admin-core-section"
      ) ||
      document.querySelector(
        '[data-admin-section="system"]'
      )
    );
  }

  function createMount() {
    let mount = getMountPoint();

    if (mount) {
      return mount;
    }

    mount =
      document.createElement("section");

    mount.id =
      "admin-core-section";

    const parent =
      document.querySelector(
        "main"
      ) ||
      document.body;

    parent.appendChild(mount);

    return mount;
  }

  function renderLogin() {
    if (
      document.getElementById(
        "ez-admin-core-login"
      )
    ) {
      return;
    }

    const login =
      document.createElement("div");

    login.id =
      "ez-admin-core-login";

    login.innerHTML = `
      <div class="ez-core-login-card">

        <div class="ez-core-login-logo">
          EZ
        </div>

        <h2>
          EZ MEDIA
        </h2>

        <p>
          الدخول إلى مركز الإدارة المركزي
        </p>

        <form id="ez-core-login-form">

          <div class="ez-core-login-field">
            <label>
              اسم المستخدم أو البريد الإلكتروني
            </label>

            <input
              id="ez-core-login-username"
              type="text"
              autocomplete="username"
              required
              placeholder="اسم المستخدم"
            />
          </div>

          <div class="ez-core-login-field">
            <label>
              كلمة المرور
            </label>

            <input
              id="ez-core-login-password"
              type="password"
              autocomplete="current-password"
              required
              placeholder="كلمة المرور"
            />
          </div>

          <button
            id="ez-core-login-submit"
            type="submit"
          >
            دخول آمن
          </button>

          <div
            id="ez-core-login-message"
          ></div>

        </form>

      </div>
    `;

    document.body.appendChild(login);

    document
      .getElementById(
        "ez-core-login-form"
      )
      .addEventListener(
        "submit",
        handleLogin
      );
  }

  function hideLogin() {
    const login =
      document.getElementById(
        "ez-admin-core-login"
      );

    if (login) {
      login.remove();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const username =
      document.getElementById(
        "ez-core-login-username"
      )?.value?.trim();

    const password =
      document.getElementById(
        "ez-core-login-password"
      )?.value;

    const message =
      document.getElementById(
        "ez-core-login-message"
      );

    const button =
      document.getElementById(
        "ez-core-login-submit"
      );

    if (!username || !password) {
      message.textContent =
        "أدخل بيانات الدخول.";
      return;
    }

    button.disabled = true;
    button.textContent =
      "جارٍ التحقق...";

    message.textContent = "";

    try {
      const result =
        await request(
          API.login,
          {
            method: "POST",
            body: JSON.stringify({
              username,
              password
            })
          }
        );

      const token =
        result?.token ||
        result?.sessionToken ||
        result?.session?.token;

      if (token) {
        EZ_ADMIN.token = token;
        saveToken(token);
      }

      EZ_ADMIN.user =
        result?.user ||
        result?.admin ||
        result?.data?.user ||
        null;

      await verifySession();

      hideLogin();

      render();

      dispatch(
        "ezmedia:authenticated",
        {
          user: EZ_ADMIN.user
        }
      );

    } catch (error) {
      message.textContent =
        error?.message ||
        "تعذر تسجيل الدخول.";

      removeToken();
      EZ_ADMIN.token = null;

    } finally {
      button.disabled = false;
      button.textContent =
        "دخول آمن";
    }
  }

  async function verifySession() {
    EZ_ADMIN.token =
      EZ_ADMIN.token ||
      readToken();

    if (!EZ_ADMIN.token) {
      return false;
    }

    try {
      const result =
        await request(API.me);

      EZ_ADMIN.user =
        result?.user ||
        result?.admin ||
        result?.data?.user ||
        result?.data ||
        null;

      if (!EZ_ADMIN.user) {
        throw new Error(
          "جلسة الإدارة غير صالحة."
        );
      }

      return true;

    } catch (error) {
      EZ_ADMIN.user = null;
      EZ_ADMIN.token = null;

      removeToken();

      return false;
    }
  }

  async function logout() {
    try {
      await request(
        API.logout,
        {
          method: "POST"
        }
      );
    } catch (error) {
      console.warn(
        "تعذر إنهاء الجلسة على الخادم:",
        error
      );
    }

    EZ_ADMIN.user = null;
    EZ_ADMIN.token = null;

    removeToken();

    dispatch(
      "ezmedia:loggedout"
    );

    renderLogin();
  }

  async function loadUsers() {
    const result =
      await request(
        `${API.users}?limit=500`
      );

    EZ_ADMIN.users =
      result?.users ||
      result?.data ||
      result?.rows ||
      [];

    return EZ_ADMIN.users;
  }

  async function loadAuditLogs() {
    const result =
      await request(
        `${API.audit}?limit=500`
      );

    EZ_ADMIN.auditLogs =
      result?.logs ||
      result?.auditLogs ||
      result?.data ||
      result?.rows ||
      [];

    return EZ_ADMIN.auditLogs;
  }

  async function loadAuditStatistics() {
    const result =
      await request(
        API.auditStats
      );

    EZ_ADMIN.auditStats =
      result?.statistics ||
      result?.data ||
      result ||
      {};

    return EZ_ADMIN.auditStats;
  }

  function renderUserBar() {
    const user =
      EZ_ADMIN.user || {};

    return `
      <div id="ez-core-user-bar">

        <div class="ez-core-user-info">

          <div class="ez-core-avatar">
            ${escapeHtml(
              (
                user.full_name ||
                user.username ||
                "EZ"
              )
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div>
            <div class="ez-core-user-name">
              ${escapeHtml(
                user.full_name ||
                user.username ||
                user.email ||
                "مدير النظام"
              )}
            </div>

            <div class="ez-core-user-role">
              ${escapeHtml(
                getRoleName(
                  user.role
                )
              )}
            </div>
          </div>

        </div>

        <div class="ez-core-actions">

          <button
            class="ez-core-btn"
            data-core-action="refresh"
          >
            تحديث
          </button>

          <button
            class="ez-core-btn danger"
            data-core-action="logout"
          >
            تسجيل الخروج
          </button>

        </div>

      </div>
    `;
  }

  function renderDashboard() {
    const activeUsers =
      EZ_ADMIN.users.filter(
        user =>
          user.status === "active"
      ).length;

    const suspendedUsers =
      EZ_ADMIN.users.filter(
        user =>
          user.status === "suspended"
      ).length;

    const disabledUsers =
      EZ_ADMIN.users.filter(
        user =>
          user.status === "disabled"
      ).length;

    const auditCount =
      EZ_ADMIN.auditLogs.length;

    return `
      <div class="ez-core-grid">

        <div class="ez-core-card">
          <div class="ez-core-card-label">
            إجمالي المستخدمين
          </div>
          <div class="ez-core-card-value">
            ${formatNumber(
              EZ_ADMIN.users.length
            )}
          </div>
        </div>

        <div class="ez-core-card">
          <div class="ez-core-card-label">
            المستخدمون النشطون
          </div>
          <div class="ez-core-card-value">
            ${formatNumber(
              activeUsers
            )}
          </div>
        </div>

        <div class="ez-core-card">
          <div class="ez-core-card-label">
            الموقوفون
          </div>
          <div class="ez-core-card-value">
            ${formatNumber(
              suspendedUsers
            )}
          </div>
        </div>

        <div class="ez-core-card">
          <div class="ez-core-card-label">
            المعطلون
          </div>
          <div class="ez-core-card-value">
            ${formatNumber(
              disabledUsers
            )}
          </div>
        </div>

        <div class="ez-core-card">
          <div class="ez-core-card-label">
            أحداث التدقيق
          </div>
          <div class="ez-core-card-value">
            ${formatNumber(
              auditCount
            )}
          </div>
        </div>

      </div>
    `;
  }

  function renderUsers() {
    const search =
      EZ_ADMIN.filters.usersSearch
        .toLowerCase();

    const filtered =
      EZ_ADMIN.users.filter(
        user => {

          const text = [
            user.full_name,
            user.username,
            user.email
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !search ||
            text.includes(search);

          const matchesRole =
            !EZ_ADMIN.filters.usersRole ||
            user.role ===
              EZ_ADMIN.filters.usersRole;

          const matchesStatus =
            !EZ_ADMIN.filters.usersStatus ||
            user.status ===
              EZ_ADMIN.filters.usersStatus;

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
          );
        }
      );

    return `
      <div class="ez-core-panel">

        <div class="ez-core-panel-head">
          <h3>
            إدارة المستخدمين
          </h3>

          <button
            class="ez-core-btn primary"
            data-core-action="create-user"
          >
            مستخدم جديد
          </button>
        </div>

        <div class="ez-core-panel-body">

          <div class="ez-core-filter">

            <input
              id="ez-users-search"
              type="search"
              placeholder="بحث عن مستخدم..."
              value="${escapeHtml(
                EZ_ADMIN.filters.usersSearch
              )}"
            />

            <select
              id="ez-users-role"
            >
              <option value="">
                جميع الأدوار
              </option>

              ${ROLES.map(
                role => `
                  <option
                    value="${escapeHtml(
                      role.key
                    )}"
                    ${
                      EZ_ADMIN.filters.usersRole ===
                      role.key
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(
                      role.name
                    )}
                  </option>
                `
              ).join("")}
            </select>

            <select
              id="ez-users-status"
            >
              <option value="">
                جميع الحالات
              </option>

              ${STATUSES.map(
                status => `
                  <option
                    value="${escapeHtml(
                      status.key
                    )}"
                    ${
                      EZ_ADMIN.filters.usersStatus ===
                      status.key
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(
                      status.name
                    )}
                  </option>
                `
              ).join("")}
            </select>

          </div>

          ${
            filtered.length
              ? `
                <div class="ez-core-table-wrap">

                  <table class="ez-core-table">

                    <thead>
                      <tr>
                        <th>المستخدم</th>
                        <th>البريد</th>
                        <th>الدور</th>
                        <th>الحالة</th>
                        <th>آخر دخول</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>

                    <tbody>

                      ${filtered
                        .map(
                          user => `
                            <tr>

                              <td>
                                <strong>
                                  ${escapeHtml(
                                    user.full_name ||
                                    user.username ||
                                    "بدون اسم"
                                  )}
                                </strong>

                                <br>

                                <small>
                                  ${escapeHtml(
                                    user.username ||
                                    "—"
                                  )}
                                </small>
                              </td>

                              <td>
                                ${escapeHtml(
                                  user.email ||
                                  "—"
                                )}
                              </td>

                              <td>
                                ${escapeHtml(
                                  getRoleName(
                                    user.role
                                  )
                                )}
                              </td>

                              <td>
                                <span
                                  class="ez-status ${getStatusClass(
                                    user.status
                                  )}"
                                >
                                  ${escapeHtml(
                                    getStatusName(
                                      user.status
                                    )
                                  )}
                                </span>
                              </td>

                              <td>
                                ${formatDate(
                                  user.last_login_at
                                )}
                              </td>

                              <td>

                                <div
                                  class="ez-core-actions-cell"
                                >

                                  <button
                                    class="ez-core-mini-btn"
                                    data-user-action="edit"
                                    data-user-id="${escapeHtml(
                                      user.id
                                    )}"
                                  >
                                    تعديل
                                  </button>

                                  ${
                                    user.status ===
                                    "active"
                                      ? `
                                        <button
                                          class="ez-core-mini-btn"
                                          data-user-action="suspend"
                                          data-user-id="${escapeHtml(
                                            user.id
                                          )}"
                                        >
                                          إيقاف
                                        </button>
                                      `
                                      : `
                                        <button
                                          class="ez-core-mini-btn"
                                          data-user-action="enable"
                                          data-user-id="${escapeHtml(
                                            user.id
                                          )}"
                                        >
                                          تفعيل
                                        </button>
                                      `
                                  }

                                  <button
                                    class="ez-core-mini-btn"
                                    data-user-action="sessions"
                                    data-user-id="${escapeHtml(
                                      user.id
                                    )}"
                                  >
                                    الجلسات
                                  </button>

                                </div>

                              </td>

                            </tr>
                          `
                        )
                        .join("")}

                    </tbody>

                  </table>

                </div>
              `
              : `
                <div class="ez-core-empty">
                  لا توجد نتائج مطابقة.
                </div>
              `
          }

        </div>

      </div>
    `;
  }

  function renderRoles() {
    return `
      <div class="ez-core-panel">

        <div class="ez-core-panel-head">
          <h3>
            الأدوار والصلاحيات الأساسية
          </h3>
        </div>

        <div class="ez-core-panel-body">

          <div class="ez-core-role-grid">

            ${ROLES.map(
              role => `
                <div class="ez-core-role">

                  <strong>
                    ${escapeHtml(
                      role.name
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                      role.description
                    )}
                  </span>

                </div>
              `
            ).join("")}

          </div>

        </div>

      </div>
    `;
  }

  function renderAudit() {
    const search =
      EZ_ADMIN.filters.auditSearch
        .toLowerCase();

    const filtered =
      EZ_ADMIN.auditLogs.filter(
        log => {

          const text = [
            log.action,
            log.module,
            log.resource_type,
            log.user_id,
            log.details
              ? JSON.stringify(
                  log.details
                )
              : ""
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !search ||
            text.includes(search);

          const matchesAction =
            !EZ_ADMIN.filters.auditAction ||
            log.action ===
              EZ_ADMIN.filters.auditAction;

          const matchesModule =
            !EZ_ADMIN.filters.auditModule ||
            log.module ===
              EZ_ADMIN.filters.auditModule;

          return (
            matchesSearch &&
            matchesAction &&
            matchesModule
          );
        }
      );

    const actions = [
      ...new Set(
        EZ_ADMIN.auditLogs
          .map(item => item.action)
          .filter(Boolean)
      )
    ];

    const modules = [
      ...new Set(
        EZ_ADMIN.auditLogs
          .map(item => item.module)
          .filter(Boolean)
      )
    ];

    return `
      <div class="ez-core-panel">

        <div class="ez-core-panel-head">
          <h3>
            سجل التدقيق الأمني
          </h3>

          <button
            class="ez-core-btn"
            data-core-action="audit-refresh"
          >
            تحديث السجل
          </button>
        </div>

        <div class="ez-core-panel-body">

          <div class="ez-core-filter">

            <input
              id="ez-audit-search"
              type="search"
              placeholder="بحث في السجل..."
              value="${escapeHtml(
                EZ_ADMIN.filters.auditSearch
              )}"
            />

            <select
              id="ez-audit-action"
            >
              <option value="">
                جميع العمليات
              </option>

              ${actions.map(
                action => `
                  <option
                    value="${escapeHtml(
                      action
                    )}"
                    ${
                      EZ_ADMIN.filters.auditAction ===
                      action
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(
                      action
                    )}
                  </option>
                `
              ).join("")}
            </select>

            <select
              id="ez-audit-module"
            >
              <option value="">
                جميع الوحدات
              </option>

              ${modules.map(
                module => `
                  <option
                    value="${escapeHtml(
                      module
                    )}"
                    ${
                      EZ_ADMIN.filters.auditModule ===
                      module
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(
                      module
                    )}
                  </option>
                `
              ).join("")}
            </select>

          </div>

          ${
            filtered.length
              ? `
                <div class="ez-core-table-wrap">

                  <table class="ez-core-table">

                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>المستخدم</th>
                        <th>الوحدة</th>
                        <th>العملية</th>
                        <th>المورد</th>
                        <th>IP</th>
                      </tr>
                    </thead>

                    <tbody>

                      ${filtered
                        .map(
                          log => `
                            <tr>

                              <td>
                                ${formatDate(
                                  log.created_at ||
                                  log.timestamp
                                )}
                              </td>

                              <td>
                                ${escapeHtml(
                                  log.user_id ||
                                  "النظام"
                                )}
                              </td>

                              <td>
                                ${escapeHtml(
                                  log.module ||
                                  "—"
                                )}
                              </td>

                              <td>
                                ${escapeHtml(
                                  log.action ||
                                  "—"
                                )}
                              </td>

                              <td>
                                ${escapeHtml(
                                  log.resource_id ||
                                  log.resource_type ||
                                  "—"
                                )}
                              </td>

                              <td>
                                ${escapeHtml(
                                  log.ip_address ||
                                  "—"
                                )}
                              </td>

                            </tr>
                          `
                        )
                        .join("")}

                    </tbody>

                  </table>

                </div>
              `
              : `
                <div class="ez-core-empty">
                  لا توجد سجلات مطابقة.
                </div>
              `
          }

        </div>

      </div>
    `;
  }

  function render() {
    injectStyles();

    const mount =
      createMount();

    mount.id =
      "ez-admin-core";

    mount.innerHTML = `
      ${renderUserBar()}

      <div class="ez-core-toolbar">

        <div>
          <h2 class="ez-core-title">
            مركز الإدارة المركزي
          </h2>

          <p class="ez-core-subtitle">
            الهوية والصلاحيات والمستخدمون والأمان والتدقيق
          </p>
        </div>

      </div>

      ${renderDashboard()}

      ${renderUsers()}

      ${renderRoles()}

      ${renderAudit()}
    `;

    bindEvents();
  }

  function bindEvents() {
    document
      .querySelectorAll(
        "[data-core-action]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          async () => {

            const action =
              button.dataset.coreAction;

            if (
              action === "logout"
            ) {
              await logout();
              return;
            }

            if (
              action === "refresh" ||
              action === "audit-refresh"
            ) {
              await refresh();
              return;
            }

            if (
              action === "create-user"
            ) {
              await createUser();
            }
          }
        );
      });

    const search =
      document.getElementById(
        "ez-users-search"
      );

    if (search) {
      search.addEventListener(
        "input",
        event => {
          EZ_ADMIN.filters.usersSearch =
            event.target.value;

          render();
        }
      );
    }

    const role =
      document.getElementById(
        "ez-users-role"
      );

    if (role) {
      role.addEventListener(
        "change",
        event => {
          EZ_ADMIN.filters.usersRole =
            event.target.value;

          render();
        }
      );
    }

    const status =
      document.getElementById(
        "ez-users-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        event => {
          EZ_ADMIN.filters.usersStatus =
            event.target.value;

          render();
        }
      );
    }

    const auditSearch =
      document.getElementById(
        "ez-audit-search"
      );

    if (auditSearch) {
      auditSearch.addEventListener(
        "input",
        event => {
          EZ_ADMIN.filters.auditSearch =
            event.target.value;

          render();
        }
      );
    }

    const auditAction =
      document.getElementById(
        "ez-audit-action"
      );

    if (auditAction) {
      auditAction.addEventListener(
        "change",
        event => {
          EZ_ADMIN.filters.auditAction =
            event.target.value;

          render();
        }
      );
    }

    const auditModule =
      document.getElementById(
        "ez-audit-module"
      );

    if (auditModule) {
      auditModule.addEventListener(
        "change",
        event => {
          EZ_ADMIN.filters.auditModule =
            event.target.value;

          render();
        }
      );
    }

    document
      .querySelectorAll(
        "[data-user-action]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          async () => {

            const action =
              button.dataset.userAction;

            const id =
              button.dataset.userId;

            await handleUserAction(
              action,
              id
            );
          }
        );
      });
  }

  async function handleUserAction(
    action,
    id
  ) {
    if (!id) {
      return;
    }

    try {

      if (action === "edit") {
        await editUser(id);
        return;
      }

      if (action === "suspend") {

        if (
          !confirm(
            "هل تريد إيقاف هذا المستخدم؟"
          )
        ) {
          return;
        }

        await request(
          `${API.usersManagement}/${encodeURIComponent(
            id
          )}/suspend`,
          {
            method: "POST"
          }
        );

      } else if (action === "enable") {

        await request(
          `${API.usersManagement}/${encodeURIComponent(
            id
          )}/enable`,
          {
            method: "POST"
          }
        );

      } else if (action === "sessions") {

        if (
          !confirm(
            "هل تريد إلغاء جميع جلسات هذا المستخدم؟"
          )
        ) {
          return;
        }

        await request(
          `${API.usersManagement}/${encodeURIComponent(
            id
          )}/revoke-sessions`,
          {
            method: "POST"
          }
        );
      }

      await refresh();

    } catch (error) {
      alert(
        error?.message ||
        "تعذر تنفيذ العملية."
      );
    }
  }

  async function createUser() {
    const fullName =
      prompt(
        "اسم المستخدم الكامل:"
      );

    if (!fullName) {
      return;
    }

    const username =
      prompt(
        "اسم الدخول:"
      );

    if (!username) {
      return;
    }

    const email =
      prompt(
        "البريد الإلكتروني:"
      );

    if (!email) {
      return;
    }

    const password =
      prompt(
        "كلمة المرور المؤقتة:"
      );

    if (!password) {
      return;
    }

    const role =
      prompt(
        "الدور:\n" +
        ROLES.map(
          item =>
            `${item.key} = ${item.name}`
        ).join("\n"),
        "viewer"
      );

    try {

      await request(
        API.usersManagement,
        {
          method: "POST",
          body: JSON.stringify({
            full_name:
              fullName.trim(),
            username:
              username.trim(),
            email:
              email.trim(),
            password,
            role:
              role || "viewer"
          })
        }
      );

      alert(
        "تم إنشاء المستخدم."
      );

      await refresh();

    } catch (error) {
      alert(
        error?.message ||
        "تعذر إنشاء المستخدم."
      );
    }
  }

  async function editUser(id) {
    const user =
      EZ_ADMIN.users.find(
        item =>
          String(item.id) ===
          String(id)
      );

    if (!user) {
      return;
    }

    const fullName =
      prompt(
        "الاسم الكامل:",
        user.full_name || ""
      );

    if (
      fullName === null
    ) {
      return;
    }

    const email =
      prompt(
        "البريد الإلكتروني:",
        user.email || ""
      );

    if (
      email === null
    ) {
      return;
    }

    const role =
      prompt(
        "الدور:",
        user.role || "viewer"
      );

    if (
      role === null
    ) {
      return;
    }

    try {

      await request(
        `${API.usersManagement}/${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            full_name:
              fullName.trim(),
            email:
              email.trim(),
            role:
              role.trim()
          })
        }
      );

      alert(
        "تم تحديث بيانات المستخدم."
      );

      await refresh();

    } catch (error) {
      alert(
        error?.message ||
        "تعذر تحديث المستخدم."
      );
    }
  }

  async function refresh() {
    try {

      await Promise.all([
        loadUsers(),
        loadAuditLogs(),
        loadAuditStatistics()
      ]);

      render();

    } catch (error) {

      if (
        error?.status === 401 ||
        error?.status === 403
      ) {
        EZ_ADMIN.user = null;
        EZ_ADMIN.token = null;

        removeToken();

        renderLogin();

        return;
      }

      console.error(
        "EZ MEDIA Admin Core:",
        error
      );

      render();
    }
  }

  function dispatch(
    name,
    detail = {}
  ) {
    document.dispatchEvent(
      new CustomEvent(
        name,
        {
          detail
        }
      )
    );
  }

  async function initialize() {
    if (
      EZ_ADMIN.initialized
    ) {
      return;
    }

    EZ_ADMIN.initialized = true;

    injectStyles();

    const authenticated =
      await verifySession();

    if (!authenticated) {
      renderLogin();
      return;
    }

    await refresh();

    dispatch(
      "ezmedia:admin-core-ready",
      {
        user:
          EZ_ADMIN.user,
        version:
          EZ_ADMIN.version
      }
    );
  }

  window.EZMediaAdminCore = {
    initialize,

    refresh,

    logout,

    verifySession,

    getCurrentUser() {
      return EZ_ADMIN.user;
    },

    getUsers() {
      return [
        ...EZ_ADMIN.users
      ];
    },

    getRoles() {
      return [
        ...ROLES
      ];
    },

    getAuditLogs() {
      return [
        ...EZ_ADMIN.auditLogs
      ];
    },

    isAuthenticated() {
      return Boolean(
        EZ_ADMIN.user
      );
    },

    getToken() {
      return (
        EZ_ADMIN.token ||
        readToken()
      );
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
