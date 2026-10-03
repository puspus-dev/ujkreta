/* KRÁTA Osztályfőnök – diák+user, jegy, mulasztás, házi, órarend. Nincs tanár/konfig/iskola. */
const API_BASE = "https://ujkreta.onrender.com";
const LOGIN_URL = "https://puspus-dev.github.io/ujkreta/";
const TOKEN_KEYS = ["access_token", "ujkreta_access_token", "of_access_token"];
const PAGE_META = {
  eugy: "e-Ügyintézés",
  documents: "Digitális dokumentumok",
  dkt: "DKT",
  dashboard: "Kezdőlap",
  naplo: renderNaplo,
  grade: "Jegy beírása",
  grades: "Beírt jegyek",
  absences: "Mulasztások",
  students: "Tanulók",
  studentNew: "Új diák",
  timetable: "Órarend",
  homework: "Házi feladatok",
  profile: "Profil"
};
const GRADE_TEXT = { 1: "Elégtelen", 2: "Elégséges", 3: "Közepes", 4: "Jó", 5: "Jeles" };

let accessToken = null;
let cache = {};
let currentPage = "dashboard";
let pendingGrades = {};

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function empty(t) { return `<div class="n-empty">${esc(t)}</div>`; }
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("hu-HU"); } catch { return String(d).slice(0,10); }
}
function fmtTime(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleTimeString("hu-HU",{hour:"2-digit",minute:"2-digit"}); } catch { return ""; }
}
function weekdayName(date) {
  try { return new Date(date).toLocaleDateString("hu-HU",{weekday:"long"}); } catch { return date; }
}
function subjectName(x) {
  return x?.Tantargy?.Nev || x?.TantargyNev || x?.Nev || "";
}
function gradeClass(n) {
  n = Number(n);
  if (n >= 5) return "g5"; if (n >= 4) return "g4"; if (n >= 3) return "g3"; if (n >= 2) return "g2"; return "g1";
}
function genUid() {
  return "OA" + String(Date.now()).slice(-6) + String(Math.floor(Math.random()*900+100));
}

function getStoredToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function saveToken(t) {
  accessToken = t;
  localStorage.setItem("of_access_token", t);
  localStorage.setItem("access_token", t);
}
function clearTokens() {
  TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem("ujkreta_role");
}
function goLogin() {
  clearTokens();
  window.location.href = LOGIN_URL;
}

function parseRoleFromIdToken(idToken) {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
    return payload.role || payload["kreta:role"] || "";
  } catch { return ""; }
}

async function login(username, password) {
  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
    client_id: "ekrata-naplo-web"
  });
  const res = await fetch(API_BASE + "/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || "Belépés sikertelen");
  const role = parseRoleFromIdToken(data.id_token) || "";
  if (role && role !== "Osztalyfonok" && role !== "Tanar") {
    throw new Error("Ez a fiók nem osztályfőnök/tanár. Role: " + role);
  }
  localStorage.setItem("ujkreta_role", role || "Osztalyfonok");
  saveToken(data.access_token);
  if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
  return data;
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" }
  });
  if (res.status === 401) { goLogin(); throw new Error("401"); }
  if (!res.ok) return null;
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (res.status === 401) { goLogin(); throw new Error("401"); }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) {
    throw new Error((data && (data.message || data.error)) || ("Hiba " + res.status));
  }
  return data;
}
async function apiDelete(path) {
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" }
  });
  if (res.status === 401) { goLogin(); throw new Error("401"); }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) throw new Error((data && data.error) || ("Hiba " + res.status));
  return data;
}

async function loadAllData() {
  const map = {
    teacher: "/naplo/v3/sajat/TanarAdatlap",
    groups: "/naplo/v3/sajat/OsztalyCsoportok",
    students: "/naplo/v3/sajat/Tanulok",
    grades: "/naplo/v3/sajat/Ertekelesek",
    timetable: "/naplo/v3/sajat/OrarendElemek",
    homework: "/naplo/v3/sajat/HaziFeladatok",
    absences: "/naplo/v3/sajat/Mulasztasok"
  };
  // OF multi list fallback
  const ofStudents = await apiGet("/naplo/v3/sajat/Of/Diakok").catch(() => null);
  const entries = await Promise.all(
    Object.entries(map).map(async ([k, p]) => [k, await apiGet(p)])
  );
  cache = Object.fromEntries(entries);
  if (Array.isArray(ofStudents) && ofStudents.length) {
    // normalize to TeacherStudent-like
    cache.students = ofStudents.map(s => ({
      Uid: s.Uid,
      Nev: s.Nev,
      EmailCim: s.EmailCim,
      OsztalyCsoport: { Uid: s.class_group_uid || "", Nev: "" }
    }));
  }
  if (!Array.isArray(cache.students)) cache.students = [];
}

