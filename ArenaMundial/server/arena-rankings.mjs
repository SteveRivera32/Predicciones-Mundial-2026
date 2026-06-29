/**
 * Rankings Arena calculados en servidor (cache compartido entre clientes).
 */

import {
  ARENA_RANKINGS_DISPLAY_LIMIT,
  buildArenaRankingsAudienceSlice,
} from "../../src/live-ranking.js";
import { isArenaFollowersExcludedParticipant } from "../../src/participants.js";
import { getCachedArenaAggregates, invalidateArenaAggregatesCache } from "./arena-aggregates.mjs";

const RANKINGS_LIMIT = Number(process.env.ARENA_RANKINGS_LIMIT || ARENA_RANKINGS_DISPLAY_LIMIT);

/**
 * @param {Array<Record<string, unknown>>} sorted
 * @param {"all"|"followers"} audience
 */
function filterSortedForAudience(sorted, audience) {
  if (audience !== "followers") return sorted;
  return sorted.filter((r) => !isArenaFollowersExcludedParticipant(r.p.id));
}

/**
 * @param {string | null | undefined} viewerUsername
 * @param {number} cacheMs
 */
export function getCachedArenaRankingsBundle(viewerUsername, cacheMs) {
  const cached = getCachedArenaAggregates(cacheMs);
  const viewer = String(viewerUsername ?? "");
  const lim = Math.max(1, RANKINGS_LIMIT);
  const sortedAll = cached.sorted;
  const sortedFollowers = filterSortedForAudience(cached.sorted, "followers");

  return {
    etag: cached.etag,
    data: {
      audiences: {
        all: buildArenaRankingsAudienceSlice(sortedAll, viewer, lim),
        followers: buildArenaRankingsAudienceSlice(sortedFollowers, viewer, lim),
      },
      matchVoteData: cached.matchVoteData,
    },
  };
}

/** @deprecated Usar getCachedArenaRankingsBundle */
export function getCachedArenaRankings(viewerUsername, cacheMs, audience = "all") {
  const bundle = getCachedArenaRankingsBundle(viewerUsername, cacheMs);
  const slice = bundle.data.audiences[audience === "followers" ? "followers" : "all"];
  return {
    etag: bundle.etag,
    data: {
      ...slice,
      matchVoteData: bundle.data.matchVoteData,
    },
  };
}

export function invalidateArenaRankingsCache() {
  invalidateArenaAggregatesCache();
}
