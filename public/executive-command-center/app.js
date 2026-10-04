"use strict";

/* ============================================================
   EZ MEDIA 11.0
   CODE 103
   EXECUTIVE COMMAND CENTER 2.0
============================================================ */

const API = {

  executive:
    "/api/executive",

  command:
    "/api/command",

  analytics:
    "/api/analytics",

  live:
    "/api/live",

  newsroom:
    "/api/editorial/newsroom",

  audience:
    "/api/audience",

  advertising:
    "/api/advertising",

  monetization:
    "/api/monetization",

  crm:
    "/api/crm"
};


const state = {

  snapshot:
    null,

  dashboard:
    null,

  decisions:
    [],

  alerts:
    [],

  plans:
    [],

  loading:
    false,

  pendingCommand:
    null

};


/* ============================================================
   HELPERS
============================================================ */

function $(selector) {

  return document.querySelector(
    selector
  );

}


function $all(selector) {

  return [
    ...document.querySelectorAll(
      selector
    )
  ];

}


function number(value) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;

}


function formatNumber(value) {

  return new Intl.NumberFormat(
    "ar-SA"
  ).format(
    number(value)
  );

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


function date(value) {

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


async function get(
  url
) {

  const response =
    await fetch(
      url,
      {
        credentials:
          "same-origin"
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {

    throw new Error(
      data.error ||
      `HTTP ${response.status}`
    );

  }

  return data;

}


/*
 * العمليات الحساسة تحتاج مفتاح
 * PLATFORM_ADMIN_KEY.
 *
 * لا يتم تخزينه في المتصفح.
 *
 * عند تفعيل CODE 82 بالكامل،
 * يتم استبدال هذه الآلية
 * بجلسة RBAC آمنة.
 */
async function post(
  url,
  body = {}
) {

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        credentials:
          "same-origin",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            body
          )
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {

    throw new Error(
      data.error ||
      `HTTP ${response.status}`
    );

  }

  return data;

}


/* ============================================================
   SYSTEM STATUS
============================================================ */

function renderSystemState(
  status
) {

  const dot =
    $("#systemDot");

  const text =
    $("#systemState");

  dot.className =
    "system-dot";

  const current =
    String(
      status ||
      ""
    ).toLowerCase();

  if (
    current ===
      "excellent" ||
    current ===
      "healthy" ||
    current ===
      "online"
  ) {

    dot.classList.add(
      "ok"
    );

    text.textContent =
      "النظام مستقر";

  } else if (
    current ===
      "degraded"
  ) {

    dot.classList.add(
      "ok"
    );

    text.textContent =
      "النظام يحتاج متابعة";

  } else {

    dot.classList.add(
      "error"
    );

    text.textContent =
      "النظام يحتاج مراجعة";

  }

}


/* ============================================================
   SCORE
============================================================ */

function renderScore(
  element,
  progress,
  value
) {

  const score =
    Math.max(
      0,
      Math.min(
        100,
        number(value)
      )
    );

  $(`#${element}`)
    .textContent =
    `${Math.round(score)}%`;

  $(`#${progress}`)
    .style.width =
    `${score}%`;

}


function renderScores(
  snapshot
) {

  const scores =
    snapshot?.scores ||
    {};

  renderScore(
    "healthScore",
    "healthProgress",
    scores.healthScore
  );

  renderScore(
    "editorialScore",
    "editorialProgress",
    scores.editorialScore
  );

  renderScore(
    "audienceScore",
    "audienceProgress",
    scores.audienceScore
  );

  renderScore(
    "revenueScore",
    "revenueProgress",
    scores.revenueScore
  );

  renderScore(
    "businessScore",
    "businessProgress",
    scores.businessScore
  );

  renderScore(
    "riskScore",
    "riskProgress",
    scores.riskScore
  );


  const overall =
    Math.round(
      (
        number(
          scores.healthScore
        ) +

        number(
          scores.editorialScore
        ) +

        number(
          scores.audienceScore
        ) +

        number(
          scores.businessScore
        )
      ) / 4
    );


  $("#overallScore")
    .textContent =
    `${overall}%`;

  $("#overallStatus")
    .textContent =
    snapshot?.status ||
    "—";

}


/* ============================================================
   EXECUTIVE ANALYSIS
============================================================ */

function renderAnalysis(
  snapshot
) {

  $("#liveAnalysis")
    .textContent =
    snapshot?.summary ||
    snapshot?.executiveSummary ||
    "لا توجد خلاصة تنفيذية حالية.";

}


/* ============================================================
   NEXT MOVE
============================================================ */

function renderNextMove(
  result
) {

  const actions =
    result?.nextActions ||
    [];

  if (
    !actions.length
  ) {

    $("#nextMove")
      .textContent =
      "لا توجد أولوية عاجلة حاليًا.";

    return;

  }

  const first =
    actions[0];

  $("#nextMove")
    .textContent =
    first.action ||
    first.title ||
    "مراجعة لوحة القيادة.";

}


/* ============================================================
   PRIORITIES
============================================================ */

function renderPriorities() {

  const container =
    $("#priorities");

  const items =
    state.decisions
      .slice()
      .sort(
        (a, b) =>
          number(
            b.confidence ||
            b.score
          ) -
          number(
            a.confidence ||
            a.score
          )
      )
      .slice(
        0,
        5
      );


  if (
    !items.length
  ) {

    container.innerHTML =
      `<div class="empty">
        لا توجد أولويات حاليًا.
      </div>`;

    return;

  }


  container.innerHTML =
    items
      .map(
        (
          item,
          index
        ) => `

          <div class="priority-item">

            <div class="priority-number">
              ${index + 1}
            </div>

            <div>

              <strong>
                ${escapeHtml(
                  item.title ||
                  item.name ||
                  "أولوية تنفيذية"
                )}
              </strong>

              <p>
                ${escapeHtml(
                  item.action ||
                  item.description ||
                  "مراجعة هذا البند."
                )}
              </p>

            </div>

          </div>

        `
      )
      .join("");

}


/* ============================================================
   ACTION PLAN
============================================================ */

function renderActionPlan() {

  const container =
    $("#actionPlan");

  const plan =
    state.plans[0];

  const actions =
    plan?.actions ||
    [];

  if (
    !actions.length
  ) {

    container.innerHTML =
      `<div class="empty">
        لا توجد خطة تنفيذية حاليًا.
      </div>`;

    return;

  }


  container.innerHTML =
    actions
      .slice(
        0,
        8
      )
      .map(
        (
          action,
          index
        ) => `

          <div class="priority-item">

            <div class="priority-number">
              ${index + 1}
            </div>

            <div>

              <strong>
                ${escapeHtml(
                  action.priority ||
                  `المرحلة ${index + 1}`
                )}
              </strong>

              <p>
                ${escapeHtml(
                  action.action ||
                  action.title ||
                  "تنفيذ الإجراء."
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

  $("#decisionCounter")
    .textContent =
    formatNumber(
      state.decisions.length
    );


  if (
    !state.decisions.length
  ) {

    container.innerHTML =
      `<div class="empty">
        لا توجد قرارات جديدة.
      </div>`;

    return;

  }


  container.innerHTML =
    state.decisions
      .slice(
        0,
        12
      )
      .map(
        item => `

          <article class="decision">

            <div class="decision-meta">

              <span>
                ${escapeHtml(
                  item.priority ||
                  "medium"
                )}
              </span>

              <span>
                ${number(
                  item.confidence
                )}%
              </span>

            </div>

            <h3>
              ${escapeHtml(
                item.title ||
                "قرار تنفيذي"
              )}
            </h3>

            <p>
              ${escapeHtml(
                item.action ||
                item.description ||
                "لا يوجد وصف."
              )}
            </p>

          </article>

        `
      )
      .join("");

}


/* ============================================================
   APPROVAL CENTER
============================================================ */

function renderApprovals() {

  const container =
    $("#approvalCenter");

  const approvals =
    state.decisions
      .filter(
        item =>
          item.requiresApproval ===
            true ||
          item.humanReview ===
            true ||
          item.status ===
            "human_review"
      )
      .slice(
        0,
        10
      );


  if (
    !approvals.length
  ) {

    container.innerHTML =
      `<div class="empty">
        لا توجد قرارات تحتاج موافقتك.
      </div>`;

    return;

  }


  container.innerHTML =
    approvals
      .map(
        item => `

          <div class="approval">

            <div class="approval-text">

              <strong>
                ${escapeHtml(
                  item.title ||
                  "قرار يحتاج مراجعة"
                )}
              </strong>

              <p>
                ${escapeHtml(
                  item.action ||
                  item.description ||
                  "يتطلب مراجعة بشرية."
                )}
              </p>

            </div>

            <div class="approval-actions">

              <button
                class="small-btn approve"
                data-approval="approve"
                data-id="${escapeHtml(
                  item.id ||
                  ""
                )}"
              >
                موافقة
              </button>

              <button
                class="small-btn reject"
                data-approval="reject"
                data-id="${escapeHtml(
                  item.id ||
                  ""
                )}"
              >
                رفض
              </button>

              <button
                class="small-btn review"
                data-approval="review"
                data-id="${escapeHtml(
                  item.id ||
                  ""
                )}"
              >
                مراجعة
              </button>

            </div>

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

  $("#alertCounter")
    .textContent =
    formatNumber(
      state.alerts.length
    );


  if (
    !state.alerts.length
  ) {

    container.innerHTML =
      `<div class="empty">
        لا توجد تنبيهات.
      </div>`;

    return;

  }


  container.innerHTML =
    state.alerts
      .slice(
        0,
        15
      )
      .map(
        item => `

          <div
            class="alert ${escapeHtml(
              item.severity ||
              "medium"
            )}"
          >

            <strong>
              ${escapeHtml(
                item.title ||
                "تنبيه"
              )}
            </strong>

            <p>
              ${escapeHtml(
                item.message ||
                item.description ||
                ""
              )}
            </p>

          </div>

        `
      )
      .join("");

}


