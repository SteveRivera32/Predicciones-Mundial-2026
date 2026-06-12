import "./styles/login.css";
import { login, register } from "./api.js";
import { redirectIfAuthenticated } from "./auth-client.js";

const PASSWORD_LEN = 8;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const DISPLAY_NAME_MAX = 20;
const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const USERNAME_KEY = "arena-last-username";

const $ = (sel) => document.querySelector(sel);
const form = $("#login-form");
const registerForm = $("#register-form");
const panelLogin = $("#panel-login");
const panelRegister = $("#panel-register");
const tabLogin = $("#tab-login");
const tabRegister = $("#tab-register");
const authHeading = $("#auth-heading");
const authSub = $("#auth-sub");
const errorEl = $("#auth-error");
const loginUsername = $("#login-username");

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
}

function setSubmitting(active) {
  for (const btn of [$("#login-submit"), $("#register-submit")]) {
    if (!btn) continue;
    btn.disabled = active;
    btn.setAttribute("aria-busy", active ? "true" : "false");
  }
}

function validatePasswordLen(password) {
  return password.length === PASSWORD_LEN;
}

function validateUsername(username) {
  const u = String(username ?? "").trim().toLowerCase();
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
    return `El usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`;
  }
  if (!USERNAME_PATTERN.test(u)) {
    return "El usuario solo puede usar letras minúsculas, números o guión bajo (_).";
  }
  return "";
}

function validateDisplayName(displayName) {
  const n = String(displayName ?? "").trim();
  if (n.length > DISPLAY_NAME_MAX) {
    return `El nombre visible admite máximo ${DISPLAY_NAME_MAX} caracteres.`;
  }
  return "";
}

function rememberUsername(username) {
  const u = String(username ?? "").trim().toLowerCase();
  if (!u) return;
  try {
    localStorage.setItem(USERNAME_KEY, u);
  } catch {
    /* ignore */
  }
}

function restoreUsername() {
  try {
    const u = localStorage.getItem(USERNAME_KEY);
    if (u && loginUsername) loginUsername.value = u;
  } catch {
    /* ignore */
  }
}

function setMode(mode) {
  const isLogin = mode === "login";
  if (panelLogin) panelLogin.hidden = !isLogin;
  if (panelRegister) panelRegister.hidden = isLogin;
  tabLogin?.classList.toggle("auth-tab--active", isLogin);
  tabRegister?.classList.toggle("auth-tab--active", !isLogin);
  tabLogin?.setAttribute("aria-selected", isLogin ? "true" : "false");
  tabRegister?.setAttribute("aria-selected", isLogin ? "false" : "true");
  if (authHeading) authHeading.textContent = isLogin ? "Entrar" : "Crear cuenta";
  if (authSub) {
    authSub.textContent = isLogin
      ? "Accede con tu usuario y contraseña de 8 caracteres. Si juegas la quiniela privada, usa el mismo usuario y PIN."
      : "Elige un usuario único y una contraseña de exactamente 8 caracteres.";
  }
  showError("");
  (isLogin ? form : registerForm)?.querySelector("input")?.focus();
}

tabLogin?.addEventListener("click", () => setMode("login"));
tabRegister?.addEventListener("click", () => setMode("register"));

function bindPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.closest(".password-wrap")?.querySelector("input");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Ocultar" : "Ver";
      btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
      btn.setAttribute("aria-pressed", show ? "true" : "false");
    });
  });
}

bindPasswordToggles();

async function handleAuthError(err) {
  if (err?.retryAfterSec) {
    showError(`${err.message} (${err.retryAfterSec}s)`);
    return;
  }
  showError(err?.message || "Error de conexión");
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const fd = new FormData(form);
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!validatePasswordLen(password)) {
    showError(`La contraseña debe tener exactamente ${PASSWORD_LEN} caracteres.`);
    return;
  }
  setSubmitting(true);
  try {
    await login(username, password);
    rememberUsername(username);
    const params = new URLSearchParams(location.search);
    location.href = params.get("next") || "/ArenaMundial/app/";
  } catch (err) {
    await handleAuthError(err);
  } finally {
    setSubmitting(false);
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const fd = new FormData(registerForm);
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("passwordConfirm") ?? "");
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const displayName = String(fd.get("displayName") ?? "").trim();
  const usernameErr = validateUsername(username);
  if (usernameErr) {
    showError(usernameErr);
    return;
  }
  const displayNameErr = validateDisplayName(displayName);
  if (displayNameErr) {
    showError(displayNameErr);
    return;
  }
  if (!validatePasswordLen(password)) {
    showError(`La contraseña debe tener exactamente ${PASSWORD_LEN} caracteres.`);
    return;
  }
  if (password !== confirm) {
    showError("Las contraseñas no coinciden");
    return;
  }
  setSubmitting(true);
  try {
    await register({
      username,
      displayName,
      password,
    });
    rememberUsername(username);
    location.href = "/ArenaMundial/app/";
  } catch (err) {
    await handleAuthError(err);
  } finally {
    setSubmitting(false);
  }
});

void redirectIfAuthenticated().then((redirected) => {
  if (!redirected) {
    restoreUsername();
    setMode("login");
  }
});
