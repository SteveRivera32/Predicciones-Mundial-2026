/**
 * Auto-confirmación de borradores al cerrar predicciones (kickoff o partido iniciado).
 * Funciones puras reutilizables en cliente y servidor.
 */

import { normalizePredictionsData } from "./predictions-store.js";
import { mergeScoreMapCloned } from "./match-score-clone.js";
import {
  areQuinielaKnockoutSlotsDecided,
  isQuinielaTeamSlotDecided,
} from "./quiniela-knockout-slots.js";
import { isGroupMatchPredictionsLocked, isKoMatchPredictionsLocked } from "./locks.js";
import {
  GROUP_MATCHES,
  getKnockoutMatchesFlat,
  knockoutRoundRequiresPenaltyPickOnDraw,
} from "./tournament.js";

/**
 * @param {{ home?: string|number|"", away?: string|number|"" } | undefined} draft
 * @param {{ allowPartialDraft?: boolean }} [opts]
 * @returns {{ home: string|number, away: string|number } | null}
 */
export function draftToConfirmedGroupScore(draft, opts = {}) {
  if (!opts.allowPartialDraft) return null;
  const home = draft?.home;
  const away = draft?.away;
  const homeFilled = home !== "" && home != null;
  const awayFilled = away !== "" && away != null;
  if (!homeFilled && !awayFilled) return null;
  if (homeFilled && awayFilled) return { home, away };
  return {
    home: homeFilled ? home : 0,
    away: awayFilled ? away : 0,
  };
}

/** @param {string|number|""|undefined} home @param {string|number|""|undefined} away */
function isDrawScoreNumbers(home, away) {
  const h = typeof home === "number" ? home : parseInt(String(home), 10);
  const a = typeof away === "number" ? away : parseInt(String(away), 10);
  return Number.isFinite(h) && Number.isFinite(a) && h === a;
}

/**
 * @param {{ home?: string|number|"", away?: string|number|"", penaltyWinner?: string } | undefined} draft
 * @param {{ allowPartialDraft?: boolean, roundId?: string }} [opts]
 */
export function draftToConfirmedKoScore(draft, opts = {}) {
  const base = draftToConfirmedGroupScore(draft, opts);
  if (!base) return null;
  const pw = draft?.penaltyWinner;
  const penaltyWinner = pw === "home" || pw === "away" ? pw : "";
  if (
    knockoutRoundRequiresPenaltyPickOnDraw(opts.roundId) &&
    isDrawScoreNumbers(base.home, base.away) &&
    !penaltyWinner
  ) {
    return null;
  }
  return { ...base, penaltyWinner };
}

/**
 * @param {Record<string, unknown>} predictionsMap
 * @param {string[]} participantIds
 * @param {string} matchId
 * @param {{ allowPartialDraft?: boolean }} [opts]
 * @returns {boolean}
 */
export function autoconfirmGroupMatchInPredictionsMap(predictionsMap, participantIds, matchId, opts = {}) {
  let changed = false;
  for (const id of participantIds) {
    const prev = normalizePredictionsData(predictionsMap[id]);
    if (prev.groupScoresConfirmed?.[matchId] === true) continue;
    const confirmed = draftToConfirmedGroupScore(prev.groupScores?.[matchId], opts);
    if (!confirmed) continue;
    predictionsMap[id] = {
      ...prev,
      groupScores: mergeScoreMapCloned(prev.groupScores, { [matchId]: confirmed }),
      groupScoresConfirmed: { ...prev.groupScoresConfirmed, [matchId]: true },
    };
    changed = true;
  }
  return changed;
}

/**
 * @param {Record<string, unknown>} predictionsMap
 * @param {string[]} participantIds
 * @param {string} matchId
 * @param {string | undefined} roundId
 * @param {{ allowPartialDraft?: boolean }} [opts]
 * @returns {boolean}
 */
export function autoconfirmKoMatchInPredictionsMap(
  predictionsMap,
  participantIds,
  matchId,
  roundId,
  opts = {},
) {
  let changed = false;
  for (const id of participantIds) {
    const prev = normalizePredictionsData(predictionsMap[id]);
    if (prev.knockoutScoresConfirmed?.[matchId] === true) continue;
    const confirmed = draftToConfirmedKoScore(prev.knockoutScores?.[matchId], { ...opts, roundId });
    if (!confirmed) continue;
    predictionsMap[id] = {
      ...prev,
      knockoutScores: mergeScoreMapCloned(prev.knockoutScores, { [matchId]: confirmed }),
      knockoutScoresConfirmed: { ...prev.knockoutScoresConfirmed, [matchId]: true },
    };
    changed = true;
  }
  return changed;
}

/**
 * Confirma borradores pendientes en todos los partidos con predicciones ya bloqueadas.
 * @param {ReturnType<import("./official-results-store.js").normalizeOfficialResultsData>} official
 * @param {Record<string, unknown>} predictionsMap
 * @param {string[]} participantIds ids de jugadores que compiten (sin admin técnico)
 * @returns {boolean}
 */
export function autoconfirmLockedMatchPredictions(official, predictionsMap, participantIds) {
  const opts = { allowPartialDraft: true };
  let changed = false;

  for (const m of GROUP_MATCHES) {
    if (!isGroupMatchPredictionsLocked(official, m)) continue;
    if (!isQuinielaTeamSlotDecided(m.home) || !isQuinielaTeamSlotDecided(m.away)) continue;
    if (autoconfirmGroupMatchInPredictionsMap(predictionsMap, participantIds, m.id, opts)) {
      changed = true;
    }
  }

  for (const m of getKnockoutMatchesFlat()) {
    if (!isKoMatchPredictionsLocked(official, m)) continue;
    if (!areQuinielaKnockoutSlotsDecided(m, official)) continue;
    if (autoconfirmKoMatchInPredictionsMap(predictionsMap, participantIds, m.id, m.roundId, opts)) {
      changed = true;
    }
  }

  return changed;
}
