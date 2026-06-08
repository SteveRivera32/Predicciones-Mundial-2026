import { GROUP_MATCHES, getKnockoutMatchesFlat } from "./tournament.js";

/**
 * @param {string | null | undefined} isoKickoff
 * @returns {boolean} true si ya no se puede editar
 */
export function isLockedAtKickoff(isoKickoff) {
  if (!isoKickoff) return false;
  const t = Date.parse(isoKickoff);
  if (Number.isNaN(t)) return false;
  return Date.now() >= t;
}

/** @returns {Array<{ kickoff?: string | null }>} */
export function getAllTournamentMatchesWithKickoff() {
  return [...GROUP_MATCHES, ...getKnockoutMatchesFlat()];
}

/** Predicciones generales: cerrar cuando ya empezó algún partido del torneo (por hora de kickoff). */
export function isAnyTournamentMatchKickoffLocked() {
  return getAllTournamentMatchesWithKickoff().some((m) => isLockedAtKickoff(m.kickoff));
}

/**
 * Marcadores predichos en Partidos (fase de grupos): kickoff o admin «Iniciar partido».
 * No usa `groupPredictionsBlockedForAll` (ese bloqueo es solo para orden de grupos).
 * @param {{ groupMatchState?: Record<string, string> }} official
 * @param {{ id: string, kickoff?: string | null }} m
 */
export function isGroupMatchPredictionsLocked(official, m) {
  const matchStage = official.groupMatchState?.[m.id] ?? "ready";
  return matchStage !== "ready" || isLockedAtKickoff(m.kickoff);
}

/**
 * @param {{ knockoutMatchState?: Record<string, string> }} official
 * @param {{ id: string, kickoff?: string | null }} m
 */
export function isKoMatchPredictionsLocked(official, m) {
  const koStage = official.knockoutMatchState?.[m.id] ?? "ready";
  return koStage !== "ready" || isLockedAtKickoff(m.kickoff);
}

/** @returns {number | null} ms desde epoch del próximo kickoff futuro, o null si no hay ninguno. */
export function nextTournamentKickoffTimestamp() {
  const now = Date.now();
  let next = Infinity;
  for (const m of getAllTournamentMatchesWithKickoff()) {
    if (!m.kickoff) continue;
    const t = Date.parse(m.kickoff);
    if (Number.isNaN(t) || t <= now) continue;
    if (t < next) next = t;
  }
  return Number.isFinite(next) ? next : null;
}

/** @type {ReturnType<typeof setTimeout> | null} */
let kickoffRefreshTimer = null;

/**
 * Refresca la UI cuando llegue el próximo kickoff (cierra predicciones por hora sin recargar).
 * @param {() => void} onKickoff
 */
export function scheduleKickoffLockRefresh(onKickoff) {
  if (kickoffRefreshTimer) {
    clearTimeout(kickoffRefreshTimer);
    kickoffRefreshTimer = null;
  }
  const next = nextTournamentKickoffTimestamp();
  if (next === null) return;
  const delay = Math.max(0, next - Date.now()) + 100;
  kickoffRefreshTimer = window.setTimeout(() => {
    kickoffRefreshTimer = null;
    onKickoff();
    scheduleKickoffLockRefresh(onKickoff);
  }, delay);
}
