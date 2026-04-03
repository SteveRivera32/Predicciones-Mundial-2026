/**
 * Reglas de puntuación (Mundial 2026). Usar al calcular puntos cuando existan resultados reales.
 * Los máximos por bloque coinciden con la página «Reglas».
 */

/** @deprecated en UI: la quiniela de generales usa PODIUM_SLOT_AWARDS_ORDER + PODIUM_EXACT_COUNT_BONUS */
export const PODIUM_COUNTRY_TIERS = { 1: 5, 2: 7, 3: 10 };

/** @deprecated en UI: ver PODIUM_EXACT_COUNT_BONUS */
export const PODIUM_EXACT_POSITION = 2;

/** Por cada casilla 1.º→2.º→3.º cuyo país está en el podio real (en cualquier puesto): 1.º acierto +5, 2.º +2, 3.º +3 (= 10 si acierta los 3 países) */
export const PODIUM_SLOT_AWARDS_ORDER = [5, 2, 3];

/** Bonus por cantidad de posiciones exactas: 1→+2 (Bien), 2→+4 (Excelente), 3→+6 (Perfecto) */
export const PODIUM_EXACT_COUNT_BONUS = { 1: 2, 2: 4, 3: 6 };

export const MAX_PODIUM = 16;

export const INDIVIDUAL_AWARD_POINTS = 3;
export const MAX_INDIVIDUAL_AWARDS = 9;

/** +1 por equipo acertado entre los dos clasificados; +2 si acierta el orden 1.º/2.º (BIEN); +2 si el orden 1–4 es exacto (EXCELENTE); +1 si acierta si el 3.º pasa; +1 si orden 1–4 exacto y acierto 3.º (PERFECTO) */
export const GROUP_PASS_POINTS = 1;
export const GROUP_QUALIFIERS_ORDER_BONUS = 2;
export const GROUP_PERFECT_ORDER_BONUS = 2;
export const GROUP_THIRD_ADVANCE_POINTS = 1;
/** +1 cuando el orden 1–4 es exacto y además acierta si el 3.º pasa (suma con el +1 del acierto 3.º) */
export const GROUP_PERFECTO_ORDER_AND_THIRD_BONUS = 1;
export const MAX_PER_GROUP = 8;
export const MAX_GROUPS_TOTAL = 12 * MAX_PER_GROUP; // 96

/**
 * Calcula puntos de orden de grupo según reglas actuales.
 * @param {string[]} predictedOrder
 * @param {string[]} officialOrder
 * @param {boolean|undefined} predictedThirdAdvances
 * @param {boolean|undefined} officialThirdAdvances
 */
export function computeGroupOrderPoints(
  predictedOrder,
  officialOrder,
  predictedThirdAdvances,
  officialThirdAdvances,
) {
  if (!Array.isArray(predictedOrder) || !Array.isArray(officialOrder)) return 0;
  const predTop2 = predictedOrder.slice(0, 2);
  const offTop2 = officialOrder.slice(0, 2);
  if (predTop2.length < 2 || offTop2.length < 2) return 0;

  let points = 0;

  // +1 por cada clasificado directo acertado (sin importar el orden).
  const offTop2Set = new Set(offTop2.filter(Boolean));
  for (const team of predTop2) {
    if (team && offTop2Set.has(team)) points += GROUP_PASS_POINTS;
  }

  const fullOrderHit =
    predictedOrder.length >= 4 &&
    officialOrder.length >= 4 &&
    [0, 1, 2, 3].every((i) => predictedOrder[i] === officialOrder[i]);

  // +2 (BIEN) si acierta el orden exacto de 1.º y 2.º.
  if (predTop2[0] === offTop2[0] && predTop2[1] === offTop2[1]) {
    points += GROUP_QUALIFIERS_ORDER_BONUS;
  }

  // +2 (EXCELENTE) por orden completo exacto del grupo.
  if (fullOrderHit) {
    points += GROUP_PERFECT_ORDER_BONUS;
  }

  const thirdAdvanceHit =
    (predictedThirdAdvances === true || predictedThirdAdvances === false) &&
    (officialThirdAdvances === true || officialThirdAdvances === false) &&
    predictedThirdAdvances === officialThirdAdvances;

  // +1 por acertar si el 3.º predicho pasa como mejor tercero.
  if (thirdAdvanceHit) {
    points += GROUP_THIRD_ADVANCE_POINTS;
  }

  // +1 (PERFECTO) si orden 1–4 exacto y acierto de si el 3.º pasa.
  if (fullOrderHit && thirdAdvanceHit) {
    points += GROUP_PERFECTO_ORDER_AND_THIRD_BONUS;
  }

  return Math.min(points, MAX_PER_GROUP);
}

/**
 * Puntos por partido según fase: ganador o empate, goles por equipo (cada columna), marcador exacto.
 * Totales asumen el número de partidos del formato descrito en reglas (p. ej. 72 en grupos).
 */
export const MATCH_SCORING = {
  group: { outcome: 1, goalsEach: 1, exact: 1, maxPerMatch: 4, matchCount: 72 },
  /** Dieciseisavos (16 partidos); tope incluye +1 posible por penales en empate */
  r32: { outcome: 2, goalsEach: 1, exact: 1, maxPerMatch: 6, matchCount: 16 },
  /** Octavos (8 partidos) */
  r16: { outcome: 2, goalsEach: 1, exact: 2, maxPerMatch: 7, matchCount: 8 },
  /** Cuartos (4 partidos) */
  qf: { outcome: 3, goalsEach: 1, exact: 2, maxPerMatch: 8, matchCount: 4 },
  /** Semifinales (2 partidos) */
  sf: { outcome: 3, goalsEach: 1, exact: 3, maxPerMatch: 9, matchCount: 2 },
  /** 3.er puesto + final (2 partidos) */
  finalPlacement: { outcome: 4, goalsEach: 1, exact: 3, maxPerMatch: 10, matchCount: 2 },
};

