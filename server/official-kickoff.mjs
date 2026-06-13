/**
 * Quiniela privada (servidor): al llegar el kickoff, pasa el partido oficial a «en juego» (0-0).
 * Independiente de Arena; marcadores finales los pone el admin en privadas.
 */

import { normalizeOfficialResultsData } from "../src/official-results-store.js";
import {
  GROUP_MATCHES,
  getKnockoutMatchesFlat,
  isPlaceholderTeam,
  normalizeTeamName,
  resolveKnockoutSlotLabel,
  KNOCKOUT_ROUNDS,
  GROUPS,
} from "../src/tournament.js";

const BRACKET_KNOWN_TEAMS = new Set(GROUPS.flatMap((g) => g.teams));

/** @param {string | null | undefined} isoKickoff */
function isPastKickoff(isoKickoff) {
  if (!isoKickoff) return false;
  const t = Date.parse(isoKickoff);
  return !Number.isNaN(t) && Date.now() >= t;
}

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

/** @param {ReturnType<typeof normalizeOfficialResultsData>} official */
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
 * @param {() => unknown} readOfficial
 * @param {(next: ReturnType<typeof normalizeOfficialResultsData>) => void} writeOfficial
 * @returns {boolean}
 */
export function applyServerKickoffStarts(readOfficial, writeOfficial) {
  const official = normalizeOfficialResultsData(readOfficial());
  /** @type {Record<string, "started">} */
  const groupMatchState = {};
  /** @type {Record<string, { home: 0, away: 0 }>} */
  const groupScores = {};
  /** @type {Record<string, "started">} */
  const knockoutMatchState = {};
  /** @type {Record<string, { home: 0, away: 0, penaltyWinner: "" }>} */
  const knockoutScores = {};

  for (const m of GROUP_MATCHES) {
    if (!isPastKickoff(m.kickoff)) continue;
    if (!isQuinielaTeamSlotDecided(m.home) || !isQuinielaTeamSlotDecided(m.away)) continue;
    if ((official.groupMatchState?.[m.id] ?? "ready") !== "ready") continue;
    groupMatchState[m.id] = "started";
    groupScores[m.id] = { home: 0, away: 0 };
  }

  const labelO = allFilledOfficialKnockoutScores(official);
  for (const m of getKnockoutMatchesFlat()) {
    if (!isPastKickoff(m.kickoff)) continue;
    const { ri, mi } = getKoRoundMatchIndex(m.id);
    if (ri < 0) continue;
    const oh = resolveKnockoutSlotLabel(ri, mi, "home", labelO);
    const oa = resolveKnockoutSlotLabel(ri, mi, "away", labelO);
    if (!isQuinielaTeamSlotDecided(oh) || !isQuinielaTeamSlotDecided(oa)) continue;
    if ((official.knockoutMatchState?.[m.id] ?? "ready") !== "ready") continue;
    knockoutMatchState[m.id] = "started";
    knockoutScores[m.id] = { home: 0, away: 0, penaltyWinner: "" };
  }

  if (!Object.keys(groupMatchState).length && !Object.keys(knockoutMatchState).length) {
    return false;
  }

  const next = normalizeOfficialResultsData({
    ...official,
    ...(Object.keys(groupMatchState).length
      ? {
          groupMatchState: { ...official.groupMatchState, ...groupMatchState },
          groupScores: { ...official.groupScores, ...groupScores },
        }
      : {}),
    ...(Object.keys(knockoutMatchState).length
      ? {
          knockoutMatchState: { ...official.knockoutMatchState, ...knockoutMatchState },
          knockoutScores: { ...official.knockoutScores, ...knockoutScores },
        }
      : {}),
  });
  writeOfficial(next);
  const n = Object.keys(groupMatchState).length + Object.keys(knockoutMatchState).length;
  console.log(`[pm26 kickoff] ${n} partido(s) iniciado(s) automáticamente (0-0)`);
  return true;
}

/** @param {() => unknown} readOfficial @param {(next: ReturnType<typeof normalizeOfficialResultsData>) => void} writeOfficial */
export function startOfficialKickoffPoll(readOfficial, writeOfficial) {
  const intervalMs = Number(process.env.PM26_KICKOFF_CHECK_MS || 60_000);
  const tick = () => {
    applyServerKickoffStarts(readOfficial, writeOfficial);
  };
  tick();
  console.log(`[pm26 kickoff] Revisión cada ${Math.round(intervalMs / 1000)} s al llegar la hora de inicio`);
  return setInterval(tick, intervalMs);
}