function renderDashboard() {
  const st = cache.students || [];
  const gr = cache.grades || [];
  const hw = cache.homework || [];
  return `
    <div class="n-stats">
      <div class="n-stat"><div class="n-stat-label">Tanulók</div><div class="n-stat-value">${st.length}</div></div>
      <div class="n-stat"><div class="n-stat-label">Jegyek</div><div class="n-stat-value">${Array.isArray(gr)?gr.length:0}</div></div>
      <div class="n-stat"><div class="n-stat-label">Házik</div><div class="n-stat-value">${Array.isArray(hw)?hw.length:0}</div></div>
    </div>
    <div class="n-panel"><div class="n-panel-head">Gyors műveletek</div><div class="n-panel-body" style="display:flex;flex-wrap:wrap;gap:8px;">
      <button type="button" class="n-btn" data-go="grade">Jegy beírása</button>
      <button type="button" class="n-btn" data-go="studentNew">Új diák</button>
      <button type="button" class="n-btn" data-go="homework">Házi</button>
      <button type="button" class="n-btn" data-go="timetable">Órarend</button>
      <button type="button" class="n-btn" data-go="absences">Mulasztás</button>
    </div></div>
    <div class="n-panel"><div class="n-panel-body" style="font-size:13px;color:var(--n-muted);">
      Osztályfőnök: diák + diák-login, jegy, mulasztás, házi, órarend.
      <strong>Nem</strong> kezel iskolát, tanárt és rendszerszintű konfigot.
    </div></div>`;
}

function studentGrades(uid, subjectUid) {
  const grades = Array.isArray(cache.grades) ? cache.grades : [];
  return grades.filter(g => {
    const su = String(g.TanuloUid || g.Tanulo?.Uid || "");
    if (su && su !== String(uid)) return false;
    const sub = g.Tantargy?.Uid || "";
    if (subjectUid && sub && sub !== subjectUid) return false;
    return true;
  });
}
function avgOf(list) {
  const nums = list.map(g => Number(g.SzamErtek)).filter(n => n > 0);
  if (!nums.length) return "—";
  return (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2);
}

function renderGradeForm() {
  pendingGrades = {};
  const subjects = Array.isArray(cache.teacher?.Tantargyak) ? cache.teacher.Tantargyak : [];
  const students = cache.students || [];
  const groups = Array.isArray(cache.groups) ? cache.groups : [];
  const defaultGroup = groups[0]?.Uid || "";
  const defaultSubj = subjects[0]?.Uid || "";
  const rows = students.map((s, idx) => {
    const gs = studentGrades(s.Uid, defaultSubj);
    const chips = gs.map(g => `<span class="k-g k-g-${esc(g.SzamErtek)}" data-guid="${esc(g.Uid)}">${esc(g.SzamErtek)}</span>`).join(" ") || "—";
    return `<tr data-uid="${esc(s.Uid)}" data-group="${esc(s.OsztalyCsoport?.Uid||defaultGroup)}">
      <td class="k-num">${idx+1}</td><td>${esc(s.Nev)}</td>
      <td class="k-grades-cell">${chips}</td><td class="k-avg">${avgOf(gs)}</td>
      <td><div class="k-quick">
        <button type="button" class="k-q" data-v="5">5</button>
        <button type="button" class="k-q" data-v="4">4</button>
        <button type="button" class="k-q" data-v="3">3</button>
        <button type="button" class="k-q" data-v="2">2</button>
        <button type="button" class="k-q" data-v="1">1</button>
        <button type="button" class="k-q" data-v="x">x</button>
      </div></td></tr>`;
  }).join("") || `<tr><td colspan="5" class="n-empty">Nincs tanuló a listában.</td></tr>`;

  return `
    <div class="k-filters">
      <div><label>Osztály</label><select id="kbGroup">${groups.map(g=>`<option value="${esc(g.Uid)}">${esc(g.Nev)}</option>`).join("")||"<option value=''>—</option>"}</select></div>
      <div><label>Tantárgy</label><select id="kbSubject">${subjects.map(s=>`<option value="${esc(s.Uid)}">${esc(s.Nev)}</option>`).join("")||"<option value=''>—</option>"}</select></div>
      <div><label>Feljegyzés</label><input id="kbTema" type="text" placeholder="pl. Szódolgozat" /></div>
    </div>
    <div class="k-toolbar">
      <button type="button" class="k-btn k-btn-primary" id="kbSave">+ Mentés</button>
      <button type="button" class="k-btn" id="kbClearSel">Elölről</button>
    </div>
    <div class="k-book"><table class="k-table"><thead><tr>
      <th>#</th><th>Név</th><th>Jegyek</th><th>Átlag</th><th>Új</th>
    </tr></thead><tbody id="kbBody">${rows}</tbody></table></div>
    <div class="k-status" id="kbStatus">Válassz jegyet, majd Mentés.</div>`;
}

