/**
 * Resolución de bandas en eliminatoria (Partidos / kickoff autostart / servidor).
 * Alinea 16vos con el snapshot oficial de grupos y rondas posteriores con marcadores KO.
 */

import {
  GROUPS,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_PHASE_ROUND_INDEX,
  R32_THIRD_WINNER_FOR_MATCH_ID,
  isPlaceholderTeam,
  normalizeTeamName,
  resolveKnockoutSlotLabel,
} from "./tournament.js";
import { getLiveOfficialGroupSnapshotFromOfficial } from "./live-ranking.js";
import { resolveThirdPlaceTeamForWinner } from "./third-place-assignments.js";

const MAX_BEST_THIRD_TEAMS = 8;
const BRACKET_KNOWN_TEAMS = new Set(GROUPS.flatMap((g) => g.teams));

/** @param {unknown} teamName */
export function isQuinielaTeamSlotDecided(teamName) {
  const name = normalizeTeamName(teamName);
  return BRACKET_KNOWN_TEAMS.has(name) && !isPlaceholderTeam(name);
}

/** @param {import("./official-results-store.js").OfficialResults} official */
export function allFilledOfficialKnockoutScores(official) {
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

/** @param {string} matchId */
export function getKoRoundMatchIndex(matchId) {
  for (let ri = 0; ri < KNOCKOUT_ROUNDS.length; ri++) {
    const mi = KNOCKOUT_ROUNDS[ri].matches.findIndex((x) => x.id === matchId);
    if (mi >= 0) return { ri, mi };
  }
  return { ri: -1, mi: -1 };
}

/**
 * @param {string} label
 * @param {string} matchId
 * @param {Record<string, string[]>} orderByGroup
 * @param {Record<string, boolean>} groupCompletedByGroup
 * @param {Record<string, boolean>} thirdAdvanceByGroup
 */
export function resolveLiveR32SeedLabel(label, matchId, orderByGroup, groupCompletedByGroup, thirdAdvanceByGroup) {
  const txt = String(label ?? "").trim();
  const m = /^([12])º Grupo ([A-L])$/.exec(txt);
  if (m) {
    const pos = m[1] === "1" ? 0 : 1;
    const groupId = m[2];
    if (groupCompletedByGroup[groupId] !== true) return txt;
    return orderByGroup[groupId]?.[pos] ?? txt;
  }
  const winnerGroupId = R32_THIRD_WINNER_FOR_MATCH_ID[matchId];
  if (winnerGroupId && txt.startsWith("3º")) {
    const qualifyingThirdGroupIds = GROUPS.filter((g) => thirdAdvanceByGroup[g.id] === true).map((g) => g.id);
    if (qualifyingThirdGroupIds.length !== MAX_BEST_THIRD_TEAMS) return txt;
    return resolveThirdPlaceTeamForWinner(winnerGroupId, qualifyingThirdGroupIds, orderByGroup) ?? txt;
  }
  return txt;
}

/** @param {import("./official-results-store.js").OfficialResults} official @returns {Record<string, string>} */
export function buildLiveR32SlotMapFromOfficial(official) {
  const snap = getLiveOfficialGroupSnapshotFromOfficial(official);
  const orderByGroup = snap.orderByGroup ?? {};
  const groupCompletedByGroup = snap.groupCompletedByGroup ?? {};
  const thirdAdvanceByGroup = snap.thirdAdvanceByGroup ?? {};
  /** @type {Record<string, string>} */
  const out = {};
  const r32 = KNOCKOUT_ROUNDS[KNOCKOUT_PHASE_ROUND_INDEX.r32];
  for (const m of r32.matches) {
    out[`${m.id}:home`] = resolveLiveR32SeedLabel(
      m.homeLabel,
      m.id,
      orderByGroup,
      groupCompletedByGroup,
      thirdAdvanceByGroup,
    );
    out[`${m.id}:away`] = resolveLiveR32SeedLabel(
      m.awayLabel,
      m.id,
      orderByGroup,
      groupCompletedByGroup,
      thirdAdvanceByGroup,
    );
  }
  return out;
}

/**
 * @param {{ id: string }} m
 * @param {import("./official-results-store.js").OfficialResults} official
 * @returns {{ home: string, away: string }}
 */
export function resolveQuinielaKnockoutSlotLabels(m, official) {
  const { ri, mi } = getKoRoundMatchIndex(m.id);
  const labelScores = allFilledOfficialKnockoutScores(official);
  const liveR32SlotMap =
    ri === KNOCKOUT_PHASE_ROUND_INDEX.r32 ? buildLiveR32SlotMapFromOfficial(official) : null;
  return {
    home:
      liveR32SlotMap?.[`${m.id}:home`] ?? resolveKnockoutSlotLabel(ri, mi, "home", labelScores),
    away:
      liveR32SlotMap?.[`${m.id}:away`] ?? resolveKnockoutSlotLabel(ri, mi, "away", labelScores),
  };
}

/**
 * @param {{ id: string }} m
 * @param {import("./official-results-store.js").OfficialResults} official
 */
export function areQuinielaKnockoutSlotsDecided(m, official) {
  const { home, away } = resolveQuinielaKnockoutSlotLabels(m, official);
  return isQuinielaTeamSlotDecided(home) && isQuinielaTeamSlotDecided(away);
}
