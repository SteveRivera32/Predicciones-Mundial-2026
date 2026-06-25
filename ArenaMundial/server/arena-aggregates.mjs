/**
 * Rankings y recuentos de votos Arena en un solo pase (evita cargar todas las predicciones dos veces).
 */

import { getAllArenaParticipants, getAllPredictionsByUsername, getOfficialResults } from "./db.mjs";
import { normalizeOfficialResultsData } from "../../src/official-results-store.js";
import { normalizePredictionsData } from "../../src/predictions-store.js";
import {
  computeLiveParticipantRowsFromData,
  computeArenaMatchVoteData,
} from "../../src/live-ranking.js";
import { sortByRankingTiebreak } from "../../src/ranking-tiebreak.js";

/** @type {{ sorted: ReturnType<typeof computeLiveParticipantRowsFromData>, matchVoteData: ReturnType<typeof computeArenaMatchVoteData> | null, totalUsers: number, at: number, etag: string }} */
let cache = { sorted: [], matchVoteData: null, totalUsers: 0, at: 0, etag: "" };

function bumpEtag() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAggregates() {
  const participants = getAllArenaParticipants();
  const predictionsRaw = getAllPredictionsByUsername();
  /** @type {Record<string, import("../../src/predictions-store.js").Predictions>} */
  const predictionsMap = {};
  for (const [id, raw] of Object.entries(predictionsRaw)) {
    predictionsMap[id] = normalizePredictionsData(raw);
  }
  const { data: official } = getOfficialResults();
  const normalizedOfficial = normalizeOfficialResultsData(official);
  const sorted = sortByRankingTiebreak(
    computeLiveParticipantRowsFromData(
      participants,
      predictionsMap,
      normalizedOfficial,
      "",
      { arenaScoring: true },
    ),
  );
  const matchVoteData = computeArenaMatchVoteData(
    normalizedOfficial,
    predictionsMap,
    participants,
  );
  return { sorted, matchVoteData, totalUsers: sorted.length };
}

/**
 * @param {number} cacheMs
 */
export function getCachedArenaAggregates(cacheMs) {
  const now = Date.now();
  if (cache.sorted.length > 0 && cache.matchVoteData && now - cache.at <= cacheMs) {
    return cache;
  }
  const built = buildAggregates();
  cache = { ...built, at: now, etag: bumpEtag() };
  return cache;
}

export function invalidateArenaAggregatesCache() {
  cache = { sorted: [], matchVoteData: null, totalUsers: 0, at: 0, etag: "" };
}