export const IMPROBABLE_BONUS = 1;

/** Normaliza nombres de premios para comparar aciertos. */
export function normalizeAwardText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Puntos de «Predicciones generales» vs resultado oficial confirmado.
 * @param {Record<string, string>} pred
 * @param {Record<string, string>} official
 * @param {boolean} hasOfficialData
 */
export function computeGeneralPredictionsScore(pred, official, hasOfficialData) {
  const empty = {
    total: 0,
    exactCount: 0,
    /** @type {null | "bien" | "excelente" | "perfecto"} */
    exactTierLabel: null,
    exactTierPts: 0,
    cellPodiumPts: { first: 0, second: 0, third: 0 },
    cellExact: { first: false, second: false, third: false },
    cellQualWrongPos: { first: false, second: false, third: false },
    cellAwardPts: { bestPlayer: 0, bestGk: 0, topScorer: 0 },
  };
  if (!hasOfficialData) return empty;

  const pf = String(pred.first ?? "").trim();
  const ps = String(pred.second ?? "").trim();
  const pt = String(pred.third ?? "").trim();
  const of = String(official.first ?? "").trim();
  const os = String(official.second ?? "").trim();
  const ot = String(official.third ?? "").trim();

  const offPodium = [of, os, ot].filter(Boolean);
  if (offPodium.length < 3) {
    return empty;
  }

  const offSet = new Set(offPodium);

  const cellExact = {
    first: Boolean(pf && pf === of),
    second: Boolean(ps && ps === os),
    third: Boolean(pt && pt === ot),
  };

  let exactCount = 0;
  if (cellExact.first) exactCount += 1;
  if (cellExact.second) exactCount += 1;
  if (cellExact.third) exactCount += 1;

  let exactTierPts = 0;
  /** @type {null | "bien" | "excelente" | "perfecto"} */
  let exactTierLabel = null;
  if (exactCount === 1) {
    exactTierPts = PODIUM_EXACT_COUNT_BONUS[1];
    exactTierLabel = "bien";
  } else if (exactCount === 2) {
    exactTierPts = PODIUM_EXACT_COUNT_BONUS[2];
    exactTierLabel = "excelente";
  } else if (exactCount === 3) {
    exactTierPts = PODIUM_EXACT_COUNT_BONUS[3];
    exactTierLabel = "perfecto";
  }

  const slotTeams = [pf, ps, pt];
  /** @type {("first"|"second"|"third")[]} */
  const slotKeys = ["first", "second", "third"];
  /** @type {{ first: number, second: number, third: number }} */
  const cellPodiumPts = { first: 0, second: 0, third: 0 };
  let hitIdx = 0;
  for (let i = 0; i < 3; i++) {
    const team = slotTeams[i];
    if (team && offSet.has(team)) {
      const add = PODIUM_SLOT_AWARDS_ORDER[hitIdx] ?? 0;
      cellPodiumPts[slotKeys[i]] = add;
      hitIdx += 1;
    }
  }

  const cellQualWrongPos = {
    first: Boolean(pf && offSet.has(pf) && !cellExact.first),
    second: Boolean(ps && offSet.has(ps) && !cellExact.second),
    third: Boolean(pt && offSet.has(pt) && !cellExact.third),
  };

  const norm = normalizeAwardText;
  const oPlayer = norm(official.bestPlayer);
  const oGk = norm(official.bestGk);
  const oScorer = norm(official.topScorer);

  const cellAwardPts = {
    bestPlayer:
      oPlayer && pred.bestPlayer && norm(pred.bestPlayer) === oPlayer ? INDIVIDUAL_AWARD_POINTS : 0,
    bestGk: oGk && pred.bestGk && norm(pred.bestGk) === oGk ? INDIVIDUAL_AWARD_POINTS : 0,
    topScorer:
      oScorer && pred.topScorer && norm(pred.topScorer) === oScorer ? INDIVIDUAL_AWARD_POINTS : 0,
  };

  const awardsSum = cellAwardPts.bestPlayer + cellAwardPts.bestGk + cellAwardPts.topScorer;
  const podiumSlotsSum = cellPodiumPts.first + cellPodiumPts.second + cellPodiumPts.third;
  const podiumPart = Math.min(exactTierPts + podiumSlotsSum, MAX_PODIUM);
  const awardsPart = Math.min(awardsSum, MAX_INDIVIDUAL_AWARDS);
  const total = podiumPart + awardsPart;

  return {
    total,
    exactCount,
    exactTierLabel,
    exactTierPts,
    cellPodiumPts,
    cellExact,
    cellQualWrongPos,
    cellAwardPts,
  };
}

export function sumMatchPhaseMax() {
  let s = 0;
  for (const p of Object.values(MATCH_SCORING)) {
    s += p.maxPerMatch * p.matchCount;
  }
  return s;
}

/** Máximo de puntos en partidos sin contar el bono «resultado improbable» */
export const MAX_MATCH_SCORES_TOTAL = sumMatchPhaseMax(); // 510
