const API_BASE = "http://localhost:3000"; // <-- IDE tedd az ujkreta backend URL-jét
let accessToken = null;

// ----------------------
// LOGIN (OAuth2 password grant)
// ----------------------
async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const btn = document.getElementById("loginBtn");

  if (!username || !password) return;

  btn.disabled = true;
  btn.textContent = "Belépés...";

  try {
    const body = new URLSearchParams();
    body.append("grant_type", "password");
    body.append("username", username);
    body.append("password", password);

    const res = await fetch(`${API_BASE}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    if (!res.ok) throw new Error("Hibás bejelentkezés");

    const data = await res.json();
    accessToken = data.access_token;

    document.getElementById("studentInfo").textContent =
      `Bejelentkezve: ${username}`;

    await loadAll();
  } catch (e) {
    alert("Nem sikerült bejelentkezni.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Bejelentkezés";
  }
}

// ----------------------
// API GET wrapper
// ----------------------
async function apiGet(path) {
  if (!accessToken) return [];
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return [];
  return res.json();
}

// ----------------------
// LOAD ALL DATA
// ----------------------
async function loadAll() {
  const adatlap = await apiGet("/ellenorzo/v3/sajat/TanuloAdatlap");
  const ertekelesek = await apiGet("/ellenorzo/v3/sajat/Ertekelesek");
  const orarend = await apiGet("/ellenorzo/v3/sajat/OrarendElemek");
  const hazik = await apiGet("/ellenorzo/v3/sajat/HaziFeladatok");
  const feljegyzesek = await apiGet("/ellenorzo/v3/sajat/Feljegyzesek");
  const mulasztasok = await apiGet("/ellenorzo/v3/sajat/Mulasztasok");

  // Diák adatlap
  const infoEl = document.getElementById("studentInfo");
  infoEl.textContent = `${adatlap.Nev} – ${adatlap.IntezmenyNev}`;

  // Értékelések
  const gradesEl = document.getElementById("grades");
  gradesEl.innerHTML = "";
  (ertekelesek || []).forEach(g => {
    const li = document.createElement("li");
    li.textContent = `${g.TantargyNev}: ${g.ErtekelesSzoveg} (${g.Datum})`;
    gradesEl.appendChild(li);
  });

  // Órarend
  const timetableEl = document.getElementById("timetable");
  timetableEl.innerHTML = "";
  (orarend || []).forEach(lesson => {
    const li = document.createElement("li");
    li.textContent = `${lesson.NapNev} ${lesson.KezdetIdo} – ${lesson.TantargyNev}`;
    timetableEl.appendChild(li);
  });

  // Házi feladatok
  const homeworkEl = document.getElementById("homework");
  homeworkEl.innerHTML = "";
  (hazik || []).forEach(hw => {
    const li = document.createElement("li");
    li.textContent = `${hw.TantargyNev}: ${hw.Lejegyzes} – határidő: ${hw.Hatarido}`;
    homeworkEl.appendChild(li);
  });

  // Feljegyzések
  const notesEl = document.getElementById("notes");
  notesEl.innerHTML = "";
  (feljegyzesek || []).forEach(n => {
    const li = document.createElement("li");
    li.textContent = `${n.Targy}: ${n.Szoveg}`;
    notesEl.appendChild(li);
  });

  // Mulasztások
  const absencesEl = document.getElementById("absences");
  absencesEl.innerHTML = "";
  (mulasztasok || []).forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${m.Datum}: ${m.MulasztasTipusNev}`;
    absencesEl.appendChild(li);
  });
}

document.getElementById("loginBtn").addEventListener("click", login);
