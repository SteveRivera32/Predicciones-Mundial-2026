/**
 * Cálculo de ranking en vivo (compartido cliente + servidor Arena).
 * Sin dependencias de DOM ni stores globales.
 */

import {
  computeGroupMatchPoints,
  computeGroupMatchPointsBreakdown,
  isExactGroupPrediction,
  predictionOutcomeSign,
  getUniqueOfficialOutcomeBonusSign,
  getClosestScoreBonusParticipantIds,
} from "./group-match-points.js";
import {
  computeGeneralPredictionsScore,
  computeGroupOrderPoints,
  hasGroupOrderBienBadge,
  MATCH_SCORING,
  normalizeAwardText,
} from "./scoring-rules.js";
import {
  GROUPS,
  GROUP_MATCHES,
  getKnockoutMatchesFlat,
  knockoutRoundRequiresPenaltyPickOnDraw,
} from "./tournament.js";
import { normalizePredictionsData } from "./predictions-store.js";
import { sortByRankingTiebreak } from "./ranking-tiebreak.js";

const MAX_BEST_THIRD_TEAMS = 8;

/**
 * Partidos de fase de grupos que no puntúan en Arena: ya se jugaron antes del lanzamiento público.
 * gg-A-0 = México–Sudáfrica, gg-A-5 = Corea del Sur–Chequia.
 */
export const ARENA_PRELAUNCH_EXCLUDED_GROUP_MATCH_IDS = new Set(["gg-A-0", "gg-A-5"]);

/**
 * Partidos de eliminatoria que no puntúan en Arena: ya se jugaron antes del lanzamiento público.
 * ko-r32-1 = primer partido de dieciseisavos (M73).
 */
export const ARENA_PRELAUNCH_EXCLUDED_KNOCKOUT_MATCH_IDS = new Set(["ko-r32-1"]);

/** @param {string} matchId @param {{ arenaScoring?: boolean }} [opts] */
export function isArenaPrelaunchExcludedGroupMatch(matchId, opts) {
  return opts?.arenaScoring === true && ARENA_PRELAUNCH_EXCLUDED_GROUP_MATCH_IDS.has(matchId);
}

/** @param {string} matchId @param {{ arenaScoring?: boolean }} [opts] */
export function isArenaPrelaunchExcludedKnockoutMatch(matchId, opts) {
  return opts?.arenaScoring === true && ARENA_PRELAUNCH_EXCLUDED_KNOCKOUT_MATCH_IDS.has(matchId);
}

/** @param {{ matchScoringKey?: string }} m */
function getMatchScoringForQuiniela(m) {
  const key = m.matchScoringKey;
  if (key && Object.prototype.hasOwnProperty.call(MATCH_SCORING, key)) {
    return MATCH_SCORING[/** @type {keyof typeof MATCH_SCORING} */ (key)];
  }
  return MATCH_SCORING.group;
}

/**
 * @param {Record<string, import("./predictions-store.js").Predictions>} predictionsMap
 * @param {Array<{ id: string }>} participants
 */
function collectOutcomeVotesForMatch(matchId, predictionsMap, participants) {
  const votes = [];
  for (const part of participants) {
    const store = normalizePredictionsData(predictionsMap[part.id]);
    if (store.groupScoresConfirmed?.[matchId] !== true) continue;
    const pred = store.groupScores[matchId] ?? {};
    const s = predictionOutcomeSign(pred);
    if (s) votes.push(s);
  }
  return votes;
}

function collectKnockoutOutcomeVotesForMatch(matchId, predictionsMap, participants) {
  const votes = [];
  for (const part of participants) {
    const store = normalizePredictionsData(predictionsMap[part.id]);
    if (store.knockoutScoresConfirmed?.[matchId] !== true) continue;
    const pred = store.knockoutScores?.[matchId] ?? {};
    const s = predictionOutcomeSign(pred);
    if (s) votes.push(s);
  }
  return votes;
}

function getImprobableOutcomeSignForMatch(matchId, officialScore, predictionsMap, participants) {
  return getUniqueOfficialOutcomeBonusSign(
    collectOutcomeVotesForMatch(matchId, predictionsMap, participants),
    officialScore,
  );
}

function getImprobableOutcomeSignForKoMatch(matchId, officialScore, predictionsMap, participants) {
  return getUniqueOfficialOutcomeBonusSign(
    collectKnockoutOutcomeVotesForMatch(matchId, predictionsMap, participants),
    officialScore,
  );
}

