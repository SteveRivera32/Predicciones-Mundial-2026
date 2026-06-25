/**
 * Recuentos globales de resultado y bono improbable (todas las predicciones en BD).
 */

import { getCachedArenaAggregates, invalidateArenaAggregatesCache } from "./arena-aggregates.mjs";

export function getCachedArenaMatchVoteData(cacheMs) {
  return getCachedArenaAggregates(cacheMs).matchVoteData;
}

export function invalidateArenaMatchVoteCache() {
  invalidateArenaAggregatesCache();
}
