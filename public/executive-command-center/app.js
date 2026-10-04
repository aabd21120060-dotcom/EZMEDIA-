"use strict";

/* ============================================================
   EZ MEDIA
   CODE 101
   EXECUTIVE COMMAND CENTER
============================================================ */

const API = {
  command:
    "/api/command",

  analytics:
    "/api/analytics",

  live:
    "/api/live",

  automation:
    "/api/automation"
};

const state = {
  snapshot: null,
  decisions: [],
  alerts: [],
  plans: [],
  analytics: null,
  live: null,
  automation: null,

  refreshing: false
};


/* ============================================================
   HELPERS
============================================================ */

function $(selector) {
  return document.querySelector(
    selector
  );
}

function safeNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
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

function formatNumber(value) {
  return new Intl.NumberFormat(
    "ar-SA"
  ).format(
    safeNumber(value)
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(
      value
    ).toLocaleString(
      "ar-SA"
    );
  } catch {
    return "—";
  }
}

async function fetchJSON(
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
          "Content-Type":
            "application/json",

          ...(options.headers ||
            {})
        },

        ...options
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok
  ) {
    throw new Error(
      data.error ||
      `HTTP ${response.status}`
    );
  }

  return data;
}


/* ============================================================
   STATUS
============================================================ */

function updateSystemStatus(
  snapshot
) {
  const status =
    snapshot?.status ||
    "unknown";

  const dot =
    $("#systemStatusDot");

  const text =
    $("#systemStatusText");

  dot.className =
    "status-dot";

  if (
    status ===
    "excellent"
  ) {
    dot.classList.add(
      "online"
    );

    text.textContent =
      "ممتاز";
  } else if (
    status ===
      "healthy" ||
    status ===
      "degraded"
  ) {
    dot.classList.add(
      "online"
    );

    text.textContent =
      status ===
      "healthy"
        ? "مستقر"
        : "يحتاج متابعة";
  } else {
    dot.classList.add(
      "error"
    );

    text.textContent =
      "يتطلب مراجعة";
  }

  $("#lastUpdate")
    .textContent =
    formatDate(
      snapshot?.createdAt
    );
}


/* ============================================================
   SCORE RENDER
============================================================ */

function setScore(
  elementId,
  barId,
  value
) {
  const score =
    Math.max(
      0,
      Math.min(
        100,
        safeNumber(value)
      )
    );

  $(`#${elementId}`)
    .textContent =
    `${score}%`;

  $(`#${barId}`)
    .style.width =
    `${score}%`;
}

function renderScores(
  snapshot
) {
  const scores =
    snapshot?.scores ||
    {};

  setScore(
    "healthScore",
    "healthBar",
    scores.healthScore
  );

  setScore(
    "businessScore",
    "businessBar",
    scores.businessScore
  );

  setScore(
    "audienceScore",
    "audienceBar",
    scores.audienceScore
  );

  setScore(
    "revenueScore",
    "revenueBar",
    scores.revenueScore
  );

  setScore(
    "editorialScore",
    "editorialBar",
    scores.editorialScore
  );

  setScore(
    "riskScore",
    "riskBar",
    scores.riskScore
  );

  const overall =
    Math.round(
      (
        safeNumber(
          scores.healthScore
        ) +
        safeNumber(
          scores.businessScore
        ) +
        safeNumber(
          scores.editorialScore
        ) +
        safeNumber(
          scores.audienceScore
        )
      ) /
      4
    );

  $("#overallScore")
    .textContent =
    `${overall}%`;

  $("#overallStatus")
    .textContent =
    snapshot?.status ||
    "—";

  $("#executiveSummary")
    .textContent =
    snapshot?.summary ||
    "لا توجد خلاصة حالية.";
}


/* ============================================================
   PRIORITIES
============================================================ */

function renderPriorities() {
  const container =
    $("#priorityList");

  const decisions =
    [...state.decisions]
      .sort(
        (a, b) =>
          safeNumber(
            b.score
          ) -
          safeNumber(
            a.score
          )
      )
      .slice(0, 5);

  if (
    !decisions.length
  ) {
    container.innerHTML =
      `<div class="empty">
        لا توجد أولويات حالية.
      </div>`;

    return;
  }

  container.innerHTML =
    decisions
      .map(
        decision => `
          <div class="list-item">
            <strong>
              ${escapeHtml(
                decision.title
              )}
            </strong>

            <p>
              ${escapeHtml(
                decision.action
              )}
            </p>
          </div>
        `
      )
      .join("");
}


