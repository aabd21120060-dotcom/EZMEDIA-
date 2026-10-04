"use strict";

(() => {

  const state = {
    dashboard: null,
    snapshot: null,
    alerts: [],
    approvals: [],
    online: true
  };

  const $ =
    selector =>
      document.querySelector(
        selector
      );

  function escapeHtml(value) {

    return String(
      value ?? ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function get(url) {

    const response =
      await fetch(url, {
        cache: "no-store"
      });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return response.json();
  }

  async function load() {

    try {

      const [
        dashboard,
        snapshot,
        alerts,
        approvals
      ] =
        await Promise.all([
          get(
            "/api/executive/dashboard"
          ),
          get(
            "/api/executive/snapshot"
          ),
          get(
            "/api/command/alerts"
          ),
          get(
            "/api/executive/approvals/pending"
          )
        ]);

      state.dashboard =
        dashboard;

      state.snapshot =
        snapshot;

      state.alerts =
        Array.isArray(
          alerts.alerts
        )
          ? alerts.alerts
          : [];

      state.approvals =
        Array.isArray(
          approvals.requests
        )
          ? approvals.requests
          : [];

      state.online = true;

      render();

    } catch (error) {

      console.error(error);

      state.online = false;

      renderConnection();
    }
  }

  function renderConnection() {

    const element =
      $("#connection-status");

    if (!element)
      return;

    if (state.online) {

      element.textContent =
        "متصل";

      element.className =
        "status online";

    } else {

      element.textContent =
        "غير متصل";

      element.className =
        "status offline";
    }
  }

  function render() {

    renderConnection();

    const command =
      state.dashboard?.command ||
      state.snapshot?.snapshot ||
      state.snapshot ||
      {};

    const health =
      command.healthScore ??
      command.health?.score ??
      0;

    $("#health-score")
      .textContent =
        Math.round(
          Number(health || 0)
        );

    $("#alerts-count")
      .textContent =
        state.alerts.length;

    $("#approvals-count")
      .textContent =
        state.approvals.length;

    const live =
      state.dashboard?.live ||
      {};

    $("#live-status")
      .textContent =
        live.running
          ? "مباشر"
          : "متوقف";

    const analytics =
      state.dashboard?.analytics ||
      {};

    $("#analytics-score")
      .textContent =
        Math.round(
          Number(
            analytics.score ||
            analytics.healthScore ||
            0
          )
        );

    renderAlerts();
    renderApprovals();
    renderLive();
    renderAnalytics();
  }

  function renderAlerts() {

    const container =
      $("#alerts-list");

    if (!container)
      return;

    if (!state.alerts.length) {

      container.innerHTML = `
        <div class="empty">
          لا توجد تنبيهات جديدة.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.alerts
        .slice(0, 10)
        .map(
          alert => `
            <article class="list-item">

              <div>
                <strong>
                  ${escapeHtml(
                    alert.title ||
                    alert.type ||
                    "تنبيه"
                  )}
                </strong>

                <p>
                  ${escapeHtml(
                    alert.message ||
                    alert.description ||
                    ""
                  )}
                </p>
              </div>

              <span>
                ${escapeHtml(
                  alert.priority ||
                  "medium"
                )}
              </span>

            </article>
          `
        )
        .join("");
  }

  function renderApprovals() {

    const container =
      $("#approvals-list");

    if (!container)
      return;

    if (!state.approvals.length) {

      container.innerHTML = `
        <div class="empty">
          لا توجد موافقات معلقة.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.approvals
        .slice(0, 10)
        .map(
          item => {

            const id =
              item.id ||
              item.approvalId;

            return `
              <article
                class="list-item approval-item"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      item.title ||
                      item.type ||
                      "قرار"
                    )}
                  </strong>

                  <p>
                    ${escapeHtml(
                      item.description ||
                      item.reason ||
                      ""
                    )}
                  </p>

                </div>

                <div class="approval-buttons">

                  <button
                    data-approve="${escapeHtml(
                      id
                    )}"
                  >
                    موافقة
                  </button>

                  <button
                    data-reject="${escapeHtml(
                      id
                    )}"
                  >
                    رفض
                  </button>

                </div>

              </article>
            `;
          }
        )
        .join("");

    container
      .querySelectorAll(
        "[data-approve]"
      )
      .forEach(
        button => {

          button.onclick =
            () =>
              approvalAction(
                button.dataset.approve,
                "approve"
              );
        }
      );

    container
      .querySelectorAll(
        "[data-reject]"
      )
      .forEach(
        button => {

          button.onclick =
            () =>
              approvalAction(
                button.dataset.reject,
                "reject"
              );
        }
      );
  }

  async function approvalAction(
    id,
    action
  ) {

    const endpoint =
      action === "approve"
        ? `/api/executive/approvals/${encodeURIComponent(
            id
          )}/approve`
        : `/api/executive/approvals/${encodeURIComponent(
            id
          )}/reject`;

    const body = {
      actorId:
        "super_admin",
      actorType:
        "human"
    };

    if (action === "reject") {

      const reason =
        window.prompt(
          "سبب الرفض:"
        );

      if (!reason)
        return;

      body.reason =
        reason;
    }

    try {

      const response =
        await fetch(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify(body)
          }
        );

      if (!response.ok) {
        throw new Error(
          "تعذر تنفيذ القرار"
        );
      }

      await load();

    } catch (error) {

      alert(
        error.message
      );
    }
  }

  function renderLive() {

    const container =
      $("#live-panel");

    if (!container)
      return;

    const live =
      state.dashboard?.live ||
      {};

    container.innerHTML = `
      <strong>
        حالة البث:
      </strong>

      <span>
        ${
          live.running
            ? "🟢 مباشر الآن"
            : "⚪ لا يوجد بث نشط"
        }
      </span>
    `;
  }

  function renderAnalytics() {

    const container =
      $("#analytics-panel");

    if (!container)
      return;

    const analytics =
      state.dashboard?.analytics ||
      {};

    container.innerHTML = `
      <div class="metric-row">
        <span>
          صحة التحليلات
        </span>

        <strong>
          ${Math.round(
            Number(
              analytics.score ||
              analytics.healthScore ||
              0
            )
          )}%
        </strong>
      </div>

      <div class="metric-row">
        <span>
          حالة الذكاء التنفيذي
        </span>

        <strong>
          ${
            state.online
              ? "يعمل"
              : "غير متصل"
          }
        </strong>
      </div>
    `;
  }

  function setupNavigation() {

    document
      .querySelectorAll(
        "[data-target]"
      )
      .forEach(
        button => {

          button.onclick = () => {

            const target =
              document.getElementById(
                button.dataset.target
              );

            if (target) {

              target.scrollIntoView({
                behavior:
                  "smooth",
                block:
                  "start"
              });
            }
          };
        }
      );
  }

  function setupEmergency() {

    const button =
      $("#emergency-stop");

    if (!button)
      return;

    button.onclick =
      async () => {

        const confirmed =
          window.confirm(
            "هل تريد إيقاف العمليات الآلية؟"
          );

        if (!confirmed)
          return;

        try {

          const response =
            await fetch(
              "/api/executive/emergency-stop",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                body:
                  JSON.stringify({
                    reason:
                      "Emergency stop from mobile command center"
                  })
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.error ||
              "تعذر تنفيذ الإيقاف"
            );
          }

          alert(
            "تم إرسال أمر إيقاف الطوارئ."
          );

          await load();

        } catch (error) {

          alert(
            "تعذر تنفيذ الأمر: " +
            error.message
          );
        }
      };
  }

  function registerPWA() {

    if (
      "serviceWorker" in
      navigator
    ) {

      navigator.serviceWorker
        .register(
          "/executive-command-center/mobile/service-worker.js"
        )
        .catch(
          error =>
            console.error(
              "PWA:",
              error
            )
        );
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      setupNavigation();
      setupEmergency();
      registerPWA();
      load();

      $("#refresh").onclick =
        load;

      setInterval(
        load,
        15000
      );
    }
  );

})();
