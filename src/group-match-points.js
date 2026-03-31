import { MATCH_SCORING, IMPROBABLE_BONUS } from "./scoring-rules.js";

/** @typedef {typeof MATCH_SCORING.group} MatchScoringSlice */

function parseScore(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

/**
 * Resultado predicho: local / empate / visitante.
 * @param {{ home: unknown, away: unknown }} pred
 * @returns {"h"|"d"|"a"|null}
 */
export function predictionOutcomeSign(pred) {
  const ph = parseScore(pred.home);
  const pa = parseScore(pred.away);
  if (ph === null || pa === null) return null;
  if (ph > pa) return "h";
  if (pa > ph) return "a";
  return "d";
}

/**
 * Opción minoritaria “clara” en el recuento de un partido (regla bono improbable).
 * Empates entre fuerzas en el recuento → null.
 * @param {("h"|"d"|"a")[]} votes
 * @returns {"h"|"d"|"a"|null}
 */
export function getImprobableOutcomeSign(votes) {
  /** @type {{ h: number, d: number, a: number }} */
  const c = { h: 0, d: 0, a: 0 };
  for (const s of votes) {
    if (s === "h" || s === "d" || s === "a") c[s] += 1;
  }
  const withVotes = /** @type {Array<{ k: "h"|"d"|"a", n: number }>} */ (
    [
      { k: "h", n: c.h },
      { k: "d", n: c.d },
      { k: "a", n: c.a },
    ].filter((x) => x.n > 0)
  );
  if (withVotes.length < 2) return null;
  const maxN = Math.max(c.h, c.d, c.a);
  const topTier = withVotes.filter((x) => x.n === maxN);
  if (topTier.length >= 2) return null;
  const minor = withVotes.filter((x) => x.n < maxN);
  if (minor.length === 0) return null;
  const minN = Math.min(...minor.map((x) => x.n));
  const minTier = minor.filter((x) => x.n === minN);
  if (minTier.length !== 1) return null;
  return minTier[0].k;
}

/**
 * @param {{ home: unknown, away: unknown }} official
 * @param {{ home: unknown, away: unknown }} pred
 * @param {"h"|"d"|"a"|null|undefined} improbableOutcomeSign
 * @param {MatchScoringSlice} [scoring]
 * @returns {{ total: number, outcomePts: number, homeGoalsPts: number, awayGoalsPts: number, exactPts: number, improbablePts: number } | null}
 */
function computeGroupMatchPointsParts(official, pred, improbableOutcomeSign = null, scoring = MATCH_SCORING.group) {
  const { outcome, goalsEach, exact, maxPerMatch } = scoring;
  const oh = parseScore(official.home);
  const oa = parseScore(official.away);
  const ph = parseScore(pred.home);
  const pa = parseScore(pred.away);
  if (oh === null || oa === null || ph === null || pa === null) return null;

  const outcomeOfficial = oh > oa ? "h" : oh < oa ? "a" : "d";
  const outcomePred = ph > pa ? "h" : ph < pa ? "a" : "d";
  const outcomePts = outcomeOfficial === outcomePred ? outcome : 0;
  const homeGoalsPts = ph === oh ? goalsEach : 0;
  const awayGoalsPts = pa === oa ? goalsEach : 0;
  const exactPts = ph === oh && pa === oa ? exact : 0;
  const raw = outcomePts + homeGoalsPts + awayGoalsPts + exactPts;
  let improbablePts = 0;
  if (
    improbableOutcomeSign &&
    outcomeOfficial === outcomePred &&
    outcomeOfficial === improbableOutcomeSign
  ) {
    improbablePts = IMPROBABLE_BONUS;
  }
  const total = Math.min(raw, maxPerMatch) + improbablePts;
  return { total, outcomePts, homeGoalsPts, awayGoalsPts, exactPts, improbablePts };
}

/**
 * @param {{ home: unknown, away: unknown }} official
 * @param {{ home: unknown, away: unknown }} pred
 * @param {"h"|"d"|"a"|null|undefined} [improbableOutcomeSign]
 * @param {MatchScoringSlice} [scoring]
 * @returns {number|null}
 */
export function computeGroupMatchPoints(official, pred, improbableOutcomeSign = null, scoring = MATCH_SCORING.group) {
  const p = computeGroupMatchPointsParts(official, pred, improbableOutcomeSign, scoring);
  return p ? p.total : null;
}

/**
 * @param {{ home: unknown, away: unknown }} official
 * @param {{ home: unknown, away: unknown }} pred
 * @param {"h"|"d"|"a"|null|undefined} [improbableOutcomeSign]
 * @param {MatchScoringSlice} [scoring]
 */
export function computeGroupMatchPointsBreakdown(official, pred, improbableOutcomeSign = null, scoring = MATCH_SCORING.group) {
  return computeGroupMatchPointsParts(official, pred, improbableOutcomeSign, scoring);
}

export function isExactGroupPrediction(official, pred) {
  const oh = parseScore(official.home);
  const oa = parseScore(official.away);
  const ph = parseScore(pred.home);
  const pa = parseScore(pred.away);
  if (oh === null || oa === null || ph === null || pa === null) return false;
  return ph === oh && pa === oa;
}
