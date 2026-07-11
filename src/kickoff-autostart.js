import { isArenaMode } from "./arena-mode.js";
import { getParticipantsForDisplay } from "./participants.js";
import { loadOfficialResults, saveOfficialResults } from "./official-results-store.js";
import { loadPredictions, savePredictions } from "./predictions-store.js";
import {
  isLockedAtKickoff,
  isGroupMatchPredictionsLocked,
  isKoMatchPredictionsLocked,
  scheduleKickoffLockRefresh,
} from "./locks.js";
import {
  areQuinielaKnockoutSlotsDecided,
  isQuinielaTeamSlotDecided,
} from "./quiniela-knockout-slots.js";
import { GROUP_MATCHES, getKnockoutMatchesFlat } from "./tournament.js";
import {
  draftToConfirmedGroupScore,
  draftToConfirmedKoScore,
} from "./prediction-autoconfirm.js";

/** @param {string} matchId @param {{ allowPartialDraft?: boolean }} [opts] @returns {boolean} */
export function confirmPendingPredictionsForGroupMatch(matchId, opts = {}) {
  let changed = false;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.groupScoresConfirmed?.[matchId] === true) continue;
    const confirmed = draftToConfirmedGroupScore(store.groupScores?.[matchId], opts);
    if (!confirmed) continue;
    savePredictions(p.id, {
      groupScores: { [matchId]: confirmed },
      groupScoresConfirmed: { [matchId]: true },
    });
    changed = true;
  }
  return changed;
}

/** @param {string} matchId @param {{ allowPartialDraft?: boolean }} [opts] @returns {boolean} */
export function confirmPendingPredictionsForKoMatch(matchId, opts = {}) {
  let changed = false;
  const mKo = getKnockoutMatchesFlat().find((x) => x.id === matchId);
  const roundId = mKo?.roundId;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.knockoutScoresConfirmed?.[matchId] === true) continue;
    const confirmed = draftToConfirmedKoScore(store.knockoutScores?.[matchId], {
      ...opts,
      roundId,
    });
    if (!confirmed) continue;
    savePredictions(p.id, {
      knockoutScores: {
        ...store.knockoutScores,
        [matchId]: confirmed,
      },
      knockoutScoresConfirmed: { [matchId]: true },
    });
    changed = true;
  }
  return changed;
}

/** @param {ReturnType<typeof loadOfficialResults>} official @returns {boolean} */
function confirmPendingPredictionsForLockedMatches(official) {
  const opts = { allowPartialDraft: true };
  let changed = false;

  for (const m of GROUP_MATCHES) {
    if (!isGroupMatchPredictionsLocked(official, m)) continue;
    if (!isQuinielaTeamSlotDecided(m.home) || !isQuinielaTeamSlotDecided(m.away)) continue;
    if (confirmPendingPredictionsForGroupMatch(m.id, opts)) changed = true;
  }

  for (const m of getKnockoutMatchesFlat()) {
    if (!isKoMatchPredictionsLocked(official, m)) continue;
    if (!areQuinielaKnockoutSlotsDecided(m, official)) continue;
    if (confirmPendingPredictionsForKoMatch(m.id, opts)) changed = true;
  }

  return changed;
}

/**
 * Al llegar el kickoff: iniciar partido (0-0 oficial) y confirmar solo borradores con marcador.
 * Quien no predijo no se confirma ni puntúa.
 * Idempotente.
 * @returns {boolean} hubo cambios persistidos
 */
export function applyKickoffAutoStarts() {
  if (isArenaMode()) return false;
  const official = loadOfficialResults();
  /** @type {Record<string, "started">} */
  const groupMatchState = {};
  /** @type {Record<string, { home: 0, away: 0 }>} */
  const groupScores = {};
  /** @type {Record<string, "started">} */
  const knockoutMatchState = {};
  /** @type {Record<string, { home: 0, away: 0, penaltyWinner: "" }>} */
  const knockoutScores = {};
  let changed = false;

  for (const m of GROUP_MATCHES) {
    if (!isLockedAtKickoff(m.kickoff)) continue;
    if (!isQuinielaTeamSlotDecided(m.home) || !isQuinielaTeamSlotDecided(m.away)) continue;

    const justStartedGroup = (official.groupMatchState?.[m.id] ?? "ready") === "ready";
    if (justStartedGroup) {
      groupMatchState[m.id] = "started";
      groupScores[m.id] = { home: 0, away: 0 };
      changed = true;
    }
  }

  for (const m of getKnockoutMatchesFlat()) {
    if (!isLockedAtKickoff(m.kickoff)) continue;
    if (!areQuinielaKnockoutSlotsDecided(m, official)) continue;

    const justStartedKo = (official.knockoutMatchState?.[m.id] ?? "ready") === "ready";
    if (justStartedKo) {
      knockoutMatchState[m.id] = "started";
      knockoutScores[m.id] = { home: 0, away: 0, penaltyWinner: "" };
      changed = true;
    }
  }

  if (Object.keys(groupMatchState).length || Object.keys(knockoutMatchState).length) {
    saveOfficialResults({
      ...(Object.keys(groupMatchState).length ? { groupMatchState, groupScores } : {}),
      ...(Object.keys(knockoutMatchState).length ? { knockoutMatchState, knockoutScores } : {}),
    });
    official = loadOfficialResults();
  }

  // También si el servidor ya inició el partido (0-0) antes de que abriera un cliente.
  if (confirmPendingPredictionsForLockedMatches(official)) changed = true;

  return changed;
}

/** @returns {boolean} hay partidos con kickoff pasado que siguen en «ready» */
export function hasReadyMatchesPastKickoff() {
  if (isArenaMode()) return false;
  const official = loadOfficialResults();

  for (const m of GROUP_MATCHES) {
    if (!isLockedAtKickoff(m.kickoff)) continue;
    if ((official.groupMatchState?.[m.id] ?? "ready") !== "ready") continue;
    if (!isQuinielaTeamSlotDecided(m.home) || !isQuinielaTeamSlotDecided(m.away)) continue;
    return true;
  }

  for (const m of getKnockoutMatchesFlat()) {
    if (!isLockedAtKickoff(m.kickoff)) continue;
    if (!areQuinielaKnockoutSlotsDecided(m, official)) continue;
    if ((official.knockoutMatchState?.[m.id] ?? "ready") !== "ready") continue;
    return true;
  }

  return false;
}

/** @type {ReturnType<typeof setTimeout> | null} */
let staleKickoffRetryTimer = null;

const STALE_KICKOFF_RETRY_MS = 15_000;

/**
 * Refresca al próximo kickoff y reintenta autostart si quedaron partidos «ready» tras la hora.
 * @param {() => void} onRefresh
 */
export function scheduleKickoffAutoStartRefresh(onRefresh) {
  scheduleKickoffLockRefresh(onRefresh);

  if (staleKickoffRetryTimer) {
    clearTimeout(staleKickoffRetryTimer);
    staleKickoffRetryTimer = null;
  }
  if (!hasReadyMatchesPastKickoff()) return;

  staleKickoffRetryTimer = window.setTimeout(() => {
    staleKickoffRetryTimer = null;
    onRefresh();
    scheduleKickoffAutoStartRefresh(onRefresh);
  }, STALE_KICKOFF_RETRY_MS);
}
