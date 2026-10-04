"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 26
 * الملف: public/admin-broadcast-control.js
 *
 * مركز التحكم بالبث متعدد المصادر
 *
 * يدير:
 * - قنوات البث
 * - مصادر HLS / DASH / RTMP / Embed / External
 * - حالة القناة
 * - القناة الرئيسية
 * - القنوات المميزة
 * - اختبار حالة المصدر
 * - بدء / إيقاف / اختبار / تعطيل
 * - ترتيب القنوات
 * - البحث والفلترة
 * - إحصائيات البث
 * - ربط القناة بواجهة EZ MEDIA
 *
 * لا يقوم هذا الملف باستخراج أو تجاوز أي بث محمي.
 * يجب أن تكون مصادر البث مرخصة أو مصرحًا باستخدامها.
 */

(function () {
  "use strict";

  const MODULE = "broadcast-control";

  const API = {
    live: "/api/live",
    statistics: "/api/live/statistics",
    featured: "/api/live/featured",
    system: "/api/live/system"
  };

  const state = {
    channels: [],
    statistics: null,
    system: null,
    selected: null,
    search: "",
    status: "all",
    sourceType: "all",
    loading: false
  };

  const STATUS_LABELS = {
    offline: "متوقف",
    testing: "اختبار",
    live: "مباشر",
    disabled: "معطل"
  };

  const SOURCE_LABELS = {
    hls: "HLS",
    dash: "DASH",
    rtmp: "RTMP",
    embed: "تضمين",
    external: "خارجي"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "غير محدد";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "غير محدد";
    }

    return date.toLocaleString("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function notify(message, type = "info") {
    window.dispatchEvent(
      new CustomEvent("ezmedia:notification", {
        detail: {
          module: MODULE,
          type,
          title: "مركز البث",
          message
        }
      })
    );

    const toast = document.querySelector(
      "#ez-broadcast-control-toast"
    );

    if (!toast) return;

    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");

    clearTimeout(toast._timer);

    toast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `HTTP ${response.status}`
      );
    }

    return data;
  }

  function normalizeList(data) {
    if (Array.isArray(data)) {
      return data;
    }

    return (
      data.channels ||
      data.items ||
      data.data ||
      data.live ||
      []
    );
  }

  function normalizeChannel(channel) {
    return {
      ...channel,

      id: channel.id,

      name:
        channel.name ||
        channel.title ||
        channel.channel_name ||
        "قناة بدون اسم",

      slug:
        channel.slug ||
        "",

      description:
        channel.description ||
        "",

      status:
        channel.status ||
        "offline",

      sourceType:
        channel.sourceType ||
        channel.source_type ||
        "hls",

      sourceUrl:
        channel.sourceUrl ||
        channel.source_url ||
        channel.url ||
        "",

      embedUrl:
        channel.embedUrl ||
        channel.embed_url ||
        "",

      thumbnail:
        channel.thumbnail ||
        channel.thumbnail_url ||
        "",

      isFeatured:
        Boolean(
          channel.isFeatured ??
            channel.is_featured
        ),

      isPrimary:
        Boolean(
          channel.isPrimary ??
            channel.is_primary
        ),

      enabled:
        channel.enabled !== false,

      category:
        channel.category ||
        "عام",

      viewerCount:
        Number(
          channel.viewerCount ??
            channel.viewer_count ??
            0
        ),

      createdAt:
        channel.createdAt ||
        channel.created_at ||
        null,

      updatedAt:
        channel.updatedAt ||
        channel.updated_at ||
        null
    };
  }

  async function loadChannels() {
    state.loading = true;

    try {
      const params = new URLSearchParams();

      if (state.search.trim()) {
        params.set(
          "search",
          state.search.trim()
        );
      }

      if (state.status !== "all") {
        params.set(
          "status",
          state.status
        );
      }

      if (state.sourceType !== "all") {
        params.set(
          "sourceType",
          state.sourceType
        );
      }

      const query =
        params.toString();

      const data = await fetchJSON(
        query
          ? `${API.live}?${query}`
          : API.live
      );

      state.channels = normalizeList(
        data
      ).map(normalizeChannel);
    } catch (error) {
      console.error(
        "EZ MEDIA Broadcast channels:",
        error
      );

      state.channels = [];

      notify(
        "تعذر تحميل قنوات البث.",
        "error"
      );
    } finally {
      state.loading = false;
    }
  }

  async function loadStatistics() {
    try {
      const data = await fetchJSON(
        API.statistics
      );

      state.statistics =
        data.statistics ||
        data.data ||
        data;
    } catch (error) {
      console.warn(
        "EZ MEDIA Broadcast statistics:",
        error.message
      );
    }
  }

  async function loadSystem() {
    try {
      const data = await fetchJSON(
        API.system
      );

      state.system =
        data.system ||
        data.data ||
        data;
    } catch (error) {
      console.warn(
        "EZ MEDIA Broadcast system:",
        error.message
      );
    }
  }

  async function loadFeatured() {
    try {
      const data = await fetchJSON(
        API.featured
      );

      return normalizeList(data).map(
        normalizeChannel
      );
    } catch (error) {
      console.warn(
        "EZ MEDIA featured channels:",
        error.message
      );

      return [];
    }
  }

  function ensureSection() {
    let section = document.querySelector(
      "#broadcast-control-section"
    );

    if (section) {
      return section;
    }

    const parent =
      document.querySelector("main") ||
      document.querySelector("#admin-main") ||
      document.body;

    section = document.createElement(
      "section"
    );

    section.id =
      "broadcast-control-section";

    section.hidden = true;

    parent.appendChild(section);

    return section;
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-broadcast-control-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "ez-broadcast-control-styles";

    style.textContent = `
      #broadcast-control-section {
        direction: rtl;
        padding: 22px;
        color: #17384f;
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
      }

      .ez-broadcast-shell {
        max-width: 1550px;
        margin: auto;
      }

      .ez-broadcast-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 22px;
        border-radius: 24px;
        background:
          linear-gradient(
            135deg,
            #edfaff,
            #ffffff
          );
        border: 1px solid #d8eef6;
        box-shadow:
          0 15px 45px
          rgba(38, 155, 192, .08);
      }

      .ez-broadcast-header h2 {
        margin: 0 0 7px;
        font-size: 28px;
      }

      .ez-broadcast-header p {
        margin: 0;
        color: #6c8798;
        line-height: 1.7;
      }

      .ez-broadcast-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-broadcast-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #e9f8fd;
        color: #146984;
        font-weight: 800;
      }

      .ez-broadcast-btn.primary {
        background: #2fb2d4;
        color: white;
      }

      .ez-broadcast-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-broadcast-metrics {
        display: grid;
        grid-template-columns:
          repeat(6, minmax(0, 1fr));
        gap: 12px;
        margin: 18px 0;
      }

      .ez-broadcast-metric {
        background: white;
        border: 1px solid #dfedf2;
        border-radius: 18px;
        padding: 17px;
        box-shadow:
          0 8px 25px
          rgba(30, 105, 130, .06);
      }

      .ez-broadcast-metric span {
        display: block;
        color: #71899a;
        font-size: 13px;
        margin-bottom: 7px;
      }

      .ez-broadcast-metric strong {
        font-size: 24px;
        color: #173e57;
      }

      .ez-broadcast-toolbar {
        display: grid;
        grid-template-columns:
          minmax(220px, 1fr)
          180px
          180px
          auto;
        gap: 9px;
        margin-bottom: 18px;
      }

      .ez-broadcast-input,
      .ez-broadcast-select,
      .ez-broadcast-textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        background: white;
        border-radius: 12px;
        padding: 12px 14px;
        outline: none;
        color: #17384f;
      }

      .ez-broadcast-input:focus,
      .ez-broadcast-select:focus,
      .ez-broadcast-textarea:focus {
        border-color: #54c4e4;
        box-shadow:
          0 0 0 3px
          rgba(84, 196, 228, .12);
      }

      .ez-broadcast-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 15px;
      }

      .ez-broadcast-card {
        background: white;
        border: 1px solid #dfedf2;
        border-radius: 20px;
        padding: 18px;
        box-shadow:
          0 8px 28px
          rgba(27, 103, 128, .06);
      }

      .ez-broadcast-card.live {
        border-color: #9bdeee;
        box-shadow:
          0 10px 32px
          rgba(46, 179, 211, .13);
      }

      .ez-broadcast-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }

      .ez-broadcast-card h3 {
        margin: 0 0 6px;
        font-size: 18px;
        line-height: 1.5;
      }

      .ez-broadcast-badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 9px;
        background: #eefaff;
        color: #16708d;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }

      .ez-broadcast-live-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-left: 5px;
        background: #2fb5d5;
      }

      .ez-broadcast-card p {
        color: #718899;
        line-height: 1.7;
        font-size: 13px;
      }

      .ez-broadcast-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 13px 0;
      }

      .ez-broadcast-meta div {
        padding: 9px;
        border-radius: 10px;
        background: #f7fbfd;
        font-size: 12px;
      }

      .ez-broadcast-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .ez-broadcast-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 55px 20px;
        border: 1px dashed #cde5ed;
        border-radius: 20px;
        color: #718c9c;
      }

      .ez-broadcast-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background:
          rgba(14, 57, 76, .28);
        backdrop-filter: blur(7px);
      }

      .ez-broadcast-modal.open {
        display: flex;
      }

      .ez-broadcast-dialog {
        width: min(900px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: white;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15, 72, 96, .23);
      }

      .ez-broadcast-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        padding: 20px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-broadcast-dialog-body {
        padding: 20px;
      }

      .ez-broadcast-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #e4eff3;
      }

      .ez-broadcast-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 13px;
      }

      .ez-broadcast-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ez-broadcast-field.full {
        grid-column: 1 / -1;
      }

      .ez-broadcast-field label {
        font-weight: 800;
        font-size: 13px;
        color: #31566b;
      }

      .ez-broadcast-system {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 9px;
        margin-bottom: 18px;
      }

      .ez-broadcast-system-item {
        padding: 12px;
        background: #f7fbfd;
        border-radius: 12px;
      }

      .ez-broadcast-system-item strong {
        display: block;
        margin-bottom: 5px;
      }

      #ez-broadcast-control-toast {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 100001;
        padding: 13px 17px;
        border-radius: 13px;
        background: #173f55;
        color: white;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition: .2s ease;
      }

      #ez-broadcast-control-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 1200px) {
        .ez-broadcast-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-broadcast-metrics {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }

        .ez-broadcast-system {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 750px) {
        #broadcast-control-section {
          padding: 12px;
        }

        .ez-broadcast-header {
          display: block;
        }

        .ez-broadcast-actions {
          margin-top: 15px;
        }

        .ez-broadcast-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-broadcast-grid {
          grid-template-columns: 1fr;
        }

        .ez-broadcast-metrics {
          grid-template-columns: 1fr 1fr;
        }

        .ez-broadcast-form-grid {
          grid-template-columns: 1fr;
        }

        .ez-broadcast-field.full {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function calculateMetrics() {
    const result = {
      total: state.channels.length,
      live: 0,
      testing: 0,
      offline: 0,
      disabled: 0,
      viewers: 0
    };

    for (const channel of state.channels) {
      if (channel.status === "live") {
        result.live++;
      }

      if (channel.status === "testing") {
        result.testing++;
      }

      if (channel.status === "offline") {
        result.offline++;
      }

      if (channel.status === "disabled") {
        result.disabled++;
      }

      result.viewers +=
        Number(channel.viewerCount) || 0;
    }

    return result;
  }

  function getFilteredChannels() {
    const search =
      state.search.trim().toLowerCase();

    return state.channels.filter(
      (channel) => {
        if (
          state.status !== "all" &&
          channel.status !== state.status
        ) {
          return false;
        }

        if (
          state.sourceType !== "all" &&
          channel.sourceType !==
            state.sourceType
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const haystack = [
          channel.name,
          channel.slug,
          channel.description,
          channel.category,
          channel.sourceType
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(search);
      }
    );
  }

  function render() {
    const section = ensureSection();

    const metrics =
      state.statistics ||
      calculateMetrics();

    const channels =
      getFilteredChannels();

    section.innerHTML = `
      <div class="ez-broadcast-shell">

        <div class="ez-broadcast-header">

          <div>
            <h2>
              مركز التحكم بالبث
            </h2>

            <p>
              إدارة مركزية لقنوات ومصادر البث المباشر
              داخل EZ MEDIA.
            </p>
          </div>

          <div class="ez-broadcast-actions">

            <button
              class="ez-broadcast-btn"
              data-broadcast-action="refresh"
            >
              تحديث
            </button>

            <button
              class="ez-broadcast-btn"
              data-broadcast-action="featured"
            >
              القنوات المميزة
            </button>

            <button
              class="ez-broadcast-btn primary"
              data-broadcast-action="new"
            >
              + إضافة قناة
            </button>

          </div>

        </div>

        <div class="ez-broadcast-system">

          ${systemItem(
            "حالة النظام",
            state.system?.status ||
              state.system?.health ||
              "متاحة"
          )}

          ${systemItem(
            "مصادر البث",
            state.system?.sources ??
              state.system?.sourceCount ??
              state.channels.length
          )}

          ${systemItem(
            "البث المباشر",
            metrics.live ??
              metrics.liveChannels ??
              0
          )}

          ${systemItem(
            "المشاهدون",
            metrics.viewers ??
              metrics.totalViewers ??
              0
          )}

        </div>

        <div class="ez-broadcast-metrics">

          ${metric(
            "إجمالي القنوات",
            metrics.total ??
              metrics.totalChannels ??
              0
          )}

          ${metric(
            "مباشر الآن",
            metrics.live ??
              metrics.liveChannels ??
              0
          )}

          ${metric(
            "اختبار",
            metrics.testing ?? 0
          )}

          ${metric(
            "متوقف",
            metrics.offline ?? 0
          )}

          ${metric(
            "معطل",
            metrics.disabled ?? 0
          )}

          ${metric(
            "إجمالي المشاهدين",
            metrics.viewers ??
              metrics.totalViewers ??
              0
          )}

        </div>

        <div class="ez-broadcast-toolbar">

          <input
            id="ez-broadcast-search"
            class="ez-broadcast-input"
            placeholder="ابحث عن قناة..."
            value="${escapeHtml(
              state.search
            )}"
          />

          <select
            id="ez-broadcast-status"
            class="ez-broadcast-select"
          >
            <option value="all">
              كل الحالات
            </option>

            ${Object.entries(
              STATUS_LABELS
            )
              .map(
                ([key, label]) => `
                  <option
                    value="${escapeHtml(
                      key
                    )}"
                    ${
                      state.status ===
                      key
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

          <select
            id="ez-broadcast-source"
            class="ez-broadcast-select"
          >
            <option value="all">
              كل المصادر
            </option>

            ${Object.entries(
              SOURCE_LABELS
            )
              .map(
                ([key, label]) => `
                  <option
                    value="${escapeHtml(
                      key
                    )}"
                    ${
                      state.sourceType ===
                      key
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

          <button
            class="ez-broadcast-btn"
            data-broadcast-action="clear"
          >
            مسح
          </button>

        </div>

        <div class="ez-broadcast-grid">

          ${
            state.loading
              ? `
                <div class="ez-broadcast-empty">
                  جاري تحميل قنوات البث...
                </div>
              `
              : channels.length
              ? channels
                  .map(renderChannel)
                  .join("")
              : `
                <div class="ez-broadcast-empty">

                  <strong>
                    لا توجد قنوات مطابقة
                  </strong>

                  <p>
                    أضف قناة أو غيّر خيارات البحث.
                  </p>

                </div>
              `
          }

        </div>

      </div>

      <div
        id="ez-broadcast-control-modal"
        class="ez-broadcast-modal"
        aria-hidden="true"
      ></div>

      <div id="ez-broadcast-control-toast"></div>
    `;

    bindEvents();
  }

  function metric(label, value) {
    return `
      <div class="ez-broadcast-metric">
        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${escapeHtml(
            String(value ?? 0)
          )}
        </strong>
      </div>
    `;
  }

  function systemItem(label, value) {
    return `
      <div class="ez-broadcast-system-item">
        <strong>
          ${escapeHtml(label)}
        </strong>

        <span>
          ${escapeHtml(
            String(value ?? "غير محدد")
          )}
        </span>
      </div>
    `;
  }

  function renderChannel(channel) {
    const live =
      channel.status === "live";

    return `
      <article
        class="
          ez-broadcast-card
          ${live ? "live" : ""}
        "
      >

        <div class="ez-broadcast-card-top">

          <div>

            <h3>
              ${
                live
                  ? `<span class="ez-broadcast-live-dot"></span>`
                  : ""
              }

              ${escapeHtml(
                channel.name
              )}
            </h3>

            <span class="ez-broadcast-badge">
              ${escapeHtml(
                SOURCE_LABELS[
                  channel.sourceType
                ] ||
                  channel.sourceType
              )}
            </span>

          </div>

          <span class="ez-broadcast-badge">
            ${escapeHtml(
              STATUS_LABELS[
                channel.status
              ] ||
                channel.status
            )}
          </span>

        </div>

        <p>
          ${escapeHtml(
            channel.description ||
              "لا يوجد وصف للقناة."
          )}
        </p>

        <div class="ez-broadcast-meta">

          <div>
            <strong>
              الفئة
            </strong>

            <br>

            ${escapeHtml(
              channel.category
            )}
          </div>

          <div>
            <strong>
              المشاهدون
            </strong>

            <br>

            ${escapeHtml(
              String(
                channel.viewerCount || 0
              )
            )}
          </div>

          <div>
            <strong>
              رئيسية
            </strong>

            <br>

            ${
              channel.isPrimary
                ? "نعم"
                : "لا"
            }
          </div>

          <div>
            <strong>
              مميزة
            </strong>

            <br>

            ${
              channel.isFeatured
                ? "نعم"
                : "لا"
            }
          </div>

        </div>

        <p>
          آخر تحديث:
          ${escapeHtml(
            formatDate(
              channel.updatedAt
            )
          )}
        </p>

        <div class="ez-broadcast-card-actions">

          <button
            class="ez-broadcast-btn"
            data-broadcast-action="open"
            data-id="${escapeHtml(
              channel.id
            )}"
          >
            التفاصيل
          </button>

          <button
            class="ez-broadcast-btn"
            data-broadcast-action="test"
            data-id="${escapeHtml(
              channel.id
            )}"
          >
            اختبار
          </button>

          ${
            live
              ? `
                <button
                  class="ez-broadcast-btn"
                  data-broadcast-action="stop"
                  data-id="${escapeHtml(
                    channel.id
                  )}"
                >
                  إيقاف
                </button>
              `
              : `
                <button
                  class="ez-broadcast-btn primary"
                  data-broadcast-action="start"
                  data-id="${escapeHtml(
                    channel.id
                  )}"
                >
                  بدء البث
                </button>
              `
          }

          <button
            class="ez-broadcast-btn"
            data-broadcast-action="edit"
            data-id="${escapeHtml(
              channel.id
            )}"
          >
            تعديل
          </button>

          <button
            class="ez-broadcast-btn danger"
            data-broadcast-action="delete"
            data-id="${escapeHtml(
              channel.id
            )}"
          >
            حذف
          </button>

        </div>

      </article>
    `;
  }

  function openModal(
    title,
    body,
    footer = ""
  ) {
    const modal = document.querySelector(
      "#ez-broadcast-control-modal"
    );

    if (!modal) return;

    modal.innerHTML = `
      <div class="ez-broadcast-dialog">

        <div class="ez-broadcast-dialog-header">

          <strong>
            ${escapeHtml(title)}
          </strong>

          <button
            class="ez-broadcast-btn"
            data-broadcast-action="close"
          >
            إغلاق
          </button>

        </div>

        <div class="ez-broadcast-dialog-body">
          ${body}
        </div>

        ${
          footer
            ? `
              <div class="ez-broadcast-dialog-footer">
                ${footer}
              </div>
            `
            : ""
        }

      </div>
    `;

    modal.classList.add("open");

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    bindEvents();
  }

  function closeModal() {
    const modal = document.querySelector(
      "#ez-broadcast-control-modal"
    );

    if (!modal) return;

    modal.classList.remove("open");

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    modal.innerHTML = "";
  }

  function openCreate() {
    openModal(
      "إضافة قناة بث",
      `
        <form id="ez-broadcast-create-form">

          <div class="ez-broadcast-form-grid">

            <div class="ez-broadcast-field full">
              <label>
                اسم القناة
              </label>

              <input
                class="ez-broadcast-input"
                name="name"
                required
                placeholder="مثال: EZ MEDIA LIVE"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                Slug
              </label>

              <input
                class="ez-broadcast-input"
                name="slug"
                placeholder="ez-media-live"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                نوع المصدر
              </label>

              <select
                class="ez-broadcast-select"
                name="sourceType"
              >
                ${Object.entries(
                  SOURCE_LABELS
                )
                  .map(
                    ([key, label]) => `
                      <option value="${key}">
                        ${escapeHtml(
                          label
                        )}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </div>

            <div class="ez-broadcast-field full">
              <label>
                رابط المصدر
              </label>

              <input
                class="ez-broadcast-input"
                name="sourceUrl"
                placeholder="رابط المصدر المرخص"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                رابط التضمين
              </label>

              <input
                class="ez-broadcast-input"
                name="embedUrl"
                placeholder="اختياري"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                الفئة
              </label>

              <input
                class="ez-broadcast-input"
                name="category"
                value="عام"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                قناة رئيسية
              </label>

              <select
                class="ez-broadcast-select"
                name="isPrimary"
              >
                <option value="false">
                  لا
                </option>

                <option value="true">
                  نعم
                </option>
              </select>
            </div>

            <div class="ez-broadcast-field">
              <label>
                قناة مميزة
              </label>

              <select
                class="ez-broadcast-select"
                name="isFeatured"
              >
                <option value="false">
                  لا
                </option>

                <option value="true">
                  نعم
                </option>
              </select>
            </div>

            <div class="ez-broadcast-field full">
              <label>
                الوصف
              </label>

              <textarea
                class="ez-broadcast-textarea"
                name="description"
                rows="5"
                placeholder="وصف القناة..."
              ></textarea>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-broadcast-btn"
          data-broadcast-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-broadcast-btn primary"
          data-broadcast-action="save-new"
        >
          إنشاء القناة
        </button>
      `
    );
  }

  function openEdit(id) {
    const channel = state.channels.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!channel) return;

    openModal(
      "تعديل قناة البث",
      `
        <form id="ez-broadcast-edit-form">

          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              channel.id
            )}"
          />

          <div class="ez-broadcast-form-grid">

            <div class="ez-broadcast-field full">
              <label>
                اسم القناة
              </label>

              <input
                class="ez-broadcast-input"
                name="name"
                value="${escapeHtml(
                  channel.name
                )}"
                required
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                Slug
              </label>

              <input
                class="ez-broadcast-input"
                name="slug"
                value="${escapeHtml(
                  channel.slug
                )}"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                نوع المصدر
              </label>

              <select
                class="ez-broadcast-select"
                name="sourceType"
              >
                ${Object.entries(
                  SOURCE_LABELS
                )
                  .map(
                    ([key, label]) => `
                      <option
                        value="${escapeHtml(
                          key
                        )}"
                        ${
                          channel.sourceType ===
                          key
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
            </div>

            <div class="ez-broadcast-field full">
              <label>
                رابط المصدر
              </label>

              <input
                class="ez-broadcast-input"
                name="sourceUrl"
                value="${escapeHtml(
                  channel.sourceUrl
                )}"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                رابط التضمين
              </label>

              <input
                class="ez-broadcast-input"
                name="embedUrl"
                value="${escapeHtml(
                  channel.embedUrl
                )}"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                الفئة
              </label>

              <input
                class="ez-broadcast-input"
                name="category"
                value="${escapeHtml(
                  channel.category
                )}"
              />
            </div>

            <div class="ez-broadcast-field">
              <label>
                رئيسية
              </label>

              <select
                class="ez-broadcast-select"
                name="isPrimary"
              >
                <option
                  value="false"
                  ${
                    !channel.isPrimary
                      ? "selected"
                      : ""
                  }
                >
                  لا
                </option>

                <option
                  value="true"
                  ${
                    channel.isPrimary
                      ? "selected"
                      : ""
                  }
                >
                  نعم
                </option>
              </select>
            </div>

            <div class="ez-broadcast-field">
              <label>
                مميزة
              </label>

              <select
                class="ez-broadcast-select"
                name="isFeatured"
              >
                <option
                  value="false"
                  ${
                    !channel.isFeatured
                      ? "selected"
                      : ""
                  }
                >
                  لا
                </option>

                <option
                  value="true"
                  ${
                    channel.isFeatured
                      ? "selected"
                      : ""
                  }
                >
                  نعم
                </option>
              </select>
            </div>

            <div class="ez-broadcast-field">
              <label>
                مفعلة
              </label>

              <select
                class="ez-broadcast-select"
                name="enabled"
              >
                <option
                  value="true"
                  ${
                    channel.enabled
                      ? "selected"
                      : ""
                  }
                >
                  نعم
                </option>

                <option
                  value="false"
                  ${
                    !channel.enabled
                      ? "selected"
                      : ""
                  }
                >
                  لا
                </option>
              </select>
            </div>

            <div class="ez-broadcast-field full">
              <label>
                الوصف
              </label>

              <textarea
                class="ez-broadcast-textarea"
                name="description"
                rows="5"
              >${escapeHtml(
                channel.description
              )}</textarea>
            </div>

          </div>

        </form>
      `,
      `
        <button
          class="ez-broadcast-btn"
          data-broadcast-action="close"
        >
          إلغاء
        </button>

        <button
          class="ez-broadcast-btn primary"
          data-broadcast-action="save-edit"
        >
          حفظ التعديلات
        </button>
      `
    );
  }

  async function createChannel() {
    const form = document.querySelector(
      "#ez-broadcast-create-form"
    );

    if (!form) return;

    const data =
      Object.fromEntries(
        new FormData(form).entries()
      );

    if (!data.name?.trim()) {
      notify(
        "اسم القناة مطلوب.",
        "warning"
      );
      return;
    }

    try {
      await fetchJSON(
        API.live,
        {
          method: "POST",
          body: JSON.stringify({
            name: data.name.trim(),
            slug:
              data.slug?.trim() ||
              undefined,
            description:
              data.description?.trim() ||
              "",
            sourceType:
              data.sourceType ||
              "hls",
            sourceUrl:
              data.sourceUrl?.trim() ||
              "",
            embedUrl:
              data.embedUrl?.trim() ||
              "",
            category:
              data.category?.trim() ||
              "عام",
            isPrimary:
              data.isPrimary ===
              "true",
            isFeatured:
              data.isFeatured ===
              "true"
          })
        }
      );

      closeModal();

      await refresh();

      notify(
        "تم إنشاء قناة البث.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA create channel:",
        error
      );

      notify(
        "تعذر إنشاء قناة البث.",
        "error"
      );
    }
  }

  async function saveEdit() {
    const form = document.querySelector(
      "#ez-broadcast-edit-form"
    );

    if (!form) return;

    const data =
      Object.fromEntries(
        new FormData(form).entries()
      );

    if (!data.id) return;

    try {
      await fetchJSON(
        `${API.live}/${encodeURIComponent(
          data.id
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name:
              data.name?.trim(),
            slug:
              data.slug?.trim(),
            description:
              data.description?.trim(),
            sourceType:
              data.sourceType,
            sourceUrl:
              data.sourceUrl?.trim(),
            embedUrl:
              data.embedUrl?.trim(),
            category:
              data.category?.trim(),
            isPrimary:
              data.isPrimary ===
              "true",
            isFeatured:
              data.isFeatured ===
              "true",
            enabled:
              data.enabled ===
              "true"
          })
        }
      );

      closeModal();

      await refresh();

      notify(
        "تم حفظ تعديلات القناة.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA edit channel:",
        error
      );

      notify(
        "تعذر تعديل القناة.",
        "error"
      );
    }
  }

  async function channelAction(
    id,
    action
  ) {
    const channel = state.channels.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!channel) return;

    const endpointMap = {
      start: "start",
      stop: "stop",
      test: "test",
      disable: "disable"
    };

    const endpoint =
      endpointMap[action];

    if (!endpoint) return;

    try {
      await fetchJSON(
        `${API.live}/${encodeURIComponent(
          id
        )}/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );

      await refresh();

      notify(
        action === "start"
          ? "تم إرسال أمر بدء البث."
          : action === "stop"
          ? "تم إرسال أمر إيقاف البث."
          : action === "test"
          ? "تم إرسال أمر اختبار المصدر."
          : "تم إرسال أمر تعطيل القناة.",
        "success"
      );
    } catch (error) {
      console.error(
        `EZ MEDIA channel ${action}:`,
        error
      );

      notify(
        "تعذر تنفيذ أمر البث.",
        "error"
      );
    }
  }

  async function deleteChannel(id) {
    const channel = state.channels.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!channel) return;

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف قناة "${channel.name}"؟`
      );

    if (!confirmed) return;

    try {
      await fetchJSON(
        `${API.live}/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE"
        }
      );

      await refresh();

      notify(
        "تم حذف القناة.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA delete channel:",
        error
      );

      notify(
        "تعذر حذف القناة.",
        "error"
      );
    }
  }

  function openChannel(id) {
    const channel = state.channels.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!channel) return;

    state.selected = channel;

    const sourceVisible =
      channel.sourceUrl
        ? escapeHtml(
            channel.sourceUrl
          )
        : "غير محدد";

    openModal(
      channel.name,
      `
        <div class="ez-broadcast-meta">

          <div>
            <strong>
              الحالة
            </strong>

            <br>

            ${escapeHtml(
              STATUS_LABELS[
                channel.status
              ] ||
                channel.status
            )}
          </div>

          <div>
            <strong>
              المصدر
            </strong>

            <br>

            ${escapeHtml(
              SOURCE_LABELS[
                channel.sourceType
              ] ||
                channel.sourceType
            )}
          </div>

          <div>
            <strong>
              المشاهدون
            </strong>

            <br>

            ${escapeHtml(
              String(
                channel.viewerCount ||
                  0
              )
            )}
          </div>

          <div>
            <strong>
              آخر تحديث
            </strong>

            <br>

            ${escapeHtml(
              formatDate(
                channel.updatedAt
              )
            )}
          </div>

        </div>

        <h3>
          الوصف
        </h3>

        <p>
          ${escapeHtml(
            channel.description ||
              "لا يوجد وصف."
          )}
        </p>

        <h3>
          مصدر البث
        </h3>

        <div
          style="
            padding:12px;
            border-radius:12px;
            background:#f7fbfd;
            word-break:break-all;
          "
        >
          ${sourceVisible}
        </div>

        <p style="margin-top:15px">
          <strong>
            تنبيه:
          </strong>

          يجب استخدام مصادر البث التي تملك EZ MEDIA
          حق استخدامها أو تضمينها فقط.
        </p>
      `,
      `
        <button
          class="ez-broadcast-btn"
          data-broadcast-action="close"
        >
          إغلاق
        </button>

        <button
          class="ez-broadcast-btn"
          data-broadcast-action="test"
          data-id="${escapeHtml(
            channel.id
          )}"
        >
          اختبار
        </button>

        <button
          class="ez-broadcast-btn"
          data-broadcast-action="edit"
          data-id="${escapeHtml(
            channel.id
          )}"
        >
          تعديل
        </button>
      `
    );
  }

  async function refresh() {
    await Promise.all([
      loadChannels(),
      loadStatistics(),
      loadSystem()
    ]);

    render();
  }

  function clearFilters() {
    state.search = "";
    state.status = "all";
    state.sourceType = "all";

    render();

    loadChannels().then(render);
  }

  async function showFeatured() {
    const featured =
      await loadFeatured();

    openModal(
      "القنوات المميزة",
      featured.length
        ? `
          <div class="ez-broadcast-grid">

            ${featured
              .map(
                (channel) => `
                  <div
                    class="ez-broadcast-card"
                  >

                    <h3>
                      ${escapeHtml(
                        channel.name
                      )}
                    </h3>

                    <p>
                      ${escapeHtml(
                        STATUS_LABELS[
                          channel.status
                        ] ||
                          channel.status
                      )}
                    </p>

                  </div>
                `
              )
              .join("")}

          </div>
        `
        : `
          <p>
            لا توجد قنوات مميزة حاليًا.
          </p>
        `,
      `
        <button
          class="ez-broadcast-btn"
          data-broadcast-action="close"
        >
          إغلاق
        </button>
      `
    );
  }

  function bindEvents() {
    const section = document.querySelector(
      "#broadcast-control-section"
    );

    if (!section) return;

    section
      .querySelectorAll(
        "[data-broadcast-action]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const action =
              button.dataset
                .broadcastAction;

            const id =
              button.dataset.id;

            if (action === "new") {
              openCreate();
              return;
            }

            if (action === "close") {
              closeModal();
              return;
            }

            if (action === "save-new") {
              await createChannel();
              return;
            }

            if (action === "save-edit") {
              await saveEdit();
              return;
            }

            if (action === "open") {
              openChannel(id);
              return;
            }

            if (action === "edit") {
              openEdit(id);
              return;
            }

            if (
              action === "start" ||
              action === "stop" ||
              action === "test" ||
              action === "disable"
            ) {
              await channelAction(
                id,
                action
              );
              return;
            }

            if (action === "delete") {
              await deleteChannel(id);
              return;
            }

            if (action === "refresh") {
              await refresh();
              notify(
                "تم تحديث مركز البث.",
                "success"
              );
              return;
            }

            if (action === "clear") {
              clearFilters();
              return;
            }

            if (action === "featured") {
              await showFeatured();
            }
          }
        );
      });

    const search =
      section.querySelector(
        "#ez-broadcast-search"
      );

    if (search) {
      search.addEventListener(
        "input",
        (event) => {
          state.search =
            event.target.value;

          clearTimeout(
            search._timer
          );

          search._timer =
            setTimeout(
              async () => {
                await loadChannels();
                render();
              },
              350
            );
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-broadcast-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        async (event) => {
          state.status =
            event.target.value;

          await loadChannels();

          render();
        }
      );
    }

    const source =
      section.querySelector(
        "#ez-broadcast-source"
      );

    if (source) {
      source.addEventListener(
        "change",
        async (event) => {
          state.sourceType =
            event.target.value;

          await loadChannels();

          render();
        }
      );
    }

    const modal =
      document.querySelector(
        "#ez-broadcast-control-modal"
      );

    if (modal) {
      modal.addEventListener(
        "click",
        (event) => {
          if (
            event.target === modal
          ) {
            closeModal();
          }
        }
      );
    }
  }

  function show() {
    const section =
      ensureSection();

    section.hidden = false;

    injectStyles();

    refresh().catch(
      (error) => {
        console.error(
          "EZ MEDIA Broadcast Control:",
          error
        );

        notify(
          "تعذر تشغيل مركز البث.",
          "error"
        );
      }
    );
  }

  function hide() {
    const section =
      document.querySelector(
        "#broadcast-control-section"
      );

    if (section) {
      section.hidden = true;
    }
  }

  function getChannels() {
    return [...state.channels];
  }

  function openById(id) {
    show();

    setTimeout(() => {
      openChannel(id);
    }, 150);
  }

  window.EZMediaAdminBroadcastControl = {
    module: MODULE,
    show,
    hide,
    refresh,
    openById,
    getChannels
  };

  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const section =
        event.detail?.section ||
        event.detail?.target;

      if (
        section === "broadcast" ||
        section === "broadcast-control" ||
        section === "live-control"
      ) {
        show();
      }
    }
  );

  window.addEventListener(
    "ezmedia:live:updated",
    async () => {
      await refresh();
    }
  );

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        injectStyles();
        ensureSection();
      },
      { once: true }
    );
  } else {
    injectStyles();
    ensureSection();
  }

  console.info(
    "EZ MEDIA 11.0 — Broadcast Control loaded."
  );
})();
