/* ============================================================
   KRÁTA Oktatói Web (Neptun-szerű)
   Login a főoldalon. Token nélkül → fő login.
   ============================================================ */

const API_BASE = "https://ujkreta.onrender.com";
const LOGIN_URL = "https://puspus-dev.github.io/ujkreta/";

const TOKEN_KEYS = ["access_token", "ujkreta_access_token"];
const REFRESH_KEYS = ["refresh_token", "ujkreta_refresh_token"];

const PAGE_META = {
  dashboard: "Kezdőlap",
  grade: "Jegy beírása",
  grades: "Beírt jegyek",
  students: "Tanulók",
  timetable: "Órarend",
  homework: "Házi feladatok",
  profile: "Profil"
};

const GRADE_TEXT = {
  1: "Elégtelen",
  2: "Elégséges",
  3: "Közepes",
  4: "Jó",
  5: "Jeles"
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
  for (const k of [...TOKEN_KEYS, ...REFRESH_KEYS, "local_usr", "local_pw", "ujkreta_role"]) {
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

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (res.status === 401) {
    goLogin();
    throw new Error("401");
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) {
    const msg = data?.error_description || data?.error || data?.message || `Hiba (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function loadAllData() {
  const map = {
    teacher: "/naplo/v3/sajat/TanarAdatlap",
    groups: "/naplo/v3/sajat/OsztalyCsoportok",
    students: "/naplo/v3/sajat/Tanulok",
    grades: "/naplo/v3/sajat/Ertekelesek",
    timetable: "/naplo/v3/sajat/OrarendElemek",
    homework: "/naplo/v3/sajat/HaziFeladatok"
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

function studentByUid(uid) {
  const list = Array.isArray(cache.students) ? cache.students : [];
  return list.find((s) => String(s.Uid) === String(uid));
}

/* ---------- pages ---------- */

function renderDashboard() {
  const t = cache.teacher || {};
  const students = Array.isArray(cache.students) ? cache.students : [];
  const grades = Array.isArray(cache.grades) ? cache.grades : [];
  const groups = Array.isArray(cache.groups) ? cache.groups : [];
  const subjects = Array.isArray(t.Tantargyak) ? t.Tantargyak : [];

  const recent = [...grades]
    .sort((a, b) => new Date(b.KeszitesDatuma || b.RogzitesDatuma || 0) - new Date(a.KeszitesDatuma || a.RogzitesDatuma || 0))
    .slice(0, 8);

  return `
    <div class="n-welcome">
      <h2>Üdvözöljük, ${esc(t.Nev || "Tanár")}!</h2>
      <p>${esc(t.IntezmenyNev || "")} · Oktatói felület</p>
    </div>

    <div class="n-grid n-grid-4" style="margin-bottom:14px;">
      <div class="n-stat"><div class="n-stat-label">Tanulók</div><div class="n-stat-value">${students.length}</div></div>
      <div class="n-stat"><div class="n-stat-label">Beírt jegyek</div><div class="n-stat-value">${grades.length}</div></div>
      <div class="n-stat"><div class="n-stat-label">Osztályok</div><div class="n-stat-value">${groups.length}</div></div>
      <div class="n-stat"><div class="n-stat-label">Tantárgyak</div><div class="n-stat-value">${subjects.length}</div></div>
    </div>

    <div class="n-panel">
      <div class="n-panel-head">Gyors művelet</div>
      <div class="n-panel-body">
        <button type="button" class="n-btn" id="goGradeBtn">Új jegy beírása</button>
      </div>
    </div>

    <div class="n-panel">
      <div class="n-panel-head">Legutóbbi beírt jegyek</div>
      <div class="n-panel-body" style="padding:0;">
        ${recent.length === 0 ? `<div class="n-panel-body">${empty("Még nincs beírt jegy.")}</div>` : `
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Jegy</th><th>Tantárgy</th><th>Téma</th><th>Tanuló</th><th>Dátum</th></tr></thead>
          <tbody>${recent.map((g) => {
            const st = studentByUid(g.TanuloUid || g.Tanulo?.Uid);
            return `<tr>
              <td><span class="n-grade ${gradeClass(g.SzamErtek)}">${esc(g.SzamErtek ?? g.SzovegesErtek ?? "?")}</span></td>
              <td>${esc(subjectName(g))}</td>
              <td>${esc(g.Tema || "—")}</td>
              <td>${esc(st?.Nev || g.TanuloUid || "—")}</td>
              <td>${fmtDate(g.KeszitesDatuma || g.RogzitesDatuma)}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>`}
      </div>
    </div>
  `;
}

function renderGradeForm() {
  const t = cache.teacher || {};
  const subjects = Array.isArray(t.Tantargyak) ? t.Tantargyak : [];
  const students = Array.isArray(cache.students) ? cache.students : [];
  const groups = Array.isArray(cache.groups) ? cache.groups : [];

  const subjOpts = subjects.map((s) =>
    `<option value="${esc(s.Uid)}">${esc(s.Nev)}</option>`
  ).join("");

  const studOpts = students.map((s) =>
    `<option value="${esc(s.Uid)}" data-group="${esc(s.OsztalyCsoport?.Uid || "")}">${esc(s.Nev)} (${esc(s.OsztalyCsoport?.Nev || "")})</option>`
  ).join("");

  const groupOpts = groups.map((g) =>
    `<option value="${esc(g.Uid)}">${esc(g.Nev)}</option>`
  ).join("");

  return `
    <div class="n-panel">
      <div class="n-panel-head">Új értékelés rögzítése</div>
      <div class="n-panel-body">
        <div id="gradeMsg" style="display:none;"></div>
        <form id="gradeForm" class="n-form-grid" autocomplete="off">
          <label for="gStudent">Tanuló</label>
          <select id="gStudent" required>
            <option value="">— válasszon —</option>
            ${studOpts || '<option value="" disabled>Nincs tanuló</option>'}
          </select>

          <label for="gGroup">Osztály</label>
          <select id="gGroup" required>
            <option value="">— válasszon —</option>
            ${groupOpts}
          </select>

          <label for="gSubject">Tantárgy</label>
          <select id="gSubject" required>
            <option value="">— válasszon —</option>
            ${subjOpts || '<option value="" disabled>Nincs tantárgy</option>'}
          </select>

          <label for="gValue">Érdemjegy</label>
          <select id="gValue" required>
            <option value="5">5 – Jeles</option>
            <option value="4">4 – Jó</option>
            <option value="3">3 – Közepes</option>
            <option value="2">2 – Elégséges</option>
            <option value="1">1 – Elégtelen</option>
          </select>

          <label for="gWeight">Súly (%)</label>
          <input id="gWeight" type="number" min="1" max="400" value="100" required />

          <label for="gType">Típus</label>
          <select id="gType">
            <option value="1|Írásbeli|Írásbeli felelet">Írásbeli</option>
            <option value="2|Szóbeli|Szóbeli felelet">Szóbeli</option>
            <option value="3|Dolgozat|Témazáró dolgozat">Dolgozat</option>
            <option value="4|Gyakorlati|Gyakorlati feladat">Gyakorlati</option>
          </select>

          <label for="gTema">Téma</label>
          <input id="gTema" type="text" placeholder="pl. Másodfokú egyenletek" />

          <div class="n-form-actions">
            <button type="submit" class="n-btn" id="gradeSubmit">Jegy mentése</button>
            <button type="reset" class="n-btn n-btn-secondary">Törlés</button>
          </div>
        </form>
      </div>
    </div>

    <div class="n-panel">
      <div class="n-panel-head">Tanulók listája (gyorsválasztás)</div>
      <div class="n-panel-body" style="padding:0;">
        ${students.length === 0 ? `<div class="n-panel-body">${empty("Nincs tanuló.")}</div>` : `
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Név</th><th>Osztály</th><th>E-mail</th><th></th></tr></thead>
          <tbody>${students.map((s) => `
            <tr>
              <td>${esc(s.Nev)}</td>
              <td>${esc(s.OsztalyCsoport?.Nev || "—")}</td>
              <td>${esc(s.EmailCim || "—")}</td>
              <td><button type="button" class="n-btn n-btn-secondary pick-student" data-uid="${esc(s.Uid)}" data-group="${esc(s.OsztalyCsoport?.Uid || "")}">Kiválaszt</button></td>
            </tr>`).join("")}</tbody>
        </table></div>`}
      </div>
    </div>
  `;
}

function bindGradeForm() {
  const form = document.getElementById("gradeForm");
  if (!form) return;

  const studentSel = document.getElementById("gStudent");
  const groupSel = document.getElementById("gGroup");

  studentSel.addEventListener("change", () => {
    const opt = studentSel.selectedOptions[0];
    const g = opt?.dataset?.group;
    if (g && groupSel.querySelector(`option[value="${CSS.escape(g)}"]`)) {
      groupSel.value = g;
    }
  });

  document.querySelectorAll(".pick-student").forEach((btn) => {
    btn.addEventListener("click", () => {
      studentSel.value = btn.dataset.uid;
      if (btn.dataset.group) groupSel.value = btn.dataset.group;
      studentSel.dispatchEvent(new Event("change"));
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("gradeMsg");
    const submit = document.getElementById("gradeSubmit");
    const szam = Number(document.getElementById("gValue").value);
    const typeRaw = document.getElementById("gType").value.split("|");
    const body = {
      TantargyUid: document.getElementById("gSubject").value,
      Tema: document.getElementById("gTema").value.trim() || "Értékelés",
      SzamErtek: szam,
      SzovegesErtek: GRADE_TEXT[szam] || String(szam),
      SulySzazalekErteke: Number(document.getElementById("gWeight").value) || 100,
      Tipus: {
        Uid: typeRaw[0] || "1",
        Nev: typeRaw[1] || "Írásbeli",
        Leiras: typeRaw[2] || "Írásbeli felelet"
      },
      OsztalyCsoportUid: document.getElementById("gGroup").value,
      TanuloUid: document.getElementById("gStudent").value
    };

    if (!body.TanuloUid || !body.TantargyUid || !body.OsztalyCsoportUid) {
      msg.className = "n-msg n-msg-err";
      msg.style.display = "block";
      msg.textContent = "Válassz tanulót, osztályt és tantárgyat.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Mentés...";
    msg.style.display = "none";

    try {
      await apiPost("/naplo/v3/sajat/Ertekelesek", body);
      // refresh grades
      cache.grades = await apiGet("/naplo/v3/sajat/Ertekelesek");
      msg.className = "n-msg n-msg-ok";
      msg.style.display = "block";
      const st = studentByUid(body.TanuloUid);
      msg.textContent = `Sikeres mentés: ${st?.Nev || body.TanuloUid} → ${szam} (${GRADE_TEXT[szam]})`;
      document.getElementById("gTema").value = "";
    } catch (err) {
      msg.className = "n-msg n-msg-err";
      msg.style.display = "block";
      msg.textContent = err.message || "Nem sikerült menteni.";
    } finally {
      submit.disabled = false;
      submit.textContent = "Jegy mentése";
    }
  });
}

function renderGrades() {
  const grades = Array.isArray(cache.grades) ? cache.grades : [];
  if (!grades.length) {
    return `<div class="n-panel"><div class="n-panel-body">${empty("Még nincs beírt értékelés.")}</div></div>`;
  }

  const sorted = [...grades].sort(
    (a, b) => new Date(b.KeszitesDatuma || b.RogzitesDatuma || 0) - new Date(a.KeszitesDatuma || a.RogzitesDatuma || 0)
  );

  return `
    <div class="n-panel">
      <div class="n-panel-head">Összes beírt jegy (${grades.length})</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead>
            <tr>
              <th>Dátum</th>
              <th>Jegy</th>
              <th>Tantárgy</th>
              <th>Téma</th>
              <th>Típus</th>
              <th>Tanuló</th>
              <th>Súly</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((g) => {
              const st = studentByUid(g.TanuloUid || g.Tanulo?.Uid);
              return `<tr>
                <td>${fmtDate(g.KeszitesDatuma || g.RogzitesDatuma)}</td>
                <td><span class="n-grade ${gradeClass(g.SzamErtek)}">${esc(g.SzamErtek ?? g.SzovegesErtek ?? "?")}</span></td>
                <td>${esc(subjectName(g))}</td>
                <td>${esc(g.Tema || "—")}</td>
                <td>${esc(g.Tipus?.Nev || "—")}</td>
                <td>${esc(st?.Nev || g.TanuloUid || "—")}</td>
                <td>${g.SulySzazalekErteke != null ? esc(g.SulySzazalekErteke) + "%" : "—"}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table></div>
      </div>
    </div>`;
}

function renderStudents() {
  const students = Array.isArray(cache.students) ? cache.students : [];
  if (!students.length) {
    return `<div class="n-panel"><div class="n-panel-body">${empty("Nincs tanuló a listában.")}</div></div>`;
  }

  return `
    <div class="n-panel">
      <div class="n-panel-head">Tanulók (${students.length})</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Név</th><th>UID</th><th>Osztály</th><th>E-mail</th><th></th></tr></thead>
          <tbody>${students.map((s) => `
            <tr>
              <td>${esc(s.Nev)}</td>
              <td>${esc(s.Uid)}</td>
              <td>${esc(s.OsztalyCsoport?.Nev || "—")}</td>
              <td>${esc(s.EmailCim || "—")}</td>
              <td><button type="button" class="n-btn n-btn-secondary grade-for" data-uid="${esc(s.Uid)}">Jegy beírása</button></td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>
    </div>`;
}

function renderTimetable() {
  const lessons = Array.isArray(cache.timetable) ? cache.timetable : [];
  if (!lessons.length) {
    return `<div class="n-panel"><div class="n-panel-body">${empty("Nincs órarend adat.")}</div></div>`;
  }

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
                  <div class="n-lesson-meta">${esc(l.OsztalyCsoport?.Nev || "")}${l.Allapot?.Nev ? " · " + esc(l.Allapot.Nev) : ""}</div>
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
  if (!list.length) {
    return `<div class="n-panel"><div class="n-panel-body">${empty("Nincsenek házi feladatok.")}</div></div>`;
  }

  return `
    <div class="n-panel">
      <div class="n-panel-head">Házi feladatok</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Tantárgy</th><th>Feladat</th><th>Osztály</th><th>Határidő</th><th>Rögzítő</th></tr></thead>
          <tbody>${list.map((h) => `
            <tr>
              <td>${esc(subjectName(h))}</td>
              <td>${esc(h.Szoveg || "—")}</td>
              <td>${esc(h.OsztalyCsoport?.Nev || h.OsztalyCsoport?.Uid || "—")}</td>
              <td>${fmtDate(h.HataridoDatuma || h.Hatarido)}</td>
              <td>${esc(h.RogzitoTanarNeve || "—")}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>
    </div>`;
}

function renderProfile() {
  const t = cache.teacher || {};
  const subjects = Array.isArray(t.Tantargyak) ? t.Tantargyak : [];
  const classes = Array.isArray(t.OsztalyFonokOsztalyok) ? t.OsztalyFonokOsztalyok : [];

  return `
    <div class="n-panel">
      <div class="n-panel-head">Oktatói adatok</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-kv">
          <div class="k">Név</div><div>${esc(t.Nev || "—")}</div>
          <div class="k">E-mail</div><div>${esc(t.EmailCim || "—")}</div>
          <div class="k">Telefon</div><div>${esc(t.Telefonszam || "—")}</div>
          <div class="k">UID</div><div>${esc(t.Uid || "—")}</div>
          <div class="k">Intézmény</div><div>${esc(t.IntezmenyNev || "—")}</div>
          <div class="k">Int. azonosító</div><div>${esc(t.IntezmenyAzonosito || "—")}</div>
        </div>
      </div>
    </div>
    <div class="n-grid n-grid-2">
      <div class="n-panel">
        <div class="n-panel-head">Tantárgyak</div>
        <div class="n-panel-body">
          ${subjects.length === 0 ? empty("Nincs tantárgy.") : `<ul class="n-list">${subjects.map((s) => `
            <li><div class="n-list-title">${esc(s.Nev)}</div><div class="n-list-meta">${esc(s.Uid)}</div></li>
          `).join("")}</ul>`}
        </div>
      </div>
      <div class="n-panel">
        <div class="n-panel-head">Osztályfőnöki osztályok</div>
        <div class="n-panel-body">
          ${classes.length === 0 ? empty("Nincs.") : `<ul class="n-list">${classes.map((c) => `
            <li><div class="n-list-title">${esc(c.Nev)}</div><div class="n-list-meta">${esc(c.Uid)}</div></li>
          `).join("")}</ul>`}
        </div>
      </div>
    </div>`;
}

const RENDERERS = {
  dashboard: renderDashboard,
  grade: renderGradeForm,
  grades: renderGrades,
  students: renderStudents,
  timetable: renderTimetable,
  homework: renderHomework,
  profile: renderProfile
};

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").style.display = "none";
}

function navigate(page, opts = {}) {
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

  if (page === "grade") bindGradeForm();
  if (page === "dashboard") {
    document.getElementById("goGradeBtn")?.addEventListener("click", () => navigate("grade"));
  }
  if (page === "students") {
    document.querySelectorAll(".grade-for").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigate("grade");
        const sel = document.getElementById("gStudent");
        if (sel) {
          sel.value = btn.dataset.uid;
          sel.dispatchEvent(new Event("change"));
        }
      });
    });
  }

  // optional preselect student
  if (page === "grade" && opts.studentUid) {
    const sel = document.getElementById("gStudent");
    if (sel) {
      sel.value = opts.studentUid;
      sel.dispatchEvent(new Event("change"));
    }
  }

  closeSidebar();
}

function fillHeader() {
  const t = cache.teacher || {};
  document.getElementById("userName").textContent = t.Nev || localStorage.getItem("local_usr") || "Tanár";
  document.getElementById("userCode").textContent = t.Uid ? `UID: ${t.Uid}` : "";
  document.getElementById("instName").textContent = t.IntezmenyNev || "KRÁTA";
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
    document.getElementById("bootMsg").textContent = "Nem sikerült betölteni. Átirányítás...";
    setTimeout(goLogin, 1200);
  }
}

boot();
