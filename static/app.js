"use strict";

/*
 * ÚjKréta Admin frontend
 *
 * A frontend ugyanarról a hostról fut,
 * ezért az API-kat relatív URL-lel használjuk.
 */

const API = "";


/* ============================================================
   STATE
   ============================================================ */

let credentials = {
    username: "",
    password: ""
};

let student = null;
let config = null;


/* ============================================================
   ELEMENT HELPERS
   ============================================================ */

const $ = (selector) =>
    document.querySelector(selector);

const $$ = (selector) =>
    document.querySelectorAll(selector);


/* ============================================================
   TOAST
   ============================================================ */

let toastTimer = null;

function toast(message) {

    const element = $("#toast");

    element.textContent = message;

    element.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        element.classList.remove("show");
    }, 3000);
}


/* ============================================================
   AUTH
   ============================================================ */

function authHeader() {

    const value =
        `${credentials.username}:${credentials.password}`;

    return "Basic " + btoa(unescape(encodeURIComponent(value)));
}


async function api(
    path,
    options = {}
) {

    const headers = {
        Accept: "application/json",

        ...(options.headers || {})
    };

    /*
     * Az admin API Basic Authot használ.
     */
    headers.Authorization = authHeader();

    if (
        options.body &&
        typeof options.body !== "string"
    ) {
        headers["Content-Type"] =
            "application/json";

        options.body =
            JSON.stringify(options.body);
    }

    const response = await fetch(
        API + path,
        {
            ...options,
            headers
        }
    );

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        throw new Error("AUTH_REQUIRED");
    }

    const contentType =
        response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {

        const message =
            typeof data === "object"
                ? data.message || data.error
                : data;

        throw new Error(
            message || `HTTP ${response.status}`
        );
    }

    return data;
}


/* ============================================================
   LOGIN
   ============================================================ */

$("#loginForm").addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const username =
            $("#username").value.trim();

        const password =
            $("#password").value;

        const error =
            $("#loginError");

        error.classList.add("hidden");

        credentials = {
            username,
            password
        };

        try {

            await api("/admin/health");

            sessionStorage.setItem(
                "ujkreta_admin",
                JSON.stringify(credentials)
            );

            $("#loginScreen")
                .classList.add("hidden");

            $("#app")
                .classList.remove("hidden");

            $("#adminName").textContent =
                username;

            await loadDashboard();

        } catch (err) {

            credentials = {
                username: "",
                password: ""
            };

            error.textContent =
                err.message === "AUTH_REQUIRED"
                    ? "Hibás felhasználónév vagy jelszó."
                    : "Nem sikerült kapcsolódni a szerverhez.";

            error.classList.remove("hidden");
        }
    }
);


/* ============================================================
   RESTORE SESSION
   ============================================================ */

async function restoreSession() {

    const raw =
        sessionStorage.getItem("ujkreta_admin");

    if (!raw) {
        return;
    }

    try {

        credentials = JSON.parse(raw);

        await api("/admin/health");

        $("#loginScreen")
            .classList.add("hidden");

        $("#app")
            .classList.remove("hidden");

        $("#adminName").textContent =
            credentials.username;

        await loadDashboard();

    } catch {

        sessionStorage.removeItem(
            "ujkreta_admin"
        );

        credentials = {
            username: "",
            password: ""
        };
    }
}


/* ============================================================
   LOGOUT
   ============================================================ */

$("#logoutButton").addEventListener(
    "click",
    () => {

        sessionStorage.removeItem(
            "ujkreta_admin"
        );

        credentials = {
            username: "",
            password: ""
        };

        location.reload();
    }
);


/* ============================================================
   NAVIGATION
   ============================================================ */

const pageNames = {
    dashboard: [
        "Áttekintés",
        "Az ÚjKréta szerver állapota"
    ],

    student: [
        "Diák",
        "Tanulói adatok"
    ],

    config: [
        "Beállítások",
        "Szerverkonfiguráció"
    ],

    users: [
        "Felhasználók",
        "Tesztfelhasználók kezelése"
    ]
};


function showPage(name) {

    $$(".page").forEach(
        page => page.classList.add("hidden")
    );

    const page =
        document.getElementById(
            name + "Page"
        );

    if (page) {
        page.classList.remove("hidden");
    }

    $$(".nav-item").forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.page === name
        );
    });

    const info =
        pageNames[name];

    if (info) {

        $("#pageTitle").textContent =
            info[0];

        $("#pageSubtitle").textContent =
            info[1];
    }

    if (name === "student") {
        loadStudent();
    }

    if (name === "config") {
        loadConfig();
    }
}


$$("[data-page]").forEach(
    element => {

        element.addEventListener(
            "click",
            () => {
                showPage(
                    element.dataset.page
                );
            }
        );
    }
);


/* ============================================================
   HEALTH
   ============================================================ */

async function loadHealth() {

    try {

        await api("/admin/health");

        $("#serverStatus").textContent =
            "Online";

        $("#statusText").textContent =
            "Online";

        $("#statusDot")
            .classList.remove("offline");

        $("#statusDot")
            .classList.add("online");

    } catch {

        $("#serverStatus").textContent =
            "Offline";

        $("#statusText").textContent =
            "Offline";

        $("#statusDot")
            .classList.remove("online");

        $("#statusDot")
            .classList.add("offline");
    }
}