/* ============================================================
   SYSTEM MATRIX
============================================================ */

function renderSystemMatrix(
  dashboard
) {

  const container =
    $("#systemMatrix");

  const systems =
    dashboard?.systems ||
    {};


  const names = {

    commandEngine:
      "العقل التنفيذي",

    platformControl:
      "تحكم المنصة",

    analyticsEngine:
      "التحليلات",

    automationEngine:
      "الأتمتة",

    liveBroadcastEngine:
      "البث المباشر",

    broadcastScheduler:
      "جدولة البث",

    editorialNewsroom:
      "غرفة الأخبار",

    contentAssignment:
      "توزيع المهام",

    workforceEngine:
      "الفريق",

    trainingEngine:
      "التدريب",

    advertisingEngine:
      "الإعلانات والرعاية",

    monetizationEngine:
      "الإيرادات",

    crmEngine:
      "CRM",

    contentFactory:
      "مصنع المحتوى",

    distributionEngine:
      "التوزيع",

    workflowEngine:
      "Workflow",

    securityEngine:
      "الأمن",

    communicationEngine:
      "التواصل",

    customerSupportEngine:
      "خدمة العملاء",

    aiOrchestrator:
      "AI Orchestrator"

  };


  const entries =
    Object.entries(
      names
    );


  container.innerHTML =
    entries
      .map(
        ([
          key,
          name
        ]) => {

          const system =
            systems[key];

          const available =
            system?.available ===
              true;

          const error =
            !!system?.status?.error;


          return `

            <div class="system-item">

              <span>
                ${escapeHtml(
                  name
                )}
              </span>

              <span
                class="system-state ${
                  available &&
                  !error
                    ? "ok"
                    : error
                      ? "error"
                      : ""
                }"
              ></span>

            </div>

          `;

        }
      )
      .join("");

}


