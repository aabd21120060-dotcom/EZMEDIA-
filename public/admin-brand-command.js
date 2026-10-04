"use strict";

/**
 * EZ MEDIA 11.0
 * الكود رقم 31
 * الملف: public/admin-brand-command.js
 *
 * مركز إدارة الهوية والهوية البصرية الذكية
 *
 * المسؤوليات:
 * - إدارة اسم المنصة
 * - الاسم المختصر
 * - الشعار
 * - الوصف الرسمي
 * - الألوان
 * - الخطوط
 * - الهوية الرقمية
 * - بيانات المنصة
 * - هوية البث
 * - هوية الأخبار العاجلة
 * - هوية البطاقات
 * - هوية الإعلانات
 * - هوية وسائل التواصل
 * - المعاينة الحية
 * - حفظ إعدادات الهوية
 *
 * لا يعتمد على خدمات خارجية.
 * يمكن ربطه لاحقًا بقاعدة البيانات وCDN.
 */

(function () {
  "use strict";

  const MODULE =
    "brand-command";

  const STORAGE_KEY =
    "ezmedia_brand_identity_v1";

  const DEFAULT_BRAND = {
    platformName:
      "EZ MEDIA",

    shortName:
      "EZ",

    arabicName:
      "إي زد ميديا",

    englishName:
      "EZ MEDIA",

    tagline:
      "منصة إعلامية ذكية للمحتوى والأخبار والبث",

    description:
      "منصة إعلامية رقمية مستقبلية تجمع الأخبار والمحتوى والبث والذكاء الاصطناعي في تجربة إعلامية واحدة.",

    website:
      "https://ezzal-harbiez.com",

    logo:
      "",

    favicon:
      "",

    primaryColor:
      "#42C4E8",

    secondaryColor:
      "#DFF8FF",

    accentColor:
      "#8FE8FF",

    backgroundColor:
      "#FFFFFF",

    textColor:
      "#17384F",

    mutedColor:
      "#6F8997",

    fontFamily:
      "system-ui",

    direction:
      "rtl",

    defaultLanguage:
      "ar",

    country:
      "SA",

    timezone:
      "Asia/Riyadh",

    newsLabel:
      "أخبار EZ MEDIA",

    breakingLabel:
      "عاجل",

    liveLabel:
      "بث مباشر",

    broadcastLabel:
      "البث",

    aiLabel:
      "ذكاء EZ",

    advertisingLabel:
      "إعلانات",

    sponsorshipLabel:
      "رعاية",

    footerText:
      "EZ MEDIA — منصة إعلامية رقمية ذكية",

    socialEnabled:
      true,

    liveEnabled:
      true,

    breakingEnabled:
      true,

    aiEnabled:
      true,

    advertisingEnabled:
      true,

    sponsorshipEnabled:
      true,

    showWatermark:
      true,

    showPoweredBy:
      false,

    showArabicFirst:
      true,

    updatedAt:
      null
  };

  const state = {
    brand: {},
    activeTab:
      "identity",
    dirty:
      false
  };

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function load() {
    let stored = null;

    try {
      stored =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "null"
        );
    } catch (error) {
      console.warn(
        "EZ MEDIA brand load:",
        error
      );
    }

    state.brand = {
      ...clone(DEFAULT_BRAND),
      ...(stored || {})
    };

    return state.brand;
  }

  function save() {
    state.brand.updatedAt =
      new Date().toISOString();

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          state.brand
        )
      );

      state.dirty = false;

      window.dispatchEvent(
        new CustomEvent(
          "ezmedia:brand:updated",
          {
            detail: {
              brand:
                clone(
                  state.brand
                )
            }
          }
        )
      );

      notify(
        "تم حفظ الهوية بنجاح.",
        "success"
      );

      applyBrandToPage();

      return true;
    } catch (error) {
      console.error(
        "EZ MEDIA brand save:",
        error
      );

      notify(
        "تعذر حفظ الهوية.",
        "error"
      );

      return false;
    }
  }

  function reset() {
    const confirmed =
      window.confirm(
        "هل تريد إعادة الهوية إلى الإعدادات الافتراضية؟"
      );

    if (!confirmed) {
      return;
    }

    state.brand =
      clone(
        DEFAULT_BRAND
      );

    state.dirty =
      true;

    render();

    notify(
      "تمت إعادة الإعدادات الافتراضية. اضغط حفظ لتثبيتها.",
      "warning"
    );
  }

  function notify(
    message,
    type = "info"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:notification",
        {
          detail: {
            module: MODULE,
            type,
            title:
              "الهوية البصرية",
            message
          }
        }
      )
    );

    let toast =
      document.querySelector(
        "#ez-brand-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "ez-brand-toast";

      document.body.appendChild(
        toast
      );
    }

    toast.textContent =
      message;

    toast.dataset.type =
      type;

    toast.classList.add(
      "show"
    );

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(() => {
        toast.classList.remove(
          "show"
        );
      }, 3000);
  }

  function injectStyles() {
    if (
      document.querySelector(
        "#ez-brand-command-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "ez-brand-command-styles";

    style.textContent = `
      #brand-command-section {
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

      .ez-brand-shell {
        max-width: 1600px;
        margin: auto;
      }

      .ez-brand-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding: 24px;
        border-radius: 26px;
        border: 1px solid #d8edf4;
        background:
          linear-gradient(
            135deg,
            #eafaff,
            #ffffff
          );
      }

      .ez-brand-header h2 {
        margin: 0 0 7px;
        font-size: 29px;
      }

      .ez-brand-header p {
        margin: 0;
        color: #6d8795;
        line-height: 1.8;
      }

      .ez-brand-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .ez-brand-btn {
        border: 0;
        border-radius: 12px;
        padding: 11px 15px;
        cursor: pointer;
        font-weight: 800;
        background: #edf8fc;
        color: #176984;
      }

      .ez-brand-btn.primary {
        background: #42c4e8;
        color: #ffffff;
      }

      .ez-brand-btn.danger {
        background: #fff0f2;
        color: #a32943;
      }

      .ez-brand-layout {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          390px;
        gap: 18px;
        margin-top: 18px;
      }

      .ez-brand-panel {
        background: #ffffff;
        border: 1px solid #dceef3;
        border-radius: 22px;
        overflow: hidden;
      }

      .ez-brand-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 13px;
        border-bottom: 1px solid #e5f0f3;
        background: #f9fdfe;
      }

      .ez-brand-tab {
        border: 0;
        border-radius: 10px;
        padding: 9px 12px;
        cursor: pointer;
        background: transparent;
        color: #6d8795;
        font-weight: 800;
      }

      .ez-brand-tab.active {
        background: #e5f8fd;
        color: #14728f;
      }

      .ez-brand-content {
        padding: 21px;
      }

      .ez-brand-form {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .ez-brand-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ez-brand-field.full {
        grid-column: 1 / -1;
      }

      .ez-brand-field label {
        font-size: 12px;
        font-weight: 800;
        color: #57717f;
      }

      .ez-brand-input,
      .ez-brand-textarea,
      .ez-brand-select {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #dbeaf0;
        border-radius: 12px;
        padding: 12px 13px;
        background: #ffffff;
        color: #17384f;
        outline: none;
      }

      .ez-brand-textarea {
        min-height: 105px;
        resize: vertical;
        line-height: 1.8;
      }

      .ez-brand-input:focus,
      .ez-brand-textarea:focus,
      .ez-brand-select:focus {
        border-color: #4ec5e7;
        box-shadow:
          0 0 0 3px
          rgba(78,197,231,.12);
      }

      .ez-brand-color {
        display: grid;
        grid-template-columns:
          58px 1fr;
        gap: 8px;
      }

      .ez-brand-color input[type="color"] {
        width: 58px;
        height: 44px;
        border: 0;
        padding: 2px;
        background: transparent;
        cursor: pointer;
      }

      .ez-brand-checks {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .ez-brand-check {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 12px;
        border-radius: 12px;
        background: #f7fbfd;
        border: 1px solid #e3eff3;
      }

      .ez-brand-preview {
        padding: 18px;
      }

      .ez-brand-preview-card {
        border-radius: 25px;
        overflow: hidden;
        border: 1px solid #dceef3;
        background: #ffffff;
      }

      .ez-brand-preview-top {
        padding: 20px;
        color: #ffffff;
        background:
          linear-gradient(
            135deg,
            var(--ez-brand-primary),
            var(--ez-brand-accent)
          );
      }

      .ez-brand-logo-box {
        width: 65px;
        height: 65px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 19px;
        background:
          rgba(255,255,255,.9);
        color: var(--ez-brand-primary);
        font-weight: 950;
        font-size: 21px;
        overflow: hidden;
      }

      .ez-brand-logo-box img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .ez-brand-preview-title {
        margin-top: 16px;
        font-size: 24px;
        font-weight: 950;
      }

      .ez-brand-preview-subtitle {
        margin-top: 5px;
        opacity: .9;
        line-height: 1.7;
      }

      .ez-brand-preview-body {
        padding: 18px;
      }

      .ez-brand-preview-item {
        padding: 13px;
        margin-bottom: 9px;
        border-radius: 13px;
        background: #f7fbfd;
      }

      .ez-brand-preview-item strong {
        display: block;
        margin-bottom: 4px;
      }

      .ez-brand-color-list {
        display: grid;
        grid-template-columns:
          repeat(2, 1fr);
        gap: 8px;
        margin-top: 14px;
      }

      .ez-brand-swatch {
        min-height: 70px;
        padding: 11px;
        border-radius: 13px;
        display: flex;
        align-items: flex-end;
        font-size: 11px;
        font-weight: 800;
      }

      .ez-brand-status {
        margin-top: 14px;
        padding: 12px;
        border-radius: 13px;
        background: #effbff;
        color: #216b82;
        line-height: 1.8;
      }

      .ez-brand-divider {
        height: 1px;
        background: #e7f0f3;
        margin: 20px 0;
      }

      .ez-brand-section-title {
        margin: 0 0 14px;
        font-size: 18px;
      }

      .ez-brand-help {
        color: #718a97;
        font-size: 12px;
        line-height: 1.8;
      }

      #ez-brand-toast {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 100000;
        padding: 13px 17px;
        border-radius: 13px;
        background: #173f55;
        color: #ffffff;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        transition: .2s ease;
      }

      #ez-brand-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width:1050px) {
        .ez-brand-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width:700px) {
        #brand-command-section {
          padding: 12px;
        }

        .ez-brand-header {
          display: block;
        }

        .ez-brand-actions {
          margin-top: 15px;
        }

        .ez-brand-form {
          grid-template-columns: 1fr;
        }

        .ez-brand-field.full {
          grid-column: auto;
        }

        .ez-brand-checks {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function ensureSection() {
    let section =
      document.querySelector(
        "#brand-command-section"
      );

    if (section) {
      return section;
    }

    const parent =
      document.querySelector(
        "main"
      ) ||
      document.body;

    section =
      document.createElement(
        "section"
      );

    section.id =
      "brand-command-section";

    section.hidden =
      true;

    parent.appendChild(
      section
    );

    return section;
  }

  function field(
    label,
    key,
    options = {}
  ) {
    const {
      full = false,
      type = "text",
      placeholder = "",
      help = ""
    } = options;

    const value =
      state.brand[key] ?? "";

    if (type === "textarea") {
      return `
        <div
          class="
            ez-brand-field
            ${full ? "full" : ""}
          "
        >

          <label>
            ${escapeHtml(label)}
          </label>

          <textarea
            class="ez-brand-textarea"
            data-brand-key="${escapeHtml(
              key
            )}"
            placeholder="${escapeHtml(
              placeholder
            )}"
          >${escapeHtml(
            value
          )}</textarea>

          ${
            help
              ? `
                <div class="ez-brand-help">
                  ${escapeHtml(
                    help
                  )}
                </div>
              `
              : ""
          }

        </div>
      `;
    }

    return `
      <div
        class="
          ez-brand-field
          ${full ? "full" : ""}
        "
      >

        <label>
          ${escapeHtml(label)}
        </label>

        <input
          class="ez-brand-input"
          type="${escapeHtml(type)}"
          data-brand-key="${escapeHtml(
            key
          )}"
          value="${escapeHtml(
            value
          )}"
          placeholder="${escapeHtml(
            placeholder
          )}"
        />

        ${
          help
            ? `
              <div class="ez-brand-help">
                ${escapeHtml(
                  help
                )}
              </div>
            `
            : ""
        }

      </div>
    `;
  }

  function colorField(
    label,
    key
  ) {
    const value =
      state.brand[key] ||
      "#ffffff";

    return `
      <div class="ez-brand-field">

        <label>
          ${escapeHtml(label)}
        </label>

        <div class="ez-brand-color">

          <input
            type="color"
            data-brand-color="${escapeHtml(
              key
            )}"
            value="${escapeHtml(
              value
            )}"
          />

          <input
            class="ez-brand-input"
            data-brand-key="${escapeHtml(
              key
            )}"
            value="${escapeHtml(
              value
            )}"
          />

        </div>

      </div>
    `;
  }

  function checkbox(
    label,
    key
  ) {
    return `
      <label class="ez-brand-check">

        <input
          type="checkbox"
          data-brand-check="${escapeHtml(
            key
          )}"
          ${
            state.brand[key]
              ? "checked"
              : ""
          }
        />

        <span>
          ${escapeHtml(label)}
        </span>

      </label>
    `;
  }

  function renderIdentity() {
    return `
      <h3
        class="ez-brand-section-title"
      >
        الهوية الأساسية
      </h3>

      <div class="ez-brand-form">

        ${field(
          "اسم المنصة",
          "platformName",
          {
            placeholder:
              "EZ MEDIA"
          }
        )}

        ${field(
          "الاسم المختصر",
          "shortName",
          {
            placeholder:
              "EZ"
          }
        )}

        ${field(
          "الاسم العربي",
          "arabicName"
        )}

        ${field(
          "الاسم الإنجليزي",
          "englishName"
        )}

        ${field(
          "العبارة التعريفية",
          "tagline",
          {
            full: true
          }
        )}

        ${field(
          "الوصف الرسمي",
          "description",
          {
            type:
              "textarea",
            full: true
          }
        )}

        ${field(
          "الموقع الرسمي",
          "website",
          {
            full: true,
            placeholder:
              "https://..."
          }
        )}

        ${field(
          "رابط الشعار",
          "logo",
          {
            full: true,
            placeholder:
              "https://..."
          }
        )}

        ${field(
          "رابط الأيقونة",
          "favicon",
          {
            full: true,
            placeholder:
              "https://..."
          }
        )}

      </div>
    `;
  }

  function renderVisual() {
    return `
      <h3
        class="ez-brand-section-title"
      >
        الهوية البصرية
      </h3>

      <div class="ez-brand-form">

        ${colorField(
          "اللون الرئيسي",
          "primaryColor"
        )}

        ${colorField(
          "اللون الثانوي",
          "secondaryColor"
        )}

        ${colorField(
          "لون الإبراز",
          "accentColor"
        )}

        ${colorField(
          "لون الخلفية",
          "backgroundColor"
        )}

        ${colorField(
          "لون النص",
          "textColor"
        )}

        ${colorField(
          "لون النص الثانوي",
          "mutedColor"
        )}

        ${field(
          "الخط",
          "fontFamily"
        )}

      </div>

      <div class="ez-brand-divider"></div>

      <h3
        class="ez-brand-section-title"
      >
        فلسفة الهوية
      </h3>

      <p class="ez-brand-help">
        يتم اعتماد هوية بصرية رقمية حديثة تعتمد
        على الأبيض والأزرق السماوي والجليدي،
        مع الحفاظ على وضوح القراءة وإمكانية
        استخدامها في الأخبار والبث والإعلانات
        والمحتوى الرقمي.
      </p>
    `;
  }

  function renderLabels() {
    return `
      <h3
        class="ez-brand-section-title"
      >
        مسميات المنصة
      </h3>

      <div class="ez-brand-form">

        ${field(
          "اسم قسم الأخبار",
          "newsLabel"
        )}

        ${field(
          "اسم الأخبار العاجلة",
          "breakingLabel"
        )}

        ${field(
          "اسم البث المباشر",
          "liveLabel"
        )}

        ${field(
          "اسم البث",
          "broadcastLabel"
        )}

        ${field(
          "اسم الذكاء الاصطناعي",
          "aiLabel"
        )}

        ${field(
          "اسم الإعلانات",
          "advertisingLabel"
        )}

        ${field(
          "اسم الرعاية",
          "sponsorshipLabel"
        )}

        ${field(
          "نص التذييل",
          "footerText",
          {
            full: true
          }
        )}

      </div>
    `;
  }

  function renderRegional() {
    return `
      <h3
        class="ez-brand-section-title"
      >
        إعدادات المنطقة واللغة
      </h3>

      <div class="ez-brand-form">

        ${field(
          "الدولة",
          "country",
          {
            placeholder:
              "SA"
          }
        )}

        ${field(
          "المنطقة الزمنية",
          "timezone",
          {
            placeholder:
              "Asia/Riyadh"
          }
        )}

        <div class="ez-brand-field">

          <label>
            اتجاه المنصة
          </label>

          <select
            class="ez-brand-select"
            data-brand-key="direction"
          >

            <option
              value="rtl"
              ${
                state.brand.direction ===
                "rtl"
                  ? "selected"
                  : ""
              }
            >
              من اليمين إلى اليسار
            </option>

            <option
              value="ltr"
              ${
                state.brand.direction ===
                "ltr"
                  ? "selected"
                  : ""
              }
            >
              من اليسار إلى اليمين
            </option>

          </select>

        </div>

        <div class="ez-brand-field">

          <label>
            اللغة الافتراضية
          </label>

          <select
            class="ez-brand-select"
            data-brand-key="defaultLanguage"
          >

            <option
              value="ar"
              ${
                state.brand.defaultLanguage ===
                "ar"
                  ? "selected"
                  : ""
              }
            >
              العربية
            </option>

            <option
              value="en"
              ${
                state.brand.defaultLanguage ===
                "en"
                  ? "selected"
                  : ""
              }
            >
              English
            </option>

          </select>

        </div>

        <div class="ez-brand-field full">

          <div class="ez-brand-checks">

            ${checkbox(
              "إظهار العربية أولًا",
              "showArabicFirst"
            )}

            ${checkbox(
              "تفعيل العلامة المائية",
              "showWatermark"
            )}

          </div>

        </div>

      </div>
    `;
  }

  function renderModules() {
    return `
      <h3
        class="ez-brand-section-title"
      >
        هوية الوحدات الرئيسية
      </h3>

      <p class="ez-brand-help">
        تحكم في ظهور الوحدات الأساسية
        التي تعتمد على هوية EZ MEDIA.
      </p>

      <div class="ez-brand-checks">

        ${checkbox(
          "تفعيل البث المباشر",
          "liveEnabled"
        )}

        ${checkbox(
          "تفعيل الأخبار العاجلة",
          "breakingEnabled"
        )}

        ${checkbox(
          "تفعيل الذكاء الاصطناعي",
          "aiEnabled"
        )}

        ${checkbox(
          "تفعيل الإعلانات",
          "advertisingEnabled"
        )}

        ${checkbox(
          "تفعيل الرعايات",
          "sponsorshipEnabled"
        )}

        ${checkbox(
          "إظهار العلامة المائية",
          "showWatermark"
        )}

        ${checkbox(
          "إظهار Powered By",
          "showPoweredBy"
        )}

        ${checkbox(
          "تفعيل الشبكات الاجتماعية",
          "socialEnabled"
        )}

      </div>
    `;
  }

  function renderActiveTab() {
    switch (
      state.activeTab
    ) {
      case "visual":
        return renderVisual();

      case "labels":
        return renderLabels();

      case "regional":
        return renderRegional();

      case "modules":
        return renderModules();

      default:
        return renderIdentity();
    }
  }

  function renderPreview() {
    const brand =
      state.brand;

    const logo =
      brand.logo
        ? `
          <img
            src="${escapeHtml(
              brand.logo
            )}"
            alt="${escapeHtml(
              brand.platformName
            )}"
            onerror="
              this.style.display='none';
            "
          />
        `
        : escapeHtml(
            brand.shortName ||
              "EZ"
          );

    return `
      <div
        class="ez-brand-preview-card"
        style="
          --ez-brand-primary:
            ${escapeHtml(
              brand.primaryColor
            )};
          --ez-brand-accent:
            ${escapeHtml(
              brand.accentColor
            )};
        "
      >

        <div
          class="ez-brand-preview-top"
        >

          <div
            class="ez-brand-logo-box"
          >
            ${logo}
          </div>

          <div
            class="
              ez-brand-preview-title
            "
          >
            ${escapeHtml(
              brand.platformName
            )}
          </div>

          <div
            class="
              ez-brand-preview-subtitle
            "
          >
            ${escapeHtml(
              brand.tagline
            )}
          </div>

        </div>

        <div
          class="ez-brand-preview-body"
          style="
            background:
              ${escapeHtml(
                brand.backgroundColor
              )};
            color:
              ${escapeHtml(
                brand.textColor
              )};
          "
        >

          <div
            class="
              ez-brand-preview-item
            "
          >

            <strong
              style="
                color:
                  ${escapeHtml(
                    brand.primaryColor
                  )};
              "
            >
              ${escapeHtml(
                brand.breakingLabel
              )}
            </strong>

            عاجل — عنوان الخبر يظهر
            هنا بطريقة واضحة ومباشرة.
          </div>

          <div
            class="
              ez-brand-preview-item
            "
          >

            <strong
              style="
                color:
                  ${escapeHtml(
                    brand.primaryColor
                  )};
              "
            >
              ${escapeHtml(
                brand.liveLabel
              )}
            </strong>

            بث مباشر — المصدر الرئيسي
            للمنصة.
          </div>

          <div
            class="
              ez-brand-preview-item
            "
          >

            <strong
              style="
                color:
                  ${escapeHtml(
                    brand.primaryColor
                  )};
              "
            >
              ${escapeHtml(
                brand.aiLabel
              )}
            </strong>

            تحليل ذكي ومساعدة تحريرية
            للمحتوى.
          </div>

          <div
            class="ez-brand-color-list"
          >

            <div
              class="ez-brand-swatch"
              style="
                background:
                  ${escapeHtml(
                    brand.primaryColor
                  )};
                color:#fff;
              "
            >
              الرئيسي
            </div>

            <div
              class="ez-brand-swatch"
              style="
                background:
                  ${escapeHtml(
                    brand.secondaryColor
                  )};
                color:
                  ${escapeHtml(
                    brand.textColor
                  )};
              "
            >
              الثانوي
            </div>

            <div
              class="ez-brand-swatch"
              style="
                background:
                  ${escapeHtml(
                    brand.accentColor
                  )};
                color:
                  ${escapeHtml(
                    brand.textColor
                  )};
              "
            >
              الإبراز
            </div>

            <div
              class="ez-brand-swatch"
              style="
                background:
                  ${escapeHtml(
                    brand.backgroundColor
                  )};
                color:
                  ${escapeHtml(
                    brand.textColor
                  )};
                border:1px solid #e1edf1;
              "
            >
              الخلفية
            </div>

          </div>

          <div
            class="ez-brand-status"
          >

            حالة الهوية:
            <strong>
              ${
                state.dirty
                  ? "توجد تعديلات غير محفوظة"
                  : "متزامنة"
              }
            </strong>

          </div>

        </div>

      </div>

      <div
        class="ez-brand-help"
        style="
          margin-top:12px;
        "
      >
        آخر تحديث:
        ${
          brand.updatedAt
            ? escapeHtml(
                new Date(
                  brand.updatedAt
                ).toLocaleString(
                  "ar-SA"
                )
              )
            : "لم يتم الحفظ بعد"
        }
      </div>
    `;
  }

  function render() {
    const section =
      ensureSection();

    section.innerHTML = `
      <div class="ez-brand-shell">

        <div
          class="ez-brand-header"
        >

          <div>

            <h2>
              مركز الهوية والهوية البصرية
            </h2>

            <p>
              التحكم المركزي في هوية EZ MEDIA
              عبر الأخبار والبث والمحتوى والإعلانات.
            </p>

          </div>

          <div
            class="ez-brand-actions"
          >

            <button
              class="ez-brand-btn"
              data-brand-action="reset"
            >
              إعادة الافتراضي
            </button>

            <button
              class="
                ez-brand-btn
                primary
              "
              data-brand-action="save"
            >
              حفظ الهوية
            </button>

          </div>

        </div>

        <div class="ez-brand-layout">

          <div
            class="ez-brand-panel"
          >

            <div
              class="ez-brand-tabs"
            >

              ${tab(
                "identity",
                "الهوية"
              )}

              ${tab(
                "visual",
                "الألوان"
              )}

              ${tab(
                "labels",
                "المسميات"
              )}

              ${tab(
                "regional",
                "اللغة والمنطقة"
              )}

              ${tab(
                "modules",
                "الوحدات"
              )}

            </div>

            <div
              class="ez-brand-content"
            >
              ${renderActiveTab()}
            </div>

          </div>

          <div
            class="ez-brand-panel"
          >

            <div
              class="ez-brand-content"
            >

              <h3
                class="
                  ez-brand-section-title
                "
              >
                المعاينة الحية
              </h3>

              <p
                class="ez-brand-help"
              >
                المعاينة تتغير مباشرة مع إعدادات
                الهوية قبل حفظها.
              </p>

            </div>

            <div
              class="ez-brand-preview"
            >
              ${renderPreview()}
            </div>

          </div>

        </div>

      </div>
    `;

    bindEvents();
  }

  function tab(
    key,
    label
  ) {
    return `
      <button
        class="
          ez-brand-tab
          ${
            state.activeTab ===
            key
              ? "active"
              : ""
          }
        "
        data-brand-tab="${escapeHtml(
          key
        )}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  function updateValue(
    key,
    value
  ) {
    state.brand[key] =
      value;

    state.dirty =
      true;

    /*
     * المعاينة فورية.
     */
    render();
  }

  function updateCheckbox(
    key,
    value
  ) {
    state.brand[key] =
      Boolean(value);

    state.dirty =
      true;

    render();
  }

  function bindEvents() {
    const section =
      document.querySelector(
        "#brand-command-section"
      );

    if (!section) {
      return;
    }

    section
      .querySelectorAll(
        "[data-brand-tab]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              state.activeTab =
                button.dataset
                  .brandTab;

              render();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-brand-action]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const action =
                button.dataset
                  .brandAction;

              if (
                action ===
                "save"
              ) {
                save();
                return;
              }

              if (
                action ===
                "reset"
              ) {
                reset();
              }
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-brand-key]"
      )
      .forEach(
        (input) => {
          input.addEventListener(
            "input",
            (event) => {
              const key =
                input.dataset
                  .brandKey;

              state.brand[key] =
                event.target.value;

              state.dirty =
                true;

              applyPreviewOnly();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-brand-color]"
      )
      .forEach(
        (input) => {
          input.addEventListener(
            "input",
            (event) => {
              const key =
                input.dataset
                  .brandColor;

              state.brand[key] =
                event.target.value;

              state.dirty =
                true;

              const text =
                section.querySelector(
                  `[data-brand-key="${key}"]`
                );

              if (text) {
                text.value =
                  event.target.value;
              }

              applyPreviewOnly();
            }
          );
        }
      );

    section
      .querySelectorAll(
        "[data-brand-check]"
      )
      .forEach(
        (input) => {
          input.addEventListener(
            "change",
            (event) => {
              const key =
                input.dataset
                  .brandCheck;

              updateCheckbox(
                key,
                event.target.checked
              );
            }
          );
        }
      );
  }

  function applyPreviewOnly() {
    const root =
      document.querySelector(
        "#brand-command-section"
      );

    if (!root) {
      return;
    }

    root.style.setProperty(
      "--ez-brand-primary",
      state.brand
        .primaryColor
    );

    root.style.setProperty(
      "--ez-brand-accent",
      state.brand
        .accentColor
    );

    /*
     * تحديث المعاينة دون إعادة بناء
     * الحقول أثناء الكتابة.
     */

    const preview =
      root.querySelector(
        ".ez-brand-preview"
      );

    if (!preview) {
      return;
    }

    const primary =
      state.brand
        .primaryColor;

    const accent =
      state.brand
        .accentColor;

    preview
      .querySelectorAll(
        ".ez-brand-preview-top"
      )
      .forEach(
        (element) => {
          element.style.background =
            `linear-gradient(
              135deg,
              ${primary},
              ${accent}
            )`;
        }
      );

    preview
      .querySelectorAll(
        ".ez-brand-preview-title"
      )
      .forEach(
        (element) => {
          element.textContent =
            state.brand
              .platformName;
        }
      );

    preview
      .querySelectorAll(
        ".ez-brand-preview-subtitle"
      )
      .forEach(
        (element) => {
          element.textContent =
            state.brand
              .tagline;
        }
      );
  }

  function applyBrandToPage() {
    const brand =
      state.brand;

    document.documentElement
      .style.setProperty(
        "--ez-media-primary",
        brand.primaryColor
      );

    document.documentElement
      .style.setProperty(
        "--ez-media-secondary",
        brand.secondaryColor
      );

    document.documentElement
      .style.setProperty(
        "--ez-media-accent",
        brand.accentColor
      );

    document.documentElement
      .style.setProperty(
        "--ez-media-background",
        brand.backgroundColor
      );

    document.documentElement
      .style.setProperty(
        "--ez-media-text",
        brand.textColor
      );

    document.documentElement
      .style.setProperty(
        "--ez-media-muted",
        brand.mutedColor
      );

    if (
      brand.fontFamily
    ) {
      document.documentElement
        .style.setProperty(
          "--ez-media-font",
          brand.fontFamily
        );
    }

    const title =
      document.querySelector(
        "title"
      );

    if (title) {
      title.textContent =
        brand.platformName;
    }

    document.documentElement
      .setAttribute(
        "dir",
        brand.direction ||
          "rtl"
      );

    document.documentElement
      .setAttribute(
        "lang",
        brand.defaultLanguage ||
          "ar"
      );

    window.dispatchEvent(
      new CustomEvent(
        "ezmedia:brand:apply",
        {
          detail: {
            brand:
              clone(brand)
          }
        }
      )
    );
  }

  function show() {
    const section =
      ensureSection();

    section.hidden =
      false;

    load();

    injectStyles();

    render();

    applyBrandToPage();
  }

  function hide() {
    const section =
      document.querySelector(
        "#brand-command-section"
      );

    if (section) {
      section.hidden =
        true;
    }
  }

  function getBrand() {
    return clone(
      state.brand
    );
  }

  function update(
    values = {}
  ) {
    state.brand = {
      ...state.brand,
      ...values,
      updatedAt:
        new Date().toISOString()
    };

    state.dirty =
      true;

    render();

    return getBrand();
  }

  function resetToDefaults() {
    state.brand =
      clone(
        DEFAULT_BRAND
      );

    state.dirty =
      true;

    render();

    return getBrand();
  }

  window.EZMediaAdminBrandCommand =
    {
      module: MODULE,
      show,
      hide,
      save,
      reset:
        resetToDefaults,
      getBrand,
      update,
      apply:
        applyBrandToPage
    };

  window.addEventListener(
    "ezmedia:brand:refresh",
    () => {
      load();
      render();
      applyBrandToPage();
    }
  );

  window.addEventListener(
    "ezmedia:admin:navigate",
    (event) => {
      const section =
        event.detail?.section ||
        event.detail?.target;

      if (
        section ===
          "brand-command" ||
        section ===
          "brand" ||
        section ===
          "identity"
      ) {
        show();
      }
    }
  );

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        injectStyles();
        ensureSection();
        load();
        applyBrandToPage();
      },
      {
        once: true
      }
    );
  } else {
    injectStyles();
    ensureSection();
    load();
    applyBrandToPage();
  }

  console.info(
    "EZ MEDIA 11.0 — Brand Command loaded."
  );
})();