/* ============================================================
   STUDENT
   ============================================================ */

async function loadStudent() {

    try {

        student =
            await api("/admin/student");

        fillStudentForm(student);

        $("#studentName").textContent =
            student.Nev || "–";

        $("#institutionName").textContent =
            student.IntezmenyNev || "–";

    } catch (err) {

        if (err.message === "AUTH_REQUIRED") {
            location.reload();
        }
    }
}


function fillStudentForm(data) {

    $("#studentUid").value =
        data.Uid || "";

    $("#studentNev").value =
        data.Nev || "";

    $("#studentYear").value =
        data.SzuletesiEv || "";

    $("#studentMonth").value =
        data.SzuletesiHonap || "";

    $("#studentDay").value =
        data.SzuletesiNap || "";

    $("#studentEmail").value =
        data.EmailCim || "";

    $("#studentPhone").value =
        data.Telefonszam || "";

    $("#studentTanev").value =
        data.TanevUid || "";

    $("#studentInstitutionCode").value =
        data.IntezmenyAzonosito || "";

    $("#studentInstitutionName").value =
        data.IntezmenyNev || "";
}


$("#reloadStudent").addEventListener(
    "click",
    loadStudent
);


$("#studentForm").addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const data = {
            ...student,

            Uid: $("#studentUid").value,
            Nev: $("#studentNev").value,

            SzuletesiEv:
                Number($("#studentYear").value) || 0,

            SzuletesiHonap:
                Number($("#studentMonth").value) || 0,

            SzuletesiNap:
                Number($("#studentDay").value) || 0,

            EmailCim:
                $("#studentEmail").value,

            Telefonszam:
                $("#studentPhone").value,

            TanevUid:
                $("#studentTanev").value,

            IntezmenyAzonosito:
                $("#studentInstitutionCode").value,

            IntezmenyNev:
                $("#studentInstitutionName").value
        };

        try {

            const result =
                await api(
                    "/admin/student",
                    {
                        method: "PUT",
                        body: data
                    }
                );

            student =
                result.student;

            fillStudentForm(student);

            toast("A diák adatai elmentve.");

            $("#studentName").textContent =
                student.Nev || "–";

            $("#institutionName").textContent =
                student.IntezmenyNev || "–";

        } catch (err) {

            toast(
                "Mentési hiba: " +
                err.message
            );
        }
    }
);


/* ============================================================
   CONFIG
   ============================================================ */

async function loadConfig() {

    try {

        config =
            await api("/admin/config");

        $("#configInstitute").value =
            config.instituteCode || "";

        $("#configUsername").value =
            config.username || "";

        $("#configPassword").value =
            config.password || "";

        $("#configTTL").value =
            config.accessTokenTtlSeconds || "";

    } catch (err) {

        toast(
            "Nem sikerült betölteni a beállításokat."
        );
    }
}


$("#reloadConfig").addEventListener(
    "click",
    loadConfig
);


$("#configForm").addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const data = {

            instituteCode:
                $("#configInstitute").value,

            username:
                $("#configUsername").value,

            password:
                $("#configPassword").value,

            accessTokenTtlSeconds:
                Number(
                    $("#configTTL").value
                ) || 0
        };

        try {

            const result =
                await api(
                    "/admin/config",
                    {
                        method: "PUT",
                        body: data
                    }
                );

            config =
                result.config;

            toast(
                "A beállítások elmentve."
            );

        } catch (err) {

            toast(
                "Mentési hiba: " +
                err.message
            );
        }
    }
);


/* ============================================================
   USERS
   ============================================================ */

$("#userForm").addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const username =
            $("#newUsername").value.trim();

        const password =
            $("#newPassword").value;

        const studentUid =
            $("#newStudentUid").value.trim();

        try {

            const user =
                await api(
                    "/admin/users",
                    {
                        method: "POST",

                        body: {
                            username,
                            password,
                            studentUid
                        }
                    }
                );

            $("#userResult").textContent =
                `Felhasználó létrehozva: ${user.username}`;

            $("#userResult")
                .classList.remove("hidden");

            $("#userForm").reset();

            toast(
                "Felhasználó létrehozva."
            );

        } catch (err) {

            toast(
                "Felhasználó létrehozása sikertelen: " +
                err.message
            );
        }
    }
);


/* ============================================================
   RESET
   ============================================================ */

$("#resetButton").addEventListener(
    "click",
    async () => {

        const confirmed =
            confirm(
                "Biztosan visszaállítod az összes mock adatot?"
            );

        if (!confirmed) {
            return;
        }

        try {

            await api(
                "/admin/reset",
                {
                    method: "POST"
                }
            );

            await loadDashboard();

            toast(
                "A mock adatok vissza lettek állítva."
            );

        } catch (err) {

            toast(
                "Reset hiba: " +
                err.message
            );
        }
    }
);


/* ============================================================
   DASHBOARD
   ============================================================ */

async function loadDashboard() {

    await loadHealth();

    try {

        student =
            await api("/admin/student");

        $("#studentName").textContent =
            student.Nev || "–";

        $("#institutionName").textContent =
            student.IntezmenyNev || "–";

    } catch {

        $("#studentName").textContent =
            "–";

        $("#institutionName").textContent =
            "–";
    }
}


/* ============================================================
   START
   ============================================================ */

restoreSession();