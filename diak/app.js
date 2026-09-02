/* ============================================================
   KRÁTA Hallgatói Web (Neptun-szerű)
   Login: csak a főoldalon. Token nélkül vissza a gyökérre.
   ============================================================ */

const API_BASE = "https://ujkreta.onrender.com";
const LOGIN_URL = "https://puspus-dev.github.io/ujkreta/";

const TOKEN_KEYS = ["access_token", "ujkreta_access_token"];
const REFRESH_KEYS = ["refresh_token", "ujkreta_refresh_token"];

const PAGE_META = {
  dashboard: "Kezdőlap",
  grades: "Értékelések",
  timetable: "Órarend",
  homework: "Házi feladatok",
  tests: "Számonkérések",
  absences: "Mulasztások",
  notices: "Faliújság",
  notes: "Feljegyzések",
  profile: "Személyes adatok"
};

let accessToken = null;
let cache = {};
let currentPage = "dashboard";

function getStoredToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function clearTokens() {
  for (const k of [...TOKEN_KEYS, ...REFRESH_KEYS, "local_usr", "local_pw"]) {
    localStorage.removeItem(k);
  }
}

function goLogin() {
  clearTokens();
  window.location.href = LOGIN_URL;
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
  if (res.status === 401) {
    goLogin();
    throw new Error("401");
  }
  if (!res.ok) {
    console.warn("API", path, res.status);
    return null;
  }
  return res.json();
}

async function loadAllData() {
  const map = {
    student: "/ellenorzo/v3/sajat/TanuloAdatlap",
    grades: "/ellenorzo/v3/sajat/Ertekelesek",
    timetable: "/ellenorzo/v3/sajat/OrarendElemek",
    homework: "/ellenorzo/v3/sajat/HaziFeladatok",
    tests: "/ellenorzo/v3/sajat/BejelentettSzamonkeresek",
    absences: "/ellenorzo/v3/sajat/Mulasztasok",
    notes: "/ellenorzo/v3/sajat/Feljegyzesek",
    notices: "/ellenorzo/v3/sajat/FaliujsagElemek",
    groups: "/ellenorzo/v3/sajat/OsztalyCsoportok"
  };
  const keys = Object.keys(map);
  const vals = await Promise.all(keys.map((k) => apiGet(map[k]).catch(() => null)));
  cache = {};
  keys.forEach((k, i) => { cache[k] = vals[i]; });
  return cache;
}

function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString("hu-HU");
  } catch {
    return String(iso).slice(0, 10);
  }
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function weekdayName(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("hu-HU", { weekday: "long" });
  } catch {
    return "";
  }
}

function subjectName(obj) {
  if (!obj) return "?";
  return obj.Tantargy?.Nev || obj.TantargyNev || obj.TantargyNeve || obj.Nev || "?";
}

function gradeClass(n) {
  const v = Number(n);
  if (v >= 5) return "n-grade-5";
  if (v >= 4) return "n-grade-4";
  if (v >= 3) return "n-grade-3";
  if (v >= 2) return "n-grade-2";
  if (v >= 1) return "n-grade-1";
  return "";
}

function empty(t) {
  return `<div class="n-empty">${esc(t)}</div>`;
}

/* ---------- pages ---------- */

