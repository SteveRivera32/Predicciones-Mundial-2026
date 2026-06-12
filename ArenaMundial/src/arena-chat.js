import { getChatMessages, sendChatMessage, getChatLimits } from "./api.js";
import { getArenaUser } from "@shared/arena-mode.js";

const POLL_OPEN_MS = 3000;
const POLL_CLOSED_MS = 25_000;
/** Máximo de mensajes en memoria / pantalla; los más viejos se descartan */
const CLIENT_MESSAGE_CAP = 120;

/** @type {Map<number, { id: number, body: string, createdAt: string, username: string, displayName: string }>} */
const messageById = new Map();
let latestId = 0;
let pollTimer = null;
/** @type {"menu" | "chat"} */
let drawerMode = "menu";
let unread = 0;
let ready = false;
let limits = { cooldownSec: 5, duplicateCooldownSec: 60, maxLen: 280 };

function $(sel) {
  return document.querySelector(sel);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isDrawerOpen() {
  return document.getElementById("nav-drawer")?.classList.contains("is-open") ?? false;
}

function isChatVisible() {
  return drawerMode === "chat" && isDrawerOpen();
}

function sortedMessages() {
  return [...messageById.values()].sort((a, b) => a.id - b.id);
}

function pruneClientMessages() {
  const excess = messageById.size - CLIENT_MESSAGE_CAP;
  if (excess <= 0) return;
  const oldestIds = [...messageById.keys()].sort((a, b) => a - b).slice(0, excess);
  for (const id of oldestIds) messageById.delete(id);
}

function scrollMessagesToEnd() {
  const list = $("#arena-chat-messages");
  if (list) list.scrollTop = list.scrollHeight;
}

function renderMessages() {
  const list = $("#arena-chat-messages");
  if (!list) return;
  const me = getArenaUser()?.username ?? "";
  const rows = sortedMessages();
  if (rows.length === 0) {
    list.innerHTML = `<p class="arena-chat-empty muted">Sé el primero en escribir…</p>`;
    return;
  }
  list.innerHTML = rows
    .map((m) => {
      const self = m.username === me;
      return `<article class="arena-chat-msg${self ? " arena-chat-msg--self" : ""}" data-id="${m.id}">
        <header class="arena-chat-msg-head">
          <strong class="arena-chat-msg-name">${escapeHtml(m.displayName || m.username)}</strong>
          <time class="arena-chat-msg-time" datetime="${escapeHtml(m.createdAt)}">${escapeHtml(formatTime(m.createdAt))}</time>
        </header>
        <p class="arena-chat-msg-body">${escapeHtml(m.body)}</p>
      </article>`;
    })
    .join("");
  if (isChatVisible()) {
    scrollMessagesToEnd();
    unread = 0;
    updateBadge();
  }
}

function updateBadge() {
  const badge = $("#arena-chat-badge");
  const countEl = $("#arena-chat-badge-count");
  const railDot = $("#arena-chat-rail-badge");
  const show = unread > 0 && !isChatVisible();

  if (badge) {
    if (show) {
      badge.hidden = false;
      badge.removeAttribute("aria-hidden");
      if (countEl) countEl.textContent = unread > 9 ? "9+" : String(unread);
    } else {
      badge.hidden = true;
      badge.setAttribute("aria-hidden", "true");
      if (countEl) countEl.textContent = "";
    }
  }

  if (railDot) {
    if (show) {
      railDot.hidden = false;
      railDot.removeAttribute("aria-hidden");
    } else {
      railDot.hidden = true;
      railDot.setAttribute("aria-hidden", "true");
    }
  }
}

function ingestMessages(messages, { initial = false } = {}) {
  if (initial) messageById.clear();
  let added = 0;
  for (const m of messages) {
    if (!m?.id) continue;
    if (!messageById.has(m.id)) {
      if (!initial && m.id > latestId) added += 1;
      messageById.set(m.id, m);
    }
    if (m.id > latestId) latestId = m.id;
  }
  pruneClientMessages();
  if (added > 0 && !isChatVisible()) unread += added;
  renderMessages();
  updateBadge();
}

async function pullMessages(initial = false) {
  try {
    const data = await getChatMessages(initial ? 0 : latestId);
    if (initial) {
      ingestMessages(data.messages ?? [], { initial: true });
      latestId = Number(data.latestId ?? latestId);
    } else if (Array.isArray(data.messages) && data.messages.length) {
      ingestMessages(data.messages);
    } else if (data.latestId != null) {
      latestId = Math.max(latestId, Number(data.latestId));
    }
  } catch {
    /* silencioso: reintento en el próximo poll */
  }
}

function schedulePoll() {
  if (pollTimer != null) window.clearInterval(pollTimer);
  const ms = isChatVisible() ? POLL_OPEN_MS : POLL_CLOSED_MS;
  pollTimer = window.setInterval(() => {
    if (document.hidden) return;
    void pullMessages(false);
  }, ms);
}

/**
 * @param {"menu" | "chat"} mode
 */
function setDrawerMode(mode) {
  drawerMode = mode;
  const menuView = $("#nav-drawer-menu-view");
  const chatHost = $("#arena-chat");
  const btnMenu = $("#nav-drawer-mode-menu");
  const btnChat = $("#nav-drawer-mode-chat");
  const isChat = mode === "chat";

  const form = $("#arena-chat-form");
  const menuHint = $("#nav-drawer-menu-hint");
  const chatHint = $("#arena-chat-hint");

  if (menuView) menuView.hidden = isChat;
  if (chatHost) chatHost.hidden = !isChat;
  if (form) form.hidden = !isChat;
  if (menuHint) menuHint.hidden = isChat;
  if (chatHint) chatHint.hidden = !isChat;

  btnMenu?.classList.toggle("is-active", !isChat);
  btnChat?.classList.toggle("is-active", isChat);
  btnMenu?.setAttribute("aria-selected", !isChat ? "true" : "false");
  btnChat?.setAttribute("aria-selected", isChat ? "true" : "false");

  if (isChat) {
    unread = 0;
    updateBadge();
    scrollMessagesToEnd();
    window.requestAnimationFrame(() => $("#arena-chat-input")?.focus());
  }

  schedulePoll();
}

function setHint(text) {
  const el = $("#arena-chat-hint");
  if (el) el.textContent = text ?? "";
}

async function onSubmit(e) {
  e.preventDefault();
  const input = /** @type {HTMLInputElement | null} */ ($("#arena-chat-input"));
  const submit = /** @type {HTMLButtonElement | null} */ ($("#arena-chat-form button[type=submit]"));
  if (!input || !submit) return;
  const text = input.value.trim();
  if (!text) return;
  submit.disabled = true;
  setHint("");
  try {
    const res = await sendChatMessage(text);
    input.value = "";
    if (res.message) {
      ingestMessages([res.message]);
      latestId = Math.max(latestId, Number(res.message.id ?? latestId));
    }
    setHint(`Puedes enviar otro en ${limits.cooldownSec}s.`);
  } catch (err) {
    const retry = err?.retryAfterSec;
    setHint(err?.message ?? "No se pudo enviar.");
    if (retry) {
      setHint(`${err.message} (${retry}s)`);
    }
  } finally {
    submit.disabled = false;
    input.focus();
  }
}

function watchDrawerOpen() {
  const drawer = document.getElementById("nav-drawer");
  if (!drawer) return;
  const observer = new MutationObserver(() => {
    if (isDrawerOpen() && drawerMode === "chat") {
      unread = 0;
      updateBadge();
      scrollMessagesToEnd();
      window.requestAnimationFrame(() => $("#arena-chat-input")?.focus());
    }
    schedulePoll();
  });
  observer.observe(drawer, { attributes: true, attributeFilter: ["class"] });
}

export async function initArenaChat() {
  if (ready) return;
  const chatHost = $("#arena-chat");
  const modeSwitch = $("#nav-drawer-mode-switch");
  if (!chatHost || !modeSwitch) return;
  ready = true;

  modeSwitch.hidden = false;

  try {
    limits = await getChatLimits();
    const input = $("#arena-chat-input");
    if (input) input.maxLength = limits.maxLen ?? 280;
  } catch {
    /* defaults */
  }

  setHint(`Máx. ${limits.maxLen} caracteres · ${limits.cooldownSec}s entre mensajes · 1 min si repites el mismo texto.`);

  $("#nav-drawer-mode-menu")?.addEventListener("click", () => setDrawerMode("menu"));
  $("#nav-drawer-mode-chat")?.addEventListener("click", () => setDrawerMode("chat"));
  $("#arena-chat-form")?.addEventListener("submit", onSubmit);

  setDrawerMode("menu");
  watchDrawerOpen();

  await pullMessages(true);
  schedulePoll();
}
