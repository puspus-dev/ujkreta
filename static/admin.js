"use strict";




/* ------------------------------------------------------------
 * DOM helpers
 * ------------------------------------------------------------ */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);


/* ------------------------------------------------------------
 * API
 * ------------------------------------------------------------ */

async function apiRequest(url, options = {}) {

    const response = await fetch(url, {
        credentials: "include",

        ...options,

        headers: {
            "Accept": "application/json",

            ...(options.body
                ? {
                    "Content-Type": "application/json"
                }
                : {}),

            ...(options.headers || {})
        }
    });

    const contentType =
        response.headers.get("content-type") || "";

    let data = null;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {

        let message =
            `HTTP ${response.status}`;

        if (
            data &&
            typeof data === "object" &&
            data.error_description
        ) {
            message = data.error_description;
        }

        throw new Error(message);
    }

    return data;
}


/* ------------------------------------------------------------
 * Toast
 * ------------------------------------------------------------ */

function showToast(message, type = "success") {

    const container =
        $("#toastContainer");

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type === "error" ? "error" : ""}`;

    toast.textContent =
        message;

    container.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3500);
}


/* ------------------------------------------------------------
 * Navigation
 * ------------------------------------------------------------ */

const pageTitles = {

    dashboard: [
        "Dashboard",
        "A mock KRÉTA szerver áttekintése"
    ],

    users: [
        "Felhasználók",
        "Tesztfelhasználói fiókok kezelése"
    ],

    data: [
        "KRÉTA adatok",
        "A szerveren tárolt mock adatok"
    ],

    config: [
        "Konfiguráció",
        "A mock szerver alapbeállításai"
    ]
};


function showSection(name) {

    $$(".section").forEach(section => {

        section.classList.toggle(
            "active",
            section.id === `section-${name}`
        );

    });

    $$(".nav-item[data-section]").forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.section === name
        );

    });

    const title =
        pageTitles[name];

    if (title) {

        $("#pageTitle").textContent =
            title[0];

        $("#pageSubtitle").textContent =
            title[1];
    }

    $("#sidebar").classList.remove("open");

    if (name === "dashboard") {
        loadDashboard();
    }

    if (name === "users") {
        loadUsers();
    }

    if (name === "config") {
        loadConfig();
    }
}


$$(".nav-item[data-section]").forEach(button => {

    button.addEventListener(
        "click",
        () => showSection(button.dataset.section)
    );

});


$$("[data-section-target]").forEach(button => {

    button.addEventListener(
        "click",
        () => showSection(button.dataset.sectionTarget)
    );

});


/* ------------------------------------------------------------
 * Mobile menu
 * ------------------------------------------------------------ */

$("#mobileMenu").addEventListener(
    "click",
    () => {

        $("#sidebar").classList.toggle(
            "open"
        );

    }
);


/* ------------------------------------------------------------
 * Health
 * ------------------------------------------------------------ */

async function loadHealth() {

    const indicator =
        $("#healthIndicator");

    const text =
        $("#healthText");

    const details =
        $("#healthDetails");

    try {

        const data =
            await apiRequest("/health");

        if (
            data &&
            data.status === "ok"
        ) {

            indicator.className =
                "health-indicator ok";

            text.textContent =
                "Online";

            details.textContent =
                "Az API elérhető";

            $("#serverStatus").textContent =
                "Online";

        } else {

            throw new Error(
                "A szerver hibás választ adott."
            );
        }

    } catch (error) {

        indicator.className =
            "health-indicator error";

        text.textContent =
            "Hiba";

        details.textContent =
            error.message;

        $("#serverStatus").textContent =
            "Hiba";
    }
}


/* ------------------------------------------------------------
 * Dashboard
 * ------------------------------------------------------------ */

async function loadDashboard() {

    await loadHealth();

    try {

        const users =
            await apiRequest(
                "/admin/api/users"
            );

        if (Array.isArray(users)) {

            $("#userCount").textContent =
                users.length;
        }

    } catch (error) {

        $("#userCount").textContent =
            "—";
    }

    /*
     * A KRÉTA végpontok authot igényelnek.
     *
     * Az admin API később közvetlen statisztikát
     * is visszaadhat. Addig a számok helyett
     * gond nélkül megmarad a "—".
     */

    $("#gradeCount").textContent = "—";
    $("#lessonCount").textContent = "—";
}


/* ------------------------------------------------------------
 * Users
 * ------------------------------------------------------------ */

async function loadUsers() {

    const tbody =
        $("#usersTable");

    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="empty">
                Betöltés...
            </td>
        </tr>
    `;

    try {

        const users =
            await apiRequest(
                "/admin/api/users"
            );

        if (
            !Array.isArray(users) ||
            users.length === 0
        ) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty">
                        Nincs felhasználó.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = "";

        users.forEach(user => {

            const tr =
                document.createElement("tr");

            const created =
                user.createdAt
                    ? formatDate(user.createdAt)
                    : "—";

            const active =
                user.active !== false;

            tr.innerHTML = `
                <td>
                    <strong>
                        ${escapeHtml(user.username || "")}
                    </strong>
                </td>

                <td>
                    <code>
                        ${escapeHtml(user.studentUid || "")}
                    </code>
                </td>

                <td>
                    <span class="badge ${active ? "active" : "inactive"}">
                        ${active ? "Aktív" : "Inaktív"}
                    </span>
                </td>

                <td>
                    ${escapeHtml(created)}
                </td>

                <td>
                    <button
                        class="table-action"
                        data-delete-user="${escapeHtml(user.id || "")}"
                    >
                        Törlés
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        $$("[data-delete-user]").forEach(button => {

            button.addEventListener(
                "click",
                () => deleteUser(
                    button.dataset.deleteUser
                )
            );

        });

    } catch (error) {

        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Nem sikerült betölteni a felhasználókat.
                    <br>
                    <small>
                        ${escapeHtml(error.message)}
                    </small>
                </td>
            </tr>
        `;
    }
}


/* ------------------------------------------------------------
 * Create user
 * ------------------------------------------------------------ */

$("#newUserButton").addEventListener(
    "click",
    () => openUserModal()
);


function openUserModal() {

    $("#userForm").reset();

    $("#userModal").classList.add(
        "open"
    );

    setTimeout(() => {

        $("#newUsername").focus();

    }, 50);
}


function closeUserModal() {

    $("#userModal").classList.remove(
        "open"
    );
}


$("#closeUserModal").addEventListener(
    "click",
    closeUserModal
);


$("#cancelUserModal").addEventListener(
    "click",
    closeUserModal
);


$("#userModal").addEventListener(
    "click",
    event => {

        if (
            event.target ===
            $("#userModal")
        ) {
            closeUserModal();
        }

    }
);


$("#userForm").addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const username =
            $("#newUsername").value.trim();

        const password =
            $("#newPassword").value;

        const studentUID =
            $("#newStudentUID").value.trim();

        if (!username || !password || !studentUID) {

            showToast(
                "Minden mező kitöltése kötelező.",
                "error"
            );

            return;
        }

        try {

            await apiRequest(
                "/admin/api/users",
                {
                    method: "POST",

                    body: JSON.stringify({
                        username,
                        password,
                        studentUid: studentUID
                    })
                }
            );

            closeUserModal();

            showToast(
                "Felhasználó létrehozva."
            );

            await loadUsers();

        } catch (error) {

            showToast(
                error.message,
                "error"
            );
        }

    }
);


