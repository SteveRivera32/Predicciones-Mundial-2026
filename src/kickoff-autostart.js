import { getParticipantsForDisplay } from "./participants.js";
import { loadOfficialResults, saveOfficialResults } from "./official-results-store.js";
import { loadPredictions, savePredictions } from "./predictions-store.js";
import { isLockedAtKickoff } from "./locks.js";
import {
  GROUPS,
  GROUP_MATCHES,
  getKnockoutMatchesFlat,
  isPlaceholderTeam,
  normalizeTeamName,
  resolveKnockoutSlotLabel,
  KNOCKOUT_ROUNDS,
} from "./tournament.js";

const BRACKET_KNOWN_TEAMS = new Set(GROUPS.flatMap((g) => g.teams));

/** @param {unknown} teamName */
function isQuinielaTeamSlotDecided(teamName) {
  const name = normalizeTeamName(teamName);
  return BRACKET_KNOWN_TEAMS.has(name) && !isPlaceholderTeam(name);
}

/** @param {string} matchId */
function getKoRoundMatchIndex(matchId) {
  for (let ri = 0; ri < KNOCKOUT_ROUNDS.length; ri++) {
    const mi = KNOCKOUT_ROUNDS[ri].matches.findIndex((x) => x.id === matchId);
    if (mi >= 0) return { ri, mi };
  }
  return { ri: -1, mi: -1 };
}

/** @param {ReturnType<typeof loadOfficialResults>} official */
function allFilledOfficialKnockoutScores(official) {
  /** @type {Record<string, { home: number|string|"", away: number|string|"" }>} */
  const out = {};
  const scores = official.knockoutScores ?? {};
  for (const round of KNOCKOUT_ROUNDS) {
    for (const m of round.matches) {
      const s = scores[m.id];
      if (s && s.home !== "" && s.away !== "") out[m.id] = s;
    }
  }
  return out;
}

/**
 * Convierte borrador en marcador confirmable. Sin borrador → null (no cuenta).
 * Borrador parcial: conserva lo escrito y completa el otro lado con 0.
 * @param {{ home?: string|number|"", away?: string|number|"" } | undefined} draft
 * @returns {{ home: string|number, away: string|number } | null}
 */
function draftToConfirmedGroupScore(draft) {
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

/** @param {{ home?: string|number|"", away?: string|number|"", penaltyWinner?: string } | undefined} draft */
function draftToConfirmedKoScore(draft) {
  const base = draftToConfirmedGroupScore(draft);
  if (!base) return null;
  const pw = draft?.penaltyWinner;
  return {
    ...base,
    penaltyWinner: pw === "home" || pw === "away" ? pw : "",
  };
}

/** @param {string} matchId @returns {boolean} */
export function confirmPendingPredictionsForGroupMatch(matchId) {
  let changed = false;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.groupScoresConfirmed?.[matchId] === true) continue;
    const confirmed = draftToConfirmedGroupScore(store.groupScores?.[matchId]);
    if (!confirmed) continue;
    savePredictions(p.id, {
      groupScores: { [matchId]: confirmed },
      groupScoresConfirmed: { [matchId]: true },
    });
    changed = true;
  }
  return changed;
}

/** @param {string} matchId @returns {boolean} */
export function confirmPendingPredictionsForKoMatch(matchId) {
  let changed = false;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.knockoutScoresConfirmed?.[matchId] === true) continue;
    const confirmed = draftToConfirmedKoScore(store.knockoutScores?.[matchId]);
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

/**
 * Al llegar el kickoff: iniciar partido (0-0 oficial) y confirmar solo borradores con marcador.
 * Quien no predijo no se confirma ni puntúa.
 * Idempotente.
 * @returns {boolean} hubo cambios persistidos
 */
export function applyKickoffAutoStarts() {
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

    if ((official.groupMatchState?.[m.id] ?? "ready") === "ready") {
      groupMatchState[m.id] = "started";
      groupScores[m.id] = { home: 0, away: 0 };
      changed = true;
    }

    if (confirmPendingPredictionsForGroupMatch(m.id)) changed = true;
  }

  const labelO = allFilledOfficialKnockoutScores(official);
  for (const m of getKnockoutMatchesFlat()) {
    if (!isLockedAtKickoff(m.kickoff)) continue;
    const { ri, mi } = getKoRoundMatchIndex(m.id);
    if (ri < 0) continue;
    const oh = resolveKnockoutSlotLabel(ri, mi, "home", labelO);
    const oa = resolveKnockoutSlotLabel(ri, mi, "away", labelO);
    if (!isQuinielaTeamSlotDecided(oh) || !isQuinielaTeamSlotDecided(oa)) continue;

    if ((official.knockoutMatchState?.[m.id] ?? "ready") === "ready") {
      knockoutMatchState[m.id] = "started";
      knockoutScores[m.id] = { home: 0, away: 0, penaltyWinner: "" };
      changed = true;
    }

    if (confirmPendingPredictionsForKoMatch(m.id)) changed = true;
  }

  if (Object.keys(groupMatchState).length || Object.keys(knockoutMatchState).length) {
    saveOfficialResults({
      ...(Object.keys(groupMatchState).length ? { groupMatchState, groupScores } : {}),
      ...(Object.keys(knockoutMatchState).length ? { knockoutMatchState, knockoutScores } : {}),
    });
  }

  return changed;
}