function bindGradeForm() {
  document.querySelectorAll("#kbBody .k-q").forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest("tr");
      const uid = row.dataset.uid;
      const v = btn.dataset.v;
      row.querySelectorAll(".k-q").forEach(b => b.classList.remove("k-selected"));
      if (v === "x") { delete pendingGrades[uid]; return; }
      btn.classList.add("k-selected");
      pendingGrades[uid] = { value: Number(v), group: row.dataset.group };
      document.getElementById("kbStatus").textContent = `Kijelölve → ${v}. Mentés kell.`;
    };
  });
  document.getElementById("kbClearSel")?.addEventListener("click", () => {
    pendingGrades = {};
    document.querySelectorAll(".k-q").forEach(b => b.classList.remove("k-selected"));
  });
  document.getElementById("kbSave")?.addEventListener("click", async () => {
    const status = document.getElementById("kbStatus");
    const subjectUid = document.getElementById("kbSubject").value;
    const groupUid = document.getElementById("kbGroup").value;
    const tema = document.getElementById("kbTema").value.trim() || "Értékelés";
    const entries = Object.entries(pendingGrades);
    if (!entries.length) { status.textContent = "Nincs kijelölés."; status.className = "k-status err"; return; }
    let ok = 0;
    for (const [uid, sel] of entries) {
      try {
        await apiPost("/naplo/v3/sajat/Ertekelesek", {
          TantargyUid: subjectUid, Tema: tema, SzamErtek: sel.value,
          SzovegesErtek: GRADE_TEXT[sel.value] || String(sel.value),
          SulySzazalekErteke: 100,
          OsztalyCsoportUid: sel.group || groupUid, TanuloUid: uid
        });
        ok++;
      } catch (_) {}
    }
    cache.grades = await apiGet("/naplo/v3/sajat/Ertekelesek");
    pendingGrades = {};
    status.className = "k-status ok";
    status.textContent = `Mentve: ${ok} jegy.`;
    navigate("grade");
  });
}

function renderGrades() {
  const grades = Array.isArray(cache.grades) ? cache.grades : [];
  if (!grades.length) return `<div class="n-panel"><div class="n-panel-body">${empty("Nincs jegy.")}</div></div>`;
  return `<div class="n-panel"><div class="n-panel-head">Jegyek (${grades.length})</div>
    <div class="n-panel-body" style="padding:0;"><div class="n-table-wrap"><table class="n-table">
    <thead><tr><th>Dátum</th><th>Jegy</th><th>Tantárgy</th><th>Diák</th><th></th></tr></thead>
    <tbody>${[...grades].reverse().map(g => {
      const st = (cache.students||[]).find(s => String(s.Uid)===String(g.TanuloUid));
      return `<tr><td>${fmtDate(g.KeszitesDatuma||g.RogzitesDatuma)}</td>
        <td><span class="n-grade ${gradeClass(g.SzamErtek)}">${esc(g.SzamErtek)}</span></td>
        <td>${esc(subjectName(g))}</td><td>${esc(st?.Nev||g.TanuloUid||"—")}</td>
        <td><button type="button" class="n-btn n-btn-secondary del-grade" data-uid="${esc(g.Uid)}">Törlés</button></td></tr>`;
    }).join("")}</tbody></table></div></div></div>`;
}

function renderStudents() {
  const st = cache.students || [];
  return `<div class="n-panel"><div class="n-panel-head">Tanulók (${st.length})
    <button type="button" class="n-btn" data-go="studentNew" style="float:right;margin-top:-2px;">+ Új diák</button></div>
    <div class="n-panel-body" style="padding:0;"><div class="n-table-wrap"><table class="n-table">
    <thead><tr><th>UID</th><th>Név</th><th>Osztály</th><th></th></tr></thead>
    <tbody>${st.map(s => `<tr>
      <td>${esc(s.Uid)}</td><td>${esc(s.Nev)}</td>
      <td>${esc(s.OsztalyCsoport?.Nev||s.OsztalyCsoport?.Uid||"—")}</td>
      <td><button type="button" class="n-btn n-btn-secondary" data-go="grade">Jegy</button></td>
    </tr>`).join("") || `<tr><td colspan="4">${empty("Nincs diák.")}</td></tr>`}
    </tbody></table></div></div></div>`;
}

function renderStudentNew() {
  const uid = genUid();
  const groups = Array.isArray(cache.groups) ? cache.groups : [];
  return `<div class="n-panel"><div class="n-panel-head">Új diák + login</div>
    <div class="n-panel-body">
      <div id="stuMsg" style="display:none;"></div>
      <form id="ofStuForm" class="n-form-grid">
        <label>UID</label><input id="stUid" required value="${esc(uid)}" />
        <label>Név *</label><input id="stNev" required placeholder="Teljes név" />
        <label>Osztály UID</label>
        <select id="stClass"><option value="">—</option>${groups.map(g=>`<option value="${esc(g.Uid)}">${esc(g.Nev)}</option>`).join("")}</select>
        <label>Login username</label><input id="stUser" placeholder="pl. anna" />
        <label>Login jelszó</label><input id="stPass" type="password" />
        <div class="n-form-actions"><button type="submit" class="n-btn">Mentés</button></div>
      </form>
      <p style="font-size:12px;color:var(--n-muted);">Csak diák profil + diák login. Tanár/OF fiókot az <strong>Admin</strong> hoz létre.</p>
    </div></div>`;
}

function bindStudentNew() {
  document.getElementById("ofStuForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("stuMsg");
    const student = {
      Uid: document.getElementById("stUid").value.trim(),
      Nev: document.getElementById("stNev").value.trim(),
      TanevUid: "2025/2026"
    };
    const classGroupUid = document.getElementById("stClass").value.trim();
    const username = document.getElementById("stUser").value.trim();
    const password = document.getElementById("stPass").value;
    try {
      // Prefer OF endpoint; fallback admin path won't work with bearer
      try {
        await apiPost("/naplo/v3/sajat/Of/Diakok", {
          student, classGroupUid, username: username || undefined, password: password || undefined
        });
      } catch (err1) {
        // fallback: only if Of route missing
        throw err1;
      }
      msg.className = "n-msg n-msg-ok";
      msg.style.display = "block";
      msg.textContent = "Diák elmentve" + (username ? " + login." : ".");
      await loadAllData();
      setTimeout(() => navigate("students"), 700);
    } catch (err) {
      msg.className = "n-msg n-msg-err";
      msg.style.display = "block";
      msg.textContent = (err.message || err) + " — telepítsd az of_role_patch.go-t + registerOFRoutes.";
    }
  });
}

