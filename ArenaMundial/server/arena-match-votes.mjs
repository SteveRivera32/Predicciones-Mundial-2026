/**
 * Recuentos globales de resultado y bono improbable (todas las predicciones en BD).
 */

import { getCachedArenaAggregates, invalidateArenaAggregatesCache } from "./arena-aggregates.mjs";

export function getArenaAggregatesCacheMs() {
  return Number(process.env.ARENA_AGGREGATES_CACHE_MS || 20_000);
}

export function getCachedArenaMatchVoteData(cacheMs = getArenaAggregatesCacheMs()) {
  return getCachedArenaAggregates(cacheMs).matchVoteData;
}

export function invalidateArenaMatchVoteCache() {
  invalidateArenaAggregatesCache();
}
