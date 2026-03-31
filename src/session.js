const STORAGE_KEY = "pm26-session";
const VERIFIED_PREFIX = "pm26-pin-verified:";

/** @typedef {{ participantId: string }} Session */

/**
 * @returns {Session | null}
 */
export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
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