function renderTimetable() {
  const lessons = Array.isArray(cache.timetable) ? cache.timetable : [];
  const groups = Array.isArray(cache.groups) ? cache.groups : [];
  const subjects = Array.isArray(cache.teacher?.Tantargyak) ? cache.teacher.Tantargyak : [];
  const listHtml = !lessons.length ? empty("Nincs órarend.") :
    lessons.slice(0, 80).map(l => `
      <div class="n-lesson">
        <div class="n-lesson-num">${esc(l.Oraszam??"")}.</div>
        <div class="n-lesson-time">${fmtTime(l.KezdetIdopont)}–${fmtTime(l.VegIdopont)}</div>
        <div><div class="n-lesson-subj">${esc(subjectName(l)||l.Nev)}</div>
        <div class="n-lesson-meta">${fmtDate(l.Datum)} · ${esc(l.OsztalyCsoport?.Nev||"")}</div></div>
        <div class="n-lesson-meta">${esc(l.TeremNeve||"")}</div>
      </div>`).join("");

  return `
    <div class="n-panel"><div class="n-panel-head">Órarend elemek</div>
      <div class="n-panel-body">${listHtml}</div></div>
    <div class="n-panel"><div class="n-panel-head">Megjegyzés</div>
      <div class="n-panel-body" style="font-size:13px;color:var(--n-muted);">
        Az órarend lista a napló API-ból jön. Új óra / törlés a szerveren jelenleg GET-orientált;
        házi és jegy teljes körűen kezelhető. Órarend szerkesztés bővíthető, ha a backend POST/DELETE-et kap.
      </div></div>`;
}

function renderHomework() {
  const list = Array.isArray(cache.homework) ? cache.homework : [];
  const groups = Array.isArray(cache.groups) ? cache.groups : [];
  const subjects = Array.isArray(cache.teacher?.Tantargyak) ? cache.teacher.Tantargyak : [];
  return `
    <div class="n-panel"><div class="n-panel-head">Új házi</div>
      <div class="n-panel-body">
        <div id="hwMsg" style="display:none;"></div>
        <form id="hwForm" class="n-form-grid">
          <label>Tantárgy</label>
          <select id="hwSubj" required>${subjects.map(s=>`<option value="${esc(s.Uid)}">${esc(s.Nev)}</option>`).join("")||"<option value=''>—</option>"}</select>
          <label>Osztály</label>
          <select id="hwGroup" required>${groups.map(g=>`<option value="${esc(g.Uid)}">${esc(g.Nev)}</option>`).join("")||"<option value=''>—</option>"}</select>
          <label>Feladat</label><input id="hwText" required placeholder="Szöveg" />
          <label>Határidő</label><input id="hwDue" type="date" required />
          <div class="n-form-actions"><button type="submit" class="n-btn">Házi mentése</button></div>
        </form>
      </div></div>
    <div class="n-panel"><div class="n-panel-head">Házi feladatok (${list.length})</div>
      <div class="n-panel-body" style="padding:0;"><div class="n-table-wrap"><table class="n-table">
        <thead><tr><th>Tantárgy</th><th>Feladat</th><th>Határidő</th><th></th></tr></thead>
        <tbody>${list.map(h => `<tr>
          <td>${esc(subjectName(h))}</td><td>${esc(h.Szoveg||"—")}</td>
          <td>${fmtDate(h.HataridoDatuma||h.Hatarido)}</td>
          <td><button type="button" class="n-btn n-btn-secondary del-hw" data-uid="${esc(h.Uid)}">Törlés</button></td>
        </tr>`).join("") || `<tr><td colspan="4">${empty("Nincs házi.")}</td></tr>`}
        </tbody></table></div></div></div>`;
}

function bindHomework() {
  document.getElementById("hwForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("hwMsg");
    try {
      await apiPost("/naplo/v3/sajat/HaziFeladatok", {
        TantargyUid: document.getElementById("hwSubj").value,
        Szoveg: document.getElementById("hwText").value.trim(),
        Hatarido: document.getElementById("hwDue").value + "T23:59:00",
        OsztalyCsoportUid: document.getElementById("hwGroup").value
      });
      cache.homework = await apiGet("/naplo/v3/sajat/HaziFeladatok");
      msg.className = "n-msg n-msg-ok"; msg.style.display = "block";
      msg.textContent = "Házi mentve.";
      navigate("homework");
    } catch (err) {
      msg.className = "n-msg n-msg-err"; msg.style.display = "block";
      msg.textContent = err.message || String(err);
    }
  });
  document.querySelectorAll(".del-hw").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Törlöd a házit?")) return;
      try {
        await apiDelete("/naplo/v3/sajat/HaziFeladatok?uid=" + encodeURIComponent(btn.dataset.uid));
        cache.homework = await apiGet("/naplo/v3/sajat/HaziFeladatok");
        navigate("homework");
      } catch (err) {
        alert("Törlés: " + err.message + " (backend DELETE kell a házira)");
      }
    });
  });
}