/**
 * @param {string} matchId
 * @param {boolean} isKo
 * @param {Record<string, unknown>} predictionsMap
 * @param {Array<{ id: string }>} participants
 */
function collectCommittedMatchScoreEntries(matchId, isKo, predictionsMap, participants) {
  /** @type {Array<{ id: string, pred: { home: unknown, away: unknown } }>} */
  const entries = [];
  for (const part of participants) {
    const store = normalizePredictionsData(predictionsMap[part.id]);
    const confirmed = isKo
      ? store.knockoutScoresConfirmed?.[matchId] === true
      : store.groupScoresConfirmed?.[matchId] === true;
    if (!confirmed) continue;
    const pred = isKo
      ? store.knockoutScores?.[matchId] ?? { home: "", away: "" }
      : store.groupScores[matchId] ?? { home: "", away: "" };
    entries.push({ id: part.id, pred });
  }
  return entries;
}

/**
 * @param {import("./official-results-store.js").OfficialResults} official
 * @param {Record<string, unknown>} predictionsMap
 * @param {Array<{ id: string }>} participants
 * @param {{ arenaScoring?: boolean }} [opts]
 */
export function computeClosestScoreBonusMaps(official, predictionsMap, participants, opts = {}) {
  /** @type {Record<string, Set<string>>} */
  const groupClosest = {};
  /** @type {Record<string, Set<string>>} */
  const knockoutClosest = {};
  const offScores = getOfficialGroupScoresForLiveQuinielaPointsFromOfficial(official);

  for (const m of GROUP_MATCHES) {
    if (isArenaPrelaunchExcludedGroupMatch(m.id, opts)) continue;
    const off = offScores[m.id];
    if (!off) continue;
    const entries = collectCommittedMatchScoreEntries(m.id, false, predictionsMap, participants);
    groupClosest[m.id] = getClosestScoreBonusParticipantIds(off, entries);
  }

  for (const m of getKnockoutMatchesFlat()) {
    if (isArenaPrelaunchExcludedKnockoutMatch(m.id, opts)) continue;
    if (official.knockoutScoresConfirmed?.[m.id] !== true) continue;
    const off = official.knockoutScores[m.id];
    if (!off || off.home === "" || off.away === "") continue;
    const entries = collectCommittedMatchScoreEntries(m.id, true, predictionsMap, participants);
    knockoutClosest[m.id] = getClosestScoreBonusParticipantIds(off, entries);
  }

  return { groupClosest, knockoutClosest };
}

/**
 * @param {Record<string, { home: string|number|"", away: string|number|"" }>} groupScores
 */
export function computeGroupStandingsByGroup(groupScores) {
  /** @type {Record<string, Array<{ team: string, groupId: string, played: number, wins: number, draws: number, losses: number, gf: number, ga: number, gd: number, pts: number }>>} */
  const byGroup = {};

  for (const grp of GROUPS) {
    const stats = new Map(
      grp.teams.map((t) => [
        t,
        { team: t, groupId: grp.id, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 },
      ]),
    );

    const gMatches = GROUP_MATCHES.filter((m) => m.groupId === grp.id);
    for (const m of gMatches) {
      const sc = groupScores?.[m.id];
      if (!sc || sc.home === "" || sc.away === "") continue;
      const homeGoals = parseInt(String(sc.home), 10);
      const awayGoals = parseInt(String(sc.away), 10);
      if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;

      const hs = stats.get(m.home);
      const as = stats.get(m.away);
      if (!hs || !as) continue;

      hs.played += 1;
      as.played += 1;
      hs.gf += homeGoals;
      hs.ga += awayGoals;
      as.gf += awayGoals;
      as.ga += homeGoals;

      if (homeGoals > awayGoals) {
        hs.wins += 1;
        as.losses += 1;
      } else if (homeGoals < awayGoals) {
        as.wins += 1;
        hs.losses += 1;
      } else {
        hs.draws += 1;
        as.draws += 1;
      }
    }

    byGroup[grp.id] = grp.teams
      .map((t) => {
        const s = stats.get(t);
        const gd = s.gf - s.ga;
        const pts = s.wins * 3 + s.draws;
        return { ...s, gd, pts };
      })
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
  }
  return byGroup;
}

/** @param {import("./official-results-store.js").OfficialResults} off */
export function getOfficialConfirmedGroupScoresFromOfficial(off) {
  /** @type {Record<string, { home: string|number|"", away: string|number|"" }>} */
  const scores = {};
  for (const m of GROUP_MATCHES) {
    if (off.groupScoresConfirmed?.[m.id] !== true) continue;
    const sc = off.groupScores[m.id];
    if (sc && sc.home !== "" && sc.away !== "") scores[m.id] = { home: sc.home, away: sc.away };
  }
  return scores;
}

