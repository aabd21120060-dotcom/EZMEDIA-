'use strict';

/*
==========================================================
 EZ MEDIA 11.0
 EXECUTIVE COMMAND CENTER 2.0
 CODE 120 + CODE 121
 Executive Intelligence Frontend
==========================================================

 الوظائف:
 - الاتصال الحقيقي بالـAPI
 - Executive Command
 - AI Executive Intelligence
 - AI Live Analysis
 - Next Move
 - System Matrix
 - Operations Center
 - Human Approvals
 - Automation Control
 - Broadcast Control
 - Scheduler Control
 - Workflow Control
 - Emergency Stop
 - Auto Refresh
 - معالجة أخطاء الاتصال
 - عدم استخدام أرقام وهمية
==========================================================
*/

(() => {
  const CONFIG = {
    platform: 'EZ MEDIA',
    version: '11.0.0',

    executiveApi:
      '/api/executive-command',

    operationsApi:
      '/api/operations',

    refreshInterval:
      10000,

    analysisInterval:
      30000,

    requestTimeout:
      15000
  };

  const state = {
    connected: false,

    loading: false,

    analyzing: false,

    lastDashboard: null,

    lastOperations: null,

    lastAnalysis: null,

    lastError: null,

    refreshTimer: null,

    analysisTimer: null
  };

  /*
  ==========================================================
  أدوات عامة
  ==========================================================
  */

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(
      document.querySelectorAll(selector)
    );
  }

  function text(selector, value) {
    const element = $(selector);

    if (!element) {
      return;
    }

    element.textContent =
      value === null ||
      value === undefined ||
      value === ''
        ? '—'
        : String(value);
  }

  function html(selector, value) {
    const element = $(selector);

    if (!element) {
      return;
    }

    element.innerHTML = value;
  }

  function safeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  function displayNumber(value) {
    const number = safeNumber(value);

    if (number === null) {
      return '—';
    }

    return new Intl.NumberFormat('ar-SA')
      .format(number);
  }

  function displayBoolean(value) {
    if (value === true) {
      return 'يعمل';
    }

    if (value === false) {
      return 'متوقف';
    }

    return 'غير متاح';
  }

  function now() {
    return new Date()
      .toLocaleTimeString(
        'ar-SA',
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      );
  }

  /*
  ==========================================================
  API Request
  ==========================================================
  */

  async function request(
    url,
    options = {}
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        CONFIG.requestTimeout
      );

    try {
      const response =
        await fetch(
          url,
          {
            ...options,

            headers: {
              'Accept':
                'application/json',

              'Content-Type':
                'application/json',

              ...(options.headers || {})
            },

            signal:
              controller.signal
          }
        );

      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      let data;

      if (
        contentType.includes(
          'application/json'
        )
      ) {
        data =
          await response.json();
      } else {
        const raw =
          await response.text();

        data = {
          raw
        };
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
          data?.error ||
          `HTTP ${response.status}`
        );
      }

      return data;

    } finally {
      clearTimeout(timeout);
    }
  }

  /*
  ==========================================================
  الاتصال
  ==========================================================
  */

  function setConnectionStatus(
    connected,
    message
  ) {
    state.connected =
      connected;

    const value =
      message ||
      (
        connected
          ? 'متصل'
          : 'غير متصل'
      );

    const candidates = [
      '#connection-status',
      '#connectionStatus',
      '[data-connection-status]',
      '.connection-status',
      '.connection'
    ];

    for (const selector of candidates) {
      const element = $(selector);

      if (!element) {
        continue;
      }

      element.textContent =
        value;

      element.dataset.status =
        connected
          ? 'online'
          : 'offline';
    }

    updateConnectionLabels(
      connected,
      value
    );
  }

  function updateConnectionLabels(
    connected,
    value
  ) {
    const elements =
      $all(
        '*'
      ).filter(
        element => {
          const content =
            element.textContent
              ?.trim();

          return (
            content ===
              'جار الاتصال...' ||
            content ===
              'الاتصال...' ||
            content ===
              'غير متصل'
          );
        }
      );

    elements.forEach(
      element => {
        if (
          element.children.length === 0
        ) {
          element.textContent =
            value;
        }
      }
    );
  }

  /*
  ==========================================================
  Dashboard
  ==========================================================
  */

  async function loadDashboard() {
    try {
      state.loading =
        true;

      const result =
        await request(
          `${CONFIG.executiveApi}/dashboard`
        );

      const dashboard =
        result?.data ||
        result;

      state.lastDashboard =
        dashboard;

      state.lastError =
        null;

      setConnectionStatus(
        true,
        'متصل'
      );

      renderDashboard(
        dashboard
      );

      return dashboard;

    } catch (error) {
      state.lastError =
        error.message;

      setConnectionStatus(
        false,
        'تعذر الاتصال'
      );

      renderError(
        error
      );

      return null;

    } finally {
      state.loading =
        false;
    }
  }

  /*
  ==========================================================
  Dashboard Rendering
  ==========================================================
  */

  function renderDashboard(
    dashboard
  ) {
    if (!dashboard) {
      return;
    }

    renderExecutive(
      dashboard.executive
    );

    renderAI(
      dashboard.ai
    );

    renderOperations(
      dashboard.operations
    );

    renderApprovals(
      dashboard.approvals
    );

    renderSystems(
      dashboard.systems
    );

    renderBusiness(
      dashboard.business
    );

    renderLastUpdate(
      dashboard
    );

    runExecutiveIntelligence(
      dashboard
    );
  }

  /*
  ==========================================================
  Executive State
  ==========================================================
  */

  function renderExecutive(
    executive = {}
  ) {
    setData(
      [
        'automation',
        'automation-status'
      ],
      displayBoolean(
        executive.automation
      )
    );

    setData(
      [
        'broadcast',
        'broadcast-status'
      ],
      displayBoolean(
        executive.broadcasting
      )
    );

    setData(
      [
        'scheduler',
        'scheduler-status'
      ],
      displayBoolean(
        executive.scheduling
      )
    );

    setData(
      [
        'workflow',
        'workflow-status'
      ],
      displayBoolean(
        executive.workflow
      )
    );

    setStatusClass(
      [
        'automation-status'
      ],
      executive.automation
    );

    setStatusClass(
      [
        'broadcast-status'
      ],
      executive.broadcasting
    );

    setStatusClass(
      [
        'scheduler-status'
      ],
      executive.scheduling
    );

    setStatusClass(
      [
        'workflow-status'
      ],
      executive.workflow
    );
  }

  /*
  ==========================================================
  AI
  ==========================================================
  */

  function renderAI(
    ai = {}
  ) {
    setData(
      [
        'ai-status',
        'ai-enabled',
        'ai-state'
      ],
      ai.enabled
        ? 'يعمل'
        : 'غير متاح'
    );

    setData(
      [
        'ai-agents',
        'agent-count'
      ],
      displayNumber(
        ai.agents
      )
    );

    setData(
      [
        'ai-missions',
        'mission-count'
      ],
      displayNumber(
        ai.missions
      )
    );
  }

  /*
  ==========================================================
  Operations
  ==========================================================
  */

  function renderOperations(
    operations = {}
  ) {
    setData(
      [
        'operations-active',
        'active-operations',
        'active-count'
      ],
      displayNumber(
        operations.active
      )
    );

    setData(
      [
        'operations-pending',
        'pending-operations',
        'pending-count'
      ],
      displayNumber(
        operations.pending
      )
    );

    setData(
      [
        'operations-completed',
        'completed-operations',
        'completed-count'
      ],
      displayNumber(
        operations.completed
      )
    );

    setData(
      [
        'operations-failed',
        'failed-operations',
        'failed-count'
      ],
      displayNumber(
        operations.failed
      )
    );
  }

  /*
  ==========================================================
  Approvals
  ==========================================================
  */

  function renderApprovals(
    approvals = {}
  ) {
    setData(
      [
        'approval-count',
        'pending-approvals',
        'approvals-count'
      ],
      displayNumber(
        approvals.pending
      )
    );
  }

  /*
  ==========================================================
  Systems Matrix
  ==========================================================
  */

  function renderSystems(
    systems = {}
  ) {
    const matrix =
      Object.entries(
        systems
      );

    const container =
      $(
        '#system-matrix'
      ) ||
      $(
        '#systemMatrix'
      ) ||
      $(
        '[data-system-matrix]'
      );

    if (!container) {
      return;
    }

    if (!matrix.length) {
      container.innerHTML =
        `
        <div class="system-empty">
          لا توجد بيانات أنظمة متاحة حاليًا
        </div>
        `;

      return;
    }

    container.innerHTML =
      matrix
        .map(
          ([name, system]) => {
            const available =
              Boolean(
                system?.available
              );

            const status =
              system?.status ||
              'غير متاح';

            return `
              <div
                class="system-card ${
                  available
                    ? 'online'
                    : 'offline'
                }"
                data-system="${escapeHtml(
                  name
                )}"
              >
                <div class="system-card-title">
                  ${escapeHtml(
                    formatSystemName(
                      name
                    )
                  )}
                </div>

                <div class="system-card-status">
                  <span class="system-dot"></span>
                  ${escapeHtml(
                    statusText(
                      status,
                      available
                    )
                  )}
                </div>
              </div>
            `;
          }
        )
        .join('');
  }

  function formatSystemName(
    name
  ) {
    const names = {
      operations:
        'مركز العمليات',
      ai:
        'الذكاء الاصطناعي',
      memory:
        'ذاكرة المنصة',
      knowledge:
        'المعرفة وRAG',
      news:
        'الأخبار',
      content:
        'المحتوى',
      broadcast:
        'البث',
      scheduler:
        'الجدولة',
      advertising:
        'الإعلانات',
      crm:
        'CRM'
    };

    return (
      names[name] ||
      name
    );
  }

  function statusText(
    status,
    available
  ) {
    if (!available) {
      return 'غير متاح';
    }

    const normalized =
      String(status)
        .toLowerCase();

    if (
      normalized ===
        'online' ||
      normalized ===
        'running'
    ) {
      return 'يعمل';
    }

    if (
      normalized ===
        'degraded'
    ) {
      return 'متدهور';
    }

    if (
      normalized ===
        'partial'
    ) {
      return 'جزئي';
    }

    return status;
  }

  /*
  ==========================================================
  Business
  ==========================================================
  */

  function renderBusiness(
    business = {}
  ) {
    /*
     * لا نضع صفرًا أو رقمًا وهميًا.
     * إذا لم تكن البيانات موجودة تظهر "غير متاح".
     */

    setData(
      [
        'audience',
        'audience-count',
        'business-audience'
      ],
      extractBusinessValue(
        business.audience
      )
    );

    setData(
      [
        'advertising',
        'advertising-count',
        'business-advertising'
      ],
      extractBusinessValue(
        business.advertising
      )
    );

    setData(
      [
        'revenue',
        'revenue-count',
        'business-revenue'
      ],
      extractBusinessValue(
        business.revenue
      )
    );

    setData(
      [
        'crm',
        'crm-count',
        'business-crm'
      ],
      extractBusinessValue(
        business.crm
      )
    );
  }

  function extractBusinessValue(
    value
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return 'غير متاح';
    }

    if (
      typeof value ===
        'object'
    ) {
      if (
        value.value !==
        undefined
      ) {
        return value.value;
      }

      if (
        value.count !==
        undefined
      ) {
        return displayNumber(
          value.count
        );
      }

      if (
        value.total !==
        undefined
      ) {
        return displayNumber(
          value.total
        );
      }

      if (
        value.status
      ) {
        return value.status;
      }

      return 'متاح';
    }

    return value;
  }

  /*
  ==========================================================
  AI EXECUTIVE INTELLIGENCE
  ==========================================================
  */

  async function runExecutiveIntelligence(
    dashboard
  ) {
    if (!dashboard) {
      return;
    }

    if (state.analyzing) {
      return;
    }

    state.analyzing =
      true;

    setAIAnalysis(
      'جاري تحليل المنصة...'
    );

    setNextMove(
      'جاري تحديد الخطوة التالية...'
    );

    try {
      const analysis =
        buildLocalExecutiveAnalysis(
          dashboard
        );

      state.lastAnalysis =
        analysis;

      setAIAnalysis(
        analysis.summary
      );

      setNextMove(
        analysis.nextMove
      );

      renderRisk(
        analysis
      );

    } finally {
      state.analyzing =
        false;
    }
  }

  /*
  ==========================================================
  التحليل التنفيذي
  ==========================================================
  */

  function buildLocalExecutiveAnalysis(
    dashboard
  ) {
    const systems =
      dashboard.systems ||
      {};

    const unavailable =
      Object.entries(
        systems
      )
        .filter(
          ([, system]) =>
            !system?.available
        )
        .map(
          ([name]) =>
            formatSystemName(
              name
            )
        );

    const operations =
      dashboard.operations ||
      {};

    const ai =
      dashboard.ai ||
      {};

    const executive =
      dashboard.executive ||
      {};

    let summary =
      'المنصة تعمل، ويتم فحص الأنظمة التنفيذية.';

    let nextMove =
      'مواصلة المراقبة والتحديث التلقائي.';

    let severity =
      'normal';

    if (
      unavailable.length >
      0
    ) {
      severity =
        'warning';

      summary =
        `يوجد ${unavailable.length} نظام يحتاج إلى التحقق: ${unavailable.join('، ')}.`;

      nextMove =
        `ابدأ بفحص: ${unavailable[0]}.`;
    }

    if (
      operations.failed >
      0
    ) {
      severity =
        'critical';

      summary =
        `تم رصد ${displayNumber(
          operations.failed
        )} عملية فاشلة في مركز العمليات.`;

      nextMove =
        'مراجعة العمليات الفاشلة قبل تشغيل مهام جديدة.';
    }

    if (
      operations.pending >
      0
    ) {
      if (
        severity !==
          'critical'
      ) {
        severity =
          'warning';
      }

      nextMove =
        'مراجعة العمليات المعلقة والموافقات البشرية المطلوبة.';
    }

    if (
      ai.enabled ===
        false
    ) {
      severity =
        'warning';

      summary =
        'محرك الذكاء الاصطناعي التنفيذي غير متاح حاليًا.';

      nextMove =
        'التحقق من اتصال محركات AI قبل تشغيل دورة الذكاء.';
    }

    if (
      executive.automation ===
      true
    ) {
      if (
        severity ===
          'normal'
      ) {
        summary =
          'الأتمتة تعمل ومركز القيادة يراقب الحالة التشغيلية للمنصة.';

        nextMove =
          'استمر في المراقبة وراجع العمليات ذات الأولوية.';
      }
    }

    return {
      summary,
      nextMove,
      severity,
      unavailable,
      generatedAt:
        new Date().toISOString()
    };
  }

  /*
  ==========================================================
  AI UI
  ==========================================================
  */

  function setAIAnalysis(
    value
  ) {
    setData(
      [
        'ai-live-analysis',
        'aiAnalysis',
        'live-analysis',
        'analysis-result'
      ],
      value
    );

    const candidates =
      $all(
        '*'
      ).filter(
        element => {
          const content =
            element.textContent
              ?.trim();

          return (
            content ===
              'جاري تحليل المنصة...' ||
            content ===
              'ماذا يحدث الآن؟'
          );
        }
      );

    if (
      candidates.length
    ) {
      const target =
        candidates
          .find(
            element =>
              element.children.length ===
              0
          );

      if (target) {
        target.textContent =
          value;
      }
    }
  }

  function setNextMove(
    value
  ) {
    setData(
      [
        'next-move',
        'nextMove',
        'ai-next-move'
      ],
      value
    );
  }

  function renderRisk(
    analysis
  ) {
    setData(
      [
        'ai-risk',
        'risk-level',
        'system-risk'
      ],
      riskText(
        analysis.severity
      )
    );

    const elements =
      [
        'ai-risk',
        'risk-level',
        'system-risk'
      ];

    elements.forEach(
      id => {
        const element =
          document.getElementById(
            id
          );

        if (!element) {
          return;
        }

        element.dataset.risk =
          analysis.severity;
      }
    );
  }

  function riskText(
    severity
  ) {
    switch (
      severity
    ) {
      case 'critical':
        return 'حرج';

      case 'warning':
        return 'يحتاج متابعة';

      default:
        return 'طبيعي';
    }
  }

  /*
  ==========================================================
  Control Center
  ==========================================================
  */

  async function controlOperation(
    action
  ) {
    const endpoints = {
      startAutomation:
        '/start',

      stopAutomation:
        '/stop',

      emergencyStop:
        '/stop'
    };

    const endpoint =
      endpoints[action];

    if (!endpoint) {
      return;
    }

    try {
      setConnectionStatus(
        true,
        'تنفيذ العملية...'
      );

      await request(
        `${CONFIG.operationsApi}${endpoint}`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              source:
                'executive-command-center',

              action,

              timestamp:
                new Date().toISOString()
            })
        }
      );

      await loadDashboard();

    } catch (error) {
      showNotification(
        `تعذر تنفيذ العملية: ${error.message}`,
        'error'
      );
    }
  }

  async function emergencyStop() {
    const confirmed =
      window.confirm(
        'هل تريد تنفيذ الإيقاف الطارئ؟'
      );

    if (!confirmed) {
      return;
    }

    await controlOperation(
      'emergencyStop'
    );
  }

  /*
  ==========================================================
  Buttons
  ==========================================================
  */

  function bindButtons() {
    bindAction(
      [
        '#refresh',
        '#refreshButton',
        '[data-action="refresh"]'
      ],
      loadDashboard
    );

    bindAction(
      [
        '#analysis',
        '#analysisButton',
        '[data-action="analysis"]',
        '[data-action="run-analysis"]'
      ],
      async () => {
        const dashboard =
          state.lastDashboard ||
          await loadDashboard();

        if (
          dashboard
        ) {
          await runExecutiveIntelligence(
            dashboard
          );
        }
      }
    );

    bindAction(
      [
        '#start-automation',
        '[data-action="start-automation"]'
      ],
      () =>
        controlOperation(
          'startAutomation'
        )
    );

    bindAction(
      [
        '#stop-automation',
        '[data-action="stop-automation"]'
      ],
      () =>
        controlOperation(
          'stopAutomation'
        )
    );

    bindAction(
      [
        '#emergency-stop',
        '[data-action="emergency-stop"]'
      ],
      emergencyStop
    );

    bindAction(
      [
        '#start-analysis',
        '[data-action="start-ai"]'
      ],
      async () => {
        const dashboard =
          state.lastDashboard ||
          await loadDashboard();

        if (
          dashboard
        ) {
          await runExecutiveIntelligence(
            dashboard
          );
        }
      }
    );
  }

  function bindAction(
    selectors,
    handler
  ) {
    selectors.forEach(
      selector => {
        $all(
          selector
        ).forEach(
          element => {
            if (
              element.dataset
                .ezMediaBound ===
              'true'
            ) {
              return;
            }

            element.addEventListener(
              'click',
              async event => {
                event.preventDefault();

                try {
                  await handler(
                    event
                  );
                } catch (
                  error
                ) {
                  console.error(
                    '[EZ MEDIA]',
                    error
                  );
                }
              }
            );

            element.dataset
              .ezMediaBound =
              'true';
          }
        );
      }
    );
  }

  /*
  ==========================================================
  تحديث تلقائي
  ==========================================================
  */

  function startAutoRefresh() {
    stopAutoRefresh();

    state.refreshTimer =
      setInterval(
        () => {
          loadDashboard();
        },
        CONFIG.refreshInterval
      );

    state.analysisTimer =
      setInterval(
        () => {
          if (
            state.lastDashboard
          ) {
            runExecutiveIntelligence(
              state.lastDashboard
            );
          }
        },
        CONFIG.analysisInterval
      );
  }

  function stopAutoRefresh() {
    if (
      state.refreshTimer
    ) {
      clearInterval(
        state.refreshTimer
      );

      state.refreshTimer =
        null;
    }

    if (
      state.analysisTimer
    ) {
      clearInterval(
        state.analysisTimer
      );

      state.analysisTimer =
        null;
    }
  }

  /*
  ==========================================================
  Last Update
  ==========================================================
  */

  function renderLastUpdate(
    dashboard
  ) {
    const value =
      dashboard.lastRefresh ||
      dashboard.timestamp ||
      new Date().toISOString();

    setData(
      [
        'last-update',
        'lastRefresh',
        'updated-at'
      ],
      formatDate(
        value
      )
    );
  }

  function formatDate(
    value
  ) {
    try {
      return new Date(
        value
      ).toLocaleString(
        'ar-SA'
      );
    } catch {
      return '—';
    }
  }

  /*
  ==========================================================
  Error
  ==========================================================
  */

  function renderError(
    error
  ) {
    console.error(
      '[EZ MEDIA Executive Command]',
      error
    );

    setAIAnalysis(
      `تعذر الحصول على بيانات المنصة: ${error.message}`
    );

    setNextMove(
      'تحقق من اتصال API ثم أعد التحديث.'
    );
  }

  /*
  ==========================================================
  Notification
  ==========================================================
  */

  function showNotification(
    message,
    type = 'info'
  ) {
    let container =
      $(
        '#ez-notifications'
      );

    if (!container) {
      container =
        document.createElement(
          'div'
        );

      container.id =
        'ez-notifications';

      container.style.position =
        'fixed';

      container.style.top =
        '20px';

      container.style.right =
        '20px';

      container.style.zIndex =
        '99999';

      container.style.display =
        'flex';

      container.style.flexDirection =
        'column';

      container.style.gap =
        '10px';

      document.body.appendChild(
        container
      );
    }

    const notification =
      document.createElement(
        'div'
      );

    notification.textContent =
      message;

    notification.dataset.type =
      type;

    notification.style.padding =
      '12px 16px';

    notification.style.borderRadius =
      '14px';

    notification.style.background =
      'rgba(255,255,255,.96)';

    notification.style.boxShadow =
      '0 8px 30px rgba(0,0,0,.12)';

    notification.style.direction =
      'rtl';

    notification.style.fontFamily =
      'inherit';

    container.appendChild(
      notification
    );

    setTimeout(
      () => {
        notification.remove();
      },
      5000
    );
  }

  /*
  ==========================================================
  Generic Data Binding
  ==========================================================
  */

  function setData(
    names,
    value
  ) {
    names.forEach(
      name => {
        const selectors = [
          `#${name}`,
          `[data-bind="${name}"]`,
          `[data-value="${name}"]`
        ];

        selectors.forEach(
          selector => {
            $all(
              selector
            ).forEach(
              element => {
                element.textContent =
                  value ===
                    null ||
                  value ===
                    undefined ||
                  value ===
                    ''
                    ? '—'
                    : String(
                        value
                      );
              }
            );
          }
        );
      }
    );
  }

  function setStatusClass(
    names,
    value
  ) {
    names.forEach(
      name => {
        const selectors = [
          `#${name}`,
          `[data-bind="${name}"]`
        ];

        selectors.forEach(
          selector => {
            $all(
              selector
            ).forEach(
              element => {
                element.classList.toggle(
                  'status-online',
                  value === true
                );

                element.classList.toggle(
                  'status-offline',
                  value === false
                );
              }
            );
          }
        );
      }
    );
  }

  /*
  ==========================================================
  Escape HTML
  ==========================================================
  */

  function escapeHtml(
    value
  ) {
    return String(
      value ?? ''
    )
      .replaceAll(
        '&',
        '&amp;'
      )
      .replaceAll(
        '<',
        '&lt;'
      )
      .replaceAll(
        '>',
        '&gt;'
      )
      .replaceAll(
        '"',
        '&quot;'
      )
      .replaceAll(
        "'",
        '&#039;'
      );
  }

  /*
  ==========================================================
  Service Worker
  ==========================================================
  */

  function registerServiceWorker() {
    if (
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    navigator.serviceWorker
      .register(
        '/autonomous-media-operations/service-worker.js'
      )
      .catch(
        error => {
          console.warn(
            '[EZ MEDIA] Service Worker:',
            error.message
          );
        }
      );
  }

  /*
  ==========================================================
  Visibility
  ==========================================================
  */

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.hidden
      ) {
        return;
      }

      loadDashboard();
    }
  );

  /*
  ==========================================================
  Startup
  ==========================================================
  */

  async function boot() {
    console.log(
      '=========================================='
    );

    console.log(
      'EZ MEDIA 11.0'
    );

    console.log(
      'Executive Command Center 2.0'
    );

    console.log(
      'CODE 120 + CODE 121'
    );

    console.log(
      '=========================================='
    );

    bindButtons();

    registerServiceWorker();

    setConnectionStatus(
      false,
      'جار الاتصال...'
    );

    setAIAnalysis(
      'جاري الاتصال بمحرك الذكاء التنفيذي...'
    );

    setNextMove(
      'بانتظار بيانات المنصة...'
    );

    await loadDashboard();

    startAutoRefresh();
  }

  /*
  ==========================================================
  Global API
  ==========================================================
  */

  window.EZ_MEDIA_EXECUTIVE =
    {
      state,

      refresh:
        loadDashboard,

      analyze:
        () => {
          if (
            state.lastDashboard
          ) {
            return runExecutiveIntelligence(
              state.lastDashboard
            );
          }

          return loadDashboard();
        },

      emergencyStop,

      controlOperation,

      getState:
        () => ({
          ...state
        })
    };

  /*
  ==========================================================
  Start
  ==========================================================
  */

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      {
        once: true
      }
    );
  } else {
    boot();
  }

})();
