"use strict";

(function () {
  const VERSION = "11.0.0";
  const STORAGE_KEY = "ez_media_automation_v11";

  const STEP_DEFINITIONS = [
    {
      id: "collect",
      name: "جمع المحتوى",
      description: "استقبال المادة من المصادر والموصلات."
    },
    {
      id: "classify",
      name: "التصنيف الذكي",
      description: "تحديد نوع المادة وموضوعها وأولويتها."
    },
    {
      id: "analyze",
      name: "تحليل الذكاء الاصطناعي",
      description: "تحليل العنوان والملخص والكلمات المفتاحية والمخاطر."
    },
    {
      id: "verify",
      name: "التحقق",
      description: "فحص الادعاءات والمصادر والمخاطر التحريرية."
    },
    {
      id: "review",
      name: "المراجعة التحريرية",
      description: "إرسال المادة إلى غرفة الأخبار للمراجعة."
    },
    {
      id: "publish",
      name: "النشر",
      description: "نشر المادة داخل EZ MEDIA."
    },
    {
      id: "distribute",
      name: "التوزيع",
      description: "تجهيز المادة للمنصات والقنوات المرتبطة."
    },
    {
      id: "measure",
      name: "القياس",
      description: "قياس الأداء وإعادة تغذية محرك الذكاء."
    }
  ];

  const state = {
    workflows: [],
    selected: null,
    search: "",
    status: "all",
    loading: false,
    lastUpdate: null,
    editing: false
  };

  const STATUS = {
    active: "نشط",
    paused: "متوقف",
    draft: "مسودة",
    error: "خطأ"
  };

  const RUN_STATUS = {
    running: "قيد التنفيذ",
    completed: "مكتمل",
    waiting: "بانتظار إجراء",
    failed: "فشل",
    cancelled: "ملغى"
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

  function uid(prefix) {
    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }

  function now() {
    return new Date().toISOString();
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "ar-SA",
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      ).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function loadWorkflows() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) {
        return [];
      }

      const data =
        JSON.parse(raw);

      return Array.isArray(data)
        ? data
        : [];
    } catch (error) {
      console.error(
        "EZ MEDIA Automation load error:",
        error
      );

      return [];
    }
  }

  function saveWorkflows() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state.workflows
        )
      );
    } catch (error) {
      console.error(
        "EZ MEDIA Automation save error:",
        error
      );
    }
  }

  function defaultSteps() {
    return STEP_DEFINITIONS.map(
      (step, index) => ({
        ...step,
        enabled: true,
        order: index + 1
      })
    );
  }

  function seed() {
    const existing =
      loadWorkflows();

    if (existing.length) {
      state.workflows =
        existing;

      return;
    }

    state.workflows = [
      {
        id: uid("workflow"),
        name:
          "المسار الإعلامي الرئيسي",
        description:
          "المسار الأساسي لمعالجة المحتوى من المصدر حتى القياس.",
        status: "active",
        trigger:
          "مصدر جديد",
        frequency:
          "عند وصول مادة جديدة",
        steps:
          defaultSteps(),
        runs: 0,
        successfulRuns: 0,
        failedRuns: 0,
        lastRun: null,
        lastError: null,
        createdAt: now(),
        updatedAt: now()
      }
    ];

    saveWorkflows();
  }

  function metrics() {
    const workflows =
      state.workflows;

    return {
      total:
        workflows.length,

      active:
        workflows.filter(
          item =>
            item.status ===
            "active"
        ).length,

      running:
        workflows.filter(
          item =>
            item.lastRun &&
            item.lastRun.status ===
              "running"
        ).length,

      errors:
        workflows.filter(
          item =>
            item.status ===
              "error" ||
            item.failedRuns > 0
        ).length
    };
  }

  function filteredWorkflows() {
    return state.workflows.filter(
      workflow => {

        if (
          state.status !==
            "all" &&
          workflow.status !==
            state.status
        ) {
          return false;
        }

        if (
          !state.search
        ) {
          return true;
        }

        const text =
          [
            workflow.name,
            workflow.description,
            workflow.trigger,
            workflow.frequency
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return text.includes(
          state.search.toLowerCase()
        );
      }
    );
  }

  function render() {
    injectStyles();

    const mount =
      getMount();

    if (!mount) {
      return;
    }

    const m =
      metrics();

    const workflows =
      filteredWorkflows();

    mount.innerHTML = `
      <div
        class="ez-automation"
      >

        <header
          class="ez-automation-header"
        >

          <div>

            <span
              class="ez-automation-kicker"
            >
              EZ MEDIA AUTOMATION ENGINE
            </span>

            <h2>
              مركز الأتمتة الإعلامية
            </h2>

            <p>
              محرك مركزي لبناء ومراقبة مسارات العمل الإعلامية من وصول المادة حتى النشر والتوزيع والقياس.
            </p>

          </div>

          <div
            class="ez-automation-actions"
          >

            <button
              class="ez-auto-btn primary"
              data-auto-add
            >
              إنشاء مسار
            </button>

            <button
              class="ez-auto-btn"
              data-auto-refresh
            >
              تحديث
            </button>

          </div>

        </header>

        <section
          class="ez-auto-metrics"
        >

          ${metric(
            "إجمالي المسارات",
            m.total
          )}

          ${metric(
            "مسارات نشطة",
            m.active
          )}

          ${metric(
            "قيد التنفيذ",
            m.running
          )}

          ${metric(
            "تنبيهات",
            m.errors
          )}

        </section>

        <section
          class="ez-auto-panel"
        >

          <div
            class="ez-auto-toolbar"
          >

            <input
              id="ez-auto-search"
              type="search"
              placeholder="ابحث عن مسار..."
              value="${escapeHtml(
                state.search
              )}"
            />

            <select
              id="ez-auto-status"
            >

              <option
                value="all"
              >
                كل الحالات
              </option>

              ${Object.entries(
                STATUS
              )
                .map(
                  ([key, label]) =>
                    `
                      <option
                        value="${key}"
                        ${
                          state.status ===
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

          </div>

          <div
            class="ez-auto-list"
          >

            ${
              workflows.length
                ? workflows
                    .map(
                      renderWorkflow
                    )
                    .join("")
                : `
                  <div
                    class="ez-auto-empty"
                  >
                    لا توجد مسارات مطابقة.
                  </div>
                `
            }

          </div>

        </section>

        ${
          state.editing
            ? renderEditor()
            : ""
        }

        ${
          state.selected &&
          !state.editing
            ? renderDetails()
            : ""
        }

        <footer
          class="ez-auto-footer"
        >
          EZ MEDIA ${VERSION}
          •
          ${state.lastUpdate
            ? formatDate(
                state.lastUpdate
              )
            : "جاهز"}
        </footer>

      </div>
    `;

    bindEvents();
  }

  function metric(
    label,
    value
  ) {
    return `
      <div
        class="ez-auto-metric"
      >

        <span>
          ${escapeHtml(
            label
          )}
        </span>

        <strong>
          ${escapeHtml(
            value
          )}
        </strong>

      </div>
    `;
  }

  function renderWorkflow(
    workflow
  ) {
    const completedSteps =
      workflow.steps.filter(
        step =>
          step.enabled
      ).length;

    const lastRun =
      workflow.lastRun;

    return `
      <article
        class="ez-auto-card"
      >

        <div
          class="ez-auto-card-head"
        >

          <div>

            <button
              class="ez-auto-name"
              data-auto-view="${escapeHtml(
                workflow.id
              )}"
            >

              <span
                class="ez-auto-icon"
              >
                AI
              </span>

              <span>

                <strong>
                  ${escapeHtml(
                    workflow.name
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    workflow.description
                  )}
                </small>

              </span>

            </button>

          </div>

          <span
            class="ez-auto-status-${escapeHtml(
              workflow.status
            )}"
          >
            ${
              STATUS[
                workflow.status
              ] ||
              workflow.status
            }
          </span>

        </div>

        <div
          class="ez-auto-flow"
        >

          ${workflow.steps
            .filter(
              step =>
                step.enabled
            )
            .map(
              (step, index) =>
                `
                  <div
                    class="ez-auto-step"
                  >

                    <span>
                      ${index + 1}
                    </span>

                    <strong>
                      ${escapeHtml(
                        step.name
                      )}
                    </strong>

                  </div>

                  ${
                    index <
                    completedSteps - 1
                      ? `
                        <i>
                          →
                        </i>
                      `
                      : ""
                  }
                `
            )
            .join("")}

        </div>

        <div
          class="ez-auto-meta"
        >

          <span>
            المشغل:
            <strong>
              ${escapeHtml(
                workflow.trigger
              )}
            </strong>
          </span>

          <span>
            التشغيلات:
            <strong>
              ${workflow.runs || 0}
            </strong>
          </span>

          <span>
            نجاح:
            <strong>
              ${workflow.successfulRuns || 0}
            </strong>
          </span>

          <span>
            فشل:
            <strong>
              ${workflow.failedRuns || 0}
            </strong>
          </span>

        </div>

        <div
          class="ez-auto-last-run"
        >

          ${
            lastRun
              ? `
                آخر تشغيل:
                <strong>
                  ${
                    RUN_STATUS[
                      lastRun.status
                    ] ||
                    lastRun.status
                  }
                </strong>
                •
                ${formatDate(
                  lastRun.startedAt
                )}
              `
              : "لم يتم تشغيل المسار حتى الآن."
          }

        </div>

        <div
          class="ez-auto-card-actions"
        >

          <button
            data-auto-run="${escapeHtml(
              workflow.id
            )}"
          >
            تشغيل الآن
          </button>

          <button
            data-auto-edit="${escapeHtml(
              workflow.id
            )}"
          >
            تعديل
          </button>

          <button
            data-auto-toggle="${escapeHtml(
              workflow.id
            )}"
          >
            ${
              workflow.status ===
              "active"
                ? "إيقاف"
                : "تفعيل"
            }
          </button>

          <button
            class="danger"
            data-auto-delete="${escapeHtml(
              workflow.id
            )}"
          >
            حذف
          </button>

        </div>

      </article>
    `;
  }

  function renderEditor() {
    const workflow =
      state.selected ||
      {
        id: "",
        name: "",
        description: "",
        status: "draft",
        trigger:
          "مصدر جديد",
        frequency:
          "عند وصول مادة جديدة",
        steps:
          defaultSteps()
      };

    return `
      <div
        class="ez-auto-overlay"
      >

        <section
          class="ez-auto-editor"
        >

          <header
            class="ez-auto-editor-head"
          >

            <div>

              <span>
                AUTOMATION BUILDER
              </span>

              <h3>
                ${
                  workflow.id
                    ? "تعديل مسار الأتمتة"
                    : "إنشاء مسار أتمتة"
                }
              </h3>

            </div>

            <button
              data-auto-close
            >
              إغلاق
            </button>

          </header>

          <form
            id="ez-auto-form"
          >

            <input
              type="hidden"
              name="id"
              value="${escapeHtml(
                workflow.id
              )}"
            />

            <div
              class="ez-auto-form-grid"
            >

              <label>
                <span>
                  اسم المسار
                </span>

                <input
                  name="name"
                  required
                  value="${escapeHtml(
                    workflow.name
                  )}"
                  placeholder="مثال: غرفة الأخبار الآلية"
                />
              </label>

              <label>
                <span>
                  نقطة التشغيل
                </span>

                <select
                  name="trigger"
                >

                  ${[
                    [
                      "مصدر جديد",
                      "مصدر جديد"
                    ],
                    [
                      "خبر عاجل",
                      "خبر عاجل"
                    ],
                    [
                      "رفع ملف",
                      "رفع ملف"
                    ],
                    [
                      "إنشاء محتوى",
                      "إنشاء محتوى"
                    ],
                    [
                      "جدولة",
                      "جدولة"
                    ],
                    [
                      "يدوي",
                      "تشغيل يدوي"
                    ]
                  ]
                    .map(
                      ([value, label]) =>
                        `
                          <option
                            value="${escapeHtml(
                              value
                            )}"
                            ${
                              workflow.trigger ===
                              value
                                ? "selected"
                                : ""
                            }
                          >
                            ${escapeHtml(
                              label
                            )}
                          </option>
                        `
                    )
                    .join("")}

                </select>
              </label>

              <label
                class="full"
              >

                <span>
                  وصف المسار
                </span>

                <textarea
                  name="description"
                  rows="3"
                >${escapeHtml(
                  workflow.description
                )}</textarea>

              </label>

              <label>
                <span>
                  التكرار
                </span>

                <select
                  name="frequency"
                >

                  ${[
                    "عند وصول مادة جديدة",
                    "كل 5 دقائق",
                    "كل 15 دقيقة",
                    "كل ساعة",
                    "يومي",
                    "يدوي فقط"
                  ]
                    .map(
                      value =>
                        `
                          <option
                            value="${escapeHtml(
                              value
                            )}"
                            ${
                              workflow.frequency ===
                              value
                                ? "selected"
                                : ""
                            }
                          >
                            ${escapeHtml(
                              value
                            )}
                          </option>
                        `
                    )
                    .join("")}

                </select>

              </label>

              <label>
                <span>
                  الحالة
                </span>

                <select
                  name="status"
                >

                  ${Object.entries(
                    STATUS
                  )
                    .map(
                      ([key, label]) =>
                        `
                          <option
                            value="${key}"
                            ${
                              workflow.status ===
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

              </label>

            </div>

            <div
              class="ez-auto-steps-editor"
            >

              <div
                class="ez-auto-section-title"
              >
                مراحل المسار
              </div>

              ${workflow.steps
                .map(
                  (step, index) =>
                    `
                      <label
                        class="ez-auto-step-editor"
                      >

                        <input
                          type="checkbox"
                          name="step_${escapeHtml(
                            step.id
                          )}"
                          ${
                            step.enabled
                              ? "checked"
                              : ""
                          }
                        />

                        <span
                          class="ez-auto-step-number"
                        >
                          ${index + 1}
                        </span>

                        <span>

                          <strong>
                            ${escapeHtml(
                              step.name
                            )}
                          </strong>

                          <small>
                            ${escapeHtml(
                              step.description
                            )}
                          </small>

                        </span>

                      </label>
                    `
                )
                .join("")}

            </div>

            <div
              class="ez-auto-form-actions"
            >

              <button
                type="button"
                data-auto-close
              >
                إلغاء
              </button>

              <button
                class="primary"
                type="submit"
              >
                حفظ المسار
              </button>

            </div>

          </form>

        </section>

      </div>
    `;
  }

  function renderDetails() {
    const workflow =
      state.selected;

    if (!workflow) {
      return "";
    }

    const run =
      workflow.lastRun;

    return `
      <section
        class="ez-auto-details"
      >

        <header
          class="ez-auto-details-head"
        >

          <div>

            <span>
              تفاصيل التشغيل
            </span>

            <h3>
              ${escapeHtml(
                workflow.name
              )}
            </h3>

          </div>

          <button
            data-auto-details-close
          >
            إغلاق
          </button>

        </header>

        <div
          class="ez-auto-details-grid"
        >

          ${detail(
            "الحالة",
            STATUS[
              workflow.status
            ] ||
              workflow.status
          )}

          ${detail(
            "المشغل",
            workflow.trigger
          )}

          ${detail(
            "التكرار",
            workflow.frequency
          )}

          ${detail(
            "عدد التشغيلات",
            workflow.runs || 0
          )}

          ${detail(
            "النجاح",
            workflow.successfulRuns ||
              0
          )}

          ${detail(
            "الفشل",
            workflow.failedRuns ||
              0
          )}

        </div>

        <div
          class="ez-auto-detail-flow"
        >

          ${workflow.steps
            .map(
              (step, index) =>
                `
                  <div
                    class="${
                      step.enabled
                        ? "enabled"
                        : "disabled"
                    }"
                  >

                    <span>
                      ${index + 1}
                    </span>

                    <strong>
                      ${escapeHtml(
                        step.name
                      )}
                    </strong>

                    <small>
                      ${
                        step.enabled
                          ? "مفعلة"
                          : "معطلة"
                      }
                    </small>

                  </div>
                `
            )
            .join("")}

        </div>

        ${
          run
            ? `
              <div
                class="ez-auto-run-box"
              >

                <strong>
                  آخر تشغيل
                </strong>

                <p>
                  الحالة:
                  ${
                    RUN_STATUS[
                      run.status
                    ] ||
                    run.status
                  }
                </p>

                <p>
                  بدأ:
                  ${formatDate(
                    run.startedAt
                  )}
                </p>

                ${
                  run.finishedAt
                    ? `
                      <p>
                        انتهى:
                        ${formatDate(
                          run.finishedAt
                        )}
                      </p>
                    `
                    : ""
                }

                ${
                  run.error
                    ? `
                      <p
                        class="error"
                      >
                        ${escapeHtml(
                          run.error
                        )}
                      </p>
                    `
                    : ""
                }

              </div>
            `
            : ""
        }

      </section>
    `;
  }

  function detail(
    label,
    value
  ) {
    return `
      <div
        class="ez-auto-detail"
      >

        <span>
          ${escapeHtml(
            label
          )}
        </span>

        <strong>
          ${escapeHtml(
            value
          )}
        </strong>

      </div>
    `;
  }

  function openAdd() {
    state.selected =
      null;

    state.editing =
      true;

    render();
  }

  function openEdit(id) {
    const workflow =
      state.workflows.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!workflow) {
      return;
    }

    state.selected =
      workflow;

    state.editing =
      true;

    render();
  }

  function openDetails(id) {
    const workflow =
      state.workflows.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!workflow) {
      return;
    }

    state.selected =
      workflow;

    state.editing =
      false;

    render();
  }

  function closeEditor() {
    state.selected =
      null;

    state.editing =
      false;

    render();
  }

  function saveWorkflow(
    form
  ) {
    const data =
      new FormData(
        form
      );

    const id =
      data.get("id") ||
      uid("workflow");

    const existing =
      state.workflows.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    const steps =
      STEP_DEFINITIONS.map(
        (step, index) => ({
          ...step,
          enabled:
            data.get(
              `step_${step.id}`
            ) === "on",
          order:
            index + 1
        })
      );

    const workflow = {
      id,

      name:
        String(
          data.get("name") ||
            ""
        ).trim(),

      description:
        String(
          data.get(
            "description"
          ) ||
            ""
        ).trim(),

      status:
        String(
          data.get("status") ||
            "draft"
        ),

      trigger:
        String(
          data.get("trigger") ||
            "يدوي"
        ),

      frequency:
        String(
          data.get(
            "frequency"
          ) ||
            "يدوي فقط"
        ),

      steps,

      runs:
        existing?.runs || 0,

      successfulRuns:
        existing?.successfulRuns ||
        0,

      failedRuns:
        existing?.failedRuns ||
        0,

      lastRun:
        existing?.lastRun ||
        null,

      lastError:
        existing?.lastError ||
        null,

      createdAt:
        existing?.createdAt ||
        now(),

      updatedAt:
        now()
    };

    if (!workflow.name) {
      showToast(
        "اسم المسار مطلوب."
      );

      return;
    }

    if (existing) {
      const index =
        state.workflows.findIndex(
          item =>
            String(
              item.id
            ) ===
            String(id)
        );

      state.workflows[
        index
      ] = workflow;
    } else {
      state.workflows.unshift(
        workflow
      );
    }

    saveWorkflows();

    state.selected =
      workflow;

    state.editing =
      false;

    state.lastUpdate =
      new Date();

    render();

    showToast(
      "تم حفظ مسار الأتمتة."
    );
  }

  function toggleWorkflow(
    id
  ) {
    const workflow =
      state.workflows.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!workflow) {
      return;
    }

    workflow.status =
      workflow.status ===
      "active"
        ? "paused"
        : "active";

    workflow.updatedAt =
      now();

    saveWorkflows();

    state.lastUpdate =
      new Date();

    render();

    showToast(
      workflow.status ===
        "active"
        ? "تم تفعيل المسار."
        : "تم إيقاف المسار."
    );
  }

  function deleteWorkflow(
    id
  ) {
    const workflow =
      state.workflows.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!workflow) {
      return;
    }

    if (
      !window.confirm(
        `هل تريد حذف "${workflow.name}"؟`
      )
    ) {
      return;
    }

    state.workflows =
      state.workflows.filter(
        item =>
          String(
            item.id
          ) !==
          String(id)
      );

    if (
      state.selected &&
      String(
        state.selected.id
      ) ===
        String(id)
    ) {
      state.selected =
        null;

      state.editing =
        false;
    }

    saveWorkflows();

    state.lastUpdate =
      new Date();

    render();

    showToast(
      "تم حذف المسار."
    );
  }

  function runWorkflow(
    id
  ) {
    const workflow =
      state.workflows.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!workflow) {
      return;
    }

    if (
      workflow.status !==
      "active"
    ) {
      showToast(
        "فعّل المسار أولًا."
      );

      return;
    }

    const run = {
      id: uid("run"),
      status: "waiting",
      startedAt: now(),
      finishedAt: null,
      error: null
    };

    workflow.runs =
      (workflow.runs || 0) +
      1;

    workflow.lastRun =
      run;

    workflow.updatedAt =
      now();

    saveWorkflows();

    state.selected =
      workflow;

    state.lastUpdate =
      new Date();

    render();

    showToast(
      "تم إنشاء تشغيل جديد للمسار. التنفيذ الخلفي الفعلي يحتاج Worker/Backend."
    );
  }

  function bindEvents() {
    const add =
      document.querySelector(
        "[data-auto-add]"
      );

    if (add) {
      add.addEventListener(
        "click",
        openAdd
      );
    }

    const refresh =
      document.querySelector(
        "[data-auto-refresh]"
      );

    if (refresh) {
      refresh.addEventListener(
        "click",
        () => {
          state.workflows =
            loadWorkflows();

          state.lastUpdate =
            new Date();

          render();

          showToast(
            "تم تحديث مركز الأتمتة."
          );
        }
      );
    }

    const search =
      document.querySelector(
        "#ez-auto-search"
      );

    if (search) {
      search.addEventListener(
        "input",
        event => {
          state.search =
            event.target.value;

          render();
        }
      );
    }

    const status =
      document.querySelector(
        "#ez-auto-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        event => {
          state.status =
            event.target.value;

          render();
        }
      );
    }

    document
      .querySelectorAll(
        "[data-auto-view]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              openDetails(
                button.dataset
                  .autoView
              )
          );
        }
      );

    document
      .querySelectorAll(
        "[data-auto-edit]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              openEdit(
                button.dataset
                  .autoEdit
              )
          );
        }
      );

    document
      .querySelectorAll(
        "[data-auto-run]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              runWorkflow(
                button.dataset
                  .autoRun
              )
          );
        }
      );

    document
      .querySelectorAll(
        "[data-auto-toggle]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              toggleWorkflow(
                button.dataset
                  .autoToggle
              )
          );
        }
      );

    document
      .querySelectorAll(
        "[data-auto-delete]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              deleteWorkflow(
                button.dataset
                  .autoDelete
              )
          );
        }
      );

    document
      .querySelectorAll(
        "[data-auto-close]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            closeEditor
          );
        }
      );

    const detailsClose =
      document.querySelector(
        "[data-auto-details-close]"
      );

    if (detailsClose) {
      detailsClose.addEventListener(
        "click",
        () => {
          state.selected =
            null;

          render();
        }
      );
    }

    const form =
      document.querySelector(
        "#ez-auto-form"
      );

    if (form) {
      form.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          saveWorkflow(
            form
          );
        }
      );
    }
  }

  function showToast(
    message
  ) {
    let toast =
      document.querySelector(
        "#ez-auto-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-auto-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100000;
        max-width:430px;
        border:1px solid #bae6fd;
        border-radius:15px;
        background:#ffffff;
        color:#075985;
        padding:12px 15px;
        box-shadow:0 15px 45px rgba(7,89,133,.16);
        font-size:11px;
        font-weight:900;
        direction:rtl;
      `;

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(
        () => {
          toast.remove();
        },
        5000
      );
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-automation-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-automation-style";

    style.textContent = `
      #automation-section,
      #admin-automation-section {
        direction:rtl;
      }

      .ez-automation {
        color:#0f172a;
      }

      .ez-automation-header {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:15px;
      }

      .ez-automation-kicker {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
        letter-spacing:.08em;
      }

      .ez-automation-header h2 {
        margin:5px 0;
        color:#075985;
        font-size:27px;
        font-weight:950;
      }

      .ez-automation-header p {
        margin:0;
        max-width:780px;
        color:#64748b;
        font-size:11px;
        line-height:1.8;
      }

      .ez-automation-actions {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
      }

      .ez-auto-btn {
        border:1px solid #bae6fd;
        border-radius:11px;
        background:#fff;
        color:#0369a1;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-auto-btn.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-auto-metrics {
        display:grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap:9px;
        margin-bottom:10px;
      }

      .ez-auto-metric {
        border:1px solid #e0f2fe;
        border-radius:15px;
        background:#fff;
        padding:13px;
      }

      .ez-auto-metric span {
        display:block;
        color:#64748b;
        font-size:8px;
        font-weight:850;
      }

      .ez-auto-metric strong {
        display:block;
        margin-top:4px;
        color:#075985;
        font-size:24px;
        font-weight:950;
      }

      .ez-auto-panel {
        border:1px solid #e0f2fe;
        border-radius:17px;
        background:#fff;
        padding:13px;
      }

      .ez-auto-toolbar {
        display:flex;
        gap:7px;
        margin-bottom:11px;
      }

      .ez-auto-toolbar input,
      .ez-auto-toolbar select {
        border:1px solid #bae6fd;
        border-radius:10px;
        background:#fff;
        color:#334155;
        outline:none;
        padding:9px;
        font-size:9px;
      }

      .ez-auto-toolbar input {
        flex:1;
        min-width:200px;
      }

      .ez-auto-list {
        display:grid;
        gap:9px;
      }

      .ez-auto-card {
        border:1px solid #e0f2fe;
        border-radius:15px;
        padding:13px;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #f8fdff
          );
      }

      .ez-auto-card-head {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
      }

      .ez-auto-name {
        display:flex;
        align-items:center;
        gap:9px;
        border:0;
        background:transparent;
        cursor:pointer;
        padding:0;
        text-align:right;
      }

      .ez-auto-icon {
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        border-radius:11px;
        background:#eff6ff;
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-auto-name strong {
        display:block;
        color:#075985;
        font-size:11px;
      }

      .ez-auto-name small {
        display:block;
        margin-top:3px;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-auto-status-active,
      .ez-auto-status-paused,
      .ez-auto-status-draft,
      .ez-auto-status-error {
        border-radius:999px;
        padding:5px 8px;
        font-size:7px;
        font-weight:950;
      }

      .ez-auto-status-active {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-auto-status-paused {
        background:#eff6ff;
        color:#0369a1;
      }

      .ez-auto-status-draft {
        background:#f8fafc;
        color:#64748b;
      }

      .ez-auto-status-error {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-auto-flow {
        display:flex;
        align-items:center;
        gap:5px;
        margin-top:13px;
        overflow:auto;
        padding-bottom:3px;
      }

      .ez-auto-step {
        min-width:90px;
        border:1px solid #e0f2fe;
        border-radius:9px;
        background:#fff;
        padding:7px;
      }

      .ez-auto-step span {
        display:inline-grid;
        place-items:center;
        width:17px;
        height:17px;
        border-radius:50%;
        background:#e0f2fe;
        color:#0369a1;
        font-size:7px;
        font-weight:950;
      }

      .ez-auto-step strong {
        display:block;
        margin-top:4px;
        color:#334155;
        font-size:7px;
      }

      .ez-auto-flow i {
        color:#38bdf8;
        font-style:normal;
        font-weight:950;
      }

      .ez-auto-meta {
        display:flex;
        gap:15px;
        flex-wrap:wrap;
        margin-top:12px;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-auto-meta strong {
        color:#0369a1;
      }

      .ez-auto-last-run {
        margin-top:8px;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-auto-last-run strong {
        color:#0369a1;
      }

      .ez-auto-card-actions {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        margin-top:11px;
      }

      .ez-auto-card-actions button {
        border:1px solid #e0f2fe;
        border-radius:8px;
        background:#fff;
        color:#0369a1;
        padding:6px 8px;
        cursor:pointer;
        font-size:7px;
        font-weight:900;
      }

      .ez-auto-card-actions button.danger {
        border-color:#fecdd3;
        background:#fff1f2;
        color:#be123c;
      }

      .ez-auto-empty {
        padding:40px;
        color:#94a3b8;
        text-align:center;
        font-size:9px;
      }

      .ez-auto-overlay {
        position:fixed;
        inset:0;
        z-index:90000;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(240,249,255,.82);
        backdrop-filter:blur(8px);
      }

      .ez-auto-editor {
        width:min(760px,100%);
        max-height:90vh;
        overflow:auto;
        border:1px solid #bae6fd;
        border-radius:20px;
        background:#fff;
        padding:17px;
        box-shadow:0 25px 80px rgba(7,89,133,.16);
      }

      .ez-auto-editor-head,
      .ez-auto-details-head {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
        margin-bottom:15px;
      }

      .ez-auto-editor-head span,
      .ez-auto-details-head span {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-auto-editor-head h3,
      .ez-auto-details-head h3 {
        margin:4px 0 0;
        color:#075985;
        font-size:17px;
      }

      .ez-auto-editor-head button,
      .ez-auto-details-head button {
        border:1px solid #e0f2fe;
        border-radius:9px;
        background:#fff;
        color:#64748b;
        padding:7px 10px;
        cursor:pointer;
        font-size:8px;
      }

      .ez-auto-form-grid {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:9px;
      }

      .ez-auto-form-grid label {
        display:grid;
        gap:5px;
      }

      .ez-auto-form-grid label.full {
        grid-column:1/-1;
      }

      .ez-auto-form-grid label > span {
        color:#64748b;
        font-size:8px;
        font-weight:900;
      }

      .ez-auto-form-grid input,
      .ez-auto-form-grid select,
      .ez-auto-form-grid textarea {
        box-sizing:border-box;
        width:100%;
        border:1px solid #bae6fd;
        border-radius:10px;
        background:#fff;
        color:#334155;
        outline:none;
        padding:9px;
        font-family:inherit;
        font-size:9px;
      }

      .ez-auto-steps-editor {
        margin-top:14px;
        border-top:1px solid #e0f2fe;
        padding-top:12px;
      }

      .ez-auto-section-title {
        margin-bottom:8px;
        color:#075985;
        font-size:10px;
        font-weight:950;
      }

      .ez-auto-step-editor {
        display:flex !important;
        grid-template-columns:none !important;
        align-items:center;
        gap:8px;
        border:1px solid #e0f2fe;
        border-radius:10px;
        background:#f8fdff;
        padding:8px;
        margin-bottom:5px;
      }

      .ez-auto-step-editor input {
        width:auto !important;
      }

      .ez-auto-step-number {
        display:grid;
        place-items:center;
        width:23px;
        height:23px;
        border-radius:8px;
        background:#e0f2fe;
        color:#0369a1;
        font-size:8px !important;
      }

      .ez-auto-step-editor strong {
        display:block;
        color:#334155;
        font-size:8px;
      }

      .ez-auto-step-editor small {
        display:block;
        margin-top:2px;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-auto-form-actions {
        display:flex;
        justify-content:flex-end;
        gap:7px;
        margin-top:14px;
      }

      .ez-auto-form-actions button {
        border:1px solid #e0f2fe;
        border-radius:10px;
        background:#fff;
        color:#64748b;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-auto-form-actions button.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-auto-details {
        margin-top:10px;
        border:1px solid #bae6fd;
        border-radius:17px;
        background:#fff;
        padding:14px;
      }

      .ez-auto-details-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .ez-auto-detail {
        border-radius:10px;
        background:#f8fafc;
        padding:9px;
      }

      .ez-auto-detail span {
        display:block;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-auto-detail strong {
        display:block;
        margin-top:3px;
        color:#075985;
        font-size:9px;
      }

      .ez-auto-detail-flow {
        display:grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap:7px;
        margin-top:10px;
      }

      .ez-auto-detail-flow > div {
        border:1px solid #e0f2fe;
        border-radius:10px;
        background:#fff;
        padding:9px;
      }

      .ez-auto-detail-flow > div.disabled {
        opacity:.45;
      }

      .ez-auto-detail-flow span {
        display:grid;
        place-items:center;
        width:21px;
        height:21px;
        border-radius:7px;
        background:#eff6ff;
        color:#0369a1;
        font-size:7px;
        font-weight:950;
      }

      .ez-auto-detail-flow strong {
        display:block;
        margin-top:5px;
        color:#334155;
        font-size:8px;
      }

      .ez-auto-detail-flow small {
        display:block;
        margin-top:3px;
        color:#94a3b8;
        font-size:6px;
      }

      .ez-auto-run-box {
        margin-top:10px;
        border-radius:12px;
        background:#f8fdff;
        padding:10px;
        color:#64748b;
        font-size:8px;
      }

      .ez-auto-run-box strong {
        color:#075985;
      }

      .ez-auto-run-box p {
        margin:5px 0 0;
      }

      .ez-auto-run-box .error {
        color:#be123c;
      }

      .ez-auto-footer {
        margin-top:9px;
        color:#94a3b8;
        text-align:center;
        font-size:7px;
      }

      @media (max-width:850px) {
        .ez-auto-metrics {
          grid-template-columns:
            repeat(2,1fr);
        }

        .ez-auto-detail-flow {
          grid-template-columns:
            repeat(2,1fr);
        }
      }

      @media (max-width:600px) {
        .ez-auto-metrics,
        .ez-auto-form-grid,
        .ez-auto-details-grid,
        .ez-auto-detail-flow {
          grid-template-columns:1fr;
        }

        .ez-auto-form-grid label.full {
          grid-column:auto;
        }

        .ez-auto-toolbar {
          flex-direction:column;
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
        "#automation-section"
      ) ||
      document.querySelector(
        "#admin-automation-section"
      ) ||
      document.querySelector(
        '[data-admin-section="automation"]'
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
      "admin-automation-section";

    (
      document.querySelector(
        "main"
      ) ||
      document.body
    ).appendChild(
      mount
    );

    return mount;
  }

  function initialize() {
    seed();
    createMount();
    render();
  }

  window.EZMediaAdminAutomation =
    {
      initialize,

      refresh() {
        state.workflows =
          loadWorkflows();

        state.lastUpdate =
          new Date();

        render();
      },

      add:
        openAdd,

      run:
        runWorkflow,

      getState() {
        return {
          ...state,
          workflows: [
            ...state.workflows
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