function renderDashboard() {
  const s = cache.student || {};
  const grades = Array.isArray(cache.grades) ? cache.grades : [];
  const homework = Array.isArray(cache.homework) ? cache.homework : [];
  const tests = Array.isArray(cache.tests) ? cache.tests : [];
  const absences = Array.isArray(cache.absences) ? cache.absences : [];
  const notices = Array.isArray(cache.notices) ? cache.notices : [];
  const timetable = Array.isArray(cache.timetable) ? cache.timetable : [];

  const nums = grades.map((g) => Number(g.SzamErtek)).filter((n) => n > 0);
  const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : "—";

  const recent = [...grades]
    .sort((a, b) => new Date(b.KeszitesDatuma || b.RogzitesDatuma || 0) - new Date(a.KeszitesDatuma || a.RogzitesDatuma || 0))
    .slice(0, 6);

  const openHw = homework.filter((h) => !h.IsMegoldva).slice(0, 6);

  const today = timetable
    .filter((l) => {
      if (!l.Datum) return false;
      const d = new Date(l.Datum);
      const n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    })
    .sort((a, b) => (a.Oraszam || 0) - (b.Oraszam || 0));

  return `
    <div class="n-welcome">
      <h2>Üdvözöljük, ${esc(s.Nev || "Hallgató")}!</h2>
      <p>${esc(s.IntezmenyNev || "")}${s.TanevUid ? " · " + esc(s.TanevUid) : ""}</p>
    </div>

    <div class="n-grid n-grid-4" style="margin-bottom:14px;">
      <div class="n-stat"><div class="n-stat-label">Átlag</div><div class="n-stat-value">${esc(avg)}</div></div>
      <div class="n-stat"><div class="n-stat-label">Nyitott házi</div><div class="n-stat-value">${homework.filter((h) => !h.IsMegoldva).length}</div></div>
      <div class="n-stat"><div class="n-stat-label">Számonkérések</div><div class="n-stat-value">${tests.length}</div></div>
      <div class="n-stat"><div class="n-stat-label">Mulasztások</div><div class="n-stat-value">${absences.length}</div></div>
    </div>

    <div class="n-grid n-grid-2">
      <div class="n-panel">
        <div class="n-panel-head">Legutóbbi értékelések</div>
        <div class="n-panel-body">
          ${recent.length === 0 ? empty("Nincs értékelés.") : `
          <div class="n-table-wrap"><table class="n-table">
            <thead><tr><th>Jegy</th><th>Tantárgy</th><th>Téma</th><th>Dátum</th></tr></thead>
            <tbody>${recent.map((g) => `
              <tr>
                <td><span class="n-grade ${gradeClass(g.SzamErtek)}">${esc(g.SzamErtek ?? g.SzovegesErtek ?? "?")}</span></td>
                <td>${esc(subjectName(g))}</td>
                <td>${esc(g.Tema || "—")}</td>
                <td>${fmtDate(g.KeszitesDatuma || g.RogzitesDatuma)}</td>
              </tr>`).join("")}</tbody>
          </table></div>`}
        </div>
      </div>

      <div class="n-panel">
        <div class="n-panel-head">Mai órák</div>
        <div class="n-panel-body">
          ${today.length === 0 ? empty("Ma nincs tanóra az órarendben.") : today.map((l) => `
            <div class="n-lesson">
              <div class="n-lesson-num">${esc(l.Oraszam ?? "")}.</div>
              <div class="n-lesson-time">${fmtTime(l.KezdetIdopont)}–${fmtTime(l.VegIdopont)}</div>
              <div>
                <div class="n-lesson-subj">${esc(subjectName(l) || l.Nev)}</div>
                <div class="n-lesson-meta">${esc(l.TanarNeve || "")}</div>
              </div>
              <div class="n-lesson-meta">${esc(l.TeremNeve || "")}</div>
            </div>`).join("")}
        </div>
      </div>

      <div class="n-panel">
        <div class="n-panel-head">Házi feladatok</div>
        <div class="n-panel-body">
          ${openHw.length === 0 ? empty("Nincs nyitott házi feladat.") : `<ul class="n-list">${openHw.map((h) => `
            <li>
              <div class="n-list-title">${esc(subjectName(h))}</div>
              <div class="n-list-meta">${esc(h.Szoveg || "")}</div>
              <div class="n-list-meta">Határidő: ${fmtDate(h.HataridoDatuma || h.Hatarido)}</div>
            </li>`).join("")}</ul>`}
        </div>
      </div>

      <div class="n-panel">
        <div class="n-panel-head">Faliújság</div>
        <div class="n-panel-body">
          ${notices.length === 0 ? empty("Nincs közlemény.") : `<ul class="n-list">${notices.slice(0, 5).map((n) => `
            <li>
              <div class="n-list-title">${esc(n.Cim || "Közlemény")}</div>
              <div class="n-list-meta">${esc((n.TartalomText || n.Tartalom || "").slice(0, 140))}</div>
              <div class="n-list-meta">${esc(n.RogzitoNeve || "")} · ${fmtDate(n.ErvenyessegKezdete)}</div>
            </li>`).join("")}</ul>`}
        </div>
      </div>
    </div>
  `;
}

