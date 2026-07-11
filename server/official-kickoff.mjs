/**
 * Quiniela privada (servidor): al llegar el kickoff, pasa el partido oficial a «en juego» (0-0)
 * y confirma borradores pendientes en predicciones.
 * Independiente de Arena; marcadores finales los pone el admin en privadas.
 */

import { normalizeOfficialResultsData } from "../src/official-results-store.js";
import { autoconfirmLockedMatchPredictions } from "../src/prediction-autoconfirm.js";
import {
  areQuinielaKnockoutSlotsDecided,
  isQuinielaTeamSlotDecided,
} from "../src/quiniela-knockout-slots.js";
import { GROUP_MATCHES, getKnockoutMatchesFlat } from "../src/tournament.js";

/** @param {string | null | undefined} isoKickoff */
function isPastKickoff(isoKickoff) {
  if (!isoKickoff) return false;
  const t = Date.parse(isoKickoff);
  return !Number.isNaN(t) && Date.now() >= t;
}

/**
 * @param {() => unknown} readOfficial
 * @param {(next: ReturnType<typeof normalizeOfficialResultsData>) => void} writeOfficial
 * @param {() => Record<string, unknown>} readPredictions
 * @param {(next: Record<string, unknown>) => void} writePredictions
 * @param {() => string[]} readCompetingParticipantIds
 * @returns {boolean}
 */
export function applyServerKickoffStarts(
  readOfficial,
  writeOfficial,
  readPredictions,
  writePredictions,
  readCompetingParticipantIds,
) {
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

  for (const m of getKnockoutMatchesFlat()) {
    if (!isPastKickoff(m.kickoff)) continue;
    if (!areQuinielaKnockoutSlotsDecided(m, official)) continue;
    if ((official.knockoutMatchState?.[m.id] ?? "ready") !== "ready") continue;
    knockoutMatchState[m.id] = "started";
    knockoutScores[m.id] = { home: 0, away: 0, penaltyWinner: "" };
  }

  if (!Object.keys(groupMatchState).length && !Object.keys(knockoutMatchState).length) {
    const predictions = readPredictions();
    const participantIds = readCompetingParticipantIds();
    if (autoconfirmLockedMatchPredictions(official, predictions, participantIds)) {
      writePredictions(predictions);
      console.log("[pm26 kickoff] predicciones pendientes auto-confirmadas");
      return true;
    }
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
  const officialAfter = normalizeOfficialResultsData(next);
  const predictions = readPredictions();
  const participantIds = readCompetingParticipantIds();
  let predictionsChanged = autoconfirmLockedMatchPredictions(officialAfter, predictions, participantIds);
  if (predictionsChanged) writePredictions(predictions);
  const n = Object.keys(groupMatchState).length + Object.keys(knockoutMatchState).length;
  console.log(`[pm26 kickoff] ${n} partido(s) iniciado(s) automáticamente (0-0)`);
  if (predictionsChanged) console.log("[pm26 kickoff] predicciones pendientes auto-confirmadas");
  return true;
}

/** @param {() => unknown} readOfficial @param {(next: ReturnType<typeof normalizeOfficialResultsData>) => void} writeOfficial @param {() => Record<string, unknown>} readPredictions @param {(next: Record<string, unknown>) => void} writePredictions @param {() => string[]} readCompetingParticipantIds */
export function startOfficialKickoffPoll(
  readOfficial,
  writeOfficial,
  readPredictions,
  writePredictions,
  readCompetingParticipantIds,
) {
  const intervalMs = Number(process.env.PM26_KICKOFF_CHECK_MS || 60_000);
  const tick = () => {
    applyServerKickoffStarts(
      readOfficial,
      writeOfficial,
      readPredictions,
      writePredictions,
      readCompetingParticipantIds,
    );
  };
  tick();
  console.log(`[pm26 kickoff] Revisión cada ${Math.round(intervalMs / 1000)} s al llegar la hora de inicio`);
  return setInterval(tick, intervalMs);
}
