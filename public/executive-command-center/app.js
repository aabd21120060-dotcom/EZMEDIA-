"use strict";

(() => {
  const API_BASE = "/api/operations";

  const state = {
    dashboard: null,
    operations: [],
    events: [],
    approvals: [],
    agents: [],
    connected: false,
    loading: false,
    lastUpdate: null
  };

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatDate(value) {
    if (!value) return "غير متوفر";

    try {
      return new Date(value).toLocaleString("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch {
      return String(value);
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(
      `${API_BASE}${path}`,
      {
        cache: "no-store",
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `HTTP ${response.status}`
      );
    }

    return data;
  }

  function setConnection(connected) {
    state.connected = connected;

    const status =
      $("#connection-status") ||
      $("#system-status") ||
      $("[data-connection-status]");

    if (!status) return;

    status.textContent =
      connected
        ? "متصل ويعمل"
        : "غير متصل";

    status.classList.toggle(
      "online",
      connected
    );

    status.classList.toggle(
      "offline",
      !connected
    );
  }

  function getDashboardData(data) {
    return (
      data?.dashboard ||
      data?.data ||
      data ||
      {}
    );
  }

  async function loadDashboard() {
    state.loading = true;

    try {
      const data = await request(
        "/dashboard"
      );

      state.dashboard =
        getDashboardData(data);

      setConnection(true);

      renderDashboard();

    } catch (error) {
      console.error(
        "خطأ في لوحة العمليات:",
        error
      );

      setConnection(false);

      showError(
        "تعذر الاتصال بمركز العمليات."
      );
    } finally {
      state.loading = false;
      state.lastUpdate =
        new Date();
    }
  }

  async function loadOperations() {
    try {
      const data =
        await request(
          "/operations"
        );

      state.operations =
        Array.isArray(data)
          ? data
          : (
              data.operations ||
              data.items ||
              data.data ||
              []
            );

      renderOperations();

    } catch (error) {
      console.error(
        "خطأ في العمليات:",
        error
      );
    }
  }

  async function loadEvents() {
    try {
      const data =
        await request(
          "/events"
        );

      state.events =
        Array.isArray(data)
          ? data
          : (
              data.events ||
              data.items ||
              data.data ||
              []
            );

      renderEvents();

    } catch (error) {
      console.error(
        "خطأ في الأحداث:",
        error
      );
    }
  }

  async function loadApprovals() {
    try {
      const data =
        await request(
          "/approvals"
        );

      state.approvals =
        Array.isArray(data)
          ? data
          : (
              data.approvals ||
              data.requests ||
              data.items ||
              data.data ||
              []
            );

      renderApprovals();

    } catch (error) {
      console.error(
        "خطأ في الموافقات:",
        error
      );
    }
  }

  async function loadAgents() {
    try {
      const data =
        await request(
          "/agents"
        );

      state.agents =
        Array.isArray(data)
          ? data
          : (
              data.agents ||
              data.items ||
              data.data ||
              []
            );

      renderAgents();

    } catch (error) {
      console.error(
        "خطأ في الوكلاء:",
        error
      );
    }
  }

  async function loadAll() {
    await Promise.allSettled([
      loadDashboard(),
      loadOperations(),
      loadEvents(),
      loadApprovals(),
      loadAgents()
    ]);

    updateLastUpdate();
  }

  function renderDashboard() {
    const dashboard =
      state.dashboard || {};

    const metrics =
      dashboard.metrics ||
      dashboard.statistics ||
      dashboard.stats ||
      {};

    const operations =
      dashboard.operations ||
      {};

    const events =
      dashboard.events ||
      {};

    const approvals =
      dashboard.approvals ||
      {};

    const agents =
      dashboard.agents ||
      {};

    setText(
      [
        "#operations-count",
        "#total-operations",
        "[data-metric='operations']"
      ],
      number(
        metrics.operations ??
        metrics.totalOperations ??
        operations.total ??
        dashboard.totalOperations
      )
    );

    setText(
      [
        "#active-count",
        "#active-operations",
        "[data-metric='active']"
      ],
      number(
        metrics.active ??
        metrics.activeOperations ??
        operations.active ??
        dashboard.activeOperations
      )
    );

    setText(
      [
        "#approvals-count",
        "#pending-approvals",
        "[data-metric='approvals']"
      ],
      number(
        metrics.approvals ??
        metrics.pendingApprovals ??
        approvals.pending ??
        dashboard.pendingApprovals
      )
    );

    setText(
      [
        "#events-count",
        "#total-events",
        "[data-metric='events']"
      ],
      number(
        metrics.events ??
        metrics.totalEvents ??
        events.total ??
        dashboard.totalEvents
      )
    );

    setText(
      [
        "#completed-count",
        "#completed-operations",
        "[data-metric='completed']"
      ],
      number(
        metrics.completed ??
        metrics.completedOperations ??
        operations.completed ??
        dashboard.completedOperations
      )
    );

    setText(
      [
        "#failed-count",
        "#failed-operations",
        "[data-metric='failed']"
      ],
      number(
        metrics.failed ??
        metrics.failedOperations ??
        operations.failed ??
        dashboard.failedOperations
      )
    );

    setText(
      [
        "#agents-count",
        "#ai-agents",
        "[data-metric='agents']"
      ],
      number(
        metrics.agents ??
        metrics.totalAgents ??
        agents.total ??
        state.agents.length
      )
    );

    renderAutomationState(
      dashboard
    );
  }

  function renderAutomationState(
    dashboard
  ) {
    const container =
      $("#automation-state") ||
      $("#automation-status") ||
      $("[data-automation-state]");

    if (!container) return;

    const automation =
      dashboard.automation ||
      dashboard.automationState ||
      {};

    const enabled =
      automation.enabled ??
      dashboard.enabled ??
      true;

    const running =
      automation.running ??
      dashboard.running ??
      false;

    container.innerHTML = `
      <div class="automation-status">
        <span class="status-dot ${
          enabled
            ? "online"
            : "offline"
        }"></span>

        <strong>
          ${
            enabled
              ? "الأتمتة الذكية مفعلة"
              : "الأتمتة متوقفة"
          }
        </strong>

        <span>
          ${
            running
              ? "تعمل الآن"
              : "في وضع الاستعداد"
          }
        </span>
      </div>
    `;
  }

  function renderOperations() {
    const container =
      $("#operations-list") ||
      $("#live-operations") ||
      $("[data-operations-list]");

    if (!container) return;

    if (!state.operations.length) {
      container.innerHTML = `
        <div class="empty">
          لا توجد عمليات حالية.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.operations
        .slice(0, 20)
        .map(
          operation => {
            const id =
              operation.id ||
              operation.operationId ||
              "";

            const title =
              operation.title ||
              operation.name ||
              operation.type ||
              "عملية إعلامية";

            const status =
              operation.status ||
              "unknown";

            const priority =
              operation.priority ||
              "normal";

            return `
              <article
                class="list-item operation-item"
                data-operation-id="${escapeHtml(id)}"
              >

                <div class="item-main">

                  <strong>
                    ${escapeHtml(title)}
                  </strong>

                  <p>
                    ${escapeHtml(
                      operation.description ||
                      operation.reason ||
                      operation.objective ||
                      ""
                    )}
                  </p>

                  <small>
                    ${escapeHtml(
                      formatDate(
                        operation.createdAt ||
                        operation.created_at
                      )
                    )}
                  </small>

                </div>

                <div class="item-meta">

                  <span class="status-badge">
                    ${escapeHtml(status)}
                  </span>

                  <span class="priority-badge">
                    ${escapeHtml(priority)}
                  </span>

                </div>

              </article>
            `;
          }
        )
        .join("");
  }

  function renderEvents() {
    const container =
      $("#events-list") ||
      $("#event-stream") ||
      $("[data-events-list]");

    if (!container) return;

    if (!state.events.length) {
      container.innerHTML = `
        <div class="empty">
          لا توجد أحداث جديدة.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.events
        .slice(0, 20)
        .map(
          event => `
            <article class="list-item event-item">

              <div>

                <strong>
                  ${escapeHtml(
                    event.title ||
                    event.name ||
                    event.type ||
                    "حدث جديد"
                  )}
                </strong>

                <p>
                  ${escapeHtml(
                    event.description ||
                    event.message ||
                    event.summary ||
                    ""
                  )}
                </p>

              </div>

              <small>
                ${escapeHtml(
                  formatDate(
                    event.createdAt ||
                    event.created_at ||
                    event.timestamp
                  )
                )}
              </small>

            </article>
          `
        )
        .join("");
  }

  function renderApprovals() {
    const container =
      $("#approvals-list") ||
      $("#human-approvals") ||
      $("[data-approvals-list]");

    if (!container) return;

    if (!state.approvals.length) {
      container.innerHTML = `
        <div class="empty">
          لا توجد عمليات تنتظر موافقة بشرية.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.approvals
        .slice(0, 20)
        .map(
          approval => {

            const id =
              approval.id ||
              approval.approvalId ||
              "";

            return `
              <article
                class="list-item approval-item"
              >

                <div>

                  <strong>
                    ${escapeHtml(
                      approval.title ||
                      approval.operationTitle ||
                      approval.type ||
                      "موافقة مطلوبة"
                    )}
                  </strong>

                  <p>
                    ${escapeHtml(
                      approval.reason ||
                      approval.description ||
                      approval.objective ||
                      ""
                    )}
                  </p>

                  <small>
                    مستوى الخطورة:
                    ${escapeHtml(
                      approval.riskLevel ||
                      approval.risk ||
                      "غير محدد"
                    )}
                  </small>

                </div>

                <div class="approval-actions">

                  <button
                    type="button"
                    data-approval-action="approve"
                    data-approval-id="${escapeHtml(id)}"
                  >
                    موافقة
                  </button>

                  <button
                    type="button"
                    data-approval-action="reject"
                    data-approval-id="${escapeHtml(id)}"
                  >
                    رفض
                  </button>

                </div>

              </article>
            `;
          }
        )
        .join("");

    bindApprovalButtons();
  }

  function renderAgents() {
    const container =
      $("#agents-list") ||
      $("#ai-agents-list") ||
      $("[data-agents-list]");

    if (!container) return;

    if (!state.agents.length) {
      container.innerHTML = `
        <div class="empty">
          لا توجد بيانات وكلاء متاحة حاليًا.
        </div>
      `;

      return;
    }

    container.innerHTML =
      state.agents
        .slice(0, 30)
        .map(
          agent => `
            <article class="list-item agent-item">

              <div>

                <strong>
                  ${escapeHtml(
                    agent.name ||
                    agent.title ||
                    agent.agentId ||
                    "وكيل ذكاء اصطناعي"
                  )}
                </strong>

                <p>
                  ${escapeHtml(
                    agent.description ||
                    agent.role ||
                    agent.type ||
                    ""
                  )}
                </p>

              </div>

              <span class="status-badge">
                ${escapeHtml(
                  agent.status ||
                  "جاهز"
                )}
              </span>

            </article>
          `
        )
        .join("");
  }

  function bindApprovalButtons() {
    $$(
      "[data-approval-action]"
    ).forEach(button => {
      button.onclick = async () => {

        const id =
          button.dataset.approvalId;

        const action =
          button.dataset.approvalAction;

        await executeApproval(
          id,
          action
        );
      };
    });
  }

  async function executeApproval(
    id,
    action
  ) {
    if (!id) {
      alert(
        "معرّف الموافقة غير موجود."
      );

      return;
    }

    let reason = "";

    if (action === "reject") {
      reason =
        window.prompt(
          "اكتب سبب رفض العملية:"
        ) || "";

      if (!reason.trim()) {
        return;
      }
    }

    try {
      const response =
        await request(
          `/approvals/${encodeURIComponent(
            id
          )}/${action}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                actorId:
                  "super_admin",
                actorType:
                  "human",
                reason
              })
          }
        );

      alert(
        action === "approve"
          ? "تم تسجيل الموافقة."
          : "تم تسجيل الرفض."
      );

      await loadAll();

      return response;

    } catch (error) {
      console.error(error);

      alert(
        "تعذر تنفيذ العملية: " +
        error.message
      );
    }
  }

  async function emergencyStop() {
    const confirmed =
      window.confirm(
        "تحذير: هذا الأمر مخصص للطوارئ وسيطلب من المنصة إيقاف العمليات الآلية. هل تريد المتابعة؟"
      );

    if (!confirmed) return;

    try {
      const response =
        await request(
          "/stop",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                reason:
                  "إيقاف طوارئ من مركز العمليات الإعلامية"
              })
          }
        );

      alert(
        response.message ||
        "تم إرسال أمر إيقاف الطوارئ."
      );

      await loadAll();

    } catch (error) {
      console.error(error);

      alert(
        "تعذر تنفيذ إيقاف الطوارئ: " +
        error.message
      );
    }
  }

  async function startOperations() {
    try {
      const response =
        await request(
          "/start",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

      alert(
        response.message ||
        "تم إرسال أمر التشغيل."
      );

      await loadAll();

    } catch (error) {
      console.error(error);

      alert(
        "تعذر تشغيل مركز العمليات: " +
        error.message
      );
    }
  }

  async function stopOperations() {
    const confirmed =
      window.confirm(
        "هل تريد إيقاف مركز العمليات الآلي؟"
      );

    if (!confirmed) return;

    try {
      const response =
        await request(
          "/stop",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            }
          }
        );

      alert(
        response.message ||
        "تم إرسال أمر الإيقاف."
      );

      await loadAll();

    } catch (error) {
      console.error(error);

      alert(
        "تعذر إيقاف المركز: " +
        error.message
      );
    }
  }

  function setupButtons() {
    const emergency =
      $("#emergency-stop");

    if (emergency) {
      emergency.onclick =
        emergencyStop;
    }

    const start =
      $("#start-operations") ||
      $("#start-automation");

    if (start) {
      start.onclick =
        startOperations;
    }

    const stop =
      $("#stop-operations") ||
      $("#stop-automation");

    if (stop) {
      stop.onclick =
        stopOperations;
    }

    const refresh =
      $("#refresh") ||
      $("#refresh-dashboard");

    if (refresh) {
      refresh.onclick =
        loadAll;
    }
  }

  function setupNavigation() {
    $$(
      "[data-target]"
    ).forEach(button => {
      button.onclick = () => {

        const target =
          document.getElementById(
            button.dataset.target
          );

        if (!target) return;

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      };
    });
  }

  function setupKeyboard() {
    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "r" &&
          (event.ctrlKey ||
            event.metaKey)
        ) {
          event.preventDefault();
          loadAll();
        }
      }
    );
  }

  function setText(
    selectors,
    value
  ) {
    for (const selector of selectors) {
      const element = $(selector);

      if (element) {
        element.textContent =
          String(value);
        return;
      }
    }
  }

  function updateLastUpdate() {
    const element =
      $("#last-update") ||
      $("[data-last-update]");

    if (!element) return;

    element.textContent =
      state.lastUpdate
        ? formatDate(
            state.lastUpdate
          )
        : "غير متوفر";
  }

  function showError(message) {
    const container =
      $("#error-message") ||
      $("#connection-error");

    if (!container) return;

    container.textContent =
      message;

    container.hidden = false;

    setTimeout(() => {
      container.hidden = true;
    }, 5000);
  }

  function registerServiceWorker() {
    if (
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register(
          "/autonomous-media-operations/service-worker.js"
        )
        .catch(error => {
          console.warn(
            "لم يتم تسجيل Service Worker:",
            error
          );
        });
    }
  }

  function startAutoRefresh() {
    setInterval(
      () => {
        if (!state.loading) {
          loadAll();
        }
      },
      10000
    );
  }

  async function initialize() {
    setupButtons();
    setupNavigation();
    setupKeyboard();

    registerServiceWorker();

    await loadAll();

    startAutoRefresh();
  }

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );
})();
