"use strict";

/*
 * ============================================================
 * EZ MEDIA 11.0
 * HOME ENGINE
 * public/home.js
 *
 * محرك الواجهة الرئيسية
 * ============================================================
 */

(() => {
  const EZ_HOME = {
    version: "11.0.0",

    config: {
      refreshInterval: 30000,

      endpoints: {
        content: "/api/content",
        breaking: "/api/breaking",
        media: "/api/media",
        live: "/api/live",
        liveStatistics: "/api/live/statistics",
        system: "/api/system",
        health: "/health"
      }
    },

    state: {
      initialized: false,

      loading: false,

      content: [],
      news: [],
      reports: [],
      interviews: [],
      videos: [],
      breaking: [],
      media: [],
      live: [],

      liveStatistics: null,
      system: null,
      health: null,

      searchQuery: "",

      selectedLive: null,

      lastUpdate: null,

      errors: {}
    }
  };


  /* ============================================================
     أدوات عامة
  ============================================================ */

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }


  function qsa(selector, root = document) {
    return Array.from(
      root.querySelectorAll(selector)
    );
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function safeText(value, fallback = "") {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    return String(value);
  }


  function getContentId(item) {
    return (
      item?.id ||
      item?.content_id ||
      item?.contentId ||
      null
    );
  }


  function getContentType(item) {
    return String(
      item?.content_type ||
      item?.contentType ||
      item?.type ||
      ""
    ).toLowerCase();
  }


  function getTitle(item) {
    return (
      item?.headline ||
      item?.title ||
      item?.name ||
      "بدون عنوان"
    );
  }


  function getSummary(item) {
    return (
      item?.summary ||
      item?.description ||
      item?.excerpt ||
      ""
    );
  }


  function getImage(item) {
    return (
      item?.thumbnail_url ||
      item?.thumbnailUrl ||
      item?.image_url ||
      item?.imageUrl ||
      item?.cover_url ||
      item?.coverUrl ||
      item?.image ||
      null
    );
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
      return "";
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
      return "";
    }
  }


  function formatRelativeTime(value) {
    if (!value) {
      return "";
    }

    try {
      const date =
        new Date(value);

      const now =
        Date.now();

      const diff =
        Math.max(
          0,
          now - date.getTime()
        );

      const seconds =
        Math.floor(
          diff / 1000
        );

      if (seconds < 60) {
        return "منذ لحظات";
      }

      const minutes =
        Math.floor(
          seconds / 60
        );

      if (minutes < 60) {
        return `منذ ${minutes} دقيقة`;
      }

      const hours =
        Math.floor(
          minutes / 60
        );

      if (hours < 24) {
        return `منذ ${hours} ساعة`;
      }

      const days =
        Math.floor(
          hours / 24
        );

      if (days < 7) {
        return `منذ ${days} يوم`;
      }

      return formatDate(value);

    } catch {
      return "";
    }
  }


  function extractItems(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (!data || typeof data !== "object") {
      return [];
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data.content)) {
      return data.content;
    }

    if (Array.isArray(data.news)) {
      return data.news;
    }

    if (Array.isArray(data.results)) {
      return data.results;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    return [];
  }


  /* ============================================================
     API
     ============================================================ */

  async function apiRequest(
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


  async function safeApiRequest(
    url,
    key,
    fallback = null
  ) {

    try {

      const result =
        await apiRequest(
          url
        );

      delete EZ_HOME.state.errors[key];

      return result;

    } catch (error) {

      EZ_HOME.state.errors[key] =
        error;

      console.warn(
        `EZ MEDIA API error [${key}]`,
        error
      );

      return fallback;
    }
  }


  /* ============================================================
     المحتوى
     ============================================================ */

  function classifyContent(
    items
  ) {

    const news = [];
    const reports = [];
    const interviews = [];
    const videos = [];
    const breaking = [];

    items.forEach(
      (item) => {

        const type =
          getContentType(
            item
          );

        const title =
          getTitle(
            item
          );

        const normalized =
          `${type} ${title}`
            .toLowerCase();

        const isBreaking =
          type === "breaking" ||
          item?.is_breaking === true ||
          item?.isBreaking === true;

        if (isBreaking) {
          breaking.push(item);
        }

        if (
          type === "report" ||
          type === "analysis" ||
          normalized.includes("تقرير") ||
          normalized.includes("تحليل")
        ) {
          reports.push(item);
        }

        if (
          type === "interview" ||
          normalized.includes("مقابلة") ||
          normalized.includes("حوار")
        ) {
          interviews.push(item);
        }

        if (
          type === "video" ||
          type === "clip" ||
          item?.media_type === "video" ||
          item?.mediaType === "video"
        ) {
          videos.push(item);
        }

        if (
          !isBreaking &&
          type !== "report" &&
          type !== "analysis" &&
          type !== "interview" &&
          type !== "video" &&
          type !== "clip"
        ) {
          news.push(item);
        }

      }
    );

    return {
      news,
      reports,
      interviews,
      videos,
      breaking
    };
  }


  async function loadContent() {

    const data =
      await safeApiRequest(
        `${
          EZ_HOME.config.endpoints.content
        }?status=published&limit=100`,
        "content",
        {
          items: []
        }
      );

    const items =
      extractItems(
        data
      );

    EZ_HOME.state.content =
      items;

    const classified =
      classifyContent(
        items
      );

    EZ_HOME.state.news =
      classified.news;

    EZ_HOME.state.reports =
      classified.reports;

    EZ_HOME.state.interviews =
      classified.interviews;

    EZ_HOME.state.videos =
      classified.videos;

    EZ_HOME.state.breaking =
      classified.breaking;

    renderNews();

    renderReports();

    renderVideos();

    renderBreaking();

    return items;
  }


  /* ============================================================
     الأخبار
     ============================================================ */

  function createNewsCard(
    item
  ) {

    const title =
      getTitle(
        item
      );

    const summary =
      getSummary(
        item
      );

    const image =
      getImage(
        item
      );

    const date =
      getDate(
        item
      );

    const category =
      item?.category ||
      item?.section ||
      "أخبار";

    const id =
      getContentId(
        item
      );

    return `
      <article
        class="ez-news-card"
        data-content-id="${escapeHtml(id || "")}"
      >

        <a
          href="${
            id
              ? `/content/${encodeURIComponent(id)}`
              : "#"
          }"
          aria-label="${escapeHtml(title)}"
        >

          <div
            class="ez-news-image"
          >

            ${
              image
                ? `
                  <img
                    src="${escapeHtml(image)}"
                    alt="${escapeHtml(title)}"
                    loading="lazy"
                  >
                `
                : `
                  <span
                    aria-hidden="true"
                  >
                    📰
                  </span>
                `
            }

          </div>

          <div
            class="ez-news-body"
          >

            <div
              class="ez-news-category"
            >
              ${escapeHtml(category)}
            </div>

            <h3
              class="ez-news-title"
            >
              ${escapeHtml(title)}
            </h3>

            ${
              summary
                ? `
                  <div
                    class="ez-news-meta"
                  >
                    ${escapeHtml(
                      summary
                        .replace(/\s+/g, " ")
                        .slice(0, 110)
                    )}
                  </div>
                `
                : ""
            }

            ${
              date
                ? `
                  <div
                    class="ez-news-meta"
                  >
                    ${escapeHtml(
                      formatRelativeTime(
                        date
                      )
                    )}
                  </div>
                `
                : ""
            }

          </div>

        </a>

      </article>
    `;
  }


  function renderNews() {

    const grid =
      qs(
        "#ez-news-grid"
      );

    if (!grid) {
      return;
    }

    const items =
      EZ_HOME.state.news
        .slice(0, 12);

    if (!items.length) {

      grid.innerHTML = `
        <div
          class="ez-loading"
        >
          لا توجد أخبار منشورة حاليًا.
        </div>
      `;

      return;
    }

    grid.innerHTML =
      items
        .map(
          createNewsCard
        )
        .join("");
  }


  /* ============================================================
     التقارير
     ============================================================ */

  function renderReports() {

    const grid =
      qs(
        "#ez-reports-grid"
      );

    if (!grid) {
      return;
    }

    const items =
      EZ_HOME.state.reports
        .slice(0, 8);

    if (!items.length) {

      grid.innerHTML = `
        <article
          class="ez-news-card"
        >

          <div
            class="ez-news-image"
          >
            📊
          </div>

          <div
            class="ez-news-body"
          >

            <div
              class="ez-news-category"
            >
              التقارير
            </div>

            <h3
              class="ez-news-title"
            >
              لا توجد تقارير منشورة حاليًا.
            </h3>

          </div>

        </article>
      `;

      return;
    }

    grid.innerHTML =
      items
        .map(
          createNewsCard
        )
        .join("");
  }


  /* ============================================================
     الفيديو
     ============================================================ */

  function renderVideos() {

    const grid =
      qs(
        "#ez-videos-grid"
      );

    if (!grid) {
      return;
    }

    const items =
      EZ_HOME.state.videos
        .slice(0, 8);

    if (!items.length) {

      grid.innerHTML = `
        <article
          class="ez-news-card"
        >

          <div
            class="ez-news-image"
          >
            🎬
          </div>

          <div
            class="ez-news-body"
          >

            <div
              class="ez-news-category"
            >
              فيديو
            </div>

            <h3
              class="ez-news-title"
            >
              لا توجد فيديوهات منشورة حاليًا.
            </h3>

          </div>

        </article>
      `;

      return;
    }

    grid.innerHTML =
      items
        .map(
          createNewsCard
        )
        .join("");
  }


  /* ============================================================
     الأخبار العاجلة
     ============================================================ */

  function renderBreaking() {

    const content =
      qs(
        "#ez-breaking-content"
      );

    const time =
      qs(
        "#ez-breaking-time"
      );

    if (!content) {
      return;
    }

    const items =
      EZ_HOME.state.breaking
        .slice()
        .sort(
          (a, b) => {

            const dateA =
              new Date(
                getDate(a) || 0
              ).getTime();

            const dateB =
              new Date(
                getDate(b) || 0
              ).getTime();

            return dateB - dateA;
          }
        );

    if (!items.length) {

      content.textContent =
        "لا توجد أخبار عاجلة منشورة حاليًا.";

      if (time) {
        time.textContent =
          "--";
      }

      return;
    }

    const item =
      items[0];

    content.textContent =
      getTitle(
        item
      );

    if (time) {

      time.textContent =
        formatRelativeTime(
          getDate(
            item
          )
        );
    }
  }


  /* ============================================================
     البث
     ============================================================ */

  async function loadLive() {

    const data =
      await safeApiRequest(
        `${
          EZ_HOME.config.endpoints.live
        }?limit=100`,
        "live",
        {
          items: []
        }
      );

    const items =
      extractItems(
        data
      );

    EZ_HOME.state.live =
      items;

    EZ_HOME.state.liveStatistics =
      await safeApiRequest(
        EZ_HOME.config.endpoints.liveStatistics,
        "liveStatistics",
        null
      );

    return items;
  }


  /* ============================================================
     النظام
     ============================================================ */

  async function loadSystem() {

    EZ_HOME.state.system =
      await safeApiRequest(
        EZ_HOME.config.endpoints.system,
        "system",
        null
      );

    EZ_HOME.state.health =
      await safeApiRequest(
        EZ_HOME.config.endpoints.health,
        "health",
        null
      );
  }


  /* ============================================================
     حالة المنصة
     ============================================================ */

  function updatePlatformStatus() {

    const health =
      EZ_HOME.state.health;

    const system =
      EZ_HOME.state.system;

    const status =
      health?.status ||
      system?.status ||
      null;

    if (!status) {
      return;
    }

    document.documentElement
      .dataset.ezStatus =
      String(
        status
      );
  }


  /* ============================================================
     البحث
     ============================================================ */

  function setupSearch() {

    const button =
      qs(
        "#ez-search-button"
      );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      async () => {

        const query =
          window.prompt(
            "ابحث في EZ MEDIA:"
          );

        if (
          !query ||
          !query.trim()
        ) {
          return;
        }

        EZ_HOME.state.searchQuery =
          query.trim();

        const localResults =
          searchLocalContent(
            query.trim()
          );

        if (
          localResults.length
        ) {

          showSearchResults(
            localResults
          );

          return;
        }

        window.location.href =
          `/search?q=${encodeURIComponent(
            query.trim()
          )}`;

      }
    );
  }


  function searchLocalContent(
    query
  ) {

    const normalized =
      String(
        query
      )
        .trim()
        .toLowerCase();

    if (!normalized) {
      return [];
    }

    return EZ_HOME.state.content
      .filter(
        (item) => {

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

          return haystack.includes(
            normalized
          );
        }
      )
      .slice(0, 20);
  }


  function showSearchResults(
    results
  ) {

    const grid =
      qs(
        "#ez-news-grid"
      );

    if (!grid) {
      return;
    }

    grid.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    grid.innerHTML =
      results
        .map(
          createNewsCard
        )
        .join("");
  }


  /* ============================================================
     تحديث الصفحة
     ============================================================ */

  async function refresh() {

    if (
      EZ_HOME.state.loading
    ) {
      return;
    }

    EZ_HOME.state.loading =
      true;

    try {

      await Promise.all([
        loadContent(),
        loadLive(),
        loadSystem()
      ]);

      EZ_HOME.state.lastUpdate =
        new Date();

      updatePlatformStatus();

    } finally {

      EZ_HOME.state.loading =
        false;
    }
  }


  /* ============================================================
     التحديث الدوري
     ============================================================ */

  function startAutoRefresh() {

    window.setInterval(
      () => {

        refresh()
          .catch(
            (error) => {

              console.warn(
                "EZ MEDIA auto refresh error:",
                error
              );

            }
          );

      },
      EZ_HOME.config.refreshInterval
    );
  }


  /* ============================================================
     الأحداث العامة
     ============================================================ */

  function setupEvents() {

    document.addEventListener(
      "visibilitychange",
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {

          refresh()
            .catch(
              () => {}
            );
        }

      }
    );
  }


  /* ============================================================
     التهيئة
     ============================================================ */

  async function init() {

    if (
      EZ_HOME.state.initialized
    ) {
      return;
    }

    EZ_HOME.state.initialized =
      true;

    setupSearch();

    setupEvents();

    await refresh();

    startAutoRefresh();

    window.EZMediaHome =
      EZ_HOME;
  }


  /* ============================================================
     تشغيل
     ============================================================ */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      () => {

        init()
          .catch(
            (error) => {

              console.error(
                "EZ MEDIA home initialization failed:",
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
        (error) => {

          console.error(
            "EZ MEDIA home initialization failed:",
            error
          );

        }
      );
  }

})();
