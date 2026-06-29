/**
 * Arena: al llegar el kickoff, pasa el partido oficial a «en juego» (0-0).
 * Marcadores finales los pone el admin a mano.
 */

import { normalizeOfficialResultsData } from "../../src/official-results-store.js";
import {
  areQuinielaKnockoutSlotsDecided,
  isQuinielaTeamSlotDecided,
} from "../../src/quiniela-knockout-slots.js";
import { GROUP_MATCHES, getKnockoutMatchesFlat } from "../../src/tournament.js";
import { getOfficialResults } from "./db.mjs";
import { saveArenaOfficial } from "./official-privadas-sync.mjs";

/** @param {string | null | undefined} isoKickoff */
function isPastKickoff(isoKickoff) {
  if (!isoKickoff) return false;
  const t = Date.parse(isoKickoff);
  return !Number.isNaN(t) && Date.now() >= t;
}
/** @returns {boolean} hubo cambios */
export function applyServerKickoffStarts() {
  const { data } = getOfficialResults();
  const official = normalizeOfficialResultsData(data);
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

  for (const m of getKnockoutMatchesFlat()) {
    if (!isPastKickoff(m.kickoff)) continue;
    if (!areQuinielaKnockoutSlotsDecided(m, official)) continue;    if ((official.knockoutMatchState?.[m.id] ?? "ready") !== "ready") continue;
    knockoutMatchState[m.id] = "started";
    knockoutScores[m.id] = { home: 0, away: 0, penaltyWinner: "" };
  }

  if (
    !Object.keys(groupMatchState).length &&
    !Object.keys(knockoutMatchState).length
  ) {
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
  saveArenaOfficial(next);
  const n = Object.keys(groupMatchState).length + Object.keys(knockoutMatchState).length;
  console.log(`[arena kickoff] ${n} partido(s) iniciado(s) automáticamente (0-0)`);
  return true;
}

/** @param {{ onChange?: () => void }} [opts] */
export function startOfficialKickoffPoll(opts = {}) {
  const intervalMs = Number(process.env.ARENA_KICKOFF_CHECK_MS || 60_000);
  const tick = () => {
    if (applyServerKickoffStarts()) opts.onChange?.();
  };
  tick();
  console.log(`[arena kickoff] Revisión cada ${Math.round(intervalMs / 1000)} s al llegar la hora de inicio`);
  return setInterval(tick, intervalMs);
}
