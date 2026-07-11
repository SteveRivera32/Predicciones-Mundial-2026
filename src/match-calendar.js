/**
 * Calendario de partidos: «siguiente» jornada y días restantes.
 * La jornada «SIGUIENTE PARTIDO» usa la fecha local en America/Mexico_City para alinear «día» con el torneo.
 */

/** Zona usada para agrupar «todos los partidos de ese día» (sede principal del formato). */
export const TOURNAMENT_DAY_TZ = "America/Mexico_City";

/**
 * @param {Date} d
 * @param {string} timeZone
 * @returns {string} YYYY-MM-DD
 */
export function calendarDayKeyInTz(d, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/**
 * @param {string | null | undefined} isoKickoff
 * @param {string} [timeZone]
 */
export function calendarDayKeyForKickoff(isoKickoff, timeZone = TOURNAMENT_DAY_TZ) {
  if (!isoKickoff) return "";
  const t = Date.parse(isoKickoff);
  if (Number.isNaN(t)) return "";
  return calendarDayKeyInTz(new Date(t), timeZone);
}

/**
 * Día local del usuario (medianoche comparada en calendario local).
 * @param {Date} d
 */
export function calendarDayKeyLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Días hasta el kickoff según calendario del torneo (CDMX).
 * @param {string} isoKickoff
 * @param {string} [timeZone]
 */
export function daysUntilKickoffLocal(isoKickoff, timeZone = TOURNAMENT_DAY_TZ) {
  const t = Date.parse(isoKickoff);
  if (Number.isNaN(t)) return null;
  const kickDay = calendarDayKeyInTz(new Date(t), timeZone);
  const nowDay = calendarDayKeyInTz(new Date(), timeZone);
  const k = Date.parse(`${kickDay}T12:00:00`);
  const n = Date.parse(`${nowDay}T12:00:00`);
  return Math.round((k - n) / 86400000);
}

/**
 * Hora local del navegador (zona horaria del equipo del usuario).
 * @param {string} isoKickoff
 */
export function formatKickoffLongSpanish(isoKickoff) {
  const t = Date.parse(isoKickoff);
  if (Number.isNaN(t)) return "";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

/**
 * Fecha/hora compacta para esquina de tarjeta (hora CDMX, alineada al torneo).
 * @param {string} isoKickoff
 */
export function formatKickoffShortSpanish(isoKickoff) {
  const t = Date.parse(isoKickoff);
  if (Number.isNaN(t)) return "";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TOURNAMENT_DAY_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

/**
 * Solo día y mes para agrupar jornadas (p. ej. «11 de junio»).
 * @param {string} isoKickoff
 * @param {string} [timeZone]
 */
export function formatKickoffDayLabelSpanish(isoKickoff, timeZone = TOURNAMENT_DAY_TZ) {
  const t = Date.parse(isoKickoff);
  if (Number.isNaN(t)) return "";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    day: "numeric",
    month: "long",
  }).format(new Date(t));
}

/**
 * @param {string} isoKickoff
 */
export function countdownLabelSpanish(isoKickoff) {
  const d = daysUntilKickoffLocal(isoKickoff);
  if (d === null) return "";
  if (d === 0) return "Es hoy";
  if (d === 1) return "Falta 1 día";
  if (d > 1) return `Faltan ${d} días`;
  if (d === -1) return "Hace 1 día";
  return `Hace ${-d} días`;
}

/**
 * @param {string | null | undefined} isoKickoff
 */
export function isPastKickoff(isoKickoff) {
  if (!isoKickoff) return false;
  const t = Date.parse(isoKickoff);
  return !Number.isNaN(t) && Date.now() >= t;
}

/**
 * Grupo: terminado y resultado confirmado por admin.
 * @param {{ groupScoresConfirmed?: Record<string, true>, groupMatchState?: Record<string, string> }} official
 * @param {{ id: string }} m
 */
export function isGroupMatchOfficiallyClosed(official, m) {
  const stage = official.groupMatchState?.[m.id] ?? "ready";
  return stage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
}

/**
 * Eliminatoria: resultado confirmado.
 * @param {{ knockoutScoresConfirmed?: Record<string, true> }} official
 * @param {{ id: string }} m
 */
export function isKoMatchOfficiallyClosed(official, m) {
  return official.knockoutScoresConfirmed?.[m.id] === true;
}

/**
 * @param {ReturnType<typeof import("./official-results-store.js").loadOfficialResults>} official
 * @param {{ id: string, kickoff?: string | null, groupId?: string, roundId?: string }} m
 */
export function isMatchOfficiallyClosed(official, m) {
  if (m.groupId != null) return isGroupMatchOfficiallyClosed(official, m);
  if (m.roundId != null) return isKoMatchOfficiallyClosed(official, m);
  return false;
}

/**
 * Fase de grupos: en juego (admin inició o autostart al kickoff → `started`).
 * @param {ReturnType<typeof import("./official-results-store.js").loadOfficialResults>} official
 * @param {{ id: string, kickoff?: string | null }} m
 */
export function isGroupMatchLive(official, m) {
  return (official.groupMatchState?.[m.id] ?? "ready") === "started";
}

/**
 * Eliminatoria: en juego (`knockoutMatchState === started`).
 * @param {ReturnType<typeof import("./official-results-store.js").loadOfficialResults>} official
 * @param {{ id: string, kickoff?: string | null }} m
 */
export function isKoMatchLive(official, m) {
  return (official.knockoutMatchState?.[m.id] ?? "ready") === "started";
}

/**
 * @param {ReturnType<typeof import("./official-results-store.js").loadOfficialResults>} official
 * @param {{ id: string, kickoff?: string | null, groupId?: string, roundId?: string }} m
 */
export function isMatchLiveInPlay(official, m) {
  if (m.groupId != null) return isGroupMatchLive(official, m);
  if (m.roundId != null) return isKoMatchLive(official, m);
  return false;
}

/**
 * Ids de la jornada próxima: partidos del mismo día (CDMX) que la jornada activa, aún no iniciados.
 * La jornada activa se queda en ese día mientras quede algún partido en juego (`started`);
 * solo avanza cuando ya no hay en juego en el día y el pendiente más cercano pasa al siguiente día.
 * @param {ReturnType<typeof import("./official-results-store.js").loadOfficialResults>} official
 * @param {Array<{ id: string, kickoff?: string | null, groupId?: string, roundId?: string }>} allMatches
 */
export function getNextMatchDayHighlightIds(official, allMatches) {
  const pending = allMatches.filter((m) => m.kickoff && !isMatchOfficiallyClosed(official, m));
  if (pending.length === 0) return new Set();

  const livePending = pending.filter((m) => isMatchLiveInPlay(official, m));
  /** @type {string} */
  let targetDay;
  if (livePending.length > 0) {
    let minLiveTs = Infinity;
    for (const m of livePending) {
      const ts = Date.parse(/** @type {string} */ (m.kickoff));
      if (!Number.isNaN(ts) && ts < minLiveTs) minLiveTs = ts;
    }
    if (!Number.isFinite(minLiveTs)) return new Set();
    targetDay = calendarDayKeyInTz(new Date(minLiveTs), TOURNAMENT_DAY_TZ);
  } else {
    let minTs = Infinity;
    for (const m of pending) {
      const ts = Date.parse(/** @type {string} */ (m.kickoff));
      if (!Number.isNaN(ts) && ts < minTs) minTs = ts;
    }
    if (!Number.isFinite(minTs)) return new Set();
    targetDay = calendarDayKeyInTz(new Date(minTs), TOURNAMENT_DAY_TZ);
  }

  const ids = new Set();
  for (const m of pending) {
    if (calendarDayKeyForKickoff(m.kickoff, TOURNAMENT_DAY_TZ) !== targetDay) continue;
    if (isMatchLiveInPlay(official, m)) continue;
    ids.add(m.id);
  }
  return ids;
}