/* ============================================================
   LIVE PANEL
============================================================ */

async function loadLive() {

  try {

    const data =
      await get(
        `${API.live}/status`
      );

    const status =
      data.status ||
      {};

    $("#livePanel")
      .innerHTML = `

        <div class="status-row">

          <span>
            الخدمة
          </span>

          <strong>
            ${escapeHtml(
              status.service ||
              "EZ MEDIA LIVE"
            )}
          </strong>

        </div>

        <div class="status-row">

          <span>
            الحالة
          </span>

          <strong>
            ${status.running
              ? "يعمل"
              : "جاهز"}
          </strong>

        </div>

      `;

  } catch {

    $("#livePanel")
      .innerHTML =
      `<div class="empty">
        تعذر قراءة خدمة البث.
      </div>`;

  }

}


/* ============================================================
   NEWSROOM
============================================================ */

async function loadNewsroom() {

  try {

    const data =
      await get(
        `${API.newsroom}/statistics`
      );

    const stats =
      data.statistics ||
      {};

    $("#newsroomPanel")
      .innerHTML = `

        <div class="status-row">

          <span>
            القصص
          </span>

          <strong>
            ${formatNumber(
              stats.totalStories ||
              stats.stories ||
              0
            )}
          </strong>

        </div>

        <div class="status-row">

          <span>
            قيد المراجعة
          </span>

          <strong>
            ${formatNumber(
              stats.pendingReview ||
              0
            )}
          </strong>

        </div>

      `;

  } catch {

    $("#newsroomPanel")
      .innerHTML =
      `<div class="empty">
        تعذر قراءة غرفة الأخبار.
      </div>`;

  }

}


