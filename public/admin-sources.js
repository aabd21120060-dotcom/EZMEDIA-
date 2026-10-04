"use strict";

(function () {
  const VERSION = "11.0.0";

  const STORAGE_KEY =
    "ez_media_sources_v11";

  const state = {
    sources: [],
    selected: null,
    search: "",
    type: "all",
    status: "all",
    loading: false,
    lastUpdate: null,
    editing: false
  };

  const SOURCE_TYPES = {
    official: "مصدر رسمي",
    agency: "وكالة أنباء",
    newsroom: "غرفة أخبار",
    rss: "RSS",
    api: "API",
    social: "منصة اجتماعية",
    internal: "مصدر داخلي",
    broadcast: "بث",
    other: "أخرى"
  };

  const STATUS = {
    active: "نشط",
    paused: "متوقف مؤقتًا",
    disabled: "معطل",
    pending: "بانتظار الربط",
    error: "به مشكلة"
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

  function getToken() {
    return (
      window.EZMediaAdminCore
        ?.getToken?.() ||
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
      return String(value);
    }
  }

  function uid() {
    return (
      "src_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 9)
    );
  }

  function loadStoredSources() {
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

      return Array.isArray(
        data
      )
        ? data
        : [];
    } catch {
      return [];
    }
  }

  function saveSources() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state.sources
        )
      );
    } catch (error) {
      console.error(
        "EZ MEDIA Sources storage error:",
        error
      );
    }
  }

  function seedSources() {
    const existing =
      loadStoredSources();

    if (existing.length) {
      state.sources =
        existing;

      return;
    }

    state.sources = [
      {
        id: uid(),
        name:
          "المصدر الرسمي الرئيسي",
        type:
          "official",
        url: "",
        description:
          "مصدر رسمي تتم إضافته وربطه من إدارة المنصة.",
        status:
          "pending",
        priority:
          "high",
        enabled:
          true,
        verified:
          false,
        syncInterval:
          15,
        lastSync:
          null,
        items:
          0,
        errors:
          0,
        createdAt:
          new Date().toISOString()
      }
    ];

    saveSources();
  }

  function filteredSources() {
    return state.sources.filter(
      source => {

        if (
          state.type !==
          "all" &&
          source.type !==
            state.type
        ) {
          return false;
        }

        if (
          state.status !==
          "all" &&
          source.status !==
            state.status
        ) {
          return false;
        }

        if (
          state.search
        ) {
          const text =
            [
              source.name,
              source.url,
              source.description,
              SOURCE_TYPES[
                source.type
              ]
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

  function metrics() {
    return {
      total:
        state.sources.length,

      active:
        state.sources.filter(
          source =>
            source.status ===
            "active"
        ).length,

      verified:
        state.sources.filter(
          source =>
            source.verified
        ).length,

      errors:
        state.sources.filter(
          source =>
            source.status ===
            "error"
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

    const sources =
      filteredSources();

    mount.innerHTML = `
      <div
        class="ez-sources"
      >

        <header
          class="ez-sources-header"
        >

          <div>
            <span
              class="ez-sources-kicker"
            >
              EZ MEDIA SOURCE CONTROL
            </span>

            <h2>
              مركز المصادر والموصلات
            </h2>

            <p>
              إدارة مصادر الأخبار والـ RSS والـ APIs والمصادر الرسمية قبل إدخالها إلى منظومة الذكاء الإعلامي.
            </p>
          </div>

          <div
            class="ez-sources-actions"
          >

            <button
              class="ez-source-btn primary"
              data-source-add
            >
              إضافة مصدر
            </button>

            <button
              class="ez-source-btn"
              data-source-refresh
            >
              تحديث
            </button>

          </div>

        </header>

        <div
          class="ez-source-metrics"
        >

          ${metric(
            "إجمالي المصادر",
            m.total
          )}

          ${metric(
            "نشطة",
            m.active
          )}

          ${metric(
            "موثقة",
            m.verified
          )}

          ${metric(
            "مشكلات",
            m.errors
          )}

        </div>

        <section
          class="ez-source-panel"
        >

          <div
            class="ez-source-toolbar"
          >

            <input
              id="ez-source-search"
              type="search"
              placeholder="البحث عن مصدر..."
              value="${escapeHtml(
                state.search
              )}"
            />

            <select
              id="ez-source-type"
            >

              <option
                value="all"
              >
                كل الأنواع
              </option>

              ${Object.entries(
                SOURCE_TYPES
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
              id="ez-source-status"
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
            class="ez-source-table-wrap"
          >

            <table
              class="ez-source-table"
            >

              <thead>
                <tr>
                  <th>المصدر</th>
                  <th>النوع</th>
                  <th>الأولوية</th>
                  <th>الحالة</th>
                  <th>المواد</th>
                  <th>آخر مزامنة</th>
                  <th>إجراء</th>
                </tr>
              </thead>

              <tbody>

                ${
                  sources.length
                    ? sources
                        .map(
                          renderSource
                        )
                        .join("")
                    : `
                      <tr>
                        <td
                          colspan="7"
                          class="ez-source-empty"
                        >
                          لا توجد مصادر مطابقة.
                        </td>
                      </tr>
                    `
                }

              </tbody>

            </table>

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
          class="ez-source-footer"
        >
          الإصدار:
          ${VERSION}
          •
          آخر تحديث:
          ${
            state.lastUpdate
              ? formatDate(
                  state.lastUpdate
                )
              : "لم يتم التحديث"
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
        class="ez-source-metric"
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

  function renderSource(
    source
  ) {
    return `
      <tr>

        <td>

          <button
            class="ez-source-name"
            data-source-view="${escapeHtml(
              source.id
            )}"
          >

            <span
              class="ez-source-icon"
            >
              ${
                source.verified
                  ? "✓"
                  : "○"
              }
            </span>

            <span>

              <strong>
                ${escapeHtml(
                  source.name
                )}
              </strong>

              <small>
                ${escapeHtml(
                  source.url ||
                  "لم تتم إضافة رابط"
                )}
              </small>

            </span>

          </button>

        </td>

        <td>
          <span
            class="ez-source-type"
          >
            ${
              SOURCE_TYPES[
                source.type
              ] ||
              source.type
            }
          </span>
        </td>

        <td>
          <span
            class="${priorityClass(
              source.priority
            )}"
          >
            ${
              PRIORITIES[
                source.priority
              ] ||
              source.priority
            }
          </span>
        </td>

        <td>
          <span
            class="${statusClass(
              source.status
            )}"
          >
            ${
              STATUS[
                source.status
              ] ||
              source.status
            }
          </span>
        </td>

        <td>
          <strong
            class="ez-source-count"
          >
            ${source.items || 0}
          </strong>
        </td>

        <td>
          <small
            class="ez-source-date"
          >
            ${formatDate(
              source.lastSync
            )}
          </small>
        </td>

        <td>

          <div
            class="ez-source-row-actions"
          >

            <button
              data-source-edit="${escapeHtml(
                source.id
              )}"
            >
              تعديل
            </button>

            <button
              data-source-test="${escapeHtml(
                source.id
              )}"
            >
              اختبار
            </button>

            <button
              data-source-toggle="${escapeHtml(
                source.id
              )}"
            >
              ${
                source.status ===
                "active"
                  ? "إيقاف"
                  : "تفعيل"
              }
            </button>

            <button
              class="danger"
              data-source-delete="${escapeHtml(
                source.id
              )}"
            >
              حذف
            </button>

          </div>

        </td>

      </tr>
    `;
  }

  function renderEditor() {
    const source =
      state.selected ||
      {
        id: "",
        name: "",
        type: "official",
        url: "",
        description: "",
        status: "pending",
        priority: "medium",
        enabled: true,
        verified: false,
        syncInterval: 15,
        lastSync: null,
        items: 0,
        errors: 0
      };

    return `
      <div
        class="ez-source-overlay"
      >

        <section
          class="ez-source-editor"
        >

          <div
            class="ez-source-editor-header"
          >

            <div>
              <span>
                إدارة الموصل
              </span>

              <h3>
                ${
                  source.id
                    ? "تعديل المصدر"
                    : "إضافة مصدر جديد"
                }
              </h3>
            </div>

            <button
              data-source-close
            >
              إغلاق
            </button>

          </div>

          <form
            id="ez-source-form"
          >

            <input
              type="hidden"
              name="id"
              value="${escapeHtml(
                source.id
              )}"
            />

            <div
              class="ez-source-form-grid"
            >

              <label>
                <span>اسم المصدر</span>

                <input
                  name="name"
                  required
                  value="${escapeHtml(
                    source.name
                  )}"
                  placeholder="مثال: مصدر رسمي"
                />
              </label>

              <label>
                <span>نوع المصدر</span>

                <select
                  name="type"
                >

                  ${Object.entries(
                    SOURCE_TYPES
                  )
                    .map(
                      ([key, label]) =>
                        `
                          <option
                            value="${key}"
                            ${
                              source.type ===
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
                  رابط المصدر
                </span>

                <input
                  name="url"
                  type="url"
                  value="${escapeHtml(
                    source.url
                  )}"
                  placeholder="https://..."
                />
              </label>

              <label>
                <span>الأولوية</span>

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
                              source.priority ===
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
                  فترة المزامنة بالدقائق
                </span>

                <input
                  name="syncInterval"
                  type="number"
                  min="1"
                  max="1440"
                  value="${escapeHtml(
                    source.syncInterval ||
                    15
                  )}"
                />
              </label>

              <label
                class="full"
              >
                <span>
                  وصف المصدر
                </span>

                <textarea
                  name="description"
                  rows="4"
                  placeholder="وصف وظيفة المصدر ومجاله..."
                >${escapeHtml(
                  source.description
                )}</textarea>
              </label>

              <label
                class="ez-source-check"
              >

                <input
                  name="enabled"
                  type="checkbox"
                  ${
                    source.enabled
                      ? "checked"
                      : ""
                  }
                />

                <span>
                  تفعيل المصدر
                </span>

              </label>

              <label
                class="ez-source-check"
              >

                <input
                  name="verified"
                  type="checkbox"
                  ${
                    source.verified
                      ? "checked"
                      : ""
                  }
                />

                <span>
                  مصدر موثوق ومراجع
                </span>

              </label>

            </div>

            <div
              class="ez-source-form-actions"
            >

              <button
                type="button"
                data-source-close
              >
                إلغاء
              </button>

              <button
                type="submit"
                class="primary"
              >
                حفظ المصدر
              </button>

            </div>

          </form>

        </section>

      </div>
    `;
  }

  function renderDetails() {
    const source =
      state.selected;

    if (!source) {
      return "";
    }

    return `
      <section
        class="ez-source-details"
      >

        <div
          class="ez-source-details-head"
        >

          <div>

            <span>
              تفاصيل المصدر
            </span>

            <h3>
              ${escapeHtml(
                source.name
              )}
            </h3>

          </div>

          <button
            data-source-details-close
          >
            إغلاق
          </button>

        </div>

        <div
          class="ez-source-details-grid"
        >

          ${detail(
            "النوع",
            SOURCE_TYPES[
              source.type
            ] ||
              source.type
          )}

          ${detail(
            "الحالة",
            STATUS[
              source.status
            ] ||
              source.status
          )}

          ${detail(
            "الأولوية",
            PRIORITIES[
              source.priority
            ] ||
              source.priority
          )}

          ${detail(
            "الموثوقية",
            source.verified
              ? "موثق"
              : "غير موثق"
          )}

          ${detail(
            "عدد المواد",
            source.items || 0
          )}

          ${detail(
            "الأخطاء",
            source.errors || 0
          )}

          ${detail(
            "المزامنة",
            `${source.syncInterval || 15} دقيقة`
          )}

          ${detail(
            "آخر مزامنة",
            formatDate(
              source.lastSync
            )
          )}

        </div>

        ${
          source.url
            ? `
              <a
                class="ez-source-url"
                href="${escapeHtml(
                  source.url
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ${escapeHtml(
                  source.url
                )}
              </a>
            `
            : ""
        }

        ${
          source.description
            ? `
              <p
                class="ez-source-description"
              >
                ${escapeHtml(
                  source.description
                )}
              </p>
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
        class="ez-source-detail"
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

  function priorityClass(
    value
  ) {
    return (
      `ez-source-priority-${value}`
    );
  }

  function statusClass(
    value
  ) {
    return (
      `ez-source-status-${value}`
    );
  }

  function openAdd() {
    state.selected =
      null;

    state.editing =
      true;

    render();
  }

  function openEdit(id) {
    const source =
      state.sources.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!source) {
      return;
    }

    state.selected =
      source;

    state.editing =
      true;

    render();
  }

  function openDetails(id) {
    const source =
      state.sources.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!source) {
      return;
    }

    state.selected =
      source;

    state.editing =
      false;

    render();
  }

  function closeEditor() {
    state.editing =
      false;

    state.selected =
      null;

    render();
  }

  function saveSource(
    form
  ) {
    const data =
      new FormData(
        form
      );

    const id =
      data.get("id") ||
      uid();

    const old =
      state.sources.find(
        source =>
          String(
            source.id
          ) ===
          String(id)
      );

    const source = {
      id,

      name:
        String(
          data.get("name") ||
          ""
        ).trim(),

      type:
        String(
          data.get("type") ||
          "other"
        ),

      url:
        String(
          data.get("url") ||
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
        data.get("enabled") ===
        "on"
          ? (
              old?.status ===
              "active"
                ? "active"
                : "pending"
            )
          : "disabled",

      priority:
        String(
          data.get(
            "priority"
          ) ||
          "medium"
        ),

      enabled:
        data.get("enabled") ===
        "on",

      verified:
        data.get("verified") ===
        "on",

      syncInterval:
        Math.max(
          1,
          Number(
            data.get(
              "syncInterval"
            ) ||
            15
          )
        ),

      lastSync:
        old?.lastSync ||
        null,

      items:
        old?.items ||
        0,

      errors:
        old?.errors ||
        0,

      createdAt:
        old?.createdAt ||
        new Date().toISOString()
    };

    if (!source.name) {
      showToast(
        "اسم المصدر مطلوب."
      );

      return;
    }

    if (old) {
      const index =
        state.sources.findIndex(
          item =>
            String(
              item.id
            ) ===
            String(id)
        );

      state.sources[
        index
      ] = source;
    } else {
      state.sources.unshift(
        source
      );
    }

    saveSources();

    state.selected =
      source;

    state.editing =
      false;

    state.lastUpdate =
      new Date();

    render();

    showToast(
      "تم حفظ المصدر."
    );
  }

  function toggleSource(
    id
  ) {
    const source =
      state.sources.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!source) {
      return;
    }

    if (
      source.status ===
      "active"
    ) {
      source.status =
        "paused";
      source.enabled =
        false;
    } else {
      source.status =
        "active";
      source.enabled =
        true;
    }

    saveSources();

    state.lastUpdate =
      new Date();

    render();

    showToast(
      source.status ===
        "active"
        ? "تم تفعيل المصدر."
        : "تم إيقاف المصدر."
    );
  }

  function deleteSource(
    id
  ) {
    const source =
      state.sources.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!source) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل تريد حذف المصدر "${source.name}"؟`
      );

    if (!confirmed) {
      return;
    }

    state.sources =
      state.sources.filter(
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

    saveSources();

    state.lastUpdate =
      new Date();

    render();

    showToast(
      "تم حذف المصدر."
    );
  }

  async function testSource(
    id
  ) {
    const source =
      state.sources.find(
        item =>
          String(
            item.id
          ) ===
          String(id)
      );

    if (!source) {
      return;
    }

    if (!source.url) {
      showToast(
        "أضف رابط المصدر أولًا."
      );

      return;
    }

    /*
     * لا يتم تنفيذ fetch خارجي من لوحة الإدارة
     * لتجنب تجاوز CORS أو اعتبار المصدر متصلًا
     * دون وجود موصل خلفي حقيقي.
     *
     * هذا الاختبار يجهز حالة المصدر،
     * أما الاتصال الفعلي فيتم لاحقًا عبر backend connector.
     */

    source.lastTest =
      new Date().toISOString();

    source.status =
      "pending";

    saveSources();

    state.lastUpdate =
      new Date();

    render();

    showToast(
      "تم تسجيل المصدر للاختبار. الاتصال الخارجي الفعلي يحتاج موصل Backend."
    );
  }

  function bindEvents() {
    const add =
      document.querySelector(
        "[data-source-add]"
      );

    if (add) {
      add.addEventListener(
        "click",
        openAdd
      );
    }

    const refresh =
      document.querySelector(
        "[data-source-refresh]"
      );

    if (refresh) {
      refresh.addEventListener(
        "click",
        () => {
          state.lastUpdate =
            new Date();

          render();

          showToast(
            "تم تحديث مركز المصادر."
          );
        }
      );
    }

    const search =
      document.querySelector(
        "#ez-source-search"
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

    const type =
      document.querySelector(
        "#ez-source-type"
      );

    if (type) {
      type.addEventListener(
        "change",
        event => {
          state.type =
            event.target.value;

          render();
        }
      );
    }

    const status =
      document.querySelector(
        "#ez-source-status"
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
        "[data-source-view]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              openDetails(
                button.dataset
                  .sourceView
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-source-edit]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              openEdit(
                button.dataset
                  .sourceEdit
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-source-test]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              testSource(
                button.dataset
                  .sourceTest
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-source-toggle]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              toggleSource(
                button.dataset
                  .sourceToggle
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-source-delete]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () =>
              deleteSource(
                button.dataset
                  .sourceDelete
              )
          );

        }
      );

    document
      .querySelectorAll(
        "[data-source-close]"
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
        "[data-source-details-close]"
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
        "#ez-source-form"
      );

    if (form) {
      form.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          saveSource(
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
        "#ez-source-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-source-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100000;
        max-width:400px;
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

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-sources-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-sources-style";

    style.textContent = `
      #admin-sources-section,
      #sources-section {
        direction:rtl;
      }

      .ez-sources {
        color:#0f172a;
      }

      .ez-sources-header {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:15px;
      }

      .ez-sources-kicker {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
        letter-spacing:.08em;
      }

      .ez-sources-header h2 {
        margin:5px 0;
        color:#075985;
        font-size:27px;
        font-weight:950;
      }

      .ez-sources-header p {
        margin:0;
        color:#64748b;
        font-size:11px;
        line-height:1.8;
      }

      .ez-sources-actions {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
      }

      .ez-source-btn {
        border:1px solid #bae6fd;
        border-radius:11px;
        background:#fff;
        color:#0369a1;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-source-btn.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-source-metrics {
        display:grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap:9px;
        margin-bottom:10px;
      }

      .ez-source-metric {
        border:1px solid #e0f2fe;
        border-radius:15px;
        background:#fff;
        padding:13px;
      }

      .ez-source-metric span {
        display:block;
        color:#64748b;
        font-size:8px;
        font-weight:850;
      }

      .ez-source-metric strong {
        display:block;
        margin-top:4px;
        color:#075985;
        font-size:24px;
        font-weight:950;
      }

      .ez-source-panel {
        border:1px solid #e0f2fe;
        border-radius:17px;
        background:#fff;
        padding:13px;
      }

      .ez-source-toolbar {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
        margin-bottom:10px;
      }

      .ez-source-toolbar input,
      .ez-source-toolbar select {
        border:1px solid #bae6fd;
        border-radius:10px;
        outline:none;
        background:#fff;
        color:#334155;
        padding:9px;
        font-size:9px;
      }

      .ez-source-toolbar input {
        flex:1;
        min-width:200px;
      }

      .ez-source-table-wrap {
        width:100%;
        overflow:auto;
      }

      .ez-source-table {
        width:100%;
        min-width:850px;
        border-collapse:separate;
        border-spacing:0 5px;
      }

      .ez-source-table th {
        padding:8px;
        color:#94a3b8;
        text-align:right;
        font-size:8px;
        font-weight:900;
      }

      .ez-source-table td {
        border-top:1px solid #f0f9ff;
        border-bottom:1px solid #f0f9ff;
        background:#fff;
        padding:9px 8px;
        color:#475569;
        font-size:9px;
      }

      .ez-source-table tr td:first-child {
        border-right:1px solid #f0f9ff;
        border-radius:0 11px 11px 0;
      }

      .ez-source-table tr td:last-child {
        border-left:1px solid #f0f9ff;
        border-radius:11px 0 0 11px;
      }

      .ez-source-name {
        display:flex;
        align-items:center;
        gap:8px;
        border:0;
        background:transparent;
        padding:0;
        cursor:pointer;
        text-align:right;
      }

      .ez-source-icon {
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        border-radius:9px;
        background:#eff6ff;
        color:#0284c7;
        font-size:10px;
        font-weight:950;
      }

      .ez-source-name strong {
        display:block;
        color:#075985;
        font-size:9px;
      }

      .ez-source-name small {
        display:block;
        max-width:230px;
        overflow:hidden;
        color:#94a3b8;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
      }

      .ez-source-type {
        color:#64748b;
        font-size:8px;
      }

      .ez-source-priority-low,
      .ez-source-priority-medium,
      .ez-source-priority-high,
      .ez-source-priority-critical,
      .ez-source-status-active,
      .ez-source-status-paused,
      .ez-source-status-disabled,
      .ez-source-status-pending,
      .ez-source-status-error {
        display:inline-block;
        border-radius:999px;
        padding:5px 7px;
        font-size:7px;
        font-weight:950;
      }

      .ez-source-priority-low {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-source-priority-medium {
        background:#fffbeb;
        color:#a16207;
      }

      .ez-source-priority-high {
        background:#fff7ed;
        color:#c2410c;
      }

      .ez-source-priority-critical {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-source-status-active {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-source-status-paused,
      .ez-source-status-pending {
        background:#eff6ff;
        color:#0369a1;
      }

      .ez-source-status-disabled {
        background:#f8fafc;
        color:#64748b;
      }

      .ez-source-status-error {
        background:#fff1f2;
        color:#be123c;
      }

      .ez-source-count {
        color:#0284c7;
      }

      .ez-source-date {
        color:#94a3b8;
        font-size:7px;
      }

      .ez-source-row-actions {
        display:flex;
        gap:4px;
        flex-wrap:wrap;
      }

      .ez-source-row-actions button {
        border:1px solid #e0f2fe;
        border-radius:7px;
        background:#fff;
        color:#0369a1;
        padding:5px 7px;
        cursor:pointer;
        font-size:7px;
        font-weight:850;
      }

      .ez-source-row-actions button.danger {
        border-color:#fecdd3;
        color:#be123c;
        background:#fff1f2;
      }

      .ez-source-empty {
        padding:35px !important;
        color:#94a3b8 !important;
        text-align:center !important;
      }

      .ez-source-overlay {
        position:fixed;
        inset:0;
        z-index:90000;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(240,249,255,.82);
        backdrop-filter:blur(8px);
      }

      .ez-source-editor {
        width:min(720px,100%);
        max-height:90vh;
        overflow:auto;
        border:1px solid #bae6fd;
        border-radius:20px;
        background:#fff;
        padding:17px;
        box-shadow:0 25px 80px rgba(7,89,133,.16);
      }

      .ez-source-editor-header,
      .ez-source-details-head {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
        margin-bottom:15px;
      }

      .ez-source-editor-header span,
      .ez-source-details-head span {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-source-editor-header h3,
      .ez-source-details-head h3 {
        margin:4px 0 0;
        color:#075985;
        font-size:17px;
      }

      .ez-source-editor-header button,
      .ez-source-details-head button {
        border:1px solid #e0f2fe;
        border-radius:9px;
        background:#fff;
        color:#64748b;
        padding:7px 10px;
        cursor:pointer;
        font-size:8px;
      }

      .ez-source-form-grid {
        display:grid;
        grid-template-columns:
          repeat(2,minmax(0,1fr));
        gap:9px;
      }

      .ez-source-form-grid label {
        display:grid;
        gap:5px;
      }

      .ez-source-form-grid label.full {
        grid-column:1/-1;
      }

      .ez-source-form-grid label > span {
        color:#64748b;
        font-size:8px;
        font-weight:900;
      }

      .ez-source-form-grid input,
      .ez-source-form-grid select,
      .ez-source-form-grid textarea {
        width:100%;
        box-sizing:border-box;
        border:1px solid #bae6fd;
        border-radius:10px;
        outline:none;
        background:#fff;
        color:#334155;
        padding:9px;
        font-size:9px;
        font-family:inherit;
      }

      .ez-source-check {
        display:flex !important;
        align-items:center;
        gap:7px;
        border-radius:10px;
        background:#f8fafc;
        padding:9px;
      }

      .ez-source-check input {
        width:auto !important;
      }

      .ez-source-form-actions {
        display:flex;
        justify-content:flex-end;
        gap:7px;
        margin-top:13px;
      }

      .ez-source-form-actions button {
        border:1px solid #e0f2fe;
        border-radius:10px;
        background:#fff;
        color:#64748b;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-source-form-actions button.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-source-details {
        margin-top:10px;
        border:1px solid #bae6fd;
        border-radius:17px;
        background:#fff;
        padding:14px;
      }

      .ez-source-details-grid {
        display:grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap:7px;
      }

      .ez-source-detail {
        border-radius:10px;
        background:#f8fafc;
        padding:9px;
      }

      .ez-source-detail span {
        display:block;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-source-detail strong {
        display:block;
        margin-top:3px;
        color:#075985;
        font-size:10px;
      }

      .ez-source-url {
        display:block;
        margin-top:10px;
        overflow:hidden;
        border-radius:10px;
        background:#eff6ff;
        color:#0369a1;
        padding:9px;
        text-decoration:none;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .ez-source-description {
        margin:9px 0 0;
        color:#64748b;
        font-size:9px;
        line-height:1.8;
      }

      .ez-source-footer {
        margin-top:9px;
        color:#94a3b8;
        text-align:center;
        font-size:7px;
      }

      @media (max-width:850px) {
        .ez-source-metrics {
          grid-template-columns:
            repeat(2,1fr);
        }

        .ez-source-form-grid,
        .ez-source-details-grid {
          grid-template-columns:
            repeat(2,1fr);
        }
      }

      @media (max-width:600px) {
        .ez-source-metrics {
          grid-template-columns:1fr;
        }

        .ez-source-form-grid,
        .ez-source-details-grid {
          grid-template-columns:1fr;
        }

        .ez-source-form-grid label.full {
          grid-column:auto;
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
        "#sources-section"
      ) ||
      document.querySelector(
        "#admin-sources-section"
      ) ||
      document.querySelector(
        '[data-admin-section="sources"]'
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
      "admin-sources-section";

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
    seedSources();

    createMount();

    render();
  }

  window.EZMediaAdminSources =
    {
      initialize,

      refresh() {
        state.sources =
          loadStoredSources();

        state.lastUpdate =
          new Date();

        render();
      },

      add:
        openAdd,

      getState() {
        return {
          ...state,
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
