/**
 * Copias defensivas de marcadores para evitar que oficial y predicciones
 * compartan el mismo objeto en memoria (p. ej. al sincronizar o mezclar estado).
 */

/** @param {unknown} sc */
export function cloneMatchScore(sc) {
  if (!sc || typeof sc !== "object") return { home: "", away: "" };
  const s = /** @type {{ home?: unknown, away?: unknown, penaltyWinner?: unknown }} */ (sc);
  const home = s.home === "" || s.home == null ? "" : s.home;
  const away = s.away === "" || s.away == null ? "" : s.away;
  if ("penaltyWinner" in s) {
    const pw = s.penaltyWinner;
    return {
      home,
      away,
      penaltyWinner: pw === "home" || pw === "away" ? pw : "",
    };
  }
  return { home, away };
}

/** @param {unknown} map */
export function cloneScoreMap(map) {
  if (!map || typeof map !== "object") return {};
  /** @type {Record<string, ReturnType<typeof cloneMatchScore>>} */
  const out = {};
  for (const [id, sc] of Object.entries(map)) {
    out[id] = cloneMatchScore(sc);
  }
  return out;
}

/** @param {Record<string, ReturnType<typeof cloneMatchScore>>} prev @param {Record<string, unknown> | undefined} patch */
export function mergeScoreMapCloned(prev, patch) {
  const out = cloneScoreMap(prev);
  if (!patch || typeof patch !== "object") return out;
  for (const [id, sc] of Object.entries(patch)) {
    out[id] = cloneMatchScore(sc);
  }
  return out;
}
