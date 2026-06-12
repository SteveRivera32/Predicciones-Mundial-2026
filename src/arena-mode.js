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



/** 13 jul 2026 23:59 hora Ciudad de México. */

export function arenaGeneralesGroupsDeadlineMs() {

  return Date.parse("2026-07-13T23:59:00-06:00");

}



export function isArenaGeneralesAndGroupsLocked() {

  return Date.now() >= arenaGeneralesGroupsDeadlineMs();

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


