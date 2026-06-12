/**

 * Modo Arena (quiniela pública). Activado solo desde ArenaMundial/src/arena-main.js.

 */



let arenaMode = false;

/** @type {{ id: string, username: string, displayName: string, isAdmin: boolean, isPrivadas: boolean } | null} */

let arenaUser = null;

/** @type {((data: object) => Promise<unknown>) | null} */

let pushMyPredictionsFn = null;

/** @type {((data: object) => Promise<unknown>) | null} */

let pushOfficialFn = null;



export function setArenaMode(on = true) {

  arenaMode = Boolean(on);

  if (typeof document !== "undefined") {
    document.body?.classList.toggle("app-arena", arenaMode);
  }

}



export function isArenaMode() {

  return arenaMode;

}



/** @param {{ username: string, displayName: string, isAdmin?: boolean, isPrivadas?: boolean }} user */

export function setArenaUser(user) {

  arenaUser = user

    ? {

        id: String(user.username),

        username: user.username,

        displayName: user.displayName,

        isAdmin: Boolean(user.isAdmin),

        isPrivadas: Boolean(user.isPrivadas),

      }

    : null;

}



/** Jugador de la quiniela privada: en Arena solo consulta (predice en privadas). */

export function isArenaPrivadasMirrorUser() {

  return Boolean(arenaUser?.isPrivadas);

}



export function getArenaUser() {

  return arenaUser;

}



export function getArenaUserId() {

  return arenaUser?.id ?? "";

}



export function isArenaAdmin() {

  return Boolean(arenaUser?.isAdmin);

}



export function setArenaPushHandlers({ pushMyPredictions, pushOfficial }) {

  pushMyPredictionsFn = pushMyPredictions ?? null;

  pushOfficialFn = pushOfficial ?? null;

}



let pushPredictionsTimer = null;

/** @type {object | null} */

let pendingPredictionsPayload = null;



export function pushArenaMyPredictions(data) {

  if (!pushMyPredictionsFn) return Promise.resolve();

  pendingPredictionsPayload = data;

  return new Promise((resolve, reject) => {

    if (pushPredictionsTimer != null) window.clearTimeout(pushPredictionsTimer);

    pushPredictionsTimer = window.setTimeout(() => {

      pushPredictionsTimer = null;

      const payload = pendingPredictionsPayload;

      pendingPredictionsPayload = null;

      if (!payload || !pushMyPredictionsFn) {

        resolve(undefined);

        return;

      }

      pushMyPredictionsFn(payload).then(resolve).catch(reject);

    }, 700);

  });

}



export function pushArenaOfficial(data) {

  if (!pushOfficialFn) return Promise.resolve();

  return pushOfficialFn(data);

}



/** @type {(() => void) | null} */

let logoutFn = null;



export function setArenaLogout(fn) {

  logoutFn = fn ?? null;

}



export function arenaLogout() {

  logoutFn?.();

}



/** @type {(() => Promise<void>) | null} */

let deleteMyAccountFn = null;



/** @type {((q: string) => Promise<Array<{ username: string, displayName: string, isAdmin: boolean }>>) | null} */

let searchUsersFn = null;



/** @type {((username: string) => Promise<void>) | null} */

let deleteUserFn = null;



/** @type {((username: string) => Promise<{ deviceBanned?: boolean }>) | null} */

let banUserFn = null;



/** @type {(() => Promise<Array<{ username: string, displayName: string, isAdmin: boolean, isPrivadas?: boolean, deviceBanned?: boolean, hasDevice?: boolean }>>) | null} */

let listUsersFn = null;



/** @param {{ deleteMyAccount?: () => Promise<void>, searchUsers?: (q: string) => Promise<Array<{ username: string, displayName: string, isAdmin: boolean }>>, listUsers?: () => Promise<Array<{ username: string, displayName: string, isAdmin: boolean, isPrivadas?: boolean, deviceBanned?: boolean, hasDevice?: boolean }>>, deleteUser?: (username: string) => Promise<void>, banUser?: (username: string) => Promise<{ deviceBanned?: boolean }> }} api */

export function setArenaAccountApi({ deleteMyAccount, searchUsers, listUsers, deleteUser, banUser }) {

  deleteMyAccountFn = deleteMyAccount ?? null;

  searchUsersFn = searchUsers ?? null;

  listUsersFn = listUsers ?? null;

  deleteUserFn = deleteUser ?? null;

  banUserFn = banUser ?? null;

}



export function arenaDeleteMyAccount() {

  if (!deleteMyAccountFn) return Promise.reject(new Error("no disponible"));

  return deleteMyAccountFn();

}



export function arenaSearchUsers(q) {

  return searchUsersFn?.(q) ?? Promise.resolve([]);

}



