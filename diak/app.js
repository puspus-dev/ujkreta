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
  eugy: "e-Ügyintézés",
  tests: "Számonkérések",
  absences: "Mulasztások",
  notices: "Faliújság",
  notes: "Feljegyzések",
  profile: "Személyes adatok"
};

let accessToken = null;
let cache = {};
let currentPage = "dashboard";

function redirectIfWrongRole() {
  const role = (localStorage.getItem("ujkreta_role") || "").toLowerCase();
  if (role.indexOf("osztalyfonok") !== -1 || role === "of") {
    window.location.href = "https://puspus-dev.github.io/ujkreta/osztalyfonok/";
    return true;
  }
  if (role.indexOf("tanar") !== -1 || role === "teacher") {
    window.location.href = "https://puspus-dev.github.io/ujkreta/tanar/";
    return true;
  }
  return false;
}

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
  const grades = (Array.isArray(cache.grades) ? cache.grades : []).slice(0, 8);
  const abs = (Array.isArray(cache.absences) ? cache.absences : []).slice(0, 5);
  const notes = (Array.isArray(cache.notes) ? cache.notes : []).slice(0, 5);
  const tests = (Array.isArray(cache.tests) ? cache.tests : []).slice(0, 5);
  const notices = Array.isArray(cache.notices) ? cache.notices : [];

  const gradeRows = grades.length ? grades.map(g => {
    const n = g.SzamErtek ?? g.szamErtek ?? "";
    const sub = (g.Tantargy && (g.Tantargy.Nev || g.Tantargy.nev)) || g.Tema || "—";
    const d = fmtDate(g.KeszitesDatuma || g.RogzitesDatuma || "");
    return `<div class="k-grade-row"><div class="k-grade-num">${esc(n)}</div>
      <div><div>${esc(sub)}</div><div class="k-grade-meta">${esc(d)}</div></div></div>`;
  }).join("") : `<div class="k-card-empty">Nincsenek megjeleníthető értékelések</div>`;

  const absBody = abs.length ? abs.map(a =>
    `<div class="k-grade-row"><div>${esc(fmtDate(a.Datum || a.Kezdete || ""))}</div>
     <div class="k-grade-meta">${esc(a.Tipus?.Nev || a.IgazolasAllapota?.Nev || "Mulasztás")}</div></div>`
  ).join("") : `<div class="k-card-empty">Nincsenek megjeleníthető mulasztások</div>`;

  const noteBody = notes.length ? notes.map(n =>
    `<div class="k-grade-row"><div>${esc(n.Cim || n.Tipus?.Nev || "Feljegyzés")}</div>
     <div class="k-grade-meta">${esc(fmtDate(n.Datum || n.KeszitesDatuma || ""))}</div></div>`
  ).join("") : `<div class="k-card-empty">Nincs feljegyzés</div>`;

  const testBody = tests.length ? tests.map(t =>
    `<div class="k-grade-row"><div>${esc(t.Nev || t.Tema || "Dolgozat")}</div>
     <div class="k-grade-meta">${esc(fmtDate(t.Datum || t.BejelentesDatuma || ""))}</div></div>`
  ).join("") : `<div class="k-card-empty">Nincsenek megjeleníthető bejelentett dolgozatok</div>`;

  const tl = notices.length ? notices.map(n =>
    `<div class="k-tl-item"><div class="t">${esc(n.Cim || n.Title || "Bejegyzés")}</div>
     <div class="d">${esc(fmtDate(n.Datum || n.KeszitesDatuma || ""))}</div>
     <div>${esc(n.Szoveg || n.Leiras || "")}</div></div>`
  ).join("") : `<div class="k-tl-body">A faliújság jelenleg üres</div>`;

  return `
    <div class="k-dash">
      <div class="k-card"><div class="k-card-h">Legutóbbi értékelések</div><div class="k-card-b">${gradeRows}</div></div>
      <div class="k-card"><div class="k-card-h">Legutóbbi mulasztások</div><div class="k-card-b">${absBody}</div></div>
      <div class="k-card"><div class="k-card-h">Legutóbbi feljegyzések</div><div class="k-card-b">${noteBody}</div></div>
      <div class="k-card"><div class="k-card-h">Következő bejelentett dolgozatok</div><div class="k-card-b">${testBody}</div></div>
    </div>
    <div class="k-timeline">
      <div class="k-tl-bar">Nincs bejegyzés</div>
      ${notices.length ? `<div class="k-tl-body">${tl}</div>` : `<div class="k-tl-body">A faliújság jelenleg üres</div>`}
    </div>`;
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


