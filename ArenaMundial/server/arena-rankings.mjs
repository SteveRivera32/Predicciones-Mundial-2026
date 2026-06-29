/**
 * Rankings Arena calculados en servidor (cache compartido entre clientes).
 */

import { ARENA_RANKINGS_DISPLAY_LIMIT } from "../../src/live-ranking.js";
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
 * @param {"all"|"followers"} [audience]
 */
export function getCachedArenaRankings(viewerUsername, cacheMs, audience = "all") {
  const cached = getCachedArenaAggregates(cacheMs);
  const viewer = String(viewerUsername ?? "");
  const lim = Math.max(1, RANKINGS_LIMIT);
  const filtered = filterSortedForAudience(cached.sorted, audience);
  const top = filtered.slice(0, lim);
  const topIds = new Set(top.map((r) => r.p.id));
  const viewerRow = viewer ? filtered.find((r) => r.p.id === viewer) : null;
  const rows =
    viewerRow && !topIds.has(viewerRow.p.id) ? [...top, viewerRow] : top;

  return {
    etag: cached.etag,
    data: {
      totalUsers: filtered.length,
      limit: lim,
      truncated: filtered.length > lim,
      matchVoteData: cached.matchVoteData,
      rows: rows.map((r) => {
        const globalRank = filtered.findIndex((x) => x.p.id === r.p.id) + 1;
        return {
          rank: globalRank,
          username: r.p.id,
          displayName: r.p.name,
          pts: r.pts,
          totalBien: r.totalBien,
          totalExcelente: r.totalExcelente,
          totalPerfect: r.totalPerfect,
          totalBonus: r.totalBonus,
          totalClosest: r.totalClosest,
          self: r.p.id === viewer,
        };
      }),
    },
  };
}

export function invalidateArenaRankingsCache() {
  invalidateArenaAggregatesCache();
}
