"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    content: "/api/content",
    analyze: "/api/ai/content"
  };

  const CONTENT_TYPES = {
    news: "خبر",
    report: "تقرير",
    interview: "مقابلة",
    video: "فيديو",
    coverage: "تغطية",
    breaking: "عاجل"
  };

  const STATUS = {
    draft: "مسودة",
    review: "مراجعة",
    approved: "معتمد",
    scheduled: "مجدول",
    published: "منشور",
    archived: "مؤرشف"
  };

  const PRIORITIES = {
    low: "منخفض",
    normal: "عادي",
    high: "مرتفع",
    urgent: "عاجل"
  };

  const state = {
    items: [],
    selected: null,
    search: "",
    type: "all",
    status: "all",
    priority: "all",
    sort: "latest",
    loading: false,
    editing: false,
    aiLoading: false,
    lastUpdate: null
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

  function getToken() {
    return (
      window.EZMediaAdminCore?.getToken?.() ||
      localStorage.getItem(
        "ez_media_admin_token"
      ) ||
      null
    );
  }

  async function request(
    url,
    options = {}
  ) {
    const headers = {
      "Content-Type":
        "application/json",
      ...(options.headers || {})
    };

    const token =
      getToken();

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    const response =
      await fetch(
        url,
        {
          ...options,
          headers
        }
      );

    const text =
      await response.text();

    let data = null;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok) {
      const error =
        new Error(
          data?.message ||
          data?.error ||
          `HTTP ${response.status}`
        );

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    return data;
  }

  function formatDate(
    value
  ) {
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

  function uid() {
    return (
      "local_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 8)
    );
  }

  function normalizeItem(
    item
  ) {
    return {
      ...item,

      id:
        item.id ||
        item.content_id ||
        item.contentId ||
        uid(),

      title:
        item.title ||
        item.headline ||
        "",

      summary:
        item.summary ||
        item.excerpt ||
        "",

      body:
        item.body ||
        item.content ||
        "",

      type:
        item.type ||
        item.content_type ||
        "news",

      status:
        item.status ||
        "draft",

      priority:
        item.priority ||
        item.metadata?.priority ||
        "normal",

      category:
        item.category ||
        "",

      author:
        item.author ||
        item.created_by_name ||
        item.createdByName ||
        "",

      createdAt:
        item.created_at ||
        item.createdAt ||
        item.createdAtUtc ||
        null,

      updatedAt:
        item.updated_at ||
        item.updatedAt ||
        null,

      publishedAt:
        item.published_at ||
        item.publishedAt ||
        null,

      scheduledAt:
        item.scheduled_at ||
        item.scheduledAt ||
        null,

      tags:
        Array.isArray(item.tags)
          ? item.tags
          : [],

      media:
        Array.isArray(item.media)
          ? item.media
          : [],

      ai:
        item.ai ||
        item.ai_analysis ||
        null
    };
  }

  async function loadContent() {
    state.loading =
      true;

    render();

    try {
      const params =
        new URLSearchParams();

      params.set(
        "limit",
        "100"
      );

      if (
        state.status !==
        "all"
      ) {
        params.set(
          "status",
          state.status
        );
      }

      if (
        state.type !==
        "all"
      ) {
        params.set(
          "type",
          state.type
        );
      }

      const data =
        await request(
          `${API.content}?${params.toString()}`
        );

      const list =
        Array.isArray(data)
          ? data
          : data?.items ||
            data?.content ||
            data?.rows ||
            [];

      state.items =
        list.map(
          normalizeItem
        );

      state.lastUpdate =
        new Date();
    } catch (error) {
      console.error(
        "EZ MEDIA content intelligence:",
        error
      );

      showToast(
        "تعذر تحميل المحتوى من CMS."
      );
    } finally {
      state.loading =
        false;

      render();
    }
  }

  function filteredItems() {
    let items =
      [...state.items];

    if (
      state.search
    ) {
      const q =
        state.search
          .trim()
          .toLowerCase();

      items =
        items.filter(
          item => {

            const text =
              [
                item.title,
                item.summary,
                item.body,
                item.category,
                item.author,
                ...(item.tags || [])
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return text.includes(
              q
            );
          }
        );
    }

    if (
      state.priority !==
      "all"
    ) {
      items =
        items.filter(
          item =>
            item.priority ===
            state.priority
        );
    }

    items.sort(
      (a, b) => {

        if (
          state.sort ===
          "oldest"
        ) {
          return (
            new Date(
              a.updatedAt ||
                a.createdAt ||
                0
            ) -
            new Date(
              b.updatedAt ||
                b.createdAt ||
                0
            )
          );
        }

        if (
          state.sort ===
          "priority"
        ) {
          const rank = {
            urgent: 4,
            high: 3,
            normal: 2,
            low: 1
          };

          return (
            (rank[
              b.priority
            ] || 0) -
            (rank[
              a.priority
            ] || 0)
          );
        }

        return (
          new Date(
            b.updatedAt ||
              b.createdAt ||
              0
          ) -
          new Date(
            a.updatedAt ||
              a.createdAt ||
              0
          )
        );
      }
    );

    return items;
  }

  function metrics() {
    const items =
      state.items;

    return {
      total:
        items.length,

      drafts:
        items.filter(
          item =>
            item.status ===
            "draft"
        ).length,

      review:
        items.filter(
          item =>
            item.status ===
            "review"
        ).length,

      published:
        items.filter(
          item =>
            item.status ===
            "published"
        ).length,

      urgent:
        items.filter(
          item =>
            item.priority ===
            "urgent"
        ).length
    };
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

    const items =
      filteredItems();

    mount.innerHTML = `
      <div
        class="ez-content-intel"
      >

        <header
          class="ez-content-intel-head"
        >

          <div>

            <span
              class="ez-ci-kicker"
            >
              EZ MEDIA CONTENT INTELLIGENCE
            </span>

            <h2>
              مركز المحتوى الذكي
            </h2>

            <p>
              التحكم في دورة حياة المحتوى من المسودة إلى المراجعة والاعتماد والجدولة والنشر، مع الذكاء الاصطناعي كمساعد تحريري.
            </p>

          </div>

          <div
            class="ez-ci-actions"
          >

            <button
              class="ez-ci-btn primary"
              data-ci-new
            >
              إنشاء محتوى
            </button>

            <button
              class="ez-ci-btn"
              data-ci-refresh
            >
              تحديث
            </button>

          </div>

        </header>

        <section
          class="ez-ci-metrics"
        >

          ${metric(
            "إجمالي المحتوى",
            m.total
          )}

          ${metric(
            "مسودات",
            m.drafts
          )}

          ${metric(
            "قيد المراجعة",
            m.review
          )}

          ${metric(
            "منشور",
            m.published
          )}

          ${metric(
            "عاجل",
            m.urgent
          )}

        </section>

        <section
          class="ez-ci-panel"
        >

          <div
            class="ez-ci-toolbar"
          >

            <input
              id="ez-ci-search"
              type="search"
              placeholder="ابحث في المحتوى..."
              value="${escapeHtml(
                state.search
              )}"
            />

            <select
              id="ez-ci-type"
            >

              <option
                value="all"
              >
                كل الأنواع
              </option>

              ${Object.entries(
                CONTENT_TYPES
              )
                .map(
                  ([key, label]) =>
                    `
                      <option
                        value="${key}"
                        ${
                          state.type ===
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
              id="ez-ci-status"
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

            <select
              id="ez-ci-priority"
            >

              <option
                value="all"
              >
                كل الأولويات
              </option>

              ${Object.entries(
                PRIORITIES
              )
                .map(
                  ([key, label]) =>
                    `
                      <option
                        value="${key}"
                        ${
                          state.priority ===
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
              id="ez-ci-sort"
            >

              <option
                value="latest"
                ${
                  state.sort ===
                  "latest"
                    ? "selected"
                    : ""
                }
              >
                الأحدث
              </option>

              <option
                value="oldest"
                ${
                  state.sort ===
                  "oldest"
                    ? "selected"
                    : ""
                }
              >
                الأقدم
              </option>

              <option
                value="priority"
                ${
                  state.sort ===
                  "priority"
                    ? "selected"
                    : ""
                }
              >
                الأولوية
              </option>

            </select>

          </div>

          ${
            state.loading
              ? `
                <div
                  class="ez-ci-loading"
                >
                  جارٍ تحميل المحتوى...
                </div>
              `
              : ""
          }

          <div
            class="ez-ci-list"
          >

            ${
              items.length
                ? items
                    .map(
                      renderItem
                    )
                    .join("")
                : `
                  <div
                    class="ez-ci-empty"
                  >
                    لا توجد مواد مطابقة.
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
          class="ez-ci-footer"
        >
          EZ MEDIA ${VERSION}
          •
          ${
            state.lastUpdate
              ? formatDate(
                  state.lastUpdate
                )
              : "جاهز"
          }
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
        class="ez-ci-metric"
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

  function renderItem(
    item
  ) {
    const ai =
      item.ai;

    return `
      <article
        class="ez-ci-card"
      >

        <div
          class="ez-ci-card-main"
        >

          <button
            class="ez-ci-title"
            data-ci-view="${escapeHtml(
              item.id
            )}"
          >

            <span
              class="ez-ci-type"
            >
              ${
                CONTENT_TYPES[
                  item.type
                ] ||
                item.type
              }
            </span>

            <strong>
              ${escapeHtml(
                item.title ||
                "بدون عنوان"
              )}
            </strong>

            ${
              item.summary
                ? `
                  <small>
                    ${escapeHtml(
                      item.summary
                    )}
                  </small>
                `
                : ""
            }

          </button>

          <div
            class="ez-ci-badges"
          >

            <span
              class="ez-ci-status-${escapeHtml(
                item.status
              )}"
            >
              ${
                STATUS[
                  item.status
                ] ||
                item.status
              }
            </span>

            <span
              class="ez-ci-priority-${escapeHtml(
                item.priority
              )}"
            >
              ${
                PRIORITIES[
                  item.priority
                ] ||
                item.priority
              }
            </span>

            ${
              ai
                ? `
                  <span
                    class="ez-ci-ai"
                  >
                    AI
                  </span>
                `
                : ""
            }

          </div>

        </div>

        <div
          class="ez-ci-card-meta"
        >

          <span>
            القسم:
            <strong>
              ${escapeHtml(
                item.category ||
                "غير محدد"
              )}
            </strong>
          </span>

          <span>
            الكاتب:
            <strong>
              ${escapeHtml(
                item.author ||
                "غير محدد"
              )}
            </strong>
          </span>

          <span>
            آخر تعديل:
            <strong>
              ${formatDate(
                item.updatedAt ||
                item.createdAt
              )}
            </strong>
          </span>

        </div>

        <div
          class="ez-ci-card-actions"
        >

          <button
            data-ci-edit="${escapeHtml(
              item.id
            )}"
          >
            تحرير
          </button>

          <button
            data-ci-ai="${escapeHtml(
              item.id
            )}"
          >
            تحليل AI
          </button>

          ${
            item.status ===
            "draft"
              ? `
                <button
                  data-ci-review="${escapeHtml(
                    item.id
                  )}"
                >
                  إرسال للمراجعة
                </button>
              `
              : ""
          }

          ${
            item.status ===
            "review"
              ? `
                <button
                  data-ci-approve="${escapeHtml(
                    item.id
                  )}"
                >
                  اعتماد
                </button>
              `
              : ""
          }

          ${
            item.status ===
            "approved" ||
            item.status ===
            "scheduled"
              ? `
                <button
                  class="primary"
                  data-ci-publish="${escapeHtml(
                    item.id
                  )}"
                >
                  نشر
                </button>
              `
              : ""
          }

        </div>

      </article>
    `;
  }

  function renderEditor() {
    const item =
      state.selected ||
      {
        id: "",
        title: "",
        summary: "",
        body: "",
        type: "news",
        status: "draft",
        priority: "normal",
        category: "",
        tags: []
      };

    return `
      <div
        class="ez-ci-overlay"
      >

        <section
          class="ez-ci-editor"
        >

          <header
            class="ez-ci-editor-head"
          >

            <div>
              <span>
                CONTENT STUDIO
              </span>

              <h3>
                ${
                  item.id
                    ? "تحرير المادة"
                    : "إنشاء مادة جديدة"
                }
              </h3>
            </div>

            <button
              data-ci-close
            >
              إغلاق
            </button>

          </header>

          <form
            id="ez-ci-form"
          >

            <input
              type="hidden"
              name="id"
              value="${escapeHtml(
                item.id
              )}"
            />

            <div
              class="ez-ci-form-grid"
            >

              <label>
                <span>
                  نوع المحتوى
                </span>

                <select
                  name="type"
                >

                  ${Object.entries(
                    CONTENT_TYPES
                  )
                    .map(
                      ([key, label]) =>
                        `
                          <option
                            value="${key}"
                            ${
                              item.type ===
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

              <label>
                <span>
                  الأولوية
                </span>

                <select
                  name="priority"
                >

                  ${Object.entries(
                    PRIORITIES
                  )
                    .map(
                      ([key, label]) =>
                        `
                          <option
                            value="${key}"
                            ${
                              item.priority ===
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

              <label
                class="full"
              >

                <span>
                  العنوان
                </span>

                <input
                  name="title"
                  required
                  value="${escapeHtml(
                    item.title
                  )}"
                  placeholder="عنوان المادة..."
                />

              </label>

              <label
                class="full"
              >

                <span>
                  الملخص
                </span>

                <textarea
                  name="summary"
                  rows="3"
                  placeholder="الملخص التحريري..."
                >${escapeHtml(
                  item.summary
                )}</textarea>

              </label>

              <label>
                <span>
                  القسم
                </span>

                <input
                  name="category"
                  value="${escapeHtml(
                    item.category
                  )}"
                  placeholder="الأخبار، التقنية..."
                />
              </label>

              <label>
                <span>
                  الكلمات المفتاحية
                </span>

                <input
                  name="tags"
                  value="${escapeHtml(
                    (item.tags || [])
                      .join(", ")
                  )}"
                  placeholder="السعودية، اقتصاد..."
                />
              </label>

              <label
                class="full"
              >

                <span>
                  النص
                </span>

                <textarea
                  name="body"
                  rows="10"
                  placeholder="محتوى المادة..."
                >${escapeHtml(
                  item.body
                )}</textarea>

              </label>

            </div>

            <div
              class="ez-ci-editor-actions"
            >

              <button
                type="button"
                data-ci-close
              >
                إلغاء
              </button>

              <button
                type="submit"
                class="primary"
              >
                حفظ المحتوى
              </button>

            </div>

          </form>

        </section>

      </div>
    `;
  }

  function renderDetails() {
    const item =
      state.selected;

    if (!item) {
      return "";
    }

    const ai =
      item.ai;

    return `
      <section
        class="ez-ci-details"
      >

        <header
          class="ez-ci-details-head"
        >

          <div>
            <span>
              CONTENT INTELLIGENCE
            </span>

            <h3>
              ${escapeHtml(
                item.title ||
                "بدون عنوان"
              )}
            </h3>
          </div>

          <button
            data-ci-details-close
          >
            إغلاق
          </button>

        </header>

        <div
          class="ez-ci-detail-grid"
        >

          ${detail(
            "النوع",
            CONTENT_TYPES[
              item.type
            ] ||
              item.type
          )}

          ${detail(
            "الحالة",
            STATUS[
              item.status
            ] ||
              item.status
          )}

          ${detail(
            "الأولوية",
            PRIORITIES[
              item.priority
            ] ||
              item.priority
          )}

          ${detail(
            "القسم",
            item.category ||
              "غير محدد"
          )}

          ${detail(
            "الكاتب",
            item.author ||
              "غير محدد"
          )}

          ${detail(
            "آخر تعديل",
            formatDate(
              item.updatedAt ||
              item.createdAt
            )
          )}

        </div>

        ${
          item.summary
            ? `
              <div
                class="ez-ci-summary"
              >
                ${escapeHtml(
                  item.summary
                )}
              </div>
            `
            : ""
        }

        ${
          item.body
            ? `
              <div
                class="ez-ci-body"
              >
                ${escapeHtml(
                  item.body
                )}
              </div>
            `
            : ""
        }

        ${
          item.tags?.length
            ? `
              <div
                class="ez-ci-tags"
              >

                ${item.tags
                  .map(
                    tag =>
                      `
                        <span>
                          ${escapeHtml(
                            tag
                          )}
                        </span>
                      `
                  )
                  .join("")}

              </div>
            `
            : ""
        }

        <div
          class="ez-ci-ai-box"
        >

          <div
            class="ez-ci-ai-head"
          >
            <strong>
              تحليل الذكاء الاصطناعي
            </strong>

            <button
              data-ci-ai="${escapeHtml(
                item.id
              )}"
            >
              تحليل الآن
            </button>
          </div>

          ${
            ai
              ? renderAI(
                  ai
                )
              : `
                <p>
                  لم يتم تشغيل تحليل AI لهذه المادة بعد.
                </p>
              `
          }

        </div>

      </section>
    `;
  }

  function renderAI(
    ai
  ) {
    const confidence =
      ai.confidence ??
      ai.score ??
      null;

    return `
      <div
        class="ez-ci-ai-content"
      >

        ${
          ai.headline
            ? detail(
                "اقتراح العنوان",
                ai.headline
              )
            : ""
        }

        ${
          ai.category
            ? detail(
                "التصنيف",
                ai.category
              )
            : ""
        }

        ${
          confidence !== null
            ? detail(
                "الثقة",
                `${confidence}%`
              )
            : ""
        }

        ${
          ai.summary
            ? `
              <div
                class="ez-ci-ai-text"
              >
                <strong>
                  الملخص
                </strong>

                <p>
                  ${escapeHtml(
                    ai.summary
                  )}
                </p>
              </div>
            `
            : ""
        }

        ${
          Array.isArray(
            ai.keywords
          )
            ? `
              <div
                class="ez-ci-tags"
              >
                ${ai.keywords
                  .map(
                    item =>
                      `
                        <span>
                          ${escapeHtml(
                            item
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
          Array.isArray(
            ai.risk_flags
          ) &&
          ai.risk_flags.length
            ? `
              <div
                class="ez-ci-risks"
              >

                <strong>
                  إشارات المخاطر
                </strong>

                ${ai.risk_flags
                  .map(
                    risk =>
                      `
                        <span>
                          ${escapeHtml(
                            typeof risk ===
                            "string"
                              ? risk
                              : JSON.stringify(
                                  risk
                                )
                          )}
                        </span>
                      `
                  )
                  .join("")}

              </div>
            `
            : ""
        }

      </div>
    `;
  }

  function detail(
    label,
    value
  ) {
    return `
      <div
        class="ez-ci-detail"
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

  async function createOrUpdate(
    form
  ) {
    const data =
      new FormData(
        form
      );

    const id =
      data.get("id");

    const payload = {
      title:
        String(
          data.get("title") ||
            ""
        ).trim(),

      headline:
        String(
          data.get("title") ||
            ""
        ).trim(),

      summary:
        String(
          data.get(
            "summary"
          ) ||
            ""
        ).trim(),

      body:
        String(
          data.get("body") ||
            ""
        ),

      content:
        String(
          data.get("body") ||
            ""
        ),

      type:
        String(
          data.get("type") ||
            "news"
        ),

      priority:
        String(
          data.get(
            "priority"
          ) ||
            "normal"
        ),

      category:
        String(
          data.get(
            "category"
          ) ||
            ""
        ).trim(),

      tags:
        String(
          data.get("tags") ||
            ""
        )
          .split(",")
          .map(
            tag =>
              tag.trim()
          )
          .filter(Boolean)
    };

    if (!payload.title) {
      showToast(
        "العنوان مطلوب."
      );

      return;
    }

    try {
      state.loading =
        true;

      render();

      if (id) {
        await request(
          `${API.content}/${encodeURIComponent(
            id
          )}`,
          {
            method: "PATCH",
            body:
              JSON.stringify(
                payload
              )
          }
        );
      } else {
        await request(
          API.content,
          {
            method: "POST",
            body:
              JSON.stringify(
                payload
              )
          }
        );
      }

      state.editing =
        false;

      state.selected =
        null;

      state.lastUpdate =
        new Date();

      showToast(
        "تم حفظ المحتوى بنجاح."
      );

      await loadContent();
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر حفظ المحتوى: ${
          error.message
        }`
      );

      state.loading =
        false;

      render();
    }
  }

  async function analyze(
    id
  ) {
    if (
      state.aiLoading
    ) {
      return;
    }

    const item =
      state.items.find(
        content =>
          String(
            content.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    state.aiLoading =
      true;

    showToast(
      "جارٍ تحليل المادة بالذكاء الاصطناعي..."
    );

    try {
      const data =
        await request(
          `${API.analyze}/${encodeURIComponent(
            id
          )}/analyze`,
          {
            method: "POST"
          }
        );

      const analysis =
        data?.analysis ||
        data?.result ||
        data?.data ||
        data;

      item.ai =
        analysis;

      if (
        state.selected &&
        String(
          state.selected.id
        ) ===
          String(id)
      ) {
        state.selected =
          item;
      }

      showToast(
        "اكتمل تحليل الذكاء الاصطناعي."
      );

      state.lastUpdate =
        new Date();

      render();
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر تحليل المادة: ${
          error.message
        }`
      );
    } finally {
      state.aiLoading =
        false;
    }
  }

  async function changeStatus(
    id,
    action
  ) {
    const endpoints = {
      review:
        "submit-review",
      approve:
        "approve",
      publish:
        "publish"
    };

    const endpoint =
      endpoints[action];

    if (!endpoint) {
      return;
    }

    try {
      await request(
        `${API.content}/${encodeURIComponent(
          id
        )}/${endpoint}`,
        {
          method: "POST"
        }
      );

      showToast(
        action ===
          "review"
          ? "تم إرسال المادة للمراجعة."
          : action ===
            "approve"
          ? "تم اعتماد المادة."
          : "تم نشر المادة."
      );

      state.selected =
        null;

      await loadContent();
    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر تنفيذ الإجراء: ${
          error.message
        }`
      );
    }
  }

  function openNew() {
    state.selected =
      null;

    state.editing =
      true;

    render();
  }

  function openEdit(
    id
  ) {
    const item =
      state.items.find(
        content =>
          String(
            content.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    state.selected =
      item;

    state.editing =
      true;

    render();
  }

  function openDetails(
    id
  ) {
    const item =
      state.items.find(
        content =>
          String(
            content.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    state.selected =
      item;

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

  function bindEvents() {
    document
      .querySelector(
        "[data-ci-new]"
      )
      ?.addEventListener(
        "click",
        openNew
      );

    document
      .querySelector(
        "[data-ci-refresh]"
      )
      ?.addEventListener(
        "click",
        loadContent
      );

    document
      .querySelector(
        "#ez-ci-search"
      )
      ?.addEventListener(
        "input",
        event => {
          state.search =
            event.target.value;

          render();
        }
      );

    document
      .querySelector(
        "#ez-ci-type"
      )
      ?.addEventListener(
        "change",
        event => {
          state.type =
            event.target.value;

          loadContent();
        }
      );

    document
      .querySelector(
        "#ez-ci-status"
      )
      ?.addEventListener(
        "change",
        event => {
          state.status =
            event.target.value;

          loadContent();
        }
      );

    document
      .querySelector(
        "#ez-ci-priority"
      )
      ?.addEventListener(
        "change",
        event => {
          state.priority =
            event.target.value;

          render();
        }
      );

    document
      .querySelector(
        "#ez-ci-sort"
      )
      ?.addEventListener(
        "change",
        event => {
          state.sort =
            event.target.value;

          render();
        }
      );

    document
      .querySelectorAll(
        "[data-ci-view]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              openDetails(
                button.dataset
                  .ciView
              )
          )
      );

    document
      .querySelectorAll(
        "[data-ci-edit]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              openEdit(
                button.dataset
                  .ciEdit
              )
          )
      );

    document
      .querySelectorAll(
        "[data-ci-ai]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              analyze(
                button.dataset
                  .ciAi
              )
          )
      );

    document
      .querySelectorAll(
        "[data-ci-review]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .ciReview,
                "review"
              )
          )
      );

    document
      .querySelectorAll(
        "[data-ci-approve]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .ciApprove,
                "approve"
              )
          )
      );

    document
      .querySelectorAll(
        "[data-ci-publish]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .ciPublish,
                "publish"
              )
          )
      );

    document
      .querySelectorAll(
        "[data-ci-close]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            closeEditor
          )
      );

    document
      .querySelector(
        "[data-ci-details-close]"
      )
      ?.addEventListener(
        "click",
        () => {
          state.selected =
            null;

          render();
        }
      );

    document
      .querySelector(
        "#ez-ci-form"
      )
      ?.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          createOrUpdate(
            event.currentTarget
          );
        }
      );
  }

  function showToast(
    message
  ) {
    let toast =
      document.querySelector(
        "#ez-ci-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-ci-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100000;
        max-width:440px;
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
        "ez-admin-content-intelligence-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-content-intelligence-style";

    style.textContent = `
      #content-intelligence-section,
      #admin-content-intelligence-section {
        direction:rtl;
      }

      .ez-content-intel {
        color:#0f172a;
      }

      .ez-content-intel-head {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:15px;
      }

      .ez-ci-kicker {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
        letter-spacing:.08em;
      }

      .ez-content-intel-head h2 {
        margin:5px 0;
        color:#075985;
        font-size:27px;
        font-weight:950;
      }

      .ez-content-intel-head p {
        max-width:800px;
        margin:0;
        color:#64748b;
        font-size:11px;
        line-height:1.8;
      }

      .ez-ci-actions {
        display:flex;
        gap:7px;
      }

      .ez-ci-btn {
        border:1px solid #bae6fd;
        border-radius:11px;
        background:#fff;
        color:#0369a1;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-ci-btn.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-ci-metrics {
        display:grid;
        grid-template-columns:
          repeat(5,minmax(0,1fr));
        gap:9px;
        margin-bottom:10px;
      }

      .ez-ci-metric {
        border:1px solid #e0f2fe;
        border-radius:15px;
        background:#fff;
        padding:13px;
      }

      .ez-ci-metric span {
        display:block;
        color:#64748b;
        font-size:8px;
        font-weight:850;
      }

      .ez-ci-metric strong {
        display:block;
        margin-top:4px;
        color:#075985;
        font-size:23px;
        font-weight:950;
      }

      .ez-ci-panel {
        border:1px solid #e0f2fe;
        border-radius:17px;
        background:#fff;
        padding:13px;
      }

      .ez-ci-toolbar {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
        margin-bottom:11px;
      }

      .ez-ci-toolbar input,
      .ez-ci-toolbar select {
        border:1px solid #bae6fd;
        border-radius:10px;
        background:#fff;
        color:#334155;
        outline:none;
        padding:9px;
        font-size:9px;
      }

      .ez-ci-toolbar input {
        flex:1;
        min-width:210px;
      }

      .ez-ci-list {
        display:grid;
        gap:8px;
      }

      .ez-ci-card {
        border:1px solid #e0f2fe;
        border-radius:14px;
        background:
          linear-gradient(
            135deg,
            #fff,
            #f8fdff
          );
        padding:12px;
      }

      .ez-ci-card-main {
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
      }

      .ez-ci-title {
        border:0;
        background:transparent;
        padding:0;
        cursor:pointer;
        text-align:right;
      }

      .ez-ci-type {
        display:inline-block;
        margin-bottom:5px;
        color:#0284c7;
        font-size:7px;
        font-weight:950;
      }

      .ez-ci-title strong {
        display:block;
        color:#075985;
        font-size:11px;
      }

      .ez-ci-title small {
        display:block;
        max-width:760px;
        margin-top:5px;
        color:#64748b;
        font-size:8px;
        line-height:1.7;
      }

      .ez-ci-badges {
        display:flex;
        gap:4px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .ez-ci-status-draft,
      .ez-ci-status-review,
      .ez-ci-status-approved,
      .ez-ci-status-scheduled,
      .ez-ci-status-published,
      .ez-ci-status-archived,
      .ez-ci-priority-low,
      .ez-ci-priority-normal,
      .ez-ci-priority-high,
      .ez-ci-priority-urgent,
      .ez-ci-ai {
        border-radius:999px;
        padding:5px 7px;
        font-size:6px;
        font-weight:950;
      }

      .ez-ci-status-draft {
        background:#f8fafc;
        color:#64748b;
      }

      .ez-ci-status-review {
        background:#eff6ff;
        color:#0369a1;
      }

      .ez-ci-status-approved {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-ci-status-scheduled {
        background:#f0fdfa;
        color:#0f766e;
      }

      .ez-ci-status-published {
        background:#ecfeff;
        color:#0e7490;
      }

      .ez-ci-status-archived {
        background:#f8fafc;
        color:#94a3b8;
      }

      .ez-ci-priority-low {
        background:#f0fdf4;
        color:#15803d;
      }

      .ez-ci-priority-normal {
        background:#f8fafc;
        color:#64748b;
      }

      .ez-ci-priority-high {
        background:#fff7ed;
        color:#c2410c;
      }

      .ez-ci-priority-urgent {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-ci-ai {
        background:#f0f9ff;
        color:#0284c7;
      }

      .ez-ci-card-meta {
        display:flex;
        gap:14px;
        flex-wrap:wrap;
        margin-top:10px;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-ci-card-meta strong {
        color:#0369a1;
      }

      .ez-ci-card-actions {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        margin-top:10px;
      }

      .ez-ci-card-actions button {
        border:1px solid #e0f2fe;
        border-radius:8px;
        background:#fff;
        color:#0369a1;
        padding:6px 8px;
        cursor:pointer;
        font-size:7px;
        font-weight:900;
      }

      .ez-ci-card-actions button.primary {
        border-color:transparent;
        background:#0284c7;
        color:#fff;
      }

      .ez-ci-loading {
        margin-bottom:8px;
        border-radius:10px;
        background:#eff6ff;
        color:#0369a1;
        padding:9px;
        font-size:8px;
      }

      .ez-ci-empty {
        padding:40px;
        color:#94a3b8;
        text-align:center;
        font-size:9px;
      }

      .ez-ci-overlay {
        position:fixed;
        inset:0;
        z-index:90000;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(240,249,255,.82);
        backdrop-filter:blur(8px);
      }

      .ez-ci-editor {
        width:min(820px,100%);
        max-height:91vh;
        overflow:auto;
        border:1px solid #bae6fd;
        border-radius:20px;
        background:#fff;
        padding:17px;
        box-shadow:0 25px 80px rgba(7,89,133,.16);
      }

      .ez-ci-editor-head,
      .ez-ci-details-head {
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
        margin-bottom:15px;
      }

      .ez-ci-editor-head span,
      .ez-ci-details-head span {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-ci-editor-head h3,
      .ez-ci-details-head h3 {
        margin:4px 0 0;
        color:#075985;
        font-size:17px;
      }

      .ez-ci-editor-head button,
      .ez-ci-details-head button {
        border:1px solid #e0f2fe;
        border-radius:9px;
        background:#fff;
        color:#64748b;
        padding:7px 10px;
        cursor:pointer;
        font-size:8px;
      }

      .ez-ci-form-grid {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:9px;
      }

      .ez-ci-form-grid label {
        display:grid;
        gap:5px;
      }

      .ez-ci-form-grid label.full {
        grid-column:1/-1;
      }

      .ez-ci-form-grid label span {
        color:#64748b;
        font-size:8px;
        font-weight:900;
      }

      .ez-ci-form-grid input,
      .ez-ci-form-grid select,
      .ez-ci-form-grid textarea {
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

      .ez-ci-editor-actions {
        display:flex;
        justify-content:flex-end;
        gap:7px;
        margin-top:13px;
      }

      .ez-ci-editor-actions button {
        border:1px solid #e0f2fe;
        border-radius:10px;
        background:#fff;
        color:#64748b;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-ci-editor-actions button.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-ci-details {
        margin-top:10px;
        border:1px solid #bae6fd;
        border-radius:17px;
        background:#fff;
        padding:14px;
      }

      .ez-ci-detail-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .ez-ci-detail {
        border-radius:10px;
        background:#f8fafc;
        padding:9px;
      }

      .ez-ci-detail span {
        display:block;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-ci-detail strong {
        display:block;
        margin-top:3px;
        color:#075985;
        font-size:9px;
      }

      .ez-ci-summary,
      .ez-ci-body {
        margin-top:10px;
        border-radius:11px;
        background:#f8fdff;
        color:#475569;
        padding:11px;
        font-size:9px;
        line-height:1.9;
        white-space:pre-wrap;
      }

      .ez-ci-body {
        min-height:100px;
      }

      .ez-ci-tags {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        margin-top:9px;
      }

      .ez-ci-tags span {
        border-radius:999px;
        background:#eff6ff;
        color:#0369a1;
        padding:5px 7px;
        font-size:7px;
        font-weight:850;
      }

      .ez-ci-ai-box {
        margin-top:12px;
        border:1px solid #bae6fd;
        border-radius:13px;
        background:#f8fdff;
        padding:11px;
      }

      .ez-ci-ai-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      }

      .ez-ci-ai-head strong {
        color:#075985;
        font-size:9px;
      }

      .ez-ci-ai-head button {
        border:0;
        border-radius:8px;
        background:#0284c7;
        color:#fff;
        padding:6px 8px;
        cursor:pointer;
        font-size:7px;
        font-weight:900;
      }

      .ez-ci-ai-box p {
        color:#94a3b8;
        font-size:8px;
      }

      .ez-ci-ai-content {
        margin-top:9px;
      }

      .ez-ci-ai-text {
        margin-top:8px;
        border-radius:9px;
        background:#fff;
        padding:9px;
      }

      .ez-ci-ai-text strong {
        color:#075985;
        font-size:8px;
      }

      .ez-ci-ai-text p {
        color:#475569;
        line-height:1.8;
        font-size:8px;
      }

      .ez-ci-risks {
        margin-top:8px;
        border-radius:9px;
        background:#fff1f2;
        padding:9px;
      }

      .ez-ci-risks strong {
        display:block;
        color:#be123c;
        font-size:8px;
      }

      .ez-ci-risks span {
        display:block;
        margin-top:4px;
        color:#9f1239;
        font-size:7px;
      }

      .ez-ci-footer {
        margin-top:9px;
        color:#94a3b8;
        text-align:center;
        font-size:7px;
      }

      @media (max-width:900px) {
        .ez-ci-metrics {
          grid-template-columns:
            repeat(3,1fr);
        }
      }

      @media (max-width:650px) {
        .ez-ci-metrics,
        .ez-ci-form-grid,
        .ez-ci-detail-grid {
          grid-template-columns:1fr;
        }

        .ez-ci-form-grid label.full {
          grid-column:auto;
        }

        .ez-ci-card-main {
          flex-direction:column;
        }

        .ez-ci-badges {
          justify-content:flex-start;
        }

        .ez-ci-toolbar {
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
        "#content-intelligence-section"
      ) ||
      document.querySelector(
        "#admin-content-intelligence-section"
      ) ||
      document.querySelector(
        '[data-admin-section="content-intelligence"]'
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
      "admin-content-intelligence-section";

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

  async function initialize() {
    createMount();

    render();

    await loadContent();
  }

  window.EZMediaAdminContentIntelligence =
    {
      initialize,

      refresh:
        loadContent,

      newContent:
        openNew,

      analyze,

      getState() {
        return {
          ...state,
          items: [
            ...state.items
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
