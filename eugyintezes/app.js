/* KRÁTA E-ügyintézés – postafiók (mobil API formátum) */
const API_BASE = "https://ujkreta.onrender.com";
const LOGIN_URL = "https://puspus-dev.github.io/ujkreta/";
const TOKEN_KEYS = ["access_token", "ujkreta_access_token", "of_access_token"];

const MSG_BASE = "/integration-kretamobile-api/v1/kommunikacio";

let accessToken = null;
let messages = [];
let selectedId = null;
let folder = "inbox"; // inbox | unread | compose

function getToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function clearTokens() {
  TOKEN_KEYS.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("ujkreta_refresh_token");
}

function goLogin() {
  clearTokens();
  window.location.href = LOGIN_URL;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
    return d.toLocaleString("hu-HU", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

function flash(msg, ok) {
  const el = document.getElementById("flash");
  if (!msg) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="${ok ? "e-ok" : "e-error"}">${esc(msg)}</div>`;
}

async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + accessToken,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {})
    }
  });
  if (res.status === 401) {
    goLogin();
    throw new Error("401");
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {
    if (!res.ok) throw new Error(text || ("HTTP " + res.status));
    return text;
  }
  if (!res.ok) {
    throw new Error((data && (data.error_description || data.error || data.message)) || ("HTTP " + res.status));
  }
  return data;
}

async function loadList() {
  const data = await api(MSG_BASE + "/postaladaelemek/sajat");
  messages = Array.isArray(data) ? data : [];
  updateBadges();
}

async function loadDetail(id) {
  return api(MSG_BASE + "/postaladaelemek/" + encodeURIComponent(id));
}

async function markRead(ids) {
  if (!ids.length) return;
  await api(MSG_BASE + "/uzenetek/olvasott", {
    method: "POST",
    body: JSON.stringify({ isOlvasott: true, uzenetAzonositoLista: ids })
  });
  messages.forEach((m) => {
    if (ids.includes(m.azonosito)) m.isElolvasva = true;
  });
  updateBadges();
}

function updateBadges() {
  const unread = messages.filter((m) => !m.isElolvasva && !m.isToroltElem).length;
  const bi = document.getElementById("badgeInbox");
  const bu = document.getElementById("badgeUnread");
  bi.hidden = messages.length === 0;
  bi.textContent = String(messages.length);
  bu.hidden = unread === 0;
  bu.textContent = String(unread);
}

function filteredMessages() {
  let list = messages.filter((m) => !m.isToroltElem);
  if (folder === "unread") list = list.filter((m) => !m.isElolvasva);
  const q = (document.getElementById("msgSearch")?.value || "").trim().toLowerCase();
  if (q) {
    list = list.filter((m) => {
      const u = m.uzenet || {};
      return [u.targy, u.feladoNev, u.szoveg, String(m.azonosito)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }
  return list.sort((a, b) => String(b.uzenet?.kuldesDatum || "").localeCompare(String(a.uzenet?.kuldesDatum || "")));
}

function render() {
  const root = document.getElementById("appRoot");
  if (folder === "compose") {
    document.getElementById("pageTitle").textContent = "Új üzenet";
    document.getElementById("crumb").textContent = "Új üzenet";
    root.innerHTML = renderCompose();
    bindCompose();
    return;
  }

  document.getElementById("pageTitle").textContent =
    folder === "unread" ? "Olvasatlan üzenetek" : "Beérkezett üzenetek";
  document.getElementById("crumb").textContent =
    folder === "unread" ? "Olvasatlan" : "Beérkezett";

  const list = filteredMessages();
  root.innerHTML = `
    <div class="e-layout">
      <div class="e-panel">
        <div class="e-panel-head">
          <span>Üzenetek (${list.length})</span>
          <button type="button" class="e-btn" id="btnMarkAll">Összes olvasott</button>
        </div>
        <div class="e-toolbar">
          <input type="search" class="e-search" id="msgSearch" placeholder="Keresés tárgy, feladó…" />
        </div>
        <div class="e-msg-list" id="msgList">
          ${list.length ? list.map(renderMsgRow).join("") : `<div class="e-empty">Nincs megjeleníthető üzenet.</div>`}
        </div>
      </div>
      <div class="e-panel e-detail" id="detailPanel">
        <div class="e-panel-head">Üzenet</div>
        <div class="e-detail-empty" id="detailBody">Válassz egy üzenetet a listából.</div>
      </div>
    </div>`;

  document.getElementById("msgSearch")?.addEventListener("input", () => render());
  document.getElementById("btnMarkAll")?.addEventListener("click", async () => {
    const ids = filteredMessages().filter((m) => !m.isElolvasva).map((m) => m.azonosito);
    try {
      await markRead(ids);
      flash("Üzenetek olvasottnak jelölve.", true);
      render();
      if (selectedId) openDetail(selectedId);
    } catch (e) {
      flash(e.message || String(e), false);
    }
  });

  document.querySelectorAll(".e-msg").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(Number(btn.dataset.id)));
  });

  if (selectedId) openDetail(selectedId);
}

function renderMsgRow(m) {
  const u = m.uzenet || {};
  const unread = !m.isElolvasva ? " unread" : "";
  const active = selectedId === m.azonosito ? " active" : "";
  return `
    <button type="button" class="e-msg${unread}${active}" data-id="${esc(m.azonosito)}">
      <div class="e-msg-top">
        <span class="e-msg-from">${esc(u.feladoNev || "—")}</span>
        <span class="e-msg-date">${esc(fmtDate(u.kuldesDatum))}</span>
      </div>
      <div class="e-msg-subj">${esc(u.targy || "(nincs tárgy)")}</div>
      <div class="e-msg-preview">${esc(u.szoveg || "")}</div>
    </button>`;
}

async function openDetail(id) {
  selectedId = id;
  document.querySelectorAll(".e-msg").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.id) === id);
  });
  const body = document.getElementById("detailBody");
  if (!body) return;
  body.innerHTML = `<div class="e-detail-empty">Betöltés…</div>`;
  try {
    const full = await loadDetail(id);
    if (!full.isElolvasva) {
      try { await markRead([id]); } catch (_) {}
    }
    const u = full.uzenet || {};
    const cimzettek = (u.cimzettLista || [])
      .map((c) => esc(c.nev || c.kretaAzonosito))
      .join(", ") || "—";
    const attaches = (u.csatolmanyok || [])
      .map((a) => `<li>📎 ${esc(a.fajlNev || a.azonosito)}</li>`)
      .join("");
    body.className = "e-detail-body";
    body.innerHTML = `
      <h2 class="e-detail-subj">${esc(u.targy || "(nincs tárgy)")}</h2>
      <div class="e-meta">
        <div><strong>Feladó:</strong> ${esc(u.feladoNev || "—")}
          ${u.feladoTitulus ? "(" + esc(u.feladoTitulus) + ")" : ""}</div>
        <div><strong>Címzettek:</strong> ${cimzettek}</div>
        <div><strong>Küldve:</strong> ${esc(fmtDate(u.kuldesDatum))}</div>
        <div><strong>Azonosító:</strong> ${esc(full.azonosito)}</div>
      </div>
      <div class="e-detail-text">${esc(u.szoveg || "")}</div>
      ${attaches ? `<ul class="e-attach">${attaches}</ul>` : ""}
    `;
    // friss lista állapot
    const idx = messages.findIndex((m) => m.azonosito === id);
    if (idx >= 0) messages[idx].isElolvasva = true;
    updateBadges();
  } catch (e) {
    body.className = "e-detail-empty";
    body.innerHTML = `<div class="e-error">${esc(e.message || e)}</div>`;
  }
}

function renderCompose() {
  return `
    <div class="e-panel" style="max-width:640px;">
      <div class="e-panel-head">Üzenet írása</div>
      <form class="e-form" id="composeForm">
        <div>
          <label for="cTargy">Tárgy</label>
          <input id="cTargy" required maxlength="200" />
        </div>
        <div>
          <label for="cCimzettUid">Címzett UID (diák)</label>
          <input id="cCimzettUid" placeholder="pl. 100" />
        </div>
        <div>
          <label for="cCimzettNev">Címzett neve</label>
          <input id="cCimzettNev" placeholder="pl. Teszt Elek" />
        </div>
        <div>
          <label for="cSzoveg">Üzenet</label>
          <textarea id="cSzoveg" required></textarea>
        </div>
        <div>
          <button type="submit" class="e-btn e-btn-primary">Küldés</button>
          <button type="button" class="e-btn" id="cCancel">Mégse</button>
        </div>
      </form>
      <p style="padding:0 14px 14px;font-size:12px;color:var(--e-muted);">
        A küldés a mock <code>POST .../uzenetek</code> végpontot használja (ha telepítve van).
      </p>
    </div>`;
}

function bindCompose() {
  document.getElementById("cCancel")?.addEventListener("click", () => {
    folder = "inbox";
    setNav();
    render();
  });
  document.getElementById("composeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api(MSG_BASE + "/uzenetek", {
        method: "POST",
        body: JSON.stringify({
          targy: document.getElementById("cTargy").value.trim(),
          szoveg: document.getElementById("cSzoveg").value.trim(),
          cimzettUid: document.getElementById("cCimzettUid").value.trim(),
          cimzettNev: document.getElementById("cCimzettNev").value.trim()
        })
      });
      flash("Üzenet elküldve.", true);
      await loadList();
      folder = "inbox";
      setNav();
      render();
    } catch (err) {
      flash(err.message || String(err), false);
    }
  });
}

function setNav() {
  document.querySelectorAll(".e-nav-btn[data-folder]").forEach((b) => {
    b.classList.toggle("active", b.dataset.folder === folder);
  });
}

async function boot() {
  accessToken = getToken();
  if (!accessToken) {
    goLogin();
    return;
  }

  const role = localStorage.getItem("ujkreta_role") || "";
  const name = localStorage.getItem("local_usr") || "Felhasználó";
  document.getElementById("userLabel").textContent =
    name + (role ? " · " + role : "");

  document.getElementById("logoutBtn").onclick = goLogin;
  document.getElementById("btnRefresh").onclick = async () => {
    try {
      await loadList();
      flash("Frissítve.", true);
      render();
    } catch (e) {
      flash(e.message || String(e), false);
    }
  };

  document.querySelectorAll(".e-nav-btn[data-folder]").forEach((btn) => {
    btn.addEventListener("click", () => {
      folder = btn.dataset.folder;
      selectedId = null;
      setNav();
      render();
    });
  });

  try {
    await loadList();
  } catch (e) {
    flash(
      "Postafiók betöltése sikertelen: " + (e.message || e) +
      " — telepítsd a messages.go-t és registerMessageRoutes-ot.",
      false
    );
  }
  render();
}

document.addEventListener("DOMContentLoaded", boot);