/** @param {import("./official-results-store.js").OfficialResults} off */
export function getOfficialGroupScoresForLiveQuinielaPointsFromOfficial(off) {
  /** @type {Record<string, { home: string|number|"", away: string|number|"" }>} */
  const scores = {};
  for (const m of GROUP_MATCHES) {
    const sc = off.groupScores[m.id];
    if (!sc || sc.home === "" || sc.away === "") continue;
    const stage = off.groupMatchState?.[m.id] ?? "ready";
    const confirmed = off.groupScoresConfirmed?.[m.id] === true;
    if (stage === "started" || (stage === "finished" && confirmed)) {
      scores[m.id] = { home: sc.home, away: sc.away };
    }
  }
  return scores;
}

/** @param {import("./official-results-store.js").OfficialResults} official */
export function getLiveOfficialGroupSnapshotFromOfficial(official) {
  const confirmedScores = getOfficialConfirmedGroupScoresFromOfficial(official);
  const standingsByGroup = computeGroupStandingsByGroup(confirmedScores);
  /** @type {Record<string, number>} */
  const confirmedMatchesByGroup = {};
  for (const g of GROUPS) confirmedMatchesByGroup[g.id] = 0;
  for (const m of GROUP_MATCHES) {
    if (confirmedScores[m.id]) confirmedMatchesByGroup[m.groupId] += 1;
  }
  /** @type {Record<string, string[]>} */
  const orderByGroup = {};
  /** @type {Record<string, boolean>} */
  const thirdAdvanceByGroup = {};
  /** @type {Record<string, boolean>} */
  const hasOfficialDataByGroup = {};
  /** @type {Record<string, boolean>} */
  const groupCompletedByGroup = {};

  for (const grp of GROUPS) {
    const list = standingsByGroup[grp.id] ?? [];
    const hasData = list.some((x) => x.played > 0);
    hasOfficialDataByGroup[grp.id] = hasData;
    groupCompletedByGroup[grp.id] = confirmedMatchesByGroup[grp.id] >= 6;
    orderByGroup[grp.id] = hasData ? list.map((x) => x.team) : [];
  }

  const allGroupsCompleted = GROUPS.every((g) => groupCompletedByGroup[g.id] === true);
  let rankedThirdTeams = [];

  if (allGroupsCompleted) {
    const thirdCandidates = GROUPS.map((grp) => {
      const list = standingsByGroup[grp.id] ?? [];
      if (!list[2]) return null;
      return list[2];
    })
      .filter(Boolean)
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
    const topThird = new Set(thirdCandidates.slice(0, MAX_BEST_THIRD_TEAMS).map((x) => x.team));

    for (const grp of GROUPS) {
      const thirdTeam = (orderByGroup[grp.id] ?? [])[2];
      if (!thirdTeam) continue;
      thirdAdvanceByGroup[grp.id] = topThird.has(thirdTeam);
    }

    rankedThirdTeams = thirdCandidates.slice(0, MAX_BEST_THIRD_TEAMS).map((x) => x.team);
  }

  return {
    orderByGroup,
    thirdAdvanceByGroup,
    hasOfficialDataByGroup,
    rankedThirdTeams,
    groupCompletedByGroup,
    allGroupsCompleted,
  };
}

/**
 * @param {string} groupId
 * @param {Array<{ id: string }>} participants
 * @param {Record<string, unknown>} predictionsMap
 */
export function getGroupOrderVoteCountsByPositionFromMap(groupId, participants, predictionsMap) {
  /** @type {Map<string, number>[]} */
  const countsByPos = [new Map(), new Map(), new Map(), new Map()];
  for (const part of participants) {
    const store = normalizePredictionsData(predictionsMap[part.id]);
    const ord = store.groupOrder?.[groupId];
    if (!Array.isArray(ord) || ord.length < 4) continue;
    for (let i = 0; i < 4; i++) {
      const team = typeof ord[i] === "string" ? ord[i].trim() : "";
      if (!team) continue;
      const map = countsByPos[i];
      map.set(team, (map.get(team) ?? 0) + 1);
    }
  }
  return countsByPos;
}

/** @param {Map<string, number>} counts @param {string} team */
export function hasUniquePickBonus(counts, team) {
  if (!team) return false;
  const teamVotes = counts.get(team) ?? 0;
  if (teamVotes !== 1) return false;
  const totalVotes = [...counts.values()].reduce((acc, n) => acc + n, 0);
  return totalVotes >= 2;
}

