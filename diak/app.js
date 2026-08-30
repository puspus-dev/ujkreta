"use strict";

/* ============================================================
   CONFIG
============================================================ */

const API_BASE = "https://ujkreta.onrender.com";

/*
 * Ha később ugyanazon a domainen lesz a frontend és a backend,
 * ezt átállíthatod:
 *
 * const API_BASE = "";
 */

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
   PAGE META
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
   DOM
============================================================ */

const $ = (selector) => document.querySelector(selector);

const content = () => $("#content");

/* ============================================================
   API
============================================================ */

async function apiFetch(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    credentials: "include",
    ...options,

    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 401 || response.status === 403) {
    handleUnauthorized();
    throw new Error("Nincs jogosultság.");
  }

  if (!response.ok) {
    let message = `API hiba: ${response.status} ${response.statusText}`;

    try {
      const data = await response.json();

      if (data?.message) {
        message = data.message;
      }

      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Nem JSON válasz érkezett.
    }

    throw new Error(message);
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function handleUnauthorized() {
  /*
   * A login frontend később elkészül.
   * Addig a /login/ útvonalra küldjük a felhasználót.
   */
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "../login/";
  }
}

/* ============================================================
   DATA LOADERS
============================================================ */

async function loadStudent() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/TanuloAdatlap"
  );

  state.student = normalizeArrayOrObject(data);
  state.loaded.student = true;

  return state.student;
}

async function loadClassGroups() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/OsztalyCsoportok"
  );

  state.classGroups = normalizeArray(data);
  state.loaded.classGroups = true;

  return state.classGroups;
}

async function loadGrades() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/Ertekelesek"
  );

  state.grades = normalizeArray(data);
  state.loaded.grades = true;

  return state.grades;
}

async function loadAverages() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/Ertekelesek/Atlagok/OsztalyAtlagok"
  );

  state.averages = normalizeArray(data);
  state.loaded.averages = true;

  return state.averages;
}

async function loadLessons() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/OrarendElemek"
  );

  state.lessons = normalizeArray(data);
  state.loaded.lessons = true;

  return state.lessons;
}

async function loadOmissions() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/Mulasztasok"
  );

  state.omissions = normalizeArray(data);
  state.loaded.omissions = true;

  return state.omissions;
}

async function loadHomework() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/HaziFeladatok"
  );

  state.homework = normalizeArray(data);
  state.loaded.homework = true;

  return state.homework;
}

async function loadTests() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/BejelentettSzamonkeresek"
  );

  state.tests = normalizeArray(data);
  state.loaded.tests = true;

  return state.tests;
}

async function loadNotices() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/FaliujsagElemek"
  );

  state.notices = normalizeArray(data);
  state.loaded.notices = true;

  return state.notices;
}

async function loadInfoBoard() {
  const data = await apiFetch(
    "/ellenorzo/v3/sajat/Feljegyzesek"
  );

  state.infoBoard = normalizeArray(data);
  state.loaded.infoBoard = true;

  return state.infoBoard;
}

async function loadDktSubjects() {
  const data = await apiFetch(
    "/dktapi/intezmenyek/munkaterek/tanulok"
  );

  state.dktSubjects = normalizeArray(data);
  state.loaded.dktSubjects = true;

  return state.dktSubjects;
}

/* ============================================================
   NORMALIZATION
============================================================ */

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.Items)) {
    return value.Items;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.Data)) {
    return value.Data;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (value && typeof value === "object") {
    return [];
  }

  return [];
}

