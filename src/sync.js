import { setRemoteSyncActive } from "./remote-sync-flags.js";
import { hydrateParticipantsFromRemote, disableRemoteParticipants } from "./participants.js";
import { hydrateOfficialFromRemote, disableRemoteOfficial } from "./official-results-store.js";
import { hydratePredictionsFromRemote, disableRemotePredictions } from "./predictions-store.js";

/** @type {WebSocket | null} */
let socket = null;
let reconnectTimer = null;

export function applyRemoteState(body) {
  if (!body || typeof body !== "object") return;
  hydrateParticipantsFromRemote(body.participants);
  hydrateOfficialFromRemote(body.official);
  hydratePredictionsFromRemote(body.predictions);
  window.dispatchEvent(new CustomEvent("pm26-remote-sync"));
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, 2500);
}

/**
 * En desarrollo, el WebSocket va directo al API (mismo hostname que Vite, puerto 8787).
 * Así se evita el proxy WS de Vite, que en Windows suele loguear ECONNRESET cada reconexión.
 * En producción, mismo host que la página (Express sirve API + estáticos).
 */
function syncWebSocketUrl() {
  const secure = location.protocol === "https:";
  const proto = secure ? "wss" : "ws";
  if (import.meta.env.DEV) {
    const port = import.meta.env.VITE_SYNC_PORT ?? "8787";
    return `${proto}://${location.hostname}:${port}/ws`;
  }
  return `${proto}://${location.host}/ws`;
}

function connectWebSocket() {
  try {
    socket = new WebSocket(syncWebSocketUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  socket.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state" && msg.data) applyRemoteState(msg.data);
    } catch {
      /* ignore */
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
  });
}

function disableAllRemote() {
  setRemoteSyncActive(false);
  disableRemotePredictions();
  disableRemoteOfficial();
  disableRemoteParticipants();
}

/**
 * Intenta enlazar con `/api/state` y WebSocket. Si falla, la app sigue solo con localStorage.
 * @returns {Promise<boolean>}
 */
export async function initRemoteSync() {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("state not ok");
    const data = await res.json();
    applyRemoteState(data);
    setRemoteSyncActive(true);
    connectWebSocket();
    return true;
  } catch {
    disableAllRemote();
    return false;
  }
}