function absenceIcon(a) {
  const t = ((a.Tipus && (a.Tipus.Nev || a.Tipus.nev)) || a.TipusNev || "").toLowerCase();
  const ig = ((a.IgazolasAllapota && (a.IgazolasAllapota.Nev || a.IgazolasAllapota.nev)) || "").toLowerCase();
  if (t.indexOf("késés") >= 0 || t.indexOf("keses") >= 0) {
    if (ig.indexOf("igazolatlan") >= 0) return "icons/icon_igazolatlan_keses.png";
    if (ig.indexOf("igazolt") >= 0) return "icons/icon_igazolt_keses.png";
    return "icons/icon_pending_keses.png";
  }
  if (ig.indexOf("igazolatlan") >= 0) return "icons/icon_igazolatlan_hianyzas.png";
  if (ig.indexOf("igazolt") >= 0) return "icons/icon_igazolt_hianyzas.png";
  if (ig.indexOf("pending") >= 0 || ig.indexOf("függő") >= 0) return "icons/icon_pending_hianyzas.png";
  return "icons/icon_jelenlet.png";
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
    <div class="n-panel" style="margin-bottom:12px;">
      <div class="n-panel-body" style="display:flex;align-items:center;gap:16px;">
        <img src="icons/noprofilepic.png" alt="Profilkép" class="profile-pic" width="72" height="72"
          style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--ek-line,#c5d3e2);background:#f4f4f4;">
        <div>
          <div style="font-size:18px;font-weight:700;">${esc(s.Nev || "—")}</div>
          <div style="color:var(--k-muted,#5a6a70);font-size:13px;">${esc(s.EmailCim || "")}</div>
        </div>
      </div>
    </div>
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
  eugy: renderEUGY,
  profile: renderProfile
};

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  const o = document.getElementById("overlay");
  if (o) o.style.display = "none";
}

function navigate(page) {
  if (page === "eugy") {
    window.location.href = "https://puspus-dev.github.io/ujkreta/eugyintezes/";
    return;
  }

  if (!RENDERERS[page]) page = "dashboard";
  currentPage = page;
  document.querySelectorAll(".k-nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  document.querySelectorAll(".m-tab[data-page]").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  const el = document.getElementById("pageContent");
  try {
    el.innerHTML = RENDERERS[page]();
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="k-panel">Hiba a nézet megjelenítésekor.</div>`;
  }
}

function fillHeader() {
  const s = cache.student || {};
  document.getElementById("userName").textContent = s.Nev || localStorage.getItem("local_usr") || "Hallgató";
  document.getElementById("userCode").textContent = s.Uid ? `UID: ${s.Uid}` : "";
  document.getElementById("instName").textContent = s.IntezmenyNev || "KRÁTA";
  const ty = document.getElementById("tanev");
  if (ty) ty.textContent = s.TanevUid || "";
}



/* ===== Böngésző értesítés új jegyről ===== */
async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (_) {}
  }
}

function gradeKey(g) {
  return String(g.Uid || g.Id || (g.Tantargy && (g.Tantargy.Nev || g.Tantargy.nev) || "") + "|" + (g.KeszitesDatuma || g.RogzitesDatuma || "") + "|" + (g.SzamErtek ?? g.SzovegesErtek ?? ""));
}

let lastKnownGradeIds = new Set(JSON.parse(localStorage.getItem("lastGradeIds") || "[]"));

async function checkNewGrades() {
  try {
    const grades = await apiGet("/ellenorzo/v3/sajat/Ertekelesek");
    if (!Array.isArray(grades)) return;
    const currentIds = new Set(grades.map(gradeKey));
    const isFirstRun = lastKnownGradeIds.size === 0;
    const newOnes = isFirstRun ? [] : grades.filter((g) => !lastKnownGradeIds.has(gradeKey(g)));
    if (newOnes.length && Notification.permission === "granted") {
      newOnes.forEach((g) => {
        const subject = (g.Tantargy && (g.Tantargy.Nev || g.Tantargy.nev)) || g.Tema || "Ismeretlen tárgy";
        const value = g.SzamErtek ?? g.SzovegesErtek ?? "?";
        try {
          new Notification("Új jegy érkezett!", {
            body: subject + ": " + value,
            icon: "krata-logo.png",
            tag: "uj-jegy-" + gradeKey(g)
          });
        } catch (_) {}
      });
    }
    lastKnownGradeIds = currentIds;
    localStorage.setItem("lastGradeIds", JSON.stringify([...currentIds]));
  } catch (e) {
    console.warn("checkNewGrades", e);
  }
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
  document.querySelectorAll(".k-nav-item").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });

  document.querySelectorAll(".m-tab[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });
  document.getElementById("moreBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("overlay").style.display = "block";
  });

  try {
    await loadAllData();
  } catch (e) {
    console.error("loadAllData", e);
  }
  document.getElementById("bootMsg").style.display = "none";
  document.getElementById("appShell").style.display = "block";
  try { fillHeader(); } catch (e) { console.warn(e); }
  navigate("dashboard");
  requestNotificationPermission();
  checkNewGrades();
  setInterval(checkNewGrades, 3 * 60 * 1000);
}

boot();


function renderEUGY() {
  window.location.href = "https://puspus-dev.github.io/ujkreta/eugyintezes/";
  return `<div class="k-panel"><p>Átirányítás az e-Ügyintézéshez…</p>
    <p><a class="k-logout" href="https://puspus-dev.github.io/ujkreta/eugyintezes/">Megnyitás →</a></p></div>`;
}
