/* ============================================================
   EZ MEDIA — AI COMMAND CENTER
   CODE 63
   Frontend Controller
   ============================================================ */

(() => {
  "use strict";


  /* ==========================================================
     CONFIGURATION
     ========================================================== */

  const CONFIG = {
    API_BASE: "/api/ai/command-center",
    REFRESH_INTERVAL: 15000,
    REQUEST_TIMEOUT: 20000
  };


  /* ==========================================================
     STATE
     ========================================================== */

  const state = {
    connected: false,
    loading: false,
    dashboard: null,
    ai: null,
    provider: null,
    orchestrator: null,
    automation: null,
    review: null,
    plans: [],
    alerts: [],
    events: [],
    usage: null,
    operations: [],
    currentSection: "dashboard"
  };


  /* ==========================================================
     DOM
     ========================================================== */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];


  /* ==========================================================
     HELPERS
     ========================================================== */

  function escapeHTML(value) {

    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function formatNumber(value) {

    const number = Number(value || 0);

    return new Intl.NumberFormat("ar-SA").format(number);
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

    } catch {

      return String(value);
    }
  }


  function formatStatus(status) {

    const map = {
      online: "متصل",
      ready: "جاهز",
      healthy: "سليم",
      running: "يعمل",
      active: "نشط",
      completed: "مكتمل",
      success: "ناجح",
      pending: "معلق",
      queued: "في الانتظار",
      failed: "فشل",
      error: "خطأ",
      stopped: "متوقف",
      paused: "متوقف مؤقتًا",
      degraded: "متدهور",
      unavailable: "غير متاح",
      idle: "خامل"
    };

    return map[String(status || "").toLowerCase()]
      || status
      || "—";
  }


  function statusClass(status) {

    const value = String(status || "").toLowerCase();

    if (
      ["online", "ready", "healthy", "completed", "success", "active"]
        .includes(value)
    ) {
      return "status-success";
    }

    if (
      ["running", "processing", "queued"]
        .includes(value)
    ) {
      return "status-running";
    }

    if (
      ["pending", "paused", "degraded"]
        .includes(value)
    ) {
      return "status-warning";
    }

    if (
      ["failed", "error", "stopped", "unavailable"]
        .includes(value)
    ) {
      return "status-error";
    }

    return "status-warning";
  }


  function getNested(object, path, fallback = undefined) {

    if (!object) {
      return fallback;
    }

    const parts = path.split(".");

    let current = object;

    for (const part of parts) {

      if (
        current === null ||
        current === undefined ||
        !(part in current)
      ) {
        return fallback;
      }

      current = current[part];
    }

    return current;
  }


  function normalizeArray(value) {

    if (Array.isArray(value)) {
      return value;
    }

    if (!value) {
      return [];
    }

    if (Array.isArray(value.items)) {
      return value.items;
    }

    if (Array.isArray(value.data)) {
      return value.data;
    }

    if (Array.isArray(value.results)) {
      return value.results;
    }

    return [];
  }


  /* ==========================================================
     TOAST
     ========================================================== */

  function toast(message, type = "success") {

    const container = $("#toastContainer");

    if (!container) {
      return;
    }

    const element = document.createElement("div");

    element.className = `toast ${type}`;

    element.textContent = message;

    container.appendChild(element);

    setTimeout(() => {

      element.remove();

    }, 4500);
  }


  /* ==========================================================
     API
     ========================================================== */

  async function apiRequest(
    endpoint,
    options = {}
  ) {

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        CONFIG.REQUEST_TIMEOUT
      );

    try {

      const response = await fetch(
        `${CONFIG.API_BASE}${endpoint}`,
        {
          ...options,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
          }
        }
      );

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {
          raw: text
        };
      }

      if (!response.ok) {

        const message =
          data.message ||
          data.error ||
          `HTTP ${response.status}`;

        throw new Error(message);
      }

      return data;

    } finally {

      clearTimeout(timeout);
    }
  }


  /* ==========================================================
     CONNECTION
     ========================================================== */

  function setConnection(online) {

    state.connected = online;

    const status =
      $("#connectionStatus");

    const text =
      $("#connectionText");

    if (!status || !text) {
      return;
    }

    status.classList.toggle(
      "online",
      online
    );

    status.classList.toggle(
      "offline",
      !online
    );

    text.textContent =
      online
        ? "مركز القيادة متصل"
        : "مركز القيادة غير متصل";
  }


  /* ==========================================================
     NAVIGATION
     ========================================================== */

  function showSection(section) {

    state.currentSection = section;

    $$(".nav-item").forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.section === section
      );

    });

    $$(".dashboard-section").forEach(element => {

      element.classList.toggle(
        "active",
        element.id === `section-${section}`
      );

    });

    const sidebar =
      $("#sidebar");

    if (sidebar) {
      sidebar.classList.remove("open");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  function initializeNavigation() {

    $$(".nav-item").forEach(item => {

      item.addEventListener(
        "click",
        () => showSection(item.dataset.section)
      );

    });


    $$("[data-section-link]").forEach(button => {

      button.addEventListener(
        "click",
        () => showSection(button.dataset.sectionLink)
      );

    });


    $("#menuButton")?.addEventListener(
      "click",
      () => $("#sidebar")?.classList.add("open")
    );


    $("#sidebarClose")?.addEventListener(
      "click",
      () => $("#sidebar")?.classList.remove("open")
    );

  }


  /* ==========================================================
     DASHBOARD
     ========================================================== */

  async function loadDashboard() {

    try {

      const data =
        await apiRequest("/dashboard");

      state.dashboard = data;

      renderDashboard(data);

      setConnection(true);

    } catch (error) {

      console.error(
        "Dashboard error:",
        error
      );

      setConnection(false);

      renderConnectionError();
    }
  }


  function renderDashboard(data) {

    const platform =
      data.platform ||
      data.system ||
      data;

    const ai =
      data.ai ||
      data.aiCore ||
      {};

    const automation =
      data.automation ||
      {};

    const review =
      data.humanReview ||
      data.review ||
      {};

    const plans =
      data.plans ||
      data.activePlans ||
      [];

    const alerts =
      data.alerts ||
      [];

    const events =
      data.events ||
      [];

    $("#platformVersion").textContent =
      platform.version ||
      data.version ||
      "11.0.0";

    $("#aiProvider").textContent =
      ai.provider ||
      data.provider ||
      "OpenAI";

    $("#lastUpdate").textContent =
      formatDate(
        data.timestamp ||
        data.updatedAt ||
        new Date()
      );

    const status =
      data.status ||
      platform.status ||
      ai.status ||
      "online";

    $("#mainStatus").textContent =
      formatStatus(status);

    $("#mainStatusDescription").textContent =
      statusDescription(status);

    $("#mainStatusIcon").textContent =
      statusIcon(status);

    $("#statAI").textContent =
      formatStatus(
        ai.status ||
        data.aiStatus ||
        "online"
      );

    $("#statAIDetail").textContent =
      ai.model ||
      data.model ||
      "AI Core";

    $("#statPlans").textContent =
      formatNumber(
        getCollectionLength(plans)
      );

    $("#statReviews").textContent =
      formatNumber(
        review.pending ||
        review.pendingCount ||
        getCollectionLength(
          review.items
        )
      );

    $("#statAutomation").textContent =
      formatNumber(
        automation.running ||
        automation.runningTasks ||
        automation.activeTasks ||
        0
      );

    $("#statAlerts").textContent =
      formatNumber(
        getCollectionLength(alerts)
      );

    $("#statUsage").textContent =
      formatNumber(
        ai.requests ||
        ai.totalRequests ||
        data.requests ||
        0
      );

    renderPlans(
      normalizeArray(plans),
      "#activePlansList"
    );

    renderAlerts(
      normalizeArray(alerts),
      "#dashboardAlerts"
    );

    renderEvents(
      normalizeArray(events),
      "#dashboardEvents"
    );
  }


  function statusDescription(status) {

    const value =
      String(status || "").toLowerCase();

    if (
      ["online", "ready", "healthy", "active"]
        .includes(value)
    ) {
      return "جميع الأنظمة الأساسية تعمل ضمن الحالة التشغيلية الحالية.";
    }

    if (
      ["degraded", "warning"]
        .includes(value)
    ) {
      return "النظام يعمل مع وجود مكونات تحتاج إلى المتابعة.";
    }

    if (
      ["stopped", "offline"]
        .includes(value)
    ) {
      return "مركز القيادة غير نشط حاليًا.";
    }

    return "تم استلام حالة النظام من مركز القيادة.";
  }


  function statusIcon(status) {

    const value =
      String(status || "").toLowerCase();

    if (
      ["online", "ready", "healthy", "active"]
        .includes(value)
    ) {
      return "✓";
    }

    if (
      ["failed", "error", "offline"]
        .includes(value)
    ) {
      return "!";
    }

    return "✦";
  }


  function renderConnectionError() {

    $("#mainStatus").textContent =
      "غير متصل";

    $("#mainStatusDescription").textContent =
      "تعذر الوصول إلى AI Command Center API.";

    $("#mainStatusIcon").textContent =
      "!";

  }


  function getCollectionLength(value) {

    if (Array.isArray(value)) {
      return value.length;
    }

    if (
      value &&
      Array.isArray(value.items)
    ) {
      return value.items.length;
    }

    if (
      value &&
      typeof value.count === "number"
    ) {
      return value.count;
    }

    return Number(value || 0);
  }


  /* ==========================================================
     AI STATUS
     ========================================================== */

  async function loadAIStatus() {

    try {

      const data =
        await apiRequest("/ai/status");

      state.ai = data;

      const ai =
        data.ai ||
        data.core ||
        data;

      const provider =
        data.provider ||
        ai.provider ||
        {};

      const orchestrator =
        data.orchestrator ||
        {};

      $("#aiCoreStatus").textContent =
        formatStatus(
          ai.status ||
          "online"
        );

      $("#providerStatus").textContent =
        provider.name ||
        provider.provider ||
        formatStatus(
          provider.status ||
          "online"
        );

      $("#orchestratorStatus").textContent =
        formatStatus(
          orchestrator.status ||
          "online"
        );

    } catch (error) {

      console.error(
        "AI status error:",
        error
      );
    }
  }


  /* ==========================================================
     PROVIDER
     ========================================================== */

  async function loadProvider() {

    try {

      const data =
        await apiRequest("/provider");

      state.provider = data;

      const provider =
        data.provider ||
        data;

      $("#aiProvider").textContent =
        provider.name ||
        provider.provider ||
        "OpenAI";

    } catch (error) {

      console.error(
        "Provider error:",
        error
      );
    }
  }


  /* ==========================================================
     ORCHESTRATOR
     ========================================================== */

  async function loadOrchestrator() {

    try {

      const data =
        await apiRequest("/orchestrator");

      state.orchestrator = data;

    } catch (error) {

      console.error(
        "Orchestrator error:",
        error
      );
    }
  }


  /* ==========================================================
     AUTOMATION
     ========================================================== */

  async function loadAutomation() {

    try {

      const data =
        await apiRequest("/automation");

      state.automation = data;

      const automation =
        data.automation ||
        data.engine ||
        data;

      $("#automationStatus").textContent =
        formatStatus(
          automation.status ||
          automation.state ||
          "running"
        );

      $("#automationEngineState").textContent =
        formatStatus(
          automation.status ||
          automation.state ||
          "running"
        );

      $("#automationWorkers").textContent =
        formatNumber(
          automation.workers ||
          automation.concurrency ||
          0
        );

      $("#automationRunning").textContent =
        formatNumber(
          automation.running ||
          automation.runningTasks ||
          0
        );

      $("#automationQueued").textContent =
        formatNumber(
          automation.queued ||
          automation.queueSize ||
          0
        );

      renderWorkflows(
        normalizeArray(
          automation.workflows
        )
      );

    } catch (error) {

      console.error(
        "Automation error:",
        error
      );
    }
  }


  /* ==========================================================
     HUMAN REVIEW
     ========================================================== */

  async function loadHumanReview() {

    try {

      const data =
        await apiRequest("/human-review");

      state.review = data;

      const review =
        data.review ||
        data;

      $("#reviewPending").textContent =
        formatNumber(
          review.pending ||
          review.pendingCount ||
          0
        );

      $("#reviewApproved").textContent =
        formatNumber(
          review.approved ||
          review.approvedCount ||
          0
        );

      $("#reviewRejected").textContent =
        formatNumber(
          review.rejected ||
          review.rejectedCount ||
          0
        );

      renderReview(
        normalizeArray(
          review.items ||
          review.pendingItems ||
          data.items
        )
      );

    } catch (error) {

      console.error(
        "Review error:",
        error
      );
    }
  }


  /* ==========================================================
     PLANS
     ========================================================== */

  async function loadPlans() {

    try {

      const data =
        await apiRequest("/plans/active");

      state.plans =
        normalizeArray(
          data.plans ||
          data.items ||
          data
        );

      renderPlans(
        state.plans,
        "#activePlansList"
      );

      renderPlansTable(
        state.plans
      );

    } catch (error) {

      console.error(
        "Plans error:",
        error
      );
    }
  }


  /* ==========================================================
     ALERTS
     ========================================================== */

  async function loadAlerts() {

    try {

      const data =
        await apiRequest("/alerts");

      state.alerts =
        normalizeArray(
          data.alerts ||
          data.items ||
          data
        );

      renderAlerts(
        state.alerts,
        "#dashboardAlerts"
      );

      renderAlerts(
        state.alerts,
        "#alertsList"
      );

    } catch (error) {

      console.error(
        "Alerts error:",
        error
      );
    }
  }


  /* ==========================================================
     EVENTS
     ========================================================== */

  async function loadEvents() {

    try {

      const data =
        await apiRequest("/events");

      state.events =
        normalizeArray(
          data.events ||
          data.items ||
          data
        );

      renderEvents(
        state.events,
        "#dashboardEvents"
      );

      renderEvents(
        state.events,
        "#eventsList"
      );

    } catch (error) {

      console.error(
        "Events error:",
        error
      );
    }
  }


  /* ==========================================================
     USAGE
     ========================================================== */

  async function loadUsage() {

    try {

      const data =
        await apiRequest("/usage");

      state.usage = data;

      const usage =
        data.usage ||
        data;

      $("#usageRequests").textContent =
        formatNumber(
          usage.requests ||
          usage.totalRequests ||
          0
        );

      $("#usageSuccess").textContent =
        formatNumber(
          usage.success ||
          usage.successfulRequests ||
          0
        );

      $("#usageErrors").textContent =
        formatNumber(
          usage.errors ||
          usage.failedRequests ||
          0
        );

      $("#usageDuration").textContent =
        `${formatNumber(
          usage.averageDuration ||
          usage.averageDurationMs ||
          0
        )} ms`;

      $("#usageViewer").textContent =
        JSON.stringify(
          data,
          null,
          2
        );

    } catch (error) {

      console.error(
        "Usage error:",
        error
      );
    }
  }


  /* ==========================================================
     OPERATIONS
     ========================================================== */

  async function loadOperations() {

    try {

      const data =
        await apiRequest("/summary");

      const operations =
        data.operations ||
        data.availableOperations ||
        [];

      state.operations =
        normalizeArray(operations);

      renderOperations(
        state.operations
      );

    } catch (error) {

      console.error(
        "Operations error:",
        error
      );

      renderOperations(
        defaultOperations()
      );
    }
  }


  function defaultOperations() {

    return [
      {
        id: "analyze-content",
        name: "تحليل المحتوى",
        description: "تحليل جودة المحتوى وبنيته."
      },
      {
        id: "analyze-news",
        name: "تحليل الأخبار",
        description: "تحليل الأخبار وتحديد الأولوية."
      },
      {
        id: "summarize",
        name: "التلخيص",
        description: "إنشاء ملخص ذكي للمحتوى."
      },
      {
        id: "generate-title",
        name: "العناوين",
        description: "اقتراح عناوين إعلامية."
      },
      {
        id: "seo",
        name: "SEO",
        description: "تحسين المحتوى لمحركات البحث."
      },
      {
        id: "fact-check",
        name: "تدقيق الحقائق",
        description: "تحليل المعلومات والمصادر."
      },
      {
        id: "risk-analysis",
        name: "تحليل المخاطر",
        description: "تقييم المخاطر التحريرية."
      },
      {
        id: "publishing-decision",
        name: "قرار النشر",
        description: "اقتراح قرار نشر ذكي."
      }
    ];
  }


  function renderOperations(operations) {

    const container =
      $("#operationsGrid");

    if (!container) {
      return;
    }

    if (!operations.length) {

      container.innerHTML =
        '<div class="empty-state">لا توجد عمليات متاحة.</div>';

      return;
    }

    container.innerHTML =
      operations.map(operation => `

        <div class="operation-card">

          <strong>
            ${escapeHTML(
              operation.name ||
              operation.title ||
              operation.id
            )}
          </strong>

          <small>
            ${escapeHTML(
              operation.description ||
              operation.id ||
              "عملية AI"
            )}
          </small>

        </div>

      `).join("");
  }


  /* ==========================================================
     RENDER PLANS
     ========================================================== */

  function renderPlans(
    plans,
    selector
  ) {

    const container =
      $(selector);

    if (!container) {
      return;
    }

    if (!plans.length) {

      container.innerHTML =
        '<div class="empty-state">لا توجد خطط نشطة حاليًا.</div>';

      return;
    }

    container.innerHTML =
      plans.slice(0, 8).map(plan => {

        const status =
          plan.status ||
          "running";

        return `

          <div class="list-item">

            <div class="list-item-main">

              <div class="list-item-title">
                ${escapeHTML(
                  plan.name ||
                  plan.title ||
                  plan.operation ||
                  plan.id ||
                  "خطة AI"
                )}
              </div>

              <div class="list-item-meta">
                ${escapeHTML(
                  plan.operation ||
                  plan.type ||
                  plan.createdAt ||
                  ""
                )}
              </div>

            </div>

            <span
              class="list-item-status ${statusClass(status)}"
            >
              ${escapeHTML(
                formatStatus(status)
              )}
            </span>

          </div>
        `;

      }).join("");
  }


  function renderPlansTable(plans) {

    const container =
      $("#plansTable");

    if (!container) {
      return;
    }

    if (!plans.length) {

      container.innerHTML =
        '<div class="empty-state">لا توجد خطط نشطة.</div>';

      return;
    }

    container.innerHTML = `

      <table class="data-table">

        <thead>

          <tr>
            <th>الخطة</th>
            <th>العملية</th>
            <th>الحالة</th>
            <th>الإنشاء</th>
            <th>المعرّف</th>
          </tr>

        </thead>

        <tbody>

          ${plans.map(plan => {

            const status =
              plan.status ||
              "running";

            return `

              <tr>

                <td>
                  ${escapeHTML(
                    plan.name ||
                    plan.title ||
                    "خطة AI"
                  )}
                </td>

                <td>
                  ${escapeHTML(
                    plan.operation ||
                    plan.type ||
                    "—"
                  )}
                </td>

                <td>

                  <span
                    class="list-item-status ${statusClass(status)}"
                  >
                    ${escapeHTML(
                      formatStatus(status)
                    )}
                  </span>

                </td>

                <td>
                  ${escapeHTML(
                    formatDate(
                      plan.createdAt
                    )
                  )}
                </td>

                <td>
                  ${escapeHTML(
                    plan.id ||
                    "—"
                  )}
                </td>

              </tr>

            `;

          }).join("")}

        </tbody>

      </table>
    `;
  }


  /* ==========================================================
     ALERTS
     ========================================================== */

  function renderAlerts(
    alerts,
    selector
  ) {

    const container =
      $(selector);

    if (!container) {
      return;
    }

    if (!alerts.length) {

      container.innerHTML =
        '<div class="empty-state">لا توجد تنبيهات.</div>';

      return;
    }

    container.innerHTML =
      alerts.slice(0, 10).map(alert => `

        <div class="alert-card">

          <h4>
            ${escapeHTML(
              alert.title ||
              alert.name ||
              "تنبيه النظام"
            )}
          </h4>

          <p>
            ${escapeHTML(
              alert.message ||
              alert.description ||
              alert.details ||
              ""
            )}
          </p>

          <p>
            ${escapeHTML(
              formatDate(
                alert.createdAt ||
                alert.timestamp
              )
            )}
          </p>

        </div>

      `).join("");
  }


  /* ==========================================================
     EVENTS
     ========================================================== */

  function renderEvents(
    events,
    selector
  ) {

    const container =
      $(selector);

    if (!container) {
      return;
    }

    if (!events.length) {

      container.innerHTML =
        '<div class="empty-state">لا توجد أحداث.</div>';

      return;
    }

    container.innerHTML =
      events.slice(0, 12).map(event => `

        <div class="event-card">

          <h4>
            ${escapeHTML(
              event.type ||
              event.name ||
              event.event ||
              "System Event"
            )}
          </h4>

          <p>
            ${escapeHTML(
              event.message ||
              event.description ||
              JSON.stringify(
                event.data || {}
              )
            )}
          </p>

          <p>
            ${escapeHTML(
              formatDate(
                event.createdAt ||
                event.timestamp
              )
            )}
          </p>

        </div>

      `).join("");
  }


  /* ==========================================================
     REVIEW
     ========================================================== */

  function renderReview(items) {

    const container =
      $("#reviewList");

    if (!container) {
      return;
    }

    if (!items.length) {

      container.innerHTML =
        '<div class="empty-state">لا توجد عمليات تنتظر المراجعة البشرية.</div>';

      return;
    }

    container.innerHTML =
      items.map(item => `

        <div class="review-card">

          <div>

            <h4>
              ${escapeHTML(
                item.title ||
                item.name ||
                item.operation ||
                "مراجعة AI"
              )}
            </h4>

            <p>
              ${escapeHTML(
                item.description ||
                item.reason ||
                item.summary ||
                ""
              )}
            </p>

          </div>

          <div class="review-actions">

            <button
              class="small-button approve"
              data-review-action="approve"
              data-plan-id="${escapeHTML(
                item.planId ||
                item.id ||
                ""
              )}"
              type="button"
            >
              موافقة
            </button>

            <button
              class="small-button reject"
              data-review-action="reject"
              data-plan-id="${escapeHTML(
                item.planId ||
                item.id ||
                ""
              )}"
              type="button"
            >
              رفض
            </button>

          </div>

        </div>

      `).join("");

    $$("[data-review-action]", container)
      .forEach(button => {

        button.addEventListener(
          "click",
          () => handleReviewAction(
            button.dataset.reviewAction,
            button.dataset.planId
          )
        );

      });
  }


  /* ==========================================================
     WORKFLOWS
     ========================================================== */

  function renderWorkflows(workflows) {

    const container =
      $("#workflowGrid");

    if (!container) {
      return;
    }

    if (!workflows.length) {

      container.innerHTML =
        '<div class="empty-state">لا توجد مسارات أتمتة معروضة.</div>';

      return;
    }

    container.innerHTML =
      workflows.map(workflow => `

        <div class="workflow-card">

          <h4>
            ${escapeHTML(
              workflow.name ||
              workflow.id ||
              "Workflow"
            )}
          </h4>

          <p>
            ${escapeHTML(
              workflow.description ||
              workflow.trigger ||
              "مسار أتمتة ذكي"
            )}
          </p>

          <p>
            الحالة:
            ${escapeHTML(
              formatStatus(
                workflow.status ||
                "active"
              )
            )}
          </p>

        </div>

      `).join("");
  }


  /* ==========================================================
     COMMAND CENTER
     ========================================================== */

  async function executeCommand() {

    const input =
      $("#commandInput");

    const type =
      $("#commandType");

    const result =
      $("#commandResult");

    if (!input || !type || !result) {
      return;
    }

    const command =
      input.value.trim();

    if (!command) {

      toast(
        "اكتب الأمر أولاً.",
        "error"
      );

      input.focus();

      return;
    }

    const button =
      $("#executeCommand");

    button.disabled = true;

    button.textContent =
      "جاري التنفيذ...";

    result.textContent =
      "مركز القيادة يعالج الأمر الآن...";

    try {

      const response =
        await apiRequest(
          "/command",
          {
            method: "POST",

            body: JSON.stringify({
              command,
              operation: type.value,
              source: "ai-command-center",
              interface: "CODE-63"
            })
          }
        );

      result.textContent =
        formatCommandResult(response);

      toast(
        "تم إرسال الأمر إلى مركز القيادة.",
        "success"
      );

      await refreshAll();

    } catch (error) {

      result.textContent =
        `حدث خطأ:\n${error.message}`;

      toast(
        error.message ||
        "تعذر تنفيذ الأمر.",
        "error"
      );

    } finally {

      button.disabled = false;

      button.textContent =
        "✦ تنفيذ الأمر";
    }
  }


  function formatCommandResult(data) {

    if (!data) {
      return "تم التنفيذ.";
    }

    if (typeof data === "string") {
      return data;
    }

    if (data.message) {

      const rest = {
        ...data
      };

      delete rest.message;

      return [
        data.message,
        Object.keys(rest).length
          ? JSON.stringify(
              rest,
              null,
              2
            )
          : ""
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    return JSON.stringify(
      data,
      null,
      2
    );
  }


  /* ==========================================================
     HUMAN REVIEW ACTION
     ========================================================== */

  async function handleReviewAction(
    action,
    planId
  ) {

    if (!planId) {

      toast(
        "معرّف الخطة غير موجود.",
        "error"
      );

      return;
    }

    const endpoint =
      `/plans/${encodeURIComponent(planId)}/${action}`;

    try {

      await apiRequest(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({
            source: "ai-command-center",
            interface: "CODE-63"
          })
        }
      );

      toast(
        action === "approve"
          ? "تمت الموافقة على الخطة."
          : "تم رفض الخطة.",
        "success"
      );

      await loadHumanReview();
      await loadPlans();

    } catch (error) {

      toast(
        error.message ||
        "تعذر تنفيذ القرار.",
        "error"
      );
    }
  }


  /* ==========================================================
     EMERGENCY STOP
     ========================================================== */

  function openConfirmation(
    title,
    message,
    onConfirm,
    danger = true
  ) {

    const overlay =
      $("#modalOverlay");

    const titleElement =
      $("#modalTitle");

    const body =
      $("#modalBody");

    const confirm =
      $("#modalConfirm");

    if (!overlay) {
      return;
    }

    titleElement.textContent =
      title;

    body.textContent =
      message;

    confirm.textContent =
      danger
        ? "تأكيد الإيقاف"
        : "تأكيد";

    confirm.className =
      danger
        ? "danger-button"
        : "primary-button";

    overlay.hidden = false;

    const handler = async () => {

      confirm.disabled = true;

      try {

        await onConfirm();

      } finally {

        confirm.disabled = false;

        overlay.hidden = true;

        confirm.removeEventListener(
          "click",
          handler
        );
      }
    };

    confirm.addEventListener(
      "click",
      handler
    );
  }


  async function emergencyStop() {

    openConfirmation(
      "الإيقاف الطارئ",
      "سيتم إيقاف خدمات الذكاء والأتمتة المرتبطة بمركز القيادة فقط. لن يتم تنفيذ أي أمر على نظام التشغيل أو الخادم.",
      async () => {

        try {

          await apiRequest(
            "/emergency-stop",
            {
              method: "POST",

              body: JSON.stringify({
                source: "CODE-63"
              })
            }
          );

          toast(
            "تم إرسال أمر الإيقاف الطارئ.",
            "success"
          );

          await refreshAll();

        } catch (error) {

          toast(
            error.message ||
            "تعذر تنفيذ الإيقاف الطارئ.",
            "error"
          );
        }
      }
    );
  }


  /* ==========================================================
     RESUME
     ========================================================== */

  async function resumeSystem() {

    try {

      await apiRequest(
        "/resume",
        {
          method: "POST",

          body: JSON.stringify({
            source: "CODE-63"
          })
        }
      );

      toast(
        "تم إرسال أمر استئناف النظام.",
        "success"
      );

      await refreshAll();

    } catch (error) {

      toast(
        error.message ||
        "تعذر استئناف النظام.",
        "error"
      );
    }
  }


  /* ==========================================================
     REFRESH
     ========================================================== */

  async function refreshAll() {

    if (state.loading) {
      return;
    }

    state.loading = true;

    try {

      await Promise.allSettled([
        loadDashboard(),
        loadAIStatus(),
        loadProvider(),
        loadOrchestrator(),
        loadAutomation(),
        loadHumanReview(),
        loadPlans(),
        loadAlerts(),
        loadEvents(),
        loadUsage(),
        loadOperations()
      ]);

    } finally {

      state.loading = false;
    }
  }


  /* ==========================================================
     CLOCK
     ========================================================== */

  function updateClock() {

    const element =
      $("#systemTime");

    if (!element) {
      return;
    }

    element.textContent =
      new Intl.DateTimeFormat(
        "ar-SA",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      ).format(new Date());
  }


  /* ==========================================================
     MODAL
     ========================================================== */

  function initializeModal() {

    $("#modalClose")?.addEventListener(
      "click",
      () => {
        $("#modalOverlay").hidden = true;
      }
    );

    $("#modalCancel")?.addEventListener(
      "click",
      () => {
        $("#modalOverlay").hidden = true;
      }
    );

    $("#modalOverlay")?.addEventListener(
      "click",
      event => {

        if (
          event.target.id ===
          "modalOverlay"
        ) {
          event.currentTarget.hidden = true;
        }

      }
    );
  }


  /* ==========================================================
     BUTTONS
     ========================================================== */

  function initializeButtons() {

    $("#refreshButton")?.addEventListener(
      "click",
      refreshAll
    );

    $("#dashboardRefresh")?.addEventListener(
      "click",
      refreshAll
    );

    $("#plansRefresh")?.addEventListener(
      "click",
      loadPlans
    );

    $("#executeCommand")?.addEventListener(
      "click",
      executeCommand
    );

    $("#emergencyButton")?.addEventListener(
      "click",
      emergencyStop
    );

    $("#resumeButton")?.addEventListener(
      "click",
      resumeSystem
    );

    $("#commandInput")?.addEventListener(
      "keydown",
      event => {

        if (
          (event.ctrlKey || event.metaKey) &&
          event.key === "Enter"
        ) {
          executeCommand();
        }

      }
    );
  }


  /* ==========================================================
     AUTO REFRESH
     ========================================================== */

  function initializeAutoRefresh() {

    setInterval(
      async () => {

        if (
          document.visibilityState ===
          "visible"
        ) {
          await refreshAll();
        }

      },
      CONFIG.REFRESH_INTERVAL
    );
  }


  /* ==========================================================
     INITIALIZE
     ========================================================== */

  async function initialize() {

    initializeNavigation();

    initializeButtons();

    initializeModal();

    updateClock();

    setInterval(
      updateClock,
      1000
    );

    await refreshAll();

    initializeAutoRefresh();

  }


  /* ==========================================================
     START
     ========================================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );

  } else {

    initialize();

  }

})();
