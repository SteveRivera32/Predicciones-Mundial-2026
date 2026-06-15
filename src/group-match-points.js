import {
  MATCH_SCORING,
  IMPROBABLE_BONUS,
  CLOSEST_SCORE_BONUS,
  CLOSEST_SCORE_MAX_DISTANCE,
  getImprobableMinVoteCap,
} from "./scoring-rules.js";

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
 * Bono improbable: el resultado oficial debe estar entre las opciones menos votadas
 * y su recuento no puede superar el tope (2 en quinielas pequeñas; % del total en Arena).
 * @param {("h"|"d"|"a")[]} votes
 * @param {{ home: unknown, away: unknown }} officialScore
 * @returns {"h"|"d"|"a"|null}
 */
export function getUniqueOfficialOutcomeBonusSign(votes, officialScore) {
  const officialSign = predictionOutcomeSign(officialScore);
  if (!officialSign) return null;
  /** @type {{ h: number, d: number, a: number }} */
  const c = { h: 0, d: 0, a: 0 };
  for (const s of votes) {
    if (s === "h" || s === "d" || s === "a") c[s] += 1;
  }
  const totalVotes = c.h + c.d + c.a;
  if (totalVotes < 2) return null;
  const withVotes = /** @type {Array<{ k: "h"|"d"|"a", n: number }>} */ (
    [
      { k: "h", n: c.h },
      { k: "d", n: c.d },
      { k: "a", n: c.a },
    ].filter((x) => x.n > 0)
  );
  if (withVotes.length < 2) return null;
  if ((c[officialSign] ?? 0) <= 0) return null;

  const minN = Math.min(...withVotes.map((x) => x.n));
  const minVoteCap = getImprobableMinVoteCap(totalVotes);
  if (minN > minVoteCap) return null;

  const minTier = withVotes.filter((x) => x.n === minN).map((x) => x.k);
  if (minTier.length < 1) return null;
  return minTier.includes(officialSign) ? officialSign : null;
}

/**
 * @deprecated Usar getUniqueOfficialOutcomeBonusSign (incluye resultado oficial y tope escalado).
 * Opción minoritaria “clara” en el recuento de un partido.
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
 * Diferencia Manhattan |Δ local| + |Δ visitante|. `null` si faltan goles o si es marcador exacto.
 * @param {{ home: unknown, away: unknown }} official
 * @param {{ home: unknown, away: unknown }} pred
 * @returns {number | null}
 */
export function matchScoreManhattanDistance(official, pred) {
  const oh = parseScore(official.home);
  const oa = parseScore(official.away);
  const ph = parseScore(pred.home);
  const pa = parseScore(pred.away);
  if (oh === null || oa === null || ph === null || pa === null) return null;
  if (ph === oh && pa === oa) return null;
  return Math.abs(oh - ph) + Math.abs(oa - pa);
}

/**
 * Participantes que reciben el bono «más cerca» en un partido.
 * Excluye marcadores exactos. La menor diferencia debe ser ≤ {@link CLOSEST_SCORE_MAX_DISTANCE}.
 * Solo aplica si quienes empatan la menor diferencia son minoría (≤ 25 %).
 * @param {{ home: unknown, away: unknown }} official
 * @param {Array<{ id: string, pred: { home: unknown, away: unknown } }>} entries predicciones confirmadas
 * @returns {Set<string>}
 */
export function getClosestScoreBonusParticipantIds(official, entries) {
  /** @type {{ id: string, dist: number }[]} */
  const atDistance = [];
  let totalCommitted = 0;
  for (const e of entries) {
    const ph = parseScore(e.pred.home);
    const pa = parseScore(e.pred.away);
    if (ph === null || pa === null) continue;
    totalCommitted += 1;
    const dist = matchScoreManhattanDistance(official, e.pred);
    if (dist === null) continue;
    atDistance.push({ id: e.id, dist });
  }
  if (totalCommitted < 2 || atDistance.length === 0) return new Set();
  const minDist = Math.min(...atDistance.map((x) => x.dist));
  if (minDist > CLOSEST_SCORE_MAX_DISTANCE) return new Set();
  const atMin = atDistance.filter((x) => x.dist === minDist);
  const cap = getImprobableMinVoteCap(totalCommitted);
  if (atMin.length > cap) return new Set();
  return new Set(atMin.map((x) => x.id));
}

/**
 * @param {{ home: unknown, away: unknown }} official
 * @param {{ home: unknown, away: unknown }} pred
 * @param {"h"|"d"|"a"|null|undefined} improbableOutcomeSign
 * @param {MatchScoringSlice} [scoring]
 * @param {boolean} [knockoutPenaltyPhase] si true y el marcador es empate en ambos, puede sumarse bono por penales
 * @param {boolean} [closestBonusEligible]
 * @returns {{ total: number, outcomePts: number, homeGoalsPts: number, awayGoalsPts: number, exactPts: number, improbablePts: number, penaltyPts: number, closestPts: number, exactTier: "bien"|"excelente"|"perfecto"|null } | null}
 */