function renderAbsences() {
  const list = Array.isArray(cache.absences) ? cache.absences : [];
  const students = cache.students || [];
  const groups = Array.isArray(cache.groups) ? cache.groups : [];
  return `
    <div class="n-panel"><div class="n-panel-head">Új mulasztás</div>
      <div class="n-panel-body">
        <div id="absMsg" style="display:none;"></div>
        <form id="absForm" class="n-form-grid">
          <label>Diák</label>
          <select id="absStudent" required>${students.map(s=>`<option value="${esc(s.Uid)}">${esc(s.Nev)}</option>`).join("")}</select>
          <label>Osztály</label>
          <select id="absGroup">${groups.map(g=>`<option value="${esc(g.Uid)}">${esc(g.Nev)}</option>`).join("")||"<option value=''>—</option>"}</select>
          <label>Dátum</label><input id="absDate" type="date" required />
          <label>Típus</label>
          <select id="absType"><option value="1|Hiányzás|Hiányzás">Hiányzás</option><option value="2|Késés|Késés">Késés</option></select>
          <div class="n-form-actions"><button type="submit" class="n-btn">Mentés</button></div>
        </form>
      </div></div>
    <div class="n-panel"><div class="n-panel-head">Mulasztások</div>
      <div class="n-panel-body" style="padding:0;"><div class="n-table-wrap"><table class="n-table">
        <thead><tr><th>Dátum</th><th>Diák</th><th>Típus</th><th></th></tr></thead>
        <tbody>${(list||[]).map(o => {
          const st = students.find(s => String(s.Uid)===String(o.TanuloUid));
          return `<tr><td>${fmtDate(o.Datum)}</td><td>${esc(st?.Nev||o.TanuloUid)}</td>
            <td>${esc(o.Tipus?.Nev||"Hiányzás")}</td>
            <td><button type="button" class="n-btn n-btn-secondary del-abs" data-uid="${esc(o.Uid)}">Törlés</button></td></tr>`;
        }).join("") || `<tr><td colspan="4">${empty("Nincs.")}</td></tr>`}
        </tbody></table></div></div></div>`;
}

function bindAbsences() {
  const d = document.getElementById("absDate");
  if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  document.getElementById("absForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("absMsg");
    const typeRaw = document.getElementById("absType").value.split("|");
    try {
      await apiPost("/naplo/v3/sajat/Mulasztasok", {
        TanuloUid: document.getElementById("absStudent").value,
        Datum: document.getElementById("absDate").value + "T00:00:00",
        Tipus: { Uid: typeRaw[0], Nev: typeRaw[1], Leiras: typeRaw[2] },
        OsztalyCsoportUid: document.getElementById("absGroup").value
      });
      cache.absences = await apiGet("/naplo/v3/sajat/Mulasztasok");
      navigate("absences");
    } catch (err) {
      msg.className = "n-msg n-msg-err"; msg.style.display = "block";
      msg.textContent = err.message || String(err);
    }
  });
  document.querySelectorAll(".del-abs").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Törlés?")) return;
      try {
        await apiDelete("/naplo/v3/sajat/Mulasztasok?uid=" + encodeURIComponent(btn.dataset.uid));
        cache.absences = await apiGet("/naplo/v3/sajat/Mulasztasok");
        navigate("absences");
      } catch (err) { alert(err.message); }
    });
  });
}

function renderProfile() {
  const t = cache.teacher || {};
  return `<div class="n-panel"><div class="n-panel-head">Profil</div>
    <div class="n-panel-body" style="display:flex;align-items:center;gap:16px;">
      <img src="icons/noprofilepic.png" alt="Profilkép" class="profile-pic" width="72" height="72"
        style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #c5d3e2;background:#f4f4f4;">
      <div>
        <p style="margin:0;"><strong>${esc(t.Nev||"Osztályfőnök")}</strong></p>
        <p style="margin:4px 0;color:var(--n-muted);">${esc(t.EmailCim||"")}</p>
        <p style="margin:0;">Szerepkör: Osztályfőnök / tanári napló</p>
      </div>
    </div></div>`;
}

const RENDERERS = {
  eugy: renderEUGY,
  documents: renderDocuments,
  dkt: renderDKT,
  dashboard: renderDashboard,
  grade: renderGradeForm,
  grades: renderGrades,
  absences: renderAbsences,
  students: renderStudents,
  studentNew: renderStudentNew,
  timetable: renderTimetable,
  homework: renderHomework,
  profile: renderProfile
};




/* ===== DKT – Digitális Kollaborációs Tér ===== */
let dktSelected = null;

function dktStorageKey() {
  const uid = (cache.student && (cache.student.Uid || cache.student.uid)) ||
    (cache.teacher && (cache.teacher.Uid || cache.teacher.uid)) ||
    localStorage.getItem("local_usr") || "anon";
  return "krata_dkt_files_" + uid;
}

function dktLoadFiles() {
  try { return JSON.parse(localStorage.getItem(dktStorageKey()) || "{}"); }
  catch { return {}; }
}
function dktSaveFiles(map) {
  localStorage.setItem(dktStorageKey(), JSON.stringify(map));
}

