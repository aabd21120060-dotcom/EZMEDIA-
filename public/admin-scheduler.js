"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    content: "/api/content"
  };

  const STATE = {
    items: [],
    loading: false,
    view: "week",
    selectedDate: new Date(),
    currentStart: null,
    search: "",
    status: "all",
    editingId: null,
    lastUpdate: null
  };

  const CONTENT_TYPES = {
    news: "خبر",
    report: "تقرير",
    interview: "مقابلة",
    video: "فيديو",
    coverage: "تغطية",
    breaking: "عاجل"
  };

  const STATUSES = {
    draft: "مسودة",
    review: "مراجعة",
    approved: "معتمد",
    scheduled: "مجدول",
    published: "منشور",
    archived: "مؤرشف"
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

  function formatDate(
    value,
    withTime = true
  ) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "ar-SA",
        withTime
          ? {
              dateStyle: "medium",
              timeStyle: "short"
            }
          : {
              dateStyle: "medium"
            }
      ).format(
        new Date(value)
      );
    } catch {
      return String(value);
    }
  }

  function toDateInput(
    value
  ) {
    if (!value) {
      return "";
    }

    try {
      const date =
        new Date(value);

      const year =
        date.getFullYear();

      const month =
        String(
          date.getMonth() + 1
        ).padStart(2, "0");

      const day =
        String(
          date.getDate()
        ).padStart(2, "0");

      return `${year}-${month}-${day}`;
    } catch {
      return "";
    }
  }

  function toDateTimeLocal(
    value
  ) {
    if (!value) {
      return "";
    }

    try {
      const date =
        new Date(value);

      const year =
        date.getFullYear();

      const month =
        String(
          date.getMonth() + 1
        ).padStart(2, "0");

      const day =
        String(
          date.getDate()
        ).padStart(2, "0");

      const hours =
        String(
          date.getHours()
        ).padStart(2, "0");

      const minutes =
        String(
          date.getMinutes()
        ).padStart(2, "0");

      return (
        `${year}-${month}-${day}` +
        `T${hours}:${minutes}`
      );
    } catch {
      return "";
    }
  }

  function getToken() {
    return (
      window
        .EZMediaAdminCore
        ?.getToken?.() ||
      null
    );
  }

  async function request(
    url,
    options = {}
  ) {
    const token =
      getToken();

    const headers = {
      "Content-Type":
        "application/json"
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
          headers: {
            ...headers,
            ...(options.headers || {})
          }
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
      throw new Error(
        data?.message ||
        data?.error ||
        `فشل الطلب (${response.status})`
      );
    }

    return data;
  }

  function getArray(
    data
  ) {
    if (
      Array.isArray(data)
    ) {
      return data;
    }

    const keys = [
      "items",
      "data",
      "results",
      "content"
    ];

    for (
      const key of keys
    ) {
      if (
        Array.isArray(
          data?.[key]
        )
      ) {
        return data[key];
      }
    }

    return [];
  }

  async function loadContent() {
    STATE.loading =
      true;

    render();

    try {
      const data =
        await request(
          `${API.content}?limit=500`
        );

      STATE.items =
        getArray(data)
          .map(
            normalizeItem
          );

      STATE.lastUpdate =
        new Date();

    } catch (error) {
      console.error(
        "EZ MEDIA Scheduler:",
        error
      );

      STATE.items = [];

      showMessage(
        error.message ||
        "تعذر تحميل المحتوى."
      );

    } finally {
      STATE.loading =
        false;

      render();
    }
  }

  function normalizeItem(
    item
  ) {
    return {
      ...item,

      id:
        item?.id ||
        item?._id ||
        null,

      title:
        item?.title ||
        item?.headline ||
        "بدون عنوان",

      contentType:
        item?.content_type ||
        item?.contentType ||
        item?.type ||
        "news",

      status:
        item?.status ||
        "draft",

      scheduledAt:
        item?.scheduled_at ||
        item?.scheduledAt ||
        item?.publish_at ||
        item?.publishAt ||
        null,

      publishedAt:
        item?.published_at ||
        item?.publishedAt ||
        null,

      createdAt:
        item?.created_at ||
        item?.createdAt ||
        null,

      updatedAt:
        item?.updated_at ||
        item?.updatedAt ||
        null
    };
  }

  function getScheduledDate(
    item
  ) {
    return (
      item.scheduledAt ||
      (
        item.status ===
        "scheduled"
          ? item.updatedAt
          : null
      )
    );
  }

  function isScheduled(
    item
  ) {
    return Boolean(
      getScheduledDate(
        item
      )
    );
  }

  function filteredItems() {
    return STATE.items.filter(
      item => {

        if (
          STATE.status !==
          "all" &&
          item.status !==
            STATE.status
        ) {
          return false;
        }

        if (
          STATE.search
        ) {
          const text =
            [
              item.title,
              item.contentType,
              item.status,
              item.category,
              item.summary
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          if (
            !text.includes(
              STATE.search
                .toLowerCase()
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }

  function startOfWeek(
    date
  ) {
    const result =
      new Date(date);

    const day =
      result.getDay();

    const diff =
      day === 0
        ? -6
        : 1 - day;

    result.setDate(
      result.getDate() +
        diff
    );

    result.setHours(
      0,
      0,
      0,
      0
    );

    return result;
  }

  function addDays(
    date,
    days
  ) {
    const result =
      new Date(date);

    result.setDate(
      result.getDate() +
        days
    );

    return result;
  }

  function sameDay(
    a,
    b
  ) {
    if (
      !a ||
      !b
    ) {
      return false;
    }

    const first =
      new Date(a);

    const second =
      new Date(b);

    return (
      first.getFullYear() ===
        second.getFullYear() &&
      first.getMonth() ===
        second.getMonth() &&
      first.getDate() ===
        second.getDate()
    );
  }

  function itemsForDay(
    date
  ) {
    return filteredItems()
      .filter(
        item =>
          isScheduled(
            item
          ) &&
          sameDay(
            getScheduledDate(
              item
            ),
            date
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            getScheduledDate(
              a
            )
          ) -
          new Date(
            getScheduledDate(
              b
            )
          )
      );
  }

  function renderCalendar() {
    const start =
      startOfWeek(
        STATE.selectedDate
      );

    STATE.currentStart =
      start;

    const days =
      Array.from(
        {
          length:
            STATE.view ===
            "day"
              ? 1
              : 7
        },
        (
          _,
          index
        ) =>
          addDays(
            start,
            index
          )
      );

    return `
      <div class="ez-scheduler-calendar">

        ${days
          .map(
            day =>
              renderDay(
                day
              )
          )
          .join("")}

      </div>
    `;
  }

  function renderDay(
    day
  ) {
    const items =
      itemsForDay(
        day
      );

    const today =
      sameDay(
        day,
        new Date()
      );

    return `
      <div
        class="ez-scheduler-day ${
          today
            ? "today"
            : ""
        }"
      >

        <div class="ez-scheduler-day-head">

          <div>
            <strong>
              ${day.toLocaleDateString(
                "ar-SA",
                {
                  weekday:
                    "long"
                }
              )}
            </strong>

            <span>
              ${day.toLocaleDateString(
                "ar-SA",
                {
                  day:
                    "numeric",
                  month:
                    "long"
                }
              )}
            </span>
          </div>

          <button
            class="ez-scheduler-add-day"
            data-schedule-add-date="${toDateInput(
              day
            )}"
          >
            +
          </button>

        </div>

        <div class="ez-scheduler-day-body">

          ${
            items.length
              ? items
                  .map(
                    renderScheduleItem
                  )
                  .join("")
              : `
                <div class="ez-scheduler-empty-day">
                  لا توجد مواد مجدولة
                </div>
              `
          }

        </div>

      </div>
    `;
  }

  function renderScheduleItem(
    item
  ) {
    const type =
      CONTENT_TYPES[
        item.contentType
      ] ||
      item.contentType ||
      "محتوى";

    const status =
      STATUSES[
        item.status
      ] ||
      item.status;

    const scheduled =
      getScheduledDate(
        item
      );

    return `
      <article
        class="ez-scheduler-item"
        data-schedule-id="${escapeHtml(
          item.id
        )}"
      >

        <div class="ez-scheduler-item-time">
          ${
            scheduled
              ? new Date(
                  scheduled
                ).toLocaleTimeString(
                  "ar-SA",
                  {
                    hour:
                      "2-digit",
                    minute:
                      "2-digit"
                  }
                )
              : "—"
          }
        </div>

        <div class="ez-scheduler-item-title">
          ${escapeHtml(
            item.title
          )}
        </div>

        <div class="ez-scheduler-item-meta">

          <span>
            ${escapeHtml(
              type
            )}
          </span>

          <span>
            ${escapeHtml(
              status
            )}
          </span>

        </div>

        <div class="ez-scheduler-item-actions">

          <button
            data-schedule-action="edit"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            تعديل
          </button>

          <button
            data-schedule-action="publish"
            data-id="${escapeHtml(
              item.id
            )}"
          >
            نشر
          </button>

        </div>

      </article>
    `;
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-scheduler-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-scheduler-style";

    style.textContent = `
      #ez-admin-scheduler {
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

      .ez-scheduler-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 15px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }

      .ez-scheduler-title {
        margin: 0;
        color: #075985;
        font-size: 27px;
        font-weight: 950;
      }

      .ez-scheduler-subtitle {
        margin: 7px 0 0;
        color: #64748b;
        font-size: 13px;
      }

      .ez-scheduler-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ez-scheduler-btn {
        border: 1px solid #bae6fd;
        border-radius: 13px;
        background: #fff;
        color: #0369a1;
        padding: 10px 14px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 850;
      }

      .ez-scheduler-btn.primary {
        border-color: transparent;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-scheduler-btn:hover {
        transform: translateY(-1px);
      }

      .ez-scheduler-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 15px;
      }

      .ez-scheduler-search {
        flex: 1;
        min-width: 210px;
        border: 1px solid #bae6fd;
        border-radius: 13px;
        outline: none;
        background: #fff;
        padding: 10px 13px;
        color: #0f172a;
      }

      .ez-scheduler-select {
        border: 1px solid #bae6fd;
        border-radius: 13px;
        background: #fff;
        color: #0369a1;
        padding: 10px 12px;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-scheduler-nav {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 15px;
      }

      .ez-scheduler-nav button {
        border: 1px solid #dbeafe;
        border-radius: 11px;
        background: #fff;
        color: #0369a1;
        padding: 8px 11px;
        cursor: pointer;
        font-weight: 850;
      }

      .ez-scheduler-current {
        flex: 1;
        text-align: center;
        color: #075985;
        font-size: 15px;
        font-weight: 900;
      }

      .ez-scheduler-calendar {
        display: grid;
        grid-template-columns:
          repeat(
            7,
            minmax(170px, 1fr)
          );
        gap: 10px;
        overflow-x: auto;
      }

      .ez-scheduler-day {
        min-width: 170px;
        border: 1px solid #e0f2fe;
        border-radius: 19px;
        background: #fff;
        overflow: hidden;
      }

      .ez-scheduler-day.today {
        border-color: #38bdf8;
      }

      .ez-scheduler-day-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 13px;
        background: #fafdff;
        border-bottom: 1px solid #e0f2fe;
      }

      .ez-scheduler-day-head strong {
        display: block;
        color: #075985;
        font-size: 12px;
      }

      .ez-scheduler-day-head span {
        display: block;
        margin-top: 4px;
        color: #64748b;
        font-size: 10px;
      }

      .ez-scheduler-add-day {
        width: 29px;
        height: 29px;
        border: 1px solid #bae6fd;
        border-radius: 9px;
        background: #fff;
        color: #0284c7;
        cursor: pointer;
        font-size: 18px;
      }

      .ez-scheduler-day-body {
        display: grid;
        gap: 8px;
        padding: 9px;
        min-height: 220px;
      }

      .ez-scheduler-empty-day {
        display: grid;
        place-items: center;
        min-height: 130px;
        color: #cbd5e1;
        text-align: center;
        font-size: 10px;
      }

      .ez-scheduler-item {
        border: 1px solid #e0f2fe;
        border-radius: 13px;
        padding: 10px;
        background: #fff;
      }

      .ez-scheduler-item-time {
        color: #0284c7;
        font-size: 10px;
        font-weight: 900;
      }

      .ez-scheduler-item-title {
        margin-top: 5px;
        color: #334155;
        font-size: 11px;
        font-weight: 900;
        line-height: 1.5;
      }

      .ez-scheduler-item-meta {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        margin-top: 7px;
      }

      .ez-scheduler-item-meta span {
        border-radius: 999px;
        background: #eff6ff;
        color: #0369a1;
        padding: 3px 6px;
        font-size: 8px;
        font-weight: 850;
      }

      .ez-scheduler-item-actions {
        display: flex;
        gap: 5px;
        margin-top: 8px;
      }

      .ez-scheduler-item-actions button {
        flex: 1;
        border: 1px solid #dbeafe;
        border-radius: 8px;
        background: #fff;
        color: #0369a1;
        padding: 5px;
        cursor: pointer;
        font-size: 9px;
        font-weight: 850;
      }

      .ez-scheduler-stats {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(160px, 1fr)
          );
        gap: 10px;
        margin-bottom: 16px;
      }

      .ez-scheduler-stat {
        border: 1px solid #e0f2fe;
        border-radius: 16px;
        background: #fff;
        padding: 14px;
      }

      .ez-scheduler-stat span {
        display: block;
        color: #64748b;
        font-size: 10px;
        font-weight: 800;
      }

      .ez-scheduler-stat strong {
        display: block;
        margin-top: 5px;
        color: #075985;
        font-size: 21px;
        font-weight: 950;
      }

      .ez-scheduler-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        place-items: center;
        padding: 15px;
        background:
          rgba(
            2,
            132,
            199,
            .16
          );
        backdrop-filter:
          blur(8px);
      }

      .ez-scheduler-modal.show {
        display: grid;
      }

      .ez-scheduler-modal-box {
        width: min(
          680px,
          100%
        );
        max-height: 90vh;
        overflow: auto;
        border: 1px solid #bae6fd;
        border-radius: 23px;
        background: #fff;
        box-shadow:
          0 30px 80px
          rgba(7,89,133,.18);
      }

      .ez-scheduler-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 17px;
        border-bottom: 1px solid #e0f2fe;
      }

      .ez-scheduler-modal-head h3 {
        margin: 0;
        color: #075985;
        font-size: 17px;
      }

      .ez-scheduler-close {
        border: 0;
        background: transparent;
        color: #64748b;
        cursor: pointer;
        font-size: 22px;
      }

      .ez-scheduler-form {
        display: grid;
        gap: 12px;
        padding: 17px;
      }

      .ez-scheduler-form label {
        color: #334155;
        font-size: 11px;
        font-weight: 850;
      }

      .ez-scheduler-form input,
      .ez-scheduler-form select {
        width: 100%;
        box-sizing: border-box;
        margin-top: 5px;
        border: 1px solid #bae6fd;
        border-radius: 12px;
        outline: none;
        background: #fff;
        color: #0f172a;
        padding: 10px;
      }

      .ez-scheduler-form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-start;
        padding-top: 5px;
      }

      .ez-scheduler-message {
        margin-bottom: 15px;
        border-radius: 13px;
        padding: 11px;
        background: #eff6ff;
        color: #0369a1;
        font-size: 11px;
        font-weight: 800;
      }

      @media (max-width: 900px) {
        .ez-scheduler-calendar {
          grid-template-columns:
            repeat(
              7,
              180px
            );
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
        "#scheduler-section"
      ) ||
      document.querySelector(
        "#admin-scheduler-section"
      ) ||
      document.querySelector(
        '[data-admin-section="scheduler"]'
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
      "admin-scheduler-section";

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
      "ez-admin-scheduler";

    const all =
      STATE.items.length;

    const scheduled =
      STATE.items.filter(
        item =>
          item.status ===
          "scheduled" ||
          isScheduled(
            item
          )
      ).length;

    const published =
      STATE.items.filter(
        item =>
          item.status ===
          "published"
      ).length;

    const drafts =
      STATE.items.filter(
        item =>
          item.status ===
          "draft"
      ).length;

    const start =
      startOfWeek(
        STATE.selectedDate
      );

    const end =
      addDays(
        start,
        STATE.view ===
        "day"
          ? 0
          : 6
      );

    mount.innerHTML = `
      <div class="ez-scheduler-header">

        <div>
          <h2 class="ez-scheduler-title">
            مركز الجدولة والنشر
          </h2>

          <p class="ez-scheduler-subtitle">
            تنظيم دورة نشر المحتوى داخل غرفة أخبار EZ MEDIA
          </p>
        </div>

        <div class="ez-scheduler-actions">

          <button
            class="ez-scheduler-btn primary"
            data-scheduler-action="new"
          >
            جدولة محتوى
          </button>

          <button
            class="ez-scheduler-btn"
            data-scheduler-action="today"
          >
            اليوم
          </button>

          <button
            class="ez-scheduler-btn"
            data-scheduler-action="refresh"
          >
            تحديث
          </button>

        </div>

      </div>

      <div class="ez-scheduler-stats">

        <div class="ez-scheduler-stat">
          <span>
            إجمالي المحتوى
          </span>
          <strong>
            ${all}
          </strong>
        </div>

        <div class="ez-scheduler-stat">
          <span>
            المجدول
          </span>
          <strong>
            ${scheduled}
          </strong>
        </div>

        <div class="ez-scheduler-stat">
          <span>
            المنشور
          </span>
          <strong>
            ${published}
          </strong>
        </div>

        <div class="ez-scheduler-stat">
          <span>
            المسودات
          </span>
          <strong>
            ${drafts}
          </strong>
        </div>

      </div>

      <div class="ez-scheduler-toolbar">

        <input
          id="ez-scheduler-search"
          class="ez-scheduler-search"
          type="search"
          value="${escapeHtml(
            STATE.search
          )}"
          placeholder="البحث داخل المحتوى..."
        />

        <select
          id="ez-scheduler-status"
          class="ez-scheduler-select"
        >
          <option
            value="all"
            ${
              STATE.status ===
              "all"
                ? "selected"
                : ""
            }
          >
            كل الحالات
          </option>

          ${Object.entries(
            STATUSES
          )
            .map(
              ([key, label]) =>
                `
                  <option
                    value="${key}"
                    ${
                      STATE.status ===
                      key
                        ? "selected"
                        : ""
                    }
                  >
                    ${label}
                  </option>
                `
            )
            .join("")}

        </select>

        <select
          id="ez-scheduler-view"
          class="ez-scheduler-select"
        >
          <option
            value="week"
            ${
              STATE.view ===
              "week"
                ? "selected"
                : ""
            }
          >
            أسبوع
          </option>

          <option
            value="day"
            ${
              STATE.view ===
              "day"
                ? "selected"
                : ""
            }
          >
            يوم
          </option>
        </select>

      </div>

      <div class="ez-scheduler-nav">

        <button
          data-scheduler-action="prev"
        >
          السابق
        </button>

        <div class="ez-scheduler-current">
          ${formatDate(
            start,
            false
          )}
          —
          ${formatDate(
            end,
            false
          )}
        </div>

        <button
          data-scheduler-action="next"
        >
          التالي
        </button>

      </div>

      ${
        STATE.loading
          ? `
            <div class="ez-scheduler-message">
              جارٍ تحميل المحتوى...
            </div>
          `
          : ""
      }

      ${renderCalendar()}

      ${
        STATE.lastUpdate
          ? `
            <div class="ez-scheduler-message">
              آخر تحديث:
              ${formatDate(
                STATE.lastUpdate
              )}
            </div>
          `
          : ""
      }

      <div
        id="ez-scheduler-modal"
        class="ez-scheduler-modal"
      ></div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const search =
      document.querySelector(
        "#ez-scheduler-search"
      );

    if (search) {
      search.addEventListener(
        "input",
        event => {
          STATE.search =
            event.target.value;
          render();
        }
      );
    }

    const status =
      document.querySelector(
        "#ez-scheduler-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        event => {
          STATE.status =
            event.target.value;
          render();
        }
      );
    }

    const view =
      document.querySelector(
        "#ez-scheduler-view"
      );

    if (view) {
      view.addEventListener(
        "change",
        event => {
          STATE.view =
            event.target.value;
          render();
        }
      );
    }

    document
      .querySelectorAll(
        "[data-scheduler-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              handleAction(
                button.dataset
                  .schedulerAction
              );
            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-schedule-add-date]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              openScheduleModal(
                null,
                button.dataset
                  .scheduleAddDate
              );
            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-schedule-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            event => {

              event.stopPropagation();

              const id =
                button.dataset.id;

              const action =
                button.dataset
                  .scheduleAction;

              const item =
                STATE.items.find(
                  content =>
                    String(
                      content.id
                    ) ===
                    String(id)
                );

              if (
                action ===
                "edit"
              ) {
                openScheduleModal(
                  item
                );
              }

              if (
                action ===
                "publish"
              ) {
                publishNow(
                  item
                );
              }
            }
          );

        }
      );
  }

  function handleAction(
    action
  ) {
    if (
      action ===
      "new"
    ) {
      openScheduleModal();
      return;
    }

    if (
      action ===
      "today"
    ) {
      STATE.selectedDate =
        new Date();
      render();
      return;
    }

    if (
      action ===
      "prev"
    ) {
      STATE.selectedDate =
        addDays(
          STATE.selectedDate,
          STATE.view ===
          "day"
            ? -1
            : -7
        );

      render();
      return;
    }

    if (
      action ===
      "next"
    ) {
      STATE.selectedDate =
        addDays(
          STATE.selectedDate,
          STATE.view ===
          "day"
            ? 1
            : 7
        );

      render();
      return;
    }

    if (
      action ===
      "refresh"
    ) {
      loadContent();
    }
  }

  function openScheduleModal(
    item = null,
    date = null
  ) {
    STATE.editingId =
      item?.id ||
      null;

    const mount =
      document.querySelector(
        "#ez-scheduler-modal"
      );

    if (!mount) {
      return;
    }

    const defaultDate =
      date ||
      toDateInput(
        item?.scheduledAt
      ) ||
      toDateInput(
        new Date()
      );

    const defaultTime =
      item?.scheduledAt
        ? toDateTimeLocal(
            item.scheduledAt
          ).slice(
            11,
            16
          )
        : "20:00";

    mount.innerHTML = `
      <div class="ez-scheduler-modal-box">

        <div class="ez-scheduler-modal-head">

          <h3>
            ${
              item
                ? "تعديل جدولة المحتوى"
                : "جدولة محتوى جديد"
            }
          </h3>

          <button
            class="ez-scheduler-close"
            data-scheduler-close
          >
            ×
          </button>

        </div>

        <form
          id="ez-scheduler-form"
          class="ez-scheduler-form"
        >

          <label>
            المحتوى

            <select
              name="contentId"
              required
            >
              <option
                value=""
              >
                اختر المحتوى
              </option>

              ${STATE.items
                .map(
                  content =>
                    `
                      <option
                        value="${escapeHtml(
                          content.id
                        )}"
                        ${
                          String(
                            content.id
                          ) ===
                          String(
                            item?.id
                          )
                            ? "selected"
                            : ""
                        }
                      >
                        ${escapeHtml(
                          content.title
                        )}
                      </option>
                    `
                )
                .join("")}

            </select>
          </label>

          <label>
            تاريخ النشر

            <input
              type="date"
              name="date"
              value="${escapeHtml(
                defaultDate
              )}"
              required
            />
          </label>

          <label>
            وقت النشر

            <input
              type="time"
              name="time"
              value="${escapeHtml(
                defaultTime
              )}"
              required
            />
          </label>

          <label>
            أولوية النشر

            <select
              name="priority"
            >
              <option value="normal">
                عادية
              </option>

              <option value="high">
                مرتفعة
              </option>

              <option value="critical">
                عاجلة
              </option>
            </select>
          </label>

          <div class="ez-scheduler-message">
            ستُحفظ الجدولة على المحتوى عبر حالة
            <strong>scheduled</strong>.
            تنفيذ النشر التلقائي الفعلي يحتاج إلى محرك الجدولة الخلفي.
          </div>

          <div class="ez-scheduler-form-actions">

            <button
              type="submit"
              class="ez-scheduler-btn primary"
            >
              حفظ الجدولة
            </button>

            ${
              item
                ? `
                  <button
                    type="button"
                    class="ez-scheduler-btn"
                    data-scheduler-remove="${escapeHtml(
                      item.id
                    )}"
                  >
                    إزالة الجدولة
                  </button>
                `
                : ""
            }

          </div>

        </form>

      </div>
    `;

    mount.classList.add(
      "show"
    );

    const close =
      mount.querySelector(
        "[data-scheduler-close]"
      );

    if (close) {
      close.addEventListener(
        "click",
        closeModal
      );
    }

    const form =
      mount.querySelector(
        "#ez-scheduler-form"
      );

    if (form) {
      form.addEventListener(
        "submit",
        saveSchedule
      );
    }

    const remove =
      mount.querySelector(
        "[data-scheduler-remove]"
      );

    if (remove) {
      remove.addEventListener(
        "click",
        () =>
          removeSchedule(
            remove.dataset
              .schedulerRemove
          )
      );
    }

    mount.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          mount
        ) {
          closeModal();
        }
      },
      {
        once: true
      }
    );
  }

  function closeModal() {
    const modal =
      document.querySelector(
        "#ez-scheduler-modal"
      );

    if (modal) {
      modal.classList.remove(
        "show"
      );
    }

    STATE.editingId =
      null;
  }

  async function saveSchedule(
    event
  ) {
    event.preventDefault();

    const form =
      event.target;

    const data =
      new FormData(form);

    const contentId =
      data.get(
        "contentId"
      );

    const date =
      data.get(
        "date"
      );

    const time =
      data.get(
        "time"
      );

    const priority =
      data.get(
        "priority"
      );

    if (
      !contentId ||
      !date ||
      !time
    ) {
      alert(
        "يرجى إكمال بيانات الجدولة."
      );

      return;
    }

    const scheduledAt =
      new Date(
        `${date}T${time}:00`
      ).toISOString();

    try {
      await request(
        `${API.content}/${contentId}`,
        {
          method:
            "PATCH",
          body:
            JSON.stringify({
              status:
                "scheduled",
              scheduled_at:
                scheduledAt,
              scheduledAt:
                scheduledAt,
              metadata: {
                scheduler:
                  {
                    priority,
                    version:
                      VERSION
                  }
              }
            })
        }
      );

      closeModal();

      await loadContent();

      alert(
        "تم حفظ جدولة المحتوى."
      );

    } catch (error) {
      alert(
        error.message ||
        "تعذر حفظ الجدولة."
      );
    }
  }

  async function removeSchedule(
    id
  ) {
    if (!id) {
      return;
    }

    const item =
      STATE.items.find(
        content =>
          String(
            content.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    try {
      await request(
        `${API.content}/${id}`,
        {
          method:
            "PATCH",
          body:
            JSON.stringify({
              status:
                "draft",
              scheduled_at:
                null,
              scheduledAt:
                null
            })
        }
      );

      closeModal();

      await loadContent();

      alert(
        "تمت إزالة الجدولة."
      );

    } catch (error) {
      alert(
        error.message ||
        "تعذر إزالة الجدولة."
      );
    }
  }

  async function publishNow(
    item
  ) {
    if (
      !item?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل تريد نشر "${item.title}" الآن؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `${API.content}/${item.id}/publish`,
        {
          method:
            "POST"
        }
      );

      await loadContent();

      alert(
        "تم إرسال أمر النشر."
      );

    } catch (error) {
      alert(
        error.message ||
        "تعذر نشر المحتوى."
      );
    }
  }

  function showMessage(
    message
  ) {
    console.warn(
      "EZ MEDIA Scheduler:",
      message
    );
  }

  function initialize() {
    injectStyles();

    STATE.selectedDate =
      new Date();

    render();

    loadContent();
  }

  window.EZMediaAdminScheduler = {
    initialize,
    refresh:
      loadContent,

    openScheduleModal,

    publishNow,

    getState() {
      return {
        ...STATE,
        items: [
          ...STATE.items
        ]
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
