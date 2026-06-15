/**
 * Desempate único para todos los rankings:
 * PUNTOS → PERFECTO → EXCELENTE → BIEN → BONUS → CERCANÍA → nombre.
 */

/** @param {Record<string, unknown>} row */
function rankingPts(row) {
  return Number(row.pts ?? row.totalPoints) || 0;
}

/** @param {Record<string, unknown>} row */
function rankingPerfect(row) {
  return Number(row.totalPerfect ?? row.perfectCount ?? row.perfectoBonusCount) || 0;
}

/** @param {Record<string, unknown>} row */
function rankingExcelente(row) {
  return Number(row.totalExcelente ?? row.excelenteCount) || 0;
}

/** @param {Record<string, unknown>} row */
function rankingBien(row) {
  return Number(row.totalBien ?? row.bienCount) || 0;
}

/** @param {Record<string, unknown>} row */
function rankingBonus(row) {
  return Number(row.totalBonus ?? row.bonusCount) || 0;
}

/** @param {Record<string, unknown>} row */
function rankingClosest(row) {
  return Number(row.totalClosest ?? row.closestCount) || 0;
}

/** @param {Record<string, unknown>} row */
function rankingName(row) {
  return String(row.p?.name ?? row.participant?.name ?? "");
}

/** @param {Record<string, unknown>} a @param {Record<string, unknown>} b */
export function compareRankingRows(a, b) {
  const ptsDiff = rankingPts(b) - rankingPts(a);
  if (ptsDiff !== 0) return ptsDiff;
  const perfectDiff = rankingPerfect(b) - rankingPerfect(a);
  if (perfectDiff !== 0) return perfectDiff;
  const excelenteDiff = rankingExcelente(b) - rankingExcelente(a);
  if (excelenteDiff !== 0) return excelenteDiff;
  const bienDiff = rankingBien(b) - rankingBien(a);
  if (bienDiff !== 0) return bienDiff;
  const bonusDiff = rankingBonus(b) - rankingBonus(a);
  if (bonusDiff !== 0) return bonusDiff;
  const closestDiff = rankingClosest(b) - rankingClosest(a);
  if (closestDiff !== 0) return closestDiff;
  return rankingName(a).localeCompare(rankingName(b), "es", { sensitivity: "base" });
}

/** @template T @param {T[]} rows */
export function sortByRankingTiebreak(rows) {
  return [...rows].sort(compareRankingRows);
}