function dktWorkspaces() {
  let list = Array.isArray(cache.dkt) ? cache.dkt.slice() : [];
  if (!list.length) {
    // API üres: tantárgyak a jegyekből / órarendből / tanári profilból
    const names = new Set();
    (Array.isArray(cache.grades) ? cache.grades : []).forEach((g) => {
      const n = (g.Tantargy && (g.Tantargy.Nev || g.Tantargy.nev)) || g.TantargyNev;
      if (n) names.add(n);
    });
    (Array.isArray(cache.timetable) ? cache.timetable : []).forEach((l) => {
      const n = (typeof subjectName === "function" ? subjectName(l) : null) || l.TantargyNev || l.Nev;
      if (n && n !== "?") names.add(n);
    });
    const tSubs = cache.teacher && Array.isArray(cache.teacher.Tantargyak) ? cache.teacher.Tantargyak : [];
    tSubs.forEach((s) => { if (s.Nev) names.add(s.Nev); });
    if (!names.size) {
      ["Matematika", "Magyar nyelv és irodalom", "Történelem", "Informatika"].forEach((n) => names.add(n));
    }
    list = [...names].sort((a, b) => a.localeCompare(b, "hu")).map((n, i) => ({
      tantargyId: i + 1,
      tantargyNev: n,
      alkalmazottNev: (cache.teacher && cache.teacher.Nev) || "Szaktanár",
      osztalyCsoportNev: (Array.isArray(cache.groups) && cache.groups[0] && cache.groups[0].Nev) || "Osztály",
      tipusId: 0,
      _local: true
    }));
  }
  return list;
}

function dktEnsureSeed(wsId, subj) {
  const map = dktLoadFiles();
  const key = String(wsId);
  if (!map[key] || !map[key].length) {
    map[key] = [
      { id: key + "-1", name: subj + " – tematika.pdf", type: "PDF", size: "245 KB", date: new Date().toISOString(), note: "Év eleji tematika" },
      { id: key + "-2", name: subj + " – órai jegyzet.docx", type: "DOCX", size: "88 KB", date: new Date().toISOString(), note: "Közös jegyzet" },
      { id: key + "-3", name: "Házi feladatok mappa", type: "Mappa", size: "—", date: new Date().toISOString(), note: "Digitális beadandók" }
    ];
    dktSaveFiles(map);
  }
  return map[key];
}

function renderDKT() {
  window.location.href = "https://puspus-dev.github.io/ujkreta/dkt/";
  return `<div class="n-panel"><div class="n-panel-body">Átirányítás a DKT oldalra…
    <a href="https://puspus-dev.github.io/ujkreta/dkt/">Megnyitás →</a></div></div>`;
}
function renderDKT_legacy() {
  const list = dktWorkspaces();
  if (dktSelected == null && list.length) {
    const first = list[0];
    dktSelected = String(first.tantargyId || first.TantargyId || first.tantargyNev || 0);
  }
  const cards = list.map((d) => {
    const id = String(d.tantargyId || d.TantargyId || d.tantargyNev || "");
    const subj = d.tantargyNev || d.TantargyNev || "Tantárgy";
    const teacher = d.alkalmazottNev || d.AlkalmazottNev || "—";
    const group = d.osztalyCsoportNev || d.OsztalyCsoportNev || "—";
    const active = id === String(dktSelected) ? " dkt-card-active" : "";
    return `<button type="button" class="dkt-card${active}" data-dkt-id="${esc(id)}" data-dkt-name="${esc(subj)}">
      <img src="icons/OktatasIgenyles.png" alt="" class="dkt-card-ico">
      <div class="dkt-card-title">${esc(subj)}</div>
      <div class="dkt-card-meta">${esc(teacher)} · ${esc(group)}</div>
    </button>`;
  }).join("");

  let filesHtml = `<div class="k-card-empty">Válassz munkateret a bal oldalon.</div>`;
  if (dktSelected != null) {
    const ws = list.find((d) => String(d.tantargyId || d.TantargyId || d.tantargyNev || "") === String(dktSelected));
    const subj = (ws && (ws.tantargyNev || ws.TantargyNev)) || "Munkatér";
    const files = dktEnsureSeed(dktSelected, subj);
    filesHtml = `
      <div class="dkt-files-head">
        <div>
          <strong>${esc(subj)}</strong>
          <span class="k-grade-meta"> · ${files.length} elem</span>
        </div>
        <button type="button" class="k-btn k-btn-primary" id="dktAddBtn">＋ Új dokumentum</button>
      </div>
      <div class="n-table-wrap"><table class="n-table">
        <thead><tr><th>Név</th><th>Típus</th><th>Méret</th><th>Dátum</th><th>Megjegyzés</th><th></th></tr></thead>
        <tbody>
          ${files.map((f) => `<tr>
            <td><img src="icons/${f.type === "Mappa" ? "Egyeb" : "note_text_f"}.png" class="doc-row-ico" alt=""> ${esc(f.name)}</td>
            <td>${esc(f.type)}</td>
            <td>${esc(f.size || "—")}</td>
            <td>${typeof fmtDate === "function" ? fmtDate(f.date) : (f.date || "—").slice(0, 10)}</td>
            <td class="k-grade-meta">${esc(f.note || "")}</td>
            <td><button type="button" class="k-logout dkt-del" data-id="${esc(f.id)}">Törlés</button></td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;
  }

  return `
    <div class="dkt-layout">
      <aside class="dkt-side">
        <div class="n-panel-head" style="border:1px solid var(--ek-line,#c5d3e2);border-bottom:0;background:#fff;">Munkaterek</div>
        <div class="dkt-cards">${cards || `<div class="k-card-empty">Nincs munkatér.</div>`}</div>
      </aside>
      <section class="dkt-main n-panel" style="margin:0;">
        <div class="n-panel-head">Dokumentumok a munkatérben</div>
        <div class="n-panel-body">${filesHtml}</div>
      </section>
    </div>`;
}

