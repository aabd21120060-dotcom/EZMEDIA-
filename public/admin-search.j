"use strict";

(function () {
  const VERSION = "11.0.0";

  const API = {
    content: "/api/content",
    media: "/api/media",
    live: "/api/live",
    breaking: "/api/breaking",
    commercial: "/api/commercial/campaigns",
    users: "/api/users",
    audit: "/api/audit"
  };

  const STATE = {
    query: "",
    type: "all",
    status: "all",
    results: [],
    loading: false,
    searched: false,
    lastSearch: null
  };

  const TYPES = {
    content: {
      label: "المحتوى",
      icon: "📰"
    },
    media: {
      label: "الوسائط",
      icon: "🎬"
    },
    live: {
      label: "البث",
      icon: "📡"
    },
    breaking: {
      label: "عاجل",
      icon: "⚡"
    },
    commercial: {
      label: "التجاري",
      icon: "📣"
    },
    users: {
      label: "المستخدمون",
      icon: "👥"
    },
    audit: {
      label: "السجل",
      icon: "🔐"
    }
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
      window
        .EZMediaAdminCore
        ?.getToken?.() ||
      null
    );
  }

  async function request(
    url
  ) {
    const token =
      getToken();

    const headers = {};

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    const response =
      await fetch(
        url,
        {
          method: "GET",
          credentials:
            "same-origin",
          headers
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

  function getArray(
    data,
    keys = []
  ) {
    if (
      Array.isArray(data)
    ) {
      return data;
    }

    for (
      const key of keys
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

  function normalizeItem(
    item,
    type
  ) {
    const source =
      TYPES[type] ||
      {
        label: type,
        icon: "🔎"
      };

    const id =
      item?.id ||
      item?._id ||
      item?.uuid ||
      null;

    const title =
      item?.title ||
      item?.headline ||
      item?.name ||
      item?.full_name ||
      item?.username ||
      item?.event_type ||
      "بدون عنوان";

    const description =
      item?.description ||
      item?.summary ||
      item?.message ||
      item?.email ||
      item?.slug ||
      "";

    const status =
      item?.status ||
      item?.state ||
      "—";

    const date =
      item?.updated_at ||
      item?.updatedAt ||
      item?.created_at ||
      item?.createdAt ||
      item?.published_at ||
      item?.publishedAt ||
      null;

    return {
      id,
      type,
      typeLabel:
        source.label,
      icon:
        source.icon,
      title,
      description,
      status,
      date,
      raw: item
    };
  }

  function matchesQuery(
    item,
    query
  ) {
    if (!query) {
      return true;
    }

    const text =
      [
        item.title,
        item.description,
        item.status,
        item.raw?.category,
        item.raw?.slug,
        item.raw?.email,
        item.raw?.username,
        item.raw?.full_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return text.includes(
      query.toLowerCase()
    );
  }

  function matchesStatus(
    item
  ) {
    if (
      STATE.status ===
      "all"
    ) {
      return true;
    }

    return (
      String(
        item.status || ""
      ).toLowerCase() ===
      STATE.status.toLowerCase()
    );
  }

  async function searchSource(
    type,
    query
  ) {
    const endpoint =
      API[type];

    if (!endpoint) {
      return [];
    }

    try {
      let url =
        endpoint;

      const params =
        new URLSearchParams();

      params.set(
        "limit",
        "200"
      );

      if (
        type ===
        "content"
      ) {
        params.set(
          "search",
          query
        );
      }

      if (
        type ===
        "media"
      ) {
        params.set(
          "search",
          query
        );
      }

      if (
        type ===
        "live"
      ) {
        params.set(
          "search",
          query
        );
      }

      if (
        type ===
        "breaking"
      ) {
        params.set(
          "search",
          query
        );
      }

      if (
        type ===
        "commercial"
      ) {
        params.set(
          "search",
          query
        );
      }

      if (
        type ===
        "users"
      ) {
        params.set(
          "search",
          query
        );
      }

      if (
        type ===
        "audit"
      ) {
        params.set(
          "search",
          query
        );
      }

      const separator =
        url.includes("?")
          ? "&"
          : "?";

      const data =
        await request(
          `${url}${separator}${params.toString()}`
        );

      const arrays = [
        "items",
        "data",
        "results",
        "content",
        "media",
        "channels",
        "campaigns",
        "users",
        "logs",
        "events"
      ];

      const list =
        getArray(
          data,
          arrays
        );

      return list
        .map(
          item =>
            normalizeItem(
              item,
              type
            )
        )
        .filter(
          item =>
            matchesQuery(
              item,
              query
            )
        )
        .filter(
          matchesStatus
        );

    } catch (error) {
      return [];
    }
  }

  async function performSearch() {
    const query =
      STATE.query.trim();

    STATE.loading =
      true;

    STATE.searched =
      true;

    render();

    const types =
      STATE.type ===
      "all"
        ? Object.keys(
            API
          )
        : [
            STATE.type
          ];

    const settled =
      await Promise.all(
        types.map(
          type =>
            searchSource(
              type,
              query
            )
        )
      );

    STATE.results =
      settled
        .flat()
        .sort(
          (
            a,
            b
          ) => {
            const dateA =
              new Date(
                a.date || 0
              ).getTime();

            const dateB =
              new Date(
                b.date || 0
              ).getTime();

            return (
              dateB -
              dateA
            );
          }
        );

    STATE.loading =
      false;

    STATE.lastSearch =
      new Date();

    render();

    document.dispatchEvent(
      new CustomEvent(
        "ezmedia:search-completed",
        {
          detail: {
            query,
            type:
              STATE.type,
            results:
              STATE.results
          }
        }
      )
    );
  }

  function openResult(
    result
  ) {
    if (!result) {
      return;
    }

    document.dispatchEvent(
      new CustomEvent(
        "ezmedia:search-open",
        {
          detail: result
        }
      )
    );

    const routes = {
      content:
        "#content-section",
      media:
        "#media-section",
      live:
        "#live-section",
      breaking:
        "#breaking-section",
      commercial:
        "#commercial-section",
      users:
        "#core-users-section",
      audit:
        "#core-audit-section"
    };

    const target =
      routes[
        result.type
      ];

    if (target) {
      const element =
        document.querySelector(
          target
        );

      if (element) {
        element.scrollIntoView(
          {
            behavior:
              "smooth",
            block:
              "start"
          }
        );
      }
    }

    if (
      result.raw?.url
    ) {
      try {
        window.open(
          result.raw.url,
          "_blank"
        );
      } catch {
        // تجاهل
      }
    }
  }

  function injectStyles() {
    if (
      document.getElementById(
        "ez-admin-search-style"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-admin-search-style";

    style.textContent = `
      #ez-admin-search {
        direction: rtl;
        color: #0f172a;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          "Segoe UI",
          Arial,
          sans-serif;
      }

      .ez-search-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }

      .ez-search-title {
        margin: 0;
        color: #075985;
        font-size: 27px;
        font-weight: 950;
      }

      .ez-search-subtitle {
        margin: 7px 0 0;
        color: #64748b;
        font-size: 13px;
      }

      .ez-search-box {
        display: grid;
        grid-template-columns:
          1fr auto;
        gap: 9px;
        margin-bottom: 12px;
      }

      .ez-search-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #bae6fd;
        border-radius: 16px;
        outline: none;
        padding: 14px 16px;
        background: #fff;
        color: #0f172a;
        font-size: 14px;
        font-weight: 650;
      }

      .ez-search-input:focus {
        border-color: #38bdf8;
        box-shadow:
          0 0 0 4px
          rgba(56,189,248,.12);
      }

      .ez-search-button {
        border: 0;
        border-radius: 16px;
        padding: 0 20px;
        cursor: pointer;
        color: #fff;
        font-size: 13px;
        font-weight: 900;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-search-filters {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .ez-search-filter {
        border: 1px solid #dbeafe;
        border-radius: 999px;
        background: #fff;
        color: #64748b;
        padding: 7px 11px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 850;
      }

      .ez-search-filter.active {
        border-color: transparent;
        color: #fff;
        background:
          linear-gradient(
            135deg,
            #0284c7,
            #38bdf8
          );
      }

      .ez-search-status {
        display: grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(160px, 1fr)
          );
        gap: 10px;
        margin-bottom: 18px;
      }

      .ez-search-stat {
        border: 1px solid #e0f2fe;
        border-radius: 17px;
        background: #fff;
        padding: 15px;
      }

      .ez-search-stat span {
        display: block;
        color: #64748b;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-search-stat strong {
        display: block;
        margin-top: 6px;
        color: #075985;
        font-size: 22px;
        font-weight: 950;
      }

      .ez-search-results {
        display: grid;
        gap: 10px;
      }

      .ez-search-result {
        display: grid;
        grid-template-columns:
          45px 1fr auto;
        gap: 13px;
        align-items: center;
        border: 1px solid #e0f2fe;
        border-radius: 18px;
        background: #fff;
        padding: 15px;
        cursor: pointer;
        transition: .2s ease;
      }

      .ez-search-result:hover {
        border-color: #7dd3fc;
        transform: translateY(-1px);
        box-shadow:
          0 10px 25px
          rgba(14,165,233,.07);
      }

      .ez-search-icon {
        width: 45px;
        height: 45px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: #e0f2fe;
        font-size: 19px;
      }

      .ez-search-result-title {
        color: #0f172a;
        font-size: 14px;
        font-weight: 900;
      }

      .ez-search-result-description {
        margin-top: 5px;
        color: #64748b;
        font-size: 11px;
        line-height: 1.7;
      }

      .ez-search-result-meta {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
        margin-top: 7px;
      }

      .ez-search-badge {
        border-radius: 999px;
        padding: 4px 8px;
        background: #eff6ff;
        color: #0369a1;
        font-size: 9px;
        font-weight: 900;
      }

      .ez-search-date {
        color: #94a3b8;
        font-size: 9px;
      }

      .ez-search-open {
        border: 1px solid #bae6fd;
        border-radius: 10px;
        background: #fff;
        color: #0369a1;
        padding: 7px 10px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 850;
      }

      .ez-search-empty {
        border: 1px dashed #bae6fd;
        border-radius: 20px;
        background: #fbfeff;
        padding: 55px 15px;
        text-align: center;
        color: #94a3b8;
      }

      .ez-search-empty strong {
        display: block;
        margin-bottom: 7px;
        color: #64748b;
        font-size: 15px;
      }

      .ez-search-loading {
        border-radius: 18px;
        background: #f0f9ff;
        padding: 25px;
        text-align: center;
        color: #0369a1;
        font-size: 13px;
        font-weight: 850;
      }

      .ez-search-info {
        margin-top: 15px;
        color: #94a3b8;
        font-size: 10px;
      }

      @media (max-width: 700px) {
        .ez-search-box {
          grid-template-columns: 1fr;
        }

        .ez-search-button {
          padding: 12px;
        }

        .ez-search-result {
          grid-template-columns:
            40px 1fr;
        }

        .ez-search-open {
          grid-column: 1 / -1;
          width: fit-content;
        }

        .ez-search-title {
          font-size: 22px;
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
        "#search-section"
      ) ||
      document.querySelector(
        "#admin-search-section"
      ) ||
      document.querySelector(
        '[data-admin-section="search"]'
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
      "admin-search-section";

    const parent =
      document.querySelector(
        "main"
      ) ||
      document.body;

    parent.appendChild(
      mount
    );

    return mount;
  }

  function render() {
    injectStyles();

    const mount =
      createMount();

    mount.id =
      "ez-admin-search";

    const typeFilters = [
      [
        "all",
        "الكل"
      ],
      [
        "content",
        "المحتوى"
      ],
      [
        "media",
        "الوسائط"
      ],
      [
        "live",
        "البث"
      ],
      [
        "breaking",
        "عاجل"
      ],
      [
        "commercial",
        "التجاري"
      ],
      [
        "users",
        "المستخدمون"
      ],
      [
        "audit",
        "السجل"
      ]
    ];

    mount.innerHTML = `
      <div class="ez-search-header">

        <div>
          <h2 class="ez-search-title">
            البحث الذكي
          </h2>

          <p class="ez-search-subtitle">
            ابحث في محتوى وإدارة وتشغيل منصة EZ MEDIA من مكان واحد
          </p>
        </div>

      </div>

      <div class="ez-search-box">

        <input
          id="ez-search-input"
          class="ez-search-input"
          type="search"
          value="${escapeHtml(
            STATE.query
          )}"
          placeholder="ابحث عن خبر، فيديو، قناة، عاجل، حملة، مستخدم أو عملية..."
          autocomplete="off"
        />

        <button
          id="ez-search-submit"
          class="ez-search-button"
        >
          بحث
        </button>

      </div>

      <div class="ez-search-filters">

        ${typeFilters
          .map(
            ([key, label]) =>
              `
                <button
                  class="ez-search-filter ${
                    STATE.type ===
                    key
                      ? "active"
                      : ""
                  }"
                  data-search-type="${key}"
                >
                  ${label}
                </button>
              `
          )
          .join("")}

      </div>

      <div class="ez-search-status">

        <div class="ez-search-stat">
          <span>
            النتائج
          </span>

          <strong>
            ${
              STATE.loading
                ? "..."
                : STATE.results.length
            }
          </strong>
        </div>

        <div class="ez-search-stat">
          <span>
            النطاق
          </span>

          <strong>
            ${
              STATE.type ===
              "all"
                ? "الكل"
                : TYPES[
                    STATE.type
                  ]?.label ||
                  STATE.type
            }
          </strong>
        </div>

        <div class="ez-search-stat">
          <span>
            آخر بحث
          </span>

          <strong>
            ${
              STATE.lastSearch
                ? formatDate(
                    STATE.lastSearch
                  )
                : "—"
            }
          </strong>
        </div>

      </div>

      ${
        STATE.loading
          ? `
            <div class="ez-search-loading">
              جارٍ البحث في المنصة...
            </div>
          `
          : STATE.searched
          ? renderResults()
          : `
            <div class="ez-search-empty">
              <strong>
                مركز البحث الموحد
              </strong>

              اكتب كلمة أو اسمًا أو عنوانًا ثم ابدأ البحث.
            </div>
          `
      }

      <div class="ez-search-info">
        الإصدار ${VERSION}
      </div>
    `;

    bindEvents();
  }

  function renderResults() {
    if (
      !STATE.results.length
    ) {
      return `
        <div class="ez-search-empty">
          <strong>
            لم يتم العثور على نتائج
          </strong>

          جرّب كلمة بحث أخرى أو وسّع نطاق البحث إلى الكل.
        </div>
      `;
    }

    return `
      <div class="ez-search-results">

        ${STATE.results
          .map(
            result => `
              <article
                class="ez-search-result"
                data-search-id="${escapeHtml(
                  result.id ||
                  ""
                )}"
                data-search-type-result="${escapeHtml(
                  result.type
                )}"
              >

                <div class="ez-search-icon">
                  ${result.icon}
                </div>

                <div>

                  <div class="ez-search-result-title">
                    ${escapeHtml(
                      result.title
                    )}
                  </div>

                  <div class="ez-search-result-description">
                    ${escapeHtml(
                      result.description
                    )}
                  </div>

                  <div class="ez-search-result-meta">

                    <span class="ez-search-badge">
                      ${escapeHtml(
                        result.typeLabel
                      )}
                    </span>

                    ${
                      result.status !==
                      "—"
                        ? `
                          <span class="ez-search-badge">
                            ${escapeHtml(
                              result.status
                            )}
                          </span>
                        `
                        : ""
                    }

                    <span class="ez-search-date">
                      ${formatDate(
                        result.date
                      )}
                    </span>

                  </div>

                </div>

                <button
                  class="ez-search-open"
                  type="button"
                >
                  فتح
                </button>

              </article>
            `
          )
          .join("")}

      </div>
    `;
  }

  function bindEvents() {
    const input =
      document.querySelector(
        "#ez-search-input"
      );

    const submit =
      document.querySelector(
        "#ez-search-submit"
      );

    if (input) {
      input.addEventListener(
        "input",
        event => {
          STATE.query =
            event.target.value;
        }
      );

      input.addEventListener(
        "keydown",
        event => {
          if (
            event.key ===
            "Enter"
          ) {
            event.preventDefault();
            performSearch();
          }
        }
      );
    }

    if (submit) {
      submit.addEventListener(
        "click",
        performSearch
      );
    }

    document
      .querySelectorAll(
        "[data-search-type]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              STATE.type =
                button.dataset
                  .searchType;

              if (
                STATE.searched
              ) {
                performSearch();
              } else {
                render();
              }
            }
          );

        }
      );

    document
      .querySelectorAll(
        ".ez-search-result"
      )
      .forEach(
        element => {

          element.addEventListener(
            "click",
            event => {

              if (
                event.target.closest(
                  ".ez-search-open"
                )
              ) {
                event.preventDefault();
              }

              const id =
                element.dataset
                  .searchId;

              const type =
                element.dataset
                  .searchTypeResult;

              const result =
                STATE.results.find(
                  item =>
                    String(
                      item.id
                    ) ===
                      String(id) &&
                    item.type ===
                      type
                );

              openResult(
                result
              );
            }
          );

        }
      );

    document
      .querySelectorAll(
        ".ez-search-open"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            event => {

              event.stopPropagation();

              const resultElement =
                button.closest(
                  ".ez-search-result"
                );

              if (
                !resultElement
              ) {
                return;
              }

              const id =
                resultElement
                  .dataset
                  .searchId;

              const type =
                resultElement
                  .dataset
                  .searchTypeResult;

              const result =
                STATE.results.find(
                  item =>
                    String(
                      item.id
                    ) ===
                      String(id) &&
                    item.type ===
                      type
                );

              openResult(
                result
              );
            }
          );

        }
      );
  }

  function initialize() {
    injectStyles();
    render();
  }

  function focusSearch() {
    const input =
      document.querySelector(
        "#ez-search-input"
      );

    if (input) {
      input.focus();
      input.select();
    }
  }

  document.addEventListener(
    "keydown",
    event => {

      const isShortcut =
        (
          event.ctrlKey ||
          event.metaKey
        ) &&
        event.key.toLowerCase() ===
          "k";

      if (
        isShortcut
      ) {
        event.preventDefault();
        focusSearch();
      }

      if (
        event.key ===
        "Escape"
      ) {
        const input =
          document.querySelector(
            "#ez-search-input"
          );

        if (
          input &&
          document.activeElement ===
            input
        ) {
          input.blur();
        }
      }
    }
  );

  window.EZMediaAdminSearch = {
    initialize,
    search:
      performSearch,
    focus:
      focusSearch,

    setType(
      type
    ) {
      STATE.type =
        type || "all";
      render();
    },

    getState() {
      return {
        ...STATE,
        results: [
          ...STATE.results
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