export function arenaAdminDeleteUser(username) {

  if (!deleteUserFn) return Promise.reject(new Error("no disponible"));

  return deleteUserFn(username);

}



export function arenaAdminListUsers() {

  return listUsersFn?.() ?? Promise.resolve([]);

}



export function arenaAdminBanUser(username) {

  if (!banUserFn) return Promise.reject(new Error("no disponible"));

  return banUserFn(username);

}



/** 13 jun 2026 23:59 hora Ciudad de México. */

export function arenaGeneralesGroupsDeadlineMs() {

  return Date.parse("2026-06-13T23:59:00-06:00");

}



export function isArenaGeneralesAndGroupsLocked() {

  return Date.now() >= arenaGeneralesGroupsDeadlineMs();

}



/** Etiqueta legible de la fecha tope (13 jun 2026 23:59 CDMX). */

export function arenaGeneralesGroupsDeadlineDateLabelSpanish() {

  return new Intl.DateTimeFormat("es-MX", {

    timeZone: "America/Mexico_City",

    day: "numeric",

    month: "long",

    hour: "numeric",

    minute: "2-digit",

    hour12: false,

  }).format(new Date(arenaGeneralesGroupsDeadlineMs()));

}



/** @param {number} [nowMs] */

function joinSpanishCountdownParts(parts) {

  if (parts.length === 0) return "";

  if (parts.length === 1) return parts[0];

  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;

  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;

}



/** Texto «Faltan …» hasta el cierre; `null` si ya pasó la fecha tope. @param {number} [nowMs] */

export function formatArenaGeneralesGroupsCountdown(nowMs = Date.now()) {

  const remaining = arenaGeneralesGroupsDeadlineMs() - nowMs;

  if (remaining <= 0) return null;

  const totalSec = Math.floor(remaining / 1000);

  const days = Math.floor(totalSec / 86400);

  const hours = Math.floor((totalSec % 86400) / 3600);

  const minutes = Math.floor((totalSec % 3600) / 60);

  const seconds = totalSec % 60;

  if (days >= 1) {

    const parts = [days === 1 ? "1 día" : `${days} días`];

    if (hours > 0) parts.push(hours === 1 ? "1 hora" : `${hours} horas`);

    if (minutes > 0) parts.push(minutes === 1 ? "1 minuto" : `${minutes} minutos`);

    return `Faltan ${joinSpanishCountdownParts(parts)}`;

  }

  if (hours >= 1) {

    const parts = [hours === 1 ? "1 hora" : `${hours} horas`];

    if (minutes > 0) parts.push(minutes === 1 ? "1 minuto" : `${minutes} minutos`);

    parts.push(seconds === 1 ? "1 segundo" : `${seconds} segundos`);

    return `Faltan ${joinSpanishCountdownParts(parts)}`;

  }

  if (minutes >= 1) {

    return `Faltan ${joinSpanishCountdownParts([

      minutes === 1 ? "1 minuto" : `${minutes} minutos`,

      seconds === 1 ? "1 segundo" : `${seconds} segundos`,

    ])}`;

  }

  return seconds === 1 ? "Falta 1 segundo" : `Faltan ${seconds} segundos`;

}



/** Evita redraws automáticos mientras el usuario interactúa (clics, scroll, formularios). */

let arenaPauseUntil = 0;



export function bumpArenaInteraction(ms = 3000) {

  arenaPauseUntil = Math.max(arenaPauseUntil, Date.now() + ms);

}



export function isArenaInteractionPaused() {

  return isArenaMode() && Date.now() < arenaPauseUntil;

}



/** @type {ReturnType<typeof setTimeout> | null} */

let arenaDeferredRefreshTimer = null;



export function scheduleArenaDeferredRefresh(fn) {

  if (typeof window === "undefined") return;

  if (arenaDeferredRefreshTimer != null) window.clearTimeout(arenaDeferredRefreshTimer);

  arenaDeferredRefreshTimer = window.setTimeout(() => {

    arenaDeferredRefreshTimer = null;

    if (isArenaInteractionPaused()) {

      scheduleArenaDeferredRefresh(fn);

      return;

    }

    fn();

  }, 450);

}



export function bindArenaInteractionGuard() {

  if (typeof document === "undefined") return;

  const onPointer = () => bumpArenaInteraction(3500);

  const onFocusIn = (e) => {

    const t = e.target;

    if (t instanceof HTMLElement && t.matches("input, select, textarea, button, summary, label")) {

      bumpArenaInteraction(8000);

    }

  };

  document.addEventListener("pointerdown", onPointer, true);

  document.addEventListener("wheel", onPointer, { passive: true, capture: true });

  document.addEventListener("touchstart", onPointer, { passive: true, capture: true });

  document.addEventListener("focusin", onFocusIn, true);

}


