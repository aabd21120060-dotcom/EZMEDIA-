"use strict";

/*
 * ============================================================
 * EZ MEDIA 11.0
 * لوحة إدارة البث المباشر
 * الملف: public/admin-live.js
 * ============================================================
 *
 * الوظائف:
 * - إدارة القنوات
 * - إنشاء قناة
 * - تعديل قناة
 * - حذف قناة
 * - تشغيل / إيقاف / اختبار / تعطيل
 * - عرض القنوات المباشرة
 * - عرض القنوات المميزة
 * - إحصائيات البث
 * - معاينة HLS / DASH / Embed / External
 * - البحث والتصفية
 * - تحديث تلقائي
 * - تصميم متوافق مع لوحة الإدارة الحالية
 *
 * لا يحتاج إلى مكتبات إضافية.
 * ============================================================
 */

(function () {
  "use strict";

  const API_BASE = "/api/live";
  const REFRESH_INTERVAL = 30000;

  let channels = [];
  let statistics = null;
  let editingId = null;
  let refreshTimer = null;
  let currentPreview = null;

  const state = {
    search: "",
    status: "all",
    sourceType: "all",
    featured: "all"
  };

  const statusLabels = {
    offline: "غير مباشر",
    testing: "اختبار",
    live: "مباشر",
    disabled: "معطل"
  };

  const sourceLabels = {
    hls: "HLS",
    dash: "DASH",
    rtmp: "RTMP",
    embed: "Embed",
    external: "خارجي"
  };

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat("ar-SA").format(number);
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatDuration(seconds) {
    const total = Number(seconds || 0);

    if (!total || total < 1) {
      return "—";
    }

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(
        secs
      ).padStart(2, "0")}`;
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function getStatusLabel(status) {
    return statusLabels[status] || status || "غير معروف";
  }

  function getSourceLabel(type) {
    return sourceLabels[type] || type || "غير معروف";
  }

  function getStatusClass(status) {
    switch (status) {
      case "live":
        return "ez-live-status ez-live-status-live";

      case "testing":
        return "ez-live-status ez-live-status-testing";

      case "disabled":
        return "ez-live-status ez-live-status-disabled";

      default:
        return "ez-live-status ez-live-status-offline";
    }
  }

  function showToast(message, type = "info") {
    let container = document.getElementById("ez-live-toast-container");

    if (!container) {
      container = document.createElement("div");
      container.id = "ez-live-toast-container";

      container.style.position = "fixed";
      container.style.top = "20px";
      container.style.left = "20px";
      container.style.zIndex = "99999";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";

      document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    const backgrounds = {
      success: "#e9fbf4",
      error: "#fff0f0",
      warning: "#fff9e8",
      info: "#eef8ff"
    };

    const borders = {
      success: "#9ce4c4",
      error: "#ffc4c4",
      warning: "#f4d88a",
      info: "#b7def7"
    };

    const textColors = {
      success: "#087443",
      error: "#b42318",
      warning: "#8a6100",
      info: "#075985"
    };

    toast.style.background = backgrounds[type] || backgrounds.info;
    toast.style.border = `1px solid ${
      borders[type] || borders.info
    }`;
    toast.style.color = textColors[type] || textColors.info;
    toast.style.padding = "12px 16px";
    toast.style.borderRadius = "14px";
    toast.style.boxShadow = "0 12px 35px rgba(39, 115, 170, 0.12)";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "700";
    toast.style.maxWidth = "360px";
    toast.style.direction = "rtl";
    toast.style.fontFamily =
      "Tajawal, Arial, Helvetica, sans-serif";

    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
      toast.style.transition = "all .25s ease";

      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }

  async function apiRequest(url, options = {}) {
    const requestOptions = {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    };

    const response = await fetch(url, requestOptions);

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `فشل الطلب (${response.status})`;

      throw new Error(message);
    }

    return data;
  }

  function normalizeListResponse(data) {
    if (!data) {
      return [];
    }

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.channels)) {
      return data.channels;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    return [];
  }

  function normalizeStatistics(data) {
    if (!data) {
      return null;
    }

    if (data.statistics) {
      return data.statistics;
    }

    if (data.data) {
      return data.data;
    }

    return data;
  }

  async function loadChannels() {
    const data = await apiRequest(`${API_BASE}?limit=100`);

    channels = normalizeListResponse(data);

    renderAll();
  }

  async function loadStatistics() {
    try {
      const data = await apiRequest(`${API_BASE}/statistics`);

      statistics = normalizeStatistics(data);

      renderStatistics();
    } catch (error) {
      console.warn("EZ MEDIA live statistics error:", error);
    }
  }

  async function loadFeatured() {
    try {
      const data = await apiRequest(`${API_BASE}/featured`);

      const featured = normalizeListResponse(data);

      renderFeatured(featured);
    } catch (error) {
      console.warn("EZ MEDIA featured channels error:", error);
      renderFeatured([]);
    }
  }

  async function refreshAll(showErrors = false) {
    try {
      await Promise.all([
        loadChannels(),
        loadStatistics(),
        loadFeatured()
      ]);
    } catch (error) {
      console.error("EZ MEDIA live refresh error:", error);

      if (showErrors) {
        showToast(
          error.message || "تعذر تحميل بيانات البث",
          "error"
        );
      }
    }
  }

  function getFilteredChannels() {
    const search = state.search.trim().toLowerCase();

    return channels.filter((channel) => {
      const matchesSearch =
        !search ||
        String(channel.name || "")
          .toLowerCase()
          .includes(search) ||
        String(channel.title || "")
          .toLowerCase()
          .includes(search) ||
        String(channel.slug || "")
          .toLowerCase()
          .includes(search) ||
        String(channel.description || "")
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        state.status === "all" ||
        String(channel.status || "") === state.status;

      const matchesSource =
        state.sourceType === "all" ||
        String(channel.source_type || channel.sourceType || "") ===
          state.sourceType;

      const isFeatured =
        Boolean(
          channel.is_featured ??
            channel.featured ??
            channel.metadata?.featured
        );

      const matchesFeatured =
        state.featured === "all" ||
        (state.featured === "featured" && isFeatured) ||
        (state.featured === "normal" && !isFeatured);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSource &&
        matchesFeatured
      );
    });
  }

  function renderStatistics() {
    const root = document.getElementById("ez-live-statistics");

    if (!root) {
      return;
    }

    const total =
      statistics?.total ??
      statistics?.total_channels ??
      statistics?.channels ??
      channels.length;

    const live =
      statistics?.live ??
      statistics?.live_channels ??
      channels.filter((channel) => channel.status === "live").length;

    const offline =
      statistics?.offline ??
      statistics?.offline_channels ??
      channels.filter((channel) => channel.status === "offline")
        .length;

    const testing =
      statistics?.testing ??
      statistics?.testing_channels ??
      channels.filter((channel) => channel.status === "testing")
        .length;

    const disabled =
      statistics?.disabled ??
      statistics?.disabled_channels ??
      channels.filter((channel) => channel.status === "disabled")
        .length;

    const viewers =
      statistics?.viewers ??
      statistics?.current_viewers ??
      statistics?.concurrent_viewers ??
      0;

    root.innerHTML = `
      <div class="ez-live-stat-card">
        <div class="ez-live-stat-icon">📡</div>
        <div>
          <strong>${formatNumber(total)}</strong>
          <span>إجمالي القنوات</span>
        </div>
      </div>

      <div class="ez-live-stat-card">
        <div class="ez-live-stat-icon ez-live-stat-icon-live">🔴</div>
        <div>
          <strong>${formatNumber(live)}</strong>
          <span>مباشر الآن</span>
        </div>
      </div>

      <div class="ez-live-stat-card">
        <div class="ez-live-stat-icon">🧪</div>
        <div>
          <strong>${formatNumber(testing)}</strong>
          <span>قيد الاختبار</span>
        </div>
      </div>

      <div class="ez-live-stat-card">
        <div class="ez-live-stat-icon">👁️</div>
        <div>
          <strong>${formatNumber(viewers)}</strong>
          <span>مشاهدون حاليًا</span>
        </div>
      </div>

      <div class="ez-live-stat-mini">
        <span>غير مباشر</span>
        <strong>${formatNumber(offline)}</strong>
      </div>

      <div class="ez-live-stat-mini">
        <span>معطل</span>
        <strong>${formatNumber(disabled)}</strong>
      </div>
    `;
  }

  function renderFeatured(featured) {
    const root = document.getElementById("ez-live-featured");

    if (!root) {
      return;
    }

    if (!featured.length) {
      root.innerHTML = `
        <div class="ez-live-empty">
          لا توجد قنوات مميزة حاليًا.
        </div>
      `;

      return;
    }

    root.innerHTML = featured
      .map((channel) => {
        const name = escapeHtml(
          channel.name || channel.title || "قناة بدون اسم"
        );

        const status = escapeHtml(
          getStatusLabel(channel.status)
        );

        const thumbnail = channel.thumbnail_url ||
          channel.thumbnailUrl ||
          channel.image_url ||
          channel.poster_url ||
          "";

        return `
          <button
            type="button"
            class="ez-live-featured-card"
            data-preview-id="${escapeHtml(channel.id)}"
          >
            <div class="ez-live-featured-image">
              ${
                thumbnail
                  ? `<img src="${escapeHtml(
                      thumbnail
                    )}" alt="${name}" loading="lazy">`
                  : `<div class="ez-live-no-image">📺</div>`
              }

              <span class="${getStatusClass(channel.status)}">
                ${status}
              </span>
            </div>

            <div class="ez-live-featured-content">
              <strong>${name}</strong>
              <span>${escapeHtml(
                getSourceLabel(
                  channel.source_type || channel.sourceType
                )
              )}</span>
            </div>
          </button>
        `;
      })
      .join("");

    root.querySelectorAll("[data-preview-id]").forEach((button) => {
      button.addEventListener("click", () => {
        openPreview(button.dataset.previewId);
      });
    });
  }

  function renderChannels() {
    const root = document.getElementById("ez-live-channels");

    if (!root) {
      return;
    }

    const filtered = getFilteredChannels();

    if (!filtered.length) {
      root.innerHTML = `
        <div class="ez-live-empty">
          <div class="ez-live-empty-icon">📡</div>
          <strong>لا توجد قنوات مطابقة</strong>
          <span>غيّر البحث أو عوامل التصفية.</span>
        </div>
      `;

      return;
    }

    root.innerHTML = filtered
      .map((channel) => renderChannelCard(channel))
      .join("");

    root
      .querySelectorAll("[data-action]")
      .forEach((button) => {
        button.addEventListener("click", handleChannelAction);
      });
  }

  function renderChannelCard(channel) {
    const id = escapeHtml(channel.id);

    const name = escapeHtml(
      channel.name || channel.title || "قناة بدون اسم"
    );

    const description = escapeHtml(
      channel.description || "لا يوجد وصف للقناة."
    );

    const slug = escapeHtml(channel.slug || "—");

    const status = channel.status || "offline";

    const sourceType =
      channel.source_type || channel.sourceType || "external";

    const streamUrl =
      channel.stream_url ||
      channel.streamUrl ||
      channel.source_url ||
      channel.sourceUrl ||
      "";

    const thumbnail =
      channel.thumbnail_url ||
      channel.thumbnailUrl ||
      channel.image_url ||
      channel.poster_url ||
      "";

    const isFeatured = Boolean(
      channel.is_featured ??
        channel.featured ??
        channel.metadata?.featured
    );

    return `
      <article class="ez-live-channel-card">
        <div class="ez-live-channel-media">
          ${
            thumbnail
              ? `<img
                  src="${escapeHtml(thumbnail)}"
                  alt="${name}"
                  loading="lazy"
                >`
              : `
                <div class="ez-live-channel-placeholder">
                  <span>📺</span>
                  <small>EZ MEDIA</small>
                </div>
              `
          }

          <div class="ez-live-channel-overlay">
            <span class="${getStatusClass(status)}">
              ${escapeHtml(getStatusLabel(status))}
            </span>

            ${
              isFeatured
                ? `<span class="ez-live-featured-badge">مميزة</span>`
                : ""
            }
          </div>
        </div>

        <div class="ez-live-channel-body">
          <div class="ez-live-channel-title-row">
            <div>
              <h3>${name}</h3>
              <p>${description}</p>
            </div>

            <button
              type="button"
              class="ez-live-icon-button"
              title="معاينة"
              data-action="preview"
              data-id="${id}"
            >
              ▶
            </button>
          </div>

          <div class="ez-live-channel-meta">
            <span>
              <b>Slug:</b>
              ${slug}
            </span>

            <span>
              <b>المصدر:</b>
              ${escapeHtml(getSourceLabel(sourceType))}
            </span>

            <span>
              <b>آخر تحديث:</b>
              ${escapeHtml(formatDate(channel.updated_at || channel.updatedAt))}
            </span>
          </div>

          ${
            streamUrl
              ? `
                <div class="ez-live-url">
                  <span>مصدر البث</span>
                  <code>${escapeHtml(streamUrl)}</code>
                </div>
              `
              : ""
          }

          <div class="ez-live-channel-actions">
            <button
              type="button"
              class="ez-live-button ez-live-button-primary"
              data-action="preview"
              data-id="${id}"
            >
              ▶ معاينة
            </button>

            <button
              type="button"
              class="ez-live-button"
              data-action="edit"
              data-id="${id}"
            >
              ✏️ تعديل
            </button>

            ${
              status === "live"
                ? `
                  <button
                    type="button"
                    class="ez-live-button ez-live-button-warning"
                    data-action="stop"
                    data-id="${id}"
                  >
                    ⏹ إيقاف
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="ez-live-button ez-live-button-success"
                    data-action="start"
                    data-id="${id}"
                  >
                    ▶ تشغيل
                  </button>
                `
            }

            <button
              type="button"
              class="ez-live-button"
              data-action="test"
              data-id="${id}"
            >
              🧪 اختبار
            </button>

            <button
              type="button"
              class="ez-live-button ez-live-button-danger"
              data-action="delete"
              data-id="${id}"
            >
              🗑 حذف
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderAll() {
    renderStatistics();
    renderChannels();
  }

  function openCreateModal() {
    editingId = null;

    openModal({
      title: "إضافة قناة بث جديدة",
      channel: {
        name: "",
        title: "",
        description: "",
        slug: "",
        source_type: "hls",
        stream_url: "",
        thumbnail_url: "",
        poster_url: "",
        status: "offline",
        is_featured: false,
        sort_order: 0
      }
    });
  }

  function openEditModal(id) {
    const channel = channels.find(
      (item) => String(item.id) === String(id)
    );

    if (!channel) {
      showToast("القناة غير موجودة", "error");
      return;
    }

    editingId = channel.id;

    openModal({
      title: "تعديل قناة البث",
      channel
    });
  }

  function openModal({ title, channel }) {
    closeModal();

    const modal = document.createElement("div");

    modal.id = "ez-live-modal";

    modal.innerHTML = `
      <div class="ez-live-modal-backdrop" data-close-modal></div>

      <div class="ez-live-modal">
        <div class="ez-live-modal-header">
          <div>
            <span>EZ MEDIA 11.0</span>
            <h2>${escapeHtml(title)}</h2>
          </div>

          <button
            type="button"
            class="ez-live-modal-close"
            data-close-modal
          >
            ×
          </button>
        </div>

        <form id="ez-live-channel-form">

          <div class="ez-live-form-grid">

            <label>
              <span>اسم القناة *</span>
              <input
                name="name"
                required
                maxlength="200"
                value="${escapeHtml(
                  channel.name || channel.title || ""
                )}"
                placeholder="مثال: EZ MEDIA LIVE"
              >
            </label>

            <label>
              <span>العنوان</span>
              <input
                name="title"
                maxlength="200"
                value="${escapeHtml(channel.title || "")}"
                placeholder="عنوان القناة"
              >
            </label>

            <label class="ez-live-form-full">
              <span>الوصف</span>
              <textarea
                name="description"
                rows="4"
                maxlength="2000"
                placeholder="وصف مختصر للقناة"
              >${escapeHtml(
                channel.description || ""
              )}</textarea>
            </label>

            <label>
              <span>Slug</span>
              <input
                name="slug"
                maxlength="200"
                value="${escapeHtml(channel.slug || "")}"
                placeholder="ez-media-live"
              >
            </label>

            <label>
              <span>نوع المصدر *</span>
              <select name="source_type" required>
                ${renderSourceOptions(channel.source_type || channel.sourceType)}
              </select>
            </label>

            <label class="ez-live-form-full">
              <span>رابط مصدر البث</span>
              <input
                name="stream_url"
                type="url"
                value="${escapeHtml(
                  channel.stream_url ||
                    channel.streamUrl ||
                    channel.source_url ||
                    channel.sourceUrl ||
                    ""
                )}"
                placeholder="https://example.com/live.m3u8"
              >
            </label>

            <label>
              <span>رابط الصورة</span>
              <input
                name="thumbnail_url"
                type="url"
                value="${escapeHtml(
                  channel.thumbnail_url ||
                    channel.thumbnailUrl ||
                    ""
                )}"
                placeholder="https://..."
              >
            </label>

            <label>
              <span>رابط Poster</span>
              <input
                name="poster_url"
                type="url"
                value="${escapeHtml(
                  channel.poster_url || ""
                )}"
                placeholder="https://..."
              >
            </label>

            <label>
              <span>الحالة</span>
              <select name="status">
                ${renderStatusOptions(channel.status || "offline")}
              </select>
            </label>

            <label>
              <span>ترتيب العرض</span>
              <input
                name="sort_order"
                type="number"
                min="0"
                max="999999"
                value="${Number(channel.sort_order || 0)}"
              >
            </label>

            <label class="ez-live-checkbox">
              <input
                name="is_featured"
                type="checkbox"
                ${
                  channel.is_featured ??
                  channel.featured ??
                  channel.metadata?.featured
                    ? "checked"
                    : ""
                }
              >
              <span>إظهار القناة ضمن القنوات المميزة</span>
            </label>

          </div>

          <div
            id="ez-live-form-message"
            class="ez-live-form-message"
          ></div>

          <div class="ez-live-modal-actions">
            <button
              type="button"
              class="ez-live-button"
              data-close-modal
            >
              إلغاء
            </button>

            <button
              type="submit"
              class="ez-live-button ez-live-button-primary"
            >
              💾 حفظ القناة
            </button>
          </div>

        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal
      .querySelectorAll("[data-close-modal]")
      .forEach((element) => {
        element.addEventListener("click", closeModal);
      });

    const form = modal.querySelector("#ez-live-channel-form");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      await saveChannel(form);
    });

    const sourceSelect = form.querySelector(
      '[name="source_type"]'
    );

    sourceSelect.addEventListener("change", () => {
      updateStreamFieldHint(sourceSelect.value);
    });

    updateStreamFieldHint(sourceSelect.value);
  }

  function renderSourceOptions(selected) {
    const options = [
      ["hls", "HLS"],
      ["dash", "DASH"],
      ["rtmp", "RTMP"],
      ["embed", "Embed"],
      ["external", "خارجي"]
    ];

    return options
      .map(
        ([value, label]) => `
          <option
            value="${value}"
            ${selected === value ? "selected" : ""}
          >
            ${label}
          </option>
        `
      )
      .join("");
  }

  function renderStatusOptions(selected) {
    return Object.entries(statusLabels)
      .map(
        ([value, label]) => `
          <option
            value="${value}"
            ${selected === value ? "selected" : ""}
          >
            ${label}
          </option>
        `
      )
      .join("");
  }

  function updateStreamFieldHint(type) {
    const input = document.querySelector(
      '#ez-live-channel-form [name="stream_url"]'
    );

    if (!input) {
      return;
    }

    const placeholders = {
      hls: "https://example.com/live/index.m3u8",
      dash: "https://example.com/live/manifest.mpd",
      rtmp: "rtmp://example.com/live/stream",
      embed: "https://example.com/embed/live",
      external: "https://example.com/live"
    };

    input.placeholder =
      placeholders[type] || placeholders.external;
  }

  async function saveChannel(form) {
    const message = form.querySelector(
      "#ez-live-form-message"
    );

    const submitButton = form.querySelector(
      'button[type="submit"]'
    );

    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      title: String(formData.get("title") || "").trim(),
      description: String(
        formData.get("description") || ""
      ).trim(),
      slug: String(formData.get("slug") || "").trim(),
      source_type: String(
        formData.get("source_type") || "hls"
      ),
      stream_url: String(
        formData.get("stream_url") || ""
      ).trim(),
      thumbnail_url: String(
        formData.get("thumbnail_url") || ""
      ).trim(),
      poster_url: String(
        formData.get("poster_url") || ""
      ).trim(),
      status: String(formData.get("status") || "offline"),
      is_featured: formData.get("is_featured") === "on",
      sort_order: Number(
        formData.get("sort_order") || 0
      )
    };

    if (!payload.name) {
      message.textContent = "اسم القناة مطلوب.";
      message.className =
        "ez-live-form-message ez-live-form-message-error";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "جاري الحفظ...";

    message.textContent = "";

    try {
      let response;

      if (editingId) {
        response = await apiRequest(
          `${API_BASE}/${encodeURIComponent(editingId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );

        showToast("تم تحديث قناة البث بنجاح", "success");
      } else {
        response = await apiRequest(API_BASE, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        showToast("تم إنشاء قناة البث بنجاح", "success");
      }

      console.log("EZ MEDIA live channel saved:", response);

      closeModal();

      await refreshAll(false);
    } catch (error) {
      console.error("EZ MEDIA save live channel error:", error);

      message.textContent =
        error.message || "تعذر حفظ القناة.";

      message.className =
        "ez-live-form-message ez-live-form-message-error";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "💾 حفظ القناة";
    }
  }

  function closeModal() {
    const modal = document.getElementById("ez-live-modal");

    if (modal) {
      modal.remove();
    }

    editingId = null;
  }

  function handleChannelAction(event) {
    const button = event.currentTarget;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!action || !id) {
      return;
    }

    switch (action) {
      case "preview":
        openPreview(id);
        break;

      case "edit":
        openEditModal(id);
        break;

      case "start":
        changeChannelStatus(id, "live");
        break;

      case "stop":
        changeChannelStatus(id, "offline");
        break;

      case "test":
        changeChannelStatus(id, "testing");
        break;

      case "delete":
        deleteChannel(id);
        break;

      default:
        break;
    }
  }

  async function changeChannelStatus(id, status) {
    const channel = channels.find(
      (item) => String(item.id) === String(id)
    );

    if (!channel) {
      showToast("القناة غير موجودة", "error");
      return;
    }

    const actionNames = {
      live: "تشغيل",
      offline: "إيقاف",
      testing: "اختبار",
      disabled: "تعطيل"
    };

    const actionName = actionNames[status] || "تغيير الحالة";

    const confirmed = window.confirm(
      `هل تريد ${actionName} القناة "${channel.name || channel.title}"؟`
    );

    if (!confirmed) {
      return;
    }

    try {
      let endpoint = `${API_BASE}/${encodeURIComponent(
        id
      )}/status`;

      let payload = {
        status
      };

      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showToast(
        `تم ${actionName} القناة بنجاح`,
        "success"
      );

      await refreshAll(false);
    } catch (error) {
      console.error(
        "EZ MEDIA channel status error:",
        error
      );

      showToast(
        error.message || "تعذر تغيير حالة القناة",
        "error"
      );
    }
  }

  async function deleteChannel(id) {
    const channel = channels.find(
      (item) => String(item.id) === String(id)
    );

    if (!channel) {
      showToast("القناة غير موجودة", "error");
      return;
    }

    const channelName =
      channel.name || channel.title || "هذه القناة";

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف "${channelName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await apiRequest(
        `${API_BASE}/${encodeURIComponent(id)}`,
        {
          method: "DELETE"
        }
      );

      showToast("تم حذف القناة", "success");

      if (
        currentPreview &&
        String(currentPreview.id) === String(id)
      ) {
        closePreview();
      }

      await refreshAll(false);
    } catch (error) {
      console.error("EZ MEDIA delete live error:", error);

      showToast(
        error.message || "تعذر حذف القناة",
        "error"
      );
    }
  }

  function openPreview(id) {
    const channel = channels.find(
      (item) => String(item.id) === String(id)
    );

    if (!channel) {
      showToast("القناة غير موجودة", "error");
      return;
    }

    currentPreview = channel;

    closePreview();

    const modal = document.createElement("div");

    modal.id = "ez-live-preview";

    const name = escapeHtml(
      channel.name || channel.title || "EZ MEDIA LIVE"
    );

    const sourceType =
      channel.source_type || channel.sourceType || "external";

    const streamUrl =
      channel.stream_url ||
      channel.streamUrl ||
      channel.source_url ||
      channel.sourceUrl ||
      "";

    const poster =
      channel.poster_url ||
      channel.thumbnail_url ||
      channel.thumbnailUrl ||
      "";

    modal.innerHTML = `
      <div class="ez-live-preview-backdrop" data-close-preview></div>

      <div class="ez-live-preview-modal">

        <div class="ez-live-preview-header">
          <div>
            <span>المعاينة المباشرة</span>
            <h2>${name}</h2>
          </div>

          <button
            type="button"
            class="ez-live-modal-close"
            data-close-preview
          >
            ×
          </button>
        </div>

        <div class="ez-live-player-container">
          <div
            id="ez-live-player"
            class="ez-live-player"
          ></div>
        </div>

        <div class="ez-live-preview-info">

          <div>
            <span>الحالة</span>
            <strong>
              ${escapeHtml(
                getStatusLabel(channel.status)
              )}
            </strong>
          </div>

          <div>
            <span>نوع المصدر</span>
            <strong>
              ${escapeHtml(
                getSourceLabel(sourceType)
              )}
            </strong>
          </div>

          <div>
            <span>الرابط</span>
            <strong>
              ${
                streamUrl
                  ? `<code>${escapeHtml(
                      streamUrl
                    )}</code>`
                  : "غير محدد"
              }
            </strong>
          </div>

        </div>

        <div class="ez-live-preview-actions">
          ${
            streamUrl
              ? `
                <button
                  type="button"
                  class="ez-live-button ez-live-button-primary"
                  data-copy-stream
                >
                  📋 نسخ رابط البث
                </button>
              `
              : ""
          }

          <button
            type="button"
            class="ez-live-button"
            data-close-preview
          >
            إغلاق
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    modal
      .querySelectorAll("[data-close-preview]")
      .forEach((element) => {
        element.addEventListener("click", closePreview);
      });

    const copyButton =
      modal.querySelector("[data-copy-stream]");

    if (copyButton && streamUrl) {
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(streamUrl);

          showToast(
            "تم نسخ رابط البث",
            "success"
          );
        } catch (error) {
          showToast(
            "تعذر نسخ الرابط",
            "error"
          );
        }
      });
    }

    initializePlayer(
      modal.querySelector("#ez-live-player"),
      {
        sourceType,
        streamUrl,
        poster,
        name
      }
    );
  }

  function initializePlayer(root, options) {
    if (!root) {
      return;
    }

    const {
      sourceType,
      streamUrl,
      poster,
      name
    } = options;

    if (!streamUrl) {
      root.innerHTML = `
        <div class="ez-live-player-empty">
          <div>📡</div>
          <strong>لا يوجد مصدر بث</strong>
          <span>أضف رابط مصدر البث من إعدادات القناة.</span>
        </div>
      `;

      return;
    }

    if (sourceType === "embed") {
      root.innerHTML = `
        <iframe
          src="${escapeHtml(streamUrl)}"
          title="${escapeHtml(name)}"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      `;

      return;
    }

    if (sourceType === "external") {
      root.innerHTML = `
        <div class="ez-live-external-player">
          <div class="ez-live-external-icon">🌐</div>

          <strong>مصدر بث خارجي</strong>

          <span>
            يمكن فتح المصدر في نافذة مستقلة.
          </span>

          <a
            href="${escapeHtml(streamUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="ez-live-button ez-live-button-primary"
          >
            فتح مصدر البث
          </a>
        </div>
      `;

      return;
    }

    if (sourceType === "rtmp") {
      root.innerHTML = `
        <div class="ez-live-player-empty">
          <div>📡</div>
          <strong>RTMP</strong>
          <span>
            RTMP مصدر إدخال للبث ولا يتم تشغيله مباشرة
            داخل متصفح الويب. استخدم HLS أو DASH للإخراج.
          </span>
        </div>
      `;

      return;
    }

    const video = document.createElement("video");

    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.background = "#061522";

    if (poster) {
      video.poster = poster;
    }

    root.appendChild(video);

    if (sourceType === "hls") {
      initializeHlsPlayer(video, streamUrl);
      return;
    }

    if (sourceType === "dash") {
      initializeDashPlayer(video, streamUrl);
      return;
    }

    video.src = streamUrl;

    video.play().catch(() => {
      console.info(
        "Autoplay blocked by browser."
      );
    });
  }

  function initializeHlsPlayer(video, url) {
    if (
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      video.src = url;

      video.play().catch(() => {
        console.info(
          "HLS autoplay blocked by browser."
        );
      });

      return;
    }

    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          console.info(
            "HLS autoplay blocked by browser."
          );
        });
      });

      hls.on(
        window.Hls.Events.ERROR,
        function (event, data) {
          console.warn(
            "EZ MEDIA HLS error:",
            data
          );
        }
      );

      video._ezHls = hls;

      return;
    }

    showPlayerError(
      video.parentElement,
      "المتصفح لا يدعم تشغيل HLS بهذه الطريقة."
    );
  }

  function initializeDashPlayer(video, url) {
    if (
      window.dashjs &&
      typeof window.dashjs.MediaPlayer === "function"
    ) {
      const player =
        window.dashjs.MediaPlayer().create();

      player.initialize(
        video,
        url,
        true
      );

      video._ezDash = player;

      return;
    }

    showPlayerError(
      video.parentElement,
      "مشغل DASH غير متوفر في الصفحة."
    );
  }

  function showPlayerError(root, message) {
    if (!root) {
      return;
    }

    root.innerHTML = `
      <div class="ez-live-player-empty">
        <div>⚠️</div>
        <strong>تعذر تشغيل البث</strong>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  function closePreview() {
    const modal =
      document.getElementById("ez-live-preview");

    if (!modal) {
      currentPreview = null;
      return;
    }

    const video = modal.querySelector("video");

    if (video) {
      try {
        video.pause();
      } catch (error) {
        // لا شيء
      }

      if (video._ezHls) {
        try {
          video._ezHls.destroy();
        } catch (error) {
          console.warn(
            "HLS cleanup error:",
            error
          );
        }
      }

      if (video._ezDash) {
        try {
          video._ezDash.reset();
        } catch (error) {
          console.warn(
            "DASH cleanup error:",
            error
          );
        }
      }
    }

    modal.remove();

    currentPreview = null;
  }

  function createInterface() {
    if (
      document.getElementById("ez-live-admin")
    ) {
      return;
    }

    const mount =
      document.getElementById("live-section") ||
      document.getElementById("admin-live-section") ||
      document.querySelector(
        '[data-admin-section="live"]'
      );

    if (!mount) {
      return;
    }

    mount.innerHTML = `
      <section
        id="ez-live-admin"
        class="ez-live-admin"
        dir="rtl"
      >

        <div class="ez-live-header">

          <div class="ez-live-heading">

            <div class="ez-live-heading-icon">
              📡
            </div>

            <div>
              <span class="ez-live-eyebrow">
                EZ MEDIA 11.0
              </span>

              <h1>
                إدارة البث المباشر
              </h1>

              <p>
                مركز إدارة القنوات والبث المباشر
                ومصادر البث والمعاينة.
              </p>
            </div>

          </div>

          <div class="ez-live-header-actions">

            <button
              type="button"
              id="ez-live-refresh"
              class="ez-live-button"
            >
              ↻ تحديث
            </button>

            <button
              type="button"
              id="ez-live-create"
              class="ez-live-button ez-live-button-primary"
            >
              ＋ إضافة قناة
            </button>

          </div>

        </div>

        <div
          id="ez-live-statistics"
          class="ez-live-statistics"
        ></div>

        <section class="ez-live-panel">

          <div class="ez-live-panel-header">

            <div>
              <span class="ez-live-section-label">
                LIVE CONTROL
              </span>

              <h2>
                القنوات
              </h2>
            </div>

            <span
              id="ez-live-last-update"
              class="ez-live-last-update"
            >
              آخر تحديث: —
            </span>

          </div>

          <div class="ez-live-filters">

            <div class="ez-live-search">
              <span>⌕</span>

              <input
                id="ez-live-search"
                type="search"
                placeholder="ابحث عن قناة..."
                autocomplete="off"
              >
            </div>

            <select id="ez-live-status-filter">
              <option value="all">كل الحالات</option>
              <option value="live">مباشر</option>
              <option value="testing">اختبار</option>
              <option value="offline">غير مباشر</option>
              <option value="disabled">معطل</option>
            </select>

            <select id="ez-live-source-filter">
              <option value="all">كل المصادر</option>
              <option value="hls">HLS</option>
              <option value="dash">DASH</option>
              <option value="rtmp">RTMP</option>
              <option value="embed">Embed</option>
              <option value="external">خارجي</option>
            </select>

            <select id="ez-live-featured-filter">
              <option value="all">كل القنوات</option>
              <option value="featured">المميزة فقط</option>
              <option value="normal">العادية فقط</option>
            </select>

          </div>

          <div
            id="ez-live-channels"
            class="ez-live-channels"
          ></div>

        </section>

        <section class="ez-live-panel">

          <div class="ez-live-panel-header">

            <div>
              <span class="ez-live-section-label">
                FEATURED
              </span>

              <h2>
                القنوات المميزة
              </h2>
            </div>

          </div>

          <div
            id="ez-live-featured"
            class="ez-live-featured"
          ></div>

        </section>

      </section>
    `;

    bindInterfaceEvents();

    injectStyles();
  }

  function bindInterfaceEvents() {
    const createButton =
      document.getElementById("ez-live-create");

    if (createButton) {
      createButton.addEventListener(
        "click",
        openCreateModal
      );
    }

    const refreshButton =
      document.getElementById("ez-live-refresh");

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        async () => {
          refreshButton.disabled = true;
          refreshButton.textContent =
            "جاري التحديث...";

          await refreshAll(true);

          refreshButton.disabled = false;
          refreshButton.textContent = "↻ تحديث";

          updateLastRefreshTime();
        }
      );
    }

    const search =
      document.getElementById("ez-live-search");

    if (search) {
      search.addEventListener("input", () => {
        state.search = search.value;
        renderChannels();
      });
    }

    const statusFilter =
      document.getElementById(
        "ez-live-status-filter"
      );

    if (statusFilter) {
      statusFilter.addEventListener(
        "change",
        () => {
          state.status = statusFilter.value;
          renderChannels();
        }
      );
    }

    const sourceFilter =
      document.getElementById(
        "ez-live-source-filter"
      );

    if (sourceFilter) {
      sourceFilter.addEventListener(
        "change",
        () => {
          state.sourceType =
            sourceFilter.value;

          renderChannels();
        }
      );
    }

    const featuredFilter =
      document.getElementById(
        "ez-live-featured-filter"
      );

    if (featuredFilter) {
      featuredFilter.addEventListener(
        "change",
        () => {
          state.featured =
            featuredFilter.value;

          renderChannels();
        }
      );
    }
  }

  function updateLastRefreshTime() {
    const element = document.getElementById(
      "ez-live-last-update"
    );

    if (!element) {
      return;
    }

    element.textContent =
      `آخر تحديث: ${new Intl.DateTimeFormat(
        "ar-SA",
        {
          dateStyle: "medium",
          timeStyle: "medium"
        }
      ).format(new Date())}`;
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-live-admin-styles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");

    style.id = "ez-live-admin-styles";

    style.textContent = `
      #ez-live-admin {
        --ez-blue: #29b6f6;
        --ez-blue-dark: #087db5;
        --ez-blue-light: #eefaff;
        --ez-ice: #f5fcff;
        --ez-border: #dceff8;
        --ez-text: #17324d;
        --ez-muted: #6f8da3;
        --ez-white: #ffffff;

        width: 100%;
        box-sizing: border-box;
        font-family:
          Tajawal,
          Arial,
          Helvetica,
          sans-serif;
        color: var(--ez-text);
      }

      #ez-live-admin *,
      #ez-live-admin *::before,
      #ez-live-admin *::after {
        box-sizing: border-box;
      }

      .ez-live-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 24px;
        margin-bottom: 20px;
        background:
          linear-gradient(
            135deg,
            #ffffff 0%,
            #f5fcff 52%,
            #eaf8ff 100%
          );
        border: 1px solid var(--ez-border);
        border-radius: 24px;
        box-shadow:
          0 12px 40px
          rgba(39, 150, 199, .08);
      }

      .ez-live-heading {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .ez-live-heading-icon {
        width: 58px;
        height: 58px;
        display: grid;
        place-items: center;
        border-radius: 18px;
        background:
          linear-gradient(
            135deg,
            #e7f8ff,
            #ffffff
          );
        border: 1px solid #cdeefa;
        font-size: 28px;
        box-shadow:
          0 8px 25px
          rgba(41, 182, 246, .12);
      }

      .ez-live-eyebrow {
        display: block;
        color: var(--ez-blue-dark);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .12em;
        margin-bottom: 5px;
      }

      .ez-live-header h1 {
        margin: 0 0 5px;
        font-size: 28px;
        line-height: 1.2;
      }

      .ez-live-header p {
        margin: 0;
        color: var(--ez-muted);
        font-size: 14px;
      }

      .ez-live-header-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .ez-live-button {
        min-height: 42px;
        border: 1px solid var(--ez-border);
        background: #ffffff;
        color: var(--ez-text);
        padding: 9px 15px;
        border-radius: 12px;
        font-family: inherit;
        font-weight: 800;
        cursor: pointer;
        transition:
          transform .18s ease,
          box-shadow .18s ease,
          border-color .18s ease,
          background .18s ease;
      }

      .ez-live-button:hover {
        transform: translateY(-1px);
        border-color: #a9ddf2;
        box-shadow:
          0 8px 22px
          rgba(39, 150, 199, .10);
      }

      .ez-live-button:disabled {
        opacity: .6;
        cursor: wait;
        transform: none;
      }

      .ez-live-button-primary {
        background:
          linear-gradient(
            135deg,
            #27b5f2,
            #0d8dc8
          );
        color: #ffffff;
        border-color: transparent;
      }

      .ez-live-button-success {
        background: #ecfff7;
        color: #087443;
        border-color: #a7e9cb;
      }

      .ez-live-button-warning {
        background: #fff9e8;
        color: #8a6100;
        border-color: #f3dda0;
      }

      .ez-live-button-danger {
        background: #fff1f1;
        color: #b42318;
        border-color: #ffcaca;
      }

      .ez-live-statistics {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }

      .ez-live-stat-card,
      .ez-live-stat-mini {
        background: #ffffff;
        border: 1px solid var(--ez-border);
        border-radius: 18px;
        min-height: 92px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow:
          0 8px 30px
          rgba(39, 150, 199, .05);
      }

      .ez-live-stat-card strong,
      .ez-live-stat-mini strong {
        display: block;
        font-size: 23px;
        line-height: 1.2;
        color: var(--ez-text);
      }

      .ez-live-stat-card span,
      .ez-live-stat-mini span {
        display: block;
        color: var(--ez-muted);
        font-size: 12px;
        margin-top: 4px;
      }

      .ez-live-stat-icon {
        width: 48px;
        height: 48px;
        flex: 0 0 48px;
        display: grid;
        place-items: center;
        border-radius: 15px;
        background: var(--ez-blue-light);
        font-size: 21px;
      }

      .ez-live-stat-icon-live {
        background: #fff0f0;
      }

      .ez-live-panel {
        background: #ffffff;
        border: 1px solid var(--ez-border);
        border-radius: 22px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow:
          0 10px 35px
          rgba(39, 150, 199, .05);
      }

      .ez-live-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        margin-bottom: 18px;
      }

      .ez-live-section-label {
        display: block;
        font-size: 10px;
        font-weight: 900;
        color: var(--ez-blue-dark);
        letter-spacing: .13em;
        margin-bottom: 4px;
      }

      .ez-live-panel-header h2 {
        margin: 0;
        font-size: 21px;
      }

      .ez-live-last-update {
        color: var(--ez-muted);
        font-size: 12px;
      }

      .ez-live-filters {
        display: grid;
        grid-template-columns:
          minmax(220px, 1fr)
          180px
          180px
          180px;
        gap: 10px;
        margin-bottom: 20px;
      }

      .ez-live-search {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--ez-border);
        border-radius: 13px;
        padding: 0 12px;
        background: #ffffff;
      }

      .ez-live-search span {
        color: var(--ez-blue-dark);
        font-size: 22px;
      }

      .ez-live-search input,
      .ez-live-filters select,
      .ez-live-form-grid input,
      .ez-live-form-grid select,
      .ez-live-form-grid textarea {
        width: 100%;
        border: 1px solid var(--ez-border);
        background: #ffffff;
        color: var(--ez-text);
        border-radius: 12px;
        min-height: 44px;
        padding: 9px 12px;
        font-family: inherit;
        font-size: 14px;
        outline: none;
      }

      .ez-live-search input {
        border: 0;
        padding-left: 0;
        padding-right: 0;
      }

      .ez-live-search input:focus,
      .ez-live-filters select:focus,
      .ez-live-form-grid input:focus,
      .ez-live-form-grid select:focus,
      .ez-live-form-grid textarea:focus {
        border-color: #8bd7f4;
        box-shadow:
          0 0 0 3px
          rgba(41, 182, 246, .08);
      }

      .ez-live-channels {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .ez-live-channel-card {
        overflow: hidden;
        border: 1px solid var(--ez-border);
        border-radius: 19px;
        background: #ffffff;
        transition:
          transform .2s ease,
          box-shadow .2s ease;
      }

      .ez-live-channel-card:hover {
        transform: translateY(-2px);
        box-shadow:
          0 16px 40px
          rgba(39, 150, 199, .09);
      }

      .ez-live-channel-media {
        position: relative;
        height: 210px;
        overflow: hidden;
        background: #eefaff;
      }

      .ez-live-channel-media img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }

      .ez-live-channel-placeholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 7px;
        background:
          linear-gradient(
            135deg,
            #eaf8ff,
            #ffffff
          );
        color: var(--ez-blue-dark);
      }

      .ez-live-channel-placeholder span {
        font-size: 48px;
      }

      .ez-live-channel-placeholder small {
        font-weight: 900;
        letter-spacing: .12em;
      }

      .ez-live-channel-overlay {
        position: absolute;
        inset: 12px 12px auto;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }

      .ez-live-status,
      .ez-live-featured-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        backdrop-filter: blur(12px);
      }

      .ez-live-status-live {
        color: #a41414;
        background: #fff0f0;
        border: 1px solid #ffc4c4;
      }

      .ez-live-status-testing {
        color: #8a6100;
        background: #fff9e8;
        border: 1px solid #f3dda0;
      }

      .ez-live-status-offline {
        color: #476a80;
        background: #f2f8fb;
        border: 1px solid #d5e8f1;
      }

      .ez-live-status-disabled {
        color: #8c4a75;
        background: #fff0f8;
        border: 1px solid #f1c5dd;
      }

      .ez-live-featured-badge {
        color: #075985;
        background: rgba(235, 249, 255, .94);
        border: 1px solid #b7def7;
      }

      .ez-live-channel-body {
        padding: 16px;
      }

      .ez-live-channel-title-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .ez-live-channel-title-row h3 {
        margin: 0 0 5px;
        font-size: 18px;
      }

      .ez-live-channel-title-row p {
        margin: 0;
        color: var(--ez-muted);
        font-size: 13px;
        line-height: 1.7;
      }

      .ez-live-icon-button {
        width: 40px;
        height: 40px;
        flex: 0 0 40px;
        border-radius: 12px;
        border: 1px solid #cdeefa;
        background: #f0fbff;
        color: var(--ez-blue-dark);
        cursor: pointer;
        font-size: 16px;
        font-weight: 900;
      }

      .ez-live-channel-meta {
        display: grid;
        gap: 7px;
        margin-top: 15px;
        padding-top: 14px;
        border-top: 1px solid #edf5f8;
      }

      .ez-live-channel-meta span {
        color: var(--ez-muted);
        font-size: 12px;
        word-break: break-word;
      }

      .ez-live-channel-meta b {
        color: var(--ez-text);
      }

      .ez-live-url {
        margin-top: 13px;
        padding: 10px;
        border-radius: 11px;
        background: #f7fcff;
        border: 1px solid #e2f2f8;
      }

      .ez-live-url span {
        display: block;
        font-size: 11px;
        font-weight: 900;
        color: var(--ez-blue-dark);
        margin-bottom: 5px;
      }

      .ez-live-url code {
        display: block;
        direction: ltr;
        text-align: left;
        color: #42687f;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ez-live-channel-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 15px;
      }

      .ez-live-channel-actions .ez-live-button {
        min-height: 37px;
        padding: 7px 11px;
        font-size: 12px;
      }

      .ez-live-featured {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 12px;
      }

      .ez-live-featured-card {
        padding: 0;
        text-align: right;
        overflow: hidden;
        border: 1px solid var(--ez-border);
        border-radius: 17px;
        background: #ffffff;
        cursor: pointer;
        color: var(--ez-text);
        font-family: inherit;
      }

      .ez-live-featured-image {
        height: 130px;
        position: relative;
        background: #eefaff;
      }

      .ez-live-featured-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .ez-live-no-image {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-size: 36px;
      }

      .ez-live-featured-image .ez-live-status {
        position: absolute;
        top: 8px;
        right: 8px;
      }

      .ez-live-featured-content {
        padding: 12px;
      }

      .ez-live-featured-content strong {
        display: block;
        margin-bottom: 4px;
      }

      .ez-live-featured-content span {
        color: var(--ez-muted);
        font-size: 11px;
      }

      .ez-live-empty {
        grid-column: 1 / -1;
        min-height: 180px;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 7px;
        border: 1px dashed #cdeefa;
        border-radius: 17px;
        background: #fafdff;
        color: var(--ez-muted);
        text-align: center;
        padding: 25px;
      }

      .ez-live-empty strong {
        color: var(--ez-text);
      }

      .ez-live-empty-icon {
        font-size: 35px;
      }

      #ez-live-modal,
      #ez-live-preview {
        position: fixed;
        inset: 0;
        z-index: 100000;
        direction: rtl;
        font-family:
          Tajawal,
          Arial,
          Helvetica,
          sans-serif;
      }

      .ez-live-modal-backdrop,
      .ez-live-preview-backdrop {
        position: absolute;
        inset: 0;
        background:
          rgba(220, 247, 255, .72);
        backdrop-filter: blur(8px);
      }

      .ez-live-modal,
      .ez-live-preview-modal {
        position: relative;
        width: min(900px, calc(100% - 30px));
        max-height: calc(100vh - 30px);
        overflow: auto;
        margin: 15px auto;
        background: #ffffff;
        border: 1px solid #cdeefa;
        border-radius: 24px;
        box-shadow:
          0 25px 80px
          rgba(15, 86, 120, .18);
      }

      .ez-live-modal-header,
      .ez-live-preview-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 15px;
        padding: 20px;
        border-bottom: 1px solid #e8f4f8;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #f2fbff
          );
      }

      .ez-live-modal-header span,
      .ez-live-preview-header span {
        color: var(--ez-blue-dark);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .12em;
      }

      .ez-live-modal-header h2,
      .ez-live-preview-header h2 {
        margin: 5px 0 0;
        font-size: 21px;
      }

      .ez-live-modal-close {
        width: 40px;
        height: 40px;
        border: 1px solid #dceff8;
        border-radius: 12px;
        background: #ffffff;
        color: var(--ez-text);
        cursor: pointer;
        font-size: 25px;
        line-height: 1;
      }

      .ez-live-form-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 15px;
        padding: 20px;
      }

      .ez-live-form-grid label {
        display: block;
      }

      .ez-live-form-grid label > span {
        display: block;
        color: var(--ez-text);
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 7px;
      }

      .ez-live-form-grid textarea {
        resize: vertical;
        min-height: 110px;
      }

      .ez-live-form-full {
        grid-column: 1 / -1;
      }

      .ez-live-checkbox {
        grid-column: 1 / -1;
        display: flex !important;
        align-items: center;
        gap: 9px;
        padding: 12px;
        border: 1px solid var(--ez-border);
        border-radius: 13px;
        background: #fafdff;
      }

      .ez-live-checkbox input {
        width: 18px;
        height: 18px;
        min-height: 18px;
        accent-color: #20a9e5;
      }

      .ez-live-checkbox span {
        margin: 0 !important;
      }

      .ez-live-form-message {
        margin: 0 20px;
        min-height: 20px;
        font-size: 13px;
        font-weight: 800;
      }

      .ez-live-form-message-error {
        color: #b42318;
      }

      .ez-live-modal-actions,
      .ez-live-preview-actions {
        display: flex;
        justify-content: flex-start;
        gap: 10px;
        padding: 18px 20px 20px;
        border-top: 1px solid #e8f4f8;
      }

      .ez-live-player-container {
        padding: 18px;
        background: #edfaff;
      }

      .ez-live-player {
        width: 100%;
        min-height: 440px;
        overflow: hidden;
        border-radius: 17px;
        background: #061522;
      }

      .ez-live-player video,
      .ez-live-player iframe {
        display: block;
        width: 100%;
        height: 440px;
        border: 0;
        background: #061522;
      }

      .ez-live-player-empty,
      .ez-live-external-player {
        min-height: 440px;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 10px;
        text-align: center;
        padding: 30px;
        background:
          linear-gradient(
            135deg,
            #eaf8ff,
            #ffffff
          );
      }

      .ez-live-player-empty > div,
      .ez-live-external-icon {
        font-size: 48px;
      }

      .ez-live-player-empty strong,
      .ez-live-external-player strong {
        color: var(--ez-text);
        font-size: 18px;
      }

      .ez-live-player-empty span,
      .ez-live-external-player span {
        max-width: 500px;
        color: var(--ez-muted);
        font-size: 13px;
        line-height: 1.8;
      }

      .ez-live-preview-info {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 10px;
        padding: 18px;
      }

      .ez-live-preview-info > div {
        min-width: 0;
        padding: 13px;
        border: 1px solid var(--ez-border);
        border-radius: 13px;
        background: #fbfeff;
      }

      .ez-live-preview-info span {
        display: block;
        color: var(--ez-muted);
        font-size: 11px;
        margin-bottom: 6px;
      }

      .ez-live-preview-info strong {
        display: block;
        color: var(--ez-text);
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .ez-live-preview-info code {
        direction: ltr;
        display: block;
        font-size: 11px;
        font-weight: 500;
        overflow-wrap: anywhere;
      }

      @media (max-width: 1100px) {
        .ez-live-statistics {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-live-channels {
          grid-template-columns: 1fr;
        }

        .ez-live-featured {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ez-live-filters {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 700px) {
        .ez-live-header {
          flex-direction: column;
          align-items: stretch;
        }

        .ez-live-heading {
          align-items: flex-start;
        }

        .ez-live-header-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .ez-live-statistics {
          grid-template-columns: 1fr;
        }

        .ez-live-filters {
          grid-template-columns: 1fr;
        }

        .ez-live-featured {
          grid-template-columns: 1fr;
        }

        .ez-live-form-grid {
          grid-template-columns: 1fr;
        }

        .ez-live-form-full,
        .ez-live-checkbox {
          grid-column: auto;
        }

        .ez-live-preview-info {
          grid-template-columns: 1fr;
        }

        .ez-live-player,
        .ez-live-player video,
        .ez-live-player iframe,
        .ez-live-player-empty,
        .ez-live-external-player {
          min-height: 260px;
          height: 260px;
        }

        .ez-live-channel-media {
          height: 190px;
        }

        .ez-live-panel {
          padding: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initialize() {
    createInterface();

    if (
      !document.getElementById("ez-live-admin")
    ) {
      return;
    }

    refreshAll(true);

    updateLastRefreshTime();

    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(() => {
      refreshAll(false);
      updateLastRefreshTime();
    }, REFRESH_INTERVAL);
  }

  function stop() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }

    closeModal();
    closePreview();
  }

  /*
   * ============================================================
   * دعم تحميل الملف قبل ظهور قسم الإدارة
   * ============================================================
   */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

  /*
   * ============================================================
   * API عامة اختيارية
   * ============================================================
   */

  window.EZMediaAdminLive = {
    refresh: () => refreshAll(true),
    create: openCreateModal,
    preview: openPreview,
    closePreview,
    stop
  };
})();