function bindDKT() {
  document.querySelectorAll(".dkt-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      dktSelected = btn.getAttribute("data-dkt-id");
      const el = document.getElementById("pageContent");
      if (el) { el.innerHTML = renderDKT(); bindDKT(); }
    });
  });
  document.getElementById("dktAddBtn")?.addEventListener("click", () => {
    const name = prompt("Dokumentum neve (pl. beadandó.pdf):");
    if (!name || !name.trim()) return;
    const map = dktLoadFiles();
    const key = String(dktSelected);
    const arr = map[key] || [];
    arr.unshift({
      id: key + "-" + Date.now(),
      name: name.trim(),
      type: name.toLowerCase().endsWith(".pdf") ? "PDF" : (name.toLowerCase().endsWith(".docx") ? "DOCX" : "Fájl"),
      size: "—",
      date: new Date().toISOString(),
      note: "Helyben hozzáadva"
    });
    map[key] = arr;
    dktSaveFiles(map);
    const el = document.getElementById("pageContent");
    if (el) { el.innerHTML = renderDKT(); bindDKT(); }
  });
  document.querySelectorAll(".dkt-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("Törlöd ezt az elemet?")) return;
      const map = dktLoadFiles();
      const key = String(dktSelected);
      map[key] = (map[key] || []).filter((f) => f.id !== btn.getAttribute("data-id"));
      dktSaveFiles(map);
      const el = document.getElementById("pageContent");
      if (el) { el.innerHTML = renderDKT(); bindDKT(); }
    });
  });
}

function renderDocuments() {
  const dkt = Array.isArray(cache.dkt) ? cache.dkt : [];
  const hw = Array.isArray(cache.homework) ? cache.homework : [];
  const workspaceRows = dkt.length
    ? dkt.map((d) => {
        const subj = d.tantargyNev || d.TantargyNev || "Tantárgy";
        const teacher = d.alkalmazottNev || d.AlkalmazottNev || "—";
        const group = d.osztalyCsoportNev || d.OsztalyCsoportNev || "—";
        return `<tr>
          <td><img src="icons/OktatasIgenyles.png" alt="" class="doc-row-ico"> ${esc(subj)}</td>
          <td>${esc(teacher)}</td>
          <td>${esc(group)}</td>
          <td><span class="n-badge n-badge-ok">Munkatér</span></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="4" class="k-card-empty">Nincs DKT munkatér adat.</td></tr>`;
  const docs = hw.slice(0, 15).map((h) => {
    const subj = (typeof subjectName === "function" ? subjectName(h) : null) || h.TantargyNev || h.Tantargy?.Nev || "Házi";
    return `<tr>
      <td><img src="icons/HaziFeladatHiany.png" alt="" class="doc-row-ico"> ${esc(subj)} – feladat</td>
      <td>Házi feladat</td>
      <td>${typeof fmtDate === "function" ? fmtDate(h.FeladasDatuma || h.HataridoDatuma || "") : (h.FeladasDatuma || "—")}</td>
      <td class="k-grade-meta">${esc(String(h.Szoveg || "").slice(0, 80))}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="4" class="k-card-empty">Nincs megjeleníthető dokumentum.</td></tr>`;
  return `
    <div class="n-panel">
      <div class="n-panel-head">Digitális Kollaborációs Tér</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Tantárgy</th><th>Tanár</th><th>Csoport</th><th>Státusz</th></tr></thead>
          <tbody>${workspaceRows}</tbody>
        </table></div>
      </div>
    </div>
    <div class="n-panel">
      <div class="n-panel-head">Digitális dokumentumok</div>
      <div class="n-panel-body" style="padding:0;">
        <div class="n-table-wrap"><table class="n-table">
          <thead><tr><th>Dokumentum</th><th>Típus</th><th>Dátum</th><th>Megjegyzés</th></tr></thead>
          <tbody>${docs}</tbody>
        </table></div>
      </div>
    </div>`;
}

function renderEUGY() {
  window.location.href = "https://puspus-dev.github.io/ujkreta/eugyintezes/";
  return `<div class="n-panel"><div class="n-panel-body">Átirányítás az e-Ügyintézéshez…
    <a class="k-logout" href="https://puspus-dev.github.io/ujkreta/eugyintezes/">Megnyitás →</a></div></div>`;
}

function navigate(page) {
  if (page === "eugy") {
    window.location.href = "https://puspus-dev.github.io/ujkreta/eugyintezes/";
    return;
  }
  if (page === "dkt") {
    window.location.href = "https://puspus-dev.github.io/ujkreta/dkt/";
    return;
  }
  if (page === "documents" && !cache.dkt) {
    (async () => {
      try {
        const data = await apiGet("/dktapi/intezmenyek/munkaterek/tanulok");
        cache.dkt = Array.isArray(data) ? data : [];
      } catch (e) { cache.dkt = []; }
      const el = document.getElementById("pageContent");
      if (el && currentPage === "documents") el.innerHTML = renderDocuments();
    })();
  }

  currentPage = page;
  document.querySelectorAll(".k-nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  (document.getElementById("pageTitle")||{}).textContent = PAGE_META[page] || page;
  (document.getElementById("bcPage")||{}).textContent = PAGE_META[page] || page;
  document.getElementById("pageContent").innerHTML = (RENDERERS[page] || renderDashboard)();
  if (page === "dkt") bindDKT();
  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.go));
  });
  if (page === "naplo") { el.innerHTML = renderNaplo(); return; }
  if (page === "grade") bindGradeForm();
  if (page === "studentNew") bindStudentNew();
  if (page === "homework") bindHomework();
  if (page === "absences") bindAbsences();
  if (page === "grades") {
    document.querySelectorAll(".del-grade").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Törlöd?")) return;
        try {
          await apiDelete("/naplo/v3/sajat/Ertekelesek?uid=" + encodeURIComponent(btn.dataset.uid));
          cache.grades = await apiGet("/naplo/v3/sajat/Ertekelesek");
          navigate("grades");
        } catch (err) { alert(err.message); }
      });
    });
  }
}

