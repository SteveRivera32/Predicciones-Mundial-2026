import { getArenaUserId, isArenaMode } from "./arena-mode.js";

/** Clave antigua compartida (privadas + Arena pisaban la misma sesión entre pestañas). */
const STORAGE_KEY_LEGACY = "pm26-session";
/** Quiniela privada (PrediccionesMundial): una sesión por navegador, independiente de Arena. */
const STORAGE_KEY_PRIVADAS = "pm26-session-privadas";
const VERIFIED_PREFIX = "pm26-pin-verified:";

/** @typedef {{ participantId: string }} Session */

function migrateLegacyPrivadasSession() {
  try {
    if (localStorage.getItem(STORAGE_KEY_PRIVADAS)) return;
    const raw = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw) return;
    localStorage.setItem(STORAGE_KEY_PRIVADAS, raw);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Session | null}
 */
export function loadSession() {
  if (isArenaMode()) {
    const id = getArenaUserId();
    return id ? { participantId: id } : null;
  }
  migrateLegacyPrivadasSession();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRIVADAS);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.participantId) return null;
    return { participantId: data.participantId };
  } catch {
    return null;
  }
}

/** @param {Session} session */
export function saveSession(session) {
  if (isArenaMode()) return;
  localStorage.setItem(STORAGE_KEY_PRIVADAS, JSON.stringify(session));
}

export function clearSession() {
  if (isArenaMode()) return;
  localStorage.removeItem(STORAGE_KEY_PRIVADAS);
}

/**
 * Comprueba si en este navegador ya se validó el PIN **actual** del participante.
 * Si el PIN cambia en la lista, deja de coincidir con lo guardado y hay que volver a introducirlo.
 *
 * @param {string} participantId
 * @param {string | null} pin
 */
export function isPinVerified(participantId, pin) {
  if (!pin) return true;
  const saved = localStorage.getItem(VERIFIED_PREFIX + participantId);
  return saved != null && saved === pin;
}

/**
 * @param {string} participantId
 * @param {string} pin
 */
export function markPinVerified(participantId, pin) {
  localStorage.setItem(VERIFIED_PREFIX + participantId, pin);
}

export function clearPinVerifiedForParticipant(participantId) {
  localStorage.removeItem(VERIFIED_PREFIX + participantId);
}