/**
 * @param {Array<{ id: string, name: string }>} participants
 * @param {Record<string, unknown>} predictionsMap
 * @param {import("./official-results-store.js").OfficialResults} official
 */
export function computePerParticipantMatchColumnStatsFromData(
  participants,
  predictionsMap,
  official,
  opts = {},
) {
  const offScores = getOfficialGroupScoresForLiveQuinielaPointsFromOfficial(official);
  const { groupClosest, knockoutClosest } = computeClosestScoreBonusMaps(
    official,
    predictionsMap,
    participants,
    opts,
  );
  /** @type {Record<string, { topTie: number, soleTop: number, noPred: number }>} */
  const byId = {};
  for (const p of participants) {
    byId[p.id] = { topTie: 0, soleTop: 0, noPred: 0 };
  }

  /**
   * @param {{ id: string, roundId?: string | null }} m
   * @param {{ home: unknown, away: unknown }} off
   * @param {boolean} isKo
   */
  function processMatch(m, off, isKo) {
    const koPenPh = isKo ? knockoutRoundRequiresPenaltyPickOnDraw(m.roundId) : false;
    /** @type {{ id: string, pts: number }[]} */
    const scored = [];
    for (const p of participants) {
      const pStore = normalizePredictionsData(predictionsMap[p.id]);
      const confirmed = isKo
        ? pStore.knockoutScoresConfirmed?.[m.id] === true
        : pStore.groupScoresConfirmed?.[m.id] === true;
      if (!confirmed) {
        byId[p.id].noPred += 1;
        continue;
      }
      const pred = isKo
        ? pStore.knockoutScores?.[m.id] ?? { home: "", away: "" }
        : pStore.groupScores[m.id] ?? { home: "", away: "" };
      const improb = isKo
        ? getImprobableOutcomeSignForKoMatch(m.id, off, predictionsMap, participants)
        : getImprobableOutcomeSignForMatch(m.id, off, predictionsMap, participants);
      const closestEligible = isKo
        ? (knockoutClosest[m.id]?.has(p.id) ?? false)
        : (groupClosest[m.id]?.has(p.id) ?? false);
      const matchScoring = getMatchScoringForQuiniela(m);
      const pts = computeGroupMatchPoints(
        off,
        pred,
        improb,
        matchScoring,
        koPenPh,
        closestEligible,
      );
      if (pts === null) continue;
      scored.push({ id: p.id, pts });
    }
    if (scored.length === 0) return;
    const maxPts = Math.max(...scored.map((s) => s.pts));
    const atMax = scored.filter((s) => s.pts === maxPts);
    for (const s of atMax) {
      byId[s.id].topTie += 1;
    }
    if (atMax.length === 1) {
      byId[atMax[0].id].soleTop += 1;
    }
  }

  for (const m of GROUP_MATCHES) {
    if (isArenaPrelaunchExcludedGroupMatch(m.id, opts)) continue;
    const off = offScores[m.id];
    if (!off) continue;
    processMatch(m, off, false);
  }
  for (const m of getKnockoutMatchesFlat()) {
    if (isArenaPrelaunchExcludedKnockoutMatch(m.id, opts)) continue;
    if (official.knockoutScoresConfirmed?.[m.id] !== true) continue;
    const off = official.knockoutScores[m.id];
    if (!off || off.home === "" || off.away === "") continue;
    processMatch(m, off, true);
  }

  return byId;
}

/**
 * @param {Array<{ id: string, name: string }>} participants
 * @param {Record<string, unknown>} predictionsMap
 * @param {import("./official-results-store.js").OfficialResults} official
 * @param {string | null | undefined} currentParticipantId
 * @param {{ arenaScoring?: boolean }} [opts]
 */