function normalizeArrayOrObject(value) {
  if (Array.isArray(value)) {
    return value[0] || {};
  }

  if (value?.Data && typeof value.Data === "object") {
    return value.Data;
  }

  return value || {};
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

function stripHTML(value) {
  if (!value) {
    return "";
  }

  const element = document.createElement("div");
  element.innerHTML = String(value);

  return element.textContent || element.innerText || "";
}

function safeDate(value) {
  if (!value) {
    return "–";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("hu-HU");
}

function safeDateTime(value) {
  if (!value) {
    return "–";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("hu-HU");
}

function formatTime(value) {
  if (!value) {
    return "–";
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("hu-HU", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const match = String(value).match(/(\d{1,2}):(\d{2})/);

  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }

  return String(value);
}

function formatDay(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("hu-HU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

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

function initials(name) {
  if (!name) {
    return "?";
  }

  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function average(numbers) {
  const values = numbers
    .map(Number)
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return null;
  }

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function subjectName(item) {
  return (
    item?.Tantargy?.Nev ||
    item?.Tantargy?.Megnevezes ||
    item?.TantargyNeve ||
    item?.TantargyNev ||
    item?.Nev ||
    "Ismeretlen tantárgy"
  );
}

function sortByDateDescending(items, field) {
  return [...items].sort((a, b) => {
    const first = new Date(a?.[field] || 0).getTime();
    const second = new Date(b?.[field] || 0).getTime();

    return second - first;
  });
}

function gradeClass(value) {
  const number = Number(value);

  if (number >= 5) {
    return "grade-5";
  }

  if (number >= 4) {
    return "grade-4";
  }

  if (number >= 3) {
    return "grade-3";
  }

  return "grade-1";
}

function showToast(message, type = "default") {
  const toast = $("#toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  window.clearTimeout(showToast.timeout);

  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/* ============================================================
   NAVIGATION
============================================================ */

function setupNavigation() {
  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        navigate(button.dataset.page);
      });
    });

  $("#profileButton")?.addEventListener("click", () => {
    navigate("profile");
  });

  $("#logoutButton")?.addEventListener("click", logout);

  $("#refreshButton")?.addEventListener(
    "click",
    refreshCurrentPage
  );

  $("#menuButton")?.addEventListener(
    "click",
    toggleSidebar
  );

  $("#sidebarOverlay")?.addEventListener(
    "click",
    closeSidebar
  );
}

function navigate(page) {
  if (!pageMeta[page]) {
    page = "home";
  }

  state.currentPage = page;

  updateNavigation();
  updatePageHeader();
  closeSidebar();

  renderPage();
}

function updateNavigation() {
  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === state.currentPage
      );
    });
}

function updatePageHeader() {
  const meta =
    pageMeta[state.currentPage] || pageMeta.home;

  const title = $("#pageTitle");
  const subtitle = $("#pageSubtitle");

  if (title) {
    title.textContent = meta.title;
  }

  if (subtitle) {
    subtitle.textContent = meta.subtitle;
  }
}

function toggleSidebar() {
  $("#sidebar")?.classList.toggle("open");
  $("#sidebarOverlay")?.classList.toggle("show");
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  $("#sidebarOverlay")?.classList.remove("show");
}

/* ============================================================
   PAGE DATA
============================================================ */

async function ensurePageData(page) {
  switch (page) {
    case "home":
      await Promise.allSettled([
        state.loaded.student
          ? Promise.resolve()
          : loadStudent(),

        state.loaded.lessons
          ? Promise.resolve()
          : loadLessons(),

        state.loaded.grades
          ? Promise.resolve()
          : loadGrades(),

        state.loaded.homework
          ? Promise.resolve()
          : loadHomework(),

        state.loaded.tests
          ? Promise.resolve()
          : loadTests()
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
      await Promise.all([
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
   RENDER PAGE
============================================================ */

async function renderPage() {
  content().innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Adatok betöltése...</p>
    </div>
  `;

  try {
    await ensurePageData(state.currentPage);

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

    renderError(error);
  }
}

function renderError(error) {
  content().innerHTML = `
    <div class="error-card">
      <div class="error-icon">!</div>

      <h2>Nem sikerült betölteni az adatokat</h2>

      <p>
        ${escapeHTML(
          error?.message ||
          "Ismeretlen hiba történt."
        )}
      </p>

      <button
        class="primary-button"
        id="retryButton"
      >
        Újrapróbálás
      </button>
    </div>
  `;

  $("#retryButton")?.addEventListener(
    "click",
    renderPage
  );
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
    .map((item) => Number(item?.SzamErtek))
    .filter((value) => value > 0);

  const avg = average(numericGrades);

  const upcomingHomework = [...homework]
    .sort((a, b) => {
      const da = new Date(
        a?.HataridoDatuma || "9999-12-31"
      ).getTime();

      const db = new Date(
        b?.HataridoDatuma || "9999-12-31"
      ).getTime();

      return da - db;
    })
    .slice(0, 5);

  const upcomingTests = [...tests]
    .sort((a, b) => {
      return (
        new Date(a?.Datum || "9999-12-31").getTime() -
        new Date(b?.Datum || "9999-12-31").getTime()
      );
    })
    .slice(0, 5);

  const todayLessons = lessons.filter(
    (lesson) => isToday(lesson?.Datum)
  );

  updateAvatar(student);

  content().innerHTML = `
    <div class="welcome-card">
      <div class="welcome-content">
        <span class="eyebrow">KRÁTA DIÁK</span>

        <h2>
          Szia, ${escapeHTML(student.Nev || "Diák")}!
        </h2>

        <p>
          Itt láthatod a legfontosabb iskolai
          információidat egy helyen.
        </p>
      </div>

      <div class="welcome-symbol">
        K
      </div>
    </div>

    <div class="stats-grid">
      ${statCard(
        "✓",
        "Jegyek",
        grades.length
      )}

      ${statCard(
        "◉",
        "Átlag",
        avg === null ? "–" : avg.toFixed(2)
      )}

      ${statCard(
        "▤",
        "Aktív házik",
        homework.filter(
          (item) => !Boolean(item?.IsMegoldva)
        ).length
      )}

      ${statCard(
        "✎",
        "Dolgozatok",
        upcomingTests.length
      )}
    </div>

    <div class="dashboard-grid">
      <section class="card">
        <div class="section-heading">
          <div>
            <h2>Mai órák</h2>
            <p>${todayLessons.length} óra</p>
          </div>

          <button
            class="ghost-button"
            data-go="timetable"
          >
            Teljes órarend
          </button>
        </div>

        ${renderLessonList(todayLessons.slice(0, 5))}
      </section>

      <section class="card">
        <div class="section-heading">
          <div>
            <h2>Közelgő dolgozatok</h2>
            <p>Bejelentett számonkérések</p>
          </div>
        </div>

        ${renderTestList(upcomingTests)}
      </section>
    </div>

    <section class="card">
      <div class="section-heading">
        <div>
          <h2>Házi feladatok</h2>
          <p>Aktuális feladatok</p>
        </div>

        <button
          class="ghost-button"
          data-go="homework"
        >
          Összes
        </button>
      </div>

      ${renderHomeworkList(upcomingHomework)}
    </section>
  `;

  bindGoButtons();
}

/* ============================================================
   STAT CARD
============================================================ */

function statCard(icon, label, value) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>

      <div>
        <div class="stat-label">
          ${escapeHTML(label)}
        </div>

        <div class="stat-value">
          ${escapeHTML(value)}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   TIMETABLE
============================================================ */

function renderTimetable() {
  const lessons = [...state.lessons].sort(
    (a, b) => {
      return (
        new Date(a?.Datum || 0).getTime() -
        new Date(b?.Datum || 0).getTime()
      );
    }
  );

  const grouped = {};

  lessons.forEach((lesson) => {
    const date = lesson?.Datum
      ? String(lesson.Datum).slice(0, 10)
      : "Ismeretlen";

    if (!grouped[date]) {
      grouped[date] = [];
    }

    grouped[date].push(lesson);
  });

  const sections = Object.entries(grouped)
    .map(([date, dayLessons]) => {
      return `
        <section class="card timetable-day">
          <div class="section-heading">
            <div>
              <h2>${escapeHTML(formatDay(date))}</h2>
              <p>${dayLessons.length} óra</p>
            </div>
          </div>

          ${renderLessonList(dayLessons)}
        </section>
      `;
    })
    .join("");

  content().innerHTML =
    sections ||
    emptyState(
      "▦",
      "Nincs órarendi adat",
      "Jelenleg nincs megjeleníthető óra."
    );
}

/* ============================================================
   GRADES
============================================================ */

function renderGrades() {
  const grades = sortByDateDescending(
    state.grades,
    "RogzitesDatuma"
  );

  const grouped = {};

  grades.forEach((grade) => {
    const subject = subjectName(grade);

    if (!grouped[subject]) {
      grouped[subject] = [];
    }

    grouped[subject].push(grade);
  });

  const rows = Object.entries(grouped)
    .map(([subject, items]) => {
      const values = items
        .map((item) => Number(item?.SzamErtek))
        .filter((value) => value > 0);

      const avg = average(values);

      return `
        <tr>
          <td>
            <strong>${escapeHTML(subject)}</strong>
          </td>

          <td>
            <div class="grade-list">
              ${items
                .map((item) => {
                  const value =
                    item?.SzamErtek ||
                    item?.SzovegesErtek ||
                    "–";

                  return `
                    <span
                      class="grade ${gradeClass(
                        item?.SzamErtek
                      )}"
                      title="${escapeHTML(
                        item?.ErtekelesTipus?.Nev ||
                        item?.Tipus?.Nev ||
                        ""
                      )}"
                    >
                      ${escapeHTML(value)}
                    </span>
                  `;
                })
                .join("")}
            </div>
          </td>

          <td>
            <strong>
              ${
                avg === null
                  ? "–"
                  : avg.toFixed(2)
              }
            </strong>
          </td>
        </tr>
      `;
    })
    .join("");

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">ÉRTÉKELÉSEK</span>
        <h2>Jegyek</h2>
        <p>${grades.length} értékelés</p>
      </div>
    </div>

    <section class="card">
      ${
        rows
          ? `
            <div class="table-container">
              <table class="data-table">
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
    </section>
  `;
}

/* ============================================================
   AVERAGES
============================================================ */

function renderAverages() {
  const items = state.averages || [];

  const rows = items
    .map((item) => {
      const studentAverage =
        Number(item?.TanuloAtlag);

      const classAverage =
        Number(item?.OsztalyCsoportAtlag);

      return `
        <tr>
          <td>
            <strong>
              ${escapeHTML(subjectName(item))}
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
    })
    .join("");

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">STATISZTIKA</span>
        <h2>Átlagok</h2>
        <p>Tantárgyi és osztályátlagok</p>
      </div>
    </div>

    <section class="card">
      ${
        rows
          ? `
            <div class="table-container">
              <table class="data-table">
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
    </section>
  `;
}

/* ============================================================
   OMISSIONS
============================================================ */

function renderOmissions() {
  const items = state.omissions || [];

  const justified = items.filter(
    (item) =>
      String(item?.IgazolasAllapota || "")
        .toLowerCase()
        .includes("igazol")
  ).length;

  const late = items.filter(
    (item) => Number(item?.KesesPercben) > 0
  ).length;

  const rows = items
    .map((item) => {
      const type =
        item?.Tipus?.Nev ||
        item?.Mod?.Nev ||
        "Mulasztás";

      return `
        <tr>
          <td>${safeDate(item?.Datum)}</td>

          <td>
            <strong>
              ${escapeHTML(subjectName(item))}
            </strong>
          </td>

          <td>${escapeHTML(type)}</td>

          <td>
            ${
              Number(item?.KesesPercben) > 0
                ? `${escapeHTML(
                    item.KesesPercben
                  )} perc`
                : "–"
            }
          </td>

          <td>
            ${escapeHTML(
              item?.IgazolasAllapota || "–"
            )}
          </td>
        </tr>
      `;
    })
    .join("");

  content().innerHTML = `
    <div class="stats-grid three">
      ${statCard(
        "!",
        "Összes mulasztás",
        items.length
      )}

      ${statCard(
        "✓",
        "Igazoltnak jelölt",
        justified
      )}

      ${statCard(
        "◷",
        "Késések",
        late
      )}
    </div>

    <section class="card">
      <div class="section-heading">
        <div>
          <h2>Mulasztások</h2>
          <p>${items.length} rekord</p>
        </div>
      </div>

      ${
        rows
          ? `
            <div class="table-container">
              <table class="data-table">
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
    </section>
  `;
}

/* ============================================================
   HOMEWORK
============================================================ */

function renderHomework() {
  const items = sortByDateDescending(
    state.homework,
    "HataridoDatuma"
  );

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">FELADATOK</span>
        <h2>Házi feladatok</h2>
        <p>${items.length} feladat</p>
      </div>
    </div>

    <section class="card">
      ${
        items.length
          ? renderHomeworkList(items)
          : emptyState(
              "▤",
              "Nincs házi feladat",
              "Jelenleg nincs megjeleníthető feladat."
            )
      }
    </section>
  `;
}

/* ============================================================
   TESTS
============================================================ */

function renderTests() {
  const items = [...state.tests].sort(
    (a, b) => {
      return (
        new Date(a?.Datum || "9999-12-31").getTime() -
        new Date(b?.Datum || "9999-12-31").getTime()
      );
    }
  );

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">SZÁMONKÉRÉSEK</span>
        <h2>Dolgozatok</h2>
        <p>Bejelentett számonkérések</p>
      </div>
    </div>

    <section class="card">
      ${
        items.length
          ? `
            <div class="list">
              ${items
                .map(renderTestItem)
                .join("")}
            </div>
          `
          : emptyState(
              "✎",
              "Nincs dolgozat",
              "Jelenleg nincs bejelentett számonkérés."
            )
      }
    </section>
  `;
}

function renderTestItem(test) {
  return `
    <div class="list-item">
      <div class="list-icon">✎</div>

      <div class="list-main">
        <div class="list-title">
          ${escapeHTML(subjectName(test))}
        </div>

        <div class="list-meta">
          ${
            test?.Temaja
              ? escapeHTML(test.Temaja)
              : "Nincs megadott téma"
          }

          ${
            test?.RogzitoTanarNeve
              ? ` · ${escapeHTML(
                  test.RogzitoTanarNeve
                )}`
              : ""
          }
        </div>
      </div>

      <span class="badge warning">
        ${safeDate(test?.Datum)}
      </span>
    </div>
  `;
}

/* ============================================================
   NOTICE BOARD
============================================================ */

function renderNotices() {
  const items = sortByDateDescending(
    state.notices,
    "ErvenyessegKezdete"
  );

  const html = items
    .map((item) => {
      const text =
        item?.TartalomText ||
        stripHTML(item?.Tartalom);

      return `
        <article class="notice">
          <h3>
            ${escapeHTML(
              item?.Cim || "Közlemény"
            )}
          </h3>

          <div class="notice-meta">
            ${
              item?.RogzitoNeve
                ? escapeHTML(item.RogzitoNeve)
                : "Ismeretlen"
            }

            ·

            ${safeDate(
              item?.ErvenyessegKezdete
            )}
          </div>

          <div class="notice-content">
            ${escapeHTML(text)}
          </div>
        </article>
      `;
    })
    .join("");

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">KÖZLEMÉNYEK</span>
        <h2>Faliújság</h2>
        <p>Iskolai közlemények</p>
      </div>
    </div>

    <section class="card">
      ${
        html ||
        emptyState(
          "▣",
          "Nincs közlemény",
          "Jelenleg nincs megjeleníthető faliújság-bejegyzés."
        )
      }
    </section>
  `;
}

/* ============================================================
   INFO BOARD
============================================================ */

function renderInfoBoard() {
  const items = sortByDateDescending(
    state.infoBoard,
    "KeszitesDatuma"
  );

  const html = items
    .map((item) => {
      const text = stripHTML(
        item?.TartalomFormazott ||
        item?.Tartalom ||
        ""
      );

      return `
        <article class="notice">
          <h3>
            ${escapeHTML(
              item?.Cim || "Feljegyzés"
            )}
          </h3>

          <div class="notice-meta">
            ${
              item?.KeszitoTanarNeve
                ? escapeHTML(
                    item.KeszitoTanarNeve
                  )
                : "Ismeretlen tanár"
            }

            ·

            ${safeDate(
              item?.KeszitesDatuma
            )}
          </div>

          <div class="notice-content">
            ${escapeHTML(text)}
          </div>
        </article>
      `;
    })
    .join("");

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">FELJEGYZÉSEK</span>
        <h2>Feljegyzések</h2>
        <p>Tanári feljegyzések</p>
      </div>
    </div>

    <section class="card">
      ${
        html ||
        emptyState(
          "ⓘ",
          "Nincs feljegyzés",
          "Jelenleg nincs megjeleníthető feljegyzés."
        )
      }
    </section>
  `;
}

/* ============================================================
   DKT
============================================================ */

function renderDKT() {
  const items = state.dktSubjects || [];

  const rows = items
    .map((item) => {
      return `
        <tr>
          <td>
            <strong>
              ${escapeHTML(
                item?.TantargyNev || "–"
              )}
            </strong>
          </td>

          <td>
            ${escapeHTML(
              item?.AlkalmazottNev || "–"
            )}
          </td>

          <td>
            ${escapeHTML(
              item?.OsztalyCsoportNev || "–"
            )}
          </td>

          <td>
            ${escapeHTML(
              item?.TipusId ?? "–"
            )}
          </td>
        </tr>
      `;
    })
    .join("");

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">DIGITÁLIS TANANYAG</span>
        <h2>DKT</h2>
        <p>Digitális tananyagok és munkaterek</p>
      </div>
    </div>

    <section class="card">
      ${
        rows
          ? `
            <div class="table-container">
              <table class="data-table">
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
    </section>
  `;
}

/* ============================================================
   PROFILE
============================================================ */

function renderProfile() {
  const student = state.student || {};

  updateAvatar(student);

  content().innerHTML = `
    <div class="page-heading">
      <div>
        <span class="eyebrow">FIÓK</span>
        <h2>Profil</h2>
        <p>Tanulói adatok</p>
      </div>
    </div>

    <section class="card profile-card">
      <div class="profile-header">
        <div class="profile-avatar">
          ${escapeHTML(initials(student.Nev))}
        </div>

        <div>
          <h2 class="profile-name">
            ${escapeHTML(
              student.Nev || "Ismeretlen diák"
            )}
          </h2>

          <div class="profile-school">
            ${escapeHTML(
              student.IntezmenyNev ||
              "Ismeretlen intézmény"
            )}
          </div>
        </div>
      </div>

      ${profileRow(
        "Tanuló azonosító",
        student.Uid
      )}

      ${profileRow(
        "Intézmény",
        student.IntezmenyNev
      )}

      ${profileRow(
        "Intézményi azonosító",
        student.IntezmenyAzonosito
      )}

      ${profileRow(
        "E-mail",
        student.EmailCim
      )}

      ${profileRow(
        "Telefonszám",
        student.Telefonszam
      )}

      ${profileRow(
        "Tanév",
        student.TanevUid
      )}
    </section>
  `;
}

function profileRow(label, value) {
  return `
    <div class="info-row">
      <span class="info-label">
        ${escapeHTML(label)}
      </span>

      <span class="info-value">
        ${escapeHTML(value || "–")}
      </span>
    </div>
  `;
}

/* ============================================================
   COMPONENTS
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
    <div class="lessons">
      ${lessons
        .map((lesson) => {
          return `
            <div class="lesson">
              <div class="lesson-number">
                ${
                  lesson?.Oraszam
                    ? `${escapeHTML(
                        lesson.Oraszam
                      )}.`
                    : "–"
                }
              </div>

              <div class="lesson-time">
                <strong>
                  ${formatTime(
                    lesson?.KezdetIdopont
                  )}
                </strong>

                <span>
                  ${formatTime(
                    lesson?.VegIdopont
                  )}
                </span>
              </div>

              <div class="lesson-info">
                <div class="lesson-subject">
                  ${escapeHTML(
                    subjectName(lesson)
                  )}
                </div>

                <div class="lesson-teacher">
                  ${
                    lesson?.TanarNeve
                      ? escapeHTML(
                          lesson.TanarNeve
                        )
                      : "Tanár nincs megadva"
                  }

                  ${
                    lesson?.Tema
                      ? ` · ${escapeHTML(
                          lesson.Tema
                        )}`
                      : ""
                  }
                </div>
              </div>

              <div class="lesson-room">
                ${
                  lesson?.TeremNeve
                    ? escapeHTML(
                        lesson.TeremNeve
                      )
                    : "–"
                }
              </div>
            </div>
          `;
        })
        .join("")}
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
      ${items
        .map(renderTestItem)
        .join("")}
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
      ${items
        .map((item) => {
          const done =
            Boolean(item?.IsMegoldva);

          const deadline =
            item?.HataridoDatuma;

          const overdue =
            deadline &&
            new Date(deadline).getTime() <
              Date.now() &&
            !done;

          return `
            <div class="list-item">
              <div class="list-icon">
                ▤
              </div>

              <div class="list-main">
                <div class="list-title">
                  ${escapeHTML(
                    item?.TantargyNeve ||
                    subjectName(item)
                  )}
                </div>

                <div class="list-meta">
                  ${
                    item?.Szoveg
                      ? escapeHTML(
                          stripHTML(
                            item.Szoveg
                          )
                        ).slice(0, 180)
                      : "Nincs leírás"
                  }

                  ${
                    item?.RogzitoTanarNeve
                      ? ` · ${escapeHTML(
                          item.RogzitoTanarNeve
                        )}`
                      : ""
                  }
                </div>
              </div>

              <span class="badge ${
                done
                  ? "success"
                  : overdue
                    ? "danger"
                    : "warning"
              }">
                ${
                  done
                    ? "Megoldva"
                    : overdue
                      ? "Lejárt"
                      : deadline
                        ? safeDate(deadline)
                        : "Nincs határidő"
                }
              </span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function emptyState(icon, title, text) {
  return `
    <div class="empty-state">
      <div class="empty-icon">
        ${escapeHTML(icon)}
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
   UI HELPERS
============================================================ */

function updateAvatar(student) {
  const avatar = $("#avatar");

  if (!avatar) {
    return;
  }

  avatar.textContent = initials(
    student?.Nev
  );
}

function bindGoButtons() {
  document
    .querySelectorAll("[data-go]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        navigate(button.dataset.go);
      });
    });
}

/* ============================================================
   REFRESH
============================================================ */

async function refreshCurrentPage() {
  const button = $("#refreshButton");

  if (button) {
    button.disabled = true;
    button.classList.add("spinning");
  }

  Object.keys(state.loaded).forEach((key) => {
    state.loaded[key] = false;
  });

  try {
    await renderPage();

    showToast(
      "Az adatok frissítve.",
      "success"
    );
  } catch (error) {
    console.error(error);

    showToast(
      "A frissítés sikertelen.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("spinning");
    }
  }
}

/* ============================================================
   LOGOUT
============================================================ */

function logout() {
  /*
   * A jelenlegi backendből nem látszik külön logout endpoint.
   * A böngészőben tárolt lehetséges tokeneket eltávolítjuk.
   */

  const keys = [
    "access_token",
    "accessToken",
    "token",
    "refresh_token",
    "refreshToken"
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  window.location.href = "../login/";
}

/* ============================================================
   INITIALIZATION
============================================================ */

async function initialize() {
  setupNavigation();
  updateNavigation();
  updatePageHeader();

  /*
   * Elsőként lekérjük a tanulói adatokat.
   * Ha nincs bejelentkezés, a 401 kezelő a login oldalra küld.
   */
  try {
    await loadStudent();

    updateAvatar(state.student);
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