/* ------------------------------------------------------------
 * Delete user
 * ------------------------------------------------------------ */

async function deleteUser(id) {

    if (!id) {
        return;
    }

    const confirmed =
        window.confirm(
            "Biztosan törlöd ezt a felhasználót?"
        );

    if (!confirmed) {
        return;
    }

    try {

        await apiRequest(
            `/admin/api/users/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        showToast(
            "Felhasználó törölve."
        );

        await loadUsers();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


/* ------------------------------------------------------------
 * Config
 * ------------------------------------------------------------ */

async function loadConfig() {

    try {

        const config =
            await apiRequest(
                "/admin/api/config"
            );

        $("#configInstituteCode").value =
            config.instituteCode || "";

        $("#configUsername").value =
            config.username || "";

        $("#configTTL").value =
            config.accessTokenTtlSeconds || 3600;

    } catch (error) {

        showToast(
            `Konfiguráció betöltése sikertelen: ${error.message}`,
            "error"
        );
    }
}


$("#saveConfigButton").addEventListener(
    "click",
    saveConfig
);


async function saveConfig() {

    const config = {

        instituteCode:
            $("#configInstituteCode").value.trim(),

        username:
            $("#configUsername").value.trim(),

        accessTokenTtlSeconds:
            Number(
                $("#configTTL").value
            )
    };

    if (
        !config.instituteCode ||
        !config.username
    ) {

        showToast(
            "Az intézményazonosító és a felhasználónév kötelező.",
            "error"
        );

        return;
    }

    try {

        await apiRequest(
            "/admin/api/config",
            {
                method: "PUT",

                body: JSON.stringify(
                    config
                )
            }
        );

        showToast(
            "Konfiguráció mentve."
        );

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


/* ------------------------------------------------------------
 * KRÉTA data viewer
 * ------------------------------------------------------------ */

$$(".data-card").forEach(card => {

    card.addEventListener(
        "click",
        () => loadDataEndpoint(
            card.dataset.endpoint
        )
    );

});


async function loadDataEndpoint(endpoint) {

    $("#jsonEndpoint").textContent =
        endpoint;

    $("#jsonViewer").textContent =
        "Betöltés...";

    try {

        /*
         * Ezek az endpointok normál esetben
         * Bearer tokent igényelnek.
         *
         * Az admin backend ezért később
         * admin/api/data/* proxyként kezelheti őket.
         *
         * Első körben megpróbáljuk közvetlenül.
         */

        const data =
            await apiRequest(
                `/admin/api/data?endpoint=${encodeURIComponent(endpoint)}`
            );

        $("#jsonViewer").textContent =
            JSON.stringify(
                data,
                null,
                2
            );

    } catch (error) {

        $("#jsonViewer").textContent =
            `Nem sikerült betölteni az adatokat.\n\n${error.message}`;
    }
}


/* ------------------------------------------------------------
 * Copy JSON
 * ------------------------------------------------------------ */

$("#copyJsonButton").addEventListener(
    "click",
    async () => {

        const text =
            $("#jsonViewer").textContent;

        try {

            await navigator.clipboard.writeText(
                text
            );

            showToast(
                "JSON a vágólapra másolva."
            );

        } catch (error) {

            showToast(
                "A másolás sikertelen.",
                "error"
            );
        }
    }
);


/* ------------------------------------------------------------
 * Reset
 * ------------------------------------------------------------ */

$("#resetButton").addEventListener(
    "click",
    resetStore
);

$("#resetButtonConfig").addEventListener(
    "click",
    resetStore
);


async function resetStore() {

    const confirmed =
        window.confirm(
            "Biztosan visszaállítod a seed adatokat?"
        );

    if (!confirmed) {
        return;
    }

    try {

        await apiRequest(
            "/admin/api/reset",
            {
                method: "POST"
            }
        );

        showToast(
            "A seed adatok vissza lettek állítva."
        );

        await loadDashboard();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


/* ------------------------------------------------------------
 * Refresh
 * ------------------------------------------------------------ */

$("#reloadButton").addEventListener(
    "click",
    () => {

        const active =
            document.querySelector(
                ".nav-item.active"
            );

        const section =
            active
                ? active.dataset.section
                : "dashboard";

        showSection(section);

        showToast(
            "Adatok frissítve."
        );
    }
);


/* ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------ */

function formatDate(value) {

    try {

        return new Intl.DateTimeFormat(
            "hu-HU",
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",

                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(
            new Date(value)
        );

    } catch {
        return String(value);
    }
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ------------------------------------------------------------
 * Initial load
 * ------------------------------------------------------------ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        showSection(
            "dashboard"
        );

    }
);