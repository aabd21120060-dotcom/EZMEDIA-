"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    content: "/api/content",
    ai: "/api/ai"
  };

  const state = {
    sources: [],
    signals: [],
    topics: [],
    selected: null,
    search: "",
    category: "all",
    priority: "all",
    loading: false,
    lastUpdate: null
  };

  const SOURCE_TYPES = {
    official: "مصدر رسمي",
    agency: "وكالة أنباء",
    newsroom: "غرفة أخبار",
    social: "منصة اجتماعية",
    rss: "RSS",
    api: "API",
    internal: "مصدر داخلي"
  };

  const PRIORITIES = {
    low: "منخفضة",
    medium: "متوسطة",
    high: "عالية",
    critical: "حرجة"
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
      window.EZMediaAdminCore
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

  function arrayFrom(data) {
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

  function normalizeContent(
    item
  ) {
    return {
      id:
        item?.id ||
        item?._id ||
        null,

      title:
        item?.title ||
        item?.headline ||
        "بدون عنوان",

      summary:
        item?.summary ||
        item?.description ||
        "",

      category:
        item?.category ||
        "عام",

      type:
        item?.content_type ||
        item?.contentType ||
        item?.type ||
        "news",

      status:
        item?.status ||
        "draft",

      createdAt:
        item?.created_at ||
        item?.createdAt ||
        null,

      updatedAt:
        item?.updated_at ||
        item?.updatedAt ||
        null,

      sourceUrl:
        item?.source_url ||
        item?.sourceUrl ||
        "",

      metadata:
        item?.metadata ||
        {}
    };
  }

  async function loadIntelligence() {
    state.loading = true;
    render();

    try {
      const response =
        await request(
          `${API.content}?limit=500`
        );

      const content =
        arrayFrom(response)
          .map(
            normalizeContent
          );

      state.signals =
        buildSignals(
          content
        );

      state.topics =
        buildTopics(
          content
        );

      state.sources =
        buildSources(
          content
        );

      state.lastUpdate =
        new Date();

    } catch (error) {
      console.error(
        "EZ MEDIA Intelligence:",
        error
      );

      showToast(
        error.message ||
        "تعذر تحميل مركز الذكاء الإعلامي."
      );

    } finally {
      state.loading = false;
      render();
    }
  }

  function buildSignals(
    content
  ) {
    const now =
      Date.now();

    return content
      .map(
        item => {

          const text =
            `${item.title} ${item.summary}`
              .toLowerCase();

          let priority =
            "low";

          if (
            item.status ===
            "published"
          ) {
            priority =
              "medium";
          }

          if (
            text.includes(
              "عاجل"
            ) ||
            text.includes(
              "urgent"
            )
          ) {
            priority =
              "high";
          }

          if (
            text.includes(
              "كارثة"
            ) ||
            text.includes(
              "وفاة"
            ) ||
            text.includes(
              "هجوم"
            ) ||
            text.includes(
              "زلزال"
            ) ||
            text.includes(
              "حرب"
            )
          ) {
            priority =
              "critical";
          }

          const date =
            new Date(
              item.updatedAt ||
              item.createdAt ||
              now
            );

          const age =
            Math.max(
              0,
              now -
                date.getTime()
            );

          return {
            ...item,
            priority,
            freshness:
              age <
              3600000
                ? "جديدة جدًا"
                : age <
                    86400000
                  ? "جديدة"
                  : "قديمة نسبيًا",
            score:
              calculateSignalScore(
                item,
                priority
              )
          };
        }
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );
  }

  function calculateSignalScore(
    item,
    priority
  ) {
    const priorityScore = {
      low: 20,
      medium: 45,
      high: 75,
      critical: 100
    }[priority] || 20;

    const statusScore = {
      published: 20,
      approved: 15,
      review: 10,
      draft: 5
    }[
      item.status
    ] || 0;

    return Math.min(
      100,
      priorityScore +
        statusScore
    );
  }

  function buildTopics(
    content
  ) {
    const map =
      new Map();

    content.forEach(
      item => {

        const category =
          item.category ||
          "عام";

        if (
          !map.has(
            category
          )
        ) {
          map.set(
            category,
            {
              name:
                category,
              count: 0,
              latest:
                null,
              critical: 0
            }
          );
        }

        const topic =
          map.get(
            category
          );

        topic.count += 1;

        if (
          item.status ===
          "published"
        ) {
          topic.latest =
            item.updatedAt ||
            item.createdAt;
        }

        const signal =
          buildSignals([
            item
          ])[0];

        if (
          signal?.priority ===
          "critical"
        ) {
          topic.critical +=
            1;
        }
      }
    );

    return Array.from(
      map.values()
    )
      .sort(
        (a, b) =>
          b.count -
          a.count
      );
  }

  function buildSources(
    content
  ) {
    const map =
      new Map();

    content.forEach(
      item => {

        const source =
          item.metadata
            ?.source ||
          item.metadata
            ?.source_name ||
          item.sourceUrl ||
          "مصدر غير محدد";

        if (
          !map.has(
            source
          )
        ) {
          map.set(
            source,
            {
              name:
                source,
              type:
                detectSourceType(
                  source
                ),
              count: 0,
              latest:
                null
            }
          );
        }

        const entry =
          map.get(
            source
          );

        entry.count +=
          1;

        entry.latest =
          item.updatedAt ||
          item.createdAt ||
          entry.latest;
      }
    );

    return Array.from(
      map.values()
    )
      .sort(
        (a, b) =>
          b.count -
          a.count
      );
  }

  function detectSourceType(
    source
  ) {
    const text =
      String(
        source
      ).toLowerCase();

    if (
      text.includes(
        ".gov"
      ) ||
      text.includes(
        "gov.sa"
      )
    ) {
      return "official";
    }

    if (
      text.includes(
        "rss"
      )
    ) {
      return "rss";
    }

    if (
      text.includes(
        "api"
      )
    ) {
      return "api";
    }

    return "internal";
  }

  function filteredSignals() {
    return state.signals.filter(
      signal => {

        if (
          state.priority !==
          "all" &&
          signal.priority !==
            state.priority
        ) {
          return false;
        }

        if (
          state.category !==
          "all" &&
          signal.category !==
            state.category
        ) {
          return false;
        }

        if (
          state.search
        ) {
          const text =
            [
              signal.title,
              signal.summary,
              signal.category,
              signal.type
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          if (
            !text.includes(
              state.search
                .toLowerCase()
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }

  function getCategories() {
    return Array.from(
      new Set(
        state.signals
          .map(
            item =>
              item.category
          )
          .filter(Boolean)
      )
    ).sort();
  }

  function render() {
    injectStyles();

    const mount =
      getMount();

    if (!mount) {
      return;
    }

    const signals =
      filteredSignals();

    const critical =
      state.signals.filter(
        item =>
          item.priority ===
          "critical"
      ).length;

    const high =
      state.signals.filter(
        item =>
          item.priority ===
          "high"
      ).length;

    const published =
      state.signals.filter(
        item =>
          item.status ===
          "published"
      ).length;

    mount.innerHTML = `
      <div
        class="ez-intelligence"
      >

        <header
          class="ez-intel-header"
        >

          <div>
            <span
              class="ez-intel-kicker"
            >
              EZ MEDIA AI INTELLIGENCE
            </span>

            <h2>
              مركز الذكاء الإعلامي
            </h2>

            <p>
              محرك ذكي لترتيب الإشارات والموضوعات ومساعدة غرفة الأخبار على اكتشاف الأولويات.
            </p>
          </div>

          <button
            class="ez-intel-btn primary"
            data-intel-refresh
          >
            تحديث الذكاء
          </button>

        </header>

        <div
          class="ez-intel-metrics"
        >

          ${metric(
            "الإشارات",
            state.signals.length,
            "جميع المواد المرصودة"
          )}

          ${metric(
            "حرجة",
            critical,
            "تحتاج انتباهًا فوريًا"
          )}

          ${metric(
            "عالية",
            high,
            "أولوية تحريرية"
          )}

          ${metric(
            "منشورة",
            published,
            "مواد خرجت للجمهور"
          )}

        </div>

        <div
          class="ez-intel-main"
        >

          <section
            class="ez-intel-panel"
          >

            <div
              class="ez-intel-toolbar"
            >

              <div>
                <h3>
                  موجز الإشارات
                </h3>

                <small>
                  ترتيب آلي حسب الأولوية والحداثة
                </small>
              </div>

              <div
                class="ez-intel-filters"
              >

                <input
                  id="ez-intel-search"
                  type="search"
                  placeholder="ابحث..."
                  value="${escapeHtml(
                    state.search
                  )}"
                />

                <select
                  id="ez-intel-priority"
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
                  id="ez-intel-category"
                >

                  <option
                    value="all"
                  >
                    كل التصنيفات
                  </option>

                  ${getCategories()
                    .map(
                      category =>
                        `
                          <option
                            value="${escapeHtml(
                              category
                            )}"
                            ${
                              state.category ===
                              category
                                ? "selected"
                                : ""
                            }
                          >
                            ${escapeHtml(
                              category
                            )}
                          </option>
                        `
                    )
                    .join("")}

                </select>

              </div>

            </div>

            <div
              class="ez-intel-feed"
            >

              ${
                state.loading
                  ? `
                    <div
                      class="ez-intel-empty"
                    >
                      جارٍ تحليل البيانات...
                    </div>
                  `
                  : signals.length
                  ? signals
                      .map(
                        renderSignal
                      )
                      .join("")
                  : `
                    <div
                      class="ez-intel-empty"
                    >
                      لا توجد إشارات مطابقة.
                    </div>
                  `
              }

            </div>

          </section>

          <aside
            class="ez-intel-side"
          >

            ${renderTopics()}

            ${renderSources()}

          </aside>

        </div>

        ${
          state.selected
            ? renderSelected()
            : ""
        }

        <div
          class="ez-intel-footer"
        >
          إصدار الذكاء:
          ${VERSION}
          •
          آخر تحديث:
          ${
            state.lastUpdate
              ? formatDate(
                  state.lastUpdate
                )
              : "لم يبدأ"
          }
        </div>

      </div>
    `;

    bindEvents();
  }

  function metric(
    title,
    value,
    description
  ) {
    return `
      <div
        class="ez-intel-metric"
      >

        <span>
          ${escapeHtml(
            title
          )}
        </span>

        <strong>
          ${escapeHtml(
            value
          )}
        </strong>

        <small>
          ${escapeHtml(
            description
          )}
        </small>

      </div>
    `;
  }

  function renderSignal(
    signal
  ) {
    const selected =
      state.selected &&
      String(
        state.selected.id
      ) ===
        String(signal.id);

    return `
      <button
        class="
          ez-intel-signal
          ${
            selected
              ? "selected"
              : ""
          }
        "
        data-intel-signal="${escapeHtml(
          signal.id
        )}"
      >

        <div
          class="ez-intel-signal-score"
        >
          ${signal.score}
        </div>

        <div
          class="ez-intel-signal-content"
        >

          <div
            class="ez-intel-signal-meta"
          >

            <span
              class="${priorityClass(
                signal.priority
              )}"
            >
              ${PRIORITIES[
                signal.priority
              ]}
            </span>

            <span>
              ${escapeHtml(
                signal.category
              )}
            </span>

            <span>
              ${escapeHtml(
                signal.freshness
              )}
            </span>

          </div>

          <strong>
            ${escapeHtml(
              signal.title
            )}
          </strong>

          ${
            signal.summary
              ? `
                <p>
                  ${escapeHtml(
                    signal.summary
                  )}
                </p>
              `
              : ""
          }

          <small>
            ${formatDate(
              signal.updatedAt ||
              signal.createdAt
            )}
          </small>

        </div>

      </button>
    `;
  }

  function priorityClass(
    priority
  ) {
    return (
      `ez-intel-priority-${priority}`
    );
  }

  function renderTopics() {
    return `
      <section
        class="ez-intel-panel"
      >

        <div
          class="ez-intel-panel-title"
        >
          <h3>
            خريطة الموضوعات
          </h3>

          <span>
            ${state.topics.length}
          </span>
        </div>

        <div
          class="ez-intel-topics"
        >

          ${
            state.topics.length
              ? state.topics
                  .slice(
                    0,
                    12
                  )
                  .map(
                    topic =>
                      `
                        <div
                          class="ez-intel-topic"
                        >

                          <div>
                            <strong>
                              ${escapeHtml(
                                topic.name
                              )}
                            </strong>

                            <small>
                              ${topic.count}
                              مادة
                            </small>
                          </div>

                          ${
                            topic.critical
                              ? `
                                <span
                                  class="ez-intel-topic-alert"
                                >
                                  ${topic.critical}
                                </span>
                              `
                              : ""
                          }

                        </div>
                      `
                  )
                  .join("")
              : `
                <div
                  class="ez-intel-muted"
                >
                  لا توجد موضوعات بعد.
                </div>
              `
          }

        </div>

      </section>
    `;
  }

  function renderSources() {
    return `
      <section
        class="ez-intel-panel"
      >

        <div
          class="ez-intel-panel-title"
        >
          <h3>
            خريطة المصادر
          </h3>

          <span>
            ${state.sources.length}
          </span>
        </div>

        <div
          class="ez-intel-sources"
        >

          ${
            state.sources.length
              ? state.sources
                  .slice(
                    0,
                    10
                  )
                  .map(
                    source =>
                      `
                        <div
                          class="ez-intel-source"
                        >

                          <div>
                            <strong>
                              ${escapeHtml(
                                source.name
                              )}
                            </strong>

                            <small>
                              ${
                                SOURCE_TYPES[
                                  source.type
                                ] ||
                                source.type
                              }
                            </small>
                          </div>

                          <b>
                            ${source.count}
                          </b>

                        </div>
                      `
                  )
                  .join("")
              : `
                <div
                  class="ez-intel-muted"
                >
                  لا توجد مصادر مسجلة.
                </div>
              `
          }

        </div>

      </section>
    `;
  }

  function renderSelected() {
    const item =
      state.selected;

    if (!item) {
      return "";
    }

    const duplicateCount =
      findSimilarContent(
        item
      ).length;

    return `
      <section
        class="ez-intel-selected"
      >

        <div
          class="ez-intel-selected-header"
        >

          <div>
            <span>
              التحليل العميق
            </span>

            <h3>
              ${escapeHtml(
                item.title
              )}
            </h3>
          </div>

          <button
            class="ez-intel-close"
            data-intel-close
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-intel-analysis-grid"
        >

          <div>
            <span>
              درجة الإشارة
            </span>

            <strong>
              ${item.score}/100
            </strong>
          </div>

          <div>
            <span>
              الأولوية
            </span>

            <strong>
              ${
                PRIORITIES[
                  item.priority
                ]
              }
            </strong>
          </div>

          <div>
            <span>
              الحداثة
            </span>

            <strong>
              ${escapeHtml(
                item.freshness
              )}
            </strong>
          </div>

          <div>
            <span>
              التشابه المحتمل
            </span>

            <strong>
              ${duplicateCount}
            </strong>
          </div>

        </div>

        <div
          class="ez-intel-selected-actions"
        >

          <button
            class="ez-intel-btn primary"
            data-intel-ai="${escapeHtml(
              item.id
            )}"
          >
            تحليل بالذكاء الاصطناعي
          </button>

          ${
            item.sourceUrl
              ? `
                <a
                  class="ez-intel-btn"
                  href="${escapeHtml(
                    item.sourceUrl
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  فتح المصدر
                </a>
              `
              : ""
          }

        </div>

        <div
          class="ez-intel-duplicates"
        >

          <h4>
            مواد مشابهة داخل المنصة
          </h4>

          ${
            duplicateCount
              ? findSimilarContent(
                  item
                )
                  .map(
                    duplicate =>
                      `
                        <div>
                          ${escapeHtml(
                            duplicate.title
                          )}
                        </div>
                      `
                  )
                  .join("")
              : `
                <p>
                  لم يتم العثور على مواد مشابهة بشكل واضح.
                </p>
              `
          }

        </div>

      </section>
    `;
  }

  function findSimilarContent(
    item
  ) {
    const base =
      normalizeText(
        `${item.title} ${item.summary}`
      );

    const words =
      new Set(
        base
          .split(/\s+/)
          .filter(
            word =>
              word.length >= 4
          )
      );

    return state.signals
      .filter(
        candidate =>
          String(
            candidate.id
          ) !==
          String(item.id)
      )
      .map(
        candidate => {

          const candidateText =
            normalizeText(
              `${candidate.title} ${candidate.summary}`
            );

          const candidateWords =
            new Set(
              candidateText
                .split(/\s+/)
                .filter(
                  word =>
                    word.length >= 4
                )
            );

          let common = 0;

          words.forEach(
            word => {
              if (
                candidateWords.has(
                  word
                )
              ) {
                common += 1;
              }
            }
          );

          return {
            ...candidate,
            similarity:
              common /
              Math.max(
                1,
                words.size
              )
          };
        }
      )
      .filter(
        candidate =>
          candidate.similarity >=
          0.25
      )
      .sort(
        (a, b) =>
          b.similarity -
          a.similarity
      )
      .slice(
        0,
        5
      );
  }

  function normalizeText(
    text
  ) {
    return String(
      text || ""
    )
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  async function runAI(
    item
  ) {
    if (!item?.id) {
      return;
    }

    try {
      showToast(
        "جارٍ تشغيل التحليل الذكي..."
      );

      await request(
        `${API.ai}/content/${item.id}/analyze`,
        {
          method:
            "POST"
        }
      );

      showToast(
        "اكتمل تحليل المادة."
      );

    } catch (error) {
      showToast(
        error.message ||
        "تعذر تشغيل الذكاء الاصطناعي."
      );
    }
  }

  function bindEvents() {
    const refresh =
      document.querySelector(
        "[data-intel-refresh]"
      );

    if (refresh) {
      refresh.addEventListener(
        "click",
        loadIntelligence
      );
    }

    const search =
      document.querySelector(
        "#ez-intel-search"
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

    const priority =
      document.querySelector(
        "#ez-intel-priority"
      );

    if (priority) {
      priority.addEventListener(
        "change",
        event => {
          state.priority =
            event.target.value;

          render();
        }
      );
    }

    const category =
      document.querySelector(
        "#ez-intel-category"
      );

    if (category) {
      category.addEventListener(
        "change",
        event => {
          state.category =
            event.target.value;

          render();
        }
      );
    }

    document
      .querySelectorAll(
        "[data-intel-signal]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const item =
                state.signals.find(
                  signal =>
                    String(
                      signal.id
                    ) ===
                    String(
                      button.dataset
                        .intelSignal
                    )
                );

              if (item) {
                state.selected =
                  item;

                render();
              }
            }
          );

        }
      );

    const close =
      document.querySelector(
        "[data-intel-close]"
      );

    if (close) {
      close.addEventListener(
        "click",
        () => {
          state.selected =
            null;

          render();
        }
      );
    }

    document
      .querySelectorAll(
        "[data-intel-ai]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const item =
                state.signals.find(
                  signal =>
                    String(
                      signal.id
                    ) ===
                    String(
                      button.dataset
                        .intelAi
                    )
                );

              if (item) {
                runAI(
                  item
                );
              }
            }
          );

        }
      );
  }

  function showToast(
    message
  ) {
    let toast =
      document.querySelector(
        "#ez-intel-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-intel-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100000;
        max-width:380px;
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
        4500
      );
  }

  function getMount() {
    return (
      document.querySelector(
        "#intelligence-section"
      ) ||
      document.querySelector(
        "#admin-intelligence-section"
      ) ||
      document.querySelector(
        '[data-admin-section="intelligence"]'
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
      "admin-intelligence-section";

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

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-intelligence-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-intelligence-style";

    style.textContent = `
      #admin-intelligence-section,
      #intelligence-section {
        direction:rtl;
      }

      .ez-intelligence {
        color:#0f172a;
      }

      .ez-intel-header {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:15px;
      }

      .ez-intel-kicker {
        display:inline-block;
        color:#0284c7;
        font-size:8px;
        font-weight:950;
        letter-spacing:.08em;
      }

      .ez-intel-header h2 {
        margin:5px 0 4px;
        color:#075985;
        font-size:27px;
        font-weight:950;
      }

      .ez-intel-header p {
        margin:0;
        color:#64748b;
        font-size:11px;
        line-height:1.8;
      }

      .ez-intel-btn {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border:1px solid #bae6fd;
        border-radius:11px;
        background:#fff;
        color:#0369a1;
        padding:9px 13px;
        cursor:pointer;
        text-decoration:none;
        font-size:9px;
        font-weight:900;
      }

      .ez-intel-btn.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-intel-metrics {
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );
        gap:9px;
        margin-bottom:10px;
      }

      .ez-intel-metric {
        border:1px solid #e0f2fe;
        border-radius:15px;
        background:#fff;
        padding:13px;
      }

      .ez-intel-metric span {
        display:block;
        color:#64748b;
        font-size:8px;
        font-weight:850;
      }

      .ez-intel-metric strong {
        display:block;
        margin:4px 0;
        color:#075985;
        font-size:23px;
        font-weight:950;
      }

      .ez-intel-metric small {
        color:#94a3b8;
        font-size:8px;
      }

      .ez-intel-main {
        display:grid;
        grid-template-columns:
          minmax(0,1fr)
          330px;
        gap:10px;
      }

      .ez-intel-panel {
        border:1px solid #e0f2fe;
        border-radius:16px;
        background:#fff;
        padding:13px;
      }

      .ez-intel-toolbar {
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:11px;
      }

      .ez-intel-toolbar h3,
      .ez-intel-panel-title h3 {
        margin:0;
        color:#075985;
        font-size:13px;
      }

      .ez-intel-toolbar small {
        display:block;
        margin-top:3px;
        color:#94a3b8;
        font-size:8px;
      }

      .ez-intel-filters {
        display:flex;
        gap:6px;
        flex-wrap:wrap;
      }

      .ez-intel-filters input,
      .ez-intel-filters select {
        min-width:130px;
        border:1px solid #bae6fd;
        border-radius:9px;
        outline:none;
        background:#fff;
        color:#334155;
        padding:8px;
        font-size:8px;
      }

      .ez-intel-feed {
        display:grid;
        gap:7px;
      }

      .ez-intel-signal {
        width:100%;
        display:grid;
        grid-template-columns:45px minmax(0,1fr);
        gap:10px;
        border:1px solid #e0f2fe;
        border-radius:13px;
        background:#fff;
        padding:10px;
        text-align:right;
        cursor:pointer;
      }

      .ez-intel-signal:hover,
      .ez-intel-signal.selected {
        border-color:#38bdf8;
        background:#fafdff;
      }

      .ez-intel-signal-score {
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        border-radius:12px;
        background:#eff6ff;
        color:#0284c7;
        font-size:11px;
        font-weight:950;
      }

      .ez-intel-signal-meta {
        display:flex;
        align-items:center;
        gap:5px;
        flex-wrap:wrap;
        margin-bottom:4px;
      }

      .ez-intel-signal-meta > span:not([class*="priority"]) {
        color:#94a3b8;
        font-size:7px;
      }

      .ez-intel-priority-low,
      .ez-intel-priority-medium,
      .ez-intel-priority-high,
      .ez-intel-priority-critical {
        border-radius:999px;
        padding:4px 7px;
        font-size:7px;
        font-weight:950;
      }

      .ez-intel-priority-low {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-intel-priority-medium {
        background:#fffbeb;
        color:#a16207;
      }

      .ez-intel-priority-high {
        background:#fff7ed;
        color:#c2410c;
      }

      .ez-intel-priority-critical {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-intel-signal strong {
        display:block;
        color:#334155;
        font-size:10px;
        line-height:1.7;
      }

      .ez-intel-signal p {
        margin:4px 0;
        color:#64748b;
        font-size:8px;
        line-height:1.7;
      }

      .ez-intel-signal small {
        color:#94a3b8;
        font-size:7px;
      }

      .ez-intel-side {
        display:grid;
        gap:10px;
        align-content:start;
      }

      .ez-intel-panel-title {
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:9px;
      }

      .ez-intel-panel-title span {
        min-width:23px;
        height:23px;
        display:grid;
        place-items:center;
        border-radius:8px;
        background:#eff6ff;
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-intel-topics,
      .ez-intel-sources {
        display:grid;
        gap:6px;
      }

      .ez-intel-topic,
      .ez-intel-source {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        border-radius:10px;
        background:#f8fafc;
        padding:8px;
      }

      .ez-intel-topic strong,
      .ez-intel-source strong {
        display:block;
        color:#334155;
        font-size:9px;
      }

      .ez-intel-topic small,
      .ez-intel-source small {
        display:block;
        margin-top:2px;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-intel-topic-alert {
        min-width:22px;
        height:22px;
        display:grid;
        place-items:center;
        border-radius:7px;
        background:#fff1f2;
        color:#be123c;
        font-size:8px;
        font-weight:950;
      }

      .ez-intel-source b {
        color:#0284c7;
        font-size:10px;
      }

      .ez-intel-muted {
        color:#94a3b8;
        text-align:center;
        padding:15px;
        font-size:8px;
      }

      .ez-intel-selected {
        margin-top:10px;
        border:1px solid #bae6fd;
        border-radius:17px;
        background:#fff;
        padding:14px;
      }

      .ez-intel-selected-header {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
      }

      .ez-intel-selected-header > div > span {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-intel-selected-header h3 {
        margin:5px 0 0;
        color:#075985;
        font-size:16px;
        line-height:1.6;
      }

      .ez-intel-close {
        border:1px solid #e0f2fe;
        border-radius:9px;
        background:#fff;
        color:#64748b;
        padding:7px 10px;
        cursor:pointer;
        font-size:8px;
        font-weight:850;
      }

      .ez-intel-analysis-grid {
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );
        gap:7px;
        margin:12px 0;
      }

      .ez-intel-analysis-grid > div {
        border-radius:11px;
        background:#f8fafc;
        padding:10px;
      }

      .ez-intel-analysis-grid span {
        display:block;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-intel-analysis-grid strong {
        display:block;
        margin-top:3px;
        color:#075985;
        font-size:12px;
      }

      .ez-intel-selected-actions {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
        margin-bottom:12px;
      }

      .ez-intel-duplicates {
        border-top:1px solid #e0f2fe;
        padding-top:11px;
      }

      .ez-intel-duplicates h4 {
        margin:0 0 7px;
        color:#075985;
        font-size:10px;
      }

      .ez-intel-duplicates div {
        border-radius:8px;
        background:#f8fafc;
        color:#475569;
        padding:7px;
        margin-top:5px;
        font-size:8px;
      }

      .ez-intel-duplicates p {
        margin:0;
        color:#94a3b8;
        font-size:8px;
      }

      .ez-intel-empty {
        border:1px dashed #bae6fd;
        border-radius:13px;
        padding:35px;
        background:#fafdff;
        color:#94a3b8;
        text-align:center;
        font-size:9px;
      }

      .ez-intel-footer {
        margin-top:9px;
        color:#94a3b8;
        text-align:center;
        font-size:7px;
      }

      @media (max-width:1000px) {
        .ez-intel-main {
          grid-template-columns:1fr;
        }

        .ez-intel-metrics {
          grid-template-columns:
            repeat(2,1fr);
        }
      }

      @media (max-width:650px) {
        .ez-intel-metrics {
          grid-template-columns:1fr;
        }

        .ez-intel-analysis-grid {
          grid-template-columns:
            repeat(2,1fr);
        }

        .ez-intel-signal {
          grid-template-columns:38px minmax(0,1fr);
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
        "#intelligence-section"
      ) ||
      document.querySelector(
        "#admin-intelligence-section"
      ) ||
      document.querySelector(
        '[data-admin-section="intelligence"]'
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
      "admin-intelligence-section";

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
    loadIntelligence();
  }

  window.EZMediaAdminIntelligence =
    {
      initialize,
      refresh:
        loadIntelligence,
      getState() {
        return {
          ...state,
          signals: [
            ...state.signals
          ],
          topics: [
            ...state.topics
          ],
          sources: [
            ...state.sources
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
