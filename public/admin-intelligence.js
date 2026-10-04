"use strict";

/**
 * EZ MEDIA 11.0
 * القسم 53
 * مركز ذكاء الإشعارات
 */

(() => {
  const API =
    "/api/notification-integration";

  const state = {
    health: null,
    state: null,
    types: null,
    loading: false,
    timer: null,
    autoRefresh: true,
    interval: 15000
  };

  function escapeHtml(value) {
    return String(
      value ?? ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll(
        "'",
        "&#039;"
      );
  }

  function number(value) {
    return Number(
      value || 0
    ).toLocaleString(
      "ar-SA"
    );
  }

  async function api(
    url,
    options = {}
  ) {
    const response =
      await fetch(
        url,
        {
          credentials:
            "same-origin",

          headers: {
            Accept:
              "application/json",

            ...(options.body
              ? {
                  "Content-Type":
                    "application/json"
                }
              : {})
          },

          ...options
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "فشل الاتصال"
      );
    }

    return result;
  }

  function root() {
    let element =
      document.querySelector(
        "#notification-intelligence-section"
      );

    if (!element) {
      element =
        document.createElement(
          "section"
        );

      element.id =
        "notification-intelligence-section";

      const parent =
        document.querySelector(
          "#system-section"
        ) ||
        document.querySelector(
          "main"
        ) ||
        document.body;

      parent.appendChild(
        element
      );
    }

    return element;
  }

  async function refresh() {
    if (state.loading) {
      return;
    }

    state.loading = true;

    try {
      const [
        health,
        currentState,
        types
      ] =
        await Promise.all([
          api(
            `${API}/health`
          ),

          api(
            `${API}/state`
          ),

          api(
            `${API}/types`
          )
        ]);

      state.health =
        health;

      state.state =
        currentState.state;

      state.types =
        types;

      render();
    } catch (error) {
      renderError(
        error
      );
    } finally {
      state.loading = false;
    }
  }

  function render() {
    const element =
      root();

    const serviceState =
      state.state || {};

    const health =
      state.health || {};

    const healthy =
      health.healthy !== false;

    element.innerHTML = `
      <div
        style="
          direction:rtl;
          display:grid;
          gap:16px;
          padding:20px;
          border:1px solid #dceef7;
          border-radius:22px;
          background:#fff;
          font-family:inherit;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:15px;
            flex-wrap:wrap;
          "
        >

          <div>
            <div
              style="
                color:#2ba8e6;
                font-size:12px;
                font-weight:800;
              "
            >
              EZ MEDIA 11.0
            </div>

            <h2
              style="
                margin:5px 0;
                color:#17324d;
              "
            >
              مركز ذكاء الإشعارات
            </h2>

            <p
              style="
                margin:0;
                color:#71889b;
              "
            >
              العقل المركزي للأحداث والتنبيهات
              داخل المنصة.
            </p>
          </div>

          <button
            id="ez-notification-refresh"
            style="
              border:0;
              border-radius:12px;
              padding:11px 17px;
              background:#e8f7ff;
              color:#0877ae;
              font-weight:800;
              cursor:pointer;
            "
          >
            تحديث
          </button>

        </div>

        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(
                auto-fit,
                minmax(160px,1fr)
              );
            gap:12px;
          "
        >

          ${card(
            "حالة المنظومة",
            healthy
              ? "تعمل"
              : "تحتاج مراجعة"
          )}

          ${card(
            "الأحداث المستلمة",
            number(
              serviceState.received
            )
          )}

          ${card(
            "الأحداث المعالجة",
            number(
              serviceState.processed
            )
          )}

          ${card(
            "الفشل",
            number(
              serviceState.failed
            )
          )}

          ${card(
            "الإشعارات المنشأة",
            number(
              serviceState.notificationsCreated
            )
          )}

          ${card(
            "التكرار",
            number(
              serviceState.duplicates
            )
          )}

        </div>

        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(
                auto-fit,
                minmax(230px,1fr)
              );
            gap:12px;
          "
        >

          ${healthCard(
            "Event Bridge",
            health.eventBridge
          )}

          ${healthCard(
            "Rules Engine",
            health.rulesEngine
          )}

        </div>

        <div
          style="
            padding:16px;
            border-radius:16px;
            background:#f5fbfe;
          "
        >
          <strong>
            آخر حدث
          </strong>

          <div
            style="
              margin-top:7px;
              color:#60798c;
            "
          >
            ${
              escapeHtml(
                serviceState.lastEventType ||
                "لا يوجد"
              )
            }
          </div>

          <div
            style="
              margin-top:5px;
              color:#8195a5;
              font-size:12px;
            "
          >
            ${
              escapeHtml(
                serviceState.lastEventAt ||
                "—"
              )
            }
          </div>
        </div>

        <div>
          <strong>
            أنواع الأحداث المدعومة
          </strong>

          <div
            style="
              display:flex;
              flex-wrap:wrap;
              gap:7px;
              margin-top:10px;
            "
          >
            ${renderTypes()}
          </div>
        </div>

        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          "
        >

          <button
            data-ni-action="breaking"
          >
            تجربة عاجل
          </button>

          <button
            data-ni-action="live"
          >
            تجربة بث مباشر
          </button>

          <button
            data-ni-action="ai"
          >
            تجربة AI
          </button>

          <button
            data-ni-action="system"
          >
            تجربة النظام
          </button>

        </div>

      </div>
    `;

    injectStyles();

    document
      .querySelector(
        "#ez-notification-refresh"
      )
      ?.addEventListener(
        "click",
        refresh
      );

    document
      .querySelectorAll(
        "[data-ni-action]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              simulate(
                button.dataset
                  .niAction
              )
          );
        }
      );
  }

  function card(
    title,
    value
  ) {
    return `
      <div
        style="
          padding:16px;
          border:1px solid #e1eff6;
          border-radius:16px;
          background:#fff;
        "
      >
        <div
          style="
            color:#71889b;
            font-size:12px;
          "
        >
          ${escapeHtml(
            title
          )}
        </div>

        <strong
          style="
            display:block;
            margin-top:7px;
            color:#17324d;
            font-size:22px;
          "
        >
          ${escapeHtml(
            value
          )}
        </strong>
      </div>
    `;
  }

  function healthCard(
    title,
    data
  ) {
    const healthy =
      data?.healthy !== false;

    return `
      <div
        style="
          padding:15px;
          border:1px solid #e1eff6;
          border-radius:16px;
        "
      >
        <strong>
          ${escapeHtml(
            title
          )}
        </strong>

        <div
          style="
            margin-top:7px;
            color:${
              healthy
                ? "#16845c"
                : "#b53b3b"
            };
            font-weight:800;
          "
        >
          ${
            healthy
              ? "يعمل"
              : "يحتاج مراجعة"
          }
        </div>
      </div>
    `;
  }

  function renderTypes() {
    const types =
      state.types?.eventTypes ||
      {};

    return Object.entries(
      types
    )
      .map(
        ([key, value]) =>
          `
          <span
            style="
              padding:6px 10px;
              border-radius:999px;
              background:#eaf8ff;
              color:#0877ae;
              font-size:11px;
              font-weight:700;
            "
          >
            ${escapeHtml(
              value
            )}
          </span>
          `
      )
      .join("");
  }

  async function simulate(
    type
  ) {
    const routes = {
      breaking:
        "breaking-news",

      live:
        "live-started",

      ai:
        "ai-alert",

      system:
        "system-alert"
    };

    const route =
      routes[type];

    if (!route) {
      return;
    }

    const payload = {
      title:
        "اختبار EZ MEDIA",
      message:
        "حدث اختباري من مركز ذكاء الإشعارات",
      source:
        "admin-notification-intelligence",
      timestamp:
        new Date().toISOString()
    };

    try {
      await api(
        `${API}/${route}`,
        {
          method:
            "POST",

          body:
            JSON.stringify({
              data:
                payload
            })
        }
      );

      await refresh();
    } catch (error) {
      alert(
        error.message
      );
    }
  }

  function renderError(
    error
  ) {
    const element =
      root();

    element.innerHTML = `
      <div
        style="
          direction:rtl;
          padding:20px;
          border:1px solid #ffdede;
          border-radius:18px;
          background:#fff7f7;
        "
      >
        <strong>
          تعذر تحميل منظومة الإشعارات
        </strong>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

        <button
          id="ez-ni-retry"
        >
          إعادة المحاولة
        </button>
      </div>
    `;

    document
      .querySelector(
        "#ez-ni-retry"
      )
      ?.addEventListener(
        "click",
        refresh
      );
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-notification-intelligence-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-notification-intelligence-style";

    style.textContent = `
      [data-ni-action] {
        border:0;
        border-radius:11px;
        padding:9px 13px;
        background:#eaf8ff;
        color:#0877ae;
        cursor:pointer;
        font-weight:700;
      }

      [data-ni-action]:hover {
        background:#d9f3ff;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function start() {
    refresh();

    state.timer =
      setInterval(
        refresh,
        state.interval
      );

    window.EZMediaAdminNotificationIntelligence =
      {
        state,

        refresh,

        stop() {
          if (
            state.timer
          ) {
            clearInterval(
              state.timer
            );

            state.timer =
              null;
          }
        },

        getState() {
          return {
            ...state
          };
        }
      };
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once: true
      }
    );
  } else {
    start();
  }
})();
