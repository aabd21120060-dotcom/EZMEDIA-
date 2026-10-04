"use strict";

(function () {
  const VERSION = "11.0.0";

  const STORAGE_KEY =
    "ez_media_admin_notifications";

  const MAX_NOTIFICATIONS = 150;

  const STATE = {
    notifications: [],
    unreadCount: 0,
    filter: "all",
    loading: false,
    lastUpdate: null,
    timer: null
  };

  const SOURCES = {
    newsroom: {
      name: "غرفة الأخبار",
      icon: "📰"
    },
    breaking: {
      name: "عاجل",
      icon: "⚡"
    },
    live: {
      name: "البث المباشر",
      icon: "📡"
    },
    ai: {
      name: "الذكاء الاصطناعي",
      icon: "🤖"
    },
    system: {
      name: "النظام",
      icon: "⚙️"
    },
    commercial: {
      name: "الإعلانات والرعايات",
      icon: "📣"
    },
    security: {
      name: "الأمان",
      icon: "🔐"
    },
    media: {
      name: "المكتبة",
      icon: "🎬"
    }
  };

  const PRIORITIES = {
    critical: {
      name: "حرج",
      className:
        "ez-notification-critical"
    },
    high: {
      name: "مرتفع",
      className:
        "ez-notification-high"
    },
    medium: {
      name: "متوسط",
      className:
        "ez-notification-medium"
    },
    low: {
      name: "منخفض",
      className:
        "ez-notification-low"
    }
  };

  function uid() {
    return (
      "notif_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
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
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  function formatDate(value) {
    if (!value) {
      return "الآن";
    }

    try {
      return new Intl.DateTimeFormat(
        "ar-SA",
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      ).format(
        new Date(value)
      );
    } catch {
      return String(value);
    }
  }

  function relativeTime(value) {
    if (!value) {
      return "الآن";
    }

    const time =
      new Date(value).getTime();

    if (
      Number.isNaN(time)
    ) {
      return "الآن";
    }

    const diff =
      Date.now() - time;

    const seconds =
      Math.floor(
        diff / 1000
      );

    if (
      seconds < 10
    ) {
      return "الآن";
    }

    if (
      seconds < 60
    ) {
      return `منذ ${seconds} ثانية`;
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    if (
      minutes < 60
    ) {
      return `منذ ${minutes} دقيقة`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (
      hours < 24
    ) {
      return `منذ ${hours} ساعة`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    return `منذ ${days} يوم`;
  }

  function getSource(
    source
  ) {
    return (
      SOURCES[source] ||
      {
        name: "المنصة",
        icon: "🔔"
      }
    );
  }

  function getPriority(
    priority
  ) {
    return (
      PRIORITIES[priority] ||
      PRIORITIES.medium
    );
  }

  function normalizeNotification(
    item
  ) {
    const source =
      item?.source ||
      "system";

    const priority =
      item?.priority ||
      "medium";

    return {
      id:
        item?.id ||
        uid(),

      title:
        item?.title ||
        "تنبيه جديد",

      message:
        item?.message ||
        "",

      source,

      priority,

      read:
        item?.read === true,

      createdAt:
        item?.createdAt ||
        item?.created_at ||
        new Date().toISOString(),

      action:
        item?.action ||
        null,

      metadata:
        item?.metadata ||
        {},

      expiresAt:
        item?.expiresAt ||
        null
    };
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          STATE.notifications
            .slice(
              0,
              MAX_NOTIFICATIONS
            )
        )
      );
    } catch {
      // تجاهل أخطاء التخزين المحلي
    }
  }

  function load() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        STATE.notifications = [];
        return;
      }

      const parsed =
        JSON.parse(raw);

      if (
        !Array.isArray(
          parsed
        )
      ) {
        STATE.notifications = [];
        return;
      }

      STATE.notifications =
        parsed
          .map(
            normalizeNotification
          )
          .slice(
            0,
            MAX_NOTIFICATIONS
          );

    } catch {
      STATE.notifications = [];
    }

    updateUnreadCount();
  }

  function updateUnreadCount() {
    STATE.unreadCount =
      STATE.notifications.filter(
        item =>
          item.read !== true
      ).length;

    updateExternalBadge();
  }

  function updateExternalBadge() {
    const selectors = [
      "#ez-notifications-count",
      "#admin-notifications-count",
      "[data-notification-count]"
    ];

    selectors.forEach(
      selector => {
        document
          .querySelectorAll(
            selector
          )
          .forEach(
            element => {
              element.textContent =
                String(
                  STATE.unreadCount
                );

              element.style.display =
                STATE.unreadCount >
                0
                  ? ""
                  : "none";
            }
          );
      }
    );
  }

  function add(
    notification
  ) {
    const item =
      normalizeNotification(
        notification
      );

    const exists =
      STATE.notifications.some(
        current =>
          current.id ===
          item.id
      );

    if (exists) {
      return item;
    }

    STATE.notifications.unshift(
      item
    );

    STATE.notifications =
      STATE.notifications
        .slice(
          0,
          MAX_NOTIFICATIONS
        );

    updateUnreadCount();
    save();
    render();

    document.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification",
        {
          detail: item
        }
      )
    );

    return item;
  }

  function remove(
    id
  ) {
    STATE.notifications =
      STATE.notifications.filter(
        item =>
          item.id !== id
      );

    updateUnreadCount();
    save();
    render();
  }

  function markRead(
    id
  ) {
    const item =
      STATE.notifications.find(
        notification =>
          notification.id ===
          id
      );

    if (!item) {
      return;
    }

    item.read = true;

    updateUnreadCount();
    save();
    render();
  }

  function markAllRead() {
    STATE.notifications.forEach(
      item => {
        item.read = true;
      }
    );

    updateUnreadCount();
    save();
    render();
  }

  function clearRead() {
    STATE.notifications =
      STATE.notifications.filter(
        item =>
          item.read !== true
      );

    updateUnreadCount();
    save();
    render();
  }

  function clearAll() {
    STATE.notifications = [];

    updateUnreadCount();
    save();
    render();
  }

  function filteredNotifications() {
    if (
      STATE.filter ===
      "unread"
    ) {
      return STATE.notifications.filter(
        item =>
          item.read !== true
      );
    }

    if (
      STATE.filter ===
      "critical"
    ) {
      return STATE.notifications.filter(
        item =>
          item.priority ===
          "critical"
      );
    }

    if (
      STATE.filter ===
      "high"
    ) {
      return STATE.notifications.filter(
        item =>
          item.priority ===
          "high"
      );
    }

    return STATE.notifications;
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-notifications-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-notifications-style";

    style.textContent = `
      #ez-admin-notifications {
        direction: rtl;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          Arial,
          sans-serif;
        color: #0f172a;
      }

      .ez-notifications-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .ez-notifications-title {
        margin: 0;
        color: #075985;
        font-size: 26px;
        font-weight: 950;
      }

      .ez-notifications-subtitle {
        margin: 6px 0 0;
        color: #64748b;
        font-size: 13px;
      }

      .ez-notifications-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ez-notifications-btn {
        border: 1px solid #bae6fd;
        border-radius: 13px;
        background: #fff;
        color: #0369a1;
        padding: 9px 13px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 850;
      }

      .ez-notifications-btn:hover {
        border-color: #38bdf8;
        transform: translateY(-1px);
      }

      .ez-notifications-btn.primary {
        border-color: transparent;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-notifications-btn.danger {
        color: #dc2626;
        border-color: #fecaca;
      }

      .ez-notifications-stats {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(170px, 1fr)
          );
        gap: 12px;
        margin-bottom: 18px;
      }

      .ez-notification-stat {
        border: 1px solid #e0f2fe;
        border-radius: 18px;
        background: #fff;
        padding: 16px;
        box-shadow:
          0 8px 24px
          rgba(14,165,233,.05);
      }

      .ez-notification-stat span {
        display: block;
        color: #64748b;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-notification-stat strong {
        display: block;
        margin-top: 7px;
        color: #075985;
        font-size: 24px;
        font-weight: 950;
      }

      .ez-notifications-panel {
        border: 1px solid #e0f2fe;
        border-radius: 22px;
        background: #fff;
        overflow: hidden;
        box-shadow:
          0 10px 30px
          rgba(14,165,233,.05);
      }

      .ez-notifications-toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 14px;
        border-bottom: 1px solid #e0f2fe;
        background: #fafdff;
      }

      .ez-notification-filter {
        border: 1px solid #dbeafe;
        border-radius: 999px;
        background: #fff;
        color: #64748b;
        padding: 7px 12px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 850;
      }

      .ez-notification-filter.active {
        color: #fff;
        border-color: transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-notifications-list {
        display: grid;
      }

      .ez-notification {
        display: grid;
        grid-template-columns:
          42px 1fr auto;
        gap: 13px;
        align-items: start;
        padding: 16px;
        border-bottom: 1px solid #f0f9ff;
        transition: .2s ease;
      }

      .ez-notification:last-child {
        border-bottom: 0;
      }

      .ez-notification:hover {
        background: #fafdff;
      }

      .ez-notification.unread {
        background: #f8fdff;
      }

      .ez-notification-icon {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: #e0f2fe;
        font-size: 18px;
      }

      .ez-notification-content {
        min-width: 0;
      }

      .ez-notification-top {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ez-notification-title {
        color: #0f172a;
        font-size: 13px;
        font-weight: 900;
      }

      .ez-notification-source {
        color: #0369a1;
        font-size: 10px;
        font-weight: 850;
      }

      .ez-notification-message {
        margin-top: 6px;
        color: #64748b;
        font-size: 12px;
        line-height: 1.7;
      }

      .ez-notification-meta {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 7px;
      }

      .ez-notification-time {
        color: #94a3b8;
        font-size: 10px;
      }

      .ez-notification-priority {
        border-radius: 999px;
        padding: 4px 7px;
        font-size: 9px;
        font-weight: 900;
      }

      .ez-notification-critical {
        background: #fef2f2;
        color: #b91c1c;
      }

      .ez-notification-high {
        background: #fff7ed;
        color: #c2410c;
      }

      .ez-notification-medium {
        background: #eff6ff;
        color: #1d4ed8;
      }

      .ez-notification-low {
        background: #f8fafc;
        color: #64748b;
      }

      .ez-notification-actions {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .ez-notification-action {
        border: 1px solid #e0f2fe;
        border-radius: 9px;
        background: #fff;
        color: #0369a1;
        padding: 6px 8px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 800;
      }

      .ez-notification-action.delete {
        color: #dc2626;
        border-color: #fecaca;
      }

      .ez-notifications-empty {
        padding: 55px 15px;
        text-align: center;
        color: #94a3b8;
      }

      .ez-notifications-empty strong {
        display: block;
        margin-bottom: 7px;
        color: #64748b;
        font-size: 15px;
      }

      .ez-notifications-footer {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        padding: 12px 15px;
        border-top: 1px solid #e0f2fe;
        color: #94a3b8;
        font-size: 10px;
      }

      @media (max-width: 700px) {
        .ez-notification {
          grid-template-columns:
            38px 1fr;
        }

        .ez-notification-actions {
          grid-column: 1 / -1;
          justify-content: flex-start;
        }

        .ez-notification-icon {
          width: 38px;
          height: 38px;
        }

        .ez-notifications-title {
          font-size: 21px;
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
        "#notifications-section"
      ) ||
      document.querySelector(
        "#admin-notifications-section"
      ) ||
      document.querySelector(
        '[data-admin-section="notifications"]'
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
      "admin-notifications-section";

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

  function render() {
    injectStyles();

    const mount =
      createMount();

    mount.id =
      "ez-admin-notifications";

    updateUnreadCount();

    const items =
      filteredNotifications();

    const total =
      STATE.notifications.length;

    const unread =
      STATE.notifications.filter(
        item =>
          item.read !== true
      ).length;

    const critical =
      STATE.notifications.filter(
        item =>
          item.priority ===
          "critical"
      ).length;

    const high =
      STATE.notifications.filter(
        item =>
          item.priority ===
          "high"
      ).length;

    mount.innerHTML = `
      <div class="ez-notifications-header">

        <div>
          <h2 class="ez-notifications-title">
            مركز الإشعارات
          </h2>

          <p class="ez-notifications-subtitle">
            مركز التنبيهات الذكي لجميع وحدات EZ MEDIA 11.0
          </p>
        </div>

        <div class="ez-notifications-actions">

          <button
            class="ez-notifications-btn primary"
            data-notification-action="read-all"
          >
            تحديد الكل كمقروء
          </button>

          <button
            class="ez-notifications-btn"
            data-notification-action="clear-read"
          >
            حذف المقروء
          </button>

          <button
            class="ez-notifications-btn danger"
            data-notification-action="clear-all"
          >
            مسح الكل
          </button>

        </div>

      </div>

      <div class="ez-notifications-stats">

        <div class="ez-notification-stat">
          <span>
            إجمالي التنبيهات
          </span>

          <strong>
            ${total}
          </strong>
        </div>

        <div class="ez-notification-stat">
          <span>
            غير مقروءة
          </span>

          <strong>
            ${unread}
          </strong>
        </div>

        <div class="ez-notification-stat">
          <span>
            حرجة
          </span>

          <strong>
            ${critical}
          </strong>
        </div>

        <div class="ez-notification-stat">
          <span>
            مرتفعة
          </span>

          <strong>
            ${high}
          </strong>
        </div>

      </div>

      <div class="ez-notifications-panel">

        <div class="ez-notifications-toolbar">

          ${renderFilter(
            "all",
            "الكل"
          )}

          ${renderFilter(
            "unread",
            "غير مقروء"
          )}

          ${renderFilter(
            "critical",
            "حرج"
          )}

          ${renderFilter(
            "high",
            "مرتفع"
          )}

        </div>

        <div class="ez-notifications-list">

          ${
            items.length
              ? items
                  .map(
                    renderNotification
                  )
                  .join("")
              : `
                <div class="ez-notifications-empty">
                  <strong>
                    لا توجد إشعارات
                  </strong>

                  لا توجد تنبيهات مطابقة للفلتر الحالي.
                </div>
              `
          }

        </div>

        <div class="ez-notifications-footer">

          <span>
            الإصدار ${VERSION}
          </span>

          <span>
            آخر تحديث:
            ${formatDate(
              STATE.lastUpdate
            )}
          </span>

        </div>

      </div>
    `;

    bindEvents();
  }

  function renderFilter(
    key,
    label
  ) {
    return `
      <button
        class="ez-notification-filter ${
          STATE.filter === key
            ? "active"
            : ""
        }"
        data-notification-filter="${escapeHtml(
          key
        )}"
      >
        ${escapeHtml(
          label
        )}
      </button>
    `;
  }

  function renderNotification(
    item
  ) {
    const source =
      getSource(
        item.source
      );

    const priority =
      getPriority(
        item.priority
      );

    return `
      <article
        class="ez-notification ${
          item.read
            ? ""
            : "unread"
        }"
        data-notification-id="${escapeHtml(
          item.id
        )}"
      >

        <div class="ez-notification-icon">
          ${source.icon}
        </div>

        <div class="ez-notification-content">

          <div class="ez-notification-top">

            <span class="ez-notification-title">
              ${escapeHtml(
                item.title
              )}
            </span>

            <span class="ez-notification-source">
              ${escapeHtml(
                source.name
              )}
            </span>

          </div>

          <div class="ez-notification-message">
            ${escapeHtml(
              item.message
            )}
          </div>

          <div class="ez-notification-meta">

            <span
              class="ez-notification-priority ${
                priority.className
              }"
            >
              ${escapeHtml(
                priority.name
              )}
            </span>

            <span class="ez-notification-time">
              ${relativeTime(
                item.createdAt
              )}
            </span>

          </div>

        </div>

        <div class="ez-notification-actions">

          ${
            !item.read
              ? `
                <button
                  class="ez-notification-action"
                  data-notification-action="read"
                  data-id="${escapeHtml(
                    item.id
                  )}"
                >
                  مقروء
                </button>
              `
              : ""
          }

          ${
            item.action
              ? `
                <button
                  class="ez-notification-action"
                  data-notification-action="open"
                  data-id="${escapeHtml(
                    item.id
                  )}"
                >
                  فتح
                </button>
              `
              : ""
          }

          <button
            class="ez-notification-action delete"
            data-notification-action="delete"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            حذف
          </button>

        </div>

      </article>
    `;
  }

  function bindEvents() {
    document
      .querySelectorAll(
        "[data-notification-filter]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              STATE.filter =
                button.dataset
                  .notificationFilter;

              render();
            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-notification-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const action =
                button.dataset
                  .notificationAction;

              const id =
                button.dataset.id;

              handleAction(
                action,
                id
              );
            }
          );

        }
      );
  }

  function handleAction(
    action,
    id
  ) {
    if (
      action ===
      "read-all"
    ) {
      markAllRead();
      return;
    }

    if (
      action ===
      "clear-read"
    ) {
      clearRead();
      return;
    }

    if (
      action ===
      "clear-all"
    ) {
      clearAll();
      return;
    }

    if (
      action ===
      "read"
    ) {
      markRead(id);
      return;
    }

    if (
      action ===
      "delete"
    ) {
      remove(id);
      return;
    }

    if (
      action ===
      "open"
    ) {
      openNotification(id);
    }
  }

  function openNotification(
    id
  ) {
    const item =
      STATE.notifications.find(
        notification =>
          notification.id ===
          id
      );

    if (!item) {
      return;
    }

    markRead(id);

    if (
      typeof item.action ===
      "function"
    ) {
      item.action(item);
      return;
    }

    if (
      typeof item.action ===
      "string"
    ) {
      try {
        window.location.href =
          item.action;
      } catch {
        // تجاهل الخطأ
      }
    }

    document.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification-open",
        {
          detail: item
        }
      )
    );
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

          STATE.lastUpdate =
            new Date();

          render();

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

  function initialize() {
    injectStyles();

    load();

    STATE.lastUpdate =
      new Date();

    render();

    startAutoRefresh();
  }

  window.EZMediaAdminNotifications = {
    initialize,

    add,

    remove,

    markRead,

    markAllRead,

    clearRead,

    clearAll,

    refresh() {
      load();
      STATE.lastUpdate =
        new Date();
      render();
    },

    setFilter(
      filter
    ) {
      STATE.filter =
        filter || "all";
      render();
    },

    getUnreadCount() {
      return STATE.unreadCount;
    },

    getNotifications() {
      return [
        ...STATE.notifications
      ];
    },

    stopAutoRefresh
  };

  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    {
      once: true
    }
  );

})();
