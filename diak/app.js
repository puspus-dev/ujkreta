
const API_BASE = "https://ujkreta.onrender.com";


/* ============================================================
   STATE
   ============================================================ */

const state = {
  student: null,
  classGroups: [],
  grades: [],
  averages: [],
  lessons: [],
  omissions: [],
  homework: [],
  tests: [],
  notices: [],
  infoBoard: [],
  dktSubjects: [],

  currentPage: "home",

  loaded: {
    student: false,
    classGroups: false,
    grades: false,
    averages: false,
    lessons: false,
    omissions: false,
    homework: false,
    tests: false,
    notices: false,
    infoBoard: false,
    dktSubjects: false
  }
};


/* ============================================================
   API
   ============================================================ */

async function apiFetch(path) {

  const response = await fetch(API_BASE + path, {
    method: "GET",

    headers: {
      "Accept": "application/json"
    },

    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(
      `API hiba: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}


/* ============================================================
   API LOADERS
   ============================================================ */

async function loadStudent() {
  state.student = await apiFetch(
    "/ellenorzo/v3/sajat/TanuloAdatlap"
  );

  state.loaded.student = true;
}


async function loadClassGroups() {
  state.classGroups = await apiFetch(
    "/ellenorzo/v3/sajat/OsztalyCsoportok"
  );

  state.loaded.classGroups = true;
}


async function loadGrades() {
  state.grades = await apiFetch(
    "/ellenorzo/v3/sajat/Ertekelesek"
  );

  state.loaded.grades = true;
}


async function loadAverages() {
  state.averages = await apiFetch(
    "/ellenorzo/v3/sajat/Ertekelesek/Atlagok/OsztalyAtlagok"
  );

  state.loaded.averages = true;
}


async function loadLessons() {
  state.lessons = await apiFetch(
    "/ellenorzo/v3/sajat/OrarendElemek"
  );

  state.loaded.lessons = true;
}


async function loadOmissions() {
  state.omissions = await apiFetch(
    "/ellenorzo/v3/sajat/Mulasztasok"
  );

  state.loaded.omissions = true;
}


async function loadHomework() {
  state.homework = await apiFetch(
    "/ellenorzo/v3/sajat/HaziFeladatok"
  );

  state.loaded.homework = true;
}


async function loadTests() {
  state.tests = await apiFetch(
    "/ellenorzo/v3/sajat/BejelentettSzamonkeresek"
  );

  state.loaded.tests = true;
}


async function loadNotices() {
  state.notices = await apiFetch(
    "/ellenorzo/v3/sajat/FaliujsagElemek"
  );

  state.loaded.notices = true;
}


async function loadInfoBoard() {
  state.infoBoard = await apiFetch(
    "/ellenorzo/v3/sajat/Feljegyzesek"
  );

  state.loaded.infoBoard = true;
}


async function loadDktSubjects() {
  state.dktSubjects = await apiFetch(
    "/dktapi/intezmenyek/munkaterek/tanulok"
  );

  state.loaded.dktSubjects = true;
}


/* ============================================================
   HELPERS
   ============================================================ */

function escapeHTML(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function safeDate(value) {

  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("hu-HU");
}


function safeDateTime(value) {

  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("hu-HU");
}


function initials(name) {

  if (!name) {
    return "?";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase();
}


function gradeClass(value) {

  const number = Number(value);

  if (number >= 5) return "grade-5";
  if (number >= 4) return "grade-4";
  if (number >= 3) return "grade-3";

  return "grade-1";
}


function subjectName(item) {

  return (
    item?.Tantargy?.Nev ||
    item?.TantargyNeve ||
    item?.Nev ||
    "Ismeretlen tantárgy"
  );
}


function sortByDateDescending(items, field) {

  return [...items].sort((a, b) => {

    const da = new Date(a?.[field] || 0).getTime();
    const db = new Date(b?.[field] || 0).getTime();

    return db - da;
  });
}


function average(numbers) {

  const values = numbers
    .map(Number)
    .filter(x => Number.isFinite(x));

  if (!values.length) {
    return null;
  }

  return (
    values.reduce((a, b) => a + b, 0) /
    values.length
  );
}


function showToast(message) {

  const toast = document.getElementById("toast");

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}


/* ============================================================
   PAGE METADATA
   ============================================================ */

const pageMeta = {

  home: {
    title: "Kezdőlap",
    subtitle: "Áttekintés"
  },

  timetable: {
    title: "Órarend",
    subtitle: "Az óráid és a napi programod"
  },

  grades: {
    title: "Jegyek",
    subtitle: "Értékelések és osztályzatok"
  },

  averages: {
    title: "Átlagok",
    subtitle: "Tantárgyi és osztályátlagok"
  },

  omissions: {
    title: "Mulasztások",
    subtitle: "Hiányzások és késések"
  },

  homework: {
    title: "Házi feladatok",
    subtitle: "Feladatok és határidők"
  },

  tests: {
    title: "Dolgozatok",
    subtitle: "Bejelentett számonkérések"
  },

  notices: {
    title: "Faliújság",
    subtitle: "Iskolai közlemények"
  },

  info: {
    title: "Feljegyzések",
    subtitle: "Tanári feljegyzések"
  },

  dkt: {
    title: "DKT",
    subtitle: "Digitális tananyagok"
  },

  profile: {
    title: "Profil",
    subtitle: "Tanulói adatok"
  }
};


/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {

  document.querySelectorAll(".nav-item[data-page]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const page = button.dataset.page;

        navigate(page);
      });
    });


  document
    .getElementById("profileButton")
    .addEventListener("click", () => {

      navigate("profile");
    });


  document
    .getElementById("logoutButton")
    .addEventListener("click", logout);


  document
    .getElementById("refreshButton")
    .addEventListener("click", async () => {

      await refreshCurrentPage();
    });


  document
    .getElementById("menuButton")
    .addEventListener("click", toggleSidebar);


  document
    .getElementById("sidebarOverlay")
    .addEventListener("click", closeSidebar);
}


function navigate(page) {

  state.currentPage = page;

  updateNavigation();

  updatePageHeader();

  closeSidebar();

  renderPage();
}


function updateNavigation() {

  document.querySelectorAll(
    ".nav-item[data-page]"
  ).forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === state.currentPage
    );
  });
}


function updatePageHeader() {

  const meta =
    pageMeta[state.currentPage] ||
    pageMeta.home;

  document.getElementById("pageTitle").textContent =
    meta.title;

  document.getElementById("pageSubtitle").textContent =
    meta.subtitle;
}


function toggleSidebar() {

  document
    .getElementById("sidebar")
    .classList.toggle("open");

  document
    .getElementById("sidebarOverlay")
    .classList.toggle("show");
}


function closeSidebar() {

  document
    .getElementById("sidebar")
    .classList.remove("open");

  document
    .getElementById("sidebarOverlay")
    .classList.remove("show");
}


/* ============================================================
   LOAD PAGE DATA
   ============================================================ */

async function ensurePageData(page) {

  switch (page) {

    case "home":
      await Promise.allSettled([
        loadStudent(),
        loadLessons(),
        loadGrades(),
        loadHomework(),
        loadTests()
      ]);
      break;

    case "timetable":
      if (!state.loaded.lessons) {
        await loadLessons();
      }
      break;

    case "grades":
      if (!state.loaded.grades) {
        await loadGrades();
      }
      break;

    case "averages":
      await Promise.allSettled([
        state.loaded.grades
          ? Promise.resolve()
          : loadGrades(),

        state.loaded.averages
          ? Promise.resolve()
          : loadAverages()
      ]);
      break;

    case "omissions":
      if (!state.loaded.omissions) {
        await loadOmissions();
      }
      break;

    case "homework":
      if (!state.loaded.homework) {
        await loadHomework();
      }
      break;

    case "tests":
      if (!state.loaded.tests) {
        await loadTests();
      }
      break;

    case "notices":
      if (!state.loaded.notices) {
        await loadNotices();
      }
      break;

    case "info":
      if (!state.loaded.infoBoard) {
        await loadInfoBoard();
      }
      break;

    case "dkt":
      if (!state.loaded.dktSubjects) {
        await loadDktSubjects();
      }
      break;

    case "profile":
      if (!state.loaded.student) {
        await loadStudent();
      }
      break;
  }
}


/* ============================================================
   RENDER
   ============================================================ */

async function renderPage() {

  const content =
    document.getElementById("content");

  content.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Adatok betöltése...</p>
    </div>
  `;

  try {

    await ensurePageData(
      state.currentPage
    );

    switch (state.currentPage) {

      case "home":
        renderHome();
        break;

      case "timetable":
        renderTimetable();
        break;

      case "grades":
        renderGrades();
        break;

      case "averages":
        renderAverages();
        break;

      case "omissions":
        renderOmissions();
        break;

      case "homework":
        renderHomework();
        break;

      case "tests":
        renderTests();
        break;

      case "notices":
        renderNotices();
        break;

      case "info":
        renderInfoBoard();
        break;

      case "dkt":
        renderDKT();
        break;

      case "profile":
        renderProfile();
        break;

      default:
        renderHome();
    }

  } catch (error) {

    console.error(error);

    content.innerHTML = `
      <div class="error-card">
        <h2>Nem sikerült betölteni az adatokat</h2>
        <p>
          Ellenőrizd a kapcsolatot a backenddel,
          majd próbáld újra.
        </p>
        <button
          class="select"
          style="margin-top:15px"
          onclick="refreshCurrentPage()"
        >
          Újrapróbálás
        </button>
      </div>
    `;
  }
}


/* ============================================================
   HOME
   ============================================================ */

function renderHome() {

  const student = state.student || {};

  const grades = state.grades || [];
  const homework = state.homework || [];
  const tests = state.tests || [];
  const lessons = state.lessons || [];

  const numericGrades = grades
    .map(x => x.SzamErtek)
    .filter(x => Number(x) > 0);

  const avg = average(numericGrades);

  const upcomingHomework =
    sortByDateDescending(
      homework,
      "HataridoDatuma"
    ).slice(0, 5);

  const upcomingTests =
    [...tests]
      .sort((a, b) =>
        new Date(a.Datum || 0) -
        new Date(b.Datum || 0)
      )
      .slice(0, 5);

  const todayLessons =
    lessons.filter(x =>
      isToday(x.Datum)
    );

  document.getElementById("avatar").textContent =
    initials(student.Nev);


  document.getElementById("content").innerHTML = `

    <div class="card welcome-card">
      <h2>
        Szia, ${escapeHTML(student.Nev || "Diák")}!
      </h2>

      <p>
        Itt láthatod a legfontosabb iskolai információidat.
      </p>
    </div>

    <div style="height:18px"></div>

    <div class="grid grid-4">

      <div class="card stat-card">
        <div class="stat-icon">✓</div>

        <div>
          <div class="stat-label">Jegyek</div>
          <div class="stat-value">
            ${grades.length}
          </div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon">◉</div>

        <div>
          <div class="stat-label">Átlag</div>
          <div class="stat-value">
            ${avg === null ? "–" : avg.toFixed(2)}
          </div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon">▤</div>

        <div>
          <div class="stat-label">Házi feladat</div>
          <div class="stat-value">
            ${homework.filter(x => !x.IsMegoldva).length}
          </div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon">✎</div>

        <div>
          <div class="stat-label">Dolgozat</div>
          <div class="stat-value">
            ${upcomingTests.length}
          </div>
        </div>
      </div>

    </div>

    <div style="height:18px"></div>

    <div class="grid grid-2">

      <div class="card">

        <div class="page-header">
          <div>
            <h2>Mai órák</h2>
            <p>${todayLessons.length} óra</p>
          </div>

          <button
            class="select"
            onclick="navigate('timetable')"
          >
            Teljes órarend
          </button>
        </div>

        ${renderLessonList(todayLessons.slice(0, 5))}

      </div>


      <div class="card">

        <div class="page-header">
          <div>
            <h2>Közelgő dolgozatok</h2>
            <p>Bejelentett számonkérések</p>
          </div>
        </div>

        ${renderTestList(upcomingTests)}

      </div>

    </div>

    <div style="height:18px"></div>

    <div class="card">

      <div class="page-header">
        <div>
          <h2>Házi feladatok</h2>
          <p>Aktuális feladatok</p>
        </div>

        <button
          class="select"
          onclick="navigate('homework')"
        >
          Összes
        </button>
      </div>

      ${renderHomeworkList(upcomingHomework)}

    </div>
  `;
}


/* ============================================================
   TIMETABLE
   ============================================================ */

function renderTimetable() {

  const lessons =
    [...state.lessons]
      .sort((a, b) =>
        new Date(a.Datum || 0) -
        new Date(b.Datum || 0)
      );

  const grouped = {};

  lessons.forEach(lesson => {

    const date =
      lesson.Datum?.slice(0, 10) ||
      "Ismeretlen";

    if (!grouped[date]) {
      grouped[date] = [];
    }

    grouped[date].push(lesson);
  });


  let html = "";

  Object.entries(grouped)
    .forEach(([date, dayLessons]) => {

      html += `
        <div class="card" style="margin-bottom:18px">

          <div class="page-header">

            <div>
              <h2>
                ${formatDay(date)}
              </h2>

              <p>
                ${dayLessons.length} óra
              </p>
            </div>

          </div>

          <div class="timetable">
            ${renderLessonList(dayLessons)}
          </div>

        </div>
      `;
    });


  if (!html) {
    html = emptyState(
      "▦",
      "Nincs órarendi adat",
      "Jelenleg nem található megjeleníthető óra."
    );
  }

  document.getElementById("content").innerHTML = html;
}


/* ============================================================
   GRADES
   ============================================================ */

function renderGrades() {

  const grades =
    sortByDateDescending(
      state.grades,
      "RogzitesDatuma"
    );


  const grouped = {};

  grades.forEach(grade => {

    const subject =
      subjectName(grade);

    if (!grouped[subject]) {
      grouped[subject] = [];
    }

    grouped[subject].push(grade);
  });


  let rows = "";

  Object.entries(grouped)
    .forEach(([subject, items]) => {

      const values =
        items
          .map(x => Number(x.SzamErtek))
          .filter(x => x > 0);

      const avg = average(values);

      rows += `
        <tr>

          <td>
            <strong>
              ${escapeHTML(subject)}
            </strong>
          </td>

          <td>
            ${items.map(item => `
              <span
                class="grade ${gradeClass(item.SzamErtek)}"
                style="
                  display:inline-flex;
                  width:34px;
                  height:34px;
                  margin-right:5px;
                "
              >
                ${escapeHTML(
                  item.SzamErtek ||
                  item.SzovegesErtek ||
                  "–"
                )}
              </span>
            `).join("")}
          </td>

          <td>
            ${
              avg === null
                ? "–"
                : avg.toFixed(2)
            }
          </td>

        </tr>
      `;
    });


  document.getElementById("content").innerHTML = `

    <div class="page-header">
      <div>
        <h2>Jegyek</h2>
        <p>
          ${grades.length} értékelés
        </p>
      </div>
    </div>

    <div class="card">

      ${
        rows
          ? `
            <div class="table-wrapper">
              <table class="table">

                <thead>
                  <tr>
                    <th>Tantárgy</th>
                    <th>Értékelések</th>
                    <th>Átlag</th>
                  </tr>
                </thead>

                <tbody>
                  ${rows}
                </tbody>

              </table>
            </div>
          `
          : emptyState(
              "✓",
              "Nincs jegy",
              "Még nincs megjeleníthető értékelés."
            )
      }

    </div>
  `;
}


/* ============================================================
   AVERAGES
   ============================================================ */

function renderAverages() {

  const items = state.averages || [];

  const rows = items.map(item => {

    const studentAverage =
      Number(item.TanuloAtlag);

    const classAverage =
      Number(item.OsztalyCsoportAtlag);

    return `
      <tr>

        <td>
          <strong>
            ${escapeHTML(
              subjectName(item)
            )}
          </strong>
        </td>

        <td>
          ${
            Number.isFinite(studentAverage) &&
            studentAverage > 0
              ? studentAverage.toFixed(2)
              : "–"
          }
        </td>

        <td>
          ${
            Number.isFinite(classAverage) &&
            classAverage > 0
              ? classAverage.toFixed(2)
              : "–"
          }
        </td>

      </tr>
    `;
  }).join("");


  document.getElementById("content").innerHTML = `

    <div class="page-header">
      <div>
        <h2>Átlagok</h2>
        <p>
          Tantárgyi és osztályátlagok
        </p>
      </div>
    </div>

    <div class="card">

      ${
        rows
          ? `
            <div class="table-wrapper">

              <table class="table">

                <thead>
                  <tr>
                    <th>Tantárgy</th>
                    <th>Saját átlag</th>
                    <th>Osztályátlag</th>
                  </tr>
                </thead>

                <tbody>
                  ${rows}
                </tbody>

              </table>

            </div>
          `
          : emptyState(
              "◉",
              "Nincs átlagadat",
              "Az átlagok jelenleg nem érhetők el."
            )
      }

    </div>
  `;
}


/* ============================================================
   OMISSIONS
   ============================================================ */

function renderOmissions() {

  const items = state.omissions || [];

  const justified =
    items.filter(
      x =>
        String(x.IgazolasAllapota || "")
          .toLowerCase()
          .includes("igazol")
    ).length;

  const late =
    items.filter(
      x => Number(x.KesesPercben) > 0
    ).length;


  const rows = items.map(item => {

    const type =
      item.Tipus?.Nev ||
      item.Mod?.Nev ||
      "Mulasztás";

    return `
      <tr>

        <td>
          ${safeDate(item.Datum)}
        </td>

        <td>
          <strong>
            ${escapeHTML(
              subjectName(item)
            )}
          </strong>
        </td>

        <td>
          ${escapeHTML(type)}
        </td>

        <td>
          ${
            item.KesesPercben
              ? `${item.KesesPercben} perc`
              : "–"
          }
        </td>

        <td>
          ${escapeHTML(
            item.IgazolasAllapota || "–"
          )}
        </td>

      </tr>
    `;
  }).join("");


  document.getElementById("content").innerHTML = `

    <div class="grid grid-3">

      <div class="card stat-card">
        <div class="stat-icon">!</div>

        <div>
          <div class="stat-label">
            Összes mulasztás
          </div>

          <div class="stat-value">
            ${items.length}
          </div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon">✓</div>

        <div>
          <div class="stat-label">
            Igazoltnak jelölt
          </div>

          <div class="stat-value">
            ${justified}
          </div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon">◷</div>

        <div>
          <div class="stat-label">
            Késések
          </div>

          <div class="stat-value">
            ${late}
          </div>
        </div>
      </div>

    </div>

    <div style="height:18px"></div>

    <div class="card">

      <div class="page-header">
        <div>
          <h2>Mulasztások</h2>
          <p>
            ${items.length} rekord
          </p>
        </div>
      </div>

      ${
        rows
          ? `
            <div class="table-wrapper">
              <table class="table">

                <thead>
                  <tr>
                    <th>Dátum</th>
                    <th>Tantárgy</th>
                    <th>Típus</th>
                    <th>Késés</th>
                    <th>Igazolás</th>
                  </tr>
                </thead>

                <tbody>
                  ${rows}
                </tbody>

              </table>
            </div>
          `
          : emptyState(
              "!",
              "Nincs mulasztás",
              "Nem található mulasztási adat."
            )
      }

    </div>
  `;
}


/* ============================================================
   HOMEWORK
   ============================================================ */

function renderHomework() {

  const items =
    sortByDateDescending(
      state.homework,
      "HataridoDatuma"
    );


  document.getElementById("content").innerHTML = `

    <div class="page-header">
      <div>
        <h2>Házi feladatok</h2>
        <p>
          ${items.length} feladat
        </p>
      </div>
    </div>

    <div class="card">

      ${
        items.length
          ? renderHomeworkList(items)
          : emptyState(
              "▤",
              "Nincs házi feladat",
              "Jelenleg nincs megjeleníthető feladat."
            )
      }

    </div>
  `;
}


/* ============================================================
   TESTS
   ============================================================ */

function renderTests() {

  const items =
    [...state.tests]
      .sort((a, b) =>
        new Date(a.Datum || 0) -
        new Date(b.Datum || 0)
      );


  const html = items.map(test => {

    const subject =
      subjectName(test);

    return `
      <div class="list-item">

        <div class="stat-icon">
          ✎
        </div>

        <div class="list-main">

          <div class="list-title">
            ${escapeHTML(subject)}
          </div>

          <div class="list-meta">

            ${
              test.Temaja
                ? escapeHTML(test.Temaja)
                : "Nincs megadott téma"
            }

            ·

            ${
              test.RogzitoTanarNeve
                ? escapeHTML(
                    test.RogzitoTanarNeve
                  )
                : "Ismeretlen tanár"
            }

          </div>

        </div>

        <div>
          <span class="badge badge-warning">
            ${safeDate(test.Datum)}
          </span>
        </div>

      </div>
    `;
  }).join("");


  document.getElementById("content").innerHTML = `

    <div class="page-header">
      <div>
        <h2>Dolgozatok</h2>
        <p>
          Bejelentett számonkérések
        </p>
      </div>
    </div>

    <div class="card">

      ${
        html
          ? `<div class="list">${html}</div>`
          : emptyState(
              "✎",
              "Nincs dolgozat",
              "Jelenleg nincs bejelentett számonkérés."
            )
      }

    </div>
  `;
}


/* ============================================================
   NOTICE BOARD
   ============================================================ */

function renderNotices() {

  const items =
    sortByDateDescending(
      state.notices,
      "ErvenyessegKezdete"
    );


  const html = items.map(item => {

    const content =
      item.TartalomText ||
      stripHTML(item.Tartalom);


    return `
      <article class="notice">

        <h3>
          ${escapeHTML(item.Cim || "Közlemény")}
        </h3>

        <div class="notice-meta">

          ${
            item.RogzitoNeve
              ? escapeHTML(item.RogzitoNeve)
              : "Ismeretlen"
          }

          ·

          ${safeDate(
            item.ErvenyessegKezdete
          )}

        </div>

        <div class="notice-content">
          ${escapeHTML(content)}
        </div>

      </article>
    `;
  }).join("");


  document.getElementById("content").innerHTML = `

    <div class="page-header">
      <div>
        <h2>Faliújság</h2>
        <p>
          Iskolai közlemények
        </p>
      </div>
    </div>

    <div class="card">

      ${
        html
          ? html
          : emptyState(
              "▣",
              "Nincs közlemény",
              "Jelenleg nincs megjeleníthető faliújság-bejegyzés."
            )
      }

    </div>
  `;
}


/* ============================================================
   INFO BOARD
   ============================================================ */

function renderInfoBoard() {

  const items =
    sortByDateDescending(
      state.infoBoard,
      "KeszitesDatuma"
    );


  const html = items.map(item => {

    const content =
      item.TartalomFormazott ||
      item.Tartalom ||
      "";


    return `
      <article class="notice">

        <h3>
          ${escapeHTML(
            item.Cim || "Feljegyzés"
          )}
        </h3>

        <div class="notice-meta">

          ${
            item.KeszitoTanarNeve
              ? escapeHTML(
                  item.KeszitoTanarNeve
                )
              : "Ismeretlen tanár"
          }

          ·

          ${safeDate(
            item.KeszitesDatuma
          )}

        </div>

        <div class="notice-content">
          ${escapeHTML(
            stripHTML(content)
          )}
        </div>

      </article>
    `;
  }).join("");


  document.getElementById("content").innerHTML = `

    <div class="page-header">
      <div>
        <h2>Feljegyzések</h2>
        <p>
          Tanári feljegyzések
        </p>
      </div>
    </div>

    <div class="card">

      ${
        html
          ? html
          : emptyState(
              "ⓘ",
              "Nincs feljegyzés",
              "Jelenleg nincs megjeleníthető feljegyzés."
            )
      }

    </div>
  `;
}


/* ============================================================
   DKT
   ============================================================ */

function renderDKT() {

  const items =
    state.dktSubjects || [];


  const rows = items.map(item => {

    return `
      <tr>

        <td>
          <strong>
            ${escapeHTML(
              item.TantargyNev || "–"
            )}
          </strong>
        </td>

        <td>
          ${escapeHTML(
            item.AlkalmazottNev || "–"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.OsztalyCsoportNev || "–"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.TipusId ?? "–"
          )}
        </td>

      </tr>
    `;
  }).join("");


  document.getElementById("content").innerHTML = `

    <div class="page-header">
      <div>
        <h2>DKT</h2>
        <p>
          Digitális tananyagok és munkaterek
        </p>
      </div>
    </div>

    <div class="card">

      ${
        rows
          ? `
            <div class="table-wrapper">

              <table class="table">

                <thead>
                  <tr>
                    <th>Tantárgy</th>
                    <th>Alkalmazott név</th>
                    <th>Csoport</th>
                    <th>Típus</th>
                  </tr>
                </thead>

                <tbody>
                  ${rows}
                </tbody>

              </table>

            </div>
          `
          : emptyState(
              "◈",
              "Nincs DKT adat",
              "Jelenleg nincs megjeleníthető digitális tananyag."
            )
      }

    </div>
  `;
}


/* ============================================================
   PROFILE
   ============================================================ */

function renderProfile() {

  const student =
    state.student || {};


  document.getElementById("avatar").textContent =
    initials(student.Nev);


  document.getElementById("content").innerHTML = `

    <div class="card">

      <div class="profile-header">

        <div class="profile-avatar">
          ${initials(student.Nev)}
        </div>

        <div>

          <h2 class="profile-name">
            ${escapeHTML(
              student.Nev || "Ismeretlen diák"
            )}
          </h2>

          <div class="profile-school">

            ${escapeHTML(
              student.IntezmenyNev || "Ismeretlen intézmény"
            )}

          </div>

        </div>

      </div>

      <div class="info-row">
        <span class="info-label">
          Tanuló azonosító
        </span>

        <span class="info-value">
          ${escapeHTML(student.Uid || "–")}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">
          Intézmény
        </span>

        <span class="info-value">
          ${escapeHTML(
            student.IntezmenyNev || "–"
          )}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">
          Intézményi azonosító
        </span>

        <span class="info-value">
          ${escapeHTML(
            student.IntezmenyAzonosito || "–"
          )}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">
          E-mail
        </span>

        <span class="info-value">
          ${escapeHTML(
            student.EmailCim || "–"
          )}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">
          Telefonszám
        </span>

        <span class="info-value">
          ${escapeHTML(
            student.Telefonszam || "–"
          )}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">
          Tanév
        </span>

        <span class="info-value">
          ${escapeHTML(
            student.TanevUid || "–"
          )}
        </span>
      </div>

    </div>
  `;
}


/* ============================================================
   COMPONENT RENDERERS
   ============================================================ */

function renderLessonList(lessons) {

  if (!lessons.length) {
    return emptyState(
      "▦",
      "Nincs óra",
      "Erre a napra nincs órarendi adat."
    );
  }


  return `
    <div class="timetable">

      ${lessons.map(lesson => `

        <div class="lesson">

          <div class="lesson-number">
            ${
              lesson.Oraszam
                ? `${lesson.Oraszam}.`
                : "–"
            }
          </div>

          <div class="lesson-time">

            ${
              formatTime(
                lesson.KezdetIdopont
              )
            }

            <br>

            ${
              formatTime(
                lesson.VegIdopont
              )
            }

          </div>

          <div>

            <div class="lesson-subject">
              ${escapeHTML(
                subjectName(lesson)
              )}
            </div>

            <div class="lesson-teacher">

              ${
                lesson.TanarNeve
                  ? escapeHTML(
                      lesson.TanarNeve
                    )
                  : ""
              }

              ${
                lesson.Tema
                  ? ` · ${escapeHTML(
                      lesson.Tema
                    )}`
                  : ""
              }

            </div>

          </div>

          <div class="lesson-room">

            ${
              lesson.TeremNeve
                ? escapeHTML(
                    lesson.TeremNeve
                  )
                : "–"
            }

          </div>

        </div>

      `).join("")}

    </div>
  `;
}


function renderTestList(items) {

  if (!items.length) {

    return emptyState(
      "✎",
      "Nincs közelgő dolgozat",
      "Jelenleg nincs bejelentett számonkérés."
    );
  }


  return `
    <div class="list">

      ${items.map(test => `

        <div class="list-item">

          <div class="stat-icon">
            ✎
          </div>

          <div class="list-main">

            <div class="list-title">
              ${escapeHTML(
                subjectName(test)
              )}
            </div>

            <div class="list-meta">
              ${
                test.Temaja
                  ? escapeHTML(
                      test.Temaja
                    )
                  : "Nincs megadott téma"
              }
            </div>

          </div>

          <span class="badge badge-warning">
            ${safeDate(test.Datum)}
          </span>

        </div>

      `).join("")}

    </div>
  `;
}


function renderHomeworkList(items) {

  if (!items.length) {

    return emptyState(
      "▤",
      "Nincs házi feladat",
      "Jelenleg nincs megjeleníthető házi feladat."
    );
  }


  return `
    <div class="list">

      ${items.map(item => {

        const done =
          Boolean(item.IsMegoldva);

        const deadline =
          item.HataridoDatuma;


        return `
          <div class="list-item">

            <div class="stat-icon">
              ▤
            </div>

            <div class="list-main">

              <div class="list-title">
                ${escapeHTML(
                  item.TantargyNeve ||
                  subjectName(item)
                )}
              </div>

              <div class="list-meta">

                ${
                  item.Szoveg
                    ? escapeHTML(
                        stripHTML(item.Szoveg)
                      ).slice(0, 180)
                    : "Nincs leírás"
                }

                ${
                  item.RogzitoTanarNeve
                    ? ` · ${escapeHTML(
                        item.RogzitoTanarNeve
                      )}`
                    : ""
                }

              </div>

            </div>

            <div>

              <span class="badge ${
                done
                  ? "badge-success"
                  : deadline &&
                    new Date(deadline) < new Date()
                    ? "badge-danger"
                    : "badge-warning"
              }">

                ${
                  done
                    ? "Megoldva"
                    : deadline
                      ? safeDate(deadline)
                      : "Nincs határidő"
                }

              </span>

            </div>

          </div>
        `;

      }).join("")}

    </div>
  `;
}


function emptyState(
  icon,
  title,
  text
) {

  return `
    <div class="empty">

      <div class="empty-icon">
        ${icon}
      </div>

      <div class="empty-title">
        ${escapeHTML(title)}
      </div>

      <div class="empty-text">
        ${escapeHTML(text)}
      </div>

    </div>
  `;
}


/* ============================================================
   DATE HELPERS
   ============================================================ */

function isToday(value) {

  if (!value) {
    return false;
  }

  const date = new Date(value);

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}


function formatTime(value) {

  if (!value) {
    return "–";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    const match =
      String(value).match(
        /(\d{1,2}):(\d{2})/
      );

    return match
      ? `${match[1].padStart(2, "0")}:${match[2]}`
      : value;
  }

  return date.toLocaleTimeString(
    "hu-HU",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


function formatDay(value) {

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "hu-HU",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  );
}


function stripHTML(value) {

  if (!value) {
    return "";
  }

  const element =
    document.createElement("div");

  element.innerHTML = value;

  return element.textContent ||
    element.innerText ||
    "";
}


/* ============================================================
   REFRESH
   ============================================================ */

async function refreshCurrentPage() {

  const page =
    state.currentPage;

  Object.keys(state.loaded)
    .forEach(key => {
      state.loaded[key] = false;
    });


  const button =
    document.getElementById("refreshButton");

  button.disabled = true;

  button.style.transform =
    "rotate(180deg)";


  try {

    await renderPage();

    showToast(
      "Az adatok frissítve."
    );

  } finally {

    button.disabled = false;

    setTimeout(() => {

      button.style.transform =
        "";

    }, 250);

  }
}


/* ============================================================
   LOGOUT
   ============================================================ */

function logout() {

  /*
   * A backend jelenlegi API-jában nincs külön
   * logout végpont.
   *
   * A meglévő login rendszer által használt tokeneket
   * és helyi adatokat töröljük.
   */

  localStorage.removeItem("access_token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("token");

  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("token");

  window.location.href = "../login/";
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function initialize() {

  setupNavigation();

  updateNavigation();

  updatePageHeader();

  try {

    await loadStudent();

    document.getElementById("avatar").textContent =
      initials(state.student?.Nev);

  } catch (error) {

    console.warn(
      "A tanulói adatok első betöltése sikertelen:",
      error
    );
  }

  await renderPage();
}


document.addEventListener(
  "DOMContentLoaded",
  initialize
);

