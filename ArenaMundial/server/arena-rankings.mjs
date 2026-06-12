/**
 * Rankings Arena calculados en servidor (cache compartido entre clientes).
 */

import { getAllArenaParticipants, getAllPredictionsByUsername } from "./db.mjs";
import { getOfficialResults } from "./db.mjs";
import { normalizeOfficialResultsData } from "../../src/official-results-store.js";
import { normalizePredictionsData } from "../../src/predictions-store.js";
import {
  computeLiveParticipantRowsFromData,
  ARENA_RANKINGS_DISPLAY_LIMIT,
} from "../../src/live-ranking.js";

const RANKINGS_LIMIT = Number(process.env.ARENA_RANKINGS_LIMIT || ARENA_RANKINGS_DISPLAY_LIMIT);

/** @type {{ sorted: ReturnType<typeof computeLiveParticipantRowsFromData>, totalUsers: number, at: number, etag: string }} */
let rankingsCache = { sorted: [], totalUsers: 0, at: 0, etag: "" };

function bumpEtag() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getFullSortedRankings() {
  const participants = getAllArenaParticipants();
  const predictionsRaw = getAllPredictionsByUsername();
  /** @type {Record<string, import("../../src/predictions-store.js").Predictions>} */
  const predictionsMap = {};
  for (const [id, raw] of Object.entries(predictionsRaw)) {
    predictionsMap[id] = normalizePredictionsData(raw);
  }
  const { data: official } = getOfficialResults();
  const normalizedOfficial = normalizeOfficialResultsData(official);
  return computeLiveParticipantRowsFromData(
    participants,
    predictionsMap,
    normalizedOfficial,
    "",
    { arenaScoring: true },
  ).sort(
    (a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.totalPerfect !== a.totalPerfect) return b.totalPerfect - a.totalPerfect;
      if (b.totalBonus !== a.totalBonus) return b.totalBonus - a.totalBonus;
      return a.p.name.localeCompare(b.p.name, "es", { sensitivity: "base" });
    },
  );
}

/**
 * @param {number} cacheMs
 */
function getCachedSortedRankings(cacheMs) {
  const now = Date.now();
  if (rankingsCache.sorted.length > 0 && now - rankingsCache.at <= cacheMs) {
    return rankingsCache;
  }
  const sorted = getFullSortedRankings();
  rankingsCache = {
    sorted,
    totalUsers: sorted.length,
    at: now,
    etag: bumpEtag(),
  };
  return rankingsCache;
}

/**
 * @param {string | null | undefined} viewerUsername
 * @param {number} cacheMs
 */
export function getCachedArenaRankings(viewerUsername, cacheMs) {
  const cached = getCachedSortedRankings(cacheMs);
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
          self: r.p.id === viewer,
        };
      }),
    },
  };
}

export function invalidateArenaRankingsCache() {
  rankingsCache = { sorted: [], totalUsers: 0, at: 0, etag: "" };
}