function renderGrades() {
  const grades = Array.isArray(cache.grades) ? cache.grades : [];
  if (!grades.length) return `<div class="n-panel"><div class="n-panel-body">${empty("Nincsenek értékelések.")}</div></div>`;

  const by = {};
  grades.forEach((g) => {
    const n = subjectName(g);
    (by[n] ||= []).push(g);
  });

  return Object.entries(by)
    .sort(([a], [b]) => a.localeCompare(b, "hu"))
    .map(([name, list]) => {
      const nums = list.map((g) => Number(g.SzamErtek)).filter((n) => n > 0);
      const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : "—";
      const rows = [...list]
        .sort((a, b) => new Date(b.KeszitesDatuma || b.RogzitesDatuma || 0) - new Date(a.KeszitesDatuma || a.RogzitesDatuma || 0))
        .map((g) => `
          <tr>
            <td><span class="n-grade ${gradeClass(g.SzamErtek)}">${esc(g.SzamErtek ?? g.SzovegesErtek ?? "?")}</span></td>
            <td>${esc(g.Tema || "—")}</td>
            <td>${esc(g.Tipus?.Nev || "—")}</td>
            <td>${esc(g.ErtekeloTanarNeve || "—")}</td>
            <td>${g.SulySzazalekErteke != null ? esc(g.SulySzazalekErteke) + "%" : "—"}</td>
            <td>${fmtDate(g.KeszitesDatuma || g.RogzitesDatuma)}</td>
          </tr>`).join("");
      return `
        <div class="n-panel">
          <div class="n-panel-head">${esc(name)} <span style="font-weight:500;color:var(--n-muted);">· átlag: ${esc(avg)} · ${list.length} db</span></div>
          <div class="n-panel-body" style="padding:0;">
            <div class="n-table-wrap"><table class="n-table">
              <thead><tr><th>Jegy</th><th>Téma</th><th>Típus</th><th>Tanár</th><th>Súly</th><th>Dátum</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>
          </div>
        </div>`;
    })
    .join("");
}

function renderTimetable() {
  const lessons = Array.isArray(cache.timetable) ? cache.timetable : [];
  if (!lessons.length) return `<div class="n-panel"><div class="n-panel-body">${empty("Nincs órarend adat.")}</div></div>`;

  const by = {};
  lessons.forEach((l) => {
    const k = (l.Datum || "").slice(0, 10) || "ismeretlen";
    (by[k] ||= []).push(l);
  });

  return Object.entries(by)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => (a.Oraszam || 0) - (b.Oraszam || 0));
      return `
        <div class="n-panel">
          <div class="n-panel-head">${esc(weekdayName(date))} · ${fmtDate(date)}</div>
          <div class="n-panel-body" style="padding:0;">
            ${sorted.map((l) => `
              <div class="n-lesson">
                <div class="n-lesson-num">${esc(l.Oraszam ?? "")}.</div>
                <div class="n-lesson-time">${fmtTime(l.KezdetIdopont)}–${fmtTime(l.VegIdopont)}</div>
                <div>
                  <div class="n-lesson-subj">${esc(subjectName(l) || l.Nev)}</div>
                  <div class="n-lesson-meta">${esc(l.TanarNeve || "")}${l.Allapot?.Nev ? " · " + esc(l.Allapot.Nev) : ""}</div>
                </div>
                <div class="n-lesson-meta">${esc(l.TeremNeve || "")}</div>
              </div>`).join("")}
          </div>
        </div>`;
    })
    .join("");
}

