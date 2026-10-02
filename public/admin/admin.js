const state = {
  system: null,
  content: []
};


const sectionNames = {

  dashboard: [
    "الرئيسية",
    "مركز التحكم الموحد في EZ MEDIA"
  ],

  content: [
    "المحتوى",
    "إدارة الأخبار والتقارير والتغطيات"
  ],

  media: [
    "مكتبة الوسائط",
    "إدارة الصور والفيديو والصوت والملفات"
  ],

  automation: [
    "الأتمتة",
    "تشغيل العمليات الإعلامية تلقائيًا"
  ],

  ai: [
    "الذكاء الاصطناعي",
    "مركز مهام الذكاء الاصطناعي"
  ],

  live: [
    "البث المباشر",
    "إدارة البث والتوزيع"
  ],

  social: [
    "منصاتي",
    "إدارة منصات التواصل"
  ],

  advertising: [
    "الإعلانات",
    "إدارة الحملات والمساحات الإعلانية"
  ],

  sponsorship: [
    "الرعاية",
    "إدارة الرعاة والشراكات"
  ],

  analytics: [
    "التحليلات",
    "قياس أداء المنصة والمحتوى"
  ],

  users: [
    "المستخدمون",
    "المستخدمون والصلاحيات"
  ],

  settings: [
    "الإعدادات",
    "إعدادات EZ MEDIA"
  ]

};


/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

async function api(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {
        headers: {
          "Content-Type":
            "application/json"
        },

        ...options
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error ||
      "API Error"
    );

  }


  return data;

}


/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

function openSection(
  section
) {

  document
    .querySelectorAll(".section")
    .forEach(
      element => {

        element.classList.toggle(
          "active",
          element.id === section
        );

      }
    );


  document
    .querySelectorAll(".nav-item")
    .forEach(
      element => {

        element.classList.toggle(
          "active",
          element.dataset.section === section
        );

      }
    );


  const info =
    sectionNames[section];


  if (info) {

    document
      .getElementById(
        "pageTitle"
      )
      .textContent =
      info[0];


    document
      .getElementById(
        "pageDescription"
      )
      .textContent =
      info[1];

  }


  if (section === "content") {

    loadContent();

  }

}


/*
|--------------------------------------------------------------------------
| Navigation events
|--------------------------------------------------------------------------
*/

document.addEventListener(
  "click",
  event => {

    const target =
      event.target.closest(
        "[data-section]"
      );


    if (!target) {
      return;
    }


    openSection(
      target.dataset.section
    );

  }
);


/*
|--------------------------------------------------------------------------
| Mobile menu
|--------------------------------------------------------------------------
*/

document
  .getElementById("menuButton")
  .addEventListener(
    "click",
    () => {

      document
        .querySelector(".sidebar")
        .classList.toggle("open");

    }
  );


/*
|--------------------------------------------------------------------------
| System
|--------------------------------------------------------------------------
*/

async function loadSystem() {

  try {

    const data =
      await api(
        "/api/system"
      );


    state.system =
      data;


    const database =
      data.database;


    document
      .getElementById(
        "environment"
      )
      .textContent =
      data.environment;


    document
      .getElementById(
        "settingsEnvironment"
      )
      .textContent =
      data.environment;


    document
      .getElementById(
        "settingsDatabase"
      )
      .textContent =
      database;


    document
      .getElementById(
        "sidebarStatus"
      )
      .textContent =
      database === "connected"
        ? "الخادم وقاعدة البيانات يعملان"
        : "الخادم يعمل";


    document
      .getElementById(
        "systemBadge"
      )
      .textContent =
      database === "connected"
        ? "متصل"
        : "الخادم يعمل";


    const modules =
      document.getElementById(
        "systemModules"
      );


    modules.innerHTML =
      Object.entries(
        data.modules || {}
      )
      .map(
        ([name, status]) => `

          <div class="module">

            <strong>
              ${name}
            </strong>

            <span>
              ${status}
            </span>

          </div>

        `
      )
      .join("");


  } catch (error) {

    console.error(error);


    document
      .getElementById(
        "sidebarStatus"
      )
      .textContent =
      "تعذر الاتصال بالـ API";

  }

}


/*
|--------------------------------------------------------------------------
| Content
|--------------------------------------------------------------------------
*/

async function loadContent() {

  try {

    const data =
      await api(
        "/api/content?limit=50"
      );


    state.content =
      data.data || [];


    document
      .getElementById(
        "contentCount"
      )
      .textContent =
      data.count || 0;


    renderContent(
      "latestContent",
      state.content.slice(0, 8)
    );


    renderContent(
      "contentList",
      state.content
    );


  } catch (error) {

    console.error(error);


    document
      .getElementById(
        "latestContent"
      )
      .textContent =
      "تعذر تحميل المحتوى";


    document
      .getElementById(
        "contentList"
      )
      .textContent =
      "تعذر تحميل المحتوى";

  }

}


/*
|--------------------------------------------------------------------------
| Render content
|--------------------------------------------------------------------------
*/

function renderContent(
  elementId,
  items
) {

  const element =
    document.getElementById(
      elementId
    );


  if (!items.length) {

    element.innerHTML = `

      <div class="empty-state">

        <div>📰</div>

        <h3>
          لا يوجد محتوى حتى الآن
        </h3>

        <p>
          يمكنك إضافة أول محتوى من لوحة الإدارة.
        </p>

      </div>

    `;

    return;

  }


  element.innerHTML = `

    <div class="content-row header">

      <div>العنوان</div>

      <div>النوع</div>

      <div>الحالة</div>

      <div>التاريخ</div>

    </div>

    ${
      items
        .map(
          item => `

            <div class="content-row">

              <div class="content-title">
                ${escapeHtml(
                  item.title || "بدون عنوان"
                )}
              </div>

              <div>
                ${escapeHtml(
                  item.content_type || "-"
                )}
              </div>

              <div>
                ${escapeHtml(
                  item.status || "-"
                )}
              </div>

              <div>
                ${
                  item.created_at
                    ? new Date(
                        item.created_at
                      ).toLocaleDateString(
                        "ar-SA"
                      )
                    : "-"
                }
              </div>

            </div>

          `
        )
        .join("")
    }

  `;

}


/*
|--------------------------------------------------------------------------
| Escape HTML
|--------------------------------------------------------------------------
*/

function escapeHtml(
  value
) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/*
|--------------------------------------------------------------------------
| Refresh
|--------------------------------------------------------------------------
*/

document
  .getElementById(
    "refreshButton"
  )
  .addEventListener(
    "click",
    async () => {

      await loadSystem();

      await loadContent();

    }
  );


/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

async function start() {

  await loadSystem();

  await loadContent();

}


start();
