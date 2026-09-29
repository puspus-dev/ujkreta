// index.html login() – a response feldolgozásnál, SIKER előtt:

// const data = await response.json();

if (data.error === "mfa_required" && data.mfa_token) {
    sessionStorage.setItem("mfa_token", data.mfa_token);
    window.location.href = "https://puspus-dev.github.io/ujkreta/2fa/";
    return;
}

// body-hoz a password grantnél:
// body.append("device_token", localStorage.getItem("krata_device_token") || "");
