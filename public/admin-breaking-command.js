"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    breaking: "/api/breaking",
    content: "/api/content",
    media: "/api/media",
    live: "/api/live"
  };

  const STATUS = {
    draft: "مسودة",
    review: "مراجعة",
    approved: "معتمد",
    published: "منشور",
    archived: "مؤرشف"
  };

  const PRIORITY = {
    low: "منخفض",
    normal: "عادي",
    high: "مرتفع",
    critical: "حرج"
  };

  const state = {
    items: [],
    content: [],
    media: [],
    channels: [],
    selected: null,
    search: "",
    status: "all",
    priority: "all",
    sort: "latest",
    loading: false,
    creating: false,
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

  function normalizeBreaking(
    item
  ) {
    return {
      ...item,

      id:
        item.id ||
        item.breaking_id ||
        item.breakingId,

      title:
        item.title ||
        item.headline ||
        item.text ||
        "خبر عاجل",

      summary:
        item.summary ||
        item.description ||
        "",

      body:
        item.body ||
        item.content ||
        "",

      status:
        item.status ||
        "draft",

      priority:
        item.priority ||
        "critical",

      category:
        item.category ||
        "عاجل",

      source:
        item.source ||
        item.source_name ||
        item.sourceName ||
        "",

      location:
        item.location ||
        item.location_name ||
        "",

      contentId:
        item.content_id ||
        item.contentId ||
        null,

      mediaId:
        item.media_id ||
        item.mediaId ||
        null,

      createdAt:
        item.created_at ||
        item.createdAt ||
        null,

      updatedAt:
        item.updated_at ||
        item.updatedAt ||
        null,

      publishedAt:
        item.published_at ||
        item.publishedAt ||
        null
    };
  }

  function normalizeContent(
    item
  ) {
    return {
      ...item,

      id:
        item.id ||
        item.content_id ||
        item.contentId,

      title:
        item.title ||
        item.headline ||
        "بدون عنوان",

      status:
        item.status ||
        "draft"
    };
  }

  function normalizeMedia(
    item
  ) {
    return {
      ...item,

      id:
        item.id ||
        item.media_id ||
        item.mediaId,

      name:
        item.name ||
        item.filename ||
        "وسيط",

      url:
        item.url ||
        item.public_url ||
        item.publicUrl ||
        ""
    };
  }

  function normalizeChannel(
    item
  ) {
    return {
      ...item,

      id:
        item.id ||
        item.channel_id,

      name:
        item.name ||
        item.title ||
        "قناة",

      status:
        item.status ||
        "offline"
    };
  }

  async function loadData() {
    state.loading =
      true;

    render();

    try {
      const results =
        await Promise.allSettled([
          request(
            `${API.breaking}?limit=100`
          ),
          request(
            `${API.content}?limit=100`
          ),
          request(
            `${API.media}?limit=100`
          ),
          request(
            `${API.live}?limit=50`
          )
        ]);

      const [
        breakingResult,
        contentResult,
        mediaResult,
        liveResult
      ] = results;

      if (
        breakingResult.status ===
        "fulfilled"
      ) {
        const data =
          breakingResult.value;

        const list =
          Array.isArray(data)
            ? data
            : data?.items ||
              data?.breaking ||
              data?.rows ||
              [];

        state.items =
          list.map(
            normalizeBreaking
          );
      }

      if (
        contentResult.status ===
        "fulfilled"
      ) {
        const data =
          contentResult.value;

        const list =
          Array.isArray(data)
            ? data
            : data?.items ||
              data?.content ||
              data?.rows ||
              [];

        state.content =
          list.map(
            normalizeContent
          );
      }

      if (
        mediaResult.status ===
        "fulfilled"
      ) {
        const data =
          mediaResult.value;

        const list =
          Array.isArray(data)
            ? data
            : data?.items ||
              data?.media ||
              data?.rows ||
              [];

        state.media =
          list.map(
            normalizeMedia
          );
      }

      if (
        liveResult.status ===
        "fulfilled"
      ) {
        const data =
          liveResult.value;

        const list =
          Array.isArray(data)
            ? data
            : data?.items ||
              data?.channels ||
              data?.rows ||
              [];

        state.channels =
          list.map(
            normalizeChannel
          );
      }

      state.lastUpdate =
        new Date();

    } catch (error) {
      console.error(
        "EZ MEDIA breaking command:",
        error
      );

      showToast(
        "تعذر تحميل مركز الأخبار العاجلة."
      );
    } finally {
      state.loading =
        false;

      render();
    }
  }

  function getFilteredItems() {
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
          item =>
            [
              item.title,
              item.summary,
              item.body,
              item.source,
              item.location,
              item.category
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
        );
    }

    if (
      state.status !==
      "all"
    ) {
      items =
        items.filter(
          item =>
            item.status ===
            state.status
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
          "priority"
        ) {
          const rank = {
            critical: 4,
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

        const aDate =
          new Date(
            a.updatedAt ||
            a.createdAt ||
            0
          );

        const bDate =
          new Date(
            b.updatedAt ||
            b.createdAt ||
            0
          );

        return (
          state.sort ===
          "oldest"
            ? aDate - bDate
            : bDate - aDate
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

      critical:
        items.filter(
          item =>
            item.priority ===
            "critical"
        ).length,

      review:
        items.filter(
          item =>
            item.status ===
            "review"
        ).length,

      approved:
        items.filter(
          item =>
            item.status ===
            "approved"
        ).length,

      published:
        items.filter(
          item =>
            item.status ===
            "published"
        ).length,

      live:
        state.channels.filter(
          channel =>
            channel.status ===
            "live"
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
      getFilteredItems();

    mount.innerHTML = `
      <div
        class="ez-breaking-command"
      >

        <header
          class="ez-breaking-head"
        >

          <div>
            <span
              class="ez-breaking-kicker"
            >
              EZ MEDIA BREAKING COMMAND
            </span>

            <h2>
              مركز الأخبار العاجلة
            </h2>

            <p>
              غرفة عمليات تحريرية لإدارة الخبر العاجل من لحظة الالتقاط حتى الاعتماد والنشر والتوزيع.
            </p>
          </div>

          <div
            class="ez-breaking-actions"
          >

            <button
              class="ez-breaking-btn critical"
              data-breaking-new
            >
              إنشاء عاجل
            </button>

            <button
              class="ez-breaking-btn"
              data-breaking-refresh
            >
              تحديث
            </button>

          </div>

        </header>

        <section
          class="ez-breaking-metrics"
        >

          ${metric(
            "إجمالي العاجل",
            m.total
          )}

          ${metric(
            "حرج",
            m.critical
          )}

          ${metric(
            "قيد المراجعة",
            m.review
          )}

          ${metric(
            "معتمد",
            m.approved
          )}

          ${metric(
            "منشور",
            m.published
          )}

          ${metric(
            "بث مباشر",
            m.live
          )}

        </section>

        <section
          class="ez-breaking-panel"
        >

          <div
            class="ez-breaking-toolbar"
          >

            <input
              id="ez-breaking-search"
              type="search"
              placeholder="ابحث في الأخبار العاجلة..."
              value="${escapeHtml(
                state.search
              )}"
            />

            <select
              id="ez-breaking-status"
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
              id="ez-breaking-priority"
            >

              <option
                value="all"
              >
                كل الأولويات
              </option>

              ${Object.entries(
                PRIORITY
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
              id="ez-breaking-sort"
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
                  class="ez-breaking-loading"
                >
                  جارٍ تحديث مركز العاجل...
                </div>
              `
              : ""
          }

          <div
            class="ez-breaking-list"
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
                    class="ez-breaking-empty"
                  >
                    لا توجد أخبار عاجلة مطابقة.
                  </div>
                `
            }

          </div>

        </section>

        ${renderResponsePanel()}

        ${
          state.creating
            ? renderCreatePanel()
            : ""
        }

        ${
          state.selected
            ? renderDetails()
            : ""
        }

        <footer
          class="ez-breaking-footer"
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
        class="ez-breaking-metric"
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
    return `
      <article
        class="
          ez-breaking-card
          priority-${escapeHtml(
            item.priority
          )}
        "
      >

        <div
          class="ez-breaking-card-main"
        >

          <button
            class="ez-breaking-title"
            data-breaking-view="${escapeHtml(
              item.id
            )}"
          >

            <span
              class="ez-breaking-label"
            >
              عاجل
            </span>

            <strong>
              ${escapeHtml(
                item.title
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
            class="ez-breaking-badges"
          >

            <span
              class="ez-breaking-priority"
            >
              ${
                PRIORITY[
                  item.priority
                ] ||
                item.priority
              }
            </span>

            <span
              class="ez-breaking-status"
            >
              ${
                STATUS[
                  item.status
                ] ||
                item.status
              }
            </span>

          </div>

        </div>

        <div
          class="ez-breaking-meta"
        >

          <span>
            المصدر:
            <strong>
              ${escapeHtml(
                item.source ||
                "غير محدد"
              )}
            </strong>
          </span>

          <span>
            الموقع:
            <strong>
              ${escapeHtml(
                item.location ||
                "غير محدد"
              )}
            </strong>
          </span>

          <span>
            ${formatDate(
              item.updatedAt ||
              item.createdAt
            )}
          </span>

        </div>

        <div
          class="ez-breaking-card-actions"
        >

          <button
            data-breaking-view="${escapeHtml(
              item.id
            )}"
          >
            فتح
          </button>

          ${
            item.status ===
            "draft"
              ? `
                <button
                  data-breaking-review="${escapeHtml(
                    item.id
                  )}"
                >
                  مراجعة
                </button>
              `
              : ""
          }

          ${
            item.status ===
            "review"
              ? `
                <button
                  data-breaking-approve="${escapeHtml(
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
            "approved"
              ? `
                <button
                  class="primary"
                  data-breaking-publish="${escapeHtml(
                    item.id
                  )}"
                >
                  نشر عاجل
                </button>
              `
              : ""
          }

          ${
            item.contentId
              ? `
                <button
                  data-breaking-content="${escapeHtml(
                    item.contentId
                  )}"
                >
                  المحتوى
                </button>
              `
              : ""
          }

        </div>

      </article>
    `;
  }

  function renderResponsePanel() {
    const live =
      state.channels.filter(
        channel =>
          channel.status ===
          "live"
      );

    return `
      <section
        class="ez-breaking-response"
      >

        <header>
          <span>
            RAPID RESPONSE
          </span>

          <h3>
            مركز الاستجابة الإعلامية
          </h3>

          <p>
            عند وقوع حدث عاجل، تعرض هذه المنطقة حالة البث والقنوات والوسائط المتاحة داخل المنصة.
          </p>
        </header>

        <div
          class="ez-breaking-response-grid"
        >

          <div
            class="ez-breaking-response-box"
          >
            <strong>
              القنوات المباشرة
            </strong>

            <span>
              ${live.length}
            </span>

            <small>
              قناة على الهواء الآن
            </small>
          </div>

          <div
            class="ez-breaking-response-box"
          >
            <strong>
              الوسائط المتاحة
            </strong>

            <span>
              ${state.media.length}
            </span>

            <small>
              صور وفيديو وصوت وملفات
            </small>
          </div>

          <div
            class="ez-breaking-response-box"
          >
            <strong>
              المحتوى التحريري
            </strong>

            <span>
              ${state.content.length}
            </span>

            <small>
              مادة متاحة للربط
            </small>
          </div>

        </div>

      </section>
    `;
  }

  function renderCreatePanel() {
    return `
      <div
        class="ez-breaking-overlay"
      >

        <section
          class="ez-breaking-create"
        >

          <header>
            <div>
              <span>
                BREAKING NEWS
              </span>

              <h3>
                إنشاء خبر عاجل
              </h3>
            </div>

            <button
              data-breaking-close
            >
              إغلاق
            </button>
          </header>

          <form
            id="ez-breaking-form"
          >

            <div
              class="ez-breaking-form-grid"
            >

              <label
                class="full"
              >
                <span>
                  العنوان العاجل
                </span>

                <input
                  name="title"
                  required
                  placeholder="اكتب عنوان الخبر العاجل..."
                />
              </label>

              <label>
                <span>
                  الأولوية
                </span>

                <select
                  name="priority"
                >

                  ${Object.entries(
                    PRIORITY
                  )
                    .map(
                      ([key, label]) =>
                        `
                          <option
                            value="${key}"
                            ${
                              key ===
                              "critical"
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
                  المصدر
                </span>

                <input
                  name="source"
                  placeholder="المصدر أو الجهة..."
                />
              </label>

              <label>
                <span>
                  الموقع
                </span>

                <input
                  name="location"
                  placeholder="المدينة أو الدولة..."
                />
              </label>

              <label>
                <span>
                  التصنيف
                </span>

                <input
                  name="category"
                  value="عاجل"
                  placeholder="التصنيف..."
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
                  rows="4"
                  placeholder="ملخص سريع للخبر..."
                ></textarea>
              </label>

              <label
                class="full"
              >
                <span>
                  التفاصيل
                </span>

                <textarea
                  name="body"
                  rows="7"
                  placeholder="تفاصيل الخبر المتوفرة حاليًا..."
                ></textarea>
              </label>

            </div>

            <div
              class="ez-breaking-form-actions"
            >

              <button
                type="button"
                data-breaking-close
              >
                إلغاء
              </button>

              <button
                type="submit"
                class="primary"
              >
                إنشاء الخبر العاجل
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

    return `
      <section
        class="ez-breaking-details"
      >

        <header>
          <div>
            <span>
              BREAKING COMMAND
            </span>

            <h3>
              ${escapeHtml(
                item.title
              )}
            </h3>
          </div>

          <button
            data-breaking-details-close
          >
            إغلاق
          </button>
        </header>

        <div
          class="ez-breaking-detail-grid"
        >

          ${detail(
            "الحالة",
            STATUS[
              item.status
            ] ||
              item.status
          )}

          ${detail(
            "الأولوية",
            PRIORITY[
              item.priority
            ] ||
              item.priority
          )}

          ${detail(
            "المصدر",
            item.source ||
              "غير محدد"
          )}

          ${detail(
            "الموقع",
            item.location ||
              "غير محدد"
          )}

          ${detail(
            "المحتوى المرتبط",
            item.contentId ||
              "غير مرتبط"
          )}

          ${detail(
            "الوسيط المرتبط",
            item.mediaId ||
              "غير مرتبط"
          )}

        </div>

        ${
          item.summary
            ? `
              <div
                class="ez-breaking-summary"
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
                class="ez-breaking-body"
              >
                ${escapeHtml(
                  item.body
                )}
              </div>
            `
            : ""
        }

        <div
          class="ez-breaking-detail-actions"
        >

          ${
            item.status ===
            "draft"
              ? `
                <button
                  data-breaking-review="${escapeHtml(
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
                  data-breaking-approve="${escapeHtml(
                    item.id
                  )}"
                >
                  اعتماد الخبر
                </button>
              `
              : ""
          }

          ${
            item.status ===
            "approved"
              ? `
                <button
                  class="primary"
                  data-breaking-publish="${escapeHtml(
                    item.id
                  )}"
                >
                  نشر عاجل
                </button>
              `
              : ""
          }

          ${
            item.contentId
              ? `
                <button
                  data-breaking-content="${escapeHtml(
                    item.contentId
                  )}"
                >
                  فتح المحتوى
                </button>
              `
              : ""
          }

        </div>

      </section>
    `;
  }

  function detail(
    label,
    value
  ) {
    return `
      <div
        class="ez-breaking-detail"
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

  async function createBreaking(
    form
  ) {
    const data =
      new FormData(
        form
      );

    const payload = {
      title:
        String(
          data.get(
            "title"
          ) ||
            ""
        ).trim(),

      headline:
        String(
          data.get(
            "title"
          ) ||
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
          data.get(
            "body"
          ) ||
            ""
        ),

      content:
        String(
          data.get(
            "body"
          ) ||
            ""
        ),

      priority:
        String(
          data.get(
            "priority"
          ) ||
            "critical"
        ),

      source:
        String(
          data.get(
            "source"
          ) ||
            ""
        ).trim(),

      location:
        String(
          data.get(
            "location"
          ) ||
            ""
        ).trim(),

      category:
        String(
          data.get(
            "category"
          ) ||
            "عاجل"
        ).trim(),

      type:
        "breaking"
    };

    if (!payload.title) {
      showToast(
        "عنوان الخبر مطلوب."
      );

      return;
    }

    try {
      state.loading =
        true;

      render();

      await request(
        API.breaking,
        {
          method: "POST",
          body:
            JSON.stringify(
              payload
            )
        }
      );

      state.creating =
        false;

      showToast(
        "تم إنشاء الخبر العاجل."
      );

      await loadData();

    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر إنشاء العاجل: ${error.message}`
      );

      state.loading =
        false;

      render();
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
        `${API.breaking}/${encodeURIComponent(
          id
        )}/${endpoint}`,
        {
          method: "POST"
        }
      );

      state.selected =
        null;

      showToast(
        action ===
          "review"
          ? "تم إرسال العاجل للمراجعة."
          : action ===
            "approve"
          ? "تم اعتماد الخبر العاجل."
          : "تم نشر الخبر العاجل."
      );

      await loadData();

    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر تنفيذ الإجراء: ${error.message}`
      );
    }
  }

  function openDetails(
    id
  ) {
    const item =
      state.items.find(
        breaking =>
          String(
            breaking.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    state.selected =
      item;

    render();
  }

  function closeDetails() {
    state.selected =
      null;

    render();
  }

  function openContent(
    id
  ) {
    const item =
      state.content.find(
        content =>
          String(
            content.id
          ) ===
          String(id)
      );

    if (!item) {
      showToast(
        "المحتوى المرتبط غير موجود."
      );

      return;
    }

    showToast(
      `المحتوى: ${item.title}`
    );
  }

  function bindEvents() {
    document
      .querySelector(
        "[data-breaking-new]"
      )
      ?.addEventListener(
        "click",
        () => {
          state.creating =
            true;

          render();
        }
      );

    document
      .querySelector(
        "[data-breaking-refresh]"
      )
      ?.addEventListener(
        "click",
        loadData
      );

    document
      .querySelector(
        "#ez-breaking-search"
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
        "#ez-breaking-status"
      )
      ?.addEventListener(
        "change",
        event => {
          state.status =
            event.target.value;

          render();
        }
      );

    document
      .querySelector(
        "#ez-breaking-priority"
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
        "#ez-breaking-sort"
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
        "[data-breaking-view]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              openDetails(
                button.dataset
                  .breakingView
              )
          )
      );

    document
      .querySelectorAll(
        "[data-breaking-review]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .breakingReview,
                "review"
              )
          )
      );

    document
      .querySelectorAll(
        "[data-breaking-approve]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .breakingApprove,
                "approve"
              )
          )
      );

    document
      .querySelectorAll(
        "[data-breaking-publish]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              changeStatus(
                button.dataset
                  .breakingPublish,
                "publish"
              )
          )
      );

    document
      .querySelectorAll(
        "[data-breaking-content]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              openContent(
                button.dataset
                  .breakingContent
              )
          )
      );

    document
      .querySelectorAll(
        "[data-breaking-close]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () => {
              state.creating =
                false;

              render();
            }
          )
      );

    document
      .querySelector(
        "[data-breaking-details-close]"
      )
      ?.addEventListener(
        "click",
        closeDetails
      );

    document
      .querySelector(
        "#ez-breaking-form"
      )
      ?.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          createBreaking(
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
        "#ez-breaking-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-breaking-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100001;
        max-width:460px;
        border:1px solid #fecdd3;
        border-radius:15px;
        background:#ffffff;
        color:#9f1239;
        padding:12px 15px;
        box-shadow:0 15px 45px rgba(159,18,57,.15);
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
        () =>
          toast.remove(),
        5000
      );
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-breaking-command-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-breaking-command-style";

    style.textContent = `
      #breaking-command-section,
      #admin-breaking-command-section {
        direction:rtl;
      }

      .ez-breaking-command {
        color:#0f172a;
      }

      .ez-breaking-head {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:15px;
      }

      .ez-breaking-kicker {
        color:#e11d48;
        font-size:8px;
        font-weight:950;
        letter-spacing:.08em;
      }

      .ez-breaking-head h2 {
        margin:5px 0;
        color:#075985;
        font-size:27px;
        font-weight:950;
      }

      .ez-breaking-head p {
        max-width:800px;
        margin:0;
        color:#64748b;
        font-size:11px;
        line-height:1.8;
      }

      .ez-breaking-actions {
        display:flex;
        gap:7px;
      }

      .ez-breaking-btn {
        border:1px solid #bae6fd;
        border-radius:11px;
        background:#fff;
        color:#0369a1;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-breaking-btn.critical {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #e11d48,
            #fb7185
          );
        color:#fff;
      }

      .ez-breaking-metrics {
        display:grid;
        grid-template-columns:
          repeat(6,minmax(0,1fr));
        gap:9px;
        margin-bottom:10px;
      }

      .ez-breaking-metric {
        border:1px solid #ffe4e6;
        border-radius:15px;
        background:#fff;
        padding:13px;
      }

      .ez-breaking-metric span {
        display:block;
        color:#64748b;
        font-size:8px;
        font-weight:850;
      }

      .ez-breaking-metric strong {
        display:block;
        margin-top:4px;
        color:#9f1239;
        font-size:22px;
        font-weight:950;
      }

      .ez-breaking-panel,
      .ez-breaking-response {
        border:1px solid #e0f2fe;
        border-radius:17px;
        background:#fff;
        padding:13px;
        margin-bottom:10px;
      }

      .ez-breaking-toolbar {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
        margin-bottom:11px;
      }

      .ez-breaking-toolbar input,
      .ez-breaking-toolbar select {
        border:1px solid #bae6fd;
        border-radius:10px;
        background:#fff;
        color:#334155;
        outline:none;
        padding:9px;
        font-size:9px;
      }

      .ez-breaking-toolbar input {
        flex:1;
        min-width:220px;
      }

      .ez-breaking-list {
        display:grid;
        gap:8px;
      }

      .ez-breaking-card {
        position:relative;
        border:1px solid #e0f2fe;
        border-right:4px solid #94a3b8;
        border-radius:14px;
        background:
          linear-gradient(
            135deg,
            #fff,
            #f8fdff
          );
        padding:12px;
      }

      .ez-breaking-card.priority-critical {
        border-right-color:#e11d48;
      }

      .ez-breaking-card.priority-high {
        border-right-color:#f97316;
      }

      .ez-breaking-card.priority-normal {
        border-right-color:#0ea5e9;
      }

      .ez-breaking-card.priority-low {
        border-right-color:#22c55e;
      }

      .ez-breaking-card-main {
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
      }

      .ez-breaking-title {
        border:0;
        background:transparent;
        padding:0;
        cursor:pointer;
        text-align:right;
      }

      .ez-breaking-label {
        display:inline-block;
        margin-bottom:5px;
        border-radius:999px;
        background:#fff1f2;
        color:#be123c;
        padding:4px 7px;
        font-size:6px;
        font-weight:950;
      }

      .ez-breaking-title strong {
        display:block;
        color:#075985;
        font-size:11px;
      }

      .ez-breaking-title small {
        display:block;
        max-width:780px;
        margin-top:5px;
        color:#64748b;
        font-size:8px;
        line-height:1.7;
      }

      .ez-breaking-badges {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
      }

      .ez-breaking-priority,
      .ez-breaking-status {
        border-radius:999px;
        padding:5px 7px;
        font-size:6px;
        font-weight:950;
      }

      .ez-breaking-priority {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-breaking-status {
        background:#eff6ff;
        color:#0369a1;
      }

      .ez-breaking-meta {
        display:flex;
        gap:14px;
        flex-wrap:wrap;
        margin-top:10px;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-breaking-meta strong {
        color:#0369a1;
      }

      .ez-breaking-card-actions {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        margin-top:10px;
      }

      .ez-breaking-card-actions button,
      .ez-breaking-detail-actions button {
        border:1px solid #e0f2fe;
        border-radius:8px;
        background:#fff;
        color:#0369a1;
        padding:6px 8px;
        cursor:pointer;
        font-size:7px;
        font-weight:900;
      }

      .ez-breaking-card-actions button.primary,
      .ez-breaking-detail-actions button.primary {
        border-color:transparent;
        background:#e11d48;
        color:#fff;
      }

      .ez-breaking-loading {
        margin-bottom:8px;
        border-radius:10px;
        background:#fff1f2;
        color:#be123c;
        padding:9px;
        font-size:8px;
        font-weight:900;
      }

      .ez-breaking-response header span {
        color:#e11d48;
        font-size:8px;
        font-weight:950;
      }

      .ez-breaking-response header h3 {
        margin:4px 0;
        color:#075985;
        font-size:16px;
      }

      .ez-breaking-response header p {
        margin:0 0 10px;
        color:#64748b;
        font-size:8px;
      }

      .ez-breaking-response-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .ez-breaking-response-box {
        border:1px solid #e0f2fe;
        border-radius:12px;
        background:#f8fdff;
        padding:11px;
      }

      .ez-breaking-response-box strong {
        display:block;
        color:#075985;
        font-size:8px;
      }

      .ez-breaking-response-box span {
        display:block;
        margin-top:4px;
        color:#0284c7;
        font-size:22px;
        font-weight:950;
      }

      .ez-breaking-response-box small {
        color:#94a3b8;
        font-size:7px;
      }

      .ez-breaking-empty {
        padding:40px;
        color:#94a3b8;
        text-align:center;
        font-size:9px;
      }

      .ez-breaking-overlay {
        position:fixed;
        inset:0;
        z-index:90000;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(255,241,242,.82);
        backdrop-filter:blur(8px);
      }

      .ez-breaking-create {
        width:min(820px,100%);
        max-height:91vh;
        overflow:auto;
        border:1px solid #fecdd3;
        border-radius:20px;
        background:#fff;
        padding:17px;
        box-shadow:0 25px 80px rgba(159,18,57,.15);
      }

      .ez-breaking-create header,
      .ez-breaking-details header {
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
        margin-bottom:15px;
      }

      .ez-breaking-create header span,
      .ez-breaking-details header span {
        color:#e11d48;
        font-size:8px;
        font-weight:950;
      }

      .ez-breaking-create header h3,
      .ez-breaking-details header h3 {
        margin:4px 0 0;
        color:#075985;
        font-size:17px;
      }

      .ez-breaking-create header button,
      .ez-breaking-details header button {
        border:1px solid #e0f2fe;
        border-radius:9px;
        background:#fff;
        color:#64748b;
        padding:7px 10px;
        cursor:pointer;
        font-size:8px;
      }

      .ez-breaking-form-grid {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:9px;
      }

      .ez-breaking-form-grid label {
        display:grid;
        gap:5px;
      }

      .ez-breaking-form-grid label.full {
        grid-column:1/-1;
      }

      .ez-breaking-form-grid label span {
        color:#64748b;
        font-size:8px;
        font-weight:900;
      }

      .ez-breaking-form-grid input,
      .ez-breaking-form-grid select,
      .ez-breaking-form-grid textarea {
        box-sizing:border-box;
        width:100%;
        border:1px solid #fecdd3;
        border-radius:10px;
        background:#fff;
        color:#334155;
        outline:none;
        padding:9px;
        font-family:inherit;
        font-size:9px;
      }

      .ez-breaking-form-actions {
        display:flex;
        justify-content:flex-end;
        gap:7px;
        margin-top:13px;
      }

      .ez-breaking-form-actions button {
        border:1px solid #e0f2fe;
        border-radius:10px;
        background:#fff;
        color:#64748b;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-breaking-form-actions button.primary {
        border-color:transparent;
        background:#e11d48;
        color:#fff;
      }

      .ez-breaking-details {
        margin-bottom:10px;
        border:1px solid #fecdd3;
        border-radius:17px;
        background:#fff;
        padding:14px;
      }

      .ez-breaking-detail-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .ez-breaking-detail {
        border-radius:10px;
        background:#f8fafc;
        padding:9px;
      }

      .ez-breaking-detail span {
        display:block;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-breaking-detail strong {
        display:block;
        margin-top:3px;
        color:#075985;
        font-size:8px;
        word-break:break-word;
      }

      .ez-breaking-summary,
      .ez-breaking-body {
        margin-top:10px;
        border-radius:11px;
        background:#fff8fa;
        color:#475569;
        padding:11px;
        font-size:9px;
        line-height:1.9;
        white-space:pre-wrap;
      }

      .ez-breaking-body {
        min-height:100px;
      }

      .ez-breaking-detail-actions {
        display:flex;
        gap:6px;
        flex-wrap:wrap;
        margin-top:11px;
      }

      .ez-breaking-footer {
        margin-top:8px;
        color:#94a3b8;
        text-align:center;
        font-size:7px;
      }

      @media (max-width:1000px) {
        .ez-breaking-metrics {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }
      }

      @media (max-width:700px) {
        .ez-breaking-metrics,
        .ez-breaking-response-grid,
        .ez-breaking-form-grid,
        .ez-breaking-detail-grid {
          grid-template-columns:1fr;
        }

        .ez-breaking-form-grid label.full {
          grid-column:auto;
        }

        .ez-breaking-toolbar {
          flex-direction:column;
        }

        .ez-breaking-card-main {
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
        "#breaking-command-section"
      ) ||
      document.querySelector(
        "#admin-breaking-command-section"
      ) ||
      document.querySelector(
        '[data-admin-section="breaking-command"]'
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
      "admin-breaking-command-section";

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

    await loadData();
  }

  window.EZMediaAdminBreakingCommand =
    {
      initialize,
      refresh:
        loadData,
      getState() {
        return {
          ...state,
          items: [
            ...state.items
          ],
          content: [
            ...state.content
          ],
          media: [
            ...state.media
          ],
          channels: [
            ...state.channels
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