/* ============================================================
   NEXT ACTIONS
============================================================ */

function renderNextActions(
  result
) {
  const container =
    $("#nextActions");

  const actions =
    result?.nextActions ||
    [];

  if (
    !actions.length
  ) {
    container.innerHTML =
      `<div class="empty">
        لا توجد إجراءات عاجلة.
      </div>`;

    return;
  }

  container.innerHTML =
    actions
      .slice(0, 8)
      .map(
        item => `
          <div class="list-item">
            <strong>
              ${escapeHtml(
                item.priority
              )}
            </strong>

            <p>
              ${escapeHtml(
                item.action
              )}
            </p>
          </div>
        `
      )
      .join("");
}


/* ============================================================
   ALERTS
============================================================ */

function renderAlerts() {
  const container =
    $("#alerts");

  $("#alertCount")
    .textContent =
    state.alerts.length;

  if (
    !state.alerts.length
  ) {
    container.innerHTML =
      `<div class="empty">
        لا توجد تنبيهات مفتوحة.
      </div>`;

    return;
  }

  container.innerHTML =
    state.alerts
      .slice(0, 20)
      .map(
        alert => `
          <div
            class="alert alert-${escapeHtml(
              alert.severity ||
              "medium"
            )}"
          >
            <div>

              <strong>
                ${escapeHtml(
                  alert.title
                )}
              </strong>

              <p>
                ${escapeHtml(
                  alert.message
                )}
              </p>

            </div>
          </div>
        `
      )
      .join("");
}


/* ============================================================
   DECISIONS
============================================================ */

function renderDecisions() {
  const container =
    $("#decisions");

  $("#decisionCount")
    .textContent =
    state.decisions.length;

  if (
    !state.decisions.length
  ) {
    container.innerHTML =
      `<div class="empty">
        لا توجد قرارات حالية.
      </div>`;

    return;
  }

  container.innerHTML =
    state.decisions
      .slice(0, 12)
      .map(
        decision => `
          <article class="decision">

            <div class="decision-top">

              <span
                class="priority-${escapeHtml(
                  decision.priority ||
                  "medium"
                )}"
              >
                ${escapeHtml(
                  decision.priority ||
                  "medium"
                )}
              </span>

              <span class="badge">
                ${safeNumber(
                  decision.confidence
                )}%
              </span>

            </div>

            <h3>
              ${escapeHtml(
                decision.title
              )}
            </h3>

            <p>
              ${escapeHtml(
                decision.action
              )}
            </p>

          </article>
        `
      )
      .join("");
}


/* ============================================================
   ANALYTICS
============================================================ */

async function loadAnalytics() {
  try {
    const data =
      await fetchJSON(
        `${API.analytics}/statistics`
      );

    state.analytics =
      data.statistics ||
      {};

    const stats =
      state.analytics;

    $("#analyticsEvents")
      .textContent =
      formatNumber(
        stats.totalEvents
      );

    $("#analyticsInsights")
      .textContent =
      formatNumber(
        stats.totalInsights
      );

    $("#analyticsRecommendations")
      .textContent =
      formatNumber(
        stats.totalRecommendations
      );

    $("#analyticsTrends")
      .textContent =
      formatNumber(
        stats.totalTrends
      );

    $("#analyticsAnomalies")
      .textContent =
      formatNumber(
        stats.totalAnomalies
      );

    $("#analyticsReports")
      .textContent =
      formatNumber(
        stats.totalReports
      );

  } catch (error) {
    console.warn(
      "Analytics:",
      error.message
    );
  }
}


/* ============================================================
   SYSTEM MATRIX
============================================================ */

