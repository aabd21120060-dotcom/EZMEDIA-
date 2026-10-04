"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    content: "/api/content",
    ai: "/api/ai"
  };

  const STATE = {
    items: [],
    selected: null,
    analysis: null,
    loading: false,
    search: "",
    status: "all",
    risk: "all",
    lastUpdate: null
  };

  const STATUS_LABELS = {
    draft: "مسودة",
    review: "قيد المراجعة",
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
      ).format(
        new Date(value)
      );
    } catch {
      return String(value);
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

  function getArray(data) {
    if (
      Array.isArray(data)
    ) {
      return data;
    }

    for (
      const key of [
        "items",
        "data",
        "results",
        "content"
      ]
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

  function normalizeContent(item) {
    return {
      ...item,

      id:
        item?.id ||
        item?._id ||
        null,

      title:
        item?.title ||
        item?.headline ||
        "",

      summary:
        item?.summary ||
        item?.description ||
        "",

      body:
        item?.body ||
        item?.content ||
        item?.text ||
        "",

      status:
        item?.status ||
        "draft",

      contentType:
        item?.content_type ||
        item?.contentType ||
        item?.type ||
        "news",

      category:
        item?.category ||
        "",

      sourceUrl:
        item?.source_url ||
        item?.sourceUrl ||
        "",

      author:
        item?.author_name ||
        item?.author ||
        "",

      createdAt:
        item?.created_at ||
        item?.createdAt ||
        null,

      updatedAt:
        item?.updated_at ||
        item?.updatedAt ||
        null,

      metadata:
        item?.metadata ||
        {}
    };
  }

  async function loadContent() {
    STATE.loading = true;
    render();

    try {
      const data =
        await request(
          `${API.content}?limit=500`
        );

      STATE.items =
        getArray(data)
          .map(
            normalizeContent
          );

      STATE.lastUpdate =
        new Date();

      if (
        STATE.selected
      ) {
        const refreshed =
          STATE.items.find(
            item =>
              String(
                item.id
              ) ===
              String(
                STATE.selected.id
              )
          );

        if (refreshed) {
          STATE.selected =
            refreshed;
        }
      }

    } catch (error) {
      console.error(
        "EZ MEDIA Verification:",
        error
      );

      showToast(
        error.message ||
        "تعذر تحميل المحتوى."
      );

    } finally {
      STATE.loading = false;
      render();
    }
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
              item.summary,
              item.category,
              item.contentType,
              item.author
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

        if (
          STATE.risk !==
          "all"
        ) {
          const risk =
            getRiskLevel(
              item
            );

          if (
            risk !==
            STATE.risk
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }

  function getRiskLevel(
    item
  ) {
    const flags =
      item?.metadata
        ?.ai
        ?.risk_flags ||
      item?.metadata
        ?.risk_flags ||
      [];

    if (
      Array.isArray(
        flags
      ) &&
      flags.length
    ) {
      const text =
        flags
          .join(" ")
          .toLowerCase();

      if (
        text.includes(
          "critical"
        ) ||
        text.includes(
          "عالي جدًا"
        ) ||
        text.includes(
          "عاجل"
        )
      ) {
        return "critical";
      }

      if (
        text.includes(
          "high"
        ) ||
        text.includes(
          "عالي"
        )
      ) {
        return "high";
      }

      return "medium";
    }

    return "low";
  }

  function getRiskLabel(
    level
  ) {
    return {
      low: "منخفض",
      medium: "متوسط",
      high: "مرتفع",
      critical: "حرج"
    }[
      level
    ] || "غير محدد";
  }

  function getRiskClass(
    level
  ) {
    return (
      `ez-ver-risk-${level}`
    );
  }

  async function analyzeContent(
    item
  ) {
    if (!item?.id) {
      return;
    }

    STATE.loading = true;
    render();

    try {
      const data =
        await request(
          `${API.ai}/content/${item.id}/analyze`,
          {
            method:
              "POST"
          }
        );

      STATE.analysis =
        data?.analysis ||
        data?.data ||
        data ||
        null;

      STATE.selected =
        item;

      showToast(
        "اكتمل تحليل الذكاء الاصطناعي."
      );

    } catch (error) {
      showToast(
        error.message ||
        "تعذر تحليل المحتوى."
      );

    } finally {
      STATE.loading = false;
      render();
    }
  }

  async function loadLatestAnalysis(
    item
  ) {
    if (!item?.id) {
      return;
    }

    try {
      const data =
        await request(
          `${API.ai}/content/${item.id}/latest`
        );

      STATE.analysis =
        data?.analysis ||
        data?.data ||
        data ||
        null;

    } catch {
      STATE.analysis =
        null;
    }
  }

  async function selectContent(
    item
  ) {
    STATE.selected =
      item;

    STATE.analysis =
      null;

    render();

    await loadLatestAnalysis(
      item
    );

    render();
  }

  async function changeStatus(
    id,
    action
  ) {
    if (!id) {
      return;
    }

    try {
      await request(
        `${API.content}/${id}/${action}`,
        {
          method:
            "POST"
        }
      );

      showToast(
        action ===
          "approve"
          ? "تم اعتماد المحتوى."
          : "تم إرسال العملية."
      );

      await loadContent();

    } catch (error) {
      showToast(
        error.message ||
        "تعذر تنفيذ العملية."
      );
    }
  }

  function buildChecklist(
    item
  ) {
    const title =
      Boolean(
        item?.title &&
        item.title
          .trim()
          .length >= 10
      );

    const summary =
      Boolean(
        item?.summary &&
        item.summary
          .trim()
          .length >= 20
      );

    const body =
      Boolean(
        item?.body &&
        item.body
          .trim()
          .length >= 50
      );

    const source =
      Boolean(
        item?.sourceUrl ||
        item?.metadata
          ?.source ||
        item?.metadata
          ?.sources
      );

    const category =
      Boolean(
        item?.category
      );

    return [
      {
        key: "title",
        label:
          "العنوان واضح ومحدد",
        passed:
          title
      },
      {
        key: "summary",
        label:
          "الملخص مكتمل",
        passed:
          summary
      },
      {
        key: "body",
        label:
          "نص المادة موجود",
        passed:
          body
      },
      {
        key: "source",
        label:
          "يوجد مصدر أو مرجع",
        passed:
          source
      },
      {
        key: "category",
        label:
          "التصنيف محدد",
        passed:
          category
      }
    ];
  }

  function checklistScore(
    item
  ) {
    const list =
      buildChecklist(
        item
      );

    const passed =
      list.filter(
        entry =>
          entry.passed
      ).length;

    return {
      passed,
      total:
        list.length,
      percentage:
        Math.round(
          (
            passed /
            list.length
          ) *
            100
        )
    };
  }

  function render() {
    injectStyles();

    const mount =
      getMount();

    if (!mount) {
      return;
    }

    const items =
      filteredItems();

    mount.innerHTML = `
      <div
        class="ez-verification"
      >

        <div
          class="ez-ver-header"
        >

          <div>
            <h2>
              مركز التحقق والتحرير الذكي
            </h2>

            <p>
              فحص المواد قبل اعتمادها ونشرها داخل غرفة أخبار EZ MEDIA
            </p>
          </div>

          <div
            class="ez-ver-header-actions"
          >

            <button
              class="ez-ver-btn primary"
              data-ver-action="refresh"
            >
              تحديث
            </button>

          </div>

        </div>

        <div
          class="ez-ver-layout"
        >

          <aside
            class="ez-ver-sidebar"
          >

            <div
              class="ez-ver-filters"
            >

              <input
                id="ez-ver-search"
                type="search"
                placeholder="البحث في المواد..."
                value="${escapeHtml(
                  STATE.search
                )}"
              />

              <select
                id="ez-ver-status"
              >

                <option
                  value="all"
                >
                  كل الحالات
                </option>

                ${Object.entries(
                  STATUS_LABELS
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
                id="ez-ver-risk"
              >

                <option
                  value="all"
                >
                  كل مستويات المخاطر
                </option>

                <option
                  value="low"
                  ${
                    STATE.risk ===
                    "low"
                      ? "selected"
                      : ""
                  }
                >
                  منخفض
                </option>

                <option
                  value="medium"
                  ${
                    STATE.risk ===
                    "medium"
                      ? "selected"
                      : ""
                  }
                >
                  متوسط
                </option>

                <option
                  value="high"
                  ${
                    STATE.risk ===
                    "high"
                      ? "selected"
                      : ""
                  }
                >
                  مرتفع
                </option>

                <option
                  value="critical"
                  ${
                    STATE.risk ===
                    "critical"
                      ? "selected"
                      : ""
                  }
                >
                  حرج
                </option>

              </select>

            </div>

            <div
              class="ez-ver-list"
            >

              ${
                STATE.loading
                  ? `
                    <div
                      class="ez-ver-empty"
                    >
                      جارٍ التحميل...
                    </div>
                  `
                  : items.length
                  ? items
                      .map(
                        renderItem
                      )
                      .join("")
                  : `
                    <div
                      class="ez-ver-empty"
                    >
                      لا توجد مواد مطابقة.
                    </div>
                  `
              }

            </div>

          </aside>

          <section
            class="ez-ver-workspace"
          >

            ${
              STATE.selected
                ? renderWorkspace()
                : renderWelcome()
            }

          </section>

        </div>

        ${
          STATE.lastUpdate
            ? `
              <div
                class="ez-ver-last"
              >
                آخر تحديث:
                ${formatDate(
                  STATE.lastUpdate
                )}
              </div>
            `
            : ""
        }

      </div>
    `;

    bindEvents();
  }

  function renderItem(
    item
  ) {
    const selected =
      STATE.selected &&
      String(
        STATE.selected.id
      ) ===
        String(item.id);

    const risk =
      getRiskLevel(
        item
      );

    return `
      <button
        class="
          ez-ver-item
          ${
            selected
              ? "selected"
              : ""
          }
        "
        data-ver-select="${escapeHtml(
          item.id
        )}"
      >

        <div
          class="ez-ver-item-top"
        >

          <span>
            ${
              STATUS_LABELS[
                item.status
              ] ||
              item.status
            }
          </span>

          <span
            class="${getRiskClass(
              risk
            )}"
          >
            ${getRiskLabel(
              risk
            )}
          </span>

        </div>

        <strong>
          ${escapeHtml(
            item.title ||
            "بدون عنوان"
          )}
        </strong>

        <small>
          ${escapeHtml(
            item.category ||
            item.contentType
          )}
          •
          ${formatDate(
            item.updatedAt ||
            item.createdAt
          )}
        </small>

      </button>
    `;
  }

  function renderWelcome() {
    return `
      <div
        class="ez-ver-welcome"
      >

        <div
          class="ez-ver-welcome-icon"
        >
          ✓
        </div>

        <h3>
          اختر مادة للبدء
        </h3>

        <p>
          اختر خبرًا أو تقريرًا أو مقابلة من القائمة لبدء عملية التحقق والتحرير.
        </p>

      </div>
    `;
  }

  function renderWorkspace() {
    const item =
      STATE.selected;

    const risk =
      getRiskLevel(
        item
      );

    const score =
      checklistScore(
        item
      );

    const checklist =
      buildChecklist(
        item
      );

    const analysis =
      STATE.analysis;

    return `
      <div
        class="ez-ver-workspace-inner"
      >

        <div
          class="ez-ver-article-header"
        >

          <div>
            <div
              class="ez-ver-badges"
            >

              <span>
                ${
                  STATUS_LABELS[
                    item.status
                  ] ||
                  item.status
                }
              </span>

              <span
                class="${getRiskClass(
                  risk
                )}"
              >
                خطر:
                ${getRiskLabel(
                  risk
                )}
              </span>

            </div>

            <h1>
              ${escapeHtml(
                item.title ||
                "بدون عنوان"
              )}
            </h1>

            <div
              class="ez-ver-meta"
            >
              ${escapeHtml(
                item.category ||
                "غير مصنف"
              )}
              •
              ${escapeHtml(
                item.author ||
                "غير محدد"
              )}
              •
              ${formatDate(
                item.updatedAt ||
                item.createdAt
              )}
            </div>

          </div>

          <div
            class="ez-ver-actions"
          >

            ${
              item.status ===
                "review" ||
              item.status ===
                "draft"
                ? `
                  <button
                    class="ez-ver-btn primary"
                    data-ver-approve="${escapeHtml(
                      item.id
                    )}"
                  >
                    اعتماد
                  </button>
                `
                : ""
            }

            ${
              item.status !==
                "published" &&
              item.status !==
                "archived"
                ? `
                  <button
                    class="ez-ver-btn"
                    data-ver-ai="${escapeHtml(
                      item.id
                    )}"
                  >
                    تحليل AI
                  </button>
                `
                : ""
            }

            ${
              item.status !==
              "published"
                ? `
                  <button
                    class="ez-ver-btn danger"
                    data-ver-review="${escapeHtml(
                      item.id
                    )}"
                  >
                    إعادة للمراجعة
                  </button>
                `
                : ""
            }

          </div>

        </div>

        <div
          class="ez-ver-grid"
        >

          <section
            class="ez-ver-panel"
          >

            <div
              class="ez-ver-panel-head"
            >
              <h3>
                قائمة التحقق التحريرية
              </h3>

              <strong>
                ${score.percentage}%
              </strong>
            </div>

            <div
              class="ez-ver-progress"
            >
              <span
                style="width:${score.percentage}%"
              ></span>
            </div>

            <div
              class="ez-ver-checklist"
            >

              ${checklist
                .map(
                  check =>
                    `
                      <div
                        class="
                          ez-ver-check
                          ${
                            check.passed
                              ? "passed"
                              : "failed"
                          }
                        "
                      >

                        <span>
                          ${
                            check.passed
                              ? "✓"
                              : "!"
                          }
                        </span>

                        <div>
                          <strong>
                            ${escapeHtml(
                              check.label
                            )}
                          </strong>

                          <small>
                            ${
                              check.passed
                                ? "مكتمل"
                                : "يحتاج مراجعة"
                            }
                          </small>
                        </div>

                      </div>
                    `
                )
                .join("")}

            </div>

          </section>

          <section
            class="ez-ver-panel"
          >

            <div
              class="ez-ver-panel-head"
            >
              <h3>
                تقييم المخاطر
              </h3>

              <span
                class="${getRiskClass(
                  risk
                )}"
              >
                ${getRiskLabel(
                  risk
                )}
              </span>
            </div>

            <div
              class="ez-ver-risk-meter"
            >

              <div>
                <span>
                  مستوى الثقة التحريرية
                </span>

                <strong>
                  ${
                    analysis?.confidence !==
                    undefined
                      ? `${Math.round(
                          Number(
                            analysis.confidence
                          ) *
                            (
                              Number(
                                analysis.confidence
                              ) <=
                              1
                                ? 100
                                : 1
                            )
                        )}%`
                      : "غير متاح"
                  }
                </strong>
              </div>

            </div>

            <div
              class="ez-ver-risk-list"
            >

              ${
                analysis?.risk_flags &&
                Array.isArray(
                  analysis.risk_flags
                )
                  ? analysis.risk_flags
                      .map(
                        flag =>
                          `
                            <div>
                              !
                              ${escapeHtml(
                                flag
                              )}
                            </div>
                          `
                      )
                      .join("")
                  : `
                    <div
                      class="ez-ver-no-risk"
                    >
                      لم يتم تسجيل إشارات خطر من آخر تحليل AI.
                    </div>
                  `
              }

            </div>

          </section>

        </div>

        <div
          class="ez-ver-grid"
        >

          <section
            class="ez-ver-panel"
          >

            <div
              class="ez-ver-panel-head"
            >
              <h3>
                المادة الأصلية
              </h3>

              <button
                class="ez-ver-copy"
                data-ver-copy="article"
              >
                نسخ
              </button>
            </div>

            <div
              class="ez-ver-original"
            >

              <h4>
                ${escapeHtml(
                  item.title
                )}
              </h4>

              <p>
                ${escapeHtml(
                  item.summary ||
                  "لا يوجد ملخص."
                )}
              </p>

              <div
                class="ez-ver-body"
              >
                ${escapeHtml(
                  item.body ||
                  "لا يوجد نص للمادة."
                )}
              </div>

            </div>

          </section>

          <section
            class="ez-ver-panel"
          >

            <div
              class="ez-ver-panel-head"
            >
              <h3>
                نتيجة الذكاء الاصطناعي
              </h3>

              ${
                analysis
                  ? `
                    <span
                      class="ez-ver-ai-ready"
                    >
                      مكتمل
                    </span>
                  `
                  : `
                    <span
                      class="ez-ver-ai-wait"
                    >
                      لم يُحلل
                    </span>
                  `
              }

            </div>

            ${
              analysis
                ? renderAnalysis(
                    analysis
                  )
                : `
                  <div
                    class="ez-ver-ai-empty"
                  >
                    اضغط "تحليل AI" للحصول على تقييم تحريري مساعد.
                  </div>
                `
            }

          </section>

        </div>

        <section
          class="ez-ver-panel"
        >

          <div
            class="ez-ver-panel-head"
          >
            <h3>
              المصادر والمرجع
            </h3>
          </div>

          <div
            class="ez-ver-sources"
          >

            ${
              item.sourceUrl
                ? `
                  <a
                    href="${escapeHtml(
                      item.sourceUrl
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ${escapeHtml(
                      item.sourceUrl
                    )}
                  </a>
                `
                : ""
            }

            ${
              item.metadata
                ?.sources &&
              Array.isArray(
                item.metadata
                  .sources
              )
                ? item.metadata.sources
                    .map(
                      source =>
                        `
                          <a
                            href="${escapeHtml(
                              source.url ||
                              source
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            ${escapeHtml(
                              source.title ||
                              source.url ||
                              source
                            )}
                          </a>
                        `
                    )
                    .join("")
                : ""
            }

            ${
              !item.sourceUrl &&
              !(
                item.metadata
                  ?.sources &&
                Array.isArray(
                  item.metadata
                    .sources
                ) &&
                item.metadata
                  .sources.length
              )
                ? `
                  <div
                    class="ez-ver-no-source"
                  >
                    لا يوجد مصدر مسجل. يجب التحقق من المصدر قبل الاعتماد.
                  </div>
                `
                : ""
            }

          </div>

        </section>

      </div>
    `;
  }

  function renderAnalysis(
    analysis
  ) {
    const keywords =
      Array.isArray(
        analysis.keywords
      )
        ? analysis.keywords
        : [];

    const social =
      analysis.social_posts ||
      {};

    return `
      <div
        class="ez-ver-analysis"
      >

        ${
          analysis.headline
            ? `
              <div
                class="ez-ver-analysis-block"
              >
                <span>
                  العنوان المقترح
                </span>

                <strong>
                  ${escapeHtml(
                    analysis.headline
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          analysis.summary
            ? `
              <div
                class="ez-ver-analysis-block"
              >
                <span>
                  الملخص
                </span>

                <p>
                  ${escapeHtml(
                    analysis.summary
                  )}
                </p>
              </div>
            `
            : ""
        }

        ${
          analysis.editor_notes
            ? `
              <div
                class="ez-ver-analysis-block"
              >
                <span>
                  ملاحظات المحرر الآلي
                </span>

                <p>
                  ${escapeHtml(
                    analysis.editor_notes
                  )}
                </p>
              </div>
            `
            : ""
        }

        ${
          keywords.length
            ? `
              <div
                class="ez-ver-keywords"
              >

                ${keywords
                  .map(
                    keyword =>
                      `
                        <span>
                          ${escapeHtml(
                            keyword
                          )}
                        </span>
                      `
                  )
                  .join("")}

              </div>
            `
            : ""
        }

        ${
          social &&
          typeof social ===
            "object"
            ? `
              <div
                class="ez-ver-social"
              >

                ${
                  social.x
                    ? `
                      <div>
                        <span>
                          X
                        </span>

                        <p>
                          ${escapeHtml(
                            social.x
                          )}
                        </p>
                      </div>
                    `
                    : ""
                }

                ${
                  social.instagram
                    ? `
                      <div>
                        <span>
                          Instagram
                        </span>

                        <p>
                          ${escapeHtml(
                            social.instagram
                          )}
                        </p>
                      </div>
                    `
                    : ""
                }

              </div>
            `
            : ""
        }

      </div>
    `;
  }

  function bindEvents() {
    const search =
      document.querySelector(
        "#ez-ver-search"
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
        "#ez-ver-status"
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

    const risk =
      document.querySelector(
        "#ez-ver-risk"
      );

    if (risk) {
      risk.addEventListener(
        "change",
        event => {
          STATE.risk =
            event.target.value;
          render();
        }
      );
    }

    document
      .querySelectorAll(
        "[data-ver-select]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const item =
                STATE.items.find(
                  content =>
                    String(
                      content.id
                    ) ===
                    String(
                      button.dataset
                        .verSelect
                    )
                );

              if (item) {
                selectContent(
                  item
                );
              }
            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-ver-ai]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const item =
                STATE.items.find(
                  content =>
                    String(
                      content.id
                    ) ===
                    String(
                      button.dataset
                        .verAi
                    )
                );

              if (item) {
                analyzeContent(
                  item
                );
              }
            }
          );

        }
      );

    document
      .querySelectorAll(
        "[data-ver-approve]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .verApprove,
                "approve"
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-ver-review]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .verReview,
                "submit-review"
              )
          );

        }
      );

    const refresh =
      document.querySelector(
        '[data-ver-action="refresh"]'
      );

    if (refresh) {
      refresh.addEventListener(
        "click",
        loadContent
      );
    }

    document
      .querySelectorAll(
        "[data-ver-copy]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              if (
                button.dataset
                  .verCopy ===
                "article" &&
                STATE.selected
              ) {
                copyText(
                  [
                    STATE.selected
                      .title,
                    STATE.selected
                      .summary,
                    STATE.selected
                      .body
                  ]
                    .filter(Boolean)
                    .join(
                      "\n\n"
                    )
                );
              }

            }
          );

        }
      );
  }

  async function copyText(
    text
  ) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      showToast(
        "تم نسخ المحتوى."
      );
    } catch {
      showToast(
        "تعذر النسخ من الجهاز."
      );
    }
  }

  function showToast(
    message
  ) {
    let toast =
      document.querySelector(
        "#ez-ver-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-ver-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100000;
        max-width:370px;
        border:1px solid #bae6fd;
        border-radius:14px;
        background:#ffffff;
        color:#075985;
        padding:12px 15px;
        box-shadow:0 15px 45px rgba(7,89,133,.15);
        font-size:11px;
        font-weight:850;
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
        4500
      );
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-verification-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-verification-style";

    style.textContent = `
      #ez-admin-verification {
        direction:rtl;
      }

      .ez-verification {
        color:#0f172a;
      }

      .ez-ver-header {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:17px;
      }

      .ez-ver-header h2 {
        margin:0;
        color:#075985;
        font-size:27px;
        font-weight:950;
      }

      .ez-ver-header p {
        margin:7px 0 0;
        color:#64748b;
        font-size:13px;
      }

      .ez-ver-header-actions,
      .ez-ver-actions {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
      }

      .ez-ver-btn {
        border:1px solid #bae6fd;
        border-radius:12px;
        background:#fff;
        color:#0369a1;
        padding:9px 13px;
        cursor:pointer;
        font-size:10px;
        font-weight:900;
      }

      .ez-ver-btn.primary {
        border-color:transparent;
        color:#fff;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-ver-btn.danger {
        border-color:#fecdd3;
        color:#be123c;
        background:#fff1f2;
      }

      .ez-ver-layout {
        display:grid;
        grid-template-columns:320px minmax(0,1fr);
        gap:13px;
      }

      .ez-ver-sidebar {
        min-width:0;
      }

      .ez-ver-filters {
        display:grid;
        gap:7px;
        margin-bottom:9px;
      }

      .ez-ver-filters input,
      .ez-ver-filters select {
        width:100%;
        box-sizing:border-box;
        border:1px solid #bae6fd;
        border-radius:11px;
        outline:none;
        background:#fff;
        color:#0f172a;
        padding:10px;
        font-size:10px;
      }

      .ez-ver-list {
        display:grid;
        gap:7px;
        max-height:700px;
        overflow:auto;
      }

      .ez-ver-item {
        width:100%;
        border:1px solid #e0f2fe;
        border-radius:14px;
        background:#fff;
        padding:11px;
        text-align:right;
        cursor:pointer;
      }

      .ez-ver-item:hover,
      .ez-ver-item.selected {
        border-color:#38bdf8;
        background:#fafdff;
      }

      .ez-ver-item-top {
        display:flex;
        justify-content:space-between;
        gap:5px;
        margin-bottom:7px;
      }

      .ez-ver-item-top > span:first-child {
        color:#64748b;
        font-size:8px;
        font-weight:850;
      }

      .ez-ver-item strong {
        display:block;
        color:#334155;
        font-size:11px;
        line-height:1.6;
      }

      .ez-ver-item small {
        display:block;
        margin-top:5px;
        color:#94a3b8;
        font-size:8px;
      }

      .ez-ver-risk-low,
      .ez-ver-risk-medium,
      .ez-ver-risk-high,
      .ez-ver-risk-critical {
        display:inline-block;
        border-radius:999px;
        padding:4px 7px;
        font-size:8px;
        font-weight:900;
      }

      .ez-ver-risk-low {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-ver-risk-medium {
        background:#fffbeb;
        color:#a16207;
      }

      .ez-ver-risk-high {
        background:#fff7ed;
        color:#c2410c;
      }

      .ez-ver-risk-critical {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-ver-workspace {
        min-width:0;
      }

      .ez-ver-welcome {
        min-height:500px;
        display:grid;
        place-items:center;
        align-content:center;
        border:1px dashed #bae6fd;
        border-radius:19px;
        background:#fafdff;
        padding:30px;
        text-align:center;
      }

      .ez-ver-welcome-icon {
        width:65px;
        height:65px;
        display:grid;
        place-items:center;
        border-radius:20px;
        background:#eff6ff;
        color:#0284c7;
        font-size:30px;
        font-weight:950;
      }

      .ez-ver-welcome h3 {
        margin:15px 0 5px;
        color:#075985;
        font-size:18px;
      }

      .ez-ver-welcome p {
        max-width:450px;
        margin:0;
        color:#64748b;
        font-size:11px;
        line-height:1.8;
      }

      .ez-ver-article-header {
        display:flex;
        justify-content:space-between;
        gap:15px;
        align-items:flex-start;
        margin-bottom:12px;
      }

      .ez-ver-badges {
        display:flex;
        gap:6px;
        flex-wrap:wrap;
      }

      .ez-ver-badges > span:first-child {
        border-radius:999px;
        background:#eff6ff;
        color:#0369a1;
        padding:5px 8px;
        font-size:8px;
        font-weight:900;
      }

      .ez-ver-article-header h1 {
        margin:10px 0 5px;
        color:#075985;
        font-size:21px;
        line-height:1.6;
      }

      .ez-ver-meta {
        color:#94a3b8;
        font-size:9px;
      }

      .ez-ver-grid {
        display:grid;
        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          );
        gap:10px;
        margin-bottom:10px;
      }

      .ez-ver-panel {
        border:1px solid #e0f2fe;
        border-radius:17px;
        background:#fff;
        padding:14px;
      }

      .ez-ver-panel-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        margin-bottom:11px;
      }

      .ez-ver-panel-head h3 {
        margin:0;
        color:#075985;
        font-size:13px;
      }

      .ez-ver-panel-head > strong {
        color:#0284c7;
        font-size:18px;
      }

      .ez-ver-progress {
        height:7px;
        overflow:hidden;
        border-radius:999px;
        background:#e0f2fe;
        margin-bottom:12px;
      }

      .ez-ver-progress span {
        display:block;
        height:100%;
        border-radius:inherit;
        background:
          linear-gradient(
            90deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-ver-checklist {
        display:grid;
        gap:7px;
      }

      .ez-ver-check {
        display:flex;
        align-items:center;
        gap:9px;
        border-radius:11px;
        background:#f8fafc;
        padding:8px;
      }

      .ez-ver-check > span {
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        border-radius:8px;
        font-weight:950;
      }

      .ez-ver-check.passed > span {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-ver-check.failed > span {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-ver-check strong {
        display:block;
        color:#334155;
        font-size:10px;
      }

      .ez-ver-check small {
        display:block;
        margin-top:2px;
        color:#94a3b8;
        font-size:8px;
      }

      .ez-ver-risk-meter {
        border-radius:13px;
        background:#f8fafc;
        padding:12px;
        margin-bottom:9px;
      }

      .ez-ver-risk-meter > div {
        display:flex;
        justify-content:space-between;
        gap:8px;
      }

      .ez-ver-risk-meter span {
        color:#64748b;
        font-size:9px;
      }

      .ez-ver-risk-meter strong {
        color:#075985;
        font-size:12px;
      }

      .ez-ver-risk-list {
        display:grid;
        gap:6px;
      }

      .ez-ver-risk-list > div {
        border-radius:9px;
        background:#fff7ed;
        color:#c2410c;
        padding:8px;
        font-size:9px;
        font-weight:800;
      }

      .ez-ver-no-risk {
        background:#f8fafc !important;
        color:#94a3b8 !important;
      }

      .ez-ver-original {
        color:#334155;
      }

      .ez-ver-original h4 {
        margin:0 0 8px;
        color:#075985;
        font-size:14px;
        line-height:1.6;
      }

      .ez-ver-original p {
        margin:0 0 10px;
        color:#64748b;
        font-size:10px;
        line-height:1.8;
      }

      .ez-ver-body {
        max-height:300px;
        overflow:auto;
        border-radius:12px;
        background:#f8fafc;
        padding:11px;
        white-space:pre-wrap;
        color:#475569;
        font-size:10px;
        line-height:1.9;
      }

      .ez-ver-copy {
        border:1px solid #bae6fd;
        border-radius:9px;
        background:#fff;
        color:#0369a1;
        padding:6px 9px;
        cursor:pointer;
        font-size:8px;
        font-weight:900;
      }

      .ez-ver-ai-ready,
      .ez-ver-ai-wait {
        border-radius:999px;
        padding:5px 8px;
        font-size:8px;
        font-weight:900;
      }

      .ez-ver-ai-ready {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-ver-ai-wait {
        background:#f8fafc;
        color:#94a3b8;
      }

      .ez-ver-analysis {
        display:grid;
        gap:9px;
      }

      .ez-ver-analysis-block {
        border-radius:11px;
        background:#f8fafc;
        padding:10px;
      }

      .ez-ver-analysis-block span {
        display:block;
        color:#64748b;
        font-size:8px;
        font-weight:900;
      }

      .ez-ver-analysis-block strong {
        display:block;
        margin-top:4px;
        color:#075985;
        font-size:10px;
        line-height:1.7;
      }

      .ez-ver-analysis-block p {
        margin:5px 0 0;
        color:#475569;
        font-size:9px;
        line-height:1.8;
      }

      .ez-ver-keywords {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
      }

      .ez-ver-keywords span {
        border-radius:999px;
        background:#eff6ff;
        color:#0369a1;
        padding:5px 8px;
        font-size:8px;
        font-weight:850;
      }

      .ez-ver-social {
        display:grid;
        gap:7px;
      }

      .ez-ver-social > div {
        border:1px solid #e0f2fe;
        border-radius:11px;
        padding:9px;
      }

      .ez-ver-social span {
        color:#0284c7;
        font-size:9px;
        font-weight:950;
      }

      .ez-ver-social p {
        margin:5px 0 0;
        color:#475569;
        font-size:9px;
        line-height:1.7;
      }

      .ez-ver-ai-empty {
        min-height:180px;
        display:grid;
        place-items:center;
        border:1px dashed #bae6fd;
        border-radius:13px;
        background:#fafdff;
        color:#94a3b8;
        text-align:center;
        font-size:10px;
        line-height:1.8;
      }

      .ez-ver-sources {
        display:grid;
        gap:7px;
      }

      .ez-ver-sources a {
        overflow:hidden;
        border-radius:10px;
        background:#eff6ff;
        color:#0369a1;
        padding:9px;
        text-decoration:none;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:9px;
      }

      .ez-ver-no-source {
        border-radius:10px;
        background:#fff7ed;
        color:#c2410c;
        padding:10px;
        font-size:9px;
        font-weight:800;
      }

      .ez-ver-last {
        margin-top:10px;
        color:#94a3b8;
        text-align:center;
        font-size:8px;
      }

      @media (max-width:1000px) {
        .ez-ver-layout {
          grid-template-columns:1fr;
        }

        .ez-ver-list {
          max-height:350px;
        }

        .ez-ver-grid {
          grid-template-columns:1fr;
        }
      }

      @media (max-width:650px) {
        .ez-ver-article-header {
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
        "#verification-section"
      ) ||
      document.querySelector(
        "#admin-verification-section"
      ) ||
      document.querySelector(
        '[data-admin-section="verification"]'
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
      "admin-verification-section";

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
    createMount();

    render();

    loadContent();
  }

  window.EZMediaAdminVerification =
    {
      initialize,

      refresh:
        loadContent,

      analyze:
        analyzeContent,

      select:
        selectContent,

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
