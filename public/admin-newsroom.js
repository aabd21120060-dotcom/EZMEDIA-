"use strict";

/*
 * ============================================================
 * EZ MEDIA 11.0
 * SMART NEWSROOM
 * public/admin-newsroom.js
 *
 * غرفة الأخبار الذكية
 * ============================================================
 */

(() => {

  const NEWSROOM = {

    state: {
      initialized: false,
      loading: false,

      contents: [],
      selectedContent: null,

      filters: {
        search: "",
        type: "",
        status: ""
      },

      aiResult: null,

      stats: {
        total: 0,
        drafts: 0,
        review: 0,
        approved: 0,
        published: 0
      }
    },


    config: {

      endpoints: {
        content: "/api/content",
        ai: "/api/ai",
        media: "/api/media",
        live: "/api/live"
      },

      refreshInterval: 30000

    }

  };


  /* ==========================================================
     أدوات
     ========================================================== */

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }


  function escapeHtml(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function getId(item) {

    return (
      item?.id ||
      item?.content_id ||
      null
    );

  }


  function getTitle(item) {

    return (
      item?.headline ||
      item?.title ||
      "بدون عنوان"
    );

  }


  function getSummary(item) {

    return (
      item?.summary ||
      item?.description ||
      ""
    );

  }


  function getType(item) {

    return String(
      item?.content_type ||
      item?.contentType ||
      item?.type ||
      ""
    ).toLowerCase();

  }


  function getStatus(item) {

    return String(
      item?.status ||
      "draft"
    ).toLowerCase();

  }


  function getDate(item) {

    return (
      item?.published_at ||
      item?.publishedAt ||
      item?.created_at ||
      item?.createdAt ||
      item?.updated_at ||
      item?.updatedAt ||
      null
    );

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

      return "—";

    }

  }


  function statusLabel(status) {

    const labels = {

      draft: "مسودة",
      review: "مراجعة",
      approved: "معتمد",
      scheduled: "مجدول",
      published: "منشور",
      archived: "مؤرشف"

    };

    return (
      labels[status] ||
      status ||
      "غير معروف"
    );

  }


  function typeLabel(type) {

    const labels = {

      news: "خبر",
      report: "تقرير",
      interview: "مقابلة",
      video: "فيديو",
      coverage: "تغطية",
      breaking: "عاجل"

    };

    return (
      labels[type] ||
      type ||
      "محتوى"

    );

  }


  /* ==========================================================
     API
     ========================================================== */

  async function request(
    url,
    options = {}
  ) {

    const response =
      await fetch(
        url,
        {
          ...options,

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            ...(options.headers || {})
          }
        }
      );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    let data;


    if (
      contentType.includes(
        "application/json"
      )
    ) {

      data =
        await response.json();

    } else {

      data =
        await response.text();

    }


    if (!response.ok) {

      const error =
        new Error(
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


  /* ==========================================================
     واجهة غرفة الأخبار
     ========================================================== */

  function mount() {

    let root =
      qs(
        "#newsroom-section"
      );


    if (!root) {

      root =
        qs(
          "#admin-newsroom-section"
        );

    }


    if (!root) {

      root =
        qs(
          '[data-admin-section="newsroom"]'
        );

    }


    if (!root) {

      console.warn(
        "EZ MEDIA Newsroom: لم يتم العثور على الحاوية."
      );

      return false;

    }


    root.innerHTML = `

      <div
        class="ez-newsroom"
        dir="rtl"
      >

        <style>

          .ez-newsroom {
            width: 100%;
            color: #123047;
          }

          .ez-newsroom *,
          .ez-newsroom *::before,
          .ez-newsroom *::after {
            box-sizing: border-box;
          }

          .ez-newsroom-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 22px;
          }

          .ez-newsroom-title {
            margin: 0;
            font-size: 28px;
            font-weight: 900;
          }

          .ez-newsroom-subtitle {
            margin: 5px 0 0;
            color: #60788a;
            font-size: 13px;
          }

          .ez-newsroom-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .ez-nr-button {
            border: 1px solid #dceef7;
            background: #ffffff;
            color: #056ca8;
            min-height: 42px;
            padding: 0 15px;
            border-radius: 13px;
            cursor: pointer;
            font-weight: 800;
          }

          .ez-nr-button:hover {
            background: #effaff;
          }

          .ez-nr-button-primary {
            border: 0;
            color: #ffffff;
            background:
              linear-gradient(
                135deg,
                #0797e6,
                #65d6ff
              );
          }

          .ez-newsroom-stats {
            display: grid;
            grid-template-columns:
              repeat(
                5,
                minmax(0, 1fr)
              );
            gap: 12px;
            margin-bottom: 20px;
          }

          .ez-nr-stat {
            border: 1px solid #dceef7;
            background: #ffffff;
            border-radius: 18px;
            padding: 18px;
          }

          .ez-nr-stat-label {
            color: #60788a;
            font-size: 12px;
          }

          .ez-nr-stat-value {
            margin-top: 4px;
            font-size: 28px;
            font-weight: 900;
          }

          .ez-newsroom-toolbar {
            display: grid;
            grid-template-columns:
              minmax(180px, 1fr)
              180px
              180px
              auto;
            gap: 10px;
            margin-bottom: 18px;
          }

          .ez-nr-input,
          .ez-nr-select {
            width: 100%;
            min-height: 44px;
            border:
              1px solid #dceef7;
            border-radius: 13px;
            background: #ffffff;
            color: #123047;
            padding: 0 13px;
            outline: none;
          }

          .ez-nr-input:focus,
          .ez-nr-select:focus {
            border-color: #65d6ff;
          }

          .ez-newsroom-layout {
            display: grid;
            grid-template-columns:
              minmax(0, 1.3fr)
              minmax(330px, 0.7fr);
            gap: 18px;
          }

          .ez-newsroom-list,
          .ez-newsroom-editor {
            border:
              1px solid #dceef7;
            border-radius: 20px;
            background: #ffffff;
            overflow: hidden;
          }

          .ez-nr-panel-header {
            padding: 18px;
            border-bottom:
              1px solid #e8f3f8;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .ez-nr-panel-title {
            margin: 0;
            font-size: 17px;
            font-weight: 900;
          }

          .ez-nr-list {
            max-height: 650px;
            overflow: auto;
          }

          .ez-nr-item {
            padding: 16px;
            border-bottom:
              1px solid #edf5f9;
            cursor: pointer;
            transition:
              background 0.2s ease;
          }

          .ez-nr-item:hover {
            background: #f7fcff;
          }

          .ez-nr-item-active {
            background: #edfaff;
          }

          .ez-nr-item-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .ez-nr-item-title {
            margin: 0;
            font-size: 15px;
            line-height: 1.5;
            font-weight: 900;
          }

          .ez-nr-item-summary {
            margin-top: 7px;
            color: #60788a;
            font-size: 12px;
            line-height: 1.6;
          }

          .ez-nr-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
          }

          .ez-nr-badge {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            background: #edf9ff;
            color: #056ca8;
            font-size: 10px;
            font-weight: 900;
          }

          .ez-nr-badge-status {
            background: #f1f8fb;
            color: #60788a;
          }

          .ez-nr-editor {
            padding: 20px;
          }

          .ez-nr-empty {
            min-height: 350px;
            display: grid;
            place-items: center;
            text-align: center;
            padding: 30px;
            color: #60788a;
          }

          .ez-nr-field {
            margin-bottom: 15px;
          }

          .ez-nr-label {
            display: block;
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: 900;
          }

          .ez-nr-textarea {
            width: 100%;
            min-height: 120px;
            resize: vertical;
            border:
              1px solid #dceef7;
            border-radius: 13px;
            padding: 12px;
            color: #123047;
            background: #ffffff;
            outline: none;
          }

          .ez-nr-title-input {
            width: 100%;
            min-height: 48px;
            border:
              1px solid #dceef7;
            border-radius: 13px;
            padding: 0 13px;
            color: #123047;
            background: #ffffff;
            font-size: 15px;
            font-weight: 800;
            outline: none;
          }

          .ez-nr-editor-actions {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 18px;
          }

          .ez-nr-ai {
            margin-top: 20px;
            padding-top: 20px;
            border-top:
              1px solid #e8f3f8;
          }

          .ez-nr-ai-title {
            margin: 0 0 12px;
            font-size: 16px;
            font-weight: 900;
          }

          .ez-nr-ai-card {
            border:
              1px solid #dceef7;
            border-radius: 16px;
            background:
              linear-gradient(
                135deg,
                #f3fcff,
                #ffffff
              );
            padding: 14px;
          }

          .ez-nr-ai-row {
            margin-bottom: 12px;
          }

          .ez-nr-ai-label {
            display: block;
            color: #056ca8;
            font-size: 11px;
            font-weight: 900;
            margin-bottom: 4px;
          }

          .ez-nr-ai-value {
            font-size: 13px;
            line-height: 1.7;
            white-space: pre-wrap;
          }

          .ez-nr-confidence {
            display: inline-flex;
            margin-top: 8px;
            padding: 5px 9px;
            border-radius: 999px;
            background: #e8f9ff;
            color: #056ca8;
            font-size: 11px;
            font-weight: 900;
          }

          @media (max-width: 1000px) {

            .ez-newsroom-layout {
              grid-template-columns: 1fr;
            }

            .ez-newsroom-stats {
              grid-template-columns:
                repeat(3, 1fr);
            }

          }

          @media (max-width: 700px) {

            .ez-newsroom-header {
              flex-direction: column;
              align-items: stretch;
            }

            .ez-newsroom-toolbar {
              grid-template-columns: 1fr;
            }

            .ez-newsroom-stats {
              grid-template-columns:
                repeat(2, 1fr);
            }

          }

        </style>


        <div class="ez-newsroom-header">

          <div>

            <h2 class="ez-newsroom-title">
              غرفة الأخبار الذكية
            </h2>

            <p class="ez-newsroom-subtitle">
              مركز موحد لإدارة دورة المحتوى من المسودة إلى النشر
            </p>

          </div>


          <div class="ez-newsroom-actions">

            <button
              type="button"
              class="ez-nr-button"
              data-nr-action="refresh"
            >
              تحديث
            </button>

            <button
              type="button"
              class="ez-nr-button ez-nr-button-primary"
              data-nr-action="new"
            >
              + محتوى جديد
            </button>

          </div>

        </div>


        <div class="ez-newsroom-stats">

          <div class="ez-nr-stat">

            <div class="ez-nr-stat-label">
              إجمالي المحتوى
            </div>

            <div
              class="ez-nr-stat-value"
              id="ez-nr-stat-total"
            >
              0
            </div>

          </div>


          <div class="ez-nr-stat">

            <div class="ez-nr-stat-label">
              المسودات
            </div>

            <div
              class="ez-nr-stat-value"
              id="ez-nr-stat-drafts"
            >
              0
            </div>

          </div>


          <div class="ez-nr-stat">

            <div class="ez-nr-stat-label">
              قيد المراجعة
            </div>

            <div
              class="ez-nr-stat-value"
              id="ez-nr-stat-review"
            >
              0
            </div>

          </div>


          <div class="ez-nr-stat">

            <div class="ez-nr-stat-label">
              معتمد
            </div>

            <div
              class="ez-nr-stat-value"
              id="ez-nr-stat-approved"
            >
              0
            </div>

          </div>


          <div class="ez-nr-stat">

            <div class="ez-nr-stat-label">
              منشور
            </div>

            <div
              class="ez-nr-stat-value"
              id="ez-nr-stat-published"
            >
              0
            </div>

          </div>

        </div>


        <div class="ez-newsroom-toolbar">

          <input
            id="ez-nr-search"
            class="ez-nr-input"
            type="search"
            placeholder="ابحث في غرفة الأخبار..."
          >


          <select
            id="ez-nr-type"
            class="ez-nr-select"
          >

            <option value="">
              كل أنواع المحتوى
            </option>

            <option value="news">
              أخبار
            </option>

            <option value="report">
              تقارير
            </option>

            <option value="interview">
              مقابلات
            </option>

            <option value="video">
              فيديو
            </option>

            <option value="coverage">
              تغطيات
            </option>

            <option value="breaking">
              عاجل
            </option>

          </select>


          <select
            id="ez-nr-status"
            class="ez-nr-select"
          >

            <option value="">
              كل الحالات
            </option>

            <option value="draft">
              مسودة
            </option>

            <option value="review">
              مراجعة
            </option>

            <option value="approved">
              معتمد
            </option>

            <option value="scheduled">
              مجدول
            </option>

            <option value="published">
              منشور
            </option>

            <option value="archived">
              مؤرشف
            </option>

          </select>


          <button
            type="button"
            class="ez-nr-button"
            data-nr-action="clear"
          >
            مسح
          </button>

        </div>


        <div class="ez-newsroom-layout">


          <section class="ez-newsroom-list">

            <div class="ez-nr-panel-header">

              <h3 class="ez-nr-panel-title">
                المحتوى
              </h3>

              <span
                id="ez-nr-count"
                class="ez-nr-badge"
              >
                0
              </span>

            </div>


            <div
              id="ez-nr-list"
              class="ez-nr-list"
            >

              <div class="ez-nr-empty">
                جاري تحميل المحتوى...
              </div>

            </div>

          </section>


          <section class="ez-newsroom-editor">

            <div
              id="ez-nr-editor"
              class="ez-nr-editor"
            >

              <div class="ez-nr-empty">

                <div>

                  <div
                    style="
                      font-size:42px;
                      margin-bottom:12px;
                    "
                  >
                    📰
                  </div>

                  <strong>
                    اختر مادة إعلامية
                  </strong>

                  <div
                    style="
                      margin-top:7px;
                      font-size:12px;
                    "
                  >
                    ستظهر هنا أدوات التحرير والذكاء الاصطناعي
                  </div>

                </div>

              </div>

            </div>

          </section>


        </div>

      </div>

    `;


    return true;

  }


  /* ==========================================================
     تحميل المحتوى
     ========================================================== */

  async function loadContent() {

    NEWSROOM.state.loading =
      true;


    try {

      const data =
        await request(
          `${NEWSROOM.config.endpoints.content}?limit=100`
        );


      if (
        Array.isArray(data)
      ) {

        NEWSROOM.state.contents =
          data;

      } else if (
        Array.isArray(data?.items)
      ) {

        NEWSROOM.state.contents =
          data.items;

      } else if (
        Array.isArray(data?.content)
      ) {

        NEWSROOM.state.contents =
          data.content;

      } else if (
        Array.isArray(data?.data)
      ) {

        NEWSROOM.state.contents =
          data.data;

      } else {

        NEWSROOM.state.contents =
          [];

      }


      calculateStats();

      renderList();

    } catch (error) {

      console.error(
        "EZ MEDIA Newsroom load error:",
        error
      );


      const list =
        qs(
          "#ez-nr-list"
        );


      if (list) {

        list.innerHTML = `

          <div class="ez-nr-empty">

            تعذر تحميل المحتوى.

            <br>

            <small>
              ${escapeHtml(
                error.message
              )}
            </small>

          </div>

        `;

      }

    } finally {

      NEWSROOM.state.loading =
        false;

    }

  }


  /* ==========================================================
     الإحصاءات
     ========================================================== */

  function calculateStats() {

    const contents =
      NEWSROOM.state.contents;


    NEWSROOM.state.stats = {

      total:
        contents.length,

      drafts:
        contents.filter(
          item =>
            getStatus(item) === "draft"
        ).length,

      review:
        contents.filter(
          item =>
            getStatus(item) === "review"
        ).length,

      approved:
        contents.filter(
          item =>
            getStatus(item) === "approved"
        ).length,

      published:
        contents.filter(
          item =>
            getStatus(item) === "published"
        ).length

    };


    const map = {

      total:
        "ez-nr-stat-total",

      drafts:
        "ez-nr-stat-drafts",

      review:
        "ez-nr-stat-review",

      approved:
        "ez-nr-stat-approved",

      published:
        "ez-nr-stat-published"

    };


    Object.keys(map)
      .forEach(
        key => {

          const element =
            qs(
              `#${map[key]}`
            );

          if (element) {

            element.textContent =
              NEWSROOM.state.stats[key];

          }

        }
      );

  }


  /* ==========================================================
     التصفية
     ========================================================== */

  function getFilteredContents() {

    const {
      search,
      type,
      status
    } =
      NEWSROOM.state.filters;


    const query =
      search
        .trim()
        .toLowerCase();


    return NEWSROOM.state.contents
      .filter(
        item => {

          if (
            type &&
            getType(item) !== type
          ) {
            return false;
          }


          if (
            status &&
            getStatus(item) !== status
          ) {
            return false;
          }


          if (query) {

            const haystack =
              [
                getTitle(item),
                getSummary(item),
                item?.category,
                item?.keywords
              ]
                .flat()
                .join(" ")
                .toLowerCase();


            if (
              !haystack.includes(
                query
              )
            ) {

              return false;

            }

          }


          return true;

        }
      );

  }


  /* ==========================================================
     عرض القائمة
     ========================================================== */

  function renderList() {

    const list =
      qs(
        "#ez-nr-list"
      );


    const count =
      qs(
        "#ez-nr-count"
      );


    if (!list) {
      return;
    }


    const items =
      getFilteredContents();


    if (count) {

      count.textContent =
        items.length;

    }


    if (!items.length) {

      list.innerHTML = `

        <div class="ez-nr-empty">

          لا توجد مواد تطابق البحث الحالي.

        </div>

      `;

      return;

    }


    list.innerHTML =
      items
        .map(
          item => {

            const id =
              getId(item);

            const active =
              NEWSROOM.state.selectedContent &&
              getId(
                NEWSROOM.state.selectedContent
              ) === id;


            return `

              <article
                class="
                  ez-nr-item
                  ${active
                    ? "ez-nr-item-active"
                    : ""}
                "
                data-content-id="${escapeHtml(id)}"
              >

                <div class="ez-nr-item-top">

                  <h4
                    class="ez-nr-item-title"
                  >
                    ${escapeHtml(
                      getTitle(item)
                    )}
                  </h4>

                </div>


                <div
                  class="ez-nr-item-summary"
                >
                  ${escapeHtml(
                    getSummary(item)
                      .replace(/\s+/g, " ")
                      .slice(0, 160)
                  )}
                </div>


                <div
                  class="ez-nr-badges"
                >

                  <span
                    class="ez-nr-badge"
                  >
                    ${escapeHtml(
                      typeLabel(
                        getType(item)
                      )
                    )}
                  </span>


                  <span
                    class="
                      ez-nr-badge
                      ez-nr-badge-status
                    "
                  >
                    ${escapeHtml(
                      statusLabel(
                        getStatus(item)
                      )
                    )}
                  </span>


                  <span
                    class="ez-nr-badge"
                  >
                    ${escapeHtml(
                      formatDate(
                        getDate(item)
                      )
                    )}
                  </span>

                </div>

              </article>

            `;

          }
        )
        .join("");


    list
      .querySelectorAll(
        "[data-content-id]"
      )
      .forEach(
        element => {

          element.addEventListener(
            "click",
            () => {

              selectContent(
                element.dataset.contentId
              );

            }
          );

        }
      );

  }


  /* ==========================================================
     اختيار المحتوى
     ========================================================== */

  function selectContent(id) {

    const item =
      NEWSROOM.state.contents
        .find(
          content =>
            String(
              getId(content)
            ) === String(id)
        );


    if (!item) {
      return;
    }


    NEWSROOM.state.selectedContent =
      item;


    renderList();

    renderEditor(
      item
    );

  }


  /* ==========================================================
     المحرر
     ========================================================== */

  function renderEditor(item) {

    const editor =
      qs(
        "#ez-nr-editor"
      );


    if (!editor) {
      return;
    }


    const id =
      getId(item);


    editor.innerHTML = `

      <div>

        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:10px;
            align-items:flex-start;
            margin-bottom:18px;
          "
        >

          <div>

            <div
              class="ez-nr-badge"
              style="margin-bottom:8px;"
            >
              ${escapeHtml(
                typeLabel(
                  getType(item)
                )
              )}
            </div>

            <h3
              style="
                margin:0;
                font-size:20px;
              "
            >
              تحرير المحتوى
            </h3>

          </div>

          <span
            class="
              ez-nr-badge
              ez-nr-badge-status
            "
          >
            ${escapeHtml(
              statusLabel(
                getStatus(item)
              )
            )}
          </span>

        </div>


        <div class="ez-nr-field">

          <label
            class="ez-nr-label"
            for="ez-nr-title-editor"
          >
            العنوان
          </label>

          <input
            id="ez-nr-title-editor"
            class="ez-nr-title-input"
            value="${escapeHtml(
              getTitle(item)
            )}"
          >

        </div>


        <div class="ez-nr-field">

          <label
            class="ez-nr-label"
            for="ez-nr-summary-editor"
          >
            الملخص
          </label>

          <textarea
            id="ez-nr-summary-editor"
            class="ez-nr-textarea"
          >${escapeHtml(
            getSummary(item)
          )}</textarea>

        </div>


        <div
          style="
            color:#60788a;
            font-size:11px;
            margin-top:8px;
          "
        >
          آخر تحديث:
          ${escapeHtml(
            formatDate(
              getDate(item)
            )
          )}
        </div>


        <div class="ez-nr-editor-actions">

          <button
            type="button"
            class="ez-nr-button ez-nr-button-primary"
            data-editor-action="save"
          >
            حفظ
          </button>


          <button
            type="button"
            class="ez-nr-button"
            data-editor-action="ai"
          >
            ✦ تحليل بالذكاء الاصطناعي
          </button>


          <button
            type="button"
            class="ez-nr-button"
            data-editor-action="review"
          >
            إرسال للمراجعة
          </button>


          <button
            type="button"
            class="ez-nr-button"
            data-editor-action="approve"
          >
            اعتماد
          </button>


          <button
            type="button"
            class="ez-nr-button"
            data-editor-action="publish"
          >
            نشر
          </button>


          <button
            type="button"
            class="ez-nr-button"
            data-editor-action="archive"
          >
            أرشفة
          </button>

        </div>


        <div class="ez-nr-ai">

          <h4 class="ez-nr-ai-title">
            نتائج الذكاء الاصطناعي
          </h4>


          <div
            id="ez-nr-ai-result"
            class="ez-nr-ai-card"
          >

            <div
              style="
                color:#60788a;
                font-size:12px;
              "
            >
              لم يتم تحليل هذه المادة بعد.
            </div>

          </div>

        </div>

      </div>

    `;


    editor
      .querySelectorAll(
        "[data-editor-action]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              handleEditorAction(
                button.dataset.editorAction
              );

            }
          );

        }
      );


    if (
      NEWSROOM.state.aiResult
    ) {

      renderAIResult(
        NEWSROOM.state.aiResult
      );

    }

  }


  /* ==========================================================
     حفظ
     ========================================================== */

  async function saveContent() {

    const item =
      NEWSROOM.state.selectedContent;


    if (!item) {
      return;
    }


    const id =
      getId(item);


    const title =
      qs(
        "#ez-nr-title-editor"
      )?.value
      ?.trim();


    const summary =
      qs(
        "#ez-nr-summary-editor"
      )?.value
      ?.trim();


    if (!title) {

      alert(
        "اكتب عنوان المحتوى أولًا."
      );

      return;

    }


    try {

      const updated =
        await request(
          `${NEWSROOM.config.endpoints.content}/${encodeURIComponent(id)}`,
          {
            method: "PATCH",

            body:
              JSON.stringify({
                headline: title,
                summary
              })
          }
        );


      const replacement =
        updated?.content ||
        updated?.item ||
        updated?.data ||
        updated;


      const index =
        NEWSROOM.state.contents
          .findIndex(
            content =>
              String(
                getId(content)
              ) === String(id)
          );


      if (
        index !== -1 &&
        replacement
      ) {

        NEWSROOM.state.contents[index] =
          replacement;

        NEWSROOM.state.selectedContent =
          replacement;

      }


      calculateStats();

      renderList();

      renderEditor(
        NEWSROOM.state.selectedContent
      );


      alert(
        "تم حفظ المحتوى."
      );

    } catch (error) {

      console.error(
        error
      );

      alert(
        "تعذر حفظ المحتوى."
      );

    }

  }


  /* ==========================================================
     تغيير حالة المحتوى
     ========================================================== */

  async function changeStatus(
    action
  ) {

    const item =
      NEWSROOM.state.selectedContent;


    if (!item) {
      return;
    }


    const id =
      getId(item);


    let endpoint;


    switch (action) {

      case "review":
        endpoint =
          `${NEWSROOM.config.endpoints.content}/${id}/submit-review`;
        break;

      case "approve":
        endpoint =
          `${NEWSROOM.config.endpoints.content}/${id}/approve`;
        break;

      case "publish":
        endpoint =
          `${NEWSROOM.config.endpoints.content}/${id}/publish`;
        break;

      case "archive":
        endpoint =
          `${NEWSROOM.config.endpoints.content}/${id}/archive`;
        break;

      default:
        return;

    }


    try {

      const result =
        await request(
          endpoint,
          {
            method: "POST",
            body: JSON.stringify({})
          }
        );


      const updated =
        result?.content ||
        result?.item ||
        result?.data ||
        result;


      const index =
        NEWSROOM.state.contents
          .findIndex(
            content =>
              String(
                getId(content)
              ) === String(id)
          );


      if (
        index !== -1 &&
        updated
      ) {

        NEWSROOM.state.contents[index] =
          updated;

        NEWSROOM.state.selectedContent =
          updated;

      }


      calculateStats();

      renderList();

      renderEditor(
        NEWSROOM.state.selectedContent
      );


    } catch (error) {

      console.error(
        "EZ MEDIA Newsroom status error:",
        error
      );


      alert(
        "تعذر تغيير حالة المحتوى."
      );

    }

  }


  /* ==========================================================
     الذكاء الاصطناعي
     ========================================================== */

  async function analyzeWithAI() {

    const item =
      NEWSROOM.state.selectedContent;


    if (!item) {
      return;
    }


    const id =
      getId(item);


    const resultBox =
      qs(
        "#ez-nr-ai-result"
      );


    if (resultBox) {

      resultBox.innerHTML = `

        <div
          style="
            color:#056ca8;
            font-weight:900;
          "
        >
          جاري تحليل المادة بالذكاء الاصطناعي...
        </div>

      `;

    }


    try {

      const result =
        await request(
          `${NEWSROOM.config.endpoints.ai}/content/${encodeURIComponent(id)}/analyze`,
          {
            method: "POST",

            body:
              JSON.stringify({})
          }
        );


      const ai =
        result?.analysis ||
        result?.result ||
        result?.data ||
        result;


      NEWSROOM.state.aiResult =
        ai;


      renderAIResult(
        ai
      );


    } catch (error) {

      console.error(
        "EZ MEDIA AI error:",
        error
      );


      if (resultBox) {

        resultBox.innerHTML = `

          <div
            style="
              color:#b44949;
              font-size:12px;
            "
          >
            تعذر تنفيذ تحليل الذكاء الاصطناعي.
          </div>

        `;

      }

    }

  }


  /* ==========================================================
     عرض نتيجة AI
     ========================================================== */

  function renderAIResult(
    result
  ) {

    const box =
      qs(
        "#ez-nr-ai-result"
      );


    if (!box || !result) {
      return;
    }


    const keywords =
      Array.isArray(
        result.keywords
      )
        ? result.keywords.join(
            "، "
          )
        : (
            result.keywords ||
            "—"
          );


    const social =
      Array.isArray(
        result.social_posts
      )
        ? result.social_posts
            .map(
              post =>
                typeof post === "string"
                  ? post
                  : JSON.stringify(
                      post
                    )
            )
            .join(
              "\n\n"
            )
        : (
            result.social_posts ||
            "—"
          );


    const risks =
      Array.isArray(
        result.risk_flags
      )
        ? result.risk_flags.join(
            "، "
          )
        : (
            result.risk_flags ||
            "لا توجد إشارات مخاطر."
          );


    box.innerHTML = `

      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          العنوان المقترح
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            result.headline ||
            "—"
          )}
        </div>

      </div>


      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          الملخص
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            result.summary ||
            "—"
          )}
        </div>

      </div>


      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          التصنيف
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            result.category ||
            "—"
          )}
        </div>

      </div>


      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          الكلمات المفتاحية
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            keywords
          )}
        </div>

      </div>


      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          منشورات التواصل
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            social
          )}
        </div>

      </div>


      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          وصف الفيديو
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            result.video_description ||
            "—"
          )}
        </div>

      </div>


      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          ملاحظات التحرير
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            result.editor_notes ||
            "—"
          )}
        </div>

      </div>


      <div class="ez-nr-ai-row">

        <span class="ez-nr-ai-label">
          إشارات المخاطر
        </span>

        <div class="ez-nr-ai-value">
          ${escapeHtml(
            risks
          )}
        </div>

      </div>


      ${
        result.confidence !== undefined
          ? `
            <span class="ez-nr-confidence">
              مستوى الثقة:
              ${escapeHtml(
                result.confidence
              )}
            </span>
          `
          : ""
      }

    `;

  }


  /* ==========================================================
     محتوى جديد
     ========================================================== */

  async function createNewContent() {

    const type =
      prompt(
        "نوع المحتوى:\nnews / report / interview / video / coverage / breaking",
        "news"
      );


    if (!type) {
      return;
    }


    const title =
      prompt(
        "عنوان المحتوى:",
        ""
      );


    if (!title) {
      return;
    }


    try {

      const result =
        await request(
          NEWSROOM.config.endpoints.content,
          {
            method: "POST",

            body:
              JSON.stringify({
                content_type:
                  type.trim().toLowerCase(),

                headline:
                  title.trim(),

                summary:
                  "",

                status:
                  "draft"
              })
          }
        );


      const created =
        result?.content ||
        result?.item ||
        result?.data ||
        result;


      if (created) {

        NEWSROOM.state.contents
          .unshift(
            created
          );

        calculateStats();

        renderList();

        selectContent(
          getId(
            created
          )
        );

      }

    } catch (error) {

      console.error(
        "EZ MEDIA create content error:",
        error
      );


      alert(
        "تعذر إنشاء المحتوى."
      );

    }

  }


  /* ==========================================================
     إجراءات المحرر
     ========================================================== */

  function handleEditorAction(
    action
  ) {

    switch (action) {

      case "save":
        saveContent();
        break;

      case "ai":
        analyzeWithAI();
        break;

      case "review":
        changeStatus(
          "review"
        );
        break;

      case "approve":
        changeStatus(
          "approve"
        );
        break;

      case "publish":
        changeStatus(
          "publish"
        );
        break;

      case "archive":
        changeStatus(
          "archive"
        );
        break;

      default:
        break;

    }

  }


  /* ==========================================================
     الأحداث
     ========================================================== */

  function setupEvents() {

    const root =
      document;


    root.addEventListener(
      "click",
      event => {

        const actionElement =
          event.target.closest(
            "[data-nr-action]"
          );


        if (!actionElement) {
          return;
        }


        const action =
          actionElement.dataset.nrAction;


        if (
          action === "refresh"
        ) {

          loadContent();

        }


        if (
          action === "new"
        ) {

          createNewContent();

        }


        if (
          action === "clear"
        ) {

          const search =
            qs(
              "#ez-nr-search"
            );

          const type =
            qs(
              "#ez-nr-type"
            );

          const status =
            qs(
              "#ez-nr-status"
            );


          if (search) {
            search.value = "";
          }

          if (type) {
            type.value = "";
          }

          if (status) {
            status.value = "";
          }


          NEWSROOM.state.filters = {

            search: "",
            type: "",
            status: ""

          };


          renderList();

        }

      }
    );


    const search =
      qs(
        "#ez-nr-search"
      );


    if (search) {

      search.addEventListener(
        "input",
        () => {

          NEWSROOM.state.filters.search =
            search.value;

          renderList();

        }
      );

    }


    const type =
      qs(
        "#ez-nr-type"
      );


    if (type) {

      type.addEventListener(
        "change",
        () => {

          NEWSROOM.state.filters.type =
            type.value;

          renderList();

        }
      );

    }


    const status =
      qs(
        "#ez-nr-status"
      );


    if (status) {

      status.addEventListener(
        "change",
        () => {

          NEWSROOM.state.filters.status =
            status.value;

          renderList();

        }
      );

    }

  }


  /* ==========================================================
     تحديث تلقائي
     ========================================================== */

  function startAutoRefresh() {

    setInterval(
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {

          loadContent();

        }

      },
      NEWSROOM.config.refreshInterval
    );

  }


  /* ==========================================================
     التهيئة
     ========================================================== */

  async function init() {

    if (
      NEWSROOM.state.initialized
    ) {
      return;
    }


    const mounted =
      mount();


    if (!mounted) {
      return;
    }


    NEWSROOM.state.initialized =
      true;


    setupEvents();

    await loadContent();

    startAutoRefresh();


    window.EZMediaNewsroom =
      NEWSROOM;

  }


  /* ==========================================================
     التشغيل
     ========================================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      () => {

        init()
          .catch(
            error => {

              console.error(
                "EZ MEDIA Newsroom initialization failed:",
                error
              );

            }
          );

      },
      {
        once: true
      }
    );

  } else {

    init()
      .catch(
        error => {

          console.error(
            "EZ MEDIA Newsroom initialization failed:",
            error
          );

        }
      );

  }

})();
