/* KRÁTA – DKT önálló oldal (Digitális Kollaborációs Tér) */
const API_BASE = "https://ujkreta.onrender.com";
const LOGIN_URL = "https://puspus-dev.github.io/ujkreta/";
const TOKEN_KEYS = ["access_token", "ujkreta_access_token", "of_access_token", "teacher_access_token", "tanar_access_token"];

let accessToken = null;
let cache = { dkt: [], grades: [], timetable: [], groups: [], student: null, teacher: null };
let selectedId = null;
let selectedName = "";
let userRole = "";

function getToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function clearTokens() {
  TOKEN_KEYS.forEach((k) => localStorage.removeItem(k));
}
function goLogin() {
  clearTokens();
  window.location.href = LOGIN_URL;
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString("hu-HU");
  } catch { return String(iso).slice(0, 10); }
}
function flash(msg, ok) {
  const el = document.getElementById("flash");
  if (!el) return;
  if (!msg) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="${ok ? "e-ok" : "e-error"}">${esc(msg)}</div>`;
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" }
  });
  if (res.status === 401) { goLogin(); throw new Error("401"); }
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function storageKey() {
  const uid =
    (cache.student && (cache.student.Uid || cache.student.uid)) ||
    (cache.teacher && (cache.teacher.Uid || cache.teacher.uid)) ||
    localStorage.getItem("local_usr") || "anon";
  return "krata_dkt_files_" + uid;
}
function loadFilesMap() {
  try { return JSON.parse(localStorage.getItem(storageKey()) || "{}"); }
  catch { return {}; }
}
function saveFilesMap(map) {
  localStorage.setItem(storageKey(), JSON.stringify(map));
}

function workspaces() {
  let list = Array.isArray(cache.dkt) ? cache.dkt.slice() : [];
  if (!list.length) {
    const names = new Set();
    (cache.grades || []).forEach((g) => {
      const n = (g.Tantargy && (g.Tantargy.Nev || g.Tantargy.nev)) || g.TantargyNev;
      if (n) names.add(n);
    });
    (cache.timetable || []).forEach((l) => {
      const n = (l.Tantargy && (l.Tantargy.Nev || l.Tantargy.nev)) || l.TantargyNev || l.Nev;
      if (n) names.add(n);
    });
    const tSubs = cache.teacher && Array.isArray(cache.teacher.Tantargyak) ? cache.teacher.Tantargyak : [];
    tSubs.forEach((s) => { if (s.Nev) names.add(s.Nev); });
    if (!names.size) {
      ["Matematika", "Magyar nyelv és irodalom", "Történelem", "Informatika"].forEach((n) => names.add(n));
    }
    const group = (cache.groups && cache.groups[0] && cache.groups[0].Nev) || "Osztály";
    const teacher = (cache.teacher && cache.teacher.Nev) || "Szaktanár";
    list = [...names].sort((a, b) => a.localeCompare(b, "hu")).map((n, i) => ({
      tantargyId: i + 1,
      tantargyNev: n,
      alkalmazottNev: teacher,
      osztalyCsoportNev: group,
      _local: true
    }));
  }
  return list;
}

function ensureSeed(wsId, subj) {
  const map = loadFilesMap();
  const key = String(wsId);
  if (!map[key] || !map[key].length) {
    map[key] = [
      { id: key + "-1", name: subj + " – tematika.pdf", type: "PDF", size: "245 KB", date: new Date().toISOString(), note: "Év eleji tematika" },
      { id: key + "-2", name: subj + " – órai jegyzet.docx", type: "DOCX", size: "88 KB", date: new Date().toISOString(), note: "Közös jegyzet" },
      { id: key + "-3", name: "Házi feladatok mappa", type: "Mappa", size: "—", date: new Date().toISOString(), note: "Digitális beadandók" }
    ];
    saveFilesMap(map);
  }
  return map[key];
}

function renderWsList() {
  const list = workspaces();
  const root = document.getElementById("wsList");
  root.innerHTML = list.map((d) => {
    const id = String(d.tantargyId || d.TantargyId || d.tantargyNev || "");
    const subj = d.tantargyNev || d.TantargyNev || "Tantárgy";
    const teacher = d.alkalmazottNev || d.AlkalmazottNev || "—";
    const group = d.osztalyCsoportNev || d.OsztalyCsoportNev || "—";
    const active = id === String(selectedId) ? " active" : "";
    return `<button type="button" class="dkt-card${active}" data-id="${esc(id)}" data-name="${esc(subj)}">
      <img src="icons/OktatasIgenyles.png" class="dkt-card-ico" alt="">
      <div class="dkt-card-title">${esc(subj)}</div>
      <div class="dkt-card-meta">${esc(teacher)} · ${esc(group)}</div>
    </button>`;
  }).join("") || `<div class="e-empty">Nincs munkatér.</div>`;

  root.querySelectorAll(".dkt-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedId = btn.getAttribute("data-id");
      selectedName = btn.getAttribute("data-name") || "";
      document.getElementById("navFiles").disabled = false;
      renderWsList();
      renderFiles();
    });
  });
}

function renderFiles() {
  const title = document.getElementById("pageTitle");
  const root = document.getElementById("appRoot");
  if (!selectedId) {
    title.textContent = "Válassz munkateret";
    root.innerHTML = `<div class="e-panel"><div class="e-panel-body e-empty">A bal oldali listából válassz egy tantárgyi munkateret.</div></div>`;
    return;
  }
  const files = ensureSeed(selectedId, selectedName);
  title.textContent = selectedName + " – dokumentumok";
  root.innerHTML = `
    <div class="dkt-toolbar">
      <div><strong>${esc(selectedName)}</strong> <span style="color:#7c8a99">· ${files.length} elem</span></div>
      <button type="button" class="e-btn e-btn-primary" id="btnAdd">＋ Új dokumentum</button>
    </div>
    <div class="e-panel">
      <div class="e-panel-body" style="padding:0;">
        <table class="e-table">
          <thead><tr><th>Név</th><th>Típus</th><th>Méret</th><th>Dátum</th><th>Megjegyzés</th><th></th></tr></thead>
          <tbody>
            ${files.map((f) => `<tr>
              <td><img src="icons/${f.type === "Mappa" ? "Egyeb" : "note_text_f"}.png" class="doc-row-ico" alt=""> ${esc(f.name)}</td>
              <td>${esc(f.type)}</td>
              <td>${esc(f.size || "—")}</td>
              <td>${fmtDate(f.date)}</td>
              <td style="color:#7c8a99">${esc(f.note || "")}</td>
              <td><button type="button" class="e-btn dkt-del" data-id="${esc(f.id)}">Törlés</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("btnAdd")?.addEventListener("click", () => {
    const name = prompt("Dokumentum neve (pl. beadandó.pdf):");
    if (!name || !name.trim()) return;
    const map = loadFilesMap();
    const key = String(selectedId);
    const arr = map[key] || [];
    const lower = name.trim().toLowerCase();
    arr.unshift({
      id: key + "-" + Date.now(),
      name: name.trim(),
      type: lower.endsWith(".pdf") ? "PDF" : (lower.endsWith(".docx") ? "DOCX" : "Fájl"),
      size: "—",
      date: new Date().toISOString(),
      note: "Helyben hozzáadva"
    });
    map[key] = arr;
    saveFilesMap(map);
    flash("Dokumentum hozzáadva.", true);
    renderFiles();
  });

  root.querySelectorAll(".dkt-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("Törlöd ezt az elemet?")) return;
      const map = loadFilesMap();
      const key = String(selectedId);
      map[key] = (map[key] || []).filter((f) => f.id !== btn.getAttribute("data-id"));
      saveFilesMap(map);
      flash("Törölve.", true);
      renderFiles();
    });
  });
}

function goBack() {
  const r = (userRole || localStorage.getItem("ujkreta_role") || "").toLowerCase();
  if (r.indexOf("osztalyfonok") !== -1 || r === "of")
    window.location.href = "https://puspus-dev.github.io/ujkreta/osztalyfonok/";
  else if (r.indexOf("tanar") !== -1 || r === "teacher")
    window.location.href = "https://puspus-dev.github.io/ujkreta/tanar/";
  else
    window.location.href = "https://puspus-dev.github.io/ujkreta/diak/";
}

async function loadData() {
  const role = (localStorage.getItem("ujkreta_role") || "").toLowerCase();
  userRole = role;
  const isTeacher = role.indexOf("tanar") !== -1 || role.indexOf("osztalyfonok") !== -1 || role === "teacher" || role === "of";

  const tasks = [
    apiGet("/dktapi/intezmenyek/munkaterek/tanulok").then((d) => { cache.dkt = Array.isArray(d) ? d : []; }),
  ];
  if (isTeacher) {
    tasks.push(apiGet("/naplo/v3/sajat/TanarAdatlap").then((d) => { cache.teacher = d; }));
    tasks.push(apiGet("/naplo/v3/sajat/OrarendElemek").then((d) => { cache.timetable = Array.isArray(d) ? d : []; }));
  } else {
    tasks.push(apiGet("/ellenorzo/v3/sajat/TanuloAdatlap").then((d) => { cache.student = d; }));
    tasks.push(apiGet("/ellenorzo/v3/sajat/Ertekelesek").then((d) => { cache.grades = Array.isArray(d) ? d : []; }));
    tasks.push(apiGet("/ellenorzo/v3/sajat/OrarendElemek").then((d) => { cache.timetable = Array.isArray(d) ? d : []; }));
    tasks.push(apiGet("/ellenorzo/v3/sajat/OsztalyCsoportok").then((d) => { cache.groups = Array.isArray(d) ? d : []; }));
  }
  await Promise.all(tasks.map((p) => p.catch(() => null)));
}

async function boot() {
  accessToken = getToken();
  if (!accessToken) { goLogin(); return; }

  const name = localStorage.getItem("local_usr") || "Felhasználó";
  userRole = localStorage.getItem("ujkreta_role") || "";
  document.getElementById("userLabel").textContent = name + (userRole ? " · " + userRole : "");
  document.getElementById("logoutBtn").onclick = goLogin;
  document.getElementById("btnBack").onclick = goBack;
  document.getElementById("btnRefresh").onclick = async () => {
    try {
      await loadData();
      renderWsList();
      if (selectedId) renderFiles();
      flash("Frissítve.", true);
    } catch (e) {
      flash(e.message || String(e), false);
    }
  };

  try {
    await loadData();
  } catch (e) {
    console.error(e);
    flash("Adatok betöltése részben sikertelen.", false);
  }

  document.getElementById("bootMsg").style.display = "none";
  document.getElementById("appShell").style.display = "block";
  renderWsList();
  renderFiles();
}

document.addEventListener("DOMContentLoaded", boot);