function renderHomework() {
  const list = Array.isArray(cache.homework) ? cache.homework : [];
  if (!list.length) return `<div class="n-panel"><div class="n-panel-body">${empty("Nincsenek házi feladatok.")}</div></div>`;

  const sorted = [...list].sort((a, b) => new Date(a.HataridoDatuma || a.Hatarido || 0) - new Date(b.HataridoDatuma || b.Hatarido || 0));

  return `
    <div class="n-panel">
      <div class="n-panel-head">Házi feladatok</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Tantárgy</th><th>Feladat</th><th>Tanár</th><th>Feladva</th><th>Határidő</th><th>Állapot</th></tr></thead>
          <tbody>${sorted.map((h) => {
            const done = !!h.IsMegoldva;
            return `<tr>
              <td>${esc(subjectName(h))}</td>
              <td>${esc(h.Szoveg || "—")}</td>
              <td>${esc(h.RogzitoTanarNeve || "—")}</td>
              <td>${fmtDate(h.FeladasDatuma || h.RogzitesIdopontja)}</td>
              <td>${fmtDate(h.HataridoDatuma || h.Hatarido)}</td>
              <td><span class="n-badge ${done ? "n-badge-ok" : "n-badge-warn"}">${done ? "Kész" : "Nyitott"}</span></td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>
    </div>`;
}

function renderTests() {
  const list = Array.isArray(cache.tests) ? cache.tests : [];
  if (!list.length) return `<div class="n-panel"><div class="n-panel-body">${empty("Nincsenek bejelentett számonkérések.")}</div></div>`;

  const sorted = [...list].sort((a, b) => new Date(a.Datum || 0) - new Date(b.Datum || 0));

  return `
    <div class="n-panel">
      <div class="n-panel-head">Bejelentett számonkérések</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Dátum</th><th>Tantárgy</th><th>Téma</th><th>Mód</th><th>Tanár</th><th>Bejelentés</th></tr></thead>
          <tbody>${sorted.map((t) => `
            <tr>
              <td>${fmtDate(t.Datum)}</td>
              <td>${esc(subjectName(t))}</td>
              <td>${esc(t.Temaja || "—")}</td>
              <td>${esc(t.Modja?.Nev || "—")}</td>
              <td>${esc(t.RogzitoTanarNeve || "—")}</td>
              <td>${fmtDate(t.BejelentesDatuma)}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>
    </div>`;
}

function renderAbsences() {
  const list = Array.isArray(cache.absences) ? cache.absences : [];
  if (!list.length) return `<div class="n-panel"><div class="n-panel-body">${empty("Nincsenek mulasztások.")}</div></div>`;

  const sorted = [...list].sort((a, b) => new Date(b.Datum || 0) - new Date(a.Datum || 0));

  return `
    <div class="n-panel">
      <div class="n-panel-head">Mulasztások</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Dátum</th><th>Tantárgy</th><th>Óra</th><th>Típus</th><th>Igazolás</th><th>Tanár</th></tr></thead>
          <tbody>${sorted.map((m) => {
            const st = m.IgazolasAllapota || "";
            const badge = st === "Igazolt" ? "n-badge-ok" : st ? "n-badge-warn" : "n-badge-bad";
            return `<tr>
              <td>${fmtDate(m.Datum)}</td>
              <td>${esc(subjectName(m))}</td>
              <td>${esc(m.Ora?.Oraszam ?? "—")}</td>
              <td>${esc(m.Tipus?.Nev || "—")}</td>
              <td><span class="n-badge ${badge}">${esc(st || "Nincs")}</span></td>
              <td>${esc(m.RogzitoTanarNeve || "—")}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      </div>
    </div>`;
}

function renderNotices() {
  const list = Array.isArray(cache.notices) ? cache.notices : [];
  if (!list.length) return `<div class="n-panel"><div class="n-panel-body">${empty("A faliújság üres.")}</div></div>`;

  return list.map((n) => `
    <div class="n-panel">
      <div class="n-panel-head">${esc(n.Cim || "Közlemény")}</div>
      <div class="n-panel-body">
        <div class="n-list-meta" style="margin-bottom:8px;">${esc(n.RogzitoNeve || "")} · ${fmtDate(n.ErvenyessegKezdete)} – ${fmtDate(n.ErvenyessegVege)}</div>
        <div style="white-space:pre-wrap;">${esc(n.TartalomText || n.Tartalom || "")}</div>
      </div>
    </div>`).join("");
}

function renderNotes() {
  const list = Array.isArray(cache.notes) ? cache.notes : [];
  if (!list.length) return `<div class="n-panel"><div class="n-panel-body">${empty("Nincsenek feljegyzések.")}</div></div>`;

  const sorted = [...list].sort((a, b) => new Date(b.Datum || b.KeszitesDatuma || 0) - new Date(a.Datum || a.KeszitesDatuma || 0));

  return `
    <div class="n-panel">
      <div class="n-panel-head">Feljegyzések</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Dátum</th><th>Cím / típus</th><th>Tartalom</th><th>Tanár</th></tr></thead>
          <tbody>${sorted.map((n) => `
            <tr>
              <td>${fmtDate(n.Datum || n.KeszitesDatuma)}</td>
              <td>${esc(n.Cim || n.Tipus?.Nev || "—")}</td>
              <td>${esc(n.Tartalom || n.Szoveg || "—")}</td>
              <td>${esc(n.KeszitoTanarNeve || "—")}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>
    </div>`;
}

function renderProfile() {
  const s = cache.student || {};
  const groups = Array.isArray(cache.groups) ? cache.groups : [];
  const gonds = Array.isArray(s.Gondviselok) ? s.Gondviselok : [];
  const birth = s.SzuletesiEv && s.SzuletesiHonap && s.SzuletesiNap
    ? `${s.SzuletesiEv}.${String(s.SzuletesiHonap).padStart(2, "0")}.${String(s.SzuletesiNap).padStart(2, "0")}.`
    : "—";

  return `
    <div class="n-grid n-grid-2">
      <div class="n-panel">
        <div class="n-panel-head">Személyes adatok</div>
        <div class="n-panel-body" style="padding:0;">
          <div class="n-kv">
            <div class="k">Név</div><div>${esc(s.Nev || "—")}</div>
            <div class="k">E-mail</div><div>${esc(s.EmailCim || "—")}</div>
            <div class="k">Születési dátum</div><div>${esc(birth)}</div>
            <div class="k">Cím</div><div>${esc((s.Cimek && s.Cimek[0]) || "—")}</div>
            <div class="k">UID</div><div>${esc(s.Uid || "—")}</div>
          </div>
        </div>
      </div>
      <div class="n-panel">
        <div class="n-panel-head">Intézmény / képzés</div>
        <div class="n-panel-body" style="padding:0;">
          <div class="n-kv">
            <div class="k">Intézmény</div><div>${esc(s.IntezmenyNev || "—")}</div>
            <div class="k">Azonosító</div><div>${esc(s.IntezmenyAzonosito || "—")}</div>
            <div class="k">Tanév</div><div>${esc(s.TanevUid || "—")}</div>
            <div class="k">Osztály</div><div>${esc(groups.map((g) => g.Nev).filter(Boolean).join(", ") || "—")}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="n-panel">
      <div class="n-panel-head">Gondviselők</div>
      <div class="n-panel-body">
        ${gonds.length === 0 ? empty("Nincs gondviselő adat.") : `<ul class="n-list">${gonds.map((g) => `
          <li>
            <div class="n-list-title">${esc(g.Nev || "—")}</div>
            <div class="n-list-meta">${esc(g.EmailCim || "")}${g.Telefonszam ? " · " + esc(g.Telefonszam) : ""}${g.IsTorvenyesKepviselo ? " · Törvényes képviselő" : ""}</div>
          </li>`).join("")}</ul>`}
      </div>
    </div>`;
}

const RENDERERS = {
  dashboard: renderDashboard,
  grades: renderGrades,
  timetable: renderTimetable,
  homework: renderHomework,
  tests: renderTests,
  absences: renderAbsences,
  notices: renderNotices,
  notes: renderNotes,
  profile: renderProfile
};

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").style.display = "none";
}

function navigate(page) {
  if (!RENDERERS[page]) page = "dashboard";
  currentPage = page;
  document.getElementById("pageTitle").textContent = PAGE_META[page];
  document.getElementById("bcPage").textContent = PAGE_META[page];
  document.querySelectorAll(".n-nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  const el = document.getElementById("pageContent");
  try {
    el.innerHTML = RENDERERS[page]();
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="n-panel"><div class="n-panel-body">${empty("Hiba a nézet megjelenítésekor.")}</div></div>`;
  }
  closeSidebar();
}

function fillHeader() {
  const s = cache.student || {};
  document.getElementById("userName").textContent = s.Nev || localStorage.getItem("local_usr") || "Hallgató";
  document.getElementById("userCode").textContent = s.Uid ? `UID: ${s.Uid}` : "";
  document.getElementById("instName").textContent = s.IntezmenyNev || "KRÁTA";
}

async function boot() {
  accessToken = getStoredToken();
  if (!accessToken) {
    window.location.href = LOGIN_URL;
    return;
  }

  document.getElementById("logoutBtn").addEventListener("click", goLogin);
  document.getElementById("menuBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("overlay").style.display = "block";
  });
  document.getElementById("overlay").addEventListener("click", closeSidebar);
  document.querySelectorAll(".n-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });

  try {
    await loadAllData();
    document.getElementById("bootMsg").style.display = "none";
    document.getElementById("appShell").style.display = "block";
    fillHeader();
    navigate("dashboard");
  } catch (e) {
    console.error(e);
    document.getElementById("bootMsg").textContent = "Nem sikerült betölteni. Átirányítás a bejelentkezéshez...";
    setTimeout(goLogin, 1200);
  }
}

boot();
