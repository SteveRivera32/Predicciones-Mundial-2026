/**
 * Recuentos globales de resultado y bono improbable (todas las predicciones en BD).
 */

import { getAllArenaParticipants, getAllPredictionsByUsername } from "./db.mjs";
import { getOfficialResults } from "./db.mjs";
import { normalizeOfficialResultsData } from "../../src/official-results-store.js";
import { normalizePredictionsData } from "../../src/predictions-store.js";
import { computeArenaMatchVoteData } from "../../src/live-ranking.js";

/** @type {{ data: ReturnType<typeof computeArenaMatchVoteData> | null, at: number }} */
let cache = { data: null, at: 0 };

export function getCachedArenaMatchVoteData(cacheMs) {
  const now = Date.now();
  if (cache.data && now - cache.at <= cacheMs) {
    return cache.data;
  }
  const participants = getAllArenaParticipants();
  const predictionsRaw = getAllPredictionsByUsername();
  /** @type {Record<string, import("../../src/predictions-store.js").Predictions>} */
  const predictionsMap = {};
  for (const [id, raw] of Object.entries(predictionsRaw)) {
    predictionsMap[id] = normalizePredictionsData(raw);
  }
  const { data: official } = getOfficialResults();
  const data = computeArenaMatchVoteData(
    normalizeOfficialResultsData(official),
    predictionsMap,
    participants,
  );
  cache = { data, at: now };
  return data;
}

export function invalidateArenaMatchVoteCache() {
  cache = { data: null, at: 0 };
}
