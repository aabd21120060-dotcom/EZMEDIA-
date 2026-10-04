"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 25
 * الملف: public/admin-media-intelligence.js
 *
 * مركز إدارة الوسائط الذكي
 *
 * الوظائف:
 * - إدارة مكتبة الوسائط
 * - صور / فيديو / صوت / ملفات
 * - البحث والفلترة
 * - الإحصائيات
 * - معاينة الوسائط
 * - بيانات الملف
 * - ربط الوسائط بالمحتوى
 * - حذف الوسائط
 * - تحديث بيانات الوسائط
 * - نسخ رابط الوسيط
 * - استقبال الملفات المرفوعة من وحدة الرفع
 *
 * ملاحظة:
 * هذا المركز لا يختلق روابط أو بيانات تخزين.
 * البيانات الفعلية تأتي من API الخاص بالمنصة.
 */

(function () {
  const MODULE = "media-intelligence";

  const API = {
    media: "/api/media",
    upload: "/api/upload",
    content: "/api/content"
  };

  const state = {
    media: [],
    contents: [],
    statistics: null,
    search: "",
    type: "all",
    status: "all",
    selected: null,
    page: 1,
    limit: 40,
    loading: false
  };

  const MEDIA_TYPES = {
    image: "صور",
    video: "فيديو",
    audio: "صوت",
    document: "مستندات",
    other: "أخرى"
  };

  const MEDIA_STATUSES = {
    ready: "جاهز",
    processing: "قيد المعالجة",
    failed: "فشل",
    archived: "مؤرشف"
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

  function formatBytes(bytes) {
    const value = Number(bytes);

    if (!Number.isFinite(value) || value <= 0) {
      return "غير محدد";
    }

    const units = [
      "بايت",
      "كيلوبايت",
      "ميجابايت",
      "جيجابايت",
      "تيرابايت"
    ];

    let index = 0;
    let size = value;

    while (
      size >= 1024 &&
      index < units.length - 1
    ) {
      size /= 1024;
      index++;
    }

    return `${size.toFixed(
      index === 0 ? 0 : 2
    )} ${units[index]}`;
  }

  function notify(message, type = "info") {
    window.dispatchEvent(
      new CustomEvent("ezmedia:notification", {
        detail: {
          module: MODULE,
          type,
          title: "مركز الوسائط",
          message
        }
      })
    );

    const toast =
      document.querySelector("#ez-media-intelligence-toast");

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

  function normalizeList(data, keys = []) {
    if (Array.isArray(data)) {
      return data;
    }

    for (const key of keys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }
    }

    return [];
  }

  function normalizeMedia(item) {
    return {
      ...item,

      id: item.id,

      title:
        item.title ||
        item.name ||
        item.filename ||
        "وسيط بدون اسم",

      filename:
        item.filename ||
        item.original_name ||
        item.name ||
        "",

      type:
        item.type ||
        item.media_type ||
        item.mime_type ||
        "other",

      mimeType:
        item.mimeType ||
        item.mime_type ||
        "",

      status:
        item.status ||
        "ready",

      url:
        item.url ||
        item.public_url ||
        item.publicUrl ||
        item.location ||
        "",

      size:
        item.size ||
        item.file_size ||
        0,

      createdAt:
        item.createdAt ||
        item.created_at ||
        null,

      updatedAt:
        item.updatedAt ||
        item.updated_at ||
        null,

      width:
        item.width ||
        null,

      height:
        item.height ||
        null,

      duration:
        item.duration ||
        null,

      alt:
        item.alt ||
        item.alt_text ||
        "",

      description:
        item.description ||
        "",

      tags:
        Array.isArray(item.tags)
          ? item.tags
          : []
    };
  }

  function detectType(media) {
    const type = String(
      media.type ||
        media.mimeType ||
        ""
    ).toLowerCase();

    if (
      type.includes("image") ||
      type === "photo"
    ) {
      return "image";
    }

    if (
      type.includes("video") ||
      type === "movie"
    ) {
      return "video";
    }

    if (
      type.includes("audio") ||
      type === "sound"
    ) {
      return "audio";
    }

    if (
      type.includes("pdf") ||
      type.includes("document") ||
      type === "file"
    ) {
      return "document";
    }

    return "other";
  }

  async function loadMedia() {
    state.loading = true;

    try {
      const params = new URLSearchParams();

      params.set("limit", String(state.limit));
      params.set(
        "page",
        String(state.page)
      );

      if (state.search.trim()) {
        params.set(
          "search",
          state.search.trim()
        );
      }

      if (state.type !== "all") {
        params.set("type", state.type);
      }

      if (state.status !== "all") {
        params.set(
          "status",
          state.status
        );
      }

      const data = await fetchJSON(
        `${API.media}?${params.toString()}`
      );

      const list = normalizeList(data, [
        "items",
        "data",
        "media",
        "assets"
      ]);

      state.media = list.map(normalizeMedia);

      if (data.statistics) {
        state.statistics = data.statistics;
      }
    } catch (error) {
      console.error(
        "EZ MEDIA media intelligence load:",
        error
      );

      notify(
        "تعذر تحميل مكتبة الوسائط.",
        "error"
      );

      state.media = [];
    } finally {
      state.loading = false;
    }
  }

  async function loadStatistics() {
    try {
      const data = await fetchJSON(
        `${API.media}/statistics`
      );

      state.statistics =
        data.statistics ||
        data.data ||
        data;
    } catch (error) {
      console.warn(
        "EZ MEDIA media statistics:",
        error.message
      );
    }
  }

  async function loadContents() {
    try {
      const data = await fetchJSON(
        `${API.content}?limit=200`
      );

      state.contents = normalizeList(data, [
        "items",
        "data",
        "content"
      ]);
    } catch (error) {
      console.warn(
        "EZ MEDIA content load:",
        error.message
      );

      state.contents = [];
    }
  }

  function ensureSection() {
    let section =
      document.querySelector(
        "#media-intelligence-section"
      );

    if (section) {
      return section;
    }

    const parent =
      document.querySelector("main") ||
      document.querySelector("#admin-main") ||
      document.body;

    section = document.createElement("section");

    section.id =
      "media-intelligence-section";

    section.hidden = true;

    parent.appendChild(section);

    return section;
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-media-intelligence-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "ez-media-intelligence-styles";

    style.textContent = `
      #media-intelligence-section {
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

      .ez-media-shell {
        max-width: 1550px;
        margin: auto;
      }

      .ez-media-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 22px;
        border-radius: 24px;
        background:
          linear-gradient(
            135deg,
            #effbff,
            #ffffff
          );
        border: 1px solid #d8eff7;
        box-shadow:
          0 15px 40px
          rgba(42, 156, 193, .08);
      }

      .ez-media-header h2 {
        margin: 0 0 7px;
        font-size: 28px;
      }

      .ez-media-header p {
        margin: 0;
        color: #6d8798;
        line-height: 1.7;
      }

      .ez-media-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-media-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        background: #e9f8fd;
        color: #146984;
        font-weight: 800;
      }

      .ez-media-btn.primary {
        background: #32b4d6;
        color: white;
      }

      .ez-media-btn.danger {
        background: #fff0f2;
        color: #a42b45;
      }

      .ez-media-stats {
        display: grid;
        grid-template-columns:
          repeat(6, minmax(0, 1fr));
        gap: 12px;
        margin: 18px 0;
      }

      .ez-media-stat {
        background: white;
        border: 1px solid #e0edf2;
        border-radius: 18px;
        padding: 17px;
        box-shadow:
          0 8px 25px
          rgba(31, 107, 132, .06);
      }

      .ez-media-stat span {
        display: block;
        color: #71899a;
        font-size: 13px;
        margin-bottom: 7px;
      }

      .ez-media-stat strong {
        font-size: 24px;
        color: #163d57;
      }

      .ez-media-toolbar {
        display: grid;
        grid-template-columns:
          minmax(220px, 1fr)
          180px
          180px
          auto;
        gap: 9px;
        margin-bottom: 18px;
      }

      .ez-media-input,
      .ez-media-select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        background: white;
        border-radius: 12px;
        padding: 12px 14px;
        outline: none;
      }

      .ez-media-input:focus,
      .ez-media-select:focus {
        border-color: #55c4e3;
        box-shadow:
          0 0 0 3px
          rgba(85, 196, 227, .12);
      }

      .ez-media-grid {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 15px;
      }

      .ez-media-card {
        overflow: hidden;
        background: white;
        border: 1px solid #dfedf2;
        border-radius: 20px;
        box-shadow:
          0 8px 28px
          rgba(27, 103, 128, .06);
      }

      .ez-media-preview {
        height: 190px;
        background:
          linear-gradient(
            145deg,
            #effaff,
            #f8fdff
          );
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .ez-media-preview img,
      .ez-media-preview video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .ez-media-icon {
        font-size: 48px;
      }

      .ez-media-card-body {
        padding: 15px;
      }

      .ez-media-card h3 {
        margin: 0 0 8px;
        font-size: 16px;
        line-height: 1.5;
        word-break: break-word;
      }

      .ez-media-card p {
        margin: 5px 0;
        color: #718899;
        font-size: 12px;
        line-height: 1.6;
      }

      .ez-media-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 9px 0;
      }

      .ez-media-badge {
        border-radius: 999px;
        padding: 5px 9px;
        background: #eefaff;
        color: #16708d;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-media-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 12px;
      }

      .ez-media-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 55px 20px;
        border: 1px dashed #cde5ed;
        border-radius: 20px;
        color: #718c9c;
      }

      .ez-media-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background:
          rgba(14, 57, 76, .27);
        backdrop-filter: blur(7px);
      }

      .ez-media-modal.open {
        display: flex;
      }

      .ez-media-dialog {
        width: min(900px, 100%);
        max-height: 92vh;
        overflow: auto;
        background: white;
        border-radius: 24px;
        box-shadow:
          0 30px 90px
          rgba(15, 72, 96, .22);
      }

      .ez-media-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        padding: 20px;
        border-bottom: 1px solid #e4eff3;
      }

      .ez-media-dialog-body {
        padding: 20px;
      }

      .ez-media-detail-preview {
        width: 100%;
        max-height: 450px;
        border-radius: 16px;
        object-fit: contain;
        background: #f4fbfd;
      }

      .ez-media-detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 16px;
      }

      .ez-media-detail-item {
        padding: 12px;
        border-radius: 12px;
        background: #f7fbfd;
      }

      .ez-media-detail-item strong {
        display: block;
        margin-bottom: 5px;
      }

      .ez-media-dialog-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #e4eff3;
      }

      #ez-media-intelligence-toast {
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

      #ez-media-intelligence-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 1200px) {
        .ez-media-grid {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }

        .ez-media-stats {
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 850px) {
        .ez-media-toolbar {
          grid-template-columns: 1fr 1fr;
        }

        .ez-media-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-media-detail-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 600px) {
        #media-intelligence-section {
          padding: 12px;
        }

        .ez-media-header {
          display: block;
        }

        .ez-media-actions {
          margin-top: 15px;
        }

        .ez-media-toolbar {
          grid-template-columns: 1fr;
        }

        .ez-media-grid {
          grid-template-columns: 1fr;
        }

        .ez-media-stats {
          grid-template-columns: 1fr 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function calculateStats() {
    const stats = {
      total: state.media.length,
      images: 0,
      videos: 0,
      audio: 0,
      documents: 0,
      processing: 0,
      storage: 0
    };

    for (const media of state.media) {
      const type = detectType(media);

      if (type === "image") stats.images++;
      if (type === "video") stats.videos++;
      if (type === "audio") stats.audio++;
      if (type === "document") stats.documents++;

      if (media.status === "processing") {
        stats.processing++;
      }

      stats.storage +=
        Number(media.size) || 0;
    }

    return stats;
  }

  function render() {
    const section = ensureSection();

    const stats =
      state.statistics ||
      calculateStats();

    section.innerHTML = `
      <div class="ez-media-shell">

        <div class="ez-media-header">

          <div>
            <h2>مركز الوسائط الذكي</h2>

            <p>
              مكتبة موحدة لإدارة الصور والفيديو والصوت
              والملفات وربطها بالمحتوى الإعلامي.
            </p>
          </div>

          <div class="ez-media-actions">

            <button
              class="ez-media-btn"
              data-media-action="refresh"
            >
              تحديث المكتبة
            </button>

            <button
              class="ez-media-btn primary"
              data-media-action="upload"
            >
              رفع وسائط
            </button>

          </div>

        </div>

        <div class="ez-media-stats">

          ${statCard(
            "إجمالي الوسائط",
            stats.total ??
              stats.totalAssets ??
              0
          )}

          ${statCard(
            "الصور",
            stats.images ??
              stats.imageCount ??
              0
          )}

          ${statCard(
            "الفيديو",
            stats.videos ??
              stats.videoCount ??
              0
          )}

          ${statCard(
            "الصوت",
            stats.audio ??
              stats.audioCount ??
              0
          )}

          ${statCard(
            "المعالجة",
            stats.processing ?? 0
          )}

          ${statCard(
            "حجم التخزين",
            formatBytes(
              stats.storage ??
                stats.totalBytes ??
                0
            )
          )}

        </div>

        <div class="ez-media-toolbar">

          <input
            id="ez-media-search"
            class="ez-media-input"
            placeholder="ابحث في مكتبة الوسائط..."
            value="${escapeHtml(
              state.search
            )}"
          />

          <select
            id="ez-media-type"
            class="ez-media-select"
          >
            <option value="all">
              كل الأنواع
            </option>

            ${Object.entries(MEDIA_TYPES)
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${
                      state.type === key
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(label)}
                  </option>
                `
              )
              .join("")}

          </select>

          <select
            id="ez-media-status"
            class="ez-media-select"
          >
            <option value="all">
              كل الحالات
            </option>

            ${Object.entries(MEDIA_STATUSES)
              .map(
                ([key, label]) => `
                  <option
                    value="${key}"
                    ${
                      state.status === key
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(label)}
                  </option>
                `
              )
              .join("")}

          </select>

          <button
            class="ez-media-btn"
            data-media-action="clear"
          >
            مسح
          </button>

        </div>

        <div class="ez-media-grid">

          ${
            state.loading
              ? `
                <div class="ez-media-empty">
                  جاري تحميل مكتبة الوسائط...
                </div>
              `
              : state.media.length
              ? state.media
                  .map(renderMediaCard)
                  .join("")
              : `
                <div class="ez-media-empty">

                  <strong>
                    لا توجد وسائط متاحة
                  </strong>

                  <p>
                    عند رفع الصور أو الفيديو أو الصوت
                    ستظهر هنا تلقائيًا.
                  </p>

                </div>
              `
          }

        </div>

      </div>

      <div
        id="ez-media-intelligence-modal"
        class="ez-media-modal"
        aria-hidden="true"
      ></div>

      <div id="ez-media-intelligence-toast"></div>
    `;

    bindEvents();
  }

  function statCard(label, value) {
    return `
      <div class="ez-media-stat">
        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${escapeHtml(String(value))}
        </strong>
      </div>
    `;
  }

  function renderMediaCard(media) {
    const type = detectType(media);

    let preview = `
      <div class="ez-media-icon">
        ${typeIcon(type)}
      </div>
    `;

    if (
      type === "image" &&
      media.url
    ) {
      preview = `
        <img
          src="${escapeHtml(media.url)}"
          alt="${escapeHtml(
            media.alt ||
              media.title
          )}"
          loading="lazy"
          onerror="this.style.display='none'"
        />
      `;
    }

    if (
      type === "video" &&
      media.url
    ) {
      preview = `
        <video
          src="${escapeHtml(media.url)}"
          muted
          preload="metadata"
          controls
        ></video>
      `;
    }

    return `
      <article
        class="ez-media-card"
        data-media-id="${escapeHtml(
          media.id
        )}"
      >

        <div class="ez-media-preview">
          ${preview}
        </div>

        <div class="ez-media-card-body">

          <h3>
            ${escapeHtml(media.title)}
          </h3>

          <div class="ez-media-badges">

            <span class="ez-media-badge">
              ${escapeHtml(
                MEDIA_TYPES[type] ||
                  type
              )}
            </span>

            <span class="ez-media-badge">
              ${escapeHtml(
                MEDIA_STATUSES[
                  media.status
                ] ||
                  media.status ||
                  "جاهز"
              )}
            </span>

          </div>

          <p>
            الحجم:
            ${escapeHtml(
              formatBytes(media.size)
            )}
          </p>

          <p>
            ${escapeHtml(
              formatDate(
                media.createdAt
              )
            )}
          </p>

          <div class="ez-media-card-actions">

            <button
              class="ez-media-btn"
              data-media-action="open"
              data-id="${escapeHtml(
                media.id
              )}"
            >
              معاينة
            </button>

            <button
              class="ez-media-btn"
              data-media-action="copy"
              data-id="${escapeHtml(
                media.id
              )}"
            >
              نسخ الرابط
            </button>

            <button
              class="ez-media-btn"
              data-media-action="attach"
              data-id="${escapeHtml(
                media.id
              )}"
            >
              ربط بالمحتوى
            </button>

            <button
              class="ez-media-btn danger"
              data-media-action="delete"
              data-id="${escapeHtml(
                media.id
              )}"
            >
              حذف
            </button>

          </div>

        </div>

      </article>
    `;
  }

  function typeIcon(type) {
    const icons = {
      image: "🖼️",
      video: "🎬",
      audio: "🎙️",
      document: "📄",
      other: "📦"
    };

    return icons[type] || icons.other;
  }

  function openMedia(id) {
    const media = state.media.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!media) {
      notify(
        "الوسيط غير موجود.",
        "warning"
      );
      return;
    }

    state.selected = media;

    const type = detectType(media);

    let preview = `
      <div
        class="ez-media-preview"
        style="height:260px;border-radius:16px"
      >
        <div class="ez-media-icon">
          ${typeIcon(type)}
        </div>
      </div>
    `;

    if (
      type === "image" &&
      media.url
    ) {
      preview = `
        <img
          class="ez-media-detail-preview"
          src="${escapeHtml(media.url)}"
          alt="${escapeHtml(
            media.alt ||
              media.title
          )}"
        />
      `;
    }

    if (
      type === "video" &&
      media.url
    ) {
      preview = `
        <video
          class="ez-media-detail-preview"
          src="${escapeHtml(media.url)}"
          controls
          playsinline
        ></video>
      `;
    }

    if (
      type === "audio" &&
      media.url
    ) {
      preview = `
        <div
          style="
            padding:35px;
            text-align:center;
            background:#f2fbfd;
            border-radius:16px;
          "
        >
          <div class="ez-media-icon">
            🎙️
          </div>

          <audio
            src="${escapeHtml(media.url)}"
            controls
            style="width:100%;margin-top:20px"
          ></audio>
        </div>
      `;
    }

    const modal =
      document.querySelector(
        "#ez-media-intelligence-modal"
      );

    if (!modal) return;

    modal.innerHTML = `
      <div class="ez-media-dialog">

        <div class="ez-media-dialog-header">

          <strong>
            ${escapeHtml(media.title)}
          </strong>

          <button
            class="ez-media-btn"
            data-media-action="close"
          >
            إغلاق
          </button>

        </div>

        <div class="ez-media-dialog-body">

          ${preview}

          <div class="ez-media-detail-grid">

            ${detailItem(
              "النوع",
              MEDIA_TYPES[type] ||
                type
            )}

            ${detailItem(
              "الحالة",
              MEDIA_STATUSES[
                media.status
              ] ||
                media.status ||
                "غير محددة"
            )}

            ${detailItem(
              "الحجم",
              formatBytes(media.size)
            )}

            ${detailItem(
              "تاريخ الإنشاء",
              formatDate(
                media.createdAt
              )
            )}

            ${detailItem(
              "الأبعاد",
              media.width &&
                media.height
                ? `${media.width} × ${media.height}`
                : "غير محددة"
            )}

            ${detailItem(
              "المدة",
              media.duration
                ? `${media.duration} ثانية`
                : "غير محددة"
            )}

            ${detailItem(
              "MIME",
              media.mimeType ||
                "غير محدد"
            )}

            ${detailItem(
              "المعرف",
              String(media.id)
            )}

          </div>

          <div style="margin-top:15px">

            <strong>
              الوصف
            </strong>

            <p>
              ${escapeHtml(
                media.description ||
                  "لا يوجد وصف."
              )}
            </p>

          </div>

        </div>

        <div class="ez-media-dialog-footer">

          <button
            class="ez-media-btn"
            data-media-action="copy"
            data-id="${escapeHtml(
              media.id
            )}"
          >
            نسخ الرابط
          </button>

          <button
            class="ez-media-btn"
            data-media-action="attach"
            data-id="${escapeHtml(
              media.id
            )}"
          >
            ربط بالمحتوى
          </button>

          <button
            class="ez-media-btn danger"
            data-media-action="delete"
            data-id="${escapeHtml(
              media.id
            )}"
          >
            حذف الوسيط
          </button>

        </div>

      </div>
    `;

    modal.classList.add("open");
    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    bindEvents();
  }

  function detailItem(label, value) {
    return `
      <div class="ez-media-detail-item">
        <strong>
          ${escapeHtml(label)}
        </strong>

        <span>
          ${escapeHtml(String(value))}
        </span>
      </div>
    `;
  }

  function closeModal() {
    const modal =
      document.querySelector(
        "#ez-media-intelligence-modal"
      );

    if (!modal) return;

    modal.classList.remove("open");
    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    modal.innerHTML = "";
  }

  async function copyMediaUrl(id) {
    const media = state.media.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!media) return;

    if (!media.url) {
      notify(
        "لا يوجد رابط عام متاح لهذا الوسيط.",
        "warning"
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        media.url
      );

      notify(
        "تم نسخ رابط الوسيط.",
        "success"
      );
    } catch {
      notify(
        "تعذر نسخ الرابط تلقائيًا.",
        "warning"
      );
    }
  }

  function openAttachDialog(id) {
    const media = state.media.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!media) return;

    const options = state.contents
      .slice(0, 100)
      .map(
        (content) => `
          <option value="${escapeHtml(
            content.id
          )}">
            ${escapeHtml(
              content.title ||
                content.headline ||
                `محتوى ${content.id}`
            )}
          </option>
        `
      )
      .join("");

    openSimpleModal(
      "ربط الوسيط بالمحتوى",
      `
        <p>
          الوسيط:
          <strong>
            ${escapeHtml(media.title)}
          </strong>
        </p>

        ${
          options
            ? `
              <select
                id="ez-media-attach-content"
                class="ez-media-select"
              >
                <option value="">
                  اختر المحتوى
                </option>

                ${options}
              </select>
            `
            : `
              <p>
                لا توجد مواد CMS متاحة للربط.
              </p>
            `
        }
      `,
      `
        <button
          class="ez-media-btn"
          data-media-action="close"
        >
          إلغاء
        </button>

        ${
          options
            ? `
              <button
                class="ez-media-btn primary"
                data-media-action="confirm-attach"
                data-id="${escapeHtml(
                  id
                )}"
              >
                ربط
              </button>
            `
            : ""
        }
      `
    );
  }

  function openSimpleModal(
    title,
    body,
    footer
  ) {
    const modal =
      document.querySelector(
        "#ez-media-intelligence-modal"
      );

    if (!modal) return;

    modal.innerHTML = `
      <div class="ez-media-dialog">

        <div class="ez-media-dialog-header">

          <strong>
            ${escapeHtml(title)}
          </strong>

          <button
            class="ez-media-btn"
            data-media-action="close"
          >
            إغلاق
          </button>

        </div>

        <div class="ez-media-dialog-body">
          ${body}
        </div>

        <div class="ez-media-dialog-footer">
          ${footer}
        </div>

      </div>
    `;

    modal.classList.add("open");
    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    bindEvents();
  }

  async function attachMedia(id) {
    const media = state.media.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!media) return;

    const select =
      document.querySelector(
        "#ez-media-attach-content"
      );

    const contentId =
      select?.value;

    if (!contentId) {
      notify(
        "اختر المحتوى أولًا.",
        "warning"
      );
      return;
    }

    try {
      await fetchJSON(
        `${API.media}/${encodeURIComponent(
          id
        )}/attach`,
        {
          method: "POST",
          body: JSON.stringify({
            contentId
          })
        }
      );

      closeModal();

      notify(
        "تم ربط الوسيط بالمحتوى بنجاح.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA attach:",
        error
      );

      notify(
        "تعذر ربط الوسيط بالمحتوى.",
        "error"
      );
    }
  }

  async function deleteMedia(id) {
    const media = state.media.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

    if (!media) return;

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف "${media.title}"؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      await fetchJSON(
        `${API.media}/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE"
        }
      );

      state.media =
        state.media.filter(
          (item) =>
            String(item.id) !==
            String(id)
        );

      closeModal();
      render();

      notify(
        "تم حذف الوسيط بنجاح.",
        "success"
      );
    } catch (error) {
      console.error(
        "EZ MEDIA media delete:",
        error
      );

      notify(
        "تعذر حذف الوسيط.",
        "error"
      );
    }
  }

  function openUpload() {
    const input =
      document.createElement("input");

    input.type = "file";
    input.multiple = true;
    input.accept =
      "image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx";

    input.addEventListener(
      "change",
      async () => {
        if (!input.files?.length) {
          return;
        }

        await uploadFiles(
          Array.from(input.files)
        );
      }
    );

    input.click();
  }

  async function uploadFiles(files) {
    if (!files.length) return;

    notify(
      `بدء رفع ${files.length} ملف...`,
      "info"
    );

    let successful = 0;

    for (const file of files) {
      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        /*
         * لا نرسل Content-Type يدويًا هنا،
         * لأن المتصفح يضيف boundary الخاص بـ FormData.
         */
        const response =
          await fetch(
            API.upload,
            {
              method: "POST",
              body: formData,
              credentials: "include"
            }
          );

        let data = {};

        try {
          data =
            await response.json();
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

        successful++;
      } catch (error) {
        console.error(
          "EZ MEDIA upload:",
          file.name,
          error
        );
      }
    }

    await loadMedia();
    await loadStatistics();

    render();

    notify(
      `اكتمل الرفع: ${successful} من ${files.length} ملف.`,
      successful === files.length
        ? "success"
        : "warning"
    );
  }

  function clearFilters() {
    state.search = "";
    state.type = "all";
    state.status = "all";
    state.page = 1;

    render();

    loadMedia().then(render);
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#media-intelligence-section"
      );

    if (!section) return;

    section
      .querySelectorAll(
        "[data-media-action]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const action =
              button.dataset.mediaAction;

            const id =
              button.dataset.id;

            if (action === "open") {
              openMedia(id);
              return;
            }

            if (action === "close") {
              closeModal();
              return;
            }

            if (action === "copy") {
              await copyMediaUrl(id);
              return;
            }

            if (action === "attach") {
              openAttachDialog(id);
              return;
            }

            if (
              action ===
              "confirm-attach"
            ) {
              await attachMedia(id);
              return;
            }

            if (action === "delete") {
              await deleteMedia(id);
              return;
            }

            if (action === "upload") {
              openUpload();
              return;
            }

            if (action === "clear") {
              clearFilters();
              return;
            }

            if (action === "refresh") {
              await refresh();
            }
          }
        );
      });

    const search =
      section.querySelector(
        "#ez-media-search"
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
                state.page = 1;
                await loadMedia();
                render();
              },
              350
            );
        }
      );
    }

    const type =
      section.querySelector(
        "#ez-media-type"
      );

    if (type) {
      type.addEventListener(
        "change",
        async (event) => {
          state.type =
            event.target.value;

          state.page = 1;

          await loadMedia();

          render();
        }
      );
    }

    const status =
      section.querySelector(
        "#ez-media-status"
      );

    if (status) {
      status.addEventListener(
        "change",
        async (event) => {
          state.status =
            event.target.value;

          state.page = 1;

          await loadMedia();

          render();
        }
      );
    }

    const modal =
      document.querySelector(
        "#ez-media-intelligence-modal"
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

  async function refresh() {
    await Promise.all([
      loadMedia(),
      loadStatistics(),
      loadContents()
    ]);

    render();
  }

  function show() {
    const section =
      ensureSection();

    section.hidden = false;

    refresh().catch(
      (error) => {
        console.error(
          "EZ MEDIA Media Intelligence:",
          error
        );

        notify(
          "تعذر تشغيل مركز الوسائط.",
          "error"
        );
      }
    );
  }

  function hide() {
    const section =
      document.querySelector(
        "#media-intelligence-section"
      );

    if (section) {
      section.hidden = true;
    }
  }

  function getMedia() {
    return [...state.media];
  }

  function openById(id) {
    show();

    setTimeout(() => {
      openMedia(id);
    }, 150);
  }

  window.EZMediaAdminMediaIntelligence = {
    module: MODULE,
    show,
    hide,
    refresh,
    openById,
    getMedia
  };

  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const section =
        event.detail?.section ||
        event.detail?.target;

      if (
        section === "media" ||
        section === "media-intelligence" ||
        section === "library"
      ) {
        show();
      }
    }
  );

  window.addEventListener(
    "ezmedia:media:uploaded",
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
    "EZ MEDIA 11.0 — Media Intelligence loaded."
  );
})();