function renderSystemMatrix(
  snapshot
) {
  const container =
    $("#systemMatrix");

  const data =
    snapshot?.data ||
    {};

  const systems = [
    ["AI", data.platform],
    ["الأتمتة", data.automation],
    ["التحليلات", data.analytics],
    ["الجمهور", data.audience],
    ["الإعلانات", data.advertising],
    ["الإيرادات", data.monetization],
    ["CRM", data.crm],
    ["مصنع المحتوى", data.contentFactory],
    ["التوزيع", data.distribution],
    ["البث المباشر", data.liveBroadcast],
    ["الجدولة", data.broadcastScheduler],
    ["غرفة الأخبار", data.newsroom],
    ["المهام", data.assignment],
    ["الفريق", data.workforce],
    ["التدريب", data.training],
    ["الجودة", data.quality],
    ["الحقوق", data.legal],
    ["الأخلاقيات", data.ethics],
    ["الهوية", data.brand],
    ["Workflow", data.workflows],
    ["الأمن", data.security],
    ["التواصل", data.communication],
    ["الدعم", data.support]
  ];

  container.innerHTML =
    systems
      .map(
        ([name, system]) => {

          const status =
            system?.status ||
            {};

          const healthy =
            status.initialized ===
              true &&
            !status.error;

          const indicator =
            healthy
              ? "ok"
              : status.error
                ? "error"
                : "";

          return `
            <div class="system-item">

              <span class="system-name">
                ${escapeHtml(
                  name
                )}
              </span>

              <span
                class="system-indicator ${indicator}"
              ></span>

            </div>
          `;
        }
      )
      .join("");
}


/* ============================================================
   LIVE
============================================================ */

async function loadLive() {
  try {
    const data =
      await fetchJSON(
        `${API.live}/status`
      );

    state.live =
      data;

    const status =
      data.status ||
      {};

    $("#liveOperations")
      .innerHTML = `
        <div class="operation">

          <strong>
            حالة البث
          </strong>

          <span>
            ${escapeHtml(
              status.running
                ? "يعمل"
                : "متوقف / جاهز"
            )}
          </span>

        </div>

        <div class="operation">

          <strong>
            البث المباشر
          </strong>

          <span>
            ${escapeHtml(
              String(
                status.service ||
                "EZ MEDIA LIVE"
              )
            )}
          </span>

        </div>
      `;

  } catch (error) {

    $("#liveOperations")
      .innerHTML = `
        <div class="empty">
          خدمة البث غير متاحة حاليًا.
        </div>
      `;
  }
}


/* ============================================================
   AUTOMATION
============================================================ */

async function loadAutomation() {
  try {
    const data =
      await fetchJSON(
        `${API.automation}/statistics`
      );

    const stats =
      data.statistics ||
      {};

    $("#automationStatus")
      .innerHTML = `
        <div class="operation">

          <strong>
            المهام
          </strong>

          <span>
            ${formatNumber(
              stats.totalTasks ||
              stats.tasks ||
              0
            )}
          </span>

        </div>

        <div class="operation">

          <strong>
            قيد التنفيذ
          </strong>

          <span>
            ${formatNumber(
              stats.running ||
              stats.activeTasks ||
              0
            )}
          </span>

        </div>

        <div class="operation">

          <strong>
            المكتملة
          </strong>

          <span>
            ${formatNumber(
              stats.completed ||
              0
            )}
          </span>

        </div>
      `;

  } catch (error) {

    $("#automationStatus")
      .innerHTML = `
        <div class="empty">
          خدمة الأتمتة غير متاحة.
        </div>
      `;
  }
}


/* ============================================================
   ACTION PLAN
============================================================ */

function renderActionPlan(
  result
) {
  const container =
    $("#actionPlan");

  const plan =
    result?.actionPlan;

  if (
    !plan ||
    !Array.isArray(
      plan.actions
    ) ||
    !plan.actions.length
  ) {
    container.innerHTML =
      `<div class="empty">
        لا توجد خطة تنفيذية حالية.
      </div>`;

    return;
  }

  container.innerHTML =
    plan.actions
      .map(
        (action, index) => `
          <div class="plan-action">

            <div class="plan-number">
              ${index + 1}
            </div>

            <div>
              <strong>
                ${escapeHtml(
                  action.priority
                )}
              </strong>

              <div>
                ${escapeHtml(
                  action.action
                )}
              </div>
            </div>

          </div>
        `
      )
      .join("");
}