function computeGroupMatchPointsParts(
  official,
  pred,
  improbableOutcomeSign = null,
  scoring = MATCH_SCORING.group,
  knockoutPenaltyPhase = false,
  closestBonusEligible = false,
) {
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
  const exactHit = ph === oh && pa === oa;
  let exactPts = 0;
  /** @type {"bien"|"excelente"|"perfecto"|null} */
  let exactTier = null;
  if (exactHit) {
    if (knockoutPenaltyPhase && outcomeOfficial === "d") {
      const ow = official.penaltyWinner;
      const pw = pred.penaltyWinner;
      const penaltiesHit = (ow === "home" || ow === "away") && pw === ow;
      exactPts = penaltiesHit ? exact + 1 : exact;
      exactTier = penaltiesHit ? "perfecto" : "excelente";
    } else if (knockoutPenaltyPhase) {
      exactPts = exact;
      exactTier = "perfecto";
    } else {
      exactPts = exact;
      exactTier = "perfecto";
    }
  } else {
    /**
     * Sin marcador exacto: BIEN / EXCELENTE alineados con reglas y quinielaComboBadgeNoPointsTier (app.js).
     * — Resultado acertado + goles de un solo equipo → EXCELENTE; solo resultado → BIEN; solo un equipo → BIEN.
     */
    const out = outcomePts > 0;
    const h = homeGoalsPts > 0;
    const a = awayGoalsPts > 0;
    const oneGoal = (h && !a) || (!h && a);
    if (out && oneGoal) {
      exactTier = "excelente";
    } else if (out && !h && !a) {
      exactTier = "bien";
    } else if (!out && oneGoal) {
      exactTier = "bien";
    }
  }
  const raw = outcomePts + homeGoalsPts + awayGoalsPts + exactPts;
  let improbablePts = 0;
  if (
    improbableOutcomeSign &&
    outcomeOfficial === outcomePred &&
    outcomeOfficial === improbableOutcomeSign
  ) {
    improbablePts = IMPROBABLE_BONUS;
  }
  let penaltyPts = 0;
  if (knockoutPenaltyPhase && outcomeOfficial === "d" && outcomePred === "d" && !exactHit) {
    const ow = official.penaltyWinner;
    const pw = pred.penaltyWinner;
    if ((ow === "home" || ow === "away") && pw === ow) {
      penaltyPts = 1;
    }
  }
  if (exactTier == null && penaltyPts > 0 && knockoutPenaltyPhase) {
    exactTier = "bien";
  }
  let closestPts = 0;
  if (closestBonusEligible) {
    closestPts = CLOSEST_SCORE_BONUS;
  }
  const total = Math.min(raw, maxPerMatch) + improbablePts + penaltyPts + closestPts;
  return {
    total,
    outcomePts,
    homeGoalsPts,
    awayGoalsPts,
    exactPts,
    improbablePts,
    penaltyPts,
    closestPts,
    exactTier,
  };
}

/**
 * @param {{ home: unknown, away: unknown }} official
 * @param {{ home: unknown, away: unknown }} pred
 * @param {"h"|"d"|"a"|null|undefined} [improbableOutcomeSign]
 * @param {MatchScoringSlice} [scoring]
 * @param {boolean} [knockoutPenaltyPhase]
 * @param {boolean} [closestBonusEligible]
 * @returns {number|null}
 */
export function computeGroupMatchPoints(
  official,
  pred,
  improbableOutcomeSign = null,
  scoring = MATCH_SCORING.group,
  knockoutPenaltyPhase = false,
  closestBonusEligible = false,
) {
  const p = computeGroupMatchPointsParts(
    official,
    pred,
    improbableOutcomeSign,
    scoring,
    knockoutPenaltyPhase,
    closestBonusEligible,
  );
  return p ? p.total : null;
}

/**
 * @param {{ home: unknown, away: unknown }} official
 * @param {{ home: unknown, away: unknown }} pred
 * @param {"h"|"d"|"a"|null|undefined} [improbableOutcomeSign]
 * @param {MatchScoringSlice} [scoring]
 * @param {boolean} [knockoutPenaltyPhase]
 * @param {boolean} [closestBonusEligible]
 */
export function computeGroupMatchPointsBreakdown(
  official,
  pred,
  improbableOutcomeSign = null,
  scoring = MATCH_SCORING.group,
  knockoutPenaltyPhase = false,
  closestBonusEligible = false,
) {
  return computeGroupMatchPointsParts(
    official,
    pred,
    improbableOutcomeSign,
    scoring,
    knockoutPenaltyPhase,
    closestBonusEligible,
  );
}

export function isExactGroupPrediction(official, pred) {
  const oh = parseScore(official.home);
  const oa = parseScore(official.away);
  const ph = parseScore(pred.home);
  const pa = parseScore(pred.away);
  if (oh === null || oa === null || ph === null || pa === null) return false;
  return ph === oh && pa === oa;
}
