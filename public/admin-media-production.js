"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    media: "/api/media",
    content: "/api/content",
    live: "/api/live"
  };

  const MEDIA_TYPES = {
    image: "صورة",
    video: "فيديو",
    audio: "صوت",
    document: "مستند",
    thumbnail: "صورة مصغرة",
    graphic: "تصميم",
    other: "أخرى"
  };

  const PRODUCTION_STATUS = {
    draft: "مسودة",
    ingest: "استقبال",
    editing: "مونتاج",
    review: "مراجعة",
    approved: "معتمد",
    ready: "جاهز",
    published: "منشور",
    archived: "مؤرشف"
  };

  const state = {
    media: [],
    content: [],
    channels: [],
    selectedMedia: null,
    selectedContent: null,
    search: "",
    type: "all",
    status: "all",
    sort: "latest",
    loading: false,
    uploading: false,
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
      ...(options.headers || {})
    };

    if (
      !(options.body instanceof FormData)
    ) {
      headers["Content-Type"] =
        "application/json";
    }

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

  function normalizeMedia(item) {
    return {
      ...item,

      id:
        item.id ||
        item.media_id ||
        item.mediaId,

      name:
        item.name ||
        item.filename ||
        item.original_name ||
        item.originalName ||
        "ملف بدون اسم",

      type:
        item.type ||
        item.media_type ||
        item.mediaType ||
        "other",

      mimeType:
        item.mime_type ||
        item.mimeType ||
        "",

      url:
        item.public_url ||
        item.publicUrl ||
        item.url ||
        "",

      size:
        Number(
          item.size ||
          item.file_size ||
          item.fileSize ||
          0
        ),

      status:
        item.status ||
        item.production_status ||
        "draft",

      duration:
        item.duration ||
        null,

      width:
        item.width ||
        null,

      height:
        item.height ||
        null,

      contentId:
        item.content_id ||
        item.contentId ||
        null,

      createdAt:
        item.created_at ||
        item.createdAt ||
        null,

      updatedAt:
        item.updated_at ||
        item.updatedAt ||
        null
    };
  }

  function normalizeContent(item) {
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

      type:
        item.type ||
        item.content_type ||
        "news",

      status:
        item.status ||
        "draft"
    };
  }

  function normalizeChannel(item) {
    return {
      ...item,

      id:
        item.id ||
        item.channel_id,

      name:
        item.name ||
        item.title ||
        item.channel_name ||
        "قناة بدون اسم",

      slug:
        item.slug ||
        "",

      status:
        item.status ||
        "offline",

      sourceType:
        item.source_type ||
        item.sourceType ||
        "external",

      streamUrl:
        item.stream_url ||
        item.streamUrl ||
        item.url ||
        ""
    };
  }

  async function loadData() {
    state.loading = true;
    render();

    try {
      const [
        mediaResult,
        contentResult,
        liveResult
      ] = await Promise.allSettled([
        request(
          `${API.media}?limit=200`
        ),
        request(
          `${API.content}?limit=100`
        ),
        request(
          `${API.live}?limit=50`
        )
      ]);

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
        "EZ MEDIA production:",
        error
      );

      showToast(
        "تعذر تحميل بيانات الإنتاج."
      );
    } finally {
      state.loading = false;
      render();
    }
  }

  function getFilteredMedia() {
    let items =
      [...state.media];

    if (state.search) {
      const query =
        state.search
          .trim()
          .toLowerCase();

      items =
        items.filter(
          item => {

            const text =
              [
                item.name,
                item.mimeType,
                item.type,
                item.status,
                item.contentId
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return text.includes(
              query
            );
          }
        );
    }

    if (
      state.type !==
      "all"
    ) {
      items =
        items.filter(
          item =>
            item.type ===
            state.type
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

    items.sort(
      (a, b) => {

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

        if (
          state.sort ===
          "oldest"
        ) {
          return (
            aDate - bDate
          );
        }

        return (
          bDate - aDate
        );
      }
    );

    return items;
  }

  function productionMetrics() {
    const media =
      state.media;

    return {
      total:
        media.length,

      video:
        media.filter(
          item =>
            item.type ===
            "video"
        ).length,

      image:
        media.filter(
          item =>
            item.type ===
            "image"
        ).length,

      audio:
        media.filter(
          item =>
            item.type ===
            "audio"
        ).length,

      ready:
        media.filter(
          item =>
            item.status ===
              "ready" ||
            item.status ===
              "approved"
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

    const metrics =
      productionMetrics();

    const items =
      getFilteredMedia();

    mount.innerHTML = `
      <div
        class="ez-production"
      >

        <header
          class="ez-production-head"
        >

          <div>
            <span
              class="ez-production-kicker"
            >
              EZ MEDIA PRODUCTION CONTROL
            </span>

            <h2>
              مركز الإنتاج المرئي
            </h2>

            <p>
              إدارة مكتبة الإنتاج والمواد المرئية وربطها بالمحتوى والبث المباشر من مركز واحد.
            </p>
          </div>

          <div
            class="ez-production-actions"
          >

            <button
              class="ez-production-btn primary"
              data-production-upload
            >
              رفع وسائط
            </button>

            <button
              class="ez-production-btn"
              data-production-refresh
            >
              تحديث
            </button>

            <input
              id="ez-production-file"
              type="file"
              hidden
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />

          </div>

        </header>

        <section
          class="ez-production-metrics"
        >

          ${metric(
            "إجمالي الوسائط",
            metrics.total
          )}

          ${metric(
            "فيديو",
            metrics.video
          )}

          ${metric(
            "صور",
            metrics.image
          )}

          ${metric(
            "صوت",
            metrics.audio
          )}

          ${metric(
            "جاهز للإنتاج",
            metrics.ready
          )}

          ${metric(
            "بث مباشر",
            metrics.live
          )}

        </section>

        <section
          class="ez-production-panel"
        >

          <div
            class="ez-production-toolbar"
          >

            <input
              id="ez-production-search"
              type="search"
              placeholder="ابحث في مكتبة الإنتاج..."
              value="${escapeHtml(
                state.search
              )}"
            />

            <select
              id="ez-production-type"
            >

              <option
                value="all"
              >
                كل الأنواع
              </option>

              ${Object.entries(
                MEDIA_TYPES
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
              id="ez-production-status"
            >

              <option
                value="all"
              >
                كل الحالات
              </option>

              ${Object.entries(
                PRODUCTION_STATUS
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
              id="ez-production-sort"
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

            </select>

          </div>

          ${
            state.uploading
              ? `
                <div
                  class="ez-production-progress"
                >
                  جارٍ رفع الوسائط...
                </div>
              `
              : ""
          }

          <div
            class="ez-production-grid"
          >

            ${
              items.length
                ? items
                    .map(
                      renderMediaCard
                    )
                    .join("")
                : `
                  <div
                    class="ez-production-empty"
                  >
                    لا توجد وسائط مطابقة.
                  </div>
                `
            }

          </div>

        </section>

        ${renderLiveStudio()}

        ${
          state.selectedMedia
            ? renderMediaDetails()
            : ""
        }

        <footer
          class="ez-production-footer"
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
        class="ez-production-metric"
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

  function renderMediaCard(
    item
  ) {
    const isVideo =
      item.type ===
        "video" ||
      (
        item.mimeType &&
        item.mimeType.startsWith(
          "video/"
        )
      );

    const isImage =
      item.type ===
        "image" ||
      (
        item.mimeType &&
        item.mimeType.startsWith(
          "image/"
        )
      );

    let preview = `
      <div
        class="ez-production-preview-placeholder"
      >
        ${isVideo ? "▶" : "◈"}
      </div>
    `;

    if (
      item.url &&
      isImage
    ) {
      preview = `
        <div
          class="ez-production-preview"
        >
          <img
            src="${escapeHtml(
              item.url
            )}"
            alt="${escapeHtml(
              item.name
            )}"
            loading="lazy"
          />
        </div>
      `;
    }

    if (
      item.url &&
      isVideo
    ) {
      preview = `
        <div
          class="ez-production-preview"
        >
          <video
            src="${escapeHtml(
              item.url
            )}"
            muted
            preload="metadata"
          ></video>

          <span
            class="ez-production-video-mark"
          >
            ▶
          </span>
        </div>
      `;
    }

    return `
      <article
        class="ez-production-card"
      >

        ${preview}

        <div
          class="ez-production-card-body"
        >

          <div
            class="ez-production-card-top"
          >

            <span
              class="ez-production-type"
            >
              ${
                MEDIA_TYPES[
                  item.type
                ] ||
                item.type
              }
            </span>

            <span
              class="ez-production-status"
            >
              ${
                PRODUCTION_STATUS[
                  item.status
                ] ||
                item.status
              }
            </span>

          </div>

          <h3>
            ${escapeHtml(
              item.name
            )}
          </h3>

          <p>
            ${
              item.mimeType
                ? escapeHtml(
                    item.mimeType
                  )
                : "نوع غير محدد"
            }
          </p>

          <div
            class="ez-production-meta"
          >

            <span>
              الحجم:
              ${formatBytes(
                item.size
              )}
            </span>

            ${
              item.duration
                ? `
                  <span>
                    المدة:
                    ${escapeHtml(
                      formatDuration(
                        item.duration
                      )
                    )}
                  </span>
                `
                : ""
            }

            ${
              item.width &&
              item.height
                ? `
                  <span>
                    ${escapeHtml(
                      item.width
                    )}
                    ×
                    ${escapeHtml(
                      item.height
                    )}
                  </span>
                `
                : ""
            }

          </div>

          <div
            class="ez-production-card-actions"
          >

            <button
              data-production-view="${escapeHtml(
                item.id
              )}"
            >
              التفاصيل
            </button>

            ${
              item.contentId
                ? `
                  <button
                    data-production-content="${escapeHtml(
                      item.contentId
                    )}"
                  >
                    المحتوى المرتبط
                  </button>
                `
                : `
                  <button
                    data-production-attach="${escapeHtml(
                      item.id
                    )}"
                  >
                    ربط بالمحتوى
                  </button>
                `
            }

          </div>

        </div>

      </article>
    `;
  }

  function renderLiveStudio() {
    return `
      <section
        class="ez-production-live"
      >

        <header>
          <div>
            <span>
              LIVE PRODUCTION
            </span>

            <h3>
              استوديو البث
            </h3>

            <p>
              مراقبة قنوات البث المسجلة داخل EZ MEDIA وتجهيزها من لوحة الإنتاج.
            </p>
          </div>
        </header>

        <div
          class="ez-production-live-grid"
        >

          ${
            state.channels.length
              ? state.channels
                  .map(
                    renderChannel
                  )
                  .join("")
              : `
                <div
                  class="ez-production-empty"
                >
                  لا توجد قنوات بث مسجلة.
                </div>
              `
          }

        </div>

      </section>
    `;
  }

  function renderChannel(
    channel
  ) {
    const live =
      channel.status ===
      "live";

    return `
      <article
        class="ez-production-channel"
      >

        <div
          class="ez-production-channel-icon"
        >
          ${
            live
              ? "●"
              : "○"
          }
        </div>

        <div
          class="ez-production-channel-main"
        >

          <strong>
            ${escapeHtml(
              channel.name
            )}
          </strong>

          <span>
            ${
              live
                ? "على الهواء الآن"
                : (
                    channel.status ===
                    "testing"
                      ? "اختبار"
                      : "غير مباشر"
                  )
            }
          </span>

          ${
            channel.sourceType
              ? `
                <small>
                  المصدر:
                  ${escapeHtml(
                    channel.sourceType
                  )}
                </small>
              `
              : ""
          }

        </div>

        <div
          class="ez-production-channel-status ${
            live
              ? "live"
              : ""
          }"
        >
          ${
            live
              ? "LIVE"
              : "OFFLINE"
          }
        </div>

      </article>
    `;
  }

  function renderMediaDetails() {
    const item =
      state.selectedMedia;

    if (!item) {
      return "";
    }

    return `
      <div
        class="ez-production-overlay"
      >

        <section
          class="ez-production-details"
        >

          <header>
            <div>
              <span>
                MEDIA ASSET
              </span>

              <h3>
                ${escapeHtml(
                  item.name
                )}
              </h3>
            </div>

            <button
              data-production-close
            >
              إغلاق
            </button>
          </header>

          ${
            item.url &&
            item.type ===
              "image"
              ? `
                <img
                  class="ez-production-detail-image"
                  src="${escapeHtml(
                    item.url
                  )}"
                  alt="${escapeHtml(
                    item.name
                  )}"
                />
              `
              : ""
          }

          ${
            item.url &&
            item.type ===
              "video"
              ? `
                <video
                  class="ez-production-detail-video"
                  controls
                  src="${escapeHtml(
                    item.url
                  )}"
                ></video>
              `
              : ""
          }

          <div
            class="ez-production-detail-grid"
          >

            ${detail(
              "النوع",
              MEDIA_TYPES[
                item.type
              ] ||
                item.type
            )}

            ${detail(
              "الحالة",
              PRODUCTION_STATUS[
                item.status
              ] ||
                item.status
            )}

            ${detail(
              "الحجم",
              formatBytes(
                item.size
              )
            )}

            ${detail(
              "نوع الملف",
              item.mimeType ||
                "غير محدد"
            )}

            ${detail(
              "المحتوى المرتبط",
              item.contentId ||
                "غير مرتبط"
            )}

            ${detail(
              "آخر تحديث",
              formatDate(
                item.updatedAt ||
                item.createdAt
              )
            )}

          </div>

          ${
            item.url
              ? `
                <div
                  class="ez-production-url"
                >

                  <span>
                    رابط الوسائط
                  </span>

                  <input
                    readonly
                    value="${escapeHtml(
                      item.url
                    )}"
                  />

                  <button
                    data-production-copy="${escapeHtml(
                      item.url
                    )}"
                  >
                    نسخ الرابط
                  </button>

                </div>
              `
              : ""
          }

        </section>

      </div>
    `;
  }

  function detail(
    label,
    value
  ) {
    return `
      <div
        class="ez-production-detail"
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

  async function uploadFiles(
    files
  ) {
    if (!files?.length) {
      return;
    }

    state.uploading =
      true;

    render();

    let success = 0;
    let failed = 0;

    try {
      for (
        const file of files
      ) {
        try {
          const form =
            new FormData();

          form.append(
            "file",
            file
          );

          form.append(
            "originalName",
            file.name
          );

          form.append(
            "mimeType",
            file.type
          );

          form.append(
            "size",
            String(
              file.size
            )
          );

          await request(
            "/api/upload",
            {
              method: "POST",
              body: form
            }
          );

          success++;
        } catch (error) {
          console.error(
            "Upload failed:",
            error
          );

          failed++;
        }
      }

      showToast(
        `تم رفع ${success} ملف` +
        (
          failed
            ? `، وفشل ${failed}`
            : ""
        )
      );

      await loadData();

    } finally {
      state.uploading =
        false;

      render();
    }
  }

  function openMedia(
    id
  ) {
    const item =
      state.media.find(
        media =>
          String(
            media.id
          ) ===
          String(id)
      );

    if (!item) {
      return;
    }

    state.selectedMedia =
      item;

    render();
  }

  function closeMedia() {
    state.selectedMedia =
      null;

    render();
  }

  function showContent(
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
        "تعذر العثور على المحتوى."
      );

      return;
    }

    state.selectedContent =
      item;

    showToast(
      `المحتوى: ${item.title}`
    );
  }

  async function attachMedia(
    mediaId
  ) {
    if (
      !state.content.length
    ) {
      showToast(
        "لا يوجد محتوى متاح للربط."
      );

      return;
    }

    const options =
      state.content
        .slice(0, 30)
        .map(
          item =>
            `${item.id}: ${item.title}`
        )
        .join("\n");

    const selected =
      window.prompt(
        `أدخل ID المحتوى المراد ربط الوسيط به:\n\n${options}`
      );

    if (!selected) {
      return;
    }

    try {
      await request(
        `${API.media}/${encodeURIComponent(
          mediaId
        )}/attach`,
        {
          method: "POST",
          body:
            JSON.stringify({
              contentId:
                selected.trim()
            })
        }
      );

      showToast(
        "تم ربط الوسيط بالمحتوى."
      );

      await loadData();

    } catch (error) {
      console.error(
        error
      );

      showToast(
        `تعذر الربط: ${error.message}`
      );
    }
  }

  function copyText(
    value
  ) {
    if (
      navigator.clipboard
    ) {
      navigator.clipboard
        .writeText(value)
        .then(
          () =>
            showToast(
              "تم نسخ الرابط."
            )
        )
        .catch(
          () =>
            showToast(
              "تعذر النسخ."
            )
        );

      return;
    }

    showToast(
      "النسخ غير مدعوم في هذا المتصفح."
    );
  }

  function formatBytes(
    bytes
  ) {
    const size =
      Number(bytes) || 0;

    if (!size) {
      return "—";
    }

    const units =
      [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
      ];

    let value =
      size;

    let index =
      0;

    while (
      value >= 1024 &&
      index <
        units.length - 1
    ) {
      value /=
        1024;

      index++;
    }

    return (
      value.toFixed(
        index === 0
          ? 0
          : 1
      ) +
      " " +
      units[index]
    );
  }

  function formatDuration(
    seconds
  ) {
    const value =
      Number(seconds);

    if (
      !Number.isFinite(
        value
      )
    ) {
      return "—";
    }

    const hours =
      Math.floor(
        value / 3600
      );

    const minutes =
      Math.floor(
        (value % 3600) /
          60
      );

    const secs =
      Math.floor(
        value % 60
      );

    return [
      hours
        ? String(
            hours
          ).padStart(
            2,
            "0"
          )
        : null,
      String(
        minutes
      ).padStart(
        2,
        "0"
      ),
      String(
        secs
      ).padStart(
        2,
        "0"
      )
    ]
      .filter(Boolean)
      .join(":");
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
          dateStyle:
            "medium",
          timeStyle:
            "short"
        }
      ).format(
        new Date(value)
      );
    } catch {
      return String(value);
    }
  }

  function showToast(
    message
  ) {
    let toast =
      document.querySelector(
        "#ez-production-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-production-toast";

      toast.style.cssText = `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:100001;
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
        () =>
          toast.remove(),
        5000
      );
  }

  function bindEvents() {
    document
      .querySelector(
        "[data-production-upload]"
      )
      ?.addEventListener(
        "click",
        () =>
          document
            .querySelector(
              "#ez-production-file"
            )
            ?.click()
      );

    document
      .querySelector(
        "#ez-production-file"
      )
      ?.addEventListener(
        "change",
        event =>
          uploadFiles(
            Array.from(
              event.target.files ||
                []
            )
          )
      );

    document
      .querySelector(
        "[data-production-refresh]"
      )
      ?.addEventListener(
        "click",
        loadData
      );

    document
      .querySelector(
        "#ez-production-search"
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
        "#ez-production-type"
      )
      ?.addEventListener(
        "change",
        event => {
          state.type =
            event.target.value;

          render();
        }
      );

    document
      .querySelector(
        "#ez-production-status"
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
        "#ez-production-sort"
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
        "[data-production-view]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              openMedia(
                button.dataset
                  .productionView
              )
          )
      );

    document
      .querySelectorAll(
        "[data-production-content]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              showContent(
                button.dataset
                  .productionContent
              )
          )
      );

    document
      .querySelectorAll(
        "[data-production-attach]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              attachMedia(
                button.dataset
                  .productionAttach
              )
          )
      );

    document
      .querySelector(
        "[data-production-close]"
      )
      ?.addEventListener(
        "click",
        closeMedia
      );

    document
      .querySelectorAll(
        "[data-production-copy]"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            () =>
              copyText(
                button.dataset
                  .productionCopy
              )
          )
      );
  }

  function getMount() {
    return (
      document.querySelector(
        "#media-production-section"
      ) ||
      document.querySelector(
        "#admin-media-production-section"
      ) ||
      document.querySelector(
        '[data-admin-section="media-production"]'
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
      "admin-media-production-section";

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
        "ez-admin-media-production-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-media-production-style";

    style.textContent = `
      #media-production-section,
      #admin-media-production-section {
        direction:rtl;
      }

      .ez-production {
        color:#0f172a;
      }

      .ez-production-head {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:15px;
      }

      .ez-production-kicker {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
        letter-spacing:.08em;
      }

      .ez-production-head h2 {
        margin:5px 0;
        color:#075985;
        font-size:27px;
        font-weight:950;
      }

      .ez-production-head p {
        margin:0;
        max-width:800px;
        color:#64748b;
        font-size:11px;
        line-height:1.8;
      }

      .ez-production-actions {
        display:flex;
        gap:7px;
      }

      .ez-production-btn {
        border:1px solid #bae6fd;
        border-radius:11px;
        background:#fff;
        color:#0369a1;
        padding:9px 13px;
        cursor:pointer;
        font-size:9px;
        font-weight:900;
      }

      .ez-production-btn.primary {
        border-color:transparent;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
        color:#fff;
      }

      .ez-production-metrics {
        display:grid;
        grid-template-columns:
          repeat(6,minmax(0,1fr));
        gap:9px;
        margin-bottom:10px;
      }

      .ez-production-metric {
        border:1px solid #e0f2fe;
        border-radius:15px;
        background:#fff;
        padding:13px;
      }

      .ez-production-metric span {
        display:block;
        color:#64748b;
        font-size:8px;
        font-weight:850;
      }

      .ez-production-metric strong {
        display:block;
        margin-top:4px;
        color:#075985;
        font-size:22px;
        font-weight:950;
      }

      .ez-production-panel,
      .ez-production-live {
        border:1px solid #e0f2fe;
        border-radius:17px;
        background:#fff;
        padding:13px;
        margin-bottom:10px;
      }

      .ez-production-toolbar {
        display:flex;
        gap:7px;
        flex-wrap:wrap;
        margin-bottom:11px;
      }

      .ez-production-toolbar input,
      .ez-production-toolbar select {
        border:1px solid #bae6fd;
        border-radius:10px;
        background:#fff;
        color:#334155;
        outline:none;
        padding:9px;
        font-size:9px;
      }

      .ez-production-toolbar input {
        flex:1;
        min-width:220px;
      }

      .ez-production-grid {
        display:grid;
        grid-template-columns:
          repeat(4,minmax(0,1fr));
        gap:9px;
      }

      .ez-production-card {
        overflow:hidden;
        border:1px solid #e0f2fe;
        border-radius:14px;
        background:
          linear-gradient(
            135deg,
            #fff,
            #f8fdff
          );
      }

      .ez-production-preview {
        position:relative;
        height:150px;
        overflow:hidden;
        background:#eff6ff;
      }

      .ez-production-preview img,
      .ez-production-preview video {
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      .ez-production-preview-placeholder {
        display:grid;
        place-items:center;
        height:150px;
        background:
          linear-gradient(
            135deg,
            #eff6ff,
            #e0f2fe
          );
        color:#0284c7;
        font-size:32px;
        font-weight:950;
      }

      .ez-production-video-mark {
        position:absolute;
        left:10px;
        bottom:10px;
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:rgba(2,132,199,.9);
        color:#fff;
        font-size:11px;
      }

      .ez-production-card-body {
        padding:10px;
      }

      .ez-production-card-top {
        display:flex;
        justify-content:space-between;
        gap:5px;
      }

      .ez-production-type,
      .ez-production-status {
        border-radius:999px;
        padding:4px 6px;
        font-size:6px;
        font-weight:950;
      }

      .ez-production-type {
        background:#eff6ff;
        color:#0369a1;
      }

      .ez-production-status {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-production-card h3 {
        margin:8px 0 4px;
        color:#075985;
        font-size:10px;
        line-height:1.5;
        word-break:break-word;
      }

      .ez-production-card p {
        margin:0;
        color:#94a3b8;
        font-size:7px;
        direction:ltr;
        text-align:right;
      }

      .ez-production-meta {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        margin-top:8px;
        color:#64748b;
        font-size:7px;
      }

      .ez-production-card-actions {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        margin-top:9px;
      }

      .ez-production-card-actions button {
        border:1px solid #e0f2fe;
        border-radius:8px;
        background:#fff;
        color:#0369a1;
        padding:6px 7px;
        cursor:pointer;
        font-size:7px;
        font-weight:900;
      }

      .ez-production-progress {
        margin-bottom:9px;
        border-radius:10px;
        background:#eff6ff;
        color:#0369a1;
        padding:9px;
        font-size:8px;
        font-weight:900;
      }

      .ez-production-live header span {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-production-live header h3 {
        margin:4px 0;
        color:#075985;
        font-size:16px;
      }

      .ez-production-live header p {
        margin:0 0 10px;
        color:#64748b;
        font-size:8px;
      }

      .ez-production-live-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:8px;
      }

      .ez-production-channel {
        display:flex;
        align-items:center;
        gap:8px;
        border:1px solid #e0f2fe;
        border-radius:12px;
        padding:10px;
      }

      .ez-production-channel-icon {
        color:#94a3b8;
        font-size:15px;
      }

      .ez-production-channel-main {
        flex:1;
        min-width:0;
      }

      .ez-production-channel-main strong {
        display:block;
        color:#075985;
        font-size:9px;
      }

      .ez-production-channel-main span {
        display:block;
        margin-top:3px;
        color:#64748b;
        font-size:7px;
      }

      .ez-production-channel-main small {
        display:block;
        margin-top:3px;
        color:#94a3b8;
        font-size:6px;
      }

      .ez-production-channel-status {
        border-radius:999px;
        background:#f8fafc;
        color:#94a3b8;
        padding:5px 7px;
        font-size:6px;
        font-weight:950;
      }

      .ez-production-channel-status.live {
        background:#ecfdf5;
        color:#047857;
      }

      .ez-production-empty {
        grid-column:1/-1;
        padding:40px;
        color:#94a3b8;
        text-align:center;
        font-size:9px;
      }

      .ez-production-overlay {
        position:fixed;
        inset:0;
        z-index:90000;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(240,249,255,.82);
        backdrop-filter:blur(8px);
      }

      .ez-production-details {
        width:min(850px,100%);
        max-height:90vh;
        overflow:auto;
        border:1px solid #bae6fd;
        border-radius:20px;
        background:#fff;
        padding:16px;
        box-shadow:0 25px 80px rgba(7,89,133,.16);
      }

      .ez-production-details header {
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
        margin-bottom:12px;
      }

      .ez-production-details header span {
        color:#0284c7;
        font-size:8px;
        font-weight:950;
      }

      .ez-production-details header h3 {
        margin:4px 0 0;
        color:#075985;
        font-size:17px;
        word-break:break-word;
      }

      .ez-production-details header button {
        border:1px solid #e0f2fe;
        border-radius:9px;
        background:#fff;
        color:#64748b;
        padding:7px 10px;
        cursor:pointer;
        font-size:8px;
      }

      .ez-production-detail-image,
      .ez-production-detail-video {
        display:block;
        width:100%;
        max-height:430px;
        object-fit:contain;
        border-radius:12px;
        background:#eff6ff;
        margin-bottom:12px;
      }

      .ez-production-detail-grid {
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .ez-production-detail {
        border-radius:10px;
        background:#f8fafc;
        padding:9px;
      }

      .ez-production-detail span {
        display:block;
        color:#94a3b8;
        font-size:7px;
      }

      .ez-production-detail strong {
        display:block;
        margin-top:3px;
        color:#075985;
        font-size:8px;
        word-break:break-word;
      }

      .ez-production-url {
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:center;
        gap:7px;
        margin-top:10px;
      }

      .ez-production-url span {
        color:#64748b;
        font-size:7px;
        font-weight:900;
      }

      .ez-production-url input {
        width:100%;
        box-sizing:border-box;
        border:1px solid #bae6fd;
        border-radius:9px;
        padding:8px;
        direction:ltr;
        font-size:7px;
      }

      .ez-production-url button {
        border:0;
        border-radius:8px;
        background:#0284c7;
        color:#fff;
        padding:7px 9px;
        cursor:pointer;
        font-size:7px;
        font-weight:900;
      }

      .ez-production-footer {
        margin-top:8px;
        color:#94a3b8;
        text-align:center;
        font-size:7px;
      }

      @media (max-width:1050px) {
        .ez-production-grid {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }

        .ez-production-metrics {
          grid-template-columns:
            repeat(3,minmax(0,1fr));
        }
      }

      @media (max-width:700px) {
        .ez-production-grid,
        .ez-production-live-grid,
        .ez-production-metrics,
        .ez-production-detail-grid {
          grid-template-columns:1fr;
        }

        .ez-production-toolbar {
          flex-direction:column;
        }

        .ez-production-url {
          grid-template-columns:1fr;
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
        "#media-production-section"
      ) ||
      document.querySelector(
        "#admin-media-production-section"
      ) ||
      document.querySelector(
        '[data-admin-section="media-production"]'
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
      "admin-media-production-section";

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

  window.EZMediaAdminMediaProduction =
    {
      initialize,
      refresh:
        loadData,
      getState() {
        return {
          ...state,
          media: [
            ...state.media
          ],
          content: [
            ...state.content
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