export function computeLiveParticipantRowsFromData(
  participants,
  predictionsMap,
  official,
  currentParticipantId,
  opts = {},
) {
  const offScores = getOfficialGroupScoresForLiveQuinielaPointsFromOfficial(official);
  const matchColStats = computePerParticipantMatchColumnStatsFromData(
    participants,
    predictionsMap,
    official,
    opts,
  );
  const { groupClosest, knockoutClosest } = computeClosestScoreBonusMaps(
    official,
    predictionsMap,
    participants,
    opts,
  );
  const liveOfficial = getLiveOfficialGroupSnapshotFromOfficial(official);
  const officialGen = official.generalOfficial ?? {};
  const hasGeneralOfficial =
    official.generalOfficialConfirmed === true &&
    Boolean(String(officialGen.first ?? "").trim()) &&
    Boolean(String(officialGen.second ?? "").trim()) &&
    Boolean(String(officialGen.third ?? "").trim());

  return participants.map((p) => {
    let total = 0;
    let matchPointsTotal = 0;
    let exact = 0;
    let outcome = 0;
    let zeroPointMatches = 0;
    let matchBonusCount = 0;
    let matchClosestCount = 0;
    let countedMatches = 0;
    let groupOrderBienCount = 0;
    let groupOrderExcelenteCount = 0;
    let groupOrderPerfectCount = 0;
    let groupOrderBonusCount = 0;
    let matchBienCount = 0;
    let matchExcelenteCount = 0;
    let matchPerfectCount = 0;
    let generalBienCount = 0;
    let generalExcelenteCount = 0;
    let generalPerfectCount = 0;
    const pStore = normalizePredictionsData(predictionsMap[p.id]);

    if (hasGeneralOfficial) {
      const genScore = computeGeneralPredictionsScore(pStore.general ?? {}, officialGen, true);
      total += genScore.total;
      if (genScore.exactTierLabel === "bien") generalBienCount += 1;
      else if (genScore.exactTierLabel === "excelente") generalExcelenteCount += 1;
      else if (genScore.exactTierLabel === "perfecto") generalPerfectCount += 1;
    }

    for (const grp of GROUPS) {
      const officialOrder = liveOfficial.orderByGroup?.[grp.id] ?? [];
      const hasOfficialData = liveOfficial.hasOfficialDataByGroup?.[grp.id] === true;
      if (!hasOfficialData) continue;
      if (liveOfficial.groupCompletedByGroup?.[grp.id] !== true) continue;
      const officialThird = liveOfficial.thirdAdvanceByGroup?.[grp.id];
      const officialThirdDefined = officialThird === true || officialThird === false;
      const order = pStore.groupOrder?.[grp.id];
      const predOrder =
        Array.isArray(order) && order.length >= 4
          ? [0, 1, 2, 3].map((i) => (typeof order[i] === "string" ? order[i] : ""))
          : ["", "", "", ""];
      const predThird = pStore.groupThirdAdvances?.[grp.id];
      const groupOrderBienEligible = hasGroupOrderBienBadge(predOrder, officialOrder);
      const fullOrderHit = [0, 1, 2, 3].every(
        (i) => Boolean(predOrder[i]) && Boolean(officialOrder[i]) && predOrder[i] === officialOrder[i],
      );
      const thirdAdvanceHit =
        officialThirdDefined &&
        (predThird === true || predThird === false) &&
        predThird === officialThird;
      if (fullOrderHit && thirdAdvanceHit) groupOrderPerfectCount += 1;
      else if (fullOrderHit) groupOrderExcelenteCount += 1;
      else if (groupOrderBienEligible) groupOrderBienCount += 1;

      const voteCountsByPos = getGroupOrderVoteCountsByPositionFromMap(grp.id, participants, predictionsMap);
      const groupBonus = [0, 1, 2, 3].reduce((acc, i) => {
        const t = predOrder[i];
        const isExact = Boolean(t) && Boolean(officialOrder[i]) && t === officialOrder[i];
        if (isExact && hasUniquePickBonus(voteCountsByPos[i], t)) return acc + 1;
        return acc;
      }, 0);
      groupOrderBonusCount += groupBonus;
      total +=
        computeGroupOrderPoints(
          predOrder,
          officialOrder,
          predThird,
          officialThirdDefined ? officialThird : undefined,
        ) + groupBonus;
    }

    for (const m of GROUP_MATCHES) {
      if (isArenaPrelaunchExcludedGroupMatch(m.id, opts)) continue;
      const off = offScores[m.id];
      if (!off) continue;
      if (pStore.groupScoresConfirmed?.[m.id] !== true) continue;
      const pred = pStore.groupScores[m.id] ?? { home: "", away: "" };
      const improb = getImprobableOutcomeSignForMatch(m.id, off, predictionsMap, participants);
      const closestEligible = groupClosest[m.id]?.has(p.id) ?? false;
      const matchScoring = getMatchScoringForQuiniela(m);
      const pts = computeGroupMatchPoints(off, pred, improb, matchScoring, false, closestEligible);
      if (pts === null) continue;
      total += pts;
      matchPointsTotal += pts;
      countedMatches += 1;
      if (pts === 0) zeroPointMatches += 1;
      if (isExactGroupPrediction(off, pred)) exact += 1;
      const breakdown = computeGroupMatchPointsBreakdown(
        off,
        pred,
        improb,
        matchScoring,
        false,
        closestEligible,
      );
      if (breakdown?.exactTier === "perfecto") matchPerfectCount += 1;
      else if (breakdown?.exactTier === "excelente") matchExcelenteCount += 1;
      else if (breakdown?.exactTier === "bien") matchBienCount += 1;
      if ((breakdown?.improbablePts ?? 0) > 0) matchBonusCount += 1;
      if ((breakdown?.closestPts ?? 0) > 0) matchClosestCount += 1;
      const oh = parseInt(String(off.home), 10);
      const oa = parseInt(String(off.away), 10);
      const ph = parseInt(String(pred.home), 10);
      const pa = parseInt(String(pred.away), 10);
      if (Number.isFinite(oh) && Number.isFinite(oa) && Number.isFinite(ph) && Number.isFinite(pa)) {
        const offSign = oh > oa ? "h" : oh < oa ? "a" : "d";
        const predSign = ph > pa ? "h" : ph < pa ? "a" : "d";
        if (offSign === predSign) outcome += 1;
      }
    }

    for (const m of getKnockoutMatchesFlat()) {
      if (isArenaPrelaunchExcludedKnockoutMatch(m.id, opts)) continue;
      if (official.knockoutScoresConfirmed?.[m.id] !== true) continue;
      const off = official.knockoutScores[m.id];
      if (!off || off.home === "" || off.away === "") continue;
      if (pStore.knockoutScoresConfirmed?.[m.id] !== true) continue;
      const pred = pStore.knockoutScores?.[m.id] ?? { home: "", away: "" };
      const improb = getImprobableOutcomeSignForKoMatch(m.id, off, predictionsMap, participants);
      const closestEligible = knockoutClosest[m.id]?.has(p.id) ?? false;
      const matchScoring = getMatchScoringForQuiniela(m);
      const koPenPh = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
      const pts = computeGroupMatchPoints(off, pred, improb, matchScoring, koPenPh, closestEligible);
      if (pts === null) continue;
      total += pts;
      matchPointsTotal += pts;
      countedMatches += 1;
      if (pts === 0) zeroPointMatches += 1;
      if (isExactGroupPrediction(off, pred)) exact += 1;
      const breakdown = computeGroupMatchPointsBreakdown(
        off,
        pred,
        improb,
        matchScoring,
        koPenPh,
        closestEligible,
      );
      if (breakdown?.exactTier === "perfecto") matchPerfectCount += 1;
      else if (breakdown?.exactTier === "excelente") matchExcelenteCount += 1;
      else if (breakdown?.exactTier === "bien") matchBienCount += 1;
      if ((breakdown?.improbablePts ?? 0) > 0) matchBonusCount += 1;
      if ((breakdown?.closestPts ?? 0) > 0) matchClosestCount += 1;
      const oh = parseInt(String(off.home), 10);
      const oa = parseInt(String(off.away), 10);
      const ph = parseInt(String(pred.home), 10);
      const pa = parseInt(String(pred.away), 10);
      if (Number.isFinite(oh) && Number.isFinite(oa) && Number.isFinite(ph) && Number.isFinite(pa)) {
        const offSign = oh > oa ? "h" : oh < oa ? "a" : "d";
        const predSign = ph > pa ? "h" : ph < pa ? "a" : "d";
        if (offSign === predSign) outcome += 1;
      }
    }

    const totalBonus = matchBonusCount + groupOrderBonusCount;
    const totalClosest = matchClosestCount;
    const totalPerfect = matchPerfectCount + groupOrderPerfectCount + generalPerfectCount;
    const totalBien = matchBienCount + groupOrderBienCount + generalBienCount;
    const totalExcelente = matchExcelenteCount + groupOrderExcelenteCount + generalExcelenteCount;
    const avgPtsPerMatch = countedMatches > 0 ? matchPointsTotal / countedMatches : 0;
    const mc = matchColStats[p.id] ?? { topTie: 0, soleTop: 0, noPred: 0 };
    return {
      p,
      pts: total,
      exact,
      outcome,
      self: p.id === currentParticipantId,
      zeroPointMatches,
      matchBonusCount,
      matchClosestCount,
      countedMatches,
      avgPtsPerMatch,
      matchTopTieCount: mc.topTie,
      matchSoleTopCount: mc.soleTop,
      matchNoPredCount: mc.noPred,
      totalBonus,
      totalClosest,
      totalPerfect,
      totalBien,
      totalExcelente,
    };
  });
}