/* ============================================================
   BUSINESS METRICS
============================================================ */

async function loadBusinessMetrics() {

  const requests = [

    [
      "audienceMetric",
      `${API.audience}/statistics`,
      [
        "totalEvents",
        "totalVisitors",
        "events"
      ]
    ],

    [
      "advertisingMetric",
      `${API.advertising}/statistics`,
      [
        "totalCampaigns",
        "campaigns"
      ]
    ],

    [
      "revenueMetric",
      `${API.monetization}/statistics`,
      [
        "totalRevenue",
        "revenue"
      ]
    ],

    [
      "crmMetric",
      `${API.crm}/statistics`,
      [
        "totalLeads",
        "leads"
      ]
    ]

  ];


  await Promise.all(
    requests.map(
      async ([
        element,
        url,
        keys
      ]) => {

        try {

          const data =
            await get(url);

          const stats =
            data.statistics ||
            {};

          let value = 0;

          for (
            const key of keys
          ) {

            if (
              stats[key] !==
              undefined
            ) {

              value =
                stats[key];

              break;

            }

          }

          $(`#${element}`)
            .textContent =
            formatNumber(
              value
            );

        } catch {

          $(`#${element}`)
            .textContent =
            "—";

        }

      }
    )
  );

}


/* ============================================================
   COMMAND CENTER LOAD
============================================================ */

async function loadDashboard() {

  if (
    state.loading
  ) {
    return;
  }

  state.loading =
    true;


  try {

    const dashboard =
      await get(
        `${API.executive}/dashboard`
      );

    state.dashboard =
      dashboard;


    const snapshotResponse =
      await get(
        `${API.command}/snapshot`
      );

    state.snapshot =
      snapshotResponse.snapshot ||
      {};


    const decisionsResponse =
      await get(
        `${API.command}/decisions`
      );

    state.decisions =
      decisionsResponse.decisions ||
      [];


    const alertsResponse =
      await get(
        `${API.command}/alerts`
      );

    state.alerts =
      alertsResponse.alerts ||
      [];


    const plansResponse =
      await get(
        `${API.command}/plans`
      );

    state.plans =
      plansResponse.plans ||
      [];


    renderSystemState(
      state.snapshot.status
    );

    renderScores(
      state.snapshot
    );

    renderAnalysis(
      state.snapshot
    );

    renderPriorities();

    renderActionPlan();

    renderDecisions();

    renderApprovals();

    renderAlerts();

    renderSystemMatrix(
      dashboard
    );


    await Promise.all([
      loadLive(),
      loadNewsroom(),
      loadBusinessMetrics()
    ]);


  } catch (error) {

    console.error(
      "[CODE 103]",
      error
    );

    $("#systemDot")
      .className =
      "system-dot error";

    $("#systemState")
      .textContent =
      "تعذر الاتصال بمركز القيادة";

  } finally {

    state.loading =
      false;

  }

}


/* ============================================================
   RUN EXECUTIVE CYCLE
============================================================ */

async function runExecutiveCycle() {

  try {

    $("#runBtn")
      .disabled =
      true;

    $("#runBtn")
      .textContent =
      "جاري التحليل...";


    /*
     * العملية الحساسة تمر من
     * CODE 102.
     *
     * المصادقة النهائية ستكون
     * عبر CODE 82.
     */

    await post(
      `${API.executive}/run`,
      {}
    );


    await loadDashboard();


  } catch (error) {

    showModal(
      "تعذر التشغيل",
      error.message
    );

  } finally {

    $("#runBtn")
      .disabled =
      false;

    $("#runBtn")
      .textContent =
      "تشغيل التحليل";

  }

}


