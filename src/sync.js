import { setRemoteSyncActive, isRemoteSyncActive } from "./remote-sync-flags.js";
import { hydrateParticipantsFromRemote, disableRemoteParticipants } from "./participants.js";
import { hydrateOfficialFromRemote, disableRemoteOfficial } from "./official-results-store.js";
import { hydratePredictionsFromRemote, disableRemotePredictions } from "./predictions-store.js";

/** @type {WebSocket | null} */
let socket = null;
let reconnectTimer = null;
/** Evita encolar refrescos si WS y fetch inicial envían el mismo estado. */
let lastAppliedRemoteFingerprint = "";

export function applyRemoteState(body) {
  if (!body || typeof body !== "object") return;
  let fp;
  try {
    fp = JSON.stringify(body);
  } catch {
    return;
  }
  if (fp === lastAppliedRemoteFingerprint) return;
  lastAppliedRemoteFingerprint = fp;
  hydrateParticipantsFromRemote(body.participants);
  hydrateOfficialFromRemote(body.official);
  hydratePredictionsFromRemote(body.predictions);
  window.dispatchEvent(new CustomEvent("pm26-remote-sync"));
}

/** Fuerza comparación con el servidor (p. ej. tras reconectar WS o volver a la pestaña). */
function pullRemoteState() {
  return fetch("/api/state")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data) applyRemoteState(data);
    })
    .catch(() => {});
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, 2500);
}

/**
 * Por defecto en dev: mismo host que la página (Vite proxifica /ws → 8787) para móviles en LAN.
 * VITE_WS_DIRECT=true: WebSocket directo a hostname:8787 (si prefieres evitar el proxy).
 */
function syncWebSocketUrl() {
  const secure = location.protocol === "https:";
  const proto = secure ? "wss" : "ws";
  if (import.meta.env.DEV && import.meta.env.VITE_WS_DIRECT === "true") {
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

  socket.addEventListener("open", () => {
    void pullRemoteState();
  });

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

const REMOTE_POLL_MS = 3500;
/** @type {ReturnType<typeof setInterval> | null} */
let remotePollTimer = null;
let visibilityListenerBound = false;

/**
 * Respaldo si el WS se cae: solo aplica estado vía applyRemoteState (deduplicado).
 * Los refrescos de UI van en cola en app.js (pm26-remote-sync).
 */
export function startRemoteSyncCatchup() {
  if (remotePollTimer != null) return;
  remotePollTimer = window.setInterval(() => {
    if (!isRemoteSyncActive() || document.hidden) return;
    void pullRemoteState();
  }, REMOTE_POLL_MS);

  if (!visibilityListenerBound) {
    visibilityListenerBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !isRemoteSyncActive()) return;
      void pullRemoteState();
    });
  }
}

function disableAllRemote() {
  setRemoteSyncActive(false);
  disableRemotePredictions();
  disableRemoteOfficial();
  disableRemoteParticipants();
}

/**
 * Intenta enlazar con `/api/state` y WebSocket. Si falla, la app sigue solo en memoria local de esta pestaña.
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