const DEFAULT_RANKINGS_LIMIT = 50;

/**
 * Ranking global ordenado; devuelve top N + fila del viewer si no está en el top.
 * @param {Array<{ id: string, name: string }>} participants
 * @param {Record<string, unknown>} predictionsMap
 * @param {import("./official-results-store.js").OfficialResults} official
 * @param {string | null | undefined} viewerId
 * @param {number} [limit]
 */
export function computeArenaRankingsDisplay(
  participants,
  predictionsMap,
  official,
  viewerId,
  limit = DEFAULT_RANKINGS_LIMIT,
) {
  const sorted = sortByRankingTiebreak(
    computeLiveParticipantRowsFromData(participants, predictionsMap, official, viewerId),
  );

  const lim = Math.max(1, limit);
  const top = sorted.slice(0, lim);
  const topIds = new Set(top.map((r) => r.p.id));
  const viewerRow = viewerId ? sorted.find((r) => r.p.id === viewerId) : null;
  const rows =
    viewerRow && !topIds.has(viewerRow.p.id) ? [...top, viewerRow] : top;

  return {
    totalUsers: participants.length,
    limit: lim,
    truncated: participants.length > lim,
    rows: rows.map((r, i) => {
      const globalRank = sorted.findIndex((x) => x.p.id === r.p.id) + 1;
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
        self: r.p.id === viewerId,
      };
    }),
  };
}

