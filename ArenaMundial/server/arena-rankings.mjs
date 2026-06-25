/**
 * Rankings Arena calculados en servidor (cache compartido entre clientes).
 */

import { ARENA_RANKINGS_DISPLAY_LIMIT } from "../../src/live-ranking.js";
import { getCachedArenaAggregates, invalidateArenaAggregatesCache } from "./arena-aggregates.mjs";

const RANKINGS_LIMIT = Number(process.env.ARENA_RANKINGS_LIMIT || ARENA_RANKINGS_DISPLAY_LIMIT);

/**
 * @param {string | null | undefined} viewerUsername
 * @param {number} cacheMs
 */
export function getCachedArenaRankings(viewerUsername, cacheMs) {
  const cached = getCachedArenaAggregates(cacheMs);
  const viewer = String(viewerUsername ?? "");
  const lim = Math.max(1, RANKINGS_LIMIT);
  const top = cached.sorted.slice(0, lim);
  const topIds = new Set(top.map((r) => r.p.id));
  const viewerRow = viewer ? cached.sorted.find((r) => r.p.id === viewer) : null;
  const rows =
    viewerRow && !topIds.has(viewerRow.p.id) ? [...top, viewerRow] : top;

  return {
    etag: cached.etag,
    data: {
      totalUsers: cached.totalUsers,
      limit: lim,
      truncated: cached.totalUsers > lim,
      matchVoteData: cached.matchVoteData,
      rows: rows.map((r) => {
        const globalRank = cached.sorted.findIndex((x) => x.p.id === r.p.id) + 1;
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