/* ============================================================
   GENERIC CONTROL
============================================================ */

const commandMap = {

  START_AUTOMATION:
    "/automation/start",

  STOP_AUTOMATION:
    "/automation/stop",

  START_LIVE:
    "/live/start",

  STOP_LIVE:
    "/live/stop",

  START_SCHEDULER:
    "/scheduler/start",

  STOP_SCHEDULER:
    "/scheduler/stop",

  START_WORKFLOW:
    "/workflow/start",

  STOP_WORKFLOW:
    "/workflow/stop"

};


async function executeControl(
  command
) {

  const path =
    commandMap[
      command
    ];

  if (!path) {
    return;
  }


  try {

    await post(
      `${API.executive}${path}`,
      {}
    );


    await loadDashboard();


  } catch (error) {

    showModal(
      "تعذر تنفيذ الأمر",
      error.message
    );

  }

}


/* ============================================================
   MODAL
============================================================ */

let modalAction =
  null;


function showModal(
  title,
  message,
  action = null
) {

  $("#modalTitle")
    .textContent =
    title;

  $("#modalMessage")
    .textContent =
    message;

  modalAction =
    action;

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

  modalAction =
    null;

}


$("#modalClose")
  .addEventListener(
    "click",
    closeModal
  );


$("#modalCancel")
  .addEventListener(
    "click",
    closeModal
  );


$("#modalConfirm")
  .addEventListener(
    "click",
    async () => {

      if (
        typeof modalAction ===
        "function"
      ) {

        await modalAction();

      }

      closeModal();

    }
  );


/* ============================================================
   EMERGENCY STOP
============================================================ */

async function emergencyStop() {

  try {

    await post(
      `${API.executive}/emergency-stop`,
      {}
    );


    await loadDashboard();


  } catch (error) {

    showModal(
      "فشل الإيقاف الطارئ",
      error.message
    );

  }

}


/* ============================================================
   EVENTS
============================================================ */

$("#refreshBtn")
  .addEventListener(
    "click",
    loadDashboard
  );


$("#runBtn")
  .addEventListener(
    "click",
    runExecutiveCycle
  );


$("#heroRun")
  .addEventListener(
    "click",
    runExecutiveCycle
  );


$("#heroEmergency")
  .addEventListener(
    "click",
    () => {

      showModal(

        "إيقاف طارئ",

        "سيتم إيقاف الخدمات الداخلية القابلة للإيقاف من مركز القيادة. هل تريد المتابعة؟",

        emergencyStop

      );

    }
  );


$all(
  "[data-command]"
)
.forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        const command =
          button.dataset.command;

        const dangerous =
          command.includes(
            "STOP"
          );

        if (
          dangerous
        ) {

          showModal(

            "تأكيد العملية",

            "هذا الأمر سيؤثر على خدمة تشغيلية في المنصة. هل تريد المتابعة؟",

            () =>
              executeControl(
                command
              )

          );

        } else {

          executeControl(
            command
          );

        }

      }
    );

  }
);


/* ============================================================
   APPROVAL ACTIONS
============================================================ */

document.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        "[data-approval]"
      );

    if (!button) {
      return;
    }


    const action =
      button.dataset.approval;

    const id =
      button.dataset.id;


    /*
     * CODE 100/102 يمكنه لاحقًا
     * ربط هذه العملية بواجهات
     * الموافقة الفعلية لكل محرك.
     *
     * لا ننفذ قرارًا تحريريًا
     * حساسًا هنا بشكل أعمى.
     */

    showModal(

      "قرار يحتاج ربطًا بالمحرك",

      `تم تحديد القرار ${id || "غير معروف"} بإجراء: ${action}. سيتم ربط الموافقة النهائية بمحرك القرار المختص في طبقة CODE 82/100.`

    );

  }
);


/* ============================================================
   CLOCK
============================================================ */

function updateClock() {

  $("#clock")
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
  loadDashboard,
  30000
);


/* ============================================================
   START
============================================================ */

loadDashboard();