export { DEFAULT_RANKINGS_LIMIT as ARENA_RANKINGS_DISPLAY_LIMIT };

/** @param {("h"|"d"|"a")[]} votes */
function votesToCounts(votes) {
  /** @type {{ h: number, d: number, a: number }} */
  const counts = { h: 0, d: 0, a: 0 };
  for (const s of votes) {
    if (s === "h" || s === "d" || s === "a") counts[s] += 1;
  }
  return counts;
}

const ARENA_GENERALES_VOTE_SLOT_KEYS = [
  "first",
  "second",
  "third",
  "bestPlayer",
  "bestGk",
  "topScorer",
];

function collectKnockoutPenaltyVotesForMatch(matchId, predictionsMap, participants) {
  /** @type {{ home: number, away: number }} */
  const counts = { home: 0, away: 0 };
  for (const part of participants) {
    const store = normalizePredictionsData(predictionsMap[part.id]);
    if (store.knockoutScoresConfirmed?.[matchId] !== true) continue;
    const pred = store.knockoutScores?.[matchId] ?? {};
    if (predictionOutcomeSign(pred) !== "d") continue;
    if (pred.penaltyWinner === "home") counts.home += 1;
    else if (pred.penaltyWinner === "away") counts.away += 1;
  }
  return counts;
}

function collectGroupThirdAdvanceVoteCounts(groupId, predictionsMap, participants) {
  /** @type {{ yes: number, no: number }} */
  const counts = { yes: 0, no: 0 };
  for (const part of participants) {
    const store = normalizePredictionsData(predictionsMap[part.id]);
    const v = store.groupThirdAdvances?.[groupId];
    if (v === true) counts.yes += 1;
    else if (v === false) counts.no += 1;
  }
  return counts;
}

function collectGeneralesVoteCounts(predictionsMap, participants) {
  /** @type {Record<string, Record<string, { count: number, display: string }>>} */
  const bySlot = Object.fromEntries(ARENA_GENERALES_VOTE_SLOT_KEYS.map((k) => [k, {}]));
  for (const part of participants) {
    const gen = normalizePredictionsData(predictionsMap[part.id]).general ?? {};
    for (const key of ARENA_GENERALES_VOTE_SLOT_KEYS) {
      const raw = String(gen[key] ?? "").trim();
      if (!raw) continue;
      const isPlayer = key !== "first" && key !== "second" && key !== "third";
      const id = isPlayer ? normalizeAwardText(raw) : raw;
      const bucket = bySlot[key];
      const prev = bucket[id];
      if (prev) prev.count += 1;
      else bucket[id] = { count: 1, display: raw };
    }
  }
  return bySlot;
}

/**
 * @typedef {{
 *   groupVotes: Record<string, { h: number, d: number, a: number }>,
 *   groupImprobable: Record<string, "h"|"d"|"a"|null>,
 *   knockoutVotes: Record<string, { h: number, d: number, a: number }>,
 *   knockoutImprobable: Record<string, "h"|"d"|"a"|null>,
 *   knockoutPenalties: Record<string, { home: number, away: number }>,
 *   groupOrder: Record<string, Array<Record<string, number>>>,
 *   groupThirdAdvance: Record<string, { yes: number, no: number }>,
 *   generales: Record<string, Record<string, { count: number, display: string }>>,
 * }} ArenaVoteData
 */