async function bootApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appShell").style.display = "block";
  const bm = document.getElementById("bootMsg");
  if (bm) bm.style.display = "none";
  try {
    await loadAllData();
  } catch (_) {}
  navigate("dashboard");
}

function init() {
  // Belépés a FŐ login oldalon történik; ide tokennel jön.
  accessToken = getStoredToken();
  if (!accessToken) {
    goLogin();
    return;
  }

  document.getElementById("loginScreen").style.display = "none";
  const un = document.getElementById("userName");
  if (un) un.textContent = localStorage.getItem("local_usr") || "OF";
  document.getElementById("logoutBtn")?.addEventListener("click", goLogin);
  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("open");
    document.getElementById("overlay")?.classList.toggle("show");
  });
  document.getElementById("overlay")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("overlay")?.classList.remove("show");
  });
  document.querySelectorAll(".k-nav-item").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });

  bootApp();
}

document.addEventListener("DOMContentLoaded", init);


function renderNaplo() {
  const students = Array.isArray(cache.students) ? cache.students : [];
  const rows = students.map((s, i) => {
    const uid = s.Uid || s.uid;
    return `<tr data-uid="${esc(uid)}">
      <td>${i + 1}</td>
      <td>${esc(s.Nev || uid)}</td>
      <td>0%</td>
      <td><span class="seg" data-uid="${esc(uid)}">
        <button type="button" class="att-j on-j" data-v="jelen">Jelenlét</button>
        <button type="button" class="att-h" data-v="hianyzas">Hiányzás</button>
      </span></td>
      <td><input type="number" min="0" max="45" style="width:56px" class="late-inp" data-uid="${esc(uid)}" /></td>
      <td class="ico-row">🏠 📚</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">Nincs diák.</td></tr>`;

  setTimeout(() => {
    document.querySelectorAll(".seg button").forEach(btn => {
      btn.addEventListener("click", () => {
        const seg = btn.parentElement;
        seg.querySelectorAll("button").forEach(b => b.classList.remove("on-j", "on-h"));
        btn.classList.add(btn.dataset.v === "jelen" ? "on-j" : "on-h");
      });
    });
    document.getElementById("btnSaveNaplo")?.addEventListener("click", async () => {
      const msg = document.getElementById("naploMsg");
      try {
        let n = 0;
        for (const seg of document.querySelectorAll(".seg")) {
          if (seg.querySelector(".att-h.on-h")) {
            await apiPost("/naplo/v3/sajat/Mulasztasok", {
              TanuloUid: seg.dataset.uid,
              Datum: new Date().toISOString().slice(0, 10),
              Tipus: { Uid: "1", Nev: "Hiányzás" }
            });
            n++;
          }
        }
        msg.className = "msg ok";
        msg.textContent = "Naplózva. Hiányzások: " + n;
        await loadAllData();
      } catch (e) {
        msg.className = "msg bad";
        msg.textContent = e.message || String(e);
      }
    });
  }, 0);

  return `<div class="naplo-layout">
    <div class="naplo-side">
      <button type="button" class="active">Naplózás</button>
      <button type="button" onclick="navigate('grade')">Értékelések</button>
      <button type="button" onclick="navigate('homework')">Házi</button>
    </div>
    <div class="naplo-main">
      <div class="naplo-title">Tanóra naplózása (osztályfőnök)</div>
      <table class="att-table">
        <thead><tr><th>#</th><th>Tanuló</th><th>%</th><th>Jelenlét</th><th>Késés</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="att-actions">
        <span class="msg" id="naploMsg"></span>
        <button type="button" class="k-btn k-btn-primary" id="btnSaveNaplo">ÓRA NAPLÓZÁSA</button>
      </div>
    </div>
  </div>`;
}
