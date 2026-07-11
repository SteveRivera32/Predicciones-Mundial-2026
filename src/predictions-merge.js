/**
 * Fusión de predicciones sin perder envíos confirmados por condiciones de carrera en sync.
 */

import { normalizePredictionsData } from "./predictions-store.js";
import { mergeScoreMapCloned, cloneMatchScore } from "./match-score-clone.js";

/** @param {unknown} v */
function matchScoreSideSet(v) {
  return v !== "" && v != null;
}

/** @param {{ home?: unknown, away?: unknown } | null | undefined} pred */
function matchScoreBothFilled(pred) {
  return matchScoreSideSet(pred?.home) && matchScoreSideSet(pred?.away);
}

/**
 * Mayor = predicción más avanzada: confirmada > borrador con marcador > vacía.
 * @param {{ home?: unknown, away?: unknown }} pred
 * @param {boolean} predCommitted
 */
export function matchPredictionSubmissionRank(pred, predCommitted) {
  if (predCommitted) return 2;
  if (matchScoreBothFilled(pred)) return 1;
  return 0;
}

/**
 * @param {{ home?: unknown, away?: unknown, penaltyWinner?: unknown }} existingPred
 * @param {boolean} existingCommitted
 * @param {{ home?: unknown, away?: unknown, penaltyWinner?: unknown }} incomingPred
 * @param {boolean} incomingCommitted
 */
function pickBetterMatchSlice(existingPred, existingCommitted, incomingPred, incomingCommitted) {
  const er = matchPredictionSubmissionRank(existingPred, existingCommitted);
  const ir = matchPredictionSubmissionRank(incomingPred, incomingCommitted);
  if (ir > er) return { pred: incomingPred, committed: incomingCommitted };
  if (er > ir) return { pred: existingPred, committed: existingCommitted };
  return { pred: incomingPred, committed: incomingCommitted };
}

/**
 * @param {unknown} existingRaw
 * @param {unknown} incomingRaw
 * @returns {ReturnType<typeof normalizePredictionsData>}
 */
export function mergePredictionsPreferAdvanced(existingRaw, incomingRaw) {
  const existing = normalizePredictionsData(existingRaw);
  const incoming = normalizePredictionsData(incomingRaw);

  const groupScores = mergeScoreMapCloned(existing.groupScores, undefined);
  /** @type {Record<string, true>} */
  const groupScoresConfirmed = { ...existing.groupScoresConfirmed };
  const groupIds = new Set([
    ...Object.keys(existing.groupScores ?? {}),
    ...Object.keys(incoming.groupScores ?? {}),
    ...Object.keys(existing.groupScoresConfirmed ?? {}),
    ...Object.keys(incoming.groupScoresConfirmed ?? {}),
  ]);
  for (const id of groupIds) {
    const pick = pickBetterMatchSlice(
      existing.groupScores?.[id] ?? { home: "", away: "" },
      existing.groupScoresConfirmed?.[id] === true,
      incoming.groupScores?.[id] ?? { home: "", away: "" },
      incoming.groupScoresConfirmed?.[id] === true,
    );
    const rank = matchPredictionSubmissionRank(pick.pred, pick.committed);
    if (rank === 0) {
      delete groupScores[id];
      delete groupScoresConfirmed[id];
      continue;
    }
    groupScores[id] = cloneMatchScoreEntry(pick.pred);
    if (pick.committed) groupScoresConfirmed[id] = true;
    else delete groupScoresConfirmed[id];
  }

  const knockoutScores = mergeScoreMapCloned(existing.knockoutScores, undefined);
  /** @type {Record<string, true>} */
  const knockoutScoresConfirmed = { ...existing.knockoutScoresConfirmed };
  const koIds = new Set([
    ...Object.keys(existing.knockoutScores ?? {}),
    ...Object.keys(incoming.knockoutScores ?? {}),
    ...Object.keys(existing.knockoutScoresConfirmed ?? {}),
    ...Object.keys(incoming.knockoutScoresConfirmed ?? {}),
  ]);
  for (const id of koIds) {
    const pick = pickBetterMatchSlice(
      existing.knockoutScores?.[id] ?? { home: "", away: "" },
      existing.knockoutScoresConfirmed?.[id] === true,
      incoming.knockoutScores?.[id] ?? { home: "", away: "" },
      incoming.knockoutScoresConfirmed?.[id] === true,
    );
    const rank = matchPredictionSubmissionRank(pick.pred, pick.committed);
    if (rank === 0) {
      delete knockoutScores[id];
      delete knockoutScoresConfirmed[id];
      continue;
    }
    knockoutScores[id] = cloneMatchScoreEntry(pick.pred);
    if (pick.committed) knockoutScoresConfirmed[id] = true;
    else delete knockoutScoresConfirmed[id];
  }

  const groupOrderConfirmed = { ...existing.groupOrderConfirmed };
  for (const [gid, ok] of Object.entries(incoming.groupOrderConfirmed ?? {})) {
    if (ok === true) groupOrderConfirmed[gid] = true;
    else if (existing.groupOrderConfirmed?.[gid] !== true) delete groupOrderConfirmed[gid];
  }

  return normalizePredictionsData({
    ...existing,
    ...incoming,
    general: { ...existing.general, ...incoming.general },
    generalConfirmed: incoming.generalConfirmed || existing.generalConfirmed,
    groupOrder: { ...existing.groupOrder, ...incoming.groupOrder },
    groupOrderConfirmed,
    groupThirdAdvances: { ...existing.groupThirdAdvances, ...incoming.groupThirdAdvances },
    groupScores,
    groupScoresConfirmed,
    knockoutScores,
    knockoutScoresConfirmed,
  });
}

/** @param {unknown} pred */
function cloneMatchScoreEntry(pred) {
  return cloneMatchScore(pred);
}