/**
 * Recuentos globales de Arena con TODAS las predicciones (resultados, orden, generales, penales).
 * @param {import("./official-results-store.js").OfficialResults} official
 * @param {Record<string, unknown>} predictionsMap
 * @param {Array<{ id: string }>} participants
 * @returns {ArenaVoteData}
 */
export function computeArenaMatchVoteData(official, predictionsMap, participants) {
  /** @type {Record<string, { h: number, d: number, a: number }>} */
  const groupVotes = {};
  /** @type {Record<string, "h"|"d"|"a"|null>} */
  const groupImprobable = {};
  /** @type {Record<string, string[]>} */
  const groupClosest = {};
  /** @type {Record<string, { h: number, d: number, a: number }>} */
  const knockoutVotes = {};
  /** @type {Record<string, "h"|"d"|"a"|null>} */
  const knockoutImprobable = {};
  /** @type {Record<string, string[]>} */
  const knockoutClosest = {};
  /** @type {Record<string, { home: number, away: number }>} */
  const knockoutPenalties = {};
  /** @type {Record<string, Array<Record<string, number>>>} */
  const groupOrder = {};
  /** @type {Record<string, { yes: number, no: number }>} */
  const groupThirdAdvance = {};

  for (const m of GROUP_MATCHES) {
    if (ARENA_PRELAUNCH_EXCLUDED_GROUP_MATCH_IDS.has(m.id)) continue;
    const votes = collectOutcomeVotesForMatch(m.id, predictionsMap, participants);
    groupVotes[m.id] = votesToCounts(votes);
    const off = official.groupScores?.[m.id];
    const stage = official.groupMatchState?.[m.id] ?? "ready";
    const confirmed = official.groupScoresConfirmed?.[m.id] === true;
    const bothFilled = off && off.home !== "" && off.away !== "";
    const officialComplete = bothFilled && (stage === "started" || confirmed);
    groupImprobable[m.id] =
      officialComplete && off
        ? getUniqueOfficialOutcomeBonusSign(votes, off)
        : null;
    if (officialComplete && off) {
      const entries = collectCommittedMatchScoreEntries(m.id, false, predictionsMap, participants);
      groupClosest[m.id] = [...getClosestScoreBonusParticipantIds(off, entries)];
    } else {
      groupClosest[m.id] = [];
    }
  }

  for (const m of getKnockoutMatchesFlat()) {
    if (ARENA_PRELAUNCH_EXCLUDED_KNOCKOUT_MATCH_IDS.has(m.id)) continue;
    const votes = collectKnockoutOutcomeVotesForMatch(m.id, predictionsMap, participants);
    knockoutVotes[m.id] = votesToCounts(votes);
    const off = official.knockoutScores?.[m.id];
    const confirmed = official.knockoutScoresConfirmed?.[m.id] === true;
    const bothFilled = off && off.home !== "" && off.away !== "";
    const officialComplete = bothFilled && confirmed;
    knockoutImprobable[m.id] =
      officialComplete && off
        ? getUniqueOfficialOutcomeBonusSign(votes, off)
        : null;
    if (officialComplete && off) {
      const entries = collectCommittedMatchScoreEntries(m.id, true, predictionsMap, participants);
      knockoutClosest[m.id] = [...getClosestScoreBonusParticipantIds(off, entries)];
    } else {
      knockoutClosest[m.id] = [];
    }
    if (knockoutRoundRequiresPenaltyPickOnDraw(m.roundId)) {
      knockoutPenalties[m.id] = collectKnockoutPenaltyVotesForMatch(m.id, predictionsMap, participants);
    }
  }

  for (const grp of GROUPS) {
    const countsByPos = getGroupOrderVoteCountsByPositionFromMap(grp.id, participants, predictionsMap);
    groupOrder[grp.id] = countsByPos.map((m) => Object.fromEntries(m));
    groupThirdAdvance[grp.id] = collectGroupThirdAdvanceVoteCounts(grp.id, predictionsMap, participants);
  }

  const generales = collectGeneralesVoteCounts(predictionsMap, participants);

  return {
    groupVotes,
    groupImprobable,
    groupClosest,
    knockoutVotes,
    knockoutImprobable,
    knockoutClosest,
    knockoutPenalties,
    groupOrder,
    groupThirdAdvance,
    generales,
  };
}