/* ============================================================
   FULL LOAD
============================================================ */

async function loadCommandCenter(
  runCycle = false
) {
  if (
    state.refreshing
  ) {
    return;
  }

  state.refreshing =
    true;

  try {

    if (
      runCycle
    ) {
      const result =
        await fetchJSON(
          `${API.command}/run`,
          {
            method:
              "POST",

            body:
              JSON.stringify({})
          }
        );

      state.snapshot =
        result.result?.snapshot;

      state.decisions =
        result.result?.decisions ||
        [];

      state.alerts =
        result.result?.alerts ||
        [];

      state.plans =
        result.result?.actionPlan
          ? [
              result.result
                .actionPlan
            ]
          : [];

      renderScores(
        state.snapshot
      );

      updateSystemStatus(
        state.snapshot
      );

      renderPriorities();
      renderNextActions(
        result.result
      );
      renderAlerts();
      renderDecisions();

      renderSystemMatrix(
        state.snapshot
      );

      renderActionPlan(
        result.result
      );

    } else {

      const snapshotResponse =
        await fetchJSON(
          `${API.command}/snapshot`
        );

      state.snapshot =
        snapshotResponse.snapshot;

      const [
        decisionsResponse,
        alertsResponse,
        plansResponse
      ] =
        await Promise.all([
          fetchJSON(
            `${API.command}/decisions`
          ),

          fetchJSON(
            `${API.command}/alerts`
          ),

          fetchJSON(
            `${API.command}/plans`
          )
        ]);

      state.decisions =
        decisionsResponse
          .decisions ||
        [];

      state.alerts =
        alertsResponse
          .alerts ||
        [];

      state.plans =
        plansResponse
          .plans ||
        [];

      renderScores(
        state.snapshot
      );

      updateSystemStatus(
        state.snapshot
      );

      renderPriorities();
      renderAlerts();
      renderDecisions();
      renderSystemMatrix(
        state.snapshot
      );

      renderActionPlan({
        actionPlan:
          state.plans[0]
      });

    }

    await Promise.all([
      loadAnalytics(),
      loadLive(),
      loadAutomation()
    ]);

  } catch (error) {

    console.error(
      "Command Center:",
      error
    );

    $("#systemStatusDot")
      .className =
      "status-dot error";

    $("#systemStatusText")
      .textContent =
      "تعذر الاتصال";

  } finally {

    state.refreshing =
      false;
  }
}


/* ============================================================
   EVENTS
============================================================ */

$("#refreshButton")
  .addEventListener(
    "click",
    () =>
      loadCommandCenter(
        false
      )
  );

$("#runCycleButton")
  .addEventListener(
    "click",
    async () => {

      const button =
        $("#runCycleButton");

      const oldText =
        button.textContent;

      button.disabled =
        true;

      button.textContent =
        "جاري التحليل...";

      await loadCommandCenter(
        true
      );

      button.disabled =
        false;

      button.textContent =
        oldText;
    }
  );


/* ============================================================
   MODAL
============================================================ */

function openModal(
  title,
  content
) {
  $("#modalTitle")
    .textContent =
    title;

  $("#modalContent")
    .innerHTML =
    content;

  $("#modal")
    .classList
    .remove(
      "hidden"
    );
}

function closeModal() {
  $("#modal")
    .classList
    .add(
      "hidden"
    );
}

$("#closeModal")
  .addEventListener(
    "click",
    closeModal
  );

$("#modal")
  .addEventListener(
    "click",
    event => {
      if (
        event.target ===
        $("#modal")
      ) {
        closeModal();
      }
    }
  );


/* ============================================================
   CLOCK
============================================================ */

function updateClock() {
  $("#footerTime")
    .textContent =
    new Date()
      .toLocaleString(
        "ar-SA"
      );
}

setInterval(
  updateClock,
  1000
);

updateClock();


/* ============================================================
   AUTO REFRESH
============================================================ */

setInterval(
  () =>
    loadCommandCenter(
      false
    ),
  30000
);


/* ============================================================
   START
============================================================ */

loadCommandCenter(
  false
);
