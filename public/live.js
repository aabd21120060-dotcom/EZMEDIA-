"use strict";

/*
|--------------------------------------------------------------------------
| EZ MEDIA 11.0
| Live Broadcast Frontend
|--------------------------------------------------------------------------
|
| مسؤول عن:
| - جلب القنوات
| - عرض القنوات المميزة
| - اختيار القناة
| - تشغيل HLS
| - تشغيل DASH بشكل أساسي عبر MediaSource عند دعم المتصفح
| - التعامل مع المصادر الخارجية
| - تحديث حالة البث
| - تحديث القنوات دوريًا
|
|--------------------------------------------------------------------------
*/

(() => {
  const state = {
    channels: [],
    featuredChannels: [],
    selectedChannel: null,
    player: null,
    refreshTimer: null,
    refreshInterval: 30000
  };

  const elements = {
    container: null,
    featuredContainer: null,
    channelsContainer: null,
    playerContainer: null,
    player: null,
    playerTitle: null,
    playerStatus: null,
    playerSource: null,
    message: null
  };

  /*
  |--------------------------------------------------------------------------
  | أدوات عامة
  |--------------------------------------------------------------------------
  */

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function createElement(tag, className = "", text = "") {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function escapeText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  }

  function getApiBase() {
    return "/api/live";
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.error ||
        "تعذر الاتصال بخدمة البث";

      const error = new Error(message);

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  /*
  |--------------------------------------------------------------------------
  | إنشاء واجهة البث تلقائيًا
  |--------------------------------------------------------------------------
  */

  function createLiveInterface() {
    let root = qs("#ez-live");

    if (root) {
      return root;
    }

    root = createElement("section", "ez-live");

    root.id = "ez-live";

    root.innerHTML = `
      <div class="ez-live-header">
        <div>
          <span class="ez-live-kicker">EZ MEDIA LIVE</span>
          <h2>البث المباشر</h2>
          <p>
            شاهد القنوات والمصادر المباشرة من منصة EZ MEDIA.
          </p>
        </div>

        <div class="ez-live-indicator">
          <span class="ez-live-dot"></span>
          <span>مباشر</span>
        </div>
      </div>

      <div class="ez-live-layout">

        <div class="ez-live-main">

          <div class="ez-live-player-card">

            <div
              id="ez-live-player-container"
              class="ez-live-player-container"
            >
              <div class="ez-live-empty-player">
                <div class="ez-live-play-icon">▶</div>
                <h3>اختر قناة للبدء</h3>
                <p>
                  ستظهر هنا شاشة البث المباشر.
                </p>
              </div>
            </div>

            <div class="ez-live-player-info">

              <div>
                <h3 id="ez-live-player-title">
                  لم يتم اختيار قناة
                </h3>

                <p id="ez-live-player-source">
                  —
                </p>
              </div>

              <div
                id="ez-live-player-status"
                class="ez-live-player-status"
              >
                غير متصل
              </div>

            </div>

          </div>

        </div>

        <aside class="ez-live-sidebar">

          <div class="ez-live-sidebar-title">
            <h3>القنوات</h3>
            <button
              id="ez-live-refresh"
              type="button"
            >
              تحديث
            </button>
          </div>

          <div
            id="ez-live-featured"
            class="ez-live-featured"
          ></div>

          <div
            id="ez-live-channels"
            class="ez-live-channels"
          ></div>

        </aside>

      </div>

      <div
        id="ez-live-message"
        class="ez-live-message"
        hidden
      ></div>
    `;

    const target =
      qs("#live-section") ||
      qs("main") ||
      document.body;

    target.appendChild(root);

    injectStyles();

    cacheElements();

    return root;
  }

  function cacheElements() {
    elements.container = qs("#ez-live");

    if (!elements.container) {
      return;
    }

    elements.featuredContainer =
      qs("#ez-live-featured");

    elements.channelsContainer =
      qs("#ez-live-channels");

    elements.playerContainer =
      qs("#ez-live-player-container");

    elements.playerTitle =
      qs("#ez-live-player-title");

    elements.playerStatus =
      qs("#ez-live-player-status");

    elements.playerSource =
      qs("#ez-live-player-source");

    elements.message =
      qs("#ez-live-message");

    const refreshButton =
      qs("#ez-live-refresh");

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        async () => {
          await loadChannels();
        }
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | تحميل القنوات
  |--------------------------------------------------------------------------
  */

  async function loadChannels() {
    showMessage(
      "جاري تحميل قنوات البث...",
      "loading"
    );

    try {
      const [channelsData, featuredData] =
        await Promise.all([
          request(`${getApiBase()}?limit=100`),
          request(`${getApiBase()}/featured`)
        ]);

      state.channels =
        Array.isArray(channelsData?.channels)
          ? channelsData.channels
          : [];

      state.featuredChannels =
        Array.isArray(featuredData?.channels)
          ? featuredData.channels
          : [];

      renderFeaturedChannels();
      renderChannels();

      hideMessage();

      if (
        !state.selectedChannel &&
        state.featuredChannels.length > 0
      ) {
        selectChannel(
          state.featuredChannels[0]
        );
      } else if (
        !state.selectedChannel &&
        state.channels.length > 0
      ) {
        selectChannel(
          state.channels[0]
        );
      }

      return {
        channels: state.channels,
        featured: state.featuredChannels
      };
    } catch (error) {
      console.error(
        "EZ MEDIA Live error:",
        error
      );

      showMessage(
        error.message ||
          "تعذر تحميل قنوات البث",
        "error"
      );

      return null;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | عرض القنوات المميزة
  |--------------------------------------------------------------------------
  */

  function renderFeaturedChannels() {
    const container =
      elements.featuredContainer;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (
      !state.featuredChannels ||
      state.featuredChannels.length === 0
    ) {
      return;
    }

    const title = createElement(
      "div",
      "ez-live-section-label",
      "القنوات المميزة"
    );

    container.appendChild(title);

    state.featuredChannels.forEach(
      (channel) => {
        container.appendChild(
          createChannelCard(
            channel,
            true
          )
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | عرض جميع القنوات
  |--------------------------------------------------------------------------
  */

  function renderChannels() {
    const container =
      elements.channelsContainer;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (
      !state.channels ||
      state.channels.length === 0
    ) {
      const empty = createElement(
        "div",
        "ez-live-empty",
        "لا توجد قنوات بث مضافة حاليًا."
      );

      container.appendChild(empty);

      return;
    }

    state.channels.forEach((channel) => {
      const card =
        createChannelCard(
          channel,
          false
        );

      container.appendChild(card);
    });
  }

  /*
  |--------------------------------------------------------------------------
  | بطاقة القناة
  |--------------------------------------------------------------------------
  */

  function createChannelCard(
    channel,
    featured = false
  ) {
    const button =
      createElement(
        "button",
        "ez-live-channel"
      );

    button.type = "button";

    button.dataset.channelId =
      channel.id || "";

    if (
      state.selectedChannel &&
      state.selectedChannel.id ===
        channel.id
    ) {
      button.classList.add("active");
    }

    const logo = createElement(
      "div",
      "ez-live-channel-logo"
    );

    if (channel.logo_url) {
      const image =
        document.createElement("img");

      image.src =
        channel.logo_url;

      image.alt =
        escapeText(channel.name);

      image.loading = "lazy";

      logo.appendChild(image);
    } else {
      logo.textContent = "EZ";
    }

    const info = createElement(
      "div",
      "ez-live-channel-info"
    );

    const name = createElement(
      "strong",
      "",
      channel.name || "قناة"
    );

    const source = createElement(
      "span",
      "",
      getSourceLabel(
        channel.source_type
      )
    );

    info.appendChild(name);
    info.appendChild(source);

    const status =
      createChannelStatus(
        channel.status
      );

    button.appendChild(logo);
    button.appendChild(info);
    button.appendChild(status);

    if (featured) {
      button.classList.add(
        "featured-channel"
      );
    }

    button.addEventListener(
      "click",
      () => {
        selectChannel(channel);
      }
    );

    return button;
  }

  function createChannelStatus(status) {
    const element = createElement(
      "span",
      "ez-live-channel-status"
    );

    const dot = createElement(
      "span",
      "ez-live-status-dot"
    );

    const text = createElement(
      "span",
      "",
      getStatusLabel(status)
    );

    element.appendChild(dot);
    element.appendChild(text);

    if (status) {
      element.dataset.status =
        status;
    }

    return element;
  }

  /*
  |--------------------------------------------------------------------------
  | اختيار القناة
  |--------------------------------------------------------------------------
  */

  function selectChannel(channel) {
    if (!channel) {
      return;
    }

    state.selectedChannel =
      channel;

    renderChannels();
    renderFeaturedChannels();

    updatePlayerInformation(
      channel
    );

    playChannel(channel);
  }

  /*
  |--------------------------------------------------------------------------
  | معلومات المشغل
  |--------------------------------------------------------------------------
  */

  function updatePlayerInformation(
    channel
  ) {
    if (elements.playerTitle) {
      elements.playerTitle.textContent =
        channel.name ||
        "قناة EZ MEDIA";
    }

    if (elements.playerSource) {
      elements.playerSource.textContent =
        getSourceLabel(
          channel.source_type
        );
    }

    if (elements.playerStatus) {
      elements.playerStatus.textContent =
        getStatusLabel(
          channel.status
        );

      elements.playerStatus.dataset.status =
        channel.status || "offline";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | تشغيل البث
  |--------------------------------------------------------------------------
  */

  function playChannel(channel) {
    destroyPlayer();

    const sourceUrl =
      channel.source_url;

    if (!sourceUrl) {
      showPlayerError(
        "مصدر البث غير متوفر لهذه القناة."
      );

      return;
    }

    if (
      channel.status ===
      "disabled"
    ) {
      showPlayerError(
        "هذه القناة معطلة حاليًا."
      );

      return;
    }

    if (
      channel.status ===
      "offline"
    ) {
      showPlayerMessage(
        "القناة غير متصلة حاليًا."
      );

      return;
    }

    const sourceType =
      String(
        channel.source_type ||
          "external"
      ).toLowerCase();

    if (
      sourceType === "hls"
    ) {
      playHls(
        sourceUrl,
        channel
      );

      return;
    }

    if (
      sourceType === "dash"
    ) {
      playDash(
        sourceUrl,
        channel
      );

      return;
    }

    if (
      sourceType === "embed"
    ) {
      playEmbed(
        sourceUrl,
        channel
      );

      return;
    }

    playExternal(
      sourceUrl,
      channel
    );
  }

  /*
  |--------------------------------------------------------------------------
  | HLS
  |--------------------------------------------------------------------------
  |
  | يعتمد أولًا على دعم المتصفح الأصلي.
  | وإذا لم يدعم المتصفح HLS بشكل أصلي
  | نحاول استخدام hls.js إذا كان محملًا في الصفحة.
  |
  */

  function playHls(
    sourceUrl,
    channel
  ) {
    const video =
      createVideoPlayer();

    if (
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      video.src =
        sourceUrl;

      video.autoplay = true;
      video.controls = true;
      video.playsInline = true;

      attachPlayerEvents(
        video,
        channel
      );

      elements.playerContainer
        .appendChild(video);

      video.play().catch(() => {});

      return;
    }

    if (
      window.Hls &&
      window.Hls.isSupported()
    ) {
      const hls =
        new window.Hls({
          enableWorker: true,
          lowLatencyMode: true
        });

      state.player = hls;

      hls.loadSource(
        sourceUrl
      );

      hls.attachMedia(
        video
      );

      hls.on(
        window.Hls.Events.MANIFEST_PARSED,
        () => {
          video.play().catch(
            () => {}
          );
        }
      );

      hls.on(
        window.Hls.Events.ERROR,
        (
          event,
          data
        ) => {
          if (
            data &&
            data.fatal
          ) {
            showPlayerError(
              "حدث خطأ أثناء تشغيل البث."
            );
          }
        }
      );

      attachPlayerEvents(
        video,
        channel
      );

      elements.playerContainer
        .appendChild(video);

      return;
    }

    showPlayerError(
      "المتصفح لا يدعم HLS حاليًا."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DASH
  |--------------------------------------------------------------------------
  */

  function playDash(
    sourceUrl,
    channel
  ) {
    const video =
      createVideoPlayer();

    if (
      window.dashjs &&
      typeof window.dashjs.MediaPlayer ===
        "function"
    ) {
      const player =
        window.dashjs
          .MediaPlayer()
          .create();

      state.player =
        player;

      player.initialize(
        video,
        sourceUrl,
        true
      );

      attachPlayerEvents(
        video,
        channel
      );

      elements.playerContainer
        .appendChild(video);

      return;
    }

    showPlayerError(
      "مشغل DASH غير متوفر في الواجهة حاليًا."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Embed
  |--------------------------------------------------------------------------
  */

  function playEmbed(
    sourceUrl,
    channel
  ) {
    const iframe =
      document.createElement(
        "iframe"
      );

    iframe.src =
      sourceUrl;

    iframe.title =
      channel.name ||
      "EZ MEDIA Live";

    iframe.allow =
      "autoplay; fullscreen; picture-in-picture";

    iframe.allowFullscreen =
      true;

    iframe.loading =
      "eager";

    iframe.referrerPolicy =
      "strict-origin-when-cross-origin";

    iframe.className =
      "ez-live-iframe";

    elements.playerContainer
      .appendChild(iframe);

    state.player =
      iframe;
  }

  /*
  |--------------------------------------------------------------------------
  | External
  |--------------------------------------------------------------------------
  */

  function playExternal(
    sourceUrl,
    channel
  ) {
    const wrapper =
      createElement(
        "div",
        "ez-live-external"
      );

    const title =
      createElement(
        "h3",
        "",
        channel.name ||
          "مصدر بث خارجي"
      );

    const text =
      createElement(
        "p",
        "",
        "مصدر البث خارجي ويمكن فتحه من خلال الزر التالي."
      );

    const link =
      createElement(
        "a",
        "ez-live-external-button",
        "فتح مصدر البث"
      );

    link.href =
      sourceUrl;

    link.target =
      "_blank";

    link.rel =
      "noopener noreferrer";

    wrapper.appendChild(
      title
    );

    wrapper.appendChild(
      text
    );

    wrapper.appendChild(
      link
    );

    elements.playerContainer
      .appendChild(wrapper);

    state.player =
      wrapper;
  }

  /*
  |--------------------------------------------------------------------------
  | إنشاء Video
  |--------------------------------------------------------------------------
  */

  function createVideoPlayer() {
    const video =
      document.createElement(
        "video"
      );

    video.className =
      "ez-live-video";

    video.controls =
      true;

    video.autoplay =
      true;

    video.playsInline =
      true;

    video.setAttribute(
      "webkit-playsinline",
      ""
    );

    video.preload =
      "auto";

    return video;
  }

  /*
  |--------------------------------------------------------------------------
  | أحداث المشغل
  |--------------------------------------------------------------------------
  */

  function attachPlayerEvents(
    video,
    channel
  ) {
    video.addEventListener(
      "playing",
      () => {
        if (
          elements.playerStatus
        ) {
          elements.playerStatus.textContent =
            "مباشر الآن";

          elements.playerStatus.dataset.status =
            "live";
        }
      }
    );

    video.addEventListener(
      "waiting",
      () => {
        if (
          elements.playerStatus
        ) {
          elements.playerStatus.textContent =
            "جاري التحميل...";
        }
      }
    );

    video.addEventListener(
      "error",
      () => {
        showPlayerError(
          `تعذر تشغيل بث ${channel.name || "القناة"}.`
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | تنظيف المشغل السابق
  |--------------------------------------------------------------------------
  */

  function destroyPlayer() {
    if (
      state.player
    ) {
      try {
        if (
          typeof state.player.destroy ===
          "function"
        ) {
          state.player.destroy();
        }
      } catch {
        // تجاهل خطأ تنظيف المشغل
      }

      try {
        if (
          state.player.pause
        ) {
          state.player.pause();
        }
      } catch {
        // تجاهل
      }

      state.player = null;
    }

    if (
      elements.playerContainer
    ) {
      elements.playerContainer.innerHTML =
        "";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | رسائل المشغل
  |--------------------------------------------------------------------------
  */

  function showPlayerMessage(
    message
  ) {
    if (
      !elements.playerContainer
    ) {
      return;
    }

    elements.playerContainer.innerHTML = `
      <div class="ez-live-player-message">
        <div class="ez-live-message-icon">●</div>
        <h3>${escapeText(message)}</h3>
      </div>
    `;
  }

  function showPlayerError(
    message
  ) {
    if (
      !elements.playerContainer
    ) {
      return;
    }

    elements.playerContainer.innerHTML = `
      <div class="ez-live-player-message error">
        <div class="ez-live-message-icon">!</div>
        <h3>${escapeText(message)}</h3>
        <p>
          تحقق من مصدر البث أو إعدادات القناة.
        </p>
      </div>
    `;
  }

  /*
  |--------------------------------------------------------------------------
  | رسائل النظام
  |--------------------------------------------------------------------------
  */

  function showMessage(
    message,
    type = "info"
  ) {
    if (
      !elements.message
    ) {
      return;
    }

    elements.message.hidden =
      false;

    elements.message.textContent =
      message;

    elements.message.dataset.type =
      type;
  }

  function hideMessage() {
    if (
      !elements.message
    ) {
      return;
    }

    elements.message.hidden =
      true;
  }

  /*
  |--------------------------------------------------------------------------
  | التسميات
  |--------------------------------------------------------------------------
  */

  function getStatusLabel(
    status
  ) {
    const labels = {
      live: "مباشر",
      testing: "اختبار",
      offline: "غير متصل",
      disabled: "معطل"
    };

    return (
      labels[status] ||
      "غير معروف"
    );
  }

  function getSourceLabel(
    sourceType
  ) {
    const labels = {
      hls: "HLS",
      dash: "DASH",
      rtmp: "RTMP",
      embed: "مشغل مضمّن",
      external: "مصدر خارجي"
    };

    return (
      labels[sourceType] ||
      "مصدر بث"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | التحديث الدوري
  |--------------------------------------------------------------------------
  */

  function startAutoRefresh() {
    if (
      state.refreshTimer
    ) {
      clearInterval(
        state.refreshTimer
      );
    }

    state.refreshTimer =
      setInterval(
        async () => {
          await refreshChannelsSilently();
        },
        state.refreshInterval
      );
  }

  async function refreshChannelsSilently() {
    try {
      const data =
        await request(
          `${getApiBase()}?limit=100`
        );

      const channels =
        Array.isArray(
          data?.channels
        )
          ? data.channels
          : [];

      state.channels =
        channels;

      renderChannels();

      if (
        state.selectedChannel
      ) {
        const updated =
          channels.find(
            (item) =>
              item.id ===
              state.selectedChannel.id
          );

        if (updated) {
          state.selectedChannel =
            updated;

          updatePlayerInformation(
            updated
          );
        }
      }
    } catch (error) {
      console.warn(
        "تعذر تحديث قنوات البث:",
        error
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CSS
  |--------------------------------------------------------------------------
  */

  function injectStyles() {
    if (
      document.getElementById(
        "ez-live-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-live-styles";

    style.textContent = `
      .ez-live {
        width: 100%;
        max-width: 1500px;
        margin: 40px auto;
        padding: 24px;
        box-sizing: border-box;
        direction: rtl;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Tahoma,
          Arial,
          sans-serif;
        color: #10233f;
      }

      .ez-live-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 24px;
      }

      .ez-live-kicker {
        display: inline-block;
        margin-bottom: 8px;
        color: #42b9f5;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1px;
        direction: ltr;
      }

      .ez-live-header h2 {
        margin: 0 0 8px;
        font-size: clamp(28px, 4vw, 46px);
        font-weight: 900;
      }

      .ez-live-header p {
        margin: 0;
        color: #64748b;
        font-size: 16px;
      }

      .ez-live-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 999px;
        background: #eefaff;
        color: #148dcc;
        font-weight: 800;
        white-space: nowrap;
      }

      .ez-live-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #ef4444;
        box-shadow:
          0 0 0 5px rgba(239, 68, 68, .12);
      }

      .ez-live-layout {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          360px;
        gap: 20px;
        align-items: start;
      }

      .ez-live-player-card {
        overflow: hidden;
        border: 1px solid #dceef8;
        border-radius: 24px;
        background: #ffffff;
        box-shadow:
          0 18px 60px rgba(53, 153, 205, .10);
      }

      .ez-live-player-container {
        position: relative;
        width: 100%;
        min-height: 460px;
        aspect-ratio: 16 / 9;
        background:
          linear-gradient(
            135deg,
            #f8fdff,
            #eaf8ff
          );
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .ez-live-video,
      .ez-live-iframe {
        width: 100%;
        height: 100%;
        min-height: 460px;
        border: 0;
        display: block;
        object-fit: contain;
        background: #ffffff;
      }

      .ez-live-empty-player,
      .ez-live-player-message {
        text-align: center;
        padding: 30px;
        color: #64748b;
      }

      .ez-live-empty-player h3,
      .ez-live-player-message h3 {
        margin: 15px 0 8px;
        color: #16304f;
        font-size: 22px;
      }

      .ez-live-empty-player p,
      .ez-live-player-message p {
        margin: 0;
      }

      .ez-live-play-icon {
        width: 72px;
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
        border-radius: 50%;
        background:
          linear-gradient(
            135deg,
            #8ee2ff,
            #45baf5
          );
        color: white;
        font-size: 26px;
        box-shadow:
          0 12px 30px
          rgba(69, 186, 245, .28);
      }

      .ez-live-message-icon {
        width: 58px;
        height: 58px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #eefaff;
        color: #159bd9;
        font-weight: 900;
        font-size: 22px;
      }

      .ez-live-player-message.error
      .ez-live-message-icon {
        background: #fff4f4;
        color: #ef4444;
      }

      .ez-live-player-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        padding: 18px 20px;
        border-top: 1px solid #e5f1f7;
      }

      .ez-live-player-info h3 {
        margin: 0 0 6px;
        font-size: 20px;
      }

      .ez-live-player-info p {
        margin: 0;
        color: #7890a5;
        font-size: 13px;
      }

      .ez-live-player-status {
        padding: 8px 13px;
        border-radius: 999px;
        background: #eef2f7;
        color: #64748b;
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
      }

      .ez-live-player-status[data-status="live"] {
        background: #eafbf3;
        color: #14945b;
      }

      .ez-live-player-status[data-status="testing"] {
        background: #fff8e7;
        color: #b97800;
      }

      .ez-live-sidebar {
        position: sticky;
        top: 20px;
        max-height: 760px;
        overflow: auto;
        padding: 16px;
        border: 1px solid #dceef8;
        border-radius: 24px;
        background: #ffffff;
        box-shadow:
          0 18px 60px rgba(53, 153, 205, .08);
      }

      .ez-live-sidebar-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 14px;
      }

      .ez-live-sidebar-title h3 {
        margin: 0;
        font-size: 20px;
      }

      .ez-live-sidebar-title button {
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        background: #effaff;
        color: #168fca;
        cursor: pointer;
        font-weight: 800;
      }

      .ez-live-section-label {
        margin: 12px 2px 8px;
        color: #7890a5;
        font-size: 12px;
        font-weight: 900;
      }

      .ez-live-channel {
        width: 100%;
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        padding: 10px;
        border: 1px solid #e5f1f7;
        border-radius: 15px;
        background: #ffffff;
        color: #17324f;
        text-align: right;
        cursor: pointer;
        transition:
          transform .18s ease,
          border-color .18s ease,
          box-shadow .18s ease,
          background .18s ease;
      }

      .ez-live-channel:hover {
        transform: translateY(-1px);
        border-color: #9adcf7;
        box-shadow:
          0 8px 24px rgba(69, 186, 245, .10);
      }

      .ez-live-channel.active {
        border-color: #5bc5f5;
        background: #f2fbff;
        box-shadow:
          0 8px 24px rgba(69, 186, 245, .12);
      }

      .ez-live-channel-logo {
        width: 48px;
        height: 48px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 13px;
        background:
          linear-gradient(
            135deg,
            #eaf9ff,
            #d7f2ff
          );
        color: #159bd9;
        font-weight: 900;
      }

      .ez-live-channel-logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .ez-live-channel-info {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .ez-live-channel-info strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
      }

      .ez-live-channel-info span {
        color: #8a9bae;
        font-size: 11px;
        direction: ltr;
        text-align: right;
      }

      .ez-live-channel-status {
        display: flex;
        align-items: center;
        gap: 5px;
        color: #8795a4;
        font-size: 10px;
        white-space: nowrap;
      }

      .ez-live-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #aab4be;
      }

      .ez-live-channel-status[data-status="live"]
      .ez-live-status-dot {
        background: #18b56d;
        box-shadow:
          0 0 0 3px rgba(24, 181, 109, .10);
      }

      .ez-live-channel-status[data-status="testing"]
      .ez-live-status-dot {
        background: #e7a51b;
      }

      .ez-live-channel-status[data-status="disabled"]
      .ez-live-status-dot {
        background: #ef4444;
      }

      .ez-live-empty {
        padding: 30px 10px;
        text-align: center;
        color: #8292a2;
        font-size: 13px;
      }

      .ez-live-message {
        margin-top: 16px;
        padding: 12px 16px;
        border-radius: 12px;
        background: #eefaff;
        color: #168fca;
      }

      .ez-live-message[data-type="error"] {
        background: #fff4f4;
        color: #d83c3c;
      }

      .ez-live-message[data-type="loading"] {
        background: #f4faff;
        color: #47758f;
      }

      .ez-live-external {
        width: min(90%, 500px);
        padding: 30px;
        border: 1px solid #dceef8;
        border-radius: 20px;
        background: #ffffff;
        text-align: center;
        box-sizing: border-box;
      }

      .ez-live-external h3 {
        margin: 0 0 10px;
      }

      .ez-live-external p {
        color: #718096;
      }

      .ez-live-external-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 11px 18px;
        border-radius: 12px;
        background:
          linear-gradient(
            135deg,
            #64cdf8,
            #299fdb
          );
        color: #ffffff;
        text-decoration: none;
        font-weight: 800;
      }

      @media (max-width: 1050px) {
        .ez-live-layout {
          grid-template-columns: 1fr;
        }

        .ez-live-sidebar {
          position: static;
          max-height: none;
        }
      }

      @media (max-width: 700px) {
        .ez-live {
          padding: 14px;
          margin: 20px auto;
        }

        .ez-live-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .ez-live-player-container {
          min-height: 240px;
        }

        .ez-live-video,
        .ez-live-iframe {
          min-height: 240px;
        }

        .ez-live-player-info {
          align-items: flex-start;
          flex-direction: column;
        }

        .ez-live-sidebar {
          border-radius: 18px;
          padding: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /*
  |--------------------------------------------------------------------------
  | بدء النظام
  |--------------------------------------------------------------------------
  */

  async function initialize() {
    createLiveInterface();

    await loadChannels();

    startAutoRefresh();
  }

  /*
  |--------------------------------------------------------------------------
  | API عام
  |--------------------------------------------------------------------------
  */

  window.EZMediaLive = {
    initialize,
    loadChannels,
    selectChannel,
    getChannels: () =>
      [...state.channels],
    getSelectedChannel: () =>
      state.selectedChannel
  };

  /*
  |--------------------------------------------------------------------------
  | التشغيل عند جاهزية الصفحة
  |--------------------------------------------------------------------------
  */

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
